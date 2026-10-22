"use client";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { getDb } from "@/lib/storage/db";
import { RecordRow } from "@/components/archive/RecordRow";

export function RecentRecords() {
  const records = useLiveQuery(() => getDb().records.orderBy("updatedAt").reverse().limit(4).toArray(), []);
  if (!records || records.length === 0) return null;
  return (
    <section aria-labelledby="recent-title" className="mx-auto max-w-[1320px] px-5 md:px-10">
      <div className="grid gap-8 border-t border-ink pt-10 md:grid-cols-12 md:gap-10">
        <div className="md:col-span-4">
          <p className="eyebrow">Recent</p>
          <h2 id="recent-title" className="serif mt-4 text-[1.625rem] tracking-[-0.02em]">
            이어서 읽기
          </h2>
          <Link href="/archive" className="link-quiet mt-6 inline-block text-[0.875rem]">
            전체 아카이브
          </Link>
        </div>
        <ul className="divide-y divide-border md:col-span-8">
          {records.map((r) => (
            <li key={r.id}>
              <RecordRow record={r} compact />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
