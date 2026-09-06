"use strict";
const fs=require("fs");
const assert=require("assert");

const main=fs.readFileSync(process.argv[2],"utf8");
const worker=fs.readFileSync(process.argv[3],"utf8");
const index=fs.readFileSync(process.argv[4],"utf8");

assert(main.includes("await window.KitsuneLiveConversation?.release?.()"),
  "Piper runtime must be actually released on iPhone dialog start");
assert(main.includes("if(isIOSLike()&&!piperReleasedForDialog)"),
  "Piper release must happen only once per dialog");
assert(main.includes("if(workerReady&&workerMode===requested)return true;"),
  "pinned Whisper must still be reused between turns");
assert(main.includes("detectInterruptedIosSession"),
  "interrupted iOS sessions need crash-recovery detection");
assert(main.includes("window.KitsuneLiveConversation?.handsFree?.(false)"),
  "hands-free must be disabled after interrupted iOS session");
assert(main.includes("iosInterruptedRecovery ||"),
  "automatic retry must be blocked in recovery mode");
assert(main.includes("if(!dialogOpen())clearIosSessionMarker();"),
  "pagehide must keep marker while an open dialog may have crashed");
assert(main.includes('if(mode==="base"||isIOSLike())return "wasm";'),
  "PC Base WASM / iPhone WASM rule must remain");
assert(worker.includes('const device=(mode==="base")?"wasm"'),
  "PC Base q8/WASM fix must remain");
assert(index.includes("voice-stability-v2386.js?v=2.3.0-beta.3.8.6"));
assert(!index.includes("voice-stability-v2385.js"));

console.log("PASS: iPhone frees Piper once + pinned Whisper + safe crash recovery + PC Base fix");
