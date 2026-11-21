/**
 * Data store + synchronisation.
 *
 * - Pulls raw data from a FixturesProvider on two cadences (short schedule
 *   often, catalog rarely) and normalises it once per sync.
 * - Enriches with live scores (ScoresProvider) lazily with a short TTL.
 * - Caches match details (channel lists) per page with a TTL.
 * - Persists a last-known-good snapshot to disk so the API keeps serving
 *   when the source is down or the process restarts.
 */
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';
import type { Channel, Competition, Feed, Match, MatchDetails, Satellite, Team } from '../models/types.js';
import type { FixturesProvider, LiveScore, RawCompetition, RawFixture, RawMatchDetails, RawSatellite, ScoresProvider } from '../providers/types.js';
import { logger } from '../utils/logger.js';
import { mapLimit } from '../utils/http.js';
import { applyStatus, buildCompetitions, buildTeams, mergeFixtures, type BaseMatch } from './normalize.js';

interface Snapshot {
  version: 1;
  provider: string;
  scheduleSyncedAt: string | null;
  catalogSyncedAt: string | null;
  schedule: RawFixture[];
  competitions: RawCompetition[];
  satellites: RawSatellite[];
  feeds: Feed[];
}

export interface SyncIssue {
  at: string;
  kind: 'warning' | 'error';
  message: string;
}

const HOUR = 3600_000;

export class DataStore {
  private snap: Snapshot;
  private matches = new Map<string, BaseMatch>();
  private competitions: Competition[] = [];
  private teams: Team[] = [];
  private details = new Map<string, { at: number; value: RawMatchDetails }>();
  private scores = new Map<string, LiveScore>();
  private scoresAt = 0;
  private scoresInflight: Promise<void> | null = null;
  private issues: SyncIssue[] = [];
  private timers: NodeJS.Timeout[] = [];
  private syncing = { schedule: false, catalog: false };

  constructor(
    readonly provider: FixturesProvider,
    readonly scoresProvider: ScoresProvider | null,
    readonly now: () => number = Date.now,
  ) {
    this.snap = { version: 1, provider: provider.name, scheduleSyncedAt: null, catalogSyncedAt: null, schedule: [], competitions: [], satellites: [], feeds: [] };
  }

  // ---------- lifecycle ----------

  async init(): Promise<void> {
    await this.loadSnapshot();
    if (config.disableSync) return;
    // Don't block startup on the network: serve the snapshot while syncing.
    void this.syncCatalog().then(() => this.syncSchedule());
    this.timers.push(setInterval(() => void this.syncSchedule(), config.scheduleRefreshMin * 60_000));
    this.timers.push(setInterval(() => void this.syncCatalog(), config.catalogRefreshMin * 60_000));
    for (const t of this.timers) t.unref();
  }

  stop(): void {
    this.timers.forEach(clearInterval);
    this.timers = [];
  }

  /** Inject raw data directly (tests, or alternative loaders). */
  load(data: Partial<Pick<Snapshot, 'schedule' | 'competitions' | 'satellites' | 'feeds'>>): void {
    Object.assign(this.snap, data);
    this.rebuild();
  }

  issue(kind: SyncIssue['kind'], message: string): void {
    this.issues.unshift({ at: new Date(this.now()).toISOString(), kind, message });
    this.issues.length = Math.min(this.issues.length, 100);
    (kind === 'error' ? logger.error : logger.warn).call(logger, { source: this.provider.name }, message);
  }

  async syncSchedule(): Promise<void> {
    if (this.syncing.schedule) return;
    this.syncing.schedule = true;
    try {
      const schedule = await this.provider.fetchSchedule();
      if (schedule.length === 0 && this.snap.schedule.length > 0) {
        this.issue('warning', 'schedule sync returned 0 fixtures; keeping previous data');
      } else {
        this.snap.schedule = schedule;
        this.snap.scheduleSyncedAt = new Date(this.now()).toISOString();
        this.rebuild();
        await this.saveSnapshot();
        logger.info({ fixtures: schedule.length }, 'schedule synced');
      }
      await this.prefetchDetails();
    } catch (err) {
      this.issue('error', `schedule sync failed: ${String(err)}`);
    } finally {
      this.syncing.schedule = false;
    }
  }

  async syncCatalog(): Promise<void> {
    if (this.syncing.catalog) return;
    this.syncing.catalog = true;
    try {
      const [competitions, satellites, feeds] = await Promise.allSettled([
        this.provider.fetchCompetitions(),
        this.provider.fetchSatellites(),
        this.provider.fetchFeeds(),
      ]);
      if (competitions.status === 'fulfilled' && competitions.value.length) this.snap.competitions = competitions.value;
      else this.issue('error', `competitions sync failed: ${competitions.status === 'rejected' ? String(competitions.reason) : 'empty'}`);
      if (satellites.status === 'fulfilled' && satellites.value.length) this.snap.satellites = satellites.value;
      else this.issue('error', `satellites sync failed: ${satellites.status === 'rejected' ? String(satellites.reason) : 'empty'}`);
      if (feeds.status === 'fulfilled') this.snap.feeds = feeds.value;
      else this.issue('error', `feeds sync failed: ${String(feeds.reason)}`);
      this.snap.catalogSyncedAt = new Date(this.now()).toISOString();
      this.rebuild();
      await this.saveSnapshot();
      logger.info({ competitions: this.snap.competitions.length, satellites: this.snap.satellites.length }, 'catalog synced');
    } finally {
      this.syncing.catalog = false;
    }
  }

  private rebuild(): void {
    this.matches = mergeFixtures(this.snap.schedule, this.snap.competitions, (p) => this.provider.publicUrl(p));
    this.competitions = buildCompetitions(this.snap.competitions, this.matches.values());
    this.teams = buildTeams(this.matches.values());
  }

  private snapshotFile(): string | null {
    return config.dataDir ? path.resolve(config.dataDir, `snapshot-${this.provider.name}.json`) : null;
  }

  private async loadSnapshot(): Promise<void> {
    const file = this.snapshotFile();
    if (!file) return;
    try {
      const snap = JSON.parse(await readFile(file, 'utf8')) as Snapshot;
      if (snap.version === 1 && snap.provider === this.provider.name) {
        this.snap = snap;
        this.rebuild();
        logger.info({ file, scheduleSyncedAt: snap.scheduleSyncedAt }, 'snapshot loaded');
      }
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') this.issue('warning', `snapshot unreadable: ${String(err)}`);
    }
  }

  private async saveSnapshot(): Promise<void> {
    const file = this.snapshotFile();
    if (!file) return;
    try {
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(`${file}.tmp`, JSON.stringify(this.snap));
      await rename(`${file}.tmp`, file);
    } catch (err) {
      this.issue('warning', `snapshot not saved: ${String(err)}`);
    }
  }

  // ---------- scores ----------

  private scoreWindow(): BaseMatch[] {
    const now = this.now();
    return [...this.matches.values()].filter((m) => {
      if (!m.score_ref) return false;
      const t = Date.parse(m.kickoff);
      return t > now - 36 * HOUR && t < now + 12 * HOUR;
    });
  }

  private anyLive(): boolean {
    const now = this.now();
    const dur = config.matchDurationMin * 60_000;
    return [...this.matches.values()].some((m) => {
      const t = Date.parse(m.kickoff);
      return now >= t - 5 * 60_000 && now < t + dur + 30 * 60_000;
    });
  }

  /** Refresh scores if stale. Never throws; on failure the previous scores remain. */
  async refreshScores(): Promise<void> {
    if (!this.scoresProvider || !config.enableScores) return;
    const ttl = (this.anyLive() ? config.liveScoresTtlSec : config.idleScoresTtlSec) * 1000;
    if (this.now() - this.scoresAt < ttl) return;
    if (this.scoresInflight) return this.scoresInflight;
    const window = this.scoreWindow();
    if (window.length === 0) {
      this.scoresAt = this.now();
      return;
    }
    const dates = new Set<string>();
    for (const m of window) {
      const t = Date.parse(m.kickoff);
      dates.add(new Date(t).toISOString().slice(0, 10));
      dates.add(new Date(t - 24 * HOUR).toISOString().slice(0, 10)); // ESPN groups by US date
    }
    const wanted = new Set(window.map((m) => m.score_ref!.eventId));
    const leagues = [...new Set(window.map((m) => m.score_ref!.league).filter((l): l is string => !!l))];
    this.scoresInflight = this.scoresProvider
      .fetchScores([...dates], leagues, wanted)
      .then((scores) => {
        this.scores = scores;
        this.scoresAt = this.now();
      })
      .catch((err) => {
        this.scoresAt = this.now() - ttl / 2; // back off a little
        this.issue('warning', `scores refresh failed: ${String(err)}`);
      })
      .finally(() => {
        this.scoresInflight = null;
      });
    return this.scoresInflight;
  }

  // ---------- details ----------

  private async prefetchDetails(): Promise<void> {
    const now = this.now();
    const todo = [...this.matches.values()].filter((m) => {
      if (!m.detail_path) return false;
      const t = Date.parse(m.kickoff);
      return t > now - 3 * HOUR && t < now + 30 * HOUR;
    });
    await mapLimit(todo, config.sourceConcurrency, (m) => this.loadDetails(m.detail_path!, true));
  }

  private async loadDetails(detailPath: string, force = false): Promise<RawMatchDetails | null> {
    const hit = this.details.get(detailPath);
    if (hit && !force && this.now() - hit.at < config.detailsTtlMin * 60_000) return hit.value;
    try {
      const value = await this.provider.fetchMatchDetails(detailPath);
      this.details.set(detailPath, { at: this.now(), value });
      return value;
    } catch (err) {
      this.issue('warning', `details ${detailPath} failed: ${String(err)}`);
      return hit?.value ?? null; // stale beats nothing
    }
  }

  // ---------- read API ----------

  status() {
    return {
      provider: this.provider.name,
      scores_provider: this.scoresProvider?.name ?? null,
      schedule_synced_at: this.snap.scheduleSyncedAt,
      catalog_synced_at: this.snap.catalogSyncedAt,
      scores_fetched_at: this.scoresAt ? new Date(this.scoresAt).toISOString() : null,
      counts: {
        matches: this.matches.size,
        scheduled_fixtures: this.snap.schedule.length,
        competitions: this.competitions.length,
        teams: this.teams.length,
        satellites: this.snap.satellites.length,
        feeds: this.snap.feeds.length,
        cached_details: this.details.size,
      },
      recent_issues: this.issues.slice(0, 20),
    };
  }

  lastUpdated(): string | null {
    return this.snap.scheduleSyncedAt ?? this.snap.catalogSyncedAt;
  }

  hasData(): boolean {
    return this.matches.size > 0;
  }

  allMatches(): Match[] {
    const now = this.now();
    const dur = config.matchDurationMin * 60_000;
    return [...this.matches.values()].map((m) => applyStatus(m, m.score_ref ? this.scores.get(m.score_ref.eventId) : undefined, now, dur));
  }

  getMatch(id: string): Match | null {
    const m = this.matches.get(id);
    if (!m) return null;
    return applyStatus(m, m.score_ref ? this.scores.get(m.score_ref.eventId) : undefined, this.now(), config.matchDurationMin * 60_000);
  }

  /** Match + channel list. Returns null details when the page is unavailable. */
  async getMatchDetails(id: string): Promise<MatchDetails | null> {
    const base = this.matches.get(id);
    const match = this.getMatch(id);
    if (!base || !match) return null;
    const d = base.detail_path ? await this.loadDetails(base.detail_path) : null;
    return {
      ...match,
      round: match.round ?? d?.round ?? null,
      watch_on: d?.watchOn ?? null,
      commentator: d?.commentator ?? null,
      channels: d?.channels ?? [],
    };
  }

  getCompetitions(): Competition[] {
    return this.competitions;
  }

  getTeams(): Team[] {
    return this.teams;
  }

  getSatellites(): Satellite[] {
    return this.snap.satellites.map(({ channels, ...s }) => ({ ...s, channel_count: channels.length }));
  }

  getSatelliteChannels(id: string): Channel[] | null {
    return this.snap.satellites.find((s) => s.id === id)?.channels ?? null;
  }

  /** Every distinct channel/transponder published on the satellite pages. */
  getChannels(): Channel[] {
    const seen = new Map<string, Channel>();
    for (const s of this.snap.satellites) for (const c of s.channels) if (!seen.has(c.id)) seen.set(c.id, c);
    return [...seen.values()];
  }

  getFeeds(): Feed[] {
    return this.snap.feeds;
  }
}
