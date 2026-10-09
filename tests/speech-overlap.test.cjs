const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
const section=(file,a,b)=>{const s=read(file),i=s.indexOf(a),j=s.indexOf(b,i+1);assert(i>=0&&j>i);return s.slice(i,j);};
function autoHarness(){
 const timers=new Map(),spoken=[];let id=0,settings=false,open=false;
 const box={v151VoiceAuto:true,v151VoiceEnabled:true,v151SpeechUnlocked:true,v15Mode:'active',v151AutoSpeechTimer:null,
  v151Speaking:false,v161SpeechTimer:null,AlfiNeuralVoice:{isBusy:()=>false},speechSynthesis:{},
  document:{querySelector:s=>({classList:{contains:()=>s==='#v15Assistant'?open:settings}})},
  setTimeout:fn=>{timers.set(++id,fn);return id;},clearTimeout:id=>timers.delete(id),v151Speak:text=>spoken.push(text)};
 box.window=box;vm.createContext(box);
 vm.runInContext(section('live-assistant-v15.js','function v151IsSpeechBusy(','function v151Speak('),box);
 vm.runInContext(section('live-assistant-v15.js','function v151AutoSpeak(','function v151UpdateVoiceUi('),box);
 return {box,timers,spoken,settings:value=>{settings=value;open=value;},hideMenu:()=>{open=false;}};
}
test('Автосовет пропускается во время чтения и при открытых настройках',()=>{
 const h=autoHarness();h.box.v151Speaking=true;h.box.v151AutoSpeak('повтор','explain');assert.equal(h.timers.size,0);
 h.box.v151Speaking=false;h.settings(true);h.box.v151AutoSpeak('повтор','explain');assert.equal(h.timers.size,0);
 h.settings(false);h.box.v151AutoSpeak('ожидающий','explain');h.box.v151Speaking=true;
 [...h.timers.values()][0]();assert.equal(h.spoken.length,0);
});
test('Базовая фраза не вклинивается при подготовке WAV и на паузе чтения',()=>{
 const h=autoHarness();h.box.KitsuneStaticVoice={isBusy:()=>true};
 h.box.v151AutoSpeak('базовая фраза','wave');assert.equal(h.timers.size,0);
 h.box.KitsuneStaticVoice.isBusy=()=>false;h.box.KitsuneReading={isBusy:()=>true};
 h.box.v151AutoSpeak('базовая фраза','wave');assert.equal(h.timers.size,0);
 h.box.KitsuneReading.isBusy=()=>false;h.box.v151AutoSpeak('совет','wave');
 h.box.KitsuneReading.isBusy=()=>true;[...h.timers.values()][0]();assert.equal(h.spoken.length,0);
});
test('Привычная кнопка помощника продолжает чтение с паузы вместо новой базовой фразы',()=>{
 let resumes=0;const box={v151SpeechUnlocked:false,KitsuneReading:{snapshot:()=>({phase:'paused'}),resume:()=>resumes++},
  v151IsSpeechBusy:()=>true,v161StopSpeech:()=>assert.fail('Пауза должна продолжиться'),v151Speak:()=>assert.fail('Не запускаем базовую фразу')};
 box.window=box;vm.createContext(box);vm.runInContext(section('live-assistant-v15.js','function v15Speak(){','function v151SetAutoVoice('),box);
 box.v15Speak();assert.equal(resumes,1);assert.equal(box.v151SpeechUnlocked,true);
});
test('Закрытые настройки не блокируют учебное чтение после возврата к заданию',()=>{
 const h=autoHarness();h.settings(true);h.hideMenu();h.box.v151AutoSpeak('Шаг задания','explain');
 assert.equal(h.timers.size,1);[...h.timers.values()][0]();assert.deepEqual(h.spoken,['Шаг задания']);
});
test('Открытие настроек отменяет таймер, сохраняет речь и не запускает пробу',()=>{
 const elements=new Map(),cleared=[],spoken=[];
 const element=id=>{if(!elements.has(id))elements.set(id,{handlers:new Map(),style:{},classList:{toggle(){}},addEventListener(e,fn){this.handlers.set(e,fn);}});return elements.get(id);};
 const dom={querySelector:element,querySelectorAll:()=>[]},noop=()=>{};
 const box={document:{querySelector:s=>s==='#v15Assistant'?dom:element(s)},addEventListener:noop,matchMedia:()=>({matches:false}),
  clearTimeout:id=>cleared.push(id),v151AutoSpeechTimer:7,v151Speaking:true,v151VoiceAuto:true,v151VoiceEnabled:true,
  v15Close:noop,v15ShowTip:noop,v15ExplainSimple:noop,v15Speak:noop,v151SaveVoice:noop,v151UpdateVoiceUi:noop,
  KitsuneStaticVoice:{sample:()=> 'Проверенный голос',enable(){}},KitsuneDynamicVoice:{info:()=>({ready:true})},v151Speak:text=>spoken.push(text)};
 box.window=box;vm.createContext(box);
 vm.runInContext(section('live-assistant-v15.js','function v15Bind(){','/* Первый осознанный тап'),box);
 box.v15Bind();element('#v15SettingsBtn').handlers.get('click')();
 assert.deepEqual(cleared,[7]);assert.equal(box.v151Speaking,true);assert.equal(box.v151AutoSpeechTimer,null);assert.equal(spoken.length,0);
 element('#v151TestVoice').handlers.get('click')();assert.deepEqual(spoken,['Проверенный голос']);
 element('#v151TestGenerator').handlers.get('click')();assert.deepEqual(spoken,['Проверенный голос','Привет! Я Китсуне. Давай решим новую задачу вместе.']);
});
test('Неизвестный текст и ошибка WAV не включают старый синтезатор',()=>{
 let old=0,done=0,stopped=0,callback;
 const box={v15LastSpoken:'реплика',v15State:'idle',v151VoiceEnabled:true,v151SpeechUnlocked:true,v151IsSpeechBusy:()=>false,
  document:{querySelector:()=>null},v151UpdateVoiceUi(){},speechSynthesis:{speak(){old++;}},v161StopSpeech:()=>stopped++,KitsuneStaticVoice:{trySpeak:()=>false}};
 box.window=box;vm.createContext(box);vm.runInContext(section('live-assistant-v15.js','function v151Speak(','function v15Speak('),box);
 assert.equal(box.v151Speak('нет записи',{force:true,onDone:()=>done++}),false);assert.equal(old,0);assert.equal(done,1);assert.equal(stopped,1);
 box.KitsuneStaticVoice.trySpeak=(_,opts,fn)=>{callback=fn;return true;};
 assert.equal(box.v151Speak('испорченный WAV',{force:true,onDone:()=>done++}),true);callback();assert.equal(old,0);assert.equal(done,2);
});
test('iPhone: завершение отменённой реплики не завершает новое чтение',()=>{
 const pending=[];let done=0;
 const box={wrappedSpeak:null,wrappedStopSpeech:null,systemSpeechRun:0,systemSpeaking:false,
  v151VoiceEnabled:true,v151SpeechUnlocked:true,v151IsSpeechBusy:()=>false,dialogOpen:()=>true,
  v151Speak:(text,opts)=>{pending.push(opts.onDone);return true;},v161StopSpeech(){},stopSystemSpeech(){}};
 box.window=box;vm.createContext(box);vm.runInContext(section('voice-stability-v2387.js','function wrapIOSDialogSpeech(){','function rmsOf('),box);
 box.wrapIOSDialogSpeech();box.v151Speak('первый',{force:true,onDone:()=>done++});box.v151Speak('второй',{force:true,onDone:()=>done++});
 pending[0]();assert.equal(done,0);assert.equal(box.systemSpeaking,true);
 pending[1]();assert.equal(done,1);assert.equal(box.systemSpeaking,false);
});
test('Ошибка озвучки остаётся в настройках после завершения и обновления интерфейса',()=>{
 const note={textContent:''};let failure,done=0;
 const box={v15LastSpoken:'реплика',v15State:'idle',v151VoiceEnabled:true,v151VoiceAuto:false,v151SpeechUnlocked:true,v151Speaking:false,v151VoiceNotice:'',v151IsSpeechBusy:()=>false,
  document:{querySelector:s=>s==='#v151VoiceNote'?note:null},KitsuneStaticVoice:{trySpeak:()=>false,info:()=>({topics:3})},
  KitsuneDynamicVoice:{info:()=>({ready:true,status:'installed_candidate'}),trySpeak:(_,opts,onError)=>{failure=onError;return true;}}};
 box.window=box;vm.createContext(box);
 vm.runInContext(section('live-assistant-v15.js','function v151Speak(','function v15Speak('),box);
 vm.runInContext(section('live-assistant-v15.js','function v151UpdateVoiceUi(','function v15ShowTip('),box);
 assert.equal(box.v151Speak('новая фраза',{force:true,onDone:()=>done++}),true);
 failure('Не удалось запустить генератор на этом устройстве.');box.v151UpdateVoiceUi();box.v151UpdateVoiceUi();
 assert.equal(note.textContent,'Не удалось запустить генератор на этом устройстве.');assert.equal(done,1);
});
test('Проба при выключенном голосе объясняет включение и не запускает генератор',()=>{
 const note={textContent:''};let calls=0;
 const box={v15LastSpoken:'реплика',v15State:'idle',v151VoiceEnabled:false,v151VoiceAuto:false,v151SpeechUnlocked:true,v151Speaking:false,v151VoiceNotice:'',v151IsSpeechBusy:()=>false,
  document:{querySelector:s=>s==='#v151VoiceNote'?note:null},KitsuneStaticVoice:{trySpeak:()=>{calls++;},info:()=>({topics:3})},KitsuneDynamicVoice:{info:()=>({ready:true})}};
 box.window=box;vm.createContext(box);vm.runInContext(section('live-assistant-v15.js','function v151Speak(','function v15Speak('),box);
 vm.runInContext(section('live-assistant-v15.js','function v151UpdateVoiceUi(','function v15ShowTip('),box);
 box.wrappedSpeak=null;box.wrappedStopSpeech=null;box.systemSpeechRun=0;
 box.dialogOpen=()=>true;
 vm.runInContext(section('voice-stability-v2387.js','function wrapIOSDialogSpeech(){','function rmsOf('),box);box.wrapIOSDialogSpeech();
 let errors=0,done=0;
 assert.equal(box.v151Speak('проба',{force:true,onError:()=>errors++,onDone:()=>done++}),false);box.v151UpdateVoiceUi();assert.match(note.textContent,/Включи голос/);assert.equal(calls,0);assert.equal(box.v151VoiceEnabled,false);assert.equal(errors,1);assert.equal(done,1);
});
test('Активный стек не содержит старых синтезаторов и списков голосов',()=>{
 const loader=read('runtime-loader-v2395.js'),live=read('live-assistant-v15.js'),dialog=read('voice-conversation-v237.js');
 assert(!loader.includes('neural-voice-v17.js'));assert(!loader.includes('local-voice-lab-v231.js'));
 for(const s of [live,dialog,read('voice-stability-v2387.js')])assert(!s.includes('new SpeechSynthesisUtterance'));
 for(const id of ['v151VoiceSelect','v161Energy','v161CompareVoices','data-voice-profile'])assert(!live.includes(id));
 assert(!dialog.includes('PIPER_PACKAGE'));assert(!dialog.includes('v237Irina'));
});
