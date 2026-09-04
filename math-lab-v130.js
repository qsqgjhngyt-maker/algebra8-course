
/* ================================================================
   Kitsune Math Lab v2.2.0
   Sandbox + homework + step verifier + generator + local skill map.
   ================================================================ */
(() => {
  "use strict";

  const VERSION=window.KITSUNE_APP_VERSION||"2.2.0";
  const HW_KEY="a8_mathlab_homework_v130";
  const SKILL_KEY="a8_mathlab_skills_v130";
  const HISTORY_KEY="a8_mathlab_history_v130";
  const BOARD_KEY="a8_mathlab_board_v200";

  let homework=[];
  let skills={};
  let history=[];
  let currentTab="solve";
  let lastResult=null;
  let currentGeneratedPack=null;
  let boardStrokes=[];
  let graphResizeObserver=null;

  try{
    homework=JSON.parse(localStorage.getItem(HW_KEY)||"[]");
    skills=JSON.parse(localStorage.getItem(SKILL_KEY)||"{}");
    history=JSON.parse(localStorage.getItem(HISTORY_KEY)||"[]");
    boardStrokes=JSON.parse(localStorage.getItem(BOARD_KEY)||"[]");
    if(!Array.isArray(homework))homework=[];
    if(!skills||typeof skills!=="object")skills={};
    if(!Array.isArray(history))history=[];
    if(!Array.isArray(boardStrokes))boardStrokes=[];
  }catch(e){}

  function save(){
    try{
      localStorage.setItem(HW_KEY,JSON.stringify(homework.slice(-100)));
      localStorage.setItem(SKILL_KEY,JSON.stringify(skills));
      localStorage.setItem(HISTORY_KEY,JSON.stringify(history.slice(-60)));
      localStorage.setItem(BOARD_KEY,JSON.stringify(boardStrokes.slice(-250)));
    }catch(e){}
  }

  function esc(s){
    return String(s??"").replace(/[&<>"']/g,c=>({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
    }[c]));
  }

  function skillName(type){
    return ({
      equation:"Уравнения",
      inequality:"Неравенства",
      system:"Системы",
      rational:"Рациональные дроби",
      sqrt:"Квадратные корни",
      expression:"Преобразования",
      function:"Функции",
      quadratic:"Квадратные уравнения",
      linear:"Линейные уравнения"
    })[type]||"Алгебра";
  }

  function courseTopics(){
    try{
      if(typeof chapters!=="undefined"&&Array.isArray(chapters)){
        return chapters.flatMap(ch=>ch.topics.map(t=>({
          id:t.id,title:t.title,chapter:ch.id,chapterTitle:ch.title
        })));
      }
    }catch(e){}
    return [];
  }

  function topicLabel(id){
    const t=courseTopics().find(x=>x.id===id);
    return t?`${t.id} · ${t.title}`:String(id||"");
  }

  function weakTopicIds(){
    return courseTopics()
      .map(t=>{
        const s=skills[`topic:${t.id}`]||{attempts:0,success:0};
        const score=s.attempts
          ?(s.success/s.attempts*100) - Math.min(18,s.attempts*1.5)
          :52;
        return {id:t.id,score};
      })
      .sort((a,b)=>a.score-b.score)
      .slice(0,14)
      .map(x=>x.id);
  }

  function touchSkill(result,good=true,topicId=null){
    const key=result?.kind==="quadratic"?"quadratic":result?.kind==="linear"&&result?.type==="equation"?"linear":result?.type||"expression";
    const row=skills[key]||{attempts:0,success:0,last:0};
    row.attempts++;
    if(good)row.success++;
    row.last=Date.now();
    skills[key]=row;

    if(topicId){
      const tkey=`topic:${topicId}`;
      const tr=skills[tkey]||{attempts:0,success:0,last:0};
      tr.attempts++;
      if(good)tr.success++;
      tr.last=Date.now();
      skills[tkey]=tr;
    }

    save();
    renderSkills();
  }

  function renderSkills(){
    const host=document.querySelector("#mathSkillMap");
    if(!host)return;
    const keys=["linear","quadratic","inequality","system","rational","sqrt","expression","function"];
    host.innerHTML=keys.map(k=>{
      const s=skills[k]||{attempts:0,success:0};
      const pct=s.attempts?Math.round(s.success/s.attempts*100):0;
      return `<div class="ml-skill">
        <div><span>${skillName(k)}</span><b>${s.attempts?pct+"%":"—"}</b></div>
        <i><em style="width:${pct}%"></em></i>
        <small>${s.attempts?`${s.success} успешных из ${s.attempts}`:"ещё нет данных"}</small>
      </div>`;
    }).join("");
  }

  function shell(){
    return `
      <section class="ml-hero glass-panel reveal">
        <div>
          <span class="eyebrow">Kitsune Math Lab · v${VERSION}</span>
          <h2>🧪 Песочница и домашнее задание</h2>
          <p>Вводи свой пример, решение по шагам или домашнюю работу. Сначала считает локальное математическое ядро, а Kitsune объясняет уже проверенный результат.</p>
        </div>
        <div class="ml-local-badge">🔒 локально · без сервера</div>
      </section>

      <div class="ml-layout">
        <section class="ml-main glass-panel">
          <div class="ml-tabs" role="tablist">
            <button data-ml-tab="solve" class="${currentTab==="solve"?"active":""}">🧮 Решить</button>
            <button data-ml-tab="steps" class="${currentTab==="steps"?"active":""}">✅ Проверить шаги</button>
            <button data-ml-tab="graph" class="${currentTab==="graph"?"active":""}">📈 График</button>
            <button data-ml-tab="board" class="${currentTab==="board"?"active":""}">✍️ Доска</button>
            <button data-ml-tab="homework" class="${currentTab==="homework"?"active":""}">📚 Домашнее задание</button>
            <button data-ml-tab="trainer" class="${currentTab==="trainer"?"active":""}">🎯 Генератор</button>
          </div>
          <div id="mathLabBody"></div>
        </section>

        <aside class="ml-side">
          <section class="glass-panel ml-side-card">
            <span class="eyebrow">Локальная карта навыков</span>
            <h3>Что уже получается</h3>
            <div id="mathSkillMap"></div>
          </section>
          <section class="glass-panel ml-side-card">
            <span class="eyebrow">Как устроено</span>
            <div class="ml-architecture">
              <span>✍️ ввод</span><b>→</b><span>⚙ Math Worker</span><b>→</b><span>✅ проверенный результат</span><b>→</b><span>🦊 Kitsune Brain</span>
            </div>
            <p>LLM не определяет математическую истину: она только объясняет результат локального вычислительного ядра.</p>
          </section>
        </aside>
      </div>`;
  }

  function solveTab(){
    return `
      <div class="ml-panel">
        <div class="ml-panel-head">
          <div><span class="eyebrow">Свободный ввод</span><h3>Спроси Kitsune или введи пример</h3></div>
          <button class="ml-small-btn" id="mlExampleBtn">✨ Пример</button>
        </div>
        <textarea id="mlInput" class="ml-textarea ml-big-input" rows="4" placeholder="Например:
3x² − 12x + 9 = 0
или (x² − 9)/(x − 3)
или √72"></textarea>
        <div class="ml-actions">
          <button class="primary glow-btn" id="mlSolveBtn">🧮 Рассчитать</button>
          <button class="secondary" id="mlHintBtn">🦊 Подсказка Kitsune</button>
          <button class="secondary" id="mlAddHwBtn">📚 Добавить в ДЗ</button>
        </div>
        <div id="mlResult" class="ml-result"></div>
        <div id="mlAiHint" class="ml-ai-box"></div>
      </div>
      ${history.length?`
      <div class="ml-history">
        <div class="ml-panel-head"><h3>Недавние расчёты</h3><button class="ml-small-btn" id="mlClearHistory">Очистить</button></div>
        ${history.slice().reverse().slice(0,8).map(h=>`
          <button class="ml-history-item" data-ml-history="${esc(h.input)}">
            <span>${esc(h.input)}</span><b>${esc(h.result||"")}</b>
          </button>`).join("")}
      </div>`:""}`;
  }

  function stepsTab(){
    return `
      <div class="ml-panel">
        <span class="eyebrow">Step Verifier</span>
        <h3>Вставь своё решение по строкам</h3>
        <p class="muted">Каждая строка — следующий шаг. Ядро проверит, сохранилось ли множество решений.</p>
        <textarea id="mlStepsInput" class="ml-textarea" rows="9" placeholder="-2x > 12
x > -6"></textarea>
        <div class="ml-actions">
          <button class="primary" id="mlCheckStepsBtn">✅ Проверить решение</button>
          <button class="secondary" id="mlStepsHintBtn">🦊 Объяснить ошибку</button>
        </div>
        <div id="mlStepsResult" class="ml-result"></div>
        <div id="mlStepsAi" class="ml-ai-box"></div>
      </div>`;
  }

  function graphTab(){
    return `
      <div class="ml-panel">
        <span class="eyebrow">Graph Engine</span>
        <h3>Построй функцию</h3>
        <div class="ml-inline">
          <input id="mlGraphInput" class="ml-input" value="y = 2/x" placeholder="y = 2/x">
          <button class="primary" id="mlGraphBtn">📈 Построить</button>
        </div>
        <div class="ml-graph-wrap"><canvas id="mlGraphCanvas"></canvas></div>
        <div id="mlGraphInfo" class="ml-result compact"></div>
      </div>`;
  }

  function boardTab(){
    return `
      <div class="ml-panel">
        <div class="ml-panel-head">
          <div><span class="eyebrow">Local Scratchpad</span><h3>✍️ Математическая доска</h3></div>
          <span class="status-chip">только на устройстве</span>
        </div>
        <p class="muted">Пиши пальцем, мышью или стилусом. Это локальный черновик без камеры и без отправки изображения наружу.</p>
        <div class="ml-board-toolbar">
          <button class="secondary" id="mlBoardUndo">↶ Отменить штрих</button>
          <button class="secondary" id="mlBoardClear">Очистить</button>
          <button class="secondary" id="mlBoardSave">⬇️ PNG</button>
        </div>
        <div class="ml-board-wrap"><canvas id="mlBoardCanvas"></canvas></div>
        <div class="ml-board-note">Черновик сохраняется локально как набор штрихов. Автораспознавание рукописных формул намеренно не включено: оно потребовало бы отдельной тяжёлой vision-модели и ухудшило бы стабильность мобильной офлайн-сборки.</div>
      </div>`;
  }

  function homeworkTab(){
    return `
      <div class="ml-panel">
        <div class="ml-panel-head">
          <div><span class="eyebrow">Homework Studio</span><h3>Моё домашнее задание</h3></div>
          <span class="status-chip">${homework.filter(x=>x.done).length}/${homework.length} готово</span>
        </div>
        <div class="ml-homework-add">
          <textarea id="mlHwNew" class="ml-textarea" rows="4" placeholder="Вставь одно или несколько заданий — каждое с новой строки"></textarea>
          <button class="primary" id="mlHwAddBtn">＋ Добавить задания</button>
        </div>
        <div id="mlHomeworkList" class="ml-homework-list">
          ${homework.length?homework.map(hwCard).join(""):`
            <div class="ml-empty">📚 Пока пусто. Можно добавить задания вручную или отправить пример сюда из песочницы.</div>`}
        </div>
      </div>`;
  }

  function hwCard(h){
    const gen=h.generated||null;
    return `<article class="ml-hw-card ${h.done?"done":""}" data-hw-id="${h.id}">
      <div class="ml-hw-top">
        <button class="ml-check" data-hw-action="done" title="Готово">${h.done?"✓":"○"}</button>
        <div>
          ${gen?`<span class="ml-hw-topic">§ ${esc(gen.topicId)} · ${esc(gen.topicTitle)}</span>`:""}
          <b>${esc(h.task)}</b>
          <small>${new Date(h.created).toLocaleDateString("ru-RU")}${gen?` · ${"●".repeat(gen.difficulty||1)}`:""}</small>
        </div>
        <button class="ml-icon" data-hw-action="delete" title="Удалить">×</button>
      </div>
      <textarea class="ml-hw-work" rows="3" placeholder="${gen?"Мой ответ / решение…":"Моё решение / промежуточные шаги…"}">${esc(h.work||"")}</textarea>
      <div class="ml-hw-actions">
        <button data-hw-action="solve">🧮 ${gen?"Показать разбор":"Проверить задачу"}</button>
        <button data-hw-action="steps">✅ ${gen?"Проверить ответ":"Проверить мои шаги"}</button>
        <button data-hw-action="hint">🦊 Подсказка</button>
      </div>
      <div class="ml-hw-result"></div>
    </article>`;
  }

  function trainerTab(){
    const topics=courseTopics();
    const chapterOptions=(()=>{
      try{
        if(typeof chapters!=="undefined"){
          return chapters.map(ch=>`<option value="${ch.id}">Глава ${ch.id}. ${esc(ch.title)}</option>`).join("");
        }
      }catch(e){}
      return "";
    })();
    const topicOptions=topics.map(t=>`<option value="${t.id}">${esc(t.id)} · ${esc(t.title)}</option>`).join("");

    return `
      <div class="ml-panel ml-gen2">
        <div class="ml-panel-head">
          <div>
            <span class="eyebrow">Generator 2.0 · 51/51 тем</span>
            <h3>Умный генератор по всему курсу</h3>
          </div>
          <span class="status-chip">51 тема · 6 глав</span>
        </div>

        <div class="ml-gen-mode-grid">
          <label>Режим
            <select id="mlGenMode">
              <option value="topic">🎯 Конкретная тема</option>
              <option value="chapter">📚 По главе</option>
              <option value="all">🌐 Весь курс</option>
              <option value="adaptive">🧠 Адаптивный</option>
              <option value="control">📝 Контрольная</option>
              <option value="homework">🏠 Подборка ДЗ</option>
              <option value="marathon">🏆 Марафон 51</option>
            </select>
          </label>

          <label id="mlGenChapterWrap">Глава
            <select id="mlGenChapter">
              <option value="0">Все главы</option>
              ${chapterOptions}
            </select>
          </label>

          <label id="mlGenTopicWrap">Тема
            <select id="mlGenTopicId">${topicOptions}</select>
          </label>

          <label>Сложность
            <select id="mlGenDifficulty">
              <option value="1">🌱 Легко</option>
              <option value="2" selected>📘 Нормально</option>
              <option value="3">🧠 Сложно</option>
            </select>
          </label>

          <label id="mlGenCountWrap">Количество
            <select id="mlGenCount">
              <option value="1" selected>1 задание</option>
              <option value="5">5 заданий</option>
              <option value="8">8 заданий</option>
              <option value="10">10 заданий</option>
              <option value="12">12 заданий</option>
              <option value="20">20 заданий</option>
            </select>
          </label>

          <button class="primary glow-btn" id="mlGenerateBtn">✨ Создать набор</button>
        </div>

        <div id="mlGenModeNote" class="ml-gen-note"></div>

        <div id="mlGenerated" class="ml-generated">
          <div class="ml-empty">
            🎯 Выбери режим. Можно взять любую из 51 темы, собрать контрольную,
            адаптивный набор или настоящий марафон по всему курсу.
          </div>
        </div>
      </div>`;
  }

  function renderTab(){
    const body=document.querySelector("#mathLabBody");
    if(!body)return;
    body.innerHTML=currentTab==="steps"?stepsTab():
      currentTab==="graph"?graphTab():
      currentTab==="board"?boardTab():
      currentTab==="homework"?homeworkTab():
      currentTab==="trainer"?trainerTab():solveTab();
    bindTab();
    if(currentTab==="board")setTimeout(initBoard,0);
  }

  function resultHtml(r,{hideFinal=false}={}){
    if(!r)return "";
    const steps=Array.isArray(r.steps)?r.steps:[];
    const headline=hideFinal?"Проверенный разбор":esc(r.display||"Готово");
    return `<div class="ml-result-card">
      <div class="ml-result-head"><span>✅ Math Engine</span><b>${headline}</b></div>
      ${r.domain?`<div class="ml-domain">${esc(r.domain)}</div>`:""}
      ${steps.length?`<ol>${steps.map((s,i)=>`<li class="${hideFinal&&i===steps.length-1?"ml-hidden-final":""}">${hideFinal&&i===steps.length-1?"Следующий шаг оставлю тебе 🙂":esc(s)}</li>`).join("")}</ol>`:""}
      <small>Расчёт выполнен локально в Math Worker.</small>
    </div>`;
  }

  async function solveInput({hint=false}={}){
    const input=document.querySelector("#mlInput")?.value.trim();
    const out=document.querySelector("#mlResult");
    const ai=document.querySelector("#mlAiHint");
    if(!input)return;
    out.innerHTML=`<div class="ml-loading">⚙ Math Worker считает…</div>`;
    if(ai)ai.innerHTML="";
    try{
      const r=await window.KitsuneMath.analyze(input);
      lastResult=r;
      out.innerHTML=resultHtml(r,{hideFinal:hint});
      history.push({input,result:r.display||"",ts:Date.now()});history=history.slice(-60);save();
      touchSkill(r,true);
      if(hint)await askAi(input,r,ai,{hintOnly:true});
    }catch(err){
      out.innerHTML=`<div class="ml-error">⚠ ${esc(err.message||err)}</div>`;
    }
  }

  async function askAi(input,result,host,{hintOnly=false,steps=false}={}){
    if(!host)return;
    host.innerHTML=`<div class="ml-loading">🦊 Kitsune формулирует объяснение…</div>`;
    try{
      if(window.KitsuneBrain?.explainMath){
        const text=await window.KitsuneBrain.explainMath(input,result,{hintOnly,steps});
        host.innerHTML=`<div class="ml-ai-message"><span>🦊</span><p>${esc(text)}</p></div>`;
      }else{
        const safe=hintOnly
          ?(result?.steps?.[0]||"Определи тип задачи и выполни первый допустимый шаг.")
          :(result?.steps||[]).join(" → ");
        host.innerHTML=`<div class="ml-ai-message"><span>🦊</span><p>${esc(safe)}</p></div>`;
      }
    }catch(err){
      host.innerHTML=`<div class="ml-error">Kitsune сейчас не смогла сформулировать подсказку.</div>`;
    }
  }

  async function verifySteps(){
    const input=document.querySelector("#mlStepsInput")?.value.trim();
    const out=document.querySelector("#mlStepsResult");
    if(!input)return;
    out.innerHTML=`<div class="ml-loading">⚙ Проверяю переходы…</div>`;
    try{
      const r=await window.KitsuneMath.verifySteps(input);
      lastResult=r;
      out.innerHTML=`<div class="ml-step-report ${r.ok?"good":"warn"}">
        <div class="ml-result-head"><span>${r.ok?"✅":"⚠️"} Step Verifier</span><b>${r.ok?"Все проверенные переходы эквивалентны":"Нашлась ошибка"}</b></div>
        ${r.rows.map((row,i)=>`<div class="ml-step-row ${row.ok?"ok":"bad"}">
          <span>${row.ok?"✓":"!"}</span><div><b>${esc(row.line)}</b><small>${esc(row.message)}</small></div>
        </div>`).join("")}
      </div>`;
      touchSkill({type:"expression"},r.ok);
      window.KitsuneLearning?.recordStepResult?.(input,r,(typeof state!=="undefined"?state.lastLesson:""));
    }catch(err){
      out.innerHTML=`<div class="ml-error">⚠ ${esc(err.message||err)}</div>`;
    }
  }

  function addHomeworkTasks(text){
    const rows=String(text).split(/\n/).map(x=>x.trim()).filter(Boolean);
    for(const task of rows){
      homework.push({id:"hw_"+Date.now()+"_"+Math.random().toString(36).slice(2,7),task,work:"",done:false,created:Date.now()});
    }
    homework=homework.slice(-100);save();
  }

  function addGeneratedHomework(tasks){
    const rows=Array.isArray(tasks)?tasks:[tasks];
    for(const g of rows){
      if(!g?.question)continue;
      homework.push({
        id:"hw_"+Date.now()+"_"+Math.random().toString(36).slice(2,7),
        task:g.question,
        work:"",
        done:false,
        created:Date.now(),
        generated:g
      });
    }
    homework=homework.slice(-100);
    save();
  }

  async function handleHwAction(card,action){
    const id=card.dataset.hwId;
    const h=homework.find(x=>x.id===id);if(!h)return;
    const workEl=card.querySelector(".ml-hw-work");
    h.work=workEl?.value||"";save();
    const out=card.querySelector(".ml-hw-result");
    const gen=h.generated||null;

    if(action==="done"){h.done=!h.done;save();renderTab();return}
    if(action==="delete"){homework=homework.filter(x=>x.id!==id);save();renderTab();return}

    if(action==="solve"){
      out.innerHTML=`<div class="ml-loading">⚙ Готовлю проверенный разбор…</div>`;
      if(gen){
        out.innerHTML=`<div class="ml-result-card">
          <div class="ml-result-head"><span>✅ Generator 2.0</span><b>${esc(gen.answer)}</b></div>
          <p>${esc(gen.explanation||"Ответ проверен локальным генератором.")}</p>
          <small>Тема: ${esc(gen.topicId)} · ${esc(gen.topicTitle)}</small>
        </div>`;
        return;
      }
      try{
        const r=await window.KitsuneMath.analyze(h.task);
        out.innerHTML=resultHtml(r);touchSkill(r,true);
      }catch(e){out.innerHTML=`<div class="ml-error">${esc(e.message)}</div>`}
    }

    if(action==="steps"){
      if(!h.work.trim()){out.innerHTML=`<div class="ml-error">Сначала запиши свой ответ или решение в поле выше.</div>`;return}
      if(gen){
        try{
          const check=await window.KitsuneMath.checkGenerated(gen,h.work);
          out.innerHTML=check.ok
            ?`<div class="ml-success">✅ Верно! ${esc(check.answer)}</div>`
            :`<div class="ml-error">Пока не совпало. Попробуй ещё раз или возьми подсказку.</div>`;
          touchSkill({type:generatedSkillType(gen)},check.ok,gen.topicId);
          window.KitsuneLearning?.recordGeneratedResult?.(gen,check.ok,h.work);
        }catch(e){out.innerHTML=`<div class="ml-error">${esc(e.message)}</div>`}
        return;
      }
      try{
        const r=await window.KitsuneMath.verifySteps(h.work);
        out.innerHTML=`<div class="ml-step-report ${r.ok?"good":"warn"}">${r.rows.map(x=>`<div class="ml-step-row ${x.ok?"ok":"bad"}"><span>${x.ok?"✓":"!"}</span><div><b>${esc(x.line)}</b><small>${esc(x.message)}</small></div></div>`).join("")}</div>`;
      }catch(e){out.innerHTML=`<div class="ml-error">${esc(e.message)}</div>`}
    }

    if(action==="hint"){
      if(gen){
        const verified={type:"generated",display:gen.answer,steps:[gen.hint],topicTitle:gen.topicTitle};
        await askAi(gen.question,verified,out,{hintOnly:true});
        return;
      }
      try{
        const r=await window.KitsuneMath.analyze(h.task);
        await askAi(h.task,r,out,{hintOnly:true});
      }catch(e){out.innerHTML=`<div class="ml-error">${esc(e.message)}</div>`}
    }
  }

  function generatorModeText(mode){
    const map={
      topic:"Выбери любую из 51 тем. Можно сгенерировать несколько разных заданий именно по ней.",
      chapter:"Смешанная практика внутри выбранной главы.",
      all:"Случайный набор из всех 51 тем курса.",
      adaptive:"Kitsune чаще выбирает темы с ошибками и темы, которые ещё мало тренировались.",
      control:"12 заданий: по две темы из каждой главы, от простого к сложному.",
      homework:"Подборка с плавным ростом сложности. Её можно целиком отправить в Homework Studio.",
      marathon:"51 задание — ровно по одному из каждой темы курса. Полная проверка покрытия."
    };
    return map[mode]||"";
  }

  function syncGeneratorModeUi(){
    const mode=document.querySelector("#mlGenMode")?.value||"topic";
    const topicWrap=document.querySelector("#mlGenTopicWrap");
    const chapterWrap=document.querySelector("#mlGenChapterWrap");
    const countWrap=document.querySelector("#mlGenCountWrap");
    const count=document.querySelector("#mlGenCount");
    const note=document.querySelector("#mlGenModeNote");
    const btn=document.querySelector("#mlGenerateBtn");

    if(topicWrap)topicWrap.style.display=mode==="topic"?"":"none";
    if(chapterWrap)chapterWrap.style.display=(mode==="chapter"||mode==="homework")?"":"none";
    if(countWrap)countWrap.style.display=mode==="marathon"?"none":"";

    if(count){
      count.disabled=mode==="control";
      if(mode==="control")count.value="12";
      if(mode==="homework"&&count.value==="1")count.value="8";
    }

    if(note){
      let extra="";
      if(mode==="adaptive"){
        const weak=weakTopicIds().slice(0,5);
        extra=weak.length?` Сейчас приоритет: ${weak.map(topicLabel).join(" · ")}.`:"";
      }
      note.textContent=generatorModeText(mode)+extra;
    }

    if(btn){
      btn.textContent=mode==="marathon"?"🏆 Создать марафон 51":
        mode==="control"?"📝 Собрать контрольную":
        mode==="homework"?"🏠 Подобрать ДЗ":"✨ Создать набор";
    }
  }

  function generatedAnswerField(task,index){
    if(task.kind==="choice"&&Array.isArray(task.options)){
      return `<div class="ml-gen-choices">
        ${task.options.map((opt,j)=>`
          <label class="ml-gen-choice">
            <input type="radio" name="mlGenChoice_${index}" value="${j}">
            <span>${esc(opt)}</span>
          </label>`).join("")}
      </div>`;
    }
    return `<div class="ml-inline ml-gen-answer-row">
      <input id="mlGenAnswer_${index}" class="ml-input" placeholder="Твой ответ" autocomplete="off">
      <button class="primary" data-gen-action="check" data-gen-index="${index}">Проверить</button>
    </div>`;
  }

  function generatedCard(task,index){
    const dots="●".repeat(task.difficulty||1)+"○".repeat(Math.max(0,3-(task.difficulty||1)));
    return `<article class="ml-generated-card ml-gen2-card" data-gen-card="${index}">
      <div class="ml-gen-card-head">
        <div>
          <span class="eyebrow">§ ${esc(task.topicId)} · глава ${task.chapterId}</span>
          <h4>${esc(task.topicTitle)}</h4>
        </div>
        <span class="ml-gen-difficulty" title="Сложность">${dots}</span>
      </div>
      <div class="ml-gen-question">${esc(task.question)}</div>
      ${generatedAnswerField(task,index)}
      ${task.kind==="choice"?`
        <button class="primary ml-choice-check" data-gen-action="check" data-gen-index="${index}">Проверить ответ</button>`:""}
      <div class="ml-actions ml-gen-card-actions">
        <button class="secondary" data-gen-action="hint" data-gen-index="${index}">🦊 Подсказка</button>
        <button class="secondary" data-gen-action="reveal" data-gen-index="${index}">🧮 Разбор</button>
        <button class="secondary" data-gen-action="voice" data-gen-index="${index}">🎙 Спросить</button>
        <button class="secondary" data-gen-action="homework" data-gen-index="${index}">📚 В ДЗ</button>
      </div>
      <div class="ml-gen-feedback" id="mlGenFeedback_${index}"></div>
    </article>`;
  }

  function renderGeneratedPack(pack){
    const host=document.querySelector("#mlGenerated");
    if(!host)return;
    currentGeneratedPack=pack;
    const tasks=pack?.tasks||[];
    const mode=pack?.mode||"all";
    const coverage=pack?.coverage?.length||0;
    const chaptersCount=pack?.chapters?.length||0;

    host.innerHTML=`
      <div class="ml-gen-pack-head">
        <div>
          <span class="eyebrow">Набор готов</span>
          <h3>${tasks.length} ${tasks.length===1?"задание":tasks.length<5?"задания":"заданий"}</h3>
          <p>${coverage} тем · ${chaptersCount} глав · всё сгенерировано локально</p>
        </div>
        <div class="ml-actions">
          <button class="secondary" id="mlGenRegenerate">↻ Новый набор</button>
          <button class="secondary" id="mlGenPrint">🖨️ Лист</button>
          <button class="secondary" id="mlGenPrintKey">🔑 Ключ</button>
          <button class="primary" id="mlGenPackToHw">📚 Весь набор в ДЗ</button>
        </div>
      </div>
      ${mode==="marathon"?`
        <div class="ml-marathon-banner">
          🏆 <b>Полное покрытие курса:</b> 51 из 51 тем. Карточки ниже используют
          content-visibility, поэтому длинный марафон не должен тормозить интерфейс.
        </div>`:""}
      <div class="ml-gen-set">
        ${tasks.map(generatedCard).join("")}
      </div>`;

    bindGeneratedPack(pack);
  }

  function generatedSkillType(task){
    if(task.chapterId===1)return "rational";
    if(task.chapterId===2)return "sqrt";
    if(task.chapterId===4)return "inequality";
    if(task.chapterId===5)return "function";
    if(task.chapterId===3&&["3-29","3-30","3-31","3-32"].includes(task.topicId))return "system";
    if(task.chapterId===3)return "equation";
    return "expression";
  }

  async function generatedHint(task,host){
    const verified={
      type:"generated",
      display:task.answer,
      steps:[task.hint||"Определи правило темы и сделай первый шаг."],
      topicTitle:task.topicTitle
    };
    await askAi(task.question,verified,host,{hintOnly:true});
  }

  function printGeneratedPack(pack,withAnswers=false){
    const tasks=pack?.tasks||[];
    const w=window.open("","_blank");
    if(!w)return;
    const rows=tasks.map((task,i)=>`
      <article style="break-inside:avoid;margin:0 0 20px">
        <div style="font-size:11px;color:#666">§ ${esc(task.topicId)} · ${esc(task.topicTitle)}</div>
        <div style="font-size:18px;font-weight:700;margin:5px 0">${i+1}. ${esc(task.question)}</div>
        ${withAnswers?`<div style="margin-top:8px"><b>Ответ:</b> ${esc(task.answer)}${task.explanation?`<br><span style="font-size:12px">${esc(task.explanation)}</span>`:""}</div>`:`<div style="height:42px;border-bottom:1px solid #bbb"></div>`}
      </article>`).join("");
    w.document.write(`<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>Kitsune · ${withAnswers?"Ключ":"Лист заданий"}</title>
      <style>body{font-family:Arial,sans-serif;max-width:900px;margin:28px auto;padding:0 24px;color:#111}h1{margin-bottom:4px}p{color:#555}@media print{body{margin:0;max-width:none}}</style></head><body>
      <h1>${withAnswers?"Ключ для проверки":"Лист заданий Kitsune"}</h1>
      <p>${tasks.length} заданий · сгенерировано локально</p>${rows}
      <script>setTimeout(()=>window.print(),250)<\/script></body></html>`);
    w.document.close();
  }

  function initBoard(){
    const canvas=document.querySelector("#mlBoardCanvas");if(!canvas)return;
    const wrap=canvas.parentElement;
    const dpr=Math.min(devicePixelRatio||1,2);
    const rect=wrap.getBoundingClientRect();
    const w=Math.max(300,Math.floor(rect.width)),h=Math.max(360,Math.min(620,Math.floor(innerHeight*.55)));
    canvas.width=w*dpr;canvas.height=h*dpr;canvas.style.width=w+"px";canvas.style.height=h+"px";
    const ctx=canvas.getContext("2d");
    ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.lineCap="round";ctx.lineJoin="round";ctx.lineWidth=2.6;
    ctx.strokeStyle=getComputedStyle(document.body).getPropertyValue("--text").trim()||"#111";

    const redraw=()=>{
      ctx.clearRect(0,0,w,h);
      for(const stroke of boardStrokes){
        if(!stroke?.length)continue;
        ctx.beginPath();
        stroke.forEach((p,i)=>{const x=p.x*w,y=p.y*h;i?ctx.lineTo(x,y):ctx.moveTo(x,y)});
        ctx.stroke();
      }
    };
    redraw();

    let active=null;
    const point=e=>{
      const r=canvas.getBoundingClientRect();
      return {x:(e.clientX-r.left)/r.width,y:(e.clientY-r.top)/r.height};
    };
    canvas.addEventListener("pointerdown",e=>{
      canvas.setPointerCapture?.(e.pointerId);
      active=[point(e)];boardStrokes.push(active);redraw();
    });
    canvas.addEventListener("pointermove",e=>{
      if(!active)return;active.push(point(e));redraw();
    });
    const finish=()=>{if(active){active=null;save()}};
    canvas.addEventListener("pointerup",finish);
    canvas.addEventListener("pointercancel",finish);

    document.querySelector("#mlBoardUndo")?.addEventListener("click",()=>{boardStrokes.pop();save();redraw()});
    document.querySelector("#mlBoardClear")?.addEventListener("click",()=>{
      if(confirm("Очистить математическую доску?")){boardStrokes=[];save();redraw()}
    });
    document.querySelector("#mlBoardSave")?.addEventListener("click",()=>{
      const a=document.createElement("a");a.download="kitsune-math-board.png";a.href=canvas.toDataURL("image/png");a.click();
    });
  }

  function bindGeneratedPack(pack){
    const tasks=pack.tasks||[];

    document.querySelector("#mlGenRegenerate")?.addEventListener("click",generateTask);
    document.querySelector("#mlGenPrint")?.addEventListener("click",()=>printGeneratedPack(pack,false));
    document.querySelector("#mlGenPrintKey")?.addEventListener("click",()=>printGeneratedPack(pack,true));
    document.querySelector("#mlGenPackToHw")?.addEventListener("click",()=>{
      addGeneratedHomework(tasks);
      const b=document.querySelector("#mlGenPackToHw");
      if(b){b.textContent="✅ Набор добавлен в ДЗ";b.disabled=true}
    });

    document.querySelectorAll("[data-gen-action]").forEach(btn=>{
      btn.addEventListener("click",async()=>{
        const index=Number(btn.dataset.genIndex);
        const task=tasks[index];
        if(!task)return;
        const host=document.querySelector(`#mlGenFeedback_${index}`);
        const action=btn.dataset.genAction;

        if(action==="homework"){
          addGeneratedHomework(task);
          host.innerHTML=`<div class="ml-success">📚 Добавлено в Homework Studio.</div>`;
          return;
        }

        if(action==="hint"){
          try{window.KitsuneMastery?.recordHint?.(task.topicId,1)}catch(e){}
          await generatedHint(task,host);
          return;
        }

        if(action==="voice"){
          const ctx={
            lesson:{id:task.topicId,title:task.topicTitle},
            exercise:{q:task.question,hint:task.hint,a:[task.answer]}
          };
          window.KitsuneVoiceDialogue?.open?.(ctx);
          return;
        }

        if(action==="reveal"){
          host.innerHTML=`<div class="ml-result-card">
            <div class="ml-result-head"><span>✅ Проверенный ответ</span><b>${esc(task.answer)}</b></div>
            <p>${esc(task.explanation||"Результат проверен локальным генератором.")}</p>
          </div>`;
          return;
        }

        if(action==="check"){
          let answer="";
          if(task.kind==="choice"){
            answer=document.querySelector(`input[name="mlGenChoice_${index}"]:checked`)?.value??"";
          }else{
            answer=document.querySelector(`#mlGenAnswer_${index}`)?.value??"";
          }
          if(answer===""){
            host.innerHTML=`<div class="ml-error">Сначала выбери или введи ответ.</div>`;
            return;
          }

          host.innerHTML=`<div class="ml-loading">⚙ Проверяю локально…</div>`;
          try{
            const check=await window.KitsuneMath.checkGenerated(task,answer);
            touchSkill({type:generatedSkillType(task)},check.ok,task.topicId);
            window.KitsuneLearning?.recordGeneratedResult?.(task,check.ok,answer);
            if(check.ok){
              host.innerHTML=`<div class="ml-success">✅ Верно! ${esc(check.answer)}</div>`;
            }else{
              host.innerHTML=`<div class="ml-error">Пока не совпало. Ответ не раскрываю — попробуй ещё раз или попроси подсказку.</div>`;
            }
          }catch(e){
            host.innerHTML=`<div class="ml-error">${esc(e.message||e)}</div>`;
          }
        }
      });
    });
  }

  async function generateTask(){
    const mode=document.querySelector("#mlGenMode")?.value||"topic";
    const difficulty=Number(document.querySelector("#mlGenDifficulty")?.value||2);
    let count=Number(document.querySelector("#mlGenCount")?.value||8);
    const chapterId=Number(document.querySelector("#mlGenChapter")?.value||0);
    const topicId=document.querySelector("#mlGenTopicId")?.value||courseTopics()[0]?.id;
    const host=document.querySelector("#mlGenerated");
    if(!host)return;

    if(mode==="control")count=12;
    if(mode==="marathon")count=51;

    host.innerHTML=`<div class="ml-loading">⚙ Generator 2.0 подбирает задания и проверяет ключи…</div>`;
    try{
      const pack=await window.KitsuneMath.generateSet({
        mode,topicId,chapterId:chapterId||null,count,difficulty,
        weakTopicIds:mode==="adaptive"?weakTopicIds():[]
      });
      renderGeneratedPack(pack);
    }catch(e){
      host.innerHTML=`<div class="ml-error">⚠ ${esc(e.message||e)}</div>`;
    }
  }

  async function drawGraph(){
    const expr=document.querySelector("#mlGraphInput")?.value.trim();
    const canvas=document.querySelector("#mlGraphCanvas");
    const info=document.querySelector("#mlGraphInfo");
    if(!expr||!canvas)return;
    info.innerHTML=`<div class="ml-loading">⚙ Строю локально…</div>`;
    try{
      const res=await window.KitsuneMath.sampleFunction(expr,{xmin:-10,xmax:10,count:241});
      paintGraph(canvas,res.points);
      info.innerHTML=`<div class="ml-success">✅ ${esc(res.expression)} · диапазон x: −10…10</div>`;
      touchSkill({type:"function"},true);
    }catch(e){info.innerHTML=`<div class="ml-error">${esc(e.message)}</div>`}
  }

  function paintGraph(canvas,points){
    const box=canvas.parentElement.getBoundingClientRect();
    const dpr=Math.min(devicePixelRatio||1,2);
    const w=Math.max(300,Math.round(box.width)),h=Math.max(260,Math.round(Math.min(440,w*.65)));
    canvas.width=w*dpr;canvas.height=h*dpr;canvas.style.width=w+"px";canvas.style.height=h+"px";
    const ctx=canvas.getContext("2d");ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.clearRect(0,0,w,h);
    const xmin=-10,xmax=10,ymin=-10,ymax=10;
    const X=x=>(x-xmin)/(xmax-xmin)*w,Y=y=>h-(y-ymin)/(ymax-ymin)*h;
    ctx.lineWidth=1;ctx.strokeStyle=getComputedStyle(document.body).getPropertyValue("--line").trim()||"#ddd";
    for(let k=-10;k<=10;k++){
      ctx.beginPath();ctx.moveTo(X(k),0);ctx.lineTo(X(k),h);ctx.stroke();
      ctx.beginPath();ctx.moveTo(0,Y(k));ctx.lineTo(w,Y(k));ctx.stroke();
    }
    ctx.lineWidth=2;ctx.strokeStyle=getComputedStyle(document.body).getPropertyValue("--text").trim()||"#222";
    ctx.beginPath();ctx.moveTo(X(0),0);ctx.lineTo(X(0),h);ctx.stroke();
    ctx.beginPath();ctx.moveTo(0,Y(0));ctx.lineTo(w,Y(0));ctx.stroke();
    ctx.lineWidth=3;ctx.strokeStyle=getComputedStyle(document.body).getPropertyValue("--primary").trim()||"#2563eb";
    let drawing=false;
    for(const [x,y] of points){
      if(y===null||y<ymin*3||y>ymax*3){drawing=false;continue}
      const px=X(x),py=Y(y);
      if(!drawing){ctx.beginPath();ctx.moveTo(px,py);drawing=true}
      else ctx.lineTo(px,py);
      if(py<0||py>h){ctx.stroke();drawing=false}
    }
    if(drawing)ctx.stroke();
  }

  function bindTab(){
    document.querySelector("#mlExampleBtn")?.addEventListener("click",()=>{
      const arr=["3x² − 12x + 9 = 0","-2x + 5 > 13","(x² - 9)/(x - 3)","√72","2(x + 3) - x"];
      document.querySelector("#mlInput").value=arr[Math.floor(Math.random()*arr.length)];
    });
    document.querySelector("#mlSolveBtn")?.addEventListener("click",()=>solveInput({hint:false}));
    document.querySelector("#mlHintBtn")?.addEventListener("click",()=>solveInput({hint:true}));
    document.querySelector("#mlAddHwBtn")?.addEventListener("click",()=>{
      const x=document.querySelector("#mlInput")?.value.trim();if(!x)return;
      addHomeworkTasks(x);document.querySelector("#mlAiHint").innerHTML=`<div class="ml-success">📚 Добавлено в домашнее задание.</div>`;
    });
    document.querySelector("#mlClearHistory")?.addEventListener("click",()=>{history=[];save();renderTab()});
    document.querySelectorAll("[data-ml-history]").forEach(b=>b.addEventListener("click",()=>{
      document.querySelector("#mlInput").value=b.dataset.mlHistory||"";
      solveInput({hint:false});
    }));

    document.querySelector("#mlCheckStepsBtn")?.addEventListener("click",verifySteps);
    document.querySelector("#mlStepsHintBtn")?.addEventListener("click",async()=>{
      const input=document.querySelector("#mlStepsInput")?.value.trim();if(!input)return;
      try{
        const r=await window.KitsuneMath.verifySteps(input);
        await askAi(input,r,document.querySelector("#mlStepsAi"),{steps:true,hintOnly:true});
      }catch(e){document.querySelector("#mlStepsAi").innerHTML=`<div class="ml-error">${esc(e.message)}</div>`}
    });

    document.querySelector("#mlGraphBtn")?.addEventListener("click",drawGraph);

    document.querySelector("#mlHwAddBtn")?.addEventListener("click",()=>{
      const el=document.querySelector("#mlHwNew");if(!el?.value.trim())return;
      addHomeworkTasks(el.value);renderTab();
    });
    document.querySelectorAll(".ml-hw-card").forEach(card=>{
      card.querySelector(".ml-hw-work")?.addEventListener("change",e=>{
        const h=homework.find(x=>x.id===card.dataset.hwId);if(h){h.work=e.target.value;save()}
      });
      card.querySelectorAll("[data-hw-action]").forEach(b=>b.addEventListener("click",()=>handleHwAction(card,b.dataset.hwAction)));
    });

    document.querySelector("#mlGenMode")?.addEventListener("change",syncGeneratorModeUi);
    document.querySelector("#mlGenChapter")?.addEventListener("change",syncGeneratorModeUi);
    document.querySelector("#mlGenerateBtn")?.addEventListener("click",generateTask);
    if(document.querySelector("#mlGenMode"))syncGeneratorModeUi();
  }

  function render(){
    const content=document.querySelector("#content");
    if(!content)return;
    document.querySelector("#pageTitle").textContent="Kitsune Math Lab";
    document.querySelectorAll(".nav-btn").forEach(b=>b.classList.toggle("active",b.dataset.view==="mathlab"));
    content.innerHTML=shell();
    document.querySelectorAll("[data-ml-tab]").forEach(b=>b.addEventListener("click",()=>{
      currentTab=b.dataset.mlTab;
      document.querySelectorAll("[data-ml-tab]").forEach(x=>x.classList.toggle("active",x===b));
      renderTab();
    }));
    renderTab();renderSkills();
    try{window.scrollTo({top:0,behavior:"smooth"})}catch(e){}
  }

  /* v2.2.0 ROUTE FIX
     Legacy course extensions redefine the global go() function several times
     (chapter1-v02.js, course-v1.js, mastery-v13.js). Therefore registering the
     Math Lab only in app.js is not stable. Math Lab installs its own final
     route wrapper after those legacy modules and also binds direct click
     handlers as a defensive fallback. */
  const mlPreviousGo=typeof window.go==="function"?window.go:null;

  window.go=function(view){
    if(view==="mathlab"){
      render();
      return;
    }
    return mlPreviousGo?.(view);
  };

  function bindMathLabRoute(){
    document.querySelectorAll('[data-view="mathlab"]').forEach(btn=>{
      if(btn.dataset.mathLabBound==="1")return;
      btn.dataset.mathLabBound="1";
      btn.addEventListener("click",e=>{
        e.preventDefault();
        e.stopImmediatePropagation();
        render();
        try{
          if(window.innerWidth<981){
            document.querySelector("#sidebar")?.classList.remove("open");
            document.body.classList.remove("sidebar-mobile-open");
            document.querySelector("#sidebarScrim")?.setAttribute("aria-hidden","true");
          }
        }catch(x){}
      },{capture:true});
    });

    document.querySelectorAll('[data-view-jump="mathlab"]').forEach(btn=>{
      if(btn.dataset.mathLabBound==="1")return;
      btn.dataset.mathLabBound="1";
      btn.addEventListener("click",e=>{
        e.preventDefault();
        e.stopImmediatePropagation();
        render();
      },{capture:true});
    });
  }

  window.renderMathLab=render;
  window.KitsuneMathLab={
    version:VERSION,
    open:render,
    addHomework(task){addHomeworkTasks(task)},
    homework:()=>JSON.parse(JSON.stringify(homework)),
    skills:()=>JSON.parse(JSON.stringify(skills))
  };

  bindMathLabRoute();
  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",bindMathLabRoute,{once:true});
  }
})();

