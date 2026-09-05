# Stage 2 beta.2 status

Version: 2.3.0-beta.2

## Implemented
- Real user-message Qwen routing instead of only a fixed connectivity test.
- Cloud dialogue while a lesson is open without uploading lesson context.
- Route telemetry in Adult Center.
- Character Voice direct test without silent Piper substitution.
- Real voice-engine telemetry and last fallback reason.
- iOS/PWA WebAudio unlock.
- Qwen-TTS request fix: `input.language_type = "Russian"`.
- Repeated Voice Design action removed from normal UI.
- Safe Cloud → Local fallback preserved.
- No analytics added.

## Not FINAL
Task-specific cloud explanations are still intentionally local. Next stage is:
Math Engine → VERIFIED_MATH → Qwen explanation.
