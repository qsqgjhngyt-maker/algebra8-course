"use strict";
const fs=require("fs");
const assert=require("assert");

const main=fs.readFileSync(process.argv[2],"utf8");
const worker=fs.readFileSync(process.argv[3],"utf8");
const index=fs.readFileSync(process.argv[4],"utf8");

assert(main.includes('event.stopImmediatePropagation()'),
  "manual mic must bypass the old closure-bound MediaRecorder handler");
assert(main.includes('api.start=startUnified'),
  "hands-free public API must use the same unified path");
assert(main.includes('await wake.stop("voice-session",true)'),
  "wake mic must be fully released before voice capture");
assert(main.includes('await window.KitsuneLiveConversation?.release?.()'),
  "iPhone must release Piper before ASR");
assert(main.includes('await originalRelease?.()'),
  "old v19 Whisper runtime must be released before unified ASR");
assert(main.includes('createScriptProcessor(2048,1,1)'),
  "raw PCM capture is required");
assert(!main.includes('new MediaRecorder'),
  "unified path must not use MediaRecorder");
assert(main.includes('now-lastVoiceAt>2200'),
  "natural-pause VAD is required");
assert(main.includes('if(isIOSLike()){\n        await releaseOwnWorker();'),
  "iPhone must unload Whisper before Router/Qwen/Piper");
assert(main.includes('transcriptProblem(text)'),
  "garbage/hallucination gate is required");
assert(!main.includes("SpeechRecognition"));
assert(!main.includes("webkitSpeechRecognition"));
assert(!main.includes("fetch("),
  "voice layer must not send raw audio to a network endpoint");

assert(worker.includes('"onnx-community/whisper-tiny"'));
assert(worker.includes('"onnx-community/whisper-base"'));
assert(worker.includes('language:"russian"'));
assert(worker.includes('task:"transcribe"'));

assert(index.indexOf("voice-conversation-v237.js") < index.indexOf("voice-stability-v2383.js"));
assert(index.indexOf("kitsune-presence-v238.js") < index.indexOf("voice-stability-v2383.js"));
assert(index.indexOf("voice-stability-v2383.js") < index.indexOf("chat-dialog-firewall-v231.js"));

console.log("PASS: unified button/hands-free + iPhone exclusive voice runtimes");
