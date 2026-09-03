
/* =====================================================================
   v1.8.0 · KITSUNE BRAIN
   Гибрид: проверенная математика Smart Tutor + локальная LLM через WebGPU.
   LLM не является источником математической истины — она только формулирует
   точный факт/следующий шаг живым русским языком.
   ===================================================================== */
(() => {
  "use strict";

  const VERSION="1.11.9";
  const WEBLLM_URL="https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.84/+esm";
  const MODEL_ID="Qwen2.5-0.5B-Instruct-q4f16_1-MLC";

  const MODE_KEY="a8_kitsune_brain_mode";
  const READY_KEY="a8_kitsune_brain_ready";
  const MEMORY_KEY="a8_kitsune_brain_memory";

  let mode="smart"; // brain | smart | hints
  let ready=false;
  let webllm=null;
  let engine=null;
  let enginePromise=null;
  let busy=false;
  let lastBrainNotice=null;
  let memory={errors:{},topics:{},recent:[]};

  try{
    mode=localStorage.getItem(MODE_KEY)||"smart";
    ready=localStorage.getItem(READY_KEY)==="1";
    memory=Object.assign(memory,JSON.parse(localStorage.getItem(MEMORY_KEY)||"{}"));
  }catch(e){}
  if(!["brain","smart","hints"].includes(mode))mode="smart";

  function save(){
    try{
      localStorage.setItem(MODE_KEY,mode);
      localStorage.setItem(READY_KEY,ready?"1":"0");
      localStorage.setItem(MEMORY_KEY,JSON.stringify(memory));
    }catch(e){}
  }

  function strip(s){
    try{return v16Strip(s)}catch(e){
      const d=document.createElement("div");
      d.innerHTML=String(s??"");
      return (d.textContent||"").replace(/\s+/g," ").trim();
    }
  }
  function norm(s){
    return String(s??"").toLowerCase().replace(/−/g,"-").replace(/≥/g,">=").replace(/≤/g,"<=")
      .replace(/×|·/g,"*").replace(/²/g,"^2").replace(/³/g,"^3").replace(/\s+/g,"").trim();
  }
  function expected(ctx){
    const arr=Array.isArray(ctx?.exercise?.a)?ctx.exercise.a:[ctx?.exercise?.a];
    return arr.filter(x=>x!==undefined&&x!==null).map(strip);
  }
  function smartSteps(ctx){
    try{
      const api=window.KitsuneSmartTutor||window.AlfiSmartTutor;
      const out=api?.steps?.(ctx);
      return Array.isArray(out)&&out.length?out:[strip(ctx.exercise?.hint)||"Используй подсказку текущего задания."];
    }catch(e){
      return [strip(ctx.exercise?.hint)||"Используй подсказку текущего задания."];
    }
  }

  function safeNextStep(ctx,step){
    let s=strip(step);
    if(!s)return "Проверь следующий математический переход.";
    if(/^ответ/i.test(s))return "Сформулируй итоговый ответ самостоятельно и проверь его подстановкой.";

    /* Не отдаём LLM финальную строку даже как часть verified nextStep. */
    if(/получаем\s+x\s*(?:=|≥|≤|>|<)/i.test(s)){
      s=s.split(/получаем/i)[0].trim();
      return `${s} Какой знак и какое значение x получатся после этого действия?`;
    }
    if(/тогда\s+x[₁12]/i.test(s)){
      s=s.split(/тогда/i)[0].trim();
      return `${s} Теперь самостоятельно подставь значения в формулу корней.`;
    }
    const answers=expected(ctx);
    for(const a of answers){
      if(a&&norm(s).includes(norm(a)))return strip(ctx.exercise?.hint)||"Выполни следующий шаг по правилу темы, но итог запиши самостоятельно.";
    }
    return s;
  }

  function miniFox(){
    return `<img class="v110-mini-kitsune" src="./assets/kitsune/idle.png" alt="" draggable="false" decoding="async">`;
  }

  function statusEl(){return document.querySelector("#v18BrainStatus")}
  function setStatus(text,kind=""){
    const el=statusEl();
    if(!el)return;
    el.textContent=text;
    el.className=`v18-brain-status ${kind}`.trim();
  }
  function progress(p,text=""){
    const wrap=document.querySelector("#v18BrainProgress");
    const bar=document.querySelector("#v18BrainBar");
    const label=document.querySelector("#v18BrainProgressText");
    if(!wrap||!bar||!label)return;
    if(p===null){wrap.classList.remove("show");return}
    wrap.classList.add("show");
    const n=Math.max(0,Math.min(100,Number(p)||0));
    bar.style.width=`${n}%`;
    label.textContent=text?`${text} · ${Math.round(n)}%`:`${Math.round(n)}%`;
  }

  async function wasmAllowed(){
    try{
      /* Minimal valid WASM module. This specifically catches CSP blocks. */
      const bytes=new Uint8Array([0,97,115,109,1,0,0,0]);
      await WebAssembly.compile(bytes);
      return {ok:true,error:""};
    }catch(e){
      return {ok:false,error:String(e?.message||e).slice(0,180)};
    }
  }

  async function deviceInfo(){
    const info={
      webgpu:!!navigator.gpu,
      memory:Number(navigator.deviceMemory)||null,
      quota:null,usage:null,
      adapter:false,
      wasm:false,
      wasmError:""
    };
    try{
      if(navigator.storage?.estimate){
        const e=await navigator.storage.estimate();
        info.quota=e.quota||null;info.usage=e.usage||null;
      }
    }catch(e){}
    if(info.webgpu){
      try{info.adapter=!!(await navigator.gpu.requestAdapter())}catch(e){}
    }
    const w=await wasmAllowed();
    info.wasm=w.ok;info.wasmError=w.error;
    return info;
  }

  function humanGB(bytes){
    if(!bytes)return "неизвестно";
    return (bytes/1024/1024/1024).toFixed(1)+" ГБ";
  }

  async function refreshCompatibility(){
    const info=await deviceInfo();
    const box=document.querySelector("#v18DeviceInfo");
    if(!box)return info;

    if(location.protocol==="file:"){
      box.innerHTML=`<b>ℹ Локальное превью.</b><span>Kitsune Brain с WebGPU проверяй после публикации на GitHub Pages по HTTPS. Smart Tutor и комиксные подсказки работают и в превью.</span>`;
      box.className="v18-device-info warn";
      return info;
    }

    if(!info.webgpu||!info.adapter){
      box.innerHTML=`<b>⚠ WebGPU недоступен.</b><span>На iPhone нужен iOS/Safari 26 или новее и совместимое устройство. Kitsune автоматически использует Smart Tutor.</span>`;
      box.className="v18-device-info warn";
      if(mode==="brain"){mode="smart";save();updateUi({preserveStatus:true})}
      return info;
    }

    if(!info.wasm){
      box.innerHTML=`<b>⚠ WebAssembly заблокирован политикой браузера.</b><span>${info.wasmError||"Проверь CSP/режим повышенной защиты браузера."}</span>`;
      box.className="v18-device-info warn";
      return info;
    }

    const free=info.quota&&info.usage?info.quota-info.usage:null;
    const mem=info.memory?`${info.memory} ГБ RAM (оценка браузера)`:"RAM не сообщается браузером";
    box.innerHTML=`<b>✅ WebGPU доступен.</b><span>${mem}${free?` · свободное хранилище ≈ ${humanGB(free)}`:""}. Модель требует около 945 МБ VRAM по конфигурации WebLLM.</span>`;
    box.className="v18-device-info "+(info.memory&&info.memory<4?"warn":"ok");
    return info;
  }

  function updateUi({preserveStatus=false}={}){
    document.querySelectorAll("[data-v18-mode]").forEach(b=>b.classList.toggle("active",b.dataset.v18Mode===mode));
    const prep=document.querySelector("#v18PrepareBrain");
    const test=document.querySelector("#v18TestBrain");
    if(prep){
      prep.disabled=busy;
      prep.textContent=busy?"⏳ Подготавливаю Kitsune Brain…":ready?"✅ Мозг Kitsune подготовлен":"⬇ Подготовить мозг Kitsune";
    }
    if(test)test.disabled=busy||!ready;

    if(preserveStatus)return;

    if(lastBrainNotice){
      setStatus(lastBrainNotice.text,lastBrainNotice.kind);
      return;
    }
    if(ready){
      setStatus(engine?"Kitsune Brain загружен в память и готов к диалогу.":"Модель подготовлена локально. Загрузится в память при первом обращении.","ok");
    }else{
      setStatus("Сейчас работает Smart Tutor. Локальная LLM не скачивается без твоего нажатия.","");
    }
  }

  function injectSettings(){
    const settings=document.querySelector("#v15Settings");
    if(!settings||document.querySelector("#v18KitsuneBrain"))return;

    const block=document.createElement("div");
    block.id="v18KitsuneBrain";
    block.className="v18-brain-settings";
    block.innerHTML=`
      <div class="v18-brain-head">
        <div><strong>🦊 Kitsune Brain</strong><small>локальный ИИ · WebGPU · без API</small></div>
        <span>v1.11.9</span>
      </div>
      <div class="v18-mode-row">
        <button type="button" data-v18-mode="brain">🧠 Brain</button>
        <button type="button" data-v18-mode="smart">⚙ Smart Tutor</button>
        <button type="button" data-v18-mode="hints">💡 Только подсказки</button>
      </div>
      <div class="v18-device-info" id="v18DeviceInfo">Проверяю устройство…</div>
      <div class="v18-brain-status" id="v18BrainStatus"></div>
      <div class="v18-brain-progress" id="v18BrainProgress">
        <div><i id="v18BrainBar"></i></div><span id="v18BrainProgressText"></span>
      </div>
      <div class="v18-brain-actions">
        <button type="button" class="v15-action primary-action" id="v18PrepareBrain">⬇ Подготовить мозг Kitsune</button>
        <button type="button" class="v15-action" id="v18TestBrain">💬 Проверить диалог</button>
      </div>
      <p class="v18-brain-note">Используется компактная Qwen2.5 0.5B. Математику проверяет наш Math Engine; модель только формулирует реплики Kitsune. На слабом устройстве включается Smart Tutor.</p>`;

    const voice=settings.querySelector("#v151VoiceSettings");
    if(voice)voice.insertAdjacentElement("beforebegin",block);
    else settings.appendChild(block);

    block.querySelectorAll("[data-v18-mode]").forEach(btn=>btn.addEventListener("click",async()=>{
      const next=btn.dataset.v18Mode;
      if(next==="brain"){
        const info=await deviceInfo();
        if(!info.webgpu||!info.adapter){
          mode="smart";
          setStatus("На этом устройстве WebGPU недоступен — оставляю Smart Tutor.","warn");
        }else{
          mode="brain";
          if(!ready)setStatus("Brain выбран. Для настоящего локального диалога нажми «Подготовить мозг Kitsune». До этого работает Smart Tutor.","warn");
        }
      }else mode=next;
      save();updateUi();
    }));

    block.querySelector("#v18PrepareBrain")?.addEventListener("click",prepareBrain);
    block.querySelector("#v18TestBrain")?.addEventListener("click",async()=>{
      const dummy={
        exercise:{q:"Реши 8−4x≥0.",a:["x≤2"],hint:"−4x≥−8 → x≤2."},
        lesson:{title:"Решение неравенств",remember:"При делении на отрицательное число знак неравенства меняется."},
        lessonId:"4-39",key:"demo"
      };
      const facts={
        status:"wrong_sign",
        diagnosis:"Получена правильная граница 2, но знак направлен в неверную сторону.",
        nextStep:"Вспомнить правило: при делении на отрицательное число знак неравенства меняется.",
        student:"x≥2",
        answer:"x≤2",
        allowAnswer:false
      };
      setStatus("Kitsune думает…","busy");
      const reply=await coachReply(dummy,facts);
      setStatus(`🦊 ${reply}`,"ok");
    });

    refreshCompatibility();
    updateUi();
  }

  async function loadWebLLM(){
    if(webllm)return webllm;
    webllm=await import(WEBLLM_URL);
    return webllm;
  }

  function appConfig(lib){
    return {...lib.prebuiltAppConfig,cacheBackend:"cache"};
  }

  async function checkCached(){
    try{
      const lib=await loadWebLLM();
      if(typeof lib.hasModelInCache!=="function")return ready;
      const v=await Promise.resolve(lib.hasModelInCache(MODEL_ID,appConfig(lib)));
      ready=!!v;
      save();updateUi();
      return ready;
    }catch(e){
      return ready;
    }
  }

  async function ensureEngine({explicit=false}={}){
    if(engine)return engine;
    if(enginePromise)return enginePromise;
    if(!ready&&!explicit)return null;

    const info=await deviceInfo();
    if(!info.webgpu||!info.adapter){
      mode="smart";save();
      lastBrainNotice={text:"WebGPU недоступен на этом устройстве. На iPhone требуется Safari/iOS 26+; Smart Tutor продолжает работать.",kind:"warn"};
      updateUi();
      return null;
    }
    if(!info.wasm){
      mode="smart";save();
      lastBrainNotice={text:"WebAssembly заблокирован браузером или CSP: "+(info.wasmError||"неизвестная причина"),kind:"warn"};
      updateUi();
      return null;
    }

    enginePromise=(async()=>{
      busy=true;lastBrainNotice=null;updateUi({preserveStatus:true});
      setStatus("Проверка WebGPU и WebAssembly пройдена. Загружаю WebLLM…","busy");
      try{
        const lib=await loadWebLLM();
        const cfg=appConfig(lib);
        setStatus(ready?"Загружаю Kitsune Brain из локального кэша…":"Скачиваю и подготавливаю локальную модель…","busy");

        engine=await lib.CreateMLCEngine(
          MODEL_ID,
          {
            appConfig:cfg,
            logLevel:"WARN",
            initProgressCallback:r=>{
              const p=Number(r?.progress);
              progress(Number.isFinite(p)?p*100:8,String(r?.text||"Подготовка").slice(0,80));
            }
          },
          {context_window_size:2048,temperature:.48,top_p:.88,repetition_penalty:1.05}
        );

        ready=true;mode="brain";lastBrainNotice=null;save();
        progress(null);
        setStatus("✅ Kitsune Brain готов. Модель работает прямо на устройстве.","ok");
        return engine;
      }catch(err){
        engine=null;
        progress(null);
        const msg=String(err?.message||err).slice(0,220);
        lastBrainNotice={text:"Brain не запустился — Smart Tutor остаётся активным. Причина: "+msg,kind:"warn"};
        setStatus(lastBrainNotice.text,lastBrainNotice.kind);
        console.warn("[Kitsune Brain]",err);
        return null;
      }finally{
        busy=false;enginePromise=null;updateUi({preserveStatus:!!lastBrainNotice});
      }
    })();

    return enginePromise;
  }

  async function prepareBrain(){
    if(busy)return;
    lastBrainNotice=null;
    setStatus("Проверяю совместимость iPhone/Android: WebGPU + WebAssembly…","busy");
    progress(2,"Проверка устройства");
    try{
      await ensureEngine({explicit:true});
    }finally{
      if(!busy&&document.querySelector("#v18BrainProgress")?.classList.contains("show")&&!engine){
        progress(null);
      }
    }
  }

  function rememberError(ctx,type){
    if(!type)return;
    const lesson=ctx.lessonId||"unknown";
    memory.errors[type]=(memory.errors[type]||0)+1;
    memory.topics[lesson]=memory.topics[lesson]||{errors:{},count:0};
    memory.topics[lesson].errors[type]=(memory.topics[lesson].errors[type]||0)+1;
    memory.topics[lesson].count++;
    memory.recent.unshift({lesson,type,ts:Date.now()});
    memory.recent=memory.recent.slice(0,40);
    save();
  }

  function repeated(ctx,type){
    return memory.topics?.[ctx.lessonId]?.errors?.[type]||0;
  }

  function safeFallback(ctx,facts){
    const next=safeNextStep(ctx,facts.nextStep||smartSteps(ctx)[0]||strip(ctx.exercise?.hint));
    if(facts.status==="correct_step"){
      return `Да, этот шаг верный! Теперь посмотри на следующий: ${next}`;
    }
    if(facts.status==="wrong_sign"){
      return `Вот место, где сбились 👀 Граница получилась верная, а знак — нет. ${next} Что должно измениться?`;
    }
    if(facts.status==="wrong_value"){
      return `Почти. Я бы сейчас проверила именно вычисление. ${next}`;
    }
    if(facts.status==="empty"){
      return `Начни вот отсюда: ${next} Запиши только этот один шаг.`;
    }
    return `${facts.diagnosis||"Здесь есть ошибка."} Подсказка: ${next}`;
  }

  function containsAnswer(reply,answers){
    const r=norm(reply);
    return answers.some(a=>{
      const n=norm(a);
      return n.length>=2 && r.includes(n);
    });
  }

  function sanitizeReply(reply,ctx,facts){
    let s=strip(reply).replace(/^["«]|["»]$/g,"").trim();
    if(!s)return safeFallback(ctx,facts);
    if(!facts.allowAnswer&&containsAnswer(s,expected(ctx)))return safeFallback(ctx,facts);
    if(s.length>260)s=s.slice(0,257).trim()+"…";
    return s;
  }


  function childSafetyCheck(message){
    const text=String(message||"").toLowerCase();

    /* Obvious personal identifiers are never needed for algebra help. */
    if(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.test(text) ||
       /(?:\+?\d[\d\s()\-]{8,}\d)/.test(text)){
      return {
        type:"personal_data",
        reply:"Похоже, здесь есть личные контактные данные. Для занятий они не нужны — лучше не отправляй телефон, почту, адрес или пароли."
      };
    }

    const rules=[
      {
        type:"personal_data",
        re:/(?:мой|моя|мне).*?(?:телефон|номер|адрес|пароль|почт|email|фамили|имя)|(?:где ты жив|где я жив|скажи адрес)/i,
        reply:"Давай не будем писать здесь личные данные — имя, адрес, телефон, пароли или почту. Я могу помочь с учёбой без них 🦊"
      },
      {
        type:"secrecy",
        re:/(?:не говори|скрой|секрет).*?(?:родител|мам|пап|взросл)|(?:тайком от|без ведома).*?(?:родител|мам|пап)/i,
        reply:"Я не буду помогать скрывать что-то важное от родителей или другого взрослого, которому ты доверяешь. Если ситуация тревожит — лучше расскажи взрослому рядом."
      },
      {
        type:"self_harm",
        re:/(?:убить себя|самоубий|суицид|порезать себя|навредить себе|не хочу жить)/i,
        reply:"Мне важно, чтобы ты был(а) в безопасности. Если ты думаешь о том, чтобы причинить себе вред, прямо сейчас скажи взрослому рядом, которому доверяешь. Если есть непосредственная опасность — попроси взрослого связаться с экстренной службой."
      },
      {
        type:"adult",
        re:/(?:порно|порнограф|секс|эротик|обнажен|интимн)/i,
        reply:"Я учебный помощник для школьного курса и не обсуждаю взрослые интимные темы. Давай вернёмся к учёбе или другому безопасному вопросу."
      },
      {
        type:"drugs",
        re:/(?:наркот|кокаин|героин|метамф|как.*(?:купить|сделать).*?(?:траву|наркот)|закладк)/i,
        reply:"С наркотиками и их получением я не помогаю. Если вопрос связан со здоровьем или безопасностью, лучше обсуди его со взрослым, которому доверяешь."
      },
      {
        type:"weapons",
        re:/(?:как.*(?:сделать|собрать|купить).*?(?:бомб|оруж|пистолет|взрыв)|самодельн.*(?:бомб|оруж)|взрывчат)/i,
        reply:"Я не могу помогать с изготовлением или применением оружия и взрывчатых вещей. Могу помочь с безопасной физикой или математикой."
      },
      {
        type:"gambling",
        re:/(?:ставк[аи]|казино|букмек|как выиграть.*(?:казино|ставк)|азартн)/i,
        reply:"Я не помогаю с азартными играми и ставками. Лучше разберём математику вероятностей на безопасном учебном примере."
      }
    ];

    for(const rule of rules){
      if(rule.re.test(text))return rule;
    }
    return null;
  }

  function childSafeReply(text){
    let s=strip(text);

    /* Kitsune never sends children to arbitrary links or asks to move chat elsewhere. */
    if(/https?:\/\/|www\./i.test(s)){
      return "Я не буду отправлять тебя на случайные сайты. Если нужна дополнительная информация, лучше открой её вместе со взрослым. А здесь я помогу с курсом 🦊";
    }

    if(/(?:дай|напиши|скажи).{0,30}(?:телефон|адрес|пароль|email|почт|фамили)/i.test(s)){
      return "Личные данные мне не нужны. Не присылай имя, адрес, телефон, почту или пароли — для занятий они не требуются.";
    }

    if(/(?:не говори|скрой).{0,30}(?:родител|мам|пап|взросл)/i.test(s)){
      return "Я не предлагаю хранить важные секреты от родителей или доверенного взрослого. Давай лучше поговорим об учёбе.";
    }

    return s;
  }

  function dialogFallback(message,ctx){
    const q=strip(message);
    const low=q.toLowerCase();
    const steps=ctx?smartSteps(ctx):[];
    const first=ctx?safeNextStep(ctx,steps[0]||strip(ctx.exercise?.hint)):"";
    const rule=ctx?(strip(ctx.lesson?.remember)||strip(ctx.lesson?.why)||strip(ctx.lesson?.formula)):"";

    if(/привет|здравств|как дела|ты тут|kitsune|кицун/i.test(low)){
      return "Я здесь 🦊 Можешь написать или сказать вслух, что именно непонятно в текущем задании.";
    }
    if(/не понимаю|не понял|не поняла|объясни проще|совсем просто/i.test(low)){
      return first?`Хорошо, совсем просто: ${first}`:"Открой конкретное задание, и я объясню именно его первым маленьким шагом.";
    }
    if(/почему|зачем|откуда/i.test(low)){
      return rule?`Смысл здесь такой: ${rule}`:(first?`Посмотри на правило этого шага: ${first}`:"Открой задачу — тогда я смогу опереться на проверенное правило темы.");
    }
    if(/что дальше|следующ|дальше|куда/i.test(low)){
      return first?`Следующий ориентир: ${first}`:"Сначала выбери упражнение — тогда я увижу его контекст.";
    }
    if(/ответ|решение целиком|покажи решение/i.test(low)){
      if(ctx){
        const ans=expected(ctx)[0]||"";
        return ans?`Хорошо, раз ты попросил явно: ответ для самопроверки — ${ans}. Но лучше после этого повторить решение без подсказки.`:"В этом задании итоговый ответ не найден в данных курса.";
      }
    }
    if(ctx){
      return `Я вижу текущее задание. Скажи, на каком переходе ты остановился, или напиши свой последний шаг. Моя первая опора: ${first}`;
    }
    return "Можно поговорить 🙂 Но математические советы я даю надёжнее, когда открыт конкретный урок или задание.";
  }

  function isExplicitAnswerRequest(message){
    return /(?:скажи|покажи|дай|какой|каков).*ответ|решение целиком|готовый ответ/i.test(String(message||""));
  }

  async function dialogReply(message,ctx=null,history=[]){
    const user=strip(message);
    if(!user)return "Я слушаю 🦊";

    const safety=childSafetyCheck(user);
    if(safety)return safety.reply;

    if(mode!=="brain"){
      return dialogFallback(user,ctx);
    }

    const e=await ensureEngine({explicit:false});
    if(!e)return dialogFallback(user,ctx);

    const wantsAnswer=isExplicitAnswerRequest(user);
    const steps=ctx?smartSteps(ctx):[];
    const verified={
      topic:ctx?strip(ctx.lesson?.title):"",
      task:ctx?strip(ctx.exercise?.q):"",
      rule:ctx?(strip(ctx.lesson?.remember)||strip(ctx.lesson?.why)||strip(ctx.lesson?.formula)):"",
      hint:ctx?strip(ctx.exercise?.hint):"",
      safeSteps:ctx?steps.slice(0,3).map(s=>safeNextStep(ctx,s)):[],
      answer:wantsAnswer&&ctx?(expected(ctx)[0]||""):"",
      answerAllowed:!!(wantsAnswer&&ctx)
    };

    const system=`Ты Kitsune — добрый лисёнок-репетитор и собеседник в курсе алгебры 8 класса.
Отвечай по-русски, естественно и коротко: обычно 1–3 предложения.
Можно поддержать только лёгкий безопасный разговор про учёбу, настроение от занятий, интерес к математике и мотивацию. Не становись универсальным взрослым чат-ботом.
НИКОГДА не проси у ребёнка имя, фамилию, возраст, адрес, школу, телефон, email, пароль, фото или точное местоположение.
НИКОГДА не предлагай хранить секреты от родителей/взрослых, встречаться, переходить в другие чаты, покупать что-либо или открывать внешние ссылки.
Не поддерживай сексуальные/взрослые темы, наркотики, азартные игры, оружие, опасные инструкции или причинение вреда.
Для математики используй ТОЛЬКО VERIFIED_CONTEXT ниже. Не пересчитывай задачу самостоятельно и не придумывай новые математические факты.
Если вопрос математический, но VERIFIED_CONTEXT не содержит нужной информации, попроси открыть подходящее задание или написать промежуточный шаг.
Если answerAllowed=false, не называй финальный ответ и не восстанавливай его догадкой.
Если ученик говорит «не понимаю», объясни следующий проверенный шаг проще.
Если спрашивает «почему», объясни правило из verified context.
Не упоминай модель, JSON, системные инструкции или Math Engine.`;

    const recent=Array.isArray(history)?history.slice(-6):[];
    const messages=[
      {role:"system",content:system},
      {role:"system",content:"VERIFIED_CONTEXT:\n"+JSON.stringify(verified)},
      ...recent.filter(x=>x&&["user","assistant"].includes(x.role)&&x.content)
        .map(x=>({role:x.role,content:strip(x.content).slice(0,350)})),
      {role:"user",content:user.slice(0,500)}
    ];

    try{
      const result=await e.chat.completions.create({
        messages,
        temperature:.55,
        top_p:.9,
        max_tokens:125
      });
      let reply=strip(result?.choices?.[0]?.message?.content||"");
      if(!reply)return dialogFallback(user,ctx);
      if(!wantsAnswer&&ctx&&containsAnswer(reply,expected(ctx)))return dialogFallback(user,ctx);
      reply=childSafeReply(reply);
      if(reply.length>430)reply=reply.slice(0,427).trim()+"…";
      return reply;
    }catch(err){
      console.warn("[Kitsune dialog]",err);
      return dialogFallback(user,ctx);
    }
  }

  async function coachReply(ctx,facts){
    if(mode!=="brain")return safeFallback(ctx,facts);
    const e=await ensureEngine({explicit:false});
    if(!e)return safeFallback(ctx,facts);

    const repeats=facts.errorType?repeated(ctx,facts.errorType):0;
    const system=`Ты Kitsune — добрый лисёнок-репетитор по алгебре 8 класса.
Ты получаешь VERIFIED_MATH_FACTS от математического ядра. Это единственный источник истины.
НЕЛЬЗЯ самостоятельно пересчитывать, менять знак, число, формулу или правильный ответ.
Твоя задача — превратить VERIFIED_MATH_FACTS в живую короткую реплику на русском.
Стиль: как умный персонаж из комикса, дружелюбно, естественно, 1–2 коротких предложения.
Если allowAnswer=false — НЕ называй финальный ответ и не записывай его даже косвенно.
Лучше задать один наводящий вопрос, связанный с nextStep.
Не говори общие фразы «давай разложим по шагам», «попробуй ещё раз», если есть конкретный nextStep.
Если repeatedErrors>=2, мягко напомни, что эта ловушка уже встречалась.
Не упоминай JSON, систему, модель или математическое ядро.`;

    const payload={
      task:strip(ctx.exercise?.q),
      topic:strip(ctx.lesson?.title),
      studentStep:facts.student||"",
      status:facts.status,
      diagnosis:facts.diagnosis||"",
      nextStep:facts.nextStep||"",
      rule:facts.rule||strip(ctx.lesson?.remember)||"",
      errorType:facts.errorType||"",
      repeatedErrors:repeats,
      allowAnswer:!!facts.allowAnswer
    };

    try{
      const result=await e.chat.completions.create({
        messages:[
          {role:"system",content:system},
          {role:"user",content:"VERIFIED_MATH_FACTS:\n"+JSON.stringify(payload)}
        ],
        temperature:.48,
        top_p:.88,
        max_tokens:90
      });
      const text=result?.choices?.[0]?.message?.content||"";
      return sanitizeReply(text,ctx,facts);
    }catch(err){
      console.warn("[Kitsune Brain completion]",err);
      return safeFallback(ctx,facts);
    }
  }

  function extractMathCandidates(step){
    const s=strip(step);
    const out=[];
    const patterns=[
      /(?:получаем|ответ:|тогда|корней?:)\s*([^.;]+)/gi,
      /(D\s*=\s*[-+]?\d+(?:[.,]\d+)?)/gi,
      /(x(?:₁|₁|1)?\s*(?:=|≥|≤|>|<)\s*[-+]?\d+(?:[.,]\d+)?)/gi,
      /([-+]?\d*x\s*(?:=|≥|≤|>|<)\s*[-+]?\d+(?:[.,]\d+)?)/gi
    ];
    for(const re of patterns){
      let m;while((m=re.exec(s)))out.push(m[1]||m[0]);
    }
    return out;
  }

  function boundary(s){
    const m=norm(s).match(/x(>=|<=|>|<)([-+]?\d+(?:\.\d+)?)/);
    return m?{op:m[1],n:Number(m[2])}:null;
  }

  function evaluateWork(ctx,raw){
    const text=strip(raw);
    const n=norm(text);
    const steps=smartSteps(ctx);
    const answers=expected(ctx);

    if(!text){
      return {
        status:"empty",errorType:"empty",
        diagnosis:"Промежуточный шаг пока не записан.",
        nextStep:safeNextStep(ctx,steps[0]),student:"",answer:answers[0],allowAnswer:false
      };
    }

    try{
      if(typeof v16Match==="function"&&v16Match(text,ctx.exercise.a)){
        return {
          status:"correct_step",errorType:null,
          diagnosis:"Получен правильный итоговый ответ.",
          nextStep:"Проверь решение обратным действием или подстановкой.",
          student:text,answer:answers[0],allowAnswer:true
        };
      }
    }catch(e){}

    for(let i=0;i<Math.min(3,steps.length);i++){
      const candidates=extractMathCandidates(steps[i]);
      if(candidates.some(c=>norm(c)===n || norm(c).includes(n) || (n.length>3&&n.includes(norm(c))))){
        return {
          status:"correct_step",errorType:null,
          diagnosis:`Промежуточный шаг ${i+1} совпадает с проверенной цепочкой решения.`,
          nextStep:(i+1>=steps.length-1)
            ?"Остановись перед финальным ответом и проверь предыдущий шаг обратным действием."
            :safeNextStep(ctx,steps[i+1]),
          student:text,answer:answers[0],allowAnswer:false
        };
      }
    }

    const u=boundary(text);
    for(const st of steps){
      for(const c of extractMathCandidates(st)){
        const ex=boundary(c);
        if(u&&ex&&u.n===ex.n&&u.op!==ex.op){
          return {
            status:"wrong_sign",errorType:"inequality_flip",
            diagnosis:`Числовая граница ${u.n} совпала, но направление знака не совпадает с проверенным шагом.`,
            nextStep:"Вспомни: при делении или умножении неравенства на отрицательное число знак меняется на противоположный.",
            student:text,answer:answers[0],allowAnswer:false
          };
        }
      }
    }

    const dUser=n.match(/^d=([-+]?\d+(?:\.\d+)?)$/);
    if(dUser){
      const dExpected=steps.flatMap(extractMathCandidates).map(norm).find(x=>/^d=/.test(x));
      if(dExpected&&dExpected!==n){
        return {
          status:"wrong_value",errorType:"quadratic",
          diagnosis:`Значение дискриминанта не совпало с проверенным вычислением.`,
          nextStep:strip(steps.find(s=>/D=b²−4ac|дискриминант/i.test(s))||steps[0]),
          student:text,answer:answers[0],allowAnswer:false
        };
      }
    }

    let cls=null;
    try{cls=v16Classify(ctx,text)}catch(e){}
    const info=cls?.type&&window.v16ErrorText?.[cls.type]?window.v16ErrorText[cls.type]:null;
    return {
      status:"wrong_step",
      errorType:cls?.type||"generic",
      diagnosis:info?.tip||`Этот шаг не совпал с проверенной цепочкой решения.`,
      nextStep:safeNextStep(ctx,steps[0]),
      student:text,answer:answers[0],allowAnswer:false
    };
  }

  function comicHost(panel){
    let row=panel.querySelector(".v18-comic-row");
    if(row)return row;
    row=document.createElement("div");
    row.className="v18-comic-row";
    row.innerHTML=`
      <div class="v18-comic-fox">${miniFox()}</div>
      <div class="v18-comic-bubble">
        <div class="v18-comic-name">Kitsune <span>думает вместе с тобой</span></div>
        <div class="v18-comic-text">Я здесь 🦊</div>
        <div class="v18-comic-thinking"><i></i><i></i><i></i></div>
      </div>`;
    const diag=panel.querySelector(".v173-diagnosis");
    if(diag)diag.insertAdjacentElement("beforebegin",row);
    else panel.prepend(row);
    return row;
  }

  async function say(panel,ctx,facts){
    const row=comicHost(panel);
    const text=row.querySelector(".v18-comic-text");
    const thinking=row.querySelector(".v18-comic-thinking");
    thinking.classList.add("show");
    text.textContent=mode==="brain"&&ready?"Секунду, я посмотрю именно на этот шаг…":"";
    if(facts.errorType)rememberError(ctx,facts.errorType);

    const reply=await coachReply(ctx,facts);
    thinking.classList.remove("show");
    text.textContent=reply;

    try{
      if(typeof v151AutoSpeak==="function"&&v151VoiceAuto)v151AutoSpeak(reply,facts.status==="correct_step"?"happy":"think");
    }catch(e){}
  }

  function factsFromOpen(ctx,opts){
    const steps=smartSteps(ctx);
    const user=opts?.userValue||ctx.box?.querySelector("input")?.value||"";
    if(opts?.reason==="wrong"){
      const evaluated=evaluateWork(ctx,user);
      if(opts.errorType)evaluated.errorType=opts.errorType;
      return evaluated;
    }
    return {
      status:"empty",errorType:null,
      diagnosis:"Разбираем текущий пример.",
      nextStep:strip(steps[0]),
      student:user,answer:expected(ctx)[0],allowAnswer:false
    };
  }

  function enhancePanel(ctx,opts){
    const panel=ctx.box?.querySelector(".v173-inline-tutor");
    if(!panel)return;

    panel.classList.add("v18-kitsune-comic");
    const head=panel.querySelector(".v173-inline-head strong");
    if(head)head.textContent="🦊 Kitsune рядом";
    const sub=panel.querySelector(".v173-inline-head small");
    if(sub)sub.textContent="вижу конкретный пример и твои шаги";

    const workBox=panel.querySelector(".v173-work-box");
    const ta=workBox?.querySelector("textarea");
    if(ta)ta.placeholder="Напиши следующий шаг, например: −4x≥−8 или D=16";

    const oldCheck=workBox?.querySelector(".v173-check-work");
    if(oldCheck&&!oldCheck.dataset.kitsuneBound){
      const clone=oldCheck.cloneNode(true);
      clone.dataset.kitsuneBound="1";
      clone.textContent="🦊 Проверить мой шаг";
      oldCheck.replaceWith(clone);
      clone.addEventListener("click",async()=>{
        const raw=strip(ta?.value||"");
        const facts=evaluateWork(ctx,raw);
        const out=panel.querySelector(".v173-work-result");
        if(out){
          out.textContent=facts.status==="correct_step"
            ?"✅ Шаг математически согласуется с проверенной цепочкой."
            :"Kitsune сейчас покажет, где именно возникло расхождение.";
          out.className=`v173-work-result ${facts.status==="correct_step"?"good":"warn"} show`;
        }
        await say(panel,ctx,facts);
      });
    }

    // При открытии — сразу живое сообщение по фактам, но не ответ.
    say(panel,ctx,factsFromOpen(ctx,opts));

    if(!panel.dataset.kitsuneEvents){
      panel.dataset.kitsuneEvents="1";
      panel.querySelector(".v173-next")?.addEventListener("click",()=>{
        setTimeout(()=>{
          const visible=[...panel.querySelectorAll(".v173-step.show:not(.answer-step)")];
          const last=visible.at(-1)?.querySelector("span")?.textContent||smartSteps(ctx)[0];
          say(panel,ctx,{
            status:"correct_step",errorType:null,
            diagnosis:"Открыт следующий проверенный шаг.",
            nextStep:strip(last),student:"",answer:expected(ctx)[0],allowAnswer:false
          });
        },60);
      });
      panel.querySelector(".v173-why")?.addEventListener("click",()=>{
        setTimeout(()=>{
          const why=strip(ctx.lesson?.why)||strip(ctx.lesson?.remember)||"Это следует из правила текущей темы.";
          say(panel,ctx,{
            status:"explain",errorType:null,
            diagnosis:"Объясняем смысл правила.",
            nextStep:why,student:"",answer:expected(ctx)[0],allowAnswer:false
          });
        },40);
      });
    }
  }

  // Оборачиваем существующий Smart Tutor. Математический render остаётся его.
  const originalOpen=window.v173OpenInline;
  if(typeof originalOpen==="function"){
    window.v173OpenInline=function(ctx,opts={}){
      if(mode==="hints"&&opts.reason==="wrong"){
        try{v15Chip?.("🦊 Kitsune: есть подсказка под кнопкой «Разобрать»")}catch(e){}
        return;
      }
      originalOpen(ctx,opts);
      setTimeout(()=>enhancePanel(ctx,opts),0);
    };
  }

  // Переименовываем legacy API, не ломая внутреннюю совместимость.
  if(window.AlfiSmartTutor&&!window.KitsuneSmartTutor)window.KitsuneSmartTutor=window.AlfiSmartTutor;

  window.KitsuneBrain={
    version:VERSION,
    modelId:MODEL_ID,
    mode:()=>mode,
    isReady:()=>ready,
    memory:()=>JSON.parse(JSON.stringify(memory)),
    prepare:prepareBrain,
    checkCached,
    evaluate:evaluateWork,
    reply:coachReply,
    chat:dialogReply,
    dialogFallback
  };

  injectSettings();
  setTimeout(injectSettings,180);
  setTimeout(injectSettings,900);

  if(ready){
    // Модель отмечена как подготовленная, но WebLLM и GPU не трогаем до первого
    // реального обращения или явного теста — быстрый старт курса важнее.
    setTimeout(()=>updateUi(),250);
  }
})();
