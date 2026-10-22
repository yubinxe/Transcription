import type { SegmentSource, TranscriptSegment } from "@/types/transcript";

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  "#39": "'",
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+|#39);/gi, (m, code: string) => {
    const lower = code.toLowerCase();
    if (lower in ENTITIES) return ENTITIES[lower]!;
    if (lower.startsWith("#x")) {
      const n = parseInt(lower.slice(2), 16);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    if (lower.startsWith("#")) {
      const n = parseInt(lower.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return m;
  });
}

/** Removes markup (<i>, <c.color>, <00:00:01.000>, {\an8}) and collapses whitespace. */
export function cleanCueText(s: string): string {
  return decodeEntities(
    s
      .replace(/<\d{2}:\d{2}(?::\d{2})?[.,]\d{3}>/g, "")
      .replace(/<\/?[a-z][^>]*>/gi, "")
      .replace(/\{\\[^}]*\}/g, ""),
  )
    .replace(/[​‎‏﻿]/g, "")
    .replace(/[ \t]+/g, " ")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .join("\n");
}

export function stripBom(s: string): string {
  return s.charCodeAt(0) === 0xfeff ? s.slice(1) : s;
}

export function normalizeNewlines(s: string): string {
  return s.replace(/\r\n?/g, "\n");
}

export interface RawCue {
  startMs: number | null;
  endMs: number | null;
  text: string;
  paragraphStart?: boolean;
}

/**
 * Normalises a cue list:
 *  - drops empty cues
 *  - removes YouTube "rolling" duplicate lines (a line repeated from the previous cue)
 *  - drops exact consecutive duplicates
 *  - repairs invalid / overlapping timestamps without discarding speech
 *  - sorts by start time when timestamps exist
 */
export function normalizeCues(cues: RawCue[], source: SegmentSource, idPrefix = "s"): TranscriptSegment[] {
  const timed = cues.every((c) => c.startMs != null);
  const ordered = timed ? [...cues].sort((a, b) => (a.startMs ?? 0) - (b.startMs ?? 0)) : cues;

  const out: RawCue[] = [];
  let prevLines: string[] = [];
  for (const cue of ordered) {
    const text = cleanCueText(cue.text);
    if (!text) continue;
    let lines = text.split("\n");
    // Rolling captions repeat the previous cue's line(s) at the top.
    while (lines.length > 1 && prevLines.includes(lines[0]!)) lines = lines.slice(1);
    if (lines.length === 1 && prevLines.length > 0 && prevLines[prevLines.length - 1] === lines[0]) {
      // Pure repeat of the previous line. Extend the previous cue instead of duplicating.
      const last = out[out.length - 1];
      if (last && cue.endMs != null && (last.endMs == null || cue.endMs > last.endMs)) last.endMs = cue.endMs;
      prevLines = text.split("\n");
      continue;
    }
    prevLines = text.split("\n");
    out.push({
      startMs: cue.startMs,
      endMs: cue.endMs,
      text: lines.join(" "),
      paragraphStart: cue.paragraphStart,
    });
  }

  for (let i = 0; i < out.length; i++) {
    const c = out[i]!;
    const next = out[i + 1];
    if (c.startMs != null && c.startMs < 0) c.startMs = 0;
    if (c.startMs != null && c.endMs != null && c.endMs < c.startMs) c.endMs = null;
    if (c.endMs == null && c.startMs != null && next?.startMs != null && next.startMs >= c.startMs) {
      c.endMs = next.startMs;
    }
    // Overlap: trim the end so the active-segment lookup stays unambiguous. Text is untouched.
    if (
      c.endMs != null &&
      next?.startMs != null &&
      c.endMs > next.startMs &&
      next.startMs >= (c.startMs ?? 0)
    ) {
      c.endMs = next.startMs;
    }
  }

  return out.map((c, i) => ({
    id: `${idPrefix}${String(i + 1).padStart(5, "0")}`,
    startMs: c.startMs,
    endMs: c.endMs,
    text: c.text,
    source,
    ...(c.paragraphStart ? { paragraphStart: true } : {}),
  }));
}
