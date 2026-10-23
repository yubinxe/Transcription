import {
  toSrt,
  toVtt,
  toMarkdown,
  toPlainText,
  canExport,
  safeFileName,
  applyEdits,
  renderExport,
  type ExportBundle,
} from "@/features/export/exporters";
import type { TranscriptSegment } from "@/types/transcript";
import type { ArchiveRecord } from "@/types/record";

const segs: TranscriptSegment[] = [
  { id: "s1", startMs: 1000, endMs: 3500, text: "태초에 하나님이", source: "uploaded_caption" },
  { id: "s2", startMs: 3500, endMs: null, text: "천지를 창조하시니라.", source: "uploaded_caption" },
];

const record: ArchiveRecord = {
  id: "r1",
  kind: "sermon",
  title: "창세기 1장 / 새벽: 말씀?",
  source: { type: "youtube", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
  status: "ready",
  tags: [],
  sermon: { preacher: "홍길동", scripture: "창 1:1" },
  createdAt: 0,
  updatedAt: 0,
};

const bundle: ExportBundle = {
  record,
  transcript: {
    recordId: "r1",
    original: segs,
    edits: { s1: "태초에 하나님께서" },
    history: [],
    updatedAt: 0,
  },
  highlights: [
    {
      id: "h1",
      recordId: "r1",
      segmentIds: ["s2"],
      quote: "천지를 창조하시니라.",
      startMs: 3500,
      note: "시작",
      attachedTo: "remains",
      createdAt: 0,
    },
  ],
  reflection: {
    recordId: "r1",
    sections: { remains: "", thesis: "창조의 주권", learned: "", apply: "", prayer: "오늘을 주께" },
    study: { scripture: "", questions: "왜 태초인가", application: "", prayerTopics: "" },
    segmentNotes: {},
    updatedAt: 0,
  },
};

describe("subtitle export", () => {
  it("writes valid SRT with derived end times", () => {
    expect(toSrt(segs)).toBe(
      "1\n00:00:01,000 --> 00:00:03,500\n태초에 하나님이\n\n2\n00:00:03,500 --> 00:00:06,500\n천지를 창조하시니라.\n",
    );
  });
  it("writes valid VTT", () => {
    const v = toVtt(segs);
    expect(v.startsWith("WEBVTT\n\n00:00:01.000 --> 00:00:03.500\n")).toBe(true);
  });
  it("refuses SRT/VTT without timestamps", () => {
    const untimed = segs.map((s) => ({ ...s, startMs: null }));
    expect(() => toSrt(untimed)).toThrow();
    expect(
      canExport("srt", "original", { ...bundle, transcript: { ...bundle.transcript!, original: untimed } }),
    ).toBe(false);
    expect(canExport("srt", "highlights", bundle)).toBe(false);
    expect(canExport("vtt", "edited", bundle)).toBe(true);
  });
});

describe("edits", () => {
  it("keeps original and edited separately", () => {
    expect(applyEdits(bundle.transcript, false)[0]!.text).toBe("태초에 하나님이");
    expect(applyEdits(bundle.transcript, true)[0]!.text).toBe("태초에 하나님께서");
    expect(renderExport(bundle, "srt", "edited")).toContain("하나님께서");
    expect(renderExport(bundle, "srt", "original")).not.toContain("하나님께서");
  });
});

describe("markdown", () => {
  it("renders the combined document and omits empty metadata", () => {
    const md = toMarkdown(bundle, "combined");
    expect(md).toContain("# 창세기 1장 / 새벽: 말씀?");
    expect(md).toContain("설교자: 홍길동");
    expect(md).not.toContain("일시:");
    expect(md).toContain("## 말씀 원문");
    expect(md).toContain("[00:00:01] 태초에 하나님께서 천지를 창조하시니라.");
    expect(md).toContain("## 기억할 문장");
    expect(md).toContain("> 천지를 창조하시니라. — [00:00:03]");
    expect(md).toContain("### 왜 태초인가".replace("### ", "")); // study content
    expect(md).toContain("### 오늘 내게 남은 한 문장");
    expect(md).toContain("### 오늘의 기도\n\n오늘을 주께");
    expect(md).not.toContain("### 새롭게 이해한 사실");
  });
  it("plain text with timestamps", () => {
    expect(toPlainText(segs, true)).toBe("[00:00:01] 태초에 하나님이\n[00:00:03] 천지를 창조하시니라.\n");
  });
});

describe("file names", () => {
  it("keeps Hangul and strips illegal characters", () => {
    expect(safeFileName(record.title, "원문", "md")).toBe("창세기 1장 새벽 말씀 - 원문.md");
    expect(safeFileName("   ", "", "txt")).toBe("새벽기록.txt");
  });
});
