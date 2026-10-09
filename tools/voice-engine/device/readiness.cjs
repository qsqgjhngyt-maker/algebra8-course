/* Проверяет наличие собственной модели. Успех WAV-тестов не равен готовности TTS. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../../..');
function inspect(project=root){
 const file=path.join(project,'assets/voice/kitsune_ondevice_v06/manifest.json');
 const pending={ready:false,status:'awaiting_trained_model',voice_identity:'kitsune',targets:['Android','iOS','PC'],missing:[]};
 if(!fs.existsSync(file))return {...pending,missing:['manifest.json','Собственная компактная модель Kitsune ONNX','Локальный WASM runtime','Проверка генерации без сети на устройствах']};
 const m=JSON.parse(fs.readFileSync(file,'utf8'));
 const ref=JSON.parse(fs.readFileSync(path.join(project,'assets/voice/pilot_v04/manifest.json'),'utf8')).reference_sha256;
 if(m.voice_identity!=='kitsune'||m.reference_sha256!==ref)throw Error('Модель не относится к сохранённому эталону Kitsune.');
 if(m.schema_version===2){
  if(!Array.isArray(m.files)||!m.files.length)throw Error('Нет файлов модели и runtime.');
  const seen=new Set();let total=0;
  for(const r of m.files){
   if(!/^(model|runtime)\/[a-zA-Z0-9_.-]+$/.test(r.path)||seen.has(r.path)||!Number.isSafeInteger(r.bytes)||r.bytes<=0)throw Error('Некорректный файл модели.');
   seen.add(r.path);const bytes=fs.readFileSync(path.join(path.dirname(file),r.path));
   if(bytes.length!==r.bytes||crypto.createHash('sha256').update(bytes).digest('hex')!==r.sha256)throw Error('Не прошла проверка: '+r.path);
   total+=bytes.length;
  }
  const required=['model/language_model.onnx','model/acoustic_encoder.onnx','model/flow_step.onnx','model/vocoder.onnx','model/config.json','runtime/ort.wasm.min.js','runtime/ort-wasm-simd-threaded.mjs','runtime/ort-wasm-simd-threaded.wasm'];
  const missing=required.filter(p=>!seen.has(p));
  if(m.status!=='ready')return {...pending,status:m.status,model_ready:!missing.some(p=>p.startsWith('model/')),native_cpu:m.validation?.native_cpu?.status,bytes:total,files:seen.size,missing:[...missing,...(m.missing||[])]};
  if(missing.length||m.validation?.native_cpu?.status!=='passed')throw Error('Не подтверждены модель и runtime.');
  for(const target of ['Android','iOS','PC']){
   const v=m.validation?.devices?.[target];
   if(!v?.model||!v.browser||v.offline_generation!=='passed'||v.stop_and_overlap!=='passed'||v.listening!=='approved')throw Error('Не подтверждена проверка '+target);
  }
  return {ready:true,status:'ready',voice_identity:'kitsune',targets:['Android','iOS','PC'],files:seen.size,bytes:total};
 }
 if(m.status!=='ready')return {...pending,status:m.status,missing:m.missing||['Обученная модель и проверки']};
 if(!Array.isArray(m.files)||!m.files.length)throw Error('Нет файлов модели и runtime.');
 const seen=new Set();
 for(const r of m.files){
  if(!/^(model|runtime)\/[a-zA-Z0-9_.-]+$/.test(r.path)||seen.has(r.path)||!Number.isSafeInteger(r.bytes)||r.bytes<=0)throw Error('Некорректный файл модели.');
  seen.add(r.path);const bytes=fs.readFileSync(path.join(path.dirname(file),r.path));
  const sha=crypto.createHash('sha256').update(bytes).digest('hex');
  if(bytes.length!==r.bytes||sha!==r.sha256)throw Error('Не прошла проверка: '+r.path);
 }
 for(const required of ['model/kitsune.onnx','model/kitsune.onnx.json','runtime/ort.wasm.min.js','runtime/ort-wasm-simd-threaded.wasm','runtime/ort-wasm-simd-threaded.mjs','runtime/piper_phonemize.js','runtime/piper_phonemize.wasm','runtime/piper_phonemize.data']){
  if(!seen.has(required))throw Error('Отсутствует '+required);
 }
 const c=JSON.parse(fs.readFileSync(path.join(path.dirname(file),'model/kitsune.onnx.json'),'utf8'));
 if(c.phoneme_type!=='espeak'||c.espeak?.voice!=='ru'||c.num_speakers!==1)throw Error('Нужна одноголосая русская конфигурация собственной модели.');
 for(const target of ['Android','iOS','PC']){
  const v=m.validation?.devices?.[target];
  if(!v?.model||!v.browser||v.offline_generation!=='passed'||v.stop_and_overlap!=='passed'||v.listening!=='approved')throw Error('Не подтверждена проверка '+target);
 }
 return {ready:true,status:'ready',voice_identity:'kitsune',targets:['Android','iOS','PC'],files:seen.size};
}
module.exports={inspect};
if(require.main===module){try{const r=inspect();console.log(JSON.stringify(r,null,2));if(!r.ready&&!process.argv.includes('--report'))process.exitCode=2;}catch(e){console.error(e.message);process.exitCode=1;}}
