'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const {prepare,publish,BRANCH}=require('../tools/curriculum/publish-report.cjs');
function fixture(){
  const tempBase=path.resolve(__dirname,'../.curriculum-report/test-work');fs.mkdirSync(tempBase,{recursive:true});
  const dir=fs.mkdtempSync(path.join(tempBase,'kitsune-curriculum-report-')),origin=path.join(dir,'origin.git'),root=path.join(dir,'source');
  const env={...process.env,GIT_AUTHOR_NAME:'Kitsune Test',GIT_AUTHOR_EMAIL:'test@example.invalid',GIT_COMMITTER_NAME:'Kitsune Test',GIT_COMMITTER_EMAIL:'test@example.invalid'};
  const git=(args,cwd=root,options={})=>execFileSync('git',args,{cwd,env,encoding:'utf8',stdio:['pipe','pipe','pipe'],...options}).trim();
  fs.mkdirSync(root);git(['init','--bare',origin]);git(['init','-b','main']);
  fs.writeFileSync(path.join(root,'source.txt'),'Исходники и результаты не менять.\n');
  git(['add','source.txt']);git(['commit','-m','Тестовая база']);git(['remote','add','origin',origin]);
  const before=git(['rev-parse','HEAD']);
  // На Windows имитируем только транспорт, которому нужен недоступный MSYS.
  // Объекты, деревья, коммиты, индексы и проверки истории выполняет настоящий Git.
  // В GitHub Actions/Linux проверяются и реальные push/fetch в тестовую bare-копию.
  const copyObjects=(from,to)=>{
    fs.mkdirSync(to,{recursive:true});
    for(const entry of fs.readdirSync(from,{withFileTypes:true})){
      const source=path.join(from,entry.name),target=path.join(to,entry.name);
      if(entry.isDirectory())copyObjects(source,target);else if(!fs.existsSync(target))fs.copyFileSync(source,target);
    }
  };
  if(process.platform==='win32'){
    copyObjects(path.join(root,'.git/objects'),path.join(origin,'objects'));
    git(['update-ref','refs/heads/main',before],origin);
  }else git(['push','origin','main']);
  const adapter=process.platform==='win32'?{runner(cwd,args,options={}){
    if(args[0]==='ls-remote'){
      const value=git(['for-each-ref','--format=%(objectname) %(refname)',args[3]],origin);
      if(!value){const error=Error('Нет ветки отчёта');error.status=2;throw error;}return value;
    }
    if(args[0]==='fetch'){
      copyObjects(path.join(origin,'objects'),path.join(root,'.git/objects'));
      const [from,to]=args.at(-1).split(':');git(['update-ref',to,git(['rev-parse',from],origin)]);return '';
    }
    if(args[0]==='push'){
      const [commit,ref]=args[2].split(':');assert.equal(ref,'refs/heads/'+BRANCH);assert(!args.includes('--force'));
      const previous=git(['for-each-ref','--format=%(objectname)',ref],origin);
      copyObjects(path.join(root,'.git/objects'),path.join(origin,'objects'));
      if(previous)git(['merge-base','--is-ancestor',previous,commit],origin);
      git(['update-ref',ref,commit,previous||'0'.repeat(40)],origin);return '';
    }
    return git(args,cwd,options);
  }}:{};
  const report={schema:1,mode:'github-actions-check',checkedAt:'2026-10-10T03:23:00Z',sources:{}};
  const write=()=>fs.writeFileSync(path.join(root,'.curriculum-report/curriculum-status.json'),JSON.stringify(report)+'\n');
  const cleanup=()=>{
    assert.equal(path.dirname(dir),tempBase);assert(path.basename(dir).startsWith('kitsune-curriculum-report-'));
    fs.rmSync(dir,{recursive:true,force:true});
  };
  return {root,origin,git,before,report,write,cleanup,adapter};
}
test('Первая публикация создаёт отдельную ветку отчёта без файлов приложения',()=>{
  const h=fixture();try{
    assert.deepEqual(prepare(h.root,h.adapter),{});h.write();const commit=publish(h.root,h.adapter);
    assert.equal(h.git(['rev-parse','HEAD']),h.before);assert.equal(h.git(['rev-parse','main'],h.origin),h.before);
    assert.equal(h.git(['rev-parse',BRANCH],h.origin),commit);
    assert.equal(h.git(['ls-tree','--name-only',BRANCH],h.origin),'curriculum-status.json');
    assert.equal(h.git(['rev-list','--count',BRANCH],h.origin),'1');
    assert.equal(h.git(['diff','--cached','--name-only']),'');
  }finally{h.cleanup()}
});
test('Вторая публикация сохраняет историю отчётов и чужие файлы в этой ветке',()=>{
  const h=fixture();try{
    prepare(h.root,h.adapter);h.write();const first=publish(h.root,h.adapter);
    const reportBlob=h.git(['rev-parse',first+':curriculum-status.json'],h.origin);
    const noteBlob=h.git(['hash-object','-w','--stdin'],h.origin,{input:'Сохранить примечание владельца.\n'});
    const noteTree=h.git(['mktree'],h.origin,{input:`100644 blob ${reportBlob}\tcurriculum-status.json\n100644 blob ${noteBlob}\tnote.txt\n`});
    const manual=h.git(['commit-tree',noteTree,'-p',first,'-m','Примечание владельца'],h.origin);
    h.git(['update-ref','refs/heads/'+BRANCH,manual],h.origin);
    fs.unlinkSync(path.join(h.root,'.curriculum-report/report.index'));
    const previous=prepare(h.root,h.adapter);assert.equal(previous.checkedAt,h.report.checkedAt);
    h.report.checkedAt='2026-10-11T03:23:00Z';h.write();const second=publish(h.root,h.adapter);
    assert.equal(h.git(['rev-parse',second+'^'],h.origin),manual);
    assert.equal(h.git(['show',second+':note.txt'],h.origin),'Сохранить примечание владельца.');
    assert.equal(h.git(['rev-parse','main'],h.origin),h.before);
  }finally{h.cleanup()}
});
test('Конкурирующий push не затирается и main остаётся прежней',()=>{
  const h=fixture();try{
    prepare(h.root,h.adapter);h.write();const first=publish(h.root,h.adapter);
    fs.unlinkSync(path.join(h.root,'.curriculum-report/report.index'));prepare(h.root,h.adapter);
    const tree=h.git(['rev-parse',first+'^{tree}'],h.origin);
    // Второй независимый коммит отчёта моделирует обновление между prepare/publish.
    const env={...process.env,GIT_AUTHOR_NAME:'Test',GIT_AUTHOR_EMAIL:'test@example.invalid',GIT_COMMITTER_NAME:'Test',GIT_COMMITTER_EMAIL:'test@example.invalid'};
    const competing=execFileSync('git',['commit-tree',tree,'-p',first,'-m','Конкурирующая проверка'],{cwd:h.origin,env,encoding:'utf8'}).trim();
    h.git(['update-ref','refs/heads/'+BRANCH,competing],h.origin);
    h.report.checkedAt='2026-10-11T03:23:00Z';h.write();assert.throws(()=>publish(h.root,h.adapter));
    assert.equal(h.git(['rev-parse',BRANCH],h.origin),competing);assert.equal(h.git(['rev-parse','main'],h.origin),h.before);
  }finally{h.cleanup()}
});
