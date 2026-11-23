import { describe, expect, it } from 'vitest';
import {
  parseCompetitionIndex,
  parseCompetitionPage,
  parseFeedsPage,
  parseMatchPage,
  parseSatelliteIndex,
  parseSatellitePage,
  parseSchedulePage,
  parseTuning,
} from '../src/providers/fixtures-onsat/parsers.js';
import * as html from './fixtures/html.js';

describe('parseSchedulePage', () => {
  const { value, warnings } = parseSchedulePage(html.schedulePage);

  it('parses match rows under their league header', () => {
    expect(value).toHaveLength(2);
    expect(value[0]).toMatchObject({
      kickoff: '2026-11-21T12:30:00.000Z',
      home: { name: 'الفريق أ', logo: expect.stringContaining('AAAAAAAA') },
      away: { name: 'الفريق ب' },
      competition: { id: 'england-premier-league', name: 'الدوري الإنجليزي', logo: 'https://img.test/pl.png' },
      detailPath: '/2026/11/home-a-vs-away-b.html',
      mainChannelLogo: 'https://img.test/be1.png',
      scoreRef: { eventId: '1001', league: 'eng.1' },
    });
    expect(value[1]!.scoreRef).toBeNull();
  });

  it('reports malformed rows as warnings instead of failing', () => {
    expect(warnings).toContain('match-row without two .m-team-line elements');
  });

  it('keeps finished rows that show the score instead of data-utc', () => {
    const page = `<div class="matches-container">
      <a class="league-row" href="/p/portugal-cup.html"><div class="m-team-line"><span>كأس البرتغال</span></div></a>
      <a class="match-row" data-espn-id="401931822" href="/2026/11/torreense-vs-benfica.html">
        <div class="m-teams">
          <div class="m-team-line"><img src="https://img.test/t.png"> <span>تورينسي</span></div>
          <div class="m-team-line"><img src="https://img.test/b.png"> <span>بنفيكا</span></div>
        </div>
        <div class="score-vertical"style="margin-left: 10px;"> <span class="score-home">1</span> <span class="score-away">3</span> </div>
      </a>
      <a class="match-row" href="#"><div class="m-teams">
          <div class="m-team-line"><span>أ</span></div><div class="m-team-line"><span>ب</span></div>
        </div><div class="score-vertical"><span class="score-home">0</span><span class="score-away">0</span></div></a>
    </div>`;
    const r = parseSchedulePage(page);
    expect(r.value).toHaveLength(1);
    expect(r.value[0]).toMatchObject({
      kickoff: null,
      detailPath: '/2026/11/torreense-vs-benfica.html',
      finalScore: { home: 1, away: 3 },
      competition: { id: 'portugal-cup' },
    });
    // Without a detail page there is no way to date it.
    expect(r.warnings).toContain('match-row without a valid data-utc');
  });
});

describe('competition pages', () => {
  it('parses the index with categories and ignores commented-out cards', () => {
    const { value } = parseCompetitionIndex(html.competitionIndex);
    expect(value).toEqual([{ id: 'england-premier-league', name: 'الدوري الإنجليزي', logo: 'https://img.test/pl.png', category: 'البطولات الإنجليزية' }]);
  });

  it('parses full-season fixtures with round labels', () => {
    const { value } = parseCompetitionPage(html.competitionPage, 'england-premier-league');
    expect(value.season).toBe('2026 . 2027');
    expect(value.fixtures.map((f) => f.round)).toEqual(['الجولة 1', 'الجولة 11']);
    expect(value.fixtures[0]!.detailPath).toBeNull();
  });
});

describe('parseMatchPage', () => {
  const { value } = parseMatchPage(html.matchPage);
  it('extracts kickoff, badge, watch-on and treats "غير متوفر" as no commentator', () => {
    expect(value.kickoff).toBe('2026-11-21T12:30:00.000Z');
    expect(value.competitionName).toBe('الدوري الإنجليزي');
    expect(value.round).toBe('الجولة 11');
    expect(value.watchOn).toEqual({ name: 'beIN SPORTS 1', logo: 'https://img.test/be1.png' });
    expect(value.commentator).toBeNull();
  });
  it('extracts channels with decoded tuning and lock/sharing flags', () => {
    expect(value.channels).toHaveLength(2);
    expect(value.channels[0]).toMatchObject({
      name: 'beIN SPORTS 1 Qatar',
      satellite: 'Nilesat 7°W',
      frequency: 12188,
      polarization: 'H',
      symbol_rate: 27500,
      encrypted: true,
      sharing_supported: false,
      quality: 'HD',
    });
    expect(value.channels[1]).toMatchObject({ encrypted: false, sharing_supported: true });
  });
});

describe('satellites and feeds', () => {
  it('parses satellite index regions and channels', () => {
    expect(parseSatelliteIndex(html.satelliteIndex).value).toEqual([
      { id: 'nilesat', name: 'Nilesat 7°W', region: 'أقمار الغرب' },
      { id: 'badr26e', name: 'Badr 26°E', region: 'أقمار الشرق' },
    ]);
    expect(parseSatellitePage(html.satellitePage).value[0]).toMatchObject({ name: 'beIN SPORTS Qatar', frequency: 11054 });
  });
  it('parses only live (non-commented) feed cards', () => {
    const feeds = parseFeedsPage(html.feedsPage).value;
    expect(feeds).toHaveLength(1);
    expect(feeds[0]).toMatchObject({ satellite: 'Hotbird 13°E', frequency: 11070, polarization: 'V', symbol_rate: 7200, encryption: 'FTA', home_team: { name: 'بورتو' } });
  });
  it('parseTuning degrades gracefully on unexpected strings', () => {
    expect(parseTuning('Some Sat - unknown')).toEqual({ satellite: 'Some Sat', frequency: null, polarization: null, symbol_rate: null });
  });
});
