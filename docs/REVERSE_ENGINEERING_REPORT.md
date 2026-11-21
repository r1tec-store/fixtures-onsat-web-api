# Fixtures ONSAT 2.0.0 — Reverse Engineering Report

Analysis date: 2026-11-21. Sample: `Fixtures+ONSAT_2.0.0_APKPure.apk` (25.9 MB, not committed to this repository).
Tools: `unzip`, Python string extraction, **androguard 4.1.4** (manifest, DEX decompilation, Retrofit annotation extraction), `curl`, a browser for page inspection.
JADX/APKTool were not installed and were not needed: androguard recovered all of the app's own code. Only public, unauthenticated endpoints were requested; no protection was bypassed.

## 1. Summary

**Fixtures ONSAT is a WebView shell.** The Android app contains no football logic. It is built on the commercial
*Solodroid "WebDroidX — Android WebView App"* template. At startup it downloads a remote config whose one menu item
opens a public **Blogger site, `https://fixturessat.blogspot.com/p/index_1.html`**, in a WebView. All fixtures,
competitions and broadcast channels live in hand-maintained HTML pages on that blog. The pages load live scores
in the browser from **ESPN's public scoreboard JSON**, matched with an ESPN event id that is stored on each fixture row.

```
APK (on.sat.fixtures)
 └─ ActivitySplash ──GET──> https://muntiijuh.com/fixtures/api/api.php?application_id=on.sat.fixtures   (WebDroidX admin panel)
      config.menus[0].url = https://fixturessat.blogspot.com/p/index_1.html
 └─ MainActivity / FragmentWebView ──loads──> fixturessat.blogspot.com  (all UI + data)
                                                  ├─ /p/match1|2|3.html        daily schedule (data-utc, data-espn-id)
                                                  ├─ /YYYY/MM/<home>-vs-<away>.html  match page: channels + frequencies
                                                  ├─ /p/league_7.html + /p/<league>.html  competitions, full season
                                                  ├─ /p/satallites_7.html + /p/<sat>.html  channel lists per satellite
                                                  └─ JS ──> site.api.espn.com/.../soccer/all/scoreboard (via a CORS proxy worker)
```

## 2. Application identity & architecture

| Item | Value |
|---|---|
| Package | `on.sat.fixtures` |
| Version | 2.0.0 (versionCode 12), release build |
| SDK | min 21, target 35 |
| Code base | `com.app.webdroidx.*` (Solodroid WebDroidX template), Kotlin/Java, 5 DEX files |
| Launcher | `com.app.webdroidx.activities.ActivitySplash` |
| Activities (app) | `ActivitySplash`, `MainActivity`, `ActivityWebView`, `ActivitySettings`, `ActivityRedirect` (+ 11 SDK activities) |
| Fragments | `FragmentWebView` |
| WebView | `AdvancedWebView`, `VideoEnabledWebView`, `VideoEnabledWebChromeClient`, `WebAppInterface` (JS bridge) |
| Local storage | `SharedPref`, `AdsPref` (SharedPreferences), `DbNavigation` (SQLite cache of the menu) |
| Networking | Retrofit2 + OkHttp3 + Gson (config only); jsoup is bundled |
| Signing | `META-INF/BNDLTOOL.RSA` (repackaged by the APKPure bundle tool) |

### Navigation / screens (native)
1. **Splash.** Reads the config, stores the menu in SQLite, may show an app-open ad.
2. **Main.** A WebView with optional toolbar and drawer. Both are disabled by the remote config (`toolbar:0`, `navigation_drawer:0`), so the user sees only the web page.
3. **Settings.** Theme, privacy policy (`assets/html/{light,dark}[_rtl].html`), "more apps".
4. **Redirect.** Used when the remote config sets `app.status = 0` ("suspended") and gives a `redirect_url`.

Every visible feature (schedule, live, match details, leagues, satellites, feeds, favourite club or satellite, settings)
is **web content**. That is why the reconstruction targets the web pages, not native screens.

## 3. Discovered endpoints (all verified 2026-11-21)

### 3.1 Remote config (the app's only native API)
The base URL is obfuscated in `Config.SERVER_KEY`:
`MkzVBvyZ2aU2ESAd2Q` + base64(`https://muntiijuh.com/fixtures_applicationId_on.sat.fixtures`).
`Tools.decodeJson()` strips the prefix, decodes the string, then splits it on `_applicationId_`. `RestAdapter` appends `/api/`.
The Retrofit annotation (read from the DEX annotation directory) is `@GET("api.php")` with the headers
`Data-Agent: WebDroidX` and `Cache-Control: max-age=0`.

```
GET https://muntiijuh.com/fixtures/api/api.php?application_id=on.sat.fixtures   → 200 application/json
```
Response shape (`CallbackConfig`): `{status, app{application_id,status,redirect_url}, menus[], ads{…}, ads_placement{…}, settings{…}}`.
Relevant live values: `menus = [{name:"Home", type:"url", url:"https://fixturessat.blogspot.com/p/index_1.html", target:"internal"}]`,
`settings.notification_provider = "firebase"`, `fcm_notification_topic = "webdroidx_topic"`, `onesignal_app_id = 0`.
The config carries ad-network unit IDs only. It holds no football data.

### 3.2 Football data: `fixturessat.blogspot.com` (public HTML)
| Page | Content | Key markup |
|---|---|---|
| `/p/index_1.html` | Home: links to 3 day pages, "top matches", favourite club/satellite pickers, settings | `LM_MATCHES` JS array, `day-circle-btn` |
| `/p/match1.html`, `/p/match2.html`, `/p/match3.html` | Today / tomorrow / day after, grouped by league | `.league-row[href=/p/<league>.html]`, `.match-row[href][data-espn-id][data-espn-league]`, `.m-team-line img+span` ×2, `.m-time-left[data-utc]`, `.m-logo-channel img` |
| `/YYYY/MM/<home>-vs-<away>.html` | Match page | `.league-badge span` (league, round), `#watch-sec` (Arabic channel, commentator), `#broadcast-sec .broadcast-card`, `const matchDateTime = "…Z"` |
| `/p/league_7.html` | Competition index, by category | `.section-title`, `a.league-card` (`.league-name`, `.league-logo-box img`) |
| `/p/<league>.html` (31) | Full-season fixtures by round, standings tab | `.hero-titles h1/p`, `[data-round]` tabs, `.round-content#roundN .match-row` |
| `/p/satallites_7.html` | Satellites by region | `.section-title`, `a.sat-card .sat-name` |
| `/p/<satellite>.html` (27) | Channels on that satellite | `.broadcast-card` |
| `/p/feed_7.html` | Temporary feed transponders | `.channel-full-card` (`.cf-name`, `.cf-freq`, `.cf-bottom-item`) (all were commented out on the analysis date) |
| `/p/freechannel_7.html`, `/p/broadcaster_7.html` | Free-to-air schedule, rights holders per competition | `a.sat-card`, `a.league-card` linking to more pages |

Broadcast card fields: `.broadcast-name`, `.broadcast-frequency` (`"<Satellite> - <freq> <H|V> <SR>"`, e.g. `Nilesat 7°W - 12418 H 30000`),
`.broadcast-quality` (HD/SD), `.lock-icon` (`lock.png` = encrypted, `unlock.png` = FTA), `.grid-sharing img` = works with "sharing info".

The Blogger GData feeds are public too (`/feeds/posts/default?alt=json`, `/feeds/pages/default?alt=json`). They return the same HTML inside JSON (2,388 posts and 145 pages on the analysis date). The provider fetches the rendered pages instead, because the feed cannot look up a page by path.

### 3.3 Live scores: ESPN public site API
The day pages hold this config: `base: https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard`. The browser goes through a proxy
(`espn-proxy.wasembanat15.workers.dev`) only because of CORS. There is a per-league fallback `…/soccer/<data-espn-league>/scoreboard`.
A `live-minutes…workers.dev` worker (API-Football) supplies match minutes. League pages also use ESPN standings via `league-standings…workers.dev`.

Verified: `GET https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard?dates=20261121` → 200 with 100 events.
Event `401879233` (`data-espn-id` of Man City vs Fulham on `/p/match1.html`) returned `STATUS_FULL_TIME`, 1–1.
We call ESPN server-side, so no proxy is needed. The `*.workers.dev` proxies belong to the site owner and are **not** used.

### 3.4 Assets
`assets/font/custom_font.ttf`, `assets/html/*` (privacy policy templates), `res/` launcher/splash drawables.
Web assets (logos and icons) are hot-linked by the blog from `fixturesonsat-de2.pages.dev`, `images-4cf.pages.dev` (channel logos),
`static.flashscore.com` (team crests), `img.uefa.com` (flags) and `crests.football-data.org`. **None are copied into this repository.**
The API returns their URLs exactly as the source publishes them.

## 4. Third-party SDKs found
Firebase (Analytics, Messaging/FCM, Installations), OneSignal (incl. HMS) for push, Google Mobile Ads + UMP consent,
Meta Audience Network (`assets/audience_network.dex`), AppLovin, Unity Ads, StartApp, IronSource, Wortise (unit IDs come from the config),
WorkManager, Room, Glide (`com.bumptech`), Retrofit/OkHttp/Gson, jsoup, Kotlin coroutines, `solodroid.ads.sdk`, `solodroid.push.sdk`.
Background components: `MyFirebaseMessageService` (FCM topic `webdroidx_topic`), OneSignal `SyncJobService`, WorkManager jobs.
None of these touch football data.

## 5. Data model observed
- **Fixture**: home/away (Arabic name + crest URL), kickoff (UTC ISO in `data-utc`), competition (from the preceding league row),
  ESPN event id + league code (day pages only), detail page path (day pages only), main channel logo.
- **Match page**: league name, round, Arabic broadcaster (+logo), commentator ("غير متوفر" = none), N channels with full DVB-S tuning.
- **Status logic in the original**: "live" if `now` is in [kickoff, kickoff + 120 min), else "ended" or the time. Real status and score come from ESPN when it is available.
- **No scores are stored at the source.** Scores exist only through ESPN.

## 6. Native features vs web reconstruction
| Original | Web reconstruction |
|---|---|
| WebView of the blog | Native React UI over our own normalized API |
| FCM/OneSignal push | **Not reproduced.** Browser push would need a push service and user consent. Clients can poll `/matches/live`. |
| Ads (AdMob etc.) | **Not reproduced** (intentionally). |
| App-open / suspend / redirect via remote config | Not applicable |
| Favourite club / satellite, theme, 12/24h (localStorage) | Reproduced (favourite club, theme, 12/24h, sort by satellite) |
| Live minute from API-Football worker | ESPN `displayClock` is used instead. The worker is private to the site owner. |
| League standings (ESPN via the owner's worker) | **Not reproduced** in v1. ESPN standings could be added as another provider. |
| Free-channel schedule / broadcaster-rights pages | Not reproduced in v1 (same page structures as satellites/leagues; easy to add). |
| Copy / select / right-click blocking JS | Not reproduced (deliberately). |

## 7. Limitations & open questions
- The blog is **edited by hand**. Fixtures appear only after the admin adds them, and team names are Arabic, with spellings that vary between pages.
  Team identity therefore uses the stable Flashscore crest id inside the logo URL (e.g. `UXcqj7HG`).
- Only day-page fixtures carry an ESPN id. Season fixtures from league pages get **estimated** status and no score (`status_source: "estimated"`).
- The ESPN API is undocumented and unofficial. It may change or rate-limit without notice. It is treated as best-effort enrichment.
- One `.match-row` on `match1` had no `data-utc`, and one `league-card` had no link. Both are skipped and reported in `/api/v1/status`.
- **Terms and rights:** the blog's content and the ESPN data belong to their owners. This project keeps attribution (`source`, `source_url`),
  rate-limits and caches its upstream requests, and does not mirror any images. Check the terms that apply before any commercial use.
- Not verified: how the blog admin produces the pages (likely by hand or with a private tool). No admin API was probed.
