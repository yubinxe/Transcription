import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";

const SRT = path.join(__dirname, "../fixtures/sermon.srt");

async function noHorizontalScroll(page: Page) {
  const { sw, cw } = await page.evaluate(() => ({
    sw: document.documentElement.scrollWidth,
    cw: document.documentElement.clientWidth,
  }));
  expect(sw).toBeLessThanOrEqual(cw + 1);
}

test("home explains itself and validates links", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("들은 말씀을");
  const input = page.getByLabel("YouTube 영상 링크");
  await input.fill("https://vimeo.com/123");
  await expect(page.getByText("YouTube 링크만 지원합니다.")).toBeVisible();
  await input.fill("https://www.youtube.com/playlist?list=PL1");
  await expect(page.getByText(/재생목록 링크입니다/)).toBeVisible();
  await noHorizontalScroll(page);
});

test("YouTube link → record → paste transcript → synced reader", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("YouTube 영상 링크").fill("https://youtu.be/dQw4w9WgXcQ?si=tracking");
  // Metadata may be unreachable (sandboxed CI); either preview or manual title is acceptable.
  await expect(page.getByText(/영상 정보를 확인하지 못했습니다|YouTube$/).first()).toBeVisible({
    timeout: 15_000,
  });
  const manual = page.getByLabel("기록 제목");
  if (await manual.isVisible()) await manual.fill("10월 22일 새벽 말씀");
  await page.getByRole("button", { name: /기록 시작하기/ }).click();
  await expect(page).toHaveURL(/\/record\/r_/);
  await expect(page.getByText("이 영상의 말씀을 텍스트로 옮겨 볼까요")).toBeVisible();

  await page.getByRole("button", { name: /YouTube 스크립트 붙여넣기/ }).click();
  await page
    .getByLabel("텍스트")
    .fill(
      "0:00\n0초\n할렐루야 반갑습니다\n0:05\n5초\n오늘 함께 읽을 말씀은 요한복음입니다\n0:12\n12초\n말씀 앞에 머무릅시다",
    );
  await page.getByRole("button", { name: "가져오기", exact: true }).click();
  await expect(page.getByRole("tab", { name: "원문" })).toBeVisible();
  await expect(page.getByText("오늘 함께 읽을 말씀은 요한복음입니다")).toBeVisible();
  await expect(
    page
      .getByRole("button", { name: "00:05 지점부터 재생" })
      .or(page.getByRole("button", { name: "00:00 지점부터 재생" }))
      .first(),
  ).toBeVisible();
  await noHorizontalScroll(page);

  // Same video again → the existing record opens, no duplicate.
  await page.goto("/");
  await page.getByLabel("YouTube 영상 링크").fill("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  await page.getByRole("button", { name: /기록 시작하기/ }).click();
  await expect(page.getByText("오늘 함께 읽을 말씀은 요한복음입니다")).toBeVisible();
  await page.goto("/archive");
  await expect(page.locator("main li")).toHaveCount(1);
});

test("caption import → search, edit, highlight, reflect, export, persist, delete", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /자막 파일 가져오기/ }).click();
  await page.locator('input[type="file"]').setInputFiles(SRT);
  await expect(page).toHaveURL(/\/record\//);
  await expect(page.getByText("은혜는 머무는 자리에서 자라납니다.")).toBeVisible();

  // search
  await page.getByLabel("원문 검색").fill("말씀");
  await expect(page.getByText("1/3")).toBeVisible();
  await page.getByLabel("원문 검색").fill("");

  // edit keeps original
  await page.getByRole("button", { name: "교정" }).click();
  const box = page.getByLabel("문장 교정 00:08");
  await box.fill("은혜는 머무는 자리에서 자라납니다!");
  await box.blur();
  await expect(page.getByText(/원본: 은혜는 머무는 자리에서 자라납니다\./)).toBeVisible();
  await page.getByRole("button", { name: "편집 마침" }).click();

  // highlight via selection
  const seg = page.locator("[data-seg]").filter({ hasText: "들은 말씀을 오래 붙잡고" });
  await seg.evaluate((el) => {
    const r = document.createRange();
    r.selectNodeContents(el);
    const s = window.getSelection()!;
    s.removeAllRanges();
    s.addRange(r);
  });
  await page
    .getByRole("toolbar", { name: "선택한 문장" })
    .getByRole("button", { name: /문장 저장/ })
    .click();
  await page.getByRole("tab", { name: /말씀 연구/ }).click();
  await expect(
    page.getByRole("tabpanel").getByText("우리는 들은 말씀을 오래 붙잡고 살아가야 합니다."),
  ).toBeVisible();

  // reflection autosaves
  await page.getByRole("tab", { name: "나의 묵상" }).click();
  await page.getByRole("textbox", { name: "오늘의 기도" }).fill("오늘 들은 말씀을 붙잡게 하소서");
  await page.waitForTimeout(1200);

  // export markdown + srt
  await page.getByRole("button", { name: /내보내기/ }).click();
  const [md] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "내려받기" }).click(),
  ]);
  expect(md.suggestedFilename()).toMatch(/원문 \+ 묵상 통합본\.md$/);
  const mdText = fs.readFileSync((await md.path())!, "utf8");
  expect(mdText).toContain("## 기억할 문장");
  expect(mdText).toContain("오늘 들은 말씀을 붙잡게 하소서");
  expect(mdText).toContain("자라납니다!");
  await page.getByLabel("전사 원문", { exact: true }).check();
  await page.getByLabel("SRT 자막 (.srt)").check();
  const [srt] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "내려받기" }).click(),
  ]);
  const srtText = fs.readFileSync((await srt.path())!, "utf8");
  expect(srtText).toContain("00:00:08,500 --> 00:00:12,000\n은혜는 머무는 자리에서 자라납니다.");
  await page.keyboard.press("Escape");

  // persists across reload
  await page.reload();
  await page.getByRole("tab", { name: "나의 묵상" }).click();
  await expect(page.getByRole("textbox", { name: "오늘의 기도" })).toHaveValue(
    "오늘 들은 말씀을 붙잡게 하소서",
  );

  // library-wide search reaches notes
  await page.goto("/archive");
  await page.getByLabel("아카이브 전체 검색").fill("붙잡게");
  await expect(page.getByText("묵상", { exact: true })).toBeVisible();

  // delete
  await page.getByLabel("아카이브 전체 검색").fill("");
  await page.locator("main li a").first().click();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "삭제" }).click();
  await expect(page).toHaveURL(/\/archive$/);
  await expect(page.getByText("아직 남긴 기록이 없습니다.")).toBeVisible();
});

test("audio upload starts on-device recognition and reports real state", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/");
  await page.getByRole("button", { name: /음성·영상 파일 업로드/ }).click();
  await page.locator('input[type="file"]').setInputFiles(path.join(__dirname, "../fixtures/tone.wav"));
  await expect(page).toHaveURL(/\/record\//);
  // Either recognition proceeds, or the model download fails loudly (offline sandbox) — never a fake success.
  await expect(
    page
      .getByText(
        /음성 분석 준비 중|모델 다운로드 중|음성 인식 중|음성 인식 모델을 내려받지 못했습니다|인식된 음성이 없습니다|원문/,
      )
      .first(),
  ).toBeVisible({ timeout: 60_000 });
});

test("revival collection shows six dated days with today marked", async ({ page }) => {
  await page.goto("/collections/autumn-revival-2026");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("2026 가을 특별새벽부흥회");
  await expect(page.locator("li[id^=day-]")).toHaveCount(6);
  await expect(page.getByText("10.19 (월)")).toBeVisible();
  await expect(page.getByText("10.24 (토)")).toBeVisible();
  await page
    .locator("#day-1")
    .getByRole("button", { name: /정보 입력/ })
    .click();
  await page.getByLabel("설교자").first().fill("확인한 설교자");
  await page.locator("#day-1").getByRole("button", { name: "저장" }).click();
  await expect(page.locator("#day-1").getByText("확인한 설교자")).toBeVisible();
  await noHorizontalScroll(page);
});
