
/* =====================================================================
   v1.7.3 · SMART INLINE TUTOR
   Конкретная помощь прямо под текущим заданием. Никаких всплывающих настроек.
   ===================================================================== */
(() => {
  "use strict";

  const VERSION="1.7.3";
  const perExercise={};

  function strip(s){
    try{return v16Strip(s)}catch(e){
      const d=document.createElement("div");d.innerHTML=String(s??"");
      return (d.textContent||"").replace(/\s+/g," ").trim();
    }
  }
  function norm(s){
    return String(s??"").trim().replace(/−/g,"-").replace(/≤/g,"<=").replace(/≥/g,">=")
      .replace(/·/g,"*").replace(/²/g,"^2").replace(/³/g,"^3").replace(/\s+/g,"");
  }
  function expected(ctx){
    const a=Array.isArray(ctx.exercise.a)?ctx.exercise.a:[ctx.exercise.a];
    return a.map(strip).filter(Boolean)[0]||"";
  }
  function lessonRule(ctx){
    const d=ctx.lesson||{};
    return strip(d.formula)||strip(d.remember)||strip(d.why)||"Используй правило текущей темы и проверяй один переход за раз.";
  }
  function safeHint(ctx){
    return strip(ctx.exercise?.hint)||strip(v16Profile?.(ctx)?.first)||"Начни с первого преобразования по правилу темы.";
  }

  function parseLinearExpr(raw){
    let s=norm(raw).replace(/\*/g,"");
    if(!s)return null;
    s=s.replace(/^\+/,"");
    let a=0,b=0;

    // Split into signed terms.
    const terms=s.match(/[+-]?[^+-]+/g)||[];
    for(const term0 of terms){
      const term=term0.trim();
      if(!term)continue;
      if(term.includes("x")){
        let c=term.replace("x","");
        if(c===""||c==="+")c="1";
        if(c==="-")c="-1";
        const n=Number(c);
        if(!Number.isFinite(n))return null;
        a+=n;
      }else{
        const n=Number(term);
        if(!Number.isFinite(n))return null;
        b+=n;
      }
    }
    return {a,b};
  }

  function flipOp(op){
    return ({">":"<","<":">",">=":"<=","<=":">="})[op]||op;
  }
  function prettyOp(op){return op.replace(">=","≥").replace("<=","≤")}

  function inequalitySteps(ctx,q){
    const m=norm(q)
      .replace(/^реши/i,"")
      .replace(/\.$/,"")
      .match(/^(.+?)(>=|<=|>|<)([-+]?\d+(?:\.\d+)?)$/i);
    if(!m)return null;

    const lhs=parseLinearExpr(m[1]),op=m[2],rhs=Number(m[3]);
    if(!lhs||!lhs.a||!Number.isFinite(rhs))return null;

    const target=rhs-lhs.b;
    const op2=lhs.a<0?flipOp(op):op;
    const xval=target/lhs.a;
    const move=lhs.b===0
      ?`Оставляем член с x: ${lhs.a===1?"x":lhs.a===-1?"−x":lhs.a+"x"} ${prettyOp(op)} ${rhs}.`
      :`Переносим число ${Math.abs(lhs.b)}: получаем ${lhs.a===1?"x":lhs.a===-1?"−x":lhs.a+"x"} ${prettyOp(op)} ${target}.`;

    const divide=Math.abs(lhs.a)===1
      ?(lhs.a<0
        ?`Умножаем обе части на −1. Знак обязательно переворачивается: x ${prettyOp(op2)} ${xval}.`
        :`Коэффициент при x уже равен 1: x ${prettyOp(op2)} ${xval}.`)
      :`Делим обе части на ${lhs.a}. ${lhs.a<0?"Так как делитель отрицательный, знак меняется. ":""}Получаем x ${prettyOp(op2)} ${xval}.`;

    return [
      move,
      divide,
      `Проверка границы: подставь x=${xval} в исходное выражение и отдельно проверь направление знака ${prettyOp(op2)}.`,
      `Ответ: ${expected(ctx)}`
    ];
  }

  function quadraticCoeffs(q){
    const s=norm(q).replace(/^.*?((?:[+-]?\d*)x\^2.*?=0).*$/i,"$1");
    const left=s.split("=")[0];
    if(!left.includes("x^2"))return null;

    const terms=left.match(/[+-]?[^+-]+/g)||[];
    let a=0,b=0,c=0;
    for(let term of terms){
      if(term.includes("x^2")){
        let k=term.replace("x^2","");
        if(k===""||k==="+")k="1";if(k==="-")k="-1";
        if(!Number.isFinite(Number(k)))return null;a+=Number(k);
      }else if(term.includes("x")){
        let k=term.replace("x","");
        if(k===""||k==="+")k="1";if(k==="-")k="-1";
        if(!Number.isFinite(Number(k)))return null;b+=Number(k);
      }else{
        if(!Number.isFinite(Number(term)))return null;c+=Number(term);
      }
    }
    return a?{a,b,c}:null;
  }

  function quadraticSteps(ctx,q){
    const co=quadraticCoeffs(q);
    if(!co)return null;
    const {a,b,c}=co,D= b*b-4*a*c;
    const steps=[
      `Выписываем коэффициенты: a=${a}, b=${b}, c=${c}.`,
      `Считаем дискриминант: D=b²−4ac=${b<0?`(${b})`:`${b}`}²−4·${a}·${c}=${D}.`
    ];

    if(/дискриминант/i.test(q)){
      steps.push(`В этом задании нужен именно D. После вычисления ничего больше решать не требуется.`);
      steps.push(`Ответ: ${expected(ctx)}`);
      return steps;
    }

    if(/сколько.*корн/i.test(q)){
      const count=D>0?2:D===0?1:0;
      steps.push(`Так как D ${D>0?"> 0":D===0?"= 0":"< 0"}, действительных корней: ${count}.`);
      steps.push(`Ответ: ${expected(ctx)}`);
      return steps;
    }

    if(D>=0){
      const r=Math.sqrt(D);
      if(Number.isInteger(r)){
        const x1=(-b-r)/(2*a),x2=(-b+r)/(2*a);
        steps.push(D===0
          ?`D=0, поэтому x=−b/(2a)=${-b}/${2*a}=${x1}.`
          :`√D=${r}. Тогда x₁=(${-b}−${r})/${2*a}=${x1}, x₂=(${-b}+${r})/${2*a}=${x2}.`);
      }else{
        steps.push(`D≥0, подставляем его в формулу x=(−b±√D)/(2a).`);
      }
    }else{
      steps.push(`D<0, поэтому действительных корней нет.`);
    }
    steps.push(`Ответ: ${expected(ctx)}`);
    return steps;
  }

  function sqrtSteps(ctx,q){
    const h=safeHint(ctx),ans=expected(ctx);
    if(!/[√]|корен/i.test(q))return null;

    if(/упрости/i.test(q)){
      return [
        `Ищи под корнем полный квадрат. Для этого примера: ${h}`,
        `Раздели корень по произведению: √(a²·b)=|a|√b и вынеси полный квадрат.`,
        `После вынесения проверь, что оставшееся под корнем число уже не содержит квадратного множителя.`,
        `Ответ: ${ans}`
      ];
    }
    if(/x²=|положительный корень/i.test(q)){
      return [
        `${h}`,
        `Если x²=a и a>0, то решения x=±√a. Если просят положительный корень — берём только +√a.`,
        `Возведи полученное число в квадрат: оно должно вернуть исходное a.`,
        `Ответ: ${ans}`
      ];
    }
    return [
      `${h}`,
      `Арифметический квадратный корень — неотрицательное число, квадрат которого равен подкоренному выражению.`,
      `Проверь найденное значение возведением в квадрат.`,
      `Ответ: ${ans}`
    ];
  }

  function fractionSteps(ctx,q){
    const h=safeHint(ctx),ans=expected(ctx);
    if(!/[\/]|дроб|знамен/i.test(q))return null;

    if(/запрещ|не имеет смысла|можно ли подставить/i.test(q)){
      return [
        `${h}`,
        `Работаем только со знаменателем: приравниваем его к нулю и найденное значение исключаем.`,
        `После этого проверь именно исходное выражение: знаменатель не должен стать нулём.`,
        `Ответ: ${ans}`
      ];
    }
    if(/реши/i.test(q)&&q.includes("=")){
      return [
        `${h}`,
        `Сначала выпиши ОДЗ, затем убери знаменатели равносильным умножением на общий знаменатель.`,
        `Реши получившееся обычное уравнение и обязательно сверяй найденный корень с ОДЗ.`,
        `Ответ: ${ans}`
      ];
    }
    return [
      `${h}`,
      `С дробями выполняй действие только после приведения к нужной форме: общий знаменатель / обратная дробь / сокращение общих множителей.`,
      `Проверь, что ты не сокращал отдельные слагаемые внутри суммы.`,
      `Ответ: ${ans}`
    ];
  }

  function powerSteps(ctx,q){
    if(!/⁻|степен|10\^|10⁻|10³|10²/i.test(q)&&!ctx.lessonId.startsWith("6-"))return null;
    const h=safeHint(ctx),ans=expected(ctx);
    return [
      `${h}`,
      ctx.lessonId==="6-49"
        ?`Для стандартного вида оставь одну ненулевую цифру перед запятой и посчитай, на сколько позиций она сдвинулась.`
        :`Применяй закон степени к показателям отдельно от коэффициентов.`,
      ctx.lessonId==="6-49"
        ?`Сдвиг запятой влево у большого числа даёт положительную степень 10; вправо у малого числа — отрицательную.`
        :`Если показатель отрицательный, перепиши a⁻ⁿ как 1/aⁿ и только затем вычисляй.`,
      `Ответ: ${ans}`
    ];
  }

  function functionSteps(ctx,q){
    if(!ctx.lessonId.startsWith("5-")&&!/y=|f\(/i.test(q))return null;
    const h=safeHint(ctx),ans=expected(ctx);
    return [
      `${h}`,
      `Подставь указанное значение x в формулу функции или приравняй y к нужному значению, если ищется ноль функции.`,
      `Проверь область определения: знаменатель ≠0, а под квадратным корнем выражение ≥0.`,
      `Ответ: ${ans}`
    ];
  }

  function genericConcreteSteps(ctx){
    const h=safeHint(ctx),rule=lessonRule(ctx),ans=expected(ctx);
    const exampleSteps=(ctx.lesson?.example?.steps||[]).map(strip).filter(Boolean);
    return [
      `Для этого задания начни конкретно так: ${h}`,
      exampleSteps[0]
        ?`Ориентир из разобранного примера этой темы: ${exampleSteps[0]} Теперь сделай тот же тип шага с числами из текущего задания.`
        :`Правило текущей темы: ${rule}`,
      exampleSteps[1]
        ?`Следующий тип шага в образце: ${exampleSteps[1]} Сверь с ним своё преобразование.`
        :`Проверь свой последний переход: знак, знаменатель, порядок действий и ограничения должны сохраниться.`,
      `Ответ для самопроверки: ${ans}`
    ];
  }

  function buildSteps(ctx){
    const q=strip(ctx.exercise.q);
    return inequalitySteps(ctx,q)
      ||quadraticSteps(ctx,q)
      ||sqrtSteps(ctx,q)
      ||fractionSteps(ctx,q)
      ||powerSteps(ctx,q)
      ||functionSteps(ctx,q)
      ||genericConcreteSteps(ctx);
  }

  function diagnosis(ctx,userValue,errorType){
    const u=strip(userValue);
    const q=strip(ctx.exercise.q);
    const hint=safeHint(ctx);

    if(!u)return `Ты пока не ввёл ответ. Начнём с первого шага именно для этого примера.`;

    if(errorType==="inequality_flip"){
      return `Ты ввёл «${u}». Похоже, числовую границу ты нашёл, но направление знака неравенства изменено неверно. В этом примере ключевой момент — деление/умножение на отрицательное число.`;
    }
    if(errorType==="sign"){
      return `Ты ввёл «${u}». Число похоже по модулю, но знак отличается. Проверь перенос слагаемого или действие с отрицательным коэффициентом.`;
    }
    if(errorType==="domain"){
      return `Ты ввёл «${u}». В этой задаче сначала нужно проверить допустимость значения: ${hint}`;
    }
    if(errorType==="quadratic"){
      return `Ты ввёл «${u}». Для этого квадратного уравнения не угадываем корни: сначала выписываем a, b, c и считаем дискриминант.`;
    }
    if(errorType==="radical"){
      return `Ты ввёл «${u}». Здесь ошибка связана с корнем. Конкретная опора для этого примера: ${hint}`;
    }
    if(errorType==="fraction"){
      return `Ты ввёл «${u}». В этом примере проверь дробный шаг: ${hint}`;
    }
    if(errorType==="interval"){
      return `Ты ввёл «${u}». Здесь нужно проверить и границу, и то, входит ли она в множество решений.`;
    }
    if(errorType==="exponent"||errorType==="scientific"){
      return `Ты ввёл «${u}». Проверь именно работу с показателем степени: ${hint}`;
    }
    if(errorType==="arithmetic"){
      return `Ты ввёл «${u}». Метод может быть верным, но вычисление не совпало. Пересчитаем текущий пример по шагам.`;
    }
    return `Ты ввёл «${u}». Я не буду говорить «разложим по шагам» вообще — ниже показываю первый конкретный шаг именно для задания «${q}».`;
  }

  function panel(ctx){
    let p=ctx.box.querySelector(".v173-inline-tutor");
    if(p)return p;

    p=document.createElement("div");
    p.className="v173-inline-tutor";
    p.innerHTML=`
      <div class="v173-inline-head">
        <div><strong>🤖 Альфи разбирает это задание</strong><small>Конкретные шаги · прямо здесь</small></div>
        <button type="button" class="v173-close" aria-label="Скрыть разбор">×</button>
      </div>
      <div class="v173-diagnosis"></div>
      <div class="v173-steps"></div>
      <div class="v173-controls">
        <button type="button" class="v173-btn primary v173-next">👣 Следующий шаг</button>
        <button type="button" class="v173-btn v173-why">❓ Почему так?</button>
        <button type="button" class="v173-btn v173-work">✍️ Проверить мой ход</button>
        <button type="button" class="v173-btn danger-soft v173-answer">👁 Показать ответ</button>
      </div>
      <div class="v173-why-box"></div>
      <div class="v173-work-box">
        <textarea placeholder="Напиши свой промежуточный шаг, например: 3x<9 или D=16"></textarea>
        <button type="button" class="v173-btn primary v173-check-work">Проверить этот шаг</button>
        <div class="v173-work-result"></div>
      </div>`;

    const fb=ctx.box.querySelector(".feedback");
    if(fb)fb.insertAdjacentElement("afterend",p);
    else ctx.box.appendChild(p);

    p.querySelector(".v173-close").addEventListener("click",()=>p.classList.remove("show"));
    p.querySelector(".v173-next").addEventListener("click",()=>revealNext(ctx));
    p.querySelector(".v173-answer").addEventListener("click",()=>revealAnswer(ctx));
    p.querySelector(".v173-why").addEventListener("click",()=>toggleWhy(ctx));
    p.querySelector(".v173-work").addEventListener("click",()=>{
      p.querySelector(".v173-work-box").classList.toggle("show");
      if(p.querySelector(".v173-work-box").classList.contains("show")){
        setTimeout(()=>p.querySelector("textarea")?.focus(),20);
      }
    });
    p.querySelector(".v173-check-work").addEventListener("click",()=>checkWork(ctx));
    return p;
  }

  function render(ctx,{userValue="",errorType=null,reason="manual"}={}){
    const p=panel(ctx),steps=buildSteps(ctx);
    const state=perExercise[ctx.key]||(perExercise[ctx.key]={level:1,steps});
    state.steps=steps;

    if(reason==="wrong"){
      state.level=Math.max(1,Math.min(state.level||1,2));
      p.querySelector(".v173-diagnosis").textContent=diagnosis(ctx,userValue,errorType);
    }else{
      p.querySelector(".v173-diagnosis").textContent=
        `Работаем только с этим примером: ${strip(ctx.exercise.q)}`;
    }

    const holder=p.querySelector(".v173-steps");
    holder.innerHTML=steps.map((s,i)=>{
      const visible=i<state.level && i<3; // ответ не раскрываем автоматически
      const answer=i===3;
      return `<div class="v173-step ${visible?"show":""} ${answer?"answer-step":""}" data-step="${i+1}">
        <b>${answer?"✅ Ответ":`Шаг ${i+1}`}</b><span>${s.replace(/^Ответ(?: для самопроверки)?:\s*/i,"")}</span>
      </div>`;
    }).join("");

    p.querySelector(".v173-next").disabled=state.level>=3;
    p.querySelector(".v173-next").textContent=state.level>=3?"✓ Все шаги открыты":"👣 Следующий шаг";
    p.classList.add("show");

    // Scroll only the exercise helper, never Alfi's menu.
    setTimeout(()=>p.scrollIntoView({behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth",block:"nearest"}),40);
  }

  function revealNext(ctx){
    const state=perExercise[ctx.key]||(perExercise[ctx.key]={level:1,steps:buildSteps(ctx)});
    state.level=Math.min(3,(state.level||1)+1);
    render(ctx,{reason:"manual"});
  }

  function revealAnswer(ctx){
    const p=panel(ctx);
    const state=perExercise[ctx.key]||(perExercise[ctx.key]={level:3,steps:buildSteps(ctx)});
    state.level=3;
    render(ctx,{reason:"manual"});
    p.querySelector('[data-step="4"]')?.classList.add("show");
    p.querySelector(".v173-answer").textContent="✅ Ответ показан";
    p.querySelector(".v173-answer").disabled=true;
  }

  function toggleWhy(ctx){
    const p=panel(ctx),box=p.querySelector(".v173-why-box");
    if(box.classList.contains("show")){box.classList.remove("show");return}
    const why=strip(ctx.lesson.why)||strip(ctx.lesson.remember)||lessonRule(ctx);
    box.textContent=`Почему: ${why}`;
    box.classList.add("show");
  }

  function checkWork(ctx){
    const p=panel(ctx),ta=p.querySelector(".v173-work-box textarea"),out=p.querySelector(".v173-work-result");
    const raw=strip(ta.value);
    if(!raw){
      out.textContent="Напиши хотя бы один промежуточный шаг.";
      out.className="v173-work-result warn show";
      return;
    }

    const candidate=raw.includes("=")?raw.split("=").at(-1).trim():raw;
    let cls=null;
    try{cls=v16Classify(ctx,candidate)}catch(e){}
    const hint=safeHint(ctx);

    if(cls?.correct){
      out.textContent="✅ Этот ход приводит к правильному итоговому ответу.";
      out.className="v173-work-result good show";
      return;
    }

    // We don't pretend a local rule engine can prove arbitrary algebra strings.
    out.textContent=`Я вижу шаг «${raw}». Сверь его с конкретной опорой этого задания: ${hint} Если это последний шаг, нажми обычную «Проверить» — курс сравнит итог точно.`;
    out.className="v173-work-result warn show";
  }

  window.v173OpenInline=function(ctx,opts={}){
    if(!ctx?.box)return;
    if(opts.reason==="wrong"){
      const fb=ctx.box.querySelector(".feedback");
      if(fb&&fb.classList.contains("bad")){
        fb.textContent="Пока не так. Ниже Альфи показал конкретный первый шаг именно для этого задания.";
      }
    }
    render(ctx,opts);
  };

  function ensureAlfiShortcut(){
    const actions=document.querySelector("#v15Assistant .v15-actions");
    if(!actions||actions.querySelector(".v173-alfi-shortcut"))return;
    const b=document.createElement("button");
    b.type="button";
    b.className="v15-action v173-alfi-shortcut";
    b.textContent="🧠 Разобрать текущее";
    b.title="Открыть разбор прямо под последним активным заданием";
    b.addEventListener("click",()=>{
      let ctx=null;
      try{ctx=v16CurrentContext()}catch(e){}
      if(ctx){
        render(ctx,{reason:"manual"});
        try{v15Close?.()}catch(e){}
      }else{
        try{v15Chip?.("Сначала выбери задание в уроке") }catch(e){}
      }
    });
    actions.appendChild(b);
  }

  // Replace exercise button label after v16 created it.
  function relabel(){
    document.querySelectorAll(".v16-tutor-btn").forEach(b=>{
      b.innerHTML="🤖 Разобрать с Альфи";
      b.title="Показать конкретный разбор прямо под этим заданием";
    });
  }

  const content=document.querySelector("#content");
  if(content)new MutationObserver(()=>setTimeout(relabel,30)).observe(content,{childList:true,subtree:true});
  relabel();
  ensureAlfiShortcut();
  setTimeout(ensureAlfiShortcut,250);
  setTimeout(ensureAlfiShortcut,900);

  window.AlfiSmartTutor={
    version:VERSION,
    steps:ctx=>buildSteps(ctx),
    open:window.v173OpenInline
  };
})();
