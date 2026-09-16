(() => {
  "use strict";
  const VERSION="3.0.0-alpha.4.5.1";
  const N=window.KitsuneSchoolNotation;
  if(!N)return;

  const SKIP_SELECTOR=["script","style","textarea","input","select","option","code","pre","svg",".school-frac",".katex",".MathJax",".version",".status-chip","[contenteditable='true']"].join(",");
  const ATOM=String.raw`(?:−?(?:\d+[A-Za-zА-Яа-яЁё²³⁴⁵⁶⁷⁸⁹⁰ⁿᵐ]*|[A-Za-zА-Яа-яЁё][A-Za-zА-Яа-яЁё0-9²³⁴⁵⁶⁷⁸⁹⁰ⁿᵐ]*|\([^()]{1,40}\)))`;
  const FRAC_RE=new RegExp(`(${ATOM})\\s*\\/\\s*(${ATOM})`,"g");

  function shouldSkip(node){
    const p=node?.parentElement;
    if(!p)return true;
    if(p.closest(SKIP_SELECTOR))return true;
    if(p.closest("a[href]") && /https?:|www\.|\.ru\b|\.com\b/i.test(node.nodeValue||""))return true;
    return false;
  }
  function makeFrac(num,den){
    const f=document.createElement("span");
    f.className="school-frac";
    f.setAttribute("aria-label",`${num} разделить на ${den}`);
    const n=document.createElement("span"); n.className="school-frac-num"; n.textContent=num;
    const d=document.createElement("span"); d.className="school-frac-den"; d.textContent=den;
    f.append(n,d);
    return f;
  }
  function replaceFractions(node,text){
    FRAC_RE.lastIndex=0;
    let m,last=0,found=false;
    const frag=document.createDocumentFragment();
    while((m=FRAC_RE.exec(text))){
      const before=m.index>0?text[m.index-1]:"";
      const after=text[m.index+m[0].length]||"";
      if(before==="/"||after==="/")continue; // дата 13/09/2026
      if([m[1],m[2]].some(s=>/^[A-Za-zА-Яа-яЁё]{2,}$/.test(s)))continue; // ОГЭ/ЕГЭ, AI/Voice — слова, не переменные.
      found=true;
      if(m.index>last)frag.append(document.createTextNode(text.slice(last,m.index)));
      frag.append(makeFrac(m[1],m[2]));
      last=m.index+m[0].length;
    }
    if(!found)return false;
    if(last<text.length)frag.append(document.createTextNode(text.slice(last)));
    node.replaceWith(frag);
    return true;
  }
  function formatTextNode(node){
    if(shouldSkip(node))return;
    const raw=node.nodeValue;
    if(!raw||!raw.trim())return;
    const normalized=N.textbook(raw);
    if(!normalized)return;
    const lead=/^\s/.test(raw)?" ":"";
    const tail=/\s$/.test(raw)?" ":"";
    const text=lead+normalized+tail;
    if(replaceFractions(node,text))return;
    if(text!==raw)node.nodeValue=text;
  }
  function apply(root){
    root=root||document.querySelector("#content")||document.body;
    if(!root||root.nodeType!==1)return;
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
    const nodes=[];
    while(walker.nextNode())nodes.push(walker.currentNode);
    nodes.forEach(formatTextNode);
  }
  let scheduled=0;
  function schedule(delay=0){
    clearTimeout(scheduled);
    scheduled=setTimeout(()=>requestAnimationFrame(()=>apply(document.querySelector("#content")||document.body)),delay);
  }
  function wrapGlobal(name){
    const fn=window[name];
    if(typeof fn!=="function"||fn.__schoolWrapped)return;
    const wrapped=function(...args){
      const out=fn.apply(this,args);
      schedule(0);schedule(80);
      return out;
    };
    wrapped.__schoolWrapped=true;
    window[name]=wrapped;
  }
  function wrapPlatform(){
    const p=window.KitsunePlatform;
    if(!p)return;
    ["showChooser","renderTrackHome","renderTrack","renderTopic"].forEach(name=>{
      const fn=p[name];
      if(typeof fn!=="function"||fn.__schoolWrapped)return;
      const wrapped=function(...args){
        const out=fn.apply(this,args);
        schedule(0);schedule(80);
        return out;
      };
      wrapped.__schoolWrapped=true;
      p[name]=wrapped;
    });
  }
  function install(){
    ["openLesson","renderHome","renderCourse","renderTrainer","renderProgress","renderMistakes","renderMastery","v1RenderChapterFinal"].forEach(wrapGlobal);
    wrapPlatform();
    schedule(0);schedule(120);
  }

  // MutationObserver намеренно НЕ используется: сохраняем стабильность iPhone/WebKit.
  document.addEventListener("click",()=>{schedule(0);schedule(90)},true);
  document.addEventListener("keydown",e=>{if(e.key==="Enter"){schedule(0);schedule(90)}},true);

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",install,{once:true}); else install();
  setTimeout(install,180);
  setTimeout(install,600);
  window.KitsuneSchoolTypography={version:VERSION,apply,schedule};
})();
