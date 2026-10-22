"use client";
import { useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export function Dropzone({
  accept,
  onFile,
  children,
  label,
  disabled,
}: {
  accept: string;
  onFile: (file: File) => void;
  children: ReactNode;
  label: string;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const f = e.dataTransfer.files?.[0];
        if (f && !disabled) onFile(f);
      }}
      className={cn(
        "relative flex flex-col items-center justify-center gap-3 border border-dashed px-6 py-10 text-center transition-colors duration-200",
        over ? "border-forest bg-sage-soft" : "border-rule bg-paper hover:border-faint",
        disabled && "opacity-60",
      )}
    >
      {children}
      <button type="button" className="btn btn-quiet btn-sm" onClick={() => inputRef.current?.click()} disabled={disabled}>
        {label}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}
