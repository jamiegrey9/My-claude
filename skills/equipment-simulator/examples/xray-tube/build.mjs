import { writeFileSync } from "node:fs";
import * as k from "../../assets/kit/iso-kit.mjs";
import * as G from "../../assets/kit/lathe.mjs";
import { build, extras, models, P, WIDTH, HEIGHT } from "./geometry.mjs";
import { PARTS, STEPS_TEXT } from "./content.mjs";
import { pageHtml, standalone } from "../../assets/engine/page.mjs";

const X = extras();
const ACTS = { filament: 1, cathode: 1, rotor: 2, stator: 2, stem: 2, anode: 4, envelope: 3, "cathode-cable": 3, "anode-cable": 3, console: 3, window: 5, filter: 5, housing: 5, collimator: 5, phantom: 6, detector: 6, stand: 0 };

const defs = `<defs><radialGradient id="g-heat"><stop offset="0" stop-color="#fff3d6"/><stop offset=".25" stop-color="#ffb25e"/><stop offset=".6" stop-color="#ff7a1a" stop-opacity=".45"/><stop offset="1" stop-color="#ff5a00" stop-opacity="0"/></radialGradient></defs>`;
const fx = (n) => n.toFixed(1);
const svg = build()
  .replace(/(<svg[^>]*>)/, `$1${defs}`)
  .replace(`<g class="beam-out"></g>`, `<g class="beam-out fx"><path class="vol" d="${X.beamOut}"/><path class="edge" d="${X.beamEdges}"/></g>`)
  .replace(`<g class="beam-in"></g>`, `<g class="beam-in fx"><path class="wide" d="${X.beamWide}"/><path d="${X.beamIn}"/></g>`)
  .replace(`<g class="heat"></g>`, `<g class="fx"><path class="track-glow" d="${X.track}"/><circle class="spot-glow" cx="${fx(X.spot[0])}" cy="${fx(X.spot[1])}" r="9"/></g><g class="photons fx"></g>`)
  .replace(`<g class="electrons"></g>`, `<g class="electrons fx"></g>`)
  .replace(`<g class="cloud"></g>`, `<g class="cloud fx"></g><circle class="fil-glow fx" cx="${fx(X.filament[0])}" cy="${fx(X.filament[1])}" r="8"/>`);

const CSS = `
.cs.cut-be{fill:var(--anatomy-mid);fill-opacity:.5}
.cs.cut-filter{fill:var(--anatomy-hi);fill-opacity:.35}
.mirror{fill:var(--anatomy-mid);fill-opacity:.22}
.det-glow{fill:var(--accent);opacity:calc(var(--img,0)*.35)}
.filament{stroke:color-mix(in oklab,var(--anatomy-hi),var(--heat) calc(var(--f,0)*100%))!important;stroke-width:calc(.6px + var(--f,0)*.5px)}
.fil-glow{fill:url(#g-heat);opacity:calc(var(--fil,0)*.9)}
.track-glow{fill:none;stroke:var(--heat);stroke-width:2.2;opacity:calc(var(--hot,0)*.75);filter:blur(.6px)}
.spot-glow{fill:url(#g-heat);opacity:var(--hot,0)}
.beam-in path{fill:var(--accent);opacity:calc(var(--beam,0)*.22)}
.beam-in .wide{opacity:calc(var(--emit,0)*.08)}
.beam-out .vol{fill:var(--accent);opacity:calc(var(--beam,0)*.14)}
.beam-out .edge{fill:none;stroke:var(--accent);stroke-width:.6;opacity:calc(var(--beam,0)*.6);vector-effect:non-scaling-stroke}
.electrons circle,.cloud circle{fill:var(--e)}
.photons line{stroke:var(--accent);stroke-width:1.1;stroke-linecap:round}
.stage[data-spin] .part[data-part="stator"] .iso-dots circle{fill:var(--heat);opacity:.8}
.stage[data-hv] .expose-btn .iso-edge{stroke:var(--heat)!important}
.stage[data-hv] .expose-btn .iso-top{fill:var(--heat-soft)}
.tabs{display:flex;gap:4px;margin:-2px 0 8px}
.tabs button{font:500 11.5px/1 var(--font-mono);padding:6px 10px;border-radius:4px;border:1px solid var(--rule);background:transparent;color:var(--ink-2);cursor:pointer}
.tabs button[aria-selected="true"]{background:var(--ink);color:var(--surface);border-color:var(--ink)}
.view{min-height:0;display:grid;align-content:start}
.view[hidden]{display:none}
.wedge-img{display:grid;grid-template-columns:repeat(6,1fr);border:1px solid var(--rule);border-radius:4px;overflow:hidden}
.wedge-img div{aspect-ratio:1/1.25;background:var(--rule);transition:background .6s}
.wedge-lab{display:grid;grid-template-columns:repeat(6,1fr);font:10.5px/1.3 var(--font-mono);color:var(--muted);text-align:center;margin-top:5px}
.spec{width:100%;height:auto;display:block;overflow:visible;max-height:150px}
.spec text{font:10px var(--font-mono);fill:var(--muted)}
.spec .ax{stroke:var(--rule);stroke-width:1}
.spec .grid{stroke:var(--rule);stroke-width:1;stroke-dasharray:2 3}
.spec .area{fill:var(--accent);fill-opacity:.18}
.spec .line{fill:none;stroke:var(--accent);stroke-width:2;stroke-linejoin:round}
.spec .mean{stroke:var(--ink);stroke-width:1}
.spec .lab{fill:var(--ink-2)}
`;

const controls = `
<div class="ctl"><label for="kv">kVp</label><input id="kv" type="range" min="40" max="150" step="1" value="80"><output data-out="kv">80 kV</output></div>
<div class="ctl"><label for="ma">mA</label><input id="ma" type="range" min="50" max="800" step="10" value="320"><output data-out="ma">320 mA</output></div>
<div class="ctl"><span class="lab">Focus</span><div class="seg" role="group" aria-label="Focal spot"><button type="button" data-focus="small" aria-pressed="false">Small spot</button><button type="button" data-focus="large" aria-pressed="true">Large spot</button></div></div>
<p class="note" data-note></p>`;

const result = `
<div class="tabs" role="tablist"><button type="button" role="tab" data-tab="img" aria-selected="true">Image</button><button type="button" role="tab" data-tab="spec" aria-selected="false">Spectrum</button></div>
<div class="view" data-view="img"><div class="wedge-img">${Array.from({ length: 6 }, () => "<div></div>").join("")}</div><div class="wedge-lab">${["Open", "2 mm", "4 mm", "6 mm", "8 mm", "10 mm"].map((t) => `<span>${t}</span>`).join("")}</div><p class="caption-quiet" data-img-note></p></div>
<div class="view" data-view="spec" hidden><svg class="spec" viewBox="0 0 330 170" role="img" aria-label="X-ray energy spectrum"></svg><p class="caption-quiet">Photon energies in the beam after filtering. The highest energy equals the kVp.</p></div>`;

const SCRIPT = `
const { X, STEPS } = DATA;
const Wd = X.world;
const $ = (s) => document.querySelector(s), $$ = (s) => [...document.querySelectorAll(s)];
const NS = "http://www.w3.org/2000/svg";

/* model */
const MU = [[10,26.2],[15,7.96],[20,3.44],[30,1.128],[40,.5685],[50,.3681],[60,.2778],[80,.2018],[100,.1704],[150,.1378]];
const muAl = (E) => { if (E <= MU[0][0]) return MU[0][1]; for (let i = 1; i < MU.length; i++) if (E <= MU[i][0]) { const [e0,m0] = MU[i-1], [e1,m1] = MU[i]; const t = Math.log(E/e0)/Math.log(e1/e0); return Math.exp(Math.log(m0) + t*(Math.log(m1)-Math.log(m0))); } return MU[MU.length-1][1]; };
const RHO = 2.699, FILTER_CM = 0.25;
function spectrum(kv){
  const bins = [];
  for (let E = 10; E <= kv; E += 0.5){
    const raw = Math.max(0, (kv - E) / E);
    let ch = 0;
    if (kv > 69.5){ const a = Math.pow(kv/69.5 - 1, 1.63) * 9; for (const [e, w] of [[57.98,.58],[59.32,1],[67.2,.34]]) ch += a * w * Math.exp(-((E-e)**2)/(2*0.45**2)); }
    bins.push({ E, fil: (raw + ch) * Math.exp(-muAl(E) * RHO * FILTER_CM) });
  }
  return bins;
}
const tech = { kv: 80, ma: 320, focus: "large" };
function model(){
  const g = 1 + tech.kv / 511, beta = Math.sqrt(1 - 1/(g*g));
  const bins = spectrum(tech.kv);
  let n = 0, ne = 0; for (const b of bins){ n += b.fil; ne += b.fil * b.E; }
  const steps = [0, .2, .4, .6, .8, 1.0].map((t) => { let a = 0; for (const b of bins) a += b.fil * b.E * Math.exp(-muAl(b.E) * RHO * t); return a / ne; });
  return { beta, eff: 0.9e-9 * 74 * tech.kv * 1000, bins, mean: ne / n, steps };
}
let M = model();

/* effect layers */
const mk = (tag, parent, attrs = {}) => { const el = document.createElementNS(NS, tag); for (const [a, v] of Object.entries(attrs)) el.setAttribute(a, v); parent.appendChild(el); return el; };
const proj = (p) => [X.O[0] + p[0] * X.ex[0] + p[1] * X.ey[0] + p[2] * X.ez[0], X.O[1] + p[0] * X.ex[1] + p[1] * X.ey[1] + p[2] * X.ez[1]];
const cloud = Array.from({ length: 22 }, () => ({ el: mk("circle", $(".cloud"), { r: .75 }), a: Math.random()*6.28, r: Math.random(), w: .6 + Math.random()*1.6 }));
const electrons = Array.from({ length: 26 }, (_, i) => ({ el: mk("circle", $(".electrons"), { r: .8 }), u: i / 26, j: Math.random() - .5 }));
const photons = Array.from({ length: 70 }, () => ({ el: mk("line", $(".photons")), live: false }));
const anodeFace = $(".anode-face"), rotorG = $(".rotor");
const ribHost = rotorG && rotorG.querySelector(".iso-solid");
if (ribHost){ const faded = ribHost.querySelectorAll(":scope > g"); if (faded.length){ const holder = document.createElementNS(NS, "g"); holder.setAttribute("data-ribs", ""); faded[0].before(holder); faded.forEach((n) => n.remove()); holder.innerHTML = X.rotorFrames[0]; } }
const fils = $$(".filament");
const F3 = [Wd.FX, 0, Wd.FZ];
function spawnPhoton(p, beam){
  let d, len, through = false;
  if (Math.random() < .55){
    let v; do { v = [Math.random()*2-1, Math.random()*2-1, Math.random()*2-1]; } while (Math.hypot(...v) > 1 || Math.hypot(...v) < .2);
    const n = Math.hypot(...v); d = v.map((c) => c / n);
    if (d[0] > -0.08 && d[2] > -0.2) d[0] = -Math.abs(d[0]) - .3;
  } else {
    const h = beam > .5 ? Wd.APERTURE : Wd.APERTURE * 1.6;
    const tx = Wd.FX + (Math.random()*2-1) * h, ty = (Math.random()*2-1) * h;
    const v = [tx - F3[0], ty, Wd.COLLZ0 - F3[2]]; const n = Math.hypot(...v); d = v.map((c) => c / n);
    through = Math.abs(tx - Wd.FX) <= Wd.APERTURE && Math.abs(ty) <= Wd.APERTURE && beam > .5;
  }
  if (through) len = (Wd.DET_Z - F3[2]) / d[2];
  else {
    const oz = F3[2] - Wd.ZA, a = d[1]*d[1] + d[2]*d[2], b = 2*oz*d[2], c = oz*oz - Wd.LINING*Wd.LINING;
    len = (-b + Math.sqrt(b*b - 4*a*c)) / (2*a);
    if (d[2] < -.85 && Math.abs(d[0]) < .25) len = (Wd.COLLZ1 - F3[2]) / d[2];
    if (Math.abs(d[0]) > 1e-6) len = Math.min(len, ((d[0] > 0 ? 123 : -123) - F3[0]) / d[0]);
  }
  Object.assign(p, { d, len, t: 0, live: true, speed: 95 + Math.random()*20 });
}

/* result views */
const cells = $$(".wedge-img div"), imgNote = $("[data-img-note]");
function renderImage(on){
  cells.forEach((c, i) => { c.style.background = on ? "hsl(220 6% " + (8 + 84 * (1 - Math.pow(M.steps[i], .55))).toFixed(0) + "%)" : ""; });
  imgNote.textContent = on ? "Radiograph at " + tech.kv + " kVp. Thicker aluminium lets fewer X-rays through, so its square stays lighter." : "The step wedge's shadow appears here at step 7. Darker means more X-rays reached the detector.";
}
const spec = $(".spec");
const SX = (E) => 30 + (E / 150) * 290, SY = (v) => 140 - v * 112;
function drawSpectrum(){
  const bins = M.bins, top = Math.max(...bins.map((b) => b.fil), 1e-9);
  const yv = (v) => SY(Math.min(v / top, 1.12));
  const line = bins.map((b, i) => (i ? "L" : "M") + SX(b.E).toFixed(1) + " " + yv(b.fil).toFixed(1)).join("");
  let g = "";
  for (const t of [0, 50, 100, 150]) g += '<line class="grid" x1="' + SX(t) + '" x2="' + SX(t) + '" y1="20" y2="140"/><text x="' + SX(t) + '" y="156" text-anchor="middle">' + t + '</text>';
  g += '<text x="320" y="168" text-anchor="end">photon energy, keV</text><line class="ax" x1="30" x2="320" y1="140" y2="140"/>';
  g += '<path class="area" d="' + line + 'L' + SX(bins[bins.length-1].E).toFixed(1) + ' 140L' + SX(10) + ' 140Z"/><path class="line" d="' + line + '"/>';
  g += '<line class="mean" x1="' + SX(M.mean) + '" x2="' + SX(M.mean) + '" y1="18" y2="140"/><text class="lab" x="' + SX(M.mean) + '" y="12" text-anchor="middle">average</text>';
  g += '<text class="lab" x="' + (SX(tech.kv) + 3) + '" y="134">max</text>';
  if (tech.kv > 69.5){ const pk = bins.find((b) => b.E >= 59.3); g += '<text class="lab" x="' + (SX(59.3) + 6) + '" y="' + Math.max(16, yv(pk.fil) - 4).toFixed(1) + '">K lines</text>'; }
  spec.innerHTML = g;
}
$$("[data-tab]").forEach((b) => b.addEventListener("click", () => { $$("[data-tab]").forEach((x) => x.setAttribute("aria-selected", String(x === b))); $$("[data-view]").forEach((v) => v.hidden = v.dataset.view !== b.dataset.tab); }));

/* captions: the numbers live in words */
const pct = (n) => n < 1 ? n.toFixed(1) : Math.round(n);
function caption(i){
  const base = STEPS[i].body;
  if (i === 1) return base + (tech.focus === "small" ? " The short filament is lit for the small focal spot." : " The long filament is lit for the large focal spot.");
  if (i === 3) return base + " At " + tech.kv + " kVp they arrive at about " + Math.round(M.beta * 100) + " % of the speed of light.";
  if (i === 4) return "The electrons slam into the tungsten focal track. Almost all of their energy becomes heat, which is why the track glows; at " + tech.kv + " kVp only about " + pct(M.eff * 100) + " % becomes X-rays. " + (tech.kv > 69.5 ? "Above tungsten's 69.5 keV K-edge, sharp characteristic lines join the bremsstrahlung." : "Below tungsten's 69.5 keV K-edge the beam is bremsstrahlung only.");
  return base;
}

/* controls */
const kv = $("#kv"), ma = $("#ma"), note = $("[data-note]");
const dispKV = $('[data-disp="kV"] text'), dispMA = $('[data-disp="mA"] text'), dispMS = $('[data-disp="ms"] text');
function readTech(){
  tech.kv = +kv.value;
  if (tech.focus === "small" && +ma.value > 300) ma.value = 300;
  tech.ma = +ma.value;
  $('[data-out="kv"]').textContent = tech.kv + " kV"; $('[data-out="ma"]').textContent = tech.ma + " mA";
  note.textContent = tech.focus === "small" ? "The small spot gives sharper detail but takes at most about 300 mA, because the heat lands on a smaller area." : "Higher kVp makes faster electrons and more penetrating X-rays; more mA sends more electrons.";
  dispKV.textContent = String(tech.kv).padStart(3, "0"); dispMA.textContent = String(tech.ma).padStart(3, "0").slice(-3); dispMS.textContent = "100";
  fils.forEach((f) => f.style.opacity = f.dataset.fil === tech.focus ? 1 : .35);
  M = model(); drawSpectrum();
  if (window.sim){ if (sim.step === 6) renderImage(true); sim.refresh(); }
}
[kv, ma].forEach((el) => el.addEventListener("input", readTech));
$$("[data-focus]").forEach((b) => b.addEventListener("click", () => { tech.focus = b.dataset.focus; $$("[data-focus]").forEach((x) => x.setAttribute("aria-pressed", String(x === b))); readTech(); }));
readTech();

/* frame effects */
let rot = 0, photonClock = 0;
function onFrame(dt, calm, api){
  const cur = api.cur;
  api.stage.toggleAttribute("data-spin", cur.spin > .05);
  api.stage.toggleAttribute("data-hv", api.step >= 3);
  rot += dt * cur.spin * (calm ? 0 : 2.4);
  const fA = Math.floor(((rot / (Math.PI/4)) % 1) * 12) % 12;
  if (anodeFace && anodeFace.dataset.f != fA){ anodeFace.innerHTML = X.anodeFrames[fA]; anodeFace.dataset.f = fA; }
  const fR = Math.floor(((rot / (Math.PI/12)) % 1) * 12) % 12;
  const rib = rotorG && rotorG.querySelector("[data-ribs]");
  if (rib && rotorG.dataset.f != fR){ rib.innerHTML = X.rotorFrames[fR]; rotorG.dataset.f = fR; }
  const [fx, fy] = X.filament, [sx, sy] = X.spot;
  cloud.forEach((c) => { c.a += dt * c.w * 2; const rr = (2.2 + c.r * 3.2) * cur.fil; c.el.setAttribute("cx", (fx + Math.cos(c.a) * rr).toFixed(2)); c.el.setAttribute("cy", (fy + Math.sin(c.a * 1.3) * rr * .8).toFixed(2)); c.el.setAttribute("opacity", (Math.max(0, cur.fil - .3) * (1 - cur.hv * .6)).toFixed(2)); });
  const speed = calm ? 0 : .55 + .5 * (tech.kv / 150);
  electrons.forEach((e) => { e.u = (e.u + dt * speed) % 1; const u = e.u * e.u, spread = (1 - e.u) * 2.4 * e.j; e.el.setAttribute("cx", (fx + (sx - fx) * u).toFixed(2)); e.el.setAttribute("cy", (fy + (sy - fy) * u + spread).toFixed(2)); e.el.setAttribute("opacity", (cur.hv * Math.min(1, tech.ma / 300 + .3)).toFixed(2)); });
  photonClock += dt * cur.emit * (calm ? 0 : 1) * (14 + tech.ma / 25);
  for (const p of photons){
    if (!p.live){ if (photonClock >= 1){ photonClock -= 1; spawnPhoton(p, cur.beam); } else { p.el.setAttribute("opacity", 0); continue; } }
    p.t += dt * p.speed;
    if (p.t > p.len + 6){ p.live = false; p.el.setAttribute("opacity", 0); continue; }
    const t1 = Math.min(p.t, p.len), t0 = Math.max(0, Math.min(p.t - 6, p.len));
    const a = proj([F3[0] + p.d[0]*t0, p.d[1]*t0, F3[2] + p.d[2]*t0]), b = proj([F3[0] + p.d[0]*t1, p.d[1]*t1, F3[2] + p.d[2]*t1]);
    p.el.setAttribute("x1", a[0].toFixed(1)); p.el.setAttribute("y1", a[1].toFixed(1)); p.el.setAttribute("x2", b[0].toFixed(1)); p.el.setAttribute("y2", b[1].toFixed(1));
    p.el.setAttribute("opacity", (cur.emit * .95).toFixed(2));
  }
  fils.forEach((f) => f.style.setProperty("--f", f.dataset.fil === tech.focus ? cur.fil : cur.fil * .2));
}

const sim = window.sim = SimEngine({
  data: DATA,
  channels: { fil: .15, spin: 0, hv: 0, hot: 0, emit: 0, beam: 0, img: 0 },
  targets: [
    { fil: .15, spin: 0, hv: 0, hot: 0, emit: 0, beam: 0, img: 0 },
    { fil: 1, spin: 0, hv: 0, hot: 0, emit: 0, beam: 0, img: 0 },
    { fil: 1, spin: 1, hv: 0, hot: 0, emit: 0, beam: 0, img: 0 },
    { fil: 1, spin: 1, hv: 1, hot: .25, emit: 0, beam: 0, img: 0 },
    { fil: 1, spin: 1, hv: 1, hot: 1, emit: 1, beam: 0, img: 0 },
    { fil: 1, spin: 1, hv: 1, hot: 1, emit: 1, beam: 1, img: 0 },
    { fil: 1, spin: 1, hv: 1, hot: 1, emit: 1, beam: 1, img: 1 },
  ],
  taus: { spin: .9, hot: (c, t) => (t < c ? 1.8 : .35) },
  caption,
  onStep: (i) => renderImage(i === 6),
  onFrame,
  readout: (api) => STEPS[api.step].title.toLowerCase() + " · " + tech.kv + " kVp",
  busy: (api) => api.cur.spin > .01 || api.cur.emit > .01,
});
`;

const html = pageHtml({
  title: "X-Ray Tube Anatomy",
  eyebrow: "Diagnostic radiography · tube anatomy",
  lede: "A hospital rotating-anode X-ray tube, cut in half. Press Play to follow one exposure, or click any part to pull it out and turn it in 3D. Motion is slowed and not to scale.",
  figLabel: "Rotating-anode tube · half section",
  svg,
  parts: PARTS,
  steps: STEPS_TEXT,
  controls,
  controlsTitle: "Technique",
  controlsNote: "set on the console",
  result,
  resultTitle: "Result",
  resultNote: "what the detector sees",
  css: CSS,
  kitCss: k.ISO_CSS,
  data: { X, PARTS, STEPS: STEPS_TEXT, ACTS, W: WIDTH, H: HEIGHT, MODELS: models(), K: G.scaleOf(P), VIEW: G.viewOf(P), processName: "Exposure" },
  script: SCRIPT,
});
writeFileSync("xray-tube.html", html);
writeFileSync("xray-tube-standalone.html", standalone(html));
console.log("wrote xray-tube.html", (html.length / 1024).toFixed(0) + " KB");
