"""Экспорт единственного голоса Kitsune из локального Chatterbox; без загрузок.

Исходные окружения, веса и WAV открываются только для чтения. Экспортируется
кандидат, а не утверждённый релиз: проверки тембра и телефонов обязательны.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import sys
import time

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--studio-packages', required=True)
    ap.add_argument('--checkpoint', required=True)
    ap.add_argument('--reference', required=True)
    ap.add_argument('--output', required=True)
    args = ap.parse_args()
    output = Path(args.output).resolve()
    if (output/'model').exists():
        ap.error('Каталог model уже существует. Для нового экспорта укажите новую папку.')
    expected_ref='50e9ea8ff8e7b3513c7b41080c36ac3ed82a333617d46195da081da4feae77c4'
    if hashlib.sha256(Path(args.reference).read_bytes()).hexdigest()!=expected_ref:
        ap.error('Эталон Kitsune не совпадает с утверждённым WAV.')
    output.mkdir(parents=True, exist_ok=True)
    os.environ.update(PYTHONDONTWRITEBYTECODE='1', HF_HUB_OFFLINE='1',
                      TRANSFORMERS_OFFLINE='1', HF_HUB_DISABLE_TELEMETRY='1',
                      NUMBA_CACHE_DIR=str(output / 'numba-cache'))
    sys.dont_write_bytecode = True
    sys.path.append(args.studio_packages)
    import numpy as np
    import torch
    import onnx
    from onnx import helper as H, numpy_helper as N, TensorProto as T
    from onnxruntime.capi._pybind_state import quantize_matmul_4bits
    from chatterbox.mtl_tts import ChatterboxMultilingualTTS, Conditionals
    torch.set_num_threads(4)
    print('Загрузка локальных весов', flush=True)
    model = ChatterboxMultilingualTTS.from_local(args.checkpoint, 'cpu')
    model.prepare_conditionals(args.reference, exaggeration=0.5)
    t3 = model.t3
    directory = output / 'model'
    directory.mkdir(exist_ok=True)
    started = time.perf_counter()
    nodes, initializers = [], []
    serial = [0]
    def const(name, array):
        initializers.append(N.from_array(np.asarray(array), name=name))
        return name
    def op(kind, *inputs, **attrs):
        serial[0] += 1
        name = 'n' + str(serial[0])
        nodes.append(H.make_node(kind, list(inputs), [name], name=name, **attrs))
        return name
    def mm(x, module, name):
        weight = module.weight.detach().float().numpy().T.copy()
        k, n = weight.shape
        block = 32
        count = (k + block - 1) // block
        packed = np.zeros((n, count, block // 2), np.uint8)
        scales = np.zeros((n, count), np.float32)
        zeros = np.zeros((n, (count + 1) // 2), np.uint8)
        quantize_matmul_4bits(packed, weight, scales, zeros, block, n, k, True)
        return op('MatMulNBits', x, const(name+'.q4', packed),
                  const(name+'.scales', scales), domain='com.microsoft',
                  K=k, N=n, bits=4, block_size=block)
    epsilon = const('epsilon', np.array(1e-5, np.float32))
    axes = const('last_axis', np.array([-1], np.int64))
    scale = const('attention_scale', np.array(0.125, np.float32))
    half_axis = const('half_axis', np.array([3], np.int64))
    low = const('low', np.array([0], np.int64))
    mid = const('mid', np.array([32], np.int64))
    high = const('high', np.array([64], np.int64))
    shape_heads = const('shape_heads', np.array([0, 0, 16, 64], np.int64))
    shape_hidden = const('shape_hidden', np.array([0, 0, 1024], np.int64))
    last = const('last', np.array([-1], np.int64))
    def norm(x, module, name):
        mean = op('ReduceMean', op('Mul', x, x), axes, keepdims=1)
        return op('Mul', op('Div', x, op('Sqrt', op('Add', mean, epsilon))),
                  const(name, module.weight.detach().numpy()))
    def rotate(x):
        a = op('Slice', x, low, mid, half_axis)
        b = op('Slice', x, mid, high, half_axis)
        shifted = op('Concat', op('Neg', b), a, axis=3)
        return op('Add', op('Mul', x, 'rope_cos'), op('Mul', shifted, 'rope_sin'))
    x = 'embeddings'
    inputs = [H.make_tensor_value_info(x, T.FLOAT, ['B','S',1024]),
              H.make_tensor_value_info('mask', T.FLOAT, [1,1,'S','Total']),
              H.make_tensor_value_info('rope_cos', T.FLOAT, [1,1,'S',64]),
              H.make_tensor_value_info('rope_sin', T.FLOAT, [1,1,'S',64])]
    outputs = []
    for i, layer in enumerate(t3.tfmr.layers):
        print('Сжатие слоя', i+1, '/', len(t3.tfmr.layers), flush=True)
        prefix = 'layer'+str(i)
        normalized = norm(x, layer.input_layernorm, prefix+'.input_norm')
        q, k, v = [op('Transpose', op('Reshape', mm(normalized, getattr(layer.self_attn, field), prefix+'.'+field), shape_heads), perm=[0,2,1,3])
                   for field in ['q_proj','k_proj','v_proj']]
        q, k = rotate(q), rotate(k)
        for suffix in ['k','v']:
            inputs.append(H.make_tensor_value_info(prefix+'.past_'+suffix, T.FLOAT, ['B',16,'P',64]))
        k = op('Concat', prefix+'.past_k', k, axis=2)
        v = op('Concat', prefix+'.past_v', v, axis=2)
        for suffix, value in [('k',k),('v',v)]:
            output_name = prefix+'.present_'+suffix
            nodes.append(H.make_node('Identity', [value], [output_name]))
            outputs.append(H.make_tensor_value_info(output_name, T.FLOAT, ['B',16,'Total',64]))
        attention = op('MatMul', q, op('Transpose', k, perm=[0,1,3,2]))
        attention = op('Softmax', op('Add', op('Mul', attention, scale), 'mask'), axis=-1)
        context = op('Reshape', op('Transpose', op('MatMul', attention, v), perm=[0,2,1,3]), shape_hidden)
        x = op('Add', x, mm(context, layer.self_attn.o_proj, prefix+'.o_proj'))
        n = norm(x, layer.post_attention_layernorm, prefix+'.post_norm')
        gate = mm(n, layer.mlp.gate_proj, prefix+'.gate')
        gate = op('Mul', gate, op('Sigmoid', gate))
        hidden = op('Mul', gate, mm(n, layer.mlp.up_proj, prefix+'.up'))
        x = op('Add', x, mm(hidden, layer.mlp.down_proj, prefix+'.down'))
    x = norm(x, t3.tfmr.norm, 'final_norm')
    x = op('Gather', x, last, axis=1)
    logits = mm(x, t3.speech_head, 'speech_head')
    nodes.append(H.make_node('Identity', [logits], ['logits']))
    outputs.insert(0, H.make_tensor_value_info('logits', T.FLOAT, ['B',1,t3.hp.speech_tokens_dict_size]))
    graph = H.make_graph(nodes, 'KitsuneFixedVoiceLM', inputs, outputs, initializers)
    exported = H.make_model(graph, opset_imports=[H.make_opsetid('',18),H.make_opsetid('com.microsoft',1)], ir_version=10)
    # Keep every static file below GitHub's individual-file limit; avoid LFS.
    shard_size, offset, shard_index = 32*1024*1024, 0, 0
    stream = None
    for tensor in exported.graph.initializer:
        raw = tensor.raw_data
        if len(raw) < 1024:
            continue
        if stream is None or offset + len(raw) > shard_size:
            if stream: stream.close()
            shard_index += 1
            offset = 0
            stream = (directory / ('lm.weights-%02d.bin'%shard_index)).open('wb')
        stream.write(raw)
        onnx.external_data_helper.set_external_data(tensor, location=Path(stream.name).name, offset=offset, length=len(raw))
        tensor.ClearField('raw_data')
        offset += len(raw)
    if stream: stream.close()
    onnx.save(exported, str(directory/'language_model.onnx'))
    onnx.checker.check_model(str(directory/'language_model.onnx'))
    # Only one fixed Kitsune identity: no speaker encoder on the device.
    metadata = dict(schema_version=1, hidden_size=1024, layers=len(t3.tfmr.layers),
                    heads=16, head_dim=64, sample_rate=model.sr,
                    start_text=t3.hp.start_text_token, stop_text=t3.hp.stop_text_token,
                    start_speech=t3.hp.start_speech_token, stop_speech=t3.hp.stop_speech_token,
                    rope_inv_freq=t3.tfmr.rotary_emb.inv_freq.detach().tolist(),
                    tokenizer=json.loads((Path(args.checkpoint)/'grapheme_mtl_merged_expanded_v1.json').read_text('utf-8')),
                    conditioning=t3.prepare_conditioning(model.conds.t3).detach().tolist())
    for name, module in [('text_embeddings',t3.text_emb),('speech_embeddings',t3.speech_emb),
                         ('text_positions',t3.text_pos_emb.emb),('speech_positions',t3.speech_pos_emb.emb)]:
        weights=module.weight.detach().numpy()
        scales=np.maximum(np.max(np.abs(weights),axis=1)/127, 1e-12).astype(np.float32)
        quantized=np.clip(np.round(weights/scales[:,None]),-127,127).astype(np.int8)
        (directory/(name+'.int8')).write_bytes(quantized.tobytes())
        (directory/(name+'.scales')).write_bytes(scales.tobytes())
        metadata[name]={'rows':len(weights),'columns':weights.shape[1]}
    (directory/'config.json').write_text(json.dumps(metadata,ensure_ascii=False),encoding='utf-8')
    print('Языковая модель экспортирована за',round(time.perf_counter()-started,1),'сек.',flush=True)
    from export_acoustic_v06 import export_acoustic
    export_acoustic(model, directory)
    files=[]
    for file in sorted(directory.iterdir()):
        if file.is_file():
            data=file.read_bytes()
            files.append(dict(path='model/'+file.name,bytes=len(data),sha256=hashlib.sha256(data).hexdigest()))
    manifest=dict(schema_version=2,voice_identity='kitsune',
                  reference_sha256='50e9ea8ff8e7b3513c7b41080c36ac3ed82a333617d46195da081da4feae77c4',
                  status='candidate_missing_runtime',runtime_target='chatterbox-fixed-onnx-wasm',
                  files=files,validation={'devices':{},'listening':'pending'},
                  missing=['Локальный ONNX Runtime Web','Прослушивание кандидата Kitsune','Проверки Android, iOS и ПК без сети'])
    (output/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
    print('Итого модель:',sum(f['bytes'] for f in files),'байт',flush=True)

if __name__ == '__main__':
    main()
