import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { userTz, type Match, type Team } from '../api';
import { GroupedMatches, isLive, MatchRow } from '../components/match';
import { Empty, ErrorState, Header, Icon, Logo, SearchBox, SectionTitle, Skeletons } from '../components/ui';
import { addDays, DAYS, dateLabel, ymd } from '../format';
import { setSetting, useApi, useSetting } from '../hooks';

const tz = encodeURIComponent(userTz);

export default function Home() {
  const [offset, setOffset] = useState(0); // first day shown in the 3-day strip (0 = today)
  const [day, setDay] = useState(0);
  const [liveOnly, setLiveOnly] = useState(false);
  const today = useMemo(() => new Date(), []);
  const selected = addDays(today, day);
  const q = useApi<Match[]>(`/matches/date/${ymd(selected)}?tz=${tz}&limit=500`, 30_000);
  const matches = q.data?.data ?? [];
  const shown = liveOnly ? matches.filter(isLive) : matches;

  return (
    <>
      <Header
        title="جدول المباريات"
        action={
          <Link to="/settings" className="rounded-full p-2 hover:bg-white/15" aria-label="الإعدادات">
            <Icon name="gear" />
          </Link>
        }
      >
        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            onClick={() => setLiveOnly((v) => !v)}
            aria-pressed={liveOnly}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold ${liveOnly ? 'bg-white text-live' : 'bg-white/15'}`}
          >
            <span className={liveOnly ? 'pulse' : ''}>●</span> مباشر
          </button>
          <div className="flex items-center gap-1">
            <button onClick={() => setOffset((o) => o - 1)} className="rounded-full p-1.5 hover:bg-white/15" aria-label="الأيام السابقة">
              <Icon name="next" size={16} />
            </button>
            {[0, 1, 2].map((i) => {
              const d = addDays(today, offset + i);
              const active = offset + i === day;
              return (
                <button
                  key={i}
                  onClick={() => setDay(offset + i)}
                  aria-pressed={active}
                  className={`flex w-14 flex-col items-center rounded-xl py-1 ${active ? 'bg-white text-blue' : 'bg-white/10'}`}
                >
                  <span className="text-lg font-extrabold leading-tight">{d.getDate()}</span>
                  <span className="text-[10px] font-bold">{offset + i === 0 ? 'اليوم' : DAYS[d.getDay()]}</span>
                </button>
              );
            })}
            <button onClick={() => setOffset((o) => o + 1)} className="rounded-full p-1.5 hover:bg-white/15" aria-label="الأيام التالية">
              <Icon name="back" size={16} />
            </button>
          </div>
        </div>
      </Header>

      <main className="px-3">
        <FavoriteTeam />
        <SectionTitle>مباريات {dateLabel(selected.toISOString())}</SectionTitle>
        {q.error && !q.data ? (
          <ErrorState error={q.error} retry={q.reload} />
        ) : !q.data ? (
          <Skeletons n={8} />
        ) : shown.length === 0 ? (
          <Empty>{liveOnly ? 'لا توجد مباريات مباشرة الآن' : 'لا توجد مباريات في هذا اليوم'}</Empty>
        ) : (
          <GroupedMatches matches={shown} />
        )}
        <QuickLinks />
      </main>
    </>
  );
}

function FavoriteTeam() {
  const favId = useSetting('favoriteTeamId', '');
  const [picking, setPicking] = useState(false);
  const [search, setSearch] = useState('');
  const team = useApi<Team>(favId ? `/teams/${favId}` : null);
  const games = useApi<Match[]>(favId ? `/teams/${favId}/matches?status=upcoming,live,halftime&limit=3&tz=${tz}` : null, 60_000);
  const results = useApi<Team[]>(picking && search.trim().length > 1 ? `/teams?q=${encodeURIComponent(search.trim())}&limit=12` : null);

  if (!favId || picking) {
    return (
      <section className="mt-4 rounded-xl bg-card p-3">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-extrabold">
            <Icon name="star" size={18} className="text-amber-500" /> اختر ناديك المفضل
          </h2>
          {picking && favId && (
            <button onClick={() => setPicking(false)} aria-label="إغلاق" className="text-muted">
              <Icon name="x" size={18} />
            </button>
          )}
        </div>
        <SearchBox value={search} onChange={setSearch} placeholder="ابحث عن نادٍ أو منتخب..." />
        <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          {results.data?.data.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setSetting('favoriteTeamId', t.id);
                setPicking(false);
                setSearch('');
              }}
              className="flex items-center gap-2 rounded-lg bg-body px-2 py-2 text-start text-sm font-bold hover:ring-1 hover:ring-blue"
            >
              <Logo src={t.logo} className="h-6 w-6" />
              <span className="truncate">{t.name}</span>
            </button>
          ))}
        </div>
        {results.data && results.data.data.length === 0 && <p className="mt-2 text-xs text-muted">لا توجد نتائج</p>}
      </section>
    );
  }

  return (
    <section>
      <SectionTitle
        action={
          <button onClick={() => setPicking(true)} className="text-xs font-bold text-blue">
            تغيير
          </button>
        }
      >
        <span className="inline-flex items-center gap-2">
          <Logo src={team.data?.data.logo} className="h-5 w-5" /> مباريات {team.data?.data.name ?? '...'}
        </span>
      </SectionTitle>
      {games.data ? (
        games.data.data.length ? (
          <div className="space-y-[3px]">
            {games.data.data.map((m) => (
              <MatchRow key={m.id} m={m} />
            ))}
          </div>
        ) : (
          <Empty>لا توجد مباريات قادمة لهذا الفريق</Empty>
        )
      ) : games.error ? (
        <ErrorState error={games.error} retry={games.reload} />
      ) : (
        <Skeletons n={2} />
      )}
    </section>
  );
}

function QuickLinks() {
  return (
    <>
      <SectionTitle>المزيد</SectionTitle>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { to: '/satellites', label: 'الأقمار والقنوات', icon: 'sat' as const },
          { to: '/feeds', label: 'الفيدات', icon: 'feed' as const },
          { to: '/leagues', label: 'البطولات', icon: 'cup' as const },
          { to: '/about', label: 'واجهة API للمطورين', icon: 'api' as const },
        ].map((l) => (
          <Link key={l.to} to={l.to} className="flex flex-col items-center gap-2 rounded-xl bg-card p-4 text-center text-sm font-bold hover:ring-1 hover:ring-blue">
            <Icon name={l.icon} size={26} className="text-blue" />
            {l.label}
          </Link>
        ))}
      </div>
    </>
  );
}
