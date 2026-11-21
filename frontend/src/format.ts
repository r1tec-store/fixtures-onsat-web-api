export const DAYS = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

/** Kick-off time in the user's local time, 12h (ص/م) or 24h like the original app. */
export function fmtTime(iso: string, format: string): string {
  const d = new Date(iso);
  const m = String(d.getMinutes()).padStart(2, '0');
  let h = d.getHours();
  if (format === '24') return `${String(h).padStart(2, '0')}:${m}`;
  const p = h >= 12 ? 'م' : 'ص';
  h = h % 12 || 12;
  return `${String(h).padStart(2, '0')}:${m} ${p}`;
}

/** Local calendar date YYYY-MM-DD. */
export function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function dateLabel(iso: string): string {
  const d = new Date(iso);
  return `${DAYS[d.getDay()]} ${d.getDate()} - ${d.getMonth() + 1} - ${d.getFullYear()}`;
}

export function countdown(iso: string, now: number): string | null {
  const diff = Date.parse(iso) - now;
  if (diff <= 0) return null;
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  const mins = Math.floor((diff % 3_600_000) / 60_000);
  if (days > 0) return `بعد ${days} يوم ${hours} ساعة`;
  if (hours > 0) return `بعد ${hours} ساعة ${mins} دقيقة`;
  return `بعد ${mins} دقيقة`;
}
