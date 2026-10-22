import { z } from "zod";
import { getDb } from "./db";

const BackupSchema = z.object({
  app: z.literal("dawn-archive"),
  kind: z.literal("backup"),
  version: z.literal(1),
  exportedAt: z.number(),
  records: z.array(z.object({ id: z.string(), title: z.string() }).passthrough()),
  transcripts: z.array(z.object({ recordId: z.string(), original: z.array(z.any()) }).passthrough()),
  highlights: z.array(z.object({ id: z.string(), recordId: z.string() }).passthrough()),
  reflections: z.array(z.object({ recordId: z.string() }).passthrough()),
  collections: z.array(z.object({ id: z.string() }).passthrough()),
});

export type BackupFile = z.infer<typeof BackupSchema>;

/** Full JSON backup. Uploaded media files are excluded (they can be large and are user-owned originals). */
export async function createBackup(): Promise<string> {
  const db = getDb();
  const [records, transcripts, highlights, reflections, collections] = await Promise.all([
    db.records.toArray(),
    db.transcripts.toArray(),
    db.highlights.toArray(),
    db.reflections.toArray(),
    db.collections.toArray(),
  ]);
  return JSON.stringify({
    app: "dawn-archive",
    kind: "backup",
    version: 1,
    exportedAt: Date.now(),
    records: records.map((r) => ({ ...r, hasMedia: false })),
    transcripts,
    highlights,
    reflections,
    collections,
  });
}

export interface RestoreSummary {
  records: number;
  highlights: number;
  collections: number;
}

export async function restoreBackup(json: string, mode: "merge" | "replace"): Promise<RestoreSummary> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("백업 파일을 읽을 수 없습니다. JSON 형식이 아닙니다.");
  }
  const result = BackupSchema.safeParse(parsed);
  if (!result.success) throw new Error("새벽기록 백업 파일이 아니거나 손상된 파일입니다.");
  const data = result.data;
  const db = getDb();
  await db.transaction("rw", [db.records, db.transcripts, db.highlights, db.reflections, db.collections, db.media], async () => {
    if (mode === "replace") {
      await Promise.all([
        db.records.clear(),
        db.transcripts.clear(),
        db.highlights.clear(),
        db.reflections.clear(),
        db.collections.clear(),
        db.media.clear(),
      ]);
    }
    // bulkPut: same id → backup wins (merge keeps unrelated local records).
    /* eslint-disable @typescript-eslint/no-explicit-any */
    await db.records.bulkPut(data.records as any);
    await db.transcripts.bulkPut(data.transcripts as any);
    await db.highlights.bulkPut(data.highlights as any);
    await db.reflections.bulkPut(data.reflections as any);
    await db.collections.bulkPut(data.collections as any);
    /* eslint-enable @typescript-eslint/no-explicit-any */
  });
  return { records: data.records.length, highlights: data.highlights.length, collections: data.collections.length };
}

export interface StorageEstimate {
  usage: number | null;
  quota: number | null;
  persisted: boolean | null;
}

export async function estimateStorage(): Promise<StorageEstimate> {
  if (typeof navigator === "undefined" || !navigator.storage) return { usage: null, quota: null, persisted: null };
  const [est, persisted] = await Promise.all([
    navigator.storage.estimate?.().catch(() => null),
    navigator.storage.persisted?.().catch(() => null),
  ]);
  return { usage: est?.usage ?? null, quota: est?.quota ?? null, persisted: persisted ?? null };
}

export async function requestPersistence(): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.storage?.persist) return false;
  return navigator.storage.persist();
}

export function formatBytes(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}
