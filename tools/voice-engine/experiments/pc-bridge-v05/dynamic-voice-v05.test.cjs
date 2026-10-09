const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),{webcrypto}=require('node:crypto');
const root=path.resolve(__dirname,'..'),source=fs.readFileSync(path.join(root,'dynamic-voice-v05.js'),'utf8');
const bytes=Buffer.from('verified test audio');
const tick=()=>new Promise(r=>setTimeout(r,10));
function harness({defer=false,bad=false}={}){
 let played=0,cancelled=0,notices=0;const box={AbortController,crypto:webcrypto,Uint8Array,Response,console,setTimeout:(fn,ms)=>setTimeout(fn,ms===300?0:ms),clearTimeout,
  v151VoiceEnabled:true,v151SpeechUnlocked:true,document:{querySelector:()=>null},addEventListener(){},v161MarkSpeaking(){},
  fetch:async(url,opts={})=>{
   if(url.endsWith('/cancel')){cancelled++;return new Response('{}');}
   if(url.endsWith('/speak')){
    if(defer)await new Promise((_,reject)=>opts.signal.addEventListener('abort',()=>reject(Error('cancel'))));
    const sha=Buffer.from(await webcrypto.subtle.digest('SHA-256',bytes)).toString('hex');
    return new Response(JSON.stringify({segments:[{audio:'a'.repeat(64)+'.wav',sha256:bad?'b'.repeat(64):sha}]}));
   }
   return new Response(bytes);
  },
  AudioContext:class{state='running';resume(){return Promise.resolve();}async decodeAudioData(){return {};}
   createBufferSource(){const s={connect(){},disconnect(){},start(){played++;setTimeout(()=>s.onended?.(),0);},stop(){s.onended?.();}};return s;}}
 };box.window=box;vm.createContext(box);vm.runInContext(source,box);
 box.v161StopSpeech=()=>box.KitsuneDynamicVoice.stop();
 return {box,api:box.KitsuneDynamicVoice,played:()=>played,cancelled:()=>cancelled,notice:()=>notices++};
}
test('Динамический TTS отдельно: без подключения к ПК запросы не отправляются',()=>{
 const h=harness();assert.equal(h.api.trySpeak('Фраза',{force:true}),false);assert.equal(h.api.isBusy(),false);assert.equal(h.played(),0);
});
test('Новая фраза проверяется по SHA; завершение снимает занятость',async()=>{
 const h=harness();h.box.KITSUNE_LOCAL_VOICE_ENDPOINT='/__kitsune/generator';let done=0;
 assert.equal(h.api.trySpeak('Новая фраза',{force:true,onDone:()=>done++}),true);
 for(let i=0;i<30&&!done;i++)await tick();assert.equal(done,1);assert.equal(h.played(),1);assert.equal(h.api.isBusy(),false);
 const broken=harness({bad:true});broken.box.KITSUNE_LOCAL_VOICE_ENDPOINT='/__kitsune/generator';let notice=0;
 broken.api.trySpeak('Ошибка',{force:true},()=>notice++);for(let i=0;i<30&&!notice;i++)await tick();assert.equal(broken.played(),0);assert.equal(notice,1);
});
test('Остановка отменяет генерацию; поздняя ошибка не запускает звук или другой голос',async()=>{
 const h=harness({defer:true});h.box.KITSUNE_LOCAL_VOICE_ENDPOINT='/__kitsune/generator';let notice=0;
 h.api.trySpeak('Первая фраза',{force:true},()=>notice++);await tick();h.api.stop();await tick();
 assert.equal(h.played(),0);assert.equal(notice,0);assert.equal(h.api.isBusy(),false);assert.equal(h.cancelled(),1);
});
