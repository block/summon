/**
 * System prompt builder.
 *
 * Ownership boundary (see docs/spec/prompt-architecture.md):
 *   - Summon layer (this file's fixed/output blocks): runtime mechanics, sandbox
 *     safety, output shape. NO design or composition guidance.
 *   - Ghost layer: all composition, hierarchy, density, tone, visual design.
 *   - Host layer: capability (tools, surface contract) + optional layout.
 *
 * Blocks are passed to the SDK as separate `system` text blocks with
 * `cache_control`; the stable Summon prefix caches long-lived.
 */

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

export const SUMMON_FIXED_SURFACE_DOCUMENT_INSTRUCTIONS = `You generate self-contained Surface Document bundles for the Summon rendering engine.

You receive a user request and a Ghost design fingerprint. Render one native Surface Document that satisfies the request. The Ghost fingerprint is the sole authority for composition, hierarchy, density, tone, structure, and all visual design — follow it. Summon governs only the runtime, safety, and output format described below; it has no opinion about how the surface should look.

## Structured Surface Document bundle

You return a structured object through the provided emit_surface_document tool/schema. Do not write Markdown, code fences, transport records, stream lines, objects with op/path fields, or host-owned meta paths.

The returned object must include:

- schema: "summon.surface-document-bundle/v1"
- source["main.html"] with inert semantic structure
- source["main.css"] with all Ghost fingerprint styling
- optional source["main.js"] for governed behavior only when behavior is needed

Surface Document file roles:

- main.html is inert structure. Use plain semantic HTML, ids, classes, and data-* attributes as behavior hooks. Do not emit <script>, <style>, <iframe>, <object>, <embed>, inline event handlers such as onclick/oninput/onsubmit, javascript: URLs, or form actions that imply ambient browser authority.
- main.css is fingerprint styling. Put visual styling here; use class names and fingerprint tokens. Do not use @import, external URLs, data: URLs, javascript: URLs, external images, external fonts, or external stylesheets. Inline SVG in main.html is fine.
- main.js is optional governed behavior. It runs in the Summon VM against the parsed main.html root. Use scoped DOM APIs only: document.getElementById(), document.querySelector(), root/element querySelector(), createElement/createTextNode, textContent, setAttribute/removeAttribute, className/classList, style property writes, append/appendChild/insertBefore/removeChild/replaceChildren, addEventListener or on<event> properties, and reflected properties such as value/checked/disabled.
- For local reactive behavior use state(initial) and function bindings; for lists/conditionals use region(() => ...). Mutate state in event handlers; do not manually patch the DOM for reactive values.
- For granted host tools use await callTool(toolName, args). Use getState() and onState((state) => ...) for host-pushed state when needed. Do not use fetch(), XMLHttpRequest, WebSocket, window, document.body, storage, cookies, eval, dynamic imports, innerHTML, outerHTML, parentNode/parentElement traversal, node.remove(), or unscoped browser APIs.
- If a requested behavior cannot be expressed with scoped DOM APIs plus granted tools, omit the live control or state the limitation in one short line of copy. Do not fake interactivity with CSS-only state machines.

## Token contract

${formatTokenContract()}

The Ghost fingerprint specifies which tokens carry particular meaning and how to deploy them.

Begin. Return one complete structured Surface Document bundle through the provided tool/schema.`;

export const SUMMON_STRUCTURED_SURFACE_DOCUMENT_BUNDLE_INSTRUCTIONS = `## Output contract — final reminder

Return one structured object through the \`emit_surface_document\` tool/schema. Not Markdown, code fences, transport records, stream lines, \`op\`/\`path\` objects, or host-owned meta paths.

- \`schema: "summon.surface-document-bundle/v1"\`
- \`source["main.html"]\` with inert semantic structure
- \`source["main.css"]\` with fingerprint styling
- optional \`source["main.js"]\` for governed behavior using scoped DOM APIs, \`state()\`, \`region()\`, and \`callTool()\`

Highest-value reminders (full rules above): keep HTML inert; put styling in \`main.css\`; put behavior only in optional \`main.js\`; no inline handlers, forbidden tags, javascript: URLs, \`@import\`, external/data/javascript CSS URLs, network APIs, \`window\`, \`document.body\`, storage, \`eval\`, \`innerHTML\`, or \`outerHTML\`.

The run is incomplete until the bundle contains valid \`main.html\` and \`main.css\`.`;

export function buildLayoutBlock(layout: SummonLayout): string {
  const slotLines = layout.slots
    .map((slot) => `- \`${slot.id}\` — ${slot.purpose}`)
    .join('\n');

return `## Host layout — this generation

The host has supplied a strict layout contract named **${layout.id}**. Build your Surface Document bundle so its visible composition has these semantic regions, in this order:

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

export function buildSurfaceContractBlock(contract: SurfaceContractView): string {
  const { surface } = contract;
  const artifactLine = 'It is not a JSON UI schema: you still generate a rich Surface Document bundle inside these typed boundaries. The structured output contract below controls the exact files.';
  const enforcementLine = 'Do not emit `/surface-contract`, `/surface-policy`, or `/surface-plan` meta lines. The host owns those lines and enforcement still lives in the runtime validators, PolicyEngine, and Surface Document sandbox boundary.';
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

export function buildToolsBlock(pack: ToolPack): string {
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

  return buildSurfaceDocumentToolsBlock({ toolSections });
}

function buildSurfaceDocumentToolsBlock({
  toolSections,
}: {
  toolSections: string;
}): string {
  return `## Tools — this Surface Document may use host tools

This run returns a structured Surface Document bundle. Keep structure in \`main.html\`, styling in \`main.css\`, and any live behavior in optional \`main.js\`. Host calls are allowed only through granted tools.

### Host bridge in main.js

Use the ambient or imported bridge:

\`\`\`js
import { callTool, getState, onState } from "host-bridge:summon";
\`\`\`

- \`await callTool(toolName, args)\` calls a granted host tool and resolves to \`{ ok, state, error? }\`.
- \`getState()\` reads the latest host-owned state snapshot.
- \`onState((state) => { ... })\` subscribes to host state updates.
- Copy host-owned values into local \`state()\` when you need reactive text, attributes, lists, or conditionals.

### Available tools

${toolSections}

### Surface Document interactivity contract

- Every clickable, tappable, or focusable control that implies host execution must call one of the declared tools from \`main.js\`; if you cannot wire it, do not show it.
- Use \`main.html\` ids/data-* hooks plus scoped queries such as \`document.getElementById()\` or \`document.querySelector()\`; do not add inline handlers to HTML.
- Use \`state()\` with function bindings for dynamic text/attributes, and \`region(() => ...)\` for lists or conditionals.
- Do not fake tool results, loading states, completed actions, approvals, or fetched rows before host state/tool results exist.`;
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
