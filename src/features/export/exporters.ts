import type { ArchiveRecord, Highlight, Reflection, TranscriptDoc } from "@/types/record";
import type { TranscriptSegment } from "@/types/transcript";
import { formatClockLong, formatSrtTime, formatVttTime } from "@/lib/utils/time";
import { RECORD_KIND_LABEL } from "@/types/record";
import { REFLECTION_SECTIONS, STUDY_SECTIONS } from "@/features/scripture-study/sections";

export type ExportFormat = "txt" | "md" | "srt" | "vtt" | "json";
export type ExportScope = "original" | "edited" | "highlights" | "reflection" | "combined";

export const EXPORT_FORMAT_LABEL: Record<ExportFormat, string> = {
  txt: "텍스트 (.txt)",
  md: "Markdown (.md)",
  srt: "SRT 자막 (.srt)",
  vtt: "WebVTT 자막 (.vtt)",
  json: "JSON (.json)",
};

export const EXPORT_SCOPE_LABEL: Record<ExportScope, string> = {
  original: "전사 원문",
  edited: "편집한 원문",
  highlights: "기억할 문장",
  reflection: "묵상 노트",
  combined: "원문 + 묵상 통합본",
};

export interface ExportBundle {
  record: ArchiveRecord;
  transcript: TranscriptDoc | null;
  highlights: Highlight[];
  reflection: Reflection | null;
}

export function applyEdits(doc: TranscriptDoc | null, edited: boolean): TranscriptSegment[] {
  if (!doc) return [];
  if (!edited) return doc.original;
  return doc.original.map((s) => (doc.edits[s.id] != null ? { ...s, text: doc.edits[s.id]! } : s));
}

export function hasTimestamps(segments: TranscriptSegment[]): boolean {
  return segments.length > 0 && segments.every((s) => s.startMs != null);
}

/** SRT/VTT are only meaningful (and only allowed) with real timestamps. */
export function canExport(format: ExportFormat, scope: ExportScope, bundle: ExportBundle): boolean {
  if (format === "srt" || format === "vtt") {
    if (scope !== "original" && scope !== "edited") return false;
    return hasTimestamps(applyEdits(bundle.transcript, scope === "edited"));
  }
  return true;
}

function cueEnd(segments: TranscriptSegment[], i: number): number {
  const s = segments[i]!;
  if (s.endMs != null && s.endMs > (s.startMs ?? 0)) return s.endMs;
  const next = segments[i + 1];
  if (next?.startMs != null && next.startMs > (s.startMs ?? 0)) return next.startMs;
  return (s.startMs ?? 0) + 3000;
}

export function toSrt(segments: TranscriptSegment[]): string {
  if (!hasTimestamps(segments)) throw new Error("SRT는 타임스탬프가 있는 전사문에서만 만들 수 있습니다.");
  return (
    segments
      .map((s, i) => `${i + 1}\n${formatSrtTime(s.startMs!)} --> ${formatSrtTime(cueEnd(segments, i))}\n${s.text}`)
      .join("\n\n") + "\n"
  );
}

export function toVtt(segments: TranscriptSegment[]): string {
  if (!hasTimestamps(segments)) throw new Error("VTT는 타임스탬프가 있는 전사문에서만 만들 수 있습니다.");
  return (
    "WEBVTT\n\n" +
    segments
      .map((s, i) => `${formatVttTime(s.startMs!)} --> ${formatVttTime(cueEnd(segments, i))}\n${s.text}`)
      .join("\n\n") +
    "\n"
  );
}

/** Rebuilds readable paragraphs from segments. */
export function toParagraphs(segments: TranscriptSegment[]): TranscriptSegment[][] {
  const paras: TranscriptSegment[][] = [];
  let cur: TranscriptSegment[] = [];
  let chars = 0;
  segments.forEach((s, i) => {
    const prev = segments[i - 1];
    const gap = prev?.endMs != null && s.startMs != null ? s.startMs - prev.endMs : 0;
    const endsSentence = prev ? /[.!?。？！"”]$/.test(prev.text.trim()) : false;
    const breakHere =
      cur.length > 0 && (s.paragraphStart || gap > 2500 || (chars > 420 && endsSentence) || chars > 900);
    if (breakHere) {
      paras.push(cur);
      cur = [];
      chars = 0;
    }
    cur.push(s);
    chars += s.text.length;
  });
  if (cur.length) paras.push(cur);
  return paras;
}

export function toPlainText(segments: TranscriptSegment[], withTimestamps: boolean): string {
  if (withTimestamps && hasTimestamps(segments)) {
    return segments.map((s) => `[${formatClockLong(s.startMs!)}] ${s.text}`).join("\n") + "\n";
  }
  return (
    toParagraphs(segments)
      .map((p) => p.map((s) => s.text).join(" "))
      .join("\n\n") + "\n"
  );
}

function metaLines(record: ArchiveRecord): string[] {
  const m = record.sermon ?? {};
  const rows: Array<[string, string | undefined]> = [
    ["분류", RECORD_KIND_LABEL[record.kind]],
    ["설교자", m.preacher],
    ["교회·행사", [m.church, m.event].filter(Boolean).join(" · ") || undefined],
    ["일시", m.date],
    ["본문", m.scripture],
    ["주제", m.theme],
    ["출처", record.source.url ?? record.source.fileName],
    ["태그", record.tags.length ? record.tags.join(", ") : undefined],
  ];
  // Empty fields are omitted rather than filled with placeholders.
  return rows.filter(([, v]) => v && v.trim()).map(([k, v]) => `${k}: ${v}`);
}

function quoteLine(h: Highlight): string {
  const at = h.startMs != null ? ` — [${formatClockLong(h.startMs)}]` : "";
  return `> ${h.quote.replace(/\n/g, "\n> ")}${at}` + (h.note.trim() ? `\n\n${h.note.trim()}` : "");
}

export function toMarkdown(bundle: ExportBundle, scope: ExportScope): string {
  const { record, highlights, reflection } = bundle;
  const out: string[] = [`# ${record.title}`, ""];
  const meta = metaLines(record);
  if (meta.length) out.push(...meta, "");

  if (scope === "original" || scope === "edited" || scope === "combined") {
    const segs = applyEdits(bundle.transcript, scope !== "original");
    out.push(scope === "original" ? "## 말씀 원문 (전사 원본)" : "## 말씀 원문", "");
    if (hasTimestamps(segs)) {
      for (const p of toParagraphs(segs)) {
        out.push(`[${formatClockLong(p[0]!.startMs!)}] ${p.map((s) => s.text).join(" ")}`, "");
      }
    } else {
      out.push(toPlainText(segs, false).trim(), "");
    }
  }

  if (scope === "highlights" || scope === "combined") {
    if (highlights.length) {
      out.push("## 기억할 문장", "");
      for (const h of highlights) out.push(quoteLine(h), "");
    }
  }

  if ((scope === "reflection" || scope === "combined") && reflection) {
    const study = STUDY_SECTIONS.filter((s) => reflection.study[s.key]?.trim());
    if (study.length) {
      out.push("## 말씀 연구", "");
      for (const s of study) out.push(`### ${s.title}`, "", reflection.study[s.key].trim(), "");
    }
    const refl = REFLECTION_SECTIONS.filter(
      (s) => reflection.sections[s.key]?.trim() || highlights.some((h) => h.attachedTo === s.key),
    );
    if (refl.length) {
      out.push("## 나의 묵상", "");
      for (const s of refl) {
        out.push(`### ${s.title}`, "");
        for (const h of highlights.filter((x) => x.attachedTo === s.key)) out.push(quoteLine(h), "");
        if (reflection.sections[s.key]?.trim()) out.push(reflection.sections[s.key].trim(), "");
      }
    }
  }

  return out.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}

export function toTxt(bundle: ExportBundle, scope: ExportScope, withTimestamps = true): string {
  if (scope === "original" || scope === "edited") {
    return toPlainText(applyEdits(bundle.transcript, scope === "edited"), withTimestamps);
  }
  // Notes-oriented scopes reuse the markdown structure with markup stripped.
  return toMarkdown(bundle, scope)
    .replace(/^#{1,3} /gm, "")
    .replace(/^> /gm, "  ");
}

export function toJson(bundle: ExportBundle, scope: ExportScope): string {
  const payload: Record<string, unknown> = { app: "dawn-archive", version: 1, record: bundle.record };
  if (scope === "original" || scope === "combined") payload.segments = applyEdits(bundle.transcript, false);
  if (scope === "edited" || scope === "combined") payload.editedSegments = applyEdits(bundle.transcript, true);
  if (scope === "highlights" || scope === "combined" || scope === "reflection") payload.highlights = bundle.highlights;
  if (scope === "reflection" || scope === "combined") payload.reflection = bundle.reflection;
  return JSON.stringify(payload, null, 2);
}

export function renderExport(bundle: ExportBundle, format: ExportFormat, scope: ExportScope): string {
  switch (format) {
    case "srt":
      return toSrt(applyEdits(bundle.transcript, scope === "edited"));
    case "vtt":
      return toVtt(applyEdits(bundle.transcript, scope === "edited"));
    case "md":
      return toMarkdown(bundle, scope);
    case "json":
      return toJson(bundle, scope);
    default:
      return toTxt(bundle, scope);
  }
}

/** Keeps Hangul; strips characters invalid on Windows/macOS file systems. */
export function safeFileName(title: string, suffix: string, ext: ExportFormat | string): string {
  const base =
    title
      .normalize("NFC")
      .replace(/[\\/:*?"<>|\u0000-\u001f]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 80) || "새벽기록";
  return `${base}${suffix ? ` - ${suffix}` : ""}.${ext}`;
}

export const MIME: Record<ExportFormat, string> = {
  txt: "text/plain;charset=utf-8",
  md: "text/markdown;charset=utf-8",
  srt: "application/x-subrip;charset=utf-8",
  vtt: "text/vtt;charset=utf-8",
  json: "application/json;charset=utf-8",
};

export function downloadText(content: string, fileName: string, mime: string) {
  // BOM helps legacy Windows editors (Notepad) recognise UTF-8 Korean in .txt/.srt.
  const needsBom = /^(text\/plain|application\/x-subrip)/.test(mime);
  const blob = new Blob([needsBom ? "﻿" : "", content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
