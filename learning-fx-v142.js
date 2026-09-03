
/* =====================================================================
   v1.4.2 · GAME LEARNING FX
   Реальные XP + награды за правильный ответ, урок и главу.
   Работает только при data-design="playful".
   ===================================================================== */
const v142XpKey="a8_game_xp";
const v142RewardedKey="a8_game_rewards";
const v142ReduceMotion=window.matchMedia("(prefers-reduced-motion: reduce)");

let v142Xp=0;
let v142Rewarded={};
try{
  v142Xp=Number(localStorage.getItem(v142XpKey)||0);
  v142Rewarded=JSON.parse(localStorage.getItem(v142RewardedKey)||"{}");
}catch(e){}

function v142IsPlayful(){
  return document.documentElement.dataset.design==="playful";
}
function v142SaveXp(){
  try{
    localStorage.setItem(v142XpKey,String(v142Xp));
    localStorage.setItem(v142RewardedKey,JSON.stringify(v142Rewarded));
  }catch(e){}
}
function v142EnsureXpBadge(){
  let badge=document.querySelector("#v142XpBadge");
  if(!badge){
    badge=document.createElement("span");
    badge.id="v142XpBadge";
    const actions=document.querySelector(".top-actions");
    const reset=document.querySelector("#resetBtn");
    if(actions)actions.insertBefore(badge,reset||null);
  }
  v142UpdateXpBadge();
  return badge;
}
function v142UpdateXpBadge(pop=false){
  const badge=document.querySelector("#v142XpBadge");
  if(!badge)return;
  badge.textContent=`⭐ ${v142Xp} XP`;
  if(pop&&v142IsPlayful()){
    badge.classList.remove("v142-number-pop");
    void badge.offsetWidth;
    badge.classList.add("v142-number-pop");
    setTimeout(()=>badge.classList.remove("v142-number-pop"),500);
  }
}
function v142AwardOnce(key,amount){
  if(!key||v142Rewarded[key])return 0;
  v142Rewarded[key]=true;
  v142Xp+=amount;
  v142SaveXp();
  v142UpdateXpBadge(true);
  return amount;
}
function v142RewardKey(btn,container){
  const onclick=(btn?.getAttribute("onclick")||"").replace(/\s+/g,"");
  if(onclick)return "action:"+onclick;
  const id=container?.id||container?.dataset?.ex||container?.dataset?.v12Trap||container?.dataset?.v11Visual;
  return id?"item:"+id:null;
}
function v142SuccessAmount(btn,container){
  const onclick=btn?.getAttribute("onclick")||"";
  if(/Challenge|Advanced/i.test(onclick)||container?.classList.contains("challenge-card"))return 20;
  if(btn?.classList.contains("check-btn"))return 10;
  return 5;
}
function v142ContainerSucceeded(container){
  if(!container)return false;
  if(container.querySelector(".feedback.ok,.v13-feedback.ok"))return true;
  const texts=[
    container.querySelector(".micro-result")?.textContent,
    container.querySelector(".v12-trap-feedback")?.textContent,
    container.querySelector(".v11-visual-feedback")?.textContent
  ].filter(Boolean);
  return texts.some(x=>x.trim().startsWith("✅"));
}
function v142LocalParticles(container){
  const colors=["var(--game-yellow)","var(--game-blue)","var(--primary)","#ff78b3","#7ee787","#b98cff"];
  const vectors=[[-42,-23],[40,-28],[-48,14],[47,19],[-12,-42],[14,42]];
  vectors.forEach((v,i)=>{
    const s=document.createElement("i");
    s.className="v142-local-particle";
    s.style.setProperty("--dx",v[0]+"px");
    s.style.setProperty("--dy",v[1]+"px");
    s.style.background=colors[i%colors.length];
    container.appendChild(s);
    setTimeout(()=>s.remove(),750);
  });
}
function v142PulseProgress(){
  if(!v142IsPlayful())return;
  document.querySelectorAll(".progress-bar").forEach(bar=>{
    bar.classList.remove("v142-progress-live");
    void bar.offsetWidth;
    bar.classList.add("v142-progress-live");
    setTimeout(()=>bar.classList.remove("v142-progress-live"),850);
  });
  ["#masteryPercent","#heroPercent","#doneCount"].forEach(sel=>{
    const el=document.querySelector(sel);
    if(el){
      el.classList.remove("v142-number-pop");
      void el.offsetWidth;
      el.classList.add("v142-number-pop");
      setTimeout(()=>el.classList.remove("v142-number-pop"),500);
    }
  });
}
function v142LocalSuccess(container,amount){
  if(!v142IsPlayful()||v142ReduceMotion.matches||!container)return;
  container.classList.remove("v142-answer-success");
  void container.offsetWidth;
  container.classList.add("v142-answer-success");

  if(amount>0){
    const xp=document.createElement("span");
    xp.className="v142-xp";
    xp.textContent=`+${amount} XP`;
    container.appendChild(xp);
    setTimeout(()=>xp.remove(),1250);
  }
  v142LocalParticles(container);
  v142PulseProgress();
  setTimeout(()=>container.classList.remove("v142-answer-success"),900);
}

/* Отслеживаем обычные индивидуальные проверки, но не массовую сдачу тестов. */
document.addEventListener("click",e=>{
  if(!v142IsPlayful())return;
  const btn=e.target.closest?.("button");
  if(!btn)return;
  const onclick=btn.getAttribute("onclick")||"";
  const individual=
    btn.classList.contains("check-btn") ||
    /(?:v1Quick|ch1Quick|v12Trap|v11VisualAnswer)/.test(onclick);
  if(!individual)return;

  const container=btn.closest(
    ".exercise,.v13-task,.v13-advanced-card,.v12-trap,.v11-visual-check"
  );
  if(!container)return;

  setTimeout(()=>{
    if(!v142ContainerSucceeded(container))return;
    const key=v142RewardKey(btn,container);
    const amount=v142AwardOnce(key,v142SuccessAmount(btn,container));
    /* Даже если XP уже получены, повторный правильный ответ получает только мягкий pop. */
    v142LocalSuccess(container,amount);
  },70);
});

/* -------------------- Награда за завершение урока/главы -------------------- */
function v142Confetti(layer,count,chapter){
  const palette=chapter
    ?["#ffca28","#49b447","#2499e8","#ff7ab6","#9b7bff","#ff8a4c"]
    :["#49b447","#72d365","#2499e8","#ffca28"];
  for(let i=0;i<count;i++){
    const c=document.createElement("i");
    c.className="v142-confetti";
    const angle=(Math.PI*2*i/count)+(Math.random()-.5)*.35;
    const dist=(chapter?190:130)+Math.random()*(chapter?150:85);
    const x=Math.cos(angle)*dist;
    const y=Math.sin(angle)*dist+(chapter?35:20);
    c.style.setProperty("--x",x.toFixed(0)+"px");
    c.style.setProperty("--y",y.toFixed(0)+"px");
    c.style.setProperty("--rot",`${160+Math.random()*480}deg`);
    c.style.setProperty("--dur",`${.72+Math.random()*.45}s`);
    c.style.setProperty("--delay",`${Math.random()*.12}s`);
    c.style.background=palette[i%palette.length];
    layer.appendChild(c);
  }
}
function v142Celebrate({chapter=false,title,subtitle,xp=0,icon}){
  if(!v142IsPlayful()||v142ReduceMotion.matches)return Promise.resolve();
  return new Promise(resolve=>{
    const layer=document.createElement("div");
    layer.className=`v142-celebration-layer${chapter?" chapter":""}`;
    layer.innerHTML=`<div class="v142-celebration-card">
      <div class="v142-celebration-icon">${icon||(chapter?"🏆":"⭐")}</div>
      <h3>${title}</h3><p>${subtitle}</p>
      ${xp?`<span class="v142-reward-xp">+${xp} XP</span>`:""}
    </div>`;
    document.body.appendChild(layer);
    v142Confetti(layer,chapter?28:14,chapter);
    requestAnimationFrame(()=>layer.classList.add("show"));
    setTimeout(()=>{
      layer.classList.remove("show");
      setTimeout(()=>{layer.remove();resolve()},140);
    },chapter?980:720);
  });
}
function v142ChapterFor(id){
  return chapters.find(c=>c.topics.some(t=>t.id===id));
}
function v142WouldCompleteChapter(id){
  const ch=v142ChapterFor(id);
  if(!ch)return false;
  return ch.topics.every(t=>t.id===id||state.completed.includes(t.id));
}
function v142WrapFinish(name){
  const original=window[name];
  if(typeof original!=="function"||original._v142Wrapped)return;

  const wrapped=async function(id){
    if(!v142IsPlayful()||v142ReduceMotion.matches||state.completed.includes(id)){
      return original(id);
    }
    const ch=v142ChapterFor(id);
    const chapterComplete=v142WouldCompleteChapter(id);
    let gained=v142AwardOnce(`lesson:${id}`,50);

    if(chapterComplete&&ch){
      gained+=v142AwardOnce(`chapter:${ch.id}`,150);
      const allCourse=ch.id===6&&chapters.every(c=>c.topics.every(t=>t.id===id||state.completed.includes(t.id)));
      await v142Celebrate({
        chapter:true,
        icon:allCourse?"🎓":"🏆",
        title:allCourse?"Основной курс пройден!":`Глава ${["","I","II","III","IV","V","VI"][ch.id]} завершена!`,
        subtitle:allCourse?"Все шесть основных глав позади. Можно переходить к итоговому закреплению и контрольным.":`${ch.title}: все уроки главы пройдены.`,
        xp:gained
      });
    }else{
      await v142Celebrate({
        title:"Урок завершён!",
        subtitle:"Отлично. Прогресс сохранён — двигаемся дальше.",
        xp:gained,
        icon:"⭐"
      });
    }
    v142PulseProgress();
    return original(id);
  };
  wrapped._v142Wrapped=true;
  window[name]=wrapped;
}

v142WrapFinish("v1FinishLesson");
v142WrapFinish("ch1FinishLesson");

/* После переключения дизайна XP-плашка появляется/скрывается CSS автоматически. */
v142EnsureXpBadge();

/* Если сбрасывается весь прогресс — сбрасываем и игровые XP. */
const v142Reset=document.querySelector("#resetBtn");
if(v142Reset){
  const old=v142Reset.onclick;
  v142Reset.onclick=function(e){
    /* Основной обработчик сам спрашивает confirm; здесь ничего заранее не стираем. */
    return old?.call(this,e);
  };
}
