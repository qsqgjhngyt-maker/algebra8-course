'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {officialUrl,sourceManifest,checkUrl,collectReport}=require('../tools/curriculum/check-sources.cjs');
const root=path.resolve(__dirname,'..'),sources=sourceManifest(root).sources;
const now='2026-10-10T03:23:00Z';
const page='<!doctype html><html><body><h1>Официальные документы по математике</h1><p>'+ 'Материалы федеральной рабочей программы 2027. '.repeat(6)+'</p></body></html>';
const response=(body=page)=>new Response(body,{headers:{'content-type':'text/html;charset=utf-8'}});
const run=(extra={})=>collectReport({sources,now,appVersion:'3.1.0-rc.6',courseVerifiedAt:'2026-09-15',fetcher:async()=>response(),...extra});
test('Проверяются все пять источников; совпадающий URL запрашивается один раз',async()=>{
  const urls=[];const report=await run({fetcher:async url=>{urls.push(url);return response()}});
  assert.equal(urls.length,4);assert.equal(report.totalCount,5);assert.equal(report.successCount,5);
  assert.equal(report.checkedAt,now);assert.equal(report.changedCount,0);assert.equal(report.comparableCount,0);
  assert.equal(report.mode,'github-actions-check');assert.equal(report.sources['oge-2027'].marker.mentions2027,true);
});
test('Первая проверка создаёт базу; повторная сравнивает стабильный текст',async()=>{
  const previous=await run();const report=await run({previous,fetcher:async()=>response(page+'<script>nonce='+Math.random()+'</script>')});
  assert.equal(report.comparableCount,5);assert.equal(report.changedCount,0);assert.equal(report.reviewRequiredCount,0);
});
test('Изменение отмечается и не исчезает до содержательной сверки',async()=>{
  const initial=await run();const modified=await run({previous:initial,fetcher:async()=>response(page+'<p>Новый документ.</p>')});
  assert.equal(modified.changedCount,5);assert.equal(modified.reviewRequiredCount,5);
  const stable=await run({previous:modified,now:'2026-10-11T03:23:00Z',fetcher:async()=>response(page+'<p>Новый документ.</p>')});
  assert.equal(stable.changedCount,0);assert.equal(stable.reviewRequiredCount,5);
  const reviewed=await run({previous:stable,courseVerifiedAt:'2026-10-12T00:00:00Z',now:'2026-10-12T03:23:00Z',fetcher:async()=>response(page+'<p>Новый документ.</p>')});
  assert.equal(reviewed.reviewRequiredCount,0);
});
test('Недоступность не стирает последнюю успешную контрольную сумму',async()=>{
  const previous=await run();const failed=await run({previous,fetcher:async()=>new Response('blocked',{status:403})});
  assert.equal(failed.successCount,0);assert.equal(failed.allReachable,false);assert.equal(failed.changedCount,0);
  assert.equal(failed.sources['frp-5-9'].lastSuccessfulFingerprint,previous.sources['frp-5-9'].fingerprint);
  const changed=await run({previous:failed,fetcher:async()=>response(page+'Изменения.')});
  assert.equal(changed.changedCount,5);
});
test('Частичный отчёт не утверждает доступность всех источников',async()=>{
  const report=await run({fetcher:async url=>url.includes('fipi.ru')?new Response('offline',{status:503}):response()});
  assert.equal(report.successCount,3);assert.equal(report.allReachable,false);assert.equal(report.sources['oge-2027'].ok,false);
});
test('HTML, пустой ответ и защитная страница не выдаются за успешную проверку',async()=>{
  for(const body of ['', 'Just a moment. Checking your browser. '+'wait '.repeat(40)])
    await assert.rejects(checkUrl(sources[0].url,{fetcher:async()=>response(body)}));
  await assert.rejects(checkUrl(sources[0].url,{fetcher:async()=>new Response('{}',{headers:{'content-type':'application/json'}})}));
});
test('Внешние/локальные адреса и неожиданные перенаправления не запрашиваются',async()=>{
  for(const url of ['http://fipi.ru/','https://127.0.0.1/','https://evil.test/','https://fipi.ru.evil.test/'])assert.throws(()=>officialUrl(url));
  const urls=[];await assert.rejects(checkUrl(sources[0].url,{fetcher:async url=>{urls.push(url);return new Response(null,{status:302,headers:{location:'https://evil.test/'}})}}));
  assert.equal(urls.length,1);
});
test('Слишком большой ответ не превращается в усечённый отпечаток',async()=>{
  await assert.rejects(checkUrl(sources[0].url,{fetcher:async()=>new Response('x',{headers:{'content-type':'text/html','content-length':'2500001'}})}));
});
test('Отпечатки разных алгоритмов не сравниваются как изменение страницы',async()=>{
  const previous=await run();for(const item of Object.values(previous.sources))item.lastSuccessfulFingerprintType='etag';
  const report=await run({previous});assert.equal(report.comparableCount,0);assert.equal(report.changedCount,0);
});
