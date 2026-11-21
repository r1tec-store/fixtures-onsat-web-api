import { createHash } from 'node:crypto';

export function shortHash(input: string, len = 10): string {
  return createHash('sha1').update(input).digest('hex').slice(0, len);
}

/** Normalise Arabic/Latin names for matching (same rules the original site uses). */
export function normName(s: string): string {
  return s
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[\s\-_.']/g, '')
    .toLowerCase();
}

/**
 * Stable team key. Flashscore crest URLs embed a stable image id
 * (".../data/UXcqj7HG-lQuhqN8N.png" -> "UXcqj7HG"), which survives the
 * different Arabic spellings used across pages; fall back to the name.
 */
export function teamId(name: string, logo: string | null): string {
  const m = logo?.match(/\/data\/([A-Za-z0-9]{6,})-/);
  if (m) return `t_${m[1]}`;
  if (logo) return `t_${shortHash(logo)}`;
  return `t_${shortHash(normName(name))}`;
}

export function matchId(kickoff: string, homeId: string, awayId: string): string {
  return `m_${shortHash(`${kickoff}|${homeId}|${awayId}`, 12)}`;
}

export function slugify(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/°/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
