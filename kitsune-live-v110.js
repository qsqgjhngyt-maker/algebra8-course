
/* =====================================================================
   v1.10.0 · KITSUNE LIVE MASCOT
   Плавная интерактивная анимация нового арт-персонажа.
   ===================================================================== */
(() => {
  "use strict";

  const VERSION="1.12.0";
  const SPRITE="./assets/kitsune/kitsune-sprite-v1101.png";
  const FRAMES={
    idle:{x:0,y:0},
    blink:{x:1,y:0},
    talkSmall:{x:2,y:0},
    talkWide:{x:3,y:0},
    talkO:{x:0,y:1},
    happy:{x:1,y:1},
    explain:{x:2,y:1},
    idleAlt:{x:3,y:1}
  };

  const STATE_FRAME={
    idle:"idle",
    wave:"idleAlt",
    think:"talkO",
    explain:"explain",
    happy:"happy",
    oops:"talkO",
    focus:"idleAlt",
    cheer:"happy",
    celebrate:"happy",
    sleep:"blink"
  };

  let activeLayer=0;
  let currentFrame="idle";
  let currentState="idle";
  let speaking=false;
  let speakingSource="";
  let talkTimer=null;
  let talkIndex=0;
  let blinkTimer=null;
  let analyser=null;
  let analyserRaf=0;
  let lastAudioFrame="";
  let lastAudioSwitch=0;
  let typingObserver=null;
  let installed=false;

  const reduce=window.matchMedia?.("(prefers-reduced-motion: reduce)");

  function root(){return document.querySelector("#v15Assistant")}
  function stage(){return document.querySelector("#v110KitsuneStage")}
  function layers(){
    return [
      document.querySelector("#v110KitsuneFrameA"),
      document.querySelector("#v110KitsuneFrameB")
    ];
  }
  function frameDef(name){return FRAMES[name]||FRAMES.idle}

  function preload(){
    const im=new Image();
    im.decoding="async";
    im.onload=()=>{
      stage()?.classList.add("sprite-ready");
    };
    im.onerror=()=>{
      stage()?.classList.remove("sprite-ready");
      console.warn("[Kitsune Live] sprite failed to load; keeping idle fallback.");
    };
    im.src=SPRITE;
    if(im.complete&&im.naturalWidth>0)stage()?.classList.add("sprite-ready");
  }

  function setEmote(stateName){
    const e=document.querySelector("#v110KitsuneEmote");
    if(!e)return;
    const map={
      think:"?",
      explain:"√x",
      oops:"!",
      happy:"✓",
      cheer:"★",
      celebrate:"★",
      wave:"✦",
      focus:"•"
    };
    e.textContent=map[stateName]||"";
    e.dataset.show=map[stateName]?"1":"0";
  }

  function applyFrame(el,name){
    const d=frameDef(name);
    el.dataset.frame=name;
    el.style.setProperty("--v110-col",String(d.x));
    el.style.setProperty("--v110-row",String(d.y));
  }

  function crossfade(name,{fast=false}={}){
    if(!FRAMES[name])name="idle";
    if(currentFrame===name)return;

    const ls=layers();
    if(!ls[0]||!ls[1])return;

    if(reduce?.matches){
      applyFrame(ls[0],name);
      ls[0].classList.add("is-active");
      ls[1].classList.remove("is-active");
      currentFrame=name;
      activeLayer=0;
      return;
    }

    const next=1-activeLayer;
    const incoming=ls[next];
    const outgoing=ls[activeLayer];

    incoming.classList.toggle("fast",!!fast);
    outgoing.classList.toggle("fast",!!fast);

    /* v1.10.1:
       Оба слоя всегда используют ОДИН уже загруженный sprite.
       Поэтому при смене эмоции нет ни src-switch, ни decode race, ни 404 между кадрами.
       Текущий слой остаётся видимым до следующего animation frame. */
    applyFrame(incoming,name);
    requestAnimationFrame(()=>{
      incoming.classList.add("is-active");
      outgoing.classList.remove("is-active");
      activeLayer=next;
      currentFrame=name;
    });
  }

  function burst(kind="happy"){
    const s=stage();
    if(!s||reduce?.matches)return;
    s.dataset.burst=kind;
    s.classList.remove("v110-burst");
    void s.offsetWidth;
    s.classList.add("v110-burst");
    setTimeout(()=>{
      s.classList.remove("v110-burst");
      delete s.dataset.burst;
    },900);
  }

  function applyState(stateName,{fromSpeech=false}={}){
    currentState=stateName||"idle";
    setEmote(currentState);

    if(speaking&&!fromSpeech)return;

    const frame=STATE_FRAME[currentState]||"idle";
    crossfade(frame);

    const s=stage();
    if(s){
      s.dataset.state=currentState;
      if(["happy","cheer","celebrate"].includes(currentState))burst(currentState);
    }
  }

  function manualTalkFrame(){
    /* Во время обычной речи используем только три почти одинаковые по позе
       формы. talkO оставлен для эмоций think/oops, иначе тело заметно менялось бы. */
    const seq=["talkSmall","talkWide","talkSmall","idle","talkSmall","talkWide"];
    const name=seq[talkIndex++%seq.length];
    crossfade(name,{fast:true});
  }

  function scheduleTalk(){
    clearTimeout(talkTimer);
    if(!speaking||analyser||reduce?.matches)return;
    manualTalkFrame();
    const delay=165+Math.round(Math.random()*95);
    talkTimer=setTimeout(scheduleTalk,delay);
  }

  function audioLoop(){
    cancelAnimationFrame(analyserRaf);
    if(!speaking||!analyser||reduce?.matches)return;

    const buf=new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(buf);
    let sum=0;
    for(const v of buf){
      const x=(v-128)/128;
      sum+=x*x;
    }
    const rms=Math.sqrt(sum/buf.length);
    const now=performance.now();

    let target="idle";
    if(rms>.105)target="talkWide";
    else if(rms>.038)target="talkSmall";
    else target="idle";

    if(target!==lastAudioFrame&&now-lastAudioSwitch>115){
      crossfade(target,{fast:true});
      lastAudioFrame=target;
      lastAudioSwitch=now;
    }
    analyserRaf=requestAnimationFrame(audioLoop);
  }

  function startTalking(stateName=currentState,source="voice"){
    speaking=true;
    speakingSource=source;
    currentState=stateName||currentState||"explain";
    document.body.classList.add("v110-kitsune-speaking");

    const s=stage();
    if(s){
      s.dataset.talking="1";
      s.dataset.state=currentState;
    }
    setEmote(currentState);

    if(analyser){
      audioLoop();
    }else{
      scheduleTalk();
    }
  }

  function stopTalking(stateName=currentState,source=""){
    if(source&&speakingSource&&source!==speakingSource)return;
    speaking=false;
    speakingSource="";
    document.body.classList.remove("v110-kitsune-speaking");
    clearTimeout(talkTimer);
    talkTimer=null;
    cancelAnimationFrame(analyserRaf);
    analyserRaf=0;

    const s=stage();
    if(s)delete s.dataset.talking;

    /* Закрываем речь мягко: сначала маленький рот, потом эмоция/idle. */
    if(!reduce?.matches){
      crossfade("talkSmall",{fast:true});
      setTimeout(()=>{
        if(!speaking)applyState(stateName||"idle",{fromSpeech:true});
      },135);
    }else{
      applyState(stateName||"idle",{fromSpeech:true});
    }
  }

  function attachAnalyser(node){
    analyser=node||null;
    lastAudioFrame="";
    lastAudioSwitch=0;
    if(speaking&&analyser)audioLoop();
  }

  function detachAnalyser(){
    analyser=null;
    cancelAnimationFrame(analyserRaf);
    analyserRaf=0;
    if(speaking)scheduleTalk();
  }

  function scheduleBlink(){
    clearTimeout(blinkTimer);
    const delay=3800+Math.random()*4200;
    blinkTimer=setTimeout(()=>{
      if(!speaking&&currentState==="idle"){
        crossfade("blink");
        setTimeout(()=>{
          if(!speaking&&currentState==="idle")crossfade("idle");
        },145);
      }
      scheduleBlink();
    },delay);
  }

  function bindPointer(){
    if(!window.matchMedia?.("(pointer:fine)").matches)return;
    document.addEventListener("pointermove",e=>{
      const s=stage();
      if(!s)return;
      const rect=s.getBoundingClientRect();
      const cx=rect.left+rect.width/2;
      const cy=rect.top+rect.height/2;
      const dx=Math.max(-1,Math.min(1,(e.clientX-cx)/260));
      const dy=Math.max(-1,Math.min(1,(e.clientY-cy)/220));
      s.style.setProperty("--v110-look-x",`${(dx*2.2).toFixed(2)}deg`);
      s.style.setProperty("--v110-look-y",`${(dy*-1.4).toFixed(2)}deg`);
    },{passive:true});
  }

  function bindTyping(){
    const box=document.querySelector("#v15Message");
    if(!box||typingObserver)return;
    typingObserver=new MutationObserver(()=>{
      const typing=box.classList.contains("typing");
      if(typing&&!speaking){
        startTalking(currentState||"explain","typing");
      }else if(!typing&&speaking&&speakingSource==="typing"){
        stopTalking(currentState||"idle","typing");
      }
    });
    typingObserver.observe(box,{attributes:true,attributeFilter:["class"]});
  }

  function patchGlobals(){
    const oldSet=window.v15SetState;
    if(typeof oldSet==="function"&&!oldSet.__v110){
      const wrapped=function(stateName){
        const result=oldSet.apply(this,arguments);
        applyState(stateName);
        return result;
      };
      wrapped.__v110=true;
      window.v15SetState=wrapped;
    }

    const oldMark=window.v161MarkSpeaking;
    if(typeof oldMark==="function"&&!oldMark.__v110){
      const wrapped=function(on,stateName){
        const result=oldMark.apply(this,arguments);
        if(on)startTalking(stateName||currentState,"voice");
        else stopTalking(stateName||currentState||"idle","voice");
        return result;
      };
      wrapped.__v110=true;
      window.v161MarkSpeaking=wrapped;
    }

    const oldStop=window.v161StopSpeech;
    if(typeof oldStop==="function"&&!oldStop.__v110){
      const wrapped=function(){
        const result=oldStop.apply(this,arguments);
        stopTalking(currentState||"idle");
        return result;
      };
      wrapped.__v110=true;
      window.v161StopSpeech=wrapped;
    }
  }

  function bindMascot(){
    const btn=document.querySelector("#v15MascotBtn");
    if(!btn||btn.dataset.v110Bound)return;
    btn.dataset.v110Bound="1";

    btn.addEventListener("pointerdown",()=>{
      stage()?.classList.add("is-pressed");
    });
    ["pointerup","pointercancel","pointerleave"].forEach(ev=>
      btn.addEventListener(ev,()=>stage()?.classList.remove("is-pressed"))
    );
    btn.addEventListener("dblclick",()=>{
      if(reduce?.matches)return;
      burst("celebrate");
      crossfade("happy");
      setTimeout(()=>{if(!speaking)applyState("idle")},800);
    });
  }

  function install(){
    if(installed&&!stage())installed=false;
    if(installed)return;
    const r=root(),s=stage();
    if(!r||!s){
      setTimeout(install,80);
      return;
    }

    installed=true;
    preload();
    patchGlobals();
    bindMascot();
    bindPointer();
    bindTyping();
    scheduleBlink();
    applyState(r.dataset.state||"idle");
    r.dataset.kitsuneLive="1";
  }

  window.KitsuneLive={
    version:VERSION,
    setState:applyState,
    setFrame:crossfade,
    startTalking,
    stopTalking,
    attachAnalyser,
    detachAnalyser,
    burst,
    isSpeaking:()=>speaking
  };

  install();
  setTimeout(install,250);
  setTimeout(install,900);
})();
