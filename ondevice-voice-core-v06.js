/* Чистые операции автономного генератора; единая реализация для worker и тестов. */
(() => {
  'use strict';
  const stress={дроби:'дро́би',дробей:'дробе́й',числитель:'числи́тель',знаменатель:'знамена́тель',корни:'ко́рни',степени:'сте́пени',проценты:'проце́нты'};
  const ones=['ноль','один','два','три','четыре','пять','шесть','семь','восемь','девять'];
  const teens=['десять','одиннадцать','двенадцать','тринадцать','четырнадцать','пятнадцать','шестнадцать','семнадцать','восемнадцать','девятнадцать'];
  const tens=['','','двадцать','тридцать','сорок','пятьдесят','шестьдесят','семьдесят','восемьдесят','девяносто'];
  const hundreds=['','сто','двести','триста','четыреста','пятьсот','шестьсот','семьсот','восемьсот','девятьсот'];
  const letters='а|бэ|цэ|дэ|е|эф|гэ|аш|и|йот|ка|эль|эм|эн|о|пэ|ку|эр|эс|тэ|у|вэ|дубль вэ|икс|игрек|зэт'.split('|');
  const plural=(n,f)=>n%100>=11&&n%100<=14?f[2]:n%10===1?f[0]:n%10>=2&&n%10<=4?f[1]:f[2];
  function integer(n,feminine=false){
    if(n>=1e6)return String(n).split('').map(d=>ones[+d]).join(' ');
    if(!n)return ones[0];const parts=[];
    if(n>=1000){const k=Math.floor(n/1000);parts.push(integer(k,true),plural(k,['тысяча','тысячи','тысяч']));n%=1000;}
    if(n>=100){parts.push(hundreds[Math.floor(n/100)]);n%=100;}
    if(n>=10&&n<20)parts.push(teens[n-10]);
    else{if(n>=20){parts.push(tens[Math.floor(n/10)]);n%=10;}if(n)parts.push(feminine&&n===1?'одна':feminine&&n===2?'две':ones[n]);}
    return parts.join(' ');
  }
  function number(value){
    const [a,b]=value.split(/[.,]/);if(!b)return integer(+a);
    const names={1:['десятая','десятых','десятых'],2:['сотая','сотых','сотых'],3:['тысячная','тысячных','тысячных']};
    if(!names[b.length])return integer(+a)+' запятая '+b.split('').map(d=>ones[+d]).join(' ');
    return integer(+a,true)+' '+plural(+a,['целая','целых','целых'])+' и '+integer(+b,true)+' '+plural(+b,names[b.length]);
  }
  const fractionNames={2:['вторая','вторых'],3:['третья','третьих'],4:['четвёртая','четвёртых'],5:['пятая','пятых'],6:['шестая','шестых'],7:['седьмая','седьмых'],8:['восьмая','восьмых'],9:['девятая','девятых'],10:['десятая','десятых'],100:['сотая','сотых'],1000:['тысячная','тысячных']};
  function fraction(numerator,denominator){
    const n=String(numerator).trim(),d=String(denominator).trim(),names=fractionNames[+d];
    if(/^[−-]?\d+$/.test(n)&&/^\d+$/.test(d)&&names&&Math.abs(Number(n.replace('−','-')))<1e6){
      const value=Number(n.replace('−','-')),a=Math.abs(value);
      return (value<0?'минус ':'')+integer(a,true)+' '+plural(a,[names[0],names[1],names[1]]);
    }
    const unwrap=value=>{if(value[0]!=='('||value.at(-1)!==')')return value;let depth=0;for(let i=0;i<value.length;i++){if(value[i]==='(')depth++;if(value[i]===')')depth--;if(depth===0&&i<value.length-1)return value;}return depth===0?value.slice(1,-1):value;};
    return 'дробь. В числителе '+unwrap(n)+'. В знаменателе '+unwrap(d)+'.';
  }
  const superscripts={'⁰':'0','¹':'1','²':'2','³':'3','⁴':'4','⁵':'5','⁶':'6','⁷':'7','⁸':'8','⁹':'9','⁻':'-','⁺':'+','ⁿ':'n','ᵐ':'m'};
  function power(exponent){
    const ordinals=['нулевой','первой','второй','третьей','четвёртой','пятой','шестой','седьмой','восьмой','девятой','десятой','одиннадцатой','двенадцатой','тринадцатой','четырнадцатой','пятнадцатой','шестнадцатой','семнадцатой','восемнадцатой','девятнадцатой','двадцатой'];
    const value=Number(exponent);
    if(/^[+]?\d+$/.test(exponent)&&ordinals[value])return (value===2?'во ':'в ')+ordinals[value]+' степени';
    return 'в степени '+String(exponent).replace(/^[−-]/,'минус ').replace(/^\+/,'плюс ');
  }
  function speechText(text){
    const markup=/<\/[a-z][a-z0-9]*\s*>/i.test(String(text));
    let s=String(text).replace(/\r\n?/g,'\n')
      .replace(/<sup\b[^>]*>\s*([−+\-\dnm]+)\s*<\/sup>/gi,(_,exp)=>' '+power(exp))
      .replace(/<sub\b[^>]*>\s*([^<]+)\s*<\/sub>/gi,(_,index)=>' индекс '+index+' ')
      .replace(/<br\s*\/?>/gi,'\n').replace(/<\/(?:p|div|section|h[1-6]|li)>/gi,'\n\n')
      .replace(markup?/<\/?[a-z][^>]*>/gi:/$^/g,' ').replace(/&nbsp;/gi,' ')
      .replace(/(?<![\p{L}\p{N}])\*\*([^*\n]+)\*\*(?![\p{L}\p{N}])/gu,'$1');
    // Убираем только редакционные варианты окончания; математические
    // скобки, например (x + 4) и sin(a), остаются значимыми.
    s=s.replace(/ты должен\(на\) уметь/gi,'тебе нужно уметь')
      .replace(/(должен|готов|понял|уверен|был|вырос|угадал|делил|решил|сделал|ответил|запомнил)\((?:а|на|ла)\)/gi,'$1');
    const emoji=/(?:\p{Extended_Pictographic}(?:\uFE0F|\p{Emoji_Modifier})?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|\p{Emoji_Modifier})?)*|\p{Regional_Indicator}{2}|[#*0-9]\uFE0F?\u20E3)+/gu;
    s=s.replace(emoji,(icon,at,whole)=>/[а-яёa-z0-9]$/i.test(whole.slice(0,at).trimEnd())&&/^[А-ЯЁA-Z]/.test(whole.slice(at+icon.length).trimStart())?'. ':' ');
    // Это подписи разделов полной теории, а не произвольное произведение.
    const heading='(?:Смысл темы|Почему это работает|Как рассуждать|Примеры|Типичная ошибка|Прочитай и перескажи|Итог)';
    s=s.replace(new RegExp('^\\s*(\\d{1,2})[ \\t]*·[ \\t]*('+heading+')[ \\t]*$','gmi'),'Раздел $1, $2.')
      .replace(/^[ \t]*[•▪◦][ \t]*/gm,'');
    return s.replace(/[ \t]+/g,' ').replace(/[ \t]+([.!?…,:;])/g,'$1').replace(/ *\n */g,'\n').replace(/\n{3,}/g,'\n\n').trim();
  }
  function prepare(text){
    let s=speechText(text).replace(/\bCloud\s+Brain\b/gi,'облачный помощник')
      .replace(/\bMath\s+Lab\b/gi,'математическая лаборатория')
      .replace(/\bWhisper\b/gi,'распознавание речи').replace(/\bPiper\b/gi,'Пайпер')
      .replace(/\bKitsune\b/gi,'Китсуне').replace(/ОДЗ/g,'область допустимых значений');
    const vulgar={'¼':[1,4],'½':[1,2],'¾':[3,4],'⅐':[1,7],'⅑':[1,9],'⅒':[1,10],'⅓':[1,3],'⅔':[2,3],'⅕':[1,5],'⅖':[2,5],'⅗':[3,5],'⅘':[4,5],'⅙':[1,6],'⅚':[5,6],'⅛':[1,8],'⅜':[3,8],'⅝':[5,8],'⅞':[7,8]};
    s=s.replace(/(?<![\p{L}\p{N}/])(\d+)\s*([¼½¾⅐⅑⅒⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞])/gu,(_,whole,v)=>integer(+whole,true)+' '+plural(+whole,['целая','целых','целых'])+' и '+fraction(...vulgar[v]))
      .replace(/[¼½¾⅐⅑⅒⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞]/g,v=>fraction(...vulgar[v]));
    s=s.replace(/(?<![\p{L}\p{N}/])([−-]?\d+)[ \t]*\/[ \t]*(\d+)(?![\d/])/gu,(all,n,d)=>fractionNames[+d]&&Math.abs(Number(n.replace('−','-')))<1e6?fraction(n,d):all);
    s=s.replace(/([\p{L}\p{N})\]])([⁰¹²³⁴⁵⁶⁷⁸⁹⁻⁺ⁿᵐ]+)/gu,(_,base,exp)=>base+' '+power(Array.from(exp,v=>superscripts[v]).join('')))
      .replace(/(?:\*\*|\^)[ \t]*([−+-]?\d+|[nm]|\([^()]+\))/gi,(_,exp)=>' '+power(exp));
    s=s.replace(/(\d+(?:[.,]\d+)?|[a-z]|\))[ \t]*:[ \t]*(?=[\da-z(])/gi,'$1 делить на ')
      .replace(/\|([^|\n]+)\|/g,'модуль $1');
    s=s.replace(/\bsqrt\b/gi,'квадратный корень из').replace(/\bsin\b/gi,'синус').replace(/\bcos\b/gi,'косинус').replace(/\btg\b/gi,'тангенс');
    // Произведение букв относится к коротким математическим обозначениям.
    // Неизвестное длинное название произносим по буквам без выдуманных операций.
    s=s.replace(/[a-z]+/gi,v=>' '+Array.from(v.toLowerCase(),c=>letters[c.charCodeAt(0)-97]).join(v.length<=3?' умножить на ':' ')+' ');
    s=s.replace(/\d+(?:[.,]\d+)?/g,number).replace(/²/g,' в квадрате ').replace(/³/g,' в кубе ').replace(/\*\*|\^/g,' в степени ');
    const ops={'!=':'не равно','≠':'не равно','<=':'меньше или равно','≤':'меньше или равно','⩽':'меньше или равно','>=':'больше или равно','≥':'больше или равно','⩾':'больше или равно','≈':'приблизительно равно','=':'равно','+':'плюс','−':'минус','-':'минус','·':'умножить на','⋅':'умножить на','∙':'умножить на','×':'умножить на','*':'умножить на','/':'делить на','÷':'делить на','<':'меньше','>':'больше','√':'квадратный корень из','±':'плюс минус','%':'процентов','π':'пи','Δ':'дельта','∞':'бесконечность','∈':'принадлежит','∉':'не принадлежит','⇒':'следовательно','→':'следовательно','∠':'угол','°':'градусов','(':'открываем скобку',')':'закрываем скобку','[':'открываем скобку',']':'закрываем скобку'};
    s=s.replace(/!=|<=|>=|[≠≤≥⩽⩾≈=+−·⋅∙×*/÷<>√±%πΔ∞∈∉⇒→∠°()[\]]|(?<![а-яё])-|-(?![а-яё])/gi,v=>' '+ops[v]+' ');
    s=s.replace(/[а-яё]+/gi,v=>{const marked=stress[v.toLowerCase()];return marked?(v[0]===v[0].toUpperCase()?marked[0].toUpperCase()+marked.slice(1):marked):v;});
    return s.replace(/[ \t]+/g,' ').replace(/[ \t]+([.!?…,:;])/g,'$1').replace(/ *\n */g,'\n').trim();
  }
  function speechPlan(text,maximum=145){
    const s=prepare(text);if(!s||s.length>20000)throw Error('Текст пустой или слишком длинный.');
    if(!/[\p{L}\p{N}]/u.test(s))throw Error('В тексте нет слов для озвучки.');
    const out=[],blocks=s.split(/\n+/).filter(Boolean);
    for(let i=0;i<blocks.length;i++){
      const sentences=blocks[i].match(/[^.!?…;]+[.!?…;]*/g)||[blocks[i]];
      for(const sentence of sentences){
        const math=/(?:степени|квадрате|кубе|числителе|знаменателе|умножить на|делить на|разделить на|плюс|минус|равно|меньше|больше|корень из|модуль|дробь|(?:одна|две|три|четыре|пять|семь) (?:вторая|вторых|третья|третьих|четвёртая|четвёртых|пятая|пятых|шестая|шестых|седьмая|седьмых|восьмая|восьмых|девятая|девятых|десятая|десятых|сотая|сотых|тысячная|тысячных))/i.test(sentence.replace(/\u0301/g,''));
        const append=(text,pause_after_ms)=>out.push({text,pause_after_ms,...(math?{length_multiplier:1.12}:{})});
        let part='';
        for(const word of sentence.trim().split(/\s+/)){
          if(word.length>maximum)throw Error('Слишком длинное слово для озвучки.');
          if(part&&(part+' '+word).length>maximum){append(part,0);part='';}
          part+=(part?' ':'')+word;
        }
        if(part)append(part,/[;]$/.test(part)?420:/[.!?…]$/.test(part)?(math?450:260):0);
      }
      if(i<blocks.length-1&&out.length)out.at(-1).pause_after_ms=/^Раздел [^,]+,/.test(blocks[i])?750:650;
    }
    if(!out.length)throw Error('В тексте нет слов для озвучки.');out.at(-1).pause_after_ms=0;return out;
  }
  function chunks(text,maximum=145){
    const s=prepare(text);if(!s||s.length>20000)throw Error('Текст пустой или слишком длинный.');
    const sentences=s.match(/[^.!?…]+[.!?…]*\s*/g)||[s];const out=[];let part='';
    for(const sentence of sentences){
      for(const word of sentence.trim().split(/\s+/)){
        if(part&&(part+' '+word).length>maximum){out.push(part);part='';}
        if(word.length>maximum)throw Error('Слишком длинное слово для озвучки.');part+=(part?' ':'')+word;
      }
      if(part.length>=45){out.push(part);part='';}
    }
    if(part)out.push(part);return out;
  }
  function tokenizer(spec){
    const vocab=spec.model.vocab,ranks=new Map(spec.model.merges.map((m,i)=>[Array.isArray(m)?m.join(' '):m,i]));
    const special=spec.added_tokens.map(t=>t.content).sort((a,b)=>b.length-a.length);
    const escaped=special.map(s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'));
    const pattern=new RegExp('('+escaped.join('|')+')','gu');
    return function encode(text){
      const ids=[];const normalized='[ru]'+text.toLowerCase().normalize('NFKD').replace(/ /g,'[SPACE]');
      for(const piece of normalized.split(pattern)){
        if(!piece)continue;if(special.includes(piece)){ids.push(vocab[piece]);continue;}
        for(const word of piece.match(/[\p{L}\p{M}\p{N}_]+|[^\p{L}\p{M}\p{N}_\s]+/gu)||[]){
          let symbols=Array.from(word);
          for(;;){let best=Infinity,index=-1;for(let i=0;i<symbols.length-1;i++){const rank=ranks.get(symbols[i]+' '+symbols[i+1]);if(rank<best){best=rank;index=i;}}
            if(index<0)break;symbols.splice(index,2,symbols[index]+symbols[index+1]);}
          ids.push(...symbols.map(v=>vocab[v]??vocab['[UNK]']));
        }
      }
      return ids;
    };
  }
  function rope(inv,past,length){
    const cos=new Float32Array(length*64),sin=new Float32Array(length*64);
    for(let i=0;i<length;i++)for(let j=0;j<32;j++){
      const angle=(past+i)*inv[j];cos[i*64+j]=cos[i*64+j+32]=Math.cos(angle);sin[i*64+j]=sin[i*64+j+32]=Math.sin(angle);
    }
    const mask=new Float32Array(length*(past+length));
    for(let i=0;i<length;i++)for(let j=past+i+1;j<past+length;j++)mask[i*(past+length)+j]=-10000;
    return {cos,sin,mask};
  }
  function random(seed){return()=>{let t=seed+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
  function sample(logits,history,start,rand){
    const scores=new Float32Array(6563);let max=-Infinity;
    const used=new Set([...history,start]);
    for(let i=0;i<scores.length;i++){let x=logits[i]+.5*(logits[i]-logits[i+8194]);if(used.has(i))x=x<0?x*2:x/2;if(i===start)x=-Infinity;scores[i]=x/.65;max=Math.max(max,scores[i]);}
    let total=0;for(let i=0;i<scores.length;i++){const p=Math.exp(scores[i]-max);scores[i]=p<.05?0:p;total+=scores[i];}
    if(!(total>0)||!Number.isFinite(total))throw Error('Некорректный результат генератора.');
    let point=rand()*total;for(let i=0;i<scores.length;i++){point-=scores[i];if(point<=0)return i;}return 6562;
  }
  function normals(length,rand){const a=new Float32Array(length);for(let i=0;i<length;i+=2){const r=Math.sqrt(-2*Math.log(Math.max(rand(),1e-10))),t=2*Math.PI*rand();a[i]=r*Math.cos(t);if(i+1<length)a[i+1]=r*Math.sin(t);}return a;}
  function wav(samples,rate=24000){
    const bytes=new ArrayBuffer(44+samples.length*2),v=new DataView(bytes);const str=(at,s)=>Array.from(s).forEach((c,i)=>v.setUint8(at+i,c.charCodeAt(0)));
    str(0,'RIFF');v.setUint32(4,36+samples.length*2,true);str(8,'WAVE');str(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,rate,true);v.setUint32(28,rate*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);str(36,'data');v.setUint32(40,samples.length*2,true);
    let energy=0;for(let i=0;i<samples.length;i++){if(!Number.isFinite(samples[i]))throw Error('В аудио есть повреждённые данные.');let x=Math.max(-1,Math.min(1,samples[i]));energy+=x*x;v.setInt16(44+i*2,x<0?x*32768:x*32767,true);}
    if(samples.length<24000||Math.sqrt(energy/samples.length)<.002)throw Error('Генератор вернул слишком короткую или тихую запись.');return bytes;
  }
  const api={stress,integer,number,fraction,power,speechText,prepare,speechPlan,chunks,tokenizer,rope,random,sample,normals,wav};
  globalThis.KitsuneDeviceCore=api;if(typeof module!=='undefined')module.exports=api;
})();
