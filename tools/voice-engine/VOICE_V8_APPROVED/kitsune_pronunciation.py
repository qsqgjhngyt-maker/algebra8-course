import re

MATH_STRESS = {
    "дроби": "дро́би",
    "дробей": "дробе́й",
    "числитель": "числи́тель",
    "знаменатель": "знамена́тель",
    "корни": "ко́рни",
    "степени": "сте́пени",
    "проценты": "проце́нты",
}

def prepare_math_text(text):
    for word, stressed in MATH_STRESS.items():
        pattern = r"(?<!\w)" + re.escape(word) + r"(?!\w)"

        def replace(match):
            value = match.group(0)
            if value[0].isupper():
                return stressed[0].upper() + stressed[1:]
            return stressed

        text = re.sub(pattern, replace, text, flags=re.IGNORECASE)

    return text

if __name__ == "__main__":
    examples = [
        "Сегодня мы изучим дроби.",
        "Найди числитель и знаменатель.",
        "Вычисли корни уравнения.",
    ]

    for item in examples:
        print(prepare_math_text(item))
