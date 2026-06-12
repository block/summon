import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type { SummonSurfaceHandle } from '@anarchitecture/summon-react';
import type { SurfaceEnvelope } from '@anarchitecture/summon/envelope';
import {
  deriveSurfacePlanControls,
  SectionAccumulator,
  type SummonLayout,
  type SurfaceContractView,
  type SurfacePlan,
} from '@anarchitecture/summon/engine';
import type { DevtoolsEvent } from '@anarchitecture/summon/devtools';
import defaultTokensSource from '@anarchitecture/summon/tokens.css?raw';
import type { ActiveContract, Mode } from '../../../showcase.js';
import type { ExtraDevtoolsEvent } from '../devtools.js';
import { defaultGhostBaseDirectionId } from '../surfaceHelpers.js';
import type { ChildSurfaceModel, DirectionInfo, FragmentMode, LogEntry, StreamOptions, StreamResult } from '../types.js';

export function useGenerationRuns({
  surfaceRef,
  accRef,
  abortRef,
  artifactRevisionRef,
  modeRef,
  summonedCountRef,
  activeTokensSourceOverride,
  activeContract,
  directionId,
  ghostTarget,
  ghostBaseDirectionId,
  directions,
  fragmentMode,
  editPrompt,
  editTargets,
  tokensFor,
  clearApprovals,
  clearRuntimeState,
  streamGenerationInto,
  readLayout,
  saveSurfaceEnvelope,
  appendDevEvent,
  logLine,
  currentValidationSummary,
  currentRepairSummary,
  setChildren,
  setRuntimeCapabilityNames,
  setRuntimeComponentNames,
  setLogs,
  setDevEvents,
  setSurfaceTokensSource,
  setShowWelcome,
  setRunning,
  setStatus,
  setBytes,
  setCurrentValidationSummary,
  setCurrentRepairSummary,
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
  accRef: MutableRefObject<SectionAccumulator>;
  abortRef: MutableRefObject<AbortController | null>;
  artifactRevisionRef: MutableRefObject<number>;
  modeRef: MutableRefObject<Mode>;
  summonedCountRef: MutableRefObject<number>;
  activeTokensSourceOverride: string | null;
  activeContract: ActiveContract;
  directionId: string | null;
  ghostTarget: string;
  ghostBaseDirectionId: string | null;
  directions: DirectionInfo[];
  fragmentMode: FragmentMode;
  editPrompt: string;
  editTargets: string;
  tokensFor: (id: string | null) => string;
  clearApprovals: (reason: string) => void;
  clearRuntimeState: () => void;
  streamGenerationInto: (opts: StreamOptions) => Promise<StreamResult>;
  readLayout: () => SummonLayout | null;
  saveSurfaceEnvelope: (runPrompt: string, result: StreamResult) => void;
  appendDevEvent: (event: DevtoolsEvent | ExtraDevtoolsEvent) => void;
  logLine: (cls: string, text: string) => void;
  currentValidationSummary: string | null;
  currentRepairSummary: string | null;
  setChildren: Dispatch<SetStateAction<ChildSurfaceModel[]>>;
  setRuntimeCapabilityNames: Dispatch<SetStateAction<string[] | null>>;
  setRuntimeComponentNames: Dispatch<SetStateAction<string[] | null>>;
  setLogs: Dispatch<SetStateAction<LogEntry[]>>;
  setDevEvents: Dispatch<SetStateAction<Array<DevtoolsEvent | ExtraDevtoolsEvent>>>;
  setSurfaceTokensSource: Dispatch<SetStateAction<string>>;
  setShowWelcome: Dispatch<SetStateAction<boolean>>;
  setRunning: Dispatch<SetStateAction<boolean>>;
  setStatus: Dispatch<SetStateAction<string>>;
  setBytes: Dispatch<SetStateAction<number>>;
  setCurrentValidationSummary: Dispatch<SetStateAction<string | null>>;
  setCurrentRepairSummary: Dispatch<SetStateAction<string | null>>;
  setCurrentStreamHealth: Dispatch<SetStateAction<string | null>>;
  setArtifactRevision: Dispatch<SetStateAction<number>>;
  setActiveTokensSourceOverride: Dispatch<SetStateAction<string | null>>;
  setMode: Dispatch<SetStateAction<Mode>>;
  setSurfacePlan: Dispatch<SetStateAction<SurfacePlan>>;
  setCurrentEffectiveSurfacePlan: Dispatch<SetStateAction<SurfacePlan | null>>;
  setCurrentShape: Dispatch<SetStateAction<string | null>>;
  setCurrentSurfaceContractView: Dispatch<SetStateAction<SurfaceContractView | null>>;
}) {
  const replayCurrentArtifact = useCallback(() => {
    if (!accRef.current.hasAnySection()) return;
    const html = accRef.current.compose();
    window.setTimeout(() => surfaceRef.current?.render(html), 0);
    window.setTimeout(() => surfaceRef.current?.render(html), 100);
  }, [accRef, surfaceRef]);

  const generate = useCallback(async (runPrompt: string) => {
    abortRef.current?.abort();
    const abort = new AbortController();
    const runTokensSource = activeTokensSourceOverride ?? tokensFor(directionId);
    abortRef.current = abort;
    clearApprovals('Approval request was replaced');
    setChildren([]);
    summonedCountRef.current = 0;
    setRuntimeCapabilityNames(null);
    setRuntimeComponentNames(null);
    setLogs([]);
    setDevEvents([]);
    clearRuntimeState();
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
        ghostBaseDirectionId: ghostBaseDirectionId ?? defaultGhostBaseDirectionId(directions),
        layout: readLayout(),
        fragmentMode,
        signal: abort.signal,
      });
      if (!currentValidationSummary) setCurrentValidationSummary('0/0');
      if (!currentRepairSummary) setCurrentRepairSummary(activeContract.repair?.enabled ? '0/0' : 'off');
      setCurrentStreamHealth((current) => current ?? `${result.streamGraph.health.complete ? 'complete' : 'open'} · missing=${result.streamGraph.health.missingDeclared.length} blocked=${result.streamGraph.health.blockedCount} retried=${result.streamGraph.health.repairedCount}`);
      setStatus('done');
      saveSurfaceEnvelope(runPrompt, result);
      replayCurrentArtifact();
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
    appendDevEvent,
    clearApprovals,
    clearRuntimeState,
    currentRepairSummary,
    currentValidationSummary,
    directionId,
    directions,
    fragmentMode,
    ghostBaseDirectionId,
    ghostTarget,
    logLine,
    readLayout,
    replayCurrentArtifact,
    saveSurfaceEnvelope,
    setBytes,
    setChildren,
    setCurrentRepairSummary,
    setCurrentStreamHealth,
    setCurrentValidationSummary,
    setDevEvents,
    setLogs,
    setRunning,
    setRuntimeCapabilityNames,
    setRuntimeComponentNames,
    setShowWelcome,
    setStatus,
    setSurfaceTokensSource,
    streamGenerationInto,
    summonedCountRef,
    tokensFor,
  ]);

  const editArtifact = useCallback(async () => {
    if (!accRef.current.hasAnySection() || !editPrompt.trim()) return;
    abortRef.current?.abort();
    const abort = new AbortController();
    abortRef.current = abort;
    const baseRevision = artifactRevisionRef.current;
    const targets = editTargets
      .split(/[,\s]+/)
      .map((target) => target.trim())
      .filter(Boolean);
    setRunning(true);
    setStatus('editing');
    setBytes(0);
    appendDevEvent({ kind: 'stream-lifecycle', at: Date.now(), phase: 'start' });
    try {
      const result = await streamGenerationInto({
        prompt: editPrompt.trim(),
        active: {
          ...activeContract,
          agentBroker: false,
          surfacePolicy: activeContract.surfacePolicy,
        },
        directionId,
        ghostTargetPath: ghostTarget.trim() || '.',
        ghostBaseDirectionId: ghostBaseDirectionId ?? defaultGhostBaseDirectionId(directions),
        layout: readLayout(),
        signal: abort.signal,
        edit: {
          baseRevision,
          sections: accRef.current.snapshot().sections,
          targetSections: targets.length ? Array.from(new Set(targets)) : undefined,
        },
      });
      setCurrentStreamHealth((current) => current ?? `${result.streamGraph.health.complete ? 'complete' : 'open'} · missing=${result.streamGraph.health.missingDeclared.length} blocked=${result.streamGraph.health.blockedCount} retried=${result.streamGraph.health.repairedCount}`);
      setStatus('done');
      replayCurrentArtifact();
      appendDevEvent({ kind: 'stream-lifecycle', at: Date.now(), phase: 'end', ok: true });
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        setStatus('aborted');
      } else {
        const message = err instanceof Error ? err.message : String(err);
        logLine('op-error', `edit error: ${message}`);
        setStatus('error');
      }
      appendDevEvent({ kind: 'stream-lifecycle', at: Date.now(), phase: 'end', ok: false });
    } finally {
      setRunning(false);
    }
  }, [
    abortRef,
    accRef,
    activeContract,
    appendDevEvent,
    artifactRevisionRef,
    directionId,
    directions,
    editPrompt,
    editTargets,
    ghostBaseDirectionId,
    ghostTarget,
    logLine,
    readLayout,
    replayCurrentArtifact,
    setBytes,
    setCurrentStreamHealth,
    setRunning,
    setStatus,
    streamGenerationInto,
  ]);

  const replaySurface = useCallback((envelope: SurfaceEnvelope) => {
    abortRef.current?.abort();
    clearApprovals('Approval request was replaced');
    setLogs([]);
    setDevEvents([]);
    accRef.current = new SectionAccumulator();
    for (const line of envelope.protocolLines) {
      if (line.op !== 'meta') accRef.current.applyDetailed(line);
    }
    artifactRevisionRef.current = accRef.current.snapshot().sections.length;
    setArtifactRevision(artifactRevisionRef.current);
    setActiveTokensSourceOverride(envelope.tokenCss ?? null);
    setSurfaceTokensSource(envelope.tokenCss ?? defaultTokensSource);
    setMode(deriveSurfacePlanControls(envelope.surfacePlan).mode);
    modeRef.current = deriveSurfacePlanControls(envelope.surfacePlan).mode;
    setSurfacePlan(envelope.surfacePlan);
    setCurrentEffectiveSurfacePlan(envelope.surfacePlan);
    setCurrentShape(envelope.metadata.shape ?? null);
    setCurrentValidationSummary(`${envelope.validationIssues.filter((issue) => issue.severity === 'block').length}/${envelope.validationIssues.filter((issue) => issue.severity === 'warn').length}`);
    setCurrentStreamHealth(envelope.streamGraph
      ? `${envelope.streamGraph.health.complete ? 'complete' : 'open'} · missing=${envelope.streamGraph.health.missingDeclared.length} blocked=${envelope.streamGraph.health.blockedCount} retried=${envelope.streamGraph.health.repairedCount}`
      : null);
    setCurrentSurfaceContractView(null);
    setRuntimeCapabilityNames(envelope.grants.intents);
    setRuntimeComponentNames(envelope.grants.components?.map((component) => component.name) ?? null);
    setShowWelcome(false);
    setStatus('replayed');
    setBytes(new TextEncoder().encode(envelope.html).byteLength);
    window.setTimeout(() => surfaceRef.current?.render(envelope.html), 0);
    appendDevEvent({ kind: 'surface-plan', at: Date.now(), plan: envelope.surfacePlan });
    appendDevEvent({ kind: 'stream-lifecycle', at: Date.now(), phase: 'end', ok: true });
    logLine('op-meta', `replayed ${envelope.surfacePlan.purpose}/${envelope.surfacePlan.runtime}`);
  }, [
    abortRef,
    accRef,
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
    setLogs,
    setMode,
    setRuntimeCapabilityNames,
    setRuntimeComponentNames,
    setShowWelcome,
    setStatus,
    setSurfacePlan,
    setSurfaceTokensSource,
    surfaceRef,
  ]);

  return { generate, editArtifact, replaySurface };
}
