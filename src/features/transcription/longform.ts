/**
 * Sequential long-form decoding (the strategy used by OpenAI's reference Whisper):
 * decode a 30 s window, keep every *complete* timestamped segment, then move the
 * window to the start of the last, possibly truncated segment. Speech is never
 * dropped — a cut-off segment is simply re-decoded at the head of the next window —
 * and no overlap-merging heuristics are needed, so nothing is duplicated.
 */
export const WINDOW_SECONDS = 30;

export interface WindowChunk {
  text: string;
  timestamp: [number, number | null];
}

export interface WindowPlan {
  accepted: Array<{ startMs: number; endMs: number | null; text: string }>;
  nextSeekSamples: number;
}

export function planWindow(
  chunks: WindowChunk[],
  seekSamples: number,
  windowEndSamples: number,
  totalSamples: number,
  sampleRate: number,
): WindowPlan {
  const isLast = windowEndSamples >= totalSamples;
  const windowSec = (windowEndSamples - seekSamples) / sampleRate;
  let keep = chunks.filter((c) => c.text.trim().length > 0);
  let nextSeekSamples = windowEndSamples;

  if (!isLast && keep.length > 1) {
    const last = keep[keep.length - 1]!;
    const [start, end] = last.timestamp;
    const truncated = end == null || end > windowSec - 0.6;
    // Only re-decode when it moves us forward by at least one second (prevents stalls).
    if (truncated && start >= 1) {
      keep = keep.slice(0, -1);
      nextSeekSamples = seekSamples + Math.floor(start * sampleRate);
    }
  }

  const offsetMs = (seekSamples / sampleRate) * 1000;
  const accepted = keep.map((c) => {
    const startMs = Math.round(offsetMs + c.timestamp[0] * 1000);
    const endRaw = c.timestamp[1];
    const endMs = endRaw == null ? null : Math.round(offsetMs + Math.min(endRaw, windowSec) * 1000);
    return { startMs, endMs, text: c.text.trim() };
  });
  return { accepted, nextSeekSamples: Math.max(nextSeekSamples, seekSamples + sampleRate) };
}
