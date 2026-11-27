// Usage: node check_flow.cjs <page.html> [--three <three.min.js>] [--part <id>] [--shots <dir>]
// Exercises the learner flow on the DOM contract in SKILL.md ("DOM contract"):
//  1. the process plays and things move, with and without prefers-reduced-motion (user pressed Play);
//  2. pulling a part out while playing pauses the sequence and freezes the effects;
//  3. with --three, the 3D inspector appears and a drag turns the part;
//  4. Escape puts the part back and the sequence resumes.
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const os = require("os");

const args = process.argv.slice(2);
const file = path.resolve(args[0]);
const opt = (n) => { const i = args.indexOf(n); return i > -1 ? args[i + 1] : null; };
const threePath = opt("--three"), shots = opt("--shots");
let part = opt("--part");

function wrap(src) {
  const html = fs.readFileSync(src, "utf8");
  if (/^\s*<!doctype/i.test(html)) return src;
  const out = path.join(os.tmpdir(), "flow-" + path.basename(src));
  fs.writeFileSync(out, `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body>${html}</body></html>`);
  return out;
}
const snap = (p) => p.evaluate(() => [...document.querySelectorAll(".fx *")].slice(0, 400).map((e) => ["cx", "cy", "x1", "y1", "d", "opacity", "transform"].map((a) => e.getAttribute(a) || "").join(",")).concat(document.querySelector(".stage")?.getAttribute("style") || ""));
const moved = (a, b) => a.reduce((n, v, i) => n + (v !== b[i] ? 1 : 0), 0);
const state = (p) => p.evaluate(() => ({ play: document.querySelector("#play")?.textContent.trim(), lifted: document.querySelector(".stage")?.hasAttribute("data-lifted"), three: !!document.querySelector(".view3d:not([hidden])") }));

(async () => {
  const page0 = wrap(file);
  const browser = await chromium.launch();
  const results = [];
  const check = (name, ok, detail = "") => { results.push(ok); console.log(`${ok ? "pass" : "FAIL"} ${name}${detail ? " — " + detail : ""}`); };
  let normalMoves = 0;
  for (const motion of ["no-preference", "reduce"]) {
    const p = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: motion });
    if (threePath) await p.route(/three(\.min)?\.js/, (r) => r.fulfill({ body: fs.readFileSync(threePath), contentType: "application/javascript" }));
    await p.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
    const errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto("file://" + page0);
    await p.waitForTimeout(500);
    const steps = await p.$$("[data-step]");
    if (steps.length > 2) await steps[Math.floor(steps.length / 2)].click({ force: true });
    await p.click("#play", { force: true });
    await p.waitForTimeout(900);
    const a = await snap(p); await p.waitForTimeout(600); const b = await snap(p);
    const n = moved(a, b);
    if (motion === "no-preference"){ normalMoves = n; check("animates after Play", n > 0, n + " moving elements"); }
    else check("animates after Play with reduced motion on", n >= normalMoves * 0.6 && n > 0, n + " moving elements vs " + normalMoves + " normally");
    if (motion === "reduce") { check("no page errors", !errors.length, errors.join(" | ")); await p.close(); continue; }

    if (!part) part = await p.evaluate(() => document.querySelector("[data-pick]")?.dataset.pick || document.querySelector(".part[data-part]")?.dataset.part);
    await p.click(`[data-pick="${part}"]`, { force: true }).catch(async () => {
      const box = await p.evaluate((id) => { const r = document.querySelector(`.part[data-part="${id}"]`).getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }, part);
      await p.mouse.click(box[0], box[1]);
    });
    await p.evaluate(() => document.querySelector(".stage")?.scrollIntoView({ block: "center" }));
    await p.waitForTimeout(threePath ? 1800 : 900);
    const s1 = await state(p);
    const f1 = await snap(p); await p.waitForTimeout(600); const f2 = await snap(p);
    check(`pulling "${part}" lifts it`, s1.lifted);
    check("sequence pauses while it is out", s1.play !== "Pause", `play button reads "${s1.play}"`);
    check("effects freeze while it is out", moved(f1, f2) === 0, moved(f1, f2) + " elements still moving");
    if (shots) { fs.mkdirSync(shots, { recursive: true }); await p.screenshot({ path: path.join(shots, "flow-pulled.png") }); }
    if (threePath) {
      check("3D inspector appears", s1.three);
      if (s1.three) {
        const c = await p.evaluate(() => { const r = document.querySelector(".view3d").getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; });
        const clip = { x: Math.max(0, c[0]), y: Math.max(0, c[1]), width: Math.min(c[2], 1440 - Math.max(0, c[0])), height: Math.min(c[3], 900 - Math.max(0, c[1])) };
        const before = await p.screenshot({ clip });
        await p.mouse.move(c[0] + c[2] / 2, c[1] + c[3] / 2); await p.mouse.down();
        await p.mouse.move(c[0] + c[2] / 2 + 80, c[1] + c[3] / 2 + 30, { steps: 10 }); await p.mouse.up();
        await p.waitForTimeout(250);
        const after = await p.screenshot({ clip });
        check("dragging turns the part", !before.equals(after));
        if (shots) await p.screenshot({ path: path.join(shots, "flow-turned.png") });
      }
    }
    await p.keyboard.press("Escape");
    await p.waitForTimeout(1500);
    const s2 = await state(p);
    const r1 = await snap(p); await p.waitForTimeout(600); const r2 = await snap(p);
    check("Escape puts it back", !s2.lifted);
    check("sequence resumes after put back", s2.play === "Pause" && moved(r1, r2) > 0, `play button reads "${s2.play}"`);
    check("no page errors", !errors.length, errors.join(" | "));
    await p.close();
  }
  await browser.close();
  const bad = results.filter((x) => !x).length;
  console.log(bad ? `flow check: ${bad} failing` : "flow check passed");
  process.exit(bad ? 1 : 0);
})();
