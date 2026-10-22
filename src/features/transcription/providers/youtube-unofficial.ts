import { parseVtt } from "../parsers";
import {
  TranscriptionError,
  type TranscriptInput,
  type TranscriptionOptions,
  type TranscriptProvider,
  type TranscriptResult,
} from "@/types/transcript";

/**
 * EXPERIMENTAL — isolated on purpose.
 * Reads the public caption track YouTube exposes to its own players via our server route.
 * This is not part of the official Data API: it can break without notice and its use must be
 * checked against YouTube's Terms of Service. Disabled unless BOTH the server env flag
 * (DAWN_UNOFFICIAL_CAPTIONS=enabled) and the user's setting are on.
 */
export const youtubeUnofficialProvider: TranscriptProvider = {
  id: "youtube-unofficial",
  label: "공개 자막 가져오기 (실험적)",
  canHandle: (input) => input.kind === "youtube",
  async transcribe(input: TranscriptInput, options: TranscriptionOptions = {}): Promise<TranscriptResult> {
    if (input.kind !== "youtube") throw new TranscriptionError("invalid_input", "YouTube 링크가 필요합니다.");
    options.onStage?.("checking_captions");
    let res: Response;
    try {
      res = await fetch(`/api/youtube/captions?id=${encodeURIComponent(input.videoId)}&lang=ko`, {
        signal: options.signal,
      });
    } catch (e) {
      if ((e as Error).name === "AbortError") throw new TranscriptionError("aborted", "작업을 취소했습니다.");
      throw new TranscriptionError("network", "네트워크 연결을 확인해 주세요.");
    }
    const body = (await res.json().catch(() => ({}))) as {
      error?: string;
      vtt?: string;
      language?: string;
      kind?: string;
    };
    if (res.status === 403 && body.error === "disabled") {
      throw new TranscriptionError(
        "provider_disabled",
        "이 서버에서는 공개 자막 가져오기가 비활성화되어 있습니다.",
      );
    }
    if (!res.ok || !body.vtt) {
      throw new TranscriptionError(
        res.status === 404 ? "no_captions" : res.status === 410 ? "video_unavailable" : "network",
        res.status === 404
          ? "이 영상에서는 접근 가능한 자막을 확보하지 못했습니다."
          : res.status === 410
            ? "삭제되었거나 비공개인 영상입니다."
            : "자막을 불러오는 중 문제가 발생했습니다.",
      );
    }
    options.onStage?.("loading_captions");
    const segments = parseVtt(body.vtt).map((s) => ({ ...s, source: "youtube_caption" as const }));
    if (!segments.length) throw new TranscriptionError("no_captions", "자막 트랙이 비어 있습니다.");
    const last = segments[segments.length - 1]!;
    return {
      segments,
      method: "youtube_unofficial",
      language: body.language ?? null,
      raw: { fileName: `${input.videoId}.${body.language ?? "captions"}.vtt`, content: body.vtt },
      durationMs: last.endMs ?? last.startMs,
      warnings: body.kind === "asr" ? ["YouTube 자동 생성 자막입니다. 오탈자가 있을 수 있습니다."] : [],
    };
  },
};
