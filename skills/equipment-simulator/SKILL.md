---
name: equipment-simulator
description: Build interactive, one-screen teaching simulators of real equipment and detectors (X-ray tubes, CT and flat-panel detectors, gamma cameras, PET rings, ionisation chambers, Geiger counters, photomultipliers, linacs, ultrasound transducers, MRI coils, lab and industrial instruments) as a single self-contained HTML artifact. The device is drawn as a crafted isometric half-section; every part can be pulled out, turned in 3D and explained; one central process (prep → event → signal → result) plays step by step with animation. Content must be physically accurate, but the screen teaches visually instead of with dashboards of numbers, and fits a standard computer screen with no scrolling. Use this whenever someone asks for an interactive simulator, explainer, teaching model, virtual dissection, "how does a ___ work" tool or training demo for a piece of equipment, scanner, detector or instrument, even if they never say "simulator".
---

# Equipment simulator

A learner opens one page and sees the real device, cut open. They press Play and watch the
device do its job, one step at a time, with every step narrated in plain words. Whenever
something catches their eye they click it: the part lifts out of the machine, they turn it over
in 3D, and a short card says what it is and why it is there. "See it in action" drops them back
into the step where that part matters. That is the whole product. Everything below serves it.

The reference build is the X-ray tube in `examples/xray-tube/` (rotating-anode tube in half
section, 17 parts, a 7-step exposure, pull-out and 3D turning). Read its files when you need a
working pattern; the sections below say where each pattern lives.

## The four promises

Each one comes from what learners and the person commissioning the X-ray build actually asked for.

1. **Accurate.** Teachers will use this in front of students, so every sentence, number, shape
   and motion must be true to the real device, or visibly marked as simplified ("motion slowed,
   not to scale"). An attractive simulator that teaches one wrong mechanism does harm.
2. **Visual, not numeric.** The screen teaches through what moves, glows, fills and changes, not
   through a grid of readouts. Numbers are allowed where a learner would quote them (a part
   card's two or three facts; a single live caption like "80 kVp"), and nowhere else. If you are
   adding a fourth number to the main screen, turn it into a visual instead (glow strength,
   particle density, speed, a fill level, a picture forming), or move it into a part card.
3. **One central process.** Pick the single story the device exists to tell, from cause to
   result, and make it 5–8 steps. Everything on screen either belongs to that story or is a part
   the learner can pull out. No side quests, no second process competing for attention.
4. **One screen, lots to touch.** It fits 1280×720 and up with no page scroll. Every part is
   clickable, draggable and turnable; the process can be played, paused, stepped and scrubbed;
   one or two controls change the physics visibly.

## Workflow

Work in this order; the early steps decide most of the quality.

1. **Facts first.** Before any drawing, write `facts.md`: how the device works, its real parts
   and materials, the process steps, typical values, and a source for each claim (manufacturer
   documentation, standards such as IEC/AAPM/IPEM reports, textbooks such as Bushberg or Curry).
   Use web search if you have it; otherwise rely on well-established textbook values and mark
   anything you are less sure of so it can be phrased cautiously ("about", "typically"). Read
   `references/accuracy.md` for the procedure and the traps (false precision, mixing device
   generations, mechanism shortcuts that are wrong).
2. **Choose the process and its steps.** Name each step by what physically happens ("Electrons
   accelerate", not "Phase 3"). Decide what the learner sees change at each step: that list is
   your animation plan. Typical shape: standby → preparation → the event → interaction →
   signal/beam formed → result (image, count, dose, trace).
3. **Parts list.** 12–20 clickable parts, grouped by where they sit (e.g. "Cathode side",
   "Housing", "Readout chain"). For each: name, one-line role, 3–5 sentence body, 2–3 facts, and
   the process step where it does its job (this drives "See it in action").
4. **Draw the device** as an isometric half-section with the bundled Anatomy kit
   (`assets/kit/`). Read `references/drawing.md`: the cut-away renderer, painter's order, which
   parts to show whole inside a cut body, and the effect layers (`.fx`) for particles and glow.
5. **Build 3D models** for every part from the same dimensions the drawing uses (lathe profiles,
   boxes, tubes), so a pulled-out part can be turned without changing shape. See
   `references/interaction.md`, "3D inspector".
6. **Assemble the one-screen page** from `assets/shell.html`: header line, figure card with a
   part dock along its bottom, and a slim right rail with the process card, at most 2–3 controls
   and one "result" view. Wire the interactions in `references/interaction.md`.
7. **Verify** with the bundled scripts and real screenshots (`references/verify.md`). Fix and
   re-run until both scripts pass, then publish.

Size the job honestly: a single detector or a small instrument is a few hours; a large machine
with several subsystems (a linac, a CT gantry) is more. Say so before starting, and if it is very
large, propose the core subsystem first.

## Screen layout (one screen, no scroll)

Use `assets/shell.html` as the skeleton. Why each choice:

- **Figure dominant (about two thirds of the width).** The device is the teacher; it must be big
  enough that small parts are clickable on a laptop.
- **Process card at the top of the rail.** Step buttons, a "now" caption (title plus 2–3 plain
  sentences) and Back / Play / Next. The caption is where the teaching words live, so the drawing
  itself stays almost wordless.
- **Controls: two or three at most**, each with a visible consequence in the figure (brighter
  glow, faster particles, wider beam). A control whose only effect is a number elsewhere does not
  belong on the main screen.
- **One result view.** The outcome of the process, drawn: the radiograph of a step wedge, a pulse
  on a scope trace, a count rising on a meter, a dose map. Prefer pictures to charts; if you use a
  chart (e.g. an energy spectrum), keep it small, single-series, and label only what the learner
  needs.
- **Part dock** under the figure: one chip per part, scrolling sideways if needed. This is the
  keyboard and screen-reader route to every part.
- **Part cards open over the figure** on the side away from the lifted part, so they never cover
  the part or its empty slot.
- Below 900px wide (phones) the layout stacks and may scroll; that is fine. Above it, it must not.

## Interaction model

Read `references/interaction.md` for the code patterns (state machine, pull-out, freeze, 3D
inspector, "See it in action"). The rules, and why:

- **Click a part → it pulls out.** It lifts off the drawing with a shadow and slight enlargement,
  a dashed outline marks its empty slot, the card opens, and after the lift the 3D view takes
  over so the learner can drag to turn it (Move handle or Shift-drag to move it; double-click to
  square up). The empty slot matters: it shows where the part lives and what it touches.
- **Pulling a part pauses the process and freezes the effects mid-flight.** A frozen frame is a
  teaching moment ("look, the electrons were here"); letting the animation run on beneath a
  pulled part breaks the link between the part and its slot.
- **Putting it back resumes** if the process was playing. Put back with ×, the card's button,
  Esc, a click on empty space, or any process control (which seats the part first).
- **"See it in action"** seats the part, jumps to the step where it works and plays, with the
  part highlighted and its card still open. This is how a learner walks through each component
  and watches it working.
- **Reduced motion:** do not autoplay on load when the OS asks for reduced motion, but when the
  learner presses Play or picks a step, animate normally. (The first X-ray build froze completely
  under the OS setting, and the user reported "the animations don't move on desktop".)
- **Hover** shows the part name; the cursor shows grab/grabbing; keyboard: Tab to chips, Enter
  to pull, arrows turn (Shift+arrows move), Esc puts back.

## DOM contract

The check scripts and the interaction code rely on these names; keep them.

| Element | Meaning |
|---|---|
| `.stage` | Figure wrapper; gets `data-lifted`, `data-3d`, `data-dragging`, `data-focus` |
| `.part[data-part="id"]` | Every drawn group of a part (a part may have several groups) |
| `.fx` | Effect layers (particles, glows, beams) that animate and freeze |
| `button[data-pick="id"]` | Part chips in the dock |
| `button[data-step="n"]`, `#play`, `#back`, `#next` | Process controls; `#play` reads "Pause" while playing |
| `.view3d` | The 3D inspector canvas |
| `.pop`, `[data-act="back" / "watch" / "reset"]` | Part card and its actions |

## Writing the words

- Plain, concrete sentences a first-year student would follow. Name things by what learners
  recognise (the "focusing cup", not "Wehnelt-type electrode") and introduce the term of art
  once, in passing.
- Each step caption answers: what is happening now, and why it matters for the result.
- Use "about" or "≈" for typical values that vary by model, and give ranges where real devices
  vary ("3–6 A"). Never invent a precise figure to fill a slot.
- Say what is simplified, once, in a quiet caption: cut-away halves, slowed motion, exaggerated
  sizes of tiny parts.

## Look

Follow the Anatomy craft (monochrome inks, one accent for the thing to watch, crafted solids with
small real details), with colour only where colour carries meaning: heat (orange), radiation
(one violet/blue), particles (one cyan). Design both light and dark themes. Fonts: a technical
pairing (the reference uses IBM Plex Sans / Condensed / Mono). Keep the figure nearly free of
words: names appear on hover and in cards, not as labels in the drawing.

## Publishing

Publish the page as an Artifact (HTML, no doctype; the template is already in that form) and keep
a standalone copy with a doctype for offline use. three.js loads from
`https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js`; the page must still work
(2D pull-out and move) if it fails to load. If the work lives in a repository, commit the build
sources (`build.mjs`, `geometry.mjs`, `content.mjs`, `facts.md`) next to the output.

## Reference files

- `references/accuracy.md`: the fact sheet, sourcing, phrasing values, and accuracy traps.
- `references/drawing.md`: Anatomy kit essentials, half-section rendering, painter's order,
  effect layers, projection maths.
- `references/interaction.md`: pull-out, freeze, ghost slot, 3D inspector, "See it in action",
  sequence engine.
- `references/verify.md`: the check scripts, screenshots, testing three.js offline, phone checks.
- `examples/xray-tube/`: the full reference build. Note that it predates the one-screen and
  few-numbers rules (it scrolls and has a readout grid); copy its drawing and interaction code,
  not its page layout.
