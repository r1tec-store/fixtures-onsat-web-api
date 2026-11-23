/**
 * Parsers for the public Blogger pages that the Fixtures ONSAT app renders
 * in its WebView (https://fixturessat.blogspot.com). Each parser is pure
 * (HTML in, raw records out) so it can be unit-tested against fixtures and
 * reports structural problems via `warnings` instead of throwing.
 */
import * as cheerio from 'cheerio';
import type { Cheerio, CheerioAPI } from 'cheerio';
import type { AnyNode, Element } from 'domhandler';
import type { Channel, Feed } from '../../models/types.js';
import type { RawCompetition, RawFixture, RawMatchDetails, RawSatellite } from '../types.js';
import { shortHash, slugify } from '../../utils/ids.js';

export interface Parsed<T> {
  value: T;
  warnings: string[];
}

const txt = (el: Cheerio<AnyNode>) => el.first().text().replace(/\s+/g, ' ').trim();
const attr = (el: Cheerio<AnyNode>, name: string) => el.first().attr(name)?.trim() || null;

/** "/p/england-premier-league.html" -> "england-premier-league" */
export function pageSlug(href: string | null | undefined): string | null {
  const m = href?.match(/\/p\/([^/?#]+)\.html/);
  return m ? m[1]! : null;
}

/** "/2026/11/manchester-city-vs-fulham.html" (or absolute URL) -> path, "#"/"" -> null */
export function detailPath(href: string | null | undefined): string | null {
  if (!href) return null;
  const m = href.match(/(\/\d{4}\/\d{2}\/[^/?#]+\.html)/);
  return m ? m[1]! : null;
}

function isoUtc(raw: string | null): string | null {
  if (!raw) return null;
  const t = Date.parse(raw);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

/**
 * A schedule row whose kickoff is not on the list page yet. Finished matches
 * replace the `data-utc` time with a `.score-vertical` block, so the kickoff
 * must be read from the match's detail page (`matchDateTime`).
 */
export type ScheduleRow = Omit<RawFixture, 'kickoff'> & { kickoff: string | null };

function rowScore(row: Cheerio<Element>): RawFixture['finalScore'] {
  const n = (sel: string) => {
    const v = row.find(sel).first().text().trim();
    return /^\d+$/.test(v) ? Number(v) : null;
  };
  const home = n('.score-home');
  const away = n('.score-away');
  return home !== null && away !== null ? { home, away } : null;
}

function parseMatchRow($: CheerioAPI, row: Cheerio<Element>, competition: RawFixture['competition'], round: string | null, warnings: string[]): ScheduleRow | null {
  const lines = row.find('.m-team-line');
  if (lines.length < 2) {
    warnings.push('match-row without two .m-team-line elements');
    return null;
  }
  const team = (i: number) => {
    const line = lines.eq(i);
    return { name: txt(line.find('span')), logo: attr(line.find('img'), 'src') };
  };
  const anchor = row.is('a') ? row : row.closest('a');
  const path = detailPath(anchor.attr('href'));
  const finalScore = rowScore(row);
  const kickoff = isoUtc(attr(row.find('[data-utc]'), 'data-utc'));
  if (!kickoff && !(finalScore && path)) {
    warnings.push('match-row without a valid data-utc');
    return null;
  }
  const home = team(0);
  const away = team(1);
  if (!home.name || !away.name) {
    warnings.push('match-row with empty team name');
    return null;
  }
  const eventId = row.attr('data-espn-id')?.trim();
  return {
    kickoff,
    home,
    away,
    competition,
    round,
    detailPath: path,
    mainChannelLogo: attr(row.find('.m-logo-channel img'), 'src'),
    scoreRef: eventId ? { eventId, league: row.attr('data-espn-league')?.trim() || null } : null,
    finalScore,
  };
}

function withKickoff(row: ScheduleRow | null, warnings: string[]): RawFixture | null {
  if (!row) return null;
  if (row.kickoff) return row as RawFixture;
  warnings.push('match-row without a valid data-utc');
  return null;
}

/**
 * Daily schedule pages (/p/match1.html ...): league header rows followed by match rows.
 * Finished matches come back with `kickoff: null` (see ScheduleRow); the provider
 * resolves them from the detail page.
 */
export function parseSchedulePage(html: string): Parsed<ScheduleRow[]> {
  const $ = cheerio.load(html);
  const warnings: string[] = [];
  const out: ScheduleRow[] = [];
  let competition: RawFixture['competition'] = null;
  $('.league-row, .match-row').each((_, el) => {
    const node = $(el);
    if (node.hasClass('league-row')) {
      const name = txt(node.find('.m-team-line span, span'));
      const slug = pageSlug(node.attr('href'));
      competition = name ? { id: slug ?? slugify(name) ?? shortHash(name), name, logo: attr(node.find('img'), 'src') } : null;
      return;
    }
    const f = parseMatchRow($, node, competition, null, warnings);
    if (f) out.push(f);
  });
  if (out.length === 0) warnings.push('schedule page contained no parsable match rows');
  return { value: out, warnings };
}

/** Competition index (/p/league_7.html): category headers + league cards. */
export function parseCompetitionIndex(html: string): Parsed<Array<{ id: string; name: string; logo: string | null; category: string | null }>> {
  const $ = cheerio.load(html);
  const warnings: string[] = [];
  const out: Array<{ id: string; name: string; logo: string | null; category: string | null }> = [];
  let category: string | null = null;
  $('.section-title, a.league-card').each((_, el) => {
    const node = $(el);
    if (node.hasClass('section-title')) {
      category = txt(node) || null;
      return;
    }
    const href = node.attr('href')?.trim();
    // Cards linked to "#" are placeholders for leagues without a page yet (the app shows them disabled).
    if (!href || href === '#') return;
    const id = pageSlug(href);
    const name = txt(node.find('.league-name'));
    if (!id || !name) {
      warnings.push('league-card without slug or name');
      return;
    }
    out.push({ id, name, logo: attr(node.find('.league-logo-box img'), 'src'), category });
  });
  if (out.length === 0) warnings.push('competition index contained no league cards');
  return { value: out, warnings };
}

/** A competition page: hero header + round tabs with full-season fixtures. */
export function parseCompetitionPage(html: string, id: string): Parsed<Omit<RawCompetition, 'category'>> {
  const $ = cheerio.load(html);
  const warnings: string[] = [];
  const name = txt($('.hero-titles h1')) || txt($('.c-center .c-team'));
  const logo = attr($('.hero-logo-box img'), 'src');
  const season = txt($('.hero-titles p')) || null;
  const competition = { id, name: name || id, logo };
  const roundLabels = new Map<string, string>();
  $('[data-round]').each((_, el) => {
    const key = $(el).attr('data-round');
    const label = txt($(el));
    if (key && label && !roundLabels.has(key)) roundLabels.set(key, label);
  });
  const fixtures: RawFixture[] = [];
  const seen = new Set<Element>();
  $('.round-content').each((_, el) => {
    const roundId = $(el).attr('id') ?? '';
    const round = roundLabels.get(roundId) ?? null;
    $(el)
      .find('.match-row')
      .each((__, row) => {
        seen.add(row);
        const f = withKickoff(parseMatchRow($, $(row), competition, round, warnings), warnings);
        if (f) fixtures.push(f);
      });
  });
  // Pages without round tabs (cups, groups) still list .match-row elements.
  $('.match-row').each((_, row) => {
    if (seen.has(row)) return;
    const f = withKickoff(parseMatchRow($, $(row), competition, null, warnings), warnings);
    if (f) fixtures.push(f);
  });
  if (!name) warnings.push(`competition page ${id} has no title`);
  return { value: { ...competition, season, fixtures }, warnings };
}

const TUNING_RE = /^(.*?)\s*-\s*(\d{4,5})\s*([HVLR])\s*(\d{3,5})\b/i;

export function parseTuning(raw: string): Pick<Channel, 'satellite' | 'frequency' | 'polarization' | 'symbol_rate'> {
  const m = raw.match(TUNING_RE);
  if (!m) return { satellite: raw.split(' - ')[0]?.trim() || null, frequency: null, polarization: null, symbol_rate: null };
  return {
    satellite: m[1]!.trim() || null,
    frequency: Number(m[2]),
    polarization: m[3]!.toUpperCase() as Channel['polarization'],
    symbol_rate: Number(m[4]),
  };
}

function parseBroadcastCards($: CheerioAPI, scope: Cheerio<AnyNode>): Channel[] {
  const out: Channel[] = [];
  scope.find('.broadcast-card').each((_, el) => {
    const card = $(el);
    const name = txt(card.find('.broadcast-name'));
    if (!name) return;
    const tuning = txt(card.find('.broadcast-frequency')) || null;
    const lock = attr(card.find('.lock-icon'), 'src');
    out.push({
      id: `c_${shortHash(`${name}|${tuning ?? ''}`)}`,
      name,
      logo: attr(card.find('.broadcast-logo'), 'src'),
      ...(tuning ? parseTuning(tuning) : { satellite: null, frequency: null, polarization: null, symbol_rate: null }),
      tuning,
      quality: txt(card.find('.broadcast-quality')) || null,
      encrypted: lock ? !/unlock/i.test(lock) : null,
      sharing_supported: card.find('.grid-sharing img').length > 0,
    });
  });
  return out;
}

/** Match post (/YYYY/MM/home-vs-away.html): league badge, "watch on", commentator, channels. */
export function parseMatchPage(html: string): Parsed<RawMatchDetails> {
  const $ = cheerio.load(html);
  const warnings: string[] = [];
  const badge = $('.league-badge span').filter((_, el) => $(el).children().length === 0 && txt($(el)) !== '');
  const kick = html.match(/matchDateTime\s*=\s*["']([^"']+)["']/);
  let watchOn: RawMatchDetails['watchOn'] = null;
  let commentator: string | null = null;
  $('#watch-sec .section-title').each((i, el) => {
    const card = $(el).nextAll('.watch-card').first();
    const name = txt(card.find('.w-name'));
    const available = name && name !== 'غير متوفر';
    if (i === 0 && available) watchOn = { name, logo: attr(card.find('.w-logo'), 'src') };
    if (i === 1 && available) commentator = name;
  });
  const scope = $('#broadcast-sec').length ? $('#broadcast-sec') : $.root();
  const channels = parseBroadcastCards($, scope);
  if (!kick) warnings.push('match page without matchDateTime');
  return {
    value: {
      kickoff: isoUtc(kick?.[1] ?? null),
      competitionName: badge.length ? txt(badge.eq(0)) : null,
      round: badge.length > 1 ? txt(badge.eq(1)) : null,
      watchOn,
      commentator,
      channels,
    },
    warnings,
  };
}

/** Satellite index (/p/satallites_7.html). */
export function parseSatelliteIndex(html: string): Parsed<Array<{ id: string; name: string; region: string | null }>> {
  const $ = cheerio.load(html);
  const warnings: string[] = [];
  const out: Array<{ id: string; name: string; region: string | null }> = [];
  let region: string | null = null;
  $('.section-title, a.sat-card').each((_, el) => {
    const node = $(el);
    if (node.hasClass('section-title')) {
      region = txt(node) || null;
      return;
    }
    const id = pageSlug(node.attr('href'));
    const name = txt(node.find('.sat-name'));
    if (id && name) out.push({ id, name, region });
  });
  if (out.length === 0) warnings.push('satellite index contained no satellites');
  return { value: out, warnings };
}

export function parseSatellitePage(html: string): Parsed<Channel[]> {
  const $ = cheerio.load(html);
  const channels = parseBroadcastCards($, $.root());
  return { value: channels, warnings: channels.length ? [] : ['satellite page contained no channels'] };
}

/** Feeds page (/p/feed_7.html): temporary feed transponders for matches. */
export function parseFeedsPage(html: string): Parsed<Feed[]> {
  const $ = cheerio.load(html);
  const out: Feed[] = [];
  $('.channel-full-card').each((_, el) => {
    const card = $(el);
    const tuning = txt(card.find('.cf-name'));
    if (!tuning) return;
    const t = parseTuning(tuning);
    const enc = txt(card.find('.cf-freq')).replace(/^.*?:\s*/, '') || null;
    const teams = card.find('.cf-bottom-item').map((__, it) => ({ name: txt($(it).find('span')), logo: attr($(it).find('img'), 'src') })).get();
    out.push({
      id: `f_${shortHash(tuning + teams.map((x) => x.name).join('|'))}`,
      tuning,
      satellite: t.satellite,
      frequency: t.frequency,
      polarization: t.polarization,
      symbol_rate: t.symbol_rate,
      encryption: enc,
      home_team: teams[0] ?? null,
      away_team: teams[1] ?? null,
    });
  });
  return { value: out, warnings: [] };
}
