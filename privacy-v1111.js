
/* =====================================================================
   v1.11.1 · CHILD SAFETY / PRIVACY UI
   ===================================================================== */
(() => {
  "use strict";

  const VERSION="1.11.2";
  const CONSENT_KEY="a8_analytics_consent_v1111";
  const FIRST_SEEN_KEY="a8_child_safety_seen_v1111";

  const PRIVATE_KEYS=[
    "a8_kitsune_dialog_history_v19",
    "a8_kitsune_brain_memory",
    "a8_tutor_memory_v16",
    "a8_tutor_help_v16"
  ];

  function analyticsStoredEnabled(){
    try{return localStorage.getItem(CONSENT_KEY)==="1"}catch(e){return false}
  }

  function html(){
    return `
      <div class="v1111-privacy-backdrop" id="v1111Privacy" aria-hidden="true">
        <section class="v1111-privacy-card" role="dialog" aria-modal="true" aria-labelledby="v1111PrivacyTitle">
          <header class="v1111-privacy-head">
            <div class="v1111-shield">🔒</div>
            <div>
              <strong id="v1111PrivacyTitle">Приватность и безопасность</strong>
              <small>Kitsune · режим защиты ребёнка · v1.11.2</small>
            </div>
            <button type="button" class="v1111-close" aria-label="Закрыть">×</button>
          </header>

          <div class="v1111-safety-status">
            <b>🛡️ Защита ребёнка включена</b>
            <span>Курс работает без регистрации. Учебные ответы, прогресс, голос и переписка не отправляются в аналитику.</span>
          </div>

          <div class="v1111-safety-grid">
            <article>
              <span>🎙️</span>
              <div><b>Микрофон</b><small>Только после нажатия. Запись останавливается сразу после реплики и обрабатывается локальным Whisper.</small></div>
            </article>
            <article>
              <span>💬</span>
              <div><b>Диалог с Kitsune</b><small>Текст разговора хранится только в этом браузере и не отправляется в Umami.</small></div>
            </article>
            <article>
              <span>📚</span>
              <div><b>Ответы и прогресс</b><small>Остаются в localStorage устройства. Нет профиля ребёнка, email или ФИО.</small></div>
            </article>
            <article>
              <span>🚫</span>
              <div><b>Лишние разрешения</b><small>Камера, геолокация, платежи и USB курсу не нужны и не запрашиваются. После активации PWA политика безопасности дополнительно запрещает их.</small></div>
            </article>
          </div>

          <section class="v1111-analytics-box">
            <div>
              <b>📊 Анонимная техническая статистика</b>
              <small>По умолчанию выключена. Включать её должен взрослый.</small>
            </div>
            <button type="button" class="v1111-toggle" id="v1111AnalyticsToggle" aria-pressed="false">
              <i></i><span>Выкл.</span>
            </button>
          </section>

          <div class="v1111-analytics-details">
            <b>Если взрослый включит статистику, Umami получит только:</b>
            <p>посещения, тип устройства/браузера/ОС и технические события вроде установки PWA или подготовки локальных моделей.</p>
            <b>Никогда не отправляем:</b>
            <p>ответы по алгебре, ошибки ученика, текст чата, распознанную речь, аудио, имя, email и локальный прогресс.</p>
          </div>

          <section class="v1111-network-box">
            <b>🌐 Когда курс обращается в интернет</b>
            <p><strong>GitHub Pages</strong> — сам курс. <strong>jsDelivr / Hugging Face</strong> — только после явного скачивания локальных AI-моделей. <strong>Umami</strong> — только если взрослый включил статистику.</p>
          </section>

          <div class="v1111-privacy-actions">
            <button type="button" class="v1111-danger-soft" id="v1111ClearPrivate">🧹 Удалить историю Kitsune</button>
            <button type="button" class="v1111-primary" id="v1111PrivacyOk">Понятно</button>
          </div>

          <p class="v1111-footnote">Все настройки хранятся локально на этом устройстве. Очистка данных сайта удалит их вместе с прогрессом и локальными моделями.</p>
        </section>
      </div>`;
  }

  function ensure(){
    let root=document.querySelector("#v1111Privacy");
    if(root)return root;
    document.body.insertAdjacentHTML("beforeend",html());
    root=document.querySelector("#v1111Privacy");

    root.querySelector(".v1111-close")?.addEventListener("click",close);
    root.querySelector("#v1111PrivacyOk")?.addEventListener("click",()=>{
      markSeen();close();
    });
    root.addEventListener("click",e=>{if(e.target===root)close()});
    root.querySelector("#v1111AnalyticsToggle")?.addEventListener("click",toggleAnalytics);
    root.querySelector("#v1111ClearPrivate")?.addEventListener("click",clearPrivateMemory);

    sync();
    return root;
  }

  function markSeen(){
    try{localStorage.setItem(FIRST_SEEN_KEY,"1")}catch(e){}
  }

  function open(){
    const root=ensure();
    sync();
    root.classList.add("show");
    root.setAttribute("aria-hidden","false");
    document.body.classList.add("v1111-privacy-open");
    setTimeout(()=>root.querySelector(".v1111-close")?.focus(),30);
  }

  function close(){
    const root=document.querySelector("#v1111Privacy");
    if(!root)return;
    root.classList.remove("show");
    root.setAttribute("aria-hidden","true");
    document.body.classList.remove("v1111-privacy-open");
  }

  function sync(){
    const btn=document.querySelector("#v1111AnalyticsToggle");
    if(!btn)return;

    const stored=analyticsStoredEnabled();
    const api=window.KitsuneAnalytics;
    const blocked=api?.privacySignalBlocks?.()||api?.ownerOptedOut?.();
    const enabled=stored&&!blocked;

    btn.classList.toggle("on",enabled);
    btn.setAttribute("aria-pressed",enabled?"true":"false");
    const span=btn.querySelector("span");
    if(span)span.textContent=enabled?"Вкл.":"Выкл.";

    if(blocked){
      btn.disabled=true;
      btn.title=api?.ownerOptedOut?.()
        ?"Это устройство владельца исключено из аналитики."
        :"Браузер запросил запрет отслеживания (DNT/GPC).";
    }else{
      btn.disabled=false;
      btn.title="";
    }

    const side=document.querySelector("#privacyBtn");
    if(side){
      side.textContent=enabled?"🔒 Приватность · статистика вкл.":"🔒 Приватность · защита";
    }
  }

  async function toggleAnalytics(){
    const currently=analyticsStoredEnabled();
    const next=!currently;

    if(next){
      const ok=confirm(
        "Включить анонимную техническую статистику?\n\n"+
        "Будут учитываться посещения, тип устройства и использование функций. "+
        "Ответы ребёнка, чат, голос и прогресс НЕ отправляются.\n\n"+
        "Включать эту настройку должен взрослый."
      );
      if(!ok)return;
    }

    if(window.KitsuneAnalytics?.setConsent){
      await window.KitsuneAnalytics.setConsent(next);
    }else{
      try{localStorage.setItem(CONSENT_KEY,next?"1":"0")}catch(e){}
    }
    sync();
  }

  function clearPrivateMemory(){
    const ok=confirm(
      "Удалить локальную историю общения с Kitsune и память её подсказок на этом устройстве?\n\n"+
      "Прогресс курса и скачанные AI-модели останутся."
    );
    if(!ok)return;

    try{PRIVATE_KEYS.forEach(k=>localStorage.removeItem(k))}catch(e){}
    alert("Локальная история Kitsune удалена.");
  }

  function bind(){
    document.querySelector("#privacyBtn")?.addEventListener("click",open);

    window.addEventListener("keydown",e=>{
      if(e.key==="Escape"&&document.querySelector("#v1111Privacy.show"))close();
    });

    ensure();
    sync();

    try{
      if(localStorage.getItem(FIRST_SEEN_KEY)!=="1"){
        setTimeout(open,900);
      }
    }catch(e){
      setTimeout(open,900);
    }
  }

  window.KitsunePrivacy={
    version:VERSION,
    open,
    close,
    sync,
    analyticsEnabled:analyticsStoredEnabled
  };

  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",bind,{once:true});
  }else{
    bind();
  }
})();
