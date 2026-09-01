
/* =====================================================================
   v1.2.0 · ПЕДАГОГИЧЕСКАЯ ШЛИФОВКА
   Основа: утверждённая v1.1.0. Оболочка и UX не меняются.
   ===================================================================== */

function v12CoachHtml(id){
  const c=v12Coach[id];if(!c)return "";
  const path=(c.slow||[]).slice(0,4);
  return `<section class="v12-coach reveal">
    <div class="v12-coach-head"><div><span class="eyebrow">🧭 Учимся думать, а не запоминать</span>
    <h3>Разберём эту тему ещё понятнее</h3></div><span class="v12-release-note">v1.2 · усиленный разбор</span></div>
    <div class="v12-mental"><b>💭 Картинка в голове.</b> ${c.mental}</div>
    <div class="v12-path"><b>Короткий маршрут решения</b>
      <div class="v12-path-steps">${path.map((s,i)=>`<span class="v12-path-step">${i+1}. ${s}</span>${i<path.length-1?'<span class="v12-path-arrow">→</span>':""}`).join("")}</div>
    </div>
    <div class="v12-coach-grid">
      <details class="v12-slow"><summary>🐢 Разберём медленно — по одному шагу</summary>
        <ol>${c.slow.map(x=>`<li>${x}</li>`).join("")}</ol></details>
      <div><div class="v12-alt"><b>🔁 Другой взгляд</b>${c.alt}</div>
      <div class="v12-rescue" style="margin-top:10px"><b>🛟 Если застрял</b>${c.rescue}</div></div>
    </div>
    ${c.trap?`<div class="v12-trap" data-v12-trap="${id}">
      <b>🕵️ Поймай ошибку</b><div class="bad-line">${c.trap.wrong}</div><div>${c.trap.q}</div>
      <div class="v12-trap-options">${c.trap.options.map((o,i)=>`<button onclick="v12Trap('${id}',${i},this)">${o}</button>`).join("")}</div>
      <div class="v12-trap-feedback" id="v12tf-${id}">Найди ошибку до того, как откроешь примеры ниже.</div>
    </div>`:""}
  </section>`;
}

window.v12Trap=(id,choice,btn)=>{
  const t=v12Coach[id]?.trap;if(!t)return;
  const box=btn.closest(".v12-trap"),out=document.querySelector(`#v12tf-${id}`);
  box.querySelectorAll(".v12-trap-options button").forEach(b=>b.classList.remove("ok","no"));
  if(choice===t.correct){btn.classList.add("ok");out.innerHTML=`✅ <b>Точно.</b> ${t.explain}`}
  else{btn.classList.add("no");out.innerHTML=`🙂 Пока не эта ошибка. ${t.explain}`}
};

const v12BaseLessonHtml=lessonHtml;
lessonHtml=function(id,d){
  let out=v12BaseLessonHtml(id,d),coach=v12CoachHtml(id);
  if(!coach)return out;
  const marker='<h3 id="example">📘 Два примера по шагам</h3>';
  return out.includes(marker)?out.replace(marker,coach+marker):out;
};

const v12BaseHome=renderHome;
renderHome=function(){
  v12BaseHome();
  document.querySelectorAll(".status-chip").forEach(x=>{if(x.textContent.includes("v1.1"))x.textContent=x.textContent.replace("v1.1","v1.2")});
  const badge=content.querySelector(".v11-release-card .v11-badge");
  if(badge)badge.textContent="✨ v1.2 · усиленные объяснения сложных тем";
};window.renderHome=renderHome;

const v12BaseCourse=renderCourse;
renderCourse=function(){
  v12BaseCourse();
  document.querySelectorAll(".status-chip").forEach(x=>{if(x.textContent.includes("v1.1"))x.textContent=x.textContent.replace("v1.1","v1.2")});
};window.renderCourse=renderCourse;

renderHome();
