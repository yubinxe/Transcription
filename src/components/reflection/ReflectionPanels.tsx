"use client";
import { useState } from "react";
import { Play, Trash2 } from "lucide-react";
import type { Highlight, Reflection, ReflectionKey, StudyKey } from "@/types/record";
import { deleteHighlight, patchReflection, updateHighlight, updateRecord } from "@/lib/storage/repository";
import { REFLECTION_SECTIONS, STUDY_SECTIONS } from "@/features/scripture-study/sections";
import { useAutosave } from "@/lib/utils/use-debounced";
import { formatClock } from "@/lib/utils/time";
import { Toggle } from "@/components/transcript/ReadingControls";

/* ───────── Quotes ───────── */

export function QuoteBlock({
  h,
  onSeek,
  canSeek,
  compact = false,
}: {
  h: Highlight;
  onSeek: (ms: number | null) => void;
  canSeek: boolean;
  compact?: boolean;
}) {
  const [note, setNote] = useState(h.note);
  useAutosave(note, 600, (v) => updateHighlight(h.id, { note: v }));
  return (
    <figure className="group/q relative border-l border-gold py-1 pl-5">
      <blockquote className="serif text-[1.0625rem] leading-[1.8] text-ink">{h.quote}</blockquote>
      <figcaption className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.75rem] text-muted">
        {h.startMs != null && (
          <button
            type="button"
            disabled={!canSeek}
            onClick={() => onSeek(h.startMs)}
            className="tabular inline-flex items-center gap-1 transition-colors duration-150 enabled:hover:text-forest"
            aria-label={`${formatClock(h.startMs)} 지점 듣기`}
          >
            {canSeek && <Play className="size-3" aria-hidden />}
            {formatClock(h.startMs)}
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            if (window.confirm("이 문장을 목록에서 지울까요? 원문은 그대로 남습니다."))
              void deleteHighlight(h.id);
          }}
          className="inline-flex items-center gap-1 opacity-100 transition-[opacity,color] duration-150 hover:text-danger md:opacity-0 md:focus:opacity-100 md:group-hover/q:opacity-100"
        >
          <Trash2 className="size-3" aria-hidden />
          지우기
        </button>
      </figcaption>
      {!compact && (
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="이 문장에 대한 메모"
          aria-label="인용 메모"
          rows={1}
          className="mt-3 w-full resize-none border-b border-transparent bg-transparent py-1 text-[0.875rem] leading-relaxed text-ink-soft transition-colors duration-150 [field-sizing:content] placeholder:text-faint hover:border-border focus:border-forest focus:outline-none"
        />
      )}
    </figure>
  );
}

/* ───────── 말씀 연구 ───────── */

export function StudyPanel({
  reflection,
  highlights,
  onSeek,
  canSeek,
}: {
  reflection: Reflection;
  highlights: Highlight[];
  onSeek: (ms: number | null) => void;
  canSeek: boolean;
}) {
  return (
    <div className="space-y-16 pb-24 pt-10">
      <section aria-labelledby="key-sentences">
        <SectionHead id="key-sentences" eyebrow="Key sentences" title="핵심 문장" />
        {highlights.length === 0 ? (
          <p className="mt-5 max-w-lg text-[0.9375rem] leading-relaxed text-muted">
            원문에서 문장을 드래그해 선택하고 ‘문장 저장’을 누르면, 원문 그대로 이곳에 담깁니다. 시간 정보가
            함께 기록되어 다시 들을 수 있습니다.
          </p>
        ) : (
          <div className="mt-6 space-y-8">
            {highlights.map((h) => (
              <QuoteBlock key={h.id} h={h} onSeek={onSeek} canSeek={canSeek} />
            ))}
          </div>
        )}
      </section>
      <NotesForm reflection={reflection} kind="study" />
    </div>
  );
}

/* ───────── 나의 묵상 ───────── */

export function ReflectionPanel({
  reflection,
  highlights,
  onSeek,
  canSeek,
  done,
}: {
  reflection: Reflection;
  highlights: Highlight[];
  onSeek: (ms: number | null) => void;
  canSeek: boolean;
  done: boolean;
}) {
  return (
    <div className="pb-24 pt-10">
      <p className="max-w-xl text-[0.9375rem] leading-relaxed text-muted">
        필요한 칸만 채우셔도 됩니다. 원문에서 문장을 선택해 ‘묵상에 인용’을 누르면 해당 칸에 원문이 그대로
        첨부됩니다.
      </p>
      <NotesForm
        reflection={reflection}
        kind="reflection"
        highlights={highlights}
        onSeek={onSeek}
        canSeek={canSeek}
      />
      <div className="mt-14 max-w-md border-t hairline pt-6 text-[0.875rem]">
        <Toggle
          label="오늘의 묵상을 마쳤습니다"
          description="아카이브와 컬렉션에서 완료로 표시됩니다."
          checked={done}
          onChange={(v) => void updateRecord(reflection.recordId, { reflectionDone: v })}
        />
      </div>
    </div>
  );
}

function SectionHead({
  id,
  eyebrow,
  title,
  no,
}: {
  id: string;
  eyebrow: string;
  title: string;
  no?: string;
}) {
  return (
    <div>
      <p className="eyebrow flex items-baseline gap-2.5">
        {no && <span className="numeral !tracking-normal text-[0.8125rem] text-gold-deep">{no}</span>}
        {eyebrow}
      </p>
      <h3 id={id} className="serif mt-2 text-[1.375rem] tracking-[-0.02em] text-ink">
        {title}
      </h3>
    </div>
  );
}

const EYEBROW: Record<ReflectionKey | StudyKey, string> = {
  remains: "One sentence",
  thesis: "Thesis",
  learned: "Insight",
  apply: "Application",
  prayer: "Prayer",
  scripture: "Scripture",
  questions: "Questions",
  application: "Practice",
  prayerTopics: "Prayer requests",
};

function NotesForm({
  reflection,
  kind,
  highlights = [],
  onSeek,
  canSeek = false,
}: {
  reflection: Reflection;
  kind: "study" | "reflection";
  highlights?: Highlight[];
  onSeek?: (ms: number | null) => void;
  canSeek?: boolean;
}) {
  // Local draft, initialised once per record; saves merge into the stored reflection.
  const [state, setState] = useState(() => ({ sections: reflection.sections, study: reflection.study }));
  useAutosave(state, 700, (v) => patchReflection(reflection.recordId, v));

  const sections =
    kind === "study"
      ? STUDY_SECTIONS.map((s) => ({ ...s, no: undefined as string | undefined }))
      : REFLECTION_SECTIONS.map((s) => ({ ...s, no: s.no as string | undefined }));

  return (
    <div className="mt-12 space-y-14">
      {sections.map((s) => {
        const value =
          kind === "study" ? state.study[s.key as StudyKey] : state.sections[s.key as ReflectionKey];
        const quotes = highlights.filter((h) => h.attachedTo === s.key);
        return (
          <section key={s.key} aria-labelledby={`sec-${s.key}`}>
            <SectionHead id={`sec-${s.key}`} eyebrow={EYEBROW[s.key]} title={s.title} no={s.no} />
            {quotes.length > 0 && (
              <div className="mt-5 space-y-5">
                {quotes.map((h) => (
                  <QuoteBlock
                    key={h.id}
                    h={h}
                    onSeek={onSeek ?? (() => undefined)}
                    canSeek={canSeek}
                    compact
                  />
                ))}
              </div>
            )}
            <textarea
              value={value}
              onChange={(e) =>
                setState((st) =>
                  kind === "study"
                    ? { ...st, study: { ...st.study, [s.key]: e.target.value } }
                    : { ...st, sections: { ...st.sections, [s.key]: e.target.value } },
                )
              }
              aria-labelledby={`sec-${s.key}`}
              placeholder={s.prompt}
              rows={3}
              className="serif mt-4 block w-full max-w-[44rem] resize-none border-0 border-b border-border bg-transparent px-0 py-2 text-[1.0625rem] leading-[1.85] text-ink transition-colors duration-150 [field-sizing:content] placeholder:font-sans placeholder:text-[0.9375rem] placeholder:text-faint hover:border-faint focus:border-forest focus:outline-none"
            />
          </section>
        );
      })}
    </div>
  );
}
