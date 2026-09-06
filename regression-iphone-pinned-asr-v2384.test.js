"use strict";
const fs=require("fs");
const assert=require("assert");

const main=fs.readFileSync(process.argv[2],"utf8");
const worker=fs.readFileSync(process.argv[3],"utf8");
const index=fs.readFileSync(process.argv[4],"utf8");

assert(main.includes("if(workerReady&&workerMode===mode)return true;"),
  "pinned worker must be reused between turns");
assert(main.includes("await releaseLegacyWhisperOnce();"),
  "legacy v19 runtime is released once per dialog");
assert(main.includes("if(wakeReleased)return;"),
  "wake microphone release is one-time per dialog");
assert(!main.includes("await releaseOwnWorker();\\n        await sleep(180);"),
  "must not unload ASR after each transcription");
assert(main.includes("IMPORTANT: worker remains pinned on iPhone until dialog closes"),
  "worker must stay resident for dialog lifetime");
assert(main.includes("speakSystemIOS"),
  "iPhone dialog must avoid Piper while pinned Whisper is resident");
assert(main.includes("endDialogVoiceSession"),
  "dialog close must release pinned ASR");
assert(main.includes("event.stopImmediatePropagation()"),
  "manual mic uses unified path");
assert(main.includes("api.start=startUnified"),
  "hands-free uses unified path");
assert(!main.includes("new MediaRecorder"),
  "raw PCM path remains active");
assert(!main.includes("SpeechRecognition"));
assert(!main.includes("webkitSpeechRecognition"));

assert(worker.includes('"onnx-community/whisper-tiny"'));
assert(worker.includes('language:"russian"'));

assert(index.includes("voice-stability-v2384.js?v=2.3.0-beta.3.8.4"));
assert(!index.includes("voice-stability-v2383.js"));

console.log("PASS: iPhone pinned ASR / no per-turn model churn / unified mic");
