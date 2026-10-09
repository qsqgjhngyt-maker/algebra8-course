"""Офлайн-проверки повреждённых WAV, утечки проверки и повторного запуска."""
import argparse
import copy
import json
from pathlib import Path
import shutil
import tempfile

from prepare import prepare, verify_input, verify_prepared, sha256


def rejected(action, message):
    try:
        action()
    except (ValueError, FileExistsError):
        return
    raise AssertionError(message)


def main(source, dataset, settings):
    data = verify_input(source, settings)
    prepared = verify_prepared(dataset, settings, source)
    source_hashes = {r['id']: sha256(source / 'wav' / (r['id'] + '.wav')) for r in data['records']}
    assert prepared['train_clips'] == 24 and prepared['validation_clips'] == 9
    assert prepared['listening_approved'] == 5 and prepared['listening_pending'] == 28
    assert len({r['group'] for r in prepared['records'] if r['split'] == 'validation'}) == 1
    rejected(lambda: prepare(source, dataset, settings), 'Перезапись существующего корпуса разрешена')
    with tempfile.TemporaryDirectory(prefix='piper-tests-', dir=dataset.parent) as temporary:
        scratch = Path(temporary)
        bad_source = scratch / 'bad-source'
        shutil.copytree(source, bad_source)
        first = bad_source / 'wav' / (data['records'][0]['id'] + '.wav')
        with first.open('ab') as stream:
            stream.write(b'corruption')
        rejected(lambda: verify_input(bad_source, settings), 'Повреждённый исходный WAV принят')
        bad_dataset = scratch / 'bad-dataset'
        shutil.copytree(dataset, bad_dataset)
        altered = copy.deepcopy(prepared)
        r = next(r for r in altered['records'] if r['split'] == 'validation')
        r['split'] = 'train'
        (bad_dataset / 'prepared.json').write_text(json.dumps(altered), encoding='utf8')
        rejected(lambda: verify_prepared(bad_dataset, settings), 'Проверочный урок попал в обучение')
        (bad_dataset / 'prepared.json').write_text(json.dumps(prepared), encoding='utf8')
        (bad_dataset / 'metadata.csv').write_text('bad.wav|Иной текст\n', encoding='utf8')
        rejected(lambda: verify_prepared(bad_dataset, settings), 'Изменённая транскрипция принята')
        duplicate = copy.deepcopy(data)
        duplicate['records'][1]['spoken_text'] = duplicate['records'][0]['spoken_text']
        (bad_source / 'dataset.json').write_text(json.dumps(duplicate), encoding='utf8')
        shutil.copyfile(source / 'wav' / first.name, first)
        rejected(lambda: verify_input(bad_source, settings), 'Повтор транскрипции принят')
    for r in data['records']:
        assert sha256(source / 'wav' / (r['id'] + '.wav')) == source_hashes[r['id']]
    print('PASS: подготовленные WAV/частота/хеши, 24+9 разделение по уроку, 5+28 статус прослушивания; защита от перезаписи, повреждения, повтора и утечки проверки.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--root', required=True, type=Path)
    args = parser.parse_args()
    settings = json.loads(Path(__file__).with_name('settings.json').read_text(encoding='utf8'))
    main(args.root / 'input', args.root / 'dataset', settings)
