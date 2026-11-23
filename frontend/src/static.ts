/**
 * Static-data mode (GitHub Pages): answers the API paths this site uses from
 * JSON files exported by `backend/scripts/export-static.ts`, applying the same
 * filters the server would. Live REST features (arbitrary queries, fresh
 * scores) still need the Node API; this mode is refreshed by a scheduled
 * GitHub Action.
 */
import type { Competition, Envelope, Match, MatchDetails, Team } from './api';

const DATA = './data';
const MATCH_DURATION_MS = 120 * 60_000;
const FILE_TTL_MS = 5 * 60_000; // exports run every ~30 min; re-read files at most every 5 min
const files = new Map<string, { at: number; p: Promise<Envelope<unknown>> }>();

export class NotFound extends Error {}

function load<T>(file: string, _signal?: AbortSignal): Promise<Envelope<T>> {
  const hit = files.get(file);
  let p = hit && Date.now() - hit.at < FILE_TTL_MS ? hit.p : undefined;
  if (!p) {
    // Not tied to the caller's AbortSignal: the shared promise is reused by other callers.
    p = fetch(`${DATA}/${file}`, { cache: 'no-cache' }).then((r) => {
      if (r.status === 404) throw new NotFound(file);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    });
    p.catch(() => files.delete(file));
    files.set(file, { at: Date.now(), p });
  }
  return p as Promise<Envelope<T>>;
}

/** Keep kickoff-estimated statuses current between exports (same rule as the API). */
function refresh<T extends Match>(m: T, now: number): T {
  const start = Date.parse(m.kickoff);
  if (m.status_source !== 'estimated' || m.score.home !== null) {
    // A live-feed status is frozen at export time; exports can be hours apart, so
    // don't keep showing "live" long after the match must have ended.
    if ((m.status === 'live' || m.status === 'halftime') && now > start + MATCH_DURATION_MS + 60 * 60_000) return { ...m, status: 'finished', minute: null };
    if (m.status !== 'upcoming' || now < start) return m;
    // "upcoming" frozen at export but kickoff has passed: fall back to the clock estimate.
  }
  return { ...m, status: now < start ? 'upcoming' : now < start + MATCH_DURATION_MS ? 'live' : 'finished' };
}

const localDate = (iso: string, tz: string) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));

function page<T>(items: T[], params: URLSearchParams, base: Envelope<unknown>, extra: Record<string, unknown> = {}): Envelope<T[]> {
  const limit = Number(params.get('limit') ?? 50);
  const p = Number(params.get('page') ?? 1);
  return {
    ...base,
    ...extra,
    data: items.slice((p - 1) * limit, p * limit),
    pagination: { page: p, limit, total: items.length, total_pages: Math.max(1, Math.ceil(items.length / limit)) },
  } as Envelope<T[]>;
}

const norm = (s: string) => s.replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/[\s\-_.']/g, '').toLowerCase();

export async function staticApi<T>(path: string, signal?: AbortSignal): Promise<Envelope<T>> {
  const url = new URL(path, 'http://x');
  const params = url.searchParams;
  const seg = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
  const now = Date.now();
  const tz = params.get('tz') ?? 'UTC';
  const statuses = params.get('status')?.split(',');

  const matches = async () => {
    const env = await load<Match[]>('matches.json', signal);
    return { env, list: env.data.map((m) => refresh(m, now)).filter((m) => !statuses || statuses.includes(m.status)) };
  };

  if (seg[0] === 'matches' && seg[1] === 'date' && seg[2]) {
    const { env, list } = await matches();
    return page(list.filter((m) => localDate(m.kickoff, tz) === seg[2]), params, env, { timezone: tz, date: seg[2] }) as Envelope<T>;
  }
  if (seg[0] === 'matches' && seg[1]) {
    try {
      const env = await load<MatchDetails>(`matches/${seg[1]}.json`, signal);
      return { ...env, data: refresh(env.data, now) } as Envelope<T>;
    } catch (e) {
      if (!(e instanceof NotFound)) throw e;
      // Outside the exported channel window: serve the fixture without channels.
      const { env, list } = await matches();
      const m = list.find((x) => x.id === seg[1]);
      if (!m) throw new NotFound(`Match '${seg[1]}' not found`);
      return { ...env, data: { ...m, watch_on: null, commentator: null, channels: [] } } as Envelope<T>;
    }
  }
  if (seg[0] === 'teams' || seg[0] === 'competitions') {
    const kind = seg[0];
    const env = await load<Array<Team | Competition>>(`${kind}.json`, signal);
    if (!seg[1]) {
      const q = params.get('q');
      let items = env.data.filter((x) => !q || norm(x.name).includes(norm(q)));
      if (kind === 'teams') items = [...items].sort((a, b) => b.match_count - a.match_count);
      return page(items, params, env) as Envelope<T>;
    }
    const item = env.data.find((x) => x.id === seg[1]);
    if (!item) throw new NotFound(`'${seg[1]}' not found`);
    if (seg[2] !== 'matches') return { ...env, data: item } as Envelope<T>;
    const { env: menv, list } = await matches();
    const mine = list.filter((m) => (kind === 'teams' ? m.home_team.id === seg[1] || m.away_team.id === seg[1] : m.competition?.id === seg[1]));
    return page(mine, params, menv, { timezone: tz }) as Envelope<T>;
  }
  if (seg[0] === 'satellites') return load<T>(seg[1] ? `satellites/${seg[1]}.json` : 'satellites.json', signal);
  if (seg[0] === 'feeds') return load<T>('feeds.json', signal);
  throw new NotFound(path);
}
