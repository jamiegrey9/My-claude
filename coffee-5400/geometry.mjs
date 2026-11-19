// World layout of a Philips 5400 series bean-to-cup machine, in millimetres.
// x runs left to right across the front (246 wide), y from the back wall to the
// front panel (433 deep), z up from the worktop (371 tall). The right-hand side
// panel and the brew-group service door are off, so the camera looks in from
// the front-right.

export const BODY = { w: 246, d: 433, h: 371 };
export const FOOT_H = 8;
export const FLOOR = 22; // top of the chassis base

// Front-accessible water tank, right front corner.
export const TANK = { x: 190, y: 240, w: 48, d: 182, r: 6, z0: 150, z1: 340 };
export const TANK_ML = 1800;
export const tankZ = (ml) => TANK.z0 + 6 + (TANK.z1 - 14 - TANK.z0 - 6) * (ml / TANK_ML);

// Bean hopper and ceramic flat-burr grinder, top left rear.
export const HOPPER = { x: 24, y: 44, w: 108, d: 132, r: 10, z0: 330, z1: 392 };
export const HOPPER_G = 275;
export const beanZ = (g) => HOPPER.z0 + 10 + 36 * (g / HOPPER_G);
export const GRINDER = { c: [78, 110], r: 36, z0: 296, z1: 306, motorZ0: 252 };
export const GRIND_STEPS = 12;

// Brew group, right rear behind the service door.
export const BREW = { x: 162, y: 60, w: 64, d: 140, z0: 110, z1: 290 };
export const CHAMBER = { c: [194, 130], r: 25, rin: 21, z0: 142, z1: 202 };
export const LOWER_PISTON_Z = 150; // top of the lower piston, at rest
export const GLAND_Z = 258; // underside of the crossbar gland
export const HEAD = { r: 20, h: 12, rest: 236 }; // piston head bottom at rest
export const BED_PER_G = 1.45; // mm of compressed bed per gram

// Grounds container under the brew group, drip tray at the front.
export const GROUNDS = { x: 150, y: 40, w: 86, d: 270, r: 5, z0: FLOOR, z1: 72 };
export const DRIP = { x: 46, y: 318, w: 192, d: 128, r: 6, z0: FLOOR, z1: 48 };

// Cup bay and dispenser.
export const BAY = { x0: 46, x1: 188, yBack: 330, ceil: 214 };
export const CUP_AT = [132, 388];
export const SPOUT_RANGE = [48 + 85, 48 + 145]; // nozzle tip, 85–145 mm above the grille

// Hydraulics: pump and flowmeter bottom left; thermoblock and valves on the shelf behind the brew group.
export const PUMP = { x: 100, z: 62, y0: 160, y1: 250, r: 17 };
export const FLOWMETER = { c: [138, 300], z0: 106, z1: 118, r: 9 };
export const THERMO = { x: 168, y: 12, w: 68, d: 44, r: 4, z0: 150, z1: 200 };
export const VALVES = { x: 176, y: 14, w: 50, d: 40, r: 2, z0: 200, z1: 224 };

// LatteGo on the drip tray, left of the cup.
export const LATTEGO = { x: 54, y: 340, w: 44, d: 64, r: 10, z0: 48, z1: 200 };
