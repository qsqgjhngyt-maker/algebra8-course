# Kitsune Hybrid Broker · v2.3.0-alpha

Минимальный Cloudflare Worker без базы данных и без хранения диалогов.

Он выполняет только четыре операции:

1. выдаёт короткоживущий challenge;
2. проверяет Google ID token взрослого и регистрирует public key устройства;
3. проверяет proof-of-possession устройства;
4. получает у Alibaba Cloud временный DashScope credential.

Permanent DashScope key, ключ подписи grants и разрешённый Google `sub`
задаются только как Cloudflare Secrets. Не помещайте их в этот каталог,
`.dev.vars`, ZIP, GitHub или сообщения.

## Публичные переменные

Перед deploy заполните `wrangler.jsonc`:

- `ALLOWED_ORIGIN` — точный origin опубликованной GitHub Pages PWA, без path;
- `GOOGLE_CLIENT_ID` — Web Client ID Google;
- `QWEN_TEMP_TOKEN_URL` — точный temporary-token endpoint выбранного региона;
- `QWEN_REGION` — регион Model Studio;
- TTL оставьте 60 секунд для temporary credential URL.

## Secrets

- `DASHSCOPE_API_KEY` — минимально привилегированный permanent key;
- `GRANT_SIGNING_SECRET` — случайная строка не менее 32 байт;
- `PARENT_GOOGLE_SUB` — стабильный Google subject взрослого, не email.

## Privacy

Worker не содержит Qwen chat proxy. Prompt и ответ через него не проходят.
Временный credential возвращается с `Cache-Control: no-store` и должен жить
только в памяти клиента. Если direct browser-to-Qwen не пройдёт CORS-тест,
proxy можно добавить только после отдельного обновления privacy-модели.

Cloudflare Rate Limiting используется для auth/token/replay ограничений. Эти
счётчики eventual-consistent и не являются точной базой отзыва. Device
certificate живёт максимум 12 часов; для строгого мгновенного revoke потребуется
отдельное server-side состояние и новое архитектурное решение.
