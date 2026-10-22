import {
  TranscriptionError,
  type TranscriptInput,
  type TranscriptionOptions,
  type TranscriptProvider,
  type TranscriptResult,
} from "@/types/transcript";
import { z } from "zod";

const ResponseSchema = z.object({
  language: z.string().nullable().optional(),
  duration: z.number().nullable().optional(),
  segments: z.array(z.object({ start: z.number(), end: z.number().nullable(), text: z.string() })),
});

export function validateEndpoint(raw: string): URL | null {
  try {
    const u = new URL(raw);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (u.username || u.password) return null;
    return u;
  } catch {
    return null;
  }
}

/**
 * Optional faster-whisper backend (see worker/README.md). The browser uploads the file
 * directly to the endpoint the user configured — typically their own machine.
 */
export function createRemoteWhisperProvider(endpoint: string, language: string): TranscriptProvider {
  return {
    id: "remote-whisper",
    label: "연결된 faster-whisper 서버",
    canHandle: (input) => input.kind === "media_file",
    async transcribe(input: TranscriptInput, options: TranscriptionOptions = {}): Promise<TranscriptResult> {
      if (input.kind !== "media_file")
        throw new TranscriptionError("invalid_input", "음성 파일이 필요합니다.");
      const base = validateEndpoint(endpoint);
      if (!base) throw new TranscriptionError("invalid_input", "전사 서버 주소가 올바르지 않습니다.");
      options.onStage?.("recognizing");
      const form = new FormData();
      form.append("file", input.file, input.file.name);
      form.append("language", language);
      let res: Response;
      try {
        res = await fetch(new URL("/transcribe", base), {
          method: "POST",
          body: form,
          signal: options.signal,
        });
      } catch (e) {
        if ((e as Error).name === "AbortError")
          throw new TranscriptionError("aborted", "작업을 취소했습니다.");
        throw new TranscriptionError(
          "network",
          "전사 서버에 연결하지 못했습니다. 서버가 실행 중인지 확인해 주세요.",
        );
      }
      if (!res.ok) throw new TranscriptionError("unknown", `전사 서버 오류 (${res.status})`);
      const parsed = ResponseSchema.safeParse(await res.json());
      if (!parsed.success)
        throw new TranscriptionError("unknown", "전사 서버 응답 형식이 올바르지 않습니다.");
      options.onStage?.("finalizing");
      return {
        method: "remote_whisper",
        language: parsed.data.language ?? language,
        durationMs: parsed.data.duration != null ? Math.round(parsed.data.duration * 1000) : null,
        warnings: [],
        segments: parsed.data.segments
          .filter((s) => s.text.trim())
          .map((s, i) => ({
            id: `w${String(i + 1).padStart(5, "0")}`,
            startMs: Math.round(s.start * 1000),
            endMs: s.end == null ? null : Math.round(s.end * 1000),
            text: s.text.trim(),
            source: "remote_asr" as const,
          })),
      };
    },
  };
}
