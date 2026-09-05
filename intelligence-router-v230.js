/* Cloud receives only eligible current text. Local context/history never leave here. */
(() => {
  "use strict";
  const KEY="kitsune_cloud_chat_consent_v230";
  const brain=window.KitsuneBrain,local=brain.chat.bind(brain);
  let active=null,route="local";
  function consented(){try{return localStorage.getItem(KEY)==="1"}catch{return false}}
  function cancel(){active?.abort();active=null;window.KitsuneCharacterVoice?.stop?.()}
  function eligible(text,ctx){
    return !ctx&&text.length<=500&&
      !/[\d=<>≤≥√²^+*/@]|https?:|www\./i.test(text)&&
      !/(меня зовут|мо[йяё]\s+(имя|адрес|школ|телефон|пароль)|живу|фамили|паспорт)/i.test(text)&&
      /(уч[её]б|математ|алгебр|поня|объясн|устал|сложно|трудно|привет|спасибо|интерес|мотивац|настроен)/i.test(text);
  }
  async function reply(message,ctx=null,history=[]){
    cancel();const controller=new AbortController();active=controller;
    const text=String(message||"").trim();
    const safety=brain.safetyCheck(text);if(safety)return safety.reply;
    const tool=await Promise.resolve(window.KitsuneTutorTools?.dispatch?.(text,ctx)).catch(()=>null);
    if(controller.signal.aborted)throw new DOMException("Cancelled","AbortError");
    if(tool?.handled){route="course";return brain.safeReply(tool.text)}
    if(window.KitsuneMath?.looksMath(text)||/\d\s*[-+*/]\s*\d/.test(text)){
      route="math";
      try{
        const result=await window.KitsuneMath.analyze(text);
        if(controller.signal.aborted)throw new DOMException("Cancelled","AbortError");
        return brain.safeReply(brain.localMathExplanation(text,result));
      }catch(error){if(error.name==="AbortError")throw error;return "Не удалось надёжно разобрать выражение. Запиши его в Math Lab — проверим шаг за шагом."}
    }
    if(consented()&&window.KitsuneHybridInfrastructure?.consented()&&navigator.onLine&&eligible(text,ctx)){
      const timeout=setTimeout(()=>controller.abort(),22000);
      try{
        const result=await window.KitsuneHybridInfrastructure.cloudRequest("chat",text,{signal:controller.signal});
        if(active!==controller)throw new DOMException("Cancelled","AbortError");
        const answer=String(result.answer||"").trim();
        if(!answer)throw new Error("empty_answer");
        route="cloud";return brain.safeReply(answer);
      }catch(error){if(active!==controller)throw new DOMException("Cancelled","AbortError")}
      finally{clearTimeout(timeout)}
    }
    route="local";
    try{return await local(text,ctx,history)}catch{return brain.dialogFallback(text,ctx)}
  }
  function addConsent(){
    const host=document.querySelector(".khi-panel");
    document.body.classList?.toggle("kitsune-adult-tools",!!host);
    if(!host||host.querySelector("#khiChatConsent"))return;
    const label=document.createElement("label");label.className="sx-switch";
    label.innerHTML='<input type="checkbox" id="khiChatConsent"><span><b>Разрешить облачный разговор и голос</b><small>Текст текущей реплики и озвучиваемого ответа проходит через Cloudflare и Alibaba. История, профиль, задания, фото и запись микрофона остаются на устройстве. Сервер приложения не сохраняет диалоги. Доступность зависит от сети.</small></span>';
    const input=label.querySelector("input");input.checked=consented();
    input.onchange=()=>{try{if(input.checked)localStorage.setItem(KEY,"1");else localStorage.removeItem(KEY)}catch{};cancel()};
    host.append(label);
  }
  window.KitsuneRouter={reply,cancel,consented,route:()=>route,eligible};
  brain.chat=reply;
  new MutationObserver(addConsent).observe(document.body,{childList:true,subtree:true});addConsent();
  window.addEventListener("pagehide",cancel);
})();
