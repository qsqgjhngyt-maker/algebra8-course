(() => {
  "use strict";
  const VERSION="3.1.0-alpha.6-WORK";
  const data=window.KitsuneCurriculumSources||{sources:[]};
  const AUTO_KEY="kitsune:v3:curriculum:auto-check";
  const LOCAL_STATUS_KEY="kitsune:v3:curriculum:last-status";

  function esc(v){return String(v??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]))}
  function closeSidebar(){try{document.querySelector("#sidebar")?.classList.remove("open");document.body.classList.remove("sidebar-mobile-open")}catch{}}
  function ruDate(v,withTime=true){
    if(!v)return "ещё не проверялась";
    try{
      const d=new Date(v);if(Number.isNaN(d.getTime()))return String(v);
      return new Intl.DateTimeFormat("ru-RU",withTime?
        {day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"}:
        {day:"2-digit",month:"2-digit",year:"numeric"}).format(d);
    }catch{return String(v)}
  }
  function readLocal(){try{return JSON.parse(localStorage.getItem(LOCAL_STATUS_KEY)||"null")}catch{return null}}
  function saveLocal(s){try{localStorage.setItem(LOCAL_STATUS_KEY,JSON.stringify(s))}catch{}}
  function autoEnabled(){const v=localStorage.getItem(AUTO_KEY);return v===null?true:v==="1"}
  function setAuto(v){try{localStorage.setItem(AUTO_KEY,v?"1":"0")}catch{}}

  function sourceCard(s,status){
    const chips=(s.appliesTo||[]).map(x=>`<span>${esc(x)}</span>`).join("");
    const live=status?.sources?.[s.id];
    let liveHtml="";
    if(live){
      if(live.ok){
        liveHtml=`<div class="source-live ${live.changedSincePreviousSuccessfulCheck?"changed":"ok"}">${live.changedSincePreviousSuccessfulCheck?"⚠ Источник изменился после прошлой проверки":"✓ Официальный источник доступен"}</div>`;
      }else{
        liveHtml=`<div class="source-live warn">🟡 Источник временно не ответил. Это не влияет на работу курса.<small>${esc(live.error||"нет ответа")}</small></div>`;
      }
    }
    return `<article class="source-card">
      <div class="source-card-top"><span class="source-badge">${s.kind==="exam"?"ФИПИ":"ФРП / ЕДСОО"}</span><span class="source-status">${esc(s.status)}</span></div>
      <h3>${esc(s.title)}</h3><p class="source-authority">${esc(s.authority)}</p><p>${esc(s.note)}</p>
      ${liveHtml}<div class="source-chip-row">${chips}</div>
      <a class="source-open" href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">Открыть официальный источник ↗</a>
    </article>`;
  }

  function statusPanel(status){
    const checked=status?.checkedAt;
    const success=Number(status?.successCount||0),total=Number(status?.totalCount||data.sources.length||0),changed=Number(status?.changedCount||0);
    let state="Ещё не выполнялась онлайн-проверка.";
    if(checked){
      if(success===total&&total>0&&!changed)state="✓ Все официальные источники доступны. Изменений по контрольным сигналам не обнаружено.";
      else if(success===total&&changed)state=`⚠ Обнаружены изменения: ${changed}. Курсы требуют повторной сверки.`;
      else state=`🟡 Проверено ${success} из ${total} источников. Остальные временно не ответили — это не влияет на работу курса.`;
    }
    return `<div class="source-update-center">
      <div class="source-update-head"><div><span class="eyebrow">Центр актуальности</span><h3>Актуальность программы и нормативной базы</h3></div>
      <button type="button" class="source-refresh-btn" id="curriculumRefreshBtn">🔄 Проверить актуальность</button></div>
      <div class="source-update-dates">
        <div><span>Нормативная база проверена</span><b>${esc(ruDate(checked))}</b></div>
        <div><span>Курс сверён с нормативной базой</span><b>${esc(ruDate(data.courseVerifiedAt||data.baselineCheckedAt,false))}</b></div>
      </div>
      <div class="source-update-state" id="curriculumUpdateState">${esc(state)}</div>
      <label class="source-auto-check"><input type="checkbox" id="curriculumAutoCheck" ${autoEnabled()?"checked":""}>
        <span><b>Автоматически проверять при запуске</b><small>Не чаще одного раза в 24 часа. AI/голос для этого не загружаются.</small></span>
      </label>
      <p class="source-update-note">Автопроверка обновляет только сведения об официальных источниках. Уроки не переписываются автоматически: при изменении источника курс помечается для повторной сверки.</p>
    </div>`;
  }

  function selectedTrackId(){
    try{return window.KitsunePlatform?.selected?.()||localStorage.getItem("kitsune_math_track_v300")||"grade8"}catch{return "grade8"}
  }

  function goBackToCourse(){
    if(window.KitsunePlatform?.goSelectedHome){
      return window.KitsunePlatform.goSelectedHome("sources-back");
    }
    const id=selectedTrackId();
    if(id==="grade8") return window.KitsuneNavigationStability?.home?.("sources-back");
    return window.KitsunePlatform?.renderTrack?.(id);
  }

  function goPlatformHome(){
    return window.KitsunePlatform?.showChooser?.();
  }

  function render(status=readLocal()){
    const content=document.querySelector("#content");if(!content)return false;
    closeSidebar();
    document.querySelectorAll(".nav-btn").forEach(b=>b.classList.remove("active"));
    document.querySelector("#curriculumSourcesBtn")?.classList.add("active");
    const title=document.querySelector("#pageTitle");if(title)title.textContent="Источники и нормативная база";
    const school=data.sources.filter(s=>s.kind==="school"),exam=data.sources.filter(s=>s.kind==="exam");
    content.innerHTML=`<div class="platform-backline source-nav-backline">
      <button class="secondary" id="curriculumSourcesBack">← Назад к курсу</button>
      <button class="ghost" id="curriculumSourcesHome">🏠 На главную платформы</button>
    </div><section class="platform-hero sources-hero reveal">
      <span class="eyebrow">Прозрачность программы · ${VERSION}</span><h2>📚 На чём основана программа Kitsune</h2>
      <p>Содержание курсов 7–11 классов и экзаменационных треков не составляется «из головы». Карты курсов сверяются с официальными федеральными рабочими программами и материалами ФИПИ.</p>
      <div class="source-trust-row"><span>✓ ФРП 7–11</span><span>✓ ОГЭ — ФИПИ</span><span>✓ ЕГЭ — ФИПИ</span></div>
      <div class="source-disclaimer">${esc(data.disclaimer)}</div></section>
      ${statusPanel(status)}
      <section class="platform-section"><div class="section-head"><div><span class="eyebrow">Школьная программа</span><h3>7–11 классы</h3></div></div><div class="source-grid">${school.map(s=>sourceCard(s,status)).join("")}</div></section>
      <section class="platform-section"><div class="section-head"><div><span class="eyebrow">Экзаменационные треки</span><h3>ОГЭ и ЕГЭ</h3></div></div><div class="source-grid">${exam.map(s=>sourceCard(s,status)).join("")}</div>
      <div class="source-project-note"><b>Важно.</b> Онлайн-проверка отслеживает доступность и изменение официальных страниц. Содержательную сверку курса после изменения выполняем отдельно.</div></section>
      <section class="platform-section"><div class="source-method"><h3>Как мы используем первоисточники</h3><ol>
      <li>Берём официальные содержательные линии и проверяем покрытие тем.</li><li>Объяснения переписываются понятным языком.</li>
      <li>Для ОГЭ/ЕГЭ отдельно сверяем кодификатор, спецификацию и демоверсию.</li><li>При изменении документов курс помечается для повторной проверки.</li>
      </ol></div></section>`;
    bind();
    window.scrollTo(0,0);return true;
  }

  async function fetchStatus(force=false,{silent=false}={}){
    const btn=document.querySelector("#curriculumRefreshBtn"),state=document.querySelector("#curriculumUpdateState"),old=btn?.textContent||"";
    if(btn&&!silent){btn.disabled=true;btn.textContent="⏳ Проверяю официальные источники…"}
    if(state&&!silent)state.textContent="Идёт проверка ЕДСОО и ФИПИ…";
    try{
      const r=await fetch(`/api/curriculum-status?force=${force?1:0}`,{cache:"no-store",headers:{"Accept":"application/json"}});
      if(!r.ok)throw new Error(`HTTP ${r.status}`);
      const status=await r.json();if(status?.checkedAt)saveLocal(status);
      if(document.querySelector("#curriculumSourcesBtn")?.classList.contains("active"))render(status);
      return status;
    }catch(error){
      if(!silent){
        const el=document.querySelector("#curriculumUpdateState");
        if(el)el.textContent="⚠ Автопроверка недоступна в этом режиме. Запустите проект через START_LAN.bat. Последняя сохранённая дата не изменена.";
      }
      return readLocal();
    }finally{
      if(btn&&btn.isConnected){btn.disabled=false;btn.textContent=old||"🔄 Проверить актуальность"}
    }
  }

  function bind(){
    document.querySelector("#curriculumRefreshBtn")?.addEventListener("click",()=>fetchStatus(true));
    document.querySelector("#curriculumAutoCheck")?.addEventListener("change",e=>{setAuto(!!e.target.checked);if(e.target.checked)fetchStatus(false,{silent:true})});
    document.querySelector("#curriculumSourcesBack")?.addEventListener("click",goBackToCourse);
    document.querySelector("#curriculumSourcesHome")?.addEventListener("click",goPlatformHome);
  }
  function install(){
    const nav=document.querySelector(".main-nav");
    if(nav&&!document.querySelector("#curriculumSourcesBtn")){
      const btn=document.createElement("button");btn.id="curriculumSourcesBtn";btn.type="button";
      btn.className="nav-btn curriculum-sources-nav";btn.dataset.view="sources";btn.textContent="📚 Источники и нормативная база";nav.appendChild(btn);
    }
  }
  function startup(){if(autoEnabled())setTimeout(()=>fetchStatus(false,{silent:true}),1400)}

  document.addEventListener("click",e=>{
    const btn=e.target.closest?.('#curriculumSourcesBtn,.platform-source-link,[data-view="sources"]');if(!btn)return;
    e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();render();
  },true);

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>{install();startup()},{once:true});else{install();startup()}
  setTimeout(install,120);
  window.KitsuneCurriculumSourceUI={version:VERSION,render,install,checkNow:()=>fetchStatus(true),checkCached:()=>fetchStatus(false)};
})();