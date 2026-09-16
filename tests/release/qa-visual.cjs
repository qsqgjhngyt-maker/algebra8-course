const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const {chromium,devices}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(process.env.KITSUNE_QA_ROOT||path.join(__dirname,'../..')),results=[];
const s=http.createServer((req,res)=>{const p=path.join(root,new URL(req.url,'http://localhost').pathname.replace(/^\//,'')||'index.html');try{res.setHeader('Content-Type',p.endsWith('.js')?'text/javascript':p.endsWith('.css')?'text/css':p.endsWith('.html')?'text/html':'application/octet-stream');res.end(fs.readFileSync(p))}catch{res.writeHead(404).end()}});
(async()=>{await new Promise(r=>s.listen(0,'127.0.0.1',r));const b=await chromium.launch({executablePath:process.env.CHROME_PATH||undefined,headless:true});try{
for(const mode of ['desktop','mobile']){const c=await b.newContext(mode==='mobile'?{...devices['iPhone 13'],deviceScaleFactor:1}:{viewport:{width:1365,height:900}});const p=await c.newPage();await p.goto(`http://127.0.0.1:${s.address().port}`);
await p.addLocatorHandler(p.locator('#v1111Privacy.show'),()=>p.locator('#v1111PrivacyOk').click());await p.addLocatorHandler(p.locator('#v15Scrim[aria-hidden="false"]'),()=>p.locator('#v15CloseBtn').click());await p.addLocatorHandler(p.locator('#ksetup.show'),()=>p.locator('#ksetupHide').click());
await p.locator('[data-platform-track="grade8"]').click();await p.locator('#v3HomeContinue').waitFor();if(mode==='mobile')await p.locator('#v3HomeContinue').click();
await p.waitForTimeout(1600);await p.evaluate(()=>{document.querySelector('#v15CloseBtn')?.click();window.scrollTo({top:0,behavior:'instant'});const tip=document.querySelector('#v15TipChip');tip.textContent='Я знаю эту тему';tip.classList.add('show')});await p.waitForTimeout(250);await p.screenshot({path:path.join(__dirname,`${mode}-settled.png`)});
assert(await p.locator('#v15TipChip').evaluate(e=>{const r=e.getBoundingClientRect();return r.width>80&&r.left>=0&&r.right<=innerWidth}));
assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
assert.equal(await p.evaluate(()=>KitsuneSchoolNotation.text('Важно: не дели на ноль')), 'Важно: не дели на ноль');assert.equal(await p.evaluate(()=>KitsuneSchoolNotation.text('12:3')), '12 : 3');assert.equal(await p.evaluate(()=>KitsuneSchoolNotation.speech('Важно: 12:3')), 'Важно: 12 разделить на 3');
results.push({name:mode+' settled visual and prose punctuation',status:'PASS'});console.log('PASS',mode);await c.close();}
fs.writeFileSync(path.join(__dirname,'visual-results.json'),JSON.stringify(results,null,2));}finally{await b.close();s.close()}})().catch(e=>{console.error(e);process.exitCode=1;s.close()});
