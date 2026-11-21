import { config } from '../config.js';

export class SourceError extends Error {
  constructor(message: string, readonly url: string, readonly status?: number) {
    super(message);
    this.name = 'SourceError';
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Seconds from a Retry-After header (delta-seconds or HTTP date), capped. */
function retryAfterMs(res: Response): number | null {
  const h = res.headers.get('retry-after');
  if (!h) return null;
  const secs = Number(h);
  const ms = Number.isFinite(secs) ? secs * 1000 : Date.parse(h) - Date.now();
  return Number.isFinite(ms) && ms > 0 ? Math.min(ms, 30_000) : null;
}

/**
 * GET with timeout. Retries network errors, 5xx and 429 (rate limited) with
 * exponential backoff, honouring Retry-After. SOURCE_DELAY_MS adds a polite
 * pause before every request.
 */
export async function fetchText(url: string, retries = 3): Promise<string> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (config.requestDelayMs) await sleep(config.requestDelayMs);
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), config.requestTimeoutMs);
    let wait = 1000 * 2 ** attempt;
    try {
      const res = await fetch(url, {
        signal: ctl.signal,
        redirect: 'follow',
        headers: { 'User-Agent': config.userAgent, Accept: 'text/html,application/json;q=0.9,*/*;q=0.8' },
      });
      if (res.status === 404) throw new SourceError(`Not found`, url, 404);
      if (!res.ok) {
        wait = retryAfterMs(res) ?? wait * (res.status === 429 ? 2 : 1);
        throw new SourceError(`HTTP ${res.status}`, url, res.status);
      }
      return await res.text();
    } catch (err) {
      lastErr = err;
      const status = err instanceof SourceError ? err.status : undefined;
      if (status !== undefined && status < 500 && status !== 429) break;
      if (attempt < retries) await sleep(wait);
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
