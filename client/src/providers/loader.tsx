"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/**
 * Counter-based global loading state. Any async caller can `start()`/`stop()`
 * a slot; the top progress bar shows as long as at least one is active.
 * Never a blocking overlay — the app remains interactive during any load.
 */
interface LoaderContextValue {
  count: number;
  start: () => () => void;
}

const LoaderContext = createContext<LoaderContextValue | null>(null);

export function LoaderProvider({ children }: { children: ReactNode }) {
  const [count, setCount] = useState(0);

  const start = useCallback(() => {
    setCount((n) => n + 1);
    let stopped = false;
    return () => {
      if (stopped) return;
      stopped = true;
      setCount((n) => Math.max(0, n - 1));
    };
  }, []);

  const value = useMemo<LoaderContextValue>(() => ({ count, start }), [count, start]);

  return (
    <LoaderContext.Provider value={value}>
      <TopProgress active={count > 0} />
      {children}
    </LoaderContext.Provider>
  );
}

export function useLoader(): LoaderContextValue {
  const ctx = useContext(LoaderContext);
  if (!ctx) throw new Error("useLoader must be used inside <LoaderProvider>");
  return ctx;
}

function TopProgress({ active }: { active: boolean }) {
  return (
    <div
      aria-hidden={!active}
      role="progressbar"
      aria-label="Loading"
      aria-busy={active}
      data-active={active}
      className="pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden"
    >
      <div
        className="h-full w-full origin-left bg-[var(--color-accent)] transition-transform duration-200 ease-out motion-reduce:transition-none"
        style={{ transform: active ? "scaleX(1)" : "scaleX(0)" }}
      />
    </div>
  );
}
