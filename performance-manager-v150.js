/* =====================================================================
   Kitsune Performance Manager v2.3.0-beta.3.9.1
   Adaptive Stability · iPhone / Android / low-power PC

   Goals:
   - preserve the visual identity and all learning features;
   - reduce peak RAM/CPU/GPU pressure only when the device needs it;
   - keep course checks and Tutor usable even if local voice models were loaded;
   - restore the learner to the same lesson after an abnormal WebKit reload;
   - never delete progress, local models, D1/auth data, or user settings.
   ===================================================================== */
(() => {
  "use strict";

  const VERSION="2.3.0-beta.3.9.1";
  const AUTO_KEY="a8_performance_auto_v150";
  const PROFILE_KEY="a8_performance_profile_v2390";
  const STATE_KEY="a8_runtime_restore_v2391";
  const ALIVE_KEY="a8_runtime_alive_v2391";
  const CRASH_WINDOW_MS=120000;

  let auto=localStorage.getItem(AUTO_KEY)!=="0";
  let busy=0;
  let pressure=0; // 0 normal, 1 elevated, 2 emergency
  let lastPressureAt=0;
  let restoredAfterCrash=false;
  let currentState=loadJson(STATE_KEY,{view:"home",lessonId:"",scrollY:0,lessonUi:null,ts:0});
  let baseProfile=detectProfile();
  let forcedProfile=localStorage.getItem(PROFILE_KEY)||"";
  let effectiveProfile="full";
  let lastEffectsKey="";
  let effectResetTimer=null;
  let actionReplay=false;
  let wrapperTimer=null;
  let lastWrapped={openLesson:null,go:null,renderCourse:null,renderHome:null};
  let lagSamples=[];
  let lastTick=performance.now();
  let lastInteraction=Date.now();

  const previousAlive=loadJson(ALIVE_KEY,null);
  const previousCrash=!!(
    previousAlive &&
    Number(previousAlive.ts)>0 &&
    Date.now()-Number(previousAlive.ts)<CRASH_WINDOW_MS
  );

  function loadJson(key,fallback){
    try{
      const value=JSON.parse(localStorage.getItem(key)||"null");
      return value&&typeof value==="object"?value:fallback;
    }catch{return fallback}
  }

  function saveJson(key,value){
    try{localStorage.setItem(key,JSON.stringify(value))}catch{}
  }


  function safeText(value,max=600){
    return String(value??"").slice(0,max);
  }

  function captureLessonUi(){
    if(currentState.view!=="lesson")return null;

    const lessonId=currentState.lessonId||localStorage.getItem("a8_lastLesson")||"";
    if(!lessonId)return null;

    const ui={
      lessonId,
      inputs:{},
      hints:[],
      feedback:{},
      activeExercise:"",
      activeInput:"",
      levelIndex:0,
      tutor:null
    };

    /* Preserve every typed answer in this lesson. Usually there are only
       2–4 inputs, so this is tiny but prevents the learner losing work. */
    document.querySelectorAll('.exercise[data-ex] input[id^="ans-"]').forEach(input=>{
      if(input.value!==""){
        ui.inputs[input.id]=safeText(input.value,240);
      }
    });

    document.querySelectorAll('.exercise[data-ex] .hint.show[id]').forEach(hint=>{
      ui.hints.push(hint.id);
    });

    document.querySelectorAll('.exercise[data-ex] .feedback[id]').forEach(fb=>{
      if(!fb.textContent?.trim())return;
      ui.feedback[fb.id]={
        text:safeText(fb.textContent,700),
        className:safeText(fb.className,120)
      };
    });

    const focused=document.activeElement;
    if(focused?.matches?.('.exercise[data-ex] input, .v173-inline-tutor textarea')){
      ui.activeInput=focused.id||"";
      ui.activeExercise=focused.closest?.(".exercise[data-ex]")?.dataset?.ex||"";
    }

    const visibleTutor=document.querySelector(".exercise[data-ex] .v173-inline-tutor.show");
    if(visibleTutor){
      const box=visibleTutor.closest(".exercise[data-ex]");
      const ex=box?.dataset?.ex||"";
      if(ex)ui.activeExercise=ex;

      const normalSteps=[...visibleTutor.querySelectorAll(".v173-step.show:not(.answer-step)")].length;
      const answerShown=!!visibleTutor.querySelector(".v173-step.answer-step.show");
      const workResult=visibleTutor.querySelector(".v173-work-result");

      ui.tutor={
        exercise:ex,
        show:true,
        level:Math.max(1,Math.min(3,normalSteps||1)),
        answerShown,
        whyShown:!!visibleTutor.querySelector(".v173-why-box.show"),
        workShown:!!visibleTutor.querySelector(".v173-work-box.show"),
        workText:safeText(visibleTutor.querySelector("textarea")?.value||"",1200),
        workResultText:safeText(workResult?.textContent||"",1000),
        workResultClass:safeText(workResult?.className||"",140),
        diagnosis:safeText(visibleTutor.querySelector(".v173-diagnosis")?.textContent||"",1000)
      };
    }

    if(!ui.activeExercise){
      const candidate=document.querySelector(
        ".exercise[data-ex]:has(.feedback.ok),"+
        ".exercise[data-ex]:has(.feedback.bad),"+
        ".exercise[data-ex]:has(.hint.show)"
      );
      if(candidate)ui.activeExercise=candidate.dataset.ex||"";
    }

    const levelButtons=[...document.querySelectorAll(".level-switch button")];
    const activeLevel=levelButtons.findIndex(b=>b.classList.contains("active"));
    if(activeLevel>=0)ui.levelIndex=activeLevel;

    return ui;
  }

  function applyBasicLessonUi(ui){
    if(!ui||ui.lessonId!==currentState.lessonId)return;

    for(const [id,value] of Object.entries(ui.inputs||{})){
      const input=document.getElementById(id);
      if(input)input.value=value;
    }

    for(const id of ui.hints||[]){
      document.getElementById(id)?.classList.add("show");
    }

    for(const [id,state] of Object.entries(ui.feedback||{})){
      const fb=document.getElementById(id);
      if(!fb)continue;
      fb.className=state.className||"feedback";
      fb.textContent=state.text||"";
    }

    const levelButtons=[...document.querySelectorAll(".level-switch button")];
    const levelIndex=Number(ui.levelIndex||0);
    const button=levelButtons[levelIndex];
    if(button&&!button.classList.contains("active")){
      try{button.click()}catch{}
    }
  }

  async function waitFor(selector,{root=document,timeout=2600,step=80}={}){
    const start=performance.now();
    while(performance.now()-start<timeout){
      const found=root.querySelector(selector);
      if(found)return found;
      await new Promise(resolve=>setTimeout(resolve,step));
    }
    return null;
  }

  async function restoreTutorUi(ui){
    const tutor=ui?.tutor;
    if(!tutor?.show||!tutor.exercise)return false;

    const box=await waitFor(`.exercise[data-ex="${CSS.escape(tutor.exercise)}"]`,{timeout:2200});
    if(!box)return false;

    let panel=box.querySelector(".v173-inline-tutor.show");
    if(!panel){
      const tutorButton=await waitFor(".v16-tutor-btn",{root:box,timeout:2600});
      if(!tutorButton)return false;

      /* Bypass the heavy-action capture guard only for this recovery click.
         We are restoring an already-open helper, not starting a new action. */
      tutorButton.dataset.kitsunePerfReplay="1";
      try{tutorButton.click()}catch{}
      delete tutorButton.dataset.kitsunePerfReplay;

      panel=await waitFor(".v173-inline-tutor.show",{root:box,timeout:1800});
    }

    if(!panel)return false;

    /* Rebuild Tutor's own in-memory state by using its controls, rather than
       only painting old HTML. This means «Следующий шаг» keeps working after
       recovery instead of jumping backwards. */
    let level=Math.max(1,Math.min(3,Number(tutor.level||1)));
    for(let i=1;i<level;i++){
      try{panel.querySelector(".v173-next")?.click()}catch{}
      await new Promise(resolve=>setTimeout(resolve,30));
      panel=box.querySelector(".v173-inline-tutor.show")||panel;
    }

    if(tutor.answerShown){
      try{panel.querySelector(".v173-answer")?.click()}catch{}
      await new Promise(resolve=>setTimeout(resolve,30));
      panel=box.querySelector(".v173-inline-tutor.show")||panel;
    }

    if(tutor.whyShown&&!panel.querySelector(".v173-why-box.show")){
      try{panel.querySelector(".v173-why")?.click()}catch{}
    }

    if(tutor.workShown&&!panel.querySelector(".v173-work-box.show")){
      try{panel.querySelector(".v173-work")?.click()}catch{}
    }

    const textarea=panel.querySelector(".v173-work-box textarea");
    if(textarea&&tutor.workText)textarea.value=tutor.workText;

    const result=panel.querySelector(".v173-work-result");
    if(result&&tutor.workResultText){
      result.className=tutor.workResultClass||"v173-work-result show";
      result.textContent=tutor.workResultText;
    }

    const diagnosis=panel.querySelector(".v173-diagnosis");
    if(diagnosis&&tutor.diagnosis)diagnosis.textContent=tutor.diagnosis;

    return true;
  }

  async function restoreLessonUi(ui,scrollY){
    if(!ui||ui.lessonId!==currentState.lessonId){
      window.scrollTo({top:Number(scrollY||0),behavior:"auto"});
      return false;
    }

    /* Tutor-lite and Tutor-smart decorate exercises asynchronously after
       openLesson(), so restore in two phases. */
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    applyBasicLessonUi(ui);

    const tutorRestored=await restoreTutorUi(ui);

    /* Restore basic values again in case Tutor rerender touched feedback. */
    applyBasicLessonUi(ui);

    const anchor=ui.tutor?.show
      ?document.querySelector(`.exercise[data-ex="${CSS.escape(ui.tutor.exercise||"")}"] .v173-inline-tutor.show`)
      :ui.activeExercise
        ?document.querySelector(`.exercise[data-ex="${CSS.escape(ui.activeExercise)}"]`)
        :null;

    if(anchor){
      anchor.scrollIntoView({behavior:"auto",block:"center"});
    }else{
      window.scrollTo({top:Number(scrollY||0),behavior:"auto"});
    }

    if(ui.activeInput){
      const input=document.getElementById(ui.activeInput);
      if(input){
        setTimeout(()=>{
          try{
            input.focus({preventScroll:true});
            const n=String(input.value||"").length;
            input.setSelectionRange?.(n,n);
          }catch{}
        },80);
      }
    }

    return tutorRestored||!!anchor;
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

  function isMobile(){
    return isIOS()||isAndroid()||/Mobile/i.test(String(navigator.userAgent||""));
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

    /* WebKit PWA memory limits can be lower than the physical iPhone RAM.
       Start iOS in careful mode even on a fast phone. */
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

    const base=(["full","balanced","careful"].includes(forcedProfile))
      ?forcedProfile
      :baseProfile;

    const rank=Math.max(profileRank(base),pressure===2?3:pressure===1?2:0);
    return rankProfile(rank);
  }

  function injectStyles(){
    if(document.querySelector("#kitsuneAdaptivePerf2391"))return;
    const style=document.createElement("style");
    style.id="kitsuneAdaptivePerf2391";
    style.textContent=`
      /* Keep the design; only skip paint/layout for cards far below viewport. */
      @supports (content-visibility:auto){
        body.kitsune-perf-balanced .course-grid > *,
        body.kitsune-perf-balanced .chapter-card,
        body.kitsune-perf-balanced .chapter-summary-card,
        body.kitsune-perf-careful .course-grid > *,
        body.kitsune-perf-careful .chapter-card,
        body.kitsune-perf-careful .lesson-panel,
        body.kitsune-perf-careful .example-card,
        body.kitsune-perf-careful .practice-card,
        body.kitsune-perf-careful .chapter-summary-card{
          content-visibility:auto;
          contain-intrinsic-size:auto 320px;
        }
      }

      body.kitsune-perf-careful .glass-panel,
      body.kitsune-perf-careful .glass-topbar,
      body.kitsune-perf-careful .chapter-card,
      body.kitsune-perf-careful .v173-inline-tutor{
        -webkit-backdrop-filter:blur(9px)!important;
        backdrop-filter:blur(9px)!important;
      }

      body.kitsune-perf-careful .reveal{
        transition-duration:.16s!important;
      }

      body.kitsune-perf-careful.kitsune-perf-busy .reveal{
        opacity:1!important;
        transform:none!important;
        transition-duration:.001ms!important;
      }

      body.kitsune-perf-careful .chapter-card:hover,
      body.kitsune-perf-careful .topic-row:hover,
      body.kitsune-perf-careful .chapter-summary-card:hover{
        transform:none!important;
      }

      body.kitsune-perf-busy .bg-orb{
        animation-play-state:paused!important;
        opacity:.18!important;
      }

      body.kitsune-perf-busy .learning-fx,
      body.kitsune-perf-busy .celebration,
      body.kitsune-perf-busy .confetti{
        animation-play-state:paused!important;
      }

      /* Emergency is temporary and automatic. The UI stays fully usable. */
      body.kitsune-perf-emergency .particles-canvas,
      body.kitsune-perf-emergency .bg-orb{
        display:none!important;
      }
      body.kitsune-perf-emergency .glass-panel,
      body.kitsune-perf-emergency .glass-topbar,
      body.kitsune-perf-emergency .chapter-card,
      body.kitsune-perf-emergency .v173-inline-tutor{
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

      .kitsune-perf-toast{
        position:fixed;
        left:50%;
        bottom:max(18px,env(safe-area-inset-bottom));
        z-index:11000;
        max-width:min(92vw,560px);
        transform:translate(-50%,18px);
        opacity:0;
        pointer-events:none;
        padding:9px 12px;
        border:1px solid var(--line);
        border-radius:12px;
        background:color-mix(in srgb,var(--card-strong) 94%,transparent);
        color:var(--text);
        box-shadow:0 12px 32px rgba(0,0,0,.16);
        -webkit-backdrop-filter:blur(10px);
        backdrop-filter:blur(10px);
        font-size:10px;
        font-weight:800;
        transition:.18s ease;
      }
      .kitsune-perf-toast.show{
        opacity:1;
        transform:translate(-50%,0);
      }
    `;
    document.head.appendChild(style);
  }

  function resetEffectsSoon(){
    clearTimeout(effectResetTimer);
    effectResetTimer=setTimeout(()=>{
      try{window.dispatchEvent(new Event("resize"))}catch{}
    },80);
  }

  function patchEffects(){
    const fn=window.effectiveEffects;
    if(typeof fn!=="function"||fn.__kitsunePerf2391)return;

    const base=fn.bind(window);
    const wrapped=function(){
      const normal=base();
      const p=effectiveProfile;
      if(p==="emergency"||(busy>0&&p==="careful"))return "off";
      if(p==="careful"&&normal==="auto")return "soft";
      return normal;
    };
    wrapped.__kitsunePerf2391=true;
    wrapped.__base=base;

    try{window.effectiveEffects=wrapped}catch{}
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
    body.dataset.kitsunePerf=auto?effectiveProfile:"off";

    patchEffects();

    const effectKey=`${effectiveProfile}:${busy>0}`;
    if(effectKey!==lastEffectsKey){
      lastEffectsKey=effectKey;
      resetEffectsSoon();
    }
  }

  function begin(kind="work"){
    busy++;
    apply();
    saveRuntimeState();
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

  async function releaseHeavyVoice(reason="course"){
    if(dialogOpen())return false;

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
        new Promise(resolve=>setTimeout(resolve,900))
      ]);
    }catch{}

    return true;
  }

  function isHeavyCourseAction(button){
    if(!button||button.disabled)return false;
    if(button.closest("#v19Dialog"))return false;

    const text=String(button.textContent||"")
      .replace(/\s+/g," ")
      .trim();
    const action=String(button.dataset.action||button.dataset.tutorAction||"");

    return (
      /^Проверить\b/i.test(text) ||
      /Проверить\s+(ответ|решение|задание)/i.test(text) ||
      /Разобрать.*(?:Kitsune|Китсуне)/i.test(text) ||
      /(?:Kitsune|Китсуне).*разобрат/i.test(text) ||
      /check|verify|explain|tutor/i.test(action)
    );
  }

  async function guardedReplay(button){
    if(actionReplay||!button?.isConnected)return;
    actionReplay=true;
    begin("course-action");

    try{
      saveRuntimeState();
      await releaseHeavyVoice("course-action");
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));

      button.dataset.kitsunePerfReplay="1";
      button.click();
      delete button.dataset.kitsunePerfReplay;
    }finally{
      actionReplay=false;
      setTimeout(()=>end("course-action"),1000);
    }
  }

  function onCaptureClick(event){
    lastInteraction=Date.now();

    const button=event.target.closest?.("button");
    if(!button)return;

    if(button.dataset.kitsunePerfReplay==="1")return;

    const nav=button.closest(".nav-btn[data-view]");
    if(nav){
      currentState.view=nav.dataset.view||"home";
      currentState.lessonId="";
      currentState.scrollY=0;
      currentState.ts=Date.now();
      saveJson(STATE_KEY,currentState);

      if(auto&&profileRank(effectiveProfile)>=2&&["course","trainer","mastery"].includes(currentState.view)){
        setTimeout(()=>releaseHeavyVoice("navigation"),80);
      }
      return;
    }

    const rawOnclick=button.getAttribute("onclick")||"";
    const lessonMatch=rawOnclick.match(/openLesson\(['"]([^'"]+)['"]\)/);
    if(lessonMatch){
      currentState.view="lesson";
      currentState.lessonId=lessonMatch[1];
      currentState.scrollY=0;
      currentState.lessonUi=null;
      currentState.ts=Date.now();
      saveJson(STATE_KEY,currentState);

      if(auto&&profileRank(effectiveProfile)>=2){
        setTimeout(()=>releaseHeavyVoice("lesson"),60);
      }
    }

    if(
      auto &&
      profileRank(effectiveProfile)>=2 &&
      isHeavyCourseAction(button)
    ){
      event.preventDefault();
      event.stopImmediatePropagation();
      guardedReplay(button).catch(()=>{});
    }
  }

  function wrapFunction(name,onBefore,onAfter){
    const fn=window[name];
    if(typeof fn!=="function"||fn.__kitsunePerf2391)return;
    if(lastWrapped[name]===fn)return;

    const wrapped=function(...args){
      try{onBefore?.(args)}catch{}
      const result=fn.apply(this,args);
      try{onAfter?.(args,result)}catch{}
      return result;
    };

    wrapped.__kitsunePerf2391=true;
    wrapped.__base=fn;
    lastWrapped[name]=wrapped;

    try{window[name]=wrapped}catch{}
  }

  function installWrappers(){
    wrapFunction("openLesson",args=>{
      currentState.view="lesson";
      currentState.lessonId=String(args?.[0]||localStorage.getItem("a8_lastLesson")||"");
      currentState.scrollY=0;
      currentState.lessonUi=null;
      currentState.ts=Date.now();
      saveJson(STATE_KEY,currentState);
    },()=>{
      if(auto&&profileRank(effectiveProfile)>=2){
        setTimeout(()=>releaseHeavyVoice("lesson-opened"),120);
      }
    });

    wrapFunction("go",args=>{
      const view=String(args?.[0]||"home");
      currentState.view=view;
      if(view!=="lesson"){
        currentState.lessonId="";
        currentState.lessonUi=null;
      }
      currentState.scrollY=0;
      currentState.ts=Date.now();
      saveJson(STATE_KEY,currentState);
    });

    wrapFunction("renderCourse",()=>{
      currentState.view="course";
      currentState.lessonId="";
      currentState.lessonUi=null;
      currentState.scrollY=0;
      currentState.ts=Date.now();
      saveJson(STATE_KEY,currentState);
    });

    wrapFunction("renderHome",()=>{
      currentState.view="home";
      currentState.lessonId="";
      currentState.lessonUi=null;
      currentState.scrollY=0;
      currentState.ts=Date.now();
      saveJson(STATE_KEY,currentState);
    });
  }

  function saveRuntimeState(){
    const active=document.querySelector(".nav-btn.active[data-view]");
    if(active&&!dialogOpen()&&currentState.view!=="lesson"){
      currentState.view=active.dataset.view||currentState.view||"home";
    }

    if(currentState.view==="lesson"&&!currentState.lessonId){
      currentState.lessonId=localStorage.getItem("a8_lastLesson")||"";
    }

    if(["lesson","course","trainer","mastery","mathlab"].includes(currentState.view)){
      currentState.scrollY=Math.max(0,Math.round(window.scrollY||0));
    }else{
      currentState.scrollY=0;
    }

    if(currentState.view==="lesson"){
      currentState.lessonUi=captureLessonUi();
    }else{
      currentState.lessonUi=null;
    }

    currentState.ts=Date.now();
    saveJson(STATE_KEY,currentState);
  }

  function toast(text){
    let el=document.querySelector("#kitsunePerfToast");
    if(!el){
      el=document.createElement("div");
      el.id="kitsunePerfToast";
      el.className="kitsune-perf-toast";
      document.body.appendChild(el);
    }
    el.textContent=text;
    requestAnimationFrame(()=>el.classList.add("show"));
    setTimeout(()=>el.classList.remove("show"),3200);
  }

  function restoreAfterCrash(){
    if(!previousCrash)return;
    if(!currentState||Date.now()-Number(currentState.ts||0)>15*60*1000)return;

    const view=currentState.view;
    if(!view||view==="home")return;

    pressure=Math.max(pressure,1);
    lastPressureAt=Date.now();
    apply();

    let restored=false;

    try{
      if(view==="lesson"){
        const lesson=currentState.lessonId||localStorage.getItem("a8_lastLesson")||"";
        if(lesson&&typeof window.openLesson==="function"){
          window.openLesson(lesson);
          restored=true;
        }
      }else if(view==="course"&&typeof window.renderCourse==="function"){
        window.renderCourse();
        restored=true;
      }else if(typeof window.go==="function"){
        window.go(view);
        restored=true;
      }
    }catch{}

    if(restored){
      restoredAfterCrash=true;
      const y=Number(currentState.scrollY||0);

      if(view==="lesson"){
        const ui=currentState.lessonUi;
        setTimeout(()=>{
          restoreLessonUi(ui,y)
            .finally(()=>{
              toast(
                ui?.tutor?.show
                  ?"↩️ Продолжаем с того же примера и шага."
                  :"↩️ Продолжаем с того же места в уроке."
              );
            });
        },260);
      }else{
        setTimeout(()=>window.scrollTo({top:y,behavior:"auto"}),320);
        setTimeout(()=>toast("↩️ Продолжаем с того же места."),550);
      }
    }
  }

  function markAlive(){
    if(document.hidden)return;

    if(currentState.view==="lesson"){
      saveRuntimeState();
    }

    saveJson(ALIVE_KEY,{
      ts:Date.now(),
      view:currentState.view,
      lessonId:currentState.lessonId
    });
  }

  function clearAlive(){
    try{localStorage.removeItem(ALIVE_KEY)}catch{}
  }

  function notePressure(level,reason){
    if(!auto)return;
    const next=Math.max(pressure,level);
    if(next===pressure&&Date.now()-lastPressureAt<5000)return;

    pressure=next;
    lastPressureAt=Date.now();
    apply();

    if(level>=2){
      releaseHeavyVoice("pressure").catch(()=>{});
      saveRuntimeState();
    }

    try{
      window.dispatchEvent(new CustomEvent("kitsune-performance-pressure",{
        detail:{level:pressure,reason,profile:effectiveProfile}
      }));
    }catch{}
  }

  function monitorEventLoop(){
    const now=performance.now();
    const drift=now-lastTick-2000;
    lastTick=now;

    if(document.hidden)return;

    if(drift>180){
      lagSamples.push({ts:Date.now(),drift});
    }

    const cutoff=Date.now()-20000;
    lagSamples=lagSamples.filter(x=>x.ts>=cutoff);

    const severe=lagSamples.some(x=>x.drift>650);
    if(severe||lagSamples.length>=6){
      notePressure(2,"event-loop");
    }else if(lagSamples.length>=3){
      notePressure(1,"event-loop");
    }

    /* Chrome/Edge/Yandex expose heap stats. Safari does not. */
    const mem=performance.memory;
    if(mem?.jsHeapSizeLimit&&mem?.usedJSHeapSize){
      const ratio=mem.usedJSHeapSize/mem.jsHeapSizeLimit;
      if(ratio>.84)notePressure(2,"heap");
      else if(ratio>.72)notePressure(1,"heap");
    }

    /* Recover visual quality automatically after a stable minute. */
    if(
      pressure>0 &&
      Date.now()-lastPressureAt>60000 &&
      lagSamples.length===0 &&
      busy===0
    ){
      pressure--;
      lastPressureAt=Date.now();
      apply();
    }
  }

  function scheduleIdleCacheHint(){
    const run=()=>{
      if(
        document.hidden ||
        busy>0 ||
        profileRank(effectiveProfile)>=2 ||
        Date.now()-lastInteraction<5000
      ){
        setTimeout(run,7000);
        return;
      }

      try{
        const urls=[
          ...document.querySelectorAll('script[src],link[rel="stylesheet"][href],link[rel="manifest"][href]')
        ].map(el=>el.src||el.href)
          .filter(Boolean)
          .filter(url=>{
            try{return new URL(url,location.href).origin===location.origin}catch{return false}
          });

        navigator.serviceWorker?.controller?.postMessage?.({
          type:"CACHE_URLS",
          urls:[...new Set(urls)].slice(0,80)
        });
      }catch{}
    };

    if("requestIdleCallback" in window){
      requestIdleCallback(()=>setTimeout(run,6000),{timeout:10000});
    }else{
      setTimeout(run,9000);
    }
  }

  function info(){
    return {
      version:VERSION,
      auto,
      busy,
      profile:effectiveProfile,
      baseProfile,
      forcedProfile:forcedProfile||"auto",
      pressure,
      mobile:isMobile(),
      ios:isIOS(),
      android:isAndroid(),
      deviceMemory:memoryGB(),
      cores:cores(),
      restoredAfterCrash,
      previousCrash,
      continuityRecovery:true,
      savedExercise:currentState.lessonUi?.activeExercise||"",
      savedTutor:!!currentState.lessonUi?.tutor?.show
    };
  }

  injectStyles();
  apply();

  document.addEventListener("click",onCaptureClick,true);
  document.addEventListener("pointerdown",()=>{lastInteraction=Date.now()},{passive:true});

  /* Continuity checkpoints: keep the exact exercise/Tutor state current without
     polling the whole DOM continuously. */
  document.addEventListener("input",event=>{
    if(event.target.closest?.(".exercise[data-ex], .v173-inline-tutor")){
      lastInteraction=Date.now();
      saveRuntimeState();
    }
  },true);

  document.addEventListener("click",event=>{
    if(event.target.closest?.(
      ".exercise[data-ex], .v173-inline-tutor, .level-switch"
    )){
      setTimeout(saveRuntimeState,90);
      setTimeout(saveRuntimeState,380);
    }
  });

  let scrollTimer=null;
  window.addEventListener("scroll",()=>{
    clearTimeout(scrollTimer);
    scrollTimer=setTimeout(saveRuntimeState,350);
  },{passive:true});

  document.addEventListener("visibilitychange",()=>{
    if(document.hidden){
      saveRuntimeState();

      if(auto&&profileRank(effectiveProfile)>=2&&!dialogOpen()){
        releaseHeavyVoice("background").catch(()=>{});
      }
    }else{
      markAlive();
    }
  });

  window.addEventListener("pagehide",()=>{
    saveRuntimeState();
    clearAlive();
  });

  window.addEventListener("beforeunload",()=>{
    saveRuntimeState();
    clearAlive();
  });

  setInterval(markAlive,4000);
  setInterval(monitorEventLoop,2000);

  wrapperTimer=setInterval(installWrappers,900);
  setTimeout(()=>{
    installWrappers();
    restoreAfterCrash();
    scheduleIdleCacheHint();
  },1100);

  window.KitsunePerformance={
    version:VERSION,
    begin,
    end,
    setAuto,
    setProfile,
    releaseHeavy:releaseHeavyVoice,
    saveState:saveRuntimeState,
    info
  };
})();
