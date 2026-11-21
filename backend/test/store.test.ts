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
