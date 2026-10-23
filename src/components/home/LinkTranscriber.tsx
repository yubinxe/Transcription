"use client";
import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ArrowRight, Copy, Download, Loader2 } from "lucide-react";
import { parseYouTubeUrl, PARSE_FAILURE_MESSAGE, type ParsedYouTubeUrl } from "@/features/youtube/url";
import { fetchVideoMeta, type VideoMeta } from "@/features/youtube/metadata";
import { captionsToResult, fetchCaptions } from "@/features/transcription/providers/youtube-captions";
import { parseTextDocument } from "@/features/transcription/parsers";
import type { CaptionTrackInfo } from "@/features/youtube/timedtext";
import type { TranscriptResult, TranscriptSegment } from "@/types/transcript";
import {
  createRecord,
  findRecordByVideoId,
  getTranscript,
  saveTranscriptResult,
} from "@/lib/storage/repository";
import {
  downloadText,
  hasTimestamps,
  MIME,
  safeFileName,
  toParagraphs,
  toPlainText,
  toSrt,
} from "@/features/export/exporters";
import { formatClock, formatDuration } from "@/lib/utils/time";
import { Notice } from "@/components/ui/Disclosure";
import { toast } from "@/components/ui/Toaster";
import { cn } from "@/lib/utils/cn";

type Phase =
  | { kind: "idle" }
  | { kind: "invalid"; message: string }
  | { kind: "loading"; parsed: ParsedYouTubeUrl }
  | {
      kind: "result";
      parsed: ParsedYouTubeUrl;
      result: TranscriptResult;
      source: "captions" | "paste";
      tracks: CaptionTrackInfo[];
      captionKind?: "asr" | "standard";
    }
  | { kind: "fallback"; parsed: ParsedYouTubeUrl; message: string };

/**
 * The landing: paste a YouTube link, get the transcript text right here.
 * Falls back to pasting the "스크립트 표시" text when automatic retrieval is unavailable.
 */
export function LinkTranscriber() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [meta, setMeta] = useState<VideoMeta | null>(null);
  const [saving, setSaving] = useState(false);
  const reqRef = useRef<AbortController | null>(null);

  async function run(lang = "ko") {
    const parsed = parseYouTubeUrl(value);
    if (!parsed.ok) {
      setPhase({ kind: "invalid", message: PARSE_FAILURE_MESSAGE[parsed.reason] });
      return;
    }
    reqRef.current?.abort();
    const ctrl = new AbortController();
    reqRef.current = ctrl;
    setPhase({ kind: "loading", parsed: parsed.value });
    if (meta?.videoId !== parsed.value.videoId) setMeta(null);

    void fetchVideoMeta(parsed.value.videoId, ctrl.signal)
      .then((m) => m.ok && !ctrl.signal.aborted && setMeta(m.meta))
      .catch(() => undefined);

    try {
      // A transcript already saved in the archive needs no network round-trip.
      const existing = await findRecordByVideoId(parsed.value.videoId);
      const saved = existing ? await getTranscript(existing.id) : undefined;
      if (saved?.original.length && lang === "ko") {
        setPhase({
          kind: "result",
          parsed: parsed.value,
          source: "captions",
          tracks: [],
          result: { segments: saved.original, method: existing!.method ?? "youtube_captions", warnings: [] },
        });
        return;
      }
      const r = await fetchCaptions(parsed.value.videoId, lang, ctrl.signal);
      if (ctrl.signal.aborted) return;
      if (r.ok) {
        setPhase({
          kind: "result",
          parsed: parsed.value,
          source: "captions",
          tracks: r.data.tracks,
          captionKind: r.data.kind,
          result: captionsToResult(r),
        });
        if (r.data.title)
          setMeta(
            (m) =>
              m ?? {
                videoId: r.data.videoId,
                title: r.data.title!,
                channel: null,
                channelUrl: null,
                thumbnailUrl: `https://i.ytimg.com/vi/${r.data.videoId}/hqdefault.jpg`,
              },
          );
      } else {
        setPhase({
          kind: "fallback",
          parsed: parsed.value,
          message:
            r.error === "disabled"
              ? "자동으로 스크립트를 가져오는 기능이 이 서버에서 꺼져 있습니다."
              : r.message,
        });
      }
    } catch {
      /* aborted */
    }
  }

  async function save() {
    if (phase.kind !== "result" || saving) return;
    setSaving(true);
    try {
      const existing = await findRecordByVideoId(phase.parsed.videoId);
      const id =
        existing?.id ??
        (
          await createRecord({
            title: meta?.title ?? `YouTube ${phase.parsed.videoId}`,
            source: {
              type: "youtube",
              url: phase.parsed.canonicalUrl,
              videoId: phase.parsed.videoId,
              channel: meta?.channel ?? undefined,
              channelUrl: meta?.channelUrl ?? undefined,
              thumbnailUrl:
                meta?.thumbnailUrl ?? `https://i.ytimg.com/vi/${phase.parsed.videoId}/hqdefault.jpg`,
            },
          })
        ).id;
      const current = await getTranscript(id);
      if (!current?.original.length) await saveTranscriptResult(id, phase.result);
      router.push(`/record/${id}`);
    } finally {
      setSaving(false);
    }
  }

  const loading = phase.kind === "loading";
  const parsedForMeta = phase.kind === "idle" || phase.kind === "invalid" ? null : phase.parsed;

  return (
    <div className="w-full">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run();
        }}
        className={cn(
          "group flex flex-col border bg-surface transition-[border-color,box-shadow] duration-200 sm:flex-row sm:items-stretch",
          phase.kind === "invalid"
            ? "border-danger/60"
            : "border-rule hover:border-faint focus-within:border-ink focus-within:hover:border-ink",
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
          onChange={(e) => {
            setValue(e.target.value);
            if (phase.kind === "invalid") setPhase({ kind: "idle" });
          }}
          onPaste={(e) => {
            // Pasting a link starts right away — no extra click.
            const text = e.clipboardData.getData("text");
            if (parseYouTubeUrl(text).ok) {
              e.preventDefault();
              setValue(text.trim());
              setTimeout(() => document.getElementById("yt-submit")?.click(), 0);
            }
          }}
          aria-invalid={phase.kind === "invalid" || undefined}
          aria-describedby="yt-url-status"
          className="min-h-[3.75rem] flex-1 bg-transparent px-5 text-[1rem] tracking-[-0.005em] placeholder:text-faint focus:outline-none sm:min-h-[4.25rem] sm:px-6 sm:text-[1.0625rem]"
        />
        <button
          id="yt-submit"
          type="submit"
          disabled={loading}
          className="btn btn-primary m-1.5 min-h-[3.25rem] px-6 text-[0.9375rem] sm:m-2 sm:min-h-0 sm:px-7"
        >
          {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          텍스트로 보기
          {!loading && <ArrowRight className="size-4" aria-hidden />}
        </button>
      </form>

      <div id="yt-url-status" aria-live="polite">
        {phase.kind === "invalid" && <p className="mt-3 text-[0.875rem] text-danger">{phase.message}</p>}
      </div>

      {parsedForMeta && <VideoHeader meta={meta} parsed={parsedForMeta} settled={!loading} />}

      {loading && (
        <p className="mt-8 flex items-center gap-2.5 text-[0.875rem] text-muted" role="status">
          <span className="breathe inline-block size-1.5 rounded-full bg-forest" aria-hidden />
          스크립트를 불러오는 중
        </p>
      )}

      {phase.kind === "fallback" && (
        <PasteFallback
          message={phase.message}
          url={phase.parsed.canonicalUrl}
          onParsed={(segments) =>
            setPhase({
              kind: "result",
              parsed: phase.parsed,
              source: "paste",
              tracks: [],
              result: {
                segments,
                method: hasTimestamps(segments) ? "pasted_transcript" : "manual",
                warnings: [],
              },
            })
          }
        />
      )}

      {phase.kind === "result" && (
        <TranscriptResultView
          title={meta?.title ?? phase.parsed.videoId}
          result={phase.result}
          tracks={phase.tracks}
          captionKind={phase.captionKind}
          onLanguage={(lang) => void run(lang)}
          onSave={save}
          saving={saving}
        />
      )}
    </div>
  );
}

function VideoHeader({
  meta,
  parsed,
  settled,
}: {
  meta: VideoMeta | null;
  parsed: ParsedYouTubeUrl;
  settled: boolean;
}) {
  const [broken, setBroken] = useState<string | null>(null);
  const thumb = meta?.thumbnailUrl ?? `https://i.ytimg.com/vi/${parsed.videoId}/hqdefault.jpg`;
  return (
    <div className="fade-in mt-8 flex items-center gap-4 border-t hairline pt-6">
      <div className="relative aspect-video w-28 shrink-0 overflow-hidden bg-[#ece9e2] sm:w-36">
        {broken !== thumb && (
          <Image
            src={thumb}
            alt=""
            fill
            sizes="144px"
            className="object-cover"
            unoptimized
            onError={() => setBroken(thumb)}
          />
        )}
      </div>
      <div className="min-w-0">
        <p className="eyebrow mb-1.5">{parsed.isShorts ? "Shorts" : "YouTube"}</p>
        <p className="serif line-clamp-2 text-[1.0625rem] leading-snug text-ink">
          {meta?.title ?? <span className="text-faint">{settled ? "YouTube 영상" : "제목 확인 중"}</span>}
        </p>
        {meta?.channel && <p className="mt-1 truncate text-[0.8125rem] text-muted">{meta.channel}</p>}
      </div>
    </div>
  );
}

function TranscriptResultView({
  title,
  result,
  tracks,
  captionKind,
  onLanguage,
  onSave,
  saving,
}: {
  title: string;
  result: TranscriptResult;
  tracks: CaptionTrackInfo[];
  captionKind?: "asr" | "standard";
  onLanguage: (lang: string) => void;
  onSave: () => void;
  saving: boolean;
}) {
  const segments = result.segments;
  const timed = hasTimestamps(segments);
  const [showTs, setShowTs] = useState(false);
  const paragraphs = useMemo(() => toParagraphs(segments), [segments]);
  const chars = useMemo(() => segments.reduce((n, s) => n + s.text.length, 0), [segments]);
  const last = segments[segments.length - 1];
  const duration = formatDuration(last?.endMs ?? last?.startMs ?? null);
  const languages = [...new Map(tracks.map((t) => [t.languageCode, t])).values()];

  return (
    <section aria-label="스크립트" className="fade-in mt-10">
      <div className="sticky top-16 z-20 -mx-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-y border-ink/80 bg-canvas/95 px-5 py-2.5 backdrop-blur-[4px] md:mx-0 md:px-0">
        <p className="tabular text-[0.8125rem] text-muted">
          {segments.length.toLocaleString()}문장 · {chars.toLocaleString()}자{duration && ` · ${duration}`}
          {captionKind === "asr" && <span className="ml-2 text-gold-deep">자동 생성 자막</span>}
        </p>
        <div className="flex flex-wrap items-center gap-x-1">
          {languages.length > 1 && (
            <select
              aria-label="자막 언어"
              className="field !w-auto !py-1.5 text-[0.8125rem]"
              defaultValue=""
              onChange={(e) => e.target.value && onLanguage(e.target.value)}
            >
              <option value="">언어 변경</option>
              {languages.map((t) => (
                <option key={t.languageCode} value={t.languageCode}>
                  {t.name}
                </option>
              ))}
            </select>
          )}
          {timed && (
            <button
              type="button"
              aria-pressed={showTs}
              onClick={() => setShowTs((v) => !v)}
              className={cn("btn btn-text btn-sm", showTs && "!text-forest")}
            >
              시간 표시
            </button>
          )}
          <button
            type="button"
            className="btn btn-text btn-sm"
            onClick={async () => {
              await navigator.clipboard.writeText(toPlainText(segments, showTs));
              toast("전체 텍스트를 복사했습니다");
            }}
          >
            <Copy className="size-4" strokeWidth={1.5} aria-hidden />
            복사
          </button>
          <button
            type="button"
            className="btn btn-text btn-sm"
            onClick={() =>
              downloadText(toPlainText(segments, showTs), safeFileName(title, "", "txt"), MIME.txt)
            }
          >
            <Download className="size-4" strokeWidth={1.5} aria-hidden />
            TXT
          </button>
          {timed && (
            <button
              type="button"
              className="btn btn-text btn-sm"
              onClick={() => downloadText(toSrt(segments), safeFileName(title, "", "srt"), MIME.srt)}
            >
              SRT
            </button>
          )}
          <button type="button" className="btn btn-primary btn-sm ml-1" onClick={onSave} disabled={saving}>
            {saving && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
            저장하고 묵상하기
            <ArrowRight className="size-3.5" aria-hidden />
          </button>
        </div>
      </div>

      <article className="reading mt-8 max-w-[46rem] text-[1.0625rem] leading-[1.85] md:text-[1.125rem]">
        {paragraphs.map((p) => (
          <div
            key={p[0]!.id}
            className={cn("para", showTs && "md:grid md:grid-cols-[4.25rem_minmax(0,1fr)]")}
          >
            {showTs && (
              <span className="tabular mb-1 block font-sans text-[0.75rem] text-faint md:mt-[0.55em]">
                {formatClock(p[0]!.startMs)}
              </span>
            )}
            <p className="mb-[1.15em]">{p.map((s) => s.text).join(" ")}</p>
          </div>
        ))}
      </article>
    </section>
  );
}

function PasteFallback({
  message,
  url,
  onParsed,
}: {
  message: string;
  url: string;
  onParsed: (s: TranscriptSegment[]) => void;
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="fade-in mt-8 space-y-5">
      <Notice tone="warn">{message}</Notice>
      <ol className="list-decimal space-y-1 pl-5 text-[0.875rem] leading-relaxed text-ink-soft">
        <li>
          <a href={url} target="_blank" rel="noopener noreferrer" className="link-quiet">
            YouTube에서 영상 열기
          </a>
        </li>
        <li>설명란 ‘더보기’ → ‘스크립트 표시’</li>
        <li>스크립트를 모두 선택해 복사한 뒤 아래에 붙여넣기</li>
      </ol>
      <textarea
        aria-label="스크립트 붙여넣기"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onPaste={(e) => {
          const pasted = e.clipboardData.getData("text");
          if (!pasted.trim()) return;
          const { segments } = parseTextDocument(pasted);
          if (segments.length) {
            e.preventDefault();
            setText(pasted);
            onParsed(segments);
          }
        }}
        className="field min-h-48 resize-y leading-relaxed"
        placeholder={"0:00\n오늘 함께 나눌 말씀은…"}
      />
      {error && <Notice tone="danger">{error}</Notice>}
      <button
        type="button"
        className="btn btn-primary btn-sm"
        disabled={!text.trim()}
        onClick={() => {
          const { segments } = parseTextDocument(text);
          if (!segments.length) setError("읽을 수 있는 문장을 찾지 못했습니다.");
          else onParsed(segments);
        }}
      >
        텍스트로 보기
      </button>
    </div>
  );
}
