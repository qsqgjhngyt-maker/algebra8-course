
/* ================================================================
   Kitsune Math Lab v1.13.1
   Sandbox + homework + step verifier + generator + local skill map.
   ================================================================ */
(() => {
  "use strict";

  const VERSION=window.KITSUNE_APP_VERSION||"1.13.1";
  const HW_KEY="a8_mathlab_homework_v130";
  const SKILL_KEY="a8_mathlab_skills_v130";
  const HISTORY_KEY="a8_mathlab_history_v130";

  let homework=[];
  let skills={};
  let history=[];
  let currentTab="solve";
  let lastResult=null;
  let graphResizeObserver=null;

  try{
    homework=JSON.parse(localStorage.getItem(HW_KEY)||"[]");
    skills=JSON.parse(localStorage.getItem(SKILL_KEY)||"{}");
    history=JSON.parse(localStorage.getItem(HISTORY_KEY)||"[]");
    if(!Array.isArray(homework))homework=[];
    if(!skills||typeof skills!=="object")skills={};
    if(!Array.isArray(history))history=[];
  }catch(e){}

  function save(){
    try{
      localStorage.setItem(HW_KEY,JSON.stringify(homework.slice(-100)));
      localStorage.setItem(SKILL_KEY,JSON.stringify(skills));
      localStorage.setItem(HISTORY_KEY,JSON.stringify(history.slice(-60)));
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

  function touchSkill(result,good=true){
    const key=result?.kind==="quadratic"?"quadratic":result?.kind==="linear"&&result?.type==="equation"?"linear":result?.type||"expression";
    const row=skills[key]||{attempts:0,success:0,last:0};
    row.attempts++;
    if(good)row.success++;
    row.last=Date.now();
    skills[key]=row;
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
    return `<article class="ml-hw-card ${h.done?"done":""}" data-hw-id="${h.id}">
      <div class="ml-hw-top">
        <button class="ml-check" data-hw-action="done" title="Готово">${h.done?"✓":"○"}</button>
        <div><b>${esc(h.task)}</b><small>${new Date(h.created).toLocaleDateString("ru-RU")}</small></div>
        <button class="ml-icon" data-hw-action="delete" title="Удалить">×</button>
      </div>
      <textarea class="ml-hw-work" rows="3" placeholder="Моё решение / промежуточные шаги…">${esc(h.work||"")}</textarea>
      <div class="ml-hw-actions">
        <button data-hw-action="solve">🧮 Проверить задачу</button>
        <button data-hw-action="steps">✅ Проверить мои шаги</button>
        <button data-hw-action="hint">🦊 Подсказка</button>
      </div>
      <div class="ml-hw-result"></div>
    </article>`;
  }

  function trainerTab(){
    return `
      <div class="ml-panel">
        <span class="eyebrow">Бесконечная практика</span>
        <h3>Генератор заданий</h3>
        <div class="ml-generator-options">
          <label>Тема
            <select id="mlGenTopic">
              <option value="linear">Линейные уравнения</option>
              <option value="quadratic">Квадратные уравнения</option>
              <option value="inequality">Неравенства</option>
              <option value="sqrt">Квадратные корни</option>
            </select>
          </label>
          <label>Сложность
            <select id="mlGenDifficulty">
              <option value="1">🌱 Легко</option>
              <option value="2">📘 Нормально</option>
              <option value="3">🧠 Сложно</option>
            </select>
          </label>
          <button class="primary" id="mlGenerateBtn">🎲 Новое задание</button>
        </div>
        <div id="mlGenerated" class="ml-generated">
          <div class="ml-empty">Нажми «Новое задание».</div>
        </div>
      </div>`;
  }

  function renderTab(){
    const body=document.querySelector("#mathLabBody");
    if(!body)return;
    body.innerHTML=currentTab==="steps"?stepsTab():
      currentTab==="graph"?graphTab():
      currentTab==="homework"?homeworkTab():
      currentTab==="trainer"?trainerTab():solveTab();
    bindTab();
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

  async function handleHwAction(card,action){
    const id=card.dataset.hwId;
    const h=homework.find(x=>x.id===id);if(!h)return;
    const workEl=card.querySelector(".ml-hw-work");
    h.work=workEl?.value||"";save();
    const out=card.querySelector(".ml-hw-result");

    if(action==="done"){h.done=!h.done;save();renderTab();return}
    if(action==="delete"){homework=homework.filter(x=>x.id!==id);save();renderTab();return}

    if(action==="solve"){
      out.innerHTML=`<div class="ml-loading">⚙ Считаю…</div>`;
      try{
        const r=await window.KitsuneMath.analyze(h.task);
        out.innerHTML=resultHtml(r);touchSkill(r,true);
      }catch(e){out.innerHTML=`<div class="ml-error">${esc(e.message)}</div>`}
    }
    if(action==="steps"){
      if(!h.work.trim()){out.innerHTML=`<div class="ml-error">Сначала запиши свои шаги в поле выше.</div>`;return}
      try{
        const r=await window.KitsuneMath.verifySteps(h.work);
        out.innerHTML=`<div class="ml-step-report ${r.ok?"good":"warn"}">${r.rows.map(x=>`<div class="ml-step-row ${x.ok?"ok":"bad"}"><span>${x.ok?"✓":"!"}</span><div><b>${esc(x.line)}</b><small>${esc(x.message)}</small></div></div>`).join("")}</div>`;
      }catch(e){out.innerHTML=`<div class="ml-error">${esc(e.message)}</div>`}
    }
    if(action==="hint"){
      try{
        const r=await window.KitsuneMath.analyze(h.task);
        await askAi(h.task,r,out,{hintOnly:true});
      }catch(e){out.innerHTML=`<div class="ml-error">${esc(e.message)}</div>`}
    }
  }

  async function generateTask(){
    const topic=document.querySelector("#mlGenTopic")?.value||"linear";
    const difficulty=Number(document.querySelector("#mlGenDifficulty")?.value||1);
    const host=document.querySelector("#mlGenerated");
    const g=await window.KitsuneMath.generate(topic,difficulty);
    host.dataset.expected=g.answer;
    host.dataset.question=g.question;
    host.innerHTML=`<div class="ml-generated-card">
      <span class="eyebrow">${skillName(topic)}</span>
      <h2>${esc(g.question)}</h2>
      <div class="ml-inline">
        <input id="mlGenAnswer" class="ml-input" placeholder="Твой ответ">
        <button class="primary" id="mlCheckGenerated">Проверить</button>
      </div>
      <div class="ml-actions">
        <button class="secondary" id="mlGenHint">🦊 Подсказка</button>
        <button class="secondary" id="mlGenToHw">📚 В ДЗ</button>
      </div>
      <div id="mlGenResult"></div>
    </div>`;
    document.querySelector("#mlCheckGenerated")?.addEventListener("click",()=>{
      const val=document.querySelector("#mlGenAnswer")?.value||"";
      const norm=s=>String(s).toLowerCase().replace(/\s+/g,"").replace(/[−–—]/g,"-").replace(/,/g,".");
      const ok=norm(val)===norm(g.answer) || norm(val).replace(/x[₁1]=/g,"").replace(/x[₂2]=/g,"").split(/[;,]/).sort().join("|")===
        norm(g.answer).replace(/x[₁1]=/g,"").replace(/x[₂2]=/g,"").split(/[;,]/).sort().join("|");
      document.querySelector("#mlGenResult").innerHTML=ok
        ?`<div class="ml-success">✅ Верно! ${esc(g.answer)}</div>`
        :`<div class="ml-error">Пока не совпало. Попробуй ещё раз или возьми подсказку.</div>`;
      touchSkill({type:topic},ok);
    });
    document.querySelector("#mlGenHint")?.addEventListener("click",async()=>{
      const r=await window.KitsuneMath.analyze(g.question);
      await askAi(g.question,r,document.querySelector("#mlGenResult"),{hintOnly:true});
    });
    document.querySelector("#mlGenToHw")?.addEventListener("click",()=>{
      addHomeworkTasks(g.question);
      document.querySelector("#mlGenResult").innerHTML=`<div class="ml-success">📚 Добавлено в домашнее задание.</div>`;
    });
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

    document.querySelector("#mlGenerateBtn")?.addEventListener("click",generateTask);
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

  /* v1.13.1 ROUTE FIX
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

