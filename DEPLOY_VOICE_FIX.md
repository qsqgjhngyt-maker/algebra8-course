# v2.3.0-beta.2.2 — Qwen Character Voice hotfix

По результату beta.2.1:
- реальный Router = Qwen Cloud ✅
- Character Voice доходит до Worker, но TTS падает ❌

Найден важный несовместимый участок: официальный Qwen-TTS non-streaming API может
вернуть `output.audio.url` с протоколом `http://` для Alibaba OSS. Старый Worker
разрешал только `https://` и превращал успешный TTS-ответ в `invalid_audio_url`.

Hotfix:
- допускает ТОЛЬКО allow-listed Alibaba hosts (`aliyuncs.com`, `alicdn.com`);
- если такой URL пришёл как HTTP, безопасно повышает его до HTTPS до загрузки;
- `language_type: "Russian"` остаётся внутри `input`;
- добавлены безопасные диагностические коды permission/model/voice/region;
- секреты и QWEN_VOICE_ID никогда не возвращаются в UI.

Заменить в GitHub:
- character-voice-v230.js
- index.html
- sw.js
- version.json

Заменить и ОБЯЗАТЕЛЬНО Deploy в Cloudflare Worker:
- cloudflare-broker/src/voice.js

После Deploy:
Для взрослых → Cloud Brain → «Проверить Character Voice».

Если всё ещё будет ошибка, beta.2.2 покажет уже полезную причину:
permission / voice id mismatch / model mismatch / region mismatch / provider reject.

Commit:
`v2.3.0-beta.2.2 — Qwen Character Voice OSS URL Fix`
