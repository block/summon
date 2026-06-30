# M2 plan: the `domjs` engine

Status: ✅ DONE (2026-06-29). Prereqs: M0 (boundary) ✅, M1 (renderer + loop) ✅.

## Outcome

Shipped: `engine/domjs/runtime-source.ts` (VM core + facade as inline source),
`engine/domjs/index.ts` (`buildDomjsModules` + bootstrap), `test/domjs.test.ts`
(8 protocol-boundary + unsupported-API tests), and the M2 exit-gate DOM test in
`test/loop.test.ts`. 21/21 tests pass; build + typecheck clean.

Exit gate met: a realistic imperative HTML/JS surface (elements + text + attrs +
events + dynamic list via `region`) renders and reacts through the full loop;
every emitted patch is one of the 6 ops (no new ops added); unsupported APIs
throw repair-phrased errors (never `undefined`); build-phase mutations are silent
and one `{render}` is emitted; reactive-phase mutations batch into one `{patch}`
per dispatch.

Two real bugs the tests caught and fixed:
- internal node storage (`id`/`children`) collided with model-facing DOM
  props/throwing-stubs → renamed to `__id`/`__childNodes`.
- a build-phase throw rejected `createVmRunner` boot → bootstrap now catches and
  emits `{type:'error'}`, so authoring errors are protocol messages (also what
  M3's repair loop needs).

---

## Original plan (for reference)

## Intention (re-read)

> Model authors fluent imperative HTML/JS → runs capability-absent in QuickJS →
> emits the existing protocol. **6 patch ops, no more. Façade maps only to those
> ops. Not security-critical (it has no capabilities to leak — it only builds
> plain-data trees).**

M2 is the fluency payoff and the only genuinely new code in the project. Still
**no model and no Summon integration** — drive it with hand-written HTML/JS
samples and assert the emitted protocol messages.

## What the model writes (the target dialect)

```js
// /main.js — the model's fluent, imperative DOM code
const root = document.createElement('div');
root.className = 'card';

const label = document.createElement('span');
label.textContent = 'count: 0';
root.append(label);

const btn = document.createElement('button');
btn.textContent = '+';
let count = 0;
btn.addEventListener('click', () => {
  count += 1;
  label.textContent = 'count: ' + count;   // -> set-text patch
});
root.append(btn);

export default root;
```

The default export is the surface root. This mirrors Arrow's "default export is
the result" contract, so the runner's entry handling is unchanged.

## The crux: two phases, one tree

The façade node has a `mounted` flag. This is the whole trick.

- **Build phase** (module top-level eval): mutations just build the in-memory
  tree. No patches. At end of `initSandbox`, the core serializes the exported
  root and sends one `{type:'render', tree}`.
- **Reactive phase** (inside an event handler): the same mutations now emit
  `VmPatch`es into a queue; the core flushes the queue as one `{type:'patch'}`
  at the end of each `__dispatch`. Imperative, predictable, no reactivity engine.

This is exactly how Arrow's runtime distinguishes initial mount from updates
(`emitPatchUpdates` flag + `emitPatches`), reduced to imperative mutation.

## Module layout (all VM-side except the source loader)

```
packages/surface-vm/src/engine/domjs/
  runtime-source.ts   # HOST-side: exports the VM module sources as strings
  vm/
    core.js           # VM: channel capture, __dispatch, id alloc, tree model,
                      #     serialize, patch queue + flush, handler registry, mount
    facade.js         # VM: document + element/text node behavior over core
  index.ts            # HOST-side: buildDomjsModules({entry, css?}) -> module map
```

### Why VM source as strings (and not a build step)

The VM runtime must reach QuickJS as source text in the runner's module map.
Two ways: (a) author `.js` and stringify via a build script (Arrow's
`sync-vm-sources.mjs` pattern), or (b) inline the source as string constants.

**M2 decision: (b) inline strings in `runtime-source.ts`.** It is dependency-free,
works identically under tsc and in the browser, and the VM code is small. We do
NOT type-check VM code — we test it by *running it in the VM*, which is the real
test anyway (and what M0/M1 already do). If the VM runtime outgrows ~250 lines,
revisit a stringify build step. This avoids premature infra.

## The façade — v0 supported surface (maps 1:1 to the 6 ops)

| Model writes | Emits / does |
| --- | --- |
| `document.createElement(tag)` | new element node (alloc `snode:N`) |
| `document.createElementNS(svgNs, tag)` | element node, `namespace:'svg'` |
| `document.createTextNode(s)` | text node |
| `el.textContent = s` | build: set node text · mounted: `set-text` |
| `el.setAttribute(n, v)` / `el.removeAttribute(n)` | build/attr · `set-attribute`/`remove-attribute` |
| `el.className = s` / `el.id = s` | sugar over set-attribute |
| `el.append(child)` / `el.appendChild(child)` | build: push child · mounted: inside a region only (see below) |
| `el.addEventListener(type, fn)` | alloc `shandler:N`, register fn · build: into `events` · mounted: `set-event-binding` |
| `el.removeEventListener(type)` | `clear-event-binding` |
| `el.remove()` | region-granular removal |
| `region(() => [nodes])` | a region node; `region.update()` re-runs → `replace-region` |

### Lists/conditionals = `region`, NOT arbitrary insertion

The only structural-change op is `replace-region`. So dynamic content lives in a
region:

```js
const list = region(() => state.items.map((item) => {
  const li = document.createElement('li');
  li.textContent = item.label;
  return li;
}));
root.append(list);

// later, in a handler:
state.items.push({ label: 'new' });
list.update();   // -> replace-region patch with the re-rendered children
```

This is the deliberate constraint that keeps us at 6 ops. The model never does
`parent.insertBefore(x, y)` on a live tree; it re-renders a region. If bakeoff
later proves regions are too coarse, we extend the protocol *with evidence* — we
own it.

### Explicitly throws (clear, repairable errors — not `undefined`)

Every unsupported API is **defined as a throwing stub**, never left absent. (An
absent method gives the model the same `TypeError: not a function` that started
this whole investigation — we refuse to reproduce it.)

- `el.innerHTML =` / `el.outerHTML` → throw "use createElement/append".
- `el.querySelector` / `getElementById` → throw "hold references; no queries".
- `el.style` object access → throw "use setAttribute('style', ...) or className".
- `el.parentNode` / `el.children` traversal → throw "no live-tree traversal".
- `parent.insertBefore` / `removeChild` → throw "use region(...) for dynamic lists".
- any `window` / `globalThis.document`-escape → not present (boundary).

Each throw message is phrased as a repair hint (M3 maps these to repairable codes).

## State helper (no framework)

Ship a tiny `state(initial)` returning a plain object. No proxies, no tracking.
The model mutates it and calls `region.update()` (or rebuilds). Imperative is the
point. We will NOT add reactivity in M2 (or likely ever — that's Arrow's job).

## Host-side glue (`engine/domjs/index.ts`)

```ts
buildDomjsModules(options: { entry: string }): {
  modules: Record<string, string>;
  entryPath: string;
}
```

Returns the module map (`surface-vm:domjs-core`, `surface-vm:domjs-facade`,
`/main.js` = entry) ready to hand to `mountSurface`. Keeps consumers from
knowing VM-internal specifiers.

## Tests (assert at the protocol boundary — fast, precise)

Two layers:

1. **Protocol-message tests** (no DOM): run a sample through the runner with a
   capturing `onMessage`; assert the exact `render` tree and `patch` sequences.
   - createElement tree → correct `render`.
   - textContent in handler → `set-text` patch.
   - attribute set/remove → patches.
   - addEventListener in handler → `set-event-binding`.
   - `region.update()` → `replace-region` with re-rendered children.
   - build-phase mutations emit NO patches (only the initial render).
2. **Unsupported-API tests**: each throwing stub surfaces a `{type:'error'}`
   with the expected hint substring.
3. **One full-loop DOM test** (reuse `mountSurface` + happy-dom): a domjs counter
   sample renders and a click updates the DOM — the M1 loop, now driven by the
   real engine instead of a hand-written core.

## Exit gate M2

- A realistic imperative HTML/JS sample (elements + text + attrs + events + a
  dynamic list via `region`) renders and reacts through the full loop.
- Every patch emitted is one of the 6 ops. **No new ops were added.**
- Unsupported APIs throw repair-phrased errors, never `undefined`.
- build + typecheck + tests green.

## Explicitly NOT in M2

- No Summon wiring (`output-runtime`, validator, prompt, inline-surface) — M3.
- No `host-bridge:summon` (no `callTool`/`getState`/`onState`) — M3.
- No reactivity, no `insert-node`/`remove-node`, no CSS handling beyond passing
  `main.css` through (that's M3's bundle concern).
- No stringify build step (inline strings until VM runtime > ~250 lines).

## Risks

- **Patch batching correctness.** A handler doing N mutations must flush one
  coherent `patch`. Mitigation: queue in core, flush at end of `__dispatch`;
  test multi-mutation handlers.
- **Façade scope creep.** The table above is v0. New methods need a real rejected
  prompt (M4 bakeoff), not a hunch.
- **`region.update()` ergonomics.** If models find it unnatural, that's a *prompt*
  fix (M3), not a protocol change. Resist adding fine-grained list patches early.

## First action

Create `engine/domjs/vm/core.js` + `facade.js` as inline source in
`runtime-source.ts`, `buildDomjsModules` in `index.ts`, then the protocol-message
test file. Start with createElement + textContent + click (the counter), get one
`render` + one `set-text` patch asserted, then widen to attrs, events, and
`region`.
