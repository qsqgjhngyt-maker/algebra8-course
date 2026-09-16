#!/usr/bin/env python3
# Kitsune Silero Local Bridge — loopback only, no cloud storage.
import io
import os
import wave
import numpy as np
import torch
from flask import Flask, request, jsonify, Response

HOST="127.0.0.1"
PORT=17865
ALLOWED_ORIGINS={
    "https://qsqgjhngyt-maker.github.io",
    "http://localhost",
    "http://127.0.0.1",
}

app=Flask(__name__)
model=None

def add_cors(response):
    origin=request.headers.get("Origin","")
    if origin in ALLOWED_ORIGINS:
        response.headers["Access-Control-Allow-Origin"]=origin
        response.headers["Vary"]="Origin"
    response.headers["Cache-Control"]="no-store"
    response.headers["X-Content-Type-Options"]="nosniff"
    return response

@app.after_request
def after(response):
    return add_cors(response)

@app.route("/health",methods=["GET","OPTIONS"])
def health():
    if request.method=="OPTIONS":
        return Response(status=204)
    return jsonify(ok=True,engine="silero-v5_5_ru",speakers=["xenia","kseniya"])

def get_model():
    global model
    if model is None:
        print("Первый запуск: загружаю Silero TTS v5.5 локально...")
        model,_=torch.hub.load(
            repo_or_dir="snakers4/silero-models",
            model="silero_tts",
            language="ru",
            speaker="v5_5_ru",
            trust_repo=True,
        )
        model.to(torch.device("cpu"))
    return model

@app.route("/tts",methods=["POST","OPTIONS"])
def tts():
    if request.method=="OPTIONS":
        return Response(status=204)

    data=request.get_json(silent=True) or {}
    text=str(data.get("text","")).strip()
    speaker=str(data.get("speaker","xenia")).strip().lower()

    if speaker not in {"xenia","kseniya"}:
        return jsonify(error="invalid_speaker"),400
    if not text or len(text)>900:
        return jsonify(error="invalid_text"),400

    audio=get_model().apply_tts(
        text=text,
        speaker=speaker,
        sample_rate=48000,
        put_accent=True,
        put_yo=True,
    )
    arr=np.asarray(audio,dtype=np.float32)
    arr=np.clip(arr,-1.0,1.0)
    pcm=(arr*32767.0).astype(np.int16)

    buf=io.BytesIO()
    with wave.open(buf,"wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(48000)
        wav.writeframes(pcm.tobytes())
    return Response(buf.getvalue(),mimetype="audio/wav",headers={"Cache-Control":"no-store"})

if __name__=="__main__":
    print(f"Kitsune Silero Local Bridge: http://{HOST}:{PORT}")
    print("Данные не отправляются на сервер приложения; процесс слушает только 127.0.0.1.")
    app.run(host=HOST,port=PORT,debug=False,threaded=False)
