/* Единый голос Kitsune: утверждённый v0.4 и отдельные учебные записи v0.5.
   Воспроизводятся только точные тексты из проверенных индексов. */
(() => {
  'use strict';
  const pilot = window.KITSUNE_STATIC_PACK_V04;
  const course = window.KITSUNE_STATIC_COURSE_PACK_V05;
  const packs = [pilot, course].filter(Boolean);
  const root = new URL('./assets/voice/', document.currentScript.src);
  const key = 'kitsune_static_voice_v05';
  let enabled = true, epoch = 0, source = null, context = null, abort = null;
  let timer = null, settlePause = null;
  try { enabled = localStorage.getItem(key) !== '0'; } catch {}
  const normalize = text => String(text || '').normalize('NFC').replace(/\s+/g, ' ').trim();
  const sequences = new Map();
  for (const pack of packs) {
  for (const segment of pack.segments) {
    segment.pack_id = pack.pack_id;
    sequences.set(normalize(segment.text), [segment]);
  }
  for (const id of new Set(pack.segments.map(s => s.item_id))) {
    const list = pack.segments.filter(s => s.item_id === id).sort((a,b) => a.index-b.index);
    sequences.set(normalize(list.map(s => s.text).join(' ')), list);
  }
  }
  function stop() {
    epoch++;
    abort?.abort(); abort = null;
    clearTimeout(timer); timer = null;
    settlePause?.(); settlePause = null;
    try { source?.stop(); source?.disconnect(); } catch {}
    source = null;
    window.v161MarkSpeaking?.(false, 'idle');
  }
  async function verifiedResponse(segment, signal) {
    const url = new URL(segment.pack_id + '/' + segment.audio, root).href;
    const cache = await caches.open('kitsune-voice-pack-' + segment.pack_id.replace(/_/g,'-'));
    const cached = await cache.match(url);
    const response = cached || await fetch(url, {signal, cache:'no-cache'});
    if (!response.ok || response.status !== 200) throw new Error('WAV недоступен');
    const bytes = await response.arrayBuffer();
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),
      b => b.toString(16).padStart(2,'0')).join('');
    if (hash !== segment.sha256) {
      await cache.delete(url);
      throw new Error('Контрольная сумма WAV не совпала');
    }
    const full = new Response(bytes, {headers:{'Content-Type':'audio/wav'}});
    return {bytes, full, url, cache};
  }
  async function download() {
    // Только этот пакет; кэши приложения и динамического TTS не затрагиваются.
    for (const segment of packs.flatMap(p => p.segments)) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      try {
        const record = await verifiedResponse(segment, controller.signal);
        await record.cache.put(record.url, record.full);
      } finally { clearTimeout(timeout); }
    }
    return {packs:packs.map(p => p.pack_id), clips:packs.reduce((n,p) => n+p.segments.length,0)};
  }
  async function isCached() {
    try {
      for (const segment of packs.flatMap(p => p.segments)) {
        const url = new URL(segment.pack_id + '/' + segment.audio, root).href;
        const cache = await caches.open('kitsune-voice-pack-' + segment.pack_id.replace(/_/g,'-'));
        const response = await cache.match(url);
        if (!response) return false;
        const bytes = await response.arrayBuffer();
        const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b => b.toString(16).padStart(2,'0')).join('');
        if (hash !== segment.sha256) return false;
      }
      return true;
    } catch { return false; }
  }
  async function unlock() {
    try {
      context ||= new (window.AudioContext || window.webkitAudioContext)();
      await context.resume();
      return context.state === 'running';
    } catch { return false; }
  }
  function trySpeak(text, opts = {}, fallback = null) {
    const list = sequences.get(normalize(text));
    if (!enabled || opts.skipStatic || opts.voiceOverride || !list ||
        typeof v151VoiceEnabled === 'undefined' || !v151VoiceEnabled ||
        (!opts.force && !v151SpeechUnlocked)) return false;
    if (!opts.force && window.v151IsSpeechBusy?.()) return false;
    window.v161StopSpeech?.();
    const run = ++epoch;
    abort = new AbortController();
    const signal = abort.signal;
    const state = opts.state || 'explain';
    let started = false;
    try {
      context ||= new (window.AudioContext || window.webkitAudioContext)();
      // resume вызывается в том же стеке, что и нажатие пользователя.
      const resume = context.resume();
      (async () => {
        try {
          await resume;
          if (context.state !== 'running') throw new Error('Нужен жест пользователя');
          for (const segment of list) {
            if (run !== epoch) return;
            const controller = abort;
            const timeout = setTimeout(() => controller.abort(), 15000);
            let record;
            try { record = await verifiedResponse(segment, signal); }
            finally { clearTimeout(timeout); }
            const buffer = await context.decodeAudioData(record.bytes.slice(0));
            if (run !== epoch) return;
            await record.cache.put(record.url, record.full).catch(() => {});
            if (run !== epoch) return;
            await new Promise(resolve => {
              source = context.createBufferSource(); source.buffer = buffer;
              source.connect(context.destination);
              source.onended = resolve; source.start(); started = true;
              window.v161MarkSpeaking?.(true, state);
              window.dispatchEvent(new CustomEvent('kitsune-voice-engine', {
                detail:{engine:'static',label:'Kitsune Voice Engine',pack:segment.pack_id,fallback:false,ts:Date.now()}
              }));
            });
            if (run !== epoch) return;
            await new Promise(resolve => {
              settlePause = resolve;
              timer = setTimeout(() => { settlePause = null; resolve(); },segment.pause_after_ms);
            });
          }
          if (run !== epoch) return;
          source = null; abort = null; window.v161MarkSpeaking?.(false, state); opts.onDone?.();
        } catch (error) {
          if (run !== epoch) return;
          stop();
          console.warn('[Kitsune WAV]', error.message);
          // После частичного чтения не повторяем весь текст другим голосом.
          if (!started) fallback?.(error.message); else opts.onDone?.();
        }
      })();
      return true;
    } catch {
      stop(); return false;
    }
  }
  window.KitsuneStaticVoice = {
    trySpeak, stop, download, unlock, isCached, isBusy:() => !!abort,
    // Паузы уже проигрывает этот плеер вместе с каждым сегментом.
    readingPlan:text=>sequences.get(normalize(text))?.map(s=>({text:s.text,pause_after_ms:0})),
    enable(value) { stop(); enabled = !!value; try { localStorage.setItem(key, enabled?'1':'0'); } catch {} },
    sample() { return pilot.segments[0].text; },
    info() { return {enabled,pack:pilot.pack_id,packs:packs.map(p => p.pack_id),topics:course?.items.length || 0,clips:packs.reduce((n,p) => n+p.segments.length,0)}; }
  };
  window.addEventListener('kitsune-audio-unlock', () => { unlock(); });
  window.addEventListener('pagehide', stop);
})();
