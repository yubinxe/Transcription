import { decodeToMono16k, validateMediaFile, ASR_SAMPLE_RATE } from "../audio";
import type { AsrDevice } from "../models";
import type { WorkerRequest, WorkerResponse } from "../worker-protocol";
import {
  TranscriptionError,
  type TranscriptInput,
  type TranscriptionOptions,
  type TranscriptProvider,
  type TranscriptResult,
  type TranscriptSegment,
} from "@/types/transcript";

export interface LocalWhisperConfig {
  modelId: string;
  device: AsrDevice;
  language: string;
}

/**
 * Runs multilingual Whisper fully in the browser (Transformers.js + ONNX Runtime Web)
 * inside a Web Worker. Audio never leaves the device; only model weights are downloaded.
 */
export function createLocalWhisperProvider(config: LocalWhisperConfig): TranscriptProvider {
  return {
    id: "local-whisper",
    label: "이 기기에서 음성 인식",
    canHandle: (input) => input.kind === "media_file",
    async transcribe(input: TranscriptInput, options: TranscriptionOptions = {}): Promise<TranscriptResult> {
      if (input.kind !== "media_file") throw new TranscriptionError("invalid_input", "음성 파일이 필요합니다.");
      validateMediaFile(input.file);
      const { signal, onStage, onPartial } = options;
      if (signal?.aborted) throw new TranscriptionError("aborted", "작업을 취소했습니다.");

      onStage?.("preparing_audio");
      const audio = await decodeToMono16k(input.file);
      if (signal?.aborted) throw new TranscriptionError("aborted", "작업을 취소했습니다.");
      const durationMs = Math.round((audio.length / ASR_SAMPLE_RATE) * 1000);

      const worker = new Worker(new URL("../../../workers/whisper.worker.ts", import.meta.url), { type: "module" });
      const segments: TranscriptSegment[] = [];

      return new Promise<TranscriptResult>((resolve, reject) => {
        const finish = (fn: () => void) => {
          signal?.removeEventListener("abort", onAbort);
          worker.terminate();
          fn();
        };
        const onAbort = () =>
          finish(() => {
            const err = new TranscriptionError("aborted", "작업을 취소했습니다.");
            (err as TranscriptionError & { partial?: TranscriptSegment[] }).partial = segments.slice();
            reject(err);
          });
        signal?.addEventListener("abort", onAbort, { once: true });

        worker.onerror = (e) =>
          finish(() => reject(new TranscriptionError("model_load_failed", `음성 인식 엔진을 시작하지 못했습니다. ${e.message ?? ""}`.trim())));

        worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
          const msg = e.data;
          switch (msg.type) {
            case "stage":
              onStage?.(msg.stage);
              break;
            case "download":
              onStage?.("downloading_model", {
                loadedBytes: msg.loaded,
                totalBytes: msg.total,
                progress: msg.total > 0 ? msg.loaded / msg.total : undefined,
              });
              break;
            case "window": {
              for (const s of msg.segments) {
                segments.push({
                  id: `a${String(segments.length + 1).padStart(5, "0")}`,
                  startMs: s.startMs,
                  endMs: s.endMs,
                  text: s.text,
                  source: "local_asr",
                  confidence: null,
                });
              }
              onPartial?.(segments.slice());
              onStage?.("recognizing", { progress: msg.processedSamples / msg.totalSamples });
              break;
            }
            case "done":
              finish(() => {
                onStage?.("finalizing");
                // Fill missing end times from the next start so time sync stays continuous.
                for (let i = 0; i < segments.length; i++) {
                  const s = segments[i]!;
                  if (s.endMs == null) s.endMs = segments[i + 1]?.startMs ?? durationMs;
                }
                resolve({
                  segments,
                  method: "local_whisper",
                  language: config.language,
                  durationMs,
                  warnings: segments.length === 0 ? ["인식된 음성이 없습니다. 음량이나 파일을 확인해 주세요."] : [],
                });
              });
              break;
            case "error":
              finish(() =>
                reject(
                  new TranscriptionError(
                    msg.code,
                    msg.code === "out_of_memory"
                      ? "기기 메모리가 부족합니다. 더 가벼운 모델을 선택하거나 파일을 나눠 주세요."
                      : msg.code === "model_load_failed"
                        ? "음성 인식 모델을 내려받지 못했습니다. 네트워크 상태를 확인한 뒤 다시 시도해 주세요."
                        : `음성 인식 중 오류가 발생했습니다: ${msg.message}`,
                  ),
                ),
              );
              break;
          }
        };

        const req: WorkerRequest = {
          type: "transcribe",
          audio,
          modelId: config.modelId,
          device: config.device,
          language: config.language,
        };
        worker.postMessage(req, [audio.buffer]);
      });
    },
  };
}
