# v2.3.0-beta.1 — как применить патч

Патч рассчитан на текущий public `main` v2.3.0-beta.

## 1. GitHub Pages

Замените в корне репозитория:

- `intelligence-router-v230.js`
- `version.json`

В `index.html` измените:

```text
<meta name="kitsune-app-version" content="2.3.0-beta" />
```

на:

```text
<meta name="kitsune-app-version" content="2.3.0-beta.1" />
```

и строку:

```text
<script src="./intelligence-router-v230.js?v=2.3.0-beta"></script>
```

на:

```text
<script src="./intelligence-router-v230.js?v=2.3.0-beta.1"></script>
```

Также желательно заменить текст кнопки версии на `v2.3.0-beta.1`.

## 2. Service Worker

В `sw.js`:

```text
const CACHE="algebra8-v2.3.0-beta";
const RELEASE="2.3.0-beta";
```

замените на:

```text
const CACHE="algebra8-v2.3.0-beta.1";
const RELEASE="2.3.0-beta.1";
```

В `ASSETS` замените:

```text
"./index.html?v=2.3.0-beta"
"./intelligence-router-v230.js?v=2.3.0-beta"
```

на версии `2.3.0-beta.1`.

Это важно: без нового URL/кэша установленная PWA может продолжать использовать
старый Router.

## 3. Cloudflare Worker

Замените:

`cloudflare-broker/src/chat.js`

на файл из этого пакета и сделайте Deploy Worker.

Секреты НЕ меняйте:
- `DASHSCOPE_API_KEY`
- `QWEN_VOICE_ID`
- `GRANT_SIGNING_SECRET`
- `PARENT_GOOGLE_SUB`

`VOICE_ENABLED=true` оставить.
`VOICE_DESIGN_ENABLED=false` после уже созданного голоса оставить.

## Что проверить

1. Взрослый раздел → Cloud Brain → обе cloud-галки включены.
2. В обычном чате написать: `Кто такой Ньютон?`
   Ожидается живой ответ Qwen, не локальный шаблон.
3. В открытом уроке написать: `Почему это правило вообще нужно?`
   Qwen может ответить на текущую реплику, но само условие задания не отправляется.
4. Написать `2+2`.
   Должен сработать `Math Engine · local`, а не Qwen.
5. В Adult Center посмотреть `Последний маршрут`.
6. При включённых голосовых ответах ответ Qwen должен идти через Character Voice;
   при ошибке TTS — автоматически Piper/system.

## Важно

Это beta.1, не FINAL. Точный разбор конкретной задачи через Qwen пока не включён:
следующий этап — `Math Engine -> VERIFIED_MATH -> Qwen explanation`.
