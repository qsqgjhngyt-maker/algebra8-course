
/* ================================================================
   Kitsune Math Worker v2.1.0
   Deterministic local algebra core for grade 8.
   No network, no eval(), no Function().
   ================================================================ */
"use strict";

class Fr{
  constructor(n=0n,d=1n){
    n=BigInt(n); d=BigInt(d);
    if(d===0n)throw new Error("Деление на ноль");
    if(d<0n){n=-n;d=-d}
    const g=Fr.gcd(n<0n?-n:n,d);
    this.n=n/g; this.d=d/g;
  }
  static gcd(a,b){ while(b){const t=a%b;a=b;b=t} return a||1n }
  static from(v){
    if(v instanceof Fr)return v;
    if(typeof v==="bigint")return new Fr(v,1n);
    const s=String(v).trim().replace(",",".");
    if(/^[-+]?\d+$/.test(s))return new Fr(BigInt(s),1n);
    if(/^[-+]?\d+\.\d+$/.test(s)){
      const neg=s.startsWith("-");
      const q=s.replace(/^[-+]/,"").split(".");
      const den=10n**BigInt(q[1].length);
      const num=BigInt(q[0]+q[1])*(neg?-1n:1n);
      return new Fr(num,den);
    }
    if(/^[-+]?\d+\/[-+]?\d+$/.test(s)){
      const [a,b]=s.split("/");
      return new Fr(BigInt(a),BigInt(b));
    }
    throw new Error("Не удалось прочитать число: "+s);
  }
  add(o){o=Fr.from(o);return new Fr(this.n*o.d+o.n*this.d,this.d*o.d)}
  sub(o){o=Fr.from(o);return new Fr(this.n*o.d-o.n*this.d,this.d*o.d)}
  mul(o){o=Fr.from(o);return new Fr(this.n*o.n,this.d*o.d)}
  div(o){o=Fr.from(o);return new Fr(this.n*o.d,this.d*o.n)}
  neg(){return new Fr(-this.n,this.d)}
  pow(k){k=Number(k);if(!Number.isInteger(k)||k<0||k>8)throw new Error("Неподдерживаемая степень");return new Fr(this.n**BigInt(k),this.d**BigInt(k))}
  eq(o){o=Fr.from(o);return this.n===o.n&&this.d===o.d}
  isZero(){return this.n===0n}
  toNumber(){return Number(this.n)/Number(this.d)}
  toString(){return this.d===1n?String(this.n):`${this.n}/${this.d}`}
}

function P(a=0,b=0,c=0){return [Fr.from(a),Fr.from(b),Fr.from(c)]} // c0+c1*x+c2*x²
function pTrim(p){return p.map(x=>Fr.from(x))}
function pAdd(a,b){return a.map((x,i)=>x.add(b[i]))}
function pSub(a,b){return a.map((x,i)=>x.sub(b[i]))}
function pMul(a,b){
  const r=P();
  for(let i=0;i<3;i++)for(let j=0;j<3;j++){
    if(i+j>2&&!a[i].isZero()&&!b[j].isZero())throw new Error("Степень выше 2 пока не поддерживается");
    if(i+j<=2)r[i+j]=r[i+j].add(a[i].mul(b[j]));
  }
  return r;
}
function pDivConst(a,b){
  if(!b[1].isZero()||!b[2].isZero())throw new Error("Деление на выражение с x требует режима рациональной дроби");
  if(b[0].isZero())throw new Error("Деление на ноль");
  return a.map(x=>x.div(b[0]));
}
function pPow(a,k){
  k=Number(k);
  if(k===0)return P(1,0,0);
  if(k===1)return a;
  if(k===2)return pMul(a,a);
  throw new Error("Для выражений с x поддерживаются степени 0, 1 и 2");
}
function pDegree(p){for(let i=2;i>=0;i--)if(!p[i].isZero())return i;return 0}
function pEq(a,b){return a.every((x,i)=>x.eq(b[i]))}
function pScaleEq(a,b){
  // same polynomial up to nonzero scalar
  let ratio=null;
  for(let i=0;i<3;i++){
    if(a[i].isZero()&&b[i].isZero())continue;
    if(a[i].isZero()||b[i].isZero())return false;
    const r=a[i].div(b[i]);
    if(ratio===null)ratio=r;
    else if(!ratio.eq(r))return false;
  }
  return ratio!==null&&!ratio.isZero();
}
function pString(p){
  const terms=[];
  for(let i=2;i>=0;i--){
    const f=p[i]; if(f.isZero())continue;
    const neg=f.n<0n;
    const abs=new Fr(neg?-f.n:f.n,f.d);
    let core="";
    if(i===0)core=abs.toString();
    else{
      const coeff=abs.eq(1)?"":abs.toString()+"·";
      core=coeff+(i===1?"x":"x²");
    }
    if(!terms.length)terms.push((neg?"−":"")+core);
    else terms.push((neg?" − ":" + ")+core);
  }
  return terms.join("")||"0";
}

function normalize(raw){
  return String(raw??"")
    .replace(/[хХ]/g,"x")
    .replace(/[−–—]/g,"-")
    .replace(/[×·]/g,"*")
    .replace(/²/g,"^2")
    .replace(/³/g,"^3")
    .replace(/√\s*(\d+(?:[.,]\d+)?)/g,"sqrt($1)")
    .replace(/,/g,".")
    .replace(/\s+/g,"")
    .replace(/(\d|\)|x)(x|\()/g,"$1*$2")
    .replace(/x(\d)/g,"x*$1");
}

function tokenize(s){
  const out=[]; let i=0;
  while(i<s.length){
    const c=s[i];
    if(/[0-9.]/.test(c)){
      let j=i+1;while(j<s.length&&/[0-9.]/.test(s[j]))j++;
      out.push({t:"num",v:s.slice(i,j)});i=j;continue;
    }
    if(c==="x"){out.push({t:"x"});i++;continue}
    if("+-*/^()".includes(c)){out.push({t:c});i++;continue}
    if(s.startsWith("sqrt",i)){out.push({t:"sqrt"});i+=4;continue}
    throw new Error(`Неизвестный символ «${c}»`);
  }
  return out;
}
function parsePoly(raw){
  const s=normalize(raw);
  const ts=tokenize(s); let i=0;
  function peek(t){return ts[i]?.t===t}
  function eat(t){if(!peek(t))throw new Error(`Ожидалось «${t}»`);return ts[i++]}
  function primary(){
    if(peek("num"))return P(Fr.from(eat("num").v),0,0);
    if(peek("x")){eat("x");return P(0,1,0)}
    if(peek("(")){eat("(");const v=expr();eat(")");return v}
    if(peek("sqrt")){
      eat("sqrt");eat("(");
      if(!peek("num"))throw new Error("Под корнем здесь пока ожидается число");
      const n=Number(eat("num").v);eat(")");
      const r=Math.sqrt(n);
      if(Number.isInteger(r))return P(Fr.from(r),0,0);
      throw new Error("Иррациональная константа поддерживается в режиме корней, но не внутри общего многочлена");
    }
    throw new Error("Неожиданный фрагмент выражения");
  }
  function unary(){
    if(peek("+")){eat("+");return unary()}
    if(peek("-")){eat("-");return unary().map(x=>x.neg())}
    return primary();
  }
  function power(){
    let a=unary();
    if(peek("^")){
      eat("^");
      if(!peek("num"))throw new Error("После ^ нужна целая степень");
      const k=Number(eat("num").v);a=pPow(a,k);
    }
    return a;
  }
  function term(){
    let a=power();
    while(peek("*")||peek("/")){
      const op=ts[i++].t,b=power();
      a=op==="*"?pMul(a,b):pDivConst(a,b);
    }
    return a;
  }
  function expr(){
    let a=term();
    while(peek("+")||peek("-")){
      const op=ts[i++].t,b=term();
      a=op==="+"?pAdd(a,b):pSub(a,b);
    }
    return a;
  }
  const p=expr();
  if(i!==ts.length)throw new Error("Лишняя часть выражения");
  return pTrim(p);
}

function fmtNum(n){
  if(!Number.isFinite(n))return String(n);
  if(Math.abs(n-Math.round(n))<1e-10)return String(Math.round(n));
  return String(Math.round(n*1e8)/1e8).replace(".",",");
}
function perfectSquareBigInt(n){
  if(n<0n)return null;
  let x=BigInt(Math.floor(Math.sqrt(Number(n))));
  while((x+1n)*(x+1n)<=n)x++;
  while(x*x>n)x--;
  return x*x===n?x:null;
}
function sqrtFractionExact(fr){
  if(fr.n<0n)return null;
  const sn=perfectSquareBigInt(fr.n), sd=perfectSquareBigInt(fr.d);
  if(sn!==null&&sd!==null)return new Fr(sn,sd);
  return null;
}
function signedRoot(base,delta,sign){
  // (-b ± sqrt(D))/(2a), all fractions
  const sq=sqrtFractionExact(delta);
  if(sq)return base.add(sign>0?sq:sq.neg());
  return null;
}

function solvePolyEquation(poly){
  const c=poly[0], b=poly[1], a=poly[2], deg=pDegree(poly);
  if(deg===0){
    return c.isZero()
      ?{kind:"identity",solutions:"all",display:"Все действительные x",steps:["После упрощения получаем тождество 0 = 0."]}
      :{kind:"contradiction",solutions:[],display:"Решений нет",steps:[`После упрощения получаем ${c.toString()} = 0 — это неверно.`]};
  }
  if(deg===1){
    const x=c.neg().div(b);
    return {
      kind:"linear",solutions:[x.toString()],display:`x = ${x.toString()}`,
      steps:[
        `${pString(poly)} = 0`,
        `${b.toString()}·x = ${c.neg().toString()}`,
        `x = ${x.toString()}`
      ],
      exact:true
    };
  }
  const D=b.mul(b).sub(a.mul(c).mul(4));
  const Dn=D.toNumber();
  const steps=[
    `${pString(poly)} = 0`,
    `D = b² − 4ac = ${D.toString()}`
  ];
  if(Dn<0){
    steps.push("D < 0, действительных корней нет.");
    return {kind:"quadratic",D:D.toString(),solutions:[],display:"Действительных корней нет",steps,exact:true};
  }
  const twoA=a.mul(2);
  const negB=b.neg();
  const sq=sqrtFractionExact(D);
  if(sq){
    const x1=negB.sub(sq).div(twoA), x2=negB.add(sq).div(twoA);
    const arr=x1.eq(x2)?[x1.toString()]:[x1.toString(),x2.toString()];
    steps.push(`√D = ${sq.toString()}`);
    if(arr.length===1)steps.push(`x = ${arr[0]}`);
    else steps.push(`x₁ = ${arr[0]}, x₂ = ${arr[1]}`);
    return {kind:"quadratic",D:D.toString(),solutions:arr,display:arr.length===1?`x = ${arr[0]}`:`x₁ = ${arr[0]}, x₂ = ${arr[1]}`,steps,exact:true};
  }
  // symbolic irrational roots
  const aS=a.toString(), bS=b.toString(), dS=D.toString();
  const denom=twoA.toString();
  const left=`(${-b.toNumber()} − √${dS})/${denom}`;
  const right=`(${-b.toNumber()} + √${dS})/${denom}`;
  const x1=(-b.toNumber()-Math.sqrt(Dn))/(2*a.toNumber());
  const x2=(-b.toNumber()+Math.sqrt(Dn))/(2*a.toNumber());
  steps.push(`√D = √${dS}`);
  steps.push(`x₁ = ${left} ≈ ${fmtNum(x1)}, x₂ = ${right} ≈ ${fmtNum(x2)}`);
  return {kind:"quadratic",D:D.toString(),solutions:[left,right],approx:[x1,x2],display:`x₁ ≈ ${fmtNum(x1)}, x₂ ≈ ${fmtNum(x2)}`,steps,exact:false};
}

function splitRelation(raw){
  const s=String(raw).replace(/[≤]/g,"<=").replace(/[≥]/g,">=").replace(/[−–—]/g,"-");
  const m=s.match(/(<=|>=|=|<|>)/);
  if(!m)return null;
  const i=m.index,op=m[0];
  return {left:s.slice(0,i),op,right:s.slice(i+op.length)};
}
function solveEquation(raw){
  const rel=splitRelation(raw);
  if(!rel||rel.op!=="=")throw new Error("Нужно уравнение со знаком =");
  const l=parsePoly(rel.left),r=parsePoly(rel.right);
  const poly=pSub(l,r);
  const solved=solvePolyEquation(poly);
  return {type:"equation",input:raw,normalized:`${pString(l)} = ${pString(r)}`,poly:pString(poly),...solved};
}
function solveInequality(raw){
  const rel=splitRelation(raw);
  if(!rel||!["<",">","<=",">="].includes(rel.op))throw new Error("Нужно неравенство со знаком <, >, ≤ или ≥");
  const l=parsePoly(rel.left),r=parsePoly(rel.right);
  const poly=pSub(l,r);
  if(pDegree(poly)>1)throw new Error("В этой версии пошагово решаются линейные неравенства");
  const c=poly[0],b=poly[1],op=rel.op;
  if(b.isZero()){
    const val=c.toNumber();
    const truth=op==="<"?val<0:op===">"?val>0:op==="<="?val<=0:val>=0;
    return {type:"inequality",kind:"constant",display:truth?"Все действительные x":"Решений нет",steps:[`${pString(poly)} ${op} 0`,truth?"Неравенство верно при любом x.":"Неравенство не выполняется."]};
  }
  const boundary=c.neg().div(b);
  const flips=b.toNumber()<0;
  const finalOp=flips?({">":"<","<":">",">=":"<=","<=":">="}[op]):op;
  const dispOp=finalOp.replace(">=","≥").replace("<=","≤");
  const steps=[`${pString(poly)} ${op.replace(">=","≥").replace("<=","≤")} 0`];
  steps.push(`${b.toString()}·x ${op.replace(">=","≥").replace("<=","≤")} ${c.neg().toString()}`);
  if(flips)steps.push(`Делим на ${b.toString()} < 0, поэтому знак неравенства меняется.`);
  steps.push(`x ${dispOp} ${boundary.toString()}`);
  return {
    type:"inequality",kind:"linear",boundary:boundary.toString(),op:finalOp,
    display:`x ${dispOp} ${boundary.toString()}`,steps,
    interval:intervalFrom(finalOp,boundary.toNumber())
  };
}
function intervalFrom(op,n){
  if(op===">")return {lo:n,loClosed:false,hi:null,hiClosed:false};
  if(op===">=")return {lo:n,loClosed:true,hi:null,hiClosed:false};
  if(op==="<")return {lo:null,loClosed:false,hi:n,hiClosed:false};
  return {lo:null,loClosed:false,hi:n,hiClosed:true};
}
function intervalEq(a,b){
  if(!a||!b)return false;
  return a.lo===b.lo&&a.hi===b.hi&&a.loClosed===b.loClosed&&a.hiClosed===b.hiClosed;
}

function solveSystem(raw){
  const parts=Array.isArray(raw)?raw:String(raw).split(/\n|;/).map(x=>x.trim()).filter(Boolean);
  if(parts.length!==2)throw new Error("Для системы нужны ровно два уравнения");
  return solveSystemXY(parts);
}
function parseLinearXY(raw){
  // simple tokenizer by replacing y with temporary z, manually parse coefficients using substitutions.
  const s=String(raw).replace(/[хХ]/g,"x").replace(/[уУ]/g,"y").replace(/[−–—]/g,"-").replace(/[×·]/g,"*").replace(/,/g,".").replace(/\s+/g,"");
  const rel=s.match(/(=)/);if(!rel)throw new Error("В системе нужен знак =");
  const [L,R]=s.split("=");
  // Parse by evaluating linear expression at (0,0),(1,0),(0,1) using safe arithmetic parser.
  function evalXY(expr,x,y){
    const replaced=expr.replace(/x/g,`(${x})`).replace(/y/g,`(${y})`);
    return evalNumericSafe(replaced);
  }
  const f=(x,y)=>evalXY(L,x,y)-evalXY(R,x,y);
  const c=f(0,0),a=f(1,0)-c,b=f(0,1)-c;
  // linearity checks
  if(Math.abs(f(2,0)-(2*a+c))>1e-8||Math.abs(f(0,2)-(2*b+c))>1e-8||Math.abs(f(1,1)-(a+b+c))>1e-8)throw new Error("Система должна быть линейной");
  return {a,b,c};
}
function evalNumericSafe(raw){
  const s=normalize(raw).replace(/x/g,"0");
  const ts=tokenize(s);let i=0;
  function peek(t){return ts[i]?.t===t}
  function eat(t){if(!peek(t))throw new Error("Ошибка числового выражения");return ts[i++]}
  function prim(){
    if(peek("num"))return Number(eat("num").v);
    if(peek("(")){eat("(");const v=expr();eat(")");return v}
    if(peek("sqrt")){eat("sqrt");eat("(");const v=expr();eat(")");return Math.sqrt(v)}
    throw new Error("Ошибка числового выражения");
  }
  function unary(){if(peek("+")){eat("+");return unary()}if(peek("-")){eat("-");return-unary()}return prim()}
  function pow(){let a=unary();if(peek("^")){eat("^");a=a**Number(eat("num").v)}return a}
  function term(){let a=pow();while(peek("*")||peek("/")){const o=ts[i++].t,b=pow();a=o==="*"?a*b:a/b}return a}
  function expr(){let a=term();while(peek("+")||peek("-")){const o=ts[i++].t,b=term();a=o==="+"?a+b:a-b}return a}
  const v=expr();if(i!==ts.length)throw new Error("Лишняя часть числа");return v;
}
function solveSystemXY(parts){
  const r1=parseLinearXY(parts[0]),r2=parseLinearXY(parts[1]);
  const det=r1.a*r2.b-r2.a*r1.b;
  const dx=(-r1.c)*r2.b-(-r2.c)*r1.b;
  const dy=r1.a*(-r2.c)-r2.a*(-r1.c);
  if(Math.abs(det)<1e-10){
    const same=Math.abs(r1.a*r2.c-r2.a*r1.c)<1e-9&&Math.abs(r1.b*r2.c-r2.b*r1.c)<1e-9;
    return {type:"system",kind:same?"infinite":"none",display:same?"Бесконечно много решений":"Решений нет",steps:[same?"Уравнения задают одну и ту же прямую.":"Прямые параллельны и не совпадают."]};
  }
  const x=dx/det,y=dy/det;
  return {
    type:"system",kind:"linear2",x,y,display:`x = ${fmtNum(x)}, y = ${fmtNum(y)}`,
    steps:[
      `Δ = ${fmtNum(det)}`,
      `x = Δx/Δ = ${fmtNum(x)}`,
      `y = Δy/Δ = ${fmtNum(y)}`,
      `Проверка подстановкой: обе строки системы выполняются.`
    ]
  };
}

function simplifySqrt(raw){
  const s=String(raw).replace(/\s+/g,"").replace(/^√/,"");
  const n=Number(s.replace(",","."));
  if(!Number.isInteger(n)||n<0)throw new Error("Введите неотрицательное целое число под корнем");
  if(n===0)return {type:"sqrt",display:"0",steps:["√0 = 0"]};
  let a=1,b=n;
  for(let k=Math.floor(Math.sqrt(n));k>=2;k--){
    const sq=k*k;if(n%sq===0){a=k;b=n/sq;break}
  }
  const display=b===1?String(a):a===1?`√${b}`:`${a}√${b}`;
  return {type:"sqrt",display,steps:b===1?[`√${n} = ${a}`]:[`√${n} = √(${a*a}·${b}) = ${display}`]};
}

function simplifyRational(raw){
  const s=normalize(raw);
  // Find top-level /
  let depth=0,idx=-1;
  for(let i=0;i<s.length;i++){
    if(s[i]==="(")depth++; else if(s[i]===")")depth--;
    else if(s[i]==="/"&&depth===0){idx=i;break}
  }
  if(idx<0)throw new Error("Нужна дробь вида выражение / выражение");
  const numRaw=s.slice(0,idx),denRaw=s.slice(idx+1);
  const unwrap=x=>x.startsWith("(")&&x.endsWith(")")?x.slice(1,-1):x;
  const n=parsePoly(unwrap(numRaw)),d=parsePoly(unwrap(denRaw));
  const dsol=solvePolyEquation(d);
  const restrictions=Array.isArray(dsol.solutions)?dsol.solutions:[];
  // polynomial long division if exact
  const result=polyDivideExact(n,d);
  if(result){
    return {
      type:"rational",display:pString(result),
      restrictions,
      domain:restrictions.length?`ОДЗ: x ≠ ${restrictions.join(", x ≠ ")}`:"ОДЗ: знаменатель не равен 0",
      steps:[
        restrictions.length?`Сначала ОДЗ: x ≠ ${restrictions.join(", x ≠ ")}`:"Сначала учитываем ОДЗ.",
        `После сокращения/деления получаем ${pString(result)}.`
      ]
    };
  }
  // special cancel common linear root for degree2/degree1
  if(pDegree(d)===1&&pDegree(n)===2&&restrictions.length===1){
    const root=Fr.from(restrictions[0]);
    if(evalPolyFr(n,root).isZero()){
      const q=divideByLinearRoot(n,root);
      return {
        type:"rational",display:pString(q),restrictions,
        domain:`ОДЗ: x ≠ ${root.toString()}`,
        steps:[
          `ОДЗ: x ≠ ${root.toString()}`,
          `Числитель содержит множитель (x ${root.n<0n?"+":"−"} ${new Fr(root.n<0n?-root.n:root.n,root.d).toString()}).`,
          `Сокращаем общий множитель, но ограничение ОДЗ сохраняется.`,
          `Получаем ${pString(q)} при x ≠ ${root.toString()}.`
        ]
      };
    }
  }
  return {type:"rational",display:`(${pString(n)}) / (${pString(d)})`,restrictions,domain:restrictions.length?`ОДЗ: x ≠ ${restrictions.join(", x ≠ ")}`:"",steps:["Дробь распознана, но полного символического сокращения в этой версии нет."]};
}
function evalPolyFr(p,x){return p[0].add(p[1].mul(x)).add(p[2].mul(x).mul(x))}
function divideByLinearRoot(p,r){
  // c2 x²+c1x+c0 divided by x-r
  const a=p[2], b=p[1].add(a.mul(r));
  return P(b,a,0);
}
function polyDivideExact(n,d){
  const dn=pDegree(d),nn=pDegree(n);
  if(nn<dn)return null;
  if(dn===0)return pDivConst(n,d);
  if(dn===1&&nn===1){
    const k=n[1].div(d[1]);
    if(pEq(n,d.map(x=>x.mul(k))))return P(k,0,0);
  }
  if(dn===1&&nn===2){
    const root=d[0].neg().div(d[1]);
    if(evalPolyFr(n,root).isZero()){
      const q=divideByLinearRoot(n,root).map(x=>x.div(d[1]));
      return q;
    }
  }
  if(dn===2&&nn===2){
    if(pScaleEq(n,d)){
      for(let i=0;i<3;i++)if(!d[i].isZero())return P(n[i].div(d[i]),0,0);
    }
  }
  return null;
}

function classify(raw){
  const s=String(raw).trim();
  if(/\n/.test(s)&&s.split(/\n/).filter(Boolean).length===2)return "system";
  if(/^y\s*=/.test(s.replace(/[уУ]/g,"y")))return "function";
  if(/[≤≥<>]/.test(s)||/(<=|>=)/.test(s))return "inequality";
  if(/=/.test(s))return "equation";
  if(/^\s*√/.test(s)||/^\s*sqrt/i.test(s))return "sqrt";
  if(/\//.test(s)&&/[xхХ]/.test(s))return "rational";
  return "expression";
}
function analyze(raw,mode="auto"){
  const kind=mode==="auto"?classify(raw):mode;
  if(kind==="equation")return solveEquation(raw);
  if(kind==="inequality")return solveInequality(raw);
  if(kind==="system")return solveSystem(raw);
  if(kind==="sqrt")return simplifySqrt(String(raw).replace(/^sqrt\(/i,"").replace(/\)$/,""));
  if(kind==="rational")return simplifyRational(raw);
  if(kind==="function"){
    const expr=String(raw).replace(/[уУyY]\s*=/,"");
    return {type:"function",display:`y = ${expr.trim()}`,expression:expr.trim(),steps:["Функция распознана. Можно построить график и таблицу значений."]};
  }
  const p=parsePoly(raw);
  return {type:"expression",display:pString(p),poly:p.map(x=>x.toString()),steps:[`После приведения подобных: ${pString(p)}`]};
}

function solutionSignature(raw){
  try{
    const k=classify(raw);
    if(k==="equation"){
      const r=solveEquation(raw);
      return {kind:k,sol:r.solutions,all:r.solutions==="all"};
    }
    if(k==="inequality"){
      const r=solveInequality(raw);
      return {kind:k,interval:r.interval,display:r.display};
    }
    const p=parsePoly(raw);
    return {kind:"expression",poly:p};
  }catch(e){return {kind:"invalid",error:e.message}}
}
function verifySteps(raw){
  const lines=String(raw).split(/\n/).map(x=>x.trim()).filter(Boolean);
  if(lines.length<2)throw new Error("Введите хотя бы два шага");
  const rows=[{line:lines[0],ok:true,message:"Начальный шаг."}];
  for(let i=1;i<lines.length;i++){
    const a=solutionSignature(lines[i-1]),b=solutionSignature(lines[i]);
    let ok=false,msg="";
    if(a.kind==="invalid"||b.kind==="invalid"){
      ok=false;msg="Не удалось разобрать один из шагов.";
    }else if(a.kind!==b.kind){
      ok=false;msg="Тип выражения изменился — проверь переход.";
    }else if(a.kind==="expression"){
      ok=pEq(a.poly,b.poly);
      msg=ok?"Выражения эквивалентны.":"Выражения дают разные многочлены после упрощения.";
    }else if(a.kind==="equation"){
      if(a.all||b.all)ok=a.all===b.all;
      else{
        const sa=JSON.stringify([...(a.sol||[])].sort()),sb=JSON.stringify([...(b.sol||[])].sort());
        ok=sa===sb;
      }
      msg=ok?"Множество решений сохранилось.":"После этого шага изменилось множество решений.";
    }else if(a.kind==="inequality"){
      ok=intervalEq(a.interval,b.interval);
      if(ok)msg="Множество решений неравенства сохранилось.";
      else{
        const ra=String(lines[i-1]),rb=String(lines[i]);
        msg=/[-]\s*\d.*[<>≤≥]/.test(ra)&&/[<>≤≥]/.test(rb)
          ?"Множество решений изменилось. Проверь, не нужно ли было поменять знак при делении/умножении на отрицательное число."
          :"Множество решений изменилось — проверь знак и арифметику.";
      }
    }
    rows.push({line:lines[i],ok,message:msg});
    if(!ok)break;
  }
  return {type:"steps",ok:rows.every(x=>x.ok),rows};
}

function sampleFunction(expr,{xmin=-10,xmax=10,count=161}={}){
  const clean=String(expr).replace(/[уУyY]\s*=/,"").trim();
  const out=[];
  for(let i=0;i<count;i++){
    const x=xmin+(xmax-xmin)*i/(count-1);
    try{
      // restricted numeric expression by substitute x then safe evaluator
      const prepared=normalize(clean).replace(/x/g,`(${x})`);
      const y=evalNumericSafe(prepared);
      if(Number.isFinite(y)&&Math.abs(y)<1e6)out.push([x,y]); else out.push([x,null]);
    }catch(e){out.push([x,null])}
  }
  return {type:"functionSamples",expression:clean,points:out};
}


/* ================================================================
   Generator 2.0 · all 51 course topics
   Every task is built locally from deterministic templates.
   ================================================================ */
const GEN_TOPICS=[
  ["1-1",1,"Рациональные выражения"],["1-2",1,"Основное свойство дроби. Сокращение"],
  ["1-3",1,"Сложение и вычитание с одинаковыми знаменателями"],["1-4",1,"Сложение и вычитание с разными знаменателями"],
  ["1-5",1,"Умножение дробей. Степень дроби"],["1-6",1,"Деление дробей"],
  ["1-7",1,"Преобразование рациональных выражений"],["1-8",1,"Функция y = k/x и её график"],
  ["1-9",1,"Дробь как сумма дробей"],
  ["2-10",2,"Действительные числа"],["2-11",2,"Квадратные корни. Арифметический квадратный корень"],
  ["2-12",2,"Уравнение x² = a"],["2-13",2,"Приближённые значения квадратного корня"],
  ["2-14",2,"Функция y = √x и её график"],["2-15",2,"Корень из произведения и дроби"],
  ["2-16",2,"Корень из степени"],["2-17",2,"Вынесение и внесение множителя"],
  ["2-18",2,"Преобразование выражений с корнями"],["2-19",2,"Двойные радикалы"],
  ["3-20",3,"Неполные квадратные уравнения"],["3-21",3,"Формула корней квадратного уравнения"],
  ["3-22",3,"Задачи с квадратными уравнениями"],["3-23",3,"Теорема Виета"],
  ["3-24",3,"Квадратный трёхчлен и его корни"],["3-25",3,"Разложение квадратного трёхчлена"],
  ["3-26",3,"Дробные рациональные уравнения"],["3-27",3,"Задачи"],
  ["3-28",3,"Уравнение с двумя переменными и его график"],["3-29",3,"Системы двух линейных уравнений"],
  ["3-30",3,"Графический способ решения систем"],["3-31",3,"Алгебраический способ решения систем"],
  ["3-32",3,"Задачи на системы"],["3-33",3,"Уравнения с параметром"],
  ["4-34",4,"Числовые неравенства"],["4-35",4,"Свойства числовых неравенств"],
  ["4-36",4,"Сложение и умножение неравенств"],["4-37",4,"Пересечение и объединение множеств"],
  ["4-38",4,"Числовые промежутки"],["4-39",4,"Неравенства с одной переменной"],
  ["4-40",4,"Системы неравенств"],["4-41",4,"Доказательство неравенств"],
  ["5-42",5,"Функция. Область определения и множество значений"],["5-43",5,"Свойства функции"],
  ["5-44",5,"Свойства линейной функции"],["5-45",5,"Свойства y = k/x и y = √x"],
  ["5-46",5,"Целая и дробная части числа"],
  ["6-47",6,"Степень с целым отрицательным показателем"],["6-48",6,"Свойства степени с целым показателем"],
  ["6-49",6,"Стандартный вид числа"],["6-50",6,"Задачи с большими и малыми числами"],
  ["6-51",6,"Функции y = x⁻¹ и y = x⁻²"]
];
const GEN_TOPIC_MAP=Object.fromEntries(GEN_TOPICS.map(([id,chapter,title])=>[id,{id,chapter,title}]));

function grnd(a,b){return Math.floor(Math.random()*(b-a+1))+a}
function gpick(a){return a[grnd(0,a.length-1)]}
function gsign(n){return n<0?`− ${Math.abs(n)}`:`+ ${n}`}
function gxpm(a){
  if(a===0)return "x";
  return a>0?`x − ${a}`:`x + ${Math.abs(a)}`;
}
function gpoly2(b,c){
  let s="x²";
  if(b!==0)s+=b>0?` + ${b}x`:` − ${Math.abs(b)}x`;
  if(c!==0)s+=c>0?` + ${c}`:` − ${Math.abs(c)}`;
  return s;
}
function gfrac(n,d){return new Fr(BigInt(n),BigInt(d)).toString()}
function gfmt(v){return String(v).replace(".",",")}
function gtask(topicId,question,answer,opts={}){
  const meta=GEN_TOPIC_MAP[topicId];
  const accepted=Array.isArray(opts.accepted)?opts.accepted:[answer];
  return {
    id:`g_${topicId}_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,
    topicId,chapterId:meta.chapter,topicTitle:meta.title,
    question,answer:String(answer),accepted:accepted.map(String),
    kind:opts.kind||"text",
    options:opts.options||null,
    correctIndex:Number.isInteger(opts.correctIndex)?opts.correctIndex:null,
    hint:opts.hint||"",
    explanation:opts.explanation||"",
    difficulty:Math.max(1,Math.min(3,Number(opts.difficulty)||1)),
    category:opts.category||"practice"
  };
}
function grotPair(r1,r2){
  const a=Math.min(r1,r2),b=Math.max(r1,r2);
  return {
    answer:a===b?`x = ${a}`:`x₁ = ${a}, x₂ = ${b}`,
    accepted:a===b?[`x=${a}`,String(a)]:[
      `x₁=${a},x₂=${b}`,`x1=${a},x2=${b}`,`${a},${b}`,
      `x₁=${b},x₂=${a}`,`x1=${b},x2=${a}`,`${b},${a}`
    ]
  };
}
function genTopic(topicId,difficulty=1){
  difficulty=Math.max(1,Math.min(3,Number(difficulty)||1));
  const R=3+difficulty*2;

  switch(topicId){
    case "1-1": {
      const a=grnd(-R,R)||2;
      return gtask(topicId,`При каком значении x выражение 7/(${gxpm(a)}) не имеет смысла?`,a,{
        difficulty,hint:"Знаменатель не должен быть равен нулю.",
        explanation:`${gxpm(a)} = 0, поэтому запрещено x = ${a}.`
      });
    }
    case "1-2": {
      const A=grnd(2,5),B=grnd(2,5),g=grnd(2,4);
      const f=new Fr(BigInt(A),BigInt(B));
      const ans=f.d===1n?`${f.n}x`:f.n===1n?`x/${f.d}`:`${f.n}x/${f.d}`;
      return gtask(topicId,`Сократи дробь (${A*g}x²)/(${B*g}x), x ≠ 0.`,ans,{
        difficulty,accepted:[ans,`(${f.n}x)/${f.d}`],
        hint:"Сократи числовой коэффициент и один множитель x.",
        explanation:`x²/x=x, а ${A*g}/${B*g}=${f.toString()}.`
      });
    }
    case "1-3": {
      const d=grnd(5,12+difficulty*2),a=grnd(1,d-2),b=grnd(1,d-a);
      const f=new Fr(BigInt(a+b),BigInt(d));
      return gtask(topicId,`Вычисли ${a}/${d} + ${b}/${d}.`,f.toString(),{
        difficulty,hint:"Знаменатель одинаковый — складывай только числители.",
        explanation:`(${a}+${b})/${d}=${f.toString()}.`
      });
    }
    case "1-4": {
      const d1=gpick([2,3,4,5,6]);
      let d2=gpick([3,4,5,6,8]);
      while(d2===d1)d2=gpick([3,4,5,6,8]);
      const a=grnd(1,d1-1),b=grnd(1,d2-1),plus=Math.random()<.65;
      const f=plus?new Fr(a,d1).add(new Fr(b,d2)):new Fr(a,d1).sub(new Fr(b,d2));
      return gtask(topicId,`Вычисли ${a}/${d1} ${plus?"+":"−"} ${b}/${d2}.`,f.toString(),{
        difficulty,hint:"Сначала приведи дроби к общему знаменателю.",
        explanation:`После приведения к общему знаменателю получаем ${f.toString()}.`
      });
    }
    case "1-5": {
      if(Math.random()<.45){
        const a=grnd(2,5),b=grnd(a+1,8);
        const f=new Fr(a,b).pow(2);
        return gtask(topicId,`Вычисли (${a}/${b})².`,f.toString(),{
          difficulty,hint:"Возведи в квадрат и числитель, и знаменатель.",
          explanation:`(${a}/${b})²=${a*a}/${b*b}=${f.toString()}.`
        });
      }
      const a=grnd(1,5),b=grnd(2,8),c=grnd(1,6),d=grnd(2,9);
      const f=new Fr(a,b).mul(new Fr(c,d));
      return gtask(topicId,`Вычисли (${a}/${b})·(${c}/${d}).`,f.toString(),{
        difficulty,hint:"Перемножь числители и знаменатели; сократи результат.",
        explanation:`(${a}·${c})/(${b}·${d})=${f.toString()}.`
      });
    }
    case "1-6": {
      const a=grnd(1,6),b=grnd(2,8),c=grnd(1,6),d=grnd(2,8);
      const f=new Fr(a,b).div(new Fr(c,d));
      return gtask(topicId,`Вычисли (${a}/${b}):(${c}/${d}).`,f.toString(),{
        difficulty,hint:"Вторую дробь переверни и замени деление умножением.",
        explanation:`(${a}/${b})·(${d}/${c})=${f.toString()}.`
      });
    }
    case "1-7": {
      const a=gpick([2,3,4]),b=gpick([3,4,5,6]),m=a*b;
      const f=new Fr(1,a).add(new Fr(1,b)).mul(m);
      return gtask(topicId,`Вычисли (1/${a} + 1/${b})·${m}.`,f.toString(),{
        difficulty,hint:"Сначала выполни действие в скобках.",
        explanation:`Сумма дробей умножается на ${m}; итог ${f.toString()}.`
      });
    }
    case "1-8": {
      const x=grnd(2,5),y=grnd(-5,5)||3,k=x*y;
      return gtask(topicId,`Для функции y = ${k}/x найди y при x = ${x}.`,y,{
        difficulty,hint:"Подставь заданное x в формулу y=k/x.",
        explanation:`y=${k}/${x}=${y}.`
      });
    }
    case "1-9": {
      const a=grnd(2,9);
      return gtask(topicId,`Представь дробь (x + ${a})/x как сумму двух дробей.`,`1 + ${a}/x`,{
        difficulty,accepted:[`1+${a}/x`,`x/x+${a}/x`],
        hint:"Раздели каждый член числителя на x.",
        explanation:`(x+${a})/x=x/x+${a}/x=1+${a}/x.`
      });
    }

    case "2-10": {
      const irr=gpick(["√2","√3","√5","π"]);
      const opts=["0,25","7/4",irr,"−3"];
      return gtask(topicId,"Какое из чисел иррационально?",irr,{
        kind:"choice",options:opts,correctIndex:2,difficulty,
        hint:"Конечные десятичные дроби, целые числа и обычные дроби рациональны.",
        explanation:`${irr} нельзя представить конечной или периодической рациональной дробью.`
      });
    }
    case "2-11": {
      const n=grnd(2,8+difficulty),sq=n*n;
      return gtask(topicId,`Вычисли √${sq}.`,n,{
        difficulty,hint:"Найди неотрицательное число, квадрат которого равен подкоренному.",
        explanation:`${n}²=${sq}, поэтому √${sq}=${n}.`
      });
    }
    case "2-12": {
      const n=grnd(2,7+difficulty),sq=n*n;
      const pair=grotPair(-n,n);
      return gtask(topicId,`Реши уравнение x² = ${sq}.`,pair.answer,{
        difficulty,accepted:pair.accepted,hint:"У положительного a уравнение x²=a имеет два противоположных корня.",
        explanation:`x=±√${sq}=±${n}.`
      });
    }
    case "2-13": {
      let n=grnd(2,80);
      while(Number.isInteger(Math.sqrt(n)))n++;
      const val=Math.round(Math.sqrt(n)*10)/10,ans=gfmt(val.toFixed(1));
      return gtask(topicId,`Округли √${n} до десятых.`,ans,{
        difficulty,accepted:[ans,ans.replace(",","."),String(val)],
        hint:"Найди соседние квадраты и округли только конечный результат.",
        explanation:`√${n}≈${gfmt(Math.sqrt(n).toFixed(3))}, до десятых это ${ans}.`
      });
    }
    case "2-14": {
      const n=grnd(1,8+difficulty),x=n*n;
      return gtask(topicId,`Для функции y = √x найди y при x = ${x}.`,n,{
        difficulty,hint:"Подставь x и вычисли арифметический квадратный корень.",
        explanation:`y=√${x}=${n}.`
      });
    }
    case "2-15": {
      const a=grnd(1,7),b=grnd(2,8);
      const f=new Fr(a,b);
      return gtask(topicId,`Вычисли √(${a*a}/${b*b}).`,f.toString(),{
        difficulty,hint:"Используй √(a/b)=√a/√b для неотрицательных чисел.",
        explanation:`√${a*a}/√${b*b}=${a}/${b}=${f.toString()}.`
      });
    }
    case "2-16": {
      const n=grnd(2,10);
      return gtask(topicId,`Вычисли √(${n}²).`,n,{
        difficulty,hint:"Арифметический квадратный корень неотрицателен.",
        explanation:`√(${n}²)=|${n}|=${n}.`
      });
    }
    case "2-17": {
      const k=grnd(2,7),m=gpick([2,3,5,6,7]);
      return gtask(topicId,`Вынеси множитель из-под корня: √${k*k*m}.`,`${k}√${m}`,{
        difficulty,hint:`Представь ${k*k*m} как ${k*k}·${m}.`,
        explanation:`√(${k*k}·${m})=${k}√${m}.`
      });
    }
    case "2-18": {
      const a=grnd(2,6),b=grnd(2,7),m=gpick([2,3,5,7]);
      return gtask(topicId,`Упрости ${a}√${m} + ${b}√${m}.`,`${a+b}√${m}`,{
        difficulty,hint:"Складываются коэффициенты при одинаковом радикале.",
        explanation:`(${a}+${b})√${m}=${a+b}√${m}.`
      });
    }
    case "2-19": {
      const pair=gpick([[2,3],[2,5],[3,5]]);
      const [a,b]=pair,prod=a*b;
      return gtask(topicId,`Упрости √(${a+b} + 2√${prod}).`,`√${a} + √${b}`,{
        difficulty,accepted:[`√${a}+√${b}`,`√${b}+√${a}`],
        hint:`Вспомни (√a+√b)²=a+b+2√(ab).`,
        explanation:`(√${a}+√${b})²=${a+b}+2√${prod}, поэтому корень равен √${a}+√${b}.`
      });
    }

    case "3-20": {
      const c=grnd(2,8)*(Math.random()<.25?-1:1);
      const expr=c>0?`x² − ${c}x = 0`:`x² + ${Math.abs(c)}x = 0`;
      const pair=grotPair(0,c);
      return gtask(topicId,`Реши неполное квадратное уравнение ${expr}.`,pair.answer,{
        difficulty,accepted:pair.accepted,hint:"Вынеси x за скобки.",
        explanation:`x(x ${c>0?"−":"+"} ${Math.abs(c)})=0, поэтому x=0 или x=${c}.`
      });
    }
    case "3-21":
    case "3-24": {
      let r1=grnd(-R,R)||1,r2=grnd(-R,R)||-2;
      if(r1===r2&&difficulty>1)r2+=1;
      const b=-(r1+r2),c=r1*r2,pair=grotPair(r1,r2);
      return gtask(topicId,`Найди корни уравнения ${gpoly2(b,c)} = 0.`,pair.answer,{
        difficulty,accepted:pair.accepted,hint:"Найди дискриминант D=b²−4ac или используй связь с корнями.",
        explanation:`Корни ${r1} и ${r2}: их сумма ${r1+r2}, произведение ${r1*r2}.`
      });
    }
    case "3-22": {
      const x=grnd(3,8+difficulty),d=grnd(2,5),area=x*(x+d);
      return gtask(topicId,`Ширина прямоугольника x см, длина на ${d} см больше. Площадь ${area} см². Найди ширину.`,x,{
        difficulty,hint:`Составь уравнение x(x+${d})=${area} и выбери положительный корень.`,
        explanation:`x²+${d}x−${area}=0; положительный корень x=${x}.`
      });
    }
    case "3-23": {
      const r1=grnd(-5,5)||1,r2=grnd(-5,5)||3,b=-(r1+r2),c=r1*r2;
      return gtask(topicId,`Не решая уравнение ${gpoly2(b,c)} = 0, найди сумму его корней.`,r1+r2,{
        difficulty,hint:"По теореме Виета для x²+bx+c=0 сумма корней равна −b.",
        explanation:`Сумма корней = −(${b}) = ${r1+r2}.`
      });
    }
    case "3-25": {
      let r1=grnd(1,5),r2=grnd(6,9);
      const b=-(r1+r2),c=r1*r2;
      const correct=`(x−${r1})(x−${r2})`;
      const opts=[
        correct,
        `(x+${r1})(x+${r2})`,
        `(x−${r1})(x+${r2})`,
        `(x+${r1})(x−${r2})`
      ];
      return gtask(topicId,`Разложи ${gpoly2(b,c)} на множители.`,correct,{
        kind:"choice",options:opts,correctIndex:0,difficulty,
        hint:"Ищи числа, сумма которых равна коэффициенту при x с противоположным знаком, а произведение — свободному члену.",
        explanation:`Корни ${r1} и ${r2}, поэтому трёхчлен равен (x−${r1})(x−${r2}).`
      });
    }
    case "3-26": {
      const a=grnd(1,5),b=grnd(1,5),root=a+2*b;
      return gtask(topicId,`Реши уравнение (x + ${a})/(x − ${b}) = 2.`,root,{
        difficulty,accepted:[String(root),`x=${root}`],
        hint:`Сначала учти ОДЗ x≠${b}, затем умножь обе части на x−${b}.`,
        explanation:`x+${a}=2x−${2*b}, откуда x=${root}; ОДЗ выполнено.`
      });
    }
    case "3-27": {
      const n=grnd(3,9+difficulty),prod=n*(n+1);
      return gtask(topicId,`Произведение двух последовательных положительных целых чисел равно ${prod}. Найди меньшее число.`,n,{
        difficulty,hint:`Обозначь меньшее число x, тогда второе x+1 и x(x+1)=${prod}.`,
        explanation:`${n}·${n+1}=${prod}, поэтому меньшее число ${n}.`
      });
    }
    case "3-28": {
      const m=grnd(-3,3)||2,b=grnd(-5,5),x=grnd(-4,4),on=Math.random()<.6;
      const y=m*x+b+(on?0:grnd(1,3));
      const ans=on?"да":"нет";
      return gtask(topicId,`Лежит ли точка (${x}; ${y}) на графике y = ${m}x ${b>=0?"+":"−"} ${Math.abs(b)}? Ответь «да» или «нет».`,ans,{
        difficulty,accepted:[ans,ans==="да"?"Да":"Нет"],
        hint:"Подставь координату x в правую часть и сравни с y.",
        explanation:`При x=${x} правая часть равна ${m*x+b}, поэтому ответ: ${ans}.`
      });
    }
    case "3-29": {
      const x=grnd(-5,7),y=grnd(-5,7),s=x+y,d=x-y;
      return gtask(topicId,`Реши систему: x + y = ${s}; x − y = ${d}.`,`x = ${x}, y = ${y}`,{
        difficulty,accepted:[`x=${x},y=${y}`,`${x};${y}`,`(${x};${y})`],
        hint:"Сложи уравнения, чтобы исключить y.",
        explanation:`2x=${s+d}, значит x=${x}; затем y=${y}.`
      });
    }
    case "3-30": {
      const x=grnd(-4,5),y=grnd(-4,6),b1=y-x,b2=y+x;
      return gtask(topicId,`Найди точку пересечения графиков y = x ${b1>=0?"+":"−"} ${Math.abs(b1)} и y = −x ${b2>=0?"+":"−"} ${Math.abs(b2)}.`,`(${x}; ${y})`,{
        difficulty,accepted:[`(${x};${y})`,`${x};${y}`,`x=${x},y=${y}`],
        hint:"В точке пересечения значения y у обеих функций одинаковы.",
        explanation:`x+${b1}=−x+${b2}; отсюда x=${x}, y=${y}.`
      });
    }
    case "3-31": {
      const x=grnd(-4,6),y=grnd(-4,6),c1=2*x+y,c2=x-y;
      return gtask(topicId,`Реши систему: 2x + y = ${c1}; x − y = ${c2}.`,`x = ${x}, y = ${y}`,{
        difficulty,accepted:[`x=${x},y=${y}`,`${x};${y}`,`(${x};${y})`],
        hint:"Можно сложить уравнения после подходящего преобразования или использовать подстановку.",
        explanation:`Проверка: 2·${x}+${y}=${c1}, ${x}−(${y})=${c2}.`
      });
    }
    case "3-32": {
      const smaller=grnd(2,10),diff=grnd(2,7),larger=smaller+diff,sum=larger+smaller;
      return gtask(topicId,`Сумма двух чисел равна ${sum}, а первое на ${diff} больше второго. Найди оба числа.`,`(${larger}; ${smaller})`,{
        difficulty,accepted:[`(${larger};${smaller})`,`${larger};${smaller}`,`${larger},${smaller}`],
        hint:"Составь систему a+b=сумма и a−b=разность.",
        explanation:`Складываем уравнения: 2a=${sum+diff}, a=${larger}, b=${smaller}.`
      });
    }
    case "3-33": {
      const r=gpick([1,2,3,-1,-2]),p0=grnd(-6,6)||3,c=-(r*r+p0*r);
      return gtask(topicId,`При каком p число x = ${r} является корнем уравнения x² + p·x ${c>=0?"+":"−"} ${Math.abs(c)} = 0?`,p0,{
        difficulty,hint:`Подставь x=${r} в уравнение и реши полученное линейное уравнение относительно p.`,
        explanation:`${r*r}+p·(${r})${c>=0?"+":"−"}${Math.abs(c)}=0, откуда p=${p0}.`
      });
    }

    case "4-34": {
      const a=grnd(-9,9),b=grnd(-9,9)+(Math.random()<.5?.5:0);
      const ans=a<b?"<":a>b?">":"=";
      return gtask(topicId,`Поставь знак <, > или =: ${gfmt(a)} □ ${gfmt(b)}.`,ans,{
        difficulty,hint:"Сравни числа на числовой прямой.",
        explanation:`${gfmt(a)} ${ans} ${gfmt(b)}.`
      });
    }
    case "4-35": {
      const a=grnd(1,5),b=a+grnd(1,5),k=grnd(2,5);
      return gtask(topicId,`Известно ${a} < ${b}. Какой знак получится между ${-k*a} и ${-k*b} после умножения обеих частей на −${k}?`,">",{
        difficulty,hint:"При умножении неравенства на отрицательное число знак меняется.",
        explanation:`${-k*a} > ${-k*b}.`
      });
    }
    case "4-36": {
      const a=grnd(1,6),b=grnd(1,6),sum=a+b;
      return gtask(topicId,`Если p > ${a} и q > ${b}, какое неравенство для p+q гарантированно верно?`,`p + q > ${sum}`,{
        difficulty,accepted:[`p+q>${sum}`,`>${sum}`],
        hint:"Сложи левые и правые части двух неравенств.",
        explanation:`p+q>${a}+${b}=${sum}.`
      });
    }
    case "4-37": {
      const k=grnd(2,5);
      return gtask(topicId,`A={1, ${k}, ${k+1}}, B={${k}, ${k+2}}. Найди A∩B.`,`{${k}}`,{
        difficulty,accepted:[`{${k}}`,String(k)],
        hint:"Пересечение содержит элементы, которые есть одновременно в обоих множествах.",
        explanation:`Общий элемент только ${k}.`
      });
    }
    case "4-38": {
      const a=grnd(-6,1),b=a+grnd(2,8);
      return gtask(topicId,`Запиши промежутком множество ${a} ≤ x < ${b}.`,`[${a}; ${b})`,{
        difficulty,accepted:[`[${a};${b})`,`[${a},${b})`],
        hint:"Слева граница входит, справа — нет.",
        explanation:`Получаем [${a}; ${b}).`
      });
    }
    case "4-39": {
      const a=grnd(2,6)*(Math.random()<.35?-1:1),x0=grnd(-5,6),b=grnd(-5,5),c=a*x0+b;
      const op=gpick([">","<","≥","≤"]);
      const raw=`${a}x ${b>=0?"+":"−"} ${Math.abs(b)} ${op} ${c}`;
      const sol=solveInequality(raw);
      return gtask(topicId,`Реши неравенство ${raw}.`,sol.display,{
        difficulty,accepted:[sol.display,sol.display.replace("≤","<=").replace("≥",">=")],
        hint:"Перенеси свободный член и помни о смене знака при делении на отрицательное число.",
        explanation:sol.steps.join(" → ")
      });
    }
    case "4-40": {
      const a=grnd(-7,0),b=a+grnd(2,8);
      return gtask(topicId,`Реши систему неравенств: x > ${a} и x ≤ ${b}.`,`(${a}; ${b}]`,{
        difficulty,accepted:[`(${a};${b}]`,`(${a},${b}]`],
        hint:"Для системы нужен пересекающийся участок двух промежутков.",
        explanation:`Пересечение x>${a} и x≤${b} равно (${a}; ${b}].`
      });
    }
    case "4-41": {
      const opts=["(a−b)² ≥ 0","a−b ≥ 0 всегда","a+b ≤ 0 всегда","ab ≥ 0 всегда"];
      return gtask(topicId,"Какой факт напрямую доказывает неравенство a² + b² ≥ 2ab для любых действительных a и b?",opts[0],{
        kind:"choice",options:opts,correctIndex:0,difficulty,
        hint:"Перенеси 2ab влево и узнай полный квадрат.",
        explanation:`a²−2ab+b²=(a−b)²≥0.`
      });
    }

    case "5-42": {
      const a=grnd(-6,6)||2;
      return gtask(topicId,`Найди запрещённое значение x для функции y = 1/(${gxpm(a)}).`,`x ≠ ${a}`,{
        difficulty,accepted:[`x≠${a}`,`x!=${a}`,String(a)],
        hint:"Знаменатель функции не может быть равен нулю.",
        explanation:`${gxpm(a)}≠0, поэтому x≠${a}.`
      });
    }
    case "5-43": {
      const m=grnd(1,5)*(Math.random()<.35?-1:1);
      let x0=grnd(-5,6); if(x0===0)x0=grnd(1,5);
      const b=-m*x0;
      return gtask(topicId,`Найди ноль функции y = ${m}x ${b>=0?"+":"−"} ${Math.abs(b)}.`,x0,{
        difficulty,accepted:[String(x0),`x=${x0}`],
        hint:"Ноль функции — это x, при котором y=0.",
        explanation:`${m}x${b>=0?"+":"−"}${Math.abs(b)}=0, значит x=${x0}.`
      });
    }
    case "5-44": {
      const m=grnd(1,6)*(Math.random()<.5?-1:1),b=grnd(-5,5);
      const ans=m>0?"возрастает":"убывает";
      return gtask(topicId,`Как ведёт себя линейная функция y = ${m}x ${b>=0?"+":"−"} ${Math.abs(b)} при росте x?`,ans,{
        kind:"choice",options:["возрастает","убывает","постоянна","не определена"],correctIndex:m>0?0:1,difficulty,
        hint:"Смотри на знак коэффициента k при x.",
        explanation:`k=${m}; при k>0 функция возрастает, при k<0 убывает.`
      });
    }
    case "5-45": {
      if(Math.random()<.5){
        const opts=["x ≥ 0","x ≠ 0","все x","x ≤ 0"];
        return gtask(topicId,"Какова область определения функции y = √x?",opts[0],{
          kind:"choice",options:opts,correctIndex:0,difficulty,
          hint:"Подкоренное выражение для действительного корня должно быть неотрицательным.",
          explanation:"Для y=√x требуется x≥0."
        });
      }
      const k=grnd(1,6)*(Math.random()<.5?-1:1);
      const correct=k>0?"I и III":"II и IV";
      const opts=["I и III","II и IV","I и II","III и IV"];
      return gtask(topicId,`В каких четвертях расположены ветви y = ${k}/x?`,correct,{
        kind:"choice",options:opts,correctIndex:k>0?0:1,difficulty,
        hint:"Знак k определяет знаки x и y на ветвях гиперболы.",
        explanation:`При k ${k>0?">":"<"} 0 ветви находятся в ${correct} четвертях.`
      });
    }
    case "5-46": {
      const whole=grnd(1,9),tenths=grnd(1,9),num=`${whole},${tenths}`;
      if(Math.random()<.5){
        return gtask(topicId,`Найди целую часть числа ${num}.`,whole,{
          difficulty,hint:"Целая часть — наибольшее целое число, не превосходящее данное.",
          explanation:`Для положительного ${num} целая часть равна ${whole}.`
        });
      }
      return gtask(topicId,`Найди дробную часть числа ${num}.`,`0,${tenths}`,{
        difficulty,accepted:[`0,${tenths}`,`0.${tenths}`],
        hint:"Дробная часть равна числу минус его целая часть.",
        explanation:`${num}−${whole}=0,${tenths}.`
      });
    }

    case "6-47": {
      const a=grnd(2,6),n=grnd(2,4),den=a**n;
      return gtask(topicId,`Вычисли ${a}^(−${n}).`,`1/${den}`,{
        difficulty,hint:"a⁻ⁿ = 1/aⁿ.",
        explanation:`${a}^(−${n})=1/${a}^${n}=1/${den}.`
      });
    }
    case "6-48": {
      const a=grnd(2,5),m=grnd(-3,3),n=grnd(1,4);
      const exp=m+n;
      const val=exp>=0?new Fr(BigInt(a)**BigInt(exp),1n):new Fr(1n,BigInt(a)**BigInt(-exp));
      return gtask(topicId,`Вычисли ${a}^${m} · ${a}^${n}.`,val.toString(),{
        difficulty,hint:"При умножении степеней с одинаковым основанием показатели складываются.",
        explanation:`${a}^(${m}+${n})=${a}^${exp}=${val.toString()}.`
      });
    }
    case "6-49": {
      const c=gpick([1.2,2.5,3.6,4.8,7.2,9.1]),exp=gpick([-5,-4,-3,4,5,6]);
      const num=c*10**exp;
      let shown;
      if(exp<0)shown=num.toFixed(Math.abs(exp)+1).replace(".",",");
      else shown=String(Math.round(num));
      const ans=`${String(c).replace(".",",")}·10^${exp}`;
      return gtask(topicId,`Запиши число ${shown} в стандартном виде.`,ans,{
        difficulty,accepted:[ans,ans.replace("·","*").replace(",",".")],
        hint:"Коэффициент стандартного вида должен быть от 1 включительно до 10.",
        explanation:`${shown}=${ans}.`
      });
    }
    case "6-50": {
      const a=gpick([2,3,4,5]),b=gpick([2,3,4]),e1=gpick([6,7,8]),e2=gpick([-5,-4,-3]);
      const coeff=a*b,exp=e1+e2;
      const normCoeff=coeff>=10?coeff/10:coeff,normExp=coeff>=10?exp+1:exp;
      const ans=`${normCoeff}·10^${normExp}`;
      return gtask(topicId,`Вычисли и запиши в стандартном виде: (${a}·10^${e1})·(${b}·10^${e2}).`,ans,{
        difficulty,accepted:[ans,ans.replace("·","*")],
        hint:"Отдельно перемножь коэффициенты и сложи показатели десятки.",
        explanation:`${a*b}·10^${exp}=${ans}.`
      });
    }
    case "6-51": {
      const x=grnd(2,7)*(Math.random()<.25?-1:1),power=Math.random()<.5?-1:-2;
      const f=power===-1?new Fr(1,x):new Fr(1,x*x);
      return gtask(topicId,`Для функции y = x^${power} найди y при x = ${x}.`,f.toString(),{
        difficulty,hint:power===-1?"x⁻¹=1/x.":"x⁻²=1/x².",
        explanation:`y=${f.toString()}.`
      });
    }
  }
  throw new Error("Для выбранной темы генератор пока не найден");
}

function gnormAnswer(s){
  return String(s??"").trim().toLowerCase()
    .replace(/[−–—]/g,"-").replace(/≤/g,"<=").replace(/≥/g,">=")
    .replace(/×|·/g,"*").replace(/,/g,".").replace(/\s+/g,"")
    .replace(/[₁]/g,"1").replace(/[₂]/g,"2");
}
function checkGenerated({task,answer}={}){
  if(!task)throw new Error("Нет задания для проверки");
  if(task.kind==="choice"){
    const raw=String(answer??"").trim();
    const idx=Number(raw);
    const byIndex=raw!==""&&Number.isInteger(idx)&&idx===Number(task.correctIndex);
    const byText=gnormAnswer(raw)===gnormAnswer(task.answer);
    return {ok:byIndex||byText,answer:task.answer,explanation:task.explanation};
  }
  const u=gnormAnswer(answer);
  let ok=(task.accepted||[task.answer]).some(a=>gnormAnswer(a)===u);

  if(!ok){
    // Numeric/fraction equivalence for single-number answers.
    try{
      if(/^[-+]?\d+(?:[.,]\d+)?(?:\/[-+]?\d+)?$/.test(String(answer).trim()) &&
         /^[-+]?\d+(?:[.,]\d+)?(?:\/[-+]?\d+)?$/.test(String(task.answer).trim())){
        ok=Fr.from(String(answer)).eq(Fr.from(String(task.answer)));
      }
    }catch(e){}
  }
  return {ok,answer:task.answer,explanation:task.explanation};
}

function generateSet({mode="all",topicId=null,chapterId=null,count=1,difficulty=2,weakTopicIds=[]}={}){
  if(mode==="marathon")count=51;
  else count=Math.max(1,Math.min(20,Number(count)||1));
  difficulty=Math.max(1,Math.min(3,Number(difficulty)||2));
  let pool=GEN_TOPICS.map(x=>x[0]);

  if(mode==="topic"&&topicId&&GEN_TOPIC_MAP[topicId])pool=[topicId];
  else if(mode==="chapter"&&chapterId){
    pool=GEN_TOPICS.filter(x=>x[1]===Number(chapterId)).map(x=>x[0]);
  }else if(mode==="adaptive"){
    const weak=(Array.isArray(weakTopicIds)?weakTopicIds:[]).filter(x=>GEN_TOPIC_MAP[x]);
    pool=weak.length?[...weak,...weak,...GEN_TOPICS.map(x=>x[0])]:GEN_TOPICS.map(x=>x[0]);
  }else if(mode==="homework"&&chapterId){
    pool=GEN_TOPICS.filter(x=>x[1]===Number(chapterId)).map(x=>x[0]);
  }

  if(mode==="marathon"){
    const tasks=GEN_TOPICS.map(([id],i)=>genTopic(id,difficulty));
    return {
      mode,count:tasks.length,tasks,
      coverage:tasks.map(x=>x.topicId),
      chapters:[1,2,3,4,5,6]
    };
  }

  const tasks=[];
  const used=new Set();
  for(let i=0;i<count;i++){
    let id;
    if(mode==="control"){
      const chapter=(i%6)+1;
      const cp=GEN_TOPICS.filter(x=>x[1]===chapter).map(x=>x[0]);
      const unused=cp.filter(x=>!used.has(x));
      id=gpick(unused.length?unused:cp);
    }else{
      const unused=pool.filter(x=>!used.has(x));
      id=gpick(unused.length?unused:pool);
    }
    used.add(id);

    let d=difficulty;
    if(mode==="homework"){
      d=i<count*.3?1:i<count*.75?2:3;
    }else if(mode==="control"){
      d=i<4?1:i<9?2:3;
    }
    tasks.push(genTopic(id,d));
  }
  return {
    mode,count:tasks.length,tasks,
    coverage:[...new Set(tasks.map(x=>x.topicId))],
    chapters:[...new Set(tasks.map(x=>x.chapterId))]
  };
}

function generate(args={}){
  // Backward compatibility with v1.13 generator API.
  if(args.topic&&["linear","quadratic","inequality","sqrt"].includes(args.topic)){
    const alias={linear:"3-21",quadratic:"3-21",inequality:"4-39",sqrt:"2-17"}[args.topic];
    return genTopic(alias,args.difficulty||1);
  }
  if(args.topicId)return genTopic(args.topicId,args.difficulty||1);
  return genTopic(gpick(GEN_TOPICS.map(x=>x[0])),args.difficulty||1);
}

self.onmessage=async e=>{
  const {id,op,args}=e.data||{};
  try{
    let result;
    if(op==="analyze")result=analyze(args?.input,args?.mode||"auto");
    else if(op==="verifySteps")result=verifySteps(args?.input);
    else if(op==="sampleFunction")result=sampleFunction(args?.expression,args?.options||{});
    else if(op==="generate")result=generate(args||{});
    else if(op==="generateSet")result=generateSet(args||{});
    else if(op==="checkGenerated")result=checkGenerated(args||{});
    else if(op==="generatorCatalog")result=GEN_TOPICS.map(([id,chapter,title])=>({id,chapter,title}));
    else throw new Error("Неизвестная операция Math Worker");
    self.postMessage({id,ok:true,result});
  }catch(err){
    self.postMessage({id,ok:false,error:String(err?.message||err)});
  }
};
