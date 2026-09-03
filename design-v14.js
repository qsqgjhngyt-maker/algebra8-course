
/* =====================================================================
   v1.4.0 · ПЕРЕКЛЮЧАЕМЫЙ ДИЗАЙН
   playful — основной игровой учебный стиль
   classic — исходный утверждённый интерфейс
   ===================================================================== */
const v14DesignKey="a8_design_mode";
const v14DesignBtn=document.querySelector("#designBtn");

function v14GetDesign(){
  const x=document.documentElement.dataset.design;
  return x==="classic"?"classic":"playful";
}
function v14ThemeColor(){
  const meta=document.querySelector('meta[name="theme-color"]');
  if(!meta)return;
  const dark=document.body.classList.contains("dark");
  if(v14GetDesign()==="playful")meta.content=dark?"#202326":"#49b447";
  else meta.content=dark?"#09111f":"#2563eb";
}
function v14ApplyDesign(mode,save=true){
  mode=mode==="classic"?"classic":"playful";
  document.documentElement.dataset.design=mode;
  if(save){
    try{localStorage.setItem(v14DesignKey,mode)}catch(e){}
  }
  if(v14DesignBtn){
    if(mode==="playful"){
      v14DesignBtn.innerHTML=`<span class="v141-game-icon" aria-hidden="true">🎮</span><span> Дизайн: игровой</span>
        <i class="v141-particle"></i><i class="v141-particle"></i><i class="v141-particle"></i>
        <i class="v141-particle"></i><i class="v141-particle"></i><i class="v141-particle"></i>`;
      v14DesignBtn.title="Переключить на первоначальный классический дизайн";
      v14DesignBtn.setAttribute("aria-label","Сейчас игровой дизайн. Переключить на классический.");
    }else{
      v14DesignBtn.innerHTML=`<span aria-hidden="true">✨</span><span> Дизайн: классический</span>`;
      v14DesignBtn.title="Переключить на игровой дизайн";
      v14DesignBtn.setAttribute("aria-label","Сейчас классический дизайн. Переключить на игровой.");
    }
  }
  const effects=document.querySelector("#effectsBtn");
  if(effects){
    if(mode==="playful"){
      effects.disabled=true;
      effects.textContent="✨ Эффекты: в классическом";
      effects.title="Фоновые эффекты доступны в классическом дизайне";
    }else{
      effects.disabled=false;
      effects.title="Настроить интенсивность фоновых эффектов";
      if(typeof applyEffectsMode==="function")applyEffectsMode();
    }
  }
  v14ThemeColor();

  /* Canvas остаётся на месте, но в игровом режиме скрыт CSS.
     При возврате в классику эффекты продолжают работать с прежними настройками. */
  window.dispatchEvent(new Event("resize"));
}

if(v14DesignBtn){
  v14DesignBtn.addEventListener("click",()=>{
    const next=v14GetDesign()==="playful"?"classic":"playful";
    if(v14GetDesign()==="playful"){
      v14DesignBtn.classList.remove("v141-burst");
      void v14DesignBtn.offsetWidth;
      v14DesignBtn.classList.add("v141-burst");
    }
    v14ApplyDesign(next,true);

    if(next==="playful"){
      requestAnimationFrame(()=>{
        v14DesignBtn.classList.remove("v141-celebrate","v141-burst");
        void v14DesignBtn.offsetWidth;
        v14DesignBtn.classList.add("v141-celebrate","v141-burst");
        setTimeout(()=>v14DesignBtn.classList.remove("v141-celebrate","v141-burst"),800);
      });
    }else{
      setTimeout(()=>v14DesignBtn.classList.remove("v141-burst"),800);
    }
  });
}

/* Следим за светлой/тёмной темой для правильного цвета системной панели браузера. */
const v14BodyObserver=new MutationObserver(()=>v14ThemeColor());
v14BodyObserver.observe(document.body,{attributes:true,attributeFilter:["class"]});

/* На случай недоступного localStorage оставляем игровой стиль как основной. */
let v14Initial="playful";
try{v14Initial=localStorage.getItem(v14DesignKey)||"playful"}catch(e){}
v14ApplyDesign(v14Initial,false);

/* В версии v1.4 игровой дизайн основной, но классический доступен всегда. */
const v14BaseHome=renderHome;
renderHome=function(){
  v14BaseHome();
  document.querySelectorAll(".status-chip").forEach(x=>{
    if(x.textContent.includes("v1.3"))x.textContent=x.textContent.replace("v1.3","v1.11.5"); else if(/все главы готовы · v1\.4(?:\.2)?/.test(x.textContent))x.textContent="все главы готовы · v1.11.5";
  });
};
window.renderHome=renderHome;

renderHome();
