// The renderer, the light, and the camera. Everything the page asks of the city goes through here.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { U, skyMaterial, WaterShader, flatWaterMaterial, FinalShader } from './materials.js';
import { buildCity } from './city.js';
import { STOPS, MAP_VIEW } from './layout.js';

// Three hours of the day: blue hour, night, first light.
const TOD = [
  { zenith: [0.010, 0.024, 0.075], horizon: [0.060, 0.070, 0.125], glow: [0.085, 0.045, 0.024], sunGlow: [0.95, 0.36, 0.11],
    sunDir: [-0.93, 0.035, -0.36], sunCol: [0.10, 0.075, 0.07], skyAmb: [0.030, 0.045, 0.095], groundAmb: [0.014, 0.012, 0.014],
    street: [0.40, 0.24, 0.11], litOffice: 0.38, litResi: 0.24, stars: 0.18, lamp: 0.9, disc: 0, fog: 0.000068, exposure: 1.0 },
  { zenith: [0.004, 0.007, 0.020], horizon: [0.022, 0.022, 0.036], glow: [0.085, 0.046, 0.022], sunGlow: [0.015, 0.02, 0.035],
    sunDir: [0.45, 0.52, 0.72], sunCol: [0.030, 0.040, 0.070], skyAmb: [0.012, 0.017, 0.034], groundAmb: [0.010, 0.008, 0.007],
    street: [0.50, 0.29, 0.13], litOffice: 0.27, litResi: 0.30, stars: 0.6, lamp: 1, disc: 1, fog: 0.000058, exposure: 1.15 },
  { zenith: [0.018, 0.045, 0.130], horizon: [0.120, 0.125, 0.185], glow: [0.075, 0.040, 0.022], sunGlow: [2.10, 0.74, 0.20],
    sunDir: [0.90, 0.045, 0.42], sunCol: [0.55, 0.28, 0.15], skyAmb: [0.045, 0.062, 0.120], groundAmb: [0.022, 0.018, 0.018],
    street: [0.34, 0.20, 0.09], litOffice: 0.20, litResi: 0.22, stars: 0.10, lamp: 0.8, disc: 0, fog: 0.00005, exposure: 1.05 },
];
const LENS = { 24: 53.1, 35: 37.8, 50: 27.0, 85: 16.1 };

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, k) => a + (b - a) * k;
const smoother = (x) => x * x * x * (x * (x * 6 - 15) + 10);

export function createWorld(canvas, { quality = 'high', reducedMotion = false } = {}) {
  const hi = quality !== 'low';
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, stencil: false, powerPreference: 'high-performance' });
  if (!renderer.capabilities.isWebGL2) throw new Error('WebGL2 unavailable');
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.setClearColor(0x000000, 1);
  let dpr = Math.min(window.devicePixelRatio || 1, hi ? 1.75 : 1.25);
  let W = 2, H = 2;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 4, 60000);

  const sky = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), skyMaterial());
  sky.frustumCulled = false; sky.renderOrder = -10; scene.add(sky);

  const city = buildCity(quality); scene.add(city.group);

  // water: a real planar reflection where the machine can afford it
  const waterGeo = new THREE.PlaneGeometry(90000, 90000);
  let reflector = null, flatWater = null;
  const makeFlat = () => { flatWater = new THREE.Mesh(waterGeo, flatWaterMaterial()); flatWater.rotation.x = -Math.PI / 2; flatWater.frustumCulled = false; scene.add(flatWater); };
  if (hi) {
    reflector = new Reflector(waterGeo, { textureWidth: 512, textureHeight: 512, shader: WaterShader, multisample: 0, clipBias: 0.5 });
    Object.assign(reflector.material.uniforms, U);
    reflector.rotation.x = -Math.PI / 2; reflector.frustumCulled = false; scene.add(reflector);
  } else makeFlat();

  let composer, bloom, final;
  function buildComposer(samples) {
    const rt = new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType, samples });
    composer = new EffectComposer(renderer, rt);
    composer.addPass(new RenderPass(scene, camera));
    bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), hi ? 0.36 : 0.32, 0.5, 1.0);
    composer.addPass(bloom);
    final = new ShaderPass(FinalShader); composer.addPass(final);
  }
  buildComposer(hi ? 4 : 0);

  function resize() {
    W = Math.max(2, canvas.clientWidth); H = Math.max(2, canvas.clientHeight);
    renderer.setPixelRatio(dpr); renderer.setSize(W, H, false);
    composer.setPixelRatio(dpr); composer.setSize(W, H);
    if (reflector) reflector.getRenderTarget().setSize(Math.floor(W * dpr * 0.6), Math.floor(H * dpr * 0.6));
    final.uniforms.uRes.value.set(W * dpr, H * dpr);
    camera.aspect = W / H;
  }

  // ------------------------------------------------------------ state
  const stops = STOPS.map((s) => ({ ...s, posV: new THREE.Vector3(...s.pos), tgtV: new THREE.Vector3(...s.tgt) }));
  const cruise = [300, 660, 660, 440, 660, 660, 440, 320];
  const sway = { title: 0.012, obelisk: 0.05, veripres: 0.03, education: 0.035, training: 0.02, sleight: 0.004, chess: 0.03, film: 0.012, contact: 0.02 };
  const S = {
    mode: 'film', p: 0, pS: 0, room: -1, shift: 0, shiftS: 0, mx: 0, my: 0, mxS: 0, myS: 0,
    look: { tod: null, grade: 0, lens: null, grain: true }, todS: 0, fovK: 0,
    map: { az: MAP_VIEW.az, el: MAP_VIEW.el, dist: MAP_VIEW.dist },
    fade: 0, fadeTo: 1, t: 0, paused: false,
  };
  const des = { pos: new THREE.Vector3(), tgt: new THREE.Vector3(), fov: 30 };
  const cur = { pos: stops[0].posV.clone(), tgt: stops[0].tgtV.clone(), fov: stops[0].fov };
  const tmp = new THREE.Vector3(), right = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), fwd = new THREE.Vector3();

  function filmPose(p, out) {
    const i = clamp(Math.floor(p), 0, stops.length - 2), f = clamp(p - i, 0, 1), a = stops[i], b = stops[i + 1];
    const e = clamp((f - 0.15) / 0.70, 0, 1), s = smoother(clamp((e - 0.1) / 0.8, 0, 1));
    out.pos.lerpVectors(a.posV, b.posV, s); out.tgt.lerpVectors(a.tgtV, b.tgtV, smoother(e));
    const lift = Math.max(0, cruise[i] - Math.max(a.posV.y, b.posV.y));
    out.pos.y = lerp(a.posV.y, b.posV.y, smoother(e)) + lift * Math.pow(Math.sin(Math.PI * e), 0.55);
    out.fov = lerp(a.fov, b.fov, smoother(e));
    return { i: Math.round(p), dwell: 1 - Math.sin(Math.PI * e) };
  }
  function setTOD(t) {
    const i = clamp(Math.floor(t), 0, 1), k = clamp(t - i, 0, 1), a = TOD[i], b = TOD[i + 1];
    const c = (key, u) => u.value.setRGB(lerp(a[key][0], b[key][0], k), lerp(a[key][1], b[key][1], k), lerp(a[key][2], b[key][2], k));
    c('zenith', U.uZenith); c('horizon', U.uHorizon); c('glow', U.uGlow); c('sunGlow', U.uSunGlow); c('sunCol', U.uSunCol);
    c('skyAmb', U.uSkyAmb); c('groundAmb', U.uGroundAmb); c('street', U.uStreet);
    U.uSunDir.value.set(lerp(a.sunDir[0], b.sunDir[0], k), lerp(a.sunDir[1], b.sunDir[1], k), lerp(a.sunDir[2], b.sunDir[2], k)).normalize();
    U.uLitOffice.value = lerp(a.litOffice, b.litOffice, k); U.uLitResi.value = lerp(a.litResi, b.litResi, k);
    U.uStars.value = lerp(a.stars, b.stars, k); U.uLamp.value = lerp(a.lamp, b.lamp, k); U.uDisc.value = lerp(a.disc, b.disc, k) * (1 - Math.sin(Math.PI * k) * 0.9);
    U.uFogDen.value = lerp(a.fog, b.fog, k);
    final.uniforms.uExposure.value = lerp(a.exposure, b.exposure, k);
  }
  // the film runs from blue hour, through the night, into first light
  const todOfP = (p) => { const n = stops.length - 1; return p < 1.2 ? smoother(clamp(p / 1.2, 0, 1)) : p > n - 1.3 ? 1 + smoother(clamp((p - (n - 1.3)) / 1.15, 0, 1)) : 1; };

  // ------------------------------------------------------------ frame
  const clock = new THREE.Clock(); let frames = 0, acc = 0, slow = 0, firstFrame = null, raf = 0;
  const listeners = new Set();
  function frame() {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.1); if (S.paused) return;
    S.t += dt; U.uTime.value = S.t;
    const k = (rate) => reducedMotion ? 1 : 1 - Math.exp(-dt * rate);
    S.pS = lerp(S.pS, S.p, k(3.6));
    S.shiftS = lerp(S.shiftS, S.shift, k(3.2)); S.mxS = lerp(S.mxS, S.mx, k(2.2)); S.myS = lerp(S.myS, S.my, k(2.2));

    let swayAmp = 0.02, rate = 4.5;
    if (S.mode === 'map') {
      const m = S.map; des.tgt.set(...MAP_VIEW.tgt);
      des.pos.set(Math.cos(m.el) * Math.sin(m.az), Math.sin(m.el), Math.cos(m.el) * Math.cos(m.az)).multiplyScalar(m.dist).add(des.tgt);
      des.fov = MAP_VIEW.fov; swayAmp = 0; rate = 2.4;
    } else if (S.mode === 'room' && S.room >= 0) {
      const s = stops[S.room]; des.pos.lerpVectors(s.posV, s.tgtV, 0.08); des.tgt.copy(s.tgtV); des.fov = s.fov; swayAmp = sway[s.id] * 1.6; rate = 2.6;
    } else {
      const r = filmPose(S.pS, des); swayAmp = sway[stops[clamp(r.i, 0, stops.length - 1)].id] * r.dwell;
    }
    if (S.look.lens && S.mode !== 'map') des.fov = LENS[S.look.lens];
    cur.pos.x = lerp(cur.pos.x, des.pos.x, k(rate)); cur.pos.z = lerp(cur.pos.z, des.pos.z, k(rate)); cur.pos.y = lerp(cur.pos.y, des.pos.y, k(rate * 1.9));
    cur.tgt.lerp(des.tgt, k(rate)); cur.fov = lerp(cur.fov, des.fov, k(3));

    // a breath of orbit and the pointer's weight, so a held frame is never dead
    camera.position.copy(cur.pos);
    if (!reducedMotion && swayAmp > 0) {
      const a = Math.sin(S.t * 0.11) * swayAmp; tmp.subVectors(cur.pos, cur.tgt); const c = Math.cos(a), s = Math.sin(a);
      camera.position.set(cur.tgt.x + tmp.x * c - tmp.z * s, cur.pos.y + Math.sin(S.t * 0.17) * swayAmp * 40, cur.tgt.z + tmp.x * s + tmp.z * c);
    }
    fwd.subVectors(cur.tgt, camera.position); const dist = fwd.length(); fwd.normalize(); right.crossVectors(fwd, up).normalize();
    tmp.copy(cur.tgt).addScaledVector(right, S.mxS * dist * 0.022).addScaledVector(up, -S.myS * dist * 0.012);
    camera.lookAt(tmp);
    const asp = W / H; camera.fov = asp < 1.25 ? THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(cur.fov) / 2) * Math.min(2.1, 1.25 / asp))) : cur.fov;
    const off = Math.round(S.shiftS * W * 0.5);
    if (off > 0) camera.setViewOffset(W, H, off, 0, W, H); else if (camera.view) camera.clearViewOffset();
    camera.updateProjectionMatrix();
    U.uPx.value = (H * dpr) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));

    const todTarget = S.look.tod != null ? S.look.tod : S.mode === 'map' ? 1 : todOfP(S.pS);
    S.todS = lerp(S.todS, todTarget, k(S.look.tod == null && S.mode !== 'map' ? 6 : 1.4)); setTOD(S.todS);
    S.fade = lerp(S.fade, S.fadeTo, k(1.6));
    final.uniforms.uFade.value = S.fade; final.uniforms.uTime.value = reducedMotion ? 0 : S.t; final.uniforms.uGrade.value = S.look.grade;
    final.uniforms.uGrain.value = S.look.grain ? 0.016 : 0;

    composer.render();
    if (!firstFrame) { firstFrame = true; listeners.forEach((fn) => fn('ready')); }
    listeners.forEach((fn) => fn('frame', S.pS));

    // keep it fluid: shed resolution first, then the reflection
    frames++; acc += dt;
    if (frames >= 50) { const ms = acc / frames * 1000; frames = 0; acc = 0;
      if (ms > 30 && S.t > 3) { slow++; if (slow >= 2) { slow = 0;
        if (dpr > 0.8) { dpr = Math.max(0.75, dpr - 0.25); resize(); }
        else if (reflector) { scene.remove(reflector); reflector.getRenderTarget().dispose(); reflector = null; makeFlat(); } } } else slow = 0; }
  }

  let rz = 0; const ro = new ResizeObserver(() => { clearTimeout(rz); rz = setTimeout(resize, 140); }); ro.observe(canvas); resize();
  setTOD(0);

  const pv = new THREE.Vector3();
  return {
    stops, stats: city.stats,
    start() { if (!raf) frame(); },
    on(fn) { listeners.add(fn); },
    setProgress(p) { S.p = clamp(p, 0, stops.length - 1); },
    jump(p) { S.p = S.pS = clamp(p, 0, stops.length - 1); filmPose(S.pS, des); cur.pos.copy(des.pos); cur.tgt.copy(des.tgt); cur.fov = des.fov; S.todS = todOfP(S.pS); },
    setMode(mode, room = -1) { S.mode = mode; S.room = room; },
    setShift(v) { S.shift = v; },
    setPointer(x, y) { S.mx = x; S.my = y; },
    setLook(o) { Object.assign(S.look, o); },
    getLook() { return { ...S.look }; },
    mapDrag(dx, dy) { S.map.az -= dx * 0.004; S.map.el = clamp(S.map.el + dy * 0.003, 0.22, 1.35); },
    mapZoom(d) { S.map.dist = clamp(S.map.dist * (1 + d * 0.0012), 3800, 17000); },
    mapReset() { Object.assign(S.map, { az: MAP_VIEW.az, el: MAP_VIEW.el, dist: MAP_VIEW.dist }); },
    project(x, y, z) { pv.set(x, y, z).project(camera); return { x: (pv.x * 0.5 + 0.5) * W, y: (-pv.y * 0.5 + 0.5) * H, front: pv.z < 1 && pv.z > -1 }; },
    fadeTo(v) { S.fadeTo = v; },
    pause(v) { S.paused = v; },
    capture() { composer.render(); return new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.92)); },
  };
}
