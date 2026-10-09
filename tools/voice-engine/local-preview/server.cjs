'use strict';
// Только временная локальная копия приложения; исходный проект не изменяется.
const fs=require('node:fs'), path=require('node:path'), http=require('node:http'), https=require('node:https');
const args=Object.fromEntries(process.argv.slice(2).reduce((a,v,i,all)=>{if(v.startsWith('--'))a.push([v.slice(2),all[i+1]]);return a;},[]));
const root=fs.realpathSync(path.resolve(args.root||path.join(__dirname,'public')));
const tls=path.resolve(args['tls-dir']||path.join(__dirname,'.local-state'));
const lan=args.lan;
if(!lan||!/^\d{1,3}(\.\d{1,3}){3}$/.test(lan))throw new Error('Укажите --lan с адресом ПК в домашней сети.');
const prefix='/algebra8-course/';
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.wasm':'application/wasm','.bin':'application/octet-stream','.onnx':'application/octet-stream','.int8':'application/octet-stream','.scales':'application/octet-stream','.txt':'text/plain; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.svg':'image/svg+xml','.mp4':'video/mp4','.wav':'audio/wav','.woff2':'font/woff2','.ico':'image/x-icon'};
mime['.data']='application/octet-stream';
function plain(res,status,text){res.writeHead(status,{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'});res.end(text);}
function handler(req,res){
  let pathname;
  try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{return plain(res,400,'Неверный адрес.');}
  if(!['GET','HEAD'].includes(req.method))return plain(res,405,'Доступно только чтение.');
  if(typeof res.on==='function')res.on('finish',()=>{
    if(/\.(css|js)$/.test(pathname)||pathname.endsWith('/')||res.statusCode>=400)console.log(`${res.statusCode} ${req.method} ${JSON.stringify(pathname)}`);
  });
  if(pathname==='/'||pathname==='/algebra8-course'){res.writeHead(302,{Location:prefix,'Cache-Control':'no-store'});return res.end();}
  if(pathname==='/__kitsune/check/'||pathname==='/__kitsune/check'){
    const html=fs.readFileSync(path.join(__dirname,'check.html'));
    res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Content-Length':html.length,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
    return res.end(req.method==='HEAD'?undefined:html);
  }
  if(pathname==='/__kitsune/certificate.cer'){
    const cert=fs.readFileSync(path.join(tls,'kitsune-local-ca.cer'));
    res.writeHead(200,{'Content-Type':'application/x-x509-ca-cert','Content-Disposition':'attachment; filename="kitsune-local-ca.cer"','Content-Length':cert.length,'Cache-Control':'no-store'});
    return res.end(req.method==='HEAD'?undefined:cert);
  }
  if(pathname==='/__kitsune/status'){
    const version=JSON.parse(fs.readFileSync(path.join(root,'version.json'),'utf8'));
    const pack=version.voice_engine==='kitsune-piper-v07'?'kitsune_piper_v07':'kitsune_ondevice_v06';
    return plain(res,200,JSON.stringify({build:version.build_revision,mode:'local-test',ondeviceGeneration:JSON.parse(fs.readFileSync(path.join(root,'assets/voice',pack,'manifest.json'),'utf8')).status,https:!!req.socket.encrypted}));
  }
  if(!pathname.startsWith(prefix))return plain(res,404,'Страница не найдена.');
  const relative=pathname.slice(prefix.length)||'index.html';
  if(relative.split(/[\\/]/).some(p=>p.startsWith('.')||p==='..')||relative.includes('\0'))return plain(res,403,'Недоступный путь.');
  let file;
  try{file=fs.realpathSync(path.resolve(root,relative));}catch{return plain(res,404,'Файл не найден.');}
  if(!file.startsWith(root+path.sep)||!fs.statSync(file).isFile())return plain(res,403,'Недоступный путь.');
  const ext=path.extname(file).toLowerCase();
  if(!mime[ext])return plain(res,403,'Недоступный тип файла.');
  let size=fs.statSync(file).size,bytes;
  const headers={'Content-Type':mime[ext],'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
  // Панель существует только на этой тестовой копии. Байты файлов проекта сохранены.
  if(relative==='index.html'){
    bytes=Buffer.from(fs.readFileSync(file,'utf8').replace('</body>','<script src="./local-test-panel.js?v=2"></script>\n</body>'));
    size=bytes.length;
  }
  let start=0,end=size-1,status=200;
  if(req.headers.range&&!bytes){
    const match=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
    if(!match||(!match[1]&&!match[2])){res.writeHead(416,{'Content-Range':`bytes */${size}`});return res.end();}
    if(match[1]){start=Number(match[1]);end=match[2]?Math.min(Number(match[2]),end):end;}
    else start=Math.max(0,size-Number(match[2]));
    if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>end||start>=size){res.writeHead(416,{'Content-Range':`bytes */${size}`});return res.end();}
    status=206;headers['Content-Range']=`bytes ${start}-${end}/${size}`;
  }
  headers['Accept-Ranges']='bytes';headers['Content-Length']=end-start+1;
  if(pathname.endsWith('/sw.js'))headers['Service-Worker-Allowed']=prefix;
  res.writeHead(status,headers);
  if(req.method==='HEAD')return res.end();
  if(bytes)return res.end(bytes);
  const stream=fs.createReadStream(file,{start,end});
  stream.on('error',error=>{console.error('Ошибка чтения файла:',JSON.stringify(relative),error.message);res.destroy(error);});
  stream.pipe(res);
}
const servers=[];
async function listen(server,host,port){
  servers.push(server);
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,host,resolve);});
  console.log(`${server instanceof https.Server?'https':'http'}://${host}:${port}${prefix}`);
}
async function main(){
  const options={key:fs.readFileSync(path.join(tls,'server-key.pem')),cert:fs.readFileSync(path.join(tls,'server-chain.pem')),minVersion:'TLSv1.2'};
  for(const host of ['127.0.0.1',lan]){
    await listen(http.createServer(handler),host,8080);
    await listen(https.createServer(options,handler),host,8443);
  }
  console.log('Kitsune: локальная проверка готовых уроков. Сервер готов. Остановка: Ctrl+C.');
}
function close(){for(const server of servers)server.close();setTimeout(()=>process.exit(),500).unref();}
process.on('SIGINT',close);process.on('SIGTERM',close);
module.exports={handler};
if(require.main===module)main().catch(error=>{
  console.error('Сервер не запущен:',error.message);
  if(error.code==='EADDRINUSE')console.error('Этот порт уже занят. Закройте предыдущее окно тестового сервера и повторите запуск.');
  if(error.code==='EADDRNOTAVAIL')console.error('Адрес домашней сети изменился. Укажите текущий IPv4 ПК через -LanAddress.');
  if(error.code==='EACCES')console.error('Windows или среда запуска запретила открыть порт. Сохраните журнал для диагностики.');
  for(const s of servers)s.close();process.exitCode=1;
});
