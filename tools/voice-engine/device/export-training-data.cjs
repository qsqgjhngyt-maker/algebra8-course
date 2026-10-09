/* Подготовка данных собственного голоса; исходные WAV не изменяются.
   Это экспорт данных, а не обучение или создание ONNX-модели. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../../..');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const preserved=JSON.parse(fs.readFileSync(path.join(root,'tools/voice-engine/preserved-sha256.json'),'utf8'));
const reference=JSON.parse(fs.readFileSync(path.join(root,'assets/voice/pilot_v04/manifest.json'),'utf8')).reference_sha256;
const args=process.argv.slice(2),destinationFlag=args.indexOf('--output');
const destination=destinationFlag>=0?path.resolve(args[destinationFlag+1]):null;
const includeCandidates=args.includes('--include-unreviewed');
const records=[];
for(const pack of ['pilot_v04',...(includeCandidates?['grade8_algebra_v05']:[])]){
  const base=path.join(root,'assets/voice',pack),manifest=JSON.parse(fs.readFileSync(path.join(base,'manifest.json'),'utf8'));
  assert.equal(manifest.reference_sha256,reference,'У пакета другой эталон голоса');
  for(const s of manifest.segments){
    assert.match(s.audio,/^clips\/[a-zA-Z0-9_-]+\.wav$/);
    const file=path.join(base,s.audio),bytes=fs.readFileSync(file),sha=hash(bytes);
    const expected=s.sha256||preserved.find(r=>r.path===`assets/voice/${pack}/${s.audio}`)?.sha256;
    assert.equal(sha,expected,'WAV изменён: '+file);
    assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WAVE');
    let format,data;
    for(let p=12;p+8<=bytes.length;){const size=bytes.readUInt32LE(p+4);assert(p+8+size<=bytes.length);const chunk=bytes.toString('ascii',p,p+4);if(chunk==='fmt ')format=bytes.subarray(p+8,p+8+size);if(chunk==='data')data=bytes.subarray(p+8,p+8+size);p+=8+size+(size%2);}
    assert(format&&data);assert.equal(format.readUInt16LE(0),1);assert.equal(format.readUInt16LE(2),1);assert.equal(format.readUInt16LE(14),16);
    const rate=format.readUInt32LE(4),seconds=data.length/(rate*2);
    assert(seconds>=.8);assert(s.prepared_text&&!/[|\r\n]/.test(s.prepared_text));
    const id=pack+'_'+path.basename(s.audio,'.wav');
    records.push({id,source:`assets/voice/${pack}/${s.audio}`,sha256:sha,original_text:s.text,spoken_text:s.prepared_text,
      sample_rate:rate,seconds,listening:pack==='pilot_v04'?'approved':'pending',group:pack+':'+s.item_id});
  }
}
const report={schema_version:1,voice_identity:'kitsune',reference_sha256:reference,status:'data_only_not_a_trained_model',
  includes_unreviewed:includeCandidates,clips:records.length,seconds:records.reduce((n,r)=>n+r.seconds,0),
  training_ready:false,reason:'Частичный корпус. Нужны расширение, проверка транскрипций, обучение и проверка собственного голоса.',
  records};
if(destination){
  // Разрешён только отдельный новый каталог; нельзя заменить исходный пакет/предыдущий экспорт.
  assert(!fs.existsSync(destination),'Каталог уже существует: выберите новый --output');
  assert(!destination.startsWith(path.join(root,'assets')+path.sep),'Экспорт запрещён внутри assets');
  fs.mkdirSync(path.join(destination,'wav'),{recursive:true});
  for(const r of records)fs.copyFileSync(path.join(root,r.source),path.join(destination,'wav',r.id+'.wav'));
  fs.writeFileSync(path.join(destination,'metadata.csv'),records.map(r=>`${r.id}.wav|${r.spoken_text}`).join('\n')+'\n');
  fs.writeFileSync(path.join(destination,'dataset.json'),JSON.stringify(report,null,2)+'\n');
}
console.log(JSON.stringify({...report,records:undefined,output:destination},null,2));
