import type { Dispatch, RefObject, SetStateAction } from 'react';
import {
  SummonSurface,
  type SummonSurfaceHandle,
  type SummonSurfaceProps,
} from '@anarchitecture/summon-react';
import type { SurfacePlan } from '@anarchitecture/summon/engine';
import { Pane } from '../../../components/chrome.js';
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
    <main className="generation-stage">
      <section className="stage-context" aria-label="Selected scenario">
        <div>
          <div className="stage-eyebrow" id="scenario-active-category">{scenarioPresentation.category}</div>
          <h2 id="scenario-active-title">{selectedScenario.label}</h2>
          <p id="scenario-active-desc">{scenarioPresentation.description}</p>
        </div>
        <div className="stage-fingerprint">
          <span id="scenario-active-fingerprint">{compactPlanText(selectedScenario.surfacePlan)}</span>
          <strong id="scenario-active-grants">
            {selectedScenario.capabilityNames.length} host tools{selectedScenario.componentNames?.length ? ` · ${selectedScenario.componentNames.length} trusted components` : ''}
          </strong>
        </div>
      </section>

      <form id="form" className="prompt-card" onSubmit={(event) => {
        event.preventDefault();
        const value = prompt.trim();
        if (value) void onGenerate(value);
      }}>
        <label className="field-label" htmlFor="prompt">Prompt</label>
        <div className="prompt-input">
          <textarea
            id="prompt"
            placeholder="describe a UI or choose a showcase scenario..."
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
          />
          <button id="go" type="submit" className="prompt-submit" disabled={running || !prompt.trim()}>Run</button>
        </div>
      </form>

      <div className="result-toolbar" id="result-toolbar" hidden={!hasArtifact}>
        <div>
          <span className="toolbar-label">Surface</span>
          <strong id="result-summary">{hasArtifact ? `${status} · ${compactPlanText(currentEffectiveSurfacePlan ?? surfacePlan)}` : 'Awaiting run'}</strong>
        </div>
        <div className="toolbar-actions">
          <button id="rerun" type="button" disabled={running || !prompt.trim()} onClick={() => void onGenerate(prompt.trim())}>Re-run</button>
          <button id="open-history" type="button" onClick={() => setDiagnosticsTab('history')}>History</button>
        </div>
      </div>

      <div className="edit-card" id="edit-card" hidden={!hasArtifact}>
        <input id="edit-targets" type="text" placeholder="section ids, e.g. hero, details" value={editTargets} onChange={(event) => setEditTargets(event.target.value)} />
        <textarea id="edit-prompt" placeholder="describe the edit..." value={editPrompt} onChange={(event) => setEditPrompt(event.target.value)} />
        <button id="edit-go" type="button" className="edit-submit" disabled={running || !hasArtifact || !editPrompt.trim()} onClick={() => void onEditArtifact()}>Patch</button>
      </div>

      <Pane title="Sandbox" status={<span id="iframe-status">{statusText}</span>} className="pane-result sandbox-stage">
        <div className="iframe-wrap">
          <SummonSurface
            ref={surfaceRef}
            id="sandbox"
            className="h-640"
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
            <div className="iframe-welcome" id="welcome">
              <div className="welcome-text" id="welcome-text">{selectedScenario.label} awaits generated UI.</div>
            </div>
          ) : null}
        </div>
      </Pane>

      <div id="children" className="children-stack" aria-label="Summoned sibling sandboxes">
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
