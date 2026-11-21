import { config } from '../config.js';

export class SourceError extends Error {
  constructor(message: string, readonly url: string, readonly status?: number) {
    super(message);
    this.name = 'SourceError';
  }
}

/** GET with timeout and a couple of retries on network errors / 5xx. */
export async function fetchText(url: string, retries = 2): Promise<string> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), config.requestTimeoutMs);
    try {
      const res = await fetch(url, {
        signal: ctl.signal,
        redirect: 'follow',
        headers: { 'User-Agent': config.userAgent, Accept: 'text/html,application/json;q=0.9,*/*;q=0.8' },
      });
      if (res.status === 404) throw new SourceError(`Not found`, url, 404);
      if (!res.ok) throw new SourceError(`HTTP ${res.status}`, url, res.status);
      return await res.text();
    } catch (err) {
      lastErr = err;
      if (err instanceof SourceError && err.status !== undefined && err.status < 500) break;
      if (attempt < retries) await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
    } finally {
      clearTimeout(timer);
    }
  }
  if (lastErr instanceof SourceError) throw lastErr;
  throw new SourceError(lastErr instanceof Error ? lastErr.message : String(lastErr), url);
}

export async function fetchJson<T>(url: string): Promise<T> {
  return JSON.parse(await fetchText(url)) as T;
}

/** Run async tasks with bounded concurrency; failures are returned, not thrown. */
export async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<Array<{ item: T; ok: true; value: R } | { item: T; ok: false; error: unknown }>> {
  const out: Array<{ item: T; ok: true; value: R } | { item: T; ok: false; error: unknown }> = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      const item = items[i]!;
      try {
        out[i] = { item, ok: true, value: await fn(item) };
      } catch (error) {
        out[i] = { item, ok: false, error };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}
