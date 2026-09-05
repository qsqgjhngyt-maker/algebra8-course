/* =====================================================================
   Kitsune v2.3.0-beta.3 · Universal Cloud Chat Router
   - Safe ordinary conversation uses Qwen Cloud by default when adult consent
     is enabled, even while an exercise is open.
   - Explicit task help stays in local Tutor/Math Engine.
   - Exact math stays deterministic/local.
   - Cloud receives ONLY the current text message. No task ctx/history/Mastery.
   ===================================================================== */
(() => {
  "use strict";

  const VERSION="2.3.0-beta.3.2";
  const brain=window.KitsuneBrain;
  const local=brain.chat.bind(brain);

  let active=null;
  let route="local";
  let last={route:"local",detail:"Ещё не было пользовательских запросов.",error:"",ts:0};

  const LABELS={
    "course":"Course tools · local",
    "math":"Math Engine · local",
    "cloud":"Qwen Cloud",
    "local":"Local Brain / Smart Tutor",
    "local-fallback":"Cloud → Local fallback",
    "safety":"Safety Guard · local"
  };

  function consented(){
    return !!window.KitsuneHybridInfrastructure?.consented?.();
  }
  function label(value){return LABELS[value]||value}

  function cancel(){
    active?.abort();
    active=null;
  }

  function setText(el,value){
    if(el&&el.textContent!==value)el.textContent=value;
  }

  function formatCloudError(error){
    const raw=String(error||"");
    const prefixes={
      "chat_provider_diag":"Alibaba Qwen Chat",
      "chat_stream_diag":"Alibaba Qwen Stream",
      "credential_provider_diag":"Alibaba Temporary Credential"
    };
    const prefix=Object.keys(prefixes).find(key=>raw.startsWith(key+"|"));
    if(prefix){
      const parts=raw.split("|");
      const http=parts[1]||"HTTP ?";
      const code=parts[2]||"unknown";
      const message=parts.slice(3).join("|")||"no message";
      return `${prefixes[prefix]}: ${http} · ${code} · ${message}`;
    }
    return raw;
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

  /* Only phrases that clearly refer to the currently opened exercise stay
     in the local tutor lane. Everything else is ordinary conversation. */
  function isTaskIntent(text,ctx){
    if(!ctx?.exercise)return false;
    const s=String(text||"").toLowerCase();
    return /(?:это\s+задани|это\s+упражн|этот\s+пример|в\s+этом\s+(?:задани|пример)|вот\s+здесь|почему\s+здесь|почему\s+тут|что\s+дальше|следующ(?:ий|его)\s+шаг|дай\s+подсказ|подсказк|разбер(?:и|ём)\s+(?:это|задани|пример)|объясни\s+(?:это|задани|пример|шаг)|не\s+понимаю\s+(?:задани|пример|этот\s+шаг)|проверь\s+(?:мой|этот)\s+шаг|мой\s+ответ|правильн(?:ый|о)\s+ли\s+(?:ответ|решение)|почему\s+(?:меняется|поменялся)\s+знак)/i.test(s);
  }

  function eligible(text){
    const s=String(text||"").trim();
    if(!s||s.length>700||obviousMath(s))return false;
    if(/https?:|www\./i.test(s))return false;
    if(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.test(s))return false;
    if(/(?:\+?\d[\d\s()\-]{8,}\d)/.test(s))return false;
    if(/(?:меня зовут|мо[йяё]\s+(?:имя|адрес|школ|телефон|пароль)|живу|фамили|паспорт|точн(?:ый|ое)\s+местополож)/i.test(s))return false;
    if(/(?:мне|я)\s+\d{1,2}\s*(?:лет|года?)/i.test(s))return false;
    return true;
  }

  function cloudReady(text){
    return consented() &&
      navigator.onLine &&
      eligible(text);
  }

  async function localTaskReply(text,ctx,controller){
    const tool=await Promise.resolve(window.KitsuneTutorTools?.dispatch?.(text,ctx)).catch(()=>null);
    if(controller.signal.aborted)throw new DOMException("Cancelled","AbortError");
    if(tool?.handled){
      setRoute("course","Вопрос относится к открытому заданию; ответ получен из локальных инструментов курса.");
      return brain.safeReply(tool.text);
    }
    try{
      setRoute("local","Вопрос относится к открытому заданию; использован локальный Tutor.");
      return await local(text,ctx,[]);
    }catch{
      return brain.dialogFallback(text,ctx);
    }
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

    /* Deterministic math always has priority over language models. */
    if(obviousMath(text)){
      setRoute("math","Конкретную математику считает только детерминированный Math Engine.");
      try{
        const result=await window.KitsuneMath.analyze(text);
        if(controller.signal.aborted)throw new DOMException("Cancelled","AbortError");
        return brain.safeReply(brain.localMathExplanation(text,result));
      }catch(error){
        if(error?.name==="AbortError")throw error;
        setRoute("math","Math Engine не смог надёжно разобрать запись.",formatCloudError(error?.message||error));
        return "Не удалось надёжно разобрать выражение. Запиши его в Math Lab — проверим шаг за шагом.";
      }
    }

    /* Explicit help with the current exercise stays local. General chat does
       NOT get captured by TutorTools merely because an exercise is open. */
    if(isTaskIntent(text,ctx)){
      return localTaskReply(text,ctx,controller);
    }

    /* General safe conversation: Qwen is the primary lane. */
    if(cloudReady(text)){
      const timeout=setTimeout(()=>controller.abort(),24000);
      try{
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
            ?"Qwen Cloud ответил на обычный вопрос внутри урока. Условие задания и история чата не отправлялись."
            :"Qwen Cloud ответил на обычный безопасный вопрос."
        );
        return brain.safeReply(answer);
      }catch(error){
        if(active!==controller)throw new DOMException("Cancelled","AbortError");
        setRoute(
          "local-fallback",
          "Cloud Brain не ответил — только тогда включён локальный fallback.",
          formatCloudError(error?.message||error||"cloud_failed")
        );
      }finally{
        clearTimeout(timeout);
      }
    }else{
      setRoute(
        "local",
        navigator.onLine
          ?"Cloud недоступен/не разрешён для этой реплики; используется локальный fallback."
          :"Нет сети — используется локальный интеллект."
      );
    }

    try{
      return await local(text,ctx,history);
    }catch{
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
        Тест проходит через тот же Router, что и обычный разговор.
      </div>
    </div>`;
  }

  function updateDiagnostics(){
    setText(document.querySelector("#khiRouterRoute"),`Последний маршрут: ${label(last.route)}`);
    setText(document.querySelector("#khiRouterDetail"),last.detail||"");
    setText(document.querySelector("#khiRouterError"),last.error?`Ошибка cloud: ${last.error}`:"");
  }

  async function liveCloudTest(button,result){
    if(button)button.disabled=true;
    if(result)result.textContent="Проверяю настоящий пользовательский маршрут…";
    try{
      const answer=await reply(
        "Привет! Скажи одной короткой фразой, что ты отвечаешь сейчас именно через облачный интеллект.",
        null,
        []
      );
      const ok=last.route==="cloud";
      if(result){
        result.textContent=ok
          ?`✅ Реальный Cloud Brain работает. Ответ: ${String(answer).slice(0,220)}`
          :`⚠️ Реплика не дошла до Qwen. Маршрут: ${label(last.route)}. ${last.error||last.detail}`;
      }
    }catch(error){
      if(result)result.textContent=`❌ Тест: ${formatCloudError(error?.message||error)}`;
    }finally{
      if(button)button.disabled=false;
      updateDiagnostics();
    }
  }

  function addControls(){
    const host=document.querySelector(".khi-panel");
    document.body.classList?.toggle("kitsune-adult-tools",!!host);
    if(!host)return;

    if(!host.querySelector("#khiChatPolicy")){
      const box=document.createElement("div");
      box.id="khiChatPolicy";
      box.className="khi-detail show";
      box.style.marginTop="10px";
      box.innerHTML='<b>☁️ Универсальный Cloud Chat</b><div id="khiChatPolicyText" style="margin-top:5px;color:var(--muted)"></div>';
      host.append(box);
    }
    const policyText=host.querySelector("#khiChatPolicyText");
    setText(
      policyText,
      consented()
        ?"Разрешение взрослого активно: обычный безопасный разговор идёт в Qwen Cloud. Явная помощь по заданию и точная математика остаются локальными."
        :"Cloud Brain пока не разрешён взрослым — разговор останется локальным."
    );

    if(!host.querySelector("#khiRouterRuntime")){
      host.insertAdjacentHTML("beforeend",diagnosticsMarkup());
      host.querySelector("#khiLiveCloudTest")?.addEventListener("click",event=>{
        liveCloudTest(event.currentTarget,host.querySelector("#khiLiveCloudResult"));
      });
    }
    updateDiagnostics();
  }

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

  window.__KITSUNE_ROUTER_ACTIVE_VERSION__=VERSION;
  window.KitsuneRouter={
    version:VERSION,
    reply,
    cancel,
    consented,
    route:()=>route,
    lastRoute:()=>({...last}),
    eligible,
    obviousMath,
    isTaskIntent
  };

  brain.chat=reply;
  addControls();
  window.addEventListener("pagehide",cancel);
})();
