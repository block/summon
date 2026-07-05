import { useEffect, useRef, useState } from 'react';
import type { GenerationTrace } from '../generationTrace.js';
import { TraceTimeline } from './TraceTimeline.js';

export function ReceiptTab({ trace }: { trace: GenerationTrace }) {
  const [open, setOpen] = useState(false);
  const tabRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const hasReceipt = trace.receipt !== null;

  useEffect(() => {
    if (!open) return;
    const prior = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        window.setTimeout(() => (prior ?? tabRef.current)?.focus(), 0);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!hasReceipt) return null;
  const summary = trace.conformance?.summary;
  const label = summary ? `receipt · ${summary.pass}p/${summary.fail}f` : 'receipt';
  const close = () => {
    setOpen(false);
    window.setTimeout(() => tabRef.current?.focus(), 0);
  };

  return (
    <>
      <button
        ref={tabRef}
        type="button"
        className="absolute -bottom-3 right-6 z-[4] rounded-full border border-line bg-ink px-3 py-1.5 font-mono text-[11px] font-semibold uppercase text-ink-inverse shadow-card motion-safe:animate-[summon-blur-fade-up_420ms_cubic-bezier(0.22,1,0.36,1)_both]"
        aria-expanded={open}
        aria-controls="trace-receipt-panel"
        onClick={() => setOpen(true)}
      >
        {label}
      </button>
      {open ? (
        <div className="absolute inset-0 z-[5] rounded-[32px] motion-safe:animate-[summon-blur-fade-up_320ms_cubic-bezier(0.22,1,0.36,1)_both]">
          <button type="button" className="absolute inset-0 rounded-[32px] bg-ink/20 backdrop-blur-[2px]" aria-label="Close receipt" onClick={close} />
          <div
            id="trace-receipt-panel"
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            tabIndex={-1}
            className="absolute inset-4 overflow-auto rounded-[28px] border border-line bg-surface-raised p-4 shadow-elevated outline-none"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="m-0 text-lg font-semibold text-ink">Generation receipt</h3>
                <p className="m-0 mt-1 text-xs text-ink-muted">Trace collapsed from the streamed protocol.</p>
              </div>
              <button type="button" className="rounded-full border border-line px-3 py-1 text-xs font-semibold text-ink-soft" onClick={close}>Close</button>
            </div>
            <TraceTimeline trace={trace} />
          </div>
        </div>
      ) : null}
    </>
  );
}
