"use client";
import { useSyncExternalStore } from "react";
import {
  TranscriptionError,
  type StageDetail,
  type TranscriptInput,
  type TranscriptProvider,
  type TranscriptResult,
  type TranscriptSegment,
  type TranscriptionStage,
} from "@/types/transcript";
import { saveMedia, saveTranscriptResult, updateRecord } from "@/lib/storage/repository";

export interface JobState {
  recordId: string;
  providerLabel: string;
  stage: TranscriptionStage;
  detail?: StageDetail;
  partial: TranscriptSegment[];
  error?: { code: TranscriptionError["code"]; message: string };
  warnings: string[];
  startedAt: number;
}

/**
 * In-memory job registry. Jobs survive client-side navigation but not a page reload —
 * the UI says so while a job is running.
 */
const jobs = new Map<string, JobState>();
const controllers = new Map<string, AbortController>();
const listeners = new Set<() => void>();
let version = 0;

function emit() {
  version++;
  listeners.forEach((l) => l());
}

function set(recordId: string, patch: Partial<JobState>) {
  const prev = jobs.get(recordId);
  if (!prev) return;
  jobs.set(recordId, { ...prev, ...patch });
  emit();
}

export function getJob(recordId: string) {
  return jobs.get(recordId);
}

export function clearJob(recordId: string) {
  jobs.delete(recordId);
  emit();
}

export function cancelJob(recordId: string) {
  controllers.get(recordId)?.abort();
}

export function isAnyJobRunning() {
  return [...jobs.values()].some((j) => !["done", "error", "needs_input"].includes(j.stage));
}

export async function runJob(
  recordId: string,
  provider: TranscriptProvider,
  input: TranscriptInput,
  opts: { keepMedia?: boolean } = {},
): Promise<TranscriptResult | null> {
  controllers.get(recordId)?.abort();
  const controller = new AbortController();
  controllers.set(recordId, controller);
  jobs.set(recordId, {
    recordId,
    providerLabel: provider.label,
    stage: input.kind === "youtube" ? "checking_captions" : "finalizing",
    partial: [],
    warnings: [],
    startedAt: Date.now(),
  });
  emit();
  await updateRecord(recordId, { status: "transcribing" });

  try {
    if (input.kind === "media_file" && opts.keepMedia) {
      await saveMedia(recordId, input.file, input.file.name).catch(() => {
        set(recordId, {
          warnings: ["저장 공간이 부족해 원본 파일은 보관하지 못했습니다. 전사는 계속됩니다."],
        });
      });
    }
    const result = await provider.transcribe(input, {
      signal: controller.signal,
      language: "korean",
      onStage: (stage, detail) => set(recordId, { stage, detail }),
      onPartial: (partial) => set(recordId, { partial }),
    });
    set(recordId, { stage: "finalizing", detail: undefined });
    if (result.segments.length === 0) {
      set(recordId, {
        stage: "needs_input",
        warnings: result.warnings,
        error: { code: "no_captions", message: result.warnings[0] ?? "인식된 내용이 없습니다." },
      });
      await updateRecord(recordId, { status: "needs_input" });
      return null;
    }
    await saveTranscriptResult(recordId, result);
    set(recordId, { stage: "done", warnings: [...(getJob(recordId)?.warnings ?? []), ...result.warnings] });
    return result;
  } catch (e) {
    const err =
      e instanceof TranscriptionError
        ? e
        : e instanceof DOMException && e.name === "QuotaExceededError"
          ? new TranscriptionError(
              "quota_exceeded",
              "브라우저 저장 공간이 부족합니다. 설정에서 사용량을 확인해 주세요.",
            )
          : new TranscriptionError("unknown", e instanceof Error ? e.message : "알 수 없는 오류");
    const partial = (err as TranscriptionError & { partial?: TranscriptSegment[] }).partial;
    set(recordId, {
      stage: err.code === "aborted" ? "needs_input" : "error",
      error: { code: err.code, message: err.message },
      partial: partial ?? getJob(recordId)?.partial ?? [],
    });
    await updateRecord(recordId, { status: "needs_input" });
    return null;
  } finally {
    if (controllers.get(recordId) === controller) controllers.delete(recordId);
  }
}

/** Saves segments recognised before a cancel, so finished work isn't thrown away. */
export async function keepPartial(recordId: string) {
  const job = getJob(recordId);
  if (!job?.partial.length) return;
  const last = job.partial[job.partial.length - 1]!;
  await saveTranscriptResult(recordId, {
    segments: job.partial,
    method: "local_whisper",
    warnings: ["작업 도중 취소되어 일부만 전사되었습니다."],
    durationMs: last.endMs ?? last.startMs,
  });
  set(recordId, { stage: "done", warnings: ["작업 도중 취소되어 일부만 전사되었습니다."] });
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useJob(recordId: string | undefined): JobState | undefined {
  useSyncExternalStore(
    subscribe,
    () => version,
    () => 0,
  );
  return recordId ? jobs.get(recordId) : undefined;
}

export const STAGE_LABEL: Record<TranscriptionStage, string> = {
  validating_link: "링크 확인 중",
  fetching_metadata: "영상 정보 확인 중",
  checking_captions: "자막 접근 가능 여부 확인 중",
  loading_captions: "자막 불러오는 중",
  preparing_audio: "음성 분석 준비 중",
  downloading_model: "모델 다운로드 중",
  recognizing: "음성 인식 중",
  finalizing: "결과 정리 중",
  done: "완료",
  needs_input: "추가 입력 필요",
  error: "오류 발생",
};
