
/* =====================================================================
   v1.15.0 · KITSUNE PWA UPDATE MANAGER
   One install, future releases are downloaded in background and activated
   only after the user presses "Обновить сейчас".
   ===================================================================== */
(() => {
  "use strict";

  const VERSION=window.KITSUNE_APP_VERSION||document.querySelector('meta[name="kitsune-app-version"]')?.content||"1.15.0";
  const UPDATE_CHECK_MS=15*60*1000;
  const VISIBILITY_CHECK_MS=5*60*1000;
  const JUST_UPDATED_KEY="a8_pwa_just_updated";
  const UPDATE_APPLYING_KEY="a8_pwa_update_applying";

  let justUpdated=false;
  try{justUpdated=sessionStorage.getItem(JUST_UPDATED_KEY)==="1"}catch(e){}
  window.KITSUNE_JUST_UPDATED=justUpdated;

  let registration=null;
  let waitingWorker=null;
  let applying=false;
  let reloading=false;
  let lastCheck=0;
  let checking=false;
  let dismissedThisSession=false;

  function updateBtn(){
    return document.querySelector("#updateBtn");
  }

  function setButton(text,state=""){
    const btn=updateBtn();
    if(!btn)return;
    btn.textContent=text;
    btn.dataset.updateState=state;
    btn.classList.toggle("pwa-update-available",state==="available");
    btn.classList.toggle("pwa-update-checking",state==="checking"||state==="applying");
  }

  function ensureUi(){
    let banner=document.querySelector("#pwaUpdateBanner");
    if(!banner){
      document.body.insertAdjacentHTML("beforeend",`
        <aside class="pwa-update-banner" id="pwaUpdateBanner" aria-live="polite" aria-hidden="true">
          <div class="pwa-update-icon">🦊</div>
          <div class="pwa-update-copy">
            <strong>Доступно обновление Kitsune</strong>
            <span>Новая версия уже загружена. Прогресс и локальные данные сохранятся.</span>
          </div>
          <div class="pwa-update-actions">
            <button type="button" class="pwa-update-later" id="pwaUpdateLater">Позже</button>
            <button type="button" class="pwa-update-now" id="pwaUpdateNow">Обновить сейчас</button>
          </div>
        </aside>
        <div class="pwa-update-toast" id="pwaUpdateToast" role="status" aria-live="polite"></div>
      `);

      banner=document.querySelector("#pwaUpdateBanner");
      document.querySelector("#pwaUpdateLater")?.addEventListener("click",()=>{
        dismissedThisSession=true;
        hideBanner();
      });
      document.querySelector("#pwaUpdateNow")?.addEventListener("click",applyUpdate);
    }
    return banner;
  }

  function showToast(text,kind=""){
    ensureUi();
    const toast=document.querySelector("#pwaUpdateToast");
    if(!toast)return;
    toast.textContent=text;
    toast.className=`pwa-update-toast show ${kind}`.trim();
    clearTimeout(showToast.timer);
    showToast.timer=setTimeout(()=>{
      toast.classList.remove("show");
    },3600);
  }

  function showBanner(force=false){
    ensureUi();
    if(dismissedThisSession&&!force)return;
    const banner=document.querySelector("#pwaUpdateBanner");
    banner?.classList.add("show");
    banner?.setAttribute("aria-hidden","false");
  }

  function hideBanner(){
    const banner=document.querySelector("#pwaUpdateBanner");
    banner?.classList.remove("show");
    banner?.setAttribute("aria-hidden","true");
  }

  function markUpdateAvailable(worker=null){
    waitingWorker=worker||registration?.waiting||waitingWorker;
    setButton("🆕 Обновление доступно","available");
    showBanner();
  }

  function workerInstalled(worker){
    if(!worker)return;
    if(worker.state==="installed"&&navigator.serviceWorker.controller){
      markUpdateAvailable(registration?.waiting||worker);
    }
  }

  function watchRegistration(reg){
    registration=reg;

    if(reg.waiting&&navigator.serviceWorker.controller){
      markUpdateAvailable(reg.waiting);
    }

    reg.addEventListener("updatefound",()=>{
      const worker=reg.installing;
      if(!worker)return;
      worker.addEventListener("statechange",()=>workerInstalled(worker));
    });
  }

  async function checkForUpdate({manual=false}={}){
    if(!registration||checking)return false;
    if(!navigator.onLine){
      if(manual)showToast("Сейчас нет сети. Проверю обновления позже.","warn");
      return false;
    }

    checking=true;
    lastCheck=Date.now();
    if(!registration.waiting)setButton("🔄 Проверяю обновления…","checking");

    try{
      await registration.update();

      /* Give updatefound/statechange a short moment to surface a waiting worker. */
      await new Promise(r=>setTimeout(r,350));

      if(registration.waiting){
        markUpdateAvailable(registration.waiting);
        if(manual)showBanner(true);
        return true;
      }

      if(!waitingWorker){
        setButton(`✅ v${VERSION} · актуально`,"current");
        if(manual)showToast(`Установлена последняя версия — v${VERSION}.`,"ok");
      }
      return false;
    }catch(err){
      setButton(`🔄 v${VERSION} · проверить`,"");
      if(manual)showToast("Не удалось проверить обновление. Попробуй чуть позже.","warn");
      console.warn("[Kitsune Update]",err);
      return false;
    }finally{
      checking=false;
    }
  }

  function applyUpdate(){
    const worker=registration?.waiting||waitingWorker;
    if(!worker){
      hideBanner();
      checkForUpdate({manual:true});
      return;
    }
    if(applying)return;

    applying=true;
    hideBanner();
    setButton("⏳ Обновляю Kitsune…","applying");
    showToast("Обновление готово. Перезапускаю приложение…","ok");

    try{
      sessionStorage.setItem(UPDATE_APPLYING_KEY,"1");
    }catch(e){}

    worker.postMessage({type:"SKIP_WAITING"});
  }

  async function register(){
    if(!("serviceWorker" in navigator)){
      setButton(`v${VERSION} · без PWA`,"");
      return;
    }

    setButton(`🔄 v${VERSION} · проверка…`,"checking");

    try{
      let reg;
      try{
        reg=await navigator.serviceWorker.register("./sw.js",{updateViaCache:"none"});
      }catch(e){
        reg=await navigator.serviceWorker.register("./sw.js");
      }

      watchRegistration(reg);

      if(!reg.waiting){
        setButton(`✅ v${VERSION} · актуально`,"current");
      }

      /* Force a network check shortly after launch instead of relying only
         on the browser's service-worker update schedule. */
      setTimeout(()=>checkForUpdate(),900);
    }catch(err){
      setButton(`🔄 v${VERSION} · проверить`,"");
      console.warn("[Kitsune Update] registration failed",err);
    }
  }

  navigator.serviceWorker?.addEventListener("controllerchange",()=>{
    if(!applying)return;
    if(reloading)return;
    reloading=true;
    try{
      sessionStorage.removeItem(UPDATE_APPLYING_KEY);
      sessionStorage.setItem(JUST_UPDATED_KEY,"1");
    }catch(e){}
    location.reload();
  });

  function bind(){
    ensureUi();

    updateBtn()?.addEventListener("click",()=>{
      if(registration?.waiting||waitingWorker){
        showBanner(true);
      }else{
        checkForUpdate({manual:true});
      }
    });

    document.addEventListener("visibilitychange",()=>{
      if(document.visibilityState!=="visible")return;
      if(Date.now()-lastCheck>=VISIBILITY_CHECK_MS){
        checkForUpdate();
      }
    });

    window.addEventListener("online",()=>{
      if(Date.now()-lastCheck>=VISIBILITY_CHECK_MS)checkForUpdate();
    });

    setInterval(()=>{
      if(document.visibilityState==="visible")checkForUpdate();
    },UPDATE_CHECK_MS);

    try{
      if(justUpdated){
        /* Brain/Whisper listeners use this event to restore already-downloaded
           local models into RAM after the Service Worker reload. */
        window.dispatchEvent(new CustomEvent("kitsune-pwa-updated",{
          detail:{version:VERSION}
        }));
        sessionStorage.removeItem(JUST_UPDATED_KEY);
        setTimeout(()=>showToast(`✅ Kitsune обновлена до v${VERSION}.`,"ok"),650);
      }
    }catch(e){}

    register();
  }

  window.KitsunePWAUpdate={
    version:VERSION,
    check:()=>checkForUpdate({manual:true}),
    apply:applyUpdate,
    get registration(){return registration}
  };

  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",bind,{once:true});
  }else{
    bind();
  }
})();
