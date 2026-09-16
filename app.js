const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');let browser;const results=[];
const server=http.createServer((q,s)=>{s.setHeader('Content-Type','text/html');s.end('<html><body><div id="v19Dialog" class="show"><button class="v19-mic-btn">Говорить</button><input id="v19DialogInput"><div id="v19DialogLive"></div></div></body></html>')});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));browser=await chromium.launch({executablePath:process.env.CHROME_PATH||undefined,headless:true});for(const device of ['desktop','iphone']){
 const page=await browser.newPage(device==='iphone'?{userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1'}:{});page.setDefaultTimeout(5000);await page.goto(`http://127.0.0.1:${server.address().port}`);
 await page.evaluate(()=>{
  window.fake={workers:[],pendingMics:[],tracks:[],sent:[],loadAuto:false};
  window.KitsuneVoiceDialogue={start:()=>false,stop:()=>false,release:async()=>true,status:()=>({}),send:async text=>fake.sent.push(text)};
  window.KitsuneLiveConversation={release:async()=>true};
  window.Worker=class {constructor(){fake.workers.push(this)}postMessage(m){if(m.type==='load'){this.model=m.model;if(fake.loadAuto)setTimeout(()=>this.ready(),5)}if(m.type==='transcribe')this.transcribeId=m.id;}ready(){this.onmessage?.({data:{type:'ready',model:'whisper-'+this.model}})}terminate(){this.dead=true}};
  Object.defineProperty(navigator,'mediaDevices',{value:{getUserMedia:()=>new Promise(r=>fake.pendingMics.push(()=>{const t={stopped:false,stop(){this.stopped=true}};fake.tracks.push(t);r({getTracks:()=>[t]})}))},configurable:true});
  window.AudioContext=class{constructor(){this.state='running';this.sampleRate=16000;this.destination={}}createMediaStreamSource(){return {connect(){},disconnect(){}}}createScriptProcessor(){return fake.processor={connect(){},disconnect(){}}}createGain(){return {gain:{value:0},connect(){},disconnect(){}}}close(){return Promise.resolve()}};
 });
 await page.addScriptTag({content:fs.readFileSync(path.join(process.env.KITSUNE_QA_ROOT||path.resolve(__dirname,'../..'),'voice-stability-v2387.js'),'utf8')});
 // Cancel while the model is pending, then immediately restart. The cancelled Base load must not fall back to Tiny.
 await page.evaluate(()=>{fake.first=KitsuneUnifiedVoice.start()});await page.waitForFunction(()=>fake.workers.length===1);await page.evaluate(()=>KitsuneUnifiedVoice.stop());await page.waitForTimeout(250);assert.equal(await page.evaluate(()=>fake.workers.length),1);
 await page.evaluate(()=>{fake.loadAuto=true;fake.second=KitsuneUnifiedVoice.start()});await page.waitForFunction(()=>fake.pendingMics.length===1);
 // Close/cancel before the permission promise resolves: the late stream must be closed.
 await page.evaluate(()=>{KitsuneUnifiedVoice.stop();fake.pendingMics.shift()()});await page.waitForTimeout(30);assert(await page.evaluate(()=>fake.tracks[0].stopped));assert(!(await page.evaluate(()=>KitsuneUnifiedVoice.status().recording)));
 await page.evaluate(()=>{fake.third=KitsuneUnifiedVoice.start()});await page.waitForFunction(()=>fake.pendingMics.length===1);await page.evaluate(()=>fake.pendingMics.shift()());await page.waitForFunction(()=>KitsuneUnifiedVoice.status().recording);
 // A normal mic stop submits captured speech. Cancelling pending transcription discards the late result.
 await page.evaluate(()=>{for(let i=0;i<8;i++)fake.processor.onaudioprocess({inputBuffer:{getChannelData:()=>new Float32Array(2048).fill(.2)}})});await page.locator('.v19-mic-btn').click();await page.waitForFunction(()=>fake.workers.some(w=>w.transcribeId));
 await page.evaluate(()=>{const w=fake.workers.find(w=>w.transcribeId);KitsuneUnifiedVoice.stop();w.onmessage({data:{type:'result',id:w.transcribeId,text:'Как решить квадратное уравнение'}})});await page.waitForTimeout(300);assert.deepEqual(await page.evaluate(()=>fake.sent),[]);
 assert(await page.evaluate(()=>fake.tracks.every(t=>t.stopped)));assert(!(await page.evaluate(()=>KitsuneUnifiedVoice.status().sessionBusy)));
 console.log('PASS',device,'cancel during model load / mic permission / transcription, restart, stream cleanup');results.push({device,status:'PASS',mode:'mocked microphone and ASR worker; real voice controller'});await page.close();
 }} )().catch(e=>{console.error(e);results.push({status:'FAIL',error:e.message});process.exitCode=1}).finally(async()=>{await browser?.close();server.close();fs.writeFileSync(path.join(__dirname,'voice-results.json'),JSON.stringify(results,null,2))});
