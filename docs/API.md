# Fixtures ONSAT API — v1

Base URL: `https://<your-deployment>` (local: `http://localhost:8080`). All endpoints are `GET` and read-only.
Interactive docs: **`/docs`** (Swagger UI). Machine-readable: **`/openapi.json`** (OpenAPI 3.0.3).

## Conventions
- **Envelope:** `{ "success": true, "source": "fixtures-onsat", "last_updated": "<ISO>", ...meta, "data": ... }`.
  `last_updated` is the time of the last successful sync from the source.
- **Errors:** `{ "success": false, "error": { "status": 400, "code": "INVALID_PARAMETER", "message": "..." } }`.
  Codes: `INVALID_PARAMETER` 400, `UNAUTHORIZED` 401, `NOT_FOUND` 404, `RATE_LIMITED` 429, `DATA_NOT_READY` 503, `INTERNAL_ERROR` 500.
- **Times** are UTC ISO-8601. Pass `tz=<IANA zone>` (e.g. `Africa/Cairo`) to make `date`, `from`, `to` and `/today` use local days.
- **Pagination:** `page` (1-based) and `limit` (default 50 for matches, 100 for catalogs, max 500). Responses include
  `pagination: {page, limit, total, total_pages}`.
- **Versioning:** the path prefix `/api/v1`. Breaking changes will go to `/api/v2`.
- **Auth:** open by default. If the server sets `API_KEYS`, send `X-API-Key: <key>` (or `?api_key=`).
- **Rate limit:** `RATE_LIMIT_PER_MINUTE` per IP (default 120). Standard `RateLimit-*` headers are returned.
- **Caching:** responses carry `Cache-Control: public, max-age=N` (15 s for live lists, up to 300 s for catalogs).
- **CORS:** `*` by default (configurable with `CORS_ORIGINS`).

## Matches

### Common match filters
| Param | Description |
|---|---|
| `tz` | IANA timezone for date logic (default `UTC`) |
| `date` / `from` / `to` | Local dates `YYYY-MM-DD` |
| `status` | Comma list: `upcoming,live,halftime,finished,postponed,cancelled` |
| `competition` | Competition id, e.g. `england-premier-league` |
| `team` | Team id, e.g. `t_A7kHoxZA` |
| `q` | Text search in team / competition names (Arabic; English when the score feed supplied it) |
| `has_channels` | `true` = only matches that have a channel list |
| `order` | `asc` (default) / `desc` by kickoff |
| `page`, `limit` | Pagination |

| Endpoint | Description |
|---|---|
| `GET /api/v1/matches` | Every known match (daily schedule + full-season fixtures) |
| `GET /api/v1/matches/today` | Matches on today's date in `tz` (adds `date`) |
| `GET /api/v1/matches/live` | `live` or `halftime` |
| `GET /api/v1/matches/upcoming` | Not started yet, soonest first |
| `GET /api/v1/matches/date/:date` | Matches on `:date` in `tz` |
| `GET /api/v1/matches/:id` | Match + `watch_on`, `commentator`, `channels` |
| `GET /api/v1/matches/:id/channels` | Only the channels (+ `watch_on`, `commentator` in the envelope) |

Example: `GET /api/v1/matches/today?tz=Africa/Cairo&limit=1` (real response, 2026-11-21)
```json
{
  "success": true,
  "source": "fixtures-onsat",
  "last_updated": "2026-11-21T16:48:26.321Z",
  "timezone": "Africa/Cairo",
  "pagination": { "page": 1, "limit": 1, "total": 36, "total_pages": 36 },
  "date": "2026-11-21",
  "data": [
    {
      "id": "m_90ba1f09595d",
      "kickoff": "2026-11-21T12:30:00.000Z",
      "home_team": { "id": "t_UXcqj7HG", "name": "مان سيتي", "name_en": "Manchester City", "logo": "https://static.flashscore.com/res/image/data/UXcqj7HG-lQuhqN8N.png" },
      "away_team": { "id": "t_naaAVOzB", "name": "فولهام", "name_en": "Fulham", "logo": "https://static.flashscore.com/res/image/data/naaAVOzB-ImMEe0UF.png" },
      "competition": { "id": "england-premier-league", "name": "الدوري الإنجليزي", "logo": "https://fixturesonsat-de2.pages.dev/png/premierleagues.png" },
      "round": "الجولة 11",
      "main_channel_logo": "https://images-4cf.pages.dev/chlogo/be1.png",
      "has_details": true,
      "source_url": "https://fixturessat.blogspot.com/2026/11/manchester-city-vs-fulham.html",
      "status": "finished",
      "status_source": "live-feed",
      "minute": null,
      "score": { "home": 1, "away": 1 }
    }
  ]
}
```

Example: `GET /api/v1/matches/m_90ba1f09595d` (channels trimmed to 2 of 39)
```json
{
  "success": true,
  "source": "fixtures-onsat",
  "last_updated": "2026-11-21T16:48:26.321Z",
  "data": {
    "id": "m_90ba1f09595d",
    "kickoff": "2026-11-21T12:30:00.000Z",
    "...": "same fields as above",
    "watch_on": { "name": "beIN SPORTS 1", "logo": "https://images-4cf.pages.dev/chlogo/be1.png" },
    "commentator": "علي محمد علي",
    "channels": [
      { "id": "c_14831876c4", "name": "Idman TV Azerbaijan", "logo": "https://images-4cf.pages.dev/chlogo/idman.png", "satellite": "AzerSpace 46°E", "frequency": 11175, "polarization": "H", "symbol_rate": 30000, "tuning": "AzerSpace 46°E - 11175 H 30000", "quality": "HD", "encrypted": false, "sharing_supported": false },
      { "id": "c_03514d8567", "name": "Football Tajikistan", "logo": "https://images-4cf.pages.dev/chlogo/footballtajikistan.jpg", "satellite": "Yahsat 52.5°E", "frequency": 11785, "polarization": "H", "symbol_rate": 27500, "tuning": "Yahsat 52.5°E - 11785 H 27500", "quality": "HD", "encrypted": false, "sharing_supported": false }
    ]
  }
}
```

## Competitions
| Endpoint | Params |
|---|---|
| `GET /api/v1/competitions` | `q`, `category`, `page`, `limit` |
| `GET /api/v1/competitions/:id` | |
| `GET /api/v1/competitions/:id/matches` | all match filters |

```json
{ "id": "uefa-nations-league", "name": "دوري الأمم الأوروبية", "logo": "https://fixturesonsat-de2.pages.dev/png/nationsleague.png", "category": "البطولات القارية", "season": "2026 . 2027", "match_count": 150 }
```

## Teams
| Endpoint | Params |
|---|---|
| `GET /api/v1/teams` | `q`, `competition`, `page`, `limit` (sorted by number of matches) |
| `GET /api/v1/teams/:id` | |
| `GET /api/v1/teams/:id/matches` | all match filters |

## Channels, satellites, feeds
| Endpoint | Params |
|---|---|
| `GET /api/v1/channels` | `q`, `satellite` (e.g. `nilesat`), `encrypted=true|false`, `page`, `limit` |
| `GET /api/v1/satellites` | |
| `GET /api/v1/satellites/:id/channels` | `q` |
| `GET /api/v1/feeds` | |

```json
{ "id": "nilesat", "name": "Nilesat 7°W", "region": "أقمار الغرب", "channel_count": 52 }
```

## System
| Endpoint | |
|---|---|
| `GET /health` | `{status: "ok"|"starting", uptime_s, schedule_synced_at, catalog_synced_at}`. No auth, no rate limit |
| `GET /api/v1/status` | Sync times, counts, last 20 source issues (parse warnings, failures) |
| `GET /openapi.json`, `/docs` | OpenAPI document, Swagger UI |

## Error example
`GET /api/v1/matches?tz=Nowhere`
```json
{ "success": false, "error": { "status": 400, "code": "INVALID_PARAMETER", "message": "Unknown timezone 'Nowhere' (use an IANA name like Africa/Cairo)" } }
```

## Data freshness
| Data | Refresh |
|---|---|
| Daily schedule (3 day pages) | `SCHEDULE_REFRESH_MINUTES` (10) |
| Competitions, satellites, feeds | `CATALOG_REFRESH_MINUTES` (180) |
| Match channel lists | Prefetched for matches within −3 h…+30 h at each schedule sync. Otherwise loaded on demand, cached `DETAILS_TTL_MINUTES` (30) |
| Scores | Loaded on request. Cached `LIVE_SCORES_TTL_SECONDS` (30) while any match is near/in play, otherwise `IDLE_SCORES_TTL_SECONDS` (300). Window: kickoff −36 h…+12 h |

If the source is down, the API keeps serving the last snapshot. `last_updated` and `/api/v1/status` show how old it is.
