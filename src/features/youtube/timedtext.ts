import { decodeEntities } from "@/features/transcription/parsers/normalize";

export interface TimedCue {
  startMs: number;
  endMs: number | null;
  text: string;
}

/**
 * Parses YouTube's timedtext XML (`<transcript><text start="1.2" dur="3.4">…</text>`).
 * Entities are often double-encoded (`&amp;#39;`), so decoding runs twice.
 */
export function parseTimedTextXml(xml: string): TimedCue[] {
  const out: TimedCue[] = [];
  const re = /<text\b([^>]*)>([\s\S]*?)<\/text>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const attrs = m[1]!;
    const start = /\bstart="([\d.]+)"/.exec(attrs);
    if (!start) continue;
    const dur = /\bdur="([\d.]+)"/.exec(attrs);
    const text = decodeEntities(decodeEntities(m[2]!))
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!text) continue;
    const startMs = Math.round(Number(start[1]) * 1000);
    out.push({ startMs, endMs: dur ? startMs + Math.round(Number(dur[1]) * 1000) : null, text });
  }
  return out;
}

export interface CaptionTrackInfo {
  languageCode: string;
  name: string;
  kind: "asr" | "standard";
}

export interface CaptionsResponse {
  videoId: string;
  title: string | null;
  language: string;
  kind: "asr" | "standard";
  tracks: CaptionTrackInfo[];
  cues: TimedCue[];
}

export type CaptionsError =
  "invalid_id" | "no_captions" | "unavailable" | "blocked" | "network" | "disabled" | "rate_limited";

export const CAPTIONS_ERROR_MESSAGE: Record<CaptionsError, string> = {
  invalid_id: "영상 주소가 올바르지 않습니다.",
  no_captions: "이 영상에는 공개된 자막(스크립트)이 없습니다.",
  unavailable: "비공개·삭제·연령 제한 등으로 열 수 없는 영상입니다.",
  blocked:
    "YouTube가 서버의 요청을 일시적으로 막았습니다. 잠시 후 다시 시도하거나 스크립트를 붙여넣어 주세요.",
  network: "YouTube에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.",
  disabled: "이 서버에서는 자막 자동 가져오기가 꺼져 있습니다.",
  rate_limited: "요청이 많습니다. 잠시 후 다시 시도해 주세요.",
};
