/* v1.11.4 · Same-origin Whisper module worker */
import { pipeline, env } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.2.0";

const MODEL="onnx-community/whisper-tiny";
let transcriber=null;
let loading=null;
let currentBackend="";

function post(type,data={}){ self.postMessage({type,...data}); }

/* Mobile Safari is much more reliable with single-threaded WASM for Whisper.
   WebGPU remains available to Kitsune Brain independently. */
try{
  if(env?.backends?.onnx?.wasm){
    env.backends.onnx.wasm.numThreads=1;
    env.backends.onnx.wasm.proxy=false;
  }
}catch(e){}

function progressOptions(){
  return {
    progress_callback:(p)=>{
      let progress=null;
      if(Number.isFinite(Number(p?.progress))){
        const raw=Number(p.progress);
        progress=raw<=1?raw*100:raw;
      }
      post("progress",{
        progress,
        status:String(p?.status||""),
        file:String(p?.file||p?.name||"").split("/").pop()
      });
    }
  };
}

async function createPipeline(backend){
  const options=progressOptions();
  if(backend==="webgpu"){
    options.device="webgpu";
    options.dtype={encoder_model:"fp16",decoder_model_merged:"q4"};
  }else{
    /* Explicit WASM/CPU path. q8 keeps memory lower on mobile. */
    options.device="wasm";
    options.dtype={encoder_model:"q8",decoder_model_merged:"q8"};
  }
  return pipeline("automatic-speech-recognition",MODEL,options);
}

async function load(preferred="wasm"){
  if(transcriber)return transcriber;
  if(loading)return loading;

  loading=(async()=>{
    const order=preferred==="webgpu"?["webgpu","wasm"]:["wasm"];
    let errors=[];

    for(const backend of order){
      try{
        post("status",{text:backend==="webgpu"
          ?"Подготавливаю Whisper на WebGPU…"
          :"Подготавливаю совместимый мобильный WASM-режим…"});
        transcriber=await createPipeline(backend);
        currentBackend=backend;
        post("ready",{backend:backend==="webgpu"?"WebGPU":"WASM"});
        return transcriber;
      }catch(err){
        transcriber=null;
        const msg=String(err?.message||err).slice(0,260);
        errors.push(`${backend}: ${msg}`);
        if(backend==="webgpu"){
          post("status",{text:"WebGPU backend не запустился — автоматически пробую WASM…"});
        }
      }
    }

    throw new Error(errors.join(" | ")||"Whisper backend unavailable");
  })();

  try{return await loading}
  catch(err){
    post("error",{message:String(err?.message||err)});
    throw err;
  }finally{loading=null}
}

self.onmessage=async(e)=>{
  const m=e.data||{};
  if(m.type==="load"){
    try{await load(m.preferred||"wasm")}catch(e){}
    return;
  }
  if(m.type==="transcribe"){
    const id=m.id;
    try{
      const pipe=await load(m.preferred||currentBackend||"wasm");
      post("transcribing",{id});
      const samples=new Float32Array(m.samples);
      const result=await pipe(samples,{
        language:"russian",
        task:"transcribe",
        return_timestamps:false
      });
      post("result",{id,text:String(result?.text||"").trim()});
    }catch(err){
      post("resultError",{id,message:String(err?.message||err)});
    }
  }
};
