/* Equipment simulator engine: process steps, part cards, pull-out with ghost slot,
   freeze/resume, 3D inspector (three.js r128), theme sync, frame loop.
   Usage: const sim = SimEngine({ data, channels, targets, taus, stepSeconds, onFrame, onStep, readout, busy });
   DOM contract: see SKILL.md. The device script supplies the physics and effect layers. */
function SimEngine(cfg){
const D = cfg.data;
const { X, PARTS, STEPS, W, H, MODELS, K, VIEW } = D;
const root = document.documentElement;
const iso = document.querySelector(".iso") || document.body;
const darkQ = matchMedia("(prefers-color-scheme: dark)");
const syncTheme = () => { const t = root.getAttribute("data-theme"); const dark = t ? t === "dark" : darkQ.matches; iso.setAttribute("data-theme", dark ? "dark" : "light"); cfg.onTheme && cfg.onTheme(dark); };
syncTheme(); darkQ.addEventListener?.("change", syncTheme); new MutationObserver(syncTheme).observe(root, { attributes: true, attributeFilter: ["data-theme"] });
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const stage = $(".stage");
const svg = $("svg", stage);
const NS = "http://www.w3.org/2000/svg";
const still = matchMedia("(prefers-reduced-motion: reduce)");
const proj = (p) => [X.O[0] + p[0] * X.ex[0] + p[1] * X.ey[0] + p[2] * X.ez[0], X.O[1] + p[0] * X.ex[1] + p[1] * X.ey[1] + p[2] * X.ez[1]];
const mk = (tag, parent, attrs = {}) => { const el = document.createElementNS(NS, tag); for (const [k2, v] of Object.entries(attrs)) el.setAttribute(k2, v); parent.appendChild(el); return el; };
function vbox(){
  const r = svg.getBoundingClientRect();
  const s = Math.min(r.width / W, r.height / H);
  return { left: r.left + (r.width - W * s) / 2, top: r.top + (r.height - H * s) / 2, width: W * s, height: H * s };
}
const channels = cfg.channels || {};
const cur = { ...channels };
const TARGET = cfg.targets || [];
let step = 0, playing = !still.matches, stepClock = 0, chosen = false;
const STEP_SECONDS = cfg.stepSeconds || 5.2;
const api = {
  get step(){ return step; }, get playing(){ return playing; }, get frozen(){ return frozen; }, get chosen(){ return chosen; }, get selected(){ return selected; },
  cur, stage, svg, still, proj, mk, $, $$, NS, vbox,
  setStep: (i, u) => setStep(i, u), refresh: () => { stBody.textContent = cfg.caption ? cfg.caption(step, api) : STEPS[step].body; if (selected && !pop.hidden) card(selected); kick(); }, play: () => play(), pause: () => pause(), kick: () => kick(), select: (id) => select(id),
};

/* ---------- popups and pull-out ---------- */
const pop = $(".pop", stage), dot = $(".pop-line", stage), tag = $(".hover-tag", stage);
const ACTS = D.ACTS || {};
let selected = null, lift = null, frozen = false;
const liftLayer = document.createElementNS(NS, "g");
liftLayer.setAttribute("class", "lift-layer");
const space = () => svg.querySelector(".cam") || svg;
space().appendChild(liftLayer);
function scr(p){ const m = space().getScreenCTM(), sb = stage.getBoundingClientRect(); const q = new DOMPoint(p[0], p[1]).matrixTransform(m); return [q.x - sb.left, q.y - sb.top]; }
const unitPx = () => { const m = space().getScreenCTM(); return Math.hypot(m.a, m.b); };
const offPx = (o) => [o[0] * X.ex[0] + o[1] * X.ey[0] + o[2] * X.ez[0], o[0] * X.ex[1] + o[1] * X.ey[1] + o[2] * X.ez[1]];
const toView = (e) => { const q = new DOMPoint(e.clientX, e.clientY).matrixTransform(space().getScreenCTM().inverse()); return [q.x, q.y]; };

function card(id){
  const p = PARTS[id];
  const act = ACTS[id];
  const how = lift && lift.view ? 'Drag the part to turn it in 3D. Shift-drag or use the Move handle to move it. Double-click to square it up again.' : 'Drag the part to move it.';
  const status = lift ? '<p class="pop-status">' + (lift.wasPlaying ? 'Sequence paused while this part is out. ' : '') + how + '</p>' : '<p class="pop-status">Watching step ' + (step + 1) + ': ' + STEPS[step].title + '.</p>';
  const actions = lift
    ? '<div class="pop-actions"><button class="btn" type="button" data-act="back">Put back</button>' + (lift.view ? '<button class="btn" type="button" data-act="reset">Square up</button>' : '') + '<button class="btn primary" type="button" data-act="watch">See it in action</button></div>'
    : '<div class="pop-actions"><button class="btn" type="button" data-act="pull">Pull it out</button><button class="btn" type="button" data-act="close">Done</button></div>';
  pop.innerHTML = '<button class="x" type="button" aria-label="Close">×</button><div class="grp">' + p.group + '</div><h3>' + p.name + '</h3><p class="role">' + p.role + '</p><p>' + p.body + '</p><dl>' + p.facts.map(([a,b]) => '<dt>' + a + '</dt><dd>' + b + '</dd>').join("") + '</dl>' + status + actions;
  $(".x", pop).addEventListener("click", () => { select(null); stage.focus(); });
  pop.querySelector('[data-act="back"]')?.addEventListener("click", () => { select(null); stage.focus(); });
  pop.querySelector('[data-act="close"]')?.addEventListener("click", () => { select(null); stage.focus(); });
  pop.querySelector('[data-act="pull"]')?.addEventListener("click", () => select(id, "pull"));
  pop.querySelector('[data-act="watch"]')?.addEventListener("click", () => watch(id));
  pop.querySelector('[data-act="reset"]')?.addEventListener("click", () => resetTurn());
}

function highlight(id){
  selected = id;
  $$(".part", svg).forEach((g) => g.toggleAttribute("data-sel", g.dataset.part === id));
  $$(".chip").forEach((c) => c.setAttribute("aria-pressed", String(c.dataset.pick === id)));
  stage.toggleAttribute("data-focus", Boolean(id));
}

function pull(id){
  const groups = $$('.part[data-part="' + id + '"]', svg);
  if (!groups.length) return;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const g of groups){ const b = g.getBBox(); if (!b.width && !b.height) continue; let pts = [[b.x, b.y], [b.x + b.width, b.y], [b.x, b.y + b.height], [b.x + b.width, b.y + b.height]]; const tm = g.transform && g.transform.baseVal.consolidate(); if (tm){ const m = tm.matrix; pts = pts.map(([x, y]) => [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f]); } for (const [x, y] of pts){ x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); } }
  const c = [(x0 + x1) / 2, (y0 + y1) / 2];
  const ghosts = groups.map((g) => { const gh = g.cloneNode(true); gh.setAttribute("class", "ghost"); gh.removeAttribute("data-part"); gh.removeAttribute("data-sel"); gh.setAttribute("aria-hidden", "true"); g.before(gh); return gh; });
  groups.forEach((g) => liftLayer.appendChild(g));
  let d = [c[0] - W / 2, c[1] - H * .52]; const n = Math.hypot(...d) || 1; d = [d[0] / n, d[1] / n];
  const ts = (x1 - x0) > W * .45 ? 1.02 : 1.12;
  const reach = (x1 - x0) > W * .45 ? 26 : 58;
  let target = (x1 - x0) > W * .45 ? [d[0] * reach, 10] : [d[0] * reach, d[1] * reach - 24];
  target = clampOff(target, [x0, y0, x1, y1], c, ts);
  lift = { id, groups, ghosts, box: [x0, y0, x1, y1], c, off: [0, 0], s: 1, target, ts, wasPlaying: playing, home: false };
  if (playing) pause();
  frozen = true;
  stage.setAttribute("data-lifted", "");
  animateLift();
}

function clampOff(off, box, c, s){
  const [x0, y0, x1, y1] = box;
  const ax0 = c[0] + (x0 - c[0]) * s, ax1 = c[0] + (x1 - c[0]) * s, ay0 = c[1] + (y0 - c[1]) * s, ay1 = c[1] + (y1 - c[1]) * s;
  const pad = 6;
  const lo = [pad - ax0, pad - ay0], hi = [W - pad - ax1, H - pad - ay1];
  return [lo[0] > hi[0] ? (lo[0] + hi[0]) / 2 : Math.min(hi[0], Math.max(lo[0], off[0])), lo[1] > hi[1] ? (lo[1] + hi[1]) / 2 : Math.min(hi[1], Math.max(lo[1], off[1]))];
}

function paintLift(){
  if (!lift) return;
  const { c, off, s } = lift;
  liftLayer.setAttribute("transform", "translate(" + (off[0] + c[0]).toFixed(2) + " " + (off[1] + c[1]).toFixed(2) + ") scale(" + s.toFixed(4) + ") translate(" + (-c[0]).toFixed(2) + " " + (-c[1]).toFixed(2) + ")");
  place();
}

let liftFrame = 0, liftLast = 0;
function animateLift(){ if (!liftFrame){ liftLast = 0; liftFrame = requestAnimationFrame(liftStep); } }
function liftStep(now){
  liftFrame = 0;
  if (!lift) return;
  const dt = liftLast ? Math.min((now - liftLast) / 1000, 1 / 20) : 1 / 60; liftLast = now;
  const k = still.matches ? 1 : 1 - Math.exp(-dt / .12);
  const goal = lift.home ? [0, 0] : lift.target, gs = lift.home ? 1 : lift.ts;
  if (!lift.drag){ lift.off = [lift.off[0] + (goal[0] - lift.off[0]) * k, lift.off[1] + (goal[1] - lift.off[1]) * k]; }
  lift.s += (gs - lift.s) * k;
  paintLift();
  const done = Math.hypot(goal[0] - lift.off[0], goal[1] - lift.off[1]) < (lift.home ? .8 : .15) && Math.abs(gs - lift.s) < (lift.home ? .004 : .001);
  if (done && lift.home){ seat(); return; }
  if (!done || lift.drag) liftFrame = requestAnimationFrame(liftStep);
  else if (!lift.home && !lift.view) loadThree().then(() => { if (lift && !lift.home && !lift.view) enter3D(); }).catch(() => {});
}

function seat(){
  if (!lift) return;
  lift.groups.forEach((g, i) => { lift.ghosts[i].after(g); lift.ghosts[i].remove(); });
  liftLayer.removeAttribute("transform");
  liftLayer.style.visibility = "";
  const resume = lift.wasPlaying && lift.resume;
  lift = null; frozen = false;
  stage.removeAttribute("data-lifted");
  if (resume) play();
  kick();
}

function putBack({ resume = true, instant = false } = {}){
  if (!lift) return;
  lift.resume = resume;
  lift.drag = null;
  if (lift.view){
    if (instant || still.matches){ exit3D(); lift.home = true; seat(); return; }
    const l = lift;
    exit3D(() => { if (lift !== l) return; l.home = true; animateLift(); });
    return;
  }
  lift.home = true;
  if (instant || still.matches){ seat(); return; }
  animateLift();
}

function select(id, from){
  if (!id){ putBack(); highlight(null); pop.hidden = true; dot.hidden = true; return; }
  if (lift && lift.id !== id) putBack({ resume: false, instant: true });
  highlight(id);
  if (!lift) pull(id);
  card(id);
  pop.hidden = false;
  place();
  if (from === "chip" && innerWidth <= 640) pop.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

function watch(id){
  putBack({ resume: false, instant: true });
  highlight(id);
  setStep(ACTS[id] ?? 0, true);
  play();
  card(id);
  pop.hidden = false;
  place();
}

function anchorNow(id){
  let a = X.anchorPx[id];
  if (cfg.offset){ const o = cfg.offset(id); if (o){ const d = offPx(o); a = [a[0] + d[0], a[1] + d[1]]; } }
  if (!lift || lift.id !== id) return a;
  const { c, off, s } = lift;
  return [c[0] + (a[0] - c[0]) * s + off[0], c[1] + (a[1] - c[1]) * s + off[1]];
}
function place(){
  if (!selected || pop.hidden) return;
  const a = anchorNow(selected);
  const sbox = stage.getBoundingClientRect();
  const [px, py] = scr(a);
  dot.hidden = Boolean(lift && lift.view); dot.style.left = px + "px"; dot.style.top = py + "px";
  if (innerWidth <= 640){ pop.style.left = pop.style.top = ""; return; }
  const pw = pop.offsetWidth, ph = pop.offsetHeight, gap = 22;
  let left, top;
  if (lift && lift.id === selected){
    const cx = scr([lift.c[0] + lift.off[0], lift.c[1] + lift.off[1]])[0];
    left = cx > sbox.width / 2 ? 14 : sbox.width - pw - 14;
    top = 40;
  } else {
    left = px < sbox.width * .55 ? px + gap : px - pw - gap;
    top = py - ph / 2;
  }
  left = Math.max(4, Math.min(sbox.width - pw - 4, left));
  top = Math.max(4, Math.min(sbox.height - ph - 4, top));
  pop.style.left = left + "px"; pop.style.top = top + "px";
}
addEventListener("resize", place);

liftLayer.addEventListener("pointerdown", (e) => {
  if (!lift || lift.home) return;
  e.preventDefault();
  lift.drag = { start: toView(e), from: [...lift.off], id: e.pointerId };
  liftLayer.setPointerCapture?.(e.pointerId);
  stage.setAttribute("data-dragging", "");
  animateLift();
});
liftLayer.addEventListener("pointermove", (e) => {
  if (!lift || !lift.drag) return;
  const p = toView(e);
  const dx = p[0] - lift.drag.start[0], dy = p[1] - lift.drag.start[1];
  lift.off = clampOff([lift.drag.from[0] + dx, lift.drag.from[1] + dy], lift.box, lift.c, lift.s);
  lift.target = [...lift.off];
  paintLift();
});
const endDrag = () => { if (lift && lift.drag){ lift.drag = null; stage.removeAttribute("data-dragging"); } };
liftLayer.addEventListener("pointerup", endDrag);
liftLayer.addEventListener("pointercancel", endDrag);

svg.addEventListener("click", (e) => {
  if (e.target.closest(".lift-layer")) return;
  const g = e.target.closest(".part");
  if (g) select(g.dataset.part === selected && lift ? null : g.dataset.part);
  else if (selected) select(null);
});
svg.addEventListener("pointermove", (e) => {
  const g = e.target.closest(".part"); const sbox = stage.getBoundingClientRect();
  if (g && e.pointerType === "mouse" && !(lift && lift.drag)){
    tag.textContent = e.target.closest(".lift-layer") ? "Drag to move" : PARTS[g.dataset.part].name;
    tag.style.left = (e.clientX - sbox.left) + "px"; tag.style.top = (e.clientY - sbox.top) + "px"; tag.setAttribute("data-on", "");
  }
  else tag.removeAttribute("data-on");
});
svg.addEventListener("pointerleave", () => tag.removeAttribute("data-on"));
$$(".chip").forEach((c) => c.addEventListener("click", () => select(c.dataset.pick === selected && lift ? null : c.dataset.pick, "chip")));
addEventListener("keydown", (e) => { if (e.key === "Escape" && selected) select(null); });
stage.addEventListener("keydown", (e) => {
  if (!lift || lift.home) return;
  const step2 = e.shiftKey ? 20 : 6;
  const m = { ArrowLeft: [-step2, 0], ArrowRight: [step2, 0], ArrowUp: [0, -step2], ArrowDown: [0, step2] }[e.key];
  if (!m) return;
  e.preventDefault();
  if (lift.view && !e.shiftKey){ turnBy(m[0] / 6 * .26, m[1] / 6 * .26); return; }
  lift.off = clampOff([lift.off[0] + m[0], lift.off[1] + m[1]], lift.box, lift.c, lift.s);
  lift.target = [...lift.off];
  paintLift();
  if (lift.view) layout3D();
});

/* ---------- 3D inspector ---------- */
const THREE_URL = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";
let threeLoad = null;
function loadThree(){
  if (window.THREE) return Promise.resolve(window.THREE);
  if (!threeLoad) threeLoad = new Promise((res, rej) => { const sc = document.createElement("script"); sc.src = THREE_URL; sc.onload = () => window.THREE ? res(window.THREE) : rej(new Error("three")); sc.onerror = () => { threeLoad = null; rej(new Error("three")); }; document.head.appendChild(sc); });
  return threeLoad;
}
setTimeout(() => loadThree().catch(() => {}), 400);

const v3 = { renderer: null, canvas: null, scene: null, camera: null, pivot: null, meshes: [], c: [0, 0, 0], R: 1, px: 1, mode: null };
const grip = document.createElement("button");
grip.type = "button"; grip.className = "grip"; grip.hidden = true; grip.textContent = "Move"; grip.setAttribute("aria-label", "Drag to move the part");
stage.appendChild(grip);

function palette(){
  const dark = iso.getAttribute("data-theme") === "dark";
  return dark
    ? { hi: 0x5a5a5e, mid: 0x434347, lo: 0x2e2e32, lead: 0x34373f, copper: 0x7a5a42, alu: 0x66696f, glass: 0x7d97c2, heat: 0xff8f4a, ink: 0xe6e6e6, edge: 0xd4d4d4, edgeA: .55, glassA: .2 }
    : { hi: 0xffffff, mid: 0xeeeeec, lo: 0xd0d0cc, lead: 0xb8bcc6, copper: 0xeccaa8, alu: 0xf2f4f7, glass: 0x8fa9d4, heat: 0xd4561a, ink: 0x2a2a2e, edge: 0x2c2c30, edgeA: .6, glassA: .2 };
}

function buildModel(T, id){
  const pal = palette();
  const grad = new T.DataTexture(new Uint8Array([110, 160, 215, 255]), 4, 1, T.LuminanceFormat);
  grad.minFilter = grad.magFilter = T.NearestFilter; grad.needsUpdate = true;
  const mats = {};
  const mat = (t) => mats[t] ||= (t === "glass"
    ? new T.MeshToonMaterial({ color: pal.glass, gradientMap: grad, side: T.DoubleSide, transparent: true, opacity: pal.glassA, depthWrite: false })
    : new T.MeshToonMaterial({ color: pal[t] ?? pal.mid, gradientMap: grad, side: T.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }));
  const edgeMat = new T.LineBasicMaterial({ color: pal.edge, transparent: true, opacity: pal.edgeA });
  const glassEdge = new T.LineBasicMaterial({ color: pal.glass, transparent: true, opacity: .7 });
  const group = new T.Group();
  const meshes = [];
  const add = (geo, t) => {
    const m = new T.Mesh(geo, mat(t)); group.add(m); meshes.push(m);
    group.add(new T.LineSegments(new T.EdgesGeometry(geo, 28), t === "glass" ? glassEdge : edgeMat));
  };
  const pt = (F, s, r, ph) => { const c = Math.cos(ph), n = Math.sin(ph); return [0, 1, 2].map((i) => F.o[i] + F.a[i] * s + r * (c * F.u[i] + n * F.v[i])); };
  const geoOf = (pos, idx) => { const g = new T.BufferGeometry(); g.setAttribute("position", new T.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g; };
  for (const p of MODELS[id] || []){
    if (p.k === "rev"){
      const full = !p.phi, p0 = full ? 0 : p.phi[0], p1 = full ? Math.PI * 2 : p.phi[1], n = full ? 64 : 36, sec = p.sec;
      for (let i = 0; i < sec.length; i++){
        const a = sec[i], b = sec[(i + 1) % sec.length];
        if (full && i === sec.length - 1) continue;
        if (a[1] < .01 && b[1] < .01) continue;
        const pos = [], idx = [];
        for (let j = 0; j <= n; j++){ const ph = p0 + (p1 - p0) * j / n; pos.push(...pt(p.F, a[0], a[1], ph), ...pt(p.F, b[0], b[1], ph)); }
        for (let j = 0; j < n; j++){ const q = j * 2; idx.push(q, q + 1, q + 3, q, q + 3, q + 2); }
        add(geoOf(pos, idx), p.t);
      }
      if (!full){
        const faces = T.ShapeUtils.triangulateShape(sec.map(([s2, r]) => new T.Vector2(s2, r)), []);
        for (const ph of [p0, p1]){ const pos = []; sec.forEach(([s2, r]) => pos.push(...pt(p.F, s2, r, ph))); add(geoOf(pos, faces.flat()), p.t); }
      }
    } else if (p.k === "box"){
      const g = new T.BoxGeometry(p.b[0] - p.a[0], p.b[1] - p.a[1], p.b[2] - p.a[2]);
      g.translate((p.a[0] + p.b[0]) / 2, (p.a[1] + p.b[1]) / 2, (p.a[2] + p.b[2]) / 2);
      add(g, p.t);
    } else if (p.k === "tube"){
      const pts = p.pts.map((q) => new T.Vector3(...q));
      const curve = new T.CatmullRomCurve3(pts, false, "centripetal", 0);
      const m = new T.Mesh(new T.TubeGeometry(curve, Math.min(400, pts.length * 3), p.r, 12, false), mat(p.t)); group.add(m); meshes.push(m);
      for (const e of [0, 1]){ const at = pts[e ? pts.length - 1 : 0], dir = curve.getTangent(e); const cap = new T.CircleGeometry(p.r, 16); const mm = new T.Mesh(cap, mat(p.t)); mm.position.copy(at); mm.lookAt(at.clone().add(dir)); group.add(mm); }
    } else if (p.k === "sph"){
      const g = new T.SphereGeometry(p.r, 24, 16); g.translate(...p.c); add(g, p.t);
    } else if (p.k === "quad"){
      add(geoOf(p.pts.flat(), [0, 1, 2, 0, 2, 3]), p.t);
    } else if (p.k === "line"){
      const g = new T.BufferGeometry(); g.setAttribute("position", new T.Float32BufferAttribute(p.pts.flat(), 3));
      group.add(new T.Line(g, new T.LineBasicMaterial({ color: pal[p.t] ?? pal.ink })));
    }
  }
  const box = new T.Box3().setFromObject(group);
  const c = box.getCenter(new T.Vector3());
  let R = 0; group.traverse((o) => { const a = o.geometry && o.geometry.attributes.position; if (!a) return; o.updateMatrixWorld(); for (let i = 0; i < a.count; i++){ const v = new T.Vector3().fromBufferAttribute(a, i).applyMatrix4(o.matrixWorld); R = Math.max(R, v.distanceTo(c)); } });
  return { group, meshes, c: [c.x, c.y, c.z], R };
}

function enter3D(){
  const T = window.THREE;
  if (!T || !lift || lift.view || !MODELS[lift.id]) return;
  try {
    if (!v3.renderer){
      v3.renderer = new T.WebGLRenderer({ antialias: true, alpha: true });
      v3.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
      v3.canvas = v3.renderer.domElement; v3.canvas.className = "view3d"; v3.canvas.hidden = true;
      v3.canvas.setAttribute("aria-label", "3D view of the pulled-out part. Drag to turn it.");
      stage.appendChild(v3.canvas);
      wire3D();
    }
  } catch (err){ v3.renderer = null; return; }
  const m = buildModel(T, lift.id);
  const scene = new T.Scene();
  const mirror = new T.Group(); mirror.scale.set(1, -1, 1); mirror.add(m.group);
  mirror.position.set(-m.c[0], m.c[1], -m.c[2]);
  const pivot = new T.Group(); pivot.add(mirror); scene.add(pivot);
  const cam = new T.OrthographicCamera(-1, 1, 1, -1, 1, 6000);
  const Vt = new T.Vector3(VIEW[0], -VIEW[1], VIEW[2]).normalize();
  cam.up.set(0, 0, 1); cam.position.copy(Vt.multiplyScalar(3000)); cam.lookAt(0, 0, 0);
  scene.add(cam);
  scene.add(new T.AmbientLight(0xffffff, .5));
  const sun = new T.DirectionalLight(0xffffff, .75); sun.position.set(-1.2, 1.6, 1); cam.add(sun); cam.add(sun.target); sun.target.position.set(0, 0, -1);
  Object.assign(v3, { scene, camera: cam, pivot, meshes: m.meshes, c: m.c, R: m.R });
  lift.view = true;
  liftLayer.style.visibility = "hidden";
  v3.canvas.hidden = false; grip.hidden = false;
  stage.setAttribute("data-3d", "");
  layout3D();
  card(lift.id); place();
}

function layout3D(){
  if (!lift || !lift.view) return;
  const o3 = cfg.offset ? cfg.offset(lift.id) || [0, 0, 0] : [0, 0, 0];
  const cs = proj([v3.c[0] + o3[0], v3.c[1] + o3[1], v3.c[2] + o3[2]]);
  const sx = lift.c[0] + (cs[0] - lift.c[0]) * lift.s + lift.off[0], sy = lift.c[1] + (cs[1] - lift.c[1]) * lift.s + lift.off[1];
  const [px, py] = scr([sx, sy]);
  v3.px = K * lift.s * unitPx();
  const size = Math.ceil(2 * v3.R * v3.px + 24);
  v3.canvas.style.width = v3.canvas.style.height = size + "px";
  v3.canvas.style.left = (px - size / 2) + "px"; v3.canvas.style.top = (py - size / 2) + "px";
  if (v3.size !== size){ v3.renderer.setSize(size, size, false); v3.size = size; }
  const half = size / 2 / v3.px;
  Object.assign(v3.camera, { left: -half, right: half, top: half, bottom: -half });
  v3.camera.updateProjectionMatrix();
  grip.style.left = px + "px"; grip.style.top = (py - size / 2 + 10) + "px";
  render3D();
}
function render3D(){ if (v3.renderer && lift && lift.view) v3.renderer.render(v3.scene, v3.camera); }

function turnBy(ax, ay){
  const T = window.THREE; if (!T || !lift || !lift.view) return;
  const e = v3.camera.matrixWorld.elements;
  const right = new T.Vector3(e[0], e[1], e[2]).normalize(), up = new T.Vector3(e[4], e[5], e[6]).normalize();
  const q = new T.Quaternion().setFromAxisAngle(up, ax).multiply(new T.Quaternion().setFromAxisAngle(right, ay));
  v3.pivot.quaternion.premultiply(q);
  render3D();
}

let slerpFrame = 0;
function slerpHome(done){
  const T = window.THREE;
  cancelAnimationFrame(slerpFrame);
  const from = v3.pivot.quaternion.clone(), to = new T.Quaternion();
  const ang = 2 * Math.acos(Math.min(1, Math.abs(from.dot(to))));
  const dur = still.matches ? 0 : Math.min(420, 120 + ang * 160);
  const t0 = performance.now();
  const stepQ = (now) => {
    const u = dur ? Math.min(1, (now - t0) / dur) : 1, e = 1 - Math.pow(1 - u, 3);
    v3.pivot.quaternion.copy(from).slerp(to, e); render3D();
    if (u < 1) slerpFrame = requestAnimationFrame(stepQ); else { slerpFrame = 0; done && done(); }
  };
  slerpFrame = requestAnimationFrame(stepQ);
}
function resetTurn(){ if (lift && lift.view) slerpHome(); }

function exit3D(done){
  const finish = () => {
    if (v3.canvas) v3.canvas.hidden = true;
    grip.hidden = true;
    stage.removeAttribute("data-3d");
    liftLayer.style.visibility = "";
    if (v3.scene) v3.scene.traverse((o) => { o.geometry && o.geometry.dispose(); });
    v3.scene = null;
    if (lift) lift.view = false;
    done && done();
  };
  if (!done || !v3.pivot){ cancelAnimationFrame(slerpFrame); finish(); return; }
  slerpHome(finish);
}

function hits(e){
  const T = window.THREE;
  const r = v3.canvas.getBoundingClientRect();
  const ndc = new T.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  const ray = new T.Raycaster(); ray.setFromCamera(ndc, v3.camera);
  return ray.intersectObjects(v3.meshes, false).length > 0;
}
function wire3D(){
  const begin = (e, mode) => {
    e.preventDefault(); e.stopPropagation();
    v3.mode = { kind: mode, x: e.clientX, y: e.clientY, from: [...lift.off], el: e.currentTarget };
    e.currentTarget.setPointerCapture?.(e.pointerId);
    stage.setAttribute("data-dragging", "");
  };
  v3.canvas.addEventListener("pointerdown", (e) => {
    if (!lift || !lift.view) return;
    begin(e, e.shiftKey ? "move" : "turn");
    v3.mode.miss = !hits(e); v3.mode.sx = e.clientX; v3.mode.sy = e.clientY;
  });
  grip.addEventListener("pointerdown", (e) => { if (lift && lift.view) begin(e, "move"); });
  const moveTo = (e) => {
    if (!v3.mode || !lift) return;
    if (v3.mode.kind === "turn"){
      turnBy((e.clientX - v3.mode.x) * .011, (e.clientY - v3.mode.y) * .011);
      v3.mode.x = e.clientX; v3.mode.y = e.clientY;
    } else {
      const u = unitPx(), dx = (e.clientX - v3.mode.x) / u, dy = (e.clientY - v3.mode.y) / u;
      lift.off = clampOff([v3.mode.from[0] + dx, v3.mode.from[1] + dy], lift.box, lift.c, lift.s);
      lift.target = [...lift.off];
      paintLift(); layout3D();
    }
  };
  const end = (e) => {
    if (!v3.mode) return;
    const click = v3.mode.miss && e && e.type === "pointerup" && Math.hypot(e.clientX - v3.mode.sx, e.clientY - v3.mode.sy) < 4;
    v3.mode = null; stage.removeAttribute("data-dragging");
    if (click) select(null);
  };
  for (const el of [v3.canvas, grip]){
    el.addEventListener("pointermove", moveTo);
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);
  }
  v3.canvas.addEventListener("dblclick", (e) => { e.preventDefault(); resetTurn(); });
  v3.canvas.addEventListener("pointermove", (e) => {
    if (v3.mode || e.pointerType !== "mouse") { tag.removeAttribute("data-on"); return; }
    const sbox = stage.getBoundingClientRect();
    if (hits(e)){ tag.textContent = "Drag to turn · Shift-drag to move"; tag.style.left = (e.clientX - sbox.left) + "px"; tag.style.top = (e.clientY - sbox.top) + "px"; tag.setAttribute("data-on", ""); }
    else tag.removeAttribute("data-on");
  });
  v3.canvas.addEventListener("pointerleave", () => tag.removeAttribute("data-on"));
  addEventListener("resize", layout3D);
}

/* ---------- sequence UI ---------- */
const stTitle = $("[data-st-title]"), stBody = $("[data-st-body]"), phase = $("[data-phase]"), playBtn = $("#play");
function setStep(i, user){
  step = (i + STEPS.length) % STEPS.length; stepClock = 0;
  stTitle.textContent = STEPS[step].title; stBody.textContent = cfg.caption ? cfg.caption(step, api) : STEPS[step].body;
  phase.textContent = "step " + (step + 1) + " of " + STEPS.length;
  $$("ol.steps button").forEach((b, j) => { b.toggleAttribute("aria-current", j === step); if (j === step) b.setAttribute("aria-current", "step"); b.classList.toggle("done", j < step); });
  cfg.onStep && cfg.onStep(step, api, user);
  if (user){ chosen = true; if (lift) putBack({ resume: false, instant: true }); pause(); }
  if (selected && !pop.hidden && !lift) card(selected);
  kick();
}
function pause(){ playing = false; playBtn.textContent = "Play"; }
function play(){ if (lift) putBack({ resume: false, instant: true }); chosen = true; playing = true; playBtn.textContent = "Pause"; if (step === STEPS.length - 1) setStep(0); kick(); }
playBtn.addEventListener("click", () => playing ? pause() : play());
$("#next").addEventListener("click", () => setStep(step + 1, true));
$("#back").addEventListener("click", () => setStep(step - 1, true));
$$("ol.steps button").forEach((b) => b.addEventListener("click", () => setStep(+b.dataset.step, true)));


/* ---------- frame loop ---------- */
let frame = 0, last = 0, visible = true;
const easeTo = (a, b, dt, tau) => a + (b - a) * (1 - Math.exp(-dt / tau));
const readoutEl = $("[data-readout]");
const taus = cfg.taus || {};
function tick(now){
  const dt = frozen ? 0 : (last ? Math.min((now - last) / 1000, 1/20) : 1/60); last = now;
  const calm = still.matches && !chosen;
  const hold = cfg.holdLast ?? 2;
  if (playing){ stepClock += dt; if (stepClock > (step === STEPS.length - 1 ? STEP_SECONDS + hold : STEP_SECONDS)) setStep(step + 1); }
  const T = TARGET[step] || {};
  for (const key in cur) if (key in T){ const tau = typeof taus[key] === "function" ? taus[key](cur[key], T[key]) : (taus[key] ?? .35); cur[key] = calm ? T[key] : easeTo(cur[key], T[key], dt, tau); }
  for (const key in cur) stage.style.setProperty("--" + key, cur[key].toFixed(3));
  cfg.onFrame && cfg.onFrame(dt, calm, api);
  if (readoutEl && cfg.readout){ const ro = cfg.readout(api); if (readoutEl.textContent !== ro) readoutEl.textContent = ro; }
  const busy = playing || Object.keys(cur).some((key) => key in T && Math.abs(cur[key] - T[key]) > .002) || (cfg.busy ? cfg.busy(api) : false);
  frame = visible && busy && !frozen ? requestAnimationFrame(tick) : 0;
}
function kick(){ if (!frame && visible){ last = 0; frame = requestAnimationFrame(tick); } }
new IntersectionObserver((en) => { visible = en[en.length - 1].isIntersecting; if (visible) kick(); }).observe(stage);
setStep(0);
if (playing) playBtn.textContent = "Pause";
kick();
return api;
}
