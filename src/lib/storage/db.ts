import Dexie, { type EntityTable } from "dexie";
import type {
  ArchiveRecord,
  Collection,
  Highlight,
  MediaBlob,
  Reflection,
  TranscriptDoc,
} from "@/types/record";

/** Local-first IndexedDB store. Large transcripts never touch localStorage. */
export class DawnDatabase extends Dexie {
  records!: EntityTable<ArchiveRecord, "id">;
  transcripts!: EntityTable<TranscriptDoc, "recordId">;
  highlights!: EntityTable<Highlight, "id">;
  reflections!: EntityTable<Reflection, "recordId">;
  collections!: EntityTable<Collection, "id">;
  media!: EntityTable<MediaBlob, "recordId">;

  constructor(name = "dawn-archive") {
    super(name);
    this.version(1).stores({
      records: "id, kind, status, updatedAt, createdAt, *tags, source.videoId",
      transcripts: "recordId, updatedAt",
      highlights: "id, recordId, createdAt",
      reflections: "recordId, updatedAt",
      collections: "id, updatedAt, *recordIds",
      media: "recordId",
    });
  }
}

let instance: DawnDatabase | null = null;

export function getDb(): DawnDatabase {
  if (!instance) instance = new DawnDatabase();
  return instance;
}

/** Test hook */
export function setDb(db: DawnDatabase | null) {
  instance = db;
}
