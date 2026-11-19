// Geometry for the CRC-55tR figure. World units are about 2 mm of the real thing:
// x and y on the floor, z up. The chamber stands at the origin, the readout to its right.
import * as k from "./kit/iso-kit.mjs";

export const WIDTH = 780;
export const HEIGHT = 500;
const AZ = 45;
const WEDGE = [0, 90]; // the cutaway removes this sector, centred on the viewer
const deg = (d) => (d * Math.PI) / 180;

// ---- chamber dimensions (CRC-55tR: 17.2 cm diameter, 43.8 cm tall, well 6.1 cm × 25.4 cm) ----
export const CH = {
  flange: { r0: 45, r1: 54, z0: 0, z1: 4 },
  shield: { r0: 45, r1: 50, z0: 4, z1: 158 },
  housing: { r0: 41, r1: 43, z0: 0, z1: 219 },
  base: { r0: 0, r1: 41, z0: 0, z1: 8 },
  outer: { r0: 34.8, r1: 37.4, z0: 14, z1: 203 },
  collector: { r0: 24.8, r1: 27.2, z0: 60, z1: 194 },
  ins1: { r0: 24.2, r1: 27.8, z0: 194, z1: 201 },
  guard: { r0: 23.6, r1: 28.4, z0: 201, z1: 204 },
  ins2: { r0: 24.2, r1: 27.8, z0: 204, z1: 209 },
  cap: { r0: 17, r1: 41, z0: 209, z1: 219 },
  wellFloor: { r0: 0, r1: 17, z0: 88, z1: 92 },
  well: { r0: 15.25, r1: 17, z0: 92, z1: 219 },
  linerFloor: { r0: 0, r1: 15.25, z0: 92, z1: 93 },
  liner: { r0: 14.3, r1: 15.25, z0: 93, z1: 219 },
  lip: { r0: 14.3, r1: 19.5, z0: 219, z1: 222 },
};

// ---- readout (console) ----
export const CON = {
  plan: { x: 100, y: -166, w: 112, d: 84, r: 3 },
  wall: 2.6,
  wallH: 20,
  floorH: 3,
};
const C = CON.plan;
export const BOARDS = [
  { part: "bias", y: -144, x0: C.x + 8, x1: C.x + C.w - 10, h: 34 },
  { part: "electrometer", y: -128, x0: C.x + 8, x1: C.x + C.w - 10, h: 34 },
  { part: "adc", y: -112, x0: C.x + 8, x1: C.x + C.w - 10, h: 34 },
];
export const PANEL = { x0: C.x + 6, x1: C.x + C.w - 6, y0: C.y + 4, y1: C.y + 14, z0: CON.floorH, z1: 124 };
export const SCREEN = { x0: PANEL.x0 + 7, x1: PANEL.x1 - 7, z0: 70, z1: 117 };

// connectors and cable route
const CONN_T = -24;
export const CHAMBER_PLUG = { t: CONN_T, z: 186 };
export const CONSOLE_PLUG = [C.x + 20, C.y + C.d, 11];

export const P = k.fitProjection(
  [
    ...k.boxCorners({ x: -56, y: -56, w: 112, d: 112 }, 0, 0),
    [0, 0, 250],
    [-43, 43, 222],
    [43, -43, 222],
    ...k.boxCorners(C, 0, PANEL.z1),
  ],
  WIDTH,
  HEIGHT,
  { pad: 30, azimuth: AZ },
);

const S = (p) => k.iso(p, P);
const pt = (r, t, z) => [r * Math.cos(deg(t)), r * Math.sin(deg(t)), z];
const f1 = (v) => (Math.round(v * 10) / 10).toString();
const poly = (pts) => "M" + pts.map((p) => S(p).map(f1).join(" ")).join("L") + "Z";
const line = (pts) => "M" + pts.map((p) => S(p).map(f1).join(" ")).join("L");
const { sinA, cosA } = k.cameraOf(P);
const LIGHT = [-sinA, cosA];
const shadeOf = (nx, ny) => Math.max(0, Math.min(3, Math.floor(((nx * LIGHT[0] + ny * LIGHT[1] + 1) / 2) * 4)));
const arc = (r, t0, t1, z, step = 3) => {
  const n = Math.max(1, Math.ceil(Math.abs(t1 - t0) / step));
  return Array.from({ length: n + 1 }, (_, i) => pt(r, t0 + ((t1 - t0) * i) / n, z));
};

// One piece of a solid, painted the kit's way: paper fill, shades by facing, top, then the edge.
function piece({ fill, shades = [[], [], [], []], top = "", edge, tone = "mid", crease = "", lit = false }) {
  const out = [`<path class="iso-fill" d="${fill}"/>`];
  shades.forEach((list, i) => list.length && out.push(`<path class="iso-shade" data-shade="${i}" d="${list.join("")}"/>`));
  if (top) out.push(`<path class="iso-top" d="${top}"/>`);
  if (crease) out.push(`<path class="iso-line iso-crease" data-tone="faint" d="${crease}"/>`);
  out.push(`<path class="iso-line iso-edge" data-tone="${tone}" d="${edge}"/>`);
  return `<g class="iso-solid" data-seamless=""${lit ? ' data-lit=""' : ""}>${out.join("")}</g>`;
}

// A curved wall of radius r between angles t0..t1, facing out (or in).
function wall(r, t0, t1, z0, z1, inward, tone) {
  if (t1 - t0 < 0.01 || z1 - z0 < 0.01 || r <= 0) return "";
  const shades = [[], [], [], []];
  const n = Math.max(1, Math.ceil((t1 - t0) / 4));
  for (let i = 0; i < n; i++) {
    const a = t0 + ((t1 - t0) * i) / n;
    const b = t0 + ((t1 - t0) * (i + 1)) / n;
    const m = deg((a + b) / 2);
    const s = inward ? -1 : 1;
    shades[shadeOf(s * Math.cos(m), s * Math.sin(m))].push(poly([pt(r, a, z0), pt(r, b, z0), pt(r, b, z1), pt(r, a, z1)]));
  }
  const outline = [...arc(r, t0, t1, z1), ...arc(r, t1, t0, z0)];
  return piece({ fill: poly(outline), shades, edge: poly(outline), tone });
}

// Annular sector top face.
function topFace(r0, r1, t0, t1, z, tone) {
  if (t1 - t0 < 0.01) return "";
  const outline = r0 > 0 ? [...arc(r1, t0, t1, z), ...arc(r0, t1, t0, z)] : [...arc(r1, t0, t1, z), [0, 0, z]];
  return piece({ fill: poly(outline), top: poly(outline), edge: poly(outline), tone });
}

// Flat cut face in the plane at angle t.
function cutFace(r0, r1, t, z0, z1, tone) {
  const outline = [pt(r0, t, z0), pt(r1, t, z0), pt(r1, t, z1), pt(r0, t, z1)];
  // face at WEDGE[0] looks toward +t (into the removed sector), face at WEDGE[1] toward −t
  const normal = t === WEDGE[0] ? [-Math.sin(deg(t)), Math.cos(deg(t))] : [Math.sin(deg(t)), -Math.cos(deg(t))];
  const shades = [[], [], [], []];
  shades[shadeOf(normal[0], normal[1])].push(poly(outline));
  return piece({ fill: poly(outline), shades, edge: poly(outline), tone });
}

// A cut-away shell, split into what lies behind (pass 1) and what lies in front (pass 2).
const BACK = [WEDGE[1] + 45, WEDGE[1] + 225]; // inner surfaces that face the viewer
export function shell(s, { tone = "mid", floor = false } = {}) {
  const lo = WEDGE[1];
  const hi = WEDGE[0] + 360;
  const back = [];
  const front = [];
  if (s.r0 > 0) back.push(wall(s.r0, BACK[0], BACK[1], s.z0, s.z1, true, tone));
  if (floor) back.push(topFace(s.r0, s.r1, lo, hi, s.z1, tone));
  else back.push(topFace(s.r0, s.r1, BACK[0], BACK[1], s.z1, tone));
  // outer slivers that face the viewer
  front.push(wall(s.r1, lo, BACK[0], s.z0, s.z1, false, tone));
  front.push(wall(s.r1, BACK[1], hi, s.z0, s.z1, false, tone));
  front.push(cutFace(s.r0, s.r1, WEDGE[0], s.z0, s.z1, tone));
  front.push(cutFace(s.r0, s.r1, WEDGE[1], s.z0, s.z1, tone));
  if (!floor) {
    front.push(topFace(s.r0, s.r1, lo, BACK[0], s.z1, tone));
    front.push(topFace(s.r0, s.r1, BACK[1], hi, s.z1, tone));
  }
  return { back: back.join(""), front: front.join("") };
}

export const tools = { S, pt, poly, line, arc, piece, wall, topFace, cutFace, shadeOf, deg, f1 };
