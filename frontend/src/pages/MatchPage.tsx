import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { MatchDetails } from '../api';
import { ChannelCard, isLive } from '../components/match';
import { Empty, ErrorState, Header, Icon, Logo, SearchBox, Skeletons } from '../components/ui';
import { countdown, dateLabel, fmtTime } from '../format';
import { setSetting, useApi, useNow, useSetting } from '../hooks';

export default function MatchPage() {
  const { id = '' } = useParams();
  const q = useApi<MatchDetails>(`/matches/${encodeURIComponent(id)}`, 30_000);
  const m = q.data?.data;
  const [tab, setTab] = useState<'watch' | 'channels'>('watch');
  const [search, setSearch] = useState('');
  const [sharingOnly, setSharingOnly] = useState(false);
  const sortBySat = useSetting('sortBySatellite', '0') === '1';

  const channels = useMemo(() => {
    let list = m?.channels ?? [];
    if (search.trim()) list = list.filter((c) => `${c.name} ${c.tuning ?? ''}`.toLowerCase().includes(search.trim().toLowerCase()));
    if (sharingOnly) list = list.filter((c) => c.sharing_supported);
    if (sortBySat) list = [...list].sort((a, b) => (a.satellite ?? '').localeCompare(b.satellite ?? ''));
    return list;
  }, [m, search, sharingOnly, sortBySat]);

  return (
    <>
      <Header title={m ? `${m.home_team.name} × ${m.away_team.name}` : 'المباراة'} back>
        {m && <Scoreboard m={m} />}
      </Header>
      <main className="px-3">
        {q.error && !m ? (
          <ErrorState error={q.error} retry={q.reload} />
        ) : !m ? (
          <div className="mt-4">
            <Skeletons n={6} h="h-16" />
          </div>
        ) : (
          <>
            <div role="tablist" className="sticky top-0 z-10 -mx-3 mt-0 flex border-b border-line bg-body px-3">
              {(
                [
                  ['watch', 'شاهد على'],
                  ['channels', `قنوات البث (${m.channels.length})`],
                ] as const
              ).map(([k, label]) => (
                <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`flex-1 border-b-2 py-3 text-sm font-extrabold ${tab === k ? 'border-blue text-blue' : 'border-transparent text-muted'}`}>
                  {label}
                </button>
              ))}
            </div>

            {tab === 'watch' ? (
              <div className="mt-4 space-y-4">
                <div>
                  <h3 className="mb-2 text-sm font-extrabold">القناة العربية</h3>
                  {m.watch_on ? (
                    <div className="flex items-center gap-3 rounded-lg bg-card p-3">
                      <Logo src={m.watch_on.logo} className="h-10 w-12" />
                      <span className="font-extrabold" dir="ltr">
                        {m.watch_on.name}
                      </span>
                    </div>
                  ) : (
                    <Empty>غير متوفر</Empty>
                  )}
                </div>
                <div>
                  <h3 className="mb-2 text-sm font-extrabold">المعلق</h3>
                  <div className="rounded-lg bg-card p-3 font-bold">{m.commentator ?? 'غير متوفر'}</div>
                </div>
                {m.source_url && (
                  <p className="text-xs text-muted">
                    المصدر:{' '}
                    <a href={m.source_url} target="_blank" rel="noreferrer" className="underline">
                      Fixtures OnSAT
                    </a>
                  </p>
                )}
              </div>
            ) : (
              <div className="mt-2">
                <SearchBox value={search} onChange={setSearch} placeholder="ابحث عن قناة..." />
                <div className="my-3 flex flex-wrap gap-2 text-xs font-bold">
                  <button onClick={() => setSharingOnly((v) => !v)} aria-pressed={sharingOnly} className={`rounded-full px-3 py-1.5 ${sharingOnly ? 'bg-blue text-white' : 'bg-card'}`}>
                    Sharing Info فقط
                  </button>
                  <button onClick={() => setSetting('sortBySatellite', sortBySat ? '0' : '1')} aria-pressed={sortBySat} className={`rounded-full px-3 py-1.5 ${sortBySat ? 'bg-blue text-white' : 'bg-card'}`}>
                    ترتيب حسب القمر
                  </button>
                </div>
                {channels.length ? (
                  <div className="space-y-1.5">
                    {channels.map((c) => (
                      <ChannelCard key={c.id} c={c} />
                    ))}
                  </div>
                ) : (
                  <Empty>{m.channels.length ? 'لا توجد قنوات مطابقة' : 'لا تتوفر قائمة قنوات لهذه المباراة'}</Empty>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </>
  );
}

function Scoreboard({ m }: { m: MatchDetails }) {
  const now = useNow(30_000);
  const timeFormat = useSetting('timeFormat', '12');
  const showScore = m.status !== 'upcoming' && m.score.home !== null;
  return (
    <div className="mt-4">
      {m.competition && (
        <Link to={`/leagues/${m.competition.id}`} className="mx-auto flex w-fit items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-bold">
          <Logo src={m.competition.logo} className="h-5 w-5" />
          {m.competition.name}
          {m.round && <span className="opacity-80">· {m.round}</span>}
        </Link>
      )}
      <div className="mt-4 grid grid-cols-3 items-center text-center">
        {[m.home_team, null, m.away_team].map((t, i) =>
          t ? (
            <Link key={i} to={`/team/${t.id}`} className="flex flex-col items-center gap-2">
              <Logo src={t.logo} className="h-14 w-14" />
              <span className="text-sm font-extrabold">{t.name}</span>
            </Link>
          ) : (
            <div key={i} className="flex flex-col items-center gap-1">
              {showScore ? (
                <span className="text-3xl font-extrabold" dir="ltr">
                  {m.score.home} - {m.score.away}
                </span>
              ) : (
                <button onClick={() => setSetting('timeFormat', timeFormat === '24' ? '12' : '24')} className="text-2xl font-extrabold" title="تبديل 12/24 ساعة">
                  {fmtTime(m.kickoff, timeFormat)}
                </button>
              )}
              <span className={`text-xs font-bold ${isLive(m) ? 'pulse rounded-full bg-live px-2 py-0.5' : 'opacity-85'}`}>
                {m.status === 'upcoming'
                  ? countdown(m.kickoff, now) ?? 'تبدأ الآن'
                  : m.status === 'live'
                    ? m.minute ?? 'مباشر'
                    : { halftime: 'استراحة', finished: 'إنتهت', postponed: 'مؤجلة', cancelled: 'ملغاة' }[m.status]}
              </span>
              <span className="text-[11px] opacity-80">{dateLabel(m.kickoff)}</span>
            </div>
          ),
        )}
      </div>
      {m.status_source === 'estimated' && m.status !== 'upcoming' && (
        <p className="mt-3 flex items-center justify-center gap-1 text-[11px] opacity-75">
          <Icon name="x" size={12} /> الحالة تقديرية حسب موعد المباراة
        </p>
      )}
    </div>
  );
}
