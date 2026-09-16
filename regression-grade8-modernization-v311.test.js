"use strict";
const fs=require("fs"),path=require("path"),vm=require("vm"),assert=require("assert");
const root=process.argv[2]||__dirname;
const read=n=>fs.readFileSync(path.join(root,n),"utf8");
function extractObj(file,name){
  const s=read(file);let i=s.indexOf(`const ${name}`);assert(i>=0,`missing ${name}`);i=s.indexOf("=",i)+1;while(/\s/.test(s[i]))i++;
  const open=s[i],close=open==="{"?"}":"]";let depth=0,q=null,esc=false,td=0;
  for(let j=i;j<s.length;j++){
    const c=s[j],n=s[j+1];
    if(q){if(esc){esc=false;continue}if(c==="\\"){esc=true;continue}if(q==="`"){if(c==="`"&&td===0){q=null;continue}if(c==="$"&&n==="{"){td++;j++;continue}if(c==="}"&&td>0){td--;continue}}else if(c===q){q=null;continue}continue}
    if(c==='"'||c==="'"||c==="`"){q=c;continue}if(c===open)depth++;if(c===close){depth--;if(depth===0)return(new Function("return ("+s.slice(i,j+1)+")"))();}
  }
  throw new Error(`unclosed ${name}`);
}
const chapters=extractObj("app.js","chapters");
const lessonData=extractObj("app.js","lessonData");
Object.assign(lessonData,extractObj("course-v1.js","v1Lessons"));
const enh=extractObj("chapter1-v02.js","chapterEnhance");
for(const [id,e] of Object.entries(enh)){
  const d=lessonData[id];Object.assign(d,{goals:e.goals,formula:e.formula,quick:e.quick,summary:e.summary,challenge:e.challenge,interactive:e.interactive||null});
  d.examples=[d.example,e.extraExample];d.exercises=[...(d.exercises||[]),...(e.extraExercises||[])];
}
function extractAssignment(file,marker){
  const s=read(file);let i=s.indexOf(marker);assert(i>=0,`missing ${marker}`);i=s.indexOf("=",i)+1;while(/\s/.test(s[i]))i++;
  const open=s[i],close=open==="{"?"}":"]";let depth=0,q=null,esc=false,td=0;
  for(let j=i;j<s.length;j++){const c=s[j],n=s[j+1];if(q){if(esc){esc=false;continue}if(c==="\\"){esc=true;continue}if(q==="`"){if(c==="`"&&td===0){q=null;continue}if(c==="$"&&n==="{"){td++;j++;continue}if(c==="}"&&td>0){td--;continue}}else if(c===q){q=null;continue}continue}if(c==='"'||c==="'"||c==="`"){q=c;continue}if(c===open)depth++;if(c===close){depth--;if(depth===0)return(new Function("return ("+s.slice(i,j+1)+")"))();}}throw new Error(`unclosed ${marker}`);
}
const curriculum=extractAssignment("platform-catalog-v300.js","window.KitsuneCurriculum");
const context={window:{KitsuneTheoryContent:{},KitsuneCurriculum:curriculum},chapters,lessonData,structuredClone:global.structuredClone,console};
context.window.window=context.window;vm.createContext(context);
vm.runInContext(read("platform-content-grade8-algebra-v311.js"),context,{filename:"platform-content-grade8-algebra-v311.js"});
vm.runInContext(read("platform-content-grade8-frp-v311.js"),context,{filename:"platform-content-grade8-frp-v311.js"});
const out=context.window.KitsuneTheoryContent;
const legacyIds=chapters.flatMap(ch=>ch.topics.map(t=>t.id));
assert.strictEqual(legacyIds.length,51,"legacy lesson count");
assert.strictEqual(context.window.KitsuneGrade8Modernization.count,51,"modernization count");
for(const id of legacyIds){assert(out[`grade8:${id}`],`missing modernized ${id}`)}
const supplementIds=["g8-a7-1","g8-a7-2","g8-a7-3","g8-a7-4","g8-a8-1","g8-a8-2","g8-a8-3","g8-a8-4","g8-a8-5","g8-a9-1","g8-a9-2","g8-a9-3"];
for(const id of supplementIds)assert(out[`grade8:${id}`],`missing FRP supplement ${id}`);
const allIds=[...legacyIds,...supplementIds];
const required=["title","lead","levels","formula","remember","why","mistake","goals","quick","examples","exercises","challenge","summary","voice"];
const words=s=>String(s||"").trim().split(/\s+/).filter(Boolean).length;
for(const id of allIds){
  const d=out[`grade8:${id}`];for(const k of required)assert(d[k] && (!Array.isArray(d[k])||d[k].length),`${id}: ${k}`);
  assert(d.levels.simple&&d.levels.school&&d.levels.deep,`${id}: three levels`);
  assert(words(d.levels.simple)>=12,`${id}: simple too short (${words(d.levels.simple)})`);
  assert(words(d.levels.school)>=15,`${id}: school too short (${words(d.levels.school)})`);
  assert(words(d.levels.deep)>=24,`${id}: deep too short (${words(d.levels.deep)})`);
  assert(d.examples.length>=2,`${id}: examples`);assert(d.exercises.length>=3,`${id}: exercises`);
  assert(Array.isArray(d.quick.options)&&d.quick.options.length>=2,`${id}: quick options`);
  assert(Number.isInteger(d.quick.correct)&&d.quick.correct>=0&&d.quick.correct<d.quick.options.length,`${id}: quick correct index`);
  for(const ex of d.examples)assert(Array.isArray(ex.steps)&&ex.steps.length>=2,`${id}: worked-example steps`);
  assert(Array.isArray(d.challenge.a),`${id}: challenge answers array`);
  for(const e of d.exercises)assert(Array.isArray(e.a),`${id}: exercise answers array`);
  assert(words(d.voice)>=25,`${id}: voice too short`);
}
for(const field of ["lead","simple","school","deep"]){
  const seen=new Map();
  for(const id of allIds){const d=out[`grade8:${id}`],raw=field==="lead"?d.lead:d.levels[field],key=String(raw||"").replace(/\s+/g," ").trim().toLowerCase();assert(!seen.has(key),`${field} duplicate: ${id} and ${seen.get(key)}`);seen.set(key,id)}
}
const grade8=curriculum.tracks.find(x=>x.id==="grade8"),alg=grade8.sections.find(x=>x.id==="g8-ready");
assert(alg&&alg.title==="Алгебра");assert.strictEqual(alg.chapters.length,9,"6 legacy chapters + 3 FRP chapters");
assert.strictEqual(alg.chapters.slice(0,6).reduce((n,c)=>n+c.topics.length,0),51);
assert.strictEqual(alg.chapters.slice(6).reduce((n,c)=>n+c.topics.length,0),12);
const index=read("index.html");assert(index.includes("platform-content-grade8-algebra-v311.js"));assert(index.includes("platform-content-grade8-frp-v311.js"));
// Mathematical anchors.
assert(out["grade8:2-16"].formula.includes("√(a²)=|a|"));
assert(out["grade8:3-21"].formula.includes("D=b²−4ac"));
assert(out["grade8:3-23"].formula.includes("x₁+x₂=−b/a"));
assert(out["grade8:4-35"].formula.includes("c<0"));
assert(out["grade8:5-46"].formula.includes("0≤{x}<1"));
assert(out["grade8:6-47"].formula.includes("a⁻ⁿ=1/aⁿ"));
assert(out["grade8:g8-a7-1"].formula.includes("mod m"));
assert(out["grade8:g8-a7-4"].formula.includes("1/√A: A>0"));
assert(out["grade8:g8-a8-1"].formula.includes("y = ax²"));
assert(out["grade8:g8-a8-4"].formula.includes("|x|"));
assert(out["grade8:g8-a9-3"].formula.includes("A(a)x>B(a)"));
console.log(`PASS: Grade 8 algebra modernized: ${legacyIds.length}/51 legacy IDs preserved + ${supplementIds.length} FRP supplements, ${allIds.length} authored algebra topics total`);
