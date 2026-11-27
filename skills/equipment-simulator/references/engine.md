# Engine and page builder

Build every simulator on the bundled engine. It holds everything the two reference builds share
(process steps, part cards, pull-out with ghost slot, freeze/resume, 3D inspector, theme sync,
one-screen layout), so a new device only writes its drawing, its words and its physics.

```
assets/engine/page.mjs     Node: pageHtml(...) → Artifact body (one-screen layout + CSS + engine + your script)
assets/engine/engine.js    Browser: SimEngine(cfg), inlined by pageHtml
assets/engine/section.mjs  Node: cutFrame(o, axis, P), cutLathe(regions, F, P, opts) for half sections
assets/kit/                Anatomy kit (iso-kit, lathe, tube) + LICENSE
```

## Contents
1. File layout of a build
2. pageHtml
3. SimEngine(cfg)
4. Patterns: channels, captions, event chains, zoom, moving parts, result views
5. Pitfalls found in the builds

## 1. File layout of a build

```
my-device/
  facts.md       sources and values (see accuracy.md)
  geometry.mjs   build() → <svg>, extras() → runtime data, models() → 3D primitives
  content.mjs    PARTS (cards) and STEPS_TEXT (captions)
  build.mjs      CSS, controls HTML, result HTML, device SCRIPT; calls pageHtml and writes the files
```

`examples/scint-monitor/` is the most complete pattern (zoom, moving probe, event chains, meter,
pulse trace). `examples/xray-tube/` shows continuous effects (rotation frames, glow, beam). Run an
example with `node build.mjs` inside its folder.

## 2. pageHtml

```js
import { pageHtml, standalone } from "<skill>/assets/engine/page.mjs";
const html = pageHtml({
  title, eyebrow, lede, figLabel,           // header line and figure corner label
  svg,                                      // figure markup (wrap the body in <g class="cam"> if you zoom)
  parts: PARTS, steps: STEPS_TEXT,          // dock chips are grouped by part.group, in object order
  controls, controlsTitle, controlsNote,    // 2–3 controls (.ctl rows, .seg toggles)
  result, resultTitle, resultNote,          // one result view
  css, kitCss: k.ISO_CSS,
  data: { X, PARTS, STEPS: STEPS_TEXT, ACTS, W, H, MODELS: models(), K: G.scaleOf(P), VIEW: G.viewOf(P), processName },
  script: SCRIPT,                           // device script; must call SimEngine({ data: DATA, ... })
});
writeFileSync("device.html", html); writeFileSync("device-standalone.html", standalone(html));
```

Tokens available to device CSS: `--bg --surface --ink --ink-2 --muted --rule --accent --accent-soft
--on-accent --heat --heat-soft --e (particles) --light (scintillation/optical light)`, plus the
kit's `--anatomy-*`. Every channel `c` is also written to `.stage` as `--c`, so glows can be pure CSS
(`opacity: calc(var(--beam,0) * .2)`). Do not name a channel after a colour token (a channel called
`heat` would overwrite `--heat`).

## 3. SimEngine(cfg)

| cfg field | What it does |
|---|---|
| `data` | `DATA` (must include `X.anchorPx`, `X.O/ex/ey/ez`, `PARTS`, `STEPS`, `ACTS`, `W`, `H`, `MODELS`, `K`, `VIEW`) |
| `channels` | `{ name: start }`: the visual quantities the process drives (0–1 or any number) |
| `targets` | one object per step with the target value of each channel |
| `taus` | easing time per channel (seconds), or a function `(current, target) => tau` |
| `stepSeconds`, `holdLast` | autoplay pacing (default 5.2 s; extra hold on the last step) |
| `caption(step, api)` | returns the caption text for a step; use it to put live numbers into words |
| `onStep(step, api, user)` | called on every step change (result views, sounds) |
| `onFrame(dt, calm, api)` | device effects each frame; `dt` is 0 while frozen; `calm` = reduced motion and the learner has not pressed Play |
| `readout(api)` | text for the figure's corner caption |
| `busy(api)` | keep the loop running even when channels are settled (a live meter) |
| `offset(id)` | world offset `[dx, dy, dz]` of a part that the device moves (keeps cards and 3D aligned) |
| `onTheme(dark)` | theme change hook |

`api`: `step`, `playing`, `frozen`, `chosen`, `selected`, `cur` (channel values), `stage`, `svg`,
`setStep(i, user)`, `play()`, `pause()`, `kick()`, `select(id)`, `refresh()` (re-render caption and
card after a control changes).

## 4. Patterns

**Channels and targets.** List what the learner should see change per step (glow, spin, beam,
spill, zoom) and give each a channel. Slow, physical things (spin-up, cooling) get longer taus.

**Captions carry the numbers.** Instead of a readout grid, `caption()` adds one sentence with the
live value: "At 80 kVp they arrive at about 50 % of the speed of light", "the meter reads about
120 cps against a background of about 6 cps". Call `sim.refresh()` when a control changes.

**Event chains (detectors).** Model a detection as one event that walks through stages with
fixed durations: particle travels → interaction flash → light → photoelectrons → cascade → pulse
along cable → click. Draw each stage from pooled SVG elements (`pool(n, make)`, `take()`,
`release()`); compute positions in world space and project with `X.O/ex/ey/ez`. Keep only a few
chains alive at once in the zoomed steps so one can be followed, more in overview steps. Add
"stray" particles that miss the detector so the learner sees why geometry matters.

**Visual sample vs real rate.** The visible events are a slowed sample. Anything quantitative
(a meter, clicks) runs from the real model at the real rate (Poisson counts per frame, smoothed
like the instrument). Say so in the caption.

**Zoom per step.** Wrap the figure body in `<g class="cam">` and add channels for zoom factor and
focus point; in `onFrame` set `cam`'s transform to `translate(W/2 H/2) scale(z) translate(−c)`,
with `c` blending from the figure centre to the focus as `z` rises. The engine puts the pull-out
layer inside `.cam` and maps cards and the 3D canvas through it, so pulling parts works while
zoomed. Zoom into the small mechanism for the middle steps, out for the first and last.

**Moving parts.** Give each moving part group `data-move` and set its `transform` from the device
script (e.g. probe height). Return the same world offset from `cfg.offset(id)` so the card anchor
and the 3D inspector line up. If something attached to it must change shape (a cable), precompute
a few variants and show one.

**Result view.** One picture of the outcome: a radiograph strip, a pulse trace with the
discriminator line, a filling dose map. Tabs are fine for a second view (the X-ray page has Image /
Spectrum). Label only what the learner needs.

## 5. Pitfalls found in the builds

- The SVG must clip (`overflow: hidden`, set by page.mjs): a zoomed drawing that spills over the
  part dock swallows its clicks.
- A hollow part (ring electrode, collar) drawn with a filled hull hides what is inside it. Draw
  rings as outlines or leave them out of the drawing.
- Every pooled event needs its `items` list from birth, or the frame loop dies on the first one.
- Random simulations make single-frame motion checks flaky; `check_flow` compares motion summed
  over several snapshots.
- The figure fills its stage absolutely; letting the SVG size itself from its width overflows
  short screens.
