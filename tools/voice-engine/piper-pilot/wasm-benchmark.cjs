/* Настоящий ONNX Runtime Web/WASM в Node V8; браузеры и телефоны проверяются отдельно. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const [candidateArg,runtimeArg]=process.argv.slice(2);
assert(candidateArg&&runtimeArg,'Укажите каталог audition и локальный runtime');
const candidate=path.resolve(candidateArg),runtime=path.resolve(runtimeArg),output=path.join(candidate,'wasm');
assert(!fs.existsSync(output),'Предыдущий WASM-замер сохраняется: используйте новую пробу');
for(const name of ['ort.wasm.min.js','ort-wasm-simd-threaded.mjs','ort-wasm-simd-threaded.wasm'])assert(fs.existsSync(path.join(runtime,name)));
const ort=require(path.join(runtime,'ort.wasm.min.js'));
ort.env.wasm.numThreads=1;ort.env.wasm.proxy=false;ort.env.logLevel='error';
ort.env.wasm.wasmPaths={mjs:pathToFileURL(path.join(runtime,'ort-wasm-simd-threaded.mjs')).href};
ort.env.wasm.wasmBinary=fs.readFileSync(path.join(runtime,'ort-wasm-simd-threaded.wasm'));
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const previousFetch=globalThis.fetch;
globalThis.fetch=()=>Promise.reject(Error('Сеть запрещена в этом WASM-замере'));
function wave(data,rate){
  const bytes=Buffer.alloc(44+data.length*2);bytes.write('RIFF');bytes.writeUInt32LE(bytes.length-8,4);bytes.write('WAVEfmt ',8);
  bytes.writeUInt32LE(16,16);bytes.writeUInt16LE(1,20);bytes.writeUInt16LE(1,22);bytes.writeUInt32LE(rate,24);
  bytes.writeUInt32LE(rate*2,28);bytes.writeUInt16LE(2,32);bytes.writeUInt16LE(16,34);bytes.write('data',36);bytes.writeUInt32LE(data.length*2,40);
  data.forEach((v,i)=>bytes.writeInt16LE(Math.round(Math.max(-1,Math.min(1,v))*32767),44+i*2));return bytes;
}
(async()=>{
  const model=fs.readFileSync(path.join(candidate,'kitsune.onnx')),started=performance.now();
  const session=await ort.InferenceSession.create(model,{executionProviders:['wasm'],graphOptimizationLevel:'all'});
  const loadSeconds=(performance.now()-started)/1000;
  const inputs=fs.readdirSync(path.join(candidate,'wasm-inputs')).filter(f=>f.endsWith('.json')).sort();
  const records=[];fs.mkdirSync(output);
  async function synthesize(ids,scales){
    assert(ids.length>0&&ids.length<=2000);assert(ids.every(n=>Number.isInteger(n)&&n>=0&&n<256));
    const result=await session.run({input:new ort.Tensor('int64',BigInt64Array.from(ids,n=>BigInt(n)),[1,ids.length]),
      input_lengths:new ort.Tensor('int64',BigInt64Array.of(BigInt(ids.length)),[1]),
      scales:new ort.Tensor('float32',Float32Array.from(scales),[3])});
    const data=result[session.outputNames[0]].data;assert(data instanceof Float32Array);assert(data.length<22050*90);
    return data;
  }
  const warmup=JSON.parse(fs.readFileSync(path.join(candidate,'wasm-inputs',inputs[0]),'utf8'));
  await synthesize(warmup.sentences[0],warmup.scales);
  for(const filename of inputs){
    const item=JSON.parse(fs.readFileSync(path.join(candidate,'wasm-inputs',filename),'utf8')),start=performance.now(),parts=[];
    for(const sentence of item.sentences)parts.push(await synthesize(sentence,item.scales));
    const elapsed=(performance.now()-start)/1000,signal=new Float32Array(parts.reduce((n,p)=>n+p.length,0));
    let offset=0;for(const p of parts){signal.set(p,offset);offset+=p.length;}
    assert(signal.length>=1000);let sum=0,peak=0;for(const v of signal){assert(Number.isFinite(v));sum+=v*v;peak=Math.max(peak,Math.abs(v));}
    const rms=Math.sqrt(sum/signal.length);assert(rms>=.001);
    const bytes=wave(signal,item.sample_rate),wavName=filename.replace(/\.json$/,'.wav');fs.writeFileSync(path.join(output,wavName),bytes);
    const record={file:wavName,text:item.text,seconds:signal.length/item.sample_rate,generation_seconds:elapsed,
      real_time_factor:elapsed/(signal.length/item.sample_rate),rms,peak,sha256:hash(bytes)};records.push(record);console.log(record.file,record.generation_seconds.toFixed(3)+' sec');
  }
  const report={status:'wasm_v8_passed_listening_pending',runtime:ort.env.versions,threads:1,network:'blocked',
    model_sha256:hash(model),model_load_seconds:loadSeconds,measurement:'ONNX only; phoneme preparation excluded',
    PC_browser:'not_tested',Android:'not_tested',iOS:'not_tested',records};
  fs.writeFileSync(path.join(output,'benchmark.json'),JSON.stringify(report,null,2)+'\n');await session.release();
  console.log(JSON.stringify({status:report.status,model_load_seconds:loadSeconds,phrases:records.length}));
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{globalThis.fetch=previousFetch;});
