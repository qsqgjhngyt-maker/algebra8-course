# Kitsune Algebra 8 — GitHub Pages Production Architecture

## Release
v2.0.0 FINAL

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

AI features are offline only after their selected models have been prepared and
the browser has retained their model caches.

## Security / privacy
- no external analytics;
- no application backend;
- microphone is push-to-talk for Voice Dialogue;
- camera remains disabled by the security policy;
- handwritten Math Board uses pointer input instead of camera;
- CSP is applied in page metadata and again to Service Worker-served documents;
- progress export is explicit and contains only local `a8_*` keys;
- model caches are not included in exported progress files.

## Deployment
Upload the ZIP contents to the repository root, not the ZIP file itself.
Enable GitHub Pages from the repository root / `main` branch.
Keep `.nojekyll` in the repository root.
