'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
function seeded(){
  const data=new Map([
    ['a8_completed',JSON.stringify(['1-1','1-2'])],['a8_solved',JSON.stringify({'1-1-0':true})],['a8_attempts','7'],['a8_correct','5'],
    ['a8_mistakes',JSON.stringify([{lesson:'1-1',question:'Вопрос',answer:'Неверный ответ',ts:100}])],
    ['kitsune:v3:progress:grade8',JSON.stringify({completed:['1-3'],solved:{'v3-grade8-1-3-0':true},attempts:3,correct:2,mistakes:[]})],
    ['kitsune:v3:progress:grade7',JSON.stringify({completed:['g7-a1-1'],solved:{'v3-grade7-g7-a1-1-0':true},attempts:4,correct:3,mistakes:[]})],
    ['kitsune:v3:progress:ege-profile',JSON.stringify({completed:['topic'],attempts:2,correct:1})],
    ['a8_lastLesson','1-2'],['a8_streak',JSON.stringify({count:12,last:'2026-10-09'})],['a8_alfi_voice_auto','0'],
    ['kitsune-reader-v074',JSON.stringify({text:'Сохранённый рассказ.',bookmarks:{story:{index:2,total:6,head:'Сохранённый рассказ.',tail:'Сохранённый рассказ.'}}})]
  ]);
  const initial=new Map(data),storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,String(v)),removeItem(){throw Error('Удаление данных запрещено в проверке обновления');},clear(){throw Error('Очистка запрещена в проверке обновления');}};
  const box={window:{KitsuneTheoryContent:{'grade8:1-1':{},'grade8:1-2':{},'grade8:1-3':{}}},localStorage:storage,Date,console};vm.createContext(box);
  return {data,initial,box};
}
test('Повторные запуски при обновлении сохраняют прогресс всех курсов, настройки и закладки',()=>{
  const h=seeded(),bridge=read('grade8-progress-bridge-v311.js');
  for(let i=0;i<3;i++)vm.runInContext(bridge,h.box);
  for(const [key,value] of h.initial)if(key!=='kitsune:v3:progress:grade8')assert.equal(h.data.get(key),value,key);
  const p=JSON.parse(h.data.get('kitsune:v3:progress:grade8'));
  assert.deepEqual(new Set(p.completed),new Set(['1-1','1-2','1-3']));assert.equal(p.attempts,10);assert.equal(p.correct,7);
  assert.equal(p.mistakes.length,1);assert.equal(p.solved['v3-grade8-1-1-0'],true);assert.equal(p.solved['v3-grade8-1-3-0'],true);
});
test('Новый результат старого режима добавляется один раз после обновления',()=>{
  const h=seeded(),bridge=read('grade8-progress-bridge-v311.js');vm.runInContext(bridge,h.box);
  h.data.set('a8_attempts','9');h.data.set('a8_correct','6');
  for(let i=0;i<3;i++)vm.runInContext(bridge,h.box);
  const p=JSON.parse(h.data.get('kitsune:v3:progress:grade8'));assert.equal(p.attempts,12);assert.equal(p.correct,8);assert.equal(p.mistakes.length,1);
});
test('Идентичность установленной PWA и ключи Grade 8 сохранены',()=>{
  const m=JSON.parse(read('manifest.json'));for(const k of ['id','scope','start_url'])assert.equal(m[k],'./');
  const bridge=read('grade8-progress-bridge-v311.js');assert(bridge.includes("const V3_KEY='kitsune:v3:progress:grade8'"));assert(bridge.includes("const META_KEY='kitsune:v3:migration:grade8-legacy-v311'"));
  for(const f of ['sw.js','pwa-update.js','migration-v302.js','grade8-progress-bridge-v311.js'])assert(!/localStorage\.(?:clear|removeItem)\s*\(|indexedDB\.deleteDatabase\s*\(/.test(read(f)),f);
  assert(read('pwa-update.js').includes('SKIP_WAITING'));assert(read('kitsune-reader-v074.js').includes("const STORE='kitsune-reader-v074'"));
});
