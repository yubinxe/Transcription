"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileAudio, Captions, ClipboardPaste } from "lucide-react";
import { Dropzone } from "@/components/ui/Dropzone";
import { Notice } from "@/components/ui/Disclosure";
import { importText, readTextFile, startMediaTranscription } from "@/features/transcription/start";
import { cn } from "@/lib/utils/cn";

type Panel = "media" | "caption" | "paste" | null;

const ITEMS = [
  { key: "media" as const, icon: FileAudio, label: "음성·영상 파일 업로드" },
  { key: "caption" as const, icon: Captions, label: "자막 파일 가져오기" },
  { key: "paste" as const, icon: ClipboardPaste, label: "기존 텍스트 붙여넣기" },
];

export function AlternateInputs({ collectionId }: { collectionId?: string } = {}) {
  const [open, setOpen] = useState<Panel>(null);
  return (
    <div>
      <div className="flex flex-col items-start gap-y-0.5 text-[0.875rem] text-muted sm:flex-row sm:flex-wrap sm:items-center">
        <span className="mb-1 sm:mb-0 sm:mr-3">또는</span>
        {ITEMS.map((item, i) => (
          <span key={item.key} className="flex items-center">
            {i > 0 && (
              <span aria-hidden className="mx-2.5 hidden text-rule sm:inline">
                /
              </span>
            )}
            <button
              type="button"
              aria-expanded={open === item.key}
              aria-controls={`alt-${item.key}`}
              onClick={() => setOpen(open === item.key ? null : item.key)}
              className={cn(
                "inline-flex min-h-9 items-center gap-1.5 underline decoration-rule decoration-1 underline-offset-[0.35em] transition-colors duration-150 hover:text-forest hover:decoration-forest",
                open === item.key ? "text-ink decoration-ink" : "text-ink-soft",
              )}
            >
              <item.icon className="size-[0.95rem]" strokeWidth={1.5} aria-hidden />
              {item.label}
            </button>
          </span>
        ))}
      </div>
      {open && (
        <div id={`alt-${open}`} className="fade-in mt-6">
          {open === "media" && <MediaPanel collectionId={collectionId} />}
          {open === "caption" && <CaptionPanel collectionId={collectionId} />}
          {open === "paste" && <PastePanel collectionId={collectionId} />}
        </div>
      )}
    </div>
  );
}

function MediaPanel({ collectionId }: { collectionId?: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-4">
      <Dropzone
        accept="audio/*,video/*,.m4a,.mp3,.wav,.webm,.mp4,.ogg,.flac"
        label="파일 선택"
        disabled={busy}
        onFile={async (file) => {
          setError(null);
          setBusy(true);
          try {
            const id = await startMediaTranscription(file, { collectionId });
            router.push(`/record/${id}`);
          } catch (e) {
            setError(e instanceof Error ? e.message : "파일을 처리하지 못했습니다.");
            setBusy(false);
          }
        }}
      >
        <p className="serif text-[1.0625rem] text-ink">음성이나 영상 파일을 이곳에 놓아 주세요</p>
        <p className="max-w-md text-[0.8125rem] leading-relaxed text-muted">
          음성 인식은 이 기기 안에서 실행되며 파일은 외부로 전송되지 않습니다. 처음 한 번 음성 인식 모델을
          내려받습니다.
        </p>
      </Dropzone>
      {error && <Notice tone="danger">{error}</Notice>}
      <p className="text-[0.8125rem] text-muted">사용 권한이 있는 파일만 업로드해 주세요.</p>
    </div>
  );
}

function CaptionPanel({ collectionId }: { collectionId?: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-4">
      <Dropzone
        accept=".srt,.vtt,.txt,text/plain,text/vtt"
        label="자막 파일 선택"
        onFile={async (file) => {
          setError(null);
          try {
            const content = await readTextFile(file);
            const { recordId } = await importText({ content, fileName: file.name, collectionId });
            router.push(`/record/${recordId}`);
          } catch (e) {
            setError(e instanceof Error ? e.message : "파일을 읽지 못했습니다.");
          }
        }}
      >
        <p className="serif text-[1.0625rem] text-ink">SRT · VTT · TXT</p>
        <p className="max-w-md text-[0.8125rem] leading-relaxed text-muted">
          타임스탬프가 있는 자막은 영상과 문장 단위로 연결됩니다. 원본 파일은 그대로 보관됩니다.
        </p>
      </Dropzone>
      {error && <Notice tone="danger">{error}</Notice>}
    </div>
  );
}

export function PastePanel({
  collectionId,
  recordId,
  onDone,
}: {
  collectionId?: string;
  recordId?: string;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        try {
          const res = await importText({
            content: text,
            title: title.trim() || undefined,
            recordId,
            collectionId,
          });
          if (onDone) onDone();
          else router.push(`/record/${res.recordId}`);
        } catch (err) {
          setError(err instanceof Error ? err.message : "가져오지 못했습니다.");
        }
      }}
    >
      {!recordId && (
        <div className="max-w-md">
          <label className="field-label" htmlFor="paste-title">
            제목 <span className="font-normal text-faint">(선택)</span>
          </label>
          <input
            id="paste-title"
            className="field"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
      )}
      <div>
        <label className="field-label" htmlFor="paste-body">
          텍스트
        </label>
        <textarea
          id="paste-body"
          className="field min-h-56 resize-y leading-relaxed"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={
            "YouTube의 ‘스크립트 표시’에서 복사한 내용을 그대로 붙여넣으면\n시간 정보까지 함께 인식합니다.\n\n0:00\n오늘 함께 나눌 말씀은…"
          }
        />
      </div>
      {error && <Notice tone="danger">{error}</Notice>}
      <button type="submit" className="btn btn-primary" disabled={!text.trim()}>
        가져오기
      </button>
    </form>
  );
}
