"""Автоматическая генерация отдельного учебного пакета из актуального проекта."""
import argparse
import hashlib
import json
import os
import re
import shutil
from datetime import datetime
from pathlib import Path
from course_pronunciation_v05 import prepare_course_text, split_course_text

ROOT = Path(__file__).resolve().parents[2]
MODEL_ID = "siriusfreak/qwen3-tts-12hz-1.7b-ru-stress-cf"
SEEDS = [1729, 2718, 3141, 2026, 4567]
REF_TEXT = ("Привет! Я Китсуне. Очень рада тебя видеть! Знаешь... математика может быть настоящим приключением. Давай попробуем решить одну интересную задачку вместе.")

def sha(data):
    return hashlib.sha256(data).hexdigest()

def save_json(file, value):
    temporary = file.with_suffix(file.suffix + ".partial")
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    os.replace(temporary, file)

def main():
    parser = argparse.ArgumentParser(description="Kitsune: отдельный учебный WAV-пакет")
    parser.add_argument("--source", type=Path, default=Path(__file__).parent / "course-v05/lesson-candidates.json")
    parser.add_argument("--reference", type=Path, required=True)
    parser.add_argument("--model-directory", type=Path, required=True)
    parser.add_argument("--pack-id", default="grade8_algebra_v05")
    parser.add_argument("--limit", type=int, default=3)
    parser.add_argument("--plan-only", action="store_true")
    args = parser.parse_args()
    if not re.fullmatch(r"[a-zA-Z0-9_-]+", args.pack_id) or args.pack_id == "pilot_v04":
        raise ValueError("Требуется новый безопасный pack_id, отличный от pilot_v04")
    data = json.loads(args.source.read_text(encoding="utf-8-sig"))
    for name, expected in data["source_sha256"].items():
        file = (ROOT / name).resolve()
        if ROOT not in file.parents or sha(file.read_bytes()) != expected:
            raise ValueError("Изменился исходник курса: " + name)
    items = data["items"] if args.limit == 0 else data["items"][:args.limit]
    if args.limit < 0 or not items:
        raise ValueError("limit должен быть положительным; 0 означает все темы")
    reference_hash = sha(args.reference.read_bytes())
    expected_reference = json.loads((ROOT / "assets/voice/pilot_v04/manifest.json").read_text(encoding="utf-8-sig"))["reference_sha256"]
    if reference_hash != expected_reference:
        raise ValueError("Эталон голоса отличается от утверждённого v0.4")
    output = ROOT / "assets/voice" / args.pack_id
    clips = output / "clips"
    clips.mkdir(parents=True, exist_ok=True)
    records = []
    seen = set()
    for item in items:
        if not re.fullmatch(r"[a-zA-Z0-9_-]+", item["id"]) or sha(item["text"].encode()) != item["text_sha256"]:
            raise ValueError("Некорректный идентификатор или изменённый текст")
        if item["id"] in seen: raise ValueError("Повторяющийся идентификатор урока")
        seen.add(item["id"])
        for index, original in enumerate(split_course_text(item["text"]), 1):
            prepared = prepare_course_text(original)
            signature = sha(json.dumps({"prepared_text":prepared, "model":MODEL_ID,"reference":reference_hash,"reference_text":REF_TEXT,"engine":"0.5.0","temperature":0.65,"top_p":0.85,"seeds":SEEDS,"non_streaming_mode":True},ensure_ascii=False,sort_keys=True).encode())[:12]
            records.append({"item_id":item["id"],"index":index,"text":original,"prepared_text":prepared,"audio":f"clips/{item['id']}_{index:03d}_{signature}.wav","pause_after_ms":300})
    plan = {"engine_version":"0.5.0","pack_id":args.pack_id,"model":MODEL_ID,"reference_sha256":reference_hash,"non_streaming_mode":True,
            "source_sha256":data["source_sha256"],"items":items,"segments":records,"validation":{"technical":"pending","listening":"pending"}}
    save_json(output / "generation-plan.json", plan)
    print(f"Тем: {len(items)}; сегментов: {len(records)}; пакет: {args.pack_id}", flush=True)
    if args.plan_only:
        print("План готов; модель не загружалась и WAV не создавались.", flush=True); return
    # Импорты модели только после проверки текстов, эталона и каталогов.
    print("Подключаю библиотеки генератора…", flush=True)
    import numpy as np
    import torch
    import soundfile as sf
    print("Подключаю Qwen TTS…", flush=True)
    from qwen_tts import Qwen3TTSModel
    print("Библиотеки подключены.", flush=True)
    state_file = output / "generation-state.json"
    state = json.loads(state_file.read_text(encoding="utf-8")) if state_file.exists() else {}
    def inspect(file, text):
        try:
            audio, rate = sf.read(str(file), dtype="float32")
            seconds = len(audio) / rate
            rms = float(np.sqrt(np.mean(audio ** 2)))
            peak = float(np.max(np.abs(audio)))
            if rate < 16000 or seconds < max(.8,.16*len(text.split())) or rms < .0025 or peak < .02 or not np.isfinite(audio).all():
                print(f"Проверка WAV: {seconds:.3f} сек; {rate} Гц; RMS {rms:.5f}; peak {peak:.5f}", flush=True)
                return None
            return {"sha256":sha(file.read_bytes()),"duration_seconds":seconds,"sample_rate":rate,"rms":rms,"peak":peak}
        except Exception as error:
            if file.exists(): print("Ошибка чтения WAV:", str(error), flush=True)
            return None
    jobs = []
    for record in records:
        file = output / record["audio"]
        # После объединения коротких фраз неизменные записи могут получить
        # другой номер. Повторно используем только тот же signature и SHA.
        if not file.exists():
            signature = file.stem.rsplit('_',1)[-1]
            for old_name, old_info in list(state.items()):
                if not re.fullmatch(r"clips/[a-zA-Z0-9_-]+\.wav",old_name) or not Path(old_name).stem.endswith('_'+signature): continue
                old_file = output / old_name
                old_valid = inspect(old_file,record["prepared_text"])
                if old_valid and old_valid["sha256"] == old_info.get("sha256"):
                    shutil.copy2(old_file,file);state[record["audio"]]=old_valid;save_json(state_file,state);break
        info = inspect(file, record["prepared_text"])
        if info and state.get(record["audio"], {}).get("sha256") == info["sha256"]:
            record.update(info); print("CACHED:", file.name, flush=True)
        else:
            jobs.append(record)
    if jobs:
        if not torch.cuda.is_available():
            raise RuntimeError("CUDA недоступна; запустите генератор в обычном Windows с установленным окружением")
        print("Загружаю сохранённую модель…", flush=True)
        model = Qwen3TTSModel.from_pretrained(str(args.model_directory.resolve()),device_map="cuda:0",dtype=torch.bfloat16,attn_implementation="sdpa")
        prompt = model.create_voice_clone_prompt(ref_audio=str(args.reference.resolve()),ref_text=REF_TEXT,x_vector_only_mode=False)
        for position, record in enumerate(jobs, 1):
            file = output / record["audio"]
            temporary = file.with_suffix(".partial.wav")
            success = False
            for attempt, seed in enumerate(SEEDS, 1):
                print(f"GENERATING {position}/{len(jobs)}: {file.name}; попытка {attempt}", flush=True)
                torch.manual_seed(seed); torch.cuda.manual_seed_all(seed)
                try:
                    with torch.inference_mode():
                        wavs, rate = model.generate_voice_clone(text=record["prepared_text"],language="Russian",voice_clone_prompt=prompt,temperature=.65,top_p=.85,non_streaming_mode=True)
                    sf.write(str(temporary), wavs[0], rate, subtype="PCM_16")
                    del wavs
                    info = inspect(temporary, record["prepared_text"])
                    if not info:
                        print("REJECTED: WAV пустой, тихий или слишком короткий", flush=True); continue
                    if file.exists():
                        rejected = output / "rejected"; rejected.mkdir(exist_ok=True)
                        shutil.copy2(file, rejected / (file.stem + '_' + datetime.now().strftime('%Y%m%d_%H%M%S_%f') + '.wav'))
                    os.replace(temporary, file)
                    record.update(info); state[record["audio"]] = info; save_json(state_file, state)
                    print(f"ACCEPTED: {file.name}; {info['duration_seconds']:.2f} сек", flush=True)
                    success = True; break
                finally:
                    if temporary.exists(): temporary.unlink()
            if not success:
                raise RuntimeError("Не удалось получить исправный WAV: " + file.name)
    for record in records:
        info = inspect(output / record["audio"], record["prepared_text"])
        if not info or info["sha256"] != record["sha256"]:
            raise RuntimeError("Финальная проверка WAV не пройдена")
    plan["validation"]["technical"] = "passed"
    save_json(state_file,{record["audio"]:{name:record[name] for name in ("sha256","duration_seconds","sample_rate","rms","peak")} for record in records})
    save_json(output / "manifest.json", plan)
    print(f"KITSUNE V0.5: готово {len(items)} тем, {len(records)} WAV. Прослушивание ещё требуется.", flush=True)

if __name__ == "__main__":
    main()
