"use client";
import { useEffect, useRef, useState } from "react";

export function useDebouncedValue<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** Calls fn after the value has been stable for `ms`; flushes on unmount so nothing is lost. */
export function useAutosave<T>(value: T, ms: number, save: (v: T) => void | Promise<void>, enabled = true) {
  const latest = useRef(value);
  const saved = useRef(value);
  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
    latest.current = value;
  });
  useEffect(() => {
    if (!enabled || Object.is(value, saved.current)) return;
    const t = setTimeout(() => {
      saved.current = value;
      void saveRef.current(value);
    }, ms);
    return () => clearTimeout(t);
  }, [value, ms, enabled]);
  useEffect(
    () => () => {
      if (enabled && !Object.is(latest.current, saved.current)) void saveRef.current(latest.current);
    },
    [enabled],
  );
}
