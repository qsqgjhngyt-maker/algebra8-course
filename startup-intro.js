/* Kitsune Math cinematic startup intro · cinematic-v316.1
   Drop-in replacement for the existing startup-intro.js.
   Keeps the current auto/full/short/off preference model and public API.
*/
(() => {
  "use strict";

  const ROOT_ID = "kitsuneStartupIntro";
  const KEY_SEEN = "kitsune:intro:seen";
  const KEY_LAST_RELEASE = "kitsune:intro:lastRelease";
  const KEY_ENABLED = "kitsune:intro:enabled";
  const KEY_MODE = "kitsune:intro:mode";
  const VERSION = document.querySelector('meta[name="kitsune-app-version"]')?.content || "3.1.0-rc.5";
  const INTRO_REV = "cinematic-v316.1";
  const RELEASE_TOKEN = `${VERSION}|${INTRO_REV}`;
  const VIDEO_URL = `./assets/kitsune-cinematic-intro-v316.mp4?v=${encodeURIComponent(INTRO_REV)}`;
  const POSTER_URL = `./assets/kitsune-cinematic-poster-v316.webp?v=${encodeURIComponent(INTRO_REV)}`;
  const MODES = ["auto", "full", "short", "off"];
  const mediaReduced = typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : null;

  let root = document.getElementById(ROOT_ID);
  let timers = [];
  let finished = false;
  let activeMode = "off";
  let video = null;
  let poster = null;

  const safeGet = (k, f = null) => {
    try {
      const v = localStorage.getItem(k);
      return v === null ? f : v;
    } catch (_) {
      return f;
    }
  };
  const safeSet = (k, v) => {
    try { localStorage.setItem(k, String(v)); } catch (_) {}
  };
  const later = (fn, ms) => {
    const id = setTimeout(() => {
      timers = timers.filter(x => x !== id);
      fn();
    }, ms);
    timers.push(id);
    return id;
  };
  const clearTimers = () => {
    timers.forEach(clearTimeout);
    timers = [];
  };

  function preference() {
    const p = safeGet(KEY_MODE, null);
    if (MODES.includes(p)) return p;
    return safeGet(KEY_ENABLED, "1") === "0" ? "off" : "auto";
  }

  function setPreference(v) {
    const n = MODES.includes(v) ? v : "auto";
    safeSet(KEY_MODE, n);
    safeSet(KEY_ENABLED, n === "off" ? "0" : "1");
    updateToggle();
    return n;
  }

  function queryMode() {
    try {
      const q = new URLSearchParams(location.search).get("intro");
      return ["full", "short", "reduced", "off"].includes(q) ? q : null;
    } catch (_) {
      return null;
    }
  }

  function theme() {
    return safeGet("a8_theme", "light") === "dark" ? "dark" : "light";
  }

  function decideMode() {
    const q = queryMode();
    if (q) return q;
    const p = preference();
    if (p === "off") return "off";
    if (mediaReduced?.matches) return "reduced";
    if (p === "full") return "full";
    if (p === "short") return "short";
    return safeGet(KEY_SEEN, "0") !== "1" || safeGet(KEY_LAST_RELEASE, "") !== RELEASE_TOKEN ? "full" : "short";
  }

  function markSeen() {
    safeSet(KEY_SEEN, "1");
    safeSet(KEY_LAST_RELEASE, RELEASE_TOKEN);
  }

  function stage(name) {
    if (!root || finished) return;
    ["is-motion", "is-idle", "is-blink", "is-magic"].forEach(c => root.classList.remove(c));
    if (name) root.classList.add(`is-${name}`);
  }

  function motionFrame(n) {
    const el = root?.querySelector("[data-motion]");
    if (el) el.style.setProperty("--motion-frame", String(Math.max(0, Math.min(5, n | 0))));
  }

  function installMedia() {
    if (!root) return;
    const scene = root.querySelector(".kitsune-startup-intro__scene");
    if (!scene) return;

    if (!scene.querySelector(".kitsune-startup-intro__cinema")) {
      const cinema = document.createElement("div");
      cinema.className = "kitsune-startup-intro__cinema";
      cinema.setAttribute("aria-hidden", "true");

      video = document.createElement("video");
      video.className = "kitsune-startup-intro__video";
      video.muted = true;
      video.defaultMuted = true;
      video.playsInline = true;
      video.preload = "auto";
      video.poster = POSTER_URL;
      video.disablePictureInPicture = true;
      video.setAttribute("playsinline", "");
      video.setAttribute("webkit-playsinline", "");
      video.setAttribute("controlslist", "nodownload nofullscreen noremoteplayback");
      video.setAttribute("aria-hidden", "true");

      const source = document.createElement("source");
      source.src = VIDEO_URL;
      source.type = "video/mp4";
      video.appendChild(source);

      poster = document.createElement("img");
      poster.className = "kitsune-startup-intro__poster";
      poster.src = POSTER_URL;
      poster.alt = "";
      poster.decoding = "async";
      poster.setAttribute("aria-hidden", "true");

      cinema.append(video, poster);
      scene.prepend(cinema);
    } else {
      video = scene.querySelector(".kitsune-startup-intro__video");
      poster = scene.querySelector(".kitsune-startup-intro__poster");
    }
  }

  function stopVideo() {
    if (!video) return;
    try { video.pause(); } catch (_) {}
  }

  function cleanup() {
    clearTimers();
    stopVideo();
    document.documentElement?.classList?.remove("kitsune-intro-active");
    document.removeEventListener?.("keydown", onKey);
    document.removeEventListener?.("visibilitychange", onVisibility);
    root?.remove();
    root = null;
    video = null;
    poster = null;
  }

  function finish({ skip = false, reason = "complete" } = {}) {
    if (finished) return;
    finished = true;
    clearTimers();
    markSeen();
    stopVideo();
    root?.classList.add("is-leaving");
    later(cleanup, skip ? 130 : 420);
    try {
      window.dispatchEvent(new CustomEvent("kitsune:intro:complete", {
        detail: { mode: activeMode, skip, reason, version: VERSION, introRevision: INTRO_REV }
      }));
    } catch (_) {}
  }

  function onPointer(ev) {
    if (ev.target?.closest?.(".kitsune-startup-intro__skip")) return;
    finish({ skip: true, reason: "pointer" });
  }

  function onSkip(ev) {
    ev.preventDefault();
    ev.stopPropagation();
    finish({ skip: true, reason: "button" });
  }

  function onKey(ev) {
    if (ev.key === "Escape") finish({ skip: true, reason: "keyboard" });
  }

  function onVisibility() {
    if (document.hidden && !finished) finish({ skip: true, reason: "background" });
  }

  function preloadPoster() {
    return new Promise(resolve => {
      const img = new Image();
      let done = false;
      const end = () => {
        if (done) return;
        done = true;
        resolve();
      };
      img.onload = img.onerror = end;
      img.src = POSTER_URL;
      later(end, 700);
    });
  }

  function legacyFullFallback() {
    if (!root || finished) return;
    root.classList.remove("is-cinematic-full", "is-cinematic-ready");
    root.classList.add("is-legacy-fallback");
    motionFrame(0);
    stage("motion");
    later(() => motionFrame(1), 300);
    later(() => motionFrame(2), 620);
    later(() => motionFrame(3), 940);
    later(() => motionFrame(4), 1280);
    later(() => motionFrame(5), 1660);
    later(() => stage("idle"), 2050);
    later(() => stage("blink"), 2720);
    later(() => stage("idle"), 2890);
    later(() => stage("magic"), 3520);
    later(() => root?.classList.add("is-brand"), 4220);
    later(() => root?.classList.add("is-hold"), 4880);
    later(() => stage("blink"), 7180);
    later(() => stage("idle"), 7360);
    later(() => stage("magic"), 8150);
    later(() => finish({ reason: "legacy-fallback-complete" }), 10550);
  }

  async function playCinematicFull() {
    if (!root || !video) return legacyFullFallback();
    root.classList.add("is-cinematic-full");
    root.classList.remove("is-cinematic-short", "is-cinematic-reduced", "is-legacy-fallback");

    const syncBrand = () => {
      if (!root || !video || finished) return;
      const t = Number(video.currentTime) || 0;
      if (t >= 7.05) root.classList.add("is-brand", "is-hold");
    };
    video.addEventListener("timeupdate", syncBrand, { passive: true });
    video.addEventListener("ended", () => {
      root?.classList.add("is-brand", "is-hold");
      later(() => finish({ reason: "cinematic-ended" }), 360);
    }, { once: true });
    video.addEventListener("error", () => {
      if (!finished) legacyFullFallback();
    }, { once: true });

    try {
      video.currentTime = 0;
      video.load();
      const p = video.play();
      if (p && typeof p.then === "function") await p;
      if (finished) return;
      root.classList.add("is-cinematic-ready");
      later(() => {
        if (!finished && video && video.paused && video.currentTime < 0.1) legacyFullFallback();
      }, 1500);
    } catch (_) {
      legacyFullFallback();
    }
  }

  async function playPosterMode(mode) {
    if (!root) return;
    root.classList.add(mode === "reduced" ? "is-cinematic-reduced" : "is-cinematic-short");
    await Promise.race([preloadPoster(), new Promise(r => later(r, 500))]);
    if (finished || !root) return;
    root.classList.add("is-poster-ready");
    later(() => root?.classList.add("is-brand", "is-hold"), mode === "reduced" ? 80 : 180);
    later(() => finish({ reason: `${mode}-complete` }), mode === "reduced" ? 1450 : 1950);
  }

  async function play(mode) {
    activeMode = mode;
    if (!root || mode === "off") {
      cleanup();
      return;
    }

    document.documentElement?.classList?.add("kitsune-intro-active");
    root.dataset.theme = theme();
    root.dataset.mode = mode;
    root.dataset.introRevision = INTRO_REV;

    installMedia();
    root.addEventListener("pointerdown", onPointer, { passive: true });
    root.querySelector(".kitsune-startup-intro__skip")?.addEventListener("click", onSkip);
    document.addEventListener?.("keydown", onKey);
    document.addEventListener?.("visibilitychange", onVisibility);

    if (mode === "full") {
      await playCinematicFull();
      return;
    }
    await playPosterMode(mode);
  }

  const LABEL = {
    auto: "🎬 Запуск: авто",
    full: "🎬 Запуск: полный",
    short: "🎬 Запуск: короткий",
    off: "🎬 Запуск: выкл"
  };
  const TITLE = {
    auto: "Полный кинематографичный ролик после обновления, затем короткая заставка",
    full: "Полный кинематографичный ролик при каждом запуске",
    short: "Всегда короткая заставка",
    off: "Не показывать заставку"
  };

  function updateToggle() {
    const b = document.getElementById("startupIntroBtn");
    if (!b) return;
    const p = preference();
    b.textContent = LABEL[p];
    b.title = TITLE[p] + ". Нажми, чтобы сменить режим.";
    b.dataset.introMode = p;
    b.setAttribute("aria-pressed", p === "off" ? "false" : "true");
  }

  function bind() {
    updateToggle();
    const b = document.getElementById("startupIntroBtn");
    if (b && !b.dataset.boundIntro) {
      b.dataset.boundIntro = "1";
      b.addEventListener("click", () => setPreference(MODES[(MODES.indexOf(preference()) + 1) % MODES.length]));
    }
  }

  window.KitsuneStartupIntro = {
    version: VERSION,
    introRevision: INTRO_REV,
    getPreference: preference,
    setPreference,
    reset() {
      try {
        localStorage.removeItem(KEY_SEEN);
        localStorage.removeItem(KEY_LAST_RELEASE);
      } catch (_) {}
    },
    replayFull() {
      try {
        const u = new URL(location.href);
        u.searchParams.set("intro", "full");
        location.href = u.href;
      } catch (_) {
        location.reload();
      }
    },
    keys: { seen: KEY_SEEN, lastRelease: KEY_LAST_RELEASE, enabled: KEY_ENABLED, mode: KEY_MODE }
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind, { once: true });
  else bind();

  play(decideMode());
})();
