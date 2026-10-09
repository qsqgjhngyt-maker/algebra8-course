import torch
import soundfile as sf
from qwen_tts import Qwen3TTSModel
from kitsune_pronunciation import prepare_math_text

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

text = (
    "Привет! Сегодня мы будем изучать дроби. "
    "Сначала найдём числитель и знаменатель. "
    "А потом попробуем решить пример вместе!"
)

prepared = prepare_math_text(text)
print("TEXT:", prepared, flush=True)

torch.manual_seed(1729)
torch.cuda.manual_seed_all(1729)

with torch.inference_mode():
    wavs, sr = model.generate_voice_clone(
        text=prepared,
        language="Russian",
        voice_clone_prompt=prompt,
        temperature=0.65,
        top_p=0.85,
    )

sf.write("kitsune_v8_math_auto.wav", wavs[0], sr)
print("KITSUNE V8: OK")
