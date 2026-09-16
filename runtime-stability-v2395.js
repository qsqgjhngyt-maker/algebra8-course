/* =====================================================================
   Kitsune Runtime Stability v2.3.0-beta.3.9.5

   Consolidated mobile/low-memory guard:
   - prevents automatic heavy AI preparation on constrained devices;
   - keeps automatic speech off on iPhone / very weak devices, while manual
     speech and the full voice dialogue remain available by explicit action;
   - stops the Smart Tutor relabel MutationObserver from self-triggering;
   - makes lazy buttons work on the first press;
   - adds clear Math Lab validation instead of silent no-op buttons.
   ===================================================================== */
(() => {
  "use strict";

  const VERSION="2.3.0-beta.3.9.5";
  const ZERO_CONFIG_KEY="a8_zero_config_enabled_v210";
  const AUTO_SPEAK_KEY="a8_alfi_voice_auto";
  const REPLAY_KEY="kitsuneStabilityReplay2395";

  function isIOS(){
    const ua=String(navigator.userAgent||"");
    const platform=String(navigator.platform||"");
    return /iPhone|iPad|iPod/i.test(ua) ||
      (platform==="MacIntel"&&Number(navigator.maxTouchPoints)>1);
  }

  function fallbackProfile(){
    const mem=Number(navigator.deviceMemory||0);
    const cpu=Number(navigator.hardwareConcurrency||0);
    if(isIOS())return "careful";
    if((mem&&mem<=4)||(cpu&&cpu<=4))return "careful";
    if((mem&&mem<=8)||(cpu&&cpu<=6))return "balanced";
    return "full";
  }

  function policy(){
    let profile="";
    try{profile=window.KitsunePerformance?.info?.()?.profile||""}catch{}
    if(!profile)profile=fallbackProfile();
    const constrained=profile!=="full";
    const ttsConstrained=isIOS()||profile==="careful"||profile==="emergency";
    return {profile,constrained,ttsConstrained,ios:isIOS()};
  }

  const initialPolicy=policy();

  /* Critical: these keys are read synchronously by modules that load later. */
  if(initialPolicy.constrained){
    try{localStorage.setItem(ZERO_CONFIG_KEY,"0")}catch{}
  }
  if(initialPolicy.ttsConstrained){
    try{localStorage.setItem(AUTO_SPEAK_KEY,"0")}catch{}
  }

  function injectStyles(){
    if(document.querySelector("#kitsuneStability2395Style"))return;
    const style=document.createElement("style");
    style.id="kitsuneStability2395Style";
    style.textContent=`
      .kitsune-runtime-loading{opacity:.72!important;cursor:progress!important;filter:saturate(.88)}
      .kitsune-runtime-loading::after{content:"";display:inline-block;width:.8em;height:.8em;margin-left:.45em;border:2px solid currentColor;border-right-color:transparent;border-radius:50%;vertical-align:-.08em;animation:kitsuneSpin2395 .75s linear infinite}
      @keyframes kitsuneSpin2395{to{transform:rotate(360deg)}}
      .kitsune-runtime-toast2395{position:fixed;left:50%;bottom:max(18px,env(safe-area-inset-bottom));transform:translateX(-50%);z-index:100000;max-width:min(92vw,560px);padding:11px 15px;border-radius:15px;background:rgba(24,30,28,.92);color:white;font:600 14px/1.35 system-ui,-apple-system,sans-serif;box-shadow:0 12px 34px rgba(0,0,0,.25);pointer-events:none;opacity:0;transition:opacity .18s ease,transform .18s ease}
      .kitsune-runtime-toast2395.show{opacity:1;transform:translateX(-50%) translateY(-4px)}
      .kitsune-auto-voice-note2395{display:block;margin-top:5px;font-size:11px;line-height:1.35;opacity:.72}
    `;
    document.head.appendChild(style);
  }

  let toastTimer=null;
  function toast(message){
    injectStyles();
    let el=document.querySelector("#kitsuneRuntimeToast2395");
    if(!el){
      el=document.createElement("div");
      el.id="kitsuneRuntimeToast2395";
      el.className="kitsune-runtime-toast2395";
      el.setAttribute("role","status");
      document.body.appendChild(el);
    }
    el.textContent=String(message||"");
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer=setTimeout(()=>el.classList.remove("show"),3200);
  }

  /* ------------------------------------------------------------------
     Smart Tutor relabel loop fix.

     tutor-smart-v173 observes #content and relabels every .v16-tutor-btn by
     assigning innerHTML. Assigning the same innerHTML creates a childList
     mutation, which schedules relabel again. On WebKit this can become a
     permanent 30 ms DOM loop. We do not replace Tutor: we make duplicate
     innerHTML writes on those exact buttons idempotent before Tutor loads.
     ------------------------------------------------------------------ */
  const innerDesc=Object.getOwnPropertyDescriptor(Element.prototype,"innerHTML");
  let suppressedTutorWrites=0;

  function stabilizeTutorButton(button){
    if(!button||button.__kitsuneStableHtml2395||!innerDesc?.get||!innerDesc?.set)return;
    try{
      Object.defineProperty(button,"innerHTML",{
        configurable:true,
        enumerable:innerDesc.enumerable,
        get(){return innerDesc.get.call(this)},
        set(value){
          const next=String(value??"");
          let current="";
          try{current=innerDesc.get.call(this)}catch{}
          if(current===next){suppressedTutorWrites++;return}
          return innerDesc.set.call(this,next);
        }
      });
      button.__kitsuneStableHtml2395=true;
    }catch{}
  }

  function scanTutorButtons(root=document){
    if(root?.matches?.(".v16-tutor-btn"))stabilizeTutorButton(root);
    root?.querySelectorAll?.(".v16-tutor-btn")?.forEach(stabilizeTutorButton);
  }

  function installTutorGuard(){
    const content=document.querySelector("#content");
    if(!content||content.__kitsuneTutorGuard2395)return false;
    content.__kitsuneTutorGuard2395=true;
    scanTutorButtons(content);
    const observer=new MutationObserver(records=>{
      for(const record of records){
        for(const node of record.addedNodes){
          if(node?.nodeType===1)scanTutorButtons(node);
        }
      }
    });
    observer.observe(content,{childList:true,subtree:true});
    return true;
  }

  /* ------------------------------------------------------------------
     Low-memory voice policy.
     Auto narration is the feature the real iPhone test identified as the
     remaining crash trigger. Manual speaker/voice dialogue are untouched.
     ------------------------------------------------------------------ */
  function applyAutoVoicePolicy(){
    const p=policy();
    if(!p.ttsConstrained)return;
    try{localStorage.setItem(AUTO_SPEAK_KEY,"0")}catch{}
    const checkbox=document.querySelector("#v151AutoVoice");
    if(!checkbox)return;
    checkbox.checked=false;
    checkbox.disabled=true;
    checkbox.title="На этом устройстве автоозвучка отключена для стабильности. Ручная кнопка озвучки работает.";
    const host=checkbox.closest("label")||checkbox.parentElement;
    if(host&&!host.querySelector(".kitsune-auto-voice-note2395")){
      const note=document.createElement("small");
      note.className="kitsune-auto-voice-note2395";
      note.textContent="На этом устройстве автоозвучка отключена для стабильности. Ручная 🔊 озвучка и голосовой диалог доступны.";
      host.appendChild(note);
    }
  }

  /* AutoSetup stays fully available manually. Only background preparation is
     blocked on constrained devices. Original reset()/run() need enabled()==1,
     so manual operations temporarily enable the legacy key and restore it. */
  function patchZeroConfig(){
    const p=policy();
    const api=window.KitsuneZeroConfig;
    if(!p.constrained||!api||api.__kitsuneStability2395)return !!api;

    const originalRun=typeof api.run==="function"?api.run.bind(api):null;
    const originalReset=typeof api.reset==="function"?api.reset.bind(api):null;
    const originalSetEnabled=typeof api.setEnabled==="function"?api.setEnabled.bind(api):null;

    const temporaryEnabled=async fn=>{
      let previous="0";
      try{previous=localStorage.getItem(ZERO_CONFIG_KEY)??"0";localStorage.setItem(ZERO_CONFIG_KEY,"1")}catch{}
      try{return await fn()}
      finally{try{localStorage.setItem(ZERO_CONFIG_KEY,"0")}catch{}}
    };

    if(originalRun){
      api.run=opts=>{
        if(!opts?.manual)return Promise.resolve(false);
        return temporaryEnabled(()=>originalRun({...opts,manual:true}));
      };
    }
    if(originalReset){
      api.reset=()=>temporaryEnabled(()=>originalReset());
    }
    if(originalSetEnabled){
      api.setEnabled=value=>{
        if(value){
          try{localStorage.setItem(ZERO_CONFIG_KEY,"0")}catch{}
          toast("На этом устройстве фоновая подготовка AI отключена. Нужный модуль загрузится по вашему действию.");
          return false;
        }
        return originalSetEnabled(false);
      };
    }
    api.__kitsuneStability2395=true;
    try{localStorage.setItem(ZERO_CONFIG_KEY,"0")}catch{}
    return true;
  }

  async function runtimeLoader(timeout=3500){
    const started=performance.now();
    while(performance.now()-started<timeout){
      if(window.KitsuneRuntimeLoader)return window.KitsuneRuntimeLoader;
      await new Promise(resolve=>setTimeout(resolve,40));
    }
    return null;
  }

  function busy(button,on){
    if(!button)return;
    button.classList.toggle("kitsune-runtime-loading",!!on);
    if(on)button.setAttribute("aria-busy","true");
    else button.removeAttribute("aria-busy");
  }

  async function ensure(group,button){
    const loader=await runtimeLoader();
    if(!loader)throw new Error("Загрузчик модулей ещё не готов");
    busy(button,true);
    try{return await loader.ensure(group,{urgent:true,reason:"explicit-ui",background:false})}
    finally{busy(button,false)}
  }

  function stopEvent(event){
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  }

  function replay(button){
    if(!button?.isConnected)return;
    button.dataset[REPLAY_KEY]="1";
    try{button.click()}finally{delete button.dataset[REPLAY_KEY]}
  }

  async function handleLazyButton(button,kind){
    try{
      if(kind==="adult"){
        await ensure("progress",button);
        window.KitsuneStudentExperience?.routeAdult?.();
        return;
      }
      if(kind==="ask"){
        await ensure("assistant",button);
        const api=window.KitsuneVoiceDialogue;
        if(api?.open)api.open(null);
        else toast("Голосовой диалог не удалось подготовить. Попробуйте ещё раз.");
        return;
      }
      if(kind==="camera"){
        await ensure("mathlab",button);
        const api=window.KitsuneCameraImport;
        if(api?.open)api.open();
        else toast("Модуль камеры пока недоступен.");
        return;
      }
      if(kind==="privacy"){
        await ensure("privacy",button);
        document.querySelector("#privacyBtn")?.click();
        return;
      }
      if(kind==="voice-action"){
        await ensure("assistant",button);
        replay(button);
        return;
      }
    }catch(error){
      toast(String(error?.message||error||"Не удалось открыть модуль"));
    }
  }

  function validateMathLab(event,button){
    const title=(document.querySelector("#pageTitle")?.textContent||"").toLowerCase();
    if(!title.includes("math lab"))return false;
    const label=(button.textContent||"").trim();
    const calculate=/рассчитать/i.test(label);
    const verify=/проверить решение/i.test(label);
    if(!calculate&&!verify)return false;

    const fields=[...document.querySelectorAll("#content textarea,#content input[type='text'],#content input:not([type])")]
      .filter(el=>!el.disabled&&el.getClientRects().length);
    const field=fields[0];
    if(!field||String(field.value||"").trim())return false;

    stopEvent(event);
    const message=calculate
      ?"Сначала введи задание. Серый пример внутри поля — это подсказка."
      :"Сначала введи решение по шагам, затем нажми «Проверить решение».";
    try{
      field.setCustomValidity(message);
      field.reportValidity();
      field.addEventListener("input",()=>field.setCustomValidity(""),{once:true});
      field.focus({preventScroll:false});
    }catch{toast(message)}
    return true;
  }

  /* Registered before App Kernel / Runtime Loader capture handlers. */
  document.addEventListener("click",event=>{
    const button=event.target.closest?.("button");
    if(!button)return;
    if(button.dataset?.[REPLAY_KEY]==="1")return;

    if(validateMathLab(event,button))return;

    if(button.id==="adultCenterBtn"){
      stopEvent(event);handleLazyButton(button,"adult");return;
    }
    if(button.id==="sxAsk"){
      stopEvent(event);handleLazyButton(button,"ask");return;
    }
    if(button.id==="sxCamera"){
      stopEvent(event);handleLazyButton(button,"camera");return;
    }
    if(button.id==="sxPrivacy"){
      stopEvent(event);handleLazyButton(button,"privacy");return;
    }

    const tab=button.dataset?.sxTab;
    const tabGroup=tab==="cloud"?"cloud":(["mastery","reliability"].includes(tab)?"progress":"");
    if(tabGroup&&window.KitsuneRuntimeLoader&&!window.KitsuneRuntimeLoader.ready(tabGroup)){
      stopEvent(event);
      ensure(tabGroup,button).then(()=>replay(button)).catch(err=>toast(err?.message||err));
      return;
    }

    const text=(button.textContent||"").replace(/\s+/g," ").trim();
    if(/(?:Поговорить|Сказать Kitsune|текстом или голосом)/i.test(text) &&
       !window.KitsuneVoiceDialogue &&
       !button.matches("#v15SpeakBtn,#v151TestVoice")){
      stopEvent(event);handleLazyButton(button,"voice-action");
    }
  },true);

  document.addEventListener("change",event=>{
    const target=event.target;
    if(target?.id!=="v151AutoVoice")return;
    const p=policy();
    if(!p.ttsConstrained||!target.checked)return;
    stopEvent(event);
    target.checked=false;
    try{localStorage.setItem(AUTO_SPEAK_KEY,"0")}catch{}
    toast("Автоозвучка на этом устройстве отключена для стабильности. Кнопка ручной озвучки работает.");
  },true);

  function quietAudio(){
    try{window.speechSynthesis?.cancel?.()}catch{}
    try{window.KitsunePresence?.wake?.stop?.("page-hidden",true)}catch{}
  }

  document.addEventListener("visibilitychange",()=>{
    if(document.hidden)quietAudio();
  });
  window.addEventListener("pagehide",quietAudio);

  injectStyles();
  installTutorGuard();
  setTimeout(installTutorGuard,120);
  setTimeout(installTutorGuard,700);

  /* Core modules are ordinary synchronous scripts below this file. */
  for(const delay of [120,500,1300,3000]){
    setTimeout(()=>{
      patchZeroConfig();
      applyAutoVoicePolicy();
      installTutorGuard();
    },delay);
  }

  window.addEventListener("kitsune-runtime-group-loaded",()=>{
    applyAutoVoicePolicy();
    patchZeroConfig();
  });

  window.KitsuneRuntimeStability={
    version:VERSION,
    policy,
    toast,
    tutorSuppressedWrites:()=>suppressedTutorWrites,
    applyVoicePolicy:applyAutoVoicePolicy,
    patchZeroConfig
  };
})();
