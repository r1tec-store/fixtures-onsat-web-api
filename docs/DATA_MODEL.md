# Data Model

The public API exposes a **provider-independent** model (`backend/src/models/types.ts`).
Providers (`backend/src/providers/*`) produce raw records. `services/normalize.ts` maps those records onto this model.
If the data source is replaced, these shapes stay the same.

Conventions: `snake_case` fields. Instants are ISO-8601 **UTC** (`2026-11-21T12:30:00.000Z`). Unknown values are `null`, never omitted.
IDs are opaque strings.

## Match
| Field | Type | Notes |
|---|---|---|
| `id` | string | `m_` + hash of kickoff + both team ids. Stable while kickoff and crests stay unchanged |
| `kickoff` | datetime | UTC |
| `status` | `upcoming` \| `live` \| `halftime` \| `finished` \| `postponed` \| `cancelled` | |
| `status_source` | `live-feed` \| `estimated` | `estimated`: no score feed covers the match, so status comes from kickoff + `MATCH_DURATION_MINUTES` (120) |
| `minute` | string \| null | Clock from the feed, e.g. `"67'"`, `"90'+3'"` |
| `home_team`, `away_team` | TeamRef | |
| `competition` | CompetitionRef \| null | |
| `round` | string \| null | As published, e.g. `"الجولة 11"` |
| `score` | `{home, away}` (int \| null) | `null` until the feed reports a score |
| `main_channel_logo` | url \| null | Main broadcaster shown on the schedule |
| `has_details` | bool | `true` when a match page with a channel list exists |
| `source_url` | url \| null | Attribution / original page |

### MatchDetails = Match +
| Field | Type |
|---|---|
| `watch_on` | `{name, logo}` \| null: Arabic-language broadcaster |
| `commentator` | string \| null |
| `channels` | Channel[] |

## TeamRef / Team
`id` (`t_` + Flashscore crest id, or a hash of logo/name), `name` (Arabic, as published), `name_en` (from the score feed when known, otherwise null), `logo`.
`Team` adds `competitions` (ids) and `match_count`.

## CompetitionRef / Competition
`id` is the source slug (e.g. `england-premier-league`), `name`, `logo`. `Competition` adds `category`, `season`, `match_count`.

## Channel
| Field | Type | Example |
|---|---|---|
| `id` | string | `c_` + hash(name + tuning) |
| `name` | string | `beIN SPORTS 1 Qatar` |
| `logo` | url \| null | |
| `satellite` | string \| null | `Nilesat 7°W` |
| `frequency` | int (MHz) \| null | `12188` |
| `polarization` | `H`\|`V`\|`L`\|`R` \| null | |
| `symbol_rate` | int (kS/s) \| null | `27500` |
| `tuning` | string \| null | Raw `Nilesat 7°W - 12188 H 27500` |
| `quality` | string \| null | `HD` |
| `encrypted` | bool \| null | |
| `sharing_supported` | bool | |

## Satellite
`id` (slug), `name` (`Nilesat 7°W`), `region`, `channel_count`.

## Feed
`id`, `tuning`, `satellite`, `frequency`, `polarization`, `symbol_rate`, `encryption` (e.g. `FTA` or a BISS key as published), `home_team`/`away_team` `{name, logo}` \| null.

## Merging rules
1. All fixtures from competition pages (full season) and day pages are keyed by `id`. A match that appears on both pages has the same `id`, because crest ids are identical.
2. Day-page data wins for `has_details`, `source_url`, `main_channel_logo` and the score reference. The competition page supplies `round`.
3. Status and score are applied **when the request is served**, from the cached score feed, so they are never older than the score TTL.

## Storage
- In memory: the normalized indexes, rebuilt after each sync.
- On disk: a `DATA_DIR/snapshot-<provider>.json` last-known-good snapshot of raw records, loaded at boot and used during source downtime.
- Match details: an in-memory cache with `DETAILS_TTL_MINUTES`. Stale details are served when the source fails.
