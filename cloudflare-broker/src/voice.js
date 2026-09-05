const MODEL="qwen3-tts-vd-2026-01-26";
const DESCRIPTION="An original fictional fox tutor, a warm youthful androgynous voice with a light bright timbre, clear Russian diction, calm medium-slow pace and gently playful intonation. Patient, encouraging and articulate, never squeaky. Explain algebra with small pauses. Do not imitate any real person or existing character.";
const PREVIEW="Привет! Я Китсуне. Давай разберём алгебру вместе. Не торопись: сначала поймём условие, а затем проверим каждый шаг.";

export function voiceText(text){
  return typeof text==="string"&&text.length>0&&text.length<=800&&
    !/https?:|www\.|@|\+?\d[\d ()-]{8,}\d|меня зовут|мой адрес|мой пароль/i.test(text);
}

function safeProviderError(status,result={}){
  const code=String(result?.code||"").slice(0,80);
  const message=String(result?.message||"").slice(0,160);
  console.warn("[Kitsune Qwen Voice upstream]",status,code,message);
  if(status===401||/unauthor|invalid.?api.?key/i.test(code+" "+message))return "voice_auth_failed";
  if(status===403||/permission|forbidden|access/i.test(code+" "+message))return "voice_permission_denied";
  if(/voice/i.test(code+" "+message)&&/invalid|not.?found|mismatch/i.test(code+" "+message))return "voice_id_mismatch";
  if(/model/i.test(code+" "+message)&&/invalid|not.?found|mismatch/i.test(code+" "+message))return "voice_model_mismatch";
  if(/region/i.test(code+" "+message))return "voice_region_mismatch";
  if(status===429)return "voice_rate_limited";
  if(status>=500)return "voice_provider_unavailable";
  return "voice_request_rejected";
}

async function post(env,path,body,signal){
  const base=new URL(env.QWEN_API_BASE);
  const response=await fetch(new URL(path,base.origin),{
    method:"POST",
    signal,
    headers:{
      Authorization:`Bearer ${env.DASHSCOPE_API_KEY}`,
      "Content-Type":"application/json"
    },
    body:JSON.stringify(body),
    cf:{cacheTtl:0,cacheEverything:false}
  });

  const text=await response.text();
  let result={};
  try{result=text?JSON.parse(text):{}}catch{}

  if(!response.ok)throw new Error(safeProviderError(response.status,result));
  return result;
}

export async function designVoice(env,signal){
  const result=await post(env,"/api/v1/services/audio/tts/customization",{
    model:"qwen-voice-design",
    input:{
      action:"create",
      target_model:MODEL,
      preferred_name:"kitsune",
      voice_prompt:DESCRIPTION,
      preview_text:PREVIEW,
      language:"ru"
    },
    parameters:{sample_rate:24000,response_format:"wav"}
  },signal);

  const voice=result.output?.voice;
  const preview=result.output?.preview_audio?.data;
  if(typeof voice!=="string"||voice.length>200)throw new Error("invalid_voice");
  return {voiceId:voice,preview:typeof preview==="string"&&preview.length<4000000?preview:""};
}

function approvedAudioUrl(raw){
  let url;
  try{url=new URL(String(raw||""))}catch{return null}

  const approved=/(?:^|\.)(?:aliyuncs\.com|alicdn\.com)$/.test(url.hostname);
  if(!approved)return null;

  /* Qwen-TTS non-streaming responses may return an http:// OSS URL even
     though the same Alibaba OSS object is available over HTTPS.
     Never fetch it in plaintext: upgrade ONLY an allow-listed Alibaba host. */
  if(url.protocol==="http:")url.protocol="https:";
  if(url.protocol!=="https:")return null;
  return url;
}

export async function synthesize(env,text,signal){
  if(!env.QWEN_VOICE_ID)return {error:"voice_not_configured"};

  try{
    const result=await post(
      env,
      "/api/v1/services/aigc/multimodal-generation/generation",
      {
        model:MODEL,
        input:{
          text,
          voice:env.QWEN_VOICE_ID,
          language_type:"Russian"
        }
      },
      signal
    );

    const audioUrl=approvedAudioUrl(result.output?.audio?.url);
    if(!audioUrl)return {error:"invalid_audio_url"};

    const response=await fetch(audioUrl,{
      signal,
      redirect:"follow",
      cf:{cacheTtl:0,cacheEverything:false}
    });
    if(!response.ok||!response.body)return {error:"audio_unavailable"};

    const reader=response.body.getReader();
    let size=0;
    const chunks=[];
    try{
      while(true){
        const part=await reader.read();
        if(part.done)break;
        size+=part.value.length;
        if(size>3000000)return {error:"audio_too_large"};
        chunks.push(part.value);
      }
    }finally{
      await reader.cancel().catch(()=>{});
      reader.releaseLock();
    }

    const bytes=new Uint8Array(size);
    let offset=0;
    for(const chunk of chunks){
      bytes.set(chunk,offset);
      offset+=chunk.length;
    }

    let binary="";
    for(let i=0;i<bytes.length;i+=8192){
      binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
    }
    return {audio:btoa(binary),mime:"audio/wav"};
  }catch(error){
    const code=String(error?.message||"voice_unavailable").slice(0,80);
    console.warn("[Kitsune Character Voice]",code);
    return {error:code};
  }
}
