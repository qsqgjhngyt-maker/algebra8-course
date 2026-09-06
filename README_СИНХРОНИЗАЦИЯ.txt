Kitsune v2.3.0-beta.3.6 — Финальная синхронизация репозитория

Загрузить в корень репозитория с заменой:
- index.html
- sw.js
- version.json
- access-admin-v235.js

Загрузить с заменой:
- cloudflare-broker/src/index.js

Важно:
- Cloudflare Worker уже должен быть задеплоен из beta.3.6.
- KITSUNE_DB и Secrets не менять.
- OPFS / IndexedDB / локальные модели не очищать.
- После публикации GitHub Pages проверить версию и админ-панель.

Название коммита:
v2.3.0-beta.3.6 — Синхронизирована рабочая версия приложения

Описание:
GitHub Pages, Service Worker, version.json, модуль администрирования и исходник Cloudflare Worker синхронизированы с beta.3.6. Исправлено расхождение между публичным репозиторием и развернутой серверной версией.
