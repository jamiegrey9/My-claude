// Live layer: drives the figure from the pure model (stateAt) every frame.
// Kit functions (cylinder, solidSvg, lineSvg, ...) and the model/geometry
// constants are inlined above this script.

const root = document.querySelector(".cf-app");
const svg = root.querySelector(".iso-stage svg");
const slot = (name) => svg.querySelector(`[data-slot="${name}"]`);
const readout = root.querySelector("[data-readout]");
const $ = (sel) => root.querySelector(sel);
const $$ = (sel) => [...root.querySelectorAll(sel)];
const still = matchMedia("(prefers-reduced-motion: reduce)");
const AZ = ((P.azimuth ?? 45) * Math.PI) / 180;
const facing = (angle) => Math.cos(angle - AZ);

const S = (paths, style) => solidSvg(paths, style);
const L = (d, style) => lineSvg(d, style);
const seg3 = (a, b) => pathOf([iso(a, P), iso(b, P)]);

// ---------- settings and state ----------
const settings = { drink: "espresso", strength: 3, grind: 6, temp: 2, speed: 3 };
let plan = planOf(settings);
let t = 0;
let playing = false;
let touring = !still.matches;
let idleTimer = 0;
let pucks = 3;
let tankMl = 1450;
let beansG = 210;
let milkMl = 260;
let committed = false; // whether this run's consumption has been banked

// ---------- static helpers for slots ----------
// Bean surface: a fixed scatter of beans on the bed top.
const BEANS = (() => {
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const out = [];
  for (let i = 0; i < 150; i++) out.push([HOPPER.x + 9 + rand() * (HOPPER.w - 18), HOPPER.y + 9 + rand() * (HOPPER.d - 18)]);
  return out;
})();

function drawBeans(g) {
  const z = beanZ(g);
  const plan2 = { x: HOPPER.x + 4, y: HOPPER.y + 4, w: HOPPER.w - 8, d: HOPPER.d - 8, r: 2 };
  const bed = S(slabOf(plan2, HOPPER.z0 + 4, z - HOPPER.z0 - 4, P, 2), { tone: "lo", className: "cf-beans" });
  const dots = dotsSvg(BEANS.map(([x, y]) => iso([x, y, z], P)), { size: 1.25, tone: "mid" });
  const ridges = L(BEANS.filter((_, i) => i % 3 === 0).map(([x, y]) => seg3([x - 1.6, y - 0.6, z], [x + 1.6, y + 0.6, z])).join(""), { tone: "lo", free: true });
  slot("beans").innerHTML = bed + `<g class="cf-bean-dots">${dots}</g>` + ridges;
}

function drawBurr(spin) {
  const [cx, cy] = GRINDER.c;
  const z0 = GRINDER.z0 + 5;
  const z1 = z0 + 8;
  const body = S(cylinder(cx, cy, 24, z0, 8, P, 48), { tone: "hi" });
  const teeth = [];
  for (let i = 0; i < 28; i++) {
    const a = spin + (i / 28) * Math.PI * 2;
    if (facing(a) < 0.08) continue;
    const x = cx + Math.cos(a) * 24;
    const y = cy + Math.sin(a) * 24;
    teeth.push(seg3([x, y, z0 + 1.2], [x, y, z1 - 1.2]));
  }
  slot("burr").innerHTML = body + L(teeth.join(""), { tone: "lo" });
}

function drawKnob(grind) {
  const a = -Math.PI * 0.75 + ((grind - 1) / 11) * Math.PI * 1.5;
  const [cx, cy] = KNOB;
  const tip = [cx + Math.sin(a) * 8, cy - Math.cos(a) * 8];
  slot("knob").innerHTML = L(lineOnTop([cx, cy], tip, 380, P), { tone: "hi", free: "end" }) + dotsSvg([iso([cx, cy, 380], P)], { size: 0.6, tone: "hi" });
}

function drawRotor(spin) {
  const [cx, cy] = FLOWMETER.c;
  const z = FLOWMETER.z1;
  const a = spin;
  const lines = [0, 1, 2].map((i) => {
    const b = a + (i * Math.PI * 2) / 3;
    return lineOnTop([cx, cy], [cx + Math.cos(b) * 4.6, cy + Math.sin(b) * 4.6], z, P);
  });
  slot("rotor").innerHTML = L(lines.join(""), { tone: "mid", free: "end" });
}

function drawTank(ml) {
  const z = tankZ(ml);
  const inner = { x: TANK.x + 1.5, y: TANK.y + 1.5, w: TANK.w - 3, d: TANK.d - 3, r: TANK.r - 1 };
  slot("tank").innerHTML = S(slabOf(inner, TANK.z0 + 1.5, z - TANK.z0 - 1.5, P, 5), { tone: "lo", className: "cf-water", crease: "none" });
}

// Spent pucks in the grounds container.
const PUCK_AT = [[176, 286], [210, 286], [176, 254], [210, 254], [193, 224], [176, 286], [210, 286], [193, 270], [176, 240], [210, 240], [193, 286], [193, 254]];
function drawPucks(n) {
  const out = [];
  const layer = (i) => (i < 5 ? 0 : i < 10 ? 1 : 2);
  const items = PUCK_AT.slice(0, n).map(([x, y], i) => ({ x, y, z: GROUNDS.z0 + 3 + layer(i) * 12 }));
  items.sort((a, b) => a.z - b.z || depthOf([a.x, a.y, 0], P) - depthOf([b.x, b.y, 0], P));
  for (const p of items) out.push(S(cylinder(p.x, p.y, 15, p.z, 11, P, 32), { tone: "lo", className: "cf-grounds" }));
  slot("pucks").innerHTML = out.join("");
}

function drawMilkLine(ml) {
  const z = LATTEGO.z0 + 8 + (ml / 300) * 96;
  const plan2 = { x: LATTEGO.x, y: LATTEGO.y, w: LATTEGO.w, d: LATTEGO.d, r: LATTEGO.r };
  slot("milkline").innerHTML = ml > 4 ? `<path class="cf-milk-line" d="${sideSeam(plan2, z, P, 6)}"/>` : "";
}

// Bed, lower piston and the spent puck.
function drawBrew(s) {
  const [cx, cy] = CHAMBER.c;
  const rin = CHAMBER.rin - 0.6;
  const bed = Math.max(s.bed, 0);
  let lp = LOWER_PISTON_Z;
  const rim = CHAMBER.z1;
  if (s.puck.rise > 0) lp = LOWER_PISTON_Z + (rim - bed - LOWER_PISTON_Z) * (s.puck.slide > 0 ? 1 - s.puck.fall : s.puck.rise);
  let out = S(cylinder(cx, cy, rin, CHAMBER.z0 + 1, lp - CHAMBER.z0 - 1, P, 40), { tone: "mid" });
  out += L(ring(cx, cy, rin - 4, lp, P, 32), { tone: "lo" });
  out += dotsSvg([0, 1, 2, 3, 4, 5].map((i) => iso([cx + Math.cos(i) * 9, cy + Math.sin(i) * 9, lp], P)), { size: 0.5, tone: "lo" });
  if (bed > 0.2 && s.puck.slide === 0 && s.stage !== "done" && s.stage !== "ready") {
    out += S(cylinder(cx, cy, rin, lp, bed, P, 40), { tone: "lo", className: "cf-grounds" });
  }
  slot("bed").innerHTML = out;

  // Puck: slides off the rim through the frame window and drops into the container.
  if (s.puck.slide > 0 && s.puck.fall < 1) {
    const y = cy + (218 - cy) * s.puck.slide;
    const z = rim - bed + (GROUNDS.z1 - (rim - bed)) * s.puck.fall * s.puck.fall;
    const fade = 1 - Math.max(0, (s.puck.fall - 0.85) / 0.15);
    slot("puck").innerHTML = `<g opacity="${fade.toFixed(2)}">${S(cylinder(cx, y, rin, z, bed, P, 40), { tone: "lo", className: "cf-grounds" })}</g>`;
  } else slot("puck").innerHTML = "";

  // Upper piston: hollow rod out of the gland, head on its end.
  const restBottom = HEAD.rest;
  const pressBottom = LOWER_PISTON_Z + bed;
  const bottom = restBottom - (restBottom - pressBottom) * s.piston;
  const head = S(cylinder(cx, cy, HEAD.r, bottom, HEAD.h, P, 48, 0.4), { tone: "hi", inner: L(sideArc(cx, cy, HEAD.r, bottom + 4, P, 40), { tone: "lo" }) });
  const rod = S(cylinder(cx, cy, 4, bottom + HEAD.h, GLAND_Z - bottom - HEAD.h, P, 20), { tone: "mid" });
  slot("piston").innerHTML = rod + head;
}

// Dispenser and cup.
let cupKind = "small";
function spoutTip() {
  const cup = CUPS[cupKind];
  return Math.min(SPOUT_RANGE[1], Math.max(SPOUT_RANGE[0], 48 + cup.h + 8));
}
let tipZ = spoutTip();
function drawDispenser() {
  const z = tipZ;
  let out = S(slabOf({ x: 102, y: 360, w: 48, d: 44, r: 6 }, z + 6, 14, P, 4, 0.6), { tone: "mid", inner: L(sideSeam({ x: 102, y: 360, w: 48, d: 44, r: 6 }, z + 12, P, 4), { tone: "faint" }) });
  for (const [x, y, rr] of [[126, 371, 2.6], [120, 389, 3.2], [132, 389, 3.2]]) out += S(cylinder(x, y, rr, z, 6, P, 16), { tone: "hi" });
  slot("dispenser").innerHTML = out;
}

function drawCup(s) {
  const cup = CUPS[cupKind];
  const [cx, cy] = CUP_AT;
  const z0 = 48;
  const rin = cup.r - 2.4;
  const base = 4;
  let out = `<path class="iso-halo" d="${slabOf({ x: cx - cup.r, y: cy - cup.r, w: cup.r * 2, d: cup.r * 2, r: cup.r }, z0, 0.1, P, 10).fill}" style="filter:blur(3px)"/>`;
  out += S(cylinder(cx, cy, cup.r, z0, cup.h, P, 56, 0.4), { tone: "mid", className: "cf-cup" });
  // Liquid seen through the glass: coffee settles under milk foam.
  const area = Math.PI * rin * rin; // mm²
  const toH = (ml) => (ml * 1000) / area;
  const coffeeH = Math.min(cup.h - base - 1, toH(s.coffeeMl + s.waterMl));
  const milkH = Math.min(cup.h - base - 1 - coffeeH, toH(s.milkMl * 0.55));
  const foamH = Math.min(cup.h - base - 1 - coffeeH - milkH, toH(s.milkMl * 0.45) * 1.6);
  let z = z0 + base;
  const layer = (h, cls) => {
    if (h < 0.3) return "";
    const svgL = S(cylinder(cx, cy, rin, z, h, P, 48), { tone: "lo", className: cls });
    z += h;
    return svgL;
  };
  if (s.drink.id === "latte") {
    out += layer(milkH, "cf-milk") + layer(coffeeH, "cf-coffee") + layer(foamH, "cf-foam");
  } else out += layer(coffeeH, s.drink.coffee ? "cf-coffee" : "cf-water") + layer(milkH, "cf-milk") + layer(foamH, "cf-foam");
  if (coffeeH > 2 && s.drink.coffee && !s.drink.milk) out += `<path class="cf-crema" d="${ring(cx, cy, rin - 1.2, z, P, 40)}"/>`;
  // Rim and handle.
  out += L(ring(cx, cy, cup.r - 1.2, z0 + cup.h, P, 48), { tone: "lo" });
  if (cupKind !== "glass") {
    const hx = cx + cup.r * Math.cos(AZ - 0.4);
    const hy = cy + cup.r * Math.sin(AZ - 0.4);
    const hz = z0 + cup.h * 0.55;
    out += L(pathOf([[0, -1], [0.5, -0.9], [0.9, -0.4], [0.95, 0.2], [0.6, 0.75], [0, 0.9]].map(([u, v]) => iso([hx + Math.cos(AZ - 0.4) * u * 12, hy + Math.sin(AZ - 0.4) * u * 12, hz - v * cup.h * 0.24], P))), { tone: "hi", free: true });
  }
  slot("cup").innerHTML = out;
  return z;
}

// Streams: coffee, hot water, milk and grounds in the air.
function drawStreams(s, surface) {
  let out = "";
  const z = tipZ;
  if (s.flowing.coffee) out += `<path class="cf-stream cf-stream-coffee" d="${seg3([120, 389, z], [120, 389, surface]) + seg3([132, 389, z], [132, 389, surface])}"/>`;
  if (s.flowing.water) out += `<path class="cf-stream cf-stream-water" d="${seg3([126, 371, z], [126, 371, surface])}"/>`;
  if (s.flowing.milk) {
    const sx = LATTEGO.x + LATTEGO.w + 1 + 11.6;
    out += `<path class="cf-stream cf-stream-milk" d="${pathOf([iso([sx, 372, 189], P), iso([sx + 4, 372, 182], P), iso([sx + 6, 372, surface], P)])}"/>`;
  }
  if (s.flowing.grounds) out += `<path class="cf-stream cf-stream-grounds" d="${pathOf([iso([165, 124, 212], P), iso([172, 126, 196], P), iso([180, 128, LOWER_PISTON_Z + s.bed + 1], P)])}"/>`;
  slot("streams").innerHTML = out;
}

// ---------- lights, flows, screen ----------
const comps = {};
for (const g of svg.querySelectorAll("[data-comp]")) (comps[g.dataset.comp] ??= []).push(g);
let litComp = null;
function light(comp) {
  if (comp === litComp) return;
  for (const g of comps[litComp] ?? []) for (const s of g.querySelectorAll(".iso-solid")) s.removeAttribute("data-lit");
  litComp = comp;
  for (const g of comps[comp] ?? []) for (const s of g.querySelectorAll(".iso-solid")) s.setAttribute("data-lit", "");
}
// Lit parts are re-rendered each frame for moving slots; mark them again after drawing.
function relight() {
  if (!litComp) return;
  for (const g of comps[litComp] ?? []) for (const s of g.querySelectorAll(".iso-solid:not([data-lit])")) s.setAttribute("data-lit", "");
}

const flows = {};
for (const p of svg.querySelectorAll("[data-flow]")) (flows[p.dataset.flow] ??= []).push(p);
let flowState = {};
function setFlows(f) {
  for (const key of Object.keys(flows)) {
    const on = !!f[key];
    if (flowState[key] === on) continue;
    flowState[key] = on;
    for (const p of flows[key]) p.toggleAttribute("data-on", on);
  }
}

const scr = (name) => svg.querySelector(`[data-screen="${name}"]`);
function drawScreen(s) {
  scr("title").textContent = plan.drink.name;
  const beans = [];
  if (plan.drink.coffee) for (let i = 0; i < 5; i++) beans.push(`<ellipse class="cf-scr-bean${i < plan.strength ? " on" : ""}" cx="${10 + i * 9}" cy="27" rx="3" ry="4.2" transform="rotate(25 ${10 + i * 9} 27)"/>`);
  scr("beans").innerHTML = beans.join("");
  scr("stage").textContent = s.stage === "ready" ? "Ready" : s.stage === "done" ? "Enjoy" : STAGES[s.stage].title + "…";
  scr("bar").setAttribute("width", ((SCREEN.w - 16) * Math.min(1, t / plan.total)).toFixed(1));
}

// ---------- panel ----------
function renderStages() {
  const list = $("[data-stages]");
  list.innerHTML = plan.steps
    .map((st, i) => `<li data-step="${st.id}"><button type="button" data-jump="${i}"><span class="cf-step-n">${i + 1}</span><span class="cf-step-t">${STAGES[st.id].title}</span><span class="cf-step-d">${st.dur.toFixed(1)} s</span></button></li>`)
    .join("");
}
function renderFacts() {
  $("[data-fact=dose]").textContent = plan.drink.coffee ? `${plan.dose.toFixed(1)} g` : "none";
  $("[data-fact=volume]").textContent = `${(plan.drink.coffee ?? 0) + (plan.drink.water ?? 0) + (plan.drink.milk ?? 0)} ml`;
  $("[data-fact=temp]").textContent = plan.drink.coffee || plan.drink.water ? `${plan.brewC} °C` : "steam";
  $("[data-fact=time]").textContent = `${plan.total.toFixed(0)} s`;
}
let lastStage = "";
function updatePanel(s) {
  const id = s.stage;
  if (id !== lastStage) {
    lastStage = id;
    for (const li of $$("[data-stages] li")) li.toggleAttribute("data-now", li.dataset.step === id);
    const info = STAGES[id === "done" ? "ready" : id];
    $("[data-explain-title]").textContent = id === "done" ? "Done" : info.title;
    $("[data-explain]").textContent = id === "done" ? `Your ${plan.drink.name.toLowerCase()} is ready. The brew group is back at rest, ${pucks} puck${pucks === 1 ? "" : "s"} in the grounds container.` : info.text;
  }
  for (const li of $$("[data-stages] li")) {
    const st = plan.steps.find((x) => x.id === li.dataset.step);
    const share = Math.max(0, Math.min(1, (t - st.t0) / st.dur));
    li.style.setProperty("--p", share.toFixed(3));
  }
  $("[data-gauge=tank]").textContent = `${Math.round(tankMl - (committed ? 0 : s.usedMl))} ml`;
  $("[data-gauge=beans]").textContent = `${Math.round(beansG - (committed ? 0 : s.beansUsed))} g`;
  $("[data-gauge=pucks]").textContent = `${pucks + (!committed && s.puck.fall >= 1 ? 1 : 0)} / 12`;
  $("[data-gauge=cup]").textContent = `${Math.round(s.cupMl)} ml`;
  const btn = $("[data-brew]");
  btn.textContent = playing ? "Pause" : t > 0 && t < plan.total ? "Resume" : "Brew";
}

// ---------- frame ----------
let spin = 0;
let rotor = 0;
let flowPhase = 0;
function draw() {
  const s = stateAt(plan, t);
  s.drink = plan.drink;
  const part = s.step ? STAGES[s.step.id].part : null;
  light(part);
  drawBrew(s);
  drawBurr(spin);
  drawRotor(rotor);
  drawBeans(beansG - (committed ? 0 : s.beansUsed));
  drawTank(tankMl - (committed ? 0 : s.usedMl));
  drawPucks(Math.min(12, pucks + (!committed && s.puck.fall >= 1 ? 1 : 0)));
  drawMilkLine(milkMl - (committed ? 0 : s.milkMl));
  drawDispenser();
  const surface = drawCup(s);
  drawStreams(s, surface);
  relight();
  setFlows(s.flowing);
  svg.style.setProperty("--flow", `${flowPhase.toFixed(1)}px`);
  drawScreen(s);
  const label = s.stage === "ready" ? "Ready" : s.stage === "done" ? "Done" : STAGES[s.stage].title;
  const text = `${label} · ${Math.round(s.tempC)} °C · ${s.bar.toFixed(1)} bar · ${Math.round(s.cupMl)} ml`;
  if (readout.textContent !== text) readout.textContent = text;
  updatePanel(s);
  return s;
}

// ---------- loop ----------
let frame = 0;
let last = 0;
let visible = true;
let restTimer = 0;
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 20) : 1 / 60;
  last = now;
  const s0 = stateAt(plan, t);
  if (playing) {
    t += dt * settings.speed;
    if (s0.flowing.grounds) spin += dt * 9;
    if (["preinfuse", "extract", "water", "steam", "milk"].includes(s0.stage)) rotor += dt * 14;
    flowPhase -= dt * 26;
    if (t >= plan.total) {
      t = plan.total;
      playing = false;
      bank();
      if (touring) restTimer = setTimeout(() => touring && startTour(), 4200);
    }
  }
  draw();
  frame = playing && visible ? requestAnimationFrame(tick) : 0;
}
function run() {
  if (!frame && visible) {
    last = 0;
    frame = requestAnimationFrame(tick);
  }
}
function bank() {
  if (committed) return;
  const s = stateAt(plan, plan.total);
  tankMl = Math.max(200, tankMl - s.usedMl);
  beansG = Math.max(20, beansG - s.beansUsed);
  milkMl = Math.max(0, milkMl - s.milkMl);
  if (plan.drink.coffee) pucks = (pucks % 12) + 1;
  committed = true;
}
function refill() {
  if (tankMl < 400) tankMl = 1450;
  if (beansG < 40) beansG = 210;
  if (milkMl < 40) milkMl = 260;
}

function choose(next) {
  Object.assign(settings, next);
  if (t > 0 && !committed && t >= plan.total) bank();
  plan = planOf(settings);
  cupKind = plan.drink.cup;
  tipZ = spoutTip();
  t = 0;
  committed = false;
  playing = false;
  renderStages();
  renderFacts();
  syncControls();
  draw();
}
function brew() {
  if (t >= plan.total) {
    refill();
    t = 0;
    committed = false;
  }
  playing = !playing;
  if (playing) run();
  else draw();
}

function syncControls() {
  for (const b of $$("[data-drink]")) b.setAttribute("aria-pressed", String(b.dataset.drink === settings.drink));
  for (const b of $$("[data-strength]")) b.setAttribute("aria-pressed", String(Number(b.dataset.strength) <= settings.strength));
  for (const b of $$("[data-temp]")) b.setAttribute("aria-pressed", String(Number(b.dataset.temp) === settings.temp));
  for (const b of $$("[data-speed]")) b.setAttribute("aria-pressed", String(Number(b.dataset.speed) === settings.speed));
  $("[data-strength-row]").toggleAttribute("data-off", !plan.drink.coffee);
  $("#cf-grind").value = String(settings.grind);
  $("[data-grind-out]").textContent = `${settings.grind} of 12 · ${settings.grind <= 4 ? "fine" : settings.grind >= 9 ? "coarse" : "medium"}`;
  drawKnob(settings.grind);
}

// The user takes over from the tour on any control.
function takeOver() {
  touring = false;
  clearTimeout(restTimer);
  clearTimeout(idleTimer);
}
root.addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  takeOver();
  if (b.dataset.drink) choose({ drink: b.dataset.drink });
  else if (b.dataset.strength) choose({ strength: Number(b.dataset.strength) });
  else if (b.dataset.temp) choose({ temp: Number(b.dataset.temp) });
  else if (b.dataset.speed) {
    settings.speed = Number(b.dataset.speed);
    syncControls();
  } else if (b.dataset.brew !== undefined) brew();
  else if (b.dataset.jump !== undefined) {
    const st = plan.steps[Number(b.dataset.jump)];
    if (t >= plan.total) committed = false;
    t = st.t0 + st.dur * 0.35;
    draw();
  }
});
$("#cf-grind").addEventListener("input", (e) => {
  takeOver();
  choose({ grind: Number(e.target.value) });
});
document.addEventListener("keydown", (e) => {
  if (e.key === " " && (e.target === document.body || e.target.closest?.(".iso-stage"))) {
    e.preventDefault();
    takeOver();
    brew();
  }
});

new IntersectionObserver((entries) => {
  visible = entries[entries.length - 1].isIntersecting;
  if (visible && playing) run();
}, { rootMargin: "120px 0px" }).observe(svg);

// ---------- tour ----------
const TOUR = ["espresso", "cappuccino", "americano", "latte", "coffee"];
let tourIndex = 0;
function startTour() {
  if (!touring) return;
  refill();
  choose({ drink: TOUR[tourIndex++ % TOUR.length] });
  touring = true;
  playing = true;
  run();
}

// First frame: an espresso mid-extraction, so the still picture already shows the machine working.
choose({ drink: "espresso" });
{
  const ex = plan.steps.find((s) => s.id === "extract");
  t = ex.t0 + ex.dur * 0.55;
  draw();
}
if (touring) {
  tourIndex = 1;
  idleTimer = setTimeout(() => {
    if (!touring) return;
    playing = true;
    run();
  }, 1600);
}
