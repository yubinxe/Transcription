import { NextResponse } from "next/server";
import { isValidVideoId } from "@/features/youtube/url";
import {
  parseTimedTextXml,
  type CaptionsError,
  type CaptionsResponse,
  type CaptionTrackInfo,
} from "@/features/youtube/timedtext";
import { clientKey, fetchYouTube, rateLimit } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 20;

/**
 * Reads the public caption track (the same text YouTube shows under "스크립트 표시").
 * Not part of the official Data API: it can change without notice. No cookies, proxies or
 * access-control bypass — private, age-gated or bot-checked requests simply fail.
 * Off by default: the deployment owner opts in with DAWN_UNOFFICIAL_CAPTIONS=enabled.
 */
const ENABLED = process.env.DAWN_UNOFFICIAL_CAPTIONS === "enabled";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const ANDROID = { clientName: "ANDROID", clientVersion: "20.10.38", androidSdkVersion: 30, hl: "ko" };

function fail(error: CaptionsError, status: number) {
  return NextResponse.json({ error }, { status });
}

interface RawTrack {
  baseUrl: string;
  languageCode: string;
  kind?: string;
  name?: { simpleText?: string; runs?: Array<{ text: string }> };
}

async function readApiKey(videoId: string): Promise<string | CaptionsError> {
  const headers: Record<string, string> = { "User-Agent": UA, "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8" };
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetchYouTube(`https://www.youtube.com/watch?v=${videoId}&hl=ko`, { headers });
    // EU consent interstitial: answer it once with the standard consent cookie.
    if (res.status >= 300 && res.status < 400) {
      headers.Cookie = "CONSENT=YES+cb; SOCS=CAI";
      continue;
    }
    if (res.status === 429) return "blocked";
    if (!res.ok) return "network";
    const html = await res.text();
    if (html.includes('action="https://consent.youtube.com/s"')) {
      headers.Cookie = "CONSENT=YES+cb; SOCS=CAI";
      continue;
    }
    if (html.includes('class="g-recaptcha"')) return "blocked";
    const key = /"INNERTUBE_API_KEY":\s*"([A-Za-z0-9_-]+)"/.exec(html)?.[1];
    return key ?? "network";
  }
  return "blocked";
}

export async function GET(req: Request) {
  if (!ENABLED) return fail("disabled", 403);
  const params = new URL(req.url).searchParams;
  const id = params.get("id");
  const lang = (params.get("lang") ?? "ko").replace(/[^A-Za-z-]/g, "").slice(0, 12) || "ko";
  if (!isValidVideoId(id)) return fail("invalid_id", 400);
  if (!rateLimit(`cap:${clientKey(req)}`, 20)) return fail("rate_limited", 429);

  try {
    const key = await readApiKey(id);
    if (key === "blocked" || key === "network") return fail(key, key === "blocked" ? 503 : 502);

    const playerRes = await fetchYouTube(
      `https://www.youtube.com/youtubei/v1/player?key=${key}&prettyPrint=false`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "User-Agent": UA },
        body: JSON.stringify({ context: { client: ANDROID }, videoId: id }),
      },
    );
    if (playerRes.status === 429) return fail("blocked", 503);
    if (!playerRes.ok) return fail("network", 502);
    const player = (await playerRes.json()) as {
      playabilityStatus?: { status?: string; reason?: string };
      videoDetails?: { title?: string };
      captions?: { playerCaptionsTracklistRenderer?: { captionTracks?: RawTrack[] } };
    };
    const status = player.playabilityStatus?.status;
    if (status === "LOGIN_REQUIRED" && /bot|robot/i.test(player.playabilityStatus?.reason ?? ""))
      return fail("blocked", 503);
    if (status && status !== "OK" && status !== "LIVE_STREAM_OFFLINE") return fail("unavailable", 410);

    const raw = player.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
    if (raw.length === 0) return fail("no_captions", 404);
    const tracks: CaptionTrackInfo[] = raw.map((t) => ({
      languageCode: t.languageCode,
      name: t.name?.simpleText ?? t.name?.runs?.map((r) => r.text).join("") ?? t.languageCode,
      kind: t.kind === "asr" ? "asr" : "standard",
    }));
    const pick =
      raw.find((t) => t.languageCode === lang && t.kind !== "asr") ??
      raw.find((t) => t.languageCode.startsWith(lang.split("-")[0]!) && t.kind !== "asr") ??
      raw.find((t) => t.languageCode.startsWith(lang.split("-")[0]!)) ??
      raw.find((t) => t.kind !== "asr") ??
      raw[0]!;

    const trackUrl = new URL(pick.baseUrl);
    trackUrl.searchParams.delete("fmt"); // default format is the simple <text start dur> XML
    const xmlRes = await fetchYouTube(trackUrl.toString(), { headers: { "User-Agent": UA } });
    if (xmlRes.status === 429) return fail("blocked", 503);
    if (!xmlRes.ok) return fail("network", 502);
    const cues = parseTimedTextXml(await xmlRes.text());
    if (cues.length === 0) return fail("no_captions", 404);

    const body: CaptionsResponse = {
      videoId: id,
      title: player.videoDetails?.title ?? null,
      language: pick.languageCode,
      kind: pick.kind === "asr" ? "asr" : "standard",
      tracks,
      cues,
    };
    return NextResponse.json(body, {
      headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" },
    });
  } catch {
    return fail("network", 502);
  }
}
