import type { TranscriptMethod, TranscriptSegment } from "./transcript";

export type RecordKind = "sermon" | "lecture" | "interview" | "other";

export const RECORD_KIND_LABEL: Record<RecordKind, string> = {
  sermon: "말씀",
  lecture: "강연",
  interview: "인터뷰",
  other: "기타",
};

export type RecordStatus = "draft" | "needs_input" | "transcribing" | "ready" | "error";

export interface RecordSource {
  type: "youtube" | "file" | "text";
  url?: string;
  videoId?: string;
  channel?: string;
  channelUrl?: string;
  thumbnailUrl?: string;
  fileName?: string;
  mimeType?: string;
}

/** Sermon-specific metadata (domain module). Every field is user-entered; nothing is inferred. */
export interface SermonMeta {
  preacher?: string;
  church?: string;
  event?: string;
  date?: string;
  scripture?: string;
  theme?: string;
}

export interface ArchiveRecord {
  id: string;
  kind: RecordKind;
  title: string;
  source: RecordSource;
  status: RecordStatus;
  method?: TranscriptMethod;
  durationMs?: number | null;
  sermon?: SermonMeta;
  tags: string[];
  note?: string;
  createdAt: number;
  updatedAt: number;
  lastReadSegmentId?: string | null;
  reflectionDone?: boolean;
  hasMedia?: boolean;
}

export interface EditEntry {
  segmentId: string;
  before: string;
  after: string;
  at: number;
}

export interface TranscriptDoc {
  recordId: string;
  /** Immutable original. Never rewritten after creation. */
  original: TranscriptSegment[];
  /** User edits keyed by segment id. Absent key = original text. */
  edits: Record<string, string>;
  history: EditEntry[];
  raw?: { fileName: string; content: string } | null;
  language?: string | null;
  updatedAt: number;
}

export type ReflectionKey = "remains" | "thesis" | "learned" | "apply" | "prayer";
export type StudyKey = "scripture" | "questions" | "application" | "prayerTopics";

export interface Highlight {
  id: string;
  recordId: string;
  segmentIds: string[];
  quote: string;
  startMs: number | null;
  note: string;
  /** Where this quote is attached, if any. */
  attachedTo?: ReflectionKey | StudyKey | null;
  createdAt: number;
}

export interface Reflection {
  recordId: string;
  sections: Record<ReflectionKey, string>;
  study: Record<StudyKey, string>;
  /** Per-segment notes */
  segmentNotes: Record<string, string>;
  updatedAt: number;
}

export interface MediaBlob {
  recordId: string;
  blob: Blob;
  name: string;
  type: string;
  size: number;
}

export interface CollectionDay {
  day: number;
  date: string; // ISO yyyy-mm-dd
  title?: string;
  preacher?: string;
  scripture?: string;
  videoUrl?: string;
  recordId?: string | null;
  sourceUrl?: string;
}

export interface Collection {
  id: string;
  title: string;
  description?: string;
  /** For dated series such as the revival week. */
  days?: CollectionDay[];
  recordIds: string[];
  createdAt: number;
  updatedAt: number;
}

export const EMPTY_REFLECTION_SECTIONS: Record<ReflectionKey, string> = {
  remains: "",
  thesis: "",
  learned: "",
  apply: "",
  prayer: "",
};
export const EMPTY_STUDY: Record<StudyKey, string> = {
  scripture: "",
  questions: "",
  application: "",
  prayerTopics: "",
};
