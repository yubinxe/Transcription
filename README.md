# 새벽기록 · DAWN ARCHIVE

> 들은 말씀을, 오래 남는 문장으로.

YouTube 영상·음성을 텍스트로 옮기고, 영상과 시간 단위로 연결해 다시 읽고, 붙잡은 문장을 묵상 노트로 남기는 개인용 기록 도구. 계정 없이 이 브라우저(IndexedDB)에만 저장됩니다.

## 실행

```bash
npm install          # .npmrc가 onnxruntime-node 바이너리 다운로드를 건너뜀
npm run dev          # http://localhost:3000
npm run build && npm start
```

검증: `npm run typecheck && npm run lint && npm test && npm run test:e2e`

## 기능
- YouTube 링크(일반·단축·Shorts·live·embed·모바일 공유 문구 포함) 파싱, 추적 파라미터 제거, 중복 기록 방지, oEmbed 미리보기
- 전사 경로: YouTube **스크립트 표시** 붙여넣기 · SRT/VTT/TXT · 기기 내 Whisper(WebGPU/WASM, Web Worker) · faster-whisper 서버(선택) · YouTube Data API OAuth(본인 영상, 선택) · 공개 자막(실험, 기본 꺼짐)
- 읽기: 문단/문장 보기, 타임스탬프 클릭 재생, 재생 중 문장 강조·자동 스크롤, 문장 반복, 검색, 교정(원본 보존·되돌리기·복원), 글자 크기·행간·폭, 마지막 읽던 위치
- 묵상: 문장 저장(타임스탬프 포함), 묵상 칸에 원문 인용, 말씀 연구 4영역 + 묵상 5영역 자동 저장, 문장별 메모, 묵상 완료
- 아카이브: 분류 필터, 전체 텍스트 검색(제목·원문·인용·메모), 2026 가을 특별새벽부흥회 Day 01–06 컬렉션
- 내보내기: TXT · Markdown · SRT · VTT(타임스탬프 있을 때만) · JSON · 클립보드, 범위 5종
- JSON 백업/복원(합치기·바꾸기), 저장 공간·영구 보관 요청

## 배포 (Vercel)
일반 Next.js 프로젝트로 배포. 서버 기능은 oEmbed 프록시뿐이라 무료 플랜으로 충분합니다. 음성 인식은 사용자 브라우저에서 실행되므로 서버 GPU 비용이 없습니다. 환경 변수는 `.env.example` 참고.

## 비용
- 기본: 0원. 유료 API 없음.
- 사용자 측: Whisper 모델 최초 다운로드 데이터(수십~수백 MB, 이후 캐시).
- 선택: faster-whisper를 클라우드 GPU에서 돌릴 경우 해당 호스팅 비용.

자세한 내용: `docs/ARCHITECTURE.md`, `docs/DESIGN_SYSTEM.md`, `docs/DECISIONS.md`, `worker/README.md`.

개인 말씀 학습을 위해 제작된 비공식 기록 도구입니다. 특정 교회나 단체의 공식 서비스가 아닙니다.
