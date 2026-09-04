
/* =====================================================================
   Kitsune Zero-Config Setup v2.1.0
   One-time background preparation of optional AI/OCR modules.
   No settings work is required from the child.
   ===================================================================== */
(() => {
  "use strict";

  const VERSION=window.KITSUNE_APP_VERSION||"2.1.0";
  const KEY="a8_zero_config_setup_v210";
  const AUTO_KEY="a8_zero_config_enabled_v210";
  const RETRY_MS=300_000;

  let running=false;
  let retryTimer=null;
  let sessionAttempts=0;
  let ui=null;
  let state={
    version:VERSION,
    started:0,finished:0,
    brain:"pending",whisper:"pending",voice:"pending",ocr:"pending",
    persistent:null,lastError:""
  };

  try{
    const saved=JSON.parse(localStorage.getItem(KEY)||"null");
    if(saved&&typeof saved==="object")state={...state,...saved};
  }catch(e){}

  function save(){
    try{localStorage.setItem(KEY,JSON.stringify(state))}catch(e){}
  }
  function enabled(){
    try{return localStorage.getItem(AUTO_KEY)!=="0"}catch(e){return true}
  }
  function done(){
    return ["ready","unsupported"].includes(state.brain) &&
      state.whisper==="ready" && ["ready","fallback"].includes(state.voice) &&
      state.ocr==="ready";
  }
  function standalone(){
    return !!(window.matchMedia?.("(display-mode: standalone)")?.matches||navigator.standalone);
  }
  function connectionAllows(){
    const c=navigator.connection||navigator.mozConnection||navigator.webkitConnection;
    if(c?.saveData)return false;
    return true;
  }
  async function freeStorage(){
    try{
      const e=await navigator.storage?.estimate?.();
      if(!e?.quota)return null;
      return Math.max(0,Number(e.quota||0)-Number(e.usage||0));
    }catch(e){return null}
  }
  function ensureUi(){
    if(ui)return ui;
    document.body.insertAdjacentHTML("beforeend",`
      <aside class="ksetup" id="ksetup" aria-live="polite">
        <span class="ksetup-icon">🦊</span>
        <div><b id="ksetupTitle">Kitsune готовит устройство</b><small id="ksetupText">Можно продолжать пользоваться курсом.</small></div>
        <button id="ksetupHide" aria-label="Скрыть">×</button>
      </aside>
    `);
    ui=document.querySelector("#ksetup");
    document.querySelector("#ksetupHide")?.addEventListener("click",()=>ui?.classList.remove("show"));
    return ui;
  }
  function status(title,text,kind=""){
    ensureUi();
    const a=document.querySelector("#ksetupTitle"),b=document.querySelector("#ksetupText");
    if(a)a.textContent=title;
    if(b)b.textContent=text;
    ui.className=`ksetup show ${kind}`.trim();
  }
  function hideLater(ms=3500){setTimeout(()=>ui?.classList.remove("show"),ms)}

  async function persist(){
    try{
      if(navigator.storage?.persist){
        state.persistent=await navigator.storage.persist();
        save();
      }
    }catch(e){}
  }

  async function prepBrain(){
    if(state.brain==="ready"||state.brain==="unsupported")return;
    const api=window.KitsuneBrain;
    if(!api){state.brain="unsupported";save();return}
    try{
      status("Подготовка 1/4","Локальный Brain — один раз скачиваю модель и сохраняю её в кэше.");
      let cached=false;
      try{cached=!!(await api.checkCached?.())}catch(e){}
      if(!cached){
        const free=await freeStorage();
        /* Brain is the heaviest optional component. If the browser reports
           very little free quota, keep Smart Tutor instead of creating a
           broken half-download. It will retry automatically on a later launch. */
        if(free!==null&&free<550*1024*1024){
          state.brain="deferred";
          state.lastError="Недостаточно свободного browser storage для Brain";
          save();
          return;
        }
        await api.prepare?.();
        try{cached=!!(await api.checkCached?.())}catch(e){cached=!!api.isReady?.()}
      }
      if(cached||api.isReady?.())state.brain="ready";
      else if(api.mode?.()!=="brain")state.brain="unsupported";
      else state.brain="deferred";
      save();
      await api.release?.();
    }catch(e){
      /* WebGPU/device incompatibility is a valid graceful outcome:
         deterministic Smart Tutor remains available. */
      state.brain=api.mode?.()==="smart"?"unsupported":"deferred";
      state.lastError=String(e?.message||e).slice(0,180);save();
      try{await api.release?.()}catch(x){}
    }
  }

  async function prepWhisper(){
    if(state.whisper==="ready")return;
    const api=window.KitsuneVoiceDialogue;
    if(!api){state.whisper="deferred";save();return}
    try{
      status("Подготовка 2/4","Скачиваю Whisper для голосового ввода. Микрофон сейчас не включается.");
      const s=api.status?.()||{};
      if(!s.cachedMarker&&!api.isReady?.())await api.prepare?.();
      state.whisper=(api.status?.()?.cachedMarker||api.isReady?.())?"ready":"deferred";
      save();
      await api.release?.();
    }catch(e){
      state.whisper="deferred";state.lastError=String(e?.message||e).slice(0,180);save();
      try{await api.release?.()}catch(x){}
    }
  }

  async function prepVoice(){
    if(["ready","fallback"].includes(state.voice))return;
    const api=window.AlfiNeuralVoice;
    if(!api){state.voice="fallback";save();return}
    try{
      status("Подготовка 3/4","Подготавливаю голос Kitsune. Если Neural Voice несовместим, останется системный голос.");
      let ok=false;
      try{ok=!!(await api.verify?.())}catch(e){ok=!!api.isReady?.()}
      if(!ok)await api.download?.();
      try{ok=!!(await api.verify?.())}catch(e){ok=!!api.isReady?.()}
      state.voice=ok?"ready":"fallback";save();
      await api.release?.();
    }catch(e){
      /* If the model exists but the runtime cannot execute on this device,
         system TTS is the permanent zero-config fallback. If even the model
         was not downloaded (for example a network failure), retry later. */
      state.voice=api.isReady?.()?"fallback":"deferred";
      state.lastError=String(e?.message||e).slice(0,180);save();
      try{await api.release?.()}catch(x){}
    }
  }

  async function prepOCR(){
    if(state.ocr==="ready")return;
    const api=window.KitsuneCameraImport;
    if(!api){state.ocr="deferred";save();return}
    try{
      status("Подготовка 4/4","Подготавливаю локальное распознавание фото учебника. Камера не включается.");
      const ok=api.isPrepared?.()||await api.prepareOCR?.({keepWorker:false,silent:true});
      state.ocr=ok?"ready":"deferred";save();
    }catch(e){
      state.ocr="deferred";state.lastError=String(e?.message||e).slice(0,180);save();
    }
  }

  async function run({manual=false}={}){
    if(running||!enabled())return false;
    if(location.protocol==="file:"||!window.isSecureContext)return false;
    if(!navigator.onLine){
      scheduleRetry();
      return false;
    }
    if(!connectionAllows()&&!manual){
      scheduleRetry();
      return false;
    }

    running=true;
    sessionAttempts++;
    state.started=state.started||Date.now();
    save();
    await persist();

    try{
      await prepBrain();
      await prepWhisper();
      await prepVoice();
      await prepOCR();

      state.finished=done()?Date.now():0;
      save();

      if(done()){
        status("✅ Kitsune полностью подготовлена","Brain/Smart Tutor, голос, Whisper и импорт с камеры готовы. Ребёнку ничего устанавливать не нужно.","ok");
        hideLater(5000);
      }else{
        status("Kitsune подготовила всё доступное","Недоступные компоненты будут автоматически проверены ещё раз позже; курс уже работает.","warn");
        hideLater(5000);
        scheduleRetry();
      }
    }finally{running=false}
    return done();
  }

  function scheduleRetry(){
    if(sessionAttempts>=2)return;
    clearTimeout(retryTimer);
    retryTimer=setTimeout(()=>run().catch(()=>{}),RETRY_MS);
  }

  function reset(){
    state={version:VERSION,started:0,finished:0,brain:"pending",whisper:"pending",voice:"pending",ocr:"pending",persistent:null,lastError:""};
    save();return run({manual:true});
  }

  function schedule(){
    if(!enabled()||done())return;
    const start=()=>setTimeout(()=>run().catch(()=>{}),standalone()?2200:4500);
    if(document.readyState==="complete")start();
    else window.addEventListener("load",start,{once:true});
  }

  window.addEventListener("online",()=>{sessionAttempts=0;if(!done())setTimeout(()=>run().catch(()=>{}),1500)});
  try{navigator.connection?.addEventListener?.("change",()=>{if(connectionAllows()){sessionAttempts=0;if(!done())setTimeout(()=>run().catch(()=>{}),1800)}})}catch(e){}
  window.addEventListener("kitsune-pwa-updated",()=>{if(!done())setTimeout(()=>run().catch(()=>{}),1800)});

  window.KitsuneZeroConfig={
    version:VERSION,
    run,
    reset,
    state:()=>({...state}),
    isDone:done,
    enabled,
    setEnabled(v){
      try{localStorage.setItem(AUTO_KEY,v?"1":"0")}catch(e){}
      if(v)schedule();
    }
  };

  schedule();
})();
