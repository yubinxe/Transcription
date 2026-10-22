import type { TranscriptSegment } from "@/types/transcript";

/** Binary search: index of the segment playing at `ms`, or -1. Segments must be sorted by start. */
export function findActiveIndex(segments: TranscriptSegment[], ms: number): number {
  let lo = 0;
  let hi = segments.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const s = segments[mid]!.startMs;
    if (s == null) return -1;
    if (s <= ms) {
      ans = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  if (ans === -1) return -1;
  const seg = segments[ans]!;
  const end = seg.endMs ?? segments[ans + 1]?.startMs ?? Infinity;
  // Inside a long silence keep the previous line lit briefly, then none.
  return ms <= end + 1500 ? ans : -1;
}

export interface SearchMatch {
  segmentId: string;
  index: number;
  length: number;
}

export function findMatches(segments: TranscriptSegment[], query: string): SearchMatch[] {
  const q = query.trim().normalize("NFC").toLowerCase();
  if (!q) return [];
  const out: SearchMatch[] = [];
  for (const s of segments) {
    const hay = s.text.normalize("NFC").toLowerCase();
    let i = hay.indexOf(q);
    while (i !== -1) {
      out.push({ segmentId: s.id, index: i, length: q.length });
      i = hay.indexOf(q, i + q.length);
    }
  }
  return out;
}
