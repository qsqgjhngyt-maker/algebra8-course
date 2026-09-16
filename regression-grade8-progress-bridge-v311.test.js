const fs=require('fs'),vm=require('vm'),assert=require('assert');
const ROOT=__dirname;
const bridge=fs.readFileSync(`${ROOT}/grade8-progress-bridge-v311.js`,'utf8');
function store(seed={}){const m=new Map(Object.entries(seed));return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k),dump:()=>Object.fromEntries(m)}}
const ls=store({
  a8_completed:JSON.stringify(['1-1','2-10','bogus']),
  a8_solved:JSON.stringify({'1-1-0':true,'1-1-challenge':true,'2-10-1':true,'bogus-0':true}),
  a8_attempts:'7',a8_correct:'5',
  a8_mistakes:JSON.stringify([{lesson:'1-1',question:'Q',answer:'A',ts:100},{lesson:'trainer',question:'T',answer:'X',ts:101}]),
  'kitsune:v3:progress:grade8':JSON.stringify({solved:{'v3-grade8-g8-a7-1-0':true},completed:['g8-a7-1'],mistakes:[],attempts:3,correct:2})
});
const theory={};for(const id of ['1-1','2-10'])theory[`grade8:${id}`]={};theory['grade8:g8-a7-1']={};
const ctx={window:{KitsuneTheoryContent:theory},localStorage:ls,console,Date};vm.createContext(ctx);vm.runInContext(bridge,ctx);
let p=JSON.parse(ls.getItem('kitsune:v3:progress:grade8'));
assert.deepStrictEqual(new Set(p.completed),new Set(['g8-a7-1','1-1','2-10']));
assert.equal(p.solved['v3-grade8-1-1-0'],true);assert.equal(p.solved['v3-grade8-1-1-challenge'],true);assert.equal(p.solved['v3-grade8-2-10-1'],true);
assert.equal(p.solved['v3-grade8-g8-a7-1-0'],true);assert.equal(p.attempts,10);assert.equal(p.correct,7);
assert.equal(p.mistakes.length,1);assert.equal(p.mistakes[0].lesson,'v3-grade8-1-1');
assert(ls.getItem('a8_completed'),'legacy completed key must remain');assert(ls.getItem('a8_solved'),'legacy solved key must remain');
// Idempotence: same legacy snapshot must not increment counters or duplicate mistakes.
vm.runInContext(bridge,ctx);p=JSON.parse(ls.getItem('kitsune:v3:progress:grade8'));assert.equal(p.attempts,10);assert.equal(p.correct,7);assert.equal(p.mistakes.length,1);
// A later classic-mode attempt is imported as a delta only.
ls.setItem('a8_attempts','9');ls.setItem('a8_correct','6');vm.runInContext(bridge,ctx);p=JSON.parse(ls.getItem('kitsune:v3:progress:grade8'));assert.equal(p.attempts,12);assert.equal(p.correct,8);
console.log('PASS: Grade 8 progress bridge preserves legacy keys, migrates completion/practice, and is idempotent');
