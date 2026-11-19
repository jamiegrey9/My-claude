// Builds the Philips 5400 series cutaway figure and its brew simulator.
//   node build.mjs           writes coffee-5400.html (dark plate)
//   node build.mjs --light   writes coffee-5400-light.html
//   node build.mjs --audit   also runs the geometry audit
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../anatomy-kit/iso-kit.mjs";
import * as G from "../anatomy-kit/lathe.mjs";
import { tubePieces, tubeSvg } from "../anatomy-kit/tube.mjs";
import * as A from "../anatomy-kit/audit.mjs";
import { kitScript } from "../anatomy-kit/scripts/inline-kit.mjs";
import * as W from "./geometry.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const THEME = process.argv.includes("--light") ? "light" : "dark";

const WIDTH = 640;
const HEIGHT = 600;
const AZIMUTH = 38;
const { BODY, FLOOR } = W;

const P = k.fitProjection(
  [[0, 0, 0], [BODY.w, 0, 0], [BODY.w, BODY.d + 14, 0], [0, BODY.d + 14, 0], [0, 0, W.HOPPER.z1], [BODY.w, 0, BODY.h], [BODY.w, BODY.d, BODY.h], [0, BODY.d, BODY.h]],
  WIDTH,
  HEIGHT,
  { pad: 34, azimuth: AZIMUTH },
);
const V = G.viewOf(P);
const KS = G.scaleOf(P);
const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, style);
const Ln = (d, style) => k.lineSvg(d, style);
const Dots = (points, style) => k.dotsSvg(points, style);
const path3 = (points, closed = false) => k.pathOf(points.map(at), closed);
const f2 = (v) => Math.round(v * 100) / 100;

const R = A.recorder(P);
const record = R.solid;
function put(name, ref, svg, shapes = [], { bias = 0, comp = "", attrs = "", ...rest } = {}) {
  return R.put({ name, at: ref, bias, svg, shapes, piece: "machine", comp, attrs: (comp ? ` data-comp="${comp}"` : "") + attrs, ...rest });
}

// ---------- primitive helpers, each records its true shape ----------
function box(name, [x0, y0, z0], [x1, y1, z1], style = {}, { r = 0.6, steps = 2, bevel = 0, extra = "", inner = "", bias = 0, comp } = {}) {
  const plan = { x: x0, y: y0, w: x1 - x0, d: y1 - y0, r };
  const shape = record(A.slab(plan, z0, z1 - z0, { name }, steps));
  put(name, [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], S(k.slabOf(plan, z0, z1 - z0, P, steps, bevel), { tone: "mid", ...style, inner }) + extra, [shape], { bias, comp });
  return plan;
}
function cyl(name, cx, cy, r, z0, z1, style = {}, { steps = 28, bevel = 0, extra = "", inner = "", bias = 0, comp } = {}) {
  const shape = record(A.cylinder(cx, cy, r, z0, z1 - z0, { name }));
  put(name, [cx, cy, (z0 + z1) / 2], S(k.cylinder(cx, cy, r, z0, z1 - z0, P, steps, bevel), { tone: "mid", ...style, inner }) + extra, [shape], { bias, comp });
}
function turned(name, F, profile, style = {}, { extra = "", inner = "", bias = 0, comp, owner, bevel = 0 } = {}) {
  const paths = G.solidOf(profile, F, P, { bevel });
  const mid = (profile[0][0] + profile[profile.length - 1][0]) / 2;
  const shape = record(A.solid(F, profile, { name, owner }));
  put(name, G.add3(F.o, G.mul3(F.a, mid)), S(paths, { tone: "mid", ...style, inner }) + extra, [shape], { bias, comp });
}
function disc(name, F, s0, s1, r, style = {}, opts = {}) {
  return turned(name, F, [[s0, r], [s1, r]], style, opts);
}
// The far half of a ring, for parts drawn with their near half cut away.
function farRing(cx, cy, ro, ri, n = 28) {
  const a = (AZIMUTH * Math.PI) / 180;
  const outer = [];
  const inner = [];
  for (let i = 0; i <= n; i++) {
    const t = a + Math.PI / 2 + (Math.PI * i) / n;
    outer.push([cx + ro * Math.cos(t), cy + ro * Math.sin(t)]);
    inner.push([cx + ri * Math.cos(t), cy + ri * Math.sin(t)]);
  }
  return [...outer, ...inner.reverse()];
}
function cutRing(name, cx, cy, ro, ri, z0, z1, style = {}, { comp, extra = "", bias = 0 } = {}) {
  const ring = farRing(cx, cy, ro, ri);
  const shape = record(A.extruded(ring, z0, z1 - z0, { name }));
  const paths = k.extrude(ring, z0, z1 - z0, P, { convex: false });
  // Section faces on the two cut ends, hatched faint so the cut reads as a cut.
  const a = (AZIMUTH * Math.PI) / 180;
  const ends = [a + Math.PI / 2, a + Math.PI * 1.5].map((t) => {
    const c = Math.cos(t);
    const s = Math.sin(t);
    return path3([[cx + ri * c, cy + ri * s, z1], [cx + ro * c, cy + ro * s, z1]]);
  });
  put(name, [cx - Math.cos(a) * ro * 0.5, cy - Math.sin(a) * ro * 0.5, (z0 + z1) / 2], S(paths, { tone: "mid", ...style }) + Ln(ends.join(""), { tone: "lo" }) + extra, [shape], { bias, comp });
}

// ---------- hoses ----------
const ROUTES = {};
function hose(name, points, r, { flow, comp = "hose", tone = "mid", bend = 3 } = {}) {
  const route = G.fillet(points, Math.max(bend, r * 2.6), 10, { P, tube: r });
  const total = G.pathLength(route);
  const SHELL = Math.max(3, r * 2.2);
  const gaps = [[0, SHELL], [total - SHELL, total]];
  R.route(name, route, r, { gaps, rims: [r * 1.7, r * 1.7], piece: "machine" });
  ROUTES[name] = { route, flow };
  tubePieces(route, r, P, { maxLength: 18, spacing: 1.4, gaps }).forEach((piece, index) => {
    const centre = k.pathOf(piece.points.map(at));
    const overlay = flow ? `<path class="cf-flow" data-flow="${flow}" d="${centre}" style="--o:${f2(-piece.from * KS)}px"/>` : "";
    put(`${name}:${index}`, piece.mid, tubeSvg(piece, { tone }) + overlay, [A.tube(piece.points, piece.radii)], { bias: 0.05, comp, route: name, chunk: index });
  });
  [0, 1].forEach((index) => {
    const end = index ? route[route.length - 1] : route[0];
    const tangent = G.tangentAlong(route, index ? total : 0);
    const F = G.frameAlong(end, tangent);
    const [s0, s1] = index ? [-SHELL, 0] : [0, SHELL];
    const shape = record(A.disc(F, s0, s1, r * 1.7, { name: `${name}.nut${index}`, owner: name }));
    const paths = G.disc(s0, s1, r * 1.7, F, P, { steps: 24, bevel: 0.25 });
    put(`${name}.nut${index}`, G.add3(end, G.mul3(tangent, (s0 + s1) / 2)), S(paths, { tone: "mid" }), [shape], { bias: 0.1, comp });
  });
  return route;
}

// ---------- the worktop halo and the chassis ----------
const back = [];
const FOOTPRINT = { x: 0, y: 0, w: BODY.w, d: BODY.d, r: 10 };
back.push(`<path class="iso-halo" d="${k.haloOf(FOOTPRINT, 0, W.FOOT_H, P)}"/>`);
for (const [x, y] of [[24, 24], [BODY.w - 24, 24], [24, BODY.d - 24], [BODY.w - 24, BODY.d - 24]].sort((p, q) => k.depthOf([...p, 0], P) - k.depthOf([...q, 0], P))) {
  back.push(S(k.cylinder(x, y, 11, 0, 2, P, 28), { tone: "lo" }));
  back.push(S(k.cylinder(x, y, 8, 2, W.FOOT_H - 2, P, 28), { tone: "mid" }));
}
record(A.slab(FOOTPRINT, 0, W.FOOT_H, { name: "stand.feet", ground: true }, 8));

box("base", [0, 0, W.FOOT_H], [BODY.w, BODY.d, FLOOR], { tone: "mid" }, { r: 10, steps: 8, bevel: 1.2, inner: Ln(k.sideSeam({ x: 0, y: 0, w: BODY.w, d: BODY.d, r: 10 }, 15, P, 8), { tone: "faint" }) });

// Shell: left and back walls stay on; the right panel and service door are off.
box("shell.left", [0, 0, FLOOR], [5, BODY.d - 8, 360], { tone: "mid" }, { r: 0.4 });
box("shell.back", [5, 0, FLOOR], [BODY.w - 6, 5, 360], { tone: "mid" }, { r: 0.4, extra: Ln(Array.from({ length: 6 }, (_, i) => path3([[60 + i * 9, 5, 300], [64 + i * 9, 5, 300], [64 + i * 9, 5, 336], [60 + i * 9, 5, 336]], true)).join(""), { tone: "faint" }) });
// box("frame.post.rear", [BODY.w - 6, 0, FLOOR], [BODY.w, 6, 360], { tone: "mid" }, { r: 0.6 });
// box("frame.rail.low", [BODY.w - 6, 6, FLOOR], [BODY.w, W.DRIP.y - 2, 30], { tone: "mid" }, { r: 0.4, extra: Dots([60, 140, 220].map((y) => at([BODY.w, y, 26])), { size: 0.45 }) });
// box("frame.rail.top", [BODY.w - 6, 0, 360], [BODY.w, 330, 371], { tone: "mid" }, { r: 0.6, bevel: 0.5 });
// Top cover with a hole for the hopper; the rear-right quarter is cut away.
const H = W.HOPPER;
box("top.a", [0, 0, 360], [H.x, 330, 371], {}, { bevel: 0.5 });
box("top.b", [H.x, 0, 360], [H.x + H.w, H.y, 371], {}, { bevel: 0.5 });
box("top.c", [H.x, H.y + H.d, 360], [H.x + H.w, 330, 371], {}, {
  bevel: 0.5,
  extra: Ln(k.planOutline({ x: H.x + 4, y: H.y + H.d + 8, w: H.w - 8, d: 116, r: 3 }, 371, P, 3), { tone: "faint" }),
});
box("top.front", [0, 330, 360], [BODY.w, BODY.d, 371], {}, { r: 1.2, steps: 3, bevel: 0.8 });
box("panel.front", [0, BODY.d - 8, W.BAY.ceil], [BODY.w, BODY.d, 360], { tone: "mid" }, { r: 0.6 });
box("panel.front.left", [0, BODY.d - 8, 48], [W.BAY.x0, BODY.d, W.BAY.ceil], { tone: "mid" }, { r: 0.6 });
box("bay.ceiling", [W.BAY.x0, W.BAY.yBack, W.BAY.ceil], [W.BAY.x1, BODY.d - 8, W.BAY.ceil + 6], { tone: "mid" }, { r: 0.4 });
box("bay.back", [W.BAY.x0, W.BAY.yBack - 6, 48], [W.BAY.x1, W.BAY.yBack, W.BAY.ceil], { tone: "mid" }, { r: 0.4 });

// ---------- drip tray, grounds container ----------
const D = W.DRIP;
box("drip.tray", [D.x, D.y, D.z0], [D.x + D.w, D.y + D.d, D.z1], { tone: "mid" }, {
  r: 6, steps: 6, bevel: 0.8, comp: "drip",
  inner: Ln(k.sideSeam({ x: D.x, y: D.y, w: D.w, d: D.d, r: 6 }, 34, P, 6), { tone: "faint" }),
  extra:
    Ln(Array.from({ length: 13 }, (_, i) => k.planOutline({ x: 72 + i * 12, y: 340, w: 5, d: 96, r: 2.5 }, D.z1, P, 3)).join(""), { tone: "lo" }) +
    Dots([[D.x + 8, D.y + 8], [D.x + D.w - 8, D.y + 8], [D.x + 8, D.y + D.d - 8], [D.x + D.w - 8, D.y + D.d - 8]].map(([x, y]) => at([x, y, D.z1])), { size: 0.45 }),
});
cyl("drip.float", 58, 434, 4.5, D.z1, D.z1 + 5, { tone: "hi" }, { steps: 20, comp: "drip" });
const GR = W.GROUNDS;
const GWALL = 3;
const gbox = (name, x0, y0, x1, y1, z1, extra = {}, z0 = GR.z0 + GWALL) => box(name, [x0, y0, z0], [x1, y1, z1], { tone: "mid" }, { r: 0.6, comp: "grounds", ...extra });
gbox("grounds.floor", GR.x, GR.y, GR.x + GR.w, GR.y + GR.d, GR.z0 + GWALL, {}, GR.z0);
gbox("grounds.wall.back", GR.x, GR.y, GR.x + GR.w, GR.y + GWALL, GR.z1);
gbox("grounds.wall.left", GR.x, GR.y + GWALL, GR.x + GWALL, GR.y + GR.d - GWALL, GR.z1);
put("grounds.pucks", [GR.x + GR.w / 2, 250, GR.z0 + 20], "", [record(A.slab({ x: GR.x + GWALL + 1, y: 190, w: GR.w - 2 * GWALL - 2, d: GR.y + GR.d - 191 - GWALL, r: 2 }, GR.z0 + GWALL, 30, { name: "grounds.pucks", owner: "grounds.floor" }))], { comp: "grounds", attrs: ' data-slot="pucks"' });
gbox("grounds.wall.right", GR.x + GR.w - GWALL, GR.y + GWALL, GR.x + GR.w, GR.y + GR.d - GWALL, GR.z1, { inner: Ln(k.sideSeam({ x: GR.x + GR.w - GWALL, y: GR.y + GWALL, w: GWALL, d: GR.d - 2 * GWALL, r: 0.6 }, 60, P, 2), { tone: "faint" }) });
gbox("grounds.wall.front", GR.x, GR.y + GR.d - GWALL, GR.x + GR.w, GR.y + GR.d, GR.z1, { extra: Ln(k.planOutline({ x: GR.x + 30, y: GR.y + GR.d - GWALL, w: 26, d: GWALL, r: 1 }, GR.z1, P, 2), { tone: "lo" }) });
box("brew.shelf", [GR.x, 5, 104], [BODY.w - 6, 196, 110], { tone: "mid" }, { r: 0.4, extra: Dots([[160, 20], [230, 20], [160, 186], [230, 186]].map(([x, y]) => at([x, y, 110])), { size: 0.45 }) });

// ---------- water tank ----------
const T = W.TANK;
box("tank.body", [T.x, T.y, T.z0], [T.x + T.w, T.y + T.d, T.z1], { tone: "hi" }, {
  r: T.r, steps: 5, bevel: 0.8, comp: "tank",
  inner:
    Ln(k.sideSeam({ x: T.x, y: T.y, w: T.w, d: T.d, r: T.r }, T.z1 - 14, P, 5), { tone: "lo" }) +
    Ln(k.sideTicks(T.y + 20, T.y + T.d - 20, 8, 5, T.x + T.w, T.z1 - 14, [3, 6], P, "y").minor, { tone: "faint" }),
});
box("tank.lid", [T.x - 1, T.y - 1, T.z1], [T.x + T.w + 1, T.y + T.d + 1, T.z1 + 6], { tone: "mid" }, { r: T.r + 1, steps: 5, bevel: 0.6, comp: "tank", extra: Ln(k.planOutline({ x: T.x + 10, y: T.y + T.d - 40, w: T.w - 20, d: 28, r: 6 }, T.z1 + 6, P, 4), { tone: "lo" }) });
put("tank.level", [T.x + T.w / 2, T.y + T.d / 2, T.z0 + 60], "", [record(A.slab({ x: T.x + 2, y: T.y + 2, w: T.w - 4, d: T.d - 4, r: 4 }, T.z0 + 2, 120, { name: "tank.level", owner: "tank.body" }))], { attrs: ' data-slot="tank"' });
cyl("tank.outlet", 200, 256, 6, T.z0 - 6, T.z0, {}, { steps: 20, comp: "tank" });

// ---------- hopper and grinder ----------
const GD = W.GRINDER;
box("grinder.mount", [5, 76, GD.motorZ0 - 6], [112, 144, GD.motorZ0], { tone: "mid" }, { r: 0.6, extra: Dots([[14, 84], [14, 136], [104, 84], [104, 136]].map(([x, y]) => at([x, y, GD.motorZ0])), { size: 0.45 }) });
cyl("grinder.motor", GD.c[0], GD.c[1], 23, GD.motorZ0, GD.z0, { tone: "mid" }, {
  steps: 40, comp: "grinder",
  extra: Ln(k.knurl(GD.c[0], GD.c[1], 23, GD.motorZ0 + 6, GD.z0 - 8, 40, P, 0.6), { tone: "faint" }),
  inner: Ln(k.sideArc(GD.c[0], GD.c[1], 23, GD.motorZ0 + 6, P, 40) + k.sideArc(GD.c[0], GD.c[1], 23, GD.z0 - 8, P, 40), { tone: "lo" }),
});
cyl("grinder.housing", GD.c[0], GD.c[1], GD.r, GD.z0, GD.z1, { tone: "mid" }, { steps: 56, bevel: 0.6, comp: "grinder", extra: Dots([0.3, 1.1, 1.9, 2.7].map((a) => at([GD.c[0] + Math.cos(a) * (GD.r - 3), GD.c[1] + Math.sin(a) * (GD.r - 3), GD.z1])), { size: 0.45 }) });
put("grinder.burr.low", [GD.c[0], GD.c[1], GD.z1 + 4], "", [record(A.cylinder(GD.c[0], GD.c[1], 26, GD.z1, 8, { name: "grinder.burr.low" }))], { comp: "grinder", attrs: ' data-slot="burr"' });
cyl("grinder.burr.high", GD.c[0], GD.c[1], 26, GD.z1 + 8, GD.z1 + 16, { tone: "hi" }, {
  steps: 56, comp: "grinder",
  inner: Ln(k.sideArc(GD.c[0], GD.c[1], 26, GD.z1 + 12, P, 48), { tone: "faint" }),
});
cyl("grinder.throat", GD.c[0], GD.c[1], 13, GD.z1 + 16, H.z0, { tone: "mid" }, { steps: 32, comp: "grinder" });
// Hopper: the lid is off; the near walls are drawn after the beans.
box("hopper.floor", [H.x + 4, H.y + 4, H.z0], [H.x + H.w - 4, H.y + H.d - 4, H.z0 + 4], { tone: "lo" }, { r: 3, comp: "hopper" });
box("hopper.wall.back", [H.x, H.y, H.z0], [H.x + H.w, H.y + 4, H.z1], { tone: "mid" }, { r: 0.6, comp: "hopper" });
box("hopper.wall.left", [H.x, H.y + 4, H.z0], [H.x + 4, H.y + H.d - 4, H.z1], { tone: "mid" }, { r: 0.6, comp: "hopper" });
put("hopper.beans", [H.x + H.w / 2, H.y + H.d / 2, H.z0 + 20], "", [record(A.slab({ x: H.x + 4, y: H.y + 4, w: H.w - 8, d: H.d - 8, r: 2 }, H.z0 + 4, 36, { name: "hopper.beans" }))], { comp: "hopper", attrs: ' data-slot="beans"' });
box("hopper.wall.right", [H.x + H.w - 4, H.y + 4, H.z0], [H.x + H.w, H.y + H.d - 4, H.z1], { tone: "mid" }, { r: 0.6, comp: "hopper" });
box("hopper.wall.front", [H.x, H.y + H.d - 4, H.z0], [H.x + H.w, H.y + H.d, H.z1], { tone: "mid" }, { r: 0.6, comp: "hopper" });
// Grind setting knob on the top cover, with its twelve steps.
const KNOB = [62, 214];
const knobTicks = k.radialTicks(KNOB[0], KNOB[1], 14, W.GRIND_STEPS - 1, 11, 373, [1.6, 3], P, -Math.PI * 0.75, Math.PI * 1.5);
cyl("grind.knob.base", KNOB[0], KNOB[1], 15, 371, 373, { tone: "lo" }, { steps: 40, comp: "grinder", extra: Ln(knobTicks.minor, { tone: "lo" }) + Ln(knobTicks.major, { tone: "mid" }) });
cyl("grind.knob", KNOB[0], KNOB[1], 9, 373, 380, { tone: "mid" }, {
  steps: 36, comp: "grinder",
  extra: Ln(k.knurl(KNOB[0], KNOB[1], 9, 373.5, 379.5, 40, P, 0.3), { tone: "lo" }),
});
put("grind.pointer", [KNOB[0], KNOB[1], 381], "", [record(A.cylinder(KNOB[0], KNOB[1], 8, 380, 0.3, { name: "grind.pointer", owner: "grind.knob" }))], { bias: 10, comp: "grinder", attrs: ' data-slot="knob"' });

// ---------- brew group ----------
const B = W.BREW;
const C = W.CHAMBER;
box("brew.plate.back", [B.x, B.y, B.z0], [B.x + B.w, B.y + 6, B.z1], { tone: "mid" }, {
  r: 0.8, comp: "brew",
  extra: Dots([[B.x + 6, B.z0 + 8], [B.x + B.w - 6, B.z0 + 8], [B.x + 6, B.z1 - 8], [B.x + B.w - 6, B.z1 - 8]].map(([x, z]) => at([x, B.y + 6, z])), { size: 0.45 }),
});
box("brew.base", [B.x + 4, B.y + 6, B.z0], [B.x + B.w - 4, B.y + B.d - 6, C.z0], { tone: "mid" }, { r: 1.5, steps: 3, bevel: 0.6, comp: "brew", inner: Ln(k.sideSeam({ x: B.x + 4, y: B.y + 6, w: B.w - 8, d: B.d - 12, r: 1.5 }, B.z0 + 10, P, 3), { tone: "faint" }) });
put("brew.slot", [194, 176, C.z0 + 0.05], Ln(k.planOutline({ x: 172, y: 162, w: 44, d: 26, r: 3 }, C.z0, P, 3), { tone: "lo" }), [record(A.slab({ x: 172, y: 162, w: 44, d: 26, r: 3 }, C.z0, 0.05, { name: "brew.slot", owner: "brew.base" }))], { comp: "brew" });
cutRing("brew.chamber", C.c[0], C.c[1], C.r, C.rin, C.z0, C.z1, { tone: "hi" }, { comp: "brew" });
put("brew.bed", [C.c[0], C.c[1], C.z0 + 14], "", [record(A.cylinder(C.c[0], C.c[1], C.rin - 0.5, C.z0, 28, { name: "brew.bed" }))], { comp: "brew", attrs: ' data-slot="bed"' });
put("brew.piston", [C.c[0], C.c[1], W.HEAD.rest + 10], "", [record(A.cylinder(C.c[0], C.c[1], W.HEAD.r, W.HEAD.rest, W.GLAND_Z - W.HEAD.rest, { name: "brew.piston" }))], { comp: "brew", attrs: ' data-slot="piston"' });
cyl("brew.gland", C.c[0], C.c[1], 8, W.GLAND_Z, 262, { tone: "mid" }, { steps: 28, comp: "brew" });
box("brew.crossbar", [B.x + 6, B.y + 6, 262], [B.x + B.w - 6, B.y + B.d - 6, 276], { tone: "mid" }, { r: 1, steps: 3, bevel: 0.6, comp: "brew", extra: Dots([[B.x + 12, B.y + 14], [B.x + B.w - 12, B.y + 14], [B.x + 12, B.y + B.d - 14], [B.x + B.w - 12, B.y + B.d - 14]].map(([x, y]) => at([x, y, 276])), { size: 0.45 }) });
box("brew.frame.upright", [B.x, B.y + B.d - 6, B.z0], [B.x + 10, B.y + B.d, B.z1], { tone: "mid" }, { r: 0.6, comp: "brew" });
box("brew.frame.top", [B.x + 10, B.y + B.d - 6, 276], [B.x + B.w, B.y + B.d, B.z1], { tone: "mid" }, { r: 0.6, comp: "brew", extra: Dots([at([B.x + B.w - 6, B.y + B.d, 283])], { size: 0.45 }) });
// Doser funnel the grounds chute empties into, on an arm from the back plate.
box("brew.funnel.arm", [160, B.y + 6, 206], [168, 117, 210], { tone: "mid" }, { r: 0.4, comp: "brew" });
turned("brew.funnel", G.frameAlong([164, 124, 204], [0, 0, 1]), [[0, 5], [10, 8]], { tone: "mid" }, { comp: "brew" });
// Drive: the crank disc the machine's gear motor turns, on the frame upright.
disc("brew.crank", G.frameAlong([B.x + 5, B.y + B.d, 200], [0, 1, 0]), 0, 3, 4.5, { tone: "lo" }, { comp: "brew" });
put("brew.puck", [C.c[0], C.c[1] + 40, C.z1], "", [record(A.cylinder(C.c[0], C.c[1], C.rin - 1, W.LOWER_PISTON_Z, 10, { name: "brew.puck", owner: "brew.bed" }))], { bias: 400, comp: "brew", attrs: ' data-slot="puck"' });

// ---------- hydraulics ----------
const PU = W.PUMP;
const PF = G.frameOf([PU.x, PU.y0, PU.z], [0, 1, 0], [1, 0, 0], [0, 0, 1]);
const pumpLen = PU.y1 - PU.y0;
turned("pump.body", PF, [[0, 6], [6, 6], [6, 11], [12, 11], [12, PU.r], [pumpLen - 12, PU.r], [pumpLen - 12, 11], [pumpLen - 6, 11], [pumpLen - 6, 6], [pumpLen, 6]], { tone: "hi" }, {
  comp: "pump",
  inner: Ln([20, 30, 40, 50, 60, 70].map((s) => G.arcOf(PF, s, PU.r, P)).join(""), { tone: "faint" }),
});
box("pump.mount.a", [PU.x - 12, PU.y0 + 16, FLOOR], [PU.x + 12, PU.y0 + 24, PU.z - PU.r], { tone: "lo" }, { r: 1.5, comp: "pump" });
box("pump.mount.b", [PU.x - 12, PU.y1 - 24, FLOOR], [PU.x + 12, PU.y1 - 16, PU.z - PU.r], { tone: "lo" }, { r: 1.5, comp: "pump" });
const FM = W.FLOWMETER;
box("flowmeter.arm", [FM.c[0] - 2, FM.c[1] + 8.8, FM.z0 + 3], [FM.c[0] + 2, W.BAY.yBack - 6, FM.z1 - 3], { tone: "lo" }, { r: 0.3, comp: "pump" });
cyl("flowmeter", FM.c[0], FM.c[1], FM.r, FM.z0, FM.z1, { tone: "hi" }, { steps: 32, bevel: 0.4, comp: "pump", extra: Ln(k.ring(FM.c[0], FM.c[1], 5, FM.z1, P, 24), { tone: "lo" }) });
put("flowmeter.rotor", [FM.c[0], FM.c[1], FM.z1 + 0.2], "", [record(A.cylinder(FM.c[0], FM.c[1], 5, FM.z1, 0.2, { name: "flowmeter.rotor", owner: "flowmeter" }))], { bias: 2, comp: "pump", attrs: ' data-slot="rotor"' });
const TH = W.THERMO;
for (const [x, y] of [[TH.x + 7, TH.y + 7], [TH.x + TH.w - 7, TH.y + 7], [TH.x + 7, TH.y + TH.d - 7], [TH.x + TH.w - 7, TH.y + TH.d - 7]]) cyl("thermo.post", x, y, 3.5, 110, TH.z0, { tone: "lo" }, { steps: 16, comp: "thermo" });
box("thermoblock", [TH.x, TH.y, TH.z0], [TH.x + TH.w, TH.y + TH.d, TH.z1], { tone: "hi" }, {
  r: TH.r, steps: 3, bevel: 0.8, comp: "thermo",
  inner: Ln([156, 162, 168, 174, 180, 186, 192].map((z) => k.sideSeam({ x: TH.x, y: TH.y, w: TH.w, d: TH.d, r: TH.r }, z, P, 3)).join(""), { tone: "faint" }),
});
const TX = TH.x + TH.w;
for (const [y, z, rr, name] of [[TH.y + 9, 162, 2.6, "thermo.terminal"], [TH.y + TH.d - 9, 162, 2.6, "thermo.terminal"], [TH.y + TH.d / 2, 168, 5.5, "thermo.ntc"]]) disc(name, G.frameAlong([TX, y, z], [1, 0, 0]), 0, name === "thermo.ntc" ? 3 : 5, rr, { tone: "mid" }, { comp: "thermo" });
const VA = W.VALVES;
box("valves.block", [VA.x, VA.y, VA.z0], [VA.x + VA.w, VA.y + VA.d, VA.z1], { tone: "hi" }, { r: VA.r, steps: 3, bevel: 0.5, comp: "valves", extra: Dots([[VA.x + 3, VA.y + 3], [VA.x + VA.w - 3, VA.y + VA.d - 3], [VA.x + 3, VA.y + VA.d - 3]].map(([x, y]) => at([x, y, VA.z1])), { size: 0.45 }) });
for (const x of [VA.x + 12, VA.x + 38]) cyl("valves.coil", x, VA.y + 12, 6, VA.z1, VA.z1 + 18, { tone: "mid" }, { steps: 24, comp: "valves", extra: Ln(k.ring(x, VA.y + 12, 2.4, VA.z1 + 18, P, 16), { tone: "lo" }), inner: Ln(k.sideArc(x, VA.y + 12, 6, VA.z1 + 9, P, 20), { tone: "faint" }) });

// PCB on the left wall.
box("pcb", [5, 190, 60], [8, 310, 196], { tone: "lo" }, {
  r: 0.3, comp: "pcb",
  extra:
    Ln([[200, 120, 226, 140], [236, 90, 262, 118], [272, 140, 296, 180], [212, 160, 250, 186]].map(([y0, z0, y1, z1]) => path3([[8, y0, z0], [8, y1, z0], [8, y1, z1], [8, y0, z1]], true)).join(""), { tone: "faint" }) +
    Dots([[196, 66], [304, 66], [196, 190], [304, 190]].map(([y, z]) => at([8, y, z])), { size: 0.45 }),
});

// ---------- cup bay: dispenser, LatteGo, cup ----------
const LG = W.LATTEGO;
box("lattego.jug", [LG.x, LG.y, LG.z0], [LG.x + LG.w, LG.y + LG.d, 166], { tone: "hi" }, {
  r: LG.r, steps: 6, bevel: 0.6, comp: "lattego",
  inner: Ln(k.sideSeam({ x: LG.x, y: LG.y, w: LG.w, d: LG.d, r: LG.r }, 60, P, 6), { tone: "faint" }),
});
put("lattego.milk", [LG.x + LG.w / 2, LG.y + LG.d / 2, 100], "", [record(A.box([LG.x + LG.w + 0.05, LG.y + LG.r, 60], [LG.x + LG.w + 0.15, LG.y + LG.d - LG.r, 60.1], { name: "lattego.milk", owner: "lattego.jug" }))], { bias: 60, comp: "lattego", attrs: ' data-slot="milkline"' });
box("lattego.top", [LG.x - 1, LG.y - 1, 166], [LG.x + LG.w + 1, LG.y + LG.d + 1, LG.z1], { tone: "mid" }, { r: LG.r + 1, steps: 6, bevel: 0.6, comp: "lattego", inner: Ln(k.sideSeam({ x: LG.x - 1, y: LG.y - 1, w: LG.w + 2, d: LG.d + 2, r: LG.r + 1 }, 186, P, 6), { tone: "faint" }) });
disc("lattego.spout", G.frameAlong([LG.x + LG.w + 0.8, 372, 192], [1, 0, 0]), 0, 12, 3.4, { tone: "mid" }, { comp: "lattego" });
disc("lattego.port", G.frameAlong([76, W.BAY.yBack, 180], [0, 1, 0]), 0, LG.y - 1 - W.BAY.yBack, 4.8, { tone: "mid" }, { comp: "lattego" });
for (const x of [118, 146]) box("dispenser.guide", [x - 2, 404, 136], [x + 2, 408, W.BAY.ceil], { tone: "lo" }, { r: 0.4, comp: "dispenser" });
put("dispenser", [132, 382, 164], "", [record(A.slab({ x: 108, y: 360, w: 48, d: 44, r: 6 }, 154, 20, { name: "dispenser" }))], { comp: "dispenser", attrs: ' data-slot="dispenser"' });
put("cup", [W.CUP_AT[0], W.CUP_AT[1], 80], "", [record(A.cylinder(W.CUP_AT[0], W.CUP_AT[1], 33, 48, 60, { name: "cup" }))], { comp: "cup", attrs: ' data-slot="cup"' });

// ---------- hoses: water in, through the pump and thermoblock, out to the brew group and spout ----------
const r = 3;
const FMc = FM.c;
hose("h.tank", [[200, 256, T.z0 - 6], [200, 256, 132], [FMc[0], FMc[1], 132], [FMc[0], FMc[1], FM.z1]], r, { flow: "tank" });
hose("h.meter", [[FMc[0], FMc[1], FM.z0], [FMc[0], FMc[1], 94], [PU.x, 280, 72], [PU.x, 268, PU.z], [PU.x, PU.y1, PU.z]], r, { flow: "tank" });
hose("h.pump", [[PU.x, PU.y0, PU.z], [PU.x, 146, PU.z], [142, 70, 130], [142, 34, 175], [TH.x, 34, 175]], r, { flow: "tank" });
const PZ = VA.z1;
hose("h.brew", [[214, 44, PZ], [214, 44, 300], [C.c[0], C.c[1], 300], [C.c[0], C.c[1], 276]], r, { flow: "brewIn" });
hose("h.water", [[198, 44, PZ], [198, 44, 252], [122, 44, 252], [122, 372, 252], [122, 372, W.BAY.ceil + 6]], r, { flow: "water" });
hose("h.steam", [[186, 44, PZ], [186, 44, 236], [134, 44, 236], [134, 300, 236], [134, 300, 180], [76, 300, 180], [76, W.BAY.yBack - 6, 180]], r, { flow: "steam" });
hose("h.coffee", [[214, B.y + B.d - 6, 126], [214, 300, 126], [172, 300, 126], [172, 300, 238], [172, 372, 238], [142, 372, 238], [142, 372, W.BAY.ceil + 6]], r, { flow: "coffee" });
// Grounds chute from the burrs to the open brew chamber.
const ca = Math.atan2(124 - GD.c[1], 164 - GD.c[0]);
const CHUTE = G.fillet([[GD.c[0] + Math.cos(ca) * 30.5, GD.c[1] + Math.sin(ca) * 30.5, GD.z0], [GD.c[0] + Math.cos(ca) * 30.5, GD.c[1] + Math.sin(ca) * 30.5, GD.z0 - 10], [164, 124, 226], [164, 124, 214]], 13, 10, { P, tube: 5 });
const chuteRoute = CHUTE;
R.route("chute", chuteRoute, 5, { piece: "machine" });
tubePieces(chuteRoute, 5, P, { maxLength: 18, spacing: 1.4, caps: true }).forEach((piece, index) => {
  const centre = k.pathOf(piece.points.map(at));
  put(`chute:${index}`, piece.mid, tubeSvg(piece, { tone: "mid" }) + `<path class="cf-flow" data-flow="grounds" data-grain d="${centre}" style="--o:${f2(-piece.from * KS)}px"/>`, [A.tube(piece.points, piece.radii)], { bias: 0.05, comp: "grinder", route: "chute", chunk: index });
});

// ---------- display on the front panel ----------
const SCREEN = { x: 26, z: 342, w: 120, h: 66 };
const FY = BODY.d;
const faceM = k.sideMatrix([SCREEN.x, FY], SCREEN.z, P, "left");
const display = `<g class="cf-display" transform="${faceM}">
  <rect class="cf-bezel" x="-4" y="-4" width="${SCREEN.w + 8}" height="${SCREEN.h + 8}" rx="5"/>
  <rect class="cf-screen" x="0" y="0" width="${SCREEN.w}" height="${SCREEN.h}" rx="2.5"/>
  <clipPath id="cf-clip"><rect x="0" y="0" width="${SCREEN.w}" height="${SCREEN.h}" rx="2.5"/></clipPath>
  <g clip-path="url(#cf-clip)">
    <text class="cf-scr cf-scr-title" x="8" y="16" data-screen="title">Espresso</text>
    <g data-screen="beans"></g>
    <text class="cf-scr cf-scr-small" x="8" y="44" data-screen="stage">Ready</text>
    <rect class="cf-scr-track" x="8" y="52" width="${SCREEN.w - 16}" height="3" rx="1.5"/>
    <rect class="cf-scr-bar" x="8" y="52" width="0" height="3" rx="1.5" data-screen="bar"/>
  </g>
  <circle class="cf-btn" cx="${SCREEN.w + 40}" cy="8" r="6"/><path class="cf-btn-mark" d="M${SCREEN.w + 40} 4.5v3.4M${SCREEN.w + 37.2} 6.2a3.6 3.6 0 1 0 5.6 0"/>
  ${[0, 1, 2, 3].map((i) => `<circle class="cf-key" cx="${SCREEN.w + 26 + (i % 2) * 28}" cy="${30 + Math.floor(i / 2) * 22}" r="5.5"/>`).join("")}
  <text class="cf-brand" x="${SCREEN.w + 40}" y="-16" text-anchor="middle">5400</text>
</g>`;
// Tank window and handle on the front.
const tankFront = Ln(path3([[T.x + 4, FY, T.z0 + 20], [T.x + T.w - 4, FY, T.z0 + 20], [T.x + T.w - 4, FY, T.z1 - 6], [T.x + 4, FY, T.z1 - 6]], true), { tone: "faint" }) + Ln(k.pathOf([at([T.x + 14, FY, T.z1 - 20]), at([T.x + T.w - 14, FY, T.z1 - 20])]), { tone: "lo", free: true });
put("panel.front.marks", [BODY.w / 2, FY + 0.1, 300], display + tankFront, [record(A.box([16, FY, 250], [BODY.w - 10, FY + 0.2, 352], { name: "panel.front.marks", owner: "panel.front" }))], { bias: 2 });

// ---------- order ----------
A.settle(R, P);
// Things seen through the cutaway that settle can't know about: contents drawn after their shells.
const byName = (name) => R.items.find((item) => item.name === name);
const above = (name, ref, by = 0.01) => {
  const a = byName(name);
  const b = byName(ref);
  if (a && b) a.key = Math.max(a.key, b.key + by);
};
above("hopper.beans", "hopper.wall.left");
above("hopper.beans", "hopper.wall.back");
above("hopper.beans", "hopper.floor");
above("grinder.burr.low", "grinder.housing");
above("grinder.burr.low", "grinder.floor");
above("grinder.burr.high", "grinder.burr.low");
above("cup", "drip.tray");
above("lattego.milk", "lattego.jug");
{ const tb = byName("tank.body"); const tl = byName("tank.level"); tl.key = tb.key - 0.001; }
above("panel.front.marks", "panel.front");
above("brew.slot", "brew.base");
R.items.sort((a, b) => a.key - b.key);
const groups = R.items.map((item) => `<g class="it" data-name="${item.name}"${item.attrs ?? ""}>${item.svg}</g>`);

const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "A Philips 5400 series bean-to-cup coffee machine drawn as a cutaway, with its right side panel and service door removed. Bean hopper and ceramic grinder top left, the brew group behind where the service door was, the water tank front right, and below them the flowmeter, vibration pump, thermoblock and solenoid valves joined by hoses that carry water to the brew group and coffee to the spout. A LatteGo milk frother and a cup stand on the drip tray.",
  body: [...back, `<g class="cf-machine">${groups.join("")}</g>`, `<g data-slot="streams" class="cf-streams"></g>`],
});

// ---------- page ----------
const MODEL = readFileSync(join(HERE, "model.mjs"), "utf8").replace(/^export /gm, "");
const GEOM = readFileSync(join(HERE, "geometry.mjs"), "utf8").replace(/^export /gm, "");
const LIVE = readFileSync(join(HERE, "live.js"), "utf8");
const CSS = readFileSync(join(HERE, "coffee.css"), "utf8");

const stage = `<div class="iso-stage cf-stage" tabindex="0" aria-label="Cutaway of the coffee machine. The part working at each stage of the brew lights up.">${svg}</div>`;
const plate = k.plateHtml({
  fig: "Fig 1",
  title: "Philips 5400 series",
  hint: "Pick a drink, press Brew",
  readout: "Ready · 22 °C · 0.0 bar",
  keys: [
    { mark: "lit", label: "The part working now" },
    { mark: "dotted", label: "Water, coffee, steam or grounds on the move" },
    { mark: "raised", label: "Right side panel and service door removed" },
  ],
  caption:
    "Water leaves the 1.8 L tank, is counted by the flowmeter, pressurised by the 15 bar vibration pump and heated on its way through the thermoblock. Solenoid valves send it to the brew group, the hot-water nozzle or, as steam, to the LatteGo. Beans drop from the 275 g hopper into the ceramic burrs and the grounds slide down a chute into the brew chamber. Doses, flow rates and stage times are representative for this kind of machine, not factory calibration.",
  body: stage,
});
const controls = readFileSync(join(HERE, "controls.html"), "utf8");
const body = `<div class="cf-app">${plate}${controls}</div>`;
const live = `${GEOM}\n${MODEL}\nconst P = ${JSON.stringify(P)};\nconst KS = ${KS};\nconst SCREEN = ${JSON.stringify(SCREEN)};\nconst KNOB = ${JSON.stringify(KNOB)};\n${LIVE}`;
const page = k.pageHtml({ title: "Philips 5400 Anatomy", theme: THEME, body, script: kitScript() + live, width: 1320 }).replace("</style>", `${CSS}</style>`);
const name = THEME === "light" ? "coffee-5400-light.html" : "coffee-5400.html";
writeFileSync(join(HERE, name), page);
console.log("wrote", name, `${(page.length / 1024).toFixed(0)} KB`, `${R.items.length} items`, `scale ${KS.toFixed(3)}`);
A.auditOrExit(R, P, {});
