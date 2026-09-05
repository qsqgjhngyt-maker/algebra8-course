# Stage 2 — beta.1 Cloud Routing Visibility, 2026-09-05

Stage 1 remains accepted. Character Voice was created by the adult and its
QWEN_VOICE_ID is stored as a Cloudflare Secret. VOICE_DESIGN_ENABLED should stay
false after voice creation; VOICE_ENABLED stays true.

## What changed in beta.1

- Cloud Qwen is no longer limited to a narrow study-keyword allowlist.
- Safe general educational conversation can use Qwen automatically.
- A safe text question asked while an exercise is open may use Qwen; only the
  current text is transmitted. `ctx`, task text, history, Mastery, photos and raw
  microphone audio are not uploaded.
- Exact mathematical computation remains local and deterministic.
- Adult Center now shows the last intelligence route:
  Course tools / Math Engine / Qwen Cloud / Local Brain-fallback.
- Qwen Character Voice remains the online first choice through the existing
  `v151Speak` wrapper, then Piper/system fallback.

## Still required before FINAL

- Verified Math Engine -> Qwen explanation endpoint for task-specific explanations.
- Live Character Voice regression on iPhone / Android / desktop.
- Progressive safe streaming if retained after UX testing.
- Full cross-platform regression and documentation cleanup.

## Privacy invariant

The application broker is stateless for conversation data. Provider-side
retention is governed separately by the provider. Cloud requests use no-store.
Permanent API keys remain only in Cloudflare Secrets.
