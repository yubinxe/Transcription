import type { AsrDevice } from "./models";
import type { TranscriptionStage } from "@/types/transcript";

export type WorkerRequest =
  | { type: "load"; modelId: string; device: AsrDevice }
  | { type: "transcribe"; audio: Float32Array; modelId: string; device: AsrDevice; language: string };

export type WorkerResponse =
  | { type: "stage"; stage: TranscriptionStage }
  | { type: "download"; loaded: number; total: number }
  | { type: "ready" }
  | {
      type: "window";
      segments: Array<{ startMs: number; endMs: number | null; text: string }>;
      processedSamples: number;
      totalSamples: number;
    }
  | { type: "done" }
  | { type: "error"; code: "out_of_memory" | "model_load_failed" | "unknown"; message: string };
