const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),source=fs.readFileSync(path.join(root,'sw.js'),'utf8');
const origin='https://example.test',scope=origin+'/algebra8-course/';
function harness({script=source,stores=new Map(),shell='current shell',broken=false}={}){
  const events=new Map();let offline=false,requests=0,skipped=false,claimed=false;
  const key=value=>new URL(typeof value==='string'?value:value.url,scope).href;
  const caches={
    open:async name=>{
      if(!stores.has(name))stores.set(name,new Map());const data=stores.get(name);
      return {put:async(req,res)=>data.set(key(req),res.clone()),delete:async req=>data.delete(key(req)),
        match:async(req,opts={})=>{
          const url=key(req);
          if(!opts.ignoreSearch)return data.get(url)?.clone();
          const path=new URL(url).pathname;return [...data].find(([k])=>new URL(k).pathname===path)?.[1].clone();
        }};
    },keys:async()=>[...stores.keys()],delete:async name=>stores.delete(name)
  };
  const self={location:{origin,href:scope+'sw.js'},addEventListener:(name,fn)=>events.set(name,fn),skipWaiting:()=>{skipped=true;},clients:{claim:async()=>{claimed=true;}}};
  const box={self,caches,URL,Headers,Response,Request:class extends Request{constructor(url,opts){super(new URL(url,scope),opts);}},
    fetch:async req=>{
      requests++;if(offline)throw new Error('offline');const url=new URL(key(req));
      if(broken&&url.pathname.endsWith('/math-engine-v130.js'))return new Response('missing',{status:404});
      const file=path.resolve(root,url.pathname.slice('/algebra8-course/'.length));
      if(!file.startsWith(root+path.sep))return new Response('forbidden',{status:403});
      try{return new Response(url.pathname.endsWith('/index.html')?shell:fs.readFileSync(file),{headers:{'Content-Type':file.endsWith('.js')?'text/javascript':'application/octet-stream'}});}
      catch{return new Response('missing',{status:404});}
    }
  };vm.createContext(box);vm.runInContext(script,box);
  const run=async(name,data={})=>{let promise;events.get(name)({...data,waitUntil:p=>promise=p});await promise;};
  const fetchRequest=async(url,{navigate=false}={})=>{let result;events.get('fetch')({request:{url:new URL(url,scope).href,method:'GET',mode:navigate?'navigate':'cors',destination:navigate?'document':'script'},respondWith:p=>result=p});return result&&await result;};
  return {stores,caches,run,fetchRequest,setOffline:v=>offline=v,skipped:()=>skipped,claimed:()=>claimed,requests:()=>requests};
}
test('Установка сохраняет полный набор оболочки, включая заставку и точные Worker URL',async()=>{
  const h=harness();await h.run('install');assert.equal(h.skipped(),false);
  h.setOffline(true);
  for(const url of ['./startup-intro.css?v=cinematic-v316.3','./startup-intro.js?v=cinematic-v316.2',
    './assets/kitsune-cinematic-intro-v316.mp4?v=cinematic-v316.2','./assets/kitsune-cinematic-poster-v316.webp?v=cinematic-v316.2',
    './math-worker-v130.js?v=3.1.0-rc.5'])assert.equal((await h.fetchRequest(url)).status,200,url);
  assert.equal(await (await h.fetchRequest('./',{navigate:true})).text(),'current shell');
});
test('Неудачная установка удаляет только новый кэш; прежняя оболочка остаётся доступной',async()=>{
  const oldScript=source.replace(/const CACHE="[^"]+"/,'const CACHE="kitsune-math-previous"');
  const old=harness({script:oldScript,shell:'previous shell'});await old.run('install');
  const next=harness({stores:old.stores,broken:true});await assert.rejects(next.run('install'));
  assert(old.stores.has('kitsune-math-previous'));assert(!old.stores.has(source.match(/const CACHE="([^"]+)"/)[1]));
  old.setOffline(true);assert.equal(await (await old.fetchRequest('./',{navigate:true})).text(),'previous shell');
});
test('Новая оболочка ждёт принятия; активация сохраняет WAV и модельные кэши',async()=>{
  const old=harness({script:source.replace(/const CACHE="[^"]+"/,'const CACHE="kitsune-math-previous"'),shell:'previous shell'});
  await old.run('install');
  await (await old.caches.open('kitsune-voice-pack-pilot-v04')).put('./assets/voice/pilot_v04/approved.wav',new Response('approved'));
  await (await old.caches.open('algebra8-ai-runtime-v1')).put('./model-marker',new Response('model'));
  await (await old.caches.open('kitsune-generated-voice-v06-test')).put('./generated-marker',new Response('generated'));
  const retained=['kitsune-piper-index-v07','kitsune-piper-voice-v07-existing','kitsune-generated-piper-v07-existing'];
  for(const name of retained)await (await old.caches.open(name)).put('./voice-marker',new Response('saved '+name));
  const next=harness({stores:old.stores});await next.run('install');
  assert.equal(next.skipped(),false);assert.equal(await (await old.fetchRequest('./',{navigate:true})).text(),'previous shell');
  await next.run('message',{data:{type:'SKIP_WAITING'}});assert.equal(next.skipped(),true);
  await next.run('activate');assert.equal(next.claimed(),true);assert(!old.stores.has('kitsune-math-previous'));
  next.setOffline(true);assert.equal(await (await next.fetchRequest('./',{navigate:true})).text(),'current shell');
  assert.equal(await (await (await next.caches.open('kitsune-voice-pack-pilot-v04')).match('./assets/voice/pilot_v04/approved.wav')).text(),'approved');
  for(const name of retained)assert.equal(await (await (await next.caches.open(name)).match('./voice-marker')).text(),'saved '+name);
  assert.equal(await (await (await next.caches.open('algebra8-ai-runtime-v1')).match('./model-marker')).text(),'model');
  assert.equal(await (await (await next.caches.open('kitsune-generated-voice-v06-test')).match('./generated-marker')).text(),'generated');
});
test('Откат с уникальным именем кэша восстанавливает оболочку без удаления WAV',async()=>{
  const current=harness();await current.run('install');await current.run('activate');
  await (await current.caches.open('kitsune-voice-pack-pilot-v04')).put('./approved',new Response('approved'));
  const script=source.replace(/const CACHE="[^"]+"/,'const CACHE="kitsune-math-rollback-v04.1"')
    .replace(/const RUNTIME_CACHE="[^"]+"/,'const RUNTIME_CACHE="kitsune-math-runtime-rollback-v04.1"');
  const rollback=harness({script,stores:current.stores,shell:'rollback shell'});await rollback.run('install');
  assert.equal(await (await current.fetchRequest('./',{navigate:true})).text(),'current shell');
  await rollback.run('activate');rollback.setOffline(true);
  assert.equal(await (await rollback.fetchRequest('./',{navigate:true})).text(),'rollback shell');
  assert(current.stores.has('kitsune-voice-pack-pilot-v04'));assert(!current.stores.has(source.match(/const CACHE="([^"]+)"/)[1]));
});
test('WAV обрабатывает отдельный проверяемый кэш, очистка runtime его не затрагивает',async()=>{
  const h=harness();await h.run('install');const before=h.requests();
  assert.equal(await h.fetchRequest('./assets/voice/pilot_v04/clips/fractions_001_ea346eb9d899.wav'),undefined);
  assert.equal(h.requests(),before);
  const runtime=source.match(/const RUNTIME_CACHE="([^"]+)"/)[1];
  await h.caches.open('kitsune-voice-pack-pilot-v04');await h.caches.open(runtime);
  await h.run('message',{data:{type:'TRIM_RUNTIME'}});assert(h.stores.has('kitsune-voice-pack-pilot-v04'));
  assert(!h.stores.has(runtime));
});

test('Отчёт источников не застывает в кэше оболочки и получает сетевой ответ отдельно',async()=>{
  const h=harness();await h.run('install');const before=h.requests();
  assert.equal(await h.fetchRequest('./curriculum-status.json?report=1'),undefined);
  assert.equal(await h.fetchRequest('./curriculum-status.json?report=2'),undefined);
  assert.equal(h.requests(),before);
});

test('Настоящая оболочка GitHub RC5 остаётся до принятия RC6; готовый Piper сохраняется',async()=>{
  const legacySource=fs.readFileSync(path.join(__dirname,'fixtures/sw-github-rc5-30d1df3.txt'),'utf8');
  const oldName=legacySource.match(/const CACHE="([^"]+)"/)[1];
  assert.equal(oldName,'kitsune-math-3.1.0-rc.5-living.1');
  const old=harness({script:legacySource});
  await (await old.caches.open(oldName)).put('./index.html?v=3.1.0-rc.5',new Response('installed GitHub RC5'));
  const saved=['kitsune-voice-pack-pilot-v04','kitsune-piper-index-v07','kitsune-piper-voice-v07-existing','kitsune-generated-piper-v07-existing'];
  for(const name of saved)await (await old.caches.open(name)).put('./marker',new Response('saved '+name));
  old.setOffline(true);
  const next=harness({stores:old.stores});await next.run('install');
  assert.equal(next.skipped(),false);assert.equal(await (await old.fetchRequest('./',{navigate:true})).text(),'installed GitHub RC5');
  await next.run('message',{data:{type:'SKIP_WAITING'}});await next.run('activate');next.setOffline(true);
  assert.equal(await (await next.fetchRequest('./',{navigate:true})).text(),'current shell');assert(!next.stores.has(oldName));
  for(const name of saved)assert.equal(await (await (await next.caches.open(name)).match('./marker')).text(),'saved '+name);
});
