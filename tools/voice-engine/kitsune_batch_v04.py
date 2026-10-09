import json
import re
import os
import shutil
import hashlib
from pathlib import Path
from datetime import datetime

import numpy as np
import torch
import soundfile as sf
from qwen_tts import Qwen3TTSModel
from kitsune_pronunciation import prepare_math_text

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / "kitsune_lessons_v04.json"
REFERENCE = ROOT / "voices" / "kitsune_master_v1.wav"

MODEL_ID = "siriusfreak/qwen3-tts-12hz-1.7b-ru-stress-cf"
SEEDS = [1729, 2718, 3141, 2026, 4567]

REF_TEXT = (
    "Привет! Я Китсуне. Очень рада тебя видеть! "
    "Знаешь... математика может быть настоящим "
    "приключением. Давай попробуем решить "
    "одну интересную задачку вместе."
)

def digest(value):
    return hashlib.sha256(value).hexdigest()

def split_text(text):
    parts = re.findall(r"[^.!?…]+(?:[.!?…]+|$)", text)
    parts = [p.strip() for p in parts if p.strip()]
    result = []
    buffer = ""

    for part in parts:
        if not buffer:
            buffer = part
        elif len(buffer.split()) < 6:
            buffer += " " + part
        else:
            result.append(buffer)
            buffer = part

    if buffer:
        if result and len(buffer.split()) < 4:
            result[-1] += " " + buffer
        else:
            result.append(buffer)

    if re.sub(r"\s+", "", " ".join(result)) != re.sub(
        r"\s+", "", text
    ):
        raise ValueError("Text segmentation mismatch")

    for segment in result:
        if len(segment) > 240:
            raise ValueError(
                "Segment too long; split source manually"
            )

    return result

def valid_audio(path, text):
    if not path.is_file():
        return False

    try:
        audio, sr = sf.read(str(path), dtype="float32")
        if sr < 16000 or audio.size == 0:
            return False

        duration = len(audio) / sr
        rms = float(np.sqrt(np.mean(audio ** 2)))
        peak = float(np.max(np.abs(audio)))

        minimum = max(0.8, 0.16 * len(text.split()))

        return (
            duration >= minimum
            and rms >= 0.0025
            and peak >= 0.02
            and np.isfinite(audio).all()
        )
    except Exception:
        return False

if not REFERENCE.is_file():
    raise FileNotFoundError(REFERENCE)

data = json.loads(SOURCE.read_text(encoding="utf-8-sig"))
pack_id = data["pack_id"]

if not re.fullmatch(r"[a-zA-Z0-9_-]+", pack_id):
    raise ValueError("Invalid pack ID")

if pack_id != "pilot_v04":
    raise ValueError("This test only supports pilot_v04")

output = ROOT / "voice_packs" / pack_id
clips = output / "clips"
clips.mkdir(parents=True, exist_ok=True)

reference_hash = digest(REFERENCE.read_bytes())
manifest = []
jobs = []
seen = set()

for item in data["items"]:
    item_id = item["id"]

    if not re.fullmatch(r"[a-zA-Z0-9_-]+", item_id):
        raise ValueError("Invalid item ID")
    if item_id in seen:
        raise ValueError("Duplicate item ID")
    seen.add(item_id)

    for index, text in enumerate(split_text(item["text"]), 1):
        prepared = prepare_math_text(text)

        signature_data = {
            "text": prepared,
            "model": MODEL_ID,
            "reference": reference_hash,
            "reference_text": REF_TEXT,
            "engine": "0.4.0",
            "temperature": 0.65,
            "top_p": 0.85,
            "seeds": SEEDS,
        }

        signature = digest(
            json.dumps(
                signature_data,
                ensure_ascii=False,
                sort_keys=True
            ).encode("utf-8")
        )[:12]

        name = f"{item_id}_{index:03d}_{signature}.wav"
        path = clips / name

        record = {
            "item_id": item_id,
            "index": index,
            "text": text,
            "prepared_text": prepared,
            "audio": "clips/" + name,
            "pause_after_ms": 300,
        }

        manifest.append(record)

        if valid_audio(path, prepared):
            print("CACHED:", name, flush=True)
        else:
            jobs.append((path, prepared))

if jobs:
    print("Loading Kitsune model...", flush=True)

    model = Qwen3TTSModel.from_pretrained(
        MODEL_ID,
        device_map="cuda:0",
        dtype=torch.bfloat16,
        attn_implementation="sdpa",
    )

    prompt = model.create_voice_clone_prompt(
        ref_audio=str(REFERENCE),
        ref_text=REF_TEXT,
        x_vector_only_mode=False,
    )

    rejected = output / "rejected"

    for path, text in jobs:
        success = False

        for attempt, seed in enumerate(SEEDS, 1):
            print(
                f"Generating {path.name}, attempt {attempt}",
                flush=True
            )

            temporary = path.with_name(
                path.stem + ".partial.wav"
            )

            try:
                torch.manual_seed(seed)
                torch.cuda.manual_seed_all(seed)

                with torch.inference_mode():
                    wavs, sr = model.generate_voice_clone(
                        text=text,
                        language="Russian",
                        voice_clone_prompt=prompt,
                        temperature=0.65,
                        top_p=0.85,
                    )

                sf.write(str(temporary), wavs[0], sr)
                del wavs

                if not valid_audio(temporary, text):
                    print("REJECTED: empty or too short")
                    continue

                if path.exists():
                    rejected.mkdir(exist_ok=True)
                    stamp = datetime.now().strftime(
                        "%Y%m%d_%H%M%S_%f"
                    )
                    shutil.copy2(
                        path,
                        rejected / f"{path.stem}_{stamp}.wav"
                    )

                os.replace(temporary, path)
                print("ACCEPTED:", path.name, flush=True)
                success = True
                break

            except RuntimeError as exc:
                if "out of memory" in str(exc).lower():
                    raise
                print("Runtime error:", exc, flush=True)

            finally:
                if temporary.exists():
                    temporary.unlink()

        if not success:
            raise RuntimeError(
                "Could not generate valid audio: " + path.name
            )

# Final check before publishing manifest
for record in manifest:
    path = output / record["audio"]
    if not valid_audio(path, record["prepared_text"]):
        raise RuntimeError("Final validation failed: " + str(path))

result = {
    "engine_version": "0.4.0",
    "pack_id": pack_id,
    "model": MODEL_ID,
    "reference_sha256": reference_hash,
    "segments": manifest,
}

temporary_manifest = output / "manifest.partial.json"
temporary_manifest.write_text(
    json.dumps(result, ensure_ascii=False, indent=2),
    encoding="utf-8"
)

os.replace(
    temporary_manifest,
    output / "manifest.json"
)

print("KITSUNE V0.4: ALL OK", flush=True)
print("Segments:", len(manifest))
print("Output:", output)
