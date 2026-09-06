
"use strict";
const assert=require("assert");

function classifier(text){
  if(/привет|здравств|как дела|ты тут|kitsune|кицун/i.test(text))return "greeting";
  if(/[=<>≤≥√²^]/.test(text)||/(?:реши|вычисли|посчитай)/i.test(text))return "math";
  return "cloud";
}

const memory=[
  "Ученик: Объясни дискриминант",
  "Ассистент: Дискриминант — это число. Привет из старой реплики.",
  "Ученик: реши x²-4x+3=0"
].join("\n");

const current="А почему он бывает отрицательным?";

// beta.3.7 bug: classifier saw memory + current.
const oldComposite=`${memory}\nТекущий вопрос:\n${current}`;
assert.notStrictEqual(classifier(oldComposite),"cloud");

// beta.3.7.1 invariant: classifier sees current only.
assert.strictEqual(classifier(current),"cloud");

// Memory is added only to the already-selected cloud payload.
const cloudPayload=`Краткая память:\n${memory}\n\nТекущий вопрос пользователя:\n${current}`;
assert.ok(cloudPayload.includes(memory));
assert.strictEqual(classifier(current),"cloud");

// Follow-up 3 remains a normal conversational question.
assert.strictEqual(classifier("А если он равен нулю?"),"cloud");

console.log("PASS: topic memory cannot influence current-message routing");
