# Accuracy

The simulator will be used to teach. A learner who sees a wrong mechanism animated beautifully
will believe it, so accuracy comes before polish. This file is the procedure.

## 1. Write `facts.md` before drawing

One file, kept next to the build, that every caption, card and motion is checked against.

```markdown
# Facts: [device]

## How it works (5–10 sentences, the mechanism in order)

## Process steps
| # | Step | What physically happens | What the learner sees | Source |

## Parts
| Part | Material / construction | Job | Typical values | Source |

## Numbers used on screen
| Quantity | Value shown | Range in real devices | Source | Where shown |

## Simplifications (shown in the caption)
- e.g. near half cut away; motion slowed; electron path exaggerated in width
```

Sources, in order of preference: standards and professional-body reports (IEC, AAPM, IPEM, ICRU,
NCRP), manufacturer technical documentation, standard textbooks (e.g. Bushberg *The Essential
Physics of Medical Imaging*; Curry *Christensen's Physics of Diagnostic Radiology*; Knoll
*Radiation Detection and Measurement*; Cherry *Physics in Nuclear Medicine*). Use web search when
available to confirm values and current practice. When a value cannot be confirmed, phrase it
cautiously or leave it out.

## 2. Phrase values honestly

- Typical values carry "about" or "≈": "about 3,400 rpm", "≈ 2,200 °C".
- Values that vary between models get a range: "3–6 A", "7–20° (12° here)".
- Regulatory limits are stated exactly, with what they apply to: "leakage at most 1 mGy in one
  hour at 1 m".
- Computed values (electron speed from kVp, a transmitted fraction) come from one small model
  function in the page, so the caption, the animation and any readout agree. Round them to what
  a learner needs (whole percent, two significant figures).
- Never invent a number to fill a card. Two solid facts beat four shaky ones.

## 3. Keep numbers off the main screen

The brief is to teach visually. Rules of thumb:

- Main screen: at most one live caption line with the settings (e.g. "80 kVp · step 5 of 7"),
  plus the values on the controls the learner is turning.
- Each part card: 2–3 facts, the ones a teacher would ask about.
- Everything else becomes a visual: speed of particles for energy, density for current, glow for
  heat, a filling bar without digits for stored heat, an image getting darker for exposure.
- If a quantity is important but needs a number (an energy spectrum, a pulse height), give it one
  small, clearly labelled view rather than many tiles.

## 4. Mechanism traps (all seen in practice)

- **Shortcut animations that teach the wrong thing.** For example, electrons should leave the
  filament as a cloud and only cross when high voltage is applied; X-rays should go in all
  directions and be stopped by the shielding, not emerge only as a neat beam.
- **Mixing generations or types.** A rotating-anode tube with a stationary-anode window, or a
  photomultiplier drawn with a modern SiPM's readout. Pick one real configuration and say which.
- **Geometry that contradicts physics.** Check angles and orientations that carry meaning: the
  anode bevel faces the cathode and the central ray goes through the port; the collimator mirror
  sits at 45° to reflect the lamp along the beam; dynodes are arranged so electrons cascade.
- **False sense of scale.** Real motion is often far too fast (anode at 57 turns/s, electrons in
  under a nanosecond) or too slow to see. Slow it down and say so in the caption.
- **Missing safety parts.** Shielding, interlocks, filtration and thermal cut-outs are part of
  how real equipment works; include them as parts.

## 5. Review before publishing

Read every caption and card against `facts.md`, one by one. Check:
- every number on screen appears in the "Numbers used on screen" table with a source;
- each process step's animation shows what the "What physically happens" column says;
- simplifications are named on the page;
- the page says nothing more certain than the sources do.

Worked example: `examples/xray-tube/content.mjs` (part cards and step captions) was written this
way. Its facts include the 12° target angle and line-focus principle, the 69.5 keV tungsten
K-edge with Kα ≈ 59 keV and Kβ ≈ 67 keV, ≥ 2.5 mm Al total filtration above 70 kVp, centre-grounded
generators (cathode at −kVp/2), the leakage limit, and ≈ 1 % X-ray efficiency (≈ 0.9×10⁻⁹·Z·V).
