import { writeFileSync } from "node:fs";
import * as k from "./kit/iso-kit.mjs";
import * as G from "./kit/lathe.mjs";
import { build, extras, models, P, WIDTH, HEIGHT } from "./geometry.mjs";
import { PARTS, STEPS_TEXT } from "./content.mjs";
import { pageHtml, standalone } from "../skills/equipment-simulator/assets/engine/page.mjs";

const X = extras();
const ACTS = { meter: 6, display: 6, keypad: 0, speaker: 6, cable: 6, spill: 1, vial: 1, tray: 1, window: 2, lead: 0, crystal: 3, "optical-window": 4, photocathode: 4, pmt: 5, dynodes: 5, "magnetic-shield": 5, divider: 5, housing: 2 };

const defs = `<defs><radialGradient id="g-flash"><stop offset="0" stop-color="#ffffff"/><stop offset=".3" stop-color="#9fd0ff"/><stop offset="1" stop-color="#4a90ff" stop-opacity="0"/></radialGradient><radialGradient id="g-anode"><stop offset="0" stop-color="#e6fbff"/><stop offset="1" stop-color="#6fd3ef" stop-opacity="0"/></radialGradient></defs>`;
const svg = build().replace(/(<svg[^>]*>)/, `$1${defs}`);

const CSS = `
:root{--lcd:#a9bea2;--lcd-ink:#1b261b;--wet:#5d7fb8}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--lcd:#93b48c;--lcd-ink:#101a10;--wet:#7d9fd8}}
:root[data-theme="dark"]{--lcd:#93b48c;--lcd-ink:#101a10;--wet:#7d9fd8}
.lcd{fill:var(--lcd);stroke:none}
.lcd-ink text{fill:var(--lcd-ink)!important;font-weight:600}
.lcd-ink [data-seg]{fill:var(--lcd-ink);opacity:.1}
.lcd-ink [data-seg][data-on]{opacity:.9}
.spill{fill:var(--wet);opacity:calc(var(--spill,0)*.32)}
.spill-edge{opacity:calc(var(--spill,0)*.8)}
.dyn{fill:var(--anatomy-face)}
.glassy .iso-fill,.glassy .iso-shade,.glassy .iso-top{fill-opacity:.32}
.pc .iso-top,.pc .iso-shade{fill:#b98d5f;fill-opacity:.55}
.cs.cut-mu{fill:var(--anatomy-shade-2)}
.cf.pcb{fill:#5e8f68;stroke:#5e8f68}
.cf.res{fill:#c9a77a;stroke:#c9a77a}
.cf.cap{fill:#3c5d8f;stroke:#3c5d8f}
.fx-gamma line{stroke:var(--accent);stroke-width:1.2;stroke-linecap:round;vector-effect:non-scaling-stroke}
.fx-in .flash{fill:url(#g-flash)}
.fx-in .lt{fill:var(--light)}
.fx-in .el{fill:var(--e)}
.fx-in .anode-glow{fill:url(#g-anode)}
.fx-in .glint{fill:none;stroke:var(--accent);stroke-width:1;vector-effect:non-scaling-stroke}
.fx-cable circle{fill:var(--accent);stroke:var(--surface);stroke-width:.6;vector-effect:non-scaling-stroke}
.fx-meter circle{fill:none;stroke:var(--accent);stroke-width:1.2;vector-effect:non-scaling-stroke}
.stage[data-focus-part="crystal"] .part[data-part="crystal"] .iso-edge{stroke:var(--accent)}
.scope{width:100%;height:auto;display:block;max-height:170px;background:var(--bg);border-radius:4px}
.scope .base{stroke:var(--rule);stroke-width:1}
.scope .thr{stroke:var(--heat);stroke-width:1;stroke-dasharray:4 3}
.scope .trace{fill:none;stroke:var(--ink-2);stroke-width:1.4;stroke-linejoin:round}
.scope text{font:10px var(--font-mono);fill:var(--muted)}
.scope .hit{fill:var(--accent)}
.legend-row{display:flex;gap:12px;font:11px/1.3 var(--font-mono);color:var(--ink-2);margin-top:6px;flex-wrap:wrap}
.legend-row i{display:inline-block;width:12px;height:0;border-top:2px dashed var(--heat);vertical-align:middle;margin-right:5px}
.legend-row b{display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--accent);vertical-align:middle;margin-right:5px}
`;

const controls = `
<div class="ctl"><span class="lab">Source</span><div class="seg" role="group" aria-label="Nuclide spilt"><button type="button" data-nuc="I125" aria-pressed="true">I-125</button><button type="button" data-nuc="Tc99m" aria-pressed="false">Tc-99m</button></div></div>
<div class="ctl"><label for="h">Height</label><input id="h" type="range" min="5" max="50" step="5" value="10"><output data-out="h">10 mm</output></div>
<div class="ctl"><span class="lab">Clicks</span><div class="seg" role="group" aria-label="Speaker sound"><button type="button" data-snd="off" aria-pressed="true">Silent</button><button type="button" data-snd="on" aria-pressed="false">Sound on</button></div></div>
<p class="note" data-note></p>`;

const result = `
<svg class="scope" viewBox="0 0 320 150" role="img" aria-label="Pulse trace: pulses from the probe, with the discriminator threshold"><line class="base" x1="8" x2="312" y1="126" y2="126"/><line class="thr" x1="8" x2="312" y1="116" y2="116"/><path class="trace" d=""/><g class="hits"></g><text x="312" y="144" text-anchor="end">time →</text><text x="8" y="12">pulse height (energy) ↑</text></svg>
<div class="legend-row"><span><i></i>threshold</span><span><b></b>counted pulse</span></div>
<p class="caption-quiet" data-scope-note>Each detected photon makes one pulse. Its height follows the energy it left in the crystal. Pulses above the threshold are counted; smaller noise is ignored.</p>`;

const SCRIPT = `
const { X, STEPS } = DATA;
const $ = (s) => document.querySelector(s), $$ = (s) => [...document.querySelectorAll(s)];
const NS = "http://www.w3.org/2000/svg";
const svg = $(".stage svg"), cam = $(".cam");
const proj = (p) => [X.O[0] + p[0] * X.ex[0] + p[1] * X.ey[0] + p[2] * X.ez[0], X.O[1] + p[0] * X.ex[1] + p[1] * X.ey[1] + p[2] * X.ez[1]];
const mk = (tag, parent, attrs = {}) => { const el = document.createElementNS(NS, tag); for (const [a, v] of Object.entries(attrs)) el.setAttribute(a, v); parent.appendChild(el); return el; };
const F = X.PF, S = X.S;
const tech = { nuc: "I125", h: X.H0, sound: false };
const NUC = { I125: { E: 30, sens: 3.8, name: "I-125", pass: 0, light: 1100 }, Tc99m: { E: 140, sens: 1.6, name: "Tc-99m", pass: .3, light: 5300 } };
const BG = 6, ACT = 30;
const omega = (h) => 2 * Math.PI * (1 - h / Math.hypot(h, 16));
const rateOf = (spill) => BG + spill * NUC[tech.nuc].sens * ACT * omega(tech.h) / omega(10);
const dz = () => tech.h - X.H0;
const inPlane = (u, s, v = 0) => [0, 1, 2].map((i) => F.o[i] + F.a[i] * s + F.u[i] * u + F.v[i] * v + (i === 2 ? dz() : 0));

/* probe height */
const movers = $$('[data-move="probe"]');
function placeProbe(){
  const d = dz(), t = "translate(" + (X.ez[0] * d).toFixed(2) + " " + (X.ez[1] * d).toFixed(2) + ")";
  movers.forEach((g) => g.setAttribute("transform", t));
  $$('[data-part="cable"] [data-h]').forEach((g) => g.style.display = +g.dataset.h === tech.h ? "" : "none");
}

/* effect pools */
const gG = $(".fx-gamma"), gIn = $(".fx-in"), gCab = $(".fx-cable"), gMet = $(".fx-meter");
const pool = (n, make) => { const items = Array.from({ length: n }, make); let i = 0; return { items, take(){ for (let j = 0; j < items.length; j++){ const it = items[(i + j) % items.length]; if (!it.busy){ i = (i + j + 1) % items.length; it.busy = true; return it; } } return null; }, hideFree(){ items.forEach((it) => { if (!it.busy) it.el.setAttribute("opacity", 0); }); } }; };
const lines = pool(40, () => ({ el: mk("line", gG, { opacity: 0 }) }));
const flashes = pool(6, () => ({ el: mk("circle", gIn, { class: "flash", opacity: 0 }) }));
const glints = pool(6, () => ({ el: mk("circle", gIn, { class: "glint", opacity: 0 }) }));
const dots = pool(160, () => ({ el: mk("circle", gIn, { opacity: 0 }) }));
const anodeGlow = mk("circle", gIn, { class: "anode-glow", opacity: 0, r: 4 });
const pulses = pool(8, () => ({ el: mk("circle", gCab, { r: 1.8, opacity: 0 }) }));
const rings = pool(6, () => ({ el: mk("circle", gMet, { opacity: 0 }) }));

/* events */
const events = [];
const rnd = (a, b) => a + Math.random() * (b - a);
function spillPoint(){ const b = X.BLOTS[Math.random() < .6 ? 0 : Math.floor(Math.random() * X.BLOTS.length)]; const a = Math.random() * 6.283, r = Math.sqrt(Math.random()); return [b[0] + Math.cos(a) * b[2] * r * .9, b[1] + Math.sin(a) * b[3] * r * .9, X.PAPER_Z + .1]; }
function spawnDetected(fromSpill){
  const nuc = NUC[tech.nuc];
  const uT = rnd(-14, 14);
  const win = inPlane(uT, 0);
  const origin = fromSpill ? spillPoint() : [win[0] + rnd(-60, 60), win[1] + rnd(-30, 30), win[2] - rnd(20, 50)];
  const E = fromSpill ? nuc.E : rnd(25, 150);
  const passes = fromSpill && Math.random() < nuc.pass;
  const depthS = fromSpill && tech.nuc === "I125" ? rnd(.8, 1.3) : rnd(.9, 3.0);
  events.push({ kind: "det", t: 0, origin, uT, E, passes, depthS, hitU: uT * .9 + rnd(-1, 1), pcU: Array.from({ length: 10 }, () => rnd(-11.5, 11.5)), nPe: fromSpill ? (tech.nuc === "I125" ? 3 : 6) : 4, items: [] });
}
function spawnStray(){
  const o = spillPoint();
  let d; do { d = [rnd(-1, 1), rnd(-1, 1), rnd(0.15, 1)]; } while (Math.hypot(...d) > 1.2);
  const n = Math.hypot(...d); d = d.map((c) => c / n);
  events.push({ kind: "stray", t: 0, origin: o, d, len: rnd(40, 90), items: [] });
}
const lerp3 = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const setLine = (el, a, b, op) => { const p = proj(a), q = proj(b); el.setAttribute("x1", p[0].toFixed(2)); el.setAttribute("y1", p[1].toFixed(2)); el.setAttribute("x2", q[0].toFixed(2)); el.setAttribute("y2", q[1].toFixed(2)); el.setAttribute("opacity", op); };
const setDot = (el, p, r, cls, op) => { const q = proj(p); el.setAttribute("cx", q[0].toFixed(2)); el.setAttribute("cy", q[1].toFixed(2)); el.setAttribute("r", r); el.setAttribute("class", cls); el.setAttribute("opacity", op); };
const GAMMA_V = 70, TAIL = 5;
const T_FLASH = .45, T_LIGHT = .55, T_STAGE = .16, T_CABLE = 1.1;
function release(items){ items.forEach((it) => { it.busy = false; it.el.setAttribute("opacity", 0); }); items.length = 0; }
function grab(p, list){ const it = p.take(); if (it) list.push(it); return it; }

function drawDetected(e){
  release(e.items);
  const win = inPlane(e.uT, 0), hit = inPlane(e.hitU, e.depthS);
  const d1 = Math.hypot(...win.map((v, i) => v - e.origin[i]));
  const tGamma = d1 / GAMMA_V;
  let t = e.t;
  if (t < tGamma + .08){
    const s = Math.min(1, t / tGamma), a = lerp3(e.origin, win, Math.max(0, s - TAIL / d1));
    const head = t < tGamma ? lerp3(e.origin, win, s) : lerp3(win, hit, Math.min(1, (t - tGamma) / .08));
    const l = grab(lines, e.items); if (l) setLine(l.el, a, head, .95);
    if (t > tGamma - .05){ const g = grab(glints, e.items); if (g) setDot(g.el, win, (1 + (t - tGamma + .05) * 30).toFixed(2), "glint", Math.max(0, .9 - (t - tGamma) * 6)); }
    return true;
  }
  t -= tGamma + .08;
  if (e.passes){
    if (t < .6){ const a = lerp3(hit, inPlane(e.hitU * 1.1, 40), t / .6); const l = grab(lines, e.items); if (l) setLine(l.el, lerp3(hit, inPlane(e.hitU * 1.1, 40), Math.max(0, t / .6 - .12)), a, .6 * (1 - t / .6)); return true; }
    return false;
  }
  if (t < T_FLASH){ const f = grab(flashes, e.items); if (f) setDot(f.el, hit, (2 + t / T_FLASH * 7 * Math.sqrt(e.E / 30)).toFixed(2), "flash", (1 - t / T_FLASH).toFixed(2)); }
  if (t < T_LIGHT){
    const u = t / T_LIGHT;
    e.pcU.forEach((pu, i) => { const target = inPlane(pu, S.pc - .1); const p = lerp3(hit, target, Math.min(1, u * (0.9 + i * .03))); const d = grab(dots, e.items); if (d) setDot(d.el, p, .45, "lt", u < .95 ? .95 : 0); });
    return true;
  }
  t -= T_LIGHT;
  const dyn = X.DYNODES;
  const nodes = [[0, S.pc + .4], ...dyn.map((d) => d.face), [0, S.anode - .2]];
  const stages = nodes.length - 1;
  if (t < stages * T_STAGE){
    const j = Math.floor(t / T_STAGE), fr = (t - j * T_STAGE) / T_STAGE;
    const m = Math.min(18, Math.round(e.nPe * Math.pow(1.55, j)));
    for (let q = 0; q < m; q++){
      const jit = ((q * 7919) % 100) / 100 - .5, jit2 = ((q * 104729) % 100) / 100 - .5;
      const a = nodes[j], b = nodes[j + 1];
      const p = inPlane(a[0] + (b[0] - a[0]) * fr + jit * 2.4, a[1] + (b[1] - a[1]) * fr + jit2 * 1.2);
      const d = grab(dots, e.items); if (d) setDot(d.el, p, .42, "el", .95);
    }
    return true;
  }
  t -= stages * T_STAGE;
  if (!e.scoped){ e.scoped = true; scopeAdd(e.E); }
  if (t < .25){ const q = proj(inPlane(0, S.anode)); anodeGlow.setAttribute("cx", q[0]); anodeGlow.setAttribute("cy", q[1]); anodeGlow.setAttribute("opacity", (1 - t / .25).toFixed(2)); }
  if (t < T_CABLE){
    const path = X.cablePaths[tech.h], idx = Math.min(path.length - 1, Math.floor(t / T_CABLE * path.length));
    const pt = path[idx]; const pl = grab(pulses, e.items); if (pl){ pl.el.setAttribute("cx", pt[0]); pl.el.setAttribute("cy", pt[1]); pl.el.setAttribute("opacity", 1); }
    return true;
  }
  if (!e.rung){ e.rung = true; ring(); }
  return false;
}
function drawStray(e){
  release(e.items);
  const s = e.t * GAMMA_V;
  if (s > e.len + TAIL) return false;
  const a = e.origin.map((v, i) => v + e.d[i] * Math.max(0, s - TAIL)), b = e.origin.map((v, i) => v + e.d[i] * Math.min(s, e.len));
  const l = grab(lines, e.items); if (l) setLine(l.el, a, b, (.7 * (1 - s / (e.len + TAIL))).toFixed(2));
  return true;
}
let ringOn = [];
function ring(){ const r = rings.take(); if (!r) return; r.age = 0; ringOn.push(r); click(); }

/* sound */
let actx = null;
function click(){
  if (!tech.sound) return;
  try {
    actx ||= new (window.AudioContext || window.webkitAudioContext)();
    const n = actx.createBufferSource(), buf = actx.createBuffer(1, 220, actx.sampleRate), ch = buf.getChannelData(0);
    for (let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1) * Math.exp(-i / 30);
    n.buffer = buf; const g = actx.createGain(); g.gain.value = .35; n.connect(g).connect(actx.destination); n.start();
  } catch (err) {}
}

/* scope */
const scopeTrace = $(".scope .trace"), scopeHits = $(".scope .hits");
let scopePulses = [], scopeClock = 0;
const SC = { x0: 8, x1: 312, base: 126, top: 22, thr: 116, speed: 42 };
const eToPx = (E) => (E / 160) * (SC.base - SC.top);
function scopeAdd(E){ scopePulses.push({ t: scopeClock, h: eToPx(E) * rnd(.85, 1.1) }); }
function drawScope(dt){
  scopeClock += dt;
  scopePulses = scopePulses.filter((p) => (scopeClock - p.t) * SC.speed < SC.x1 - SC.x0 + 20);
  const pts = [];
  for (let x = SC.x1; x >= SC.x0; x -= 1.5){
    const tt = scopeClock - (SC.x1 - x) / SC.speed;
    let y = Math.sin(tt * 37) * .9 + Math.sin(tt * 91 + 1) * .6 + Math.sin(tt * 17 + 2) * .5;
    for (const p of scopePulses){ const age = tt - p.t; if (age >= 0) y += p.h * (1 - Math.exp(-age / .015)) * Math.exp(-age / .09); }
    pts.push(x.toFixed(1) + " " + (SC.base - y).toFixed(1));
  }
  scopeTrace.setAttribute("d", "M" + pts.join("L"));
  scopeHits.innerHTML = scopePulses.filter((p) => p.h > SC.base - SC.thr).map((p) => { const x = SC.x1 - (scopeClock - p.t - .04) * SC.speed; return x > SC.x0 ? '<circle class="hit" cx="' + x.toFixed(1) + '" cy="' + (SC.base - p.h - 6).toFixed(1) + '" r="2.4"/>' : ""; }).join("");
}

/* meter */
const lcdRate = $('[data-lcd="rate"]'), segs = $$("[data-seg]");
let shown = BG, acc = 0, accT = 0, realClock = 0;
function poisson(mu){ if (mu > 30) return Math.max(0, Math.round(mu + Math.sqrt(mu) * (Math.random() + Math.random() + Math.random() - 1.5) * 1.41)); let L = Math.exp(-mu), k = 0, p = 1; do { k++; p *= Math.random(); } while (p > L); return k - 1; }
function meter(dt, spill){
  const r = rateOf(spill);
  const n = poisson(r * dt);
  acc += n; accT += dt;
  if (accT >= .25){ const inst = acc / accT; shown += (inst - shown) * (1 - Math.exp(-accT / 1.6)); acc = 0; accT = 0; }
  const txt = String(Math.round(shown));
  if (lcdRate.textContent !== txt) lcdRate.textContent = txt;
  const lit = Math.max(0, Math.min(segs.length, Math.round(Math.log10(Math.max(1, shown)) / 3 * segs.length)));
  segs.forEach((s, i) => s.toggleAttribute("data-on", i < lit));
  if (tech.sound && n > 0){ for (let i = 0; i < Math.min(n, 2); i++) click(); }
}

/* zoom */
const ZOOM = [{ k: 1, s: 40 }, { k: 1, s: 40 }, { k: 3.4, s: 1 }, { k: 3.8, s: 3 }, { k: 3.6, s: 8 }, { k: 2.1, s: 50 }, { k: 1, s: 40 }];
function camera(cur){
  const zk = cur.zk, t = Math.min(1, Math.max(0, (zk - 1) / 1.2));
  if (zk < 1.002){ cam.removeAttribute("transform"); return; }
  const f = proj(inPlane(0, cur.fs));
  const W = DATA.W, H = DATA.H;
  const cx = W / 2 + (f[0] - W / 2) * t, cy = H / 2 + (f[1] - H / 2) * t;
  cam.setAttribute("transform", "translate(" + (W / 2).toFixed(2) + " " + (H / 2).toFixed(2) + ") scale(" + zk.toFixed(4) + ") translate(" + (-cx).toFixed(2) + " " + (-cy).toFixed(2) + ")");
}

/* captions */
function caption(i){
  const nuc = NUC[tech.nuc];
  if (i === 1) return tech.nuc === "I125" ? STEPS[1].body : "A drop of Tc-99m solution is spilt on the tray. It gives off 140 keV gamma photons in every direction. Only those heading up into the probe window can be counted.";
  if (i === 3) return "The photon is absorbed in the thin sodium-iodide crystal and its energy becomes a flash of blue light, about " + nuc.light.toLocaleString("en-GB") + " light photons for a " + nuc.E + " keV photon. " + (tech.nuc === "I125" ? "Nearly every I-125 photon stops in the 2.5 mm crystal." : "Some of these higher-energy photons pass straight through the thin crystal without a flash, and are not counted.");
  if (i === 6) return "Each pulse runs down the cable to the meter. The discriminator ignores small noise pulses, counts the rest and clicks the speaker. With the probe " + tech.h + " mm above this spill the meter reads about " + Math.round(rateOf(1)) + " cps, against a background of about 6 cps." + (tech.h > 15 ? " Bring the probe closer to see the reading rise." : " Raise the probe and the reading falls quickly.");
  return STEPS[i].body;
}

/* controls */
const hIn = $("#h"), note = $("[data-note]");
function readTech(){
  tech.h = +hIn.value;
  $('[data-out="h"]').textContent = tech.h + " mm";
  note.textContent = tech.nuc === "I125" ? "I-125 photons (27–35 keV) are what this thin-crystal probe is built for." : "Tc-99m's 140 keV photons give bigger pulses, but more of them pass through the thin crystal.";
  placeProbe();
  if (window.sim){ sim.refresh(); }
}
hIn.addEventListener("input", readTech);
$$("[data-nuc]").forEach((b) => b.addEventListener("click", () => { tech.nuc = b.dataset.nuc; $$("[data-nuc]").forEach((x) => x.setAttribute("aria-pressed", String(x === b))); readTech(); }));
$$("[data-snd]").forEach((b) => b.addEventListener("click", () => { tech.sound = b.dataset.snd === "on"; $$("[data-snd]").forEach((x) => x.setAttribute("aria-pressed", String(x === b))); if (tech.sound) click(); }));
readTech();

/* frame */
const PACE = [{ det: .7, stray: 0, bg: 1 }, { det: 1.4, stray: 7, bg: 0 }, { det: .8, stray: 1.5, bg: 0 }, { det: .7, stray: 1, bg: 0 }, { det: .7, stray: 1, bg: 0 }, { det: .6, stray: 1, bg: 0 }, { det: 2.2, stray: 3, bg: .2 }];
let detClock = 0, strayClock = 0;
function onFrame(dt, calm, api){
  const cur = api.cur, step = api.step;
  camera(cur);
  meter(dt, cur.spill);
  drawScope(calm ? 0 : dt);
  if (!calm){
    const pace = PACE[step];
    const spillOn = cur.spill > .5;
    detClock += dt * pace.det * (spillOn ? Math.min(1.6, rateOf(1) / 120 + .3) : 1);
    strayClock += dt * pace.stray * cur.spill;
    while (detClock >= 1 && events.filter((e) => e.kind === "det").length < 4){ detClock -= 1; spawnDetected(spillOn && Math.random() > (pace.bg || 0)); }
    if (detClock > 1) detClock = 1;
    while (strayClock >= 1){ strayClock -= 1; spawnStray(); }
  }
  for (let i = events.length - 1; i >= 0; i--){
    const e = events[i];
    e.t += dt;
    const alive = e.kind === "det" ? drawDetected(e) : drawStray(e);
    if (!alive){ release(e.items); events.splice(i, 1); }
  }
  ringOn = ringOn.filter((r) => { r.age += dt; if (r.age > .5){ r.busy = false; r.el.setAttribute("opacity", 0); return false; } r.el.setAttribute("cx", X.speaker[0]); r.el.setAttribute("cy", X.speaker[1]); r.el.setAttribute("r", (2 + r.age * 16).toFixed(2)); r.el.setAttribute("opacity", (1 - r.age / .5).toFixed(2)); return true; });
}

const sim = window.sim = SimEngine({
  data: DATA,
  channels: { spill: 0, zk: 1, fs: 40 },
  targets: [0, 1, 1, 1, 1, 1, 1].map((sp, i) => ({ spill: sp, zk: ZOOM[i].k, fs: ZOOM[i].s })),
  taus: { spill: .6, zk: .7, fs: .7 },
  stepSeconds: 6.5,
  holdLast: 3,
  caption,
  offset: (id) => (PARTS_MOVE.has(id) ? [0, 0, dz()] : null),
  onFrame,
  readout: (api) => STEPS[api.step].title.toLowerCase() + " · " + NUC[tech.nuc].name,
  busy: () => true,
});
`;

const PROBE_PARTS = ["housing", "lead", "magnetic-shield", "pmt", "divider", "window", "crystal", "optical-window", "photocathode", "dynodes"];
const html = pageHtml({
  title: "Scintillation Contamination Monitor",
  eyebrow: "Radiation protection · contamination monitoring",
  lede: "A ratemeter with a thin-crystal NaI(Tl) probe, held over a spill. Press Play to follow one photon from the spill to a click, or click any part to pull it out and turn it in 3D.",
  figLabel: "NaI(Tl) probe · half section",
  svg,
  parts: PARTS,
  steps: STEPS_TEXT,
  controls,
  controlsTitle: "Survey",
  controlsNote: "what you can change",
  result,
  resultTitle: "Pulses",
  resultNote: "what the meter receives",
  css: CSS,
  kitCss: k.ISO_CSS,
  data: { X, PARTS, STEPS: STEPS_TEXT, ACTS, W: WIDTH, H: HEIGHT, MODELS: models(), K: G.scaleOf(P), VIEW: G.viewOf(P), processName: "Detection" },
  script: `const PARTS_MOVE = new Set(${JSON.stringify(PROBE_PARTS)});\n` + SCRIPT,
});
writeFileSync("scint-monitor.html", html);
writeFileSync("scint-monitor-standalone.html", standalone(html));
console.log("wrote scint-monitor.html", (html.length / 1024).toFixed(0) + " KB");
