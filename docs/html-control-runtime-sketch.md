# Sketch: `html-control` — fluent HTML/JS authoring inside the capability sandbox

Status: exploratory design sketch (2026-06-29). Not a commitment.

## The problem this solves

Two facts are both true in Summon today:

1. The model is **fluent** in HTML/CSS/JS and **weak** in the `@arrow-js`
   authoring dialect. Every recurring Arrow generation crash
   (`.map(html`...`)`, `.value=` IDL bindings, bare `${}` in open tags) is the
   model reaching for a mainstream-web habit that Arrow rejects.
2. The Arrow runtime is **safe by design** because of *capability absence*:
   inside the QuickJS/WASM VM there is no `document`, `window`, `fetch`,
   `localStorage`, or live DOM node. Host power is granted additively through a
   single explicit channel (`host-bridge:summon`).

The HTML runtimes (`html-static`, `html-stream`) get fluency but trade the
security model: they are `trust: 'iframe-safe'`, secured by **subtraction**
(`UNSAFE_SCRIPT_RE`, `unsafe-tag`, `inline-handler`, `static-script` ...). A
blocklist is only as strong as its last regex; an iframe always starts from a
full browser realm.

**Goal:** let the model author the dialect it is fluent in, but execute it under
the *capability-absence* boundary, not the *subtraction* boundary.

## The orthogonality we are exploiting

`packages/engine/src/output-runtime.ts` already separates two axes:

- `format`: `'arrow' | 'html'`  — the authoring dialect
- `trust`:  `'sandboxed' | 'iframe-safe'` — where it executes

We have only ever shipped the diagonal: `arrow → sandboxed`, `html →
iframe-safe`. The off-diagonal cell — **`html → sandboxed`** — is the marriage.

| profile | format | trust | exists |
| --- | --- | --- | --- |
| `arrow-control` | arrow | sandboxed | ✅ |
| `html-static` | html | iframe-safe | ✅ (exp) |
| `html-stream` | html | iframe-safe | ✅ (exp) |
| **`html-control`** | **html** | **sandboxed** | ❌ (this sketch) |

## Hard constraint discovered in `@arrow-js/sandbox`

The sandbox is **not** a general "run any JS in QuickJS" host. Per its README
security model:

> `html` templates are preprocessed into descriptors. The host never evaluates
> user expressions. The host page mutates the real DOM through trusted renderer
> code only.

So the trusted DOM renderer is **bonded to Arrow's descriptor format**. The VM
does not hand the host arbitrary DOM mutations; it hands it Arrow template
descriptors + reactive bindings, and the host renders *those*. There is no
public "here is a node tree, please render it" entry point.

This rules out the naive "drop a `<div id=app>` DOM façade into the same VM"
plan unless we either (a) fork/extend the sandbox renderer, or (b) compile the
model's dialect down to what the renderer already accepts.

That gives us two concrete strategies, cheapest first.

---

## Strategy A (recommended first): server-side transpile HTML/JS → Arrow

The model writes a **fluent, restricted HTML+JS dialect**. A *deterministic*
server-side compiler lowers it into an Arrow `main.ts` that the **existing,
unmodified** `@arrow-js/sandbox` runs. Safety is unchanged because the output is
ordinary Arrow source going through the same VM + `host-bridge:summon`.

```
model → { body.html, main.js (restricted) }
      → [server: html-control compiler]      ← deterministic, trusted, tested
      → ArrowSurfaceArtifact { 'main.ts' }    ← existing shape
      → existing inline-surface.ts Arrow path  (no host changes)
```

### Why this is attractive

- **Zero new sandbox surface.** The capability boundary is literally the Arrow
  one we already trust. Nothing new executes; the compiler is trusted host code
  with unit tests, not a VM.
- **The model never sees Arrow.** It writes `onclick`, `textContent`,
  `element.append(...)`, `state.count++` — its fluent muscle memory. The
  dialect quirks in `arrow-subset.ts` stop mattering because the model never
  emits Arrow.
- **Reuses the whole pipeline:** validation issue plumbing, repair loop
  (`bundle.ts`), `host-bridge:summon`, shadow DOM mount, devtools events.

### The restricted dialect (what the model is allowed to write)

Keep it small and lowerable. First cut:

- A static `body.html` fragment (already validated by `html-artifact.ts`'s
  tag/attr allowlist — reuse it).
- A `main.js` that may:
  - read/write a single `state` object (lowered to Arrow `reactive`)
  - attach handlers via a tiny declarative convention rather than inline
    `onclick` (e.g. `on('#save', 'click', () => callTool('choose', {...}))`)
  - call `callTool` / `getState` / `onState` from `host-bridge:summon`
  - render lists/conditionals through a small set of directives we can lower
    (e.g. `data-each`, `data-text`, `data-if` attributes in the HTML, bound by
    name to state) — *not* arbitrary DOM construction

The trick: **the more we constrain `main.js` toward declarative bindings, the
more deterministically it lowers to Arrow.** Fully imperative DOM building is
the hard case; declarative-binding-over-static-HTML is the easy, safe case and
is *also* the most reliable thing the model produces.

### Lowering examples (illustrative)

`data-text` / `data-if` / `data-each` on static HTML →

```html
<!-- model writes -->
<ul data-each="items as item">
  <li data-text="item.label"></li>
</ul>
```

lowers to Arrow:

```ts
html`<ul>${() => state.items.map((item) => html`<li>${() => item.label}</li>`)}</ul>`
```

A declared handler →

```js
// model writes
on('#save', 'click', () => callTool('choose', { id: state.selected }));
```

lowers to an Arrow `@click` binding wired to the bridge. The compiler owns the
`.map((item) => ...)` form, so the crash that started this whole investigation
**cannot be emitted by the model** — only by our tested compiler, once.

### What it costs

- Building + testing the compiler (a real but bounded artifact: a parser for the
  restricted dialect + an Arrow emitter). This is the bulk of the work.
- The dialect is *restricted* — it is not "any JS." Truly imperative surfaces
  are out of scope for Strategy A. (Most generated surfaces are
  state-bound views, so this is a smaller limitation than it sounds.)

---

## Strategy B (later, if A's dialect proves too narrow): DOM-façade runner

If we need genuinely imperative JS (`createElement`, manual `append`, event
listeners written freely), we extend the VM side: expose a **minimal,
capability-shaped DOM façade** inside QuickJS backed by a *virtual* node tree,
and have a trusted host reconciler diff/apply it to the real shadow DOM —
exactly the split `inline-surface.ts` already performs for Arrow, but driven by
node-tree patches instead of Arrow descriptors.

This is the "real" marriage but it requires either forking the sandbox's
renderer or shipping a second runner. Defer until Strategy A's acceptance data
justifies it.

---

## Concrete change map for Strategy A

Smallest viable slice, partitioned by file so it could be built incrementally:

1. **`packages/engine/src/output-runtime.ts`**
   - Add `'html-control'` to `SummonOutputRuntime` and
     `SUMMON_OUTPUT_RUNTIME_VALUES`.
   - Add a profile: `{ format: 'html', delivery: 'bundle', trust: 'sandboxed',
     experimental: true }`. (Note: `format: 'html'` for *authoring*, but it
     mounts via the Arrow path — see step 4.)

2. **`packages/engine/src/html-control-compiler.ts`** *(new)*
   - `compileHtmlControlToArrow(bundle): { source: { 'main.ts', 'main.css'? },
     issues: ContractIssue[] }`.
   - Reuse `html-artifact.ts` tag/attr/url allowlists for the static body.
   - Emit Arrow `reactive` + `html` + `@event` + `host-bridge:summon` source.
   - Issue codes are repairable (feed into `bundle.ts`).

3. **New prompt block (`packages/engine/src/prompt.ts` + a dialect doc)**
   - Teach the *restricted HTML/JS dialect*, not Arrow. This is short and plays
     to the model's strengths — the inverse of `arrow-subset.ts`.

4. **`packages/host/src/inline-surface.ts`**
   - **No new execution path.** `html-control` produces an
     `ArrowSurfaceArtifact`, so it rides the existing Arrow `renderArtifact`
     branch. The host doesn't even need to know it started as HTML — the server
     hands it Arrow source. (This is the elegant part: the off-diagonal cell
     reuses the diagonal's runtime.)

5. **`packages/server/src/runtime/` strategy**
   - A bundle runtime strategy for `html-control` that: validates the HTML/JS
     bundle → runs `compileHtmlControlToArrow` → validates the *emitted* Arrow
     with the existing `validateArrowSurfaceArtifact` (defense in depth: even
     our compiler's output is re-checked) → delivers as an Arrow artifact.
   - Repair loop applies to the *HTML/JS* layer (model fixes its dialect), not
     the Arrow output (which the model never sees).

6. **Bakeoff**
   - Add `html-control` to `scripts/runtime-bakeoff.mjs` runtime matrix and
     measure first-pass acceptance vs `arrow-control` and `html-static`.

## Open questions to resolve before building

- **Dialect scope.** How declarative can we force `main.js` before fluency
  gains evaporate? The whole bet is "declarative-binding HTML is both safe to
  lower *and* the model's best output." Validate that assumption on real
  prompts first.
- **Double validation cost.** We validate HTML/JS in, then Arrow out. Acceptable
  for safety, but confirm the repair loop attributes failures to the right
  layer so hints stay actionable.
- **Where does the `.map` lowering live?** In the compiler — which means the
  crash that motivated this is structurally impossible in `html-control`,
  because the model never writes `.map` at all.

## Recommendation

Build **Strategy A** behind the existing experimental-runtime flag, restricted
to declarative-binding surfaces, and bake it off against `arrow-control`. It
reuses the trusted Arrow runtime wholesale, so it adds **no new capability
surface** — the marriage is "model authors fluent HTML/JS, a trusted compiler
speaks Arrow on its behalf, the proven sandbox runs the result." If the
declarative dialect proves too narrow, escalate to Strategy B's DOM-façade
runner with bakeoff evidence in hand.
