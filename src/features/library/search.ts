import { getDb } from "@/lib/storage/db";
import type { ArchiveRecord } from "@/types/record";
import { effectiveSegments } from "@/lib/storage/repository";

export interface SearchHit {
  record: ArchiveRecord;
  field: "title" | "meta" | "transcript" | "highlight" | "note";
  snippet: string;
  /** Match position inside snippet */
  matchStart: number;
  matchLength: number;
  segmentId?: string;
  startMs?: number | null;
}

/** Case-insensitive, NFC-normalised, whitespace-tolerant needle matching. */
export function normalizeForSearch(s: string): string {
  return s.normalize("NFC").toLowerCase();
}

export function makeSnippet(text: string, index: number, length: number, radius = 48) {
  const start = Math.max(0, index - radius);
  const end = Math.min(text.length, index + length + radius);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < text.length ? "…" : "";
  return {
    snippet: prefix + text.slice(start, end) + suffix,
    matchStart: prefix.length + (index - start),
  };
}

function findAll(text: string, needle: string, max: number): number[] {
  const hay = normalizeForSearch(text);
  const out: number[] = [];
  let i = hay.indexOf(needle);
  while (i !== -1 && out.length < max) {
    out.push(i);
    i = hay.indexOf(needle, i + needle.length);
  }
  return out;
}

/** Library-wide full-text search across titles, metadata, transcripts, highlights and notes. */
export async function searchLibrary(query: string, limitPerRecord = 5): Promise<SearchHit[]> {
  const needle = normalizeForSearch(query.trim());
  if (needle.length < 1) return [];
  const db = getDb();
  const [records, transcripts, highlights, reflections] = await Promise.all([
    db.records.toArray(),
    db.transcripts.toArray(),
    db.highlights.toArray(),
    db.reflections.toArray(),
  ]);
  const tById = new Map(transcripts.map((t) => [t.recordId, t]));
  const rById = new Map(reflections.map((r) => [r.recordId, r]));
  const hits: SearchHit[] = [];

  for (const record of records.sort((a, b) => b.updatedAt - a.updatedAt)) {
    const local: SearchHit[] = [];
    const push = (field: SearchHit["field"], text: string, extra: Partial<SearchHit> = {}) => {
      for (const idx of findAll(text, needle, limitPerRecord - local.length)) {
        const { snippet, matchStart } = makeSnippet(text, idx, needle.length);
        local.push({ record, field, snippet, matchStart, matchLength: needle.length, ...extra });
        if (local.length >= limitPerRecord) return;
      }
    };
    push("title", record.title);
    const meta = [
      record.sermon?.preacher,
      record.sermon?.scripture,
      record.sermon?.theme,
      record.sermon?.event,
      ...record.tags,
    ]
      .filter(Boolean)
      .join(" · ");
    if (local.length < limitPerRecord && meta) push("meta", meta);
    for (const seg of effectiveSegments(tById.get(record.id))) {
      if (local.length >= limitPerRecord) break;
      push("transcript", seg.text, { segmentId: seg.id, startMs: seg.startMs });
    }
    for (const h of highlights.filter((x) => x.recordId === record.id)) {
      if (local.length >= limitPerRecord) break;
      push("highlight", `${h.quote}${h.note ? ` — ${h.note}` : ""}`, { segmentId: h.segmentIds[0] });
    }
    const refl = rById.get(record.id);
    if (refl && local.length < limitPerRecord) {
      const notes = [
        ...Object.values(refl.sections),
        ...Object.values(refl.study),
        ...Object.values(refl.segmentNotes),
      ]
        .filter(Boolean)
        .join("\n");
      if (notes) push("note", notes);
    }
    hits.push(...local);
  }
  return hits;
}
