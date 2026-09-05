/* Kitsune v2.3.0-beta.1 · Cloud routing visibility
   Cloud receives only the current safe text. History, ctx, Mastery, photos
   and raw microphone audio remain local. Mathematical computation stays local. */
(() => {
  "use strict";

  const KEY="kitsune_cloud_chat_consent_v230";
  const brain=window.KitsuneBrain;
  const local=brain.chat.bind(brain);

  let active=null;
  let route="local";
  let last={route:"local",detail:"Ещё не было запросов",ts:0};

  const LABELS={
    "course":"Course tools",
    "math":"Math Engine · local",
    "cloud":"Qwen Cloud",
    "local":"Local Brain / Smart Tutor",
    "local-fallback":"Local fallback"
  };

  function consented(){
    try{return localStorage.getItem(KEY)==="1"}catch{return false}
  }

  function routeLabel(value){return LABELS[value]||value}

  function updateRouteUi(){
    const host=document.querySelector(".khi-panel");
    if(!host)return;

    let box=host.querySelector("#khiRouteDiag");
    if(!box){
      box=document.createElement("div");
      box.id="khiRouteDiag";
      box.className="khi-detail show";
      box.style.marginTop="10px";
      host.append(box);
    }

    const when=last.ts?new Date(last.ts).toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit",second:"2-digit"}):"—";
    box.innerHTML=`<b>Последний маршрут: ${routeLabel(last.route)}</b><br><span>${last.detail||""}${last.ts?` · ${when}`:""}</span>`;
  }

  function setRoute(next,detail=""){
    route=next;
    last={route:next,detail,ts:Date.now()};
    updateRouteUi();
    try{
      window.dispatchEvent(new CustomEvent("kitsune-intelligence-route",{detail:{...last}}));
    }catch{}
  }

  function cancel(){
    active?.abort();
    active=null;
    window.KitsuneCharacterVoice?.stop?.();
  }

  function obviousMath(text){
    return !!(
      window.KitsuneMath?.looksMath?.(text) ||
      /\d\s*[-+*/]\s*\d/.test(text) ||
      /[=<>≤≥√²^]/.test(text) ||
      /(?:^|\s)(?:реши|вычисли|посчитай|рассчитай)\b/i.test(text) ||
      /(?:найди|определи)\s+(?:x|икс|корни?|дискриминант)\b/i.test(text)
    );
  }

  function eligible(text){
    if(!text||text.length>500)return false;

    /* Text-only cloud lane. Exact calculations are routed to Math Engine. */
    if(obviousMath(text))return false;

    /* Do not send links or obvious personal identifiers to the provider. */
    if(/https?:|www\./i.test(text))return false;
    if(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.test(text))return false;
    if(/(?:\+?\d[\d\s()\-]{8,}\d)/.test(text))return false;
    if(/(?:меня зовут|мо[йяё]\s+(?:имя|адрес|школ|телефон|пароль)|живу|фамили|паспорт|точн(?:ый|ое)\s+местополож)/i.test(text))return false;
    if(/(?:мне|я)\s+\d{1,2}\s*(?:лет|года?)/i.test(text))return false;

    return true;
  }

  async function reply(message,ctx=null,history=[]){
    cancel();
    const controller=new AbortController();
    active=controller;
    const text=String(message||"").trim();

    const safety=brain.safetyCheck(text);
    if(safety){
      setRoute("local","Safety Guard");
      return safety.reply;
    }

    const tool=await Promise.resolve(window.KitsuneTutorTools?.dispatch?.(text,ctx)).catch(()=>null);
    if(controller.signal.aborted)throw new DOMException("Cancelled","AbortError");

    if(tool?.handled){
      setRoute("course","Ответ получен из локальных инструментов курса");
      return brain.safeReply(tool.text);
    }

    if(obviousMath(text)){
      setRoute("math","Вычисление выполняет детерминированный Math Engine");
      try{
        const result=await window.KitsuneMath.analyze(text);
        if(controller.signal.aborted)throw new DOMException("Cancelled","AbortError");
        return brain.safeReply(brain.localMathExplanation(text,result));
      }catch(error){
        if(error.name==="AbortError")throw error;
        return "Не удалось надёжно разобрать выражение. Запиши его в Math Lab — проверим шаг за шагом.";
      }
    }

    const cloudReady=
      consented() &&
      window.KitsuneHybridInfrastructure?.consented?.() &&
      navigator.onLine &&
      eligible(text);

    if(cloudReady){
      const timeout=setTimeout(()=>controller.abort(),22000);
      try{
        /* Important: ctx and history are intentionally NOT sent. Only text. */
        const result=await window.KitsuneHybridInfrastructure.cloudRequest(
          "chat",
          text,
          {signal:controller.signal}
        );
        if(active!==controller)throw new DOMException("Cancelled","AbortError");

        const answer=String(result.answer||"").trim();
        if(!answer)throw new Error("empty_answer");

        setRoute("cloud",ctx
          ?"Qwen ответил на текущую реплику внутри урока; данные задания остались локально"
          :"Qwen ответил на безопасную текущую реплику"
        );
        return brain.safeReply(answer);
      }catch(error){
        if(active!==controller)throw new DOMException("Cancelled","AbortError");
        setRoute("local-fallback","Cloud недоступен или отклонил запрос — использован локальный ответ");
      }finally{
        clearTimeout(timeout);
      }
    }else{
      setRoute("local",navigator.onLine
        ?"Реплика оставлена локально по правилам Router"
        :"Нет сети — используется локальный интеллект"
      );
    }

    try{
      return await local(text,ctx,history);
    }catch{
      return brain.dialogFallback(text,ctx);
    }
  }

  function addControls(){
    const host=document.querySelector(".khi-panel");
    document.body.classList?.toggle("kitsune-adult-tools",!!host);
    if(!host)return;

    if(!host.querySelector("#khiChatConsent")){
      const label=document.createElement("label");
      label.className="sx-switch";
      label.innerHTML='<input type="checkbox" id="khiChatConsent"><span><b>Разрешить облачный разговор и голос</b><small>В Cloudflare и Alibaba передаётся только текущая безопасная текстовая реплика и текст ответа для озвучивания. История, профиль, задание, Mastery, фото и запись микрофона остаются на устройстве.</small></span>';
      const input=label.querySelector("input");
      input.checked=consented();
      input.onchange=()=>{
        try{
          if(input.checked)localStorage.setItem(KEY,"1");
          else localStorage.removeItem(KEY);
        }catch{}
        cancel();
        setRoute("local",input.checked
          ?"Cloud Qwen разрешён взрослым; Router будет использовать его автоматически"
          :"Cloud Qwen отключён; все ответы остаются локальными"
        );
      };
      host.append(label);
    }

    updateRouteUi();
  }

  window.KitsuneRouter={
    reply,
    cancel,
    consented,
    route:()=>route,
    lastRoute:()=>({...last}),
    eligible,
    obviousMath
  };

  brain.chat=reply;

  new MutationObserver(addControls).observe(document.body,{childList:true,subtree:true});
  addControls();
  window.addEventListener("pagehide",cancel);
})();
