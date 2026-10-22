"use client";
import { useSyncExternalStore } from "react";
import { z } from "zod";

/** Small user preferences only. Transcripts live in IndexedDB. */
const PrefsSchema = z.object({
  reading: z
    .object({
      fontSize: z.number().min(15).max(24).default(18),
      lineHeight: z.number().min(1.5).max(2.1).default(1.8),
      measure: z.enum(["narrow", "standard", "wide"]).default("standard"),
      showTimestamps: z.boolean().default(true),
      mode: z.enum(["paragraph", "segment"]).default("paragraph"),
      autoScroll: z.boolean().default(true),
    })
    .default({
      fontSize: 18,
      lineHeight: 1.8,
      measure: "standard",
      showTimestamps: true,
      mode: "paragraph",
      autoScroll: true,
    }),
  asr: z
    .object({
      backend: z.enum(["browser", "remote"]).default("browser"),
      modelId: z.string().default("auto"),
      device: z.enum(["auto", "webgpu", "wasm"]).default("auto"),
      remoteEndpoint: z.string().default("http://127.0.0.1:8765"),
      language: z.string().default("korean"),
    })
    .default({
      backend: "browser",
      modelId: "auto",
      device: "auto",
      remoteEndpoint: "http://127.0.0.1:8765",
      language: "korean",
    }),
  experimentalCaptions: z.boolean().default(false),
  keepMedia: z.boolean().default(true),
});

export type Preferences = z.infer<typeof PrefsSchema>;
const KEY = "dawn-archive:prefs:v1";
export const DEFAULT_PREFS: Preferences = PrefsSchema.parse({});

let cache: Preferences | null = null;
const listeners = new Set<() => void>();

function read(): Preferences {
  if (cache) return cache;
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = PrefsSchema.safeParse(raw ? JSON.parse(raw) : {});
    cache = parsed.success ? parsed.data : DEFAULT_PREFS;
  } catch {
    cache = DEFAULT_PREFS;
  }
  return cache;
}

export function getPreferences(): Preferences {
  return read();
}

export function setPreferences(update: (p: Preferences) => Preferences) {
  cache = PrefsSchema.parse(update(read()));
  try {
    window.localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    /* storage full / private mode: keep in memory */
  }
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = null;
      l();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(l);
    window.removeEventListener("storage", onStorage);
  };
}

export function usePreferences(): Preferences {
  return useSyncExternalStore(subscribe, read, () => DEFAULT_PREFS);
}
