# Decisions

1. **Local-first, no account.** IndexedDB via Dexie; JSON backup/restore. Cloud sync deferred behind the repository layer.
2. **Whisper in the browser.** Transformers.js v4 + onnx-community multilingual checkpoints (base / small / large-v3-turbo). `.en` models excluded. WebGPU when an adapter exists, else WASM q8.
3. **Sequential long-form decoding** instead of overlapping chunks + text merge: re-decodes a truncated last segment at the head of the next window — no duplicated or deleted speech. Pure-silence windows (RMS < 0.002) are skipped to avoid Whisper hallucinations.
4. **Unofficial captions isolated** in one server route + one provider, double opt-in (server env + user toggle). No cookies, proxies or access-control bypass.
5. **Revival collection seeds dates only.** Sermon titles/preachers/passages could not be verified from the official site during development (site unreachable from the build sandbox; secondary sources conflicted), so they are user-entered with a source URL field.
6. **Fonts self-hosted** (OFL): no runtime dependency on font CDNs.
7. **Active-sentence highlighting is imperative** (DOM attribute toggled from a player store subscription) so long sermons never re-render per tick.
