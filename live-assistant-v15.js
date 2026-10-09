
/* =====================================================================
   v1.5 · «АЛЬФИ» — ЖИВОЙ ИНТЕРАКТИВНЫЙ ПОМОЩНИК
   Офлайн-логика: понимает текущий экран/урок, реагирует на ответы и подсказывает.
   ===================================================================== */
const v15AssistantKey="a8_assistant_mode";
const v15GreetingKey="a8_assistant_greeting";
const v15Modes=["active","advice","off"];
const v15ModeNames={active:"активный",advice:"только советы",off:"выкл."};
const v15Reduce=window.matchMedia("(prefers-reduced-motion: reduce)");

let v15Mode="active";
try{v15Mode=localStorage.getItem(v15AssistantKey)||"active"}catch(e){}
if(!v15Modes.includes(v15Mode))v15Mode="active";

let v15State="idle";

/* v1.6.1 · Живая озвучка Kitsune */
const v151VoiceEnabledKey="a8_alfi_voice_enabled";
const v151VoiceAutoKey="a8_alfi_voice_auto";
let v151VoiceEnabled=true;
let v151VoiceAuto=false;
let v151SpeechUnlocked=false;
let v151Speaking=false;
let v151VoiceNotice="";

function v151IsIOSLike(){
  const ua=String(navigator.userAgent||"");
  const platform=String(navigator.platform||"");
  return /iPhone|iPad|iPod/i.test(ua) ||
    (platform==="MacIntel"&&Number(navigator.maxTouchPoints)>1);
}
let v161SpeechRun=0;
let v161SpeechTimer=null;
let v151AutoSpeechTimer=null;
try{
  const e=localStorage.getItem(v151VoiceEnabledKey);
  v151VoiceEnabled=e===null?true:e==="1";
  v151VoiceAuto=localStorage.getItem(v151VoiceAutoKey)==="1";
}catch(e){}


let v15TypeTimer=null;
let v15IdleTimer=null;
let v15LastView="";
let v15WrongStreak=0;
let v15RightStreak=0;
let v15LastSpoken="";
let v15LastReactionAt=0;

function v15Strip(s){
  if(!s)return "";
  const d=document.createElement("div");
  d.innerHTML=String(s);
  return (d.textContent||"").replace(/\s+/g," ").trim();
}
function v15Short(s,n=175){
  s=v15Strip(s);
  if(s.length<=n)return s;
  const cut=s.slice(0,n);
  const i=Math.max(cut.lastIndexOf(". "),cut.lastIndexOf("; "),cut.lastIndexOf(", "));
  return (i>70?cut.slice(0,i+1):cut.trimEnd()+"…");
}
function v15CurrentLessonId(){
  if(!document.querySelector(".lesson-panel"))return null;
  try{return state?.lastLesson||null}catch(e){return null}
}
function v15Lesson(){
  const id=v15CurrentLessonId();
  try{return id&&lessonData?.[id]?{id,data:lessonData[id]}:null}catch(e){return null}
}
function v15TopicAdvice(id){
  try{
    const d=lessonData?.[id];
    if(!d)return "Сначала определи, что дано, что нужно найти и какое правило связывает эти величины.";
    if(d.remember)return v15Short(d.remember,180);
    if(d.formula)return "Главная опора здесь: "+v15Short(d.formula,155);
    if(d.summary?.length)return v15Short(d.summary[0],175);
    return "Попробуй сначала назвать правило своими словами, а затем применить его к примеру.";
  }catch(e){
    return "Разбей задачу на маленькие шаги: что известно → какое правило подходит → вычисление → проверка.";
  }
}
function v15SimpleAdvice(id){
  try{
    const d=lessonData?.[id];
    const s=d?.levels?.simple||d?.simple||d?.lead;
    return s?v15Short(s,185):"Не пытайся сделать всё сразу. Найди один первый понятный шаг и выполни только его.";
  }catch(e){
    return "Не пытайся сделать всё сразу. Найди один первый понятный шаг и выполни только его.";
  }
}
function v15MistakeAdvice(id){
  try{
    const d=lessonData?.[id];
    if(d?.mistake)return "Проверь вот это место: "+v15Short(d.mistake,165);
  }catch(e){}
  return "Проверь знак, порядок действий и ограничения задачи. Часто ошибка прячется именно там.";
}

function v15Svg(){
  /* v1.10: вместо примитивного SVG — полноценный арт Kitsune.
     Два слоя позволяют плавно crossfade'ить разговорные/эмоциональные кадры
     без резкого «прыгающего рта». */
  return `
  <span class="v110-kitsune-stage" id="v110KitsuneStage" aria-hidden="true">
    <span class="v110-kitsune-glow"></span>
    <img class="v110-kitsune-fallback" src="./assets/kitsune/idle.png" alt="" draggable="false" decoding="async">
    <span class="v110-kitsune-frame is-active" id="v110KitsuneFrameA" data-frame="idle"></span>
    <span class="v110-kitsune-frame" id="v110KitsuneFrameB" data-frame="idle"></span>
    <span class="v110-kitsune-emote" id="v110KitsuneEmote"></span>
    <span class="v110-kitsune-sparkles" aria-hidden="true">
      <i></i><i></i><i></i><i></i>
    </span>
  </span>`;
}
function v15Markup(){
  return `<div class="v15-assistant" id="v15Assistant" data-mode="${v15Mode}" data-state="idle" aria-live="polite">
    <div class="v15-speech" id="v15Speech">
      <div class="v15-speech-head">
        <strong>🦊 Kitsune</strong><span class="v15-speech-status" id="v15SpeechStatus">помощник</span>
        <span class="v15-speech-spacer"></span>
        <button class="v15-round-btn" id="v15SpeakBtn" title="Прочитать совет вслух" aria-label="Прочитать совет вслух">🔊</button>
        <button class="v15-round-btn" id="v15SettingsBtn" title="Настройки помощника" aria-label="Настройки помощника">⚙</button>
        <button class="v15-round-btn" id="v15CloseBtn" title="Свернуть" aria-label="Свернуть помощника">×</button>
      </div>
      <div class="v15-message" id="v15Message">Я рядом. Если понадобится — подскажу.</div>
      <div class="v15-actions">
        <button class="v15-action primary-action" id="v15TipBtn">💡 Совет</button>
        <button class="v15-action" id="v15SimpleBtn">🌱 Объясни проще</button>
      </div>
      <button type="button" class="v15-action v151-auto-toggle" id="v151AutoVoiceToggle" aria-pressed="false">Автоозвучка: выкл.</button>
      <div class="v15-settings" id="v15Settings">
        <span class="v15-settings-label">Как часто Kitsune вмешивается</span>
        <div class="v15-mode-row">
          <button class="v15-mode-btn" data-mode-choice="active">✨ Активный</button>
          <button class="v15-mode-btn" data-mode-choice="advice">💡 Советы</button>
          <button class="v15-mode-btn" data-mode-choice="off">🙈 Выкл.</button>
        </div>

        <div class="v151-voice-settings" id="v151VoiceSettings">
          <div class="v151-voice-title">
            <span>🎙️ Голос Kitsune</span>
            <button class="v151-toggle" id="v151VoiceEnabledBtn" type="button" aria-pressed="true">Вкл.</button>
          </div>
          <label class="v151-auto-row">
            <input type="checkbox" id="v151AutoVoice">
            <span><b>Автоозвучка</b><small>Kitsune читает своим голосом. Можно выключить в любой момент.</small></span>
          </label>
          <div class="v151-voice-actions">
            <button type="button" class="v15-action primary-action" id="v151TestVoice">▶ Послушать Kitsune</button>
            <button type="button" class="v15-action" id="v151TestGenerator" disabled>✨ Создать новую фразу</button>
            <button type="button" class="v15-action" id="v151DownloadVoice">⬇ Сохранить голос офлайн</button>
            <button type="button" class="v15-action" id="v151InstallGenerator">⬇ Сохранить генератор · около 600 МБ</button>
            <span class="v151-voice-note" id="v151VoiceNote">Голос Kitsune · готовые записи</span>
          </div>
        </div>
      </div>
    </div>
    <div class="v15-tip-chip" id="v15TipChip"></div>
    <div class="v15-streak-pop" id="v15StreakPop"></div>
    <button class="v15-mascot-button" id="v15MascotBtn" aria-label="Открыть помощника Kitsune">
      ${v15Svg()}
    </button>
    <span class="v15-status-dot" aria-hidden="true"></span>
  </div>`;
}
function v15Ensure(){
  let root=document.querySelector("#v15Assistant");
  if(root)return root;

  if(!document.querySelector("#v15Scrim")){
    document.body.insertAdjacentHTML(
      "beforeend",
      '<div class="v15-scrim" id="v15Scrim" aria-hidden="true"></div>'
    );
  }

  document.body.insertAdjacentHTML("beforeend",v15Markup());
  root=document.querySelector("#v15Assistant");
  v15Bind();
  v15ApplyMode(v15Mode,false);
  return root;
}
function v15SetState(stateName){
  const root=v15Ensure();
  v15State=stateName||"idle";
  root.dataset.state=v15State;
  const mouth=root.querySelector(".mouth");
  if(mouth){
    const paths={
      idle:"M43 57 Q50 62 57 57",
      wave:"M42 56 Q50 64 58 56",
      think:"M45 59 Q50 57 55 59",
      explain:"M43 57 Q50 62 57 57",
      happy:"M40 55 Q50 66 60 55",
      oops:"M42 59 Q50 53 58 59",
      focus:"M43 58 L57 58",
      cheer:"M40 55 Q50 67 60 55",
      celebrate:"M40 55 Q50 67 60 55",
      sleep:"M45 59 Q50 60 55 59"
    };
    mouth.setAttribute("d",paths[v15State]||paths.idle);
  }
}
function v15SetMode(mode,save=true){
  if(!v15Modes.includes(mode))mode="active";
  v15Mode=mode;
  if(save)try{localStorage.setItem(v15AssistantKey,mode)}catch(e){}
  v15ApplyMode(mode,false);
  if(mode==="off"){
    v15Close();
  }else{
    v15SetState("wave");
    v15Chip(mode==="active"?"Kitsune снова с нами 👋":"Советы включены 💡");
    setTimeout(()=>v15SetState("idle"),900);
  }
}
function v15ApplyMode(mode){
  const root=v15Ensure();
  root.dataset.mode=mode;
  root.querySelectorAll("[data-mode-choice]").forEach(b=>b.classList.toggle("active",b.dataset.modeChoice===mode));
  const sidebar=document.querySelector("#assistantModeBtn");
  if(sidebar){
    sidebar.dataset.assistantMode=mode;
    sidebar.textContent=mode==="active"?"🦊 Kitsune: активный":mode==="advice"?"💡 Kitsune: советы":"🙈 Kitsune: выкл.";
    sidebar.title=document.documentElement.dataset.design==="classic"
      ?"Режим Kitsune (персонаж показывается в игровом дизайне)"
      :"Переключить режим Kitsune";
  }
  const st=root.querySelector("#v15SpeechStatus");
  if(st)st.textContent=mode==="active"?"активный помощник":mode==="advice"?"только по запросу":"выключен";
}
function v15Open(){
  if(v15Mode==="off")return;
  const root=v15Ensure();
  root.classList.add("open");
  document.body.classList.add("v15-assistant-open");
  const scrim=document.querySelector("#v15Scrim");
  scrim?.setAttribute("aria-hidden","false");
}
function v15Close(){
  document.querySelector("#v15Assistant")?.classList.remove("open");
  document.body.classList.remove("v15-assistant-open");
  document.querySelector("#v15Scrim")?.setAttribute("aria-hidden","true");
}
function v15Chip(text){
  if(v15Mode==="off")return;
  const chip=v15Ensure().querySelector("#v15TipChip");
  chip.textContent=text;
  chip.classList.remove("show");
  void chip.offsetWidth;
  chip.classList.add("show");
}
function v15Streak(text){
  const pop=v15Ensure().querySelector("#v15StreakPop");
  pop.textContent=text;
  pop.classList.remove("show");
  void pop.offsetWidth;
  pop.classList.add("show");
}
function v15Message(text,{state="explain",open=true,typing=true}={}){
  if(v15Mode==="off")return;
  const root=v15Ensure(),box=root.querySelector("#v15Message");
  v15SetState(state);
  clearInterval(v15TypeTimer);
  v15LastSpoken=v15Strip(text);
  v151AutoSpeak(v15LastSpoken,state);

  if(!typing||v15Reduce.matches){
    box.textContent=v15LastSpoken;
    box.classList.remove("typing");
  }else{
    box.textContent="";
    box.classList.add("typing");
    let i=0;
    const full=v15LastSpoken;
    const step=Math.max(1,Math.ceil(full.length/75));
    v15TypeTimer=setInterval(()=>{
      i=Math.min(full.length,i+step);
      box.textContent=full.slice(0,i);
      if(i>=full.length){
        clearInterval(v15TypeTimer);
        box.classList.remove("typing");
      }
    },18);
  }
  if(open)v15Open();
}
function v151SaveVoice(){
  try{
    localStorage.setItem(v151VoiceEnabledKey,v151VoiceEnabled?"1":"0");
    localStorage.setItem(v151VoiceAutoKey,v151VoiceAuto?"1":"0");
  }catch(e){}
}
function v161StopSpeech(){
  window.KitsuneReading?.stopped?.();
  clearTimeout(v151AutoSpeechTimer);
  v151AutoSpeechTimer=null;
  window.KitsuneStaticVoice?.stop();
  window.KitsuneDynamicVoice?.stop();
  v161SpeechRun++;
  clearTimeout(v161SpeechTimer);
  v161SpeechTimer=null;
  try{speechSynthesis.cancel()}catch(e){}
  v151Speaking=false;
  document.querySelector("#v15SpeakBtn")?.classList.remove("speaking");
}
function v161MarkSpeaking(on,state){
  v151Speaking=on;
  if(on)v151VoiceNotice="";
  document.querySelector("#v15SpeakBtn")?.classList.toggle("speaking",on);
  if(on)v15SetState(state);
  v151UpdateVoiceUi();
}
function v151StopSpeaking(){
  return window.v161StopSpeech?.();
}
function v151IsSpeechBusy(){
  return v151Speaking||v161SpeechTimer!==null||
    !!window.KitsuneReading?.isBusy?.()||
    !!window.KitsuneStaticVoice?.isBusy?.()||
    !!window.KitsuneDynamicVoice?.isBusy?.()||
    !!window.AlfiNeuralVoice?.isBusy?.()||
    !!window.speechSynthesis?.speaking||!!window.speechSynthesis?.pending;
}
function v151Speak(text=v15LastSpoken,{state=v15State,force=false,onDone=null,onError=null,lessonOwner=null,readingOwner=null}={}){
  let completed=false;
  const done=()=>{if(!completed){completed=true;onDone?.();}};
  const unavailable=(reason)=>{
    if(completed)return;
    const message=typeof reason==='string'?reason:"Для этого текста запись Kitsune ещё не подготовлена.";
    v151VoiceNotice=message;
    const note=document.querySelector("#v151VoiceNote");
    if(note)note.textContent=message;
    v151UpdateVoiceUi();
    if(force)window.KitsuneRuntimeStability?.toast?.(message);
    try{onError?.(message);}catch{}
    done();
  };
  if(!text)return false;
  if(!v151VoiceEnabled){if(force)unavailable("Включи голос Kitsune кнопкой «Вкл.» в настройках.");return false;}
  if(!force&&(!v151SpeechUnlocked||v151IsSpeechBusy()))return false;
  window.KitsuneLessonVoice?.speechRequested?.(lessonOwner);
  window.KitsuneReading?.requested?.(readingOwner);
  v151VoiceNotice="";
  if(window.KitsuneStaticVoice?.trySpeak(text,{state,force,onDone:done},unavailable))return true;
  if(window.KitsuneDynamicVoice?.trySpeak(text,{state,force,onDone:done},unavailable))return true;
  if(force)window.v161StopSpeech?.();
  unavailable(window.KitsuneDynamicVoice?.info?.().reason);
  return false;
}
function v15Speak(){
  v151SpeechUnlocked=true;
  if(window.KitsuneReading?.snapshot?.()?.phase==="paused"){
    window.KitsuneReading.resume();return;
  }
  if(v151IsSpeechBusy()){
    v161StopSpeech();
    return;
  }
  v151Speak(v15LastSpoken,{state:v15State,force:true});
}
function v151SetAutoVoice(enabled){
  v151VoiceAuto=!!enabled;
  clearTimeout(v151AutoSpeechTimer);
  v151AutoSpeechTimer=null;
  if(v151VoiceAuto){
    v151VoiceEnabled=true;
    if(window.KitsuneStaticVoice?.info?.()?.enabled===false)window.KitsuneStaticVoice.enable(true);
    v151SpeechUnlocked=true;
  }else{
    v161StopSpeech();
  }
  v151SaveVoice();
  v151UpdateVoiceUi();
}
function v151AutoSpeak(text,state){
  if(!v151VoiceEnabled||!v151VoiceAuto||v15Mode==="off")return;
  if(!v151SpeechUnlocked)return;
  if(v151IsSpeechBusy()||v151SettingsVisible())return;
  clearTimeout(v151AutoSpeechTimer);
  v151AutoSpeechTimer=setTimeout(()=>{
    v151AutoSpeechTimer=null;
    if(!v151VoiceEnabled||!v151VoiceAuto||v15Mode==="off"||!v151SpeechUnlocked)return;
    if(v151IsSpeechBusy()||v151SettingsVisible())return;
    v151Speak(text,{state,force:false});
  },80);
}
function v151SettingsVisible(){
  return !!(document.querySelector("#v15Assistant")?.classList.contains("open")&&document.querySelector("#v15Settings")?.classList.contains("show"));
}
/* Учебное действие заменяет предыдущую реплику; фоновые советы её не прерывают. */
function v151LessonSpeak(text,state="explain",options={}){
  if(!v151VoiceEnabled||!v151VoiceAuto||v15Mode==="off"||!v151SpeechUnlocked||v151SettingsVisible())return false;
  clearTimeout(v151AutoSpeechTimer);v151AutoSpeechTimer=null;
  return v151Speak(text,{...options,state,force:true});
}
function v151UpdateVoiceUi(){
  const enabled=document.querySelector("#v151VoiceEnabledBtn");
  if(enabled){
    enabled.textContent=v151VoiceEnabled?"Вкл.":"Выкл.";
    enabled.setAttribute("aria-pressed",v151VoiceEnabled?"true":"false");
    enabled.classList.toggle("off",!v151VoiceEnabled);
  }

  const auto=document.querySelector("#v151AutoVoice");
  if(auto)auto.checked=v151VoiceAuto;
  const autoToggle=document.querySelector("#v151AutoVoiceToggle");
  if(autoToggle){
    autoToggle.textContent=v151VoiceAuto?"Автоозвучка: вкл.":"Автоозвучка: выкл.";
    autoToggle.setAttribute("aria-pressed",String(v151VoiceAuto));
    autoToggle.classList.toggle("primary-action",v151VoiceAuto);
  }

  const note=document.querySelector("#v151VoiceNote");
  if(note){
    const info=window.KitsuneStaticVoice?.info();
    const dynamic=window.KitsuneDynamicVoice?.info();
    note.textContent=v151VoiceNotice||dynamic?.message||(dynamic?.ready ? (dynamic?.status==='installed_candidate' ? (dynamic.engine==='piper-v07'?"Голос Китсуне · Piper сохранён для проверки на этом устройстве.":"Голос Китсуне · генератор сохранён для проверки. Новая фраза готовится несколько минут.") : "Голос Китсуне · генератор сохранён") :
      (info?.topics ? `Голос Kitsune · учебных тем: ${info.topics}` : "Голос Kitsune · учебные записи готовятся"));
  }
  const testGenerator=document.querySelector("#v151TestGenerator");
  const installGenerator=document.querySelector("#v151InstallGenerator");
  if(installGenerator&&window.KitsuneDynamicVoice?.info?.().engine==='piper-v07'&&!window.KitsuneDynamicVoice.info().installing)installGenerator.textContent="⬇ Сохранить генератор · около 100 МБ";
  if(testGenerator)testGenerator.disabled=!window.KitsuneDynamicVoice?.info?.().ready||!v151VoiceEnabled;
  const dialog=document.querySelector("#v19Dialog"),dialogLive=document.querySelector("#v19DialogLive");
  if(dialogLive&&dialog?.classList.contains("show")){
    const dynamic=window.KitsuneDynamicVoice?.info();
    const text=v151VoiceNotice||dynamic?.message||(v151Speaking?"Китсуне читает ответ…":"");
    if(text){
      dialogLive.textContent=text;dialogLive.dataset.kitsuneVoiceMessage=text;
      dialogLive.className="v19-dialog-live "+(v151VoiceNotice?"warn":v151Speaking?"speaking":"thinking");
    }else if(dialogLive.textContent===dialogLive.dataset.kitsuneVoiceMessage){
      dialogLive.textContent="";dialogLive.className="v19-dialog-live";delete dialogLive.dataset.kitsuneVoiceMessage;
    }
  }

  const speak=document.querySelector("#v15SpeakBtn");
  if(speak){
    speak.style.display=(!!window.KitsuneStaticVoice&&v151VoiceEnabled)?"":"none";
    speak.title=window.KitsuneReading?.snapshot?.()?.phase==="paused"?"Продолжить чтение":v151Speaking?"Остановить озвучку":v151IsSpeechBusy()?"Остановить подготовку речи":"Прочитать совет вслух";
  }
  window.KitsuneLessonVoice?.updateUi?.();
}

function v15ShowTip(){
  const l=v15Lesson();
  if(l){
    v15Message(v15TopicAdvice(l.id),{state:"think"});
  }else{
    const title=(document.querySelector("#pageTitle")?.textContent||"").toLowerCase();
    if(title.includes("контроль")||title.includes("диагност")){
      v15Message("Сначала решай то, в чём уверен(а). Сложные задания пометь мысленно и вернись к ним после первого прохода.",{state:"focus"});
    }else if(title.includes("ошиб")){
      v15Message("Выбери одну повторяющуюся ошибку и разберись именно с ней. Исправлять всё сразу не нужно.",{state:"think"});
    }else if(title.includes("прогресс")){
      v15Message("Смотри не только на процент прохождения. Самые полезные темы для повторения — те, где были ошибки.",{state:"explain"});
    }else{
      v15Message("Хорошая стратегия: 10–15 минут теории, затем сразу несколько задач без подсматривания в решение.",{state:"explain"});
    }
  }
}
function v15ExplainSimple(){
  const l=v15Lesson();
  if(l){
    v15Message(v15SimpleAdvice(l.id),{state:"explain"});
    const simple=document.querySelector("#simple");
    const simpleBtn=[...document.querySelectorAll(".level-switch button")].find(b=>/просто/i.test(b.textContent));
    if(simpleBtn&&!simpleBtn.classList.contains("active"))simpleBtn.click();
    setTimeout(()=>simple?.scrollIntoView({behavior:v15Reduce.matches?"auto":"smooth",block:"start"}),120);
  }else{
    v15Message("Давай проще: выбери одно задание, выпиши известные данные и сформулируй только первый шаг. После него станет понятнее следующий.",{state:"explain"});
  }
}

function v15Bind(){
  const root=document.querySelector("#v15Assistant");

  /* v1.11.8: same UX as the mobile sidebar — tap outside Kitsune closes it. */
  const scrim=document.querySelector("#v15Scrim");
  scrim?.addEventListener("pointerdown",e=>{
    e.preventDefault();
    v15Close();
  });
  window.addEventListener("keydown",e=>{
    if(e.key==="Escape"&&root.classList.contains("open"))v15Close();
  });
  root.querySelector("#v15MascotBtn").addEventListener("click",()=>{
    if(root.classList.contains("open"))v15Close();
    else{
      v15Open();
      if(!v15LastSpoken)v15ShowTip();
      v15SetState("wave");
      setTimeout(()=>v15SetState("idle"),750);
    }
  });
  root.querySelector("#v15CloseBtn").addEventListener("click",v15Close);
  root.querySelector("#v15TipBtn").addEventListener("click",v15ShowTip);
  root.querySelector("#v15SimpleBtn").addEventListener("click",v15ExplainSimple);
  root.querySelector("#v15SpeakBtn").addEventListener("click",v15Speak);


  root.querySelector("#v15SettingsBtn").addEventListener("click",()=>{
    clearTimeout(v151AutoSpeechTimer);
    v151AutoSpeechTimer=null;
    root.querySelector("#v15Settings").classList.toggle("show");
  });
  root.querySelectorAll("[data-mode-choice]").forEach(btn=>{
    btn.addEventListener("click",()=>v15SetMode(btn.dataset.modeChoice));
  });

  /* Голос Kitsune */
  const voiceEnabled=root.querySelector("#v151VoiceEnabledBtn");
  voiceEnabled?.addEventListener("click",()=>{
    v151VoiceEnabled=!v151VoiceEnabled;
    window.KitsuneStaticVoice?.enable(v151VoiceEnabled);
    if(!v151VoiceEnabled){
      v161StopSpeech();
    }else{
      v151SpeechUnlocked=true;
    }
    v151SaveVoice();v151UpdateVoiceUi();
  });
  const autoVoice=root.querySelector("#v151AutoVoice");
  autoVoice?.addEventListener("change",()=>{
    v151SetAutoVoice(autoVoice.checked);
  });
  root.querySelector("#v151AutoVoiceToggle")?.addEventListener("click",()=>v151SetAutoVoice(!v151VoiceAuto));
  root.querySelector("#v151TestVoice")?.addEventListener("click",()=>{
    v151SpeechUnlocked=true;
    v151Speak(window.KitsuneStaticVoice?.sample(),{state:"happy",force:true});
  });
  root.querySelector("#v151TestGenerator")?.addEventListener("click",()=>{
    v151SpeechUnlocked=true;
    v151Speak("Привет! Я Китсуне. Давай решим новую задачу вместе.",{state:"happy",force:true});
  });
  root.querySelector("#v151DownloadVoice")?.addEventListener("click",async event=>{
    const button=event.currentTarget;button.disabled=true;
    try{
      await window.KitsuneStaticVoice.download();
      button.textContent="✓ Голос сохранён офлайн";
    }catch{
      button.textContent="Повторить сохранение голоса";
      window.KitsuneRuntimeStability?.toast?.("Не удалось сохранить все записи. Проверь подключение.");
    }finally{button.disabled=false;}
  });
  root.querySelector("#v151InstallGenerator")?.addEventListener("click",async event=>{
    const button=event.currentTarget;button.disabled=true;
    const note=root.querySelector("#v151VoiceNote");
    try{
      await window.KitsuneDynamicVoice.install(({percent})=>{button.textContent=`Сохранение генератора: ${percent}%`;});
      button.textContent="✓ Генератор сохранён";
      v151UpdateVoiceUi();
      if(note)note.textContent="Новые фразы теперь готовятся на этом устройстве. Первая озвучка займёт время.";
    }catch(error){
      button.textContent="Повторить сохранение генератора";
      if(note)note.textContent=error.message;
      window.KitsuneRuntimeStability?.toast?.(error.message);
    }finally{button.disabled=false;}
  });
  if(window.KitsuneStaticVoice?.info?.()?.enabled!==v151VoiceEnabled)window.KitsuneStaticVoice?.enable?.(v151VoiceEnabled);
  v151UpdateVoiceUi();

  const mascot=root.querySelector("#v15MascotBtn");
  if(window.matchMedia("(hover:hover) and (pointer:fine)").matches){
    mascot.addEventListener("pointermove",e=>{
      if(["sleep","cheer","celebrate"].includes(v15State))return;
      const r=mascot.getBoundingClientRect();
      const dx=Math.max(-1,Math.min(1,(e.clientX-(r.left+r.width/2))/(r.width/2)));
      const dy=Math.max(-1,Math.min(1,(e.clientY-(r.top+r.height/2))/(r.height/2)));
      root.querySelectorAll(".pupil").forEach(p=>p.style.transform=`translate(${(dx*1.8).toFixed(1)}px,${(dy*1.3).toFixed(1)}px)`);
    });
    mascot.addEventListener("pointerleave",()=>root.querySelectorAll(".pupil").forEach(p=>p.style.transform=""));
  }
}

/* Первый осознанный тап разблокирует озвучку в мобильных браузерах. */
function v151UnlockSpeech(){
  v151SpeechUnlocked=true;
  try{speechSynthesis.resume()}catch(e){}
  try{window.dispatchEvent(new CustomEvent("kitsune-audio-unlock"))}catch(e){}
}
document.addEventListener("pointerdown",v151UnlockSpeech,{once:true,passive:true,capture:true});
document.addEventListener("touchend",v151UnlockSpeech,{once:true,passive:true,capture:true});
document.addEventListener("visibilitychange",()=>{
  if(document.visibilityState==="visible"){
    try{speechSynthesis.resume()}catch(e){}
  }
});

/* Sidebar режим: циклически Active -> Advice -> Off -> Active */
const v15SidebarModeBtn=document.querySelector("#assistantModeBtn");
if(v15SidebarModeBtn){
  v15SidebarModeBtn.addEventListener("click",()=>{
    const i=v15Modes.indexOf(v15Mode);
    v15SetMode(v15Modes[(i+1)%v15Modes.length]);
  });
}

/* Контекст: Kitsune понимает, какой экран открылся. */
function v15ContextKey(){
  const title=document.querySelector("#pageTitle")?.textContent||"";
  const lesson=v15CurrentLessonId();
  return `${title}|${lesson||""}`;
}
function v15ContextMessage(){
  if(v15Mode!=="active")return;
  const key=v15ContextKey();
  if(!key||key===v15LastView)return;
  v15LastView=key;

  const l=v15Lesson();
  const title=document.querySelector("#pageTitle")?.textContent||"";
  if(l){
    const titleText=v15Strip(l.data.title);
    v15Message(`Новая цель — «${titleText}». Не спеши запоминать формулу: сначала пойми, что она связывает. Если застрянешь, нажми «Совет».`,{state:"wave",open:false,typing:false});
    v15Chip("Я знаю эту тему 💡");
  }else if(/Контроль|контроль|диагност/i.test(title)){
    v15SetState("focus");
    v15Chip("Режим концентрации 🎯");
  }else if(/Мои ошибки/i.test(title)){
    v15SetState("think");
    v15Chip("Разберём ошибки вместе");
  }else if(/Прогресс/i.test(title)){
    v15SetState("happy");
    v15Chip("Посмотрим, как ты вырос(ла) 📈");
  }else{
    v15SetState("idle");
  }
}

/* Реакция на нажатие «Проверить» / быстрые вопросы / подсказки. */
function v15FindFeedback(container){
  if(!container)return null;
  return container.querySelector(
    ".feedback,.v13-feedback,.micro-result,.v12-trap-feedback,.v11-visual-feedback,.test-explain"
  );
}
function v15LooksCorrect(container){
  const fb=v15FindFeedback(container);
  const t=(fb?.textContent||"").trim();
  return fb?.classList.contains("ok")||/^(✅|🌟|Верно)/i.test(t);
}
function v15LooksWrong(container){
  const fb=v15FindFeedback(container);
  const t=(fb?.textContent||"").trim();
  return fb?.classList.contains("bad")||/^(Пока|🙂|Неверно|Правильный ответ)/i.test(t);
}
function v15ReactCorrect(){
  if(v15Mode==="advice"){v15WrongStreak=0;v15RightStreak++;return;}
  const now=Date.now();
  if(now-v15LastReactionAt<180)return;
  v15LastReactionAt=now;
  v15WrongStreak=0;
  v15RightStreak++;
  const phrases=["Да! Именно так 🎯","Отлично! Шаг выбран верно.","Есть! Так держать 🌟","Супер. Ты не просто угадал(а) — метод работает."];
  if(v15RightStreak>=3){
    v15SetState("cheer");
    v15Streak(`🔥 ${v15RightStreak} подряд`);
    if(v15Mode==="active")v15Message(`${v15RightStreak} правильных ответа подряд! Отличная серия.`,{state:"cheer",open:false,typing:false});
    else v15Chip(`${v15RightStreak} подряд 🔥`);
  }else{
    v15SetState("happy");
    const praise=phrases[(v15RightStreak-1)%phrases.length];
    v15Chip(praise);
    v151AutoSpeak(praise,"happy");
  }
  setTimeout(()=>v15SetState("idle"),900);
}
function v15ReactWrong(){
  const now=Date.now();
  if(now-v15LastReactionAt<180)return;
  v15LastReactionAt=now;
  v15RightStreak=0;
  v15WrongStreak++;
  const l=v15Lesson();

  if(v15WrongStreak>=2){
    const msg=l
      ?`Похоже, здесь уже две попытки подряд. ${v15MistakeAdvice(l.id)} Можем перейти к самому простому объяснению.`
      :"Две попытки подряд — это сигнал не спешить. Давай разложим решение на один маленький шаг.";
    if(v15Mode==="active")v15Message(msg,{state:"oops",open:true});
    else if(v15Mode==="advice")v15Chip("Есть совет по этой ошибке 💡");
  }else{
    v15SetState("oops");
    if(v15Mode==="active"){
      const support="Ничего. Проверим один шаг.";
      v15Chip("Ничего, проверим один шаг");
      v151AutoSpeak(support,"oops");
    }
  }
  setTimeout(()=>{if(!document.querySelector("#v15Assistant")?.classList.contains("open"))v15SetState("idle")},1100);
}

document.addEventListener("click",e=>{
  const btn=e.target.closest?.("button");
  if(!btn||v15Mode==="off")return;
  const text=(btn.textContent||"").trim();
  const onclick=btn.getAttribute("onclick")||"";

  /* v1.7.2 — ВАЖНО:
     штатные кнопки урока «Подсказка / Хочу понять / Разобрать идею»
     принадлежат самому курсу. Kitsune больше НЕ перехватывает их и не открывает
     своё меню поверх учебной подсказки. Кнопки самого Kitsune имеют собственные
     прямые обработчики в v15Bind(). */
  const insideAlfi=!!btn.closest("#v15Assistant");
  if(insideAlfi)return;

  /* v2.2.3: Smart Tutor owns these buttons completely. */
  if(btn.matches(".v16-tutor-btn,.v173-alfi-shortcut")||btn.closest(".v173-inline-tutor"))return;

  const nativeLessonHelp=
    /Подсказк|Разобрать идею|Хочу понять/i.test(text) ||
    /toggleHint|#hint-|\.hint/.test(onclick);

  if(nativeLessonHelp){
    return;
  }

  /* Завершение урока */
  if(/Я понял|Я поняла/i.test(text)){
    v15RightStreak=0;v15WrongStreak=0;
    if(v15Mode==="active")v15Message("Готово! Ещё одна тема в копилке. После награды двигаемся дальше 🚀",{state:"celebrate",open:false,typing:false});
    v15SetState("celebrate");
    setTimeout(()=>v15SetState("idle"),1500);
    return;
  }

  /* Проверка индивидуального задания */
  const isCheck=
    btn.classList.contains("check-btn") ||
    /^Проверить$/i.test(text) ||
    /(?:v1Quick|ch1Quick|v12Trap|v11VisualAnswer|v13Check)/.test(onclick);

  if(isCheck){
    const container=btn.closest(".exercise,.v13-task,.v13-advanced-card,.v12-trap,.v11-visual-check,.test-question");
    if(!container)return;

    /* v1.7.3: кнопка «Проверить» НИКОГДА не открывает окно Kitsune.
       При ошибке разбор показывается локально под заданием (Smart Tutor).
       Kitsune может только дать короткий ненавязчивый chip возле персонажа. */
    setTimeout(()=>{
      if(!container.isConnected)return;
      if(v15LooksCorrect(container)){
        v15ReactCorrect();
        if(window.KitsuneLessonVoice?.result)window.KitsuneLessonVoice.result(container,v15FindFeedback(container)?.textContent,"happy");
        else v151LessonSpeak(v15FindFeedback(container)?.textContent,"happy");
      }else if(v15LooksWrong(container)){
        v15RightStreak=0;
        v15WrongStreak++;
        v15SetState("oops");
        if(v15Mode==="active")v15Chip("Разбор появился под заданием 💡");
        if(window.KitsuneLessonVoice?.result)window.KitsuneLessonVoice.result(container,v15FindFeedback(container)?.textContent,"oops");
        else v151LessonSpeak(v15FindFeedback(container)?.textContent,"oops");
        setTimeout(()=>v15SetState("idle"),850);
      }
    },95);
    return;
  }

  /* Массовая диагностика/контрольная */
  if(/Сдать работу|Проверить диагностику|Проверить результат|Проверить контроль/i.test(text)){
    setTimeout(()=>{
      const result=document.querySelector(".result-banner strong,.v13-result strong");
      if(!result)return;
      const m=(result.textContent||"").match(/(\d+)\s*\/\s*(\d+)/);
      if(!m)return;
      const pct=Math.round(Number(m[1])/Number(m[2])*100);
      if(pct>=85)v15Message(`Очень сильный результат — ${pct}%! Можно переходить к следующему уровню.`,{state:"celebrate",open:v15Mode==="active"});
      else if(pct>=60)v15Message(`${pct}% — хорошая рабочая база. Посмотри рекомендации и повтори только слабые темы.`,{state:"happy",open:v15Mode==="active"});
      else v15Message(`${pct}% — сейчас полезнее не повторять всё подряд. Выбери две слабые темы из рекомендаций и разберём их по очереди.`,{state:"think",open:v15Mode==="active"});
    },180);
  }
});

/* Наблюдаем переходы по экранам, не вмешиваясь в их рендеринг. */
const v15Content=document.querySelector("#content");
if(v15Content){
  let v15ContextScheduled=false;
  new MutationObserver(()=>{
    if(v15ContextScheduled)return;
    v15ContextScheduled=true;
    setTimeout(()=>{
      v15ContextScheduled=false;
      v15ContextMessage();
    },120);
  }).observe(v15Content,{childList:true,subtree:false});
}

/* Спящий режим после бездействия. */
function v15ResetIdle(){
  clearTimeout(v15IdleTimer);
  if(v15Mode!=="off"&&v15State==="sleep")v15SetState("idle");
  v15IdleTimer=setTimeout(()=>{
    if(v15Mode!=="off"&&!document.querySelector("#v15Assistant")?.classList.contains("open")){
      v15SetState("sleep");
      if(v15Mode==="active")v15Chip("Я рядом, когда понадоблюсь 😴");
    }
  },65000);
}
["pointerdown","keydown","input","scroll"].forEach(ev=>window.addEventListener(ev,v15ResetIdle,{passive:true}));

/* Одно приветствие в день. */
function v15Greeting(){
  if(v15Mode!=="active"||document.documentElement.dataset.design!=="playful")return;
  const now=new Date();
  const today=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
  let prev="";
  try{prev=localStorage.getItem(v15GreetingKey)||""}catch(e){}
  if(prev===today)return;
  try{localStorage.setItem(v15GreetingKey,today)}catch(e){}
  const h=now.getHours();
  const hello=h<12?"Доброе утро":h<18?"Добрый день":"Добрый вечер";
  setTimeout(()=>{
    v15Message(`${hello}! Я Kitsune — твой помощник по алгебре. Буду подсказывать только там, где это действительно полезно.`,{state:"wave",open:true});
    setTimeout(()=>{if(document.querySelector("#v15Assistant")?.classList.contains("open"))v15Close();v15SetState("idle")},5200);
  },1100);
}

/* При смене дизайна в игровой режим Kitsune появляется без перезагрузки. */
const v15DesignObserver=new MutationObserver(()=>{
  if(document.documentElement.dataset.design==="playful"&&v15Mode!=="off"){
    v15Ensure();
    v15SetState("wave");
    setTimeout(()=>v15SetState("idle"),850);
  }else{
    v15Close();
  }
});
v15DesignObserver.observe(document.documentElement,{attributes:true,attributeFilter:["data-design"]});

/* Полный сброс курса также сбрасывает персональные счётчики Kitsune, но режим сохраняем. */
const v15ResetButton=document.querySelector("#resetBtn");
if(v15ResetButton){
  /* Реальный сброс localStorage выполняется существующим кодом курса. */
}

v15Ensure();
v15ApplyMode(v15Mode,false);

v151UpdateVoiceUi();
v15ResetIdle();
v15ContextMessage();
v15Greeting();
