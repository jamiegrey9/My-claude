const PARTS = __PARTS__;
const CHAIN = __CHAIN__;
const P = __P__;
const GAS = __GAS__;

const app = document.getElementById("app");
const stage = document.querySelector("[data-stage]");
const svg = stage.querySelector("svg");
const readout = document.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");

// ---- theme: follow the host, allow a local toggle ----
const dark = matchMedia("(prefers-color-scheme: dark)");
let forced = null;
function applyTheme() {
  const host = document.documentElement.getAttribute("data-theme");
  const theme = forced || (host === "dark" || host === "light" ? host : dark.matches ? "dark" : "light");
  app.setAttribute("data-theme", theme);
}
dark.addEventListener?.("change", applyTheme);
new MutationObserver(applyTheme).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
document.querySelector("[data-theme-toggle]").addEventListener("click", () => {
  forced = app.getAttribute("data-theme") === "dark" ? "light" : "dark";
  applyTheme();
});
applyTheme();

// ---- selection ----
const info = Object.fromEntries([...document.querySelectorAll("[data-info]")].map((n) => [n.dataset.info, n]));
const buttons = [...document.querySelectorAll("[data-pick]")];
const order = buttons.map((b) => b.dataset.pick);
const steps = [...document.querySelectorAll(".chain li")];
let current = null;
function select(id) {
  if (!PARTS[id]) return;
  current = id;
  const part = PARTS[id];
  svg.querySelectorAll("[data-part]").forEach((g) => g.classList.toggle("on", g.dataset.part === id));
  stage.classList.add("picking");
  buttons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.pick === id)));
  info.tag.textContent = part.tag + " · step " + (CHAIN.indexOf(part.chain) + 1) + " of " + CHAIN.length;
  info.name.textContent = part.name;
  info.what.textContent = part.what;
  info["how-h"].textContent = part.tag === "Electronics" ? "How the circuit works" : "How it works";
  info.how.textContent = part.how;
  info.practice.textContent = part.practice;
  const at = CHAIN.indexOf(part.chain);
  steps.forEach((s, i) => { s.classList.toggle("on", i === at); s.classList.toggle("done", i < at); });
  readout.textContent = part.name;
  const ionsOn = ["argon", "collector", "electrodes", "bias"].includes(id);
  stage.toggleAttribute("data-ions-on", ionsOn);
  stage.toggleAttribute("data-gas-on", id === "argon");
  stage.toggleAttribute("data-flow", ["electrometer", "adc", "display"].includes(id));
}
svg.addEventListener("click", (event) => {
  const g = event.target.closest("[data-part]");
  if (g) select(g.dataset.part);
});
buttons.forEach((b) => b.addEventListener("click", () => select(b.dataset.pick)));
document.querySelector(".parts").addEventListener("keydown", (event) => {
  const i = order.indexOf(current);
  let to = null;
  if (event.key === "ArrowDown" || event.key === "ArrowRight") to = Math.min(order.length - 1, i + 1);
  if (event.key === "ArrowUp" || event.key === "ArrowLeft") to = Math.max(0, i - 1);
  if (to === null) return;
  event.preventDefault();
  select(order[to]);
  buttons[to].focus();
});
select("collector");

// ---- ion pairs drifting apart on the two cut planes ----
const layer = svg.querySelector("[data-ions]");
const NS = "http://www.w3.org/2000/svg";
const project = ([x, y, z]) => {
  const a = (P.azimuth * Math.PI) / 180, e = (P.elevation * Math.PI) / 180, k = P.scale * Math.sqrt(1.6);
  return [P.origin[0] + (x * Math.sin(a) - y * Math.cos(a)) * k, P.origin[1] + ((x * Math.cos(a) + y * Math.sin(a)) * Math.sin(e) - z * Math.cos(e)) * k];
};
const RC = (GAS.cr0 + GAS.cr1) / 2;
const inGas = (r, z) => {
  if (z < GAS.base + 1 || z > GAS.top - 1 || r > GAS.outer - 1) return false;
  if (r < GAS.wellR + 1 && z > GAS.wellZ - 1) return false;
  if (r > GAS.cr0 - 0.6 && r < GAS.cr1 + 0.6 && z > GAS.cz0 && z < GAS.cz1) return false;
  return true;
};
let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
function spawn(pair) {
  let r, z;
  do { r = rand() * GAS.outer; z = GAS.base + rand() * (GAS.top - GAS.base); } while (!inGas(r, z));
  pair.t = rand() < 0.5 ? 0 : 90;
  pair.r = r; pair.z = z; pair.age = 0;
  pair.ion = r; pair.el = r;
  // collector side: ions drift to the collector, electrons to the nearest bias wall
  pair.dir = r < RC ? 1 : -1;
  pair.life = 1.6 + rand() * 1.2;
}
const pairs = Array.from({ length: 34 }, () => {
  const ion = document.createElementNS(NS, "circle");
  const el = document.createElementNS(NS, "circle");
  ion.setAttribute("r", "1.25");
  el.setAttribute("r", "0.8");
  el.setAttribute("class", "el");
  layer.append(ion, el);
  const pair = { ion: 0, el: 0, nodeI: ion, nodeE: el };
  spawn(pair);
  pair.age = rand() * pair.life;
  return pair;
});
const place = (node, r, t, z, alpha) => {
  const rad = (t * Math.PI) / 180;
  const [sx, sy] = project([r * Math.cos(rad), r * Math.sin(rad), z]);
  node.setAttribute("cx", sx.toFixed(1));
  node.setAttribute("cy", sy.toFixed(1));
  node.style.opacity = alpha.toFixed(2);
};
function stepIons(dt) {
  for (const p of pairs) {
    p.age += dt;
    if (p.age > p.life) spawn(p);
    const s = p.age;
    // positive ions slow, electrons fast (really ~1000× faster; compressed here)
    const ionR = p.r + p.dir * 7 * s;
    const elR = p.r - p.dir * 22 * s;
    const fade = Math.min(1, s / 0.25) * Math.min(1, (p.life - s) / 0.4);
    const ionOk = p.dir > 0 ? ionR < GAS.cr0 : ionR > GAS.cr1;
    const elOk = elR > (p.z > GAS.wellZ ? GAS.wellR : 0) && elR < GAS.outer;
    place(p.nodeI, ionOk ? ionR : p.dir > 0 ? GAS.cr0 : GAS.cr1, p.t, p.z, ionOk ? fade : fade * 0.3);
    place(p.nodeE, Math.max(0, Math.min(GAS.outer, elR)), p.t, p.z, elOk ? fade * 0.9 : 0);
  }
}
let last = 0, frame = 0, visible = true;
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 20) : 1 / 60;
  last = now;
  stepIons(dt);
  frame = visible && !still.matches ? requestAnimationFrame(tick) : 0;
}
const run = () => { if (!frame && visible && !still.matches) { last = 0; frame = requestAnimationFrame(tick); } };
new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; run(); }).observe(stage);
stepIons(0.01);
for (let i = 0; i < 40; i++) stepIons(0.03);
run();
still.addEventListener?.("change", run);

// ---- the screen reading wanders by a few hundredths, like a live measurement ----
const reading = svg.querySelector("[data-reading]");
setInterval(() => {
  if (still.matches || !visible) return;
  reading.textContent = (742.6 + (Math.random() - 0.5) * 0.4).toFixed(1);
}, 1000);
