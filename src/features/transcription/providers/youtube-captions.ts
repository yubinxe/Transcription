import { normalizeCues } from "../parsers";
import {
  CAPTIONS_ERROR_MESSAGE,
  type CaptionsError,
  type CaptionsResponse,
} from "@/features/youtube/timedtext";
import {
  TranscriptionError,
  type TranscriptInput,
  type TranscriptionOptions,
  type TranscriptProvider,
  type TranscriptResult,
  type TranscriptSegment,
} from "@/types/transcript";

export type CaptionsResult =
  | { ok: true; data: CaptionsResponse; segments: TranscriptSegment[] }
  | { ok: false; error: CaptionsError; message: string };

/** Fetches the public caption track (YouTube "스크립트 표시" text) through our server route. */
export async function fetchCaptions(
  videoId: string,
  lang = "ko",
  signal?: AbortSignal,
): Promise<CaptionsResult> {
  let res: Response;
  try {
    res = await fetch(
      `/api/youtube/captions?id=${encodeURIComponent(videoId)}&lang=${encodeURIComponent(lang)}`,
      { signal },
    );
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    return { ok: false, error: "network", message: CAPTIONS_ERROR_MESSAGE.network };
  }
  const body = (await res.json().catch(() => ({}))) as Partial<CaptionsResponse> & { error?: CaptionsError };
  if (!res.ok || !body.cues) {
    const error = body.error ?? "network";
    return { ok: false, error, message: CAPTIONS_ERROR_MESSAGE[error] ?? CAPTIONS_ERROR_MESSAGE.network };
  }
  const segments = normalizeCues(body.cues, "youtube_caption");
  return { ok: true, data: body as CaptionsResponse, segments };
}

export function captionsToResult(r: Extract<CaptionsResult, { ok: true }>): TranscriptResult {
  const last = r.segments[r.segments.length - 1];
  return {
    segments: r.segments,
    method: "youtube_captions",
    language: r.data.language,
    durationMs: last?.endMs ?? last?.startMs ?? null,
    warnings: r.data.kind === "asr" ? ["YouTube 자동 생성 자막입니다. 오탈자가 있을 수 있습니다."] : [],
  };
}

export const youtubeCaptionsProvider: TranscriptProvider = {
  id: "youtube-captions",
  label: "YouTube 자막 가져오기",
  canHandle: (input) => input.kind === "youtube",
  async transcribe(input: TranscriptInput, options: TranscriptionOptions = {}): Promise<TranscriptResult> {
    if (input.kind !== "youtube") throw new TranscriptionError("invalid_input", "YouTube 링크가 필요합니다.");
    options.onStage?.("loading_captions");
    const r = await fetchCaptions(input.videoId, "ko", options.signal);
    if (!r.ok) {
      const code =
        r.error === "no_captions"
          ? "no_captions"
          : r.error === "unavailable"
            ? "video_unavailable"
            : r.error === "disabled"
              ? "provider_disabled"
              : "network";
      throw new TranscriptionError(code, r.message);
    }
    return captionsToResult(r);
  },
};
