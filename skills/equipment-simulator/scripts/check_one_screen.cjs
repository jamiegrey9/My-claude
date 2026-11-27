// Usage: node check_one_screen.cjs <page.html> [--three <three.min.js>] [--shots <dir>]
// Loads the page at common desktop/laptop sizes and fails if the page scrolls, or if the figure,
// the process stepper, the Play button or the "now" caption fall outside the screen.
// Works on artifact bodies with no <!doctype> (it wraps them in a temp file first).
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const os = require("os");

const args = process.argv.slice(2);
const file = path.resolve(args[0]);
const opt = (name) => { const i = args.indexOf(name); return i > -1 ? args[i + 1] : null; };
const threePath = opt("--three");
const shots = opt("--shots");
const SIZES = [[1280, 720], [1366, 768], [1440, 900], [1536, 864], [1920, 1080]];
const MUST_SEE = [".stage svg", "ol.steps", "#play", ".now, [data-st-title]"];

function wrap(src) {
  const html = fs.readFileSync(src, "utf8");
  if (/^\s*<!doctype/i.test(html)) return src;
  const out = path.join(os.tmpdir(), "oneshot-" + path.basename(src));
  fs.writeFileSync(out, `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"></head><body>${html}</body></html>`);
  return out;
}

(async () => {
  const page0 = wrap(file);
  const browser = await chromium.launch();
  let failed = 0;
  for (const [w, h] of SIZES) {
    for (const scheme of ["light", "dark"]) {
      const p = await browser.newPage({ viewport: { width: w, height: h }, colorScheme: scheme });
      if (threePath) await p.route(/three(\.min)?\.js/, (r) => r.fulfill({ body: fs.readFileSync(threePath), contentType: "application/javascript" }));
      await p.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
      const errors = [];
      p.on("pageerror", (e) => errors.push(e.message));
      await p.goto("file://" + page0);
      await p.waitForTimeout(600);
      const r = await p.evaluate((must) => {
        const d = document.documentElement;
        const vis = must.map((sel) => {
          const el = document.querySelector(sel);
          if (!el) return [sel, "missing"];
          const b = el.getBoundingClientRect();
          const inside = b.top >= -1 && b.left >= -1 && b.bottom <= innerHeight + 1 && b.right <= innerWidth + 1 && b.width > 0 && b.height > 0;
          return [sel, inside ? "ok" : `off-screen (${Math.round(b.top)}..${Math.round(b.bottom)} of ${innerHeight})`];
        });
        const svg = document.querySelector(".stage svg");
        const share = svg ? (svg.getBoundingClientRect().width * svg.getBoundingClientRect().height) / (innerWidth * innerHeight) : 0;
        return { sw: d.scrollWidth, sh: d.scrollHeight, iw: innerWidth, ih: innerHeight, vis, share };
      }, MUST_SEE);
      const scroll = r.sh > r.ih + 1 || r.sw > r.iw + 1;
      const bad = r.vis.filter(([, s]) => s !== "ok");
      const ok = !scroll && !bad.length && !errors.length;
      if (!ok) failed++;
      if (scheme === "light" || !ok) {
        console.log(`${ok ? "pass" : "FAIL"} ${w}×${h} ${scheme}: page ${r.sw}×${r.sh}${scroll ? " (scrolls)" : ""}, figure ${(r.share * 100).toFixed(0)}% of screen${bad.length ? ", " + bad.map(([s, m]) => s + " " + m).join("; ") : ""}${errors.length ? ", errors: " + errors.join(" | ") : ""}`);
      }
      if (shots && scheme === "light") { fs.mkdirSync(shots, { recursive: true }); await p.screenshot({ path: path.join(shots, `screen-${w}x${h}.png`) }); }
      await p.close();
    }
  }
  await browser.close();
  console.log(failed ? `one-screen check: ${failed} failing` : "one-screen check passed");
  process.exit(failed ? 1 : 0);
})();
