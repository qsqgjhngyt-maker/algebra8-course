'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),{inspect}=require('../tools/voice-engine/device/readiness.cjs');
test('Экспорт и установленный WASM не подменяют проверки браузера и телефонов',()=>{
 const r=inspect();assert.equal(r.ready,false);assert.equal(r.status,'candidate_needs_device_validation');assert.equal(r.model_ready,true);assert.equal(r.native_cpu,'passed');assert(!r.missing.some(p=>p.startsWith('runtime/')));assert(r.missing.some(p=>p.includes('Android')));
});
test('Смена эталона или пустой готовый пакет не проходят проверку',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'kitsune-device-gate-'));
 const base=path.join(dir,'assets/voice'),ref=JSON.parse(fs.readFileSync(path.join(root,'assets/voice/pilot_v04/manifest.json'))).reference_sha256;
 fs.mkdirSync(path.join(base,'pilot_v04'),{recursive:true});fs.mkdirSync(path.join(base,'kitsune_ondevice_v06'),{recursive:true});
 fs.writeFileSync(path.join(base,'pilot_v04/manifest.json'),JSON.stringify({reference_sha256:ref}));
 const target=path.join(base,'kitsune_ondevice_v06/manifest.json');
 try{
  fs.writeFileSync(target,JSON.stringify({voice_identity:'kitsune',reference_sha256:'other',status:'ready',files:[]}));assert.throws(()=>inspect(dir),/эталону/);
  fs.writeFileSync(target,JSON.stringify({voice_identity:'kitsune',reference_sha256:ref,status:'ready',files:[]}));assert.throws(()=>inspect(dir),/Нет файлов/);
 }finally{
  // Только явно созданные тестовые файлы и пустые каталоги; без рекурсивного удаления.
  fs.unlinkSync(target);fs.unlinkSync(path.join(base,'pilot_v04/manifest.json'));
  for(const d of [path.dirname(target),path.join(base,'pilot_v04'),base,path.dirname(base),dir])fs.rmdirSync(d);
 }
});
test('Чтение произвольной фразы не обращается к ПК даже при старом флаге панели',()=>{
 let requests=0;
 const box={URL,KITSUNE_LOCAL_VOICE_ENDPOINT:'/__kitsune/generator',fetch:()=>{requests++;throw Error('unexpected network');}};box.window=box;vm.createContext(box);
 vm.runInContext(fs.readFileSync(path.join(root,'dynamic-voice-v05.js'),'utf8'),box);
 assert.equal(box.KitsuneDynamicVoice.trySpeak('Новая фраза',{force:true}),false);
 assert.equal(box.KitsuneDynamicVoice.info().ready,false);assert.equal(requests,0);
});
