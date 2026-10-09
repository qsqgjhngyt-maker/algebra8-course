/* Отдельный TTS нашего голоса. Адрес задаёт только локальный тестовый сервер. */
(() => {
  let epoch=0,controller=null,source=null,context=null,job=null,timer=null,finishPause=null;
  const endpoint=()=>window.KITSUNE_LOCAL_VOICE_ENDPOINT||'';
  function stop(){
    epoch++;controller?.abort();controller=null;
    if(job&&endpoint())fetch(endpoint()+'/cancel',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({job}),cache:'no-store'}).catch(()=>{});
    job=null;clearTimeout(timer);finishPause?.();finishPause=null;
    try{source?.stop();source?.disconnect();}catch{}source=null;
  }
  function trySpeak(text,opts={},unavailable=()=>{}){
    if(!endpoint()||!text||!v151VoiceEnabled||(!opts.force&&!v151SpeechUnlocked))return false;
    if(!opts.force&&window.v151IsSpeechBusy?.())return false;
    window.v161StopSpeech?.();
    const run=++epoch;controller=new AbortController();const signal=controller.signal;
    job=crypto.randomUUID().replace(/-/g,'');const requestJob=job;
    let resume;
    try{context ||= new (window.AudioContext||window.webkitAudioContext)();resume=context.resume();}
    catch{stop();unavailable('Браузер не смог включить звук.');return false;}
    window.v161MarkSpeaking?.(true,opts.state||'explain');
    const note=document.querySelector('#v151VoiceNote');if(note)note.textContent='Готовлю запись голосом Kitsune…';
    (async()=>{
      let started=false;
      try{
        await resume;
        if(context.state!=='running')throw Error('Нажмите кнопку чтения ещё раз.');
        let response;
        for(let attempt=0;attempt<30;attempt++){
          response=await fetch(endpoint()+'/speak',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:String(text),job:requestJob}),signal,cache:'no-store'});
          if(response.status!==503)break;
          const failure=await response.json();if(!failure.busy)throw Error(failure.error);
          await new Promise(resolve=>{finishPause=resolve;timer=setTimeout(()=>{finishPause=null;resolve();},2000);});
          if(run!==epoch)return;
        }
        const data=await response.json();if(!response.ok)throw Error(data.error||'Генератор недоступен.');
        if(!Array.isArray(data.segments)||!data.segments.length)throw Error('Генератор не вернул запись.');
        for(const segment of data.segments){
          if(run!==epoch)return;
          if(!/^[a-f0-9]{64}\.wav$/.test(segment.audio))throw Error('Неверный адрес записи.');
          const audio=await fetch(endpoint()+'/audio/'+segment.audio,{signal,cache:'no-store'});if(!audio.ok)throw Error('Запись недоступна.');
          const bytes=await audio.arrayBuffer();
          const sha=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
          if(sha!==segment.sha256)throw Error('Проверка записи не пройдена.');
          const buffer=await context.decodeAudioData(bytes.slice(0));if(run!==epoch)return;
          await new Promise(resolve=>{source=context.createBufferSource();source.buffer=buffer;source.connect(context.destination);source.onended=resolve;source.start();started=true;});
          if(run!==epoch)return;
          await new Promise(resolve=>{finishPause=resolve;timer=setTimeout(()=>{finishPause=null;resolve();},300);});
        }
        if(run!==epoch)return;
        controller=null;source=null;job=null;window.v161MarkSpeaking?.(false,opts.state||'idle');opts.onDone?.();
      }catch(error){
        if(run!==epoch)return;
        stop();window.v161MarkSpeaking?.(false,'idle');
        if(!started)unavailable(error.message);else opts.onDone?.();
      }
    })();return true;
  }
  window.KitsuneDynamicVoice={trySpeak,stop,isBusy:()=>!!controller};
  window.addEventListener('pagehide',stop);
})();
