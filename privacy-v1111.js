
/* =====================================================================
   v1.11.1 · CHILD SAFETY / PRIVACY UI
   ===================================================================== */
(() => {
  "use strict";

  const VERSION=window.KITSUNE_APP_VERSION||document.querySelector('meta[name="kitsune-app-version"]')?.content||"1.15.0";
  const FIRST_SEEN_KEY="a8_child_safety_seen_v1111";

  const PRIVATE_KEYS=[
    "a8_kitsune_dialog_history_v19",
    "a8_kitsune_brain_memory",
    "a8_tutor_memory_v16",
    "a8_tutor_help_v16"
  ];


  function html(){
    return `
      <div class="v1111-privacy-backdrop" id="v1111Privacy" aria-hidden="true">
        <section class="v1111-privacy-card" role="dialog" aria-modal="true" aria-labelledby="v1111PrivacyTitle">
          <header class="v1111-privacy-head">
            <div class="v1111-shield">🔒</div>
            <div>
              <strong id="v1111PrivacyTitle">Приватность и безопасность</strong>
              <small>Kitsune · режим защиты ребёнка · v${VERSION}</small>
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
              <div><b>Диалог с Kitsune</b><small>Текст разговора хранится только в этом браузере и не отправляется во внешние аналитические сервисы.</small></div>
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

          <section class="v1111-local-only-box">
            <div>
              <b>🛡 Без внешней аналитики</b>
              <small>Kitsune не отправляет статистику использования, ответы, прогресс, чат или голос во внешние аналитические сервисы.</small>
            </div>
          </section>

          <section class="v1111-network-box">
            <b>🌐 Когда курс обращается в интернет</b>
            <p><strong>GitHub Pages</strong> — сам курс. <strong>jsDelivr / Hugging Face</strong> — только для загрузки локальных AI-runtime и моделей по явному действию пользователя. Внешняя аналитика отключена полностью.</p>
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
    root.querySelector("#v1111ClearPrivate")?.addEventListener("click",clearPrivateMemory);

    return root;
  }

  function markSeen(){
    try{localStorage.setItem(FIRST_SEEN_KEY,"1")}catch(e){}
  }

  function open(){
    const root=ensure();
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
    close
  };

  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",bind,{once:true});
  }else{
    bind();
  }
})();
