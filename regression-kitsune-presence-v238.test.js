"use strict";
const fs=require("fs");
const vm=require("vm");
const assert=require("assert");

const source=fs.readFileSync("/mnt/data/kitsune-presence-v238.js","utf8");
assert.ok(!/SpeechRecognition|webkitSpeechRecognition/.test(source),"wake must not use browser/cloud speech recognition");
assert.ok(!/fetch\s*\(/.test(source),"wake module must not send audio/text over network");

function boot(storageSeed={}){
  const map=new Map(Object.entries(storageSeed));
  const localStorage={
    getItem:k=>map.has(k)?map.get(k):null,
    setItem:(k,v)=>map.set(k,String(v)),
    removeItem:k=>map.delete(k)
  };
  const listeners={};
  const document={
    readyState:"loading",
    hidden:false,
    head:{appendChild(){}},
    body:{classList:{contains(){return false},remove(){},add(){} }},
    addEventListener(type,fn){listeners[type]=fn},
    querySelector(){return null},
    createElement(){return {id:"",style:{},textContent:"",appendChild(){}}}
  };
  const windowObj={
    document,
    localStorage,
    innerWidth:1024,
    innerHeight:768,
    addEventListener(){},
    visualViewport:null,
    dispatchEvent(){},
    KitsuneLiveConversation:null,
    KitsuneLive:null,
    KitsuneVoiceDialogue:null
  };
  const sandbox={
    window:windowObj,
    document,
    localStorage,
    navigator:{},
    location:{protocol:"https:"},
    innerWidth:1024,
    innerHeight:768,
    performance:{now:()=>1000},
    setTimeout:()=>0,
    clearTimeout(){},
    setInterval:()=>0,
    clearInterval(){},
    MutationObserver:function(){this.observe=()=>{}},
    CustomEvent:function(type,init){this.type=type;this.detail=init?.detail},
    console,
    Float32Array,
    Float64Array,
    Math,
    JSON,
    Date,
    Promise,
    Error
  };
  vm.createContext(sandbox);
  vm.runInContext(source,sandbox,{filename:"kitsune-presence-v238.js"});
  return {api:windowObj.KitsunePresence,storage:map};
}

// Persistent compact state + normalized dock.
let {api}=boot({
  "a8_kitsune_collapsed_v238":"1",
  "a8_kitsune_dock_v238":JSON.stringify({side:"left",ratio:1.7})
});
assert.strictEqual(api.isCollapsed(),true);
assert.deepStrictEqual(JSON.parse(JSON.stringify(api.dock())),{side:"left",ratio:.9});
assert.strictEqual(api.wake.status().local,true);
assert.strictEqual(api.wake.status().phrase,"Привет, Китсуне");
assert.strictEqual(api.diagnostics().cloudWake,false);

// DTW/template calibration: similar sequences should be closer than reversed/noisy ones.
const mk=(shift=0)=>Array.from({length:36},(_,i)=>[
  Math.sin((i+shift)/5),
  Math.cos((i+shift)/7),
  (i%9)/9,
  Math.sin((i+shift)/3)*.5
]);
const a=mk(0), b=mk(.4), c=mk(-.3), far=mk(14);
const near=api._test.dtwDistance(a,b);
const farD=api._test.dtwDistance(a,far);
assert.ok(Number.isFinite(near)&&Number.isFinite(farD));
assert.ok(near<farD,"similar wake templates should be closer than unrelated timing");
const profile=api._test.profileFromTemplates([a,b,c],[1300,1240,1360]);
assert.ok(profile.threshold>0&&profile.templates.length===3);
assert.ok(profile.durationMedian>=1240&&profile.durationMedian<=1360);

// A loaded profile is recognized as ready without any network/model asset.
({api}=boot({
  "a8_kitsune_wake_profile_v238":JSON.stringify(profile),
  "a8_kitsune_wake_enabled_v238":"1"
}));
assert.strictEqual(api.wake.ready(),true);
assert.strictEqual(api.wake.status().enabled,true);
assert.strictEqual(api.wake.status().local,true);

console.log("PASS: compact state/dock persistence, local wake profile calibration, no cloud speech API");
