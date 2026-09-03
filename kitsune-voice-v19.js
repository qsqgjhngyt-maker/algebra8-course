
/* =====================================================================
   v1.9.0 · KITSUNE VOICE DIALOGUE
   Push-to-talk → local Whisper → Kitsune Brain → Neural/System Voice.
   Audio is decoded locally and passed to Transformers.js in a Web Worker.
   ===================================================================== */
(() => {
  "use strict";

  const VERSION="1.11.3";
  const TRANSFORMERS_URL="https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.2.0";
  const WHISPER_MODEL="onnx-community/whisper-tiny";

  const READY_KEY="a8_kitsune_whisper_ready_v19";
  const VOICE_REPLY_KEY="a8_kitsune_voice_reply_v19";
  const HISTORY_KEY="a8_kitsune_dialog_history_v19";

  let whisperReady=false;
  let voiceReplies=true;
  let history=[];
  let activeCtx=null;
  let worker=null;
  let workerReady=false;
  let workerLoading=false;
  let workerWaiters=new Map();
  let seq=0;

  let stream=null;
  let recorder=null;
  let chunks=[];
  let recAudioCtx=null;
  let analyser=null;
  let raf=0;
  let speechSeen=false;
  let lastVoice=0;
  let startedAt=0;
  let maxTimer=null;
  let recording=false;

  try{
    whisperReady=localStorage.getItem(READY_KEY)==="1";
    const vr=localStorage.getItem(VOICE_REPLY_KEY);
    voiceReplies=vr===null?true:vr==="1";
    history=JSON.parse(localStorage.getItem(HISTORY_KEY)||"[]");
    if(!Array.isArray(history))history=[];
    history=history.slice(-20);
  }catch(e){}

  function save(){
    try{
      localStorage.setItem(READY_KEY,whisperReady?"1":"0");
      localStorage.setItem(VOICE_REPLY_KEY,voiceReplies?"1":"0");
      localStorage.setItem(HISTORY_KEY,JSON.stringify(history.slice(-20)));
    }catch(e){}
  }

  function strip(s){
    const d=document.createElement("div");
    d.innerHTML=String(s??"");
    return (d.textContent||"").replace(/\s+/g," ").trim();
  }

  function currentCtx(){
    if(activeCtx?.exercise)return activeCtx;
    try{
      if(typeof v16CurrentContext==="function"){
        const c=v16CurrentContext();
        if(c?.exercise)return c;
      }
    }catch(e){}
    return null;
  }

  function contextLabel(ctx){
    if(!ctx)return "Свободный разговор · без выбранного задания";
    return `${strip(ctx.lesson?.title||"Текущий урок")} · ${strip(ctx.exercise?.q||"").slice(0,90)}`;
  }

  function workerSource(){
    return `
      const LIB=${JSON.stringify(TRANSFORMERS_URL)};
      const MODEL=${JSON.stringify(WHISPER_MODEL)};
      let transcriber=null;
      let loading=null;

      function post(type,data={}){ self.postMessage({type,...data}); }

      async function load(useWebGPU){
        if(transcriber)return transcriber;
        if(loading)return loading;
        loading=(async()=>{
          try{
            post("status",{text:"Загружаю Transformers.js…"});
            const {pipeline}=await import(LIB);
            const options={
              progress_callback:(p)=>{
                let progress=null;
                if(Number.isFinite(Number(p?.progress))){
                  const raw=Number(p.progress);
                  progress=raw<=1?raw*100:raw;
                }
                post("progress",{
                  progress,
                  status:String(p?.status||""),
                  file:String(p?.file||p?.name||"").split("/").pop()
                });
              }
            };
            if(useWebGPU){
              options.device="webgpu";
              options.dtype={encoder_model:"fp16",decoder_model_merged:"q4"};
            }else{
              options.dtype={encoder_model:"q8",decoder_model_merged:"q8"};
            }

            post("status",{text:useWebGPU
              ?"Подготавливаю Whisper на WebGPU…"
              :"WebGPU недоступен: подготавливаю более медленный WASM-режим…"});
            transcriber=await pipeline(
              "automatic-speech-recognition",
              MODEL,
              options
            );
            post("ready",{backend:useWebGPU?"WebGPU":"WASM"});
            return transcriber;
          }catch(err){
            transcriber=null;
            post("error",{message:String(err?.message||err)});
            throw err;
          }finally{
            loading=null;
          }
        })();
        return loading;
      }

      self.onmessage=async(e)=>{
        const m=e.data||{};
        if(m.type==="load"){
          try{await load(!!m.useWebGPU)}catch(e){}
          return;
        }
        if(m.type==="transcribe"){
          const id=m.id;
          try{
            const pipe=await load(!!m.useWebGPU);
            post("transcribing",{id});
            const samples=new Float32Array(m.samples);
            const result=await pipe(samples,{
              language:"russian",
              task:"transcribe",
              return_timestamps:false
            });
            post("result",{id,text:String(result?.text||"").trim()});
          }catch(err){
            post("resultError",{id,message:String(err?.message||err)});
          }
        }
      };
    `;
  }

  function ensureWorker(){
    if(worker)return worker;
    const blob=new Blob([workerSource()],{type:"text/javascript"});
    const url=URL.createObjectURL(blob);
    worker=new Worker(url,{type:"module"});
    URL.revokeObjectURL(url);

    worker.onmessage=e=>{
      const m=e.data||{};
      if(m.type==="progress"){
        const p=Number.isFinite(m.progress)?Math.max(0,Math.min(100,m.progress)):null;
        setWhisperProgress(p,m.file||m.status||"Загрузка");
      }else if(m.type==="status"){
        setWhisperStatus(m.text||"Подготовка…","busy");
      }else if(m.type==="ready"){
        workerReady=true;workerLoading=false;whisperReady=true;save();
        setWhisperProgress(null);
        setWhisperStatus(`✅ Whisper готов · ${m.backend}. Голосовой ввод работает локально.`,"ok");
        updateVoiceUi();
      }else if(m.type==="error"){
        workerReady=false;workerLoading=false;
        setWhisperProgress(null);
        setWhisperStatus("Whisper не запустился: "+String(m.message||"ошибка").slice(0,140),"warn");
        updateVoiceUi();
      }else if(m.type==="transcribing"){
        dialogState("🧠 Распознаю речь локально…","thinking");
      }else if(m.type==="result"||m.type==="resultError"){
        const w=workerWaiters.get(m.id);
        if(w){
          workerWaiters.delete(m.id);
          if(m.type==="result")w.resolve(m.text||"");
          else w.reject(new Error(m.message||"Ошибка распознавания"));
        }
      }
    };
    worker.onerror=e=>{
      workerLoading=false;
      setWhisperStatus("Ошибка локального Whisper worker: "+String(e.message||"").slice(0,120),"warn");
    };
    return worker;
  }

  async function useWebGPU(){
    if(!navigator.gpu)return false;
    try{return !!(await navigator.gpu.requestAdapter())}catch(e){return false}
  }

  async function prepareWhisper(){
    if(workerLoading||workerReady)return;
    if(location.protocol==="file:"){
      setWhisperStatus("Whisper проверяй на опубликованной HTTPS-версии GitHub Pages. Локальный preview оставляет только текстовый диалог.","warn");
      return;
    }
    workerLoading=true;
    updateVoiceUi();
    setWhisperStatus("Проверяю устройство…","busy");
    const gpu=await useWebGPU();
    ensureWorker().postMessage({type:"load",useWebGPU:gpu});
  }

  function setWhisperStatus(text,kind=""){
    document.querySelectorAll(".v19-whisper-status").forEach(el=>{
      el.textContent=text;
      el.className=`v19-whisper-status ${kind}`.trim();
    });
  }
  function setWhisperProgress(percent,label=""){
    document.querySelectorAll(".v19-whisper-progress").forEach(wrap=>{
      const bar=wrap.querySelector("i"),txt=wrap.querySelector("span");
      if(percent===null){
        wrap.classList.remove("show");return;
      }
      wrap.classList.add("show");
      const p=Number.isFinite(percent)?percent:8;
      if(bar)bar.style.width=`${p}%`;
      if(txt)txt.textContent=`${label}${Number.isFinite(percent)?` · ${Math.round(p)}%`:""}`;
    });
  }

  function injectSettings(){
    const host=document.querySelector("#v18KitsuneBrain")||document.querySelector("#v15Settings");
    if(!host||document.querySelector("#v19VoiceSettings"))return;

    const block=document.createElement("div");
    block.id="v19VoiceSettings";
    block.className="v19-voice-settings";
    block.innerHTML=`
      <div class="v19-voice-head">
        <div><strong>🎙️ Voice Dialogue</strong><small>локальный Whisper · русский язык</small></div>
        <span>v1.11.3</span>
      </div>
      <div class="v19-whisper-status">Whisper ещё не подготовлен. Текстовый диалог уже доступен.</div>
      <div class="v19-whisper-progress"><div><i></i></div><span></span></div>
      <button type="button" class="v15-action primary-action v19-prepare">⬇ Подготовить Whisper</button>
      <label class="v19-reply-toggle">
        <input type="checkbox" ${voiceReplies?"checked":""}>
        <span><b>🔊 Голосовые ответы</b><small>Kitsune отвечает вслух после текста или микрофона.</small></span>
      </label>
      <p>Микрофон работает локально: аудио преобразуется в 16 кГц и распознаётся Whisper в браузере. На устройстве без WebGPU включается более медленный WASM fallback.</p>`;
    host.appendChild(block);

    block.querySelector(".v19-prepare")?.addEventListener("click",prepareWhisper);
    block.querySelector("input")?.addEventListener("change",e=>{
      voiceReplies=!!e.target.checked;save();updateVoiceUi();
    });

    if(whisperReady)setWhisperStatus("Whisper был подготовлен ранее. При первом голосовом вводе загружу его из browser cache.","ok");
    updateVoiceUi();
  }

  function updateVoiceUi(){
    document.querySelectorAll(".v19-prepare").forEach(b=>{
      b.disabled=workerLoading||workerReady;
      b.textContent=workerReady?"✅ Whisper активен":whisperReady?"↻ Загрузить Whisper из кэша":"⬇ Подготовить Whisper";
    });
    document.querySelectorAll(".v19-mic-btn").forEach(b=>{
      b.classList.toggle("recording",recording);
      b.textContent=recording?"■ Стоп":"🎙️ Говорить";
      b.setAttribute("aria-pressed",recording?"true":"false");
    });
  }

  function syncVisualViewport(){
    const vv=window.visualViewport;
    const w=Math.round(vv?.width||window.innerWidth||document.documentElement.clientWidth||0);
    const h=Math.round(vv?.height||window.innerHeight||document.documentElement.clientHeight||0);
    const root=document.documentElement;
    if(w>0)root.style.setProperty("--v19-visual-w",`${w}px`);
    if(h>0)root.style.setProperty("--v19-visual-h",`${h}px`);
  }

  function dialogMarkup(){
    return `<div class="v19-dialog-backdrop" id="v19Dialog">
      <section class="v19-dialog-card" role="dialog" aria-modal="true" aria-labelledby="v19DialogTitle">
        <header class="v19-dialog-head">
          <div class="v19-dialog-avatar"><img src="./assets/kitsune/idle.png" alt="Kitsune" draggable="false"></div>
          <div>
            <strong id="v19DialogTitle">Разговор с Kitsune</strong>
            <small id="v19DialogContext">Текущий урок</small>
          </div>
          <span class="v19-local-badge">● локально</span>
          <button type="button" class="v19-dialog-close" aria-label="Закрыть">×</button>
        </header>
        <div class="v19-dialog-log" id="v19DialogLog"></div>
        <div class="v19-dialog-live" id="v19DialogLive"></div>
        <div class="v19-dialog-compose">
          <textarea id="v19DialogInput" rows="2" placeholder="Напиши или скажи Kitsune, что непонятно…"></textarea>
          <div class="v19-compose-actions">
            <button type="button" class="v19-mic-btn" aria-pressed="false">🎙️ Говорить</button>
            <button type="button" class="v19-send-btn">Отправить ➜</button>
          </div>
        </div>
        <div class="v19-dialog-foot">
          <span>🎙️ Whisper</span><span>→</span><span>🧠 Kitsune Brain</span><span>→</span><span>🔊 Voice</span>
        </div>
      </section>
    </div>`;
  }

  function ensureDialog(){
    let root=document.querySelector("#v19Dialog");
    if(root)return root;
    document.body.insertAdjacentHTML("beforeend",dialogMarkup());
    root=document.querySelector("#v19Dialog");
    root.querySelector(".v19-dialog-close").addEventListener("click",closeDialog);
    root.addEventListener("click",e=>{if(e.target===root)closeDialog()});
    root.querySelector(".v19-send-btn").addEventListener("click",()=>sendCurrentInput());
    root.querySelector(".v19-mic-btn").addEventListener("click",toggleRecord);
    root.querySelector("textarea").addEventListener("keydown",e=>{
      if(e.key==="Enter"&&!e.shiftKey){
        e.preventDefault();sendCurrentInput();
      }
    });
    renderHistory();
    return root;
  }

  function injectOpenButtons(){
    const actions=document.querySelector("#v15Assistant .v15-actions");
    if(actions&&!actions.querySelector(".v19-open-dialog")){
      const b=document.createElement("button");
      b.type="button";b.className="v15-action v19-open-dialog";
      b.textContent="💬 Поговорить";
      b.addEventListener("click",()=>openDialog(currentCtx()));
      actions.appendChild(b);
    }

    document.querySelectorAll(".v173-inline-tutor").forEach(panel=>{
      if(panel.querySelector(".v19-inline-talk"))return;
      const controls=panel.querySelector(".v173-controls");
      if(!controls)return;
      const b=document.createElement("button");
      b.type="button";b.className="v173-btn v19-inline-talk";
      b.textContent="🎙️ Сказать Kitsune";
      b.addEventListener("click",()=>{
        const box=panel.closest(".exercise[data-ex]");
        let ctx=null;
        try{ctx=box&&typeof v16ParseExercise==="function"?v16ParseExercise(box):currentCtx()}catch(e){}
        openDialog(ctx);
      });
      controls.appendChild(b);
    });
  }

  function openDialog(ctx=null){
    activeCtx=ctx?.exercise?ctx:currentCtx();
    syncVisualViewport();
    const root=ensureDialog();
    root.classList.add("show");
    document.body.classList.add("v19-dialog-open");
    const label=root.querySelector("#v19DialogContext");
    if(label)label.textContent=contextLabel(activeCtx);
    renderHistory();
    setTimeout(()=>{
      syncVisualViewport();
      root.querySelector("textarea")?.focus();
    },80);
  }

  function closeDialog(){
    if(recording)stopRecording();
    document.querySelector("#v19Dialog")?.classList.remove("show");
    document.body.classList.remove("v19-dialog-open");
  }

  function dialogState(text,kind=""){
    const el=document.querySelector("#v19DialogLive");
    if(!el)return;
    el.textContent=text||"";
    el.className=`v19-dialog-live ${kind}`.trim();
  }

  function addHistory(role,content){
    const msg={role,content:strip(content),ts:Date.now()};
    history.push(msg);history=history.slice(-20);save();renderHistory();
  }

  function renderHistory(){
    const log=document.querySelector("#v19DialogLog");
    if(!log)return;
    const shown=history.slice(-14);
    if(!shown.length){
      log.innerHTML=`<div class="v19-empty-chat"><b>🦊 Kitsune готова слушать.</b><span>Можно написать или нажать «🎙️ Говорить» и спросить, например: «Почему здесь меняется знак?»</span></div>`;
      return;
    }
    log.innerHTML=shown.map(m=>`
      <div class="v19-msg ${m.role==="user"?"user":"kitsune"}">
        ${m.role==="assistant"?'<span class="v19-msg-avatar"><img src="./assets/kitsune/idle.png" alt=""></span>':""}
        <div><small>${m.role==="user"?"Ты":"Kitsune"}</small><p>${escapeHtml(m.content)}</p></div>
      </div>`).join("");
    log.scrollTop=log.scrollHeight;
  }

  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  }

  async function sendCurrentInput(prefilled=null){
    const input=document.querySelector("#v19DialogInput");
    const text=strip(prefilled ?? input?.value ?? "");
    if(!text)return;
    if(input)input.value="";
    await sendMessage(text);
  }

  async function sendMessage(text){
    addHistory("user",text);
    dialogState("🦊 Kitsune думает…","thinking");

    let reply="";
    const ctx=activeCtx?.exercise?activeCtx:currentCtx();
    try{
      if(window.KitsuneBrain?.chat){
        const prior=history.slice(0,-1).slice(-6).map(x=>({role:x.role,content:x.content}));
        reply=await window.KitsuneBrain.chat(text,ctx,prior);
      }else{
        reply="Я тебя слышу 🦊 Но Kitsune Brain ещё не подключён.";
      }
    }catch(e){
      reply="Сейчас не получилось сформулировать ответ. Попробуй спросить короче или открой конкретное задание.";
    }

    dialogState("");
    addHistory("assistant",reply);

    if(voiceReplies){
      try{
        if(typeof window.v151Speak==="function"){
          window.v151Speak(reply,{state:"explain",force:true});
        }
      }catch(e){}
    }
  }

  async function toggleRecord(){
    if(recording){stopRecording();return}
    await startRecording();
  }

  async function startRecording(){
    if(location.protocol==="file:"||!window.isSecureContext){
      dialogState("Микрофон требует HTTPS. На GitHub Pages он заработает; в локальном preview используй текст.","warn");
      return;
    }
    if(!navigator.mediaDevices?.getUserMedia){
      dialogState("Этот браузер не предоставляет доступ к микрофону.","warn");
      return;
    }

    if(!whisperReady&&!workerReady){
      dialogState("Сначала один раз подготовь локальный Whisper в настройках Kitsune ⚙.","warn");
      try{v15Open?.();document.querySelector("#v15Settings")?.classList.add("show")}catch(e){}
      return;
    }

    if(!workerReady){
      dialogState("Загружаю Whisper из локального кэша…","thinking");
      workerLoading=true;updateVoiceUi();
      const gpu=await useWebGPU();
      ensureWorker().postMessage({type:"load",useWebGPU:gpu});
      const ok=await waitWorkerReady(120000);
      if(!ok){
        dialogState("Whisper не успел загрузиться. Нажми «Подготовить Whisper» в настройках и попробуй снова.","warn");
        return;
      }
    }

    try{
      stream=await navigator.mediaDevices.getUserMedia({
        audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},
        video:false
      });

      const mime=[
        "audio/webm;codecs=opus","audio/webm","audio/mp4"
      ].find(x=>window.MediaRecorder?.isTypeSupported?.(x))||"";
      recorder=new MediaRecorder(stream,mime?{mimeType:mime}:undefined);
      chunks=[];
      recorder.ondataavailable=e=>{if(e.data?.size)chunks.push(e.data)};
      recorder.onstop=handleRecordingStop;
      recorder.start(180);

      recAudioCtx=new (window.AudioContext||window.webkitAudioContext)();
      const src=recAudioCtx.createMediaStreamSource(stream);
      analyser=recAudioCtx.createAnalyser();
      analyser.fftSize=1024;
      analyser.smoothingTimeConstant=.35;
      src.connect(analyser);

      speechSeen=false;lastVoice=performance.now();startedAt=performance.now();
      recording=true;updateVoiceUi();
      dialogState("👂 Слушаю… говори. После паузы остановлюсь автоматически.","listening");
      monitorVoice();

      clearTimeout(maxTimer);
      maxTimer=setTimeout(()=>{if(recording)stopRecording()},15000);
    }catch(err){
      dialogState(friendlyMicError(err),"warn");
      cleanupRecorder();
    }
  }

  function friendlyMicError(err){
    const s=String(err?.name||err?.message||err);
    if(/NotAllowed|Permission/i.test(s))return "Доступ к микрофону запрещён. Разреши микрофон для этого сайта в настройках браузера.";
    if(/NotFound/i.test(s))return "Микрофон не найден.";
    return "Не удалось включить микрофон: "+s.slice(0,120);
  }

  function monitorVoice(){
    if(!recording||!analyser)return;
    const data=new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(data);
    let sum=0;
    for(const v of data){
      const x=(v-128)/128;sum+=x*x;
    }
    const rms=Math.sqrt(sum/data.length);
    const now=performance.now();

    if(rms>.022){
      speechSeen=true;lastVoice=now;
    }
    if(speechSeen&&now-startedAt>800&&now-lastVoice>1450){
      stopRecording();return;
    }
    raf=requestAnimationFrame(monitorVoice);
  }

  function stopRecording(){
    if(!recording)return;
    recording=false;updateVoiceUi();
    clearTimeout(maxTimer);cancelAnimationFrame(raf);
    dialogState("⏳ Готовлю запись…","thinking");
    try{
      if(recorder?.state!=="inactive")recorder.stop();
      else handleRecordingStop();
    }catch(e){handleRecordingStop()}
  }

  async function handleRecordingStop(){
    try{
      const type=recorder?.mimeType||chunks[0]?.type||"audio/webm";
      const blob=new Blob(chunks,{type});
      if(blob.size<800){
        dialogState("Я почти ничего не услышала. Нажми микрофон и попробуй ещё раз.","warn");
        cleanupRecorder();return;
      }
      const samples=await blobTo16k(blob);
      cleanupRecorder();
      if(samples.length<1600){
        dialogState("Запись слишком короткая. Попробуй сказать фразу чуть дольше.","warn");return;
      }

      dialogState("🧠 Whisper распознаёт речь на устройстве…","thinking");
      const text=await transcribe(samples);
      if(!strip(text)){
        dialogState("Не удалось уверенно распознать фразу. Попробуй ещё раз, чуть ближе к микрофону.","warn");
        return;
      }

      const input=document.querySelector("#v19DialogInput");
      if(input)input.value=text;
      dialogState(`🎙️ Я услышала: «${text}»`,"ok");
      setTimeout(()=>sendCurrentInput(text),240);
    }catch(err){
      cleanupRecorder();
      dialogState("Ошибка распознавания: "+String(err?.message||err).slice(0,130),"warn");
    }
  }

  function cleanupRecorder(){
    clearTimeout(maxTimer);cancelAnimationFrame(raf);
    try{stream?.getTracks()?.forEach(t=>t.stop())}catch(e){}
    try{recAudioCtx?.close()}catch(e){}
    stream=null;recorder=null;chunks=[];recAudioCtx=null;analyser=null;
    recording=false;updateVoiceUi();
  }

  async function blobTo16k(blob){
    const AC=window.AudioContext||window.webkitAudioContext;
    const ctx=new AC();
    try{
      const buf=await blob.arrayBuffer();
      const audio=await ctx.decodeAudioData(buf.slice(0));
      const len=audio.length;
      const mono=new Float32Array(len);
      for(let c=0;c<audio.numberOfChannels;c++){
        const ch=audio.getChannelData(c);
        for(let i=0;i<len;i++)mono[i]+=ch[i]/audio.numberOfChannels;
      }
      return resample(mono,audio.sampleRate,16000);
    }finally{
      try{ctx.close()}catch(e){}
    }
  }

  function resample(input,from,to){
    if(from===to)return input;
    const ratio=from/to;
    const outLen=Math.max(1,Math.round(input.length/ratio));
    const out=new Float32Array(outLen);
    for(let i=0;i<outLen;i++){
      const pos=i*ratio;
      const i0=Math.floor(pos),i1=Math.min(input.length-1,i0+1);
      const f=pos-i0;
      out[i]=input[i0]*(1-f)+input[i1]*f;
    }
    return out;
  }

  async function transcribe(samples){
    const gpu=await useWebGPU();
    const w=ensureWorker();
    const id=++seq;
    const promise=new Promise((resolve,reject)=>{
      workerWaiters.set(id,{resolve,reject});
      setTimeout(()=>{
        const waiter=workerWaiters.get(id);
        if(waiter){
          workerWaiters.delete(id);
          reject(new Error("Whisper не ответил за отведённое время."));
        }
      },90000);
    });
    w.postMessage({type:"transcribe",id,useWebGPU:gpu,samples:samples.buffer},[samples.buffer]);
    return promise;
  }

  function waitWorkerReady(timeout=25000){
    if(workerReady)return Promise.resolve(true);
    const start=performance.now();
    return new Promise(resolve=>{
      const tick=()=>{
        if(workerReady)return resolve(true);
        if(performance.now()-start>timeout)return resolve(false);
        setTimeout(tick,180);
      };tick();
    });
  }

  window.addEventListener("resize",syncVisualViewport,{passive:true});
  window.visualViewport?.addEventListener("resize",syncVisualViewport,{passive:true});
  window.visualViewport?.addEventListener("scroll",syncVisualViewport,{passive:true});

  /* v1.11.1 Child Safety: microphone can never keep recording after the app
     goes to background or the page is left. */
  document.addEventListener("visibilitychange",()=>{
    if(document.hidden&&recording)stopRecording();
  });
  window.addEventListener("pagehide",()=>{
    if(recording){
      try{if(recorder?.state!=="inactive")recorder.stop()}catch(e){}
    }
    cleanupRecorder();
  });

  syncVisualViewport();

  // Public API.
  window.KitsuneVoiceDialogue={
    version:VERSION,
    model:WHISPER_MODEL,
    open:openDialog,
    close:closeDialog,
    prepare:prepareWhisper,
    send:sendMessage,
    start:startRecording,
    stop:stopRecording,
    isReady:()=>whisperReady||workerReady
  };

  injectSettings();
  ensureDialog();
  injectOpenButtons();

  const content=document.querySelector("#content");
  if(content)new MutationObserver(()=>setTimeout(injectOpenButtons,60)).observe(content,{childList:true,subtree:true});
  setTimeout(injectSettings,250);
  setTimeout(injectOpenButtons,350);
  setTimeout(injectSettings,1000);

  if(whisperReady){
    setWhisperStatus("Whisper подготовлен ранее. Голосовой ввод загрузится из кэша по первому нажатию микрофона.","ok");
  }
})();
