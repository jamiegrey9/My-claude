# X-Ray Tube Anatomy

An interactive half-section of a hospital rotating-anode X-ray tube, built with the
[Anatomy](https://github.com/wheresryan22/anatomy) isometric figure kit (MIT, copied into `kit/`).

- `node build.mjs` writes `xray-tube.html` (artifact body) and `xray-tube-standalone.html` (open in a browser).
- `geometry.mjs` — the drawing (housing, insert, collimator, stand, detector) and animation data.
- `content.mjs` — part descriptions and the 7-step exposure sequence.
- The spectrum, electron speed, efficiency, heat units and step-wedge transmission are computed live from kVp / mA / time.
