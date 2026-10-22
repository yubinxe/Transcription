"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { Search } from "lucide-react";
import { getDb } from "@/lib/storage/db";
import { RECORD_KIND_LABEL, type RecordKind } from "@/types/record";
import { RecordRow } from "./RecordRow";
import { searchLibrary, type SearchHit } from "@/features/library/search";
import { useDebouncedValue } from "@/lib/utils/use-debounced";
import { formatClock } from "@/lib/utils/time";
import { cn } from "@/lib/utils/cn";

const FILTERS: Array<[RecordKind | "all", string]> = [
  ["all", "전체"],
  ...(Object.entries(RECORD_KIND_LABEL) as Array<[RecordKind, string]>),
];

const FIELD_LABEL: Record<SearchHit["field"], string> = {
  title: "제목",
  meta: "정보",
  transcript: "원문",
  highlight: "기억할 문장",
  note: "묵상",
};

export function ArchiveView() {
  const records = useLiveQuery(() => getDb().records.orderBy("updatedAt").reverse().toArray(), []);
  const collections = useLiveQuery(() => getDb().collections.toArray(), []);
  const [filter, setFilter] = useState<RecordKind | "all">("all");
  const [query, setQuery] = useState("");
  const q = useDebouncedValue(query.trim(), 220);
  const [result, setResult] = useState<{ q: string; hits: SearchHit[] } | null>(null);
  const hits = result && result.q === q ? result.hits : null;

  useEffect(() => {
    if (!q) return;
    let live = true;
    void searchLibrary(q).then((h) => {
      if (live) setResult({ q, hits: h });
    });
    return () => {
      live = false;
    };
  }, [q, records]);

  const visible = useMemo(
    () => (records ?? []).filter((r) => filter === "all" || r.kind === filter),
    [records, filter],
  );
  const grouped = useMemo(() => {
    const m = new Map<string, SearchHit[]>();
    for (const h of hits ?? []) {
      if (filter !== "all" && h.record.kind !== filter) continue;
      m.set(h.record.id, [...(m.get(h.record.id) ?? []), h]);
    }
    return [...m.values()];
  }, [hits, filter]);

  return (
    <div className="mx-auto max-w-[1320px] px-5 pt-14 md:px-10 md:pt-20">
      <header className="grid gap-8 md:grid-cols-12 md:gap-10">
        <div className="md:col-span-5">
          <p className="eyebrow">Archive</p>
          <h1 className="serif mt-4 text-[2.25rem] font-semibold tracking-[-0.03em] md:text-[2.5rem]">
            내 아카이브
          </h1>
          <p className="mt-3 text-[0.9375rem] text-muted">
            {records ? `${records.length}개의 기록` : " "} · 이 브라우저에 저장됨
          </p>
        </div>
        <div className="self-end md:col-span-7">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-0 top-1/2 size-[1.125rem] -translate-y-1/2 text-faint"
              aria-hidden
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="제목, 원문, 메모 전체에서 찾기"
              aria-label="아카이브 전체 검색"
              className="w-full border-0 border-b border-rule bg-transparent py-3 pl-8 text-[1.0625rem] transition-colors duration-150 placeholder:text-faint focus:border-ink focus:outline-none"
            />
          </div>
        </div>
      </header>

      <div className="mt-12 flex flex-wrap items-center justify-between gap-4 border-b border-ink pb-3">
        <div role="tablist" aria-label="분류" className="flex gap-5 overflow-x-auto">
          {FILTERS.map(([k, l]) => (
            <button
              key={k}
              role="tab"
              aria-selected={filter === k}
              onClick={() => setFilter(k)}
              className={cn(
                "whitespace-nowrap text-[0.875rem] transition-colors duration-150",
                filter === k ? "font-medium text-ink" : "text-muted hover:text-ink",
              )}
            >
              {l}
            </button>
          ))}
        </div>
        {collections && collections.length > 0 && (
          <div className="flex gap-4 text-[0.8125rem]">
            {collections.map((c) => (
              <Link key={c.id} href={`/collections/${c.id}`} className="link-quiet">
                {c.title}
              </Link>
            ))}
          </div>
        )}
      </div>

      {q ? (
        <section aria-live="polite" className="mt-2">
          {hits === null ? (
            <p className="py-10 text-[0.875rem] text-muted">찾는 중…</p>
          ) : grouped.length === 0 ? (
            <p className="py-10 text-[0.9375rem] text-muted">‘{q}’와 일치하는 내용이 없습니다.</p>
          ) : (
            <ul className="divide-y divide-border">
              {grouped.map((group) => (
                <li key={group[0]!.record.id} className="py-7">
                  <Link
                    href={`/record/${group[0]!.record.id}`}
                    className="serif text-[1.125rem] text-ink hover:text-forest"
                  >
                    {group[0]!.record.title}
                  </Link>
                  <ul className="mt-3 space-y-2.5">
                    {group.map((h, i) => (
                      <li
                        key={i}
                        className="grid grid-cols-[4.5rem_1fr] gap-3 text-[0.875rem] leading-relaxed"
                      >
                        <span className="pt-0.5 text-[0.75rem] text-muted">
                          {FIELD_LABEL[h.field]}
                          {h.startMs != null && (
                            <span className="tabular block text-faint">{formatClock(h.startMs)}</span>
                          )}
                        </span>
                        <span className="text-ink-soft">
                          {h.snippet.slice(0, h.matchStart)}
                          <mark className="hit">
                            {h.snippet.slice(h.matchStart, h.matchStart + h.matchLength)}
                          </mark>
                          {h.snippet.slice(h.matchStart + h.matchLength)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : records && visible.length === 0 ? (
        <div className="py-20">
          <p className="serif text-[1.375rem] text-ink">
            {records.length === 0 ? "아직 남긴 기록이 없습니다." : "이 분류에는 기록이 없습니다."}
          </p>
          <p className="mt-3 text-[0.9375rem] text-muted">영상 링크나 음성 파일로 첫 기록을 시작해 보세요.</p>
          <Link href="/" className="btn btn-primary mt-8">
            새 기록
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {visible.map((r) => (
            <li key={r.id}>
              <RecordRow record={r} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
