"""Ограниченное дообучение, экспорт ONNX и пробы. Подключения к PWA здесь нет."""
import argparse
from datetime import datetime, timezone
import inspect
import json
import os
from pathlib import Path, PurePosixPath
import shutil
import time
import wave

from prepare import sha256, verify_prepared, write_json


def load_checkpoint(path):
    import torch
    # Linux-пути из официального checkpoint читаем как чистые пути, без pickle-кода.
    with torch.serialization.safe_globals([(PurePosixPath, "pathlib.PosixPath")]):
        return torch.load(path, map_location="cpu", weights_only=True)


def model_from_checkpoint(checkpoint, settings, training):
    from piper.train.vits.lightning import VitsModel
    values = checkpoint.get("hyper_parameters", {})
    allowed = set(inspect.signature(VitsModel.__init__).parameters) - {"self", "kwargs", "dataset"}
    options = {k: v for k, v in values.items() if k in allowed}
    options.update(batch_size=settings["batch_size"], sample_rate=settings["sample_rate"], num_speakers=1,
                   learning_rate=settings["learning_rate"], learning_rate_d=settings["learning_rate_d"],
                   mos_metric="none", use_mrd=False, warmstart_ckpt=None, vocoder_warmstart_ckpt=None)
    model = VitsModel(**options)
    own = model.state_dict()
    saved = checkpoint["state_dict"]
    missing = [k for k, v in own.items() if k not in saved or saved[k].shape != v.shape]
    if missing:
        raise ValueError("Исходная модель несовместима; обучение с нуля запрещено: " + repr(missing[:8]))
    model.load_state_dict({k: saved[k] for k in own}, strict=True)
    # При дообучении новый оптимизатор и счётчики: epoch=4139 не мешает лимиту 60 эпох.
    return model


def export_model(checkpoint_path, output_path, settings):
    import torch
    import onnx
    model = model_from_checkpoint(load_checkpoint(checkpoint_path), settings, False).eval()
    generator = model.model_g.eval()
    with torch.no_grad():
        generator.dec.remove_weight_norm()

    class Inference(torch.nn.Module):
        def __init__(self):
            super().__init__()
            self.generator = generator

        def forward(self, text, lengths, scales):
            return self.generator.infer(text, lengths, noise_scale=scales[0], length_scale=scales[1],
                                        noise_scale_w=scales[2])[0]

    length = 30
    text = torch.randint(0, generator.n_vocab, (1, length), dtype=torch.long)
    scales = torch.tensor([0.667, 1.0, 0.8], dtype=torch.float32)
    with torch.no_grad():
        # Явный legacy exporter для PyTorch 2.9, как требует динамический граф VITS.
        torch.onnx.export(Inference(), (text, torch.tensor([length]), scales), str(output_path),
                          dynamo=False, opset_version=15, input_names=["input", "input_lengths", "scales"],
                          output_names=["output"], dynamic_axes={"input": {0: "batch_size", 1: "phonemes"},
                                                               "input_lengths": {0: "batch_size"},
                                                               "output": {0: "batch_size", 2: "time"}})
    onnx.checker.check_model(str(output_path))


def audition(model_path, settings, prepared, output):
    import numpy as np
    from piper import PiperVoice, SynthesisConfig
    start = time.perf_counter()
    voice = PiperVoice.load(model_path, use_cuda=False)
    load_seconds = time.perf_counter() - start
    config = SynthesisConfig(**settings["synthesis"], normalize_audio=False)
    # Отдельный прогрев не засчитывается в время генерации пользовательских фраз.
    list(voice.synthesize("Привет!", syn_config=config))
    records = []
    items = list(settings["audition_texts"])
    validation = [r for r in prepared["records"] if r["split"] == "validation"]
    items.append({"id": "07_heldout", "text": validation[0]["spoken_text"], "reference_id": validation[0]["id"]})
    feeds_dir = output / "wasm-inputs"
    feeds_dir.mkdir()
    for item in items:
        started = time.perf_counter()
        chunks = list(voice.synthesize(item["text"], syn_config=config))
        elapsed = time.perf_counter() - started
        if not chunks:
            raise RuntimeError("Piper не выдал аудио")
        signal = np.concatenate([c.audio_float_array for c in chunks])
        if not np.isfinite(signal).all() or signal.size < 1000:
            raise RuntimeError("Повреждённый или пустой синтез")
        rms = float(np.sqrt(np.mean(signal.astype(np.float64) ** 2)))
        if rms < 0.001:
            raise RuntimeError("Синтез слишком тихий")
        filename = item["id"] + ".wav"
        with wave.open(str(output / filename), "wb") as wav:
            wav.setframerate(settings["sample_rate"])
            wav.setsampwidth(2)
            wav.setnchannels(1)
            wav.writeframes(np.rint(np.clip(signal, -1, 1) * 32767).astype("<i2").tobytes())
        # Эти ID позволяют позже измерить именно ONNX/WASM, отдельно от фонемизации.
        sentences = [voice.phonemes_to_ids(p) for p in voice.phonemize(item["text"]) if p]
        write_json(feeds_dir / (item["id"] + ".json"), {"sentences": sentences, "text": item["text"],
                                                       "scales": [settings["synthesis"][k] for k in ("noise_scale", "length_scale", "noise_w_scale")],
                                                       "sample_rate": settings["sample_rate"]})
        records.append({**item, "file": filename, "seconds": signal.size / settings["sample_rate"],
                        "generation_seconds": elapsed, "real_time_factor": elapsed / (signal.size / settings["sample_rate"]),
                        "rms": rms, "peak": float(np.max(np.abs(signal))), "sha256": sha256(output / filename)})
    report = {"status": "candidate_generated_listening_pending", "engine": "Piper ONNX Runtime CPU",
              "model_load_seconds": load_seconds, "model_sha256": sha256(model_path),
              "model_bytes": model_path.stat().st_size, "PC_browser": "not_tested", "Android": "not_tested",
              "iOS": "not_tested", "voice_similarity": "listening_pending", "records": records}
    write_json(output / "audition.json", report)
    import html
    blocks = []
    for r in records:
        reference = ""
        if r.get("reference_id"):
            reference = '<p>Исходная проверочная запись:</p><audio controls src="../../../dataset/wav/' + r["reference_id"] + '.wav"></audio>'
        blocks.append('<article><p>' + html.escape(r["text"]) + '</p><audio controls src="' + r["file"] + '"></audio>' + reference + '</article>')
    (output / "Послушать.html").write_text('<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Проба Kitsune Piper</title><style>body{font:18px system-ui;max-width:850px;margin:32px auto;padding:16px;background:#fff8f0;color:#40281d}article{background:white;padding:16px;margin:16px 0;border:1px solid #ffac76;border-radius:16px}audio{max-width:100%}</style><h1>Пробный голос Китсуне</h1><p>Это кандидат после короткого обучения. Оцените сходство голоса, понятность речи и ударения. Измерена генерация на CPU этого ПК. Браузеры и телефоны ещё не проверены.</p>' + ''.join(blocks) + '</html>', encoding="utf-8")
    return report


def run(root, settings):
    import torch
    import lightning as L
    from lightning.pytorch.callbacks import ModelCheckpoint
    from lightning.pytorch.loggers import CSVLogger
    from piper.train.vits.dataset import VitsDataModule
    from torch.utils.data import Subset
    if not torch.cuda.is_available():
        raise RuntimeError("Обучение требует доступной NVIDIA CUDA; CPU-обучение не запускается автоматически")
    prepared = verify_prepared(root / "dataset", settings, root / "input")
    from phoneme_check import check
    check(root, settings)
    checkpoint_path = root / "local-work" / "downloads" / "starter.ckpt"
    if sha256(checkpoint_path) != settings["checkpoint_sha256"]:
        raise ValueError("Контрольная сумма исходной модели не совпала")
    L.seed_everything(settings["seed"], workers=True)
    checkpoint = load_checkpoint(checkpoint_path)
    model = model_from_checkpoint(checkpoint, settings, True)
    if model.hparams.num_symbols != 256 or model.hparams.sample_rate != 22050:
        raise ValueError("Исходная модель другого размера или частоты")
    del checkpoint
    run_name = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ") + "-" + os.urandom(3).hex()
    result = root / "results" / run_name
    result.mkdir(parents=True, exist_ok=False)
    started = time.perf_counter()
    state = {"status": "training_started", "experiment": settings["experiment"], "settings": settings,
             "gpu": torch.cuda.get_device_name(0), "torch": torch.__version__, "started_utc": run_name,
             "base_checkpoint_sha256": settings["checkpoint_sha256"], "production_modified": False}
    write_json(result / "status.json", state)

    class FixedSplitData(VitsDataModule):
        def setup(self, stage):
            super().setup(stage)
            full = self.train_dataset.dataset
            if len(full) != len(prepared["records"]):
                raise RuntimeError("Piper пропустил часть корпуса; обучение остановлено")
            training_ids = [i for i, r in enumerate(prepared["records"]) if r["split"] == "train"]
            validation_ids = [i for i, r in enumerate(prepared["records"]) if r["split"] == "validation"]
            self.train_dataset = Subset(full, training_ids)
            self.val_dataset = Subset(full, validation_ids)
            self.test_dataset = Subset(full, [])

    data = FixedSplitData(csv_path=root / "dataset" / "metadata.csv", audio_dir=root / "dataset" / "wav",
                         cache_dir=result / "cache", config_path=result / "kitsune.onnx.json", voice_name="kitsune_pilot",
                         espeak_voice="ru", sample_rate=22050, batch_size=settings["batch_size"], num_workers=0,
                         num_test_examples=0, trim_silence=False, validation_split=0.1,
                         phonemes_path=root / "local-work" / "base-phoneme-map.json")
    checkpoints = ModelCheckpoint(dirpath=result / "checkpoints", monitor="val_mel", mode="min", save_top_k=2,
                                  save_last=True, every_n_epochs=5, filename="epoch{epoch:03d}-mel{val_mel:.4f}",
                                  auto_insert_metric_name=False)
    class Progress(L.Callback):
        def on_train_epoch_end(self, trainer, pl_module):
            state.update(status="training_running", global_step=trainer.global_step,
                         epochs_completed=trainer.current_epoch + 1, elapsed_seconds=time.perf_counter() - started)
            write_json(result / "status.json", state)
            print(f"Эпоха {trainer.current_epoch + 1}/{settings['max_epochs']}; обновлений {trainer.global_step}; "
                  f"время {state['elapsed_seconds'] / 60:.1f} мин", flush=True)

    trainer = L.Trainer(accelerator="gpu", devices=1, precision="32-true", max_epochs=settings["max_epochs"],
                        max_steps=settings["max_steps"], max_time={"minutes": settings["max_time_minutes"]},
                        callbacks=[checkpoints, Progress()], logger=CSVLogger(save_dir=str(result), name="metrics"),
                        check_val_every_n_epoch=5, num_sanity_val_steps=1, enable_progress_bar=False,
                        log_every_n_steps=10, deterministic=False)
    try:
        trainer.fit(model, datamodule=data)
        if trainer.global_step < 2:
            raise RuntimeError("Дообучение не выполнило ни одной пары обновлений")
        candidate_checkpoint = result / "candidate.ckpt"
        trainer.save_checkpoint(str(candidate_checkpoint), weights_only=True)
        state.update(status="trained_export_pending", training_seconds=time.perf_counter() - started,
                     global_step=trainer.global_step, epochs_completed=trainer.current_epoch,
                     max_gpu_memory_bytes=torch.cuda.max_memory_allocated())
        write_json(result / "status.json", state)
        # Освобождаем GPU до CPU-экспорта. Предыдущие пробы в отдельных папках сохраняются.
        trainer.strategy.teardown()
        model.cpu()
        torch.cuda.empty_cache()
        output = result / "audition"
        output.mkdir()
        model_path = output / "kitsune.onnx"
        export_model(candidate_checkpoint, model_path, settings)
        shutil.copyfile(result / "kitsune.onnx.json", output / "kitsune.onnx.json")
        from verify_export import check as verify_export
        verify_export(candidate_checkpoint, model_path, settings, output / "export-validation.json")
        report = audition(model_path, settings, prepared, output)
        state.update(status="candidate_ready_for_listening", native_audition=report,
                     finished_utc=datetime.now(timezone.utc).isoformat())
        write_json(result / "status.json", state)
        write_json(root / "latest-result.json", {"result": str(result.relative_to(root)), "status": state["status"]})
        print("\nПроба готова: " + str(output / "Послушать.html"), flush=True)
    except BaseException as error:
        state.update(status="failed", error=str(error), elapsed_seconds=time.perf_counter() - started)
        write_json(result / "status.json", state)
        raise


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", required=True, type=Path)
    args = parser.parse_args()
    root = args.root.resolve()
    for name in ("TORCH_HOME", "HF_HOME", "NUMBA_CACHE_DIR"):
        os.environ[name] = str(root / "local-work" / name.lower())
        Path(os.environ[name]).mkdir(parents=True, exist_ok=True)
    os.environ.setdefault("OMP_NUM_THREADS", "4")
    os.environ.setdefault("MKL_NUM_THREADS", "4")
    settings = json.loads(Path(__file__).with_name("settings.json").read_text(encoding="utf-8"))
    run(root, settings)
