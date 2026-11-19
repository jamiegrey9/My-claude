// Builds capintec-55tr.html: an interactive cutaway of a CRC-55tR radionuclide calibrator.
// Run: node build.mjs
import { writeFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "./kit/iso-kit.mjs";
import { WIDTH, HEIGHT, P, CH, CON, BOARDS, PANEL, SCREEN, CHAMBER_PLUG, CONSOLE_PLUG, shell, tools } from "./geometry.mjs";
import { PARTS, GROUPS, CHAIN } from "./content.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const { S, pt, line, deg } = tools;
const at = (p) => S(p);
const Sol = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const G = (part, body, extra = "") => `<g data-part="${part}"${extra}>${body}</g>`;

// ---------------- chamber ----------------
const LAYERS = [
  ["shield", CH.flange, { tone: "mid" }],
  ["shield", CH.shield, { tone: "mid" }],
  ["housing", CH.housing, { tone: "mid" }],
  ["housing", CH.base, { tone: "lo", floor: true }],
  ["electrodes", CH.outer, { tone: "mid" }],
  ["collector", CH.collector, { tone: "hi" }],
  ["guard", CH.ins1, { tone: "lo" }],
  ["guard", CH.guard, { tone: "mid" }],
  ["guard", CH.ins2, { tone: "lo" }],
  ["housing", CH.cap, { tone: "mid" }],
  ["electrodes", CH.wellFloor, { tone: "mid", floor: true }],
  ["electrodes", CH.well, { tone: "mid" }],
  ["liner", CH.linerFloor, { tone: "lo", floor: true }],
  ["liner", CH.liner, { tone: "lo" }],
  ["liner", CH.lip, { tone: "lo" }],
];
const built = LAYERS.map(([part, s, style]) => ({ part, ...shell(s, style) }));
const pass1 = built.map((b) => G(b.part, b.back)).join("");
const pass2 = [...built].reverse().map((b) => G(b.part, b.front)).join("");

// gas region on the two cut planes (hit area + home of the ion animation)
const gasOutline = (t) => [
  pt(0, t, CH.base.z1), pt(CH.outer.r0, t, CH.base.z1), pt(CH.outer.r0, t, CH.outer.z1), pt(CH.cap.r1, t, CH.outer.z1),
  pt(CH.cap.r1, t, CH.cap.z0), pt(CH.well.r1, t, CH.cap.z0), pt(CH.well.r1, t, CH.wellFloor.z0), pt(0, t, CH.wellFloor.z0),
];
const gasHit = [0, 90].map((t) => `<path class="hit" d="${tools.poly(gasOutline(t))}"/>`).join("");
const argon = G("argon", gasHit);
const gasTint = [0, 90].map((t) => `<path class="tint" d="${tools.poly(gasOutline(t))}"/>`).join("");
const ions = `<g class="gas-front" data-gas="">${gasTint}<g class="ions" data-ions=""></g></g>`;

// details on the cap and housing
function chamberDetails() {
  const out = [];
  const z = CH.cap.z1;
  const bolts = [];
  for (let t = 105; t <= 345; t += 30) bolts.push(at(pt(36.5, t, z)));
  out.push(G("housing", L(bolts.map(([x, y]) => `M${(x - 1.6).toFixed(1)} ${y.toFixed(1)}a1.6 .9 0 1 0 3.2 0a1.6 .9 0 1 0 -3.2 0`).join(""), { tone: "lo" }) + D(bolts, { size: 0.55 })));
  // shield band seams on the visible slivers
  const seam = (z0) => line(tools.arc(CH.shield.r1, 90, 135, z0)) + line(tools.arc(CH.shield.r1, 315, 360, z0));
  out.push(G("shield", L(seam(52) + seam(106), { tone: "lo" })));
  return out.join("");
}

// chamber plug: a boss on the housing above the shield, the cable drops from its foot
const PLUG = { r: 46.6, rad: 4.6, z0: 176, z1: 194 };
function chamberPlug() {
  const [x, y] = pt(PLUG.r, CHAMBER_PLUG.t, 0);
  const out = [];
  out.push(Sol(k.cylinder(x, y, PLUG.rad, PLUG.z0, PLUG.z1 - PLUG.z0, P, 28, 0.5), { tone: "mid" }));
  out.push(L(k.knurl(x, y, PLUG.rad, PLUG.z0 + 3, PLUG.z0 + 9, 22, P), { tone: "lo" }));
  out.push(Sol(k.cylinder(x, y, 2.4, PLUG.z1, 2, P, 18), { tone: "mid" }));
  out.push(D([at([x, y, PLUG.z1 + 2])], { size: 0.6, tone: "hi" }));
  return out.join("");
}

// dipper and vial (whole, not cut)
function dipper() {
  const out = [];
  const rod = [-9.5, 0];
  out.push(Sol(k.cylinder(0, 0, 10.5, 95, 3.5, P, 40, 0.5), { tone: "lo" }));
  out.push(L(k.ring(0, 0, 7.4, 98.5, P, 36), { tone: "faint" }));
  out.push(Sol(k.cylinder(rod[0], rod[1], 1.3, 98.5, 128, P, 14), { tone: "lo", crease: "none" }));
  out.push(Sol(k.slabOf({ x: -23, y: -2, w: 15, d: 4, r: 1 }, CH.lip.z1, 3, P, 3, 0.4), { tone: "mid" }));
  out.push(Sol(k.slabOf({ x: -24.5, y: -2, w: 3, d: 4, r: 0.8 }, CH.lip.z1 - 7, 7, P, 3), { tone: "mid", crease: "none" }));
  out.push(Sol(k.cylinder(rod[0], rod[1], 2.6, 226.5, 9, P, 20, 0.4), { tone: "mid" }));
  out.push(L(k.knurl(rod[0], rod[1], 2.6, 228, 234, 14, P), { tone: "lo" }));
  return out.join("");
}
function vial() {
  const out = [];
  out.push(Sol(k.cylinder(0, 0, 6.6, 98.5, 22, P, 40, 0.6), { tone: "hi", crease: "lo" }));
  out.push(L(k.sideArc(0, 0, 6.6, 111, P, 30), { tone: "mid" }));
  out.push(Sol(k.cylinder(0, 0, 3.8, 120.5, 3, P, 28), { tone: "hi", crease: "lo" }));
  out.push(Sol(k.cylinder(0, 0, 4.7, 123.5, 4, P, 28, 0.4), { tone: "mid" }));
  out.push(L(k.ring(0, 0, 2.2, 127.5, P, 20), { tone: "lo" }));
  return out.join("");
}

// ---------------- readout ----------------
const C = CON.plan;
const FL = 2; // tray floor bottom
const FZ = 5; // tray floor top
const WZ = 25; // wall top
function consoleBack() {
  const out = [];
  out.push(`<path class="iso-halo" d="${k.haloOf(C, 0, 1, P)}"/>`);
  const feet = k.corners(C, 9).sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
  for (const [x, y] of feet) out.push(Sol(k.cylinder(x, y, 5, 0, FL, P, 22), { tone: "lo" }));
  out.push(Sol(k.slabOf(C, FL, FZ - FL, P, 4, 0.6), { tone: "lo" }));
  out.push(Sol(k.slabOf({ x: C.x, y: C.y, w: C.w, d: CON.wall, r: 1 }, FZ, WZ - FZ, P, 3, 0.4), { tone: "mid" }));
  out.push(Sol(k.slabOf({ x: C.x, y: C.y, w: CON.wall, d: C.d, r: 1 }, FZ, WZ - FZ, P, 3, 0.4), { tone: "mid" }));
  // motherboard strip on the floor
  out.push(Sol(k.slabOf({ x: C.x + 8, y: C.y + 24, w: C.w - 22, d: 52, r: 1 }, FZ, 1, P, 3), { tone: "lo", crease: "none" }));
  return out.join("");
}

function panel() {
  const out = [];
  const plan = { x: PANEL.x0, y: PANEL.y0, w: PANEL.x1 - PANEL.x0, d: PANEL.y1 - PANEL.y0, r: 2 };
  out.push(Sol(k.slabOf(plan, FZ, PANEL.z1 - FZ, P, 4, 0.8), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(plan, 2.4), PANEL.z1, P, 3), { tone: "faint" }));
  // the screen, drawn in the plane of the panel face (local x, −z)
  const M = k.sideMatrix([0, PANEL.y1], 0, P, "left");
  const sx = SCREEN.x0, sw = SCREEN.x1 - SCREEN.x0, sy = -SCREEN.z1, sh = SCREEN.z1 - SCREEN.z0;
  const cx = sx + sw / 2;
  out.push(`<g transform="${M}">
    <rect class="scr-bezel" x="${sx - 2.5}" y="${sy - 2.5}" width="${sw + 5}" height="${sh + 5}" rx="2"/>
    <rect class="scr" x="${sx}" y="${sy}" width="${sw}" height="${sh}" rx="1"/>
    <g class="scr-ink">
      <text x="${sx + 4}" y="${sy + 8}" font-size="5">Tc-99m</text>
      <text x="${sx + sw - 4}" y="${sy + 8}" font-size="4" text-anchor="end" class="scr-dim">Vial · 10 mL</text>
      <line x1="${sx + 3}" y1="${sy + 11}" x2="${sx + sw - 3}" y2="${sy + 11}"/>
      <text x="${cx + 18}" y="${sy + 29}" font-size="15" text-anchor="end" data-reading="">742.6</text>
      <text x="${cx + 21}" y="${sy + 29}" font-size="6">MBq</text>
      <text x="${cx + 21}" y="${sy + 21}" font-size="3.6" class="scr-dim">20.07 mCi</text>
      ${["Tc", "F-18", "I-131", "Ga-68", "Lu-177"].map((n, i) => `<rect x="${sx + 4 + i * ((sw - 8) / 5)}" y="${sy + sh - 11}" width="${(sw - 8) / 5 - 2}" height="7.5" rx="1" class="${i === 0 ? "scr-key on" : "scr-key"}"/><text x="${sx + 4 + i * ((sw - 8) / 5) + ((sw - 8) / 5 - 2) / 2}" y="${sy + sh - 5.6}" font-size="3.4" text-anchor="middle">${n}</text>`).join("")}
    </g>
  </g>`);
  // power button and status LED below the screen
  out.push(L(k.sideRing([PANEL.x1 - 10, PANEL.y1, 63], 2.2, "y", P), { tone: "mid" }));
  out.push(D([at([PANEL.x1 - 18, PANEL.y1, 63])], { size: 0.9, tone: "hi" }));
  return out.join("");
}

function board(b) {
  const out = [];
  const t = 1.6;
  out.push(Sol(k.slabOf({ x: b.x0 + 4, y: b.y - 1.5, w: b.x1 - b.x0 - 8, d: t + 3, r: 0.6 }, FZ + 1, 5, P, 2, 0.3), { tone: "mid" }));
  out.push(Sol(k.slabOf({ x: b.x0, y: b.y, w: b.x1 - b.x0, d: t, r: 0.4 }, FZ + 3, b.h, P, 2), { tone: "lo" }));
  const face = b.y + t;
  const top = FZ + 3 + b.h;
  // board-edge screws
  out.push(D([at([b.x0 + 3, face, top - 3]), at([b.x1 - 3, face, top - 3])], { size: 0.55 }));
  const box = (x, w, d, z0, h, tone = "mid", lit = false) => Sol(k.slabOf({ x, y: face, w, d, r: 0.5 }, z0, h, P, 2, 0.3), { tone, lit });
  const L0 = b.x0;
  // rows of solder pads and a few traces along the top edge of every board
  const pads = [];
  for (let x = b.x0 + 6; x < b.x1 - 4; x += 3) pads.push(at([x, face, top - 4]));
  out.push(D(pads, { size: 0.35, tone: "mid" }));
  out.push(L(k.segment([b.x0 + 4, face, top - 6], [b.x1 - 4, face, top - 6], P), { tone: "faint" }));
  if (b.part === "bias") {
    out.push(box(L0 + 8, 18, 7, top - 26, 18)); // transformer
    out.push(L(k.sideTicks(L0 + 9.5, L0 + 24.5, 2.5, 99, face + 7, top - 9, [3, 3], P, "x").minor, { tone: "lo" }));
    out.push(box(L0 + 32, 30, 5, top - 22, 14)); // DC-DC converter module
    out.push(k.faceTextSvg(k.sideMatrix([L0 + 34, face + 5], top - 13, P, "left"), "HV", { size: 4, tone: "lo" }));
    for (let i = 0; i < 4; i++) out.push(box(L0 + 68 + i * 6, 4, 4, top - 18, 10, "mid")); // capacitors
  }
  if (b.part === "electrometer") {
    out.push(box(L0 + 6, 9, 3, top - 16, 8, "lo")); // triax input
    out.push(box(L0 + 22, 36, 8, top - 30, 24, "mid")); // screening can
    out.push(L(k.sideTicks(L0 + 24, L0 + 56, 4, 99, face + 8, top - 6.5, [0.01, 0.01], P, "x").minor, { tone: "faint" }));
    for (let i = 0; i < 3; i++) out.push(box(L0 + 64 + i * 9, 7, 5, top - 18, 9, "mid")); // range relays
  }
  if (b.part === "adc") {
    out.push(box(L0 + 8, 14, 2.5, top - 18, 10, "lo"));
    out.push(box(L0 + 28, 22, 3, top - 22, 15, "mid")); // processor
    out.push(box(L0 + 56, 12, 2.5, top - 17, 9, "lo"));
    out.push(box(L0 + 74, 8, 2.5, top - 15, 6, "lo"));
  }
  return out.join("");
}

function consoleFront() {
  const out = [];
  out.push(Sol(k.slabOf({ x: C.x, y: C.y + C.d - CON.wall, w: C.w, d: CON.wall, r: 1 }, FZ, WZ - FZ, P, 3, 0.4), { tone: "mid" }));
  out.push(Sol(k.slabOf({ x: C.x + C.w - CON.wall, y: C.y, w: CON.wall, d: C.d, r: 1 }, FZ, WZ - FZ, P, 3, 0.4), { tone: "mid" }));
  out.push(D(k.corners({ x: C.x, y: C.y, w: C.w, d: C.d }, 1.3).map(([x, y]) => at([x, y, WZ])), { size: 0.55 }));
  // engraved label on the front wall
  out.push(k.faceTextSvg(k.sideMatrix([C.x + C.w - 34, C.y + C.d], 12.5, P, "left"), "CRC-55tR", { size: 4, tone: "mid" }));
  return out.join("");
}

function consolePlug() {
  const [x, y, z] = CONSOLE_PLUG;
  const out = [];
  out.push(Sol(k.slabOf({ x: x - 7, y, w: 14, d: 3, r: 1 }, z - 6, 12, P, 3, 0.4), { tone: "mid" }));
  out.push(L(k.sideRing([x, y + 3, z], 3.6, "y", P, 28), { tone: "mid" }));
  out.push(D([at([x, y + 3, z])], { size: 0.8, tone: "hi" }));
  return out.join("");
}

// cable: from the chamber plug down past the shield, across the floor, into the readout
const [px, py] = pt(PLUG.r, CHAMBER_PLUG.t, 0);
const outward = [Math.cos(deg(CHAMBER_PLUG.t)), Math.sin(deg(CHAMBER_PLUG.t))];
const drop = [px + outward[0] * 3.2, py + outward[1] * 3.2];
const CABLE = [
  [drop[0], drop[1], PLUG.z0],
  [drop[0], drop[1], 30],
  [drop[0] + outward[0] * 10, drop[1] + outward[1] * 10, 6],
  [drop[0] + outward[0] * 18, drop[1] + outward[1] * 18, 1.6],
  [CONSOLE_PLUG[0], CONSOLE_PLUG[1] + 34, 1.6],
  [CONSOLE_PLUG[0], CONSOLE_PLUG[1] + 12, 4],
  [CONSOLE_PLUG[0], CONSOLE_PLUG[1] + 3, CONSOLE_PLUG[2]],
];
function smooth(points, r = 6) {
  // round each corner with a short quadratic in 3D, sampled
  const out = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    const [a, b, c] = [points[i - 1], points[i], points[i + 1]];
    const len = (u, v) => Math.hypot(u[0] - v[0], u[1] - v[1], u[2] - v[2]);
    const ra = Math.min(r, len(a, b) / 2), rc = Math.min(r, len(b, c) / 2);
    const p0 = b.map((v, j) => v + ((a[j] - v) * ra) / len(a, b));
    const p2 = b.map((v, j) => v + ((c[j] - v) * rc) / len(b, c));
    for (let s = 0; s <= 8; s++) {
      const t = s / 8;
      out.push(p0.map((v, j) => (1 - t) ** 2 * v + 2 * (1 - t) * t * b[j] + t * t * p2[j]));
    }
  }
  out.push(points[points.length - 1]);
  return out;
}
const cablePts = smooth(CABLE);
const cableD = line(cablePts);
const cable = G(
  "cable",
  `<path class="cable-o" d="${cableD}"/><path class="cable-i" d="${cableD}"/><path class="cable-flow" d="${cableD}"/>` + chamberPlug() + consolePlug(),
);

// ---------------- assemble ----------------
const halo = `<path class="iso-halo" d="${k.haloOf({ x: -56, y: -56, w: 112, d: 112, r: 56 }, 0, 1, P)}"/>`;
const boards = BOARDS.map((b) => G(b.part, board(b))).join("");
const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "Cutaway of a CRC-55tR radionuclide calibrator. Left: the well-type ionisation chamber with a quarter cut away to show the lead shield, pressure housing, outer electrode, argon gas, collecting electrode, insulators and guard ring, the well with its liner, and a vial hanging in the source holder. Right: the readout with its cover removed, showing the bias supply, electrometer and processor boards in front of the touchscreen, joined to the chamber by the signal cable.",
  body: [
    halo,
    `<g class="readout">${consoleBack()}${G("display", panel())}${boards}${consoleFront()}</g>`,
    `<g class="chamber">${pass1}${argon}${pass2}${ions}${chamberDetails()}${G("dipper", dipper())}${G("vial", vial())}</g>`,
    cable,
  ],
});

// ---------------- page ----------------
const ISO_CSS = k.ISO_CSS;
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const listHtml = GROUPS.map(
  (g) => `<div class="grp"><h3>${g.title}</h3><ul>${g.parts.map((id) => `<li><button type="button" id="pick-${id}" data-pick="${id}">${esc(PARTS[id].name)}</button></li>`).join("")}</ul></div>`,
).join("");
const chainHtml = `<ol class="chain" aria-label="Signal chain">${CHAIN.map((c) => `<li data-step="${c.id}"><b>${esc(c.label)}</b><span>${esc(c.sub)}</span></li>`).join("")}</ol>`;

const plate = k.plateHtml({
  fig: "Fig 1",
  title: "CRC-55tR · cutaway",
  hint: "Tap a part to explain it",
  readout: "Collecting electrode",
  body: `<div class="iso-stage" data-stage="">${svg}</div>`,
});

const LIVE = readFileSync(join(HERE, "live.js"), "utf8")
  .replace("__PARTS__", JSON.stringify(PARTS))
  .replace("__CHAIN__", JSON.stringify(CHAIN.map((c) => c.id)))
  .replace("__P__", JSON.stringify(P))
  .replace("__GAS__", JSON.stringify({ base: CH.base.z1, outer: CH.outer.r0, top: CH.outer.z1, wellR: CH.well.r1, wellZ: CH.wellFloor.z0, cr0: CH.collector.r0, cr1: CH.collector.r1, cz0: CH.collector.z0, cz1: CH.collector.z1, capZ: CH.cap.z0 }));

const PAGE_CSS = readFileSync(join(HERE, "page.css"), "utf8");

const html = `<title>CRC-55tR Anatomy</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&family=Space+Grotesk:wght@500;600&display=swap">
<style>${ISO_CSS}
${PAGE_CSS}</style>
<div class="iso page" id="app" data-theme="light">
  <header class="head">
    <p class="eyebrow">Nuclear medicine · radionuclide calibrator</p>
    <h1>Inside the CRC-55tR</h1>
    <p class="lede">A well-type ionisation chamber and its readout, cut open. Pick any part to see what it does and how the measurement electronics turn a few ions into an activity in MBq.</p>
  </header>
  ${plate}
  <section class="explore">
    <nav class="parts" aria-label="Components">${listHtml}</nav>
    <article class="info" aria-live="polite">
      ${chainHtml}
      <p class="tag" data-info="tag"></p>
      <h2 data-info="name"></h2>
      <h4>What it does</h4>
      <p data-info="what"></p>
      <h4 data-info="how-h">How it works</h4>
      <p data-info="how"></p>
      <h4>In practice</h4>
      <p data-info="practice"></p>
    </article>
  </section>
  <footer class="notes">
    <p>Schematic, not a service drawing. The chamber proportions follow the published CRC-55tR figures: about 17 cm across and 44 cm tall, with a 6.1 cm × 25.4 cm well and a 12 atm ultra-pure argon fill. The electrode layout, board arrangement and screen contents are simplified illustrations. Ion drift is slowed by many orders of magnitude so you can see it, and the screen reading is an example. For a specific unit, check the Mirion/Capintec owner's manual.</p>
    <button type="button" class="theme" data-theme-toggle="">Switch theme</button>
  </footer>
</div>
<script type="module">${LIVE}</script>
`;
writeFileSync(join(HERE, "capintec-55tr.html"), html);
console.log("wrote capintec-55tr.html", (html.length / 1024).toFixed(0) + " KB");
