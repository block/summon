import type { Dispatch, SetStateAction } from 'react';
import {
  SURFACE_AUTHORITY_VALUES,
  SURFACE_DATA_VALUES,
  SURFACE_PERSISTENCE_VALUES,
  SURFACE_PURPOSE_VALUES,
  SURFACE_RUNTIME_VALUES,
  type ScriptPolicy,
  type SurfaceContractView,
  type SurfacePlan,
} from '@anarchitecture/summon/engine';
import type { Mode, ShowcaseScenario } from '../../../showcase.js';
import {
  ghostRootFromSelection,
  ghostSelectionValue,
  numberOptions,
  scenarioUsesFixedPolicy,
} from '../surfaceHelpers.js';
import type {
  DirectionInfo,
  FragmentMode,
  GhostRootInfo,
  ModelCatalogEntry,
  ModelProviderInfo,
} from '../types.js';

export function ContractInspector({
  contractRows,
  currentSurfaceContractView,
  currentEffectiveSurfacePlan,
  modelProviderId,
  setModelProviderId,
  modelProviders,
  selectedProvider,
  providerModels,
  utilityModels,
  generationModel,
  setGenerationModel,
  customModel,
  setCustomModel,
  utilityModel,
  setUtilityModel,
  maxOutputTokens,
  setMaxOutputTokens,
  repairMaxOutputTokens,
  setRepairMaxOutputTokens,
  anthropicThinking,
  setAnthropicThinking,
  modelEffort,
  setModelEffort,
  directions,
  ghostRoots,
  directionId,
  setDirectionId,
  setActiveTokensSourceOverride,
  setShowWelcome,
  layoutId,
  setLayoutId,
  fragmentMode,
  setFragmentMode,
  scriptPolicy,
  tokenPreset,
  setTokenPreset,
  mode,
  setMode,
  agentBrokerEnabled,
  setAgentBrokerEnabled,
  repairEnabled,
  setRepairEnabled,
  customContractEnabled,
  setCustomContractEnabled,
  selectedScenario,
  ghostTarget,
  setGhostTarget,
  ghostBaseDirectionId,
  setGhostBaseDirectionId,
  surfacePlan,
  setSurfacePlan,
}: {
  contractRows: Array<{ key: string; label: string; value: string; tone: string }>;
  currentSurfaceContractView: SurfaceContractView | null;
  currentEffectiveSurfacePlan: SurfacePlan | null;
  modelProviderId: string;
  setModelProviderId: (value: string) => void;
  modelProviders: ModelProviderInfo[];
  selectedProvider: ModelProviderInfo | null;
  providerModels: ModelCatalogEntry[];
  utilityModels: ModelCatalogEntry[];
  generationModel: string;
  setGenerationModel: (value: string) => void;
  customModel: string;
  setCustomModel: (value: string) => void;
  utilityModel: string;
  setUtilityModel: (value: string) => void;
  maxOutputTokens: number;
  setMaxOutputTokens: (value: number) => void;
  repairMaxOutputTokens: number;
  setRepairMaxOutputTokens: (value: number) => void;
  anthropicThinking: 'adaptive' | 'off';
  setAnthropicThinking: (value: 'adaptive' | 'off') => void;
  modelEffort: 'low' | 'medium' | 'high';
  setModelEffort: (value: 'low' | 'medium' | 'high') => void;
  directions: DirectionInfo[];
  ghostRoots: GhostRootInfo[];
  directionId: string | null;
  setDirectionId: (value: string | null) => void;
  setActiveTokensSourceOverride: (value: string | null) => void;
  setShowWelcome: (value: boolean) => void;
  layoutId: string;
  setLayoutId: (value: string) => void;
  fragmentMode: FragmentMode;
  setFragmentMode: (value: FragmentMode) => void;
  scriptPolicy: ScriptPolicy;
  tokenPreset: string;
  setTokenPreset: (value: string) => void;
  mode: Mode;
  setMode: (value: Mode) => void;
  agentBrokerEnabled: boolean;
  setAgentBrokerEnabled: (value: boolean) => void;
  repairEnabled: boolean;
  setRepairEnabled: (value: boolean) => void;
  customContractEnabled: boolean;
  setCustomContractEnabled: (value: boolean) => void;
  selectedScenario: ShowcaseScenario;
  ghostTarget: string;
  setGhostTarget: (value: string) => void;
  ghostBaseDirectionId: string | null;
  setGhostBaseDirectionId: (value: string | null) => void;
  surfacePlan: SurfacePlan;
  setSurfacePlan: Dispatch<SetStateAction<SurfacePlan>>;
}) {
  return (
    <aside className="contract-inspector" aria-label="Contract inspector">
      <div className="inspector-heading">
        <span>Surface Inspector</span>
        <span id="inspector-status">{currentSurfaceContractView ? 'contract' : currentEffectiveSurfacePlan ? 'effective' : 'pending'}</span>
      </div>
      <div className="contract-summary" id="contract-summary">
        {contractRows.map((row) => (
          <div key={row.key} className={`contract-row ${row.tone}`} data-contract-row={row.key} title={row.value}>
            <span className="contract-row-label">{row.label}</span>
            <strong className="contract-row-value">{row.value}</strong>
          </div>
        ))}
      </div>

      <section className="run-settings" aria-label="Run settings">
        <div className="settings-grid">
          <label>
            <span className="field-label">Provider</span>
            <select id="model-provider" className="pill-select" title="Model provider" value={modelProviderId} disabled={modelProviders.length === 0} onChange={(event) => {
              setModelProviderId(event.target.value);
              setGenerationModel('');
              setUtilityModel('');
            }}>
              {modelProviders.length === 0 ? <option value="">Server default</option> : null}
              {modelProviders.map((provider) => (
                <option key={provider.id} value={provider.id} disabled={!provider.configured} title={provider.configured ? `${provider.model} for generation; ${provider.utilityModel} for utility calls` : `Set ${provider.missingEnv ?? 'provider key'}`}>
                  {provider.configured ? provider.name : `${provider.name} (missing key)`}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="field-label">Model</span>
            <select id="generation-model" className="pill-select" title="Generation model" value={generationModel} disabled={!selectedProvider} onChange={(event) => setGenerationModel(event.target.value)}>
              {providerModels.map((model) => (
                <option key={model.id} value={model.id} title={model.description ?? model.id}>
                  {model.label} · {model.tier}{model.status === 'stable' ? '' : ` · ${model.status}`}
                </option>
              ))}
              {selectedProvider?.controls?.customModels !== false ? <option value="__custom__">Custom model...</option> : null}
            </select>
          </label>
          <label id="custom-model-field" hidden={generationModel !== '__custom__'}>
            <span className="field-label">Custom model</span>
            <input id="custom-model" className="ghost-target" type="text" placeholder="provider-model-id" title="Custom generation model id" value={customModel} onChange={(event) => setCustomModel(event.target.value)} />
          </label>
          <label>
            <span className="field-label">Utility</span>
            <select id="utility-model" className="pill-select" title="Utility model for shape and host demo calls" value={utilityModel} disabled={!selectedProvider} onChange={(event) => setUtilityModel(event.target.value)}>
              {utilityModels.map((model) => (
                <option key={model.id} value={model.id}>{model.label} · {model.tier}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="field-label">Max output</span>
            <select id="max-output-tokens" className="pill-select" title="Generation output token cap" value={maxOutputTokens} onChange={(event) => setMaxOutputTokens(Number(event.target.value))}>
              {numberOptions(selectedProvider?.controls?.maxOutputTokens.presets, maxOutputTokens).map((value) => <option key={value} value={value}>{value.toLocaleString()}</option>)}
            </select>
          </label>
          <label>
            <span className="field-label">Repair cap</span>
            <select id="repair-max-output-tokens" className="pill-select" title="Repair output token cap" value={repairMaxOutputTokens} onChange={(event) => setRepairMaxOutputTokens(Number(event.target.value))}>
              {numberOptions(selectedProvider?.controls?.repairMaxOutputTokens.presets, repairMaxOutputTokens).map((value) => <option key={value} value={value}>{value.toLocaleString()}</option>)}
            </select>
          </label>
          <label id="anthropic-thinking-field" hidden={selectedProvider?.id !== 'anthropic'}>
            <span className="field-label">Thinking</span>
            <select id="anthropic-thinking" className="pill-select" title="Anthropic thinking mode" value={anthropicThinking} onChange={(event) => setAnthropicThinking(event.target.value as 'adaptive' | 'off')}>
              {(selectedProvider?.controls?.anthropicThinking?.options ?? ['adaptive', 'off']).map((value) => <option key={value} value={value}>{value === 'adaptive' ? 'Adaptive' : 'Off'}</option>)}
            </select>
          </label>
          <label id="model-effort-field" hidden={selectedProvider?.id !== 'anthropic'}>
            <span className="field-label">Effort</span>
            <select id="model-effort" className="pill-select" title="Anthropic effort" value={modelEffort} onChange={(event) => setModelEffort(event.target.value as 'low' | 'medium' | 'high')}>
              {(selectedProvider?.controls?.effort?.options ?? ['low', 'medium', 'high']).map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          <label>
            <span className="field-label">Direction</span>
            <select id="direction" className="pill-select" title="Design direction" value={directionId ?? ''} onChange={(event) => {
              const next = event.target.value || null;
              setDirectionId(next);
              setActiveTokensSourceOverride(null);
              setShowWelcome(true);
            }}>
              {directions.length === 0 && ghostRoots.length === 0 ? <option value="">Default (no direction)</option> : null}
              {directions.map((direction) => <option key={direction.id} value={direction.id} title={direction.description}>{direction.name}</option>)}
              {ghostRoots.map((root) => <option key={root.id} value={ghostSelectionValue(root.id)}>Ghost · {root.id}</option>)}
            </select>
          </label>
          <label>
            <span className="field-label">Layout</span>
            <select id="layout" className="pill-select" title="Host layout" value={layoutId} onChange={(event) => setLayoutId(event.target.value)}>
              <option value="">Free layout</option>
              <option value="card-structured">Card: header/content/actions</option>
            </select>
          </label>
          <label>
            <span className="field-label">Fragment unit</span>
            <select id="fragment-unit" className="pill-select" title="Streaming fragment unit" value={fragmentMode} onChange={(event) => setFragmentMode(event.target.value as FragmentMode)}>
              <option value="section">Sections</option>
              <option value="block-v0">Blocks (experimental)</option>
              <option value="html-node-v0">HTML nodes (experimental)</option>
            </select>
          </label>
          <label>
            <span className="field-label">Scripts</span>
            <select id="script-policy" className="pill-select" title="Script policy" value={scriptPolicy} disabled>
              <option value="forbid">Scripts forbidden</option>
              <option value="allow">Scripts allowed</option>
            </select>
          </label>
          <label>
            <span className="field-label">Tokens</span>
            <select id="token-preset" className="pill-select" title="Token override preset" value={tokenPreset} disabled={Boolean(ghostRootFromSelection(directionId))} onChange={(event) => setTokenPreset(event.target.value)}>
              <option value="">Base tokens</option>
              <option value="accent-blue">Accent override</option>
            </select>
          </label>
        </div>

        <div className="settings-row">
          <div className="mode-group" title="Mode">
            <label><input type="radio" name="mode" value="static" checked={mode === 'static'} onChange={() => setMode('static')} /><span>Static</span></label>
            <label><input type="radio" name="mode" value="interactive" checked={mode === 'interactive'} onChange={() => setMode('interactive')} /><span>Interactive</span></label>
          </div>
          <label className="repair-toggle" title="Infer surface policy from the prompt within host ceilings">
            <input id="agent-broker-enabled" type="checkbox" checked={agentBrokerEnabled} disabled={customContractEnabled || scenarioUsesFixedPolicy(selectedScenario)} onChange={(event) => setAgentBrokerEnabled(event.target.checked)} />
            <span>Agent broker</span>
          </label>
          <label className="repair-toggle" title="Enable validation retry">
            <input id="repair-enabled" type="checkbox" checked={repairEnabled} onChange={(event) => setRepairEnabled(event.target.checked)} />
            <span>Validation retry</span>
          </label>
        </div>

        <div className="ghost-controls">
          <label>
            <span className="field-label">Ghost target</span>
            <input id="ghost-target" className="ghost-target" type="text" value={ghostTarget} disabled={!ghostRootFromSelection(directionId)} placeholder="Ghost target path" title="Ghost target path" onChange={(event) => setGhostTarget(event.target.value)} />
          </label>
          <label>
            <span className="field-label">Ghost base</span>
            <select id="ghost-base-direction" className="pill-select" title="Ghost base direction" value={ghostBaseDirectionId ?? ''} disabled={!ghostRootFromSelection(directionId) || directions.length === 0} onChange={(event) => setGhostBaseDirectionId(event.target.value || null)}>
              {directions.map((direction) => <option key={direction.id} value={direction.id}>{direction.name}</option>)}
            </select>
          </label>
        </div>
      </section>

      <section className="custom-contract">
        <label className="custom-contract-toggle">
          <input id="custom-contract-enabled" type="checkbox" checked={customContractEnabled} onChange={(event) => {
            const enabled = event.target.checked;
            setCustomContractEnabled(enabled);
            if (!enabled) setSurfacePlan(selectedScenario.surfacePlan);
          }} />
          <span>Custom Surface Config</span>
        </label>
        <div id="custom-contract-panel" className="custom-contract-panel" hidden={!customContractEnabled}>
          <div className="surface-controls" aria-label="Surface config controls">
            <select id="surface-purpose" className="pill-select" title="Surface purpose" value={surfacePlan.purpose} onChange={(event) => setSurfacePlan((plan) => ({ ...plan, purpose: event.target.value as SurfacePlan['purpose'] }))}>
              {SURFACE_PURPOSE_VALUES.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
            <select id="surface-runtime" className="pill-select" title="Surface runtime" value={surfacePlan.runtime} onChange={(event) => setSurfacePlan((plan) => ({ ...plan, runtime: event.target.value as SurfacePlan['runtime'] }))}>
              {SURFACE_RUNTIME_VALUES.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
            <select id="surface-data" className="pill-select" title="Surface data" value={surfacePlan.data} onChange={(event) => setSurfacePlan((plan) => ({ ...plan, data: event.target.value as SurfacePlan['data'] }))}>
              {SURFACE_DATA_VALUES.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
            <select id="surface-authority" className="pill-select" title="Surface authority" value={surfacePlan.authority} onChange={(event) => setSurfacePlan((plan) => ({ ...plan, authority: event.target.value as SurfacePlan['authority'] }))}>
              {SURFACE_AUTHORITY_VALUES.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
            <select id="surface-persistence" className="pill-select" title="Surface persistence" value={surfacePlan.persistence} onChange={(event) => setSurfacePlan((plan) => ({ ...plan, persistence: event.target.value as SurfacePlan['persistence'] }))}>
              {SURFACE_PERSISTENCE_VALUES.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </div>
        </div>
      </section>
    </aside>
  );
}
