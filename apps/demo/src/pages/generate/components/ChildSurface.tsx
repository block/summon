import { useEffect, useMemo, useRef, useState } from 'react';
import { SummonSurface, type SummonSurfaceHandle } from '@anarchitecture/summon-react';
import { consumeSurfaceStream } from '@anarchitecture/summon/browser';
import { Button, panelClass } from '../../../components/ui.js';
import { cn } from '../../../lib/cn.js';
import { createScopedDemoRegistry } from '../../../showcase.js';
import { childToolNames } from '../constants.js';
import type { ChildSurfaceModel } from '../types.js';

export function ChildSurface({
  child,
  onClose,
}: {
  child: ChildSurfaceModel;
  onClose: () => void;
}) {
  const surfaceRef = useRef<SummonSurfaceHandle>(null);
  const [status, setStatus] = useState('streaming');
  const registry = useMemo(
    () => createScopedDemoRegistry({
      modelProvider: () => child.modelSelection.modelProvider ?? null,
      modelSelection: () => child.modelSelection,
      onError: (message) => setStatus(`error: ${message.slice(0, 40)}`),
    }, childToolNames),
    [child.modelSelection],
  );
  const contract = useMemo(() => registry.toContract(), [registry]);

  useEffect(() => {
    const abort = new AbortController();
    async function runChild() {
      try {
        const response = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: child.prompt,
            validationMode: 'observe',
            ...(child.directionId ? { directionId: child.directionId } : { directionId: '' }),
            ...child.modelSelection,
            tools: contract.pack,
            ...(child.agentBroker
              ? { agent: { enabled: true } }
              : { surfacePolicy: { tier: 'declarative', purpose: 'explore', grants: childToolNames } }),
          }),
          signal: abort.signal,
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        if (!response.body) throw new Error('no response body');
        await consumeSurfaceStream(response.body, {
          mode: 'interactive',
          validationMode: 'observe',
          onMeta: (line) => {
            if (line.path === '/status') setStatus(String(line.value));
          },
          onArtifact: (artifact) => surfaceRef.current?.renderArtifact(artifact),
        });
        setStatus('done');
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        const message = err instanceof Error ? err.message : String(err);
        setStatus(`error: ${message.slice(0, 60)}`);
      }
    }
    void runChild();
    return () => abort.abort();
  }, [child, contract.pack]);

  return (
    <section className={cn(panelClass, 'overflow-hidden')}>
      <header className="flex items-center gap-3 border-b border-line px-3.5 py-2.5 text-[13px] text-ink-soft">
        <span className="font-semibold text-ink">{child.title ?? 'Summoned'}</span>
        <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-xs text-ink-muted" title={child.prompt}>{child.prompt}</span>
        <span className="font-mono text-[11px] text-ink-muted">{status}</span>
        <Button type="button" variant="ghost" size="icon-xs" aria-label="Close summoned UI" onClick={onClose}>x</Button>
      </header>
      <SummonSurface
        ref={surfaceRef}
        title={`Summoned: ${child.title ?? child.prompt.slice(0, 40)}`}
        className="block h-[480px] w-full border-0 bg-surface-raised"
        tokensSource={child.tokensSource}
        toolRegistry={registry}
        validationTools={contract.validationTools}
      />
    </section>
  );
}
