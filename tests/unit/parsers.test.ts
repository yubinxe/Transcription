import {
  parseSrt,
  parseVtt,
  parseTimestamp,
  parseTimestampedText,
  parsePlainText,
  splitSentences,
} from "@/features/transcription/parsers";
import { parseTextDocument } from "@/features/transcription/parsers";

describe("timestamps", () => {
  it("parses SRT/VTT clocks", () => {
    expect(parseTimestamp("00:01:02,500")).toBe(62_500);
    expect(parseTimestamp("01:02.5")).toBe(62_500);
    expect(parseTimestamp("1:00:00.000")).toBe(3_600_000);
    expect(parseTimestamp("00:61:00,000")).toBeNull();
  });
});

describe("parseSrt", () => {
  it("handles BOM, CRLF, tags, entities, empty cues and invalid times", () => {
    const srt =
      "﻿1\r\n00:00:01,000 --> 00:00:03,000\r\n<i>태초에</i> 하나님이&nbsp;천지를\r\n\r\n" +
      "2\r\n00:00:03,000 --> 00:00:05,000\r\n\r\n\r\n" +
      "3\r\n00:00:05,000 --> 00:00:04,000\r\n창조하시니라 &amp; 아멘\r\n\r\n" +
      "4\r\nbroken --> 00:00:09,000\r\n타임스탬프가 깨진 줄\r\n";
    const segs = parseSrt(srt);
    expect(segs.map((s) => s.text)).toEqual(["태초에 하나님이 천지를", "창조하시니라 & 아멘"]);
    expect(segs[0]).toMatchObject({ startMs: 1000, endMs: 3000, source: "uploaded_caption" });
    expect(segs[1]!.endMs).toBeNull(); // end < start repaired, not invented
  });

  it("merges multi-line cues and trims overlaps without losing text", () => {
    const srt =
      "1\n00:00:01,000 --> 00:00:06,000\n첫째 줄\n둘째 줄\n\n2\n00:00:04,000 --> 00:00:08,000\n다음 문장\n";
    const segs = parseSrt(srt);
    expect(segs[0]!.text).toBe("첫째 줄 둘째 줄");
    expect(segs[0]!.endMs).toBe(4000);
    expect(segs[1]!.text).toBe("다음 문장");
  });
});

describe("parseVtt", () => {
  it("skips header/NOTE/STYLE, strips inline timing and voice tags", () => {
    const vtt = `WEBVTT
Kind: captions
Language: ko

NOTE 메모 블록

STYLE
::cue { color: red }

intro
00:00:00.000 --> 00:00:02.500 align:start position:0%
<v 설교자>오늘<00:00:01.000><c> 본문은</c>

00:00:02.500 --> 00:00:04.000
요한복음 3장입니다
`;
    const segs = parseVtt(vtt);
    expect(segs.map((s) => s.text)).toEqual(["오늘 본문은", "요한복음 3장입니다"]);
    expect(segs[0]!.startMs).toBe(0);
  });

  it("removes YouTube rolling-caption duplicates", () => {
    const vtt = `WEBVTT

00:00:00.000 --> 00:00:02.000
사랑하는 성도 여러분

00:00:02.000 --> 00:00:02.010
사랑하는 성도 여러분

00:00:02.010 --> 00:00:04.000
사랑하는 성도 여러분
오늘 새벽에도

00:00:04.000 --> 00:00:06.000
오늘 새벽에도
말씀 앞에 섭니다
`;
    const segs = parseVtt(vtt);
    expect(segs.map((s) => s.text)).toEqual(["사랑하는 성도 여러분", "오늘 새벽에도", "말씀 앞에 섭니다"]);
  });
});

describe("YouTube transcript paste", () => {
  it("parses the ‘스크립트 표시’ copy format including duration labels", () => {
    const text = `0:00
0초
할렐루야 반갑습니다
0:05
5초
오늘 함께 읽을 말씀은
1:02:03
1시간 2분 3초
마지막 기도입니다`;
    const segs = parseTimestampedText(text)!;
    expect(segs.map((s) => [s.startMs, s.text])).toEqual([
      [0, "할렐루야 반갑습니다"],
      [5000, "오늘 함께 읽을 말씀은"],
      [3_723_000, "마지막 기도입니다"],
    ]);
    expect(segs[0]!.endMs).toBe(5000);
  });

  it("parses inline [hh:mm:ss] markers", () => {
    const segs = parseTimestampedText("[00:00:01] 첫 문장\n[00:00:09] 둘째 문장")!;
    expect(segs).toHaveLength(2);
    expect(segs[1]!.startMs).toBe(9000);
  });

  it("returns null for plain prose", () => {
    expect(parseTimestampedText("그냥 문장입니다.\n또 다른 문장입니다.")).toBeNull();
  });
});

describe("plain text", () => {
  it("splits sentences without dropping text and marks paragraphs", () => {
    const segs = parsePlainText("첫 문장입니다. 둘째 문장인가요? 네.\n\n새 문단입니다!");
    expect(segs.map((s) => s.text).join(" ")).toBe("첫 문장입니다. 둘째 문장인가요? 네. 새 문단입니다!");
    expect(segs.every((s) => s.startMs === null)).toBe(true);
    expect(segs.find((s) => s.text.startsWith("새 문단"))!.paragraphStart).toBe(true);
  });
  it("splitSentences keeps unterminated tail", () => {
    expect(splitSentences("하나입니다. 둘째 문장")).toEqual(["하나입니다.", "둘째 문장"]);
    expect(splitSentences("아멘. 네.")).toEqual(["아멘. 네."]);
  });
});

describe("parseTextDocument", () => {
  it("detects formats", () => {
    expect(parseTextDocument("WEBVTT\n\n00:00.000 --> 00:01.000\n가", "x.txt").format).toBe("vtt");
    expect(parseTextDocument("1\n00:00:00,000 --> 00:00:01,000\n가\n", "").format).toBe("srt");
    expect(parseTextDocument("0:00\n가\n0:03\n나", "").format).toBe("timestamped_text");
    expect(parseTextDocument("가나다.", "a.txt").format).toBe("plain_text");
  });
});
