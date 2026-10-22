import { getDb } from "./db";
import { createId } from "@/lib/utils/id";
import type {
  ArchiveRecord,
  Collection,
  Highlight,
  RecordKind,
  RecordSource,
  Reflection,
  TranscriptDoc,
} from "@/types/record";
import { EMPTY_REFLECTION_SECTIONS, EMPTY_STUDY } from "@/types/record";
import type { TranscriptResult, TranscriptSegment } from "@/types/transcript";

/**
 * Data access layer. UI talks only to these functions so the backing store
 * (IndexedDB today, Supabase / user cloud later) can be swapped.
 */

export async function createRecord(input: {
  title: string;
  kind?: RecordKind;
  source: RecordSource;
  durationMs?: number | null;
}): Promise<ArchiveRecord> {
  const now = Date.now();
  const record: ArchiveRecord = {
    id: createId("r"),
    kind: input.kind ?? "sermon",
    title: input.title.trim() || "제목 없는 기록",
    source: input.source,
    status: "draft",
    durationMs: input.durationMs ?? null,
    tags: [],
    createdAt: now,
    updatedAt: now,
  };
  await getDb().records.add(record);
  return record;
}

export async function getRecord(id: string) {
  return getDb().records.get(id);
}

export async function findRecordByVideoId(videoId: string) {
  return getDb().records.where("source.videoId").equals(videoId).first();
}

export async function updateRecord(id: string, patch: Partial<Omit<ArchiveRecord, "id" | "createdAt">>) {
  await getDb().records.update(id, { ...patch, updatedAt: Date.now() });
}

export async function listRecords(): Promise<ArchiveRecord[]> {
  return getDb().records.orderBy("updatedAt").reverse().toArray();
}

export async function deleteRecord(id: string) {
  const db = getDb();
  await db.transaction("rw", [db.records, db.transcripts, db.highlights, db.reflections, db.media, db.collections], async () => {
    await db.records.delete(id);
    await db.transcripts.delete(id);
    await db.highlights.where("recordId").equals(id).delete();
    await db.reflections.delete(id);
    await db.media.delete(id);
    // Remove membership and clear any day slot that pointed at the record.
    for (const c of await db.collections.toArray()) {
      if (!c.recordIds.includes(id) && !c.days?.some((d) => d.recordId === id)) continue;
      await db.collections.update(c.id, {
        recordIds: c.recordIds.filter((r) => r !== id),
        days: c.days?.map((d) => (d.recordId === id ? { ...d, recordId: null } : d)),
      });
    }
  });
}

/* ---------- transcripts ---------- */

export async function saveTranscriptResult(recordId: string, result: TranscriptResult) {
  const db = getDb();
  const doc: TranscriptDoc = {
    recordId,
    original: result.segments,
    edits: {},
    history: [],
    raw: result.raw ?? null,
    language: result.language ?? null,
    updatedAt: Date.now(),
  };
  await db.transaction("rw", db.transcripts, db.records, async () => {
    await db.transcripts.put(doc);
    const last = result.segments[result.segments.length - 1];
    const record = await db.records.get(recordId);
    await db.records.update(recordId, {
      status: result.segments.length ? "ready" : "needs_input",
      method: result.method,
      durationMs: result.durationMs ?? record?.durationMs ?? last?.endMs ?? last?.startMs ?? null,
      updatedAt: Date.now(),
    });
  });
  return doc;
}

export async function getTranscript(recordId: string) {
  return getDb().transcripts.get(recordId);
}

export async function editSegment(recordId: string, segmentId: string, text: string) {
  const db = getDb();
  await db.transaction("rw", db.transcripts, db.records, async () => {
    const doc = await db.transcripts.get(recordId);
    if (!doc) return;
    const original = doc.original.find((s) => s.id === segmentId);
    if (!original) return;
    const before = doc.edits[segmentId] ?? original.text;
    if (before === text) return;
    const edits = { ...doc.edits };
    if (text === original.text) delete edits[segmentId];
    else edits[segmentId] = text;
    const history = [...doc.history, { segmentId, before, after: text, at: Date.now() }].slice(-500);
    await db.transcripts.update(recordId, { edits, history, updatedAt: Date.now() });
    await db.records.update(recordId, { updatedAt: Date.now() });
  });
}

export async function restoreOriginal(recordId: string, segmentId?: string) {
  const db = getDb();
  const doc = await db.transcripts.get(recordId);
  if (!doc) return;
  if (segmentId) {
    const original = doc.original.find((s) => s.id === segmentId);
    if (original) await editSegment(recordId, segmentId, original.text);
    return;
  }
  await db.transcripts.update(recordId, {
    edits: {},
    history: [...doc.history, ...Object.entries(doc.edits).map(([segmentId, before]) => ({
      segmentId,
      before,
      after: doc.original.find((s) => s.id === segmentId)?.text ?? "",
      at: Date.now(),
    }))].slice(-500),
    updatedAt: Date.now(),
  });
}

export async function undoLastEdit(recordId: string) {
  const db = getDb();
  const doc = await db.transcripts.get(recordId);
  const last = doc?.history[doc.history.length - 1];
  if (!doc || !last) return null;
  const original = doc.original.find((s) => s.id === last.segmentId);
  const edits = { ...doc.edits };
  if (original && last.before === original.text) delete edits[last.segmentId];
  else edits[last.segmentId] = last.before;
  await db.transcripts.update(recordId, { edits, history: doc.history.slice(0, -1), updatedAt: Date.now() });
  return last;
}

export function effectiveSegments(doc: TranscriptDoc | undefined | null): TranscriptSegment[] {
  if (!doc) return [];
  return doc.original.map((s) => (doc.edits[s.id] != null ? { ...s, text: doc.edits[s.id]! } : s));
}

/* ---------- highlights & reflection ---------- */

export async function addHighlight(h: Omit<Highlight, "id" | "createdAt" | "note"> & { note?: string }) {
  const highlight: Highlight = { ...h, note: h.note ?? "", id: createId("h"), createdAt: Date.now() };
  await getDb().highlights.add(highlight);
  await getDb().records.update(h.recordId, { updatedAt: Date.now() });
  return highlight;
}

export async function updateHighlight(id: string, patch: Partial<Pick<Highlight, "note" | "attachedTo">>) {
  await getDb().highlights.update(id, patch);
}

export async function deleteHighlight(id: string) {
  await getDb().highlights.delete(id);
}

export async function listHighlights(recordId: string) {
  return getDb().highlights.where("recordId").equals(recordId).sortBy("createdAt");
}

export function emptyReflection(recordId: string): Reflection {
  return {
    recordId,
    sections: { ...EMPTY_REFLECTION_SECTIONS },
    study: { ...EMPTY_STUDY },
    segmentNotes: {},
    updatedAt: Date.now(),
  };
}

export async function getReflection(recordId: string): Promise<Reflection> {
  return (await getDb().reflections.get(recordId)) ?? emptyReflection(recordId);
}

export async function saveReflection(reflection: Reflection) {
  await getDb().reflections.put({ ...reflection, updatedAt: Date.now() });
  await getDb().records.update(reflection.recordId, { updatedAt: Date.now() });
}

/* ---------- media ---------- */

export async function saveMedia(recordId: string, file: Blob, name: string) {
  await getDb().media.put({ recordId, blob: file, name, type: file.type, size: file.size });
  await getDb().records.update(recordId, { hasMedia: true });
}

export async function getMedia(recordId: string) {
  return getDb().media.get(recordId);
}

/* ---------- collections ---------- */

export async function getCollection(id: string) {
  return getDb().collections.get(id);
}

export async function putCollection(c: Collection) {
  await getDb().collections.put({ ...c, updatedAt: Date.now() });
}

export async function listCollections() {
  return getDb().collections.orderBy("updatedAt").reverse().toArray();
}

export async function addToCollection(collectionId: string, recordId: string) {
  const c = await getDb().collections.get(collectionId);
  if (!c || c.recordIds.includes(recordId)) return;
  await getDb().collections.update(collectionId, { recordIds: [...c.recordIds, recordId], updatedAt: Date.now() });
}
