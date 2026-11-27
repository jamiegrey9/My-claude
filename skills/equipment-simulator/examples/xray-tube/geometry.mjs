import * as k from "../../assets/kit/iso-kit.mjs";
import * as G from "../../assets/kit/lathe.mjs";
import { tubePieces, tubeSvg } from "../../assets/kit/tube.mjs";

export const WIDTH = 640;
export const HEIGHT = 470;

export const ZA = 150;
export const R_OUT = 46;
export const ANODE_S = 14;
export const ANODE_R = 27;
export const ANGLE = (12 * Math.PI) / 180;
export const TRACK_R = 23;
export const FX = ANODE_S + (TRACK_R - 8) * Math.tan(ANGLE);
export const FZ = ZA - TRACK_R;
export const CUP = { s0: -8, s1: 1.5, r: 7 };
export const COLL = { x0: FX - 28, x1: FX + 28, y0: -30, z0: 52, z1: 100 };
export const APERTURE = 16;
export const DET_Z = 8;
export const FIELD = (APERTURE * (FZ - DET_Z)) / (FZ - COLL.z0);
export const PLATE = { x: -168, y: -132, w: 336, d: 214, r: 8 };
export const COLUMN = { x: -11, y: -116, w: 22, d: 22, r: 2 };
export const COLUMN_TOP = 236;
export const RECEPT = [
  { x: -96, y: -22, part: "cathode-cable" },
  { x: 96, y: -22, part: "anode-cable" },
];

export const P = k.fitProjection(
  [...k.boxCorners(PLATE, -17, 0), [-130, 0, ZA + 50], [130, 0, ZA + 50], [0, -116, COLUMN_TOP + 4], [-96, -22, 232], [96, -22, 232]],
  WIDTH,
  HEIGHT,
  { pad: 22, azimuth: 118, elevation: 28 },
);

export const V = G.viewOf(P);
export const at = (p) => k.iso(p, P);
export const depth = (p) => G.dot3(p, V);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const f = (n) => (Math.round(n * 10) / 10).toString();
const poly = (pts) => k.pathOf(pts.map(at), true);
export const AX = G.frameOf([0, 0, ZA], [1, 0, 0], [0, 0, 1], [0, -1, 0]);

function cutLathe(regions, F, { steps = 64, phi = [0, Math.PI] } = {}) {
  const facets = [];
  const caps = [];
  const lines = [];
  const ang = (j) => phi[0] + ((phi[1] - phi[0]) * j) / steps;
  for (const region of regions) {
    const pts = region.section;
    const n = pts.length;
    const vis = [];
    for (let i = 0; i < n; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % n];
      const row = [];
      for (let j = 0; j < steps; j++) {
        if (a[1] < 0.01 && b[1] < 0.01) { row.push(false); continue; }
        const q = [G.pointOf(F, a[0], a[1], ang(j)), G.pointOf(F, b[0], b[1], ang(j)), G.pointOf(F, b[0], b[1], ang(j + 1)), G.pointOf(F, a[0], a[1], ang(j + 1))];
        const n1 = G.cross3(G.sub3(q[2], q[0]), G.sub3(q[3], q[1]));
        if (G.len3(n1) < 1e-7) { row.push(false); continue; }
        const normal = G.mul3(n1, region.flip ? -1 : 1);
        const seen = G.dot3(normal, V) > 0;
        row.push(seen);
        if (!seen) continue;
        const mid = q.reduce((m, p) => G.add3(m, G.mul3(p, 0.25)), [0, 0, 0]);
        facets.push({ d: depth(mid), path: poly(q), tone: G.toneOf(normal, P), cls: region.cls || "" });
      }
      vis.push(row);
      for (let j = 1; j < steps; j++) {
        if (row[j] !== row[j - 1]) lines.push(k.pathOf([at(G.pointOf(F, a[0], a[1], ang(j))), at(G.pointOf(F, b[0], b[1], ang(j)))]));
      }
    }
    for (let i = 0; i < n; i++) {
      const v = pts[i];
      if (v[1] < 0.01) continue;
      const before = vis[(i - 1 + n) % n];
      const after = vis[i];
      let run = [];
      const flush = () => { if (run.length > 1) lines.push(k.pathOf(run)); run = []; };
      for (let j = 0; j < steps; j++) {
        const draw = before[j] !== after[j] || (!v[2] && before[j] && after[j]);
        if (draw) {
          if (!run.length) run.push(at(G.pointOf(F, v[0], v[1], ang(j))));
          run.push(at(G.pointOf(F, v[0], v[1], ang(j + 1))));
        } else flush();
      }
      flush();
    }
    for (const p of phi) {
      const ring = pts.map(([s, r]) => G.pointOf(F, s, r, p));
      caps.push({ path: poly(ring), cls: region.cut || "cut", tone: region.edge || "hi" });
    }
  }
  facets.sort((x, y) => x.d - y.d);
  const body = facets.map((q) => `<path class="cf ${q.cls}" data-shade="${q.tone}" d="${q.path}"/>`).join("") + `<path class="iso-line" data-tone="${regions[0].line || "mid"}" d="${lines.join("")}"/>`;
  const sect = caps.map((c) => `<path class="cs ${c.cls}" d="${c.path}"/><path class="iso-line" data-tone="${c.tone}" d="${c.path}"/>`).join("");
  return { body, sect };
}

const part = (id, html, extra = "") => `<g class="part" data-part="${id}"${extra}>${html}</g>`;

function plate() {
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -17, 12, P)}"/>`];
  const feet = k.corners(PLATE, 22).sort((a, b) => depth([...a, 0]) - depth([...b, 0]));
  for (const [x, y] of feet) {
    out.push(S(k.cylinder(x, y, 7, -17, 1.6, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 5.4, -15.4, 3.4, P, 28), { tone: "mid" }));
  }
  out.push(S(k.slabOf(PLATE, -12, 12, P, 8, 1.6), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(PLATE, 5), 0, P), { tone: "lo" }));
  const screws = k.corners(PLATE, 10);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.2, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  const strip = { x: -150, y: PLATE.y + PLATE.d - 15, w: 120, d: 7, r: 1 };
  out.push(S(k.slabOf(strip, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(strip.x + 4, strip.x + strip.w - 4, 4, 5, strip.y + 0.8, 0.6, [2, 3.6], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  return out.join("");
}

function column() {
  const out = [];
  const flange = k.insetPlan(COLUMN, -8);
  out.push(S(k.slabOf(flange, 0, 6, P, 4, 0.8), { tone: "lo" }));
  out.push(D(k.corners(flange, 4).map(([x, y]) => at([x, y, 6])), { size: 0.5 }));
  out.push(S(k.slabOf(COLUMN, 6, COLUMN_TOP - 6, P, 3, 0.6), { tone: "mid", inner: L(k.sideSeam(COLUMN, 120, P, 3), { tone: "faint" }) }));
  out.push(S(k.slabOf(k.insetPlan(COLUMN, -1.5), COLUMN_TOP, 4, P, 3, 0.5), { tone: "mid" }));
  const carriage = { x: -15, y: -120, w: 30, d: 30, r: 2.5 };
  out.push(S(k.slabOf(carriage, ZA - 22, 44, P, 4, 0.8), { tone: "mid", inner: L(k.sideSeam(carriage, ZA, P, 4), { tone: "faint" }) }));
  const lock = [carriage.x + carriage.w + 3, -105];
  out.push(S(k.slabOf({ x: carriage.x + carriage.w, y: -107, w: 3, d: 4, r: 0.8 }, ZA + 10, 4, P, 2), { tone: "mid", crease: "none" }));
  out.push(S(k.cylinder(lock[0] + 1, lock[1], 3.2, ZA + 8, 8, P, 20), { tone: "mid" }));
  out.push(L(k.knurl(lock[0] + 1, lock[1], 3.2, ZA + 8, ZA + 16, 18, P), { tone: "lo" }));
  const arm = { x: -8, y: -90, w: 16, d: 40, r: 2 };
  out.push(S(k.slabOf(arm, ZA - 8, 16, P, 3, 0.6), { tone: "mid" }));
  out.push(D([at([0, -84, ZA + 8]), at([0, -58, ZA + 8])], { size: 0.5 }));
  return out.join("");
}

function cables() {
  const out = [];
  const routes = [
    [[-96, -22, 216], [-96, -22, 226], [-96, -100, 226], [-12, -100, 226]],
    [[96, -22, 216], [96, -22, 226], [96, -100, 226], [12, -100, 226]],
  ];
  routes.forEach((route, i) => {
    const pts = G.fillet(route, 9, 8, { P, tube: 3.2 });
    const pieces = tubePieces(pts, 3.2, P, { maxLength: 24 });
    const html = pieces.sort((a, b) => depth(a.mid) - depth(b.mid)).map((p) => tubeSvg(p, { tone: "mid" })).join("");
    out.push(part(RECEPT[i].part, html));
  });
  const clamp = { x: -14, y: -106, w: 28, d: 12, r: 2 };
  out.push(part("cathode-cable", S(k.slabOf(clamp, 220, 12, P, 3, 0.5), { tone: "mid" }) + D([at([-9, -100, 232]), at([9, -100, 232])], { size: 0.5 })));
  return out.join("");
}

function receptacle({ x, y, part: id }) {
  const out = [];
  const top = 216;
  const boss = { x: x - 11, y: y - 11, w: 22, d: 22, r: 11 };
  void boss;
  out.push(S(k.cylinder(x, y, 7.5, ZA + 4, top - 12 - ZA - 4, P, 36, 0.5), { tone: "mid", inner: L([ZA + 20, ZA + 34].map((z) => k.sideArc(x, y, 7.5, z, P, 24)).join(""), { tone: "faint" }) }));
  out.push(S(k.cylinder(x, y, 11, top - 12, 4, P, 40, 0.6), { tone: "mid" }));
  out.push(D(Array.from({ length: 6 }, (_, i) => [x + Math.cos(i * 1.047) * 9, y + Math.sin(i * 1.047) * 9]).filter(([px, py]) => (px - x) * -0.47 + (py - y) * 0.88 > -4).map(([px, py]) => at([px, py, top - 8])), { size: 0.45 }));
  out.push(S(k.cylinder(x, y, 6.5, top - 8, 6, P, 32, 0.4), { tone: "hi" }));
  out.push(L(k.knurl(x, y, 6.5, top - 7.4, top - 2.6, 30, P), { tone: "lo" }));
  out.push(S(k.cylinder(x, y, 4.4, top - 2, 2, P, 24), { tone: "mid" }));
  return part(id, out.join(""));
}

function housing() {
  const outer = [
    [-129, 0], [-129, 26], [-127.6, 36, 1], [-124.2, 43, 1], [-118, 46], [118, 46], [124.2, 43, 1], [127.6, 36, 1], [129, 26], [129, 0],
    [126.6, 0], [126.6, 25], [125.2, 34, 1], [122, 41.2, 1], [117, 44], [-117, 44], [-122, 41.2, 1], [-125.2, 34, 1], [-126.6, 25], [-126.6, 0],
  ];
  const lining = [
    [-126.6, 0], [-126.6, 25], [-125.2, 34, 1], [-122, 41.2, 1], [-117, 44], [117, 44], [122, 41.2, 1], [125.2, 34, 1], [126.6, 25], [126.6, 0],
    [125, 0], [125, 24], [123.6, 32.6, 1], [120.6, 39.6, 1], [116, 42.4], [-116, 42.4], [-120.6, 39.6, 1], [-123.6, 32.6, 1], [-125, 24], [-125, 0],
  ];
  const yoke = [[-10, 46], [-10, 50], [10, 50], [10, 46]];
  const c = cutLathe(
    [
      { section: outer, cut: "cut-al", edge: "hi" },
      { section: lining, cut: "cut-pb", edge: "mid" },
      { section: yoke, cut: "cut-al", edge: "hi" },
    ],
    AX,
    { steps: 72 },
  );
  return c;
}

function stator() {
  const sec = [[52, 19.5], [52, 31], [92, 31], [92, 19.5]];
  const c = cutLathe([{ section: sec, cut: "cut-cu", edge: "mid" }], AX, { steps: 48 });
  const winding = [];
  for (const sign of [1, -1]) {
    for (let s = 55; s <= 89; s += 3.4) {
      for (let r = 22.5; r <= 28.5; r += 3) winding.push(at([s, 0, ZA + sign * r]));
    }
  }
  return { body: c.body, sect: c.sect + D(winding, { size: 0.9, tone: "mid" }) };
}

const GLASS_OUT = [[-104, 8], [-104, 12.5], [-66, 12.5], [-56, 24, 1], [-44, 33, 1], [-30, 37.5, 1], [-12, 38.5], [36, 38.5], [46, 34, 1], [54, 22, 1], [60, 17.5], [100, 17.5], [104, 13, 1], [106, 8]];
const GLASS_IN = [[104.5, 8], [102.6, 12, 1], [98.8, 16], [61.2, 16], [52.6, 21, 1], [44.6, 32.8, 1], [35.6, 37], [-12, 37], [-29.6, 36, 1], [-43, 31.8, 1], [-54.6, 23, 1], [-64.6, 11], [-102.5, 11], [-102.5, 8]];

function glass() {
  return cutLathe([{ section: [...GLASS_OUT, ...GLASS_IN], cls: "glass", cut: "cut-glass", edge: "mid" }], AX, { steps: 64 });
}

function rotor(phase) {
  const out = [];
  out.push(S(G.disc(96, 108, 4.5, AX, P), { tone: "mid" }));
  out.push(S(G.disc(102, 106, 7, AX, P), { tone: "mid" }));
  const body = G.solidOf([[44, 10], [46, 12.5], [94, 12.5], [96, 10]], AX, P);
  const ribs = G.ribsOf(AX, 47, 93, 12.5, 24, P, { phase, fade: [0.08, 0.5] });
  out.push(S(body, { tone: "hi", inner: k.fadedSvg(ribs, { tone: "lo" }) + L(G.arcOf(AX, 58, 12.5, P) + G.arcOf(AX, 82, 12.5, P), { tone: "faint" }) }));
  return out.join("");
}

export function rotorRibs(phase) {
  return k.fadedSvg(G.ribsOf(AX, 47, 93, 12.5, 24, P, { phase, fade: [0.08, 0.5] }), { tone: "lo" });
}

function stem() {
  return S(G.disc(30, 44, 3.6, AX, P), { tone: "mid" }) + S(G.disc(40, 44.5, 6, AX, P), { tone: "mid" });
}

function graphite() {
  return S(G.solidOf([[22, 22], [24, 24.5], [29, 24.5], [31, 22]], AX, P), { tone: "lo" });
}

const ANODE_PROFILE = [[ANODE_S - 4, 4], [ANODE_S - 4, 7], [ANODE_S, 8], [ANODE_S + (ANODE_R - 8) * Math.tan(ANGLE), ANODE_R], [22, ANODE_R], [22, 4]];

function anode() {
  return S(G.lathe([[ANODE_S - 4, 0], ...ANODE_PROFILE, [22, 0]], AX, P), { tone: "hi" });
}

export function anodeFace(phase) {
  const out = [];
  const coneS = (r) => ANODE_S + (r - 8) * Math.tan(ANGLE);
  const lines = [];
  const N = 8;
  for (let i = 0; i < N; i++) {
    const a = phase + (i / N) * Math.PI * 2;
    const p0 = G.pointOf(AX, coneS(16), 16, a);
    const p1 = G.pointOf(AX, coneS(ANODE_R) - 0.05, ANODE_R - 0.05, a);
    lines.push(k.pathOf([at(p0), at(p1)]));
  }
  out.push(`<path class="iso-line" data-tone="mid" d="${lines.join("")}"/>`);
  const track = [];
  for (const r of [TRACK_R - 1.6, TRACK_R + 1.6]) {
    const pts = Array.from({ length: 73 }, (_, i) => at(G.pointOf(AX, coneS(r), r, (i / 72) * Math.PI * 2)));
    track.push(k.pathOf(pts));
  }
  out.push(`<path class="iso-line" data-tone="lo" d="${track.join("")}"/>`);
  return out.join("");
}

function hubNut() {
  return S(G.disc(ANODE_S - 7, ANODE_S - 3.8, 5, AX, P), { tone: "mid" }) + S(G.disc(ANODE_S - 8.5, ANODE_S - 7, 2.6, AX, P), { tone: "mid" });
}

export const CUP_F = G.frameOf([0, 0, FZ], [1, 0, 0], [0, 0, 1], [0, -1, 0]);

function cathode() {
  const out = [];
  out.push(S(G.disc(-104, -100, 9, AX, P), { tone: "mid" }));
  out.push(S(G.disc(-100, -60, 4, AX, P), { tone: "mid" }));
  out.push(S(G.disc(-62, -56, 6, AX, P), { tone: "mid" }));
  const armF = G.frameAlong([-58, 0, ZA], G.unit3([46, 0, -(ZA - FZ)]));
  const len = Math.hypot(46, ZA - FZ);
  out.push(S(G.disc(0, len, 2.8, armF, P), { tone: "mid" }));
  out.push(S(G.disc(-14, CUP.s0, 5, CUP_F, P), { tone: "mid" }));
  const cup = cutLathe([{ section: [[CUP.s0, 0], [CUP.s0, CUP.r], [CUP.s1, CUP.r], [CUP.s1, 5.6], [CUP.s1 - 3.2, 5.6], [CUP.s1 - 3.2, 0]], cut: "cut-al", edge: "hi", line: "hi" }], CUP_F, { steps: 40 });
  out.push(cup.body, cup.sect);
  return out.join("");
}

function filaments() {
  const out = [];
  for (const [y, len, id] of [[-1.4, 3.4, "small"], [-4.1, 6, "large"]]) {
    const pts = [];
    for (let i = 0; i <= 60; i++) {
      const t = i / 60;
      const a = t * Math.PI * 2 * 7;
      pts.push(at([CUP.s1 - 1.6 + Math.cos(a) * 0.9, y + Math.sin(a) * 0.9, FZ - len / 2 + len * t]));
    }
    out.push(`<path class="iso-line filament" data-fil="${id}" data-tone="hi" data-free="both" d="${k.pathOf(pts)}"/>`);
  }
  return out.join("");
}

function port() {
  const F = G.frameOf([FX, 0, ZA - 42], [0, 0, -1], [1, 0, 0], [0, -1, 0]);
  const c = cutLathe(
    [
      { section: [[2, 12], [2, 20], [9, 20], [9, 12]], cut: "cut-al", edge: "hi" },
      { section: [[3.5, 0], [3.5, 12], [4.5, 12], [4.5, 0]], cut: "cut-be", edge: "mid" },
    ],
    F,
    { steps: 40 },
  );
  const filt = cutLathe([{ section: [[9, 0], [9, 16], [10.6, 16], [10.6, 0]], cut: "cut-filter", edge: "mid" }], F, { steps: 40 });
  return { body: c.body + filt.body, sect: c.sect, filter: filt.sect };
}

function collimatorBack() {
  const out = [];
  const { x0, x1, y0, z0, z1 } = COLL;
  const t = 2.2;
  out.push(`<path class="iso-halo" d="${k.haloOf({ x: x0, y: y0, w: x1 - x0, d: -y0, r: 2 }, z0, 2, P)}" style="opacity:.0"/>`);
  out.push(S(k.slabOf({ x: x0, y: y0, w: x1 - x0, d: t, r: 1 }, z0, z1 - z0, P, 2, 0.4), { tone: "mid" }));
  out.push(S(k.slabOf({ x: x1 - t, y: y0, w: t, d: -y0, r: 0.6 }, z0, z1 - z0, P, 2), { tone: "mid" }));
  return out.join("");
}

function collimatorFront() {
  const out = [];
  const { x0, x1, y0, z0, z1 } = COLL;
  const t = 2.2;
  const plate = (z, h, gap) => {
    out.push(S(k.slabOf({ x: x0, y: y0, w: FX - gap - x0, d: -y0, r: 0.6 }, z, h, P, 2, 0.4), { tone: "mid" }));
    out.push(S(k.slabOf({ x: FX + gap, y: y0, w: x1 - FX - gap, d: -y0, r: 0.6 }, z, h, P, 2, 0.4), { tone: "mid" }));
  };
  plate(z0, 3, APERTURE + 4);
  out.push(S(k.slabOf({ x: x0, y: y0, w: t, d: -y0, r: 0.6 }, z0, z1 - z0, P, 2), { tone: "mid", inner: L(k.segment([x0, -14, z0 + 3], [x0, -14, z1 - 3], P), { tone: "faint" }) }));
  plate(z1 - 3, 3, 12);
  return out.join("");
}

function shutters(open) {
  const out = [];
  const { y0 } = COLL;
  const up = 88;
  const lo = 58;
  const upGap = open * (12 * (FZ - up) / (FZ - COLL.z0)) / 1;
  const loGap = open * APERTURE * (FZ - lo) / (FZ - COLL.z0);
  for (const [z, gap, h] of [[up, upGap, 4], [lo, loGap, 5]]) {
    out.push(S(k.slabOf({ x: COLL.x0 + 2.4, y: y0 + 2.4, w: FX - gap - COLL.x0 - 2.4, d: -y0 - 2.4, r: 0.4 }, z, h, P, 2, 0.3), { tone: "lo" }));
    out.push(S(k.slabOf({ x: FX + gap, y: y0 + 2.4, w: COLL.x1 - 2.4 - FX - gap, d: -y0 - 2.4, r: 0.4 }, z, h, P, 2, 0.3), { tone: "lo" }));
  }
  return out.join("");
}

function mirror() {
  const a = [FX - 13, 0, 66];
  const b = [FX + 13, 0, 66 + 26];
  const q = [[a[0], COLL.y0 + 2.4, a[2]], [b[0], COLL.y0 + 2.4, b[2]], [b[0], 0, b[2]], [a[0], 0, a[2]]];
  return `<path class="mirror" d="${poly(q)}"/><path class="iso-line" data-tone="mid" d="${poly(q)}"/>`;
}

function lamp() {
  const F = G.frameOf([COLL.x1 - 2.2, -15, 79], [-1, 0, 0], [0, 0, 1], [0, -1, 0]);
  const out = [];
  out.push(S(G.disc(0, 5, 3.6, F, P), { tone: "mid" }));
  out.push(`<g class="lamp-bulb">${S(G.sphereOf(G.pointOf(F, 8, 0, 0), 3.6, P), { tone: "hi" })}</g>`);
  return out.join("");
}

function knobs() {
  const out = [];
  for (const z of [64, 88]) {
    const F = G.frameOf([COLL.x0, -15, z], [-1, 0, 0], [0, 0, 1], [0, -1, 0]);
    out.push(S(G.disc(0, 2, 3, F, P), { tone: "mid" }));
    const knob = G.disc(2, 7, 5.5, F, P);
    out.push(S(knob, { tone: "mid", inner: k.fadedSvg(G.ribsOf(F, 2.3, 6.7, 5.5, 30, P, { fade: [0.05, 0.4] }), { tone: "lo" }) }));
  }
  return out.join("");
}

function detector() {
  const out = [];
  const plan = { x: FX - 58, y: -52, w: 116, d: 104, r: 4 };
  out.push(`<path class="iso-halo" d="${k.haloOf(plan, 0, 1, P)}" style="filter:blur(5px)"/>`);
  out.push(S(k.slabOf(plan, 0, DET_Z, P, 4, 0.8), { tone: "mid", inner: L(k.sideSeam(plan, 3, P, 4), { tone: "faint" }) }));
  const field = { x: FX - FIELD, y: -FIELD, w: FIELD * 2, d: FIELD * 2, r: 0.5 };
  out.push(`<path class="det-glow" d="${poly(k.ringOf(field, 1).map(([x, y]) => [x, y, DET_Z]))}"/>`);
  out.push(L(k.planOutline(k.insetPlan(plan, 4), DET_Z, P, 4), { tone: "lo" }));
  const cross = [k.lineOnTop([FX - 6, 0], [FX + 6, 0], DET_Z, P), k.lineOnTop([FX, -6], [FX, 6], DET_Z, P)].join("");
  out.push(L(cross, { tone: "faint", free: true }));
  out.push(D(k.corners(plan, 6).map(([x, y]) => at([x, y, DET_Z])), { size: 0.5 }));
  const handle = { x: plan.x + plan.w - 30, y: plan.y + plan.d, w: 20, d: 3, r: 1 };
  out.push(S(k.slabOf(handle, 2, 4, P, 2), { tone: "mid", crease: "none" }));
  return out.join("");
}

export const STEPS = [3, 6, 9, 12, 15];
export const WEDGE = { x0: FX - 30, w: 12, y0: -12, d: 24 };

function wedge() {
  const out = [];
  STEPS.forEach((h, i) => {
    const plan = { x: WEDGE.x0 + i * WEDGE.w, y: WEDGE.y0, w: WEDGE.w, d: WEDGE.d, r: 0.3 };
    out.push(S(k.slabOf(plan, DET_Z, h, P, 2, 0.4), { tone: "hi" }));
  });
  return out.join("");
}

function console_() {
  const out = [];
  const plan = { x: -150, y: 18, w: 70, d: 46, r: 3 };
  out.push(`<path class="iso-halo" d="${k.haloOf(plan, 0, 4, P)}" style="filter:blur(5px)"/>`);
  out.push(S(k.slabOf(plan, 0, 22, P, 4, 0.8), { tone: "mid", inner: L(k.sideSeam(plan, 6, P, 4), { tone: "faint" }) }));
  const face = { x: plan.x + 4, y: plan.y + 4, w: plan.w - 8, d: plan.d - 8, r: 2 };
  out.push(L(k.planOutline(face, 22, P, 3), { tone: "lo" }));
  const disp = [["kV", plan.x + 8], ["mA", plan.x + 30], ["ms", plan.x + 52]];
  for (const [name, x] of disp) {
    const win = { x, y: plan.y + 8, w: 16, d: 9, r: 0.6 };
    out.push(S(k.slabOf(win, 22, 0.6, P, 2), { tone: "lo", crease: "none" }));
    out.push(`<g data-disp="${name}">${k.faceTextSvg(k.topMatrix([x + 2, plan.y + 15], 22.6, P, "x"), "080", { size: 5.2, tone: "hi" })}</g>`);
    out.push(k.faceTextSvg(k.topMatrix([x + 2, plan.y + 21], 22, P, "x"), name, { size: 3, tone: "lo" }));
  }
  for (const [i, x] of [[0, plan.x + 16], [1, plan.x + 38]]) {
    out.push(S(k.cylinder(x, plan.y + 30, 4.5, 22, 3, P, 28), { tone: "mid" }));
    out.push(L(k.knurl(x, plan.y + 30, 4.5, 22, 25, 22, P), { tone: "lo" }));
    out.push(L(k.lineOnTop([x, plan.y + 30], [x + (i ? 3 : -2), plan.y + 26.5], 25, P), { tone: "hi" }));
  }
  const btn = [plan.x + 58, plan.y + 31];
  out.push(S(k.cylinder(btn[0], btn[1], 6, 22, 2, P, 32), { tone: "mid" }));
  out.push(`<g class="expose-btn">${S(k.cylinder(btn[0], btn[1], 4.4, 24, 2.4, P, 32), { tone: "hi", lit: true })}</g>`);
  return out.join("");
}

export function build() {
  const H = housing();
  const ST = stator();
  const GL = glass();
  const PT = port();
  const body = [
    plate(),
    part("stand", column()),
    part("detector", detector()),
    part("phantom", wedge()),
    `<g class="beam-out"></g>`,
    part("console", console_()),
    part("collimator", collimatorBack()),
    `<g class="beam-coll"></g>`,
    part("collimator", shutters(1) + mirror() + lamp()),
    part("collimator", collimatorFront() + knobs()),
    cables(),
    part("housing", H.body),
    RECEPT.map(receptacle).join(""),
    part("housing", H.sect),
    part("window", PT.body + PT.sect),
    part("filter", PT.filter),
    part("stator", ST.body),
    part("stator", ST.sect),
    part("envelope", GL.body),
    part("envelope", GL.sect),
    `<g class="beam-in"></g>`,
    part("rotor", `<g class="rotor">${rotor(0)}</g>`),
    part("stem", stem()),
    part("anode", graphite() + anode() + `<g class="anode-face">${anodeFace(0)}</g>` + hubNut()),
    `<g class="heat"></g>`,
    `<g class="electrons"></g>`,
    part("cathode", cathode()),
    part("filament", filaments()),
    `<g class="cloud"></g>`,
  ];
  return k.figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label: "A rotating-anode X-ray tube in its lead-lined oil-filled housing, drawn in half section, hung from a tube stand over a flat-panel detector with an aluminium step wedge. A collimator under the tube port shapes the beam.",
    body,
  });
}

export function extras() {
  const O = at([0, 0, 0]);
  const ex = G.sub3([...at([1, 0, 0]), 0], [...O, 0]).slice(0, 2);
  const ey = G.sub3([...at([0, 1, 0]), 0], [...O, 0]).slice(0, 2);
  const ez = G.sub3([...at([0, 0, 1]), 0], [...O, 0]).slice(0, 2);
  const anodeFrames = Array.from({ length: 12 }, (_, i) => anodeFace((i / 12) * (Math.PI / 4)));
  const rotorFrames = Array.from({ length: 12 }, (_, i) => rotorRibs((i / 12) * (Math.PI / 12)));
  const coneS = (r) => ANODE_S + (r - 8) * Math.tan(ANGLE);
  const track = k.pathOf(Array.from({ length: 97 }, (_, i) => at(G.pointOf(AX, coneS(TRACK_R), TRACK_R, (i / 96) * Math.PI * 2))));
  const field = (z, h) => [[FX - h, -h, z], [FX + h, -h, z], [FX + h, h, z], [FX - h, h, z]];
  const top = field(COLL.z0, APERTURE);
  const bottom = field(DET_Z, FIELD);
  const hull = G.hullOf([...top, ...bottom].map(at));
  const beamOut = k.pathOf(hull, true);
  const beamEdges = top.map((p, i) => k.pathOf([at(p), at(bottom[i])])).join("") + k.pathOf(bottom.map(at), true);
  const sect = [[FX, 0, FZ], [FX + 12 * (FZ - 100) / (FZ - COLL.z0) * 0 + APERTURE * (FZ - COLL.z1) / (FZ - COLL.z0), 0, COLL.z1], [FX + APERTURE, 0, COLL.z0], [FX - APERTURE, 0, COLL.z0], [FX - APERTURE * (FZ - COLL.z1) / (FZ - COLL.z0), 0, COLL.z1]];
  const beamIn = k.pathOf(sect.map(at), true);
  const wide = [[FX, 0, FZ], [FX + 40, 0, ZA - 42.4], [FX - 40, 0, ZA - 42.4]];
  const beamWide = k.pathOf(wide.map(at), true);
  const anchors = {
    stand: [0, -105, 200], detector: [FX + 40, 30, DET_Z], phantom: [FX - 10, 0, DET_Z + 14], console: [-115, 40, 22],
    collimator: [COLL.x0, -15, 76], "cathode-cable": [-96, -60, 226], "anode-cable": [96, -60, 226], housing: [-60, 0, ZA + 46],
    window: [FX, 0, ZA - 46], filter: [FX + 14, 0, ZA - 52], stator: [72, 0, ZA + 31], envelope: [-40, 0, ZA + 34],
    rotor: [70, 0, ZA + 12], stem: [37, 0, ZA + 6], anode: [ANODE_S + 4, 0, ZA + 27], cathode: [-6, 0, FZ - 7], filament: [CUP.s1, -3, FZ],
  };
  const anchorPx = Object.fromEntries(Object.entries(anchors).map(([key, p]) => [key, at(p)]));
  return {
    O, ex, ey, ez, anodeFrames, rotorFrames, track, beamOut, beamEdges, beamIn, beamWide, anchorPx,
    filament: at([CUP.s1 - 1.6, -2.8, FZ]), spot: at([FX, 0, FZ]),
    world: { FX, FZ, ZA, DET_Z, FIELD, APERTURE, COLLZ0: COLL.z0, COLLZ1: COLL.z1, CUPS1: CUP.s1, LINING: 42.4, WEDGE, STEPS },
    lampAt: at([COLL.x1 - 12, -15, 79]),
    btn: at([-150 + 58, 18 + 31, 26.4]),
  };
}

export function models() {
  const Fr = (F) => ({ o: F.o, a: F.a, u: F.u, v: F.v });
  const ax = Fr(AX);
  const HALF = [0, Math.PI];
  const rev = (F, sec, t, phi = null) => ({ k: "rev", F: Fr(F), sec: sec.map(([s, r]) => [s, r]), t, phi });
  const disc = (F, s0, s1, r, t) => rev(F, [[s0, 0], [s0, r], [s1, r], [s1, 0]], t);
  const solid = (F, prof, t) => rev(F, [[prof[0][0], 0], ...prof, [prof[prof.length - 1][0], 0]], t);
  const box = (x0, y0, z0, x1, y1, z1, t) => ({ k: "box", a: [x0, y0, z0], b: [x1, y1, z1], t });
  const plan = (p, z0, z1, t) => box(p.x, p.y, z0, p.x + p.w, p.y + p.d, z1, t);
  const vert = (x, y) => ({ o: [x, y, 0], a: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] });
  const coneS = (r) => ANODE_S + (r - 8) * Math.tan(ANGLE);
  const ring = (r, t) => ({ k: "line", t, pts: Array.from({ length: 97 }, (_, i) => G.pointOf(AX, coneS(r) - 0.05, r, (i / 96) * Math.PI * 2)) });
  const M = {};
  M.housing = [
    rev(ax, [[-129, 0], [-129, 26], [-127.6, 36], [-124.2, 43], [-118, 46], [118, 46], [124.2, 43], [127.6, 36], [129, 26], [129, 0], [126.6, 0], [126.6, 25], [125.2, 34], [122, 41.2], [117, 44], [-117, 44], [-122, 41.2], [-125.2, 34], [-126.6, 25], [-126.6, 0]], "mid", HALF),
    rev(ax, [[-126.6, 0], [-126.6, 25], [-125.2, 34], [-122, 41.2], [-117, 44], [117, 44], [122, 41.2], [125.2, 34], [126.6, 25], [126.6, 0], [125, 0], [125, 24], [123.6, 32.6], [120.6, 39.6], [116, 42.4], [-116, 42.4], [-120.6, 39.6], [-123.6, 32.6], [-125, 24], [-125, 0]], "lead", HALF),
    rev(ax, [[-10, 46], [-10, 50], [10, 50], [10, 46]], "mid", HALF),
  ];
  M.stator = [rev(ax, [[52, 19.5], [52, 31], [92, 31], [92, 19.5]], "copper", HALF)];
  M.envelope = [rev(ax, [...GLASS_OUT, ...GLASS_IN], "glass", HALF)];
  M.rotor = [disc(ax, 96, 108, 4.5, "mid"), disc(ax, 102, 106, 7, "mid"), solid(ax, [[44, 10], [46, 12.5], [94, 12.5], [96, 10]], "copper")];
  M.stem = [disc(ax, 30, 44, 3.6, "mid"), disc(ax, 40, 44.5, 6, "mid")];
  const slots = [];
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; slots.push({ k: "line", t: "ink", pts: [G.pointOf(AX, coneS(16) - 0.05, 16, a), G.pointOf(AX, coneS(ANODE_R) - 0.08, ANODE_R - 0.1, a)] }); }
  M.anode = [solid(ax, [[22, 22], [24, 24.5], [29, 24.5], [31, 22]], "lo"), rev(ax, [[ANODE_S - 4, 0], ...ANODE_PROFILE, [22, 0]], "hi"), disc(ax, ANODE_S - 7, ANODE_S - 3.8, 5, "mid"), disc(ax, ANODE_S - 8.5, ANODE_S - 7, 2.6, "mid"), ring(TRACK_R - 1.6, "heat"), ring(TRACK_R + 1.6, "heat"), ...slots];
  const armF = G.frameAlong([-58, 0, ZA], G.unit3([46, 0, -(ZA - FZ)]));
  const len = Math.hypot(46, ZA - FZ);
  M.cathode = [disc(ax, -104, -100, 9, "mid"), disc(ax, -100, -60, 4, "mid"), disc(ax, -62, -56, 6, "mid"), disc(Fr(armF), 0, len, 2.8, "mid"), disc(Fr(CUP_F), -14, CUP.s0, 5, "mid"),
    rev(Fr(CUP_F), [[CUP.s0, 0], [CUP.s0, CUP.r], [CUP.s1, CUP.r], [CUP.s1, 5.6], [CUP.s1 - 3.2, 5.6], [CUP.s1 - 3.2, 0]], "hi", HALF)];
  M.filament = [-1.4, -4.1].map((y, i) => {
    const L2 = i ? 6 : 3.4;
    return { k: "tube", r: 0.28, t: "heat", pts: Array.from({ length: 121 }, (_, j) => { const t = j / 120, a = t * Math.PI * 2 * 7; return [CUP.s1 - 1.6 + Math.cos(a) * 0.9, y + Math.sin(a) * 0.9, FZ - L2 / 2 + L2 * t]; }) };
  });
  M.filament.push(box(CUP.s1 - 3.2, -6, FZ - 1, CUP.s1 - 2.6, 0, FZ + 1, "mid"));
  const PF = { o: [FX, 0, ZA - 42], a: [0, 0, -1], u: [1, 0, 0], v: [0, -1, 0] };
  M.window = [rev(PF, [[2, 12], [2, 20], [9, 20], [9, 12]], "mid", HALF), rev(PF, [[3.5, 0], [3.5, 12], [4.5, 12], [4.5, 0]], "glass", HALF)];
  M.filter = [rev(PF, [[9, 0], [9, 16], [10.6, 16], [10.6, 0]], "alu", HALF)];
  const { x0, x1, y0, z0, z1 } = COLL;
  const t = 2.2;
  const up = 88, lo = 58;
  const upGap = 12 * (FZ - up) / (FZ - COLL.z0), loGap = APERTURE * (FZ - lo) / (FZ - COLL.z0);
  const lampF = { o: [COLL.x1 - 2.2, -15, 79], a: [-1, 0, 0], u: [0, 0, 1], v: [0, -1, 0] };
  M.collimator = [
    box(x0, y0, z0, x1, y0 + t, z1, "mid"), box(x1 - t, y0, z0, x1, 0, z1, "mid"), box(x0, y0, z0, x0 + t, 0, z1, "mid"),
    box(x0, y0, z0, FX - APERTURE - 4, 0, z0 + 3, "mid"), box(FX + APERTURE + 4, y0, z0, x1, 0, z0 + 3, "mid"),
    box(x0, y0, z1 - 3, FX - 12, 0, z1, "mid"), box(FX + 12, y0, z1 - 3, x1, 0, z1, "mid"),
    ...[[up, upGap, 4], [lo, loGap, 5]].flatMap(([z, g, h]) => [box(x0 + 2.4, y0 + 2.4, z, FX - g, 0, z + h, "lead"), box(FX + g, y0 + 2.4, z, x1 - 2.4, 0, z + h, "lead")]),
    { k: "quad", t: "glass", pts: [[FX - 13, y0 + 2.4, 66], [FX + 13, y0 + 2.4, 92], [FX + 13, 0, 92], [FX - 13, 0, 66]] },
    disc(lampF, 0, 5, 3.6, "mid"), { k: "sph", c: G.pointOf(lampF, 8, 0, 0), r: 3.6, t: "hi" },
    ...[64, 88].flatMap((z) => { const F = { o: [x0, -15, z], a: [-1, 0, 0], u: [0, 0, 1], v: [0, -1, 0] }; return [disc(F, 0, 2, 3, "mid"), disc(F, 2, 7, 5.5, "mid")]; }),
  ];
  const routes = [
    [[-96, -22, 216], [-96, -22, 226], [-96, -100, 226], [-12, -100, 226]],
    [[96, -22, 216], [96, -22, 226], [96, -100, 226], [12, -100, 226]],
  ];
  RECEPT.forEach(({ x, y, part: id }, i) => {
    const F = vert(x, y);
    M[id] = [{ k: "tube", r: 3.2, t: "lo", pts: G.fillet(routes[i], 9, 8, { P, tube: 3.2 }) }, disc(F, ZA + 4, 204, 7.5, "mid"), disc(F, 204, 208, 11, "mid"), disc(F, 208, 214, 6.5, "hi"), disc(F, 214, 216, 4.4, "mid")];
  });
  M["cathode-cable"].push(box(-14, -106, 220, 14, -94, 232, "mid"));
  M.phantom = STEPS.map((h, i) => box(WEDGE.x0 + i * WEDGE.w, WEDGE.y0, DET_Z, WEDGE.x0 + (i + 1) * WEDGE.w, WEDGE.y0 + WEDGE.d, DET_Z + h, "alu"));
  const det = { x: FX - 58, y: -52, w: 116, d: 104 };
  M.detector = [plan(det, 0, DET_Z, "mid"), box(det.x + det.w - 30, det.y + det.d, 2, det.x + det.w - 10, det.y + det.d + 3, 6, "mid"), box(FX - FIELD, -FIELD, DET_Z, FX + FIELD, FIELD, DET_Z + 0.3, "lo")];
  const con = { x: -150, y: 18, w: 70, d: 46 };
  M.console = [plan(con, 0, 22, "mid"), ...[con.x + 8, con.x + 30, con.x + 52].map((x) => box(x, con.y + 8, 22, x + 16, con.y + 17, 22.6, "lo")),
    ...[con.x + 16, con.x + 38].map((x) => disc(vert(x, con.y + 30), 22, 25, 4.5, "mid")), disc(vert(con.x + 58, con.y + 31), 22, 24, 6, "mid"), disc(vert(con.x + 58, con.y + 31), 24, 26.4, 4.4, "heat")];
  const fl = { x: COLUMN.x - 8, y: COLUMN.y - 8, w: COLUMN.w + 16, d: COLUMN.d + 16 };
  M.stand = [plan(fl, 0, 6, "lo"), plan(COLUMN, 6, COLUMN_TOP, "mid"), box(COLUMN.x - 1.5, COLUMN.y - 1.5, COLUMN_TOP, COLUMN.x + COLUMN.w + 1.5, COLUMN.y + COLUMN.d + 1.5, COLUMN_TOP + 4, "mid"),
    box(-15, -120, ZA - 22, 15, -90, ZA + 22, "mid"), box(15, -107, ZA + 10, 18, -103, ZA + 14, "mid"), disc(vert(19, -105), ZA + 8, ZA + 16, 3.2, "mid"), box(-8, -90, ZA - 8, 8, -50, ZA + 8, "mid")];
  const round = (v) => (Array.isArray(v) ? v.map(round) : typeof v === "number" ? Math.round(v * 1000) / 1000 : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([a, b]) => [a, round(b)])) : v);
  return round(M);
}
