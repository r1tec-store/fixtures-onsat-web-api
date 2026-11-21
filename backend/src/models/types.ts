/**
 * Normalized, provider-independent data model exposed by the public API.
 * Field names here are part of the API contract (see docs/DATA_MODEL.md);
 * providers map their raw data onto these shapes.
 */

export type MatchStatus =
  | 'upcoming'
  | 'live'
  | 'halftime'
  | 'finished'
  | 'postponed'
  | 'cancelled';

/** Where the status/score came from: a live score feed, or estimated from kickoff time. */
export type StatusSource = 'live-feed' | 'estimated';

export interface TeamRef {
  id: string;
  name: string;
  /** English name when a score feed supplied one, otherwise null. */
  name_en: string | null;
  logo: string | null;
}

export interface CompetitionRef {
  id: string;
  name: string;
  logo: string | null;
}

export interface Score {
  home: number | null;
  away: number | null;
}

export interface Match {
  id: string;
  kickoff: string; // ISO-8601 UTC
  status: MatchStatus;
  status_source: StatusSource;
  /** Match clock as shown by the score feed (e.g. "67'"), null when unknown. */
  minute: string | null;
  home_team: TeamRef;
  away_team: TeamRef;
  competition: CompetitionRef | null;
  round: string | null;
  score: Score;
  /** Logo of the main broadcaster shown on the fixtures list, when given. */
  main_channel_logo: string | null;
  has_details: boolean;
  source_url: string | null;
}

export interface Channel {
  id: string;
  name: string;
  logo: string | null;
  satellite: string | null;
  frequency: number | null;
  polarization: 'H' | 'V' | 'L' | 'R' | null;
  symbol_rate: number | null;
  /** Raw tuning string exactly as published, e.g. "Nilesat 7°W - 12418 H 30000". */
  tuning: string | null;
  quality: string | null;
  encrypted: boolean | null;
  sharing_supported: boolean;
}

export interface MatchDetails extends Match {
  /** Arabic-language broadcaster highlighted by the source ("watch on"). */
  watch_on: { name: string; logo: string | null } | null;
  commentator: string | null;
  channels: Channel[];
}

export interface Competition {
  id: string;
  name: string;
  logo: string | null;
  category: string | null;
  season: string | null;
  match_count: number;
}

export interface Team {
  id: string;
  name: string;
  logo: string | null;
  competitions: string[];
  match_count: number;
}

export interface Satellite {
  id: string;
  name: string;
  region: string | null;
  channel_count: number;
}

export interface Feed {
  id: string;
  tuning: string;
  satellite: string | null;
  frequency: number | null;
  polarization: string | null;
  symbol_rate: number | null;
  encryption: string | null;
  home_team: { name: string; logo: string | null } | null;
  away_team: { name: string; logo: string | null } | null;
}
