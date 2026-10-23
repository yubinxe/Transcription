# 새벽기록 | DAWN ARCHIVE — development rules

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript strict · Tailwind v4 · Dexie (IndexedDB) · Zod · Transformers.js.

## Commands
- `npm run dev` / `npm run build` / `npm start`
- `npm run typecheck` · `npm run lint` · `npm test` (Vitest unit + IndexedDB integration)
- `npm run test:e2e` (Playwright; builds must exist: `npm run build` first). In this container:
  `LC_ALL=C.UTF-8 PW_CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome npm run test:e2e`
- `.npmrc` sets `onnxruntime-node-install=skip` (only the web runtime is used).

## Architecture rules
- Transcript sources are `TranscriptProvider`s (`src/features/transcription/providers`). Caption fetching and speech recognition stay separate.
- The unofficial YouTube caption route is isolated and off unless `DAWN_UNOFFICIAL_CAPTIONS=enabled` **and** the user toggles it.
- Never fabricate: no fake progress, no fake transcripts, no invented sermon metadata or scripture.
- `TranscriptDoc.original` is immutable; user edits live in `edits` + `history`.
- UI talks to storage only through `src/lib/storage/repository.ts`.
- Large data → IndexedDB. localStorage only for small preferences.

## Design rules
See `docs/DESIGN_SYSTEM.md`. Tokens in `src/app/globals.css`. Serif (MaruBuri) for reading/titles, Pretendard for UI.
Hairlines over cards, no gradients/glass/glow, radius ≤ 4px. `.eyebrow` (tracked caps) for Latin labels only; `.label` for Korean.
