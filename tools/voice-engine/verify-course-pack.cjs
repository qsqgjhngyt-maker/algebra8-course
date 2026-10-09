/* Проверка учебного пакета и создание индекса для обычных кнопок курса. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),base=path.join(root,'assets/voice/grade8_algebra_v05');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const normalize=s=>s.normalize('NFC').replace(/\s+/g,' ').trim();
const current=JSON.parse(fs.readFileSync(path.join(__dirname,'course-v05/lesson-candidates.json'),'utf8'));
const manifest=JSON.parse(fs.readFileSync(path.join(base,'manifest.json'),'utf8'));
const pilot=JSON.parse(fs.readFileSync(path.join(root,'assets/voice/pilot_v04/manifest.json'),'utf8'));
assert.equal(manifest.pack_id,'grade8_algebra_v05');assert.equal(manifest.engine_version,'0.5.0');
assert.equal(manifest.reference_sha256,pilot.reference_sha256);assert.equal(manifest.validation.technical,'passed');
const unique=new Set();
for(const item of manifest.items){
 assert(!unique.has(item.id));unique.add(item.id);
 const source=current.items.find(x=>x.id===item.id);assert(source,item.id);
 assert.equal(item.text,source.text);assert.equal(sha(Buffer.from(item.text)),item.text_sha256);
 const segments=manifest.segments.filter(s=>s.item_id===item.id).sort((a,b)=>a.index-b.index);
 assert(segments.length);assert.equal(normalize(segments.map(s=>s.text).join(' ')),normalize(item.text));
 segments.forEach((s,i)=>assert.equal(s.index,i+1));
}
let seconds=0,bytes=0;
for(const segment of manifest.segments){
 assert(unique.has(segment.item_id));assert.match(segment.audio,/^clips\/[a-zA-Z0-9_-]+\.wav$/);
 assert.equal(segment.pause_after_ms,300);
 const b=fs.readFileSync(path.join(base,segment.audio));assert.equal(sha(b),segment.sha256);
 assert.equal(b.toString('ascii',0,4),'RIFF');assert.equal(b.toString('ascii',8,12),'WAVE');
 assert.equal(b.readUInt32LE(4)+8,b.length);
 let format,data;
 for(let i=12;i+8<=b.length;){const name=b.toString('ascii',i,i+4),length=b.readUInt32LE(i+4);assert(i+8+length<=b.length);if(name==='fmt ')format=b.subarray(i+8,i+8+length);if(name==='data')data=b.subarray(i+8,i+8+length);i+=8+length+length%2;}
 assert(format&&data);assert.equal(format.readUInt16LE(0),1);assert.equal(format.readUInt16LE(2),1);assert.equal(format.readUInt16LE(14),16);
 const rate=format.readUInt32LE(4),duration=data.length/(rate*2);assert(rate>=16000);
 assert(duration>=Math.max(.8,.16*segment.prepared_text.split(/\s+/).length));
 let sum=0,peak=0;for(let i=0;i<data.length;i+=2){const v=data.readInt16LE(i)/32768;sum+=v*v;peak=Math.max(peak,Math.abs(v));}
 assert(Math.sqrt(sum/(data.length/2))>=.0025&&peak>=.02);
 assert.equal(duration,segment.duration_seconds);seconds+=duration;bytes+=b.length;
}
const payload={pack_id:manifest.pack_id,engine_version:manifest.engine_version,validation:manifest.validation,
 items:manifest.items.map(({id,title,topic_id,text,text_sha256})=>({id,title,topic_id,text,text_sha256})),
 segments:manifest.segments.map(({item_id,index,text,prepared_text,audio,pause_after_ms,sha256,duration_seconds})=>({item_id,index,text,prepared_text,audio,pause_after_ms,sha256,duration_seconds}))};
const generated='/* Учебные WAV: техническая проверка пройдена; прослушивание ожидается. */\nwindow.KITSUNE_STATIC_COURSE_PACK_V05 = '+JSON.stringify(payload,null,2)+';\n';
const index=path.join(root,'static-voice-course-pack-v05.js');
if(process.argv.includes('--write'))fs.writeFileSync(index,generated);else assert.equal(fs.readFileSync(index,'utf8'),generated);
console.log(JSON.stringify({topics:manifest.items.length,clips:manifest.segments.length,seconds,bytes,listening:manifest.validation.listening}));
