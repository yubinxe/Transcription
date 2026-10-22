"use client";
import { createRecord, saveTranscriptResult, addToCollection } from "@/lib/storage/repository";
import { textDocumentProvider } from "./providers/text-document";
import { createMediaProvider } from "./provider-factory";
import { detectCapabilities } from "./capabilities";
import { runJob } from "./jobs";
import { validateMediaFile } from "./audio";
import { getPreferences } from "@/lib/storage/preferences";
import type { TranscriptInput } from "@/types/transcript";

function titleFromFile(name: string) {
  return name.replace(/\.[^.]+$/, "").replace(/[_]+/g, " ").trim();
}

export async function readTextFile(file: File): Promise<string> {
  if (file.size > 20 * 1024 * 1024) throw new Error("20MB를 넘는 텍스트 파일은 가져올 수 없습니다.");
  if (!/\.(srt|vtt|txt|md)$/i.test(file.name) && !file.type.startsWith("text/")) {
    throw new Error("SRT, VTT, TXT 파일만 가져올 수 있습니다.");
  }
  const buf = await file.arrayBuffer();
  // UTF-8 first (BOM is stripped by the parser); fall back to EUC-KR for legacy Korean subtitles.
  const utf8 = new TextDecoder("utf-8", { fatal: false }).decode(buf);
  if (!utf8.includes("�")) return utf8;
  try {
    return new TextDecoder("euc-kr").decode(buf);
  } catch {
    return utf8;
  }
}

/** Import a caption/text file or pasted text into a new record or an existing one. */
export async function importText(opts: {
  content: string;
  fileName?: string;
  title?: string;
  recordId?: string;
  collectionId?: string;
}): Promise<{ recordId: string; warnings: string[] }> {
  const input: TranscriptInput = opts.fileName
    ? { kind: "caption_file", fileName: opts.fileName, content: opts.content }
    : { kind: "pasted_text", content: opts.content };
  const result = await textDocumentProvider.transcribe(input);
  let recordId = opts.recordId;
  if (!recordId) {
    const record = await createRecord({
      title: opts.title || (opts.fileName ? titleFromFile(opts.fileName) : result.segments[0]?.text.slice(0, 40) ?? ""),
      source: { type: opts.fileName ? "file" : "text", fileName: opts.fileName },
    });
    recordId = record.id;
  }
  await saveTranscriptResult(recordId, result);
  if (opts.collectionId) await addToCollection(opts.collectionId, recordId);
  return { recordId, warnings: result.warnings };
}

/** Starts on-device (or configured server) speech recognition. Returns immediately. */
export async function startMediaTranscription(file: File, opts: { recordId?: string; collectionId?: string } = {}) {
  validateMediaFile(file);
  let recordId = opts.recordId;
  if (!recordId) {
    const record = await createRecord({
      title: titleFromFile(file.name),
      source: { type: "file", fileName: file.name, mimeType: file.type },
    });
    recordId = record.id;
  }
  if (opts.collectionId) await addToCollection(opts.collectionId, recordId);
  const prefs = getPreferences();
  const caps = prefs.asr.backend === "browser" ? await detectCapabilities() : null;
  const provider = createMediaProvider(prefs, caps);
  void runJob(recordId, provider, { kind: "media_file", file }, { keepMedia: prefs.keepMedia });
  return recordId;
}
