import Link from "next/link";
import Image from "next/image";
import { FileAudio, FileText } from "lucide-react";
import { RECORD_KIND_LABEL, type ArchiveRecord } from "@/types/record";
import { formatDate, formatDateTime, formatDuration } from "@/lib/utils/time";

export const STATUS_LABEL: Record<ArchiveRecord["status"], string> = {
  draft: "준비",
  needs_input: "텍스트 필요",
  transcribing: "전사 중",
  ready: "전사 완료",
  error: "오류",
};

export function RecordRow({ record, compact = false }: { record: ArchiveRecord; compact?: boolean }) {
  const meta = [
    RECORD_KIND_LABEL[record.kind],
    record.sermon?.preacher,
    record.sermon?.date ? formatDate(record.sermon.date) : null,
    formatDuration(record.durationMs),
  ].filter(Boolean);
  return (
    <Link
      href={`/record/${record.id}`}
      className="group grid grid-cols-[5.5rem_1fr] items-start gap-4 py-5 transition-colors duration-150 sm:grid-cols-[8rem_1fr_auto] sm:gap-6"
    >
      <div className="relative aspect-video overflow-hidden bg-[#ece9e2]">
        {record.source.thumbnailUrl ? (
          <Image
            src={record.source.thumbnailUrl}
            alt=""
            fill
            sizes="128px"
            unoptimized
            className="object-cover grayscale-[15%] transition-[filter] duration-300 group-hover:grayscale-0"
          />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center text-faint">
            {record.source.type === "file" && !/\.(srt|vtt|txt)$/i.test(record.source.fileName ?? "") ? (
              <FileAudio className="size-5" strokeWidth={1.25} aria-hidden />
            ) : (
              <FileText className="size-5" strokeWidth={1.25} aria-hidden />
            )}
          </span>
        )}
      </div>
      <div className="min-w-0">
        <p className="serif line-clamp-2 text-[1.0625rem] leading-snug text-ink transition-colors duration-150 group-hover:text-forest">
          {record.title}
        </p>
        <p className="mt-1.5 truncate text-[0.8125rem] text-muted">{meta.join(" · ")}</p>
        {!compact && record.tags.length > 0 && (
          <p className="mt-2 flex flex-wrap gap-1.5">
            {record.tags.map((t) => (
              <span key={t} className="chip">
                {t}
              </span>
            ))}
          </p>
        )}
      </div>
      <div className="col-start-2 flex items-center gap-3 text-[0.75rem] text-muted sm:col-start-3 sm:flex-col sm:items-end sm:gap-1.5">
        <span className={record.status === "ready" ? "text-forest" : record.status === "transcribing" ? "text-gold-deep" : ""}>
          {STATUS_LABEL[record.status]}
        </span>
        <span className="tabular">{formatDateTime(record.updatedAt)}</span>
      </div>
    </Link>
  );
}
