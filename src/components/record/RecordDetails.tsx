"use client";
import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { RECORD_KIND_LABEL, type ArchiveRecord, type RecordKind, type SermonMeta } from "@/types/record";
import { updateRecord } from "@/lib/storage/repository";
import { formatDuration } from "@/lib/utils/time";
import { toast } from "@/components/ui/Toaster";

export const METHOD_LABEL: Record<string, string> = {
  youtube_oauth: "YouTube 자막 (공식 API)",
  youtube_captions: "YouTube 자막",
  uploaded_caption: "자막 파일",
  pasted_transcript: "YouTube 스크립트 붙여넣기",
  local_whisper: "기기 내 음성 인식 (Whisper)",
  remote_whisper: "faster-whisper 서버",
  manual: "직접 입력한 텍스트",
};

export function RecordFacts({ record }: { record: ArchiveRecord }) {
  const rows: Array<[string, React.ReactNode]> = [];
  if (record.source.channel) rows.push(["채널", record.source.channel]);
  if (record.source.fileName) rows.push(["파일", record.source.fileName]);
  if (record.durationMs) rows.push(["길이", formatDuration(record.durationMs)]);
  if (record.method) rows.push(["전사 방식", METHOD_LABEL[record.method] ?? record.method]);
  const m = record.sermon ?? {};
  if (m.preacher) rows.push(["설교자", m.preacher]);
  if (m.scripture) rows.push(["본문", m.scripture]);
  if (m.date) rows.push(["일시", m.date]);
  if (m.church || m.event) rows.push(["교회·행사", [m.church, m.event].filter(Boolean).join(" · ")]);
  if (m.theme) rows.push(["주제", m.theme]);
  return (
    <dl className="grid grid-cols-[5.5rem_1fr] gap-x-4 gap-y-2.5 text-[0.8125rem]">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-muted">{k}</dt>
          <dd className="min-w-0 break-words text-ink-soft">{v}</dd>
        </div>
      ))}
      {record.source.url && (
        <div className="contents">
          <dt className="text-muted">출처</dt>
          <dd>
            <a
              href={record.source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="link-quiet inline-flex items-center gap-1"
            >
              YouTube에서 열기
              <ExternalLink className="size-3" aria-hidden />
            </a>
          </dd>
        </div>
      )}
    </dl>
  );
}

const FIELDS: Array<{ key: keyof SermonMeta; label: string; placeholder: string }> = [
  { key: "preacher", label: "설교자", placeholder: "" },
  { key: "scripture", label: "본문 성경", placeholder: "예: 로마서 8:1-4" },
  { key: "date", label: "설교 날짜", placeholder: "" },
  { key: "church", label: "교회", placeholder: "" },
  { key: "event", label: "행사", placeholder: "예: 2026 가을 특별새벽부흥회" },
  { key: "theme", label: "핵심 주제", placeholder: "" },
];

export function RecordMetaForm({ record, onDone }: { record: ArchiveRecord; onDone: () => void }) {
  const [title, setTitle] = useState(record.title);
  const [kind, setKind] = useState<RecordKind>(record.kind);
  const [meta, setMeta] = useState<SermonMeta>(record.sermon ?? {});
  const [tags, setTags] = useState(record.tags.join(", "));
  const [note, setNote] = useState(record.note ?? "");
  return (
    <form
      className="space-y-5"
      onSubmit={async (e) => {
        e.preventDefault();
        const clean = Object.fromEntries(
          Object.entries(meta)
            .map(([k, v]) => [k, (v ?? "").trim()])
            .filter(([, v]) => v),
        ) as SermonMeta;
        await updateRecord(record.id, {
          title: title.trim() || record.title,
          kind,
          sermon: clean,
          tags: [
            ...new Set(
              tags
                .split(/[,\n]/)
                .map((t) => t.trim())
                .filter(Boolean),
            ),
          ],
          note: note.trim(),
        });
        toast("기록 정보를 저장했습니다");
        onDone();
      }}
    >
      <div>
        <label className="field-label" htmlFor="m-title">
          제목
        </label>
        <input id="m-title" className="field" value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div>
        <span className="field-label">분류</span>
        <div className="segmented">
          {(Object.keys(RECORD_KIND_LABEL) as RecordKind[]).map((k) => (
            <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)}>
              {RECORD_KIND_LABEL[k]}
            </button>
          ))}
        </div>
      </div>
      {kind === "sermon" && (
        <div className="grid gap-4 sm:grid-cols-2">
          {FIELDS.map((f) => (
            <div key={f.key}>
              <label className="field-label" htmlFor={`m-${f.key}`}>
                {f.label}
              </label>
              <input
                id={`m-${f.key}`}
                type={f.key === "date" ? "date" : "text"}
                className="field"
                placeholder={f.placeholder}
                value={meta[f.key] ?? ""}
                onChange={(e) => setMeta((m) => ({ ...m, [f.key]: e.target.value }))}
              />
            </div>
          ))}
        </div>
      )}
      <div>
        <label className="field-label" htmlFor="m-tags">
          태그 <span className="font-normal text-faint">쉼표로 구분</span>
        </label>
        <input id="m-tags" className="field" value={tags} onChange={(e) => setTags(e.target.value)} />
      </div>
      <div>
        <label className="field-label" htmlFor="m-note">
          개인 메모
        </label>
        <textarea
          id="m-note"
          className="field min-h-20 leading-relaxed"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
      <p className="text-[0.75rem] leading-relaxed text-muted">
        영상 제목에 보이는 정보라도 직접 확인한 내용만 입력해 주세요. 비워 둔 항목은 내보내기에도 표시되지
        않습니다.
      </p>
      <div className="flex gap-2">
        <button type="submit" className="btn btn-primary btn-sm">
          저장
        </button>
        <button type="button" className="btn btn-text btn-sm" onClick={onDone}>
          취소
        </button>
      </div>
    </form>
  );
}
