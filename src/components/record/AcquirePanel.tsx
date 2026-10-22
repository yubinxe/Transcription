"use client";
import { useEffect, useRef, useState } from "react";
import { Captions, ClipboardPaste, FileAudio, KeyRound, Radio as RadioIcon } from "lucide-react";
import type { ArchiveRecord } from "@/types/record";
import {
  cancelJob,
  clearJob,
  keepPartial,
  runJob,
  STAGE_LABEL,
  useJob,
  type JobState,
} from "@/features/transcription/jobs";
import { youtubeOAuthProvider, GOOGLE_CLIENT_ID } from "@/features/transcription/providers/youtube-oauth";
import { youtubeUnofficialProvider } from "@/features/transcription/providers/youtube-unofficial";
import { importText, readTextFile, startMediaTranscription } from "@/features/transcription/start";
import { usePreferences } from "@/lib/storage/preferences";
import { formatBytes } from "@/lib/storage/backup";
import { formatClock } from "@/lib/utils/time";
import { PastePanel } from "@/components/home/AlternateInputs";
import { Dropzone } from "@/components/ui/Dropzone";
import { Notice } from "@/components/ui/Disclosure";
import { cn } from "@/lib/utils/cn";
import type { TranscriptionStage } from "@/types/transcript";

type Path = "paste" | "caption" | "media" | null;

/**
 * Shown while a record has no transcript yet. "No captions" is a normal step in the journey,
 * not a dead end: every path here produces a real transcript.
 */
export function AcquirePanel({ record, autoStart }: { record: ArchiveRecord; autoStart: boolean }) {
  const job = useJob(record.id);
  const prefs = usePreferences();
  const [path, setPath] = useState<Path>(null);
  const [error, setError] = useState<string | null>(null);
  const [serverCaptions, setServerCaptions] = useState<boolean | null>(null);
  const started = useRef(false);
  const isYouTube = record.source.type === "youtube" && !!record.source.videoId;
  const running = !!job && !["done", "error", "needs_input"].includes(job.stage);

  useEffect(() => {
    if (!isYouTube) return;
    fetch("/api/health")
      .then((r) => r.json())
      .then((d: { unofficialCaptions?: boolean }) => setServerCaptions(!!d.unofficialCaptions))
      .catch(() => setServerCaptions(false));
  }, [isYouTube]);

  const experimental = isYouTube && prefs.experimentalCaptions && serverCaptions === true;

  // Link-only path: try the automatic caption route right away when it is enabled.
  useEffect(() => {
    if (!autoStart || started.current || !experimental || job) return;
    started.current = true;
    void runJob(record.id, youtubeUnofficialProvider, {
      kind: "youtube",
      videoId: record.source.videoId!,
      url: record.source.url!,
    });
  }, [autoStart, experimental, job, record]);

  if (job && running) return <JobProgress job={job} recordId={record.id} />;

  return (
    <div className="pb-24 pt-10">
      {job?.error && <JobOutcome job={job} recordId={record.id} />}

      <p className="eyebrow">Next step</p>
      <h2 className="serif mt-3 text-[1.625rem] leading-snug tracking-[-0.02em] text-ink md:text-[1.875rem]">
        {isYouTube ? "이 영상의 말씀을 텍스트로 옮겨 볼까요" : "텍스트를 준비해 주세요"}
      </h2>
      {isYouTube && (
        <p className="mt-4 max-w-[38rem] text-[0.9375rem] leading-[1.8] text-ink-soft">
          일반 공개 영상의 자막은 공식 API만으로 항상 가져올 수 있는 것은 아닙니다. 아래 방법 중 하나로 전사를
          이어가세요. 가장 빠른 방법은 YouTube의 <strong className="font-semibold">스크립트 표시</strong>에서
          복사해 붙여넣는 것입니다.
        </p>
      )}

      <ol className="mt-10 divide-y divide-border border-y border-border">
        {isYouTube && (
          <PathRow
            icon={ClipboardPaste}
            title="YouTube 스크립트 붙여넣기"
            desc="영상 설명란 아래 ‘스크립트 표시’ → 전체 선택 → 복사. 시간 정보까지 그대로 인식합니다."
            recommended
            open={path === "paste"}
            onToggle={() => setPath(path === "paste" ? null : "paste")}
          >
            <ol className="mb-6 list-decimal space-y-1.5 pl-5 text-[0.8125rem] leading-relaxed text-muted">
              <li>
                <a className="link-quiet" href={record.source.url} target="_blank" rel="noopener noreferrer">
                  YouTube에서 영상 열기
                </a>
              </li>
              <li>설명란의 ‘더보기’ → ‘스크립트 표시’를 누릅니다.</li>
              <li>스크립트 창의 내용을 드래그로 모두 선택해 복사한 뒤 아래에 붙여넣습니다.</li>
            </ol>
            <PastePanel recordId={record.id} onDone={() => clearJob(record.id)} />
          </PathRow>
        )}
        {!isYouTube && (
          <PathRow
            icon={ClipboardPaste}
            title="텍스트 붙여넣기"
            desc="가지고 있는 원고나 텍스트를 붙여넣습니다."
            open={path === "paste"}
            onToggle={() => setPath(path === "paste" ? null : "paste")}
          >
            <PastePanel recordId={record.id} onDone={() => clearJob(record.id)} />
          </PathRow>
        )}
        <PathRow
          icon={Captions}
          title="자막 파일 가져오기"
          desc="SRT · VTT · TXT. 타임스탬프가 있으면 영상과 연결됩니다."
          open={path === "caption"}
          onToggle={() => setPath(path === "caption" ? null : "caption")}
        >
          <Dropzone
            accept=".srt,.vtt,.txt,text/plain,text/vtt"
            label="자막 파일 선택"
            onFile={async (file) => {
              setError(null);
              try {
                await importText({
                  content: await readTextFile(file),
                  fileName: file.name,
                  recordId: record.id,
                });
                clearJob(record.id);
              } catch (e) {
                setError(e instanceof Error ? e.message : "파일을 읽지 못했습니다.");
              }
            }}
          >
            <p className="text-[0.875rem] text-muted">파일을 끌어다 놓거나 선택하세요.</p>
          </Dropzone>
        </PathRow>
        <PathRow
          icon={FileAudio}
          title="음성 파일로 직접 전사"
          desc={
            prefs.asr.backend === "remote"
              ? "연결된 faster-whisper 서버로 전사합니다."
              : "이 기기에서 Whisper로 인식합니다. 파일은 외부로 전송되지 않습니다."
          }
          open={path === "media"}
          onToggle={() => setPath(path === "media" ? null : "media")}
        >
          <Dropzone
            accept="audio/*,video/*,.m4a,.mp3,.wav,.webm,.mp4"
            label="음성·영상 파일 선택"
            onFile={async (file) => {
              setError(null);
              try {
                await startMediaTranscription(file, { recordId: record.id });
              } catch (e) {
                setError(e instanceof Error ? e.message : "파일을 처리하지 못했습니다.");
              }
            }}
          >
            <p className="max-w-sm text-[0.8125rem] leading-relaxed text-muted">
              사용 권한이 있는 녹음 파일만 사용해 주세요. 처음 실행할 때 모델을 내려받습니다.
            </p>
          </Dropzone>
        </PathRow>
        {isYouTube && GOOGLE_CLIENT_ID && (
          <PathRow
            icon={KeyRound}
            title="내 채널 영상 자막 가져오기"
            desc="Google 계정으로 로그인해 YouTube Data API로 자막을 내려받습니다. 본인이 관리하는 채널의 영상만 가능합니다."
            action={
              <button
                type="button"
                className="btn btn-quiet btn-sm"
                onClick={() =>
                  void runJob(record.id, youtubeOAuthProvider, {
                    kind: "youtube",
                    videoId: record.source.videoId!,
                    url: record.source.url!,
                  })
                }
              >
                Google로 연결
              </button>
            }
          />
        )}
        {isYouTube && experimental && (
          <PathRow
            icon={RadioIcon}
            title="공개 자막 다시 시도"
            desc="실험 기능입니다. YouTube가 공개한 자막 트랙을 읽습니다. 예고 없이 동작하지 않을 수 있습니다."
            action={
              <button
                type="button"
                className="btn btn-quiet btn-sm"
                onClick={() =>
                  void runJob(record.id, youtubeUnofficialProvider, {
                    kind: "youtube",
                    videoId: record.source.videoId!,
                    url: record.source.url!,
                  })
                }
              >
                시도
              </button>
            }
          />
        )}
      </ol>
      {error && (
        <div className="mt-6">
          <Notice tone="danger">{error}</Notice>
        </div>
      )}
    </div>
  );
}

function PathRow({
  icon: Icon,
  title,
  desc,
  children,
  open,
  onToggle,
  action,
  recommended,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  desc: string;
  children?: React.ReactNode;
  open?: boolean;
  onToggle?: () => void;
  action?: React.ReactNode;
  recommended?: boolean;
}) {
  const head = (
    <>
      <Icon className="mt-0.5 size-[1.125rem] shrink-0 text-forest" strokeWidth={1.4} />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-baseline gap-x-2.5">
          <span className="text-[1rem] font-medium text-ink">{title}</span>
          {recommended && (
            <span className="text-[0.6875rem] font-medium tracking-[0.04em] text-gold-deep">권장</span>
          )}
        </span>
        <span className="mt-1 block text-[0.8125rem] leading-relaxed text-muted">{desc}</span>
      </span>
    </>
  );
  return (
    <li>
      {onToggle ? (
        <button
          type="button"
          aria-expanded={open}
          onClick={onToggle}
          className="group flex w-full items-start gap-4 py-5 text-left"
        >
          {head}
          <span
            aria-hidden
            className={cn(
              "mt-1 text-[0.8125rem] text-faint transition-transform duration-200",
              open && "rotate-45",
            )}
          >
            ＋
          </span>
        </button>
      ) : (
        <div className="flex items-start gap-4 py-5">
          {head}
          {action}
        </div>
      )}
      {open && <div className="fade-in pb-8 pl-[2.125rem]">{children}</div>}
    </li>
  );
}

const MEDIA_STAGES: TranscriptionStage[] = [
  "preparing_audio",
  "downloading_model",
  "recognizing",
  "finalizing",
];
const CAPTION_STAGES: TranscriptionStage[] = ["checking_captions", "loading_captions", "finalizing"];

export function JobProgress({ job, recordId }: { job: JobState; recordId: string }) {
  const stages = MEDIA_STAGES.includes(job.stage) ? MEDIA_STAGES : CAPTION_STAGES;
  const currentIdx = stages.indexOf(job.stage);
  const pct = job.detail?.progress != null ? Math.round(job.detail.progress * 100) : null;
  const tail = job.partial.slice(-6);
  return (
    <div className="pb-24 pt-10" aria-busy="true">
      <p className="eyebrow">{job.providerLabel}</p>
      <h2
        className="serif mt-3 flex items-center gap-3 text-[1.625rem] tracking-[-0.02em] text-ink"
        aria-live="polite"
      >
        <span className="breathe inline-block size-2 rounded-full bg-forest" aria-hidden />
        {STAGE_LABEL[job.stage]}
      </h2>

      <ol
        className="mt-8 grid max-w-[40rem] gap-0 border-t border-border sm:grid-cols-4"
        aria-label="진행 단계"
      >
        {stages.map((s, i) => (
          <li
            key={s}
            className={cn(
              "border-b border-border py-3 text-[0.8125rem] sm:border-b-0 sm:pr-3",
              i < currentIdx ? "text-ink-soft" : i === currentIdx ? "font-medium text-ink" : "text-faint",
            )}
          >
            <span className="numeral mr-2 text-[0.75rem] text-gold-deep">
              {String(i + 1).padStart(2, "0")}
            </span>
            {STAGE_LABEL[s]}
            {i === currentIdx && <span aria-hidden className="mt-3 hidden h-[2px] bg-forest sm:block" />}
          </li>
        ))}
      </ol>

      {pct != null && (
        <div className="mt-8 max-w-[40rem]">
          <div className="flex justify-between text-[0.75rem] text-muted">
            <span>
              {job.stage === "downloading_model" && job.detail?.totalBytes
                ? `${formatBytes(job.detail.loadedBytes ?? 0)} / ${formatBytes(job.detail.totalBytes)}`
                : "처리한 음성 구간"}
            </span>
            <span className="tabular">{pct}%</span>
          </div>
          <div
            className="mt-2 h-px bg-border"
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div className="h-px bg-forest transition-[width] duration-300" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      {tail.length > 0 && (
        <div className="reading mt-10 max-w-[44rem] text-[1.0625rem] leading-[1.85] text-ink-soft">
          <p className="label mb-4 font-sans">지금까지 인식한 문장</p>
          {tail.map((s) => (
            <p key={s.id} className="fade-in">
              <span className="tabular mr-3 font-sans text-[0.75rem] text-faint">
                {formatClock(s.startMs)}
              </span>
              {s.text}
            </p>
          ))}
        </div>
      )}

      <div className="mt-10 flex flex-wrap items-center gap-4">
        <button type="button" className="btn btn-quiet btn-sm" onClick={() => cancelJob(recordId)}>
          작업 취소
        </button>
        <p className="text-[0.75rem] text-muted">
          페이지를 새로고침하거나 탭을 닫으면 작업이 중단됩니다. 다른 메뉴로 이동하는 것은 괜찮습니다.
        </p>
      </div>
    </div>
  );
}

function JobOutcome({ job, recordId }: { job: JobState; recordId: string }) {
  const aborted = job.error?.code === "aborted";
  return (
    <div className="mb-12 space-y-3">
      <Notice
        tone={
          aborted || job.error?.code === "no_captions" || job.error?.code === "provider_disabled"
            ? "warn"
            : "danger"
        }
      >
        {job.error?.message}
        {job.error?.code === "no_captions" &&
          " YouTube에서 스크립트를 복사해 가져오거나, 사용 권한이 있는 음성 파일을 업로드해 전사를 계속할 수 있습니다."}
      </Notice>
      {aborted && job.partial.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-primary btn-sm" onClick={() => void keepPartial(recordId)}>
            지금까지 인식한 {job.partial.length}개 문장 저장
          </button>
          <button type="button" className="btn btn-text btn-sm" onClick={() => clearJob(recordId)}>
            버리기
          </button>
        </div>
      )}
    </div>
  );
}
