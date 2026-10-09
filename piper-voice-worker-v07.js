/* Piper целиком в worker: текст, фонемы, ONNX и WAV, без сервера генерации. */
'use strict';
importScripts('./piper-voice-core-v07.js');
const core=globalThis.KitsunePiperCore;
let manifest,cache,base,config,session,phonemizerWasm,phonemizerData,russianDictionary,loading=false;
const localUrls=new Set();
async function bytes(path){
  const r=manifest.files.find(f=>f.path===path);if(!r)throw Error('Нет файла '+path);
  const response=await cache.match(new URL(path,base).href);if(!response)throw Error('Файл не сохранён: '+path);
  const data=await response.arrayBuffer();
  const sha=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',data)),v=>v.toString(16).padStart(2,'0')).join('');
  if(data.byteLength!==r.bytes||sha!==r.sha256)throw Error('Повреждён файл '+path);return data;
}
const blob=(data,type='text/javascript')=>{const url=URL.createObjectURL(new Blob([data],{type}));localUrls.add(url);return url;};
async function init(message){
  manifest=core.validateManifest(message.manifest);base=message.base;cache=await caches.open(message.cacheName);
  // Запрещены любые HTTP-запросы при подготовке и генерации. Emscripten
  // получает data/wasm из проверенной памяти; Blob нужен локальным модулям
  // и WASM ONNX. Разрешены только созданные этим worker адреса Blob.
  const originalFetch=globalThis.fetch.bind(globalThis);
  globalThis.fetch=(input,options)=>localUrls.has(String(input?.url||input))?originalFetch(input,options):Promise.reject(Error('Сеть при автономной генерации запрещена.'));
  if(globalThis.XMLHttpRequest){const originalOpen=XMLHttpRequest.prototype.open;XMLHttpRequest.prototype.open=function(method,url,...rest){if(!localUrls.has(String(url)))throw Error('Сеть при автономной генерации запрещена.');return originalOpen.call(this,method,url,...rest);};}
  config=core.validateConfig(JSON.parse(new TextDecoder().decode(await bytes('model/kitsune.onnx.json'))));
  importScripts(blob(await bytes('runtime/piper_phonemize.js')));
  if(typeof createPiperPhonemize!=='function')throw Error('Не найден компонент русского текста.');
  phonemizerWasm=await bytes('runtime/piper_phonemize.wasm');phonemizerData=await bytes('runtime/piper_phonemize.data');
  russianDictionary=await bytes('runtime/ru_dict.bin');
  importScripts(blob(await bytes('runtime/ort.wasm.min.js')));
  ort.env.wasm.numThreads=1;ort.env.wasm.proxy=false;ort.env.logLevel='error';
  // Модуль ONNX вычисляет адрес WASM даже при переданном wasmBinary.
  // Относительный new URL(..., import.meta.url) с Blob не работает:
  // внутренняя ошибка оставляет запуск ожидающим завершения навсегда.
  // Явные локальные адреса обеих частей дают Emscripten locateFile.
  ort.env.wasm.wasmPaths={mjs:blob(await bytes('runtime/ort-wasm-simd-threaded.mjs')),
    wasm:blob(await bytes('runtime/ort-wasm-simd-threaded.wasm'),'application/wasm')};
  ort.env.wasm.initTimeout=30000;
  session=await ort.InferenceSession.create(new Uint8Array(await bytes('model/kitsune.onnx')),{executionProviders:['wasm'],graphOptimizationLevel:'all'});
}
async function phonemize(text){
  const lines=[],errors=[];
  // callMain завершает отдельный экземпляр. Модель ONNX сохраняется тёплой,
  // а eSpeak создаётся заново для каждого текста из проверенных байтов RAM.
  const module=await createPiperPhonemize({noInitialRun:true,wasmBinary:phonemizerWasm,
    getPreloadedPackage:()=>phonemizerData,locateFile:name=>{
      if(!['piper_phonemize.wasm','piper_phonemize.data'].includes(name))throw Error('Неожиданный запрос компонента: '+name);
      return 'kitsune-memory:///'+name;
    },
    print:s=>lines.push(String(s)),printErr:s=>errors.push(String(s))});
  core.installDictionary(module,russianDictionary);
  try{module.callMain(['-l','ru','--input',JSON.stringify([{text:text.trim()}]),'--espeak_data','/espeak-ng-data']);}
  catch(e){if(e?.name!=='ExitStatus'||e.status!==0)throw e;}
  if(errors.some(s=>/missing phoneme|error|failed/i.test(s)))throw Error('Не удалось разобрать новую фразу: '+errors.join(' ').slice(0,250));
  return core.parseOutput(lines,config,text);
}
async function generate(text,lengthMultiplier=1){
  if(typeof text!=='string'||!text.trim()||text.length>300)throw Error('Некорректный текст новой фразы.');
  if(!Number.isFinite(lengthMultiplier)||lengthMultiplier<1||lengthMultiplier>1.18)throw Error('Некорректный темп чтения.');
  const {ids}=await phonemize(text);
  const feeds={input:new ort.Tensor('int64',BigInt64Array.from(ids,n=>BigInt(n)),[1,ids.length]),
    input_lengths:new ort.Tensor('int64',BigInt64Array.of(BigInt(ids.length)),[1]),
    scales:new ort.Tensor('float32',Float32Array.of(config.inference.noise_scale,config.inference.length_scale*lengthMultiplier,config.inference.noise_w),[3])};
  let output;
  try{output=await session.run(feeds);return core.wav(output[session.outputNames[0]].data,config.audio.sample_rate);}
  finally{for(const t of Object.values(feeds))t.dispose?.();for(const t of Object.values(output||{}))t.dispose?.();}
}
self.onmessage=async({data})=>{
  if(loading){self.postMessage({id:data.id,type:'error',message:'Дождись завершения текущей фразы.'});return;}
  loading=true;
  try{
    if(data.type==='init'){self.postMessage({id:data.id,type:'progress',message:'Китсуне загружает сохранённый голос…'});await init(data);self.postMessage({id:data.id,type:'ready'});}
    else if(data.type==='generate'){if(!session)throw Error('Голос не подготовлен.');self.postMessage({id:data.id,type:'progress',message:'Китсуне готовит новую фразу…'});const wav=await generate(data.text,data.lengthMultiplier??1);self.postMessage({id:data.id,type:'audio',wav},[wav]);}
    else throw Error('Неизвестная команда голоса.');
  }catch(e){self.postMessage({id:data.id,type:'error',message:e?.message||String(e)});}
  finally{loading=false;}
};
