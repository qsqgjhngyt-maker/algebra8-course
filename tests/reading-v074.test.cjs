'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),core=require('../kitsune-reading-core-v074.js');
const plan=[{text:'Первая фраза.',pause_after_ms:650},{text:'Вторая фраза.',pause_after_ms:450},{text:'Третья фраза.',pause_after_ms:0}];
function harness(bookmarks=new Map()){
 const calls=[],timers=new Map(),states=[];let stops=0,id=0,controller;
 controller=core.create({speak:(text,options)=>{controller.stopped();calls.push({text,options});return true;},stopVoice:()=>{stops++;controller.stopped();},
  changed:s=>states.push(s),save:(key,b)=>bookmarks.set(key,b),load:key=>bookmarks.get(key),
  setTimer:(fn,ms)=>{timers.set(++id,{fn,ms});return id;},clearTimer:id=>timers.delete(id)});
 return {controller,calls,timers,states,bookmarks,stops:()=>stops,
  next:()=>{const [id,t]=timers.entries().next().value;timers.delete(id);t.fn();}};
}
test('Чтение сохраняет порядок фраз, паузы и завершает закладку',()=>{
 const h=harness();h.controller.start({key:'lesson',plan});
 assert.equal(h.calls[0].text,'Первая фраза.');assert(h.controller.isBusy());
 h.calls[0].options.onDone();assert.equal(h.controller.snapshot().index,1);assert.equal([...h.timers.values()][0].ms,650);
 h.next();assert.equal(h.calls[1].text,'Вторая фраза.');h.calls[1].options.onDone();h.next();h.calls[2].options.onDone();
 assert.equal(h.controller.snapshot().phase,'completed');assert.equal(h.controller.isBusy(),false);assert.equal(h.bookmarks.get('lesson').index,3);
});
test('Пауза удерживает текущую фразу, а поздний callback не перескакивает закладку',()=>{
 const h=harness();h.controller.start({key:'lesson',plan});
 h.controller.pause();assert.equal(h.stops(),1);assert(h.controller.isBusy());assert.equal(h.controller.snapshot().phase,'paused');
 h.calls[0].options.onDone();assert.equal(h.controller.snapshot().index,0);assert.equal(h.timers.size,0);
 h.controller.resume();assert.equal(h.calls[1].text,'Первая фраза.');h.calls[1].options.onDone();
 assert.equal(h.controller.snapshot().index,1);h.controller.pause();assert.equal(h.timers.size,0);
 h.controller.resume();assert.equal(h.calls[2].text,'Вторая фраза.');
});
test('Чтение после перезагрузки и повторного открытия начинается с закладки',()=>{
 const bookmarks=new Map(),first=harness(bookmarks);first.controller.start({key:'lesson',plan});
 first.calls[0].options.onDone();first.controller.pause();
 const second=harness(bookmarks);second.controller.start({key:'lesson',plan});assert.equal(second.calls[0].text,'Вторая фраза.');
 second.controller.finish();assert.equal(second.controller.isBusy(),false);
 second.controller.start({key:'lesson',plan});assert.equal(second.calls[1].text,'Вторая фраза.');
});
test('Другой текст и изменённый план не используют чужую закладку; сначала сбрасывает позицию',()=>{
 const h=harness();h.controller.start({key:'one',plan});h.calls[0].options.onDone();h.next();h.controller.pause();
 h.controller.start({key:'two',plan});assert.equal(h.calls[2].text,'Первая фраза.');
 h.controller.start({key:'one',plan:plan.slice(0,2)});assert.equal(h.calls[3].text,'Первая фраза.');
 h.calls[3].options.onDone();h.next();h.controller.restart();assert.equal(h.calls.at(-1).text,'Первая фраза.');
});
test('Свой запуск не ставится на паузу обёртками; посторонний запрос и стоп сохраняют место',()=>{
 const h=harness();h.controller.start({key:'lesson',plan});
 assert.equal(h.controller.snapshot().phase,'reading');h.controller.requested(h.calls[0].options.readingOwner);
 assert.equal(h.stops(),0);h.controller.requested(null);assert.equal(h.controller.snapshot().phase,'paused');assert.equal(h.stops(),1);
 h.controller.resume();h.controller.stopped();assert.equal(h.controller.snapshot().phase,'paused');assert.equal(h.stops(),1);
});
test('Ошибка речи не пропускает фразу и не планирует продолжение; повтор возможен',()=>{
 const h=harness();h.controller.start({key:'reader',plan,reader:true});
 h.calls[0].options.onError('Сохрани генератор.');h.calls[0].options.onDone();
 assert.equal(h.controller.snapshot().index,0);assert.equal(h.controller.snapshot().phase,'error');assert.equal(h.timers.size,0);
 h.controller.resume();assert.equal(h.calls[1].text,'Первая фраза.');assert.equal(h.controller.snapshot().reader,true);
});
test('Отклонённый запуск и пустой текст дают понятную ошибку без вечного чтения',()=>{
 const h=core.create({speak:()=>false,stopVoice(){}});assert.throws(()=>h.start({key:'empty',plan:[]}),/Добавь текст/);
 h.start({key:'reader',plan});assert.equal(h.snapshot().phase,'error');assert.equal(h.isBusy(),false);
});
