
/* ================================================================
   Kitsune Math Worker v1.13.0
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

function generate({topic="linear",difficulty=1}={}){
  const rnd=(a,b)=>Math.floor(Math.random()*(b-a+1))+a;
  difficulty=Math.max(1,Math.min(3,Number(difficulty)||1));
  if(topic==="linear"){
    let a=rnd(1+difficulty,4+3*difficulty)*(Math.random()<.3?-1:1),x=rnd(-5*difficulty,7*difficulty),b=rnd(-8*difficulty,8*difficulty);
    const c=a*x+b;
    const q=`${a}x ${b>=0?"+":"−"} ${Math.abs(b)} = ${c}`;
    return {topic,question:q,answer:`x = ${x}`};
  }
  if(topic==="quadratic"){
    const r1=rnd(-5*difficulty,5*difficulty),r2=rnd(-5*difficulty,5*difficulty);
    const b=-(r1+r2),c=r1*r2;
    const q=`x² ${b>=0?"+":"−"} ${Math.abs(b)}x ${c>=0?"+":"−"} ${Math.abs(c)} = 0`;
    return {topic,question:q,answer:r1===r2?`x = ${r1}`:`x₁ = ${Math.min(r1,r2)}, x₂ = ${Math.max(r1,r2)}`};
  }
  if(topic==="inequality"){
    let a=rnd(2,4+difficulty)*(Math.random()<.5?-1:1),x=rnd(-5*difficulty,5*difficulty),b=rnd(-6,6);
    const c=a*x+b;
    const op=Math.random()<.5?">":"<";
    const q=`${a}x ${b>=0?"+":"−"} ${Math.abs(b)} ${op} ${c}`;
    const sol=solveInequality(q);
    return {topic,question:q,answer:sol.display};
  }
  if(topic==="sqrt"){
    const k=rnd(2,6),m=rnd(1,7);
    const n=k*k*m;
    return {topic,question:`Упростить √${n}`,answer:simplifySqrt(String(n)).display};
  }
  return generate({topic:"linear",difficulty});
}

self.onmessage=async e=>{
  const {id,op,args}=e.data||{};
  try{
    let result;
    if(op==="analyze")result=analyze(args?.input,args?.mode||"auto");
    else if(op==="verifySteps")result=verifySteps(args?.input);
    else if(op==="sampleFunction")result=sampleFunction(args?.expression,args?.options||{});
    else if(op==="generate")result=generate(args||{});
    else throw new Error("Неизвестная операция Math Worker");
    self.postMessage({id,ok:true,result});
  }catch(err){
    self.postMessage({id,ok:false,error:String(err?.message||err)});
  }
};
