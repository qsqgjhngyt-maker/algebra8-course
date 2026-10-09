/* =====================================================================
   Kitsune v2.3.0-beta.3.7.2 · LIVE VOICE DIALOG · SEPARATE CONVERSATION CONTEXT

   Goals
   - local Whisper remains the microphone/STT authority;
   - compact thematic memory keeps follow-up questions on one topic;
   - only a small, privacy-filtered memory digest may accompany ordinary
     Cloud Brain conversation; raw audio and full chat history never do;
   - replies use the single Kitsune Voice Engine;
   - hands-free loop: listen -> recognize -> answer -> speak -> listen;
   - mic can interrupt speech;
   - lesson/dialog context remains protected by the final navigation firewall.
   ===================================================================== */
(() => {
  "use strict";

  const VERSION="2.3.0-beta.3.7.2";
  const MEMORY_KEY="a8_kitsune_topic_memory_v237";
  const HANDSFREE_KEY="a8_kitsune_handsfree_v237";
  const HISTORY_KEY="a8_kitsune_dialog_history_v19";


  const MAX_MEMORY_CHARS=920;
  const MAX_MEMORY_ITEMS=6;
  const MEMORY_TTL=1000*60*60*24*7;

  let memoryState=loadJson(MEMORY_KEY,{threads:{}});
  let handsFree=readBool(HANDSFREE_KEY,false);

  let originalBrainChat=null;
  let originalSpeak=null;
  let originalStop=null;
  let chatWrapped=false;
  let speechWrapped=false;

  let speaking=false;
  let speechInDialog=false;
  let speakingRun=0;
  let handsFreeTimer=null;
  let lastReplyAt=0;


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
      if(turn.a)chunks.push("Ассистент: "+turn.a);
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

  function conversationContextFor(text,ctx,key){
    if(!shouldUseMemory(text,ctx))return "";
    return digestFor(key);
  }

  /*
   * beta.3.7.1:
   * The real user message MUST reach KitsuneRouter unchanged.
   * Router first performs Safety / Math / Tutor / Cloud classification.
   * Only if that already-selected route actually calls Cloud Brain do we
   * replace the outgoing Cloud payload with the compact topic digest.
   *
   * This prevents words from previous turns ("Kitsune", "привет", "реши",
   * equations, etc.) from influencing the classifier for the new question.
   */
  async function withPostRouteCloudMemory(text,ctx,key,callback){
    const infra=window.KitsuneHybridInfrastructure;
    const previous=infra?.cloudRequest;

    if(
      !infra ||
      typeof previous!=="function" ||
      !shouldUseMemory(text,ctx) ||
      !digestFor(key)
    ){
      return callback();
    }

    const conversationContext=conversationContextFor(text,ctx,key);
    let intercepted=false;

    const bridge=function(kind,payload,options){
      /*
       * Router has ALREADY selected Cloud at this point.
       * Keep the original current-user message untouched and pass thematic
       * memory as a separate signed field.
       */
      if(!intercepted&&kind==="chat"&&conversationContext){
        intercepted=true;
        return previous.call(infra,kind,{
          message:String(payload),
          conversationContext
        },options);
      }
      return previous.call(infra,kind,payload,options);
    };

    infra.cloudRequest=bridge;
    try{
      return await callback();
    }finally{
      /* Do not overwrite a newer wrapper installed by another module. */
      if(infra.cloudRequest===bridge){
        infra.cloudRequest=previous;
      }
    }
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

      /*
       * IMPORTANT: pass `text` unchanged into Router/local Brain.
       * Topic memory is injected only inside cloudRequest, after the Router
       * has already classified the current message.
       */
      const reply=await withPostRouteCloudMemory(
        text,
        ctx,
        key,
        ()=>originalBrainChat(text,ctx,prior)
      );

      rememberPair(key,label,text,reply);
      lastReplyAt=Date.now();

      window.dispatchEvent(new CustomEvent("kitsune-conversation-turn",{
        detail:{
          version:VERSION,
          contextKey:key,
          label,
          hasMemory:!!digestFor(key),
          memoryAppliedAfterRoute:true,
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

  async function unlockAudio(){
    return window.KitsuneStaticVoice?.unlock?.() || false;
  }
  function stopIrina(){
    speakingRun++;
    speaking=false;
    speechInDialog=false;
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
    try{
      if(originalStop)originalStop();
      else{window.KitsuneStaticVoice?.stop();window.KitsuneDynamicVoice?.stop();}
    }catch{}
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
      const inDialog=dialogOpen();
      let run=null,finished=false,accepted=false,returned=false,failed=false;
      const finish=()=>{
        if(finished||(run!==null&&run!==speakingRun))return;
        finished=true;
        speaking=false;
        speechInDialog=false;
        try{userDone?.()}catch{}
        if(returned&&accepted&&!failed&&inDialog)scheduleHandsFree();
      };
      const failure=message=>{
        if(finished||(run!==null&&run!==speakingRun))return;
        failed=true;
        try{opts.onError?.(message);}catch{}
      };

      speaking=true;
      accepted=originalSpeak(text,{...opts,onDone:finish,onError:failure});
      run=speakingRun;
      returned=true;
      speaking=!!accepted&&!finished;
      speechInDialog=speaking&&inDialog;
      if(finished&&accepted&&!failed&&inDialog)scheduleHandsFree();
      return accepted;
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

    bar.querySelector("#v237NewTopic")?.addEventListener("click",()=>{
      const key=currentContextKey();
      resetThread(key,contextLabel());
      updateMemoryChip();
      setVoiceStatus("🧠 Начали новую тему. Предыдущий контекст больше не используется.","ok");
    });

    updateControls();
  }

  function injectSettings(){}

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
    let wasOpen=dialogOpen();
    const observer=new MutationObserver(()=>{
      injectDialogControls();
      injectSettings();
      wrapBrain();
      wrapSpeech();

      const nowOpen=dialogOpen();
      if(wasOpen&&!nowOpen){
        clearTimeout(handsFreeTimer);
        if(speaking&&speechInDialog)stopAllSpeech();
      }
      wasOpen=nowOpen;
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
    return true;
  }

  window.KitsuneLiveConversation={
    version:VERSION,
    voiceId:"kitsune-qwen-v05",
    memory:()=>JSON.parse(JSON.stringify(memoryState)),
    routingFix:()=>({
      version:VERSION,
      mode:"post-route-separate-cloud-context",
      classifierReceivesRawUserText:true,
      cloudMemoryMaxChars:MAX_MEMORY_CHARS,
      transport:"conversationContext"
    }),
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
    updateControls();
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
