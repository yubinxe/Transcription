import type { Collection, CollectionDay } from "@/types/record";
import { getCollection, putCollection } from "@/lib/storage/repository";

export const REVIVAL_2026_ID = "autumn-revival-2026";

/**
 * Only the dates are seeded. Sermon titles, preachers and passages are deliberately
 * left empty: they must be copied by the user from the official page, never invented.
 */
export const REVIVAL_2026_OFFICIAL_URL = "https://revival.sarang.org/";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;

export const REVIVAL_2026_DAYS: CollectionDay[] = [19, 20, 21, 22, 23, 24].map((d, i) => ({
  day: i + 1,
  date: `2026-10-${d}`,
  recordId: null,
}));

export function weekdayKo(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number) as [number, number, number];
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]!;
}

export const REVIVAL_2026: Omit<Collection, "createdAt" | "updatedAt"> = {
  id: REVIVAL_2026_ID,
  title: "2026 가을 특별새벽부흥회",
  description: "한 주간의 새벽, 여섯 번의 만남, 그리고 오래 남길 말씀.",
  days: REVIVAL_2026_DAYS,
  recordIds: [],
};

export async function ensureRevivalCollection(): Promise<Collection> {
  const existing = await getCollection(REVIVAL_2026_ID);
  if (existing) return existing;
  const now = Date.now();
  const c: Collection = { ...REVIVAL_2026, createdAt: now, updatedAt: now };
  await putCollection(c);
  return c;
}

/** Index of today's day in the series (Asia/Seoul), or null outside the week. */
export function currentRevivalDay(now = new Date()): number | null {
  const seoul = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(now);
  const idx = REVIVAL_2026_DAYS.findIndex((d) => d.date === seoul);
  return idx === -1 ? null : idx + 1;
}
