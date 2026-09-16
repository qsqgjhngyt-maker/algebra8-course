(() => {
  "use strict";
  const c=window.KitsuneCurriculum;
  if(!c?.tracks)return;
  c.version="3.1.0-alpha.6";
  c.basis={
    checkedAt:"2026-09-15",
    school:"Федеральные рабочие программы ЕДСОО (актуальная публикация на дату сверки)",
    exam:"Проекты КИМ ФИПИ 2027; статус перепроверять после 30.09.2026"
  };

  const tr=id=>c.tracks.find(x=>x.id===id);
  const sec=(track,id)=>track?.sections?.find(x=>x.id===id);
  const ch=(section,id)=>section?.chapters?.find(x=>x.id===id);
  const hasTopic=(track,id)=>track.sections.some(s=>s.chapters.some(c=>c.topics.some(t=>t.id===id)));
  function addTopic(track,sectionId,chapterId,topic){
    if(!track||hasTopic(track,topic.id))return;
    const chapter=ch(sec(track,sectionId),chapterId); if(!chapter)return;
    chapter.topics.push(topic);
  }
  function addChapter(track,sectionId,chapter){
    const section=sec(track,sectionId); if(!section||section.chapters.some(x=>x.id===chapter.id))return;
    section.chapters.push(chapter);
  }
  function removeChapter(track,sectionId,chapterId){
    const section=sec(track,sectionId); if(!section)return;
    section.chapters=section.chapters.filter(x=>x.id!==chapterId);
  }
  function mark(track){
    for(const s of track.sections)for(const cc of s.chapters)for(const t of cc.topics){
      if(!t.level)t.level="core";
      if(!t.source)t.source="curriculum-map";
    }
  }

  // 7 класс — добираем обязательные линии углублённой ФРП 2025/2026.
  {
    const t=tr("grade7");
    addTopic(t,"g7-alg","g7-a1",{id:"g7-a1-7",title:"Позиционная запись числа и разряды",level:"advanced"});
    addTopic(t,"g7-alg","g7-a1",{id:"g7-a1-8",title:"Делимость целых чисел",level:"advanced"});
    addTopic(t,"g7-alg","g7-a1",{id:"g7-a1-9",title:"Простые и составные числа",level:"advanced"});
    addTopic(t,"g7-alg","g7-a1",{id:"g7-a1-10",title:"Признаки делимости",level:"advanced"});
    addTopic(t,"g7-alg","g7-a1",{id:"g7-a1-11",title:"НОД, НОК и взаимно простые числа",level:"advanced"});
    addTopic(t,"g7-alg","g7-a1",{id:"g7-a1-12",title:"Алгоритм Евклида",level:"advanced"});
    addTopic(t,"g7-alg","g7-a1",{id:"g7-a1-13",title:"Деление с остатком и арифметика остатков",level:"advanced"});
    addTopic(t,"g7-alg","g7-a2",{id:"g7-a2-7",title:"Тождества и доказательство тождеств",level:"advanced"});
    addTopic(t,"g7-alg","g7-a3",{id:"g7-a3-6",title:"Деление многочленов и корни многочлена",level:"advanced"});
    addTopic(t,"g7-alg","g7-a3",{id:"g7-a3-7",title:"Разложение многочлена методом группировки",level:"advanced"});
    addTopic(t,"g7-alg","g7-a5",{id:"g7-a5-7",title:"Линейное уравнение со знаком модуля",level:"advanced"});
    addTopic(t,"g7-alg","g7-a6",{id:"g7-a6-7",title:"Числовые промежутки и расстояние на прямой",level:"advanced"});
    addTopic(t,"g7-alg","g7-a6",{id:"g7-a6-8",title:"Область определения и область значений функции",level:"advanced"});
    addTopic(t,"g7-alg","g7-a6",{id:"g7-a6-9",title:"Способы задания функции",level:"advanced"});
    addTopic(t,"g7-alg","g7-a6",{id:"g7-a6-10",title:"Возрастание, убывание, максимум и минимум по графику",level:"advanced"});
    addTopic(t,"g7-alg","g7-a6",{id:"g7-a6-11",title:"Функция y = |x| и кусочно-заданные функции",level:"advanced"});

    addTopic(t,"g7-geo","g7-g1",{id:"g7-g1-6",title:"Аксиома, теорема, определение и доказательство",level:"advanced"});
    addTopic(t,"g7-geo","g7-g1",{id:"g7-g1-7",title:"Ломаные, многоугольники и периметр",level:"advanced"});
    addTopic(t,"g7-geo","g7-g1",{id:"g7-g1-8",title:"Выпуклые и невыпуклые многоугольники",level:"advanced"});
    addTopic(t,"g7-geo","g7-g1",{id:"g7-g1-9",title:"Расстояние от точки до прямой и биссектриса угла",level:"advanced"});
    addTopic(t,"g7-geo","g7-g2",{id:"g7-g2-7",title:"Осевая симметрия",level:"advanced"});
    addTopic(t,"g7-geo","g7-g3",{id:"g7-g3-4",title:"Сумма внутренних и внешних углов многоугольника",level:"advanced"});
    addTopic(t,"g7-geo","g7-g4",{id:"g7-g4-6",title:"Признаки равенства прямоугольных треугольников",level:"advanced"});
    addTopic(t,"g7-geo","g7-g4",{id:"g7-g4-7",title:"Перпендикуляр и наклонная",level:"advanced"});
    addTopic(t,"g7-geo","g7-g4",{id:"g7-g4-8",title:"Медиана к гипотенузе и угол 30°",level:"advanced"});
    addChapter(t,"g7-geo",{id:"g7-g5",title:"Окружность и геометрические места точек",topics:[
      {id:"g7-g5-1",title:"Окружность, круг и их элементы",level:"advanced"},
      {id:"g7-g5-2",title:"Касательная и секущая к окружности",level:"advanced"},
      {id:"g7-g5-3",title:"Окружность, вписанная в угол",level:"advanced"},
      {id:"g7-g5-4",title:"Геометрическое место точек",level:"advanced"},
      {id:"g7-g5-5",title:"Серединный перпендикуляр как ГМТ",level:"advanced"},
      {id:"g7-g5-6",title:"Описанная окружность треугольника и её центр",level:"advanced"},
      {id:"g7-g5-7",title:"Задачи на построение циркулем и линейкой",level:"advanced"}
    ]});

    addTopic(t,"g7-stat","g7-s1",{id:"g7-s1-6",title:"Квартили",level:"advanced"});
    addTopic(t,"g7-stat","g7-s1",{id:"g7-s1-7",title:"Среднее гармоническое",level:"advanced"});
    addTopic(t,"g7-stat","g7-s1",{id:"g7-s1-8",title:"Частоты, группировка данных и статистическая устойчивость",level:"advanced"});
    addChapter(t,"g7-stat",{id:"g7-s3",title:"Графы и логика",topics:[
      {id:"g7-s3-1",title:"Граф, вершина и ребро",level:"advanced"},
      {id:"g7-s3-2",title:"Степень вершины и сумма степеней",level:"advanced"},
      {id:"g7-s3-3",title:"Пути, цепи, циклы и связность",level:"advanced"},
      {id:"g7-s3-4",title:"Эйлеров путь и ориентированные графы",level:"advanced"},
      {id:"g7-s3-5",title:"Высказывания и отрицание",level:"advanced"},
      {id:"g7-s3-6",title:"Условные, обратные и равносильные утверждения",level:"advanced"},
      {id:"g7-s3-7",title:"Необходимые и достаточные условия",level:"advanced"},
      {id:"g7-s3-8",title:"Доказательство от противного",level:"advanced"}
    ]});
    mark(t);
  }

  // 8 класс — геометрия и вероятность/статистика по ФРП; 51 алгебраический урок остаётся legacy-эталоном.
  {
    const t=tr("grade8");
    addTopic(t,"g8-geo","g8-g1",{id:"g8-g1-6",title:"Трапеция и её виды",level:"advanced"});
    addTopic(t,"g8-geo","g8-g1",{id:"g8-g1-7",title:"Средняя линия трапеции",level:"advanced"});
    addTopic(t,"g8-geo","g8-g1",{id:"g8-g1-8",title:"Пересечение медиан треугольника",level:"advanced"});
    addTopic(t,"g8-geo","g8-g1",{id:"g8-g1-9",title:"Теорема Вариньона",level:"advanced"});
    addTopic(t,"g8-geo","g8-g2",{id:"g8-g2-6",title:"Площадь ромба и свойства площадей",level:"advanced"});
    addTopic(t,"g8-geo","g8-g2",{id:"g8-g2-7",title:"Площади подобных фигур",level:"advanced"});
    addChapter(t,"g8-geo",{id:"g8-g5",title:"Элементы тригонометрии",topics:[
      {id:"g8-g5-1",title:"Синус острого угла",level:"advanced"},
      {id:"g8-g5-2",title:"Косинус острого угла",level:"advanced"},
      {id:"g8-g5-3",title:"Тангенс и котангенс острого угла",level:"advanced"},
      {id:"g8-g5-4",title:"Значения для углов 30°, 45° и 60°",level:"advanced"},
      {id:"g8-g5-5",title:"Пропорциональные отрезки в прямоугольном треугольнике",level:"advanced"}
    ]});
    addTopic(t,"g8-geo","g8-g4",{id:"g8-g4-5",title:"Угол между касательной и хордой",level:"advanced"});
    addTopic(t,"g8-geo","g8-g4",{id:"g8-g4-6",title:"Углы между хордами и секущими",level:"advanced"});
    addTopic(t,"g8-geo","g8-g4",{id:"g8-g4-7",title:"Вписанный четырёхугольник: свойства и признаки",level:"advanced"});
    addTopic(t,"g8-geo","g8-g4",{id:"g8-g4-8",title:"Взаимное расположение и касание двух окружностей",level:"advanced"});
    addTopic(t,"g8-geo","g8-g4",{id:"g8-g4-9",title:"Общие касательные к двум окружностям",level:"advanced"});

    addChapter(t,"g8-stat",{id:"g8-s3",title:"Множества, деревья и логика",topics:[
      {id:"g8-s3-1",title:"Множество и подмножество",level:"advanced"},
      {id:"g8-s3-2",title:"Пересечение и объединение множеств",level:"advanced"},
      {id:"g8-s3-3",title:"Диаграммы Эйлера",level:"advanced"},
      {id:"g8-s3-4",title:"Организованный перебор и правило умножения",level:"advanced"},
      {id:"g8-s3-5",title:"Формула включения-исключения",level:"advanced"},
      {id:"g8-s3-6",title:"Деревья и дерево случайного эксперимента",level:"advanced"},
      {id:"g8-s3-7",title:"Логические союзы «И» и «ИЛИ»",level:"advanced"}
    ]});
    addTopic(t,"g8-stat","g8-s1",{id:"g8-s1-5",title:"Дисперсия и стандартное отклонение",level:"advanced"});
    addTopic(t,"g8-stat","g8-s2",{id:"g8-s2-4",title:"Условная вероятность",level:"advanced"});
    addTopic(t,"g8-stat","g8-s2",{id:"g8-s2-5",title:"Правило умножения вероятностей",level:"advanced"});
    addTopic(t,"g8-stat","g8-s2",{id:"g8-s2-6",title:"Событие как множество элементарных событий",level:"advanced"});
    mark(t);
  }

  // 9 класс — добавляем линии, явно присутствующие в углублённой ФРП.
  {
    const t=tr("grade9");
    addTopic(t,"g9-alg","g9-a6",{id:"g9-a6-6",title:"Корень n-й степени и степень с рациональным показателем",level:"advanced"});
    addTopic(t,"g9-alg","g9-a2",{id:"g9-a2-6",title:"Разложение квадратного трёхчлена на множители",level:"advanced"});
    addTopic(t,"g9-alg","g9-a3",{id:"g9-a3-7",title:"Биквадратные уравнения и замена переменной",level:"advanced"});
    addTopic(t,"g9-alg","g9-a3",{id:"g9-a3-8",title:"Нелинейные системы двух переменных",level:"advanced"});
    addTopic(t,"g9-alg","g9-a2",{id:"g9-a2-7",title:"Неравенства с двумя переменными",level:"advanced"});
    addTopic(t,"g9-alg","g9-a2",{id:"g9-a2-8",title:"Системы неравенств с двумя переменными",level:"advanced"});
    addTopic(t,"g9-alg","g9-a1",{id:"g9-a1-6",title:"Дробно-линейная функция",level:"advanced"});
    addTopic(t,"g9-alg","g9-a4",{id:"g9-a4-5",title:"Способы задания и свойства последовательностей",level:"advanced"});
    addTopic(t,"g9-alg","g9-a5",{id:"g9-a5-5",title:"Бесконечно убывающая геометрическая прогрессия",level:"advanced"});
    addTopic(t,"g9-alg","g9-a5",{id:"g9-a5-6",title:"Сложные проценты, вклады и кредиты",level:"advanced"});
    addTopic(t,"g9-alg","g9-a6",{id:"g9-a6-7",title:"Метод математической индукции — введение",level:"advanced"});

    addTopic(t,"g9-geo","g9-g2",{id:"g9-g2-5",title:"Формула Герона и тригонометрические формулы площади",level:"advanced"});
    addTopic(t,"g9-geo","g9-g3",{id:"g9-g3-5",title:"Хорды, секущие и касательная: метрические соотношения",level:"advanced"});
    addTopic(t,"g9-geo","g9-g3",{id:"g9-g3-6",title:"Теоремы Чевы и Менелая",level:"advanced"});
    addTopic(t,"g9-geo","g9-g1",{id:"g9-g1-6",title:"Уравнение прямой и окружности",level:"advanced"});
    addTopic(t,"g9-geo","g9-g1",{id:"g9-g1-7",title:"Скалярное произведение векторов",level:"advanced"});
    addTopic(t,"g9-geo","g9-g3",{id:"g9-g3-7",title:"Длина дуги, сектор и сегмент",level:"advanced"});

    addTopic(t,"g9-stat","g9-s1",{id:"g9-s1-4",title:"Треугольник Паскаля и бином Ньютона",level:"advanced"});
    addTopic(t,"g9-stat","g9-s2",{id:"g9-s2-5",title:"Геометрическая вероятность",level:"advanced"});
    addTopic(t,"g9-stat","g9-s2",{id:"g9-s2-6",title:"Испытания Бернулли",level:"advanced"});
    addTopic(t,"g9-stat","g9-s2",{id:"g9-s2-7",title:"Случайная величина и распределение вероятностей",level:"advanced"});
    addTopic(t,"g9-stat","g9-s2",{id:"g9-s2-8",title:"Математическое ожидание",level:"advanced"});
    addTopic(t,"g9-stat","g9-s2",{id:"g9-s2-9",title:"Дисперсия случайной величины",level:"advanced"});
    addTopic(t,"g9-stat","g9-s2",{id:"g9-s2-10",title:"Закон больших чисел — введение",level:"advanced"});
    mark(t);
  }

  // 10 класс — базовую линию приводим к ФРП: производную не считаем обязательной темой 10 класса.
  {
    const t=tr("grade10");
    removeChapter(t,"g10-alg","g10-a6");
    addChapter(t,"g10-alg",{id:"g10-a6b",title:"Последовательности, множества и логика",topics:[
      {id:"g10-a6b-1",title:"Числовые последовательности и способы задания",level:"core"},
      {id:"g10-a6b-2",title:"Монотонные последовательности",level:"core"},
      {id:"g10-a6b-3",title:"Арифметическая прогрессия",level:"core"},
      {id:"g10-a6b-4",title:"Геометрическая прогрессия",level:"core"},
      {id:"g10-a6b-5",title:"Бесконечно убывающая геометрическая прогрессия",level:"core"},
      {id:"g10-a6b-6",title:"Формула сложных процентов",level:"core"},
      {id:"g10-a6b-7",title:"Множества и операции над множествами",level:"core"},
      {id:"g10-a6b-8",title:"Диаграммы Эйлера—Венна",level:"core"},
      {id:"g10-a6b-9",title:"Определение, теорема, следствие и доказательство",level:"core"}
    ]});
    addTopic(t,"g10-alg","g10-a1",{id:"g10-a1-5",title:"Стандартная форма действительного числа и оценка результата",level:"core"});
    addTopic(t,"g10-alg","g10-a2",{id:"g10-a2-7",title:"Арксинус, арккосинус и арктангенс",level:"core"});
    addTopic(t,"g10-alg","g10-a4",{id:"g10-a4-5",title:"Целые и дробно-рациональные уравнения и неравенства",level:"core"});
    addTopic(t,"g10-alg","g10-a4",{id:"g10-a4-6",title:"Иррациональные уравнения и неравенства",level:"core"});

    addTopic(t,"g10-geo","g10-g1",{id:"g10-g1-5",title:"Параллельность плоскостей",level:"core"});
    addTopic(t,"g10-geo","g10-g1",{id:"g10-g1-6",title:"Сечения простейших многогранников",level:"core"});
    addTopic(t,"g10-geo","g10-g2",{id:"g10-g2-5",title:"Расстояния в пространстве",level:"core"});
    addTopic(t,"g10-geo","g10-g3",{id:"g10-g3-6",title:"Усечённая пирамида",level:"core"});
    addTopic(t,"g10-geo","g10-g3",{id:"g10-g3-7",title:"Симметрия в пространстве",level:"core"});
    addTopic(t,"g10-geo","g10-g3",{id:"g10-g3-8",title:"Объёмы призмы и пирамиды",level:"core"});
    addTopic(t,"g10-geo","g10-g3",{id:"g10-g3-9",title:"Подобные тела и отношения объёмов",level:"core"});

    addChapter(t,"g10-stat",{id:"g10-s3",title:"Данные, деревья и распределения",topics:[
      {id:"g10-s3-1",title:"Дисперсия и стандартное отклонение числового набора",level:"core"},
      {id:"g10-s3-2",title:"Операции над событиями и диаграммы Эйлера",level:"core"},
      {id:"g10-s3-3",title:"Дерево случайного эксперимента",level:"core"},
      {id:"g10-s3-4",title:"Формула полной вероятности",level:"core"},
      {id:"g10-s3-5",title:"Перестановки и факториал",level:"core"},
      {id:"g10-s3-6",title:"Сочетания и треугольник Паскаля",level:"core"},
      {id:"g10-s3-7",title:"Бином Ньютона",level:"core"},
      {id:"g10-s3-8",title:"Серия испытаний до первого успеха",level:"core"},
      {id:"g10-s3-9",title:"Серия испытаний Бернулли",level:"core"},
      {id:"g10-s3-10",title:"Случайная величина и распределение вероятностей",level:"core"},
      {id:"g10-s3-11",title:"Геометрическое и биномиальное распределения",level:"core"}
    ]});
    mark(t);
  }

  // 11 класс — уточняем базовую ФРП и обязательную вероятность/статистику.
  {
    const t=tr("grade11");
    addTopic(t,"g11-alg","g11-a1",{id:"g11-a1-7",title:"Геометрический и физический смысл производной",level:"core"});
    addTopic(t,"g11-alg","g11-a1",{id:"g11-a1-8",title:"Непрерывность функции — базовое представление",level:"core"});
    addTopic(t,"g11-alg","g11-a3",{id:"g11-a3-5",title:"Показательная функция: свойства и график",level:"core"});
    addTopic(t,"g11-alg","g11-a4",{id:"g11-a4-6",title:"Десятичный и натуральный логарифмы",level:"core"});
    addTopic(t,"g11-geo","g11-g1",{id:"g11-g1-5",title:"Координаты и расстояния в пространстве",level:"core"});
    addTopic(t,"g11-geo","g11-g2",{id:"g11-g2-6",title:"Усечённый конус",level:"core"});
    addTopic(t,"g11-geo","g11-g2",{id:"g11-g2-7",title:"Сечения цилиндра, конуса и шара",level:"core"});
    addTopic(t,"g11-geo","g11-g2",{id:"g11-g2-8",title:"Комбинации тел вращения и многогранников",level:"core"});
    addTopic(t,"g11-stat","g11-s1",{id:"g11-s1-5",title:"Стандартное отклонение случайной величины",level:"core"});
    addTopic(t,"g11-stat","g11-s2",{id:"g11-s2-5",title:"Закон больших чисел",level:"core"});
    addTopic(t,"g11-stat","g11-s2",{id:"g11-s2-6",title:"Выборочный метод",level:"core"});
    addTopic(t,"g11-stat","g11-s2",{id:"g11-s2-7",title:"Непрерывная случайная величина и плотность",level:"core"});
    addTopic(t,"g11-stat","g11-s2",{id:"g11-s2-8",title:"Нормальное распределение",level:"core"});
    mark(t);
  }

  for(const x of c.tracks){
    x.curriculumCheckedAt="2026-09-15";
    x.curriculumStatus=x.exam?"ФИПИ-2027: проект до завершения общественного обсуждения":"сверено с ФРП";
  }
})();
