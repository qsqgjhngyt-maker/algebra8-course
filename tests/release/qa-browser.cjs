const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const {chromium,devices}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(process.env.KITSUNE_QA_ROOT||path.join(__dirname,'../..')),results=[],errors=[];
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.wasm':'application/wasm'};
let update=false,broken=false;
const server=http.createServer((req,res)=>{const u=new URL(req.url,'http://localhost');let p=path.resolve(root,'.'+decodeURIComponent(u.pathname));if(!p.startsWith(root+path.sep)&&p!==root){res.writeHead(403).end();return;}if(p===root||u.pathname.endsWith('/'))p=path.join(p,'index.html');if(!fs.existsSync(p)||!fs.statSync(p).isFile()||(broken&&p.endsWith('platform-v300.js'))){res.writeHead(404).end();return;}res.setHeader('Content-Type',mime[path.extname(p)]||'application/octet-stream');res.setHeader('Cache-Control','no-store');let data=fs.readFileSync(p);if(update&&/\.(html|js|json)$/.test(p))data=Buffer.from(data.toString().replaceAll('3.1.0-rc.2','3.1.0-rc.2-qa-update'));res.end(data);});
const test=async(name,fn)=>{if(process.env.QA_PWA_ONLY&&!/PWA|Offline/.test(name))return;try{await fn();results.push({name,status:'PASS'});console.log('PASS',name)}catch(e){results.push({name,status:'FAIL',error:e.message});console.log('FAIL',name,e.message.slice(0,500))}};
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||undefined,headless:true});
 try{
 const context=await browser.newContext({viewport:{width:1365,height:900}}),page=await context.newPage();page.setDefaultTimeout(7000);page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base);await page.locator('[data-platform-track]').first().waitFor();
 await page.addLocatorHandler(page.locator('#v1111Privacy.show'),async()=>{await page.locator('#v1111PrivacyOk').click()});
 await page.addLocatorHandler(page.locator('#v15Scrim[aria-hidden="false"]'),async()=>{await page.locator('#v15CloseBtn').click()});
 await page.addLocatorHandler(page.locator('#ksetup.show'),async()=>{await page.locator('#ksetupHide').click()});
 await test('First run library and 8 tracks',async()=>{assert.equal(await page.locator('[data-platform-track]').count(),8);assert.equal(await page.evaluate(()=>localStorage.getItem('kitsune_math_track_v300')),null)});
 const tracks=await page.evaluate(()=>KitsuneCurriculum.tracks.map(t=>({id:t.id,count:t.sections.flatMap(s=>s.chapters.flatMap(c=>c.topics)).length})));
 for(const track of tracks){
 await test(`${track.id}: library → home → chapter → lesson → back + persistence`,async()=>{
   await page.evaluate(()=>KitsunePlatform.showChooser());await page.locator(`[data-platform-track="${track.id}"]`).click();await page.locator('#v3HomeContinue').waitFor();assert.match(await page.locator('#pageTitle').innerText(),/главная курса/);
   await page.reload();await page.locator('#v3HomeContinue').waitFor();assert.equal(await page.evaluate(()=>KitsunePlatform.selected()),track.id);
   await page.locator('[data-v3-home-map]').first().click();await page.locator('#chapterBack').waitFor();await page.locator('.platform-topic').first().click();await page.locator('#v3FinishLesson').waitFor();
   assert.equal(await page.locator('.v3-calm-theory').count(),1);await page.locator('[data-v3-level="deep"]').click();assert.equal(await page.locator('.v3-deep-dive').getAttribute('aria-hidden'),'false');await page.locator('[data-v3-level="simple"]').click();assert.equal(await page.locator('.v3-deep-dive').getAttribute('aria-hidden'),'true');
   await page.locator('#lessonChapterBack').click();await page.locator('#chapterBack').click();assert.equal(await page.locator('.platform-topic').count(),track.count);
   await page.locator('.platform-topic').first().click();await page.locator('#platformTopicBack').click();assert.equal(await page.locator('.platform-topic').count(),track.count);
 });
 }
 await test('Progress isolation, empty answer and mistakes → practice',async()=>{
   await page.evaluate(()=>KitsunePlatform.selectTrack('grade7'));await page.locator('#v3HomeContinue').click();
   const data=await page.evaluate(()=>{const t=KitsuneCurriculum.tracks[0].sections[0].chapters[0].topics[0];return {id:t.id,a:KitsuneTheoryContent['grade7:'+t.id].exercises[0].a[0]}});
   const bridge=`v3-grade7-${data.id}`,check=page.locator('[data-v3-check="0"]');
   await check.click();assert.match(await page.locator(`[id="fb-${bridge}-0"]`).innerText(),/Сначала/);
   assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('kitsune:v3:progress:grade7')||'{}').attempts||0),0);
   await page.locator(`[id="ans-${bridge}-0"]`).fill('wrong');await check.click();await page.locator(`[id="ans-${bridge}-0"]`).fill(String(data.a));await check.click();
   assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('kitsune:v3:progress:grade7')).correct),1);
   assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('kitsune:v3:progress:grade8')).correct),0);
   for(const view of ['trainer','chapterfinal','mastery','mistakes','route','progress']){await page.locator(`.main-nav [data-view="${view}"]`).click();assert(!/будет расширяться/.test(await page.locator('#content').innerText()));}
   await page.locator('.main-nav [data-view="trainer"]').click();await page.locator('#studyPractice').click();assert((await page.locator('[data-v3-check]').count())>0);
 });
 await test('Math Lab: all course topics, answer check, homework isolation, classic 51',async()=>{
   for(const t of tracks){await page.evaluate(id=>KitsunePlatform.selectTrack(id),t.id);await page.locator('.main-nav [data-view="mathlab"]').click();await page.locator('[data-ml-tab="trainer"]').click();assert.equal(await page.locator('#mlGenTopicId option').count(),t.count);}
   await page.locator('#mlGenerateBtn').click();await page.locator('[data-gen-card]').first().waitFor();await page.locator('[data-gen-action="homework"]').first().click();
   assert((await page.evaluate(()=>KitsuneMathLab.homework())).length>0);
   await page.evaluate(()=>KitsunePlatform.selectTrack('grade7'));await page.locator('.main-nav [data-view="mathlab"]').click();assert.equal((await page.evaluate(()=>KitsuneMathLab.homework())).length,0);
   await page.locator('[data-ml-tab="trainer"]').click();await page.locator('#mlGenerateBtn').click();await page.locator('[data-gen-action="homework"]').first().click();
   const hw=await page.evaluate(()=>KitsuneMathLab.homework());await page.locator('[data-ml-tab="homework"]').click();await page.locator('.ml-hw-work').first().fill(hw[0].generated.answer);await page.locator('[data-hw-action="steps"]').first().click();await page.locator('.ml-hw-result .ml-success').waitFor();
   await page.evaluate(()=>KitsunePlatform.selectTrack('grade8'));await page.locator('.main-nav [data-view="mathlab"]').click();await page.locator('[data-ml-tab="trainer"]').click();await page.locator('#mlClassicToggle').click();assert.equal(await page.locator('#mlGenTopicId option').count(),51);await page.locator('#mlGenerateBtn').click();await page.locator('[data-gen-card]').first().waitFor();
 });
 await test('All nine exam variants and school cross-links resolve',async()=>{
   const exams=await page.evaluate(()=>Object.entries(KitsuneTheoryContent).filter(([,d])=>d.exam?.variantSize).map(([key,d])=>({key,size:d.exam.variantSize,manual:d.exercises.filter(e=>e.manual).length})));
   assert.equal(exams.length,9);
   for(const e of exams){await page.evaluate(key=>{const [id,topic]=key.split(':');const tr=KitsuneCurriculum.tracks.find(t=>t.id===id);for(const s of tr.sections)for(const c of s.chapters)if(c.topics.some(t=>t.id===topic))KitsunePlatform.renderTopic(id,s.id,c.id,topic)},e.key);assert.equal(await page.locator('.v3-course-exercise[data-ex]').count(),e.size);assert.equal(await page.locator('[data-v3-manual-review]').count(),e.manual);if(e.key.startsWith('ege-basic'))assert.match(await page.locator('.v3-exam-variant-meta').innerText(),/часть 2: 0/);}
   const broken=await page.evaluate(()=>Object.values(KitsuneTheoryContent).flatMap(d=>d.exam?.schoolLinks||[]).filter(l=>!KitsuneTheoryContent[`${l.trackId}:${l.topicId}`]));assert.equal(broken.length,0);
 });
 await test('Textbook fractions and prose protection',async()=>{
   await page.evaluate(()=>{const host=document.createElement('div');host.id='qaNotation';host.textContent='7/8 − 5/6 = x². ОГЭ/ЕГЭ AI/Voice по-прежнему 3.1.0-rc.2';document.querySelector('#content').append(host);KitsuneSchoolTypography.apply(host)});
   assert.equal(await page.locator('#qaNotation .school-frac').count(),2);assert.match(await page.locator('#qaNotation').innerText(),/ОГЭ\/ЕГЭ AI\/Voice по-прежнему 3.1.0-rc.2/);
 });
 await test('Tutor context follows course and exercise',async()=>{
   for(const id of ['grade7','grade8','ege-basic']){
     await page.evaluate(id=>KitsunePlatform.selectTrack(id),id);await page.locator('#v3HomeContinue').click();
     const ctx=await page.evaluate(()=>{const c=v16ParseExercise(document.querySelector('.exercise[data-ex]'));return {id:c.lessonId,question:c.exercise.q,title:c.lesson.title}});
     assert(ctx.id.startsWith('v3-'+id+'-'));assert(ctx.question&&ctx.title);
     await page.locator('.exercise[data-ex] .v16-tutor-btn').first().click();await page.locator('.v173-inline-tutor.show').first().waitFor();
   }
 });
 await test('Reset only selected course; grade7 and legacy grade8 stay intact',async()=>{
   const before=await page.evaluate(()=>({g7:localStorage.getItem('kitsune:v3:progress:grade7'),g8:localStorage.getItem('kitsune:v3:progress:grade8')}));
   await page.evaluate(()=>{localStorage.setItem('kitsune:v3:progress:grade9',JSON.stringify({attempts:7,correct:3,solved:{},completed:[],mistakes:[]}));KitsunePlatform.selectTrack('grade9')});
   page.once('dialog',d=>d.accept());await page.evaluate(()=>document.querySelector('#resetBtn').click());await page.waitForLoadState();await page.locator('#v3HomeContinue').waitFor();
   const after=await page.evaluate(()=>({g7:localStorage.getItem('kitsune:v3:progress:grade7'),g8:localStorage.getItem('kitsune:v3:progress:grade8'),g9:localStorage.getItem('kitsune:v3:progress:grade9')}));assert.equal(after.g7,before.g7);assert.equal(after.g8,before.g8);assert.equal(after.g9,null);
 });
 await page.evaluate(()=>KitsunePlatform.selectTrack('grade8'));await page.screenshot({path:path.join(__dirname,'desktop-home.png')});
 await test('Offline first use: library, all lessons and Math Lab',async()=>{
   await page.waitForFunction(()=>navigator.serviceWorker.controller);await page.evaluate(()=>navigator.serviceWorker.ready);await context.setOffline(true);await page.reload();await page.locator('#v3HomeContinue').waitFor();
   const n=await page.evaluate(()=>Object.keys(KitsuneTheoryContent).length);assert(n>=551);
   await page.locator('.main-nav [data-view="mathlab"]').click();await page.locator('[data-ml-tab="trainer"]').click();await page.locator('#mlGenerateBtn').click();await page.locator('[data-gen-card]').first().waitFor();
   assert.equal(await page.evaluate(async()=>{KitsuneMath.terminate();return (await KitsuneMath.generatorCatalog()).length}),51);
   const cache=await page.evaluate(async()=>{await KitsuneRuntimeLoader.ensure('offline');return (await KitsuneOffline.status()).cache});assert.equal(cache.release,'kitsune-math-3.1.0-rc.2');assert(cache.shell);await context.setOffline(false);
 });
 await context.setOffline(false);
 await test('PWA update: failed install keeps current worker; successful waiting → apply preserves progress',async()=>{
   const before=await page.evaluate(()=>localStorage.getItem('kitsune:v3:progress:grade7'));update=true;broken=true;
   await page.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration();await r.update()});await page.waitForFunction(async()=>!(await navigator.serviceWorker.getRegistration()).installing,null,{timeout:20000});console.log('PWA failed installation settled');
   assert.equal(await page.evaluate(async()=>!!(await navigator.serviceWorker.getRegistration()).waiting),false);
   broken=false;await page.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration();await r.update()});await page.waitForFunction(async()=>!!(await navigator.serviceWorker.getRegistration()).waiting,null,{timeout:20000});console.log('PWA waiting worker ready');
   await page.evaluate(()=>KitsunePWAUpdate.check());
   await page.waitForFunction(()=>!!KitsunePWAUpdate.registration?.waiting&&document.querySelector('#updateBtn').dataset.updateState==='available',null,{timeout:20000});
   await page.locator('#pwaUpdateNow').click();await page.waitForFunction(()=>document.querySelector('meta[name="kitsune-app-version"]').content.includes('qa-update'),null,{timeout:20000});console.log('PWA activated and reloaded');
   assert.equal(await page.evaluate(()=>localStorage.getItem('kitsune:v3:progress:grade7')),before);
   assert(!(await page.evaluate(()=>caches.keys())).includes('kitsune-math-3.1.0-rc.2'));update=false;
 });
 await context.close();
 const mobile=await browser.newContext({...devices['iPhone 13'],defaultBrowserType:undefined}),mp=await mobile.newPage();mp.setDefaultTimeout(7000);mp.on('pageerror',e=>errors.push('mobile: '+e.message));const heavy=[];mp.on('request',r=>{if(/huggingface|transformers|onnxruntime|whisper-worker|piper.*wasm/i.test(r.url()))heavy.push(r.url())});
 await test('iPhone-sized low-memory startup, sidebar scroll/close and no AI preload',async()=>{
   await mp.goto(base);await mp.locator('[data-platform-track]').first().waitFor();await mp.waitForTimeout(2200);assert.deepEqual(heavy,[]);
   await mp.locator('[data-platform-track="grade8"]').click();await mp.locator('#v3HomeContinue').waitFor();
   const button=mp.locator('#menuBtn');await button.click();await mp.waitForTimeout(250);assert(await mp.locator('#sidebar').evaluate(e=>e.classList.contains('open')));
   const scroll=await mp.locator('#sidebar').evaluate(e=>({height:e.clientHeight,total:e.scrollHeight,overflow:getComputedStyle(e).overflowY}));assert(scroll.total>=scroll.height);assert(['auto','scroll'].includes(scroll.overflow));
   await mp.locator('#platformCourseBtn').click();assert(!(await mp.locator('#sidebar').evaluate(e=>e.classList.contains('open'))));
   await mp.locator('[data-platform-track="grade8"]').click();await mp.locator('#v3HomeContinue').click();assert(await mp.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));await mp.screenshot({path:path.join(__dirname,'mobile-lesson.png')});
 });await mobile.close();
 await test('No uncaught browser errors',async()=>assert.deepEqual(errors,[]));
 }finally{await browser.close();server.close();fs.writeFileSync(path.join(__dirname,'browser-results.json'),JSON.stringify({results,errors},null,2));}
 if(results.some(r=>r.status==='FAIL'))process.exitCode=1;
})().catch(e=>{console.error(e);server.close();process.exitCode=1});
