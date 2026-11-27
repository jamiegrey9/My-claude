# Drawing the device

The figure is a crafted isometric drawing made with the Anatomy kit (MIT, bundled in
`assets/kit/`; upstream: github.com/wheresryan22/anatomy). Copy `assets/kit/` next to your build
script as `kit/`, write a Node build that emits SVG strings, and inline the result into the page.
The reference build is `examples/xray-tube/geometry.mjs`.

## Contents
1. Kit essentials
2. Camera
3. Half-section (cut-away) bodies
4. Painter's order
5. Parts, groups and effect layers
6. Data the page needs at runtime
7. Themes

## 1. Kit essentials

```js
import * as k from "./kit/iso-kit.mjs";      // camera, prisms, lines, SVG strings, ISO_CSS
import * as G from "./kit/lathe.mjs";        // round parts on any axis, frames, vectors
import { tubePieces, tubeSvg } from "./kit/tube.mjs";   // cables and pipes
```

| Need | Call |
|---|---|
| Fit camera | `k.fitProjection(points, W, H, { pad, azimuth, elevation })` |
| Project a point | `k.iso([x, y, z], P)`; depth: `G.dot3(p, G.viewOf(P))` (larger is nearer) |
| Box / plate | `k.slabOf({ x, y, w, d, r }, z, h, P, steps, bevel)` |
| Upright cylinder | `k.cylinder(cx, cy, r, z, h, P, steps, bevel)` |
| Round part on any axis | `G.frameOf(o, a, u, v)`, then `G.disc(s0, s1, r, F, P)`, `G.solidOf(profile, F, P)`, `G.lathe(meridian, F, P)` |
| Ball | `G.sphereOf(centre, r, P)` |
| Paint a solid | `k.solidSvg(paths, { tone: "hi" \| "mid" \| "lo", lit, inner })` |
| Lines and dots | `k.lineSvg(d, { tone })`, `k.dotsSvg(points, { size, tone })` |
| Seams, knurls, ribs | `k.sideSeam`, `k.knurl`, `G.ribsOf(..., { fade })` + `k.fadedSvg`, `G.arcOf` |
| Cable | `G.fillet(route, r, 8, { P, tube })` → `tubePieces(points, r, P)` → `tubeSvg` per piece, sorted by depth |
| Text on a face | `k.faceTextSvg(k.topMatrix([x, y], z, P, "x"), "080", { size })` |
| Wrap | `k.figureSvg({ width, height, label, body })`; CSS: `k.ISO_CSS` |

Tones: base and stands `lo`, structure `mid`, the working subject `hi`. Details come from real
parts (screws as 0.5 dots, seams, knurled knobs, label plates), not texture.

## 2. Camera

Choose the azimuth so the faces that carry the mechanism point at the viewer. The X-ray tube uses
azimuth 118°, elevation 28°, so the anode's bevelled target face and the cathode–anode gap are
visible. Fit with every extreme point, including cables and the tallest part.

The kit's projection is affine, so a point can be projected in the page with
`O + x·ex + y·ey + z·ez` (see `extras()` in the example) for live particles and photons.

## 3. Half-section (cut-away) bodies

Real equipment hides its working parts inside shells. Cut every enclosing body (housing, glass
envelope, coils, collimator box, detector casing) in half along a vertical plane through its axis,
remove the near half, and show the internal working parts whole. Learners read this instantly.

`cutLathe(regions, F, { steps, phi })` in `examples/xray-tube/geometry.mjs` draws the back half of
a body of revolution:

- `F` is a frame whose `u` is up and `v` points away from the viewer (for a tube along x:
  `G.frameOf([0, 0, ZA], [1, 0, 0], [0, 0, 1], [0, -1, 0])`), so `phi` in `[0, π]` is the back half.
- Each region is a closed section polygon `[[s, r], ...]` (outer profile, then inner profile back),
  with its own cut style (`cut-al`, `cut-pb`, `cut-glass`, `cut-cu`).
- It returns `{ body, sect }`: the visible facets of the inner and outer surfaces, sorted by depth,
  with rim and silhouette lines; and the two section faces at the cut plane. Draw `body`, then
  anything that sits between the shell and the cut plane, then `sect`.
- Layered walls (aluminium shell plus lead lining) go into one call as separate regions so their
  facets sort together.
- Boxes need no special cut: a box that ends at the cut plane (y from −30 to 0) is a cut box.

Show the cut face's materials with fills (lead darker, glass translucent, copper winding
cross-sections as dot rows).

## 4. Painter's order

Draw back to front. What worked for the tube:

1. Base plate and the stand (behind everything).
2. Things below the main body (detector, phantom, console), then the collimator, because the
   housing's lower shell hides its top.
3. Cables, then the housing back half (`body`), then receptacles that pierce it, then the housing
   section faces (`sect`).
4. Shells inside the housing (stator, envelope) as body then sect.
5. Internal parts whole, far to near along the view (rotor, stem, anode, then the cathode, which
   is nearer at this azimuth).
6. Effect layers between them (`beam-in`, heat glow, photons, electrons, cloud).

Check overlaps by projecting silhouettes (offset of a radius-r body ≈ 0.975·r at the tube's
camera) and keep internal radii a few units inside the shell's section strips so a part never
paints over the cut face of the shell around it.

## 5. Parts, groups and effect layers

- Wrap every drawn piece of a part in `<g class="part" data-part="id">`. A part may have several
  groups at different points in the painter's order (housing body and housing sect); the
  pull-out moves all of them together.
- Animated effects live in `<g class="... fx">` layers that are not parts. Precompute what is
  costly: rotation frames for a spinning disc (12 frames over one symmetry period), the beam
  polygons, the focal-track ring.
- Keep a placeholder `<g class="name">` in the build and replace it with the effect markup in the
  page build, as `build.mjs` does.

## 6. Data the page needs at runtime

Export from the geometry module (see `extras()` and `models()`):
- `O, ex, ey, ez`: the affine projection, for live particles.
- `anchorPx[id]`: one screen point per part, for its card marker.
- Screen points of sources (filament, focal spot) and precomputed effect paths and frames.
- `K = G.scaleOf(P)` and `VIEW = G.viewOf(P)` for lining up the 3D inspector.
- `models()`: the 3D primitives for every part (see `interaction.md`).

## 7. Themes

The kit's colours live on `.iso` (dark by default; `data-theme="light"` for light). Put
`class="iso"` on the page wrapper and sync its `data-theme` with the viewer's theme: the root
`data-theme` attribute when present, otherwise `prefers-color-scheme` (the X-ray page does this
with a MutationObserver).
