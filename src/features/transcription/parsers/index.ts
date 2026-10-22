import type { TranscriptSegment } from "@/types/transcript";
import { looksLikeSrt, looksLikeVtt, parseSrt, parseVtt } from "./subtitles";
import { parsePlainText, parseTimestampedText } from "./plain-text";

export type DetectedFormat = "srt" | "vtt" | "timestamped_text" | "plain_text";

export interface ParsedDocument {
  format: DetectedFormat;
  segments: TranscriptSegment[];
}

/** Detects the format from extension and content, then parses. Never invents timing. */
export function parseTextDocument(content: string, fileName = ""): ParsedDocument {
  const ext = fileName.toLowerCase().split(".").pop() ?? "";
  if (ext === "vtt" || looksLikeVtt(content)) return { format: "vtt", segments: parseVtt(content) };
  if (ext === "srt" || looksLikeSrt(content)) return { format: "srt", segments: parseSrt(content) };
  const timed = parseTimestampedText(content);
  if (timed) return { format: "timestamped_text", segments: timed };
  return { format: "plain_text", segments: parsePlainText(content) };
}

export const FORMAT_LABEL: Record<DetectedFormat, string> = {
  srt: "SRT 자막",
  vtt: "WebVTT 자막",
  timestamped_text: "시간 표시가 있는 텍스트",
  plain_text: "일반 텍스트",
};

export { parseSrt, parseVtt, parseTimestamp } from "./subtitles";
export { parsePlainText, parseTimestampedText, splitSentences } from "./plain-text";
export { normalizeCues, cleanCueText } from "./normalize";
