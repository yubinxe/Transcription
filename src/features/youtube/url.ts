/**
 * Strict YouTube URL parsing. Only known YouTube hosts are accepted, the video id
 * is validated against the 11-char alphabet, and tracking parameters are dropped.
 */
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

const HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
  "youtu.be",
]);

export interface ParsedYouTubeUrl {
  videoId: string;
  /** Start offset in seconds when the link carried t= / start= */
  startSeconds: number | null;
  /** Canonical, tracking-free watch URL */
  canonicalUrl: string;
  isShorts: boolean;
  isLive: boolean;
}

export type ParseResult = { ok: true; value: ParsedYouTubeUrl } | { ok: false; reason: ParseFailure };
export type ParseFailure = "empty" | "not_url" | "not_youtube" | "no_video_id" | "playlist_only";

export const PARSE_FAILURE_MESSAGE: Record<ParseFailure, string> = {
  empty: "YouTube 영상 링크를 붙여넣어 주세요.",
  not_url: "링크 형식이 아닙니다. 주소 전체를 붙여넣어 주세요.",
  not_youtube: "YouTube 링크만 지원합니다.",
  no_video_id: "영상 주소를 찾지 못했습니다. 개별 영상의 링크인지 확인해 주세요.",
  playlist_only: "재생목록 링크입니다. 재생목록 안의 개별 영상 링크를 붙여넣어 주세요.",
};

export function isValidVideoId(id: string | null | undefined): id is string {
  return !!id && VIDEO_ID.test(id);
}

/** Parses 90, "90s", "1m30s", "1h2m3s" → seconds. */
export function parseTimeParam(raw: string | null): number | null {
  if (!raw) return null;
  if (/^\d+$/.test(raw)) return Number(raw);
  const m = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(raw);
  if (!m || (!m[1] && !m[2] && !m[3])) return null;
  return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
}

/** Pull the first URL-ish token out of pasted text (mobile share sheets add prose). */
export function extractUrlCandidate(input: string): string {
  const trimmed = input.trim();
  const match = /(https?:\/\/[^\s<>"']+|(?:www\.|m\.)?youtu(?:\.be|be\.com)\/[^\s<>"']+)/i.exec(trimmed);
  return match ? match[0] : trimmed;
}

export function parseYouTubeUrl(input: string): ParseResult {
  if (!input || !input.trim()) return { ok: false, reason: "empty" };
  let candidate = extractUrlCandidate(input);
  if (isValidVideoId(candidate)) candidate = `https://youtu.be/${candidate}`;
  if (!/^https?:\/\//i.test(candidate)) candidate = `https://${candidate}`;

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return { ok: false, reason: "not_url" };
  }
  const host = url.hostname.toLowerCase();
  if (!HOSTS.has(host)) return { ok: false, reason: "not_youtube" };
  if (url.protocol !== "https:" && url.protocol !== "http:") return { ok: false, reason: "not_url" };

  let id: string | null = null;
  let isShorts = false;
  let isLive = false;
  const parts = url.pathname.split("/").filter(Boolean);

  if (host === "youtu.be") {
    id = parts[0] ?? null;
  } else if (parts[0] === "watch") {
    id = url.searchParams.get("v");
  } else if (parts[0] === "shorts") {
    id = parts[1] ?? null;
    isShorts = true;
  } else if (parts[0] === "live") {
    id = parts[1] ?? null;
    isLive = true;
  } else if (parts[0] === "embed" || parts[0] === "v" || parts[0] === "e") {
    id = parts[1] ?? null;
  } else if (parts[0] === "attribution_link") {
    const inner = url.searchParams.get("u");
    if (inner) {
      try {
        id = new URL(inner, "https://www.youtube.com").searchParams.get("v");
      } catch {
        id = null;
      }
    }
  }

  if (!isValidVideoId(id)) {
    if (url.searchParams.get("list")) return { ok: false, reason: "playlist_only" };
    return { ok: false, reason: "no_video_id" };
  }

  const startSeconds = parseTimeParam(url.searchParams.get("t") ?? url.searchParams.get("start"));
  const canonicalUrl = `https://www.youtube.com/watch?v=${id}`;
  return { ok: true, value: { videoId: id, startSeconds, canonicalUrl, isShorts, isLive } };
}

export function thumbnailUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}
