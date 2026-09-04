
/* =====================================================================
   v2.2.0 · CHILD SAFETY BOOTSTRAP
   Privacy First: no external analytics.
   ===================================================================== */
(() => {
  "use strict";

  try{
    document.documentElement.dataset.design=localStorage.getItem("a8_design_mode")||"playful";
  }catch(e){
    document.documentElement.dataset.design="playful";
  }

  const APP_VERSION=
    document.querySelector('meta[name="kitsune-app-version"]')?.content||"2.2.0";
  window.KITSUNE_APP_VERSION=APP_VERSION;

  window.__KITSUNE_CHILD_SAFE__={
    version:APP_VERSION,
    analytics:false
  };

  /* Defense-in-depth against casual embedding/clickjacking on the very first
     load before the service worker can add X-Frame-Options/CSP headers. */
  try{
    if(window.top!==window.self){
      document.documentElement.style.display="none";
      document.addEventListener("DOMContentLoaded",()=>{
        document.body.innerHTML=`
          <main style="font-family:system-ui,sans-serif;max-width:680px;margin:12vh auto;padding:24px">
            <h1>🔒 Kitsune защищён</h1>
            <p>Курс нельзя открывать внутри чужого сайта. Открой его напрямую.</p>
          </main>`;
        document.documentElement.style.display="";
      },{once:true});
    }
  }catch(e){}
})();
