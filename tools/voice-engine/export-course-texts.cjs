'use strict';
// Подготовка текстов следующего пакета из реального проекта. WAV не создаются.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),read=name=>fs.readFileSync(path.join(root,name),'utf8');
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const normalize=text=>String(text||'').normalize('NFC').replace(/\s+/g,' ').trim();
// Используем тот же порядок загрузки данных и проверки curriculum, что и проект.
const box={require,__dirname:root,process:{argv:['node','export',root]},structuredClone,global:{structuredClone},console:{log(){}}};
vm.runInNewContext(read('regression-alpha7-current.test.js')+'\nglobalThis.exported={curriculum,theory};',box,{filename:'course-data-check',timeout:10000});
const {curriculum,theory}=box.exported;
const track=curriculum.tracks.find(t=>t.id==='grade8');
const section=track.sections.find(s=>s.id==='g8-ready');
assert(track&&section,'Раздел алгебры 8 класса не найден');
const sourceFiles=fs.readdirSync(root).filter(f=>/^platform-content.*\.js$|^(app|course-v1|chapter1-v02|course-theory-v120|platform-catalog-v300|curriculum-overlay-v310|platform-v300)\.js$/.test(f)).sort();
const sourceSha256=Object.fromEntries(sourceFiles.map(f=>[f,hash(fs.readFileSync(path.join(root,f)))]));
const pilot={window:{}};vm.runInNewContext(read('static-voice-pack-v04.js'),pilot);
const segments=pilot.window.KITSUNE_STATIC_PACK_V04.segments;
const playable=new Set(segments.map(s=>normalize(s.text)));
for(const id of new Set(segments.map(s=>s.item_id)))playable.add(normalize(segments.filter(s=>s.item_id===id).sort((a,b)=>a.index-b.index).map(s=>s.text).join(' ')));
const items=[];
for(const chapter of section.chapters)for(const topic of chapter.topics){
  const key=track.id+':'+topic.id,data=theory[key];
  assert(data&&typeof data.voice==='string'&&data.voice.trim(),key+' не имеет текста voice');
  items.push({id:'grade8_'+topic.id.replace(/[^a-zA-Z0-9_-]/g,'_'),title:data.title||topic.title,
    track_id:track.id,section_id:section.id,chapter_id:chapter.id,chapter_title:chapter.title,topic_id:topic.id,
    source_field:'KitsuneTheoryContent['+JSON.stringify(key)+'].voice',
    existing_button:'platformSpeakTheory',existing_speech_entry:'v151Speak(data.voice, {state:"explain", force:true})',
    text:data.voice,text_sha256:hash(Buffer.from(data.voice)),pilot_v04_matches:playable.has(normalize(data.voice))});
}
assert.equal(items.length,63,'Изменилась структура алгебры 8 класса');
assert.equal(new Set(items.map(i=>i.id)).size,items.length);
const base={schema:1,status:'texts_only',playable:false,source_build_revision:JSON.parse(read('version.json')).build_revision,
  source_sha256:sourceSha256,pilot_pack:'pilot_v04',pilot_matching_topics:items.filter(i=>i.pilot_v04_matches).length,
  scope:'Только голосовой обзор темы по кнопке Kitsune расскажет тему; полный текст теории и динамические ответы требуют отдельных записей.'};
const full={...base,pack_id:'grade8_algebra_v05_draft',items};
const first={...base,pack_id:'grade8_algebra_pilot_v05_draft',items:items.slice(0,3)};
const output=path.join(__dirname,'course-v05');
for(const [name,data] of [['lesson-candidates.json',full],['first-three-lessons.json',first]]){
  const bytes=JSON.stringify(data,null,2)+'\n',file=path.join(output,name);
  if(process.argv.includes('--write')){fs.mkdirSync(output,{recursive:true});fs.writeFileSync(file,bytes);}
  else assert.equal(fs.readFileSync(file,'utf8'),bytes,name+' не соответствует текущим исходникам; сначала просмотреть изменения, затем --write');
}
console.log(JSON.stringify({topics:items.length,pilot_matching_topics:base.pilot_matching_topics,export_mode:'texts_only',first_three:first.items.map(i=>({topic:i.topic_id,title:i.title}))},null,2));
