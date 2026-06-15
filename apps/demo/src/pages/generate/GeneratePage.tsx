import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type SummonSurfaceHandle } from '@anarchitecture/summon-react';
import { createSurfaceEnvelope } from '@anarchitecture/summon/envelope';
import {
  deriveSurfacePlanControls,
  SectionAccumulator,
  type SummonLayout,
  type SurfaceContractView,
  type SurfacePlan,
} from '@anarchitecture/summon/engine';
import type { ApprovalDecision, ApprovalRequest } from '@anarchitecture/summon';
import type { DevtoolsEvent } from '@anarchitecture/summon/devtools';
import defaultTokensSource from '@anarchitecture/summon/tokens.css?raw';
import { AppNav } from '../../components/chrome.js';
import { pageWidthClass } from '../../components/ui.js';
import { cn } from '../../lib/cn.js';
import {
  createGhostShowcaseScenario,
  createScopedDemoRegistry,
  SHOWCASE_SCENARIOS,
  type ActiveContract,
  type Mode,
} from '../../showcase.js';
import { createDemoComponentRegistry, narrowComponentPack } from '../../components.js';
import { ApprovalStack } from './components/ApprovalStack.js';
import { ContractInspector } from './components/ContractInspector.js';
import { DiagnosticsDock } from './components/DiagnosticsDock.js';
import { GenerationStage } from './components/GenerationStage.js';
import { ScenarioRail } from './components/ScenarioRail.js';
import { baseComponentPack, layoutPresets } from './constants.js';
import { displayEventKind, type ExtraDevtoolsEvent } from './devtools.js';
import { useGenerationRuns } from './hooks/useGenerationRuns.js';
import { useSavedSurfaces } from './hooks/useSavedSurfaces.js';
import { useSurfaceStream } from './hooks/useSurfaceStream.js';
import { useWorkbenchCatalogs } from './hooks/useWorkbenchCatalogs.js';
import { fallbackCatalog } from './modelProviders.js';
import { loadSavedSurfaces } from './savedSurfaces.js';
import {
  buildContractRows,
  describeScenario,
  ghostRootFromSelection,
  groupScenarios,
  scenarioUsesFixedPolicy,
  tokenOverridesFor,
} from './surfaceHelpers.js';
import type {
  ApprovalCard,
  ChildSurfaceModel,
  FragmentMode,
  LogEntry,
  ModelOptions,
  ModelSelectionPayload,
  StreamResult,
} from './types.js';

export function GeneratePage() {
  const surfaceRef = useRef<SummonSurfaceHandle>(null);
  const accRef = useRef(new SectionAccumulator());
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
  const [fragmentMode, setFragmentMode] = useState<FragmentMode>('section');
  const [tokenPreset, setTokenPreset] = useState('');
  const [agentBrokerEnabled, setAgentBrokerEnabled] = useState(true);
  const [repairEnabled, setRepairEnabled] = useState(false);
  const [customContractEnabled, setCustomContractEnabled] = useState(false);
  const [directionId, setDirectionId] = useState<string | null>(null);
  const [ghostTarget, setGhostTarget] = useState('.');
  const [ghostBaseDirectionId, setGhostBaseDirectionId] = useState<string | null>(null);
  const [modelProviderId, setModelProviderId] = useState('');
  const [generationModel, setGenerationModel] = useState('');
  const [utilityModel, setUtilityModel] = useState('');
  const [customModel, setCustomModel] = useState('');
  const [maxOutputTokens, setMaxOutputTokens] = useState(64000);
  const [repairMaxOutputTokens, setRepairMaxOutputTokens] = useState(12000);
  const [anthropicThinking, setAnthropicThinking] = useState<'adaptive' | 'off'>('adaptive');
  const [modelEffort, setModelEffort] = useState<'low' | 'medium' | 'high'>('medium');
  const [activeTokensSourceOverride, setActiveTokensSourceOverride] = useState<string | null>(null);
  const [surfaceTokensSource, setSurfaceTokensSource] = useState(defaultTokensSource);
  const [runtimeCapabilityNames, setRuntimeCapabilityNames] = useState<string[] | null>(null);
  const [runtimeComponentNames, setRuntimeComponentNames] = useState<string[] | null>(null);
  const [status, setStatus] = useState('idle');
  const [bytes, setBytes] = useState(0);
  const [showWelcome, setShowWelcome] = useState(true);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [devEvents, setDevEvents] = useState<Array<DevtoolsEvent | ExtraDevtoolsEvent>>([]);
  const [currentEffectiveSurfacePlan, setCurrentEffectiveSurfacePlan] = useState<SurfacePlan | null>(null);
  const [currentShape, setCurrentShape] = useState<string | null>(null);
  const [currentValidationSummary, setCurrentValidationSummary] = useState<string | null>(null);
  const [currentRepairSummary, setCurrentRepairSummary] = useState<string | null>(null);
  const [currentStreamHealth, setCurrentStreamHealth] = useState<string | null>(null);
  const [currentSurfaceContractView, setCurrentSurfaceContractView] = useState<SurfaceContractView | null>(null);
  const [currentAgentIntentSummary, setCurrentAgentIntentSummary] = useState<string | null>(null);
  const [currentAgentPolicySummary, setCurrentAgentPolicySummary] = useState<string | null>(null);
  const [artifactRevision, setArtifactRevision] = useState(0);
  const artifactRevisionRef = useRef(0);
  const [editTargets, setEditTargets] = useState('');
  const [editPrompt, setEditPrompt] = useState('');
  const [diagnosticsTab, setDiagnosticsTab] = useState<'stream' | 'devtools' | 'history' | 'safety'>('stream');
  const [approvalCards, setApprovalCards] = useState<ApprovalCard[]>([]);
  const [children, setChildren] = useState<ChildSurfaceModel[]>([]);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    artifactRevisionRef.current = artifactRevision;
  }, [artifactRevision]);

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
      setRepairMaxOutputTokens(12000);
      return;
    }
    const generationDefault = selectedProvider.defaults?.generationModel ?? selectedProvider.model;
    const utilityDefault = selectedProvider.defaults?.utilityModel ?? selectedProvider.utilityModel;
    setGenerationModel((current) => current || generationDefault);
    setUtilityModel((current) => current || utilityDefault);
    setMaxOutputTokens(selectedProvider.controls?.maxOutputTokens.default ?? selectedProvider.defaults?.modelOptions.maxOutputTokens ?? 64000);
    setRepairMaxOutputTokens(selectedProvider.controls?.repairMaxOutputTokens.default ?? selectedProvider.defaults?.modelOptions.repairMaxOutputTokens ?? 12000);
    setAnthropicThinking(selectedProvider.controls?.anthropicThinking?.default ?? 'adaptive');
    setModelEffort(selectedProvider.controls?.effort?.default ?? 'medium');
  }, [selectedProvider]);

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

  const handleSurfaceIntentRejected = useCallback((reason: string) => {
    logLine('op-error', `rejected: ${reason}`);
  }, [logLine]);

  const handleSurfaceHandlerError = useCallback((intent: string, error: Error) => {
    logLine('op-error', `host handler error (${intent}): ${error.message}`);
  }, [logLine]);

  const handleSurfaceComponentError = useCallback((error: { componentName?: string; componentId?: string; reason: string }) => {
    logLine('op-error', `component ${error.componentName ?? error.componentId ?? '?'}: ${error.reason}`);
  }, [logLine]);

  const clearRuntimeState = useCallback(() => {
    accRef.current = new SectionAccumulator();
    setArtifactRevision(0);
    artifactRevisionRef.current = 0;
    setActiveTokensSourceOverride(null);
    setCurrentEffectiveSurfacePlan(null);
    setCurrentShape(null);
    setCurrentValidationSummary(null);
    setCurrentRepairSummary(null);
    setCurrentStreamHealth(null);
    setCurrentSurfaceContractView(null);
    setCurrentAgentIntentSummary(null);
    setCurrentAgentPolicySummary(null);
  }, []);

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
    if (Number.isFinite(repairMaxOutputTokens)) options.repairMaxOutputTokens = repairMaxOutputTokens;
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
    repairMaxOutputTokens,
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
    const agentBroker = agentBrokerEnabled && !customContractEnabled && !scenarioUsesFixedPolicy(selectedScenario);
    const overrides = tokenOverridesFor(tokenPreset);
    const repair = repairEnabled
      ? selectedScenario.repair ?? { enabled: true, maxAttempts: 1, maxTargets: 2 }
      : undefined;
    return {
      scenarioId: selectedScenario.id,
      prompt: prompt.trim() || selectedScenario.prompt,
      mode,
      capabilityNames: runtimeCapabilityNames ?? selectedScenario.capabilityNames,
      componentNames: runtimeComponentNames ?? selectedScenario.componentNames,
      agentBroker,
      ...(!agentBroker && !customContractEnabled ? { surfacePolicy: selectedScenario.surfacePolicy } : {}),
      surfacePlan,
      scriptPolicy: deriveSurfacePlanControls(surfacePlan).scriptPolicy,
      ...(layoutId ? { layoutId } : {}),
      ...(overrides ? { tokenOverrides: overrides } : {}),
      ...(repair ? { repair } : {}),
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
    directionId,
    layoutId,
    mode,
    prompt,
    readModelSelection,
    repairEnabled,
    runtimeCapabilityNames,
    runtimeComponentNames,
    selectedScenario,
    surfacePlan,
    tokenPreset,
  ]);

  const capabilityRegistry = useMemo(() => {
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
          tokensSource: activeTokensSourceOverride ?? tokensFor(directionId),
          modelSelection: readModelSelectionRef.current(),
          agentBroker: activeContract.agentBroker === true,
        };
        setChildren((items) => [...items, child]);
        localSummonCount += 1;
        summonedCountRef.current = localSummonCount;
        push({ summonedCount: localSummonCount, lastSummoned: args.prompt, summonError: null });
        logLine('op-meta', `summon sibling: ${args.prompt.slice(0, 80)}`);
      },
    }, activeContract.capabilityNames);
  }, [
    activeContract.agentBroker,
    activeContract.capabilityNames,
    activeContract.mode,
    activeTokensSourceOverride,
    directionId,
    logLine,
    requestHostApproval,
    tokensFor,
  ]);

  const capabilityContract = useMemo(() => capabilityRegistry?.toContract() ?? null, [capabilityRegistry]);
  const componentRegistry = useMemo(() => createDemoComponentRegistry(), []);
  const grantedComponents = useMemo(
    () => activeContract.componentNames?.length
      ? narrowComponentPack(baseComponentPack, activeContract.componentNames).components
      : [],
    [activeContract.componentNames],
  );

  function resetForScenarioChange() {
    abortRef.current?.abort();
    clearApprovals('Approval request was replaced');
    setLogs([]);
    setDevEvents([]);
    setStatus('idle');
    setBytes(0);
    setShowWelcome(true);
    setRuntimeCapabilityNames(null);
    setRuntimeComponentNames(null);
    setChildren([]);
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
    setRepairEnabled(Boolean(scenario.repair?.enabled));
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
    accRef,
    modeRef,
    artifactRevisionRef,
    directionId,
    tokensFor,
    appendDevEvent,
    logLine,
    setBytes,
    setMode,
    setCurrentAgentIntentSummary,
    setCurrentAgentPolicySummary,
    setCurrentEffectiveSurfacePlan,
    setCurrentSurfaceContractView,
    setCurrentShape,
    setActiveTokensSourceOverride,
    setSurfaceTokensSource,
    setCurrentValidationSummary,
    setCurrentRepairSummary,
    setCurrentStreamHealth,
    setStatus,
    setArtifactRevision,
  });

  const readLayout = useCallback((): SummonLayout | null => {
    const layout = layoutPresets.get(layoutId);
    return layout ? { id: layout.id, slots: layout.slots.map((slot) => ({ ...slot })) } : null;
  }, [layoutId]);

  const saveSurfaceEnvelope = useCallback((runPrompt: string, result: StreamResult) => {
    if (!result.surfacePlan || !accRef.current.hasAnySection()) return;
    const envelope = createSurfaceEnvelope({
      prompt: runPrompt,
      surfacePlan: result.surfacePlan,
      protocolLines: result.protocolLines,
      html: accRef.current.compose(),
      validationIssues: result.validationIssues,
      streamGraph: result.streamGraph,
      grants: {
        intents: capabilityRegistry?.intents() ?? [],
        capabilities: capabilityContract?.validationCapabilities,
        components: grantedComponents,
      },
      metadata: {
        directionId,
        layoutId: readLayout()?.id ?? null,
        shape: result.shape,
        mode,
      },
      tokenCss: activeTokensSourceOverride ?? tokensFor(directionId),
    });
    updateSavedSurfaces([
      envelope,
      ...loadSavedSurfaces().filter((item) => item.id !== envelope.id),
    ]);
  }, [
    activeTokensSourceOverride,
    capabilityContract,
    capabilityRegistry,
    directionId,
    grantedComponents,
    mode,
    readLayout,
    tokensFor,
    updateSavedSurfaces,
  ]);

  const { generate, editArtifact, replaySurface } = useGenerationRuns({
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
  });

  const groupedScenarios = useMemo(() => groupScenarios(showcaseScenarios), [showcaseScenarios]);

  const scenarioPresentation = describeScenario(selectedScenario);
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
  const scriptPolicy = deriveSurfacePlanControls(surfacePlan).scriptPolicy;
  const statusText = bytes ? `${status} · ${bytes.toLocaleString()} B` : status;
  const hasArtifact = artifactRevision > 0 || accRef.current.hasAnySection();
  const contractRows = buildContractRows({
    active: activeContract,
    selectedScenario,
    modelProviders,
    currentAgentIntentSummary,
    currentAgentPolicySummary,
    currentEffectiveSurfacePlan,
    currentShape,
    currentStreamHealth,
    currentSurfaceContractView,
    currentRepairSummary,
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
      <AppNav active="generate" />
      <div className="sr-only">
        <h1>Generate</h1>
        <p>Scenario-led generative UI workbench</p>
      </div>

      <div className={cn(
        pageWidthClass,
        'grid grid-cols-[minmax(210px,260px)_minmax(0,1fr)_minmax(260px,320px)] items-start gap-[clamp(24px,3vw,52px)] max-[1180px]:grid-cols-[minmax(220px,260px)_minmax(0,1fr)] max-[820px]:grid-cols-1 max-[820px]:gap-6',
      )}>
        <ScenarioRail
          groupedScenarios={groupedScenarios}
          selectedScenario={selectedScenario}
          showcaseScenarios={showcaseScenarios}
          onApplyScenario={applyScenario}
        />

        <GenerationStage
          selectedScenario={selectedScenario}
          scenarioPresentation={scenarioPresentation}
          prompt={prompt}
          setPrompt={setPrompt}
          running={running}
          onGenerate={generate}
          hasArtifact={hasArtifact}
          status={status}
          currentEffectiveSurfacePlan={currentEffectiveSurfacePlan}
          surfacePlan={surfacePlan}
          setDiagnosticsTab={setDiagnosticsTab}
          editTargets={editTargets}
          setEditTargets={setEditTargets}
          editPrompt={editPrompt}
          setEditPrompt={setEditPrompt}
          onEditArtifact={editArtifact}
          statusText={statusText}
          surfaceRef={surfaceRef}
          surfaceTokensSource={surfaceTokensSource}
          capabilityRegistry={capabilityRegistry}
          componentRegistry={componentRegistry}
          grantedCapabilities={capabilityContract?.validationCapabilities}
          grantedComponents={grantedComponents}
          appendDevEvent={appendDevEvent}
          onSurfaceIntentRejected={handleSurfaceIntentRejected}
          onSurfaceHandlerError={handleSurfaceHandlerError}
          onSurfaceComponentError={handleSurfaceComponentError}
          showWelcome={showWelcome}
          childSurfaces={children}
          onCloseChild={(id) => setChildren((items) => items.filter((item) => item.id !== id))}
        />

        <ContractInspector
          contractRows={contractRows}
          currentSurfaceContractView={currentSurfaceContractView}
          currentEffectiveSurfacePlan={currentEffectiveSurfacePlan}
          modelProviderId={modelProviderId}
          setModelProviderId={setModelProviderId}
          modelProviders={modelProviders}
          selectedProvider={selectedProvider}
          providerModels={providerModels}
          utilityModels={utilityModels}
          generationModel={generationModel}
          setGenerationModel={setGenerationModel}
          customModel={customModel}
          setCustomModel={setCustomModel}
          utilityModel={utilityModel}
          setUtilityModel={setUtilityModel}
          maxOutputTokens={maxOutputTokens}
          setMaxOutputTokens={setMaxOutputTokens}
          repairMaxOutputTokens={repairMaxOutputTokens}
          setRepairMaxOutputTokens={setRepairMaxOutputTokens}
          anthropicThinking={anthropicThinking}
          setAnthropicThinking={setAnthropicThinking}
          modelEffort={modelEffort}
          setModelEffort={setModelEffort}
          directions={directions}
          ghostRoots={ghostRoots}
          directionId={directionId}
          setDirectionId={setDirectionId}
          setActiveTokensSourceOverride={setActiveTokensSourceOverride}
          setShowWelcome={setShowWelcome}
          layoutId={layoutId}
          setLayoutId={setLayoutId}
          fragmentMode={fragmentMode}
          setFragmentMode={setFragmentMode}
          scriptPolicy={scriptPolicy}
          tokenPreset={tokenPreset}
          setTokenPreset={setTokenPreset}
          mode={mode}
          setMode={setMode}
          agentBrokerEnabled={agentBrokerEnabled}
          setAgentBrokerEnabled={setAgentBrokerEnabled}
          repairEnabled={repairEnabled}
          setRepairEnabled={setRepairEnabled}
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

      <DiagnosticsDock
        diagnosticsTab={diagnosticsTab}
        setDiagnosticsTab={setDiagnosticsTab}
        statusText={statusText}
        devtoolsTally={devtoolsTally}
        logs={logs}
        devEvents={devEvents}
        savedSurfaces={savedSurfaces}
        replaySurface={replaySurface}
      />

      <ApprovalStack
        approvalCards={approvalCards}
        logLine={logLine}
        settleApproval={settleApproval}
      />
    </>
  );
}
