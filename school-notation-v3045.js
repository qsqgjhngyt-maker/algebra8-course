(() => {
  "use strict";
  const VERSION="3.0.0-alpha.4.5.1";
  const SUP={"-":"⁻","−":"⁻","+":"⁺","0":"⁰","1":"¹","2":"²","3":"³","4":"⁴","5":"⁵","6":"⁶","7":"⁷","8":"⁸","9":"⁹","n":"ⁿ","m":"ᵐ"};
  const MATH_END="0-9A-Za-zА-Яа-яЁё)\\]²³⁴⁵⁶⁷⁸⁹⁰ⁿᵐ";
  const MATH_START="0-9A-Za-zА-Яа-яЁё(\\[";

  function sup(v){return String(v??"").split("").map(ch=>SUP[ch]||ch).join("")}
  function decode(v){
    return String(v??"")
      .replace(/&nbsp;/gi," ").replace(/&lt;/gi,"<").replace(/&gt;/gi,">")
      .replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/&amp;/gi,"&");
  }
  function stripMarkup(v){
    return decode(v)
      .replace(/<sup>\s*([^<]+?)\s*<\/sup>/gi,(_,x)=>sup(x))
      .replace(/<br\s*\/?>/gi," ")
      .replace(/<\/?(?:span|b|strong|em|i|u|small)(?:\s[^>]*)?>/gi,"");
  }
  function textbook(v){
    let s=stripMarkup(v);
    const prose=[];
    s=s.replace(/\b\d+\.\d+\.\d+(?:-[A-Za-z0-9.]+)?\b|[A-Za-zА-Яа-яЁё]{2,}-[A-Za-zА-Яа-яЁё]{2,}/g,x=>{prose.push(x);return `\uE000${prose.length-1}\uE001`});

    s=s.replace(/\\cdot\b/g,"·").replace(/\\times\b/g,"·").replace(/\\div\b/g,":")
       .replace(/\u00F7/g,":").replace(/\u00D7/g,"·")
       .replace(/!=/g,"≠").replace(/<=/g,"≤").replace(/>=/g,"≥");

    s=s.replace(/\^(-?\d+)/g,(_,x)=>sup(x)).replace(/\^([nm])/g,(_,x)=>sup(x));

    s=s.replace(new RegExp(`([${MATH_END}])\\s*\\*\\s*(?=[${MATH_START}])`,"g"),"$1 · ");

    s=s.replace(/\b(\d{4})\s*-\s*(\d{4})\b/g,"$1–$2")
       .replace(/\b([5-9])\s*-\s*(1[01])(?=\s*(?:класс|классы|класса))/gi,"$1–$2");

    s=s.replace(/(^|[\s(=<>:+·])-(?=[0-9A-Za-z(])/g,"$1−");
    s=s.replace(new RegExp(`([${MATH_END}])\\s*[-−]\\s*(?=[${MATH_START}])`,"g"),"$1 − ");

    s=s.replace(new RegExp(`([${MATH_END}])\\s*\\+\\s*(?=[${MATH_START}])`,"g"),"$1 + ")
       .replace(new RegExp(`([${MATH_END}])\\s*·\\s*(?=[${MATH_START}])`,"g"),"$1 · ")
       .replace(new RegExp(`([${MATH_END}])\\s*:\\s*(?=[${MATH_START}])`,"g"),"$1 : ")
       .replace(/\s*(≤|≥|≠|=|>|<)\s*/g," $1 ");

    // Русская десятичная запятая; версии 3.0.0 не трогаем.
    s=s.replace(/(?<![\d.])(\d+)\.(\d+)(?![\d.])/g,"$1,$2");

    s=s.replace(/\*\*([^*]+)\*\*/g,"$1");
    s=s.replace(/[ \t]+/g," ").replace(/\(\s+/g,"(").replace(/\s+\)/g,")")
       .replace(/\s+([,.;!?])/g,"$1")
       .replace(/([A-Za-zА-Яа-яЁё]{2,})\s+:/g,"$1:").trim();
    return s.replace(/\uE000(\d+)\uE001/g,(_,i)=>prose[Number(i)]);
  }
  function html(v){
    return textbook(v).replace(/[&<>"]/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[ch]));
  }
  function speech(v){
    let s=textbook(window.KitsuneDeviceCore?.speechText?.(v)??v);
    s=s.replace(/([−]?(?:\d+[A-Za-zА-Яа-яЁё]*|[A-Za-zА-Яа-яЁё]+|\([^()]{1,40}\)))\s*\/\s*([−]?(?:\d+[A-Za-zА-Яа-яЁё]*|[A-Za-zА-Яа-яЁё]+|\([^()]{1,40}\)))/g,(_,n,d)=>/^[−]?\d+$/.test(n)&&/^\d+$/.test(d)?(window.KitsuneDeviceCore?.fraction?.(n,d)??`${n} разделить на ${d}`):`${n} разделить на ${d}`);
    s=s.replace(/\s*·\s*/g," умножить на ").replace(/\s+:\s+/g," разделить на ")
       .replace(/\s*=\s*/g," равно ").replace(/\s*≠\s*/g," не равно ")
       .replace(/\s*≥\s*/g," больше или равно ").replace(/\s*≤\s*/g," меньше или равно ")
       .replace(/\s*>\s*/g," больше ").replace(/\s*<\s*/g," меньше ");
    return s.replace(/[ \t]+/g," ").replace(/ *\n */g,"\n").trim();
  }
  // Читаем структуру математической записи, а не вертикальное расположение
  // числителя и знаменателя в innerText. Исходные узлы не изменяются.
  function elementText(root){
    function walk(node){
      if(node.nodeType===3)return node.nodeValue||'';
      if(node.nodeType!==1)return '';
      if(node.getAttribute?.('aria-hidden')==='true'||node.hasAttribute?.('hidden')||/^(SCRIPT|STYLE)$/.test(node.tagName))return '';
      if(node.classList?.contains('school-frac')){
        const n=node.querySelector('.school-frac-num'),d=node.querySelector('.school-frac-den');
        if(n&&d)return ' '+(window.KitsuneDeviceCore?.fraction?.(walk(n).trim(),walk(d).trim())??`${n.textContent} / ${d.textContent}`)+' ';
      }
      const text=Array.from(node.childNodes||[],walk).join('');
      if(node.tagName==='SUP')return sup(text);
      if(node.tagName==='BR')return '\n';
      return /^(P|DIV|SECTION|ARTICLE|H[1-6]|LI|UL|OL)$/.test(node.tagName)?'\n'+text+'\n':text;
    }
    return walk(root).replace(/[ \t]+/g,' ').replace(/ *\n */g,'\n').replace(/\n{3,}/g,'\n\n').trim();
  }
  window.KitsuneSchoolNotation={version:VERSION,text:textbook,textbook,html,speech,sup,elementText};
})();
