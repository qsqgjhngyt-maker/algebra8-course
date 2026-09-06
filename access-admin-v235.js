/* =====================================================================
   Kitsune v2.3.0-beta.3.5 · Owner Approval & Admin UI
   - External Google accounts can request access.
   - Only the owner sees the Admin tab.
   - Admin API is also protected server-side; hiding the tab is NOT security.
   - Pending token is bound to the local device key.
   ===================================================================== */
(() => {
  "use strict";

  const VERSION="2.3.0-beta.3.5";
  const DB_NAME="kitsune-hybrid-device-v230";
  const STORE="device";
  const config=window.KITSUNE_HYBRID_CONFIG||{};
  const encoder=new TextEncoder();

  let isOwner=false;
  let adminData=null;
  let polling=false;

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
        if(!request.result.objectStoreNames.contains(STORE))request.result.createObjectStore(STORE);
      };
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error||new Error("IndexedDB unavailable"));
    });
  }
  async function dbGet(){
    const db=await openDb();
    try{
      return await new Promise((resolve,reject)=>{
        const req=db.transaction(STORE,"readonly").objectStore(STORE).get("current");
        req.onsuccess=()=>resolve(req.result||null);
        req.onerror=()=>reject(req.error);
      });
    }finally{db.close()}
  }
  async function dbSet(record){
    const db=await openDb();
    try{
      await new Promise((resolve,reject)=>{
        const req=db.transaction(STORE,"readwrite").objectStore(STORE).put(record,"current");
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
    record={privateKey:pair.privateKey,publicJwk,certificate:"",createdAt:Date.now()};
    await dbSet(record);
    return record;
  }
  async function jwkThumbprint(jwk){
    const canonical=JSON.stringify({crv:jwk.crv,kty:jwk.kty,x:jwk.x,y:jwk.y});
    return base64url(await crypto.subtle.digest("SHA-256",utf8(canonical)));
  }
  async function sign(record,message){
    return base64url(await crypto.subtle.sign(
      {name:"ECDSA",hash:"SHA-256"},record.privateKey,utf8(message)
    ));
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

  async function requestAccessGoogle(){
    if(!window.KitsuneHybridInfrastructure?.consented?.()){
      setAccessStatus("Сначала включите «Разрешить подключение Cloud Brain».","warn");
      return;
    }
    const authChallenge=await challenge("access-request");
    await loadGoogle();

    const host=document.querySelector("#v235GoogleRequest");
    if(!host)return;
    host.innerHTML="";
    setAccessStatus("Войдите под Google-аккаунтом пользователя.","");

    window.google.accounts.id.initialize({
      client_id:config.googleClientId,
      nonce:authChallenge.nonce,
      auto_select:false,
      cancel_on_tap_outside:true,
      context:"signin",
      ux_mode:"popup",
      callback:response=>completeAccessRequest(response?.credential,authChallenge)
    });
    window.google.accounts.id.renderButton(host,{
      type:"standard",theme:"outline",size:"large",text:"continue_with",
      shape:"pill",logo_alignment:"left",width:280
    });
  }

  async function completeAccessRequest(credential,authChallenge){
    try{
      if(!credential)throw new Error("Google не вернул подтверждение входа");
      setAccessStatus("Отправляю заявку владельцу…","busy");

      const record=await device();
      const thumbprint=await jwkThumbprint(record.publicJwk);
      const proof=await sign(
        record,
        `access-request\n${authChallenge.challengeToken}\n${thumbprint}`
      );
      const result=await brokerFetch("v1/access/request",{
        method:"POST",
        body:JSON.stringify({
          googleCredential:credential,
          challengeToken:authChallenge.challengeToken,
          publicJwk:record.publicJwk,
          proof
        })
      });

      if(result.status==="approved"&&result.deviceCertificate){
        record.certificate=result.deviceCertificate;
        record.certificateExpiresAt=result.expiresAt;
        delete record.accessPendingToken;
        await dbSet(record);
        setAccessStatus("✅ Доступ разрешён. Cloud Brain готов.","ok");
        setTimeout(()=>location.reload(),900);
        return;
      }

      record.accessPendingToken=result.pendingToken;
      record.accessStatus="pending";
      await dbSet(record);
      setAccessStatus("🕓 Заявка отправлена владельцу. Можно закрыть приложение и проверить позже.","ok");
      renderAccessCard();
    }catch(error){
      setAccessStatus(`Не удалось отправить заявку: ${String(error?.message||error)}`,"warn");
    }
  }

  async function checkAccessStatus({silent=false}={}){
    try{
      const record=await dbGet();
      if(!record?.accessPendingToken)return null;
      if(!silent)setAccessStatus("Проверяю решение владельца…","busy");

      const result=await brokerFetch("v1/access/status",{
        method:"POST",
        body:JSON.stringify({pendingToken:record.accessPendingToken})
      });

      record.accessStatus=result.status;
      if(result.status==="approved"&&result.deviceCertificate){
        record.certificate=result.deviceCertificate;
        record.certificateExpiresAt=result.expiresAt;
        delete record.accessPendingToken;
        await dbSet(record);
        if(!silent)setAccessStatus("✅ Владелец разрешил доступ. Перезапускаю…","ok");
        setTimeout(()=>location.reload(),700);
        return result;
      }

      await dbSet(record);
      if(!silent){
        const labels={
          pending:"🕓 Заявка пока ожидает решения владельца.",
          denied:"⛔ Заявка отклонена владельцем.",
          revoked:"⛔ Доступ был отозван владельцем."
        };
        setAccessStatus(labels[result.status]||`Статус: ${result.status}`,"");
      }
      renderAccessCard();
      return result;
    }catch(error){
      if(!silent)setAccessStatus(`Проверка статуса: ${String(error?.message||error)}`,"warn");
      return null;
    }
  }

  function setAccessStatus(text,type=""){
    const el=document.querySelector("#v235AccessStatus");
    if(!el)return;
    el.textContent=text;
    el.dataset.type=type;
  }

  async function renderAccessCard(){
    const host=document.querySelector(".khi-panel");
    if(!host)return;

    const record=await dbGet().catch(()=>null);
    if(record?.certificate){
      document.querySelector("#v235AccessCard")?.remove();
      return;
    }

    let card=document.querySelector("#v235AccessCard");
    if(!card){
      card=document.createElement("section");
      card.id="v235AccessCard";
      card.className="khi-detail show";
      card.style.marginTop="10px";
      card.innerHTML=`
        <b>🔐 Доступ к Cloud Brain по одобрению владельца</b>
        <p style="margin:6px 0;color:var(--muted);font-size:9px;line-height:1.45">
          Пользователь входит под своим Google-аккаунтом. Cloud Brain не включится,
          пока владелец Kitsune не одобрит заявку в админ-панели.
        </p>
        <div id="v235GoogleRequest" style="margin:7px 0"></div>
        <div class="ml-actions">
          <button class="secondary" id="v235RequestAccess" type="button">Отправить заявку</button>
          <button class="secondary" id="v235CheckAccess" type="button">Проверить статус</button>
        </div>
        <div id="v235AccessStatus" style="margin-top:7px;font-size:9px;color:var(--muted)"></div>
      `;
      host.append(card);
      card.querySelector("#v235RequestAccess")?.addEventListener("click",()=>requestAccessGoogle().catch(error=>{
        setAccessStatus(String(error?.message||error),"warn");
      }));
      card.querySelector("#v235CheckAccess")?.addEventListener("click",()=>checkAccessStatus());
    }

    if(record?.accessPendingToken){
      setAccessStatus(
        record.accessStatus==="denied"
          ?"⛔ Заявка была отклонена. Можно отправить новую заявку, если владелец попросит."
          :"🕓 Заявка отправлена и ожидает решения владельца."
      );
    }else{
      setAccessStatus("Нажмите «Отправить заявку» и войдите под своим Google-аккаунтом.");
    }
  }

  async function adminSigned(path,purpose,payload={}){
    const record=await dbGet();
    if(!record?.certificate||!record?.privateKey)throw new Error("Устройство не авторизовано");

    const nonce=await challenge(purpose);
    const extra=[];
    if(purpose==="admin-action"){
      extra.push(String(payload.action||""),String(payload.accountHash||""));
    }
    const suffix=extra.length?`\n${extra.join("\n")}`:"";
    const proof=await sign(
      record,
      `${purpose}\n${nonce.challengeToken}\n${record.certificate}${suffix}`
    );
    return brokerFetch(path,{
      method:"POST",
      body:JSON.stringify({
        ...payload,
        challengeToken:nonce.challengeToken,
        deviceCertificate:record.certificate,
        proof
      })
    });
  }

  async function loadAdmin({silent=false}={}){
    try{
      adminData=await adminSigned("v1/admin/list","admin-list");
      isOwner=true;
      ensureAdminButton();
      updateAdminBadge();
      if(document.querySelector("#v235AdminModal.show"))renderAdminModal();
      return adminData;
    }catch(error){
      const msg=String(error?.message||error);
      if(["admin_forbidden","invalid_device_certificate","expired_device_certificate"].includes(msg)){
        isOwner=false;
        document.querySelector("#v235AdminBtn")?.remove();
      }else if(!silent){
        setAdminStatus(`Ошибка админ-панели: ${msg}`);
      }
      return null;
    }
  }

  function ensureAdminButton(){
    if(!isOwner||document.querySelector("#v235AdminBtn"))return;
    const nav=document.querySelector(".main-nav")||document.querySelector(".sidebar-footer");
    if(!nav)return;
    const btn=document.createElement("button");
    btn.id="v235AdminBtn";
    btn.className=nav.classList.contains("main-nav")?"nav-btn":"ghost";
    btn.type="button";
    btn.innerHTML='🛡️ Администрирование <span id="v235AdminBadge"></span>';
    btn.addEventListener("click",openAdmin);
    nav.append(btn);
    updateAdminBadge();
  }

  function updateAdminBadge(){
    const badge=document.querySelector("#v235AdminBadge");
    if(!badge)return;
    const count=Number(adminData?.counts?.pending||0);
    badge.textContent=count?`(${count})`:"";
  }

  function ensureAdminModal(){
    if(document.querySelector("#v235AdminModal"))return;
    const root=document.createElement("div");
    root.id="v235AdminModal";
    root.innerHTML=`
      <style>
        #v235AdminModal{position:fixed;inset:0;z-index:2147482500;display:none;background:rgba(10,18,24,.56);padding:14px;overflow:auto}
        #v235AdminModal.show{display:block}
        .v235-admin-card{max-width:860px;margin:24px auto;background:var(--card);color:var(--text);border:1px solid var(--line);border-radius:18px;padding:16px;box-shadow:0 22px 70px rgba(0,0,0,.28)}
        .v235-admin-head{display:flex;align-items:center;justify-content:space-between;gap:10px}
        .v235-admin-head h3{margin:0}
        .v235-admin-actions{display:flex;gap:7px;flex-wrap:wrap;margin:10px 0}
        .v235-admin-stat{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px;margin:10px 0}
        .v235-admin-stat div{border:1px solid var(--line);border-radius:11px;padding:9px;text-align:center}
        .v235-admin-stat b{display:block;font-size:18px}
        .v235-user{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center;border:1px solid var(--line);border-radius:11px;padding:9px;margin:7px 0}
        .v235-user small{display:block;color:var(--muted);margin-top:2px}
        .v235-user-actions{display:flex;gap:5px;flex-wrap:wrap;justify-content:flex-end}
        .v235-pending{border-color:#d8a633}
        @media(max-width:620px){
          #v235AdminModal{padding:0}
          .v235-admin-card{min-height:100dvh;margin:0;border-radius:0;padding:12px}
          .v235-admin-stat{grid-template-columns:repeat(2,minmax(0,1fr))}
          .v235-user{grid-template-columns:1fr}
          .v235-user-actions{justify-content:flex-start}
        }
      </style>
      <div class="v235-admin-card">
        <div class="v235-admin-head">
          <div><span class="eyebrow">Owner only · ${VERSION}</span><h3>🛡️ Администрирование Kitsune</h3></div>
          <button class="icon-btn" id="v235AdminClose" type="button">✕</button>
        </div>
        <div id="v235AdminBody"></div>
      </div>
    `;
    document.body.append(root);
    root.querySelector("#v235AdminClose")?.addEventListener("click",closeAdmin);
    root.addEventListener("click",event=>{
      if(event.target===root)closeAdmin();
    });
  }

  async function openAdmin(){
    ensureAdminModal();
    document.querySelector("#v235AdminModal")?.classList.add("show");
    document.body.style.overflow="hidden";
    setAdminStatus("Обновляю данные…");
    await loadAdmin();
    renderAdminModal();
  }
  function closeAdmin(){
    document.querySelector("#v235AdminModal")?.classList.remove("show");
    document.body.style.overflow="";
  }

  function dateText(ts){
    if(!ts)return "—";
    try{return new Date(ts).toLocaleString("ru-RU",{dateStyle:"short",timeStyle:"short"})}
    catch{return new Date(ts).toLocaleString()}
  }
  function statusLabel(status){
    return ({
      pending:"ожидает",
      approved:"разрешён",
      denied:"отклонён",
      revoked:"отключён"
    })[status]||status;
  }

  function setAdminStatus(text){
    const el=document.querySelector("#v235AdminStatus");
    if(el)el.textContent=text;
  }

  function renderAdminModal(){
    const body=document.querySelector("#v235AdminBody");
    if(!body)return;
    if(!adminData){
      body.innerHTML='<p id="v235AdminStatus">Загрузка…</p>';
      return;
    }
    const users=adminData.users||[];
    const pending=users.filter(x=>x.status==="pending");
    const other=users.filter(x=>x.status!=="pending");

    body.innerHTML=`
      <div class="v235-admin-stat">
        <div><b>${Number(adminData.counts?.pending||0)}</b><span>ожидают</span></div>
        <div><b>${Number(adminData.counts?.approved||0)}</b><span>разрешены</span></div>
        <div><b>${Number(adminData.counts?.denied||0)}</b><span>отклонены</span></div>
        <div><b>${Number(adminData.counts?.revoked||0)}</b><span>отключены</span></div>
      </div>
      <div class="v235-admin-actions">
        <button class="secondary" id="v235AdminRefresh" type="button">↻ Обновить</button>
        <button class="${adminData.registrationOpen?"secondary":"primary"}" id="v235RegistrationToggle" type="button">
          ${adminData.registrationOpen?"⏸ Закрыть новые заявки":"▶ Открыть новые заявки"}
        </button>
      </div>
      <div id="v235AdminStatus" style="color:var(--muted);font-size:9px;margin:7px 0">
        Новые заявки: <b>${adminData.registrationOpen?"принимаются":"приостановлены"}</b>.
      </div>

      <h4>Новые заявки</h4>
      ${pending.length?pending.map(user=>userRow(user,true)).join(""):'<div class="ml-empty">Новых заявок нет.</div>'}

      <h4 style="margin-top:14px">Пользователи</h4>
      ${other.length?other.map(user=>userRow(user,false)).join(""):'<div class="ml-empty">Список пока пуст.</div>'}
    `;

    body.querySelector("#v235AdminRefresh")?.addEventListener("click",()=>loadAdmin());
    body.querySelector("#v235RegistrationToggle")?.addEventListener("click",async()=>{
      const action=adminData.registrationOpen?"close-registration":"reopen-registration";
      await adminAction(action,"");
    });
    body.querySelectorAll("[data-v235-action]").forEach(btn=>{
      btn.addEventListener("click",()=>adminAction(btn.dataset.v235Action,btn.dataset.v235Hash));
    });
  }

  function userRow(user,pending){
    const actions=pending
      ? `<button class="primary" data-v235-action="approve" data-v235-hash="${esc(user.accountHash)}">Разрешить</button>
         <button class="secondary" data-v235-action="deny" data-v235-hash="${esc(user.accountHash)}">Отклонить</button>`
      : user.status==="approved"
        ? `<button class="secondary" data-v235-action="revoke" data-v235-hash="${esc(user.accountHash)}">Отключить доступ</button>`
        : `<button class="primary" data-v235-action="approve" data-v235-hash="${esc(user.accountHash)}">Разрешить</button>`;

    return `<article class="v235-user ${pending?"v235-pending":""}">
      <div>
        <b>${esc(user.email)}</b>
        <small>${esc(statusLabel(user.status))} · запрос: ${esc(dateText(user.requestedAt))}</small>
      </div>
      <div class="v235-user-actions">${actions}</div>
    </article>`;
  }

  async function adminAction(action,accountHash){
    try{
      setAdminStatus("Применяю изменение…");
      const result=await adminSigned("v1/admin/action","admin-action",{action,accountHash});
      if(["reopen-registration","close-registration"].includes(action)){
        adminData.registrationOpen=!!result.registrationOpen;
      }
      await loadAdmin();
      renderAdminModal();
    }catch(error){
      setAdminStatus(`Ошибка: ${String(error?.message||error)}`);
    }
  }

  async function init(){
    if(!config?.brokerOrigin||!config?.googleClientId)return;
    ensureAdminModal();

    /* Probe owner role using the current signed device certificate. */
    await loadAdmin({silent:true});
    await renderAccessCard();

    const record=await dbGet().catch(()=>null);
    if(record?.accessPendingToken&&!record?.certificate){
      setTimeout(()=>checkAccessStatus({silent:true}),1200);
    }

    /* While the owner's app is open, pending badge updates automatically. */
    setInterval(()=>{
      if(document.visibilityState==="visible"&&isOwner&&!polling){
        polling=true;
        loadAdmin({silent:true}).finally(()=>{polling=false});
      }
    },60000);
  }

  let scheduled=false;
  new MutationObserver(()=>{
    if(scheduled)return;
    scheduled=true;
    requestAnimationFrame(()=>{
      scheduled=false;
      renderAccessCard();
      if(isOwner)ensureAdminButton();
    });
  }).observe(document.body,{childList:true,subtree:true});

  window.KitsuneAccessAdmin={
    version:VERSION,
    checkStatus:checkAccessStatus,
    refreshAdmin:()=>loadAdmin(),
    isOwner:()=>isOwner
  };

  setTimeout(init,500);
})();
