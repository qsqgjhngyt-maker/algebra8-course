/* Чтение с закладкой на границе фразы. Утверждённые WAV и генератор прежние. */
(() => {
  'use strict';
  function create({speak,stopVoice,changed=()=>{},save=()=>{},load=()=>null,setTimer=setTimeout,clearTimer=clearTimeout}){
    let session=null,run=0,timer=null,starting=false;
    const snapshot=()=>session?{key:session.key,title:session.title,index:session.index,total:session.plan.length,
      phase:session.phase,message:session.message||'',reader:session.reader}:null;
    const notify=()=>changed(snapshot());
    const cancelTimer=()=>{clearTimer(timer);timer=null;};
    const bookmark=()=>{if(session)save(session.key,{index:session.index,total:session.plan.length});};
    function pause({stop=true}={}){
      if(!session||!['reading','waiting'].includes(session.phase))return false;
      run++;cancelTimer();session.phase='paused';bookmark();notify();
      if(stop)stopVoice();return true;
    }
    function begin(){
      if(!session||session.index>=session.plan.length)return;
      const s=session,id=++run,item=s.plan[s.index];let finished=false;
      s.phase='reading';s.message='';notify();
      const fail=message=>{
        if(finished||id!==run||session!==s)return;
        finished=true;run++;cancelTimer();s.phase='error';s.message=String(message||'Не удалось прочитать фразу.');
        bookmark();notify();
      };
      const done=()=>{
        if(finished||id!==run||session!==s)return;
        finished=true;s.index++;bookmark();
        if(s.index===s.plan.length){s.phase='completed';notify();return;}
        s.phase='waiting';notify();
        timer=setTimer(()=>{timer=null;if(id===run&&session===s)begin();},item.pause_after_ms||0);
      };
      starting=true;
      try{if(!speak(item.text,{force:true,state:'explain',readingOwner:s,onDone:done,onError:fail})&&!finished)fail('Включи голос Китсуне и сохрани генератор в настройках.');}
      catch(error){fail(error?.message||error);}
      finally{starting=false;}
    }
    function start({key,title='Чтение Китсуне',plan,reader=false,restart=false}){
      if(!Array.isArray(plan)||!plan.length||plan.some(p=>typeof p.text!=='string'||!p.text.trim()))throw Error('Добавь текст для чтения.');
      pause();run++;cancelTimer();
      const b=restart?null:load(key),index=b?.total===plan.length&&Number.isInteger(b.index)&&b.index>=0&&b.index<plan.length?b.index:0;
      session={key,title,plan:plan.map(p=>({...p})),reader,index,phase:'paused',message:''};bookmark();begin();return true;
    }
    function resume(){
      if(!session||!['paused','error'].includes(session.phase))return false;
      begin();return true;
    }
    function restart(){
      if(!session)return false;
      pause();run++;cancelTimer();session.index=0;bookmark();begin();return true;
    }
    function finish(){
      if(!session)return;
      run++;cancelTimer();bookmark();session.phase='idle';notify();stopVoice();
    }
    function requested(owner){
      if(session&&owner!==session)pause();
    }
    function stopped(){
      if(!starting)pause({stop:false});
    }
    return {start,pause,resume,restart,finish,requested,stopped,snapshot,
      isBusy:()=>!!session&&['reading','waiting','paused'].includes(session.phase)};
  }
  const api={create};globalThis.KitsuneReadingCore=api;if(typeof module!=='undefined')module.exports=api;
})();
