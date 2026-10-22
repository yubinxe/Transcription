import { parseYouTubeUrl, parseTimeParam } from "@/features/youtube/url";

const ID = "dQw4w9WgXcQ";

describe("parseYouTubeUrl", () => {
  it.each([
    [`https://www.youtube.com/watch?v=${ID}`],
    [`https://youtube.com/watch?v=${ID}&feature=share&si=abc123`],
    [`https://m.youtube.com/watch?v=${ID}&pp=xyz`],
    [`https://youtu.be/${ID}`],
    [`https://youtu.be/${ID}?si=TrackingToken`],
    [`youtu.be/${ID}`],
    [`https://www.youtube.com/shorts/${ID}`],
    [`https://www.youtube.com/live/${ID}?si=x`],
    [`https://www.youtube.com/embed/${ID}`],
    [`https://www.youtube-nocookie.com/embed/${ID}`],
    [`https://music.youtube.com/watch?v=${ID}&list=RD`],
    [`  https://youtu.be/${ID}  `],
    [`이 영상 꼭 보세요! https://youtu.be/${ID}?si=abc 공유`],
    [ID],
  ])("accepts %s", (input) => {
    const r = parseYouTubeUrl(input);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.videoId).toBe(ID);
      expect(r.value.canonicalUrl).toBe(`https://www.youtube.com/watch?v=${ID}`);
    }
  });

  it("flags shorts and strips tracking params", () => {
    const r = parseYouTubeUrl(`https://www.youtube.com/shorts/${ID}?si=zzz&utm_source=x`);
    expect(r.ok && r.value.isShorts).toBe(true);
    expect(r.ok && r.value.canonicalUrl).not.toContain("si=");
  });

  it("keeps the start time", () => {
    const r = parseYouTubeUrl(`https://youtu.be/${ID}?t=1m30s`);
    expect(r.ok && r.value.startSeconds).toBe(90);
  });

  it.each([
    ["", "empty"],
    ["hello world", "not_url"],
    ["https://vimeo.com/123456", "not_youtube"],
    ["https://evil.com/watch?v=dQw4w9WgXcQ", "not_youtube"],
    ["https://youtube.com.evil.com/watch?v=dQw4w9WgXcQ", "not_youtube"],
    ["https://www.youtube.com/watch?v=short", "no_video_id"],
    ["https://www.youtube.com/playlist?list=PL123", "playlist_only"],
    ["https://www.youtube.com/@channel", "no_video_id"],
    ["javascript:alert(1)", "not_url"],
  ])("rejects %s", (input, reason) => {
    const r = parseYouTubeUrl(input);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe(reason);
  });

  it("parses time params", () => {
    expect(parseTimeParam("90")).toBe(90);
    expect(parseTimeParam("1h2m3s")).toBe(3723);
    expect(parseTimeParam("bad")).toBeNull();
  });
});
