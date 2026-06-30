# surface-vm: next steps (post-M0)

Status: plan (2026-06-29). M0 boundary gate is green (5/5 isolation tests pass).

## Where we are

Done in M0:
- `packages/surface-vm` scaffolded (package.json, tsconfigs, registered in root paths).
- `src/protocol.ts` — the owned wire contract (SerializedNode, 6-op VmPatch, plain event snapshot).
- `src/host/runner.ts` — minimal QuickJS runner: `__hostSend` out, `__dispatch` in, fail-closed module loader, globals revoked after boot.
- `test/boundary.test.ts` — proves the four isolation invariants in node, no DOM, no engine.

Deferred from M0 on purpose:
- The host renderer (DOM glue — non-security-critical, needs a DOM).
- A DOM test environment (jsdom/happy-dom not installed).

## Intention (unchanged — re-read before each step)

> Model authors fluent imperative HTML/JS → runs capability-absent in QuickJS →
> ships as one embeddable WebView artifact via one bridge.
> **The protocol is the product. Hold the 6-op line. Don't over-build.**

---

## M1 — Renderer + first real render  ✅ DONE (2026-06-29)

Goal: a `SerializedNode` tree + `VmPatch` stream becomes live DOM, and events
flow back as plain-data snapshots. Still no engine, no model — drive it with
hand-written protocol messages.

Shipped: `host/renderer.ts` (faithful port), `host/mount.ts` (runner↔renderer
seam), `test/dom-env.ts` (happy-dom), `test/renderer.test.ts` (6),
`test/loop.test.ts` (2). 13/13 tests pass; build + typecheck clean.
Exit gate met: end-to-end render→click→patch→DOM loop works; event payloads are
plain JSON data (asserted no live `Node` in payload); no new VmPatch ops needed.

Install note: npm public registry is Cloudflare-blocked in this environment
("dependency confusion"); the project `.npmrc` points at npmjs.org. happy-dom was
installed via the internal Block registry
(`--registry=https://global.block-artifacts.com/artifactory/api/npm/square-npm/`).

### M1.1 DOM test environment
- Add `happy-dom` (lighter than jsdom, good enough) as a devDependency to
  `surface-vm`.
- Wire a tsx/node test that instantiates a document for renderer tests. Keep it
  isolated to this package; do not touch the repo-wide Playwright setup.
- **Decision to make:** happy-dom vs jsdom. Default to happy-dom for speed unless
  an SVG/namespace gap appears.

### M1.2 Port `host/renderer.ts`
- Line-for-line port of the 335-line Arrow renderer, against *our* protocol.ts:
  - `instantiate(SerializedNode)` → createElement/createTextNode/createElementNS(svg),
    fragment, region (comment anchors).
  - `applyPatches(VmPatch[])` → the 6 ops, nothing more.
  - event delegation: one delegated listener per event type on the mount point;
    `nodeId` map; walk-up dispatch; `sanitizeEvent` → `{tagName,id,value,checked,...}`.
- Resist "improving" it. It is the trust-adjacent glue; keep it a faithful port.
- Export `HostRenderer` from index.

### M1.3 Renderer tests
- Static tree mounts to expected DOM.
- Each of the 6 patches mutates correctly (set-text, set/remove-attribute,
  set/clear-event-binding, replace-region).
- `replace-region` tears down old children and inserts new between anchors.
- **Security-adjacent:** a click on a rendered element produces a
  `SandboxedEventPayload` with only the snapshot fields — assert no DOM node
  reference leaks into the payload object.

### M1.4 Runner ↔ renderer loop
- A `mountSurface({ modules, entryPath, root })` helper that wires runner
  `onMessage` → renderer (`render`/`patch`), and renderer events →
  `runner.dispatch({type:'event'})`.
- One end-to-end test: hand-written VM core emits a render, a click dispatches,
  the VM emits a patch, the DOM updates. No engine yet — the VM core is a fixture.

**Exit gate M1:** end-to-end render+event+patch loop works in a DOM; event
payloads remain plain data. No new VmPatch ops were needed.

---

## M2 — The `domjs` engine (the genuinely new code)

Goal: model-authored imperative HTML/JS produces protocol messages. This is the
fluency payoff. Built entirely inside the VM; **not security-critical** (no
capabilities to leak — it only builds plain-data trees).

### M2.1 The core glue (`src/engine/domjs/core.ts`, runs in VM)
- Captures `__hostSend` at import (module scope), installs `globalThis.__dispatch`.
- `allocNodeId()` / `allocHandlerId()` (mirror Arrow's `snode:`/`shandler:`).
- Owns the in-memory mounted tree; `serialize()` → SerializedNode; mutation
  helpers emit VmPatch via `emitPatches`.
- Handler registry: `__dispatch({type:'event'})` → lookup handlerId → invoke
  with the snapshot.

### M2.2 The DOM facade (`src/engine/domjs/facade.ts`, runs in VM)
The v0 DOM the model programs against. **Exactly the subset that maps to the 6
patch ops. Everything else throws a clear, repairable error.**

Supported v0 surface:
- `document.createElement(tag)` → element node; `createElementNS` for svg.
- `document.createTextNode(text)` / `node.textContent =` → set-text.
- `el.setAttribute(name, value)` / `removeAttribute` / `el.className =` /
  `el.id =` → set/remove-attribute.
- `el.append(child)` / `el.appendChild` → tree build (initial render) or, inside
  a region, replace-region.
- `el.addEventListener(type, fn)` → alloc handlerId + set-event-binding;
  `removeEventListener` → clear-event-binding.
- `el.remove()` → region-granular removal.
- A `region(renderFn)` primitive for lists/conditionals → replace-region. This
  is how the model does dynamic lists WITHOUT new patch ops.

Explicitly throws (→ repair loop): `querySelector`, `innerHTML`, `style.*`
object access beyond a string `style` attribute, `parentNode` traversal,
arbitrary `insertBefore` at non-region nodes, anything touching `window`.

### M2.3 State helper (no reactivity framework)
- Ship a tiny `state` + explicit `render()` convention. Plain object; the model
  calls `render()` (or a region's update) after mutating. No proxies, no
  tracking. Imperative is the model's strength — lean in.

### M2.4 domjs tests
- Hand-written HTML/JS samples: button + click + textContent update; a list via
  `region`; attribute toggle; event removal.
- Assert the *emitted protocol messages* are correct (test the engine at the
  protocol boundary, not via DOM — keeps it fast and precise).
- Unsupported-API samples throw the expected repairable error.

**Exit gate M2:** a realistic hand-written HTML/JS surface renders and reacts
through the full runner→renderer loop, using only the 6 patch ops.

---

## M3 — Summon integration (make it a real surface)

Goal: `surface-vm` + `domjs` becomes a selectable Summon runtime, end to end,
behind the experimental flag.

### M3.1 Host bridge (`src/host/bridge.ts`)
- Expose `host-bridge:summon` to the VM: `callTool`, `getState`, `onState` —
  identical contract to today's `inline-surface.ts` (lines ~457-471).
- Port the bridge plumbing from Arrow's quickjs host (the
  `__arrowHostBridge`/host-bridge module loader path), reduced to summon's three
  functions. This re-introduces a capability channel — **add bridge isolation
  tests** (ungranted tool name rejected; args are plain data only).

### M3.2 Output runtime + plan
- Add `'domjs-control'` to `SummonOutputRuntime` / `SUMMON_OUTPUT_RUNTIME_VALUES`
  / `RUNTIME_PROFILES` in `packages/engine/src/output-runtime.ts`:
  `{ format:'html', delivery:'bundle', trust:'sandboxed', experimental:true }`.
- Decide the artifact shape: a `domjs` bundle `{ schema, source:{'main.js', 'main.css'?} }`
  paralleling the arrow/html bundles. Reuse the bundle-normalization patterns in
  `arrow-bundle.ts`.

### M3.3 Validator + repair
- A small validator for the domjs bundle: valid JS entry, single entry file,
  size limit, and a static check for facade-unsupported APIs (the
  `querySelector`/`innerHTML`/`window` set) → repairable issue codes.
- Register those codes in the `repairable` set in
  `packages/server/src/runtime/bundle.ts` and add hints in `contracts.ts`.
- Reuse `html-artifact.ts` CSS/url allowlists for `main.css`.

### M3.4 Prompt block
- A short authoring block (inverse of `arrow-subset.ts`): teach the supported
  DOM facade subset. It is short *because* this is the model's strength — the
  whole point of the project. Emphasize: use `region(...)` for lists; no
  `querySelector`/`innerHTML`/`window`; call host tools via `host-bridge:summon`.

### M3.5 Wire into inline-surface
- Add a `domjs` branch in `inline-surface.ts::renderArtifact` that mounts via
  `surface-vm` instead of `@arrow-js/sandbox`. Keep the Arrow branch untouched.
- This is where the M1 `mountSurface` helper pays off.

### M3.6 App-level safety
- NOW port the relevant `tests/safety-smoke.spec.ts` cases against a `domjs`
  surface in the real app: no browser globals, no generated network, ungranted
  tool rejected, no parent-DOM access. This is the app-level complement to M0's
  VM-level gate.

**Exit gate M3:** generate a domjs surface from a prompt in the demo, it renders,
a granted tool call round-trips, and the safety suite passes.

---

## M4 — Measure & decide

Goal: evidence, not vibes. Is fluent-HTML/JS worth it vs Arrow / Strategy A?

- Add `domjs-control` to `scripts/runtime-bakeoff.mjs` runtime matrix.
- Run the bakeoff across the existing fingerprint prompt sets; compare:
  - first-pass acceptance rate vs `arrow-control`,
  - repair attempts to green,
  - runtime-crash rate (the metric that started this whole investigation).
- Optional: also compare against the Strategy A path if it exists by then.

**Decision point:**
- If domjs materially out-yields Arrow (higher first-pass, fewer runtime crashes)
  → promote toward first-class; consider it the default for imperative surfaces.
- If not → we learned it cheaply; keep Arrow, archive domjs behind the flag.

---

## Cross-cutting discipline (the anti-over-engineering contract)

- **6 patch ops. No more.** If a prompt seems to need `insert-node`, first try to
  express it with `replace-region`. Only extend the protocol with bakeoff
  evidence that regions are genuinely insufficient — and remember we own the
  protocol, so it's a deliberate, versioned change, not a casual one.
- **Facade grows only by evidence.** Each new DOM method must be justified by a
  real rejected prompt, and must map cleanly to existing patches.
- **No engine plugin framework.** One engine (domjs). We are not re-hosting
  Arrow inside surface-vm.
- **Renderer/runner stay faithful ports.** Divergence from upstream
  `@arrow-js/sandbox` VM-escape fixes is a risk — keep a short sync checklist;
  don't refactor for elegance.
- **Test at the protocol boundary** wherever possible (fast, precise) and reserve
  DOM/app tests for the integration seams.

## Sequencing summary

```
M1  renderer + DOM env + render/event/patch loop      (no model)   ← next
M2  domjs engine: HTML/JS -> protocol                 (no model)
M3  Summon integration: bridge, runtime, validator, prompt, mount, app-safety
M4  bakeoff + decision
```

Each milestone is independently valuable and has a hard exit gate. Build the
boundary and the loop before the fluency; build the fluency before the
integration; build the integration before claiming a win.

## Immediate next action

Start **M1.1 + M1.2**: add happy-dom to `surface-vm`, port `host/renderer.ts`
against our protocol, and write the renderer unit tests (M1.3). That unblocks the
full runner↔renderer loop (M1.4) and is the smallest next increment that keeps
the boundary-before-fluency discipline.
