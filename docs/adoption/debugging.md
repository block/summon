# Summon Debugging Guide

Summon diagnostics explain why a generated surface failed, why a generated
control did nothing, or why host-owned data/components did not appear. Start
from the symptom, then drill into protocol paths and Devtools events only as
needed.

## Generation Failed

Open the **Stream** drawer on `/generate.html` and check:

- `/error` - server-side generation error or blocked-generation message.
- `/validation-blocked` - a blocking issue stopped generation or validation
  retry.
- `/validation-summary` - grouped validation issue counts and examples.
- `/repair-feedback` - model-readable validation retry hints for a rejected
  section.
- `/repair-summary` - counts of queued, cancelled, retried, and failed repairs.

Common fixes:

- `external-url` - inline assets as data URLs or remove the reference.
- `unsafe-tag` - remove iframe, object, embed, link, meta, or base-like tags.
- `inline-handler` - use `data-summon-on-*` or scoped `addEventListener`.
- `static-script` - remove scripts or choose an interactive surface config.
- `script-not-granted` - use only declarative `data-summon-*` bindings, or
  select `SurfacePolicy.tier: "scripted"` for a scripted surface type.
- `surface-policy-*` - fix the host-selected surface config. The compiler
  blocks unknown allowed tools/components and authority above the selected
  surface type before the model is called.

## Generated Control Did Nothing

Generated controls request host tools through the sandbox bridge. If a control
does not work:

1. Confirm the run is interactive. Read-only surfaces intentionally have no
   allowed host tools.
2. Confirm the host tool exists in `createCapabilityRegistry(...).toContract()`.
3. Confirm the generated markup uses an allowed trigger and valid
   `data-summon-args`.
4. Check Devtools for `intent-rejected`, `intent-dispatched`,
   `intent-settled`, and `state-pushed`. The event names still use the runtime
   term "intent"; read them as host tool requests.
5. Check the host handler in `PolicyEngine` and the resource's `stateKeys`.

Common fixes:

- `unknown-intent` - use only host tools listed in the Capabilities block.
- `invalid-args-json` - make `data-summon-args` a valid one-line JSON object.
- `surface-runtime-exceeded` - use only tools allowed by the compiled safety
  plan runtime.
- `surface-data-exceeded` - align resource/worker usage with the selected
  surface config.
- `surface-authority-exceeded` - remove the action or select a config that
  carries the needed authority, such as `approval-gated`.

## Host Tool Returned No Visible Data

Data resources must render loading, error, and data states. If the host handler
runs but the surface looks empty:

1. Confirm `defineDataResource` has `defaultData` that matches `resultSchema`.
2. Confirm `stateKeys.loading`, `stateKeys.data`, and `stateKeys.error` are all
   present.
3. Confirm generated markup includes visible loading, error, and data bindings.
4. Trigger the resource and inspect `state-pushed` for the resource state patch.

Common fixes:

- `resource-loading-not-rendered` - render a visible loading binding.
- `resource-error-not-rendered` - render a visible error binding.
- `resource-data-not-rendered` - render a visible data binding or foreach.

## Trusted Component Did Not Appear

Trusted host components render as host overlays. If a component placeholder
remains visible or nothing appears:

1. Confirm the host registered the component and passed
   `componentRegistry.toContract().pack` into generation.
2. Confirm replay data includes compatible component allowlists for the same host
   registry.
3. Check the Stream drawer for `unknown-component`,
   `component-props-invalid`, `nested-component`, and compiled safety plan
   issues.
4. Check Devtools for `component-sync` followed by `component-error`.
5. Use the `component-error` code to narrow the fix: `bounds-invalid` means the
   placeholder has empty/offscreen/oversized bounds, `props-invalid` means Zod
   rejected the props, and `registry-missing` means replay has component allowlists
   but the host did not provide a compatible registry.
6. Confirm host-side Zod validation accepts the props before looking at the
   component renderer.

Common fixes:

- `unknown-component` - use only names from the Components prompt block.
- `component-missing-name` - remove stray component id/props attributes or add
  `data-summon-component`.
- `component-id-missing` / `component-id-invalid` / `component-id-duplicate` -
  give every placeholder one stable, unique id such as `revenue-card`.
- `component-props-missing` / `component-props-invalid` - make
  `data-summon-props` a valid one-line JSON object.
- `nested-component` - keep component placeholders as siblings in the freeform
  layout; do not put one placeholder inside another.

## Sandbox Safety Looks Suspect

1. Run `pnpm test:safety`.
2. If it fails, inspect the Playwright trace/screenshot.
3. For manual inspection, run `pnpm dev:all` and open
   `http://localhost:5173/adversarial.html`.
4. Confirm network, storage, parent DOM, and unallowed host tool request checks
   still pass.
5. Inspect `spawnSandbox` before changing iframe sandbox attributes or CSP.

## Advanced Diagnostic Layers

These names are useful when maintaining Summon or writing a deeper adapter:

1. **Protocol parsing** - `parseProtocolLine` accepts only JSONL protocol
   records. Bad raw lines become client-side `protocol-parse-error` events.
2. **Contract validation** - unsafe tags, external URLs, inline handlers,
   unknown host tool requests, bad args JSON, missing resource states, token
   drift, and layout violations become `ContractIssue` records.
3. **Validation retry feedback** - retryable section failures can emit
   `/repair-feedback` and later `/repair-summary`.
4. **Stream diagnostics** - `StreamGraph` tracks declared, present, skipped,
   blocked, repaired, and missing sections.
5. **Host dispatch** - `PolicyEngine` validates args, runs host handlers, emits
   state patches, and reports handler errors.
6. **Trusted component overlays** - the sandbox reports placeholder bounds, then
   the host validates registered component names and props before rendering
   overlay DOM.
7. **Sandbox boundary** - `spawnSandbox` keeps the iframe null-origin and emits
   fatal or rejection signals when the boundary is misconfigured or abused.

## Stream Meta Lines

| Path | Meaning |
| --- | --- |
| `/surface-policy` | Host-owned public surface config selected for this run. |
| `/surface-plan` | Host-owned compiled safety plan selected for this run. |
| `/shape` | Optional server-inferred response shape used to narrow direction exemplars. |
| `/token-overrides` | Resolved direction token overrides, including applied and rejected entries. |
| `/validation-summary` | Final grouped `ContractIssue` counts and examples. |
| `/validation-blocked` | A blocking issue stopped generation or validation retry. |
| `/repair-feedback` | A rejected section received model-readable retry hints. |
| `/repair-summary` | Counts of queued, cancelled, retried, and failed repairs. |
| `/stream-graph-summary` | Final `StreamGraph.snapshot()` for the server stream. |
| `/protocol-skip` | A non-fatal line was skipped before reaching the sandbox. |
| `/screen-synthesized` | The server synthesized screen structure from sections. |
| `/mode-upgraded` | The server upgraded static generation to interactive mode. |
| `/error` | Server-side generation error or blocked-generation message. |

## Progressive Rendering

Summon streams at complete JSONL protocol-line granularity. It does not render
raw model tokens or partial HTML. For json-render-like perceived streaming, the
model should emit `set /screen` early, then cheap placeholder
`add /section/:id` lines, then later `add /section/:id` lines with final HTML
for the same stable ids. The client treats later accepted section lines as
replacements, so hosts that want progressive interactive rendering can pass
`renderMode: "live"` to `consumeSurfaceStream`.

## Devtools Events

The generate demo records a per-run `EventStore`. Open the **Devtools** drawer
and look for:

- `protocol-line` - accepted protocol records after parsing.
- `protocol-parse-error` - raw model output that was not valid JSONL.
- `sandbox-ready` - the iframe booted and can receive state or renders.
- `render` - accepted HTML was sent to the sandbox.
- `intent-emitted` - generated UI emitted an allowed host tool request.
- `intent-rejected` - generated UI tried an unknown or malformed request.
- `intent-dispatched` / `intent-settled` - `PolicyEngine` ran a host handler.
- `state-pushed` - host state changed and was pushed back to the sandbox.
- `component-sync` - the sandbox reported the current component placeholders
  with measured bounds. The sandbox resyncs after render, state binding,
  foreach stamping, iframe scroll, nested scroll, resize, and observed
  placeholder size changes.
- `component-error` - the host rejected or unmounted a component overlay because
  the name, props, bounds, or registry compatibility failed. The event includes
  a stable code such as `bounds-invalid`, `unknown-component`, `props-invalid`,
  or `registry-missing`.
- `surface-plan` - host-owned compiled safety plan.
- `stream-graph` - client-side stream diagnostics from `StreamGraph.snapshot()`.
- `sandbox-fatal` - bootstrap detected an unsafe sandbox configuration.

Healthy interactive runs usually show `surface-plan`, `protocol-line`, `render`,
`component-sync`, `intent-emitted`, `intent-dispatched`, `state-pushed`, and
`stream-graph` in that order after the user interacts with a component-backed
UI.

## Reading Contract Issues

`ContractIssue` has this shape:

```ts
interface ContractIssue {
  source: 'protocol' | 'html' | 'token' | 'direction' | 'capability' | 'layout' | 'edit' | 'repair' | 'system';
  severity: 'block' | 'warn';
  code: string;
  message: string;
  path?: string;
  hint?: string;
}
```

Use `hintsForContractIssue(issue)` when presenting issues back to a model or an
agent.

## Reading StreamGraph

`StreamGraph` is observe-only. It does not change runtime behavior; it explains
what happened.

Healthy sections are both declared and present. Watch these health counters:

- `complete` - every declared section is present and no blocked section exists.
- `missingDeclared` - the model declared a section but never supplied it.
- `undeclaredPresent` - the model supplied a section not declared in `/screen`.
- `skippedCount` - lines were skipped by the hardener.
- `blockedCount` - blocking validation issues were recorded.
- `repairedCount` - sections were accepted after validation retry feedback.

Server streams end with `/stream-graph-summary`. The demo client also emits
live `stream-graph` events after section updates and final render.
