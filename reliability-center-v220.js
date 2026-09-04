
/* =====================================================================
   Kitsune Reliability Center v2.2.3
   Self-test, Safe Mode and non-destructive recovery.
   ===================================================================== */
(() => {
  "use strict";

  const VERSION=window.KITSUNE_APP_VERSION||"2.2.3";
  const SAFE_KEY="a8_safe_mode_v220";
  const SAFE_PREV_KEY="a8_safe_prev_v220";

  function isSafe(){return localStorage.getItem(SAFE_KEY)==="1"}
  function applySafeClass(){
    document.body.classList.toggle("kitsune-safe-mode",isSafe());
    window.__KITSUNE_SAFE_MODE__=isSafe();
  }
  applySafeClass();

  async function setSafe(enabled,{reload=true}={}){
    enabled=!!enabled;
    if(enabled){
      if(!isSafe()){
        const prev={
          brain:localStorage.getItem("a8_kitsune_brain_mode"),
          voice:localStorage.getItem("a8_alfi_voice_engine_v17"),
          zero:localStorage.getItem("a8_zero_config_enabled_v210")
        };
        localStorage.setItem(SAFE_PREV_KEY,JSON.stringify(prev));
      }
      localStorage.setItem(SAFE_KEY,"1");
      localStorage.setItem("a8_kitsune_brain_mode","smart");
      localStorage.setItem("a8_alfi_voice_engine_v17","system");
      localStorage.setItem("a8_zero_config_enabled_v210","0");
      try{window.KitsuneZeroConfig?.setEnabled?.(false)}catch(e){}
      try{await window.KitsuneBrain?.release?.()}catch(e){}
      try{await window.KitsuneVoiceDialogue?.release?.()}catch(e){}
      try{await window.AlfiNeuralVoice?.release?.()}catch(e){}
      try{await window.KitsuneCameraImport?.releaseOCR?.()}catch(e){}
      try{window.KitsuneMath?.terminate?.()}catch(e){}
    }else{
      localStorage.removeItem(SAFE_KEY);
      let prev={};
      try{prev=JSON.parse(localStorage.getItem(SAFE_PREV_KEY)||"{}")}catch(e){}
      if(prev.brain===null||prev.brain===undefined)localStorage.removeItem("a8_kitsune_brain_mode");
      else localStorage.setItem("a8_kitsune_brain_mode",prev.brain);
      if(prev.voice===null||prev.voice===undefined)localStorage.removeItem("a8_alfi_voice_engine_v17");
      else localStorage.setItem("a8_alfi_voice_engine_v17",prev.voice);
      if(prev.zero===null||prev.zero===undefined)localStorage.removeItem("a8_zero_config_enabled_v210");
      else localStorage.setItem("a8_zero_config_enabled_v210",prev.zero);
      localStorage.removeItem(SAFE_PREV_KEY);
    }
    applySafeClass();
    if(reload)location.reload();
  }

  async function testLocalStorage(){
    const key="a8_selftest_"+Date.now();
    localStorage.setItem(key,"ok");
    const ok=localStorage.getItem(key)==="ok";
    localStorage.removeItem(key);
    if(!ok)throw new Error("localStorage read/write failed");
    return "чтение/запись";
  }
  async function testMath(){
    if(!window.KitsuneMath?.analyze)throw new Error("Math API отсутствует");
    const r=await window.KitsuneMath.analyze("3x+7=19");
    if(r?.display!=="x = 4")throw new Error("неверный эталон Math Engine");
    return "3x+7=19 → x=4";
  }
  async function testGenerator(){
    const r=await window.KitsuneMath?.generateSet?.({mode:"marathon",difficulty:1});
    if(!r||r.tasks?.length!==51||new Set(r.tasks.map(x=>x.topicId)).size!==51)throw new Error("неполное покрытие");
    return "51/51 тем";
  }
  async function testSearch(){
    const r=window.KitsuneCourseSearch?.search?.("Виета",3)||[];
    if(!r.some(x=>x.id==="3-23"))throw new Error("поиск по курсу не нашёл Виета");
    return "локальный индекс";
  }
  async function testCache(){
    if(!("caches" in window))throw new Error("CacheStorage отсутствует");
    const names=await caches.keys();
    const app=names.find(x=>x.startsWith("algebra8-v"));
    if(!app)throw new Error("app shell cache не найден");
    return app;
  }
  async function testSW(){
    if(!("serviceWorker" in navigator))throw new Error("Service Worker API отсутствует");
    const reg=await navigator.serviceWorker.getRegistration();
    if(!reg)throw new Error("Service Worker не зарегистрирован");
    return navigator.serviceWorker.controller?"контролирует страницу":"зарегистрирован";
  }
  async function testStorageEstimate(){
    if(!navigator.storage?.estimate)return "API недоступен";
    const e=await navigator.storage.estimate();
    return `${Math.round(Number(e.usage||0)/1024/1024)} MB / ${Math.round(Number(e.quota||0)/1024/1024)} MB`;
  }

  const TESTS=[
    ["secure","HTTPS / secure context",async()=>{if(!window.isSecureContext)throw new Error("не secure context");return location.protocol}],
    ["storage","Local storage",testLocalStorage],
    ["cache","PWA app shell cache",testCache],
    ["sw","Service Worker",testSW],
    ["math","Math Engine",testMath],
    ["generator","Generator 51/51",testGenerator],
    ["search","Поиск по курсу",testSearch],
    ["learning","Tutor Intelligence",async()=>{if(!window.KitsuneLearning?.parentSummary)throw new Error("API отсутствует");return "готов"}],
    ["mastery","Mastery Score",async()=>{if(!window.KitsuneMastery?.summary)throw new Error("API отсутствует");return `${window.KitsuneMastery.summary().total} тем`}],
    ["camera","Camera Import",async()=>{if(!window.KitsuneCameraImport?.open)throw new Error("API отсутствует");return "permission on demand"}],
    ["brain","Kitsune Brain API",async()=>{if(!window.KitsuneBrain)throw new Error("API отсутствует");return window.KitsuneBrain.mode?.()||"доступен"}],
    ["whisper","Whisper API",async()=>{if(!window.KitsuneVoiceDialogue)throw new Error("API отсутствует");return window.KitsuneVoiceDialogue.status?.()?.backend||"lazy"}],
    ["voice","Voice API",async()=>{if(!window.AlfiNeuralVoice)throw new Error("API отсутствует");return window.AlfiNeuralVoice.actualEngine?.()?.engine||"lazy"}],
    ["zero","Zero-config",async()=>{if(!window.KitsuneZeroConfig)throw new Error("API отсутствует");return window.KitsuneZeroConfig.isDone?.()?"готов":"в процессе/ожидание"}],
    ["storage-estimate","Storage estimate",testStorageEstimate]
  ];

  async function selfTest(onProgress){
    const rows=[];
    for(let i=0;i<TESTS.length;i++){
      const [id,title,fn]=TESTS[i];
      onProgress?.({index:i,total:TESTS.length,id,title,status:"running"});
      const start=performance.now();
      try{
        const detail=await fn();
        rows.push({id,title,status:"pass",detail:String(detail??""),ms:Math.round(performance.now()-start)});
      }catch(e){
        const msg=String(e?.message||e);
        const warning=["brain","whisper","voice","zero","storage-estimate"].includes(id);
        rows.push({id,title,status:warning?"warn":"fail",detail:msg,ms:Math.round(performance.now()-start)});
      }
      onProgress?.({index:i+1,total:TESTS.length,...rows.at(-1)});
    }
    const pass=rows.filter(x=>x.status==="pass").length;
    const warn=rows.filter(x=>x.status==="warn").length;
    const fail=rows.filter(x=>x.status==="fail").length;
    return {version:VERSION,ts:Date.now(),pass,warn,fail,total:rows.length,rows,ok:fail===0};
  }

  async function repairAppShell(){
    if(!navigator.onLine)throw new Error("Для восстановления app shell нужен интернет.");
    if(!confirm("Восстановить файлы приложения? Учебный прогресс и AI-модели не удалятся."))return false;
    const names=await caches.keys();
    for(const name of names){
      if(name.startsWith("algebra8-v"))await caches.delete(name);
    }
    const reg=await navigator.serviceWorker?.getRegistration?.();
    try{await reg?.update?.()}catch(e){}
    sessionStorage.setItem("a8_repair_notice","1");
    location.reload();
    return true;
  }

  async function releaseRam(){
    try{await window.KitsuneBrain?.release?.()}catch(e){}
    try{await window.KitsuneVoiceDialogue?.release?.()}catch(e){}
    try{await window.AlfiNeuralVoice?.release?.()}catch(e){}
    try{await window.KitsuneCameraImport?.releaseOCR?.()}catch(e){}
    try{window.KitsuneMath?.terminate?.()}catch(e){}
    return true;
  }

  window.KitsuneReliability={
    version:VERSION,
    isSafe,
    setSafe,
    selfTest,
    repairAppShell,
    releaseRam,
    applySafeClass
  };
})();
