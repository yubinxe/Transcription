"use client";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp, Copy, Pencil, Search, SlidersHorizontal, Undo2, X } from "lucide-react";
import type { Highlight, Reflection, TranscriptDoc } from "@/types/record";
import type { TranscriptSegment } from "@/types/transcript";
import { usePreferences } from "@/lib/storage/preferences";
import {
  editSegment,
  effectiveSegments,
  restoreOriginal,
  patchReflection,
  undoLastEdit,
  updateRecord,
} from "@/lib/storage/repository";
import { findActiveIndex, findMatches, type SearchMatch } from "@/features/transcript-editor/active-segment";
import { toParagraphs, toPlainText, hasTimestamps } from "@/features/export/exporters";
import { formatClock } from "@/lib/utils/time";
import { useDebouncedValue } from "@/lib/utils/use-debounced";
import type { PlayerStore } from "@/components/player/player-store";
import { Popover } from "@/components/ui/Popover";
import { ReadingControls } from "./ReadingControls";
import { SelectionToolbar } from "./SelectionToolbar";
import { toast } from "@/components/ui/Toaster";
import { cn } from "@/lib/utils/cn";

const MEASURE = { narrow: "36rem", standard: "44rem", wide: "60rem" } as const;

export function TranscriptReader({
  recordId,
  doc,
  highlights,
  reflection,
  store,
  canPlay,
  lastReadSegmentId,
}: {
  recordId: string;
  doc: TranscriptDoc;
  highlights: Highlight[];
  reflection: Reflection;
  store: PlayerStore;
  canPlay: boolean;
  lastReadSegmentId?: string | null;
}) {
  const prefs = usePreferences().reading;
  const segments = useMemo(() => effectiveSegments(doc), [doc]);
  const timed = useMemo(() => hasTimestamps(segments), [segments]);
  const sync = timed && canPlay;
  const showTs = timed && prefs.showTimestamps;
  const [editing, setEditing] = useState(false);
  const [query, setQuery] = useState("");
  const q = useDebouncedValue(query, 150);
  const matches = useMemo(() => findMatches(segments, q), [segments, q]);
  const [cursor, setCursor] = useState({ q: "", i: 0 });
  const current = cursor.q === q ? cursor.i : 0;
  const setCurrent = (fn: (c: number) => number) => setCursor({ q, i: fn(current) });
  const [noteOpen, setNoteOpen] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const userScrollAt = useRef(0);
  const autoScrollRef = useRef(prefs.autoScroll);
  useEffect(() => {
    autoScrollRef.current = prefs.autoScroll;
  }, [prefs.autoScroll]);

  const highlighted = useMemo(() => new Set(highlights.flatMap((h) => h.segmentIds)), [highlights]);
  const matchesBySeg = useMemo(() => {
    const m = new Map<string, Array<SearchMatch & { n: number }>>();
    matches.forEach((x, n) => m.set(x.segmentId, [...(m.get(x.segmentId) ?? []), { ...x, n }]));
    return m;
  }, [matches]);
  const editedCount = Object.keys(doc.edits).length;

  useEffect(() => {
    const m = matches[current];
    if (!m) return;
    containerRef.current
      ?.querySelector(`[data-match="${current}"]`)
      ?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [current, matches]);

  /* Active segment follows playback. Done imperatively so a 3,000-segment sermon never re-renders per tick. */
  useEffect(() => {
    if (!sync) return;
    let prev: HTMLElement | null = null;
    const update = () => {
      const { timeMs, playing } = store.getSnapshot();
      const idx = findActiveIndex(segments, timeMs);
      const el =
        idx >= 0 ? (document.getElementById(`seg-${segments[idx]!.id}`) as HTMLElement | null) : null;
      if (el === prev) return;
      prev?.removeAttribute("data-active");
      el?.setAttribute("data-active", "true");
      prev = el;
      if (el && playing && autoScrollRef.current && Date.now() - userScrollAt.current > 4000) {
        const r = el.getBoundingClientRect();
        if (r.top < 140 || r.bottom > window.innerHeight - 80)
          el.scrollIntoView({ block: "center", behavior: "smooth" });
      }
    };
    update();
    return store.subscribe(update);
  }, [store, segments, sync, editing, prefs.mode]);

  /* Remember the reading position (first segment under the toolbar). */
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const onScroll = () => {
      userScrollAt.current = store.getSnapshot().playing ? Date.now() : 0;
      clearTimeout(t);
      t = setTimeout(() => {
        const box = containerRef.current?.getBoundingClientRect();
        if (!box) return;
        const el = document
          .elementFromPoint(box.left + Math.min(120, box.width / 2), 180)
          ?.closest<HTMLElement>("[data-seg]");
        const id = el?.dataset.seg;
        if (id) void updateRecord(recordId, { lastReadSegmentId: id });
      }, 800);
    };
    window.addEventListener("wheel", onScroll, { passive: true });
    window.addEventListener("touchmove", onScroll, { passive: true });
    window.addEventListener("keydown", onScroll);
    return () => {
      clearTimeout(t);
      window.removeEventListener("wheel", onScroll);
      window.removeEventListener("touchmove", onScroll);
      window.removeEventListener("keydown", onScroll);
    };
  }, [recordId, store]);

  const [resumeId] = useState(() => lastReadSegmentId ?? null);
  const showResume = !!resumeId && segments.findIndex((s) => s.id === resumeId) > 8;

  const seek = useCallback(
    (ms: number | null) => {
      if (ms == null || !sync) return;
      store.seek(ms, true);
      userScrollAt.current = 0;
    },
    [store, sync],
  );

  const copyAll = async () => {
    await navigator.clipboard.writeText(toPlainText(segments, showTs));
    toast("전체 원문을 복사했습니다");
  };

  const saveNote = async (segId: string, text: string) => {
    const segmentNotes = { ...reflection.segmentNotes };
    if (text.trim()) segmentNotes[segId] = text.trim();
    else delete segmentNotes[segId];
    await patchReflection(recordId, { segmentNotes });
  };

  const style = {
    fontSize: `${prefs.fontSize}px`,
    lineHeight: prefs.lineHeight,
    maxWidth: showTs ? `calc(${MEASURE[prefs.measure]} + 4.25rem)` : MEASURE[prefs.measure],
  } as const;

  return (
    <div>
      {/* Toolbar */}
      <div className="no-print sticky top-16 z-20 -mx-5 border-b hairline bg-canvas/95 px-5 backdrop-blur-[4px] md:mx-0 md:px-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-2 py-3">
          <div className="relative min-w-0 flex-1 basis-56">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint"
              aria-hidden
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && matches.length) {
                  e.preventDefault();
                  setCurrent((c) =>
                    e.shiftKey ? (c - 1 + matches.length) % matches.length : (c + 1) % matches.length,
                  );
                }
                if (e.key === "Escape") setQuery("");
              }}
              placeholder="원문에서 찾기"
              aria-label="원문 검색"
              className="field !py-2 !pl-9 !pr-24 text-[0.875rem]"
            />
            {q && (
              <div className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center gap-0.5 text-[0.75rem] text-muted">
                <span className="tabular px-1" aria-live="polite">
                  {matches.length ? `${current + 1}/${matches.length}` : "0건"}
                </span>
                <button
                  type="button"
                  aria-label="이전 결과"
                  className="rounded-[2px] p-1 hover:bg-sage-soft"
                  onClick={() => setCurrent((c) => (c - 1 + matches.length) % Math.max(1, matches.length))}
                >
                  <ChevronUp className="size-3.5" aria-hidden />
                </button>
                <button
                  type="button"
                  aria-label="다음 결과"
                  className="rounded-[2px] p-1 hover:bg-sage-soft"
                  onClick={() => setCurrent((c) => (c + 1) % Math.max(1, matches.length))}
                >
                  <ChevronDown className="size-3.5" aria-hidden />
                </button>
              </div>
            )}
          </div>
          <div className="flex items-center">
            <Popover
              label={
                <>
                  <SlidersHorizontal className="size-4" strokeWidth={1.5} aria-hidden />
                  <span>보기</span>
                </>
              }
            >
              <ReadingControls hasTiming={timed} />
            </Popover>
            <button
              type="button"
              aria-pressed={editing}
              onClick={() => setEditing((e) => !e)}
              className={cn("btn btn-text btn-sm", editing && "!text-forest")}
            >
              <Pencil className="size-4" strokeWidth={1.5} aria-hidden />
              {editing ? "편집 마침" : "교정"}
            </button>
            <button type="button" onClick={copyAll} aria-label="전체 복사" className="btn btn-text btn-sm">
              <Copy className="size-4" strokeWidth={1.5} aria-hidden />
              <span className="hidden sm:inline">전체 복사</span>
            </button>
          </div>
        </div>
        {editing && (
          <div className="fade-in flex flex-wrap items-center justify-between gap-2 border-t hairline py-2.5 text-[0.8125rem] text-muted">
            <span>
              문장을 눌러 고치세요. 원본 전사는 그대로 보존됩니다.
              {editedCount > 0 && ` · ${editedCount}개 문장 수정됨`}
            </span>
            <span className="flex gap-1">
              <button
                type="button"
                className="btn btn-text btn-sm"
                disabled={doc.history.length === 0}
                onClick={async () => {
                  const r = await undoLastEdit(recordId);
                  if (r) toast("마지막 수정을 되돌렸습니다");
                }}
              >
                <Undo2 className="size-4" strokeWidth={1.5} aria-hidden />
                되돌리기
              </button>
              <button
                type="button"
                className="btn btn-text btn-sm"
                disabled={editedCount === 0}
                onClick={async () => {
                  if (!window.confirm("모든 교정을 지우고 전사 원본으로 되돌릴까요?")) return;
                  await restoreOriginal(recordId);
                  toast("원본으로 복원했습니다");
                }}
              >
                원본으로 모두 복원
              </button>
            </span>
          </div>
        )}
      </div>

      {!timed && (
        <p className="mt-6 text-[0.8125rem] text-muted">
          시간 정보가 없는 텍스트라 영상 재생 위치와 연결되지 않습니다.
        </p>
      )}
      {showResume && (
        <button
          type="button"
          className="link-quiet mt-6 text-[0.8125rem]"
          onClick={() =>
            document
              .getElementById(`seg-${resumeId}`)
              ?.scrollIntoView({ block: "center", behavior: "smooth" })
          }
        >
          지난번 읽던 곳으로 이동
        </button>
      )}

      <div ref={containerRef} className="reading relative mt-8 pb-24" style={style} data-reader>
        {editing ? (
          <EditList segments={segments} doc={doc} recordId={recordId} />
        ) : prefs.mode === "paragraph" ? (
          toParagraphs(segments).map((para) => (
            <div
              key={para[0]!.id}
              className={cn("para", showTs && "md:grid md:grid-cols-[4.25rem_minmax(0,1fr)]")}
            >
              {showTs && (
                <TimeButton
                  ms={para[0]!.startMs}
                  onSeek={seek}
                  disabled={!sync}
                  className="mb-1.5 block md:mb-0 md:mt-[0.55em] md:self-start"
                />
              )}
              <p className="mb-[1.15em]">
                {para.map((s) => (
                  <SegmentText
                    key={s.id}
                    seg={s}
                    highlighted={highlighted.has(s.id)}
                    edited={doc.edits[s.id] != null}
                    noted={!!reflection.segmentNotes[s.id]}
                    matches={matchesBySeg.get(s.id)}
                    current={current}
                  />
                ))}
              </p>
            </div>
          ))
        ) : (
          <ol className="space-y-[0.7em]">
            {segments.map((s) => (
              <li
                key={s.id}
                className="group/seg grid grid-cols-[1fr_auto] gap-x-3 md:grid-cols-[4.25rem_1fr_auto]"
              >
                {showTs ? (
                  <TimeButton
                    ms={s.startMs}
                    onSeek={seek}
                    disabled={!sync}
                    className="col-span-2 md:col-span-1 md:mt-[0.35em]"
                  />
                ) : (
                  <span className="hidden md:block" />
                )}
                <div>
                  <SegmentText
                    seg={s}
                    highlighted={highlighted.has(s.id)}
                    edited={doc.edits[s.id] != null}
                    noted={!!reflection.segmentNotes[s.id]}
                    matches={matchesBySeg.get(s.id)}
                    current={current}
                  />
                  {noteOpen === s.id ? (
                    <NoteEditor
                      initial={reflection.segmentNotes[s.id] ?? ""}
                      onClose={() => setNoteOpen(null)}
                      onSave={(t) => saveNote(s.id, t)}
                    />
                  ) : reflection.segmentNotes[s.id] ? (
                    <button
                      type="button"
                      onClick={() => setNoteOpen(s.id)}
                      className="mt-2 block border-l-2 border-gold/60 pl-3 text-left font-sans text-[0.8125rem] leading-relaxed text-ink-soft"
                    >
                      {reflection.segmentNotes[s.id]}
                    </button>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => setNoteOpen(noteOpen === s.id ? null : s.id)}
                  className="mt-[0.3em] self-start font-sans text-[0.75rem] text-faint opacity-100 transition-opacity duration-150 hover:text-forest md:opacity-0 md:focus:opacity-100 md:group-hover/seg:opacity-100"
                  aria-label="이 문장에 메모"
                >
                  메모
                </button>
              </li>
            ))}
          </ol>
        )}
      </div>

      {!editing && (
        <SelectionToolbar
          containerRef={containerRef}
          segments={segments}
          recordId={recordId}
          canSeek={sync}
          onSeek={seek}
        />
      )}
    </div>
  );
}

function TimeButton({
  ms,
  onSeek,
  disabled,
  className,
}: {
  ms: number | null;
  onSeek: (ms: number | null) => void;
  disabled: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onSeek(ms)}
      disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      aria-label={disabled ? `시각 ${formatClock(ms)}` : `${formatClock(ms)} 지점부터 재생`}
      className={cn(
        "tabular w-fit font-sans text-[0.75rem] leading-none tracking-[0.02em] text-faint transition-colors duration-150",
        !disabled && "hover:text-forest",
        className,
      )}
    >
      {formatClock(ms)}
    </button>
  );
}

function SegmentText({
  seg,
  highlighted,
  edited,
  noted,
  matches,
  current,
}: {
  seg: TranscriptSegment;
  highlighted: boolean;
  edited: boolean;
  noted: boolean;
  matches?: Array<SearchMatch & { n: number }>;
  current: number;
}) {
  let body: ReactNode = seg.text;
  if (matches?.length) {
    const parts: ReactNode[] = [];
    let pos = 0;
    for (const m of matches) {
      if (m.index > pos) parts.push(seg.text.slice(pos, m.index));
      parts.push(
        <mark key={m.n} className="hit" data-match={m.n} data-current={m.n === current || undefined}>
          {seg.text.slice(m.index, m.index + m.length)}
        </mark>,
      );
      pos = m.index + m.length;
    }
    if (pos < seg.text.length) parts.push(seg.text.slice(pos));
    body = parts;
  }
  return (
    <>
      <span
        id={`seg-${seg.id}`}
        data-seg={seg.id}
        className="seg"
        data-highlighted={highlighted || undefined}
        data-edited={edited || undefined}
        title={edited ? "교정한 문장" : undefined}
      >
        {body}
        {noted && (
          <span
            aria-label="메모 있음"
            className="ml-0.5 inline-block size-1.5 -translate-y-[0.5em] rounded-full bg-gold align-middle"
          />
        )}
      </span>{" "}
    </>
  );
}

function EditList({
  segments,
  doc,
  recordId,
}: {
  segments: TranscriptSegment[];
  doc: TranscriptDoc;
  recordId: string;
}) {
  return (
    <ol className="space-y-1">
      {segments.map((s) => (
        <EditRow
          key={`${s.id}:${s.text}`}
          seg={s}
          edited={doc.edits[s.id] != null}
          recordId={recordId}
          original={doc.original.find((o) => o.id === s.id)?.text ?? ""}
        />
      ))}
    </ol>
  );
}

function EditRow({
  seg,
  edited,
  recordId,
  original,
}: {
  seg: TranscriptSegment;
  edited: boolean;
  recordId: string;
  original: string;
}) {
  const [value, setValue] = useState(seg.text);
  return (
    <li className="group/edit grid grid-cols-[1fr] gap-x-3 md:grid-cols-[4.25rem_1fr]">
      <span className="tabular hidden pt-2.5 font-sans text-[0.75rem] text-faint md:block">
        {formatClock(seg.startMs)}
      </span>
      <div>
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => {
            const next = value.replace(/\s+/g, " ").trim();
            if (next && next !== seg.text) void editSegment(recordId, seg.id, next);
            else if (!next) setValue(seg.text);
          }}
          rows={1}
          aria-label={`문장 교정 ${formatClock(seg.startMs)}`}
          className={cn(
            "w-full resize-none rounded-[2px] border border-transparent bg-transparent px-2 py-1.5 transition-colors duration-150 [field-sizing:content] hover:border-border focus:border-forest focus:bg-surface focus:outline-none",
            edited && "bg-[rgb(170_134_96/0.07)]",
          )}
        />
        {edited && (
          <div className="flex flex-wrap items-baseline gap-x-3 px-2 pb-1 font-sans text-[0.75rem] text-muted">
            <span className="line-clamp-1">원본: {original}</span>
            <button
              type="button"
              className="link-quiet"
              onClick={() => void restoreOriginal(recordId, seg.id)}
            >
              원본 복원
            </button>
          </div>
        )}
      </div>
    </li>
  );
}

function NoteEditor({
  initial,
  onSave,
  onClose,
}: {
  initial: string;
  onSave: (t: string) => Promise<void>;
  onClose: () => void;
}) {
  const [v, setV] = useState(initial);
  return (
    <div className="mt-2 font-sans">
      <textarea
        autoFocus
        value={v}
        onChange={(e) => setV(e.target.value)}
        rows={2}
        className="field text-[0.875rem] leading-relaxed [field-sizing:content]"
        placeholder="이 문장에 대한 생각"
        aria-label="문장 메모"
      />
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={async () => {
            await onSave(v);
            onClose();
          }}
        >
          저장
        </button>
        <button type="button" className="btn btn-text btn-sm" onClick={onClose}>
          <X className="size-3.5" aria-hidden />
          닫기
        </button>
      </div>
    </div>
  );
}
