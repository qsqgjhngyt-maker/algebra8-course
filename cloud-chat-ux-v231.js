/* Kitsune v2.3.0-beta.3.2 · Cloud route visibility in chat */
(() => {
  "use strict";
  const VERSION="2.3.0-beta.3.2";
  let current={route:"local",detail:""};

  const LABELS={
    cloud:["☁️ Qwen Cloud","cloud"],
    math:["🧮 Math Engine","math"],
    course:["📚 Tutor курса","course"],
    local:["🧠 Локально","local"],
    "local-fallback":["⚠️ Cloud → локально","fallback"],
    safety:["🛡️ Safety Guard","local"]
  };

  function style(){
    if(document.querySelector("#v231CloudUxStyle"))return;
    const s=document.createElement("style");
    s.id="v231CloudUxStyle";
    s.textContent=`
      .v231-route-chip{display:inline-flex;align-items:center;gap:4px;padding:4px 7px;border:1px solid var(--line);
        border-radius:999px;font-size:8px;font-weight:950;white-space:nowrap;background:var(--card);color:var(--muted)}
      .v231-route-chip.cloud{color:#16803e;border-color:color-mix(in srgb,#29a95a 35%,var(--line));background:color-mix(in srgb,#29a95a 8%,var(--card))}
      .v231-route-chip.math{color:var(--primary)}
      .v231-route-chip.fallback{color:#a86c00}
      @media(max-width:620px){.v231-route-chip{font-size:7.5px;padding:3px 6px}}
    `;
    document.head.appendChild(s);
  }

  function ensure(){
    style();
    const head=document.querySelector("#v19Dialog .v19-dialog-head");
    if(!head)return;
    let chip=head.querySelector("#v231RouteChip");
    if(!chip){
      chip=document.createElement("span");
      chip.id="v231RouteChip";
      chip.className="v231-route-chip local";
      const close=head.querySelector(".v19-dialog-close");
      head.insertBefore(chip,close||null);
    }
    render();
  }

  function render(){
    const chip=document.querySelector("#v231RouteChip");
    if(!chip)return;
    const pair=LABELS[current.route]||["🧠 Локально","local"];
    if(chip.textContent!==pair[0])chip.textContent=pair[0];
    chip.className=`v231-route-chip ${pair[1]}`;
    chip.title=current.detail||"";
  }

  window.addEventListener("kitsune-intelligence-route",event=>{
    current={...current,...(event.detail||{})};
    ensure();render();
  });

  new MutationObserver(()=>ensure()).observe(document.body,{childList:true,subtree:true});
  setTimeout(ensure,250);
  window.KitsuneCloudChatUX={version:VERSION,status:()=>({...current})};
})();
