---
name: stream-cadence
description: The feed must be paced, not tiled — runs broken by interruptions, an unbroken rail that resolves in a loop splice, resolving ref citations, and type held to its floors and frame.
severity: medium
references:
  - pattern.cadence
  - pattern.tiles
  - pattern.transmission-grammar
  - pattern.type-system
---

Signal Stream is the alternation, not the grid. Reject the generated surface
if the cadence flattens or the wayfinding breaks:

- a viewport shows only equal rows at equal gaps with no interruption within
  roughly `--signal-cadence-run-length` rows — `pattern.tiles` calls this the
  anti-grid rule, and `pattern.cadence` calls the uninterrupted feed a log;
- the rail breaks or dead-ends before the loop splice — `pattern.cadence`
  requires the `--signal-rail-*` spine to run unbroken end to end as the
  spatial anchor, and `pattern.tiles` says the rail never dead-ends;
- the feed exceeds one viewport and ends without a loop splice — no repeated
  lead card, mono citation to the head, or chapter index across
  `--signal-loop-gap`, as `pattern.cadence` requires;
- any `→ REF:` citation lacks a matching `id` anchor on the surface —
  `pattern.transmission-grammar` states a dangling ref code is a broken
  transmission;
- mono metadata renders below 10px — `pattern.type-system` holds pills to a
  10–12px floor and demands layout collapse, never shrinking, on mobile;
- display type clips the host frame or sits <72px from the top —
  `pattern.type-system` requires the `--signal-shout-size` clamp to wrap
  cleanly with ≥72px top breathing room for host chrome.

The pass state: every viewport shows the run/interruption alternation, the
rail reads as one continuous index that resolves to the head, every citation
lands on a real anchor, and the type stays inside its floors and frame.
