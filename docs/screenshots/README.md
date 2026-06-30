# domjs live render screenshots (2026-06-29)

Real screenshots of model-generated **domjs** surfaces rendered through the host
runtime in the live demo (`localhost:5173`), captured with agent-browser. This
required wiring domjs through the render path (see "Wiring" below) — until now
domjs was only tested via source/metrics, never pixels.

## Screenshots

| file | what it shows |
| --- | --- |
| `00-error-state.png` | Initial failure: the demo couldn't resolve `@summon-internal/surface-vm` from the bundled host. Fixed by vendoring surface-vm into the public summon package build. |
| `01-generate-page.png` | The working generate page with the new **domjs control** runtime option. |
| `02-domjs-tasklist.png` | First domjs attempt — surface stuck on "Loading" because the host stream consumer (`surface-stream.ts`) didn't accept `runtime:'domjs'` artifacts and dropped them. |
| `03-domjs-tasklist-rendered.png` | **Success.** A real, interactive domjs task-list surface ("THE DAILY LIST") rendered in the Editorial Mono fingerprint style — generated as imperative HTML/JS, executed in the surface-vm capability sandbox. |
| `04-after-add-attempt.png` | **The thread comes full circle.** Clicking "Add" triggered `domjs runtime error: not a function` — the exact error class that started this whole investigation, now reproduced live in domjs. |

## Wiring required to render domjs (shipped this session)

The runtime was built end-to-end (M0–M4) but never connected to the **demo render
path**. To get pixels, three real gaps had to be closed:

1. **Public package build** (`scripts/build-public-packages.mjs`): vendor
   `packages/surface-vm/dist` into `summon/dist/_internal/surface-vm` and rewrite
   the host's `@summon-internal/surface-vm` import to a relative path. Without
   this the browser bundle couldn't resolve the import (screenshot 00).
2. **React render component** (`packages/react/src/index.ts`): add domjs to
   `SummonRenderableArtifact` and the `resolveRenderableArtifact` type guard.
3. **Host stream consumer** (`packages/host/src/surface-stream.ts`): accept
   `runtime:'domjs'` in `normalizeSurfaceArtifact`, the validation branch, and
   `isSurfaceArtifactValue`. Without this the demo dropped the (valid) domjs
   artifact before it reached `renderArtifact` (screenshot 02).
4. **Demo frontend**: add `domjs-control` to the runtime list, selector group,
   labels, and the valid-artifact check.

## The critical finding (screenshot 04)

domjs **generated cleanly** (0 repairs, 0 blocks — the artifact was accepted) and
**rendered correctly** (screenshot 03), but **crashed at interaction time** with
`not a function` when the Add handler ran. This is the same valid-syntax,
runtime-fatal class as the original arrow `.map(html\`...\`)` crash:

- The boundary **worked**: it surfaced "Surface runtime failed" cleanly, no hang.
- But the domjs **facade + validator did not catch it** — the model called
  something non-callable inside an event handler, which neither the static
  unsupported-API scan nor the build-phase facade detects.

**Lesson, restated honestly:** moving from arrow's dialect to domjs's fluent
HTML/JS did **not** eliminate the "not a function" failure class. It moved it. The
model can still emit valid-syntax, runtime-fatal code in *any* dialect; the
durable fix is the same as before — catch the pattern in the validator/repair
loop, not assume a friendlier dialect prevents it. The next concrete step would
be to capture this artifact's handler source and add a domjs validator rule for
the specific non-callable pattern, exactly as we did for arrow's `.map`.
