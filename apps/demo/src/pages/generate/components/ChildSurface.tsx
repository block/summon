import { useEffect, useMemo, useRef, useState } from 'react';
import { SummonSurface, type SummonSurfaceHandle } from '@anarchitecture/summon-react';
import { consumeSurfaceStream } from '@anarchitecture/summon/browser';
import { SectionAccumulator } from '@anarchitecture/summon/engine';
import { createScopedDemoRegistry } from '../../../showcase.js';
import { childCapabilityNames } from '../constants.js';
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
    }, childCapabilityNames),
    [child.modelSelection],
  );
  const contract = useMemo(() => registry.toContract(), [registry]);

  useEffect(() => {
    const abort = new AbortController();
    const acc = new SectionAccumulator();
    async function runChild() {
      try {
        const response = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: child.prompt,
            ...(child.directionId ? { directionId: child.directionId } : { directionId: '' }),
            ...child.modelSelection,
            mode: 'interactive',
            capabilities: contract.pack,
            ...(child.agentBroker ? { agent: { enabled: true } } : {}),
          }),
          signal: abort.signal,
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        if (!response.body) throw new Error('no response body');
        await consumeSurfaceStream(response.body, {
          mode: 'interactive',
          accumulator: acc,
          onMeta: (line) => {
            if (line.path === '/status') setStatus(String(line.value));
          },
          onRenderHtml: (html) => surfaceRef.current?.render(html),
          onNodePatch: (patch) => surfaceRef.current?.patchNode(patch),
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
    <section className="child-pane">
      <header>
        <span className="child-title">{child.title ?? 'Summoned'}</span>
        <span className="child-prompt" title={child.prompt}>{child.prompt}</span>
        <span className="child-status">{status}</span>
        <button type="button" className="child-close" aria-label="Close summoned UI" onClick={onClose}>x</button>
      </header>
      <SummonSurface
        ref={surfaceRef}
        title={`Summoned: ${child.title ?? child.prompt.slice(0, 40)}`}
        html=""
        tokensSource={child.tokensSource}
        capabilityRegistry={registry}
        grantedCapabilities={contract.validationCapabilities}
      />
    </section>
  );
}
