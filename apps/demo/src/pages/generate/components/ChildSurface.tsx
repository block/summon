import { useEffect, useMemo, useRef, useState } from 'react';
import { SummonSurface, type SummonSurfaceHandle } from '@anarchitecture/summon-react';
import {
  consumeSurfaceStream,
  type HtmlStreamPreviewDelta,
  type SurfacePreviewSnapshot,
} from '@anarchitecture/summon/browser';
import {
  buildFingerprintSteeringPayload,
  normalizeSurfacePlan,
  type SurfacePlan,
} from '@anarchitecture/summon/engine';
import { Button, panelClass } from '../../../components/ui.js';
import { cn } from '../../../lib/cn.js';
import { createScopedDemoRegistry } from '../../../showcase.js';
import { childToolNames } from '../constants.js';
import {
  buildGenerationPreview,
  reduceSurfacePreviewSnapshot,
} from '../generationPreview.js';
import type { ChildSurfaceModel } from '../types.js';
import { SurfaceLoadingOverlay } from './SurfaceLoadingOverlay.js';

export function ChildSurface({
  child,
  onClose,
}: {
  child: ChildSurfaceModel;
  onClose: () => void;
}) {
  const surfaceRef = useRef<SummonSurfaceHandle>(null);
  const [status, setStatus] = useState('streaming');
  const [surfaceReady, setSurfaceReady] = useState(false);
  const [artifactSeen, setArtifactSeen] = useState(false);
  const [currentSurfacePlan, setCurrentSurfacePlan] = useState<SurfacePlan | null>(null);
  const [previewSnapshot, setPreviewSnapshot] = useState<SurfacePreviewSnapshot | null>(null);
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
    setSurfaceReady(false);
    setArtifactSeen(false);
    setCurrentSurfacePlan(null);
    setPreviewSnapshot(null);
    async function runChild() {
      try {
        const response = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: child.prompt,
            validationMode: 'observe',
            ...(buildFingerprintSteeringPayload({
              id: child.fingerprintId,
              targetPath: child.fingerprintTargetPath,
            }) ?? {}),
            ...child.modelSelection,
            tools: contract.pack,
            ...(child.agentWard
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
            if (line.path === '/surface-plan') {
              setCurrentSurfacePlan(normalizeSurfacePlan(line.value));
            }
            if (line.path === '/html-stream-preview') {
              const delta = parseHtmlStreamPreviewDelta(line.value);
              if (delta) surfaceRef.current?.applyHtmlPreviewDelta(delta);
            }
          },
          onArtifact: (artifact) => {
            setSurfaceReady(false);
            setArtifactSeen(true);
            surfaceRef.current?.renderArtifact(artifact);
          },
          onHtmlPatch: (patch) => {
            surfaceRef.current?.applyHtmlPatch(patch);
          },
          onSurfaceEvent: (event) => {
            setPreviewSnapshot((snapshot) =>
              reduceSurfacePreviewSnapshot(snapshot, event),
            );
            if (event.type === 'surface.status') setStatus(event.status);
          },
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

  const showHostLoader = !surfaceReady && !status.startsWith('error');
  const childPreview = useMemo(
    () =>
      buildGenerationPreview({
        prompt: child.prompt,
        status,
        statusText: statusLabel(status),
        bytes: 0,
        artifactRevision: artifactSeen ? 1 : 0,
        rendered: surfaceReady,
        surfacePlan: currentSurfacePlan,
        contractView: null,
        layout: null,
        previewSnapshot,
        toolNames: childToolNames,
      }),
    [
      artifactSeen,
      child.prompt,
      currentSurfacePlan,
      previewSnapshot,
      status,
      surfaceReady,
    ],
  );

  return (
    <section className={cn(panelClass, 'overflow-hidden')}>
      <header className="flex items-center gap-3 border-b border-line px-3.5 py-2.5 text-[13px] text-ink-soft">
        <span className="font-semibold text-ink">{child.title ?? 'Summoned'}</span>
        <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-xs text-ink-muted" title={child.prompt}>{child.prompt}</span>
        <span className="font-mono text-[11px] text-ink-muted">{status}</span>
        <Button type="button" variant="ghost" size="icon-xs" aria-label="Close summoned UI" onClick={onClose}>x</Button>
      </header>
      <div className="relative">
        <SummonSurface
          ref={surfaceRef}
          title={`Summoned: ${child.title ?? child.prompt.slice(0, 40)}`}
          className="block h-[480px] w-full border-0 bg-surface-raised"
          tokensSource={child.tokensSource}
          toolRegistry={registry}
          validationTools={contract.validationTools}
          onEvent={(event) => {
            if (event.kind === 'render' || event.kind === 'surface-disposed') {
              setSurfaceReady(false);
            } else if (
              event.kind === 'rendered' ||
              event.kind === 'surface-runtime-error'
            ) {
              setSurfaceReady(true);
            }
          }}
        />
        {showHostLoader ? (
          <SurfaceLoadingOverlay
            compact
            statusText={statusLabel(status)}
            preview={childPreview}
            className="bg-surface-raised/92"
          />
        ) : null}
      </div>
    </section>
  );
}

function parseHtmlStreamPreviewDelta(value: unknown): HtmlStreamPreviewDelta | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const delta = value as Record<string, unknown>;
  const action = delta.action;
  const text = typeof delta.delta === 'string'
    ? delta.delta
    : typeof delta.text === 'string'
      ? delta.text
      : '';
  if (delta.runtime !== 'html') return null;
  if (typeof delta.target !== 'string' || !delta.target) return null;
  if (
    action !== 'append' &&
    action !== 'replace' &&
    action !== 'update' &&
    action !== 'remove' &&
    action !== 'morph'
  ) {
    return null;
  }
  if (!text) return null;
  return {
    runtime: 'html',
    target: delta.target,
    action,
    delta: text,
  };
}

function statusLabel(status: string): string {
  if (status === 'streaming') return 'Streaming surface';
  if (status === 'done') return 'Mounting surface';
  return status;
}
