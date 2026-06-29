import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { cn } from './lib/cn.js';
import { LandingPage } from './pages/LandingPage.js';
import { ThemeProvider, ThemeToggle } from './theme.js';

const AdversarialPage = lazy(() => import('./pages/AdversarialPage.js').then((module) => ({ default: module.AdversarialPage })));
const BatchPage = lazy(() => import('./pages/BatchPage.js').then((module) => ({ default: module.BatchPage })));
const GeneratePage = lazy(() => import('./pages/generate/GeneratePage.js').then((module) => ({ default: module.GeneratePage })));
function AppRoutes() {
  const { pathname } = useLocation();
  const isLanding = pathname === '/';
  const isGenerate = pathname === '/generate';
  const isFullBleed = isGenerate;

  return (
    <div className={cn(
      'min-h-screen bg-surface text-ink transition-colors duration-150',
      isLanding ? 'flex flex-col' : isFullBleed ? 'overflow-hidden' : 'px-10 pb-[72px] pt-12 max-[820px]:px-4 max-[820px]:pb-14 max-[820px]:pt-7',
    )}>
      {isFullBleed ? null : <ThemeToggle />}
      <Suspense fallback={<div className="mx-auto w-[min(100%,var(--dev-page-width))] text-ink-soft">Loading...</div>}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/generate" element={<GeneratePage />} />
          <Route path="/batch" element={<BatchPage />} />
          <Route path="/adversarial" element={<AdversarialPage />} />
          <Route path="*" element={<Navigate to="/generate" replace />} />
        </Routes>
      </Suspense>
    </div>
  );
}

export function App() {
  return (
    <ThemeProvider>
      <AppRoutes />
    </ThemeProvider>
  );
}
