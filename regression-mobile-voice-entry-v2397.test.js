"use strict";
const fs=require("fs"), assert=require("assert");
const dir=process.argv[2];
const read=n=>fs.readFileSync(dir+"/"+n,"utf8");

const bridge=read("mobile-voice-entry-v2397.js");
const index=read("index.html");
const sw=read("sw.js");
const version=JSON.parse(read("version.json"));

assert(bridge.includes('const VERSION = "2.3.0-beta.3.9.7";'));
assert(bridge.includes(".v19-open-dialog"));
assert(bridge.includes("💬 Поговорить"));
assert(bridge.includes(".v19-inline-talk"));
assert(bridge.includes("🎙️ Сказать Kitsune"));
assert(bridge.includes('loader.ensure("assistant"'));
assert(bridge.includes("background: false"));
assert(bridge.includes("window.KitsuneVoiceDialogue"));
assert(bridge.includes("window.v16ParseExercise"));
assert(bridge.includes("MutationObserver"));
assert(!bridge.includes("prepareWhisper"));
assert(!bridge.includes("KitsuneBrain.prepare"));

assert(index.includes('content="2.3.0-beta.3.9.7"'));
assert(index.includes("navigation-stability-v2396.js"));
assert(index.includes("mobile-voice-entry-v2397.js?v=2.3.0-beta.3.9.7"));
assert(
  index.indexOf("runtime-loader-v2395.js") <
  index.indexOf("mobile-voice-entry-v2397.js")
);
assert(
  index.indexOf("mobile-voice-entry-v2397.js") <
  index.indexOf("app-kernel-v200.js")
);

assert(sw.includes('algebra8-v2.3.0-beta.3.9.7'));
assert(sw.includes('algebra8-runtime-v2397'));
assert(sw.includes('mobile-voice-entry-v2397.js?v=2.3.0-beta.3.9.7'));
assert(version.version==="2.3.0-beta.3.9.7");
assert(version.features.includes("mobile-free-talk-button-without-background-ai"));
assert(version.features.includes("navigation-fix-2396-preserved"));

console.log("PASS: lazy mobile voice entry + navigation fix preserved");
