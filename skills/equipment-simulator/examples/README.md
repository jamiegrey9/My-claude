# Examples

Both build on `../assets/engine` and `../assets/kit`. Run `node build.mjs` inside a folder; it writes
the Artifact body (`<name>.html`) and a standalone file.

- `xray-tube/`: rotating-anode X-ray tube in half section; 17 parts, 7-step exposure, kVp/mA/focus,
  step-wedge image and spectrum. Continuous effects: filament glow, electron stream, anode rotation
  frames, photons, beam.
- `scint-monitor/`: NaI(Tl) thin-crystal contamination probe (44A type) with a ratemeter over a
  spill tray; 18 parts, 7-step detection with zoom, probe height control, I-125/Tc-99m, live
  count rate on the LCD, clicks, pulse trace with discriminator. `facts.md` is its fact sheet.
