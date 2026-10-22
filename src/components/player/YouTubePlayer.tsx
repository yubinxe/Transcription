"use client";
import { useEffect, useRef, useState } from "react";
import type { PlayerStore } from "./player-store";

interface YTPlayer {
  getCurrentTime(): number;
  seekTo(s: number, allowSeekAhead: boolean): void;
  playVideo(): void;
  pauseVideo(): void;
  getPlayerState(): number;
  getDuration(): number;
  destroy(): void;
}
interface YTNamespace {
  Player: new (
    el: HTMLElement,
    opts: {
      videoId: string;
      host?: string;
      playerVars?: Record<string, string | number>;
      events?: {
        onReady?: (e: { target: YTPlayer }) => void;
        onError?: (e: { data: number }) => void;
      };
    },
  ) => YTPlayer;
}

let apiPromise: Promise<YTNamespace> | null = null;

function loadApi(): Promise<YTNamespace> {
  const w = window as unknown as { YT?: YTNamespace & { loaded?: number }; onYouTubeIframeAPIReady?: () => void };
  if (w.YT?.Player) return Promise.resolve(w.YT);
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve, reject) => {
    const prev = w.onYouTubeIframeAPIReady;
    w.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve(w.YT!);
    };
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    s.async = true;
    s.onerror = () => {
      apiPromise = null;
      reject(new Error("YouTube IFrame API failed to load"));
    };
    document.head.appendChild(s);
  });
  return apiPromise;
}

const ERRORS: Record<number, string> = {
  2: "영상 주소가 올바르지 않습니다.",
  5: "이 브라우저에서 재생할 수 없는 영상입니다.",
  100: "삭제되었거나 비공개로 전환된 영상입니다.",
  101: "영상 소유자가 외부 재생을 허용하지 않았습니다. YouTube에서 직접 재생해 주세요.",
  150: "영상 소유자가 외부 재생을 허용하지 않았습니다. YouTube에서 직접 재생해 주세요.",
  153: "재생 환경 정보를 확인하지 못해 영상을 불러오지 못했습니다.",
};

export function YouTubePlayer({ videoId, store, title }: { videoId: string; store: PlayerStore; title: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let player: YTPlayer | null = null;
    let cancelled = false;
    const mount = document.createElement("div");
    hostRef.current?.appendChild(mount);
    loadApi()
      .then((YT) => {
        if (cancelled) return;
        player = new YT.Player(mount, {
          videoId,
          host: "https://www.youtube-nocookie.com",
          playerVars: { rel: 0, modestbranding: 1, playsinline: 1, hl: "ko", cc_load_policy: 0, origin: window.location.origin },
          events: {
            onReady: (e) => {
              const p = e.target;
              store.attach({
                getTimeMs: () => (p.getCurrentTime?.() ?? 0) * 1000,
                seekTo: (ms, play) => {
                  p.seekTo(ms / 1000, true);
                  if (play) p.playVideo();
                },
                play: () => p.playVideo(),
                pause: () => p.pauseVideo(),
                isPlaying: () => p.getPlayerState?.() === 1,
              });
              const iframe = hostRef.current?.querySelector("iframe");
              iframe?.setAttribute("title", `YouTube 플레이어: ${title}`);
            },
            onError: (e) => setError(ERRORS[e.data] ?? "영상을 재생하지 못했습니다."),
          },
        });
      })
      .catch(() => setError("YouTube 플레이어를 불러오지 못했습니다. 네트워크를 확인해 주세요."));
    return () => {
      cancelled = true;
      store.attach(null);
      try {
        player?.destroy();
      } catch {
        /* already gone */
      }
      mount.remove();
    };
  }, [videoId, store, title]);

  return (
    <div className="relative aspect-video w-full overflow-hidden bg-[#1d201c]">
      <div ref={hostRef} className="absolute inset-0 [&_iframe]:size-full" />
      {error && (
        <div role="alert" className="absolute inset-0 flex items-center justify-center bg-[#1d201c] p-6 text-center text-[0.875rem] leading-relaxed text-[#e9e6de]">
          {error}
        </div>
      )}
    </div>
  );
}
