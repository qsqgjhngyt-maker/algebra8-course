
/* =====================================================================
   Kitsune Learning Intelligence v1.15.0
   Local-only adaptive route, error intelligence, spaced repetition,
   parent summary, export/import and deterministic tutor tools.
   ===================================================================== */
(() => {
  "use strict";

  const VERSION=window.KITSUNE_APP_VERSION||"1.15.0";
  const ERR_KEY="a8_learning_errors_v150";
  const REVIEW_KEY="a8_learning_reviews_v150";
  const SESSION_KEY="a8_learning_sessions_v150";
  const PREF_KEY="a8_learning_prefs_v150";
  const DAY=86400000;
  const REVIEW_DAYS=[1,3,7,14,30];

  let errors=[];
  let reviews={};
  let sessions=[];
  let prefs={sessionSize:7,autoOptimize:true};
  let currentSession=null;
  let activeTab="today";

  function load(){
    try{errors=JSON.parse(localStorage.getItem(ERR_KEY)||"[]")}catch(e){errors=[]}
    try{reviews=JSON.parse(localStorage.getItem(REVIEW_KEY)||"{}")}catch(e){reviews={}}
    try{sessions=JSON.parse(localStorage.getItem(SESSION_KEY)||"[]")}catch(e){sessions=[]}
    try{prefs={...prefs,...JSON.parse(localStorage.getItem(PREF_KEY)||"{}")}}catch(e){}
    if(!Array.isArray(errors))errors=[];
    if(!reviews||typeof reviews!=="object")reviews={};
    if(!Array.isArray(sessions))sessions=[];
  }
  function save(){
    try{
      localStorage.setItem(ERR_KEY,JSON.stringify(errors.slice(-250)));
      localStorage.setItem(REVIEW_KEY,JSON.stringify(reviews));
      localStorage.setItem(SESSION_KEY,JSON.stringify(sessions.slice(-90)));
      localStorage.setItem(PREF_KEY,JSON.stringify(prefs));
    }catch(e){}
  }
  load();

  function esc(s){
    return String(s??"").replace(/[&<>"']/g,c=>({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
    }[c]));
  }
  function norm(s){
    return String(s??"").toLowerCase().replace(/[−–—]/g,"-").replace(/\s+/g," ").trim();
  }
  function allTopics(){
    try{
      if(typeof chapters!=="undefined"&&Array.isArray(chapters)){
        return chapters.flatMap(ch=>ch.topics.map(t=>({
          id:t.id,title:t.title,chapter:ch.id,chapterTitle:ch.title
        })));
      }
    }catch(e){}
    return [];
  }
  function topicMeta(id){return allTopics().find(x=>x.id===id)||{id,title:id||"Алгебра",chapter:0,chapterTitle:""}}
  function topicRule(id){
    try{
      const d=typeof lessonData!=="undefined"?lessonData[id]:null;
      return String(d?.remember||d?.formula||d?.why||d?.lead||"").replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim();
    }catch(e){return ""}
  }

  function classifyError({topicId="",question="",student="",expected="",detail=""}={}){
    const text=norm([question,student,expected,detail].join(" "));
    const id=String(topicId||"");
    if((id.startsWith("4-")||/[<>≤≥]/.test(text))&&(/отрицател|минус|знак/.test(text)||/-\d/.test(text))){
      return {code:"inequality_flip",title:"Смена знака неравенства",icon:"↔️"};
    }
    if(["1-1","1-2","1-7","3-26","5-42"].includes(id)||/\bодз\b|знаменател|делени[ея] на ноль/.test(text)){
      return {code:"domain",title:"ОДЗ и запрещённые значения",icon:"🚧"};
    }
    if(id.startsWith("1-")||/дроб|знаменател|числител/.test(text)){
      return {code:"fraction",title:"Действия с дробями",icon:"➗"};
    }
    if(["3-21","3-24"].includes(id)||/дискриминант|\bd\s*=/.test(text)){
      return {code:"discriminant",title:"Дискриминант и корни",icon:"🔷"};
    }
    if(id==="3-23"||/виет/.test(text)){
      return {code:"vieta",title:"Теорема Виета",icon:"🔗"};
    }
    if(["3-29","3-30","3-31","3-32"].includes(id)||/систем/.test(text)){
      return {code:"system",title:"Системы уравнений",icon:"🧩"};
    }
    if(id.startsWith("2-")||/√|корн/.test(text)){
      return {code:"root",title:"Квадратные корни",icon:"√"};
    }
    if(id.startsWith("6-")||/степен|10\^/.test(text)){
      return {code:"power",title:"Степени и стандартный вид",icon:"⚡"};
    }
    if(id.startsWith("5-")||/функц|график/.test(text)){
      return {code:"function",title:"Функции и графики",icon:"📈"};
    }
    if(id.startsWith("3-")){
      return {code:"equation",title:"Уравнения",icon:"🟰"};
    }
    return {code:"arithmetic",title:"Вычисления и преобразования",icon:"🧮"};
  }

  function ensureReview(topicId){
    if(!topicId)return null;
    const r=reviews[topicId]||{topicId,stage:0,due:Date.now()+DAY,last:0,successes:0,failures:0};
    reviews[topicId]=r;
    return r;
  }

  function recordError(data={}){
    const topicId=data.topicId||"";
    const cls=classifyError(data);
    const now=Date.now();
    const rec={
      id:"err_"+now+"_"+Math.random().toString(36).slice(2,7),
      topicId,question:String(data.question||""),
      student:String(data.student||""),
      expected:String(data.expected||""),
      detail:String(data.detail||""),
      code:cls.code,title:cls.title,icon:cls.icon,
      ts:now,resolved:false
    };
    errors.push(rec);
    const r=ensureReview(topicId);
    if(r){
      r.stage=0;r.due=now+DAY;r.last=now;r.failures=(r.failures||0)+1;
    }
    save();
    return rec;
  }

  function recordSuccess(topicId){
    if(!topicId)return;
    const now=Date.now();
    const r=ensureReview(topicId);
    r.stage=Math.min(REVIEW_DAYS.length-1,(r.stage||0)+1);
    r.due=now+REVIEW_DAYS[r.stage]*DAY;
    r.last=now;r.successes=(r.successes||0)+1;
    const e=[...errors].reverse().find(x=>x.topicId===topicId&&!x.resolved);
    if(e)e.resolved=true;
    save();
  }

  function recordGeneratedResult(task,ok,student=""){
    if(!task?.topicId)return;
    if(ok)recordSuccess(task.topicId);
    else recordError({
      topicId:task.topicId,question:task.question,student,
      expected:task.answer,detail:task.hint||task.explanation||""
    });
  }

  function recordStepResult(input,result,topicId=""){
    if(result?.ok){if(topicId)recordSuccess(topicId);return}
    const bad=result?.rows?.find(x=>!x.ok);
    recordError({
      topicId,question:String(input||""),student:bad?.line||"",
      detail:bad?.message||"Ошибка в последовательности шагов"
    });
  }

  function mathLabSkills(){
    try{return JSON.parse(localStorage.getItem("a8_mathlab_skills_v130")||"{}")}catch(e){return {}}
  }
  function recordTopicSkill(topicId,ok){
    if(!topicId)return;
    let data={};
    try{data=JSON.parse(localStorage.getItem("a8_mathlab_skills_v130")||"{}")}catch(e){}
    const key=`topic:${topicId}`;
    const row=data[key]||{attempts:0,success:0,last:0};
    row.attempts=Number(row.attempts||0)+1;
    if(ok)row.success=Number(row.success||0)+1;
    row.last=Date.now();
    data[key]=row;
    try{localStorage.setItem("a8_mathlab_skills_v130",JSON.stringify(data))}catch(e){}
  }

  function topicStats(id){
    const s=mathLabSkills()[`topic:${id}`]||{attempts:0,success:0};
    const attempts=Number(s.attempts||0),success=Number(s.success||0);
    return {attempts,success,accuracy:attempts?Math.round(success/attempts*100):null};
  }
  function weakestTopics(limit=8){
    const due=dueReviews().map(x=>x.topicId);
    return allTopics().map(t=>{
      const s=topicStats(t.id);
      let score=s.accuracy===null?55:s.accuracy;
      score+=Math.min(15,s.attempts*1.5);
      if(due.includes(t.id))score-=28;
      const openErrors=errors.filter(e=>e.topicId===t.id&&!e.resolved).length;
      score-=openErrors*11;
      return {...t,...s,score,openErrors};
    }).sort((a,b)=>a.score-b.score).slice(0,limit);
  }
  function dueReviews(){
    const now=Date.now();
    return Object.values(reviews).filter(r=>Number(r.due||0)<=now)
      .sort((a,b)=>Number(a.due||0)-Number(b.due||0));
  }
  function nextReviews(){
    const now=Date.now();
    return Object.values(reviews).filter(r=>Number(r.due||0)>now)
      .sort((a,b)=>Number(a.due||0)-Number(b.due||0));
  }
  function formatDate(ts){
    if(!ts)return "—";
    try{return new Date(ts).toLocaleDateString("ru-RU",{day:"numeric",month:"short"})}catch(e){return "—"}
  }
  function dayWord(n){return n===1?"день":n>=2&&n<=4?"дня":"дней"}

  function buildPlan(size=prefs.sessionSize||7){
    const n=Math.max(4,Math.min(12,Number(size)||7));
    const due=dueReviews().map(r=>r.topicId);
    const weak=weakestTopics(20).map(x=>x.id);
    const seen=new Set(),ids=[];
    for(const id of [...due,...weak]){
      if(id&&!seen.has(id)){seen.add(id);ids.push(id)}
      if(ids.length>=n)break;
    }
    const all=allTopics();
    for(const t of all){
      if(ids.length>=n)break;
      if(!seen.has(t.id)){seen.add(t.id);ids.push(t.id)}
    }
    return ids.slice(0,n);
  }

  async function createSession(){
    const ids=buildPlan();
    const tasks=[];
    for(let i=0;i<ids.length;i++){
      const stat=topicStats(ids[i]);
      const difficulty=stat.accuracy===null||stat.accuracy<60?1:stat.accuracy<82?2:3;
      try{
        const task=await window.KitsuneMath.generateTopic(ids[i],difficulty);
        tasks.push(task);
      }catch(e){}
    }
    currentSession={
      id:"ses_"+Date.now(),
      started:Date.now(),finished:0,
      taskIds:tasks.map(x=>x.topicId),
      tasks,answers:{},correct:0,total:tasks.length
    };
    return currentSession;
  }

  function hintLadder(task,level){
    level=Math.max(1,Math.min(4,Number(level)||1));
    const rule=topicRule(task.topicId);
    if(level===1)return "Определи, к какой теме относится задача, и назови первое правило, которое здесь можно применить.";
    if(level===2)return task.hint||rule||"Сделай один маленький преобразующий шаг, не пытаясь решить всё сразу.";
    if(level===3)return rule?`Правило темы: ${rule}`:(task.hint||"Сравни свой последний шаг с условием задачи.");
    return `${task.explanation||"Проверенный разбор готов."} Ответ: ${task.answer}`;
  }

  async function similarTasks(topicId,count=3){
    const out=[];
    for(let i=0;i<count;i++){
      try{out.push(await window.KitsuneMath.generateTopic(topicId,2))}catch(e){}
    }
    return out;
  }

  function parentSummary(){
    const topicRows=allTopics().map(t=>({...t,...topicStats(t.id)}));
    const practiced=topicRows.filter(x=>x.attempts>0).length;
    const totalAttempts=topicRows.reduce((a,x)=>a+x.attempts,0);
    const totalSuccess=topicRows.reduce((a,x)=>a+x.success,0);
    const accuracy=totalAttempts?Math.round(totalSuccess/totalAttempts*100):null;
    const weak=weakestTopics(5);
    const recent=sessions.slice(-14);
    const minutes=Math.round(recent.reduce((a,s)=>a+Number(s.durationMin||0),0));
    return {
      practiced,total:topicRows.length,totalAttempts,accuracy,
      due:dueReviews().length,openErrors:errors.filter(x=>!x.resolved).length,
      weak,sessionCount:recent.length,minutes
    };
  }

  function exportData(){
    const storage={};
    for(let i=0;i<localStorage.length;i++){
      const k=localStorage.key(i);
      if(k&&k.startsWith("a8_"))storage[k]=localStorage.getItem(k);
    }
    return {
      product:"Kitsune Algebra 8",
      schema:"kitsune-local-progress-v1",
      version:VERSION,
      exportedAt:new Date().toISOString(),
      storage
    };
  }
  function downloadExport(){
    const blob=new Blob([JSON.stringify(exportData(),null,2)],{type:"application/json"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url;a.download=`kitsune-progress-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1500);
  }
  async function importFile(file){
    const text=await file.text();
    const data=JSON.parse(text);
    if(data?.schema!=="kitsune-local-progress-v1"||!data.storage||typeof data.storage!=="object"){
      throw new Error("Это не файл прогресса Kitsune.");
    }
    const keys=Object.keys(data.storage).filter(k=>k.startsWith("a8_"));
    if(!keys.length)throw new Error("В файле нет локальных данных Kitsune.");
    if(!confirm(`Импортировать ${keys.length} локальных записей? Текущий прогресс с такими ключами будет заменён.`)){
      return false;
    }
    for(const k of keys)localStorage.setItem(k,String(data.storage[k]??""));
    return true;
  }

  function tutorSummaryText(){
    const s=parentSummary();
    if(!s.totalAttempts)return "Пока мало данных. Пройди несколько заданий в Math Lab — я начну видеть сильные и слабые темы.";
    const weak=s.weak.slice(0,3).map(x=>x.title).join(", ");
    return `Сейчас я бы повторила: ${weak}. Общая точность по генератору ${s.accuracy??"—"}%, к повторению сегодня ${s.due}.`;
  }

  const TutorTools={
    async dispatch(message,ctx=null){
      const q=norm(message);
      if(/что.*повтор|что.*не получ|слаб|план.*занят|что.*учить/.test(q)){
        return {handled:true,text:tutorSummaryText()};
      }
      if(/похож.*пример|дай.*похож|ещ[её].*задач/.test(q)){
        let id="";
        try{id=ctx?.lesson?.id||ctx?.lessonId||state?.lastLesson||""}catch(e){}
        if(!id)id=errors.slice().reverse().find(x=>x.topicId)?.topicId||"3-21";
        const task=(await similarTasks(id,1))[0];
        if(task)return {handled:true,text:`Попробуй похожее: ${task.question}` ,task};
      }
      if(/повторен|когда.*повтор/.test(q)){
        const due=dueReviews();
        if(!due.length)return {handled:true,text:"На сегодня обязательных повторений нет. Можно сделать короткую адаптивную тренировку."};
        return {handled:true,text:`Сегодня к повторению ${due.length}: ${due.slice(0,4).map(x=>topicMeta(x.topicId).title).join(", ")}.`};
      }
      return {handled:false};
    },
    summary:tutorSummaryText,
    similar:similarTasks,
    plan:buildPlan
  };
  window.KitsuneTutorTools=TutorTools;

  function shell(){
    const s=parentSummary();
    return `
      <section class="ki-hero glass-panel reveal">
        <div>
          <span class="eyebrow">Kitsune Tutor Intelligence · v${VERSION}</span>
          <h2>🧭 Мой учебный маршрут</h2>
          <p>Kitsune собирает ошибки, планирует повторение и предлагает короткие занятия. Всё хранится только на этом устройстве.</p>
        </div>
        <div class="ki-hero-stats">
          <div><b>${s.due}</b><span>повторить сегодня</span></div>
          <div><b>${s.openErrors}</b><span>активных ошибок</span></div>
          <div><b>${s.accuracy===null?"—":s.accuracy+"%"}</b><span>точность</span></div>
        </div>
      </section>
      <section class="ki-shell glass-panel">
        <div class="ki-tabs">
          <button data-ki-tab="today" class="${activeTab==="today"?"active":""}">✨ Сегодня</button>
          <button data-ki-tab="errors" class="${activeTab==="errors"?"active":""}">📒 Ошибки</button>
          <button data-ki-tab="reviews" class="${activeTab==="reviews"?"active":""}">🔁 Повторение</button>
          <button data-ki-tab="parent" class="${activeTab==="parent"?"active":""}">👨‍👩‍👧 Родителям</button>
        </div>
        <div id="kiBody"></div>
      </section>`;
  }

  function todayHtml(){
    const weak=weakestTopics(5),due=dueReviews();
    return `
      <div class="ki-grid">
        <section class="ki-card">
          <span class="eyebrow">План на сегодня</span>
          <h3>${prefs.sessionSize||7} заданий · примерно 15 минут</h3>
          <p>${due.length?`Сначала ${due.length} повторений по расписанию, затем слабые темы.`:"Обязательных повторений сегодня нет — возьмём слабые и мало тренировавшиеся темы."}</p>
          <label class="ki-session-size">Размер занятия
            <select id="kiSessionSize">
              <option value="5" ${Number(prefs.sessionSize)===5?"selected":""}>Короткое · 5 заданий</option>
              <option value="7" ${Number(prefs.sessionSize)===7?"selected":""}>Обычное · 7 заданий</option>
              <option value="10" ${Number(prefs.sessionSize)===10?"selected":""}>Расширенное · 10 заданий</option>
            </select>
          </label>
          <div class="ki-plan-list">
            ${buildPlan().map((id,i)=>`<span><b>${i+1}</b>${esc(topicMeta(id).title)}</span>`).join("")}
          </div>
          <button class="primary glow-btn" id="kiStartSession">🦊 Начать занятие</button>
        </section>
        <section class="ki-card">
          <span class="eyebrow">Сейчас важнее всего</span>
          <h3>Слабые темы</h3>
          ${weak.map(x=>`<div class="ki-weak-row">
            <div><b>${esc(x.title)}</b><small>${x.attempts?`${x.accuracy}% · ${x.attempts} попыток`:"ещё мало практики"}</small></div>
            <button data-ki-practice="${x.id}">3 похожих</button>
          </div>`).join("")}
        </section>
      </div>
      <div id="kiSessionHost"></div>`;
  }

  function errorHtml(){
    const open=[...errors].reverse().filter(x=>!x.resolved);
    const groups={};
    for(const e of open)(groups[e.code]??=[]).push(e);
    return `
      <div class="ki-section-head">
        <div><span class="eyebrow">Error Intelligence</span><h3>Умная тетрадь ошибок</h3></div>
        <span class="status-chip">${open.length} активных</span>
      </div>
      ${open.length?Object.entries(groups).map(([code,rows])=>`
        <section class="ki-error-group">
          <div class="ki-error-title"><span>${rows[0].icon}</span><div><b>${esc(rows[0].title)}</b><small>${rows.length} ${rows.length===1?"ошибка":"ошибок"}</small></div></div>
          ${rows.slice(0,8).map(e=>`<article class="ki-error-item">
            <div><span class="eyebrow">${esc(e.topicId||"Math Lab")} · ${formatDate(e.ts)}</span><b>${esc(e.question||e.student||e.title)}</b>
            ${e.student?`<small>Ответ/шаг: ${esc(e.student)}</small>`:""}</div>
            <button data-ki-similar="${esc(e.topicId)}">Дать 3 похожих</button>
          </article>`).join("")}
        </section>`).join(""):`<div class="ml-empty">🎉 Активных ошибок пока нет. Новые ошибки из Math Lab будут появляться здесь автоматически.</div>`}
      <div id="kiSimilarHost"></div>`;
  }

  function reviewsHtml(){
    const due=dueReviews(),next=nextReviews().slice(0,12);
    return `
      <div class="ki-section-head">
        <div><span class="eyebrow">Spaced Repetition</span><h3>Интервальное повторение</h3></div>
        <span class="status-chip">${due.length} сегодня</span>
      </div>
      ${due.length?`<section class="ki-review-now">
        ${due.map(r=>`<div class="ki-review-row"><span>🔁</span><div><b>${esc(topicMeta(r.topicId).title)}</b><small>этап ${Number(r.stage||0)+1} · нужно повторить сейчас</small></div><button data-ki-review="${r.topicId}">Повторить</button></div>`).join("")}
      </section>`:`<div class="ml-success">✅ На сегодня обязательных повторений нет.</div>`}
      <h3 class="ki-subtitle">Дальше по расписанию</h3>
      ${next.length?next.map(r=>`<div class="ki-next-review"><span>${formatDate(r.due)}</span><b>${esc(topicMeta(r.topicId).title)}</b></div>`).join(""):`<p class="muted">Расписание появится после первых ошибок и успешных повторений.</p>`}
      <div id="kiReviewHost"></div>`;
  }

  function parentHtml(){
    const s=parentSummary();
    return `
      <div class="ki-parent-grid">
        <section class="ki-card">
          <span class="eyebrow">Локальная сводка</span><h3>Как идёт обучение</h3>
          <div class="ki-parent-stats">
            <div><b>${s.practiced}/51</b><span>тем тренировались</span></div>
            <div><b>${s.totalAttempts}</b><span>проверенных ответов</span></div>
            <div><b>${s.accuracy===null?"—":s.accuracy+"%"}</b><span>точность</span></div>
            <div><b>${s.sessionCount}</b><span>адаптивных занятий</span></div>
          </div>
          <h4>Сейчас стоит обратить внимание</h4>
          <div class="ki-parent-weak">${s.weak.map(x=>`<span>${esc(x.title)}${x.accuracy!==null?` · ${x.accuracy}%`:""}</span>`).join("")}</div>
        </section>
        <section class="ki-card">
          <span class="eyebrow">Перенос между устройствами</span><h3>Экспорт и импорт</h3>
          <p>Экспорт содержит только локальные ключи прогресса a8_*. AI-модели, OPFS и кэши в файл не входят.</p>
          <div class="ml-actions">
            <button class="primary" id="kiExport">⬇️ Экспорт прогресса</button>
            <button class="secondary" id="kiImportBtn">⬆️ Импорт прогресса</button>
            <input type="file" id="kiImportFile" accept="application/json,.json" hidden>
          </div>
          <div id="kiImportStatus"></div>
        </section>
        <section class="ki-card">
          <span class="eyebrow">Производительность</span><h3>Автооптимизация</h3>
          <label class="ki-toggle"><input id="kiAutoOptimize" type="checkbox" ${prefs.autoOptimize?"checked":""}><span>Снижать декоративную нагрузку только во время тяжёлых вычислений</span></label>
          <div class="ki-device-info">${deviceInfoHtml()}</div>
        </section>
        <section class="ki-card ki-privacy-card">
          <span class="eyebrow">Privacy First</span><h3>Никакого учебного backend</h3>
          <p>Ошибки, расписание повторений, родительская сводка и история занятий остаются в локальном хранилище браузера. Экспорт выполняется только по явной кнопке пользователя.</p>
        </section>
      </div>`;
  }

  function deviceInfoHtml(){
    const mem=Number(navigator.deviceMemory||0);
    const cores=Number(navigator.hardwareConcurrency||0);
    const ios=/iPhone|iPad|iPod/i.test(navigator.userAgent||"")||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1);
    const mobile=/Android|iPhone|iPad|iPod/i.test(navigator.userAgent||"");
    return `<span>${mobile?"📱 мобильное":"💻 компьютер"}</span>
      ${mem?`<span>RAM hint: ${mem} GB</span>`:""}
      ${cores?`<span>логических ядер: ${cores}</span>`:""}
      ${ios?`<span>iOS/iPadOS: бережный режим памяти</span>`:""}`;
  }

  function renderTab(){
    const host=document.querySelector("#kiBody");if(!host)return;
    host.innerHTML=activeTab==="errors"?errorHtml():activeTab==="reviews"?reviewsHtml():activeTab==="parent"?parentHtml():todayHtml();
    bindTab();
  }

  async function renderSimilar(topicId,hostId="kiSimilarHost"){
    const host=document.querySelector(`#${hostId}`);if(!host)return;
    host.innerHTML=`<div class="ml-loading">⚙ Генерирую 3 похожих задания локально…</div>`;
    const tasks=await similarTasks(topicId,3);
    host.innerHTML=`<section class="ki-similar-pack">
      <div class="ki-section-head"><div><span class="eyebrow">${esc(topicMeta(topicId).title)}</span><h3>3 похожих задания</h3></div></div>
      ${tasks.map((t,i)=>sessionTaskCard(t,i,"similar")).join("")}
    </section>`;
    bindSessionCards(tasks,"similar");
  }

  function sessionTaskCard(task,index,prefix="session"){
    return `<article class="ki-task" data-ki-task="${prefix}-${index}">
      <div class="ki-task-head"><span class="eyebrow">§ ${esc(task.topicId)} · ${esc(task.topicTitle)}</span><b>${index+1}</b></div>
      <h3>${esc(task.question)}</h3>
      ${task.kind==="choice"?`<div class="ki-choice-list">${task.options.map((o,j)=>`<label><input type="radio" name="ki_${prefix}_${index}" value="${j}"><span>${esc(o)}</span></label>`).join("")}</div>`:
        `<input class="ml-input ki-answer" id="kiAnswer_${prefix}_${index}" placeholder="Твой ответ">`}
      <div class="ml-actions">
        <button class="primary" data-ki-check="${prefix}-${index}">Проверить</button>
        <button class="secondary" data-ki-hint="${prefix}-${index}" data-level="1">💡 Подсказка 1/4</button>
      </div>
      <div id="kiFeedback_${prefix}_${index}"></div>
    </article>`;
  }

  function bindSessionCards(tasks,prefix="session"){
    tasks.forEach((task,index)=>{
      const key=`${prefix}-${index}`;
      document.querySelector(`[data-ki-check="${key}"]`)?.addEventListener("click",async()=>{
        let answer="";
        if(task.kind==="choice")answer=document.querySelector(`input[name="ki_${prefix}_${index}"]:checked`)?.value??"";
        else answer=document.querySelector(`#kiAnswer_${prefix}_${index}`)?.value??"";
        const fb=document.querySelector(`#kiFeedback_${prefix}_${index}`);
        if(answer===""){fb.innerHTML=`<div class="ml-error">Сначала введи или выбери ответ.</div>`;return}
        try{
          const check=await window.KitsuneMath.checkGenerated(task,answer);
          recordTopicSkill(task.topicId,check.ok);
          recordGeneratedResult(task,check.ok,answer);
          if(currentSession&&prefix==="session"){
            currentSession.answers[task.id]={ok:check.ok,answer};
            currentSession.correct=Object.values(currentSession.answers).filter(x=>x.ok).length;
          }
          fb.innerHTML=check.ok?`<div class="ml-success">✅ Верно!</div>`:`<div class="ml-error">Пока не совпало. Подсказка поможет найти место ошибки.</div>`;
        }catch(e){fb.innerHTML=`<div class="ml-error">${esc(e.message||e)}</div>`}
      });
      document.querySelector(`[data-ki-hint="${key}"]`)?.addEventListener("click",e=>{
        const b=e.currentTarget;
        let level=Number(b.dataset.level||1);
        const fb=document.querySelector(`#kiFeedback_${prefix}_${index}`);
        fb.innerHTML=`<div class="ki-hint-level"><b>Подсказка ${level}/4</b><p>${esc(hintLadder(task,level))}</p></div>`;
        level=Math.min(4,level+1);b.dataset.level=String(level);
        b.textContent=level===4?"🧮 Полный разбор 4/4":`💡 Подсказка ${level}/4`;
      });
    });
  }

  async function startSession(){
    const host=document.querySelector("#kiSessionHost");if(!host)return;
    host.innerHTML=`<div class="ml-loading">🦊 Kitsune собирает персональное занятие…</div>`;
    const session=await createSession();
    host.innerHTML=`<section class="ki-session">
      <div class="ki-section-head"><div><span class="eyebrow">Adaptive Session</span><h2>Сегодняшнее занятие</h2></div><span class="status-chip">${session.tasks.length} заданий</span></div>
      ${session.tasks.map((t,i)=>sessionTaskCard(t,i,"session")).join("")}
      <button class="primary glow-btn" id="kiFinishSession">🏁 Завершить занятие</button>
      <div id="kiSessionResult"></div>
    </section>`;
    bindSessionCards(session.tasks,"session");
    document.querySelector("#kiFinishSession")?.addEventListener("click",finishSession);
  }

  function finishSession(){
    if(!currentSession)return;
    currentSession.finished=Date.now();
    currentSession.durationMin=Math.max(1,Math.round((currentSession.finished-currentSession.started)/60000));
    currentSession.correct=Object.values(currentSession.answers).filter(x=>x.ok).length;
    currentSession.answered=Object.keys(currentSession.answers).length;
    sessions.push({
      id:currentSession.id,started:currentSession.started,finished:currentSession.finished,
      durationMin:currentSession.durationMin,correct:currentSession.correct,
      answered:currentSession.answered,total:currentSession.total,taskIds:currentSession.taskIds
    });
    sessions=sessions.slice(-90);save();
    const pct=currentSession.answered?Math.round(currentSession.correct/currentSession.answered*100):0;
    const host=document.querySelector("#kiSessionResult");
    if(host)host.innerHTML=`<div class="ki-session-finish"><h3>🦊 Занятие сохранено</h3><p>${currentSession.correct}/${currentSession.answered||0} правильных · ${pct}% · ${currentSession.durationMin} мин.</p><button class="secondary" id="kiRefreshRoute">Обновить маршрут</button></div>`;
    document.querySelector("#kiRefreshRoute")?.addEventListener("click",render);
  }

  function bindTab(){
    document.querySelector("#kiSessionSize")?.addEventListener("change",e=>{
      prefs.sessionSize=Number(e.target.value)||7;save();renderTab();
    });
    document.querySelector("#kiStartSession")?.addEventListener("click",startSession);
    document.querySelectorAll("[data-ki-practice]").forEach(b=>b.addEventListener("click",()=>renderSimilar(b.dataset.kiPractice,"kiSessionHost")));
    document.querySelectorAll("[data-ki-similar]").forEach(b=>b.addEventListener("click",()=>renderSimilar(b.dataset.kiSimilar,"kiSimilarHost")));
    document.querySelectorAll("[data-ki-review]").forEach(b=>b.addEventListener("click",()=>renderSimilar(b.dataset.kiReview,"kiReviewHost")));

    document.querySelector("#kiExport")?.addEventListener("click",downloadExport);
    document.querySelector("#kiImportBtn")?.addEventListener("click",()=>document.querySelector("#kiImportFile")?.click());
    document.querySelector("#kiImportFile")?.addEventListener("change",async e=>{
      const file=e.target.files?.[0];if(!file)return;
      const host=document.querySelector("#kiImportStatus");
      try{
        const ok=await importFile(file);
        if(ok){host.innerHTML=`<div class="ml-success">✅ Прогресс импортирован. Приложение перезагрузится.</div>`;setTimeout(()=>location.reload(),900)}
      }catch(err){host.innerHTML=`<div class="ml-error">${esc(err.message||err)}</div>`}
    });
    document.querySelector("#kiAutoOptimize")?.addEventListener("change",e=>{
      prefs.autoOptimize=!!e.target.checked;save();
      window.KitsunePerformance?.setAuto?.(prefs.autoOptimize);
    });
  }

  function render(){
    const content=document.querySelector("#content");if(!content)return;
    document.querySelector("#pageTitle").textContent="Мой учебный маршрут";
    document.querySelectorAll(".nav-btn").forEach(b=>b.classList.toggle("active",b.dataset.view==="route"));
    content.innerHTML=shell();
    document.querySelectorAll("[data-ki-tab]").forEach(b=>b.addEventListener("click",()=>{
      activeTab=b.dataset.kiTab;
      document.querySelectorAll("[data-ki-tab]").forEach(x=>x.classList.toggle("active",x===b));
      renderTab();
    }));
    renderTab();
    try{window.scrollTo({top:0,behavior:"smooth"})}catch(e){}
  }

  const previousGo=typeof window.go==="function"?window.go:null;
  window.go=function(view){
    if(view==="route"){render();return}
    return previousGo?.(view);
  };
  function bindRoute(){
    document.querySelectorAll('[data-view="route"],[data-view-jump="route"]').forEach(btn=>{
      if(btn.dataset.kiBound==="1")return;
      btn.dataset.kiBound="1";
      btn.addEventListener("click",e=>{
        e.preventDefault();e.stopImmediatePropagation();render();
        try{
          if(window.innerWidth<981){
            document.querySelector("#sidebar")?.classList.remove("open");
            document.body.classList.remove("sidebar-mobile-open");
            document.querySelector("#sidebarScrim")?.setAttribute("aria-hidden","true");
          }
        }catch(x){}
      },{capture:true});
    });
  }
  bindRoute();
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",bindRoute,{once:true});

  window.KitsuneLearning={
    version:VERSION,
    render,recordError,recordSuccess,recordGeneratedResult,recordStepResult,
    classifyError,dueReviews,weakestTopics,buildPlan,similarTasks,parentSummary,
    exportData,tutorSummary:tutorSummaryText,
    prefs:()=>({...prefs})
  };
})();
