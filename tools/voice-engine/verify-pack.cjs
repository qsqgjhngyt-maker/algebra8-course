// Проверка существующих WAV без генерации и изменения оригиналов.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const preserved=JSON.parse(fs.readFileSync(path.join(__dirname,'preserved-sha256.json'),'utf8'));
for(const record of preserved)assert.equal(hash(fs.readFileSync(path.join(root,record.path))),record.sha256,record.path);
console.log('Неизменных исходных файлов:',preserved.length);
const base=path.join(root,'assets/voice/pilot_v04');
const manifest=JSON.parse(fs.readFileSync(path.join(base,'manifest.json'),'utf8'));
assert.equal(manifest.engine_version,'0.4.0');
const keys=new Set();
const segments=manifest.segments.map(s=>{
  assert.match(s.audio,/^clips\/[a-zA-Z0-9_-]+\.wav$/);
  assert(!keys.has(s.item_id+':'+s.index));keys.add(s.item_id+':'+s.index);
  assert(Number.isInteger(s.index)&&s.index>0);
  assert(Number.isInteger(s.pause_after_ms)&&s.pause_after_ms>=0&&s.pause_after_ms<=5000);
  const b=fs.readFileSync(path.join(base,s.audio));
  assert.equal(b.toString('ascii',0,4),'RIFF');assert.equal(b.toString('ascii',8,12),'WAVE');
  let format=null,data=null;
  for(let i=12;i+8<=b.length;){
    const name=b.toString('ascii',i,i+4),size=b.readUInt32LE(i+4);
    assert(i+8+size<=b.length,'Оборванный WAV');
    if(name==='fmt ')format=b.subarray(i+8,i+8+size);
    if(name==='data')data=b.subarray(i+8,i+8+size);
    i+=8+size+(size%2);
  }
  assert(format&&data);assert.equal(format.readUInt16LE(0),1);
  const channels=format.readUInt16LE(2),rate=format.readUInt32LE(4),bits=format.readUInt16LE(14);
  assert.equal(bits,16);assert(rate>=16000&&channels>0);
  const seconds=data.length/(rate*channels*2);
  assert(seconds>=Math.max(.8,.16*s.prepared_text.split(/\s+/).length),'Слишком короткий WAV');
  let sum=0,peak=0;for(let i=0;i<data.length;i+=2){const v=data.readInt16LE(i)/32768;sum+=v*v;peak=Math.max(peak,Math.abs(v));}
  const rms=Math.sqrt(sum/(data.length/2));assert(rms>=.0025&&peak>=.02,'Тихий или пустой WAV');
  console.log('OK',s.audio,seconds.toFixed(2)+' сек');
  return {...s,sha256:hash(b),duration_seconds:seconds};
});
const payload={...manifest,segments};
const generated='/* Проверенные файлы pilot_v04; создано verify-pack.cjs. */\nwindow.KITSUNE_STATIC_PACK_V04 = '+JSON.stringify(payload,null,2)+';\n';
if(process.argv.includes('--write'))fs.writeFileSync(path.join(root,'static-voice-pack-v04.js'),generated);
else assert.equal(fs.readFileSync(path.join(root,'static-voice-pack-v04.js'),'utf8'),generated,'Индекс пакета изменился');
console.log('Проверено записей:',segments.length);
