"""
DAWN ARCHIVE — optional local faster-whisper server.

Runs on your own machine. The browser uploads the file directly here; nothing
goes to a third party. Endpoint contract (consumed by remote-whisper provider):

  POST /transcribe  multipart: file, language
  -> {"language": "ko", "duration": 123.4,
      "segments": [{"start": 0.0, "end": 3.2, "text": "..."}]}

Run:
  pip install -r worker/requirements.txt
  DAWN_MODEL=large-v3-turbo python worker/server.py
"""
import os
import tempfile

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from faster_whisper import WhisperModel

MODEL = os.environ.get("DAWN_MODEL", "small")  # multilingual only: never *.en for Korean
DEVICE = os.environ.get("DAWN_DEVICE", "auto")  # "cuda", "cpu" or "auto"
COMPUTE = os.environ.get("DAWN_COMPUTE", "default")  # e.g. "float16" on GPU, "int8" on CPU
ORIGINS = os.environ.get("DAWN_ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",")
MAX_BYTES = int(os.environ.get("DAWN_MAX_BYTES", str(2 * 1024**3)))

LANG = {"korean": "ko", "english": "en", "japanese": "ja", "chinese": "zh"}

app = FastAPI(title="DAWN ARCHIVE ASR worker")
app.add_middleware(CORSMiddleware, allow_origins=[o.strip() for o in ORIGINS if o.strip()], allow_methods=["POST", "GET"], allow_headers=["*"])
model = WhisperModel(MODEL, device=DEVICE, compute_type=COMPUTE)


@app.get("/health")
def health():
    return {"ok": True, "model": MODEL}


@app.post("/transcribe")
async def transcribe(file: UploadFile = File(...), language: str = Form("korean")):
    suffix = os.path.splitext(file.filename or "")[1][:8]
    size = 0
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=True) as tmp:
        while chunk := await file.read(1024 * 1024):
            size += len(chunk)
            if size > MAX_BYTES:
                raise HTTPException(413, "file too large")
            tmp.write(chunk)
        tmp.flush()
        segments, info = model.transcribe(
            tmp.name,
            language=LANG.get(language, language),
            task="transcribe",
            vad_filter=True,  # skip silence; avoids hallucinated text on quiet stretches
            condition_on_previous_text=False,
        )
        out = [{"start": round(s.start, 3), "end": round(s.end, 3), "text": s.text.strip()} for s in segments]
    return {"language": info.language, "duration": info.duration, "segments": out}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host=os.environ.get("DAWN_HOST", "127.0.0.1"), port=int(os.environ.get("DAWN_PORT", "8765")))
