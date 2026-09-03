
/* =====================================================================
   v1.7.0 · NEURAL VOICE АЛЬФИ
   Локальный Piper TTS в браузере + лёгкая мультяшная Web Audio обработка.
   Без API-ключей и серверной части. Модель скачивается один раз в OPFS.
   ===================================================================== */
(() => {
  "use strict";

  const V17_VERSION=window.KITSUNE_APP_VERSION||"1.12.1";
  const V17_VOICE_ID="ru_RU-dmitri-medium";
  const V17_PACKAGE_URL="https://cdn.jsdelivr.net/npm/@mintplex-labs/piper-tts-web@1.0.5/+esm";

  const KEY_MODE="a8_alfi_voice_engine_v17";
  const KEY_READY="a8_alfi_neural_ready_v17";
  const KEY_CARTOON="a8_alfi_cartoon_v17";

  let mode="auto"; // auto | neural | system
  let cartoon=46;
  let modelReady=false;
  let ttsModule=null;
  let modulePromise=null;
  let neuralRun=0;
  let audioCtx=null;
  let audioSource=null;
  let neuralBusy=false;

  try{
    mode=localStorage.getItem(KEY_MODE)||"auto";
    modelReady=localStorage.getItem(KEY_READY)==="1";
    const c=Number(localStorage.getItem(KEY_CARTOON));
    if(Number.isFinite(c)&&c>=0&&c<=100)cartoon=c;
  }catch(e){}
  if(!["auto","neural","system"].includes(mode))mode="auto";

  const systemSpeak=typeof window.v151Speak==="function" ? window.v151Speak : null;
  const systemStop=typeof window.v161StopSpeech==="function" ? window.v161StopSpeech : null;

  function save(){
    try{
      localStorage.setItem(KEY_MODE,mode);
      localStorage.setItem(KEY_READY,modelReady?"1":"0");
      localStorage.setItem(KEY_CARTOON,String(cartoon));
    }catch(e){}
  }

  function setStatus(text,kind=""){
    const el=document.querySelector("#v17NeuralStatus");
    if(!el)return;
    el.textContent=text;
    el.className=`v17-neural-status ${kind}`.trim();
  }

  function setProgress(percent,label=""){
    const wrap=document.querySelector("#v17NeuralProgress");
    const bar=document.querySelector("#v17NeuralProgressBar");
    const txt=document.querySelector("#v17NeuralProgressText");
    if(!wrap||!bar||!txt)return;
    if(percent===null){
      wrap.classList.remove("show");
      return;
    }
    wrap.classList.add("show");
    const p=Math.max(0,Math.min(100,Number(percent)||0));
    bar.style.width=`${p}%`;
    txt.textContent=label?`${label} · ${Math.round(p)}%`:`${Math.round(p)}%`;
  }

  function updateUi({refreshStatus=true}={}){
    document.querySelectorAll("[data-v17-engine]").forEach(b=>{
      const active=(mode==="system"&&b.dataset.v17Engine==="system") ||
                   (mode!=="system"&&b.dataset.v17Engine==="neural");
      b.classList.toggle("active",active);
    });

    const slider=document.querySelector("#v17Cartoon");
    const out=document.querySelector("#v17CartoonValue");
    if(slider)slider.value=String(cartoon);
    if(out)out.textContent=`${cartoon}%`;

    const dl=document.querySelector("#v17Download");
    const test=document.querySelector("#v17TestNeural");
    const del=document.querySelector("#v17DeleteNeural");
    if(dl)dl.textContent=modelReady?"✅ Голос скачан":"⬇ Скачать голос Kitsune (~63 МБ)";
    if(dl)dl.disabled=neuralBusy||modelReady;
    if(test)test.disabled=neuralBusy||!modelReady;
    if(del)del.disabled=neuralBusy||!modelReady;

    if(!refreshStatus)return;

    if(modelReady){
      setStatus(mode==="system"
        ?"Нейроголос сохранён, но сейчас выбран системный."
        :"Neural Voice готов. Нажми «Тест нейроголоса».","ok");
    }else{
      setStatus("Нейроголос ещё не скачан. Пока работает системная озвучка.","");
    }
  }

  function injectUi(){
    const host=document.querySelector("#v151VoiceSettings");
    if(!host||document.querySelector("#v17NeuralVoice"))return;

    const block=document.createElement("div");
    block.className="v17-neural";
    block.id="v17NeuralVoice";
    block.innerHTML=`
      <div class="v17-neural-head">
        <div>
          <strong>🎭 Neural Voice Kitsune</strong>
          <small>Локальный нейро-TTS · без API</small>
        </div>
        <span class="v17-neural-badge">v${V17_VERSION}</span>
      </div>

      <div class="v17-engine-row">
        <button type="button" class="v17-engine-btn" data-v17-engine="neural">✨ Нейро</button>
        <button type="button" class="v17-engine-btn" data-v17-engine="system">📱 Системный</button>
      </div>

      <label class="v17-cartoon-field">
        <span><b>🎬 Мультяшность</b><output id="v17CartoonValue">${cartoon}%</output></span>
        <input id="v17Cartoon" type="range" min="0" max="100" step="1" value="${cartoon}">
        <small>Лёгкая обработка тембра, яркости и эмоциональной подачи. Без имитации конкретного персонажа.</small>
      </label>

      <div class="v17-neural-status" id="v17NeuralStatus"></div>

      <div class="v17-neural-progress" id="v17NeuralProgress">
        <div class="v17-progress-track"><i id="v17NeuralProgressBar"></i></div>
        <span id="v17NeuralProgressText"></span>
      </div>

      <div class="v17-neural-actions">
        <button type="button" class="v15-action primary-action" id="v17Download">⬇ Скачать голос Kitsune (~63 МБ)</button>
        <button type="button" class="v15-action" id="v17TestNeural">▶ Тест нейроголоса</button>
        <button type="button" class="v15-action" id="v17Recover">🔎 Проверить модель</button>
        <button type="button" class="v15-action danger-soft" id="v17DeleteNeural">🗑 Удалить модель</button>
      </div>

      <p class="v17-neural-note">
        Модель скачивается один раз и хранится локально в браузере. Если Neural Voice недоступен,
        Kitsune автоматически использует системный голос.
      </p>`;

    const autoRow=host.querySelector(".v151-auto-row");
    if(autoRow)autoRow.insertAdjacentElement("beforebegin",block);
    else host.appendChild(block);

    block.querySelectorAll("[data-v17-engine]").forEach(btn=>{
      btn.addEventListener("click",()=>{
        mode=btn.dataset.v17Engine==="system"?"system":"neural";
        save();updateUi();
        if(mode==="neural"&&!modelReady){
          setStatus("Выбран Neural Voice. Сначала нажми «Скачать голос Kitsune».","warn");
        }
      });
    });

    const slider=block.querySelector("#v17Cartoon");
    slider?.addEventListener("input",()=>{
      cartoon=Math.max(0,Math.min(100,Number(slider.value)||0));
      block.querySelector("#v17CartoonValue").textContent=`${cartoon}%`;
    });
    slider?.addEventListener("change",()=>{
      save();
      if(modelReady) v17Test();
    });

    block.querySelector("#v17Download")?.addEventListener("click",downloadAndPrepare);
    block.querySelector("#v17TestNeural")?.addEventListener("click",v17Test);
    block.querySelector("#v17Recover")?.addEventListener("click",()=>recoverStoredModel({announce:true}));
    block.querySelector("#v17DeleteNeural")?.addEventListener("click",deleteModel);

    updateUi();

    if(location.protocol==="file:"){
      setStatus("Локальное превью: Neural Voice лучше проверять после публикации на GitHub Pages (HTTPS). Системный fallback работает и здесь.","warn");
    }else if(!window.isSecureContext){
      setStatus("Для локального хранения нейромодели нужен защищённый HTTPS-контекст.","warn");
    }
  }

  async function loadModule(){
    if(ttsModule)return ttsModule;
    if(modulePromise)return modulePromise;

    modulePromise=(async()=>{
      setStatus("Подключаю нейродвижок…","busy");
      try{
        ttsModule=await import(V17_PACKAGE_URL);
        return ttsModule;
      }catch(err){
        modulePromise=null;
        throw new Error("Не удалось загрузить нейродвижок. Проверь интернет и открой курс через HTTPS/GitHub Pages.");
      }
    })();

    return modulePromise;
  }

  async function verifyStored({silent=true}={}){
    try{
      const tts=await loadModule();
      if(typeof tts.stored!=="function")return modelReady;
      const list=await tts.stored();
      modelReady=Array.isArray(list)&&list.includes(V17_VOICE_ID);
      if(modelReady&&mode==="auto")mode="neural";
      save();
      updateUi({refreshStatus:!silent});
      return modelReady;
    }catch(e){
      if(!silent)setStatus(`Не удалось проверить локальную модель: ${String(e?.message||e).slice(0,130)}`,"error");
      return modelReady;
    }
  }

  async function recoverStoredModel({announce=false}={}){
    if(neuralBusy)return modelReady;
    neuralBusy=true;
    updateUi({refreshStatus:false});
    if(announce)setStatus("Проверяю локальное хранилище браузера…","busy");

    try{
      const tts=await loadModule();
      if(typeof tts.stored!=="function")throw new Error("В библиотеке нет функции stored().");
      const list=await tts.stored();
      const found=Array.isArray(list)&&list.includes(V17_VOICE_ID);

      modelReady=found;
      if(found&&mode!=="system")mode="neural";
      save();
      updateUi({refreshStatus:false});

      if(found){
        setStatus("✅ Нашёл уже скачанную модель! Повторно 63 МБ качать не нужно. Нажми «Тест нейроголоса».","ok");
      }else if(announce){
        setStatus("В локальном хранилище модели нет. Нажми «Скачать голос Kitsune».","warn");
      }
      return found;
    }catch(err){
      if(announce)setStatus(friendlyError(err),"error");
      return modelReady;
    }finally{
      neuralBusy=false;
      updateUi({refreshStatus:false});
    }
  }

  function friendlyError(err){
    const s=String(err?.message||err||"");
    if(/quota|space|storage/i.test(s))return "Не хватило места в хранилище браузера. Освободи примерно 100 МБ и повтори.";
    if(/network|fetch|internet|load/i.test(s))return "Не удалось загрузить голос. Проверь интернет и повтори.";
    if(/secure|opfs|origin/i.test(s))return "Neural Voice лучше запускать с опубликованной HTTPS-версии на GitHub Pages.";
    return `Neural Voice пока не запустился: ${s.slice(0,150)}`;
  }

  async function downloadAndPrepare(){
    if(neuralBusy||modelReady)return;
    neuralBusy=true;
    updateUi({refreshStatus:false});
    setProgress(2,"Подготовка");

    let tts=null;
    let storedAfterDownload=false;

    try{
      tts=await loadModule();

      if(typeof tts.download!=="function"||typeof tts.predict!=="function"){
        throw new Error("Библиотека TTS загрузилась без необходимых функций.");
      }

      /* Сначала проверим — вдруг v1.7.0 уже успела сохранить модель. */
      if(typeof tts.stored==="function"){
        const before=await tts.stored();
        if(Array.isArray(before)&&before.includes(V17_VOICE_ID)){
          modelReady=true;
          storedAfterDownload=true;
          mode="neural";
          save();
          setProgress(null);
          updateUi({refreshStatus:false});
          setStatus("✅ Модель уже была скачана ранее. Повторная загрузка не нужна. Проверяю генерацию…","ok");
        }
      }

      if(!storedAfterDownload){
        setStatus("Скачиваю русский нейроголос. Не закрывай страницу…","busy");

        await tts.download(V17_VOICE_ID,progress=>{
          const total=Number(progress?.total)||0;
          const loaded=Number(progress?.loaded)||0;
          const pct=total>0 ? loaded/total*100 : 12;
          const url=String(progress?.url||"");
          const label=/\.onnx(?:$|\?)/i.test(url)?"Модель":/json/i.test(url)?"Конфигурация":"Загрузка";
          setProgress(pct,label);
        });

        setProgress(100,"Модель загружена");

        /* Критический FIX v1.7.1:
           100% загрузки и успешная генерация — это ДВА разных состояния.
           Готовность модели определяем по OPFS через stored(), а не по warm-up. */
        if(typeof tts.stored==="function"){
          const list=await tts.stored();
          storedAfterDownload=Array.isArray(list)&&list.includes(V17_VOICE_ID);
        }else{
          storedAfterDownload=true;
        }

        if(!storedAfterDownload){
          throw new Error("Загрузка дошла до 100%, но библиотека не видит модель в локальном хранилище.");
        }

        modelReady=true;
        mode="neural";
        save();
        updateUi({refreshStatus:false});
        setStatus("✅ Модель скачана и сохранена. Теперь проверяю первый запуск нейродвижка…","busy");
      }

      /* Прогрев больше НЕ определяет, скачана модель или нет. */
      try{
        const warm=await tts.predict({
          text:"Готово.",
          voiceId:V17_VOICE_ID
        });

        if(!(warm instanceof Blob))throw new Error("Нейродвижок не вернул звуковой файл.");

        setProgress(null);
        updateUi({refreshStatus:false});
        setStatus("✅ Neural Voice полностью готов! Нажми «Тест нейроголоса».","ok");

        setTimeout(()=>v17SpeakNeural(
          "Ура! Мой новый голос готов. Теперь давай разбираться в алгебре вместе!",
          {state:"celebrate",force:true}
        ),180);

      }catch(warmErr){
        /* Модель остаётся READY: пользователь НЕ должен качать 63 МБ заново. */
        modelReady=true;
        mode="neural";
        save();
        setProgress(null);
        updateUi({refreshStatus:false});
        setStatus(
          "✅ Модель скачана. Но первый запуск движка не удался: "+
          String(warmErr?.message||warmErr).slice(0,115)+
          ". Нажми «Тест нейроголоса» — если повторится, Kitsune автоматически включит системный голос.",
          "warn"
        );
        console.warn("[Alfi Neural Voice warm-up]",warmErr);
      }

    }catch(err){
      /* Даже после ошибки ещё раз проверяем OPFS — скачанный файл не теряем. */
      let found=false;
      try{
        if(tts&&typeof tts.stored==="function"){
          const list=await tts.stored();
          found=Array.isArray(list)&&list.includes(V17_VOICE_ID);
        }
      }catch(e){}

      modelReady=found;
      if(found&&mode!=="system")mode="neural";
      save();
      setProgress(null);
      updateUi({refreshStatus:false});

      if(found){
        setStatus(
          "✅ Модель в браузере сохранена, повторно скачивать её не нужно. Ошибка была уже на этапе запуска: "+
          String(err?.message||err).slice(0,120),
          "warn"
        );
      }else{
        setStatus(friendlyError(err),"error");
      }
      console.warn("[Alfi Neural Voice]",err);

    }finally{
      neuralBusy=false;
      updateUi({refreshStatus:false});
    }
  }
  async function deleteModel(){
    if(neuralBusy||!modelReady)return;
    if(!confirm("Удалить нейроголос Kitsune из памяти браузера? Системный голос останется работать."))return;

    neuralBusy=true;updateUi();
    try{
      const tts=await loadModule();
      if(typeof tts.remove==="function")await tts.remove(V17_VOICE_ID);
      modelReady=false;
      mode="auto";
      save();
      setStatus("Нейроголос удалён. Kitsune снова использует системную озвучку.","");
    }catch(err){
      setStatus(friendlyError(err),"error");
    }finally{
      neuralBusy=false;updateUi();
    }
  }

  function cleanText(text){
    let s=String(text||"");
    try{
      if(typeof window.v161CleanSpeechText==="function")s=window.v161CleanSpeechText(s);
      else if(typeof window.v15Strip==="function")s=window.v15Strip(s);
    }catch(e){}
    return s
      .replace(/\s+/g," ")
      .replace(/\bKitsune Smart Tutor\b/gi,"тьютор Kitsune")
      .trim();
  }

  function emotion(state){
    return ({
      wave:{rate:.018,cents:32,brightness:1.0},
      think:{rate:-.025,cents:-12,brightness:-.3},
      explain:{rate:-.030,cents:-8,brightness:0},
      happy:{rate:.035,cents:48,brightness:1.6},
      oops:{rate:-.040,cents:-28,brightness:-.7},
      focus:{rate:-.045,cents:-20,brightness:-.5},
      cheer:{rate:.055,cents:65,brightness:2.1},
      celebrate:{rate:.060,cents:78,brightness:2.5},
      sleep:{rate:-.080,cents:-45,brightness:-1.2},
      idle:{rate:0,cents:0,brightness:0}
    })[state]||{rate:0,cents:0,brightness:0};
  }

  async function decodeBlob(blob){
    const AC=window.AudioContext||window.webkitAudioContext;
    if(!AC)throw new Error("Web Audio API не поддерживается.");
    if(!audioCtx||audioCtx.state==="closed")audioCtx=new AC();
    if(audioCtx.state==="suspended")await audioCtx.resume();
    const arr=await blob.arrayBuffer();
    return await audioCtx.decodeAudioData(arr.slice(0));
  }

  function stopNeural(){
    neuralRun++;
    try{audioSource?.stop()}catch(e){}
    try{audioSource?.disconnect()}catch(e){}
    audioSource=null;
    neuralBusy=false;
    try{window.v161MarkSpeaking?.(false,"idle")}catch(e){}
  }

  async function playProcessed(blob,state="explain",onDone=null,runId=null){
    const buffer=await decodeBlob(blob);
    if(runId!==null&&runId!==neuralRun)return;

    const source=audioCtx.createBufferSource();
    audioSource=source;
    source.buffer=buffer;

    const amount=cartoon/100;
    const emo=emotion(state);

    /* Небольшой подъём тона — специально умеренный, чтобы голос оставался
       человеческим и не превращался в «гелиевый». */
    source.playbackRate.value=Math.max(.88,Math.min(1.12,1+emo.rate+amount*.018));
    source.detune.value=emo.cents*amount + amount*42;

    const body=audioCtx.createBiquadFilter();
    body.type="peaking";
    body.frequency.value=1550;
    body.Q.value=.72;
    body.gain.value=amount*2.3 + emo.brightness*.35;

    const sparkle=audioCtx.createBiquadFilter();
    sparkle.type="highshelf";
    sparkle.frequency.value=4300;
    sparkle.gain.value=amount*2.0 + emo.brightness*.45;

    const warmth=audioCtx.createBiquadFilter();
    warmth.type="lowshelf";
    warmth.frequency.value=260;
    warmth.gain.value=1.0-amount*.9;

    const comp=audioCtx.createDynamicsCompressor();
    comp.threshold.value=-20;
    comp.knee.value=14;
    comp.ratio.value=2.4;
    comp.attack.value=.008;
    comp.release.value=.18;

    const gain=audioCtx.createGain();
    gain.gain.value=.96;

    /* v1.10: анализатор реальной амплитуды Neural Voice.
       Kitsune Live использует его только для мягкого выбора разговорного кадра,
       поэтому рот реагирует на настоящую речь, а не прыгает по таймеру. */
    const visualAnalyser=audioCtx.createAnalyser();
    visualAnalyser.fftSize=512;
    visualAnalyser.smoothingTimeConstant=.58;

    source.connect(warmth);
    warmth.connect(body);
    body.connect(sparkle);
    sparkle.connect(comp);
    comp.connect(gain);
    gain.connect(visualAnalyser);
    visualAnalyser.connect(audioCtx.destination);

    try{window.KitsuneLive?.attachAnalyser?.(visualAnalyser)}catch(e){}
    try{window.v161MarkSpeaking?.(true,state)}catch(e){}

    source.onended=()=>{
      if(audioSource===source)audioSource=null;
      neuralBusy=false;
      try{window.KitsuneLive?.detachAnalyser?.()}catch(e){}
      try{window.v161MarkSpeaking?.(false,state)}catch(e){}
      onDone?.();
    };
    source.start();
  }

  async function v17SpeakNeural(text,{state="explain",force=false,onDone=null}={}){
    const myRun=++neuralRun;
    neuralBusy=true;
    try{systemStop?.()}catch(e){}

    /* v1.10: во время генерации WAV Kitsune НЕ двигает ртом.
       Разговорная анимация начинается только когда реально стартует audio source. */
    try{
      const tts=await loadModule();
      if(myRun!==neuralRun)return false;

      const ready=await verifyStored();
      if(!ready)throw new Error("Нейроголос ещё не скачан.");

      const phrase=cleanText(text);
      if(!phrase)throw new Error("Пустая реплика.");

      setStatus("Kitsune готовит нейроречь…","busy");

      const wav=await tts.predict({
        text:phrase,
        voiceId:V17_VOICE_ID
      });

      if(myRun!==neuralRun)return false;
      if(!(wav instanceof Blob))throw new Error("Нейродвижок не вернул аудио.");

      setStatus("Neural Voice активен.","ok");
      await playProcessed(wav,state,onDone,myRun);
      return true;

    }catch(err){
      neuralBusy=false;
      try{window.KitsuneLive?.detachAnalyser?.()}catch(e){}
      try{window.v161MarkSpeaking?.(false,state)}catch(e){}
      console.warn("[Kitsune Neural Voice fallback]",err);
      if(modelReady)setStatus("Нейроголос временно недоступен — включён системный fallback.","warn");

      if(systemSpeak){
        return systemSpeak(text,{state,force,onDone});
      }
      return false;
    }
  }

  async function v17Test(){
    if(!modelReady){
      setStatus("Сначала скачай голос Kitsune.","warn");
      return;
    }
    v17SpeakNeural(
      "Привет! Я Kitsune. Смотри: сначала найдём один понятный шаг. Отлично! А теперь двигаемся дальше.",
      {state:"happy",force:true}
    );
  }

  function shouldUseNeural(){
    if(mode==="system")return false;
    return modelReady;
  }

  /* Подменяем только точку синтеза. Вся существующая логика эмоций,
     автоозвучки, Tutor Lite и реакций остаётся прежней. */
  if(systemSpeak){
    window.v151Speak=function(text,opts={}){
      if(shouldUseNeural()){
        v17SpeakNeural(text,opts);
        return true;
      }

      if(mode==="neural"&&!modelReady){
        setStatus("Neural Voice выбран, но модель ещё не скачана — использую системный голос.","warn");
      }
      return systemSpeak(text,opts);
    };
  }

  if(systemStop){
    window.v161StopSpeech=function(){
      stopNeural();
      return systemStop.apply(this,arguments);
    };
  }

  /* Публичный мини-API для будущих версий курса. */
  window.AlfiNeuralVoice={
    version:V17_VERSION,
    voiceId:V17_VOICE_ID,
    download:downloadAndPrepare,
    remove:deleteModel,
    test:v17Test,
    speak:v17SpeakNeural,
    isReady:()=>modelReady,
    mode:()=>mode
  };

  /* Kitsune уже создаётся предыдущим скриптом. Если браузер медленный —
     повторяем внедрение несколько раз без побочных эффектов. */
  injectUi();
  setTimeout(injectUi,180);
  setTimeout(injectUi,900);

  if(modelReady){
    setStatus("Neural Voice отмечен как установлен. Проверю модель при первой реплике.","ok");
  }else if(location.protocol!=="file:"&&window.isSecureContext){
    /* FIX v1.7.1: восстанавливаем модель, скачанную предыдущей версией,
       даже если v1.7.0 не успела записать флаг modelReady в localStorage. */
    setTimeout(()=>recoverStoredModel({announce:false}).then(found=>{
      if(found)setStatus("✅ Нашёл модель, скачанную ранее. Нажми «Тест нейроголоса».","ok");
    }),700);
  }
})();
