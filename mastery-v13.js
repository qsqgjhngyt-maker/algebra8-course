
/* =====================================================================
   v1.3.0 · ЗАКРЕПЛЕНИЕ И ПОДГОТОВКА
   Дополнительный слой после основной программы:
   7 класс → итог 8 класса → повышенный уровень → контрольные.
   ===================================================================== */

const v13StorageKey="a8_v13_mastery";
let v13State=(()=>{
  try{
    return Object.assign({
      review7:{},
      finalReview:{},
      advanced:{},
      entryBest:null,
      finalBest:null,
      exams:{}
    },JSON.parse(localStorage.getItem(v13StorageKey)||"{}"));
  }catch(e){
    return {review7:{},finalReview:{},advanced:{},entryBest:null,finalBest:null,exams:{}};
  }
})();
let v13TimerId=null,v13TimerLeft=0,v13TimerStartedAt=0;

function v13Save(){
  localStorage.setItem(v13StorageKey,JSON.stringify(v13State));
  if(typeof ch1TouchActivity==="function")ch1TouchActivity();
}
function v13Decorate(scrollTop=true){
  if(typeof applyReveal==="function")applyReveal();
  if(typeof fcScheduleGlossary==="function")fcScheduleGlossary();
  if(scrollTop)window.scrollTo(0,0);
}
function v13DomKey(key){
  return String(key).replace(/[^a-zA-Z0-9_-]/g,"_");
}
function v13Pct(n,total){return total?Math.round(n/total*100):0}
function v13ReviewSolved(){
  return Object.values(v13State.review7||{}).filter(Boolean).length;
}
function v13FinalReviewSolved(){
  return Object.values(v13State.finalReview||{}).filter(Boolean).length;
}
function v13AdvancedSolved(){
  return Object.values(v13State.advanced||{}).filter(Boolean).length;
}
function v13ExamBest(){
  const vals=Object.values(v13State.exams||{}).map(x=>Number(x.best||0));
  return vals.length?Math.max(...vals):0;
}
function v13LessonName(id){
  const t=chapters.flatMap(c=>c.topics).find(t=>t.id===id);
  return t?.title||id;
}
function v13ReviewName(id){
  return v13Data.review7.find(x=>x.id===id)?.title||id;
}
function v13CleanupTimer(){
  if(v13TimerId){clearInterval(v13TimerId);v13TimerId=null}
}
function v13FormatTime(sec){
  sec=Math.max(0,Math.floor(sec));
  return `${String(Math.floor(sec/60)).padStart(2,"0")}:${String(sec%60).padStart(2,"0")}`;
}
function v13CompareHtml(){
  const a=v13State.entryBest,b=v13State.finalBest;
  if(!a&&!b)return `<p class="muted">Пройди входную диагностику перед повторением, а финальную — после. Курс покажет изменение результата.</p>`;
  const ap=a?.pct??null,bp=b?.pct??null;
  const delta=ap!==null&&bp!==null?bp-ap:null;
  return `<div class="v13-compare-line">
    <div><span class="muted">На старте</span><div class="v13-compare-num">${ap!==null?ap+"%":"—"}</div></div>
    <span class="v13-path-arrow">→</span>
    <div><span class="muted">После повторения</span><div class="v13-compare-num">${bp!==null?bp+"%":"—"}</div></div>
    ${delta!==null?`<span class="status-chip">${delta>=0?"+":""}${delta} п.п.</span>`:""}
  </div>`;
}

function renderMastery(){
  v13CleanupTimer();
  setActive("mastery");pageTitle.textContent="Закрепление и подготовка";
  const r7=v13ReviewSolved(),fr=v13FinalReviewSolved(),adv=v13AdvancedSolved(),exam=v13ExamBest();
  content.innerHTML=`<section class="v13-hero reveal">
    <span class="eyebrow">После и вместе с основной программой</span>
    <h2>Закрепление и подготовка</h2>
    <p>Здесь темы уже не идут строго по параграфам. Нужно вспоминать базу 7 класса, узнавать метод самостоятельно, решать смешанные задачи и постепенно переходить к полноценной контрольной работе.</p>
    <div class="v13-score-strip">
      <div class="v13-score-box"><span>Повторение 7 класса</span><b>${r7}/32</b></div>
      <div class="v13-score-box"><span>Итог 8 класса</span><b>${fr}/24</b></div>
      <div class="v13-score-box"><span>Повышенный уровень</span><b>${adv}/12</b></div>
      <div class="v13-score-box"><span>Лучшая контрольная</span><b>${exam||"—"}/18</b></div>
    </div>
  </section>

  <section class="v13-diagnostic-compare reveal">
    <span class="eyebrow">📊 Измеряем реальный прогресс</span><h3>Входная → финальная диагностика</h3>
    ${v13CompareHtml()}
    <div class="v11-release-actions">
      <button class="secondary" onclick="v13Diagnostic('entry')">🩺 Входная диагностика</button>
      <button class="primary" onclick="v13Diagnostic('final')">🎓 Финальная диагностика</button>
    </div>
  </section>

  <div class="v13-hub-grid">
    ${v13HubCard("🔄","Повторение 7 класса","8 базовых модулей: степени, многочлены, формулы, разложение, уравнения, системы, функция и текстовые задачи.",r7,32,"v13Review7Hub()")}
    ${v13HubCard("🏁","Итоговое повторение 8 класса","24 смешанных задания. Тема заранее не подписана — нужно самому определить, какое правило использовать.",fr,24,"v13FinalReview(0)")}
    ${v13HubCard("🚀","Повышенный уровень","12 задач на идею, комбинацию правил и более самостоятельное рассуждение. Есть кнопка «Разобрать идею».",adv,12,"v13Advanced()")}
    ${v13HubCard("📝","Контрольные варианты","Три полноценных варианта по 18 заданий: базовый, смешанный и итоговый. Таймер включается по желанию.",exam,18,"v13ExamHub()")}
  </div>`;
  v13Decorate();
}
window.renderMastery=renderMastery;

function v13HubCard(icon,title,text,done,total,action){
  const pct=v13Pct(done,total);
  return `<article class="v13-hub-card reveal"><div class="v13-hub-icon">${icon}</div><h3>${title}</h3><p>${text}</p>
    <div class="v13-card-progress"><span>${done}/${total}</span><b>${pct}%</b></div>
    <div class="progress-bar"><span style="width:${pct}%"></span></div>
    <div style="margin-top:13px"><button class="primary" onclick="${action}">Открыть →</button></div></article>`;
}

/* -------------------- Входная и финальная диагностика -------------------- */
window.v13Diagnostic=(type)=>{
  v13CleanupTimer();setActive("mastery");
  const isEntry=type==="entry",arr=isEntry?v13Data.entryDiagnostic:v13Data.finalDiagnostic;
  pageTitle.textContent=isEntry?"Входная диагностика":"Финальная диагностика";
  content.innerHTML=`<section class="v13-hero reveal">
    <span class="eyebrow">${isEntry?"Перед повторением":"После изучения и повторения"}</span>
    <h2>${isEntry?"Входная диагностика":"Финальная диагностика"}</h2>
    <p>${isEntry?"16 коротких вопросов проверят фундамент 7 класса. Это не оценка — результат нужен, чтобы понять, что повторять первым.":"18 вопросов по ключевым навыкам 8 класса. После проверки сравним процент с входной диагностикой и покажем темы для повторения."}</p>
    <button class="secondary" onclick="renderMastery()">← Закрепление и подготовка</button>
  </section>
  <div class="v13-diag-list">${arr.map((q,i)=>`<div class="v13-diag-q" id="v13dq-${i}"><h4>${i+1}. ${q.q}</h4>
    <div class="v13-options">${q.options.map((o,j)=>`<label class="v13-option"><input type="radio" name="v13d-${i}" value="${j}"><span>${o}</span></label>`).join("")}</div>
    <div class="v13-feedback" id="v13df-${i}"></div></div>`).join("")}</div>
  <button class="primary glow-btn" style="margin-top:16px" onclick="v13SubmitDiagnostic('${type}')">Проверить результат</button>
  <div id="v13DiagResult"></div>`;
  v13Decorate();
};
window.v13SubmitDiagnostic=(type)=>{
  const isEntry=type==="entry",arr=isEntry?v13Data.entryDiagnostic:v13Data.finalDiagnostic;
  let score=0;const weak=[];
  arr.forEach((q,i)=>{
    const picked=document.querySelector(`input[name="v13d-${i}"]:checked`),box=document.querySelector(`#v13dq-${i}`),fb=document.querySelector(`#v13df-${i}`);
    const ok=picked&&Number(picked.value)===q.correct;
    box.classList.toggle("correct",!!ok);box.classList.toggle("wrong",!ok);
    if(ok){score++;fb.className="v13-feedback ok";fb.textContent="✅ Верно."}
    else{weak.push(q.tag);fb.className="v13-feedback bad";fb.textContent=`Правильный ответ: ${q.options[q.correct]}.`}
  });
  const pct=v13Pct(score,arr.length),obj={score,total:arr.length,pct,weak:[...new Set(weak)],date:Date.now()};
  const key=isEntry?"entryBest":"finalBest",prev=v13State[key];
  if(!prev||pct>=prev.pct)v13State[key]=obj;
  v13Save();
  const recs=[...new Set(weak)].slice(0,8);
  document.querySelector("#v13DiagResult").innerHTML=`<div class="v13-result">
    <strong>${score}/${arr.length} · ${pct}%</strong>
    <p>${pct>=85?"Очень уверенная база 🌟":pct>=65?"Хорошая база, осталось точечно укрепить несколько мест.":pct>=45?"Есть рабочая основа, но повторение заметно поможет.":"Начни спокойно с базовых модулей — именно для этого они здесь."}</p>
    ${isEntry?`<p><b>Что повторить первым:</b></p><div class="v13-recs">${recs.map(id=>`<button class="secondary" onclick="v13OpenReview7('${id}')">${v13ReviewName(id)}</button>`).join("")}</div>`:
    `<p><b>Темы 8 класса для повторения:</b></p><div class="v13-recs">${recs.map(id=>`<button class="secondary" onclick="openLesson('${id}')">${v13LessonName(id)}</button>`).join("")}</div>
     <div class="v13-diagnostic-compare"><b>Сравнение со стартом</b>${v13CompareHtml()}</div>`}
  </div>`;
  v13Decorate(false);
};

/* -------------------- Повторение 7 класса -------------------- */
window.v13Review7Hub=()=>{
  v13CleanupTimer();setActive("mastery");pageTitle.textContent="Повторение 7 класса";
  content.innerHTML=`<section class="v13-hero reveal"><span class="eyebrow">🔄 Фундамент перед 8 классом</span><h2>Повторение 7 класса</h2>
    <p>Не нужно проходить всё подряд. Входная диагностика может подсказать слабые модули, а каждый блок можно открыть отдельно.</p>
    <div class="v11-release-actions"><button class="secondary" onclick="renderMastery()">← Назад</button><button class="primary" onclick="v13Diagnostic('entry')">🩺 Пройти входную диагностику</button></div></section>
    <div class="v13-modules">${v13Data.review7.map(m=>{
      const done=m.tasks.filter((_,i)=>v13State.review7[`${m.id}:${i}`]).length,p=v13Pct(done,m.tasks.length);
      return `<article class="v13-module-card reveal"><span class="eyebrow">${m.icon} · база</span><h4>${m.title}</h4><p>${m.lead}</p>
      <div class="v13-card-progress"><span>${done}/${m.tasks.length} заданий</span><b>${p}%</b></div><div class="progress-bar"><span style="width:${p}%"></span></div>
      <div style="margin-top:12px"><button class="primary" onclick="v13OpenReview7('${m.id}')">${done?"Повторить":"Начать"} →</button></div></article>`;
    }).join("")}</div>`;
  v13Decorate();
};
window.v13OpenReview7=(id)=>{
  const m=v13Data.review7.find(x=>x.id===id);if(!m)return;
  v13CleanupTimer();setActive("mastery");pageTitle.textContent=m.title;
  const idx=v13Data.review7.findIndex(x=>x.id===id);
  content.innerHTML=`<section class="v13-hero reveal"><span class="eyebrow">Повторение 7 класса · ${idx+1}/${v13Data.review7.length}</span><h2>${m.title}</h2><p>${m.lead}</p>
    <div class="v11-release-actions"><button class="secondary" onclick="v13Review7Hub()">← Все модули</button>${idx<v13Data.review7.length-1?`<button class="secondary" onclick="v13OpenReview7('${v13Data.review7[idx+1].id}')">Следующий модуль →</button>`:""}</div></section>
    <div class="v13-theory"><div class="v13-note"><b>🧠 Что вспомнить</b><ul>${m.remember.map(x=>`<li>${x}</li>`).join("")}</ul></div>
      <div class="v13-example"><h4>📘 Пример: ${m.example.q}</h4>${m.example.steps.map((x,i)=>`<div class="v13-example-step"><b>${i+1}.</b> ${x}</div>`).join("")}</div></div>
    <section class="section reveal"><div class="section-head"><div><span class="eyebrow">Практика</span><h3>Проверь, восстановился ли навык</h3></div></div>
    ${m.tasks.map((t,i)=>v13TaskHtml("r7",`${id}:${i}`,t,!!v13State.review7[`${id}:${i}`],`v13CheckReview7('${id}',${i})`)).join("")}</section>`;
  v13Decorate();
};
window.v13CheckReview7=(id,i)=>{
  const m=v13Data.review7.find(x=>x.id===id),t=m.tasks[i],key=`${id}:${i}`,dom=v13DomKey(key),input=document.querySelector(`#v13ans-${dom}`),fb=document.querySelector(`#v13fb-${dom}`);
  const ok=v1Match(input.value,t.a);
  if(ok){v13State.review7[key]=true;fb.className="v13-feedback ok";fb.textContent="✅ Верно. Навык восстановлен.";input.closest(".v13-task")?.classList.add("solved");v13Save()}
  else{fb.className="v13-feedback bad";fb.textContent="Пока не так. Открой подсказку и попробуй ещё раз."}
};
function v13TaskHtml(prefix,key,t,solved,handler){
  const dom=v13DomKey(key);
  return `<div class="v13-task ${solved?"solved":""}"><h4>${solved?"✅ ":""}${t.q}</h4>
    <div class="v13-answer-row"><input id="v13ans-${dom}" placeholder="Ответ" autocomplete="off"><button class="check-btn" onclick="${handler}">Проверить</button>
    <button class="secondary" onclick="document.querySelector('#v13hint-${dom}').classList.toggle('show')">💡 Подсказка</button></div>
    <div class="v13-hint" id="v13hint-${dom}">${t.hint||t.solution||""}</div>
    <div class="v13-feedback" id="v13fb-${dom}">${solved?"Уже решено верно. Можно повторить.":""}</div></div>`;
}

/* -------------------- Итоговое повторение 8 класса -------------------- */
window.v13FinalReview=(station=0)=>{
  v13CleanupTimer();setActive("mastery");pageTitle.textContent="Итоговое повторение 8 класса";
  const all=v13Data.finalReview,start=station*6,tasks=all.slice(start,start+6),done=v13FinalReviewSolved();
  content.innerHTML=`<section class="v13-hero reveal"><span class="eyebrow">🏁 Смешиваем темы</span><h2>Итоговое повторение 8 класса</h2>
    <p>Здесь название темы специально не показывается до проверки. На контрольной никто не подсказывает, что сейчас нужно применить — навык выбора метода тоже нужно тренировать.</p>
    <div class="v13-card-progress"><span>${done}/${all.length} заданий решено</span><b>${v13Pct(done,all.length)}%</b></div><div class="progress-bar"><span style="width:${v13Pct(done,all.length)}%"></span></div>
    <button class="secondary" style="margin-top:12px" onclick="renderMastery()">← Назад</button></section>
    <div class="v13-stations">${[0,1,2,3].map(i=>`<button class="${i===station?"active":""}" onclick="v13FinalReview(${i})">Станция ${i+1}</button>`).join("")}</div>
    ${tasks.map((t,j)=>{const i=start+j,key=String(i);return v13TaskHtml("fr",key,t,!!v13State.finalReview[key],`v13CheckFinalReview(${i})`)}).join("")}`;
  v13Decorate();
};
window.v13CheckFinalReview=(i)=>{
  const t=v13Data.finalReview[i],key=String(i),input=document.querySelector(`#v13ans-${key}`),fb=document.querySelector(`#v13fb-${key}`),ok=v1Match(input.value,t.a);
  if(ok){v13State.finalReview[key]=true;fb.className="v13-feedback ok";fb.innerHTML=`✅ Верно. Это тема: <b>${v13LessonName(t.tag)}</b>.`;input.closest(".v13-task")?.classList.add("solved");v13Save()}
  else{fb.className="v13-feedback bad";fb.innerHTML=`Пока не так. Это связано с темой <b>${v13LessonName(t.tag)}</b>. Попробуй ещё раз.`;if(typeof v1RecordMistake==="function")v1RecordMistake(t.tag,t.q,input.value)}
};

/* -------------------- Повышенный уровень -------------------- */
window.v13Advanced=()=>{
  v13CleanupTimer();setActive("mastery");pageTitle.textContent="Повышенный уровень";
  const done=v13AdvancedSolved();
  content.innerHTML=`<section class="v13-hero reveal"><span class="eyebrow">🚀 Не просто применить формулу</span><h2>Повышенный уровень</h2>
    <p>Эти задания требуют увидеть идею или соединить два правила. Если не получается, кнопка «Разобрать идею» подскажет направление, но не выдаст ответ сразу.</p>
    <div class="v13-card-progress"><span>${done}/${v13Data.advanced.length} решено</span><b>${v13Pct(done,v13Data.advanced.length)}%</b></div><div class="progress-bar"><span style="width:${v13Pct(done,v13Data.advanced.length)}%"></span></div>
    <button class="secondary" style="margin-top:12px" onclick="renderMastery()">← Назад</button></section>
    ${v13Data.advanced.map((t,i)=>`<article class="v13-advanced-card reveal ${v13State.advanced[String(i)]?"solved":""}">
      <span class="eyebrow">${i+1}/12 · ${v13LessonName(t.tag)}</span><h4>${t.title}</h4><p>${t.q}</p>
      <div class="v13-answer-row"><input id="v13adv-${i}" placeholder="Ответ"><button class="check-btn" onclick="v13CheckAdvanced(${i})">Проверить</button>
      <button class="secondary" onclick="document.querySelector('#v13idea-${i}').classList.toggle('show')">🧠 Разобрать идею</button></div>
      <div class="v13-idea" id="v13idea-${i}"><b>Идея:</b> ${t.idea}</div>
      <div class="v13-solution" id="v13sol-${i}"><b>Решение:</b> ${t.solution}</div>
      <div class="v13-feedback" id="v13advfb-${i}">${v13State.advanced[String(i)]?"✅ Уже решено.":""}</div></article>`).join("")}`;
  v13Decorate();
};
window.v13CheckAdvanced=(i)=>{
  const t=v13Data.advanced[i],input=document.querySelector(`#v13adv-${i}`),fb=document.querySelector(`#v13advfb-${i}`),ok=v1Match(input.value,t.a);
  if(ok){v13State.advanced[String(i)]=true;fb.className="v13-feedback ok";fb.textContent="🌟 Верно. Идея найдена!";document.querySelector(`#v13sol-${i}`).classList.add("show");v13Save()}
  else{fb.className="v13-feedback bad";fb.textContent="Пока не получилось. Открой «Разобрать идею», а затем попробуй снова.";document.querySelector(`#v13idea-${i}`).classList.add("show");if(typeof v1RecordMistake==="function")v1RecordMistake(t.tag,t.q,input.value)}
};

/* -------------------- Контрольные варианты -------------------- */
window.v13ExamHub=()=>{
  v13CleanupTimer();setActive("mastery");pageTitle.textContent="Контрольные варианты";
  content.innerHTML=`<section class="v13-hero reveal"><span class="eyebrow">📝 Самостоятельная работа</span><h2>Контрольные и экзаменационный формат</h2>
    <p>Это не официальный государственный экзамен, а учебные варианты в экзаменационном стиле: темы перемешаны, подсказок во время работы нет, после сдачи появляется разбор и список слабых тем.</p>
    <button class="secondary" onclick="renderMastery()">← Назад</button></section>
    <div class="v13-exam-grid">${v13Data.examVariants.map(v=>{const best=v13State.exams[v.id]?.best||0;return `<article class="v13-exam-card reveal">
      <span class="eyebrow">${v.minutes} минут · 18 заданий</span><h3>${v.title}</h3><p>${v.desc}</p>
      <div class="v13-card-progress"><span>лучший результат</span><b>${best||"—"}/18</b></div>
      <button class="primary" onclick="v13StartExam('${v.id}')">Открыть вариант →</button></article>`}).join("")}</div>`;
  v13Decorate();
};
window.v13StartExam=(id)=>{
  v13CleanupTimer();const v=v13Data.examVariants.find(x=>x.id===id);if(!v)return;
  setActive("mastery");pageTitle.textContent=v.title;
  content.innerHTML=`<section class="v13-hero reveal"><span class="eyebrow">Контрольная · ${v.minutes} минут рекомендовано</span><h2>${v.title}</h2><p>${v.desc}</p>
    <div class="v13-timer" id="v13Timer"><span>⏱️ Таймер по желанию</span><b id="v13TimerText">${v13FormatTime(v.minutes*60)}</b>
    <button class="secondary" id="v13TimerBtn" onclick="v13StartTimer(${v.minutes})">Запустить</button></div>
    <button class="secondary" onclick="v13ExamHub()">← Варианты</button></section>
    <div class="callout warn"><b>Режим самостоятельной работы.</b> Ответы и решения появятся только после сдачи варианта.</div>
    ${v.tasks.map((t,i)=>`<div class="v13-exam-task" id="v13eq-${i}"><h4>${i+1}. ${t.q}</h4><input id="v13ea-${i}" placeholder="Ответ" autocomplete="off"><div class="v13-feedback" id="v13ef-${i}"></div></div>`).join("")}
    <button class="primary glow-btn" style="margin-top:16px" onclick="v13SubmitExam('${v.id}')">Сдать работу</button><div id="v13ExamResult"></div>`;
  v13Decorate();
};
window.v13StartTimer=(minutes)=>{
  if(v13TimerId)return;v13TimerLeft=minutes*60;v13TimerStartedAt=Date.now();
  const box=document.querySelector("#v13Timer"),text=document.querySelector("#v13TimerText"),btn=document.querySelector("#v13TimerBtn");
  box?.classList.add("running");if(btn){btn.disabled=true;btn.textContent="Таймер идёт"}
  v13TimerId=setInterval(()=>{
    v13TimerLeft--;if(text)text.textContent=v13FormatTime(v13TimerLeft);
    if(v13TimerLeft<=300)box?.classList.add("danger");
    if(v13TimerLeft<=0){v13CleanupTimer();if(text)text.textContent="00:00";alert("Рекомендованное время закончилось. Можно завершить текущий ответ и сдать работу.")}
  },1000);
};
window.v13SubmitExam=(id)=>{
  const v=v13Data.examVariants.find(x=>x.id===id);if(!v)return;
  let score=0;const weak=[];
  v.tasks.forEach((t,i)=>{
    const input=document.querySelector(`#v13ea-${i}`),box=document.querySelector(`#v13eq-${i}`),fb=document.querySelector(`#v13ef-${i}`),ok=v1Match(input.value,t.a);
    box.classList.toggle("correct",ok);box.classList.toggle("wrong",!ok);
    if(ok){score++;fb.className="v13-feedback ok";fb.textContent="✅ Верно."}
    else{weak.push(t.tag);fb.className="v13-feedback bad";fb.innerHTML=`Ответ: <b>${t.a[0]}</b>. ${t.solution}`}
  });
  const elapsed=v13TimerStartedAt?Math.round((Date.now()-v13TimerStartedAt)/1000):null;v13CleanupTimer();
  const prev=v13State.exams[id]||{best:0};v13State.exams[id]={best:Math.max(prev.best||0,score),last:score,elapsed,date:Date.now()};v13Save();
  const uniq=[...new Set(weak)].slice(0,8),pct=v13Pct(score,v.tasks.length);
  document.querySelector("#v13ExamResult").innerHTML=`<div class="v13-result"><strong>${score}/${v.tasks.length} · ${pct}%</strong>
    <p>${pct>=89?"Отличная самостоятельная работа 🌟":pct>=67?"Хороший результат. Несколько тем стоит закрепить.":pct>=45?"База есть, но перед следующей контрольной лучше повторить отмеченные темы.":"Вернись к итоговому повторению и пройди слабые темы небольшими блоками."}</p>
    ${elapsed?`<p class="muted">Время с момента запуска таймера: ${v13FormatTime(elapsed)}.</p>`:""}
    <b>Рекомендуется повторить:</b><div class="v13-recs">${uniq.map(tag=>`<button class="secondary" onclick="openLesson('${tag}')">${v13LessonName(tag)}</button>`).join("")}</div></div>`;
  v13Decorate(false);
};

/* -------------------- Интеграция в существующий курс -------------------- */
const v13BaseGo=go;
go=function(view){
  v13CleanupTimer();
  if(view==="mastery")return renderMastery();
  return v13BaseGo(view);
};

const v13BaseHome=renderHome;
renderHome=function(){
  v13BaseHome();
  document.querySelectorAll(".status-chip").forEach(x=>{if(x.textContent.includes("v1.2"))x.textContent=x.textContent.replace("v1.2","v1.3")});
  const target=content.querySelector(".course-final-banner")||content.lastElementChild;
  if(target&&!content.querySelector(".v13-home-banner")){
    target.insertAdjacentHTML("afterend",`<section class="v13-home-banner reveal"><div><span class="eyebrow">Новый большой раздел · v1.3</span>
      <h3>Повторение, повышенный уровень и контрольные</h3><p>Повтори фундамент 7 класса, смешай все темы 8 класса, реши задачи повышенной сложности и проверь себя полноценными вариантами.</p></div>
      <button class="primary glow-btn" onclick="renderMastery()">🎓 Открыть подготовку</button></section>`);
  }
  v13Decorate();
};
window.renderHome=renderHome;

/* Сброс теперь включает и дополнительную подготовку. */
const v13ResetBtn=document.querySelector("#resetBtn");
if(v13ResetBtn){
  v13ResetBtn.onclick=()=>{
    if(confirm("Сбросить весь учебный прогресс, результаты диагностик и контрольных?")){
      ["a8_completed","a8_attempts","a8_correct","a8_mistakes","a8_solved","a8_lastLesson","a8_streak","a8_last_active",
       "a8_ch1_test_best","a8_ch1_control_best","a8_v1_best","a8_v1_course_best","a8_v11_control_best",v13StorageKey,"a8_game_xp","a8_game_rewards","a8_tutor_memory_v16","a8_tutor_help_v16","a8_kitsune_brain_memory","a8_kitsune_brain_mode","a8_kitsune_brain_ready","a8_kitsune_dialog_history_v19","a8_kitsune_voice_reply_v19","a8_mathlab_homework_v130","a8_mathlab_skills_v130","a8_mathlab_history_v130","a8_learning_errors_v150","a8_learning_reviews_v150","a8_learning_sessions_v150","a8_learning_prefs_v150","a8_performance_auto_v150"].forEach(k=>localStorage.removeItem(k));
      location.reload();
    }
  };
}

renderHome();
