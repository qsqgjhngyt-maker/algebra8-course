
/* =====================================================================
   v1.6.0 · AI TUTOR LITE
   Локальный офлайн-тьютор без API и внешней модели.
   ===================================================================== */
const v16MemoryKey="a8_tutor_memory_v16";
const v16HelpKey="a8_tutor_help_v16";
let v16Memory={errors:{},topics:{},recent:[]};
let v16Help={};
let v16Active=null;

try{
  v16Memory=Object.assign({errors:{},topics:{},recent:[]},JSON.parse(localStorage.getItem(v16MemoryKey)||"{}"));
  v16Help=JSON.parse(localStorage.getItem(v16HelpKey)||"{}");
}catch(e){}

const v16Profiles={
  "1-1":{first:"Начни со знаменателя: найди значения, при которых он равен нулю.",common:"Не забывай, что знаменатель дроби не может быть равен нулю.",concept:"ОДЗ задаёт, для каких значений выражение вообще имеет смысл."},
  "1-2":{first:"Разложи числитель и знаменатель на множители и ищи одинаковые множители.",common:"Сокращать можно множители, но не отдельные слагаемые внутри суммы.",concept:"Сокращение — это деление числителя и знаменателя на один и тот же ненулевой множитель."},
  "1-3":{first:"При одинаковых знаменателях работай только с числителями, а знаменатель сохрани.",common:"Не складывай знаменатели.",concept:"Доли одного размера складываются по количеству долей."},
  "1-4":{first:"Сначала найди общий знаменатель, затем приведи к нему каждую дробь.",common:"Домножай и числитель, и знаменатель на один и тот же множитель.",concept:"Складывать можно только доли одинакового размера."},
  "1-5":{first:"Перемножь числители между собой и знаменатели между собой; перед этим попробуй сократить.",common:"Степень дроби относится и к числителю, и к знаменателю.",concept:"Умножение дробей объединяет произведения числителей и знаменателей."},
  "1-6":{first:"Замени деление умножением на обратную дробь.",common:"Переворачивается только вторая дробь.",concept:"Деление на число равносильно умножению на обратное ему число."},
  "1-7":{first:"Определи порядок действий и упрощай выражение по одному действию.",common:"Сначала учитывай ОДЗ, затем выполняй преобразования.",concept:"Сложное рациональное выражение удобно превращать в цепочку простых операций."},
  "1-8":{first:"Для y=k/x выбери несколько ненулевых x и вычисли соответствующие y.",common:"x=0 не входит в область определения.",concept:"Чем больше |x|, тем ближе значение k/x к нулю."},
  "1-9":{first:"Попробуй представить числитель как часть, кратную знаменателю, плюс остаток.",common:"После выделения целой части проверь обратным сложением.",concept:"Это аналог деления с остатком для алгебраических выражений."},

  "2-1":{first:"Определи, к какому множеству относится число, и можно ли представить его обычной дробью.",common:"Не каждое бесконечное десятичное число иррационально: периодические дроби рациональны.",concept:"Рациональные и иррациональные числа вместе образуют множество действительных чисел."},
  "2-2":{first:"Ищи неотрицательное число, квадрат которого равен подкоренному выражению.",common:"Арифметический квадратный корень по определению неотрицателен.",concept:"√a — не два числа, а одно неотрицательное значение."},
  "2-3":{first:"Если x²=a и a>0, не забудь рассмотреть два противоположных значения x.",common:"В уравнении x²=a обычно появляются ±√a.",concept:"Квадраты противоположных чисел одинаковы."},
  "2-4":{first:"Найди два соседних квадрата, между которыми лежит подкоренное число.",common:"Сначала оцени порядок величины, потом уточняй.",concept:"Приближение корня удобно контролировать через квадраты ближайших чисел."},
  "2-5":{first:"Для графика y=√x бери только x≥0 и отмечай характерные квадратные значения.",common:"Графика при x<0 в действительных числах нет.",concept:"Функция √x обратна возведению неотрицательного числа в квадрат."},
  "2-6":{first:"Проверь условия, затем используй √(ab)=√a·√b или правило для дроби.",common:"Правила корней требуют допустимых неотрицательных выражений.",concept:"Корень распределяется по произведению допустимых множителей."},
  "2-7":{first:"Сначала определи чётность степени и знак выражения.",common:"√(a²)=|a|, а не просто a.",concept:"Квадрат теряет знак, поэтому при извлечении корня появляется модуль."},
  "2-8":{first:"Разложи подкоренное число на квадратный множитель и оставшуюся часть.",common:"Из-под корня полностью выходит только полный квадрат.",concept:"√(a²b)=|a|√b."},
  "2-9":{first:"Сначала упрости каждый корень и только потом складывай подобные радикалы.",common:"Складывать можно только одинаковые корневые части.",concept:"Подобные радикалы работают как подобные слагаемые."},
  "2-10":{first:"Попробуй представить выражение под внешним корнем как квадрат суммы или разности.",common:"После предположения обязательно возведи найденное выражение в квадрат для проверки.",concept:"Двойной радикал часто скрывает формулу квадрата суммы."},

  "3-1":{first:"Посмотри, какого члена не хватает, и вынеси общий множитель или извлеки корень.",common:"Перед делением на x помни, что x=0 может быть отдельным корнем.",concept:"Неполное квадратное уравнение часто решается без общей формулы."},
  "3-2":{first:"Приведи уравнение к ax²+bx+c=0 и аккуратно выпиши a, b, c.",common:"Особенно внимательно вычисляй D=b²−4ac и знак b в формуле корней.",concept:"Дискриминант определяет количество действительных корней."},
  "3-3":{first:"Сначала введи неизвестную величину и переведи условие задачи в уравнение.",common:"После решения обязательно проверь, подходят ли корни по смыслу задачи.",concept:"Уравнение — математическая модель связи величин из текста."},
  "3-4":{first:"Для приведённого x²+px+q=0 ищи числа с суммой −p и произведением q.",common:"Не перепутай знаки: x₁+x₂=−p.",concept:"Теорема Виета связывает коэффициенты и корни без вычисления дискриминанта."},
  "3-5":{first:"Найди корни трёхчлена, а затем свяжи их с множителями.",common:"Перед разложением учитывай старший коэффициент a.",concept:"Корни показывают, при каких x соответствующие линейные множители обращаются в ноль."},
  "3-6":{first:"Ищи общий множитель, формулу сокращённого умножения или корни квадратного трёхчлена.",common:"После разложения перемножь множители обратно для проверки.",concept:"Разложение превращает сложное выражение в произведение более простых."},
  "3-7":{first:"Сначала выпиши ОДЗ, затем умножь уравнение на общий знаменатель.",common:"Корень, запрещённый ОДЗ, нужно отбросить.",concept:"Умножение на общий знаменатель убирает дроби, но исходные ограничения сохраняются."},
  "3-8":{first:"Выбери неизвестную величину и вырази через неё остальные величины задачи.",common:"Проверяй единицы измерения и смысл найденных корней.",concept:"Хорошая модель переводит текст в одно или несколько уравнений."},
  "3-9":{first:"Вырази y через x, если это возможно, и построй несколько точек.",common:"Каждая точка графика должна удовлетворять уравнению.",concept:"График уравнения — множество всех пар (x;y), которые делают его верным."},
  "3-10":{first:"Выбери способ: подстановка или сложение. Старайся быстро убрать одну переменную.",common:"После нахождения одной переменной подставь её обратно для второй.",concept:"Решение системы должно одновременно удовлетворять обоим уравнениям."},
  "3-11":{first:"Построй оба графика в одной системе координат.",common:"Решение системы — координаты точки пересечения, а не отдельные пересечения с осями.",concept:"Общие точки графиков удовлетворяют обоим уравнениям."},
  "3-12":{first:"Преобразуй одно уравнение так, чтобы удобно выразить или исключить переменную.",common:"При умножении уравнения умножай каждый его член.",concept:"Алгебраические преобразования сохраняют множество решений системы."},
  "3-13":{first:"Назначь переменные величинам из условия и составь два независимых соотношения.",common:"В конце переведи найденную пару обратно на язык задачи.",concept:"Система нужна, когда неизвестных несколько и связей тоже несколько."},
  "3-14":{first:"Рассмотри, при каких значениях параметра меняется вид уравнения или число решений.",common:"Отдельно проверяй значения параметра, при которых коэффициент при неизвестной становится нулём.",concept:"Параметр задаёт семейство задач, поэтому ответ часто разбивается на случаи."},

  "4-1":{first:"Перенеси сравнение к знакомым числам или оцени разность левой и правой частей.",common:"Неравенство сравнивает порядок чисел, а не их абсолютные величины.",concept:"a>b означает, что разность a−b положительна."},
  "4-2":{first:"Определи, какое допустимое преобразование применяется к обеим частям.",common:"При умножении или делении на отрицательное число знак меняется.",concept:"Порядок сохраняется при одинаковом прибавлении и меняется при умножении на отрицательное."},
  "4-3":{first:"Применяй операции к обеим частям и следи за знаком множителя.",common:"Перед умножением неравенств проверь условия на знаки величин.",concept:"Свойства неравенств зависят от того, сохраняет ли операция порядок."},
  "4-4":{first:"Нарисуй множества на одной числовой прямой.",common:"Пересечение — общая часть, объединение — всё, что принадлежит хотя бы одному множеству.",concept:"Картинка на прямой помогает буквально увидеть операции над множествами."},
  "4-5":{first:"Определи, включены ли граничные точки: это выбирает круглую или квадратную скобку.",common:"Строгое неравенство не включает границу.",concept:"Интервал — компактная запись множества точек числовой прямой."},
  "4-6":{first:"Собери члены с x в одной части, числа — в другой, затем раздели на коэффициент.",common:"Если делишь на отрицательный коэффициент, переверни знак неравенства.",concept:"Линейное неравенство решается почти как уравнение, кроме правила отрицательного множителя."},
  "4-7":{first:"Реши каждое неравенство отдельно, затем найди пересечение решений.",common:"Для системы нужен общий участок, а не объединение.",concept:"Решение системы должно удовлетворять всем её неравенствам одновременно."},
  "4-8":{first:"Преобразуй требуемое неравенство к очевидно неотрицательному выражению или известному свойству.",common:"Каждый переход в доказательстве должен быть верен при данных условиях.",concept:"Доказательство показывает, почему утверждение верно для всех допустимых значений."},

  "5-1":{first:"Для области определения спроси: какие x разрешены? Для множества значений: какие y реально получаются?",common:"Не путай D(f) — входы x и E(f) — выходы y.",concept:"Функция сопоставляет каждому допустимому x ровно одно значение y."},
  "5-2":{first:"Смотри на график слева направо: где функция растёт, убывает, положительна или отрицательна.",common:"Свойство нужно указывать на конкретном промежутке.",concept:"График переводит свойства функции в геометрическую картину."},
  "5-3":{first:"В y=kx+b сначала найди b на оси y, затем используй коэффициент k как наклон.",common:"Знак k определяет направление роста или убывания.",concept:"k задаёт наклон прямой, b — её вертикальный сдвиг."},
  "5-4":{first:"Сначала вспомни области определения и общую форму каждого графика.",common:"У y=k/x исключён x=0, а у y=√x разрешены только x≥0.",concept:"Свойства функции напрямую связаны с ограничениями формулы и формой графика."},
  "5-5":{first:"Для целой части найди ближайшее целое снизу; дробная часть — остаток после его вычитания.",common:"Для отрицательных чисел целая часть — не просто отбрасывание дроби.",concept:"⌊x⌋ — наибольшее целое, не превосходящее x."},

  "6-1":{first:"Замени a^(−n) на 1/a^n и только потом вычисляй.",common:"Отрицательная степень не делает само число отрицательным.",concept:"Отрицательный показатель означает обратную величину."},
  "6-2":{first:"Применяй свойства степеней только к одинаковым основаниям и внимательно работай с показателями.",common:"При делении степеней показатели вычитаются.",concept:"Законы степеней — это сокращённая запись повторяющегося умножения."},
  "6-3":{first:"Перенеси запятую так, чтобы перед ней осталась одна ненулевая цифра, и посчитай сдвиги.",common:"Стандартная форма имеет 1≤|a|<10.",concept:"Показатель 10 хранит масштаб числа, а коэффициент — значащие цифры."},
  "6-4":{first:"Сначала переведи все величины в стандартный вид, затем отдельно работай с коэффициентами и степенями 10.",common:"После вычисления снова нормализуй коэффициент в диапазон от 1 до 10.",concept:"Стандартный вид делает вычисления с очень большими и малыми числами компактными."},
  "6-5":{first:"Для x⁻¹ и x⁻² перепиши функцию как дробь и сразу отметь x≠0.",common:"У x⁻² значения неотрицательны, а у x⁻¹ знак зависит от x.",concept:"Отрицательная степень превращает степень x в обратную зависимость."}
};

const v16ErrorText={
  empty:{name:"ответ ещё не введён",tip:"Введи хотя бы первый результат или промежуточный шаг — тогда я смогу сравнить его с задачей."},
  inequality_flip:{name:"знак неравенства",tip:"Похоже, граница получилась верной, но направление знака отличается. Проверь: не делил(а) ли ты на отрицательное число?"},
  sign:{name:"знак числа",tip:"Число по модулю похоже на правильное, но знак отличается. Проверь перенос слагаемого или действие с отрицательным числом."},
  domain:{name:"ОДЗ / ограничения",tip:"Здесь важно сначала проверить запрещённые значения — особенно знаменатель и область определения."},
  fraction:{name:"действия с дробями",tip:"Проверь общий знаменатель, сокращение только множителей и порядок действий с дробями."},
  radical:{name:"квадратные корни",tip:"Проверь, что можно вынести из-под корня, и не потерялся ли модуль при √(a²)."},
  quadratic:{name:"квадратное уравнение",tip:"Перепроверь коэффициенты a, b, c, затем дискриминант D=b²−4ac и знак перед b."},
  vieta:{name:"теорема Виета",tip:"Проверь сумму и произведение корней: для приведённого уравнения сумма равна −p, произведение — q."},
  system:{name:"система уравнений",tip:"Подставь найденную пару сразу в оба уравнения. Ошибка часто обнаруживается в одном из них."},
  interval:{name:"интервал / граница",tip:"Проверь, входит ли граничная точка в ответ: строгий знак даёт открытую границу."},
  exponent:{name:"степени",tip:"Проверь знак показателя и правило степеней. Отрицательная степень означает обратную величину."},
  scientific:{name:"стандартный вид",tip:"Коэффициент должен быть по модулю не меньше 1 и меньше 10; число сдвигов запятой задаёт степень 10."},
  function:{name:"функция / график",tip:"Проверь область определения и подставь координату точки в формулу функции."},
  arithmetic:{name:"вычисление",tip:"Метод может быть выбран правильно. Пересчитай последнее арифметическое действие и знаки."},
  generic:{name:"ход решения",tip:"Сравни свой последний шаг с ключевым правилом темы и проверь каждое преобразование по отдельности."}
};

function v16Save(){
  try{
    localStorage.setItem(v16MemoryKey,JSON.stringify(v16Memory));
    localStorage.setItem(v16HelpKey,JSON.stringify(v16Help));
  }catch(e){}
}
function v16Strip(s){
  const d=document.createElement("div");
  d.innerHTML=String(s??"");
  return (d.textContent||"").replace(/\s+/g," ").trim();
}
function v16Norm(s){
  return String(s??"").toLowerCase().trim()
    .replace(/\s+/g,"").replace(/−/g,"-").replace(/×|·/g,"*")
    .replace(/²/g,"^2").replace(/³/g,"^3").replace(/≥/g,">=").replace(/≤/g,"<=")
    .replace(/,/g,".");
}
function v16AcceptedArray(a){return Array.isArray(a)?a:[a]}
function v16SimpleNumber(s){
  s=v16Norm(s);
  if(/^[-+]?\d+(?:\.\d+)?$/.test(s))return Number(s);
  const m=s.match(/^([-+]?\d+(?:\.\d+)?)\/([-+]?\d+(?:\.\d+)?)$/);
  if(m&&Number(m[2])!==0)return Number(m[1])/Number(m[2]);
  return null;
}
function v16Match(value,accepted){
  try{
    if(typeof v1Match==="function"&&v1Match(value,accepted))return true;
  }catch(e){}
  const v=v16Norm(value);
  return v16AcceptedArray(accepted).some(a=>{
    const n=v16Norm(a);
    if(v===n)return true;
    const vn=v16SimpleNumber(v),an=v16SimpleNumber(n);
    return vn!==null&&an!==null&&Math.abs(vn-an)<1e-9;
  });
}
function v16ExpectedText(a){
  const arr=v16AcceptedArray(a).map(v16Strip).filter(Boolean);
  return arr.slice(0,3).join(" или ");
}
function v16ParseExercise(box){
  if(!box)return null;
  const key=box.dataset.ex;
  if(!key)return null;
  const parts=key.split("-");
  if(parts.length<3)return null;
  const tail=parts.pop();
  const lessonId=parts.join("-");
  let d=null,e=null,index=tail;
  try{
    d=lessonData?.[lessonId]||null;
    if(!d)return null;
    e=tail==="challenge"?d.challenge:d.exercises?.[Number(tail)];
  }catch(err){return null}
  if(!e)return null;
  return {key,lessonId,index,lesson:d,exercise:e,box};
}
function v16CurrentContext(){
  if(v16Active?.box?.isConnected)return v16Active;
  const focused=document.activeElement?.closest?.(".exercise[data-ex]");
  if(focused)return v16ParseExercise(focused);
  const lesson=document.querySelector(".lesson-panel");
  const first=lesson?.querySelector(".exercise[data-ex]:not(.success-flash)")||lesson?.querySelector(".exercise[data-ex]");
  return v16ParseExercise(first);
}
function v16Profile(ctx){
  return v16Profiles[ctx?.lessonId]||{
    first:"Определи, что известно, что требуется найти и какое правило текущей темы связывает эти величины.",
    common:v16Strip(ctx?.lesson?.mistake)||"Проверяй каждый переход отдельно и не меняй сразу несколько вещей в одной строке.",
    concept:v16Strip(ctx?.lesson?.why)||"Каждое преобразование должно сохранять смысл исходной задачи."
  };
}
function v16CandidateFromWork(text){
  const lines=String(text||"").split(/\n|;/).map(x=>x.trim()).filter(Boolean);
  let s=lines.at(-1)||"";
  if(s.includes("="))s=s.slice(s.lastIndexOf("=")+1).trim();
  if(/ответ\s*:/i.test(s))s=s.split(/ответ\s*:/i).at(-1).trim();
  return s;
}
function v16BoundarySignature(s){
  return v16Norm(s).replace(/[<>]=?|x|y|\(|\)|\[|\]/g,"");
}
function v16Classify(ctx,value){
  const user=v16Norm(value);
  const expected=v16AcceptedArray(ctx.exercise.a);
  const title=(v16Strip(ctx.lesson.title)+" "+v16Strip(ctx.exercise.q)+" "+v16Strip(ctx.exercise.hint)).toLowerCase();

  if(!user)return {type:"empty",correct:false};
  if(v16Match(value,expected))return {type:"correct",correct:true};

  const expNorm=expected.map(v16Norm);
  if(expNorm.some(e=>/[<>]/.test(e))&&/[<>]/.test(user)){
    if(expNorm.some(e=>v16BoundarySignature(e)===v16BoundarySignature(user) && ((e.includes("<")&&user.includes(">"))||(e.includes(">")&&user.includes("<"))))){
      return {type:"inequality_flip",correct:false};
    }
  }

  const un=v16SimpleNumber(user);
  for(const a of expected){
    const an=v16SimpleNumber(a);
    if(un!==null&&an!==null&&Math.abs(Math.abs(un)-Math.abs(an))<1e-9&&Math.sign(un)!==Math.sign(an)){
      return {type:"sign",correct:false};
    }
  }

  if(/одз|знамен|запрещ|област[ьи] определ/.test(title))return {type:"domain",correct:false};
  if(ctx.lessonId.startsWith("1-")||/\//.test(title))return {type:"fraction",correct:false};
  if(ctx.lessonId.startsWith("2-")||/корен|√|радикал/.test(title))return {type:"radical",correct:false};
  if(ctx.lessonId==="3-4"||/виет/.test(title))return {type:"vieta",correct:false};
  if(["3-1","3-2","3-3","3-5","3-6"].includes(ctx.lessonId)||/квадратн|дискриминант/.test(title))return {type:"quadratic",correct:false};
  if(["3-10","3-11","3-12","3-13"].includes(ctx.lessonId)||/систем/.test(title))return {type:"system",correct:false};
  if(["4-4","4-5","4-6","4-7"].includes(ctx.lessonId)||/интервал|промежут|неравен/.test(title))return {type:"interval",correct:false};
  if(["6-1","6-2","6-5"].includes(ctx.lessonId)||/степен/.test(title))return {type:"exponent",correct:false};
  if(["6-3","6-4"].includes(ctx.lessonId)||/стандартн|10\^/.test(title))return {type:"scientific",correct:false};
  if(ctx.lessonId.startsWith("5-")||/функц|график/.test(title))return {type:"function",correct:false};

  const expectedNums=expNorm.map(v16SimpleNumber).filter(x=>x!==null);
  if(un!==null&&expectedNums.length)return {type:"arithmetic",correct:false};
  return {type:"generic",correct:false};
}
function v16TopicMem(id){
  if(!v16Memory.topics[id])v16Memory.topics[id]={wrong:0,help:0,types:{}};
  return v16Memory.topics[id];
}
function v16RecordError(ctx,type,value){
  const t=v16TopicMem(ctx.lessonId);
  t.wrong=(t.wrong||0)+1;
  t.types[type]=(t.types[type]||0)+1;
  v16Memory.errors[type]=(v16Memory.errors[type]||0)+1;
  v16Memory.recent.unshift({lesson:ctx.lessonId,type,value:String(value??"").slice(0,80),ts:Date.now()});
  v16Memory.recent=v16Memory.recent.slice(0,30);
  v16Save();
}
function v16RecordHelp(ctx,level){
  const t=v16TopicMem(ctx.lessonId);
  t.help=(t.help||0)+1;
  v16Help[ctx.key]=level;
  v16Save();
}
function v16RepeatedType(ctx,type){
  return v16TopicMem(ctx.lessonId).types?.[type]||0;
}
function v16Adaptive(ctx,type){
  const t=v16TopicMem(ctx.lessonId);
  const repeated=type?v16RepeatedType(ctx,type):Math.max(0,...Object.values(t.types||{}));
  if(repeated>=3)return "Я вижу, что эта ошибка повторяется. Лучше перейти на уровень «Совсем просто» и решить один похожий пример медленно.";
  if((t.wrong||0)>=4)return "По этой теме уже было несколько ошибок. Не увеличиваем сложность: сначала закрепим один базовый алгоритм.";
  if((t.help||0)>=4)return "Подсказки здесь используются часто — после этой задачи стоит повторить первый разобранный пример урока.";
  return "";
}
function v16HintText(ctx,level){
  const p=v16Profile(ctx),d=ctx.lesson,e=ctx.exercise;
  const hint=v16Strip(e.hint);
  const formula=v16Strip(d.formula);
  const remember=v16Strip(d.remember);
  const mistake=v16Strip(d.mistake);

  if(level<=1){
    const tm=v16TopicMem(ctx.lessonId);
    if((tm.wrong||0)>=3){
      const simple=v16Strip(d.levels?.simple||d.simple||d.lead);
      if(simple)return `Начнём проще: ${simple.slice(0,220)}${simple.length>220?"…":""}`;
    }
    return hint?`Намёк: ${hint}`:`Намёк: ${p.first}`;
  }
  if(level===2){
    return `Первый шаг: ${p.first}${remember?` Запомни: ${remember}`:""}`;
  }
  if(level===3){
    return `Метод почти открыт: ${formula||p.concept} ${mistake?`Особенно проверь: ${mistake}`:`Частая ловушка: ${p.common}`}`;
  }
  return `Полный разбор: ${p.first} Затем используй правило: ${formula||p.concept} ${hint?`Для этого задания полезно: ${hint}`:""} Ожидаемый итог: ${v16ExpectedText(e.a)}. После этого подставь результат обратно или проверь обратным действием.`;
}
function v16WhyText(ctx){
  const why=v16Strip(ctx.lesson.why);
  const remember=v16Strip(ctx.lesson.remember);
  const p=v16Profile(ctx);
  return why?`Почему это работает: ${why}`:remember?`Смысл правила: ${remember} ${p.concept}`:`Почему: ${p.concept}`;
}
function v16DiagnosisText(ctx,value){
  const a=v16Classify(ctx,value);
  if(a.correct){
    return {ok:true,type:"correct",text:"Ход приводит к правильному результату. Теперь проверь, что каждый промежуточный переход можно объяснить правилом темы."};
  }
  const info=v16ErrorText[a.type]||v16ErrorText.generic;
  const adapt=v16Adaptive(ctx,a.type);
  return {ok:false,type:a.type,text:`Похоже на ошибку типа «${info.name}». ${info.tip}${adapt?` ${adapt}`:""}`};
}
function v16TutorPanel(){
  return `<div class="v16-tutor" id="v16Tutor">
    <div class="v16-tutor-head">
      <strong>🧠 AI Tutor Lite</strong>
      <span class="v16-offline-badge">● офлайн · без API</span>
    </div>
    <div class="v16-context" id="v16Context">Открой задание кнопкой «Альфи Tutor».</div>
    <div class="v16-help-row">
      <button type="button" class="v16-help-btn primary" id="v16NextHint">💡 Подсказка</button>
      <button type="button" class="v16-help-btn" id="v16Why">❓ Почему?</button>
      <button type="button" class="v16-help-btn" id="v16CheckWork">🔍 Проверь мой ход</button>
      <button type="button" class="v16-help-btn" id="v16ResetHints">↺ Сначала</button>
    </div>
    <div class="v16-help-meter" id="v16Meter"><span></span><span></span><span></span><span></span></div>
    <div class="v16-help-caption" id="v16HelpCaption">4 уровня помощи: намёк → первый шаг → явная подсказка → разбор.</div>
    <div class="v16-work-box" id="v16WorkBox">
      <textarea id="v16WorkInput" placeholder="Напиши промежуточные шаги или свой итоговый ответ…"></textarea>
      <div class="v16-work-actions"><button type="button" class="v15-action primary-action" id="v16AnalyzeWork">Проверить ход</button></div>
    </div>
    <div class="v16-tutor-result" id="v16Result"></div>
    <div class="v16-memory-chip" id="v16MemoryChip">🧠 Память ошибок: пока чисто</div>
    <div class="v16-adaptive-note" id="v16Adaptive" style="display:none"></div>
  </div>`;
}
function v16EnsurePanel(){
  const speech=document.querySelector("#v15Speech");
  if(!speech)return null;
  let panel=document.querySelector("#v16Tutor");
  if(panel)return panel;
  const actions=speech.querySelector(".v15-actions");
  if(actions&&!actions.querySelector(".v16-open-tutor")){
    const open=document.createElement("button");
    open.type="button";
    open.className="v15-action v16-open-tutor";
    open.textContent="🧠 Tutor Lite";
    open.title="Открыть локального математического тьютора";
    open.addEventListener("click",()=>{
      const ctx=v16CurrentContext();
      if(ctx)v16OpenTutor(ctx);
      else{
        panel?.classList.add("show");
        v16SetResult("Открой урок и выбери упражнение — тогда Tutor Lite увидит условие и твой ответ.");
      }
    });
    actions.appendChild(open);
  }
  if(actions)actions.insertAdjacentHTML("afterend",v16TutorPanel());
  else speech.insertAdjacentHTML("beforeend",v16TutorPanel());
  panel=document.querySelector("#v16Tutor");
  v16BindPanel(panel);
  return panel;
}
function v16SetResult(text,kind=""){
  const el=document.querySelector("#v16Result");
  if(!el)return;
  el.textContent=text;
  el.className=`v16-tutor-result show ${kind}`.trim();
}
function v16UpdatePanel(){
  const panel=v16EnsurePanel();
  if(!panel)return;
  const ctx=v16Active||v16CurrentContext();
  if(!ctx){
    panel.querySelector("#v16Context").textContent="Сейчас нет выбранного упражнения. Открой урок и нажми «🧠 Альфи Tutor» возле задания.";
    return;
  }
  v16Active=ctx;
  const q=v16Strip(ctx.exercise.q);
  panel.querySelector("#v16Context").innerHTML=`<b>${v16Strip(ctx.lesson.title)}</b><br>${q.slice(0,150)}${q.length>150?"…":""}`;
  const level=v16Help[ctx.key]||0;
  panel.querySelectorAll("#v16Meter span").forEach((s,i)=>s.classList.toggle("on",i<level));
  panel.querySelector("#v16HelpCaption").textContent=level
    ?`Открыто ${level} из 4 уровней помощи. Чем меньше уровней понадобится, тем лучше тренируется самостоятельное решение.`
    :"4 уровня помощи: намёк → первый шаг → явная подсказка → разбор.";

  const tm=v16TopicMem(ctx.lessonId);
  const common=Object.entries(tm.types||{}).sort((a,b)=>b[1]-a[1])[0];
  panel.querySelector("#v16MemoryChip").textContent=common
    ?`🧠 По теме: ${tm.wrong||0} ошибок · чаще «${(v16ErrorText[common[0]]||v16ErrorText.generic).name}»`
    :"🧠 Память ошибок: по этой теме пока чисто";

  const adapt=v16Adaptive(ctx,common?.[0]);
  const note=panel.querySelector("#v16Adaptive");
  if(adapt){note.textContent="🌱 "+adapt;note.style.display=""}
  else note.style.display="none";
}
function v16OpenTutor(ctx){
  if(!ctx)return;
  v16Active=ctx;

  /* v1.7.3: помощь по упражнению открывается ВНУТРИ самого задания,
     а не в огромном меню Альфи. */
  if(typeof window.v173OpenInline==="function"){
    window.v173OpenInline(ctx,{reason:"manual"});
    return;
  }

  /* fallback для старого движка, но без автоматического открытия Альфи */
  v16EnsurePanel()?.classList.add("show");
  v16UpdatePanel();
}
function v16NextHint(){
  const ctx=v16Active||v16CurrentContext();
  if(!ctx)return;
  let level=Math.min(4,(v16Help[ctx.key]||0)+1);
  v16RecordHelp(ctx,level);
  const text=v16HintText(ctx,level);
  v16SetResult(text,level===4?"warn":"");
  v16UpdatePanel();
}
function v16Why(){
  const ctx=v16Active||v16CurrentContext();
  if(!ctx)return;
  const text=v16WhyText(ctx);
  v16SetResult(text);
}
function v16ShowWork(){
  const box=document.querySelector("#v16WorkBox");
  if(!box)return;
  box.classList.toggle("show");
  if(box.classList.contains("show")){
    const ctx=v16Active||v16CurrentContext();
    const source=ctx?.box?.querySelector("input")?.value||"";
    const ta=document.querySelector("#v16WorkInput");
    if(ta&&!ta.value&&source)ta.value=source;
    setTimeout(()=>ta?.focus(),30);
  }
}
function v16AnalyzeWork(){
  const ctx=v16Active||v16CurrentContext();
  if(!ctx)return;
  const ta=document.querySelector("#v16WorkInput");
  const raw=(ta?.value||ctx.box.querySelector("input")?.value||"").trim();
  const candidate=v16CandidateFromWork(raw);
  const result=v16DiagnosisText(ctx,candidate);
  if(!result.ok)v16RecordError(ctx,result.type,candidate);
  v16SetResult(result.text,result.ok?"good":"warn");
  v16UpdatePanel();
}
function v16ResetHints(){
  const ctx=v16Active||v16CurrentContext();
  if(!ctx)return;
  v16Help[ctx.key]=0;
  v16Save();
  v16SetResult("Лестница подсказок закрыта. Попробуй ещё раз самостоятельно.");
  v16UpdatePanel();
}
function v16BindPanel(panel){
  panel.querySelector("#v16NextHint")?.addEventListener("click",v16NextHint);
  panel.querySelector("#v16Why")?.addEventListener("click",v16Why);
  panel.querySelector("#v16CheckWork")?.addEventListener("click",v16ShowWork);
  panel.querySelector("#v16AnalyzeWork")?.addEventListener("click",v16AnalyzeWork);
  panel.querySelector("#v16ResetHints")?.addEventListener("click",v16ResetHints);
}
function v16DecorateExercises(){
  document.querySelectorAll(".exercise[data-ex]").forEach(box=>{
    if(box.querySelector(".v16-tutor-btn"))return;
    const row=box.querySelector(".answer-row");
    if(!row)return;
    const btn=document.createElement("button");
    btn.type="button";
    btn.className="v16-tutor-btn";
    btn.innerHTML="🧠 Альфи Tutor";
    btn.title="Локальная помощь по этому заданию";
    btn.addEventListener("click",()=>v16OpenTutor(v16ParseExercise(box)));
    row.appendChild(btn);
  });
}
function v16FeedbackBad(ctx){
  const fb=ctx?.box?.querySelector(".feedback");
  return !!fb&&(fb.classList.contains("bad")||/Пока не/i.test(fb.textContent||""));
}
function v16OnWrong(ctx){
  const input=ctx.box.querySelector("input")?.value||"";
  const a=v16Classify(ctx,input);
  if(a.correct||a.type==="empty")return;
  v16RecordError(ctx,a.type,input);
  const repeat=v16RepeatedType(ctx,a.type);
  const info=v16ErrorText[a.type]||v16ErrorText.generic;
  const btn=ctx.box.querySelector(".v16-tutor-btn");
  if(btn){
    btn.classList.remove("v16-repeat");void btn.offsetWidth;btn.classList.add("v16-repeat");
    setTimeout(()=>btn.classList.remove("v16-repeat"),800);
  }
  /* v1.7.3: никакого открытия меню Альфи после «Проверить».
     Сразу показываем конкретный inline-разбор этого примера. */
  v16Active=ctx;
  if(typeof window.v173OpenInline==="function"){
    window.v173OpenInline(ctx,{reason:"wrong",errorType:a.type,userValue:input,repeat});
  }else{
    try{v15Chip?.(`Проверь: ${(v16ErrorText[a.type]||v16ErrorText.generic).name}`)}catch(e){}
  }
}

/* Запоминаем последнее упражнение, с которым реально работал ученик. */
document.addEventListener("focusin",e=>{
  const box=e.target.closest?.(".exercise[data-ex]");
  if(box){
    const ctx=v16ParseExercise(box);
    if(ctx)v16Active=ctx;
  }
});
document.addEventListener("pointerdown",e=>{
  const box=e.target.closest?.(".exercise[data-ex]");
  if(box){
    const ctx=v16ParseExercise(box);
    if(ctx)v16Active=ctx;
  }
},{passive:true});

/* Перехватываем только факт результата после штатной проверки, не вмешиваясь в проверяющую логику курса. */
document.addEventListener("click",e=>{
  const btn=e.target.closest?.("button");
  if(!btn)return;
  const box=btn.closest(".exercise[data-ex]");
  if(!box)return;
  const onclick=btn.getAttribute("onclick")||"";
  const isCheck=btn.classList.contains("check-btn")||/v1CheckAnswer|v1CheckChallenge|ch1CheckAnswer|ch1CheckChallenge/.test(onclick);
  if(!isCheck)return;
  const ctx=v16ParseExercise(box);
  setTimeout(()=>{if(ctx&&v16FeedbackBad(ctx))v16OnWrong(ctx)},170);
});

/* После каждого рендера урока добавляем кнопку Tutor рядом с упражнениями. */
const v16Content=document.querySelector("#content");
if(v16Content){
  let scheduled=false;
  new MutationObserver(()=>{
    if(scheduled)return;
    scheduled=true;
    setTimeout(()=>{
      scheduled=false;
      v16DecorateExercises();
      if(document.querySelector("#v16Tutor")?.classList.contains("show"))v16UpdatePanel();
    },60);
  }).observe(v16Content,{childList:true,subtree:true});
}
/* v1.7.3: старую большую панель Tutor внутри меню Альфи больше не создаём. */
v16DecorateExercises();

/* Экспортируем минимум для диагностики и будущего онлайн-слоя. */
window.AlfiTutorLite={
  version:"1.7.3",
  offline:true,
  classify:(lessonId,index,value)=>{
    try{
      const d=lessonData[lessonId],e=index==="challenge"?d.challenge:d.exercises[Number(index)];
      return v16Classify({lessonId,lesson:d,exercise:e},value);
    }catch(e){return {type:"generic",correct:false}}
  },
  memory:()=>JSON.parse(JSON.stringify(v16Memory)),
  openCurrent:()=>v16OpenTutor(v16CurrentContext())
};
