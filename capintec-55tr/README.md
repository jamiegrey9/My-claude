# CRC-55tR anatomy

Interactive cutaway of a Capintec CRC-55tR radionuclide calibrator, built with the
[anatomy](https://github.com/wheresryan22/anatomy) isometric kit (MIT, copied into `kit/`).

- `node build.mjs` writes `capintec-55tr.html` (an artifact page body, no `<html>` wrapper).
- `geometry.mjs`: the cutaway chamber and readout geometry.
- `content.mjs`: the explanation text for each component.
- `live.js`, `page.css`: selection, ion animation, theme and layout.
