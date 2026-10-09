/* Отдельная локальная PWA только из доступного исходного проекта. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'../../..'),core=require(path.join(root,'piper-voice-core-v07.js'));
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function prepare({result,phonemes,destination}){
  result=path.resolve(result);phonemes=path.resolve(phonemes);destination=path.resolve(destination);
  assert(!fs.existsSync(destination),'Предыдущая копия сохраняется: выберите новый каталог');
  const approval=JSON.parse(fs.readFileSync(path.join(__dirname,'../piper-pilot/APPROVAL_RU.json'),'utf8'));
  assert.equal(approval.status,'voice_approved_by_user');assert.equal(approval.model_sha256,core.MODEL);
  const model=fs.readFileSync(path.join(result,'model/kitsune.onnx'));
  const config=fs.readFileSync(path.join(result,'model/kitsune.onnx.json'));
  assert.equal(hash(model),core.MODEL);assert.equal(hash(config),core.CONFIG);core.validateConfig(JSON.parse(config));
  const provenance=JSON.parse(fs.readFileSync(path.join(result,'result.json'),'utf8'));
  for(const f of provenance.files){const b=fs.readFileSync(path.join(result,f.file));assert.equal(b.length,f.bytes,f.file);assert.equal(hash(b),f.sha256,f.file);}
  const probes=JSON.parse(fs.readFileSync(phonemes,'utf8'));assert.equal(probes.status,'phonemes_verified');assert.equal(probes.base_ids_unchanged,true);
  execFileSync(process.execPath,[path.join(__dirname,'../verify-pack.cjs')],{stdio:'inherit'});
  execFileSync(process.execPath,[path.join(__dirname,'../verify-course-pack.cjs')],{stdio:'inherit'});
  const copy=(from,relative)=>{const to=path.join(destination,relative);fs.mkdirSync(path.dirname(to),{recursive:true});fs.copyFileSync(from,to);};
  const write=(relative,bytes)=>{const to=path.join(destination,relative);fs.mkdirSync(path.dirname(to),{recursive:true});fs.writeFileSync(to,bytes);};
  const originalSw=fs.readFileSync(path.join(root,'sw.js'),'utf8'),assets=JSON.parse(originalSw.match(/const CORE_ASSETS=(\[[\s\S]*?\]);/)[1]);
  for(const ref of [...assets,'./sw.js','./version.json']){const file=ref.split('?')[0];copy(path.join(root,file),path.join('public',file));}
  for(const name of ['piper-voice-core-v07.js','piper-voice-worker-v07.js','kitsune-reading-core-v074.js','kitsune-reader-v074.js','kitsune-reader-v074.css'])copy(path.join(root,name),'public/'+name);
  for(const name of ['pilot_v04','grade8_algebra_v05']){
    const base='assets/voice/'+name,m=JSON.parse(fs.readFileSync(path.join(root,base,'manifest.json'),'utf8'));
    for(const f of ['manifest.json',...m.segments.map(s=>s.audio)])copy(path.join(root,base,f),'public/'+base+'/'+f);
  }
  const pack='public/assets/voice/kitsune_piper_v07',files=[];
  const record=(relative,bytes)=>{write(pack+'/'+relative,bytes);files.push({path:relative,bytes:bytes.length,sha256:hash(bytes)});};
  record('model/kitsune.onnx',model);record('model/kitsune.onnx.json',config);
  const settings=JSON.parse(fs.readFileSync(path.join(__dirname,'../piper-pilot/settings.json'),'utf8'));
  record('model/phoneme-cases.json',Buffer.from(JSON.stringify({records:probes.records,audition_texts:settings.audition_texts},null,2)+'\n'));
  for(const name of ['ort.wasm.min.js','ort-wasm-simd-threaded.mjs','ort-wasm-simd-threaded.wasm','LICENSE_ONNXRUNTIME.txt']){
    record('runtime/'+name,fs.readFileSync(path.join(root,'assets/voice/kitsune_ondevice_v06/runtime',name)));
  }
  const dictionary=fs.readFileSync(path.join(__dirname,'data/ru_dict.bin'));
  assert.equal(dictionary.length,core.RU_DICT_BYTES);assert.equal(hash(dictionary),core.RU_DICT);
  record('runtime/ru_dict.bin',dictionary);
  copy(path.join(__dirname,'data/SOURCE_RU.json'),'licenses/RUSSIAN_DICTIONARY_SOURCE_RU.json');
  copy(path.join(__dirname,'data/COPYING'),'licenses/RUSSIAN_DICTIONARY_COPYING.txt');
  const native=JSON.parse(fs.readFileSync(path.join(result,'reports/native.json'),'utf8'));
  const wasm=JSON.parse(fs.readFileSync(path.join(result,'reports/wasm.json'),'utf8'));
  assert.equal(native.model_sha256,core.MODEL);assert.equal(wasm.model_sha256,core.MODEL);
  const manifest={schema_version:3,engine:'kitsune-piper-v07',voice_identity:'kitsune',reference_sha256:core.REF,
    status:'candidate_missing_runtime',files,model_bytes:model.length,public_distribution:'not_prepared',
    runtime_onnx:'onnxruntime-web@1.22.0',validation:{listening:{status:'approved_by_user',date:approval.approval_date,model_sha256:core.MODEL},
      native_cpu:{status:'passed',model_sha256:core.MODEL},onnx_wasm:{status:'passed',environment:'Node V8; phoneme preparation excluded'},
      phonemizer_wasm:{status:'not_tested'},full_tts_wasm:{status:'not_tested'},PC_browser:{status:'not_tested'},Android:{status:'not_tested'},iOS:{status:'not_tested'}}};
  write(pack+'/manifest.json',JSON.stringify(manifest,null,2)+'\n');
  copy(path.join(__dirname,'../piper-pilot/APPROVAL_RU.json'),'APPROVAL_RU.json');
  for(const name of ['BASE_MODEL_CARD.txt','PIPER_COPYING.txt'])copy(path.join(result,'reports',name),'licenses/'+name);
  for(const name of ['Install_Piper_Runtime.ps1','INSTALL_PIPER.bat','verify-runtime.cjs','README_RU.txt','VALIDATION_RU.txt'])copy(path.join(__dirname,name),name);
  copy(path.join(root,'piper-voice-core-v07.js'),'piper-voice-core-v07.js');
  for(const name of ['server.cjs','Start_Local.ps1','START.bat','check.html','local-test-panel.js','HTTPS_RU.txt'])copy(path.join(__dirname,'../local-preview',name),name);
  const starterPath=path.join(destination,'Start_Local.ps1');
  const starter=fs.readFileSync(starterPath,'utf8').replace("[string]$StateDirectory = (Join-Path $PSScriptRoot '.local-state')",
    "[string]$StateDirectory = $(if(Test-Path -LiteralPath (Join-Path $PSScriptRoot '../Kitsune_Local_Server/.local-state/certificate-info.json')){Join-Path $PSScriptRoot '../Kitsune_Local_Server/.local-state'}else{Join-Path $PSScriptRoot '.local-state'})");
  write('Start_Local.ps1',starter);
  // Устаревший баннер убран. Пустой совместимый файл нужен уже работающему
  // серверу прежней версии: он ещё добавляет этот адрес в ответ index.html.
  const panel='/* Совместимость с прежним локальным сервером: баннер проверки убран. */\n';
  write('local-test-panel.js',panel);write('public/local-test-panel.js',panel);
  const serverFile=path.join(destination,'server.cjs'),server=fs.readFileSync(serverFile,'utf8');
  const injected='  if(relative===\'index.html\'){\n    bytes=Buffer.from(fs.readFileSync(file,\'utf8\').replace(\'</body>\',\'<script src="./local-test-panel.js?v=2"></script>\\n</body>\'));\n    size=bytes.length;\n  }';
  const normalizedServer=server.replace(/\r\n/g,'\n');assert(normalizedServer.includes(injected),'Изменилась локальная вставка панели; проверьте server.cjs');
  write('server.cjs',normalizedServer.replace('  // Панель существует только на этой тестовой копии. Байты файлов проекта сохранены.\n'+injected+'\n',''));
  const revision='voice-piper-v07-'+hash(Buffer.concat(['dynamic-voice-v05.js','live-assistant-v15.js','kitsune-brain-v18.js','piper-voice-core-v07.js','piper-voice-worker-v07.js','ondevice-voice-core-v06.js','school-notation-v3045.js','platform-v300.js','startup-intro.css','static-voice-v04.js','theory-engine-v300.js','kitsune-reading-core-v074.js','kitsune-reader-v074.js','kitsune-reader-v074.css','tools/voice-engine/piper-browser/prepare-preview.cjs'].map(f=>fs.readFileSync(path.join(root,f))))).slice(0,12);
  let html=fs.readFileSync(path.join(destination,'public/index.html'),'utf8');
  html=html.replace(/(<meta name="kitsune-app-build" content=")[^"]+/,'$1'+revision);
  const old='./dynamic-voice-v05.js?v=device-v06.1',next='./dynamic-voice-v05.js?v=piper-v07.4';
  const needsPiper=html.includes('<script src="'+old+'"></script>');
  assert(needsPiper||html.includes('data-voice-engine="piper-v07"'),'Изменился исходный тег генератора; требуется проверить структуру PWA');
  if(needsPiper)html=html.replace('<script src="'+old+'"></script>','<script src="./piper-voice-core-v07.js"></script>\n  <script src="'+next+'" data-voice-engine="piper-v07"></script>\n  <script src="./kitsune-reading-core-v074.js?v=reading-v074.1"></script>\n  <script src="./kitsune-reader-v074.js?v=reading-v074.1"></script>');
  if(!html.includes('./kitsune-reader-v074.css'))html=html.replace('</head>','<link rel="stylesheet" href="./kitsune-reader-v074.css?v=reading-v074.1">\n</head>');
  // В отдельной копии обновлённый UI тоже имеет собственный адрес кэша.
  const oldAssistant=(html.match(/\.\/live-assistant-v15\.js\?v=[^"\s]+/)||[])[0];assert(oldAssistant);
  const oldIntroStyle='./startup-intro.css?v=cinematic-v316.2',nextIntroStyle='./startup-intro.css?v=cinematic-v316.3';
  assert(html.includes(oldIntroStyle)||html.includes(nextIntroStyle),'Изменилась ссылка оформления заставки; проверьте исходный index.html');
  html=html.replaceAll(oldAssistant,'./live-assistant-v15.js?v=piper-v07.4').replace(oldIntroStyle,nextIntroStyle)
    .replace('./ondevice-voice-core-v06.js?v=device-v06.1','./ondevice-voice-core-v06.js?v=piper-v07.4')
    .replace('./school-notation-v3045.js?v=3.1.0-rc.5','./school-notation-v3045.js?v=piper-v07.4');write('public/index.html',html);
  const releaseVersion=JSON.parse(fs.readFileSync(path.join(root,'version.json'),'utf8')).version;
  const sw=originalSw.replace(/const CACHE="[^"]+"/,'const CACHE="kitsune-math-'+releaseVersion+'-'+revision+'"')
    .replace(/const RUNTIME_CACHE="[^"]+"/,'const RUNTIME_CACHE="kitsune-math-runtime-'+releaseVersion+'-'+revision+'"')
    .replace(old,next).replaceAll(oldAssistant,'./live-assistant-v15.js?v=piper-v07.4').replace(oldIntroStyle,nextIntroStyle)
    .replace('./ondevice-voice-core-v06.js?v=device-v06.1','./ondevice-voice-core-v06.js?v=piper-v07.4')
    .replace('./school-notation-v3045.js?v=3.1.0-rc.5','./school-notation-v3045.js?v=piper-v07.4')
    .replace(/const CORE_ASSETS=(\[[\s\S]*?\]);/,(_,raw)=>'const CORE_ASSETS='+JSON.stringify([...new Set([...JSON.parse(raw),'./piper-voice-core-v07.js','./piper-voice-worker-v07.js','./kitsune-reading-core-v074.js?v=reading-v074.1','./kitsune-reader-v074.js?v=reading-v074.1','./kitsune-reader-v074.css?v=reading-v074.1'])],null,2)+';');
  write('public/sw.js',sw);
  const version=JSON.parse(fs.readFileSync(path.join(root,'version.json'),'utf8'));
  version.build_revision=revision;version.voice_engine='kitsune-piper-v07';version.ondevice_generation=manifest.status;write('public/version.json',JSON.stringify(version,null,2)+'\n');
  console.log(JSON.stringify({destination,build:revision,status:manifest.status,approved_voice:true,production_modified:false}));return {destination,manifest};
}
module.exports={prepare};
if(require.main===module){const [result,phonemes,destination]=process.argv.slice(2);assert(result&&phonemes&&destination,'Укажите результат обучения, phonemes.json и новый каталог копии');prepare({result,phonemes,destination});}
