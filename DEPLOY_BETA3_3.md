# Kitsune 2.3.0-beta.3.3 — Qwen Reliability Fix

Причина плавающего `broker_error` найдена в нашем Worker:

- используется `qwen3.7-plus`;
- для Qwen 3.7 thinking mode включён по умолчанию;
- наш обычный chat-запрос не передавал `enable_thinking:false`;
- Worker обрывал реальный chat через 20 секунд;
- тест Qwen очень короткий (`max_tokens: 12`), поэтому мог успешно проходить,
  когда нормальный разговор уже упирался в timeout.

Исправлено:

1. Обычный безопасный Cloud Chat:
   `enable_thinking:false`
2. Qwen connectivity test:
   `enable_thinking:false`
3. Worker chat timeout:
   `20s → 45s`
4. Browser Router timeout:
   `24s → 50s`
5. Timeout больше не маскируется как `broker_error`:
   показывается `chat_timeout`.

Точные вычисления по-прежнему выполняет локальный Math Engine, поэтому отключение
thinking для обычного разговора не снижает математическую надёжность курса.

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
Весь код из `cloudflare-worker-index-v231.js`
вставить вместо текущего Worker `index.js` → Deploy.

Secrets / Variables не трогать.

## Проверка
После обновления несколько раз подряд:
- `Кто такой Ньютон?`
- `Объясни простыми словами теорию вероятностей`
- `Расскажи что-нибудь интересное про космос`

Ожидается: `☁️ Qwen Cloud` без плавающего fallback.
