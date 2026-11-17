// Builds the city: one instanced mesh of boxes for every building, one point cloud for every light.
import * as THREE from 'three';
import { G, LEN, colX, rowZ, tOfZ, zOfT, outline, shoreE, shoreW, PARK, RES, LM, rng } from './layout.js';
import { facadeMaterial, groundMaterial, lightsMaterial, treeMaterial } from './materials.js';

const WARM = [1.0, 0.66, 0.34], LED = [1.0, 0.90, 0.76], RED = [1.0, 0.08, 0.04], COOL = [0.78, 0.88, 1.0], BLUE = [0.30, 0.50, 1.0];

class Boxes {
  constructor(R) { this.R = R; this.pos = []; this.size = []; this.misc = []; this.fx = []; this.n = 0; }
  add(x, y, z, w, h, d, style, o = {}) {
    this.pos.push(x, y, z); this.size.push(w, h, d);
    this.misc.push(o.seed ?? this.R(), style, o.taper ?? 1, o.lit ?? 1);
    this.fx.push(o.flood || 0, o.hue || 0, o.edge || 0, 0); this.n++;
  }
  mesh() {
    const b = new THREE.BoxGeometry(1, 1, 1); b.translate(0, 0.5, 0);
    const g = new THREE.InstancedBufferGeometry();
    g.index = b.index; g.setAttribute('position', b.attributes.position); g.setAttribute('normal', b.attributes.normal);
    const ia = (arr, n) => new THREE.InstancedBufferAttribute(new Float32Array(arr), n);
    g.setAttribute('aPos', ia(this.pos, 3)); g.setAttribute('aSize', ia(this.size, 3));
    g.setAttribute('aMisc', ia(this.misc, 4)); g.setAttribute('aFx', ia(this.fx, 4));
    g.instanceCount = this.n;
    const m = new THREE.Mesh(g, facadeMaterial(true)); m.frustumCulled = false; return m;
  }
}
class Lights {
  constructor() { this.p = []; this.c = []; this.a = []; this.v = []; }
  // kind 0 = street lamp (follows the hour), 1 = always on, 2 = drifting (boats)
  add(x, y, z, col, size, o = {}) {
    const k = o.i ?? 1; this.p.push(x, y, z); this.c.push(col[0] * k, col[1] * k, col[2] * k);
    this.a.push(size, o.blink || 0, o.phase ?? Math.random(), o.kind ?? 0); const v = o.vel || [0, 0, 0]; this.v.push(v[0], v[1], v[2]);
  }
  mesh() {
    const g = new THREE.BufferGeometry(); const f = (a, n) => new THREE.BufferAttribute(new Float32Array(a), n);
    g.setAttribute('position', f(this.p, 3)); g.setAttribute('color', f(this.c, 3)); g.setAttribute('aP', f(this.a, 4)); g.setAttribute('aVel', f(this.v, 3));
    const m = new THREE.Points(g, lightsMaterial()); m.frustumCulled = false; return m;
  }
}

// a custom (non-box) mesh that still wants the facade shader
function bake(geo, size, style, o = {}) {
  const n = geo.attributes.position.count; const rep = (vals) => { const a = new Float32Array(n * vals.length); for (let i = 0; i < n; i++) a.set(vals, i * vals.length); return new THREE.BufferAttribute(a, vals.length); };
  geo.setAttribute('aPos', rep([0, 0, 0])); geo.setAttribute('aSize', rep(size));
  geo.setAttribute('aMisc', rep([o.seed ?? 0.5, style, 1, o.lit ?? 1])); geo.setAttribute('aFx', rep([o.flood || 0, o.hue || 0, 0, 0]));
  return geo;
}

function sign(text, o = {}) {
  const W = o.cw || 1024, Hh = o.ch || 256; const c = document.createElement('canvas'); c.width = W; c.height = Hh; const x = c.getContext('2d');
  x.fillStyle = o.bg || '#000'; x.fillRect(0, 0, W, Hh);
  if (o.border) { x.strokeStyle = o.fg || '#fff'; x.lineWidth = 6; x.strokeRect(14, 14, W - 28, Hh - 28); }
  x.fillStyle = o.fg || '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle';
  const lines = String(text).split('\n'); const fs = o.fs || Math.floor(Hh * 0.5 / Math.max(1, lines.length * 0.75));
  x.font = `${o.weight || 400} ${fs}px ${o.font || '"Libre Caslon Display", "Libre Caslon Text", Georgia, serif'}`;
  if (o.track) x.letterSpacing = o.track;
  lines.forEach((ln, i) => x.fillText(ln, W / 2, Hh / 2 + (i - (lines.length - 1) / 2) * fs * 1.15));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  const m = new THREE.MeshBasicMaterial({ map: t, toneMapped: false }); m.color.setScalar(o.gain || 1.5);
  return m;
}

export function buildCity(quality = 'high') {
  const R = rng(20261117); const hi = quality !== 'low';
  const group = new THREE.Group(); const B = new Boxes(R), L = new Lights(); const trees = []; const lines = [];
  const planes = [];   // billboards and signs: {mat, w, h, pos, ry}
  const reserved = new Set(); const reserve = (c0, c1, r0, r1) => { for (let c = c0; c <= c1; c++) for (let r = r0; r <= r1; r++) reserved.add(c + ',' + r); };
  const inPark = (c, r) => c >= PARK.c0 && c <= PARK.c1 && r >= PARK.r0 && r <= PARK.r1;

  const gauss = (t, x, tc, xc, st, sx) => Math.exp(-((t - tc) ** 2) / (2 * st * st) - ((x - xc) ** 2) / (2 * sx * sx));
  const density = (x, z) => { const t = tOfZ(z);
    return Math.min(1, gauss(t, x, 0.058, -120, 0.030, 520) + gauss(t, x, 0.455, -80, 0.060, 640) + 0.8 * gauss(t, x, 0.372, -1150, 0.022, 230) + 0.3 * gauss(t, x, 0.30, 0, 0.05, 900)); };
  const resiAt = (x, z) => { const t = tOfZ(z); if (t < 0.52 || t > 0.83) return t > 0.83 ? 0.12 : 0;
    const dx = Math.min(Math.abs(x - PARK.x0), Math.abs(x - PARK.x1)); return dx < 260 ? 1 : 0.45; };

  function roofKit(x, y, z, w, d, style, tall) {
    if (!hi) { if (tall && y > 150) L.add(x, y + 4, z, RED, 5, { blink: 0.5, kind: 1, i: 2.2 }); return; }
    if (!tall) {
      if (R() < 0.42) B.add(x + (R() - .5) * w * 0.45, y, z + (R() - .5) * d * 0.45, 4.2, 6.5, 4.2, 5, { taper: 0.86 });
      if (R() < 0.55) B.add(x + (R() - .5) * w * 0.4, y, z + (R() - .5) * d * 0.4, 5 + R() * 4, 3, 4 + R() * 3, 5);
    } else {
      const mh = 4 + R() * 6; B.add(x, y, z, w * (0.3 + R() * 0.25), mh, d * (0.3 + R() * 0.25), 5);
      let top = y + mh;
      if (R() < 0.2) { const ah = 18 + R() * 46; B.add(x, top, z, 1.6, ah, 1.6, 5, { taper: 0.25 }); top += ah; }
      if (y > 140) L.add(x, top + 2, z, RED, 5, { blink: 0.45 + R() * 0.2, kind: 1, i: 2.2 });
    }
  }
  function building(cx, cz, w, d, D, resi) {
    const base = 13 + R() * 22, tallK = Math.pow(D, 1.35) * (70 + 290 * Math.pow(R(), 2.0)), rk = resi * (22 + 75 * Math.pow(R(), 1.8));
    let h = Math.min(base + tallK + rk, Math.min(w, d) * 9 + 26);
    let style; const q = R();
    if (h < 42) style = q < 0.78 ? 0 : 3;
    else if (h < 110) style = resi > 0.3 ? (q < 0.55 ? 3 : 0) : (q < 0.28 ? 0 : q < 0.5 ? 3 : q < 0.82 ? 1 : 2);
    else style = q < 0.46 ? 2 : q < 0.82 ? 1 : 6;
    const seed = R(), lit = 0.55 + R() * 0.9;
    let tw = w, td = d;
    if (h > 85 && style !== 2 && R() < 0.72) {
      const h1 = h * (0.32 + R() * 0.2), h2 = h * (0.68 + R() * 0.15), s2 = 0.72 + R() * 0.14, s3 = s2 * (0.6 + R() * 0.22);
      B.add(cx, 0, cz, w, h1, d, style, { seed, lit }); B.add(cx, h1, cz, w * s2, h2 - h1, d * s2, style, { seed, lit }); B.add(cx, h2, cz, w * s3, h - h2, d * s3, style, { seed, lit });
      tw = w * s3; td = d * s3;
    } else {
      const taper = style === 2 && h > 120 && R() < 0.22 ? 0.8 + R() * 0.12 : 1;
      B.add(cx, 0, cz, w, h, d, style, { seed, lit, taper }); tw = w * taper; td = d * taper;
    }
    roofKit(cx, h, cz, tw, td, style, h > 70);
  }
  function fillBlock(x0, x1, z0, z1) {   // z0 north (smaller), z1 south
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, D = density(cx, cz), resi = resiAt(cx, cz), depth = z1 - z0;
    if (D > 0.3 && R() < 0.22 + 0.45 * D) {
      let x = x0; while (x < x1 - 20) { const w = Math.min(x1 - x, 36 + R() * 52); building(x + w / 2, cz, w - 0.6, depth - 0.6, D, resi); x += w; }
    } else {
      for (const s of [-1, 1]) { let x = x0; while (x < x1 - 9) { const w = Math.min(x1 - x, (13 + R() * 30) * (1 + D * 1.2)); building(x + w / 2, cz + s * depth / 4, w - 0.5, depth / 2 - 0.5, D, resi); x += w; } }
    }
  }

  // ------------------------------------------------ reservations
  reserve(6, 6, 5, 6);            // the Obelisk and its plaza
  reserve(3, 3, 9, 10);           // One WTC
  reserve(5, 5, 46, 47);          // Empire State
  reserve(7, 7, 54, 54);          // Chrysler
  reserve(10, 10, 44, 45);        // Veripres, on First Avenue
  reserve(4, 5, 54, 57);          // Times Square
  reserve(7, 7, 62, 62);          // 432 Park
  reserve(4, 6, 63, 63);          // Billionaires' Row
  reserve(0, 1, 42, 45);          // Hudson Yards
  reserve(5, 5, 28, 29);          // Washington Square
  reserve(1, 2, 104, 106);        // the campus

  // ------------------------------------------------ Manhattan
  for (let j = 0; j < G.NS; j++) for (let i = 0; i < G.NA; i++) {
    if (inPark(i, j) || reserved.has(i + ',' + j)) continue;
    const o = outline((j + 0.5) / G.NS);
    const x0 = Math.max(colX(i) + G.aveW / 2, o.w + 34), x1 = Math.min(colX(i + 1) - G.aveW / 2, o.e - 34);
    if (x1 - x0 < 40) continue;
    fillBlock(x0, x1, rowZ(j + 1) + G.stW / 2, rowZ(j) - G.stW / 2);
  }

  // street lamps
  for (let i = 0; i <= G.NA; i++) for (let z = G.zS; z > G.zS - LEN; z -= 46) {
    const t = tOfZ(z), o = outline(t), x = colX(i), row = Math.floor((G.zS - z) / G.ST);
    if (x < o.w + 12 || x > o.e - 12) continue;
    if (i > PARK.c0 && i <= PARK.c1 && row >= PARK.r0 && row <= PARK.r1) continue;
    const c = R() < 0.3 ? WARM : LED;
    L.add(x - 13, 9.5, z, c, 3.6, { i: 1.9 }); L.add(x + 13, 9.5, z - 23, c, 3.6, { i: 1.9 });
  }
  for (let j = 0; j <= G.NS; j++) { const z = rowZ(j), o = outline(j / G.NS);
    for (let x = o.w + 30; x < o.e - 30; x += 58) {
      if (j > PARK.r0 && j <= PARK.r1 && x > PARK.x0 && x < PARK.x1) continue;
      L.add(x, 9, z + (j % 2 ? 7 : -7), R() < 0.3 ? WARM : LED, 3.2, { i: 1.6 });
    } }

  // ------------------------------------------------ landmarks
  { // The Obelisk
    const { x, z } = LM.obelisk;
    B.add(x, 0, z, 104, 7, 104, 5); B.add(x, 7, z, 72, 5, 72, 5);
    B.add(x, 12, z, 60, 464, 60, 4, { taper: 0.68, edge: 1, lit: 0.5, seed: 0.37 });
    B.add(x, 476, z, 40.8, 84, 40.8, 4, { taper: 0.0, edge: 1, lit: 0, seed: 0.37 });
    L.add(x, 562, z, BLUE, 22, { kind: 1, i: 5 }); L.add(x, 562, z, [1, 1, 1], 9, { kind: 1, i: 3 });
    for (let k = 0; k < 28; k++) { const a = k / 28 * Math.PI * 2; L.add(x + Math.cos(a) * 62, 4, z + Math.sin(a) * 62, LED, 4, { i: 1.4, kind: 1 }); }
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) L.add(x + dx * 34, 14, z + dz * 34, BLUE, 9, { kind: 1, i: 2.2 });
  }
  { // One WTC: a cube, then eight triangles
    const { x, z } = LM.wtc, s = 30.5, y1 = 361;
    B.add(x, 0, z, 61, 56, 61, 2, { lit: 0.25 });
    const b = [[s, s], [-s, s], [-s, -s], [s, -s]], t = [[0, s], [-s, 0], [0, -s], [s, 0]]; const v = [];
    const tri = (a, bb, c) => { const ab = new THREE.Vector3().subVectors(bb, a), ac = new THREE.Vector3().subVectors(c, a); const n = ab.cross(ac);
      const cen = new THREE.Vector3().add(a).add(bb).add(c).multiplyScalar(1 / 3); if (n.x * cen.x + n.z * cen.z < 0 && Math.abs(n.y) < Math.abs(n.x) + Math.abs(n.z)) [bb, c] = [c, bb]; v.push(a, bb, c); };
    for (let k = 0; k < 4; k++) { const k1 = (k + 1) % 4; const P = (q, y) => new THREE.Vector3(q[0], y, q[1]);
      tri(P(b[k], 0), P(b[k1], 0), P(t[k], y1)); tri(P(t[k], y1), P(b[k1], 0), P(t[k1], y1)); }
    const P = (q) => new THREE.Vector3(q[0], y1, q[1]); v.push(P(t[0]), P(t[3]), P(t[2]), P(t[0]), P(t[2]), P(t[1]));
    const g = new THREE.BufferGeometry().setFromPoints(v); g.computeVertexNormals();
    const m = new THREE.Mesh(bake(g, [61, y1, 61], 2, { seed: 0.21, lit: 0.9 }), facadeMaterial(false)); m.position.set(x, 56, z); m.frustumCulled = false; group.add(m);
    B.add(x, 417, z, 26, 6, 26, 5); B.add(x, 423, z, 5, 118, 5, 5, { taper: 0.15 });
    L.add(x, 543, z, [1, 1, 1], 9, { blink: 0.4, kind: 1, i: 3 });
    for (let k = 0; k < 4; k++) L.add(x + t[k][0], 419, z + t[k][1], COOL, 6, { kind: 1, i: 1.6 });
  }
  { // Empire State, lit in the one accent
    const { x, z } = LM.esb; const o = { seed: 0.62, lit: 0.55 };
    B.add(x, 0, z, 128, 26, 60, 6, o); B.add(x, 26, z, 100, 66, 52, 6, o); B.add(x, 92, z, 80, 158, 46, 6, o);
    B.add(x, 250, z, 60, 70, 40, 6, { ...o, flood: 0.5, hue: 1 }); B.add(x, 320, z, 40, 45, 32, 6, { ...o, flood: 1.3, hue: 1 });
    B.add(x, 365, z, 22, 16, 22, 8, { taper: 0.85, flood: 1.8, hue: 1 }); B.add(x, 381, z, 12, 29, 12, 8, { taper: 0.6, flood: 2.2, hue: 1 });
    B.add(x, 410, z, 3, 33, 3, 5, { taper: 0.2 }); L.add(x, 444, z, RED, 6, { blink: 0.5, kind: 1, i: 2.5 });
  }
  { // Chrysler
    const { x, z } = LM.chrysler; const o = { seed: 0.44, lit: 0.6 };
    B.add(x, 0, z, 64, 58, 58, 6, o); B.add(x, 58, z, 38, 178, 38, 6, o);
    let y = 236; for (const s of [33, 28, 23, 18, 13, 8.5]) { B.add(x, y, z, s, 9.5, s, 7, { taper: 0.74 }); y += 9; }
    B.add(x, y, z, 3.2, 29, 3.2, 7, { taper: 0.1 });
  }
  { // Veripres: a bright, legible building on hospital row
    const { x, z } = LM.veripres;
    B.add(x, 0, z, 150, 24, 60, 1, { lit: 2.2, seed: 0.11 }); B.add(x, 24, z, 72, 126, 44, 3, { lit: 2.3, seed: 0.03, edge: 0.7 });
    B.add(x, 150, z, 40, 7, 26, 5);
    planes.push({ mat: sign('Veripres', { bg: '#07111f', fg: '#ffffff', gain: 2.2 }), w: 60, h: 15, pos: [x + 36.4, 132, z], ry: Math.PI / 2 });
    planes.push({ mat: sign('Veripres', { bg: '#07111f', fg: '#ffffff', gain: 2.2 }), w: 60, h: 15, pos: [x, 132, z + 22.4], ry: 0 });
  }
  { // Times Square: the canyon on the avenue at x = -230
    const ax = LM.times.x; const words = [
      ['OBELISK', { bg: '#000', fg: '#fff', track: '0.2em', fs: 120 }], ['SLEIGHT\nOF HAND', { bg: '#7a0d12', fg: '#ffe9c4', fs: 96, border: 1 }],
      ['Veripres', { bg: '#0b2a6f', fg: '#fff', fs: 140 }], ['SAGE', { bg: '#f4f5f6', fg: '#000', track: '0.35em', fs: 150 }],
      ['♠  ♥  ♣  ♦', { bg: '#f4f5f6', fg: '#b3261e', fs: 150 }], ['NOW SHOWING', { bg: '#111', fg: '#ffd27a', track: '0.3em', fs: 84, border: 1 }],
      ['e4  e5  Nf3', { bg: '#0c0c0c', fg: '#e8e8e8', fs: 110, font: '"IBM Plex Mono", monospace' }], ['200 KG', { bg: '#1d4ed8', fg: '#fff', fs: 150, weight: 600, font: 'Inter, sans-serif' }],
      ['24 fps', { bg: '#000', fg: '#fff', fs: 130, font: '"IBM Plex Mono", monospace' }], ['K  G', { bg: '#000', fg: '#fff', fs: 170 }],
    ]; let wi = 0;
    const next = (gain) => { const [txt, o] = words[wi++ % words.length]; return sign(txt, { ...o, gain }); };
    for (let r = 54; r <= 57; r++) for (const side of [-1, 1]) {
      const z0 = rowZ(r + 1) + G.stW / 2, z1 = rowZ(r) - G.stW / 2, cz = (z0 + z1) / 2;
      const face = ax + side * 16, w = 64 + R() * 20, h = 70 + R() * 130, cx = face + side * w / 2;
      B.add(cx, 0, cz, w, h, 61, R() < 0.5 ? 1 : 2, { lit: 1.5 }); roofKit(cx, h, cz, w, 61, 1, true);
      const fx0 = side < 0 ? colX(4) + 16 : face + w + 0.6, fx1 = side < 0 ? face - w - 0.6 : colX(6) - 16;
      if (fx1 - fx0 > 40) fillBlock(fx0, fx1, z0, z1);
      // each corner carries a board turned toward the south, where the camera stands
      const bw = 26 + R() * 8, bh = 15 + R() * 10, by = 9 + R() * 7, ry = side < 0 ? Math.PI * 0.3 : -Math.PI * 0.3;
      planes.push({ mat: next(2.6), w: bw, h: bh, pos: [face - side * bw * 0.4, by + bh / 2, cz + 18], ry });
      if (h > 80) { const b2 = 18 + R() * 8; planes.push({ mat: next(2.2), w: b2, h: b2 * 0.6, pos: [face - side * b2 * 0.4, by + bh + 6 + b2 * 0.3, cz - 12], ry }); }
    }
    // and the slim tower that closes the square, dressed top to bottom
    { const tz = rowZ(57) - 4; B.add(ax, 0, tz, 27, 118, 16, 5); let y = 7;
      for (const bh of [20, 15, 22, 14, 18, 13]) { planes.push({ mat: next(3.0), w: 25, h: bh, pos: [ax, y + bh / 2, tz + 8.3], ry: 0 }); y += bh + 1.5; }
      L.add(ax, 124, tz, RED, 5, { blink: 0.5, kind: 1, i: 2.2 });
      for (let k = 0; k < 40; k++) L.add(ax + (R() - .5) * 30, 2.5 + R() * 5, tz + 30 + R() * 200, k % 3 ? LED : WARM, 2.6, { kind: 1, i: 1.6 }); }
  }
  { // 432 Park and Billionaires' Row
    B.add(LM.park432.x, 0, LM.park432.z, 28, 426, 28, 3, { seed: 0.97, lit: 0.55 }); L.add(LM.park432.x, 430, LM.park432.z, RED, 5, { blink: 0.5, kind: 1, i: 2.2 });
    const z = rowZ(63) - 40;
    B.add(-345, 0, z, 42, 300, 42, 2, { lit: 0.6 }); B.add(-345, 300, z, 36, 90, 36, 2, { lit: 0.6 }); B.add(-345, 390, z, 27, 82, 27, 2, { lit: 0.5 }); L.add(-345, 476, z, RED, 5, { blink: 0.5, kind: 1, i: 2.2 });
    let y = 0; for (const [h, d] of [[250, 24], [60, 20], [50, 16], [45, 11], [30, 6]]) { B.add(-115, y, z, 18, h, d, 6, { seed: 0.7, lit: 0.6 }); y += h; }
    B.add(115, 0, z, 44, 310, 44, 2, { taper: 0.9, lit: 0.6 }); L.add(115, 314, z, RED, 5, { blink: 0.5, kind: 1, i: 2.2 });
  }
  for (const [x, z, w, h, tp] of [[-1265, 1400, 55, 387, 0.78], [-1150, 1290, 50, 300, 0.85], [-1040, 1400, 48, 262, 1], [-1265, 1195, 50, 270, 0.9], [-1045, 1180, 46, 222, 1]]) {
    B.add(x, 0, z, w + 26, 20, w + 18, 1, { lit: 1.6 }); B.add(x, 20, z, w, h - 20, w, 2, { taper: tp, lit: 0.8 }); L.add(x, h + 3, z, RED, 5, { blink: 0.5, kind: 1, i: 2.2 });
  }
  { // Washington Square: the arch, the fountain, the trees
    const { x, z } = LM.wsp;
    for (const s of [-1, 1]) B.add(x + s * 7.2, 0, z - 66, 5, 15.5, 6, 8, { flood: 1.5 });
    B.add(x, 15.5, z - 66, 19.4, 8, 6, 8, { flood: 1.5 });
    for (let k = 0; k < 20; k++) { const a = k / 20 * Math.PI * 2; L.add(x + Math.cos(a) * 13, 3.5, z + 8 + Math.sin(a) * 13, COOL, 3.4, { kind: 1, i: 1.5 }); }
    for (let k = 0; k < 44; k++) { const a = Math.floor(k / 11) * Math.PI / 2 + Math.PI / 4, d = 20 + (k % 11) * 8; L.add(x + Math.cos(a) * d, 5, z + 8 + Math.sin(a) * d * 0.72, WARM, 3.6, { i: 1.3 }); }
    for (let k = 0; k < 70; k++) { const tx = x + (R() - .5) * 190, tz = z + (R() - .5) * 132; if (Math.hypot(tx - x, tz - z - 8) > 20) trees.push(tx, 2.5, tz, 5 + R() * 3.5); }
  }
  { // the campus: a domed library on a quad
    const { x, z } = LM.campus;
    B.add(x, 0, z - 50, 58, 17, 58, 8, { flood: 0.95 }); B.add(x, 17, z - 50, 36, 7, 36, 8, { flood: 0.8 });
    const dome = new THREE.SphereGeometry(17.5, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2);
    const dm = new THREE.Mesh(bake(dome, [35, 17.5, 35], 8, { flood: 0.7 }), facadeMaterial(false)); dm.position.set(x, 24, z - 50); dm.frustumCulled = false; group.add(dm);
    for (let k = 0; k < 10; k++) B.add(x - 22.5 + k * 5, 3, z - 19.5, 1.7, 14, 1.7, 8, { flood: 1.5 });
    B.add(x, 0, z - 14, 86, 3, 16, 8, { flood: 0.5 });
    for (const [dx, dz, w, d] of [[-160, 40, 62, 24], [160, 40, 62, 24], [-160, -60, 24, 70], [160, -60, 24, 70], [0, 96, 170, 20]]) B.add(x + dx, 0, z + dz, w, 24 + R() * 6, d, 0, { lit: 1.4 });
    for (let a = -3; a <= 3; a++) for (let b = 0; b < 5; b++) L.add(x + a * 30, 5, z + b * 18 - 4, WARM, 3.6, { i: 1.3 });
    for (let k = 0; k < 60; k++) { const tx = x + (R() - .5) * 400, tz = z + (R() - .5) * 200; if (Math.abs(tx - x) > 55 || tz > z + 20) trees.push(tx, 2.5, tz, 5 + R() * 3); }
  }

  // ------------------------------------------------ bridges
  function bridge({ z, xa, x1, x2, xb, deckY = 41, towerH = 84, stone = false, flood = 0.6, hue = 0, cable = COOL, inland = 0, dir = 1 }) {
    const a0 = dir > 0 ? xa - inland : xa, b0 = dir > 0 ? xb : xb + inland;
    B.add((a0 + b0) / 2, deckY - 3, z, b0 - a0, 3, 20, 5);
    for (const xt of [xa, xb]) B.add(xt, 0, z, 44, deckY - 3, 26, 8, { flood: 0.25 });
    for (const xt of [x1, x2]) {
      if (stone) { for (const dz of [-13.5, 0, 13.5]) B.add(xt, 0, z + dz, 13, towerH * 0.76, 7.5, 8, { flood }); B.add(xt, towerH * 0.76, z, 13, towerH * 0.24, 34.5, 8, { flood }); }
      else { for (const dz of [-12.5, 12.5]) B.add(xt, 0, z + dz, 9, towerH, 5, 5, { flood, hue }); B.add(xt, towerH - 9, z, 8, 9, 25, 5, { flood, hue }); B.add(xt, towerH * 0.55, z, 7, 5, 25, 5, { flood, hue }); }
      L.add(xt, towerH + 3, z, RED, 5, { blink: 0.5, kind: 1, i: 2 });
    }
    const low = deckY + 5, mid = (x1 + x2) / 2, half = (x2 - x1) / 2;
    const cy = (x) => x < x1 ? deckY + (towerH - deckY) * Math.pow((x - xa) / (x1 - xa), 2) : x > x2 ? deckY + (towerH - deckY) * Math.pow((xb - x) / (xb - x2), 2) : low + (towerH - low) * Math.pow((x - mid) / half, 2);
    for (const s of [-11, 11]) { let px = xa, py = cy(xa);
      for (let x = xa + 12; x <= xb; x += 12) { const y = cy(x); lines.push(px, py, z + s, x, y, z + s, x, y, z + s, x, deckY, z + s); L.add(x, y + 0.6, z + s, cable, 2.0, { kind: 1, i: 1.2 }); px = x; py = y; } }
    for (let x = a0; x <= b0; x += 34) for (const s of [-9.5, 9.5]) L.add(x, deckY + 7, z + s, WARM, 4.4, { i: 1.4 });
  }
  bridge({ z: LM.bbridge.z, xa: LM.bbridge.xa, x1: LM.bbridge.x1, x2: LM.bbridge.x2, xb: LM.bbridge.xb, stone: true, flood: 0.62, inland: 230 });
  bridge({ z: rowZ(18), xa: 1345, x1: 1560, x2: 2020, xb: 2262, towerH: 98, flood: 0.9, hue: 0.55, cable: BLUE, inland: 230 });
  bridge({ z: rowZ(27), xa: 1392, x1: 1620, x2: 2060, xb: 2285, towerH: 95, flood: 0.5, inland: 230 });
  bridge({ z: rowZ(112), xa: -2662, x1: -2400, x2: -1520, xb: -1250, towerH: 182, deckY: 62, flood: 0.8, inland: 160, dir: -1 });

  // ------------------------------------------------ the far banks
  const outerLot = (x, z, D) => { const w = 50 + R() * 130, d = 40 + R() * 45; let h = 8 + R() * 18 + Math.pow(D, 1.3) * (60 + 190 * R() * R());
    const st = h > 100 ? (R() < 0.6 ? 2 : 1) : h > 40 ? (R() < 0.5 ? 3 : 1) : (R() < 0.75 ? 0 : 3);
    B.add(x, 0, z, w, h, d, st, { lit: 0.5 + R() * 0.8 }); if (h > 150) L.add(x, h + 3, z, RED, 5, { blink: 0.5, kind: 1, i: 2 }); };
  const step = hi ? 1 : 2;
  for (let z = 7000; z > -5600; z -= 100 * step) {
    const eb = shoreE(z), wb = shoreW(z), t = tOfZ(z);
    for (let x = eb + 115; x < 5400; x += 240 * step) { if (R() < 0.16) continue;
      const D = Math.min(1, gauss(t, x, 0.155, 2900, 0.03, 330) + 0.9 * gauss(t, x, 0.47, 2480, 0.028, 260));
      outerLot(x + R() * 60, z + (R() - .5) * 30, D); if (hi && R() < 0.6) outerLot(x + 110 + R() * 50, z + (R() - .5) * 30, D); }
    for (let x = wb - 115; x > -5200; x -= 240 * step) { if (R() < 0.22) continue;
      const D = Math.min(1, gauss(t, x, 0.075, -3050, 0.032, 340));
      outerLot(x - R() * 60, z + (R() - .5) * 30, D); if (hi && R() < 0.45) outerLot(x - 110 - R() * 50, z + (R() - .5) * 30, D); }
  }
  // the sprawl: nothing but light, out to the haze
  const nSprawl = hi ? 26000 : 9000;
  for (let k = 0; k < nSprawl; k++) {
    const z = 13000 - R() * 30000, side = R() < 0.6 ? 1 : -1; const edge = side > 0 ? shoreE(z) : shoreW(z);
    const x = edge + side * (40 + Math.pow(R(), 1.7) * 13000);
    L.add(x, 8 + R() * 14, z, R() < 0.55 ? WARM : LED, 6 + R() * 5, { i: 0.75 + R() * 0.8 });
  }

  // ------------------------------------------------ Liberty, Governors Island, boats
  { const { x, z } = LM.liberty;
    B.add(x, 0, z, 60, 10, 60, 8, { flood: 0.6 }); B.add(x, 10, z, 20, 37, 20, 8, { taper: 0.82, flood: 1.4 });
    B.add(x, 47, z, 9, 30, 8, 9, { taper: 0.6, flood: 1.6 }); B.add(x, 77, z, 3.4, 4.2, 3.4, 9, { flood: 1.5 }); B.add(x + 2.6, 74, z, 1.5, 14, 1.5, 9, { flood: 1.5 });
    L.add(x + 2.6, 90, z, [1.0, 0.78, 0.3], 8, { kind: 1, i: 3 }); }
  for (let k = 0; k < 16; k++) { const west = k % 2 === 0; const z = 6500 - R() * 9500;
    const x = west ? -1700 - R() * 600 : (z > 4900 ? -700 + R() * 1800 : shoreE(z) - 220 - R() * 300); const v = (R() < 0.5 ? -1 : 1) * (0.8 + R() * 1.2);
    L.add(x, 6, z, [1, 1, 0.9], 5, { kind: 2, vel: [0, 0, v], i: 1.6 }); L.add(x, 3.5, z + 9, v > 0 ? RED : [0.1, 1, 0.3], 3.6, { kind: 2, vel: [0, 0, v], i: 1.4 }); }

  // ------------------------------------------------ Central Park
  const inRes = (x, z, m = 0) => ((x - RES.x) / (RES.rx + m)) ** 2 + ((z - RES.z) / (RES.rz + m)) ** 2 < 1;
  const lawns = [[-150, -820, 150, 110], [-90, -1340, 130, 150], [-60, -2560, 140, 100]];
  const nT = hi ? 2700 : 1100;
  for (let k = 0; k < nT; k++) { const x = PARK.x0 + 8 + R() * (PARK.x1 - PARK.x0 - 16), z = PARK.zN + 8 + R() * (PARK.zS - PARK.zN - 16);
    if (inRes(x, z, 26) || lawns.some(([lx, lz, rx, rz]) => ((x - lx) / rx) ** 2 + ((z - lz) / rz) ** 2 < 1)) continue; trees.push(x, 2.5, z, 5.5 + R() * 4.5); }
  for (let a = 0; a < Math.PI * 2; a += 0.034) L.add(RES.x + Math.cos(a) * (RES.rx + 12), 6, RES.z + Math.sin(a) * (RES.rz + 12), LED, 3.6, { i: 1.15 });
  for (let k = 0; k < 5; k++) { const ph = R() * 6, amp = 60 + R() * 120, xc = PARK.x0 + 90 + k * 120;
    for (let z = PARK.zN + 20; z < PARK.zS - 20; z += 34) { const x = xc + Math.sin(z / 260 + ph) * amp; if (x > PARK.x0 + 10 && x < PARK.x1 - 10 && !inRes(x, z, 8)) L.add(x, 5, z, WARM, 3.6, { i: 1.2 }); } }
  for (let k = 0; k < (hi ? 420 : 0); k++) { const t = 0.3 + R() * 0.6, z = zOfT(t), x = outline(t).w + 14 + R() * 16; trees.push(x, 2.5, z, 5 + R() * 3); }
  for (let k = 0; k < 60; k++) trees.push(-150 + R() * 260, 2.5, 4760 + R() * 110, 5 + R() * 3);

  // ------------------------------------------------ land
  const park = [PARK.x0, PARK.x1, PARK.zN, PARK.zS];
  { const sh = new THREE.Shape(); const N = 90; const pts = [];
    for (let k = 0; k <= N; k++) { const t = k / N; pts.push([outline(t).e, zOfT(t)]); }
    pts.push([-760, zOfT(1) - 90]);
    for (let k = N; k >= 0; k--) { const t = k / N; pts.push([outline(t).w, zOfT(t)]); }
    pts.push([-150, G.zS + 120]); pts.push([60, G.zS + 100]);
    pts.forEach(([x, z], i) => i ? sh.lineTo(x, -z) : sh.moveTo(x, -z));
    const hole = new THREE.Path(); hole.absellipse(RES.x, -RES.z, RES.rx, RES.rz, 0, Math.PI * 2, true); sh.holes.push(hole);
    const g = new THREE.ExtrudeGeometry(sh, { depth: 2.5, bevelEnabled: false, curveSegments: 48 }); g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, groundMaterial({ grid: [G.x0, G.AV, G.zS, G.ST], park })); m.frustumCulled = false; group.add(m);
  }
  const far = 34000; const outer = groundMaterial({ grid: [40, 240, 50, 100], dim: 0.5, cars: 0 });
  const flat = (pts) => { const sh = new THREE.Shape(); pts.forEach(([x, z], i) => i ? sh.lineTo(x, -z) : sh.moveTo(x, -z));
    const g = new THREE.ShapeGeometry(sh); g.rotateX(-Math.PI / 2); g.translate(0, 2.5, 0); const m = new THREE.Mesh(g, outer); m.frustumCulled = false; group.add(m); };
  { const e = [], w = []; for (let z = far; z >= -far; z -= 150) { e.push([shoreE(z), z]); w.push([shoreW(z), z]); }
    flat([...e, [far, -far], [far, far]]); flat([...w, [-far, -far], [-far, far]]);
    flat([[-far, 13500], [1300, 13500], [1300, far], [-far, far]]); }
  { const g = new THREE.CircleGeometry(100, 40); g.rotateX(-Math.PI / 2); g.translate(LM.liberty.x, 2.5, LM.liberty.z); const m = new THREE.Mesh(g, outer); group.add(m);
    const g2 = new THREE.CircleGeometry(1, 48); g2.rotateX(-Math.PI / 2); g2.scale(390, 1, 300); g2.translate(820, 2.5, 5760); group.add(new THREE.Mesh(g2, outer));
    for (let k = 0; k < 170; k++) { const a = R() * 6.283, d = Math.sqrt(R()); trees.push(820 + Math.cos(a) * d * 360, 2.5, 5760 + Math.sin(a) * d * 270, 5 + R() * 4); }
    for (let k = 0; k < 34; k++) { const a = k / 34 * 6.283; L.add(820 + Math.cos(a) * 372, 6, 5760 + Math.sin(a) * 284, WARM, 4, { i: 1.1 }); }
    for (let k = 0; k < 9; k++) B.add(700 + R() * 240, 0, 5660 + R() * 200, 40 + R() * 40, 10 + R() * 8, 16, 0, { lit: 0.7 }); }

  // ------------------------------------------------ assemble
  const city = B.mesh(); group.add(city);
  group.add(L.mesh());
  { const ico = new THREE.IcosahedronGeometry(1, hi ? 1 : 0); const g = new THREE.InstancedBufferGeometry();
    g.index = ico.index; g.setAttribute('position', ico.attributes.position); g.setAttribute('normal', ico.attributes.normal);
    g.setAttribute('aT', new THREE.InstancedBufferAttribute(new Float32Array(trees), 4)); g.instanceCount = trees.length / 4;
    const m = new THREE.Mesh(g, treeMaterial()); m.frustumCulled = false; group.add(m); }
  { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(lines), 3));
    group.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x23262b, transparent: true, opacity: 0.8 }))); }
  for (const p of planes) { const m = new THREE.Mesh(new THREE.PlaneGeometry(p.w, p.h), p.mat); m.position.set(...p.pos); m.rotation.y = p.ry; group.add(m); }

  return { group, stats: { boxes: B.n, lights: L.p.length / 3, trees: trees.length / 4 } };
}
