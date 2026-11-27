import * as k from "./kit/iso-kit.mjs";
import * as G from "./kit/lathe.mjs";
import { tubePieces, tubeSvg } from "./kit/tube.mjs";
import { cutLathe, cutFrame } from "../skills/equipment-simulator/assets/engine/section.mjs";

// World units are millimetres. z = 0 is the bench top.
export const WIDTH = 640;
export const HEIGHT = 470;
export const PLATE = { x: -205, y: -118, w: 530, d: 228, r: 8 };
export const METER = { x: -192, y: -80, w: 250, d: 85, r: 6 };
export const MZ = 112;
export const FACE_Y = METER.y + METER.d;
export const TRAY = { x: 108, y: -74, w: 192, d: 152, r: 5 };
export const PAPER_Z = 2;
export const PX = 204, PY = -2;
export const H0 = 10;
export const HEIGHTS = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50];
export const BLOTS = [[204, -2, 17, 13, 0.3], [188, 11, 9, 7, 1.1], [221, -15, 7, 5, 0.6], [232, 8, 4, 3, 0.2]];
export const SOCKET = [METER.x + METER.w, -36, 44];
export const S = { win: 0.35, xtal0: 0.7, xtal1: 3.2, ow1: 5.4, pc: 6.4, dyn0: 19, dynStep: 6.2, anode: 82, base0: 96, base1: 103, pcb0: 108, pcb1: 150, rear: 172, conn1: 196 };
export const DYNODES = Array.from({ length: 10 }, (_, i) => ({ s: S.dyn0 + i * S.dynStep, side: i % 2 ? 1 : -1 }));

export const P = k.fitProjection(
  [...k.boxCorners(PLATE, -17, 0), [PX, PY, PAPER_Z + 50 + 230], [METER.x, METER.y, 162], [METER.x + METER.w, METER.y, 162]],
  WIDTH,
  HEIGHT,
  { pad: 16, azimuth: 40, elevation: 26 },
);
export const V = G.viewOf(P);
export const at = (p) => k.iso(p, P);
export const depth = (p) => G.dot3(p, V);
const Sd = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const poly = (pts) => k.pathOf(pts.map(at), true);
const f1 = (n) => n.toFixed(1);

export const PF = cutFrame([PX, PY, PAPER_Z + H0], [0, 0, 1], P);
export const VERT = (x, y, z = 0) => G.frameOf([x, y, z], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
const AXF = VERT(PX, PY, PAPER_Z + H0);
export const inPlane = (u, s, v = 0) => G.add3(G.add3(PF.o, G.mul3(PF.a, s)), G.add3(G.mul3(PF.u, u), G.mul3(PF.v, v)));

function fbox(F, u0, u1, s0, s1, v0, v1, tone = "mid", cls = "") {
  const c = (u, s, v) => G.add3(G.add3(F.o, G.mul3(F.a, s)), G.add3(G.mul3(F.u, u), G.mul3(F.v, v)));
  const faces = [
    [[u0, s0, v0], [u1, s0, v0], [u1, s1, v0], [u0, s1, v0]], [[u0, s0, v1], [u0, s1, v1], [u1, s1, v1], [u1, s0, v1]],
    [[u0, s0, v0], [u0, s1, v0], [u0, s1, v1], [u0, s0, v1]], [[u1, s0, v0], [u1, s0, v1], [u1, s1, v1], [u1, s1, v0]],
    [[u0, s0, v0], [u0, s0, v1], [u1, s0, v1], [u1, s0, v0]], [[u0, s1, v0], [u1, s1, v0], [u1, s1, v1], [u0, s1, v1]],
  ].map((q) => q.map(([u, s, v]) => c(u, s, v)));
  const center = c((u0 + u1) / 2, (s0 + s1) / 2, (v0 + v1) / 2);
  const out = [];
  for (const q of faces) {
    const n = G.cross3(G.sub3(q[1], q[0]), G.sub3(q[3], q[0]));
    const mid = q.reduce((m, p) => G.add3(m, G.mul3(p, 0.25)), [0, 0, 0]);
    const outward = G.dot3(n, G.sub3(mid, center)) >= 0 ? n : G.mul3(n, -1);
    if (G.dot3(outward, V) <= 0) continue;
    out.push(`<path class="cf ${cls}" data-shade="${G.toneOf(outward, P)}" d="${poly(q)}"/>`);
  }
  const hull = G.hullOf(faces.flat().map(at));
  return `<g class="iso-solid">${out.join("")}<path class="iso-line iso-edge" data-tone="${tone}" d="${k.pathOf(hull, true)}"/></g>`;
}

const part = (id, html, extra = "") => `<g class="part" data-part="${id}"${extra}>${html}</g>`;
const probePart = (id, html) => part(id, html, ` data-move="probe"`);

function plate() {
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -17, 12, P)}"/>`];
  for (const [x, y] of k.corners(PLATE, 22).sort((a, b) => depth([...a, 0]) - depth([...b, 0]))) {
    out.push(Sd(k.cylinder(x, y, 7, -17, 1.6, P, 28), { tone: "lo" }));
    out.push(Sd(k.cylinder(x, y, 5.4, -15.4, 3.4, P, 28), { tone: "mid" }));
  }
  out.push(Sd(k.slabOf(PLATE, -12, 12, P, 8, 1.6), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(PLATE, 5), 0, P), { tone: "lo" }));
  const screws = k.corners(PLATE, 10);
  out.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  const strip = { x: -180, y: PLATE.y + PLATE.d - 14, w: 200, d: 7, r: 1 };
  out.push(Sd(k.slabOf(strip, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(strip.x + 4, strip.x + strip.w - 4, 5, 2, strip.y + 0.8, 0.6, [2, 3.6], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  return out.join("");
}

function meterCase() {
  const out = [`<path class="iso-halo" d="${k.haloOf(METER, 0, 6, P)}" style="filter:blur(6px)"/>`];
  for (const [x, y] of k.corners(METER, 14)) out.push(Sd(k.cylinder(x, y, 5, -0.5, 2, P, 20), { tone: "lo" }));
  out.push(Sd(k.slabOf(METER, 1.5, MZ - 1.5, P, 6, 1.2), { tone: "mid", inner: L(k.sideSeam(METER, 14, P, 6) + k.sideSeam(METER, MZ - 12, P, 6), { tone: "faint" }) }));
  const lid = k.insetPlan(METER, 4);
  out.push(L(k.planOutline(lid, MZ, P, 4), { tone: "lo" }));
  out.push(D(k.corners(lid, 5).map(([x, y]) => at([x, y, MZ])), { size: 0.5 }));
  for (const x of [METER.x + 30, METER.x + METER.w - 40]) out.push(Sd(k.slabOf({ x, y: -52, w: 10, d: 22, r: 2 }, MZ, 36, P, 3, 0.5), { tone: "mid" }));
  out.push(Sd(k.slabOf({ x: METER.x + 26, y: -50, w: METER.w - 56, d: 18, r: 8 }, MZ + 34, 12, P, 6, 0.8), { tone: "mid", inner: L(k.sideSeam({ x: METER.x + 26, y: -50, w: METER.w - 56, d: 18, r: 8 }, MZ + 40, P, 6), { tone: "faint" }) }));
  const plateL = { x: METER.x + 150, y: FACE_Y, w: 52, d: 0.8, r: 0.4 };
  out.push(Sd(k.slabOf(plateL, 14, 12, P, 2), { tone: "mid", crease: "none" }));
  const rule = (z, x1) => k.segment([plateL.x + 4, FACE_Y + 0.85, z], [x1, FACE_Y + 0.85, z], P);
  out.push(L(rule(22, plateL.x + 40) + rule(19, plateL.x + 30) + rule(16.5, plateL.x + 46), { tone: "lo", free: true }));
  return out.join("");
}

export const LCD = { x0: -176, x1: -66, z0: 62, z1: 100 };
function display() {
  const out = [];
  out.push(Sd(k.slabOf({ x: LCD.x0 - 5, y: FACE_Y, w: LCD.x1 - LCD.x0 + 10, d: 1.6, r: 2 }, LCD.z0 - 5, LCD.z1 - LCD.z0 + 10, P, 3, 0.4), { tone: "mid" }));
  const y = FACE_Y + 1.65;
  out.push(`<path class="lcd" d="${poly([[LCD.x0, y, LCD.z0], [LCD.x1, y, LCD.z0], [LCD.x1, y, LCD.z1], [LCD.x0, y, LCD.z1]])}"/>`);
  out.push(`<g class="lcd-ink">${k.faceTextSvg(k.sideMatrix([LCD.x1 - 20, y + 0.05], LCD.z1 - 7, P, "left"), "0", { size: 20, tone: "hi", anchor: "end" }).replace("<text ", '<text data-lcd="rate" ')}`);
  out.push(k.faceTextSvg(k.sideMatrix([LCD.x1 - 17, y + 0.05], LCD.z1 - 13, P, "left"), "cps", { size: 5, tone: "hi" }).replace("<text ", '<text data-lcd="unit" '));
  const n = 20, gx0 = LCD.x0 + 5, gx1 = LCD.x1 - 5, w = (gx1 - gx0) / n;
  for (let i = 0; i < n; i++) {
    const x = gx0 + i * w;
    out.push(`<path data-seg="${i}" d="${poly([[x + 0.6, y + 0.05, LCD.z0 + 4], [x + w - 0.6, y + 0.05, LCD.z0 + 4], [x + w - 0.6, y + 0.05, LCD.z0 + 4 + 2.5 + i * 0.18], [x + 0.6, y + 0.05, LCD.z0 + 4 + 2.5 + i * 0.18]])}"/>`);
  }
  out.push(`</g>`);
  return out.join("");
}

function keypad() {
  const out = [];
  [-170, -150, -130, -110].forEach((x, i) => {
    out.push(Sd(k.slabOf({ x, y: FACE_Y, w: 14, d: 2.2, r: 1.5 }, 30, 10, P, 3, 0.4), { tone: i === 0 ? "hi" : "mid" }));
  });
  return out.join("");
}

export const SPEAKER = [-40, FACE_Y + 0.2, 72];
function speaker() {
  const pts = [];
  for (let i = 0; i < 7; i++) for (let j = 0; j < 7; j++) {
    const dx = (i - 3) * 4.2, dz = (j - 3) * 4.2;
    if (Math.hypot(dx, dz) <= 13.5) pts.push(at([SPEAKER[0] + dx, SPEAKER[1], SPEAKER[2] + dz]));
  }
  const ring = Array.from({ length: 49 }, (_, i) => at([SPEAKER[0] + Math.cos((i / 48) * 6.283) * 16, SPEAKER[1], SPEAKER[2] + Math.sin((i / 48) * 6.283) * 16]));
  return `<path class="iso-line" data-tone="lo" d="${k.pathOf(ring, true)}"/>` + D(pts, { size: 0.75, tone: "mid" });
}

const SOCKF = G.frameOf(SOCKET, [1, 0, 0], [0, 0, 1], [0, 1, 0]);
function socket() {
  return Sd(G.disc(0, 5, 9, SOCKF, P), { tone: "mid" }) + Sd(G.disc(5, 13, 7, SOCKF, P), { tone: "hi" });
}

export function cableRoute(h) {
  const z0 = PAPER_Z + h;
  const top = z0 + S.conn1;
  return [[SOCKET[0] + 13, SOCKET[1], SOCKET[2]], [SOCKET[0] + 34, SOCKET[1], SOCKET[2]], [118, -48, top - 40], [PX, -48, top + 18], [PX, PY, top + 18], [PX, PY, top]];
}
function cable(h) {
  const pts = G.fillet(cableRoute(h), 14, 8, { P, tube: 2.6 });
  return tubePieces(pts, 2.6, P, { maxLength: 22 }).sort((a, b) => depth(a.mid) - depth(b.mid)).map((p) => tubeSvg(p, { tone: "mid" })).join("");
}
export function cablePath(h) {
  return G.resample(G.fillet(cableRoute(h), 14, 8, { P, tube: 2.6 }), 3).reverse().map(at).map(([x, y]) => [+x.toFixed(1), +y.toFixed(1)]);
}

function tray() {
  const out = [];
  out.push(`<path class="iso-halo" d="${k.haloOf(TRAY, 0, 2, P)}" style="filter:blur(5px)"/>`);
  out.push(Sd(k.slabOf(TRAY, 0, 1.5, P, 5, 0.4), { tone: "lo" }));
  out.push(Sd(k.slabOf(k.insetPlan(TRAY, 3), 1.5, 0.5, P, 4), { tone: "hi", crease: "none" }));
  const t = 2.2, hgt = 7;
  const walls = [
    { x: TRAY.x, y: TRAY.y, w: TRAY.w, d: t, r: 1 }, { x: TRAY.x, y: TRAY.y, w: t, d: TRAY.d, r: 1 },
  ];
  for (const w of walls) out.push(Sd(k.slabOf(w, 1.5, hgt, P, 2, 0.3), { tone: "mid" }));
  return out.join("");
}
function trayFront() {
  const t = 2.2, hgt = 7;
  return [{ x: TRAY.x + TRAY.w - t, y: TRAY.y, w: t, d: TRAY.d, r: 1 }, { x: TRAY.x, y: TRAY.y + TRAY.d - t, w: TRAY.w, d: t, r: 1 }]
    .map((w) => Sd(k.slabOf(w, 1.5, hgt, P, 2, 0.3), { tone: "mid" })).join("");
}

function ellipse(cx, cy, rx, ry, rot, z, n = 40) {
  return Array.from({ length: n }, (_, i) => { const a = (i / n) * 6.283; const x = Math.cos(a) * rx, y = Math.sin(a) * ry; return [cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot), z]; });
}
function spill() {
  return BLOTS.map(([cx, cy, rx, ry, rot]) => `<path class="spill" d="${poly(ellipse(cx, cy, rx, ry, rot, PAPER_Z + 0.05))}"/><path class="iso-line spill-edge" data-tone="lo" d="${poly(ellipse(cx, cy, rx, ry, rot, PAPER_Z + 0.05))}"/>`).join("");
}

export const VIALF = G.frameOf([248, 34, PAPER_Z + 6.5], G.unit3([-1, -0.45, 0]), [0, 0, 1], G.unit3([0.45, -1, 0]));
function vial() {
  const out = [];
  out.push(Sd(G.disc(-6, 0, 6.5, VIALF, P), { tone: "lo" }));
  out.push(`<g class="glassy">${Sd(G.solidOf([[0, 4.2], [3, 4.2], [5, 6, 1], [24, 6], [26, 5, 1]], VIALF, P), { tone: "mid" })}</g>`);
  return out.join("");
}

function housing() {
  const sec = [[0, 17.2], [0, 25], [8, 25], [8.6, 24.5], [159.4, 24.5], [160, 25], [172, 25], [172, 8.5], [170.8, 8.5], [170.8, 23.3], [1.2, 23.3], [1.2, 17.2]];
  return cutLathe([{ section: sec, cut: "cut-al", edge: "hi" }], PF, P, { steps: 56 });
}
function leadShield() {
  return cutLathe([{ section: [[1.2, 18.5], [1.2, 21.6], [30, 21.6], [30, 18.5]], cut: "cut-pb", edge: "mid" }], PF, P, { steps: 48 });
}
function muShield() {
  return cutLathe([{ section: [[6, 15.2], [6, 16], [100, 16], [100, 15.2]], cut: "cut-mu", edge: "mid" }], PF, P, { steps: 48 });
}
const PMT_SEC = [[5.4, 0], [5.4, 13.6], [6.2, 14.3], [92, 14.3], [95, 12.5], [96, 9], [96, 0], [95.2, 0], [95.2, 8.6], [94.2, 12], [91.6, 13.5], [6.6, 13.5], [6.2, 12.9], [6.2, 0]];
function pmtGlass() {
  return cutLathe([{ section: PMT_SEC, cls: "glass", cut: "cut-glass", edge: "mid" }], PF, P, { steps: 48 });
}

function crystal() {
  return Sd(G.ringBand(S.xtal0 - 0.2, S.xtal1 + 0.2, 16, 17, AXF, P), { tone: "mid" }) + `<g class="xtal">${Sd(G.disc(S.xtal0, S.xtal1, 16, AXF, P), { tone: "hi" })}</g>`;
}
function opticalWindow() {
  return `<g class="glassy">${Sd(G.disc(S.xtal1 + 0.2, S.ow1, 16, AXF, P), { tone: "mid" })}</g>`;
}
function windowFoil() {
  return Sd(G.disc(0.02, S.win, 17.2, AXF, P), { tone: "mid" });
}
function photocathode() {
  return `<g class="pc">${Sd(G.disc(6.2, S.pc, 12.8, AXF, P), { tone: "lo" })}</g>`;
}
export function dynodeQuad(d) {
  const { s, side } = d;
  return [[side * 1.2, s + 2], [side * 8, s - 1.2], [side * 8, s - 2], [side * 1.2, s + 1.2]];
}
function dynodes() {
  const out = [];
  for (const d of DYNODES) {
    const q = dynodeQuad(d).map(([u, s2]) => inPlane(u, s2));
    out.push(`<path class="dyn" d="${poly(q)}"/><path class="iso-line" data-tone="hi" d="${poly(q)}"/>`);
  }
  const an = [[-3, S.anode], [3, S.anode], [3, S.anode + 0.8], [-3, S.anode + 0.8]].map(([u, s2]) => inPlane(u, s2));
  out.push(`<path class="dyn" d="${poly(an)}"/><path class="iso-line" data-tone="hi" d="${poly(an)}"/>`);
  const leads = [];
  for (const d of DYNODES) leads.push(k.pathOf([at(inPlane(d.side * 8, d.s - 1.6)), at(inPlane(d.side * 11.5, d.s - 1.6)), at(inPlane(d.side * 11.5, S.base0 - 0.4))]));
  out.push(`<path class="iso-line" data-tone="faint" data-free="end" d="${leads.join("")}"/>`);
  out.push(Sd(G.disc(S.base0, S.base1, 13, AXF, P), { tone: "lo" }));
  const pins = [-9, -5, -1, 3, 7].map((u) => k.pathOf([at(inPlane(u, S.base1)), at(inPlane(u, S.base1 + 4))])).join("");
  out.push(L(pins, { tone: "mid", free: true }));
  return out.join("");
}
function divider() {
  const out = [fbox(PF, -13, 13, S.pcb0, S.pcb1, 0.6, 2.2, "mid", "pcb")];
  for (let i = 0; i < 10; i++) {
    const s2 = S.pcb0 + 4 + i * 3.8;
    out.push(fbox(PF, -5, 5, s2 - 0.9, s2 + 0.9, -1.2, 0.6, "lo", "res"));
  }
  out.push(fbox(PF, 6, 11, S.pcb1 - 12, S.pcb1 - 4, -2.4, 0.6, "lo", "cap"));
  return out.join("");
}
function connector() {
  return Sd(G.disc(S.rear, S.rear + 12, 8, AXF, P), { tone: "mid" }) + Sd(G.disc(S.rear + 12, S.conn1, 6.8, AXF, P), { tone: "hi", inner: k.fadedSvg(G.ribsOf(AXF, S.rear + 12.4, S.conn1 - 0.4, 6.8, 22, P, { fade: [0.05, 0.4] }), { tone: "lo" }) });
}

export function build() {
  const HS = housing(), PB = leadShield(), MU = muShield(), GL = pmtGlass();
  const cables = HEIGHTS.map((h) => `<g data-h="${h}"${h === H0 ? "" : ' style="display:none"'}>${cable(h)}</g>`).join("");
  const body = [
    plate(),
    part("meter", meterCase()),
    part("display", display()),
    part("keypad", keypad()),
    part("speaker", speaker()),
    `<g class="fx fx-meter"></g>`,
    part("tray", tray()),
    part("spill", `<g class="spill-g">${spill()}</g>`),
    part("vial", vial()),
    part("tray", trayFront()),
    part("cable", socket() + cables),
    probePart("housing", HS.body),
    probePart("lead", PB.body),
    probePart("magnetic-shield", MU.body),
    probePart("pmt", GL.body),
    probePart("divider", divider()),
    probePart("housing", HS.sect),
    probePart("lead", PB.sect),
    probePart("magnetic-shield", MU.sect),
    probePart("pmt", GL.sect),
    probePart("window", windowFoil()),
    probePart("crystal", crystal()),
    probePart("optical-window", opticalWindow()),
    probePart("photocathode", photocathode()),
    probePart("dynodes", dynodes()),
    probePart("housing", connector()),
    `<g class="fx fx-gamma"></g><g class="fx fx-in"></g><g class="fx fx-cable"></g>`,
  ];
  return k.figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label: "A scintillation contamination monitor on a bench: a ratemeter with a digital display, connected by cable to a hand probe held over a spill tray. The probe is drawn in half section, showing its aluminium window, thin sodium-iodide crystal, lead shield, photomultiplier tube with dynodes, and voltage divider.",
    body: [`<g class="cam">`, ...body, `</g>`],
  });
}

export function extras() {
  const O = at([0, 0, 0]);
  const vec = (p) => { const q = at(p); return [q[0] - O[0], q[1] - O[1]]; };
  const anchors = {
    meter: [METER.x + 20, METER.y + 20, MZ], display: [(LCD.x0 + LCD.x1) / 2, FACE_Y, LCD.z1], keypad: [-140, FACE_Y, 40], speaker: [SPEAKER[0], FACE_Y, SPEAKER[2] + 16],
    tray: [TRAY.x + 10, TRAY.y + TRAY.d, 7], spill: [BLOTS[0][0] + 10, BLOTS[0][1] + 14, PAPER_Z], vial: [248, 34, PAPER_Z + 12], cable: [130, -48, PAPER_Z + H0 + 170],
    housing: inPlane(-24.5, 120), lead: inPlane(-21.6, 20), "magnetic-shield": inPlane(-16, 60), pmt: inPlane(14.3, 70), divider: inPlane(13, 130),
    window: inPlane(17, 0), crystal: inPlane(-16, 2), "optical-window": inPlane(16, 4.3), photocathode: inPlane(-12.8, 6.3), dynodes: inPlane(8, 50),
  };
  return {
    O, ex: vec([1, 0, 0]), ey: vec([0, 1, 0]), ez: vec([0, 0, 1]),
    anchorPx: Object.fromEntries(Object.entries(anchors).map(([key, p]) => [key, at(p)])),
    PF: { o: PF.o, a: PF.a, u: PF.u, v: PF.v },
    S, DYNODES: DYNODES.map((d) => ({ ...d, face: [d.side * 4.6, d.s + 0.4] })),
    BLOTS, PAPER_Z, H0, HEIGHTS,
    cablePaths: Object.fromEntries(HEIGHTS.map((h) => [h, cablePath(h)])),
    speaker: at(SPEAKER),
    lcd: LCD,
  };
}

export function models() {
  const Fr = (F) => ({ o: F.o, a: F.a, u: F.u, v: F.v });
  const pf = Fr(PF), ax = Fr(AXF);
  const HALF = [0, Math.PI];
  const rev = (F, sec, t, phi = null) => ({ k: "rev", F, sec, t, phi });
  const disc = (F, s0, s1, r, t) => rev(F, [[s0, 0], [s0, r], [s1, r], [s1, 0]], t);
  const box = (x0, y0, z0, x1, y1, z1, t) => ({ k: "box", a: [x0, y0, z0], b: [x1, y1, z1], t });
  const plan = (p, z0, z1, t) => box(p.x, p.y, z0, p.x + p.w, p.y + p.d, z1, t);
  const quadIn = (pts, t) => ({ k: "quad", t, pts: pts.map(([u, s2]) => inPlane(u, s2)) });
  const M = {};
  M.housing = [rev(pf, [[0, 17.2], [0, 25], [8, 25], [8.6, 24.5], [159.4, 24.5], [160, 25], [172, 25], [172, 8.5], [170.8, 8.5], [170.8, 23.3], [1.2, 23.3], [1.2, 17.2]], "alu", HALF), disc(ax, S.rear, S.rear + 12, 8, "mid"), disc(ax, S.rear + 12, S.conn1, 6.8, "hi")];
  M.lead = [rev(pf, [[1.2, 18.5], [1.2, 21.6], [30, 21.6], [30, 18.5]], "lead", HALF)];
  M["magnetic-shield"] = [rev(pf, [[6, 15.2], [6, 16], [100, 16], [100, 15.2]], "mid", HALF)];
  M.pmt = [rev(pf, PMT_SEC, "glass", HALF)];
  M.window = [disc(ax, 0.02, S.win, 17.2, "alu")];
  M.crystal = [disc(ax, S.xtal0, S.xtal1, 16, "hi"), rev(ax, [[S.xtal0 - 0.2, 16], [S.xtal0 - 0.2, 17], [S.xtal1 + 0.2, 17], [S.xtal1 + 0.2, 16]], "alu")];
  M["optical-window"] = [disc(ax, S.xtal1 + 0.2, S.ow1, 16, "glass")];
  M.photocathode = [disc(ax, 6.2, S.pc, 12.8, "copper")];
  M.dynodes = [...DYNODES.map((d) => quadIn(dynodeQuad(d), "hi")), quadIn([[-3, S.anode], [3, S.anode], [3, S.anode + 0.8], [-3, S.anode + 0.8]], "hi"), disc(ax, S.base0, S.base1, 13, "lo")];
  const cmid = (u, s2, v) => G.add3(G.add3(PF.o, G.mul3(PF.a, s2)), G.add3(G.mul3(PF.u, u), G.mul3(PF.v, v)));
  M.divider = [{ k: "quad", t: "lo", pts: [cmid(-13, S.pcb0, 1.4), cmid(13, S.pcb0, 1.4), cmid(13, S.pcb1, 1.4), cmid(-13, S.pcb1, 1.4)] },
    ...Array.from({ length: 10 }, (_, i) => { const s2 = S.pcb0 + 4 + i * 3.8; const F = { o: cmid(-5, s2, 0), a: PF.u, u: PF.a, v: PF.v }; return disc(F, 0, 10, 0.9, "mid"); })];
  M.meter = [plan(METER, 1.5, MZ, "mid"), ...[METER.x + 30, METER.x + METER.w - 40].map((x) => box(x, -52, MZ, x + 10, -30, MZ + 36, "mid")), box(METER.x + 26, -50, MZ + 34, METER.x + METER.w - 30, -32, MZ + 46, "mid")];
  M.display = [box(LCD.x0 - 5, FACE_Y, LCD.z0 - 5, LCD.x1 + 5, FACE_Y + 1.6, LCD.z1 + 5, "mid"), box(LCD.x0, FACE_Y + 1.6, LCD.z0, LCD.x1, FACE_Y + 1.8, LCD.z1, "glass")];
  M.keypad = [-170, -150, -130, -110].map((x, i) => box(x, FACE_Y, 30, x + 14, FACE_Y + 2.2, 40, i ? "mid" : "hi"));
  M.speaker = [disc({ o: [SPEAKER[0], FACE_Y, SPEAKER[2]], a: [0, 1, 0], u: [1, 0, 0], v: [0, 0, 1] }, 0, 0.6, 16, "lo")];
  M.tray = [plan(TRAY, 0, 1.5, "lo"), plan(k.insetPlan(TRAY, 3), 1.5, 2, "hi"), box(TRAY.x, TRAY.y, 1.5, TRAY.x + TRAY.w, TRAY.y + 2.2, 8.5, "mid"), box(TRAY.x, TRAY.y, 1.5, TRAY.x + 2.2, TRAY.y + TRAY.d, 8.5, "mid"), box(TRAY.x + TRAY.w - 2.2, TRAY.y, 1.5, TRAY.x + TRAY.w, TRAY.y + TRAY.d, 8.5, "mid"), box(TRAY.x, TRAY.y + TRAY.d - 2.2, 1.5, TRAY.x + TRAY.w, TRAY.y + TRAY.d, 8.5, "mid")];
  M.spill = BLOTS.map(([cx, cy, rx]) => disc(VERT(cx, cy, PAPER_Z), 0, 0.4, rx * 0.85, "glass"));
  M.vial = [disc(Fr(VIALF), -6, 0, 6.5, "lo"), rev(Fr(VIALF), [[0, 0], [0, 4.2], [3, 4.2], [5, 6], [24, 6], [26, 5], [26, 0]], "glass")];
  M.cable = [{ k: "tube", r: 2.6, t: "lo", pts: G.fillet(cableRoute(H0), 14, 8, { P, tube: 2.6 }) }, disc(Fr(SOCKF), 0, 5, 9, "mid"), disc(Fr(SOCKF), 5, 13, 7, "hi")];
  const round = (v) => (Array.isArray(v) ? v.map(round) : typeof v === "number" ? Math.round(v * 1000) / 1000 : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([a, b]) => [a, round(b)])) : v);
  return round(M);
}
