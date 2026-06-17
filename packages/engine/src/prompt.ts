/**
 * System prompt builder. Split into two layers so Anthropic prompt caching works:
 *
 *   [fixed instructions]          ← stable across all directions, long-lived cache
 *   [direction prompt + exemplars] ← per-direction, per-direction cache entry
 *
 * Pass both to the SDK as separate `system` text blocks with `cache_control`.
 */

import { formatTokenContract, OPT_OUT_GROUPS } from './token-contract.js';
import type { DirectionOpts } from './direction-validator.js';
import {
  type ActionStateKeys,
  defaultTriggersForKind,
  type CapabilityKind,
  type CapabilityStateKeys,
  type CapabilityTrigger,
  type ResourceStateKeys,
} from './capability-contract.js';
import type { SurfaceContractView } from './surface-contract.js';
import type { ComponentSurface, CapabilitySurface } from './surface-plan.js';

export interface Exemplar {
  name: string;
  content: string;
  /** atom = vocabulary primitive (button, badge, list-row), ship verbatim.
   *  shape = composition template (article, card, comparison, tracker) — the
   *  visual layout anchor the design direction targets.
   *  Defaults to 'shape' for backwards compatibility with untagged exemplars.
   *
   *  Distinct from posture: `shape` describes the visual template (driven by
   *  an upstream classifier, anchors exemplar selection); posture describes
   *  the behavioral act the host wants the generation to perform
   *  (tap/brief/detailed/canvas), declared by the LLM on a `/posture`
   *  meta-line, enforced by the host. The LLM picks a posture within a shape
   *  the same way it picks an intent within a capability pack. */
  kind?: 'atom' | 'shape';
  /** For shape exemplars — the response shape this exemplar represents. The
   *  classifier emits a shape per generation; only the matching exemplar(s)
   *  ship in the per-direction prompt. */
  shape?: string;
}

export interface DirectionInput {
  /** Markdown contents of the direction's prompt.md — Character/Signature/Decisions. */
  prompt: string;
  /** Hand-translated HTML exemplars. Atoms always ship; shape exemplars are
   *  filtered by `shape` when provided. */
  exemplars: Exemplar[];
  /** Per-family opt-outs from meta.json (e.g., shadows: 'none'). */
  opts?: DirectionOpts;
  /** Opportunistic spacing slots actually defined by this direction
   *  (`space-7`..`space-12`). Listed so the model knows which to use. */
  liveOpportunistic?: string[];
  /** Inferred response shape for THIS generation. When set, only shape
   *  exemplars matching this name ship — atoms always ship regardless.
   *  Untagged exemplars (kind=shape, shape=undefined) ship as fallback when
   *  no specific match is found, so legacy direction folders still work. */
  shape?: string | null;
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
 * The stable, cacheable prefix. Output format, Arrow/CSS rules, token contract.
 * No design direction — that lives in the per-direction block below so changing
 * directions doesn't invalidate this cache entry.
 *
 * The token-contract paragraph is generated from `token-contract.ts` so the
 * prompt can never drift from the schema directions are validated against.
 */
export const SUMMON_FIXED_INSTRUCTIONS = `You generate self-contained Arrow web UIs for the Summon rendering engine.

## Your job — interpret intent, then design the response

The user types a request in natural language: "help me plan...", "I want to...", "can you compare...", "explain how...". Your job is to settle on a rich composition that actually helps, then render it as an Arrow artifact.

Pick the composition that fits the intent. Cards are only one option, not the default. Examples:

- **Plan / itinerary** — staged narrative, timeline, route, calendar, or numbered walkthrough.
- **Comparison / decision** — table, matrix, split view, scorecard, annotated verdict, or pros/cons only when useful.
- **Explainer / summary** — readable article, field guide, pull quotes, marginal notes, or TL;DR with deeper sections.
- **Tracker / dashboard** — dominant number, progress rail, status map, chart, ledger, or compact stats only when the user asked for metrics.
- **Recommendation** — focused brief, poster, memo, ranked list, or one composed spread with reasoning.
- **Reflection / worksheet** — guided prompts, stepped entries, rubric, checklist, journal, or fill-in plan.
- **Operational view** — queue, table, kanban-like lanes, timeline, incident log, roster, checklist, or command strip.

Before using a card grid, ask what job the boxes are doing. Use cards when the content is truly a set of separate comparable objects, selectable choices, or repeated records with distinct evidence. If most groups would become anonymous rounded boxes, redesign as an article, table, timeline, checklist, matrix, ledger, map, split view, or typographic composition instead.

**Resist the default "big header + cards + footer".** That is one shape among many. Pick what the specific intent actually needs. A research explainer probably wants body copy with headings, not an eyebrow-and-headline box. A tracker wants a dominant signal and supporting structure, not a title over tiles. A recommendation might be one self-contained brief with no header.

## Output protocol — Arrow JSONL only

Emit exactly one JSON object on one physical line. No markdown fences, no prose, no headings, no commentary. The line must be valid JSON.

Emit exactly this shape with real source strings:

{"op":"artifact","path":"/artifact","value":{"runtime":"arrow","source":{"main.ts":"...","main.css":"..."}}}

Rules:

- The \`value.runtime\` must be \`"arrow"\`.
- \`source\` must contain exactly one entry file: \`main.ts\` or \`main.js\`.
- \`main.css\` is optional and should contain all visual styling.
- The default export from \`main.ts\` must be an Arrow template.
- Import Arrow primitives from \`@arrow-js/core\`; do not rely on ambient globals. Use only \`html\`, \`reactive\`, \`component\`, \`props\`, \`pick\`, \`onCleanup\`, and \`nextTick\`.
- Do not use Arrow IDL property bindings such as \`.value=\`, \`.checked=\`, \`.selected=\`, or \`.disabled=\`; this sandbox does not support them. Use normal HTML attributes like \`value=\` and read form input through event snapshots such as \`event.target.value\`.
- Do not inject standalone expressions inside opening tags to create dynamic attributes. Expressions must be text nodes, child nodes, or quoted attribute values.
- Bad: \`<button \${() => state.loading ? "disabled" : ""}>Search</button>\`. Good: \`<button class="\${() => state.loading ? "loading" : ""}">\${() => state.loading ? "Searching..." : "Search"}</button>\`.
- For host actions and resources, import from \`host-bridge:summon\`:

\`\`\`ts
import { invoke, getState, onState } from "host-bridge:summon"
\`\`\`

- Call \`await invoke(intentName, args)\` for granted host capabilities. The result is \`{ ok, state, error? }\`.
- Call \`await getState()\` to read the latest host-pushed state.
- Call \`onState((state) => { ... })\` to keep Arrow \`reactive()\` state synchronized with host pushes. It returns an unsubscribe function.
- Do not use \`window\`, \`document\`, localStorage, cookies, direct DOM refs, external imports, or native bridges.
- Use \`fetch()\` only when the Surface plan network is \`restricted-fetch\`; otherwise use host capabilities.
- Do not emit \`set /screen\`, \`add /section/*\`, unsupported binding attributes, scripts, host-owned meta lines, HTML fragments, or multiple lines. The only prefixed attributes allowed in Arrow source are \`data-summon-component\`, \`data-summon-component-id\`, and \`data-summon-props\` from the Component islands block.
- Keep the JSONL line on one physical line. Escape newlines inside source strings as \`\\n\`.

## Arrow/CSS rules

- Use plain semantic HTML inside Arrow templates.
- Put visual styling in \`main.css\`; use class names, not generated inline style strings, for major layout.
- No external URLs. No external images, no external fonts, no external stylesheets. Inline SVG is fine.
- Use CSS custom properties for every color, space, radius, and type size. Do not hardcode hex colors, rgb(), pixel spacing, or specific font stacks.

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

Decide your section structure and your styling approach BEFORE you start emitting. Once you've started emitting, commit. Don't re-evaluate selectors, layout primitives, color tokens, or section names mid-generation. If a constraint blocks the obvious approach (e.g. a control needs interactivity but you have no Capabilities block), state the constraint in one short line of copy inside the UI ("Static preview — pick functionality requires interactive mode") and use the simplest static alternative. Do not invent CSS-only state machines, \`:has()\` selector tricks, sibling-checked toggles, or \`<details>\` chains to simulate interactivity that the rules forbid. A static answer that names its limitation is better than an elaborate workaround.

Pick one structural approach and ship it. Reconsidering mid-stream is the wrong move — the user sees a half-rendered UI and a frozen status.

Begin. Emit exactly one Arrow artifact JSONL line.`;

export const SUMMON_ARROW_ARTIFACT_INSTRUCTIONS = `## Arrow sandbox artifact output

This block is the output contract for Summon Arrow runtimes.

Your entire response must be exactly one JSONL line. Do not wrap it in Markdown. Do not add prose before or after it. Do not emit code fences. Do not emit \`set /screen\`, \`add /section/*\`, or any other line.

Emit exactly this shape with real source strings:

{"op":"artifact","path":"/artifact","value":{"runtime":"arrow","source":{"main.ts":"...","main.css":"..."}}}

Rules:

- The \`value.runtime\` must be \`"arrow"\`.
- \`source\` must contain exactly one entry file: \`main.ts\` or \`main.js\`.
- \`main.css\` is optional and should contain all visual styling.
- The default export from \`main.ts\` must be an Arrow template.
- Import Arrow primitives from \`@arrow-js/core\`; do not rely on ambient globals. Use only \`html\`, \`reactive\`, \`component\`, \`props\`, \`pick\`, \`onCleanup\`, and \`nextTick\`.
- Do not use Arrow IDL property bindings such as \`.value=\`, \`.checked=\`, \`.selected=\`, or \`.disabled=\`; this sandbox does not support them. Use normal HTML attributes like \`value=\` and read form input through event snapshots such as \`event.target.value\`.
- Do not inject standalone expressions inside opening tags to create dynamic attributes. Expressions must be text nodes, child nodes, or quoted attribute values.
- Bad: \`<button \${() => state.loading ? "disabled" : ""}>Search</button>\`. Good: \`<button class="\${() => state.loading ? "loading" : ""}">\${() => state.loading ? "Searching..." : "Search"}</button>\`.
- For host actions and resources, import from \`host-bridge:summon\`:

\`\`\`ts
import { invoke, getState, onState } from "host-bridge:summon"
\`\`\`

- Call \`await invoke(intentName, args)\` for granted host capabilities. The result is \`{ ok, state, error? }\`.
- Call \`await getState()\` to read the latest host-pushed state.
- Call \`onState((state) => { ... })\` to keep Arrow \`reactive()\` state synchronized with host pushes. It returns an unsubscribe function.
- Do not use \`window\`, \`document\`, localStorage, cookies, direct DOM refs, external imports, or native bridges.
- Use \`fetch()\` only when the Surface plan network is \`restricted-fetch\`; otherwise use host capabilities.
- Do not emit \`set /screen\`, \`add /section/*\`, unsupported binding attributes, scripts, or host-owned meta lines. The only prefixed attributes allowed in Arrow source are \`data-summon-component\`, \`data-summon-component-id\`, and \`data-summon-props\` from the Component islands block.
- Keep every JSONL line on one physical line. Escape newlines inside source strings as \`\\n\`.`;

/**
 * Compose the direction-specific block that follows the fixed instructions:
 *
 *   1. The direction's `prompt.md` (Character/Signature/Decisions prose).
 *   2. A "## This direction" addendum that surfaces structured facts the
 *      generic token contract can't express on its own — opt-outs from
 *      shadow vocabulary, which opportunistic spacing slots are live, etc.
 *   3. The "## Style Reference" exemplar block.
 */
export function buildDirectionBlock(input: DirectionInput): string {
  const parts: string[] = [input.prompt.trim()];

  const addendum = buildDirectionAddendum(input.opts, input.liveOpportunistic);
  if (addendum) parts.push(`\n\n${addendum}`);

  const atoms = input.exemplars.filter((e) => e.kind === 'atom');
  const shapes = input.exemplars.filter((e) => e.kind !== 'atom');
  const shapeExemplars = pickShapeExemplars(shapes, input.shape ?? null);

  if (atoms.length > 0) {
    parts.push('\n\n## Vocabulary');
    parts.push(
      'These are direct quotes — the design language\'s atomic vocabulary. When you need a primary button, a badge, a text input, or a list row in your output, copy the exact markup and only change the text content. Do NOT restyle (do not change padding, radius, font weight, or color tokens) — the variance is the bug, not the feature. If a variant is needed (secondary button, danger badge), the exemplar shows that variant inline.'
    );
    for (const ex of atoms) {
      parts.push(`\n\n### ${ex.name}\n\n\`\`\`html\n${ex.content.trim()}\n\`\`\``);
    }
  }

  if (shapeExemplars.length > 0) {
    parts.push('\n\n## Style Reference');
    if (input.layout) {
      parts.push(
        `The host has supplied the **${input.layout.id}** layout for this generation. Use these examples only for visual language — spacing rhythm, radii, typography, color usage, borders, and emphasis. Do NOT copy their section structure; the host layout block owns the allowed slots.`
      );
    } else if (input.shape && shapeExemplars.length === 1 && shapeExemplars[0]!.shape === input.shape) {
      parts.push(
        `The user's intent reads as a **${input.shape}** response. Use this composition as a visual starting point — replace the content (titles, copy, numbers, bullet text) with the user's data, and preserve the relevant visual moves: borders, typography rhythm, spacing between groups, and emphasis patterns. Host-supplied contracts, layouts, allowed intents, and surface constraints override exemplar structure. The point is to land on this design language fast, not to reinvent it.`
      );
    } else {
      parts.push(
        'These are hand-crafted HTML snippets demonstrating the design language across response shapes. Study their spacing rhythm, radii, typography, and color usage — match the same patterns when emitting your own HTML. They are not templates to copy; they show how the design language *feels* across articles, comparisons, trackers, focused recommendations, and other compositions.'
      );
    }
    for (const ex of shapeExemplars) {
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
- Do not emit \`set /screen\` or \`add /section/*\`; the output is still exactly one Arrow \`/artifact\` JSONL line.
- The host layout controls semantic order; the direction controls visual language.`;
}

/**
 * Picks the shape exemplars to ship for this generation.
 *
 *   - shape provided AND a matching exemplar exists → just that exemplar
 *   - shape provided BUT no match → all shape exemplars (better than nothing)
 *   - shape null/undefined → all shape exemplars (legacy behavior)
 *
 * Untagged exemplars (kind=shape, shape=undefined) fall through into the
 * "all shapes" path and ship as anchors.
 */
function pickShapeExemplars(shapes: Exemplar[], shape: string | null): Exemplar[] {
  if (!shape) return shapes;
  const match = shapes.find((e) => e.shape === shape);
  if (match) return [match];
  return shapes;
}

/**
 * Token overrides — when a host (embedder) brand-shifts a direction at spawn
 * time, this block tells the model what changed so the prose it writes
 * matches what's actually rendering. Without it, the direction's prompt may
 * still assert "accent is achromatic" while the iframe paints saturated
 * indigo, and the copy drifts from the visual.
 *
 * Pass as an additional cacheable system block when overrides are present.
 * Cache key naturally splits per unique override set — that's the cost of
 * doing per-tenant brand overrides; the first three blocks still cache.
 */
export interface TokenOverride {
  /** Token name without the leading `--`. */
  token: string;
  /** Value from the direction's own tokens.css before override. */
  baseValue: string;
  /** Host-supplied replacement value. */
  newValue: string;
}

export function buildOverrideBlock(overrides: TokenOverride[]): string {
  if (overrides.length === 0) return '';
  const lines: string[] = [];
  lines.push('## Token overrides — this generation');
  lines.push('');
  lines.push(
    'For THIS specific generation, the host has overridden these tokens from the direction defaults. The direction prose above describes the *baseline* design language — these overrides are deliberate brand-shifts on top of it. Honor them when emitting copy and visual emphasis:',
  );
  lines.push('');
  for (const o of overrides) {
    if (o.baseValue === o.newValue) continue;
    lines.push(
      `- \`--${o.token}\`: was \`${o.baseValue}\`, now \`${o.newValue}\`. Treat surfaces using this token as deliberate brand moments. If the direction prose says "use this token sparingly", apply that rule to *frequency* (one accent surface per composition), not to the new value's visual weight.`,
    );
  }
  lines.push('');
  lines.push(
    'All other rules from the direction (radii, type, shadows, spacing, voice) still apply unchanged.',
  );
  return lines.join('\n');
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
  const componentLines = contract.components.length
    ? contract.components.map((component) => {
        const sizing = component.sizing
          ? `; sizing ${[
              component.sizing.width ? `width=${component.sizing.width}` : '',
              component.sizing.height ? `height=${component.sizing.height}` : '',
              component.sizing.description ?? '',
            ].filter(Boolean).join(', ')}`
          : '';
        return `- \`${component.name}\` — ${component.description} Props: \`${component.propsSchema}\`; surface data=${component.surface.data}, authority=${component.surface.authority}${sizing}`;
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

Do not emit \`/surface-contract\`, \`/surface-policy\`, or \`/surface-plan\` meta lines. The host owns those lines and enforcement still lives in the runtime validators, PolicyEngine, sandbox grants, and component prop validation.

### Surface

- Policy: tier=\`${surface.policy.tier}\`, purpose=\`${surface.policy.purpose}\`, persistence=\`${surface.policy.persistence}\`
- Plan: purpose=\`${surface.plan.purpose}\`, runtime=\`${surface.plan.runtime}\`, data=\`${surface.plan.data}\`, authority=\`${surface.plan.authority}\`, persistence=\`${surface.plan.persistence}\`
- Mode: \`${surface.mode}\`; scripts \`${surface.scriptPolicy}\`

### Tools

${toolLines}

### Trusted components

${componentLines}

### Host layout

${layoutLines}

### Compile issues

${issueLine}`;
}

function buildDirectionAddendum(
  opts: DirectionOpts | undefined,
  liveOpportunistic: string[] | undefined
): string {
  const lines: string[] = [];

  for (const group of OPT_OUT_GROUPS) {
    if (opts?.[group.key] === 'none') {
      lines.push(`- ${group.whenNone}`);
    }
  }

  if (liveOpportunistic && liveOpportunistic.length > 0) {
    const slots = liveOpportunistic.map((n) => `\`--${n}\``).join(', ');
    lines.push(
      `- Opportunistic spacing slots live in this direction: ${slots}. Other slots in 1..12 outside the always-on baseline (1–6) are NOT defined; do not reference them.`
    );
  } else if (liveOpportunistic) {
    lines.push(
      `- This direction defines no opportunistic spacing slots beyond the 1–6 baseline. Stay within \`--space-1\` … \`--space-6\`.`
    );
  }

  if (lines.length === 0) return '';
  return `## This direction\n\n${lines.join('\n')}`;
}

/**
 * Capabilities — what intents the generated UI can emit. Injected as a third
 * cacheable system block when the host requests interactive mode. Static mode
 * omits this block entirely; the fixed instructions already forbid scripts.
 *
 * The engine is intent-agnostic. Consumers (demo apps, host applications)
 * define their own capability packs — intents they support and example
 * patterns showing how to wire each one. A pack is passed in per generation.
 */
export interface IntentSpec {
  name: string;
  description: string;
  argsSchema: string;
  stateShape: string;
  kind?: CapabilityKind;
  triggers?: CapabilityTrigger[];
  stateKeys?: CapabilityStateKeys;
  actionStateKeys?: ActionStateKeys;
  surface?: CapabilitySurface;
  resultSchema?: string;
  defaultDataShape?: string;
  defaultData?: unknown;
}

export interface DataResourceSpec extends IntentSpec {
  kind: 'resource';
  stateKeys: ResourceStateKeys;
  resultSchema?: string;
  defaultDataShape?: string;
  defaultData?: unknown;
}

export interface CapabilityPattern {
  /** Short title shown above the code snippet in the prompt. */
  name: string;
  /** HTML code block the LLM sees as an example. Script examples are filtered. */
  code: string;
  /** Optional owner intent. SurfacePolicy narrowing uses this to keep examples
   * aligned with the grants selected for a generation. */
  intent?: string;
}

export interface CapabilityPack {
  intents: IntentSpec[];
  /** Example patterns shown under "### Patterns". Optional — without them the
   *  LLM gets only the intent list and the interactivity rules. */
  patterns?: CapabilityPattern[];
}

export type ScriptPolicy = 'allow' | 'forbid';

export interface ComponentExample {
  /** Short label for the component example. */
  name: string;
  /** Valid placeholder HTML showing this component in context. */
  code: string;
}

export interface ComponentSizing {
  /** Suggested placeholder width, e.g. `320px`, `100%`, or `minmax(220px, 1fr)`. */
  width?: string;
  /** Suggested placeholder height, e.g. `120px`. */
  height?: string;
  /** One-sentence note about how much room the component needs. */
  description?: string;
}

export interface ComponentSpec {
  name: string;
  description: string;
  propsSchema: string;
  surface?: ComponentSurface;
  examples?: ComponentExample[];
  sizing?: ComponentSizing;
}

export interface ComponentPack {
  components: ComponentSpec[];
}

export interface CapabilitiesBlockOptions {
  scriptPolicy?: ScriptPolicy;
}

export function buildCapabilitiesBlock(
  pack: CapabilityPack,
  _options: CapabilitiesBlockOptions = {},
): string {
  if (pack.intents.length === 0) return '';

  const actions = pack.intents.filter((intent) => (intent.kind ?? 'action') === 'action');
  const resources = pack.intents.filter((intent) => intent.kind === 'resource');

  const formatIntent = (i: IntentSpec) => {
    const triggers = normalizeTriggers(i).join(', ');
    const stateKeys = i.stateKeys
      ? `\n  State keys: ${formatStateKeys(i.stateKeys)}`
      : '';
    const actionStateKeys = i.actionStateKeys
      ? `\n  Action state: ${formatActionStateKeys(i.actionStateKeys)}`
      : '';
    const surface = i.surface ? `\n  Surface: ${formatSurface(i.surface)}` : '';
    return `- \`${i.name}(${i.argsSchema})\` — ${i.description}\n  Triggers: ${triggers}\n  State update: \`${i.stateShape}\`${stateKeys}${actionStateKeys}${surface}`;
  };

  const actionsList = actions
    .map(formatIntent)
    .join('\n\n');
  const resourcesList = resources
    .map(
      (i) => {
        const resultSchema = i.resultSchema ? `\n  Result schema: \`${i.resultSchema}\`` : '';
        const defaultData = i.defaultDataShape
          ? `\n  Default data: \`${i.defaultDataShape}\``
          : '\n  Default data: `null`';
        return `${formatIntent(i)}${resultSchema}${defaultData}\n  Data resource lifecycle: initial/loading/error/invalid states keep data at the default value (or null), and successful host fetches write validated data.`;
      }
    )
    .join('\n\n');

  const capabilitySections = [
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
  const scriptPolicyBlock = `### Script policy — Arrow host bridge only

This host has NOT granted custom artifact scripts. Do not emit \`<script>\` tags. All behavior lives in the Arrow entry module you return as \`main.ts\` or \`main.js\`.

Use Arrow \`reactive()\` state for local UI state, Arrow event handlers for clicks/submits/input, and the \`host-bridge:summon\` virtual module for host state and capabilities. Do not use \`window.sandbox\`, direct DOM listeners, timers, storage, or native bridges. If a requested behavior cannot be expressed with Arrow plus the granted capabilities, leave that control out or state the limitation in the UI.`;

  const actionWiring = 'by calling `await invoke("<intent>", args)` from an Arrow event handler';
  const intentNames = new Set(pack.intents.map((intent) => intent.name));
  const examples: string[] = [];
  if (intentNames.has('counter')) {
    examples.push(`// Counter: Arrow event handlers + host state sync
import { html, reactive } from "@arrow-js/core";
import { invoke, onState } from "host-bridge:summon";

const state = reactive({ count: 0 });
onState((hostState) => {
  state.count = Number(hostState.count ?? state.count ?? 0);
});

async function change(delta: number) {
  const result = await invoke("counter", { delta });
  if (result.ok) state.count = Number(result.state.count ?? state.count);
}

export default html\`
  <button @click="\${() => change(-1)}" aria-label="Decrease">-</button>
  <output>\${() => state.count}</output>
  <button @click="\${() => change(1)}" aria-label="Increase">+</button>
\`;`);
  }
  if (intentNames.has('submit')) {
    examples.push(`// Form: collect an event snapshot, invoke the host, render host-owned state
import { html, reactive } from "@arrow-js/core";
import { invoke, onState } from "host-bridge:summon";

const state = reactive({ submitted: false, submitError: "" });
onState((hostState) => {
  state.submitted = Boolean(hostState.submitted);
  state.submitError = String(hostState.submitError ?? "");
});

async function save(event: SubmitEvent) {
  event.preventDefault();
  const form = event.currentTarget as HTMLFormElement;
  const fields = Object.fromEntries(new FormData(form).entries());
  const result = await invoke("submit", fields);
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
  if (intentNames.has('log')) {
    examples.push(`// Result row: pass the selected item through an Arrow handler
import { html, reactive } from "@arrow-js/core";
import { invoke, onState } from "host-bridge:summon";

const state = reactive({ results: [] as Array<{ title: string; snippet: string }> });
onState((hostState) => {
  state.results = Array.isArray(hostState.results) ? hostState.results : [];
});

async function pick(result: { title: string; snippet: string }) {
  await invoke("log", { payload: { picked: result } });
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

  return `## Capabilities — this generation is INTERACTIVE

**Arrow-native interactivity.** Generated surfaces run as Arrow artifacts. Use Arrow \`reactive()\` for state, Arrow event handlers for user input, and \`host-bridge:summon\` for host tools and host-pushed state.

Do NOT build CSS-only state machines using \`:has()\`, \`:checked\` sibling selectors, \`<details>\` chained to other elements, or \`:target\` URL hash tricks for state. Use Arrow state and handlers instead.

### Host bridge

Import the bridge in your Arrow entry file:

\`\`\`ts
import { invoke, getState, onState } from "host-bridge:summon";
\`\`\`

- \`await invoke(intentName, args)\` calls a granted host capability and resolves to \`{ ok, state, error? }\`.
- \`await getState()\` reads the latest host-owned state snapshot.
- \`onState((state) => { ... })\` subscribes to host \`pushState()\` updates and returns an unsubscribe function.
- Copy host-owned keys into your Arrow \`reactive()\` object from \`getState()\`, \`onState()\`, and successful \`invoke()\` results.

### Available capabilities

${capabilitySections}

${examplesBlock}

${scriptPolicyBlock}

### The interactivity contract — READ THIS

**Every clickable, tappable, or focusable element in your generated UI MUST be wired to one of the declared intents — ${actionWiring}. If you cannot wire an element, do not show it.**

- No button unless you've decided which intent it fires.
- No clickable result tiles, rows, or cards unless clicking them emits something.
- No pagination, no sorting, no filtering controls unless you've decided which intent they fire.

Dead buttons are worse than no buttons. When in doubt, leave it out.

Only the intents listed above exist. Any concept that isn't in the intent list does not exist — don't add controls that imply capabilities you don't have. When in doubt, route the user-visible action through the closest matching intent or drop the control.

Data resources expose host-owned loading/data/error state keys and may expose an empty-state key. Use \`mount\` only for initial read-oriented loads granted by the resource; use \`submit\` for forms and \`click\` only when the resource grants a click trigger. Mirror the listed loading key for busy UI, error key for host errors, data key for validated result data, and empty key only for real no-results copy after a successful host result.

Default data is real host state. A data resource starts at \`{loading:false, data:defaultData ?? null, error:null, empty:false when declared}\`, and loading/error/invalid-result states keep the data value at \`defaultData ?? null\` with \`empty:false\`. Never hallucinate fetched rows, profiles, images, or counts before a successful data resource result. Render array rows from the host data key only after it exists. Render "no results" from the declared empty key, not from missing or pre-load data.

Controlled actions expose host-owned pending/done/error keys when listed under Action state. Use \`pending\` to disable or mark the triggering control busy, show \`error\` as host failure text, and show \`done\` only for useful success confirmation. Do not fake completed, approved, or failed states in local markup.

### Initial state

Action-owned state starts empty unless the host declares controlled action state, in which case pending/done/error start false/false/null. Data-resource lifecycle keys start from the default state described above. Render defensively: show an empty-state message only from declared empty state or a form before data exists, never placeholder fetched data.${patternsBlock}`;
}

export function buildComponentsBlock(pack: ComponentPack | null | undefined): string {
  if (!pack?.components.length) return '';

  const componentRows = pack.components
    .map((component) => {
      const surface = component.surface ? `\n  Surface: ${formatComponentSurface(component.surface)}` : '';
      const sizing = component.sizing
        ? `\n  Sizing: ${[
            component.sizing.width ? `width=${component.sizing.width}` : '',
            component.sizing.height ? `height=${component.sizing.height}` : '',
            component.sizing.description ?? '',
          ].filter(Boolean).join(', ')}`
        : '';
      return `- \`${component.name}(${component.propsSchema})\` — ${component.description}${surface}${sizing}`;
    })
    .join('\n\n');

  const examples = pack.components.flatMap((component) =>
    (component.examples ?? []).map((example) => ({
      name: `${component.name}: ${example.name}`,
      code: example.code,
    })),
  );
  const examplesBlock = examples.length > 0
    ? `\n\n### Component examples\n\n${examples
        .map((example) => `**${example.name}:**\n\`\`\`html\n${example.code.trim()}\n\`\`\``)
        .join('\n\n')}`
    : '';

  return `## Component islands — host-rendered UI available

The host has registered trusted UI components that can render above the sandbox as overlay islands. Use them only when they materially improve fidelity, such as charts, metrics, calendars, maps, data-dense controls, or product-native widgets. The Arrow artifact you generate is still the composition layer around them.

Component islands are placeholders inside your HTML. The host validates the component name and props, measures the placeholder, and renders the real component outside the sandbox. The sandbox cannot read or mutate the host-rendered component DOM.

### Available components

${componentRows}

### Placeholder syntax

Use this exact pattern:

\`\`\`html
<div
  data-summon-component="MetricCard"
  data-summon-component-id="revenue-card"
  data-summon-props='{"label":"Revenue","value":"$284,120","delta":"+3.2%"}'
  style="min-height:var(--space-10);"
></div>
\`\`\`

Rules:

- \`data-summon-component\` must be one of the registered names above.
- \`data-summon-component-id\` must be unique in the surface and stable across re-renders.
- \`data-summon-props\` must be one valid JSON object matching the component's props schema.
- Give the placeholder explicit visual space with CSS, usually \`height\`, \`min-height\`, or a grid track.
- Do not nest component placeholders.
- Do not use a component island for something your Arrow template and CSS can express well.
- Component islands do not grant new host actions. If the component needs durable host behavior, it must route through an already-granted intent or host-owned component code.

If props depend on Arrow state, compute the JSON from Arrow with a quoted attribute expression such as \`data-summon-props="\${() => JSON.stringify({ value: state.revenue })}"\` and keep \`data-summon-component-id\` stable across renders.${examplesBlock}`;
}

function normalizeTriggers(intent: IntentSpec): CapabilityTrigger[] {
  if (intent.triggers?.length) return intent.triggers;
  return defaultTriggersForKind(intent.kind ?? 'action');
}

function formatStateKeys(keys: CapabilityStateKeys): string {
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

function formatSurface(surface: CapabilitySurface): string {
  const parts: string[] = [];
  if (surface.data) parts.push(`data=${surface.data}`);
  if (surface.authority) parts.push(`authority=${surface.authority}`);
  return parts.length ? parts.join(', ') : 'default';
}

function formatComponentSurface(surface: ComponentSurface): string {
  const parts: string[] = [];
  if (surface.data) parts.push(`data=${surface.data}`);
  if (surface.authority) parts.push(`authority=${surface.authority}`);
  return parts.length ? parts.join(', ') : 'embedded/none';
}
