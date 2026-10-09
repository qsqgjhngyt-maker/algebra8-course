(() => {
  "use strict";
  const VERSION="3.1.0-rc.6";
  const data=window.KitsuneCurriculumSources||{sources:[]};
  const AUTO_KEY="kitsune:v3:curriculum:auto-check";
  const LOCAL_STATUS_KEY="kitsune:v3:curriculum:last-status";
  const ATTEMPT_KEY="kitsune:v3:curriculum:last-report-attempt";
  const REPORT_URL="https://raw.githubusercontent.com/qsqgjhngyt-maker/algebra8-course/kitsune-curriculum-status/curriculum-status.json";
  const CHECK_INTERVAL=24*60*60*1000;
  let inFlight=null,notice="",remembered=null,lastAttempt=0;

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
  function readLocal(){try{const status=JSON.parse(localStorage.getItem(LOCAL_STATUS_KEY)||"null");return reportValid(status)&&status.checkedAt?status:remembered}catch{return remembered}}
  function saveLocal(s){remembered=s;try{localStorage.setItem(LOCAL_STATUS_KEY,JSON.stringify(s))}catch{}}
  function autoEnabled(){try{const v=localStorage.getItem(AUTO_KEY);return v===null?true:v==="1"}catch{return true}}
  function setAuto(v){try{localStorage.setItem(AUTO_KEY,v?"1":"0")}catch{}}
  function autoDue(){let last=lastAttempt;try{last=Number(localStorage.getItem(ATTEMPT_KEY)||lastAttempt)}catch{}
    const age=Date.now()-last;return !Number.isFinite(last)||!last||age<0||age>=CHECK_INTERVAL}
  function markAttempt(){lastAttempt=Date.now();try{localStorage.setItem(ATTEMPT_KEY,String(lastAttempt))}catch{}}
  function localApiAvailable(){
    const host=location.hostname;
    return /^https?:$/.test(location.protocol)&&
      (host==="localhost"||host==="127.0.0.1"||host==="[::1]"||/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host));
  }
  function reportValid(status){
    if(status?.schema!==1||!status.sources||typeof status.sources!=="object"||Array.isArray(status.sources))return false;
    const ids=data.sources.map(s=>s.id),records=Object.entries(status.sources);
    if(!status.checkedAt)return status.mode==="pending-runtime-check"&&records.length===0;
    if(!Number.isFinite(Date.parse(status.checkedAt))||Date.parse(status.checkedAt)>Date.now()+5*60*1000)return false;
    if(records.length!==ids.length||records.some(([id,s])=>!ids.includes(id)||typeof s?.ok!=="boolean"))return false;
    const successes=records.filter(([,s])=>s.ok).length;
    return status.totalCount===ids.length&&status.successCount===successes&&
      Number.isInteger(status.changedCount)&&status.changedCount>=0&&status.changedCount<=ids.length;
  }
  function stateMessage(status){
    if(!status?.checkedAt)return "Проверка официальных источников ещё не выполнена. Пока можно открыть их по ссылкам ниже.";
    const success=Number(status.successCount||0),total=Number(status.totalCount||data.sources.length);
    const review=Number(status.reviewRequiredCount??status.changedCount??0);
    let text=review?`⚠ Изменились контрольные сигналы страниц: ${review}. Нужна содержательная сверка курса.`:
      (success===total?"✓ Официальные источники доступны.":`🟡 Доступно ${success} из ${total} источников. Остальные временно не ответили — курс продолжает работать.`);
    if(review&&success<total)text+=` Сейчас доступно ${success} из ${total} источников.`;
    if(success===total&&!review&&status.comparableCount===total)text+=" Новых изменений по контрольным сигналам не обнаружено.";
    if(Date.now()-Date.parse(status.checkedAt)>2*CHECK_INTERVAL)text+=" Отчёт старше двух суток; более свежая проверка ещё не получена.";
    return text;
  }

  function sourceCard(s,status){
    const chips=(s.appliesTo||[]).map(x=>`<span>${esc(x)}</span>`).join("");
    const live=status?.sources?.[s.id];
    let liveHtml="";
    if(live){
      if(live.ok){
        const review=live.reviewRequired??live.changedSincePreviousSuccessfulCheck;
        liveHtml=`<div class="source-live ${review?"changed":"ok"}">${review?"⚠ Контрольные сигналы страницы изменились; нужна сверка":"✓ Источник был доступен на дату отчёта"}</div>`;
      }else{
        liveHtml=`<div class="source-live warn">🟡 Источник временно не ответил. Это не влияет на работу курса.<small>${esc(live.error||"нет ответа")}</small></div>`;
        if(live.reviewRequired)liveHtml+='<div class="source-live changed">⚠ Ранее отмечены изменения страницы; нужна сверка.</div>';
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
    const state=notice||stateMessage(status);
    return `<div class="source-update-center">
      <div class="source-update-head"><div><span class="eyebrow">Центр актуальности</span><h3>Актуальность программы и нормативной базы</h3></div>
      <button type="button" class="source-refresh-btn" id="curriculumRefreshBtn">🔄 Обновить результаты</button></div>
      <div class="source-update-dates">
        <div><span>Последняя проверка официальных источников</span><b>${esc(ruDate(checked))}</b></div>
        <div><span>Курс сверён с нормативной базой</span><b>${esc(ruDate(data.courseVerifiedAt||data.baselineCheckedAt,false))}</b></div>
      </div>
      <div class="source-update-state" id="curriculumUpdateState" role="status" aria-live="polite">${esc(state)}</div>
      <label class="source-auto-check"><input type="checkbox" id="curriculumAutoCheck" ${autoEnabled()?"checked":""}>
        <span><b>Обновлять результаты при запуске</b><small>Не чаще одного раза в 24 часа. AI и голос для этого не загружаются.</small></span>
      </label>
      <p class="source-update-note">Официальные страницы проверяются ежедневно на сервере проекта. Кнопка получает последний опубликованный отчёт. Дата сверки курса меняется только после содержательной проверки; уроки автоматически не переписываются.</p>
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

  function render(status=readLocal(),{keepPosition=false}={}){
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
    if(!keepPosition)window.scrollTo(0,0);return true;
  }

  async function getReport(url){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
    try{
      const r=await fetch(url,{cache:"no-store",credentials:"omit",headers:{"Accept":"application/json"},signal:controller.signal});
      if(!r.ok)throw new Error(`HTTP ${r.status}`);
      const status=await r.json();if(!reportValid(status))throw new Error("Некорректный отчёт");
      return status;
    }finally{clearTimeout(timer)}
  }
  async function fetchStatus(force=false,{silent=false}={}){
    const btn=document.querySelector("#curriculumRefreshBtn"),state=document.querySelector("#curriculumUpdateState");
    if(btn){btn.disabled=true;btn.textContent="⏳ Получаю результаты…"}
    if(state&&!silent)state.textContent="Получаю последний отчёт о проверке официальных источников…";
    if(inFlight)return inFlight;
    if(navigator.onLine===false){
      notice="Сейчас нет сети. Сохранённая дата проверки не изменена; официальные ссылки доступны ниже.";
      if(document.querySelector(".source-update-center"))render(readLocal(),{keepPosition:true});
      return readLocal();
    }
    markAttempt();notice="";
    inFlight=(async()=>{
      let status=readLocal(),received=false,feedAvailable=false;
      const urls=[];
      if(localApiAvailable())urls.push(`/api/curriculum-status?force=${force?1:0}`);
      urls.push(REPORT_URL+"?report="+Date.now());
      urls.push(new URL("./curriculum-status.json",document.baseURI).href+"?report="+Date.now());
      for(const url of urls){
        try{
          const report=await getReport(url);feedAvailable=true;
          if(!report.checkedAt)continue;
          // Старый bundled-отчёт не заменяет более свежие сохранённые результаты.
          if(!status?.checkedAt||Date.parse(report.checkedAt)>=Date.parse(status.checkedAt))status=report;
          received=true;break;
        }catch{}
      }
      if(received){saveLocal(status);notice=""}
      else if(feedAvailable&&!status?.checkedAt)notice=stateMessage(null);
      else notice="Не удалось получить свежие результаты. Сохранённая дата проверки не изменена; можно открыть официальные источники по ссылкам ниже.";
      return status;
    })();
    try{return await inFlight}finally{
      inFlight=null;
      if(document.querySelector(".source-update-center"))render(readLocal(),{keepPosition:true});
      else if(btn?.isConnected){btn.disabled=false;btn.textContent="🔄 Обновить результаты"}
    }
  }
  function checkAutomatically(){if(autoEnabled()&&autoDue())return fetchStatus(false,{silent:true})}

  function bind(){
    document.querySelector("#curriculumRefreshBtn")?.addEventListener("click",()=>fetchStatus(true));
    document.querySelector("#curriculumAutoCheck")?.addEventListener("change",e=>{setAuto(!!e.target.checked);if(e.target.checked)checkAutomatically()});
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
  function startup(){if(autoEnabled())setTimeout(checkAutomatically,1400)}

  document.addEventListener("click",e=>{
    const btn=e.target.closest?.('#curriculumSourcesBtn,.platform-source-link,[data-view="sources"]');if(!btn)return;
    e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();render();checkAutomatically();
  },true);
  window.addEventListener("online",checkAutomatically);

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>{install();startup()},{once:true});else{install();startup()}
  setTimeout(install,120);
  window.KitsuneCurriculumSourceUI={version:VERSION,render,install,checkNow:()=>fetchStatus(true),checkCached:()=>fetchStatus(false)};
})();
