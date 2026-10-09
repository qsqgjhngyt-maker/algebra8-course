/* Проверка настоящего фонемизатора WASM и полной новой фразы в Node.
   Это проверка вычислений, а не браузера или физического телефона. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const base=path.resolve(process.argv[2]||''),core=require('./piper-voice-core-v07.js');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const deadline=setTimeout(()=>{console.error('Проверка русского компонента заняла больше двух минут. Пакет не активирован.');process.exit(1);},120000);deadline.unref();
async function verify(){
  assert(process.argv[2],'Укажите каталог пакета Piper');
  const target=path.join(base,'manifest.json'),m=JSON.parse(fs.readFileSync(target,'utf8'));
  const c=core.validateConfig(JSON.parse(fs.readFileSync(path.join(base,'model/kitsune.onnx.json'),'utf8')));
  assert.equal(hash(fs.readFileSync(path.join(base,'model/kitsune.onnx'))),core.MODEL);
  assert.equal(hash(fs.readFileSync(path.join(base,'model/kitsune.onnx.json'))),core.CONFIG);
  for(const f of m.files){const b=fs.readFileSync(path.join(base,f.path));assert.equal(b.length,f.bytes,f.path);assert.equal(hash(b),f.sha256,f.path);}
  for(const f of core.required)assert(m.files.some(r=>r.path===f),'Нет '+f);
  const runtime=path.join(base,'runtime');
  const dictionary=fs.readFileSync(path.join(runtime,'ru_dict.bin'));
  assert.equal(hash(dictionary),core.RU_DICT,'Словарь отличается от окружения обучения');
  const wasm=fs.readFileSync(path.join(runtime,'piper_phonemize.wasm'));
  const dataBuffer=fs.readFileSync(path.join(runtime,'piper_phonemize.data'));
  const data=dataBuffer.buffer.slice(dataBuffer.byteOffset,dataBuffer.byteOffset+dataBuffer.length);
  const create=require(path.join(runtime,'piper_phonemize.js'));
  assert.equal(typeof create,'function','Не найден createPiperPhonemize');
  const originalFetch=globalThis.fetch;
  globalThis.fetch=()=>Promise.reject(Error('Сеть в проверке генерации запрещена'));
  try{
    async function phonemize(text){
      const lines=[],errors=[];
      const module=await create({noInitialRun:true,wasmBinary:wasm,getPreloadedPackage:()=>data,
        locateFile:name=>'kitsune-memory:///'+name,print:s=>lines.push(s),printErr:s=>errors.push(s)});
      core.installDictionary(module,dictionary);
      try{module.callMain(['-l','ru','--input',JSON.stringify([{text}]),'--espeak_data','/espeak-ng-data']);}
      catch(e){if(e?.name!=='ExitStatus'||e.status!==0)throw e;}
      assert(!errors.some(s=>/missing phoneme|error|failed/i.test(s)),errors.join('\n'));
      return core.parseOutput(lines,c);
    }
    const early=(await phonemize('за́мок')).phonemes.join(''),late=(await phonemize('замо́к')).phonemes.join('');
    assert.notEqual(early,late,'Фонемизатор не различает явные ударения');
    assert(early.includes('ˈ')&&late.includes('ˈ'),'Нет ударения в фонемах');
    assert.equal(early,'zˈɑmʌk','Изменилось произношение за́мок');assert.equal(late,'zamˈok','Изменилось произношение замо́к');
    const checks=JSON.parse(fs.readFileSync(path.join(base,'model/phoneme-cases.json'),'utf8'));
    const records=[];
    for(const item of checks.records){
      const result=await phonemize(item.text);
      records.push({id:item.id,phonemes:result.phonemes.join(''),matches_native:result.phonemes.join('')===item.phonemes.join(''),ids:result.ids.length});
    }
    assert(records.length>0&&records.every(r=>r.matches_native),'Фонемы отличаются от окружения обучения: '+records.filter(r=>!r.matches_native).map(r=>r.id).join(', '));
    const ort=require(path.join(runtime,'ort.wasm.min.js'));
    ort.env.wasm.numThreads=1;ort.env.wasm.proxy=false;ort.env.logLevel='error';
    ort.env.wasm.wasmPaths={mjs:pathToFileURL(path.join(runtime,'ort-wasm-simd-threaded.mjs')).href};
    ort.env.wasm.wasmBinary=fs.readFileSync(path.join(runtime,'ort-wasm-simd-threaded.wasm'));
    const start=performance.now();
    const session=await ort.InferenceSession.create(fs.readFileSync(path.join(base,'model/kitsune.onnx')),{executionProviders:['wasm'],graphOptimizationLevel:'all'});
    const loadSeconds=(performance.now()-start)/1000,audio=[];
    try{
      // Фразы для приветствия, разговора, шага и обоих результатов.
      const samples=[...checks.audition_texts,{id:'07_new_example',text:'Давай проверим свежий пример. Если икс равен минус пяти, знамена́тель икс плюс пять равен нулю.'}];
      for(const item of samples){
        const since=performance.now(),{ids}=await phonemize(item.text);
        const feeds={input:new ort.Tensor('int64',BigInt64Array.from(ids,n=>BigInt(n)),[1,ids.length]),
          input_lengths:new ort.Tensor('int64',BigInt64Array.of(BigInt(ids.length)),[1]),
          scales:new ort.Tensor('float32',Float32Array.of(c.inference.noise_scale,c.inference.length_scale,c.inference.noise_w),[3])};
        const outputs=await session.run(feeds),signal=outputs[session.outputNames[0]].data;
        const wav=core.wav(signal),file=item.id+'.wav';
        const outDir=path.join(base,'.runtime-staging/full-tts');fs.mkdirSync(outDir,{recursive:true});fs.writeFileSync(path.join(outDir,file),Buffer.from(wav));
        audio.push({id:item.id,text:item.text,generation_seconds:(performance.now()-since)/1000,audio_seconds:signal.length/22050,sha256:hash(Buffer.from(wav))});
        for(const t of [...Object.values(feeds),...Object.values(outputs)])t.dispose?.();
        console.log('Проверена новая фраза:',item.id);
      }
    }finally{await session.release();}
    const report={status:'passed',environment:'Node V8/WASM; browser and phones not tested',network:'blocked',threads:1,model_sha256:core.MODEL,
      russian_dictionary_sha256:core.RU_DICT,model_load_seconds:loadSeconds,stress:{early,late},phoneme_records:records,audio,PC_browser:'not_tested',Android:'not_tested',iOS:'not_tested'};
    fs.writeFileSync(path.join(base,'.runtime-staging/full-tts/report.json'),JSON.stringify(report,null,2)+'\n');
    m.validation.phonemizer_wasm={status:'passed',environment:report.environment,stress_distinguished:true,native_phoneme_matches:records.filter(r=>r.matches_native).length,cases:records.length};
    m.validation.full_tts_wasm={status:'passed',environment:report.environment,phrases:audio.length,network:'blocked'};
    m.status='candidate_needs_device_validation';core.validateManifest(m);
    fs.writeFileSync(target+'.next',JSON.stringify(m,null,2)+'\n');fs.renameSync(target+'.next',target);
    console.log('Полная генерация проверена. Браузеры ПК, Android и iOS ожидают проверки.');
  }finally{globalThis.fetch=originalFetch;}
}
verify().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>clearTimeout(deadline));
