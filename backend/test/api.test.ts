import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { config } from '../src/config.js';
import { DataStore } from '../src/services/store.js';
import { parseCompetitionPage, parseMatchPage, parseSatellitePage, parseSchedulePage } from '../src/providers/fixtures-onsat/parsers.js';
import type { FixturesProvider, LiveScore, RawFixture, ScoresProvider } from '../src/providers/types.js';
import * as html from './fixtures/html.js';

const NOW = Date.parse('2026-11-21T13:00:00Z'); // match A live (12:30), match C upcoming (20:00)

const provider: FixturesProvider = {
  name: 'test',
  publicUrl: (p) => `https://source.test${p}`,
  fetchSchedule: async () => parseSchedulePage(html.schedulePage).value.filter((f): f is RawFixture => f.kickoff !== null),
  fetchCompetitions: async () => [{ ...parseCompetitionPage(html.competitionPage, 'england-premier-league').value, category: 'Cat' }],
  fetchSatellites: async () => [{ id: 'nilesat', name: 'Nilesat 7°W', region: 'West', channels: parseSatellitePage(html.satellitePage).value }],
  fetchFeeds: async () => [],
  fetchMatchDetails: async () => parseMatchPage(html.matchPage).value,
};

const scores: ScoresProvider = {
  name: 'stub',
  fetchScores: async () =>
    new Map<string, LiveScore>([
      ['1001', { eventId: '1001', state: 'in', statusName: 'STATUS_SECOND_HALF', clock: "67'", home: { name: 'Team A', score: 2 }, away: { name: 'Team B', score: 1 } }],
    ]),
};

let store: DataStore;
let app: ReturnType<typeof createApp>;

beforeAll(async () => {
  config.dataDir = '';
  store = new DataStore(provider, scores, () => NOW);
  store.load({
    schedule: await provider.fetchSchedule(),
    competitions: await provider.fetchCompetitions(),
    satellites: await provider.fetchSatellites(),
  });
  app = createApp(store);
});

afterEach(() => {
  config.apiKeys = [];
});

describe('matches', () => {
  it('lists all matches with the standard envelope, merged across schedule and competition pages', async () => {
    const res = await request(app).get('/api/v1/matches');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, source: 'fixtures-onsat', pagination: { total: 3 } });
    // Same match on both pages (same crest ids + kickoff) is de-duplicated.
    const a = res.body.data.find((m: { kickoff: string }) => m.kickoff === '2026-11-21T12:30:00.000Z');
    expect(a).toMatchObject({ has_details: true, round: 'الجولة 11', home_team: { id: 't_AAAAAAAA', name: 'الفريق أ' } });
  });

  it('applies live scores from the score feed', async () => {
    const res = await request(app).get('/api/v1/matches/live');
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({
      status: 'live',
      status_source: 'live-feed',
      minute: "67'",
      score: { home: 2, away: 1 },
      home_team: { name_en: 'Team A' },
    });
  });

  it('estimates status when no score feed covers a match', async () => {
    const res = await request(app).get('/api/v1/matches/upcoming');
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({ status: 'upcoming', status_source: 'estimated', score: { home: null, away: null } });
  });

  it('filters by local date and timezone', async () => {
    // 20:00Z on the 21st is 02:00 on the 22nd in Asia/Dhaka (UTC+6)
    const utc = await request(app).get('/api/v1/matches/date/2026-11-21');
    const dhaka = await request(app).get('/api/v1/matches/date/2026-11-22?tz=Asia/Dhaka');
    expect(utc.body.data).toHaveLength(2);
    expect(dhaka.body.data).toHaveLength(1);
    expect(dhaka.body.timezone).toBe('Asia/Dhaka');
  });

  it('filters by team, competition, search and paginates', async () => {
    expect((await request(app).get('/api/v1/matches?team=t_EEEEEEEE')).body.data).toHaveLength(1);
    expect((await request(app).get('/api/v1/matches?competition=england-premier-league')).body.data).toHaveLength(3);
    expect((await request(app).get('/api/v1/matches?q=Team%20A')).body.data).toHaveLength(1);
    const p = await request(app).get('/api/v1/matches?limit=2&page=2');
    expect(p.body.pagination).toEqual({ page: 2, limit: 2, total: 3, total_pages: 2 });
    expect(p.body.data).toHaveLength(1);
  });

  it('returns match details and channels', async () => {
    const list = await request(app).get('/api/v1/matches/live');
    const id = list.body.data[0].id;
    const d = await request(app).get(`/api/v1/matches/${id}`);
    expect(d.body.data).toMatchObject({ id, watch_on: { name: 'beIN SPORTS 1' }, commentator: null });
    expect(d.body.data.channels).toHaveLength(2);
    const ch = await request(app).get(`/api/v1/matches/${id}/channels`);
    expect(ch.body).toMatchObject({ match_id: id, watch_on: { name: 'beIN SPORTS 1' } });
    expect(ch.body.data[0]).toMatchObject({ satellite: 'Nilesat 7°W', frequency: 12188, polarization: 'H' });
  });
});

describe('catalog endpoints', () => {
  it('competitions, teams, channels, satellites', async () => {
    const c = await request(app).get('/api/v1/competitions');
    expect(c.body.data[0]).toMatchObject({ id: 'england-premier-league', category: 'Cat', season: '2026 . 2027', match_count: 3 });
    expect((await request(app).get('/api/v1/competitions/england-premier-league')).status).toBe(200);
    const t = await request(app).get('/api/v1/teams?q=الفريق');
    expect(t.body.pagination.total).toBe(6);
    expect((await request(app).get('/api/v1/teams/t_AAAAAAAA/matches')).body.data).toHaveLength(1);
    expect((await request(app).get('/api/v1/channels?satellite=nilesat')).body.data).toHaveLength(1);
    expect((await request(app).get('/api/v1/satellites')).body.data[0]).toMatchObject({ id: 'nilesat', channel_count: 1 });
    expect((await request(app).get('/api/v1/satellites/nilesat/channels')).body.data).toHaveLength(1);
  });
});

describe('errors, auth and system', () => {
  it('validates parameters', async () => {
    const bad = await request(app).get('/api/v1/matches?tz=Mars/Base');
    expect(bad.status).toBe(400);
    expect(bad.body).toMatchObject({ success: false, error: { code: 'INVALID_PARAMETER' } });
    expect((await request(app).get('/api/v1/matches/date/2026-13-45')).status).toBe(400);
    expect((await request(app).get('/api/v1/matches?status=nope')).status).toBe(400);
    expect((await request(app).get('/api/v1/matches?limit=0')).status).toBe(400);
  });

  it('returns 404 for unknown resources and routes', async () => {
    expect((await request(app).get('/api/v1/matches/m_missing')).body.error.code).toBe('NOT_FOUND');
    expect((await request(app).get('/api/v1/competitions/nope')).status).toBe(404);
    expect((await request(app).get('/api/v1/nope')).status).toBe(404);
  });

  it('enforces API keys only when configured', async () => {
    config.apiKeys = ['secret'];
    expect((await request(app).get('/api/v1/matches')).status).toBe(401);
    expect((await request(app).get('/api/v1/matches').set('X-API-Key', 'secret')).status).toBe(200);
  });

  it('serves health, status and the OpenAPI document', async () => {
    expect((await request(app).get('/health')).body.status).toBe('ok');
    expect((await request(app).get('/api/v1/status')).body.data.counts.matches).toBe(3);
    const spec = await request(app).get('/openapi.json');
    expect(spec.body.openapi).toBe('3.0.3');
    expect(Object.keys(spec.body.paths)).toContain('/api/v1/matches/today');
  });

  it('sends CORS headers for API consumers', async () => {
    const res = await request(app).get('/api/v1/satellites').set('Origin', 'https://my-iptv.app');
    expect(res.headers['access-control-allow-origin']).toBe('*');
  });
});
