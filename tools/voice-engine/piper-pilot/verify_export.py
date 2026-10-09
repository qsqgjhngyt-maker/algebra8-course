"""Сравнивает ONNX с обученным PyTorch на короткой, обычной и длинной фразе."""
import argparse
import json
import os
from pathlib import Path

import numpy as np
import torch
from prepare import write_json, sha256


def check(checkpoint, model_path, settings, report_path):
    from train import load_checkpoint, model_from_checkpoint
    from piper import PiperVoice
    model = model_from_checkpoint(load_checkpoint(checkpoint), settings, False).eval()
    generator = model.model_g
    generator.dec.remove_weight_norm()
    voice = PiperVoice.load(model_path, use_cuda=False)
    samples = ["Да.", "Привет!", "Приравняй знамена́тель икс плюс четыре к нулю и проверь, какое значение переменной получилось."]
    cases = []
    for text in samples:
        phones = voice.phonemize(text)
        ids = voice.phonemes_to_ids(phones[0])
        with torch.inference_mode():
            expected = generator.infer(torch.tensor([ids], dtype=torch.long), torch.tensor([len(ids)]),
                                       noise_scale=0.0, length_scale=1.0, noise_scale_w=0.0)[0].numpy().reshape(-1)
        actual = voice.session.run(None, {"input": np.array([ids], dtype=np.int64),
                                          "input_lengths": np.array([len(ids)], dtype=np.int64),
                                          "scales": np.array([0., 1., 0.], dtype=np.float32)})[0].reshape(-1)
        if expected.shape != actual.shape or not np.isfinite(actual).all():
            raise ValueError("ONNX отличается от PyTorch по длине/сигналу: " + text)
        error = float(np.max(np.abs(actual - expected)))
        if error > 0.0005:
            raise ValueError("Экспорт ONNX изменил сигнал: " + text + "; ошибка " + str(error))
        cases.append({"text": text, "phoneme_ids": len(ids), "samples": len(actual), "max_abs_error": error})
    result = {"status": "pytorch_onnx_parity_passed", "model_sha256": sha256(model_path),
              "noise_disabled_for_comparison": True, "absolute_error_limit": 0.0005, "cases": cases}
    write_json(report_path, result)
    return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--root', required=True, type=Path)
    parser.add_argument('--result', required=True, type=Path)
    args = parser.parse_args()
    root = args.root.resolve()
    os.environ['NUMBA_CACHE_DIR'] = str(root / 'local-work' / 'numba-cache')
    torch.set_num_threads(4)
    settings = json.loads(Path(__file__).with_name('settings.json').read_text(encoding='utf8'))
    result = args.result.resolve()
    report = check(result / 'candidate.ckpt', result / 'audition' / 'kitsune.onnx', settings, result / 'audition' / 'export-validation.json')
    print(json.dumps(report, ensure_ascii=False, indent=2))
