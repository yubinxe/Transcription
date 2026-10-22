import { NextResponse } from "next/server";
import { isValidVideoId } from "@/features/youtube/url";
import { clientKey, fetchYouTube, rateLimit } from "@/lib/server/rate-limit";

export const runtime = "nodejs";

/**
 * Video metadata via YouTube's public oEmbed endpoint. Only an 11-char validated
 * video id is accepted; the upstream URL is built server-side (no user-supplied URL is fetched).
 */
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!isValidVideoId(id)) return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  if (!rateLimit(`meta:${clientKey(req)}`, 60)) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const target = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}`;
  let res: Response;
  try {
    res = await fetchYouTube(target);
  } catch {
    return NextResponse.json({ error: "network" }, { status: 502 });
  }
  if (res.status === 401 || res.status === 403) {
    // oEmbed answers 401 for videos whose owner disabled embedding, and for private videos.
    return NextResponse.json({ error: "restricted" }, { status: 403 });
  }
  if (res.status === 404 || res.status === 400) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!res.ok) return NextResponse.json({ error: "upstream" }, { status: 502 });

  const data = (await res.json().catch(() => null)) as {
    title?: string;
    author_name?: string;
    author_url?: string;
    thumbnail_url?: string;
  } | null;
  if (!data?.title) return NextResponse.json({ error: "upstream" }, { status: 502 });
  return NextResponse.json(
    {
      videoId: id,
      title: data.title,
      channel: data.author_name ?? null,
      channelUrl: data.author_url?.startsWith("https://www.youtube.com/") ? data.author_url : null,
      thumbnailUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    },
    { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } },
  );
}
