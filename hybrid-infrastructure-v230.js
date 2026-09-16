/* =====================================================================
   Kitsune v2.3.0-beta.3.7.2 · Hybrid Intelligence infrastructure client
   Stable trusted-device session + Cloud Brain diagnostics.
   ===================================================================== */
(() => {
  "use strict";

  const VERSION="2.3.0-beta.3.7.2";
  const DB_NAME="kitsune-hybrid-device-v230";
  const STORE="device";
  const CONSENT_KEY="a8_cloud_brain_parent_consent_v230";
  const config=Object.freeze({...window.KITSUNE_HYBRID_CONFIG});
  const encoder=new TextEncoder();

  const state={
    broker:"unknown",
    google:"not-authorized",
    device:"not-enrolled",
    qwen:"not-tested",
    answer:"not-tested",
    busy:false,
    detail:"",
    directCors:"not-tested",
    role:"unknown",
    session:"unknown"
  };

  let refreshPromise=null;

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
  function utf8(text){return encoder.encode(String(text))}
  function randomId(){return base64url(crypto.getRandomValues(new Uint8Array(18)))}
  function configured(){return !!(config.enabled&&config.brokerOrigin&&config.googleClientId)}
  function consented(){try{return localStorage.getItem(CONSENT_KEY)==="1"}catch{return false}}
  function setConsent(value){
    try{
      if(value)localStorage.setItem(CONSENT_KEY,"1");
      else localStorage.removeItem(CONSENT_KEY);
    }catch{}
  }
  function googleSubject(credential){
    try{
      const encoded=String(credential||"").split(".")[1]||"";
      const normalized=encoded.replace(/-/g,"+").replace(/_/g,"/");
      return String(JSON.parse(atob(normalized+"=".repeat((4-normalized.length%4)%4))).sub||"");
    }catch{return ""}
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
    try{body=text?JSON.parse(text):{}}catch{}
    if(!response.ok)throw new Error(body.error||`Broker HTTP ${response.status}`);
    return body;
  }

  function openDb(){
    return new Promise((resolve,reject)=>{
      const request=indexedDB.open(DB_NAME,1);
      request.onupgradeneeded=()=>{
        if(!request.result.objectStoreNames.contains(STORE)){
          request.result.createObjectStore(STORE);
        }
      };
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error||new Error("IndexedDB unavailable"));
    });
  }
  async function dbGet(key="current"){
    const db=await openDb();
    try{
      return await new Promise((resolve,reject)=>{
        const req=db.transaction(STORE,"readonly").objectStore(STORE).get(key);
        req.onsuccess=()=>resolve(req.result||null);
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
    let record=await dbGet();
    if(record?.privateKey&&record?.publicJwk)return record;

    const pair=await crypto.subtle.generateKey(
      {name:"ECDSA",namedCurve:"P-256"},false,["sign","verify"]
    );
    const publicJwk=await crypto.subtle.exportKey("jwk",pair.publicKey);
    record={
      privateKey:pair.privateKey,
      publicJwk,
      certificate:"",
      certificateExpiresAt:0,
      role:"",
      createdAt:Date.now()
    };
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
  async function challenge(purpose,signal){
    return brokerFetch("v1/auth/challenge",{
      method:"POST",
      signal,
      body:JSON.stringify({purpose,clientNonce:randomId()})
    });
  }
  function certificateFresh(record,marginSeconds=600){
    const exp=Number(record?.certificateExpiresAt||0);
    return !!(record?.certificate&&record?.privateKey&&exp>(Date.now()/1000+marginSeconds));
  }

  async function refreshDeviceSession({force=false}={}){
    if(refreshPromise)return refreshPromise;

    refreshPromise=(async()=>{
      let record=await dbGet();
      if(!record?.certificate||!record?.privateKey){
        state.session="reauth-required";
        state.device="not-enrolled";
        notify();
        return false;
      }

      if(!force&&certificateFresh(record)){
        state.session="fresh";
        state.device="enrolled";
        state.google="authorized";
        state.role=String(record.role||state.role||"unknown");
        notify();
        return true;
      }

      state.session="refreshing";
      notify();

      try{
        const authChallenge=await challenge("device-refresh");
        const proof=await sign(
          record,
          `device-refresh\n${authChallenge.challengeToken}\n${record.certificate}`
        );
        const result=await brokerFetch("v1/device/refresh",{
          method:"POST",
          body:JSON.stringify({
            challengeToken:authChallenge.challengeToken,
            deviceCertificate:record.certificate,
            proof
          })
        });

        record.certificate=result.deviceCertificate;
        record.certificateExpiresAt=result.expiresAt;
        record.role=String(result.role||record.role||"");
        await dbSet("current",record);

        state.session="fresh";
        state.device="enrolled";
        state.google="authorized";
        state.role=record.role||"user";
        notify();

        window.dispatchEvent(new CustomEvent("kitsune-device-session",{
          detail:{status:"refreshed",role:state.role,expiresAt:result.expiresAt}
        }));
        return true;
      }catch(error){
        state.session="reauth-required";
        state.detail=`Нужно один раз повторно подтвердить Google: ${String(error?.message||error)}`;
        notify();
        return false;
      }
    })();

    try{return await refreshPromise}
    finally{refreshPromise=null}
  }

  function loadGoogle(){
    if(window.google?.accounts?.id)return Promise.resolve();
    return new Promise((resolve,reject)=>{
      let script=document.querySelector('script[data-kitsune-google-identity]');
      if(script){
        if(window.google?.accounts?.id){resolve();return}
        script.addEventListener("load",resolve,{once:true});
        script.addEventListener("error",()=>reject(new Error("Google Identity не загрузился")),{once:true});
        return;
      }
      script=document.createElement("script");
      script.src="https://accounts.google.com/gsi/client";
      script.async=true;
      script.defer=true;
      script.dataset.kitsuneGoogleIdentity="1";
      script.onload=resolve;
      script.onerror=()=>reject(new Error("Google Identity не загрузился"));
      document.head.appendChild(script);
    });
  }

  async function prepareGoogleButton(){
    if(!configured())throw new Error("Cloud Brain ещё не настроен владельцем");
    if(!consented())throw new Error("Сначала подтвердите обработку минимального текста в облаке");

    state.busy=true;
    state.detail="Готовлю защищённый вход Google…";
    notify();

    const authChallenge=await challenge("enroll");
    await loadGoogle();

    state.busy=false;
    state.detail="Нажмите кнопку Google и выберите разрешённый аккаунт.";
    notify();

    setTimeout(()=>{
      try{
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
          type:"standard",
          theme:"outline",
          size:"large",
          text:"continue_with",
          shape:"pill",
          logo_alignment:"left",
          width:280
        });
      }catch(error){
        state.detail=String(error?.message||error);
        notify();
      }
    },0);
  }

  async function completeEnrollment(credential,authChallenge){
    const localSubject=googleSubject(credential);
    try{
      if(!credential)throw new Error("Google не вернул подтверждение входа");

      state.busy=true;
      state.detail="Проверяю доступ и устройство…";
      notify();

      const record=await device();
      const thumbprint=await jwkThumbprint(record.publicJwk);
      const proof=await sign(
        record,
        `enroll\n${authChallenge.challengeToken}\n${thumbprint}`
      );
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
      record.role=String(result.role||record.role||"");
      await dbSet("current",record);

      credential="";
      state.google="authorized";
      state.device="enrolled";
      state.session="fresh";
      state.role=record.role||"user";
      state.detail="Google-доступ подтверждён. Доверенная сессия устройства активна.";

      window.dispatchEvent(new CustomEvent("kitsune-device-session",{
        detail:{status:"enrolled",role:state.role,expiresAt:result.expiresAt}
      }));
    }catch(error){
      state.google="failed";
      state.device="not-enrolled";
      state.session="reauth-required";
      const message=String(error?.message||error);
      state.detail=(message==="parent_not_allowed"&&localSubject)
        ? `Этот аккаунт не разрешён. Google sub: ${localSubject}.`
        : message;
    }finally{
      state.busy=false;
      notify();
    }
  }

  async function checkBroker(){
    try{
      state.busy=true;
      state.detail="Проверяю broker…";
      notify();

      const health=await brokerFetch("v1/health",{method:"GET",headers:{}});
      if(!health.ready)throw new Error("Broker запущен, но обязательная конфигурация неполна");

      state.broker="connected";
      const record=await dbGet();
      if(record?.certificate){
        state.device="enrolled";
        state.google="authorized";
        state.role=String(record.role||state.role||"unknown");
        await refreshDeviceSession().catch(()=>false);
      }
      state.detail=`Broker ${health.version||""} отвечает. D1: ${health.registryReady?"готова":"не готова"}.`;
    }catch(error){
      state.broker="failed";
      state.detail=String(error?.message||error);
    }finally{
      state.busy=false;
      notify();
    }
  }

  async function requestQwenTest(){
    let record=await dbGet();
    if(!record?.privateKey||!record?.certificate)throw new Error("Сначала подтвердите Google и устройство");

    if(!certificateFresh(record,120)){
      const refreshed=await refreshDeviceSession({force:true});
      if(!refreshed)throw new Error("enrollment_required");
      record=await dbGet();
    }

    const testChallenge=await challenge("qwen-test");
    const proof=await sign(
      record,
      `qwen-test\n${testChallenge.challengeToken}\n${record.certificate}`
    );
    return brokerFetch("v1/qwen/test",{
      method:"POST",
      body:JSON.stringify({
        challengeToken:testChallenge.challengeToken,
        deviceCertificate:record.certificate,
        proof
      })
    });
  }

  async function testQwen(){
    try{
      state.busy=true;
      state.qwen="testing";
      state.answer="not-tested";
      state.detail="Проверяю Qwen через защищённый broker…";
      notify();

      const result=await requestQwenTest();
      const answer=String(result.answer||"").trim();
      if(!answer)throw new Error("Qwen вернул пустой тестовый ответ");

      state.qwen="connected";
      state.answer="received";
      state.directCors="failed";
      state.detail=`Тестовый ответ получен: ${answer.slice(0,80)}`;
    }catch(error){
      state.qwen="failed";
      state.answer="not-received";
      state.detail=`Тест Qwen не прошёл: ${String(error?.message||error)}`;
    }finally{
      state.busy=false;
      notify();
    }
  }

  async function disconnect(){
    window.KitsuneRouter?.cancel?.();
    try{window.google?.accounts?.id?.disableAutoSelect?.()}catch{}
    await dbClear();
    setConsent(false);

    Object.assign(state,{
      google:"not-authorized",
      device:"not-enrolled",
      qwen:"not-tested",
      answer:"not-tested",
      detail:"Cloud Brain отключён на этом устройстве.",
      directCors:"not-tested",
      role:"unknown",
      session:"unknown"
    });
    notify();
  }

  function badge(value){
    const good=["connected","authorized","enrolled","received","pass","fresh"].includes(value);
    const bad=["failed","not-received","reauth-required"].includes(value);
    return `<span class="khi-badge ${good?"ok":bad?"bad":"idle"}">${esc(value)}</span>`;
  }

  function panel(){
    const setup=configured();
    return `<section class="sx-adult-card khi-panel">
      <span class="eyebrow">Hybrid Intelligence · beta.3.6.1</span>
      <h3>Cloud Brain</h3>
      <p>Облачный интеллект необязателен. Курс, Math Engine, локальный Brain, Whisper и локальный голос работают независимо.</p>
      ${setup?"":`<div class="khi-notice warn"><b>Нужна настройка владельца</b><span>Публичные адреса и Google Client ID ещё не заданы.</span></div>`}
      <label class="sx-switch">
        <input type="checkbox" id="khiConsent" ${consented()?"checked":""} ${setup?"":"disabled"}>
        <span><b>Разрешить подключение Cloud Brain</b><small>В облако отправляется только текущий безопасный текст запроса.</small></span>
      </label>

      <div class="khi-status-grid">
        <div><b>Google authorized</b>${badge(state.google)}</div>
        <div><b>Broker connected</b>${badge(state.broker)}</div>
        <div><b>Qwen connected</b>${badge(state.qwen)}</div>
        <div><b>Test answer received</b>${badge(state.answer)}</div>
        <div><b>Device session</b>${badge(state.session)}</div>
        <div><b>Access role</b><span class="khi-badge idle">${esc(state.role)}</span></div>
      </div>

      <div id="khiGoogleButton" class="khi-google"></div>

      <div class="ml-actions">
        <button class="secondary" id="khiBroker" ${setup&&consented()&&!state.busy?"":"disabled"}>Проверить broker</button>
        <button class="secondary" id="khiGoogle" ${setup&&consented()&&!state.busy?"":"disabled"}>Подтвердить через Google</button>
        <button class="primary" id="khiQwen" ${setup&&consented()&&state.device==="enrolled"&&!state.busy?"":"disabled"}>Тест Qwen</button>
        <button class="secondary" id="khiDisconnect" ${state.device==="enrolled"?"":"disabled"}>Отключить устройство</button>
      </div>

      <div class="khi-detail ${state.detail?"show":""}" role="status" aria-live="polite">
        ${esc(state.detail||"Проверки ещё не запускались.")}
      </div>

      <p class="khi-foot">Режим данных: <b>${esc(config.privacyMode)}</b>. Сессия устройства обновляется без повторного Google-входа, пока устройство остаётся доверенным.</p>
    </section>`;
  }

  function bind(){
    document.querySelector("#khiConsent")?.addEventListener("change",event=>{
      setConsent(!!event.target.checked);
      if(!event.target.checked)window.KitsuneRouter?.cancel?.();
      state.detail=event.target.checked
        ?"Cloud Brain разрешён взрослым на этом устройстве."
        :"Cloud Brain выключен; локальные функции не изменены.";
      notify();
    });

    document.querySelector("#khiBroker")?.addEventListener("click",checkBroker);
    document.querySelector("#khiGoogle")?.addEventListener("click",()=>{
      prepareGoogleButton().catch(error=>{
        state.busy=false;
        state.detail=String(error?.message||error);
        notify();
      });
    });
    document.querySelector("#khiQwen")?.addEventListener("click",testQwen);
    document.querySelector("#khiDisconnect")?.addEventListener("click",()=>{
      disconnect().catch(error=>{
        state.detail=String(error?.message||error);
        notify();
      });
    });
  }

  function notify(){
    window.dispatchEvent(new CustomEvent("kitsune-hybrid-status",{detail:{...state}}));
  }

  async function restore(){
    try{
      const record=await dbGet();
      if(record?.certificate){
        state.device="enrolled";
        state.google="authorized";
        state.role=String(record.role||"unknown");
        state.session=certificateFresh(record)?"fresh":"expired";
        notify();
        await refreshDeviceSession().catch(()=>false);
      }
    }catch{
      state.session="unknown";
    }
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
    disconnect,
    refreshDeviceSession,

    async cloudRequest(kind,payload,{signal}={}){
      if(!consented()||!window.KitsuneRouter?.consented?.()){
        throw new Error("cloud_consent_required");
      }
      if(!["chat","tts","voice-design"].includes(kind)){
        throw new Error("invalid_kind");
      }

      let record=await dbGet();
      if(!record?.certificate){
        throw new Error("enrollment_required");
      }

      if(!certificateFresh(record,120)){
        const refreshed=await refreshDeviceSession({force:true});
        if(!refreshed)throw new Error("enrollment_required");
        record=await dbGet();
      }

      const nonce=await challenge(kind,signal);

      let bodyPayload;
      let proofMaterial;

      if(kind==="chat"&&payload&&typeof payload==="object"&&!Array.isArray(payload)){
        const message=String(payload.message||"");
        const conversationContext=String(payload.conversationContext||"");

        bodyPayload={
          message,
          ...(conversationContext?{conversationContext}:{})
        };

        proofMaterial=conversationContext
          ?JSON.stringify({message,conversationContext})
          :message;
      }else{
        bodyPayload={
          [kind==="chat"?"message":"text"]:payload
        };
        proofMaterial=String(payload??"");
      }

      const hash=base64url(
        await crypto.subtle.digest("SHA-256",utf8(proofMaterial))
      );
      const proof=await sign(
        record,
        `${kind}\n${nonce.challengeToken}\n${record.certificate}\n${hash}`
      );
      const body={
        challengeToken:nonce.challengeToken,
        deviceCertificate:record.certificate,
        proof,
        ...bodyPayload
      };
      return brokerFetch(`v1/qwen/${kind}`,{
        method:"POST",
        signal,
        body:JSON.stringify(body)
      });
    }
  };

  restore();
})();
