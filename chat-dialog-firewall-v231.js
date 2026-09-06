/* =====================================================================
   Kitsune v2.3.0-beta.3.6.2 · Final Chat Dialog Navigation Firewall

   Final authority loaded AFTER App Kernel and all legacy route wrappers.
   While the Kitsune dialog is open, an asynchronous reply is never allowed
   to replace the current lesson/view with Home.

   Important: lessons have NO active nav button (setActive("")), so guarding
   only the current nav view is insufficient. This firewall also captures
   the current lesson id and wraps renderHome itself.
   ===================================================================== */
(() => {
  "use strict";

  const VERSION="2.3.0-beta.3.6.2";

  let installed=false;
  let locked=false;
  let restoring=false;
  let snapshot=null;
  let mutationTimer=null;

  const originals={
    go:null,
    kernelRoute:null,
    renderHome:null
  };

  function dialogRoot(){
    return document.querySelector("#v19Dialog");
  }

  function dialogOpen(){
    const root=dialogRoot();
    return !!(
      root?.classList.contains("show") ||
      document.body.classList.contains("v19-dialog-open")
    );
  }

  function activeView(){
    return document.querySelector(".main-nav .nav-btn.active")?.dataset?.view||"";
  }

  function currentLessonId(){
    try{
      if(typeof state!=="undefined"&&state?.lastLesson){
        const title=document.querySelector("#pageTitle")?.textContent||"";
        const hasLessonUi=!!document.querySelector(
          "#content .lesson-wrap,#content .lesson,#content .exercise[data-ex],#content [data-lesson]"
        );
        if(hasLessonUi||(!activeView()&&title&&title!=="Алгебра 8")){
          return String(state.lastLesson||"");
        }
      }
    }catch{}
    return "";
  }

  function capture(){
    const view=activeView();
    snapshot={
      view,
      lessonId:currentLessonId(),
      title:document.querySelector("#pageTitle")?.textContent||"",
      capturedAt:Date.now()
    };
    locked=true;
    window.__KITSUNE_DIALOG_LOCK__={
      active:true,
      version:VERSION,
      ...snapshot
    };
  }

  function release(){
    locked=false;
    snapshot=null;
    window.__KITSUNE_DIALOG_LOCK__={
      active:false,
      version:VERSION
    };
  }

  function shouldBlockHome(){
    return locked&&dialogOpen()&&!restoring;
  }

  function blockHome(source){
    if(!shouldBlockHome())return false;
    console.warn(`[Kitsune ${VERSION}] blocked unintended Home navigation`,{
      source,
      snapshot
    });
    return true;
  }

  function installWrappers(){
    if(typeof window.go==="function"&&!window.go.__kitsuneDialogFirewall362){
      originals.go=window.go;
      const wrapped=function(view,...args){
        if(String(view||"")==="home"&&blockHome("window.go"))return;
        return originals.go.call(this,view,...args);
      };
      wrapped.__kitsuneDialogFirewall362=true;
      window.go=wrapped;
    }

    if(window.KitsuneAppKernel?.route &&
       !window.KitsuneAppKernel.route.__kitsuneDialogFirewall362){
      originals.kernelRoute=window.KitsuneAppKernel.route.bind(window.KitsuneAppKernel);
      const wrapped=function(view,...args){
        if(String(view||"")==="home"&&blockHome("KitsuneAppKernel.route"))return;
        return originals.kernelRoute(view,...args);
      };
      wrapped.__kitsuneDialogFirewall362=true;
      window.KitsuneAppKernel.route=wrapped;
    }

    if(typeof window.renderHome==="function" &&
       !window.renderHome.__kitsuneDialogFirewall362){
      originals.renderHome=window.renderHome;
      const wrapped=function(...args){
        if(blockHome("renderHome"))return;
        return originals.renderHome.apply(this,args);
      };
      wrapped.__kitsuneDialogFirewall362=true;
      window.renderHome=wrapped;
    }
  }

  function restoreSnapshot(){
    if(!locked||!snapshot||restoring||!dialogOpen())return;

    const nowView=activeView();
    const pageTitle=document.querySelector("#pageTitle")?.textContent||"";
    const looksHome=
      nowView==="home" ||
      (
        pageTitle==="Алгебра 8" &&
        !!document.querySelector("#heroRing,#continueCard,#homeTopics")
      );

    if(!looksHome)return;

    restoring=true;
    try{
      if(snapshot.lessonId&&typeof window.openLesson==="function"){
        window.openLesson(snapshot.lessonId);
      }else if(snapshot.view&&snapshot.view!=="home"){
        const route=
          originals.kernelRoute ||
          originals.go ||
          window.KitsuneAppKernel?.route ||
          window.go;
        route?.(snapshot.view);
      }
      console.warn(`[Kitsune ${VERSION}] restored dialog context`,snapshot);
    }catch(error){
      console.error(`[Kitsune ${VERSION}] context restore failed`,error);
    }finally{
      setTimeout(()=>{restoring=false},0);
    }
  }

  function scheduleIntegrityCheck(){
    if(!locked||mutationTimer)return;
    mutationTimer=setTimeout(()=>{
      mutationTimer=null;
      restoreSnapshot();
    },0);
  }

  function onDialogState(){
    installWrappers();

    if(dialogOpen()){
      if(!locked)capture();
    }else if(locked){
      release();
    }
  }

  document.addEventListener("click",event=>{
    if(!dialogOpen())return;

    const root=dialogRoot();
    if(root?.contains(event.target))return;

    const nav=event.target.closest?.('[data-view],[data-view-jump]');
    if(nav){
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    }
  },true);

  window.addEventListener("popstate",event=>{
    if(!dialogOpen())return;
    const view=new URLSearchParams(location.search).get("view");
    if(view==="home"){
      event.stopImmediatePropagation?.();
      scheduleIntegrityCheck();
    }
  },true);

  const observer=new MutationObserver(()=>{
    onDialogState();
    scheduleIntegrityCheck();
  });

  function init(){
    installWrappers();
    observer.observe(document.body,{
      subtree:true,
      childList:true,
      attributes:true,
      attributeFilter:["class"]
    });
    onDialogState();
    installed=true;
  }

  window.KitsuneDialogFirewall={
    version:VERSION,
    installed:()=>installed,
    locked:()=>locked,
    snapshot:()=>snapshot?{...snapshot}:null,
    check:restoreSnapshot
  };

  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",init,{once:true});
  }else{
    init();
  }
})();
