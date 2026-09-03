
> ВАЖНО: начиная с v1.11.1 аналитика выключена по умолчанию.
> Umami загружается только после явного включения взрослым в разделе «🔒 Приватность».

# Kitsune Analytics v1.11.1 — Child Safe Opt-In

## Umami website

Website: `Kitsune — Алгебра 8`

Tracker is restricted to:

`qsqgjhngyt-maker.github.io`

## Что смотреть в Umami

### Overview
Основные показатели:
- Visitors
- Visits
- Views
- Bounce rate
- Visit duration

### Devices / Browsers / OS
Используйте breakdown аналитики Umami для понимания, с чего реально открывают курс:
- Mobile / Desktop / Tablet
- Android / Windows / iOS / macOS
- Chrome / Edge / Safari / Samsung Internet и т. д.

### Events

Наиболее полезные события:

#### Установки
- `pwa_install_button_click` — пользователь нажал кнопку установки;
- `pwa_install_choice` — accepted/dismissed там, где браузер сообщает результат;
- `pwa_installed` — браузер подтвердил установку;
- `pwa_first_standalone_launch` — первое обнаруженное открытие установленной PWA;
- `pwa_launch` — каждый запуск в standalone/PWA режиме.

`pwa_first_standalone_launch` особенно полезен как практическая метрика фактической установки на платформах с неполной поддержкой `appinstalled`.

#### Kitsune
- `kitsune_dialog_open`
- `kitsune_brain_prepare_click`
- `kitsune_brain_ready`
- `voice_mic_button`

#### Локальные модели
- `whisper_prepare_click`
- `whisper_ready`
- `neural_voice_download_click`
- `neural_voice_ready`

## Не считать свои устройства

На каждом своём устройстве один раз откройте production URL с параметром:

`?kitsune_owner=1`

Например, если адрес курса заканчивается `/algebra8-course/`, просто добавьте параметр к этому адресу.

После открытия параметр удалится из адресной строки, но локальный opt-out сохранится.

Вернуть отслеживание:

`?kitsune_owner=0`

Важно: opt-out локальный, поэтому его нужно включить отдельно на ПК, телефоне, планшете и в разных браузерах, которыми владелец пользуется для тестов.

## Ограничения метрик

- Ad blockers и privacy extensions могут блокировать Umami, поэтому число посещений может быть немного ниже реального.
- PWA install APIs отличаются между браузерами.
- iOS/Safari не всегда предоставляет такое же install-событие, как Chromium, поэтому standalone launch используется как дополнительное подтверждение.
- Offline-запуск без сети не будет отправлен в Umami в момент, когда tracker недоступен; проект специально не сохраняет analytics events на диск для последующей отправки.

## Privacy boundary

Никакие учебные ответы, тексты чата, микрофонные транскрипты и локальный прогресс в Umami не отправляются.
