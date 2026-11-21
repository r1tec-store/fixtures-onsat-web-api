import type { Channel, Feed } from '../models/types.js';

/**
 * Contract between the sync service and a data provider.
 * Swap the provider (e.g. a licensed football-data API) without touching the
 * public API: implement this interface and register it in services/store.ts.
 */

export interface RawFixture {
  kickoff: string; // ISO UTC
  home: { name: string; logo: string | null };
  away: { name: string; logo: string | null };
  competition: { id: string; name: string; logo: string | null } | null;
  round: string | null;
  /** Provider-relative path of the detail page, when one exists. */
  detailPath: string | null;
  mainChannelLogo: string | null;
  /** External score-feed reference (league code + event id) when known. */
  scoreRef: { league: string | null; eventId: string } | null;
}

export interface RawCompetition {
  id: string;
  name: string;
  logo: string | null;
  category: string | null;
  season: string | null;
  fixtures: RawFixture[];
  /** The page could not be fetched; the store keeps the previously synced fixtures. */
  fetchFailed?: boolean;
}

export interface RawSatellite {
  id: string;
  name: string;
  region: string | null;
  channels: Channel[];
  /** The page could not be fetched; the store keeps the previously synced channels. */
  fetchFailed?: boolean;
}

export interface RawMatchDetails {
  kickoff: string | null;
  competitionName: string | null;
  round: string | null;
  watchOn: { name: string; logo: string | null } | null;
  commentator: string | null;
  channels: Channel[];
}

export interface FixturesProvider {
  readonly name: string;
  /** Short schedule (today and the next days) — refreshed often. */
  fetchSchedule(): Promise<RawFixture[]>;
  /** Competitions with full-season fixtures — refreshed rarely. */
  fetchCompetitions(): Promise<RawCompetition[]>;
  fetchSatellites(): Promise<RawSatellite[]>;
  fetchFeeds(): Promise<Feed[]>;
  fetchMatchDetails(detailPath: string): Promise<RawMatchDetails>;
  /** Public URL for a detail path (for attribution / source_url). */
  publicUrl(path: string): string;
}

export interface LiveScore {
  eventId: string;
  state: 'pre' | 'in' | 'post';
  statusName: string; // e.g. STATUS_HALFTIME
  clock: string | null;
  home: { name: string; score: number | null };
  away: { name: string; score: number | null };
}

export interface ScoresProvider {
  readonly name: string;
  /** Scores for events on the given UTC dates (YYYY-MM-DD), keyed by event id. */
  fetchScores(dates: string[], leagues: string[], wantedIds: Set<string>): Promise<Map<string, LiveScore>>;
}
