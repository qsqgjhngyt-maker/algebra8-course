/* Алгебра 8 · Глава I · v0.2.0
   Расширение поверх утверждённого интерфейса v0.1.3 */

state.solved = JSON.parse(localStorage.getItem("a8_solved")||"{}");
state.ch1TestBest = Number(localStorage.getItem("a8_ch1_test_best")||0);
state.ch1ControlBest = Number(localStorage.getItem("a8_ch1_control_best")||0);
state.lastActive = localStorage.getItem("a8_last_active")||"";

function saveChapterState(){
  save();
  localStorage.setItem("a8_solved",JSON.stringify(state.solved));
  localStorage.setItem("a8_ch1_test_best",state.ch1TestBest);
  localStorage.setItem("a8_ch1_control_best",state.ch1ControlBest);
  localStorage.setItem("a8_last_active",state.lastActive);
}
function ch1DayWord(n){const m=n%100;if(m>=11&&m<=14)return"дней";const d=n%10;return d===1?"день":d>=2&&d<=4?"дня":"дней"}
function ch1TouchActivity(){
  const now=new Date(),today=new Date(now.getFullYear(),now.getMonth(),now.getDate());
  const key=[today.getFullYear(),String(today.getMonth()+1).padStart(2,"0"),String(today.getDate()).padStart(2,"0")].join("-");
  if(state.lastActive!==key){
    if(state.lastActive){const prev=new Date(state.lastActive+"T00:00:00");const diff=Math.round((today-prev)/86400000);state.streak=diff===1?Math.max(1,state.streak+1):1}else state.streak=1;
    state.lastActive=key;saveChapterState();
  }
  const badge=document.querySelector("#streakBadge");if(badge)badge.textContent=`🔥 ${state.streak} ${ch1DayWord(state.streak)}`;
}
function ch1AnswerMatches(value,accepted){const arr=Array.isArray(accepted)?accepted:[accepted];return arr.some(a=>normalize(value).replace(/,/g,".")===normalize(a).replace(/,/g,"."))}
function ch1SolvedCount(id){const d=lessonData[id];if(!d)return 0;let n=0;d.exercises.forEach((_,i)=>{if(state.solved[`${id}-${i}`])n++});if(state.solved[`${id}-challenge`])n++;return n}
function ch1PracticeTotal(id){const d=lessonData[id];return d?d.exercises.length+1:0}
function ch1Done(){return chapters[0].topics.filter(t=>state.completed.includes(t.id)).length}
function ch1RecordMistake(lesson,question,answer){state.mistakes.push({lesson,question,answer,ts:Date.now()});state.mistakes=state.mistakes.slice(-80)}

const chapterEnhance={
"1-1":{
 goals:["узнавать рациональные выражения","находить запрещённые значения","безопасно подставлять числа"],
 formula:`Знаменатель ≠ 0 → решаем это условие и исключаем найденные значения.`,
 quick:{q:"Для дроби 4/(x−7) какое число запрещено?",options:["0","4","7"],correct:2,good:"Верно: при x = 7 знаменатель становится нулём.",bad:"Посмотри именно на знаменатель x − 7."},
 extraExample:{task:`Найди ОДЗ для <span class="math">(2x+1)/(x²−9)</span>.`,steps:[`Разложим знаменатель: <span class="math">x²−9=(x−3)(x+3)</span>.`,`Он равен нулю при <span class="math">x=3</span> и <span class="math">x=−3</span>.`,`Ответ: <span class="math">x ≠ ±3</span>.`]},
 extraExercises:[
  {q:`Какое значение запрещено для <span class="math">3/(2x−6)</span>?`,a:["3"],hint:"Реши 2x − 6 = 0."},
  {q:`Запрещённые значения для <span class="math">1/(x(x+5))</span>. Введи через запятую.`,a:["0,-5","-5,0"],hint:"Произведение равно нулю, если хотя бы один множитель равен нулю."}
 ],
 challenge:{q:`Вычисли <span class="math">(x+2)/(x−1)</span> при x = 3.`,a:["5/2","2.5","2,5"],hint:"Сначала проверь знаменатель, затем подставь x=3."},
 summary:["знаменатель всегда проверяем на ноль","запрещённые значения — часть условия","после сокращения исходные ограничения сохраняются"]
},
"1-2":{
 goals:["видеть общий множитель","сокращать без ошибок","сохранять исходное ОДЗ"],
 formula:`(a·c)/(b·c) = a/b, если b ≠ 0 и c ≠ 0.`,
 quick:{q:"Что можно сократить в 3x(x+2)/(6x)?",options:["x и число 3","x внутри суммы x+2","знаменатель целиком"],correct:0,good:"Да: x — общий множитель, 3 и 6 тоже сокращаются.",bad:"Сокращать можно только общие множители."},
 extraExample:{task:`Сократи <span class="math">(x²−16)/(x−4)</span>.`,steps:[`<span class="math">x²−16=(x−4)(x+4)</span>.`,`Сокращаем общий множитель <span class="math">x−4</span>.`,`Получаем <span class="math">x+4</span>, но исходное ограничение <span class="math">x ≠ 4</span> сохраняется.`]},
 extraExercises:[
  {q:`Сократи <span class="math">15a²b/(20ab²)</span>.`,a:["3a/(4b)","3a/4b"],hint:"15/20=3/4; a²/a=a; b/b²=1/b."},
  {q:`Сократи <span class="math">(x²+5x)/x</span>.`,a:["x+5"],hint:"Вынеси x: x(x+5)/x."}
 ],
 challenge:{q:`Сократи <span class="math">(x²−25)/(x²+10x+25)</span>.`,a:["(x-5)/(x+5)","(x−5)/(x+5)"],hint:"Числитель — разность квадратов, знаменатель — (x+5)²."},
 summary:["сначала разложи на множители","сокращай только общий множитель","не забывай ограничения исходной дроби"]
},
"1-3":{
 goals:["складывать дроби с общим знаменателем","правильно раскрывать минус","упрощать результат"],
 formula:`a/c + b/c = (a+b)/c;   a/c − b/c = (a−b)/c.`,
 quick:{q:"2/11 + 5/11 равно…",options:["7/22","7/11","10/11"],correct:1,good:"Верно: знаменатель остаётся 11.",bad:"Размер доли не меняется — знаменатель прежний."},
 extraExample:{task:`Упрости <span class="math">(2a−5)/(a+1) − (a+2)/(a+1)</span>.`,steps:[`Объединяем: <span class="math">[(2a−5)−(a+2)]/(a+1)</span>.`,`Раскрываем скобки: <span class="math">2a−5−a−2=a−7</span>.`,`Ответ: <span class="math">(a−7)/(a+1)</span>, a ≠ −1.`]},
 extraExercises:[
  {q:`Вычисли <span class="math">8/13 − 3/13</span>.`,a:["5/13"],hint:"13 остаётся знаменателем."},
  {q:`Упрости <span class="math">(3x+1)/b − (x−2)/b</span>.`,a:["(2x+3)/b"],hint:"3x+1−x+2=2x+3."}
 ],
 challenge:{q:`Упрости <span class="math">(x²−1)/(x−1) − 2/(x−1)</span>. Введи одной дробью.`,a:["(x^2-3)/(x-1)","(x²-3)/(x-1)"],hint:"Числитель: x²−1−2=x²−3."},
 summary:["одинаковый знаменатель сохраняем","при вычитании ставь скобки","после действия проверь сокращение"]
},
"1-4":{
 goals:["находить общий знаменатель","подбирать дополнительные множители","упрощать итоговую дробь"],
 formula:`a/b + c/d = (ad+bc)/(bd) — универсальная схема, но иногда общий знаменатель проще.`,
 quick:{q:"Общий знаменатель для 1/(2x) и 1/(3x):",options:["5x","6x","6x²"],correct:1,good:"Да: 6x делится и на 2x, и на 3x.",bad:"Нужен знаменатель, кратный обоим исходным."},
 extraExample:{task:`Сложи <span class="math">2/x + 3/(2x)</span>.`,steps:[`Общий знаменатель: <span class="math">2x</span>.`,`<span class="math">2/x=4/(2x)</span>.`,`Получаем <span class="math">7/(2x)</span>.`]},
 extraExercises:[
  {q:`Упрости <span class="math">1/a + 1/(2a)</span>.`,a:["3/(2a)","3/2a"],hint:"1/a = 2/(2a)."},
  {q:`Упрости <span class="math">2/(3x) + 1/x</span>.`,a:["5/(3x)","5/3x"],hint:"1/x = 3/(3x)."}
 ],
 challenge:{q:`Упрости <span class="math">2/(x−1) − 1/(x+1)</span>.`,a:["(x+3)/(x^2-1)","(x+3)/(x²-1)","(x+3)/((x-1)(x+1))"],hint:"Общий знаменатель (x−1)(x+1); числитель 2(x+1)−(x−1)."},
 summary:["сначала общий знаменатель","домножаем дробь целиком","после объединения упрощаем"]
},
"1-5":{
 goals:["умножать дроби","сокращать до умножения","возводить дробь в степень"],
 formula:`(a/b)·(c/d)=ac/bd;   (a/b)^n=a^n/b^n.`,
 quick:{q:"(3/5)² равно…",options:["6/10","9/25","9/5"],correct:1,good:"Да: квадрат относится и к числителю, и к знаменателю.",bad:"Возведи в квадрат обе части дроби."},
 extraExample:{task:`Упрости <span class="math">(3x/(4y))·(8y²/(9x))</span>.`,steps:[`Сокращаем x и одну степень y.`,`Числа 3·8/(4·9) сокращаются до 2/3.`,`Ответ: <span class="math">2y/3</span>.`]},
 extraExercises:[
  {q:`Вычисли <span class="math">(5/6)·(9/10)</span>.`,a:["3/4"],hint:"Сократи 5 с 10 и 9 с 6."},
  {q:`Вычисли <span class="math">(3/4)³</span>.`,a:["27/64"],hint:"3³/4³."}
 ],
 challenge:{q:`Упрости <span class="math">(2a/(3b))² · 9b²/(4a)</span>.`,a:["a"],hint:"Сначала возведи первую дробь в квадрат, затем сокращай."},
 summary:["умножаем верх на верх и низ на низ","до умножения удобно сокращать","степень относится ко всей дроби"]
},
"1-6":{
 goals:["делить дроби","находить обратную дробь","не терять ограничения"],
 formula:`a/b : c/d = a/b · d/c.`,
 quick:{q:"2/3 : 5/7 превращается в…",options:["2/3 · 7/5","3/2 · 7/5","2/3 · 5/7"],correct:0,good:"Верно: переворачиваем только вторую дробь.",bad:"Первая дробь остаётся как есть."},
 extraExample:{task:`Упрости <span class="math">(x/3):(2x/9)</span>.`,steps:[`Заменяем деление: <span class="math">x/3 · 9/(2x)</span>.`,`Сокращаем x и 9/3.`,`Ответ: <span class="math">3/2</span>, x ≠ 0.`]},
 extraExercises:[
  {q:`Вычисли <span class="math">(3/5):(9/10)</span>.`,a:["2/3"],hint:"3/5 · 10/9."},
  {q:`Вычисли <span class="math">(4/9):2</span>.`,a:["2/9"],hint:"2=2/1, значит умножаем на 1/2."}
 ],
 challenge:{q:`Упрости <span class="math">[(a²−b²)/(a+b)] : [(a−b)/2]</span>.`,a:["2"],hint:"a²−b²=(a−b)(a+b)."},
 summary:["деление заменяем умножением","обратной делаем вторую дробь","после замены сокращаем"]
},
"1-7":{
 goals:["строить план решения","работать с несколькими действиями","проверять результат"],
 formula:`ОДЗ → разложение → общий знаменатель → действия → сокращение → проверка.`,
 quick:{q:"Что лучше сделать первым в сложном дробном выражении?",options:["Сразу всё перемножить","Зафиксировать ОДЗ и структуру","Подставить случайное x"],correct:1,good:"Да: сначала ограничения и план.",bad:"Сложное выражение выигрывает от чёткого алгоритма."},
 extraExample:{task:`Вычисли <span class="math">(1/x − 1/(x+1))·x(x+1)</span>.`,steps:[`В скобках: <span class="math">[(x+1)−x]/[x(x+1)]</span>.`,`Это <span class="math">1/[x(x+1)]</span>.`,`После умножения получаем <span class="math">1</span>, x ≠ 0, −1.`]},
 extraExercises:[
  {q:`Упрости <span class="math">x/(x−1) − 1/(x−1)</span>.`,a:["1"],hint:"Числитель x−1."},
  {q:`Вычисли <span class="math">(3/4 − 1/4):(1/2)</span>.`,a:["1"],hint:"В скобках получится 1/2."}
 ],
 challenge:{q:`Вычисли <span class="math">(1/2 + 1/3) : (5/6)</span>.`,a:["1"],hint:"Первая скобка сама равна 5/6."},
 summary:["фиксируй ОДЗ исходной записи","решай по одному слою","в конце проверь сокращение"]
},
"1-8":{
 goals:["вычислять y по x","понимать гиперболу","определять четверти по знаку k"],
 formula:`y=k/x, x ≠ 0. Если известны x и y, то k=x·y.`,
 quick:{q:"Если k < 0, где лежат ветви гиперболы?",options:["I и III","II и IV","только I"],correct:1,good:"Верно: x и y имеют разные знаки.",bad:"При отрицательном k произведение x·y отрицательно."},
 extraExample:{task:`Точка (4;3) лежит на <span class="math">y=k/x</span>. Найди k.`,steps:[`Используем <span class="math">k=x·y</span>.`,`<span class="math">k=4·3</span>.`,`Получаем <span class="math">k=12</span>.`]},
 extraExercises:[
  {q:`Для <span class="math">y=−8/x</span> найди y при x=4.`,a:["-2"],hint:"−8/4."},
  {q:`Точка (2;5) лежит на <span class="math">y=k/x</span>. Найди k.`,a:["10"],hint:"k=x·y."}
 ],
 challenge:{q:`На графике <span class="math">y=k/x</span> есть точка (−3;4). Найди k.`,a:["-12"],hint:"k=(−3)·4."},
 summary:["x=0 запрещён","k>0 → I и III; k<0 → II и IV","по точке графика k=x·y"],interactive:"hyperbola"
},
"1-9":{
 goals:["разделять сумму в числителе","выделять целую часть","видеть обратную связь со сложением"],
 formula:`(a+b)/c = a/c + b/c. Например: (x+6)/x = 1 + 6/x.`,
 quick:{q:"Как правильно разложить (a+b)/c?",options:["a/c + b/c","a/c + b","a/(b+c)"],correct:0,good:"Да: каждый член числителя делится на c.",bad:"Знаменатель c относится к каждому слагаемому числителя."},
 extraExample:{task:`Представь <span class="math">(2x−3)/x</span> в виде суммы.`,steps:[`<span class="math">2x/x − 3/x</span>.`,`<span class="math">2x/x=2</span>.`,`Ответ: <span class="math">2−3/x</span>.`]},
 extraExercises:[
  {q:`Представь <span class="math">(3x+2)/x</span> как <span class="math">3 + ...</span>.`,a:["2/x"],hint:"3x/x=3."},
  {q:`Представь <span class="math">(5x−1)/x</span> как <span class="math">5 + ...</span>.`,a:["-1/x","−1/x"],hint:"Останется (−1)/x."}
 ],
 challenge:{q:`Представь <span class="math">(3x+5)/(x−2)</span> в виде <span class="math">3 + ...</span>. Введи дробную часть.`,a:["11/(x-2)","11/(x−2)"],hint:"3(x−2)=3x−6; до 3x+5 не хватает 11."},
 summary:["сумму в числителе можно разделить","так удобно выделять целую часть","знаменатель по сумме не раскладывается"]
}
};

Object.entries(chapterEnhance).forEach(([id,e])=>{
  const d=lessonData[id];
  d.goals=e.goals;d.formula=e.formula;d.quick=e.quick;d.summary=e.summary;d.challenge=e.challenge;d.interactive=e.interactive||null;
  d.examples=[d.example,e.extraExample];
  d.exercises=[...d.exercises,...e.extraExercises];
});

const ch1Test=[
 {q:"Какое значение запрещено для 3/(x−5)?",opts:["−5","0","5","3"],ans:2,tag:"1-1",why:"При x=5 знаменатель равен нулю."},
 {q:"Сократи 12x²/(18x).",opts:["2x/3","2/3","3x/2","6x"],ans:0,tag:"1-2",why:"12/18=2/3 и x²/x=x."},
 {q:"2/7 + 3/7 =",opts:["5/14","5/7","6/7","1"],ans:1,tag:"1-3",why:"При одинаковом знаменателе складываем числители."},
 {q:"1/2 + 1/3 =",opts:["2/5","1/5","5/6","1"],ans:2,tag:"1-4",why:"3/6+2/6=5/6."},
 {q:"(3/4)·(8/9) =",opts:["24/36","2/3","3/2","8/12"],ans:1,tag:"1-5",why:"После сокращения получаем 2/3."},
 {q:"(2/3):(4/5) =",opts:["8/15","5/6","6/5","2/3"],ans:1,tag:"1-6",why:"2/3·5/4=5/6."},
 {q:"(1/2 + 1/6)·3 =",opts:["1","2","3/2","4"],ans:1,tag:"1-7",why:"1/2+1/6=2/3; 2/3·3=2."},
 {q:"Для y=12/x при x=4 значение y равно…",opts:["2","3","4","8"],ans:1,tag:"1-8",why:"12/4=3."},
 {q:"Если k>0 в y=k/x, ветви находятся…",opts:["I и III","II и IV","I и II","III и IV"],ans:0,tag:"1-8",why:"x и y имеют одинаковые знаки."},
 {q:"(x+5)/x можно представить как…",opts:["x+5/x","1+5/x","5+x/x²","1+x/5"],ans:1,tag:"1-9",why:"x/x+5/x=1+5/x."},
 {q:"После сокращения (x²−4)/(x−2)=x+2. Какое ограничение сохраняется?",opts:["x≠−2","x≠0","x≠2","нет ограничений"],ans:2,tag:"1-2",why:"Исходный знаменатель x−2, поэтому x=2 запрещён."},
 {q:"2/(x−1)+1/(x−1) =",opts:["3/(2x−2)","3/(x−1)","2/(x−1)²","3/x−1"],ans:1,tag:"1-3",why:"Знаменатель общий, числители 2+1=3."}
];
const ch1Control=[
 {q:`Какое x запрещено для <span class="math">7/(x−4)</span>?`,a:["4"],tag:"1-1",solution:"x−4=0 → x=4."},
 {q:`Сократи <span class="math">18x²/(24x)</span>.`,a:["3x/4"],tag:"1-2",solution:"18/24=3/4 и x²/x=x."},
 {q:`Вычисли <span class="math">5/12 + 1/4</span>.`,a:["2/3"],tag:"1-4",solution:"1/4=3/12; 8/12=2/3."},
 {q:`Вычисли <span class="math">(3/5)·(10/9)</span>.`,a:["2/3"],tag:"1-5",solution:"После сокращения 2/3."},
 {q:`Вычисли <span class="math">(4/7):(8/21)</span>.`,a:["3/2","1.5","1,5"],tag:"1-6",solution:"4/7·21/8=3/2."},
 {q:`На графике <span class="math">y=k/x</span> есть точка (3;5). Найди k.`,a:["15"],tag:"1-8",solution:"k=x·y=15."}
];

function ch1QuickHtml(id,q){return `<div class="exercise reveal"><h4>⚡ Проверка понимания</h4><p>${q.q}</p><div class="micro-check">${q.options.map((o,i)=>`<button onclick="ch1Quick('${id}',${i},this)">${o}</button>`).join("")}<span class="micro-result" id="ch1q-${id}"></span></div></div>`}
function ch1ExerciseHtml(id,i,e){const done=!!state.solved[`${id}-${i}`];return `<div class="exercise reveal" data-ex="${id}-${i}"><h4>${done?"✅ ":""}Задание ${i+1}</h4><p>${e.q}</p><div class="answer-row"><input id="ans-${id}-${i}" placeholder="Твой ответ" autocomplete="off"><button class="check-btn" onclick="ch1CheckAnswer('${id}',${i})">Проверить</button><button class="secondary" onclick="document.querySelector('#hint-${id}-${i}').classList.toggle('show')">💡 Подсказка</button></div><div class="hint" id="hint-${id}-${i}">${e.hint}</div><div class="feedback" id="fb-${id}-${i}">${done?"✅ Уже решено верно. Можно повторить ещё раз.":""}</div></div>`}
function ch1ChallengeHtml(id,e){const done=!!state.solved[`${id}-challenge`];return `<div class="exercise challenge-card reveal" data-ex="${id}-challenge"><h4>${done?"✅ ":""}🚀 Задание со звёздочкой</h4><p>${e.q}</p><div class="answer-row"><input id="ans-${id}-challenge" placeholder="Попробуй без спешки"><button class="check-btn" onclick="ch1CheckChallenge('${id}')">Проверить</button><button class="secondary" onclick="document.querySelector('#hint-${id}-challenge').classList.toggle('show')">💡 Подсказка</button></div><div class="hint" id="hint-${id}-challenge">${e.hint}</div><div class="feedback" id="fb-${id}-challenge">${done?"🌟 Это задание уже решено!":""}</div></div>`}
function ch1HyperbolaHtml(){return `<div class="graph-lab reveal"><div class="graph-head"><div><span class="eyebrow">Интерактив</span><h4>Двигай k и наблюдай за гиперболой</h4></div><span class="effects-chip">📱 работает пальцем</span></div><canvas id="hyperbolaCanvas" width="900" height="360"></canvas><div class="graph-controls"><input id="kSlider" type="range" min="-8" max="8" step="1" value="4"><div class="k-value">k = <span id="kValue">4</span></div></div><p class="trainer-tip" id="graphHint">k > 0 → ветви в I и III четвертях.</p></div>`}

lessonHtml=function(id,d){
 const simple=d.levels?.simple||d.simple||"",school=d.levels?.school||simple,deep=d.levels?.deep||simple;
 const solved=ch1SolvedCount(id),total=ch1PracticeTotal(id),idx=chapters[0].topics.findIndex(t=>t.id===id);
 return `<div class="lesson-layout"><article class="lesson-panel reveal"><span class="pill">Глава I · урок ${idx+1} из 9</span><h2>${d.title}</h2><p class="lead">${d.lead}</p><div class="chapter-progress-strip">${chapters[0].topics.map((t,i)=>`<span class="${state.completed.includes(t.id)?"done":i===idx?"current":""}"></span>`).join("")}</div>
 <div class="lesson-objectives">${d.goals.map((g,i)=>`<div class="objective"><b>${["🎯 Поймём","🧩 Научимся","✅ Закрепим"][i]}</b><small>${g}</small></div>`).join("")}</div>
 <h3 id="simple">🌱 Объяснение уровнями</h3><div class="level-switch"><button class="active" onclick="switchLevel(this,'simple')">Совсем просто</button><button onclick="switchLevel(this,'school')">Как в школе</button><button onclick="switchLevel(this,'deep')">Хочу понять глубже</button></div><div class="explain-pane active" data-pane="simple"><p>${simple}</p></div><div class="explain-pane" data-pane="school"><p>${school}</p></div><div class="explain-pane" data-pane="deep"><p>${deep}</p></div>
 <div class="formula-card"><strong>Ключевая схема</strong><div class="formula-main">${d.formula}</div></div><div class="callout good"><b>🧠 Запомни</b><br>${d.remember}</div><div class="callout"><b>🔍 Почему так?</b><br>${d.why}</div><div class="callout danger"><b>⚠️ Частая ошибка</b><br>${d.mistake}</div>${ch1QuickHtml(id,d.quick)}
 <h3 id="example">📘 Два примера по шагам</h3><div class="examples-stack">${d.examples.map((ex,i)=>`<div class="example-card"><span class="example-label">пример ${i+1}</span><h4>${ex.task}</h4><div class="steps">${ex.steps.map(s=>`<div class="step">${s}</div>`).join("")}</div></div>`).join("")}</div>${d.interactive==="hyperbola"?ch1HyperbolaHtml():""}
 <h3 id="practice">✍️ Самостоятельная практика</h3>${d.exercises.map((e,i)=>ch1ExerciseHtml(id,i,e)).join("")}${ch1ChallengeHtml(id,d.challenge)}
 <div class="lesson-summary"><b>✅ Итог урока</b><ul>${d.summary.map(s=>`<li>${s}</li>`).join("")}</ul></div><div class="callout warn"><b>💡 Если пока трудно</b><br>Вернись к уровню «Совсем просто», повтори первый пример и реши первые два задания. Тему не обязательно проходить за один заход.</div><button class="primary glow-btn" onclick="ch1FinishLesson('${id}')">✅ Я понял(а) эту тему</button></article>
 <aside class="lesson-nav reveal"><div class="lesson-mini"><b>Прогресс урока</b><small id="masteryText">${solved} из ${total} практик решено</small></div><div class="mastery-box"><div class="mastery-line"><span>Освоение</span><b id="masteryPercent">${Math.round(solved/total*100)||0}%</b></div><div class="progress-bar"><span id="masteryBar" style="width:${Math.round(solved/total*100)||0}%"></span></div></div><b style="display:block;margin-top:16px">Навигация</b><button class="ghost" onclick="document.querySelector('#simple').scrollIntoView()">🌱 Объяснение</button><button class="ghost" onclick="document.querySelector('#example').scrollIntoView()">📘 Примеры</button><button class="ghost" onclick="document.querySelector('#practice').scrollIntoView()">✍️ Практика</button><hr><button class="secondary" onclick="renderCourse()">← Карта курса</button><button class="ghost" onclick="window.print()">🖨️ Печать урока</button></aside></div>`;
};

openLesson=function(id){if(!lessonData[id])return;state.lastLesson=id;saveChapterState();setActive("");pageTitle.textContent=lessonData[id].title;content.innerHTML=lessonHtml(id,lessonData[id]);window.scrollTo(0,0);applyReveal();if(id==="1-8")setTimeout(ch1InitHyperbola,0)};window.openLesson=openLesson;
window.ch1Quick=(id,choice,btn)=>{const q=lessonData[id].quick,out=document.querySelector(`#ch1q-${id}`);btn.parentElement.querySelectorAll("button").forEach(b=>b.style.borderColor="");if(choice===q.correct){out.textContent="✅ "+q.good;out.style.color="var(--good)";btn.style.borderColor="var(--good)";ch1TouchActivity()}else{out.textContent="🙂 "+q.bad;out.style.color="var(--warn)";btn.style.borderColor="var(--warn)"}};
function ch1UpdateMastery(id){const s=ch1SolvedCount(id),t=ch1PracticeTotal(id),p=Math.round(s/t*100)||0;const a=document.querySelector("#masteryText"),b=document.querySelector("#masteryPercent"),c=document.querySelector("#masteryBar");if(a)a.textContent=`${s} из ${t} практик решено`;if(b)b.textContent=p+"%";if(c)c.style.width=p+"%"}
window.ch1CheckAnswer=(id,i)=>{const e=lessonData[id].exercises[i],input=document.querySelector(`#ans-${id}-${i}`),fb=document.querySelector(`#fb-${id}-${i}`),ok=ch1AnswerMatches(input.value,e.a);state.attempts++;if(ok){state.correct++;state.solved[`${id}-${i}`]=true;fb.className="feedback ok";fb.textContent="✅ Верно! Отлично.";const box=document.querySelector(`[data-ex="${id}-${i}"]`);if(box){box.classList.remove("success-flash");void box.offsetWidth;box.classList.add("success-flash");setTimeout(()=>box.classList.remove("success-flash"),900)}ch1TouchActivity();ch1UpdateMastery(id)}else{fb.className="feedback bad";fb.textContent="Пока не так. Попробуй ещё раз или открой подсказку.";ch1RecordMistake(id,e.q,input.value)}saveChapterState()};
window.ch1CheckChallenge=id=>{const e=lessonData[id].challenge,input=document.querySelector(`#ans-${id}-challenge`),fb=document.querySelector(`#fb-${id}-challenge`),ok=ch1AnswerMatches(input.value,e.a);state.attempts++;if(ok){state.correct++;state.solved[`${id}-challenge`]=true;fb.className="feedback ok";fb.textContent="🌟 Верно! Сложное задание покорено.";ch1TouchActivity();ch1UpdateMastery(id)}else{fb.className="feedback bad";fb.textContent="Пока не получилось. Подсказка даст направление.";ch1RecordMistake(id,e.q,input.value)}saveChapterState()};
window.ch1FinishLesson=id=>{if(!state.completed.includes(id))state.completed.push(id);const all=chapters[0].topics,idx=all.findIndex(t=>t.id===id);state.lastLesson=all[Math.min(idx+1,all.length-1)].id;ch1TouchActivity();saveChapterState();if(idx===all.length-1)renderChapterFinal("test");else openLesson(state.lastLesson)};

function ch1InitHyperbola(){
 const canvas=document.querySelector("#hyperbolaCanvas"),slider=document.querySelector("#kSlider");if(!canvas||!slider)return;
 const draw=()=>{let k=Number(slider.value);if(k===0){k=1;slider.value="1"}document.querySelector("#kValue").textContent=k;document.querySelector("#graphHint").textContent=k>0?"k > 0 → ветви в I и III четвертях. Попробуй отрицательное k.":"k < 0 → ветви во II и IV четвертях. x и y имеют разные знаки.";
  const ctx=canvas.getContext("2d"),w=canvas.clientWidth,h=canvas.clientHeight,dpr=Math.min(devicePixelRatio||1,2);canvas.width=w*dpr;canvas.height=h*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);const cx=w/2,cy=h/2,scale=Math.min(w/22,h/14);const st=getComputedStyle(document.body);ctx.strokeStyle=st.getPropertyValue("--line").trim()||"#ccd";ctx.lineWidth=1;
  for(let x=cx%scale;x<w;x+=scale){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke()}for(let y=cy%scale;y<h;y+=scale){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke()}ctx.strokeStyle=st.getPropertyValue("--muted").trim()||"#667";ctx.lineWidth=1.6;ctx.beginPath();ctx.moveTo(0,cy);ctx.lineTo(w,cy);ctx.moveTo(cx,0);ctx.lineTo(cx,h);ctx.stroke();ctx.strokeStyle=st.getPropertyValue("--primary").trim()||"#2563eb";ctx.lineWidth=2.6;
  const branch=(from,to,step)=>{ctx.beginPath();let first=true;for(let xv=from;step>0?xv<=to:xv>=to;xv+=step){if(Math.abs(xv)<.08)continue;const yv=k/xv,px=cx+xv*scale,py=cy-yv*scale;if(py<-30||py>h+30)continue;if(first){ctx.moveTo(px,py);first=false}else ctx.lineTo(px,py)}ctx.stroke()};branch(-10,-.12,.04);branch(.12,10,.04)
 };
 slider.addEventListener("input",draw);draw();
}

function ch1FinishCard(){const ready=ch1Done()===9;return `<section class="chapter-finish-card reveal"><span class="eyebrow">Финиш главы I</span><h3>${ready?"Все 9 уроков пройдены — проверяем себя 🎉":"Итоговая проверка уже доступна"}</h3><p class="muted">Диагностика найдёт слабые темы, мини-контрольная проверит самостоятельное решение, а шпаргалка соберёт правила в одном месте.</p><div class="chapter-progress-strip">${chapters[0].topics.map(t=>`<span class="${state.completed.includes(t.id)?"done":""}" title="${t.title}"></span>`).join("")}</div><div class="finish-actions"><button class="primary glow-btn" onclick="renderChapterFinal('test')">🏁 Диагностика</button><button class="secondary" onclick="renderChapterFinal('control')">📝 Мини-контрольная</button><button class="secondary" onclick="renderChapterFinal('cheat')">📌 Шпаргалка</button></div></section>`}

renderHome=function(){
 setActive("home");pageTitle.textContent="Алгебра 8";content.innerHTML=document.querySelector("#homeTpl").innerHTML;const p=Math.round(state.completed.length/TOTAL_TOPICS*100);document.querySelector("#heroPercent").textContent=p+"%";document.querySelector("#heroRing").style.setProperty("--p",p);document.querySelector("#heroStats").textContent=`${state.completed.length} из ${TOTAL_TOPICS} тем`;document.querySelector("#doneCount").textContent=state.completed.length;document.querySelector("#accuracyValue").textContent=state.attempts?Math.round(state.correct/state.attempts*100)+"%":"—";document.querySelector("#mistakesValue").textContent=state.mistakes.length;
 const last=chapters.flatMap(c=>c.topics).find(t=>t.id===state.lastLesson)||chapters[0].topics[0];document.querySelector("#continueCard").innerHTML=`<div class="home-continue reveal"><span class="topic-number">ПРОДОЛЖИТЬ</span><h4>${last.title}</h4><p>${last.desc||"Следующая тема курса."}</p><div class="card-footer"><span class="effects-chip">✨ ${ch1Done()}/9 тем главы I пройдено</span><button class="primary glow-btn" onclick="openLesson('${last.id}')">Открыть →</button></div></div>`;
 document.querySelector("#homeTopics").innerHTML=chapters[0].topics.map((t,i)=>{const done=state.completed.includes(t.id),s=ch1SolvedCount(t.id),tot=ch1PracticeTotal(t.id);return `<article class="card reveal"><span class="topic-number">ТЕМА ${i+1}</span><h4>${done?"✅ ":""}${t.title}</h4><p>${t.desc||""}</p><div class="progress-bar"><span style="width:${Math.round(s/tot*100)||0}%"></span></div><div class="card-footer"><span class="muted">${s}/${tot} практик · ${done?"пройдено":"8–18 минут"}</span><button class="secondary" onclick="openLesson('${t.id}')">${done?"Повторить":"Начать"}</button></div></article>`}).join("");
 const sec=document.querySelector("#homeTopics")?.closest(".section");if(sec)sec.insertAdjacentHTML("afterend",ch1FinishCard());applyReveal();
};

renderCourse=function(){setActive("course");pageTitle.textContent="Карта курса";content.innerHTML=`<section class="section reveal" style="margin-top:0"><div class="section-head"><div><span class="eyebrow">Полная программа</span><h3>6 глав · ${TOTAL_TOPICS} тем</h3></div></div><div class="course-grid">${chapters.map(ch=>`<section class="chapter-card reveal"><div class="chapter-head"><div><span class="eyebrow">Глава ${ch.id}</span><h3>${ch.title}</h3></div><span class="${ch.ready?"status-chip":"chapter-locked"}">${ch.ready?"полностью готова · v0.2":"следующий этап"}</span></div><div class="chapter-body">${ch.topics.map((t,i)=>`<div class="topic-row ${ch.ready?"":"locked"}"><div class="topic-number">${String(i+1).padStart(2,"0")}</div><div><b>${state.completed.includes(t.id)?"✅ ":""}${t.title}</b>${ch.ready?`<small class="muted" style="display:block;margin-top:3px">${ch1SolvedCount(t.id)}/${ch1PracticeTotal(t.id)} практик решено</small>`:""}</div>${ch.ready?`<button onclick="openLesson('${t.id}')">Открыть</button>`:`<span>🔒</span>`}</div>`).join("")}${ch.id===1?`<div style="padding:18px"><button class="primary glow-btn" onclick="renderChapterFinal('test')">🏁 Итог главы I</button></div>`:""}</div></section>`).join("")}</div></section>`;applyReveal()};window.renderCourse=renderCourse;

let ch1TrainerMode="same";const ch1Trainer={correct:0,total:0,streak:0,current:null};
function ch1Gcd(a,b){a=Math.abs(a);b=Math.abs(b);while(b){[a,b]=[b,a%b]}return a||1}function ch1Frac(n,d){const g=ch1Gcd(n,d);n/=g;d/=g;if(d<0){n=-n;d=-d}return d===1?String(n):`${n}/${d}`}
function ch1GenerateTrainer(){let m=ch1TrainerMode;if(m==="mixed")m=["same","reduce","multiply","divide"][Math.floor(Math.random()*4)];if(m==="same"){const d=[5,6,7,8,9,10,12][Math.floor(Math.random()*7)],a=1+Math.floor(Math.random()*(d-1)),b=1+Math.floor(Math.random()*(d-1));return{q:`${a}/${d} + ${b}/${d} = ?`,a:ch1Frac(a+b,d),tip:`Знаменатель ${d} остаётся прежним.`}}if(m==="reduce"){const n=1+Math.floor(Math.random()*5),d=n+1+Math.floor(Math.random()*5),k=2+Math.floor(Math.random()*5);return{q:`Сократи ${n*k}/${d*k}`,a:ch1Frac(n,d),tip:"Раздели числитель и знаменатель на общий множитель."}}const a=1+Math.floor(Math.random()*5),b=2+Math.floor(Math.random()*6),c=1+Math.floor(Math.random()*5),d=2+Math.floor(Math.random()*6);return m==="multiply"?{q:`${a}/${b} · ${c}/${d} = ?`,a:ch1Frac(a*c,b*d),tip:"Перемножь и сократи."}:{q:`${a}/${b} : ${c}/${d} = ?`,a:ch1Frac(a*d,b*c),tip:"Переверни вторую дробь и умножь."}}
renderTrainer=function(){setActive("trainer");pageTitle.textContent="Тренажёр главы I";content.innerHTML=`<section class="trainer-wrap"><div class="trainer-card reveal"><span class="eyebrow">Умная практика</span><h2>Рациональные дроби</h2><p class="muted">Выбери тип заданий или смешанный режим.</p><div class="trainer-modes">${[["same","Одинаковые знаменатели"],["reduce","Сокращение"],["multiply","Умножение"],["divide","Деление"],["mixed","Смешанный"]].map(([m,n])=>`<button class="trainer-mode ${ch1TrainerMode===m?"active":""}" onclick="ch1SetTrainerMode('${m}',this)">${n}</button>`).join("")}</div><div id="trainerProblem"></div></div><div class="trainer-card reveal"><span class="eyebrow">Цель</span><h3>5 правильных подряд</h3><div class="callout good"><b>Совет:</b> сначала назови правило, потом считай.</div><div id="trainerScore"></div><p class="trainer-tip">Ошибки попадают в «Мои ошибки».</p></div></section>`;ch1Trainer.correct=0;ch1Trainer.total=0;ch1Trainer.streak=0;ch1NextTrainer();applyReveal()};
window.ch1SetTrainerMode=(m,btn)=>{ch1TrainerMode=m;document.querySelectorAll(".trainer-mode").forEach(b=>b.classList.remove("active"));btn.classList.add("active");ch1NextTrainer()};
function ch1NextTrainer(){ch1Trainer.current=ch1GenerateTrainer();document.querySelector("#trainerProblem").innerHTML=`<div class="trainer-problem">${ch1Trainer.current.q}</div><div class="answer-row"><input id="trainerAns" placeholder="Например: 3/4"><button class="check-btn" onclick="ch1CheckTrainer()">Проверить</button></div><div id="trainerFb" class="feedback"></div><div class="hint show">${ch1Trainer.current.tip}</div>`;ch1UpdateTrainerScore()}
window.ch1CheckTrainer=()=>{const val=document.querySelector("#trainerAns").value,ok=ch1AnswerMatches(val,[ch1Trainer.current.a]),fb=document.querySelector("#trainerFb");ch1Trainer.total++;state.attempts++;if(ok){ch1Trainer.correct++;ch1Trainer.streak++;state.correct++;fb.className="feedback ok";fb.textContent=`✅ Верно! Серия: ${ch1Trainer.streak}`;ch1TouchActivity();saveChapterState();setTimeout(ch1NextTrainer,650)}else{ch1Trainer.streak=0;fb.className="feedback bad";fb.textContent="❌ Проверь ещё раз.";ch1RecordMistake("trainer",ch1Trainer.current.q,val);saveChapterState()}ch1UpdateTrainerScore()};function ch1UpdateTrainerScore(){const e=document.querySelector("#trainerScore");if(e)e.innerHTML=`<b style="font-size:34px">${ch1Trainer.correct}</b> правильных из ${ch1Trainer.total}<br><span class="muted">текущая серия: ${ch1Trainer.streak}/5</span>`}

function ch1TestHtml(){return `<p class="muted">12 коротких вопросов. После проверки увидишь объяснения и персональные рекомендации.</p><div class="test-list">${ch1Test.map((q,i)=>`<div class="test-question" id="tq-${i}"><h4>${i+1}. ${q.q}</h4><div class="test-options">${q.opts.map((o,j)=>`<label class="test-option"><input type="radio" name="t-${i}" value="${j}"><span>${o}</span></label>`).join("")}</div><div class="test-explain" id="te-${i}"></div></div>`).join("")}</div><button class="primary glow-btn" style="margin-top:16px" onclick="ch1SubmitTest()">Проверить диагностику</button><div id="testResult"></div>`}
function ch1ControlHtml(){return `<div class="callout warn"><b>Режим контрольной:</b> подсказок во время решения нет. Реши все 6 заданий и проверь себя в конце.</div><div class="control-grid">${ch1Control.map((q,i)=>`<div class="test-question" id="cq-${i}"><h4>${i+1}. ${q.q}</h4><input class="control-answer" id="ca-${i}" placeholder="Ответ"></div>`).join("")}</div><button class="primary glow-btn" style="margin-top:16px" onclick="ch1SubmitControl()">Проверить контрольную</button><div id="controlResult"></div>`}
function ch1CheatHtml(){const items=[["ОДЗ","Знаменатель ≠ 0. Ограничения исходной дроби сохраняются после сокращения."],["Сокращение","Сокращаем только общие множители, а не части суммы."],["Одинаковые знаменатели","a/c ± b/c = (a ± b)/c"],["Разные знаменатели","Сначала общий знаменатель и дополнительные множители."],["Умножение","a/b · c/d = ac/bd; удобно сокращать до умножения."],["Деление","a/b : c/d = a/b · d/c — переворачиваем вторую дробь."],["Преобразования","ОДЗ → структура → общий знаменатель → действия → сокращение → проверка."],["y = k/x","x ≠ 0; k>0 → I,III; k<0 → II,IV; по точке k=x·y."],["Дробь как сумма","(a+b)/c = a/c + b/c; знаменатель по сумме не раскладывается."]];return `<div class="cheat-grid">${items.map(([h,t])=>`<div class="cheat-card"><h4>${h}</h4><div>${t}</div></div>`).join("")}</div><div class="finish-actions"><button class="secondary" onclick="window.print()">🖨️ Распечатать шпаргалку</button><button class="primary" onclick="renderTrainer()">🧩 Потренироваться</button></div>`}

window.renderChapterFinal=renderChapterFinal=function(tab="test"){setActive("chapterfinal");pageTitle.textContent="Итог главы I";content.innerHTML=`<section class="final-hero reveal"><span class="eyebrow">Глава I · Рациональные дроби</span><h2 style="font-size:38px;margin:6px 0">Проверяем не память, а понимание</h2><p class="lead">Итог можно проходить несколько раз. Сохраняется лучший результат, а ошибки превращаются в рекомендации.</p><div class="final-score-grid"><div class="final-score"><span class="muted">Уроки</span><b>${ch1Done()}/9</b></div><div class="final-score"><span class="muted">Диагностика</span><b>${state.ch1TestBest?state.ch1TestBest+"/12":"—"}</b></div><div class="final-score"><span class="muted">Контрольная</span><b>${state.ch1ControlBest?state.ch1ControlBest+"/6":"—"}</b></div></div><div class="final-tabs"><button class="${tab==="test"?"active":""}" onclick="renderChapterFinal('test')">🎯 Диагностика</button><button class="${tab==="control"?"active":""}" onclick="renderChapterFinal('control')">📝 Мини-контрольная</button><button class="${tab==="cheat"?"active":""}" onclick="renderChapterFinal('cheat')">📌 Шпаргалка</button></div><div id="finalBody">${tab==="test"?ch1TestHtml():tab==="control"?ch1ControlHtml():ch1CheatHtml()}</div></section>`;applyReveal()};
function ch1Result(target,score,total,weak){const pct=Math.round(score/total*100),level=pct>=90?"Отличное понимание 🌟":pct>=70?"Хорошая база 👍":pct>=50?"Почти получилось — закрепим слабые места 💪":"Лучше спокойно повторить несколько тем 🌱",uniq=[...new Set(weak)];document.querySelector(`#${target}`).innerHTML=`<div class="result-banner"><strong>${score}/${total} · ${pct}%</strong><b>${level}</b>${uniq.length?`<div class="recommendations"><span class="muted">Рекомендуем повторить:</span>${uniq.map(id=>`<button class="secondary" onclick="openLesson('${id}')">${lessonData[id].title}</button>`).join("")}</div>`:`<p>Слабых тем не найдено — можно уверенно двигаться дальше.</p>`}</div>`}
window.ch1SubmitTest=()=>{let score=0,weak=[];ch1Test.forEach((q,i)=>{const picked=document.querySelector(`input[name="t-${i}"]:checked`),box=document.querySelector(`#tq-${i}`),ex=document.querySelector(`#te-${i}`),ok=picked&&Number(picked.value)===q.ans;box.classList.toggle("correct",!!ok);box.classList.toggle("wrong",!ok);if(ok){score++;ex.textContent="✅ "+q.why}else{weak.push(q.tag);ex.textContent=`Правильный ответ: ${q.opts[q.ans]}. ${q.why}`}});state.ch1TestBest=Math.max(state.ch1TestBest,score);ch1TouchActivity();saveChapterState();ch1Result("testResult",score,12,weak)};
window.ch1SubmitControl=()=>{let score=0,weak=[];ch1Control.forEach((q,i)=>{const val=document.querySelector(`#ca-${i}`).value,box=document.querySelector(`#cq-${i}`),ok=ch1AnswerMatches(val,q.a);box.classList.toggle("correct",ok);box.classList.toggle("wrong",!ok);let ex=box.querySelector(".test-explain");if(!ex){ex=document.createElement("div");ex.className="test-explain";box.appendChild(ex)}if(ok){score++;ex.textContent="✅ Верно."}else{weak.push(q.tag);ex.innerHTML=`Правильный ответ: <b>${q.a[0]}</b>. ${q.solution}`}});state.ch1ControlBest=Math.max(state.ch1ControlBest,score);ch1TouchActivity();saveChapterState();ch1Result("controlResult",score,6,weak)};

renderMistakes=function(){setActive("mistakes");pageTitle.textContent="Мои ошибки";const items=[...state.mistakes].reverse();content.innerHTML=`<section class="progress-card reveal"><span class="eyebrow">Персональное повторение</span><h2>Ошибки показывают, что повторить</h2><p class="muted">Хранятся только на этом устройстве.</p>${items.length?items.slice(0,30).map(m=>`<div class="exercise"><b>${m.lesson==="trainer"?"Тренажёр":(lessonData[m.lesson]?.title||"Тема")}</b><p>${m.question}</p><small class="muted">Твой ответ: ${m.answer||"—"}</small>${lessonData[m.lesson]?`<div style="margin-top:10px"><button class="secondary" onclick="openLesson('${m.lesson}')">Повторить тему</button></div>`:""}</div>`).join(""):`<div class="callout good">🎉 Пока ошибок нет.</div>`}</section>`;applyReveal()};
renderProgress=function(){setActive("progress");pageTitle.textContent="Прогресс";const acc=state.attempts?Math.round(state.correct/state.attempts*100):0;content.innerHTML=`<div class="stat-grid"><div class="stat reveal"><span class="muted">Тем пройдено</span><b>${state.completed.length}/${TOTAL_TOPICS}</b></div><div class="stat reveal"><span class="muted">Попыток</span><b>${state.attempts}</b></div><div class="stat reveal"><span class="muted">Точность</span><b>${state.attempts?acc+"%":"—"}</b></div><div class="stat reveal"><span class="muted">Серия</span><b>${state.streak} ${ch1DayWord(state.streak)}</b></div></div><section class="progress-card reveal" style="margin-top:18px"><span class="eyebrow">Глава I</span><h2>Рациональные дроби</h2>${chapters[0].topics.map(t=>{const s=ch1SolvedCount(t.id),tot=ch1PracticeTotal(t.id),pct=Math.round(s/tot*100)||0;return `<div style="margin:15px 0"><div style="display:flex;justify-content:space-between;gap:10px"><span>${state.completed.includes(t.id)?"✅ ":""}${t.title}</span><b>${pct}%</b></div><div class="progress-bar"><span style="width:${pct}%"></span></div></div>`}).join("")}<div class="finish-actions"><button class="primary" onclick="renderChapterFinal('test')">🏁 Итог главы</button></div></section>`;applyReveal()};

go=function(view){if(view==="mathlab")return window.renderMathLab?.();if(view==="home")renderHome();if(view==="course")renderCourse();if(view==="trainer")renderTrainer();if(view==="chapterfinal")renderChapterFinal("test");if(view==="mistakes")renderMistakes();if(view==="progress")renderProgress()};

// Обновляем сброс прогресса, не трогая тему/настройку эффектов и положение боковой панели.
document.querySelector("#resetBtn").onclick=()=>{if(confirm("Сбросить учебный прогресс, ответы и результаты главы?")){["a8_completed","a8_attempts","a8_correct","a8_mistakes","a8_solved","a8_lastLesson","a8_streak","a8_last_active","a8_ch1_test_best","a8_ch1_control_best"].forEach(k=>localStorage.removeItem(k));location.reload()}};

// Обновляем статус и сразу перерисовываем главную после загрузки расширения.
document.querySelector("#streakBadge").textContent=`🔥 ${state.streak} ${ch1DayWord(state.streak)}`;
renderHome();
