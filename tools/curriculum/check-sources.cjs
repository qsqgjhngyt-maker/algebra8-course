'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const MAX_BYTES=2_500_000;
function officialUrl(value){
  const url=new URL(value);
  if(url.protocol!=='https:'||url.username||url.password||
    !['edsoo.ru','fipi.ru'].some(host=>url.hostname===host||url.hostname.endsWith('.'+host)))
    throw new Error('Источник должен быть официальной HTTPS-страницей ЕДСОО или ФИПИ');
  return url;
}
function sourceManifest(root){
  const window={};vm.runInNewContext(fs.readFileSync(path.join(root,'curriculum-sources-v302.js'),'utf8'),{window},{timeout:1000});
  const data=window.KitsuneCurriculumSources;
  if(!Array.isArray(data?.sources)||!data.sources.length)throw new Error('Не найдены официальные источники');
  const ids=new Set();
  for(const item of data.sources){
    if(!item.id||ids.has(item.id))throw new Error('Идентификатор источника отсутствует или повторяется');
    ids.add(item.id);officialUrl(item.url);
  }
  return data;
}
function htmlText(text){
  return text.replace(/<!--[\s\S]*?-->/g,' ')
    .replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,' ')
    .replace(/<[^>]*>/g,' ').replace(/&nbsp;|&#160;/gi,' ').replace(/\s+/g,' ').trim();
}
async function checkUrl(value,{fetcher=fetch,timeoutMs=12000}={}){
  let url=officialUrl(value),response;
  const signal=AbortSignal.timeout(timeoutMs);
  for(let redirects=0;redirects<=4;redirects++){
    response=await fetcher(url.href,{redirect:'manual',signal,headers:{
      'User-Agent':'KitsuneCurriculumChecker/1.0 (+https://github.com/qsqgjhngyt-maker/algebra8-course)',
      'Accept':'text/html,application/xhtml+xml,application/pdf;q=0.9',
      'Accept-Language':'ru-RU,ru;q=0.9','Cache-Control':'no-cache'
    }});
    if([301,302,303,307,308].includes(response.status)){
      const target=response.headers.get('location');await response.body?.cancel();
      if(!target||redirects===4)throw new Error('Слишком много перенаправлений источника');
      url=officialUrl(new URL(target,url).href);continue;
    }
    break;
  }
  if(!response.ok){await response.body?.cancel();throw new Error(`HTTP ${response.status}`)}
  if(Number(response.headers.get('content-length'))>MAX_BYTES){await response.body?.cancel();throw new Error('Ответ источника превышает допустимый размер')}
  const chunks=[];let size=0;
  for await(const chunk of response.body){
    size+=chunk.length;if(size>MAX_BYTES){throw new Error('Ответ источника превышает допустимый размер')}
    chunks.push(chunk);
  }
  const raw=Buffer.concat(chunks),type=response.headers.get('content-type')||'';
  const html=/html/i.test(type),pdf=/application\/pdf/i.test(type);
  if(!html&&!pdf)throw new Error('Источник вернул неожиданный тип документа');
  const text=html?htmlText(raw.toString('utf8')):'';
  if((html&&text.length<80)||(pdf&&!raw.subarray(0,5).equals(Buffer.from('%PDF-'))))
    throw new Error('Источник вернул пустой или некорректный документ');
  if(html&&/just a moment|checking your browser|verify you are human|введите код с картинки|подтвердите,? что вы не робот/i.test(text))
    throw new Error('Источник требует ручной проверки браузера');
  return {
    ok:true,httpStatus:response.status,finalUrl:url.href,contentType:type,
    fingerprint:crypto.createHash('sha256').update(html?text:raw).digest('hex'),
    fingerprintType:html?'visible-text-sha256':'document-sha256',
    marker:{mentions2027:text.includes('2027'),mentionsProject:/проект|project/i.test(text)}
  };
}
async function collectReport({sources,previous={},courseVerifiedAt,appVersion,now=new Date().toISOString(),fetcher=fetch,timeoutMs=12000}){
  if(!Number.isFinite(Date.parse(now)))throw new Error('Некорректная дата проверки');
  const results={},urlCache=new Map();let successCount=0,changedCount=0,comparableCount=0,reviewRequiredCount=0;
  for(const source of sources){
    if(!urlCache.has(source.url)){
      try{urlCache.set(source.url,await checkUrl(source.url,{fetcher,timeoutMs}))}
      catch(error){urlCache.set(source.url,{ok:false,error:error.name==='TimeoutError'?'Источник не ответил вовремя':String(error.message).slice(0,240)})}
    }
    const result={...urlCache.get(source.url)},old=previous.sources?.[source.id]||{};
    const previousFingerprint=old.lastSuccessfulFingerprint||old.fingerprint;
    const previousType=old.lastSuccessfulFingerprintType||old.fingerprintType;
    const comparable=!!(result.ok&&previousFingerprint&&previousType===result.fingerprintType);
    const changed=!!(comparable&&result.fingerprint!==previousFingerprint);
    const lastChangedAt=changed?now:old.lastChangedAt||null;
    // Сигнал не исчезает на следующий день без содержательной сверки.
    const reviewed=lastChangedAt&&courseVerifiedAt&&Date.parse(courseVerifiedAt)>=Date.parse(lastChangedAt);
    const reviewRequired=!!((changed||old.reviewRequired||old.changedSincePreviousSuccessfulCheck)&&!reviewed);
    const item={...result,id:source.id,url:source.url,kind:source.kind,checkedAt:now,
      changedSincePreviousSuccessfulCheck:changed,reviewRequired,lastChangedAt,
      lastSuccessfulCheckAt:result.ok?now:old.lastSuccessfulCheckAt||(old.ok?previous.checkedAt:null)||null,
      lastSuccessfulFingerprint:result.ok?result.fingerprint:previousFingerprint||null,
      lastSuccessfulFingerprintType:result.ok?result.fingerprintType:previousType||null};
    if(result.ok)successCount++;if(changed)changedCount++;if(comparable)comparableCount++;if(reviewRequired)reviewRequiredCount++;
    results[source.id]=item;
  }
  return {schema:1,appVersion,checkedAt:now,mode:'github-actions-check',successCount,totalCount:sources.length,
    changedCount,comparableCount,reviewRequiredCount,allReachable:successCount===sources.length,fromCache:false,
    lastAllReachableAt:successCount===sources.length?now:previous.lastAllReachableAt||null,sources:results};
}
async function main(){
  const root=path.resolve(__dirname,'../..'),args=process.argv.slice(2);
  const value=key=>{const i=args.indexOf(key);return i<0?null:args[i+1]};
  const output=value('--output');if(!output)throw new Error('Укажите --output для сохранения настоящего отчёта');
  const previousFile=value('--previous'),previous=previousFile&&fs.existsSync(previousFile)?JSON.parse(fs.readFileSync(previousFile,'utf8')):{};
  const manifest=sourceManifest(root),version=JSON.parse(fs.readFileSync(path.join(root,'version.json'),'utf8'));
  const report=await collectReport({sources:manifest.sources,previous,courseVerifiedAt:manifest.courseVerifiedAt,appVersion:version.version});
  const filename=path.resolve(output);fs.mkdirSync(path.dirname(filename),{recursive:true});
  fs.writeFileSync(filename,JSON.stringify(report,null,2)+'\n');
  console.log(`Источники: ${report.successCount}/${report.totalCount}; новые сигналы: ${report.changedCount}; требуют сверки: ${report.reviewRequiredCount}`);
  if(!report.successCount)console.warn('Все источники временно недоступны; опубликована попытка, без отметки об успешной сверке.');
}
module.exports={officialUrl,sourceManifest,htmlText,checkUrl,collectReport};
if(require.main===module)main().catch(error=>{console.error(error.message);process.exitCode=1});
