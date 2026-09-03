
/* =====================================================================
   v1.11.1 · KITSUNE ANALYTICS — CHILD SAFE
   Analytics is OPT-IN. Umami is not even loaded until an adult enables it.
   Never send answers, chat, voice transcripts, audio or local progress.
   ===================================================================== */
(() => {
  "use strict";

  const VERSION="1.11.3";
  const WEBSITE_ID="1a59caa5-62af-44bc-a583-fa4b3c8fe80a";
  const PROD_HOST="qsqgjhngyt-maker.github.io";
  const CONSENT_KEY="a8_analytics_consent_v1111";
  const OWNER_OPTOUT_KEY="a8_analytics_owner_optout";
  const FIRST_STANDALONE_KEY="a8_analytics_first_standalone_v111";
  const SESSION_KEY="a8_analytics_session_v111";
  const SCRIPT_ID="kitsuneUmamiTracker";

  const queue=[];
  let flushTimer=null;
  let loadingPromise=null;
  let initialized=false;

  function ownerOptedOut(){
    try{return localStorage.getItem(OWNER_OPTOUT_KEY)==="1"}catch(e){return false}
  }

  function privacySignalBlocks(){
    try{
      return navigator.doNotTrack==="1" ||
             window.doNotTrack==="1" ||
             navigator.globalPrivacyControl===true;
    }catch(e){
      return false;
    }
  }

  function consentEnabled(){
    try{
      return location.hostname===PROD_HOST &&
             localStorage.getItem(CONSENT_KEY)==="1" &&
             !ownerOptedOut() &&
             !privacySignalBlocks();
    }catch(e){
      return false;
    }
  }

  function safeData(data={}){
    const allowed=[
      "version","display_mode","source","outcome","feature","engine",
      "backend","kind","extension","lesson_id","view","platform"
    ];
    const out={};
    for(const key of allowed){
      if(!(key in data))continue;
      const value=data[key];
      if(["string","number","boolean"].includes(typeof value)){
        out[key]=typeof value==="string"?value.slice(0,80):value;
      }
    }
    return out;
  }

  function createTracker(){
    if(!consentEnabled())return Promise.resolve(false);
    if(typeof window.umami?.track==="function")return Promise.resolve(true);
    if(loadingPromise)return loadingPromise;

    loadingPromise=new Promise(resolve=>{
      let s=document.getElementById(SCRIPT_ID);
      if(s){
        const done=()=>resolve(typeof window.umami?.track==="function");
        if(typeof window.umami?.track==="function")return done();
        s.addEventListener("load",done,{once:true});
        s.addEventListener("error",()=>resolve(false),{once:true});
        return;
      }

      s=document.createElement("script");
      s.id=SCRIPT_ID;
      s.defer=true;
      s.src="https://cloud.umami.is/script.js";
      s.dataset.websiteId=WEBSITE_ID;
      s.dataset.domains=PROD_HOST;
      s.dataset.doNotTrack="true";
      s.dataset.excludeSearch="true";
      s.dataset.performance="true";
      s.dataset.beforeSend="kitsuneAnalyticsBeforeSend";
      s.onload=()=>resolve(typeof window.umami?.track==="function");
      s.onerror=()=>resolve(false);
      document.head.appendChild(s);
    }).finally(()=>{
      setTimeout(()=>{loadingPromise=null},0);
    });

    return loadingPromise;
  }

  function send(name,data={}){
    if(!consentEnabled())return false;
    if(typeof window.umami?.track!=="function")return false;
    try{
      window.umami.track(name,safeData({version:VERSION,...data}));
      return true;
    }catch(e){
      return false;
    }
  }

  function flush(){
    if(!consentEnabled()||typeof window.umami?.track!=="function")return;
    while(queue.length){
      const item=queue.shift();
      send(item.name,item.data);
    }
    if(flushTimer){
      clearInterval(flushTimer);
      flushTimer=null;
    }
  }

  function track(name,data={}){
    if(!consentEnabled())return false;
    if(send(name,data))return true;

    if(queue.length<30)queue.push({name,data});
    createTracker().then(ok=>{if(ok)flush()});

    if(!flushTimer){
      let tries=0;
      flushTimer=setInterval(()=>{
        tries++;
        flush();
        if(tries>40&&flushTimer){
          clearInterval(flushTimer);
          flushTimer=null;
          queue.length=0;
        }
      },250);
    }
    return true;
  }

  function displayMode(){
    if(window.matchMedia?.("(display-mode: standalone)").matches)return "standalone";
    if(window.matchMedia?.("(display-mode: fullscreen)").matches)return "fullscreen";
    if(window.matchMedia?.("(display-mode: minimal-ui)").matches)return "minimal-ui";
    if(window.navigator.standalone===true)return "ios-standalone";
    return "browser";
  }

  function isStandalone(){
    return displayMode()!=="browser";
  }

  function trackLaunch(){
    if(!consentEnabled())return;
    const dm=displayMode();
    track("app_launch",{display_mode:dm});

    if(isStandalone()){
      track("pwa_launch",{display_mode:dm});
      try{
        if(localStorage.getItem(FIRST_STANDALONE_KEY)!=="1"){
          localStorage.setItem(FIRST_STANDALONE_KEY,"1");
          track("pwa_first_standalone_launch",{display_mode:dm});
        }
      }catch(e){}
    }

    try{
      if(sessionStorage.getItem(SESSION_KEY)!=="1"){
        sessionStorage.setItem(SESSION_KEY,"1");
        track("session_open",{display_mode:dm});
      }
    }catch(e){}
  }

  function bindInstall(){
    window.addEventListener("beforeinstallprompt",()=>{
      track("pwa_install_prompt_available",{display_mode:displayMode()});
    });

    window.addEventListener("appinstalled",()=>{
      track("pwa_installed",{display_mode:displayMode()});
    });

    document.addEventListener("click",e=>{
      const el=e.target?.closest?.("button,a");
      if(!el)return;

      if(el.id==="installBtn"){
        track("pwa_install_button_click",{source:"course_ui"});
        return;
      }
      if(el.id==="v18PrepareBrain"){
        track("kitsune_brain_prepare_click",{feature:"brain"});
        return;
      }
      if(el.id==="v17Download"){
        track("neural_voice_download_click",{feature:"neural_voice"});
        return;
      }
      if(el.matches(".v19-prepare")){
        track("whisper_prepare_click",{feature:"whisper"});
        return;
      }
      if(el.matches(".v19-open-dialog,.v19-inline-talk")){
        track("kitsune_dialog_open",{source:el.matches(".v19-inline-talk")?"exercise":"assistant"});
        return;
      }
      if(el.matches(".v19-mic-btn")){
        track("voice_mic_button",{feature:"voice_dialogue"});
        return;
      }

      const href=el.getAttribute?.("href")||"";
      const m=href.match(/\.([a-z0-9]{2,5})(?:[?#]|$)/i);
      if(m&&/^(pdf|zip|rar|7z|docx?|xlsx?|pptx?|csv|apk)$/i.test(m[1])){
        track("file_download_click",{extension:m[1].toLowerCase()});
      }
    },{passive:true});
  }

  function bindFeatureReadiness(){
    const seen=new Set();
    const mark=(key,event,data)=>{
      if(seen.has(key))return;
      seen.add(key);
      track(event,data);
    };

    const obs=new MutationObserver(()=>{
      const brain=document.querySelector("#v18BrainStatus");
      if(brain?.classList.contains("ok")&&/готов/i.test(brain.textContent||"")){
        mark("brain_ready","kitsune_brain_ready",{feature:"brain"});
      }

      const whisper=document.querySelector(".v19-whisper-status");
      if(whisper?.classList.contains("ok")&&/готов/i.test(whisper.textContent||"")){
        mark("whisper_ready","whisper_ready",{feature:"whisper"});
      }

      const neural=document.querySelector("#v17NeuralStatus");
      if(neural?.classList.contains("ok")&&/(готов|активен|модель скачана)/i.test(neural.textContent||"")){
        mark("neural_ready","neural_voice_ready",{feature:"neural_voice"});
      }
    });

    obs.observe(document.documentElement,{
      subtree:true,childList:true,characterData:true,attributes:true,
      attributeFilter:["class"]
    });
  }

  async function setConsent(value){
    try{
      localStorage.setItem(CONSENT_KEY,value?"1":"0");
    }catch(e){}

    queue.length=0;

    if(!value){
      const s=document.getElementById(SCRIPT_ID);
      if(s)s.remove();
      return false;
    }

    if(privacySignalBlocks()||ownerOptedOut())return false;

    const ok=await createTracker();
    if(ok){
      track("analytics_enabled",{source:"privacy_settings"});
      trackLaunch();
    }
    return ok;
  }

  function init(){
    if(initialized)return;
    initialized=true;
    bindInstall();
    bindFeatureReadiness();

    /* No network request unless consent was explicitly saved earlier. */
    if(consentEnabled()){
      createTracker().then(ok=>{if(ok)trackLaunch()});
    }
  }

  window.KitsuneAnalytics={
    version:VERSION,
    track,
    displayMode,
    isStandalone,
    consentEnabled,
    privacySignalBlocks,
    ownerOptedOut,
    setConsent,
    setOwnerOptOut(value=true){
      try{
        if(value)localStorage.setItem(OWNER_OPTOUT_KEY,"1");
        else localStorage.removeItem(OWNER_OPTOUT_KEY);
      }catch(e){}
    }
  };

  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",init,{once:true});
  }else{
    init();
  }
})();
