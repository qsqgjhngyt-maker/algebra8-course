'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
function section(file,start,end){const s=fs.readFileSync(path.join(root,file),'utf8'),a=s.indexOf(start),b=s.indexOf(end,a+start.length);assert(a>=0&&b>a);return s.slice(a,b);}
function harness({reject=false,ios=false}={}){
 let open=false,active=false,stops=0,scheduled=0;const completions=[],failures=[],observers=[],marks=[];
 const box={speaking:false,speakingRun:0,speechInDialog:false,speechWrapped:false,originalSpeak:null,originalStop:null,
  systemSpeechRun:0,systemSpeaking:false,wrappedSpeak:null,wrappedStopSpeech:null,v151VoiceEnabled:true,v151SpeechUnlocked:true,
  systemSpeechInDialog:false,activeSystemFinish:null,systemSpeechPoll:null,systemSpeechWatchdog:null,dialogObserver:null,
  sessionEpoch:0,retryTimer:null,recording:false,sessionBusy:false,originalStop:null,delayedReleaseTimer:null,
  setMicUi(){},clearIosSessionMarker(){},releaseOwnWorker:async()=>{},setTimeout:()=>1,clearInterval(){},v161MarkSpeaking:on=>marks.push(on),
  document:{body:{},querySelector:()=>({})},MutationObserver:class{constructor(fn){observers.push(fn);}observe(){}},dialogOpen:()=>open,
  injectDialogControls(){},injectSettings(){},wrapBrain(){},clearTimeout(){},handsFreeTimer:null,
  scheduleHandsFree(){scheduled++;},speechSynthesis:{cancel(){}},stopSystemSpeech(){box.systemSpeechRun++;box.systemSpeaking=false;},
  v151IsSpeechBusy:()=>active,
  v161StopSpeech(){active=false;stops++;},KitsuneStaticVoice:{stop(){active=false;}},KitsuneDynamicVoice:{stop(){active=false;}},
  v151Speak(text,opts){if(opts.force)box.v161StopSpeech();if(reject){opts.onError?.('Сохраните генератор Kitsune для новых фраз.');opts.onDone?.();return false;}active=true;completions.push(opts.onDone);failures.push(opts.onError);return true;}};
 box.window=box;vm.createContext(box);
 vm.runInContext(section('voice-conversation-v237.js','  function stopIrina(){','  function scheduleHandsFree(){'),box);
 vm.runInContext(section('voice-conversation-v237.js','  function stopAllSpeech(){','  function setVoiceStatus('),box);
 vm.runInContext(section('voice-conversation-v237.js','  function observeDialog(){','  function initialMemoryFromHistory('),box);
 box.wrapSpeech();box.observeDialog();
 if(ios){
  const code=[section('voice-stability-v2387.js','  function endDialogVoiceSession(){','  function rmsOf('),
   section('voice-stability-v2387.js','  function stopUnified(){','  async function releaseUnified('),
   section('voice-stability-v2387.js','  function observeDialogLifecycle(){','  function patchApi(')].join('\n');
  vm.runInContext('(()=>{let originalStop=null;'+code+'\nwindow.wrapIOSDialogSpeech=wrapIOSDialogSpeech;window.observeDialogLifecycle=observeDialogLifecycle;})();',box);
  box.wrapIOSDialogSpeech();box.observeDialogLifecycle();
 }
 return {box,completions,failures,marks,open(v){open=v;for(const fn of observers)fn();},mutate(){for(const fn of observers)fn();},active:()=>active,stops:()=>stops,scheduled:()=>scheduled};
}
for(const ios of [false,true]){
 test(`Загрузка режима разговора не отменяет чтение страницы (${ios?'iOS':'ПК'})`,()=>{
  const h=harness({ios});assert(h.box.v151Speak('Запись урока',{force:true}));const stops=h.stops();h.mutate();h.mutate();assert.equal(h.active(),true);assert.equal(h.stops(),stops);
 });
 test(`Закрытие разговора отменяет его реплику один раз (${ios?'iOS':'ПК'})`,()=>{
  const h=harness({ios});h.open(true);assert(h.box.v151Speak('Ответ',{force:true}));const stops=h.stops();h.mutate();assert.equal(h.active(),true);h.open(false);assert.equal(h.active(),false);assert.equal(h.stops(),stops+1);h.mutate();assert.equal(h.stops(),stops+1);
 });
}
test('Открытие и закрытие пустого разговора сохраняет читающийся урок и состояние проигрывателя',()=>{
 const h=harness({ios:true});h.box.v151Speak('Запись урока',{force:true});const stops=h.stops(),marks=h.marks.length;h.open(true);h.open(false);assert.equal(h.active(),true);assert.equal(h.stops(),stops);assert.equal(h.box.systemSpeaking,true);assert.equal(h.marks.length,marks);
});
test('Отказ озвучки не запускает микрофон как после успешно прочитанного ответа',()=>{
 const h=harness({reject:true});h.open(true);assert.equal(h.box.v151Speak('Новая реплика',{force:true}),false);assert.equal(h.scheduled(),0);assert.equal(h.active(),false);
});

for(const ios of [false,true]){
 test(`Ошибка генерации не запускает микрофон (${ios?'iOS':'ПК'})`,()=>{
  const h=harness({ios});h.open(true);let errors=0,done=0;
  h.box.v151Speak('Ответ',{force:true,onError:()=>errors++,onDone:()=>done++});
  h.failures[0]('Ошибка модели');h.completions[0]();h.completions[0]();
  assert.equal(errors,1);assert.equal(done,1);assert.equal(h.scheduled(),0);
 });
 test(`Позднее завершение не переключает микрофон и новое чтение (${ios?'iOS':'ПК'})`,()=>{
  const h=harness({ios});h.open(true);let done=0,errors=0;
  h.box.v151Speak('Первый ответ',{force:true,onDone:()=>done++,onError:()=>errors++});
  h.box.v151Speak('Новый ответ',{force:true,onDone:()=>done++});
  h.failures[0]('Поздняя ошибка');h.completions[0]();assert.equal(errors,0);assert.equal(done,0);
  assert.equal(h.box.speaking,true);assert.equal(h.scheduled(),0);
  h.completions[1]();h.completions[1]();assert.equal(done,1);assert.equal(h.scheduled(),1);assert.equal(h.box.speaking,false);
 });
}

test('Завершение чтения урока не запускает разговор без рук',()=>{
 const h=harness();h.box.v151Speak('Запись урока',{force:true});h.open(true);h.completions[0]();assert.equal(h.scheduled(),0);
});

test('После голосового обращения микрофон ждёт настоящего завершения приветствия',async()=>{
 const timers=[],states=[];let start=0,onDone;
 const box={wakeMode:'idle',wakeListening:true,VERSION:'test',WAKE_PHRASE:'Китсуне',
  updateWakeUi(){},stopWakeListener:async()=>{},setLiveState:s=>states.push(s),syncDialogState(){},setWakeStatus(){},scheduleWakeRestart(){},
  KitsuneVoiceDialogue:{open(){},start(){start++;}},v151Speak:(text,opts)=>{onDone=opts.onDone;return true;},
  setTimeout:(fn,ms)=>{timers.push({fn,ms});},dispatchEvent(){},CustomEvent:class{}};
 box.window=box;vm.createContext(box);
 vm.runInContext(section('kitsune-presence-v238.js','  async function activateFromWake(','  function friendlyMicError('),box);
 await box.activateFromWake({score:1});assert.equal(timers.length,0);assert.equal(start,0);
 onDone();onDone();assert.equal(timers.length,1);assert.equal(timers[0].ms,180);
 timers[0].fn();assert.equal(start,1);assert.equal(states.at(-1),'focus');
});

test('Подготовка и ошибка голоса видны в разговоре; обновление сохраняет сообщения микрофона',()=>{
 const live={textContent:'',className:'',dataset:{}},dialog={classList:{contains:()=>true}};let message='Загружаю модель…';
 const box={v151VoiceEnabled:true,v151VoiceAuto:true,v151VoiceNotice:'',v151Speaking:false,
  document:{querySelector:s=>s==='#v19Dialog'?dialog:s==='#v19DialogLive'?live:null},
  KitsuneDynamicVoice:{info:()=>({ready:true,message})}};
 box.window=box;vm.createContext(box);
 vm.runInContext(section('live-assistant-v15.js','function v151UpdateVoiceUi(','function v15ShowTip('),box);
 box.v151UpdateVoiceUi();assert.equal(live.textContent,message);assert.match(live.className,/thinking/);
 box.v151VoiceNotice='Ошибка генератора';message='';box.v151UpdateVoiceUi();box.v151UpdateVoiceUi();assert.equal(live.textContent,'Ошибка генератора');assert.match(live.className,/warn/);
 box.v151VoiceNotice='';box.v151UpdateVoiceUi();assert.equal(live.textContent,'');
 box.v151Speaking=true;box.v151UpdateVoiceUi();assert.match(live.className,/speaking/);
 box.v151Speaking=false;live.textContent='Слушаю вопрос…';live.className='v19-dialog-live listening';
 box.v151UpdateVoiceUi();assert.equal(live.textContent,'Слушаю вопрос…');assert.match(live.className,/listening/);
});

test('Ответы разговора используют общий переключатель автоозвучки и игнорируют старый флаг',async()=>{
 const spoken=[],states=[],history=[];
 const box={messageSequence:0,activeCtx:null,history,voiceReplies:false,
  currentCtx:()=>null,contextKey:()=> 'free',addHistory:(role,content)=>history.push({role,content,contextKey:'free'}),
  dialogState:text=>states.push(text),KitsuneBrain:{chat:async()=> 'Ответ Китсуне'},v151Speak:text=>spoken.push(text)};
 box.window=box;vm.createContext(box);vm.runInContext('let v151VoiceAuto=true,v151VoiceEnabled=true;',box);
 assert.equal(box.v151VoiceAuto,undefined);
 vm.runInContext(section('kitsune-voice-v19.js','  async function sendMessage(','  async function toggleRecord('),box);
 await box.sendMessage('Первый вопрос');assert.deepEqual(spoken,['Ответ Китсуне']);
 vm.runInContext('v151VoiceAuto=false;',box);await box.sendMessage('Второй вопрос');assert.equal(spoken.length,1);assert.match(states.at(-1),/Автоозвучка выключена/);
 vm.runInContext('v151VoiceAuto=true;v151VoiceEnabled=false;',box);await box.sendMessage('Третий вопрос');assert.equal(spoken.length,1);
 vm.runInContext('v151VoiceEnabled=true;',box);await box.sendMessage('Четвёртый вопрос');assert.equal(spoken.length,2);
});

test('Ручное чтение ответа работает при выключенной автоозвучке и сохраняет контекст задания',()=>{
 const spoken=[];
 const box={history:[{ts:1,role:'user',content:'Вопрос',contextKey:'one'},{ts:2,role:'assistant',content:'Ответ',contextKey:'one'},
  {ts:3,role:'assistant',content:'Другое задание',contextKey:'two'}],activeCtx:null,contextKey:()=> 'one',v151Speak:(text,options)=>spoken.push({text,options}),dialogState(){}};
 box.window=box;vm.createContext(box);vm.runInContext('let v151VoiceAuto=false,v151SpeechUnlocked=false;',box);
 vm.runInContext(section('kitsune-voice-v19.js','  function readReply(','  function renderHistory('),box);
 box.readReply(1);box.readReply(3);assert.equal(spoken.length,0);box.readReply(2);
 assert.equal(spoken.length,1);assert.equal(spoken[0].text,'Ответ');assert.equal(spoken[0].options.force,true);
 assert.equal(vm.runInContext('v151SpeechUnlocked',box),true);assert.equal(vm.runInContext('v151VoiceAuto',box),false);
});
