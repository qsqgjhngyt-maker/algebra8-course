import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFileSync} from "node:fs";
const source=readFileSync(new URL("../../intelligence-router-v230.js",import.meta.url),"utf8");
function setup(){
  const calls=[];
  const window={addEventListener(){},KitsuneBrain:{chat:async()=>"local answer",safetyCheck:()=>null,safeReply:x=>x,localMathExplanation:()=>"verified result",dialogFallback:()=>"tutor"},KitsuneMath:{looksMath:t=>t.includes("="),analyze:async()=>({display:"4"})},KitsuneHybridInfrastructure:{consented:()=>true,cloudRequest:async(...args)=>{calls.push(args);return {answer:"Привет!"}}}};
  vm.runInNewContext(source,{window,localStorage:{getItem:()=>"1"},navigator:{onLine:true},document:{body:{},querySelector:()=>null},MutationObserver:class{observe(){}},AbortController,DOMException,setTimeout,clearTimeout});
  return {window,calls};
}
test("math is deterministic and never uploaded",async()=>{const {window,calls}=setup();assert.equal(await window.KitsuneBrain.chat("2+2"),"verified result");assert.equal(calls.length,0)});
test("cloud receives only current eligible text",async()=>{const {window,calls}=setup();await window.KitsuneBrain.chat("Привет",null,[{content:"private history"}]);assert.equal(calls.length,1);assert.equal(calls[0][1],"Привет");assert.equal(JSON.stringify(calls).includes("private history"),false)});
test("exercise context stays local and failures fall back",async()=>{const {window,calls}=setup();assert.equal(await window.KitsuneBrain.chat("Объясни",{exercise:{q:"private task"}}),"local answer");assert.equal(calls.length,0);window.KitsuneHybridInfrastructure.cloudRequest=async()=>{throw Error("offline")};assert.equal(await window.KitsuneBrain.chat("Привет"),"local answer")});
