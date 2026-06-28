# Summon Security Posture

Summon's security invariant is simple: generated UI can only request host tools
the host allowed for that run. The host owns network, credentials, durable
state, native APIs, handlers, approvals, and persistence.

The model may propose Arrow source, CSS, preview events, and requests to use
host tools. It does not get ambient access to the parent app, and it cannot give
itself new authority.

## Security Boundary

The current boundary is the inline Arrow sandbox:

- `mountInlineSurface()` mounts accepted Arrow source into an `<arrow-sandbox>`
  element.
- User-authored logic runs inside Arrow's QuickJS/WASM VM, not in the page's
  `window` realm.
- The host page mutates the real DOM only through Arrow's trusted renderer.
- The VM does not receive direct `window`, `document`, DOM nodes, storage,
  cookies, parent frame, or native bridge access.
- Host-owned allowlists (`grantedTools` and `validationTools`) decide which
  generated requests can run.
- `PolicyEngine` validates request args before host handlers run.
- Data resources fetch through host-owned handlers and validate returned data
  before pushing state back.
- Generated network access is off by default. For `network: "none"` surfaces,
  validation blocks generated `fetch()` usage and the inline runtime removes
  the Arrow VM's fetch global before mounting.

The validator is not the only security perimeter. It is a contract gate and
diagnostic guide that rejects or warns on malformed Arrow artifacts,
unsupported Arrow template bindings, unsafe URLs, bad args, unknown host tool
requests, missing resource states, token drift, layout violations, and
ungranted generated network usage before an artifact renders. Runtime defenses
still enforce tool allowlists and remove default network access for no-network
artifacts.

Experimental HTML runtimes use a separate iframe posture and remain research
targets, not the production default. `html-static` accepts a validated HTML/CSS
bundle and rejects scripts, external URLs, unsafe tags, inline handlers, and
unsupported Summon bindings before the iframe mounts. `html-stream` renders provider
patch text first in an inert preview iframe with `script-src 'none'`; committed
HTML reaches the iframe only after a complete patch frame validates. Generated
scripts are never accepted: the scripted `html-script` and unsafe raw HTML
stream runtimes were removed, so no runtime mounts model-authored JavaScript in
an iframe.

## Surface Types

Use the narrowest surface type that fits the product experience. The API field
for this choice is `SurfacePolicy.tier`.

| Surface type | API setting | When to use |
| --- | --- | --- |
| Read-only | `SurfacePolicy.tier: "static"` | Summaries, cards, explainers, comparisons, and dashboards. Host tools are omitted. |
| Arrow interactive | `SurfacePolicy.tier: "declarative"` | Production default for forms, search, pickers, loading/error/data states, and result lists. Generates Arrow runtime artifacts that call host tools through `host-bridge:summon`; the tier name remains `declarative` for API compatibility. |
| Background host work | `SurfacePolicy.tier: "worker"` | Host-owned background work through worker-backed resources/actions. |
| Requires approval | `SurfacePolicy.tier: "approval"` | Operations that require a host approval adapter before the handler runs. |

Declarative interactive surfaces support clicks, submits, mount-triggered reads,
data resources, loading/error/data bindings, foreach templates, text binding,
safe image/data attributes, local ephemeral state, and host-owned motion
recipes. Generated `<script>` tags, transport/section protocols, raw HTML
streaming, and component island placeholders are not public artifact tools.

## Advanced Safety Details

Summon compiles the host-selected `SurfacePolicy` into a stricter `SurfacePlan`
with Arrow runtime diagnostics, data, authority, persistence, and network
metadata for validation and diagnostics. Shape describes visual composition;
posture describes the act; the surface config describes the public host
decision. Generated artifacts are always Arrow sandbox source trees; scripted-plan
request fields are rejected before generation.

Summon also derives a `SurfaceContractView` from the compiled policy. It is a
compact diagnostic and prompt-facing view of the selected policy, narrowed host
tools/resources, optional host layout slots, and compile issues. It does not
grant authority and it does not replace validators or the `PolicyEngine`.

Generated UI must not emit or widen `/surface-policy`, `/surface-plan`, or
`/surface-contract`. Those meta lines are host-owned diagnostics.

## Host Rules

- Always pass allowed host tools from a host-owned registry. Use `[]` for
  read-only surfaces. Do not rely on generated declarations for authority.
- Always submit a host-selected surface config for generation. Summon narrows
  host tool catalogs from that config and emits compiled safety diagnostics
  before model output.
- Prefer `defineAction` and `defineDataResource`; they keep schemas, prompt
  text, runtime validation, host handlers, and initial state in one place.
- Use `defineWorkerAction` / `defineWorkerResource` for host-owned background
  work and `defineApprovalAction` for operations that require a host approval
  adapter before the handler runs.
- Use controlled action state for merchant-facing pending, success, and error
  UI. Generated surfaces should render those keys; they should not invent local
  completion or failure state for host actions.
- Treat approval as a workflow owned by the host, not a generated modal. For
  approval actions, the host may `prepare` the exact operation into an
  `ApprovalRequest`; the user approves or denies that request in host UI; the
  approved handler executes from `ctx.approval.plan`. Summon core does not
  persist approval requests, and generated surfaces should render only waiting,
  approved, denied, or failed state.
- Proxy product data and assets through host handlers. The sandbox should see
  validated state and data URLs, not credentials or network endpoints.
- Use Arrow local state and motion primitives for tabs, disclosures, selection,
  staged reveal, and visual feedback.
- Do not grant custom generated scripts; script-control request fields
  are rejected before generation.
- Run the adversarial browser harness before changing inline runtime, Arrow
  bridge, generated network policy, or tool-dispatch behavior.

## Test Expectations

Unit tests cover protocol validation, hardening, stream diagnostics, host tool
registry conversion, `PolicyEngine` schema dispatch, generated network rejection,
and data-resource lifecycle behavior.

The safety harness should cover:

- QuickJS/Arrow VM absence of ambient browser globals such as `window`,
  `document`, storage, XHR, WebSocket, workers, and native bridge APIs.
- Generated `fetch()` unavailability for no-network surfaces.
- Rejection of unallowed host tool requests and generated permission-escalation
  attempts.
- Stream validation rejection for malformed Arrow artifacts, transport/section
  protocols, `data-summon-*` bindings, and unsupported Arrow bindings.
- HTML runtime safety: `html-static` blocks scripts and unsafe HTML before
  mounting, and `html-stream` keeps preview deltas inert until validated patch
  commits. No HTML runtime mounts model-authored scripts.
- Generate-page boot without server credentials.

The manual containment page remains available at
`http://localhost:5173/adversarial`. WebKit remains the browser proxy for mobile
WebView behavior; native wrapper tests should be added before any mobile bridge
is exposed.
