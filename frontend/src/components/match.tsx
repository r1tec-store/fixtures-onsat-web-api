import { Link } from 'react-router-dom';
import type { Channel, Match } from '../api';
import { fmtTime } from '../format';
import { useSetting } from '../hooks';
import { Icon, Logo } from './ui';

const STATUS_LABEL: Record<string, string> = {
  live: 'مباشر',
  halftime: 'استراحة',
  finished: 'إنتهت',
  postponed: 'مؤجلة',
  cancelled: 'ملغاة',
};

export function isLive(m: Match) {
  return m.status === 'live' || m.status === 'halftime';
}

function Center({ m }: { m: Match }) {
  const timeFormat = useSetting('timeFormat', '12');
  const hasScore = m.score.home !== null && m.score.away !== null;
  if (m.status === 'upcoming') return <span className="text-sm font-extrabold text-main">{fmtTime(m.kickoff, timeFormat)}</span>;
  return (
    <span className="flex flex-col items-center leading-tight">
      {hasScore && (
        <span className="text-base font-extrabold" dir="ltr">
          {m.score.home} - {m.score.away}
        </span>
      )}
      <span className={`text-[11px] font-bold ${isLive(m) ? 'pulse text-live' : 'text-muted'}`}>
        {m.status === 'live' && m.minute ? m.minute : STATUS_LABEL[m.status]}
      </span>
    </span>
  );
}

/** Fixture row: channel logo, the two teams stacked, kickoff/score on the left (RTL). */
export function MatchRow({ m }: { m: Match }) {
  const body = (
    <>
      <div className="grid h-9 w-9 shrink-0 place-items-center">{m.main_channel_logo && <Logo src={m.main_channel_logo} className="h-7 w-9" />}</div>
      <div className="min-w-0 flex-1 space-y-1">
        {[m.home_team, m.away_team].map((t, i) => (
          <div key={i} className="flex items-center gap-2 text-sm font-bold">
            <Logo src={t.logo} className="h-5 w-5" />
            <span className="truncate">{t.name}</span>
            {(i === 0 ? m.score.home : m.score.away) !== null && m.status !== 'upcoming' && <span className="ms-auto text-xs text-muted sm:hidden">{i === 0 ? m.score.home : m.score.away}</span>}
          </div>
        ))}
      </div>
      <div className={`grid min-w-20 place-items-center border-s border-line ps-2 ${isLive(m) ? 'text-live' : ''}`}>
        <Center m={m} />
      </div>
    </>
  );
  const cls = `flex items-center gap-3 rounded-md px-3 py-2 ${isLive(m) ? 'bg-live/10 ring-1 ring-live/30' : 'bg-card'}`;
  return m.has_details ? (
    <Link to={`/match/${m.id}`} className={`${cls} transition hover:brightness-95`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export function LeagueRow({ id, name, logo }: { id: string; name: string; logo: string | null }) {
  return (
    <Link to={`/leagues/${id}`} className="mb-1 mt-3 flex items-center gap-2 rounded-md bg-league px-3 py-1.5 text-sm font-bold">
      <Logo src={logo} className="h-6 w-6" />
      <span className="flex-1">{name}</span>
      <Icon name="back" size={14} className="text-muted" />
    </Link>
  );
}

const rank = (m: Match) => m.source_order ?? Number.POSITIVE_INFINITY;

/**
 * Matches grouped under their competition header, in the same order as the
 * app's schedule (source_order); fixtures not on the schedule follow by kickoff.
 */
export function GroupedMatches({ matches }: { matches: Match[] }) {
  const groups: Array<{ key: string; comp: Match['competition']; items: Match[] }> = [];
  const ordered = [...matches].sort((a, b) => rank(a) - rank(b) || a.kickoff.localeCompare(b.kickoff));
  for (const m of ordered) {
    const key = m.competition?.id ?? '_';
    let g = groups.find((x) => x.key === key);
    if (!g) groups.push((g = { key, comp: m.competition, items: [] }));
    g.items.push(m);
  }
  return (
    <div>
      {groups.map((g) => (
        <section key={g.key}>
          {g.comp && <LeagueRow {...g.comp} />}
          <div className="space-y-[3px]">
            {g.items.map((m) => (
              <MatchRow key={m.id} m={m} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export function ChannelCard({ c }: { c: Channel }) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-card px-3 py-2.5">
      <Logo src={c.logo} className="h-10 w-12" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-extrabold" dir="ltr" style={{ textAlign: 'right' }}>
          {c.name}
        </div>
        {c.tuning && (
          <div className="mt-0.5 text-xs text-muted" dir="ltr" style={{ textAlign: 'right' }}>
            {c.tuning}
          </div>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {c.sharing_supported && (
          <span title="تعمل على Sharing Info" className="text-blue">
            <Icon name="share" size={16} />
          </span>
        )}
        {c.encrypted !== null && (
          <span title={c.encrypted ? 'مشفرة' : 'مفتوحة'} className={c.encrypted ? 'text-live' : 'text-emerald-500'}>
            <Icon name={c.encrypted ? 'lock' : 'unlock'} size={16} />
          </span>
        )}
        {c.quality && <span className="rounded bg-blue px-1.5 py-0.5 text-[10px] font-extrabold text-white">{c.quality}</span>}
      </div>
    </div>
  );
}
