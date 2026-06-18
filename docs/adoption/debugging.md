# Summon Debugging Guide

Summon diagnostics explain why an Arrow artifact failed, why a generated
control did nothing, or why host-owned data did not appear. Start from the
symptom, then drill into protocol paths and Devtools events only as needed.

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
- `arrow-network-not-granted` - remove generated `fetch()` usage and route data
  through a host tool.
- `surface-policy-*` - fix the host-selected surface config. The compiler
  blocks unknown allowed tools and authority above the selected surface type
  before the model is called.

## Generated Control Did Nothing

Generated controls request host tools through the sandbox bridge. If a control
does not work:

1. Confirm the run is interactive. Read-only surfaces intentionally have no
   allowed host tools.
2. Confirm the host tool exists in `createToolRegistry(...).toContract()`.
3. Confirm the Arrow code invokes only an allowed tool name.
4. Check Devtools for `tool-rejected`, `tool-dispatched`,
   `tool-settled`, and `state-pushed`.
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
5. **Sandbox boundary** - the inline Arrow VM withholds ambient browser APIs;
   Summon removes generated fetch for no-network artifacts and rejects
   ungranted host tool requests.

## Stream Meta Lines

| Path | Meaning |
| --- | --- |
| `/agent-goal` | Broker-advisory goal inferred from the prompt before host policy narrowing. |
| `/agent-policy-resolution` | Brokered proposed/effective surface config, host policy source, goal source, and rejected tools. |
| `/surface-policy` | Host-owned public surface config selected for this run. |
| `/surface-plan` | Host-owned compiled safety plan selected for this run. |
| `/surface-contract` | Host-owned compact view of the selected policy, narrowed tools/resources, optional layout, and compile issues. |
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
- `surface-mounted` - the inline Arrow sandbox root was created with the current
  host grants.
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
- `skippedCount` - raw lines were skipped by parser/hardener.
- `blockedCount` - blocking validation issues were recorded.

Server streams end with `/stream-graph-summary`. The demo client also emits
live `stream-graph` events after accepted artifact revisions.
