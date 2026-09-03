
const chapters = [
  {
    id:1, title:"Рациональные дроби", ready:true,
    topics:[
      {id:"1-1", title:"Рациональные выражения", desc:"Что такое рациональное выражение и когда оно имеет смысл."},
      {id:"1-2", title:"Основное свойство дроби. Сокращение", desc:"Как правильно сокращать алгебраические дроби."},
      {id:"1-3", title:"Сложение и вычитание с одинаковыми знаменателями", desc:"Работа с числителями при общем знаменателе."},
      {id:"1-4", title:"Сложение и вычитание с разными знаменателями", desc:"Поиск общего знаменателя без путаницы."},
      {id:"1-5", title:"Умножение дробей. Степень дроби", desc:"Сокращение до умножения и аккуратная работа со степенями."},
      {id:"1-6", title:"Деление дробей", desc:"Почему вторую дробь переворачивают."},
      {id:"1-7", title:"Преобразование рациональных выражений", desc:"Несколько действий в одном выражении."},
      {id:"1-8", title:"Функция y = k/x и её график", desc:"Гипербола, область определения и влияние k."},
      {id:"1-9", title:"Дробь как сумма дробей", desc:"Дополнительный уровень: полезные преобразования."}
    ]
  },
  {id:2,title:"Квадратные корни",ready:false,topics:[
    {id:"2-10",title:"Действительные числа"},{id:"2-11",title:"Квадратные корни. Арифметический квадратный корень"},
    {id:"2-12",title:"Уравнение x² = a"},{id:"2-13",title:"Приближённые значения квадратного корня"},
    {id:"2-14",title:"Функция y = √x и её график"},{id:"2-15",title:"Корень из произведения и дроби"},
    {id:"2-16",title:"Корень из степени"},{id:"2-17",title:"Вынесение и внесение множителя"},
    {id:"2-18",title:"Преобразование выражений с корнями"},{id:"2-19",title:"Двойные радикалы"}
  ]},
  {id:3,title:"Уравнения и системы уравнений",ready:false,topics:[
    {id:"3-20",title:"Неполные квадратные уравнения"},{id:"3-21",title:"Формула корней квадратного уравнения"},
    {id:"3-22",title:"Задачи с квадратными уравнениями"},{id:"3-23",title:"Теорема Виета"},
    {id:"3-24",title:"Квадратный трёхчлен и его корни"},{id:"3-25",title:"Разложение квадратного трёхчлена"},
    {id:"3-26",title:"Дробные рациональные уравнения"},{id:"3-27",title:"Задачи"},
    {id:"3-28",title:"Уравнение с двумя переменными и его график"},{id:"3-29",title:"Системы двух линейных уравнений"},
    {id:"3-30",title:"Графический способ решения систем"},{id:"3-31",title:"Алгебраический способ решения систем"},
    {id:"3-32",title:"Задачи на системы"},{id:"3-33",title:"Уравнения с параметром"}
  ]},
  {id:4,title:"Неравенства",ready:false,topics:[
    {id:"4-34",title:"Числовые неравенства"},{id:"4-35",title:"Свойства числовых неравенств"},
    {id:"4-36",title:"Сложение и умножение неравенств"},{id:"4-37",title:"Пересечение и объединение множеств"},
    {id:"4-38",title:"Числовые промежутки"},{id:"4-39",title:"Неравенства с одной переменной"},
    {id:"4-40",title:"Системы неравенств"},{id:"4-41",title:"Доказательство неравенств"}
  ]},
  {id:5,title:"Функции",ready:false,topics:[
    {id:"5-42",title:"Функция. Область определения и множество значений"},{id:"5-43",title:"Свойства функции"},
    {id:"5-44",title:"Свойства линейной функции"},{id:"5-45",title:"Свойства y = k/x и y = √x"},
    {id:"5-46",title:"Целая и дробная части числа"}
  ]},
  {id:6,title:"Степень с целым показателем",ready:false,topics:[
    {id:"6-47",title:"Степень с целым отрицательным показателем"},{id:"6-48",title:"Свойства степени с целым показателем"},
    {id:"6-49",title:"Стандартный вид числа"},{id:"6-50",title:"Задачи с большими и малыми числами"},
    {id:"6-51",title:"Функции y = x⁻¹ и y = x⁻²"}
  ]}
];

const lessonData = {
"1-1":{
 title:"Рациональные выражения",
 lead:"Начнём с базовой идеи, на которой держится вся первая глава. Здесь важно не просто запомнить термин, а научиться быстро замечать: где выражение допустимо, а где возникает запрещённое деление на ноль.",
 levels:{
   simple:`Рациональное выражение — это математическая запись из чисел и букв, где используются привычные действия. Но есть один важный контрольный вопрос: <b>не превращается ли знаменатель в ноль?</b> Если превращается — такое значение переменной брать нельзя.`,
   school:`Рациональным называют выражение, составленное из чисел, переменных, действий сложения, вычитания, умножения, деления и целых степеней. При этом область допустимых значений определяется условием, что знаменатель не равен нулю.`,
   deep:`Самая важная мысль: математическое выражение имеет смысл только там, где каждое действие определено. Деление на ноль не определено, поэтому запрещённые значения переменной автоматически исключаются из области допустимых значений.`
 },
 remember:`Если переменная находится в знаменателе, обязательно проверь, при каких значениях знаменатель становится равным нулю. Эти значения запрещены.`,
 why:`Запрет появился не «по договорённости». Деление a/b означает поиск числа, которое при умножении на b даст a. При b = 0 это определение перестаёт работать.`,
 mistake:`Типичная ошибка — смотреть только на числитель и забывать проверить знаменатель.`,
 example:{
   task:`Найди допустимые значения x для <span class="math">5/(x − 3)</span>.`,
   steps:[
     `Знаменатель не должен быть равен нулю: <span class="math">x − 3 ≠ 0</span>.`,
     `Отсюда <span class="math">x ≠ 3</span>.`,
     `Ответ: можно подставлять любые числа, кроме 3.`
   ]
 },
 exercises:[
   {q:`При каком значении x выражение <span class="math">7/(x+4)</span> не имеет смысла?`,a:"-4",hint:"Приравняй знаменатель x + 4 к нулю."},
   {q:`Можно ли подставить x = 0 в <span class="math">(x+1)/(x²+1)</span>? Напиши «да» или «нет».`,a:"да",hint:"При x = 0 знаменатель равен 1."}
 ]
},
"1-2":{
 title:"Основное свойство дроби. Сокращение",
 lead:"Алгебраическую дробь можно сокращать так же, как обычную, но сокращаем мы только общие множители.",
 levels:{
   simple:`Главное правило: <span class="math">a/b = (a·c)/(b·c)</span>, если <span class="math">b ≠ 0</span> и <span class="math">c ≠ 0</span>. Поэтому общий множитель числителя и знаменателя можно убрать.`,
   school:`Основное свойство дроби позволяет умножать или делить числитель и знаменатель на одно и то же ненулевое число или выражение. На этом основано сокращение дробей.`,
   deep:`Сокращение — это не «магическое исчезновение», а деление числителя и знаменателя на общий множитель. Значение дроби не меняется, потому что мы фактически делим её на единицу: <span class="math">c/c = 1</span>.`
 },
 remember:`Сокращать можно <b>множители</b>, но нельзя «зачёркивать части суммы». Например, в <span class="math">(x+2)/x</span> нельзя сократить x.`,
 why:`Потому что дробь умножается на <span class="math">c/c</span>, а <span class="math">c/c = 1</span>. Значение выражения не меняется.`,
 mistake:`Ошибка: пытаться сократить <span class="math">x</span> в сумме <span class="math">(x+2)/x</span>. Сокращают только множители.`,
 example:{
   task:`Сократи <span class="math">(6x²)/(9x)</span>.`,
   steps:[
     `Разложим числа: <span class="math">6/9 = 2/3</span>.`,
     `Для букв: <span class="math">x²/x = x</span>, если <span class="math">x ≠ 0</span>.`,
     `Получаем <span class="math">2x/3</span>.`
   ]
 },
 exercises:[
   {q:`Сократи <span class="math">8x/(12x)</span>. Введи обычную дробь, например 2/3.`,a:"2/3",hint:"Сначала сократи 8/12. Множитель x сокращается при x ≠ 0."},
   {q:`Сократи <span class="math">(x²−9)/(x−3)</span>.`,a:"x+3",hint:"x² − 9 — разность квадратов: (x−3)(x+3)."}
 ]
},
"1-3":{
 title:"Сложение и вычитание дробей с одинаковыми знаменателями",
 lead:"Когда знаменатели одинаковые, всё почти как с кусочками одной и той же величины: знаменатель оставляем, числители складываем или вычитаем.",
 levels:{
   simple:`Правило: <span class="math">a/c + b/c = (a+b)/c</span>. Для вычитания точно так же.`,
   school:`Если знаменатели дробей совпадают, мы складываем или вычитаем числители и сохраняем общий знаменатель.`,
   deep:`Знаменатель показывает размер доли. Если размер доли один и тот же, складывается количество долей, а не сам их размер.`
 },
 remember:`Знаменатель не складывается. <span class="math">2/7 + 3/7 = 5/7</span>, а не <span class="math">5/14</span>.`,
 why:`Знаменатель показывает размер одной доли. Если размер долей одинаковый, меняется только количество таких долей.`,
 mistake:`Частая ошибка — сложить и числители, и знаменатели одновременно.`,
 example:{
   task:`Упрости <span class="math">(x+2)/(x−1) + 3/(x−1)</span>.`,
   steps:[
     `Знаменатели одинаковые: <span class="math">x−1</span>.`,
     `Складываем числители: <span class="math">x+2+3 = x+5</span>.`,
     `Ответ: <span class="math">(x+5)/(x−1)</span>, <span class="math">x ≠ 1</span>.`
   ]
 },
 exercises:[
   {q:`Вычисли <span class="math">2/9 + 5/9</span>.`,a:"7/9",hint:"Знаменатель 9 оставь прежним."},
   {q:`Упрости <span class="math">(x−4)/a + 6/a</span>.`,a:"(x+2)/a",hint:"Сложи x − 4 и 6."}
 ]
},
"1-4":{
 title:"Сложение и вычитание дробей с разными знаменателями",
 lead:"Если знаменатели разные, сначала нужно привести дроби к общему знаменателю.",
 levels:{
   simple:`Идея такая: сделать «размер долей» одинаковым. После этого можно складывать числители.`,
   school:`Чтобы сложить дроби с разными знаменателями, находим общий знаменатель, приводим к нему дроби, затем складываем или вычитаем числители.`,
   deep:`Приведение к общему знаменателю — это переход к одинаковым долям. Без этого операции с дробями некорректны, потому что сравниваются части разного размера.`
 },
 remember:`Не спеши перемножать знаменатели. Иногда общий знаменатель можно подобрать проще.`,
 why:`Складывать <span class="math">1/2</span> и <span class="math">1/3</span> напрямую нельзя: половина и треть — доли разного размера. Приведём их к шестым: <span class="math">3/6 + 2/6 = 5/6</span>.`,
 mistake:`Ошибка — оставить разные знаменатели и просто сложить числители.`,
 example:{
   task:`Сложи <span class="math">1/x + 2/(3x)</span>.`,
   steps:[
     `Общий знаменатель — <span class="math">3x</span>.`,
     `Первую дробь домножаем на 3: <span class="math">1/x = 3/(3x)</span>.`,
     `Складываем: <span class="math">3/(3x)+2/(3x)=5/(3x)</span>.`
   ]
 },
 exercises:[
   {q:`Вычисли <span class="math">1/2 + 1/3</span>.`,a:"5/6",hint:"Общий знаменатель 6."},
   {q:`Вычисли <span class="math">3/4 − 1/6</span>.`,a:"7/12",hint:"Общий знаменатель 12: 9/12 − 2/12."}
 ]
},
"1-5":{
 title:"Умножение дробей. Степень дроби",
 lead:"При умножении дробей числители перемножаются между собой, знаменатели — между собой. Но часто можно сделать проще: сократить заранее.",
 levels:{
   simple:`<span class="math">(a/b)·(c/d) = ac/bd</span>. Для степени: <span class="math">(a/b)^n = a^n/b^n</span>.`,
   school:`При умножении дробей произведение числителей записывается в числитель, а произведение знаменателей — в знаменатель. Степень дроби распространяется и на числитель, и на знаменатель.`,
   deep:`Предварительное сокращение уменьшает вычислительную нагрузку и снижает риск ошибок. Это особенно важно в длинных выражениях.`
 },
 remember:`Сначала ищи, что можно сократить крест-накрест. Так вычисления будут короче и вероятность ошибки меньше.`,
 why:`Дробь — это деление. Произведение двух делений можно объединить в одно: <span class="math">(a÷b)(c÷d)=ac÷bd</span>.`,
 mistake:`Частая ошибка — забыть возвести в степень знаменатель.`,
 example:{
   task:`Вычисли <span class="math">(6/7)·(14/15)</span>.`,
   steps:[
     `Сократим 14 и 7: остаётся 2.`,
     `Сократим 6 и 15 на 3: остаются 2 и 5.`,
     `Получаем <span class="math">(2·2)/5 = 4/5</span>.`
   ]
 },
 exercises:[
   {q:`Вычисли <span class="math">(3/8)·(4/9)</span>.`,a:"1/6",hint:"Сократи 3 и 9, затем 4 и 8."},
   {q:`Вычисли <span class="math">(2/3)²</span>.`,a:"4/9",hint:"Возведи в квадрат и числитель, и знаменатель."}
 ]
},
"1-6":{
 title:"Деление дробей",
 lead:"Чтобы разделить на дробь, мы умножаем на обратную ей дробь.",
 levels:{
   simple:`<span class="math">(a/b):(c/d)=(a/b)·(d/c)</span>.`,
   school:`Деление на дробь заменяют умножением на дробь, обратную делителю.`,
   deep:`Обратная дробь «отменяет» исходную при умножении. Поэтому деление на <span class="math">c/d</span> эквивалентно умножению на <span class="math">d/c</span>.`
 },
 remember:`Переворачивается только <b>вторая</b> дробь — та, на которую делим.`,
 why:`Деление на <span class="math">c/d</span> означает найти, сколько раз <span class="math">c/d</span> содержится в первом числе. Умножение на <span class="math">d/c</span> выполняет обратное масштабирование.`,
 mistake:`Ошибка — перевернуть обе дроби или первую вместо второй.`,
 example:{
   task:`Вычисли <span class="math">(5/6):(10/9)</span>.`,
   steps:[
     `Вторую дробь переворачиваем: <span class="math">10/9 → 9/10</span>.`,
     `Получаем <span class="math">(5/6)·(9/10)</span>.`,
     `Сокращаем и получаем <span class="math">3/4</span>.`
   ]
 },
 exercises:[
   {q:`Вычисли <span class="math">(2/3):(4/5)</span>.`,a:"5/6",hint:"Умножь <span class='math'>2/3</span> на <span class='math'>5/4</span>."},
   {q:`Вычисли <span class="math">7:(7/3)</span>.`,a:"3",hint:"Представь 7 как 7/1 и умножь на 3/7."}
 ]
},
"1-7":{
 title:"Преобразование рациональных выражений",
 lead:"Здесь соединяются все предыдущие навыки. Главный секрет — не пытаться делать всё одновременно.",
 levels:{
   simple:`Работай слоями: 1) ограничения, 2) скобки и разложение, 3) общий знаменатель, 4) сокращение, 5) проверка.`,
   school:`Преобразование рациональных выражений требует последовательного применения правил работы с дробями и обязательного контроля области допустимых значений.`,
   deep:`Структурный порядок уменьшает когнитивную нагрузку: мозгу легче удерживать несколько простых действий подряд, чем одно большое сложное.`
 },
 remember:`Чем сложнее выражение, тем важнее писать промежуточные шаги.`,
 why:`Порядок действий помогает не потерять знак, множитель или ограничение.`,
 mistake:`Ошибка — сокращать раньше времени, не раскрыв структуру выражения.`,
 example:{
   task:`Упрости <span class="math">1/x + 1/(x+1)</span>.`,
   steps:[
     `Общий знаменатель: <span class="math">x(x+1)</span>.`,
     `Получаем <span class="math">(x+1)/(x(x+1)) + x/(x(x+1))</span>.`,
     `Складываем числители: <span class="math">(2x+1)/(x(x+1))</span>.`
   ]
 },
 exercises:[
   {q:`Упрости числовое выражение <span class="math">1/2 + 1/4</span>.`,a:"3/4",hint:"Приведи к знаменателю 4."},
   {q:`Вычисли <span class="math">(1/2 + 1/3)·6</span>.`,a:"5",hint:"Сначала <span class='math'>1/2 + 1/3 = 5/6</span>."}
 ]
},
"1-8":{
 title:"Функция y = k/x и её график",
 lead:"Функция <span class='math'>y = k/x</span> описывает обратную пропорциональность: когда x увеличивается, по модулю y обычно уменьшается.",
 levels:{
   simple:`График называется <b>гиперболой</b>. <span class="math">x = 0</span> запрещён, потому что делить на ноль нельзя.`,
   school:`При <span class="math">k > 0</span> ветви гиперболы находятся в I и III четвертях, а при <span class="math">k < 0</span> — во II и IV.`,
   deep:`Если <span class="math">x</span> растёт по модулю, значение <span class="math">k/x</span> становится всё ближе к нулю. Поэтому график приближается к осям, но не пересекает их в точке разрыва.`
 },
 remember:`Оси координат являются «границами», к которым график приближается, но не пересекает их.`,
 why:`Если x становится очень большим, <span class="math">k/x</span> становится очень маленьким. Если x приближается к нулю, <span class="math">|k/x|</span> быстро растёт.`,
 mistake:`Ошибка — подставлять <span class="math">x = 0</span>.`,
 example:{
   task:`Для <span class="math">y = 6/x</span> найди y при x = 2.`,
   steps:[
     `Подставляем <span class="math">x = 2</span>.`,
     `<span class="math">y = 6/2</span>.`,
     `Получаем <span class="math">y = 3</span>.`
   ]
 },
 exercises:[
   {q:`Для <span class="math">y = 12/x</span> найди y при x = 3.`,a:"4",hint:"12 раздели на 3."},
   {q:`Можно ли в функции <span class="math">y = 5/x</span> взять x = 0? Напиши «да» или «нет».`,a:"нет",hint:"В знаменателе окажется ноль."}
 ]
},
"1-9":{
 title:"Представление дроби в виде суммы дробей",
 lead:"Иногда сложную дробь удобно разложить на несколько более простых. Это дополнительная тема, но она хорошо тренирует гибкость мышления.",
 levels:{
   simple:`Если числитель можно представить как сумму, иногда всю дробь можно разбить: <span class="math">(a+b)/c = a/c + b/c</span>.`,
   school:`Разложение дроби в сумму дробей опирается на распределительное свойство деления по отношению к сложению в числителе.`,
   deep:`Это обратное действие к сложению дробей с одинаковыми знаменателями. Оно помогает замечать структуру выражения и упростить дальнейшие вычисления.`
 },
 remember:`Разбивать можно числитель по сумме. Знаменатель при этом остаётся одинаковым.`,
 why:`Это обратное действие к сложению дробей с одинаковыми знаменателями.`,
 mistake:`Ошибка — пытаться разложить по сумме знаменатель.`,
 example:{
   task:`Представь <span class="math">(x+6)/x</span> в виде суммы.`,
   steps:[
     `Разделяем числитель: <span class="math">x/x + 6/x</span>.`,
     `<span class="math">x/x = 1</span>, если <span class="math">x ≠ 0</span>.`,
     `Получаем <span class="math">1 + 6/x</span>.`
   ]
 },
 exercises:[
   {q:`Представь <span class="math">(x+4)/x</span> в виде <span class="math">1 + ...</span>. Введи только второе слагаемое.`,a:"4/x",hint:"<span class='math'>x/x = 1</span>."},
   {q:`Вычисли при x = 2 выражение <span class="math">1 + 6/x</span>.`,a:"4",hint:"<span class='math'>6/2 = 3</span>, затем прибавь 1."}
 ]
}
};

const TOTAL_TOPICS = chapters.reduce((s,c)=>s+c.topics.length,0);
let installPrompt = null;
const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
const isTouch = window.matchMedia("(pointer: coarse)").matches;

const state = {
  completed: JSON.parse(localStorage.getItem("a8_completed")||"[]"),
  attempts: Number(localStorage.getItem("a8_attempts")||0),
  correct: Number(localStorage.getItem("a8_correct")||0),
  mistakes: JSON.parse(localStorage.getItem("a8_mistakes")||"[]"),
  theme: localStorage.getItem("a8_theme")||"light",
  lastLesson: localStorage.getItem("a8_lastLesson")||"1-1",
  streak: Number(localStorage.getItem("a8_streak")||0),
  effects: localStorage.getItem("a8_effects") || "auto"
};

const effectModes = ["auto","soft","off"];
const content = document.querySelector("#content");
const pageTitle = document.querySelector("#pageTitle");

function save(){
  localStorage.setItem("a8_completed",JSON.stringify(state.completed));
  localStorage.setItem("a8_attempts",state.attempts);
  localStorage.setItem("a8_correct",state.correct);
  localStorage.setItem("a8_mistakes",JSON.stringify(state.mistakes));
  localStorage.setItem("a8_lastLesson",state.lastLesson);
  localStorage.setItem("a8_streak",state.streak);
  localStorage.setItem("a8_effects",state.effects);
}
function normalize(s){
  return String(s).trim().toLowerCase().replace(/\s+/g,"").replace(/−/g,"-").replace(/²/g,"^2");
}
function setTheme(){
  document.body.classList.toggle("dark",state.theme==="dark");
  document.querySelector("#themeBtn").textContent = state.theme==="dark" ? "☀️ Светлая тема" : "🌙 Тёмная тема";
}
function effectiveEffects(){
  if (reduceMotionQuery.matches) return "off";
  if (state.effects === "auto") return isTouch ? "soft" : "auto";
  return state.effects;
}
function applyEffectsMode(){
  document.body.classList.remove("effects-soft","effects-off","reduced-motion");
  if (reduceMotionQuery.matches) document.body.classList.add("reduced-motion");
  const mode = effectiveEffects();
  if (mode === "soft") document.body.classList.add("effects-soft");
  if (mode === "off") document.body.classList.add("effects-off");
  document.querySelector("#effectsBtn").textContent = `✨ Эффекты: ${state.effects==="auto" ? "авто" : state.effects==="soft" ? "мягко" : "выкл"}`;
  particleSystem?.reset();
}
function cycleEffectsMode(){
  const idx = effectModes.indexOf(state.effects);
  state.effects = effectModes[(idx+1)%effectModes.length];
  save();
  applyEffectsMode();
}
function setActive(view){
  document.querySelectorAll(".nav-btn").forEach(b=>b.classList.toggle("active",b.dataset.view===view));
  document.querySelector("#sidebar").classList.remove("open");
}
function renderHome(){
  setActive("home"); pageTitle.textContent="Алгебра 8";
  content.innerHTML=document.querySelector("#homeTpl").innerHTML;
  const p=Math.round(state.completed.length/TOTAL_TOPICS*100);
  document.querySelector("#heroPercent").textContent=p+"%";
  document.querySelector("#heroRing").style.setProperty("--p",p);
  document.querySelector("#heroStats").textContent=`${state.completed.length} из ${TOTAL_TOPICS} тем`;
  document.querySelector("#doneCount").textContent=state.completed.length;
  document.querySelector("#accuracyValue").textContent=state.attempts?Math.round(state.correct/state.attempts*100)+"%":"—";
  document.querySelector("#mistakesValue").textContent=state.mistakes.length;
  const last=chapters.flatMap(c=>c.topics).find(t=>t.id===state.lastLesson)||chapters[0].topics[0];
  document.querySelector("#continueCard").innerHTML=`<div class="home-continue reveal">
    <span class="topic-number">ПРОДОЛЖИТЬ</span><h4>${last.title}</h4>
    <p>${last.desc||"Следующая тема курса."}</p>
    <div class="card-footer"><span class="effects-chip">✨ Эффекты работают и на телефонах</span>
    <button class="primary glow-btn" onclick="openLesson('${last.id}')">Открыть →</button></div></div>`;
  document.querySelector("#homeTopics").innerHTML=chapters[0].topics.slice(0,6).map((t,i)=>topicCard(t,i+1)).join("");
  applyReveal();
}
function topicCard(t,n){
  const done=state.completed.includes(t.id);
  return `<article class="card reveal"><span class="topic-number">ТЕМА ${n}</span><h4>${done?"✅ ":""}${t.title}</h4><p>${t.desc||""}</p>
  <div class="card-footer"><span class="muted">${done?"Пройдено":"8–15 минут"}</span><button class="secondary" onclick="openLesson('${t.id}')">${done?"Повторить":"Начать"}</button></div></article>`
}
function renderCourse(){
  setActive("course");pageTitle.textContent="Карта курса";
  content.innerHTML=`<section class="section reveal" style="margin-top:0"><div class="section-head"><div><span class="eyebrow">Полная программа</span><h3>6 глав · ${TOTAL_TOPICS} тема</h3></div></div>
  <div class="course-grid">${chapters.map(ch=>`<section class="chapter-card reveal">
    <div class="chapter-head"><div><span class="eyebrow">Глава ${ch.id}</span><h3>${ch.title}</h3></div>
    <span class="${ch.ready?"status-chip":"chapter-locked"}">${ch.ready?"готово в v0.1.2":"следующий этап"}</span></div>
    <div class="chapter-body">${ch.topics.map((t,i)=>`<div class="topic-row ${ch.ready?"":"locked"}">
      <div class="topic-number">${String(i+1).padStart(2,"0")}</div><div><b>${state.completed.includes(t.id)?"✅ ":""}${t.title}</b></div>
      ${ch.ready?`<button onclick="openLesson('${t.id}')">Открыть</button>`:`<span>🔒</span>`}
    </div>`).join("")}</div></section>`).join("")}</div></section>`;
  applyReveal();
}
function lessonHtml(id,d){
 const simple = d.levels?.simple || d.simple || "";
 const school = d.levels?.school || d.school || simple;
 const deep = d.levels?.deep || d.deep || simple;
 return `<div class="lesson-layout">
   <article class="lesson-panel reveal">
     <span class="pill">Глава 1 · Рациональные дроби</span>
     <h2>${d.title}</h2>
     <p class="lead">${d.lead}</p>

     <div class="lesson-progressline"><span></span></div>
     <div class="lesson-intro-grid">
       <div><b>🎯 Цель урока</b><small>Понять главную идею темы и научиться уверенно решать 2–3 типовых задания.</small></div>
       <div><b>⏱ Время</b><small>Обычно 8–15 минут, если идти спокойно и не спешить.</small></div>
       <div><b>📱 Формат</b><small>Все эффекты и карточки адаптируются под телефон и не мешают чтению.</small></div>
     </div>

     <h3 id="simple">🌱 Объяснение уровнями</h3>
     <div class="level-switch">
       <button class="active" data-level="simple" onclick="switchLevel(this,'simple')">Совсем просто</button>
       <button data-level="school" onclick="switchLevel(this,'school')">Как в школе</button>
       <button data-level="deep" onclick="switchLevel(this,'deep')">Хочу понять глубже</button>
     </div>
     <div class="explain-pane active" data-pane="simple"><p>${simple}</p></div>
     <div class="explain-pane" data-pane="school"><p>${school}</p></div>
     <div class="explain-pane" data-pane="deep"><p>${deep}</p></div>

     <div class="callout good"><b>🧠 Запомни</b><br>${d.remember}</div>
     <div class="callout"><b>🔍 Почему так?</b><br>${d.why}</div>
     ${d.mistake ? `<div class="callout danger"><b>⚠️ Частая ошибка</b><br>${d.mistake}</div>` : ""}

     <div class="visual-rule">
       <div class="box"><b>Сначала спроси себя:</b><br>что здесь главное правило?</div>
       <div class="arrow">→</div>
       <div class="box"><b>Потом действуй:</b><br>по одному шагу, не перепрыгивая через решение.</div>
     </div>

     <div class="exercise">
       <h4>⚡ Мини-проверка понимания</h4>
       <p>Что важнее всего в этой теме?</p>
       <div class="micro-check">
         <button onclick="microCheck(this,false,'Ответ не совсем точный. Попробуй ещё раз.')">Быстро подставлять любые числа</button>
         <button onclick="microCheck(this,true,'Верно! Именно это главный акцент темы.')">Сначала понять правило и ограничения</button>
         <span class="micro-result" id="microResult"></span>
       </div>
     </div>

     <h3 id="example">📘 Разберём пример по шагам</h3>
     <div class="exercise">
       <h4>${d.example.task}</h4>
       <div class="steps">${d.example.steps.map(s=>`<div class="step">${s}</div>`).join("")}</div>
     </div>

     <h3 id="practice">✍️ Попробуй сам</h3>
     ${d.exercises.map((e,i)=>exerciseHtml(id,i,e)).join("")}

     <div class="callout warn"><b>💡 Если не понял</b><br>
       Прочитай только блок «Совсем просто», затем ещё раз повтори разобранный пример, закрывая рукой следующий шаг.
       Сначала попробуй угадать его сам — так материал запоминается заметно лучше.
     </div>
     <button class="primary glow-btn" onclick="finishLesson('${id}')">✅ Я понял(а) эту тему</button>
   </article>
   <aside class="lesson-nav reveal">
     <div class="lesson-mini"><b>Эталон урока</b><small>Именно в таком формате будут сделаны остальные темы курса.</small></div>
     <b>Навигация по уроку</b>
     <button class="ghost" onclick="document.querySelector('#simple').scrollIntoView()">🌱 Объяснение</button>
     <button class="ghost" onclick="document.querySelector('#example').scrollIntoView()">📘 Пример</button>
     <button class="ghost" onclick="document.querySelector('#practice').scrollIntoView()">✍️ Практика</button>
     <hr/>
     <button class="secondary" onclick="renderCourse()">← Карта курса</button>
     <button class="ghost" onclick="window.print()">🖨️ Печать урока</button>
   </aside>
 </div>`;
}
function exerciseHtml(lessonId,i,e){
 return `<div class="exercise reveal" data-ex="${lessonId}-${i}">
   <h4>Задание ${i+1}</h4><p>${e.q}</p>
   <div class="answer-row"><input id="ans-${lessonId}-${i}" placeholder="Твой ответ" autocomplete="off">
   <button class="check-btn" onclick="checkAnswer('${lessonId}',${i})">Проверить</button>
   <button class="secondary" onclick="toggleHint('${lessonId}',${i})">💡 Подсказка</button></div>
   <div class="hint" id="hint-${lessonId}-${i}">${e.hint}</div>
   <div class="feedback" id="fb-${lessonId}-${i}"></div>
 </div>`;
}
function openLesson(id){
  if(!lessonData[id]) return;
  state.lastLesson=id; save();
  setActive(""); pageTitle.textContent=lessonData[id].title;
  content.innerHTML=lessonHtml(id,lessonData[id]);
  window.scrollTo(0,0);
  applyReveal();
}
window.openLesson=openLesson;
window.renderCourse=renderCourse;
window.switchLevel=(button,level)=>{
  document.querySelectorAll(".level-switch button").forEach(b=>b.classList.remove("active"));
  button.classList.add("active");
  document.querySelectorAll(".explain-pane").forEach(p=>p.classList.toggle("active",p.dataset.pane===level));
};
window.microCheck=(btn,ok,msg)=>{
  const out = document.querySelector("#microResult");
  out.textContent = ok ? "✅ " + msg : "🙂 " + msg;
  out.style.color = ok ? "var(--good)" : "var(--warn)";
};
window.toggleHint=(id,i)=>document.querySelector(`#hint-${id}-${i}`).classList.toggle("show");
window.checkAnswer=(id,i)=>{
  const e=lessonData[id].exercises[i];
  const input=document.querySelector(`#ans-${id}-${i}`);
  const fb=document.querySelector(`#fb-${id}-${i}`);
  const ok=normalize(input.value)===normalize(e.a);
  state.attempts++;
  if(ok){
    state.correct++;
    fb.className="feedback ok";
    fb.textContent="✅ Верно! Отличная работа.";
  }else{
    fb.className="feedback bad";
    fb.innerHTML=`Пока не так. Попробуй ещё раз или открой подсказку.`;
    state.mistakes.push({lesson:id,question:e.q,answer:input.value,ts:Date.now()});
    state.mistakes=state.mistakes.slice(-50);
  }
  save();
};
window.finishLesson=(id)=>{
  if(!state.completed.includes(id)) state.completed.push(id);
  const all=chapters[0].topics;
  const idx=all.findIndex(t=>t.id===id);
  state.lastLesson=all[Math.min(idx+1,all.length-1)].id;
  save();
  renderHome();
};
function renderTrainer(){
 setActive("trainer");pageTitle.textContent="Тренажёр";
 content.innerHTML=`<section class="trainer-wrap">
  <div class="trainer-card reveal"><span class="eyebrow">Быстрая практика</span><h2>Рациональные дроби</h2>
  <p class="muted">Решай короткие задания. После каждого ответа получишь мгновенную проверку.</p>
  <div id="trainerProblem"></div></div>
  <div class="trainer-card reveal"><span class="eyebrow">Как работать</span><h3>Схема из 3 шагов</h3>
  <ol><li>Не спеши считать в уме.</li><li>Сначала найди общий знаменатель или сокращение.</li><li>Проверь, можно ли сократить результат.</li></ol>
  <div class="callout good"><b>Цель:</b> 5 правильных ответов подряд.</div><div id="trainerScore"></div></div>
 </section>`;
 trainer.correct=0; trainer.total=0; nextTrainer(); applyReveal();
}
const trainer={correct:0,total:0,current:null};
function nextTrainer(){
 const den=[3,4,5,6,8,9,10,12][Math.floor(Math.random()*8)];
 let a=1+Math.floor(Math.random()*(den-1)), b=1+Math.floor(Math.random()*(den-1));
 const num=a+b; const g=gcd(num,den); const ans=`${num/g}/${den/g}`;
 trainer.current={a,b,den,ans};
 document.querySelector("#trainerProblem").innerHTML=`<div class="trainer-problem">${a}/${den} + ${b}/${den} = ?</div>
 <div class="answer-row"><input id="trainerAns" placeholder="Например: 3/4"><button class="check-btn" onclick="checkTrainer()">Проверить</button></div>
 <div id="trainerFb" class="feedback"></div>`;
 updateTrainerScore();
}
function gcd(a,b){while(b){[a,b]=[b,a%b]}return a}
window.checkTrainer=()=>{
 const val=normalize(document.querySelector("#trainerAns").value), ok=val===normalize(trainer.current.ans);
 trainer.total++;state.attempts++;
 const fb=document.querySelector("#trainerFb");
 if(ok){trainer.correct++;state.correct++;fb.className="feedback ok";fb.textContent="✅ Верно! Сейчас будет новое задание.";save();setTimeout(nextTrainer,600)}
 else{fb.className="feedback bad";fb.textContent=`❌ Проверь ещё раз. Знаменатель остаётся ${trainer.current.den}, затем дробь нужно сократить.`;state.mistakes.push({lesson:"trainer",question:`${trainer.current.a}/${trainer.current.den}+${trainer.current.b}/${trainer.current.den}`,answer:val,ts:Date.now()});save()}
 updateTrainerScore();
}
function updateTrainerScore(){const e=document.querySelector("#trainerScore");if(e)e.innerHTML=`<b>${trainer.correct}</b> правильных из ${trainer.total}`}
function renderMistakes(){
 setActive("mistakes");pageTitle.textContent="Мои ошибки";
 const items=[...state.mistakes].reverse();
 content.innerHTML=`<section class="progress-card reveal"><span class="eyebrow">Персональное повторение</span><h2>Ошибки — это карта того, что повторить</h2>
 <p class="muted">Здесь сохраняются последние неправильные ответы только на этом устройстве.</p>
 ${items.length?items.slice(0,20).map(m=>`<div class="exercise"><b>${m.lesson==="trainer"?"Тренажёр":(lessonData[m.lesson]?.title||"Тема")}</b><p>${m.question}</p><small class="muted">Твой ответ: ${m.answer||"—"}</small></div>`).join(""):`<div class="callout good">🎉 Пока ошибок нет. Отличное начало!</div>`}
 </section>`;
 applyReveal();
}
function renderProgress(){
 setActive("progress");pageTitle.textContent="Прогресс";
 const acc=state.attempts?Math.round(state.correct/state.attempts*100):0;
 content.innerHTML=`<div class="stat-grid">
  <div class="stat reveal"><span class="muted">Тем пройдено</span><b>${state.completed.length}/${TOTAL_TOPICS}</b></div>
  <div class="stat reveal"><span class="muted">Попыток</span><b>${state.attempts}</b></div>
  <div class="stat reveal"><span class="muted">Точность</span><b>${state.attempts?acc+"%":"—"}</b></div>
  <div class="stat reveal"><span class="muted">Ошибок сохранено</span><b>${state.mistakes.length}</b></div>
 </div>
 <section class="progress-card reveal" style="margin-top:18px"><span class="eyebrow">Глава 1</span><h2>Рациональные дроби</h2>
 ${chapters[0].topics.map(t=>`<div style="margin:14px 0"><div style="display:flex;justify-content:space-between;gap:10px"><span>${t.title}</span><b>${state.completed.includes(t.id)?"100%":"0%"}</b></div>
 <div class="progress-bar"><span style="width:${state.completed.includes(t.id)?100:0}%"></span></div></div>`).join("")}</section>`;
 applyReveal();
}
function go(view){
 if(view==="home")renderHome();
 if(view==="course")renderCourse();
 if(view==="trainer")renderTrainer();
 if(view==="mistakes")renderMistakes();
 if(view==="progress")renderProgress();
}

document.querySelectorAll(".nav-btn").forEach(b=>b.addEventListener("click",()=>go(b.dataset.view)));
document.addEventListener("click",e=>{
 const v=e.target.closest("[data-view-jump]")?.dataset.viewJump;if(v)go(v);
 if(e.target.closest("[data-action=continue]"))openLesson(state.lastLesson);
});

const appShell=document.querySelector(".app-shell");
const sidebar=document.querySelector("#sidebar");
const desktopSidebarMedia=window.matchMedia("(min-width: 981px)");
const sidebarScrim=document.querySelector("#sidebarScrim");

function setMobileSidebar(open){
  if(desktopSidebarMedia.matches)return;
  sidebar.classList.toggle("open",!!open);
  document.body.classList.toggle("sidebar-mobile-open",!!open);
  sidebarScrim?.setAttribute("aria-hidden",open?"false":"true");
}
function closeMobileSidebar(){setMobileSidebar(false)}

function applySidebarPreference(){
  if(desktopSidebarMedia.matches){
    const collapsed=localStorage.getItem("a8_sidebar_collapsed")==="1";
    appShell.classList.toggle("sidebar-collapsed",collapsed);
    sidebar.classList.remove("open");
    document.body.classList.remove("sidebar-mobile-open");
  }else{
    appShell.classList.remove("sidebar-collapsed");
  }
}
function toggleSidebar(){
  if(desktopSidebarMedia.matches){
    const next=!appShell.classList.contains("sidebar-collapsed");
    appShell.classList.toggle("sidebar-collapsed",next);
    localStorage.setItem("a8_sidebar_collapsed",next?"1":"0");
  }else{
    setMobileSidebar(!sidebar.classList.contains("open"));
  }
}
document.querySelector("#menuBtn").onclick=toggleSidebar;
document.querySelector("#hideSidebarBtn").onclick=()=>{
  if(desktopSidebarMedia.matches){
    appShell.classList.add("sidebar-collapsed");
    localStorage.setItem("a8_sidebar_collapsed","1");
  }else{
    closeMobileSidebar();
  }
};
sidebarScrim?.addEventListener("pointerdown",e=>{
  e.preventDefault();
  closeMobileSidebar();
});
/* Also close after choosing a navigation item on phones. */
document.querySelectorAll(".sidebar .nav-btn").forEach(btn=>btn.addEventListener("click",()=>{
  if(!desktopSidebarMedia.matches)closeMobileSidebar();
}));
window.addEventListener("keydown",e=>{
  if(e.key==="Escape"&&!desktopSidebarMedia.matches)closeMobileSidebar();
});
desktopSidebarMedia.addEventListener?.("change",applySidebarPreference);
applySidebarPreference();

document.querySelector("#themeBtn").onclick=()=>{state.theme=state.theme==="dark"?"light":"dark";localStorage.setItem("a8_theme",state.theme);setTheme();particleSystem?.reset()};
document.querySelector("#effectsBtn").onclick=()=>cycleEffectsMode();
document.querySelector("#resetBtn").onclick=()=>{
 if(confirm("Сбросить весь локальный прогресс курса?")){
   ["a8_completed","a8_attempts","a8_correct","a8_mistakes","a8_lastLesson","a8_streak","a8_effects"].forEach(k=>localStorage.removeItem(k));
   location.reload();
 }
};
window.addEventListener("beforeinstallprompt",e=>{
  e.preventDefault();
  installPrompt=e;
  document.querySelector("#installBtn").classList.remove("hidden");
});
document.querySelector("#installBtn").onclick=async()=>{
  if(!installPrompt)return;
  installPrompt.prompt();
  const choice=await installPrompt.userChoice;
  try{
    window.KitsuneAnalytics?.track?.("pwa_install_choice",{
      outcome:choice?.outcome||"unknown",
      platform:choice?.platform||""
    });
  }catch(e){}
  installPrompt=null;
};
if("serviceWorker" in navigator) window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js"));

function applyReveal(){
  const items = document.querySelectorAll(".reveal");
  if (!("IntersectionObserver" in window) || reduceMotionQuery.matches){
    items.forEach(el=>el.classList.add("in"));
    return;
  }
  const obs = new IntersectionObserver(entries=>{
    entries.forEach(entry=>{
      if(entry.isIntersecting){ entry.target.classList.add("in"); obs.unobserve(entry.target); }
    });
  },{threshold:.08});
  items.forEach(el=>obs.observe(el));
}

const particleSystem = {
  canvas:null, ctx:null, dpr:1, width:0, height:0, points:[], raf:0,
  pointer:{x:null,y:null},
  init(){
    this.canvas = document.getElementById("particlesCanvas");
    if(!this.canvas) return;
    this.ctx = this.canvas.getContext("2d");
    this.bind();
    this.reset();
  },
  bind(){
    window.addEventListener("resize",()=>this.reset());
    window.addEventListener("mousemove",(e)=>{
      this.pointer.x = e.clientX; this.pointer.y = e.clientY;
    }, {passive:true});
    window.addEventListener("mouseleave",()=>{this.pointer.x=null;this.pointer.y=null;});
  },
  getCount(){
    const mode = effectiveEffects();
    if(mode==="off") return 0;
    const mobile = window.innerWidth < 700 || isTouch;
    if(mode==="soft") return mobile ? 14 : 20;
    return mobile ? 18 : 34;
  },
  reset(){
    if(!this.canvas || !this.ctx) return;
    cancelAnimationFrame(this.raf);
    const mode = effectiveEffects();
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.canvas.width = this.width * this.dpr;
    this.canvas.height = this.height * this.dpr;
    this.canvas.style.width = this.width + "px";
    this.canvas.style.height = this.height + "px";
    this.ctx.setTransform(this.dpr,0,0,this.dpr,0,0);
    this.points = [];
    const count = this.getCount();
    for(let i=0;i<count;i++){
      this.points.push({
        x:Math.random()*this.width,
        y:Math.random()*this.height,
        vx:(Math.random()-.5)*(mode==="soft" ? .15 : .22),
        vy:(Math.random()-.5)*(mode==="soft" ? .15 : .22),
        r:Math.random()*2.3+1,
        hue: i%3===0 ? 220 : i%3===1 ? 265 : 195,
        alpha: Math.random()*.45+.18
      });
    }
    if(count) this.animate();
    else this.ctx.clearRect(0,0,this.width,this.height);
  },
  animate(){
    this.raf = requestAnimationFrame(()=>this.animate());
    const ctx = this.ctx;
    ctx.clearRect(0,0,this.width,this.height);
    const mode = effectiveEffects();
    const linkDist = mode==="soft" ? 82 : 110;

    for(const p of this.points){
      if(this.pointer.x != null && mode!=="soft"){
        const dx = this.pointer.x - p.x;
        const dy = this.pointer.y - p.y;
        const dist = Math.sqrt(dx*dx+dy*dy);
        if(dist < 130){
          p.vx -= dx / 60000;
          p.vy -= dy / 60000;
        }
      }
      p.x += p.vx;
      p.y += p.vy;
      if(p.x < -20) p.x = this.width + 20;
      if(p.x > this.width + 20) p.x = -20;
      if(p.y < -20) p.y = this.height + 20;
      if(p.y > this.height + 20) p.y = -20;

      const g = ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,p.r*10);
      g.addColorStop(0, `hsla(${p.hue}, 90%, 70%, ${p.alpha})`);
      g.addColorStop(1, `hsla(${p.hue}, 90%, 70%, 0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x,p.y,p.r*10,0,Math.PI*2);
      ctx.fill();

      ctx.fillStyle = `hsla(${p.hue}, 95%, 72%, ${Math.min(.95,p.alpha+.25)})`;
      ctx.beginPath();
      ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
      ctx.fill();
    }

    for(let i=0;i<this.points.length;i++){
      for(let j=i+1;j<this.points.length;j++){
        const a=this.points[i], b=this.points[j];
        const dx=a.x-b.x, dy=a.y-b.y;
        const dist=Math.sqrt(dx*dx+dy*dy);
        if(dist < linkDist){
          ctx.strokeStyle = `rgba(120,160,255,${(1-dist/linkDist)*.11})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(a.x,a.y);
          ctx.lineTo(b.x,b.y);
          ctx.stroke();
        }
      }
    }
  }
};

reduceMotionQuery.addEventListener?.("change", ()=>applyEffectsMode());

setTheme();
applyEffectsMode();
document.querySelector("#streakBadge").textContent=`🔥 ${state.streak} дней`;
particleSystem.init();
renderHome();
