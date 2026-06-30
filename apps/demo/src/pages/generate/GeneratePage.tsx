import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type SummonSurfaceHandle } from "@anarchitecture/summon-react";
import type { SurfacePreviewSnapshot } from "@anarchitecture/summon/browser";
import { createSurfaceEnvelope } from "@anarchitecture/summon/envelope";
import {
  isArrowSurfaceArtifact,
  isHtmlSurfaceArtifact,
  type ProtocolLine,
  type SummonOutputRuntime,
  type SummonLayout,
  type SurfaceContractView,
  type SurfacePlan,
} from "@anarchitecture/summon/engine";
import type { ApprovalDecision, ApprovalRequest } from "@anarchitecture/summon";
import type { DevtoolsEvent } from "@anarchitecture/summon/devtools";
import defaultTokensSource from "@anarchitecture/summon/tokens.css?raw";
import { Button } from "../../components/ui.js";
import { cn } from "../../lib/cn.js";
import {
  createScopedDemoRegistry,
  SHOWCASE_SCENARIOS,
  type ActiveContract,
  type Mode,
} from "../../showcase.js";
import { ApprovalStack } from "./components/ApprovalStack.js";
import { ContractInspector } from "./components/ContractInspector.js";
import { DiagnosticsDock } from "./components/DiagnosticsDock.js";
import { GenerationStage } from "./components/GenerationStage.js";
import { layoutPresets } from "./constants.js";
import { displayEventKind, type ExtraDevtoolsEvent } from "./devtools.js";
import { buildGenerationPreview } from "./generationPreview.js";
import { useGenerationRuns } from "./hooks/useGenerationRuns.js";
import { useSavedSurfaces } from "./hooks/useSavedSurfaces.js";
import { useSurfaceStream } from "./hooks/useSurfaceStream.js";
import { useWorkbenchCatalogs } from "./hooks/useWorkbenchCatalogs.js";
import {
  createEmptyModelProfiles,
  defaultsForModelProfile,
  fallbackCatalog,
  hydrateMissingModelProfiles,
  isStructuredProfile,
  modelProfileKeyForRuntime,
  modelProfilesForRunProfile,
} from "./modelProviders.js";
import { loadSavedSurfaces } from "./savedSurfaces.js";
import {
  buildContractRows,
  generationPhaseLabel,
  runtimeTargetText,
  scenarioUsesFixedPolicy,
  surfacePolicyForPlan,
} from "./surfaceHelpers.js";
import type {
  ApprovalCard,
  ChildSurfaceModel,
  DiagnosticsTab,
  LogEntry,
  ModelOptions,
  ModelProfileKey,
  ModelProfileState,
  ModelProviderInfo,
  ModelSelectionPayload,
  RunProfile,
  StreamResult,
  TimingEntry,
} from "./types.js";

const DEFAULT_FINGERPRINT_ID = "editorial-mono";
const DEFAULT_EXPERIMENTAL_RUNTIME: SummonOutputRuntime = "arrow-control";

function profileStateToPayload(
  profile: ModelProfileState,
  key: ModelProfileKey,
  providers: ModelProviderInfo[],
): ModelSelectionPayload {
  const payload: ModelSelectionPayload = {};
  if (profile.modelProvider) payload.modelProvider = profile.modelProvider;

  if (key !== "utility") {
    if (profile.customModelEnabled) {
      const custom = profile.customModel.trim();
      if (custom) {
        payload.generationModel = custom;
        payload.customModel = true;
      }
    } else if (profile.generationModel) {
      payload.generationModel = profile.generationModel;
    }
  }
  if (profile.utilityModel) payload.utilityModel = profile.utilityModel;

  const options: ModelOptions = {};
  if (Number.isFinite(profile.maxOutputTokens))
    options.maxOutputTokens = profile.maxOutputTokens;
  const provider = providers.find((item) => item.id === profile.modelProvider);
  if (provider?.id === "anthropic") {
    options.anthropicThinking = profile.anthropicThinking;
    options.effort = profile.effort;
  }
  if (Object.keys(options).length > 0) payload.modelOptions = options;
  return payload;
}

export function GeneratePage() {
  const surfaceRef = useRef<SummonSurfaceHandle>(null);
  const abortRef = useRef<AbortController | null>(null);
  const modeRef = useRef<Mode>("interactive");
  const approvalResolvers = useRef(
    new Map<string, (decision: ApprovalDecision) => void>(),
  );
  const summonedCountRef = useRef(0);
  const { ghostRoots: fingerprints, modelProviders, defaultModelProviderId } =
    useWorkbenchCatalogs();
  const { savedSurfaces, updateSavedSurfaces } = useSavedSurfaces();

  const [selectedScenarioId, setSelectedScenarioId] = useState(
    SHOWCASE_SCENARIOS[0]?.id ?? "",
  );
  const [prompt, setPrompt] = useState(SHOWCASE_SCENARIOS[0]?.prompt ?? "");
  const [mode, setMode] = useState<Mode>(
    SHOWCASE_SCENARIOS[0]?.mode ?? "interactive",
  );
  const [surfacePlan, setSurfacePlan] = useState<SurfacePlan>(
    SHOWCASE_SCENARIOS[0]!.surfacePlan,
  );
  const [layoutId, setLayoutId] = useState("");
  const [playgroundMode, setPlaygroundMode] = useState(false);
  const [agentWardEnabled, setAgentWardEnabled] = useState(true);
  const [customContractEnabled, setCustomContractEnabled] = useState(false);
  const [fingerprintId, setFingerprintId] = useState<string | null>(
    DEFAULT_FINGERPRINT_ID,
  );
  const [fingerprintTargetPath, setFingerprintTargetPath] = useState(".");
  const [runProfile, setRunProfile] = useState<RunProfile>("quality");
  const [experimentalRuntime, setExperimentalRuntime] =
    useState<SummonOutputRuntime>(DEFAULT_EXPERIMENTAL_RUNTIME);
  const [modelProfiles, setModelProfiles] = useState<
    Record<ModelProfileKey, ModelProfileState>
  >(() => createEmptyModelProfiles());
  const [activeTokensSourceOverride, setActiveTokensSourceOverride] = useState<
    string | null
  >(null);
  const activeTokensSourceOverrideRef = useRef<string | null>(null);
  const [surfaceTokensSource, setSurfaceTokensSource] =
    useState(defaultTokensSource);
  const [runtimeToolNames, setRuntimeToolNames] = useState<string[] | null>(
    null,
  );
  const [status, setStatus] = useState("idle");
  const [bytes, setBytes] = useState(0);
  const [showWelcome, setShowWelcome] = useState(true);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [devEvents, setDevEvents] = useState<
    Array<DevtoolsEvent | ExtraDevtoolsEvent>
  >([]);
  const [timingEntries, setTimingEntries] = useState<TimingEntry[]>([]);
  const [currentEffectiveSurfacePlan, setCurrentEffectiveSurfacePlan] =
    useState<SurfacePlan | null>(null);
  const [currentValidationSummary, setCurrentValidationSummary] = useState<
    string | null
  >(null);
  const [currentStreamHealth, setCurrentStreamHealth] = useState<string | null>(
    null,
  );
  const [currentSurfaceContractView, setCurrentSurfaceContractView] =
    useState<SurfaceContractView | null>(null);
  const [surfacePreviewSnapshot, setSurfacePreviewSnapshot] =
    useState<SurfacePreviewSnapshot | null>(null);
  const [currentAgentGoalSummary, setCurrentAgentGoalSummary] = useState<
    string | null
  >(null);
  const [currentAgentPolicySummary, setCurrentAgentPolicySummary] = useState<
    string | null
  >(null);
  const [artifactRevision, setArtifactRevision] = useState(0);
  const [surfaceInstanceKey, setSurfaceInstanceKey] = useState(0);
  const [surfaceReady, setSurfaceReady] = useState(false);
  const artifactRevisionRef = useRef(0);
  const [diagnosticsTab, setDiagnosticsTab] =
    useState<DiagnosticsTab>("stream");
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

  const showcaseScenarios = useMemo(() => SHOWCASE_SCENARIOS, []);
  const selectedScenario = useMemo(
    () =>
      showcaseScenarios.find(
        (scenario) => scenario.id === selectedScenarioId,
      ) ?? showcaseScenarios[0]!,
    [selectedScenarioId, showcaseScenarios],
  );
  const activeModelProfileKey: ModelProfileKey =
    modelProfileKeyForRuntime(experimentalRuntime);
  const activeModelProfile = modelProfiles[activeModelProfileKey];
  const utilityModelProfile = modelProfiles.utility;

  const selectedProvider = useMemo(
    () =>
      modelProviders.find(
        (provider) => provider.id === activeModelProfile.modelProvider,
      ) ?? null,
    [modelProviders, activeModelProfile.modelProvider],
  );

  const defaultProviderForInit = useMemo<ModelProviderInfo | null>(() => {
    if (modelProviders.length === 0) return null;
    const configuredDefault = defaultModelProviderId
      ? modelProviders.find(
          (provider) =>
            provider.id === defaultModelProviderId && provider.configured,
        )
      : null;
    const firstConfigured = modelProviders.find(
      (provider) => provider.configured,
    );
    return configuredDefault ?? firstConfigured ?? modelProviders[0] ?? null;
  }, [defaultModelProviderId, modelProviders]);

  useEffect(() => {
    if (!defaultProviderForInit) return;
    setModelProfiles((current) =>
      hydrateMissingModelProfiles(current, defaultProviderForInit, "quality"),
    );
  }, [defaultProviderForInit]);

  const updateModelProfile = useCallback(
    (key: ModelProfileKey, patch: Partial<ModelProfileState>) => {
      setModelProfiles((current) => ({
        ...current,
        [key]: { ...current[key], ...patch },
      }));
      setRunProfile("custom");
    },
    [],
  );

  useEffect(() => {
    if (fingerprints.length === 0) {
      setFingerprintId(null);
      setFingerprintTargetPath(".");
      return;
    }
    setFingerprintId((current) => {
      if (current && fingerprints.some((fingerprint) => fingerprint.id === current)) {
        return current;
      }
      const fallback =
        fingerprints.find((fingerprint) => fingerprint.id === DEFAULT_FINGERPRINT_ID)
          ?.id ?? fingerprints[0]?.id ?? null;
      const selected = fallback
        ? fingerprints.find((fingerprint) => fingerprint.id === fallback)
        : null;
      setFingerprintTargetPath(selected?.defaultTargetPath || ".");
      return fallback;
    });
  }, [fingerprints]);

  useEffect(() => {
    const selected = fingerprintId
      ? fingerprints.find((fingerprint) => fingerprint.id === fingerprintId)
      : null;
    if (selected && !fingerprintTargetPath.trim()) {
      setFingerprintTargetPath(selected.defaultTargetPath || ".");
    }
  }, [fingerprintId, fingerprintTargetPath, fingerprints]);

  const logLine = useCallback((cls: string, text: string) => {
    setLogs((items) => [...items, { cls, text }]);
  }, []);

  const appendDevEvent = useCallback(
    (event: DevtoolsEvent | ExtraDevtoolsEvent) => {
      if (event.kind === "render" || event.kind === "surface-disposed") {
        setSurfaceReady(false);
      } else if (
        event.kind === "rendered" ||
        event.kind === "surface-runtime-error"
      ) {
        setSurfaceReady(true);
      }
      setDevEvents((items) => [...items.slice(-799), event]);
    },
    [],
  );

  const appendTimingEntry = useCallback(
    (entry: Omit<TimingEntry, "id" | "at"> & { at?: number }) => {
      setTimingEntries((items) => [
        ...items.slice(-199),
        {
          ...entry,
          id: timingEntryIdRef.current++,
          at: entry.at ?? Date.now(),
        },
      ]);
    },
    [],
  );

  const handleSurfaceGoalRejected = useCallback(
    (reason: string) => {
      logLine("op-error", `rejected: ${reason}`);
    },
    [logLine],
  );

  const handleSurfaceHandlerError = useCallback(
    (tool: string, error: Error) => {
      logLine("op-error", `host handler error (${tool}): ${error.message}`);
    },
    [logLine],
  );

  const handleSurfaceRuntimeError = useCallback(
    (reason: string) => {
      logLine("op-error", `runtime error: ${reason}`);
      setStatus("runtime error");
    },
    [logLine],
  );

  const clearRuntimeState = useCallback(() => {
    setArtifactRevision(0);
    artifactRevisionRef.current = 0;
    activeTokensSourceOverrideRef.current = null;
    setActiveTokensSourceOverride(null);
    setTimingEntries([]);
    setCurrentEffectiveSurfacePlan(null);
    setCurrentValidationSummary(null);
    setCurrentStreamHealth(null);
    setCurrentSurfaceContractView(null);
    setSurfacePreviewSnapshot(null);
    setCurrentAgentGoalSummary(null);
    setCurrentAgentPolicySummary(null);
    setSurfaceReady(false);
  }, []);

  const handleRunProfileChange = useCallback(
    (profile: RunProfile) => {
      setRunProfile(profile);
      if (profile !== "custom") {
        setModelProfiles(
          modelProfilesForRunProfile(defaultProviderForInit, profile),
        );
      }
    },
    [defaultProviderForInit],
  );

  const handleModelProviderChange = useCallback(
    (value: string) => {
      const provider = modelProviders.find((item) => item.id === value) ?? null;
      setModelProfiles((current) => ({
        ...current,
        [activeModelProfileKey]: defaultsForModelProfile(
          provider,
          "quality",
          activeModelProfileKey,
        ),
      }));
      setRunProfile("custom");
    },
    [activeModelProfileKey, modelProviders],
  );

  const handleGenerationModelChange = useCallback(
    (value: string) => {
      updateModelProfile(activeModelProfileKey, {
        customModelEnabled: value === "__custom__",
        ...(value === "__custom__"
          ? {}
          : { generationModel: value, customModel: "" }),
      });
    },
    [activeModelProfileKey, updateModelProfile],
  );

  const handleCustomModelChange = useCallback(
    (value: string) => {
      updateModelProfile(activeModelProfileKey, { customModel: value });
    },
    [activeModelProfileKey, updateModelProfile],
  );

  const handleUtilityModelChange = useCallback(
    (value: string) => {
      updateModelProfile("utility", { utilityModel: value });
    },
    [updateModelProfile],
  );

  const handleMaxOutputTokensChange = useCallback(
    (value: number) => {
      updateModelProfile(activeModelProfileKey, { maxOutputTokens: value });
    },
    [activeModelProfileKey, updateModelProfile],
  );

  const handleAnthropicThinkingChange = useCallback(
    (value: "adaptive" | "off") => {
      updateModelProfile(activeModelProfileKey, { anthropicThinking: value });
    },
    [activeModelProfileKey, updateModelProfile],
  );

  const handleModelEffortChange = useCallback(
    (value: "low" | "medium" | "high" | "max") => {
      updateModelProfile(activeModelProfileKey, { effort: value });
    },
    [activeModelProfileKey, updateModelProfile],
  );

  const settleApproval = useCallback(
    (id: string, decision: ApprovalDecision) => {
      const resolve = approvalResolvers.current.get(id);
      approvalResolvers.current.delete(id);
      resolve?.(decision);
      setApprovalCards((cards) =>
        cards.filter((card) => card.request.id !== id),
      );
    },
    [],
  );

  const clearApprovals = useCallback(
    (reason: string) => {
      const ids = [...approvalResolvers.current.keys()];
      for (const id of ids) {
        settleApproval(id, { status: "denied", reason });
      }
      if (ids.length > 0) logLine("op-error", reason);
    },
    [logLine, settleApproval],
  );

  const requestHostApproval = useCallback(
    (request: ApprovalRequest): Promise<ApprovalDecision> => {
      logLine("op-meta", `approval pending: ${request.summary}`);
      return new Promise((resolve) => {
        approvalResolvers.current.set(request.id, resolve);
        setApprovalCards((cards) => [
          { request },
          ...cards.filter((card) => card.request.id !== request.id),
        ]);
      });
    },
    [logLine],
  );

  const readModelSelection = useCallback((): ModelSelectionPayload => {
    const activePayload = profileStateToPayload(
      activeModelProfile,
      activeModelProfileKey,
      modelProviders,
    );
    const utilityPayload = profileStateToPayload(
      utilityModelProfile,
      "utility",
      modelProviders,
    );
    return {
      // Flat fields preserved for backward compatibility and so that
      // ChildSurfaceModel.modelSelection continues to work unchanged.
      ...activePayload,
      modelProfiles: {
        [activeModelProfileKey]: activePayload,
        utility: utilityPayload,
      },
    };
  }, [
    activeModelProfile,
    activeModelProfileKey,
    modelProviders,
    utilityModelProfile,
  ]);

  const modelProviderIdRef = useRef(activeModelProfile.modelProvider ?? null);
  const readModelSelectionRef = useRef(readModelSelection);

  useEffect(() => {
    modelProviderIdRef.current = activeModelProfile.modelProvider ?? null;
    readModelSelectionRef.current = readModelSelection;
  }, [activeModelProfile.modelProvider, readModelSelection]);

  const activeContract = useMemo<ActiveContract>(() => {
    const modelSelection = readModelSelection();
    const agentWard =
      !playgroundMode &&
      agentWardEnabled &&
      !customContractEnabled &&
      !scenarioUsesFixedPolicy(selectedScenario);
    const surfacePolicy = customContractEnabled
      ? surfacePolicyForPlan(surfacePlan, selectedScenario.toolNames)
      : selectedScenario.surfacePolicy;
    return {
      scenarioId: selectedScenario.id,
      prompt: prompt.trim() || selectedScenario.prompt,
      mode,
      toolNames: runtimeToolNames ?? selectedScenario.toolNames,
      agentWard,
      ...(!playgroundMode && !agentWard ? { surfacePolicy } : {}),
      surfacePlan,
      ...(layoutId ? { layoutId } : {}),
      fingerprintId,
      modelProvider: modelSelection.modelProvider ?? null,
      ...(modelSelection.generationModel
        ? { generationModel: modelSelection.generationModel }
        : {}),
      ...(modelSelection.utilityModel
        ? { utilityModel: modelSelection.utilityModel }
        : {}),
      ...(modelSelection.customModel ? { customModel: true } : {}),
      experimentalRuntime,
      ...(modelSelection.modelOptions
        ? { modelOptions: modelSelection.modelOptions }
        : {}),
      ...(modelSelection.modelProfiles
        ? { modelProfiles: modelSelection.modelProfiles }
        : {}),
    };
  }, [
    agentWardEnabled,
    customContractEnabled,
    playgroundMode,
    fingerprintId,
    experimentalRuntime,
    layoutId,
    mode,
    prompt,
    readModelSelection,
    runtimeToolNames,
    selectedScenario,
    surfacePlan,
  ]);

  const toolRegistry = useMemo(() => {
    if (activeContract.mode !== "interactive") return null;
    let localSummonCount = summonedCountRef.current;
    return createScopedDemoRegistry(
      {
        modelProvider: () => modelProviderIdRef.current || null,
        modelSelection: () => readModelSelectionRef.current(),
        onLog: (message) => logLine("op-add", message),
        onError: (message) => logLine("op-error", message),
        onApprovalRequest: requestHostApproval,
        onSummon: ({ args, push }) => {
          const child: ChildSurfaceModel = {
            id: Date.now(),
            prompt: args.prompt,
            title: args.title || undefined,
            fingerprintId,
            fingerprintTargetPath: fingerprintTargetPath.trim() || ".",
            tokensSource:
              activeTokensSourceOverrideRef.current ?? defaultTokensSource,
            modelSelection: readModelSelectionRef.current(),
            agentWard: activeContract.agentWard === true,
          };
          setChildren((items) => [...items, child]);
          localSummonCount += 1;
          summonedCountRef.current = localSummonCount;
          push({
            summonedCount: localSummonCount,
            lastSummoned: args.prompt,
            summonError: null,
          });
          logLine("op-meta", `summon sibling: ${args.prompt.slice(0, 80)}`);
        },
      },
      activeContract.toolNames,
    );
  }, [
    activeContract.agentWard,
    activeContract.toolNames,
    activeContract.mode,
    fingerprintId,
    fingerprintTargetPath,
    logLine,
    requestHostApproval,
  ]);

  const toolContract = useMemo(
    () => toolRegistry?.toContract() ?? null,
    [toolRegistry],
  );

  const currentLayout = useMemo<SummonLayout | null>(() => {
    const layout = layoutPresets.get(layoutId);
    return layout
      ? { id: layout.id, slots: layout.slots.map((slot) => ({ ...slot })) }
      : null;
  }, [layoutId]);

  const readLayout = useCallback((): SummonLayout | null => {
    return currentLayout
      ? {
          id: currentLayout.id,
          slots: currentLayout.slots.map((slot) => ({ ...slot })),
        }
      : null;
  }, [currentLayout]);

  function resetForScenarioChange() {
    abortRef.current?.abort();
    clearApprovals("Approval request was replaced");
    setLogs([]);
    setDevEvents([]);
    setStatus("idle");
    setBytes(0);
    setShowWelcome(true);
    setRuntimeToolNames(null);
    setChildren([]);
    setTimingEntries([]);
    summonedCountRef.current = 0;
    clearRuntimeState();
  }

  function applyScenario(id: string) {
    const scenario =
      showcaseScenarios.find((item) => item.id === id) ?? showcaseScenarios[0]!;
    setSelectedScenarioId(scenario.id);
    setPrompt(scenario.prompt);
    setMode(scenario.mode);
    setSurfacePlan(scenario.surfacePlan);
    setLayoutId(scenario.layoutId ?? "");
    resetForScenarioChange();
    logLine("op-meta", `scenario -> ${scenario.label}`);
  }

  const streamGenerationInto = useSurfaceStream({
    surfaceRef,
    modeRef,
    artifactRevisionRef,
    appendDevEvent,
    logLine,
    setBytes,
    setMode,
    setCurrentAgentGoalSummary,
    setCurrentAgentPolicySummary,
    setCurrentEffectiveSurfacePlan,
    setCurrentSurfaceContractView,
    setActiveTokensSourceOverride,
    setSurfaceTokensSource,
    setCurrentValidationSummary,
    setCurrentStreamHealth,
    setStatus,
    setPreviewSnapshot: setSurfacePreviewSnapshot,
    setArtifactRevision,
    appendTimingEntry,
  });

  const saveSurfaceEnvelope = useCallback(
    (runPrompt: string, result: StreamResult) => {
      const artifact = findRenderableArtifact(result.protocolLines);
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
          fingerprintId,
          layoutId: readLayout()?.id ?? null,
          mode,
          validationMode: "observe",
        },
        tokenCss: activeTokensSourceOverride ?? defaultTokensSource,
      });
      updateSavedSurfaces([
        envelope,
        ...loadSavedSurfaces().filter((item) => item.id !== envelope.id),
      ]);
    },
    [
      activeTokensSourceOverride,
      toolContract,
      toolRegistry,
      fingerprintId,
      mode,
      readLayout,
      updateSavedSurfaces,
    ],
  );

  const { generate, replaySurface } = useGenerationRuns({
    surfaceRef,
    abortRef,
    artifactRevisionRef,
    modeRef,
    summonedCountRef,
    activeTokensSourceOverride,
    activeContract,
    playgroundMode,
    fingerprintId,
    experimentalRuntime,
    fingerprintTargetPath,
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
    setCurrentSurfaceContractView,
  });

  const utilityProvider =
    modelProviders.find(
      (provider) => provider.id === utilityModelProfile.modelProvider,
    ) ??
    selectedProvider;
  const providerModels = selectedProvider?.models.length
    ? selectedProvider.models
    : selectedProvider
    ? fallbackCatalog(selectedProvider.model, selectedProvider.model)
    : [];
  const utilityModels = utilityProvider?.utilityModels.length
    ? utilityProvider.utilityModels
    : utilityProvider
    ? fallbackCatalog(
        utilityProvider.utilityModel,
        utilityProvider.utilityModel,
      )
    : [];
  const statusLabel = generationPhaseLabel(status);
  const statusText = bytes
    ? `${statusLabel} · ${bytes.toLocaleString()} B`
    : statusLabel;
  const runtimeLabel = runtimeTargetText(experimentalRuntime);
  const generationPreview = useMemo(
    () =>
      buildGenerationPreview({
        prompt: activeContract.prompt,
        status,
        statusText,
        bytes,
        artifactRevision,
        rendered: surfaceReady,
        surfacePlan: currentEffectiveSurfacePlan ?? activeContract.surfacePlan,
        contractView: currentSurfaceContractView,
        layout: currentLayout,
        previewSnapshot: surfacePreviewSnapshot,
        toolNames: activeContract.toolNames,
      }),
    [
      activeContract.prompt,
      activeContract.surfacePlan,
      activeContract.toolNames,
      artifactRevision,
      bytes,
      currentEffectiveSurfacePlan,
      currentLayout,
      currentSurfaceContractView,
      status,
      statusText,
      surfacePreviewSnapshot,
      surfaceReady,
    ],
  );
  const latestStageError = useMemo(() => {
    for (let i = logs.length - 1; i >= 0; i -= 1) {
      const entry = logs[i];
      if (entry?.cls.split(/\s+/).includes("op-error"))
        return cleanStageError(entry.text);
    }
    return null;
  }, [logs]);
  const stageNotice = useMemo(() => {
    const hasRenderedArtifact = artifactRevision > 0;
    if (
      !showWelcome &&
      !hasRenderedArtifact &&
      (status === "error" || status.startsWith("error"))
    ) {
      return {
        tone: "error" as const,
        title: playgroundMode
          ? `No renderable ${runtimeLabel} artifact was produced`
          : "Generation failed",
        detail:
          latestStageError ??
          (playgroundMode
            ? `The model response could not be normalized into a ${runtimeLabel} bundle.`
            : "No accepted artifact was produced."),
      };
    }
    if (!showWelcome && !hasRenderedArtifact && status === "aborted") {
      return {
        tone: "error" as const,
        title: "Generation aborted",
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
    currentStreamHealth,
    currentSurfaceContractView,
    currentValidationSummary,
  });
  const generationDisabledReason = useMemo(() => {
    if (fingerprints.length === 0) {
      return "No Ghost fingerprint catalog is available.";
    }
    if (!fingerprintId) {
      return "Choose a Ghost fingerprint.";
    }
    if (!fingerprints.some((fingerprint) => fingerprint.id === fingerprintId)) {
      return "Selected Ghost fingerprint is not in the current catalog.";
    }
    return null;
  }, [fingerprintId, fingerprints]);
  const devtoolsTally = useMemo(() => {
    if (devEvents.length === 0) return "no events";
    const counts: Record<string, number> = {};
    for (const ev of devEvents) counts[ev.kind] = (counts[ev.kind] ?? 0) + 1;
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([kind, count]) => `${displayEventKind(kind)} ${count}`)
      .join(" · ");
  }, [devEvents]);

  return (
    <>
      <div className="sr-only">
        <h1>Generate</h1>
        <p>Scenario-led generative UI generation</p>
      </div>

      <div className="relative h-[100dvh] overflow-hidden bg-surface">
        <header className="relative z-40 flex min-w-0 items-center justify-between gap-3 px-6 py-4 max-[820px]:px-4">
          <a
            className="shrink-0 text-[15px] font-bold text-ink no-underline transition-opacity hover:opacity-60"
            href="/"
          >
            summon
          </a>
          <Button
            type="button"
            variant={advancedOpen ? "primary" : "ghost"}
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
          scenarioPicker={
            <div
              className="flex flex-wrap items-center justify-start gap-1.5"
              aria-label="Sample prompts"
            >
              {showcaseScenarios.slice(0, 15).map((scenario) => {
                const active = scenario.id === selectedScenario.id;
                return (
                  <button
                    key={scenario.id}
                    type="button"
                    className={cn(
                      "max-w-[150px] truncate rounded-full border px-4 py-2 !text-[12px] font-semibold leading-none transition-colors",
                      active
                        ? "border-ink bg-ink text-ink-inverse"
                        : "border-white/80 bg-white text-ink-soft hover:border-white hover:text-ink",
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
          }
          setPrompt={setPrompt}
          selectedFingerprintId={fingerprintId}
          fingerprints={fingerprints}
          onSelectFingerprint={(id) => {
            const fingerprint = id
              ? fingerprints.find((item) => item.id === id)
              : null;
            setFingerprintId(id);
            setFingerprintTargetPath(fingerprint?.defaultTargetPath || ".");
            setActiveTokensSourceOverride(null);
            setShowWelcome(true);
          }}
          experimentalRuntime={experimentalRuntime}
          onSelectExperimentalRuntime={setExperimentalRuntime}
          running={running}
          onGenerate={generate}
          statusText={statusText}
          generationDisabledReason={generationDisabledReason}
          generationPreview={generationPreview}
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
          surfaceReady={surfaceReady}
          playgroundMode={playgroundMode}
          surfaceInstanceKey={surfaceInstanceKey}
          childSurfaces={children}
          onCloseChild={(id) =>
            setChildren((items) => items.filter((item) => item.id !== id))
          }
        />
      </div>

      <div
        className={cn(
          "fixed right-6 top-[76px] z-50 max-h-[calc(100vh-96px)] w-[min(440px,calc(100vw-48px))] overflow-auto rounded-card border border-line bg-surface-raised shadow-elevated transition-[opacity,filter,transform] duration-500 ease-out motion-safe:animate-[summon-blur-fade-up_500ms_cubic-bezier(0.22,1,0.36,1)_both] max-[820px]:left-4 max-[820px]:right-4 max-[820px]:top-[68px] max-[820px]:w-auto",
          !advancedOpen && "hidden",
        )}
      >
        <div className="flex items-center justify-between gap-3 border-b border-line bg-surface-muted px-3.5 py-3">
          <div>
            <div className="font-mono text-[10px] font-semibold uppercase tracking-normal text-ink-muted">
              Options
            </div>
            <div className="mt-0.5 font-mono text-[11px] text-ink-muted">
              {activeModelProfile.modelProvider || "server default"} · {mode} · {runtimeLabel}
            </div>
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
            contractRows={contractRows}
            currentSurfaceContractView={currentSurfaceContractView}
            currentEffectiveSurfacePlan={currentEffectiveSurfacePlan}
            runProfile={runProfile}
            onRunProfileChange={handleRunProfileChange}
            modelProfileKey={activeModelProfileKey}
            structuredProfile={isStructuredProfile(activeModelProfileKey)}
            modelProviderId={activeModelProfile.modelProvider ?? ""}
            setModelProviderId={handleModelProviderChange}
            modelProviders={modelProviders}
            selectedProvider={selectedProvider}
            providerModels={providerModels}
            utilityModels={utilityModels}
            generationModel={
              activeModelProfile.customModelEnabled
                ? "__custom__"
                : activeModelProfile.generationModel
            }
            setGenerationModel={handleGenerationModelChange}
            customModel={activeModelProfile.customModel}
            setCustomModel={handleCustomModelChange}
            utilityModel={utilityModelProfile.utilityModel}
            setUtilityModel={handleUtilityModelChange}
            maxOutputTokens={activeModelProfile.maxOutputTokens}
            setMaxOutputTokens={handleMaxOutputTokensChange}
            anthropicThinking={
              isStructuredProfile(activeModelProfileKey)
                ? "off"
                : activeModelProfile.anthropicThinking
            }
            setAnthropicThinking={handleAnthropicThinkingChange}
            modelEffort={activeModelProfile.effort}
            setModelEffort={handleModelEffortChange}
            ghostRoots={fingerprints}
            fingerprintId={fingerprintId}
            setFingerprintId={setFingerprintId}
            setActiveTokensSourceOverride={setActiveTokensSourceOverride}
            setShowWelcome={setShowWelcome}
            layoutId={layoutId}
            setLayoutId={setLayoutId}
            mode={mode}
            setMode={setMode}
            agentWardEnabled={agentWardEnabled}
            setAgentWardEnabled={setAgentWardEnabled}
            customContractEnabled={customContractEnabled}
            setCustomContractEnabled={setCustomContractEnabled}
            selectedScenario={selectedScenario}
            fingerprintTargetPath={fingerprintTargetPath}
            setFingerprintTargetPath={setFingerprintTargetPath}
            surfacePlan={surfacePlan}
            setSurfacePlan={setSurfacePlan}
          />
        </div>
      </div>

      <div
        className={cn(
          "fixed right-6 top-[76px] z-50 flex max-h-[calc(100vh-96px)] w-[min(720px,calc(100vw-48px))] flex-col overflow-hidden rounded-card border border-line bg-surface-raised shadow-elevated transition-[opacity,filter,transform] duration-500 ease-out motion-safe:animate-[summon-blur-fade-up_500ms_cubic-bezier(0.22,1,0.36,1)_both] max-[820px]:left-4 max-[820px]:right-4 max-[820px]:top-[68px] max-[820px]:w-auto",
          !diagnosticsOpen && "hidden",
        )}
      >
        <div className="flex items-center justify-between gap-3 border-b border-line bg-surface-muted px-3.5 py-3">
          <div>
            <div className="font-mono text-[10px] font-semibold uppercase tracking-normal text-ink-muted">
              Diagnostics
            </div>
            <div className="mt-0.5 font-mono text-[11px] text-ink-muted">
              {statusText}
            </div>
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
    .replace(/^stream error:\s*/i, "")
    .replace(/^error:\s*/i, "")
    .trim();
}

function findRenderableArtifact(lines: readonly ProtocolLine[]) {
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    if (
      line?.op === "artifact" &&
      line.path === "/artifact" &&
      (isArrowSurfaceArtifact(line.value) || isHtmlSurfaceArtifact(line.value))
    ) {
      return line.value;
    }
  }
  return null;
}
