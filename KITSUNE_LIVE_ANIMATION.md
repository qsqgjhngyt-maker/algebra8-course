# Kitsune Live v1.10

## Как устроена анимация

Основной UI-персонаж больше не SVG.

`live-assistant-v15.js` создаёт два наложенных `<img>`-слоя.
`kitsune-live-v110.js` плавно переключает их по crossfade.

Это позволяет использовать полноценный рисованный персонаж и не менять картинку резко.

## Talking animation

### System TTS

Когда `v161MarkSpeaking(true)` сообщает о старте речи, Kitsune Live включает мягкую последовательность:

`small → wide → small → O → small → wide`

Интервалы немного отличаются, поэтому речь не выглядит как механический GIF.

### Neural Voice

Для локального Piper Neural Voice в Web Audio graph добавлен `AnalyserNode`.

Примерная схема:

`Piper WAV → filters → compressor → gain → analyser → speakers`

RMS амплитуды выбирает разговорный кадр.

При тишине используется почти закрытый кадр, при средней громкости — маленькое открытие рта, при более сильной — широкая форма.

## Почему персонаж больше не «говорит» во время генерации

До v1.10 состояние speaking включалось ещё до `tts.predict()`.

Теперь состояние speaking включается только в `playProcessed()`, когда `AudioBufferSourceNode` уже готов начать фактическое воспроизведение.

## Idle

Каждые несколько секунд выполняется естественное короткое моргание, если персонаж не говорит и находится в idle.

## Reduced motion

При `prefers-reduced-motion: reduce`:
- отключается bob/bounce;
- отключаются sparkles;
- frame crossfade становится практически мгновенным;
- talking animation не работает с высокой частотой.
