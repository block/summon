# Summon Security Posture

Summon is production-oriented because generated UI runs behind a host-owned
boundary. The model can propose HTML, CSS, and intent declarations, but it does
not receive network, credentials, durable storage, parent DOM access, or handler
execution.

## Security Boundary

The hard boundary is:

- `spawnSandbox()` creates a null-origin iframe with `sandbox="allow-scripts"`.
- The sandbox CSP blocks network, external assets, forms, frames, workers,
  object/embed content, and storage-backed same-origin access.
- The bridge accepts only messages carrying the per-sandbox random
  `sandbox_id`.
- `grantedIntents` and `grantedCapabilities` come from the host. Artifact
  declarations are advisory.
- `PolicyEngine` validates intent args before host handlers run.
- Data resources fetch through host-owned handlers and validate returned data
  before pushing state back.
- Component islands render trusted host DOM outside the iframe after the host
  validates registered component names and props.

The validator is not the security perimeter. It is a contract gate and repair
guide that rejects or warns on unsafe tags, external URLs, inline handlers, bad
args, unknown intents, missing resource states, token drift, and layout
violations before HTML reaches the iframe. If a validator misses a weird HTML
shape, the iframe/CSP/bridge should still contain it.

## Production Tiers

Use the narrowest tier that fits the host surface.

| Tier | Contract | When to use |
| --- | --- | --- |
| Static | `mode: "static"` | Read-only summaries, cards, explainers, comparisons, and dashboards. Scripts and capabilities are omitted. |
| Declarative interactive | `mode: "interactive", scriptPolicy: "forbid"` | Production default for forms, search, pickers, loading/error/data states, foreach lists, and safe attribute binding. Uses only `data-summon-*`. |
| Scripted interactive | `mode: "interactive", SurfacePlan.runtime: "scripted", scriptPolicy: "allow"` | Restricted pilots that need custom keyboard handling, DOM-local state, or computed presentation that declarative bindings cannot express. |

Declarative interactive still supports clicks, submits, mount-triggered reads,
data resources, loading/error/data bindings, foreach templates, text binding,
and safe image/data attributes. It forbids generated `<script>` tags. Custom
scripts require both a scripted `SurfacePlan` runtime and
`scriptPolicy: "allow"`.

Surface planning is orthogonal to these tiers. `SurfacePlan` describes the
product lifecycle contract: purpose (`inform`, `compare`, `collect`, `explore`,
`operate`, `review`, `export`), runtime (`static`, `declarative`, `scripted`,
`worker`), data (`embedded`, `host-resource`, `worker`), authority (`none`,
`read`, `host-action`, `approval-gated`), and persistence (`ephemeral`,
`replayable`). Shape describes visual composition; posture describes the act;
mode/scriptPolicy describes sandbox execution; SurfacePlan describes the whole
surface boundary.

## Component Islands

Component islands preserve the same strict boundary. The model can emit a
placeholder such as `data-summon-component="MetricCard"` with JSON props, but
the actual component code runs only in the host overlay. The sandbox bootstrap
measures placeholders and posts `SUMMON_COMPONENTS` with the per-iframe
`sandbox_id`; the host ignores messages for any other sandbox.

The sandbox can lie about placeholder bounds. That can affect where an overlay
would be placed, so the host island registry clips bounds to the iframe and
rejects empty, offscreen, or oversized rectangles. The sandbox still cannot read
host component DOM, call component methods, import component code, bypass Zod
prop validation, or dispatch durable actions except through the existing
host-granted intent path.

Missing, unknown, or invalid component placeholders fail closed: leave the
sandbox-authored placeholder visible, do not render host DOM, and emit a
component diagnostic event. Replaying a saved envelope with component grants
requires a compatible host registry for the same reason.

## Host Rules

- Always pass `grantedIntents` from a host-owned registry. Do not rely on
  `artifact.intents` for LLM-authored artifacts.
- Prefer `defineAction` and `defineDataResource`; they keep schemas, prompt
  text, runtime validation, host handlers, and initial state in one place.
- Use `defineWorkerAction` / `defineWorkerResource` for host-owned background
  work and `defineApprovalAction` for operations that require a host approval
  adapter before the handler runs.
- Proxy external data and assets through host handlers. The sandbox should see
  validated state and data URLs, not credentials or network endpoints.
- Treat component definitions as trusted host code. Register only components
  whose data and authority surface matches the selected `SurfacePlan`.
- Treat custom scripts as an escalation. Prefer declarative bindings unless the
  host can justify the extra behavior and test coverage.
- Run the adversarial browser harness before changing iframe sandbox
  attributes, CSP, postMessage routing, bootstrap startup checks, or script
  execution behavior.

## Test Expectations

Unit tests cover protocol validation, hardening, stream graph health,
capability registry conversion, PolicyEngine schema dispatch, and data-resource
lifecycle behavior.

`pnpm test:safety` runs the automated Chromium and WebKit smoke suite for:

- CSP blocking of fetch, XHR, WebSocket, EventSource, beacons, external images,
  external scripts, dynamic imports, eval, and `Function`.
- Null-origin behavior for parent/top access, storage, IndexedDB, and cookies.
- `sandbox_id` routing with multiple iframes and forged messages.
- Component-sync routing, component prop validation, and host-overlay isolation.
- Ungranted intent rejection and artifact-declared intent escalation attempts.
- Bootstrap fatal behavior for unsafe iframe configuration.
- Strict input overlay tokenization and generate-page boot without server
  credentials.

The manual containment page remains available at
`http://localhost:5173/adversarial.html`. WebKit is the V1 browser proxy for
mobile WebView behavior; native wrapper tests should be added before any mobile
bridge is exposed.
