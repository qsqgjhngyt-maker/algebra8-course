const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{webcrypto}=require('node:crypto');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
const tick=()=>new Promise(r=>setTimeout(r,10));
async function until(fn){for(let i=0;i<300;i++){if(fn())return;await tick();}assert.fail('Воспроизведение не завершилось');}
function harness({defer=false,failAt=0}={}){
 const stores=new Map(),played=[],events=[];let requests=0,active=0,maximum=0;
 const box={URL,Response,AbortController,crypto:webcrypto,Uint8Array,console:{warn(){}},
  setTimeout:(fn,ms)=>setTimeout(fn,ms===300?0:ms),clearTimeout,localStorage:{getItem:()=>null,setItem(){}},
  document:{currentScript:{src:'https://example.test/algebra8-course/static-voice-v04.js'}},
  v151VoiceEnabled:true,v151SpeechUnlocked:true,addEventListener(){},v161MarkSpeaking(){},
  dispatchEvent:e=>events.push(e.detail),CustomEvent:class{constructor(t,{detail}){this.detail=detail;}},
  caches:{open:async name=>{if(!stores.has(name))stores.set(name,new Map());const data=stores.get(name);return {
   match:async url=>data.get(url)?.clone(),put:async(url,res)=>data.set(url,res),delete:async url=>data.delete(url)};}},
  fetch:async(url,{signal}={})=>{
   requests++;if(defer)await new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(Error('cancel'))));
   if(failAt===requests)throw Error('offline');
   return new Response(fs.readFileSync(path.join(root,new URL(url).pathname.slice('/algebra8-course/'.length))));
  },
  AudioContext:class{state='running';resume(){return Promise.resolve();}async decodeAudioData(bytes){return {bytes};}
   createBufferSource(){let on=false;const s={connect(){},disconnect(){},start(){on=true;active++;maximum=Math.max(maximum,active);played.push(s);setTimeout(()=>s.stop(),0);},stop(){if(!on)return;on=false;active--;s.onended?.();}};return s;}}
 };box.window=box;vm.createContext(box);
 for(const f of ['static-voice-pack-v04.js','static-voice-course-pack-v05.js','static-voice-v04.js'])vm.runInContext(read(f),box);
 box.v161StopSpeech=()=>box.KitsuneStaticVoice.stop();
 return {box,api:box.KitsuneStaticVoice,stores,played,events,requests:()=>requests,maximum:()=>maximum};
}
test('Три полных текста обычных уроков воспроизводят свои сегменты по порядку',async()=>{
 const h=harness();assert(h.api.info().topics>=3);
 for(const item of h.box.KITSUNE_STATIC_COURSE_PACK_V05.items){
  const expected=h.box.KITSUNE_STATIC_COURSE_PACK_V05.segments.filter(s=>s.item_id===item.id);const before=h.played.length;let done=false;
  assert.equal(h.api.trySpeak(item.text,{force:true,onDone:()=>done=true}),true);await until(()=>done);
  assert.equal(h.played.length-before,expected.length);
 }
 assert.equal(h.maximum(),1);assert(h.events.every(e=>e.pack==='grade8_algebra_v05'));
 assert.equal(h.api.trySpeak('Несуществующий урок',{force:true}),false);
});
test('План читалки использует исходные сегменты WAV и не удваивает их внутренние паузы',()=>{
 const h=harness();
 for(const item of h.box.KITSUNE_STATIC_COURSE_PACK_V05.items){
  const expected=Array.from(h.box.KITSUNE_STATIC_COURSE_PACK_V05.segments.filter(s=>s.item_id===item.id),s=>s.text);
  const plan=h.api.readingPlan(item.text);assert.deepEqual(Array.from(plan,p=>p.text),expected);
  assert(plan.every(p=>p.pause_after_ms===0));
 }
 assert.equal(h.api.readingPlan('Новый произвольный текст'),undefined);
});
test('Все записи сохраняются отдельно и полностью читаются без сети',async()=>{
 const h=harness(),clips=h.box.KITSUNE_STATIC_COURSE_PACK_V05.segments.length;
 assert.equal(await h.api.isCached(),false);const result=await h.api.download();assert.equal(result.clips,clips+5);assert.equal(await h.api.isCached(),true);
 assert.equal(h.stores.get('kitsune-voice-pack-pilot-v04').size,5);assert.equal(h.stores.get('kitsune-voice-pack-grade8-algebra-v05').size,clips);
 const requests=h.requests();h.box.fetch=()=>{throw Error('offline');};let done=false;
 h.api.trySpeak(h.box.KITSUNE_STATIC_COURSE_PACK_V05.items[0].text,{force:true,onDone:()=>done=true});await until(()=>done);assert.equal(h.requests(),requests);
});
test('После частичного чтения сбой не повторяет урок и не включает другой голос',async()=>{
 const h=harness({failAt:2});let done=0,unavailable=0;
 h.api.trySpeak(h.box.KITSUNE_STATIC_COURSE_PACK_V05.items[0].text,{force:true,onDone:()=>done++},()=>unavailable++);
 await until(()=>done===1);assert.equal(h.played.length,1);assert.equal(unavailable,0);assert.equal(h.api.isBusy(),false);
});
test('Остановка загрузки блокирует запоздалый звук и уведомление',async()=>{
 const h=harness({defer:true});let notice=0;
 h.api.trySpeak(h.box.KITSUNE_STATIC_COURSE_PACK_V05.items[0].text,{force:true},()=>notice++);
 await until(()=>h.requests()===1);h.api.stop();await tick();assert.equal(h.played.length,0);assert.equal(notice,0);assert.equal(h.api.isBusy(),false);
});
