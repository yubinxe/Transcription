"use client";
import type { ReactNode } from "react";

export function Notice({ tone = "neutral", children }: { tone?: "neutral" | "warn" | "danger"; children: ReactNode }) {
  const bar = tone === "danger" ? "bg-danger" : tone === "warn" ? "bg-gold" : "bg-forest";
  return (
    <div role={tone === "danger" ? "alert" : undefined} className="relative bg-paper py-3 pl-5 pr-4 text-[0.875rem] leading-relaxed text-ink-soft">
      <span aria-hidden className={`absolute inset-y-0 left-0 w-[2px] ${bar}`} />
      {children}
    </div>
  );
}
