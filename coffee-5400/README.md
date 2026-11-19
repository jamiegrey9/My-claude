# Philips 5400 cutaway and brew simulator

An interactive isometric cutaway of a Philips 5400 series bean-to-cup machine,
built with the [anatomy](https://github.com/wheresryan22/anatomy) skill's kit
(copied into `../anatomy-kit`, MIT licence).

The right side panel and service door are drawn removed. Pick a drink, strength,
temperature and grind, then press **Brew**. The part working at each stage lights
up, flows move along the hoses, and the readout shows temperature, pressure and
volume.

## Files

| File | What it is |
|---|---|
| `geometry.mjs` | World layout in millimetres (246 × 433 × 371 body). |
| `model.mjs` | Pure brew-cycle model: drinks, stages, `stateAt(plan, t)`. |
| `build.mjs` | Builds every part with the kit, settles paint order, writes the pages. |
| `live.js` | Browser layer: redraws moving parts from the model each frame. |
| `controls.html`, `coffee.css` | Simulator panel and styles. |
| `assemble.mjs` | Makes `index.html`, a single themed page for publishing. |

## Build

```sh
node build.mjs            # coffee-5400.html (dark)
node build.mjs --light    # coffee-5400-light.html
node build.mjs --audit    # also proves the geometry: must end "audit passed"
node assemble.mjs         # index.html from the light build, follows the viewer's theme
```

Machine figures (15 bar pump, 1.8 L tank, 275 g hopper, 12 grind steps, 5
strengths, 3 temperatures, 85–145 mm spout, LatteGo) follow Philips' published
specifications. Doses, flow rates and stage times are representative values,
not factory calibration. Unofficial; not affiliated with Philips.
