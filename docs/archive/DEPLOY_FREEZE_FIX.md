> Исторический документ. Не применять к beta.3.7. Актуальная инструкция: [развертывание](../DEPLOY.md). Исходные пути и команды относятся к версии на момент написания.

# Kitsune v2.3.0-beta.2.1 — Freeze Fix

Причина зависания v2.3.0-beta.2: оба новых cloud-модуля наблюдали весь `document.body`
через `MutationObserver`, а затем в каждом callback снова записывали `textContent`
в диагностические элементы. Это могло породить непрерывную цепочку DOM mutations.

Исправлено:
- диагностический текст меняется только если значение реально изменилось;
- MutationObserver теперь debounce-ится через `requestAnimationFrame`;
- Cloud/Voice логика и Worker не менялись.

Заменить в корне GitHub:
- `index.html`
- `sw.js`
- `intelligence-router-v230.js`
- `https://github.com/qsqgjhngyt-maker/algebra8-course/blob/0eac7a6c4c86e5ae6300f65fef3bc0d66f6df2ff/character-voice-v230.js`
- `version.json`

Cloudflare Worker для этого hotfix повторно деплоить не требуется.

Commit:
`v2.3.0-beta.2.1 — Cloud Diagnostics Freeze Fix`
