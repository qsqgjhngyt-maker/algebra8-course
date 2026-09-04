
/* =====================================================================
   Kitsune Student Experience v2.2.0
   Child-first UI + Adult Center + Accessibility.
   ===================================================================== */
(() => {
  "use strict";

  const VERSION=window.KITSUNE_APP_VERSION||"2.2.0";
  const MODE_KEY="a8_student_mode_v220";
  const A11Y_KEY="a8_accessibility_v220";
  let adultTab="overview";

  let a11y={largeText:false,highContrast:false,reducedMotion:false};
  try{a11y={...a11y,...JSON.parse(localStorage.getItem(A11Y_KEY)||"{}")}}catch(e){}

  function studentMode(){
    const v=localStorage.getItem(MODE_KEY);
    return v===null?true:v!=="0";
  }
  function setStudentMode(v){
    localStorage.setItem(MODE_KEY,v?"1":"0");
    applyMode();
    if(v)window.KitsuneAppKernel?.route?.("home");
  }
  function esc(s){
    return String(s??"").replace(/[&<>"']/g,c=>({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
    }[c]));
  }
  function applyA11y(){
    document.body.classList.toggle("a8-large-text",!!a11y.largeText);
    document.body.classList.toggle("a8-high-contrast",!!a11y.highContrast);
    document.body.classList.toggle("a8-reduced-motion",!!a11y.reducedMotion);
    try{localStorage.setItem(A11Y_KEY,JSON.stringify(a11y))}catch(e){}
  }
  function applyMode(){
    const student=studentMode();
    document.body.classList.toggle("kitsune-student-mode",student);
    document.body.classList.toggle("kitsune-adult-mode",!student);

    const adultViews=["trainer","offline","chapterfinal","mastery","mistakes","progress"];
    document.querySelectorAll(".main-nav .nav-btn").forEach(b=>{
      const v=b.dataset.view;
      b.classList.toggle("student-hidden",student&&adultViews.includes(v));
    });
    ["assistantModeBtn","designBtn","effectsBtn","privacyBtn","updateBtn","resetBtn"].forEach(id=>{
      document.querySelector(`#${id}`)?.classList.toggle("student-hidden",student);
    });
    document.querySelector('[data-ki-tab="parent"]')?.classList.toggle("student-hidden",student);

    ensureAdultButton();
  }
  function ensureAdultButton(){
    const footer=document.querySelector(".sidebar-footer");if(!footer)return;
    let b=document.querySelector("#adultCenterBtn");
    if(!b){
      b=document.createElement("button");
      b.id="adultCenterBtn";b.className="ghost adult-center-btn";
      b.textContent="👨‍👩‍👧 Для взрослых";
      b.addEventListener("click",()=>{
        if(studentMode()){
          if(!confirm("Открыть раздел для взрослых? Здесь находятся отчёты, диагностика и технические настройки."))return;
        }
        renderAdult();
      });
      footer.appendChild(b);
    }
  }

  function lastLessonId(){
    try{return localStorage.getItem("a8_lastLesson")||""}catch(e){return ""}
  }
  function studentDashboard(){
    const mastery=window.KitsuneMastery?.summary?.()||{practiced:0,mastered:0,average:0,total:51};
    const due=window.KitsuneLearning?.dueReviews?.()?.length||0;
    const hw=window.KitsuneMathLab?.homework?.()||[];
    const pending=hw.filter(x=>!x.done).length;
    const last=lastLessonId();
    return `
      <section class="sx-dashboard glass-panel reveal">
        <div class="sx-welcome">
          <span class="eyebrow">Kitsune · простой режим</span>
          <h2>Что будем делать сегодня?</h2>
          <p>${due?`У тебя ${due} ${due===1?"тема":"темы"} для короткого повторения.`:"Kitsune готова продолжить с того места, где ты остановилась."}</p>
        </div>
        <div class="sx-actions">
          <button class="sx-main primary glow-btn" id="sxContinue">▶ ${last?"Продолжить урок":"Начать курс"}</button>
          <button class="sx-action" data-view="route"><span>✨</span><b>Занятие с Kitsune</b><small>сама подберёт задания</small></button>
          <button class="sx-action" data-view="mathlab"><span>📚</span><b>Домашнее задание</b><small>${pending?`${pending} ещё не выполнено`:"Math Lab и ДЗ"}</small></button>
          <button class="sx-action" id="sxAsk"><span>🦊</span><b>Спросить Kitsune</b><small>текстом или голосом</small></button>
          <button class="sx-action" id="sxCamera"><span>📷</span><b>Из учебника</b><small>сфотографировать задания</small></button>
          <button class="sx-action" data-view="search"><span>🔎</span><b>Найти тему</b><small>правило или урок</small></button>
        </div>
        <div class="sx-mastery">
          <div class="sx-ring" style="--sx-score:${mastery.average||0}"><b>${mastery.average||0}</b><span>Mastery</span></div>
          <div><b>${mastery.mastered||0} тем закреплено</b><small>${mastery.practiced||0} из ${mastery.total||51} уже тренировались. Оценка растёт с практикой, повторением и уверенностью.</small></div>
        </div>
      </section>`;
  }

  function injectStudentHome(){
    if(!studentMode())return;
    const content=document.querySelector("#content");if(!content||content.querySelector(".sx-dashboard"))return;
    content.insertAdjacentHTML("afterbegin",studentDashboard());
    const last=lastLessonId();
    document.querySelector("#sxContinue")?.addEventListener("click",()=>{
      if(last&&window.openLesson)window.openLesson(last);
      else window.KitsuneAppKernel?.route?.("course");
    });
    document.querySelector("#sxAsk")?.addEventListener("click",()=>window.KitsuneVoiceDialogue?.open?.(null));
    document.querySelector("#sxCamera")?.addEventListener("click",()=>window.KitsuneCameraImport?.open?.());
  }

  const baseHome=window.renderHome;
  if(typeof baseHome==="function"){
    window.renderHome=function(...args){
      const out=baseHome.apply(this,args);
      applyMode();
      setTimeout(injectStudentHome,0);
      return out;
    };
  }

  function masteryRows(){
    const s=window.KitsuneMastery?.summary?.();
    if(!s)return `<div class="ml-empty">Mastery Score пока недоступен.</div>`;
    const byChapter={};
    for(const row of s.rows)(byChapter[row.chapter]??=[]).push(row);
    return Object.entries(byChapter).map(([ch,rows])=>`
      <section class="sx-master-ch">
        <h4>Глава ${ch}. ${esc(rows[0]?.chapterTitle||"")}</h4>
        ${rows.map(r=>`<div class="sx-master-row">
          <div><b>§ ${esc(r.id)} · ${esc(r.title)}</b><small>${r.label} · попыток: ${r.attempts}${r.accuracy===null?"":` · точность ${r.accuracy}%`}</small></div>
          <div class="sx-scorebar"><i><em style="width:${r.score}%"></em></i><strong>${r.score}</strong></div>
        </div>`).join("")}
      </section>`).join("");
  }

  function adultOverview(){
    const p=window.KitsuneLearning?.parentSummary?.()||{};
    const m=window.KitsuneMastery?.summary?.()||{};
    const weak=window.KitsuneMastery?.weakest?.(5)||[];
    return `
      <div class="sx-adult-grid">
        <section class="sx-adult-card">
          <span class="eyebrow">Родительская сводка</span><h3>Как идёт обучение</h3>
          <div class="sx-stat-grid">
            <div><b>${m.mastered||0}</b><span>тем закреплено</span></div>
            <div><b>${m.average||0}</b><span>средний Mastery</span></div>
            <div><b>${p.totalAttempts||0}</b><span>проверенных ответов</span></div>
            <div><b>${p.accuracy==null?"—":p.accuracy+"%"}</b><span>точность</span></div>
          </div>
          <h4>Приоритет на повторение</h4>
          <div class="sx-weak-list">${weak.length?weak.map(x=>`<span>${esc(x.title)} · ${x.score}</span>`).join(""):"<span>Пока мало данных</span>"}</div>
        </section>
        <section class="sx-adult-card">
          <span class="eyebrow">Режим интерфейса</span><h3>Что видит ребёнок</h3>
          <label class="sx-switch"><input type="checkbox" id="sxStudentMode" ${studentMode()?"checked":""}><span><b>Простой детский режим</b><small>скрывает технические и взрослые разделы, но не ограничивает учебные возможности</small></span></label>
          <p>Это не пароль и не средство родительского контроля — только упрощённый интерфейс.</p>
          <div class="ml-actions">
            <button class="secondary" id="sxPrivacy">🔒 Приватность</button>
            <button class="secondary" data-view="offline">📴 Офлайн и AI</button>
          </div>
        </section>
      </div>`;
  }

  function adultAccessibility(){
    return `
      <section class="sx-adult-card">
        <span class="eyebrow">Accessibility</span><h3>Доступность и комфорт</h3>
        <label class="sx-switch"><input type="checkbox" data-sx-a11y="largeText" ${a11y.largeText?"checked":""}><span><b>Крупный текст</b><small>увеличивает основные размеры без изменения содержания</small></span></label>
        <label class="sx-switch"><input type="checkbox" data-sx-a11y="highContrast" ${a11y.highContrast?"checked":""}><span><b>Повышенный контраст</b><small>усиливает границы, текст и элементы управления</small></span></label>
        <label class="sx-switch"><input type="checkbox" data-sx-a11y="reducedMotion" ${a11y.reducedMotion?"checked":""}><span><b>Минимум анимаций</b><small>отключает декоративное движение и плавные эффекты</small></span></label>
        <p>Системная настройка <code>prefers-reduced-motion</code> также продолжает учитываться браузером.</p>
      </section>`;
  }

  function adultReliability(){
    const safe=window.KitsuneReliability?.isSafe?.();
    return `
      <div class="sx-adult-grid">
        <section class="sx-adult-card">
          <span class="eyebrow">Safe Mode</span><h3>Безопасный режим запуска</h3>
          <p>В Safe Mode используются Smart Tutor и системный голос, автоматическая загрузка тяжёлых AI-модулей отключается. Прогресс и модели не удаляются.</p>
          <button class="${safe?"secondary":"primary"}" id="sxSafe">${safe?"Выключить Safe Mode":"Включить Safe Mode"}</button>
        </section>
        <section class="sx-adult-card">
          <span class="eyebrow">Recovery</span><h3>Восстановление без потери данных</h3>
          <div class="ml-actions">
            <button class="secondary" id="sxReleaseRam">🧹 Освободить RAM</button>
            <button class="secondary" id="sxRepair">🛟 Восстановить app shell</button>
          </div>
          <p>Восстановление app shell удаляет только кэш файлов текущих релизов. Homework, прогресс, OPFS и AI-модели не удаляются.</p>
        </section>
      </div>
      <section class="sx-adult-card sx-selftest">
        <div class="ml-panel-head"><div><span class="eyebrow">Production Self-Test</span><h3>Проверка системы</h3></div><button class="primary" id="sxRunTests">▶ Запустить</button></div>
        <div id="sxTestSummary" class="sx-test-summary">Проверки ещё не запускались.</div>
        <div id="sxTestRows"></div>
      </section>`;
  }

  function adultContent(){
    return adultTab==="mastery"?`<section class="sx-adult-card"><span class="eyebrow">Mastery 51</span><h3>Уровень владения каждой темой</h3>${masteryRows()}</section>`:
      adultTab==="accessibility"?adultAccessibility():
      adultTab==="reliability"?adultReliability():adultOverview();
  }

  function renderAdult(){
    const content=document.querySelector("#content");if(!content)return;
    document.querySelector("#pageTitle").textContent="Для взрослых";
    document.querySelectorAll(".nav-btn").forEach(b=>b.classList.remove("active"));
    content.innerHTML=`
      <section class="sx-adult-hero glass-panel reveal">
        <div><span class="eyebrow">Adult Center · v${VERSION}</span><h2>👨‍👩‍👧 Для взрослых</h2>
        <p>Отчёты, доступность, диагностика и восстановление. Ребёнку эти настройки для обычного обучения не нужны.</p></div>
        <button class="secondary" id="sxBackStudent">← Вернуться к обучению</button>
      </section>
      <section class="sx-adult-shell glass-panel">
        <div class="sx-adult-tabs">
          <button data-sx-tab="overview" class="${adultTab==="overview"?"active":""}">Обзор</button>
          <button data-sx-tab="mastery" class="${adultTab==="mastery"?"active":""}">Mastery 51</button>
          <button data-sx-tab="accessibility" class="${adultTab==="accessibility"?"active":""}">Доступность</button>
          <button data-sx-tab="reliability" class="${adultTab==="reliability"?"active":""}">Диагностика</button>
        </div>
        <div id="sxAdultBody">${adultContent()}</div>
      </section>`;
    bindAdult();
    try{window.scrollTo({top:0,behavior:"smooth"})}catch(e){}
  }

  function bindAdult(){
    document.querySelector("#sxBackStudent")?.addEventListener("click",()=>window.KitsuneAppKernel?.route?.("home"));
    document.querySelectorAll("[data-sx-tab]").forEach(b=>b.addEventListener("click",()=>{
      adultTab=b.dataset.sxTab;renderAdult();
    }));
    document.querySelector("#sxStudentMode")?.addEventListener("change",e=>setStudentMode(!!e.target.checked));
    document.querySelector("#sxPrivacy")?.addEventListener("click",()=>document.querySelector("#privacyBtn")?.click());
    document.querySelectorAll("[data-sx-a11y]").forEach(input=>input.addEventListener("change",()=>{
      a11y[input.dataset.sxA11y]=!!input.checked;applyA11y();
    }));
    document.querySelector("#sxSafe")?.addEventListener("click",()=>window.KitsuneReliability?.setSafe?.(!window.KitsuneReliability.isSafe()));
    document.querySelector("#sxReleaseRam")?.addEventListener("click",async()=>{
      const b=document.querySelector("#sxReleaseRam");b.disabled=true;b.textContent="Освобождаю…";
      await window.KitsuneReliability?.releaseRam?.();b.textContent="✅ RAM освобождена";
    });
    document.querySelector("#sxRepair")?.addEventListener("click",async()=>{
      try{await window.KitsuneReliability?.repairAppShell?.()}catch(e){alert(String(e?.message||e))}
    });
    document.querySelector("#sxRunTests")?.addEventListener("click",runTests);
  }

  async function runTests(){
    const btn=document.querySelector("#sxRunTests"),sum=document.querySelector("#sxTestSummary"),host=document.querySelector("#sxTestRows");
    if(!window.KitsuneReliability?.selfTest)return;
    btn.disabled=true;host.innerHTML="";sum.textContent="Запускаю проверки…";
    const result=await window.KitsuneReliability.selfTest(p=>{
      sum.textContent=`Проверка ${Math.min(p.index+1,p.total)} из ${p.total}: ${p.title}`;
      if(p.status!=="running"){
        const row=document.createElement("div");
        row.className=`sx-test-row ${p.status}`;
        row.innerHTML=`<span>${p.status==="pass"?"✓":p.status==="warn"?"!":"×"}</span><div><b>${esc(p.title)}</b><small>${esc(p.detail||"")}</small></div><em>${p.ms||0} ms</em>`;
        host.appendChild(row);
      }
    });
    sum.innerHTML=`<b>${result.pass}/${result.total} успешно</b> · предупреждений ${result.warn} · ошибок ${result.fail}`;
    sum.className=`sx-test-summary ${result.fail?"fail":result.warn?"warn":"pass"}`;
    btn.disabled=false;btn.textContent="↻ Повторить";
  }

  function routeAdult(){
    if(studentMode()){
      if(!confirm("Открыть раздел для взрослых?"))return;
    }
    renderAdult();
  }

  applyA11y();
  applyMode();
  ensureAdultButton();
  setTimeout(injectStudentHome,0);

  const observer=new MutationObserver(()=>{
    applyMode();
    if(studentMode()&&document.querySelector("#pageTitle")?.textContent==="Алгебра 8")injectStudentHome();
  });
  observer.observe(document.documentElement,{subtree:true,childList:true});

  window.KitsuneStudentExperience={
    version:VERSION,
    isStudent:studentMode,
    setStudent:setStudentMode,
    renderAdult,
    routeAdult,
    accessibility:()=>({...a11y})
  };
})();
