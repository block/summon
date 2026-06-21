import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type { SummonSurfaceHandle } from '@anarchitecture/summon-react';
import type { SurfaceEnvelope } from '@anarchitecture/summon/envelope';
import {
  isArrowSurfaceArtifact,
  type SummonLayout,
  type SurfaceContractView,
  type SurfacePlan,
} from '@anarchitecture/summon/engine';
import type { DevtoolsEvent } from '@anarchitecture/summon/devtools';
import defaultTokensSource from '@anarchitecture/summon/tokens.css?raw';
import type { ActiveContract, Mode } from '../../../showcase.js';
import type { ExtraDevtoolsEvent } from '../devtools.js';
import type { ChildSurfaceModel, LogEntry, StreamOptions, StreamResult, TimingEntry } from '../types.js';

export function useGenerationRuns({
  surfaceRef,
  abortRef,
  artifactRevisionRef,
  modeRef,
  summonedCountRef,
  activeTokensSourceOverride,
  activeContract,
  playgroundMode,
  directionId,
  ghostTarget,
  ghostBaseDirectionId,
  tokensFor,
  clearApprovals,
  clearRuntimeState,
  streamGenerationInto,
  readLayout,
  saveSurfaceEnvelope,
  appendDevEvent,
  logLine,
  currentValidationSummary,
  setChildren,
  setRuntimeToolNames,
  setLogs,
  setDevEvents,
  setTimingEntries,
  setSurfaceTokensSource,
  setSurfaceInstanceKey,
  setShowWelcome,
  setRunning,
  setStatus,
  setBytes,
  setCurrentValidationSummary,
  setCurrentStreamHealth,
  setArtifactRevision,
  setActiveTokensSourceOverride,
  setMode,
  setSurfacePlan,
  setCurrentEffectiveSurfacePlan,
  setCurrentShape,
  setCurrentSurfaceContractView,
}: {
  surfaceRef: MutableRefObject<SummonSurfaceHandle | null>;
  abortRef: MutableRefObject<AbortController | null>;
  artifactRevisionRef: MutableRefObject<number>;
  modeRef: MutableRefObject<Mode>;
  summonedCountRef: MutableRefObject<number>;
  activeTokensSourceOverride: string | null;
  activeContract: ActiveContract;
  playgroundMode: boolean;
  directionId: string | null;
  ghostTarget: string;
  ghostBaseDirectionId: string | null;
  tokensFor: (id: string | null) => string;
  clearApprovals: (reason: string) => void;
  clearRuntimeState: () => void;
  streamGenerationInto: (opts: StreamOptions) => Promise<StreamResult>;
  readLayout: () => SummonLayout | null;
  saveSurfaceEnvelope: (runPrompt: string, result: StreamResult) => void;
  appendDevEvent: (event: DevtoolsEvent | ExtraDevtoolsEvent) => void;
  logLine: (cls: string, text: string) => void;
  currentValidationSummary: string | null;
  setChildren: Dispatch<SetStateAction<ChildSurfaceModel[]>>;
  setRuntimeToolNames: Dispatch<SetStateAction<string[] | null>>;
  setLogs: Dispatch<SetStateAction<LogEntry[]>>;
  setDevEvents: Dispatch<SetStateAction<Array<DevtoolsEvent | ExtraDevtoolsEvent>>>;
  setTimingEntries: Dispatch<SetStateAction<TimingEntry[]>>;
  setSurfaceTokensSource: Dispatch<SetStateAction<string>>;
  setSurfaceInstanceKey: Dispatch<SetStateAction<number>>;
  setShowWelcome: Dispatch<SetStateAction<boolean>>;
  setRunning: Dispatch<SetStateAction<boolean>>;
  setStatus: Dispatch<SetStateAction<string>>;
  setBytes: Dispatch<SetStateAction<number>>;
  setCurrentValidationSummary: Dispatch<SetStateAction<string | null>>;
  setCurrentStreamHealth: Dispatch<SetStateAction<string | null>>;
  setArtifactRevision: Dispatch<SetStateAction<number>>;
  setActiveTokensSourceOverride: Dispatch<SetStateAction<string | null>>;
  setMode: Dispatch<SetStateAction<Mode>>;
  setSurfacePlan: Dispatch<SetStateAction<SurfacePlan>>;
  setCurrentEffectiveSurfacePlan: Dispatch<SetStateAction<SurfacePlan | null>>;
  setCurrentShape: Dispatch<SetStateAction<string | null>>;
  setCurrentSurfaceContractView: Dispatch<SetStateAction<SurfaceContractView | null>>;
}) {
  const generate = useCallback(async (runPrompt: string) => {
    abortRef.current?.abort();
    const abort = new AbortController();
    const runTokensSource = activeTokensSourceOverride ?? tokensFor(directionId);
    abortRef.current = abort;
    clearApprovals('Approval request was replaced');
    setChildren([]);
    summonedCountRef.current = 0;
    setRuntimeToolNames(null);
    setLogs([]);
    setDevEvents([]);
    setTimingEntries([]);
    clearRuntimeState();
    setSurfaceInstanceKey((key) => key + 1);
    setSurfaceTokensSource(runTokensSource);
    setShowWelcome(false);
    setRunning(true);
    setStatus('streaming');
    setBytes(0);
    appendDevEvent({ kind: 'stream-lifecycle', at: Date.now(), phase: 'start' });

    try {
      const result = await streamGenerationInto({
        prompt: runPrompt,
        active: activeContract,
        directionId,
        ghostTargetPath: ghostTarget.trim() || '.',
        ghostBaseDirectionId,
        layout: readLayout(),
        playgroundMode,
        signal: abort.signal,
      });
      if (!currentValidationSummary) setCurrentValidationSummary('0/0');
      setCurrentStreamHealth((current) => current ?? `${result.streamGraph.health.complete ? 'complete' : 'blocked'} · artifacts=${result.streamGraph.artifacts.length} blocked=${result.streamGraph.health.blockedCount}`);
      setStatus('done');
      saveSurfaceEnvelope(runPrompt, result);
      appendDevEvent({ kind: 'stream-lifecycle', at: Date.now(), phase: 'end', ok: true });
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        setStatus('aborted');
        appendDevEvent({ kind: 'stream-lifecycle', at: Date.now(), phase: 'end', ok: false });
      } else {
        const message = err instanceof Error ? err.message : String(err);
        logLine('op-error', `stream error: ${message}`);
        setStatus('error');
        appendDevEvent({ kind: 'stream-lifecycle', at: Date.now(), phase: 'end', ok: false });
      }
    } finally {
      setRunning(false);
    }
  }, [
    abortRef,
    activeContract,
    activeTokensSourceOverride,
    playgroundMode,
    appendDevEvent,
    clearApprovals,
    clearRuntimeState,
    currentValidationSummary,
    directionId,
    ghostBaseDirectionId,
    ghostTarget,
    logLine,
    readLayout,
    saveSurfaceEnvelope,
    setBytes,
    setChildren,
    setCurrentStreamHealth,
    setCurrentValidationSummary,
    setDevEvents,
    setTimingEntries,
    setLogs,
    setSurfaceInstanceKey,
    setRunning,
    setRuntimeToolNames,
    setShowWelcome,
    setStatus,
    setSurfaceTokensSource,
    streamGenerationInto,
    summonedCountRef,
    tokensFor,
  ]);

  const replaySurface = useCallback((envelope: SurfaceEnvelope) => {
    abortRef.current?.abort();
    clearApprovals('Approval request was replaced');
    setLogs([]);
    setDevEvents([]);
    setTimingEntries([]);
    const arrowArtifact = findArrowArtifact(envelope.protocolLines);
    if (!arrowArtifact) {
      setStatus('replay error');
      logLine('op-error', 'saved surface has no Arrow artifact');
      return;
    }
    artifactRevisionRef.current = envelope.protocolLines.length;
    setArtifactRevision(artifactRevisionRef.current);
    setActiveTokensSourceOverride(envelope.tokenCss ?? null);
    setSurfaceTokensSource(envelope.tokenCss ?? defaultTokensSource);
    const replayMode = envelope.metadata.mode ?? (envelope.grants.tools.length === 0 ? 'static' : 'interactive');
    setMode(replayMode);
    modeRef.current = replayMode;
    setSurfacePlan(envelope.surfacePlan);
    setCurrentEffectiveSurfacePlan(envelope.surfacePlan);
    setCurrentShape(envelope.metadata.shape ?? null);
    setCurrentValidationSummary(`${envelope.validationIssues.filter((issue) => issue.severity === 'block').length}/${envelope.validationIssues.filter((issue) => issue.severity === 'warn').length}`);
    setCurrentStreamHealth(envelope.streamGraph
      ? `${envelope.streamGraph.health.complete ? 'complete' : 'blocked'} · artifacts=${envelope.streamGraph.artifacts.length} blocked=${envelope.streamGraph.health.blockedCount}`
      : null);
    setCurrentSurfaceContractView(null);
    setRuntimeToolNames(envelope.grants.tools);
    setShowWelcome(false);
    setStatus('replayed');
    setBytes(new TextEncoder().encode(JSON.stringify(arrowArtifact.source)).byteLength);
    window.setTimeout(() => surfaceRef.current?.renderArtifact(arrowArtifact), 0);
    appendDevEvent({ kind: 'surface-plan', at: Date.now(), plan: envelope.surfacePlan });
    appendDevEvent({ kind: 'stream-lifecycle', at: Date.now(), phase: 'end', ok: true });
    logLine('op-meta', `replayed ${envelope.surfacePlan.purpose}/${envelope.surfacePlan.runtime}`);
    if (arrowArtifact) logLine('op-add', `replayed artifact /artifact -> ${Object.keys(arrowArtifact.source).join(', ')}`);
  }, [
    abortRef,
    appendDevEvent,
    artifactRevisionRef,
    clearApprovals,
    logLine,
    modeRef,
    setActiveTokensSourceOverride,
    setArtifactRevision,
    setBytes,
    setCurrentEffectiveSurfacePlan,
    setCurrentShape,
    setCurrentStreamHealth,
    setCurrentSurfaceContractView,
    setCurrentValidationSummary,
    setDevEvents,
    setTimingEntries,
    setLogs,
    setMode,
    setRuntimeToolNames,
    setShowWelcome,
    setStatus,
    setSurfacePlan,
    setSurfaceTokensSource,
    surfaceRef,
  ]);

  return { generate, replaySurface };
}

function findArrowArtifact(lines: SurfaceEnvelope['protocolLines']) {
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    if (!line) continue;
    if (line.op === 'artifact' && line.path === '/artifact' && isArrowSurfaceArtifact(line.value)) {
      return line.value;
    }
  }
  return null;
}
