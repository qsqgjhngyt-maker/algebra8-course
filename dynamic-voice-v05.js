/* Единственный автономный голос Kitsune: установка по кнопке, синтез в worker. */
(() => {
  'use strict';
  const REF='50e9ea8ff8e7b3513c7b41080c36ac3ed82a333617d46195da081da4feae77c4';
  const currentScript=typeof document!=='undefined'?document.currentScript:null;
  const script=currentScript?.src;
  // Проверенная конфигурация Piper выбирается тегом в index.html.
  const piper=currentScript?.dataset?.voiceEngine==='piper-v07';
  const appBase=new URL('./',script||globalThis.location?.href||'https://kitsune.invalid/');
  const base=new URL(piper?'assets/voice/kitsune_piper_v07/':'assets/voice/kitsune_ondevice_v06/',appBase);
  const indexKey=new URL(piper?'__kitsune_piper_voice_v07':'__kitsune_device_voice_v06',appBase).href;
  const INDEX=piper?'kitsune-piper-index-v07':'kitsune-device-index-v06';
  const SYNTHESIS=piper?'v07-1':'v06-1',OUTPUTS=piper?'kitsune-generated-piper-v07-':'kitsune-generated-voice-v06-';
  let active=null,worker=null,context=null,source=null,epoch=0,busy=false,installing=null;
  let current=null,pauseTimer=null,finishPause=null;
  let message='';
  function show(text){message=text;globalThis.v151UpdateVoiceUi?.();}
  let reason='Сохрани генератор Китсуне один раз, чтобы читать новые фразы без интернета.';
  let taskId=0,idleTimer;const pending=new Map();
  const clearRequest=p=>{clearTimeout(p.timer);clearTimeout(p.limit);};
  const required=['model/language_model.onnx','model/acoustic_encoder.onnx','model/flow_step.onnx','model/vocoder.onnx','model/config.json',
    'runtime/ort.wasm.min.js','runtime/ort-wasm-simd-threaded.mjs','runtime/ort-wasm-simd-threaded.wasm'];
  const hash=async data=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',data)),v=>v.toString(16).padStart(2,'0')).join('');
  function validate(m){
    if(piper)return globalThis.KitsunePiperCore.validateManifest(m);
    if(m.schema_version!==2||m.voice_identity!=='kitsune'||m.reference_sha256!==REF)throw Error('Пакет не относится к нашему голосу Китсуне.');
    if(m.status==='candidate_missing_runtime')throw Error('Подготовленные файлы модели есть, но компонент запуска ещё нужно установить на ПК.');
    const seen=new Set();
    for(const f of m.files||[]){
      if(!/^(model|runtime)\/[a-zA-Z0-9_.-]+$/.test(f.path)||seen.has(f.path)||!Number.isSafeInteger(f.bytes)||f.bytes<=0||!/^[0-9a-f]{64}$/.test(f.sha256))throw Error('Повреждено описание пакета голоса.');
      seen.add(f.path);
    }
    if(required.some(p=>!seen.has(p))||m.validation?.native_cpu?.status!=='passed')throw Error('Пакет генератора ещё не прошёл локальные проверки.');
    return m;
  }
  async function restore(){
    if(!globalThis.caches||!globalThis.crypto?.subtle)return;
    try{const r=await(await caches.open(INDEX)).match(indexKey);if(r){const a=await r.json();validate(a.manifest);active=a;reason='Генератор Китсуне сохранён на этом устройстве.';}}
    catch{active=null;}
  }
  const restored=restore().then(()=>globalThis.v151UpdateVoiceUi?.());
  async function install(progress=()=>{}){
    if(installing)return installing;
    installing=(async()=>{
      if(!globalThis.caches||!globalThis.crypto?.subtle||!globalThis.Worker)throw Error('Открой приложение по защищённому адресу HTTPS.');
      const response=await fetch(new URL('manifest.json',base),{cache:'no-store'});
      if(!response.ok)throw Error('Не удалось получить пакет генератора.');
      const m=validate(await response.json());
      const fingerprint=m.files.map(f=>[f.path,f.bytes,f.sha256]).sort((a,b)=>a[0].localeCompare(b[0]));
      const packageId=await hash(new TextEncoder().encode(JSON.stringify(fingerprint)));
      const cacheName=(piper?'kitsune-piper-voice-v07-':'kitsune-device-voice-v06-')+packageId.slice(0,20),cache=await caches.open(cacheName);
      let saved=0;const total=m.files.reduce((s,f)=>s+f.bytes,0);
      const estimate=await navigator.storage?.estimate?.();
      if(estimate?.quota&&estimate.quota-estimate.usage<total&&(await cache.keys()).length===0)throw Error('Недостаточно свободного места для голоса: нужно около '+Math.ceil(total/1048576)+' МБ.');
      for(const record of m.files){
        const url=new URL(record.path,base).href;let r=await cache.match(url),data;
        if(r){data=await r.arrayBuffer();if(data.byteLength!==record.bytes||await hash(data)!==record.sha256)data=null;}
        if(!data){r=await fetch(url,{cache:'no-store'});if(!r.ok)throw Error('Не загрузился файл голоса. Повтори установку.');data=await r.arrayBuffer();
          if(data.byteLength!==record.bytes||await hash(data)!==record.sha256)throw Error('Файл голоса не прошёл проверку.');
          await cache.put(url,new Response(data,{headers:{'Content-Type':r.headers.get('Content-Type')||'application/octet-stream'}}));}
        saved+=record.bytes;progress({saved,total,percent:Math.floor(saved/total*100)});
      }
      const next={manifest:m,cacheName,packageId,base:base.href};
      await(await caches.open(INDEX)).put(indexKey,new Response(JSON.stringify(next),{headers:{'Content-Type':'application/json'}}));
      stop(true);active=next;reason='Генератор Китсуне сохранён на этом устройстве.';
      await navigator.storage?.persist?.();
      return info();
    })().finally(()=>{installing=null;});return installing;
  }
  function unlock(){
    const AudioContext=globalThis.AudioContext||globalThis.webkitAudioContext;
    if(!AudioContext)return;
    try{context??=new AudioContext();context.resume().catch(()=>{});}catch{}
  }
  function disposeWorker(error=Object.assign(Error('Озвучка остановлена.'),{name:'AbortError'})){
    clearTimeout(idleTimer);
    worker?.terminate();worker=null;
    for(const p of pending.values()){clearRequest(p);p.reject(error);}pending.clear();
  }
  function retireWorker(){clearTimeout(idleTimer);idleTimer=setTimeout(()=>disposeWorker(),30000);}
  function stop(release=false){
    clearTimeout(pauseTimer);pauseTimer=null;finishPause?.();finishPause=null;
    epoch++;busy=false;clearTimeout(current?.uiTimer);current=null;message='';try{source?.stop?.();}catch{}source=null;
    if(piper&&worker&&!pending.size&&!release)retireWorker();else disposeWorker();
    globalThis.v161MarkSpeaking?.(false,'idle');
  }
  function request(type,extra={}){
    return new Promise((resolve,reject)=>{
      const id=++taskId,timeout=()=>disposeWorker(Error('Генерация заняла слишком много времени на этом устройстве.'));
      const idle=piper?60000:300000;
      const p={resolve,reject,timeout,idle,timer:setTimeout(timeout,idle),limit:setTimeout(timeout,piper?120000:type==='generate'?1200000:300000)};
      pending.set(id,p);worker.postMessage({type,id,...extra});
    });
  }
  async function ensureWorker(){
    clearTimeout(idleTimer);
    if(worker)return;
    worker=new Worker(new URL(piper?'piper-voice-worker-v07.js':'ondevice-voice-worker-v06.js',appBase));
    worker.onmessage=({data})=>{
      const p=pending.get(data.id);if(!p)return;
      if(data.type==='progress'){
        clearTimeout(p.timer);p.timer=setTimeout(p.timeout,p.idle);
        show(data.message);return;
      }
      pending.delete(data.id);clearRequest(p);if(data.type==='error')p.reject(Error(data.message));else p.resolve(data);
    };
    worker.onerror=()=>disposeWorker(Error('Не удалось запустить генератор на этом устройстве.'));
    await request('init',active);
  }
  async function play(wav,run,state){
    if(run!==epoch)return;
    if(!context||context.state!=='running')throw Error('Нажми кнопку озвучки, чтобы разрешить звук на устройстве.');
    const buffer=await context.decodeAudioData(wav.slice(0));if(run!==epoch)return;
    await new Promise((resolve,reject)=>{
      try{const next=context.createBufferSource();next.buffer=buffer;next.connect(context.destination);source=next;
        next.onended=()=>{next.disconnect();if(source===next)source=null;resolve();};next.start();
        if(current?.run===run){current.started=true;current.phase='playing';}
        show('Китсуне читает новую фразу.');globalThis.v161MarkSpeaking?.(true,state);}
      catch(e){reject(e);}
    });
  }
  async function savedClip(text,lengthMultiplier=1){
    const pronunciation=piper?globalThis.KitsunePiperCore.pronunciationRevision?.(text):'';
    const key=pronunciation?JSON.stringify({text,lengthMultiplier,pronunciation}):lengthMultiplier===1?text:JSON.stringify({text,lengthMultiplier});
    const textHash=await hash(new TextEncoder().encode(key)),name=OUTPUTS+SYNTHESIS+'-'+active.packageId;
    const url=new URL((piper?'__kitsune_generated_piper_v07/':'__kitsune_generated_v06/')+active.packageId+'/'+textHash+'.wav',appBase).href;
    const cache=await caches.open(name);let wav=null;
    try{
      const r=await cache.match(url);
      if(r){
        const bytes=await r.arrayBuffer();
        if(r.headers.get('X-Kitsune-Reference')===REF&&r.headers.get('X-Kitsune-Text')===textHash&&r.headers.get('X-Kitsune-WAV')===await hash(bytes))wav=bytes;
        else await cache.delete(url);
      }
    }catch{}
    return {wav,async save(bytes){
      const sha=await hash(bytes);
      await cache.put(url,new Response(bytes,{headers:{'Content-Type':'audio/wav','X-Kitsune-Reference':REF,'X-Kitsune-Text':textHash,'X-Kitsune-WAV':sha}}));
      // Кэш новых фраз ограничен по числу записей, модели и утверждённые WAV не затрагиваем.
      const entries=await cache.keys();for(const entry of entries.slice(0,Math.max(0,entries.length-64)))await cache.delete(entry);
    }};
  }
  function updateWait(job){
    job.uiTimer=setTimeout(()=>{
      if(current!==job)return;
      globalThis.v151UpdateVoiceUi?.();updateWait(job);
    },15000);
  }
  function pause(milliseconds,run){
    if(!milliseconds||run!==epoch)return Promise.resolve();
    current.phase='pause';show('Китсуне делает паузу…');
    return new Promise(resolve=>{finishPause=resolve;pauseTimer=setTimeout(()=>{pauseTimer=null;finishPause=null;resolve();},milliseconds);});
  }
  function trySpeak(text,{state='talk',force=false,onDone=null}={},onError=()=>{}){
    if(!active||!text||(!force&&busy))return false;
    const plan=piper?globalThis.KitsuneDeviceCore.speechPlan(text):globalThis.KitsuneDeviceCore.chunks(text).map(text=>({text,pause_after_ms:0})),key=JSON.stringify(plan);
    if(busy&&current?.key===key&&!current.started){
      // Повторное нажатие продолжает ту же долгую задачу. Завершение получает
      // актуальный вызов общего плеера, поздний callback прежнего не вызывается.
      current.onDone=onDone;current.onError=onError;
      show('Продолжаю подготовку этой фразы. Повторно запускать её не нужно.');
      return true;
    }
    if(force)globalThis.v161StopSpeech?.();else stop();
    unlock();const run=++epoch;busy=true;show(piper?'Китсуне готовит новую фразу…':'Китсуне готовит новую фразу. Подготовка занимает несколько минут.');
    const job={run,key,started:false,phase:'preparing',since:Date.now(),onDone,onError};current=job;updateWait(job);
    (async()=>{
      await restored;if(run!==epoch)return;
      for(const item of plan){
        const part=item.text;
        if(run!==epoch)return;
        job.phase='preparing';
        const lengthMultiplier=item.length_multiplier??1;
        const saved=await savedClip(part,lengthMultiplier).catch(()=>null);if(run!==epoch)return;
        let wav=saved?.wav;
        if(!wav){
          await ensureWorker();if(run!==epoch)return;
          const result=await request('generate',{text:part,...(piper?{lengthMultiplier}:{})});if(run!==epoch)return;
          wav=result.wav;
          // Сохраняем и при блокировке Web Audio: следующий осознанный тап
          // сможет проиграть готовый звук без повторной долгой генерации.
          if(saved)await saved.save(wav).catch(()=>{});if(run!==epoch)return;
        }
        await play(wav,run,state);
        if(run===epoch)globalThis.v161MarkSpeaking?.(false,'idle');
        await pause(item.pause_after_ms,run);
      }
    })().catch(e=>{if(run===epoch&&e.name!=='AbortError'){show(e.message);job.onError(e.message);}})
      .finally(()=>{if(run===epoch){busy=false;clearTimeout(job.uiTimer);current=null;if(piper&&worker)retireWorker();else disposeWorker();if(message==='Китсуне читает новую фразу.')message='';globalThis.v161MarkSpeaking?.(false,'idle');job.onDone?.();}});
    return true;
  }
  const info=()=>{const seconds=current?Math.max(0,Math.floor((Date.now()-current.since)/1000)):0;
    return {ready:!!active,status:active?'installed_candidate':'not_installed',engine:piper?'piper-v07':'chatterbox-v06',download_mb:piper?100:600,release_ready:active?.manifest.status==='ready',reason,installing:!!installing,busy,
      message:current?.phase==='preparing'&&seconds>=15?message+' Прошло '+Math.floor(seconds/60)+' мин '+seconds%60+' сек.':message};};
  globalThis.addEventListener?.('kitsune-audio-unlock',unlock);
  if(typeof document!=='undefined')document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')stop(true);});
  globalThis.KitsuneDynamicVoice={trySpeak,stop,isBusy:()=>busy,info,install,validateManifest:validate,restored};
})();
