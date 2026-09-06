# Worker Kitsune · v2.3.0-beta.3.7

Точка входа — src/index.js, самостоятельный Worker без импортов src/chat.js и src/voice.js. Последние сохранены только как зависимости исторических тестов.

Worker обрабатывает Google-регистрацию, challenge и подпись устройства, запросы доступа, решения владельца через D1 KITSUNE_DB, проверку owner/admin, обновление сертификата устройства, временный credential и Qwen chat. Полная история диалогов в D1 не сохраняется; текст запроса проходит через Worker и Qwen. Cloud TTS endpoint в текущей точке входа отсутствует.

Публичные настройки: ALLOWED_ORIGIN, GOOGLE_CLIENT_ID, QWEN_TEMP_TOKEN_URL, QWEN_API_BASE, QWEN_MODEL, QWEN_REGION, CHAT_ENABLED, CHALLENGE_TTL_SECONDS. Действующая модель — qwen3.7-plus. Серверный таймаут чата — 45 секунд, клиентский — 50 секунд.

Secrets: DASHSCOPE_API_KEY, GRANT_SIGNING_SECRET, PARENT_GOOGLE_SUB; необязательный ALLOWED_GOOGLE_EMAILS. Сохранять существующие значения. Реестр D1 и лимитеры не перенастраивать при очистке.

В wrangler.jsonc отсутствует привязка D1, настроенная ранее через Dashboard. Не выполнять deploy из неполной конфигурации. Точный порядок — [развертывание](../docs/DEPLOY.md).

Проверки: node --check src/index.js и node --test tests/*.test.mjs. Исходные 4 ошибки из 11 описаны в [отчете](../docs/cleanup/План.md). Версия исходника не подтверждает версию опубликованного Worker.
