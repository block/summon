import type { Dispatch, RefObject, SetStateAction } from 'react';
import {
  SummonSurface,
  type SummonSurfaceHandle,
  type SummonSurfaceProps,
} from '@anarchitecture/summon-react';
import type { SurfacePlan } from '@anarchitecture/summon/engine';
import { Pane } from '../../../components/chrome.js';
import { Button, fieldLabelClass, inputClass, panelClass, textareaClass } from '../../../components/ui.js';
import { cn } from '../../../lib/cn.js';
import type { ShowcaseScenario } from '../../../showcase.js';
import { compactPlanText } from '../surfaceHelpers.js';
import type { ChildSurfaceModel } from '../types.js';
import { ChildSurface } from './ChildSurface.js';

export function GenerationStage({
  selectedScenario,
  scenarioPresentation,
  prompt,
  setPrompt,
  running,
  onGenerate,
  hasArtifact,
  status,
  currentEffectiveSurfacePlan,
  surfacePlan,
  setDiagnosticsTab,
  editTargets,
  setEditTargets,
  editPrompt,
  setEditPrompt,
  onEditArtifact,
  statusText,
  surfaceRef,
  surfaceTokensSource,
  capabilityRegistry,
  componentRegistry,
  grantedCapabilities,
  grantedComponents,
  appendDevEvent,
  onSurfaceIntentRejected,
  onSurfaceHandlerError,
  onSurfaceComponentError,
  showWelcome,
  childSurfaces,
  onCloseChild,
}: {
  selectedScenario: ShowcaseScenario;
  scenarioPresentation: { category: string; description: string };
  prompt: string;
  setPrompt: (value: string) => void;
  running: boolean;
  onGenerate: (prompt: string) => void | Promise<void>;
  hasArtifact: boolean;
  status: string;
  currentEffectiveSurfacePlan: SurfacePlan | null;
  surfacePlan: SurfacePlan;
  setDiagnosticsTab: Dispatch<SetStateAction<'stream' | 'devtools' | 'history' | 'safety'>>;
  editTargets: string;
  setEditTargets: (value: string) => void;
  editPrompt: string;
  setEditPrompt: (value: string) => void;
  onEditArtifact: () => void | Promise<void>;
  statusText: string;
  surfaceRef: RefObject<SummonSurfaceHandle>;
  surfaceTokensSource: string;
  capabilityRegistry: SummonSurfaceProps['capabilityRegistry'];
  componentRegistry: SummonSurfaceProps['componentRegistry'];
  grantedCapabilities: SummonSurfaceProps['grantedCapabilities'];
  grantedComponents: SummonSurfaceProps['artifactComponents'];
  appendDevEvent: SummonSurfaceProps['onEvent'];
  onSurfaceIntentRejected: SummonSurfaceProps['onIntentRejected'];
  onSurfaceHandlerError: SummonSurfaceProps['onHandlerError'];
  onSurfaceComponentError: SummonSurfaceProps['onComponentError'];
  showWelcome: boolean;
  childSurfaces: ChildSurfaceModel[];
  onCloseChild: (id: number) => void;
}) {
  return (
    <main className="grid min-w-0 gap-[22px] max-[820px]:order-first">
      <section className="grid grid-cols-1 gap-[18px] border-b border-line pb-[clamp(28px,4vw,52px)]" aria-label="Selected scenario">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-normal text-ink-muted" id="scenario-active-category">{scenarioPresentation.category}</div>
          <h2 id="scenario-active-title" className="m-0 mt-1.5 max-w-[980px] text-[clamp(72px,8.2vw,128px)] font-bold leading-[0.88] tracking-normal text-ink max-[820px]:text-[clamp(56px,16vw,72px)] max-[820px]:leading-[0.9]">{selectedScenario.label}</h2>
          <p id="scenario-active-desc" className="m-0 mt-1 max-w-[54ch] text-base text-ink-soft max-[820px]:text-[15px]">{scenarioPresentation.description}</p>
        </div>
        <div className="grid min-w-0 justify-items-start gap-1 font-mono text-[11px] text-ink-muted">
          <span id="scenario-active-fingerprint">{compactPlanText(selectedScenario.surfacePlan)}</span>
          <strong id="scenario-active-grants" className="font-mono text-xs font-semibold text-ink">
            {selectedScenario.capabilityNames.length} host tools{selectedScenario.componentNames?.length ? ` · ${selectedScenario.componentNames.length} trusted components` : ''}
          </strong>
        </div>
      </section>

      <form id="form" className="grid gap-2" onSubmit={(event) => {
        event.preventDefault();
        const value = prompt.trim();
        if (value) void onGenerate(value);
      }}>
        <label className={fieldLabelClass} htmlFor="prompt">Prompt</label>
        <div className="relative">
          <textarea
            id="prompt"
            className={cn(textareaClass, 'block min-h-[136px] w-full rounded-card px-[18px] py-5 pr-[126px] max-[820px]:pb-[74px] max-[820px]:pr-[18px]')}
            placeholder="describe a UI or choose a showcase scenario..."
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
          />
          <Button id="go" type="submit" className="absolute bottom-3.5 right-3.5 h-12 min-w-[90px] rounded-card" disabled={running || !prompt.trim()}>Run</Button>
        </div>
      </form>

      <div className={cn(panelClass, 'flex items-center justify-between gap-3 px-3 py-2.5')} id="result-toolbar" hidden={!hasArtifact}>
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-normal text-ink-muted">Surface</span>
          <strong id="result-summary" className="mt-0.5 block font-mono text-[11px] font-medium text-ink">{hasArtifact ? `${status} · ${compactPlanText(currentEffectiveSurfacePlan ?? surfacePlan)}` : 'Awaiting run'}</strong>
        </div>
        <div className="flex gap-1.5">
          <Button id="rerun" type="button" variant="ghost" size="xs" disabled={running || !prompt.trim()} onClick={() => void onGenerate(prompt.trim())}>Re-run</Button>
          <Button id="open-history" type="button" variant="ghost" size="xs" onClick={() => setDiagnosticsTab('history')}>History</Button>
        </div>
      </div>

      <div className={cn(panelClass, 'grid grid-cols-[minmax(140px,220px)_1fr_auto] gap-2 p-2.5 max-[820px]:grid-cols-1')} id="edit-card" hidden={!hasArtifact}>
        <input id="edit-targets" className={cn(inputClass, 'h-[38px] rounded-card px-3 py-2 text-[13px]')} type="text" placeholder="section ids, e.g. hero, details" value={editTargets} onChange={(event) => setEditTargets(event.target.value)} />
        <textarea id="edit-prompt" className={cn(textareaClass, 'h-[38px] min-h-[38px] rounded-card px-3 py-2 text-[13px]')} placeholder="describe the edit..." value={editPrompt} onChange={(event) => setEditPrompt(event.target.value)} />
        <Button id="edit-go" type="button" variant="ghost" size="sm" disabled={running || !hasArtifact || !editPrompt.trim()} onClick={() => void onEditArtifact()}>Patch</Button>
      </div>

      <Pane title="Sandbox" status={<span id="iframe-status">{statusText}</span>} className="overflow-hidden">
        <div className="relative">
          <SummonSurface
            ref={surfaceRef}
            id="sandbox"
            className="h-[min(66vh,700px)] min-h-[500px] max-[820px]:min-h-[420px]"
            title="Summon generate sandbox"
            html=""
            tokensSource={surfaceTokensSource}
            capabilityRegistry={capabilityRegistry}
            componentRegistry={componentRegistry}
            grantedCapabilities={grantedCapabilities}
            artifactComponents={grantedComponents}
            onEvent={appendDevEvent}
            onIntentRejected={onSurfaceIntentRejected}
            onHandlerError={onSurfaceHandlerError}
            onComponentError={onSurfaceComponentError}
          />
          {showWelcome ? (
            <div className="pointer-events-none absolute inset-0 z-[1] flex items-center justify-center bg-surface transition-opacity duration-300" id="welcome">
              <div className="max-w-[min(420px,calc(100%-48px))] text-center text-[13px] leading-normal tracking-normal text-ink-muted" id="welcome-text">{selectedScenario.label} awaits generated UI.</div>
            </div>
          ) : null}
        </div>
      </Pane>

      <div id="children" className="flex flex-col gap-2.5" aria-label="Summoned sibling sandboxes">
        {childSurfaces.map((child) => (
          <ChildSurface
            key={child.id}
            child={child}
            onClose={() => onCloseChild(child.id)}
          />
        ))}
      </div>
    </main>
  );
}
