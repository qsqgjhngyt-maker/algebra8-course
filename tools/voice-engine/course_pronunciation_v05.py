"""Произношение формул для нового пакета. Утверждённый словарь не меняется."""
import re
from kitsune_pronunciation import prepare_math_text

LETTERS = dict(a="а", b="бэ", c="цэ", d="дэ", e="е", f="эф", g="гэ", h="аш",
               i="и", j="йот", k="ка", l="эль", m="эм", n="эн", o="о", p="пэ",
               q="ку", r="эр", s="эс", t="тэ", u="у", v="вэ", w="дубль вэ", x="икс", y="игрек", z="зэт")
ONES = ["ноль", "один", "два", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять"]
TEENS = ["десять", "одиннадцать", "двенадцать", "тринадцать", "четырнадцать", "пятнадцать", "шестнадцать", "семнадцать", "восемнадцать", "девятнадцать"]
TENS = ["", "", "двадцать", "тридцать", "сорок", "пятьдесят", "шестьдесят", "семьдесят", "восемьдесят", "девяносто"]
HUNDREDS = ["", "сто", "двести", "триста", "четыреста", "пятьсот", "шестьсот", "семьсот", "восемьсот", "девятьсот"]

def plural(n, forms):
    return forms[2] if 11 <= n % 100 <= 14 else forms[0] if n % 10 == 1 else forms[1] if 2 <= n % 10 <= 4 else forms[2]

def integer(n, feminine=False):
    if not 0 <= n < 1_000_000:
        raise ValueError("Число требует отдельной подготовки: " + str(n))
    if n == 0:
        return "ноль"
    parts = []
    if n >= 1000:
        thousands, n = divmod(n, 1000)
        parts += [integer(thousands, True), plural(thousands, ("тысяча", "тысячи", "тысяч"))]
    if n >= 100:
        parts.append(HUNDREDS[n // 100]); n %= 100
    if 10 <= n < 20:
        parts.append(TEENS[n - 10])
    else:
        if n >= 20:
            parts.append(TENS[n // 10]); n %= 10
        if n:
            parts.append("одна" if feminine and n == 1 else "две" if feminine and n == 2 else ONES[n])
    return " ".join(parts)

def number(value):
    pieces = re.split(r"[.,]", value)
    if len(pieces) == 1:
        return integer(int(value))
    whole, fraction = pieces
    names = {1: ("десятая", "десятых", "десятых"), 2: ("сотая", "сотых", "сотых"), 3: ("тысячная", "тысячных", "тысячных")}
    if len(fraction) not in names:
        raise ValueError("Десятичная дробь требует подготовки: " + value)
    a, b = int(whole), int(fraction)
    return f"{integer(a, True)} {plural(a, ('целая', 'целых', 'целых'))} и {integer(b, True)} {plural(b, names[len(fraction)])}"

def simple_math(value):
    value = re.sub(r"\b(?:sqrt)\b", "квадратный корень из", value, flags=re.I)
    value = re.sub(r"\b(?:sin|cos|tg)\b", lambda m: {"sin":"синус", "cos":"косинус", "tg":"тангенс"}[m[0].lower()], value, flags=re.I)
    value = re.sub(r"[A-Za-z]+", lambda m: " умножить на ".join(LETTERS[c.lower()] for c in m[0]), value)
    value = re.sub(r"\d+(?:[.,]\d+)?", lambda m: number(m[0]), value)
    value = value.replace("²", " в квадрате ").replace("³", " в кубе ")
    value = re.sub(r"\^|\*\*", " в степени ", value)
    operators = {"≠":"не равно", "!=":"не равно", "≤":"меньше или равно", "<=":"меньше или равно", "≥":"больше или равно", ">=":"больше или равно", "=":"равно", "+":"плюс", "−":"минус", "-":"минус", "·":"умножить на", "×":"умножить на", "*":"умножить на", "/":"делить на", "<":"меньше", ">":"больше", "√":"квадратный корень из", "±":"плюс минус", "%":"процентов", "π":"пи", "Δ":"дельта"}
    pattern = "|".join(re.escape(k) for k in sorted(operators, key=len, reverse=True))
    value = re.sub(pattern, lambda m: m[0] if m[0] == "-" and re.search(r"[А-Яа-яЁё]$", value[:m.start()]) and re.match(r"[А-Яа-яЁё]", value[m.end():]) else " " + operators[m[0]] + " ", value)
    value = value.replace("(", " открываем скобку ").replace(")", " закрываем скобку ")
    return re.sub(r"\s+", " ", value).strip()

def prepare_course_text(text):
    if re.search(r"</?(?:span|div|sup|sub|em|strong)\b", text):
        raise ValueError("В тексте voice найден HTML; требуется отдельная подготовка")
    text = re.sub(r"\bОДЗ\b", "область допустимых значений", text)
    atom = r"(?:\([^()]+\)|[A-Za-z0-9]+(?:[²³])?)"
    fraction = re.compile(rf"(?P<n>{atom})\s*/\s*(?P<d>{atom})")
    def replace_fraction(m):
        n, d = m["n"], m["d"]
        if n.startswith("(") or d.startswith("("):
            return "дробь с числителем " + simple_math(n.strip("()")) + " и знаменателем " + simple_math(d.strip("()"))
        return simple_math(n) + " делить на " + simple_math(d)
    text = fraction.sub(replace_fraction, text)
    text = simple_math(text)
    return prepare_math_text(text)

def split_course_text(text, maximum=220):
    # Сохраняем исходный текст; prepared_text — отдельное произношение.
    sentences = re.findall(r".*?(?:[.!?…]+(?=\s|$)|$)", text)
    pieces = []
    for sentence in sentences:
        words = sentence.split()
        buffer = []
        for word in words:
            candidate = " ".join(buffer + [word])
            if buffer and len(prepare_course_text(candidate)) > maximum:
                pieces.append(" ".join(buffer)); buffer = []
            buffer.append(word)
        if buffer:
            pieces.append(" ".join(buffer))
    grouped = []
    for piece in pieces:
        if grouped and len(prepare_course_text(grouped[-1])) < 50 and len(prepare_course_text(grouped[-1] + ' ' + piece)) <= maximum:
            grouped[-1] += ' ' + piece
        else:
            grouped.append(piece)
    pieces = grouped
    if re.sub(r"\s+", " ", " ".join(pieces)).strip() != re.sub(r"\s+", " ", text).strip():
        raise ValueError("При сегментации изменён исходный текст")
    for piece in pieces:
        if len(prepare_course_text(piece)) > maximum:
            raise ValueError("Сегмент слишком длинный: " + piece)
    return pieces
