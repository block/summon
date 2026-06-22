/**
 * System prompt builder. Split into two layers so Anthropic prompt caching works:
 *
 *   [fixed instructions]          ← stable across all directions, long-lived cache
 *   [direction prompt + exemplars] ← per-direction, per-direction cache entry
 *
 * Pass both to the SDK as separate `system` text blocks with `cache_control`.
 */

import { formatTokenContract } from './token-contract.js';
import type { DirectionOpts } from './direction-validator.js';
import {
  type ActionStateKeys,
  defaultTriggersForKind,
  type ToolKind,
  type ToolStateKeys,
  type ToolTrigger,
  type ResourceStateKeys,
} from './tool-contract.js';
import type { SurfaceContractView } from './surface-contract.js';
import type { ToolSurface } from './surface-plan.js';

export interface Exemplar {
  name: string;
  content: string;
  /** atom = vocabulary primitive (button, badge, list-row), ship verbatim.
   *  reference = larger composition/material sample from the design source. */
  kind?: 'atom' | 'reference';
}

export interface DirectionInput {
  /** Markdown contents of the direction's prompt.md — Character/Signature/Decisions. */
  prompt: string;
  /** Hand-translated HTML exemplars. Atoms and references all ship; Summon no
   *  longer filters examples through generic response shapes. */
  exemplars: Exemplar[];
  /** Per-family opt-outs from meta.json (e.g., shadows: 'none'). */
  opts?: DirectionOpts;
  /** Legacy compatibility field; no Summon-owned opportunistic token slots exist. */
  liveOpportunistic?: string[];
  /** Host-supplied slot contract for this generation. When present, style
   *  exemplars are visual references only; the host layout owns structure. */
  layout?: SummonLayout | null;
}

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

/**
 * The stable, cacheable prefix. Output format, Arrow/CSS rules, token vocabulary policy.
 * No design direction — that lives in the per-direction block below so changing
 * directions doesn't invalidate this cache entry.
 *
 * The token-vocabulary paragraph intentionally contains no Summon-owned token
 * names. Concrete active tokens are listed by Ghost/direction prompt blocks.
 */
export const SUMMON_FIXED_INSTRUCTIONS = `You generate self-contained Arrow web UIs for the Summon rendering engine.

## Your job — interpret the request, then design the response

The user types a request in natural language: "help me plan...", "I want to...", "can you compare...", "explain how...". Your job is to settle on a rich composition that actually helps, then render it as an Arrow artifact.

Pick the composition that fits the request. Do not default to one visual pattern. Examples of possible structural approaches:

- **Plan / itinerary** — staged narrative, timeline, route, calendar, or numbered walkthrough.
- **Comparison / decision** — table, matrix, split view, scorecard, annotated verdict, or pros/cons only when useful.
- **Explainer / summary** — readable article, field guide, pull quotes, marginal notes, or TL;DR with deeper sections.
- **Tracker / dashboard** — dominant number, progress rail, status map, chart, ledger, or compact stats only when the user asked for metrics.
- **Recommendation** — focused brief, poster, memo, ranked list, or one composed spread with reasoning.
- **Reflection / worksheet** — guided prompts, stepped entries, rubric, checklist, journal, or fill-in plan.
- **Operational view** — queue, table, kanban-like lanes, timeline, incident log, roster, checklist, or command strip.

Before using a card grid, ask what job the boxes are doing. Use cards when the content is truly a set of separate comparable objects, selectable choices, or repeated records with distinct evidence. If most groups would become anonymous rounded boxes, redesign as an article, table, timeline, checklist, matrix, ledger, map, split view, or typographic composition instead.

**Resist the default "big header + cards + footer".** That is one pattern among many. Pick what the specific tool actually needs. A research explainer probably wants body copy with headings, not an eyebrow-and-headline box. A tracker wants a dominant signal and supporting structure, not a title over tiles. A recommendation might be one self-contained brief with no header.

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
- Do not use Arrow IDL property bindings such as .value=, .checked=, .selected=, or .disabled=; this Summon sandbox subset rejects them until compatibility is verified.
- Do not inject standalone expressions inside opening tags to create dynamic attributes. Never write \`<button \${() => "disabled"}>\` or \`<section \${dynamicAttrs}>\`; write named, quoted attributes such as \`disabled="\${() => state.loading}"\`, \`class="\${() => state.active ? 'active' : ''}"\`, or move expressions between tags for content.
- For host actions and resources, import from host-bridge:summon and call await callTool(toolName, args) for granted host tools only.
- Use await getState() and onState((state) => ...) to read host-pushed state.
- Do not use window, document, localStorage, cookies, direct DOM refs, external imports, timers, native bridges, or external URLs.
- Use fetch() only when the Surface plan network is restricted-fetch; otherwise use host tools.

## Arrow/CSS rules

- Use plain semantic HTML inside Arrow templates.
- Put visual styling in \`main.css\`; use class names, not generated inline style strings, for major layout.
- No external URLs. No external images, no external fonts, no external stylesheets. Inline SVG is fine.
- Use the active Ghost fingerprint tokens and any fingerprint-provided renderable primitives as the visual source of truth. Prefer CSS custom properties for colors, spacing, radii, and type, but local CSS aliases, calc()/clamp(), responsive units, safe transitions/transforms, inline SVG, and literal values copied from fingerprint tokens or renderable examples are allowed. Do not introduce unrelated colors, fonts, shadows, gradients, radii, external assets, or decorative motifs.

## Token contract

${formatTokenContract()}

The direction block specifies which tokens carry particular meaning for that direction and how to deploy them.

## Content quality

- Be specific. Real names ("Sarah Chen", "Marcus Johnson"), real amounts ("$4,280.50"), real dates ("Mar 14"), real places. Never "Lorem ipsum", "Item 1/2/3", or "Title goes here".
- Be direct. No hedging, no "here's your…" preambles. The UI itself is the answer.
- 3–5 items in lists. One is too few; eight is too many.
- Lead with the most useful thing. Don't bury the answer under chrome.
- Let the content determine its native structure: comparisons want tables or matrices, sequences want timelines, procedures want checklists, money wants ledgers, explanations want reading rhythm, and decisions want a clear verdict.

## How to think about this generation

Decide your section structure and styling approach before the final artifact. Use preview events to reveal that decision progressively, then commit to it in the artifact. If a constraint blocks the obvious approach (e.g. a control needs interactivity but you have no Tools block), state the constraint in one short line of copy inside the UI ("Static preview — pick functionality requires interactive mode") and use the simplest static alternative. Do not invent CSS-only state machines, \`:has()\` selector tricks, sibling-checked toggles, or \`<details>\` chains to simulate interactivity that the rules forbid. A static answer that names its limitation is better than an elaborate workaround.

Pick one structural approach and ship it. Preview events should make the UI feel like it is coming into focus; the final artifact should not contradict them.

Begin. Return one complete structured Arrow bundle through the provided tool/schema.`;

export const SUMMON_STRUCTURED_ARROW_BUNDLE_INSTRUCTIONS = `## Structured Arrow sandbox bundle

You are creating an Arrow sandbox payload for Summon. Return a structured object through the provided \`create_summon_arrow_surface\` tool/schema. Do not write Markdown, code fences, transport records, stream lines, objects with \`op\`/\`path\` fields, or host-owned meta paths.

The returned object must include:

- \`schema: "summon.arrow-bundle/v1"\`
- \`source\` with exactly one \`main.ts\` or \`main.js\` entry file
- optional \`main.css\` for all visual styling
- optional compact \`preview\` describing the surface kind, title, and regions

The server owns streaming, preview events, validation summaries, and artifact delivery. You only author the sandbox source files and optional preview description.

Arrow bundle rules:

- Import Arrow primitives from \`@arrow-js/core\`; do not rely on ambient globals. Use only \`html\`, \`reactive\`, \`component\`, \`props\`, \`pick\`, \`watch\`, \`onCleanup\`, and \`nextTick\`.
- The default export from the entry file must be an Arrow template or component result.
- Use \`reactive()\` for local state and wrap live reads as functions, such as \`\${() => state.count}\`.
- Use quoted Arrow event and attribute bindings, such as \`@click="\${() => state.count++}"\` and \`disabled="\${() => state.loading}"\`.
- For boolean attributes, return \`false\` to remove the attribute rather than injecting a bare attribute string.
- Do not use Arrow IDL property bindings such as \`.value=\`, \`.checked=\`, \`.selected=\`, or \`.disabled=\`; this Summon sandbox subset rejects them until compatibility is verified.
- Do not inject standalone expressions inside opening tags to create dynamic attributes. Never write \`<button \${() => "disabled"}>\` or \`<section \${dynamicAttrs}>\`; write named, quoted attributes such as \`disabled="\${() => state.loading}"\`, \`class="\${() => state.active ? 'active' : ''}"\`, or move expressions between tags for content.
- For host actions and resources, import from \`host-bridge:summon\` and call \`await callTool(toolName, args)\` for granted host tools only.
- Use \`await getState()\` and \`onState((state) => { ... })\` to read host-pushed state.
- Do not use \`window\`, \`document\`, localStorage, cookies, direct DOM refs, external imports, timers, native bridges, external URLs, external images, external fonts, or external stylesheets.
- Use \`fetch()\` only when the Surface plan network is \`restricted-fetch\`; otherwise use host tools.
- Use plain semantic HTML inside Arrow templates.
- Put visual styling in \`main.css\`; use class names, not generated inline style strings, for major layout.
- Use the active Ghost fingerprint tokens and any fingerprint-provided renderable primitives as the visual source of truth. Prefer CSS custom properties for colors, spacing, radii, and type, but local CSS aliases, calc()/clamp(), responsive units, safe transitions/transforms, inline SVG, and literal values copied from fingerprint tokens or renderable examples are allowed. Do not introduce unrelated colors, fonts, shadows, gradients, radii, external assets, or decorative motifs.

Return a complete structured bundle. The run is incomplete until the bundle contains a valid Arrow entry file.`;

/**
 * Compose the direction-specific block that follows the fixed instructions:
 *
 *   1. The direction's `prompt.md` (Character/Signature/Decisions prose).
 *   2. A "## This direction" addendum that surfaces structured facts the
 *      active design-source details.
 *   3. The "## Style Reference" exemplar block.
 */
export function buildDirectionBlock(input: DirectionInput): string {
  const parts: string[] = [input.prompt.trim()];

  const addendum = buildDirectionAddendum(input.opts, input.liveOpportunistic);
  if (addendum) parts.push(`\n\n${addendum}`);

  const atoms = input.exemplars.filter((e) => e.kind === 'atom');
  const references = input.exemplars.filter((e) => e.kind !== 'atom');

  if (atoms.length > 0) {
    parts.push('\n\n## Vocabulary');
    parts.push(
      'These are direct quotes — the design language\'s atomic vocabulary. When you need a primary button, a badge, a text input, or a list row in your output, copy the exact markup and only change the text content. Do NOT restyle (do not change padding, radius, font weight, or color tokens) — the variance is the bug, not the feature. If a variant is needed (secondary button, danger badge), the exemplar shows that variant inline.'
    );
    for (const ex of atoms) {
      parts.push(`\n\n### ${ex.name}\n\n\`\`\`html\n${ex.content.trim()}\n\`\`\``);
    }
  }

  if (references.length > 0) {
    parts.push('\n\n## Style Reference');
    if (input.layout) {
      parts.push(
        `The host has supplied the **${input.layout.id}** layout for this generation. Use these examples only for visual language — spacing rhythm, typography, color usage, borders, and emphasis. Do NOT copy their section structure; the host layout block owns the allowed slots.`
      );
    } else {
      parts.push(
        'These are hand-crafted snippets demonstrating the design language. Study their spacing rhythm, typography, color usage, borders, hierarchy, and emphasis. They are not generic templates; let the selected design source, user request, host policy, and any Ghost composition refs determine the final structure.'
      );
    }
    for (const ex of references) {
      parts.push(`\n\n### ${ex.name}\n\n\`\`\`html\n${ex.content.trim()}\n\`\`\``);
    }
  }

  return parts.join('\n');
}

/**
 * Host layout — an optional per-generation slot contract. The model owns the
 * Arrow composition while honoring the host's semantic regions.
 */
export function buildLayoutBlock(layout: SummonLayout): string {
  const slotLines = layout.slots
    .map((slot) => `- \`${slot.id}\` — ${slot.purpose}`)
    .join('\n');

return `## Host layout — this generation

The host has supplied a strict layout contract named **${layout.id}**. Build your Arrow artifact so its visible composition has these semantic regions, in this order:

${slotLines}

Rules:

- Use each slot for its purpose.
- Do not invent page chrome or alternate slot names that obscure the layout.
- Do not emit transport records or stream lines such as \`set /screen\`, \`add /section/*\`, \`/surface-plan\`, or \`/artifact\`; the server owns the stream.
- The host layout controls semantic order; the direction controls visual language.`;
}

export function buildSurfaceContractBlock(contract: SurfaceContractView): string {
  const { surface } = contract;
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

This is a compact, read-only view of the host-selected \`SurfacePolicy\`. It tells you what this generated surface can do. It is not a JSON UI schema: you still generate a rich Arrow source artifact inside these typed boundaries.

Do not emit \`/surface-contract\`, \`/surface-policy\`, or \`/surface-plan\` meta lines. The host owns those lines and enforcement still lives in the runtime validators, PolicyEngine, and inline Arrow tool grants.

### Surface

- Policy: tier=\`${surface.policy.tier}\`, purpose=\`${surface.policy.purpose}\`, persistence=\`${surface.policy.persistence}\`
- Plan: purpose=\`${surface.plan.purpose}\`, runtime=\`${surface.plan.runtime}\`, data=\`${surface.plan.data}\`, authority=\`${surface.plan.authority}\`, persistence=\`${surface.plan.persistence}\`
- Mode: \`${surface.mode}\`

### Tools

${toolLines}

### Host layout

${layoutLines}

### Compile issues

${issueLine}`;
}

function buildDirectionAddendum(
  _opts: DirectionOpts | undefined,
  _liveOpportunistic: string[] | undefined
): string {
  return '';
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

  const promptPatterns = (pack.patterns ?? []).filter(
    (pattern) =>
      !/<\s*script\b/i.test(pattern.code) &&
      !/\bdata-summon-(?!(?:component|component-id|props)\b)[a-z0-9-]+/i.test(pattern.code),
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
