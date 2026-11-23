/** Pure normalization: raw provider records -> public data model. */
import type { Competition, Match, MatchStatus, Team } from '../models/types.js';
import type { LiveScore, RawCompetition, RawFixture } from '../providers/types.js';
import { matchId, teamId } from '../utils/ids.js';

/** A normalized fixture before time-dependent status/score is applied. */
export interface BaseMatch extends Omit<Match, 'status' | 'status_source' | 'minute' | 'score'> {
  detail_path: string | null;
  score_ref: RawFixture['scoreRef'];
  final_score: { home: number; away: number } | null;
}

export function toBaseMatch(f: RawFixture, publicUrl: (p: string) => string): BaseMatch {
  const homeId = teamId(f.home.name, f.home.logo);
  const awayId = teamId(f.away.name, f.away.logo);
  return {
    id: matchId(f.kickoff, homeId, awayId),
    kickoff: f.kickoff,
    home_team: { id: homeId, name: f.home.name, name_en: null, logo: f.home.logo },
    away_team: { id: awayId, name: f.away.name, name_en: null, logo: f.away.logo },
    competition: f.competition,
    round: f.round,
    main_channel_logo: f.mainChannelLogo,
    has_details: f.detailPath !== null,
    source_url: f.detailPath ? publicUrl(f.detailPath) : null,
    detail_path: f.detailPath,
    score_ref: f.scoreRef,
    final_score: f.finalScore ?? null,
  };
}

/**
 * Merge the short schedule (rich: detail page, score ref, channel logo) with
 * full-season competition fixtures. Same match on both = same id.
 */
export function mergeFixtures(schedule: RawFixture[], competitions: RawCompetition[], publicUrl: (p: string) => string): Map<string, BaseMatch> {
  const byId = new Map<string, BaseMatch>();
  for (const c of competitions) {
    for (const f of c.fixtures) {
      const m = toBaseMatch(f, publicUrl);
      if (!byId.has(m.id)) byId.set(m.id, m);
    }
  }
  for (const f of schedule) {
    const m = toBaseMatch(f, publicUrl);
    const prev = byId.get(m.id);
    byId.set(m.id, prev ? { ...prev, ...withoutNulls(m), round: prev.round ?? m.round, competition: m.competition ?? prev.competition } : m);
  }
  return byId;
}

function withoutNulls<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== false)) as Partial<T>;
}

const POSTPONED = new Set(['STATUS_POSTPONED', 'STATUS_DELAYED', 'STATUS_SUSPENDED']);
const CANCELLED = new Set(['STATUS_CANCELED', 'STATUS_CANCELLED', 'STATUS_ABANDONED', 'STATUS_FORFEIT']);

export function applyStatus(m: BaseMatch, live: LiveScore | undefined, now: number, durationMs: number): Match {
  const { detail_path: _d, score_ref: _s, final_score: finalScore, ...pub } = m;
  if (live) {
    let status: MatchStatus;
    if (POSTPONED.has(live.statusName)) status = 'postponed';
    else if (CANCELLED.has(live.statusName)) status = 'cancelled';
    else if (live.state === 'pre') status = 'upcoming';
    else if (live.state === 'in') status = live.statusName === 'STATUS_HALFTIME' ? 'halftime' : 'live';
    else status = 'finished';
    return {
      ...pub,
      home_team: { ...pub.home_team, name_en: live.home.name || null },
      away_team: { ...pub.away_team, name_en: live.away.name || null },
      status,
      status_source: 'live-feed',
      minute: live.clock,
      score: { home: live.home.score, away: live.away.score },
    };
  }
  const start = Date.parse(m.kickoff);
  // The source prints the final score once a match is over: trust it over the clock estimate.
  if (finalScore) return { ...pub, status: 'finished', status_source: 'estimated', minute: null, score: { ...finalScore } };
  const status: MatchStatus = now < start ? 'upcoming' : now < start + durationMs ? 'live' : 'finished';
  return { ...pub, status, status_source: 'estimated', minute: null, score: { home: null, away: null } };
}

export function buildCompetitions(raw: RawCompetition[], matches: Iterable<BaseMatch>): Competition[] {
  const counts = new Map<string, number>();
  const extra = new Map<string, Competition>();
  for (const m of matches) {
    if (!m.competition) continue;
    counts.set(m.competition.id, (counts.get(m.competition.id) ?? 0) + 1);
    if (!extra.has(m.competition.id)) {
      extra.set(m.competition.id, { ...m.competition, category: null, season: null, match_count: 0 });
    }
  }
  const out = new Map<string, Competition>();
  for (const c of raw) out.set(c.id, { id: c.id, name: c.name, logo: c.logo, category: c.category, season: c.season, match_count: 0 });
  // Competitions seen only on the daily schedule (no league page) are still listed.
  for (const [id, c] of extra) if (!out.has(id)) out.set(id, c);
  return [...out.values()].map((c) => ({ ...c, match_count: counts.get(c.id) ?? 0 }));
}

export function buildTeams(matches: Iterable<BaseMatch>): Team[] {
  const teams = new Map<string, Team & { comps: Set<string> }>();
  for (const m of matches) {
    for (const t of [m.home_team, m.away_team]) {
      let team = teams.get(t.id);
      if (!team) {
        team = { id: t.id, name: t.name, logo: t.logo, competitions: [], match_count: 0, comps: new Set() };
        teams.set(t.id, team);
      }
      team.match_count++;
      if (m.competition) team.comps.add(m.competition.id);
    }
  }
  return [...teams.values()].map(({ comps, ...t }) => ({ ...t, competitions: [...comps] }));
}
