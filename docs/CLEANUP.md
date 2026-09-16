# Очистка рабочей ветки

Удалено 69 устаревших tracked-файлов относительно `e69cae4`. История Git не переписывается, исходная версия сохранена. Runtime-зависимости проверяются после очистки. Содержание 88 учебных файлов не изменялось относительно alpha.7 WORK.

Сохранены активные legacy-модули и ключи 8 класса: они нужны миграции и совместимому режиму. Сохранена действующая самостоятельная точка входа Cloudflare Worker; её поведение не менялось. Старые backend-модули не импортировались этой точкой входа. Ранние version-pinned тесты заменены текущим стендом и серверными контрактами; их удаление не является доказательством отсутствия ошибок.

## Удалённые файлы

- `OFFLINE_ARCHITECTURE.md`
- `README_КУДА_ЗАГРУЗИТЬ.txt`
- `README_СИНХРОНИЗАЦИЯ.txt`
- `README_УСТАНОВКА.txt`
- `assets/apple-touch-icon-180.png`
- `assets/favicon-64.png`
- `assets/icon-192.png`
- `assets/icon-512.png`
- `assets/icon-maskable-192.png`
- `assets/icon-maskable-512.png`
- `assets/icon.svg`
- `assets/kitsune/blink.png`
- `assets/kitsune/explain.png`
- `assets/kitsune/happy.png`
- `assets/kitsune/idle-alt.png`
- `assets/kitsune/talk-o.png`
- `assets/kitsune/talk-small.png`
- `assets/kitsune/talk-wide.png`
- `cloudflare-broker/src/chat.js`
- `cloudflare-broker/src/voice.js`
- `cloudflare-broker/tests/broker.test.mjs`
- `cloudflare-broker/tests/router.test.mjs`
- `cloudflare-broker/tests/stage2.test.mjs`
- `docs/archive/BASELINE_AUDIT_v2.3.0-alpha.md`
- `docs/archive/BETA2_AUDIT.md`
- `docs/archive/CHILD_SAFETY.md`
- `docs/archive/DEPLOY_BETA1_PATCH.md`
- `docs/archive/DEPLOY_BETA2.md`
- `docs/archive/DEPLOY_BETA3_1.md`
- `docs/archive/DEPLOY_BETA3_2.md`
- `docs/archive/DEPLOY_BETA3_3.md`
- `docs/archive/DEPLOY_FREEZE_FIX.md`
- `docs/archive/DEPLOY_GITHUB_PAGES.md`
- `docs/archive/DEPLOY_TTS_DIAGNOSTIC.md`
- `docs/archive/DEPLOY_VOICE_FIX.md`
- `docs/archive/FINAL_AUDIT.md`
- `docs/archive/KITSUNE_ANALYTICS.md`
- `docs/archive/KITSUNE_BRAIN_SETUP.md`
- `docs/archive/KITSUNE_BRAIN_SOURCES.md`
- `docs/archive/KITSUNE_LIVE_ANIMATION.md`
- `docs/archive/KITSUNE_VOICE_SETUP.md`
- `docs/archive/KITSUNE_VOICE_SOURCES.md`
- `docs/archive/NEURAL_VOICE_SETUP.md`
- `docs/archive/NEURAL_VOICE_SOURCES.md`
- `docs/archive/OFFLINE_ARCHITECTURE.md`
- `docs/archive/README.md`
- `docs/archive/README_КУДА_ЗАГРУЗИТЬ.txt`
- `docs/archive/README_СИНХРОНИЗАЦИЯ.txt`
- `docs/archive/STAGE1_EXTERNAL_SETUP.md`
- `docs/archive/STAGE2_STATUS.md`
- `docs/archive/ОБ_АРХИВЕ.md`
- `docs/cleanup/Изменения.md`
- `docs/cleanup/План.md`
- `docs/cleanup/Проверка.md`
- `docs/cleanup/Ссылки-до-очистки.json`
- `regression-conversation-context-v2372.test.js`
- `regression-iphone-low-memory-v2386.test.js`
- `regression-iphone-pinned-asr-v2384.test.js`
- `regression-kitsune-presence-v238.test.js`
- `regression-mobile-voice-entry-v2397.test.js`
- `regression-topic-memory-v2371.test.js`
- `regression-voice-stability-v2383.test.js`
- `runtime-loader-v2392.js`
- `voice-asr-worker-v2383.js`
- `voice-asr-worker-v2384.js`
- `voice-stability-v2383.js`
- `voice-stability-v2384.js`
- `voice-stability-v2386.js`
- `whisper-worker-v1114.js`

Промежуточные alpha-отчёты из WORK не переносятся в опубликованную рабочую ветку. Актуальные инструкции находятся в README и docs. ZIP-файлы публикуются как вложения Release, не как runtime-файлы Pages.
