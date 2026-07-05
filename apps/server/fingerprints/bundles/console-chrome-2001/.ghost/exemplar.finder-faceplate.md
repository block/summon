---
description: A complete annotated faceplate — carbon dual-command bar, beveled hero plate, amber tool-chip search cluster, and platinum result rows on real --chrome-* tokens. Pull this as the quality bar before composing any Console Chrome surface.
---

## The faceplate

```html
<body style="margin:0; background:#d7d7d7; font-family:Arial,Helvetica,sans-serif; color:#21242e;">
  <main style="max-width:860px; margin:24px auto; background:var(--chrome-faceplate);
               box-shadow:var(--chrome-faceplate-rim); padding:8px;">

    <!-- Carbon primary command bar: halftone grain, nav-gold command words -->
    <nav style="background:var(--chrome-halftone-carbon); box-shadow:var(--chrome-bevel-hard);
                display:flex; gap:16px; align-items:center; padding:8px 12px;">
      <span style="font:900 15px 'Arial Black',Arial; color:#ffffff; -webkit-text-stroke:1px #3d4f97;
                   text-shadow:2px 2px 0 rgba(33,36,46,0.5);">MODULE FINDER</span>
      <a href="#library" style="font:bold 11px Arial; letter-spacing:0.045em; color:#e48600;
                                text-decoration:none; text-transform:uppercase;">Library</a>
      <a href="#archive" style="font:bold 11px Arial; letter-spacing:0.045em; color:#e48600;
                                text-decoration:none; text-transform:uppercase;">Archive</a>
      <a href="#help" style="font:bold 11px Arial; letter-spacing:0.045em; color:#c0d5e6;
                             text-decoration:none; text-transform:uppercase;">Help</a>
    </nav>

    <!-- Pale secondary tool strip: the amber search cluster, parted by a dotted seam -->
    <form style="background:#9fbee7; box-shadow:var(--chrome-bevel-hard); margin-top:4px;
                 display:flex; gap:8px; align-items:center; padding:6px 12px;
                 border-bottom:3px solid transparent;
                 border-image:var(--chrome-divider-dotted) 1;">
      <label for="q" style="font:bold 10px Arial; letter-spacing:0.045em; text-transform:uppercase;
                            color:#3d4f97;">Search modules</label>
      <input id="q" type="text" value="calendar"
             style="border:0; box-shadow:var(--chrome-inset-input); padding:4px 8px;
                    font:12px Arial; background:#ffffff; width:180px;">
      <select style="font:11px Arial; padding:3px;">
        <option>All categories</option><option>Utilities</option><option>Games</option>
      </select>
      <button type="submit"
              style="background:#ecab37; border:0; box-shadow:var(--chrome-led-amber), var(--chrome-bevel-hard);
                     font:bold 11px Arial; letter-spacing:0.045em; text-transform:uppercase;
                     padding:4px 12px; cursor:pointer;">
        <span style="display:inline-block; width:8px; height:8px; border-radius:9999px;
                     background:var(--chrome-led-pip); margin-right:4px;"></span>GO
      </button>
    </form>

    <!-- Hero plate: deep bevel, box-art wordmark, ONE signal-orange forward disc -->
    <section style="background:#8ba1d4; box-shadow:var(--chrome-bevel-deep); margin-top:8px;
                    padding:24px 16px; display:flex; justify-content:space-between; align-items:center;">
      <div>
        <h1 style="margin:0; font:900 44px 'Arial Black',Impact,Arial; line-height:0.95;
                   color:#ffffff; -webkit-text-stroke:2px #21242e;
                   text-shadow:3px 3px 0 #3d4f97;">SPRING LINEUP</h1>
        <p style="margin:4px 0 0; font:bold 12px Arial;">12 new modules docked this week.</p>
      </div>
      <a href="#lineup" aria-label="Open the spring lineup"
         style="width:48px; height:48px; border-radius:9999px; background:#f68d1f;
                box-shadow:var(--chrome-led-glow); display:grid; place-items:center;
                color:#ffffff; font:900 22px Arial; text-decoration:none;">&#9654;</a>
    </section>

    <!-- Result rows: platinum strips under a section-label bar, dotted seams, orange chevrons -->
    <section style="background:#ffffff; box-shadow:var(--chrome-bevel-hard); margin-top:8px;">
      <h2 style="margin:0; background:#dedede; box-shadow:var(--chrome-bevel-hard);
                 font:bold 11px Arial; letter-spacing:0.045em; text-transform:uppercase;
                 padding:5px 12px; color:#3d4f97;">Featured — 3 results</h2>
      <ul style="margin:0; padding:0; list-style:none;">
        <li style="display:flex; justify-content:space-between; padding:8px 12px;
                   border-bottom:2px solid transparent; border-image:var(--chrome-divider-dotted) 1;">
          <span style="font:12px Arial;"><b>Pocket Calendar</b> — month grid, 4 KB</span>
          <a href="#cal" style="color:#f68d1f; font:900 12px Arial; text-decoration:none;">&#9654;</a>
        </li>
        <li style="display:flex; justify-content:space-between; padding:8px 12px;
                   border-bottom:2px solid transparent; border-image:var(--chrome-divider-dotted) 1;">
          <span style="font:12px Arial;"><b>Team Scoreboard</b> — live standings feed</span>
          <a href="#score" style="color:#f68d1f; font:900 12px Arial; text-decoration:none;">&#9654;</a>
        </li>
        <li style="display:flex; justify-content:space-between; padding:8px 12px;">
          <span style="font:12px Arial;"><b>Guest Log</b> — inset sign-in form</span>
          <a href="#log" style="color:#f68d1f; font:900 12px Arial; text-decoration:none;">&#9654;</a>
        </li>
      </ul>
    </section>
  </main>
</body>
```

## What is load-bearing

- **The chassis, not the viewport, is the outermost surface.** The 860px `main`
  molded with `--chrome-faceplate` + `--chrome-faceplate-rim` on the grey
  `#d7d7d7` field is what makes this a faceplate; remove it and every module
  below becomes a floating card.
- **Every plate carries an inset bevel pair, zero blur.** `--chrome-bevel-hard`
  on ordinary plates, `--chrome-bevel-deep` on the one hero. No element in this
  fragment has a blurred `box-shadow` — that invariant is the identity.
- **Warmth is exactly rationed.** One signal-orange `#f68d1f` forward disc wears
  `--chrome-led-glow`; the amber `#ecab37` GO chip wears `--chrome-led-amber` +
  a `--chrome-led-pip` bead; nav words on carbon are gold `#e48600`; row
  chevrons are orange because they advance. Nothing warm is passive.
- **Structure is carried by silkscreen labels and dotted seams.** The 10–11px
  bold uppercase labels with `0.045em` tracking and the
  `--chrome-divider-dotted` border-image seams do the hierarchy work — not
  whitespace.
- **The carbon bar is textured**, not flat black: `--chrome-halftone-carbon`
  supplies the dot-matrix grain.

## What is incidental

The specific copy (SPRING LINEUP, module names), the 860px exact width (any
bounded ~780–900px chassis works), the three-row count, inline styles versus
classes, and the choice of a finder task — swap all of it freely. What may not
change: bevels over shadows, the bounded chassis, rationed warm semantics, and
labeled modules parted by dotted seams.
