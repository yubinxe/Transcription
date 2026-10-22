import type { TranscriptSegment } from "@/types/transcript";
import { normalizeCues, normalizeNewlines, stripBom, type RawCue } from "./normalize";

const TS = /(?:(\d{1,3}):)?(\d{1,2}):(\d{1,2})[.,](\d{1,3})/;

export function parseTimestamp(raw: string): number | null {
  const m = TS.exec(raw.trim());
  if (!m) return null;
  const h = Number(m[1] ?? 0);
  const min = Number(m[2]);
  const s = Number(m[3]);
  const frac = m[4]!.padEnd(3, "0");
  if (min > 59 || s > 59) return null;
  return ((h * 60 + min) * 60 + s) * 1000 + Number(frac);
}

const ARROW = /^\s*(\S+)\s+-->\s+(\S+)/;

function parseCueBlocks(body: string, isVtt: boolean): RawCue[] {
  const cues: RawCue[] = [];
  const blocks = body.split(/\n{2,}/);
  for (const block of blocks) {
    const lines = block.split("\n").filter((l) => l.trim() !== "");
    if (lines.length === 0) continue;
    if (isVtt && /^(NOTE|STYLE|REGION)\b/.test(lines[0]!)) continue;
    const arrowIdx = lines.findIndex((l) => l.includes("-->"));
    if (arrowIdx === -1) continue;
    const m = ARROW.exec(lines[arrowIdx]!);
    if (!m) continue;
    const startMs = parseTimestamp(m[1]!);
    const endMs = parseTimestamp(m[2]!);
    const text = lines.slice(arrowIdx + 1).join("\n");
    if (startMs == null) continue; // a broken cue timestamp can't be placed in time; text is kept in raw file
    cues.push({ startMs, endMs, text });
  }
  return cues;
}

export function parseSrt(content: string): TranscriptSegment[] {
  const body = normalizeNewlines(stripBom(content));
  return normalizeCues(parseCueBlocks(body, false), "uploaded_caption");
}

export function parseVtt(content: string): TranscriptSegment[] {
  const body = normalizeNewlines(stripBom(content)).replace(/^WEBVTT[^\n]*\n/, "");
  return normalizeCues(parseCueBlocks(body, true), "uploaded_caption");
}

export function looksLikeVtt(content: string): boolean {
  return /^﻿?WEBVTT/.test(content);
}

export function looksLikeSrt(content: string): boolean {
  return /\d{1,2}:\d{2}:\d{2},\d{3}\s+-->\s+\d{1,2}:\d{2}:\d{2},\d{3}/.test(content);
}
