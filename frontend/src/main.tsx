import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Route, Routes, useLocation } from 'react-router-dom';
import './index.css';
import { BottomNav, Empty, Header } from './components/ui';
import { useSetting } from './hooks';
import Home from './pages/Home';
import MatchPage from './pages/MatchPage';
import { LeaguePage, Leagues, TeamPage } from './pages/Leagues';
import { Feeds, SatellitePage, Satellites } from './pages/Satellites';
import { About, Settings } from './pages/Settings';

function useTheme() {
  const theme = useSetting('theme', 'auto');
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => document.documentElement.classList.toggle('dark', theme === 'dark' || (theme === 'auto' && mq.matches));
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);
}

function ScrollTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function App() {
  useTheme();
  return (
    // HashRouter: deep links work on any static host (GitHub Pages) without server rewrites.
    <HashRouter>
      <ScrollTop />
      <div className="mx-auto min-h-dvh max-w-3xl pb-24">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/match/:id" element={<MatchPage />} />
          <Route path="/leagues" element={<Leagues />} />
          <Route path="/leagues/:id" element={<LeaguePage />} />
          <Route path="/team/:id" element={<TeamPage />} />
          <Route path="/satellites" element={<Satellites />} />
          <Route path="/satellites/:id" element={<SatellitePage />} />
          <Route path="/feeds" element={<Feeds />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/about" element={<About />} />
          <Route
            path="*"
            element={
              <>
                <Header title="غير موجود" back />
                <Empty>الصفحة غير موجودة</Empty>
              </>
            }
          />
        </Routes>
      </div>
      <BottomNav />
    </HashRouter>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
