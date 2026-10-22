"use client";
import { useSyncExternalStore } from "react";

/** A transport-agnostic playback controller shared by the YouTube and local media players. */
export interface PlayerAdapter {
  getTimeMs(): number;
  seekTo(ms: number, play?: boolean): void;
  play(): void;
  pause(): void;
  isPlaying(): boolean;
}

export interface PlayerSnapshot {
  ready: boolean;
  playing: boolean;
  timeMs: number;
  loop: { startMs: number; endMs: number } | null;
}

export class PlayerStore {
  private adapter: PlayerAdapter | null = null;
  private listeners = new Set<() => void>();
  private snap: PlayerSnapshot = { ready: false, playing: false, timeMs: 0, loop: null };
  private raf = 0;
  private lastEmit = 0;

  attach(adapter: PlayerAdapter | null) {
    this.adapter = adapter;
    this.set({ ready: !!adapter });
    if (adapter) this.loop();
    else cancelAnimationFrame(this.raf);
  }

  private loop = () => {
    cancelAnimationFrame(this.raf);
    const tick = (now: number) => {
      const a = this.adapter;
      if (!a) return;
      if (now - this.lastEmit > 200) {
        this.lastEmit = now;
        const timeMs = a.getTimeMs();
        const playing = a.isPlaying();
        const lp = this.snap.loop;
        if (lp && playing && timeMs >= lp.endMs) a.seekTo(lp.startMs, true);
        if (Math.abs(timeMs - this.snap.timeMs) > 120 || playing !== this.snap.playing) this.set({ timeMs, playing });
      }
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  };

  private set(patch: Partial<PlayerSnapshot>) {
    this.snap = { ...this.snap, ...patch };
    this.listeners.forEach((l) => l());
  }

  seek(ms: number, play = true) {
    this.adapter?.seekTo(ms, play);
    this.set({ timeMs: ms });
  }
  toggle() {
    const a = this.adapter;
    if (!a) return;
    if (a.isPlaying()) a.pause();
    else a.play();
  }
  setLoop(loop: PlayerSnapshot["loop"]) {
    this.set({ loop });
    if (loop) this.seek(loop.startMs, true);
  }

  subscribe = (l: () => void) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };
  getSnapshot = () => this.snap;
  dispose() {
    cancelAnimationFrame(this.raf);
    this.adapter = null;
  }
}

const SERVER_SNAP: PlayerSnapshot = { ready: false, playing: false, timeMs: 0, loop: null };

export function usePlayerSnapshot(store: PlayerStore): PlayerSnapshot {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, () => SERVER_SNAP);
}
