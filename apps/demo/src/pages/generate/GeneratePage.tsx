import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type SummonSurfaceHandle } from '@anarchitecture/summon-react';
import { createSurfaceEnvelope } from '@anarchitecture/summon/envelope';
import {
  isArrowSurfaceArtifact,
  type ProtocolLine,
  type SummonLayout,
  type SurfaceContractView,
  type SurfacePlan,
} from '@anarchitecture/summon/engine';
import type { ApprovalDecision, ApprovalRequest } from '@anarchitecture/summon';
import type { DevtoolsEvent } from '@anarchitecture/summon/devtools';
import defaultTokensSource from '@anarchitecture/summon/tokens.css?raw';
import { Button } from '../../components/ui.js';
import { cn } from '../../lib/cn.js';
import {
  createGhostShowcaseScenario,
  createScopedDemoRegistry,
  SHOWCASE_SCENARIOS,
  type ActiveContract,
  type Mode,
} from '../../showcase.js';
import { ApprovalStack } from './components/ApprovalStack.js';
import { ContractInspector } from './components/ContractInspector.js';
import { DiagnosticsDock } from './components/DiagnosticsDock.js';
import { GenerationStage } from './components/GenerationStage.js';
import { layoutPresets } from './constants.js';
import { displayEventKind, type ExtraDevtoolsEvent } from './devtools.js';
import { useGenerationRuns } from './hooks/useGenerationRuns.js';
import { useSavedSurfaces } from './hooks/useSavedSurfaces.js';
import { useSurfaceStream } from './hooks/useSurfaceStream.js';
import { useWorkbenchCatalogs } from './hooks/useWorkbenchCatalogs.js';
import { defaultsForRunProfile, fallbackCatalog } from './modelProviders.js';
import { loadSavedSurfaces } from './savedSurfaces.js';
import {
  buildContractRows,
  generationPhaseLabel,
  ghostRootFromSelection,
  scenarioUsesFixedPolicy,
  surfacePolicyForPlan,
  tokenOverridesFor,
} from './surfaceHelpers.js';
import type {
  ApprovalCard,
  ChildSurfaceModel,
  DiagnosticsTab,
  LogEntry,
  ModelOptions,
  ModelSelectionPayload,
  RunProfile,
  StreamResult,
  TimingEntry,
} from './types.js';

export function GeneratePage() {
  const surfaceRef = useRef<SummonSurfaceHandle>(null);
  const abortRef = useRef<AbortController | null>(null);
  const modeRef = useRef<Mode>('interactive');
  const approvalResolvers = useRef(new Map<string, (decision: ApprovalDecision) => void>());
  const summonedCountRef = useRef(0);
  const { directions, ghostRoots, modelProviders, defaultModelProviderId } = useWorkbenchCatalogs();
  const { savedSurfaces, updateSavedSurfaces } = useSavedSurfaces();

  const [selectedScenarioId, setSelectedScenarioId] = useState(SHOWCASE_SCENARIOS[0]?.id ?? '');
  const [prompt, setPrompt] = useState(SHOWCASE_SCENARIOS[0]?.prompt ?? '');
  const [mode, setMode] = useState<Mode>(SHOWCASE_SCENARIOS[0]?.mode ?? 'interactive');
  const [surfacePlan, setSurfacePlan] = useState<SurfacePlan>(SHOWCASE_SCENARIOS[0]!.surfacePlan);
  const [layoutId, setLayoutId] = useState('');
  const [tokenPreset, setTokenPreset] = useState('');
  const [playgroundMode, setPlaygroundMode] = useState(true);
  const [playgroundToolsEnabled, setPlaygroundToolsEnabled] = useState(false);
  const [agentBrokerEnabled, setAgentBrokerEnabled] = useState(true);
  const [customContractEnabled, setCustomContractEnabled] = useState(false);
  const [directionId, setDirectionId] = useState<string | null>(null);
  const [ghostTarget, setGhostTarget] = useState('.');
  const [ghostBaseDirectionId, setGhostBaseDirectionId] = useState<string | null>(null);
  const [modelProviderId, setModelProviderId] = useState('');
  const [generationModel, setGenerationModel] = useState('');
  const [utilityModel, setUtilityModel] = useState('');
  const [customModel, setCustomModel] = useState('');
  const [runProfile, setRunProfile] = useState<RunProfile>('fast');
  const [maxOutputTokens, setMaxOutputTokens] = useState(64000);
  const [anthropicThinking, setAnthropicThinking] = useState<'adaptive' | 'off'>('adaptive');
  const [modelEffort, setModelEffort] = useState<'low' | 'medium' | 'high'>('medium');
  const [activeTokensSourceOverride, setActiveTokensSourceOverride] = useState<string | null>(null);
  const activeTokensSourceOverrideRef = useRef<string | null>(null);
  const [surfaceTokensSource, setSurfaceTokensSource] = useState(defaultTokensSource);
  const [runtimeToolNames, setRuntimeToolNames] = useState<string[] | null>(null);
  const [status, setStatus] = useState('idle');
  const [bytes, setBytes] = useState(0);
  const [showWelcome, setShowWelcome] = useState(true);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [devEvents, setDevEvents] = useState<Array<DevtoolsEvent | ExtraDevtoolsEvent>>([]);
  const [timingEntries, setTimingEntries] = useState<TimingEntry[]>([]);
  const [currentEffectiveSurfacePlan, setCurrentEffectiveSurfacePlan] = useState<SurfacePlan | null>(null);
  const [currentShape, setCurrentShape] = useState<string | null>(null);
  const [currentValidationSummary, setCurrentValidationSummary] = useState<string | null>(null);
  const [currentStreamHealth, setCurrentStreamHealth] = useState<string | null>(null);
  const [currentSurfaceContractView, setCurrentSurfaceContractView] = useState<SurfaceContractView | null>(null);
  const [currentAgentGoalSummary, setCurrentAgentGoalSummary] = useState<string | null>(null);
  const [currentAgentPolicySummary, setCurrentAgentPolicySummary] = useState<string | null>(null);
  const [artifactRevision, setArtifactRevision] = useState(0);
  const [surfaceInstanceKey, setSurfaceInstanceKey] = useState(0);
  const artifactRevisionRef = useRef(0);
  const [diagnosticsTab, setDiagnosticsTab] = useState<DiagnosticsTab>('stream');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [approvalCards, setApprovalCards] = useState<ApprovalCard[]>([]);
  const [children, setChildren] = useState<ChildSurfaceModel[]>([]);
  const [running, setRunning] = useState(false);
  const timingEntryIdRef = useRef(0);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    artifactRevisionRef.current = artifactRevision;
  }, [artifactRevision]);

  useEffect(() => {
    activeTokensSourceOverrideRef.current = activeTokensSourceOverride;
  }, [activeTokensSourceOverride]);

  const showcaseScenarios = useMemo(
    () => [
      ...SHOWCASE_SCENARIOS,
      ...ghostRoots.map((root) => createGhostShowcaseScenario(root.id)),
    ],
    [ghostRoots],
  );
  const selectedScenario = useMemo(
    () => showcaseScenarios.find((scenario) => scenario.id === selectedScenarioId) ?? showcaseScenarios[0]!,
    [selectedScenarioId, showcaseScenarios],
  );
  const selectedProvider = useMemo(
    () => modelProviders.find((provider) => provider.id === modelProviderId) ?? null,
    [modelProviderId, modelProviders],
  );

  const applyRunProfileDefaults = useCallback((
    profile: Exclude<RunProfile, 'custom'>,
    provider = selectedProvider,
  ) => {
    if (!provider) return;
    const defaults = defaultsForRunProfile(provider, profile);
    setGenerationModel(defaults.generationModel);
    setUtilityModel(defaults.utilityModel);
    setCustomModel('');
    setMaxOutputTokens(defaults.maxOutputTokens);
    setAnthropicThinking(defaults.anthropicThinking);
    setModelEffort(defaults.effort);
  }, [selectedProvider]);

  useEffect(() => {
    if (modelProviders.length === 0) {
      setModelProviderId('');
      return;
    }
    const configuredDefault = defaultModelProviderId
      ? modelProviders.find((provider) => provider.id === defaultModelProviderId && provider.configured)
      : null;
    const firstConfigured = modelProviders.find((provider) => provider.configured);
    const next = configuredDefault?.id ?? firstConfigured?.id ?? '';
    setModelProviderId((current) => current || next);
  }, [defaultModelProviderId, modelProviders]);

  useEffect(() => {
    if (!selectedProvider) {
      setGenerationModel('');
      setUtilityModel('');
      setMaxOutputTokens(64000);
      return;
    }
    if (runProfile !== 'custom') applyRunProfileDefaults(runProfile, selectedProvider);
  }, [applyRunProfileDefaults, runProfile, selectedProvider]);

  const tokensFor = useCallback((id: string | null): string => {
    if (!id) return defaultTokensSource;
    if (ghostRootFromSelection(id)) {
      return ghostBaseDirectionId
        ? directions.find((direction) => direction.id === ghostBaseDirectionId)?.tokensCss ?? defaultTokensSource
        : defaultTokensSource;
    }
    return directions.find((direction) => direction.id === id)?.tokensCss ?? defaultTokensSource;
  }, [directions, ghostBaseDirectionId]);

  const logLine = useCallback((cls: string, text: string) => {
    setLogs((items) => [...items, { cls, text }]);
  }, []);

  const appendDevEvent = useCallback((event: DevtoolsEvent | ExtraDevtoolsEvent) => {
    setDevEvents((items) => [...items.slice(-799), event]);
  }, []);

  const appendTimingEntry = useCallback((entry: Omit<TimingEntry, 'id' | 'at'> & { at?: number }) => {
    setTimingEntries((items) => [
      ...items.slice(-199),
      {
        ...entry,
        id: timingEntryIdRef.current++,
        at: entry.at ?? Date.now(),
      },
    ]);
  }, []);

  const handleSurfaceGoalRejected = useCallback((reason: string) => {
    logLine('op-error', `rejected: ${reason}`);
  }, [logLine]);

  const handleSurfaceHandlerError = useCallback((tool: string, error: Error) => {
    logLine('op-error', `host handler error (${tool}): ${error.message}`);
  }, [logLine]);

  const handleSurfaceRuntimeError = useCallback((reason: string) => {
    logLine('op-error', `runtime error: ${reason}`);
    setStatus('runtime error');
  }, [logLine]);

  const clearRuntimeState = useCallback(() => {
    setArtifactRevision(0);
    artifactRevisionRef.current = 0;
    activeTokensSourceOverrideRef.current = null;
    setActiveTokensSourceOverride(null);
    setTimingEntries([]);
    setCurrentEffectiveSurfacePlan(null);
    setCurrentShape(null);
    setCurrentValidationSummary(null);
    setCurrentStreamHealth(null);
    setCurrentSurfaceContractView(null);
    setCurrentAgentGoalSummary(null);
    setCurrentAgentPolicySummary(null);
  }, []);

  const markCustomRunProfile = useCallback(() => {
    setRunProfile('custom');
  }, []);

  const handleRunProfileChange = useCallback((profile: RunProfile) => {
    setRunProfile(profile);
    if (profile !== 'custom') applyRunProfileDefaults(profile);
  }, [applyRunProfileDefaults]);

  const handleModelProviderChange = useCallback((value: string) => {
    markCustomRunProfile();
    setModelProviderId(value);
    const provider = modelProviders.find((item) => item.id === value) ?? null;
    if (provider) {
      applyRunProfileDefaults('quality', provider);
    } else {
      setGenerationModel('');
      setUtilityModel('');
    }
  }, [applyRunProfileDefaults, markCustomRunProfile, modelProviders]);

  const handleGenerationModelChange = useCallback((value: string) => {
    markCustomRunProfile();
    setGenerationModel(value);
    if (value !== '__custom__') setCustomModel('');
  }, [markCustomRunProfile]);

  const handleCustomModelChange = useCallback((value: string) => {
    markCustomRunProfile();
    setCustomModel(value);
  }, [markCustomRunProfile]);

  const handleUtilityModelChange = useCallback((value: string) => {
    markCustomRunProfile();
    setUtilityModel(value);
  }, [markCustomRunProfile]);

  const handleMaxOutputTokensChange = useCallback((value: number) => {
    markCustomRunProfile();
    setMaxOutputTokens(value);
  }, [markCustomRunProfile]);

  const handleAnthropicThinkingChange = useCallback((value: 'adaptive' | 'off') => {
    markCustomRunProfile();
    setAnthropicThinking(value);
  }, [markCustomRunProfile]);

  const handleModelEffortChange = useCallback((value: 'low' | 'medium' | 'high') => {
    markCustomRunProfile();
    setModelEffort(value);
  }, [markCustomRunProfile]);

  const settleApproval = useCallback((id: string, decision: ApprovalDecision) => {
    const resolve = approvalResolvers.current.get(id);
    approvalResolvers.current.delete(id);
    resolve?.(decision);
    setApprovalCards((cards) => cards.filter((card) => card.request.id !== id));
  }, []);

  const clearApprovals = useCallback((reason: string) => {
    const ids = [...approvalResolvers.current.keys()];
    for (const id of ids) {
      settleApproval(id, { status: 'denied', reason });
    }
    if (ids.length > 0) logLine('op-error', reason);
  }, [logLine, settleApproval]);

  const requestHostApproval = useCallback((request: ApprovalRequest): Promise<ApprovalDecision> => {
    logLine('op-meta', `approval pending: ${request.summary}`);
    return new Promise((resolve) => {
      approvalResolvers.current.set(request.id, resolve);
      setApprovalCards((cards) => [{ request }, ...cards.filter((card) => card.request.id !== request.id)]);
    });
  }, [logLine]);

  const readModelSelection = useCallback((): ModelSelectionPayload => {
    const selection: ModelSelectionPayload = {};
    if (modelProviderId) selection.modelProvider = modelProviderId;
    if (generationModel === '__custom__') {
      const custom = customModel.trim();
      if (custom) {
        selection.generationModel = custom;
        selection.customModel = true;
      }
    } else if (generationModel) {
      selection.generationModel = generationModel;
    }
    if (utilityModel) selection.utilityModel = utilityModel;
    const options: ModelOptions = {};
    if (Number.isFinite(maxOutputTokens)) options.maxOutputTokens = maxOutputTokens;
    if (selectedProvider?.id === 'anthropic') {
      options.anthropicThinking = anthropicThinking;
      options.effort = modelEffort;
    }
    if (Object.keys(options).length > 0) selection.modelOptions = options;
    return selection;
  }, [
    anthropicThinking,
    customModel,
    generationModel,
    maxOutputTokens,
    modelEffort,
    modelProviderId,
    selectedProvider,
    utilityModel,
  ]);

  const modelProviderIdRef = useRef(modelProviderId);
  const readModelSelectionRef = useRef(readModelSelection);

  useEffect(() => {
    modelProviderIdRef.current = modelProviderId;
    readModelSelectionRef.current = readModelSelection;
  }, [modelProviderId, readModelSelection]);

  const activeContract = useMemo<ActiveContract>(() => {
    const modelSelection = readModelSelection();
    const agentBroker = !playgroundMode && agentBrokerEnabled && !customContractEnabled && !scenarioUsesFixedPolicy(selectedScenario);
    const overrides = tokenOverridesFor(tokenPreset);
    const surfacePolicy = customContractEnabled
      ? surfacePolicyForPlan(surfacePlan, selectedScenario.toolNames)
      : selectedScenario.surfacePolicy;
    return {
      scenarioId: selectedScenario.id,
      prompt: prompt.trim() || selectedScenario.prompt,
      mode,
      toolNames: playgroundMode && !playgroundToolsEnabled
        ? []
        : runtimeToolNames ?? selectedScenario.toolNames,
      agentBroker,
      ...(!playgroundMode && !agentBroker ? { surfacePolicy } : {}),
      surfacePlan,
      ...(layoutId ? { layoutId } : {}),
      ...(overrides ? { tokenOverrides: overrides } : {}),
      directionId,
      modelProvider: modelSelection.modelProvider ?? null,
      ...(modelSelection.generationModel ? { generationModel: modelSelection.generationModel } : {}),
      ...(modelSelection.utilityModel ? { utilityModel: modelSelection.utilityModel } : {}),
      ...(modelSelection.customModel ? { customModel: true } : {}),
      ...(modelSelection.modelOptions ? { modelOptions: modelSelection.modelOptions } : {}),
    };
  }, [
    agentBrokerEnabled,
    customContractEnabled,
    playgroundMode,
    playgroundToolsEnabled,
    directionId,
    layoutId,
    mode,
    prompt,
    readModelSelection,
    runtimeToolNames,
    selectedScenario,
    surfacePlan,
    tokenPreset,
  ]);

  const toolRegistry = useMemo(() => {
    if (activeContract.mode !== 'interactive') return null;
    let localSummonCount = summonedCountRef.current;
    return createScopedDemoRegistry({
      modelProvider: () => modelProviderIdRef.current || null,
      modelSelection: () => readModelSelectionRef.current(),
      onLog: (message) => logLine('op-add', message),
      onError: (message) => logLine('op-error', message),
      onApprovalRequest: requestHostApproval,
      onSummon: ({ args, push }) => {
        const child: ChildSurfaceModel = {
          id: Date.now(),
          prompt: args.prompt,
          title: args.title || undefined,
          directionId,
          tokensSource: activeTokensSourceOverrideRef.current ?? tokensFor(directionId),
          modelSelection: readModelSelectionRef.current(),
          agentBroker: activeContract.agentBroker === true,
        };
        setChildren((items) => [...items, child]);
        localSummonCount += 1;
        summonedCountRef.current = localSummonCount;
        push({ summonedCount: localSummonCount, lastSummoned: args.prompt, summonError: null });
        logLine('op-meta', `summon sibling: ${args.prompt.slice(0, 80)}`);
      },
    }, activeContract.toolNames);
  }, [
    activeContract.agentBroker,
    activeContract.toolNames,
    activeContract.mode,
    directionId,
    logLine,
    requestHostApproval,
    tokensFor,
  ]);

  const toolContract = useMemo(() => toolRegistry?.toContract() ?? null, [toolRegistry]);

  function resetForScenarioChange() {
    abortRef.current?.abort();
    clearApprovals('Approval request was replaced');
    setLogs([]);
    setDevEvents([]);
    setStatus('idle');
    setBytes(0);
    setShowWelcome(true);
    setRuntimeToolNames(null);
    setChildren([]);
    setTimingEntries([]);
    summonedCountRef.current = 0;
    clearRuntimeState();
  }

  function applyScenario(id: string) {
    const scenario = showcaseScenarios.find((item) => item.id === id) ?? showcaseScenarios[0]!;
    setSelectedScenarioId(scenario.id);
    setPrompt(scenario.prompt);
    setMode(scenario.mode);
    setSurfacePlan(scenario.surfacePlan);
    setLayoutId(scenario.layoutId ?? '');
    setTokenPreset(scenario.tokenOverrides ? 'accent-blue' : '');
    const fallbackDirectionId = directions[0]?.id ?? null;
    const desiredDirectionId = scenario.directionId ?? fallbackDirectionId;
    setDirectionId(desiredDirectionId ?? null);
    if (scenario.id.startsWith('ghost-')) {
      const rootId = scenario.id.slice('ghost-'.length);
      const root = ghostRoots.find((item) => item.id === rootId);
      setGhostTarget(root?.defaultTargetPath || '.');
      setGhostBaseDirectionId(root?.defaultBaseDirectionId ?? null);
    }
    resetForScenarioChange();
    logLine('op-meta', `scenario -> ${scenario.label}`);
  }

  const streamGenerationInto = useSurfaceStream({
    surfaceRef,
    modeRef,
    artifactRevisionRef,
    directionId,
    tokensFor,
    appendDevEvent,
    logLine,
    setBytes,
    setMode,
    setCurrentAgentGoalSummary,
    setCurrentAgentPolicySummary,
    setCurrentEffectiveSurfacePlan,
    setCurrentSurfaceContractView,
    setCurrentShape,
    setActiveTokensSourceOverride,
    setSurfaceTokensSource,
    setCurrentValidationSummary,
    setCurrentStreamHealth,
    setStatus,
    setArtifactRevision,
    appendTimingEntry,
  });

  const readLayout = useCallback((): SummonLayout | null => {
    const layout = layoutPresets.get(layoutId);
    return layout ? { id: layout.id, slots: layout.slots.map((slot) => ({ ...slot })) } : null;
  }, [layoutId]);

  const saveSurfaceEnvelope = useCallback((runPrompt: string, result: StreamResult) => {
    const artifact = findArrowArtifact(result.protocolLines);
    if (!result.surfacePlan || !artifact) return;
    const envelope = createSurfaceEnvelope({
      prompt: runPrompt,
      surfacePlan: result.surfacePlan,
      artifact,
      protocolLines: result.protocolLines,
      validationIssues: result.validationIssues,
      streamGraph: result.streamGraph,
      grants: {
        tools: toolRegistry?.tools() ?? [],
        validationTools: toolContract?.validationTools,
      },
      metadata: {
        directionId,
        layoutId: readLayout()?.id ?? null,
        shape: result.shape,
        mode,
        validationMode: 'observe',
      },
      tokenCss: activeTokensSourceOverride ?? tokensFor(directionId),
    });
    updateSavedSurfaces([
      envelope,
      ...loadSavedSurfaces().filter((item) => item.id !== envelope.id),
    ]);
  }, [
    activeTokensSourceOverride,
    toolContract,
    toolRegistry,
    directionId,
    mode,
    readLayout,
    tokensFor,
    updateSavedSurfaces,
  ]);

  const { generate, replaySurface } = useGenerationRuns({
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
  });

  const providerModels = selectedProvider?.models.length
    ? selectedProvider.models
    : selectedProvider
      ? fallbackCatalog(selectedProvider.model, selectedProvider.model)
      : [];
  const utilityModels = selectedProvider?.utilityModels.length
    ? selectedProvider.utilityModels
    : selectedProvider
      ? fallbackCatalog(selectedProvider.utilityModel, selectedProvider.utilityModel)
      : [];
  const statusLabel = generationPhaseLabel(status);
  const statusText = bytes ? `${statusLabel} · ${bytes.toLocaleString()} B` : statusLabel;
  const latestStageError = useMemo(() => {
    for (let i = logs.length - 1; i >= 0; i -= 1) {
      const entry = logs[i];
      if (entry?.cls.split(/\s+/).includes('op-error')) return cleanStageError(entry.text);
    }
    return null;
  }, [logs]);
  const stageNotice = useMemo(() => {
    const hasRenderedArtifact = artifactRevision > 0;
    if (!showWelcome && !hasRenderedArtifact && (status === 'error' || status.startsWith('error'))) {
      return {
        tone: 'error' as const,
        title: playgroundMode ? 'No renderable Arrow artifact was produced' : 'Generation failed',
        detail: latestStageError ?? (playgroundMode
          ? 'The model response could not be normalized into a main.ts/main.js Arrow bundle.'
          : 'No accepted artifact was produced.'),
      };
    }
    if (!showWelcome && !hasRenderedArtifact && status === 'aborted') {
      return {
        tone: 'error' as const,
        title: 'Generation aborted',
      };
    }
    return null;
  }, [artifactRevision, latestStageError, playgroundMode, showWelcome, status]);
  const contractRows = buildContractRows({
    active: activeContract,
    selectedScenario,
    modelProviders,
    currentAgentGoalSummary,
    currentAgentPolicySummary,
    currentEffectiveSurfacePlan,
    currentShape,
    currentStreamHealth,
    currentSurfaceContractView,
    currentValidationSummary,
  });
  const devtoolsTally = useMemo(() => {
    if (devEvents.length === 0) return 'no events';
    const counts: Record<string, number> = {};
    for (const ev of devEvents) counts[ev.kind] = (counts[ev.kind] ?? 0) + 1;
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([kind, count]) => `${displayEventKind(kind)} ${count}`)
      .join(' · ');
  }, [devEvents]);

  return (
    <>
      <div className="sr-only">
        <h1>Generate</h1>
        <p>Scenario-led generative UI generation</p>
      </div>

      <div className="relative h-screen overflow-hidden bg-surface">
        <header className="relative z-40 flex min-w-0 items-center justify-between gap-3 px-6 py-4 max-[820px]:px-4">
          <a
            className="shrink-0 text-[15px] font-bold text-ink no-underline transition-opacity hover:opacity-60"
            href="/"
          >
            summon
          </a>
          <Button
            type="button"
            variant={advancedOpen ? 'primary' : 'ghost'}
            size="sm"
            className="rounded-full"
            aria-expanded={advancedOpen}
            onClick={() => setAdvancedOpen((open) => !open)}
          >
            Options
          </Button>
        </header>

        <GenerationStage
          prompt={prompt}
          scenarioPicker={(
            <div className="flex flex-wrap items-center justify-start gap-1.5" aria-label="Sample prompts">
              {showcaseScenarios.slice(0, 15).map((scenario) => {
                const active = scenario.id === selectedScenario.id;
                return (
                  <button
                    key={scenario.id}
                    type="button"
                    className={cn(
                      'max-w-[150px] truncate rounded-full border px-2.5 py-1 text-[11px] font-semibold leading-none transition-colors',
                      active
                        ? 'border-ink bg-ink text-ink-inverse'
                        : 'border-white/80 bg-white text-ink-soft hover:border-white hover:text-ink',
                    )}
                    aria-pressed={active}
                    title={scenario.prompt}
                    onClick={() => applyScenario(scenario.id)}
                  >
                    {scenario.label}
                  </button>
                );
              })}
            </div>
          )}
          setPrompt={setPrompt}
          running={running}
          onGenerate={generate}
          statusText={statusText}
          stageNotice={stageNotice}
          onOpenDiagnostics={() => setDiagnosticsOpen(true)}
          surfaceRef={surfaceRef}
          surfaceTokensSource={surfaceTokensSource}
          toolRegistry={toolRegistry}
          validationTools={toolContract?.validationTools}
          appendDevEvent={appendDevEvent}
          onSurfaceGoalRejected={handleSurfaceGoalRejected}
          onSurfaceHandlerError={handleSurfaceHandlerError}
          onSurfaceRuntimeError={handleSurfaceRuntimeError}
          showWelcome={showWelcome}
          hasRenderedArtifact={artifactRevision > 0}
          playgroundMode={playgroundMode}
          surfaceInstanceKey={surfaceInstanceKey}
          childSurfaces={children}
          onCloseChild={(id) => setChildren((items) => items.filter((item) => item.id !== id))}
        />
      </div>

      <div
        className={cn(
          'fixed right-6 top-[76px] z-50 max-h-[calc(100vh-96px)] w-[min(440px,calc(100vw-48px))] overflow-auto rounded-card border border-line bg-surface-raised shadow-elevated transition-[opacity,filter,transform] duration-500 ease-out motion-safe:animate-[summon-blur-fade-up_500ms_cubic-bezier(0.22,1,0.36,1)_both] max-[820px]:left-4 max-[820px]:right-4 max-[820px]:top-[68px] max-[820px]:w-auto',
          !advancedOpen && 'hidden',
        )}
      >
        <div className="flex items-center justify-between gap-3 border-b border-line bg-surface-muted px-3.5 py-3">
          <div>
            <div className="font-mono text-[10px] font-semibold uppercase tracking-normal text-ink-muted">Options</div>
            <div className="mt-0.5 font-mono text-[11px] text-ink-muted">{modelProviderId || 'server default'} · {mode}</div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              className="rounded-full border border-line px-3 py-1 text-xs font-semibold text-ink-soft transition-colors hover:bg-surface hover:text-ink"
              onClick={() => {
                setAdvancedOpen(false);
                setDiagnosticsOpen(true);
              }}
            >
              Diagnostics
            </button>
            <button
              type="button"
              className="rounded-full border border-line px-3 py-1 text-xs font-semibold text-ink-soft transition-colors hover:bg-surface hover:text-ink"
              onClick={() => setAdvancedOpen(false)}
            >
              Close
            </button>
          </div>
        </div>
        <div className="p-4 max-[820px]:p-3">
          <ContractInspector
            playgroundMode={playgroundMode}
            setPlaygroundMode={setPlaygroundMode}
            playgroundToolsEnabled={playgroundToolsEnabled}
            setPlaygroundToolsEnabled={setPlaygroundToolsEnabled}
            contractRows={contractRows}
            currentSurfaceContractView={currentSurfaceContractView}
            currentEffectiveSurfacePlan={currentEffectiveSurfacePlan}
            runProfile={runProfile}
            onRunProfileChange={handleRunProfileChange}
            modelProviderId={modelProviderId}
            setModelProviderId={handleModelProviderChange}
            modelProviders={modelProviders}
            selectedProvider={selectedProvider}
            providerModels={providerModels}
            utilityModels={utilityModels}
            generationModel={generationModel}
            setGenerationModel={handleGenerationModelChange}
            customModel={customModel}
            setCustomModel={handleCustomModelChange}
            utilityModel={utilityModel}
            setUtilityModel={handleUtilityModelChange}
            maxOutputTokens={maxOutputTokens}
            setMaxOutputTokens={handleMaxOutputTokensChange}
            anthropicThinking={anthropicThinking}
            setAnthropicThinking={handleAnthropicThinkingChange}
            modelEffort={modelEffort}
            setModelEffort={handleModelEffortChange}
            directions={directions}
            ghostRoots={ghostRoots}
            directionId={directionId}
            setDirectionId={setDirectionId}
            setActiveTokensSourceOverride={setActiveTokensSourceOverride}
            setShowWelcome={setShowWelcome}
            layoutId={layoutId}
            setLayoutId={setLayoutId}
            tokenPreset={tokenPreset}
            setTokenPreset={setTokenPreset}
            mode={mode}
            setMode={setMode}
            agentBrokerEnabled={agentBrokerEnabled}
            setAgentBrokerEnabled={setAgentBrokerEnabled}
            customContractEnabled={customContractEnabled}
            setCustomContractEnabled={setCustomContractEnabled}
            selectedScenario={selectedScenario}
            ghostTarget={ghostTarget}
            setGhostTarget={setGhostTarget}
            ghostBaseDirectionId={ghostBaseDirectionId}
            setGhostBaseDirectionId={setGhostBaseDirectionId}
            surfacePlan={surfacePlan}
            setSurfacePlan={setSurfacePlan}
          />
        </div>
      </div>

      <div
        className={cn(
          'fixed right-6 top-[76px] z-50 flex max-h-[calc(100vh-96px)] w-[min(720px,calc(100vw-48px))] flex-col overflow-hidden rounded-card border border-line bg-surface-raised shadow-elevated transition-[opacity,filter,transform] duration-500 ease-out motion-safe:animate-[summon-blur-fade-up_500ms_cubic-bezier(0.22,1,0.36,1)_both] max-[820px]:left-4 max-[820px]:right-4 max-[820px]:top-[68px] max-[820px]:w-auto',
          !diagnosticsOpen && 'hidden',
        )}
      >
        <div className="flex items-center justify-between gap-3 border-b border-line bg-surface-muted px-3.5 py-3">
          <div>
            <div className="font-mono text-[10px] font-semibold uppercase tracking-normal text-ink-muted">Diagnostics</div>
            <div className="mt-0.5 font-mono text-[11px] text-ink-muted">{statusText}</div>
          </div>
          <button
            type="button"
            className="rounded-full border border-line px-3 py-1 text-xs font-semibold text-ink-soft transition-colors hover:bg-surface hover:text-ink"
            onClick={() => setDiagnosticsOpen(false)}
          >
            Close
          </button>
        </div>
        <DiagnosticsDock
          diagnosticsTab={diagnosticsTab}
          setDiagnosticsTab={setDiagnosticsTab}
          statusText={statusText}
          devtoolsTally={devtoolsTally}
          logs={logs}
          devEvents={devEvents}
          timingEntries={timingEntries}
          savedSurfaces={savedSurfaces}
          replaySurface={replaySurface}
          embedded
        />
      </div>

      <ApprovalStack
        approvalCards={approvalCards}
        logLine={logLine}
        settleApproval={settleApproval}
      />
    </>
  );
}

function cleanStageError(text: string): string {
  return text
    .replace(/^stream error:\s*/i, '')
    .replace(/^error:\s*/i, '')
    .trim();
}

function findArrowArtifact(lines: readonly ProtocolLine[]) {
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    if (line?.op === 'artifact' && line.path === '/artifact' && isArrowSurfaceArtifact(line.value)) {
      return line.value;
    }
  }
  return null;
}
