/* =====================================================================
   Kitsune v2.3.0-beta.3.8 · IN-APP WAKE PHRASE + COLLAPSIBLE LIVE MASCOT

   - keeps the original animated Kitsune;
   - adds a compact edge-docked state so the mascot does not cover lessons;
   - compact state is draggable and snaps to the nearest screen edge;
   - "Привет, Китсуне" works only while this app is visible/open;
   - wake detection is fully local and uses a personalized lightweight
     acoustic template (3 enrollment samples), not cloud speech recognition;
   - after wake: stop wake mic -> open dialogue -> local Whisper handles
     the actual question -> existing Router/Brain -> existing local TTS;
   - wake listener is paused while dialog/speech is active and in background.
   ===================================================================== */
(() => {
  "use strict";

  const VERSION="2.3.0-beta.3.8";

  const COLLAPSED_KEY="a8_kitsune_collapsed_v238";
  const POSITION_KEY="a8_kitsune_dock_v238";
  const WAKE_ENABLED_KEY="a8_kitsune_wake_enabled_v238";
  const WAKE_PROFILE_KEY="a8_kitsune_wake_profile_v238";

  const WAKE_PHRASE="Привет, Китсуне";
  const TARGET_RATE=8000;
  const MAX_UTTERANCE_MS=3600;
  const MIN_UTTERANCE_MS=500;
  const END_SILENCE_MS=520;
  const WAKE_COOLDOWN_MS=4500;
  const ENROLL_SAMPLES=3;

  let installed=false;
  let root=null;
  let mascot=null;
  let collapseBtn=null;
  let wakeIndicator=null;

  let collapsed=readBool(COLLAPSED_KEY,false);
  let dockState=loadJson(POSITION_KEY,{side:"right",ratio:.72});
  let restoreCollapsedAfterDialog=false;
  let dialogWasOpen=false;
  let drag=null;
  let suppressClickUntil=0;

  let wakeEnabled=readBool(WAKE_ENABLED_KEY,false);
  let wakeProfile=loadJson(WAKE_PROFILE_KEY,null);
  let wakeMode="idle"; // idle | listening | enrolling | waking | paused | error
  let wakeStream=null;
  let wakeCtx=null;
  let wakeSource=null;
  let wakeProcessor=null;
  let wakeMute=null;
  let wakeListening=false;
  let wakeRestartTimer=null;
  let wakeCooldownUntil=0;

  let preRoll=[];
  let utteranceChunks=[];
  let utteranceStart=0;
  let lastLoudAt=0;
  let capturing=false;
  let hotChunks=0;
  let noiseFloor=.006;

  let enrollActive=false;
  let enrollTemplates=[];
  let enrollResolve=null;
  let enrollReject=null;

  function loadJson(key,fallback){
    try{
      const value=JSON.parse(localStorage.getItem(key)||"null");
      return value&&typeof value==="object"?value:fallback;
    }catch{return fallback}
  }

  function saveJson(key,value){
    try{localStorage.setItem(key,JSON.stringify(value))}catch{}
  }

  function readBool(key,fallback){
    try{
      const raw=localStorage.getItem(key);
      return raw===null?fallback:raw==="1";
    }catch{return fallback}
  }

  function writeBool(key,value){
    try{localStorage.setItem(key,value?"1":"0")}catch{}
  }

  function clamp(v,min,max){
    return Math.max(min,Math.min(max,v));
  }

  function dialogOpen(){
    return !!(
      document.querySelector("#v19Dialog")?.classList.contains("show") ||
      document.body.classList.contains("v19-dialog-open")
    );
  }

  function isSpeaking(){
    return !!(
      window.KitsuneLiveConversation?.speaking?.() ||
      window.KitsuneLive?.isSpeaking?.() ||
      document.querySelector("#v15SpeakBtn")?.classList.contains("speaking")
    );
  }

  function safeInsets(){
    // env(safe-area-inset-*) is resolved by CSS; JS uses conservative px.
    const mobile=Math.min(innerWidth,innerHeight)<720;
    return {left:mobile?8:12,right:mobile?8:12,top:mobile?8:12,bottom:mobile?10:14};
  }

  function currentViewport(){
    const vv=window.visualViewport;
    return {
      width:Math.max(240,vv?.width||innerWidth||360),
      height:Math.max(320,vv?.height||innerHeight||640),
      offsetLeft:vv?.offsetLeft||0,
      offsetTop:vv?.offsetTop||0
    };
  }

  function normalizedDock(state=dockState){
    const side=state?.side==="left"?"left":"right";
    const ratio=clamp(Number(state?.ratio)||.72,.10,.90);
    return {side,ratio};
  }

  function saveDock(){
    dockState=normalizedDock(dockState);
    saveJson(POSITION_KEY,dockState);
  }

  function setLiveState(name){
    try{window.KitsuneLive?.setState?.(name)}catch{}
  }

  function injectStyle(){
    if(document.querySelector("#v238PresenceStyle"))return;
    const style=document.createElement("style");
    style.id="v238PresenceStyle";
    style.textContent=`
      #v15Assistant{
        --v238-safe-left:max(8px,env(safe-area-inset-left));
        --v238-safe-right:max(8px,env(safe-area-inset-right));
        --v238-safe-top:max(8px,env(safe-area-inset-top));
        --v238-safe-bottom:max(10px,env(safe-area-inset-bottom));
      }

      #v238CollapseBtn{
        position:absolute;
        z-index:12;
        right:3px;
        top:0;
        width:30px;
        height:30px;
        display:grid;
        place-items:center;
        padding:0;
        border:1px solid color-mix(in srgb,var(--line) 72%,transparent);
        border-radius:999px;
        background:color-mix(in srgb,var(--card) 90%,transparent);
        color:var(--muted);
        box-shadow:0 4px 14px rgba(0,0,0,.09);
        pointer-events:auto;
        cursor:pointer;
        font:900 16px/1 system-ui,sans-serif;
        backdrop-filter:blur(8px);
        -webkit-tap-highlight-color:transparent;
        transition:transform .16s ease,opacity .16s ease;
      }
      #v238CollapseBtn:hover{transform:scale(1.06)}
      #v15Assistant.open #v238CollapseBtn{opacity:.38;pointer-events:none}

      #v238WakeIndicator{
        position:absolute;
        z-index:13;
        right:1px;
        bottom:-3px;
        min-width:28px;
        height:28px;
        display:none;
        place-items:center;
        padding:0 7px;
        border:1px solid color-mix(in srgb,#38a169 38%,var(--line));
        border-radius:999px;
        background:color-mix(in srgb,var(--card) 94%,transparent);
        color:#23824f;
        box-shadow:0 5px 16px rgba(0,0,0,.10);
        font:900 11px/1 system-ui,sans-serif;
        pointer-events:none;
        backdrop-filter:blur(8px);
      }
      #v238WakeIndicator.show{display:grid}
      #v238WakeIndicator[data-state="listening"]{
        animation:v238MicPulse 1.45s ease-in-out infinite;
      }
      #v238WakeIndicator[data-state="paused"]{color:var(--muted);opacity:.72}
      #v238WakeIndicator[data-state="error"]{color:#b54747;border-color:#e8b3b3}
      @keyframes v238MicPulse{
        0%,100%{transform:scale(1);box-shadow:0 5px 16px rgba(0,0,0,.10)}
        50%{transform:scale(1.08);box-shadow:0 5px 20px rgba(56,161,105,.24)}
      }

      /* Compact mode keeps the SAME animated mascot; only its container shrinks. */
      #v15Assistant.v238-collapsed{
        width:64px!important;
        height:78px!important;
        margin:0!important;
        right:auto!important;
        bottom:auto!important;
        user-select:none;
        touch-action:none;
        overflow:visible;
        transition:left .24s cubic-bezier(.2,.8,.2,1),top .24s cubic-bezier(.2,.8,.2,1);
      }
      #v15Assistant.v238-collapsed.v238-dragging{transition:none!important}
      #v15Assistant.v238-collapsed .v15-speech,
      #v15Assistant.v238-collapsed .v15-tip-chip,
      #v15Assistant.v238-collapsed .v15-streak-pop,
      #v15Assistant.v238-collapsed .v15-status-dot,
      #v15Assistant.v238-collapsed #v238CollapseBtn{
        display:none!important;
      }
      #v15Assistant.v238-collapsed .v15-mascot-button{
        width:128px!important;
        height:152px!important;
        right:0!important;
        bottom:0!important;
        transform:scale(.49)!important;
        transform-origin:100% 100%!important;
        filter:drop-shadow(0 8px 13px rgba(29,45,31,.19))!important;
        cursor:grab;
      }
      #v15Assistant.v238-collapsed[data-v238-side="left"] .v15-mascot-button{
        right:auto!important;
        left:0!important;
        transform-origin:0 100%!important;
      }
      #v15Assistant.v238-collapsed.v238-dragging .v15-mascot-button{
        cursor:grabbing;
        filter:drop-shadow(0 11px 18px rgba(29,45,31,.24))!important;
      }
      #v15Assistant.v238-collapsed #v238WakeIndicator{
        right:-1px;
        bottom:1px;
      }
      #v15Assistant.v238-collapsed[data-v238-side="left"] #v238WakeIndicator{
        right:auto;
        left:-1px;
      }

      /* In dialog mode Kitsune peeks above the sheet and remains animated. */
      body.v19-dialog-open #v15Assistant.v238-dialog-mascot{
        display:block!important;
        z-index:10040!important;
        width:140px!important;
        height:164px!important;
        pointer-events:none!important;
        transition:bottom .18s ease,right .18s ease,transform .18s ease!important;
        transform:scale(.52);
        transform-origin:100% 100%;
      }
      body.v19-dialog-open #v15Assistant.v238-dialog-mascot .v15-mascot-button{
        pointer-events:none!important;
      }
      html[data-design="classic"] body.v19-dialog-open #v15Assistant.v238-dialog-mascot{
        display:none!important;
      }
      body.v19-dialog-open #v15Assistant.v238-dialog-mascot .v15-speech,
      body.v19-dialog-open #v15Assistant.v238-dialog-mascot .v15-tip-chip,
      body.v19-dialog-open #v15Assistant.v238-dialog-mascot .v15-streak-pop,
      body.v19-dialog-open #v15Assistant.v238-dialog-mascot .v15-status-dot,
      body.v19-dialog-open #v15Assistant.v238-dialog-mascot #v238CollapseBtn,
      body.v19-dialog-open #v15Assistant.v238-dialog-mascot #v238WakeIndicator{
        display:none!important;
      }

      .v238-settings{
        margin-top:10px;
        padding:10px;
        border:1px solid var(--line);
        border-radius:14px;
        background:color-mix(in srgb,var(--card) 94%,var(--primary) 6%);
      }
      .v238-settings-head{
        display:flex;
        align-items:center;
        gap:8px;
        margin-bottom:7px;
      }
      .v238-settings-head>div{flex:1;min-width:0}
      .v238-settings-head strong{display:block;font-size:12px}
      .v238-settings-head small{display:block;margin-top:2px;color:var(--muted);font-size:9px}
      .v238-switch{
        display:flex;
        align-items:center;
        gap:6px;
        font-size:10px;
        font-weight:850;
        cursor:pointer;
      }
      .v238-wake-status{
        margin:7px 0;
        padding:7px 8px;
        border-radius:10px;
        background:var(--bg);
        color:var(--muted);
        font-size:10px;
        line-height:1.35;
      }
      .v238-wake-status[data-kind="ok"]{color:var(--good)}
      .v238-wake-status[data-kind="warn"]{color:#a66a00}
      .v238-wake-status[data-kind="listening"]{color:#23824f}
      .v238-actions{display:flex;flex-wrap:wrap;gap:7px}
      .v238-actions button{font-size:10px;padding:6px 8px}
      .v238-note{
        margin:7px 0 0;
        color:var(--muted);
        font-size:9px;
        line-height:1.35;
      }

      @media(max-width:620px){
        #v15Assistant.v238-collapsed{
          width:58px!important;
          height:70px!important;
        }
        #v15Assistant.v238-collapsed .v15-mascot-button{
          transform:scale(.44)!important;
        }
        body.v19-dialog-open #v15Assistant.v238-dialog-mascot{
          transform:scale(.45);
        }
      }

      @media(prefers-reduced-motion:reduce){
        #v15Assistant.v238-collapsed,
        #v238WakeIndicator{transition:none!important;animation:none!important}
      }
    `;
    document.head.appendChild(style);
  }

  function ensureControls(){
    root=document.querySelector("#v15Assistant");
    mascot=document.querySelector("#v15MascotBtn");
    if(!root||!mascot)return false;

    if(!document.querySelector("#v238CollapseBtn")){
      collapseBtn=document.createElement("button");
      collapseBtn.id="v238CollapseBtn";
      collapseBtn.type="button";
      collapseBtn.title="Свернуть Kitsune к краю";
      collapseBtn.setAttribute("aria-label","Свернуть Kitsune");
      collapseBtn.textContent="−";
      root.appendChild(collapseBtn);
      collapseBtn.addEventListener("click",event=>{
        event.preventDefault();
        event.stopPropagation();
        collapseMascot(true);
      });
    }else{
      collapseBtn=document.querySelector("#v238CollapseBtn");
    }

    if(!document.querySelector("#v238WakeIndicator")){
      wakeIndicator=document.createElement("span");
      wakeIndicator.id="v238WakeIndicator";
      wakeIndicator.setAttribute("aria-hidden","true");
      wakeIndicator.textContent="🎙️";
      root.appendChild(wakeIndicator);
    }else{
      wakeIndicator=document.querySelector("#v238WakeIndicator");
    }

    return true;
  }

  function compactBox(){
    const mobile=innerWidth<=620;
    return mobile?{w:58,h:70}:{w:64,h:78};
  }

  function applyDock(){
    if(!root||!collapsed||dialogOpen())return;
    dockState=normalizedDock(dockState);
    const v=currentViewport();
    const box=compactBox();
    const safe=safeInsets();

    const availableH=Math.max(40,v.height-safe.top-safe.bottom-box.h);
    const top=v.offsetTop+safe.top+availableH*dockState.ratio;
    const peek=10;
    const left=dockState.side==="left"
      ?v.offsetLeft+safe.left-peek
      :v.offsetLeft+v.width-safe.right-box.w+peek;

    root.dataset.v238Side=dockState.side;
    root.style.left=Math.round(left)+"px";
    root.style.top=Math.round(clamp(top,v.offsetTop+safe.top,v.offsetTop+v.height-safe.bottom-box.h))+"px";
    root.style.right="auto";
    root.style.bottom="auto";
  }

  function clearDockStyles(){
    if(!root)return;
    root.style.removeProperty("left");
    root.style.removeProperty("top");
    root.style.removeProperty("right");
    root.style.removeProperty("bottom");
    root.style.removeProperty("transform");
    root.removeAttribute("data-v238-side");
  }

  function collapseMascot(save=true){
    if(!ensureControls())return;
    if(dialogOpen())return;
    collapsed=true;
    if(save){
      writeBool(COLLAPSED_KEY,true);
      saveDock();
    }
    try{window.v15Close?.()}catch{}
    root.classList.remove("open");
    document.body.classList.remove("v15-assistant-open");
    document.querySelector("#v15Scrim")?.setAttribute("aria-hidden","true");
    root.classList.add("v238-collapsed");
    root.classList.remove("v238-dialog-mascot");
    applyDock();
    setLiveState("idle");
    dispatchState();
  }

  function expandMascot(save=true){
    if(!ensureControls())return;
    collapsed=false;
    if(save)writeBool(COLLAPSED_KEY,false);
    root.classList.remove("v238-collapsed","v238-dragging");
    clearDockStyles();
    setLiveState("wave");
    setTimeout(()=>{if(!dialogOpen()&&!isSpeaking())setLiveState("idle")},700);
    dispatchState();
  }

  function dispatchState(){
    try{
      window.dispatchEvent(new CustomEvent("kitsune-presence-state",{
        detail:{
          version:VERSION,
          collapsed,
          dock:normalizedDock(dockState),
          wakeEnabled,
          wakeMode
        }
      }));
    }catch{}
  }

  function onPointerDown(event){
    if(!collapsed||dialogOpen())return;
    if(event.button!==undefined&&event.button!==0)return;

    const box=root.getBoundingClientRect();
    drag={
      id:event.pointerId,
      startX:event.clientX,
      startY:event.clientY,
      offsetX:event.clientX-box.left,
      offsetY:event.clientY-box.top,
      moved:false
    };
    root.classList.add("v238-dragging");
    try{mascot.setPointerCapture?.(event.pointerId)}catch{}
  }

  function onPointerMove(event){
    if(!drag||event.pointerId!==drag.id||!collapsed)return;
    const dx=event.clientX-drag.startX;
    const dy=event.clientY-drag.startY;
    if(!drag.moved&&Math.hypot(dx,dy)>7)drag.moved=true;
    if(!drag.moved)return;

    event.preventDefault();
    const v=currentViewport();
    const box=compactBox();
    const safe=safeInsets();
    const x=clamp(
      event.clientX-drag.offsetX,
      v.offsetLeft-safe.left,
      v.offsetLeft+v.width-box.w+safe.right
    );
    const y=clamp(
      event.clientY-drag.offsetY,
      v.offsetTop+safe.top,
      v.offsetTop+v.height-safe.bottom-box.h
    );
    root.style.left=Math.round(x)+"px";
    root.style.top=Math.round(y)+"px";
  }

  function onPointerUp(event){
    if(!drag||event.pointerId!==drag.id)return;
    const wasMoved=drag.moved;
    drag=null;
    root.classList.remove("v238-dragging");
    try{mascot.releasePointerCapture?.(event.pointerId)}catch{}

    if(wasMoved){
      suppressClickUntil=performance.now()+450;
      const r=root.getBoundingClientRect();
      const v=currentViewport();
      const safe=safeInsets();
      const center=r.left+r.width/2;
      dockState.side=center<(v.offsetLeft+v.width/2)?"left":"right";
      const box=compactBox();
      const availableH=Math.max(40,v.height-safe.top-safe.bottom-box.h);
      dockState.ratio=clamp((r.top-v.offsetTop-safe.top)/availableH,.10,.90);
      saveDock();
      applyDock();
      dispatchState();
    }
  }

  function onMascotClickCapture(event){
    if(!collapsed)return;
    if(performance.now()<suppressClickUntil){
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    expandMascot(true);
  }

  function bindDrag(){
    if(!mascot||mascot.dataset.v238DragBound)return;
    mascot.dataset.v238DragBound="1";
    mascot.addEventListener("pointerdown",onPointerDown,{passive:true});
    mascot.addEventListener("pointermove",onPointerMove,{passive:false});
    mascot.addEventListener("pointerup",onPointerUp,{passive:true});
    mascot.addEventListener("pointercancel",onPointerUp,{passive:true});
    mascot.addEventListener("click",onMascotClickCapture,true);
  }

  function positionDialogMascot(){
    if(!root||!dialogOpen())return;
    const card=document.querySelector("#v19Dialog .v19-dialog-card");
    if(!card)return;

    const rect=card.getBoundingClientRect();
    const v=currentViewport();
    const safe=safeInsets();
    const scaledHeight=(innerWidth<=620?164*.45:164*.52);
    const desiredBottom=v.height-(rect.top-v.offsetTop)+4;
    const maxBottom=Math.max(safe.bottom,v.height-safe.top-scaledHeight);

    root.style.right=Math.round(safe.right+6)+"px";
    root.style.left="auto";
    root.style.top="auto";
    root.style.bottom=Math.round(clamp(desiredBottom,safe.bottom,maxBottom))+"px";
  }

  function enterDialogMascot(){
    if(!ensureControls())return;
    restoreCollapsedAfterDialog=collapsed;

    // The old advice bubble is a different layer from the full voice dialog.
    // Close it so only one Kitsune surface is interactive at a time.
    try{window.v15Close?.()}catch{}
    root.classList.remove("open");
    document.body.classList.remove("v15-assistant-open");
    document.querySelector("#v15Scrim")?.setAttribute("aria-hidden","true");

    root.classList.remove("v238-collapsed","v238-dragging");
    root.classList.add("v238-dialog-mascot");
    positionDialogMascot();
    setLiveState("focus");
  }

  function leaveDialogMascot(){
    if(!root)return;
    root.classList.remove("v238-dialog-mascot");
    clearDockStyles();
    if(restoreCollapsedAfterDialog){
      collapsed=true;
      root.classList.add("v238-collapsed");
      applyDock();
    }else{
      collapsed=false;
      root.classList.remove("v238-collapsed");
    }
    setLiveState("idle");
  }

  function syncDialogState(){
    const open=dialogOpen();
    if(open&&!dialogWasOpen){
      dialogWasOpen=true;
      enterDialogMascot();
      stopWakeListener("dialog");
    }else if(!open&&dialogWasOpen){
      dialogWasOpen=false;
      leaveDialogMascot();
      scheduleWakeRestart(900);
    }

    if(open){
      positionDialogMascot();
      const live=document.querySelector("#v19DialogLive");
      const kind=live?.className||"";
      const text=live?.textContent||"";
      if(/listening/.test(kind)||/Слушаю/i.test(text))setLiveState("focus");
      else if(/thinking/.test(kind)||/думает|распозна/i.test(text))setLiveState("think");
      else if(/warn/.test(kind)||/ошиб|не удалось/i.test(text))setLiveState("oops");
      else if(isSpeaking())setLiveState("explain");
    }
  }

  function injectSettings(){
    const host=document.querySelector("#v237LiveVoiceSettings")||
      document.querySelector("#v19VoiceSettings")||
      document.querySelector("#v15Settings");
    if(!host||document.querySelector("#v238WakeSettings"))return;

    const block=document.createElement("section");
    block.id="v238WakeSettings";
    block.className="v238-settings";
    block.innerHTML=`
      <div class="v238-settings-head">
        <div>
          <strong>🎙️ «Привет, Китсуне»</strong>
          <small>Локальная активация, только пока приложение открыто</small>
        </div>
        <label class="v238-switch">
          <input id="v238WakeToggle" type="checkbox">
          <span>Вкл.</span>
        </label>
      </div>
      <div id="v238WakeStatus" class="v238-wake-status">Голосовая активация выключена.</div>
      <div class="v238-actions">
        <button type="button" class="v15-action" id="v238EnrollWake">🎧 Настроить фразу</button>
        <button type="button" class="v15-action" id="v238CollapseNow">↘ Свернуть персонажа</button>
      </div>
      <p class="v238-note">При включённой активации браузер держит микрофон открытым только на видимой странице Kitsune. Аудио не отправляется в Cloud. Фраза распознаётся по локальному персональному шаблону; сам вопрос после пробуждения распознаёт уже существующий локальный Whisper.</p>
    `;
    host.appendChild(block);

    const toggle=block.querySelector("#v238WakeToggle");
    toggle.checked=wakeEnabled;
    toggle.addEventListener("change",async event=>{
      wakeEnabled=!!event.target.checked;
      writeBool(WAKE_ENABLED_KEY,wakeEnabled);

      if(!wakeEnabled){
        await stopWakeListener("disabled");
        setWakeStatus("Голосовая активация выключена.","");
      }else if(!profileReady()){
        setWakeStatus(`Нужно один раз настроить фразу «${WAKE_PHRASE}». Скажи её 3 раза.`,"warn");
        try{
          await enrollWakePhrase();
        }catch(error){
          wakeEnabled=false;
          writeBool(WAKE_ENABLED_KEY,false);
          toggle.checked=false;
          setWakeStatus("Настройка отменена: "+friendlyMicError(error),"warn");
        }
      }else{
        await startWakeListener();
      }

      updateWakeUi();
      dispatchState();
    });

    block.querySelector("#v238EnrollWake")?.addEventListener("click",async()=>{
      try{
        await enrollWakePhrase();
      }catch(error){
        setWakeStatus("Не удалось настроить фразу: "+friendlyMicError(error),"warn");
      }
      updateWakeUi();
    });

    block.querySelector("#v238CollapseNow")?.addEventListener("click",()=>{
      collapseMascot(true);
    });

    updateWakeUi();
  }

  function updatePrivacyCopy(){
    const privacy=document.querySelector("#v1111Privacy");
    if(!privacy)return;

    privacy.querySelectorAll(".v1111-safety-grid article").forEach(article=>{
      const title=article.querySelector("b")?.textContent||"";
      const small=article.querySelector("small");
      if(!small)return;
      if(/Микрофон/.test(title)){
        small.textContent="Для обычного голосового ввода — после нажатия. Если взрослый отдельно включил «Привет, Китсуне», микрофон может локально ждать фразу активации, но только пока приложение открыто и видно на экране.";
      }
      if(/Разрешения/.test(title)){
        small.textContent="Геолокация, платежи и USB запрещены. Камера запрашивается только функцией «Из учебника». Микрофон — при голосовом вводе или при явно включённой локальной фразе активации.";
      }
    });
  }

  function setWakeStatus(text,kind=""){
    const el=document.querySelector("#v238WakeStatus");
    if(el){
      el.textContent=text;
      el.dataset.kind=kind;
    }
    wakeIndicator?.classList.toggle("show",wakeEnabled||enrollActive||wakeListening);
    if(wakeIndicator){
      wakeIndicator.dataset.state=
        kind==="listening"?"listening":
        kind==="warn"?"error":
        wakeMode==="paused"?"paused":"";
      wakeIndicator.title=text;
    }
  }

  function updateWakeUi(){
    const toggle=document.querySelector("#v238WakeToggle");
    if(toggle)toggle.checked=wakeEnabled;

    const enroll=document.querySelector("#v238EnrollWake");
    if(enroll){
      enroll.textContent=profileReady()
        ?"✅ Фраза настроена"
        :"🎧 Настроить фразу";
    }

    if(enrollActive){
      setWakeStatus(
        `Скажи «${WAKE_PHRASE}» — образец ${Math.min(ENROLL_SAMPLES,enrollTemplates.length+1)} из ${ENROLL_SAMPLES}.`,
        "listening"
      );
    }else if(!wakeEnabled){
      setWakeStatus("Голосовая активация выключена.","");
    }else if(!profileReady()){
      setWakeStatus(`Нужно настроить фразу «${WAKE_PHRASE}».`,"warn");
    }else if(document.hidden){
      setWakeStatus("⏸ Ожидание приостановлено: приложение не на экране.","");
    }else if(dialogOpen()||isSpeaking()){
      wakeMode="paused";
      setWakeStatus("⏸ Ожидание приостановлено, пока Kitsune разговаривает.","");
    }else if(wakeListening){
      setWakeStatus(`👂 Жду фразу «${WAKE_PHRASE}»…`,"listening");
    }else if(wakeMode==="error"){
      // keep current error text
    }else{
      setWakeStatus("Готова включить локальное ожидание фразы.","ok");
    }
  }

  function profileReady(){
    return !!(
      wakeProfile &&
      Array.isArray(wakeProfile.templates) &&
      wakeProfile.templates.length>=ENROLL_SAMPLES &&
      Number.isFinite(Number(wakeProfile.threshold))
    );
  }

  async function ensureMic(){
    if(location.protocol==="file:"||!window.isSecureContext){
      throw new Error("Микрофон требует HTTPS.");
    }
    if(!navigator.mediaDevices?.getUserMedia){
      throw new Error("Браузер не предоставляет доступ к микрофону.");
    }

    if(wakeStream?.active&&wakeCtx&&wakeCtx.state!=="closed")return true;

    wakeStream=await navigator.mediaDevices.getUserMedia({
      audio:{
        echoCancellation:true,
        noiseSuppression:true,
        autoGainControl:true,
        channelCount:1
      },
      video:false
    });

    const AC=window.AudioContext||window.webkitAudioContext;
    wakeCtx=new AC();
    try{await wakeCtx.resume()}catch{}

    wakeSource=wakeCtx.createMediaStreamSource(wakeStream);
    const size=2048;
    wakeProcessor=wakeCtx.createScriptProcessor
      ?wakeCtx.createScriptProcessor(size,1,1)
      :null;

    if(!wakeProcessor){
      try{wakeStream?.getTracks?.().forEach(track=>track.stop())}catch{}
      try{await wakeCtx.close()}catch{}
      wakeStream=null;wakeCtx=null;wakeSource=null;
      throw new Error("Локальный wake detector не поддерживается этим браузером.");
    }

    wakeMute=wakeCtx.createGain();
    wakeMute.gain.value=0;
    wakeSource.connect(wakeProcessor);
    wakeProcessor.connect(wakeMute);
    wakeMute.connect(wakeCtx.destination);

    wakeProcessor.onaudioprocess=event=>{
      if(!wakeListening&&!enrollActive)return;
      const input=event.inputBuffer.getChannelData(0);
      processAudioChunk(new Float32Array(input),event.inputBuffer.sampleRate||wakeCtx.sampleRate);
    };
    return true;
  }

  function resetVad(){
    preRoll=[];
    utteranceChunks=[];
    utteranceStart=0;
    lastLoudAt=0;
    capturing=false;
    hotChunks=0;
  }

  function cancelEnrollment(message="Настройка фразы остановлена."){
    if(!enrollActive)return;
    enrollActive=false;
    const reject=enrollReject;
    enrollResolve=null;
    enrollReject=null;
    try{reject?.(new Error(message))}catch{}
  }

  async function startWakeListener(){
    clearTimeout(wakeRestartTimer);

    if(
      !wakeEnabled||
      !profileReady()||
      document.hidden||
      dialogOpen()||
      isSpeaking()||
      enrollActive||
      root?.dataset?.mode==="off"
    ){
      wakeMode="paused";
      wakeListening=false;
      updateWakeUi();
      return false;
    }

    try{
      await ensureMic();
      resetVad();
      wakeListening=true;
      wakeMode="listening";
      updateWakeUi();
      dispatchState();
      return true;
    }catch(error){
      wakeListening=false;
      wakeMode="error";
      setWakeStatus(friendlyMicError(error),"warn");
      dispatchState();
      return false;
    }
  }

  async function stopWakeListener(reason="paused",closeMic=true){
    clearTimeout(wakeRestartTimer);
    wakeListening=false;
    if(enrollActive)cancelEnrollment(
      reason==="disabled"
        ?"Голосовая активация выключена."
        :"Настройка прервана."
    );
    resetVad();

    if(closeMic){
      try{wakeProcessor&&(wakeProcessor.onaudioprocess=null)}catch{}
      try{wakeSource?.disconnect?.()}catch{}
      try{wakeProcessor?.disconnect?.()}catch{}
      try{wakeMute?.disconnect?.()}catch{}
      try{wakeStream?.getTracks?.().forEach(track=>track.stop())}catch{}
      try{
        if(wakeCtx&&wakeCtx.state!=="closed")await wakeCtx.close();
      }catch{}
      wakeStream=null;
      wakeCtx=null;
      wakeSource=null;
      wakeProcessor=null;
      wakeMute=null;
    }

    wakeMode=reason==="error"?"error":"paused";
    updateWakeUi();
    dispatchState();
    return true;
  }

  function scheduleWakeRestart(delay=900){
    clearTimeout(wakeRestartTimer);
    if(!wakeEnabled)return;
    wakeRestartTimer=setTimeout(()=>{
      startWakeListener().catch(()=>{});
    },delay);
  }

  function processAudioChunk(chunk,sampleRate){
    if(!chunk?.length)return;

    let sum=0;
    for(let i=0;i<chunk.length;i++)sum+=chunk[i]*chunk[i];
    const rms=Math.sqrt(sum/chunk.length);
    const now=performance.now();

    const threshold=Math.max(.0105,noiseFloor*3.0);
    if(!capturing&&rms<threshold*.82){
      noiseFloor=noiseFloor*.985+rms*.015;
    }

    preRoll.push(chunk);
    if(preRoll.length>5)preRoll.shift();

    if(!capturing){
      if(now<wakeCooldownUntil)return;
      if(rms>threshold)hotChunks++;
      else hotChunks=0;

      if(hotChunks>=2){
        capturing=true;
        utteranceStart=now;
        lastLoudAt=now;
        utteranceChunks=preRoll.slice();
        preRoll=[];
      }
      return;
    }

    utteranceChunks.push(chunk);
    if(rms>threshold*.78)lastLoudAt=now;

    const elapsed=now-utteranceStart;
    const silence=now-lastLoudAt;
    if(
      elapsed>=MIN_UTTERANCE_MS &&
      (silence>=END_SILENCE_MS||elapsed>=MAX_UTTERANCE_MS)
    ){
      const captured=utteranceChunks;
      resetVad();
      finalizeUtterance(captured,sampleRate).catch(()=>{});
    }
  }

  function concatChunks(chunks){
    const length=chunks.reduce((n,a)=>n+a.length,0);
    const out=new Float32Array(length);
    let offset=0;
    for(const chunk of chunks){
      out.set(chunk,offset);
      offset+=chunk.length;
    }
    return out;
  }

  function resample(input,from,to=TARGET_RATE){
    if(!input?.length||!from||from===to)return input;
    const ratio=from/to;
    const len=Math.max(1,Math.round(input.length/ratio));
    const out=new Float32Array(len);
    for(let i=0;i<len;i++){
      const p=i*ratio;
      const a=Math.floor(p);
      const b=Math.min(input.length-1,a+1);
      const f=p-a;
      out[i]=input[a]*(1-f)+input[b]*f;
    }
    return out;
  }

  function trimSilence(samples){
    if(!samples?.length)return samples;
    const windowSize=80; // 10 ms @ 8 kHz
    let maxRms=0;
    const rms=[];
    for(let i=0;i<samples.length;i+=windowSize){
      let sum=0,n=0;
      for(let j=i;j<Math.min(samples.length,i+windowSize);j++){
        sum+=samples[j]*samples[j];n++;
      }
      const r=Math.sqrt(sum/Math.max(1,n));
      rms.push(r);
      if(r>maxRms)maxRms=r;
    }
    const gate=Math.max(.005,maxRms*.11);
    let first=0,last=rms.length-1;
    while(first<rms.length&&rms[first]<gate)first++;
    while(last>first&&rms[last]<gate)last--;
    const pad=3;
    first=Math.max(0,first-pad);
    last=Math.min(rms.length-1,last+pad);
    return samples.slice(first*windowSize,Math.min(samples.length,(last+1)*windowSize));
  }

  function goertzel(frame,rate,freq){
    const omega=2*Math.PI*freq/rate;
    const coeff=2*Math.cos(omega);
    let s0=0,s1=0,s2=0;
    for(let i=0;i<frame.length;i++){
      const w=.54-.46*Math.cos(2*Math.PI*i/Math.max(1,frame.length-1));
      s0=frame[i]*w+coeff*s1-s2;
      s2=s1;
      s1=s0;
    }
    const power=Math.max(1e-12,s1*s1+s2*s2-coeff*s1*s2);
    return Math.log1p(power);
  }

  function extractFeatures(samples){
    const cleanSamples=trimSilence(samples);
    const frameSize=200;
    const hop=128;
    const freqs=[250,375,550,800,1100,1500,2100,2900];
    const frames=[];

    for(let start=0;start+frameSize<=cleanSamples.length;start+=hop){
      const frame=cleanSamples.subarray(start,start+frameSize);

      let energy=0,zcr=0,prev=frame[0]||0;
      for(let i=0;i<frame.length;i++){
        const v=frame[i];
        energy+=v*v;
        if(i&&((v>=0)!==(prev>=0)))zcr++;
        prev=v;
      }

      const row=[
        Math.log1p(Math.sqrt(energy/frame.length)*80),
        zcr/frame.length
      ];
      for(const f of freqs)row.push(goertzel(frame,TARGET_RATE,f));
      frames.push(row);
    }

    if(frames.length<10)return [];

    // Per-utterance feature normalization makes enrollment robust to gain/mic.
    const dims=frames[0].length;
    const mean=new Array(dims).fill(0);
    const std=new Array(dims).fill(0);

    for(const row of frames)for(let d=0;d<dims;d++)mean[d]+=row[d];
    for(let d=0;d<dims;d++)mean[d]/=frames.length;
    for(const row of frames)for(let d=0;d<dims;d++){
      const x=row[d]-mean[d];
      std[d]+=x*x;
    }
    for(let d=0;d<dims;d++)std[d]=Math.sqrt(std[d]/frames.length)||1;

    return frames.map(row=>row.map((x,d)=>(x-mean[d])/std[d]));
  }

  function frameDistance(a,b){
    const n=Math.min(a.length,b.length);
    let sum=0;
    for(let i=0;i<n;i++){
      const d=a[i]-b[i];
      sum+=d*d;
    }
    return Math.sqrt(sum/Math.max(1,n));
  }

  function dtwDistance(a,b){
    if(!a?.length||!b?.length)return Infinity;

    const n=a.length,m=b.length;
    const band=Math.max(12,Math.ceil(Math.max(n,m)*.28));
    const prev=new Float64Array(m+1);
    const curr=new Float64Array(m+1);
    for(let j=0;j<=m;j++)prev[j]=Infinity;
    prev[0]=0;

    for(let i=1;i<=n;i++){
      for(let j=0;j<=m;j++)curr[j]=Infinity;
      const j0=Math.max(1,i-band);
      const j1=Math.min(m,i+band);
      for(let j=j0;j<=j1;j++){
        const cost=frameDistance(a[i-1],b[j-1]);
        curr[j]=cost+Math.min(prev[j],curr[j-1],prev[j-1]);
      }
      prev.set(curr);
    }
    return prev[m]/Math.max(n,m);
  }

  function profileFromTemplates(templates,durations){
    const pairs=[];
    for(let i=0;i<templates.length;i++){
      for(let j=i+1;j<templates.length;j++){
        pairs.push(dtwDistance(templates[i],templates[j]));
      }
    }
    const sorted=pairs.filter(Number.isFinite).sort((a,b)=>a-b);
    const maxPair=sorted[sorted.length-1]||1;
    const median=sorted[Math.floor(sorted.length/2)]||maxPair;
    const threshold=clamp(Math.max(maxPair*1.45,median*1.72)+.06,.35,4.8);
    const durationMedian=[...durations].sort((a,b)=>a-b)[Math.floor(durations.length/2)]||1200;
    return {
      version:1,
      phrase:WAKE_PHRASE,
      createdAt:Date.now(),
      sampleRate:TARGET_RATE,
      threshold,
      durationMedian,
      templates
    };
  }

  function matchWake(features,durationMs){
    if(!profileReady()||!features?.length)return {ok:false,score:Infinity};
    const durationMedian=Number(wakeProfile.durationMedian)||1200;
    const ratio=durationMs/durationMedian;
    if(ratio<.58||ratio>1.72)return {ok:false,score:Infinity,reason:"duration"};

    const scores=wakeProfile.templates
      .map(t=>dtwDistance(features,t))
      .filter(Number.isFinite)
      .sort((a,b)=>a-b);

    const best=scores[0]??Infinity;
    const second=scores[1]??best;
    const threshold=Number(wakeProfile.threshold)||1;
    const combined=best*.62+second*.38;

    return {
      ok:best<=threshold&&combined<=threshold*1.10,
      score:combined,
      best,
      second,
      threshold
    };
  }

  async function finalizeUtterance(chunks,sampleRate){
    const raw=concatChunks(chunks);
    const samples=trimSilence(resample(raw,sampleRate,TARGET_RATE));
    const durationMs=samples.length/TARGET_RATE*1000;
    if(durationMs<MIN_UTTERANCE_MS*.72)return;

    const features=extractFeatures(samples);
    if(features.length<10)return;

    if(enrollActive){
      enrollTemplates.push({
        features,
        durationMs
      });
      if(enrollTemplates.length>=ENROLL_SAMPLES){
        const templates=enrollTemplates.map(x=>x.features);
        const durations=enrollTemplates.map(x=>x.durationMs);
        wakeProfile=profileFromTemplates(templates,durations);
        saveJson(WAKE_PROFILE_KEY,wakeProfile);
        enrollActive=false;
        wakeMode="paused";
        const resolve=enrollResolve;
        enrollResolve=null;enrollReject=null;
        setWakeStatus("✅ Фраза настроена локально. Теперь Kitsune узнаёт твоё «Привет, Китсуне».","ok");
        updateWakeUi();
        resolve?.(true);
        if(wakeEnabled)scheduleWakeRestart(900);
        else stopWakeListener("disabled").catch(()=>{});
      }else{
        wakeCooldownUntil=performance.now()+700;
        updateWakeUi();
      }
      return;
    }

    if(!wakeEnabled||!wakeListening||performance.now()<wakeCooldownUntil)return;
    const match=matchWake(features,durationMs);
    if(match.ok){
      wakeCooldownUntil=performance.now()+WAKE_COOLDOWN_MS;
      await activateFromWake(match);
    }
  }

  async function enrollWakePhrase(){
    await stopWakeListener("paused");
    await ensureMic();

    enrollActive=true;
    enrollTemplates=[];
    wakeMode="enrolling";
    wakeListening=false;
    resetVad();
    wakeCooldownUntil=0;
    updateWakeUi();

    return new Promise((resolve,reject)=>{
      enrollResolve=resolve;
      enrollReject=reject;
      // enrollment uses the same audio callback; keep mic open, but only the
      // enrollActive branch is processed.
      setTimeout(()=>{
        if(!enrollActive)return;
        enrollActive=false;
        enrollResolve=null;enrollReject=null;
        reject(new Error("Не услышала три образца за 45 секунд."));
        stopWakeListener("error").catch(()=>{});
      },45000);
    });
  }

  async function activateFromWake(match){
    if(wakeMode==="waking")return;
    wakeMode="waking";
    wakeListening=false;
    updateWakeUi();

    await stopWakeListener("paused");
    // Keep the stored collapsed state. enterDialogMascot() temporarily reveals
    // the original animated character and restores compact mode on close.
    setLiveState("wave");

    const api=window.KitsuneVoiceDialogue;
    if(!api?.open||!api?.start){
      setWakeStatus("Диалог Kitsune ещё не готов. Нажми на персонажа и попробуй ещё раз.","warn");
      scheduleWakeRestart(1400);
      return;
    }

    try{
      api.open(null);
      syncDialogState();

      const beginListening=()=>{
        setLiveState("focus");
        setTimeout(()=>{
          Promise.resolve(api.start()).catch(error=>{
            setWakeStatus("Не удалось включить Whisper: "+friendlyMicError(error),"warn");
          });
        },180);
      };

      if(typeof window.v151Speak==="function"){
        let done=false;
        const onDone=()=>{
          if(done)return;
          done=true;
          beginListening();
        };
        try{
          window.v151Speak("Я здесь. Слушаю тебя.",{
            state:"happy",
            force:true,
            onDone
          });
          setTimeout(onDone,2400);
        }catch{
          beginListening();
        }
      }else{
        beginListening();
      }

      try{
        window.dispatchEvent(new CustomEvent("kitsune-wake-detected",{
          detail:{
            version:VERSION,
            phrase:WAKE_PHRASE,
            local:true,
            score:Number(match?.score)||null
          }
        }));
      }catch{}
    }catch(error){
      setWakeStatus("Не удалось открыть голосовой диалог: "+friendlyMicError(error),"warn");
      scheduleWakeRestart(1400);
    }
  }

  function friendlyMicError(error){
    const raw=String(error?.name||error?.message||error||"Неизвестная ошибка");
    if(/NotAllowed|Permission/i.test(raw))return "доступ к микрофону запрещён";
    if(/NotFound/i.test(raw))return "микрофон не найден";
    if(/HTTPS|secure/i.test(raw))return "микрофон требует HTTPS";
    return raw.slice(0,130);
  }

  function observe(){
    const observer=new MutationObserver(()=>{
      if(!ensureControls())return;
      bindDrag();
      injectSettings();
      updatePrivacyCopy();
      syncDialogState();

      if(root?.dataset?.mode==="off"){
        if(wakeListening)stopWakeListener("paused").catch(()=>{});
      }else if(
        wakeEnabled&&profileReady()&&!wakeListening&&!enrollActive&&
        !document.hidden&&!dialogOpen()&&!isSpeaking()
      ){
        scheduleWakeRestart(650);
      }

      updateWakeUi();
    });
    observer.observe(document.body,{
      subtree:true,
      childList:true,
      attributes:true,
      attributeFilter:["class","data-mode"]
    });
  }

  function handleViewport(){
    if(collapsed&&!dialogOpen())applyDock();
    if(dialogOpen())positionDialogMascot();
  }

  function installLifecycle(){
    document.addEventListener("visibilitychange",()=>{
      if(document.hidden){
        stopWakeListener("paused").catch(()=>{});
      }else{
        scheduleWakeRestart(700);
      }
    });

    window.addEventListener("pagehide",()=>{
      stopWakeListener("paused").catch(()=>{});
    });

    window.addEventListener("resize",handleViewport,{passive:true});
    window.visualViewport?.addEventListener("resize",handleViewport,{passive:true});
    window.visualViewport?.addEventListener("scroll",handleViewport,{passive:true});

    window.addEventListener("kitsune-conversation-turn",()=>{
      if(dialogOpen())stopWakeListener("dialog").catch(()=>{});
    });

    document.addEventListener("pointerdown",event=>{
      // Any direct mic/dialog interaction is authoritative over the wake mic.
      if(event.target.closest?.("#v19Dialog,.v19-open-dialog,.v19-inline-talk")){
        stopWakeListener("dialog").catch(()=>{});
      }
    },true);
  }

  function install(){
    if(installed)return;
    injectStyle();

    if(!ensureControls()){
      setTimeout(install,100);
      return;
    }

    installed=true;
    bindDrag();
    injectSettings();
    updatePrivacyCopy();
    observe();
    installLifecycle();
    syncDialogState();

    if(collapsed&&!dialogOpen())collapseMascot(false);
    else expandMascot(false);

    if(wakeEnabled&&profileReady())scheduleWakeRestart(800);
    else updateWakeUi();

    dispatchState();
  }

  window.KitsunePresence={
    version:VERSION,
    collapse:()=>collapseMascot(true),
    expand:()=>expandMascot(true),
    isCollapsed:()=>collapsed,
    dock:()=>normalizedDock(dockState),
    wake:{
      phrase:WAKE_PHRASE,
      enabled:value=>{
        if(typeof value==="boolean"){
          wakeEnabled=value;
          writeBool(WAKE_ENABLED_KEY,wakeEnabled);
          if(wakeEnabled)startWakeListener().catch(()=>{});
          else stopWakeListener("disabled").catch(()=>{});
          updateWakeUi();
        }
        return wakeEnabled;
      },
      ready:()=>profileReady(),
      status:()=>({
        enabled:wakeEnabled,
        ready:profileReady(),
        listening:wakeListening,
        mode:wakeMode,
        local:true,
        phrase:WAKE_PHRASE
      }),
      enroll:enrollWakePhrase,
      start:startWakeListener,
      stop:stopWakeListener
    },
    diagnostics:()=>({
      version:VERSION,
      collapsed,
      dock:normalizedDock(dockState),
      dialogOpen:dialogOpen(),
      wakeEnabled,
      wakeReady:profileReady(),
      wakeListening,
      wakeMode,
      cloudWake:false,
      hidden:document.hidden
    }),
    _test:{
      dtwDistance,
      profileFromTemplates,
      matchWake,
      normalizedDock,
      extractFeatures
    }
  };

  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",install,{once:true});
  }else{
    install();
  }

  let tries=0;
  const timer=setInterval(()=>{
    tries++;
    install();
    injectSettings();
    if((installed&&document.querySelector("#v238WakeSettings"))||tries>40){
      clearInterval(timer);
    }
  },250);
})();
