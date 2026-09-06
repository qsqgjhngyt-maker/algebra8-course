/* =====================================================================
   Kitsune v2.3.0-beta.3.8.3 · UNIFIED VOICE + iPHONE STABILITY

   One path for:
   - manual «🎙️ Говорить» button;
   - «Разговор без рук»;
   - wake -> dialogue -> listen.

   iPhone safe sequence:
   wake mic OFF -> Piper runtime released -> old Whisper runtime released
   -> raw PCM capture -> local Whisper Tiny -> Whisper worker released
   -> text enters the existing Kitsune Router -> Piper may speak.

   This prevents overlapping microphone / AudioContext / Whisper / Piper
   runtimes, which is a common reason Safari/PWA gets killed and reloads.
   ===================================================================== */
(() => {
  "use strict";

  const VERSION="2.3.0-beta.3.8.3";
  const ENABLED_KEY="a8_kitsune_unified_voice_v2383";
  const DESKTOP_ACCURATE_KEY="a8_kitsune_desktop_whisper_base_v2383";
  const OLD_WHISPER_READY_KEY="a8_kitsune_whisper_ready_v19";
  const CRASH_MARKER="a8_kitsune_voice_session_marker_v2383";

  let enabled=readBool(ENABLED_KEY,true);
  let desktopAccurate=readBool(DESKTOP_ACCURATE_KEY,true);

  let api=null;
  let originalStart=null;
  let originalStop=null;
  let originalRelease=null;
  let originalPrepare=null;
  let originalStatus=null;
  let originalSend=null;

  let worker=null;
  let workerReady=false;
  let workerLoading=false;
  let preparePromise=null;
  let workerMode="";
  let waiters=new Map();
  let seq=0;

  let sessionBusy=false;
  let recording=false;
  let stream=null;
  let audioCtx=null;
  let sourceNode=null;
  let processorNode=null;
  let muteGain=null;
  let pcmChunks=[];
  let totalSamples=0;
  let sampleRate=48000;
  let startedAt=0;
  let lastVoiceAt=0;
  let speechSeen=false;
  let speechFrames=0;
  let noiseFloor=.008;
  let noSpeechTimer=null;
  let hardStopTimer=null;
  let stopResolver=null;
  let retryBudget=1;
  let retryTimer=null;

  function readBool(key,fallback){
    try{
      const value=localStorage.getItem(key);
      return value===null?fallback:value==="1";
    }catch{return fallback}
  }

  function writeBool(key,value){
    try{localStorage.setItem(key,value?"1":"0")}catch{}
  }

  function sleep(ms){
    return new Promise(resolve=>setTimeout(resolve,ms));
  }

  function isIOSLike(){
    const ua=String(navigator.userAgent||"");
    const platform=String(navigator.platform||"");
    return /iPhone|iPad|iPod/i.test(ua) ||
      (platform==="MacIntel"&&Number(navigator.maxTouchPoints)>1);
  }

  function isMobileLike(){
    return isIOSLike()||/Android|Mobile/i.test(String(navigator.userAgent||""));
  }

  function dialogOpen(){
    return !!document.querySelector("#v19Dialog.show") ||
      document.body.classList.contains("v19-dialog-open");
  }

  function handsFreeEnabled(){
    return !!document.querySelector("#v237HandsFree")?.checked;
  }

  function setStatus(text,kind=""){
    const live=document.querySelector("#v19DialogLive");
    if(live&&dialogOpen()){
      if(live.textContent!==text)live.textContent=text||"";
      live.className=`v19-dialog-live ${kind}`.trim();
    }

    const status=document.querySelector("#v2383VoiceStatus");
    if(status){
      status.textContent=text||"";
      status.dataset.kind=kind;
    }
  }

  function setMicUi(active){
    const button=document.querySelector("#v19Dialog .v19-mic-btn");
    if(!button)return;
    button.setAttribute("aria-pressed",active?"true":"false");
    button.classList.toggle("recording",!!active);
    button.textContent=active?"⏹ Стоп":"🎙️ Говорить";
  }

  function markVoiceSession(){
    try{
      sessionStorage.setItem(CRASH_MARKER,JSON.stringify({
        ts:Date.now(),
        ios:isIOSLike(),
        dialog:dialogOpen()
      }));
    }catch{}
  }

  function clearVoiceSessionMarker(){
    try{sessionStorage.removeItem(CRASH_MARKER)}catch{}
  }

  function previousInterruptedSession(){
    try{
      const raw=sessionStorage.getItem(CRASH_MARKER);
      if(!raw)return false;
      const data=JSON.parse(raw);
      sessionStorage.removeItem(CRASH_MARKER);
      return !!(data?.ios&&Date.now()-Number(data.ts||0)<45000);
    }catch{return false}
  }

  async function preferredBackend(){
    /* iOS stays on single-thread WASM. No experimental WebGPU ASR there. */
    if(isIOSLike())return "wasm";
    if(!navigator.gpu)return "wasm";
    try{return (await navigator.gpu.requestAdapter())?"webgpu":"wasm"}
    catch{return "wasm"}
  }

  function preferredModel(){
    /* Never load Base on iPhone/phone automatically. Stability first. */
    if(isMobileLike())return "tiny";
    return desktopAccurate?"base":"tiny";
  }

  function createWaiter(key,timeout=120000){
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{
        waiters.delete(key);
        reject(new Error("Локальная модель не ответила вовремя."));
      },timeout);

      waiters.set(key,{resolve,reject,timer});
    });
  }

  function resolveWaiter(key,value,error=null){
    const waiter=waiters.get(key);
    if(!waiter)return;
    waiters.delete(key);
    clearTimeout(waiter.timer);
    if(error)waiter.reject(error);
    else waiter.resolve(value);
  }

  function ensureWorker(){
    if(worker)return worker;

    worker=new Worker(
      "./voice-asr-worker-v2383.js",
      {type:"module",name:"kitsune-unified-asr"}
    );

    worker.onmessage=event=>{
      const m=event.data||{};

      if(m.type==="progress"){
        const pct=Number.isFinite(m.progress)?` · ${Math.round(m.progress)}%`:"";
        setStatus(`⬇ Подготавливаю распознавание${pct} · ${m.file||""}`,"thinking");
        return;
      }

      if(m.type==="status"){
        setStatus(m.text||"Подготавливаю распознавание…","thinking");
        return;
      }

      if(m.type==="ready"){
        workerReady=true;
        workerLoading=false;
        workerMode=/whisper-base/.test(String(m.model||""))?"base":"tiny";
        resolveWaiter("load",true);
        updateSettingsUi();
        return;
      }

      if(m.type==="fallback"){
        setStatus("⚠️ Включён облегчённый локальный режим Whisper Tiny.","warn");
        return;
      }

      if(m.type==="transcribing"){
        setStatus("🧠 Преобразую речь в текст…","thinking");
        return;
      }

      if(m.type==="result"||m.type==="resultError"){
        const waiter=waiters.get(m.id);
        if(!waiter)return;
        waiters.delete(m.id);
        clearTimeout(waiter.timer);
        if(m.type==="result")waiter.resolve(m);
        else waiter.reject(new Error(m.message||"Ошибка распознавания"));
        return;
      }

      if(m.type==="error"){
        workerReady=false;
        workerLoading=false;
        resolveWaiter("load",false,new Error(m.message||"Ошибка модели"));
        updateSettingsUi();
      }
    };

    worker.onerror=event=>{
      workerReady=false;
      workerLoading=false;
      resolveWaiter(
        "load",
        false,
        new Error(String(event?.message||"Ошибка локального ASR worker"))
      );
      updateSettingsUi();
    };

    return worker;
  }

  async function releaseOwnWorker(){
    for(const [key,waiter] of waiters){
      clearTimeout(waiter.timer);
      try{waiter.reject(new Error("ASR runtime released"))}catch{}
    }
    waiters.clear();

    try{worker?.postMessage?.({type:"release"})}catch{}
    try{worker?.terminate?.()}catch{}

    worker=null;
    workerReady=false;
    workerLoading=false;
    workerMode="";
    preparePromise=null;
    updateSettingsUi();
  }

  async function prepareWorker(){
    const mode=preferredModel();

    if(workerReady&&workerMode===mode)return true;
    if(preparePromise)return preparePromise;

    preparePromise=(async()=>{
      workerLoading=true;
      updateSettingsUi();

      const preferred=await preferredBackend();

      if(workerReady&&workerMode!==mode){
        await releaseOwnWorker();
        workerLoading=true;
      }

      const w=ensureWorker();
      const promise=createWaiter("load",120000);

      w.postMessage({
        type:"load",
        model:mode,
        preferred
      });

      try{
        await promise;
        return workerReady;
      }finally{
        workerLoading=false;
        updateSettingsUi();
      }
    })();

    try{
      return await preparePromise;
    }finally{
      preparePromise=null;
    }
  }

  async function stopWakeAndWait(){
    try{
      const wake=window.KitsunePresence?.wake;
      if(wake?.stop){
        await wake.stop("voice-session",true);
      }
    }catch{}

    /* Give iOS AVAudioSession / WebKit a moment to really release the input. */
    for(let i=0;i<8;i++){
      const status=window.KitsunePresence?.wake?.status?.();
      if(!status?.listening)break;
      await sleep(60);
    }

    await sleep(isIOSLike()?360:120);
  }

  async function makeVoiceRuntimeExclusive(){
    /* Stop current TTS before opening a microphone. */
    try{window.v161StopSpeech?.()}catch{}
    try{window.speechSynthesis?.cancel?.()}catch{}

    await stopWakeAndWait();

    if(isIOSLike()){
      /* Piper + Whisper at the same time is expensive on iPhone.
         Keep only one heavy speech runtime resident at once. */
      try{await window.KitsuneLiveConversation?.release?.()}catch{}
      await sleep(120);
    }

    /* The old v19 runtime may have auto-restored after a PWA update.
       Terminate it before our unified worker is created. Browser model cache
       remains intact. */
    try{await originalRelease?.()}catch{}
    await sleep(isIOSLike()?220:80);
  }

  function rmsOf(data){
    let sum=0;
    for(let i=0;i<data.length;i++){
      const x=data[i];
      sum+=x*x;
    }
    return Math.sqrt(sum/Math.max(1,data.length));
  }

  function concatChunks(chunks,length){
    const out=new Float32Array(length);
    let offset=0;
    for(const chunk of chunks){
      out.set(chunk,offset);
      offset+=chunk.length;
    }
    return out;
  }

  function resampleLinear(input,from,to=16000){
    if(!input?.length)return new Float32Array();
    if(from===to)return input;

    const ratio=from/to;
    const outLength=Math.max(1,Math.round(input.length/ratio));
    const out=new Float32Array(outLength);

    for(let i=0;i<outLength;i++){
      const pos=i*ratio;
      const a=Math.floor(pos);
      const b=Math.min(input.length-1,a+1);
      const f=pos-a;
      out[i]=input[a]*(1-f)+input[b]*f;
    }

    return out;
  }

  function trimNormalize(samples,rate=16000){
    if(!samples?.length)return new Float32Array();

    let mean=0;
    for(const x of samples)mean+=x;
    mean/=samples.length;

    const clean=new Float32Array(samples.length);
    for(let i=0;i<samples.length;i++)clean[i]=samples[i]-mean;

    const frame=Math.max(160,Math.round(rate*.02));
    const firstNoise=Math.min(clean.length,Math.round(rate*.30));

    let noiseSum=0;
    let noiseCount=0;

    for(let i=0;i+frame<=firstNoise;i+=frame){
      noiseSum+=rmsOf(clean.subarray(i,i+frame));
      noiseCount++;
    }

    const noise=noiseCount?noiseSum/noiseCount:.004;
    const threshold=Math.max(.0045,Math.min(.035,noise*2.2+.0015));

    let start=0;
    let end=clean.length;
    let found=false;

    for(let i=0;i+frame<=clean.length;i+=frame){
      if(rmsOf(clean.subarray(i,i+frame))>threshold){
        start=i;
        found=true;
        break;
      }
    }

    if(found){
      for(let i=clean.length-frame;i>=0;i-=frame){
        if(rmsOf(clean.subarray(i,i+frame))>threshold){
          end=Math.min(clean.length,i+frame);
          break;
        }
      }
    }

    start=Math.max(0,start-Math.round(rate*.20));
    end=Math.min(clean.length,end+Math.round(rate*.32));

    const trimmed=clean.slice(start,end);
    const level=rmsOf(trimmed);
    const gain=level>0?Math.max(.85,Math.min(2.7,.072/level)):1;

    for(let i=0;i<trimmed.length;i++){
      trimmed[i]=Math.max(-.98,Math.min(.98,trimmed[i]*gain));
    }

    return trimmed;
  }

  function normalizeTranscript(raw){
    let text=String(raw||"")
      .replace(/<\|[^|>]+\|>/g," ")
      .replace(/\[(?:музыка|шум|тишина|аплодисменты)\]/gi," ")
      .replace(/\((?:музыка|шум|тишина|аплодисменты)\)/gi," ")
      .replace(/\s+/g," ")
      .trim();

    const replacements=[
      [/\bдискр[еи]м[еи]нант\b/gi,"дискриминант"],
      [/\bдискриминат\b/gi,"дискриминант"],
      [/\bкоэф+иц[ие]ент\b/gi,"коэффициент"],
      [/\bкитсун[эеы]\b/gi,"Китсуне"],
      [/\bквадратн[ао]е уравнен[иея]\b/gi,"квадратное уравнение"],
      [/\bикс\b/gi,"x"]
    ];

    for(const [rx,to] of replacements)text=text.replace(rx,to);

    if(text&&/^[а-яё]/i.test(text)){
      text=text[0].toUpperCase()+text.slice(1);
    }

    return text;
  }

  function transcriptProblem(text){
    const s=String(text||"").trim();
    if(!s)return "empty";
    if(s.length>700)return "too_long";

    if(/спасибо за просмотр|продолжение следует|субтитры.{0,24}(?:сделал|создал|редактор)|редактор субтитров|корректор субтитров|подписывайтесь на канал/i.test(s)){
      return "hallucination";
    }

    const tokens=(s.toLowerCase().match(/[а-яёa-z0-9]+/gi)||[]);
    if(!tokens.length)return "no_words";

    if(tokens.length>=6){
      const counts=new Map();
      for(const token of tokens)counts.set(token,(counts.get(token)||0)+1);
      const max=Math.max(...counts.values());
      if(max/tokens.length>.58)return "repetition";
    }

    const cyr=(s.match(/[а-яё]/gi)||[]).length;
    const letters=(s.match(/[a-zа-яё]/gi)||[]).length;
    if(letters>=8&&cyr/letters<.30&&!/[0-9x]/i.test(s))return "language";

    return "";
  }

  function cleanupCapture(){
    clearTimeout(noSpeechTimer);
    clearTimeout(hardStopTimer);

    try{processorNode&&(processorNode.onaudioprocess=null)}catch{}
    try{sourceNode?.disconnect?.()}catch{}
    try{processorNode?.disconnect?.()}catch{}
    try{muteGain?.disconnect?.()}catch{}
    try{stream?.getTracks?.().forEach(track=>track.stop())}catch{}
    try{audioCtx?.close?.()}catch{}

    stream=null;
    audioCtx=null;
    sourceNode=null;
    processorNode=null;
    muteGain=null;
    recording=false;
    setMicUi(false);
  }

  function finishCapture(reason="silence"){
    if(!recording)return;

    recording=false;

    const resolver=stopResolver;
    stopResolver=null;

    const chunks=pcmChunks;
    const length=totalSamples;
    const rate=sampleRate;
    const heard=speechSeen;

    cleanupCapture();

    const pcm=concatChunks(chunks,length);
    pcmChunks=[];
    totalSamples=0;

    resolver?.({pcm,rate,heard,reason});
  }

  async function captureUtterance(){
    if(!navigator.mediaDevices?.getUserMedia){
      throw new Error("Микрофон недоступен в этом браузере.");
    }

    stream=await navigator.mediaDevices.getUserMedia({
      audio:{
        channelCount:1,
        echoCancellation:true,
        noiseSuppression:true,
        autoGainControl:true
      },
      video:false
    });

    const AC=window.AudioContext||window.webkitAudioContext;
    audioCtx=new AC({latencyHint:"interactive"});

    if(audioCtx.state==="suspended"){
      try{await audioCtx.resume()}catch{}
    }

    sampleRate=audioCtx.sampleRate||48000;
    sourceNode=audioCtx.createMediaStreamSource(stream);

    processorNode=audioCtx.createScriptProcessor(2048,1,1);
    muteGain=audioCtx.createGain();
    muteGain.gain.value=0;

    sourceNode.connect(processorNode);
    processorNode.connect(muteGain);
    muteGain.connect(audioCtx.destination);

    pcmChunks=[];
    totalSamples=0;
    startedAt=performance.now();
    lastVoiceAt=startedAt;
    speechSeen=false;
    speechFrames=0;
    noiseFloor=.008;
    recording=true;

    setMicUi(true);
    setStatus("👂 Слушаю… говори обычным темпом. Короткие паузы можно.","listening");

    const result=new Promise(resolve=>{
      stopResolver=resolve;
    });

    processorNode.onaudioprocess=event=>{
      if(!recording)return;

      const input=event.inputBuffer.getChannelData(0);
      const copy=new Float32Array(input.length);
      copy.set(input);

      pcmChunks.push(copy);
      totalSamples+=copy.length;

      const rms=rmsOf(copy);
      const now=performance.now();
      const elapsed=now-startedAt;

      if(!speechSeen&&rms<.025){
        noiseFloor=noiseFloor*.93+rms*.07;
      }

      const threshold=Math.max(.0105,Math.min(.043,noiseFloor*2.65+.003));

      if(rms>threshold){
        speechFrames++;
        if(speechFrames>=2)speechSeen=true;
        if(speechSeen)lastVoiceAt=now;
      }else{
        speechFrames=Math.max(0,speechFrames-1);
      }

      /* Old mode stopped after 1.45 s. 2.2 s is much more natural in Russian. */
      if(speechSeen&&elapsed>900&&now-lastVoiceAt>2200){
        finishCapture("silence");
      }
    };

    noSpeechTimer=setTimeout(()=>{
      if(recording&&!speechSeen)finishCapture("no_speech");
    },7500);

    hardStopTimer=setTimeout(()=>{
      if(recording)finishCapture("max");
    },22000);

    return result;
  }

  async function transcribe(samples){
    const id=++seq;
    const w=ensureWorker();

    const promise=new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{
        waiters.delete(id);
        reject(new Error("Whisper не ответил за отведённое время."));
      },90000);

      waiters.set(id,{resolve,reject,timer});
    });

    const copy=samples.slice();

    w.postMessage({
      type:"transcribe",
      id,
      model:preferredModel(),
      preferred:await preferredBackend(),
      samples:copy.buffer
    },[copy.buffer]);

    const result=await promise;
    return normalizeTranscript(result?.text||"");
  }

  function scheduleOneRetry(){
    clearTimeout(retryTimer);

    if(
      retryBudget<=0 ||
      !handsFreeEnabled() ||
      document.hidden ||
      !dialogOpen()
    ){
      return;
    }

    retryBudget--;

    retryTimer=setTimeout(()=>{
      if(!sessionBusy&&dialogOpen()&&!document.hidden){
        startUnified(true).catch(()=>{});
      }
    },1100);
  }

  async function startUnified(fromRetry=false){
    if(!enabled){
      return originalStart?.();
    }

    if(recording){
      finishCapture("manual");
      return true;
    }

    if(sessionBusy||document.hidden||!dialogOpen())return false;

    if(!fromRetry)retryBudget=1;
    sessionBusy=true;
    markVoiceSession();
    updateSettingsUi();

    try{
      setStatus(
        isIOSLike()
          ?"🎙️ Освобождаю микрофон и память iPhone…"
          :"🎙️ Подготавливаю микрофон…",
        "thinking"
      );

      await makeVoiceRuntimeExclusive();
      await prepareWorker();

      const captured=await captureUtterance();

      if(!captured.heard||captured.reason==="no_speech"){
        setStatus("Я не услышала вопрос. Попробуй сказать чуть ближе к микрофону.","warn");
        scheduleOneRetry();
        return false;
      }

      let samples=resampleLinear(captured.pcm,captured.rate,16000);
      samples=trimNormalize(samples,16000);

      if(samples.length<Math.round(16000*.45)){
        setStatus("Фраза получилась слишком короткой. Повтори её спокойнее.","warn");
        scheduleOneRetry();
        return false;
      }

      setStatus("🧠 Преобразую речь в нормальный текст…","thinking");
      const text=await transcribe(samples);
      const problem=transcriptProblem(text);

      const input=document.querySelector("#v19DialogInput");

      if(problem){
        if(input&&text)input.value=text;
        setStatus(
          "Я не уверена, что правильно расслышала — не отправляю случайный текст. Повтори вопрос.",
          "warn"
        );
        scheduleOneRetry();
        return false;
      }

      if(input)input.value=text;
      setStatus(`🎙️ Я услышала: «${text}»`,"ok");

      /* Critical iPhone memory rule:
         transcription is finished, so remove Whisper BEFORE Router/Qwen/Piper. */
      if(isIOSLike()){
        await releaseOwnWorker();
        await sleep(180);
      }

      await sleep(260);

      if(input)input.value="";
      await originalSend?.(text);

      return true;
    }catch(error){
      cleanupCapture();

      setStatus(
        "Голосовой ввод не завершился: "+
          String(error?.message||error).slice(0,120)+
          ". Попробуй ещё раз.",
        "warn"
      );

      scheduleOneRetry();
      return false;
    }finally{
      sessionBusy=false;
      clearVoiceSessionMarker();
      setMicUi(false);
      updateSettingsUi();
    }
  }

  function stopUnified(){
    clearTimeout(retryTimer);

    if(recording){
      finishCapture("manual");
      return true;
    }

    try{return originalStop?.()}catch{return false}
  }

  async function releaseUnified(){
    clearTimeout(retryTimer);
    if(recording)finishCapture("release");
    await releaseOwnWorker();
    try{await originalRelease?.()}catch{}
    return true;
  }

  async function prepareUnified(){
    await makeVoiceRuntimeExclusive();
    await prepareWorker();

    if(isIOSLike()){
      setStatus("✅ Whisper Tiny подготовлен. На iPhone он будет подниматься из локального кэша только на время диктовки.","ok");
      await releaseOwnWorker();
    }else{
      setStatus(
        preferredModel()==="base"
          ?"✅ Whisper Base готов — максимальная точность на ПК."
          :"✅ Whisper Tiny готов.",
        "ok"
      );
    }

    return true;
  }

  function updateSettingsUi(){
    const enable=document.querySelector("#v2383VoiceEnabled");
    if(enable)enable.checked=enabled;

    const accurate=document.querySelector("#v2383DesktopAccurate");
    if(accurate){
      accurate.checked=desktopAccurate;
      accurate.disabled=isMobileLike();
    }

    const prepare=document.querySelector("#v2383PrepareVoice");
    if(prepare){
      prepare.disabled=workerLoading||sessionBusy;
      prepare.textContent=workerLoading
        ?"⏳ Подготавливаю Whisper…"
        :"⬇ Подготовить единый голосовой ввод";
    }
  }

  function injectSettings(){
    const host=document.querySelector("#v237LiveVoiceSettings")||
      document.querySelector("#v19VoiceSettings")||
      document.querySelector("#v15Settings");

    if(!host||document.querySelector("#v2383VoiceStability"))return;

    const block=document.createElement("div");
    block.id="v2383VoiceStability";
    block.style.cssText="margin-top:10px;padding-top:10px;border-top:1px solid var(--line);font-size:11px";
    block.innerHTML=`
      <div style="display:flex;justify-content:space-between;gap:10px">
        <div>
          <strong>🎯 Единый голосовой ввод</strong>
          <div style="opacity:.75;margin-top:2px">
            Кнопка «Говорить» + hands-free · чистый PCM · локальный Whisper
          </div>
        </div>
        <span>v${VERSION}</span>
      </div>

      <label style="display:flex;gap:7px;align-items:flex-start;margin-top:9px;cursor:pointer">
        <input id="v2383VoiceEnabled" type="checkbox">
        <span><b>Использовать новый стабильный голосовой ввод</b><br>
        <small>Одинаковый движок для кнопки и разговора без рук.</small></span>
      </label>

      <label style="display:flex;gap:7px;align-items:flex-start;margin-top:8px;cursor:pointer">
        <input id="v2383DesktopAccurate" type="checkbox">
        <span><b>Максимальная точность на ПК · Whisper Base</b><br>
        <small>На iPhone/Android принудительно используется лёгкий Tiny для стабильности.</small></span>
      </label>

      <div id="v2383VoiceStatus" style="margin:9px 0;opacity:.82">
        ${isIOSLike()
          ?"iPhone safe mode: один тяжёлый голосовой runtime за раз."
          :"Новый голосовой ввод готов к подготовке."}
      </div>

      <button id="v2383PrepareVoice" type="button" class="v15-action primary-action">
        ⬇ Подготовить единый голосовой ввод
      </button>

      <p style="margin:8px 0 0;opacity:.72">
        Аудио остаётся на устройстве. Web Speech API и Cloud STT не используются.
      </p>
    `;

    host.appendChild(block);

    block.querySelector("#v2383VoiceEnabled")?.addEventListener("change",event=>{
      enabled=!!event.target.checked;
      writeBool(ENABLED_KEY,enabled);
      updateSettingsUi();
    });

    block.querySelector("#v2383DesktopAccurate")?.addEventListener("change",async event=>{
      desktopAccurate=!!event.target.checked;
      writeBool(DESKTOP_ACCURATE_KEY,desktopAccurate);
      await releaseOwnWorker();
      updateSettingsUi();
    });

    block.querySelector("#v2383PrepareVoice")?.addEventListener("click",async()=>{
      try{
        await prepareUnified();
      }catch(error){
        setStatus(
          "Не удалось подготовить Whisper: "+
            String(error?.message||error).slice(0,120),
          "warn"
        );
      }
    });

    updateSettingsUi();
  }

  function interceptManualMic(){
    document.addEventListener("click",event=>{
      const button=event.target.closest?.("#v19Dialog .v19-mic-btn");
      if(!button||!enabled)return;

      /* The old v19 button has a closure-bound click handler. Stop it here
         and route the button through the exact same API as hands-free. */
      event.preventDefault();
      event.stopImmediatePropagation();

      if(recording){
        stopUnified();
      }else{
        startUnified(false).catch(()=>{});
      }
    },true);
  }

  function patchApi(){
    api=window.KitsuneVoiceDialogue;
    if(!api||api.__unifiedVoiceV2383)return false;

    originalStart=typeof api.start==="function"?api.start.bind(api):null;
    originalStop=typeof api.stop==="function"?api.stop.bind(api):null;
    originalRelease=typeof api.release==="function"?api.release.bind(api):null;
    originalPrepare=typeof api.prepare==="function"?api.prepare.bind(api):null;
    originalStatus=typeof api.status==="function"?api.status.bind(api):null;
    originalSend=typeof api.send==="function"?api.send.bind(api):null;

    api.start=startUnified;
    api.stop=stopUnified;
    api.release=releaseUnified;
    api.prepareUnified=prepareUnified;

    api.status=()=>{
      const base=originalStatus?.()||{};
      return {
        ...base,
        cachedMarker:
          !!base.cachedMarker ||
          localStorage.getItem(OLD_WHISPER_READY_KEY)==="1" ||
          workerReady,
        runtimeReady:workerReady,
        unifiedVoice:true,
        unifiedVersion:VERSION,
        iosSafeMode:isIOSLike(),
        recording,
        sessionBusy,
        model:preferredModel()
      };
    };

    api.__unifiedVoiceV2383=true;
    return true;
  }

  const interrupted=previousInterruptedSession();

  function install(){
    if(!patchApi())return false;

    injectSettings();
    interceptManualMic();

    if(interrupted&&isIOSLike()){
      setTimeout(()=>{
        setStatus(
          "iPhone сообщил о прерванной прошлой голосовой сессии. Включён безопасный последовательный режим.",
          "warn"
        );
      },900);
    }

    const timer=setInterval(()=>{
      injectSettings();
      if(document.querySelector("#v2383VoiceStability"))clearInterval(timer);
    },700);

    document.addEventListener("visibilitychange",()=>{
      if(document.hidden){
        clearTimeout(retryTimer);
        if(recording)finishCapture("hidden");
      }
    });

    window.addEventListener("pagehide",()=>{
      clearTimeout(retryTimer);
      if(recording)finishCapture("pagehide");
      releaseOwnWorker().catch(()=>{});
    },{once:true});

    return true;
  }

  if(!install()){
    let tries=0;
    const timer=setInterval(()=>{
      tries++;
      if(install()||tries>40)clearInterval(timer);
    },250);
  }

  window.KitsuneUnifiedVoice={
    version:VERSION,
    prepare:prepareUnified,
    release:releaseUnified,
    start:()=>startUnified(false),
    stop:stopUnified,
    status:()=>({
      enabled,
      ios:isIOSLike(),
      mobile:isMobileLike(),
      workerReady,
      workerMode,
      recording,
      sessionBusy,
      preferredModel:preferredModel()
    }),
    normalizeTranscript,
    transcriptProblem
  };
})();
