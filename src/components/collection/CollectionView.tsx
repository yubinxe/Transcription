"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { ArrowUpRight, Check } from "lucide-react";
import { getDb } from "@/lib/storage/db";
import { putCollection } from "@/lib/storage/repository";
import {
  currentRevivalDay,
  ensureRevivalCollection,
  REVIVAL_2026_ID,
  REVIVAL_2026_OFFICIAL_URL,
  weekdayKo,
} from "@/features/collections/revival-2026";
import type { ArchiveRecord, Collection, CollectionDay } from "@/types/record";
import { LinkComposer } from "@/components/home/LinkComposer";
import { STATUS_LABEL } from "@/components/archive/RecordRow";
import { RecordRow } from "@/components/archive/RecordRow";
import { cn } from "@/lib/utils/cn";
import { toast } from "@/components/ui/Toaster";

export function CollectionView({ id }: { id: string }) {
  useEffect(() => {
    if (id === REVIVAL_2026_ID) void ensureRevivalCollection();
  }, [id]);
  const collection = useLiveQuery(async () => (await getDb().collections.get(id)) ?? null, [id]);
  const records = useLiveQuery(() => getDb().records.toArray(), []);
  const today = id === REVIVAL_2026_ID ? currentRevivalDay() : null;

  if (collection === undefined)
    return <div className="mx-auto max-w-[1320px] px-5 py-24 text-muted md:px-10">불러오는 중…</div>;
  if (collection === null)
    return (
      <div className="mx-auto max-w-[1320px] px-5 py-24 md:px-10">
        <p className="serif text-[1.5rem]">컬렉션을 찾을 수 없습니다.</p>
      </div>
    );

  const byId = new Map((records ?? []).map((r) => [r.id, r]));
  const dayRecordIds = new Set(collection.days?.map((d) => d.recordId).filter(Boolean));
  const loose = collection.recordIds
    .filter((r) => !dayRecordIds.has(r))
    .map((r) => byId.get(r))
    .filter(Boolean) as ArchiveRecord[];
  const done = collection.days?.filter((d) => d.recordId && byId.get(d.recordId)?.reflectionDone).length ?? 0;

  return (
    <div className="mx-auto max-w-[1320px] px-5 pt-14 md:px-10 md:pt-20">
      <header className="grid gap-10 md:grid-cols-12">
        <div className="md:col-span-7">
          <p className="eyebrow">Collection · 2026.10.19 — 10.24</p>
          <h1 className="serif mt-5 text-[2.25rem] font-semibold leading-[1.25] tracking-[-0.03em] md:text-[3rem]">
            {collection.title}
          </h1>
          {collection.description && (
            <p className="serif mt-5 text-[1.125rem] leading-relaxed text-ink-soft md:text-[1.25rem]">
              {collection.description}
            </p>
          )}
        </div>
        <div className="self-end text-[0.8125rem] leading-relaxed text-muted md:col-span-4 md:col-start-9">
          {collection.days && (
            <p className="mb-4 flex items-baseline gap-3">
              <span className="numeral text-[2rem] leading-none text-ink">{done}</span>
              <span>/ {collection.days.length}일 묵상 완료</span>
            </p>
          )}
          {id === REVIVAL_2026_ID && (
            <p>
              설교 제목·설교자·본문은 자동으로 채우지 않습니다.{" "}
              <a
                href={REVIVAL_2026_OFFICIAL_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="link-quiet inline-flex items-center gap-0.5"
              >
                특별새벽부흥회 공식 페이지
                <ArrowUpRight className="size-3" aria-hidden />
              </a>
              에서 확인한 내용만 각 날짜에 입력해 주세요.
            </p>
          )}
        </div>
      </header>

      {collection.days && (
        <ol className="mt-16 border-t border-ink">
          {collection.days.map((d) => (
            <DayRow
              key={d.day}
              day={d}
              collection={collection}
              record={d.recordId ? byId.get(d.recordId) : undefined}
              isToday={today === d.day}
              records={records ?? []}
            />
          ))}
        </ol>
      )}

      {loose.length > 0 && (
        <section className="mt-20">
          <h2 className="label mb-2">이 컬렉션의 다른 기록</h2>
          <ul className="divide-y divide-border border-t border-border">
            {loose.map((r) => (
              <li key={r.id}>
                <RecordRow record={r} compact />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function DayRow({
  day,
  collection,
  record,
  isToday,
  records,
}: {
  day: CollectionDay;
  collection: Collection;
  record?: ArchiveRecord;
  isToday: boolean;
  records: ArchiveRecord[];
}) {
  const [open, setOpen] = useState(false);
  const [, m, d] = day.date.split("-");

  const saveDay = async (patch: Partial<CollectionDay>) => {
    const days = collection.days!.map((x) => (x.day === day.day ? { ...x, ...patch } : x));
    const recordIds =
      patch.recordId && !collection.recordIds.includes(patch.recordId)
        ? [...collection.recordIds, patch.recordId]
        : collection.recordIds;
    await putCollection({ ...collection, days, recordIds });
  };

  return (
    <li
      id={`day-${day.day}`}
      className={cn("scroll-mt-24 border-b border-border", isToday && "bg-surface/60")}
    >
      <div className="grid grid-cols-[4.5rem_1fr] gap-x-5 gap-y-3 py-8 md:grid-cols-[7rem_1fr_15rem] md:gap-x-10">
        <div>
          <p className="eyebrow !tracking-[0.18em]">Day</p>
          <p
            className={cn(
              "numeral mt-1 text-[2.5rem] leading-none tracking-[-0.03em] md:text-[3rem]",
              isToday ? "text-forest" : "text-ink",
            )}
          >
            {String(day.day).padStart(2, "0")}
          </p>
          <p className="tabular mt-2 text-[0.8125rem] text-muted">
            {Number(m)}.{Number(d)} ({weekdayKo(day.date)})
            {isToday && <span className="ml-1.5 font-medium text-forest">오늘</span>}
          </p>
        </div>
        <div className="min-w-0">
          <p
            className={cn(
              "serif text-[1.25rem] leading-snug tracking-[-0.015em]",
              day.title || record ? "text-ink" : "text-faint",
            )}
          >
            {day.title || record?.title || "설교 제목 미입력"}
          </p>
          <p className="mt-2 text-[0.875rem] text-muted">
            {[day.preacher, day.scripture].filter(Boolean).join(" · ") || "설교자 · 본문 미입력"}
          </p>
          {day.sourceUrl && (
            <a
              href={day.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="link-quiet mt-2 inline-block text-[0.75rem]"
            >
              정보 출처
            </a>
          )}
          <button
            type="button"
            className="link-quiet mt-3 block text-[0.8125rem]"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? "닫기" : "정보 입력 · 영상 연결"}
          </button>
        </div>
        <div className="col-span-2 flex flex-col gap-2 text-[0.8125rem] md:col-span-1 md:items-end">
          {record ? (
            <>
              <Link href={`/record/${record.id}`} className="btn btn-quiet btn-sm">
                기록 열기
              </Link>
              <span className="text-muted">
                {STATUS_LABEL[record.status]}
                {record.reflectionDone && (
                  <span className="ml-2 inline-flex items-center gap-1 text-forest">
                    <Check className="size-3.5" aria-hidden />
                    묵상 완료
                  </span>
                )}
              </span>
              {record.lastReadSegmentId && <span className="text-faint">읽던 위치 저장됨</span>}
            </>
          ) : (
            <span className="text-faint">아직 기록 전</span>
          )}
        </div>
      </div>

      {open && (
        <div className="fade-in grid gap-10 pb-10 md:grid-cols-[7rem_1fr] md:gap-x-10">
          <div className="hidden md:block" />
          <div className="grid gap-10 lg:grid-cols-2">
            <DayForm
              key={`${day.title}|${day.preacher}|${day.scripture}|${day.sourceUrl}`}
              day={day}
              onSave={saveDay}
            />
            <div className="space-y-6">
              <div>
                <p className="label mb-3">영상 링크로 기록 시작</p>
                <LinkComposer collectionId={collection.id} onCreated={(rid) => saveDay({ recordId: rid })} />
              </div>
              {records.length > 0 && (
                <div>
                  <label className="label mb-3 block" htmlFor={`link-${day.day}`}>
                    기존 기록 연결
                  </label>
                  <select
                    id={`link-${day.day}`}
                    className="field"
                    value={day.recordId ?? ""}
                    onChange={(e) => void saveDay({ recordId: e.target.value || null })}
                  >
                    <option value="">선택 안 함</option>
                    {records.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </li>
  );
}

function DayForm({
  day,
  onSave,
}: {
  day: CollectionDay;
  onSave: (p: Partial<CollectionDay>) => Promise<void>;
}) {
  const [draft, setDraft] = useState(day);
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        await onSave({
          title: draft.title?.trim() || undefined,
          preacher: draft.preacher?.trim() || undefined,
          scripture: draft.scripture?.trim() || undefined,
          sourceUrl: draft.sourceUrl?.trim() || undefined,
        });
        toast(`Day ${String(day.day).padStart(2, "0")} 정보를 저장했습니다`);
      }}
    >
      <p className="label">설교 정보</p>
      {(
        [
          ["title", "설교 제목"],
          ["preacher", "설교자"],
          ["scripture", "말씀 본문"],
          ["sourceUrl", "정보 출처 URL"],
        ] as const
      ).map(([k, l]) => (
        <div key={k}>
          <label className="field-label" htmlFor={`d${day.day}-${k}`}>
            {l}
          </label>
          <input
            id={`d${day.day}-${k}`}
            className="field"
            type={k === "sourceUrl" ? "url" : "text"}
            value={draft[k] ?? ""}
            onChange={(e) => setDraft((x) => ({ ...x, [k]: e.target.value }))}
          />
        </div>
      ))}
      <button type="submit" className="btn btn-primary btn-sm">
        저장
      </button>
    </form>
  );
}
