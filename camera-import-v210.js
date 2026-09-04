
/* =====================================================================
   Kitsune Camera Homework Import v2.2.3
   Explicit permission -> capture/photo -> local OCR -> editable preview -> DЗ.
   Camera is NEVER requested until the user presses the camera button.
   ===================================================================== */
(() => {
  "use strict";

  const VERSION=window.KITSUNE_APP_VERSION||"2.2.3";
  const TESS_URL="https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";
  const OCR_READY_KEY="a8_camera_ocr_ready_v210";

  let stream=null;
  let worker=null;
  let workerPromise=null;
  let capturedBlob=null;
  let modal=null;
  let statusEl=null;
  let progressEl=null;

  function esc(s){
    return String(s??"").replace(/[&<>"']/g,c=>({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
    }[c]));
  }
  function setStatus(text,kind=""){
    if(!statusEl)return;
    statusEl.textContent=text;
    statusEl.className=`kcam-status ${kind}`.trim();
  }
  function setProgress(v){
    if(!progressEl)return;
    if(v===null){progressEl.style.width="0%";progressEl.parentElement.hidden=true;return}
    progressEl.parentElement.hidden=false;
    progressEl.style.width=`${Math.max(0,Math.min(100,Number(v)||0))}%`;
  }
  function isSecure(){
    return window.isSecureContext&&location.protocol!=="file:";
  }

  function loadScript(){
    if(window.Tesseract?.createWorker)return Promise.resolve(window.Tesseract);
    if(window.__kitsuneTesseractPromise)return window.__kitsuneTesseractPromise;
    window.__kitsuneTesseractPromise=new Promise((resolve,reject)=>{
      const existing=document.querySelector('script[data-kitsune-tesseract]');
      if(existing){
        existing.addEventListener("load",()=>resolve(window.Tesseract),{once:true});
        existing.addEventListener("error",()=>reject(new Error("OCR runtime не загрузился.")),{once:true});
        return;
      }
      const s=document.createElement("script");
      s.src=TESS_URL;
      s.async=true;
      s.crossOrigin="anonymous";
      s.dataset.kitsuneTesseract="1";
      s.onload=()=>window.Tesseract?.createWorker?resolve(window.Tesseract):reject(new Error("Tesseract API не найден."));
      s.onerror=()=>reject(new Error("Не удалось загрузить локальный OCR runtime."));
      document.head.appendChild(s);
    });
    return window.__kitsuneTesseractPromise;
  }

  async function ensureWorker({announce=true}={}){
    if(worker)return worker;
    if(workerPromise)return workerPromise;
    workerPromise=(async()=>{
      const T=await loadScript();
      if(announce)setStatus("Подготавливаю локальное распознавание русского текста…","busy");
      worker=await T.createWorker("rus+eng",1,{
        logger:m=>{
          const p=Number(m?.progress);
          if(Number.isFinite(p))setProgress(p*100);
          if(announce&&m?.status)setStatus("OCR: "+String(m.status).replace(/_/g," "),"busy");
        }
      });
      try{localStorage.setItem(OCR_READY_KEY,"1")}catch(e){}
      setProgress(null);
      if(announce)setStatus("✅ Локальное распознавание готово.","ok");
      return worker;
    })();
    try{return await workerPromise}
    catch(e){worker=null;throw e}
    finally{workerPromise=null}
  }

  async function prepareOCR({keepWorker=false,silent=true}={}){
    try{
      await ensureWorker({announce:!silent});
      if(!keepWorker)await releaseOCR();
      return true;
    }catch(e){
      if(!silent)setStatus("OCR не подготовился: "+String(e?.message||e).slice(0,160),"warn");
      return false;
    }
  }

  async function releaseOCR(){
    try{await worker?.terminate?.()}catch(e){}
    worker=null;workerPromise=null;
    return true;
  }

  function cleanOCR(text){
    return String(text||"")
      .replace(/\r/g,"")
      .replace(/[‐‑‒–—]/g,"−")
      .replace(/[“”«»]/g,'"')
      .replace(/[ \t]+/g," ")
      .replace(/\n{3,}/g,"\n\n")
      .split("\n")
      .map(x=>x.trim())
      .filter(Boolean)
      .join("\n");
  }

  function ensureModal(){
    if(modal)return modal;
    document.body.insertAdjacentHTML("beforeend",`
      <div class="kcam-backdrop" id="kcamBackdrop" aria-hidden="true">
        <section class="kcam-modal" role="dialog" aria-modal="true" aria-labelledby="kcamTitle">
          <div class="kcam-head">
            <div><span class="eyebrow">Camera Import · v${VERSION}</span><h2 id="kcamTitle">📷 Перенести задания в ДЗ</h2></div>
            <button class="kcam-close" id="kcamClose" aria-label="Закрыть">×</button>
          </div>

          <div class="kcam-privacy">
            <b>🔒 Камера включается только после подтверждения.</b>
            <span>Снимок обрабатывается на этом устройстве. Перед добавлением в ДЗ распознанный текст обязательно можно проверить и исправить.</span>
          </div>

          <div class="kcam-stage" id="kcamStage">
            <video id="kcamVideo" playsinline muted></video>
            <img id="kcamImage" alt="Снятая страница" hidden>
            <canvas id="kcamCanvas" hidden></canvas>
          </div>

          <div class="kcam-actions">
            <button class="primary" id="kcamStart">Разрешить камеру</button>
            <button class="secondary" id="kcamCapture" hidden>📸 Сфотографировать</button>
            <label class="secondary kcam-file">🖼️ Выбрать фото<input id="kcamFile" type="file" accept="image/*" capture="environment" hidden></label>
            <button class="secondary" id="kcamRetake" hidden>↻ Переснять</button>
          </div>

          <div class="kcam-progress" hidden><i id="kcamProgress"></i></div>
          <div class="kcam-status" id="kcamStatus">Камера пока выключена.</div>

          <div class="kcam-result" id="kcamResult" hidden>
            <label>Распознанный текст — проверь перед добавлением
              <textarea id="kcamText" class="ml-textarea" rows="9" placeholder="Здесь появятся распознанные задания"></textarea>
            </label>
            <div class="kcam-warning">OCR хорошо читает печатный текст, но математические формулы могут потребовать ручной правки. Ничего не добавляется автоматически.</div>
            <div class="ml-actions">
              <button class="primary glow-btn" id="kcamAdd">📚 Добавить в Homework Studio</button>
              <button class="secondary" id="kcamRecognizeAgain">🔎 Распознать ещё раз</button>
            </div>
          </div>
        </section>
      </div>
    `);
    modal=document.querySelector("#kcamBackdrop");
    statusEl=document.querySelector("#kcamStatus");
    progressEl=document.querySelector("#kcamProgress");

    document.querySelector("#kcamClose")?.addEventListener("click",close);
    modal?.addEventListener("pointerdown",e=>{if(e.target===modal)close()});
    document.querySelector("#kcamStart")?.addEventListener("click",requestCamera);
    document.querySelector("#kcamCapture")?.addEventListener("click",capture);
    document.querySelector("#kcamRetake")?.addEventListener("click",retake);
    document.querySelector("#kcamFile")?.addEventListener("change",e=>{
      const f=e.target.files?.[0];
      if(f)useImageBlob(f);
      e.target.value="";
    });
    document.querySelector("#kcamRecognizeAgain")?.addEventListener("click",recognize);
    document.querySelector("#kcamAdd")?.addEventListener("click",addToHomework);
    document.addEventListener("visibilitychange",()=>{if(document.hidden)stopCamera()});
    window.addEventListener("pagehide",stopCamera);
    return modal;
  }

  function open(){
    ensureModal();
    modal.classList.add("open");
    modal.setAttribute("aria-hidden","false");
    document.body.classList.add("kcam-open");
    setStatus("Камера выключена. Нажми «Разрешить камеру» или выбери готовое фото.","");
    document.querySelector("#kcamResult").hidden=true;
    document.querySelector("#kcamStart").hidden=false;
    document.querySelector("#kcamCapture").hidden=true;
    document.querySelector("#kcamRetake").hidden=true;
  }
  function close(){
    stopCamera();
    capturedBlob=null;
    setProgress(null);
    modal?.classList.remove("open");
    modal?.setAttribute("aria-hidden","true");
    document.body.classList.remove("kcam-open");
  }

  async function requestCamera(){
    if(!isSecure()){
      setStatus("Камера доступна только через HTTPS / установленное PWA.","warn");
      return;
    }
    const ok=confirm("Разрешить Kitsune включить камеру только для снимка задания? Снимок останется на устройстве и не будет отправлен на учебный сервер.");
    if(!ok)return;
    try{
      stopCamera();
      stream=await navigator.mediaDevices.getUserMedia({
        video:{facingMode:{ideal:"environment"},width:{ideal:1920},height:{ideal:1080}},
        audio:false
      });
      const v=document.querySelector("#kcamVideo");
      v.hidden=false;
      document.querySelector("#kcamImage").hidden=true;
      v.srcObject=stream;
      await v.play();
      document.querySelector("#kcamStart").hidden=true;
      document.querySelector("#kcamCapture").hidden=false;
      document.querySelector("#kcamRetake").hidden=true;
      setStatus("✅ Камера включена только для этого окна. Наведи на задания и сфотографируй.","ok");
    }catch(e){
      setStatus("Камера не открылась. Можно выбрать фото из галереи. "+String(e?.message||"").slice(0,100),"warn");
    }
  }

  function stopCamera(){
    try{stream?.getTracks()?.forEach(t=>t.stop())}catch(e){}
    stream=null;
    const v=document.querySelector("#kcamVideo");
    if(v){try{v.pause()}catch(e){};v.srcObject=null}
  }

  async function capture(){
    const v=document.querySelector("#kcamVideo");
    if(!v?.videoWidth)return;
    const c=document.querySelector("#kcamCanvas");
    c.width=v.videoWidth;c.height=v.videoHeight;
    c.getContext("2d").drawImage(v,0,0,c.width,c.height);
    const blob=await new Promise(resolve=>c.toBlob(resolve,"image/jpeg",.9));
    stopCamera();
    if(blob)await useImageBlob(blob);
  }

  async function useImageBlob(blob){
    capturedBlob=blob;
    stopCamera();
    const img=document.querySelector("#kcamImage");
    const v=document.querySelector("#kcamVideo");
    if(v)v.hidden=true;
    img.hidden=false;
    const url=URL.createObjectURL(blob);
    img.onload=()=>setTimeout(()=>URL.revokeObjectURL(url),500);
    img.src=url;
    document.querySelector("#kcamStart").hidden=true;
    document.querySelector("#kcamCapture").hidden=true;
    document.querySelector("#kcamRetake").hidden=false;
    document.querySelector("#kcamResult").hidden=true;
    await recognize();
  }

  function retake(){
    capturedBlob=null;
    document.querySelector("#kcamImage").hidden=true;
    document.querySelector("#kcamResult").hidden=true;
    document.querySelector("#kcamRetake").hidden=true;
    document.querySelector("#kcamStart").hidden=false;
    setStatus("Можно снова включить камеру или выбрать другое фото.","");
  }

  async function recognize(){
    if(!capturedBlob){setStatus("Сначала сфотографируй или выбери изображение.","warn");return}
    try{
      setStatus("Локальный OCR анализирует снимок…","busy");
      const w=await ensureWorker({announce:true});
      const {data}=await w.recognize(capturedBlob);
      const text=cleanOCR(data?.text||"");
      const box=document.querySelector("#kcamText");
      box.value=text;
      document.querySelector("#kcamResult").hidden=false;
      setStatus(text?"✅ Текст распознан. Проверь формулы и нажми «Добавить в Homework Studio».":"Текст не распознан. Попробуй сфотографировать ближе и без бликов.",text?"ok":"warn");
    }catch(e){
      setStatus("Не удалось распознать снимок: "+String(e?.message||e).slice(0,160),"warn");
    }finally{setProgress(null)}
  }

  function addToHomework(){
    const text=document.querySelector("#kcamText")?.value.trim();
    if(!text){setStatus("Поле распознанного текста пустое.","warn");return}
    window.KitsuneMathLab?.addHomework?.(text);
    setStatus("✅ Задания добавлены в Homework Studio. Проверь их там перед решением.","ok");
    setTimeout(close,700);
  }

  function injectButtons(){
    const add=document.querySelector(".ml-homework-add");
    if(add&&!document.querySelector("#kcamHomeworkBtn")){
      const b=document.createElement("button");
      b.id="kcamHomeworkBtn";b.className="secondary";b.textContent="📷 Из учебника";
      b.addEventListener("click",open);
      add.appendChild(b);
    }
  }

  const observer=new MutationObserver(()=>injectButtons());
  observer.observe(document.documentElement,{subtree:true,childList:true});
  injectButtons();

  window.KitsuneCameraImport={
    version:VERSION,
    open,
    close,
    prepareOCR,
    releaseOCR,
    isPrepared:()=>localStorage.getItem(OCR_READY_KEY)==="1"
  };
})();
