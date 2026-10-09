'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),core=require('../piper-voice-core-v07.js');
const config=JSON.parse(fs.readFileSync(path.join(__dirname,'piper-phoneme-cases-v07.json'),'utf8'));
test('Таблица модели Piper и BOS/PAD/EOS совпадают с проверенными входами Python',()=>{
 core.validateConfig(config.model_config);
 for(const item of config.records)assert.deepEqual(core.phonemesToIds(Array.from(item.phonemes),config.model_config),item.ids,item.id);
 const wrong=structuredClone(config.model_config);wrong.phoneme_id_map.g=[66];assert.throws(()=>core.validateConfig(wrong),/таблица/);
 assert.throws(()=>core.phonemesToIds(['g'],config.model_config),/Неизвестный/);
 const result=core.parseOutput([JSON.stringify({phonemes:['z','ˈ','ɑ','m','ʌ','k'],phoneme_ids:[999]})],config.model_config);
 assert.deepEqual(result.ids,[1,0,38,0,120,0,51,0,25,0,102,0,23,0,2]);
});
function manifest(){return {schema_version:3,engine:'kitsune-piper-v07',voice_identity:'kitsune',reference_sha256:core.REF,status:'candidate_needs_device_validation',
 files:core.required.map(p=>({path:p,bytes:p.endsWith('ru_dict.bin')?core.RU_DICT_BYTES:1,sha256:p.endsWith('kitsune.onnx')?core.MODEL:p.endsWith('kitsune.onnx.json')?core.CONFIG:p.endsWith('ru_dict.bin')?core.RU_DICT:'0'.repeat(64)})),
 validation:{listening:{status:'approved_by_user'},native_cpu:{status:'passed'},phonemizer_wasm:{status:'passed'},full_tts_wasm:{status:'passed'}}};}
test('Утверждение тембра не снимает проверку полного runtime; подмена модели и пути отвергаются',()=>{
 assert.equal(core.validateManifest(manifest()).engine,'kitsune-piper-v07');
 const missing=manifest();missing.status='candidate_missing_runtime';assert.throws(()=>core.validateManifest(missing),/INSTALL_PIPER/);
 const untested=manifest();untested.validation.phonemizer_wasm.status='not_tested';assert.throws(()=>core.validateManifest(untested),/локальную/);
 const noFull=manifest();noFull.validation.full_tts_wasm.status='not_tested';assert.throws(()=>core.validateManifest(noFull),/локальную/);
 const dictionary=manifest();dictionary.files.find(f=>f.path.endsWith('ru_dict.bin')).sha256='0'.repeat(64);assert.throws(()=>core.validateManifest(dictionary),/словарь/);
 const wrong=manifest();wrong.files[0].sha256='0'.repeat(64);assert.throws(()=>core.validateManifest(wrong),/прослушанного/);
 const pathAttack=manifest();pathAttack.files.push({path:'runtime/../../secret',bytes:1,sha256:'0'.repeat(64)});assert.throws(()=>core.validateManifest(pathAttack),/описание/);
 const duplicate=manifest();duplicate.files.push(duplicate.files[0]);assert.throws(()=>core.validateManifest(duplicate),/описание/);
});
test('Русский словарь из обучения закреплён контрольной суммой; модуль без FS не используется',()=>{
 const dictionary=fs.readFileSync(path.join(root,'tools/voice-engine/piper-browser/data/ru_dict.bin'));
 assert.equal(dictionary.length,core.RU_DICT_BYTES);assert.equal(crypto.createHash('sha256').update(dictionary).digest('hex'),core.RU_DICT);
 assert.throws(()=>core.installDictionary({},dictionary),/словарь/);
 assert.throws(()=>core.installDictionary({FS:{writeFile(){}}},new Uint8Array(10)),/словарь/);
});
test('Короткое «Верно!» допустимо, тишина/NaN/слишком длинная запись отвергаются',()=>{
 const signal=new Float32Array(22050*.2).fill(.1),wav=core.wav(signal);assert.equal(new DataView(wav).getUint32(24,true),22050);
 assert.throws(()=>core.wav(new Float32Array(5000)),/тихую/);signal[2]=NaN;assert.throws(()=>core.wav(signal),/Повреждённый/);
 assert.throws(()=>core.wav(new Float32Array(22050*91)),/длина/);
});
test('«Цель» и «ноль» получают мягкую л, «цел» и соседние слова сохраняют звуки',()=>{
 const hard=Array.from('tsˈɛɭ'),zero=Array.from('nˈoɭ');
 const raw=[...hard,',',' ',...hard,' ',...zero,'.'];
 const got=core.parseOutput([JSON.stringify({phonemes:raw})],config.model_config,'Цель, цел ноль.');
 assert.deepEqual(got.phonemes,[...hard,'ʲ',',',' ',...hard,' ',...zero,'ʲ','.']);
 assert.deepEqual(raw,[...hard,',',' ',...hard,' ',...zero,'.'],'Исходные фонемы не изменены');
 assert.deepEqual(core.softenFinalL('Це́ль.',hard),[...hard,'ʲ']);
 assert.deepEqual(core.softenFinalL('Цель.',[...hard,'ʲ']),[...hard,'ʲ']);
 assert.deepEqual(core.softenFinalL('Цел.',hard),hard);
 assert.deepEqual(core.softenFinalL('Цель и слово.',hard),hard,'Неоднозначные границы не исправляем вслепую');
 assert.equal(core.pronunciationRevision('прицельный, цельность, цел, нол'),'');
 assert.equal(core.pronunciationRevision('Новая цель — понять.'),'final-soft-l-v1');
});
test('Worker передаёт подготовленный русский текст и ID собственной модели, повторно использует ONNX и запрещает HTTP',async()=>{
 const bytes=Buffer.from('local'),dictionary=Buffer.alloc(core.RU_DICT_BYTES,17);let loads=0,runs=0,requests=0,dictWrites=0;
 const fileBytes=p=>p.endsWith('kitsune.onnx.json')?Buffer.from(JSON.stringify(c)):p.endsWith('ru_dict.bin')?dictionary:bytes;
 const replies=[],captured=[],scales=[],urls=new Map();let serial=0;
 const c=structuredClone(config.model_config),phonemes=Array.from(config.records[0].phonemes);
 const box={console,TextDecoder,Float32Array,BigInt64Array,ArrayBuffer,DataView,Uint8Array,Blob,crypto:crypto.webcrypto,
  URL:class extends URL{static createObjectURL(blob){const key='blob:kitsune-'+(++serial);urls.set(key,blob);return key;}},
  fetch:()=>{requests++;throw Error('unexpected network');},
  caches:{open:async()=>({match:async url=>new Response(fileBytes(url))})},
  self:{postMessage:m=>replies.push(m)},
  ort:{env:{wasm:{}},Tensor:class{constructor(type,data,dims){this.type=type;this.data=data;this.dims=dims;}dispose(){}},InferenceSession:{create:async()=>{
    const env=box.ort.env.wasm;
    assert.equal(env.numThreads,1);assert.equal(env.proxy,false);assert.equal(env.initTimeout,30000);
    assert.equal(env.wasmBinary,undefined,'wasmBinary пропускает locateFile в ONNX 1.22 и ломает запуск из Blob');
    assert(urls.has(env.wasmPaths.mjs));assert(urls.has(env.wasmPaths.wasm),'WASM должен иметь явный локальный адрес');
    assert.equal(urls.get(env.wasmPaths.wasm).type,'application/wasm');
    // Имитация выбора locateFile в ONNX/Emscripten: относительный URL
    // с Blob бросает исключение ещё до асинхронной загрузки WASM.
    const locate=env.wasmBinary?undefined:(name=>env.wasmPaths.wasm);
    assert.equal(locate?locate('ort-wasm-simd-threaded.wasm'):new URL('ort-wasm-simd-threaded.wasm',env.wasmPaths.mjs).href,env.wasmPaths.wasm);
    loads++;return{outputNames:['output'],run:async feeds=>{runs++;captured.push(Array.from(feeds.input.data,n=>Number(n)));scales.push(Array.from(feeds.scales.data));return{output:{data:new Float32Array(8000).fill(.1),dispose(){}}};}};}}},
  createPiperPhonemize:async options=>{assert.equal(options.noInitialRun,true);assert.equal(options.getPreloadedPackage().byteLength,bytes.length);assert(options.locateFile('piper_phonemize.data').startsWith('kitsune-memory:'));let installed=false;return{FS:{writeFile:(p,data)=>{assert.equal(p,'/espeak-ng-data/ru_dict');assert.equal(data.byteLength,core.RU_DICT_BYTES);assert.equal(data[0],17);dictWrites++;installed=true;}},callMain:args=>{assert(installed,'Словарь должен быть установлен до callMain в каждом экземпляре');assert.equal(args[0],'-l');assert.equal(args[1],'ru');assert.equal(JSON.parse(args[3])[0].text,'Привет!');options.print(JSON.stringify({phonemes}));}};},
  importScripts(){}};
 box.globalThis=box;box.KitsunePiperCore={...core,validateManifest:m=>m};
 const m={files:core.required.map(p=>{const b=fileBytes(p);return{path:p,bytes:b.length,sha256:crypto.createHash('sha256').update(b).digest('hex')};})};
 vm.createContext(box);vm.runInContext(fs.readFileSync(path.join(root,'piper-voice-worker-v07.js'),'utf8'),box);
 await box.self.onmessage({data:{id:1,type:'init',manifest:m,base:'https://kitsune.invalid/voice/',cacheName:'local'}});
 assert.equal(replies.at(-1).type,'ready',replies.at(-1).message);
 for(const id of [2,3]){await box.self.onmessage({data:{id,type:'generate',text:'Привет!',lengthMultiplier:id===3?1.12:1}});assert.equal(replies.at(-1).type,'audio',replies.at(-1).message);}
 assert.equal(loads,1);assert.equal(runs,2);assert.equal(dictWrites,2);assert.deepEqual(captured[0],core.phonemesToIds(phonemes,c));assert.equal(requests,0);
 assert(Math.abs(scales[1][1]/scales[0][1]-1.12)<.00001);assert.equal(scales[0][0],scales[1][0]);assert.equal(scales[0][2],scales[1][2]);
 await box.self.onmessage({data:{id:4,type:'generate',text:'Привет!',lengthMultiplier:99}});assert.equal(replies.at(-1).type,'error');assert.match(replies.at(-1).message,/темп/);assert.equal(runs,2);
 await assert.rejects(box.fetch('https://example.com/'),/Сеть/);assert.equal(requests,0);
});
