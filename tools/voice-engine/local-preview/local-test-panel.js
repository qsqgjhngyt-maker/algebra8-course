/* Дополнительные кнопки только для локальной проверки, вне исходников PWA. */
(() => {
  'use strict';
  if(document.getElementById('kitsune-local-check'))return;
  const panel=document.createElement('details');panel.id='kitsune-local-check';
  panel.style.cssText='position:fixed;left:8px;top:8px;z-index:200000;background:#fff;color:#17292b;border:1px solid #9eaba7;border-radius:12px;padding:10px;max-width:min(330px,calc(100vw - 38px));font:14px/1.4 system-ui;box-shadow:0 3px 16px #0002';
  panel.innerHTML='<summary style="cursor:pointer;font-weight:700">Локальная проверка голоса</summary><p>Один голос Kitsune. Готовы первые три урока. Для новых фраз сохраните генератор в обычных настройках помощника.</p><p id="kitsune-check-status" role="status"></p><div id="kitsune-check-actions" style="display:grid;gap:7px"></div><p style="font-size:12px">Обычная кнопка чтения урока и настройки используют тот же голос. Автоозвучку можно выключить.</p>';
  document.body.append(panel);
  const status=panel.querySelector('[role="status"]'),actions=panel.querySelector('#kitsune-check-actions');
  const message=text=>{status.textContent=text;};
  function add(label,fn){const button=document.createElement('button');button.type='button';button.textContent=label;button.style.cssText='padding:9px;border:1px solid #bcc9c1;border-radius:8px;background:#eef9ee;color:#142d1b;font:inherit;cursor:pointer';button.onclick=()=>{try{const result=fn();result?.catch?.(e=>message(e.message));}catch(e){message(e.message);}};actions.append(button);return button;}
  async function info(){
    const server=await fetch('/__kitsune/status',{cache:'no-store'}).then(r=>r.json());
    if(!window.isSecureContext){message('HTTP на телефоне: доступен интерфейс. Для WAV и офлайн перейдите на доверенный HTTPS-адрес.');return;}
    const voice=window.KitsuneStaticVoice?.info();
    const dynamic=window.KitsuneDynamicVoice?.info();
    message(`Готовых записей: ${voice?.clips||0}; учебных тем: ${voice?.topics||0}. Генератор: ${dynamic?.ready?'сохранён, можно проверить новые фразы':server.ondeviceGeneration==='candidate_missing_runtime'?'сначала запустите INSTALL_GENERATOR.bat на ПК':'сохраните в настройках Китсуне'}.`);
  }
  add('Сохранить голос и уроки офлайн',async()=>{
    if(!window.isSecureContext)throw new Error('Для сохранения WAV откройте доверенный HTTPS или localhost на ПК.');
    if(!window.KitsuneStaticVoice)throw new Error('Дождитесь загрузки приложения.');
    message('Сохраняю записи…');
    await KitsuneStaticVoice.download();KitsuneStaticVoice.enable(true);await info();
  });
  function play(item){
    if(!window.isSecureContext)throw new Error('Для проверки WAV нужен доверенный HTTPS или localhost на ПК.');
    if(typeof window.v151Speak!=='function')throw new Error('Дождитесь загрузки Kitsune.');
    v151VoiceEnabled=true;v151SpeechUnlocked=true;v151SaveVoice();v151UpdateVoiceUi();
    KitsuneStaticVoice.enable(true);
    const text=KITSUNE_STATIC_PACK_V04.segments.filter(s=>s.item_id===item).map(s=>s.text).join(' ');
    message('Запускаю чтение…');
    if(!v151Speak(text,{force:true,state:'explain'}))throw new Error('Чтение не запустилось. Проверьте голос и нажмите ещё раз.');
    panel.open=false;
  }
  add('Читать дроби · около 13 секунд',()=>play('fractions'));
  add('Читать уравнения · около 15 секунд',()=>play('equations'));
  add('Читать первый учебный урок',()=>{const item=window.KITSUNE_STATIC_COURSE_PACK_V05?.items[0];if(!item)throw Error('Дождитесь новой сборки.');v151SpeechUnlocked=true;v151VoiceEnabled=true;v151Speak(item.text,{force:true,state:'explain'});panel.open=false;});
  add('Открыть настройки Kitsune',()=>{v15Open();const settings=document.querySelector('#v15Settings');if(!settings?.classList.contains('show'))document.querySelector('#v15SettingsBtn')?.click();panel.open=false;});
  add('Остановить чтение',()=>{window.v161StopSpeech?.();message('Чтение остановлено.');});
  add('Проверить готовность офлайн',info);
  add('Скрыть тестовую панель',()=>panel.remove());
  window.addEventListener('kitsune-voice-engine',()=>message('Сейчас звучит голос Kitsune.'));
  panel.addEventListener('toggle',()=>{if(panel.open)info().catch(e=>message(e.message));});
  info().catch(e=>message(e.message));
  if(window.isSecureContext&&navigator.serviceWorker){
    navigator.serviceWorker.ready.then(async()=>{
      if(!navigator.serviceWorker.controller)await new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true}));
      // Саму панель сохраняет обычный runtime-кэш после активации worker.
      await fetch(new URL('./local-test-panel.js?v=2',location.href));
      await info();
    }).catch(()=>{});
  }
})();
