/* Kitsune Math v3.1.0-alpha.7 — safe Grade 8 legacy -> v3 progress bridge.
   Keeps all a8_* keys intact. Re-runs idempotently and only imports newly observed
   legacy attempts/correct answers after the first synchronization. */
(()=>{
  'use strict';
  const V3_KEY='kitsune:v3:progress:grade8';
  const META_KEY='kitsune:v3:migration:grade8-legacy-v311';
  const parse=(key,fallback)=>{try{const raw=localStorage.getItem(key);return raw==null?fallback:JSON.parse(raw)}catch{return fallback}};
  const num=key=>{try{return Math.max(0,Number(localStorage.getItem(key)||0)||0)}catch{return 0}};
  const save=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));return true}catch{return false}};

  try{
    const theory=window.KitsuneTheoryContent||{};
    const allowed=new Set(Object.keys(theory)
      .filter(k=>/^grade8:\d+-\d+$/.test(k))
      .map(k=>k.slice('grade8:'.length)));
    if(!allowed.size)return;

    const rawV3=parse(V3_KEY,{});
    const v3={
      solved:rawV3.solved&&typeof rawV3.solved==='object'?{...rawV3.solved}:{},
      completed:Array.isArray(rawV3.completed)?[...rawV3.completed]:[],
      mistakes:Array.isArray(rawV3.mistakes)?[...rawV3.mistakes]:[],
      attempts:Math.max(0,Number(rawV3.attempts||0)||0),
      correct:Math.max(0,Number(rawV3.correct||0)||0)
    };
    const meta=parse(META_KEY,{attemptsSeen:0,correctSeen:0});
    const legacyCompleted=parse('a8_completed',[]);
    const legacySolved=parse('a8_solved',{});
    const legacyMistakes=parse('a8_mistakes',[]);
    const legacyAttempts=num('a8_attempts');
    const legacyCorrect=num('a8_correct');

    const completed=new Set(v3.completed);
    if(Array.isArray(legacyCompleted))for(const id of legacyCompleted){if(allowed.has(id))completed.add(id)}
    v3.completed=[...completed];

    if(legacySolved&&typeof legacySolved==='object'){
      for(const [oldKey,value] of Object.entries(legacySolved)){
        if(!value)continue;
        const m=oldKey.match(/^([1-6]-\d+)-(challenge|\d+)$/);
        if(!m||!allowed.has(m[1]))continue;
        v3.solved[`v3-grade8-${m[1]}-${m[2]}`]=true;
      }
    }

    const prevAttempts=Math.max(0,Number(meta.attemptsSeen||0)||0);
    const prevCorrect=Math.max(0,Number(meta.correctSeen||0)||0);
    if(legacyAttempts>prevAttempts)v3.attempts+=legacyAttempts-prevAttempts;
    if(legacyCorrect>prevCorrect)v3.correct+=legacyCorrect-prevCorrect;

    const seen=new Set(v3.mistakes.map(m=>`${m.lesson}|${m.question}|${m.answer}|${m.ts||0}`));
    if(Array.isArray(legacyMistakes))for(const m of legacyMistakes){
      const id=String(m?.lesson||'');
      if(!allowed.has(id))continue;
      const converted={lesson:`v3-grade8-${id}`,question:String(m?.question||''),answer:String(m?.answer||''),ts:Number(m?.ts||0)||0};
      const sig=`${converted.lesson}|${converted.question}|${converted.answer}|${converted.ts}`;
      if(!seen.has(sig)){seen.add(sig);v3.mistakes.push(converted)}
    }
    v3.mistakes=v3.mistakes.slice(-120);

    save(V3_KEY,v3);
    save(META_KEY,{version:1,attemptsSeen:Math.max(prevAttempts,legacyAttempts),correctSeen:Math.max(prevCorrect,legacyCorrect),syncedAt:Date.now()});
  }catch(err){
    try{console.warn('[Kitsune] Grade 8 progress bridge skipped safely:',err)}catch{}
  }
})();
