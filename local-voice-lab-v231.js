/* =====================================================================
   Kitsune v2.3.0-beta.3 · LOCAL VOICE LAB
   Cloud TTS is not used.
   Piper Irina runs directly in the browser.
   Silero Xenia/Kseniya are actual Silero voices via optional 127.0.0.1
   desktop bridge; text never leaves the computer.
   ===================================================================== */
(() => {
  "use strict";

  const VERSION="2.3.0-beta.3";
  const KEY="a8_local_voice_v231";
  const PIPER_URL="https://cdn.jsdelivr.net/npm/@realtimex/piper-tts-web@1.1.1/+esm";
  const IRINA_ID="ru_RU-irina-medium";
  const SILERO_URL="http://127.0.0.1:17865";

  const previousSpeak=window.v151Speak;
  const previousStop=window.v161StopSpeech;

  let selected="piper-irina";
  let piperModule=null;
  let piperPromise=null;
  let piperSession=null;
  let piperReady=false;
  let busy=false;
  let audio=null;
  let objectUrl=null;
  let sileroOnline=false;
  let lastEngine="";

  try{selected=localStorage.getItem(KEY)||"piper-irina"}catch{}
  if(!["piper-irina","silero-xenia","silero-kseniya","legacy"].includes(selected))selected="piper-irina";

  function isMobile(){
    return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent||"");
  }
  function save(){try{localStorage.setItem(KEY,selected)}catch{}}

  function clean(text){
    let s=String(text||"");
    try{
      if(typeof window.v161CleanSpeechText==="function")s=window.v161CleanSpeechText(s);
      else if(typeof window.v15Strip==="function")s=window.v15Strip(s);
    }catch{}
    return s.replace(/\s+/g," ").trim().slice(0,900);
  }

  function stop(){
    try{audio?.pause()}catch{}
    audio=null;
    if(objectUrl){URL.revokeObjectURL(objectUrl);objectUrl=null}
    try{window.v161MarkSpeaking?.(false,"idle")}catch{}
  }

  async function playBlob(blob,state="explain",onDone=null){
    stop();
    objectUrl=URL.createObjectURL(blob);
    audio=new Audio(objectUrl);
    audio.preload="auto";
    audio.onplay=()=>{
      try{window.v161MarkSpeaking?.(true,state)}catch{}
    };
    audio.onended=()=>{
      try{window.v161MarkSpeaking?.(false,state)}catch{}
      onDone?.();
      if(objectUrl){URL.revokeObjectURL(objectUrl);objectUrl=null}
      audio=null;
    };
    audio.onerror=()=>{
      try{window.v161MarkSpeaking?.(false,state)}catch{}
    };
    await audio.play();
  }

  async function loadPiper(){
    if(piperModule)return piperModule;
    if(piperPromise)return piperPromise;
    piperPromise=import(PIPER_URL).then(mod=>piperModule=mod).catch(error=>{
      piperPromise=null;throw error;
    });
    return piperPromise;
  }

  function sessionFor(mod){
    if(piperSession)return piperSession;
    if(typeof mod?.TtsSession==="function"){
      try{
        piperSession=new mod.TtsSession({
          voiceId:IRINA_ID,
          allowLocalModels:true,
          fallbackStrategy:"auto"
        });
      }catch{}
    }
    return piperSession;
  }

  async function piperStored(){
    const mod=await loadPiper();
    if(typeof mod.stored!=="function")return piperReady;
    const list=await mod.stored();
    piperReady=Array.isArray(list)&&list.includes(IRINA_ID);
    return piperReady;
  }

  async function prepareIrina(){
    if(busy)return false;
    busy=true;render();
    setStatus("Подготавливаю Piper Irina…");
    try{
      const mod=await loadPiper();
      if(await piperStored()){
        setStatus("✅ Piper Irina уже сохранена локально.");
        return true;
      }
      if(typeof mod.download!=="function")throw new Error("Piper runtime не поддерживает download().");
      await mod.download(IRINA_ID,progress=>{
        const total=Number(progress?.total)||0,loaded=Number(progress?.loaded)||0;
        const pct=total?Math.round(loaded/total*100):0;
        setStatus(`Скачиваю Piper Irina… ${pct?`${pct}%`:""}`);
      });
      if(!await piperStored())throw new Error("Модель скачана, но не найдена в локальном хранилище.");
      selected="piper-irina";save();
      setStatus("✅ Piper Irina готова и выбрана.");
      return true;
    }catch(error){
      setStatus(`⚠️ Piper Irina: ${String(error?.message||error).slice(0,150)}`);
      return false;
    }finally{
      busy=false;render();
    }
  }

  async function speakPiper(text,opts={}){
    const phrase=clean(text);
    if(!phrase)return false;
    const mod=await loadPiper();
    if(!await piperStored())throw new Error("Piper Irina ещё не скачана.");
    const session=sessionFor(mod);
    const blob=session?.predict
      ? await session.predict(phrase)
      : await mod.predict({text:phrase,voiceId:IRINA_ID});
    if(!(blob instanceof Blob))throw new Error("Piper не вернул аудио.");
    lastEngine="Piper Irina · local";
    setStatus("🔊 Piper Irina · локально");
    await playBlob(blob,opts.state||"explain",opts.onDone);
    return true;
  }

  async function checkSilero(){
    if(isMobile()){
      sileroOnline=false;
      setStatus("Silero Xenia/Kseniya сейчас подключаются локально только на ПК. На телефоне используй Piper Irina.");
      render();return false;
    }
    try{
      const response=await fetch(`${SILERO_URL}/health`,{cache:"no-store",signal:AbortSignal.timeout(1800)});
      const data=await response.json();
      sileroOnline=!!data?.ok;
    }catch{sileroOnline=false}
    setStatus(sileroOnline
      ?"✅ Локальный Silero Bridge найден на этом ПК."
      :"Silero Bridge не запущен. Piper Irina продолжает работать полностью в браузере."
    );
    render();
    return sileroOnline;
  }

  async function speakSilero(text,speaker,opts={}){
    if(!await checkSilero())throw new Error("Silero Bridge не запущен.");
    const phrase=clean(text);
    const response=await fetch(`${SILERO_URL}/tts`,{
      method:"POST",
      cache:"no-store",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({text:phrase,speaker}),
      signal:AbortSignal.timeout(30000)
    });
    if(!response.ok)throw new Error(`Silero HTTP ${response.status}`);
    const blob=await response.blob();
    lastEngine=`Silero ${speaker==="xenia"?"Xenia":"Kseniya"} · local PC`;
    setStatus(`🔊 ${lastEngine}`);
    await playBlob(blob,opts.state||"explain",opts.onDone);
    return true;
  }

  async function speak(text,opts={}){
    try{
      if(selected==="piper-irina")return await speakPiper(text,opts);
      if(selected==="silero-xenia")return await speakSilero(text,"xenia",opts);
      if(selected==="silero-kseniya")return await speakSilero(text,"kseniya",opts);
    }catch(error){
      setStatus(`⚠️ ${String(error?.message||error).slice(0,150)} → включён fallback.`);
    }
    return previousSpeak?.(text,opts);
  }

  async function test(){
    const phrase="Привет! Я Kitsune. Теперь мой голос работает локально, без платного облачного синтеза.";
    return speak(phrase,{state:"happy",force:true});
  }

  function setStatus(text){
    const el=document.querySelector("#v231VoiceStatus");
    if(el&&el.textContent!==text)el.textContent=text;
  }

  function markup(){
    const mobile=isMobile();
    return `<section id="v231LocalVoiceLab" style="margin-top:10px;padding:10px;border:2px solid var(--line);border-radius:12px;background:var(--card)">
      <div style="display:flex;justify-content:space-between;gap:8px;align-items:start">
        <div><b>🎙️ Локальные голоса Kitsune</b><small style="display:block;color:var(--muted);margin-top:2px">Без платного TTS и без отправки текста в облачный голос</small></div>
        <span style="font-size:8px;font-weight:900;color:var(--muted)">v${VERSION}</span>
      </div>
      <div style="display:grid;gap:7px;margin-top:9px">
        <label style="display:flex;gap:8px;align-items:start;padding:8px;border:1px solid var(--line);border-radius:9px">
          <input type="radio" name="v231voice" value="piper-irina" ${selected==="piper-irina"?"checked":""}>
          <span><b>Piper Irina</b><small style="display:block;color:var(--muted)">Женский русский · ~63 МБ · браузер · ПК / Android / iPhone</small></span>
        </label>
        <label style="display:flex;gap:8px;align-items:start;padding:8px;border:1px solid var(--line);border-radius:9px;${mobile?"opacity:.55":""}">
          <input type="radio" name="v231voice" value="silero-xenia" ${selected==="silero-xenia"?"checked":""} ${mobile?"disabled":""}>
          <span><b>Silero Xenia</b><small style="display:block;color:var(--muted)">Настоящий Silero · локально на ПК через optional bridge</small></span>
        </label>
        <label style="display:flex;gap:8px;align-items:start;padding:8px;border:1px solid var(--line);border-radius:9px;${mobile?"opacity:.55":""}">
          <input type="radio" name="v231voice" value="silero-kseniya" ${selected==="silero-kseniya"?"checked":""} ${mobile?"disabled":""}>
          <span><b>Silero Kseniya</b><small style="display:block;color:var(--muted)">Настоящий Silero · локально на ПК через optional bridge</small></span>
        </label>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:9px">
        <button type="button" class="v15-action primary-action" id="v231PrepareIrina">⬇ Подготовить Irina</button>
        <button type="button" class="v15-action" id="v231TestVoice">▶ Проверить выбранный</button>
        ${mobile?"":'<button type="button" class="v15-action" id="v231CheckSilero">ПК · проверить Silero</button>'}
      </div>
      <div id="v231VoiceStatus" style="margin-top:7px;font-size:9px;color:var(--muted)">Piper Irina — основной бесплатный локальный голос.</div>
      <p style="margin:7px 0 0;font-size:8.5px;color:var(--muted);line-height:1.45">
        Silero официально распространяется как PyTorch-модель и пока не имеет стабильного прямого browser-runtime для нашей статической PWA.
        Поэтому Xenia/Kseniya подключены без облака через локальный ПК-мост. На мобильных устройствах выбран Piper Irina.
      </p>
    </section>`;
  }

  function render(){
    document.querySelectorAll('input[name="v231voice"]').forEach(input=>{
      input.checked=input.value===selected;
    });
    const prep=document.querySelector("#v231PrepareIrina");
    if(prep){
      prep.disabled=busy;
      prep.textContent=piperReady?"✅ Irina сохранена":"⬇ Подготовить Irina";
    }
  }

  function inject(){
    const host=document.querySelector("#v17NeuralVoice")||document.querySelector("#v151VoiceSettings");
    if(!host||document.querySelector("#v231LocalVoiceLab"))return;
    host.insertAdjacentHTML("beforeend",markup());

    host.querySelectorAll('input[name="v231voice"]').forEach(input=>{
      input.addEventListener("change",()=>{
        if(!input.checked)return;
        selected=input.value;save();render();
        if(selected.startsWith("silero-"))checkSilero();
        else setStatus("Piper Irina выбрана. Если ещё не скачана — нажми «Подготовить Irina».");
      });
    });
    host.querySelector("#v231PrepareIrina")?.addEventListener("click",prepareIrina);
    host.querySelector("#v231TestVoice")?.addEventListener("click",test);
    host.querySelector("#v231CheckSilero")?.addEventListener("click",checkSilero);

    piperStored().then(()=>render()).catch(()=>{});
  }

  window.v151Speak=function(text,opts={}){
    speak(text,opts);
    return true;
  };
  window.v161StopSpeech=function(){
    stop();
    try{return previousStop?.apply(this,arguments)}catch{}
  };

  window.KitsuneLocalVoiceLab={
    version:VERSION,
    selected:()=>selected,
    select:id=>{
      if(["piper-irina","silero-xenia","silero-kseniya","legacy"].includes(id)){
        selected=id;save();render();return true;
      }
      return false;
    },
    prepareIrina,
    checkSilero,
    test,
    speak,
    stop,
    status:()=>({selected,piperReady,sileroOnline,lastEngine})
  };

  new MutationObserver(()=>inject()).observe(document.body,{childList:true,subtree:true});
  inject();
  setTimeout(inject,300);
})();
