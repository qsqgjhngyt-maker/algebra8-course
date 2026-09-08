/* =====================================================================
   Kitsune Runtime Loader v2.3.0-beta.3.9.5 · STABLE LAZY ROUTING

   Critical rule: this file is loaded BEFORE app-kernel-v200.js, so its
   capture handler can prepare a lazy module before the final router consumes
   the click. This removes the old “first click does nothing, second works”.
   ===================================================================== */
(() => {
  "use strict";

  const VERSION="2.3.0-beta.3.9.5";
  const loaded=new Set();
  const pending=new Map();

  const groups={
    mathlab:[
      "./math-lab-v130.js?v=2.2.3",
      "./camera-import-v210.js?v=2.2.3"
    ],
    search:["./course-search-v200.js?v=2.2.3"],
    offline:["./offline-center-v200.js?v=2.3.0-alpha"],
    progress:[
      "./mastery-score-v220.js?v=2.3.0-alpha",
      "./reliability-center-v220.js?v=2.3.0-alpha"
    ],
    privacy:["./privacy-v1111.js?v=2.3.0-beta"],
    cloud:[
      "./cloud-config-v230.js?v=2.3.0-alpha.2",
      "./hybrid-infrastructure-v230.js?v=2.3.0-beta.3.7.2",
      "./access-admin-v235.js?v=2.3.0-beta.3.6.2"
    ],
    assistant:[
      /* Dependency order from the confirmed 3.8.7 stack. */
      "./neural-voice-v17.js?v=2.2.3",
      "./kitsune-brain-v18.js?v=2.3.0-beta",
      "./kitsune-voice-v19.js?v=2.3.0-beta",
      "./kitsune-live-v110.js?v=2.2.3",
      "./privacy-v1111.js?v=2.3.0-beta",
      "./cloud-config-v230.js?v=2.3.0-alpha.2",
      "./hybrid-infrastructure-v230.js?v=2.3.0-beta.3.7.2",
      "./access-admin-v235.js?v=2.3.0-beta.3.6.2",
      "./intelligence-router-v230.js?v=2.3.0-beta.3.3",
      "./cloud-chat-ux-v231.js?v=2.3.0-beta.3.3",
      "./local-voice-lab-v231.js?v=2.3.0-beta.3.3",
      "./voice-conversation-v237.js?v=2.3.0-beta.3.7.2",
      "./kitsune-presence-v238.js?v=2.3.0-beta.3.8.1",
      "./voice-stability-v2387.js?v=2.3.0-beta.3.8.7",
      "./chat-dialog-firewall-v231.js?v=2.3.0-beta.3.6.2"
    ]
  };

  function markExisting(){
    document.querySelectorAll("script[src]").forEach(script=>{
      try{loaded.add(new URL(script.src,location.href).href)}catch{}
    });
  }

  function profile(){
    try{return window.KitsunePerformance?.info?.()?.profile||"full"}
    catch{return /iPhone|iPad|iPod|Android|Mobile/i.test(navigator.userAgent||"")?"careful":"full"}
  }

  function isFull(){return profile()==="full"}

  function yieldToBrowser(ms=35){
    return new Promise(resolve=>{
      if("requestIdleCallback" in window){
        requestIdleCallback(()=>setTimeout(resolve,ms),{timeout:700});
      }else setTimeout(resolve,ms);
    });
  }

  function loadScript(src){
    const href=new URL(src,location.href).href;
    if(loaded.has(href))return Promise.resolve(true);
    if(pending.has(href))return pending.get(href);

    const promise=new Promise((resolve,reject)=>{
      const script=document.createElement("script");
      script.src=src;
      script.async=false;
      script.dataset.kitsuneRuntime="2395";
      script.onload=()=>{
        loaded.add(href);
        pending.delete(href);
        resolve(true);
      };
      script.onerror=()=>{
        pending.delete(href);
        reject(new Error("Не удалось загрузить модуль: "+src));
      };
      document.body.appendChild(script);
    });
    pending.set(href,promise);
    return promise;
  }

  async function ensureGroup(name,{urgent=false,reason="manual",background=false}={}){
    const list=groups[name];
    if(!list)throw new Error("Unknown runtime group: "+name);
    if(groupReady(name))return true;
    if(pending.has("group:"+name))return pending.get("group:"+name);

    const promise=(async()=>{
      for(const src of list){
        await loadScript(src);
        await yieldToBrowser(urgent?8:(isFull()?30:85));
      }
      try{
        window.dispatchEvent(new CustomEvent("kitsune-runtime-group-loaded",{
          detail:{group:name,version:VERSION,reason,background:!!background}
        }));
      }catch{}
      return true;
    })();

    pending.set("group:"+name,promise);
    try{return await promise}
    finally{pending.delete("group:"+name)}
  }

  function groupReady(name){
    const list=groups[name]||[];
    return list.length>0&&list.every(src=>loaded.has(new URL(src,location.href).href));
  }

  function routeGroup(view){
    if(view==="mathlab")return "mathlab";
    if(view==="search")return "search";
    if(view==="offline")return "offline";
    if(["mastery","progress","mistakes","adult"].includes(view))return "progress";
    return "";
  }

  function closeMobileSidebar(){
    try{
      document.querySelector("#sidebar")?.classList.remove("open");
      document.body.classList.remove("sidebar-mobile-open");
      document.querySelector("#sidebarScrim")?.setAttribute("aria-hidden","true");
    }catch{}
  }

  async function prepareAndRoute(target,view,group){
    target?.setAttribute("aria-busy","true");
    target?.classList.add("kitsune-runtime-loading");
    try{
      await ensureGroup(group,{urgent:true,reason:"navigation:"+view,background:false});
      closeMobileSidebar();
      const kernel=window.KitsuneAppKernel;
      if(kernel?.route)return kernel.route(view);
      if(typeof window.go==="function")return window.go(view);
      throw new Error("Навигация ещё не готова");
    }catch(error){
      console.error("[Kitsune runtime]",error);
      try{window.KitsuneRuntimeStability?.toast?.(error?.message||String(error))}catch{}
    }finally{
      target?.removeAttribute("aria-busy");
      target?.classList.remove("kitsune-runtime-loading");
    }
  }

  /* This listener must be registered before App Kernel's capture listener. */
  document.addEventListener("click",event=>{
    if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    const target=event.target.closest?.("[data-view],[data-view-jump]");
    if(!target)return;
    if(target.closest?.(".v173-inline-tutor,.v16-tutor-btn,.v173-alfi-shortcut"))return;

    const view=target.dataset.view||target.dataset.viewJump||"";
    const group=routeGroup(view);
    if(!group||groupReady(group))return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    prepareAndRoute(target,view,group);
  },true);

  document.addEventListener("pointerdown",event=>{
    const target=event.target.closest?.("[data-view],[data-view-jump]");
    if(!target)return;
    const group=routeGroup(target.dataset.view||target.dataset.viewJump||"");
    if(group&&!groupReady(group)){
      ensureGroup(group,{urgent:true,reason:"pointer-prewarm",background:false}).catch(()=>{});
    }
  },{capture:true,passive:true});

  function schedule(fn,delay){
    setTimeout(()=>{
      if(document.hidden){schedule(fn,1600);return}
      if("requestIdleCallback" in window)requestIdleCallback(()=>fn(),{timeout:2000});
      else fn();
    },delay);
  }

  markExisting();

  window.addEventListener("load",()=>{
    /* On constrained devices: absolutely no background assistant/model stack.
       Everything remains available and loads on the first explicit action. */
    if(!isFull())return;

    /* Strong devices retain the convenient zero-config experience. */
    schedule(()=>ensureGroup("assistant",{reason:"full-device-prewarm",background:true}).catch(()=>{}),850);
    schedule(()=>ensureGroup("mathlab",{reason:"full-device-prewarm",background:true}).catch(()=>{}),1450);
    schedule(async()=>{
      for(const name of ["progress","search","offline"]){
        await ensureGroup(name,{reason:"full-device-idle",background:true}).catch(()=>{});
        await yieldToBrowser(100);
      }
    },5200);
  },{once:true});

  window.KitsuneRuntimeLoader={
    version:VERSION,
    ensure:ensureGroup,
    ready:groupReady,
    groups:()=>Object.keys(groups),
    profile
  };
})();
