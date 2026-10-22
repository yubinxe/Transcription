"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { Download, Pause, Play, Repeat, Trash2 } from "lucide-react";
import { getDb } from "@/lib/storage/db";
import { deleteRecord, emptyReflection } from "@/lib/storage/repository";
import { PlayerStore, usePlayerSnapshot } from "@/components/player/player-store";
import { YouTubePlayer } from "@/components/player/YouTubePlayer";
import { MediaPlayer } from "@/components/player/MediaPlayer";
import { TranscriptReader } from "@/components/transcript/TranscriptReader";
import { ReflectionPanel, StudyPanel } from "@/components/reflection/ReflectionPanels";
import { AcquirePanel, JobProgress } from "./AcquirePanel";
import { ExportPanel } from "./ExportPanel";
import { RecordFacts, RecordMetaForm } from "./RecordDetails";
import { Popover } from "@/components/ui/Popover";
import { useJob } from "@/features/transcription/jobs";
import { findActiveIndex } from "@/features/transcript-editor/active-segment";
import { RECORD_KIND_LABEL } from "@/types/record";
import { effectiveSegments } from "@/lib/storage/repository";
import { formatClock } from "@/lib/utils/time";
import { cn } from "@/lib/utils/cn";

type Tab = "text" | "study" | "reflect";
const TABS: Array<[Tab, string]> = [
  ["text", "원문"],
  ["study", "말씀 연구"],
  ["reflect", "나의 묵상"],
];

export function RecordWorkspace({ id }: { id: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const record = useLiveQuery(async () => (await getDb().records.get(id)) ?? null, [id]);
  const doc = useLiveQuery(async () => (await getDb().transcripts.get(id)) ?? null, [id]);
  const highlights = useLiveQuery(
    () => getDb().highlights.where("recordId").equals(id).sortBy("createdAt"),
    [id],
  );
  const reflection = useLiveQuery(
    async () => (await getDb().reflections.get(id)) ?? emptyReflection(id),
    [id],
  );
  const media = useLiveQuery(async () => (await getDb().media.get(id)) ?? null, [id]);
  const store = useMemo(() => new PlayerStore(), []);
  useEffect(() => () => store.dispose(), [store]);
  const job = useJob(id);
  const [tab, setTab] = useState<Tab>("text");
  const [editingMeta, setEditingMeta] = useState(false);

  useEffect(() => {
    if (record?.title) document.title = `${record.title} · 새벽기록`;
  }, [record?.title]);

  if (record === undefined || doc === undefined) {
    return (
      <div className="mx-auto max-w-[1320px] px-5 py-24 text-[0.875rem] text-muted md:px-10">
        불러오는 중…
      </div>
    );
  }
  if (record === null) {
    return (
      <div className="mx-auto max-w-[1320px] px-5 py-24 md:px-10">
        <p className="serif text-[1.5rem]">기록을 찾을 수 없습니다.</p>
        <p className="mt-3 text-[0.9375rem] text-muted">
          삭제되었거나 다른 브라우저에 저장된 기록일 수 있습니다.
        </p>
        <Link href="/archive" className="link-quiet mt-6 inline-block text-[0.875rem]">
          내 아카이브로
        </Link>
      </div>
    );
  }

  const hasText = !!doc && doc.original.length > 0;
  const isYouTube = record.source.type === "youtube" && !!record.source.videoId;
  const canPlay = isYouTube || !!media;
  const jobRunning = !!job && !["done", "error", "needs_input"].includes(job.stage);
  const seek = (ms: number | null) => {
    if (ms == null || !canPlay) return;
    store.seek(ms, true);
  };

  return (
    <div className="mx-auto max-w-[1320px] px-5 md:px-10">
      <div className="grid gap-x-14 lg:grid-cols-[minmax(0,36fr)_minmax(0,64fr)]">
        {/* Listen */}
        <aside className="pt-8 lg:sticky lg:top-16 lg:h-[calc(100dvh-4rem)] lg:overflow-y-auto lg:pb-10 lg:pt-10 [scrollbar-width:thin]">
          <div className="sticky top-16 z-20 -mx-5 bg-canvas md:mx-0 lg:static">
            {isYouTube ? (
              <YouTubePlayer videoId={record.source.videoId!} store={store} title={record.title} />
            ) : media ? (
              <MediaPlayer blob={media.blob} type={media.type} store={store} />
            ) : null}
            {canPlay && hasText && <Transport store={store} doc={doc!} />}
          </div>

          <div className="mt-7">
            <p className="label">{RECORD_KIND_LABEL[record.kind]}</p>
            <h1 className="serif mt-3 text-[1.5rem] font-semibold leading-[1.38] tracking-[-0.025em] text-ink md:text-[1.75rem]">
              {record.title}
            </h1>
          </div>

          <div className="mt-6 border-t hairline pt-5">
            {editingMeta ? (
              <RecordMetaForm record={record} onDone={() => setEditingMeta(false)} />
            ) : (
              <>
                <RecordFacts record={record} />
                <div className="mt-5 flex flex-wrap gap-x-1">
                  <button
                    type="button"
                    className="btn btn-text btn-sm !px-0 !pr-3"
                    onClick={() => setEditingMeta(true)}
                  >
                    정보 편집
                  </button>
                  <button
                    type="button"
                    className="btn btn-text btn-sm hover:!text-danger"
                    onClick={async () => {
                      if (
                        !window.confirm("이 기록과 메모, 하이라이트를 모두 삭제할까요? 되돌릴 수 없습니다.")
                      )
                        return;
                      await deleteRecord(record.id);
                      router.push("/archive");
                    }}
                  >
                    <Trash2 className="size-3.5" strokeWidth={1.5} aria-hidden />
                    삭제
                  </button>
                </div>
              </>
            )}
          </div>
          {record.tags.length > 0 && (
            <p className="mt-4 flex flex-wrap gap-1.5">
              {record.tags.map((t) => (
                <span key={t} className="chip">
                  {t}
                </span>
              ))}
            </p>
          )}
        </aside>

        {/* Read · Reflect */}
        <section className="min-w-0 pt-8 lg:pt-10" aria-label="전사와 묵상">
          {!hasText ? (
            jobRunning ? (
              <JobProgress job={job!} recordId={record.id} />
            ) : (
              <AcquirePanel record={record} autoStart={params?.get("start") === "1"} />
            )
          ) : (
            <>
              <div className="flex items-end justify-between gap-4 border-b border-ink">
                <div
                  role="tablist"
                  aria-label="보기 전환"
                  className="-mb-px flex gap-6 overflow-x-auto sm:gap-8"
                >
                  {TABS.map(([key, label]) => (
                    <button
                      key={key}
                      role="tab"
                      id={`tab-${key}`}
                      aria-selected={tab === key}
                      aria-controls={`panel-${key}`}
                      onClick={() => setTab(key)}
                      className={cn(
                        "whitespace-nowrap border-b-2 pb-3 text-[0.9375rem] transition-colors duration-150",
                        tab === key
                          ? "border-ink font-medium text-ink"
                          : "border-transparent text-muted hover:text-ink",
                      )}
                    >
                      {label}
                      {key === "study" && highlights && highlights.length > 0 && (
                        <span className="tabular ml-1.5 text-[0.75rem] text-gold-deep">
                          {highlights.length}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
                <div className="pb-1.5">
                  <Popover
                    ariaLabel="내보내기"
                    label={
                      <>
                        <Download className="size-4" strokeWidth={1.5} aria-hidden />
                        <span className="hidden sm:inline">내보내기</span>
                      </>
                    }
                  >
                    <ExportPanel
                      bundle={{
                        record,
                        transcript: doc,
                        highlights: highlights ?? [],
                        reflection: reflection ?? null,
                      }}
                    />
                  </Popover>
                </div>
              </div>
              {job?.warnings.length && job.stage === "done" ? (
                <p className="mt-5 text-[0.8125rem] text-muted">{job.warnings.join(" ")}</p>
              ) : null}
              <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
                {tab === "text" && reflection && (
                  <TranscriptReader
                    recordId={record.id}
                    doc={doc!}
                    highlights={highlights ?? []}
                    reflection={reflection}
                    store={store}
                    canPlay={canPlay}
                    lastReadSegmentId={record.lastReadSegmentId}
                  />
                )}
                {tab === "study" && reflection && (
                  <StudyPanel
                    key={record.id}
                    reflection={reflection}
                    highlights={highlights ?? []}
                    onSeek={seek}
                    canSeek={canPlay}
                  />
                )}
                {tab === "reflect" && reflection && (
                  <ReflectionPanel
                    key={record.id}
                    reflection={reflection}
                    highlights={highlights ?? []}
                    onSeek={seek}
                    canSeek={canPlay}
                    done={!!record.reflectionDone}
                  />
                )}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

/** Compact transport under the player: play/pause, current line time, repeat current sentence. */
function Transport({
  store,
  doc,
}: {
  store: PlayerStore;
  doc: NonNullable<Parameters<typeof effectiveSegments>[0]>;
}) {
  const snap = usePlayerSnapshot(store);
  const segments = useMemo(() => effectiveSegments(doc), [doc]);
  if (!snap.ready) return null;
  const idx = findActiveIndex(segments, snap.timeMs);
  const seg = idx >= 0 ? segments[idx] : undefined;
  return (
    <div className="flex items-center justify-between gap-3 border-b hairline bg-canvas px-5 py-2 text-[0.8125rem] md:px-0">
      <div className="flex items-center gap-1">
        <button
          type="button"
          className="btn btn-text btn-sm !px-2"
          onClick={() => store.toggle()}
          aria-label={snap.playing ? "일시정지" : "재생"}
        >
          {snap.playing ? (
            <Pause className="size-4" strokeWidth={1.5} />
          ) : (
            <Play className="size-4" strokeWidth={1.5} />
          )}
        </button>
        <span className="tabular text-muted">{formatClock(snap.timeMs)}</span>
      </div>
      <button
        type="button"
        aria-pressed={!!snap.loop}
        disabled={!snap.loop && (!seg || seg.startMs == null)}
        onClick={() => {
          if (snap.loop) store.setLoop(null);
          else if (seg?.startMs != null)
            store.setLoop({ startMs: seg.startMs, endMs: seg.endMs ?? seg.startMs + 5000 });
        }}
        className={cn("btn btn-text btn-sm", snap.loop && "!text-forest")}
      >
        <Repeat className="size-3.5" strokeWidth={1.5} aria-hidden />
        {snap.loop ? `${formatClock(snap.loop.startMs)} 반복 중` : "이 문장 반복"}
      </button>
    </div>
  );
}
