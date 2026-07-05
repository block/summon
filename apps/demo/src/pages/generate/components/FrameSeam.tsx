import { cn } from '../../../lib/cn.js';
import type { GenerationTrace } from '../generationTrace.js';
import { generationPhaseLabel } from '../surfaceHelpers.js';

export function FrameSeam({ trace, running }: { trace: GenerationTrace; running: boolean }) {
  const blocked = (trace.streamHealth?.blockedCount ?? 0) > 0;
  return (
    <>
      <div
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute inset-x-8 top-0 z-[3] h-0.5 overflow-hidden rounded-full opacity-0 transition-opacity duration-300',
          running && !trace.done && 'opacity-100',
          blocked ? 'bg-danger/70' : 'bg-accent/40',
        )}
      >
        <div className="h-full w-1/2 rounded-full bg-ink/70 motion-safe:animate-[summon-frame-seam_1100ms_ease-in-out_infinite]" />
      </div>
      <div
        className={cn(
          'mt-2 min-h-5 text-center font-mono text-[11px] font-semibold uppercase tracking-normal text-ink-muted transition-opacity duration-500',
          running && !trace.done ? 'opacity-100' : 'opacity-0',
        )}
        aria-live="polite"
      >
        {running && !trace.done
          ? `${generationPhaseLabel(trace.phase ?? 'streaming')}${trace.bytes ? ` · ${trace.bytes.toLocaleString()} B` : ''}`
          : null}
      </div>
    </>
  );
}
