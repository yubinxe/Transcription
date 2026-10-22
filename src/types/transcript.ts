export type SegmentSource = "youtube_caption" | "uploaded_caption" | "local_asr" | "remote_asr" | "manual";

export interface TranscriptSegment {
  id: string;
  startMs: number | null;
  endMs: number | null;
  text: string;
  source: SegmentSource;
  confidence?: number | null;
  /** Starts a new paragraph (used when the source had paragraph breaks but no timing). */
  paragraphStart?: boolean;
}

export type TranscriptInput =
  | { kind: "youtube"; videoId: string; url: string }
  | { kind: "caption_file"; fileName: string; content: string }
  | { kind: "pasted_text"; content: string }
  | { kind: "media_file"; file: File };

export interface TranscriptionOptions {
  signal?: AbortSignal;
  language?: string;
  onStage?: (stage: TranscriptionStage, detail?: StageDetail) => void;
  onPartial?: (segments: TranscriptSegment[]) => void;
}

export interface StageDetail {
  /** 0..1 — only when actually measurable */
  progress?: number;
  message?: string;
  loadedBytes?: number;
  totalBytes?: number;
}

/** The user-visible pipeline stages. Percentages are only shown when measurable. */
export type TranscriptionStage =
  | "validating_link"
  | "fetching_metadata"
  | "checking_captions"
  | "loading_captions"
  | "preparing_audio"
  | "downloading_model"
  | "recognizing"
  | "finalizing"
  | "done"
  | "needs_input"
  | "error";

export type TranscriptMethod =
  | "youtube_oauth"
  | "youtube_captions"
  | "uploaded_caption"
  | "pasted_transcript"
  | "local_whisper"
  | "remote_whisper"
  | "manual";

export interface TranscriptResult {
  segments: TranscriptSegment[];
  method: TranscriptMethod;
  language?: string | null;
  /** Untouched original file content, if any. */
  raw?: { fileName: string; content: string } | null;
  warnings: string[];
  durationMs?: number | null;
}

export interface TranscriptProvider {
  readonly id: string;
  readonly label: string;
  canHandle(input: TranscriptInput): boolean;
  transcribe(input: TranscriptInput, options?: TranscriptionOptions): Promise<TranscriptResult>;
}

export class TranscriptionError extends Error {
  constructor(
    public readonly code:
      | "invalid_input"
      | "no_captions"
      | "caption_forbidden"
      | "network"
      | "video_unavailable"
      | "model_load_failed"
      | "webgpu_unsupported"
      | "out_of_memory"
      | "unsupported_file"
      | "file_too_large"
      | "quota_exceeded"
      | "aborted"
      | "provider_disabled"
      | "unknown",
    message: string,
  ) {
    super(message);
    this.name = "TranscriptionError";
  }
}
