
/* =====================================================================
   Kitsune Offline & AI Center v2.0.0
   Static GitHub Pages architecture:
   app shell is same-origin and cached by SW;
   optional AI runtimes/models are loaded only by explicit user action
   and kept by their browser/model caches.
   ===================================================================== */
(() => {
  "use strict";

  const VERSION=window.KITSUNE_APP_VERSION||"2.0.0";
  let lastStatus=null;

  function esc(s){
    return String(s??"").replace(/[&<>"']/g,c=>({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
    }[c]));
  }
  function fmtBytes(n){
    n=Number(n)||0;
    if(n<1024)return `${n} B`;
    if(n<1024**2)return `${(n/1024).toFixed(1)} KB`;
    if(n<1024**3)return `${(n/1024**2).toFixed(1)} MB`;
    return `${(n/1024**3).toFixed(2)} GB`;
  }
  async function cacheStatus(){
    let keys=[];
    try{keys=await caches.keys()}catch(e){}
    const release=keys.find(k=>k===`algebra8-v${VERSION}`)||keys.find(k=>k.startsWith("algebra8-v"))||"";
    const ai=keys.find(k=>k.startsWith("algebra8-ai-runtime-"))||"";
    let shell=false;
    try{
      shell=!!(await caches.match("./index.html",{ignoreSearch:true}));
    }catch(e){}
    return {keys,release,ai,shell};
  }
  async function storageStatus(){
    let estimate={usage:0,quota:0},persisted=null;
    try{estimate=await navigator.storage?.estimate?.()||estimate}catch(e){}
    try{persisted=await navigator.storage?.persisted?.()}catch(e){}
    return {...estimate,persisted};
  }
  async function brainStatus(){
    const api=window.KitsuneBrain;
    if(!api)return {available:false};
    let cached=false;
    try{cached=await api.checkCached?.()}catch(e){cached=!!api.isReady?.()}
    return {
      available:true,cached,
      marker:!!api.isReady?.(),
      mode:api.mode?.()||"",
      model:api.modelId||""
    };
  }
  async function whisperStatus(){
    const api=window.KitsuneVoiceDialogue;
    if(!api)return {available:false};
    let s={};
    try{s=api.status?.()||{}}catch(e){}
    return {
      available:true,
      ready:!!api.isReady?.(),
      cachedMarker:!!s.cachedMarker,
      runtimeReady:!!s.runtimeReady,
      backend:s.backend||"",
      model:api.model||""
    };
  }
  async function neuralStatus(){
    const api=window.AlfiNeuralVoice;
    if(!api)return {available:false};
    let verified=false;
    try{verified=!!(await api.verify?.())}catch(e){verified=!!api.isReady?.()}
    return {
      available:true,
      ready:!!api.isReady?.(),
      verified,
      mode:api.mode?.()||"",
      voiceId:api.voiceId||"",
      actual:api.actualEngine?.()||null
    };
  }
  async function status(){
    const [cache,storage,brain,whisper,neural]=await Promise.all([
      cacheStatus(),storageStatus(),brainStatus(),whisperStatus(),neuralStatus()
    ]);
    lastStatus={
      online:navigator.onLine,
      controlled:!!navigator.serviceWorker?.controller,
      secure:!!window.isSecureContext,
      cache,storage,brain,whisper,neural
    };
    return lastStatus;
  }

  function dot(ok,warn=false){return `<span class="ko-dot ${ok?"ok":warn?"warn":"off"}">●</span>`}
  function statusCard(title,icon,ok,detail,action="",button=""){
    return `<article class="ko-card">
      <div class="ko-card-head"><span>${icon}</span><div><b>${esc(title)}</b><small>${detail}</small></div>${dot(ok,!ok)}</div>
      ${action&&button?`<button class="secondary" id="${action}">${button}</button>`:""}
    </article>`;
  }
  function storageHtml(s){
    const pct=s.quota?Math.round((s.usage/s.quota)*100):0;
    return `<div class="ko-storage">
      <div><span>Использовано браузером</span><b>${fmtBytes(s.usage)} / ${fmtBytes(s.quota)}</b></div>
      <i><em style="width:${Math.min(100,pct)}%"></em></i>
      <small>${s.persisted===true?"✅ Постоянное хранилище разрешено":s.persisted===false?"Хранилище может очищаться системой при нехватке места":"Статус persistent storage недоступен"}</small>
    </div>`;
  }

  async function bodyHtml(){
    const s=await status();
    const b=s.brain,w=s.whisper,n=s.neural,c=s.cache;
    return `
      <div class="ko-summary">
        <div>${dot(s.secure)}<span>HTTPS / secure context</span></div>
        <div>${dot(s.controlled)}<span>Service Worker</span></div>
        <div>${dot(c.shell)}<span>App shell offline</span></div>
        <div>${dot(s.online)}<span>${s.online?"Интернет доступен":"Сейчас офлайн"}</span></div>
      </div>

      <section class="ko-grid">
        ${statusCard("Приложение","📦",c.shell,
          c.shell?`Кэш ${esc(c.release||"активен")}`:"App shell ещё не подтверждён в CacheStorage",
          "koCheckOffline","Проверить офлайн")}
        ${statusCard("Kitsune Brain","🧠",b.cached,
          !b.available?"API Brain не загружен":b.cached?`Модель найдена в локальном кэше · ${esc(b.mode)}`:"Модель Brain ещё не подготовлена",
          "koPrepareBrain",b.cached?"Проверить Brain":"Подготовить Brain")}
        ${statusCard("Whisper","🎙️",w.cachedMarker||w.runtimeReady,
          !w.available?"Voice Dialogue API не загружен":w.runtimeReady?`Runtime активен · ${esc(w.backend||"локально")}`:w.cachedMarker?"Модель отмечена как подготовленная":"Whisper ещё не подготовлен",
          "koPrepareWhisper",w.cachedMarker||w.runtimeReady?"Загрузить из кэша":"Подготовить Whisper")}
        ${statusCard("Neural Voice","🔊",n.verified,
          !n.available?"Neural Voice API не загружен":n.verified?`Модель ${esc(n.voiceId)} найдена локально`:n.ready?"Есть marker, нужна проверка модели":"Neural Voice ещё не скачан",
          "koPrepareNeural",n.verified?"Тест нейроголоса":"Скачать Neural Voice")}
      </section>

      <section class="ko-actions glass-panel">
        <div>
          <span class="eyebrow">Production Offline</span>
          <h3>Подготовить устройство к автономной работе</h3>
          <p>Курс, Math Engine, Generator, Tutor Intelligence и интерфейс уже обслуживаются только GitHub Pages. Brain, Whisper и Neural Voice — тяжёлые опциональные модели: они загружаются только после явной команды и затем используют локальные кэши браузера.</p>
        </div>
        <div class="ml-actions">
          <button class="primary glow-btn" id="koPrepareAll">📴 Подготовить AI для офлайна</button>
          <button class="secondary" id="koPersist">💾 Защитить локальное хранилище</button>
          <button class="secondary" id="koReleaseRam">🧹 Освободить RAM</button>
          <button class="secondary" id="koUpdate">🔄 Проверить обновление</button>
        </div>
        <div id="koActionStatus"></div>
      </section>

      <section class="ko-info-grid">
        <article class="glass-panel ko-info">
          <span class="eyebrow">Хранилище</span>
          <h3>Локальные данные и модели</h3>
          ${storageHtml(s.storage)}
          <button class="secondary" id="koRefresh">↻ Обновить статус</button>
        </article>
        <article class="glass-panel ko-info">
          <span class="eyebrow">GitHub Pages</span>
          <h3>Без backend</h3>
          <p>Вся прикладная логика — HTML/CSS/JS, Web Workers, Service Worker и локальные данные. Сервер приложению не требуется. Внешняя сеть нужна только при первом скачивании выбранных AI runtime/model файлов.</p>
          <div class="ko-network-note">
            <b>Runtime/model источники при первой подготовке:</b>
            <span>jsDelivr · Hugging Face/model storage</span>
            <small>Учебные ответы, прогресс, история ошибок, голосовые записи и Math Lab туда не отправляются как учебный backend.</small>
          </div>
        </article>
      </section>`;
  }

  async function render(){
    const content=document.querySelector("#content");if(!content)return;
    document.querySelector("#pageTitle").textContent="Офлайн и AI";
    document.querySelectorAll(".nav-btn").forEach(b=>b.classList.toggle("active",b.dataset.view==="offline"));
    content.innerHTML=`
      <section class="ko-hero glass-panel reveal">
        <div><span class="eyebrow">GitHub Pages Production · v${VERSION}</span><h2>📴 Офлайн и AI</h2>
        <p>Проверка PWA, локальных моделей и памяти устройства без собственного сервера.</p></div>
        <div class="ko-refreshing" id="koLoading">Проверяю…</div>
      </section>
      <div id="koBody"><div class="ml-loading">⚙ Проверяю локальные кэши…</div></div>`;
    const host=document.querySelector("#koBody");
    host.innerHTML=await bodyHtml();
    document.querySelector("#koLoading")?.remove();
    bind();
  }

  function setAction(text,kind=""){
    const h=document.querySelector("#koActionStatus");
    if(!h)return;
    h.innerHTML=`<div class="${kind==="error"?"ml-error":kind==="ok"?"ml-success":"ml-loading"}">${esc(text)}</div>`;
  }
  async function refresh(){
    const host=document.querySelector("#koBody");
    if(!host)return;
    host.innerHTML=`<div class="ml-loading">⚙ Обновляю статус…</div>`;
    host.innerHTML=await bodyHtml();
    bind();
  }
  async function prepareAll(){
    if(!navigator.onLine){
      setAction("Сейчас нет сети. Уже загруженные компоненты продолжат работать, но новые модели скачать нельзя.","error");
      return;
    }
    if(!confirm("Подготовить Brain, Whisper и Neural Voice для автономной работы? Это может скачать несколько сотен мегабайт и занять заметное время."))return;
    try{
      setAction("1/3 · Подготавливаю Kitsune Brain…");
      await window.KitsuneBrain?.prepare?.();
      setAction("2/3 · Подготавливаю Whisper…");
      await window.KitsuneVoiceDialogue?.prepare?.();
      setAction("3/3 · Подготавливаю Neural Voice…");
      await window.AlfiNeuralVoice?.download?.();
      setAction("✅ Подготовка завершена. Проверяю локальные кэши…","ok");
      await requestPersist(false);
      setTimeout(refresh,500);
    }catch(e){
      setAction("Подготовка остановлена: "+String(e?.message||e).slice(0,180),"error");
    }
  }
  async function requestPersist(show=true){
    if(!navigator.storage?.persist){
      if(show)setAction("Этот браузер не предоставляет API persistent storage.","error");
      return false;
    }
    try{
      const ok=await navigator.storage.persist();
      if(show)setAction(ok?"✅ Браузер разрешил постоянное локальное хранилище.":"Браузер не выдал persistent storage. Данные всё равно остаются локальными, но система может очистить их при нехватке места.",ok?"ok":"");
      return ok;
    }catch(e){
      if(show)setAction("Не удалось запросить persistent storage.","error");
      return false;
    }
  }
  async function releaseRam(){
    setAction("Освобождаю оперативную память, не удаляя модели…");
    try{
      await window.KitsuneBrain?.release?.();
      await window.KitsuneVoiceDialogue?.release?.();
      await window.AlfiNeuralVoice?.release?.();
      window.KitsuneMath?.terminate?.();
      setAction("✅ Тяжёлые runtime выгружены из RAM. Локальные модели и прогресс сохранены.","ok");
      setTimeout(refresh,500);
    }catch(e){setAction("Не всё удалось выгрузить: "+String(e?.message||e),"error")}
  }
  async function offlineProbe(){
    try{
      const match=await caches.match("./index.html",{ignoreSearch:true});
      if(match)setAction("✅ App shell найден в CacheStorage. Курс и математическое ядро готовы к запуску без сети.","ok");
      else setAction("App shell не найден в CacheStorage. Открой приложение онлайн ещё раз и дождись установки Service Worker.","error");
    }catch(e){setAction("CacheStorage недоступен в этом контексте.","error")}
  }
  function bind(){
    document.querySelector("#koRefresh")?.addEventListener("click",refresh);
    document.querySelector("#koCheckOffline")?.addEventListener("click",offlineProbe);
    document.querySelector("#koPrepareAll")?.addEventListener("click",prepareAll);
    document.querySelector("#koPersist")?.addEventListener("click",()=>requestPersist(true));
    document.querySelector("#koReleaseRam")?.addEventListener("click",releaseRam);
    document.querySelector("#koUpdate")?.addEventListener("click",()=>window.KitsunePWAUpdate?.check?.());
    document.querySelector("#koPrepareBrain")?.addEventListener("click",async()=>{
      setAction("Подготавливаю Brain…");
      try{await window.KitsuneBrain?.prepare?.();setAction("✅ Brain готов.","ok");setTimeout(refresh,400)}
      catch(e){setAction(String(e?.message||e),"error")}
    });
    document.querySelector("#koPrepareWhisper")?.addEventListener("click",async()=>{
      setAction("Подготавливаю Whisper…");
      try{await window.KitsuneVoiceDialogue?.prepare?.();setAction("✅ Whisper готов.","ok");setTimeout(refresh,400)}
      catch(e){setAction(String(e?.message||e),"error")}
    });
    document.querySelector("#koPrepareNeural")?.addEventListener("click",async()=>{
      setAction("Подготавливаю Neural Voice…");
      try{
        if(window.AlfiNeuralVoice?.isReady?.())await window.AlfiNeuralVoice?.test?.();
        else await window.AlfiNeuralVoice?.download?.();
        setAction("✅ Neural Voice подготовлен/проверен.","ok");setTimeout(refresh,400)
      }catch(e){setAction(String(e?.message||e),"error")}
    });
  }

  window.KitsuneOffline={version:VERSION,status,render,refresh,releaseRam,prepareAll};
})();
