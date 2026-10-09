"""Проверяет перенос ударений и таблицы ID до запуска обучения."""
import argparse
import json
from pathlib import Path

from prepare import verify_prepared, write_json, sha256


def check(root, settings):
    from piper.phonemize_espeak import EspeakPhonemizer
    from piper.phoneme_ids import DEFAULT_PHONEME_ID_MAP
    phonemizer = EspeakPhonemizer()
    base_config = json.loads((root / "local-work" / "downloads" / "config.json").read_text(encoding="utf-8"))
    base_map = base_config["phoneme_id_map"]
    if base_config.get("num_symbols") != 256 or base_config.get("num_speakers") != 1:
        raise ValueError("Исходная модель другого размера")
    # В новом Piper добавлены звуки. Уже обученные ID менять нельзя:
    # переносим старую таблицу явно, не добавляя неучаствовавшие в обучении ID.
    changed = [p for p, ids in base_map.items() if DEFAULT_PHONEME_ID_MAP.get(p) != ids]
    if changed:
        raise ValueError("Изменились ID ранее обученных звуков: " + repr(changed))
    if any(not isinstance(ids, list) or not ids or any(not isinstance(i, int) or not 0 <= i < 256 for i in ids) for ids in base_map.values()):
        raise ValueError("Повреждённая таблица ID исходной модели")
    early = "".join(sum(phonemizer.phonemize("ru", "за́мок"), []))
    late = "".join(sum(phonemizer.phonemize("ru", "замо́к"), []))
    if early == late or "ˈ" not in early or "ˈ" not in late:
        raise ValueError("Эта версия фонемизатора не переносит явное ударение; обучение остановлено")
    data = verify_prepared(root / "dataset", settings, root / "input")
    records = []
    items = [{"id": r["id"], "spoken_text": r["spoken_text"]} for r in data["records"]]
    items += [{"id": r["id"], "spoken_text": r["text"]} for r in settings["audition_texts"]]
    for r in items:
        sentences = phonemizer.phonemize("ru", r["spoken_text"])
        unknown = sorted({p for sentence in sentences for p in sentence if p not in base_map})
        if not sentences or unknown:
            raise ValueError("Неизвестные фонемы в " + r["id"] + ": " + repr(unknown))
        records.append({"id": r["id"], "text": r["spoken_text"], "phonemes": ["".join(s) for s in sentences]})
    map_path = root / "local-work" / "base-phoneme-map.json"
    write_json(map_path, base_map)
    report = {"status": "phonemes_verified", "stress_probe": {"за́мок": early, "замо́к": late},
              "base_ids_unchanged": True, "base_phoneme_count": len(base_map),
              "unused_new_phonemes": sorted(set(DEFAULT_PHONEME_ID_MAP) - set(base_map)),
              "map_sha256": sha256(map_path), "records": records, "listening": "pending"}
    write_json(root / "local-work" / "phonemes.json", report)
    return report


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", required=True, type=Path)
    args = parser.parse_args()
    settings = json.loads(Path(__file__).with_name("settings.json").read_text(encoding="utf-8"))
    check(args.root.resolve(), settings)
    print("Фонемы и явные ударения проверены.")
