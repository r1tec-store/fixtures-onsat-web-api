/**
 * Static export for hosts that cannot run Node (GitHub Pages).
 * Syncs from the real providers once, then writes the same response
 * envelopes the API returns as plain JSON files:
 *
 *   <out>/meta.json
 *   <out>/matches.json                 every match (status/score as of export)
 *   <out>/matches/<id>.json            match details incl. channels (-3 h … +30 h)
 *   <out>/competitions.json  <out>/teams.json  <out>/satellites.json  <out>/feeds.json
 *   <out>/satellites/<id>.json         channels on that satellite
 *
 *   npm run export:static -w backend -- ../frontend/dist/data
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { config } from '../src/config.js';
import { EspnScoresProvider } from '../src/providers/espn/index.js';
import { FixturesOnsatProvider } from '../src/providers/fixtures-onsat/index.js';
import { DataStore } from '../src/services/store.js';
import { mapLimit } from '../src/utils/http.js';

const out = path.resolve(process.argv[2] ?? 'static-data');

let store: DataStore;
const provider = new FixturesOnsatProvider(config.sourceBaseUrl, (w) => store.issue('warning', w));
store = new DataStore(provider, config.enableScores ? new EspnScoresProvider() : null);

// Reuse the previous run's snapshot (DATA_DIR, persisted by the workflow cache):
// the 58-page catalog is only re-fetched when older than CATALOG_REFRESH_MINUTES,
// and anything that fails to load keeps its last good version.
await store.loadSnapshot();
const catalogAt = store.status().catalog_synced_at;
if (!catalogAt || Date.now() - Date.parse(catalogAt) > config.catalogRefreshMin * 60_000) await store.syncCatalog();
await store.syncSchedule(); // also prefetches channel lists for kickoffs -3 h … +30 h
await store.refreshScores();
if (!store.hasData()) {
  console.error('No data synchronised from the source; aborting so the previous deployment stays online.');
  process.exit(1);
}

const envelope = (data: unknown, extra: Record<string, unknown> = {}) =>
  JSON.stringify({ success: true, source: 'fixtures-onsat', last_updated: store.lastUpdated(), ...extra, data });

async function write(rel: string, body: string) {
  const file = path.join(out, rel);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, body);
}

const matches = store.allMatches().sort((a, b) => a.kickoff.localeCompare(b.kickoff) || a.id.localeCompare(b.id));
await write('matches.json', envelope(matches));
await write('competitions.json', envelope(store.getCompetitions()));
await write('teams.json', envelope(store.getTeams()));
await write('satellites.json', envelope(store.getSatellites()));
await write('feeds.json', envelope(store.getFeeds()));
for (const s of store.getSatellites()) await write(`satellites/${s.id}.json`, envelope(store.getSatelliteChannels(s.id), { satellite_id: s.id }));

// Channel lists only near kickoff (the same window syncSchedule prefetched), so the
// export adds no extra source requests. Clients fall back to matches.json + source_url.
const now = Date.now();
const DETAILS_FROM = now - 3 * 3600_000;
const DETAILS_TO = now + 30 * 3600_000;
const withDetails = matches.filter((m) => m.has_details && Date.parse(m.kickoff) >= DETAILS_FROM && Date.parse(m.kickoff) <= DETAILS_TO);
await mapLimit(withDetails, config.sourceConcurrency, async (m) => {
  const d = await store.getMatchDetails(m.id);
  if (d) await write(`matches/${m.id}.json`, envelope(d));
});

const status = store.status();
await write('meta.json', envelope({ exported_at: new Date().toISOString(), ...status }));
console.log(`Exported ${matches.length} matches (${withDetails.length} with channels), ${status.counts.competitions} competitions, ${status.counts.satellites} satellites to ${out}`);
if (status.recent_issues.length) console.log(`${status.recent_issues.length} source issue(s); see meta.json`);
