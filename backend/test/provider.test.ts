import { afterEach, describe, expect, it, vi } from 'vitest';
import { FixturesOnsatProvider } from '../src/providers/fixtures-onsat/index.js';

const row = (inner: string, href: string) => `<a class="match-row" href="${href}"><div class="m-teams">
  <div class="m-team-line"><span>A</span></div><div class="m-team-line"><span>B</span></div></div>${inner}</a>`;

describe('FixturesOnsatProvider.fetchSchedule', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('dates finished matches from their detail page', async () => {
    const pages: Record<string, string> = {
      '/p/match1.html': row('<div class="score-vertical"><span class="score-home">2</span><span class="score-away">1</span></div>', '/2026/11/a-vs-b.html'),
      '/p/match2.html': row('<div data-utc="2026-11-24T18:00:00Z"></div>', '/2026/11/c-vs-d.html'),
      '/p/match3.html': '<div></div>',
      '/2026/11/a-vs-b.html': '<script>var matchDateTime = "2026-11-23T16:00:00Z";</script>',
    };
    const fetchMock = vi.fn(async (url: string) => {
      const body = pages[new URL(url).pathname];
      return new Response(body ?? '', { status: body === undefined ? 404 : 200 });
    });
    vi.stubGlobal('fetch', fetchMock);
    const p = new FixturesOnsatProvider('https://src.test');
    const out = await p.fetchSchedule();
    expect(out.map((f) => [f.kickoff, f.finalScore ?? null])).toEqual([
      ['2026-11-23T16:00:00.000Z', { home: 2, away: 1 }],
      ['2026-11-24T18:00:00.000Z', null],
    ]);
    // Cached: the detail page is not fetched again on the next sync.
    const calls = fetchMock.mock.calls.length;
    await p.fetchSchedule();
    expect(fetchMock.mock.calls.length).toBe(calls + 3);
  });
});
