/* =====================================================================
   Kitsune Reveal Manager v2.2.1
   Centralized, fail-open reveal handling for dynamically inserted panels.
   Prevents invisible elements from occupying layout space when modules
   render after the legacy applyReveal() pass.
   ===================================================================== */
(() => {
  "use strict";

  const VERSION=window.KITSUNE_APP_VERSION||"2.2.1";
  const ROOT_CLASS="kitsune-reveal-ready";
  const observed=new WeakSet();
  let io=null;
  let mutation=null;
  let fallbackTimer=0;

  function reduceMotion(){
    try{return !!window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches}catch(e){return false}
  }

  function intersectsViewport(el,margin=140){
    try{
      const r=el.getBoundingClientRect();
      return r.bottom>=-margin && r.top<=window.innerHeight+margin && r.right>=0 && r.left<=window.innerWidth;
    }catch(e){return true}
  }

  function reveal(el){
    if(!el?.classList?.contains("reveal"))return;
    el.classList.add("in");
    try{io?.unobserve?.(el)}catch(e){}
  }

  function observe(el){
    if(!el?.classList?.contains("reveal")||observed.has(el))return;
    observed.add(el);

    /* Already-visible legacy content must never flash out when the manager
       enables CSS enhancement mode. */
    if(el.classList.contains("in")||reduceMotion()){
      reveal(el);return;
    }

    if(intersectsViewport(el,80)){
      reveal(el);return;
    }

    if(io){
      try{io.observe(el);return}catch(e){}
    }

    /* Fail open if IntersectionObserver is unavailable/broken. */
    reveal(el);
  }

  function scan(root=document){
    try{
      if(root?.matches?.(".reveal"))observe(root);
      root?.querySelectorAll?.(".reveal")?.forEach(observe);
    }catch(e){}
  }

  function fallbackSweep(){
    clearTimeout(fallbackTimer);
    fallbackTimer=setTimeout(()=>{
      document.querySelectorAll(".reveal:not(.in)").forEach(el=>{
        if(intersectsViewport(el,220))reveal(el);
      });
    },220);
  }

  function initObserver(){
    if("IntersectionObserver" in window && !reduceMotion()){
      io=new IntersectionObserver(entries=>{
        for(const entry of entries){
          if(entry.isIntersecting||entry.intersectionRatio>0)reveal(entry.target);
        }
      },{threshold:.01,rootMargin:"120px 0px 160px 0px"});
    }

    /* Scan first while CSS is still fail-open, then enable enhanced reveal. */
    scan(document);
    document.documentElement.classList.add(ROOT_CLASS);
    fallbackSweep();

    if("MutationObserver" in window){
      mutation=new MutationObserver(records=>{
        for(const record of records){
          for(const node of record.addedNodes||[]){
            if(node?.nodeType===1)scan(node);
          }
        }
        fallbackSweep();
      });
      mutation.observe(document.body||document.documentElement,{childList:true,subtree:true});
    }

    ["resize","orientationchange","pageshow"].forEach(type=>
      window.addEventListener(type,()=>{scan(document);fallbackSweep()},{passive:true})
    );
    document.addEventListener("visibilitychange",()=>{
      if(!document.hidden){scan(document);fallbackSweep()}
    });

    /* Defensive wrapper for all legacy renderers that still call applyReveal. */
    try{
      const legacy=window.applyReveal;
      window.applyReveal=function(){
        try{legacy?.()}catch(e){}
        scan(document);fallbackSweep();
      };
    }catch(e){}
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",initObserver,{once:true});
  else initObserver();

  window.KitsuneReveal={version:VERSION,scan,reveal,refresh:()=>{scan(document);fallbackSweep()}};
})();
