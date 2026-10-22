import { DawnDatabase, setDb } from "@/lib/storage/db";
import {
  addHighlight,
  createRecord,
  deleteRecord,
  editSegment,
  effectiveSegments,
  findRecordByVideoId,
  getTranscript,
  listRecords,
  patchReflection,
  getReflection,
  putCollection,
  restoreOriginal,
  saveTranscriptResult,
  undoLastEdit,
  getCollection,
} from "@/lib/storage/repository";
import { createBackup, restoreBackup } from "@/lib/storage/backup";
import { searchLibrary } from "@/features/library/search";
import { parseSrt } from "@/features/transcription/parsers";

let n = 0;
beforeEach(() => {
  setDb(new DawnDatabase(`test-${++n}`));
});

const SRT =
  "1\n00:00:01,000 --> 00:00:03,000\n은혜와 평강이\n\n2\n00:00:03,000 --> 00:00:05,000\n있을지어다\n";

async function seed() {
  const r = await createRecord({
    title: "새벽 말씀",
    source: { type: "youtube", videoId: "dQw4w9WgXcQ", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
  });
  await saveTranscriptResult(r.id, { segments: parseSrt(SRT), method: "uploaded_caption", warnings: [] });
  return r;
}

describe("repository (IndexedDB)", () => {
  it("creates, lists and finds records", async () => {
    const r = await seed();
    expect((await listRecords()).map((x) => x.id)).toEqual([r.id]);
    expect((await findRecordByVideoId("dQw4w9WgXcQ"))?.id).toBe(r.id);
    const rec = (await listRecords())[0]!;
    expect(rec.status).toBe("ready");
    expect(rec.durationMs).toBe(5000);
  });

  it("keeps the original immutable while edits, undo and restore work", async () => {
    const r = await seed();
    const segId = (await getTranscript(r.id))!.original[0]!.id;
    await editSegment(r.id, segId, "은혜와 평강이 너희에게");
    let doc = await getTranscript(r.id);
    expect(doc!.original[0]!.text).toBe("은혜와 평강이");
    expect(effectiveSegments(doc)[0]!.text).toBe("은혜와 평강이 너희에게");
    expect(doc!.history).toHaveLength(1);

    await undoLastEdit(r.id);
    doc = await getTranscript(r.id);
    expect(doc!.edits).toEqual({});

    await editSegment(r.id, segId, "수정");
    await restoreOriginal(r.id);
    doc = await getTranscript(r.id);
    expect(effectiveSegments(doc)[0]!.text).toBe("은혜와 평강이");
  });

  it("stores reflections by merging, and deletes everything with the record", async () => {
    const r = await seed();
    await patchReflection(r.id, { sections: { thesis: "평강" } as never });
    await patchReflection(r.id, { segmentNotes: { s00001: "메모" } });
    const refl = await getReflection(r.id);
    expect(refl.sections.thesis).toBe("평강");
    expect(refl.segmentNotes.s00001).toBe("메모");

    await addHighlight({ recordId: r.id, segmentIds: ["s00001"], quote: "은혜와 평강이", startMs: 1000 });
    await putCollection({
      id: "c1",
      title: "C",
      recordIds: [r.id],
      days: [{ day: 1, date: "2026-10-19", recordId: r.id }],
      createdAt: 0,
      updatedAt: 0,
    });
    await deleteRecord(r.id);
    expect(await listRecords()).toHaveLength(0);
    expect(await getTranscript(r.id)).toBeUndefined();
    const c = await getCollection("c1");
    expect(c!.recordIds).toEqual([]);
    expect(c!.days![0]!.recordId).toBeNull();
  });

  it("searches titles, transcripts, highlights and notes", async () => {
    const r = await seed();
    await patchReflection(r.id, { sections: { prayer: "평강을 구합니다" } as never });
    const hits = await searchLibrary("평강");
    const fields = hits.map((h) => h.field);
    expect(fields).toContain("transcript");
    expect(fields).toContain("note");
    const t = hits.find((h) => h.field === "transcript")!;
    expect(t.startMs).toBe(1000);
    expect(t.snippet.slice(t.matchStart, t.matchStart + t.matchLength)).toBe("평강");
  });

  it("backs up and restores (merge and replace)", async () => {
    const r = await seed();
    await addHighlight({ recordId: r.id, segmentIds: [], quote: "있을지어다", startMs: 3000 });
    const json = await createBackup();

    setDb(new DawnDatabase(`test-restore-${n}`));
    await createRecord({ title: "다른 기록", source: { type: "text" } });
    const summary = await restoreBackup(json, "merge");
    expect(summary.records).toBe(1);
    expect(await listRecords()).toHaveLength(2);

    await restoreBackup(json, "replace");
    expect((await listRecords()).map((x) => x.title)).toEqual(["새벽 말씀"]);
    await expect(restoreBackup("{}", "merge")).rejects.toThrow();
    await expect(restoreBackup("not json", "merge")).rejects.toThrow();
  });
});
