import { describe, expect, it } from 'vitest';
import { config } from '../src/config.js';
import { DataStore } from '../src/services/store.js';
import type { FixturesProvider, RawCompetition, RawSatellite } from '../src/providers/types.js';

const channel = { id: 'c_1', name: 'Ch', logo: null, satellite: 'Nilesat 7°W', frequency: 11054, polarization: 'H' as const, symbol_rate: 27500, tuning: null, quality: 'HD', encrypted: false, sharing_supported: false };

function provider(sats: RawSatellite[], comps: RawCompetition[]): FixturesProvider {
  return {
    name: 'test',
    publicUrl: (p) => p,
    fetchSchedule: async () => [],
    fetchCompetitions: async () => comps,
    fetchSatellites: async () => sats,
    fetchFeeds: async () => [],
    fetchMatchDetails: async () => ({ kickoff: null, competitionName: null, round: null, watchOn: null, commentator: null, channels: [] }),
  };
}

describe('DataStore catalog sync', () => {
  it('keeps the previous data for pages that failed and does not mark the catalog fresh', async () => {
    config.dataDir = '';
    const comp: RawCompetition = { id: 'liga', name: 'Liga', logo: null, category: null, season: null, fixtures: [] };
    const good = new DataStore(provider([{ id: 'nilesat', name: 'Nilesat', region: null, channels: [channel] }], [comp]), null);
    await good.syncCatalog();
    expect(good.getSatelliteChannels('nilesat')).toHaveLength(1);
    const syncedAt = good.status().catalog_synced_at;
    expect(syncedAt).not.toBeNull();

    // Second sync: the satellite page is rate limited.
    const p = provider([{ id: 'nilesat', name: 'Nilesat', region: null, channels: [], fetchFailed: true }], [comp]);
    (good as unknown as { provider: FixturesProvider }).provider.fetchSatellites = p.fetchSatellites;
    await good.syncCatalog();
    expect(good.getSatelliteChannels('nilesat')).toHaveLength(1);
    expect(good.status().catalog_synced_at).toBe(syncedAt);
  });
});

describe('DataStore channel details', () => {
  it('persists channel lists in the snapshot so a rate-limited run keeps them', async () => {
    const { mkdtemp } = await import('node:fs/promises');
    const { tmpdir } = await import('node:os');
    const path = await import('node:path');
    config.dataDir = await mkdtemp(path.join(tmpdir(), 'onsat-'));
    const now = Date.parse('2026-11-23T12:00:00Z');
    const fixture = {
      kickoff: '2026-11-24T18:00:00.000Z', // +30 h: inside the widened window
      home: { name: 'A', logo: null },
      away: { name: 'B', logo: null },
      competition: null,
      round: null,
      detailPath: '/2026/11/a-vs-b.html',
      mainChannelLogo: null,
      scoreRef: null,
    };
    const details = { kickoff: fixture.kickoff, competitionName: null, round: null, watchOn: null, commentator: null, channels: [channel] };
    const p1 = { ...provider([], []), fetchSchedule: async () => [fixture], fetchMatchDetails: async () => details };
    const first = new DataStore(p1, null, () => now);
    await first.syncSchedule();
    const id = first.allMatches()[0]!.id;
    expect(first.cachedMatchDetails(id)?.channels).toHaveLength(1);

    // Next run (e.g. the next GitHub Actions export): the source answers 429.
    const limited = Object.assign(new Error('HTTP 429'), { status: 429 });
    const p2 = { ...p1, fetchMatchDetails: async () => Promise.reject(limited) };
    const second = new DataStore(p2, null, () => now + 40 * 60_000);
    await second.loadSnapshot();
    await second.syncSchedule();
    expect(second.cachedMatchDetails(id)?.channels).toHaveLength(1);
    config.dataDir = '';
  });

  it('shows the source final score for finished matches the score feed misses', async () => {
    config.dataDir = '';
    const fx = {
      kickoff: '2026-11-22T20:45:00.000Z',
      home: { name: 'T', logo: null },
      away: { name: 'B', logo: null },
      competition: null,
      round: null,
      detailPath: '/2026/11/t-vs-b.html',
      mainChannelLogo: null,
      scoreRef: null,
      finalScore: { home: 1, away: 3 },
    };
    const s = new DataStore({ ...provider([], []), fetchSchedule: async () => [fx] }, null, () => Date.parse('2026-11-22T21:00:00Z'));
    await s.syncSchedule();
    expect(s.allMatches()[0]).toMatchObject({ status: 'finished', score: { home: 1, away: 3 } });
  });
});

describe('app display order', () => {
  it('exposes the schedule position and ESPN id on each match', async () => {
    config.dataDir = '';
    const base = { home: { name: 'A', logo: null }, away: { name: 'B', logo: null }, competition: null, round: null, detailPath: null, mainChannelLogo: null };
    const fixtures = [
      { ...base, kickoff: '2026-11-23T20:00:00.000Z', scoreRef: { eventId: '77', league: null }, order: 0 },
      { ...base, home: { name: 'C', logo: null }, kickoff: '2026-11-23T13:00:00.000Z', scoreRef: null, order: 1 },
    ];
    const s = new DataStore({ ...provider([], []), fetchSchedule: async () => fixtures }, null, () => Date.parse('2026-11-23T10:00:00Z'));
    await s.syncSchedule();
    const byHome = Object.fromEntries(s.allMatches().map((m) => [m.home_team.name, m]));
    expect(byHome.A).toMatchObject({ source_order: 0, espn_event_id: '77' });
    expect(byHome.C).toMatchObject({ source_order: 1, espn_event_id: null });
  });
});
