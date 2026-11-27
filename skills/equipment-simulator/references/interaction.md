# Interaction

All of this is implemented in `assets/engine/engine.js` (functions named below) and used through
`SimEngine(cfg)` (`engine.md`). Read this file when you need to change how it behaves. Models come
from each build's `geometry.mjs` (`models()`).

## Contents
1. The process engine
2. Pull-out (2D lift, ghost slot, drag)
3. Freeze and resume
4. 3D inspector
5. Part cards and "See it in action"
6. Reduced motion, keyboard, touch

## 1. The process engine

- `STEPS`: title and 2–3 sentence caption per step (`content.mjs`); `cfg.caption` can replace a
  caption with a live sentence.
- `TARGET[step]`: the value every visual channel should reach at that step, 0–1 each
  (e.g. `fil, spin, hv, heat, emit, beam, img`). The frame loop eases `cur` toward `TARGET`
  (`easeTo`, with slower time constants for things with inertia such as spin-up and cooling).
- CSS variables on `.stage` carry the channels (`--fil`, `--heat-on`, `--beam`) so glows and
  beams are pure CSS; particles and rotation frames are set from the loop.
- `setStep(i, user)` updates the caption, step buttons and result view; a user-initiated step
  pauses autoplay and seats any pulled part. `play()` and `pause()` flip `playing`; while playing,
  `stepClock` advances steps every ~5 s, with a longer hold on the last.
- The loop only runs while the figure is visible (IntersectionObserver) and something is moving.

## 2. Pull-out

`pull(id)`:
1. Collect all `.part[data-part=id]` groups and their union `getBBox()`.
2. Clone each group as a **ghost** before it (class `ghost`: fills hidden except a faint cavity
   fill, outlines dashed) so the empty slot stays visible.
3. Move the real groups into a `liftLayer` appended at the end of the SVG (drawn on top), keeping
   their internal order.
4. Animate `translate(off) scale(s)` about the bbox centre toward a target: outward from the
   figure centre and a little up (about 58 units, scale 1.12); for large parts (wider than 45%
   of the figure) move less (26 units, scale 1.02) and do not lift toward the top edge.
   `clampOff` keeps the scaled box inside the viewBox.
5. Dragging the lifted layer changes `off` (pointer capture; convert client px to viewBox units).

`seat()` moves each group back after its ghost, removes ghosts and the transform. `putBack({
resume, instant })` glides home first unless `instant` (used when another part is picked or a
process control is pressed).

Clicking another part while one is out swaps instantly; clicking empty space puts back.

## 3. Freeze and resume

On pull: remember `wasPlaying`, pause, set `frozen = true`. In the frame loop use `dt = 0` while
frozen and stop scheduling frames, so particles, photons and rotation stop exactly where they
were. Dim the rest of the device a little and the effect layers more (`.stage[data-lifted]`).
On seat: `frozen = false`, and `play()` again if it was playing and the put-back allows resume.

## 4. 3D inspector

The drawing is a projection, so turning needs geometry. Every part gets a 3D model made from the
**same dimensions** as the drawing (`models()` in `geometry.mjs`). Primitive kinds:

| kind | fields | built as |
|---|---|---|
| `rev` | `F` frame, `sec` closed section polygon `[[s, r]...]`, `t` tone, `phi` (null = full turn, `[0, π]` = back half) | one indexed band per polygon edge (smooth around, crisp at profile corners); caps by `THREE.ShapeUtils.triangulateShape` for half turns |
| `box` | `a`, `b` corners | `BoxGeometry` translated |
| `tube` | `pts`, `r` | `TubeGeometry` on a centripetal Catmull-Rom curve, plus end caps |
| `sph` | `c`, `r` | `SphereGeometry` |
| `quad` | 4 `pts` | two triangles (mirrors, windows) |
| `line` | `pts` | `THREE.Line` (focal tracks, slots) |

Tones map to a per-theme palette (`hi`, `mid`, `lo`, `lead`, `copper`, `alu`, `glass`, `heat`).

Rendering (`enter3D`, `buildModel`, `layout3D` in the example):
- three.js r128 UMD from cdnjs, loaded lazily shortly after page load (`loadThree`). If it fails,
  the 2D pull-out still works.
- Materials: `MeshToonMaterial` with a 4-step gradient map (gives the kit's banded four-tone
  look), `DoubleSide`, polygon offset; glass transparent with `depthWrite: false`. Edges:
  `EdgesGeometry(geo, 28)` in the ink colour. Silhouette: CSS `drop-shadow` 0.5px in four
  directions on the canvas, plus a soft shadow.
- **Mirror:** the kit's projection is mirrored relative to three's right-handed space. Put the
  model in a group with `scale(1, −1, 1)`, and place the orthographic camera along
  `(VIEW.x, −VIEW.y, VIEW.z)` with up `(0, 0, 1)`. At identity rotation the 3D view then matches
  the drawing exactly, so the swap from SVG to canvas is invisible.
- **Alignment:** pixels per world unit = `K · s · svgCssWidth / W`. The canvas is a square of
  side `2R·px + 24` (R = bounding radius) centred on the screen position of the model's centre
  after the lift transform. Lights ride on the camera so shading stays readable as the part turns.
- Swap in after the lift glide finishes; hide the SVG lift layer while the canvas shows.
- **Turn:** drag rotates about the camera's up and right axes (quaternion premultiply, about
  0.011 rad per px). Drags that start on empty canvas still turn (thin parts are hard to hit);
  only a click with no movement on empty canvas puts the part back.
- **Move:** a "Move" handle above the canvas, or Shift-drag.
- **Square up:** double-click or the card's button slerps back to identity.
- **Put back:** slerp to identity, hide the canvas, show the SVG lift layer, then glide home.
- Render on demand only (after a turn, move or resize), not in a loop.

## 5. Part cards and "See it in action"

- Card: group, name, one-line role (accent colour), 3–5 sentence body, 2–3 facts, a status line
  ("Sequence paused while this part is out." plus how to turn and move it), and actions:
  Put back · Square up (3D only) · See it in action.
- While a part is lifted, place the card on the side of the figure away from the part. Otherwise
  place it beside the part's anchor. On narrow screens put it under the figure.
- `ACTS = { partId: stepIndex }`: the step where each part does its job. "See it in action" seats
  the part, keeps it highlighted, calls `setStep(ACTS[id], true)` then `play()`, and keeps the
  card open with "Watching step n: title", plus a "Pull it out" button to lift it again.

## 6. Reduced motion, keyboard, touch

- Reduced motion: do not autoplay on load; once the learner presses Play, picks a step, or opens
  "See it in action", animate normally (a `chosen` flag). Glides become instant.
- Keyboard: chips are buttons; Enter pulls; arrows turn, Shift+arrows move; Esc puts back; Back,
  Play and Next are real buttons.
- Touch: one finger drag turns (canvas has `touch-action: none` only while a part is lifted, so
  the page still scrolls on phones otherwise); the Move handle moves.
