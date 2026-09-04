
/* ================================================================
   Kitsune Math Engine API v1.13.0
   Thin async wrapper around the deterministic local Math Worker.
   ================================================================ */
(() => {
  "use strict";

  const VERSION=window.KITSUNE_APP_VERSION||"1.13.0";
  let worker=null;
  let seq=0;
  const pending=new Map();

  function ensureWorker(){
    if(worker)return worker;
    worker=new Worker("./math-worker-v130.js?v=1.13.0",{name:"kitsune-math"});
    worker.onmessage=e=>{
      const m=e.data||{};
      const p=pending.get(m.id);
      if(!p)return;
      pending.delete(m.id);
      if(m.ok)p.resolve(m.result);
      else p.reject(new Error(m.error||"Math Worker error"));
    };
    worker.onerror=e=>{
      const err=new Error(e?.message||"Math Worker error");
      for(const p of pending.values())p.reject(err);
      pending.clear();
      try{worker.terminate()}catch(x){}
      worker=null;
    };
    return worker;
  }

  function call(op,args={}){
    return new Promise((resolve,reject)=>{
      const id=++seq;
      pending.set(id,{resolve,reject});
      try{ensureWorker().postMessage({id,op,args})}
      catch(err){pending.delete(id);reject(err)}
    });
  }

  function looksMath(text){
    const s=String(text||"");
    return /[=<>≤≥√²^]|\b(?:реши|вычисли|упрости|график|система|неравен|уравнен|корень|дискриминант|одз)\b/i.test(s) ||
      /(?:\d|\))\s*[xхХ]/.test(s);
  }

  function resultFacts(r){
    if(!r)return null;
    return {
      type:r.type||r.kind||"",
      result:r.display||"",
      steps:Array.isArray(r.steps)?r.steps.slice(0,8):[],
      domain:r.domain||"",
      exact:r.exact!==false,
      solutions:r.solutions??null,
      D:r.D??null
    };
  }

  window.KitsuneMath={
    version:VERSION,
    analyze:(input,mode="auto")=>call("analyze",{input,mode}),
    verifySteps:input=>call("verifySteps",{input}),
    sampleFunction:(expression,options={})=>call("sampleFunction",{expression,options}),
    generate:(topic="linear",difficulty=1)=>call("generate",{topic,difficulty}),
    looksMath,
    facts:resultFacts,
    terminate(){
      try{worker?.terminate()}catch(e){}
      worker=null;
      pending.clear();
    }
  };
})();
