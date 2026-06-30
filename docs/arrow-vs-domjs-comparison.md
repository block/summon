# Arrow vs domjs — visual A/B (2026-06-29)

Same prompt ("A counter with increment, decrement, and reset"), same fingerprint
(Editorial Mono), both runtimes, rendered live in the demo.

## Correction first (important)

My previous `arrow-mount-investigation.md` claimed **arrow doesn't render in the
demo**. **That was wrong.** Arrow renders fine. My diagnosis error: arrow mounts
into a **shadow root** (`<arrow-sandbox>` → `shadowRoot`, 44 nodes), but I was
measuring the host element's *light DOM* via `innerText` / `querySelectorAll('*')`,
which don't traverse shadow boundaries. So I saw "empty" and concluded "broken."
It was rendering the whole time, one shadow boundary away from my probe.

The split-version vite cache observation was real but not fatal — surface-vm and
arrow both boot `newQuickJSAsyncWASMModule(RELEASE_ASYNC)` successfully here.

Lesson (again, on myself): I measured the wrong layer and drew a confident wrong
conclusion. Verified end-to-end this time — shadow content + a working click.

## Screenshots

| file | runtime | result |
| --- | --- | --- |
| `06-arrow-counter.png` | arrow-control | Renders. "FOLIO — COUNTER", big `0`, −/+/Reset, Editorial Mono styling. Shadow DOM, 44 nodes. |
| `07-domjs-counter.png` | domjs-control | Renders. Same semantic counter, Editorial Mono styling. Light DOM, 51 nodes. |
| `08-domjs-counter-after-clicks.png` | domjs-control | After 3× increment → shows `3`. **Live interactivity confirmed.** |

## What the A/B actually shows

- **Both runtimes render the same prompt to a comparable, on-fingerprint UI.** No
  visual quality gulf. Both produced a tasteful Editorial Mono counter with the
  requested controls.
- **Both are genuinely interactive.** Arrow via its reactive shadow-DOM mount;
  domjs via surface-vm into light DOM. domjs count 0→3 verified by clicking.
- **Rendering model differs:** arrow → shadow DOM (style-isolated);
  domjs → light DOM under the scoped surface root. Both styled correctly from the
  same token CSS.

## Honest verdict (consistent with the generation bakeoff)

Visually and behaviorally, **arrow and domjs are at parity on this task.** This
matches the generation findings: on a frontier model, both dialects produce
correct, attractive, interactive surfaces. The A/B does not reveal a domjs
advantage — nor an arrow one. The earlier "arrow is broken" scare was a
measurement artifact, not a real defect.

## Caveat

Single prompt, single fingerprint, frontier model — same limits as every run in
this session. A real quality difference (if any) would need the bigger,
repeat-based, multi-model run described in `surface-vm-bakeoff-findings.md`.
