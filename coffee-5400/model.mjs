// The brew cycle as a pure model. Everything the figure moves and every number
// the readout shows comes from `stateAt(plan, t)`.
//
// Machine figures from Philips' published spec for the 5400 series: 15 bar pump,
// 1.8 L tank, 275 g bean hopper, 12-step ceramic grinder, five strength levels,
// three temperature levels, spout height 85–145 mm, LatteGo milk system,
// thermoblock heating. Doses, flow rates and stage times are representative of
// this kind of brew group, not factory calibration.

export const DRINKS = [
  { id: "espresso", name: "Espresso", coffee: 40, flow: 1.8, bar: 9, cup: "small" },
  { id: "ristretto", name: "Ristretto", coffee: 25, flow: 1.3, bar: 9.5, cup: "small" },
  { id: "lungo", name: "Espresso lungo", coffee: 80, flow: 2.4, bar: 8, cup: "mug" },
  { id: "coffee", name: "Coffee", coffee: 120, flow: 3.4, bar: 6, cup: "mug" },
  { id: "americano", name: "Americano", coffee: 40, flow: 1.8, bar: 9, water: 110, cup: "mug" },
  { id: "cappuccino", name: "Cappuccino", coffee: 40, flow: 1.8, bar: 9, milk: 100, cup: "mug" },
  { id: "latte", name: "Latte macchiato", coffee: 60, flow: 2, bar: 8.5, milk: 200, cup: "glass" },
  { id: "water", name: "Hot water", water: 200, cup: "mug" },
  { id: "froth", name: "Milk froth", milk: 150, cup: "mug" },
];

export const CUPS = {
  small: { r: 27, h: 52, label: "espresso cup" },
  mug: { r: 33, h: 92, label: "mug" },
  glass: { r: 30, h: 138, label: "latte glass" },
};

export const TEMPS = [
  { id: 1, name: "Normal", c: 90 },
  { id: 2, name: "High", c: 93 },
  { id: 3, name: "Higher", c: 96 },
];

// Strength (1–5 beans) sets the dose.
export const doseOf = (strength) => 7 + (strength - 1) * 1.1;

// One coarser step on the 12-step grinder speeds the shot up by about 4 %.
export const grindFactor = (grind) => 1 + (grind - 6) * 0.04;

export const STAGES = {
  heat: {
    title: "Heat",
    part: "thermo",
    text: "The thermoblock, an aluminium block with a heating element cast around a thin water channel, comes up to temperature in seconds. Water is heated only as it passes through.",
  },
  grind: {
    title: "Grind",
    part: "grinder",
    text: "The motor spins the lower ceramic burr under the fixed upper burr. Beans fall from the hopper, are cut between the burrs, and the grounds slide down the chute into the open brew chamber.",
  },
  compress: {
    title: "Tamp",
    part: "brew",
    text: "The brew group drives its upper piston down on its hollow rod into the chamber and presses the grounds into a firm, level bed, the same job a barista's tamper does.",
  },
  preinfuse: {
    title: "Pre-infuse",
    part: "pump",
    text: "The pump pushes a short burst of hot water onto the bed, then pauses. The grounds swell and degas, so water flows through evenly instead of finding a channel.",
  },
  extract: {
    title: "Extract",
    part: "brew",
    text: "The vibration pump (rated 15 bar) draws water from the tank through the flowmeter, which counts every millilitre, and pushes it through the thermoblock, down through the upper piston and the coffee bed. Resistance builds about 9 bar at the bed; coffee leaves through the crema valve in the lower piston and runs to the spout.",
  },
  water: {
    title: "Hot water",
    part: "valves",
    text: "A solenoid valve switches the heated water away from the brew group to the hot-water line, which runs to the centre nozzle of the spout.",
  },
  steam: {
    title: "Steam",
    part: "thermo",
    text: "The thermoblock runs hotter to flash a small flow of water into steam, and the steam valve sends it to the LatteGo port at the back of the cup bay.",
  },
  milk: {
    title: "Froth milk",
    part: "lattego",
    text: "In the LatteGo's frothing chamber the jet of steam pulls milk up from the container, mixes in air and spins it into foam, which pours straight into the cup. There are no tubes to clean.",
  },
  eject: {
    title: "Eject puck",
    part: "brew",
    text: "The upper piston lifts, the lower piston pushes the spent puck up to the rim and the scraper sweeps it off. It drops into the grounds container, which holds about 12 pucks.",
  },
  ready: {
    title: "Ready",
    part: null,
    text: "Choose a drink and press Brew. The part working at each stage lights up, and the readout shows live temperature, pressure and volume.",
  },
};

export function planOf({ drink, strength = 3, grind = 6, temp = 2 }) {
  const d = DRINKS.find((x) => x.id === drink) ?? DRINKS[0];
  const brewC = TEMPS.find((x) => x.id === temp)?.c ?? 93;
  const steps = [];
  const add = (id, dur, extra = {}) => steps.push({ id, dur, ...extra });
  add("heat", 3.5);
  if (d.milk) {
    add("steam", 3);
    add("milk", d.milk / 7);
  }
  const dose = doseOf(strength);
  if (d.coffee) {
    add("grind", dose / 0.9);
    add("compress", 2.8);
    add("preinfuse", 3.6);
    add("extract", d.coffee / (d.flow * grindFactor(grind)), { ml: d.coffee });
  }
  if (d.water) add("water", d.water / 8, { ml: d.water });
  if (d.coffee) add("eject", 4.2);
  let t = 0;
  for (const s of steps) {
    s.t0 = t;
    t += s.dur;
    s.t1 = t;
  }
  return { drink: d, strength, grind, temp, brewC, dose, steps, total: t };
}

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const ease = (v) => {
  const x = clamp01(v);
  return x * x * (3 - 2 * x);
};

// Everything the picture and the readout need at time t (seconds of real brew).
export function stateAt(plan, t) {
  const { steps, drink, dose, brewC } = plan;
  const step = steps.find((s) => t >= s.t0 && t < s.t1) ?? null;
  const done = t >= plan.total;
  const local = step ? (t - step.t0) / step.dur : 0;
  const passed = (id) => {
    const s = steps.find((x) => x.id === id);
    return !s ? 0 : clamp01((t - s.t0) / s.dur);
  };

  const ground = dose * passed("grind");
  const coffeeMl = (drink.coffee ?? 0) * passed("extract");
  const waterMl = (drink.water ?? 0) * passed("water");
  const milkMl = (drink.milk ?? 0) * passed("milk");

  // Upper piston travel: 0 at rest, 1 fully down on the bed.
  let piston = 0;
  const pc = passed("compress");
  const pe = passed("eject");
  if (drink.coffee) piston = pe > 0 ? 1 - ease(pe / 0.3) : ease(pc);

  // Puck: rises to the rim, slides off, falls into the container.
  const puck = { rise: 0, slide: 0, fall: 0 };
  if (pe > 0) {
    puck.rise = ease((pe - 0.25) / 0.25);
    puck.slide = ease((pe - 0.5) / 0.2);
    puck.fall = ease((pe - 0.7) / 0.25);
  }

  // Pressure at the bed, in bar.
  let bar = 0;
  if (step?.id === "preinfuse") bar = local < 0.45 ? 2.5 * ease(local / 0.2) : 2.5 * (1 - ease((local - 0.45) / 0.3));
  if (step?.id === "extract") bar = drink.bar * ease(local / 0.12) * (1 - 0.15 * local);
  if (step?.id === "water") bar = 1.2;
  if (step?.id === "milk" || step?.id === "steam") bar = 1.5;

  // Water temperature at the thermoblock outlet, °C.
  let tempC = 22;
  if (step) {
    const heat = steps.find((s) => s.id === "heat");
    const h = clamp01((t - heat.t0) / heat.dur);
    tempC = 22 + (brewC - 22) * ease(h * 1.05);
    if (step.id === "steam" || step.id === "milk") tempC = 120 + 10 * ease(local / 0.4);
  } else if (done) tempC = brewC - 6;

  const flowing = {
    tank: ["preinfuse", "extract", "water", "steam", "milk"].includes(step?.id) && !(step?.id === "preinfuse" && local > 0.45),
    brewIn: step?.id === "extract" || (step?.id === "preinfuse" && local <= 0.45),
    coffee: step?.id === "extract" && local > 0.1,
    water: step?.id === "water",
    steam: step?.id === "steam" || step?.id === "milk",
    milk: step?.id === "milk",
    grounds: step?.id === "grind",
  };

  const usedMl = (drink.coffee ?? 0) * passed("extract") + 6 * passed("preinfuse") + waterMl + 8 * passed("steam") + 12 * passed("milk");

  return {
    step,
    stage: step ? step.id : done ? "done" : "ready",
    local,
    done,
    ground,
    bed: ground * 1.45,
    coffeeMl,
    waterMl,
    milkMl,
    cupMl: coffeeMl + waterMl + milkMl,
    piston,
    puck,
    bar,
    tempC,
    flowing,
    usedMl,
    beansUsed: ground,
  };
}
