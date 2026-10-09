/* Формат именно одобренной модели Piper. Старый словарь ударений остаётся общим. */
(() => {
  'use strict';
  const MODEL='e8a65629b7590195d03072495c5cbd4198ba526051f5e40d279f8d91529dc913';
  const CONFIG='4df10841559dac37f783b4a7329603afbf51508177d0861601a3fe630f9cd176';
  const REF='50e9ea8ff8e7b3513c7b41080c36ac3ed82a333617d46195da081da4feae77c4';
  const RU_DICT='ad087eb02abe6eb061d74e8cb438aab322443bd6dd3620e76497c5694310fe6c';
  const RU_DICT_BYTES=9053144;
  const required=['model/kitsune.onnx','model/kitsune.onnx.json','runtime/ort.wasm.min.js',
    'runtime/ort-wasm-simd-threaded.mjs','runtime/ort-wasm-simd-threaded.wasm',
    'runtime/piper_phonemize.js','runtime/piper_phonemize.wasm','runtime/piper_phonemize.data','runtime/ru_dict.bin'];
  function validateManifest(m){
    if(m?.schema_version!==3||m.engine!=='kitsune-piper-v07'||m.voice_identity!=='kitsune'||m.reference_sha256!==REF)throw Error('Пакет не относится к одобренному голосу Китсуне.');
    const seen=new Set();
    for(const f of m.files||[]){
      if(!/^(model|runtime)\/[a-zA-Z0-9_.-]+$/.test(f.path)||seen.has(f.path)||!Number.isSafeInteger(f.bytes)||f.bytes<=0||!/^[0-9a-f]{64}$/.test(f.sha256))throw Error('Повреждено описание пакета голоса.');
      seen.add(f.path);
    }
    if(m.files.find(f=>f.path==='model/kitsune.onnx')?.sha256!==MODEL||m.files.find(f=>f.path==='model/kitsune.onnx.json')?.sha256!==CONFIG||m.validation?.listening?.status!=='approved_by_user')throw Error('Модель отличается от прослушанного голоса.');
    const dictionary=m.files.find(f=>f.path==='runtime/ru_dict.bin');
    if(dictionary?.sha256!==RU_DICT||dictionary.bytes!==RU_DICT_BYTES)throw Error('Нужен русский словарь из окружения обучения одобренного голоса. Обнови локальный комплект Piper.');
    if(m.status==='candidate_missing_runtime')throw Error('На ПК один раз запусти INSTALL_PIPER.bat, затем сохрани генератор в настройках Китсуне.');
    if(required.some(p=>!seen.has(p))||m.validation?.native_cpu?.status!=='passed'||m.validation?.phonemizer_wasm?.status!=='passed'||m.validation?.full_tts_wasm?.status!=='passed')throw Error('Компоненты Piper ещё не прошли локальную проверку. Запусти INSTALL_PIPER.bat на ПК.');
    return m;
  }
  function installDictionary(module,data){
    const bytes=ArrayBuffer.isView(data)?new Uint8Array(data.buffer,data.byteOffset,data.byteLength):new Uint8Array(data);
    if(bytes.byteLength!==RU_DICT_BYTES||typeof module?.FS?.writeFile!=='function')throw Error('Не удалось подключить проверенный русский словарь.');
    // До callMain: старый ru_dict внутри .data игнорирует U+0301. Остальные
    // данные eSpeak не заменяются. Для каждого экземпляра используется словарь обучения.
    module.FS.writeFile('/espeak-ng-data/ru_dict',bytes);
  }
  function validateConfig(c){
    if(c?.audio?.sample_rate!==22050||c.espeak?.voice!=='ru'||c.phoneme_type!=='espeak'||c.num_symbols!==256||c.num_speakers!==1)throw Error('Неверный конфиг Piper.');
    const map=c.phoneme_id_map;
    if(!map||Object.keys(map).length!==151||JSON.stringify([map['_'],map['^'],map['$']])!=='[[0],[1],[2]]')throw Error('Изменилась обученная таблица фонем.');
    for(const ids of Object.values(map))if(!Array.isArray(ids)||!ids.length||ids.some(n=>!Number.isInteger(n)||n<0||n>=256))throw Error('Повреждена таблица фонем.');
    const scales=[c.inference?.noise_scale,c.inference?.length_scale,c.inference?.noise_w];
    if(scales.some(n=>!Number.isFinite(n)||n<=0)||scales[1]>2)throw Error('Неверные параметры речи.');
    return c;
  }
  function phonemesToIds(phonemes,c){
    const map=c.phoneme_id_map;
    if(!Array.isArray(phonemes)||!phonemes.length||phonemes.length>1000)throw Error('Не удалось разобрать русский текст.');
    const ids=[...map['^'],...map['_']];
    for(const p of phonemes){
      if(typeof p!=='string'||!Object.hasOwn(map,p))throw Error('Неизвестный звук в тексте: '+String(p));
      ids.push(...map[p],...map['_']);
    }
    ids.push(...map['$']);return ids;
  }
  function pronunciationRevision(text){
    return /(?<![а-яё\u0301])(?:це\u0301?ль|но\u0301?ль)(?![а-яё\u0301])/i.test(text)?'final-soft-l-v1':'';
  }
  function softenFinalL(text,phonemes){
    if(!pronunciationRevision(text))return phonemes;
    const words=String(text).toLowerCase().replace(/\u0301/g,'').match(/[а-яё]+/g)||[];
    const groups=[];let start=null;
    for(let i=0;i<=phonemes.length;i++){
      if(i===phonemes.length||/^[\s.,;:!?…—]$/.test(phonemes[i])){
        if(start!==null){groups.push({start,end:i});start=null;}
      }else if(start===null)start=i;
    }
    // Правим только однозначно совмещённые слова. Смешанный текст и
    // несовпадающие границы не должны менять произношение соседних слов.
    if(words.length!==groups.length)return phonemes;
    const result=phonemes.slice();
    for(let i=groups.length-1;i>=0;i--){
      const {end}=groups[i];
      if((words[i]==='цель'||words[i]==='ноль')&&result[end-1]==='ɭ')result.splice(end,0,'ʲ');
    }
    return result;
  }
  function parseOutput(lines,c,text=''){
    const records=lines.map(s=>{try{return JSON.parse(s);}catch{return null;}}).filter(r=>r&&Array.isArray(r.phonemes));
    if(records.length!==1)throw Error('Не удалось получить фонемы новой фразы.');
    // Встроенные IDs фонемизатора не используем: они могут принадлежать иной
    // версии. Наши BOS/PAD/EOS и все звуки берём только из конфига обучения.
    const phonemes=softenFinalL(text,records[0].phonemes);
    return {phonemes,ids:phonemesToIds(phonemes,c)};
  }
  function wav(signal,rate=22050){
    if(!(signal instanceof Float32Array)||signal.length<rate*.12||signal.length>rate*90)throw Error('Некорректная длина записи Piper.');
    let energy=0;for(const x of signal){if(!Number.isFinite(x))throw Error('Повреждённый звук Piper.');energy+=x*x;}
    if(Math.sqrt(energy/signal.length)<.001)throw Error('Piper вернул слишком тихую запись.');
    const out=new ArrayBuffer(44+signal.length*2),v=new DataView(out);
    const str=(at,s)=>Array.from(s).forEach((c,i)=>v.setUint8(at+i,c.charCodeAt(0)));
    str(0,'RIFF');v.setUint32(4,out.byteLength-8,true);str(8,'WAVEfmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,rate,true);v.setUint32(28,rate*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);str(36,'data');v.setUint32(40,signal.length*2,true);
    signal.forEach((x,i)=>v.setInt16(44+i*2,Math.round(Math.max(-1,Math.min(1,x))*32767),true));return out;
  }
  const api={MODEL,CONFIG,REF,RU_DICT,RU_DICT_BYTES,required,validateManifest,installDictionary,validateConfig,phonemesToIds,pronunciationRevision,softenFinalL,parseOutput,wav};
  globalThis.KitsunePiperCore=api;if(typeof module!=='undefined')module.exports=api;
})();
