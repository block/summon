# Summon Debugging Guide

Summon diagnostics explain why an Arrow artifact failed, why a generated
control did nothing, or why host-owned data/components did not appear. Start
from the symptom, then drill into protocol paths and Devtools events only as
needed.

## Generation Failed

Open the **Stream** drawer on `/generate` and check:

- `/error` - server-side generation error or blocked-generation message.
- `/validation-blocked` - a blocking issue stopped generation.
- `/validation-summary` - grouped validation issue counts and examples.
- `/protocol-skip` - a non-fatal raw model line was skipped before the sandbox.
- `/stream-graph-summary` - final artifact/validation stream diagnostics.

Common fixes:

- `malformed-jsonl` - the model emitted prose, Markdown, or an unsupported
  protocol op instead of JSONL.
- `invalid-arrow-artifact` - the `/artifact` value was not an Arrow artifact.
- `invalid-arrow-entry` - the artifact source did not contain one valid Arrow
  entrypoint.
- `unsupported-arrow-idl-binding` / `unsupported-arrow-open-tag-expression` -
  rewrite the Arrow template to use supported bindings.
- `arrow-network-not-granted` - remove restricted fetch usage or select a
  surface config whose host grants that network policy.
- `surface-policy-*` - fix the host-selected surface config. The compiler
  blocks unknown allowed tools/components and authority above the selected
  surface type before the model is called.

## Generated Control Did Nothing

Generated controls request host tools through the sandbox bridge. If a control
does not work:

1. Confirm the run is interactive. Read-only surfaces intentionally have no
   allowed host tools.
2. Confirm the host tool exists in `createCapabilityRegistry(...).toContract()`.
3. Confirm the Arrow code invokes only an allowed tool name.
4. Check Devtools for `intent-rejected`, `intent-dispatched`,
   `intent-settled`, and `state-pushed`. The event names still use the runtime
   term "intent"; read them as host tool requests.
5. Check the host handler in `PolicyEngine` and the resource's `stateKeys`.

Common fixes:

- `unknown-intent` - use only host tools listed in the Capabilities block.
- `invalid-args-json` - send a JSON-serializable argument object.
- `surface-runtime-exceeded` - use only tools allowed by the compiled safety
  plan runtime.
- `surface-data-exceeded` - align resource/worker usage with the selected
  surface config.
- `surface-authority-exceeded` - remove the action or select a config that
  carries the needed authority, such as `approval-gated`.

## Trusted Component Did Not Appear

Trusted host components render as host overlays. If a component placeholder
remains visible or nothing appears:

1. Confirm the host registered the component and passed
   `componentRegistry.toContract().pack` into generation.
2. Confirm replay data includes compatible component allowlists for the same
   host registry.
3. Check the Stream drawer for `unknown-component`,
   `component-props-invalid`, `nested-component`, and compiled safety plan
   issues.
4. Check Devtools for `component-sync` followed by `component-error`.
5. Use the `component-error` code to narrow the fix: `bounds-invalid` means the
   placeholder has empty/offscreen/oversized bounds, `props-invalid` means Zod
   rejected the props, and `registry-missing` means replay has component
   allowlists but the host did not provide a compatible registry.

## Sandbox Safety Looks Suspect

1. Run `pnpm test:safety`.
2. If it fails, inspect the Playwright trace/screenshot.
3. For manual inspection, run `pnpm dev:workbench` and open
   `http://localhost:5173/adversarial`.
4. Confirm network, storage, parent DOM, and unallowed host tool request checks
   still pass.
5. Inspect `spawnSandbox` before changing iframe sandbox attributes or CSP.

## Advanced Diagnostic Layers

1. **Protocol parsing** - `parseProtocolLine` accepts only JSONL `meta` and
   Arrow `/artifact` records. Bad raw lines become client-side
   `protocol-parse-error` events or server `/protocol-skip` meta.
2. **Artifact validation** - malformed Arrow source, unsupported bindings,
   host-owned meta paths, token drift, and surface-plan violations become
   `ContractIssue` records.
3. **Stream diagnostics** - `StreamGraph` tracks Arrow artifact revisions plus
   skipped and blocked counts.
4. **Host dispatch** - `PolicyEngine` validates args, runs host handlers, emits
   state patches, and reports handler errors.
5. **Trusted component overlays** - the sandbox reports placeholder bounds, then
   the host validates registered component names and props before rendering
   overlay DOM.
6. **Sandbox boundary** - `spawnSandbox` keeps the iframe null-origin and emits
   fatal or rejection signals when the boundary is misconfigured or abused.

## Stream Meta Lines

| Path | Meaning |
| --- | --- |
| `/agent-intent` | Broker-advisory intent inferred from the prompt before host policy narrowing. |
| `/agent-policy-resolution` | Brokered proposed/effective surface config, host policy source, intent source, and rejected tools/components. |
| `/surface-policy` | Host-owned public surface config selected for this run. |
| `/surface-plan` | Host-owned compiled safety plan selected for this run. |
| `/surface-contract` | Host-owned compact view of the selected policy, narrowed tools/resources, trusted components, optional layout, and compile issues. |
| `/shape` | Optional server-inferred response shape used to narrow direction exemplars. |
| `/token-overrides` | Resolved direction token overrides, including applied and rejected entries. |
| `/validation-summary` | Final grouped `ContractIssue` counts and examples. |
| `/validation-blocked` | A blocking issue stopped generation. |
| `/stream-graph-summary` | Final `StreamGraph.snapshot()` for the server stream. |
| `/protocol-skip` | A non-fatal line was skipped before reaching the sandbox. |
| `/mode-upgraded` | The server upgraded static generation to interactive mode. |
| `/error` | Server-side generation error or blocked-generation message. |

## Progressive Rendering

Summon streams at complete JSONL protocol-line granularity. It does not render
raw model tokens or partial source. Progressive perceived rendering comes from
emitting newer complete Arrow `/artifact` revisions. The host renders each
accepted revision with `renderArtifact()`.

## Devtools Events

The generate demo records a per-run `EventStore`. Open the **Devtools** drawer
and look for:

- `protocol-line` - accepted `meta` or `artifact` records after parsing.
- `protocol-parse-error` - raw model output that was not valid JSONL.
- `sandbox-ready` - the iframe booted and can receive state or renders.
- `render` - an accepted Arrow artifact was sent to the sandbox.
- `intent-emitted` - generated UI emitted an allowed host tool request.
- `intent-rejected` - generated UI tried an unknown or malformed request.
- `intent-dispatched` / `intent-settled` - `PolicyEngine` ran a host handler.
- `state-pushed` - host state changed and was pushed back to the sandbox.
- `component-sync` - the sandbox reported the current component placeholders
  with measured bounds.
- `component-error` - the host rejected or unmounted a component overlay because
  the name, props, bounds, or registry compatibility failed.
- `surface-contract` - host-owned compact contract view emitted by the server
  for policy-backed generations.
- `surface-plan` - host-owned compiled safety plan.
- `stream-graph` - client-side artifact diagnostics from
  `StreamGraph.snapshot()`.
- `sandbox-fatal` - bootstrap detected an unsafe sandbox configuration.

## Reading Contract Issues

`ContractIssue` has this shape:

```ts
interface ContractIssue {
  source: 'protocol' | 'arrow' | 'token' | 'direction' | 'capability' | 'layout' | 'system';
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

Watch these health counters:

- `complete` - no blocking validation issue was recorded.
- `skippedCount` - raw lines were skipped by parser/hardener.
- `blockedCount` - blocking validation issues were recorded.

Server streams end with `/stream-graph-summary`. The demo client also emits
live `stream-graph` events after accepted artifact revisions.
