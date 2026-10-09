'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),read=file=>fs.readFileSync(path.join(root,file),'utf8');
function section(file,a,b){const s=read(file),i=s.indexOf(a),j=s.indexOf(b,i+1);assert(i>=0&&j>i);return s.slice(i,j);}
test('Локальный разговор отвечает на вопросы о навыках и цели вместо общей заготовки',()=>{
 const box={strip:s=>s,smartSteps:()=>['Приравняй знаменатель к нулю.'],safeNextStep:(_,s)=>s,expected:()=>['-4']};
 vm.createContext(box);vm.runInContext(section('kitsune-brain-v18.js','  function dialogFallback(','  function isExplicitAnswerRequest('),box);
 for(const question of ['Что ты умеешь?','Какие у тебя навыки?','Китсуне, что ты можешь?'])assert.match(box.dialogFallback(question,null),/объясняю темы курса/);
 for(const question of ['Какая цель?','Новая цель?','Зачем ты нужна?'])assert.match(box.dialogFallback(question,null),/Наша цель — понять математику/);
 const ctx={exercise:{hint:'Подсказка'},lesson:{remember:'Знаменатель не равен нулю.'}};
 assert.match(box.dialogFallback('Какая цель?',ctx),/Приравняй знаменатель к нулю/);
 assert.match(box.dialogFallback('Что ты умеешь?',ctx),/проверю твой ход решения/);
 assert.match(box.dialogFallback('Не понимаю',ctx),/Хорошо, совсем просто/);
 assert.match(box.dialogFallback('Покажи ответ',ctx),/ответ для самопроверки — -4/);
 assert.match(box.dialogFallback('Кто выиграл матч?',null),/Уточни/);
 assert(!box.dialogFallback('Кто выиграл матч?',null).includes('Cloud Brain'));
});
function harness(){
 const spoken=[],manual=[],timers=[],panels=[];let stopped=0,auto=true;
 class Element{
  constructor(){this.dataset={};this.nodes=new Map();this.handlers=new Map();this.isConnected=true;this.textContent='';this.value='';const values=new Set();
   this.classList={add:(...v)=>v.forEach(x=>values.add(x)),remove:(...v)=>v.forEach(x=>values.delete(x)),contains:v=>values.has(v),toggle:v=>{values.has(v)?values.delete(v):values.add(v);return values.has(v);}};}
  set innerHTML(value){this.html=value;}
  querySelector(selector){if(selector==='.v173-result-voice'&&!this.nodes.has(selector))return null;if(!this.nodes.has(selector))this.nodes.set(selector,new Element());return this.nodes.get(selector);}
  setAttribute(){}addEventListener(name,fn){this.handlers.set(name,fn);}click(){this.handlers.get('click')?.();}scrollIntoView(){}focus(){}
 }
 const exercise=new Element();exercise.querySelector=selector=>selector==='.v173-inline-tutor'?panels[0]||null:null;
 const children=[];exercise.querySelector=selector=>selector==='.v173-inline-tutor'?panels[0]||null:selector==='.v173-result-voice'?children.find(e=>e.className==='v173-voice-status v173-result-voice')||null:null;
 exercise.appendChild=p=>{if(p.className==='v173-inline-tutor')panels.push(p);else children.push(p);};
 const ctx={key:'sample-0',lessonId:'1-1',box:exercise,lesson:{title:'Рациональные выражения',remember:'Знаменатель не равен нулю.'},
  exercise:{q:'При каком значении x выражение 7/(x+4) не имеет смысла?',a:'-4',hint:'Приравняй знаменатель x + 4 к нулю.'}};
 const box={document:{querySelector:()=>null,querySelectorAll:()=>[],createElement:()=>new Element()},
  setTimeout:fn=>{timers.push(fn);return timers.length;},matchMedia:()=>({matches:true}),
  v16Strip:s=>String(s??'').replace(/<[^>]*>/g,''),v16Classify:(_,value)=>({correct:value==='-4'}),
  v151LessonSpeak:(text,state,options)=>{if(!auto)return false;spoken.push({text,state,options});return true;},
  v151Speak:(text,options)=>{manual.push({text,options});return true;},v161StopSpeech:()=>stopped++,
  KitsuneDynamicVoice:{info:()=>({message:'Подготовка: 1 мин'})}};
 box.window=box;vm.createContext(box);vm.runInContext('let v151SpeechUnlocked=false;',box);vm.runInContext(read('tutor-smart-v173.js'),box);
 return{box,ctx,spoken,manual,timers,panel:()=>panels[0],auto:value=>auto=value,stopped:()=>stopped};
}

test('Первый и следующий шаги читаются отдельно; ответ не раскрывается до нажатия',()=>{
 const h=harness();h.box.v173OpenInline(h.ctx);const p=h.panel();
 assert.equal(h.spoken.length,1);assert.equal(h.spoken[0].text,'Шаг 1. Приравняй знаменатель x + 4 к нулю.');
 assert(!h.spoken[0].text.includes('-4'));p.querySelector('.v173-next').click();
 assert.equal(h.spoken.length,2);assert.match(h.spoken[1].text,/^Шаг 2\./);assert.match(h.spoken[1].text,/знаменателем/);
 p.querySelector('.v173-answer').click();assert.equal(h.spoken.at(-1).text,'Ответ: -4');
});

test('Выключенная автоозвучка оставляет шаг текстовым; ручное чтение доступно',()=>{
 const h=harness();h.auto(false);h.box.v173OpenInline(h.ctx);const p=h.panel();p.querySelector('.v173-next').click();
 assert.equal(h.spoken.length,0);p.querySelector('.v173-read').click();assert.equal(h.manual.length,1);
 assert.match(h.manual[0].text,/^Шаг 2\./);assert.equal(h.manual[0].options.force,true);
});

test('Ошибочная проверка не перезапускает озвучку результата автоматическим первым шагом',()=>{
 const h=harness();h.box.v173OpenInline(h.ctx,{reason:'wrong',userValue:'4',errorType:'generic'});
 assert.equal(h.spoken.length,0);h.panel().querySelector('.v173-read').click();assert.match(h.manual[0].text,/^Шаг 1\./);
});

test('Объяснение и проверка своего хода читают показанный результат',()=>{
 const h=harness();h.box.v173OpenInline(h.ctx);const p=h.panel();p.querySelector('.v173-why').click();
 assert.equal(h.spoken.at(-1).text,'Почему: Знаменатель не равен нулю.');
 p.querySelector('.v173-work-box textarea').value='-4';p.querySelector('.v173-check-work').click();
 assert.match(h.spoken.at(-1).text,/правильному/);assert.equal(h.spoken.at(-1).state,'happy');
 p.querySelector('.v173-work-box textarea').value='4';p.querySelector('.v173-check-work').click();assert.match(h.spoken.at(-1).text,/Сверь/);
});

test('Статус и ошибка видны под разбором; закрытие отменяет только его чтение',()=>{
 const h=harness();h.box.v173OpenInline(h.ctx);const p=h.panel();h.box.KitsuneLessonVoice.updateUi();
 assert.match(p.querySelector('.v173-voice-status').textContent,/1 мин/);
 h.spoken[0].options.onError('Ошибка генерации');assert.equal(p.querySelector('.v173-voice-status').textContent,'Ошибка генерации');
 p.querySelector('.v173-close').click();assert.equal(h.stopped(),1);assert.equal(p.classList.contains('show'),false);
 p.querySelector('.v173-close').click();assert.equal(h.stopped(),1);
});

test('Позднее завершение старого шага не теряет управление новым чтением',()=>{
 const h=harness();h.box.v173OpenInline(h.ctx);h.panel().querySelector('.v173-next').click();
 h.spoken[0].options.onDone();h.panel().querySelector('.v173-close').click();assert.equal(h.stopped(),1);
});

test('Новый разговор забирает управление голосом; закрытие прежнего разбора его не отменяет',()=>{
 const h=harness();h.box.v173OpenInline(h.ctx);h.box.KitsuneLessonVoice.speechRequested(null);
 h.spoken[0].options.onDone();h.panel().querySelector('.v173-close').click();assert.equal(h.stopped(),0);
});

test('Результат проверки показывает подготовку рядом с заданием и сохраняет текст ошибки',()=>{
 const h=harness();h.box.v173OpenInline(h.ctx);h.box.KitsuneLessonVoice.updateUi();const oldNote=h.panel().querySelector('.v173-voice-status');assert.match(oldNote.textContent,/Подготовка/);
 h.box.KitsuneLessonVoice.result(h.ctx.box,'Пока не так. Попробуй ещё раз.','oops');assert.equal(oldNote.textContent,'');
 assert.equal(h.spoken.length,2);h.box.KitsuneLessonVoice.updateUi();const note=h.ctx.box.querySelector('.v173-result-voice');
 assert.match(note.textContent,/Подготовка/);h.spoken[1].options.onError('Не удалось запустить генератор');h.spoken[1].options.onDone();
 assert.equal(note.textContent,'Не удалось запустить генератор');
});

test('Учебное действие заменяет речь и отменяет фоновый совет; настройки и отключение блокируют автозапуск',()=>{
 const calls=[],cleared=[];let open=false,settings=true;
 const box={v151VoiceEnabled:true,v151VoiceAuto:true,v151SpeechUnlocked:true,v15Mode:'active',v151AutoSpeechTimer:7,
  clearTimeout:id=>cleared.push(id),v151Speak:(text,opts)=>{calls.push({text,opts});return true;},
  document:{querySelector:s=>({classList:{contains:()=>s==='#v15Assistant'?open:settings}})}};
 box.window=box;vm.createContext(box);vm.runInContext(section('live-assistant-v15.js','function v151SettingsVisible(','function v151UpdateVoiceUi('),box);
 assert.equal(box.v151LessonSpeak('Шаг 1'),true);assert.equal(calls[0].opts.force,true);assert.equal(box.v151AutoSpeechTimer,null);assert.deepEqual(cleared,[7]);
 open=true;assert.equal(box.v151LessonSpeak('Шаг 2'),false);open=false;box.v151VoiceAuto=false;assert.equal(box.v151LessonSpeak('Результат'),false);assert.equal(calls.length,1);
});

test('Обычная Проверить озвучивает фактический верный/неверный результат; уход со страницы отменяет ожидание',()=>{
 const source=read('live-assistant-v15.js'),start=source.indexOf('  if(isCheck){'),end=source.indexOf('  /* Массовая диагностика',start);
 const spoken=[],timers=[];let feedback='✅ Верно! Отлично.',correct=true,wrong=false;
 const container={isConnected:true},box={btn:{closest:()=>container},setTimeout:fn=>timers.push(fn),v15LooksCorrect:()=>correct,v15LooksWrong:()=>wrong,
  v15ReactCorrect(){},v15FindFeedback:()=>({textContent:feedback}),v151LessonSpeak:(text,state)=>spoken.push({text,state}),v15Mode:'active',
  v15RightStreak:0,v15WrongStreak:0,v15SetState(){},v15Chip(){}};
 box.window=box;vm.createContext(box);vm.runInContext('function check(){const isCheck=true;'+source.slice(start,end)+'}',box);
 box.check();timers.shift()();assert.deepEqual(spoken[0],{text:feedback,state:'happy'});
 correct=false;wrong=true;feedback='Пока не так. Попробуй ещё раз.';box.check();timers.shift()();assert.deepEqual(spoken[1],{text:feedback,state:'oops'});
 timers.length=0;container.isConnected=false;box.check();timers.shift()();assert.equal(spoken.length,2);
});

test('Очистка памяти сохраняет активную подготовку и чтение; без них освобождает компоненты',async()=>{
 const releases=[];let dynamic=true,staticBusy=false,dialog=false;
 const box={dialogOpen:()=>dialog,heavyReleasePromise:null,lastHeavyReleaseAt:0,Date:{now:()=>10000},sleep:()=>Promise.resolve(),
  KitsuneDynamicVoice:{isBusy:()=>dynamic},KitsuneStaticVoice:{isBusy:()=>staticBusy},KitsuneBrain:{release:()=>releases.push('brain')},
  KitsuneLiveConversation:{release:()=>releases.push('voice')}};
 box.window=box;vm.createContext(box);vm.runInContext(section('performance-manager-v150.js','  async function releaseHeavyVoice(','  function isLearningView('),box);
 assert.equal(await box.releaseHeavyVoice(),false);dynamic=false;staticBusy=true;assert.equal(await box.releaseHeavyVoice(),false);
 staticBusy=false;dialog=true;assert.equal(await box.releaseHeavyVoice(),false);dialog=false;
 assert.equal(releases.length,0);assert.equal(await box.releaseHeavyVoice(),true);assert.deepEqual(releases,['voice','brain']);
});

test('Поздний ответ Brain не подменяет новый шаг и не запускает повторную озвучку',async()=>{
 const replies=[],text={textContent:''},thinking={classList:{add(){},remove(){}}},row={dataset:{},querySelector:s=>s==='.v18-comic-text'?text:thinking};
 const panel={isConnected:true,classList:{contains:()=>true}},box={comicHost:()=>row,mode:'hints',ready:false,rememberError(){},
  coachReply:()=>new Promise(r=>replies.push(r)),v151AutoSpeak:()=>assert.fail('Повторная автоозвучка')};
 vm.createContext(box);vm.runInContext(section('kitsune-brain-v18.js','  async function say(','  function factsFromOpen('),box);
 const first=box.say(panel,{},{}),second=box.say(panel,{},{});replies[1]('Новый шаг');await second;replies[0]('Старый шаг');await first;
 assert.equal(text.textContent,'Новый шаг');
});

test('Разобрать текущее закрывает меню до чтения; без упражнения показывает понятное сообщение',()=>{
 const calls=[];let handler,ctx={key:'current'};
 const actions={querySelector:()=>null,appendChild(){}},box={document:{querySelector:()=>actions,createElement:()=>({addEventListener:(_,fn)=>handler=fn})},
  v16CurrentContext:()=>ctx,v15Close:()=>calls.push('close'),v173OpenInline:c=>calls.push(c.key),v15Message:(text,options)=>calls.push({text,options})};
 box.window=box;vm.createContext(box);vm.runInContext(section('tutor-smart-v173.js','  function ensureAlfiShortcut(','  // Replace exercise button'),box);
 box.ensureAlfiShortcut();const event={preventDefault(){},stopPropagation(){},stopImmediatePropagation(){}};
 handler(event);assert.deepEqual(calls,['close','current']);calls.length=0;ctx=null;handler(event);
 assert.equal(calls.length,1);assert.match(calls[0].text,/Открой урок/);assert.equal(calls[0].options.open,true);
});
