> Исторический документ. Не применять к beta.3.7. Актуальная инструкция: [развертывание](../DEPLOY.md). Исходные пути и команды относятся к версии на момент написания.

# Kitsune 2.3.0-beta.2.3 — Character Voice diagnostic hotfix

Цель: один раз показать безопасную исходную ошибку Alibaba TTS вместо общего
«нет разрешения».

## Cloudflare
В редакторе Worker замените ВЕСЬ `index.js` файлом из этого архива и нажмите Deploy.
Variables/Secrets не трогать.

## GitHub Pages
Замените `https://github.com/qsqgjhngyt-maker/algebra8-course/blob/0eac7a6c4c86e5ae6300f65fef3bc0d66f6df2ff/character-voice-v230.js` в корне.
Чтобы браузер точно взял новую версию, в `index.html` замените query:
`https://github.com/qsqgjhngyt-maker/algebra8-course/blob/0eac7a6c4c86e5ae6300f65fef3bc0d66f6df2ff/character-voice-v230.js?v=2.3.0-beta.2.2`
на
`https://github.com/qsqgjhngyt-maker/algebra8-course/blob/0eac7a6c4c86e5ae6300f65fef3bc0d66f6df2ff/character-voice-v230.js?v=2.3.0-beta.2.3`

Если используете service worker, аналогично обновите запись Character Voice в ASSETS
или выполните обычный release bump.

## Проверка
Для взрослых → Cloud Brain → Проверить Character Voice.

Ожидаем строку вида:
`Alibaba TTS: HTTP 4xx · <CODE> · <короткое сообщение>`

Она специально очищается от API keys, токенов, URL и длинных идентификаторов.
После одного скрина эту диагностическую выдачу можно снова убрать.
