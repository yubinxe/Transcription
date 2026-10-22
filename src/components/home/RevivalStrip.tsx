"use client";
import Link from "next/link";
import { useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { getDb } from "@/lib/storage/db";
import {
  currentRevivalDay,
  ensureRevivalCollection,
  REVIVAL_2026,
  REVIVAL_2026_ID,
  weekdayKo,
} from "@/features/collections/revival-2026";
import { cn } from "@/lib/utils/cn";

export function RevivalStrip() {
  useEffect(() => {
    void ensureRevivalCollection();
  }, []);
  const collection = useLiveQuery(() => getDb().collections.get(REVIVAL_2026_ID), []);
  const records = useLiveQuery(() => getDb().records.toArray(), []);
  const days = collection?.days ?? REVIVAL_2026.days!;
  const today = currentRevivalDay();

  return (
    <section aria-labelledby="revival-title" className="mx-auto max-w-[1320px] px-5 md:px-10">
      <div className="grid gap-8 border-t border-ink pt-10 md:grid-cols-12 md:gap-10">
        <div className="md:col-span-4">
          <p className="eyebrow">Collection · 2026.10.19 — 10.24</p>
          <h2 id="revival-title" className="serif mt-4 text-[1.625rem] leading-[1.3] tracking-[-0.02em] md:text-[1.875rem]">
            {REVIVAL_2026.title}
          </h2>
          <p className="mt-3 text-[0.9375rem] leading-relaxed text-muted">{REVIVAL_2026.description}</p>
          <Link href={`/collections/${REVIVAL_2026_ID}`} className="link-quiet mt-6 inline-block text-[0.875rem]">
            컬렉션 열기
          </Link>
        </div>
        <ol className="grid grid-cols-3 md:col-span-8 md:grid-cols-6">
          {days.map((d, i) => {
            const record = d.recordId ? records?.find((r) => r.id === d.recordId) : undefined;
            const isToday = today === d.day;
            const [, m, dd] = d.date.split("-");
            const href = record ? `/record/${record.id}` : `/collections/${REVIVAL_2026_ID}#day-${d.day}`;
            return (
              <li
                key={d.day}
                className={cn(
                  "border-border",
                  i % 3 !== 0 && "border-l",
                  i >= 3 && "border-t md:border-t-0",
                  i === 3 && "md:border-l",
                )}
              >
                <Link
                  href={href}
                  className="group relative flex h-full min-h-[9.5rem] flex-col px-4 py-4 transition-colors duration-200 hover:bg-surface md:min-h-[11rem]"
                  aria-label={`Day ${d.day}, ${Number(m)}월 ${Number(dd)}일${isToday ? ", 오늘" : ""}`}
                >
                  <span className="flex items-baseline justify-between">
                    <span className="eyebrow !tracking-[0.18em]">Day</span>
                    {isToday && <span className="text-[0.6875rem] font-medium text-forest">오늘</span>}
                  </span>
                  <span className={cn("numeral mt-1 text-[2.25rem] leading-none tracking-[-0.03em]", isToday ? "text-forest" : "text-ink")}>
                    {String(d.day).padStart(2, "0")}
                  </span>
                  <span className="tabular mt-2 text-[0.8125rem] text-muted">
                    {Number(m)}.{Number(dd)} {weekdayKo(d.date)}
                  </span>
                  <span className="mt-auto line-clamp-2 pt-3 text-[0.8125rem] leading-snug text-ink-soft">
                    {d.title || record?.title || <span className="text-faint">기록 전</span>}
                  </span>
                  {isToday && <span aria-hidden className="absolute inset-x-4 bottom-0 h-[2px] bg-forest" />}
                </Link>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
