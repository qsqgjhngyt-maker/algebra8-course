// Проверяет настоящий ONNX Runtime Web/WASM на Node V8. Это не проверка Safari/Chrome.
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{pathToFileURL}=require('node:url'),crypto=require('node:crypto');
const root=path.resolve(process.argv[2]||path.join(__dirname,'../../..')),base=path.join(root,'assets/voice/kitsune_ondevice_v06');
const manifest=JSON.parse(fs.readFileSync(path.join(base,'manifest.json')));
if(!fs.existsSync(path.join(base,'runtime/ort.wasm.min.js'))){console.error('BLOCKED: отсутствует браузерный runtime');process.exit(2);}
const ort=require(path.join(base,'runtime/ort.wasm.min.js'));
ort.env.wasm.numThreads=1;ort.env.wasm.proxy=false;ort.env.logLevel='error';
ort.env.wasm.wasmPaths={mjs:pathToFileURL(path.join(base,'runtime/ort-wasm-simd-threaded.mjs')).href};
ort.env.wasm.wasmBinary=fs.readFileSync(path.join(base,'runtime/ort-wasm-simd-threaded.wasm'));
const cache={match:async url=>{const relative=String(url).replace('https://kitsune.invalid/package/','');return new Response(fs.readFileSync(path.join(base,relative)));}};
const core=require(path.join(root,'ondevice-voice-core-v06.js'));
const input={ort,manifestInput:manifest,cacheInput:cache,baseInput:'https://kitsune.invalid/package/',
 Float32Array,Int8Array,Uint8Array,BigInt64Array,ArrayBuffer,URL,Blob,TextDecoder,Response,crypto:crypto.webcrypto,
 console,performance,importScripts(name){if(name!=='./ondevice-voice-core-v06.js')throw Error('Unexpected script');input.KitsuneDeviceCore=core;},
 postMessage(message){if(message.type==='progress')console.log(new Date().toISOString(),message.message);}};
input.self=input;vm.createContext(input);
vm.runInContext(fs.readFileSync(path.join(root,'ondevice-voice-worker-v06.js'),'utf8'),input);
const previousFetch=globalThis.fetch;
globalThis.fetch=()=>Promise.reject(Error('Сеть запрещена в WASM-тесте'));
(async()=>{
 const started=performance.now();
 await vm.runInContext(`(async()=>{manifest=manifestInput;cache=cacheInput;base=baseInput;
 config=JSON.parse(new TextDecoder().decode(await bytes('model/config.json')));tables={};
 for(const name of ['text_embeddings','speech_embeddings','text_positions','speech_positions']){
 tables[name]={weights:new Int8Array(await bytes('model/'+name+'.int8')),scales:new Float32Array(await bytes('model/'+name+'.scales')),rows:config[name].rows};}
 })()`,input);
 input.testText='Привет! Я Китсуне. Давай решим новую задачу вместе.';
 const result=await vm.runInContext('synthesize(testText,1)',input);
 const output=path.resolve(process.argv[3]||path.join(root,'.voice-test-work/wasm-v06'));fs.mkdirSync(output,{recursive:true});
 const wav=Buffer.from(result.wav);fs.writeFileSync(path.join(output,'Kitsune_WASM_V8.wav'),wav);
 let squared=0,peak=0;for(let i=44;i<wav.length;i+=2){const value=wav.readInt16LE(i)/32768;squared+=value*value;peak=Math.max(peak,Math.abs(value));}
 const report={status:'wasm_v8_passed',runtime:ort.env.versions,duration_seconds:result.duration,generation_seconds:(performance.now()-started)/1000,
   network:'blocked',text:input.testText,Android:'not_tested',iOS:'not_tested',PC_browser:'not_tested',listening:'pending',
   rms:Math.sqrt(squared/((wav.length-44)/2)),peak,audio_sha256:crypto.createHash('sha256').update(wav).digest('hex')};
 fs.writeFileSync(path.join(output,'wasm_v8_validation.json'),JSON.stringify(report,null,2));console.log(report);
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{globalThis.fetch=previousFetch;});
