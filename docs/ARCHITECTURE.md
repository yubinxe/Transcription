# Architecture

```
src/
  app/                      routes: / · /record/[id] · /archive · /collections/[id] · /settings · /guide
    api/youtube/meta        oEmbed metadata (validated video id only; SSRF-safe host allowlist)
    api/youtube/captions    EXPERIMENTAL caption track reader (env-gated, off by default)
  components/               layout · home · record · transcript · player · reflection · archive · collection · settings · ui
  features/
    youtube/                URL parsing (strict host allowlist, tracking params dropped), metadata client
    transcription/
      parsers/              SRT · VTT · YouTube "스크립트 표시" paste · plain text; normalisation
      providers/            text-document · local-whisper · remote-whisper · youtube-oauth · youtube-unofficial
      longform.ts           sequential 30 s window decoding (no overlap duplication, no dropped speech)
      jobs.ts               job registry: stages, cancel, keep-partial
    export/                 TXT · MD · SRT · VTT · JSON, scopes, UTF-8 file names
    library/search.ts       library-wide full-text search
    scripture-study/        reflection & study sections (domain module)
    collections/            2026 autumn revival collection (dates only, no invented metadata)
  lib/storage/              Dexie DB, repository (data access layer), backup/restore, preferences
  workers/whisper.worker.ts Transformers.js Whisper in a Web Worker (WebGPU → WASM fallback)
worker/                     optional Python faster-whisper server (local / separate GPU host)
```

## Transcript acquisition paths
| Path | Works for | Status |
|---|---|---|
| Paste YouTube “스크립트 표시” | any video with a transcript panel | ✅ verified (unit + e2e) |
| SRT / VTT / TXT import | any | ✅ verified |
| On-device Whisper (Transformers.js) | user-provided audio/video | ⚠️ pipeline verified up to model download; actual Korean recognition **not verified in CI sandbox** (Hugging Face blocked) |
| faster-whisper server | user-provided audio/video | ⚠️ code provided, not executed here |
| YouTube Data API (OAuth) | videos the user owns/manages | ⚠️ requires `NEXT_PUBLIC_GOOGLE_CLIENT_ID`; not executed here |
| Link → text (public caption track, landing page) | public videos with a transcript | ⚠️ needs `DAWN_UNOFFICIAL_CAPTIONS=enabled`; YouTube unreachable from sandbox, so not verified live. Cloud IPs can be bot-checked by YouTube → paste fallback |

## Data model (IndexedDB `dawn-archive`)
`records` · `transcripts` (immutable `original` + `edits` + `history` + `raw` file) · `highlights` · `reflections` · `collections` (`days[]`, `recordIds[]`, many-to-many) · `media` (uploaded blobs, optional).
The repository layer is the only storage API used by the UI, so a Supabase / user-cloud adapter can replace it.

## AI summary (future)
Not implemented. Any future `SummaryProvider` must cite source segment ids, visually separate generated text, never generate scripture, and be editable. Core features never depend on it.
