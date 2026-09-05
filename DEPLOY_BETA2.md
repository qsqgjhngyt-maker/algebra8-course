# Kitsune v2.3.0-beta.2 — Cloud Runtime Diagnostics & Character Voice Activation

Это PATCH поверх текущего public `main` v2.3.0-beta. Он не содержит секретов.

## Что исправлено

1. **Router реально использует Qwen Cloud**
   - cloud больше не ограничен только `!ctx`;
   - безопасный обычный вопрос может идти в Qwen даже когда открыт урок;
   - в облако уходит только текущая текстовая реплика;
   - `ctx`, история, условие задания, Mastery, фото и raw microphone не отправляются;
   - конкретные вычисления остаются только в локальном Math Engine.

2. **Диагностика показывает фактический route**
   - Course tools · local
   - Math Engine · local
   - Qwen Cloud
   - Cloud → Local fallback
   - Local Brain / Smart Tutor

   Кнопка **«Проверить реальный Cloud Brain»** проходит через тот же Router,
   что и обычный чат. Это НЕ старый фиксированный `/v1/qwen/test`.

3. **Character Voice**
   - убрана обычная кнопка повторного создания голоса;
   - добавлена кнопка **«Проверить Character Voice»**;
   - тест не подменяет ошибку Piper-ом: он явно показывает успех/ошибку Qwen TTS;
   - обычная речь по-прежнему безопасно падает в Piper/System при ошибке;
   - Adult Center показывает реальный последний голосовой движок;
   - добавлен WebAudio unlock для iPhone/PWA.

4. **Исправлен Qwen TTS HTTP payload**
   `language_type: "Russian"` теперь находится внутри `input`, как требует
   актуальный Qwen-TTS HTTP API. В прежнем `voice.js` он ошибочно был помещён
   в `parameters`.

## Файлы GitHub Pages

Загрузите в корень репозитория с заменой:

- `index.html`
- `sw.js`
- `intelligence-router-v230.js`
- `character-voice-v230.js`
- `version.json`

Остальные файлы курса НЕ заменяйте этим архивом.

## Cloudflare Worker

Замените в репозитории:

- `cloudflare-broker/src/chat.js`
- `cloudflare-broker/src/voice.js`

После commit убедитесь, что Worker действительно задеплоил новую версию.

Секреты НЕ менять:

- `DASHSCOPE_API_KEY`
- `QWEN_VOICE_ID`
- `GRANT_SIGNING_SECRET`
- `PARENT_GOOGLE_SUB`

Переменные:

- `VOICE_ENABLED=true`
- `VOICE_DESIGN_ENABLED=false`
- `CHAT_ENABLED=true`

## Проверка после обновления

1. Откройте **Для взрослых → Cloud Brain**.
2. Включите обе cloud-галки.
3. Нажмите **«Проверить реальный Cloud Brain»**.
   Ожидается `Последний маршрут: Qwen Cloud`.
4. Нажмите **«Проверить Character Voice»**.
   Должна прозвучать специальная тестовая фраза.
   В панели должно появиться `Фактический движок: ✅ Qwen Character Voice`.
5. В обычном разговоре спросите: `Кто такой Ньютон?`
   Ожидается Qwen Cloud, а не фраза локального fallback.
6. Спросите: `Какая сейчас погода?`
   Qwen должен ответить, что не может проверить актуальную погоду прямо сейчас,
   а не повторять локальный шаблон.
7. Введите `2+2`.
   Ожидается `Math Engine · local`, не Qwen.
8. Включите голосовые ответы и задайте обычный cloud-вопрос.
   После ответа Adult Center должен показывать последний голосовой движок.

## Commit

**Title**

`v2.3.0-beta.2 — Cloud Runtime Diagnostics & Character Voice Activation`

**Description**

`Activated real Qwen Cloud routing for safe dialogue, added actual route and TTS diagnostics, fixed Qwen Character Voice Russian TTS payload, added iOS WebAudio unlock, and preserved deterministic local Math Engine plus local voice fallbacks.`

## Статус

Это beta.2, НЕ FINAL.

Следующий этап после реального теста:
`Math Engine → VERIFIED_MATH → Qwen explanation → Character Voice`.
