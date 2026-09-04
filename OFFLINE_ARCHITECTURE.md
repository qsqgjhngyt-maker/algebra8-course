# Kitsune Algebra 8 — GitHub Pages Production Architecture

## Release
v2.2.3 STUDENT EXPERIENCE & RELIABILITY

## Hosting model
The application is a static PWA and requires no application backend.

GitHub Pages serves:
- `index.html`
- all course JavaScript/CSS
- Math Engine and Web Workers
- Generator 2.0
- Tutor Intelligence
- Search
- Offline / AI Center
- Service Worker
- icons and mascot assets

All paths are relative (`./...`), so the project works from a GitHub Pages project URL such as:

`https://<user>.github.io/algebra8-course/`

## Local data
Study progress, mistakes, homework, spaced-repetition state, Math Lab history,
the handwritten scratchpad, AI preferences and parent summary are stored in
browser local storage / browser model caches.

No study backend is required.

## AI runtimes
Brain, Whisper and Neural Voice are optional heavy modules.

They are intentionally lazy:
1. the course works without them;
2. the user explicitly prepares the desired model;
3. runtime/model files are downloaded from allowed static package/model hosts;
4. browser / runtime caches keep them locally where the browser permits;
5. `Offline & AI` can request persistent storage and can release RAM without deleting models.

This avoids bundling hundreds of megabytes into the GitHub repository while
preserving a static GitHub Pages architecture.

## Offline behavior
The Service Worker caches all same-origin application-shell assets. Math Engine,
Generator, Tutor Intelligence, course content and local search therefore do not
depend on a server after the PWA shell has been cached.

AI features are prepared automatically in the background when the device is
online, secure, not in Save-Data mode, and has enough browser storage. The child
does not need to open settings or install modules manually. The browser retains
runtime/model caches where supported.

## Security / privacy
- no external analytics;
- no application backend;
- microphone is push-to-talk for Voice Dialogue;
- camera is allowed only for the same-origin PWA and is requested exclusively by the explicit `Из учебника` flow;
- handwritten Math Board remains available without camera;
- camera photos are OCR-processed locally and require an editable confirmation before homework import;
- CSP is applied in page metadata and again to Service Worker-served documents;
- progress export is explicit and contains only local `a8_*` keys;
- model caches are not included in exported progress files.

## Deployment
Upload the ZIP contents to the repository root, not the ZIP file itself.
Enable GitHub Pages from the repository root / `main` branch.
Keep `.nojekyll` in the repository root.


## Zero-config preparation

`auto-setup-v210.js` performs one-time background preparation:
1. requests persistent browser storage when available;
2. prepares/caches Kitsune Brain when WebGPU/storage allow it;
3. prepares/caches Whisper without opening the microphone;
4. downloads/verifies Neural Voice with system-voice fallback;
5. prepares Russian+English OCR without opening the camera;
6. releases heavy runtimes from RAM after caching.

Failed/unsupported components degrade gracefully and retry conservatively.
No camera or microphone permission is requested by auto-setup.

## Camera / OCR

`camera-import-v210.js` requests camera access only after the user presses
`Из учебника` and confirms the in-app prompt. The browser then shows its own
permission prompt. A gallery/file fallback is also available.

Recognition uses Tesseract.js v5.1.1 in the browser. Runtime/language files are
static CDN/model assets and are cached after preparation. OCR output is always
editable before it is added to Homework Studio.


## Safe Mode and recovery

v2.2.3 adds a non-destructive Safe Mode for problematic devices:
- Brain switches to Smart Tutor;
- Neural Voice switches to system TTS;
- automatic heavy-module setup pauses;
- heavy runtimes are released from RAM;
- progress, homework, OPFS and model caches stay intact.

The Adult Center can also rebuild the app-shell cache while online. This only
removes release caches named `algebra8-v*`; AI runtime/model caches and local
study data are intentionally preserved.

## Student / Adult UX separation

Student mode is enabled by default and hides technical/administrative views.
The Adult Center exposes diagnostics, Mastery 51, accessibility and recovery.
This separation is UX-only and is not presented as an authentication or
parental-control boundary.
