"""Подготовка изолированного окружения внутри набора. Внешний Qwen не обновляется."""
import argparse
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import urllib.request
import zipfile

from prepare import sha256, write_json, verify_prepared


def command(arguments, cwd=None, env=None):
    subprocess.run([str(a) for a in arguments], cwd=cwd, env=env, check=True)


def download(url, target, expected=None):
    target = Path(target)
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.exists():
        if expected and sha256(target) != expected:
            raise ValueError("Сохранённая загрузка повреждена: " + str(target))
        return
    temporary = target.with_suffix(target.suffix + ".part")
    received, reported = 0, 0
    request = urllib.request.Request(url, headers={"User-Agent": "Kitsune-Piper-Pilot/1"})
    # HTTPS-проверка сертификата остаётся включённой.
    with urllib.request.urlopen(request, timeout=90) as response, temporary.open("wb") as stream:
        while block := response.read(1024 * 1024):
            stream.write(block)
            received += len(block)
            if received - reported >= 32 * 1024 * 1024:
                print(f"Загружено {received / 1024 / 1024:.0f} МБ", flush=True)
                reported = received
    if expected and sha256(temporary) != expected:
        raise ValueError("Контрольная сумма загрузки не совпала; файл не будет использоваться")
    temporary.replace(target)


def provision_environment(root, existing_python):
    root = Path(root).resolve()
    local = root / "local-work"
    local.mkdir(exist_ok=True)
    env_dir = local / ".venv"
    executable = env_dir / "Scripts" / "python.exe"
    if not executable.exists():
        # Новый venv; исходная .venv используется только для чтения пакетов CUDA.
        command([existing_python, "-m", "venv", str(env_dir)])
    inherited = subprocess.check_output([str(existing_python), "-c", "import sysconfig; print(sysconfig.get_paths()['purelib'])"], text=True).strip()
    inherited_path = Path(inherited).resolve()
    if not inherited_path.is_dir() or inherited_path == (env_dir / "Lib" / "site-packages").resolve():
        raise ValueError("Не найдено отдельное установленное окружение Qwen/CUDA")
    (env_dir / "Lib" / "site-packages" / "kitsune_readonly_cuda.pth").write_text(str(inherited_path) + "\n", encoding="utf-8")
    child_env = dict(os.environ, PYTHONNOUSERSITE="1", PYTHONUTF8="1", PIP_DISABLE_PIP_VERSION_CHECK="1",
                     PIP_CACHE_DIR=str(local / "pip-cache"), TORCH_HOME=str(local / "torch-cache"),
                     HF_HOME=str(local / "hf-cache"), NUMBA_CACHE_DIR=str(local / "numba-cache"))
    probe = "import torch,numpy,scipy,sys,json; a=torch.ones((16,16),device='cuda'); print(json.dumps({'python':sys.version.split()[0],'torch':torch.__version__,'torch_origin':torch.__file__,'numpy':numpy.__version__,'scipy':scipy.__version__,'gpu':torch.cuda.get_device_name(0),'gpu_sum':float((a@a).sum()),'cuda':torch.version.cuda}))"
    report = json.loads(subprocess.check_output([str(executable), "-c", probe], text=True, env=child_env))
    # PyTorch 2.9/cu128 уже проверен на RTX 5050 этого ПК. Не подменяем его CPU-пакетом.
    if report["torch"] != "2.9.1+cu128" or report["gpu_sum"] != 4096.0:
        raise ValueError("Окружение CUDA отличается от проверенного; требуется отдельная настройка")
    if inherited_path not in Path(report["torch_origin"]).resolve().parents:
        raise ValueError("PyTorch должен читаться из существующего окружения; внешний пакет не изменяется")
    write_json(local / "environment.json", report)
    return executable, child_env, report


def install(root, executable, env, report, settings):
    local = root / "local-work"
    if shutil.disk_usage(local).free < 8 * 1024 ** 3:
        raise RuntimeError("Для загрузки и сохранения нескольких checkpoints нужно хотя бы 8 ГБ свободного места")
    constraints = local / "constraints.txt"
    constraints.write_text(f"torch=={report['torch']}\nnumpy=={report['numpy']}\nscipy=={report['scipy']}\n", encoding="utf-8")
    print("Устанавливаем компоненты обучения в отдельное окружение…", flush=True)
    command([executable, "-m", "pip", "install", "--only-binary=:all:", "--constraint", constraints,
             f"piper-tts[train]=={settings['piper_version']}", "setuptools>=68,<81", "wheel"], env=env)
    downloads = local / "downloads"
    source_zip = downloads / "piper-source.zip"
    download("https://codeload.github.com/OHF-Voice/piper1-gpl/zip/" + settings["piper_source_commit"], source_zip)
    sources = local / "piper-source"
    sources.mkdir(exist_ok=True)
    prefix = "piper1-gpl-" + settings["piper_source_commit"] + "/"
    # Копируем только код выравнивания и лицензию; пути архива не могут выйти из sources.
    wanted = ["src/piper/train/vits/monotonic_align/core.pyx", "COPYING"]
    with zipfile.ZipFile(source_zip) as archive:
        for item in wanted:
            data = archive.read(prefix + item)
            (sources / Path(item).name).write_bytes(data)
    package_dir = Path(subprocess.check_output([str(executable), "-c", "import piper,pathlib; print(pathlib.Path(piper.__file__).parent)"], env=env, text=True).strip())
    own_site = local / ".venv" / "Lib" / "site-packages"
    if own_site.resolve() not in package_dir.resolve().parents:
        raise ValueError("Piper установлен вне отдельного окружения")
    # Официальный build_monotonic_align.sh рассчитан на Linux (.so).
    # Windows собирает тот же core.pyx через MSVC в .pyd, без замены алгоритма.
    build_script = sources / "setup_align.py"
    build_script.write_text("from setuptools import setup,Extension\nfrom Cython.Build import cythonize\nimport numpy\nsetup(name='kitsune-piper-alignment',ext_modules=cythonize([Extension('piper.train.vits.monotonic_align.monotonic_align.core',['core.pyx'],include_dirs=[numpy.get_include()])],compiler_directives={'language_level':3}))\n", encoding="utf-8")
    align_dir = package_dir / "train" / "vits" / "monotonic_align" / "monotonic_align"
    align_dir.mkdir(exist_ok=True)
    (align_dir / "__init__.py").touch()
    command([executable, build_script, "build_ext", "--build-lib", own_site, "--build-temp", sources / "build-temp"], cwd=sources, env=env)
    command([executable, "-c", "from piper.train.vits.monotonic_align import maximum_path; from piper.train.vits.lightning import VitsModel; import piper; print('Piper: компоненты обучения загружены')"], env=env)
    base_url = "https://huggingface.co/datasets/rhasspy/piper-checkpoints/resolve/" + settings["checkpoint_revision"] + "/ru/ru_RU/irina/medium/"
    download(base_url + "epoch%3D4139-step%3D929464.ckpt", downloads / "starter.ckpt", settings["checkpoint_sha256"])
    for name in ("config.json", "MODEL_CARD"):
        download(base_url + name, downloads / name)
    command([executable, Path(__file__).with_name("phoneme_check.py"), "--root", root], env=env)
    command([executable, Path(__file__).with_name("test_runtime.py"), "--root", root], env=env)
    version_code = "import importlib.metadata as m,json; print(json.dumps({n:m.version(n) for n in ('piper-tts','lightning','torchmetrics','cython','onnx','tensorboard','torch','numpy','scipy','librosa')}))"
    versions = json.loads(subprocess.check_output([str(executable), "-c", version_code], env=env, text=True))
    write_json(local / "verified-versions.json", versions)
    freeze = subprocess.check_output([str(executable), "-m", "pip", "freeze", "--all"], env=env, text=True)
    (local / "installed-versions.txt").write_text(freeze, encoding="utf-8")
    write_json(local / "installation.json", {"status": "components_verified_training_not_started",
               "piper_version": settings["piper_version"], "source_commit": settings["piper_source_commit"],
               "source_archive_sha256": sha256(source_zip), "checkpoint_sha256": sha256(downloads / "starter.ckpt"),
               "checkpoint_revision": settings["checkpoint_revision"], "checkpoint_dataset_license": settings["checkpoint_dataset_license"]})


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", required=True, type=Path)
    parser.add_argument("--existing-python", required=True, type=Path)
    parser.add_argument("--offline-check", action="store_true")
    args = parser.parse_args()
    root = args.root.resolve()
    settings = json.loads(Path(__file__).with_name("settings.json").read_text(encoding="utf-8"))
    verify_prepared(root / "dataset", settings, root / "input")
    executable, env, report = provision_environment(root, args.existing_python)
    print(json.dumps(report, ensure_ascii=False, indent=2), flush=True)
    if args.offline_check:
        print("Офлайн-проверка завершена. Загрузка компонентов и обучение не запускались.")
    else:
        install(root, executable, env, report, settings)
