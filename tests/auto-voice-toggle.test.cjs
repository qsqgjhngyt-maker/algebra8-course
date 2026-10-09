const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
function harness(){
  const spoken=[],timers=new Map(),saved=[];let seq=0,stopped=0;
  const box={v151VoiceAuto:false,v151VoiceEnabled:true,v151SpeechUnlocked:false,v15Mode:'active',v151AutoSpeechTimer:null,
    clearTimeout:id=>timers.delete(id),setTimeout:fn=>{timers.set(++seq,fn);return seq;},
    v161StopSpeech:()=>stopped++,v151SaveVoice:()=>saved.push(box.v151VoiceAuto),v151UpdateVoiceUi(){},
    v151Speak:(text,opts)=>spoken.push({text,opts}),v151IsSpeechBusy:()=>false,document:{querySelector:()=>null}};
  box.window=box;vm.createContext(box);
  const src=read('live-assistant-v15.js');
  vm.runInContext(src.slice(src.indexOf('function v151SetAutoVoice('),src.indexOf('function v151UpdateVoiceUi(')),box);
  return {box,spoken,timers,saved,stopped:()=>stopped};
}
test('Включение, выключение, сохранение выбора и отмена ожидающей озвучки',()=>{
  const h=harness();h.box.v151SetAutoVoice(true);
  assert.equal(h.box.v151VoiceAuto,true);assert.equal(h.box.v151SpeechUnlocked,true);
  h.box.v151AutoSpeak('Совет','explain');assert.equal(h.timers.size,1);
  const stale=[...h.timers.values()][0];h.box.v151SetAutoVoice(false);
  assert.equal(h.timers.size,0);assert.equal(h.stopped(),1);stale();assert.equal(h.spoken.length,0);
  assert.deepEqual(h.saved,[true,false]);assert.equal(h.box.v151VoiceEnabled,true);
});
test('Автоозвучка выполняет только актуальный совет и уважает выключенный голос',()=>{
  const h=harness();h.box.v151SetAutoVoice(true);
  h.box.v151AutoSpeak('Первый','explain');h.box.v151AutoSpeak('Последний','happy');
  assert.equal(h.timers.size,1);[...h.timers.values()][0]();assert.equal(h.spoken[0].text,'Последний');
  assert.equal(h.spoken[0].opts.force,false);
  h.box.v151VoiceEnabled=false;h.box.v151AutoSpeak('Нельзя','explain');assert.equal(h.spoken.length,1);
});
test('iPhone сохраняет выбор после загрузки и не блокирует флажок',()=>{
  const storage=new Map([['a8_alfi_voice_auto','1']]);
  const checkbox={disabled:true,closest:()=>({querySelector:()=>({})})};
  const box={window:null,navigator:{userAgent:'iPhone',platform:'iPhone'},localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)},
    document:{querySelector:s=>s==='#kitsuneStability2395Style'?{}:s==='#v151AutoVoice'?checkbox:null,addEventListener(){}},
    setTimeout(){},addEventListener(){},Element:class{}};box.window=box;
  vm.createContext(box);vm.runInContext(read('runtime-stability-v2395.js'),box);
  box.KitsuneRuntimeStability.applyVoicePolicy();
  assert.equal(storage.get('a8_alfi_voice_auto'),'1');assert.equal(checkbox.disabled,false);
});
test('Видимая кнопка, флажок и новые ссылки оболочки согласованы',()=>{
  const src=read('live-assistant-v15.js');
  assert(src.includes('id="v151AutoVoiceToggle" aria-pressed="false"'));
  assert(src.includes('autoToggle.setAttribute("aria-pressed",String(v151VoiceAuto))'));
  assert(src.includes('v151SetAutoVoice(autoVoice.checked)'));
  assert(src.includes('()=>v151SetAutoVoice(!v151VoiceAuto)'));
  for(const file of ['index.html','sw.js'])for(const asset of ['styles.css','live-assistant-v15.js','runtime-stability-v2395.js'])
    assert(read(file).includes(asset+'?v='+(asset==='live-assistant-v15.js'?'piper-v07.4':'auto-voice-toggle-v04.1')));
});
