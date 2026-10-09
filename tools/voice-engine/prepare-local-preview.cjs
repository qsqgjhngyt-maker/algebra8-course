/* Воспроизводимая локальная копия. Закрытые сертификаты и кэши не копируются. */
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..'),destination=path.resolve(process.argv[2]||path.join(root,'.local-preview'));
const copy=(from,to)=>{fs.mkdirSync(path.dirname(to),{recursive:true});fs.copyFileSync(from,to);};
const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8'),assets=JSON.parse(sw.match(/const CORE_ASSETS=(\[[\s\S]*?\]);/)[1]);
for(const ref of [...assets,'./sw.js','./version.json']){const file=ref.split('?')[0];copy(path.join(root,file),path.join(destination,'public',file));}
for(const pack of ['pilot_v04','grade8_algebra_v05']){
 const base='assets/voice/'+pack,manifest=JSON.parse(fs.readFileSync(path.join(root,base,'manifest.json'),'utf8'));
 for(const file of ['manifest.json',...manifest.segments.map(s=>s.audio)])copy(path.join(root,base,file),path.join(destination,'public',base,file));
}
for(const file of ['server.cjs','Start_Local.ps1','START.bat','START_WITH_VOICE.bat','check.html','local-test-panel.js','README_RU.txt','HTTPS_RU.txt'])copy(path.join(__dirname,'local-preview',file),path.join(destination,file));
copy(path.join(destination,'local-test-panel.js'),path.join(destination,'public/local-test-panel.js'));
copy(path.join(root,'assets/voice/kitsune_ondevice_v06/manifest.json'),path.join(destination,'public/assets/voice/kitsune_ondevice_v06/manifest.json'));
const device=JSON.parse(fs.readFileSync(path.join(root,'assets/voice/kitsune_ondevice_v06/manifest.json'),'utf8'));
for(const record of device.files||[])copy(path.join(root,'assets/voice/kitsune_ondevice_v06',record.path),path.join(destination,'public/assets/voice/kitsune_ondevice_v06',record.path));
for(const file of ['Install_Browser_Runtime.ps1','INSTALL_GENERATOR.bat','LICENSE_ONNXRUNTIME.txt'])copy(path.join(__dirname,'device',file),path.join(destination,file));
console.log('Локальная проверка: '+path.join(destination,'START.bat'));
