"use strict";
const assert=require("assert");

function normalizeConversationContext(value){
  if(value===undefined||value===null||value==="")return "";
  if(typeof value!=="string")return "";
  const s=value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g," ")
    .replace(/[ \t]{2,}/g," ")
    .trim()
    .slice(0,1200);
  if(!s)return "";
  if(/https?:|www\./i.test(s))return "";
  if(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.test(s))return "";
  if(/(?:\+?\d[\d\s()\-]{8,}\d)/.test(s))return "";
  if(/(?:меня зовут|мо[йяё]\s+(?:имя|адрес|школ|телефон|пароль)|живу|фамили|паспорт|точн(?:ый|ое)\s+местополож)/i.test(s))return "";
  if(/(?:мне|я)\s+\d{1,2}\s*(?:лет|года?)/i.test(s))return "";
  return s;
}

const current="А, почему для школьной программы так говорят?";
const memory=(
  "Ученик: Объясни дискриминант\n"+
  "Ассистент: Дискриминант показывает число корней.\n"+
  "Ученик: А почему он бывает отрицательным?\n"+
  "Ассистент: Потому что b² может быть меньше 4ac.\n"
).repeat(8);

const context=normalizeConversationContext(memory);
assert.ok(context.length>700);
assert.ok(context.length<=1200);
assert.ok(current.length<700);

const body={message:current,conversationContext:context};
assert.strictEqual(body.message,current);
assert.ok(body.conversationContext.length>700);

assert.strictEqual(normalizeConversationContext("мой телефон +1 202 555 0199"),"");
assert.strictEqual(body.message,current);

const legacy={message:"Привет"};
assert.ok(!("conversationContext" in legacy));

console.log("PASS: separate message/context transport; sensitive context soft-drops");
