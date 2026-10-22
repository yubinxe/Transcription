"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ArrowRight, Loader2 } from "lucide-react";
import { parseYouTubeUrl, PARSE_FAILURE_MESSAGE, type ParsedYouTubeUrl } from "@/features/youtube/url";
import { fetchVideoMeta, META_FAILURE_MESSAGE, type VideoMeta } from "@/features/youtube/metadata";
import { createRecord, findRecordByVideoId } from "@/lib/storage/repository";
import { cn } from "@/lib/utils/cn";
import { addToCollection } from "@/lib/storage/repository";

type Phase =
  | { kind: "idle" }
  | { kind: "invalid"; message: string }
  | { kind: "checking"; parsed: ParsedYouTubeUrl }
  | { kind: "preview"; parsed: ParsedYouTubeUrl; meta: VideoMeta }
  | { kind: "manual"; parsed: ParsedYouTubeUrl; message: string; fatal: boolean };

export function LinkComposer({
  collectionId,
  onCreated,
}: { collectionId?: string; onCreated?: (recordId: string) => void | Promise<void> } = {}) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [rawPhase, setPhase] = useState<Phase>({ kind: "idle" });
  const phase: Phase = value.trim() || rawPhase.kind === "invalid" ? rawPhase : { kind: "idle" };
  const [manualTitle, setManualTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const lastIdRef = useRef<string | null>(null);

  const inspect = useCallback(async (raw: string) => {
    const parsed = parseYouTubeUrl(raw);
    if (!parsed.ok) {
      lastIdRef.current = null;
      setPhase(
        parsed.reason === "empty"
          ? { kind: "idle" }
          : { kind: "invalid", message: PARSE_FAILURE_MESSAGE[parsed.reason] },
      );
      return null;
    }
    if (lastIdRef.current === parsed.value.videoId) return parsed.value;
    lastIdRef.current = parsed.value.videoId;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setPhase({ kind: "checking", parsed: parsed.value });
    try {
      const res = await fetchVideoMeta(parsed.value.videoId, ctrl.signal);
      if (ctrl.signal.aborted) return parsed.value;
      if (res.ok) setPhase({ kind: "preview", parsed: parsed.value, meta: res.meta });
      else
        setPhase({
          kind: "manual",
          parsed: parsed.value,
          message: META_FAILURE_MESSAGE[res.reason],
          fatal: res.reason === "not_found",
        });
    } catch {
      /* aborted */
    }
    return parsed.value;
  }, []);

  // Paste is auto-detected: no need to press anything.
  useEffect(() => {
    if (!value.trim()) {
      lastIdRef.current = null;
      return;
    }
    const t = setTimeout(() => void inspect(value), 280);
    return () => clearTimeout(t);
  }, [value, inspect]);

  async function submit() {
    if (submitting) return;
    const parsed = parseYouTubeUrl(value);
    if (!parsed.ok) {
      if (!value.trim()) document.getElementById("yt-url")?.focus();
      setPhase({ kind: "invalid", message: PARSE_FAILURE_MESSAGE[parsed.reason] });
      return;
    }
    setSubmitting(true);
    try {
      const existing = await findRecordByVideoId(parsed.value.videoId);
      if (existing) {
        if (collectionId) await addToCollection(collectionId, existing.id);
        await onCreated?.(existing.id);
        router.push(`/record/${existing.id}`);
        return;
      }
      const meta =
        phase.kind === "preview" && phase.parsed.videoId === parsed.value.videoId ? phase.meta : null;
      const record = await createRecord({
        title: meta?.title ?? manualTitle.trim() ?? "",
        source: {
          type: "youtube",
          url: parsed.value.canonicalUrl,
          videoId: parsed.value.videoId,
          channel: meta?.channel ?? undefined,
          channelUrl: meta?.channelUrl ?? undefined,
          thumbnailUrl: meta?.thumbnailUrl ?? `https://i.ytimg.com/vi/${parsed.value.videoId}/hqdefault.jpg`,
        },
      });
      if (collectionId) await addToCollection(collectionId, record.id);
      await onCreated?.(record.id);
      router.push(`/record/${record.id}?start=1`);
    } finally {
      setSubmitting(false);
    }
  }

  const invalid = phase.kind === "invalid";
  const blocked = phase.kind === "manual" && phase.fatal;
  const needsTitle = phase.kind === "manual" && !phase.fatal;

  return (
    <div className="w-full">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className={cn(
          "group flex flex-col border bg-surface transition-[border-color,box-shadow] duration-200 sm:flex-row sm:items-stretch",
          invalid
            ? "border-danger/60"
            : "border-rule focus-within:border-ink hover:border-faint focus-within:hover:border-ink",
          "focus-within:shadow-[0_18px_40px_-28px_rgba(37,41,36,0.45)]",
        )}
      >
        <label htmlFor="yt-url" className="sr-only">
          YouTube 영상 링크
        </label>
        <input
          id="yt-url"
          name="url"
          type="url"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="go"
          placeholder="YouTube 영상 링크를 붙여넣어 주세요"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-invalid={invalid || undefined}
          aria-describedby="yt-url-status"
          className="min-h-[3.75rem] flex-1 bg-transparent px-5 text-[1rem] tracking-[-0.005em] placeholder:text-faint focus:outline-none sm:min-h-[4.25rem] sm:px-6 sm:text-[1.0625rem]"
        />
        <button
          type="submit"
          disabled={submitting || blocked}
          className="btn btn-primary m-1.5 min-h-[3.25rem] px-6 text-[0.9375rem] sm:m-2 sm:min-h-0 sm:px-7"
        >
          {submitting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          기록 시작하기
          <ArrowRight
            className="size-4 transition-transform duration-200 group-focus-within:translate-x-0.5"
            aria-hidden
          />
        </button>
      </form>

      <div id="yt-url-status" aria-live="polite" className="min-h-[1.5rem]">
        {invalid && <p className="mt-3 text-[0.875rem] text-danger">{phase.message}</p>}
        {phase.kind === "checking" && (
          <p className="mt-4 flex items-center gap-2 text-[0.8125rem] text-muted">
            <span className="breathe inline-block size-1.5 rounded-full bg-forest" aria-hidden />
            영상 정보 확인 중
          </p>
        )}
        {phase.kind === "preview" && (
          <div className="fade-in mt-5 flex items-center gap-4 border-t hairline pt-5">
            <div className="relative aspect-video w-28 shrink-0 overflow-hidden bg-border sm:w-36">
              <Image
                src={phase.meta.thumbnailUrl}
                alt=""
                fill
                sizes="144px"
                className="object-cover"
                unoptimized
              />
            </div>
            <div className="min-w-0">
              <p className="eyebrow mb-1.5">{phase.parsed.isShorts ? "Shorts" : "YouTube"}</p>
              <p className="serif line-clamp-2 text-[1.0625rem] leading-snug text-ink">{phase.meta.title}</p>
              {phase.meta.channel && (
                <p className="mt-1 truncate text-[0.8125rem] text-muted">{phase.meta.channel}</p>
              )}
            </div>
          </div>
        )}
        {phase.kind === "manual" && (
          <div className="fade-in mt-5 border-t hairline pt-5">
            <p className={cn("text-[0.875rem]", phase.fatal ? "text-danger" : "text-ink-soft")}>
              {phase.message}
            </p>
            {needsTitle && (
              <div className="mt-3 max-w-md">
                <label htmlFor="manual-title" className="field-label">
                  기록 제목
                </label>
                <input
                  id="manual-title"
                  className="field"
                  value={manualTitle}
                  onChange={(e) => setManualTitle(e.target.value)}
                  placeholder="예: 10월 22일 새벽 말씀"
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
