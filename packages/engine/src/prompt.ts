/**
 * System prompt builder.
 *
 * Ownership boundary (see docs/prompt-architecture.md):
 *   - Summon layer (this file's fixed/output blocks): runtime mechanics, sandbox
 *     safety, output shape. NO design or composition guidance.
 *   - Ghost layer: all composition, hierarchy, density, tone, visual design.
 *   - Host layer: capability (tools, surface contract) + optional layout.
 *
 * Blocks are passed to the SDK as separate `system` text blocks with
 * `cache_control`; the stable Summon prefix caches long-lived.
 */

import { ARROW_BINDING_RULE_LINE, ARROW_SANDBOX_SUBSET_PROMPT_BLOCK } from './arrow-subset.js';
import { formatTokenContract } from './token-contract.js';
import {
  type ActionStateKeys,
  defaultTriggersForKind,
  type ToolKind,
  type ToolStateKeys,
  type ToolTrigger,
  type ResourceStateKeys,
} from './tool-contract.js';
import type { SurfaceContractView, SurfaceContractSurface } from './surface-contract.js';
import type { ToolSurface } from './surface-plan.js';
import {
  runtimeProfile,
  type SummonOutputRuntime,
} from './output-runtime.js';

export interface SummonLayoutSlot {
  /** Lowercase kebab-case slot id, e.g. `next-steps`. */
  id: string;
  /** One-sentence instruction describing what belongs in this region. */
  purpose: string;
}

export interface SummonLayout {
  /** Host-facing layout identifier, useful for logs and prompt context. */
  id: string;
  /** Ordered list of sections the LLM may populate. */
  slots: SummonLayoutSlot[];
}

/** How much room the calling medium offers. Owned by the medium, not Ghost. */
export type SurfaceSize = 'small' | 'medium' | 'large';

/** How much functionality/detail to build inside that room. */
export type SurfaceComplexity = 'simple' | 'moderate' | 'rich';

/**
 * Surface scale — the spatial + functional budget the *calling medium* offers
 * (a card, a sidecar, a banner, an email). Advisory: it steers the model, it
 * does not change validation limits. Both fields optional; `complexity`
 * derives from `size` when omitted. A future SurfaceTemplate is the natural
 * owner of this field.
 */
export interface SurfaceScale {
  size?: SurfaceSize;
  complexity?: SurfaceComplexity;
}

export const DEFAULT_SURFACE_SIZE: SurfaceSize = 'medium';

const COMPLEXITY_FROM_SIZE: Record<SurfaceSize, SurfaceComplexity> = {
  small: 'simple',
  medium: 'moderate',
  large: 'rich',
};

export function resolveSurfaceScale(
  scale?: SurfaceScale | null,
): { size: SurfaceSize; complexity: SurfaceComplexity } {
  const size = scale?.size ?? DEFAULT_SURFACE_SIZE;
  const complexity = scale?.complexity ?? COMPLEXITY_FROM_SIZE[size];
  return { size, complexity };
}

export function buildScaleBlock(scale?: SurfaceScale | null): string {
  const { size, complexity } = resolveSurfaceScale(scale);

  const sizeLine: Record<SurfaceSize, string> = {
    small:
      'The medium offers little room. Build ONE compact, contained surface — a single card-sized region. Do NOT add multi-column layouts, side panels, headers/footers, or full-page framing.',
    medium:
      'The medium offers room for one complete, self-contained surface with a clear primary region and, at most, light supporting structure.',
    large:
      'The medium offers generous room. You MAY build a full, multi-region surface with several distinct sections.',
  };
  const complexityLine: Record<SurfaceComplexity, string> = {
    simple:
      'Build exactly ONE primary idea. OMIT secondary sections, optional controls, empty/loading states, and decorative embellishment. Prefer the fewest elements that fully express the primary idea. If in doubt, leave it out.',
    moderate:
      'Build the primary content plus a reasonable amount of supporting detail and the controls a user would actually need. Avoid speculative or rarely-used affordances.',
    rich:
      'Develop the content fully: supporting sections, detail, and the full set of controls that make the surface complete.',
  };

  const elementBudget: Record<SurfaceComplexity, string> = {
    simple: 'Target roughly 3–7 primary elements total.',
    moderate: 'Target roughly 8–15 primary elements total.',
    rich: 'No element budget — build what the content genuinely requires.',
  };

  return `## Surface scale — hard constraint for this generation

Treat this as a binding constraint on HOW MUCH surface to build, not a suggestion. It sets the amount and structure of content; the Ghost fingerprint still owns all visual language, density, and tone. When scale and your default instinct conflict, scale wins.

- Size \`${size}\`: ${sizeLine[size]}
- Complexity \`${complexity}\`: ${complexityLine[complexity]}
- Budget: ${elementBudget[complexity]}

Do not exceed this scale to "improve" the result. A smaller, sharper surface that respects the budget is the correct answer — adding extra sections, controls, or regions beyond the budget is a failure to follow instructions.`;
}

export interface PromptRuntimeOptions {
  outputRuntime?: SummonOutputRuntime;
}

/**
 * The stable, cacheable prefix. Output format, Arrow/CSS rules, token vocabulary policy.
 * No design direction — that lives in the per-direction block below so changing
 * directions doesn't invalidate this cache entry.
 *
 * The token-vocabulary paragraph intentionally contains no Summon-owned token
 * names. Concrete active tokens are listed by Ghost/direction prompt blocks.
 */
export const SUMMON_FIXED_INSTRUCTIONS = `You generate self-contained Arrow web UIs for the Summon rendering engine.

You receive a user request and a Ghost design fingerprint. Render one Arrow artifact that satisfies the request. The Ghost fingerprint is the sole authority for composition, hierarchy, density, tone, structure, and all visual design — follow it. Summon governs only the runtime, safety, and output format described below; it has no opinion about how the surface should look.

## Structured Arrow sandbox bundle

You return a structured object through the provided create_summon_arrow_surface tool/schema. Do not write Markdown, code fences, transport records, stream lines, objects with op/path fields, or host-owned meta paths. The server owns streaming, preview events, validation summaries, and artifact delivery.

The returned object must include:

- schema: "summon.arrow-bundle/v1"
- source with exactly one main.ts or main.js entry file
- optional main.css for all visual styling
- optional compact preview describing the surface kind, title, and semantic regions

Arrow entry rules:

- The default export from the entry file must be an Arrow template or component result.
- Import Arrow primitives from @arrow-js/core; do not rely on ambient globals. Use only html, reactive, component, props, pick, watch, onCleanup, and nextTick.
- Use reactive() for local state and wrap live reads as functions so Arrow can track updates.
- Use quoted Arrow event and attribute bindings for clicks, form events, disabled states, and classes.
- For boolean attributes, return false to remove the attribute rather than injecting a bare attribute string.
- ${ARROW_BINDING_RULE_LINE}
- For host actions and resources, import from host-bridge:summon and call await callTool(toolName, args) for granted host tools only.
- Use await getState() and onState((state) => ...) to read host-pushed state.
- Do not use window, document, localStorage, cookies, direct DOM refs, external imports, timers, native bridges, or external URLs.
- Use fetch() only when the Surface plan network is restricted-fetch; otherwise use host tools.

${ARROW_SANDBOX_SUBSET_PROMPT_BLOCK}

## Arrow/CSS rules

These are runtime and safety boundaries, not design guidance. The fingerprint owns the design.

- Use plain semantic HTML inside Arrow templates.
- Put visual styling in \`main.css\`; use class names, not generated inline style strings, for major layout.
- No external URLs. No external images, no external fonts, no external stylesheets. Inline SVG is fine.
- Token names and the visual vocabulary come from the Ghost fingerprint. You may define local CSS aliases that compose fingerprint tokens, and use calc()/clamp(), responsive units, safe transitions/transforms, and inline SVG.
- Do not fake interactivity the runtime does not support: no CSS-only state machines, \`:has()\` selector tricks, sibling-\`:checked\` toggles, or \`<details>\` chains used to simulate behavior. If a control needs interactivity you have not been granted, omit it or state the limitation in one short line of copy.

## Token contract

${formatTokenContract()}

The Ghost fingerprint specifies which tokens carry particular meaning and how to deploy them.

Begin. Return one complete structured Arrow bundle through the provided tool/schema.`;
export const SUMMON_STRUCTURED_ARROW_BUNDLE_INSTRUCTIONS = `## Output contract — final reminder

Return one structured object through the \`create_summon_arrow_surface\` tool/schema. Not Markdown, code fences, transport records, stream lines, \`op\`/\`path\` objects, or host-owned meta paths.

- \`schema: "summon.arrow-bundle/v1"\`
- \`source\` with exactly one \`main.ts\` or \`main.js\` entry file (optional \`main.css\`)
- optional compact \`preview\`

Highest-value reminders (full rules above):
- Import only from \`@arrow-js/core\` (\`html\`, \`reactive\`, \`component\`, \`props\`, \`pick\`, \`watch\`, \`onCleanup\`, \`nextTick\`); the default export is the Arrow result.
- ${ARROW_BINDING_RULE_LINE}
- No \`window\`/\`document\`/storage/DOM refs/external imports/timers/URLs. Host behavior goes through \`host-bridge:summon\`.

The run is incomplete until the bundle contains a valid Arrow entry file.`;
export const SUMMON_FIXED_HTML_INSTRUCTIONS = `You generate self-contained HTML/CSS web UIs for the experimental Summon HTML bakeoff runtime.

You receive a user request and a Ghost design fingerprint. Render one HTML/CSS artifact that satisfies the request. The Ghost fingerprint is the sole authority for composition, hierarchy, density, tone, structure, and all visual design — follow it. Summon governs only the runtime, safety, and output format described below; it has no opinion about how the surface should look.

## Structured HTML/CSS sandbox bundle

You return a structured object through the provided create_summon_html_surface tool/schema. Do not write Markdown, code fences, transport records, stream lines, objects with op/path fields, host-owned meta paths, or Arrow source.

The returned object must include:

- schema: "summon.html-bundle/v0"
- source["body.html"] with one complete HTML body fragment
- optional source["main.css"] for all visual styling
- optional compact preview describing the surface kind, title, and semantic regions

HTML/CSS rules (runtime and safety boundaries, not design guidance):

- Use plain semantic HTML. Do not emit <script>, <iframe>, <object>, <embed>, <link>, <meta>, <base>, or <form> elements.
- Do not use inline event handlers such as onclick, oninput, or onsubmit.
- Do not use external URLs, external images, external fonts, external stylesheets, @import, blob/file URLs, or javascript: URLs. Inline SVG and data:image assets are allowed.
- Put visual styling in main.css when possible; inline style attributes are allowed only for small local details.
- Token names and the visual vocabulary come from the Ghost fingerprint. You may define local CSS aliases that compose fingerprint tokens, and use calc()/clamp(), responsive units, safe transitions/transforms, and inline SVG.
- This runtime is static HTML/CSS with no host tool bridge. Do not fake interactivity with hidden checkboxes, :target hacks, or generated JS, and do not render dead controls that imply host execution; render actions as clearly non-live recommendations or next-step callouts.

## Token contract

${formatTokenContract()}

The Ghost fingerprint specifies which tokens carry particular meaning and how to deploy them.

Begin. Return one complete structured HTML bundle through the provided tool/schema.`;
export const SUMMON_STRUCTURED_HTML_BUNDLE_INSTRUCTIONS = `## Output contract — final reminder

Return one structured object through the \`create_summon_html_surface\` tool/schema. Not Markdown, code fences, transport records, stream lines, \`op\`/\`path\` objects, host-owned meta paths, or Arrow source.

- \`schema: "summon.html-bundle/v0"\`
- \`source["body.html"]\` with one complete HTML body fragment (optional \`source["main.css"]\`)
- optional compact \`preview\`

Highest-value reminders (full rules above): no \`<script>\`, \`<iframe>\`, \`<form>\`, inline event handlers, or external URLs/fonts/stylesheets/\`@import\`. This runtime is static HTML/CSS with no host tool bridge.

The run is incomplete until the bundle contains valid \`body.html\`.`;

export const SUMMON_FIXED_DOMJS_INSTRUCTIONS = `You generate self-contained, interactive HTML/JS web UIs for the experimental Summon domjs runtime.

You receive a user request and a Ghost design fingerprint. Render one interactive surface as imperative JavaScript that builds the DOM. The Ghost fingerprint is the sole authority for composition, hierarchy, density, tone, and all visual design — follow it. Summon governs only the runtime, safety, and output format below.

## How the runtime works

Your JavaScript runs inside a capability sandbox. There is no real browser: no \`window\`, no \`document.body\`, no network, no storage. A \`document\` facade with standard DOM semantics lets you build and mutate a node tree, and the trusted host renders it. Write normal imperative DOM code — \`createElement\`, \`append\`, \`removeChild\`, \`textContent\`, \`el.style.*\`, \`classList\`, \`addEventListener\` or \`el.onclick\`, property setters like \`value\`/\`checked\`/\`disabled\` — and \`export default rootNode\`.

## Reactivity (preferred for dynamic values)

\`state(initial)\` returns a deeply reactive object. Bind dynamic values by passing a FUNCTION; the binding re-runs automatically when the state it reads changes.

- Reactive text: \`label.textContent = () => 'Count: ' + s.count\` — only that text updates when \`s.count\` changes.
- Reactive attribute: \`btn.setAttribute('disabled', () => s.items.length === 0)\` or \`el.className = () => s.active ? 'tab on' : 'tab'\`.
- Reactive list/conditional: \`region(() => s.items.map(item => { const li = document.createElement('li'); li.textContent = item.label; return li; }))\` — re-renders automatically when \`s.items\` changes.
- Handlers just mutate state, including in place: \`s.count += 1\`, \`s.items.push(item)\`, \`s.items.splice(i, 1)\`, \`s.user.name = ...\` — all tracked. No manual update calls.
- Plain DOM mutation also works after render (\`root.append(...)\`, \`el.textContent = ...\` in a handler), but prefer reactive bindings for values that change often.
- Host tools: \`await callTool(name, args)\`, \`getState()\`, \`onState(cb)\`.

## Hard rules (these crash or are rejected)

- Do NOT use \`innerHTML\`, \`outerHTML\`, \`querySelector\`, \`getElementById\`, \`node.remove()\`, or \`parentNode\` traversal. Hold references to nodes you create.
- Do NOT use \`fetch\`, \`XMLHttpRequest\`, or \`WebSocket\`. Call granted host tools with \`callTool(name, args)\` instead.

## Worked examples (follow this shape — design per the fingerprint)

These show the runtime mechanics only; apply the Ghost fingerprint for all visual design.

Reactive counter — function bindings update in place, handler just mutates state:

    const s = state({ count: 0 });
    const root = document.createElement('div');
    const label = document.createElement('p');
    label.textContent = () => 'Count: ' + s.count;          // reactive text
    const inc = document.createElement('button');
    inc.textContent = 'Increment';
    inc.onclick = () => { s.count += 1; };                   // no manual update
    const reset = document.createElement('button');
    reset.textContent = 'Reset';
    reset.setAttribute('disabled', () => s.count === 0);     // reactive attribute
    reset.onclick = () => { s.count = 0; };
    root.append(label, inc, reset);
    export default root;

Reactive list with add/remove — region re-renders automatically; mutate the array in place:

    const s = state({ items: ['First task'], draft: '' });
    const root = document.createElement('div');
    const input = document.createElement('input');
    input.addEventListener('input', (e) => { s.draft = e.value; });
    const add = document.createElement('button');
    add.textContent = 'Add';
    add.onclick = () => {
      if (!s.draft) return;
      s.items.push(s.draft);                                 // tracked in place
      s.draft = '';
    };
    const count = document.createElement('p');
    count.textContent = () => s.items.length + ' item(s)';
    const list = region(() => s.items.map((label, i) => {    // auto re-renders
      const row = document.createElement('div');
      const text = document.createElement('span');
      text.textContent = label;
      const del = document.createElement('button');
      del.textContent = 'Remove';
      del.onclick = () => { s.items.splice(i, 1); };
      row.append(text, del);
      return row;
    }));
    root.append(input, add, count, list);
    export default root;

## Token contract

${formatTokenContract()}

Begin. Return one complete structured domjs bundle through the provided tool/schema.`;

export const SUMMON_STRUCTURED_DOMJS_BUNDLE_INSTRUCTIONS = `## Output contract — final reminder

Return one structured object through the \`emit_domjs_surface\` tool/schema. Not Markdown, code fences, transport records, \`op\`/\`path\` objects, host-owned meta paths, or Arrow source.

- \`schema: "summon.domjs-bundle/v1"\`
- \`source["main.js"]\` building the UI imperatively and \`export default rootNode\` (optional \`source["main.css"]\`)

Highest-value reminders (full rules above): only the supported facade API; use reactive state with function bindings (\`textContent = () => s.x\`, \`region(() => s.items.map(...))\`) and mutate state in handlers — no manual update calls; reassign arrays (\`s.items = s.items.concat(...)\`) so edits track; no \`innerHTML\`/\`querySelector\`/\`el.style\`/\`window\`/\`fetch\`; reach the host only through \`callTool()\`.

The run is incomplete until the bundle contains a valid \`main.js\` that exports a root node.`;

export function buildLayoutBlock(
  layout: SummonLayout,
  options: PromptRuntimeOptions = {},
): string {
  const slotLines = layout.slots
    .map((slot) => `- \`${slot.id}\` — ${slot.purpose}`)
    .join('\n');
  const artifactLabel = runtimeProfile(options.outputRuntime).format === 'html'
    ? 'HTML bundle'
    : 'Arrow artifact';

return `## Host layout — this generation

The host has supplied a strict layout contract named **${layout.id}**. Build your ${artifactLabel} so its visible composition has these semantic regions, in this order:

${slotLines}

Rules:

- Use each slot for its purpose.
- Do not invent page chrome or alternate slot names that obscure the layout.
- Do not emit transport records or stream lines such as \`set /screen\`, \`add /section/*\`, \`/surface-plan\`, or \`/artifact\`; the server owns the stream.
- The host layout controls semantic order; the direction controls visual language.`;
}

/**
 * Render the `purpose` hint at a firmness scaled by goal provenance. The
 * capability boundaries are unaffected — only how strongly we phrase the
 * (always overrulable) purpose hint changes. A `deterministic` regex guess is
 * voiced most tentatively; a confident `model`/`provided` goal a bit more
 * assertively. In all cases Purpose is a hint the model may override based on
 * the user request.
 */
function purposeHintText(surface: SurfaceContractSurface): string {
  const purpose = surface.plan.purpose;
  const source = surface.goalProvenance?.source ?? 'deterministic';
  const confidence = surface.goalProvenance?.confidence;
  const confident =
    (source === 'model' || source === 'provided') &&
    (confidence === undefined || confidence >= 0.7);

  const lead = confident
    ? `Purpose hint (the host's inferred purpose for this request — a strong suggestion, still not a constraint):`
    : `Purpose hint (the host's best guess at what the user wants — a weak signal, not a constraint):`;
  const guidance = confident
    ? `Treat Purpose as a suggestion. If the user request or content clearly calls for a different shape, follow them. Never narrow, omit, or genericize the surface to fit the Purpose hint. The capability boundaries above are the only hard limits.`
    : `Treat Purpose as a soft hint only. The user request and the actual content are the authority — when in doubt, follow them over this hint. Never narrow, omit, or genericize the surface to fit the Purpose hint. The capability boundaries above are the only hard limits.`;

  return `${lead}\n\n- Purpose (hint): \`${purpose}\`\n\n${guidance}`;
}

export function buildSurfaceContractBlock(
  contract: SurfaceContractView,
  options: PromptRuntimeOptions = {},
): string {
  const { surface } = contract;
  const outputRuntime = options.outputRuntime ?? 'arrow-control';
  const profile = runtimeProfile(outputRuntime);
  const htmlRuntime = profile.format === 'html';
  const artifactLine = htmlRuntime
    ? `It is not a JSON UI schema: you still generate a rich HTML bundle inside these typed boundaries. The output runtime for this generation is \`${outputRuntime}\`; the structured output contract below controls the exact files.`
    : 'It is not a JSON UI schema: you still generate a rich Arrow source artifact inside these typed boundaries.';
  const enforcementLine = htmlRuntime
    ? 'Do not emit `/surface-contract`, `/surface-policy`, or `/surface-plan` meta lines. The host owns those lines and enforcement still lives in the runtime validators, PolicyEngine, and HTML sandbox boundary.'
    : 'Do not emit `/surface-contract`, `/surface-policy`, or `/surface-plan` meta lines. The host owns those lines and enforcement still lives in the runtime validators, PolicyEngine, and inline Arrow tool grants.';
  const toolLines = contract.tools.length
    ? contract.tools.map((tool) => {
        const stateKeys = tool.stateKeys
          ? `; state keys ${formatStateKeys(tool.stateKeys)}`
          : '';
        const actionState = tool.actionStateKeys
          ? `; action state ${formatActionStateKeys(tool.actionStateKeys)}`
          : '';
        const result = tool.resultSchema ? `; result \`${tool.resultSchema}\`` : '';
        const defaultData = tool.defaultDataShape ? `; default \`${tool.defaultDataShape}\`` : '';
        return `- \`${tool.name}\` (${tool.kind}) — ${tool.description} Triggers: ${tool.triggers.join(', ')}; args \`${tool.argsSchema}\`; state \`${tool.stateShape}\`${stateKeys}${actionState}${result}${defaultData}; surface data=${tool.surface.data}, authority=${tool.surface.authority}`;
      }).join('\n')
    : '- none';
  const layoutLines = contract.layout
    ? contract.layout.slots
        .map((slot) => `- \`${slot.id}\` — ${slot.purpose}`)
        .join('\n')
    : '- none';
  const issueLine = contract.issues.length
    ? `${contract.issues.length} host compile issue${contract.issues.length === 1 ? '' : 's'}; do not widen the surface to work around them.`
    : 'none';

  return `## Surface contract — host-owned boundaries

This is a compact, read-only view of the host-selected \`SurfacePolicy\`. It tells you what this generated surface can do. ${artifactLine}

${enforcementLine}

### Surface

Capability boundaries (hard limits — the sandbox enforces these):

- Tier: \`${surface.policy.tier}\`
- Runtime: \`${surface.plan.runtime}\`, data: \`${surface.plan.data}\`, authority: \`${surface.plan.authority}\`, persistence: \`${surface.plan.persistence}\`
- Mode: \`${surface.mode}\`

${purposeHintText(surface)}

### Tools

${toolLines}

### Host layout

${layoutLines}

### Compile issues

${issueLine}`;
}

/**
 * Tools — what tools the generated UI can emit. Injected as a third
 * cacheable system block when the host requests interactive mode. Static mode
 * omits this block entirely; the fixed instructions already forbid scripts.
 *
 * The engine is tool-agnostic. Consumers (demo apps, host applications)
 * define their own tool packs — tools they support and example
 * patterns showing how to wire each one. A pack is passed in per generation.
 */
export interface ToolSpec {
  name: string;
  description: string;
  argsSchema: string;
  stateShape: string;
  kind?: ToolKind;
  triggers?: ToolTrigger[];
  stateKeys?: ToolStateKeys;
  actionStateKeys?: ActionStateKeys;
  surface?: ToolSurface;
  resultSchema?: string;
  defaultDataShape?: string;
  defaultData?: unknown;
}

export interface DataResourceSpec extends ToolSpec {
  kind: 'resource';
  stateKeys: ResourceStateKeys;
  resultSchema?: string;
  defaultDataShape?: string;
  defaultData?: unknown;
}

export interface ToolPattern {
  /** Short title shown above the code snippet in the prompt. */
  name: string;
  /** HTML code block the LLM sees as an example. Script examples are filtered. */
  code: string;
  /** Optional owner tool. SurfacePolicy narrowing uses this to keep examples
   * aligned with the grants selected for a generation. */
  tool?: string;
}

export interface ToolPack {
  tools: ToolSpec[];
  /** Example patterns shown under "### Patterns". Optional — without them the
   *  LLM gets only the tool list and the interactivity rules. */
  patterns?: ToolPattern[];
}

export function buildToolsBlock(
  pack: ToolPack,
  options: PromptRuntimeOptions = {},
): string {
  if (pack.tools.length === 0) return '';

  const actions = pack.tools.filter((tool) => (tool.kind ?? 'action') === 'action');
  const resources = pack.tools.filter((tool) => tool.kind === 'resource');

  const formatTool = (tool: ToolSpec) => {
    const triggers = normalizeTriggers(tool).join(', ');
    const stateKeys = tool.stateKeys
      ? `\n  State keys: ${formatStateKeys(tool.stateKeys)}`
      : '';
    const actionStateKeys = tool.actionStateKeys
      ? `\n  Action state: ${formatActionStateKeys(tool.actionStateKeys)}`
      : '';
    const surface = tool.surface ? `\n  Surface: ${formatSurface(tool.surface)}` : '';
    return `- \`${tool.name}(${tool.argsSchema})\` — ${tool.description}\n  Triggers: ${triggers}\n  State update: \`${tool.stateShape}\`${stateKeys}${actionStateKeys}${surface}`;
  };

  const actionsList = actions
    .map(formatTool)
    .join('\n\n');
  const resourcesList = resources
    .map(
      (tool) => {
        const resultSchema = tool.resultSchema ? `\n  Result schema: \`${tool.resultSchema}\`` : '';
        const defaultData = tool.defaultDataShape
          ? `\n  Default data: \`${tool.defaultDataShape}\``
          : '\n  Default data: `null`';
        return `${formatTool(tool)}${resultSchema}${defaultData}\n  Data resource lifecycle: initial/loading/error/invalid states keep data at the default value (or null), and successful host fetches write validated data.`;
      }
    )
    .join('\n\n');

  const toolSections = [
    resourcesList ? `### Available data resources\n\n${resourcesList}` : '',
    actionsList ? `### Available actions\n\n${actionsList}` : '',
  ].filter(Boolean).join('\n\n');

  if (runtimeProfile(options.outputRuntime).format === 'html') {
    return buildHtmlToolsBlock({
      outputRuntime: options.outputRuntime ?? 'html-static',
      toolSections,
    });
  }

  const promptPatterns = (pack.patterns ?? []).filter(
    (pattern) => !/<\s*script\b/i.test(pattern.code),
  );
  const patternsBlock =
    promptPatterns.length > 0
      ? `\n\n### Patterns\n\n${promptPatterns
          .map((p) => `**${p.name}:**\n\`\`\`ts\n${p.code.trim()}\n\`\`\``)
          .join('\n\n')}`
      : '';
  const hostBridgeBlock = `### Host tool bridge

Generated custom scripts are not supported. Do not emit \`<script>\` tags. All behavior lives in the Arrow entry module you return as \`main.ts\` or \`main.js\`.

Use Arrow \`reactive()\` state for local UI state, Arrow event handlers for clicks/submits/input, and the \`host-bridge:summon\` virtual module for host state and tools. Do not use \`window.sandbox\`, direct DOM listeners, timers, storage, or native bridges. If a requested behavior cannot be expressed with Arrow plus the granted tools, leave that control out or state the limitation in the UI.`;

  const actionWiring = 'by calling `await callTool("<tool>", args)` from an Arrow event handler';
  const toolNames = new Set(pack.tools.map((tool) => tool.name));
  const examples: string[] = [];
  if (toolNames.has('counter')) {
    examples.push(`// Counter: Arrow event handlers + host state sync
import { html, reactive } from "@arrow-js/core";
import { callTool, onState } from "host-bridge:summon";

const state = reactive({ count: 0 });
onState((hostState) => {
  state.count = Number(hostState.count ?? state.count ?? 0);
});

async function change(delta: number) {
  const result = await callTool("counter", { delta });
  if (result.ok) state.count = Number(result.state.count ?? state.count);
}

export default html\`
  <button @click="\${() => change(-1)}" aria-label="Decrease">-</button>
  <output>\${() => state.count}</output>
  <button @click="\${() => change(1)}" aria-label="Increase">+</button>
\`;`);
  }
  if (toolNames.has('submit')) {
    examples.push(`// Form: collect an event snapshot, callTool the host, render host-owned state
import { html, reactive } from "@arrow-js/core";
import { callTool, onState } from "host-bridge:summon";

const state = reactive({ submitted: false, submitError: "" });
onState((hostState) => {
  state.submitted = Boolean(hostState.submitted);
  state.submitError = String(hostState.submitError ?? "");
});

async function save(event: SubmitEvent) {
  event.preventDefault();
  const form = event.currentTarget as HTMLFormElement;
  const fields = Object.fromEntries(new FormData(form).entries());
  const result = await callTool("submit", fields);
  state.submitted = Boolean(result.state.submitted);
  state.submitError = String(result.state.submitError ?? result.error ?? "");
}

export default html\`
  <form @submit="\${save}">
    <input name="title" placeholder="Title">
    <input name="notes" placeholder="Notes">
    <button>Save</button>
  </form>
  <p>\${() => state.submitted ? "Saved." : ""}</p>
  <p>\${() => state.submitError}</p>
\`;`);
  }
  if (toolNames.has('log')) {
    examples.push(`// Result row: pass the selected item through an Arrow handler
import { html, reactive } from "@arrow-js/core";
import { callTool, onState } from "host-bridge:summon";

const state = reactive({ results: [] as Array<{ title: string; snippet: string }> });
onState((hostState) => {
  state.results = Array.isArray(hostState.results) ? hostState.results : [];
});

async function pick(result: { title: string; snippet: string }) {
  await callTool("log", { payload: { picked: result } });
}

export default html\`
  <ul>
    \${() => state.results.map((result) => html\`
      <li @click="\${() => pick(result)}">
        <strong>\${result.title}</strong>
        <span>\${result.snippet}</span>
      </li>
    \`)}
  </ul>
\`;`);
  }
  const examplesBlock = examples.length > 0
    ? `\n\n**Examples:**\n\n\`\`\`ts\n${examples.join('\n\n')}\n\`\`\``
    : '';

  return `## Tools — this generation is INTERACTIVE

**Arrow-native interactivity.** Generated surfaces run as Arrow artifacts. Use Arrow \`reactive()\` for state, Arrow event handlers for user input, and \`host-bridge:summon\` for host tools and host-pushed state.

Do NOT build CSS-only state machines using \`:has()\`, \`:checked\` sibling selectors, \`<details>\` chained to other elements, or \`:target\` URL hash tricks for state. Use Arrow state and handlers instead.

### Host bridge

Import the bridge in your Arrow entry file:

\`\`\`ts
import { callTool, getState, onState } from "host-bridge:summon";
\`\`\`

- \`await callTool(toolName, args)\` calls a granted host tool and resolves to \`{ ok, state, error? }\`.
- \`await getState()\` reads the latest host-owned state snapshot.
- \`onState((state) => { ... })\` subscribes to host \`pushState()\` updates and returns an unsubscribe function.
- Copy host-owned keys into your Arrow \`reactive()\` object from \`getState()\`, \`onState()\`, and successful \`callTool()\` results.

### Available tools

${toolSections}

${examplesBlock}

${hostBridgeBlock}

### The interactivity contract — READ THIS

**Every clickable, tappable, or focusable element in your generated UI MUST be wired to one of the declared tools — ${actionWiring}. If you cannot wire an element, do not show it.**

- No button unless you've decided which tool it fires.
- No clickable result tiles, rows, or cards unless clicking them emits something.
- No pagination, no sorting, no filtering controls unless you've decided which tool they fire.

Dead buttons are worse than no buttons. When in doubt, leave it out.

Only the tools listed above exist. Any concept that isn't in the tool list does not exist — don't add controls that imply tools you don't have. When in doubt, route the user-visible action through the closest matching tool or drop the control.

Data resources expose host-owned loading/data/error state keys and may expose an empty-state key. Use \`mount\` only for initial read-oriented loads granted by the resource; use \`submit\` for forms and \`click\` only when the resource grants a click trigger. Mirror the listed loading key for busy UI, error key for host errors, data key for validated result data, and empty key only for real no-results copy after a successful host result.

Default data is real host state. A data resource starts at \`{loading:false, data:defaultData ?? null, error:null, empty:false when declared}\`, and loading/error/invalid-result states keep the data value at \`defaultData ?? null\` with \`empty:false\`. Never hallucinate fetched rows, profiles, images, or counts before a successful data resource result. Render array rows from the host data key only after it exists. Render "no results" from the declared empty key, not from missing or pre-load data.

Controlled actions expose host-owned pending/done/error keys when listed under Action state. Use \`pending\` to disable or mark the triggering control busy, show \`error\` as host failure text, and show \`done\` only for useful success confirmation. Do not fake completed, approved, or failed states in local markup.

### Initial state

Action-owned state starts empty unless the host declares controlled action state, in which case pending/done/error start false/false/null. Data-resource lifecycle keys start from the default state described above. Render defensively: show an empty-state message only from declared empty state or a form before data exists, never placeholder fetched data.${patternsBlock}`;
}

function buildHtmlToolsBlock({
  outputRuntime,
  toolSections,
}: {
  outputRuntime: SummonOutputRuntime;
  toolSections: string;
}): string {
  return `## Tools — host-owned context for static HTML

This run returns a structured HTML/CSS bundle for \`${outputRuntime}\`. The generated artifact does not receive a host tool bridge in this runtime, so do not call tools, include scripts, or render controls that imply live host actions.

### Available host context

${toolSections}

### Static HTML contract

- Use the tool descriptions only to understand the task boundary, data authority, and actions the host owns.
- Do not render clickable, tappable, or focusable controls that require host execution.
- Do not fake tool results, loading states, completed actions, approvals, or fetched rows in static markup.
- If the user request needs live data or a host action, render a clear static state that explains what the host-owned action/data would cover without pretending it has run.`;
}

function normalizeTriggers(tool: ToolSpec): ToolTrigger[] {
  if (tool.triggers?.length) return tool.triggers;
  return defaultTriggersForKind(tool.kind ?? 'action');
}

function formatStateKeys(keys: ToolStateKeys): string {
  const parts: string[] = [];
  if (keys.loading) parts.push(`loading=${keys.loading}`);
  if (keys.data) parts.push(`data=${keys.data}`);
  if (keys.error) parts.push(`error=${keys.error}`);
  if (keys.empty) parts.push(`empty=${keys.empty}`);
  return parts.length ? parts.join(', ') : 'none';
}

function formatActionStateKeys(keys: ActionStateKeys): string {
  return `pending=${keys.pending}, done=${keys.done}, error=${keys.error}`;
}

function formatSurface(surface: ToolSurface): string {
  const parts: string[] = [];
  if (surface.data) parts.push(`data=${surface.data}`);
  if (surface.authority) parts.push(`authority=${surface.authority}`);
  return parts.length ? parts.join(', ') : 'default';
}
