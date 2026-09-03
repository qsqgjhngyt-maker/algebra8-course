
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

/* v1.6.1 · Живая озвучка Альфи */
const v151VoiceEnabledKey="a8_alfi_voice_enabled";
const v151VoiceAutoKey="a8_alfi_voice_auto";
const v151VoiceProfileKey="a8_alfi_voice_profile";
const v151VoiceNameKey="a8_alfi_voice_name";
const v161VoiceEnergyKey="a8_alfi_voice_energy";

/* Более умеренная высота тона + динамическая фразовая интонация звучит
   естественнее, чем постоянный высокий pitch. */
const v151VoiceProfiles={
  lively:{name:"Живой+",rate:1.00,pitch:1.06,volume:1,dynamic:1.00},
  soft:{name:"Мягкий",rate:.92,pitch:1.01,volume:.97,dynamic:.52},
  clear:{name:"Чёткий",rate:.89,pitch:.99,volume:1,dynamic:.34}
};
let v151VoiceEnabled=true;
let v151VoiceAuto=false;
let v151VoiceProfile="lively";
let v151VoiceName="";
let v161VoiceEnergy=72;
let v151Voices=[];
let v151SpeechUnlocked=false;
let v151Speaking=false;
let v161SpeechRun=0;
let v161SpeechTimer=null;
try{
  const e=localStorage.getItem(v151VoiceEnabledKey);
  v151VoiceEnabled=e===null?true:e==="1";
  v151VoiceAuto=localStorage.getItem(v151VoiceAutoKey)==="1";
  v151VoiceProfile=localStorage.getItem(v151VoiceProfileKey)||"lively";
  v151VoiceName=localStorage.getItem(v151VoiceNameKey)||"";
  const energy=Number(localStorage.getItem(v161VoiceEnergyKey));
  if(Number.isFinite(energy)&&energy>=0&&energy<=100)v161VoiceEnergy=energy;
}catch(e){}
if(!v151VoiceProfiles[v151VoiceProfile])v151VoiceProfile="lively";

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
  return `
  <svg class="v15-mascot" viewBox="0 0 100 105" role="img" aria-label="Альфи, помощник курса">
    <path class="antenna" d="M50 16 C50 10 56 8 56 4"/>
    <circle class="antenna-dot" cx="57" cy="4" r="4"/>
    <ellipse class="body-shadow" cx="50" cy="83" rx="31" ry="14"/>
    <rect class="body" x="18" y="25" width="64" height="64" rx="25"/>
    <path class="arm arm-left" d="M22 57 C12 61 12 72 18 76"/>
    <circle class="hand" cx="18" cy="77" r="5"/>
    <path class="arm arm-right" d="M78 57 C88 61 88 72 82 76"/>
    <circle class="hand" cx="82" cy="77" r="5"/>
    <rect class="face" x="27" y="34" width="46" height="35" rx="15"/>
    <g class="eye-group">
      <ellipse class="eye-white" cx="41" cy="48" rx="7" ry="8"/>
      <ellipse class="eye-white" cx="59" cy="48" rx="7" ry="8"/>
      <circle class="pupil pupil-left" cx="42" cy="49" r="3.5"/>
      <circle class="pupil pupil-right" cx="60" cy="49" r="3.5"/>
      <circle class="eye-glint" cx="43" cy="47.5" r="1"/>
      <circle class="eye-glint" cx="61" cy="47.5" r="1"/>
    </g>
    <path class="sleep-eye" d="M35 49 Q41 45 47 49 M53 49 Q59 45 65 49"/>
    <circle class="cheek" cx="34" cy="58" r="3"/>
    <circle class="cheek" cx="66" cy="58" r="3"/>
    <path class="mouth" d="M43 57 Q50 62 57 57"/>
    <circle class="mascot-badge" cx="50" cy="78" r="9"/>
    <text class="mascot-badge-text" x="50" y="81">A8</text>
    <text class="symbol" x="50" y="22">√</text>
  </svg>`;
}
function v15Markup(){
  return `<div class="v15-assistant" id="v15Assistant" data-mode="${v15Mode}" data-state="idle" aria-live="polite">
    <div class="v15-speech" id="v15Speech">
      <div class="v15-speech-head">
        <strong>🤖 Альфи</strong><span class="v15-speech-status" id="v15SpeechStatus">помощник</span>
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
      <div class="v15-settings" id="v15Settings">
        <span class="v15-settings-label">Как часто Альфи вмешивается</span>
        <div class="v15-mode-row">
          <button class="v15-mode-btn" data-mode-choice="active">✨ Активный</button>
          <button class="v15-mode-btn" data-mode-choice="advice">💡 Советы</button>
          <button class="v15-mode-btn" data-mode-choice="off">🙈 Выкл.</button>
        </div>

        <div class="v151-voice-settings" id="v151VoiceSettings">
          <div class="v151-voice-title">
            <span>🎙️ Голос Альфи</span>
            <button class="v151-toggle" id="v151VoiceEnabledBtn" type="button" aria-pressed="true">Вкл.</button>
          </div>
          <div class="v151-profile-row" id="v151ProfileRow">
            <button type="button" class="v151-profile-btn" data-voice-profile="lively">⚡ Живой+</button>
            <button type="button" class="v151-profile-btn" data-voice-profile="soft">🌿 Мягкий</button>
            <button type="button" class="v151-profile-btn" data-voice-profile="clear">📘 Чёткий</button>
          </div>
          <label class="v161-energy-field">
            <span><b>✨ Живость</b><output id="v161EnergyValue">72%</output></span>
            <input id="v161Energy" type="range" min="0" max="100" step="1" value="72">
            <small>Меняет выразительность, паузы и перепады интонации.</small>
          </label>
          <label class="v151-voice-field">
            <span>Голос устройства</span>
            <select id="v151VoiceSelect" aria-label="Голос Альфи">
              <option value="">Автовыбор лучшего русского голоса</option>
            </select>
          </label>
          <button type="button" class="v151-compare-btn" id="v161CompareVoices">🎧 Сравнить лучшие голоса</button>
          <label class="v151-auto-row">
            <input type="checkbox" id="v151AutoVoice">
            <span><b>Автоозвучка</b><small>Альфи сам читает важные советы и реакции.</small></span>
          </label>
          <div class="v151-voice-actions">
            <button type="button" class="v15-action primary-action" id="v151TestVoice">▶ Послушать Альфи</button>
            <span class="v151-voice-note" id="v151VoiceNote">На телефоне используется лучший доступный русский голос.</span>
          </div>
        </div>
      </div>
    </div>
    <div class="v15-tip-chip" id="v15TipChip"></div>
    <div class="v15-streak-pop" id="v15StreakPop"></div>
    <button class="v15-mascot-button" id="v15MascotBtn" aria-label="Открыть помощника Альфи">
      ${v15Svg()}
    </button>
    <span class="v15-status-dot" aria-hidden="true"></span>
  </div>`;
}
function v15Ensure(){
  let root=document.querySelector("#v15Assistant");
  if(root)return root;
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
    v15Chip(mode==="active"?"Альфи снова с нами 👋":"Советы включены 💡");
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
    sidebar.textContent=mode==="active"?"🤖 Помощник: активный":mode==="advice"?"💡 Помощник: советы":"🙈 Помощник: выкл.";
    sidebar.title=document.documentElement.dataset.design==="classic"
      ?"Режим Альфи (персонаж показывается в игровом дизайне)"
      :"Переключить режим Альфи";
  }
  const st=root.querySelector("#v15SpeechStatus");
  if(st)st.textContent=mode==="active"?"активный помощник":mode==="advice"?"только по запросу":"выключен";
}
function v15Open(){
  if(v15Mode==="off")return;
  v15Ensure().classList.add("open");
}
function v15Close(){
  document.querySelector("#v15Assistant")?.classList.remove("open");
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
    localStorage.setItem(v151VoiceProfileKey,v151VoiceProfile);
    localStorage.setItem(v151VoiceNameKey,v151VoiceName);
    localStorage.setItem(v161VoiceEnergyKey,String(v161VoiceEnergy));
  }catch(e){}
}
function v151VoiceScore(v){
  const name=(v.name||"").toLowerCase();
  let score=0;
  if(/^ru/i.test(v.lang||""))score+=120;

  /* Современные neural/natural голоса обычно заметно приятнее старых compact TTS. */
  if(/natural|neural|enhanced|online|premium/.test(name))score+=42;
  if(/google/.test(name))score+=30;
  if(/microsoft/.test(name))score+=27;
  if(/samsung/.test(name))score+=23;
  if(/yandex/.test(name))score+=21;

  /* Для персонажа обычно лучше более светлые русские тембры, но пользователь
     всё равно может выбрать любой системный голос вручную. */
  if(/svetlana|irina|milena|alena|alyona|anna|tatiana|dariya|daria|female|жен/.test(name))score+=14;
  if(/pavel|dmitry|yuri|male|муж/.test(name))score+=4;

  if(v.localService)score+=8;
  if(/compact|legacy|classic|old/.test(name))score-=18;
  return score;
}
function v151RefreshVoices(){
  if(!("speechSynthesis" in window))return;
  const all=speechSynthesis.getVoices?.()||[];
  const russian=all.filter(v=>/^ru/i.test(v.lang||""));
  v151Voices=(russian.length?russian:all).sort((a,b)=>v151VoiceScore(b)-v151VoiceScore(a));
  const select=document.querySelector("#v151VoiceSelect");
  if(select){
    const old=v151VoiceName;
    select.innerHTML=`<option value="">Автовыбор лучшего русского голоса</option>`+
      v151Voices.map((v,i)=>`<option value="${String(v.name).replace(/"/g,"&quot;")}">${i<3?"★ ":""}${v.name}${v.localService?" · устройство":""}</option>`).join("");
    if(v151Voices.some(v=>v.name===old))select.value=old;
    else select.value="";
  }
  v151UpdateVoiceUi();
}
function v151SelectedVoice(){
  if(!v151Voices.length&&"speechSynthesis" in window){
    const all=speechSynthesis.getVoices?.()||[];
    const russian=all.filter(v=>/^ru/i.test(v.lang||""));
    v151Voices=(russian.length?russian:all).sort((a,b)=>v151VoiceScore(b)-v151VoiceScore(a));
  }
  if(v151VoiceName){
    const chosen=v151Voices.find(v=>v.name===v151VoiceName);
    if(chosen)return chosen;
  }
  return v151Voices[0]||null;
}
function v151Emotion(state=v15State){
  /* Значения здесь — не итоговые rate/pitch, а небольшие эмоциональные дельты. */
  const table={
    idle:{rate:0,pitch:0,pause:70},
    wave:{rate:.035,pitch:.025,pause:62},
    think:{rate:-.055,pitch:-.012,pause:115},
    explain:{rate:-.060,pitch:-.018,pause:105},
    happy:{rate:.070,pitch:.035,pause:52},
    oops:{rate:-.075,pitch:-.035,pause:125},
    focus:{rate:-.070,pitch:-.040,pause:135},
    cheer:{rate:.105,pitch:.050,pause:44},
    celebrate:{rate:.115,pitch:.058,pause:42},
    sleep:{rate:-.145,pitch:-.050,pause:155}
  };
  return table[state]||table.idle;
}
function v161CleanSpeechText(text){
  let s=v15Strip(text);

  /* Не заставляем TTS произносить эмодзи и технические символы. */
  try{s=s.replace(/\p{Extended_Pictographic}/gu,"")}catch(e){}
  s=s.replace(/[⭐🌟🔥🎯💡🧠🚀✅❌🙂🤖✨🌱📘🏆🎓]/g,"");

  /* Небольшой математический словарь делает учебные реплики на порядок понятнее. */
  s=s
    .replace(/\bОДЗ\b/gi,"область допустимых значений")
    .replace(/\bНОЗ\b/gi,"наименьший общий знаменатель")
    .replace(/\bНОК\b/gi,"наименьшее общее кратное")
    .replace(/√/g," корень из ")
    .replace(/≠/g," не равно ")
    .replace(/≥/g," больше или равно ")
    .replace(/≤/g," меньше или равно ")
    .replace(/−/g," минус ")
    .replace(/²/g," в квадрате ")
    .replace(/³/g," в кубе ")
    .replace(/\bx\b/gi,"икс")
    .replace(/\by\b/gi,"игрек")
    .replace(/\s*=\s*/g," равно ")
    .replace(/\s*>\s*/g," больше ")
    .replace(/\s*<\s*/g," меньше ");

  return s.replace(/\s+/g," ").replace(/\s+([,.!?;:])/g,"$1").trim();
}
function v161SplitSpeech(text){
  const clean=v161CleanSpeechText(text);
  if(!clean)return [];

  /* Сначала предложения, затем слишком длинные предложения дробим по запятым.
     Отдельные utterance позволяют реально менять интонацию внутри одной реплики. */
  const sentences=clean.match(/[^.!?;:]+[.!?;:]?|.+$/g)||[clean];
  const out=[];
  for(const raw of sentences){
    const sentence=raw.trim();
    if(!sentence)continue;
    if(sentence.length<=105){out.push(sentence);continue}

    const parts=sentence.split(/(?<=,)\s+/);
    let buf="";
    for(const part of parts){
      if((buf+" "+part).trim().length>92&&buf){
        out.push(buf.trim());
        buf=part;
      }else{
        buf=(buf+" "+part).trim();
      }
    }
    if(buf)out.push(buf);
  }
  return out.slice(0,12);
}
function v161Prosody(segment,index,total,state){
  const base=v151VoiceProfiles[v151VoiceProfile]||v151VoiceProfiles.lively;
  const emo=v151Emotion(state);
  const energy=(v161VoiceEnergy/100)*(base.dynamic??1);
  const text=segment.trim();

  let rate=base.rate+emo.rate*energy;
  let pitch=base.pitch+emo.pitch*energy;
  let pause=emo.pause;

  /* Микро-вариативность — главное отличие от «одной ровной настройки». */
  const wave=((index%3)-1)*.012*energy;
  rate+=wave;
  pitch-=wave*.7;

  if(/\?$/.test(text)){pitch+=.028*energy;rate-=.012}
  if(/!$/.test(text)){pitch+=.035*energy;rate+=.025*energy}
  if(/[:,;]$/.test(text)){rate-=.020;pause+=45}
  if(text.length>82)rate-=.025;
  if(index===total-1){rate-=.015;pitch-=.012*energy;pause+=25}

  /* Не завышаем pitch — именно чрезмерный pitch часто даёт «робота/мультяшку». */
  rate=Math.max(.72,Math.min(1.24,rate));
  pitch=Math.max(.86,Math.min(1.22,pitch));

  return {rate,pitch,volume:base.volume,pause};
}
function v161StopSpeech(){
  v161SpeechRun++;
  clearTimeout(v161SpeechTimer);
  v161SpeechTimer=null;
  try{speechSynthesis.cancel()}catch(e){}
  v151Speaking=false;
  document.querySelector("#v15SpeakBtn")?.classList.remove("speaking");
}
function v161MarkSpeaking(on,state){
  v151Speaking=on;
  document.querySelector("#v15SpeakBtn")?.classList.toggle("speaking",on);
  if(on)v15SetState(state);
  v151UpdateVoiceUi();
}
function v151Speak(text=v15LastSpoken,{state=v15State,force=false,voiceOverride=null,onDone=null}={}){
  if(!("speechSynthesis" in window)||!text||!v151VoiceEnabled)return false;
  if(!force&&!v151SpeechUnlocked)return false;

  const segments=v161SplitSpeech(text);
  if(!segments.length)return false;

  v161StopSpeech();
  const run=++v161SpeechRun;
  const voice=voiceOverride||v151SelectedVoice();
  let index=0;

  const next=()=>{
    if(run!==v161SpeechRun)return;
    if(index>=segments.length){
      v161MarkSpeaking(false,state);
      onDone?.();
      return;
    }

    const segment=segments[index];
    const prosody=v161Prosody(segment,index,segments.length,state);
    const u=new SpeechSynthesisUtterance(segment);
    u.lang=voice?.lang||"ru-RU";
    if(voice)u.voice=voice;
    u.rate=prosody.rate;
    u.pitch=prosody.pitch;
    u.volume=prosody.volume;

    u.onstart=()=>v161MarkSpeaking(true,state);
    u.onend=()=>{
      if(run!==v161SpeechRun)return;
      index++;
      /* Короткая «дыхательная» пауза. Chrome/Samsung обычно соблюдают её лучше,
         чем многоточия внутри одного большого utterance. */
      v161SpeechTimer=setTimeout(next,prosody.pause);
    };
    u.onerror=()=>{
      if(run!==v161SpeechRun)return;
      /* Некоторые мобильные движки иногда отклоняют один сегмент — идём дальше. */
      index++;
      v161SpeechTimer=setTimeout(next,80);
    };

    try{speechSynthesis.speak(u)}
    catch(e){
      index++;
      v161SpeechTimer=setTimeout(next,80);
    }
  };

  /* После cancel() мобильный Chrome/Samsung стабильнее начинает новую очередь
     с микропаузой, чем в том же синхронном стеке. */
  v161SpeechTimer=setTimeout(next,34);
  return true;
}
function v15Speak(){
  v151SpeechUnlocked=true;
  if(v151Speaking){
    v161StopSpeech();
    return;
  }
  v151Speak(v15LastSpoken,{state:v15State,force:true});
}
function v151AutoSpeak(text,state){
  if(!v151VoiceEnabled||!v151VoiceAuto||v15Mode==="off")return;
  if(!v151SpeechUnlocked)return;
  setTimeout(()=>v151Speak(text,{state,force:false}),80);
}
function v161CompareVoices(){
  if(!("speechSynthesis" in window))return;
  v151SpeechUnlocked=true;
  if(!v151Voices.length)v151RefreshVoices();
  const candidates=v151Voices.slice(0,Math.min(3,v151Voices.length));
  if(!candidates.length){
    v151Speak("Привет! Я Альфи. Давай попробуем мой голос.",{state:"happy",force:true});
    return;
  }

  v161StopSpeech();
  let i=0;
  const original=v151VoiceName;
  const note=document.querySelector("#v151VoiceNote");

  const play=()=>{
    if(i>=candidates.length){
      v151VoiceName=original;
      v151UpdateVoiceUi();
      if(note)note.textContent="🎧 Сравнение закончено — выбери понравившийся голос в списке.";
      return;
    }
    const voice=candidates[i];
    if(note)note.textContent=`🎧 Вариант ${i+1}/${candidates.length}: ${voice.name}`;
    v151Speak(
      `Вариант ${i+1}. Привет! Я Альфи. Смотри, сейчас попробуем решить задачу вместе.`,
      {state:i===0?"happy":i===1?"explain":"wave",force:true,voiceOverride:voice,onDone:()=>{
        i++;
        setTimeout(play,340);
      }}
    );
  };
  play();
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

  document.querySelectorAll("[data-voice-profile]").forEach(
    b=>b.classList.toggle("active",b.dataset.voiceProfile===v151VoiceProfile)
  );

  const energy=document.querySelector("#v161Energy");
  if(energy)energy.value=String(v161VoiceEnergy);
  const energyOut=document.querySelector("#v161EnergyValue");
  if(energyOut)energyOut.textContent=`${v161VoiceEnergy}%`;

  const select=document.querySelector("#v151VoiceSelect");
  if(select)select.value=v151VoiceName&&v151Voices.some(v=>v.name===v151VoiceName)?v151VoiceName:"";

  const note=document.querySelector("#v151VoiceNote");
  if(note&&!note.textContent.startsWith("🎧 Вариант")){
    const v=v151SelectedVoice();
    note.textContent=v
      ?`Сейчас: ${v.name} · ${v151VoiceProfiles[v151VoiceProfile]?.name||"Живой+"} · живость ${v161VoiceEnergy}%`
      :"Русский системный голос пока не найден. Браузер может загрузить его после первого запуска.";
  }

  const speak=document.querySelector("#v15SpeakBtn");
  if(speak){
    speak.style.display=("speechSynthesis" in window&&v151VoiceEnabled)?"":"none";
    speak.title=v151Speaking?"Остановить озвучку":"Прочитать совет вслух";
  }
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
  if(!("speechSynthesis" in window))root.querySelector("#v15SpeakBtn").style.display="none";

  root.querySelector("#v15SettingsBtn").addEventListener("click",()=>{
    root.querySelector("#v15Settings").classList.toggle("show");
  });
  root.querySelectorAll("[data-mode-choice]").forEach(btn=>{
    btn.addEventListener("click",()=>v15SetMode(btn.dataset.modeChoice));
  });

  /* Голос Альфи */
  const voiceEnabled=root.querySelector("#v151VoiceEnabledBtn");
  voiceEnabled?.addEventListener("click",()=>{
    v151VoiceEnabled=!v151VoiceEnabled;
    if(!v151VoiceEnabled){
      v161StopSpeech();
    }else{
      v151SpeechUnlocked=true;
    }
    v151SaveVoice();v151UpdateVoiceUi();
  });
  root.querySelectorAll("[data-voice-profile]").forEach(btn=>{
    btn.addEventListener("click",()=>{
      v151VoiceProfile=btn.dataset.voiceProfile;
      v151SaveVoice();v151UpdateVoiceUi();
      v151SpeechUnlocked=true;
      v151Speak("Привет! Это мой новый голос. Так объяснять алгебру будет гораздо веселее!",{state:"happy",force:true});
    });
  });
  const voiceSelect=root.querySelector("#v151VoiceSelect");
  voiceSelect?.addEventListener("change",()=>{
    v151VoiceName=voiceSelect.value;
    v151SaveVoice();v151UpdateVoiceUi();
    v151SpeechUnlocked=true;
    v151Speak("Отлично. Этот голос выбран для Альфи.",{state:"happy",force:true});
  });

  const energy=root.querySelector("#v161Energy");
  energy?.addEventListener("input",()=>{
    v161VoiceEnergy=Math.max(0,Math.min(100,Number(energy.value)||0));
    const out=root.querySelector("#v161EnergyValue");
    if(out)out.textContent=`${v161VoiceEnergy}%`;
  });
  energy?.addEventListener("change",()=>{
    v151SaveVoice();v151UpdateVoiceUi();
    v151SpeechUnlocked=true;
    v151Speak("Проверяем живость. Теперь голос должен звучать чуть естественнее и эмоциональнее.",{state:"happy",force:true});
  });

  root.querySelector("#v161CompareVoices")?.addEventListener("click",v161CompareVoices);

  const autoVoice=root.querySelector("#v151AutoVoice");
  autoVoice?.addEventListener("change",()=>{
    v151VoiceAuto=autoVoice.checked;
    if(v151VoiceAuto)v151SpeechUnlocked=true;
    v151SaveVoice();v151UpdateVoiceUi();
    if(v151VoiceAuto)v151Speak("Автоозвучка включена. Теперь важные советы я буду говорить сам.",{state:"happy",force:true});
  });
  root.querySelector("#v151TestVoice")?.addEventListener("click",()=>{
    v151SpeechUnlocked=true;
    v151Speak("Привет! Я Альфи. Отлично, что ты здесь! Смотри: сложную задачу не будем брать штурмом. Сначала найдём один понятный шаг, а дальше всё сложится.",{state:"happy",force:true});
  });
  v151RefreshVoices();
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

/* Список системных голосов на Android/iOS нередко появляется асинхронно. */
if("speechSynthesis" in window){
  speechSynthesis.addEventListener?.("voiceschanged",v151RefreshVoices);
  setTimeout(v151RefreshVoices,250);
  setTimeout(v151RefreshVoices,1200);
}
/* Первый осознанный тап разблокирует озвучку в мобильных браузерах. */
document.addEventListener("pointerdown",()=>{v151SpeechUnlocked=true},{once:true,passive:true});

/* Sidebar режим: циклически Active -> Advice -> Off -> Active */
const v15SidebarModeBtn=document.querySelector("#assistantModeBtn");
if(v15SidebarModeBtn){
  v15SidebarModeBtn.addEventListener("click",()=>{
    const i=v15Modes.indexOf(v15Mode);
    v15SetMode(v15Modes[(i+1)%v15Modes.length]);
  });
}

/* Контекст: Альфи понимает, какой экран открылся. */
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

  /* Пользователь сам просит подсказку */
  if(/Подсказк|Разобрать идею|Хочу понять|Совет/i.test(text) || /toggleHint/i.test(onclick)){
    if(v15Mode!=="off"){
      const l=v15Lesson();
      v15Message(l?v15TopicAdvice(l.id):"Посмотри на условие ещё раз и выдели один ключевой факт. Часто он прямо указывает на нужное правило.",{state:"think",open:v15Mode==="active"});
      if(v15Mode==="advice")v15Chip("Подсказка готова 💡");
    }
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
    setTimeout(()=>{
      if(v15LooksCorrect(container))v15ReactCorrect();
      else if(v15LooksWrong(container))v15ReactWrong();
    },95);
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
    v15Message(`${hello}! Я Альфи — твой помощник по алгебре. Буду подсказывать только там, где это действительно полезно.`,{state:"wave",open:true});
    setTimeout(()=>{if(document.querySelector("#v15Assistant")?.classList.contains("open"))v15Close();v15SetState("idle")},5200);
  },1100);
}

/* При смене дизайна в игровой режим Альфи появляется без перезагрузки. */
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

/* Полный сброс курса также сбрасывает персональные счётчики Альфи, но режим сохраняем. */
const v15ResetButton=document.querySelector("#resetBtn");
if(v15ResetButton){
  /* Реальный сброс localStorage выполняется существующим кодом курса. */
}

v15Ensure();
v15ApplyMode(v15Mode,false);
v151RefreshVoices();
v151UpdateVoiceUi();
v15ResetIdle();
v15ContextMessage();
v15Greeting();
