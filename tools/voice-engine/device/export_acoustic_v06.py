"""Локальный экспорт акустических модулей; изменения только в памяти процесса."""
import json
import types
import numpy as np
import torch
import torch.nn.functional as F
import onnx
import onnxruntime as ort
from onnx import numpy_helper as N, helper as H
from onnxruntime.capi._pybind_state import quantize_matmul_4bits

class Acoustic(torch.nn.Module):
    def __init__(self, model):
        super().__init__()
        self.flow = model.s3gen.flow
        ref = model.conds.gen
        self.register_buffer('prompt', ref['prompt_token'].long())
        self.register_buffer('features', ref['prompt_feat'].transpose(1,2))
        self.register_buffer('speaker', self.flow.spk_embed_affine_layer(F.normalize(ref['embedding'],dim=1)))
    def forward(self, speech_tokens):
        tokens = torch.cat((self.prompt, speech_tokens),dim=1)
        lengths = torch.ones(1,dtype=torch.int64)*tokens.shape[1]
        embedded = self.flow.input_embedding(tokens)
        hidden, _ = self.flow.encoder(embedded, lengths)
        mu = self.flow.encoder_proj(hidden).transpose(1,2)
        cond = torch.cat((self.features, torch.zeros_like(mu[:,:,self.features.shape[2]:])),dim=2)
        return mu, cond

class FlowStep(torch.nn.Module):
    def __init__(self, model, acoustic):
        super().__init__()
        self.estimator = model.s3gen.flow.decoder.estimator
        self.register_buffer('speaker',acoustic.speaker.detach())
    def forward(self, noise, mu, cond, time):
        velocities = self.estimator(x=torch.cat((noise,noise),0),
            mask=torch.ones_like(noise[:,:1]).repeat(2,1,1),
            mu=torch.cat((mu,torch.zeros_like(mu)),0),
            t=time.repeat(2),spks=torch.cat((self.speaker,torch.zeros_like(self.speaker)),0),
            cond=torch.cat((cond,torch.zeros_like(cond)),0))
        return 1.7*velocities[:1] - 0.7*velocities[1:]

class RealFFT(torch.nn.Module):
    """Real convolution DFT/overlap-add; checked against torch's complex FFT."""
    def __init__(self, window, hop):
        super().__init__()
        n=len(window); self.trim=n//2; self.hop=hop
        phase=2*torch.pi*torch.arange(n//2+1)[:,None]*torch.arange(n)[None,:]/n
        cos, sin=torch.cos(phase), -torch.sin(phase)
        self.register_buffer('forward_kernel',torch.cat((cos,sin),0)[:,None,:]*window)
        factors=torch.full((n//2+1,1),2/n); factors[0]=1/n; factors[-1]=1/n
        self.register_buffer('inverse_kernel',torch.cat((cos*factors,sin*factors),0)[:,None,:]*window)
        self.register_buffer('envelope',window.square()[None,None,:])
        self.bins=n//2+1
    def fft(self,x):
        spec=F.conv1d(F.pad(x[:,None,:],(self.trim,self.trim),mode='reflect'),self.forward_kernel,stride=self.hop)
        return spec[:,:self.bins],spec[:,self.bins:]
    def inverse(self,magnitude,phase):
        mag=magnitude.clamp(max=100)
        parts=torch.cat((mag*torch.cos(phase),mag*torch.sin(phase)),dim=1)
        wave=F.conv_transpose1d(parts,self.inverse_kernel,stride=self.hop)
        env=F.conv_transpose1d(torch.ones_like(parts[:,:1]),self.envelope,stride=self.hop)
        return (wave/env.clamp(min=1e-8))[:,0,self.trim:-self.trim]

class Source(torch.nn.Module):
    def __init__(self, original):
        super().__init__()
        self.linear=original.l_linear; self.tanh=original.l_tanh
        s=original.l_sin_gen
        self.sr=s.sampling_rate; self.amp=s.sine_amp; self.noise_std=s.noise_std
        self.threshold=s.voiced_threshold
        self.register_buffer('harmonics',torch.arange(1,s.harmonic_num+2).float()[None,:,None])
    def forward(self,f0):
        f0=f0.transpose(1,2)
        theta=2*torch.pi*torch.remainder(torch.cumsum(f0*self.harmonics/self.sr,dim=-1),1)
        voiced=(f0>self.threshold).float()
        signal=self.amp*torch.sin(theta+self.phases)*voiced
        signal=signal+(voiced*self.noise_std+(1-voiced)*self.amp/3)*self.noise
        merged=self.tanh(self.linear(signal.transpose(1,2)))
        return merged, torch.zeros_like(f0).transpose(1,2), voiced.transpose(1,2)

class Vocoder(torch.nn.Module):
    def __init__(self, original):
        super().__init__()
        self.vocoder=original
        self.fft=RealFFT(original.stft_window,original.istft_params['hop_len'])
        self.source=Source(original.m_source)
        original.m_source=self.source
        original._stft=types.MethodType(lambda _,x:self.fft.fft(x),original)
        original._istft=types.MethodType(lambda _,mag,phase:self.fft.inverse(mag,phase),original)
    def forward(self, mel, source_noise, source_phases):
        self.source.noise=source_noise; self.source.phases=source_phases
        waveform,_=self.vocoder.inference(mel)
        return waveform

def compact_matmuls(model):
    """Quantize only constant two-dimensional linear weights; keep convolutions FP32."""
    initializers={v.name:v for v in model.graph.initializer}
    additions=[]; replaced=set(); nodes=[]
    for node in model.graph.node:
        weight=initializers.get(node.input[1]) if node.op_type=='MatMul' else None
        if weight is None or len(weight.dims)!=2:
            nodes.append(node); continue
        array=N.to_array(weight).astype(np.float32)
        k,n=array.shape; block=32; count=(k+block-1)//block
        if k%block or k*n<16384:
            nodes.append(node); continue
        name=weight.name
        if name not in replaced:
            packed=np.zeros((n,count,block//2),np.uint8)
            scales=np.zeros((n,count),np.float32)
            zero=np.zeros((n,(count+1)//2),np.uint8)
            quantize_matmul_4bits(packed,array,scales,zero,block,n,k,True)
            additions.extend([N.from_array(packed,name+'.q4'),N.from_array(scales,name+'.scales')])
            replaced.add(name)
        nodes.append(H.make_node('MatMulNBits',[node.input[0],name+'.q4',name+'.scales'],list(node.output),name=node.name,
                                 domain='com.microsoft',K=k,N=n,bits=4,block_size=block))
    del model.graph.node[:]; model.graph.node.extend(nodes)
    # Preserve shared weights if another node still uses the original value.
    used={v for node in nodes for v in node.input}
    kept=[v for v in model.graph.initializer if v.name not in replaced or v.name in used]
    del model.graph.initializer[:]; model.graph.initializer.extend(kept+additions)
    model.opset_import.append(H.make_opsetid('com.microsoft',1))
    return model

def externalize(model,directory,prefix):
    offset=0; index=0; stream=None
    for tensor in model.graph.initializer:
        raw=tensor.raw_data
        if len(raw)<1024: continue
        if stream is None or offset+len(raw)>32*1024*1024:
            if stream: stream.close()
            index+=1; offset=0
            stream=(directory/('%s.weights-%02d.bin'%(prefix,index))).open('wb')
        stream.write(raw)
        onnx.external_data_helper.set_external_data(tensor,location=Path(stream.name).name,offset=offset,length=len(raw))
        tensor.ClearField('raw_data'); offset+=len(raw)
    if stream: stream.close()

def export_acoustic(model,directory):
    from pathlib import Path
    torch.manual_seed(1729)
    acoustic=Acoustic(model).eval(); flow=FlowStep(model,acoustic).eval(); vocoder=Vocoder(model.s3gen.mel2wav).eval()
    # FFT checks use varying lengths, not just the tracing shape.
    fft_errors=[]
    for length in [960,1920,3840]:
        x=torch.randn(1,length)*0.01
        real,imag=vocoder.fft.fft(x)
        expected=torch.stft(x,16,4,16,window=model.s3gen.mel2wav.stft_window,return_complex=True)
        error=max(float((real-expected.real).abs().max()),float((imag-expected.imag).abs().max()))
        inverse=vocoder.fft.inverse(torch.abs(expected),torch.angle(expected))
        reconstructed=torch.istft(expected,16,4,16,window=model.s3gen.mel2wav.stft_window)
        inverse_error=float((inverse-reconstructed).abs().max())
        assert error<1e-5 and inverse_error<1e-5,(error,inverse_error)
        fft_errors.append([length,error,inverse_error])
    tokens=torch.randint(0,6561,(1,64),dtype=torch.int64)
    with torch.inference_mode():
        mu,cond=acoustic(tokens)
    mel=torch.randn(1,80,64)
    specs=[('acoustic_encoder',acoustic,(tokens,),['speech_tokens'],['mu','cond'],
            {'speech_tokens':{1:'Tokens'},'mu':{2:'Frames'},'cond':{2:'Frames'}}),
           ('flow_step',flow,(torch.randn_like(mu),mu,cond,torch.tensor([0.2])),['noise','mu','cond','time'],['velocity'],
            {'noise':{2:'Frames'},'mu':{2:'Frames'},'cond':{2:'Frames'},'velocity':{2:'Frames'}}),
           ('vocoder',vocoder,(mel,torch.randn(1,9,64*480),torch.zeros(1,9,1)),['mel','source_noise','source_phases'],['waveform'],
            {'mel':{2:'Frames'},'source_noise':{2:'Samples'},'waveform':{1:'Samples'}})]
    for name,module,example,inputs,outputs,axes in specs:
        print('Экспорт',name,flush=True)
        temporary=directory/(name+'.fp32.onnx')
        torch.onnx.export(module,example,str(temporary),dynamo=False,opset_version=17,
                          input_names=inputs,output_names=outputs,dynamic_axes=axes,do_constant_folding=True)
        exported=compact_matmuls(onnx.load(str(temporary)))
        externalize(exported,directory,name)
        target=directory/(name+'.onnx')
        onnx.save(exported,str(target)); onnx.checker.check_model(str(target))
        temporary.unlink()
    (directory/'export_checks.json').write_text(json.dumps({'fft_parity':fft_errors,'status':'inference_checks_required'}),encoding='utf-8')

from pathlib import Path
