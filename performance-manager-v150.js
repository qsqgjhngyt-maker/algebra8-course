
/* =====================================================================
   Kitsune Performance Manager v2.2.1
   Conservative local optimization. Never deletes models or progress.
   ===================================================================== */
(() => {
  "use strict";
  const VERSION=window.KITSUNE_APP_VERSION||"2.2.1";
  const KEY="a8_performance_auto_v150";
  let auto=localStorage.getItem(KEY)!=="0";
  let busy=0;

  function isIOS(){
    const ua=String(navigator.userAgent||"");
    return /iPhone|iPad|iPod/i.test(ua)||(navigator.platform==="MacIntel"&&Number(navigator.maxTouchPoints)>1);
  }
  function isMobile(){return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent||"")}
  function lowMemory(){
    const m=Number(navigator.deviceMemory||0);
    return !!m&&m<=4;
  }
  function apply(){
    document.body.classList.toggle("kitsune-perf-auto",auto);
    document.body.classList.toggle("kitsune-perf-busy",auto&&busy>0);
    document.body.classList.toggle("kitsune-perf-careful",auto&&(isIOS()||lowMemory()));
  }
  function begin(kind="work"){
    busy++;
    apply();
    try{window.dispatchEvent(new CustomEvent("kitsune-performance",{detail:{busy:true,kind,count:busy}}))}catch(e){}
  }
  function end(kind="work"){
    busy=Math.max(0,busy-1);
    apply();
    try{window.dispatchEvent(new CustomEvent("kitsune-performance",{detail:{busy:busy>0,kind,count:busy}}))}catch(e){}
  }
  function setAuto(v){
    auto=!!v;
    localStorage.setItem(KEY,auto?"1":"0");
    apply();
  }
  function info(){
    return {
      version:VERSION,auto,busy,
      mobile:isMobile(),ios:isIOS(),
      deviceMemory:Number(navigator.deviceMemory||0)||null,
      cores:Number(navigator.hardwareConcurrency||0)||null,
      careful:auto&&(isIOS()||lowMemory())
    };
  }

  apply();
  window.KitsunePerformance={version:VERSION,begin,end,setAuto,info};
})();
