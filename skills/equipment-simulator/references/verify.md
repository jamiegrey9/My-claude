# Verify

Chromium and Playwright are needed (`require("playwright")`). Run both scripts and look at the
screenshots before publishing. Fix and re-run until both pass.

## The two checks

```bash
node scripts/check_one_screen.cjs page.html --three three.min.js --shots shots/
node scripts/check_flow.cjs page.html --three three.min.js --part anode --shots shots/
```

`check_one_screen` loads the page at 1280×720, 1366×768, 1440×900, 1536×864 and 1920×1080 in
light and dark, and fails if the page scrolls or the figure, step buttons, Play or the "now"
caption are off screen. It also reports what share of the screen the figure takes (aim for
about half or more).

`check_flow` follows the learner: Play animates (and still animates under reduced motion once
the learner presses Play); pulling a part while playing lifts it, pauses and freezes the effects;
the 3D inspector appears and a drag turns it; Esc puts it back and playback resumes; no page
errors. Both scripts accept artifact bodies without a doctype.

## three.js without network

Sandboxes often block the CDN. Fetch the same version from npm and let the scripts serve it in
place of the CDN request:

```bash
mkdir -p /tmp/three && cd /tmp/three && npm pack three@0.128.0 --silent && tar xzf three-0.128.0.tgz
# then pass --three /tmp/three/package/build/three.min.js
```

In your own Playwright scripts: `page.route(/three(\.min)?\.js/, r => r.fulfill({ body, contentType: "application/javascript" }))`.
Abort font requests if they hang: `page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort())`.

## Look, do not just count

Read every screenshot. In particular:
- the figure at 2× around the working parts: section faces, painter's order, effects in the
  right place;
- each process step (click `[data-step=n]`, wait about 2 s, screenshot);
- a pulled part beside its ghost slot, and the same part turned in 3D;
- light and dark;
- phone (Playwright `devices["iPhone 13"]`): stacked layout, card under the figure, touch drag
  via CDP `Input.dispatchTouchEvent`.

Random simulations (counting, decays) vary between frames; `check_flow` sums motion over six
snapshots, so it is stable for them. If a part chip cannot be clicked in a zoomed step, the drawing
is spilling over the dock: the SVG must clip.

Clicking animated SVG parts in Playwright needs `{ force: true }`, because the paths keep
changing. If a chip click scrolls the page, scroll the stage back into view before taking
coordinates.
