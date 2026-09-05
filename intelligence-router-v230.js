/* =====================================================================
   Kitsune v2.3.0-beta.2.1 · Hybrid Intelligence Router
   - Qwen Cloud for safe general dialogue, including while a lesson is open.
   - Exact math remains local/deterministic.
   - Only the current text is uploaded; ctx/history/Mastery/photos/audio remain local.
   - Adult Center shows the real route used by the last request.
   ===================================================================== */
(() => {
  "use strict";

  const VERSION="2.3.0-beta.2.1";
  const KEY="kitsune_cloud_chat_consent_v230";
  const brain=window.KitsuneBrain;
  const local=brain.chat.bind(brain);

  let active=null;
  let route="local";
  let last={
    route:"local",
    detail:"Ещё не было пользовательских запросов.",
    error:"",
    ts:0
  };

  const LABELS={
    "course":"Course tools · local",
    "math":"Math Engine · local",
    "cloud":"Qwen Cloud",
    "local":"Local Brain / Smart Tutor",
    "local-fallback":"Cloud → Local fallback",
    "safety":"Safety Guard · local"
  };

  function consented(){
    try{return localStorage.getItem(KEY)==="1"}catch{return false}
  }

  function label(value){return LABELS[value]||value}

  function cancel(){
    active?.abort();
    active=null;
    window.KitsuneCharacterVoice?.stop?.();
  }

  function setRoute(next,detail="",error=""){
    route=next;
    last={route:next,detail,error,ts:Date.now()};
    updateDiagnostics();
    try{
      window.dispatchEvent(new CustomEvent("kitsune-intelligence-route",{
        detail:{...last,version:VERSION}
      }));
    }catch{}
  }

  function obviousMath(text){
    const s=String(text||"");
    return !!(
      window.KitsuneMath?.looksMath?.(s) ||
      /\d\s*[-+*/]\s*\d/.test(s) ||
      /[=<>≤≥√²^]/.test(s) ||
      /(?:^|\s)(?:реши|вычисли|посчитай|рассчитай)\b/i.test(s) ||
      /(?:найди|определи)\s+(?:x|икс|корни?|дискриминант)\b/i.test(s)
    );
  }

  function eligible(text){
    const s=String(text||"").trim();
    if(!s||s.length>500||obviousMath(s))return false;
    if(/https?:|www\./i.test(s))return false;
    if(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.test(s))return false;
    if(/(?:\+?\d[\d\s()\-]{8,}\d)/.test(s))return false;
    if(/(?:меня зовут|мо[йяё]\s+(?:имя|адрес|школ|телефон|пароль)|живу|фамили|паспорт|точн(?:ый|ое)\s+местополож)/i.test(s))return false;
    if(/(?:мне|я)\s+\d{1,2}\s*(?:лет|года?)/i.test(s))return false;
    return true;
  }

  function cloudReady(text){
    return consented() &&
      window.KitsuneHybridInfrastructure?.consented?.() &&
      navigator.onLine &&
      eligible(text);
  }

  async function reply(message,ctx=null,history=[]){
    cancel();
    const controller=new AbortController();
    active=controller;
    const text=String(message||"").trim();

    const safety=brain.safetyCheck(text);
    if(safety){
      setRoute("safety","Сообщение обработано локальным Safety Guard.");
      return safety.reply;
    }

    const tool=await Promise.resolve(
      window.KitsuneTutorTools?.dispatch?.(text,ctx)
    ).catch(()=>null);

    if(controller.signal.aborted)throw new DOMException("Cancelled","AbortError");

    if(tool?.handled){
      setRoute("course","Ответ получен из локальных инструментов курса.");
      return brain.safeReply(tool.text);
    }

    if(obviousMath(text)){
      setRoute("math","Конкретную математику считает только детерминированный Math Engine.");
      try{
        const result=await window.KitsuneMath.analyze(text);
        if(controller.signal.aborted)throw new DOMException("Cancelled","AbortError");
        return brain.safeReply(brain.localMathExplanation(text,result));
      }catch(error){
        if(error?.name==="AbortError")throw error;
        setRoute("math","Math Engine не смог надёжно разобрать запись.",String(error?.message||error));
        return "Не удалось надёжно разобрать выражение. Запиши его в Math Lab — проверим шаг за шагом.";
      }
    }

    if(cloudReady(text)){
      const timeout=setTimeout(()=>controller.abort(),22000);
      try{
        /* Privacy invariant: only text. Never pass ctx/history here. */
        const result=await window.KitsuneHybridInfrastructure.cloudRequest(
          "chat",
          text,
          {signal:controller.signal}
        );
        if(active!==controller)throw new DOMException("Cancelled","AbortError");

        const answer=String(result?.answer||"").trim();
        if(!answer)throw new Error("empty_answer");

        setRoute(
          "cloud",
          ctx
            ?"Qwen Cloud ответил на текущую реплику внутри урока. Условие задания и история не отправлялись."
            :"Qwen Cloud ответил на текущую безопасную реплику."
        );
        return brain.safeReply(answer);
      }catch(error){
        if(active!==controller)throw new DOMException("Cancelled","AbortError");
        const msg=String(error?.message||error||"cloud_failed");
        setRoute("local-fallback","Cloud Brain не ответил — использован локальный fallback.",msg);
      }finally{
        clearTimeout(timeout);
      }
    }else{
      setRoute(
        "local",
        navigator.onLine
          ?"Router оставил реплику локально по правилам приватности/безопасности."
          :"Нет сети — используется локальный интеллект."
      );
    }

    try{
      return await local(text,ctx,history);
    }catch(error){
      return brain.dialogFallback(text,ctx);
    }
  }

  function diagnosticsMarkup(){
    return `<div id="khiRouterRuntime" class="khi-detail show" style="margin-top:10px">
      <b>🧠 Реальный маршрут диалога · Router ${VERSION}</b>
      <div id="khiRouterRoute" style="margin-top:6px">Последний маршрут: ${label(last.route)}</div>
      <div id="khiRouterDetail" style="margin-top:3px">${last.detail}</div>
      <div id="khiRouterError" style="margin-top:3px;color:var(--muted)"></div>
      <div class="ml-actions" style="margin-top:8px">
        <button class="secondary" id="khiLiveCloudTest" type="button">Проверить реальный Cloud Brain</button>
      </div>
      <div id="khiLiveCloudResult" style="margin-top:6px;color:var(--muted)">
        Этот тест проходит через тот же Router, что и обычный разговор, а не через технический /test.
      </div>
    </div>`;
  }

  function setText(el,value){
    if(el&&el.textContent!==value)el.textContent=value;
  }

  function updateDiagnostics(){
    const r=document.querySelector("#khiRouterRoute");
    const d=document.querySelector("#khiRouterDetail");
    const e=document.querySelector("#khiRouterError");
    setText(r,`Последний маршрут: ${label(last.route)}`);
    setText(d,last.detail||"");
    setText(e,last.error?`Ошибка cloud: ${last.error}`:"");
  }

  async function liveCloudTest(button,result){
    if(button)button.disabled=true;
    if(result)result.textContent="Проверяю настоящий пользовательский маршрут…";
    try{
      const answer=await reply(
        "Привет! Ответь одной короткой фразой, что облачный диалог Kitsune работает.",
        null,
        []
      );
      const ok=last.route==="cloud";
      if(result){
        result.textContent=ok
          ?`✅ Реальный Cloud Brain работает. Ответ: ${String(answer).slice(0,180)}`
          :`⚠️ Тест не дошёл до Qwen Cloud. Фактический маршрут: ${label(last.route)}. ${last.error||last.detail}`;
      }
    }catch(error){
      if(result)result.textContent=`❌ Тест прерван: ${String(error?.message||error)}`;
    }finally{
      if(button)button.disabled=false;
      updateDiagnostics();
    }
  }

  function addControls(){
    const host=document.querySelector(".khi-panel");
    document.body.classList?.toggle("kitsune-adult-tools",!!host);
    if(!host)return;

    if(!host.querySelector("#khiChatConsent")){
      const labelEl=document.createElement("label");
      labelEl.className="sx-switch";
      labelEl.innerHTML='<input type="checkbox" id="khiChatConsent"><span><b>Разрешить облачный разговор и голос</b><small>В Cloudflare и Alibaba передаётся только текущая безопасная текстовая реплика и текст ответа для озвучивания. История, профиль, условие задания, Mastery, фото и запись микрофона остаются на устройстве.</small></span>';
      const input=labelEl.querySelector("input");
      input.checked=consented();
      input.onchange=()=>{
        try{
          if(input.checked)localStorage.setItem(KEY,"1");
          else localStorage.removeItem(KEY);
        }catch{}
        cancel();
        setRoute(
          "local",
          input.checked
            ?"Cloud Qwen разрешён взрослым; Router может использовать его автоматически."
            :"Cloud Qwen отключён взрослым; ответы остаются локальными."
        );
      };
      host.append(labelEl);
    }

    if(!host.querySelector("#khiRouterRuntime")){
      host.insertAdjacentHTML("beforeend",diagnosticsMarkup());
      host.querySelector("#khiLiveCloudTest")?.addEventListener("click",event=>{
        liveCloudTest(event.currentTarget,host.querySelector("#khiLiveCloudResult"));
      });
    }
    updateDiagnostics();
  }

  window.KitsuneRouter={
    version:VERSION,
    reply,
    cancel,
    consented,
    route:()=>route,
    lastRoute:()=>({...last}),
    eligible,
    obviousMath,
    liveCloudTest:()=>reply("Привет! Ответь одной короткой фразой, что облачный диалог Kitsune работает.",null,[])
  };

  brain.chat=reply;

  let controlsScheduled=false;
  const controlsObserver=new MutationObserver(()=>{
    if(controlsScheduled)return;
    controlsScheduled=true;
    requestAnimationFrame(()=>{
      controlsScheduled=false;
      addControls();
    });
  });
  controlsObserver.observe(document.body,{childList:true,subtree:true});
  addControls();
  window.addEventListener("pagehide",cancel);
})();
