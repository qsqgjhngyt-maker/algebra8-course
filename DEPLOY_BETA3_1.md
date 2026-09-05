# Kitsune 2.3.0-beta.3.1

Исправления:
- единое взрослое разрешение Cloud Brain: без второй галки;
- обычный безопасный разговор → Qwen Cloud;
- явная помощь по заданию → локальный Tutor;
- точная математика → Math Engine;
- новый `chat-dialog-firewall-v231.js` не даёт отправке сообщения закрывать чат и
  перебрасывать PWA на главную;
- новый SW-cache и query `?v=2.3.0-beta.3.1` без очистки OPFS/моделей.

## GitHub
Заменить/добавить:
1. index.html
2. sw.js
3. version.json
4. intelligence-router-v230.js
5. cloud-chat-ux-v231.js
6. local-voice-lab-v231.js
7. chat-dialog-firewall-v231.js

## Cloudflare
`cloudflare-worker-index-v231.js` — взять весь код, заменить Worker `index.js`, Deploy.
Secrets/Variables не трогать.

## iPhone
Не очищать данные сайта и не удалять PWA.
После публикации полностью закрыть приложение через переключатель и открыть снова.
Если появится штатное предложение обновиться — принять.

Проверка:
- `Расскажи простыми словами, что такое теория вероятностей` → ☁️ Qwen Cloud;
- чат остаётся открытым;
- в уроке `Кто такой Ньютон?` → ☁️ Qwen Cloud;
- `Объясни это задание` → Tutor;
- `2+2` → Math Engine.
