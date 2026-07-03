# Surface Document successor plan

> Date: 2026-07-02
>
> Status: **adopted** (2026-07-02). Surface Document is the sole Summon
> runtime. The Arrow/domjs/html runtimes and the `experimentalRuntime` request
> field were removed the same day — there is no runtime selection anywhere in
> the system. Generated UI is emitted as `main.html` + `main.css` + optional
> `main.js`, rendered through Summon's owned descriptor runtime and governed by
> Ghost fingerprint conformance + receipts.

## North-star decision

We are not building "domjs with an optional HTML helper."

We are building the successor contract:

```txt
Surface Document
├── main.html  → inert structure
├── main.css   → fingerprint expression
└── main.js    → optional governed behavior
```

Under the hood, it reuses the best parts of current domjs:

- owned QuickJS VM
- descriptor DOM facade
- `state()`
- `region()`
- `callTool()`
- trusted protocol renderer
- no ambient DOM/network/window/storage

But the authoring model becomes a document, not imperative construction.

That matters because Summon's product claim is:

> generated UI with a design authority, returned as a contract with a verdict
> and receipt.

The document split makes the contract citable.

## Why Surface Document

Current domjs proved the important safety and fluency pieces:

- owned VM runtime
- descriptor renderer
- reactive state
- event bridge
- `callTool`
- no ambient DOM
- no `fetch`
- no `window`
- no real browser execution

But its authoring shape is still verbose. It asks the model to build design
structure procedurally:

```js
const root = document.createElement('main');
root.className = 'stage';

const hero = document.createElement('section');
hero.className = 'hero';

const h1 = document.createElement('h1');
h1.textContent = 'Signal Stream';

hero.append(h1);
root.append(hero);

export default root;
```

The successor keeps domjs's containment, but replaces imperative construction as
primary design surface:

```html
<main class="stage">
  <section class="hero">
    <p class="eyebrow">SIG-00 // CONTROL PANEL</p>
    <h1>Signal Stream</h1>
  </section>

  <section id="panel"></section>
</main>
```

Then behavior wires the moving parts:

```js
const panel = document.getElementById('panel');

panel.replaceChildren(region(() => {
  if (state.tab === 'overview') return overviewPanel();
  if (state.tab === 'activity') return activityPanel();
  return settingsPanel();
}));
```

This gives the model native forms for each job:

| Job | Best artifact form |
| --- | --- |
| composition / information hierarchy | `main.html` |
| typography / spacing / color / material | `main.css` |
| interaction posture / behavior | `main.js` |
| capability boundary | `callTool` contract |
| conformance / receipt | parsed artifact + render |

This is stronger than Arrow because it keeps markup density without a third-party
runtime or tagged-template dialect. It is stronger than imperative-only domjs
because structure becomes readable, inspectable, and citable.

One sentence:

> Summon should generate documents, not components; execute behavior, not
> markup; and govern the whole thing as a citable artifact.

---

# Successor contract

## Bundle shape

```json
{
  "schema": "summon.surface-document/v1",
  "runtime": "surface-document",
  "source": {
    "main.html": "...",
    "main.css": "...",
    "main.js": "..."
  }
}
```

Rules:

- `main.html` is required.
- `main.css` is required for generated/fingerprint surfaces.
- `main.js` is optional.
- No other files in v1 unless explicitly allowed by the spec.

## Runtime modes

| Mode | Files | Governance posture |
| --- | --- | --- |
| inert document | `main.html` + `main.css` | inert-safe, design-governed |
| governed behavior | `main.html` + `main.css` + `main.js` | fully governed behavior via VM/tool chokepoint |

### Inert document mode

If there is no `main.js`, Summon parses `main.html`, validates `main.css`, and
renders the surface. No JS. No events. No tool calls.

This is useful for:

- landing pages
- product cards
- empty states
- reports
- editorial surfaces
- read-only dashboards

### Governed behavior mode

If there is `main.js`, Summon parses `main.html` into the descriptor DOM, then
runs `main.js` in QuickJS against the owned facade.

The model can do:

```js
const count = state({ value: 0 });

document.getElementById('increment').onclick = () => {
  count.value += 1;
};

document.getElementById('total').textContent = () => count.value;
```

But it still cannot do:

```js
fetch(...)
window.location = ...
localStorage.setItem(...)
document.body.innerHTML = ...
```

The only authority channel remains:

```js
await callTool('search', { query });
```

---

# Security model

`main.html` is not `innerHTML`.

We do not hand generated HTML to the browser parser. We parse it into a safe
descriptor tree and render through Summon's trusted renderer.

Reject:

```html
<script>
```

```html
<button onclick="steal()">
```

```html
<iframe>
```

```html
<img src="javascript:...">
```

Potentially reject or restrict in v1:

```html
<style>
```

because style belongs in `main.css`.

Behavior still runs in QuickJS. The JS never gets the real DOM. It gets the
facade. That preserves the core claim:

> generated code can only act through observable, declared mechanisms.

---

# How `main.js` sees `main.html`

The VM should boot with a document already created from the parsed HTML. Model
code can then write normal DOM-shaped code:

```js
const button = document.getElementById('approve');
const status = document.querySelector('[data-ref="status"]');

button.onclick = async () => {
  status.textContent = 'Requesting approval…';
  const result = await callTool('requestApproval', { id: 'INC-2417' });
  status.textContent = result.approved ? 'Approved' : 'Rejected';
};
```

Supported scoped query APIs in v1:

- `document.getElementById()`
- `document.querySelector()`
- `document.querySelectorAll()`
- `element.querySelector()`
- `element.querySelectorAll()`

Selector subset for v1:

- `#id`
- `.class`
- tag
- `[data-ref="x"]`
- `[data-role="x"]`

Full CSS selector support is explicitly out of scope for v1.

Previously domjs banned these APIs because there was no declared tree to query.
In Surface Document, querying the declared structure is the point. This is not a
safety loosening; the queried tree is the fake descriptor DOM, scoped to the
surface.

---

# Full example

## `main.html`

```html
<main class="incident-brief">
  <header class="brief-header">
    <p class="kicker">ON-CALL // INCIDENT 2417</p>
    <h1>Webhook retry loop saturating queue workers</h1>
    <p class="deck">
      Agent evidence points to a retry policy regression after the 12:04 deploy.
    </p>
  </header>

  <section class="status-strip">
    <article>
      <span class="label">Severity</span>
      <strong>P2</strong>
    </article>
    <article>
      <span class="label">Blast radius</span>
      <strong>Checkout webhooks</strong>
    </article>
    <article>
      <span class="label">Next action</span>
      <strong id="next-action-label">Rollback candidate</strong>
    </article>
  </section>

  <section class="evidence-layout">
    <ol id="evidence-list" class="evidence-list"></ol>

    <aside class="action-card">
      <h2>On-call action</h2>
      <p id="action-copy">
        Stage rollback and verify queue depth drops under 500.
      </p>
      <button id="stage-rollback">Stage rollback</button>
      <p id="action-status" class="status-note">Awaiting action.</p>
    </aside>
  </section>
</main>
```

## `main.css`

```css
.incident-brief {
  min-height: 100%;
  background: var(--color-bg);
  color: var(--color-text);
  font-family: var(--font-sans);
  padding: 48px;
}

.kicker {
  font-family: var(--font-mono);
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--color-text-muted);
}

.brief-header h1 {
  max-width: 12ch;
  font-size: clamp(48px, 8vw, 96px);
  line-height: 0.92;
  letter-spacing: -0.06em;
}

.status-strip {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  border-top: 1px solid var(--color-border);
  border-bottom: 1px solid var(--color-border);
}

.evidence-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 360px;
  gap: 32px;
}

.action-card {
  border: 1px solid var(--color-border);
  padding: 24px;
}
```

## `main.js`

```js
const ui = state({
  staged: false,
  evidence: [
    ['12:04', 'Deploy introduced webhook retry policy change.'],
    ['12:11', 'Queue depth crossed 8,200 jobs.'],
    ['12:18', 'Agent reproduced retry loop with synthetic payload.']
  ]
});

const evidenceList = document.getElementById('evidence-list');
const button = document.getElementById('stage-rollback');
const status = document.getElementById('action-status');
const label = document.getElementById('next-action-label');

evidenceList.replaceChildren(region(() =>
  ui.evidence.map(([time, text]) => {
    const item = document.createElement('li');

    const stamp = document.createElement('span');
    stamp.className = 'time';
    stamp.textContent = time;

    const copy = document.createElement('p');
    copy.textContent = text;

    item.append(stamp, copy);
    return item;
  })
));

button.onclick = async () => {
  status.textContent = 'Staging rollback…';

  const result = await callTool('stageRollback', {
    incident: 'INC-2417'
  });

  ui.staged = true;
  label.textContent = 'Verify queue recovery';
  status.textContent = result.ok
    ? 'Rollback staged. Watch queue depth for 10 minutes.'
    : 'Rollback failed. Escalate to platform.';
};

button.disabled = () => ui.staged;
```

The HTML tells you composition. The CSS tells you fingerprint expression. The JS
tells you behavior and authority.

---

# Phased implementation plan

## Phase 0 — Contract spec and repo grounding

**Goal:** Define exactly what Surface Document is before code fans out.

### Deliverables

Create the first version of the spec:

```txt
docs/surface-document.md
```

It should define:

- artifact shape
- runtime modes
- hard security invariants
- allowed/disallowed HTML
- CSS expectations
- scoped DOM API
- behavior API
- conformance/receipt expectations

### Gate

Human signoff on the spec.

No runtime work before this spec exists. Otherwise we risk another half-runtime
with ambiguous semantics.

---

## Phase 1 — HTML parser → protocol tree

**Goal:** Parse `main.html` into the same safe descriptor tree the renderer
already consumes.

Current target substrate:

```txt
packages/surface-vm/src/protocol.ts
```

The existing `SerializedNode` shape is already close to what Surface Document
needs:

```ts
SerializedElementNode
SerializedTextNode
SerializedFragmentNode
SerializedRegionNode
```

### Build

Add a host-side parser module, likely:

```txt
packages/surface-vm/src/engine/surface-document/html.ts
```

or, if kept under domjs initially:

```txt
packages/surface-vm/src/engine/domjs/html-template.ts
```

Preferred long-term naming is `surface-document`, because this is the successor
contract, not merely an extension of domjs.

Expose something like:

```ts
parseSurfaceHtml(html: string): {
  tree: SerializedNode;
  diagnostics: ContractIssue[];
}
```

### Sanitization rules

Reject:

- `<script>`
- inline `on*` attributes
- `<iframe>`
- `<object>`
- `<embed>`
- unsafe `<link>` forms
- `javascript:` URLs
- unsupported tags

Probably reject in v1:

- `<style>`

Allow normal structural HTML:

- `main`, `section`, `article`, `aside`, `header`, `footer`, `nav`
- `h1`-`h6`, `p`, `span`, `strong`, `em`, `small`
- `ul`, `ol`, `li`
- `button`, `input`, `textarea`, `select`, `option`, `label`
- `table`, `thead`, `tbody`, `tr`, `th`, `td`
- SVG subset only if already supported

### Tests

- accepts normal structure
- rejects `<script>`
- rejects `onclick`
- rejects `javascript:` URL
- rejects unsupported tags
- preserves ids/classes/data attributes
- normalizes boolean attrs
- caps depth/node count/source bytes

### Gate

A malicious `main.html` cannot execute anything and cannot escape the descriptor
protocol.

---

## Phase 2 — VM hydration and scoped document querying

**Goal:** Let `main.js` query and mutate the parsed `main.html` tree inside the
fake DOM.

Current substrate:

```txt
packages/surface-vm/src/engine/domjs/vm/facade.ts
packages/surface-vm/src/engine/domjs/vm/core.ts
packages/surface-vm/src/engine/domjs/index.ts
```

Right now model-authored JS builds the root:

```js
const root = document.createElement('main');
export default root;
```

Successor behavior:

```js
const button = document.getElementById('stage-rollback');
button.onclick = ...;
```

No `export default root` required when `main.html` exists.

### Build

Extend module building from:

```ts
buildDomjsModules({ entry })
```

to something like:

```ts
buildSurfaceDocumentModules({
  htmlTree,
  behaviorEntry?: string
})
```

The bootstrap should:

1. import the facade
2. construct a fake document from the sanitized template tree
3. install globals:
   - `document`
   - `state`
   - `reactive`
   - `region`
   - `callTool`
   - `getState`
   - `onState`
4. import `main.js` if present
5. mount the document root

### Query support

Start with:

- `document.getElementById()`
- `document.querySelector()`
- `document.querySelectorAll()`
- `element.querySelector()`
- `element.querySelectorAll()`

Selector subset:

- `#id`
- `.class`
- tag
- `[data-ref="x"]`
- `[data-role="x"]`

Do not implement the full CSS selector spec in v1.

### Mutation support

All existing domjs mutation wins carry forward:

- `textContent = ...`
- `className = ...`
- `classList`
- `style`
- `append`
- `replaceChildren`
- `insertBefore`
- `removeChild`
- function-valued bindings
- `region(() => ...)`

### Tests

Example fixture:

```html
<main>
  <button id="inc">Increment</button>
  <span id="total">0</span>
</main>
```

```js
const s = state({ count: 0 });
document.getElementById('inc').onclick = () => s.count++;
document.getElementById('total').textContent = () => s.count;
```

Assert:

- initial render contains `0`
- click dispatch updates to `1`
- no real DOM access exists
- query APIs are scoped to template tree
- detached/dynamic nodes still serialize correctly

### Gate

A Surface Document with `main.html + main.js` can render and interact through the
existing protocol renderer, with no new patch ops.

---

## Phase 3 — Engine artifact, schema, and validation

**Goal:** Make Surface Document a first-class artifact in the engine.

Likely files/classes to touch:

```txt
packages/engine/src/*
packages/engine/src/domjs-artifact.ts
packages/engine/src/domjs-bundle.ts
packages/engine/src/contracts.ts
packages/server/src/runtime/*
```

### Add new artifact type

```ts
interface SurfaceDocumentArtifact {
  runtime: 'surface-document';
  source: {
    'main.html': string;
    'main.css': string;
    'main.js'?: string;
  };
}
```

Do not hide this as domjs forever. The name matters. The product contract is
Surface Document.

### Validation layers

#### HTML validation

- parseable
- inert
- sanitized
- size/depth/node-count capped
- no event attributes
- no script/style injection

#### CSS validation

Current first pass:

- parseable enough to scan
- no dangerous `url(javascript:)`
- no external imports
- later: token/fingerprint checks

#### JS validation

Reuse domjs safety checks:

- no `fetch`
- no `XMLHttpRequest`
- no `WebSocket`
- no `window`
- no `document.body`
- no `innerHTML`
- no `outerHTML`
- no `eval`
- no unsupported ambient APIs

But update query rules:

- `document.getElementById` is now allowed
- `querySelector` is now allowed with scoped semantics
- runtime HTML injection remains banned

### Tests

- valid static document normalizes
- valid interactive document normalizes
- missing `main.html` blocks
- inline `onclick` blocks with repair hint
- `main.js` using `fetch` blocks
- `main.js` using `getElementById` validates clean
- `innerHTML` still blocks

### Gate

The engine can accept/reject Surface Document artifacts without touching provider
prompts yet.

---

## Phase 4 — Server runtime profile

**Goal:** Add a real runtime profile without replacing everything yet.

Likely new file:

```txt
packages/server/src/runtime/surface-document.ts
```

Runtime name:

```txt
surface-document
```

or, during experimentation:

```txt
surface-document-control
```

Recommendation: use `surface-document` internally and gate it behind an
experimental flag if needed. The contract is the thing.

### Server responsibilities

- request model output as Surface Document bundle
- normalize artifact
- validate artifact
- run repair loop
- emit artifact
- mount/render through existing host path
- include source in conformance/receipt

Important lesson from 2026-07-02: conformance previously skipped domjs artifacts
because `extractArtifactSource` filtered to `runtime === 'arrow'`. Surface
Document must participate in Govern and Account from day one.

### Tests

- generation summary accepts static Surface Document
- generation summary accepts interactive Surface Document
- validation-blocked lines include full issues
- blocked source dumps include `main.html`, `main.css`, `main.js`
- conformance sees all files

### Gate

A static Surface Document and an interactive Surface Document can be accepted by
server runtime and rendered in the demo/workbench.

---

## Phase 5 — Prompt/schema/repair mirrors in one change set

**Goal:** Teach the model the new contract without mirror drift.

This is the highest-risk phase. Prompt, schema, validator, and repair hints must
move together.

### Schema language

The schema should say:

```txt
Produce a Summon Surface Document with source files:
- main.html: inert HTML structure only
- main.css: styling
- main.js: optional behavior using scoped DOM APIs, state, region, callTool
```

Hard prohibitions:

- no scripts in `main.html`
- no `on*` attributes in `main.html`
- no inline dynamic HTML
- no network APIs
- no ambient browser APIs
- no undeclared tools

### Prompt contract

The model-facing guidance becomes:

> Structure in `main.html`, visual fingerprint in `main.css`, behavior in
> `main.js`.

This replaces imperative `document.createElement` boilerplate guidance as the
default.

### Worked examples

Embed examples only after executing them in the VM.

Minimum examples:

1. static fingerprint card
2. counter
3. tabs with region
4. host-tool search surface
5. approval/action surface

### Repair hints

Examples:

- `html-inline-handler`: Move event behavior from an `onclick` attribute into
  `main.js` using `document.getElementById(...).onclick = ...`.
- `html-script-tag`: Remove `<script>` from `main.html`; put behavior in
  `main.js`.
- `js-network-not-granted`: Use `callTool()` instead of network APIs.
- `css-fingerprint-token`: Use available fingerprint tokens or explainable CSS
  from the provided token sheet.

### Lockstep test

Add a test whose only job is to prevent mirror drift:

```txt
canonical Surface Document example
→ schema-validates
→ validator accepts
→ VM executes
→ conformance receives source
→ repair no-op
```

### Gate

The model can generate accepted Surface Documents first-pass on at least the
standard 8-prompt audit set.

---

## Phase 6 — Conformance and receipt become sharper

**Goal:** Make Surface Document pay off for Summon's thesis.

This is where the split becomes more than authoring ergonomics.

### Deterministic checks

Against `main.html`:

- required structural motifs
- count of evidence cards/modules
- presence of action region
- hierarchy rules
- landmark usage
- selector citations with line numbers

Against `main.css`:

- token usage
- forbidden elevation/shadow posture
- typography families
- color/material constraints
- motion preferences

Against `main.js`:

- tool call names
- handler presence
- forbidden capability usage
- interaction affordance wiring

### Receipt

The receipt should include per-file hashes:

```json
{
  "artifact": {
    "main.html": {
      "hash": "...",
      "nodes": 42,
      "citations": []
    },
    "main.css": {
      "hash": "...",
      "tokensUsed": []
    },
    "main.js": {
      "hash": "...",
      "toolsReferenced": []
    }
  }
}
```

### Fix the interim evaluator weakness

Current issue: conformance clamps artifact source to around 12K chars and
LLM-judges text, not render.

For Surface Document:

- do not truncate blindly
- chunk per file if needed
- deterministic checks first
- LLM/prose checks advisory second
- later: render screenshots for visual judgment

### Gate

A failed check can cite the right file and location:

```txt
main.html:18 — expected at least three evidence modules; found one.
main.css:42 — box-shadow violates flat-depth-no-shadow-elevation.
main.js:27 — calls undeclared tool "approveInvoice".
```

This is the moment Surface Document becomes visibly tied to Summon's thesis.

---

## Phase 7 — Measurement and migration

**Goal:** Prove the successor before making it default.

### Audit arms

Run:

```txt
arrow-control
domjs-control
surface-document
```

Then eventually:

```txt
domjs-control
surface-document
```

Metrics:

- acceptance
- first-pass acceptance
- repair count
- safety violations
- conformance pass/fail/inconclusive
- high-severity conformance failures
- generation time
- bytes
- source complexity
- interaction success

Primary metric:

> fingerprint conformance against rendered output / deterministic checks.

Not generic prettiness.

### Required comparisons

1. same 8-prompt set used on 2026-07-02
2. larger prompt set across all fingerprints
3. small-model bakeoff
4. structure-heavy prompts designed to stress verbosity:
   - dashboards
   - reports
   - multi-section briefs
   - dense control panels

### Gate to default

Surface Document becomes default if:

- success >= domjs baseline
- high-severity conformance failures <= domjs baseline
- safety violations = 0
- repair rate does not regress materially
- design/fingerprint conformance is equal or better

### Migration

- freeze Arrow
- keep domjs as fallback while Surface Document bakes
- once stable, Surface Document absorbs:
  - `html-static`
  - domjs-control default
  - eventually Arrow

---

## Phase 8 — Docs and product positioning

**Goal:** Make the repo read like the reference implementation of the stance.

Update:

```txt
README.md
docs/positioning.md
docs/roadmap.md
docs/archive/prompt-architecture.md (if revived)
docs/integration-with-ghost.md
docs/archive/domjs-ergonomics-convergence.md (historical context only)
```

Wording shift:

From:

> inline Arrow VM / domjs runtime

To:

> Surface Document: structure, style, behavior, governed as a contract.

README mental model:

| Term | Meaning |
| --- | --- |
| Surface Document | Generated `main.html`, `main.css`, optional `main.js`. |
| Sandbox | Owned VM + trusted renderer executing behavior without ambient authority. |
| Host tool | The only authority channel available to behavior. |
| Receipt | The citable record of structure, style, behavior, checks, and tool events. |

---

# Critical risks

## 1. HTML parsing becomes `innerHTML` in disguise

This is the biggest security risk.

Mitigation:

- parse to descriptor tree
- never browser-parse generated HTML
- reject scripts/handlers
- cap depth/size
- adversarial tests

## 2. Query selector support balloons

Full CSS selector support will eat time.

Mitigation:

- v1 subset only
- use ids/data refs in examples
- repair hints tell model to add `id` or `data-ref`

## 3. Mirror drift

Schema says one thing, prompt says another, validator enforces a third.

Mitigation:

- one change set
- lockstep canonical fixture test
- VM-verified examples

## 4. Conformance remains too fuzzy

If the verdict is still an 8-second LLM judge over truncated source, Surface
Document will not prove its thesis.

Mitigation:

- deterministic checks against parsed files
- full-source or chunked evaluation
- render-based checks later

## 5. Runtime count grows instead of shrinks

Surface Document must be a successor, not another permanent branch.

Mitigation:

- explicit deprecation path
- audit gate
- docs say this is the convergence path

---

# Suggested first implementation slice

If we want the smallest useful spike, build this:

## Spike: static + tiny interactive Surface Document

Input:

```txt
main.html
main.css
main.js
```

Support only:

- safe HTML parser
- ids/classes/data attrs
- `document.getElementById`
- `textContent`
- `onclick`
- `state`
- existing renderer/protocol

Demo fixture:

```html
<main class="counter">
  <h1>Count</h1>
  <p id="total">0</p>
  <button id="inc">Increment</button>
</main>
```

```js
const s = state({ count: 0 });

document.getElementById('total').textContent = () => s.count;
document.getElementById('inc').onclick = () => {
  s.count += 1;
};
```

Acceptance:

- renders
- click updates count
- no new protocol ops
- malicious HTML rejected
- server can validate artifact
- one generated example passes

This spike tells us whether the architecture is real without boiling the ocean.

---

# Final recommendation

Plan it as **Surface Document**, not "hybrid domjs."

Implementation order:

1. contract spec
2. safe HTML parser
3. VM hydration + scoped query
4. artifact/schema/validator
5. runtime profile
6. prompt/repair mirrors
7. conformance/receipt hardening
8. audit + migration

Philosophically:

> Current domjs proved Summon can own the runtime. Surface Document makes that
> owned runtime speak the native language of design artifacts.
