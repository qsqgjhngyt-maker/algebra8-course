// Проверка реальной PWA в отдельном браузерном профиле, без данных пользователя.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium,devices}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(process.env.KITSUNE_QA_ROOT||path.join(__dirname,'../..'));
const previous=process.env.KITSUNE_PREVIOUS_ROOT&&path.resolve(process.env.KITSUNE_PREVIOUS_ROOT);
const prefix='/algebra8-course/',results=[],errors=[];
const expectedCache=fs.readFileSync(path.join(root,'sw.js'),'utf8').match(/const CACHE="([^"]+)"/)[1];
const expectedBuild=JSON.parse(fs.readFileSync(path.join(root,'version.json'),'utf8')).build_revision;
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp','.mp4':'video/mp4','.wav':'audio/wav'};
let stage='current',browser;
const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(!url.pathname.startsWith(prefix))return res.writeHead(404).end();
  const base=['old','rollback'].includes(stage)?previous:root;
  const file=path.resolve(base,url.pathname.slice(prefix.length)||'index.html');
  if(!file.startsWith(base+path.sep))return res.writeHead(403).end();
  if(stage==='broken'&&file.endsWith('math-engine-v130.js'))return res.writeHead(503).end();
  try{
    let bytes=fs.readFileSync(file);
    if(stage==='rollback'&&file.endsWith('sw.js')){
      bytes=Buffer.from(bytes.toString().replace(/const CACHE="[^"]+"/,'const CACHE="kitsune-math-rollback-v04.1"').replace(/const RUNTIME_CACHE="[^"]+"/,'const RUNTIME_CACHE="kitsune-math-runtime-rollback-v04.1"'));
    }
    res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(bytes);
  }catch{res.writeHead(404).end();}
});
const check=async(name,fn)=>{await fn();results.push({name,status:'PASS'});console.log('PASS',name);};
async function init(context){
  await context.addInitScript(()=>{
    localStorage.setItem('kitsune:intro:mode','off');
    localStorage.setItem('a8_assistant_greeting','1');
    localStorage.setItem('a8_zero_config_enabled_v210','0');
    const active=new Set();window.qaAudio={started:0,maximum:0,active};
    const proto=AudioBufferSourceNode.prototype,start=proto.start,stop=proto.stop;
    proto.start=function(...args){active.add(this);qaAudio.started++;qaAudio.maximum=Math.max(qaAudio.maximum,active.size);this.addEventListener('ended',()=>active.delete(this),{once:true});return start.apply(this,args);};
    proto.stop=function(...args){active.delete(this);return stop.apply(this,args);};
  });
}
async function ready(page){
  await page.goto(`http://127.0.0.1:${server.address().port}${prefix}`);
  await page.locator('[data-platform-track="grade8"]').waitFor();
  await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
  await page.evaluate(()=>document.querySelector('.kitsune-startup-intro__skip')?.click());
  await page.evaluate(()=>document.querySelector('#v1111PrivacyOk')?.click());
}
async function playButton(page,index=0){
  await page.evaluate(index=>{
    let button=document.querySelector('#qaWavPlay');
    if(!button){button=document.createElement('button');button.id='qaWavPlay';button.textContent='Проверить WAV';document.body.prepend(button);}
    button.onclick=()=>v151Speak(KITSUNE_STATIC_PACK_V04.segments[index].text,{force:true,state:'explain'});
    button.style.cssText='position:fixed;top:0;left:0;z-index:200000';
  },index);
  await page.locator('#qaWavPlay').click();
  await page.waitForFunction(()=>qaAudio.active.size===1);
}
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||undefined});
  const context=await browser.newContext({viewport:{width:1365,height:900}});await init(context);
  const page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));
  await ready(page);
  await check('Settings: single WAV, no automatic preview or interruption',async()=>{
    await page.evaluate(async()=>{await KitsuneStaticVoice.download();KitsuneStaticVoice.enable(true);v151SetAutoVoice(true);v15Open();});
    await playButton(page);
    const count=await page.evaluate(()=>qaAudio.started);
    await page.locator('#v15SettingsBtn').click();
    await page.evaluate(()=>v151AutoSpeak(KITSUNE_STATIC_PACK_V04.segments[1].text,'explain'));
    assert.equal(await page.locator('#v161Energy').count(),0);
    assert.equal(await page.locator('#v151VoiceSelect').count(),0);
    assert.equal(await page.evaluate(()=>qaAudio.started),count);
    assert.equal(await page.evaluate(()=>qaAudio.active.size),1);
    await playButton(page,1);assert.equal(await page.evaluate(()=>qaAudio.maximum),1);
    await page.locator('#v151AutoVoice').uncheck();await page.waitForFunction(()=>qaAudio.active.size===0);
    assert.equal(await page.evaluate(()=>localStorage.getItem('a8_alfi_voice_auto')),'0');
  });
  await check('Offline: reload, complete WAV pack and math worker under Pages subpath',async()=>{
    await context.setOffline(true);await page.reload();await page.locator('[data-platform-track="grade8"]').waitFor();
    await page.evaluate(()=>document.querySelector('.kitsune-startup-intro__skip')?.click());
    assert.equal(await page.evaluate(()=>localStorage.getItem('a8_alfi_voice_auto')),'0');
    await page.evaluate(()=>v151VoiceEnabled=true);await playButton(page);
    assert.equal(await page.evaluate(()=>qaAudio.maximum),1);
    await page.evaluate(()=>v161StopSpeech());
    assert.equal(await page.evaluate(async()=>{KitsuneMath.terminate();return (await KitsuneMath.generatorCatalog()).length;}),51);
    const assets=await page.evaluate(async()=>{const c=await caches.open('kitsune-voice-pack-pilot-v04');return (await c.keys()).length;});assert.equal(assets,5);
    await context.setOffline(false);
  });await context.close();
  const mobile=await browser.newContext({...devices['iPhone 13'],defaultBrowserType:undefined});await init(mobile);
  const mp=await mobile.newPage();mp.on('pageerror',e=>errors.push(e.message));
  await check('Mobile viewport: auto toggle available and preference survives reload',async()=>{
    await ready(mp);await mp.evaluate(()=>v15Open());
    await mp.locator('#v151AutoVoiceToggle').click();assert.equal(await mp.locator('#v151AutoVoiceToggle').getAttribute('aria-pressed'),'true');
    await mp.reload();await mp.locator('[data-platform-track="grade8"]').waitFor();await mp.evaluate(()=>{document.querySelector('.kitsune-startup-intro__skip')?.click();v15Open();});
    assert.equal(await mp.locator('#v151AutoVoiceToggle').getAttribute('aria-pressed'),'true');
    assert.equal(await mp.locator('#v151AutoVoice').isDisabled(),false);
    await mp.locator('#v151AutoVoiceToggle').click();assert.equal(await mp.locator('#v151AutoVoiceToggle').getAttribute('aria-pressed'),'false');
  });await mobile.close();
  if(previous){
    stage='old';const upgrade=await browser.newContext();await init(upgrade);const up=await upgrade.newPage();up.on('pageerror',e=>errors.push(e.message));await ready(up);
    await up.evaluate(async()=>{localStorage.setItem('a8_completed','["1-1"]');localStorage.setItem('a8_alfi_voice_auto','1');await (await caches.open('algebra8-ai-runtime-v1')).put('./qa-model-marker',new Response('keep'));});
    await check('Failed PWA install keeps previous worker and pupil settings',async()=>{
      stage='broken';await up.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration();await r.update();});
      await up.waitForFunction(async()=>!(await navigator.serviceWorker.getRegistration()).installing);
      assert.equal(await up.evaluate(async()=>!!(await navigator.serviceWorker.getRegistration()).waiting),false);
      assert.equal(await up.evaluate(()=>localStorage.getItem('a8_completed')),'["1-1"]');
    });
    await check('PWA update waits for acceptance and preserves progress/settings/models',async()=>{
      stage='current';await up.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration();await r.update();});
      await up.waitForFunction(async()=>!!(await navigator.serviceWorker.getRegistration()).waiting);
      assert.equal(await up.evaluate(()=>typeof KitsuneStaticVoice),'undefined');
      await up.evaluate(()=>KitsunePWAUpdate.apply());
      await up.waitForFunction(build=>document.querySelector('meta[name="kitsune-app-build"]')?.content===build,expectedBuild);
      assert.equal(await up.evaluate(()=>localStorage.getItem('a8_completed')),'["1-1"]');
      assert.equal(await up.evaluate(()=>localStorage.getItem('a8_alfi_voice_auto')),'1');
      assert((await up.evaluate(()=>caches.keys())).includes(expectedCache));
      await up.evaluate(()=>KitsuneStaticVoice.download());
    });
    await check('Rollback with fresh worker cache preserves approved WAV and pupil data',async()=>{
      stage='rollback';await up.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration();await r.update();});
      await up.waitForFunction(async()=>!!(await navigator.serviceWorker.getRegistration()).waiting);
      await up.evaluate(()=>KitsunePWAUpdate.apply());
      await up.waitForFunction(async()=>typeof KitsuneStaticVoice==='undefined'&&(await caches.keys()).includes('kitsune-math-rollback-v04.1'));
      assert.equal(await up.evaluate(()=>localStorage.getItem('a8_completed')),'["1-1"]');
      assert.equal(await up.evaluate(()=>localStorage.getItem('a8_alfi_voice_auto')),'1');
      assert.equal(await up.evaluate(async()=>((await caches.open('kitsune-voice-pack-pilot-v04')).keys()).then(k=>k.length)),5);
      assert.equal(await up.evaluate(async()=>{const c=await caches.open('algebra8-ai-runtime-v1');return (await c.match('./qa-model-marker')).text();}),'keep');
    });await upgrade.close();
  }
  await check('No uncaught browser errors',async()=>assert.deepEqual(errors,[]));
})().catch(error=>{results.push({name:'Browser run',status:'FAIL',error:error.message});console.error(error);process.exitCode=1;})
  .finally(async()=>{await browser?.close();server.close();fs.writeFileSync(path.join(__dirname,'voice-pwa-results.json'),JSON.stringify({results,errors,previous:!!previous,real_mobile_device:false},null,2));});
