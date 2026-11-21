# Fixtures ONSAT — Web App & Football Data API

A web reconstruction of the **Fixtures ONSAT** Android app (`on.sat.fixtures` 2.0.0), plus an independent,
provider-agnostic **REST API** for football fixtures, live status/scores and **satellite broadcast channels**
(frequency, polarization, symbol rate, encryption). Any app can use it, for example an IPTV player.

- **Website:** https://r1tec-store.github.io/fixtures-onsat-web-api/ — React + Vite + Tailwind, Arabic RTL, light/dark, mobile → desktop.
- **API:** Node + Express + TypeScript, `/api/v1`, OpenAPI 3 + Swagger UI at `/docs`.
- **Data:** the public pages the app's WebView loads (`fixturessat.blogspot.com`), normalized. Live scores come from ESPN's public scoreboard.
  See [docs/REVERSE_ENGINEERING_REPORT.md](docs/REVERSE_ENGINEERING_REPORT.md) for how this was found and verified.

```
fixtures-onsat-web-api/
├── backend/           Express API (TypeScript)
│   ├── src/providers/     fixtures-onsat (HTML parsers) · espn (scores)   ← swap data sources here
│   ├── src/services/      normalize.ts (raw → public model) · store.ts (sync, cache, snapshot)
│   ├── src/routes/v1.ts   public REST contract
│   ├── test/              parser + API tests (vitest, supertest)
│   └── scripts/check-source.ts   live upstream health check
├── frontend/          React web app (consumes the same public API)
├── docs/              API.md · DATA_MODEL.md · REVERSE_ENGINEERING_REPORT.md
├── .github/workflows/ CI · daily source check · GitHub Pages deploy
├── Dockerfile · docker-compose.yml · render.yaml · .env.example
```

## Quick start
```bash
npm install
npm run build            # builds frontend + backend
npm start                # http://localhost:8080  (site + /api/v1 + /docs)
```
Development (hot reload): `npm run dev -w backend` (port 8080) and `npm run dev -w frontend` (Vite proxies `/api` to 8080).

Docker: `docker compose up --build` → http://localhost:8080

Tests: `npm test` (offline, fixture-based). Upstream check: `npm run check:source` (hits the live sources and exits 1 if one is broken).

## Using the API from another app
```bash
curl "https://<host>/api/v1/matches/today?tz=Africa/Cairo"
curl "https://<host>/api/v1/matches/live"
curl "https://<host>/api/v1/matches/date/2026-11-22?tz=Europe/Paris&competition=spain-la-liga"
curl "https://<host>/api/v1/matches/<id>/channels"
curl "https://<host>/api/v1/channels?satellite=nilesat&encrypted=false"
```
```ts
// e.g. inside an IPTV player
const res = await fetch(`${API}/api/v1/matches/today?tz=${Intl.DateTimeFormat().resolvedOptions().timeZone}`);
const { data: matches } = await res.json();
for (const m of matches.filter((m) => m.has_details)) {
  const { data: channels } = await (await fetch(`${API}/api/v1/matches/${m.id}/channels`)).json();
  // channels[i].name / .satellite / .frequency / .polarization / .symbol_rate → map to your playlist
}
```
The full reference, with real example responses, is in [docs/API.md](docs/API.md).

## Changing the data provider
The API contract (`src/models/types.ts`) does not depend on where the data comes from. To use another source:
implement `FixturesProvider` (and optionally `ScoresProvider`) from `src/providers/types.ts`, then pass it to
`new DataStore(...)` in `src/server.ts`. Routes, normalization, caching and clients stay unchanged.

## Configuration
Everything is set through environment variables. See [.env.example](.env.example). The main ones:

| Var | Default | |
|---|---|---|
| `PORT` | 8080 | |
| `SCHEDULE_REFRESH_MINUTES` / `CATALOG_REFRESH_MINUTES` | 10 / 180 | sync cadence |
| `ENABLE_SCORES` | true | ESPN live scores |
| `DATA_DIR` | ./data | last-known-good snapshot (mount a disk in prod) |
| `API_KEYS` | (empty = open) | comma list; clients send `X-API-Key` |
| `CORS_ORIGINS` | (empty = `*`) | |
| `RATE_LIMIT_PER_MINUTE` | 120 | |
| `VITE_API_BASE_URL` | (same origin) | build-time, only when the site is hosted apart from the API |

## Deployment

### GitHub Pages (website, no server needed)
**Live site:** https://r1tec-store.github.io/fixtures-onsat-web-api/

GitHub Pages cannot run Node, so `.github/workflows/pages.yml` does the sync inside GitHub Actions instead.
On every push and **every 30 minutes** it builds the site in static-data mode (`VITE_STATIC_DATA=true`), runs
`backend/scripts/export-static.ts` against the real sources, and deploys. The normalized data is also published
as plain JSON that any app can read (no filters, no API key):

| File | Content |
|---|---|
| `/data/meta.json` | export time, counts, recent source issues |
| `/data/matches.json` | every match (status/score as of the export) |
| `/data/matches/<id>.json` | match + channels, for kickoffs −12 h … +48 h |
| `/data/competitions.json`, `/data/teams.json`, `/data/feeds.json` | catalogs |
| `/data/satellites.json`, `/data/satellites/<id>.json` | satellites and their channels |

Limits of the Pages version: data is up to ~30 min old (GitHub may delay scheduled runs), there are no server-side
filters, and GitHub pauses scheduled workflows in repos with no activity for 60 days (re-enable them in the Actions tab).

### Full REST API (Node host)
For live scores, filters, timezones and `/docs`, deploy the API (it serves the website too):

1. **Render (free tier):** New → *Blueprint* → select this repo. `render.yaml` builds the Dockerfile,
   sets `/health` as the health check and auto-deploys on every push to `main`. You get HTTPS at `https://<name>.onrender.com`.
   Set `PUBLIC_BASE_URL` to that URL. Free instances sleep when idle and lose `DATA_DIR` on restart.
2. **Railway / Fly.io:** both build the same `Dockerfile` (port 8080, health check `/health`).
3. Optionally set the repository variable `API_BASE_URL` to that API. The GitHub Pages site then calls the live API
   instead of static files.

Monitoring: `/health` for uptime checks, `/api/v1/status` for sync age and recent source errors, structured JSON logs (pino) on stdout,
and the daily *Source health check* workflow, which fails when the upstream HTML changes.

## Data sources, attribution and limits
- Fixtures, competitions, channels and frequencies: **Fixtures OnSAT** (`fixturessat.blogspot.com`). Every match links back with `source_url`.
- Scores and live status: **ESPN** public site API (unofficial, best effort). When it does not cover a match, the status is
  estimated from the kickoff time (`status_source: "estimated"`) and the score is `null`.
- Logos and crests are third-party URLs returned as published. They are not copied or re-hosted here.
- This project is not affiliated with Fixtures OnSAT, ESPN or any broadcaster. Before commercial use, review the source sites' terms.
  The API caches upstream data and rate-limits clients to keep the load on the sources low.

## Not reproduced from the Android app
Push notifications (FCM/OneSignal), ads, league standings, the free-channel and broadcaster-rights pages, and the
API-Football minute worker. The reasons are in the report, §6.

## License
MIT for this repository's code. Third-party data and images belong to their owners.
