import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { LandingPage } from './pages/LandingPage.js';

const AdversarialPage = lazy(() => import('./pages/AdversarialPage.js').then((module) => ({ default: module.AdversarialPage })));
const BatchPage = lazy(() => import('./pages/BatchPage.js').then((module) => ({ default: module.BatchPage })));
const FatalPage = lazy(() => import('./pages/FatalPage.js').then((module) => ({ default: module.FatalPage })));
const FragmentComparePage = lazy(() => import('./pages/FragmentComparePage.js').then((module) => ({ default: module.FragmentComparePage })));
const GeneratePage = lazy(() => import('./pages/generate/GeneratePage.js').then((module) => ({ default: module.GeneratePage })));
const StrictPage = lazy(() => import('./pages/StrictPage.js').then((module) => ({ default: module.StrictPage })));

export function App() {
  const { pathname } = useLocation();
  const className = pathname === '/'
    ? 'landing'
    : [
        'dev-page',
        pathname === '/generate' ? 'generate-page' : '',
        pathname === '/batch' ? 'batch-page' : '',
        pathname === '/fragment-compare' ? 'fragment-compare-page' : '',
        pathname === '/strict' || pathname === '/fatal' || pathname === '/adversarial' ? 'utility-page' : '',
      ].filter(Boolean).join(' ');

  return (
    <div className={`app-shell ${className}`}>
      <Suspense fallback={<div className="route-loading">Loading...</div>}>
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
