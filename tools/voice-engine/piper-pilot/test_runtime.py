"""Проверка Cython-выравнивания независимым перебором и переноса фонем."""
import argparse
import itertools
import json
import os
from pathlib import Path

import torch
from prepare import write_json


def alignment_check():
    from piper.train.vits.monotonic_align import maximum_path
    # core.pyx принимает [batch, acoustic_frames, text_symbols].
    values = torch.tensor([[[2., -7., -8.], [1., 3., -6.], [-4., 4., 1.], [-3., 2., 5.], [-9., -5., 3.]]])
    path = maximum_path(values, torch.ones_like(values))
    assert path.shape == values.shape
    assert torch.all(path.sum(dim=2) == 1)
    assert path[0, 0, 0] == 1 and path[0, 4, 2] == 1
    rows = path[0].argmax(dim=1).tolist()
    assert all(b - a in (0, 1) for a, b in zip(rows, rows[1:]))
    # Независимый перебор всех монотонных путей с переходами на соседний звук.
    best = float('-inf')
    for switches in itertools.combinations(range(1, 5), 2):
        sequence = [sum(t >= boundary for boundary in switches) for t in range(5)]
        best = max(best, sum(float(values[0, t, row]) for t, row in enumerate(sequence)))
    actual = float((path * values).sum())
    assert actual == best, (actual, best)
    return {'status': 'passed', 'optimal_score': best, 'path': rows}


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--root', required=True, type=Path)
    args = parser.parse_args()
    root = args.root.resolve()
    os.environ['NUMBA_CACHE_DIR'] = str(root / 'local-work' / 'numba-cache')
    settings = json.loads(Path(__file__).with_name('settings.json').read_text(encoding='utf8'))
    from phoneme_check import check
    phonemes = check(root, settings)
    report = {'alignment': alignment_check(), 'phonemes': phonemes['status'],
              'base_ids_unchanged': phonemes['base_ids_unchanged'], 'stress_probe': phonemes['stress_probe']}
    write_json(root / 'local-work' / 'runtime-validation.json', report)
    print(json.dumps(report, ensure_ascii=False, indent=2))
