import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { api, type Envelope } from './api';

export interface Query<T> {
  data: Envelope<T> | null;
  error: Error | null;
  loading: boolean;
  reload: () => void;
}

/** Fetch an API path; optionally re-poll every `pollMs` (silently, keeping current data). */
export function useApi<T>(path: string | null, pollMs?: number): Query<T> {
  const [data, setData] = useState<Envelope<T> | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(path !== null);
  const [tick, setTick] = useState(0);
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    if (path === null) return;
    const ctl = new AbortController();
    if (lastPath.current !== path) {
      setData(null);
      lastPath.current = path;
    }
    setLoading(true);
    api<T>(path, ctl.signal)
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e: Error) => e.name !== 'AbortError' && setError(e))
      .finally(() => !ctl.signal.aborted && setLoading(false));
    return () => ctl.abort();
  }, [path, tick]);

  useEffect(() => {
    if (!pollMs || path === null) return;
    const id = setInterval(() => !document.hidden && setTick((t) => t + 1), pollMs);
    return () => clearInterval(id);
  }, [pollMs, path]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, error, loading, reload };
}

// ---- persisted settings (same localStorage keys as the original site) ----

const listeners = new Set<() => void>();
function read(key: string, def: string): string {
  try {
    return localStorage.getItem(key) ?? def;
  } catch {
    return def;
  }
}
export function setSetting(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* storage unavailable: setting lasts for this page view only */
  }
  listeners.forEach((l) => l());
}
export function useSetting(key: string, def: string): string {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      window.addEventListener('storage', cb);
      return () => {
        listeners.delete(cb);
        window.removeEventListener('storage', cb);
      };
    },
    () => read(key, def),
  );
}

/** Re-render every `ms` so time-based labels (countdowns) stay current. */
export function useNow(ms = 30_000): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}
