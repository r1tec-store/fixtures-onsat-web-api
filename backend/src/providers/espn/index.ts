import { config } from '../../config.js';
import { fetchJson, mapLimit } from '../../utils/http.js';
import type { LiveScore, ScoresProvider } from '../types.js';

/**
 * Live scores from ESPN's public site API — the same unauthenticated JSON the
 * original Fixtures ONSAT pages call (via a CORS proxy) using the
 * `data-espn-id` attribute on each fixture row. Server-side we need no proxy.
 * Unofficial/undocumented: treat as best-effort enrichment, never as required.
 */
interface EspnCompetitor {
  homeAway: 'home' | 'away';
  score?: string;
  team?: { displayName?: string };
}
interface EspnEvent {
  id: string;
  status?: { displayClock?: string; type?: { name?: string; state?: 'pre' | 'in' | 'post' } };
  competitions?: Array<{ competitors?: EspnCompetitor[] }>;
}
interface EspnScoreboard {
  events?: EspnEvent[];
}

export function toLiveScore(e: EspnEvent): LiveScore | null {
  const comps = e.competitions?.[0]?.competitors ?? [];
  const home = comps.find((c) => c.homeAway === 'home');
  const away = comps.find((c) => c.homeAway === 'away');
  const state = e.status?.type?.state;
  if (!home || !away || !state) return null;
  const score = (c: EspnCompetitor) => (state === 'pre' || c.score === undefined || c.score === '' ? null : Number(c.score));
  return {
    eventId: e.id,
    state,
    statusName: e.status?.type?.name ?? '',
    clock: state === 'in' ? e.status?.displayClock ?? null : null,
    home: { name: home.team?.displayName ?? '', score: score(home) },
    away: { name: away.team?.displayName ?? '', score: score(away) },
  };
}

export class EspnScoresProvider implements ScoresProvider {
  readonly name = 'espn';
  constructor(private readonly baseUrl = config.espnBaseUrl) {}

  async fetchScores(dates: string[], leagues: string[], wantedIds: Set<string>): Promise<Map<string, LiveScore>> {
    const out = new Map<string, LiveScore>();
    const collect = (sb: EspnScoreboard) => {
      for (const e of sb.events ?? []) {
        const s = toLiveScore(e);
        if (s) out.set(s.eventId, s);
      }
    };
    const ymd = (d: string) => d.replace(/-/g, '');
    // One request per date for all soccer…
    const all = await mapLimit(dates, config.sourceConcurrency, (d) => fetchJson<EspnScoreboard>(`${this.baseUrl}/all/scoreboard?dates=${ymd(d)}`));
    all.forEach((r) => r.ok && collect(r.value));
    // …then per-league fallback for wanted events the "all" board omitted (it is capped).
    const missing = [...wantedIds].some((id) => !out.has(id));
    if (missing && leagues.length) {
      const jobs = leagues.flatMap((l) => dates.map((d) => ({ l, d })));
      const per = await mapLimit(jobs, config.sourceConcurrency, ({ l, d }) =>
        fetchJson<EspnScoreboard>(`${this.baseUrl}/${encodeURIComponent(l)}/scoreboard?dates=${ymd(d)}`),
      );
      per.forEach((r) => r.ok && collect(r.value));
    }
    if (all.length && all.every((r) => !r.ok)) throw (all[0] as { error: unknown } | undefined)?.error ?? new Error('ESPN unavailable');
    return out;
  }
}
