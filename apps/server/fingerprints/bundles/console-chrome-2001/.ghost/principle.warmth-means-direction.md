---
description: Warm color is rationed wayfinding, never decoration — signal orange (#f68d1f) means forward/submit/launch, amber (#ecab37) means tool/badge/tab, brand red (#e60012) is a sparse error/identity mark, everything steady-state stays cool. Pull this before coloring any surface, chip, section, error, or status indicator.
---

## Stance

Warmth on a Console Chrome surface is a lit LED, not a paint choice. The eye
finds its way across the dense faceplate because the only warm things on it are
the things that go somewhere or do something. The moment orange appears on a
passive surface, the wayfinding system is dead and the palette collapses into
generic retro color.

The ration, exactly:

- **Signal orange `#f68d1f` (`--color-accent`)** — forward arrows, submit
  buttons, advance chips, open/launch/continue actions, and commit cues. These
  wear `--chrome-led-glow` (a 6px amber halo ringed by a hard 1px `#f68d1f`
  line) as their forward beacon. Nothing else may glow.
- **Amber `#ecab37` (`--color-accent-utility`)** — tools, badges, tabs, search
  Go buttons, and small utility affordances, ringed by `--chrome-led-amber` and
  beaded with the molded `--chrome-led-pip`. Amber marks a utility you can
  operate, never a broad brand fill.
- **Nav gold `#e48600` (`--color-accent-nav`)** — primary command words on
  carbon slabs, and the amber ring of the hardware selection cursor
  (`--chrome-cursor-frame`) — amber because the cursor IS navigation.
- **Brand red `#e60012` (`--color-brand-red`)** — a sparse identity or error
  mark, never a page fill or routine accent.

Everything steady-state stays cool: periwinkle `#7a8aba`/`#8ba1d4`, pale sky
`#9fbee7`, platinum `#dedede`, white, and carbon `#21242e`. Status readouts sit
in cool `--chrome-readout-text` teal; scene numbers and boot strips stay cool
silkscreen — a gauge reports, it never invites.

Never: orange section backgrounds or hero washes with no action role; amber as
a decorative brand wash; rainbow category systems that dilute the
chrome-and-command palette; red as a fill. If a warm element cannot answer
"what does pressing this do?", drain it to cool.

This principle is enforced across the [control system](pattern.controls), the
[command and navigation system](pattern.command-nav), and the
[badge and section-label system](pattern.badges).
