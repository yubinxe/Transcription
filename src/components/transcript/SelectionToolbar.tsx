"use client";
import { useEffect, useRef, useState, type RefObject } from "react";
import { BookmarkPlus, Copy, Play } from "lucide-react";
import type { TranscriptSegment } from "@/types/transcript";
import type { ReflectionKey, StudyKey } from "@/types/record";
import { addHighlight } from "@/lib/storage/repository";
import { REFLECTION_SECTIONS } from "@/features/scripture-study/sections";
import { toast } from "@/components/ui/Toaster";

interface Sel {
  quote: string;
  segmentIds: string[];
  startMs: number | null;
  top: number;
  left: number;
}

/** Floating actions for a text selection inside the reader. Docked at the bottom on touch screens. */
export function SelectionToolbar({
  containerRef,
  segments,
  recordId,
  canSeek,
  onSeek,
}: {
  containerRef: RefObject<HTMLDivElement | null>;
  segments: TranscriptSegment[];
  recordId: string;
  canSeek: boolean;
  onSeek: (ms: number | null) => void;
}) {
  const [sel, setSel] = useState<Sel | null>(null);
  const [menu, setMenu] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const read = () => {
      const s = window.getSelection();
      const root = containerRef.current;
      if (!s || s.isCollapsed || !root || s.rangeCount === 0) {
        if (!barRef.current?.contains(document.activeElement)) setSel(null);
        return;
      }
      const range = s.getRangeAt(0);
      if (!root.contains(range.commonAncestorContainer)) return;
      const quote = s.toString().replace(/\s+/g, " ").trim();
      if (quote.length < 2) return setSel(null);
      const startEl = (
        range.startContainer.nodeType === 1
          ? (range.startContainer as Element)
          : range.startContainer.parentElement
      )?.closest<HTMLElement>("[data-seg]");
      const endEl = (
        range.endContainer.nodeType === 1 ? (range.endContainer as Element) : range.endContainer.parentElement
      )?.closest<HTMLElement>("[data-seg]");
      const a = segments.findIndex((x) => x.id === startEl?.dataset.seg);
      const b = segments.findIndex((x) => x.id === endEl?.dataset.seg);
      const from = a === -1 ? b : a;
      const to = b === -1 ? a : b;
      const ids =
        from === -1 ? [] : segments.slice(Math.min(from, to), Math.max(from, to) + 1).map((x) => x.id);
      const rect = range.getBoundingClientRect();
      setMenu(false);
      setSel({
        quote,
        segmentIds: ids,
        startMs: from === -1 ? null : segments[Math.min(from, to)]!.startMs,
        top: rect.top,
        left: rect.left + rect.width / 2,
      });
    };
    const onChange = () => {
      clearTimeout(t);
      t = setTimeout(read, 160);
    };
    const onScroll = () => setSel((s) => (s ? { ...s, top: -9999 } : s));
    document.addEventListener("selectionchange", onChange);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      clearTimeout(t);
      document.removeEventListener("selectionchange", onChange);
      window.removeEventListener("scroll", onScroll);
    };
  }, [containerRef, segments]);

  if (!sel) return null;

  const save = async (attachedTo: ReflectionKey | StudyKey | null) => {
    await addHighlight({
      recordId,
      segmentIds: sel.segmentIds,
      quote: sel.quote,
      startMs: sel.startMs,
      attachedTo,
    });
    toast(attachedTo ? "묵상 노트에 인용했습니다" : "기억할 문장에 담았습니다");
    window.getSelection()?.removeAllRanges();
    setSel(null);
  };

  const floating =
    sel.top > 0 && typeof window !== "undefined" && window.matchMedia("(pointer: fine)").matches;
  const style = floating
    ? {
        top: Math.max(72, sel.top - 52),
        left: Math.min(Math.max(170, sel.left), window.innerWidth - 170),
        transform: "translateX(-50%)",
      }
    : undefined;

  return (
    <div
      ref={barRef}
      role="toolbar"
      aria-label="선택한 문장"
      style={style}
      onMouseDown={(e) => e.preventDefault()}
      className={
        floating
          ? "fade-in fixed z-40 flex items-center bg-ink text-[0.8125rem] text-canvas shadow-[0_16px_32px_-16px_rgba(0,0,0,0.5)]"
          : "fade-in fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 flex items-center justify-between bg-ink text-[0.8125rem] text-canvas shadow-[0_16px_32px_-16px_rgba(0,0,0,0.5)]"
      }
    >
      <ToolButton onClick={() => save(null)}>
        <BookmarkPlus className="size-4" strokeWidth={1.5} aria-hidden />
        문장 저장
      </ToolButton>
      <div className="relative">
        <ToolButton onClick={() => setMenu((m) => !m)} aria-expanded={menu}>
          묵상에 인용
        </ToolButton>
        {menu && (
          <ul className="absolute bottom-full left-0 mb-1 w-60 bg-ink py-1 shadow-[0_16px_32px_-16px_rgba(0,0,0,0.5)]">
            {REFLECTION_SECTIONS.map((s) => (
              <li key={s.key}>
                <button
                  type="button"
                  className="w-full px-4 py-2.5 text-left hover:bg-white/10"
                  onClick={() => save(s.key)}
                >
                  <span className="numeral mr-2 text-gold">{s.no}</span>
                  {s.title}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <ToolButton
        onClick={async () => {
          await navigator.clipboard.writeText(sel.quote);
          toast("복사했습니다");
        }}
      >
        <Copy className="size-4" strokeWidth={1.5} aria-hidden />
        복사
      </ToolButton>
      {canSeek && sel.startMs != null && (
        <ToolButton onClick={() => onSeek(sel.startMs)}>
          <Play className="size-3.5" strokeWidth={1.5} aria-hidden />
          듣기
        </ToolButton>
      )}
    </div>
  );
}

function ToolButton({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className="flex min-h-11 items-center gap-1.5 whitespace-nowrap px-3.5 transition-colors duration-150 hover:bg-white/10 [&+&]:border-l [&+&]:border-white/10"
    >
      {children}
    </button>
  );
}
