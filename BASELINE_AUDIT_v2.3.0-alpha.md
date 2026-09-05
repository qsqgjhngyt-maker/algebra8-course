# Baseline audit · v2.3.0-alpha

## Frozen input

- Source release: Kitsune Algebra 8 v2.2.3
- Source ZIP SHA-256: `703510842333AC9A97B599171642D83405D662E02DF35628416F13B3EFDEE6E7`
- Source file count: 54
- Source ZIP was not modified.

## Read-only checks completed

- JavaScript syntax check: pass for all baseline files.
- JSON parse check: `version.json` and `manifest.json` pass.
- Local `src` / `href` references in `index.html`: no missing files detected.
- Obvious API-key/client-secret pattern scan: no embedded credential detected.
- v2.2.3 release/version metadata confirmed.
- GitHub Pages relative-path architecture confirmed.
- Service Worker release-cache deletion remains scoped to Kitsune-owned caches.
- OPFS, IndexedDB and third-party model caches are not cleared by update/recovery.

## Stage 1 code checks

- Hybrid client contains no permanent provider credential.
- Temporary Qwen credential remains inside Worker and is never returned to the
  browser by the fixed Stage 1 test route.
- Device private key is generated non-exportable with Web Crypto.
- Only the public JWK is sent to the broker.
- Broker has no database binding and no dialogue endpoint. Its Qwen test route
  rejects arbitrary fields and uses a fixed technical prompt.
- Broker responses use `Cache-Control: no-store`.
- Broker accepts one exact configured origin; origin is not treated as auth.
- Google JWT signature, issuer, audience, expiry and nonce are checked.
- Device challenge/certificate uses HMAC signatures and ECDSA proof-of-possession.
- Rate limits are separated for auth, credential issuance and replay attempts.
- Service Worker has explicit auth/Qwen/TTS bypass rules.
- Fixed an alpha version-label regression in the inherited design wrapper: the
  home status chip now reads the shared app version instead of forcing v2.2.3.
- Fixed the Google Identity button being removed by the synchronous Adult
  Center status redraw; GIS now renders into the new panel after redraw.
- Advanced the Service Worker release cache to `2.3.0-alpha.2` so installed
  PWAs receive the Google button fix without clearing model/OPFS caches.
- Broker unit/integration tests: 3 passed, 0 failed, including the fixed Qwen
  proxy, rejection of client-supplied prompt fields, and credential non-leakage.
- Cloudflare Wrangler 4.129.0 dry-run and production bundle: pass; 16.29 KiB
  upload / 4.47 KiB gzip.
- Full alpha JavaScript syntax pass: 39 files.
- HTML local reference check: 39 references, none missing.
- CSP duplicate-directive check: pass.
- Embedded credential-pattern check: pass.
- Desktop browser smoke test: Adult Center and Cloud Brain panel render without
  console errors.
- 390×844 responsive smoke test: Cloud Brain status panel remains usable and
  keeps provider controls out of the child navigation.

## External Stage 1 status

- Google Web Client ID and external Testing audience configured; the adult test
  user is registered. Real sign-in remains pending publication of the alpha PWA.
- Cloudflare broker with the fixed Stage 1 test proxy deployed successfully,
  version `92d1b05b-4af6-4170-af74-a10cf4357b0e`.
- Live broker health check from the exact allowed origin: HTTP 200,
  `storage: none`, `conversationLogging: false`, region `ap-southeast-1`, and
  `Cache-Control: no-store, private, max-age=0`, and `ready: true` after the
  adult account and all required secrets were configured.
- Alibaba Singapore workspace configured for `qwen3.7-plus`; permanent API key
  is present only as Cloudflare Secret `DASHSCOPE_API_KEY`.
- Alibaba Stop-on-Exhaust / Free Quota Only is enabled; no billing profile was
  completed.
- Real browser-to-Qwen direct CORS failed with `Failed to fetch` after Google and
  broker checks passed. A privacy-visible fixed test proxy was therefore added;
  no child text is accepted and Cloudflare only processes the fixed request and
  bounded answer transiently.
- iPhone/Android installed-PWA behavior requires real devices.

## Confirmed public endpoints

- GitHub Pages PWA: `https://qsqgjhngyt-maker.github.io/algebra8-course/`
- Allowed web origin: `https://qsqgjhngyt-maker.github.io`
- Cloudflare Worker: `https://kitsune-hybrid-broker.akronikl.workers.dev`
- Google Web Client ID: `917733706537-8761p6aqah238r1g2anvlhupstu9s98t.apps.googleusercontent.com`
- Qwen API base: `https://ws-xoczzsb7am4cyl8c.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1/`
- Qwen model: `qwen3.7-plus`

## Known security limitation

Cloudflare Worker Rate Limiting is eventually consistent. It is useful for
replay resistance but is not a cryptographically exact one-time nonce store.
Certificates are therefore short-lived and bound to a device public key. A
future requirement for immediate per-device revocation would require minimal
server-side state and a source-of-truth update.
