/** Typed client for the Fixtures ONSAT REST API (same contract third-party apps use). */

export type MatchStatus = 'upcoming' | 'live' | 'halftime' | 'finished' | 'postponed' | 'cancelled';

export interface TeamRef {
  id: string;
  name: string;
  name_en: string | null;
  logo: string | null;
}
export interface Match {
  id: string;
  kickoff: string;
  status: MatchStatus;
  status_source: 'live-feed' | 'estimated';
  minute: string | null;
  home_team: TeamRef;
  away_team: TeamRef;
  competition: { id: string; name: string; logo: string | null } | null;
  round: string | null;
  score: { home: number | null; away: number | null };
  main_channel_logo: string | null;
  has_details: boolean;
  source_url: string | null;
}
export interface Channel {
  id: string;
  name: string;
  logo: string | null;
  satellite: string | null;
  frequency: number | null;
  polarization: string | null;
  symbol_rate: number | null;
  tuning: string | null;
  quality: string | null;
  encrypted: boolean | null;
  sharing_supported: boolean;
}
export interface MatchDetails extends Match {
  watch_on: { name: string; logo: string | null } | null;
  commentator: string | null;
  channels: Channel[];
}
export interface Competition {
  id: string;
  name: string;
  logo: string | null;
  category: string | null;
  season: string | null;
  match_count: number;
}
export interface Team {
  id: string;
  name: string;
  logo: string | null;
  competitions: string[];
  match_count: number;
}
export interface Satellite {
  id: string;
  name: string;
  region: string | null;
  channel_count: number;
}
export interface Feed {
  id: string;
  tuning: string;
  encryption: string | null;
  home_team: { name: string; logo: string | null } | null;
  away_team: { name: string; logo: string | null } | null;
}

export interface Envelope<T> {
  success: true;
  source: string;
  last_updated: string | null;
  data: T;
  pagination?: { page: number; limit: number; total: number; total_pages: number };
}

/** Empty = same origin (API serves the site). Set VITE_API_BASE_URL when hosting the site elsewhere (e.g. GitHub Pages). */
export const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

export class ApiFailure extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

/** GitHub Pages build: read exported JSON files instead of calling a server. */
export const STATIC_MODE = import.meta.env.VITE_STATIC_DATA === 'true';

export async function api<T>(path: string, signal?: AbortSignal): Promise<Envelope<T>> {
  if (STATIC_MODE) {
    const { staticApi, NotFound } = await import('./static');
    try {
      return await staticApi<T>(path, signal);
    } catch (e) {
      if ((e as Error).name === 'AbortError') throw e;
      throw new ApiFailure(e instanceof NotFound ? 'غير موجود' : 'تعذر تحميل البيانات', e instanceof NotFound ? 404 : 0);
    }
  }
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/v1${path}`, { signal, headers: { Accept: 'application/json' } });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new ApiFailure('تعذر الاتصال بالخادم', 0);
  }
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.success) {
    throw new ApiFailure(body?.error?.message ?? `HTTP ${res.status}`, res.status);
  }
  return body as Envelope<T>;
}

export const userTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
