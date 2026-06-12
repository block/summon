import type { ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import '../styles.css';

export async function mountPage({
  bodyClass,
  children,
  loadController,
}: {
  bodyClass: string;
  children: ReactNode;
  loadController?: () => Promise<unknown>;
}): Promise<void> {
  const rootEl = document.getElementById('root');
  if (!rootEl) throw new Error('missing #root');

  document.body.className = bodyClass;
  const root = createRoot(rootEl);
  flushSync(() => {
    root.render(children);
  });

  await loadController?.();
}
