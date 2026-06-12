import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { cn } from './lib/cn.js';
import { LandingPage } from './pages/LandingPage.js';

const AdversarialPage = lazy(() => import('./pages/AdversarialPage.js').then((module) => ({ default: module.AdversarialPage })));
const BatchPage = lazy(() => import('./pages/BatchPage.js').then((module) => ({ default: module.BatchPage })));
const FatalPage = lazy(() => import('./pages/FatalPage.js').then((module) => ({ default: module.FatalPage })));
const FragmentComparePage = lazy(() => import('./pages/FragmentComparePage.js').then((module) => ({ default: module.FragmentComparePage })));
const GeneratePage = lazy(() => import('./pages/generate/GeneratePage.js').then((module) => ({ default: module.GeneratePage })));
const StrictPage = lazy(() => import('./pages/StrictPage.js').then((module) => ({ default: module.StrictPage })));

export function App() {
  const { pathname } = useLocation();
  const isLanding = pathname === '/';

  return (
    <div className={cn(
      'min-h-screen bg-surface text-ink',
      isLanding ? 'flex flex-col' : 'px-10 pb-[72px] pt-12 max-[820px]:px-4 max-[820px]:pb-14 max-[820px]:pt-7',
    )}>
      <Suspense fallback={<div className="mx-auto w-[min(100%,var(--dev-page-width))] text-ink-soft">Loading...</div>}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/generate" element={<GeneratePage />} />
          <Route path="/batch" element={<BatchPage />} />
          <Route path="/fragment-compare" element={<FragmentComparePage />} />
          <Route path="/adversarial" element={<AdversarialPage />} />
          <Route path="/strict" element={<StrictPage />} />
          <Route path="/fatal" element={<FatalPage />} />
          <Route path="*" element={<Navigate to="/generate" replace />} />
        </Routes>
      </Suspense>
    </div>
  );
}
