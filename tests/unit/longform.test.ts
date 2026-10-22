import { planWindow } from "@/features/transcription/longform";
import { findActiveIndex, findMatches } from "@/features/transcript-editor/active-segment";

const SR = 16000;

describe("planWindow (sequential long-form decoding)", () => {
  it("drops a truncated last segment and re-decodes from its start", () => {
    const plan = planWindow(
      [
        { text: " 첫 문장", timestamp: [0, 6] },
        { text: " 둘째 문장", timestamp: [6, 14] },
        { text: " 잘린 문장", timestamp: [27.5, null] },
      ],
      30 * SR,
      60 * SR,
      600 * SR,
      SR,
    );
    expect(plan.accepted.map((a) => a.text)).toEqual(["첫 문장", "둘째 문장"]);
    expect(plan.accepted[0]!.startMs).toBe(30_000);
    expect(plan.nextSeekSamples).toBe(30 * SR + 27.5 * SR);
  });

  it("keeps everything in the final window", () => {
    const plan = planWindow([{ text: "끝", timestamp: [0, null] }], 0, 10 * SR, 10 * SR, SR);
    expect(plan.accepted).toHaveLength(1);
    expect(plan.nextSeekSamples).toBe(10 * SR);
  });

  it("always advances at least one second (no infinite loop)", () => {
    const plan = planWindow(
      [
        { text: "a", timestamp: [0, null] },
        { text: "b", timestamp: [0.2, null] },
      ],
      0,
      30 * SR,
      100 * SR,
      SR,
    );
    expect(plan.nextSeekSamples).toBeGreaterThanOrEqual(SR);
    expect(plan.accepted.map((a) => a.text)).toEqual(["a", "b"]);
  });
});

describe("active segment lookup", () => {
  const segs = [
    { id: "a", startMs: 0, endMs: 2000, text: "가", source: "manual" as const },
    { id: "b", startMs: 2000, endMs: 4000, text: "나", source: "manual" as const },
    { id: "c", startMs: 10_000, endMs: 12_000, text: "다", source: "manual" as const },
  ];
  it("binary-searches by time", () => {
    expect(findActiveIndex(segs, 2500)).toBe(1);
    expect(findActiveIndex(segs, 11_000)).toBe(2);
    expect(findActiveIndex(segs, 8_000)).toBe(-1); // in a long gap
  });
  it("finds all matches case-insensitively", () => {
    expect(findMatches([{ ...segs[0]!, text: "Amen amen 아멘" }], "amen")).toHaveLength(2);
  });
});
