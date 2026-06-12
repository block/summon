import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { LandingPage } from './pages/LandingPage.js';
import { AdversarialPage } from './pages/AdversarialPage.js';
import { BatchPage } from './pages/BatchPage.js';
import { FatalPage } from './pages/FatalPage.js';
import { FragmentComparePage } from './pages/FragmentComparePage.js';
import { GeneratePage } from './pages/GeneratePage.js';
import { StrictPage } from './pages/StrictPage.js';

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
    </div>
  );
}
