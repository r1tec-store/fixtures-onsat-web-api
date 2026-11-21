/**
 * Trimmed HTML samples reproducing the structure of the live source pages
 * (fixturessat.blogspot.com) as observed on 2026-11-21. Team/channel values
 * are illustrative test fixtures, not served by the API.
 */
export const schedulePage = `
<div class="matches-container">
  <a href="/p/england-premier-league.html" class="league-row">
    <div class="m-logo-bein"><div class="ch-logo-box"><img src="https://img.test/pl.png"></div></div>
    <div class="m-teams"><div class="m-team-line"><span>الدوري الإنجليزي</span></div></div>
  </a>
  <a href="/2026/11/home-a-vs-away-b.html" class="match-row" data-espn-id="1001" data-espn-league="eng.1">
    <div class="m-logo-bein"><div class="m-logo-channel"><img src="https://img.test/be1.png"></div></div>
    <div class="m-teams">
      <div class="m-team-line"><img src="https://static.flashscore.com/res/image/data/AAAAAAAA-x1.png"> <span>الفريق أ</span></div>
      <div class="m-team-line"><img src="https://static.flashscore.com/res/image/data/BBBBBBBB-x2.png"> <span>الفريق ب</span></div>
    </div>
    <div class="m-time-left match-time-display" data-utc="2026-11-21T12:30:00Z">--:--</div>
  </a>
  <a href="/2026/11/home-c-vs-away-d.html" class="match-row">
    <div class="m-teams">
      <div class="m-team-line"><img src="https://static.flashscore.com/res/image/data/CCCCCCCC-x3.png"> <span>الفريق ج</span></div>
      <div class="m-team-line"><img src="https://static.flashscore.com/res/image/data/DDDDDDDD-x4.png"> <span>الفريق د</span></div>
    </div>
    <div class="m-time-left match-time-display" data-utc="2026-11-21T20:00:00Z">--:--</div>
  </a>
  <a href="#" class="match-row"><div class="m-teams"><div class="m-team-line"><span>X</span></div></div></a>
</div>`;

export const competitionIndex = `
<div class="section-title">البطولات الإنجليزية</div>
<div class="leagues-container">
  <a href="/p/england-premier-league.html" class="league-card">
    <div class="league-info"><div class="league-logo-box"><img src="https://img.test/pl.png"><img src="https://img.test/pl-dark.png"></div>
    <span class="league-name">الدوري الإنجليزي</span></div>
  </a>
  <!-- <a href="/p/hidden.html" class="league-card"><span class="league-name">Hidden</span></a> -->
</div>`;

export const competitionPage = `
<div class="hero-card"><div class="hero-logo-box"><img src="https://img.test/pl-hero.png"></div>
<div class="hero-titles"><h1>الدوري الإنجليزي</h1><p>2026 . 2027</p></div></div>
<span class="s-tab" data-round="round1">الجولة 1</span><span class="s-tab" data-round="round11">الجولة 11</span>
<div id="round1" class="round-content">
  <div class="date-header">الجمعة 21 - 8 - 2026</div>
  <a href="#" class="match-row"><div class="m-teams">
    <div class="m-team-line"><img src="https://static.flashscore.com/res/image/data/EEEEEEEE-x.png"> <span>الفريق هـ</span></div>
    <div class="m-team-line"><img src="https://static.flashscore.com/res/image/data/FFFFFFFF-x.png"> <span>الفريق و</span></div>
  </div><div class="m-time-left" data-utc="2026-08-21T19:00:00Z"></div></a>
</div>
<div id="round11" class="round-content">
  <a href="#" class="match-row"><div class="m-teams">
    <div class="m-team-line"><img src="https://static.flashscore.com/res/image/data/AAAAAAAA-x1.png"> <span>الفريق أ (اسم آخر)</span></div>
    <div class="m-team-line"><img src="https://static.flashscore.com/res/image/data/BBBBBBBB-x2.png"> <span>الفريق ب</span></div>
  </div><div class="m-time-left" data-utc="2026-11-21T12:30:00Z"></div></a>
</div>`;

const card = (name: string, tuning: string, lock: string, sharing = false) => `
<div class="broadcast-card">
  <div class="broadcast-info-grid"><div class="grid-hd"><span class="broadcast-quality">HD</span></div>
  <div class="grid-lock"><img src="https://img.test/${lock}.png" class="lock-icon"></div>
  ${sharing ? '<div class="grid-sharing"><img src="https://img.test/sharinginfo.png"></div>' : ''}</div>
  <div class="broadcast-details"><span class="broadcast-name">${name}</span><span class="broadcast-frequency">${tuning}</span></div>
  <img src="https://img.test/logo.png" class="broadcast-logo">
</div>`;

export const matchPage = `
<div class="league-badge"><span class="worldcup-logo-box"><img src="x.png"></span>
  <div><span>الدوري الإنجليزي</span><span>الجولة 11</span></div></div>
<div id="watch-sec">
  <div class="section-title">القناة العربية</div>
  <div class="watch-card"><img src="https://img.test/be1.png" class="w-logo"><div class="w-info"><span class="w-name">beIN SPORTS 1</span></div></div>
  <div class="section-title">المعلق</div>
  <div class="watch-card"><img src="https://img.test/be1.png" class="w-logo"><div class="w-info"><span class="w-name">غير متوفر</span></div></div>
</div>
<div id="broadcast-sec">
  ${card('beIN SPORTS 1 Qatar', 'Nilesat 7&#176;W - 12188 H 27500', 'lock')}
  ${card('Free Sport', 'Badr 26°E - 12130 V 27500', 'unlock', true)}
</div>
<script>const matchDateTime = "2026-11-21T12:30:00Z";</script>`;

export const satelliteIndex = `
<div class="section-title">أقمار الغرب</div>
<div class="satellites-container">
  <a href="/p/nilesat.html" class="sat-card"><div class="sat-info"><span class="sat-name">Nilesat 7°W</span></div></a>
</div>
<div class="section-title">أقمار الشرق</div>
<a href="/p/badr26e.html" class="sat-card"><span class="sat-name">Badr 26°E</span></a>`;

export const satellitePage = `<div class="channels-container">${card('beIN SPORTS Qatar', 'Nilesat 7°W - 11054 H 27500', 'unlock')}</div>`;

export const feedsPage = `
<div class="feeds-container">
  <!-- <div class="channel-full-card"><span class="cf-name">Commented 1 - 1 H 1</span></div> -->
  <div class="channel-full-card">
    <div class="cf-top"><div class="cf-info"><span class="cf-name">Hotbird 13°E - 11070 V 7200</span><span class="cf-freq">Biss : FTA</span></div></div>
    <div class="cf-bottom"><div class="cf-bottom-item"><img src="https://img.test/a.png"><span>بورتو</span></div>
    <div class="cf-bottom-item"><span>باريديس</span><img src="https://img.test/b.png"></div></div>
  </div>
</div>`;
