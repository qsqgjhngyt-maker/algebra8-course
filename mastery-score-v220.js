
/* =====================================================================
   Kitsune Mastery Score v2.2.3
   Local confidence score for all 51 topics.
   ===================================================================== */
(() => {
  "use strict";

  const VERSION=window.KITSUNE_APP_VERSION||"2.2.3";
  const SKILL_KEY="a8_mathlab_skills_v130";
  const ERR_KEY="a8_learning_errors_v150";
  const REVIEW_KEY="a8_learning_reviews_v150";
  const HINT_KEY="a8_mastery_hints_v220";

  function read(key,fallback){
    try{
      const v=JSON.parse(localStorage.getItem(key)||"null");
      return v??fallback;
    }catch(e){return fallback}
  }
  function topics(){
    try{
      if(typeof chapters!=="undefined"&&Array.isArray(chapters)){
        return chapters.flatMap(ch=>ch.topics.map(t=>({
          id:t.id,title:t.title,chapter:ch.id,chapterTitle:ch.title
        })));
      }
    }catch(e){}
    return [];
  }
  function clamp(n,a=0,b=100){return Math.max(a,Math.min(b,Number(n)||0))}
  function scoreTopic(topicId){
    const skills=read(SKILL_KEY,{});
    const errors=read(ERR_KEY,[]);
    const reviews=read(REVIEW_KEY,{});
    const s=skills[`topic:${topicId}`]||{attempts:0,success:0,last:0};
    const attempts=Number(s.attempts||0);
    const success=Number(s.success||0);
    const accuracy=attempts?success/attempts:0;
    const days=s.last?Math.max(0,(Date.now()-Number(s.last))/86400000):999;
    const openErrors=Array.isArray(errors)?errors.filter(e=>e.topicId===topicId&&!e.resolved).length:0;
    const hints=read(HINT_KEY,{});
    const hintRow=hints?.[topicId]||{uses:0,maxLevel:0};
    const hintUses=Number(hintRow.uses||0);
    const maxHintLevel=Number(hintRow.maxLevel||0);
    const review=reviews?.[topicId]||null;
    const stage=Number(review?.stage||0);
    const due=review&&Number(review.due||0)<=Date.now();

    if(!attempts){
      return {
        topicId,score:0,attempts:0,success:0,accuracy:null,
        confidence:0,openErrors,stage,due,last:0,hintUses,maxHintLevel,status:"new",label:"Ещё не изучено"
      };
    }

    const accuracyPts=accuracy*55;
    const practicePts=Math.min(20,Math.log2(attempts+1)*5.2);
    const recencyPts=days<=1?15:days<=3?13:days<=7?10:days<=14?7:days<=30?4:1;
    const stabilityPts=Math.min(10,stage*2.5)+(openErrors===0?2:0);
    const hintRatio=attempts?hintUses/attempts:0;
    const hintPenalty=Math.min(12,hintRatio*6+Math.max(0,maxHintLevel-1)*1.5);
    const penalty=Math.min(22,openErrors*7)+(due?5:0)+hintPenalty;
    const score=Math.round(clamp(accuracyPts+practicePts+recencyPts+stabilityPts-penalty));
    const confidence=Math.round(clamp((Math.min(1,attempts/8)*65)+(Math.min(1,stage/4)*20)+(days<=14?15:5)));

    let status="learning",label="Изучаем";
    if(score>=85&&confidence>=65){status="mastered";label="Закреплено"}
    else if(score>=70){status="strong";label="Хорошо получается"}
    else if(score>=50){status="developing";label="Нужно закрепить"}
    else {status="weak";label="Нужно повторить"}

    return {
      topicId,score,attempts,success,
      accuracy:Math.round(accuracy*100),confidence,
      openErrors,stage,due,last:Number(s.last||0),hintUses,maxHintLevel,status,label
    };
  }

  function all(){
    return topics().map(t=>({...t,...scoreTopic(t.id)}));
  }
  function summary(){
    const rows=all();
    const practiced=rows.filter(x=>x.attempts>0);
    const mastered=rows.filter(x=>x.status==="mastered");
    const strong=rows.filter(x=>x.status==="strong");
    const needs=rows.filter(x=>["weak","developing"].includes(x.status)&&x.attempts>0);
    const avg=practiced.length?Math.round(practiced.reduce((a,x)=>a+x.score,0)/practiced.length):0;
    return {
      total:rows.length,
      practiced:practiced.length,
      mastered:mastered.length,
      strong:strong.length,
      needs:needs.length,
      average:avg,
      rows
    };
  }
  function weakest(limit=8){
    return all().filter(x=>x.attempts>0).sort((a,b)=>a.score-b.score||b.openErrors-a.openErrors).slice(0,limit);
  }
  function strongest(limit=8){
    return all().filter(x=>x.attempts>0).sort((a,b)=>b.score-a.score||b.confidence-a.confidence).slice(0,limit);
  }

  function recordHint(topicId,level=1){
    if(!topicId)return;
    const data=read(HINT_KEY,{});
    const row=data[topicId]||{uses:0,maxLevel:0,last:0};
    row.uses=Number(row.uses||0)+1;
    row.maxLevel=Math.max(Number(row.maxLevel||0),Number(level)||1);
    row.last=Date.now();
    data[topicId]=row;
    try{localStorage.setItem(HINT_KEY,JSON.stringify(data))}catch(e){}
  }

  window.KitsuneMastery={
    version:VERSION,
    topic:scoreTopic,
    all,
    summary,
    weakest,
    strongest,
    recordHint
  };
})();
