/* Синтез на устройстве. Все модели/runtime читаются из проверенного локального кэша. */
'use strict';
importScripts('./ondevice-voice-core-v06.js');
const core=globalThis.KitsuneDeviceCore;
let manifest,cache,base,config,tables;
const REF='50e9ea8ff8e7b3513c7b41080c36ac3ed82a333617d46195da081da4feae77c4';
async function bytes(path){
  const record=manifest.files.find(r=>r.path===path);if(!record)throw Error('Нет файла '+path);
  const response=await cache.match(new URL(path,base).href);if(!response)throw Error('Файл не сохранён: '+path);
  const data=await response.arrayBuffer();
  const sha=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',data)),v=>v.toString(16).padStart(2,'0')).join('');
  if(data.byteLength!==record.bytes||sha!==record.sha256)throw Error('Повреждён файл '+path);
  return data;
}
async function init(message){
  manifest=message.manifest;base=message.base;
  if(manifest.voice_identity!=='kitsune'||manifest.reference_sha256!==REF)throw Error('Неверный эталон голоса.');
  cache=await caches.open(message.cacheName);
  const js=URL.createObjectURL(new Blob([await bytes('runtime/ort.wasm.min.js')],{type:'text/javascript'}));
  importScripts(js);URL.revokeObjectURL(js);
  const mjs=URL.createObjectURL(new Blob([await bytes('runtime/ort-wasm-simd-threaded.mjs')],{type:'text/javascript'}));
  ort.env.wasm.numThreads=1;ort.env.wasm.proxy=false;
  ort.env.wasm.wasmPaths={mjs};ort.env.wasm.wasmBinary=await bytes('runtime/ort-wasm-simd-threaded.wasm');
  ort.env.logLevel='error';
  config=JSON.parse(new TextDecoder().decode(await bytes('model/config.json')));
  tables={};for(const name of ['text_embeddings','speech_embeddings','text_positions','speech_positions']){
    tables[name]={weights:new Int8Array(await bytes('model/'+name+'.int8')),scales:new Float32Array(await bytes('model/'+name+'.scales')),rows:config[name].rows};
  }
  // The engine must never use a server/CDN during generation. Blob module loading is local.
  const localFetch=globalThis.fetch.bind(globalThis);
  globalThis.fetch=(input,options)=>String(input?.url||input).startsWith('blob:')?localFetch(input,options):Promise.reject(Error('Сеть при автономной генерации запрещена.'));
}
async function load(name){
  const prefix=name==='language_model'?'lm':name;
  const externalData=[];
  for(const record of manifest.files.filter(r=>r.path.startsWith('model/'+prefix+'.weights-'))){
    externalData.push({path:record.path.slice(6),data:new Uint8Array(await bytes(record.path))});
  }
  return ort.InferenceSession.create(new Uint8Array(await bytes('model/'+name+'.onnx')),
    {executionProviders:['wasm'],externalData,enableCpuMemArena:false,enableMemPattern:false,graphOptimizationLevel:'all'});
}
const float=(data,dims)=>new ort.Tensor('float32',data,dims);
function embedding(name,id,positionName,position){
  const t=tables[name],p=tables[positionName];
  if(id<0||id>=t.rows||position<0||position>=p.rows)throw Error('Текст превышает длину модели.');
  const row=new Float32Array(1024);
  for(let j=0;j<1024;j++)row[j]=t.weights[id*1024+j]*t.scales[id]+p.weights[position*1024+j]*p.scales[position];
  return row;
}
const dispose=values=>Object.values(values||{}).forEach(t=>t?.dispose?.());
async function speechTokens(text,id,rand){
  const encode=core.tokenizer(config.tokenizer);
  const ids=[config.start_text,...encode(text),config.stop_text];
  if(ids.length>256)throw Error('Фраза слишком длинная.');
  const conditioning=new Float32Array(config.conditioning[0].flat());
  const bos=embedding('speech_embeddings',config.start_speech,'speech_positions',0);
  let length=conditioning.length/1024+ids.length+2;
  const conditional=new Float32Array(length*1024);conditional.set(conditioning);
  ids.forEach((token,i)=>conditional.set(embedding('text_embeddings',token,'text_positions',i),conditioning.length+i*1024));
  conditional.set(bos,conditional.length-2048);conditional.set(bos,conditional.length-1024);
  const unconditional=new Float32Array(conditional);unconditional.fill(0,conditioning.length,conditional.length-2048);
  let embeddings=new Float32Array(conditional.length*2);embeddings.set(conditional);embeddings.set(unconditional,conditional.length);
  const session=await load('language_model');const tokens=[];let past=0,kv={},finished=false;
  for(let i=0;i<config.layers;i++)for(const suffix of ['k','v'])kv[`layer${i}.past_${suffix}`]=float(new Float32Array(0),[2,16,0,64]);
  try{
    for(let step=0;step<500;step++){
      const r=core.rope(config.rope_inv_freq,past,length);
      const feeds={embeddings:float(embeddings,[2,length,1024]),mask:float(r.mask,[1,1,length,past+length]),rope_cos:float(r.cos,[1,1,length,64]),rope_sin:float(r.sin,[1,1,length,64]),...kv};
      const result=await session.run(feeds);
      const token=core.sample(result.logits.data,tokens,config.start_speech,rand);
      dispose(feeds);result.logits.dispose?.();kv={};
      for(let i=0;i<config.layers;i++)for(const suffix of ['k','v'])kv[`layer${i}.past_${suffix}`]=result[`layer${i}.present_${suffix}`];
      past+=length;
      if(token===config.stop_speech){finished=true;break;}
      tokens.push(token);
      const row=embedding('speech_embeddings',token,'speech_positions',step+1);
      embeddings=new Float32Array(2048);embeddings.set(row);embeddings.set(row,1024);length=1;
      if(step%25===0)postMessage({type:'progress',id,message:'Китсуне готовит речь…'});
    }
  }finally{dispose(kv);await session.release();}
  if(!finished||tokens.length<10)throw Error('Не удалось завершить фразу. Повтори озвучку.');
  return tokens;
}
async function synthesize(text,id){
  postMessage({type:'progress',id,message:'Китсуне готовит новую фразу…'});
  const rand=core.random(1729);const tokens=await speechTokens(text,id,rand);
  postMessage({type:'progress',id,message:'Китсуне создаёт звучание…'});
  let session=await load('acoustic_encoder');let acoustic;
  const tokenTensor=new ort.Tensor('int64',BigInt64Array.from(tokens,v=>BigInt(v)),[1,tokens.length]);
  try{acoustic=await session.run({speech_tokens:tokenTensor});}finally{tokenTensor.dispose?.();await session.release();}
  const mu=acoustic.mu,cond=acoustic.cond,frames=mu.dims[2];
  let noise=core.normals(mu.data.length,rand);
  session=await load('flow_step');
  try{
    for(let step=0;step<10;step++){
      postMessage({type:'progress',id,message:'Китсуне создаёт звучание…'});
      const t=1-Math.cos(step/10*Math.PI/2),end=1-Math.cos((step+1)/10*Math.PI/2);
      const x=float(noise,[1,80,frames]),time=float(new Float32Array([t]),[1]);
      let result;
      try{result=await session.run({noise:x,mu,cond,time});for(let i=0;i<noise.length;i++)noise[i]+=(end-t)*result.velocity.data[i];}
      finally{x.dispose?.();time.dispose?.();dispose(result);}
    }
  }finally{await session.release();dispose(acoustic);}
  const generatedFrames=tokens.length*2,skip=frames-generatedFrames,mel=new Float32Array(80*generatedFrames);
  for(let i=0;i<80;i++)mel.set(noise.subarray(i*frames+skip,(i+1)*frames),i*generatedFrames);
  noise=null;postMessage({type:'progress',id,message:'Китсуне заканчивает подготовку звука…'});session=await load('vocoder');
  const phases=new Float32Array(9);for(let i=1;i<9;i++)phases[i]=rand()*2*Math.PI-Math.PI;
  const feeds={mel:float(mel,[1,80,generatedFrames]),source_noise:float(core.normals(9*generatedFrames*480,rand),[1,9,generatedFrames*480]),source_phases:float(phases,[1,9,1])};
  try{
    const result=await session.run(feeds);const samples=new Float32Array(result.waveform.data);
    dispose(result);
    for(let i=0;i<Math.min(960,samples.length);i++)samples[i]*=i<480?0:(Math.cos(Math.PI-(i-480)/479*Math.PI)+1)/2;
    const wav=core.wav(samples,config.sample_rate);return {wav,duration:samples.length/config.sample_rate};
  }finally{dispose(feeds);await session.release();}
}
let running=false;
self.onmessage=async({data})=>{
  if(running)return;running=true;
  try{
    if(data.type==='init'){await init(data);postMessage({type:'ready',id:data.id});}
    else if(data.type==='generate'){const result=await synthesize(data.text,data.id);postMessage({type:'audio',id:data.id,...result},[result.wav]);}
  }catch(error){postMessage({type:'error',id:data.id,message:String(error?.message||error)});}
  finally{running=false;}
};
