import test from "node:test";
import assert from "node:assert/strict";
import {allowedMessage,safeAnswer,collectSSE} from "../src/chat.js";
import {voiceText} from "../src/voice.js";
import worker from "../src/index.js";
test("personal data and calculations stay local",()=>{
  for(const s of ["Меня зовут Иван, объясни алгебру","Привет user@example.com","Реши 2+2","Мой адрес улица Ленина","Привет https://example.com"]){assert.equal(allowedMessage(s),false,s)}
  assert.equal(allowedMessage("Мне трудно учиться, поддержи меня"),true);
});
test("unsafe or invented numeric cloud answers rejected",()=>{
  for(const s of ["Ответ 42","Напиши свой адрес","https://example.com",""]){assert.equal(safeAnswer(s),false,s)}
  assert.equal(safeAnswer("Давай сделаем небольшую паузу и попробуем снова."),true);
});
test("SSE reassembles split unicode and requires complete stream",async()=>{
  const bytes=new TextEncoder().encode('data: {"choices":[{"delta":{"content":"Привет!"}}]}\n\ndata: [DONE]\n\n');
  const stream=new ReadableStream({start(c){for(const b of bytes)c.enqueue(Uint8Array.of(b));c.close()}});
  assert.equal(await collectSSE(new Response(stream)),"Привет!");
  await assert.rejects(collectSSE(new Response('data: {"choices":[{"delta":{"content":"Привет"}}]}\n\n')));
});
test("oversized voice text and personal data rejected",()=>{
  assert.equal(voiceText("a".repeat(801)),false);assert.equal(voiceText("user@example.com"),false);
  assert.equal(voiceText("Получается: 4."),true);
});
test("cloud routes require enabled feature and signed enrollment",async()=>{
  const env={ALLOWED_ORIGIN:"https://owner.github.io",CHAT_ENABLED:"true",VOICE_ENABLED:"true",GRANT_SIGNING_SECRET:"test-signing-key"};
  for(const [path,body] of [["chat",{message:"Привет"}],["tts",{text:"Привет"}]]){
    const r=await worker.fetch(new Request(`https://broker.example/v1/qwen/${path}`,{method:"POST",headers:{Origin:env.ALLOWED_ORIGIN,"Content-Type":"application/json"},body:JSON.stringify(body)}),env);
    assert.equal(r.status,401);assert.match(r.headers.get("cache-control"),/no-store/);
  }
});
