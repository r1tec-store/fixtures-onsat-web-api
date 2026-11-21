import type { Request } from 'express';
import { normName } from './ids.js';

export class ApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string, readonly details?: unknown) {
    super(message);
  }
}

export function qs(req: Request, name: string): string | undefined {
  const v = req.query[name];
  if (Array.isArray(v)) return typeof v[0] === 'string' ? v[0] : undefined;
  return typeof v === 'string' && v !== '' ? v : undefined;
}

export function intParam(req: Request, name: string, def: number, min: number, max: number): number {
  const raw = qs(req, name);
  if (raw === undefined) return def;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < min || n > max) throw new ApiError(400, 'INVALID_PARAMETER', `'${name}' must be an integer between ${min} and ${max}`);
  return n;
}

export function timezone(req: Request): string {
  const tz = qs(req, 'tz') ?? 'UTC';
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: tz });
  } catch {
    throw new ApiError(400, 'INVALID_PARAMETER', `Unknown timezone '${tz}' (use an IANA name like Africa/Cairo)`);
  }
  return tz;
}

const fmtCache = new Map<string, Intl.DateTimeFormat>();
/** Calendar date (YYYY-MM-DD) of an instant in a timezone. */
export function localDate(iso: string | number, tz: string): string {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });
    fmtCache.set(tz, f);
  }
  return f.format(typeof iso === 'number' ? new Date(iso) : new Date(iso));
}

export function dateParam(value: string | undefined, name: string): string | undefined {
  if (value === undefined) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
    throw new ApiError(400, 'INVALID_PARAMETER', `'${name}' must be a date in YYYY-MM-DD format`);
  }
  return value;
}

export function matchesText(q: string, ...fields: Array<string | null | undefined>): boolean {
  const needle = normName(q);
  return fields.some((f) => f && normName(f).includes(needle));
}

export interface Page<T> {
  items: T[];
  pagination: { page: number; limit: number; total: number; total_pages: number };
}

export function paginate<T>(req: Request, items: T[], defLimit = 50): Page<T> {
  const limit = intParam(req, 'limit', defLimit, 1, 500);
  const page = intParam(req, 'page', 1, 1, 100000);
  const total = items.length;
  return {
    items: items.slice((page - 1) * limit, page * limit),
    pagination: { page, limit, total, total_pages: Math.max(1, Math.ceil(total / limit)) },
  };
}
