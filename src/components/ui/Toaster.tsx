"use client";
import { useEffect, useState } from "react";

type Toast = { id: number; message: string };
let push: ((m: string) => void) | null = null;

/** Small, quiet confirmations ("복사했습니다"). Announced to screen readers. */
export function toast(message: string) {
  push?.(message);
}

export function Toaster() {
  const [items, setItems] = useState<Toast[]>([]);
  useEffect(() => {
    push = (message) => {
      const id = Date.now() + Math.random();
      setItems((xs) => [...xs.slice(-2), { id, message }]);
      setTimeout(() => setItems((xs) => xs.filter((t) => t.id !== id)), 2400);
    };
    return () => {
      push = null;
    };
  }, []);
  return (
    <div aria-live="polite" role="status" className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex flex-col items-center gap-2 px-4">
      {items.map((t) => (
        <div key={t.id} className="fade-in rounded-[2px] bg-ink px-4 py-2.5 text-[0.8125rem] text-canvas shadow-[0_8px_24px_-12px_rgba(0,0,0,0.4)]">
          {t.message}
        </div>
      ))}
    </div>
  );
}
