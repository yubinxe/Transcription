/** Small in-memory sliding-window limiter. Per serverless instance; a guard, not a quota system. */
const buckets = new Map<string, number[]>();

export function rateLimit(key: string, limit = 30, windowMs = 60_000): boolean {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) {
    buckets.set(key, hits);
    return false;
  }
  hits.push(now);
  buckets.set(key, hits);
  if (buckets.size > 5000) buckets.clear();
  return true;
}

export function clientKey(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
}

/** Fetch with timeout and a hard rule: only https YouTube hosts. Prevents SSRF. */
const ALLOWED = new Set(["www.youtube.com", "youtube.com"]);

export async function fetchYouTube(url: string, init: RequestInit = {}, timeoutMs = 8000): Promise<Response> {
  const u = new URL(url);
  if (u.protocol !== "https:" || !ALLOWED.has(u.hostname)) throw new Error("blocked host");
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(u, { ...init, signal: ctrl.signal, redirect: "manual", cache: "no-store" });
  } finally {
    clearTimeout(t);
  }
}
