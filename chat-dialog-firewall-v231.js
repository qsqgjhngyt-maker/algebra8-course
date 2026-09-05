/* Kitsune v2.3.0-beta.3.2 · Chat Dialog Navigation Firewall */
(() => {
  "use strict";
  const VERSION="2.3.0-beta.3.2";
  const TYPES=["click","pointerup","pointerdown","touchend","submit","keydown"];

  function bind(dialog){
    if(!dialog || dialog.dataset.v231Firewall===VERSION)return;
    dialog.dataset.v231Firewall=VERSION;

    TYPES.forEach(type=>{
      dialog.addEventListener(type,event=>{
        /* Internal control handlers run first. Stop only before the event reaches
           document/app-level navigation listeners. */
        event.stopPropagation();
      },false);
    });
  }

  function install(){ bind(document.querySelector("#v19Dialog")); }

  let scheduled=false;
  const observer=new MutationObserver(()=>{
    if(scheduled)return;
    scheduled=true;
    requestAnimationFrame(()=>{scheduled=false;install();});
  });
  observer.observe(document.body,{childList:true,subtree:true});
  install();

  window.KitsuneChatDialogFirewall={version:VERSION,install};
})();
