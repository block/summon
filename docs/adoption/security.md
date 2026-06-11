# Summon Security Posture

Summon's security invariant is simple: generated UI runs in a locked iframe and
can only request host tools the host allowed for that run. The host owns network,
credentials, durable state, native APIs, handlers, and persistence.

The model may propose HTML, CSS, and requests to use host tools. It does not get
ambient access to the parent app, and it cannot give itself new authority.

## Security Boundary

The hard boundary is the browser sandbox:

- `spawnSandbox()` creates a null-origin iframe with `sandbox="allow-scripts"`.
- The sandbox CSP blocks network, external assets, forms, frames, workers,
  object/embed content, and storage-backed same-origin access.
- The bridge accepts only messages carrying the per-sandbox random
  `sandbox_id`.
- Host-owned allowlists (`grantedIntents` and `grantedCapabilities`) decide
  which generated requests can run.
- `PolicyEngine` validates request args before host handlers run.
- Data resources fetch through host-owned handlers and validate returned data
  before pushing state back.
- Trusted host components render outside the iframe after the host validates
  registered component names and props.

The validator is not the security perimeter. It is a contract gate and
diagnostic guide that rejects or warns on unsafe tags, external URLs, inline
handlers, bad args, unknown host tool requests, missing resource states, token
drift, and layout violations before HTML reaches the iframe. If a validator
misses a weird HTML shape, the iframe/CSP/bridge should still contain it.

## Surface Types

Use the narrowest surface type that fits the product experience. The API field
for this choice is `SurfacePolicy.tier`.

| Surface type | API setting | When to use |
| --- | --- | --- |
| Read-only | `SurfacePolicy.tier: "static"` | Summaries, cards, explainers, comparisons, and dashboards. Scripts and host tools are omitted. |
| Declarative interactive | `SurfacePolicy.tier: "declarative"` | Production default for forms, search, pickers, loading/error/data states, foreach lists, and safe attribute binding. Uses only `data-summon-*`. |
| Scripted interactive | `SurfacePolicy.tier: "scripted"` | Restricted pilots that need custom keyboard handling, DOM-local state, or computed presentation that declarative bindings cannot express. |
| Background host work | `SurfacePolicy.tier: "worker"` | Host-owned background work through worker-backed resources/actions. |
| Requires approval | `SurfacePolicy.tier: "approval"` | Operations that require a host approval adapter before the handler runs. |

Declarative interactive surfaces still support clicks, submits,
mount-triggered reads, data resources, loading/error/data bindings, foreach
templates, text binding, and safe image/data attributes. They forbid generated
`<script>` tags. Custom scripts require the scripted surface type.

## Advanced Safety Details

Summon compiles the host-selected `SurfacePolicy` into a stricter `SurfacePlan`
with exact runtime, data, authority, persistence, and script policy for
validation and diagnostics. Shape describes visual composition; posture
describes the act; the surface config describes the public host decision.

Summon also derives a `SurfaceContractView` from the compiled policy. It is a
compact diagnostic and prompt-facing view of the selected policy, narrowed host
tools/resources, narrowed trusted components, optional host layout slots, and
compile issues. It does not grant authority and it does not replace validators
or the `PolicyEngine`.

Generated UI must not emit or widen `/surface-policy`, `/surface-plan`, or
`/surface-contract`. Those meta lines are host-owned diagnostics.

## Trusted Host Components

Trusted host components preserve the same boundary. The model can emit a
placeholder such as `data-summon-component="MetricCard"` with JSON props, but
the actual component code runs only in the host overlay. The sandbox bootstrap
measures placeholders and posts `SUMMON_COMPONENTS` with the per-iframe
`sandbox_id`; the host ignores messages for any other sandbox.

The sandbox can lie about placeholder bounds. That can affect where an overlay
would be placed, so the host island registry clips bounds to the iframe and
rejects empty, offscreen, or oversized rectangles. The sandbox still cannot read
host component DOM, call component methods, import component code, bypass Zod
prop validation, or dispatch durable actions except through the existing
host-allowed request path.

Missing, unknown, or invalid component placeholders fail closed: leave the
sandbox-authored placeholder visible, do not render host DOM, and emit a
component diagnostic event. Replaying a saved envelope with component allowlists
requires a compatible host registry for the same reason.

## Host Rules

- Always pass allowed host tools from a host-owned registry. Use `[]` for
  read-only surfaces. Do not rely on generated declarations for authority.
- Always submit a host-selected surface config for generation. Summon narrows
  host tool and component catalogs from that config and emits compiled safety
  diagnostics before model output.
- Prefer `defineAction` and `defineDataResource`; they keep schemas, prompt
  text, runtime validation, host handlers, and initial state in one place.
- Use `defineWorkerAction` / `defineWorkerResource` for host-owned background
  work and `defineApprovalAction` for operations that require a host approval
  adapter before the handler runs.
- Treat approval as a workflow owned by the host, not a generated modal. For
  approval actions, the host may `prepare` the exact operation into an
  `ApprovalRequest`; the user approves or denies that request in host UI; the
  approved handler executes from `ctx.approval.plan`. Summon core does not
  persist approval requests, and generated surfaces should render only waiting,
  approved, denied, or failed state.
- Proxy external data and assets through host handlers. The sandbox should see
  validated state and data URLs, not credentials or network endpoints.
- Treat component definitions as trusted host code. Register only components
  whose data and authority match the selected surface config.
- Treat custom scripts as an escalation. Prefer declarative bindings unless the
  host can justify the extra behavior and test coverage.
- Run the adversarial browser harness before changing iframe sandbox
  attributes, CSP, postMessage routing, bootstrap startup checks, or script
  execution behavior.

## Test Expectations

Unit tests cover protocol validation, hardening, stream diagnostics, host tool
registry conversion, `PolicyEngine` schema dispatch, and data-resource lifecycle
behavior.

`pnpm test:safety` runs the automated Chromium and WebKit smoke suite for:

- CSP blocking of fetch, XHR, WebSocket, EventSource, beacons, external images,
  external scripts, dynamic imports, eval, and `Function`.
- Null-origin behavior for parent/top access, storage, IndexedDB, and cookies.
- `sandbox_id` routing with multiple iframes and forged messages.
- Component-sync routing, component prop validation, and host-overlay isolation.
- Rejection of unallowed host tool requests and generated permission-escalation
  attempts.
- Bootstrap fatal behavior for unsafe sandbox configuration.
- Strict input overlay tokenization and generate-page boot without server
  credentials.

The manual containment page remains available at
`http://localhost:5173/adversarial.html`. WebKit is the V1 browser proxy for
mobile WebView behavior; native wrapper tests should be added before any mobile
bridge is exposed.
