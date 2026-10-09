const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),{webcrypto}=require('node:crypto');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
const tick=()=>new Promise(r=>setImmediate(r));
async function flush(){for(let i=0;i<20;i++)await tick();}
function harness({bad=false,defer=false,decodeBad=false}={}){
  let requests=0,playing=[],states=[],pending=[],store=new Map();
  const box={URL,Response,AbortController,crypto:webcrypto,Uint8Array,console:{warn(){}},
    setTimeout:(fn,ms)=>setTimeout(fn,ms===300?0:ms),clearTimeout,
    localStorage:{getItem:()=>null,setItem(){}},
    document:{currentScript:{src:'https://example.test/algebra8-course/static-voice-v04.js?v=1'}},
    v151VoiceEnabled:true,v151SpeechUnlocked:true,
    CustomEvent:class{constructor(type,{detail}){this.type=type;this.detail=detail;}},
    addEventListener(){},dispatchEvent(){},v161MarkSpeaking:(on)=>states.push(on),
    caches:{open:async()=>({match:async url=>store.get(url)?.clone(),put:async(url,res)=>store.set(url,res),delete:async url=>store.delete(url)})},
    fetch:async(url,{signal}={})=>{
      requests++;
      if(defer)await new Promise((resolve,reject)=>{pending.push(resolve);signal?.addEventListener('abort',()=>reject(new Error('aborted')));});
      const file=path.join(root,'assets/voice/pilot_v04',new URL(url).pathname.split('/pilot_v04/')[1]);
      return new Response(bad?Buffer.from('broken'):fs.readFileSync(file));
    },
    AudioContext:class{
      state='running';resume(){return Promise.resolve();}
      async decodeAudioData(){if(decodeBad)throw new Error('decode');return {};}
      createBufferSource(){const s={connect(){},disconnect(){},start(){playing.push(s);},stop(){s.onended?.();}};return s;}
    }
  };
  box.window=box;vm.createContext(box);
  vm.runInContext(read('static-voice-pack-v04.js'),box);
  vm.runInContext(read('static-voice-v04.js'),box);
  box.v161StopSpeech=()=>box.KitsuneStaticVoice.stop();
  return {box,api:box.KitsuneStaticVoice,text:box.KITSUNE_STATIC_PACK_V04.segments[0].text,
    playing,states,store,pending,requests:()=>requests};
}
test('Один голос включён по умолчанию; выключение и неизвестные реплики учитываются',()=>{
  const h=harness();assert.equal(h.api.info().enabled,true);h.api.enable(false);assert.equal(h.api.trySpeak(h.text,{force:true}),false);h.api.enable(true);
  assert.equal(h.api.trySpeak('Другой урок',{force:true}),false);
  h.box.v151VoiceEnabled=false;assert.equal(h.api.trySpeak(h.text,{force:true}),false);
  h.box.v151VoiceEnabled=true;h.box.v151SpeechUnlocked=false;
  assert.equal(h.api.trySpeak(h.text),false);
  assert.equal(h.api.trySpeak(h.text,{force:true,voiceOverride:{}}),false);
  assert.equal(h.api.trySpeak(h.text,{force:true,skipStatic:true}),false);assert.equal(h.requests(),0);
});
test('Утверждённый WAV, путь GitHub Pages, завершение и офлайн повтор',async()=>{
  const h=harness();h.api.enable(true);let done=0;
  assert.equal(h.api.trySpeak(h.text,{force:true,onDone:()=>done++}),true);
  assert.equal(h.states.includes(true),false,'Загрузка WAV не включает индикатор речи');
  await new Promise(r=>setTimeout(r,60));assert.equal(h.playing.length,1);
  assert.equal(h.states.includes(true),true);
  h.playing[0].onended();await new Promise(r=>setTimeout(r,10));assert.equal(done,1);
  assert.equal(h.store.size,1);assert([...h.store.keys()][0].startsWith('https://example.test/algebra8-course/assets/voice/'));
  h.box.fetch=()=>{throw new Error('offline');};h.api.trySpeak(h.text,{force:true});
  await new Promise(r=>setTimeout(r,30));assert.equal(h.playing.length,2);h.api.stop();
});
test('Повреждённый WAV вызывает уведомление один раз и не попадает в кэш',async()=>{
  const h=harness({bad:true});h.api.enable(true);let fallback=0;
  h.api.trySpeak(h.text,{force:true},()=>fallback++);
  await new Promise(r=>setTimeout(r,60));assert.equal(fallback,1);assert.equal(h.store.size,0);assert.equal(h.playing.length,0);
});
test('Остановка во время загрузки запрещает поздний звук и fallback',async()=>{
  const h=harness({defer:true});h.api.enable(true);let fallback=0;
  h.api.trySpeak(h.text,{force:true},()=>fallback++);await flush();h.api.stop();
  h.pending.forEach(r=>r());await flush();assert.equal(h.playing.length,0);assert.equal(fallback,0);
});
test('Ошибка декодирования вызывает уведомление без запуска звука',async()=>{
  const h=harness({decodeBad:true});h.api.enable(true);let fallback=0;
  h.api.trySpeak(h.text,{force:true},()=>fallback++);await new Promise(r=>setTimeout(r,40));assert.equal(fallback,1);
});
test('Загрузка всего пакета и повтор без сети',async()=>{
  const h=harness();await h.api.download();assert.equal(h.store.size,5);
  h.box.fetch=()=>{throw new Error('offline');};await h.api.download();assert.equal(h.store.size,5);
});
test('Оболочка, lazy-модули и маршруты озвучки согласованы',()=>{
  const index=read('index.html'),sw=read('sw.js'),loader=read('runtime-loader-v2395.js');
  for(const script of ['static-voice-v04','static-voice-pack-v04','runtime-loader-v2395']){
    const ref='./'+script+'.js?v='+(script==='static-voice-pack-v04'?'voice-pack-v04.1':'single-voice-v05.1');assert(index.includes(ref));assert(sw.includes(ref));
  }
  assert(loader.includes('./voice-stability-v2387.js?v=single-voice-v05.1'));
  assert(read('live-assistant-v15.js').includes('KitsuneStaticVoice?.trySpeak'));
  assert(index.indexOf('static-voice-pack-v04.js')<index.indexOf('static-voice-v04.js'));
  assert(index.indexOf('static-voice-v04.js')<index.indexOf('live-assistant-v15.js'));
  const version=JSON.parse(read('version.json'));assert(sw.includes('kitsune-math-'+version.version+'-'+version.build_revision));
  assert(index.indexOf('ondevice-voice-core-v06.js')<index.indexOf('dynamic-voice-v05.js'));
  assert(sw.includes('./ondevice-voice-worker-v06.js'));
});
