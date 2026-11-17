// Every surface in the city is drawn by one of the shaders in this file.
// They share one atmosphere, so sky, haze, water and buildings always agree.
import * as THREE from 'three';

export const U = {
  uTime:     { value: 0 },
  uSunDir:   { value: new THREE.Vector3(0.4, 0.5, 0.5).normalize() },
  uSunCol:   { value: new THREE.Color() },
  uSkyAmb:   { value: new THREE.Color() },
  uGroundAmb:{ value: new THREE.Color() },
  uZenith:   { value: new THREE.Color() },
  uHorizon:  { value: new THREE.Color() },
  uGlow:     { value: new THREE.Color() },
  uSunGlow:  { value: new THREE.Color() },
  uStreet:   { value: new THREE.Color() },
  uAccent:   { value: new THREE.Color(0x1d4ed8) },
  uFogDen:   { value: 0.00016 },
  uFogH:     { value: 420 },
  uLitOffice:{ value: 0.5 },
  uLitResi:  { value: 0.4 },
  uStars:    { value: 0.5 },
  uLamp:     { value: 1 },
  uDisc:     { value: 1 },
  uPx:       { value: 1000 },
};

const COMMON = /* glsl */`
uniform float uTime, uFogDen, uFogH, uLitOffice, uLitResi, uStars, uLamp, uDisc, uPx;
uniform vec3 uSunDir, uSunCol, uSkyAmb, uGroundAmb, uZenith, uHorizon, uGlow, uSunGlow, uStreet, uAccent;

float hash11(float p){ p = fract(p * .1031); p *= p + 33.33; p *= p + p; return fract(p); }
float hash21(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
  return mix(mix(hash21(i), hash21(i+vec2(1,0)), f.x), mix(hash21(i+vec2(0,1)), hash21(i+vec2(1,1)), f.x), f.y); }
float fbm(vec2 p){ float a = .5, s = 0.; for (int i = 0; i < 4; i++){ s += a * vnoise(p); p = p * 2.03 + 17.; a *= .5; } return s; }

vec3 skyBase(vec3 d){
  float h = max(d.y, 0.0);
  vec3 c = mix(uHorizon, uZenith, pow(h, 0.42));
  c += uGlow * exp(-h * 7.0);
  float sd = max(dot(normalize(vec3(d.x, h, d.z)), normalize(vec3(uSunDir.x, max(uSunDir.y, 0.0), uSunDir.z))), 0.0);
  c += uSunGlow * (pow(sd, 5.0) * 0.55 + pow(sd, 40.0) * 0.9) * exp(-h * 3.0);
  return c;
}
float fogAmount(vec3 wp){
  vec3 dv = wp - cameraPosition; float dist = length(dv);
  float y0 = max(cameraPosition.y, 0.0), y1 = max(wp.y, 0.0);
  float dy = (y1 - y0) / uFogH;
  float e0 = exp(-y0 / uFogH), e1 = exp(-y1 / uFogH);
  float avg = abs(dy) > 1e-3 ? (e0 - e1) / dy : e0;
  return 1.0 - exp(-uFogDen * dist * max(avg, 0.0));
}
vec3 applyFog(vec3 col, vec3 wp){
  vec3 dir = normalize(wp - cameraPosition);
  vec3 fc = skyBase(normalize(vec3(dir.x, 0.015, dir.z)));
  return mix(col, fc, fogAmount(wp));
}
`;

// ---------------------------------------------------------------- facades
const FACADE_VERT = /* glsl */`
attribute vec3 aPos; attribute vec3 aSize; attribute vec4 aMisc; attribute vec4 aFx;
uniform float uUnit;
varying vec3 vLocal, vWorld, vN, vGN, vSize; varying vec4 vMisc, vFx;
void main(){
  vec3 local, world, n, gn;
  if (uUnit > 0.5) {
    float tp = mix(1.0, aMisc.z, position.y);
    local = vec3(position.x * aSize.x * tp, position.y * aSize.y, position.z * aSize.z * tp);
    world = aPos + local;
    float slope = (1.0 - aMisc.z) * 0.5 * (abs(normal.x) * aSize.x + abs(normal.z) * aSize.z) / max(aSize.y, 0.001);
    n = normalize(vec3(normal.x, normal.y + slope * (1.0 - abs(normal.y)), normal.z));
    gn = normal;
  } else {
    local = position;
    world = (modelMatrix * vec4(position, 1.0)).xyz;
    n = normalize(mat3(modelMatrix) * normal);
    gn = n;
  }
  vLocal = local; vWorld = world; vN = n; vGN = gn; vSize = aSize; vMisc = aMisc; vFx = aFx;
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
}`;

const FACADE_FRAG = /* glsl */`
${COMMON}
varying vec3 vLocal, vWorld, vN, vGN, vSize; varying vec4 vMisc, vFx;
void main(){
  float seed = vMisc.x; int st = int(vMisc.y + 0.5);
  vec3 N = normalize(vN), GN = normalize(vGN);
  vec3 V = normalize(cameraPosition - vWorld);
  float roof = step(0.7, GN.y);
  float H = max(vSize.y, 0.01), y = vLocal.y;
  vec2 tg = normalize(vec2(-GN.z, GN.x) + vec2(1e-4, 0.0));
  float u = dot(vLocal.xz, tg);
  float faceW = max(abs(tg.x) * vSize.x + abs(tg.y) * vSize.z, 0.01);
  float faceId = (abs(GN.x) + abs(GN.z)) > 1e-3 ? floor(atan(GN.z, GN.x) * 0.63662 + 2.5) : 0.0;
  float sd = seed * 97.0 + faceId * 13.0;

  float fh = 3.4, bw = 3.0; vec2 w0 = vec2(.26,.22), w1 = vec2(.74,.78);
  vec3 alb = vec3(.2); float office = 0.0, hasWin = 1.0, glassy = 0.0;
  if (st == 0) { fh = 3.3; bw = 2.4 + seed * 1.3; w0 = vec2(.27,.24); w1 = vec2(.73,.80);
    float k = fract(seed * 7.31);
    alb = k < .30 ? vec3(.21,.105,.075) : k < .55 ? vec3(.33,.26,.19) : k < .72 ? vec3(.17,.13,.11) : k < .9 ? vec3(.40,.37,.32) : vec3(.46,.45,.43);
  } else if (st == 1) { fh = 3.9; bw = 1.5 + seed; w0 = vec2(.06,.36); w1 = vec2(.94,.92); office = 1.0;
    alb = mix(vec3(.09,.095,.10), vec3(.24,.21,.17), fract(seed * 5.7));
  } else if (st == 2) { fh = 4.0; bw = 1.7; w0 = vec2(.04,.05); w1 = vec2(.96,.95); office = 1.0; glassy = 1.0; alb = vec3(.035,.04,.05);
  } else if (st == 3) { fh = 3.0; bw = 3.0 + seed * 1.6; w0 = vec2(.16,.26); w1 = vec2(.84,.82);
    alb = fract(seed * 3.3) < .5 ? vec3(.41,.39,.36) : vec3(.27,.20,.16);
  } else if (st == 4) { fh = 4.2; bw = 2.1; w0 = vec2(.06,.08); w1 = vec2(.94,.92); office = 1.0; glassy = 1.0; alb = vec3(.010,.011,.013);
  } else if (st == 5) { hasWin = 0.0; alb = vec3(.06,.062,.068);
  } else if (st == 6) { fh = 3.6; bw = 2.5; w0 = vec2(.30,.10); w1 = vec2(.70,.90); office = 1.0; alb = vec3(.43,.40,.35);
  } else if (st == 7) { hasWin = 0.0; alb = vec3(.50,.50,.52);
  } else if (st == 8) { hasWin = 0.0; alb = vec3(.40,.35,.29) * (0.72 + 0.4 * hash21(floor(vec2(u / 2.2 + floor(y / 1.1) * 0.5, y / 1.1)) + seed));
  } else if (st == 9) { hasWin = 0.0; alb = vec3(.20,.40,.34);
  } else { hasWin = 0.0; alb = vec3(.05); }
  if (st >= 7 && st <= 9) roof = 0.0;
  alb *= 0.82 + 0.36 * vnoise(vec2(u * 0.11, y * 0.11) + seed * 40.0);

  // window grid, anti-aliased, and averaged out once the cells go sub-pixel
  float nb = max(1.0, floor(faceW / bw + 0.5)), cw = faceW / nb;
  vec2 cc = vec2((u + faceW * 0.5) / cw, y / fh);
  vec2 cell = floor(cc), f = fract(cc), fw = fwidth(cc);
  vec2 am = smoothstep(w0 - fw * 0.6, w0 + fw * 0.6, f) * (1.0 - smoothstep(w1 - fw * 0.6, w1 + fw * 0.6, f));
  float lod = clamp(max(fw.x, fw.y) * 2.0 - 0.4, 0.0, 1.0);
  float win = mix(am.x * am.y, (w1.x - w0.x) * (w1.y - w0.y), lod);

  float r = hash21(cell + sd);
  float litP = mix(uLitResi, uLitOffice, office) * vMisc.w;
  float flr = hash21(vec2(cell.y, sd)), run = hash21(vec2(floor(cell.x / 5.0), cell.y) + sd * 1.3);
  float litO = max(step(1.0 - litP * 0.45, r), max(step(1.0 - litP * 0.35, flr) * step(0.25, r), step(1.0 - litP * 0.4, run) * step(0.15, r)));
  float lit = mix(step(1.0 - litP, r), litO, office);
  // a few windows change their mind every half minute or so
  float flick = step(0.985, hash21(cell * 3.1 + sd + floor(uTime * 0.03 + r * 7.0)));
  lit = mix(lit, 1.0 - lit, flick * (1.0 - office) * 0.6);
  lit = mix(lit, clamp(litP * (0.2 + 1.6 * hash21(floor(cell / 3.0) + sd)), 0.0, 1.0), lod);
  // street level: shopfronts and lobbies stay lit
  float shop = step(cell.y, 0.5) * step(vWorld.y - y, 8.0);
  lit = mix(lit, mix(step(0.28, r), 0.72, lod), shop);

  float ct = hash21(cell * 1.7 + sd * 1.31), bct = hash11(seed * 53.7);
  vec3 wOff = mix(vec3(1.0,.78,.50), vec3(.80,.91,1.0), smoothstep(0.55, 0.95, bct));
  wOff = mix(wOff, vec3(.78,1.0,.82), step(0.9, fract(bct * 7.3)) * 0.45);
  vec3 wc = office > 0.5 ? wOff * mix(vec3(1.0), vec3(1.0,.93,.86), ct) : mix(vec3(1.0,.58,.27), vec3(1.0,.80,.54), ct);
  if (office < 0.5 && ct > 0.95) wc = vec3(.42,.58,1.0) * 0.55;
  float inten = 0.4 + 1.3 * hash21(cell + 5.3 + sd);
  inten = mix(inten, 1.5 + 0.6 * r, shop);
  wc = mix(wc, mix(vec3(1.0,.86,.66), vec3(.82,.92,1.0), step(0.6, ct)), shop);
  float blind = hash21(cell + 9.1 + sd * 3.0) * (1.0 - shop);
  float fy = (f.y - w0.y) / (w1.y - w0.y);
  float bl = smoothstep(blind * 0.7, blind * 0.7 + 0.05, 1.0 - fy);
  inten *= mix(mix(0.30, 1.0, bl), 0.72, lod) * (0.85 + 0.3 * fy);
  float fx = (f.x - w0.x) / (w1.x - w0.x), near = 1.0 - smoothstep(0.02, 0.12, max(fw.x, fw.y));
  float mull = smoothstep(0.035, 0.012, abs(fx - 0.5)) * step(0.35, hash21(cell + 2.2 + sd)) * (1.0 - glassy);
  float curt = step(0.62, blind) * smoothstep(0.02, 0.0, abs(fx - 0.5) - 0.5 + 0.22 + 0.2 * hash21(cell + 4.4 + sd));
  inten *= 1.0 - near * (0.75 * mull + 0.45 * curt);
  // a room behind every near window: ceiling, back wall and floor in true parallax
  vec3 it = vec3(-dot(V.xz, tg), -V.y, max(dot(V, GN), 0.06));
  vec2 rs = vec2(cw * (w1.x - w0.x), fh * (w1.y - w0.y));
  float rd = mix(3.6, 7.5, office) * (0.7 + 0.6 * hash21(cell + 6.6 + sd));
  vec2 rp = clamp(vec2(fx, fy), 0.0, 1.0) * rs;
  vec2 dxy = it.xy + mix(vec2(-1e-4), vec2(1e-4), step(0.0, it.xy));
  vec2 tw = (step(0.0, dxy) * rs - rp) / dxy;
  float tz = rd / it.z, tt = min(min(tw.x, tw.y), tz);
  vec3 hp = vec3(rp + dxy * tt, it.z * tt);
  float room = 0.5;
  if (tt >= tz) { vec2 q = hp.xy / rs; room = (0.5 + 0.3 * q.y) * (0.72 + 0.5 * step(0.55, hash21(floor(q * vec2(3.0, 2.0)) + cell * 3.3 + sd))); }
  else if (tt >= tw.y) { room = dxy.y > 0.0 ? 1.2 * (office > 0.5 ? 0.7 + 0.6 * step(0.5, fract(hp.z / 1.5)) : 1.0) : 0.2; }
  room *= 1.0 - 0.4 * clamp(hp.z / rd, 0.0, 1.0);
  inten *= mix(1.0, room * 1.5, near);
  vec3 emis = wc * inten * lit * win * (glassy > 0.5 ? 1.15 : 1.9) * mix(1.0, 0.5, near);

  // unlit glass carries the sky; every pane sits a hair out of true, as real curtain wall does
  vec3 Np = normalize(N + (vec3(tg.x, 0.0, tg.y) * (hash21(cell + 1.1 + sd) - 0.5) + vec3(0.0, 1.0, 0.0) * (hash21(cell + 2.7 + sd) - 0.5)) * 0.07 * (1.0 - lod) * (0.35 + 0.65 * glassy));
  vec3 R = reflect(-V, Np);
  vec3 skyR = skyBase(normalize(vec3(R.x, abs(R.y) * 0.8 + 0.04, R.z)));
  float fres = 0.05 + 0.95 * pow(1.0 - max(dot(Np, V), 0.0), 4.0);
  vec3 glass = skyR * (0.22 + 0.78 * fres) * mix(vec3(.55,.62,.72), vec3(.85,.92,1.0), glassy);
  float sg = max(dot(R, uSunDir), 0.0);
  glass += uSunCol * (pow(sg, 90.0) * 5.0 + pow(sg, 12.0) * 0.5);
  // near the street, dark panes pick up the avenue's own light
  glass += uStreet * (0.05 + 0.4 * fres) * (0.5 + hash21(cell + 8.8 + sd)) * exp(-max(vWorld.y, 0.0) / 60.0) * (1.0 - lod);

  vec3 amb = mix(uGroundAmb, uSkyAmb, N.y * 0.5 + 0.5);
  float occ = 0.25 + 0.75 * smoothstep(-10.0, 90.0, vWorld.y);
  vec3 light = amb * occ + uSunCol * max(dot(N, uSunDir), 0.0) * occ;
  light += uStreet * (exp(-max(vWorld.y, 0.0) / 14.0) * 0.95 + exp(-max(vWorld.y, 0.0) / 70.0) * 0.2) * (1.0 - roof);
  vec3 col = alb * light;
  if (roof > 0.5) col = vec3(.035,.036,.04) * (0.7 + 0.6 * vnoise(vLocal.xz * 0.2 + seed * 9.0)) * (amb + uSunCol * max(uSunDir.y, 0.0)) * 3.0;

  float side = (1.0 - roof) * hasWin;
  if (side > 0.5) { col = mix(col, glass, win); col += emis; }

  // floodlit stone, and the crown of the deco tower
  vec3 floodCol = mix(vec3(1.0,.84,.60), uAccent * 3.2 + 0.04, vFx.y);
  col += alb * floodCol * vFx.x * (0.3 + 0.7 * (1.0 - clamp(y / H, 0.0, 1.0))) * (1.0 - roof) * uLamp;
  if (st == 7) {
    float tri = step(abs(fract(u / 5.0) - 0.5) * 1.6, fract(y / max(H, 1.0) * 1.0) * 0.9);
    col += vec3(1.0,.93,.80) * 2.4 * tri * (1.0 - roof) * uLamp;
  }
  // a hairline of light on the arrises
  if (vFx.z > 0.0) {
    float fwY = faceW * mix(1.0, vMisc.z, clamp(y / H, 0.0, 1.0));
    float e = abs(u) / max(fwY * 0.5, 0.01);
    float px = fwidth(e) * 1.5;
    col += (uAccent * 7.0 + 0.25) * smoothstep(1.0 - max(0.022, px), 1.0, e) * vFx.z * (1.0 - roof);
  }
  gl_FragColor = vec4(applyFog(col, vWorld), 1.0);
}`;

export function facadeMaterial(unit = true) {
  return new THREE.ShaderMaterial({
    uniforms: { ...U, uUnit: { value: unit ? 1 : 0 } },
    vertexShader: FACADE_VERT, fragmentShader: FACADE_FRAG,
  });
}

// ---------------------------------------------------------------- ground
const GROUND_FRAG = /* glsl */`
${COMMON}
uniform vec4 uGrid, uPark; uniform float uDim, uCars;
varying vec3 vWorld;
float cars(float s, float lane, float id, float speed, float dens, float toward, out float red){
  float q = (s - uTime * speed) / 15.0 + hash11(id * 3.7 + lane) * 97.0;
  float c = floor(q), f = fract(q);
  float on = step(1.0 - dens, hash21(vec2(c, id * 13.0 + lane * 3.0)));
  float lod = clamp(fwidth(q) * 1.5 - 0.2, 0.0, 1.0);
  float head = smoothstep(0.46, 0.5, f) * (1.0 - smoothstep(0.5, 0.58, f)) + 0.35 * smoothstep(0.5, 0.56, f) * (1.0 - smoothstep(0.56, 0.98, f));
  float tail = smoothstep(0.16, 0.2, f) * (1.0 - smoothstep(0.2, 0.26, f));
  red = mix(on * tail, dens * 0.09, lod) * (1.0 - toward);
  return mix(on * head, dens * 0.16, lod) * toward;
}
void main(){
  vec2 p = vWorld.xz;
  float gx = (p.x - uGrid.x) / uGrid.y, gz = (uGrid.z - p.y) / uGrid.w;
  float ox = (fract(gx + 0.5) - 0.5) * uGrid.y, oz = (fract(gz + 0.5) - 0.5) * uGrid.w;
  float aveId = floor(gx + 0.5), stId = floor(gz + 0.5);
  float inPark = step(uPark.x, p.x) * step(p.x, uPark.y) * step(uPark.z, p.y) * step(p.y, uPark.w);
  float aveM = (1.0 - smoothstep(14.0, 16.0, abs(ox))) * (1.0 - inPark);
  float stM = (1.0 - smoothstep(7.0, 9.0, abs(oz))) * (1.0 - inPark);
  float road = max(aveM, stM);
  vec3 alb = mix(vec3(.060,.058,.055), vec3(.020,.021,.024), road);
  float pn = fbm(p * 0.012);
  alb = mix(alb, vec3(.010,.026,.011) * (0.5 + pn), inPark);
  vec3 col = alb * (uSkyAmb * 1.2 + uSunCol * max(uSunDir.y, 0.0));

  float lampA = 0.5 + 0.5 * cos(p.y * 6.28318 / 46.0), lampS = 0.5 + 0.5 * cos(p.x * 6.28318 / 58.0);
  float glow = max(exp(-abs(ox) / 20.0) * (0.45 + 0.55 * lampA), exp(-abs(oz) / 12.0) * (0.45 + 0.55 * lampS) * 0.8);
  col += (alb * 4.2 + 0.003) * uStreet * 2.4 * glow * (1.0 - inPark) * uDim;
  // footpaths through the park, faintly lit
  float path = smoothstep(0.035, 0.0, abs(fract(pn * 5.0 + p.y * 0.0006) - 0.5)) * inPark;
  col += vec3(1.0,.8,.55) * 0.012 * path * uLamp;

  if (uCars > 0.5) {
    float lane = floor(abs(ox) / 3.5), lm = exp(-pow((abs(ox) - (lane + 0.5) * 3.5) / 0.95, 2.0)) * step(lane, 2.5) * aveM;
    float hz = ox > 0.0 ? -1.0 : 1.0;                       // east side runs north
    float toward = step(0.0, (cameraPosition.z - p.y) * hz);
    float red; float w = cars(p.y * hz, lane, aveId, 10.0 + 6.0 * hash11(aveId * 7.0 + lane), 0.34, toward, red);
    col += (vec3(1.0,.93,.82) * w * 2.6 + vec3(1.0,.06,.03) * red * 2.2) * lm;
    float lm2 = exp(-pow((abs(oz) - 2.6) / 0.95, 2.0)) * stM * (1.0 - aveM);
    float hx = oz > 0.0 ? 1.0 : -1.0;
    float toward2 = step(0.0, (cameraPosition.x - p.x) * hx);
    float red2; float w2 = cars(p.x * hx, 0.0, stId + 500.0, 7.0 + 4.0 * hash11(stId), 0.16, toward2, red2);
    col += (vec3(1.0,.93,.82) * w2 * 2.4 + vec3(1.0,.06,.03) * red2 * 2.0) * lm2;
  }
  gl_FragColor = vec4(applyFog(col, vWorld), 1.0);
}`;
export function groundMaterial({ grid, park = [1e9, 1e9, 1e9, 1e9], dim = 1, cars = 1 }) {
  return new THREE.ShaderMaterial({
    uniforms: { ...U, uGrid: { value: new THREE.Vector4(...grid) }, uPark: { value: new THREE.Vector4(...park) }, uDim: { value: dim }, uCars: { value: cars } },
    vertexShader: `varying vec3 vWorld; void main(){ vWorld = (modelMatrix * vec4(position,1.0)).xyz; gl_Position = projectionMatrix * viewMatrix * vec4(vWorld,1.0); }`,
    fragmentShader: GROUND_FRAG, side: THREE.DoubleSide,
  });
}

// ---------------------------------------------------------------- sky
export function skyMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: U, side: THREE.BackSide, depthWrite: false, depthTest: false,
    vertexShader: `varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix * viewMatrix * vec4(position + cameraPosition, 1.0); gl_Position = p.xyww; }`,
    fragmentShader: /* glsl */`
${COMMON}
varying vec3 vDir;
void main(){
  vec3 d = normalize(vDir);
  vec3 col = skyBase(d);
  float h = max(d.y, 0.0);
  vec2 cp = d.xz / (h + 0.13) * 1.15 + uTime * vec2(0.0035, 0.0012);
  float c = smoothstep(0.46, 0.86, fbm(cp * 1.25)) * smoothstep(0.0, 0.10, d.y);
  vec3 cloud = mix(uGlow * 1.5 + uHorizon * 0.7, uZenith * 1.6 + uSkyAmb * 0.5, smoothstep(0.0, 0.45, h));
  col = mix(col, cloud, c * 0.42);
  vec3 g = d * 190.0; vec3 id = floor(g); vec3 fr = fract(g) - 0.5;
  float sr = hash21(id.xy + id.z * 57.0);
  float star = step(0.9935, sr) * smoothstep(0.32, 0.0, length(fr)) * (0.6 + 0.4 * sin(uTime * 2.0 + sr * 300.0));
  col += vec3(.8,.87,1.0) * star * uStars * (1.0 - c) * smoothstep(0.06, 0.45, d.y);
  float md = dot(d, uSunDir);
  col += (uSunCol * 9.0 + 0.3) * (smoothstep(0.99955, 0.99975, md) + 0.02 * pow(max(md, 0.0), 900.0)) * uDisc * (1.0 - c * 0.8);
  col = mix(col, skyBase(vec3(d.x, 0.0, d.z)), smoothstep(0.0, -0.04, d.y));
  gl_FragColor = vec4(col, 1.0);
}`,
  });
}

// ---------------------------------------------------------------- water
const WATER_COMMON = /* glsl */`
${COMMON}
uniform vec3 uWater;
varying vec4 vUv; varying vec3 vWorld;
vec2 waveSlope(vec2 p, float t){
  vec2 s = vec2(0.0);
  for (int i = 0; i < 5; i++){
    float fi = float(i); vec2 d = normalize(vec2(cos(fi * 1.7 + 0.3), sin(fi * 2.3 + 1.1)));
    float k = 0.05 * pow(1.6, fi), w = sqrt(9.8 * k) * 0.8;
    s += d * cos(dot(d, p) * k + t * w + fi * 2.1) * (0.09 / (1.0 + fi * 0.6));
  }
  s += (vec2(vnoise(p * 0.11 + t * 0.22), vnoise(p * 0.11 + 31.7 - t * 0.2)) - 0.5) * 0.24;
  s += (vec2(vnoise(p * 0.6 - t * 0.5), vnoise(p * 0.6 + 11.3 + t * 0.45)) - 0.5) * 0.18;
  return s;
}`;
export const WaterShader = {
  name: 'WaterShader',
  uniforms: { color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: null }, uWater: { value: new THREE.Color(0.006, 0.010, 0.016) } },
  vertexShader: `uniform mat4 textureMatrix; varying vec4 vUv; varying vec3 vWorld;
    void main(){ vUv = textureMatrix * vec4(position, 1.0); vWorld = (modelMatrix * vec4(position,1.0)).xyz; gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0); }`,
  fragmentShader: /* glsl */`
${WATER_COMMON}
uniform sampler2D tDiffuse;
void main(){
  vec3 V = cameraPosition - vWorld; float dist = length(V); V /= dist;
  vec2 sl = waveSlope(vWorld.xz, uTime);
  float att = 1.0 / (1.0 + dist * 0.0004);
  vec3 N = normalize(vec3(-sl.x * att, 1.0, -sl.y * att));
  float fres = 0.02 + 0.98 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
  vec2 o = N.xz * 0.05; vec3 refl = vec3(0.0); float ws = 0.0;
  for (int i = 0; i < 5; i++){
    float fi = float(i) - 2.0;
    vec2 oo = o + vec2(0.0, fi * 0.010 + sl.y * 0.03 * fi);
    float w = 1.0 - abs(fi) * 0.26;
    refl += texture2DProj(tDiffuse, vec4(vUv.xy + oo * vUv.w, vUv.zw)).rgb * w; ws += w;
  }
  refl /= ws;
  vec3 col = mix(uWater * (uSkyAmb * 14.0 + 0.4), refl, clamp(fres * 1.1 + 0.16, 0.0, 1.0));
  vec3 Hh = normalize(V + uSunDir);
  col += uSunCol * pow(max(dot(N, Hh), 0.0), 240.0) * 1.6;
  gl_FragColor = vec4(applyFog(col, vWorld), 1.0);
}`,
};
export function flatWaterMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { ...U, uWater: { value: new THREE.Color(0.006, 0.010, 0.016) } },
    vertexShader: `varying vec4 vUv; varying vec3 vWorld; void main(){ vUv = vec4(0.0); vWorld = (modelMatrix * vec4(position,1.0)).xyz; gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0); }`,
    fragmentShader: /* glsl */`
${WATER_COMMON}
void main(){
  vec3 V = cameraPosition - vWorld; float dist = length(V); V /= dist;
  vec2 sl = waveSlope(vWorld.xz, uTime);
  float att = 1.0 / (1.0 + dist * 0.0004);
  vec3 N = normalize(vec3(-sl.x * att, 1.0, -sl.y * att));
  float fres = 0.02 + 0.98 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
  vec3 R = reflect(-V, N);
  vec3 refl = skyBase(normalize(vec3(R.x, abs(R.y), R.z)));
  vec3 col = mix(uWater * (uSkyAmb * 14.0 + 0.4), refl, clamp(fres * 1.1 + 0.16, 0.0, 1.0));
  col += uSunCol * pow(max(dot(N, normalize(V + uSunDir)), 0.0), 240.0) * 1.6;
  gl_FragColor = vec4(applyFog(col, vWorld), 1.0);
}`,
  });
}

// ---------------------------------------------------------------- lights (points)
export function lightsMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
${COMMON}
attribute vec3 color; attribute vec4 aP; attribute vec3 aVel;
varying vec3 vCol;
void main(){
  vec3 p = position;
  if (aP.w > 1.5) { float span = 2400.0; float tt = mod(uTime + aP.z * 900.0, span) - span * 0.5; p += aVel * tt; }
  vec4 mv = viewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float dist = max(-mv.z, 1.0);
  float sz = aP.x * uPx / dist;
  float k = clamp(sz / 1.7, 0.0, 1.0);
  gl_PointSize = clamp(sz, 1.7, 30.0);
  float b = 1.0;
  if (aP.y > 0.0) b = smoothstep(0.50, 0.56, fract(uTime * aP.y + aP.z)) * (1.0 - smoothstep(0.92, 0.98, fract(uTime * aP.y + aP.z)));
  else b = 0.86 + 0.14 * sin(uTime * (2.0 + aP.z * 5.0) + aP.z * 80.0);
  float gate = aP.w < 0.5 ? uLamp : 1.0;
  vCol = color * b * gate * (0.25 + 0.75 * k * k) * (1.0 - fogAmount(p));
}`,
    fragmentShader: `varying vec3 vCol; void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.05, d); gl_FragColor = vec4(vCol * a * a, 1.0); }`,
  });
}

// ---------------------------------------------------------------- trees
export function treeMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: U,
    vertexShader: `attribute vec4 aT; varying vec3 vWorld, vN; varying float vS;
      void main(){ vec3 w = aT.xyz + position * vec3(aT.w, aT.w * 0.85, aT.w) + vec3(0.0, aT.w * 0.7, 0.0); vWorld = w; vN = normal; vS = fract(aT.x * 0.37 + aT.z * 0.11);
        gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0); }`,
    fragmentShader: /* glsl */`
${COMMON}
varying vec3 vWorld, vN; varying float vS;
void main(){
  vec3 N = normalize(vN);
  vec3 alb = mix(vec3(.018,.045,.016), vec3(.05,.07,.02), vS);
  vec3 light = mix(uGroundAmb, uSkyAmb, N.y * 0.5 + 0.5) * 1.3 + uSunCol * max(dot(N, uSunDir), 0.0) + uStreet * 0.18 * max(-N.y + 0.3, 0.0);
  gl_FragColor = vec4(applyFog(alb * light, vWorld), 1.0);
}`,
  });
}

// ---------------------------------------------------------------- final grade
export const FinalShader = {
  name: 'FinalShader',
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uExposure: { value: 1.1 }, uGrain: { value: 0.016 }, uVig: { value: 0.30 },
    uCA: { value: 0.0004 }, uSharp: { value: 0.45 }, uGrade: { value: 0 }, uFade: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
uniform sampler2D tDiffuse; uniform float uTime, uExposure, uGrain, uVig, uCA, uSharp, uFade; uniform int uGrade; uniform vec2 uRes;
varying vec2 vUv;
vec3 aces(vec3 x){ return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
float h21(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
void main(){
  vec2 c = vUv - 0.5; float r2 = dot(c, c);
  vec2 off = c * r2 * uCA * 4.0;
  vec3 col = vec3(texture2D(tDiffuse, vUv + off).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - off).b);
  // a light unsharp mask, held back on hard edges so lamps keep clean rims
  vec2 px = 1.0 / uRes;
  vec3 nb = (texture2D(tDiffuse, vUv + vec2(px.x, 0.0)).rgb + texture2D(tDiffuse, vUv - vec2(px.x, 0.0)).rgb
           + texture2D(tDiffuse, vUv + vec2(0.0, px.y)).rgb + texture2D(tDiffuse, vUv - vec2(0.0, px.y)).rgb) * 0.25;
  vec3 dd = col - nb;
  col = max(col + dd * uSharp / (1.0 + 6.0 * max(max(abs(dd.r), abs(dd.g)), abs(dd.b))), 0.0) * uExposure;
  float l = dot(col, vec3(.2126, .7152, .0722));
  if (uGrade == 1) { col = mix(col * vec3(.80, 1.02, 1.16), col * vec3(1.14, .99, .80), smoothstep(0.02, 0.55, l)); }
  else if (uGrade == 2) { col = vec3(pow(l, 1.12)) * vec3(1.0, 1.0, 1.02) * 1.15; }
  else if (uGrade == 3) { col = mix(vec3(l), col, 0.72) * vec3(1.10, 0.98, 0.84) + vec3(0.0, 0.002, 0.006); }
  col = aces(col);
  col = mix(col * 12.92, 1.055 * pow(col, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, col));
  col *= 1.0 - uVig * smoothstep(0.08, 0.62, r2);
  float g = h21(vUv * uRes + fract(uTime * 7.13) * vec2(113.0, 71.0)) - 0.5;
  col += g * uGrain * (1.0 - 0.6 * dot(col, vec3(.333)));
  gl_FragColor = vec4(col * uFade, 1.0);
}`,
};
