import type { ShowcaseScenario } from '../../../showcase.js';
import { compactPlanText, describeScenario } from '../surfaceHelpers.js';

export function ScenarioRail({
  groupedScenarios,
  selectedScenario,
  showcaseScenarios,
  onApplyScenario,
}: {
  groupedScenarios: Array<{ category: string; scenarios: ShowcaseScenario[] }>;
  selectedScenario: ShowcaseScenario;
  showcaseScenarios: ShowcaseScenario[];
  onApplyScenario: (id: string) => void;
}) {
  return (
    <aside className="scenario-rail" aria-label="Scenario library">
      <div className="rail-heading">
        <span>Scenario Library</span>
        <span id="scenario-count">{showcaseScenarios.length}</span>
      </div>
      <label className="field-label" htmlFor="scenario">Preset</label>
      <select
        id="scenario"
        className="pill-select scenario-select"
        title="Showcase scenario"
        value={selectedScenario.id}
        onChange={(event) => onApplyScenario(event.target.value)}
      >
        {showcaseScenarios.map((scenario) => (
          <option key={scenario.id} value={scenario.id}>{scenario.label}</option>
        ))}
      </select>
      <div id="scenario-list" className="scenario-list">
        {groupedScenarios.map((group) => (
          <section key={group.category} className="scenario-group">
            <h3>{group.category}</h3>
            {group.scenarios.map((scenario) => {
              const presentation = describeScenario(scenario);
              const active = scenario.id === selectedScenario.id;
              const componentCount = scenario.componentNames?.length ?? 0;
              return (
                <button
                  key={scenario.id}
                  type="button"
                  className={active ? 'scenario-card active' : 'scenario-card'}
                  data-scenario-id={scenario.id}
                  aria-pressed={active ? 'true' : 'false'}
                  onClick={() => onApplyScenario(scenario.id)}
                >
                  <span className="scenario-card-title">{scenario.label}</span>
                  <span className="scenario-card-desc">{presentation.description}</span>
                  <span className="scenario-card-meta">
                    {compactPlanText(scenario.surfacePlan)} · {scenario.capabilityNames.length} host tools{componentCount ? ` · ${componentCount} components` : ''}
                  </span>
                </button>
              );
            })}
          </section>
        ))}
      </div>
    </aside>
  );
}
