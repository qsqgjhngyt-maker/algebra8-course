(() => {
  "use strict";
  const fallback=window.v151Speak,previousStop=window.v161StopSpeech;
  let active=null,audio=null,url=null,sequence=0;
  function stop(){sequence++;active?.abort();active=null;if(audio){audio.pause();audio=null}if(url){URL.revokeObjectURL(url);url=null}window.v161MarkSpeaking?.(false,"idle")}
  function play(base64,mime){
    const bytes=Uint8Array.from(atob(base64),c=>c.charCodeAt(0));
    url=URL.createObjectURL(new Blob([bytes],{type:mime}));audio=new Audio(url);
    audio.onended=stop;audio.onerror=stop;
    return audio.play().then(()=>window.v161MarkSpeaking?.(true,"explain"));
  }
  async function speak(text,opts={}){
    stop();previousStop?.();const id=sequence;
    if(!window.KitsuneRouter?.consented()||!window.KitsuneHybridInfrastructure?.consented()||!navigator.onLine||text.length>800)return fallback?.(text,opts);
    active=new AbortController();const timer=setTimeout(()=>active?.abort(),12000);
    try{
      const result=await window.KitsuneHybridInfrastructure.cloudRequest("tts",text,{signal:active.signal});
      if(sequence!==id)return;
      if(!result.audio)throw new Error("empty_audio");
      await play(result.audio,result.mime||"audio/wav");
    }catch{if(sequence===id){stop();return fallback?.(text,opts)}}
    finally{clearTimeout(timer)}
  }
  function addControls(){
    const host=document.querySelector(".khi-panel");if(!host||host.querySelector("#kitsuneDesignVoice"))return;
    const block=document.createElement("div"),button=document.createElement("button"),status=document.createElement("p");
    button.id="kitsuneDesignVoice";button.className="secondary";button.textContent="Создать голос Kitsune";
    status.textContent="Создание использует квоту Voice Design. Полученный тембр нужно прослушать перед включением.";
    button.onclick=async()=>{
      if(!window.KitsuneRouter.consented()){status.textContent="Сначала разрешите облачный разговор и голос.";return}
      button.disabled=true;status.textContent="Создаю вымышленный голос…";
      try{
        const result=await window.KitsuneHybridInfrastructure.cloudRequest("voice-design","create-kitsune-fictional-voice",{signal:AbortSignal.timeout(30000)});
        status.textContent="Голос создан. Сохраните этот идентификатор в Cloudflare как QWEN_VOICE_ID: "+result.voiceId;
        if(result.preview){const listen=document.createElement("button");listen.textContent="Прослушать голос";listen.onclick=()=>{stop();play(result.preview,"audio/wav").catch(()=>{status.textContent+=" Для звука нажмите повторно."})};block.append(listen)}
      }catch{status.textContent="Создание не подтверждено. Проверьте права ключа на qwen-voice-design и qwen3-tts-vd-2026-01-26. При тайм-ауте сначала проверьте список созданных голосов, чтобы не расходовать квоту повторно."}
    };
    block.append(button,status);host.append(block);
  }
  window.KitsuneCharacterVoice={speak,stop};window.v151Speak=speak;
  window.v161StopSpeech=()=>{stop();previousStop?.()};
  window.addEventListener("pagehide",stop);
  new MutationObserver(addControls).observe(document.body,{childList:true,subtree:true});addControls();
})();
