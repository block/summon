import { AppNav, LogView, PageHeader, Pane, SandboxFrame } from './chrome.js';

export function GeneratePageShell() {
  return (
    <>
      <AppNav active="generate" />
      <PageHeader
        title="Generate"
        lede="Scenario-led generative UI workbench"
        className="generate-header"
      />

      <div className="generate-shell">
        <aside className="scenario-rail" aria-label="Scenario library">
          <div className="rail-heading">
            <span>Scenario Library</span>
            <span id="scenario-count">0</span>
          </div>
          <label className="field-label" htmlFor="scenario">Preset</label>
          <select id="scenario" className="pill-select scenario-select" title="Showcase scenario" />
          <div id="scenario-list" className="scenario-list" />
        </aside>

        <main className="generation-stage">
          <section className="stage-context" aria-label="Selected scenario">
            <div>
              <div className="stage-eyebrow" id="scenario-active-category">Showcase</div>
              <h2 id="scenario-active-title">Host Data Search</h2>
              <p id="scenario-active-desc">Host-owned data with explicit read authority.</p>
            </div>
            <div className="stage-fingerprint">
              <span id="scenario-active-fingerprint">pending</span>
              <strong id="scenario-active-grants">0 host tools</strong>
            </div>
          </section>

          <form id="form" className="prompt-card">
            <label className="field-label" htmlFor="prompt">Prompt</label>
            <div className="prompt-input">
              <textarea
                id="prompt"
                placeholder="describe a UI or choose a showcase scenario..."
                defaultValue="help me build a weeknight dinner finder where i can search for recipes and see loading, error, and real host data states clearly"
              />
              <button id="go" type="submit" className="prompt-submit">Run</button>
            </div>
          </form>

          <div className="result-toolbar" id="result-toolbar" hidden>
            <div>
              <span className="toolbar-label">Surface</span>
              <strong id="result-summary">Awaiting run</strong>
            </div>
            <div className="toolbar-actions">
              <button id="rerun" type="button">Re-run</button>
              <button id="open-history" type="button">History</button>
            </div>
          </div>

          <div className="edit-card" id="edit-card" hidden>
            <input id="edit-targets" type="text" placeholder="section ids, e.g. hero, details" />
            <textarea id="edit-prompt" placeholder="describe the edit..." />
            <button id="edit-go" type="button" className="edit-submit" disabled>Patch</button>
          </div>

          <Pane title="Sandbox" status={<span id="iframe-status">idle</span>} className="pane-result sandbox-stage">
            <div className="iframe-wrap">
              <SandboxFrame id="sandbox" className="h-640" title="Summon generate sandbox" />
              <div className="iframe-welcome" id="welcome">
                <div className="welcome-text" id="welcome-text">Host Data Search awaits generated UI.</div>
              </div>
            </div>
          </Pane>

          <div id="children" className="children-stack" aria-label="Summoned sibling sandboxes" />
        </main>

        <aside className="contract-inspector" aria-label="Contract inspector">
          <div className="inspector-heading">
            <span>Surface Inspector</span>
            <span id="inspector-status">pending</span>
          </div>
          <div className="contract-summary" id="contract-summary" />

          <section className="run-settings" aria-label="Run settings">
            <div className="settings-grid">
              <label>
                <span className="field-label">Provider</span>
                <select id="model-provider" className="pill-select" title="Model provider" />
              </label>
              <label>
                <span className="field-label">Model</span>
                <select id="generation-model" className="pill-select" title="Generation model" />
              </label>
              <label id="custom-model-field" hidden>
                <span className="field-label">Custom model</span>
                <input id="custom-model" className="ghost-target" type="text" placeholder="provider-model-id" title="Custom generation model id" />
              </label>
              <label>
                <span className="field-label">Utility</span>
                <select id="utility-model" className="pill-select" title="Utility model for shape and host demo calls" />
              </label>
              <label>
                <span className="field-label">Max output</span>
                <select id="max-output-tokens" className="pill-select" title="Generation output token cap" />
              </label>
              <label>
                <span className="field-label">Repair cap</span>
                <select id="repair-max-output-tokens" className="pill-select" title="Repair output token cap" />
              </label>
              <label id="anthropic-thinking-field" hidden>
                <span className="field-label">Thinking</span>
                <select id="anthropic-thinking" className="pill-select" title="Anthropic thinking mode" />
              </label>
              <label id="model-effort-field" hidden>
                <span className="field-label">Effort</span>
                <select id="model-effort" className="pill-select" title="Anthropic effort" />
              </label>
              <label>
                <span className="field-label">Direction</span>
                <select id="direction" className="pill-select" title="Design direction" />
              </label>
              <label>
                <span className="field-label">Layout</span>
                <select id="layout" className="pill-select" title="Host layout" defaultValue="">
                  <option value="">Free layout</option>
                  <option value="card-structured">Card: header/content/actions</option>
                </select>
              </label>
              <label>
                <span className="field-label">Fragment unit</span>
                <select id="fragment-unit" className="pill-select" title="Streaming fragment unit" defaultValue="section">
                  <option value="section">Sections</option>
                  <option value="block-v0">Blocks (experimental)</option>
                  <option value="html-node-v0">HTML nodes (experimental)</option>
                </select>
              </label>
              <label>
                <span className="field-label">Scripts</span>
                <select id="script-policy" className="pill-select" title="Script policy" defaultValue="forbid">
                  <option value="forbid">Scripts forbidden</option>
                  <option value="allow">Scripts allowed</option>
                </select>
              </label>
              <label>
                <span className="field-label">Tokens</span>
                <select id="token-preset" className="pill-select" title="Token override preset" defaultValue="">
                  <option value="">Base tokens</option>
                  <option value="accent-blue">Accent override</option>
                </select>
              </label>
            </div>

            <div className="settings-row">
              <div className="mode-group" title="Mode">
                <label><input type="radio" name="mode" value="static" defaultChecked /><span>Static</span></label>
                <label><input type="radio" name="mode" value="interactive" /><span>Interactive</span></label>
              </div>
              <label className="repair-toggle" title="Infer surface policy from the prompt within host ceilings">
                <input id="agent-broker-enabled" type="checkbox" defaultChecked />
                <span>Agent broker</span>
              </label>
              <label className="repair-toggle" title="Enable validation retry">
                <input id="repair-enabled" type="checkbox" />
                <span>Validation retry</span>
              </label>
            </div>

            <div className="ghost-controls">
              <label>
                <span className="field-label">Ghost target</span>
                <input id="ghost-target" className="ghost-target" type="text" defaultValue="." placeholder="Ghost target path" title="Ghost target path" />
              </label>
              <label>
                <span className="field-label">Ghost base</span>
                <select id="ghost-base-direction" className="pill-select" title="Ghost base direction" />
              </label>
            </div>
          </section>

          <section className="custom-contract">
            <label className="custom-contract-toggle">
              <input id="custom-contract-enabled" type="checkbox" />
              <span>Custom Surface Config</span>
            </label>
            <div id="custom-contract-panel" className="custom-contract-panel" hidden>
              <div className="surface-controls" aria-label="Surface config controls">
                <select id="surface-purpose" className="pill-select" title="Surface purpose" />
                <select id="surface-runtime" className="pill-select" title="Surface runtime" />
                <select id="surface-data" className="pill-select" title="Surface data" />
                <select id="surface-authority" className="pill-select" title="Surface authority" />
                <select id="surface-persistence" className="pill-select" title="Surface persistence" />
              </div>
            </div>
          </section>
        </aside>
      </div>

      <section className="diagnostics-dock" aria-label="Diagnostics">
        <div className="diagnostics-tabs" role="tablist" aria-label="Diagnostics tabs">
          <button id="tab-stream" type="button" className="active" data-diagnostics-tab="stream">Stream <span id="stream-tail">waiting</span></button>
          <button id="tab-devtools" type="button" data-diagnostics-tab="devtools">Devtools <span id="devtools-tally">no events</span></button>
          <button id="tab-history" type="button" data-diagnostics-tab="history">History <span id="saved-count">0</span></button>
          <button id="tab-safety" type="button" data-diagnostics-tab="safety">Safety</button>
        </div>

        <div className="diagnostics-panel active" id="diagnostics-stream" data-diagnostics-panel="stream">
          <LogView id="log" />
        </div>
        <div className="diagnostics-panel" id="diagnostics-devtools" data-diagnostics-panel="devtools" hidden>
          <LogView id="devtools-log" className="devtools-log" />
        </div>
        <div className="diagnostics-panel" id="diagnostics-history" data-diagnostics-panel="history" hidden>
          <div className="saved-surfaces" id="saved-surfaces">
            <div id="saved-list" className="saved-list" />
          </div>
        </div>
        <div className="diagnostics-panel" id="diagnostics-safety" data-diagnostics-panel="safety" hidden>
          <div className="safety-links" aria-label="Safety checks">
            <a href="/adversarial.html">Adversarial</a>
            <a href="/strict.html">Strict input</a>
            <a href="/fatal.html">Fatal boot</a>
          </div>
        </div>
      </section>
    </>
  );
}

export function BatchPageShell() {
  return (
    <>
      <AppNav active="batch" />
      <PageHeader
        title="Batch testing"
        lede="Fire N generations in parallel. Same prompt to compare consistency, or a seeded random sample from the curated prompt pool to compare coverage."
        className="batch-header"
      />
      <div className="controls batch-controls">
        <label>Direction <select id="direction" /></label>
        <div className="mode-group" title="Mode">
          <label><input type="radio" name="mode" value="random" defaultChecked /><span>Random</span></label>
          <label><input type="radio" name="mode" value="same" /><span>Same</span></label>
        </div>
        <div className="mode-group" title="Layout">
          <label><input type="radio" name="layout" value="grid" defaultChecked /><span>Grid</span></label>
          <label><input type="radio" name="layout" value="stacked" /><span>Stacked</span></label>
        </div>
        <div className="mode-group" title="Interactivity">
          <label><input type="radio" name="interactivity" value="static" defaultChecked /><span>Static</span></label>
          <label><input type="radio" name="interactivity" value="interactive" /><span>Interactive</span></label>
        </div>
        <label>Count <input type="number" id="count" min="1" max="12" defaultValue="4" /></label>
        <label id="seed-wrap">Seed <input type="number" className="seed" id="seed" placeholder="auto" /></label>
        <label id="same-wrap" style={{ flex: '1 1 300px', display: 'none' }}>
          Prompt
          <textarea id="same-prompt" placeholder="help me plan a low-key date night for this Friday" />
        </label>
        <button id="run" type="button" className="btn btn-sm">Run</button>
        <button id="stop" type="button" className="btn-secondary btn-sm" disabled>Stop</button>
      </div>
      <div className="grid layout-grid batch-grid" id="grid" />
      <div className="summary batch-summary" id="summary">No run yet.</div>
    </>
  );
}

export function FragmentComparePageShell() {
  return (
    <>
      <AppNav active="fragment-compare" />
      <PageHeader
        title="Fragment compare"
        className="compare-header"
        aside={<div className="compare-summary" id="summary">Idle</div>}
      />
      <form id="compare-form" className="compare-controls">
        <section className="compare-presets" aria-labelledby="prompt-presets-label">
          <div className="compare-presets-header">
            <span id="prompt-presets-label" className="field-label">Sample prompt matrix</span>
            <span className="compare-presets-note">Rows are Summon use cases. Columns are complexity.</span>
          </div>
          <div id="prompt-preset-matrix" className="compare-preset-matrix" />
        </section>
        <label className="compare-prompt">
          <span className="field-label">Prompt</span>
          <textarea id="prompt" defaultValue="Show me a clean end-of-day sales snapshot for a coffee shop." />
        </label>
        <div className="compare-actions">
          <button id="run" type="submit" className="btn btn-sm">Run both</button>
          <button id="stop" type="button" className="btn-secondary btn-sm" disabled>Stop</button>
        </div>
      </form>

      <main className="compare-grid" aria-label="Fragment comparison">
        <section className="compare-pane" data-fragment-side="section">
          <header>
            <div>
              <span>Sections</span>
              <strong>current behavior</strong>
            </div>
            <span id="section-status" className="status">idle</span>
          </header>
          <iframe id="section-frame" title="Section fragment result" srcDoc="<style>html,body{margin:0;min-height:100%;background:#000;color:oklch(0.96 0.003 264)}</style>" />
          <div className="compare-metrics" id="section-metrics">0 lines · 0 B</div>
          <LogView id="section-log" className="compare-log" />
        </section>

        <section className="compare-pane" data-fragment-side="html-node-v0">
          <header>
            <div>
              <span>HTML Nodes</span>
              <strong>experimental html-node-v0</strong>
            </div>
            <span id="block-status" className="status">idle</span>
          </header>
          <iframe id="block-frame" title="HTML node patch result" srcDoc="<style>html,body{margin:0;min-height:100%;background:#000;color:oklch(0.96 0.003 264)}</style>" />
          <div className="compare-metrics" id="block-metrics">0 lines · 0 B</div>
          <LogView id="block-log" className="compare-log" />
        </section>
      </main>
    </>
  );
}

export function AdversarialPageShell() {
  return (
    <>
      <AppNav />
      <h1 className="page-title">Phase 1 adversarial harness</h1>
      <p className="lede">Loads a sandbox with a deliberately malicious artifact. Each attempt that fails is a win.</p>
      <div className="layout cols-2">
        <Pane title="Sandbox iframe">
          <SandboxFrame id="sandbox" className="h-320" title="Summon sandbox" />
        </Pane>
        <Pane title="Test results">
          <LogView id="results" className="h-320" />
          <div className="summary" id="summary">Running...</div>
        </Pane>
      </div>
    </>
  );
}

export function StrictPageShell() {
  return (
    <>
      <AppNav />
      <h1 className="page-title">Strict tier - host-owned card input</h1>
      <p className="lede">
        Outer sandbox draws the form layout but does <em>not</em> render the card field. It reserves a placeholder,
        emits <code>mount_strict_input</code> with bounds, and the host overlays a trusted input on top. Outer never sees
        the digits - only a tokenized result.
      </p>
      <div className="layout cols-3-2">
        <Pane title="Sandbox iframe (overlay sits on top)">
          <SandboxFrame id="sandbox" className="h-540" title="Summon strict-tier demo" />
        </Pane>
        <Pane title="Host bridge log">
          <LogView id="log" className="h-540" />
        </Pane>
      </div>
    </>
  );
}

export function FatalPageShell() {
  return (
    <>
      <AppNav />
      <h1 className="page-title">Bootstrap self-test</h1>
      <p className="lede">
        Drives bootstrap into a deliberately misconfigured sandbox. Bootstrap&apos;s startup self-test should detect the
        regression and post SUMMON_FATAL instead of SUMMON_READY.
      </p>

      <div className="case">
        <h2>Case A - correctly configured (control)</h2>
        <p>sandbox=&quot;allow-scripts&quot; - null-origin. Self-test should pass and bootstrap should post SUMMON_READY.</p>
        <div className="layout cols-2">
          <Pane title="Sandbox iframe">
            <SandboxFrame id="case-a-frame" className="h-200" title="control" />
          </Pane>
          <Pane title="Result">
            <div id="case-a-result" className="results">...</div>
          </Pane>
        </div>
      </div>

      <div className="case">
        <h2>Case B - misconfigured (allow-same-origin)</h2>
        <p>sandbox=&quot;allow-scripts allow-same-origin&quot; - same-origin with parent. Self-test should detect and post SUMMON_FATAL.</p>
        <div className="layout cols-2">
          <Pane title="Sandbox iframe">
            <SandboxFrame id="case-b-frame" className="h-200" title="misconfigured" />
          </Pane>
          <Pane title="Result">
            <div id="case-b-result" className="results">...</div>
          </Pane>
        </div>
      </div>
    </>
  );
}
