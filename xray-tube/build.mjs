import { writeFileSync } from "node:fs";
import * as k from "./kit/iso-kit.mjs";
import { build, extras, WIDTH, HEIGHT } from "./geometry.mjs";
import { PARTS, STEPS_TEXT } from "./content.mjs";

const svg = build();
const X = extras();

const groups = {};
for (const [id, p] of Object.entries(PARTS)) (groups[p.group] ||= []).push(id);

const CSS = `
:root{
  /* Layout: figure card left, instrument panel right; stacks to one column under 980px */
  --bg:#efefeb;--surface:#fbfbfa;--ink:#18181a;--ink-2:#57575a;--muted:#8c8c90;--rule:#d9d9d5;
  --xr:#4b3fd6;--xr-soft:#4b3fd622;--heat:#d4561a;--heat-soft:#d4561a33;--e:#0b6e8a;--on-xr:#ffffff;
  --font-display:"IBM Plex Sans Condensed","IBM Plex Sans",ui-sans-serif,system-ui,sans-serif;
  --font-body:"IBM Plex Sans",ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;
  --font-mono:"IBM Plex Mono",ui-monospace,"SF Mono",Menlo,Consolas,monospace;
}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#0b0b0c;--surface:#131314;--ink:#e8e8e6;--ink-2:#a3a3a3;--muted:#6e6e70;--rule:#2a2a2c;--xr:#9d94ff;--xr-soft:#9d94ff22;--heat:#ff8f4a;--heat-soft:#ff8f4a33;--e:#6fd3ef;--on-xr:#0b0b0c;color-scheme:dark}}
:root[data-theme="dark"]{--bg:#0b0b0c;--surface:#131314;--ink:#e8e8e6;--ink-2:#a3a3a3;--muted:#6e6e70;--rule:#2a2a2c;--xr:#9d94ff;--xr-soft:#9d94ff22;--heat:#ff8f4a;--heat-soft:#ff8f4a33;--e:#6fd3ef;--on-xr:#0b0b0c;color-scheme:dark}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.55 var(--font-body);-webkit-font-smoothing:antialiased}
.page{max-width:1280px;margin:0 auto;padding-block:28px 64px;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}
header.top{display:grid;gap:6px;margin-bottom:20px;max-width:760px}
.eyebrow{font:500 11px/1 var(--font-mono);letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}
h1{font:600 clamp(26px,4vw,38px)/1.05 var(--font-display);letter-spacing:-.01em;margin:4px 0 2px;text-wrap:balance}
.lede{color:var(--ink-2);margin:0;max-width:66ch}
.layout{display:grid;grid-template-columns:minmax(0,1fr) 370px;gap:20px;align-items:start}
@media (max-width:980px){.layout{grid-template-columns:minmax(0,1fr)}}
.iso{background:transparent}
.iso .iso-plate{padding:46px 18px 46px;box-shadow:0 0 0 1px var(--rule)}
.iso-figure{margin:0}
.stage{position:relative;outline:none}
.stage svg{cursor:default}
.part{cursor:pointer}
.part:hover .iso-line{stroke:var(--anatomy-hi)}
.stage[data-focus] .part{opacity:.38;transition:opacity .25s}
.stage[data-focus] .part[data-sel]{opacity:1}
.part[data-sel] .iso-line,.part[data-sel] .iso-edge{stroke:var(--xr)!important}
.part[data-sel] .cs{fill:var(--xr-soft)}
.cf{stroke-width:.5;stroke-linejoin:round}
.cf[data-shade="0"]{fill:var(--anatomy-shade-0);stroke:var(--anatomy-shade-0)}
.cf[data-shade="1"]{fill:var(--anatomy-shade-1);stroke:var(--anatomy-shade-1)}
.cf[data-shade="2"]{fill:var(--anatomy-shade-2);stroke:var(--anatomy-shade-2)}
.cf[data-shade="3"]{fill:var(--anatomy-shade-3);stroke:var(--anatomy-shade-3)}
.cf[data-shade="4"]{fill:var(--anatomy-top);stroke:var(--anatomy-top)}
.cf.glass{fill-opacity:.3;stroke-opacity:.3}
.cs{fill:var(--anatomy-face)}
.cs.cut-pb{fill:var(--anatomy-shade-0)}
.cs.cut-glass{fill:var(--anatomy-mid);fill-opacity:.3}
.cs.cut-cu{fill:var(--anatomy-shade-1)}
.cs.cut-be{fill:var(--anatomy-mid);fill-opacity:.5}
.cs.cut-filter{fill:var(--anatomy-hi);fill-opacity:.35}
.mirror{fill:var(--anatomy-mid);fill-opacity:.22}
.det-glow{fill:var(--xr);opacity:calc(var(--img,0)*.35)}
.filament{stroke:color-mix(in oklab,var(--anatomy-hi),var(--heat) calc(var(--fil,0)*100%))!important;stroke-width:calc(.6px + var(--fil,0)*.5px)}
.fx{pointer-events:none}
.fil-glow{fill:url(#g-heat);opacity:calc(var(--fil,0)*.9)}
.track-glow{fill:none;stroke:var(--heat);stroke-width:2.2;opacity:calc(var(--heat-on,0)*.75);filter:blur(.6px)}
.spot-glow{fill:url(#g-heat);opacity:var(--heat-on,0)}
.beam-in path{fill:var(--xr);opacity:calc(var(--beam,0)*.22)}
.beam-in .wide{opacity:calc(var(--emit,0)*.08)}
.beam-out .vol{fill:var(--xr);opacity:calc(var(--beam,0)*.14)}
.beam-out .edge{fill:none;stroke:var(--xr);stroke-width:.6;opacity:calc(var(--beam,0)*.6);vector-effect:non-scaling-stroke}
.electrons circle{fill:var(--e)}
.cloud circle{fill:var(--e)}
.photons line{stroke:var(--xr);stroke-width:1.1;stroke-linecap:round}
.stage[data-spin] .part[data-part="stator"] .iso-dots circle{fill:var(--heat);opacity:.8;transition:fill .3s}
.stage[data-hv] .expose-btn .iso-edge{stroke:var(--heat)!important}
.stage[data-hv] .expose-btn .iso-top{fill:var(--heat-soft)}
.hover-tag{position:absolute;pointer-events:none;font:500 11px/1 var(--font-mono);padding:5px 7px;background:var(--surface);color:var(--ink);border:1px solid var(--rule);border-radius:3px;white-space:nowrap;transform:translate(10px,-130%);opacity:0;transition:opacity .12s}
.hover-tag[data-on]{opacity:1}
.pop{position:absolute;width:min(300px,86%);background:var(--surface);border:1px solid var(--rule);border-radius:6px;box-shadow:0 12px 32px -12px #0006;padding:14px 16px 14px;z-index:5;font-size:13px;line-height:1.5}
.pop[hidden]{display:none}
.pop .grp{font:500 10px/1 var(--font-mono);letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}
.pop h3{font:600 17px/1.2 var(--font-display);margin:6px 0 2px}
.pop .role{color:var(--xr);font-weight:500;margin:0 0 6px}
.pop p{margin:0 0 10px;color:var(--ink-2)}
.pop dl{display:grid;grid-template-columns:auto 1fr;gap:3px 12px;margin:0;font:12px/1.4 var(--font-mono)}
.pop dt{color:var(--muted)}
.pop dd{margin:0;color:var(--ink);font-variant-numeric:tabular-nums}
.pop .x{position:absolute;top:8px;right:8px;width:28px;height:28px;border:0;background:transparent;color:var(--muted);font-size:18px;line-height:1;cursor:pointer;border-radius:4px}
.pop .x:hover{background:var(--rule);color:var(--ink)}
.pop-line{position:absolute;pointer-events:none;width:9px;height:9px;border-radius:50%;border:1.5px solid var(--xr);background:var(--surface);transform:translate(-50%,-50%);z-index:4}
.pop-line[hidden]{display:none}
@media (max-width:640px){.pop{position:relative;width:auto;margin-top:12px;box-shadow:none;left:auto!important;top:auto!important}.iso-plate-corner[data-corner="title"]{display:none}}
.parts{margin-top:14px;display:grid;gap:10px}
.parts .row{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.parts .row span{font:500 10px/1 var(--font-mono);letter-spacing:.12em;text-transform:uppercase;color:var(--muted);width:100%;}
.chip{font:500 12.5px/1 var(--font-body);padding:7px 10px;border-radius:999px;border:1px solid var(--rule);background:var(--surface);color:var(--ink-2);cursor:pointer}
.chip:hover{color:var(--ink);border-color:var(--muted)}
.chip[aria-pressed="true"]{border-color:var(--xr);color:var(--xr);background:var(--xr-soft)}
button:focus-visible,input:focus-visible,select:focus-visible,.stage:focus-visible{outline:2px solid var(--xr);outline-offset:2px}
aside.panel{display:grid;gap:14px}
.card{background:var(--surface);border:1px solid var(--rule);border-radius:6px;padding:16px}
.card h2{font:600 13px/1 var(--font-mono);letter-spacing:.1em;text-transform:uppercase;color:var(--ink-2);margin:0 0 12px;display:flex;justify-content:space-between;gap:8px}
.card h2 small{font-weight:400;letter-spacing:.04em;text-transform:none;color:var(--muted)}
ol.steps{list-style:none;margin:0 0 12px;padding:0;display:grid;grid-template-columns:repeat(7,1fr);gap:4px}
ol.steps button{width:100%;height:30px;border:1px solid var(--rule);background:transparent;border-radius:4px;color:var(--muted);font:500 12px/1 var(--font-mono);cursor:pointer}
ol.steps button[aria-current="step"]{background:var(--ink);color:var(--surface);border-color:var(--ink)}
ol.steps button.done{color:var(--ink-2);border-color:var(--muted)}
.step-text h3{font:600 18px/1.2 var(--font-display);margin:0 0 6px}
.step-text p{margin:0;color:var(--ink-2);min-height:7.5em}
.transport{display:flex;gap:8px;margin-top:12px}
.btn{flex:1;height:36px;border-radius:5px;border:1px solid var(--rule);background:var(--surface);color:var(--ink);font:500 13px/1 var(--font-body);cursor:pointer}
.btn:hover{border-color:var(--muted)}
.btn.primary{background:var(--xr);border-color:var(--xr);color:var(--on-xr)}
.ctl{display:grid;grid-template-columns:62px 1fr 74px;align-items:center;gap:10px;margin:8px 0}
.ctl label{font:500 12px/1 var(--font-mono);color:var(--ink-2)}
.ctl output{font:500 13px/1 var(--font-mono);text-align:right;font-variant-numeric:tabular-nums}
.ctl input[type=range]{width:100%;accent-color:var(--xr)}
.seg{display:flex;border:1px solid var(--rule);border-radius:5px;overflow:hidden}
.seg button{flex:1;height:30px;border:0;background:transparent;color:var(--ink-2);font:500 12px/1 var(--font-body);cursor:pointer}
.seg button[aria-pressed="true"]{background:var(--ink);color:var(--surface)}
.note{font-size:12px;color:var(--muted);margin:8px 0 0}
.note[data-warn]{color:var(--heat)}
.read{display:grid;grid-template-columns:1fr 1fr;gap:10px 14px;margin:0}
.read div{display:grid;gap:2px;min-width:0}
.read dt{font:500 10.5px/1.2 var(--font-mono);letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
.read dd{margin:0;font:500 17px/1.2 var(--font-mono);font-variant-numeric:tabular-nums;color:var(--ink)}
.read dd small{font-size:11px;color:var(--muted);font-weight:400}
.meter{height:6px;border-radius:3px;background:var(--rule);overflow:hidden;margin-top:4px}
.meter i{display:block;height:100%;width:0;background:var(--heat);transition:width .3s}
.spec{width:100%;height:auto;display:block;overflow:visible}
.spec text{font:10px var(--font-mono);fill:var(--muted)}
.spec .ax{stroke:var(--rule);stroke-width:1}
.spec .grid{stroke:var(--rule);stroke-width:1;stroke-dasharray:2 3}
.spec .area{fill:var(--xr);fill-opacity:.18}
.spec .line{fill:none;stroke:var(--xr);stroke-width:2;stroke-linejoin:round}
.spec .raw{fill:none;stroke:var(--muted);stroke-width:1.5;stroke-dasharray:4 3}
.spec .mean{stroke:var(--ink);stroke-width:1}
.spec .cross{stroke:var(--ink-2);stroke-width:1}
.spec .lab{fill:var(--ink-2)}
.spec .dot{fill:var(--xr);stroke:var(--surface);stroke-width:2}
.legend{display:flex;gap:14px;font:11px/1 var(--font-mono);color:var(--ink-2);margin:2px 0 8px}
.legend i{display:inline-block;width:14px;height:0;border-top:2px solid var(--xr);vertical-align:middle;margin-right:6px}
.legend i.raw{border-top:2px dashed var(--muted)}
.wedge-img{display:grid;grid-template-columns:repeat(6,1fr);gap:0;border:1px solid var(--rule);border-radius:4px;overflow:hidden}
.wedge-img div{aspect-ratio:1/1.2;background:#777;transition:background .6s}
.wedge-lab{display:grid;grid-template-columns:repeat(6,1fr);font:10.5px/1.3 var(--font-mono);color:var(--muted);text-align:center;margin-top:6px;font-variant-numeric:tabular-nums}
.wedge-lab b{display:block;color:var(--ink);font-weight:500}
.caption{color:var(--muted);font-size:12.5px;margin:10px 2px 0;max-width:80ch}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
`;

const defs = `<defs><radialGradient id="g-heat"><stop offset="0" stop-color="#fff3d6"/><stop offset=".25" stop-color="#ffb25e"/><stop offset=".6" stop-color="#ff7a1a" stop-opacity=".45"/><stop offset="1" stop-color="#ff5a00" stop-opacity="0"/></radialGradient></defs>`;
const fx = (n) => n.toFixed(1);
const figure = svg
  .replace(/(<svg[^>]*>)/, `$1${defs}`)
  .replace(`<g class="beam-out"></g>`, `<g class="beam-out fx"><path class="vol" d="${X.beamOut}"/><path class="edge" d="${X.beamEdges}"/></g>`)
  .replace(`<g class="beam-in"></g>`, `<g class="beam-in fx"><path class="wide" d="${X.beamWide}"/><path d="${X.beamIn}"/></g>`)
  .replace(`<g class="heat"></g>`, `<g class="fx"><path class="track-glow" d="${X.track}"/><circle class="spot-glow" cx="${fx(X.spot[0])}" cy="${fx(X.spot[1])}" r="9"/></g><g class="photons fx"></g>`)
  .replace(`<g class="electrons"></g>`, `<g class="electrons fx"></g>`)
  .replace(`<g class="cloud"></g>`, `<g class="cloud fx"></g><circle class="fil-glow fx" cx="${fx(X.filament[0])}" cy="${fx(X.filament[1])}" r="8"/>`);

const chips = Object.entries(groups)
  .map(([group, ids]) => `<div class="row"><span>${group}</span>${ids.map((id) => `<button class="chip" type="button" data-pick="${id}" aria-pressed="false">${PARTS[id].name}</button>`).join("")}</div>`)
  .join("");

const plate = k.plateHtml({
  fig: "Fig 1",
  title: "Rotating-anode X-ray tube · half section",
  hint: "Click any part",
  readout: "standby",
  keys: [],
  caption: "",
  body: `<div class="stage" tabindex="0" aria-label="X-ray tube figure. Use the part buttons below to open a description of each part.">${figure}<div class="hover-tag" aria-hidden="true"></div><span class="pop-line" hidden></span><div class="pop" role="dialog" aria-live="polite" hidden></div></div>`,
});

const html = `<title>X-Ray Tube Anatomy</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans+Condensed:wght@600&family=IBM+Plex+Sans:wght@400;500;600&display=swap">
<style>${k.ISO_CSS}${CSS}</style>
<div class="page iso" id="iso">
<header class="top">
  <span class="eyebrow">Diagnostic radiography · tube anatomy</span>
  <h1>X-Ray Tube Anatomy</h1>
  <p class="lede">A standard hospital X-ray tube, cut in half down its axis. Click any part to see what it does, then run an exposure to follow one burst of X-rays from a hot filament to a picture on the detector.</p>
</header>
<div class="layout">
  <section aria-label="Tube figure">
    ${plate}
    <div class="parts" aria-label="Parts">${chips}</div>
    <p class="caption">Half-section view: the near half of the housing, glass envelope, stator and collimator is cut away. Internal parts are shown whole. Motion is slowed and not to scale. The real anode turns about 57 times a second, and electrons cross the gap in well under a nanosecond.</p>
  </section>
  <aside class="panel">
    <div class="card" aria-label="Exposure sequence">
      <h2>Exposure sequence <small data-phase>step 1 of 7</small></h2>
      <ol class="steps">${STEPS_TEXT.map((s, i) => `<li><button type="button" data-step="${i}" aria-label="Step ${i + 1}: ${s.title}">${i + 1}</button></li>`).join("")}</ol>
      <div class="step-text" aria-live="polite"><h3 data-st-title></h3><p data-st-body></p></div>
      <div class="transport">
        <button class="btn" type="button" id="back">Back</button>
        <button class="btn primary" type="button" id="play">Play</button>
        <button class="btn" type="button" id="next">Next</button>
      </div>
    </div>
    <div class="card" aria-label="Technique">
      <h2>Technique <small>set on the console</small></h2>
      <div class="ctl"><label for="kv">kVp</label><input id="kv" type="range" min="40" max="150" step="1" value="80"><output data-out="kv">80 kV</output></div>
      <div class="ctl"><label for="ma">mA</label><input id="ma" type="range" min="50" max="800" step="10" value="320"><output data-out="ma">320 mA</output></div>
      <div class="ctl"><label for="ms">Time</label><input id="ms" type="range" min="0" max="7" step="1" value="3"><output data-out="ms">100 ms</output></div>
      <div class="ctl"><label>Focus</label><div class="seg" role="group" aria-label="Focal spot"><button type="button" data-focus="small" aria-pressed="false">Small 0.6</button><button type="button" data-focus="large" aria-pressed="true">Large 1.2</button></div><span></span></div>
      <p class="note" data-note></p>
    </div>
    <div class="card" aria-label="Live physics">
      <h2>What the tube is doing</h2>
      <dl class="read">
        <div><dt>Electron speed</dt><dd data-r="beta"></dd></div>
        <div><dt>Max photon energy</dt><dd data-r="emax"></dd></div>
        <div><dt>Tube power</dt><dd data-r="power"></dd></div>
        <div><dt>Charge (mAs)</dt><dd data-r="mas"></dd></div>
        <div><dt>Electrons / exposure</dt><dd data-r="ne"></dd></div>
        <div><dt>Becomes X-rays</dt><dd data-r="eff"></dd></div>
        <div><dt>Filament</dt><dd data-r="fil"></dd></div>
        <div><dt>Anode speed</dt><dd data-r="rpm"></dd></div>
        <div style="grid-column:1/-1"><dt>Heat stored in anode</dt><dd data-r="hu"></dd><div class="meter"><i data-r="hubar"></i></div></div>
      </dl>
    </div>
    <div class="card" aria-label="Beam spectrum">
      <h2>Beam spectrum <small>photons per keV, relative</small></h2>
      <div class="legend"><span><i></i>After 2.5 mm Al filter</span><span><i class="raw"></i>Before filter</span></div>
      <svg class="spec" viewBox="0 0 330 170" role="img" aria-label="X-ray energy spectrum"></svg>
    </div>
    <div class="card" aria-label="Radiograph of the step wedge">
      <h2>Image <small data-img-state>no exposure yet</small></h2>
      <div class="wedge-img">${Array.from({ length: 6 }, () => "<div></div>").join("")}</div>
      <div class="wedge-lab">${["Open", "2 mm", "4 mm", "6 mm", "8 mm", "10 mm"].map((t) => `<span>${t}<b>–</b></span>`).join("")}</div>
      <p class="note">Share of the beam's energy that gets through each aluminium step. Darker means more X-rays reached the detector.</p>
    </div>
  </aside>
</div>
</div>
<script>
const DATA = ${JSON.stringify({ X, PARTS, STEPS: STEPS_TEXT, W: WIDTH, H: HEIGHT })};
${LIVE()}
</script>`;

function LIVE() {
  return `
(function(){
const { X, PARTS, STEPS, W, H } = DATA;
const root = document.documentElement;
const iso = document.getElementById("iso");
const darkQ = matchMedia("(prefers-color-scheme: dark)");
const syncTheme = () => { const t = root.getAttribute("data-theme"); const dark = t ? t === "dark" : darkQ.matches; iso.setAttribute("data-theme", dark ? "dark" : "light"); };
syncTheme(); darkQ.addEventListener?.("change", syncTheme); new MutationObserver(syncTheme).observe(root, { attributes: true, attributeFilter: ["data-theme"] });

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const stage = $(".stage");
const svg = $("svg", stage);
const NS = "http://www.w3.org/2000/svg";
const still = matchMedia("(prefers-reduced-motion: reduce)");
const proj = (p) => [X.O[0] + p[0] * X.ex[0] + p[1] * X.ey[0] + p[2] * X.ez[0], X.O[1] + p[0] * X.ex[1] + p[1] * X.ey[1] + p[2] * X.ez[1]];
const Wd = X.world;

/* ---------- model ---------- */
const MU = [[10,26.2],[15,7.96],[20,3.44],[30,1.128],[40,.5685],[50,.3681],[60,.2778],[80,.2018],[100,.1704],[150,.1378]];
const muAl = (E) => { if (E <= MU[0][0]) return MU[0][1]; for (let i = 1; i < MU.length; i++) if (E <= MU[i][0]) { const [e0,m0] = MU[i-1], [e1,m1] = MU[i]; const t = Math.log(E/e0)/Math.log(e1/e0); return Math.exp(Math.log(m0) + t*(Math.log(m1)-Math.log(m0))); } return MU[MU.length-1][1]; };
const RHO = 2.699, FILTER_CM = 0.25;
function spectrum(kv){
  const bins = [];
  for (let E = 10; E <= kv; E += 0.5){
    let raw = Math.max(0, (kv - E) / E);
    let ch = 0;
    if (kv > 69.5){ const a = Math.pow(kv/69.5 - 1, 1.63) * 9; for (const [e, w] of [[57.98,.58],[59.32,1],[67.2,.34]]) ch += a * w * Math.exp(-((E-e)**2)/(2*0.45**2)); }
    const f = Math.exp(-muAl(E) * RHO * FILTER_CM);
    bins.push({ E, raw: raw + ch, fil: (raw + ch) * f });
  }
  return bins;
}
function model(s){
  const g = 1 + s.kv / 511, beta = Math.sqrt(1 - 1/(g*g));
  const sec = s.ms / 1000, mas = s.ma * sec;
  const bins = spectrum(s.kv);
  let n = 0, ne = 0; for (const b of bins){ n += b.fil; ne += b.fil * b.E; }
  const mean = ne / n;
  const steps = [0, .2, .4, .6, .8, 1.0].map((t) => { let a = 0; for (const b of bins) a += b.fil * b.E * Math.exp(-muAl(b.E) * RHO * t); return a / ne; });
  return { beta, mas, power: s.kv * s.ma / 1000, eff: 0.9e-9 * 74 * s.kv * 1000, electrons: mas * 1e-3 / 1.602e-19, hu: 1.4 * s.kv * mas, joules: s.kv * 1000 * s.ma / 1000 * sec, bins, mean, steps };
}

/* ---------- state ---------- */
const MS = [10, 20, 50, 100, 200, 400, 800, 1600];
const tech = { kv: 80, ma: 320, ms: 100, focus: "large" };
let M = model(tech);
let step = 0, playing = !still.matches, stepClock = 0, idleTimer = 0, chosen = false;
const STEP_SECONDS = 5.2;
const cur = { fil: .15, spin: 0, hv: 0, heat: 0, emit: 0, beam: 0, img: 0 };
const TARGET = [
  { fil: .15, spin: 0, hv: 0, heat: 0, emit: 0, beam: 0, img: 0 },
  { fil: 1, spin: 0, hv: 0, heat: 0, emit: 0, beam: 0, img: 0 },
  { fil: 1, spin: 1, hv: 0, heat: 0, emit: 0, beam: 0, img: 0 },
  { fil: 1, spin: 1, hv: 1, heat: .25, emit: 0, beam: 0, img: 0 },
  { fil: 1, spin: 1, hv: 1, heat: 1, emit: 1, beam: 0, img: 0 },
  { fil: 1, spin: 1, hv: 1, heat: 1, emit: 1, beam: 1, img: 0 },
  { fil: 1, spin: 1, hv: 1, heat: 1, emit: 1, beam: 1, img: 1 },
];
let stored = 0, exposed = false;
const CAP = 300000;

/* ---------- effect layers ---------- */
const electronsG = $(".electrons", svg), cloudG = $(".cloud", svg), photonsG = $(".photons", svg);
const mk = (tag, parent, attrs = {}) => { const el = document.createElementNS(NS, tag); for (const [k2, v] of Object.entries(attrs)) el.setAttribute(k2, v); parent.appendChild(el); return el; };
const cloud = Array.from({ length: 22 }, (_, i) => ({ el: mk("circle", cloudG, { r: .75 }), a: Math.random()*6.28, r: Math.random(), w: .6 + Math.random()*1.6 }));
const electrons = Array.from({ length: 26 }, (_, i) => ({ el: mk("circle", electronsG, { r: .8 }), u: i / 26, j: (Math.random()-.5) }));
const photons = Array.from({ length: 70 }, () => ({ el: mk("line", photonsG), live: false }));
const anodeFace = $(".anode-face", svg), rotorG = $(".rotor", svg);
const rotorRibs = rotorG ? rotorG.querySelector(".iso-solid [opacity], .iso-solid g") : null;
const dispKV = $('[data-disp="kV"] text', svg), dispMA = $('[data-disp="mA"] text', svg), dispMS = $('[data-disp="ms"] text', svg);

const F3 = [Wd.FX, 0, Wd.FZ];
function spawnPhoton(p){
  const r = Math.random();
  let d, len, through = false;
  if (r < .55) {
    let v; do { v = [Math.random()*2-1, Math.random()*2-1, Math.random()*2-1]; } while (Math.hypot(...v) > 1 || Math.hypot(...v) < .2);
    const n = Math.hypot(...v); d = v.map((c) => c / n);
    if (d[0] > -0.08 && d[2] > -0.2) d[0] = -Math.abs(d[0]) - .3;
  } else {
    const h = cur.beam > .5 ? Wd.APERTURE : Wd.APERTURE * 1.6;
    const tx = Wd.FX + (Math.random()*2-1) * h, ty = (Math.random()*2-1) * h;
    const v = [tx - F3[0], ty, Wd.COLLZ0 - F3[2]]; const n = Math.hypot(...v); d = v.map((c) => c / n);
    through = Math.abs(tx - Wd.FX) <= Wd.APERTURE && Math.abs(ty) <= Wd.APERTURE && cur.beam > .5;
  }
  if (through) len = (Wd.DET_Z - F3[2]) / d[2];
  else {
    const oz = F3[2] - Wd.ZA, a = d[1]*d[1] + d[2]*d[2], b = 2*oz*d[2], c = oz*oz - Wd.LINING*Wd.LINING;
    len = (-b + Math.sqrt(b*b - 4*a*c)) / (2*a);
    if (d[2] < -.85 && Math.abs(d[0]) < .25) len = (Wd.COLLZ1 - F3[2]) / d[2];
    if (Math.abs(d[0]) > 1e-6) len = Math.min(len, ((d[0] > 0 ? 123 : -123) - F3[0]) / d[0]);
  }
  p.d = d; p.len = len; p.t = 0; p.live = true; p.speed = 95 + Math.random()*20;
}

/* ---------- popups ---------- */
const pop = $(".pop", stage), dot = $(".pop-line", stage), tag = $(".hover-tag", stage);
let selected = null;
function select(id, from){
  selected = id;
  $$(".part", svg).forEach((g) => g.toggleAttribute("data-sel", g.dataset.part === id));
  $$(".chip").forEach((c) => c.setAttribute("aria-pressed", String(c.dataset.pick === id)));
  if (!id){ stage.removeAttribute("data-focus"); pop.hidden = true; dot.hidden = true; return; }
  stage.setAttribute("data-focus", "");
  const p = PARTS[id];
  pop.innerHTML = '<button class="x" type="button" aria-label="Close">×</button><div class="grp">' + p.group + '</div><h3>' + p.name + '</h3><p class="role">' + p.role + '</p><p>' + p.body + '</p><dl>' + p.facts.map(([a,b]) => '<dt>' + a + '</dt><dd>' + b + '</dd>').join("") + '</dl>';
  pop.hidden = false;
  $(".x", pop).addEventListener("click", () => { select(null); stage.focus(); });
  place();
  if (from === "chip" && innerWidth <= 640) pop.scrollIntoView({ block: "nearest", behavior: "smooth" });
}
function place(){
  if (!selected) return;
  const a = X.anchorPx[selected];
  const box = svg.getBoundingClientRect(), sbox = stage.getBoundingClientRect();
  const px = box.left - sbox.left + a[0] / W * box.width, py = box.top - sbox.top + a[1] / H * box.height;
  dot.hidden = false; dot.style.left = px + "px"; dot.style.top = py + "px";
  if (innerWidth <= 640){ pop.style.left = pop.style.top = ""; return; }
  const pw = pop.offsetWidth, ph = pop.offsetHeight, gap = 18;
  let left = px < sbox.width * .55 ? px + gap : px - pw - gap;
  left = Math.max(4, Math.min(sbox.width - pw - 4, left));
  let top = Math.max(4, Math.min(sbox.height - ph - 4, py - ph / 2));
  pop.style.left = left + "px"; pop.style.top = top + "px";
}
addEventListener("resize", place);
svg.addEventListener("click", (e) => { const g = e.target.closest(".part"); select(g ? (g.dataset.part === selected ? null : g.dataset.part) : null); });
svg.addEventListener("pointermove", (e) => {
  const g = e.target.closest(".part"); const sbox = stage.getBoundingClientRect();
  if (g && e.pointerType === "mouse"){ tag.textContent = PARTS[g.dataset.part].name; tag.style.left = (e.clientX - sbox.left) + "px"; tag.style.top = (e.clientY - sbox.top) + "px"; tag.setAttribute("data-on", ""); }
  else tag.removeAttribute("data-on");
});
svg.addEventListener("pointerleave", () => tag.removeAttribute("data-on"));
$$(".chip").forEach((c) => c.addEventListener("click", () => select(c.dataset.pick === selected ? null : c.dataset.pick, "chip")));
addEventListener("keydown", (e) => { if (e.key === "Escape" && selected) select(null); });

/* ---------- sequence UI ---------- */
const stTitle = $("[data-st-title]"), stBody = $("[data-st-body]"), phase = $("[data-phase]"), playBtn = $("#play");
function setStep(i, user){
  step = (i + STEPS.length) % STEPS.length; stepClock = 0;
  if (step === 0) exposed = false;
  if (step >= 4 && !exposed){ exposed = true; stored = Math.min(CAP, stored + M.hu); }
  if (step === 6) renderImage(true);
  if (step < 6) renderImage(false);
  stTitle.textContent = STEPS[step].title; stBody.textContent = STEPS[step].body;
  phase.textContent = "step " + (step + 1) + " of " + STEPS.length;
  $$("ol.steps button").forEach((b, j) => { b.toggleAttribute("aria-current", j === step); if (j === step) b.setAttribute("aria-current", "step"); b.classList.toggle("done", j < step); });
  if (user){ chosen = true; pause(); }
  kick();
}
function pause(){ playing = false; playBtn.textContent = "Play"; }
function play(){ chosen = true; playing = true; playBtn.textContent = "Pause"; if (step === STEPS.length - 1) setStep(0); kick(); }
playBtn.addEventListener("click", () => playing ? pause() : play());
$("#next").addEventListener("click", () => setStep(step + 1, true));
$("#back").addEventListener("click", () => setStep(step - 1, true));
$$("ol.steps button").forEach((b) => b.addEventListener("click", () => setStep(+b.dataset.step, true)));

/* ---------- technique ---------- */
const kv = $("#kv"), ma = $("#ma"), msI = $("#ms"), note = $("[data-note]");
const fmt = (n, d = 0) => n.toLocaleString("en-GB", { maximumFractionDigits: d, minimumFractionDigits: d });
function sci(n){ const e = Math.floor(Math.log10(n)); return (n / 10**e).toFixed(1) + "×10<sup>" + e + "</sup>"; }
function readTech(){
  tech.kv = +kv.value; tech.ms = MS[+msI.value];
  const cap = tech.focus === "small" ? 300 : 800;
  if (+ma.value > cap) ma.value = cap;
  tech.ma = +ma.value;
  note.textContent = tech.focus === "small" ? "Small focus: sharper detail, but rated to about 300 mA because the heat lands on a smaller area." : (tech.kv > 69.5 ? "Above 69.5 kVp electrons can knock out tungsten K-shell electrons, so characteristic lines appear in the spectrum." : "Below 69.5 kVp the beam is pure bremsstrahlung: no tungsten K lines.");
  $('[data-out="kv"]').textContent = tech.kv + " kV"; $('[data-out="ma"]').textContent = tech.ma + " mA"; $('[data-out="ms"]').textContent = tech.ms + " ms";
  dispKV.textContent = String(tech.kv).padStart(3, "0"); dispMA.textContent = String(tech.ma).padStart(3, "0").slice(-3); dispMS.textContent = String(tech.ms).padStart(3, "0").slice(-4);
  $$(".filament", svg).forEach((f) => f.style.opacity = f.dataset.fil === tech.focus ? 1 : .35);
  M = model(tech);
  $('[data-r="beta"]').innerHTML = fmt(M.beta * 100, 0) + "<small> % of c</small>";
  $('[data-r="emax"]').innerHTML = tech.kv + "<small> keV</small>";
  $('[data-r="power"]').innerHTML = fmt(M.power, 1) + "<small> kW</small>";
  $('[data-r="mas"]').innerHTML = fmt(M.mas, M.mas < 10 ? 1 : 0) + "<small> mAs</small>";
  $('[data-r="ne"]').innerHTML = sci(M.electrons);
  $('[data-r="eff"]').innerHTML = fmt(M.eff * 100, 2) + "<small> %</small>";
  drawSpectrum();
  if (step === 6) renderImage(true);
}
[kv, ma, msI].forEach((el) => el.addEventListener("input", readTech));
$$("[data-focus]").forEach((b) => b.addEventListener("click", () => { tech.focus = b.dataset.focus; $$("[data-focus]").forEach((x) => x.setAttribute("aria-pressed", String(x === b))); readTech(); }));

/* ---------- spectrum chart ---------- */
const spec = $(".spec");
const SX = (E) => 30 + (E / 150) * 290, SY = (v) => 140 - v * 106;
let specBins = [], specMax = 1;
function drawSpectrum(){
  specBins = M.bins; specMax = Math.max(...specBins.map((b) => b.fil), 1e-9);
  const rawMax = Math.max(...specBins.map((b) => Math.min(b.raw, specMax * 3)));
  const norm = Math.max(specMax, 1e-9);
  const yv = (v) => SY(Math.min(v / norm, 1.25));
  const line = specBins.map((b, i) => (i ? "L" : "M") + SX(b.E).toFixed(1) + " " + yv(b.fil).toFixed(1)).join("");
  const raw = specBins.map((b, i) => (i ? "L" : "M") + SX(b.E).toFixed(1) + " " + yv(b.raw).toFixed(1)).join("");
  const area = line + "L" + SX(specBins[specBins.length-1].E).toFixed(1) + " 140L" + SX(10) + " 140Z";
  let g = "";
  for (const t of [0, 25, 50, 75, 100, 125, 150]) g += '<line class="grid" x1="' + SX(t) + '" x2="' + SX(t) + '" y1="20" y2="140"/><text x="' + SX(t) + '" y="156" text-anchor="middle">' + t + '</text>';
  g += '<text x="320" y="168" text-anchor="end">photon energy, keV</text>';
  g += '<line class="ax" x1="30" x2="320" y1="140" y2="140"/>';
  g += '<clipPath id="spec-clip"><rect x="30" y="18" width="295" height="124"/></clipPath><path class="raw" clip-path="url(#spec-clip)" d="' + raw + '"/><path class="area" d="' + area + '"/><path class="line" d="' + line + '"/>';
  g += '<line class="mean" x1="' + SX(M.mean) + '" x2="' + SX(M.mean) + '" y1="24" y2="140"/><text class="lab" x="' + (SX(M.mean) + 4) + '" y="30">mean ' + M.mean.toFixed(0) + ' keV</text>';
  g += '<text class="lab" x="' + (SX(tech.kv) + 3) + '" y="134">' + tech.kv + ' kVp</text>';
  if (tech.kv > 69.5) { const pk = specBins.find((b) => b.E >= 59.3); g += '<text class="lab" x="' + (SX(59.3) + 6) + '" y="' + Math.max(16, yv(pk.fil) - 4).toFixed(1) + '">W K\u03b1</text>'; }
  g += '<g class="hov" style="display:none"><line class="cross" y1="20" y2="140"/><circle class="dot" r="4"/><text class="lab hv-t" y="14"></text></g>';
  g += '<rect x="30" y="10" width="290" height="132" fill="transparent" class="hit"/>';
  spec.innerHTML = g;
  const hov = spec.querySelector(".hov"), hit = spec.querySelector(".hit");
  hit.addEventListener("pointermove", (e) => {
    const r = spec.getBoundingClientRect(); const xv = (e.clientX - r.left) / r.width * 330; const E = (xv - 30) / 290 * 150;
    const b = specBins.reduce((best, c) => Math.abs(c.E - E) < Math.abs(best.E - E) ? c : best, specBins[0]);
    if (!b || E > tech.kv + 2 || E < 8){ hov.style.display = "none"; spec.querySelector(".mean + text").style.opacity = 1; return; }
    hov.style.display = ""; const x = SX(b.E);
    hov.querySelector(".cross").setAttribute("x1", x); hov.querySelector(".cross").setAttribute("x2", x);
    const dt = hov.querySelector(".dot"); dt.setAttribute("cx", x); dt.setAttribute("cy", yv(b.fil));
    const t = hov.querySelector(".hv-t"); t.textContent = b.E.toFixed(1) + " keV · " + Math.round(b.fil / norm * 100) + " % of peak"; t.setAttribute("x", Math.min(Math.max(x, 90), 260)); t.setAttribute("text-anchor", "middle"); spec.querySelector(".mean + text").style.opacity = 0;
  });
  hit.addEventListener("pointerleave", () => { hov.style.display = "none"; spec.querySelector(".mean + text").style.opacity = 1; });
}

/* ---------- radiograph ---------- */
const cells = $$(".wedge-img div"), labs = $$(".wedge-lab b"), imgState = $("[data-img-state]");
function renderImage(on){
  cells.forEach((c, i) => {
    if (!on){ c.style.background = "var(--rule)"; labs[i].textContent = "–"; return; }
    const T = M.steps[i];
    const L = 8 + 84 * (1 - Math.pow(T, .55));
    c.style.background = "hsl(220 6% " + L.toFixed(0) + "%)";
    labs[i].textContent = Math.round(T * 100) + " %";
  });
  imgState.textContent = on ? tech.kv + " kVp · mean " + M.mean.toFixed(0) + " keV" : "no exposure yet";
}

/* ---------- frame loop ---------- */
let frame = 0, last = 0, rot = 0, visible = true, rpm = 0, photonClock = 0;
const easeTo = (a, b, dt, tau) => a + (b - a) * (1 - Math.exp(-dt / tau));
const readout = $("[data-readout]");
const fils = $$(".filament", svg);
function tick(now){
  const dt = last ? Math.min((now - last) / 1000, 1/20) : 1/60; last = now;
  const calm = still.matches && !chosen;
  if (playing){ stepClock += dt; if (stepClock > (step === STEPS.length - 1 ? STEP_SECONDS + 2 : STEP_SECONDS)) setStep(step + 1); }
  const T = TARGET[step];
  for (const key in cur) cur[key] = calm ? T[key] : easeTo(cur[key], T[key], dt, key === "spin" ? .9 : key === "heat" && T.heat < cur.heat ? 1.8 : .35);
  stored = Math.max(0, stored - stored * dt / 240);

  stage.style.setProperty("--fil", cur.fil.toFixed(3));
  stage.style.setProperty("--heat-on", cur.heat.toFixed(3));
  stage.style.setProperty("--beam", cur.beam.toFixed(3));
  stage.style.setProperty("--emit", cur.emit.toFixed(3));
  stage.style.setProperty("--img", cur.img.toFixed(3));
  stage.toggleAttribute("data-spin", cur.spin > .05);
  stage.toggleAttribute("data-hv", T.hv > 0);

  rot += dt * cur.spin * (calm ? 0 : 2.4);
  const fA = Math.floor(((rot / (Math.PI/4)) % 1) * 12) % 12;
  if (anodeFace && anodeFace.dataset.f != fA){ anodeFace.innerHTML = X.anodeFrames[fA]; anodeFace.dataset.f = fA; }
  const fR = Math.floor(((rot / (Math.PI/12)) % 1) * 12) % 12;
  if (rotorG && rotorG.dataset.f != fR){ const rib = rotorG.querySelector("[data-ribs]"); if (rib){ rib.innerHTML = X.rotorFrames[fR]; rotorG.dataset.f = fR; } }

  const [fx, fy] = X.filament;
  cloud.forEach((c) => { c.a += dt * c.w * 2; const rr = (2.2 + c.r * 3.2) * cur.fil; c.el.setAttribute("cx", (fx + Math.cos(c.a) * rr).toFixed(2)); c.el.setAttribute("cy", (fy + Math.sin(c.a * 1.3) * rr * .8).toFixed(2)); c.el.setAttribute("opacity", (Math.max(0, cur.fil - .3) * (1 - cur.hv * .6)).toFixed(2)); });
  const [sx, sy] = X.spot;
  const speed = calm ? 0 : .55 + .5 * (tech.kv / 150);
  electrons.forEach((e) => { e.u = (e.u + dt * speed) % 1; const u = e.u * e.u; const spread = (1 - e.u) * 2.4 * e.j; e.el.setAttribute("cx", (fx + (sx - fx) * u).toFixed(2)); e.el.setAttribute("cy", (fy + (sy - fy) * u + spread).toFixed(2)); e.el.setAttribute("opacity", (cur.hv * Math.min(1, tech.ma / 300 + .3)).toFixed(2)); });

  photonClock += dt * cur.emit * (calm ? 0 : 1) * (14 + tech.ma / 25);
  for (const p of photons){
    if (!p.live){ if (photonClock >= 1){ photonClock -= 1; spawnPhoton(p); } else { p.el.setAttribute("opacity", 0); continue; } }
    p.t += dt * p.speed;
    if (p.t > p.len + 6){ p.live = false; p.el.setAttribute("opacity", 0); continue; }
    const t1 = Math.min(p.t, p.len), t0 = Math.max(0, Math.min(p.t - 6, p.len));
    const a = proj([F3[0] + p.d[0]*t0, p.d[1]*t0, F3[2] + p.d[2]*t0]), b = proj([F3[0] + p.d[0]*t1, p.d[1]*t1, F3[2] + p.d[2]*t1]);
    p.el.setAttribute("x1", a[0].toFixed(1)); p.el.setAttribute("y1", a[1].toFixed(1)); p.el.setAttribute("x2", b[0].toFixed(1)); p.el.setAttribute("y2", b[1].toFixed(1));
    p.el.setAttribute("opacity", (cur.emit * .95).toFixed(2));
  }

  rpm = 3400 * cur.spin;
  const filC = 900 + 1300 * cur.fil;
  $('[data-r="fil"]').innerHTML = fmt(filC, 0) + "<small> °C</small>";
  $('[data-r="rpm"]').innerHTML = fmt(Math.round(rpm / 10) * 10, 0) + "<small> rpm</small>";
  $('[data-r="hu"]').innerHTML = fmt(stored / 1000, 1) + "<small> kHU of 300</small>";
  $('[data-r="hubar"]').style.width = (stored / CAP * 100).toFixed(1) + "%";
  const ro = STEPS[step].title.toLowerCase() + " · " + tech.kv + " kVp";
  if (readout.textContent !== ro) readout.textContent = ro;
  fils.forEach((f) => f.style.setProperty("--fil", f.dataset.fil === tech.focus ? cur.fil : cur.fil * .2));

  const busy = playing || Object.keys(cur).some((key) => Math.abs(cur[key] - T[key]) > .002) || cur.spin > .01 || cur.emit > .01 || stored > 1;
  frame = visible && busy ? requestAnimationFrame(tick) : 0;
}
function kick(){ if (!frame && visible){ last = 0; frame = requestAnimationFrame(tick); } }
new IntersectionObserver((en) => { visible = en[en.length - 1].isIntersecting; if (visible) kick(); }).observe(stage);

const ribHost = rotorG && rotorG.querySelector(".iso-solid");
if (ribHost){ const faded = ribHost.querySelectorAll(":scope > g"); if (faded.length){ const holder = document.createElementNS(NS, "g"); holder.setAttribute("data-ribs", ""); faded[0].before(holder); faded.forEach((n) => n.remove()); holder.innerHTML = X.rotorFrames[0]; } }

readTech();
setStep(0);
if (playing) playBtn.textContent = "Pause";
renderImage(false);
})();
`;
}

writeFileSync("xray-tube.html", html);
writeFileSync("xray-tube-standalone.html", `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">${html.split("<style>")[0].replace(/<title>.*?<\/title>/, "<title>X-Ray Tube Anatomy</title>")}<style>${html.split("<style>")[1].split("</style>")[0]}</style></head><body>${html.split("</style>")[1]}</body></html>`);
console.log("wrote xray-tube.html", (html.length / 1024).toFixed(0) + " KB");
