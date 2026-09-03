# Kitsune Voice Dialogue — components

- Transformers.js: `@huggingface/transformers@4.2.0`
- ASR model: `onnx-community/whisper-tiny`
- Base model: `openai/whisper-tiny`
- Task: automatic speech recognition
- Primary execution: WebGPU
- Fallback: WASM
- Audio input: browser `getUserMedia` + `MediaRecorder`
- Local resampling: mono 16 kHz Float32
- No external speech-recognition API.

The ONNX Community model is an ONNX conversion intended for Transformers.js.

The project does not bundle the Whisper model in the ZIP; it is prepared on first explicit user action and cached by the browser/model runtime.
