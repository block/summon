# Investigation: a standalone `surface-vm` package for HTML/JS-in-sandbox

Status: source-grounded design investigation (2026-06-29). Critical, not a commitment.

## What I actually read

Full source of `@arrow-js/sandbox@1.0.6` (it ships TS source, not just build):

- `src/shared/protocol.ts` (247 lines) — the VM↔host wire contract.
- `src/host/renderer.ts` (335 lines) — applies `SerializedNode`/`VmPatch` to the real DOM; sanitizes events to plain data.
- `src/host/quickjs.ts` (1136 lines) — QuickJS boot, injected globals, module loader, host-bridge plumbing.
- `src/vm/runtime/runtime.ts` (891 lines) — Arrow reactivity → emits `render`/`patch` via `__arrowHostSend`.
- `src/index.ts` — public surface.

## The single most important finding

The package's **public API is one function**: `sandbox(props, events, hostBridge)`.

The valuable host internals — `HostRenderer`, `createVmRunner`, the QuickJS boot — are **not exported**. The Summon host already proves this: `inline-surface.ts` reaches for the runtime via `import('@arrow-js/sandbox')` and only finds `sandbox`. There is no public `renderer` or `runner`.

**But the protocol types ARE exported and are 100% dialect-agnostic:**

```ts
// from @arrow-js/sandbox
export type { SerializedNode, VmPatch, HostToVmMessage, VmToHostMessage,
              SandboxedEventPayload, SandboxedEventTargetSnapshot }
```

`SerializedNode` is `element{tag,attrs,events,children} | text | region | fragment`.
`VmPatch` is `set-text | set-attribute | remove-attribute | set-event-binding |
clear-event-binding | replace-region`. **Not one Arrow concept.** This is a
serialized-DOM-tree + DOM-patch protocol.

The VM emits these through exactly one injected global:
`__arrowHostSend(JSON.stringify(message))` (quickjs.ts:859). The host feeds
events back through `__arrowSandboxDispatch`. Arrow's `reactive`/`html` runs
*inside* the VM, strictly upstream of `__arrowHostSend`.

### Consequence

- We **cannot** import Arrow's renderer to reuse it.
- We therefore must **own a host renderer ourselves** — but it's 335 lines of
  generic DOM glue, and we'd own the protocol too, which is the valuable part.
- The QuickJS isolation guarantee (no `window`/`document`, plain-data events,
  host never evals VM expressions) is a property of *the protocol + the VM*, not
  of Arrow. It transfers to any in-VM dialect that speaks the protocol.

## Where the security actually lives (so we don't break it)

Three structural facts, all independent of dialect:

1. **QuickJS realm has no browser globals.** quickjs.ts injects only
   `__arrowHostSend`, `__arrowHostBridge`, `console`, timers, and a narrowed
   `fetch` — then nulls them after boot (quickjs.ts:1125). No `document`,
   `window`, storage, or live DOM ever enters the VM.
2. **The protocol carries only plain data.** `tag`/`attrs` are strings;
   event payloads are `{tagName,id,value,checked,key,clientX,...}` snapshots
   built by the host (`renderer.ts:sanitizeEvent`). The VM never receives a live
   `Node` or `Event`.
3. **The host never evaluates a VM expression.** It instantiates nodes and
   applies patches. User logic only runs inside QuickJS.

Any new package MUST preserve all three. They are cheap to preserve *because the
protocol was designed to enforce them* — the wire format simply cannot express a
live node or a raw callback.

## Proposed package: `packages/surface-vm`

A standalone, dialect-agnostic sandbox runtime that owns the protocol and a
generic renderer, with pluggable in-VM "authoring engines." Arrow becomes *one*
engine; HTML/JS becomes another.

```
packages/surface-vm/
  src/
    protocol.ts          # our own copy of the wire contract (the real asset)
    host/
      renderer.ts        # generic SerializedNode/VmPatch -> DOM (port of the 335-line one)
      runner.ts          # QuickJS boot + __hostSend/__dispatch wiring + module loader
      bridge.ts          # host-bridge:summon capability channel
    engines/
      arrow/             # adapter: existing @arrow-js source -> protocol (optional, see below)
      domjs/             # NEW: in-VM DOM-facade engine for model-authored HTML/JS
        facade.ts        # createElement/textContent/addEventListener -> SerializedNode/VmPatch
        bootstrap.ts     # injects the facade as the VM's "document"
```

### The boundary (unchanged from today, by design)

```
[VM realm]  engine (arrow | domjs)  --__hostSend(json)-->  host/runner
                                     <--__dispatch(event)--
─────────── protocol.ts (tag/attrs/children/patch + plain event snapshot) ───────────
[host realm] host/renderer  -> real shadow DOM ;  host/bridge -> capability tools
```

### The `domjs` engine — what's genuinely new

This is the "HTML/JS in the sandbox" payoff. Inside QuickJS we expose a tiny
**capability-shaped DOM facade** that the model's JS programs against:

```js
// what the model writes (fluent dialect — its strength)
const root = document.createElement('div');
root.className = 'card';
const btn = document.createElement('button');
btn.textContent = 'Save';
btn.addEventListener('click', () => callTool('choose', { id: state.id }));
root.append(btn);
export default root;
```

The facade does NOT touch a real DOM (there is none in QuickJS). It builds an
in-memory `SerializedNode` tree and, on mutation, emits `VmPatch`es through
`__hostSend`. `addEventListener` allocates a `handlerId`, registers the callback
in a VM-side map, and emits `set-event-binding` — exactly what Arrow's runtime
already does (`allocHandlerId`, runtime.ts:210). Incoming `{type:'event'}`
messages look up the handler and invoke it with the plain-data snapshot.

Critically: **the facade is not security-critical.** It has no capabilities to
leak — it only constructs plain-data trees. A bug yields a wrong render, not an
escape. The security still lives in QuickJS + the protocol. This is the inverse
of the iframe blocklist model.

## Critical assessment — the hard parts (don't underestimate these)

1. **Re-earning the safety proof for the renderer + runner.** We port ~470 lines
   of host glue (renderer + runner). It's not algorithmically hard, but it IS
   the trust boundary. We must port Summon's adversarial suite
   (`tests/safety-smoke.spec.ts`, `pnpm test:safety`) to run against
   `surface-vm` and prove: no browser globals leak, events stay plain-data, no
   live node escapes via `event.target.parentNode...`, host never evals VM code.
   This is the real cost, and it's a *one-time* cost shared by all engines.

2. **The DOM facade's API surface is a design liability.** Every method we add
   (`querySelector`? `parentNode`? `style.setProperty`? `insertBefore`?) is
   scope the model will use and we must lower to a `VmPatch`. Too small → model
   fluency evaporates (back to "learn our dialect"). Too large → we're
   reimplementing the DOM in QuickJS. The discipline: **support the subset that
   maps cleanly to the existing 6 `VmPatch` ops**, and reject the rest at
   compile/runtime with repairable issues (reuse Summon's repair loop).

3. **`replace-region` is the only structural-change patch.** The current
   protocol mutates text/attrs/events in place and replaces whole *regions* for
   list changes. Arbitrary `insertBefore`/`removeChild` at any node is NOT in the
   patch vocabulary. So either (a) constrain the facade to region-granular list
   updates (cheap, matches the protocol), or (b) extend `VmPatch` with
   `insert-node`/`remove-node` (more work, but our protocol — we own it). Start
   with (a).

4. **No reactivity for free.** Arrow gave the VM `reactive()`. The `domjs` engine
   has none — the model writes imperative re-render logic, or we ship a tiny
   `state + rerender` helper in the facade. Imperative is the model's strength,
   so this is acceptable, but it must be a deliberate choice, not an oversight.

5. **Fork-maintenance risk.** Porting `@arrow-js/sandbox` internals means we
   diverge from upstream. If they fix a VM escape, we don't get it automatically.
   Mitigation: keep `protocol.ts` and `host/*` as a thin, audited port with a
   documented upstream-sync checklist (the package even ships
   `build/sync-vm-sources.mjs` as precedent for vendoring VM source).

## What this buys Summon (the strategic payoff)

- **Embeddable artifact unchanged in spirit.** The artifact is still "source for
  a capability VM + a bridge." Web/WKWebView/Android WebView all run the same
  `surface-vm` identically (WASM). One runtime, one bridge ABI, three thin host
  adapters. (See `docs/html-control-runtime-sketch.md`.)
- **The protocol becomes the real product** — a runtime-agnostic, capability-safe
  UI wire format that Summon owns and versions. Arrow and `domjs` are
  interchangeable producers; a future native consumer could render the same
  `SerializedNode` tree.
- **Model fluency without the iframe blocklist.** HTML/JS authoring, but secured
  by capability-absence, not subtraction.

## Relationship to Strategy A (transpile HTML/JS -> Arrow)

These are NOT competitors — they're different bets on the same protocol:

- **Strategy A** keeps Arrow as the in-VM engine and compiles HTML/JS to Arrow
  source *server-side*. Cheapest; no new host code; but the model writes a
  restricted *declarative* dialect and we maintain a compiler.
- **`surface-vm` + `domjs` engine** (this doc, ~= Strategy B done right) lets the
  model write *imperative* HTML/JS and runs it directly. More host work (port +
  re-prove safety once), but no compiler, no restricted dialect, and it's the
  genuinely novel artifact.

Decision rule: **A is the measurement probe; `surface-vm` is the platform.** If
A's bakeoff shows declarative covers ~85% of real prompts, A may be enough. If
imperative surfaces keep getting rejected, `surface-vm` is justified — and the
investigation above shows it is *feasible and bounded*, because the protocol is
public, generic, and already designed for exactly this.

## Recommended first slice (de-risks the whole bet)

1. `packages/surface-vm/src/protocol.ts` — vendor the wire types (own them).
2. `host/renderer.ts` + `host/runner.ts` — port the generic glue; mount a
   hand-written `SerializedNode` tree (no engine yet) to prove the boundary works.
3. **Port the adversarial safety suite against it.** This is the gate. If we
   can't re-prove isolation, stop here.
4. Only then build the `domjs` facade and wire it to Summon's repair loop +
   `host-bridge:summon`.
5. Add to `scripts/runtime-bakeoff.mjs` as a new runtime and measure fluency vs
   `arrow-control` and the Strategy A path.

The order is deliberate: prove the *boundary* before building the *fluency*. The
boundary is the only part that can sink the project; the facade is just
engineering.
