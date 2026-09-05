# Stage 2 — development beta, 2026-09-05

Stage 2 explicitly authorized. User confirms sufficient free quota; no payment
or billing activation authorized. Stage 1 accepted on desktop and iPhone via VPN.

Implemented in `work/Kitsune_Algebra8_v2.3.0-beta`:
- Router in existing chat; local course tools first, deterministic mathematics.
- Optional cloud support/concept conversation with separate adult consent.
- Cloud receives only eligible current text, never history, ctx, Mastery or raw audio.
- Signed request-body hash, enrollment, expiry, rate limits, no-store.
- Upstream SSE is buffered and checked before display; not yet progressive UI streaming.
- Character Voice design and synthesis routes, fixed fictional description.
- Cloud voice -> existing Piper/system voice; object URLs released on stop.
- Concurrent chat replies cannot overwrite the current conversation.

Still required before FINAL:
- Live test of chat and voice; approve generated voice preview.
- Alibaba key permissions: qwen3.7-plus, qwen-voice-design,
  qwen3-tts-vd-2026-01-26. Existing key was restricted to text model.
- Save generated voice ID as Cloudflare Secret QWEN_VOICE_ID.
- Disable VOICE_DESIGN_ENABLED after voice creation.
- Progressive safe streaming UI, verified math cloud explanations if useful,
  complete child settings cleanup and cross-platform regression.

Privacy decision: adult separately allows transient text/answer processing by
Cloudflare and Alibaba. Application does not store/log server payloads. Provider
retention is a separate policy, not equivalent to no-storage in application code.
Child Safety remains defense-in-depth; regex checks are not absolute protection.

Voice setup (adult only): Alibaba Model Studio -> API Keys -> edit dedicated
Kitsune key -> Custom permissions -> model scope -> add qwen-voice-design and
qwen3-tts-vd-2026-01-26; retain qwen3.7-plus. Keep Free Quota Only enabled.
If permission editing requires a replacement key, enter it directly in Cloudflare
Secret DASHSCOPE_API_KEY. Never send its value in chat. Then use Adult Center
Create Kitsune voice, listen to preview, save displayed voice ID as QWEN_VOICE_ID.

Sources checked: https://www.alibabacloud.com/help/en/model-studio/voice-design-user-guide
and https://www.alibabacloud.com/help/en/model-studio/model-pricing
