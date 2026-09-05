/* =====================================================================
   Kitsune v2.3.0-beta.2.2 · Character Voice runtime
   Cloud Qwen Character Voice -> local Piper/System fallback.
   Adult diagnostics expose the REAL engine and the last TTS failure.
   No voice identifier or secret is ever displayed.
   ===================================================================== */
(() => {
  "use strict";

  const VERSION="2.3.0-beta.2.2";
  const fallback=window.v151Speak;
  const previousStop=window.v161StopSpeech;

  let active=null;
  let htmlAudio=null;
  let objectUrl=null;
  let source=null;
  let audioCtx=null;
  let sequence=0;

  const state={
    engine:"idle",
    cloud:"not-tested",
    speaking:false,
    lastError:"",
    lastSuccess:0
  };

  function publicError(error){
    const raw=String(error?.message||error||"voice_failed");
    const map={
      voice_not_configured:"QWEN_VOICE_ID не настроен в Worker",
      voice_disabled:"VOICE_ENABLED выключен",
      voice_unavailable:"Qwen TTS недоступен или ключ/модель не имеют нужного доступа",
      voice_auth_failed:"Alibaba отклонил API key для TTS",
      voice_permission_denied:"У API key нет разрешения на модель Character Voice",
      voice_id_mismatch:"Созданный QWEN_VOICE_ID не подходит к выбранной TTS-модели",
      voice_model_mismatch:"TTS-модель не совпадает с моделью, для которой создан голос",
      voice_region_mismatch:"Голос и API key находятся в разных регионах Model Studio",
      voice_rate_limited:"Alibaba ограничил частоту TTS-запросов",
      voice_provider_unavailable:"Сервис Qwen TTS временно недоступен",
      voice_request_rejected:"Alibaba отклонил параметры TTS-запроса",
      audio_unavailable:"Синтез создан, но аудиофайл не удалось получить",
      invalid_audio_url:"Провайдер вернул неожиданный адрес аудио",
      cloud_consent_required:"Облачный голос не разрешён взрослым",
      enrollment_required:"Нужно заново подтвердить устройство через Google",
      broker_error:"Worker получил ошибку от TTS-провайдера",
      rate_limited:"Сработало ограничение частоты запросов",
      empty_audio:"Worker не вернул аудио"
    };
    return map[raw]||raw.slice(0,180);
  }

  function emit(){
    updatePanel();
    try{
      window.dispatchEvent(new CustomEvent("kitsune-character-voice-status",{
        detail:{...state,version:VERSION}
      }));
    }catch{}
  }

  function setState(patch){
    Object.assign(state,patch);
    emit();
  }

  function getAudioContext(){
    if(audioCtx)return audioCtx;
    const Ctx=window.AudioContext||window.webkitAudioContext;
    if(!Ctx)return null;
    try{
      audioCtx=new Ctx();
      return audioCtx;
    }catch{
      return null;
    }
  }

  function unlockAudio(){
    const ctx=getAudioContext();
    if(!ctx)return;
    try{
      if(ctx.state==="suspended")ctx.resume().catch(()=>{});
      const buffer=ctx.createBuffer(1,1,22050);
      const silent=ctx.createBufferSource();
      silent.buffer=buffer;
      silent.connect(ctx.destination);
      silent.start(0);
    }catch{}
  }

  function stopPlayback({abort=true}={}){
    sequence++;
    if(abort)active?.abort();
    active=null;

    try{source?.stop?.()}catch{}
    try{source?.disconnect?.()}catch{}
    source=null;

    if(htmlAudio){
      try{htmlAudio.pause()}catch{}
      htmlAudio=null;
    }
    if(objectUrl){
      URL.revokeObjectURL(objectUrl);
      objectUrl=null;
    }
    state.speaking=false;
    window.v161MarkSpeaking?.(false,"idle");
    emit();
  }

  function stop(){
    stopPlayback({abort:true});
  }

  function bytesFromBase64(base64){
    return Uint8Array.from(atob(base64),c=>c.charCodeAt(0));
  }

  async function playWithAudioContext(bytes){
    const ctx=getAudioContext();
    if(!ctx)throw new Error("audio_context_unavailable");
    if(ctx.state==="suspended")await ctx.resume();
    const copy=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
    const buffer=await ctx.decodeAudioData(copy);
    source=ctx.createBufferSource();
    source.buffer=buffer;
    source.connect(ctx.destination);
    source.onended=()=>stopPlayback({abort:false});
    source.start(0);
    state.speaking=true;
    window.v161MarkSpeaking?.(true,"explain");
    emit();
  }

  async function playWithHtmlAudio(bytes,mime){
    objectUrl=URL.createObjectURL(new Blob([bytes],{type:mime||"audio/wav"}));
    htmlAudio=new Audio(objectUrl);
    htmlAudio.onended=()=>stopPlayback({abort:false});
    htmlAudio.onerror=()=>stopPlayback({abort:false});
    await htmlAudio.play();
    state.speaking=true;
    window.v161MarkSpeaking?.(true,"explain");
    emit();
  }

  async function play(base64,mime){
    const bytes=bytesFromBase64(base64);
    try{
      await playWithAudioContext(bytes);
    }catch{
      await playWithHtmlAudio(bytes,mime);
    }
  }

  function cloudAllowed(text){
    return !!(
      window.KitsuneRouter?.consented?.() &&
      window.KitsuneHybridInfrastructure?.consented?.() &&
      navigator.onLine &&
      String(text||"").trim() &&
      String(text).length<=800
    );
  }

  async function requestCloud(text,signal){
    const result=await window.KitsuneHybridInfrastructure.cloudRequest(
      "tts",
      text,
      {signal}
    );
    if(result?.error)throw new Error(result.error);
    if(!result?.audio)throw new Error("empty_audio");
    return result;
  }

  async function speak(text,opts={}){
    stop();
    previousStop?.();
    const id=sequence;
    const phrase=String(text||"").trim();

    if(!cloudAllowed(phrase)){
      setState({
        engine:"local",
        cloud:"not-used",
        lastError:navigator.onLine?"Cloud Voice не разрешён/не готов":"Нет сети"
      });
      return fallback?.(phrase,opts);
    }

    active=new AbortController();
    const timer=setTimeout(()=>active?.abort(),18000);
    setState({engine:"qwen-request",cloud:"testing",lastError:""});

    try{
      const result=await requestCloud(phrase,active.signal);
      if(sequence!==id)return;
      await play(result.audio,result.mime||"audio/wav");
      setState({
        engine:"qwen-character-voice",
        cloud:"ok",
        lastError:"",
        lastSuccess:Date.now()
      });
    }catch(error){
      if(sequence!==id)return;
      const reason=publicError(error);
      stopPlayback({abort:false});
      setState({
        engine:"local-fallback",
        cloud:"failed",
        lastError:reason
      });
      return fallback?.(phrase,opts);
    }finally{
      clearTimeout(timer);
    }
  }

  async function test(){
    unlockAudio();
    stop();
    previousStop?.();

    if(!window.KitsuneRouter?.consented?.())throw new Error("Сначала включите «Разрешить облачный разговор и голос».");
    if(!window.KitsuneHybridInfrastructure?.consented?.())throw new Error("Сначала включите Cloud Brain.");
    if(!navigator.onLine)throw new Error("Нет сети.");

    const phrase="Привет! Это проверка настоящего голоса Kitsune. Если ты меня слышишь, Character Voice работает.";
    active=new AbortController();
    const timer=setTimeout(()=>active?.abort(),22000);
    setState({engine:"qwen-test",cloud:"testing",lastError:""});

    try{
      const result=await requestCloud(phrase,active.signal);
      await play(result.audio,result.mime||"audio/wav");
      setState({
        engine:"qwen-character-voice",
        cloud:"ok",
        lastError:"",
        lastSuccess:Date.now()
      });
      return true;
    }catch(error){
      const reason=publicError(error);
      setState({engine:"test-failed",cloud:"failed",lastError:reason});
      throw new Error(reason);
    }finally{
      clearTimeout(timer);
    }
  }

  function engineLabel(){
    const labels={
      idle:"ещё не использовался",
      "qwen-request":"Qwen TTS · запрос",
      "qwen-test":"Qwen TTS · тест",
      "qwen-character-voice":"✅ Qwen Character Voice",
      "local":"локальный голос",
      "local-fallback":"⚠️ Qwen TTS → локальный fallback",
      "test-failed":"❌ Character Voice test failed"
    };
    return labels[state.engine]||state.engine;
  }

  function panelMarkup(){
    return `<div id="kitsuneCharacterVoiceRuntime" class="khi-detail show" style="margin-top:10px">
      <b>🔊 Character Voice · ${VERSION}</b>
      <div id="kcvEngine" style="margin-top:6px">Фактический движок: ${engineLabel()}</div>
      <div id="kcvCloud" style="margin-top:3px">Cloud TTS: ${state.cloud}</div>
      <div id="kcvError" style="margin-top:3px;color:var(--muted)"></div>
      <div class="ml-actions" style="margin-top:8px">
        <button class="secondary" id="kcvTest" type="button">Проверить Character Voice</button>
      </div>
      <div id="kcvResult" style="margin-top:6px;color:var(--muted)">
        Голос уже должен быть сохранён в Cloudflare Secret QWEN_VOICE_ID. Сам идентификатор здесь никогда не показывается.
      </div>
    </div>`;
  }

  function setText(el,value){
    if(el&&el.textContent!==value)el.textContent=value;
  }

  function updatePanel(){
    const e=document.querySelector("#kcvEngine");
    const c=document.querySelector("#kcvCloud");
    const x=document.querySelector("#kcvError");
    setText(e,`Фактический движок: ${engineLabel()}`);
    setText(c,`Cloud TTS: ${state.cloud}`);
    setText(x,state.lastError?`Последняя причина fallback: ${state.lastError}`:"");
  }

  function addControls(){
    const host=document.querySelector(".khi-panel");
    if(!host)return;

    /* The voice was already designed in Stage 2. Remove the dangerous
       "create again" action from the normal beta.2 UI. */
    host.querySelector("#kitsuneDesignVoice")?.closest("div")?.remove?.();
    host.querySelector("#kitsuneDesignVoice")?.remove?.();

    if(!host.querySelector("#kitsuneCharacterVoiceRuntime")){
      host.insertAdjacentHTML("beforeend",panelMarkup());
      host.querySelector("#kcvTest")?.addEventListener("click",async event=>{
        const button=event.currentTarget;
        const result=host.querySelector("#kcvResult");
        button.disabled=true;
        if(result)result.textContent="Запрашиваю настоящий Qwen Character Voice…";
        try{
          await test();
          if(result)result.textContent="✅ Character Voice получен от Qwen и сейчас воспроизводится. Это не Piper.";
        }catch(error){
          if(result)result.textContent=`❌ Qwen Character Voice не запустился: ${String(error?.message||error)}`;
        }finally{
          button.disabled=false;
          updatePanel();
        }
      });
    }
    updatePanel();
  }

  window.KitsuneCharacterVoice={
    version:VERSION,
    speak,
    stop,
    test,
    unlock:unlockAudio,
    status:()=>({...state})
  };

  window.v151Speak=speak;
  window.v161StopSpeech=()=>{stop();previousStop?.()};

  /* Pre-unlock WebAudio on a real user gesture. This is especially important
     for iOS Safari/PWA: cloud audio arrives after an async network request. */
  document.addEventListener("pointerdown",unlockAudio,{capture:true,passive:true});
  document.addEventListener("touchstart",unlockAudio,{capture:true,passive:true});
  document.addEventListener("keydown",unlockAudio,{capture:true});

  window.addEventListener("pagehide",stop);
  let controlsScheduled=false;
  const controlsObserver=new MutationObserver(()=>{
    if(controlsScheduled)return;
    controlsScheduled=true;
    requestAnimationFrame(()=>{
      controlsScheduled=false;
      addControls();
    });
  });
  controlsObserver.observe(document.body,{childList:true,subtree:true});
  addControls();
})();
