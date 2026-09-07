/* =====================================================================
   Kitsune Performance Manager v2.3.0-beta.3.9.2 · SMOOTH RUNTIME

   Philosophy:
   - prevent WebKit/low-memory crashes instead of restoring after them;
   - preserve visual identity, but reduce invisible/compositor work;
   - one heavy voice/AI lifetime at a time;
   - never unload/reload voice on every exercise button press;
   - no scroll-position recovery, no lesson DOM snapshots, no 4-second
     localStorage checkpoints.
   ===================================================================== */
(() => {
  "use strict";

  const VERSION="2.3.0-beta.3.9.2";
  const AUTO_KEY="a8_perf_auto_v2392";
  const PROFILE_KEY="a8_perf_profile_v2392";

  let auto=readBool(AUTO_KEY,true);
  let forcedProfile="";
  try{forcedProfile=localStorage.getItem(PROFILE_KEY)||""}catch{}

  let baseProfile=detectProfile();
  let effectiveProfile=baseProfile;
  let pressure=0;
  let lastPressureAt=0;
  let busy=0;
  let learningMode=false;
  let currentView="home";
  let currentLesson="";
  let lastInteraction=Date.now();
  let lastTick=performance.now();
  let lagSamples=[];
  let wrapperTimer=null;
  let wrapperTries=0;
  let scrollTimer=null;
  let heavyReleasePromise=null;
  let lastHeavyReleaseAt=0;
  let dialogObserver=null;
  let dialogNode=null;
  let effectResetTimer=null;
  let lastEffectsKey="";

  function readBool(key,fallback){
    try{
      const value=localStorage.getItem(key);
      return value===null?fallback:value==="1";
    }catch{return fallback}
  }

  function sleep(ms){
    return new Promise(resolve=>setTimeout(resolve,ms));
  }

  function isIOS(){
    const ua=String(navigator.userAgent||"");
    const platform=String(navigator.platform||"");
    return /iPhone|iPad|iPod/i.test(ua) ||
      (platform==="MacIntel"&&Number(navigator.maxTouchPoints)>1);
  }

  function isAndroid(){
    return /Android/i.test(String(navigator.userAgent||""));
  }

  function memoryGB(){
    const value=Number(navigator.deviceMemory||0);
    return Number.isFinite(value)&&value>0?value:null;
  }

  function cores(){
    const value=Number(navigator.hardwareConcurrency||0);
    return Number.isFinite(value)&&value>0?value:null;
  }

  function detectProfile(){
    const mem=memoryGB();
    const cpu=cores();

    /* iOS WebKit may kill a page well before physical RAM is exhausted.
       Start conservative, but keep the same visual language. */
    if(isIOS())return "careful";

    if(isAndroid()){
      if((mem&&mem<=4)||(cpu&&cpu<=4))return "careful";
      if((mem&&mem<=6)||(cpu&&cpu<=6))return "balanced";
      return "full";
    }

    if((mem&&mem<=4)||(cpu&&cpu<=4))return "careful";
    if((mem&&mem<=8)||(cpu&&cpu<=6))return "balanced";
    return "full";
  }

  function profileRank(name){
    return name==="emergency"?3:name==="careful"?2:name==="balanced"?1:0;
  }

  function rankProfile(rank){
    return rank>=3?"emergency":rank===2?"careful":rank===1?"balanced":"full";
  }

  function computeProfile(){
    if(!auto)return "full";
    const base=["full","balanced","careful"].includes(forcedProfile)
      ?forcedProfile
      :baseProfile;
    const rank=Math.max(profileRank(base),pressure===2?3:pressure===1?2:0);
    return rankProfile(rank);
  }

  function injectStyles(){
    if(document.querySelector("#kitsuneSmoothPerf2392"))return;
    const style=document.createElement("style");
    style.id="kitsuneSmoothPerf2392";
    style.textContent=`
      /*
       * COURSE MAP: skip layout/paint for distant cards.
       * LESSONS: intentionally NOT content-visibility:auto — on iOS it can
       * cause visible jumps while intrinsic heights are corrected.
       */
      @supports (content-visibility:auto){
        body.kitsune-perf-balanced .course-grid > *,
        body.kitsune-perf-balanced .chapter-card,
        body.kitsune-perf-balanced .chapter-summary-card,
        body.kitsune-perf-careful .course-grid > *,
        body.kitsune-perf-careful .chapter-card,
        body.kitsune-perf-careful .chapter-summary-card{
          content-visibility:auto;
          contain-intrinsic-size:auto 300px;
        }
      }

      /*
       * Keep the large shell glass beautiful. On careful devices the many
       * small cards inside a lesson become "glass-look" surfaces without a
       * separate GPU backdrop texture for every exercise.
       */
      body.kitsune-perf-careful .exercise,
      body.kitsune-perf-careful .example-card,
      body.kitsune-perf-careful .practice-card,
      body.kitsune-perf-careful .topic-row,
      body.kitsune-perf-careful .v173-inline-tutor,
      body.kitsune-perf-careful .chapter-summary-card{
        -webkit-backdrop-filter:none!important;
        backdrop-filter:none!important;
        background:color-mix(in srgb,var(--card) 94%,transparent)!important;
      }

      body.kitsune-perf-careful .glass-panel,
      body.kitsune-perf-careful .glass-topbar,
      body.kitsune-perf-careful .sidebar{
        -webkit-backdrop-filter:blur(8px)!important;
        backdrop-filter:blur(8px)!important;
      }

      body.kitsune-perf-careful .reveal{
        transition-duration:.16s!important;
      }

      body.kitsune-perf-careful .chapter-card:hover,
      body.kitsune-perf-careful .topic-row:hover,
      body.kitsune-perf-careful .chapter-summary-card:hover{
        transform:none!important;
      }

      /*
       * During a finger scroll or a heavy navigation we freeze decorative
       * motion for a fraction of a second. The scene stays visible, so there
       * is no "lite mode" look; animation resumes immediately after movement.
       */
      body.kitsune-perf-scrolling .bg-orb,
      body.kitsune-perf-scrolling .learning-fx,
      body.kitsune-perf-busy .bg-orb,
      body.kitsune-perf-busy .learning-fx,
      body.kitsune-perf-busy .celebration,
      body.kitsune-perf-busy .confetti{
        animation-play-state:paused!important;
      }

      body.kitsune-perf-scrolling .particles-canvas{
        opacity:.38!important;
      }

      body.kitsune-perf-busy .particles-canvas{
        opacity:.22!important;
      }

      body.kitsune-perf-busy .reveal{
        opacity:1!important;
        transform:none!important;
        transition-duration:.001ms!important;
      }

      /* Emergency is temporary and only used after real runtime pressure. */
      body.kitsune-perf-emergency .particles-canvas{
        visibility:hidden!important;
      }
      body.kitsune-perf-emergency .bg-orb{
        opacity:.08!important;
        animation-play-state:paused!important;
      }
      body.kitsune-perf-emergency .exercise,
      body.kitsune-perf-emergency .example-card,
      body.kitsune-perf-emergency .practice-card,
      body.kitsune-perf-emergency .topic-row,
      body.kitsune-perf-emergency .v173-inline-tutor,
      body.kitsune-perf-emergency .chapter-card{
        -webkit-backdrop-filter:none!important;
        backdrop-filter:none!important;
      }
      body.kitsune-perf-emergency *,
      body.kitsune-perf-emergency *::before,
      body.kitsune-perf-emergency *::after{
        animation-duration:.001ms!important;
        animation-iteration-count:1!important;
        transition-duration:.001ms!important;
      }

      /*
       * Learning mode deliberately keeps voice models dormant. This class is
       * also a hook for future components; it does not hide any functionality.
       */
      body.kitsune-learning-mode{
        --kitsune-learning-runtime:1;
      }
    `;
    document.head.appendChild(style);
  }

  function patchEffects(){
    const fn=window.effectiveEffects;
    if(typeof fn!=="function"||fn.__kitsunePerf2392)return;

    const base=fn.bind(window);
    const wrapped=function(){
      const normal=base();
      if(effectiveProfile==="emergency")return "off";
      if((busy>0||document.body?.classList.contains("kitsune-perf-scrolling")) &&
         profileRank(effectiveProfile)>=2){
        return normal==="off"?"off":"soft";
      }
      if(effectiveProfile==="careful"&&normal==="auto")return "soft";
      return normal;
    };
    wrapped.__kitsunePerf2392=true;
    wrapped.__base=base;
    try{window.effectiveEffects=wrapped}catch{}
  }

  function resetEffectsSoon(){
    clearTimeout(effectResetTimer);
    effectResetTimer=setTimeout(()=>{
      try{window.dispatchEvent(new Event("resize"))}catch{}
    },70);
  }

  function apply(){
    injectStyles();
    effectiveProfile=computeProfile();

    const body=document.body;
    if(!body)return;

    body.classList.toggle("kitsune-perf-auto",auto);
    body.classList.toggle("kitsune-perf-busy",auto&&busy>0);
    body.classList.toggle("kitsune-perf-balanced",auto&&effectiveProfile==="balanced");
    body.classList.toggle("kitsune-perf-careful",auto&&effectiveProfile==="careful");
    body.classList.toggle("kitsune-perf-emergency",auto&&effectiveProfile==="emergency");
    body.classList.toggle("kitsune-learning-mode",learningMode);
    body.dataset.kitsunePerf=auto?effectiveProfile:"off";

    patchEffects();

    const key=`${effectiveProfile}:${busy>0}:${learningMode}`;
    if(key!==lastEffectsKey){
      lastEffectsKey=key;
      resetEffectsSoon();
    }
  }

  function begin(kind="work"){
    busy++;
    apply();
    try{
      window.dispatchEvent(new CustomEvent("kitsune-performance",{
        detail:{busy:true,kind,count:busy,profile:effectiveProfile}
      }));
    }catch{}
  }

  function end(kind="work"){
    busy=Math.max(0,busy-1);
    apply();
    try{
      window.dispatchEvent(new CustomEvent("kitsune-performance",{
        detail:{busy:busy>0,kind,count:busy,profile:effectiveProfile}
      }));
    }catch{}
  }

  function setAuto(value){
    auto=!!value;
    try{localStorage.setItem(AUTO_KEY,auto?"1":"0")}catch{}
    apply();
  }

  function setProfile(profile="auto"){
    if(profile==="auto"){
      forcedProfile="";
      try{localStorage.removeItem(PROFILE_KEY)}catch{}
    }else if(["full","balanced","careful"].includes(profile)){
      forcedProfile=profile;
      try{localStorage.setItem(PROFILE_KEY,profile)}catch{}
    }
    apply();
    return effectiveProfile;
  }

  function dialogOpen(){
    return !!(
      document.querySelector("#v19Dialog.show") ||
      document.body.classList.contains("v19-dialog-open")
    );
  }

  async function releaseHeavyVoice(reason="learning"){
    if(dialogOpen())return false;

    /* Never create the beta.3.9.0 unload/reload churn around every button. */
    if(heavyReleasePromise)return heavyReleasePromise;
    if(Date.now()-lastHeavyReleaseAt<1400)return false;

    lastHeavyReleaseAt=Date.now();

    heavyReleasePromise=(async()=>{
      const jobs=[];

      try{
        const wake=window.KitsunePresence?.wake;
        if(wake?.stop)jobs.push(Promise.resolve(wake.stop("performance-"+reason,true)));
      }catch{}

      try{
        if(window.KitsuneUnifiedVoice?.release){
          jobs.push(Promise.resolve(window.KitsuneUnifiedVoice.release()));
        }
      }catch{}

      try{
        if(window.KitsuneVoiceDialogue?.release){
          jobs.push(Promise.resolve(window.KitsuneVoiceDialogue.release()));
        }
      }catch{}

      try{
        if(window.KitsuneLiveConversation?.release){
          jobs.push(Promise.resolve(window.KitsuneLiveConversation.release()));
        }
      }catch{}

      try{
        if(window.AlfiNeuralVoice?.release){
          jobs.push(Promise.resolve(window.AlfiNeuralVoice.release()));
        }
      }catch{}

      try{window.speechSynthesis?.cancel?.()}catch{}

      if(!jobs.length)return false;

      try{
        await Promise.race([
          Promise.allSettled(jobs),
          sleep(520)
        ]);
      }catch{}

      return true;
    })();

    try{
      return await heavyReleasePromise;
    }finally{
      heavyReleasePromise=null;
    }
  }

  function isLearningView(view){
    return ["course","lesson","trainer","mastery","mathlab","chapterfinal"].includes(view);
  }

  function setLearningMode(value,reason="navigation"){
    const next=!!value;
    const changed=next!==learningMode;
    learningMode=next;
    apply();

    if(learningMode&&!dialogOpen()){
      /* One cleanup when entering/returning to study, not one cleanup per
         answer/check/tutor click. */
      setTimeout(()=>releaseHeavyVoice(reason).catch(()=>{}),changed?70:180);
    }
  }

  function markNavigationBusy(kind="navigation"){
    begin(kind);
    setTimeout(()=>end(kind),260);
  }

  function wrapFunction(name,onBefore,onAfter){
    const fn=window[name];
    if(typeof fn!=="function"||fn.__kitsunePerf2392)return false;

    const wrapped=function(...args){
      try{onBefore?.(args)}catch{}
      const result=fn.apply(this,args);
      try{onAfter?.(args,result)}catch{}
      return result;
    };

    wrapped.__kitsunePerf2392=true;
    wrapped.__base=fn;

    try{
      window[name]=wrapped;
      return true;
    }catch{
      return false;
    }
  }

  function installWrappers(){
    let found=0;

    if(wrapFunction("openLesson",args=>{
      currentView="lesson";
      currentLesson=String(args?.[0]||localStorage.getItem("a8_lastLesson")||"");
      markNavigationBusy("lesson-open");
      setLearningMode(true,"lesson-open");
    }))found++;

    if(wrapFunction("go",args=>{
      const view=String(args?.[0]||"home");
      currentView=view;
      if(view!=="lesson")currentLesson="";
      markNavigationBusy("view-change");
      setLearningMode(isLearningView(view),"view-"+view);
    }))found++;

    if(wrapFunction("renderCourse",()=>{
      currentView="course";
      currentLesson="";
      markNavigationBusy("course");
      setLearningMode(true,"course");
    }))found++;

    if(wrapFunction("renderHome",()=>{
      currentView="home";
      currentLesson="";
      markNavigationBusy("home");
      setLearningMode(false,"home");
    }))found++;

    return found;
  }

  function installDialogObserver(){
    const dialog=document.querySelector("#v19Dialog");
    if(!dialog||dialog===dialogNode)return false;

    try{dialogObserver?.disconnect?.()}catch{}
    dialogNode=dialog;

    let wasOpen=dialogOpen();

    dialogObserver=new MutationObserver(()=>{
      const nowOpen=dialogOpen();

      if(wasOpen&&!nowOpen&&learningMode){
        /* Voice was intentionally used. Once the dialogue closes, return RAM
           to the lesson in one operation. */
        setTimeout(()=>releaseHeavyVoice("dialog-closed").catch(()=>{}),160);
      }

      wasOpen=nowOpen;
    });

    dialogObserver.observe(dialog,{
      attributes:true,
      attributeFilter:["class"]
    });

    return true;
  }

  function bootstrapWrappers(){
    installWrappers();
    installDialogObserver();

    wrapperTimer=setInterval(()=>{
      wrapperTries++;
      installWrappers();
      installDialogObserver();

      /* No forever-running 900 ms wrapper poll. */
      if(wrapperTries>=18){
        clearInterval(wrapperTimer);
        wrapperTimer=null;
      }
    },450);
  }

  function notePressure(level,reason){
    if(!auto)return;

    const next=Math.max(pressure,level);
    if(next===pressure&&Date.now()-lastPressureAt<5000)return;

    pressure=next;
    lastPressureAt=Date.now();
    apply();

    if(level>=2&&learningMode&&!dialogOpen()){
      releaseHeavyVoice("pressure").catch(()=>{});
    }

    try{
      window.dispatchEvent(new CustomEvent("kitsune-performance-pressure",{
        detail:{level:pressure,reason,profile:effectiveProfile}
      }));
    }catch{}
  }

  function monitorEventLoop(){
    const now=performance.now();
    const drift=now-lastTick-2500;
    lastTick=now;

    if(document.hidden)return;

    if(drift>220){
      lagSamples.push({ts:Date.now(),drift});
    }

    const cutoff=Date.now()-22000;
    lagSamples=lagSamples.filter(x=>x.ts>=cutoff);

    const severe=lagSamples.some(x=>x.drift>750);
    if(severe||lagSamples.length>=6){
      notePressure(2,"event-loop");
    }else if(lagSamples.length>=3){
      notePressure(1,"event-loop");
    }

    /* Chromium-only heap signal; Safari simply skips it. */
    const mem=performance.memory;
    if(mem?.jsHeapSizeLimit&&mem?.usedJSHeapSize){
      const ratio=mem.usedJSHeapSize/mem.jsHeapSizeLimit;
      if(ratio>.84)notePressure(2,"heap");
      else if(ratio>.72)notePressure(1,"heap");
    }

    if(
      pressure>0 &&
      Date.now()-lastPressureAt>50000 &&
      lagSamples.length===0 &&
      busy===0
    ){
      pressure--;
      lastPressureAt=Date.now();
      apply();
    }
  }

  function installLongTaskObserver(){
    if(!("PerformanceObserver" in window))return;

    try{
      const supported=PerformanceObserver.supportedEntryTypes||[];
      if(!supported.includes("longtask"))return;

      const observer=new PerformanceObserver(list=>{
        if(document.hidden)return;
        const entries=list.getEntries();
        if(entries.some(x=>x.duration>700))notePressure(2,"longtask");
        else if(entries.filter(x=>x.duration>180).length>=2)notePressure(1,"longtask");
      });
      observer.observe({entryTypes:["longtask"]});
    }catch{}
  }

  function onScroll(){
    lastInteraction=Date.now();

    const body=document.body;
    if(!body)return;

    body.classList.add("kitsune-perf-scrolling");
    clearTimeout(scrollTimer);
    scrollTimer=setTimeout(()=>{
      body.classList.remove("kitsune-perf-scrolling");
      patchEffects();
      resetEffectsSoon();
    },150);
  }

  function onRuntimeGroupLoaded(event){
    const group=String(event?.detail?.group||"");
    if(group==="assistant"&&learningMode&&!dialogOpen()){
      /* Optional assistant scripts may have just created a wake/voice runtime.
         Return it to dormant state while the learner is solving exercises. */
      setTimeout(()=>releaseHeavyVoice("assistant-loaded").catch(()=>{}),140);
    }
  }

  function info(){
    return {
      version:VERSION,
      auto,
      profile:effectiveProfile,
      baseProfile,
      forcedProfile:forcedProfile||"auto",
      pressure,
      busy,
      learningMode,
      currentView,
      currentLesson,
      ios:isIOS(),
      android:isAndroid(),
      deviceMemory:memoryGB(),
      cores:cores(),
      recovery:false,
      scrollCheckpointing:false,
      perActionVoiceRelease:false
    };
  }

  injectStyles();
  apply();
  bootstrapWrappers();
  installLongTaskObserver();

  document.addEventListener("pointerdown",()=>{
    lastInteraction=Date.now();
  },{passive:true});

  window.addEventListener("scroll",onScroll,{passive:true});

  document.addEventListener("visibilitychange",()=>{
    if(document.hidden){
      if(learningMode&&!dialogOpen()){
        releaseHeavyVoice("background").catch(()=>{});
      }
    }else{
      lastTick=performance.now();
    }
  });

  window.addEventListener("kitsune-runtime-group-loaded",onRuntimeGroupLoaded);

  /*
   * After all legacy modules have had a chance to initialize, make sure an
   * iPhone/weak-device course session starts with AI voice engines dormant.
   */
  window.addEventListener("load",()=>{
    setTimeout(()=>{
      const active=document.querySelector(".nav-btn.active[data-view]");
      const view=active?.dataset?.view||currentView;
      currentView=view;
      setLearningMode(isLearningView(view),"boot");
    },550);
  },{once:true});

  setInterval(monitorEventLoop,2500);

  window.KitsunePerformance={
    version:VERSION,
    begin,
    end,
    setAuto,
    setProfile,
    setLearningMode,
    releaseHeavy:releaseHeavyVoice,
    info
  };
})();
