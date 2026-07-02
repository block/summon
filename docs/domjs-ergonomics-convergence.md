# domjs ergonomic convergence — "it's just the DOM" (2026-07-02)

Implementation record for the plan agreed in-session: shrink domjs's
model-facing contract toward standard DOM semantics, with the safety floor
shipped first. The fluency thesis, realized in the runtime instead of asserted
in the prompt.

## Phase 0 — safety floor (runner + reactivity)

- **Interrupt handler + dispatch budget** (`host/runner.ts`): every synchronous
  slice of VM execution (boot, dispatch, microtask flush) arms a deadline
  (default 1000ms, `dispatchBudgetMs` option). Model-authored `while(true)`
  can no longer hang the host: the slice is interrupted, a protocol `error`
  surfaces, and the runner keeps servicing later dispatches. Time spent
  awaiting the host (bridge calls) is not charged — the budget re-arms on each
  re-entry into the VM.
- **Function-handle dispatch**: the runner captures `__dispatch` behind a
  JSON-string wrapper at boot and calls it per message. Replaces per-dispatch
  `evalCodeAsync` of a synthesized module — no more message data crossing the
  boundary as source text.
- **Reactive cycle guard** (`vm/core.ts`): effect cascades are capped (1000
  runs per outer write, depth 32). A binding that writes state it reads throws
  a clear `domjs: reactive update cycle` error instead of livelocking.
- **Malformed VM messages** now surface as protocol errors instead of being
  silently swallowed (the arrow-mount misdiagnosis lesson, applied to our own
  boundary).

## Phase 1 — typed VM runtime source

`runtime-source.ts` (422 untyped string lines, past its own ~250 budget) is
replaced by real TypeScript in `src/engine/domjs/vm/{core,facade}.ts`.
`scripts/build-vm-source.mjs` (esbuild type-strip) emits
`runtime-source.generated.ts`, which is committed; `pnpm test` runs a
staleness check (`--check`). Module ids and exported constant names are
unchanged, so consumers didn't move.

## Phase 2 — implicit element regions (the freeze concept is gone)

Post-mount structural mutation now just works, with **zero protocol change**:

- `replace-region.regionId` may name an element ("implicit region"); the host
  renderer then replaces that element's children wholesale (documented in
  `protocol.ts`). Same op, wider id domain — the 6-op line holds.
- Facade: `append`/`appendChild`/`prepend`/`insertBefore`/`removeChild`/
  `replaceChildren`/`textContent` reset all work on live elements, coalescing
  to **one `replace-region` per element per dispatch flush**. Strings coerce
  to text nodes like the real DOM. `region()` remains as an optimization, no
  longer a required concept.
- The renderer preserves focus/value/caret best-effort across implicit-region
  swaps (tag + id/name heuristic; node ids are re-allocated per render so
  identity can't be used).
- `node.remove()` still throws (needs parent links the facade doesn't keep)
  with a hint pointing at `removeChild`/`replaceChildren`.

Known cost, accepted deliberately: naive generated code (rebuild-per-keystroke)
now works instead of erroring, so patch traffic can be chattier. Fine-grained
bindings remain the preferred path; keyed reconciliation stays deferred until
the audit data demands it.

## Phase 3 — widened facade + deep reactivity

- `el.style.*` (write-through proxy → `style` attribute; read-back returns
  only what was set), `el.style = 'css text'`, `classList`
  (add/remove/toggle/contains), `on<event>` handler properties, and reflected
  props (`value`, `checked`, `disabled`, `hidden`, `placeholder`, `href`,
  `src`, `alt`, `title`, `type`, `name`, `min`, `max`, `step`).
- `state()` is now **deeply** reactive: nested objects/arrays are wrapped
  (identity-stable via cache), mutating array methods (`push`/`splice`/...)
  notify, index writes wake `length` readers. `s.items.push(x)` tracks — the
  reassign-arrays prompt rule is dead.
- `innerHTML`/`outerHTML`/`querySelector`/`getElementById`/`parentNode`
  traversal still throw with repair-phrased hints. `innerHTML` is load-bearing
  (injection surface); the rest have no backing model in the facade.

## Phase 4 — the three mirrors, moved in lockstep

- `prompt.ts` (`SUMMON_FIXED_DOMJS_INSTRUCTIONS`): "Supported API" allowlist
  and the append/textContent/reassign-array hard rules deleted; contract is
  now "standard DOM + reactive state + callTool". Hard rules are 2 lines.
  Worked examples rewritten in natural style (`onclick`, `push`, `splice`) and
  **VM-verified before embedding** (counter: two clicks → `Count: 2`; list:
  push → region re-render to 2 rows).
- `domjs-bundle.ts` JSON-schema description updated to match.
- `contracts.ts` `domjs-unsupported-api` hints rewritten; `domjs-artifact.ts`
  static validator no longer blocks `style`/`insertBefore`/`removeChild`
  (now-supported APIs validate clean — regression-tested).

## Phase 5 — measurement instrument

`scripts/arrow-failure-audit.mjs` → `scripts/runtime-failure-audit.mjs` with
`--runtime arrow-control|domjs-control` (default arrow-control; domjs runs
write to `apps/server/.domjs-audit/`). The ergonomics scoreboard: first-pass
acceptance + issue-code distribution, before vs after this change. **Baseline
run not yet executed** (needs the live server + generation budget).

## Verification

- surface-vm 43/43 (was 28; +11 ergonomics, +4 safety), engine 68/68,
  server 50/50, host 53/53. Typecheck clean on all four.
- New hostile-input tests: handler infinite loop (runner survives), boot
  infinite loop, reactive cycle, malformed message.
- Full-loop happy-dom test: post-mount `append` reaches the rendered DOM.

## Not done / next

1. Baseline + after audit runs against the live server (blocked on budget
   sign-off).
2. Small-model bakeoff (the discriminating experiment for the fluency thesis).
3. Keyed reconciliation decision — revisit only if audit data shows
   focus-loss/patch-size pain.
