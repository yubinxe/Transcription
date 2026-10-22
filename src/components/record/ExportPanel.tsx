"use client";
import { useMemo, useState } from "react";
import { Download, Copy } from "lucide-react";
import {
  canExport,
  downloadText,
  EXPORT_FORMAT_LABEL,
  EXPORT_SCOPE_LABEL,
  MIME,
  renderExport,
  safeFileName,
  type ExportBundle,
  type ExportFormat,
  type ExportScope,
} from "@/features/export/exporters";
import { toast } from "@/components/ui/Toaster";
import { cn } from "@/lib/utils/cn";

const FORMATS: ExportFormat[] = ["txt", "md", "srt", "vtt", "json"];
const SCOPES: ExportScope[] = ["original", "edited", "highlights", "reflection", "combined"];

export function ExportPanel({ bundle }: { bundle: ExportBundle }) {
  const [format, setFormat] = useState<ExportFormat>("md");
  const [scope, setScope] = useState<ExportScope>("combined");
  const allowed = canExport(format, scope, bundle);
  const content = useMemo(() => {
    if (!allowed) return "";
    try {
      return renderExport(bundle, format, scope);
    } catch {
      return "";
    }
  }, [bundle, format, scope, allowed]);

  return (
    <div className="w-[min(40rem,calc(100vw-2.5rem))]">
      <div className="grid gap-6 sm:grid-cols-2">
        <fieldset>
          <legend className="label mb-3">범위</legend>
          <div className="space-y-1">
            {SCOPES.map((s) => (
              <Radio
                key={s}
                name="scope"
                checked={scope === s}
                onChange={() => setScope(s)}
                label={EXPORT_SCOPE_LABEL[s]}
              />
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="label mb-3">형식</legend>
          <div className="space-y-1">
            {FORMATS.map((f) => (
              <Radio
                key={f}
                name="format"
                checked={format === f}
                onChange={() => setFormat(f)}
                label={EXPORT_FORMAT_LABEL[f]}
                hint={
                  (f === "srt" || f === "vtt") && !canExport(f, "original", bundle)
                    ? "타임스탬프 없음"
                    : undefined
                }
              />
            ))}
          </div>
        </fieldset>
      </div>
      <div className="mt-6 border-t hairline pt-5">
        {allowed && content ? (
          <pre className="max-h-48 overflow-auto whitespace-pre-wrap bg-paper p-4 font-mono text-[0.75rem] leading-relaxed text-ink-soft">
            {content.slice(0, 2400)}
            {content.length > 2400 && "\n…"}
          </pre>
        ) : (
          <p className="bg-paper p-4 text-[0.8125rem] text-muted">
            {format === "srt" || format === "vtt"
              ? "SRT·VTT는 실제 타임스탬프가 있는 전사 원문(원본 또는 편집본)에서만 만들 수 있습니다."
              : "내보낼 내용이 없습니다."}
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={!allowed || !content}
            onClick={() =>
              downloadText(
                content,
                safeFileName(bundle.record.title, EXPORT_SCOPE_LABEL[scope], format),
                MIME[format],
              )
            }
          >
            <Download className="size-4" strokeWidth={1.5} aria-hidden />
            내려받기
          </button>
          <button
            type="button"
            className="btn btn-quiet btn-sm"
            disabled={!allowed || !content}
            onClick={async () => {
              await navigator.clipboard.writeText(content);
              toast("클립보드에 복사했습니다");
            }}
          >
            <Copy className="size-4" strokeWidth={1.5} aria-hidden />
            복사
          </button>
        </div>
      </div>
    </div>
  );
}

function Radio({
  name,
  checked,
  onChange,
  label,
  hint,
}: {
  name: string;
  checked: boolean;
  onChange: () => void;
  label: string;
  hint?: string;
}) {
  return (
    <label
      className={cn(
        "flex min-h-9 cursor-pointer items-center gap-3 text-[0.875rem]",
        checked ? "text-ink" : "text-ink-soft",
      )}
    >
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={onChange}
        className="size-3.5 accent-[var(--color-forest)]"
      />
      <span>{label}</span>
      {hint && <span className="text-[0.75rem] text-faint">{hint}</span>}
    </label>
  );
}
