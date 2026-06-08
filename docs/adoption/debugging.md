# Summon Debugging Guide

Summon diagnostics are contract-first. Start with the protocol stream, then use
Devtools and `StreamGraph` to see whether the generated UI stayed inside the
declared adoption path.

## Diagnostic Layers

1. **Protocol parsing** - `parseProtocolLine` accepts only JSONL protocol
   records. Bad raw lines become client-side `protocol-parse-error` events.
2. **Contract validation** - unsafe tags, external URLs, inline handlers,
   unknown intents, bad args JSON, missing resource states, token drift, and
   layout violations become `ContractIssue` records.
3. **Repair feedback** - retryable section failures can emit
   `/repair-feedback` and later `/repair-summary`.
4. **Stream health** - `StreamGraph` tracks declared, present, skipped,
   blocked, repaired, and missing sections.
5. **Policy dispatch** - `PolicyEngine` validates args, runs host handlers,
   emits state patches, and reports handler errors.
6. **Component islands** - the sandbox reports placeholder bounds, then the
   host validates registered component names and props before rendering overlay
   DOM.
7. **Sandbox boundary** - `spawnSandbox` keeps the iframe null-origin and emits
   fatal or rejection signals when the boundary is misconfigured or abused.

## Stream Meta Lines

| Path | Meaning |
| --- | --- |
| `/surface-plan` | Host-owned purpose/runtime/data/authority/persistence plan selected for this run. |
| `/shape` | Optional server-inferred response shape used to narrow direction exemplars. |
| `/token-overrides` | Resolved direction token overrides, including applied and rejected entries. |
| `/validation-summary` | Final grouped `ContractIssue` counts and examples. |
| `/validation-blocked` | A blocking issue stopped generation or repair. |
| `/repair-feedback` | A rejected section received model-readable repair hints. |
| `/repair-summary` | Counts of queued, cancelled, repaired, and failed repairs. |
| `/stream-graph-summary` | Final `StreamGraph.snapshot()` for the server stream. |
| `/protocol-skip` | A non-fatal line was skipped before reaching the sandbox. |
| `/screen-synthesized` | The server synthesized screen structure from sections. |
| `/mode-upgraded` | The server upgraded static generation to interactive mode. |
| `/error` | Server-side generation error or blocked-generation message. |

Open the **Stream** drawer on `/generate.html` to inspect these lines as they
arrive.

## Devtools Events

The generate demo records a per-run `EventStore`. Open the **Devtools** drawer
and look for:

- `protocol-line` - accepted protocol records after parsing.
- `protocol-parse-error` - raw model output that was not valid JSONL.
- `sandbox-ready` - the iframe booted and can receive state or renders.
- `render` - accepted HTML was sent to the sandbox.
- `intent-emitted` - generated UI emitted an allowed bridge message.
- `intent-rejected` - generated UI tried an unknown or malformed intent.
- `intent-dispatched` / `intent-settled` - `PolicyEngine` ran a host handler.
- `state-pushed` - host state changed and was pushed back to the sandbox.
- `component-sync` - the sandbox reported the current component placeholders
  with measured bounds. The sandbox resyncs after render, state binding,
  foreach stamping, iframe scroll, nested scroll, resize, and observed
  placeholder size changes.
- `component-error` - the host rejected or unmounted a component island because
  the name, props, bounds, or registry compatibility failed. The event includes
  a stable code such as `bounds-invalid`, `unknown-component`, `props-invalid`,
  or `registry-missing`.
- `surface-plan` - host-owned purpose/runtime/data/authority/persistence plan.
- `stream-graph` - client-side section health from `StreamGraph.snapshot()`.
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
agent. Common fixes:

- `external-url` - inline assets as data URLs or remove the reference.
- `unsafe-tag` - remove iframe, object, embed, link, meta, or base-like tags.
- `inline-handler` - use `data-summon-on-*` or scoped `addEventListener`.
- `static-script` - remove scripts or switch to interactive mode.
- `script-not-granted` - use only declarative `data-summon-*` bindings, or
  compile with `SurfacePlan.runtime: "scripted"` and `scriptPolicy: "allow"`
  for a scripted host tier.
- `unknown-intent` - use only capabilities granted in the Capabilities block.
- `invalid-args-json` - make `data-summon-args` a valid one-line JSON object.
- `unknown-component` - use only names from the Components prompt block.
- `component-missing-name` - remove stray component id/props attributes or add
  `data-summon-component`.
- `component-id-missing` / `component-id-invalid` / `component-id-duplicate` -
  give every placeholder one stable, unique id such as `revenue-card`.
- `component-props-missing` / `component-props-invalid` - make
  `data-summon-props` a valid one-line JSON object.
- `nested-component` - keep component placeholders as siblings in the freeform
  layout; do not put one placeholder inside another.
- `surface-runtime-exceeded` - use only capabilities allowed by the selected
  SurfacePlan runtime.
- `surface-data-exceeded` - align resource/worker usage with the selected
  SurfacePlan data source.
- `surface-authority-exceeded` - remove the action or select a plan/grant that
  carries the needed authority, such as `approval-gated`.
- `resource-loading-not-rendered` - render a visible loading binding.
- `resource-error-not-rendered` - render a visible error binding.
- `resource-data-not-rendered` - render a visible data binding or foreach.

## Reading StreamGraph

`StreamGraph` is observe-only. It does not change runtime behavior; it explains
what happened.

Healthy sections are both declared and present. Watch these health counters:

- `complete` - every declared section is present and no blocked section exists.
- `missingDeclared` - the model declared a section but never supplied it.
- `undeclaredPresent` - the model supplied a section not declared in `/screen`.
- `skippedCount` - lines were skipped by the hardener.
- `blockedCount` - blocking validation issues were recorded.
- `repairedCount` - sections were accepted after repair feedback.

Server streams end with `/stream-graph-summary`. The demo client also emits
live `stream-graph` events after section updates and final render.

## Debugging Loops

When a generated UI fails to render:

1. Check the Stream drawer for `/error`, `/validation-blocked`, and
   `/validation-summary`.
2. Check Devtools for `protocol-parse-error` and `render`.
3. Check `/stream-graph-summary` for missing or blocked sections.
4. Fix the prompt contract, direction, layout, or repair hints before changing
   sandbox runtime code.

When a generated control does not work:

1. Confirm the page is in interactive mode.
2. Confirm the capability exists in `createCapabilityRegistry(...).toContract()`.
3. Confirm the generated markup uses a granted trigger and valid
   `data-summon-args`.
4. Check Devtools for `intent-rejected`, `intent-dispatched`,
   `intent-settled`, and `state-pushed`.
5. Check the host handler in `PolicyEngine` and the resource's `stateKeys`.

When a resource UI looks empty:

1. Confirm `defineDataResource` has `defaultData` that matches `resultSchema`.
2. Confirm `stateKeys.loading`, `stateKeys.data`, and `stateKeys.error` are all
   present.
3. Confirm generated markup includes visible loading, error, and data bindings.
4. Trigger the resource and inspect `state-pushed` for the resource state patch.

When a component island does not appear:

1. Confirm the host registered the component and passed
   `componentRegistry.toContract().pack` into generation.
2. Confirm the sandbox artifact or replay envelope includes compatible
   `grants.components`.
3. Check the Stream drawer for `unknown-component`,
   `component-props-invalid`, `nested-component`, and surface-plan issues.
4. Check Devtools for `component-sync` followed by `component-error`.
5. Use the `component-error` code to narrow the fix: `bounds-invalid` means the
   placeholder has empty/offscreen/oversized bounds, `props-invalid` means Zod
   rejected the props, and `registry-missing` means replay has component grants
   but the host did not provide a compatible registry.
6. Confirm host-side Zod validation accepts the props before looking at the
   component renderer.

When sandbox safety looks suspect:

1. Run `pnpm test:safety`.
2. If it fails, inspect the Playwright trace/screenshot.
3. For manual inspection, run `pnpm dev:all` and open
   `http://localhost:5173/adversarial.html`.
4. Confirm network, storage, parent DOM, and ungranted intent checks still pass.
5. Inspect `spawnSandbox` before changing iframe sandbox attributes or CSP.
