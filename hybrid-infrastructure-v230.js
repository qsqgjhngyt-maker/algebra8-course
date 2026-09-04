/* =====================================================================
   Kitsune v2.3.0-alpha · Hybrid Intelligence infrastructure client

   Adult-only enrollment and connection diagnostics. This module does not
   route child conversations yet. Temporary Qwen credentials are memory-only.
   ===================================================================== */
(() => {
  "use strict";

  const VERSION="2.3.0-alpha";
  const DB_NAME="kitsune-hybrid-device-v230";
  const STORE="device";
  const CONSENT_KEY="a8_cloud_brain_parent_consent_v230";
  const config=Object.freeze({...window.KITSUNE_HYBRID_CONFIG});
  const state={
    broker:"unknown",
    google:"not-authorized",
    device:"not-enrolled",
    qwen:"not-tested",
    answer:"not-tested",
    busy:false,
    detail:"",
    directCors:"not-tested"
  };

  function esc(value){
    return String(value??"").replace(/[&<>"']/g,ch=>({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
    }[ch]));
  }
  function base64url(bytes){
    let binary="";
    for(const byte of new Uint8Array(bytes))binary+=String.fromCharCode(byte);
    return btoa(binary).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");
  }
  function utf8(text){return new TextEncoder().encode(String(text))}
  function randomId(){return base64url(crypto.getRandomValues(new Uint8Array(18)))}
  function googleSubject(credential){
    try{
      const encoded=String(credential||"").split(".")[1]||"";
      const normalized=encoded.replace(/-/g,"+").replace(/_/g,"/");
      return String(JSON.parse(atob(normalized+"=".repeat((4-normalized.length%4)%4))).sub||"");
    }catch(e){return ""}
  }
  function configured(){
    return !!(config.enabled&&config.brokerOrigin&&config.googleClientId&&
      config.qwenApiBase&&config.qwenModel);
  }
  function consented(){
    try{return localStorage.getItem(CONSENT_KEY)==="1"}catch(e){return false}
  }
  function setConsent(value){
    try{
      if(value)localStorage.setItem(CONSENT_KEY,"1");
      else localStorage.removeItem(CONSENT_KEY);
    }catch(e){}
  }
  function brokerUrl(path){
    return new URL(path,config.brokerOrigin.replace(/\/?$/,"/")).toString();
  }
  async function brokerFetch(path,options={}){
    const response=await fetch(brokerUrl(path),{
      ...options,
      cache:"no-store",
      credentials:"omit",
      headers:{"Content-Type":"application/json",...(options.headers||{})}
    });
    const text=await response.text();
    let body={};
    try{body=text?JSON.parse(text):{}}catch(e){}
    if(!response.ok)throw new Error(body.error||`Broker HTTP ${response.status}`);
    return body;
  }

  function openDb(){
    return new Promise((resolve,reject)=>{
      const request=indexedDB.open(DB_NAME,1);
      request.onupgradeneeded=()=>request.result.createObjectStore(STORE);
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error||new Error("IndexedDB unavailable"));
    });
  }
  async function dbGet(key){
    const db=await openDb();
    try{
      return await new Promise((resolve,reject)=>{
        const req=db.transaction(STORE,"readonly").objectStore(STORE).get(key);
        req.onsuccess=()=>resolve(req.result);
        req.onerror=()=>reject(req.error);
      });
    }finally{db.close()}
  }
  async function dbSet(key,value){
    const db=await openDb();
    try{
      await new Promise((resolve,reject)=>{
        const req=db.transaction(STORE,"readwrite").objectStore(STORE).put(value,key);
        req.onsuccess=()=>resolve();
        req.onerror=()=>reject(req.error);
      });
    }finally{db.close()}
  }
  async function dbClear(){
    const db=await openDb();
    try{
      await new Promise((resolve,reject)=>{
        const req=db.transaction(STORE,"readwrite").objectStore(STORE).clear();
        req.onsuccess=()=>resolve();
        req.onerror=()=>reject(req.error);
      });
    }finally{db.close()}
  }
  async function device(){
    let record=await dbGet("current");
    if(record?.privateKey&&record?.publicJwk)return record;
    const pair=await crypto.subtle.generateKey(
      {name:"ECDSA",namedCurve:"P-256"},false,["sign","verify"]
    );
    const publicJwk=await crypto.subtle.exportKey("jwk",pair.publicKey);
    record={privateKey:pair.privateKey,publicJwk,certificate:"",createdAt:Date.now()};
    await dbSet("current",record);
    return record;
  }
  async function jwkThumbprint(jwk){
    const canonical=JSON.stringify({crv:jwk.crv,kty:jwk.kty,x:jwk.x,y:jwk.y});
    return base64url(await crypto.subtle.digest("SHA-256",utf8(canonical)));
  }
  async function sign(record,message){
    const signature=await crypto.subtle.sign(
      {name:"ECDSA",hash:"SHA-256"},record.privateKey,utf8(message)
    );
    return base64url(signature);
  }

  async function challenge(purpose){
    return brokerFetch("v1/auth/challenge",{
      method:"POST",
      body:JSON.stringify({purpose,clientNonce:randomId()})
    });
  }
  function loadGoogle(){
    if(window.google?.accounts?.id)return Promise.resolve();
    return new Promise((resolve,reject)=>{
      let script=document.querySelector('script[data-kitsune-google-identity]');
      if(script){
        script.addEventListener("load",resolve,{once:true});
        script.addEventListener("error",()=>reject(new Error("Google Identity не загрузился")),{once:true});
        return;
      }
      script=document.createElement("script");
      script.src="https://accounts.google.com/gsi/client";
      script.async=true;script.defer=true;
      script.dataset.kitsuneGoogleIdentity="1";
      script.onload=resolve;
      script.onerror=()=>reject(new Error("Google Identity не загрузился"));
      document.head.appendChild(script);
    });
  }
  async function prepareGoogleButton(){
    if(!configured())throw new Error("Cloud Brain ещё не настроен владельцем");
    if(!consented())throw new Error("Сначала подтвердите обработку минимального текста в облаке");
    state.busy=true;state.detail="Готовлю защищённый вход Google…";notify();
    const authChallenge=await challenge("enroll");
    await loadGoogle();
    const host=document.querySelector("#khiGoogleButton");
    if(!host)throw new Error("Панель входа закрыта");
    host.innerHTML="";
    window.google.accounts.id.initialize({
      client_id:config.googleClientId,
      callback:response=>completeEnrollment(response?.credential,authChallenge),
      nonce:authChallenge.nonce,
      auto_select:false,
      cancel_on_tap_outside:true,
      context:"signin",
      ux_mode:"popup"
    });
    window.google.accounts.id.renderButton(host,{
      type:"standard",theme:"outline",size:"large",text:"continue_with",
      shape:"pill",logo_alignment:"left",width:280
    });
    state.busy=false;state.detail="Нажмите кнопку Google и войдите как взрослый.";notify();
  }
  async function completeEnrollment(credential,authChallenge){
    const localSubject=googleSubject(credential);
    try{
      if(!credential)throw new Error("Google не вернул подтверждение входа");
      state.busy=true;state.detail="Проверяю взрослый доступ и устройство…";notify();
      const record=await device();
      const thumbprint=await jwkThumbprint(record.publicJwk);
      const proof=await sign(record,`enroll\n${authChallenge.challengeToken}\n${thumbprint}`);
      const result=await brokerFetch("v1/enroll",{
        method:"POST",
        body:JSON.stringify({
          googleCredential:credential,
          challengeToken:authChallenge.challengeToken,
          publicJwk:record.publicJwk,
          proof
        })
      });
      record.certificate=result.deviceCertificate;
      record.certificateExpiresAt=result.expiresAt;
      await dbSet("current",record);
      credential="";
      state.google="authorized";state.device="enrolled";
      state.detail="Взрослый доступ подтверждён. Устройство зарегистрировано.";
    }catch(error){
      state.google="failed";state.device="not-enrolled";
      const message=String(error?.message||error);
      state.detail=message==="parent_not_allowed"&&localSubject?
        `Этот взрослый аккаунт ещё не разрешён. Его Google sub: ${localSubject}. Введите значение самостоятельно в Cloudflare Secret PARENT_GOOGLE_SUB; не отправляйте ID token.`:
        message;
    }finally{state.busy=false;notify()}
  }
  async function checkBroker(){
    try{
      state.busy=true;state.detail="Проверяю broker…";notify();
      const health=await brokerFetch("v1/health",{method:"GET",headers:{}});
      if(!health.ready)throw new Error("Broker запущен, но обязательная конфигурация неполна");
      state.broker="connected";
      const record=await dbGet("current");
      if(record?.certificate){state.device="enrolled"}
      state.detail="Broker отвечает и не раскрывает секреты.";
    }catch(error){
      state.broker="failed";state.detail=String(error?.message||error);
    }finally{state.busy=false;notify()}
  }
  async function requestTemporaryCredential(){
    const record=await dbGet("current");
    if(!record?.privateKey||!record?.certificate)throw new Error("Сначала подтвердите Google и устройство");
    const tokenChallenge=await challenge("temporary-credential");
    const proof=await sign(record,`temporary-credential\n${tokenChallenge.challengeToken}\n${record.certificate}`);
    return brokerFetch("v1/temporary-credential",{
      method:"POST",
      body:JSON.stringify({
        challengeToken:tokenChallenge.challengeToken,
        deviceCertificate:record.certificate,
        proof
      })
    });
  }
  async function testQwen(){
    let temporaryToken="";
    try{
      state.busy=true;state.qwen="testing";state.answer="not-tested";
      state.detail="Получаю временный credential и проверяю прямое соединение…";notify();
      const issued=await requestTemporaryCredential();
      temporaryToken=issued.token;
      if(!temporaryToken)throw new Error("Broker не вернул временный credential");
      const response=await fetch(new URL("chat/completions",config.qwenApiBase.replace(/\/?$/,"/")).toString(),{
        method:"POST",cache:"no-store",credentials:"omit",
        headers:{"Authorization":`Bearer ${temporaryToken}`,"Content-Type":"application/json"},
        body:JSON.stringify({
          model:config.qwenModel,
          messages:[
            {role:"system",content:"Ответь безопасно и очень кратко. Это техническая проверка соединения."},
            {role:"user",content:"Ответь одним словом: готово"}
          ],
          stream:false,
          max_tokens:12,
          temperature:0
        })
      });
      const text=await response.text();
      let body={};try{body=JSON.parse(text)}catch(e){}
      if(!response.ok)throw new Error(body?.error?.message||`Qwen HTTP ${response.status}`);
      const answer=String(body?.choices?.[0]?.message?.content||"").trim();
      if(!answer)throw new Error("Qwen вернул пустой тестовый ответ");
      state.qwen="connected";state.answer="received";state.directCors="pass";
      state.detail=`Тестовый ответ получен: ${answer.slice(0,80)}`;
    }catch(error){
      state.qwen="failed";state.answer="not-received";
      const message=String(error?.message||error);
      state.directCors=/fetch|cors|network/i.test(message)?"failed":"unknown";
      state.detail=`Direct test не прошёл: ${message}. Proxy не включается автоматически.`;
    }finally{
      temporaryToken="";
      state.busy=false;notify();
    }
  }
  async function disconnect(){
    try{window.google?.accounts?.id?.disableAutoSelect?.()}catch(e){}
    await dbClear();setConsent(false);
    Object.assign(state,{google:"not-authorized",device:"not-enrolled",qwen:"not-tested",answer:"not-tested",detail:"Cloud Brain отключён на этом устройстве.",directCors:"not-tested"});
    notify();
  }
  function badge(value){
    const good=["connected","authorized","enrolled","received","pass"].includes(value);
    const bad=["failed","not-received"].includes(value);
    return `<span class="khi-badge ${good?"ok":bad?"bad":"idle"}">${esc(value)}</span>`;
  }
  function panel(){
    const setup=configured();
    return `<section class="sx-adult-card khi-panel">
      <span class="eyebrow">Hybrid Intelligence · Stage 1</span>
      <h3>Cloud Brain</h3>
      <p>Облачный интеллект необязателен. Курс, Math Engine, локальный Brain, Whisper и голос продолжают работать без него.</p>
      ${setup?"":`<div class="khi-notice warn"><b>Нужна настройка владельца</b><span>Публичные адреса и Google Client ID ещё не заданы. Секреты сюда вводить нельзя.</span></div>`}
      <label class="sx-switch"><input type="checkbox" id="khiConsent" ${consented()?"checked":""} ${setup?"":"disabled"}><span><b>Разрешить Cloud Brain на этом устройстве</b><small>В облако может уходить только минимальный текст текущего вопроса. Raw-аудио, Mastery, ошибки, ДЗ и фото остаются локально.</small></span></label>
      <div class="khi-status-grid">
        <div><b>Google authorized</b>${badge(state.google)}</div>
        <div><b>Broker connected</b>${badge(state.broker)}</div>
        <div><b>Qwen connected</b>${badge(state.qwen)}</div>
        <div><b>Test answer received</b>${badge(state.answer)}</div>
      </div>
      <div id="khiGoogleButton" class="khi-google"></div>
      <div class="ml-actions">
        <button class="secondary" id="khiBroker" ${setup&&consented()&&!state.busy?"":"disabled"}>Проверить broker</button>
        <button class="secondary" id="khiGoogle" ${setup&&consented()&&!state.busy?"":"disabled"}>Подтвердить через Google</button>
        <button class="primary" id="khiQwen" ${setup&&consented()&&state.device==="enrolled"&&!state.busy?"":"disabled"}>Тест Qwen</button>
        <button class="secondary" id="khiDisconnect" ${state.device==="enrolled"?"":"disabled"}>Отключить устройство</button>
      </div>
      <div class="khi-detail ${state.detail?"show":""}" role="status" aria-live="polite">${esc(state.detail||"Проверки ещё не запускались.")}</div>
      <p class="khi-foot">Режим данных: <b>${esc(config.privacyMode)}</b>. Temporary credential хранится только в памяти и очищается после теста. Direct CORS: ${esc(state.directCors)}.</p>
    </section>`;
  }
  function bind(){
    document.querySelector("#khiConsent")?.addEventListener("change",event=>{
      setConsent(!!event.target.checked);
      state.detail=event.target.checked?"Cloud Brain разрешён взрослым на этом устройстве.":"Cloud Brain выключен; локальные функции не изменены.";
      notify();
    });
    document.querySelector("#khiBroker")?.addEventListener("click",checkBroker);
    document.querySelector("#khiGoogle")?.addEventListener("click",()=>prepareGoogleButton().catch(error=>{
      state.busy=false;state.detail=String(error?.message||error);notify();
    }));
    document.querySelector("#khiQwen")?.addEventListener("click",testQwen);
    document.querySelector("#khiDisconnect")?.addEventListener("click",()=>disconnect().catch(error=>{
      state.detail=String(error?.message||error);notify();
    }));
  }
  function notify(){
    window.dispatchEvent(new CustomEvent("kitsune-hybrid-status",{detail:{...state}}));
  }
  async function restore(){
    try{
      const record=await dbGet("current");
      if(record?.certificate){state.device="enrolled";state.google="authorized"}
    }catch(e){}
    notify();
  }

  window.KitsuneHybridInfrastructure={
    version:VERSION,
    configured,
    consented,
    panel,
    bind,
    status:()=>({...state}),
    checkBroker,
    testQwen,
    disconnect
  };
  restore();
})();
