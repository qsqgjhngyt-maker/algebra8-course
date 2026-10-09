# Компоненты голоса Kitsune

Проверенная модель Китсуне дообучена из checkpoint Piper Irina medium на ранее утверждённых аудиозаписях проекта. Пользователь одобрил тембр и проверил автономную работу на ПК, Android и iPhone. Эти проверки подтверждают поведение генератора; условия публичного распространения базовой модели проверяются отдельно.

| Компонент | Источник и сведения |
| --- | --- |
| ONNX Runtime Web 1.22.0 | [Microsoft ONNX Runtime](https://github.com/microsoft/onnxruntime/tree/v1.22.0), MIT; текст лицензии находится в пакете runtime |
| Piper для обучения 1.8.0 | [OHF Voice Piper](https://github.com/OHF-Voice/piper1-gpl/tree/639388b6317fc4731e91d53da42aea68fd4166ff), GPL 3 или позднее; COPYING сохранён |
| Русский ru_dict | Из окружения того же Piper 1.8.0; происхождение, размер и хеш в licenses/voice/RUSSIAN_DICTIONARY_SOURCE_RU.json; GPL 3 или позднее |
| Фонемизатор WASM | [diffusionstudio piper-wasm](https://github.com/diffusionstudio/piper-wasm), npm @diffusionstudio/piper-wasm 1.0.0. Исходная инструкция сборки ссылается на [wide-video piper-phonemize](https://github.com/wide-video/piper-phonemize) и [rhasspy espeak-ng](https://github.com/rhasspy/espeak-ng). Точный commit сборки опубликованных npm-бинарников в доступных метаданных не указан |
| Исходный checkpoint | [rhasspy piper-checkpoints](https://huggingface.co/datasets/rhasspy/piper-checkpoints/tree/97200aff5bea3736d7eb75488b56cc6f50af9cab/ru/ru_RU/irina/medium), epoch=4139-step=929464.ckpt, SHA-256 8a8e1d945bee6c2a7050dd99c3bca24cae4b02adb0d120a135d220079e78601d |

Коллекция checkpoint на Hugging Face имеет общую отметку MIT. В индивидуальном MODEL_CARD Irina источник данных — RHVoice, лицензия данных — Unknown; база дообучения — Lessac medium. Оригинальная карточка сохранена дословно в licenses/voice/BASE_MODEL_CARD.txt. Общая отметка коллекции не заменяет уточнение условий исходных данных. [Автор Piper о лицензиях голосов](https://github.com/rhasspy/piper/discussions/271) различает код, checkpoint и исходные обучающие данные.

До публичного распространения необходимо зафиксировать применимые условия Irina и цепочки дообучения, атрибуцию, а для GPL-компонентов — доступный соответствующий исходный код и сведения о сборке. Пакет остаётся локальным кандидатом до закрытия этих пунктов. Источники, хеши и подтверждение пользователя сохранены; произвольная лицензия модели не назначается.

Исходные репозитории компонентов доступны по ссылкам выше. Они не являются копией точных исходников npm-бинарника, пока происхождение его сборки не установлено. Права на разные компоненты не объединяются в одну общую лицензию проекта.
