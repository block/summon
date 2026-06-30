import type { Dispatch, SetStateAction } from 'react';
import {
  SURFACE_AUTHORITY_VALUES,
  SURFACE_DATA_VALUES,
  SURFACE_NETWORK_VALUES,
  SURFACE_PERSISTENCE_VALUES,
  SURFACE_PURPOSE_VALUES,
  type SurfaceContractView,
  type SurfacePlan,
} from '@anarchitecture/summon/engine';
import type { Mode, ShowcaseScenario } from '../../../showcase.js';
import {
  numberOptions,
  scenarioUsesFixedPolicy,
} from '../surfaceHelpers.js';
import type {
  GhostRootInfo,
  ModelCatalogEntry,
  ModelProfileKey,
  ModelProviderInfo,
  RunProfile,
} from '../types.js';

const RUNTIME_PROFILE_LABEL: Record<ModelProfileKey, string> = {
  'arrow-control': 'Arrow control',
  'html-static': 'HTML static',
  'html-stream': 'HTML stream',
  'domjs-control': 'domjs control',
  utility: 'Utility',
};
import { ModeGroup } from '../../../components/chrome.js';
import { cn } from '../../../lib/cn.js';
import { DropdownSelect, compactInputClass, compactSelectClass, fieldLabelClass } from '../../../components/ui.js';
import { fingerprintOptionFor } from '../fingerprintDisplay.js';

export function ContractInspector({
  playgroundMode,
  setPlaygroundMode,
  contractRows,
  currentSurfaceContractView,
  currentEffectiveSurfacePlan,
  runProfile,
  onRunProfileChange,
  modelProfileKey,
  structuredProfile,
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
  anthropicThinking,
  setAnthropicThinking,
  modelEffort,
  setModelEffort,
  ghostRoots,
  fingerprintId,
  setFingerprintId,
  setActiveTokensSourceOverride,
  setShowWelcome,
  layoutId,
  setLayoutId,
  mode,
  setMode,
  agentWardEnabled,
  setAgentWardEnabled,
  customContractEnabled,
  setCustomContractEnabled,
  selectedScenario,
  fingerprintTargetPath,
  setFingerprintTargetPath,
  surfacePlan,
  setSurfacePlan,
}: {
  playgroundMode: boolean;
  setPlaygroundMode: (value: boolean) => void;
  contractRows: Array<{ key: string; label: string; value: string; tone: string }>;
  currentSurfaceContractView: SurfaceContractView | null;
  currentEffectiveSurfacePlan: SurfacePlan | null;
  runProfile: RunProfile;
  onRunProfileChange: (value: RunProfile) => void;
  modelProfileKey: ModelProfileKey;
  structuredProfile: boolean;
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
  anthropicThinking: 'adaptive' | 'off';
  setAnthropicThinking: (value: 'adaptive' | 'off') => void;
  modelEffort: 'low' | 'medium' | 'high' | 'max';
  setModelEffort: (value: 'low' | 'medium' | 'high' | 'max') => void;
  ghostRoots: GhostRootInfo[];
  fingerprintId: string | null;
  setFingerprintId: (value: string | null) => void;
  setActiveTokensSourceOverride: (value: string | null) => void;
  setShowWelcome: (value: boolean) => void;
  layoutId: string;
  setLayoutId: (value: string) => void;
  mode: Mode;
  setMode: (value: Mode) => void;
  agentWardEnabled: boolean;
  setAgentWardEnabled: (value: boolean) => void;
  customContractEnabled: boolean;
  setCustomContractEnabled: (value: boolean) => void;
  selectedScenario: ShowcaseScenario;
  fingerprintTargetPath: string;
  setFingerprintTargetPath: (value: string) => void;
  surfacePlan: SurfacePlan;
  setSurfacePlan: Dispatch<SetStateAction<SurfacePlan>>;
}) {
  const selectClassName = cn(compactSelectClass, 'w-full rounded-card');
  const inputClassName = cn(compactInputClass, 'w-full rounded-card');
  const toggleClassName = 'flex min-h-[34px] cursor-pointer items-center gap-2 rounded-card border border-line px-2.5 text-xs font-semibold text-ink-soft [&_input]:size-[13px] [&_input]:accent-ink';
  const selectedFingerprint = fingerprintId
    ? ghostRoots.find((fingerprint) => fingerprint.id === fingerprintId)
    : null;
  const fingerprintOptions = ghostRoots.map(fingerprintOptionFor);
  if (fingerprintId && !selectedFingerprint) {
    fingerprintOptions.unshift({
      value: fingerprintId,
      label: fingerprintId,
      meta: 'Missing from catalog',
      title: 'Selected fingerprint is not in the current catalog.',
    });
  }

  return (
    <aside className="sticky top-12 min-w-0 max-[1180px]:static max-[1180px]:col-span-full max-[820px]:order-1" aria-label="Contract inspector">
      <div className="mb-[18px] flex items-center justify-between gap-2.5 border-b border-line pb-3 font-mono text-[10px] font-semibold uppercase tracking-normal text-ink-muted">
        <span>{playgroundMode ? 'Diagnostic Options' : 'Surface Inspector'}</span>
        <span id="inspector-status" className="text-[11px] normal-case text-ink-muted">{playgroundMode ? 'simple' : currentSurfaceContractView ? 'contract' : currentEffectiveSurfacePlan ? 'effective' : 'pending'}</span>
      </div>
      {!playgroundMode ? (
        <div className="mb-3.5 grid gap-0" id="contract-summary">
          {contractRows.map((row) => (
            <div
              key={row.key}
              className={cn(
                'grid min-h-[42px] grid-cols-[94px_minmax(0,1fr)] items-start gap-2.5 border-b border-line py-3 last:border-b-0',
                row.tone === 'good' && 'border-good/30 bg-good/10 px-2 text-good',
                row.tone === 'warn' && 'border-danger/30 bg-danger/10 px-2 text-danger',
                row.tone === 'pending' && 'text-ink-muted',
              )}
              data-contract-row={row.key}
              title={row.value}
            >
              <span className="text-[11px] font-semibold text-ink-muted">{row.label}</span>
              <strong className="min-w-0 font-mono text-[11px] font-medium text-ink [overflow-wrap:anywhere]">{row.value}</strong>
            </div>
          ))}
        </div>
      ) : null}

      <section className={cn('grid gap-3', !playgroundMode && 'border-t border-line pt-5')} aria-label="Run settings">
        <div className="rounded-card border border-good/30 bg-good/10 p-3 text-xs text-ink-soft" hidden={!playgroundMode}>
          <div className="font-mono text-[10px] font-semibold uppercase tracking-normal text-good">Diagnostic mode</div>
          <p className="mt-1 leading-snug">Best-effort Ghost-steered rendering. Ward, shape inference, repair loops, and validation gates are off; diagnostics still stream.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className={toggleClassName} title="Render best-effort Arrow surfaces with validation as diagnostics only">
            <input id="playground-mode" type="checkbox" checked={playgroundMode} onChange={(event) => setPlaygroundMode(event.target.checked)} />
            <span>Diagnostic mode</span>
          </label>
          <ModeGroup title="Run profile">
            <label>
              <input id="run-profile-fast" type="radio" name="run-profile" value="fast" checked={runProfile === 'fast'} onChange={() => onRunProfileChange('fast')} />
              <span>Fast</span>
            </label>
            <label>
              <input id="run-profile-quality" type="radio" name="run-profile" value="quality" checked={runProfile === 'quality'} onChange={() => onRunProfileChange('quality')} />
              <span>Quality</span>
            </label>
            <label>
              <input id="run-profile-custom" type="radio" name="run-profile" value="custom" checked={runProfile === 'custom'} onChange={() => onRunProfileChange('custom')} />
              <span>Custom</span>
            </label>
          </ModeGroup>
        </div>
        <div className="grid grid-cols-2 gap-3 max-[820px]:grid-cols-1">
          <label className="min-w-0">
            <span className={fieldLabelClass}>Provider</span>
            <select id="model-provider" className={selectClassName} title="Model provider" value={modelProviderId} disabled={modelProviders.length === 0} onChange={(event) => {
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
          <label className="min-w-0">
            <span className={fieldLabelClass}>{RUNTIME_PROFILE_LABEL[modelProfileKey]} model</span>
            <select id="generation-model" className={selectClassName} title={`Generation model for the ${RUNTIME_PROFILE_LABEL[modelProfileKey]} runtime`} value={generationModel} disabled={!selectedProvider} onChange={(event) => setGenerationModel(event.target.value)}>
              {providerModels.map((model) => (
                <option key={model.id} value={model.id} title={model.description ?? model.id}>
                  {model.label} · {model.tier}{model.status === 'stable' ? '' : ` · ${model.status}`}
                </option>
              ))}
              {selectedProvider?.controls?.customModels !== false ? <option value="__custom__">Custom model...</option> : null}
            </select>
          </label>
          <label id="custom-model-field" className="min-w-0" hidden={generationModel !== '__custom__'}>
            <span className={fieldLabelClass}>Custom model</span>
            <input id="custom-model" className={inputClassName} type="text" placeholder="provider-model-id" title="Custom generation model id" value={customModel} onChange={(event) => setCustomModel(event.target.value)} />
          </label>
          <label className="min-w-0" hidden={playgroundMode}>
            <span className={fieldLabelClass}>Utility model</span>
            <select id="utility-model" className={selectClassName} title="Utility model used for ward, policy, and host helper calls" value={utilityModel} disabled={!selectedProvider} onChange={(event) => setUtilityModel(event.target.value)}>
              {utilityModels.map((model) => (
                <option key={model.id} value={model.id}>{model.label} · {model.tier}</option>
              ))}
            </select>
          </label>
          <label className="min-w-0" hidden={playgroundMode && runProfile !== 'custom'}>
            <span className={fieldLabelClass}>Max output</span>
            <select id="max-output-tokens" className={selectClassName} title="Generation output token cap" value={maxOutputTokens} onChange={(event) => setMaxOutputTokens(Number(event.target.value))}>
              {numberOptions(selectedProvider?.controls?.maxOutputTokens.presets, maxOutputTokens).map((value) => <option key={value} value={value}>{value.toLocaleString()}</option>)}
            </select>
          </label>
          <label id="anthropic-thinking-field" className="min-w-0" hidden={selectedProvider?.id !== 'anthropic' || (playgroundMode && runProfile !== 'custom')}>
            <span className={fieldLabelClass}>Thinking</span>
            <select
              id="anthropic-thinking"
              className={selectClassName}
              title={structuredProfile
                ? 'Thinking is forced off because this runtime uses structured tool output'
                : 'Anthropic thinking mode'}
              value={structuredProfile ? 'off' : anthropicThinking}
              disabled={structuredProfile}
              onChange={(event) => setAnthropicThinking(event.target.value as 'adaptive' | 'off')}
            >
              {(selectedProvider?.controls?.anthropicThinking?.options ?? ['adaptive', 'off']).map((value) => <option key={value} value={value}>{value === 'adaptive' ? 'Adaptive' : 'Off'}</option>)}
            </select>
            {structuredProfile ? (
              <span className="mt-1 block text-[10px] leading-snug text-ink-muted">Forced off for structured tool output.</span>
            ) : null}
          </label>
          <label id="model-effort-field" className="min-w-0" hidden={selectedProvider?.id !== 'anthropic' || (playgroundMode && runProfile !== 'custom')}>
            <span className={fieldLabelClass}>Effort</span>
            <select id="model-effort" className={selectClassName} title="Anthropic effort" value={modelEffort} onChange={(event) => setModelEffort(event.target.value as 'low' | 'medium' | 'high' | 'max')}>
              {(selectedProvider?.controls?.effort?.options ?? ['low', 'medium', 'high', 'max']).map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          <div className="min-w-0">
            <span className={fieldLabelClass}>Fingerprint</span>
            <DropdownSelect
              id="fingerprint"
              value={fingerprintId ?? ''}
              groups={[{ options: fingerprintOptions }]}
              placeholder={ghostRoots.length === 0 ? 'No catalog fingerprints' : 'Fingerprint'}
              title={selectedFingerprint?.summary ?? 'Ghost fingerprint'}
              ariaLabel="Ghost fingerprint"
              disabled={ghostRoots.length === 0}
              className="w-full"
              triggerClassName="min-h-[58px] rounded-card py-2"
              contentClassName="w-[min(360px,calc(100vw-32px))]"
              onValueChange={(nextValue) => {
                const next = nextValue || null;
                setFingerprintId(next);
                setActiveTokensSourceOverride(null);
                const nextFingerprint = next
                  ? ghostRoots.find((fingerprint) => fingerprint.id === next)
                  : null;
                if (nextFingerprint) {
                  setFingerprintTargetPath(nextFingerprint.defaultTargetPath || '.');
                }
                setShowWelcome(true);
              }}
            />
          </div>
          <label className="min-w-0" hidden={playgroundMode}>
            <span className={fieldLabelClass}>Layout</span>
            <select id="layout" className={selectClassName} title="Host layout" value={layoutId} onChange={(event) => setLayoutId(event.target.value)}>
              <option value="">Free layout</option>
              <option value="card-structured">Card: header/content/actions</option>
            </select>
          </label>
          <label className="min-w-0" hidden={playgroundMode}>
            <span className={fieldLabelClass}>Network</span>
            <select id="network-policy" className={selectClassName} title="Host-owned network policy" value={surfacePlan.network ?? 'none'} disabled>
              <option value="none">No network</option>
            </select>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2" hidden={playgroundMode}>
          <ModeGroup title="Mode">
            <label><input type="radio" name="mode" value="static" checked={mode === 'static'} onChange={() => setMode('static')} /><span>Static</span></label>
            <label><input type="radio" name="mode" value="interactive" checked={mode === 'interactive'} onChange={() => setMode('interactive')} /><span>Interactive</span></label>
          </ModeGroup>
          <label className={toggleClassName} title="Infer surface policy from the prompt within host ceilings">
            <input id="agent-ward-enabled" type="checkbox" checked={agentWardEnabled} disabled={playgroundMode || customContractEnabled || scenarioUsesFixedPolicy(selectedScenario)} onChange={(event) => setAgentWardEnabled(event.target.checked)} />
            <span>Agent ward</span>
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3 max-[820px]:grid-cols-1">
          <label className="min-w-0">
            <span className={fieldLabelClass}>Fingerprint target</span>
            <input id="fingerprint-target" className={inputClassName} type="text" value={fingerprintTargetPath} disabled={!fingerprintId} placeholder="Target path" title="Fingerprint target path" onChange={(event) => setFingerprintTargetPath(event.target.value)} />
          </label>
        </div>
      </section>

      <section className="mt-3.5 border-t border-line pt-3.5" hidden={playgroundMode}>
        <label className={toggleClassName}>
          <input id="custom-contract-enabled" type="checkbox" checked={customContractEnabled} onChange={(event) => {
            const enabled = event.target.checked;
            setCustomContractEnabled(enabled);
            if (!enabled) setSurfacePlan(selectedScenario.surfacePlan);
          }} />
          <span>Custom Surface Config</span>
        </label>
        <div id="custom-contract-panel" className="mt-2.5" hidden={!customContractEnabled || playgroundMode}>
          <div className="grid grid-cols-1 gap-2" aria-label="Surface config controls">
            <select id="surface-purpose" className={selectClassName} title="Surface purpose" value={surfacePlan.purpose} onChange={(event) => setSurfacePlan((plan) => ({ ...plan, purpose: event.target.value as SurfacePlan['purpose'] }))}>
              {SURFACE_PURPOSE_VALUES.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
            <select id="surface-data" className={selectClassName} title="Surface data" value={surfacePlan.data} onChange={(event) => setSurfacePlan((plan) => ({ ...plan, data: event.target.value as SurfacePlan['data'] }))}>
              {SURFACE_DATA_VALUES.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
            <select id="surface-authority" className={selectClassName} title="Surface authority" value={surfacePlan.authority} onChange={(event) => setSurfacePlan((plan) => ({ ...plan, authority: event.target.value as SurfacePlan['authority'] }))}>
              {SURFACE_AUTHORITY_VALUES.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
            <select id="surface-persistence" className={selectClassName} title="Surface persistence" value={surfacePlan.persistence} onChange={(event) => setSurfacePlan((plan) => ({ ...plan, persistence: event.target.value as SurfacePlan['persistence'] }))}>
              {SURFACE_PERSISTENCE_VALUES.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
            <select id="surface-network" className={selectClassName} title="Surface network policy" value={surfacePlan.network ?? 'none'} onChange={(event) => setSurfacePlan((plan) => ({ ...plan, network: event.target.value as SurfacePlan['network'] }))}>
              {SURFACE_NETWORK_VALUES.filter((value) => value === 'none').map((value) => <option key={value} value={value}>No network</option>)}
            </select>
          </div>
        </div>
      </section>
    </aside>
  );
}
