# Arrow demo mount investigation (2026-06-29)

> ⚠️ **SUPERSEDED / WRONG CONCLUSION.** This doc claimed arrow doesn't render in
> the demo. It does. The error was mine: arrow renders into a **shadow root**, and
> I measured the host element's light DOM (`innerText`/`querySelectorAll`), which
> doesn't cross shadow boundaries — so I saw "empty" and wrongly concluded
> "broken." See `arrow-vs-domjs-comparison.md` for the correction and the working
> A/B screenshots. Keeping this doc only as a record of the misdiagnosis.


Goal: get a clean arrow-vs-domjs side-by-side screenshot. Blocker: **arrow
surfaces do not render in the demo** (empty surface, no error), while domjs does.
This documents the root cause found.

## Symptom

- Arrow generates fine via API (`/api/generate` → valid `runtime:'arrow'`
  artifact, 0 blocks). Confirmed repeatedly.
- In the demo, the arrow surface div contains only the token `<style>` — no
  content, no shadow root, and `onRuntimeError` never fires. Silent empty render.

## What I ruled out (with evidence)

1. **Not my domjs changes.** Reproduces with the stock `@arrow-js/sandbox`
   README example, imported directly, bypassing all Summon code.
2. **Not the artifact.** The generated `main.ts` is valid arrow (has
   `export default html\`...\``); the minimal stock example fails the same way.
3. **Not the module import.** `import('@arrow-js_sandbox.js')` resolves and
   exports `sandbox()` (a function).
4. **Not the WASM mime/serving.** `/node_modules/.vite/deps/emscripten-module.wasm`
   returns 200 `application/wasm`.
5. **Not a stale vite cache alone.** Clearing `apps/demo/node_modules/.vite` did
   not fix it.

## Root cause (diagnosed to the boundary)

The arrow sandbox **boots the `<arrow-sandbox>` host element but the QuickJS VM
never delivers a render tree.** Traced into `@arrow-js/sandbox`'s
`SandboxInstance.mount()`: it creates the element, then calls
`renderer.render(booted.initialTree)` — but `initialTree` is empty, so no DOM is
produced. Behavior is **flaky across runs**:

- Sometimes the element reaches `data-ready="true"` with **zero children**.
- Sometimes it never sets `data-ready` at all.
- `onError` never fires either way.

This is a **silent QuickJS/WASM boot failure inside `@arrow-js/sandbox` 1.0.6** in
this environment. The original error report at the very start of this work even
showed the two cache versions split (`quickjs-...?v=d115c79a` vs
`@arrow-js_sandbox.js?v=6500e499`) — an optimizer split-brain — consistent with a
WASM/loader-variant mismatch (the demo's vite plugin serves the
`release-asyncify` wasm for a single `emscripten-module.wasm` path, but the
optimizer emitted multiple `emscripten-module.browser-*` loader variants).

## Honest status

- This is a **pre-existing arrow-runtime/environment bug**, not caused by the
  domjs (surface-vm) work. domjs renders because surface-vm boots its own VM into
  the light DOM and works here.
- Fully fixing it means debugging `@arrow-js/sandbox`'s WASM boot / vite dep
  optimization for the QuickJS variant — an arrow-side task, out of scope for the
  domjs investigation, and flaky to reproduce.

## Implication for the comparison

A demo-based arrow-vs-domjs **screenshot** A/B is blocked until arrow's mount is
fixed. The *generation* comparison (acceptance/quality/complexity) already ran
and is unaffected (it reads artifacts, not pixels) — see
`surface-vm-bakeoff-findings.md`.

## Recommended next step

Pin/align the QuickJS WASM variant for the demo: ensure `@arrow-js/sandbox` and
the vite optimizer agree on a single `quickjs-emscripten` loader+wasm pair (the
`release-asyncify` one the plugin serves). Likely a `vite optimizeDeps.include`
/ `resolve.dedupe` fix plus serving the matching wasm. Then re-attempt the A/B.
