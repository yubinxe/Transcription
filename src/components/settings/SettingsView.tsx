"use client";
import { useEffect, useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
import { setPreferences, usePreferences } from "@/lib/storage/preferences";
import { detectCapabilities, type DeviceCapabilities } from "@/features/transcription/capabilities";
import { WHISPER_MODELS } from "@/features/transcription/models";
import { resolveAsrConfig } from "@/features/transcription/provider-factory";
import { validateEndpoint } from "@/features/transcription/providers/remote-whisper";
import {
  createBackup,
  estimateStorage,
  formatBytes,
  requestPersistence,
  restoreBackup,
  type StorageEstimate,
} from "@/lib/storage/backup";
import { downloadText } from "@/features/export/exporters";
import { Toggle } from "@/components/transcript/ReadingControls";
import { Notice } from "@/components/ui/Disclosure";
import { toast } from "@/components/ui/Toaster";
import { cn } from "@/lib/utils/cn";

export function SettingsView() {
  const prefs = usePreferences();
  const [caps, setCaps] = useState<DeviceCapabilities | null>(null);
  const [storage, setStorage] = useState<StorageEstimate | null>(null);
  const [serverCaptions, setServerCaptions] = useState<boolean | null>(null);
  const [msg, setMsg] = useState<{ tone: "neutral" | "danger"; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [restoreMode, setRestoreMode] = useState<"merge" | "replace">("merge");

  useEffect(() => {
    void detectCapabilities().then(setCaps);
    void estimateStorage().then(setStorage);
    fetch("/api/health")
      .then((r) => r.json())
      .then((d: { unofficialCaptions?: boolean }) => setServerCaptions(!!d.unofficialCaptions))
      .catch(() => setServerCaptions(false));
  }, []);

  const resolved = resolveAsrConfig(prefs, caps);
  const setAsr = (patch: Partial<typeof prefs.asr>) =>
    setPreferences((p) => ({ ...p, asr: { ...p.asr, ...patch } }));
  const endpointValid = !!validateEndpoint(prefs.asr.remoteEndpoint);

  return (
    <div className="mx-auto max-w-[1320px] px-5 pt-14 md:px-10 md:pt-20">
      <p className="eyebrow">Settings</p>
      <h1 className="serif mt-4 text-[2.25rem] font-semibold tracking-[-0.03em] md:text-[2.5rem]">설정</h1>

      <Section
        id="asr"
        no="01"
        title="음성 인식"
        desc="음성·영상 파일을 텍스트로 옮기는 방식을 정합니다. 유료 API는 사용하지 않습니다."
      >
        <div className="segmented">
          <button
            type="button"
            aria-pressed={prefs.asr.backend === "browser"}
            onClick={() => setAsr({ backend: "browser" })}
          >
            이 기기에서 (Whisper Web)
          </button>
          <button
            type="button"
            aria-pressed={prefs.asr.backend === "remote"}
            onClick={() => setAsr({ backend: "remote" })}
          >
            faster-whisper 서버
          </button>
        </div>

        {prefs.asr.backend === "browser" ? (
          <div className="mt-8 space-y-8">
            <dl className="grid max-w-xl grid-cols-[8rem_1fr] gap-y-2 text-[0.8125rem]">
              <dt className="text-muted">WebGPU</dt>
              <dd>
                {caps
                  ? caps.webgpu
                    ? "사용 가능 — GPU 가속"
                    : "사용 불가 — WASM(CPU)으로 실행, 느릴 수 있음"
                  : "확인 중…"}
              </dd>
              <dt className="text-muted">기기 메모리</dt>
              <dd>
                {caps ? (caps.memoryGb ? `약 ${caps.memoryGb}GB 이상` : "브라우저가 알려주지 않음") : "—"}
              </dd>
              <dt className="text-muted">현재 적용</dt>
              <dd>
                {WHISPER_MODELS.find((m) => m.id === resolved.modelId)?.label} 모델 ·{" "}
                {resolved.device === "webgpu" ? "WebGPU" : "WASM"}
              </dd>
            </dl>
            {caps?.isIOS && (
              <Notice tone="warn">
                iPhone·iPad Safari는 메모리 제한이 엄격해 긴 파일 전사가 중단될 수 있습니다. 가능하면 데스크톱
                Chrome·Edge를 사용하거나 faster-whisper 서버를 연결하세요.
              </Notice>
            )}
            <fieldset>
              <legend className="field-label">모델</legend>
              <div className="mt-2 divide-y divide-border border-y border-border">
                <ModelOption
                  checked={prefs.asr.modelId === "auto"}
                  onChange={() => setAsr({ modelId: "auto" })}
                  title="자동"
                  meta="기기에 맞춰 선택"
                  note="WebGPU가 있으면 ‘균형’, 없거나 모바일이면 ‘기본’을 사용합니다."
                />
                {WHISPER_MODELS.map((m) => (
                  <ModelOption
                    key={m.id}
                    checked={prefs.asr.modelId === m.id}
                    onChange={() => setAsr({ modelId: m.id })}
                    title={m.label}
                    meta={`whisper-${m.id} · ${m.params}`}
                    note={m.note}
                    disabled={!!m.webgpuOnly && caps !== null && !caps.webgpu}
                  />
                ))}
              </div>
              <p className="mt-3 text-[0.75rem] leading-relaxed text-muted">
                모델은 처음 사용할 때 Hugging Face에서 한 번 내려받아 브라우저 캐시에 저장됩니다. 실제
                다운로드 크기는 전사 화면에 바이트 단위로 표시됩니다. 수십~수백 MB가 될 수 있으니 Wi-Fi 환경을
                권장합니다.
              </p>
            </fieldset>
          </div>
        ) : (
          <div className="mt-8 max-w-xl space-y-3">
            <label className="field-label" htmlFor="endpoint">
              서버 주소
            </label>
            <input
              id="endpoint"
              className="field font-mono text-[0.875rem]"
              value={prefs.asr.remoteEndpoint}
              onChange={(e) => setAsr({ remoteEndpoint: e.target.value })}
            />
            {!endpointValid && <p className="text-[0.8125rem] text-danger">http(s) 주소를 입력해 주세요.</p>}
            <p className="text-[0.8125rem] leading-relaxed text-muted">
              저장소의 <code className="font-mono text-[0.75rem]">worker/</code> 폴더에 있는 faster-whisper
              서버를 내 컴퓨터에서 실행한 뒤 주소를 입력하세요. 파일은 브라우저에서 이 주소로 직접 전송됩니다.
            </p>
          </div>
        )}
      </Section>

      <Section
        id="captions"
        no="02"
        title="YouTube 자막"
        desc="공개 영상의 자막은 공식 API만으로 항상 가져올 수 있는 것이 아닙니다."
      >
        <div className="max-w-xl space-y-6 text-[0.875rem]">
          <Toggle
            label="공개 자막 자동 가져오기 (실험적)"
            description="YouTube가 플레이어에 제공하는 자막 트랙을 읽습니다. 공식 API가 아니므로 예고 없이 중단될 수 있으며, 이용 전 YouTube 약관을 확인해 주세요. 서버 관리자가 DAWN_UNOFFICIAL_CAPTIONS=enabled를 설정한 경우에만 동작합니다."
            checked={prefs.experimentalCaptions}
            onChange={(v) => setPreferences((p) => ({ ...p, experimentalCaptions: v }))}
          />
          <p className="text-[0.8125rem] text-muted">
            서버 상태:{" "}
            {serverCaptions === null
              ? "확인 중…"
              : serverCaptions
                ? "허용됨"
                : "비활성화됨 — 스크립트 붙여넣기·자막 파일·음성 전사를 사용하세요."}
          </p>
        </div>
      </Section>

      <Section
        id="storage"
        no="03"
        title="저장 공간"
        desc="모든 기록은 이 브라우저의 IndexedDB에만 저장됩니다. 브라우저 데이터를 지우면 함께 삭제됩니다."
      >
        <div className="max-w-xl space-y-6 text-[0.875rem]">
          <dl className="grid grid-cols-[8rem_1fr] gap-y-2 text-[0.8125rem]">
            <dt className="text-muted">사용량</dt>
            <dd className="tabular">
              {formatBytes(storage?.usage)} / {formatBytes(storage?.quota)}
            </dd>
            <dt className="text-muted">영구 보관</dt>
            <dd>
              {storage?.persisted == null
                ? "—"
                : storage.persisted
                  ? "허용됨"
                  : "허용되지 않음 (공간이 부족하면 브라우저가 지울 수 있음)"}
            </dd>
          </dl>
          {storage?.persisted === false && (
            <button
              type="button"
              className="btn btn-quiet btn-sm"
              onClick={async () => {
                const ok = await requestPersistence();
                setStorage(await estimateStorage());
                toast(ok ? "영구 보관이 허용되었습니다" : "브라우저가 요청을 거절했습니다");
              }}
            >
              영구 보관 요청
            </button>
          )}
          <Toggle
            label="업로드한 음성 파일 보관"
            description="켜 두면 다시 열었을 때 원본 음성과 문장이 연결됩니다. 저장 공간을 많이 차지할 수 있습니다."
            checked={prefs.keepMedia}
            onChange={(v) => setPreferences((p) => ({ ...p, keepMedia: v }))}
          />
        </div>
      </Section>

      <Section
        id="backup"
        no="04"
        title="백업과 복원"
        desc="전체 기록·메모·하이라이트·컬렉션을 하나의 JSON 파일로 저장합니다. 음성 파일은 포함되지 않습니다."
      >
        <div className="max-w-xl space-y-6">
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={async () => {
              const json = await createBackup();
              const d = new Date();
              const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
              downloadText(json, `새벽기록 백업 ${stamp}.json`, "application/json;charset=utf-8");
            }}
          >
            <Download className="size-4" strokeWidth={1.5} aria-hidden />
            백업 파일 내려받기
          </button>
          <div className="space-y-3 border-t hairline pt-6">
            <div className="segmented">
              <button
                type="button"
                aria-pressed={restoreMode === "merge"}
                onClick={() => setRestoreMode("merge")}
              >
                기존 기록과 합치기
              </button>
              <button
                type="button"
                aria-pressed={restoreMode === "replace"}
                onClick={() => setRestoreMode("replace")}
              >
                모두 바꾸기
              </button>
            </div>
            <div>
              <button type="button" className="btn btn-quiet btn-sm" onClick={() => fileRef.current?.click()}>
                <Upload className="size-4" strokeWidth={1.5} aria-hidden />
                백업 파일로 복원
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                className="sr-only"
                aria-label="백업 파일 선택"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (!f) return;
                  if (
                    restoreMode === "replace" &&
                    !window.confirm("현재 브라우저의 모든 기록을 지우고 백업으로 바꿉니다. 계속할까요?")
                  )
                    return;
                  try {
                    const r = await restoreBackup(await f.text(), restoreMode);
                    setMsg({
                      tone: "neutral",
                      text: `기록 ${r.records}개, 문장 ${r.highlights}개, 컬렉션 ${r.collections}개를 복원했습니다.`,
                    });
                  } catch (err) {
                    setMsg({
                      tone: "danger",
                      text: err instanceof Error ? err.message : "복원하지 못했습니다.",
                    });
                  }
                }}
              />
            </div>
            {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
          </div>
        </div>
      </Section>
    </div>
  );
}

function Section({
  id,
  no,
  title,
  desc,
  children,
}: {
  id: string;
  no: string;
  title: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="mt-16 grid scroll-mt-24 gap-8 border-t border-ink pt-10 md:grid-cols-12 md:gap-10"
    >
      <div className="md:col-span-4">
        <p className="numeral text-[0.8125rem] text-gold-deep">{no}</p>
        <h2 id={`${id}-title`} className="serif mt-2 text-[1.5rem] tracking-[-0.02em]">
          {title}
        </h2>
        <p className="mt-3 max-w-xs text-[0.875rem] leading-relaxed text-muted">{desc}</p>
      </div>
      <div className="md:col-span-8">{children}</div>
    </section>
  );
}

function ModelOption({
  checked,
  onChange,
  title,
  meta,
  note,
  disabled,
}: {
  checked: boolean;
  onChange: () => void;
  title: string;
  meta: string;
  note: string;
  disabled?: boolean;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-4 py-4",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      <input
        type="radio"
        name="model"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className="mt-1 size-3.5 accent-[var(--color-forest)]"
      />
      <span>
        <span className="flex flex-wrap items-baseline gap-x-3">
          <span className="text-[0.9375rem] font-medium">{title}</span>
          <span className="tabular text-[0.75rem] text-muted">{meta}</span>
        </span>
        <span className="mt-1 block text-[0.8125rem] leading-relaxed text-muted">
          {note}
          {disabled && " (이 기기에서는 WebGPU가 없어 사용할 수 없습니다)"}
        </span>
      </span>
    </label>
  );
}
