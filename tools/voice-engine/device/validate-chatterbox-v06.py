"""Синтез только экспортированными ONNX на CPU, без PyTorch/CUDA/сети."""
import argparse
import gc
import hashlib
import json
from pathlib import Path
import sys
import time
import numpy as np
import onnxruntime as ort
import soundfile as sf
from tokenizers import Tokenizer

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--package',required=True)
    ap.add_argument('--output',required=True)
    ap.add_argument('--text',default='Привет! Я Китсуне. Давай решим новую задачу вместе.')
    args=ap.parse_args()
    package=Path(args.package); base=package/'model'; output=Path(args.output)
    output.mkdir(parents=True,exist_ok=True)
    manifest=json.loads((package/'manifest.json').read_text('utf-8'))
    for item in manifest['files']:
        file=package/item['path']; data=file.read_bytes()
        assert len(data)==item['bytes'] and hashlib.sha256(data).hexdigest()==item['sha256'],file
    config=json.loads((base/'config.json').read_text('utf-8'))
    tokenizer=Tokenizer.from_str(json.dumps(config['tokenizer']))
    text=__import__('unicodedata').normalize('NFKD',args.text.lower())
    text=text.replace(' ','[SPACE]')
    ids=[config['start_text']]+tokenizer.encode('[ru]'+text).ids+[config['stop_text']]
    tables={}
    for name in ['text_embeddings','speech_embeddings','text_positions','speech_positions']:
        tables[name]=np.fromfile(base/(name+'.int8'),dtype=np.int8).reshape(-1,1024).astype(np.float32)*np.fromfile(base/(name+'.scales'),dtype=np.float32)[:,None]
    text_emb=tables['text_embeddings'][ids]+tables['text_positions'][np.arange(len(ids))]
    bos=tables['speech_embeddings'][config['start_speech']]+tables['speech_positions'][0]
    condition=np.asarray(config['conditioning'],np.float32)[0]
    conditional=np.concatenate((condition,text_emb,bos[None],bos[None]),0)
    unconditional=np.concatenate((condition,np.zeros_like(text_emb),bos[None],bos[None]),0)
    embeds=np.stack((conditional,unconditional))
    options=ort.SessionOptions(); options.intra_op_num_threads=4; options.enable_cpu_mem_arena=False
    options.log_severity_level=3
    def session(name):
        return ort.InferenceSession(str(base/(name+'.onnx')),sess_options=options,providers=['CPUExecutionProvider'])
    started=time.perf_counter()
    lm=session('language_model')
    print('ONNX CPU: языковая модель',flush=True)
    cache={f'layer{i}.past_{suffix}':np.empty((2,16,0,64),np.float32) for i in range(config['layers']) for suffix in ['k','v']}
    rng=np.random.default_rng(1729); tokens=[]; past=0; stopped=False
    inv=np.asarray(config['rope_inv_freq'],np.float32)
    for step in range(300):
        length=embeds.shape[1]
        angles=np.arange(past,past+length,dtype=np.float32)[:,None]*inv[None,:]
        angles=np.concatenate((angles,angles),axis=1)
        mask=np.where(np.arange(past+length)[None,:]<=np.arange(past,past+length)[:,None],0,-10000).astype(np.float32)
        feeds=dict(embeddings=embeds,mask=mask[None,None],rope_cos=np.cos(angles)[None,None],rope_sin=np.sin(angles)[None,None],**cache)
        result=dict(zip([o.name for o in lm.get_outputs()],lm.run(None,feeds)))
        logits=result['logits'][0,0]+0.5*(result['logits'][0,0]-result['logits'][1,0])
        for token in set(tokens+[config['start_speech']]):
            logits[token]=logits[token]*2 if logits[token]<0 else logits[token]/2
        logits[config['start_speech']]=-np.inf
        logits[6563:]=-np.inf
        probabilities=np.exp((logits-np.max(logits))/0.65)
        probabilities[probabilities<probabilities.max()*0.05]=0
        probabilities/=probabilities.sum()
        token=int(rng.choice(len(probabilities),p=probabilities.astype(np.float64)/probabilities.sum(dtype=np.float64)))
        cache={f'layer{i}.past_{s}':result[f'layer{i}.present_{s}'] for i in range(config['layers']) for s in ['k','v']}
        past+=length
        if token==config['stop_speech']:
            stopped=True; break
        tokens.append(token)
        embed=tables['speech_embeddings'][token]+tables['speech_positions'][step+1]
        embeds=np.stack((embed,embed))[:,None,:]
        if step%25==0: print('Токены',step+1,flush=True)
    assert stopped and len(tokens)>10,('Не завершена фраза',len(tokens))
    del lm,cache,result,feeds,tables; gc.collect()
    tokens_seconds=time.perf_counter()-started
    acoustic=session('acoustic_encoder')
    # Dynamic shapes must really work for lengths other than the tracing length 64.
    shape_checks=[]
    for length in [17,49,len(tokens)]:
        outputs=acoustic.run(None,{'speech_tokens':np.asarray([tokens[:length] if length<=len(tokens) else tokens+[1]*(length-len(tokens))],np.int64)})
        assert outputs[0].shape[2]==2*(250+length),outputs[0].shape
        assert np.isfinite(outputs[0]).all() and outputs[0].shape==outputs[1].shape
        shape_checks.append([length,list(outputs[0].shape)])
    mu,cond=acoustic.run(None,{'speech_tokens':np.asarray([tokens],np.int64)})
    del acoustic;gc.collect()
    flow=session('flow_step')
    noise=rng.standard_normal(mu.shape).astype(np.float32)
    span=1-np.cos(np.linspace(0,1,11,dtype=np.float32)*np.pi/2)
    print('ONNX CPU: акустика',flush=True)
    for t,end in zip(span[:-1],span[1:]):
        velocity=flow.run(None,dict(noise=noise,mu=mu,cond=cond,time=np.array([t],np.float32)))[0]
        assert velocity.shape==noise.shape and np.isfinite(velocity).all()
        noise+=(end-t)*velocity
    mel=noise[:,:,cond.shape[2]-2*len(tokens):]
    del flow,mu,cond;gc.collect()
    vocoder=session('vocoder')
    phases=rng.uniform(-np.pi,np.pi,(1,9,1)).astype(np.float32); phases[:,0]=0
    source=rng.standard_normal((1,9,mel.shape[2]*480)).astype(np.float32)
    wave=vocoder.run(None,dict(mel=mel,source_noise=source,source_phases=phases))[0][0]
    # Same 20ms silence + 20ms fade-in as the native generator.
    fade=np.concatenate((np.zeros(480),(np.cos(np.linspace(np.pi,0,480))+1)/2))
    wave[:960]*=fade.astype(np.float32)
    rms=float(np.sqrt(np.mean(wave**2))); duration=len(wave)/24000
    assert np.isfinite(wave).all() and rms>0.002 and duration>1,(rms,duration)
    wav=output/'Kitsune_ONNX_CPU.wav';sf.write(wav,wave,24000,subtype='PCM_16')
    report=dict(status='native_cpu_generation_passed',text=args.text,tokens=len(tokens),duration_seconds=duration,
                generation_seconds=time.perf_counter()-started,language_model_seconds=tokens_seconds,rms=rms,
                dynamic_shapes=shape_checks,onnxruntime=ort.__version__,execution_provider='CPUExecutionProvider',
                audio_sha256=hashlib.sha256(wav.read_bytes()).hexdigest(),
                browser_wasm='not_tested',Android='not_tested',iOS='not_tested',listening='pending')
    (output/'onnx_cpu_validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(report,ensure_ascii=False,indent=2),flush=True)

if __name__=='__main__':main()
