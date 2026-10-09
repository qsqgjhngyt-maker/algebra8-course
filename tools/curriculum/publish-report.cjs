'use strict';
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const BRANCH='kitsune-curriculum-status',REMOTE_REF='refs/remotes/origin/'+BRANCH;
function git(root,args,options={}){return execFileSync('git',args,{cwd:root,encoding:'utf8',stdio:['pipe','pipe','pipe'],...options}).trim()}
function reportDirectory(root){return path.join(root,'.curriculum-report')}
function prepare(root,{runner=git}={}){
  const run=(args,options={})=>runner(root,args,options);
  const dir=reportDirectory(root);fs.mkdirSync(dir,{recursive:true});
  let parent=null;
  try{
    const remote=run(['ls-remote','--exit-code','origin','refs/heads/'+BRANCH]);
    parent=remote.split(/\s/)[0];
    run(['fetch','--no-tags','origin','refs/heads/'+BRANCH+':'+REMOTE_REF]);
    if(run(['rev-parse',REMOTE_REF])!==parent)throw new Error('Отчёт обновился во время чтения; повторите проверку');
  }catch(error){if(error.status!==2)throw error}
  const previous=parent?JSON.parse(run(['show',parent+':curriculum-status.json'])):{};
  fs.writeFileSync(path.join(dir,'previous.json'),JSON.stringify(previous,null,2)+'\n');
  fs.writeFileSync(path.join(dir,'base.json'),JSON.stringify({parent,source:run(['rev-parse','HEAD'])})+'\n');
  return previous;
}
function publish(root,{runner=git}={}){
  const run=(args,options={})=>runner(root,args,options);
  const dir=reportDirectory(root),base=JSON.parse(fs.readFileSync(path.join(dir,'base.json'),'utf8'));
  if(run(['rev-parse','HEAD'])!==base.source)throw new Error('Исходная ветка изменилась после подготовки проверки');
  const filename=path.join(dir,'curriculum-status.json'),data=JSON.parse(fs.readFileSync(filename,'utf8'));
  if(data.schema!==1||data.mode!=='github-actions-check'||!Number.isFinite(Date.parse(data.checkedAt)))
    throw new Error('Публиковать можно только сформированный отчёт о проверке');
  const index=path.join(dir,'report.index');
  if(fs.existsSync(index))throw new Error('Временный индекс уже существует; используйте свежую рабочую папку');
  const env={...process.env,GIT_INDEX_FILE:index,GIT_AUTHOR_NAME:'github-actions[bot]',GIT_COMMITTER_NAME:'github-actions[bot]',
    GIT_AUTHOR_EMAIL:'41898282+github-actions[bot]@users.noreply.github.com',GIT_COMMITTER_EMAIL:'41898282+github-actions[bot]@users.noreply.github.com'};
  const isolated=(args,options={})=>run(args,{env,...options});
  if(base.parent)isolated(['read-tree',base.parent]);else isolated(['read-tree','--empty']);
  const blob=run(['hash-object','-w',filename]);
  isolated(['update-index','--add','--cacheinfo',`100644,${blob},curriculum-status.json`]);
  const tree=isolated(['write-tree']);
  const args=['commit-tree',tree];if(base.parent)args.push('-p',base.parent);
  const commit=isolated(args,{input:`Обновить отчёт об официальных источниках: ${data.checkedAt}\n`});
  // Новый отдельный ref; HEAD, main и обычный индекс остаются прежними.
  run(['push','origin',commit+':refs/heads/'+BRANCH]);
  return commit;
}
module.exports={prepare,publish,BRANCH};
if(require.main===module){
  try{
    const root=path.resolve(__dirname,'../..'),action=process.argv[2];
    if(action==='prepare'){prepare(root);console.log('Предыдущий отчёт прочитан; основная ветка сохранена.');}
    else if(action==='publish')console.log('Опубликован отчёт: '+publish(root));
    else throw new Error('Укажите prepare или publish');
  }catch(error){console.error('Не удалось подготовить/опубликовать отчёт. Проверьте Actions и доступ к ветке отчётов.');process.exitCode=1}
}
