# X-ray tube (reference build)

Rotating-anode X-ray tube in half section, 17 parts, a 7-step exposure, pull-out with 3D turning.

To rebuild: copy `../../assets/kit/` to `./kit/` beside these files, then `node build.mjs`.
It writes `xray-tube.html` (artifact body) and `xray-tube-standalone.html`.

- `geometry.mjs`: the drawing (`build()`), runtime data (`extras()`) and 3D models (`models()`);
  `cutLathe()` is the half-section renderer.
- `content.mjs`: part cards (`PARTS`) and step captions (`STEPS_TEXT`).
- `build.mjs`: page CSS, layout and the live script (`LIVE()`): process engine, pull-out,
  freeze, 3D inspector, spectrum, step-wedge image.

This build predates the skill's one-screen and few-numbers rules: its page scrolls and has a
readout grid. Reuse its drawing and interaction code with the layout in `assets/shell.html`.
