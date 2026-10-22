import { parseTimedTextXml } from "@/features/youtube/timedtext";

describe("parseTimedTextXml", () => {
  it("parses cues, double-encoded entities and markup", () => {
    const xml = `<?xml version="1.0" encoding="utf-8" ?><transcript>
<text start="0.32" dur="2.5">사랑하는 성도 여러분</text>
<text start="2.82" dur="3.1">오늘 &amp;#39;은혜&amp;#39;를 &lt;b&gt;나눕니다&lt;/b&gt;</text>
<text start="6" dur="1">   </text>
<text start="7.5">아멘</text>
</transcript>`;
    expect(parseTimedTextXml(xml)).toEqual([
      { startMs: 320, endMs: 2820, text: "사랑하는 성도 여러분" },
      { startMs: 2820, endMs: 5920, text: "오늘 '은혜'를 나눕니다" },
      { startMs: 7500, endMs: null, text: "아멘" },
    ]);
  });
  it("returns empty for non-transcript content", () => {
    expect(parseTimedTextXml("<html></html>")).toEqual([]);
  });
});
