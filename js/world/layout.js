// World layout: the grid, the island outline, the shores, and where the camera stops.
// Units are metres. +X is east, +Z is south, so north is -Z. The island is compressed:
// this is a Manhattan of the mind, not a survey.

export const G = { x0: -1380, AV: 230, NA: 12, zS: 4800, ST: 80, NS: 120, aveW: 32, stW: 18 };
export const LEN = G.NS * G.ST;

export const colX = (i) => G.x0 + i * G.AV;
export const rowZ = (j) => G.zS - j * G.ST;        // south edge of row j
export const tOfZ = (z) => (G.zS - z) / LEN;
export const zOfT = (t) => G.zS - t * LEN;

function table(rows) {
  return (t) => {
    if (t <= rows[0][0]) return rows[0].slice(1);
    for (let i = 1; i < rows.length; i++) {
      if (t <= rows[i][0]) {
        const a = rows[i - 1], b = rows[i], k = (t - a[0]) / (b[0] - a[0]);
        return a.slice(1).map((v, n) => v + (b[n + 1] - v) * k);
      }
    }
    return rows[rows.length - 1].slice(1);
  };
}

// Island edges by t (0 = the Battery, 1 = the northern tip): [t, west, east]
const OUT = table([
  [0.00, -260, 160], [0.02, -560, 430], [0.05, -820, 720], [0.10, -1160, 1110], [0.16, -1300, 1380],
  [0.30, -1380, 1380], [0.36, -1380, 1210], [0.70, -1380, 1150], [0.80, -1380, 900], [0.90, -1300, 320], [1.00, -1080, -420],
]);
export const outline = (t) => { const [w, e] = OUT(Math.min(1, Math.max(0, t))); return { w, e }; };

// The far banks. East: Brooklyn, Queens, then the Bronx wrapping round the top. West: New Jersey.
const EB = table([[-0.6, 3700], [-0.2, 2800], [0, 2100], [0.10, 2100], [0.16, 2300], [0.30, 2250], [0.36, 2050],
  [0.70, 2000], [0.80, 1500], [0.90, 640], [1.00, -160], [1.03, -900], [1.06, -1250], [3, -1250]]);
const WB = table([[-0.6, -4300], [-0.2, -2950], [0, -2300], [0.1, -2650], [0.3, -2750], [1.0, -2650], [3, -2500]]);
export const shoreE = (z) => EB(tOfZ(z))[0];
export const shoreW = (z) => WB(tOfZ(z))[0];

// Central Park: columns 4..6, rows 64..96
export const PARK = { c0: 4, c1: 6, r0: 64, r1: 96 };
PARK.x0 = colX(PARK.c0) + G.aveW / 2; PARK.x1 = colX(PARK.c1 + 1) - G.aveW / 2;
PARK.zN = rowZ(PARK.r1 + 1) + G.stW / 2; PARK.zS = rowZ(PARK.r0) - G.stW / 2;
export const RES = { x: -115, z: -1900, rx: 285, rz: 330 };   // the reservoir

// Landmarks, by base centre
export const LM = {
  obelisk:  { x: 115,  z: 4320, h: 560 },
  wtc:      { x: -575, z: 4000, h: 417 },
  esb:      { x: -115, z: 1040, h: 443 },
  chrysler: { x: 345,  z: 440,  h: 319 },
  veripres: { x: 1035, z: 1200, h: 150 },
  times:    { x: -230, z: 280 },
  park432:  { x: 345,  z: -200, h: 426 },
  wsp:      { x: -115, z: 2480 },
  campus:   { x: -920, z: -3640 },
  bbridge:  { z: 3680, xa: 1185, x1: 1420, x2: 1900, xb: 2140 },
  liberty:  { x: -2150, z: 6600 },
};

// Camera stops. pos / tgt / fov(deg). The film is a loop: up the east side, back down the middle,
// out past the bridge to the harbour.
export const STOPS = [
  { id: 'title',     pos: [660, 24, 7600],     tgt: [20, 455, 4300],    fov: 26 },
  { id: 'obelisk',   pos: [760, 215, 5060],    tgt: [115, 318, 4320],   fov: 37 },
  { id: 'veripres',  pos: [1960, 120, 1610],   tgt: [1035, 82, 1200],   fov: 34 },
  { id: 'education', pos: [-1310, 96, -3330],  tgt: [-920, 22, -3680],  fov: 35 },
  { id: 'training',  pos: [-150, 24, -2440],   tgt: [-40, 185, -240],   fov: 31 },
  { id: 'sleight',   pos: [-230, 19, 655],     tgt: [-230, 50, 170],    fov: 39 },
  { id: 'chess',     pos: [-60, 64, 2700],     tgt: [-115, 12, 2440],   fov: 40 },
  { id: 'film',      pos: [2075, 9, 3505],     tgt: [820, 235, 4160],   fov: 33 },
  { id: 'contact',   pos: [-3300, 900, 9300],  tgt: [-100, 120, 2700],  fov: 29 },
];
// Where the map pins stand.
export const PINS = { obelisk: [115, 590, 4320], veripres: [1035, 175, 1200], education: [-920, 70, -3640], training: [-115, 20, -1900],
  sleight: [-230, 150, 280], chess: [-115, 50, 2480], film: [1660, 110, 3680], contact: [-700, 0, 6600] };
export const MAP_VIEW = { tgt: [0, 0, 1100], dist: 14200, az: 0.52, el: 0.62, fov: 28 };

// Seeded random, so the city is the same city on every visit.
export function rng(seed) {
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
