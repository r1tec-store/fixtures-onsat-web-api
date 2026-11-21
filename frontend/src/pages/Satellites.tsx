import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { Channel, Feed, Satellite } from '../api';
import { ChannelCard } from '../components/match';
import { Empty, ErrorState, Header, ListLink, Logo, SearchBox, SectionTitle, Skeletons } from '../components/ui';
import { useApi } from '../hooks';

export function Satellites() {
  const q = useApi<Satellite[]>('/satellites');
  const [search, setSearch] = useState('');
  const groups = useMemo(() => {
    const out = new Map<string, Satellite[]>();
    for (const s of q.data?.data ?? []) {
      if (search && !s.name.toLowerCase().includes(search.trim().toLowerCase())) continue;
      const k = s.region ?? 'أقمار أخرى';
      out.set(k, [...(out.get(k) ?? []), s]);
    }
    return [...out];
  }, [q.data, search]);

  return (
    <>
      <Header title="الأقمار" />
      <main className="px-3">
        <SearchBox value={search} onChange={setSearch} placeholder="ابحث عن قمر..." />
        {q.error && !q.data ? (
          <ErrorState error={q.error} retry={q.reload} />
        ) : !q.data ? (
          <div className="mt-4">
            <Skeletons n={8} />
          </div>
        ) : groups.length === 0 ? (
          <Empty>لا توجد نتائج</Empty>
        ) : (
          groups.map(([region, list]) => (
            <section key={region}>
              <SectionTitle>{region}</SectionTitle>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {list.map((s) => (
                  <ListLink key={s.id} to={`/satellites/${s.id}`} title={s.name} subtitle={`${s.channel_count} قناة`} />
                ))}
              </div>
            </section>
          ))
        )}
      </main>
    </>
  );
}

export function SatellitePage() {
  const { id = '' } = useParams();
  const sats = useApi<Satellite[]>('/satellites');
  const q = useApi<Channel[]>(`/satellites/${encodeURIComponent(id)}/channels`);
  const [search, setSearch] = useState('');
  const name = sats.data?.data.find((s) => s.id === id)?.name ?? 'القمر';
  const list = (q.data?.data ?? []).filter((c) => !search.trim() || c.name.toLowerCase().includes(search.trim().toLowerCase()));
  return (
    <>
      <Header title={`قمر ${name}`} back />
      <main className="px-3">
        <SearchBox value={search} onChange={setSearch} placeholder="ابحث عن قناة..." />
        <div className="mt-3">
          {q.error && !q.data ? (
            <ErrorState error={q.error} retry={q.reload} />
          ) : !q.data ? (
            <Skeletons n={8} h="h-16" />
          ) : list.length === 0 ? (
            <Empty>لا توجد قنوات</Empty>
          ) : (
            <div className="space-y-1.5">
              {list.map((c) => (
                <ChannelCard key={c.id} c={c} />
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  );
}

export function Feeds() {
  const q = useApi<Feed[]>('/feeds', 120_000);
  const [copied, setCopied] = useState<string | null>(null);
  const copy = (f: Feed) => {
    navigator.clipboard?.writeText(`${f.tuning}${f.encryption ? ` | ${f.encryption}` : ''}`).then(() => {
      setCopied(f.id);
      setTimeout(() => setCopied(null), 1500);
    });
  };
  return (
    <>
      <Header title="الفيدات" />
      <main className="px-3">
        <SectionTitle>ترددات الفيد المتاحة</SectionTitle>
        {q.error && !q.data ? (
          <ErrorState error={q.error} retry={q.reload} />
        ) : !q.data ? (
          <Skeletons n={4} h="h-24" />
        ) : q.data.data.length === 0 ? (
          <Empty>لا توجد فيدات منشورة حاليًا. تُضاف الفيدات من المصدر قبل المباريات.</Empty>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {q.data.data.map((f) => (
              <button key={f.id} onClick={() => copy(f)} className="rounded-xl bg-card p-3 text-start" title="نسخ التردد">
                <div className="font-extrabold" dir="ltr" style={{ textAlign: 'right' }}>
                  {f.tuning}
                </div>
                <div className="text-xs text-muted">{copied === f.id ? 'تم النسخ ✓' : `Biss: ${f.encryption ?? '-'}`}</div>
                {f.home_team && f.away_team && (
                  <div className="mt-2 flex items-center justify-between border-t border-line pt-2 text-sm font-bold">
                    <span className="flex items-center gap-1.5">
                      <Logo src={f.home_team.logo} className="h-5 w-5" /> {f.home_team.name}
                    </span>
                    <span className="flex items-center gap-1.5">
                      {f.away_team.name} <Logo src={f.away_team.logo} className="h-5 w-5" />
                    </span>
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
