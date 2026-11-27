// Half-section helpers for equipment drawings (Anatomy kit). See references/drawing.md.
// cutLathe(regions, F, P, opts): back half of a body of revolution, cut on the plane through its axis.
// Frame F: u in the cut plane, v pointing away from the viewer, so phi in [0, PI] is the back half.
// Returns { body, sect }: draw body, then anything between shell and cut plane, then sect.
import * as k from "../kit/iso-kit.mjs";
import * as G from "../kit/lathe.mjs";

export function cutFrame(o, axis, P) {
  const V = G.viewOf(P);
  const a = G.unit3(axis);
  let v = G.sub3(G.mul3(a, G.dot3(V, a)), V);
  if (G.len3(v) < 1e-6) v = G.cross3(a, [0, 0, 1]);
  v = G.unit3(v);
  const u = G.unit3(G.cross3(v, a));
  return G.frameOf(o, a, u, v);
}

export function cutLathe(regions, F, P, { steps = 64, phi = [0, Math.PI] } = {}) {
  const V = G.viewOf(P);
  const at = (p) => k.iso(p, P);
  const depth = (p) => G.dot3(p, V);
  const poly = (pts) => k.pathOf(pts.map(at), true);
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

