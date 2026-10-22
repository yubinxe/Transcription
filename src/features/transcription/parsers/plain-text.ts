import type { SegmentSource, TranscriptSegment } from "@/types/transcript";
import { normalizeCues, normalizeNewlines, stripBom, type RawCue } from "./normalize";

/** "1:02:03", "02:03", "2:03" → ms */
function clockToMs(raw: string): number | null {
  const parts = raw.split(":").map(Number);
  if (parts.some((n) => !Number.isFinite(n))) return null;
  if (parts.length === 2) {
    const [m, s] = parts as [number, number];
    if (s > 59) return null;
    return (m * 60 + s) * 1000;
  }
  if (parts.length === 3) {
    const [h, m, s] = parts as [number, number, number];
    if (m > 59 || s > 59) return null;
    return ((h * 60 + m) * 60 + s) * 1000;
  }
  return null;
}

const CLOCK_ONLY = /^\(?\[?(\d{1,2}(?::\d{2}){1,2})\]?\)?$/;
const CLOCK_PREFIX = /^\[?(\d{1,2}(?::\d{2}){1,2})\]?[\s\t]+(.+)$/;
/** Accessibility labels YouTube's transcript panel includes when copied: "1분 5초", "3 seconds" */
const DURATION_LABEL = /^(\d+\s*(시간|분|초)\s*)+$|^(\d+\s*(hours?|minutes?|seconds?),?\s*)+$/i;

/**
 * Parses text copied from YouTube's "스크립트 표시" (Show transcript) panel, or any
 * text with leading clock markers such as "[00:01:12] ...".
 * Returns null when the text does not carry timestamps.
 */
export function parseTimestampedText(content: string): TranscriptSegment[] | null {
  const lines = normalizeNewlines(stripBom(content))
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const cues: RawCue[] = [];
  let pending: number | null = null;
  let markers = 0;

  for (const line of lines) {
    const only = CLOCK_ONLY.exec(line);
    if (only) {
      const ms = clockToMs(only[1]!);
      if (ms != null) {
        pending = ms;
        markers++;
        continue;
      }
    }
    const prefixed = CLOCK_PREFIX.exec(line);
    if (prefixed) {
      const ms = clockToMs(prefixed[1]!);
      if (ms != null) {
        cues.push({ startMs: ms, endMs: null, text: prefixed[2]! });
        pending = null;
        markers++;
        continue;
      }
    }
    if (DURATION_LABEL.test(line)) continue;
    if (pending != null) {
      cues.push({ startMs: pending, endMs: null, text: line });
      pending = null;
    } else if (cues.length > 0) {
      cues[cues.length - 1]!.text += `\n${line}`;
    }
  }
  // Require a meaningful share of timed lines, otherwise treat as plain text.
  if (markers < 2 || cues.length < 2) return null;
  return normalizeCues(
    cues.map((c) => ({ ...c, text: c.text.replace(/\n/g, " ") })),
    "manual",
  );
}

/** Korean/English sentence splitter that keeps punctuation and never drops text. */
export function splitSentences(paragraph: string): string[] {
  const text = paragraph.replace(/\s+/g, " ").trim();
  if (!text) return [];
  const parts = text.match(/[^.!?。？！]+(?:[.!?。？！]+["'”’)\]]*|$)\s*/g) ?? [text];
  const out: string[] = [];
  for (const p of parts) {
    const t = p.trim();
    if (!t) continue;
    // Merge very short fragments ("네.", "아멘.") into the previous sentence for readability.
    if (out.length > 0 && t.length < 4) out[out.length - 1] += ` ${t}`;
    else out.push(t);
  }
  return out;
}

/** Plain text without timestamps → sentence segments (no time sync). */
export function parsePlainText(content: string, source: SegmentSource = "manual"): TranscriptSegment[] {
  const paragraphs = normalizeNewlines(stripBom(content)).split(/\n\s*\n/);
  const cues: RawCue[] = [];
  for (const para of paragraphs) {
    const sentences = splitSentences(para);
    sentences.forEach((s, i) => {
      // Mark paragraph starts so the reader can rebuild paragraphs.
      cues.push({ startMs: null, endMs: null, text: i === 0 && cues.length > 0 ? ` ${s}` : s });
    });
  }
  return normalizeCues(cues, source);
}

