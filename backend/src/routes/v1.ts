import { Router, type Request, type Response } from 'express';
import type { DataStore } from '../services/store.js';
import type { Match, MatchStatus } from '../models/types.js';
import { ApiError, dateParam, localDate, matchesText, paginate, qs, timezone } from '../utils/query.js';

const STATUSES: MatchStatus[] = ['upcoming', 'live', 'halftime', 'finished', 'postponed', 'cancelled'];
const SOURCE = 'fixtures-onsat';

export function v1Router(store: DataStore): Router {
  const r = Router();

  const send = (res: Response, data: unknown, extra: Record<string, unknown> = {}, maxAge = 30) => {
    res.set('Cache-Control', `public, max-age=${maxAge}`);
    res.json({ success: true, source: SOURCE, last_updated: store.lastUpdated(), ...extra, data });
  };

  const ensureData = () => {
    if (!store.hasData()) throw new ApiError(503, 'DATA_NOT_READY', 'Data has not been synchronised from the source yet; retry shortly');
  };

  /** Shared filters for every match listing. */
  async function listMatches(req: Request, preset: (m: Match, ctx: { tz: string; now: number }) => boolean = () => true) {
    ensureData();
    await store.refreshScores();
    const tz = timezone(req);
    const now = store.now();
    const date = dateParam(qs(req, 'date'), 'date');
    const from = dateParam(qs(req, 'from'), 'from');
    const to = dateParam(qs(req, 'to'), 'to');
    const status = qs(req, 'status')?.split(',');
    if (status?.some((s) => !STATUSES.includes(s as MatchStatus))) {
      throw new ApiError(400, 'INVALID_PARAMETER', `'status' must be one or more of: ${STATUSES.join(', ')}`);
    }
    const competition = qs(req, 'competition');
    const team = qs(req, 'team');
    const q = qs(req, 'q');
    const hasDetails = qs(req, 'has_channels');
    const order = qs(req, 'order') === 'desc' ? -1 : 1;
    const items = store
      .allMatches()
      .filter((m) => {
        if (!preset(m, { tz, now })) return false;
        const d = localDate(m.kickoff, tz);
        if (date && d !== date) return false;
        if (from && d < from) return false;
        if (to && d > to) return false;
        if (status && !status.includes(m.status)) return false;
        if (competition && m.competition?.id !== competition) return false;
        if (team && m.home_team.id !== team && m.away_team.id !== team) return false;
        if (hasDetails === 'true' && !m.has_details) return false;
        if (q && !matchesText(q, m.home_team.name, m.away_team.name, m.home_team.name_en, m.away_team.name_en, m.competition?.name)) return false;
        return true;
      })
      .sort((a, b) => order * (a.kickoff.localeCompare(b.kickoff) || a.id.localeCompare(b.id)));
    return { tz, page: paginate(req, items) };
  }

  const matchList =
    (preset?: Parameters<typeof listMatches>[1], extra?: (req: Request, tz: string) => Record<string, unknown>) =>
    async (req: Request, res: Response) => {
      const { tz, page } = await listMatches(req, preset);
      send(res, page.items, { timezone: tz, pagination: page.pagination, ...(extra?.(req, tz) ?? {}) }, 15);
    };

  r.get('/matches', matchList());
  r.get(
    '/matches/today',
    matchList((m, { tz, now }) => localDate(m.kickoff, tz) === localDate(now, tz), (_req, tz) => ({ date: localDate(store.now(), tz) })),
  );
  r.get('/matches/live', matchList((m) => m.status === 'live' || m.status === 'halftime'));
  r.get('/matches/upcoming', matchList((m, { now }) => m.status === 'upcoming' && Date.parse(m.kickoff) >= now - 60_000));
  r.get('/matches/date/:date', async (req, res) => {
    const date = dateParam(String(req.params.date), 'date')!;
    const { tz, page } = await listMatches(req, (m, ctx) => localDate(m.kickoff, ctx.tz) === date);
    send(res, page.items, { timezone: tz, date, pagination: page.pagination }, 15);
  });

  r.get('/matches/:id', async (req, res) => {
    ensureData();
    await store.refreshScores();
    const d = await store.getMatchDetails(String(req.params.id));
    if (!d) throw new ApiError(404, 'NOT_FOUND', `Match '${req.params.id}' not found`);
    send(res, d, {}, 15);
  });

  r.get('/matches/:id/channels', async (req, res) => {
    ensureData();
    const d = await store.getMatchDetails(String(req.params.id));
    if (!d) throw new ApiError(404, 'NOT_FOUND', `Match '${req.params.id}' not found`);
    send(res, d.channels, { match_id: d.id, watch_on: d.watch_on, commentator: d.commentator }, 60);
  });

  r.get('/competitions', (req, res) => {
    const q = qs(req, 'q');
    const category = qs(req, 'category');
    const items = store
      .getCompetitions()
      .filter((c) => (!q || matchesText(q, c.name, c.id)) && (!category || c.category === category));
    const page = paginate(req, items, 100);
    send(res, page.items, { pagination: page.pagination }, 300);
  });

  r.get('/competitions/:id', (req, res) => {
    const c = store.getCompetitions().find((x) => x.id === req.params.id);
    if (!c) throw new ApiError(404, 'NOT_FOUND', `Competition '${req.params.id}' not found`);
    send(res, c, {}, 300);
  });

  r.get('/competitions/:id/matches', async (req, res) => {
    const id = String(req.params.id);
    if (!store.getCompetitions().some((x) => x.id === id)) throw new ApiError(404, 'NOT_FOUND', `Competition '${id}' not found`);
    const { tz, page } = await listMatches(req, (m) => m.competition?.id === id);
    send(res, page.items, { timezone: tz, pagination: page.pagination }, 60);
  });

  r.get('/teams', (req, res) => {
    const q = qs(req, 'q');
    const competition = qs(req, 'competition');
    const items = store
      .getTeams()
      .filter((t) => (!q || matchesText(q, t.name)) && (!competition || t.competitions.includes(competition)))
      .sort((a, b) => b.match_count - a.match_count || a.name.localeCompare(b.name));
    const page = paginate(req, items, 100);
    send(res, page.items, { pagination: page.pagination }, 300);
  });

  r.get('/teams/:id', (req, res) => {
    const t = store.getTeams().find((x) => x.id === req.params.id);
    if (!t) throw new ApiError(404, 'NOT_FOUND', `Team '${req.params.id}' not found`);
    send(res, t, {}, 300);
  });

  r.get('/teams/:id/matches', async (req, res) => {
    const id = String(req.params.id);
    if (!store.getTeams().some((x) => x.id === id)) throw new ApiError(404, 'NOT_FOUND', `Team '${id}' not found`);
    const { tz, page } = await listMatches(req, (m) => m.home_team.id === id || m.away_team.id === id);
    send(res, page.items, { timezone: tz, pagination: page.pagination }, 60);
  });

  r.get('/channels', (req, res) => {
    const q = qs(req, 'q');
    const satellite = qs(req, 'satellite');
    const encrypted = qs(req, 'encrypted');
    const items = store.getChannels().filter(
      (c) =>
        (!q || matchesText(q, c.name)) &&
        (!satellite || (c.satellite && matchesText(satellite, c.satellite))) &&
        (encrypted === undefined || String(c.encrypted) === encrypted),
    );
    const page = paginate(req, items, 100);
    send(res, page.items, { pagination: page.pagination }, 300);
  });

  r.get('/satellites', (_req, res) => send(res, store.getSatellites(), {}, 300));

  r.get('/satellites/:id/channels', (req, res) => {
    const ch = store.getSatelliteChannels(String(req.params.id));
    if (!ch) throw new ApiError(404, 'NOT_FOUND', `Satellite '${req.params.id}' not found`);
    const q = qs(req, 'q');
    send(res, q ? ch.filter((c) => matchesText(q, c.name)) : ch, { satellite_id: req.params.id }, 300);
  });

  r.get('/feeds', (_req, res) => send(res, store.getFeeds(), {}, 120));

  r.get('/status', (_req, res) => send(res, store.status(), {}, 0));

  return r;
}
