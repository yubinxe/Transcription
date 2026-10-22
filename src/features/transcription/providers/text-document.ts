import { parseTextDocument, FORMAT_LABEL } from "../parsers";
import {
  TranscriptionError,
  type TranscriptInput,
  type TranscriptProvider,
  type TranscriptResult,
} from "@/types/transcript";

export const MAX_TEXT_BYTES = 20 * 1024 * 1024;

/** SRT / VTT / TXT files and pasted text (including YouTube "스크립트 표시" copies). */
export const textDocumentProvider: TranscriptProvider = {
  id: "text-document",
  label: "자막·텍스트 가져오기",
  canHandle: (input) => input.kind === "caption_file" || input.kind === "pasted_text",
  async transcribe(input: TranscriptInput): Promise<TranscriptResult> {
    if (input.kind !== "caption_file" && input.kind !== "pasted_text") {
      throw new TranscriptionError("invalid_input", "지원하지 않는 입력입니다.");
    }
    const content = input.content;
    if (!content.trim()) throw new TranscriptionError("invalid_input", "비어 있는 내용입니다.");
    if (content.length > MAX_TEXT_BYTES) throw new TranscriptionError("file_too_large", "텍스트가 너무 큽니다 (20MB 초과).");
    const fileName = input.kind === "caption_file" ? input.fileName : "";
    const { format, segments } = parseTextDocument(content, fileName);
    if (segments.length === 0) {
      throw new TranscriptionError("invalid_input", "읽을 수 있는 문장을 찾지 못했습니다. 파일 내용을 확인해 주세요.");
    }
    const warnings: string[] = [];
    if (format === "plain_text") warnings.push("시간 정보가 없는 텍스트라 영상과 문장을 시간으로 연결할 수 없습니다.");
    const timed = segments.filter((s) => s.startMs != null);
    const last = timed[timed.length - 1];
    return {
      segments:
        input.kind === "pasted_text" && format === "timestamped_text"
          ? segments.map((s) => ({ ...s, source: "manual" as const }))
          : segments,
      method: input.kind === "caption_file" ? "uploaded_caption" : format === "timestamped_text" ? "pasted_transcript" : "manual",
      raw: { fileName: fileName || "붙여넣은 텍스트.txt", content },
      warnings: [`${FORMAT_LABEL[format]}로 인식했습니다.`, ...warnings],
      durationMs: last?.endMs ?? last?.startMs ?? null,
    };
  },
};
