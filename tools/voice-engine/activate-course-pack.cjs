/* Меняет оболочку только после успешной проверки всех учебных WAV. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..');
execFileSync(process.execPath,[path.join(__dirname,'verify-course-pack.cjs')],{stdio:'inherit'});
const read=f=>fs.readFileSync(path.join(root,f),'utf8'),write=(f,s)=>fs.writeFileSync(path.join(root,f),s);
const revision='voice-device-v06-'+crypto.createHash('sha256').update(['styles.css','static-voice-course-pack-v05.js','static-voice-v04.js','dynamic-voice-v05.js','ondevice-voice-core-v06.js','ondevice-voice-worker-v06.js','kitsune-voice-compat-v05.js','live-assistant-v15.js','kitsune-voice-v19.js','tutor-smart-v173.js','kitsune-brain-v18.js','performance-manager-v150.js','voice-conversation-v237.js','voice-stability-v2387.js','kitsune-presence-v238.js','platform-v300.js','theory-engine-v300.js','offline-center-v200.js','auto-setup-v210.js','assets/voice/kitsune_ondevice_v06/manifest.json'].map(read).join('\n')).digest('hex').slice(0,12);
let index=read('index.html'),sw=read('sw.js');
index=index.replace(/(<meta name="kitsune-app-build" content=")[^"]+/,'$1'+revision);
sw=sw.replace(/const CACHE="[^"]+"/,'const CACHE="kitsune-math-3.1.0-rc.5-'+revision+'"')
 .replace(/const RUNTIME_CACHE="[^"]+"/,'const RUNTIME_CACHE="kitsune-math-runtime-3.1.0-rc.5-'+revision+'"');
for(const f of ['static-voice-v04','live-assistant-v15','runtime-loader-v2395','voice-stability-v2387','voice-conversation-v237','offline-center-v200','auto-setup-v210']){
 const expression=new RegExp('('+f+'\\.js\\?v=)[^"\\s]+','g');
 index=index.replace(expression,'$1single-voice-v05.1');sw=sw.replace(expression,'$1single-voice-v05.1');
}
if(!index.includes('static-voice-course-pack-v05.js'))index=index.replace('  <script src="./static-voice-v04.js','  <script src="./static-voice-course-pack-v05.js?v=course-pack-v05"></script>\n  <script src="./kitsune-voice-compat-v05.js?v=single-voice-v05.1"></script>\n  <script src="./static-voice-v04.js');
if(!sw.includes('static-voice-course-pack-v05.js'))sw=sw.replace('const CORE_ASSETS=[','const CORE_ASSETS=[\n  "./static-voice-course-pack-v05.js?v=course-pack-v05",\n  "./kitsune-voice-compat-v05.js?v=single-voice-v05.1",');
write('index.html',index);write('sw.js',sw);
let loader=read('runtime-loader-v2395.js');
for(const f of ['voice-stability-v2387','voice-conversation-v237','offline-center-v200'])loader=loader.replace(new RegExp('('+f+'\\.js\\?v=)[^"\\s]+','g'),'$1single-voice-v05.1');
write('runtime-loader-v2395.js',loader);
const version=JSON.parse(read('version.json'));version.build_revision=revision;version.voice_engine='kitsune-fixed-chatterbox-v06';version.ondevice_generation=JSON.parse(read('assets/voice/kitsune_ondevice_v06/manifest.json')).status;write('version.json',JSON.stringify(version,null,2)+'\n');
execFileSync(process.execPath,[path.join(__dirname,'export-course-texts.cjs'),'--write'],{stdio:'inherit'});
console.log('Оболочка подготовлена:',revision);
