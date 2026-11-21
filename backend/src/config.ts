function num(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) throw new Error(`Invalid numeric env ${name}=${raw}`);
  return n;
}

function bool(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(raw.toLowerCase());
}

function list(name: string): string[] {
  return (process.env[name] ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export const config = {
  env: process.env.NODE_ENV ?? 'development',
  port: num('PORT', 8080),
  logLevel: process.env.LOG_LEVEL ?? 'info',

  sourceBaseUrl: (process.env.SOURCE_BASE_URL ?? 'https://fixturessat.blogspot.com').replace(/\/$/, ''),
  espnBaseUrl: (process.env.ESPN_BASE_URL ?? 'https://site.api.espn.com/apis/site/v2/sports/soccer').replace(/\/$/, ''),
  userAgent: process.env.SOURCE_USER_AGENT ?? 'fixtures-onsat-web-api/1.0',
  requestTimeoutMs: num('SOURCE_TIMEOUT_MS', 15000),
  sourceConcurrency: Math.max(1, num('SOURCE_CONCURRENCY', 4)),

  /** Schedule (today + next days) refresh interval. */
  scheduleRefreshMin: num('SCHEDULE_REFRESH_MINUTES', 10),
  /** Competitions / satellites / feeds refresh interval. */
  catalogRefreshMin: num('CATALOG_REFRESH_MINUTES', 180),
  /** Match details (channel lists) cache TTL. */
  detailsTtlMin: num('DETAILS_TTL_MINUTES', 30),
  /** Score cache TTL while a match is live / otherwise. */
  liveScoresTtlSec: num('LIVE_SCORES_TTL_SECONDS', 30),
  idleScoresTtlSec: num('IDLE_SCORES_TTL_SECONDS', 300),
  enableScores: bool('ENABLE_SCORES', true),
  /** Fallback live window used when no score feed covers a match (matches the original app). */
  matchDurationMin: num('MATCH_DURATION_MINUTES', 120),

  /** Directory for the last-known-good snapshot (survives source downtime / restarts). Empty = disabled. */
  dataDir: process.env.DATA_DIR ?? './data',
  disableSync: bool('DISABLE_SYNC', false),

  corsOrigins: list('CORS_ORIGINS'), // empty = allow all (public read-only API)
  rateLimitPerMin: num('RATE_LIMIT_PER_MINUTE', 120),
  /** Optional API keys; when set, /api/v1 requires X-API-Key or ?api_key=. */
  apiKeys: list('API_KEYS'),
  serveFrontend: bool('SERVE_FRONTEND', true),
  frontendDist: process.env.FRONTEND_DIST ?? '../frontend/dist',
  publicBaseUrl: process.env.PUBLIC_BASE_URL ?? '',
};

export type Config = typeof config;
