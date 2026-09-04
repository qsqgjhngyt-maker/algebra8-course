
/* =====================================================================
   Kitsune App Kernel v2.1.0
   Final navigation authority. Loaded after all legacy route modules.
   ===================================================================== */
(() => {
  "use strict";
  const VERSION=window.KITSUNE_APP_VERSION||"2.1.0";
  const legacyGo=typeof window.go==="function"?window.go:null;

  function closeMobileSidebar(){
    try{
      document.querySelector("#sidebar")?.classList.remove("open");
      document.body.classList.remove("sidebar-mobile-open");
      document.querySelector("#sidebarScrim")?.setAttribute("aria-hidden","true");
    }catch(e){}
  }

  function route(view){
    switch(String(view||"")){
      case "home": return typeof renderHome==="function"?renderHome():legacyGo?.(view);
      case "course": return typeof renderCourse==="function"?renderCourse():legacyGo?.(view);
      case "trainer": return typeof renderTrainer==="function"?renderTrainer():legacyGo?.(view);
      case "mathlab": return window.KitsuneMathLab?.open?.()||window.renderMathLab?.();
      case "route": return window.KitsuneLearning?.render?.();
      case "search": return window.KitsuneCourseSearch?.render?.();
      case "offline": return window.KitsuneOffline?.render?.();
      case "chapterfinal":
        if(typeof renderChapterFinal==="function")return renderChapterFinal();
        if(typeof v1RenderChapterFinal==="function")return v1RenderChapterFinal(1,"test");
        return legacyGo?.(view);
      case "mastery": return typeof renderMastery==="function"?renderMastery():legacyGo?.(view);
      case "mistakes": return typeof renderMistakes==="function"?renderMistakes():legacyGo?.(view);
      case "progress": return typeof renderProgress==="function"?renderProgress():legacyGo?.(view);
      default: return legacyGo?.(view);
    }
  }

  window.go=route;
  window.KitsuneAppKernel={version:VERSION,route};

  document.addEventListener("click",e=>{
    if(e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;
    const target=e.target.closest?.("[data-view],[data-view-jump]");
    if(!target)return;
    const view=target.dataset.view||target.dataset.viewJump;
    if(!view)return;

    /* Document-capture authority prevents later/legacy go() wrappers from
       swallowing a route. This is intentionally the single final router. */
    e.preventDefault();
    e.stopImmediatePropagation();
    closeMobileSidebar();
    route(view);
  },true);

  window.addEventListener("popstate",()=>{
    const view=new URLSearchParams(location.search).get("view");
    if(view)route(view);
  });
})();
