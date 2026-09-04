# Kitsune Child Safety v1.11.1

## Принцип

Приложение должно быть полезным без передачи данных ребёнка.

Поэтому базовый режим:

`курс + прогресс + Smart Tutor + Kitsune dialogue = локально`

Аналитика является дополнительной возможностью и по умолчанию выключена.

## Data map

### Только на устройстве
- прогресс курса;
- ошибки;
- история диалога с Kitsune;
- текст после локального Whisper;
- Kitsune Brain memory;
- Tutor memory;
- локальные AI model caches.

### Может уйти во внешний network только после действия пользователя
- загрузка runtime/model files для локального AI;
- внешнюю аналитику analytics после отдельного opt-in.

### Никогда не отправляем в внешнюю аналитику
- student answer;
- task result;
- mistake text;
- chat text;
- speech transcript;
- microphone audio;
- local progress;
- contact details.

## Микрофон

`getUserMedia` вызывается только внутри обработчика кнопки голосового ввода.

Настройки:
- `video:false`;
- echo cancellation;
- noise suppression;
- auto gain control.

После записи tracks закрываются через `track.stop()`.

Запись дополнительно останавливается при:
- паузе;
- ручном Stop;
- закрытии диалога;
- уходе вкладки в background;
- `pagehide`;
- таймауте 15 секунд.

## Content Guard

Guard работает до обращения к локальной LLM.

Категории:
- PII/contact data;
- secrecy from parents;
- self-harm;
- adult sexual content;
- drugs;
- dangerous weapon/explosive instructions;
- gambling.

После генерации применяется второй фильтр:
- arbitrary URLs;
- request for personal data;
- secrecy language.

Это defense-in-depth, а не гарантия идеальной модерации любой локальной языковой модели.

## Network allow-list

CSP ограничивает обычные network destinations известными origin, нужными проекту.

Если в будущем добавляется новый внешний runtime/model provider:
1. не расширять CSP wildcard-ом `https:`;
2. добавить только конкретный origin;
3. обновить Privacy UI;
4. проверить, что загрузка происходит только после явного действия пользователя.

## Analytics

Consent key:

`a8_analytics_consent_v1111`

Default: missing / `0`.

внешнюю аналитику script не вставляется в DOM до consent.

Owner opt-out:

`a8_analytics_owner_optout`

Browser DNT/GPC имеет приоритет над consent.

## Ограничения GitHub Pages

GitHub Pages не позволяет проекту произвольно задавать HTTP headers на самом первом сетевом ответе.

Поэтому:
- CSP сразу задаётся через `<meta http-equiv="Content-Security-Policy">`;
- service worker добавляет response security headers после активации;
- frame bootstrap является дополнительной защитой первого открытия.

Для максимального уровня header security в будущем можно поместить статический сайт за CDN/hosting, который поддерживает custom response headers.


## Camera Homework Import (v2.1.0)

Камера разрешена только для same-origin PWA и используется исключительно в
функции `📷 Из учебника`.

Правила:
- приложение никогда не вызывает `getUserMedia()` на старте;
- перед системным запросом камеры показывается отдельное подтверждение;
- аудио в camera flow всегда выключено;
- поток камеры закрывается при закрытии окна, уходе в фон и `pagehide`;
- снимок не загружается на учебный backend;
- OCR выполняется локально через browser WASM/Worker;
- результат OCR всегда показывается в редактируемом поле;
- в Homework Studio ничего не добавляется без отдельного нажатия пользователя;
- геолокация, платежи, USB и датчики остаются запрещены.

OCR предназначен для печатных заданий. Математические символы могут быть
распознаны неточно, поэтому обязательна визуальная проверка перед добавлением.
