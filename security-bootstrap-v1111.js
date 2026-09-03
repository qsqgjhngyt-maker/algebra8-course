
/* =====================================================================
   v1.11.1 · CHILD SAFETY BOOTSTRAP
   Runs before the app. No analytics/network activity is started here.
   ===================================================================== */
(() => {
  "use strict";

  const OWNER_KEY="a8_analytics_owner_optout";
  const CONSENT_KEY="a8_analytics_consent_v1111";

  try{
    document.documentElement.dataset.design=localStorage.getItem("a8_design_mode")||"playful";
  }catch(e){
    document.documentElement.dataset.design="playful";
  }

  /* Owner test-device opt-out remains supported. */
  try{
    const u=new URL(location.href);
    const v=u.searchParams.get("kitsune_owner");
    if(v==="1")localStorage.setItem(OWNER_KEY,"1");
    if(v==="0")localStorage.removeItem(OWNER_KEY);
    if(v==="1"||v==="0"){
      u.searchParams.delete("kitsune_owner");
      history.replaceState(history.state,"",u.pathname+(u.search||"")+(u.hash||""));
    }
  }catch(e){}

  function analyticsAllowed(){
    try{
      return localStorage.getItem(CONSENT_KEY)==="1" &&
             localStorage.getItem(OWNER_KEY)!=="1";
    }catch(e){
      return false;
    }
  }

  /* Used by Umami if/when the adult explicitly enables analytics. */
  window.kitsuneAnalyticsBeforeSend=(type,payload)=>{
    return analyticsAllowed()?payload:false;
  };

  window.__KITSUNE_CHILD_SAFE__={
    version:"1.11.3",
    analyticsAllowed,
    consentKey:CONSENT_KEY,
    ownerKey:OWNER_KEY
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
