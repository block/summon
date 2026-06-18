# Summon Debugging Guide

Summon diagnostics explain why an Arrow bundle failed validation, why an
accepted artifact did not render, why a generated control did nothing, or why
host-owned data did not appear. Start from the symptom, then drill into server
stream paths and Devtools events only as needed.

## Generation Failed

Open the **Stream** drawer on `/generate` and check:

- `/error` - server-side generation error or blocked-generation message.
- `/validation-blocked` - a blocking issue stopped generation.
- `/validation-summary` - grouped validation issue counts and examples.
- `/model-output-mode` - the structured model-output contract used for this
  run, including schema and repair attempts.
- `/validation-observed` - workbench-only observe mode diagnostic for an
  artifact issue that would block in production but was forwarded for runtime
  inspection.
- `/stream-graph-summary` - final artifact/validation stream diagnostics.

The model does not author Summon's stream. The model returns a structured Arrow
bundle through the provider/tool schema, and the server validates, repairs when
possible, and emits the stream lines consumed by the client.

Common fixes:

- `invalid-arrow-bundle` / `invalid-arrow-bundle-entry` - the structured bundle
  did not include exactly one valid `main.ts` or `main.js` entry file.
- `invalid-arrow-artifact` - the normalized bundle did not produce an Arrow
  artifact accepted by the runtime validator.
- `invalid-arrow-entry` - the artifact source did not contain one valid Arrow
  entrypoint.
- `unsupported-arrow-idl-binding` / `unsupported-arrow-open-tag-expression` -
  rewrite the Arrow template to use supported bindings.
- `arrow-network-not-granted` - remove generated `fetch()` usage and route data
  through a host tool.
- `surface-policy-*` - fix the host-selected surface config. The compiler
  blocks unknown allowed tools and authority above the selected surface type
  before generation proceeds.

## Generated Control Did Nothing

Generated controls request host tools through the sandbox bridge. If a control
does not work:

1. Confirm the run is interactive. Read-only surfaces intentionally have no
   allowed host tools.
2. Confirm the host tool exists in `createToolRegistry(...).toContract()`.
3. Confirm the Arrow code invokes only an allowed tool name.
4. Check Devtools for `tool-rejected`, `tool-dispatched`, `tool-settled`, and
   `state-pushed`.
5. Check the host handler in `PolicyEngine` and the resource's `stateKeys`.

Common fixes:

- `unknown-tool` - use only host tools listed in the Tools block.
- `invalid-args-json` - send a JSON-serializable argument object.
- `surface-policy-tier-exceeded` - use only tools allowed by the selected
  `SurfacePolicy` tier.
- `surface-data-exceeded` - align resource/worker usage with the selected
  surface config.
- `surface-authority-exceeded` - remove the action or select a config that
  carries the needed authority, such as `approval-gated`.

## Sandbox Safety Looks Suspect

1. Run `pnpm test:safety`.
2. If it fails, inspect the Playwright trace/screenshot.
3. For manual inspection, run `pnpm dev:workbench` and open
   `http://localhost:5173/adversarial`.
4. Confirm browser globals, generated network, storage, native bridge access,
   and unallowed host tool request checks still pass.
5. Inspect `mountInlineSurface`, Arrow bridge wiring, and `PolicyEngine` before
   changing sandbox behavior.

## Surface Stayed Blank

If the Stream drawer shows an accepted Arrow `/artifact` but the inline surface
stays blank:

1. Check Devtools for `render`. That means the host sent the accepted artifact
   to the inline Arrow sandbox.
2. Check Devtools for `rendered`. That means the inline Arrow sandbox mounted
   the accepted artifact revision.
3. If `render` appears without `rendered`, inspect `surface-runtime-error` and
   browser console errors. The failure is in Arrow compilation, VM execution, or
   the trusted renderer mount path.
4. If `rendered` appears but the UI is not visible, inspect layout constraints
   and artifact CSS.

## Advanced Diagnostic Layers

1. **Structured model output** - the provider returns `summon.arrow-bundle/v1`:
   source files plus optional preview metadata. The server owns all stream
   lines.
2. **Bundle/artifact validation** - malformed Arrow source, unsupported
   bindings, generated network without grants, token drift, and surface-plan
   violations become `ContractIssue` records.
3. **Stream diagnostics** - `StreamGraph` tracks server-emitted preview events,
   Arrow artifact revisions, warning counts, and blocked counts.
4. **Host dispatch** - `PolicyEngine` validates args, runs host handlers, emits
   state patches, and reports handler errors.
5. **Sandbox boundary** - the inline Arrow VM withholds ambient browser APIs;
   Summon removes generated fetch for no-network artifacts and rejects ungranted
   host tool requests.
6. **Replay envelope** - saved surfaces preserve the accepted Arrow artifact,
   compiled surface plan, server stream history, validation issues, stream graph,
   grants, metadata, and token CSS for replay and diagnostics. They do not grant
   new host tools.

## Stream Meta Lines

| Path | Meaning |
| --- | --- |
| `/agent-goal` | Broker-advisory goal inferred from the prompt before host policy narrowing. |
| `/agent-policy-resolution` | Brokered proposed/effective surface config, host policy source, goal source, and rejected tools. |
| `/surface-policy` | Host-owned public surface config selected for this run. |
| `/surface-plan` | Host-owned compiled safety plan selected for this run. |
| `/surface-contract` | Host-owned compact view of the selected policy, narrowed tools/resources, optional layout, and compile issues. |
| `/model-output-mode` | Structured model-output contract details, currently `arrow-bundle` with schema `summon.arrow-bundle/v1` and repair-attempt diagnostics. |
| `/shape` | Optional server-inferred response shape used to narrow direction exemplars. |
| `/token-overrides` | Resolved direction token overrides, including applied and rejected entries. |
| `/validation-summary` | Final grouped `ContractIssue` counts and examples. |
| `/validation-blocked` | A blocking issue stopped generation. |
| `/validation-observed` | Workbench-only observe mode diagnostic for a production-blocking issue that was forwarded to the sandbox for inspection. |
| `/stream-graph-summary` | Final `StreamGraph.snapshot()` for the server stream. |
| `/mode-upgraded` | The server upgraded static generation to interactive mode. |
| `/error` | Server-side generation error or blocked-generation message. |

## Progressive Rendering

Summon streams complete server-owned lines. It does not render provider token
chunks or partial source. Progressive perceived rendering comes from server-emitted
preview events and accepted complete Arrow artifact revisions. The host renders
each accepted revision with `renderArtifact()`.

## Devtools Events

The generate demo records a per-run `EventStore`. Open the **Devtools** drawer
and look for:

- `server-line` - accepted server-emitted `meta`, `event`, or `artifact`
  records after transport parsing.
- `transport-parse-error` - a server transport line was malformed.
- `stream-lifecycle` - client streaming started or ended.
- `surface-mounted` - the inline Arrow sandbox root was created with the current
  host grants.
- `surface-preview-event` - a semantic preview event was accepted before the
  final Arrow artifact mounted.
- `render` - an accepted Arrow artifact was sent to the inline sandbox.
- `rendered` - the inline sandbox finished mounting that Arrow artifact
  revision.
- `tool-called` - generated UI emitted an allowed host tool request.
- `tool-rejected` - generated UI tried an unknown or malformed request.
- `tool-dispatched` / `tool-settled` - `PolicyEngine` ran a host handler.
- `state-pushed` - host state changed and was pushed back to the sandbox.
- `surface-contract` - host-owned compact contract view emitted by the server
  for policy-backed generations.
- `surface-plan` - host-owned compiled safety plan.
- `stream-graph` - client-side artifact diagnostics from
  `StreamGraph.snapshot()`.
- `surface-runtime-error` - Arrow compilation, VM execution, or renderer mount
  failed.
- `surface-disposed` - the inline surface handle was disposed and the sandbox
  root was cleared.

## Reading Contract Issues

`ContractIssue` has this shape:

```ts
interface ContractIssue {
  source: 'protocol' | 'arrow' | 'token' | 'direction' | 'tool' | 'layout' | 'system';
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
- `warningCount` - warning-level validation issues were recorded.
- `blockedCount` - blocking validation issues were recorded.

Server streams end with `/stream-graph-summary`. The demo client also emits
live `stream-graph` events after accepted artifact revisions.
