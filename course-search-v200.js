
/* =====================================================================
   Kitsune Local Course Search v2.0.0
   Builds a tiny in-memory index from the already bundled course content.
   No embeddings, no network, no external search service.
   ===================================================================== */
(() => {
  "use strict";

  const VERSION=window.KITSUNE_APP_VERSION||"2.0.0";
  let index=null;
  let query="";

  function stripHtml(s){
    const d=document.createElement("div");
    d.innerHTML=String(s??"");
    return (d.textContent||"").replace(/\s+/g," ").trim();
  }
  function norm(s){
    return stripHtml(s).toLowerCase()
      .replace(/[ё]/g,"е")
      .replace(/[−–—]/g,"-")
      .replace(/[^\p{L}\p{N}√²³+\-*/=<>≤≥.,;() ]/gu," ")
      .replace(/\s+/g," ").trim();
  }
  function getTopics(){
    try{
      if(typeof chapters==="undefined"||!Array.isArray(chapters))return [];
      return chapters.flatMap(ch=>ch.topics.map(t=>({ch,t})));
    }catch(e){return []}
  }
  function buildIndex(){
    if(index)return index;
    index=getTopics().map(({ch,t})=>{
      let d={};
      try{d=(typeof lessonData!=="undefined"&&lessonData[t.id])||{}}catch(e){}
      const pieces=[
        t.id,t.title,t.desc,ch.title,
        d.lead,d.formula,d.remember,d.why,d.commonMistake,
        ...(Array.isArray(d.goals)?d.goals:[]),
        ...(Array.isArray(d.summary)?d.summary:[])
      ].filter(Boolean).map(stripHtml);
      return {
        id:t.id,title:t.title,chapterId:ch.id,chapterTitle:ch.title,
        desc:t.desc||"",text:norm(pieces.join(" "))
      };
    });
    return index;
  }
  function tokens(q){return norm(q).split(" ").filter(x=>x.length>1)}
  function search(q,limit=12){
    query=String(q||"").trim();
    const ts=tokens(query);
    if(!ts.length)return [];
    return buildIndex().map(row=>{
      let score=0;
      const title=norm(row.title),id=norm(row.id),chapter=norm(row.chapterTitle);
      for(const token of ts){
        if(id===token||id.includes(token))score+=12;
        if(title===token)score+=16;
        else if(title.includes(token))score+=9;
        if(chapter.includes(token))score+=4;
        const matches=row.text.split(token).length-1;
        score+=Math.min(7,matches);
      }
      if(ts.every(x=>row.text.includes(x)))score+=8;
      return {...row,score};
    }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id))
      .slice(0,Math.max(1,Number(limit)||12));
  }
  function esc(s){
    return String(s??"").replace(/[&<>"']/g,c=>({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
    }[c]));
  }
  function resultCard(r){
    return `<button class="ks-result" data-ks-open="${esc(r.id)}">
      <div><span class="eyebrow">§ ${esc(r.id)} · Глава ${r.chapterId}</span><h3>${esc(r.title)}</h3></div>
      <p>${esc(r.desc||r.chapterTitle)}</p>
      <span class="ks-open-arrow">Открыть →</span>
    </button>`;
  }
  function resultHtml(q){
    const rows=search(q);
    if(!String(q||"").trim()){
      return `<div class="ks-empty">🔎 Введи тему, правило или термин: «Виета», «ОДЗ», «смена знака», «стандартный вид».</div>`;
    }
    if(!rows.length)return `<div class="ks-empty">Ничего точного не нашлось. Попробуй другое слово или номер темы.</div>`;
    return `<div class="ks-count">${rows.length} наиболее подходящих тем</div>
      <div class="ks-results">${rows.map(resultCard).join("")}</div>`;
  }
  function render(){
    const content=document.querySelector("#content");if(!content)return;
    document.querySelector("#pageTitle").textContent="Поиск по курсу";
    document.querySelectorAll(".nav-btn").forEach(b=>b.classList.toggle("active",b.dataset.view==="search"));
    content.innerHTML=`
      <section class="ks-hero glass-panel reveal">
        <span class="eyebrow">Локальный индекс · 51 тема</span>
        <h2>🔎 Найти в курсе</h2>
        <p>Поиск работает только по материалам этого курса и не отправляет запросы в интернет.</p>
        <div class="ks-search-row">
          <input id="ksQuery" class="ml-input" value="${esc(query)}" placeholder="Например: теорема Виета">
          <button class="primary" id="ksSearchBtn">Найти</button>
        </div>
      </section>
      <section class="ks-body glass-panel" id="ksBody">${resultHtml(query)}</section>`;
    bind();
    setTimeout(()=>document.querySelector("#ksQuery")?.focus(),80);
  }
  function bind(){
    const run=()=>{
      query=document.querySelector("#ksQuery")?.value||"";
      const host=document.querySelector("#ksBody");
      if(host){host.innerHTML=resultHtml(query);bindResults()}
    };
    document.querySelector("#ksSearchBtn")?.addEventListener("click",run);
    document.querySelector("#ksQuery")?.addEventListener("keydown",e=>{if(e.key==="Enter")run()});
    bindResults();
  }
  function bindResults(){
    document.querySelectorAll("[data-ks-open]").forEach(b=>b.addEventListener("click",()=>{
      const id=b.dataset.ksOpen;
      try{window.openLesson?.(id)}catch(e){}
    }));
  }

  window.KitsuneCourseSearch={version:VERSION,search,buildIndex,render};
})();
