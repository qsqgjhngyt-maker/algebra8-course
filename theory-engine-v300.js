(() => {
  "use strict";

  const VERSION="3.0.0-alpha.4.5.1";
  const authored=window.KitsuneTheoryContent||{};
  const baseOpen=window.openLesson;
  if(typeof baseOpen!=="function")return;

  function schoolText(s){
    return window.KitsuneSchoolNotation?.text?.(s)
      ?? String(s??"").replace(/<[^>]+>/g," ").replace(/\u00F7/g,":").replace(/\u00D7/g,"·").replace(/\s+/g," ").trim();
  }
  function esc(s){
    if(window.KitsuneSchoolNotation?.html)return window.KitsuneSchoolNotation.html(s);
    return schoolText(s).replace(/[&<>"]/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[m]));
  }
  function arr(v){return Array.isArray(v)?v:[]}
  function chapterFor(id){
    try{return chapters.find(ch=>ch.topics.some(t=>t.id===id))||null}catch{return null}
  }
  function topicFor(id){
    const ch=chapterFor(id);
    return ch?.topics?.find(t=>t.id===id)||null;
  }
  function lessonFor(id){
    try{return lessonData?.[id]||null}catch{return null}
  }
  function examplesOf(d){
    if(Array.isArray(d?.examples)&&d.examples.length)return d.examples;
    if(d?.example)return [d.example];
    return [];
  }

  function generatedArticle(id){
    const d=lessonFor(id);
    const ch=chapterFor(id);
    const tp=topicFor(id);
    if(!d||!tp)return null;

    const levels=d.levels||{};
    const simple=schoolText(levels.simple||d.lead||`Тема «${tp.title}» требует сначала понять смысл правила, а уже затем применять его в вычислениях.`);
    const school=schoolText(levels.school||simple);
    const deep=schoolText(levels.deep||school);
    const examples=examplesOf(d).map(ex=>({
      ...ex,
      task:schoolText(ex?.task||""),
      steps:arr(ex?.steps).map(schoolText)
    }));
    const summary=(arr(d.summary).length?arr(d.summary):[d.remember,d.why].filter(Boolean)).map(schoolText);
    const goals=arr(d.goals).map(schoolText);
    const whyText=schoolText(d.why||"");
    const formulaText=schoolText(d.formula||d.remember||"");
    const rememberText=schoolText(d.remember||"");
    const mistakeText=schoolText(d.mistake||"");
    const leadText=schoolText(d.lead||"");

    const sections=[
      {
        title:"1. Смысл темы",
        body:`${simple} В этой теме важно видеть не только отдельное действие, но и общую структуру записи. Перед вычислением полезно назвать своими словами, что дано, что требуется получить и какое свойство связывает эти два состояния.`
      },
      {
        title:"2. Как это объясняют в школе",
        body:`${school} Не старайся выполнять несколько преобразований одновременно. Один понятный шаг почти всегда надёжнее короткой, но непонятной цепочки.`
      },
      {
        title:"3. Почему правило работает",
        body:`${deep} ${whyText||"Каждое допустимое преобразование опирается на уже известное свойство чисел, выражений, уравнений или функций. Поэтому хороший способ проверить себя — уметь назвать это свойство словами."}`
      },
      {
        title:"4. Ключевая схема",
        body:`${formulaText||"Сначала определи тип задачи, затем выбери подходящее правило, выполни преобразование и проверь результат."} ${rememberText?`Главное, что нужно удержать в памяти: ${rememberText}`:""}`
      },
      {
        title:"5. Рабочий алгоритм",
        body:"Сначала определи тип задачи и ограничения. Затем выбери одно действие, выполни его аккуратно и проверь, что смысл исходной записи сохранился. После получения ответа сделай обратную проверку: подстановку, обратное действие, оценку величины или чтение графика — в зависимости от темы."
      }
    ];

    if(examples.length){
      sections.push({
        title:"6. Примеры по шагам",
        body:examples.slice(0,2).map((ex,i)=>{
          const steps=arr(ex.steps).map((s,j)=>`${j+1}) ${s}`).join(" ");
          return `Пример ${i+1}. ${ex.task||"Разберём применение правила."} ${steps}`;
        }).join(" ")
      });
    }else{
      sections.push({
        title:"6. Как читать пример",
        body:"Когда смотришь готовое решение, не переписывай его механически. Перед каждым новым шагом попробуй предсказать, что будет сделано дальше, а затем сравни со способом в уроке. Так готовый пример превращается в тренировку мышления."
      });
    }

    sections.push(
      {
        title:"7. Типичная ошибка",
        body:`${mistakeText||"Самая частая ошибка — применить знакомое правило автоматически, не проверив условия его применения."} После решения отдельно проверь самый опасный переход: знак, знаменатель, корень, степень, скобки, коэффициент или границу промежутка.`
      },
      {
        title:"8. Как проверить себя",
        body:"Попробуй закрыть формулу и объяснить тему своими словами за одну минуту. Если можешь назвать правило, показать один пример и предупредить хотя бы об одной ошибке, значит теория уже начинает становиться навыком."
      },
      {
        title:"9. Связь с главой",
        body:`Эта тема входит в главу «${ch?.title||"Алгебра 8"}». Она нужна не сама по себе: следующие уроки используют её как уже знакомый инструмент. Поэтому лучше сейчас понять логику, чем потом несколько раз возвращаться к механически выученной формуле.`
      }
    );

    return {
      title:`${tp.title} — полная теория`,
      lead:leadText||`Спокойно разберём тему «${tp.title}»: смысл, правило, логику, примеры и типичные ошибки.`,
      sections,
      summary:summary.length?summary:[
        "понимай назначение каждого шага",
        "не применяй правило без проверки условий",
        "после решения обязательно проверь результат"
      ],
      voice:[
        d.voice,
        `Полная теория по теме ${tp.title}.`,
        simple,
        school,
        deep,
        rememberText?`Запомни: ${rememberText}`:"",
        mistakeText?`Частая ошибка: ${mistakeText}`:"",
        goals.length?`После урока важно уметь: ${goals.join(", ")}.`:"",
        summary.length?`Итог: ${summary.join(". ")}.`:""
      ].filter(Boolean).join(" ")
    };
  }

  function articleFor(id){
    return authored[`grade8:${id}`]||generatedArticle(id);
  }

  function speak(text){
    text=window.KitsuneSchoolNotation?.speech?.(text) ?? schoolText(text);
    if(!text)return;
    try{
      if(typeof window.v151Speak==="function"){
        window.v151Speak(text,{state:"explain",force:true});
        return;
      }
    }catch{}
    try{
      if("speechSynthesis" in window){
        speechSynthesis.cancel();
        const u=new SpeechSynthesisUtterance(text);
        u.lang="ru-RU";
        speechSynthesis.speak(u);
      }
    }catch{}
  }

  function stop(){
    try{speechSynthesis.cancel()}catch{}
    try{window.v151StopSpeaking?.()}catch{}
  }

  function inject(id){
    const a=articleFor(id);
    if(!a)return;
    const panel=document.querySelector(".lesson-panel");
    if(!panel||panel.querySelector("#theoryFullV300"))return;

    const anchor=panel.querySelector(".formula-card")?.nextElementSibling||panel.querySelector("#example");
    const details=document.createElement("details");
    details.id="theoryFullV300";
    details.className="theory-full reveal";
    details.innerHTML=`
      <summary><span>📚 Полная теория — прочитать спокойно</span><span>⌄</span></summary>
      <div class="theory-actions">
        <button type="button" class="primary" id="theorySpeakV300">🦊 Kitsune расскажет тему</button>
        <button type="button" class="secondary" id="theoryStopV300">⏹ Остановить</button>
      </div>
      <p class="lead">${esc(a.lead)}</p>
      ${arr(a.sections).map(s=>`<section class="theory-section"><h4>${esc(s.title)}</h4><p>${esc(s.body)}</p></section>`).join("")}
      <div class="theory-summary"><b>Главное</b><ul>${arr(a.summary).map(x=>`<li>${esc(x)}</li>`).join("")}</ul></div>`;

    if(anchor)panel.insertBefore(details,anchor);else panel.appendChild(details);

    details.querySelector("#theorySpeakV300")?.addEventListener("click",()=>{
      const text=a.voice||[
        a.lead,
        ...arr(a.sections).flatMap(s=>[s.title,s.body]),
        ...arr(a.summary)
      ].filter(Boolean).join(". ");
      speak(text);
    });
    details.querySelector("#theoryStopV300")?.addEventListener("click",stop);
  }

  window.openLesson=function(id,...args){
    const out=baseOpen.call(this,id,...args);
    setTimeout(()=>inject(id),0);
    return out;
  };

  window.KitsuneTheoryEngineV300={
    version:VERSION,
    inject,
    articleFor
  };
})();