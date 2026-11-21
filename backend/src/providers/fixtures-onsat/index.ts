import { config } from '../../config.js';
import { fetchText, mapLimit } from '../../utils/http.js';
import type { Feed } from '../../models/types.js';
import type { FixturesProvider, RawCompetition, RawFixture, RawMatchDetails, RawSatellite } from '../types.js';
import {
  parseCompetitionIndex,
  parseCompetitionPage,
  parseFeedsPage,
  parseMatchPage,
  parseSatelliteIndex,
  parseSatellitePage,
  parseSchedulePage,
  type Parsed,
} from './parsers.js';

/**
 * Provider for the data behind the Fixtures ONSAT Android app.
 *
 * The APK (on.sat.fixtures, Solodroid "WebDroidX" template) only loads a
 * remote config from https://muntiijuh.com/fixtures/api/api.php whose single
 * menu entry opens https://fixturessat.blogspot.com/p/index_1.html in a
 * WebView. All football data lives in these public Blogger pages.
 */
export const SCHEDULE_PAGES = ['match1', 'match2', 'match3'];
const COMPETITION_INDEX = 'league_7';
const SATELLITE_INDEX = 'satallites_7';
const FEEDS_PAGE = 'feed_7';

export class FixturesOnsatProvider implements FixturesProvider {
  readonly name = 'fixtures-onsat';

  constructor(
    private readonly baseUrl = config.sourceBaseUrl,
    private readonly report: (warning: string) => void = () => {},
  ) {}

  publicUrl(path: string): string {
    return `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  }

  private async page<T>(path: string, parse: (html: string) => Parsed<T>): Promise<T> {
    const { value, warnings } = parse(await fetchText(this.publicUrl(path)));
    for (const w of new Set(warnings)) this.report(`${path}: ${w}`);
    return value;
  }

  async fetchSchedule(): Promise<RawFixture[]> {
    const results = await mapLimit(SCHEDULE_PAGES, config.sourceConcurrency, (p) => this.page(`/p/${p}.html`, parseSchedulePage));
    const failed = results.filter((r) => !r.ok);
    if (failed.length === results.length) throw (failed[0] as { error: unknown }).error;
    for (const f of failed) this.report(`/p/${f.item}.html: ${String((f as { error: unknown }).error)}`);
    return results.flatMap((r) => (r.ok ? r.value : []));
  }

  async fetchCompetitions(): Promise<RawCompetition[]> {
    const index = await this.page(`/p/${COMPETITION_INDEX}.html`, parseCompetitionIndex);
    const results = await mapLimit(index, config.sourceConcurrency, (c) =>
      this.page(`/p/${c.id}.html`, (html) => parseCompetitionPage(html, c.id)),
    );
    return results.map((r) => {
      const base = r.item;
      if (!r.ok) {
        this.report(`/p/${base.id}.html: ${String(r.error)}`);
        return { ...base, season: null, fixtures: [] };
      }
      // The index card name/logo is the canonical display (page heroes vary).
      return { ...r.value, id: base.id, name: base.name, logo: base.logo ?? r.value.logo, category: base.category };
    });
  }

  async fetchSatellites(): Promise<RawSatellite[]> {
    const index = await this.page(`/p/${SATELLITE_INDEX}.html`, parseSatelliteIndex);
    const results = await mapLimit(index, config.sourceConcurrency, (s) => this.page(`/p/${s.id}.html`, parseSatellitePage));
    return results.map((r) => {
      if (!r.ok) this.report(`/p/${r.item.id}.html: ${String(r.error)}`);
      return { ...r.item, channels: r.ok ? r.value : [] };
    });
  }

  fetchFeeds(): Promise<Feed[]> {
    return this.page(`/p/${FEEDS_PAGE}.html`, parseFeedsPage);
  }

  fetchMatchDetails(detailPath: string): Promise<RawMatchDetails> {
    return this.page(detailPath, parseMatchPage);
  }
}
