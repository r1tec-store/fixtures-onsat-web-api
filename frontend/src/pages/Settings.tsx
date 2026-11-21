import type { ReactNode } from 'react';
import { API_BASE, STATIC_MODE } from '../api';
import { Header, SectionTitle } from '../components/ui';
import { setSetting, useSetting } from '../hooks';

function Toggle({ label, value, options, onChange }: { label: string; value: string; options: Array<[string, string]>; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-card px-3 py-3">
      <span className="text-sm font-bold">{label}</span>
      <div className="flex rounded-lg bg-body p-0.5">
        {options.map(([v, l]) => (
          <button key={v} onClick={() => onChange(v)} aria-pressed={value === v} className={`rounded-md px-3 py-1 text-xs font-bold ${value === v ? 'bg-blue text-white' : 'text-muted'}`}>
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Settings() {
  const theme = useSetting('theme', 'auto');
  const timeFormat = useSetting('timeFormat', '12');
  const sortBySat = useSetting('sortBySatellite', '0');
  return (
    <>
      <Header title="الإعدادات" back />
      <main className="space-y-2 px-3">
        <SectionTitle>المظهر</SectionTitle>
        <Toggle label="الوضع" value={theme} options={[['light', 'فاتح'], ['dark', 'داكن'], ['auto', 'تلقائي']]} onChange={(v) => setSetting('theme', v)} />
        <SectionTitle>إعدادات صفحة المباراة</SectionTitle>
        <Toggle label="تنسيق الوقت" value={timeFormat} options={[['12', '12 ساعة'], ['24', '24 ساعة']]} onChange={(v) => setSetting('timeFormat', v)} />
        <Toggle label="ترتيب القنوات حسب القمر" value={sortBySat} options={[['0', 'لا'], ['1', 'نعم']]} onChange={(v) => setSetting('sortBySatellite', v)} />
        <button onClick={() => setSetting('favoriteTeamId', null)} className="w-full rounded-lg bg-card px-3 py-3 text-start text-sm font-bold text-live">
          إلغاء النادي المفضل
        </button>
      </main>
    </>
  );
}

const Code = ({ children }: { children: ReactNode }) => (
  <pre dir="ltr" className="overflow-x-auto rounded-lg bg-card p-3 text-left text-xs">
    <code>{children}</code>
  </pre>
);

export function About() {
  const base = API_BASE || (STATIC_MODE ? 'https://<your-api-host>' : window.location.origin);
  const dataBase = new URL('./data', window.location.href.split('#')[0]).href;
  return (
    <>
      <Header title="واجهة API للمطورين" back />
      <main className="space-y-3 px-3 text-sm leading-7">
        {STATIC_MODE && (
          <>
            <SectionTitle>ملفات JSON الثابتة (GitHub Pages)</SectionTitle>
            <p>
              هذه النسخة مستضافة على GitHub Pages وتُحدَّث تلقائيًا كل 30 دقيقة تقريبًا. يمكن قراءة البيانات مباشرة من الملفات التالية (بدون فلاتر):
            </p>
            <Code>{`GET ${dataBase}/meta.json
GET ${dataBase}/matches.json
GET ${dataBase}/matches/{id}.json      # channels, kickoff -3h…+30h
GET ${dataBase}/competitions.json
GET ${dataBase}/teams.json
GET ${dataBase}/satellites.json
GET ${dataBase}/satellites/{id}.json
GET ${dataBase}/feeds.json`}</Code>
            <p className="text-muted">للفلاتر والمناطق الزمنية والنتائج الفورية، شغّل واجهة REST الكاملة (Node) كما في ملف README.</p>
          </>
        )}
        <SectionTitle>Fixtures OnSAT REST API</SectionTitle>
        <p>
          كل البيانات في هذا الموقع متاحة عبر واجهة REST مستقلة يمكن استخدامها في أي تطبيق (مثل مشغل IPTV). الاستجابات بصيغة JSON موحّدة، والتوقيت بصيغة UTC
          مع دعم المنطقة الزمنية عبر <code>tz</code>.
        </p>
        <Code>{`GET ${base}/api/v1/matches/today?tz=Africa/Cairo
GET ${base}/api/v1/matches/live
GET ${base}/api/v1/matches/date/2026-11-22
GET ${base}/api/v1/matches/{id}            # incl. channels
GET ${base}/api/v1/competitions
GET ${base}/api/v1/teams?q=ريال
GET ${base}/api/v1/channels?satellite=nilesat`}</Code>
        <p>
          <a className="font-bold text-blue underline" href={`${base}/docs`} target="_blank" rel="noreferrer">
            التوثيق التفاعلي (Swagger)
          </a>{' '}
          ·{' '}
          <a className="font-bold text-blue underline" href={`${base}/openapi.json`} target="_blank" rel="noreferrer">
            OpenAPI 3.0
          </a>
        </p>
        <SectionTitle>مصادر البيانات</SectionTitle>
        <p className="text-muted">
          جداول المباريات والقنوات من صفحات Fixtures OnSAT العامة (fixturessat.blogspot.com). النتائج المباشرة من لوحة نتائج ESPN العامة عند توفرها؛ وإلا
          تُقدَّر الحالة حسب موعد المباراة. هذا مشروع مستقل غير تابع لأي من الجهتين.
        </p>
      </main>
    </>
  );
}
