# Prompt Map

> Exhaustive inventory of every instruction, system block, and hint Summon sends
> to the model. Reflects the code as of 2026-06-27 (migration steps 1, 2, A–C
> applied). When you change a prompt, update this map. This is the "compose"
> half of the fingerprint-as-authority thesis made legible.
>
> **Layer ownership** (see `prompt-architecture.md`): Summon = runtime/safety/
> output (zero design); Ghost = all composition/design; Host = capability +
> optional layout. **Ghost blocks are pending a rearchitecture** — the §3/§4
> descriptions below will change when it lands.

## How a generation request is assembled

The model receives **one or more cached system blocks** + **one user message**.
The system blocks are assembled by `compileSystemContracts()`
(`packages/engine/src/contracts.ts`) in this fixed order:

| # | Block id | Layer | Source | Cache | When present |
| --- | --- | --- | --- | --- | --- |
| 1 | `fixed` | Summon | `SUMMON_FIXED_INSTRUCTIONS` (or `_HTML_`) | ephemeral | always |
| 3 | `ghost` | Ghost | `ResolvedGhostSteer.prompt` (relay brief + surface brief) | ephemeral | fingerprint run |
| 4 | `ghost:<id>` | Ghost | Ghost ingestion blocks incl. `ghost:contract`, `ghost:surface-brief` | ephemeral | fingerprint run |
| 5 | `layout:<id>` | Host | `buildLayoutBlock()` | ephemeral | host supplies a layout |
| 6 | `playground-mode` | Summon | `playgroundPromptBlock` (main.ts) | — | playground mode (dev-only, gated) |
| 7 | `surface-contract` / `surface-plan` | Host | `buildSurfaceContractBlock()` / `buildSurfacePlanBlock()` | ephemeral | always (one of) |
| 8 | tools | Host+Summon | `buildToolsBlock()` (or `buildHtmlToolsBlock()`) | ephemeral | interactive mode w/ tools |
| 9 | `output-contract` | Summon | `SUMMON_STRUCTURED_ARROW_BUNDLE_INSTRUCTIONS` (or `_HTML_`) | none | always |

> Block 2 (`direction`) was removed in step 1. `playground` (§6) is dev-only and
> gated behind `SUMMON_ENABLE_PLAYGROUND` (step C).

The **user message** is `ghostContext.prompt` (the user's request + the surface
brief), or the bare prompt for non-ghost runs.

Two model calls also exist outside the main generation:
- **Goal classifier** (`buildGoalClassifierPrompt`) — utility model, picks a
  bounded tool/policy object before generation.
- **Repair** (`repairPrompt` / `repairHtmlPrompt`) — re-sends the failed bundle
  + validation issues + hints when the repair loop fires.

---

## 1. Fixed instructions (the stable cached prefix)

`SUMMON_FIXED_INSTRUCTIONS` — `packages/engine/src/prompt.ts`. The long-lived,
design-agnostic Summon-layer prefix. As of step 2 it carries **zero composition
or editorial guidance** — it opens by naming Ghost as the sole design authority.
Sections:

- **Opening** — "You receive a user request and a Ghost design fingerprint…
  The Ghost fingerprint is the sole authority for composition… Summon governs
  only runtime, safety, and output format; it has no opinion about how the
  surface should look."
- **Structured Arrow sandbox bundle** — output shape: `schema:
  "summon.arrow-bundle/v1"`, one `main.ts`/`main.js`, optional `main.css`,
  optional `preview`. Forbids markdown/fences/op-path/meta lines.
- **Arrow entry rules** — the binding/runtime rules:
  - default export is an Arrow template/component
  - import only `html, reactive, component, props, pick, watch, onCleanup, nextTick` from `@arrow-js/core`
  - `reactive()` + live reads as functions
  - quoted event/attribute bindings
  - boolean attrs return `false` to remove
  - **`ARROW_BINDING_RULE_LINE`** (shared) — attribute+event for inputs, never IDL `.value=`
  - host tools via `host-bridge:summon` + `callTool`
  - `getState()` / `onState()` for host state
  - no `window`/`document`/storage/DOM refs/imports/timers/URLs
  - `fetch()` only when network is `restricted-fetch`
- **`ARROW_SANDBOX_SUBSET_PROMPT_BLOCK`** (shared) — the sandbox quirks:
  no IDL bindings (+ controlled-input/checkbox/select rewrites), no bare
  open-tag `${}`, no namespace tags, single-expression `ref`, wrap live reads,
  boolean-attr removal.
- **Arrow/CSS rules** — explicitly framed as "runtime and safety boundaries, not
  design guidance": semantic HTML, styling in `main.css` via classes, no
  external URLs/images/fonts/stylesheets, token *vocabulary comes from Ghost*,
  and the one rescued runtime rule — no faked interactivity via
  `:has()`/`:checked`/`<details>` state machines.
- **Token contract** — `formatTokenContract()` (see §7), a deferral statement.

**Removed in step 2** (now Ghost's job): the 7 structural archetypes, the
anti-card-grid guidance, the "Content quality" section, and "How to think about
this generation". None of it lives in Summon anymore — no fallback floor.

### HTML variant
`SUMMON_FIXED_HTML_INSTRUCTIONS` — parallel Summon-layer block for the HTML
runtimes. Same treatment: composition/editorial and the visual composition floor
removed; keeps the static-HTML safety bans (`<script>`/`<iframe>`/inline
handlers/external assets) and names Ghost as the design authority.

---

## 2. Direction block (REMOVED 2026-06-27)

The legacy `direction` block (`buildDirectionBlock`, `directions-loader`,
`compileDirectionContract`, `eval-directions`) was dead in the server
(`main.ts` hardcoded `direction: null`) and has been removed entirely. Token
validation (`validateDirection`) survives — it backs `compileTokenContract`.

---

## 3–4. Ghost blocks (the fingerprint authority)

### `ghost` block — the surface brief
`buildSummonFingerprintSurfaceBrief()` — `apps/server/src/ghost-adapter.ts`.
Appended to the user prompt. Contains:
- **Brief details**: product, target path, one-line user request, surface plan
  (purpose/runtime/data/authority/persistence), output runtime, mode, selected
  composition refs, granted host tools.
- **Generation rules**: use the supplied relay brief as the complete entrypoint;
  return the structured bundle via the tool/schema.
- **Primary success criterion**: "a technically valid but generic surface is a
  failed generation"; user request = task authority; fingerprint = visual/
  composition authority; safety restricts APIs not richness.
- **Fingerprint composition rules**: compose from prose+inventory+composition;
  imitate the visual grammar; pick a composition shell; composed outer shell not
  unframed content; tokens as source of truth; no invented colors/fonts/etc.;
  checks are validation not content.

### `ghost:contract` block — the ingestion contract
`buildGhostContractPrompt()` — `packages/server/src/ghost/prompt.ts`. The
compiled relay as binding direction:
- Prose and intent anchors
- Composition anchors (choose one as visible outer shell)
- Inventory and building blocks (tokens, components, libraries)
- Anti-pattern boundaries
- Active/selected checks
- Active token vocabulary (first 80 names)

---

## 5. Layout block

`buildLayoutBlock()` — when the host supplies a layout. Lists ordered semantic
slots (`id` — `purpose`), instructs the model to honor slot order/purpose, and
forbids inventing chrome or emitting transport/stream lines.

---

## 6. Playground block

`playgroundPromptBlock` — `apps/server/src/main.ts`. Best-effort local mode:
prioritize one renderable Arrow bundle, hard-requires one entry file, prefers
self-contained reactive Arrow.

---

## 7. Surface contract / plan block

`buildSurfaceContractBlock()` — `packages/engine/src/prompt.ts`. A compact,
read-only view of the host-selected `SurfacePolicy`:
- **Surface**: policy tier/purpose/persistence; plan
  purpose/runtime/data/authority/persistence; mode.
- **Tools**: each granted tool's name/kind/description/triggers/args/state/
  surface authority.
- **Host layout**: slots, if any.
- **Compile issues**: count, "do not widen the surface to work around them."
- Explicitly forbids emitting `/surface-contract`, `/surface-policy`,
  `/surface-plan` meta lines (host owns those).

`formatTokenContract()` — `packages/engine/src/token-contract.ts`. Three lines:
treat host CSS custom properties as opaque vocabulary; use the names listed in
the Ghost/direction block; token semantics belong to the design source, Summon
only provides runtime + safety.

---

## 8. Tools block (interactive mode)

`buildToolsBlock()` — `packages/engine/src/prompt.ts`. The largest dynamic block.
- **"Tools — this generation is INTERACTIVE"** — Arrow-native interactivity;
  no CSS-only state machines.
- **Host bridge** — `callTool` / `getState` / `onState` semantics.
- **Available data resources / actions** — formatted per tool (args, state keys,
  action state, surface, result schema, default data).
- **Inline examples** — counter / submit-form / result-row Arrow snippets,
  emitted only when those tool names are granted.
- **Host tool bridge** — no `<script>`; behavior lives in the Arrow module.
- **The interactivity contract — READ THIS** — every interactive element must be
  wired to a declared tool; dead buttons are worse than no buttons; only listed
  tools exist; data resources start at default/null; never hallucinate fetched
  data; controlled actions expose pending/done/error.
- **Initial state** — defensive rendering rules.
- **Patterns** — owner-filtered tool patterns (`<script>` patterns
  stripped).

### HTML variant
`buildHtmlToolsBlock()` — for HTML runtimes: tools are *context only*, no bridge,
no live controls, no faked tool results.

---

## 9. Output contract block

`SUMMON_STRUCTURED_ARROW_BUNDLE_INSTRUCTIONS` (or `_HTML_`) —
`packages/engine/src/prompt.ts`. The final, **uncached** block. As of step A it
is a **tight recency anchor**, not a restatement: the output shape + a handful
of highest-value reminders (imports, the IDL binding rule, the core safety
bans), ending with the line "the run is incomplete until the bundle contains a
valid entry file". It no longer duplicates the full rule list or re-appends the
whole `ARROW_SANDBOX_SUBSET_PROMPT_BLOCK` (those live in §1).

---

## Out-of-band model calls

### Goal classifier
`buildGoalClassifierPrompt()` — `packages/server/src/agent-broker.ts`. Utility
model, temperature 0, ~500 tokens. Lists available host tools and asks for ONE
JSON object: `{purpose, interaction, dataNeed, sideEffect, requestedTools,
confidence, rationale}`. Rules map request phrasing → interaction class. Used to
propose a SurfacePolicy before generation.

### Repair
`repairPrompt()` / `repairHtmlPrompt()` — `apps/server/src/model-providers.ts`.
Fires when the repair loop runs. Re-sends:
- the original prompt
- "previous bundle failed Summon validation"
- the **validation issues** (`- code at path: message`)
- the **repair hints** — from `hintsForContractIssue()`
  (`packages/engine/src/contracts.ts`), keyed by issue code. Notable:
  `unsupported-arrow-idl-binding` → `ARROW_CONTROLLED_INPUT_HINTS` (shared);
  `unsupported-arrow-open-tag-expression`, `invalid-arrow-source-syntax`,
  `arrow-network-not-granted`, the resource/action lifecycle hints, etc.
- the previous bundle JSON
- "return a complete replacement; do not widen authority / add tools / add
  network / change schema."

As of step B, there is **no hardcoded per-issue reminder** in `repairPrompt` —
all issue-specific guidance (including the open-tag rewrite) flows through the
shared `hintsForContractIssue()` table, so prompt/repair/validation cannot drift.

---

## Shared single-source-of-truth modules

- **`packages/engine/src/arrow-subset.ts`** — the Arrow sandbox quirks. Feeds the
  prompt (`ARROW_BINDING_RULE_LINE`, `ARROW_SANDBOX_SUBSET_PROMPT_BLOCK`) AND the
  repair hints (`ARROW_CONTROLLED_INPUT_HINTS`) AND the validator
  (`ARROW_IDL_BINDING_RE`). Prompt, repair, and validation cannot drift.
- **`packages/engine/src/token-contract.ts`** — `formatTokenContract()`, the
  Summon-owns-no-token-semantics language.
- **`packages/engine/src/contracts.ts`** — `hintsForContractIssue()`, the
  per-issue-code repair hint table.

## Resolved cleanup items

- ✅ The full `ARROW_SANDBOX_SUBSET_PROMPT_BLOCK` + rule-list no longer duplicate
  into the `output-contract` block — step A slimmed it to a recency anchor.
- ✅ `repairPrompt`'s hardcoded open-tag reminder removed — step B routes all
  issue-specific guidance through the shared hint table.

## Pending the Ghost rearchitecture

- The §3/§4 Ghost blocks (`ghost`, `ghost:contract`, surface brief) still overlap
  on composition direction. De-overlapping is parked until the Ghost
  rearchitecture lands (see `prompt-architecture.md`). The Summon layer has fully
  vacated composition, so new Ghost must carry all of it.
