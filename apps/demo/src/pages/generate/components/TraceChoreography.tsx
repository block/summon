import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { cn } from '../../../lib/cn.js';
import type { GenerationTrace } from '../generationTrace.js';

interface Chip {
  id: string;
  label: string;
  pullReason: string;
}

export function TraceChoreography({
  trace,
  frameRef,
  onAbsorb,
}: {
  trace: GenerationTrace;
  /** The #sandbox-frame element the chips drift toward. */
  frameRef: RefObject<HTMLDivElement>;
  /** Fired when the last chip is absorbed; the stage owns the border pulse. */
  onAbsorb?: () => void;
}) {
  const [chips, setChips] = useState<Chip[]>([]);
  const layerRef = useRef<HTMLDivElement>(null);
  const animationsRef = useRef<Animation[]>([]);
  const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const sourceChips = useMemo(() => {
    const visible = trace.gatheredNodes.slice(0, 12).map((node) => ({ id: node.id, label: node.id, pullReason: node.pullReason }));
    const extra = trace.gatheredNodes.length - visible.length;
    return extra > 0 ? [...visible, { id: '__more', label: `+${extra} more`, pullReason: 'corpus' }] : visible;
  }, [trace.gatheredNodes]);

  useEffect(() => {
    animationsRef.current.forEach((animation) => animation.cancel());
    animationsRef.current = [];
    if (sourceChips.length === 0) {
      setChips([]);
      return;
    }
    setChips(sourceChips);
    if (reduced) {
      const timer = window.setTimeout(() => setChips([]), 2200);
      return () => window.clearTimeout(timer);
    }
    const timer = window.setTimeout(() => {
      const layer = layerRef.current;
      const frame = frameRef.current;
      if (!layer || !frame) return;
      const layerBox = layer.getBoundingClientRect();
      const frameBox = frame.getBoundingClientRect();
      const centerX = frameBox.left - layerBox.left + frameBox.width / 2;
      const centerY = frameBox.top - layerBox.top + frameBox.height / 2;
      const radiusX = Math.min(layerBox.width * 0.44, frameBox.width * 0.72);
      const radiusY = Math.min(layerBox.height * 0.36, frameBox.height * 0.72);
      Array.from(layer.querySelectorAll<HTMLElement>('[data-trace-chip]')).forEach((element, index) => {
        const angle = (index / Math.max(1, sourceChips.length)) * Math.PI * 2 + 0.7;
        const startX = centerX + Math.cos(angle) * radiusX;
        const startY = centerY + Math.sin(angle) * radiusY;
        const endX = frameBox.left - layerBox.left + Math.max(28, Math.min(frameBox.width - 28, (index + 1) * (frameBox.width / (sourceChips.length + 1))));
        const endY = frameBox.top - layerBox.top + (index % 2 ? frameBox.height - 8 : 8);
        element.style.left = `${startX}px`;
        element.style.top = `${startY}px`;
        const animation = element.animate([
          { opacity: 0, transform: 'translate(-50%, -50%) scale(0.82)' },
          { opacity: 1, offset: 0.18, transform: 'translate(-50%, -50%) scale(1)' },
          { opacity: 0.08, transform: `translate(${endX - startX - element.offsetWidth / 2}px, ${endY - startY - element.offsetHeight / 2}px) scale(0.55)` },
        ], { duration: 1200, delay: index * 90, easing: 'cubic-bezier(0.22,1,0.36,1)', fill: 'forwards' });
        animationsRef.current.push(animation);
        void animation.finished.catch(() => undefined).then(() => {
          if (index === sourceChips.length - 1) {
            setChips([]);
            onAbsorb?.();
          }
        });
      });
    }, 0);
    return () => {
      window.clearTimeout(timer);
      animationsRef.current.forEach((animation) => animation.cancel());
      animationsRef.current = [];
    };
  }, [sourceChips, reduced, trace.runId]);

  if (chips.length === 0) return null;
  return (
    <div ref={layerRef} className="pointer-events-none absolute inset-0 z-[4]" aria-hidden="true">
      <div className={cn(reduced ? 'absolute inset-x-4 -top-9 flex flex-wrap justify-center gap-1.5 opacity-80 transition-opacity' : 'contents')}>
        {chips.map((chip) => (
          <span
            key={`${trace.runId}-${chip.id}`}
            data-trace-chip="true"
            className={cn(
              'rounded-full border px-2.5 py-1 font-mono text-[10px] font-semibold shadow-card',
              reduced ? 'relative' : 'absolute',
              chip.pullReason === 'front-door' ? 'border-accent/35 bg-accent/15 text-ink' : chip.pullReason === 'anchor' ? 'border-ink/20 bg-ink/10 text-ink' : 'border-line bg-surface-raised text-ink-soft',
            )}
          >
            {chip.label}
          </span>
        ))}
      </div>
    </div>
  );
}
