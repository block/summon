import { forwardRef, useEffect, useRef, useState } from 'react';
import { cn } from '../../../lib/cn.js';
import type { ConformanceGlyph, GenerationTrace } from '../generationTrace.js';

export function ConformanceGlyphs({ trace }: { trace: GenerationTrace }) {
  const checks = trace.conformance?.checks ?? [];
  const [open, setOpen] = useState<number | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open === null) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(null); };
    const onPointer = (event: PointerEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) setOpen(null);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onPointer);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onPointer);
    };
  }, [open]);

  if (!checks.length) return null;
  return (
    <div className="absolute inset-x-6 bottom-3 z-[4] flex items-end justify-center gap-1.5" aria-label="Conformance checks">
      {checks.map((check, index) => {
        const pinned = check.verdict !== 'pass';
        return pinned ? (
          <button
            key={`${check.name}-${index}`}
            type="button"
            className={cn('relative grid min-h-6 min-w-6 place-items-center rounded-full border text-[11px] font-bold shadow-card motion-safe:animate-[summon-glyph-land_420ms_ease-out_both]', tone(check))}
            style={{ animationDelay: `${index * 70}ms` }}
            aria-label={`${check.name}: ${check.verdict} — ${check.reason}`}
            onClick={(event) => { event.stopPropagation(); setOpen(open === index ? null : index); }}
          >
            {check.verdict === 'fail' ? '!' : '?'}
            {open === index ? <GlyphPopover ref={popoverRef} check={check} /> : null}
          </button>
        ) : (
          <span
            key={`${check.name}-${index}`}
            className="h-2 w-2 rounded-full bg-success/75 motion-safe:animate-[summon-glyph-pass_1500ms_ease-out_both]"
            style={{ animationDelay: `${index * 70}ms` }}
            aria-hidden="true"
          />
        );
      })}
    </div>
  );
}

const GlyphPopover = forwardRef<HTMLDivElement, { check: ConformanceGlyph }>(function GlyphPopover({ check }, ref) {
  return (
    <div
      ref={ref}
      className="absolute bottom-8 left-1/2 z-[5] w-[min(280px,80vw)] -translate-x-1/2 rounded-2xl border border-line bg-surface-raised p-3 text-left text-xs font-normal text-ink shadow-elevated"
      role="dialog"
    >
      <div className="font-semibold">{check.name}</div>
      <div className="mt-1 font-mono text-[10px] uppercase text-ink-muted">{check.severity} · {check.verdict}</div>
      <p className="mb-0 mt-2 leading-normal text-ink-soft">{check.reason || 'No reason provided.'}</p>
      {check.evidence ? <p className="mb-0 mt-2 leading-normal text-ink-muted">Evidence: {check.evidence}</p> : null}
    </div>
  );
});

function tone(check: ConformanceGlyph): string {
  if (check.verdict === 'fail') return check.severity === 'high' ? 'border-danger bg-danger/15 text-danger' : 'border-warning bg-warning/15 text-ink';
  return 'border-warning bg-warning/15 text-ink';
}
