/* =====================================================================
   Kitsune Runtime Loader v2.3.0-beta.3.9.2 · PROGRESSIVE MODULES

   The course shell/tutor load immediately. Optional tools and the full
   assistant stack load later in small ordered slices, or immediately when
   the user asks for that feature.
   ===================================================================== */
(() => {
  "use strict";

  const VERSION="2.3.0-beta.3.9.2";
  const loaded=new Set();
  const pending=new Map();

  const groups={
    mathlab:[
      "./math-lab-v130.js?v=2.2.3",
      "./camera-import-v210.js?v=2.2.3"
    ],
    search:[
      "./course-search-v200.js?v=2.2.3"
    ],
    offline:[
      "./offline-center-v200.js?v=2.3.0-alpha"
    ],
    progress:[
      "./mastery-score-v220.js?v=2.3.0-alpha",
      "./reliability-center-v220.js?v=2.3.0-alpha"
    ],
    assistant:[
      /* Original dependency order preserved. */
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
      try{
        loaded.add(new URL(script.src,location.href).href);
      }catch{}
    });
  }

  function isCareful(){
    try{
      const info=window.KitsunePerformance?.info?.();
      return info?.profile==="careful"||info?.profile==="emergency"||info?.ios;
    }catch{
      return /iPhone|iPad|iPod|Android|Mobile/i.test(navigator.userAgent||"");
    }
  }

  function yieldToBrowser(ms=40){
    return new Promise(resolve=>{
      if("requestIdleCallback" in window){
        requestIdleCallback(()=>setTimeout(resolve,ms),{timeout:600});
      }else{
        setTimeout(resolve,ms);
      }
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
      script.dataset.kitsuneRuntime="2392";
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

  async function ensureGroup(name,{urgent=false}={}){
    const list=groups[name];
    if(!list)throw new Error("Unknown runtime group: "+name);

    if(pending.has("group:"+name))return pending.get("group:"+name);

    const promise=(async()=>{
      for(const src of list){
        await loadScript(src);
        await yieldToBrowser(urgent?10:(isCareful()?95:45));
      }

      try{
        window.dispatchEvent(new CustomEvent("kitsune-runtime-group-loaded",{
          detail:{group:name,version:VERSION}
        }));
      }catch{}

      return true;
    })();

    pending.set("group:"+name,promise);

    try{
      return await promise;
    }finally{
      pending.delete("group:"+name);
    }
  }

  function groupReady(name){
    const list=groups[name]||[];
    return list.every(src=>loaded.has(new URL(src,location.href).href));
  }

  function requiredGroupForElement(el){
    const target=el?.closest?.("[data-view],[data-view-jump],button,a");
    if(!target)return "";

    const view=target.dataset?.view||target.dataset?.viewJump||"";
    if(view==="mathlab")return "mathlab";
    if(view==="search")return "search";
    if(view==="offline")return "offline";
    if(["mastery","progress","mistakes","route","chapterfinal"].includes(view))return "progress";

    return "";
  }

  async function replayAfterLoad(target,group){
    if(!target?.isConnected)return;

    target.setAttribute("aria-busy","true");
    target.classList.add("kitsune-runtime-loading");

    try{
      await ensureGroup(group,{urgent:true});
      target.dataset.kitsuneRuntimeReplay="1";
      target.click();
      delete target.dataset.kitsuneRuntimeReplay;
    }finally{
      target.removeAttribute("aria-busy");
      target.classList.remove("kitsune-runtime-loading");
    }
  }

  /* Feature navigation is the only place we delay a click. Normal course,
     lessons, checking and inline Tutor are never intercepted. */
  document.addEventListener("click",event=>{
    const target=event.target.closest?.("[data-view],[data-view-jump],button,a");
    if(!target||target.dataset.kitsuneRuntimeReplay==="1")return;

    const group=requiredGroupForElement(target);
    if(!group||groupReady(group))return;

    event.preventDefault();
    event.stopImmediatePropagation();
    replayAfterLoad(target,group).catch(()=>{});
  },true);

  /* Pointer-down prewarm often finishes before the click handler is needed. */
  document.addEventListener("pointerdown",event=>{
    const group=requiredGroupForElement(event.target);
    if(group&&!groupReady(group)){
      ensureGroup(group,{urgent:true}).catch(()=>{});
    }
  },{capture:true,passive:true});

  function schedule(fn,delay){
    setTimeout(()=>{
      if(document.hidden){
        schedule(fn,1500);
        return;
      }
      if("requestIdleCallback" in window){
        requestIdleCallback(()=>fn(),{timeout:1800});
      }else{
        fn();
      }
    },delay);
  }

  markExisting();

  window.addEventListener("load",()=>{
    /*
     * Full assistant UI/animated Kitsune still arrives automatically, but
     * after the course has painted instead of blocking the first screen.
     */
    schedule(
      ()=>ensureGroup("assistant").catch(()=>{}),
      isCareful()?2300:1100
    );

    /*
     * On strong devices, warm optional screens in the background. On careful
     * devices they stay truly on-demand to preserve RAM.
     */
    if(!isCareful()){
      schedule(async()=>{
        for(const name of ["progress","search","offline","mathlab"]){
          await ensureGroup(name).catch(()=>{});
          await yieldToBrowser(120);
        }
      },5200);
    }
  },{once:true});

  window.KitsuneRuntimeLoader={
    version:VERSION,
    ensure:ensureGroup,
    ready:groupReady,
    groups:()=>Object.keys(groups)
  };
})();
