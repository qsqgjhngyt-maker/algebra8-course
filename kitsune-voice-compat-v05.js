/* Совместимость с существующим центром офлайн; только Kitsune Voice Engine. */
(() => {
  const api=()=>window.KitsuneStaticVoice;
  window.AlfiNeuralVoice={
    voiceId:'kitsune-qwen-v05', mode:()=> 'kitsune', isReady:()=>!!api(),
    verify:async()=>api()?.isCached?.()||false, download:()=>api().download(),
    release:async()=>{api()?.stop();return true;}, isBusy:()=>api()?.isBusy?.()||false,
    test:()=>window.v151Speak?.(api()?.sample(),{force:true,state:'happy'}),
    actualEngine:()=>({engine:'static',label:'Kitsune Voice Engine'})
  };
})();
