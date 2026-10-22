# faster-whisper 로컬 서버 (선택)

브라우저 내 Whisper보다 빠르고 정확한 전사가 필요할 때, **내 컴퓨터**에서 실행하는 선택형 백엔드입니다.
Vercel 같은 프런트엔드 호스팅에는 GPU 추론 서버가 포함되지 않습니다. 이 서버는 로컬 또는 별도 GPU 머신에서 실행해야 합니다.

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r worker/requirements.txt
DAWN_MODEL=large-v3-turbo DAWN_ALLOWED_ORIGINS=http://localhost:3000 python worker/server.py
```

- 첫 실행 시 Hugging Face에서 모델을 내려받습니다 (`small` ≈ 수백 MB, `large-v3-turbo` ≈ 1.5GB 내외).
- NVIDIA GPU: `DAWN_DEVICE=cuda DAWN_COMPUTE=float16`, CPU: `DAWN_COMPUTE=int8`.
- 새벽기록 → 설정 → 음성 인식 → **faster-whisper 서버**, 주소 `http://127.0.0.1:8765`.
- 배포된 HTTPS 사이트에서 `http://127.0.0.1`로 요청하는 것은 Chrome에서 허용되지만, 다른 기기의 HTTP 주소는 혼합 콘텐츠로 차단됩니다. 원격 서버는 HTTPS로 운영하세요.
