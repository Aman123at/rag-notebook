"use client";

import * as React from "react";

/**
 * Per-artifact "which modules did I finish" state, kept in localStorage.
 * There is no server endpoint for this by design (see C6 brief §3) — every
 * write must go to storage only.
 *
 * Read through `useSyncExternalStore` so:
 *   - the server render (getServerSnapshot) is always an empty set,
 *     avoiding hydration mismatches, and
 *   - changes made in another tab arrive here via the `storage` event.
 *
 * localStorage access is wrapped in try/catch because Safari private windows
 * throw on `getItem`/`setItem`.
 */

const STORAGE_PREFIX = "roadmap-progress:v1:";
const EMPTY: ReadonlySet<string> = new Set();

function storageKey(artifactId: string): string {
  return `${STORAGE_PREFIX}${artifactId}`;
}

function readCompleted(artifactId: string): ReadonlySet<string> {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(storageKey(artifactId));
    if (!raw) return EMPTY;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return EMPTY;
    return new Set(parsed.filter((v): v is string => typeof v === "string"));
  } catch {
    return EMPTY;
  }
}

function writeCompleted(artifactId: string, ids: readonly string[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(artifactId), JSON.stringify(ids));
    // useSyncExternalStore doesn't re-fire subscribers for our own writes
    // (the `storage` event fires only on OTHER tabs). Dispatch a synthetic
    // event so listeners in this tab pick up the change.
    window.dispatchEvent(
      new StorageEvent("storage", { key: storageKey(artifactId) }),
    );
  } catch {
    // Storage full or unavailable — a lost write here is a UX degradation
    // but not a correctness bug.
  }
}

import type { ModuleProgress } from "@/interfaces/artifacts.interface";

export type { ModuleProgress } from "@/interfaces/artifacts.interface";

export function useModuleProgress(artifactId: string | null): ModuleProgress {
  const key = artifactId ? storageKey(artifactId) : null;

  const subscribe = React.useCallback(
    (onChange: () => void) => {
      if (!key || typeof window === "undefined") return () => {};
      const handler = (event: StorageEvent) => {
        if (event.key === null || event.key === key) onChange();
      };
      window.addEventListener("storage", handler);
      return () => window.removeEventListener("storage", handler);
    },
    [key],
  );

  // Cache the Set per (artifactId, raw JSON) so React sees a stable
  // reference between reads when nothing changed — required by
  // useSyncExternalStore's snapshot contract.
  const snapshotRef = React.useRef<{ key: string | null; raw: string | null; value: ReadonlySet<string> }>({
    key: null,
    raw: null,
    value: EMPTY,
  });

  const getSnapshot = React.useCallback((): ReadonlySet<string> => {
    if (!artifactId || typeof window === "undefined") return EMPTY;
    let raw: string | null = null;
    try {
      raw = window.localStorage.getItem(storageKey(artifactId));
    } catch {
      raw = null;
    }
    const cache = snapshotRef.current;
    if (cache.key === artifactId && cache.raw === raw) return cache.value;
    const value = readCompleted(artifactId);
    snapshotRef.current = { key: artifactId, raw, value };
    return value;
  }, [artifactId]);

  const getServerSnapshot = React.useCallback(() => EMPTY, []);

  const completed = React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setComplete = React.useCallback(
    (moduleId: string, done: boolean) => {
      if (!artifactId) return;
      const base = new Set(completed);
      if (done) base.add(moduleId);
      else base.delete(moduleId);
      writeCompleted(artifactId, [...base].sort());
    },
    [artifactId, completed],
  );

  const toggle = React.useCallback(
    (moduleId: string) => {
      if (!artifactId) return;
      const base = new Set(completed);
      if (base.has(moduleId)) base.delete(moduleId);
      else base.add(moduleId);
      writeCompleted(artifactId, [...base].sort());
    },
    [artifactId, completed],
  );

  const reset = React.useCallback(() => {
    if (!artifactId) return;
    writeCompleted(artifactId, []);
  }, [artifactId]);

  const isComplete = React.useCallback(
    (moduleId: string) => completed.has(moduleId),
    [completed],
  );

  const progressRatio = React.useCallback(
    (total: number) => {
      if (total <= 0) return 0;
      return Math.min(1, completed.size / total);
    },
    [completed],
  );

  return { completed, isComplete, toggle, setComplete, reset, progressRatio };
}
