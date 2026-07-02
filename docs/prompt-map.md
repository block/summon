# Prompt Map

> Inventory of every prompt/block that reaches a model: where it is built in
> code, who consumes it, and what it contains. Regenerated against commit
> `5908b65` (2026-07-01). When you change a prompt, update this map.
>
> **Layer ownership** (see `prompt-architecture.md`): Summon = runtime/safety/
> output format (zero design opinion); Ghost fingerprint = all composition and
> visual design; Host = capability (tools, surface contract, layout, scale).

## 1. System contracts — the main generation call

Assembled by `compileSystemContracts()` in `packages/engine/src/contracts.ts`
(~line 315), consumed by `SummonSession` (`packages/server/src/session.ts`)
which sends them as ordered system blocks ahead of the user message. Fixed
order; a block is omitted when its input is absent.

| # | Block id | Layer | Built in (file:function/const) | Cache | When present | Contents |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `fixed` | Summon | `packages/engine/src/prompt.ts`: `SUMMON_FIXED_INSTRUCTIONS` (arrow), `SUMMON_FIXED_HTML_INSTRUCTIONS` (~189), or `SUMMON_FIXED_DOMJS_INSTRUCTIONS` (~232), picked by output runtime | ephemeral | always | Stable cacheable prefix: runtime rules, sandbox API subset, safety boundaries, token contract (`formatTokenContract()`), bundle schema. No design direction. |
| 2 | `ghost` | Ghost | `apps/server/src/ghost-adapter.ts`: `renderSlicePrompt()` (~728) + `buildSummonFingerprintSurfaceBrief()` joined in `prepareGhostSurfacePrompt()` (~343); passed in as `input.ghost.prompt` | ephemeral | fingerprint run | The single Ghost block. See §2. |
| 3 | `layout:<id>` | Host | `packages/engine/src/prompt.ts`: `buildLayoutBlock()` (~335) | ephemeral | host supplies a layout | Host layout constraints for the surface. |
| 4 | `scale` | Host | `packages/engine/src/prompt.ts`: `buildScaleBlock()` (~79) | ephemeral | `input.scale` set | Hard constraint on HOW MUCH surface to build: size (small/medium/large) + complexity (simple/moderate/rich) + element budget. Explicitly defers all visual language to the fingerprint. |
| 5 | (experimental) | Summon | `input.experimentalPromptBlock`, e.g. `playgroundPromptBlock` in `apps/server/src/main.ts` (~708), gated by playground mode | per block | dev-only | Experimental/playground instructions. |
| 6 | `surface-contract` | Host | `packages/engine/src/prompt.ts`: `buildSurfaceContractBlock()` (~386) | ephemeral | `input.surfaceContract` set | Surface plan (purpose/runtime/data/authority/persistence) rendered as binding contract. |
| 7 | `tools` | Host+Summon | `packages/engine/src/contracts.ts`: `compileToolContract()` → `buildToolsBlock()` (`prompt.ts` ~500; html variant `buildHtmlToolsBlock()` ~696) | ephemeral | tool pack non-empty | Granted host tools: names, kinds, triggers, state keys, calling conventions (`callTool`/`getState`/`onState`). |
| 8 | `output-contract` | Summon | `packages/engine/src/prompt.ts`: `SUMMON_STRUCTURED_ARROW_BUNDLE_INSTRUCTIONS` (~175), `_HTML_` (~220), or `_DOMJS_` (~324) | none | always | Final-position reminder of the structured output schema (tool name, bundle schema id, required source keys, highest-value rules). |

The **user message** is the user's request (the ghost brief now lives in the
`ghost` system block, not the user message).

Runtime selection: `fixed` and `output-contract` are switched together on
`outputRuntime` — `arrow-control` → Arrow constants (`create_summon_arrow_surface`,
`summon.arrow-bundle/v1`), html runtimes → HTML constants
(`create_summon_html_surface`, `summon.html-bundle/v0`), domjs → domjs constants
(`emit_domjs_surface`, `summon.domjs-bundle/v1`).

## 2. Ghost steering — the `ghost` block in detail

There is exactly **one** ghost block. It is composed in
`apps/server/src/ghost-adapter.ts` (there is no `packages/server/src/ghost/`
prompt module) and equals `renderSlicePrompt(slice)` + blank line +
`buildSummonFingerprintSurfaceBrief(...)`.

| Piece | Built in | Contents |
| --- | --- | --- |
| Fingerprint slice | `ghost-adapter.ts`: `renderSlicePrompt()` (~728) | `# Ghost Fingerprint` header, cascade line, then every slice node body **verbatim** (provenance-ordered: own → ancestors → edges; spokes omitted). Fenced ```css token blocks are kept — the prose is the only place the model sees token names/values (`activeTokensCss` is validation/sandbox-only, never rendered into the prompt). |
| Surface brief | `ghost-adapter.ts`: `buildSummonFingerprintSurfaceBrief()` (~590) | `## Summon Surface Brief`: product, fingerprint surface + cascade, gathered nodes, user request (clamped), surface plan summary, output runtime, mode, granted tools. Then generation rules, success criteria ("technically valid but generic = failed"), and slice-faithful composition language: the fingerprint's `core` prose is the composition grammar and its **"core prose + building-block nodes"** are the composable vocabulary — Summon injects no composition voice of its own. |
| Signature moves | `ghost-adapter.ts`: `buildSignatureMovesBlock()` (~657), embedded in the brief | The fingerprint root's `## Signature look & feel` section extracted verbatim and voiced as non-negotiable must-haves for this run. Empty (graceful) when the section is absent. |

Slice resolution: `resolveRootGhostGenerationContext` / `resolveCatalogGhostGenerationContext`
anchor at `core`; `prepareGhostSurfacePrompt()` (~343) re-anchors via surface
selection (§5) and re-renders the slice prompt + token CSS for the chosen
surface before appending the brief.

Removed (do not re-add to this map): `ghost:contract`, `ghost:surface-brief`,
`buildSurfacePlanBlock`, `buildCompositionRepertoireBlock`, `gatherRelayContext`.

## 3. Generation calls (model providers)

`apps/server/src/model-providers.ts` implements `generateArrowBundle`,
`generateHtmlBundle`, `generateDomjsBundle` (~110 interface; anthropic/openai/
google provider impls at ~642/~814/~980). Each sends the compiled system blocks
(§1) plus the user prompt and forces the structured tool/schema:

| Call | Tool/schema | Notes |
| --- | --- | --- |
| `generateArrowBundle` | `create_summon_arrow_surface` → `summon.arrow-bundle/v1` | `main.ts`/`main.js` Arrow entry + optional `main.css` + optional `preview`. |
| `generateHtmlBundle` | `create_summon_html_surface` → `summon.html-bundle/v0` | `body.html` + optional `main.css`; scripts forbidden unless `allowScript`. |
| `generateDomjsBundle` | `emit_domjs_surface` → `summon.domjs-bundle/v1` | `main.js` building the DOM imperatively via the facade API, `export default rootNode`; reactive `state()`/`region()` bindings per `SUMMON_FIXED_DOMJS_INSTRUCTIONS`. |

## 4. Repair prompts

Built in `apps/server/src/model-providers.ts`, sent as a **user message** to
the same provider (system blocks re-sent alongside) when validation fails:

| Prompt | Built in | Contents |
| --- | --- | --- |
| `repairPrompt()` (~1537) | `model-providers.ts` | Original prompt + "failed Summon validation" + issue list (`code`/`path`/`message`) + repair hints (from the shared `hintsForContractIssue` table — no hardcoded per-issue reminders) + previous bundle JSON + "return a complete replacement; do not widen authority/schema". Arrow schema reminder. |
| `repairHtmlPrompt()` (~1593) | `model-providers.ts` | Same shape; HTML schema reminder, script policy line depends on `allowScript`. |
| `repairDomjsPrompt()` (~1566) | `model-providers.ts` | Same shape; domjs schema reminder + facade-API rules (no `innerHTML`/`querySelector`/`el.style`/`window`/`fetch`; `emit_domjs_surface`). Consumed by `generateDomjsBundle` repair turns (~659/~836/~1002). |

## 5. Utility model calls (outside the main generation)

| Call | Built in | Consumed by | Contents |
| --- | --- | --- | --- |
| **Goal classifier** (agent ward) | `packages/server/src/agent-ward.ts`: `buildGoalClassifierPrompt()` (~376), sent by `inferGoalWithModel()` (~342) | utility text model (`completeText`, temp 0, ~1.8s timeout, falls back to deterministic goal) | System prompt: classify the request into a bounded JSON goal object (`purpose`/`interaction`/`dataNeed`/`sideEffect`/`requestedTools`/`confidence`) against the listed host tools; "do not request broader authority than the prompt needs". User prompt: the raw request. |
| **Surface selection** | `apps/server/src/ghost-adapter.ts`: `SURFACE_SELECT_SYSTEM_PROMPT` (~402) + inline user prompt in `selectGhostSurface()` (~430) | utility text model (temp 0, 32 tokens, 8s timeout; skipped without `completeText`, falls back to `core`) | System: pick the single best composition archetype id from the gather menu; prefer a concrete archetype; answer `core` only when nothing fits; answer with only the id. User: request + candidate menu (id + "reach when" line) + `core` option. Out-of-menu answers fall back to `core` (`validatePreselectedSurface` mirrors this for pre-resolved anchors). |
| **Conformance evaluator** | `apps/server/src/ghost-conformance.ts`: `EVAL_SYSTEM_PROMPT` (~51) + `buildEvalPrompt()` (~103), sent by `evaluateConformance()` | utility text model (8s default timeout; no call when no routed checks or no artifact) | System: "design-conformance evaluator" — given UI source and named prose checks, return ONLY a JSON array of `{name, pass, reason, evidence?}`. User: `## Generated UI source` (clamped to ~12k chars) + `## Checks` (routed check bodies from the fingerprint package's checks dir). |

## 6. What the model never sees

- `activeTokensCss` — parsed for validation (`parseDefinedTokens`) and injected
  into the sandbox at render time only; token names reach the model via the
  fingerprint prose's ```css blocks (see §2).
- Validation context (`mode`, allowed tools, surface plan, defined tokens) —
  server-side enforcement in `compileSystemContracts` output, not prompt text.
- Conformance checks are validation constraints; the surface brief explicitly
  tells the generator not to render them as content.
