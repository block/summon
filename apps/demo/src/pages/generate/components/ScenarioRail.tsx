import type { ShowcaseScenario } from '../../../showcase.js';
import { cn } from '../../../lib/cn.js';
import { compactSelectClass, fieldLabelClass } from '../../../components/ui.js';
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
    <aside className="sticky top-12 min-w-0 max-[820px]:static" aria-label="Scenario library">
      <div className="mb-[18px] flex items-center justify-between gap-2.5 border-b border-line pb-3 font-mono text-[10px] font-semibold uppercase tracking-normal text-ink-muted">
        <span>Scenario Library</span>
        <span id="scenario-count" className="text-[11px] normal-case text-ink-muted">{showcaseScenarios.length}</span>
      </div>
      <label className={fieldLabelClass} htmlFor="scenario">Preset</label>
      <select
        id="scenario"
        className={cn(compactSelectClass, 'mb-[22px] w-full rounded-card')}
        title="Showcase scenario"
        value={selectedScenario.id}
        onChange={(event) => onApplyScenario(event.target.value)}
      >
        {showcaseScenarios.map((scenario) => (
          <option key={scenario.id} value={scenario.id}>{scenario.label}</option>
        ))}
      </select>
      <div id="scenario-list" className="grid max-h-[calc(100vh-250px)] gap-[22px] overflow-auto pr-0.5 max-[820px]:max-h-none">
        {groupedScenarios.map((group) => (
          <section key={group.category} className="grid gap-2">
            <h3 className="m-0 text-[11px] font-semibold uppercase tracking-normal text-ink-muted">{group.category}</h3>
            {group.scenarios.map((scenario) => {
              const presentation = describeScenario(scenario);
              const active = scenario.id === selectedScenario.id;
              const componentCount = scenario.componentNames?.length ?? 0;
              return (
                <button
                  key={scenario.id}
                  type="button"
                  className={cn(
                    'grid w-full cursor-pointer gap-1.5 rounded-card border border-transparent bg-transparent px-2.5 py-3 text-left [font:inherit] text-ink transition-colors duration-150 hover:border-line',
                    active && 'border-line-strong bg-surface',
                  )}
                  data-scenario-id={scenario.id}
                  aria-pressed={active ? 'true' : 'false'}
                  onClick={() => onApplyScenario(scenario.id)}
                >
                  <span className="text-[15px] font-semibold text-ink">{scenario.label}</span>
                  <span className="text-[13px] leading-[1.35] text-ink-soft">{presentation.description}</span>
                  <span className="font-mono text-[10px] leading-[1.4] text-ink-muted">
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
