# Kitsune 2.3.0-beta.3.2 — Qwen Chat Diagnostics

Этот hotfix нужен именно для плавающей ошибки, когда на ПК реальный Cloud Brain
то проходит, то падает с `broker_error`.

Теперь Worker различает:
- ошибку выдачи временного credential;
- HTTP-ошибку Qwen Chat;
- ошибку внутри streaming-ответа Qwen.

В интерфейсе выводятся только безопасные:
`HTTP status · provider code · короткое message`.

API key, токены, URL и длинные идентификаторы вырезаются.

## GitHub
Заменить:
- index.html
- sw.js
- version.json
- intelligence-router-v230.js
- cloud-chat-ux-v231.js
- local-voice-lab-v231.js
- chat-dialog-firewall-v231.js

## Cloudflare
Весь код из `cloudflare-worker-index-v231.js` вставить вместо Worker `index.js` → Deploy.
Secrets/Variables не трогать.

После этого несколько раз нажать «Проверить реальный Cloud Brain».
Если сбой повторится, прислать строку ошибки целиком.
