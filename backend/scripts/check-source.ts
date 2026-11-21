/**
 * Live check that the original data sources still work and still have the
 * structure our parsers expect. Exits 1 when a required source is broken.
 *
 *   npm run check:source
 */
import { config } from '../src/config.js';
import { fetchJson } from '../src/utils/http.js';
import { FixturesOnsatProvider } from '../src/providers/fixtures-onsat/index.js';
import { EspnScoresProvider } from '../src/providers/espn/index.js';

const warnings: string[] = [];
const provider = new FixturesOnsatProvider(config.sourceBaseUrl, (w) => warnings.push(w));
let failed = false;

async function check(name: string, required: boolean, fn: () => Promise<string>) {
  const t = Date.now();
  try {
    const info = await fn();
    console.log(`PASS  ${name} (${Date.now() - t} ms) ${info}`);
  } catch (err) {
    console.log(`${required ? 'FAIL' : 'WARN'}  ${name}: ${err instanceof Error ? err.message : String(err)}`);
    if (required) failed = true;
  }
}

let firstDetail: string | null = null;
let espnRef: { eventId: string; date: string } | null = null;

await check('APK remote config (muntiijuh.com api.php)', false, async () => {
  const cfg = await fetchJson<{ status: string; menus: Array<{ url: string }> }>(
    'https://muntiijuh.com/fixtures/api/api.php?application_id=on.sat.fixtures',
  );
  return `status=${cfg.status} home=${cfg.menus?.[0]?.url}`;
});

await check('Daily schedule pages', true, async () => {
  const fixtures = await provider.fetchSchedule();
  if (!fixtures.length) throw new Error('no fixtures parsed');
  firstDetail = fixtures.find((f) => f.detailPath)?.detailPath ?? null;
  const ref = fixtures.find((f) => f.scoreRef);
  if (ref) espnRef = { eventId: ref.scoreRef!.eventId, date: ref.kickoff.slice(0, 10) };
  return `${fixtures.length} fixtures, ${fixtures.filter((f) => f.scoreRef).length} with ESPN ids`;
});

await check('Match detail page (channels)', true, async () => {
  if (!firstDetail) throw new Error('no detail page linked from schedule');
  const d = await provider.fetchMatchDetails(firstDetail);
  if (!d.channels.length) throw new Error(`no channels on ${firstDetail}`);
  return `${firstDetail}: ${d.channels.length} channels`;
});

await check('Competitions', true, async () => {
  const c = await provider.fetchCompetitions();
  return `${c.length} competitions, ${c.reduce((n, x) => n + x.fixtures.length, 0)} fixtures`;
});

await check('Satellites', true, async () => {
  const s = await provider.fetchSatellites();
  return `${s.length} satellites, ${s.reduce((n, x) => n + x.channels.length, 0)} channels`;
});

await check('Feeds page', false, async () => `${(await provider.fetchFeeds()).length} feeds`);

await check('ESPN scoreboard (live scores)', false, async () => {
  if (!espnRef) throw new Error('no ESPN-linked fixture to test');
  const s = await new EspnScoresProvider().fetchScores([espnRef.date], [], new Set([espnRef.eventId]));
  return `${s.size} events; linked event ${espnRef.eventId} ${s.has(espnRef.eventId) ? 'found' : 'NOT found'}`;
});

if (warnings.length) {
  console.log(`\n${warnings.length} structural warning(s):`);
  for (const w of [...new Set(warnings)].slice(0, 20)) console.log(`  - ${w}`);
}
process.exit(failed ? 1 : 0);
