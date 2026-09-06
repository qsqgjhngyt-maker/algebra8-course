/* =====================================================================
   Kitsune v2.3.0-beta.3.7 · LIVE VOICE DIALOG

   Goals
   - local Whisper remains the microphone/STT authority;
   - compact thematic memory keeps follow-up questions on one topic;
   - only a small, privacy-filtered memory digest may accompany ordinary
     Cloud Brain conversation; raw audio and full chat history never do;
   - local Piper Irina is preferred for speech, with existing voice/system
     fallback preserved;
   - hands-free loop: listen -> recognize -> answer -> speak -> listen;
   - mic can interrupt speech;
   - lesson/dialog context remains protected by the final navigation firewall.
   ===================================================================== */
(() => {
  "use strict";

  const VERSION="2.3.0-beta.3.7";
  const MEMORY_KEY="a8_kitsune_topic_memory_v237";
  const HANDSFREE_KEY="a8_kitsune_handsfree_v237";
  const VOICE_KEY="a8_kitsune_irina_enabled_v237";
  const HISTORY_KEY="a8_kitsune_dialog_history_v19";

  const PIPER_PACKAGE="https://cdn.jsdelivr.net/npm/@realtimex/piper-tts-web@1.1.1/+esm";
  const IRINA_VOICE_ID="ru_RU-irina-medium";

  const MAX_MEMORY_CHARS=920;
  const MAX_MEMORY_ITEMS=6;
  const MEMORY_TTL=1000*60*60*24*7;

  let memoryState=loadJson(MEMORY_KEY,{threads:{}});
  let handsFree=readBool(HANDSFREE_KEY,false);
  let irinaEnabled=readBool(VOICE_KEY,true);

  let originalBrainChat=null;
  let originalSpeak=null;
  let originalStop=null;
  let chatWrapped=false;
  let speechWrapped=false;

  let speaking=false;
  let speakingRun=0;
  let handsFreeTimer=null;
  let lastReplyAt=0;

  let piperModule=null;
  let piperModulePromise=null;
  let piperSession=null;
  let piperReady=false;
  let piperPreparing=false;
  let piperAudioCtx=null;
  let piperSource=null;

  function loadJson(key,fallback){
    try{
      const value=JSON.parse(localStorage.getItem(key)||"null");
      return value&&typeof value==="object"?value:fallback;
    }catch{return fallback}
  }

  function saveJson(key,value){
    try{localStorage.setItem(key,JSON.stringify(value))}catch{}
  }

  function readBool(key,fallback){
    try{
      const raw=localStorage.getItem(key);
      return raw===null?fallback:raw==="1";
    }catch{return fallback}
  }

  function writeBool(key,value){
    try{localStorage.setItem(key,value?"1":"0")}catch{}
  }

  function clean(text){
    const div=document.createElement("div");
    div.innerHTML=String(text??"");
    return (div.textContent||"").replace(/\s+/g," ").trim();
  }

  function clip(text,max=260){
    const s=clean(text);
    return s.length<=max?s:s.slice(0,max-1)+"…";
  }

  function esc(text){
    return String(text??"").replace(/[&<>"']/g,ch=>({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
    }[ch]));
  }

  function dialogOpen(){
    return !!(
      document.querySelector("#v19Dialog")?.classList.contains("show") ||
      document.body.classList.contains("v19-dialog-open")
    );
  }

  function currentContextKey(ctx=null){
    if(ctx?.key)return String(ctx.key);
    if(ctx?.lessonId)return String(ctx.lessonId);

    try{
      if(typeof v16CurrentContext==="function"){
        const c=v16CurrentContext();
        if(c?.key)return String(c.key);
        if(c?.lessonId)return String(c.lessonId);
      }
    }catch{}

    const title=clean(document.querySelector("#pageTitle")?.textContent||"");
    const lessonVisible=!!document.querySelector(
      "#content .lesson-wrap,#content .lesson,#content .exercise[data-ex]"
    );
    if(lessonVisible&&title&&title!=="Алгебра 8")return "lesson:"+title.slice(0,80);

    return "free";
  }

  function contextLabel(ctx=null){
    if(ctx?.lesson?.title)return clip(ctx.lesson.title,100);
    const title=clean(document.querySelector("#pageTitle")?.textContent||"");
    if(title&&title!=="Алгебра 8")return clip(title,100);
    return "Свободный разговор";
  }

  function looksLikeTopicReset(text){
    return /(?:^|\s)(?:новая\s+тема|другая\s+тема|давай\s+(?:теперь|лучше)\s+(?:про|о)|перейд[её]м\s+к|поговорим\s+(?:теперь\s+)?(?:про|о)|забудь\s+предыдущее|начн[её]м\s+заново)/i.test(String(text||""));
  }

  function sensitive(text){
    const s=String(text||"");
    return !!(
      /https?:|www\./i.test(s) ||
      /[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.test(s) ||
      /(?:\+?\d[\d\s()\-]{8,}\d)/.test(s) ||
      /(?:меня\s+зовут|мо[йяё]\s+(?:имя|адрес|школ|телефон|пароль)|живу|фамили|паспорт|точн(?:ый|ое)\s+местополож)/i.test(s) ||
      /(?:мне|я)\s+\d{1,2}\s*(?:лет|года?)/i.test(s)
    );
  }

  function safeMemoryText(text){
    const s=clip(text,230);
    if(!s||sensitive(s))return "";
    return s
      .replace(/\b\d{6,}\b/g,"[число скрыто]")
      .replace(/\s+/g," ")
      .trim();
  }

  function prune(){
    const now=Date.now();
    for(const [key,thread] of Object.entries(memoryState.threads||{})){
      if(!thread||now-Number(thread.updatedAt||0)>MEMORY_TTL){
        delete memoryState.threads[key];
      }
    }
  }

  function threadFor(key,label=""){
    prune();
    const threads=memoryState.threads||(memoryState.threads={});
    if(!threads[key]){
      threads[key]={
        key,
        label:label||key,
        startedAt:Date.now(),
        updatedAt:Date.now(),
        turns:[]
      };
    }
    if(label)threads[key].label=label;
    threads[key].updatedAt=Date.now();
    return threads[key];
  }

  function resetThread(key,label=""){
    memoryState.threads[key]={
      key,
      label:label||key,
      startedAt:Date.now(),
      updatedAt:Date.now(),
      turns:[]
    };
    saveJson(MEMORY_KEY,memoryState);
  }

  function rememberPair(key,label,userText,assistantText){
    const thread=threadFor(key,label);
    const u=safeMemoryText(userText);
    const a=safeMemoryText(assistantText);
    if(!u&&!a)return;

    thread.turns.push({
      u,
      a,
      ts:Date.now()
    });
    thread.turns=thread.turns.slice(-MAX_MEMORY_ITEMS);
    thread.updatedAt=Date.now();
    saveJson(MEMORY_KEY,memoryState);
    updateMemoryChip();
  }

  function digestFor(key){
    const thread=memoryState.threads?.[key];
    if(!thread?.turns?.length)return "";

    const chunks=[];
    for(const turn of thread.turns.slice(-3)){
      if(turn.u)chunks.push("Ученик: "+turn.u);
      if(turn.a)chunks.push("Kitsune: "+turn.a);
    }

    const body=chunks.join("\n");
    return clip(body,MAX_MEMORY_CHARS);
  }

  function likelyExactMath(text){
    const s=String(text||"");
    return !!(
      window.KitsuneMath?.looksMath?.(s) ||
      /\d\s*[-+*/]\s*\d/.test(s) ||
      /[=<>≤≥√²^]/.test(s) ||
      /(?:^|\s)(?:реши|вычисли|посчитай|рассчитай)\b/i.test(s)
    );
  }

  function explicitTaskHelp(text,ctx){
    if(!ctx?.exercise)return false;
    return /(?:это\s+задани|этот\s+пример|в\s+этом\s+(?:задани|пример)|вот\s+здесь|почему\s+здесь|почему\s+тут|что\s+дальше|следующ(?:ий|его)\s+шаг|дай\s+подсказ|разбер(?:и|ём)\s+(?:это|задани|пример)|объясни\s+(?:это|задани|пример|шаг)|мой\s+ответ|проверь\s+(?:мой|этот)\s+шаг)/i.test(String(text||""));
  }

  function shouldUseMemory(text,ctx){
    if(!text||sensitive(text))return false;
    if(likelyExactMath(text))return false;
    if(explicitTaskHelp(text,ctx))return false;
    return true;
  }

  function augmentedMessage(text,ctx,key){
    if(!shouldUseMemory(text,ctx))return text;
    const digest=digestFor(key);
    if(!digest)return text;

    return [
      "Краткая память текущей беседы (используй только для понимания местоимений и продолжения той же темы; не повторяй её пользователю):",
      digest,
      "",
      "Текущий вопрос:",
      String(text)
    ].join("\n");
  }

  function wrapBrain(){
    const brain=window.KitsuneBrain;
    if(!brain?.chat)return false;
    if(brain.chat.__kitsuneV237Memory)return true;

    originalBrainChat=brain.chat.bind(brain);

    const wrapped=async function(text,ctx,prior){
      const key=currentContextKey(ctx);
      const label=contextLabel(ctx);

      if(looksLikeTopicReset(text)){
        resetThread(key,label);
      }

      const outgoing=augmentedMessage(text,ctx,key);
      const reply=await originalBrainChat(outgoing,ctx,prior);

      rememberPair(key,label,text,reply);
      lastReplyAt=Date.now();

      window.dispatchEvent(new CustomEvent("kitsune-conversation-turn",{
        detail:{
          version:VERSION,
          contextKey:key,
          label,
          hasMemory:!!digestFor(key),
          ts:Date.now()
        }
      }));

      return reply;
    };

    wrapped.__kitsuneV237Memory=true;
    brain.chat=wrapped;
    chatWrapped=true;
    return true;
  }

  async function loadPiper(){
    if(piperModule)return piperModule;
    if(piperModulePromise)return piperModulePromise;

    piperModulePromise=(async()=>{
      piperModule=await import(PIPER_PACKAGE);
      return piperModule;
    })();

    try{return await piperModulePromise}
    catch(error){
      piperModulePromise=null;
      throw error;
    }
  }

  function piperSessionFor(tts){
    if(piperSession)return piperSession;
    if(typeof tts?.TtsSession==="function"){
      try{
        piperSession=new tts.TtsSession({
          voiceId:IRINA_VOICE_ID,
          allowLocalModels:true,
          fallbackStrategy:"auto",
          logger:message=>{
            try{console.debug("[Kitsune Irina]",message)}catch{}
          }
        });
      }catch{
        piperSession=null;
      }
    }
    return piperSession;
  }

  async function piperPredict(tts,text){
    const session=piperSessionFor(tts);
    if(session&&typeof session.predict==="function"){
      return session.predict(text);
    }
    return tts.predict({text,voiceId:IRINA_VOICE_ID});
  }

  async function checkIrinaStored(){
    try{
      const tts=await loadPiper();
      if(typeof tts.stored!=="function")return piperReady;
      const list=await tts.stored();
      piperReady=Array.isArray(list)&&list.includes(IRINA_VOICE_ID);
      return piperReady;
    }catch{
      return false;
    }
  }

  async function unlockAudio(){
    const AC=window.AudioContext||window.webkitAudioContext;
    if(!AC)return false;
    if(!piperAudioCtx||piperAudioCtx.state==="closed")piperAudioCtx=new AC();
    if(piperAudioCtx.state==="suspended"){
      try{await piperAudioCtx.resume()}catch{}
    }
    return piperAudioCtx.state==="running";
  }

  async function prepareIrina(){
    if(piperPreparing)return false;
    piperPreparing=true;
    setVoiceStatus("Подготавливаю локальный голос Irina…","thinking");

    try{
      await unlockAudio();
      const tts=await loadPiper();

      if(await checkIrinaStored()){
        setVoiceStatus("✅ Irina уже сохранена на устройстве.","ok");
        updateControls();
        return true;
      }

      if(typeof tts.download!=="function"){
        throw new Error("Piper runtime не поддерживает download().");
      }

      await tts.download(IRINA_VOICE_ID,progress=>{
        const total=Number(progress?.total)||0;
        const loaded=Number(progress?.loaded)||0;
        const pct=total>0?Math.round(loaded/total*100):0;
        setVoiceStatus(`⬇ Irina: ${pct||"…"}%`,"thinking");
      });

      piperReady=await checkIrinaStored();
      if(!piperReady)throw new Error("Модель Irina не появилась в локальном хранилище.");

      setVoiceStatus("✅ Локальный голос Irina готов.","ok");
      updateControls();
      return true;
    }catch(error){
      setVoiceStatus(
        "Irina пока недоступна — останется текущий локальный/системный голос. "+
        String(error?.message||error).slice(0,110),
        "warn"
      );
      return false;
    }finally{
      piperPreparing=false;
      updateControls();
    }
  }

  function stopIrina(){
    speakingRun++;
    speaking=false;
    try{piperSource?.stop()}catch{}
    try{piperSource?.disconnect()}catch{}
    piperSource=null;
  }

  async function playIrina(blob,onDone=null,runId=0){
    if(!(blob instanceof Blob))throw new Error("Piper не вернул аудио.");
    const ok=await unlockAudio();
    if(!ok)throw new Error("Воспроизведение заблокировано браузером.");

    const buffer=await piperAudioCtx.decodeAudioData((await blob.arrayBuffer()).slice(0));
    if(runId!==speakingRun)return false;

    const source=piperAudioCtx.createBufferSource();
    piperSource=source;
    source.buffer=buffer;

    const gain=piperAudioCtx.createGain();
    gain.gain.value=.98;

    const analyser=piperAudioCtx.createAnalyser();
    analyser.fftSize=512;
    analyser.smoothingTimeConstant=.58;

    source.connect(gain);
    gain.connect(analyser);
    analyser.connect(piperAudioCtx.destination);

    try{window.KitsuneLive?.attachAnalyser?.(analyser)}catch{}
    try{window.v161MarkSpeaking?.(true,"explain")}catch{}

    speaking=true;
    source.onended=()=>{
      if(piperSource===source)piperSource=null;
      speaking=false;
      try{window.KitsuneLive?.detachAnalyser?.()}catch{}
      try{window.v161MarkSpeaking?.(false,"explain")}catch{}
      onDone?.();
    };
    source.start();
    return true;
  }

  async function speakIrina(text,opts={}){
    const runId=++speakingRun;
    const phrase=clean(text);
    if(!phrase)return false;

    const tts=await loadPiper();
    if(!(await checkIrinaStored()))throw new Error("irina_not_ready");
    const wav=await piperPredict(tts,phrase);
    if(runId!==speakingRun)return false;
    return playIrina(wav,opts.onDone,runId);
  }

  function scheduleHandsFree(){
    clearTimeout(handsFreeTimer);
    if(!handsFree||!dialogOpen()||document.hidden)return;

    handsFreeTimer=setTimeout(async()=>{
      if(!handsFree||!dialogOpen()||speaking||document.hidden)return;

      try{
        const api=window.KitsuneVoiceDialogue;
        if(!api?.start)return;
        const status=api.status?.()||{};
        if(!status.cachedMarker&&!status.runtimeReady){
          setVoiceStatus("Для hands-free сначала подготовь Whisper.","warn");
          return;
        }
        setVoiceStatus("👂 Слушаю следующий вопрос…","listening");
        await api.start();
      }catch(error){
        setVoiceStatus("Не удалось снова включить микрофон: "+String(error?.message||error).slice(0,100),"warn");
      }
    },650);
  }

  function stopAllSpeech(){
    stopIrina();
    try{originalStop?.()}catch{}
    try{window.speechSynthesis?.cancel?.()}catch{}
  }

  function wrapSpeech(){
    if(speechWrapped)return true;
    if(typeof window.v151Speak!=="function")return false;

    originalSpeak=window.v151Speak.bind(window);
    originalStop=typeof window.v161StopSpeech==="function"
      ?window.v161StopSpeech.bind(window)
      :null;

    window.v151Speak=function(text,opts={}){
      const userDone=typeof opts?.onDone==="function"?opts.onDone:null;
      const finish=()=>{
        speaking=false;
        try{userDone?.()}catch{}
        scheduleHandsFree();
      };

      if(irinaEnabled){
        speaking=true;
        speakIrina(text,{...opts,onDone:finish})
          .then(ok=>{
            if(ok!==false)return;
            speaking=false;
            originalSpeak(text,{...opts,onDone:finish});
          })
          .catch(()=>{
            speaking=false;
            originalSpeak(text,{...opts,onDone:finish});
          });
        return true;
      }

      speaking=true;
      return originalSpeak(text,{...opts,onDone:finish});
    };

    window.v161StopSpeech=function(){
      stopAllSpeech();
      return true;
    };

    speechWrapped=true;
    return true;
  }

  function setVoiceStatus(text,kind=""){
    const live=document.querySelector("#v19DialogLive");
    if(live&&dialogOpen()){
      live.textContent=text||"";
      live.className=`v19-dialog-live ${kind}`.trim();
    }
    const el=document.querySelector("#v237VoiceStatus");
    if(el){
      el.textContent=text||"";
      el.dataset.kind=kind;
    }
  }

  function updateMemoryChip(){
    const chip=document.querySelector("#v237MemoryChip");
    if(!chip)return;
    const key=currentContextKey();
    const thread=memoryState.threads?.[key];
    const count=thread?.turns?.length||0;
    chip.textContent=count?`🧠 Тема: ${count} ${count===1?"шаг":"шагов"}`:"🧠 Новая тема";
  }

  function updateControls(){
    const hf=document.querySelector("#v237HandsFree");
    if(hf)hf.checked=handsFree;
    const irina=document.querySelector("#v237Irina");
    if(irina)irina.checked=irinaEnabled;

    const prepare=document.querySelector("#v237PrepareIrina");
    if(prepare){
      prepare.disabled=piperPreparing;
      prepare.textContent=piperReady
        ?"✅ Irina готова"
        :piperPreparing
          ?"⏳ Подготовка Irina…"
          :"⬇ Подготовить Irina";
    }

    updateMemoryChip();
  }

  function injectDialogControls(){
    const card=document.querySelector("#v19Dialog .v19-dialog-card");
    if(!card||document.querySelector("#v237ConversationBar"))return;

    const compose=card.querySelector(".v19-dialog-compose");
    if(!compose)return;

    const bar=document.createElement("div");
    bar.id="v237ConversationBar";
    bar.style.cssText="display:flex;flex-wrap:wrap;gap:7px;align-items:center;padding:8px 12px;border-top:1px solid var(--line);font-size:11px";
    bar.innerHTML=`
      <label style="display:flex;gap:5px;align-items:center;cursor:pointer">
        <input id="v237HandsFree" type="checkbox">
        <span>🎧 Разговор без рук</span>
      </label>
      <label style="display:flex;gap:5px;align-items:center;cursor:pointer">
        <input id="v237Irina" type="checkbox">
        <span>🔊 Irina</span>
      </label>
      <button id="v237NewTopic" type="button" class="secondary" style="padding:5px 8px">Новая тема</button>
      <span id="v237MemoryChip" style="margin-left:auto;opacity:.75">🧠 Новая тема</span>
    `;

    compose.parentNode.insertBefore(bar,compose);

    bar.querySelector("#v237HandsFree")?.addEventListener("change",async event=>{
      handsFree=!!event.target.checked;
      writeBool(HANDSFREE_KEY,handsFree);
      await unlockAudio();
      if(handsFree&&!speaking)scheduleHandsFree();
      else clearTimeout(handsFreeTimer);
    });

    bar.querySelector("#v237Irina")?.addEventListener("change",async event=>{
      irinaEnabled=!!event.target.checked;
      writeBool(VOICE_KEY,irinaEnabled);
      await unlockAudio();
      if(irinaEnabled&&!piperReady)checkIrinaStored().then(updateControls);
    });

    bar.querySelector("#v237NewTopic")?.addEventListener("click",()=>{
      const key=currentContextKey();
      resetThread(key,contextLabel());
      updateMemoryChip();
      setVoiceStatus("🧠 Начали новую тему. Предыдущий контекст больше не используется.","ok");
    });

    updateControls();
  }

  function injectSettings(){
    const host=document.querySelector("#v19VoiceSettings")||document.querySelector("#v18KitsuneBrain")||document.querySelector("#v15Settings");
    if(!host||document.querySelector("#v237LiveVoiceSettings"))return;

    const block=document.createElement("div");
    block.id="v237LiveVoiceSettings";
    block.className="v19-voice-settings";
    block.innerHTML=`
      <div class="v19-voice-head">
        <div>
          <strong>🦊 Живой голосовой диалог</strong>
          <small>Whisper → тематическая память → Kitsune → Piper Irina</small>
        </div>
        <span>v${VERSION}</span>
      </div>
      <p>Полная история остаётся на устройстве. Для обычного облачного диалога может отправляться только короткая безопасная выдержка из последних реплик, чтобы Kitsune понимала «а почему?» и «а если так?».</p>
      <div id="v237VoiceStatus" style="margin:8px 0;font-size:11px">Проверяю локальный голос Irina…</div>
      <button type="button" class="v15-action primary-action" id="v237PrepareIrina">⬇ Подготовить Irina</button>
    `;
    host.appendChild(block);

    block.querySelector("#v237PrepareIrina")?.addEventListener("click",async()=>{
      await unlockAudio();
      await prepareIrina();
    });

    checkIrinaStored().then(ready=>{
      if(ready)setVoiceStatus("✅ Irina уже сохранена на устройстве.","ok");
      else setVoiceStatus("Irina ещё не подготовлена. До этого работает текущий голосовой fallback.","");
      updateControls();
    });
  }

  function installInterruptHandler(){
    document.addEventListener("pointerdown",event=>{
      const mic=event.target.closest?.(".v19-mic-btn");
      if(!mic||!dialogOpen())return;
      if(speaking){
        stopAllSpeech();
        clearTimeout(handsFreeTimer);
        setVoiceStatus("🎙️ Я замолчала. Слушаю тебя…","listening");
      }
      unlockAudio().catch(()=>{});
    },true);
  }

  function observeDialog(){
    const observer=new MutationObserver(()=>{
      injectDialogControls();
      injectSettings();
      wrapBrain();
      wrapSpeech();

      if(!dialogOpen()){
        clearTimeout(handsFreeTimer);
        if(speaking)stopAllSpeech();
      }
    });
    observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:["class"]});
  }

  function initialMemoryFromHistory(){
    /* v2.3.7 deliberately does NOT copy the whole old history into thematic
       memory. A thread starts from fresh turns after the upgrade. */
    try{
      const old=JSON.parse(localStorage.getItem(HISTORY_KEY)||"[]");
      if(Array.isArray(old)&&old.length){
        window.dispatchEvent(new CustomEvent("kitsune-topic-memory-ready",{
          detail:{version:VERSION,oldHistoryKeptLocally:true}
        }));
      }
    }catch{}
  }

  async function release(){
    clearTimeout(handsFreeTimer);
    stopAllSpeech();
    piperSession=null;
    piperModule=null;
    piperModulePromise=null;
    try{
      if(piperAudioCtx&&piperAudioCtx.state!=="closed")await piperAudioCtx.close();
    }catch{}
    piperAudioCtx=null;
    piperReady=false;
    return true;
  }

  window.KitsuneLiveConversation={
    version:VERSION,
    voiceId:IRINA_VOICE_ID,
    prepareIrina,
    memory:()=>JSON.parse(JSON.stringify(memoryState)),
    resetTopic:()=>{
      resetThread(currentContextKey(),contextLabel());
      updateMemoryChip();
    },
    handsFree:enabled=>{
      if(typeof enabled==="boolean"){
        handsFree=enabled;
        writeBool(HANDSFREE_KEY,handsFree);
        updateControls();
      }
      return handsFree;
    },
    irina:enabled=>{
      if(typeof enabled==="boolean"){
        irinaEnabled=enabled;
        writeBool(VOICE_KEY,irinaEnabled);
        updateControls();
      }
      return {enabled:irinaEnabled,ready:piperReady};
    },
    speaking:()=>speaking,
    release
  };

  initialMemoryFromHistory();
  installInterruptHandler();
  observeDialog();

  const install=()=>{
    injectDialogControls();
    injectSettings();
    wrapBrain();
    wrapSpeech();
    checkIrinaStored().then(updateControls);
  };

  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",install,{once:true});
  }else{
    install();
  }

  /* Local Voice Lab and Router may initialize a moment later on slower phones. */
  let attempts=0;
  const timer=setInterval(()=>{
    attempts++;
    install();
    if((chatWrapped&&speechWrapped)||attempts>=30)clearInterval(timer);
  },250);
})();
