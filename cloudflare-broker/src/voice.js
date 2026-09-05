const MODEL="qwen3-tts-vd-2026-01-26";
const DESCRIPTION="An original fictional fox tutor, a warm youthful androgynous voice with a light bright timbre, clear Russian diction, calm medium-slow pace and gently playful intonation. Patient, encouraging and articulate, never squeaky. Explain algebra with small pauses. Do not imitate any real person or existing character.";
const PREVIEW="Привет! Я Китсуне. Давай разберём алгебру вместе. Не торопись: сначала поймём условие, а затем проверим каждый шаг.";
export function voiceText(text){
  return typeof text==="string"&&text.length>0&&text.length<=800&&
    !/https?:|www\.|@|\+?\d[\d ()-]{8,}\d|меня зовут|мой адрес|мой пароль/i.test(text);
}
async function post(env,path,body,signal){
  const base=new URL(env.QWEN_API_BASE);
  const r=await fetch(new URL(path,base.origin),{method:"POST",signal,
    headers:{Authorization:`Bearer ${env.DASHSCOPE_API_KEY}`,"Content-Type":"application/json"},
    body:JSON.stringify(body),cf:{cacheTtl:0,cacheEverything:false}});
  if(!r.ok)throw new Error("voice_unavailable");
  return r.json();
}
export async function designVoice(env,signal){
  const result=await post(env,"/api/v1/services/audio/tts/customization",{
    model:"qwen-voice-design",input:{action:"create",target_model:MODEL,preferred_name:"kitsune",voice_prompt:DESCRIPTION,preview_text:PREVIEW},
    parameters:{sample_rate:24000,response_format:"wav"}
  },signal);
  const voice=result.output?.voice,preview=result.output?.preview_audio?.data;
  if(typeof voice!=="string"||voice.length>200)throw new Error("invalid_voice");
  return {voiceId:voice,preview:typeof preview==="string"&&preview.length<4000000?preview:""};
}
export async function synthesize(env,text,signal){
  if(!env.QWEN_VOICE_ID)throw new Error("voice_not_configured");
  const result=await post(env,"/api/v1/services/aigc/multimodal-generation/generation",{
    model:MODEL,input:{text,voice:env.QWEN_VOICE_ID},parameters:{language_type:"Russian"}
  },signal);
  const url=new URL(result.output?.audio?.url||"");
  if(url.protocol!=="https:"||!/(?:^|\.)(?:aliyuncs\.com|alicdn\.com)$/.test(url.hostname))throw new Error("invalid_audio_url");
  const response=await fetch(url,{signal,redirect:"error",cf:{cacheTtl:0,cacheEverything:false}});
  if(!response.ok||!response.body)throw new Error("audio_unavailable");
  const reader=response.body.getReader();let size=0;const chunks=[];
  try{while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>3000000)throw new Error("audio_too_large");chunks.push(part.value)}}
  finally{await reader.cancel().catch(()=>{});reader.releaseLock()}
  const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length}
  let binary="";for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
  return {audio:btoa(binary),mime:"audio/wav"};
}
