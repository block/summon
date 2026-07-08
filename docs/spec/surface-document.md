# Surface Document spec

> **Status:** experimental successor contract. Surface Document is implemented end-to-end and selectable with `surface-document`; it is not the default runtime yet.

A Surface Document is Summon's governed generated-UI artifact. It separates the generated surface into the three materials that Summon can govern and account for:

```txt
main.html  -> inert semantic structure
main.css   -> Ghost fingerprint styling
main.js    -> optional governed behavior
```

The split is part of the contract: structure, style, and behavior should be independently inspectable, repairable, and citable in receipts.

## Bundle schema

Models return a structured bundle:

```json
{
  "schema": "summon.surface-document-bundle/v1",
  "source": {
    "main.html": "<main>...</main>",
    "main.css": "main { color: var(--color-text); }",
    "main.js": "document.getElementById('x')..."
  }
}
```

Rules for `v1`:

- `schema` MUST equal `summon.surface-document-bundle/v1`.
- `source["main.html"]` is required.
- `source["main.css"]` is required.
- `source["main.js"]` is optional.
- Unknown source files are rejected.
- Incompatible semantics require a new schema version; `v1` must not change meaning.

The accepted runtime artifact has:

```json
{
  "runtime": "surface-document",
  "source": {
    "main.html": "...",
    "main.css": "...",
    "main.js": "..."
  }
}
```

## Runtime modes

| Mode | Files | Behavior |
| --- | --- | --- |
| Inert document | `main.html` + `main.css` | No model-authored JS. Structure and styling are validated and rendered. |
| Governed behavior | `main.html` + `main.css` + `main.js` | `main.js` runs in Summon's owned VM against the descriptor DOM. |

## Security model

Surface Document preserves Summon's governance boundary:

1. `main.html` is parsed into a safe descriptor tree. It is **not** assigned to browser `innerHTML`.
2. `main.js` does not receive the real browser DOM.
3. Behavior runs inside the owned Surface VM facade (`packages/surface-vm`) and renders through the trusted protocol renderer.
4. There is no ambient `window`, `document.body`, network, storage, cookies, dynamic code execution, or runtime HTML injection.
5. External authority flows only through granted host tools via `callTool()`.
6. Validation happens before accepted artifacts are emitted to the host.

## `main.html`

`main.html` contains inert structure only.

Allowed:

- semantic HTML elements
- ids, classes, and `data-*` attributes as behavior hooks
- text content
- inline SVG that does not load external resources

Forbidden:

- `<script>`
- `<style>`
- `<iframe>`, `<object>`, `<embed>`
- inline handlers such as `onclick`, `oninput`, `onsubmit`
- `javascript:` URLs
- form actions or markup that implies ambient browser authority

Behavior belongs in optional `main.js`; styling belongs in `main.css`.

## `main.css`

`main.css` carries Ghost fingerprint expression: typography, spacing, color, material, motion, density, and composition styling.

Forbidden:

- `@import`
- external `url(...)` references
- `data:` URLs
- `javascript:` URLs
- external fonts, stylesheets, or images

Use local CSS and fingerprint-provided tokens when available.

## `main.js`

`main.js` is optional governed behavior. It runs after `main.html` has been parsed into the descriptor DOM.

Supported API surface in v1:

- `document.getElementById()`
- `document.querySelector()` / `document.querySelectorAll()`
- `element.querySelector()` / `element.querySelectorAll()`
- `document.createElement()` / `document.createElementNS()`
- `document.createTextNode()` / `document.createDocumentFragment()`
- `textContent`
- `setAttribute()` / `removeAttribute()` / `getAttribute()` / `hasAttribute()`
- `className`, `classList`, `dataset`
- style property writes and `style = "..."`
- `append()`, `appendChild()`, `prepend()`, `insertBefore()`, `removeChild()`, `replaceChildren()`
- `addEventListener()` and `on<event>` properties
- reflected properties such as `value`, `checked`, `disabled`, `selected`, `placeholder`, `ariaLabel`
- `state(initial)` and deep reactive mutations
- function-valued bindings for text, attributes, style, classes, and reflected properties
- `region(() => ...)` for dynamic lists and conditionals
- `getState()` / `onState()` for host-pushed state
- `callTool(toolName, args)` for granted host authority

Forbidden:

- `fetch`, `XMLHttpRequest`, `WebSocket`
- `window`
- `document.body`
- storage, cookies, timers as ambient authority
- `eval`, dynamic import, generated code execution
- `innerHTML`, `outerHTML`
- `parentNode`, `parentElement` traversal
- `node.remove()`
- unscoped browser APIs

### Selector subset

Surface Document v1 supports simple scoped selectors:

```txt
#id
.class
tag
[data-ref="x"]
[data-role="x"]
[data-*]
```

Complex selectors and descendant combinators are not part of v1. Prefer ids or `data-ref` hooks for behavior.

## Host tools

A Surface Document cannot grant itself authority. `main.js` may call only host-granted tools:

```js
const result = await callTool('search', { query });
```

The host owns credentials, side effects, state, and authorization. Tool calls are both authorization decisions and trace events.

## Validation issue codes

| Code | Meaning | Repair direction |
| --- | --- | --- |
| `invalid-surface-document-bundle` | Bundle is not an object. | Return one structured bundle object. |
| `invalid-surface-document-bundle-schema` | Wrong schema string. | Use `summon.surface-document-bundle/v1`. |
| `missing-surface-document-bundle-html` | Bundle omitted `source["main.html"]`. | Add inert structure in `main.html`. |
| `missing-surface-document-bundle-css` | Bundle omitted `source["main.css"]`. | Add fingerprint styling in `main.css`. |
| `invalid-surface-document-source-path` | Unknown artifact source path. | Use only `main.html`, `main.css`, optional `main.js`. |
| `invalid-surface-document-source-file` | Source file is not a string. | Return string contents for each file. |
| `missing-surface-document-file` | Accepted artifact omitted a required file. | Include required file(s). |
| `surface-document-source-limit` | Source exceeded configured size limits. | Reduce generated files. |
| `surface-document-html-forbidden-tag` | HTML used forbidden executable/embedded tags. | Remove the tag; use `main.css`/`main.js` as appropriate. |
| `surface-document-html-inline-handler` | HTML used `on*` attributes. | Move behavior to `main.js`. |
| `surface-document-html-javascript-url` | HTML used a `javascript:` URL. | Use safe URLs or `callTool()`-backed behavior. |
| `surface-document-css-import` | CSS used `@import`. | Inline local CSS. |
| `surface-document-css-external-url` | CSS referenced external/data/javascript URLs. | Remove external references. |
| `surface-document-network-not-granted` | JS attempted ambient network. | Use granted host tools via `callTool()`. |
| `surface-document-unsupported-api` | JS used APIs outside the facade. | Use scoped DOM, `state()`, `region()`, and `callTool()`. |
| `invalid-surface-document-source-syntax` | `main.js` has invalid JS syntax. | Fix `main.js` before execution. |

## Minimal static example

```json
{
  "schema": "summon.surface-document-bundle/v1",
  "source": {
    "main.html": "<main class=\"brief\"><h1>Incident brief</h1><p>Queue depth has stabilized.</p></main>",
    "main.css": ".brief { color: var(--color-text); background: var(--color-bg); padding: 24px; } .brief h1 { font: inherit; }"
  }
}
```

## Minimal interactive example

```json
{
  "schema": "summon.surface-document-bundle/v1",
  "source": {
    "main.html": "<main class=\"counter\"><p id=\"total\">0</p><button id=\"inc\">Increment</button></main>",
    "main.css": ".counter { color: var(--color-text); } button { font: inherit; }",
    "main.js": "const s = state({ count: 0 });\ndocument.getElementById('total').textContent = () => String(s.count);\ndocument.getElementById('inc').onclick = () => { s.count += 1; };"
  }
}
```

## Generation-time presentation

A Surface Document is **inert until accepted**: no model-authored HTML, CSS, or
JS is painted before the full bundle has passed validation. This is by design —
partial artifacts have not crossed the trust boundary and must not reach the
render path.

What the user sees during generation is therefore a **host-owned drafting
surface**. It is part of the contract, not decoration:

1. **Fingerprint-derived.** The drafting surface is styled from the same Ghost
   token source (`tokensSource`) as the final artifact — background, text
   color, typography, spacing rhythm, and motion. A generic loading treatment
   that ignores the fingerprint is a fidelity violation in the highest-salience
   window of the surface's lifetime.
2. **Host-owned.** The drafting surface is built entirely from host code and
   validated stream metadata (`surface.status` events, `/surface-policy`,
   `/agent-goal`). Generated output never contributes to it.
3. **Re-enterable.** Generation is not linear. When a bundle is blocked and a
   repair pass begins, the host returns to the drafting state rather than
   freezing or showing raw failure. The drafting surface is the fallback for
   every non-terminal failure of a later presentation layer.
4. **Continuous container.** Drafting and final render occupy the same surface
   container, with a host-owned transition between them. Later presentation
   layers (e.g. progressive sanitized structure preview) slot in between
   drafting and final render without changing this contract.

The render lifecycle is:

```txt
drafting -> rendering -> rendered
   ^            |
   +--(blocked / repair)
```

Streaming of partial artifact content before acceptance is an open extension
point. Any future streaming preview MUST route partial content through the
same sanitizer pipeline as accepted artifacts and MUST be visually marked as
provisional and retractable. Nothing in `v1` permits painting unvalidated
model output.

## Implementation map

| Contract area | Source |
| --- | --- |
| Bundle schema and normalizer | `packages/engine/src/surface-document-bundle.ts` |
| Artifact validator | `packages/engine/src/surface-document-artifact.ts` |
| HTML parser / sanitizer | `packages/surface-vm/src/engine/domjs/html-parser.ts` |
| DOM facade and reactivity | `packages/surface-vm/src/engine/domjs/vm/facade.ts` |
| Server runtime profile | `packages/server/src/runtime/surface-document.ts` |
| Host render path | `packages/host/src/summon-surface.ts` |
| Stream validation | `packages/host/src/surface-stream.ts` |
| Prompt contract | `packages/engine/src/prompt.ts` |

## Conformance tests

The current executable coverage lives in:

- `packages/engine/test/surface-document-artifact.test.ts`
- `packages/engine/test/surface-document-bundle.test.ts`
- `packages/surface-vm/test/surface-document.test.ts`
- `packages/server/test/surface-document.test.ts`
- `packages/host/test/surface-stream.test.ts`
- `packages/host/test/domjs-surface.test.ts`
