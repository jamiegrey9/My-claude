# Facts: NaI(Tl) scintillation contamination monitor (RadHound-style ratemeter + 44A-type probe)

Configuration shown: a digital ratemeter (Radhound class, LabLogic / Southern Scientific) with a
thin-crystal sodium-iodide end-window probe of the Mini-Instruments / Thermo type 44A design
(Southern Scientific's SS404 Al is sold as its equivalent). Used in nuclear medicine and
laboratories to find surface contamination by low-energy photon emitters (I-125, Tc-99m, Co-57).

## How it works
Photons from contamination pass the probe's thin aluminium window and are absorbed in a thin
NaI(Tl) crystal, which converts each absorbed photon into a brief flash of blue light. The light
crosses a glass window to the photocathode of a photomultiplier tube, which releases a few
photoelectrons. A chain of dynodes, each at a higher voltage, multiplies them into a measurable
current pulse at the anode. The ratemeter supplies the high voltage, amplifies each pulse,
counts the pulses above a discriminator threshold, clicks a speaker, and displays the count rate.

## Process steps
| # | Step | What physically happens | What the learner sees | Source |
|---|---|---|---|---|
| 1 | Background | 4–8 counts/s from cosmic rays and natural radioactivity with nothing spilt | occasional events, meter reads a few cps | Mini 900 manual (background 4–8 cps) |
| 2 | Contamination | I-125 emits 27–35 keV photons (Te K X-rays, 35.5 keV gamma) in all directions | spill appears, photons leave it | standard nuclear data |
| 3 | Through the window | 14 mg/cm² Al (≈ 52 µm): thin enough for photons down to ≈ 15 keV; light-tight | zoom to window | probe spec |
| 4 | Flash in the crystal | NaI(Tl) 32 mm × 2.5 mm absorbs nearly all photons < ≈ 60 keV; ≈ 38 light photons per keV, peak 415 nm, decay ≈ 230 ns | flash, ≈ 1,100 photons for 30 keV | probe spec; Knoll |
| 5 | Light to electrons | bialkali photocathode quantum efficiency ≈ 25 % | light dots → electrons | Knoll; PMT data |
| 6 | Multiplication | ≈ 10 dynodes, each electron frees several; gain ≈ 10⁵–10⁶; HV ≈ 650 V via divider | cascade grows | SS404 HV 650 V; Knoll |
| 7 | Count and click | pulse → meter: amplifier, discriminator, counter, speaker; display in cps | pulse along cable, click, display | Radhound datasheet |

## Parts (probe body ≈ 50 mm Ø × 180 mm; meter ≈ 250 × 85 × 160 mm)
| Part | Construction | Job | Values | Source / status |
|---|---|---|---|---|
| Window | Al foil 14 mg/cm² | lets photons in, keeps light out | ≈ 52 µm; 8 cm² | spec (area: Raydiant) |
| Crystal | NaI(Tl), hermetically sealed (hygroscopic) | photons → light | 32 Ø × 2.5 mm | spec |
| Optical window | glass, optical coupling | light to PMT | ≈ 2 mm | typical (assumed) |
| Lead shield | Pb | cuts photons from other directions | 3.1 mm | spec ("short lead shield") |
| PMT | glass, bialkali photocathode, ≈ 10 dynodes | light → electrical pulse | ≈ 28 mm Ø (1⅛") | assumed typical size |
| Magnetic shield | mu-metal sleeve | keeps magnetic fields from bending electron paths | — | standard practice |
| Voltage divider | resistor chain | shares HV across dynodes | ≈ 650 V total | SS404 spec |
| Connector + cable | coaxial HV/signal | HV in, pulses out | — | — |
| Meter | backlit LCD, digits + bar; cps/cpm/µSv h⁻¹; Li-ion > 12 h | supply, count, display, sound | 160 × 250 × 85 mm with stand | Radhound datasheet |

## Numbers used on screen
| Quantity | Value | Source | Where |
|---|---|---|---|
| Background | 4–8 cps (6 used) | Mini 900 manual | meter, caption |
| I-125 sensitivity | 3.8 cps per Bq/cm² | Mini 900 manual | model |
| Tc-99m sensitivity | 1.6 cps per Bq/cm² | Mini 900 manual | model |
| Spill activity | 30 Bq/cm² | illustrative | model (stated as example) |
| Light yield | ≈ 38 photons/keV | Knoll | caption (≈ 1,100 at 30 keV, ≈ 5,300 at 140 keV) |
| Photocathode QE | ≈ 25 % | Knoll | caption |
| Gain | ≈ 10⁵–10⁶ | Knoll | caption |
| HV | ≈ 650 V | SS404 spec | card |

## Model
count rate = 6 + S × 30 Bq/cm² × g(h), g(h) = Ω(h) / Ω(10 mm) with Ω the solid angle of the
32 mm crystal from the spill centre (point-source approximation). Illustrative, stated as such.
Tc-99m 140 keV photons sometimes pass straight through the 2.5 mm crystal (shown as a fraction
passing); the exact fraction is not shown as a number.

## Simplifications (stated on the page)
- near half of probe cut away; window thickness exaggerated; events shown are a slowed sample;
- meter layout of keys and display illustrative of the class, not a copy of one model.

## Sources
- Mini Instruments Mini Monitor 900 manual (archive.org text), Raydiant 44A product page,
  Southern Scientific SS404 Al/Be page, LabLogic Radhound datasheet (search snippets).
- G. F. Knoll, Radiation Detection and Measurement.
