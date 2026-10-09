'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),core=require('../ondevice-voice-core-v06.js');
test('Браузерный tokenizer совпадает с Python tokenizers на русском, ё и ударениях',()=>{
 const config=JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/chatterbox-config-v06.json'))),encode=core.tokenizer(config.tokenizer);
 for(const item of JSON.parse(fs.readFileSync(path.join(__dirname,'device-tokenizer-v06.json'))))assert.deepEqual(encode(item.text),item.ids,item.text);
});
test('Исходный словарь ударений перенесён без изменений, формулы читаются словами',()=>{
 const original=Object.fromEntries([...fs.readFileSync(path.join(root,'tools/voice-engine/kitsune_pronunciation.py'),'utf8').matchAll(/"([а-яё]+)": "([^"]+)"/g)].map(m=>[m[1],m[2]]));
 assert.deepEqual(core.stress,original);assert.equal(core.prepare('x² + 21 = 3 × 7'),'икс во второй сте́пени плюс двадцать один равно три умножить на семь');
 assert.equal(core.prepare('Китсуне читает дроби и числитель.'),'Китсуне читает дро́би и числи́тель.');
 const parts=core.chunks('Китсуне читает новые примеры. '.repeat(20));assert(parts.length>1);assert(parts.every(p=>p.length<=145));assert.equal(parts.join(' '),core.prepare('Китсуне читает новые примеры. '.repeat(20)));
});
test('Причинная маска закрывает будущее, WAV отвергает тишину и NaN',()=>{
 const r=core.rope(new Float32Array(32).fill(.1),2,3);assert.deepEqual(Array.from(r.mask),[0,0,0,-10000,-10000,0,0,0,0,-10000,0,0,0,0,0]);
 assert.throws(()=>core.wav(new Float32Array(24000)),/тихую/);const a=new Float32Array(24000).fill(.1);a[5]=NaN;assert.throws(()=>core.wav(a),/повреждённые/);
 a[5]=.1;const bytes=core.wav(a);assert.equal(new DataView(bytes).getUint32(24,true),24000);assert.equal(bytes.byteLength,48044);
});
test('Подписи разделов не становятся произведением; формулы и математические скобки сохраняются',()=>{
 assert.equal(core.prepare('**1 · Смысл темы**'),'Раздел один, Смысл темы.');
 assert.equal(core.prepare('«**После урока ты должен(на) уметь**»'),'«После урока тебе нужно уметь»');
 assert.equal(core.prepare('2**3'),'два в третьей сте́пени');
 assert.equal(core.prepare('7 · ИТОГ'),'Раздел семь, ИТОГ.');
 assert.equal(core.prepare('2 · 3 = 6'),'два умножить на три равно шесть');
 assert.equal(core.prepare('2 · x'),'два умножить на икс');
 assert.match(core.prepare('7 / (x + 4)'),/открываем скобку икс плюс четыре закрываем скобку/);
});
test('Редакционные окончания и декоративные эмодзи не произносятся',()=>{
 assert.equal(core.prepare('После урока ты должен(на) уметь'),'После урока тебе нужно уметь');
 assert.equal(core.prepare('Я здесь 🦊 Можешь написать или сказать вслух.'),'Я здесь. Можешь написать или сказать вслух.');
 assert.equal(core.prepare('Ты понял(а), вырос(ла) и уверен(а).'),'Ты понял, вырос и уверен.');
 assert.equal(core.prepare('✅ Отлично! 👨‍👩‍👧 👍🏽 🇷🇺 1️⃣'),'Отлично!');
 assert(!core.prepare('sin(a)').includes('sin'));
});
test('Названия помощников не превращаются в буквенные произведения',()=>{
 assert.equal(core.prepare('Нужен Cloud Brain.'),'Нужен облачный помощник.');
 assert.equal(core.prepare('Kitsune, Math Lab, Piper и Whisper'),'Китсуне, математическая лаборатория, Пайпер и распознавание речи');
 assert.equal(core.prepare('2xy + ab'),'два икс умножить на игрек плюс а умножить на бэ');
 assert.equal(core.prepare('x, y.'),'икс, игрек.');
 assert(!core.prepare('Windows Browser').includes('умножить'));
});
test('Школьная подготовка речи сохраняет разделы и абзацы до автономного генератора',()=>{
 const box={window:{KitsuneDeviceCore:core}};vm.createContext(box);vm.runInContext(fs.readFileSync(path.join(root,'school-notation-v3045.js'),'utf8'),box);
 const text='1 · Смысл темы\n\nПосле урока ты должен(на) уметь\n2 · 3 = 6';
 const spoken=core.prepare(box.window.KitsuneSchoolNotation.speech(text));
 assert.equal(spoken,'Раздел один, Смысл темы.\n\nПосле урока тебе нужно уметь\nдва умножить на три равно шесть');
 assert.equal(box.window.KitsuneSchoolNotation.text('1 · Смысл темы'),'1 · Смысл темы');
});
test('План Piper задаёт отдельные паузы предложений, абзацев и заголовков',()=>{
 const plan=core.speechPlan('1 · Смысл темы\nЯ здесь 🦊 Можешь написать.\n\nНовый абзац.');
 assert.deepEqual(plan,[{text:'Раздел один, Смысл темы.',pause_after_ms:750},{text:'Я здесь.',pause_after_ms:260},
  {text:'Можешь написать.',pause_after_ms:650},{text:'Новый абзац.',pause_after_ms:0}]);
 const long=core.speechPlan('Длинный текст '.repeat(40)+'.');assert(long.every(x=>x.text.length<=145));
 assert(long.slice(0,-1).every(x=>x.pause_after_ms===0));assert.throws(()=>core.speechPlan('...'),/нет слов/);
});
test('Обыкновенные дроби читаются слитно с правильным родом и окончаниями',()=>{
 assert.equal(core.prepare('Например, 1/2.'),'Например, одна вторая.');
 assert.equal(core.prepare('3/4; 2/3; −1/2; ½; 1½'),'три четвёртых; две третьих; минус одна вторая; одна вторая; одна целая и одна вторая');
 assert.equal(core.prepare('21/2'),'двадцать одна вторая');
 assert.equal(core.fraction('7','(x + 4)'),'дробь. В числителе 7. В знаменателе x + 4.');
 assert.match(core.fraction('1','0'),/В знаменателе 0/);
});
test('Верхние индексы и отрицательные степени имеют математический смысл',()=>{
 assert.equal(core.prepare('2³'),'два в третьей сте́пени');
 assert.equal(core.prepare('(x + 1)⁴'),'открываем скобку икс плюс один закрываем скобку в четвёртой сте́пени');
 assert.equal(core.prepare('x⁻³'),'икс в сте́пени минус три');
 assert.equal(core.prepare('xⁿ'),'икс в сте́пени эн');
 assert.equal(core.prepare('2^10'),'два в десятой сте́пени');
 assert.equal(core.prepare('2<sup>3</sup>'),'два в третьей сте́пени');
});
test('Математические знаки, их варианты Unicode и строгие сравнения читаются словами',()=>{
 for(const [input,expected] of [['x ⩾ 2','икс больше или равно два'],['x ⩽ 3','икс меньше или равно три'],['x >= 2','икс больше или равно два'],
  ['x ≤ 3','икс меньше или равно три'],['x ≠ 0','икс не равно ноль'],['2 ≈ 2','два приблизительно равно два'],['8 ÷ 2','восемь делить на два'],
  ['8:2','восемь делить на два'],['2⋅3','два умножить на три'],['√(x + 1)','квадратный корень из открываем скобку икс плюс один закрываем скобку'],
  ['|x|','модуль икс'],['a<x>c','а меньше икс больше цэ']])assert.equal(core.prepare(input),expected,input);
 assert.equal(core.prepare('<b>Пример</b>'),'Пример');
 assert.equal(core.prepare('Посчитаем: 2 + 3'),'Посчитаем: два плюс три');
});
test('Речь из DOM сохраняет дробь и sup, не меняя отображённые узлы',()=>{
 const box={window:{KitsuneDeviceCore:core}};vm.createContext(box);vm.runInContext(fs.readFileSync(path.join(root,'school-notation-v3045.js'),'utf8'),box);
 const text=value=>({nodeType:3,nodeValue:value});
 const el=(tag,children,cls='')=>({nodeType:1,tagName:tag,childNodes:children,classList:{contains:name=>name===cls},getAttribute:()=>null,hasAttribute:()=>false});
 const num=el('SPAN',[text('1')]),den=el('SPAN',[text('2')]),f=el('SPAN',[num,den],'school-frac');
 f.querySelector=sel=>sel==='.school-frac-num'?num:den;
 const dom=el('P',[text('Например, '),f,text('. Затем 2'),el('SUP',[text('3')]),text('.')]);
 const original=JSON.stringify(dom);const raw=box.window.KitsuneSchoolNotation.elementText(dom);
 assert.equal(core.prepare(box.window.KitsuneSchoolNotation.speech(raw)),'Например, одна вторая. Затем два в третьей сте́пени.');
 assert.equal(original,JSON.stringify(dom));
 assert.match(fs.readFileSync(path.join(root,'platform-v300.js'),'utf8'),/elementText\?\.\(body\)/);
 const math=core.speechPlan(raw);assert(math.some(p=>p.length_multiplier===1.12));
 assert(math.some(p=>p.pause_after_ms===450));
});
const tick=()=>new Promise(r=>setImmediate(r));
async function until(condition){for(let i=0;i<200;i++){if(condition())return;await new Promise(r=>setTimeout(r,5));}assert(condition(),'Ожидаемая асинхронная операция не завершилась');}
async function harness({fakeTime=false,stores=new Map(),suspended=false,piper=false}={}){
 const workers=[],sources=[],errors=[],marks=[];let corrupt=false,requests=0;
 let now=0,nextTimer=0;const timers=new Map();
 const clock={advance(ms){const end=now+ms;while(true){const due=[...timers].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!due)break;now=due[1].at;timers.delete(due[0]);due[1].fn();}now=end;}};
 const records=['model/language_model.onnx','model/acoustic_encoder.onnx','model/flow_step.onnx','model/vocoder.onnx','model/config.json','runtime/ort.wasm.min.js','runtime/ort-wasm-simd-threaded.mjs','runtime/ort-wasm-simd-threaded.wasm'];
 const data=Buffer.from('verified'),sha=crypto.createHash('sha256').update(data).digest('hex');
 const manifest={schema_version:2,voice_identity:'kitsune',reference_sha256:'50e9ea8ff8e7b3513c7b41080c36ac3ed82a333617d46195da081da4feae77c4',status:'candidate_needs_device_validation',files:records.map(path=>({path,bytes:data.length,sha256:sha})),validation:{native_cpu:{status:'passed'}}};
 const caches={open:async name=>{if(!stores.has(name))stores.set(name,new Map());const m=stores.get(name);return{match:async key=>m.get(String(key))?.clone(),put:async(key,value)=>m.set(String(key),value.clone()),delete:async key=>m.delete(typeof key==='string'?key:key.url),keys:async()=>[...m.keys()].map(url=>({url}))};}};
 class Worker{constructor(url){this.url=String(url);this.dead=false;this.messages=[];workers.push(this);}postMessage(m){this.messages.push(m);if(m.type==='init')queueMicrotask(()=>this.onmessage({data:{id:m.id,type:'ready'}}));}terminate(){this.dead=true;}complete(){const m=this.messages.findLast(m=>m.type==='generate');this.onmessage({data:{id:m.id,type:'audio',wav:core.wav(new Float32Array(24000).fill(.1))}});}}
 class AudioContext{get state(){return suspended?'suspended':'running';}resume(){return Promise.resolve();}decodeAudioData(){return Promise.resolve({});}createBufferSource(){const s={connect(){},disconnect(){},start(){sources.push(s);},stop(){s.onended?.();}};return s;}}
 const box={URL,Response,TextEncoder,crypto:crypto.webcrypto,caches,Worker,AudioContext,KitsuneDeviceCore:core,setTimeout,clearTimeout,console,
  v161MarkSpeaking:on=>marks.push(on),
  navigator:{storage:{estimate:async()=>({quota:1e7,usage:0}),persist:async()=>true}},
  fetch:async url=>{requests++;return String(url).endsWith('manifest.json')?new Response(JSON.stringify(manifest)):new Response(corrupt?'broken':data);}};
 if(fakeTime){box.Date=class extends Date{static now(){return now;}};box.setTimeout=(fn,delay)=>{const id=++nextTimer;timers.set(id,{fn,at:now+delay});return id;};box.clearTimeout=id=>timers.delete(id);}
 if(piper){box.document={currentScript:{src:'https://kitsune.invalid/algebra8-course/dynamic-voice-v05.js',dataset:{voiceEngine:'piper-v07'}},addEventListener(){}};box.KitsunePiperCore={validateManifest:m=>m,pronunciationRevision:require('../piper-voice-core-v07.js').pronunciationRevision};}
 box.window=box;box.v161StopSpeech=()=>box.KitsuneDynamicVoice.stop();vm.createContext(box);vm.runInContext(fs.readFileSync(path.join(root,'dynamic-voice-v05.js'),'utf8'),box);
 await box.KitsuneDynamicVoice.restored;
 return{engine:box.KitsuneDynamicVoice,workers,sources,errors,marks,manifest,clock,stores,resume:()=>{suspended=false;},corrupt:()=>{corrupt=true;},requests:()=>requests};
}
test('Установка проверяет каждый файл, чтение и повторный старт не используют сеть',async(t)=>{
 const h=await harness();t.after(()=>h.engine.stop());assert.equal(h.engine.trySpeak('Новая фраза'),false);assert.equal(h.requests(),0);
 await h.engine.install();assert.equal(h.engine.info().ready,true);assert.equal(h.engine.info().release_ready,false);
 const requests=h.requests();let done=0;assert(h.engine.trySpeak('Новая фраза',{force:true,onDone:()=>done++},e=>h.errors.push(e)));
 await until(()=>h.workers[0]?.messages.some(m=>m.type==='generate'));assert.equal(h.marks.includes(true),false);assert.match(h.engine.info().message,/готовит/);
 h.workers[0].complete();await until(()=>h.sources.length===1);assert.equal(h.sources.length,1);assert.equal(h.marks.at(-1),true);h.sources[0].onended();await tick();assert.equal(h.marks.at(-1),false);assert.equal(done,1);assert.equal(h.requests(),requests);assert.equal(h.engine.isBusy(),false);
});

test('Piper использует отдельный индекс, повторно использует модель и освобождает её после простоя',async(t)=>{
 const h=await harness({piper:true,fakeTime:true});t.after(()=>h.engine.stop(true));await h.engine.install();
 assert.equal(h.engine.info().engine,'piper-v07');assert(h.stores.has('kitsune-piper-index-v07'));assert(!h.stores.has('kitsune-device-index-v06'));
 h.engine.trySpeak('Первая новая фраза',{force:true});await until(()=>h.workers[0]?.messages.some(m=>m.type==='generate'));
 const w=h.workers[0];assert(w.url.endsWith('/algebra8-course/piper-voice-worker-v07.js'));assert(!h.engine.info().message.includes('минут'));
 w.complete();await until(()=>h.sources.length===1);h.sources[0].onended();await until(()=>!h.engine.isBusy());assert(!w.dead);
 h.engine.trySpeak('Вторая новая фраза',{force:true});await until(()=>w.messages.filter(m=>m.type==='generate').length===2);
 assert.equal(h.workers.length,1);w.complete();await until(()=>h.sources.length===2);h.sources[1].onended();await until(()=>!h.engine.isBusy());
 h.clock.advance(30001);assert(w.dead);assert([...h.stores.keys()].some(n=>n.startsWith('kitsune-generated-piper-v07-')));
});

test('Прерывание Piper во время расчёта отменяет worker и запрещает старый результат',async(t)=>{
 const h=await harness({piper:true});t.after(()=>h.engine.stop(true));await h.engine.install();
 h.engine.trySpeak('Первая фраза',{force:true});await until(()=>h.workers[0]?.messages.some(m=>m.type==='generate'));
 h.engine.trySpeak('Вторая фраза',{force:true});await until(()=>h.workers[1]?.messages.some(m=>m.type==='generate'));
 assert(h.workers[0].dead);h.workers[0].complete();await tick();assert.equal(h.sources.length,0);
 h.workers[1].complete();await until(()=>h.sources.length===1);h.sources[0].onended();await until(()=>!h.engine.isBusy());
});
test('Piper выдерживает паузу абзаца и не запускает следующее чтение раньше её окончания',async(t)=>{
 const h=await harness({piper:true,fakeTime:true});t.after(()=>h.engine.stop(true));await h.engine.install();
 let done=0;h.engine.trySpeak('Первый абзац.\n\nВторой абзац.',{force:true,onDone:()=>done++});
 await until(()=>h.workers[0]?.messages.some(m=>m.type==='generate'));const w=h.workers[0];
 w.complete();await until(()=>h.sources.length===1);h.sources[0].onended();await until(()=>/паузу/.test(h.engine.info().message));
 assert(h.engine.isBusy());assert.equal(done,0);assert.equal(h.engine.trySpeak('Фоновый совет'),false);
 h.clock.advance(649);await tick();assert.equal(w.messages.filter(m=>m.type==='generate').length,1);
 h.clock.advance(1);await until(()=>w.messages.filter(m=>m.type==='generate').length===2);
 w.complete();await until(()=>h.sources.length===2);h.sources[1].onended();await until(()=>done===1);
});
test('Стоп во время паузы Piper отменяет продолжение и прежний callback',async(t)=>{
 const h=await harness({piper:true,fakeTime:true});t.after(()=>h.engine.stop(true));await h.engine.install();let done=0;
 h.engine.trySpeak('Первая фраза.\nДругая фраза.',{force:true,onDone:()=>done++});await until(()=>h.workers[0]?.messages.some(m=>m.type==='generate'));
 const w=h.workers[0];w.complete();await until(()=>h.sources.length===1);h.sources[0].onended();await until(()=>/паузу/.test(h.engine.info().message));
 h.engine.stop();h.clock.advance(1000);await tick();assert(!h.engine.isBusy());assert.equal(done,0);assert.equal(w.messages.filter(m=>m.type==='generate').length,1);
});
test('Математика передаёт спокойный темп в Piper и повтор использует сохранённый WAV',async(t)=>{
 const h=await harness({piper:true});t.after(()=>h.engine.stop(true));await h.engine.install();
 h.engine.trySpeak('Например, 1/2.',{force:true});await until(()=>h.workers[0]?.messages.some(m=>m.type==='generate'));
 const w=h.workers[0],m=w.messages.find(m=>m.type==='generate');assert.equal(m.text,'Например, одна вторая.');assert.equal(m.lengthMultiplier,1.12);
 w.complete();await until(()=>h.sources.length===1);h.sources[0].onended();await until(()=>!h.engine.isBusy());
 h.engine.trySpeak('Например, 1/2.',{force:true});await until(()=>h.sources.length===2);
 assert.equal(w.messages.filter(m=>m.type==='generate').length,1);h.sources[1].onended();await until(()=>!h.engine.isBusy());
});
test('Новая мягкость «цель» не берёт старый WAV; повтор исправленной фразы использует кэш',async(t)=>{
 const h=await harness({piper:true});t.after(()=>h.engine.stop(true));await h.engine.install();
 h.engine.trySpeak('Цел.',{force:true});await until(()=>h.workers[0]?.messages.some(m=>m.type==='generate'));
 const w=h.workers[0];w.complete();await until(()=>h.sources.length===1);h.sources[0].onended();await until(()=>!h.engine.isBusy());
 const cache=[...h.stores].find(([name])=>name.startsWith('kitsune-generated-piper-v07-'))[1];
 const [key,res]=[...cache][0],oldHash=crypto.createHash('sha256').update('Цель.').digest('hex'),legacyKey=key.replace(/[^/]+\.wav$/,oldHash+'.wav');
 cache.set(legacyKey,res.clone());
 h.engine.trySpeak('Цель.',{force:true});await until(()=>w.messages.filter(m=>m.type==='generate').length===2);
 w.complete();await until(()=>h.sources.length===2);h.sources[1].onended();await until(()=>!h.engine.isBusy());
 assert(cache.has(legacyKey),'Предыдущая запись остаётся для отката');
 h.engine.trySpeak('Цель.',{force:true});await until(()=>h.sources.length===3);
 assert.equal(w.messages.filter(m=>m.type==='generate').length,2);h.sources[2].onended();await until(()=>!h.engine.isBusy());
});
test('Стоп во время генерации запрещает поздний звук и параллельную автоозвучку',async(t)=>{
 const h=await harness();t.after(()=>h.engine.stop());await h.engine.install();let done=0;h.engine.trySpeak('Первое чтение',{force:true,onDone:()=>done++});await until(()=>h.workers[0]?.messages.some(m=>m.type==='generate'));assert.equal(h.engine.trySpeak('Автоозвучка'),false);
 h.engine.stop();h.workers[0].complete();await tick();assert.equal(h.sources.length,0);assert.equal(done,0);assert.equal(h.engine.isBusy(),false);assert(h.workers[0].dead);
});

test('Повтор той же фразы во время подготовки не отменяет генерацию; завершение получает новый вызов',async(t)=>{
 const h=await harness();t.after(()=>h.engine.stop());await h.engine.install();let oldDone=0,newDone=0;
 h.engine.trySpeak('Новая фраза',{force:true,onDone:()=>oldDone++});await until(()=>h.workers[0]?.messages.some(m=>m.type==='generate'));
 assert(h.engine.trySpeak('Новая  фраза',{force:true,onDone:()=>newDone++}));await tick();
 assert.equal(h.workers.length,1);assert.equal(h.workers[0].dead,false);
 assert.equal(h.workers[0].messages.filter(m=>m.type==='generate').length,1);
 assert.match(h.engine.info().message,/Продолжаю/);h.workers[0].complete();await until(()=>h.sources.length===1);
 assert.equal(h.sources.length,1);h.sources[0].onended();await tick();assert.equal(oldDone,0);assert.equal(newDone,1);
});

test('Другая фраза отменяет прежнюю подготовку, старый результат не звучит',async(t)=>{
 const h=await harness();t.after(()=>h.engine.stop());await h.engine.install();let done=0;
 h.engine.trySpeak('Первая фраза',{force:true,onDone:()=>done++});await until(()=>h.workers[0]?.messages.some(m=>m.type==='generate'));
 h.engine.trySpeak('Другая фраза',{force:true,onDone:()=>done++});await until(()=>h.workers[1]?.messages.some(m=>m.type==='generate'));
 assert.equal(h.workers.length,2);assert.equal(h.workers[0].dead,true);
 h.workers[0].complete();await tick();assert.equal(h.sources.length,0);
 h.workers[1].complete();await until(()=>h.sources.length===1);assert.equal(h.sources.length,1);h.sources[0].onended();await tick();assert.equal(done,1);
});
test('Ошибка контрольной суммы не включает генератор, подмена голоса и пути отклоняются',async(t)=>{
 const h=await harness();t.after(()=>h.engine.stop());h.corrupt();await assert.rejects(h.engine.install(),/проверку/);assert.equal(h.engine.info().ready,false);
 assert.throws(()=>h.engine.validateManifest({...h.manifest,reference_sha256:'other'}),/голосу/);
 assert.throws(()=>h.engine.validateManifest({...h.manifest,files:[{path:'../secret',bytes:1,sha256:'0'.repeat(64)}]}),/описание/);
});
test('Работающий медленный генератор продлевает ожидание; предел времени сохраняется',async(t)=>{
 const h=await harness({fakeTime:true});t.after(()=>h.engine.stop());await h.engine.install();h.engine.trySpeak('Новая фраза',{force:true},e=>h.errors.push(e));await until(()=>h.workers[0]?.messages.some(m=>m.type==='generate'));
 const w=h.workers[0],id=w.messages.find(m=>m.type==='generate').id;
 for(let i=0;i<4;i++){h.clock.advance(240000);w.onmessage({data:{id,type:'progress',message:'Подготовка…'}});assert.equal(w.dead,false);}
 assert.equal(h.engine.isBusy(),true);h.clock.advance(240001);await tick();
 assert.equal(w.dead,true);assert.equal(h.engine.isBusy(),false);assert.equal(h.errors.length,1);assert.equal(h.sources.length,0);
});
test('Зависший генератор завершается, поздний звук после ошибки не запускается',async(t)=>{
 const h=await harness({fakeTime:true});t.after(()=>h.engine.stop());await h.engine.install();h.engine.trySpeak('Новая фраза',{force:true},e=>h.errors.push(e));await until(()=>h.workers[0]?.messages.some(m=>m.type==='generate'));
 h.clock.advance(300001);await tick();h.workers[0].complete();await tick();
 assert.equal(h.workers[0].dead,true);assert.equal(h.errors.length,1);assert.equal(h.sources.length,0);assert.equal(h.engine.isBusy(),false);
 assert.match(h.engine.info().message,/слишком много времени/);
});

test('Готовая фраза читается после перезапуска без Worker и сетевых запросов',async(t)=>{
 const h=await harness();t.after(()=>h.engine.stop());await h.engine.install();
 h.engine.trySpeak('Повторяемый шаг',{force:true});await until(()=>h.workers[0]?.messages.some(m=>m.type==='generate'));
 h.workers[0].complete();await until(()=>h.sources.length===1);h.sources[0].onended();await until(()=>!h.engine.isBusy());
 const next=await harness({stores:h.stores});t.after(()=>next.engine.stop());
 let done=0;assert(next.engine.trySpeak('Повторяемый шаг',{force:true,onDone:()=>done++}));
 await until(()=>next.sources.length===1);assert.equal(next.workers.length,0);assert.equal(next.requests(),0);
 next.sources[0].onended();await until(()=>done===1);assert.equal(next.engine.isBusy(),false);
});

test('Повреждённая сохранённая речь и чужой reference отвергаются',async(t)=>{
 for(const tamper of ['bytes','reference']){
  const h=await harness();t.after(()=>h.engine.stop());await h.engine.install();
  h.engine.trySpeak('Проверенный шаг',{force:true});await until(()=>h.workers[0]?.messages.some(m=>m.type==='generate'));
  h.workers[0].complete();await until(()=>h.sources.length===1);h.sources[0].onended();await until(()=>!h.engine.isBusy());
  const cache=[...h.stores].find(([name])=>name.startsWith('kitsune-generated-voice-v06-'))[1];
  const [key,res]=[...cache][0],headers=new Headers(res.headers);
  if(tamper==='reference')headers.set('X-Kitsune-Reference','other');
  cache.set(key,new Response(tamper==='bytes'?'broken':await res.arrayBuffer(),{headers}));
  h.engine.trySpeak('Проверенный шаг',{force:true});await until(()=>h.workers[1]?.messages.some(m=>m.type==='generate'));
  assert.equal(cache.size,0);assert.equal(h.sources.length,1);h.engine.stop();
 }
});

test('Блокировка звука после генерации сохраняет фразу для следующего нажатия',async(t)=>{
 const h=await harness({suspended:true});t.after(()=>h.engine.stop());await h.engine.install();
 h.engine.trySpeak('Фраза для повтора',{force:true},e=>h.errors.push(e));await until(()=>h.workers[0]?.messages.some(m=>m.type==='generate'));
 h.workers[0].complete();await until(()=>!h.engine.isBusy());assert.equal(h.sources.length,0);assert.match(h.errors[0],/разрешить звук/);
 h.resume();h.engine.trySpeak('Фраза для повтора',{force:true});await until(()=>h.sources.length===1);
 assert.equal(h.workers.length,1);h.sources[0].onended();await until(()=>!h.engine.isBusy());
});

test('Таймер подготовки показывает прошедшее время и прекращается при остановке',async(t)=>{
 const h=await harness({fakeTime:true});t.after(()=>h.engine.stop());await h.engine.install();
 h.engine.trySpeak('Новая фраза',{force:true});await until(()=>h.workers[0]?.messages.some(m=>m.type==='generate'));
 h.clock.advance(65000);assert.match(h.engine.info().message,/Прошло 1 мин 5 сек/);
 h.engine.stop();h.clock.advance(65000);assert.equal(h.engine.info().message,'');assert.equal(h.engine.isBusy(),false);
});

test('Очистка старых новых фраз ограничивается своим кэшем и оставляет последние 64 записи',async(t)=>{
 const h=await harness();t.after(()=>h.engine.stop());await h.engine.install();
 h.engine.trySpeak('Свежая фраза',{force:true});await until(()=>h.workers[0]?.messages.some(m=>m.type==='generate'));
 const generated=[...h.stores].find(([name])=>name.startsWith('kitsune-generated-voice-v06-'))[1];
 for(let i=0;i<70;i++)generated.set('https://kitsune.invalid/old-'+i,new Response('old'));
 h.stores.set('kitsune-voice-pack-pilot-v04',new Map([['approved',new Response('approved')]]));
 h.workers[0].complete();await until(()=>h.sources.length===1);assert.equal(generated.size,64);assert.equal(generated.has('https://kitsune.invalid/old-0'),false);
 assert.equal(h.stores.get('kitsune-voice-pack-pilot-v04').size,1);h.sources[0].onended();await until(()=>!h.engine.isBusy());
});
