const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
const section=(file,start,end)=>{const text=read(file);return text.slice(text.indexOf(start),text.indexOf(end,text.indexOf(start)));};
const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
function autoHarness(){
  const timers=new Map(),spoken=[];let id=0,settings=false;
  const box={v151VoiceAuto:true,v151VoiceEnabled:true,v151SpeechUnlocked:true,v15Mode:'active',v151AutoSpeechTimer:null,
    v151Speaking:false,v161SpeechTimer:null,AlfiNeuralVoice:{isBusy:()=>false},speechSynthesis:{},
    document:{querySelector:()=>({classList:{contains:()=>settings}})},
    setTimeout:fn=>{timers.set(++id,fn);return id;},clearTimeout:id=>timers.delete(id),
    v151Speak:text=>spoken.push(text)};box.window=box;vm.createContext(box);
  vm.runInContext(section('live-assistant-v15.js','function v151IsSpeechBusy(','function v151Speak('),box);
  vm.runInContext(section('live-assistant-v15.js','function v151AutoSpeak(','function v161CompareVoices('),box);
  return {box,timers,spoken,settings:value=>settings=value};
}
test('Автосовет не перебивает речь или генерацию нейроголоса',()=>{
  const h=autoHarness();h.box.v151Speaking=true;h.box.v151AutoSpeak('повтор','explain');assert.equal(h.timers.size,0);
  h.box.v151Speaking=false;h.box.AlfiNeuralVoice.isBusy=()=>true;
  h.box.v151AutoSpeak('новый','explain');assert.equal(h.timers.size,0);
  h.box.AlfiNeuralVoice.isBusy=()=>false;h.box.v151AutoSpeak('ожидающий','explain');
  h.box.v151Speaking=true;[...h.timers.values()][0]();assert.equal(h.spoken.length,0);
});
test('Автосовет не запускается в открытых настройках',()=>{
  const h=autoHarness();h.settings(true);h.box.v151AutoSpeak('совет','explain');assert.equal(h.timers.size,0);
  h.settings(false);h.box.v151AutoSpeak('совет','explain');h.settings(true);
  [...h.timers.values()][0]();assert.equal(h.spoken.length,0);
});
test('Открытие настроек отменяет ожидающий совет; изменение настроек не запускает пробу',()=>{
  const elements=new Map(),cleared=[],spoken=[];
  const element=id=>{
    if(!elements.has(id)){
      const classes=new Set(),handlers=new Map();
      elements.set(id,{handlers,style:{},dataset:{voiceProfile:'soft'},value:'Голос',classList:{contains:c=>classes.has(c),toggle:c=>classes.has(c)?classes.delete(c):classes.add(c)},
        addEventListener:(event,fn)=>handlers.set(event,fn)});
    }
    return elements.get(id);
  };
  const profile=element('profile'),dom={querySelector:element,querySelectorAll:s=>s==='[data-voice-profile]'?[profile]:[]};
  const noop=()=>{};
  const box={document:{querySelector:s=>s==='#v15Assistant'?dom:element(s)},addEventListener:noop,matchMedia:()=>({matches:false}),speechSynthesis:{},
    clearTimeout:id=>cleared.push(id),v151AutoSpeechTimer:7,v151Speaking:true,v151VoiceAuto:true,
    v15Close:noop,v15ShowTip:noop,v15ExplainSimple:noop,v15Speak:noop,v161CompareVoices:noop,
    v151SaveVoice:noop,v151UpdateVoiceUi:noop,v151RefreshVoices:noop,v151Speak:text=>spoken.push(text)};
  box.window=box;vm.createContext(box);
  vm.runInContext(section('live-assistant-v15.js','function v15Bind(){','/* Список системных голосов'),box);
  box.v15Bind();element('#v15SettingsBtn').handlers.get('click')();
  assert.deepEqual(cleared,[7]);assert.equal(box.v151Speaking,true);assert.equal(box.v151AutoSpeechTimer,null);
  element('#v151VoiceSelect').handlers.get('change')();element('#v161Energy').handlers.get('change')();profile.handlers.get('click')();
  assert.equal(spoken.length,0);
  element('#v151TestVoice').handlers.get('click')();assert.equal(spoken.length,1);
});
function neuralHarness(){
  const active=new Set(),sources=[],fallback=[],marks=[];let maximum=0;
  const node=()=>({connect(){},disconnect(){},gain:{value:0},frequency:{value:0},Q:{value:0},threshold:{value:0},knee:{value:0},ratio:{value:0},attack:{value:0},release:{value:0}});
  const audioCtx={destination:{},createBiquadFilter:node,createGain:node,createDynamicsCompressor:node,createAnalyser:node,
    createBufferSource(){const s={...node(),playbackRate:{value:1},detune:{value:0},start(){active.add(s);maximum=Math.max(maximum,active.size);},stop(){active.delete(s);s.onended?.();}};sources.push(s);return s;}};
  const box={neuralRun:0,neuralBusy:false,audioSource:null,audioCtx,cartoon:0,modelReady:true,mode:'neural',
    v151VoiceEnabled:true,v151SpeechUnlocked:true,Blob,console:{warn(){}},
    loadModule:async()=>({}),verifyStored:async()=>true,cleanText:t=>t,predictWithRuntime:async()=>new Blob(['wav']),
    decodeBlob:async()=>({}),emotion:()=>({rate:0,cents:0,brightness:0}),setStatus(){},updateUi(){},isIOSLike:()=>false,
    systemSpeak:text=>{fallback.push(text);return true;},systemStop(){},v151IsSpeechBusy:()=>box.neuralBusy,
    v161MarkSpeaking:value=>marks.push(value),dispatchEvent(){},CustomEvent:class{},
  };box.window=box;vm.createContext(box);
  vm.runInContext(section('neural-voice-v17.js','function stopNeural(){','async function v17Test(){'),box);
  box.v161StopSpeech=()=>box.stopNeural();
  return {box,sources,active,fallback,marks,maximum:()=>maximum};
}
test('Явная новая реплика останавливает старый нейроголос; поздний onended не меняет новую речь',async()=>{
  const h=neuralHarness();let done=0;
  await h.box.v17SpeakNeural('первый',{force:true,onDone:()=>done++});const late=h.sources[0].onended;
  await h.box.v17SpeakNeural('второй',{force:true});assert.equal(h.maximum(),1);assert.equal(h.active.size,1);
  late();assert.equal(done,0);assert.equal(h.box.neuralBusy,true);
  h.box.stopNeural();assert.equal(h.active.size,0);
});
test('Отменённая генерация не включает запоздалый системный fallback',async()=>{
  const h=neuralHarness();let reject;
  h.box.predictWithRuntime=(_,text)=>text==='старый'?new Promise((_,r)=>reject=r):Promise.resolve(new Blob(['wav']));
  const old=h.box.v17SpeakNeural('старый',{force:true});await flush();assert(reject);
  await h.box.v17SpeakNeural('новый',{force:true});reject(new Error('поздняя ошибка'));
  assert.equal(await old,false);assert.equal(h.fallback.length,0);assert.equal(h.box.neuralBusy,true);h.box.stopNeural();
});
test('Во время нейрогенерации автоматическая реплика пропускается, кнопка стоп отменяет поздний звук',async()=>{
  const h=neuralHarness();let resolve;
  h.box.predictWithRuntime=()=>new Promise(r=>resolve=r);
  const pending=h.box.v17SpeakNeural('генерация',{force:true});await flush();
  assert.equal(await h.box.v17SpeakNeural('автосовет',{force:false}),false);
  h.box.stopNeural();resolve(new Blob(['wav']));assert.equal(await pending,false);assert.equal(h.sources.length,0);
});
test('Fallback нейроголоса не повторяет уже отклонённую попытку WAV',async()=>{
  const h=neuralHarness();let options;
  h.box.loadModule=async()=>{throw new Error('модель недоступна');};
  h.box.systemSpeak=(_,opts)=>{options=opts;return true;};
  await h.box.v17SpeakNeural('текст',{force:true,skipStatic:true});
  assert.equal(options.skipStatic,true);
});
test('Системная речь снимает занятость после последнего сегмента',()=>{
  const queue=new Map(),utterances=[];let id=0;
  const box={v151AutoSpeechTimer:null,v161SpeechTimer:null,v161SpeechRun:0,v151Speaking:false,v151VoiceEnabled:true,v151SpeechUnlocked:true,
    v15LastSpoken:'текст',v15State:'explain',v151SelectedVoice:()=>null,v161SplitSpeech:text=>[text],
    v161Prosody:()=>({rate:1,pitch:1,volume:1,pause:0}),v151IsIOSLike:()=>false,
    v15SetState(){},v151UpdateVoiceUi(){},document:{querySelector:()=>({classList:{remove(){},toggle(){}}})},
    speechSynthesis:{cancel(){},resume(){},speak:u=>utterances.push(u)},SpeechSynthesisUtterance:class{},
    setTimeout:fn=>{queue.set(++id,fn);return id;},clearTimeout:id=>queue.delete(id),dispatchEvent(){},CustomEvent:class{}};
  box.window=box;vm.createContext(box);
  vm.runInContext(section('live-assistant-v15.js','function v161StopSpeech(){','function v15Speak(){'),box);
  box.v151Speak('текст',{force:true});assert.equal(box.v151IsSpeechBusy(),true);
  queue.get(box.v161SpeechTimer)();utterances[0].onstart();utterances[0].onend();queue.get(box.v161SpeechTimer)();
  assert.equal(box.v151IsSpeechBusy(),false);
});
test('Позднее завершение отменённой реплики iPhone не завершает новую',()=>{
  const spoken=[],marks=[];let done=0;
  const box={systemSpeechRun:0,systemSpeaking:false,activeSystemFinish:null,iosInterruptedRecovery:false,
    wrappedSpeak(){},clearSystemSpeechTimers(){},selectRussianSystemVoice:()=>null,performance:{now:()=>0},
    speechSynthesis:{cancel(){},speak:u=>spoken.push(u)},SpeechSynthesisUtterance:class{},
    v161MarkSpeaking:value=>marks.push(value),handsFreeEnabled:()=>false,setInterval(){},setTimeout(){}};
  box.window=box;vm.createContext(box);
  vm.runInContext(section('voice-stability-v2387.js','function stopSystemSpeech(','function wrapIOSDialogSpeech(){'),box);
  box.v161StopSpeech=()=>box.stopSystemSpeech();
  box.speakSystemIOS('старый',{onDone:()=>done++});box.speakSystemIOS('новый',{onDone:()=>done++});
  spoken[0].onend();assert.equal(done,0);assert.equal(box.systemSpeaking,true);
  spoken[1].onend();assert.equal(done,1);assert.equal(box.systemSpeaking,false);
});
