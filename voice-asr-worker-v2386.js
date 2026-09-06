/* =====================================================================
   Kitsune v2.3.0-beta.3.8.6 · LOW MEMORY VOICE SESSION
   Audio never leaves the browser.
   ===================================================================== */

import {
  pipeline,
  env
} from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.2.0/+esm";

const VERSION="2.3.0-beta.3.8.6";

env.useBrowserCache=true;
env.allowLocalModels=false;

try{
  if(env?.backends?.onnx?.wasm){
    const mobile=/iPhone|iPad|iPod|Android|Mobile/i.test(String(navigator.userAgent||""));
    const cores=Math.max(1,Number(navigator.hardwareConcurrency||2));
    env.backends.onnx.wasm.numThreads=mobile?1:Math.min(4,cores);
    env.backends.onnx.wasm.proxy=false;
    env.backends.onnx.wasm.wasmPaths={
      mjs:"https://cdn.jsdelivr.net/npm/onnxruntime-web@1.23.2/dist/ort-wasm-simd-threaded.mjs",
      wasm:"https://cdn.jsdelivr.net/npm/onnxruntime-web@1.23.2/dist/ort-wasm-simd-threaded.wasm"
    };
  }
}catch{}

let transcriber=null;
let modelId="";
let backend="";
let loading=null;

function modelName(mode){
  return mode==="base"
    ?"onnx-community/whisper-base"
    :"onnx-community/whisper-tiny";
}

function postProgress(p){
  let progress=null;
  if(Number.isFinite(Number(p?.progress))){
    const raw=Number(p.progress);
    progress=Math.max(0,Math.min(100,raw<=1?raw*100:raw));
  }
  postMessage({
    type:"progress",
    progress,
    file:String(p?.file||p?.name||p?.status||"Загрузка").split("/").pop()
  });
}

async function disposeCurrent(){
  try{await transcriber?.dispose?.()}catch{}
  transcriber=null;
  modelId="";
  backend="";
}

async function loadModel(mode="tiny",preferred="wasm"){
  const next=modelName(mode);

  if(transcriber&&modelId===next)return;
  if(loading)return loading;

  loading=(async()=>{
    await disposeCurrent();

    /*
       beta.3.8.4 selected WebGPU on desktop. For Whisper Base that asked
       Transformers.js for fp32 encoder + q4 decoder. The q4 merged decoder
       alone is very large and can look like a frozen preparation step.

       beta.3.8.5 intentionally uses WASM/q8 for Base. It is smaller,
       predictable across Chrome/Yandex/Edge and still much more accurate
       than Tiny for Russian speech.
    */
    const device=(mode==="base")?"wasm":(preferred==="webgpu"?"webgpu":"wasm");
    const options={
      device,
      progress_callback:postProgress
    };

    if(mode==="base"){
      options.dtype="q8";
    }else if(device==="webgpu"){
      options.dtype={
        encoder_model:"fp32",
        decoder_model_merged:"q4"
      };
    }else{
      options.dtype="q8";
    }

    postMessage({
      type:"status",
      text:mode==="base"
        ?"Подготавливаю Whisper Base · компактный WASM/q8…"
        :`Подготавливаю Whisper Tiny · ${device.toUpperCase()}…`
    });

    transcriber=await pipeline(
      "automatic-speech-recognition",
      next,
      options
    );

    modelId=next;
    backend=device;

    postMessage({
      type:"ready",
      version:VERSION,
      model:modelId,
      backend
    });
  })();

  try{
    await loading;
  }finally{
    loading=null;
  }
}

self.onmessage=async event=>{
  const m=event.data||{};

  try{
    if(m.type==="load"){
      const requested=m.model==="base"?"base":"tiny";
      const preferred=m.preferred==="webgpu"?"webgpu":"wasm";

      try{
        await loadModel(requested,preferred);
      }catch(error){
        /* Desktop Base can fail on lower-memory devices. Tiny is the safe fallback. */
        if(requested==="base"){
          postMessage({
            type:"status",
            text:"Whisper Base не запустился. Переключаюсь на локальный Whisper Tiny…"
          });
          await loadModel("tiny","wasm");
          postMessage({type:"fallback",reason:String(error?.message||error)});
        }else{
          throw error;
        }
      }
      return;
    }

    if(m.type==="transcribe"){
      if(!transcriber){
        await loadModel(
          m.model==="base"?"base":"tiny",
          m.preferred==="webgpu"?"webgpu":"wasm"
        );
      }

      const samples=m.samples instanceof Float32Array
        ?m.samples
        :new Float32Array(m.samples);

      postMessage({type:"transcribing",id:m.id});

      const result=await transcriber(samples,{
        language:"russian",
        task:"transcribe",
        return_timestamps:false,
        chunk_length_s:20,
        stride_length_s:2
      });

      postMessage({
        type:"result",
        id:m.id,
        text:String(result?.text||"").trim(),
        model:modelId,
        backend
      });
      return;
    }

    if(m.type==="release"){
      await disposeCurrent();
      postMessage({type:"released"});
    }
  }catch(error){
    postMessage({
      type:m.type==="transcribe"?"resultError":"error",
      id:m.id,
      message:String(error?.message||error||"unknown_error")
    });
  }
};
