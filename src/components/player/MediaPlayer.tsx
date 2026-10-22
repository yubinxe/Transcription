"use client";
import { useEffect, useRef, useState } from "react";
import type { PlayerStore } from "./player-store";

/** Plays an uploaded file kept in IndexedDB, wired to the same controller as YouTube. */
export function MediaPlayer({ blob, type, store }: { blob: Blob; type: string; store: PlayerStore }) {
  const [url, setUrl] = useState<string | null>(null);
  const ref = useRef<HTMLMediaElement | null>(null);
  const isVideo = type.startsWith("video/");

  useEffect(() => {
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !url) return;
    store.attach({
      getTimeMs: () => el.currentTime * 1000,
      seekTo: (ms, play) => {
        el.currentTime = ms / 1000;
        if (play) void el.play();
      },
      play: () => void el.play(),
      pause: () => el.pause(),
      isPlaying: () => !el.paused && !el.ended,
    });
    return () => store.attach(null);
  }, [url, store]);

  if (!url) return null;
  return isVideo ? (
    <video ref={(n) => void (ref.current = n)} src={url} controls playsInline className="aspect-video w-full bg-[#1d201c]" />
  ) : (
    <div className="border hairline bg-surface p-4">
      <audio ref={(n) => void (ref.current = n)} src={url} controls className="w-full" />
    </div>
  );
}
