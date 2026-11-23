/**
 * Live status and scores straight from ESPN's public scoreboard, polled by the
 * browser — the same source the Fixtures ONSAT app pages use. The static
 * export (GitHub Pages) can be hours old, so this keeps "live" / "finished"
 * and scores current without a server. Best effort: on any failure the
 * exported data is shown unchanged.
 */
import type { Match, MatchStatus } from './api';

const ESPN = 'https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard';
const TTL_MS = 30_000;
const HOUR = 3600_000;

interface EspnEvent {
  id: string;
  status?: { displayClock?: string; type?: { name?: string; state?: 'pre' | 'in' | 'post' } };
  competitions?: Array<{ competitors?: Array<{ homeAway: 'home' | 'away'; score?: string }> }>;
}

const boards = new Map<string, { at: number; p: Promise<EspnEvent[]> }>();

function board(date: string, now: number): Promise<EspnEvent[]> {
  const hit = boards.get(date);
  if (hit && now - hit.at < TTL_MS) return hit.p;
  const p = fetch(`${ESPN}?dates=${date}`)
    .then((r) => (r.ok ? r.json() : { events: [] }))
    .then((j: { events?: EspnEvent[] }) => j.events ?? [])
    .catch(() => {
      boards.delete(date);
      return [] as EspnEvent[];
    });
  boards.set(date, { at: now, p });
  return p;
}

const POSTPONED = new Set(['STATUS_POSTPONED', 'STATUS_DELAYED', 'STATUS_SUSPENDED']);
const CANCELLED = new Set(['STATUS_CANCELED', 'STATUS_CANCELLED', 'STATUS_ABANDONED', 'STATUS_FORFEIT']);

function apply<T extends Match>(m: T, e: EspnEvent): T {
  const state = e.status?.type?.state;
  const name = e.status?.type?.name ?? '';
  const comps = e.competitions?.[0]?.competitors ?? [];
  const home = comps.find((c) => c.homeAway === 'home');
  const away = comps.find((c) => c.homeAway === 'away');
  if (!state || !home || !away) return m;
  let status: MatchStatus;
  if (POSTPONED.has(name)) status = 'postponed';
  else if (CANCELLED.has(name)) status = 'cancelled';
  else if (state === 'pre') status = Date.now() >= Date.parse(m.kickoff) ? m.status : 'upcoming';
  else if (state === 'in') status = name === 'STATUS_HALFTIME' ? 'halftime' : 'live';
  else status = 'finished';
  const n = (s?: string) => (state === 'pre' || s === undefined || s === '' ? null : Number(s));
  return {
    ...m,
    status,
    status_source: 'live-feed',
    minute: state === 'in' ? e.status?.displayClock ?? null : null,
    score: state === 'pre' ? m.score : { home: n(home.score), away: n(away.score) },
  };
}

const ymd = (t: number) => new Date(t).toISOString().slice(0, 10).replace(/-/g, '');

/** Returns a function that overlays fresh ESPN data on a match (identity when unknown). */
export async function liveOverlay(matches: Match[], now: number): Promise<<T extends Match>(m: T) => T> {
  // Only matches around now: started in the last 36 h or starting within 15 min.
  const wanted = matches.filter((m) => {
    if (!m.espn_event_id) return false;
    const t = Date.parse(m.kickoff);
    return t > now - 36 * HOUR && t < now + 15 * 60_000;
  });
  if (!wanted.length) return (m) => m;
  const dates = new Set<string>();
  for (const m of wanted) {
    const t = Date.parse(m.kickoff);
    dates.add(ymd(t));
    dates.add(ymd(t - 24 * HOUR)); // ESPN groups events by US date
  }
  const events = new Map<string, EspnEvent>();
  for (const list of await Promise.all([...dates].map((d) => board(d, now)))) for (const e of list) events.set(e.id, e);
  return (m) => {
    const e = m.espn_event_id ? events.get(m.espn_event_id) : undefined;
    return e ? apply(m, e) : m;
  };
}
