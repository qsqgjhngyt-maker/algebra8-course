/* Свой текст и чтение уроков с паузой и локальной закладкой. */
(() => {
  'use strict';
  if(window.KitsuneReading)return;
  const STORE='kitsune-reader-v074';
  let stored={text:'',bookmarks:{}};
  try{const data=JSON.parse(localStorage.getItem(STORE)||'null');
    if(data&&typeof data.text==='string'&&data.text.length<=20000&&data.bookmarks&&typeof data.bookmarks==='object')stored=data;
  }catch{}
  const persist=()=>{try{localStorage.setItem(STORE,JSON.stringify(stored));}catch{}};
  const keys=new Map();
  function keyFor(text){
    let hash=2166136261;for(const c of text)hash=Math.imul(hash^c.codePointAt(0),16777619);
    const key=(hash>>>0).toString(16)+'-'+text.length;
    keys.set(key,{head:text.slice(0,64),tail:text.slice(-64)});return key;
  }
  function stopVoice(){
    try{window.v161StopSpeech?.();}catch{}
    // Гарантируем остановку обоих плееров, даже пока загружаются обёртки диалога.
    window.KitsuneStaticVoice?.stop?.();window.KitsuneDynamicVoice?.stop?.();
  }
  const root=document.createElement('div');root.id='kitsuneReaderUi';
  root.innerHTML=[
    '<aside id="kitsuneReadingBar" class="kitsune-reading-bar" aria-label="Управление чтением" hidden>',
    '<div><strong id="kitsuneReadingTitle"></strong><span id="kitsuneReadingStatus" role="status" aria-live="polite"></span></div>',
    '<div class="kitsune-reading-actions"><button type="button" id="kitsuneReadingPause">⏸ Пауза</button>',
    '<button type="button" id="kitsuneReadingResume">▶ Продолжить</button>',
    '<button type="button" id="kitsuneReadingRestart">↺ Сначала</button>',
    '<button type="button" id="kitsuneReadingFinish" aria-label="Закончить чтение">×</button></div></aside>',
    '<dialog id="kitsuneReaderDialog" class="kitsune-reader-dialog" aria-labelledby="kitsuneReaderHeading">',
    '<header><div><h2 id="kitsuneReaderHeading">🦊 Читалка Kitsune</h2><p>Добавь текст — Китсуне прочитает его своим голосом.</p></div>',
    '<button type="button" id="kitsuneReaderClose" aria-label="Закрыть читалку">×</button></header>',
    '<label for="kitsuneReaderText">Текст для чтения</label>',
    '<textarea id="kitsuneReaderText" maxlength="20000" placeholder="Вставь рассказ, объяснение или математический пример…"></textarea>',
    '<div id="kitsuneReaderStatus" class="kitsune-reader-status" role="status" aria-live="polite"></div>',
    '<div class="kitsune-reader-actions"><button type="button" id="kitsuneReaderStart" class="primary">▶ Читать</button>',
    '<button type="button" id="kitsuneReaderPause">⏸ Пауза</button><button type="button" id="kitsuneReaderRestart">↺ Сначала</button></div>',
    '<p class="kitsune-reader-note">Текст и закладка сохраняются на этом устройстве. При продолжении текущая фраза повторяется.</p></dialog>'
  ].join('');
  document.body.appendChild(root);
  const q=id=>root.querySelector('#'+id),dialog=q('kitsuneReaderDialog'),input=q('kitsuneReaderText'),bar=q('kitsuneReadingBar');
  input.value=stored.text;
  function status(s){
    if(!s)return '';
    const part=Math.min(s.index+1,s.total)+' из '+s.total;
    return s.phase==='completed'?'Прочитано: '+s.total+' фраз.':s.phase==='paused'?'Пауза · фраза '+part:
      s.phase==='error'?s.message:(s.phase==='waiting'?'Пауза между фразами · ':'Читаю · ')+'фраза '+part;
  }
  function changed(s){
    bar.hidden=!s||s.phase==='idle'||dialog.open;
    q('kitsuneReadingTitle').textContent=s?.title||'';
    q('kitsuneReadingStatus').textContent=status(s);
    const active=s&&['reading','waiting'].includes(s.phase),resumable=s&&['paused','error'].includes(s.phase);
    q('kitsuneReadingPause').hidden=!active;q('kitsuneReadingResume').hidden=!resumable;
    q('kitsuneReaderPause').disabled=!active||!s.reader;
    q('kitsuneReaderRestart').disabled=!input.value.trim();
    input.disabled=!!active&&!!s.reader;
    q('kitsuneReaderStart').disabled=!!active&&!!s.reader;
    q('kitsuneReaderStart').textContent=resumable&&s.reader?'▶ Продолжить':'▶ Читать';
    q('kitsuneReaderStatus').textContent=s?.reader?status(s):'Готова прочитать твой текст.';
  }
  const controller=window.KitsuneReadingCore.create({
    speak:(text,options)=>window.v151Speak?.(text,options)||false,stopVoice,changed,
    save:(key,b)=>{delete stored.bookmarks[key];stored.bookmarks[key]={...b,...keys.get(key)};const all=Object.keys(stored.bookmarks);
      for(const old of all.slice(0,Math.max(0,all.length-40)))delete stored.bookmarks[old];persist();},
    load:key=>{const b=stored.bookmarks[key],fingerprint=keys.get(key);return b&&fingerprint&&b.head===fingerprint.head&&b.tail===fingerprint.tail?b:null;}
  });
  function start(text,{title='Чтение урока',reader=false,restart=false}={}){
    text=String(text||'').trim();if(!text||text.length>20000)throw Error('Добавь текст длиной до 20 000 символов.');
    const plan=window.KitsuneStaticVoice?.readingPlan?.(text)||window.KitsuneDeviceCore.speechPlan(text);
    return controller.start({key:keyFor(text),title,plan,reader,restart});
  }
  function readerStart(restart=false){
    stored.text=input.value;persist();
    try{start(input.value,{title:'Твой текст',reader:true,restart});}
    catch(error){q('kitsuneReaderStatus').textContent=error?.message||String(error);}
  }
  const open=()=>{controller.pause();dialog.showModal();changed(controller.snapshot());input.focus();};
  const close=()=>{if(controller.snapshot()?.reader)controller.pause();dialog.close();changed(controller.snapshot());};
  q('kitsuneReaderClose').addEventListener('click',close);
  dialog.addEventListener('cancel',()=>{if(controller.snapshot()?.reader)controller.pause();});
  dialog.addEventListener('close',()=>changed(controller.snapshot()));
  q('kitsuneReaderStart').addEventListener('click',()=>readerStart());
  q('kitsuneReaderPause').addEventListener('click',()=>controller.pause());
  q('kitsuneReaderRestart').addEventListener('click',()=>readerStart(true));
  q('kitsuneReadingPause').addEventListener('click',()=>controller.pause());
  q('kitsuneReadingResume').addEventListener('click',()=>controller.resume());
  q('kitsuneReadingRestart').addEventListener('click',()=>controller.restart());
  q('kitsuneReadingFinish').addEventListener('click',()=>controller.finish());
  input.addEventListener('input',()=>{stored.text=input.value;persist();q('kitsuneReaderRestart').disabled=!input.value.trim();});
  const nav=document.querySelector('.main-nav');
  if(nav){const button=document.createElement('button');button.id='kitsuneReaderOpen';button.className='nav-btn';button.type='button';
    button.textContent='🔊 Читалка Kitsune';button.setAttribute('aria-haspopup','dialog');
    button.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();open();});nav.appendChild(button);}
  // Делегирование сохраняет управление после обновления или клонирования блока урока.
  document.addEventListener('click',event=>{
    const button=event.target.closest?.('[data-v3-calm-speak],[data-v3-calm-stop],#platformSpeakTheory,#platformStopTheory,#theorySpeakV300,#theoryStopV300');
    if(!button)return;
    event.preventDefault();event.stopImmediatePropagation();
    if(button.matches('[data-v3-calm-stop],#platformStopTheory,#theoryStopV300')){
      if(!controller.pause())stopVoice();return;
    }
    const body=button.dataset.v3CalmSpeak?document.getElementById(button.dataset.v3CalmSpeak)?.querySelector('.v3-calm-theory-body'):null;
    const text=body?(window.KitsuneSchoolNotation?.elementText?.(body)||body.innerText):button.dataset.kitsuneReadingText;
    try{start(text,{title:document.querySelector('#pageTitle')?.textContent||'Чтение урока'});}
    catch(error){window.KitsuneRuntimeStability?.toast?.(error?.message||String(error));}
  },true);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)controller.pause();});
  window.addEventListener('pagehide',()=>controller.pause());
  window.KitsuneReading={...controller,start,open};
  changed(null);
})();
