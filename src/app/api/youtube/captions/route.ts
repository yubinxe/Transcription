import { NextResponse } from "next/server";
import { isValidVideoId } from "@/features/youtube/url";
import { clientKey, fetchYouTube, rateLimit } from "@/lib/server/rate-limit";

export const runtime = "nodejs";

/**
 * EXPERIMENTAL & DISABLED BY DEFAULT.
 * Reads the caption track list YouTube serves to its own clients (Innertube "player"),
 * then the matching timedtext track as WebVTT. Not an official API: it can stop working
 * at any time and its use must be reviewed against YouTube's Terms of Service.
 * Enable only with DAWN_UNOFFICIAL_CAPTIONS=enabled. No cookies, proxies, or
 * access-control bypasses are used; restricted videos simply fail.
 */
const ENABLED = process.env.DAWN_UNOFFICIAL_CAPTIONS === "enabled";

interface CaptionTrack {
  baseUrl: string;
  languageCode: string;
  kind?: string;
}

export async function GET(req: Request) {
  if (!ENABLED) return NextResponse.json({ error: "disabled" }, { status: 403 });
  const params = new URL(req.url).searchParams;
  const id = params.get("id");
  const lang = (params.get("lang") ?? "ko").slice(0, 8);
  if (!isValidVideoId(id)) return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  if (!rateLimit(`cap:${clientKey(req)}`, 10))
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  let player: Response;
  try {
    player = await fetchYouTube("https://www.youtube.com/youtubei/v1/player?prettyPrint=false", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        videoId: id,
        context: { client: { clientName: "WEB", clientVersion: "2.20250101.00.00", hl: lang } },
      }),
    });
  } catch {
    return NextResponse.json({ error: "network" }, { status: 502 });
  }
  if (!player.ok) return NextResponse.json({ error: "upstream" }, { status: 502 });
  const json = (await player.json().catch(() => null)) as {
    playabilityStatus?: { status?: string };
    captions?: { playerCaptionsTracklistRenderer?: { captionTracks?: CaptionTrack[] } };
  } | null;
  const status = json?.playabilityStatus?.status;
  if (status && status !== "OK" && status !== "LIVE_STREAM_OFFLINE") {
    return NextResponse.json({ error: "unavailable", status }, { status: 410 });
  }
  const tracks = json?.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
  const track =
    tracks.find((t) => t.languageCode.startsWith(lang) && t.kind !== "asr") ??
    tracks.find((t) => t.languageCode.startsWith(lang)) ??
    tracks[0];
  if (!track) return NextResponse.json({ error: "no_captions" }, { status: 404 });

  let trackUrl: URL;
  try {
    trackUrl = new URL(track.baseUrl);
  } catch {
    return NextResponse.json({ error: "upstream" }, { status: 502 });
  }
  trackUrl.searchParams.set("fmt", "vtt");
  let vttRes: Response;
  try {
    vttRes = await fetchYouTube(trackUrl.toString()); // host re-validated inside
  } catch {
    return NextResponse.json({ error: "network" }, { status: 502 });
  }
  const vtt = vttRes.ok ? await vttRes.text() : "";
  if (!vtt.startsWith("WEBVTT")) return NextResponse.json({ error: "no_captions" }, { status: 404 });
  return NextResponse.json({ vtt, language: track.languageCode, kind: track.kind ?? "standard" });
}
