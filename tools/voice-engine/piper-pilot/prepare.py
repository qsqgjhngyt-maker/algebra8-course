"""Отдельные копии для эксперимента Piper. Утверждённые источники не меняются."""
import argparse
import csv
import hashlib
import json
import math
from pathlib import Path
import re
import shutil
import tempfile
import wave

import numpy as np
from scipy.signal import resample_poly


def sha256(path):
    digest = hashlib.sha256()
    with Path(path).open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def write_json(path, value):
    Path(path).write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def verify_input(source, settings):
    source = Path(source).resolve()
    data = json.loads((source / "dataset.json").read_text(encoding="utf-8"))
    if data["reference_sha256"] != settings["reference_sha256"]:
        raise ValueError("У корпуса другой эталон голоса")
    ids, hashes, texts = set(), set(), set()
    for record in data["records"]:
        name = record["id"]
        if not re.fullmatch(r"[A-Za-z0-9_-]+", name) or name in ids:
            raise ValueError("Недопустимое или повторное имя записи")
        ids.add(name)
        file = source / "wav" / (name + ".wav")
        if sha256(file) != record["sha256"]:
            raise ValueError("Изменён исходный WAV: " + name)
        text = record["spoken_text"]
        key = re.sub(r"\s+", " ", text).strip().casefold()
        if not key or re.search(r"[|\r\n<>]", text):
            raise ValueError("Неподготовленная транскрипция: " + name)
        if key in texts or record["sha256"] in hashes:
            raise ValueError("Повтор записи/текста: нельзя смешивать с проверкой")
        texts.add(key)
        hashes.add(record["sha256"])
    if len(ids) < 10:
        raise ValueError("Для этого пробного запуска нужно не менее десяти записей")
    return data


def prepare(source, destination, settings):
    source, destination = Path(source).resolve(), Path(destination).resolve()
    data = verify_input(source, settings)
    if destination.exists():
        raise FileExistsError("Каталог уже существует; предыдущая подготовка сохранена")
    if destination == source or source in destination.parents:
        raise ValueError("Нельзя писать подготовленные данные внутрь исходного корпуса")
    destination.parent.mkdir(parents=True, exist_ok=True)
    staging = Path(tempfile.mkdtemp(prefix="prepare-", dir=destination.parent))
    (staging / "wav").mkdir()
    records = []
    try:
        for original in data["records"]:
            name = original["id"]
            with wave.open(str(source / "wav" / (name + ".wav")), "rb") as audio:
                if audio.getnchannels() != 1 or audio.getsampwidth() != 2 or audio.getcomptype() != "NONE":
                    raise ValueError("Ожидается PCM16 mono: " + name)
                rate = audio.getframerate()
                signal = np.frombuffer(audio.readframes(audio.getnframes()), dtype="<i2").astype(np.float64) / 32768.0
            if rate != original["sample_rate"] or abs(len(signal) / rate - original["seconds"]) > 0.002:
                raise ValueError("Параметры WAV расходятся с описанием: " + name)
            divisor = math.gcd(rate, settings["sample_rate"])
            converted = resample_poly(signal, settings["sample_rate"] // divisor, rate // divisor)
            # Одна общая шкала для записи; тембр, высота и длительность не изменяются.
            peak = float(np.max(np.abs(converted)))
            gain = min(1.0, 0.98 / max(peak, 1e-12))
            pcm = np.rint(converted * gain * 32767.0).astype("<i2")
            rms = float(np.sqrt(np.mean((pcm.astype(np.float64) / 32768.0) ** 2)))
            if rms < 0.001 or len(pcm) < settings["sample_rate"] * 0.8:
                raise ValueError("Тихая или слишком короткая запись: " + name)
            output = staging / "wav" / (name + ".wav")
            with wave.open(str(output), "wb") as audio:
                audio.setnchannels(1)
                audio.setsampwidth(2)
                audio.setframerate(settings["sample_rate"])
                audio.writeframes(pcm.tobytes())
            split = "validation" if original["group"] == settings["holdout_group"] else "train"
            records.append({**original, "split": split, "prepared_sha256": sha256(output),
                            "prepared_sample_rate": settings["sample_rate"], "prepared_seconds": len(pcm) / settings["sample_rate"],
                            "peak_before_gain": peak, "gain": gain, "rms": rms})
        train = [r for r in records if r["split"] == "train"]
        validation = [r for r in records if r["split"] == "validation"]
        if len(train) < 10 or not validation:
            raise ValueError("Проверочный урок отсутствует или обучающая часть слишком мала")
        for filename, selection in (("metadata.csv", records), ("train.csv", train), ("validation.csv", validation)):
            with (staging / filename).open("w", encoding="utf-8", newline="") as stream:
                writer = csv.writer(stream, delimiter="|", lineterminator="\n")
                writer.writerows((r["id"] + ".wav", r["spoken_text"]) for r in selection)
        report = {"schema_version": 1, "status": "prepared_not_trained", "experiment": settings["experiment"],
                  "reference_sha256": data["reference_sha256"], "source_manifest_sha256": sha256(source / "dataset.json"),
                  "sample_rate": settings["sample_rate"], "clips": len(records), "seconds": sum(r["seconds"] for r in records),
                  "train_clips": len(train), "validation_clips": len(validation),
                  "train_seconds": sum(r["seconds"] for r in train), "validation_seconds": sum(r["seconds"] for r in validation),
                  "listening_approved": sum(r["listening"] == "approved" for r in records),
                  "listening_pending": sum(r["listening"] != "approved" for r in records),
                  "split_rule": "Отдельный урок целиком исключён из обучения; повторов текста/аудио нет",
                  "transcripts": "prepared_text из исходных пакетов; ударения сохранены без изменений",
                  "production_ready": False, "records": records}
        write_json(staging / "prepared.json", report)
        # Ещё раз проверяем источники после записи копий.
        verify_input(source, settings)
        staging.rename(destination)
        return report
    except BaseException:
        # Удаляем только созданный здесь временный каталог с известным родителем.
        if staging.parent == destination.parent and staging.name.startswith("prepare-"):
            shutil.rmtree(staging)
        raise


def verify_prepared(destination, settings, source=None):
    destination = Path(destination)
    data = json.loads((destination / "prepared.json").read_text(encoding="utf-8"))
    if data["reference_sha256"] != settings["reference_sha256"] or data["sample_rate"] != settings["sample_rate"]:
        raise ValueError("Подготовленный корпус другой версии")
    if source is not None:
        source = Path(source)
        original = verify_input(source, settings)
        if data["source_manifest_sha256"] != sha256(source / "dataset.json") or len(original["records"]) != len(data["records"]):
            raise ValueError("Исходное описание корпуса изменено")
        for before, after in zip(original["records"], data["records"]):
            if any(before[key] != after.get(key) for key in before):
                raise ValueError("Изменена транскрипция или происхождение записи")
    for record in data["records"]:
        if not re.fullmatch(r"[A-Za-z0-9_-]+", record["id"]):
            raise ValueError("Недопустимый путь в подготовленном корпусе")
        path = destination / "wav" / (record["id"] + ".wav")
        if sha256(path) != record["prepared_sha256"]:
            raise ValueError("Изменена обучающая копия: " + record["id"])
        expected = "validation" if record["group"] == settings["holdout_group"] else "train"
        if record["split"] != expected:
            raise ValueError("Проверочный урок попал в обучение")
    train_hashes = {r["sha256"] for r in data["records"] if r["split"] == "train"}
    val_hashes = {r["sha256"] for r in data["records"] if r["split"] == "validation"}
    if train_hashes & val_hashes:
        raise ValueError("Пересечение обучающих и проверочных WAV")
    rows = list(csv.reader((destination / "metadata.csv").open(encoding="utf-8"), delimiter="|"))
    expected_rows = [[r["id"] + ".wav", r["spoken_text"]] for r in data["records"]]
    if rows != expected_rows:
        raise ValueError("Обучающая транскрипция изменена")
    return data


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--verify", action="store_true")
    args = parser.parse_args()
    settings = json.loads(Path(__file__).with_name("settings.json").read_text(encoding="utf-8"))
    report = verify_prepared(args.output, settings, args.input) if args.verify else prepare(args.input, args.output, settings)
    print(json.dumps({k: v for k, v in report.items() if k != "records"}, ensure_ascii=False, indent=2))
