import { useState, type ReactNode } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';

const PATHS = {
  back: 'M15 6l-6 6 6 6',
  next: 'M9 6l6 6-6 6',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3',
  home: 'M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  feed: 'M4 11a9 9 0 0 1 9 9M4 4a16 16 0 0 1 16 16M5 19h.01',
  sat: 'M13 7L9 3 5 7l4 4M17 11l4 4-4 4-4-4M8 12l4 4M16 8l-4 4M3 21c0-3 2-5 5-5',
  cup: 'M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3',
  lock: 'M6 11h12v10H6zM8 11V7a4 4 0 0 1 8 0v4',
  unlock: 'M6 11h12v10H6zM8 11V7a4 4 0 0 1 7.5-2',
  share: 'M18 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8.6 13.5l6.8 4M15.4 6.5l-6.8 4',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  x: 'M6 6l12 12M18 6L6 18',
  star: 'M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z',
  api: 'M8 9l-4 3 4 3M16 9l4 3-4 3M14 5l-4 14',
};

export function Icon({ name, size = 20, className = '' }: { name: keyof typeof PATHS; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}

/** Image that hides itself if the remote logo fails (remote crests are third-party hosted). */
export function Logo({ src, className = 'h-6 w-6', alt = '' }: { src: string | null | undefined; className?: string; alt?: string }) {
  const [broken, setBroken] = useState(false);
  if (!src || broken) return <span className={`${className} inline-block rounded-full bg-line/60`} aria-hidden="true" />;
  return <img src={src} alt={alt} loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} className={`${className} object-contain`} />;
}

export function Header({ title, back, children, action }: { title: ReactNode; back?: boolean; children?: ReactNode; action?: ReactNode }) {
  const nav = useNavigate();
  return (
    <header className="bg-blue px-4 pb-6 pt-4 text-white sm:rounded-b-2xl">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/15 text-sm font-extrabold">FX</span>
          <h1 className="truncate text-lg font-extrabold">{title}</h1>
        </div>
        <div className="flex items-center gap-1">
          {action}
          {back && (
            <button onClick={() => (history.length > 1 ? nav(-1) : nav('/'))} className="rounded-full p-2 hover:bg-white/15" aria-label="رجوع">
              <Icon name="back" className="rotate-180" />
            </button>
          )}
        </div>
      </div>
      {children}
    </header>
  );
}

export function BottomNav() {
  const items = [
    { to: '/', label: 'الرئيسية', icon: 'home' as const },
    { to: '/feeds', label: 'الفيدات', icon: 'feed' as const },
    { to: '/satellites', label: 'الأقمار', icon: 'sat' as const },
    { to: '/leagues', label: 'البطولات', icon: 'cup' as const },
  ];
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line backdrop-blur" style={{ background: 'var(--nav-bg)' }} aria-label="التنقل الرئيسي">
      <div className="mx-auto grid max-w-3xl grid-cols-4 pb-[env(safe-area-inset-bottom)]">
        {items.map((it) => (
          <NavLink key={it.to} to={it.to} end={it.to === '/'} className={({ isActive }) => `flex flex-col items-center gap-0.5 py-2 text-xs font-bold ${isActive ? 'text-blue' : 'text-muted'}`}>
            <Icon name={it.icon} size={22} />
            {it.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-2 mt-5 flex items-center justify-between">
      <h2 className="border-s-4 border-blue ps-2 text-base font-extrabold">{children}</h2>
      {action}
    </div>
  );
}

export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label className="relative mt-3 block">
      <span className="sr-only">{placeholder}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full rounded-xl border border-line bg-card py-2.5 pe-10 ps-3 text-sm outline-none focus:border-blue" />
      <Icon name="search" size={18} className="absolute end-3 top-1/2 -translate-y-1/2 text-muted" />
    </label>
  );
}

export function Skeletons({ n = 5, h = 'h-14' }: { n?: number; h?: string }) {
  return (
    <div className="space-y-1.5" aria-busy="true" aria-label="جاري التحميل">
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className={`skeleton ${h} rounded-md`} />
      ))}
    </div>
  );
}

export function ErrorState({ error, retry }: { error: Error; retry: () => void }) {
  return (
    <div role="alert" className="my-8 rounded-xl border border-line bg-card p-6 text-center">
      <p className="font-bold">تعذر تحميل البيانات</p>
      <p className="mt-1 text-sm text-muted">{error.message}</p>
      <button onClick={retry} className="mt-4 rounded-lg bg-blue px-5 py-2 text-sm font-bold text-white">
        إعادة المحاولة
      </button>
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="my-8 rounded-xl bg-card p-6 text-center text-sm text-muted">{children}</div>;
}

export function ListLink({ to, logo, title, subtitle }: { to: string; logo?: string | null; title: string; subtitle?: string }) {
  return (
    <Link to={to} className="flex items-center gap-3 rounded-lg bg-card px-3 py-2.5 transition hover:bg-line/50">
      {logo !== undefined && <Logo src={logo} className="h-8 w-8" />}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold">{title}</span>
        {subtitle && <span className="block text-xs text-muted">{subtitle}</span>}
      </span>
      <Icon name="back" size={16} className="text-muted" />
    </Link>
  );
}
