import torch
import soundfile as sf
from qwen_tts import Qwen3TTSModel

model = Qwen3TTSModel.from_pretrained(
    "siriusfreak/qwen3-tts-12hz-1.7b-ru-stress-cf",
    device_map="cuda:0",
    dtype=torch.bfloat16,
    attn_implementation="sdpa",
)

ref_text = (
    "Привет! Я Китсуне. Очень рада тебя видеть! "
    "Знаешь... математика может быть настоящим "
    "приключением. Давай попробуем решить "
    "одну интересную задачку вместе."
)

prompt = model.create_voice_clone_prompt(
    ref_audio="voices/kitsune_master_v1.wav",
    ref_text=ref_text,
    x_vector_only_mode=False,
)

tests = {
    "kitsune_v7_math.wav": (
        "Сегодня мы разберём обыкновенные дро́би. "
        "В каждой дро́би есть числи́тель и знамена́тель. "
        "Давай рассмотрим один пример."
    ),
    "kitsune_v7_support.wav": (
        "У тебя почти получилось! "
        "Посмотри внимательно на этот шаг. "
        "Не спеши, мы обязательно разберёмся вместе!"
    )
}

for filename, text in tests.items():
    torch.manual_seed(1729)
    torch.cuda.manual_seed_all(1729)

    print("Generating:", filename, flush=True)

    with torch.inference_mode():
        wavs, sr = model.generate_voice_clone(
            text=text,
            language="Russian",
            voice_clone_prompt=prompt,
            temperature=0.65,
            top_p=0.85,
        )

    sf.write(filename, wavs[0], sr)
    print("Saved:", filename, flush=True)

print("KITSUNE V7: ALL OK")
