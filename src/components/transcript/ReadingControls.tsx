"use client";
import { setPreferences, usePreferences } from "@/lib/storage/preferences";
import { Minus, Plus } from "lucide-react";

export function ReadingControls({ hasTiming }: { hasTiming: boolean }) {
  const { reading } = usePreferences();
  const set = (patch: Partial<typeof reading>) =>
    setPreferences((p) => ({ ...p, reading: { ...p.reading, ...patch } }));
  return (
    <div className="w-[18rem] space-y-5 text-[0.8125rem]">
      <Row label="글자 크기">
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="btn btn-quiet btn-sm !px-2"
            aria-label="글자 작게"
            onClick={() => set({ fontSize: Math.max(15, reading.fontSize - 1) })}
          >
            <Minus className="size-3.5" aria-hidden />
          </button>
          <span className="tabular w-10 text-center">{reading.fontSize}px</span>
          <button
            type="button"
            className="btn btn-quiet btn-sm !px-2"
            aria-label="글자 크게"
            onClick={() => set({ fontSize: Math.min(24, reading.fontSize + 1) })}
          >
            <Plus className="size-3.5" aria-hidden />
          </button>
        </div>
      </Row>
      <Row label="줄 간격">
        <Seg
          value={String(reading.lineHeight)}
          options={[
            ["1.65", "좁게"],
            ["1.8", "보통"],
            ["2", "넓게"],
          ]}
          onChange={(v) => set({ lineHeight: Number(v) })}
        />
      </Row>
      <Row label="읽기 폭">
        <Seg
          value={reading.measure}
          options={[
            ["narrow", "좁게"],
            ["standard", "보통"],
            ["wide", "넓게"],
          ]}
          onChange={(v) => set({ measure: v as typeof reading.measure })}
        />
      </Row>
      <Row label="보기 방식">
        <Seg
          value={reading.mode}
          options={[
            ["paragraph", "문단"],
            ["segment", "문장"],
          ]}
          onChange={(v) => set({ mode: v as typeof reading.mode })}
        />
      </Row>
      <Toggle
        label="타임스탬프 표시"
        checked={reading.showTimestamps}
        disabled={!hasTiming}
        onChange={(v) => set({ showTimestamps: v })}
      />
      <Toggle
        label="재생 위치 따라가기"
        checked={reading.autoScroll}
        disabled={!hasTiming}
        onChange={(v) => set({ autoScroll: v })}
      />
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-ink-soft">{label}</span>
      {children}
    </div>
  );
}

function Seg({
  value,
  options,
  onChange,
}: {
  value: string;
  options: Array<[string, string]>;
  onChange: (v: string) => void;
}) {
  return (
    <div className="segmented">
      {options.map(([v, l]) => (
        <button key={v} type="button" aria-pressed={value === v} onClick={() => onChange(v)}>
          {l}
        </button>
      ))}
    </div>
  );
}

export function Toggle({
  label,
  checked,
  onChange,
  disabled,
  description,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  description?: string;
}) {
  return (
    <label className={`flex items-start justify-between gap-4 ${disabled ? "opacity-50" : "cursor-pointer"}`}>
      <span>
        <span className="block text-ink-soft">{label}</span>
        {description && (
          <span className="mt-1 block text-[0.75rem] leading-relaxed text-muted">{description}</span>
        )}
      </span>
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input
          type="checkbox"
          role="switch"
          className="peer sr-only"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="h-5 w-9 rounded-full border border-rule bg-canvas transition-colors duration-150 peer-checked:border-forest peer-checked:bg-forest peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-forest" />
        <span className="absolute left-[3px] top-[3px] size-3.5 rounded-full bg-faint transition-transform duration-150 peer-checked:translate-x-4 peer-checked:bg-white" />
      </span>
    </label>
  );
}
