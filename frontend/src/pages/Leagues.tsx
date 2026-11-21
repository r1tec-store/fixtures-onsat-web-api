import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { userTz, type Competition, type Match, type Team } from '../api';
import { MatchRow } from '../components/match';
import { Empty, ErrorState, Header, ListLink, Logo, SearchBox, SectionTitle, Skeletons } from '../components/ui';
import { dateLabel } from '../format';
import { useApi } from '../hooks';

const tz = encodeURIComponent(userTz);

export function Leagues() {
  const q = useApi<Competition[]>('/competitions?limit=500');
  const [search, setSearch] = useState('');
  const groups = useMemo(() => {
    const out = new Map<string, Competition[]>();
    for (const c of q.data?.data ?? []) {
      if (search && !c.name.includes(search.trim())) continue;
      const k = c.category ?? 'بطولات أخرى';
      out.set(k, [...(out.get(k) ?? []), c]);
    }
    return [...out];
  }, [q.data, search]);

  return (
    <>
      <Header title="البطولات" />
      <main className="px-3">
        <SearchBox value={search} onChange={setSearch} placeholder="ابحث عن بطولة..." />
        {q.error && !q.data ? (
          <ErrorState error={q.error} retry={q.reload} />
        ) : !q.data ? (
          <div className="mt-4">
            <Skeletons n={8} />
          </div>
        ) : groups.length === 0 ? (
          <Empty>لا توجد نتائج</Empty>
        ) : (
          groups.map(([cat, list]) => (
            <section key={cat}>
              <SectionTitle>{cat}</SectionTitle>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {list.map((c) => (
                  <ListLink key={c.id} to={`/leagues/${c.id}`} logo={c.logo} title={c.name} subtitle={c.match_count ? `${c.match_count} مباراة` : undefined} />
                ))}
              </div>
            </section>
          ))
        )}
      </main>
    </>
  );
}

/** Group a fixture list by round (or by date when no rounds), picking the current group. */
function useGroups(matches: Match[]) {
  return useMemo(() => {
    const groups: Array<{ key: string; label: string; items: Match[] }> = [];
    for (const m of matches) {
      const key = m.round ?? m.kickoff.slice(0, 10);
      let g = groups.find((x) => x.key === key);
      if (!g) groups.push((g = { key, label: m.round ?? dateLabel(m.kickoff), items: [] }));
      g.items.push(m);
    }
    const now = Date.now();
    const current = Math.max(
      0,
      groups.findIndex((g) => g.items.some((m) => m.status !== 'finished' && Date.parse(m.kickoff) > now - 3 * 3600_000)),
    );
    return { groups, current };
  }, [matches]);
}

export function LeaguePage() {
  const { id = '' } = useParams();
  const comp = useApi<Competition>(`/competitions/${encodeURIComponent(id)}`);
  const q = useApi<Match[]>(`/competitions/${encodeURIComponent(id)}/matches?limit=500&tz=${tz}`, 60_000);
  return <FixtureList title={comp.data?.data.name ?? 'البطولة'} logo={comp.data?.data.logo} subtitle={comp.data?.data.season} q={q} />;
}

export function TeamPage() {
  const { id = '' } = useParams();
  const team = useApi<Team>(`/teams/${encodeURIComponent(id)}`);
  const q = useApi<Match[]>(`/teams/${encodeURIComponent(id)}/matches?limit=500&tz=${tz}`, 60_000);
  return <FixtureList title={team.data?.data.name ?? 'الفريق'} logo={team.data?.data.logo} q={q} byDate />;
}

function FixtureList({ title, logo, subtitle, q, byDate }: { title: string; logo?: string | null; subtitle?: string | null; q: ReturnType<typeof useApi<Match[]>>; byDate?: boolean }) {
  const matches = q.data?.data ?? [];
  const { groups, current } = useGroups(byDate ? matches.map((m) => ({ ...m, round: null })) : matches);
  const [sel, setSel] = useState<number | null>(null);
  useEffect(() => {
    setSel(null);
  }, [title]);
  const idx = sel ?? current;
  const g = groups[idx];

  return (
    <>
      <Header title={title} back>
        <div className="mt-4 flex items-center gap-3">
          <Logo src={logo} className="h-14 w-14 rounded-xl bg-white p-1.5" />
          <div>
            <p className="text-xl font-extrabold">{title}</p>
            {subtitle && <p className="text-sm opacity-80">{subtitle}</p>}
          </div>
        </div>
      </Header>
      <main className="px-3">
        {q.error && !q.data ? (
          <ErrorState error={q.error} retry={q.reload} />
        ) : !q.data ? (
          <div className="mt-4">
            <Skeletons n={8} />
          </div>
        ) : !g ? (
          <Empty>لا توجد مباريات</Empty>
        ) : (
          <>
            <div className="mt-4 flex items-center justify-between rounded-xl bg-card p-1">
              <button disabled={idx <= 0} onClick={() => setSel(idx - 1)} className="rounded-lg px-3 py-2 text-sm font-bold disabled:opacity-30" aria-label="السابق">
                ‹ السابق
              </button>
              <select value={idx} onChange={(e) => setSel(Number(e.target.value))} className="bg-transparent text-center text-sm font-extrabold outline-none" aria-label="اختر الجولة">
                {groups.map((x, i) => (
                  <option key={x.key} value={i}>
                    {x.label}
                  </option>
                ))}
              </select>
              <button disabled={idx >= groups.length - 1} onClick={() => setSel(idx + 1)} className="rounded-lg px-3 py-2 text-sm font-bold disabled:opacity-30" aria-label="التالي">
                التالي ›
              </button>
            </div>
            <div className="mt-3 space-y-[3px]">
              {g.items.map((m, i) => (
                <div key={m.id}>
                  {!byDate && (i === 0 || g.items[i - 1]!.kickoff.slice(0, 10) !== m.kickoff.slice(0, 10)) && <p className="mb-1 mt-3 text-xs font-bold text-muted">{dateLabel(m.kickoff)}</p>}
                  <MatchRow m={m} />
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </>
  );
}
