/// <reference lib="webworker" />
import { pipeline, env, type AutomaticSpeechRecognitionPipeline } from "@huggingface/transformers";
import { planWindow, WINDOW_SECONDS, type WindowChunk } from "@/features/transcription/longform";
import { dtypeFor, getModel, type AsrDevice } from "@/features/transcription/models";
import { rms } from "@/features/transcription/audio";
import type { WorkerRequest, WorkerResponse } from "@/features/transcription/worker-protocol";

declare const self: DedicatedWorkerGlobalScope;

env.allowLocalModels = false;
env.useBrowserCache = true;

const SR = 16_000;
const SILENCE_RMS = 0.002;
let asr: AutomaticSpeechRecognitionPipeline | null = null;
let loadedKey = "";

function post(msg: WorkerResponse, transfer: Transferable[] = []) {
  self.postMessage(msg, transfer);
}

async function load(modelId: string, device: AsrDevice) {
  const key = `${modelId}:${device}`;
  if (asr && loadedKey === key) return asr;
  if (asr) {
    await asr.dispose().catch(() => undefined);
    asr = null;
  }
  const model = getModel(modelId);
  post({ type: "stage", stage: "downloading_model" });
  asr = (await pipeline("automatic-speech-recognition", model.repo, {
    device,
    dtype: dtypeFor(device, modelId),
    progress_callback: (p) => {
      if (p.status === "progress_total") post({ type: "download", loaded: p.loaded, total: p.total });
    },
  })) as AutomaticSpeechRecognitionPipeline;
  loadedKey = key;
  return asr;
}

async function transcribe(req: Extract<WorkerRequest, { type: "transcribe" }>) {
  const audio = req.audio;
  const transcriber = await load(req.modelId, req.device);
  post({ type: "stage", stage: "recognizing" });
  const win = WINDOW_SECONDS * SR;
  let seek = 0;
  while (seek < audio.length) {
    const end = Math.min(seek + win, audio.length);
    const slice = audio.subarray(seek, end);
    if (slice.length < SR * 0.3) break; // <0.3 s tail carries no decodable speech
    if (rms(slice) < SILENCE_RMS) {
      // Pure silence: Whisper hallucinates on silence, so skip it. Nothing audible is dropped.
      seek = end;
      post({ type: "window", segments: [], processedSamples: seek, totalSamples: audio.length });
      continue;
    }
    const out = (await transcriber(slice, {
      language: req.language,
      task: "transcribe",
      return_timestamps: true,
    })) as { text: string; chunks?: WindowChunk[] };
    const chunks: WindowChunk[] = out.chunks?.length
      ? out.chunks
      : [{ text: out.text, timestamp: [0, null] }];
    const plan = planWindow(chunks, seek, end, audio.length, SR);
    seek = plan.nextSeekSamples;
    post({
      type: "window",
      segments: plan.accepted,
      processedSamples: Math.min(seek, audio.length),
      totalSamples: audio.length,
    });
  }
  post({ type: "done" });
}

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const msg = e.data;
  try {
    if (msg.type === "load") {
      await load(msg.modelId, msg.device);
      post({ type: "ready" });
    } else if (msg.type === "transcribe") {
      await transcribe(msg);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const oom = /memory|allocation|OOM|out of/i.test(message);
    const net = /fetch|network|Failed to load|404|403/i.test(message);
    post({
      type: "error",
      code: oom ? "out_of_memory" : net ? "model_load_failed" : "unknown",
      message,
    });
  }
};
