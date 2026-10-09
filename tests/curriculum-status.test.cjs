'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),script=fs.readFileSync(path.join(root,'curriculum-sources-ui-v302.js'),'utf8');
const dataBox={window:{}};vm.runInNewContext(fs.readFileSync(path.join(root,'curriculum-sources-v302.js'),'utf8'),dataBox);
const data=dataBox.window.KitsuneCurriculumSources;
const STATUS_KEY='kitsune:v3:curriculum:last-status',AUTO_KEY='kitsune:v3:curriculum:auto-check';
const report=(checkedAt='2026-10-10T03:23:00Z')=>({schema:1,mode:'github-actions-check',checkedAt,successCount:5,totalCount:5,
  changedCount:0,comparableCount:5,reviewRequiredCount:0,sources:Object.fromEntries(data.sources.map(s=>[s.id,{ok:true}]))});
function harness({previous=null,auto='1',online=true,blockedStorage=false,url='https://qsqgjhngyt-maker.github.io/algebra8-course/',fetcher=async()=>report()}={}){
  let now=Date.parse('2026-10-10T06:00:00Z'),html='',visible=true;
  const stored=new Map([[AUTO_KEY,auto],['a8_completed','["1-1"]'],['kitsune-reader-v074','{"text":"Закладка"}']]);
  if(previous)stored.set(STATUS_KEY,JSON.stringify(previous));const before=new Map(stored),calls=[],handlers=new Map(),nodes=new Map();
  const element=()=>({textContent:'',isConnected:true,disabled:false,classList:{add(){},remove(){},contains(){return true}},addEventListener(name,fn){this[name]=fn}});
  const content={};Object.defineProperty(content,'innerHTML',{get:()=>html,set:value=>{
    html=value;for(const old of nodes.values())old.isConnected=false;nodes.clear();
    for(const id of ['curriculumRefreshBtn','curriculumUpdateState','curriculumAutoCheck','curriculumSourcesBack','curriculumSourcesHome'])nodes.set('#'+id,element());
  }});
  const document={baseURI:url,readyState:'loading',body:{classList:{remove(){}}},addEventListener(name,fn){handlers.set('document:'+name,fn)},querySelectorAll(){return []},
    querySelector(selector){if(selector==='#content')return content;if(selector==='.source-update-center')return visible&&html?content:null;
      if(selector==='#curriculumSourcesBtn'||selector==='#pageTitle'||selector==='#sidebar')return element();return visible?nodes.get(selector)||null:null;}};
  const navigator={onLine:online},window={KitsuneCurriculumSources:data,addEventListener(name,fn){handlers.set(name,fn)},scrollTo(){}};
  const localStorage={getItem(key){if(blockedStorage)throw Error('storage blocked');return stored.get(key)??null},setItem(key,value){if(blockedStorage)throw Error('storage blocked');stored.set(key,String(value))},removeItem(){throw Error('Не удалять данные')},clear(){throw Error('Не очищать данные')}};
  class ClockDate extends Date{static now(){return now}}
  const location=new URL(url);
  const box={window,document,navigator,location,localStorage,Date:ClockDate,Intl,URL,AbortController,
    setTimeout(){return 1},clearTimeout(){},fetch:async (url,options)=>{calls.push({url,options});const result=await fetcher(url,options);return {ok:true,json:async()=>result}}};
  vm.runInNewContext(script,box);window.KitsuneCurriculumSourceUI.render();
  return {api:window.KitsuneCurriculumSourceUI,stored,before,calls,html:()=>html,handlers,nodes,
    setOnline:v=>navigator.onLine=v,setVisible:v=>visible=v,advance:ms=>now+=ms};
}
test('GitHub Pages получает отчёт, а не обращается к локальному /api',async()=>{
  const h=harness();const result=await h.api.checkNow();assert.equal(result.checkedAt,'2026-10-10T03:23:00Z');
  assert.equal(h.calls.length,1);assert(h.calls[0].url.includes('/kitsune-curriculum-status/curriculum-status.json'));
  assert(!h.calls.some(c=>c.url.startsWith('/api/')));assert(!h.html().includes('START_LAN'));assert(!h.html().includes('alpha.6'));
  assert(h.html().includes('15.09.2026'));assert(h.html().includes('Официальные источники доступны'));
});
test('Автоматическое получение — не чаще раза в сутки, ручная кнопка работает независимо',async()=>{
  const h=harness();await h.handlers.get('online')();await h.handlers.get('online')();assert.equal(h.calls.length,1);
  h.advance(24*60*60*1000);await h.handlers.get('online')();assert.equal(h.calls.length,2);
  await h.api.checkNow();assert.equal(h.calls.length,3);
});
test('Выключенная автопроверка не запускает сеть, ручное получение остаётся доступным',async()=>{
  const h=harness({auto:'0'});await h.handlers.get('online')();assert.equal(h.calls.length,0);
  await h.api.checkNow();assert.equal(h.calls.length,1);assert.equal(h.stored.get(AUTO_KEY),'0');
});
test('Повторный запуск использует сохранённое ограничение частоты',async()=>{
  const h=harness();h.stored.set('kitsune:v3:curriculum:last-report-attempt',String(Date.parse('2026-10-10T05:59:00Z')));
  await h.handlers.get('online')();assert.equal(h.calls.length,0);
});
test('Офлайн сохраняются отчёт, прогресс и закладки; дата не заменяется временем открытия',async()=>{
  const previous=report('2026-10-09T03:23:00Z'),h=harness({previous,online:false});await h.api.checkNow();
  assert.equal(h.calls.length,0);assert.equal(h.stored.get(STATUS_KEY),JSON.stringify(previous));
  assert(h.html().includes('Сейчас нет сети'));for(const [key,value] of h.before)assert.equal(h.stored.get(key),value);
});
test('Ошибки загрузки и некорректный отчёт не стирают сохранённую дату',async()=>{
  const previous=report('2026-10-09T03:23:00Z');
  for(const fetcher of [async()=>{throw Error('network')},async()=>({...report(),successCount:999})]){
    const h=harness({previous,fetcher});await h.api.checkNow();assert.equal(h.stored.get(STATUS_KEY),JSON.stringify(previous));
    assert(h.html().includes('Не удалось получить свежие результаты'));assert(!h.html().includes('START_LAN'));
  }
});
test('Первый ещё не сформированный отчёт не выдаётся за проверенную нормативную базу',async()=>{
  const pending=JSON.parse(fs.readFileSync(path.join(root,'curriculum-status.json'),'utf8'));
  const h=harness({fetcher:async()=>pending});await h.api.checkNow();assert(h.html().includes('ещё не выполнена'));
  assert(!h.stored.has(STATUS_KEY));assert(!h.html().includes('✓ Официальные источники доступны'));
});
test('Старый отчёт из сборки не заменяет более свежий сохранённый отчёт',async()=>{
  const previous=report(),h=harness({previous,fetcher:async url=>{if(url.includes('raw.githubusercontent'))throw Error('unavailable');return report('2026-10-09T03:23:00Z')}});
  await h.api.checkNow();assert.equal(h.stored.get(STATUS_KEY),JSON.stringify(previous));
  assert(h.calls.some(c=>c.url.startsWith('https://qsqgjhngyt-maker.github.io/algebra8-course/curriculum-status.json?')));
});
test('Параллельные нажатия используют одну загрузку отчёта',async()=>{
  let finish;const h=harness({fetcher:()=>new Promise(resolve=>finish=resolve)});
  const first=h.api.checkNow(),second=h.api.checkNow();assert.equal(h.calls.length,1);finish(report());await Promise.all([first,second]);
  assert(!h.nodes.get('#curriculumRefreshBtn').disabled);
});
test('Локальный старый сервер сохраняет прямую проверку; при отсутствии API используется отчёт',async()=>{
  const h=harness({url:'http://192.168.3.10:8080/algebra8-course/',fetcher:async url=>{if(url.startsWith('/api/'))throw Error('404');return report()}});
  await h.api.checkNow();assert.equal(h.calls[0].url,'/api/curriculum-status?force=1');assert.equal(h.calls.length,2);
});
test('Если хранилище запрещено браузером, результат виден в текущем сеансе',async()=>{
  const h=harness({blockedStorage:true});await h.api.checkNow();assert(h.html().includes('Официальные источники доступны'));
  await h.handlers.get('online')();assert.equal(h.calls.length,1);
});
test('Завершение фоновой загрузки не возвращает пользователя с урока на страницу источников',async()=>{
  let finish;const h=harness({fetcher:()=>new Promise(resolve=>finish=resolve)});
  const before=h.html(),loading=h.api.checkNow();h.setVisible(false);finish(report());await loading;assert.equal(h.html(),before);
});
