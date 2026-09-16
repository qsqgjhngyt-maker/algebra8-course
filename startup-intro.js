/* Kitsune Math cinematic startup intro · 3.1.0-rc.5 · living motion */
(() => {
  "use strict";
  const ROOT_ID="kitsuneStartupIntro";
  const KEY_SEEN="kitsune:intro:seen";
  const KEY_LAST_RELEASE="kitsune:intro:lastRelease";
  const KEY_ENABLED="kitsune:intro:enabled";
  const KEY_MODE="kitsune:intro:mode";
  const VERSION=document.querySelector('meta[name="kitsune-app-version"]')?.content||"3.1.0-rc.5";
  const mediaReduced=typeof matchMedia==="function"?matchMedia("(prefers-reduced-motion: reduce)"):null;
  const MODES=["auto","full","short","off"];
  const raf=typeof requestAnimationFrame==="function"?requestAnimationFrame:(fn)=>setTimeout(fn,0);
  let root=document.getElementById(ROOT_ID),timers=[],finished=false,activeMode="off";

  const safeGet=(k,f=null)=>{try{const v=localStorage.getItem(k);return v===null?f:v}catch(_){return f}};
  const safeSet=(k,v)=>{try{localStorage.setItem(k,String(v))}catch(_){}};
  const later=(fn,ms)=>{const id=setTimeout(()=>{timers=timers.filter(x=>x!==id);fn()},ms);timers.push(id);return id};
  const clearTimers=()=>{timers.forEach(clearTimeout);timers=[]};
  function preference(){const p=safeGet(KEY_MODE,null);if(MODES.includes(p))return p;return safeGet(KEY_ENABLED,"1")==="0"?"off":"auto"}
  function setPreference(v){const n=MODES.includes(v)?v:"auto";safeSet(KEY_MODE,n);safeSet(KEY_ENABLED,n==="off"?"0":"1");updateToggle();return n}
  function queryMode(){try{const q=new URLSearchParams(location.search).get("intro");return ["full","short","reduced","off"].includes(q)?q:null}catch(_){return null}}
  function theme(){return safeGet("a8_theme","light")==="dark"?"dark":"light"}
  function decideMode(){const q=queryMode();if(q)return q;const p=preference();if(p==="off")return "off";if(mediaReduced?.matches)return "reduced";if(p==="full")return "full";if(p==="short")return "short";return safeGet(KEY_SEEN,"0")!=="1"||safeGet(KEY_LAST_RELEASE,"")!==VERSION?"full":"short"}
  function markSeen(){safeSet(KEY_SEEN,"1");safeSet(KEY_LAST_RELEASE,VERSION)}
  function stage(name){if(!root||finished)return;["is-motion","is-idle","is-blink","is-magic"].forEach(c=>root.classList.remove(c));if(name)root.classList.add(`is-${name}`)}
  function motionFrame(n){const el=root?.querySelector("[data-motion]");if(el)el.style.setProperty("--motion-frame",String(Math.max(0,Math.min(5,n|0))))}
  function cleanup(){clearTimers();document.documentElement?.classList?.remove("kitsune-intro-active");document.removeEventListener?.("keydown",onKey);document.removeEventListener?.("visibilitychange",onVisibility);root?.remove();root=null}
  function finish({skip=false,reason="complete"}={}){if(finished)return;finished=true;clearTimers();markSeen();root?.classList.add("is-leaving");later(cleanup,skip?120:320);try{window.dispatchEvent(new CustomEvent("kitsune:intro:complete",{detail:{mode:activeMode,skip,reason,version:VERSION}}))}catch(_){}}
  function onPointer(ev){if(ev.target?.closest?.(".kitsune-startup-intro__skip"))return;finish({skip:true,reason:"pointer"})}
  function onSkip(ev){ev.preventDefault();ev.stopPropagation();finish({skip:true,reason:"button"})}
  function onKey(ev){if(ev.key==="Escape")finish({skip:true,reason:"keyboard"})}
  function onVisibility(){if(document.hidden&&!finished)finish({skip:true,reason:"background"})}
  function preload(){if(!root)return Promise.resolve();const urls=[...root.querySelectorAll("img[data-preload]")].map(x=>x.currentSrc||x.src).filter(Boolean);urls.unshift("./assets/kitsune-startup-motion-v315.webp?v="+encodeURIComponent(VERSION));return Promise.allSettled([...new Set(urls)].map(src=>new Promise(r=>{const i=new Image();i.onload=i.onerror=r;i.src=src})))}

  async function play(mode){
    activeMode=mode;
    if(!root||mode==="off"){cleanup();return}
    document.documentElement?.classList?.add("kitsune-intro-active");root.dataset.theme=theme();root.dataset.mode=mode;
    root.addEventListener("pointerdown",onPointer,{passive:true});root.querySelector(".kitsune-startup-intro__skip")?.addEventListener("click",onSkip);document.addEventListener?.("keydown",onKey);document.addEventListener?.("visibilitychange",onVisibility);
    await Promise.race([preload(),new Promise(r=>setTimeout(r,650))]);if(finished||!root)return;
    if(mode==="reduced"){root.classList.add("is-reduced","is-brand","is-hold");stage("idle");later(()=>finish(),1800);return}
    if(mode==="short"){root.classList.add("is-short");stage("idle");later(()=>{stage("magic");root?.classList.add("is-brand")},320);later(()=>root?.classList.add("is-hold"),640);later(()=>finish(),2400);return}
    motionFrame(0);stage("motion");
    later(()=>motionFrame(1),300);later(()=>motionFrame(2),620);later(()=>motionFrame(3),940);later(()=>motionFrame(4),1280);later(()=>motionFrame(5),1660);
    later(()=>stage("idle"),2050);later(()=>stage("blink"),2720);later(()=>stage("idle"),2890);later(()=>stage("magic"),3520);
    later(()=>root?.classList.add("is-brand"),4220);later(()=>root?.classList.add("is-hold"),4880);
    later(()=>stage("blink"),7180);later(()=>stage("idle"),7360);later(()=>stage("magic"),8150);later(()=>finish(),10550);
  }

  const LABEL={auto:"🎬 Запуск: авто",full:"🎬 Запуск: полный",short:"🎬 Запуск: короткий",off:"🎬 Запуск: выкл"};
  const TITLE={auto:"Полная заставка после обновления, затем короткая",full:"Полная кинематографичная заставка при каждом запуске",short:"Всегда короткая заставка",off:"Не показывать заставку"};
  function updateToggle(){const b=document.getElementById("startupIntroBtn");if(!b)return;const p=preference();b.textContent=LABEL[p];b.title=TITLE[p]+". Нажми, чтобы сменить режим.";b.dataset.introMode=p;b.setAttribute("aria-pressed",p==="off"?"false":"true")}
  function bind(){updateToggle();const b=document.getElementById("startupIntroBtn");if(b&&!b.dataset.boundIntro){b.dataset.boundIntro="1";b.addEventListener("click",()=>setPreference(MODES[(MODES.indexOf(preference())+1)%MODES.length]))}}
  window.KitsuneStartupIntro={version:VERSION,getPreference:preference,setPreference,reset(){try{localStorage.removeItem(KEY_SEEN);localStorage.removeItem(KEY_LAST_RELEASE)}catch(_){}},replayFull(){try{const u=new URL(location.href);u.searchParams.set("intro","full");location.href=u.href}catch(_){location.reload()}},keys:{seen:KEY_SEEN,lastRelease:KEY_LAST_RELEASE,enabled:KEY_ENABLED,mode:KEY_MODE}};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",bind,{once:true});else bind();
  play(decideMode());
})();
