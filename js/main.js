// The page: scroll drives the film, the hash drives the rooms.
import { SITE } from '../site.config.js';
import { renderRoom, renderIndex } from './ui/rooms.js';
import { viewfinder } from './ui/widgets.js';

const $ = (s) => document.querySelector(s);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pad = (n) => String(n).padStart(2, '0');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const scenes = SITE.scenes, N = scenes.length - 1;
const html = document.documentElement, body = document.body;
const film = $('#film'), chapters = $('#chapters'), room = $('#room'), indexEl = $('#index'), mapEl = $('#map'), pinsEl = $('#pins'), vf = $('#vf'), guides = $('#guides'), track = $('#track'), vfBtn = $('#vf-toggle');
const slate = { scene: $('#s-scene'), place: $('#s-place'), coords: $('#s-coords'), hour: $('#s-hour'), tc: $('#s-tc') };
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const q = new URLSearchParams(location.search);

let world = null, PINS = null, seg = 900, p = 0, mode = 'film', roomCleanup = null, pendingGo = null, lastI = -1, sceneEls = [], tickEls = [], pinEls = [], indexBuilt = false;

// ---------------------------------------------------------------- build
function buildFilm() {
  const [first, ...rest] = SITE.name.split(' ');
  film.innerHTML = scenes.map((s, i) => i === 0
    ? `<section class="scene title" data-i="0"><h1><span>${esc(first)}</span> <span>${esc(rest.join(' '))}</span></h1><p class="thesis">${esc(SITE.thesis)}</p>
        <ul class="credits">${SITE.credits.map((c) => `<li>${esc(c)}</li>`).join('')}</ul><p class="hint">${esc(s.hint)}<i></i></p></section>`
    : `<section class="scene" data-i="${i}"><p class="eyebrow">${pad(i)}<span>${esc(s.place)}</span></p><h2>${esc(s.title)}</h2><p class="line">${esc(s.line)}</p>
        <a class="enter" href="#/${s.id}">${esc(s.cta)}<span aria-hidden="true">→</span></a></section>`).join('');
  chapters.innerHTML = scenes.map((s, i) => `<a href="#/" data-go="${i}"><span>${i ? pad(i) + ' ' + esc(s.title) : 'Title'}</span><i></i></a>`).join('');
  sceneEls = [...film.children]; tickEls = [...chapters.children];
}
function layout() { seg = Math.round(innerHeight * 1.4); track.style.height = seg * N + innerHeight + 'px'; }

// ---------------------------------------------------------------- film
function onScroll() { if (mode !== 'film') return; p = clamp(scrollY / seg, 0, N); if (world) world.setProgress(p); }
function setP(i) { const was = html.classList.contains('locked'); html.classList.remove('locked'); p = i; scrollTo(0, Math.round(i * seg)); if (was) html.classList.add('locked'); if (world) world.setProgress(i); }
function goTo(i, cut = Math.abs(p - i) > 1.25) {
  i = clamp(i, 0, N);
  if (cut && world && !reduced) { world.fadeTo(0); setTimeout(() => { setP(i); world.jump(i); world.fadeTo(1); }, 430); }
  else if (cut) { setP(i); if (world) world.jump(i); }
  else scrollTo({ top: Math.round(i * seg), behavior: reduced ? 'auto' : 'smooth' });
}
function tick(pS) {
  for (let i = 0; i < sceneEls.length; i++) { const o = clamp(1 - (Math.abs(pS - i) - 0.13) / 0.2, 0, 1), e = sceneEls[i];
    e.style.opacity = o; e.style.transform = `translate3d(0, ${(1 - o) * 16}px, 0)`; e.classList.toggle('on', o > 0.55 && mode === 'film'); }
  const i = clamp(Math.round(pS), 0, N);
  if (i !== lastI) { lastI = i; const s = scenes[i];
    slate.scene.textContent = `SC ${pad(i)} / ${pad(N)}`; slate.place.textContent = s.place || 'New York Harbor'; slate.coords.textContent = s.coords || '40.6700° N  74.0400° W';
    tickEls.forEach((t, k) => t.classList.toggle('on', k === i)); }
  const look = world.getLook();
  slate.hour.textContent = look.tod != null ? ['Blue hour', 'Night', 'First light'][look.tod] : pS < 0.55 ? 'Blue hour' : pS > N - 0.75 ? 'First light' : 'Night';
  const fr = Math.floor(pS * 24 * 24), z = (n) => String(n).padStart(2, '0');
  slate.tc.textContent = `${z(Math.floor(fr / 86400))}:${z(Math.floor(fr / 1440) % 60)}:${z(Math.floor(fr / 24) % 60)}:${z(fr % 24)}`;
  if (mode === 'map') placePins();
}

// ---------------------------------------------------------------- routes
function show(el, cls) { el.hidden = false; void el.offsetWidth; body.classList.add(cls); }
function hide(el, cls) { if (!body.classList.contains(cls)) return; body.classList.remove(cls); setTimeout(() => { if (!body.classList.contains(cls)) el.hidden = true; }, 850); }
const applyShift = () => { if (world) world.setShift(mode === 'room' && innerWidth > 860 ? room.offsetWidth / innerWidth : 0); };

function enterRoom(i) {
  const id = scenes[i].id, far = Math.abs(p - i) > 0.35;
  const open = () => { if (roomCleanup) roomCleanup(); roomCleanup = renderRoom(room, id, { world }); room.scrollTop = 0; show(room, 'room-open'); room.focus({ preventScroll: true }); if (world) world.setMode('room', i); applyShift(); };
  if (far && world && !reduced) { body.classList.remove('room-open'); world.fadeTo(0); setTimeout(() => { setP(i); world.jump(i); world.fadeTo(1); open(); }, 430); }
  else { setP(i); if (far && world) world.jump(i); open(); }
}
function setMode(next, i) {
  if (mode === 'room' && next !== 'room') { hide(room, 'room-open'); if (roomCleanup) { roomCleanup(); roomCleanup = null; } }
  if (mode === 'index' && next !== 'index') hide(indexEl, 'index-open');
  if (mode === 'map' && next !== 'map') hide(mapEl, 'map-open');
  mode = next; html.classList.toggle('locked', next !== 'film');
  if (next === 'film') { if (world) { world.setMode('film'); world.setShift(0); } if (pendingGo != null) { const g = pendingGo; pendingGo = null; goTo(g, true); } }
  else if (next === 'room') enterRoom(i);
  else if (next === 'index') { if (!indexBuilt) { renderIndex(indexEl); indexBuilt = true; } indexEl.scrollTop = 0; show(indexEl, 'index-open'); indexEl.focus({ preventScroll: true }); if (world) { world.setMode('film'); world.setShift(0); } }
  else if (next === 'map') { if (!world) { location.hash = '#/index'; return; } world.setShift(0); world.mapReset(); world.setMode('map'); show(mapEl, 'map-open'); }
}
function route() {
  const hsh = decodeURIComponent(location.hash.replace(/^#\/?/, '')); const i = scenes.findIndex((s) => s.id === hsh);
  if (hsh === 'index') setMode('index'); else if (hsh === 'map') setMode('map'); else if (i > 0) setMode('room', i); else setMode('film');
}

// ---------------------------------------------------------------- map
function buildPins() {
  pinsEl.innerHTML = scenes.slice(1).map((s, k) => `<button type="button" class="pin" data-go="${k + 1}"><b>${pad(k + 1)} ${esc(s.title)}</b><i></i></button>`).join('');
  pinEls = [...pinsEl.children];
}
function placePins() {
  const r = mapEl.getBoundingClientRect();
  pinEls.forEach((el, k) => { const a = PINS[scenes[k + 1].id]; if (!a) return; const s = world.project(a[0], a[1], a[2]);
    el.style.visibility = s.front ? 'visible' : 'hidden'; el.style.transform = `translate3d(${Math.round(s.x - r.left)}px, ${Math.round(s.y - r.top)}px, 0) translate(-50%, -100%)`; });
}
let drag = null;
mapEl.addEventListener('pointerdown', (e) => { if (e.target.closest('.pin')) return; drag = { x: e.clientX, y: e.clientY }; mapEl.setPointerCapture(e.pointerId); });
mapEl.addEventListener('pointermove', (e) => { if (!drag || !world) return; world.mapDrag(e.clientX - drag.x, e.clientY - drag.y); drag.x = e.clientX; drag.y = e.clientY; });
mapEl.addEventListener('pointerup', () => { drag = null; }); mapEl.addEventListener('pointercancel', () => { drag = null; });
mapEl.addEventListener('wheel', (e) => { e.preventDefault(); if (world) world.mapZoom(e.deltaY); }, { passive: false });
pinsEl.addEventListener('click', (e) => { const b = e.target.closest('.pin'); if (!b) return; pendingGo = +b.dataset.go; location.hash = '#/'; });

// ---------------------------------------------------------------- viewfinder, keys, pointer
function toggleVF(on = vf.hidden) { vf.hidden = !on; guides.hidden = !on; body.classList.toggle('vf-open', on); vfBtn.setAttribute('aria-expanded', String(on)); if (on && !vf.firstChild) viewfinder(vf, { world }, true); }
vfBtn.addEventListener('click', () => toggleVF());
chapters.addEventListener('click', (e) => { const a = e.target.closest('a'); if (!a) return; e.preventDefault(); goTo(+a.dataset.go); });
$('.mark').addEventListener('click', (e) => { if (mode === 'film') { e.preventDefault(); goTo(0); } });
addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === 'Escape') { if (!vf.hidden) return toggleVF(false); if (mode !== 'film') location.hash = '#/'; return; }
  if (e.target.closest && e.target.closest('input, textarea, select, [contenteditable]')) return;
  if (mode === 'film') {
    if (e.key === 'ArrowRight' || e.key === 'j') { e.preventDefault(); goTo(Math.floor(p + 0.5) + 1, false); }
    else if (e.key === 'ArrowLeft' || e.key === 'k') { e.preventDefault(); goTo(Math.ceil(p - 0.5) - 1, false); }
    else if (e.key === 'Enter' && !e.target.closest('a, button')) { const i = Math.round(p); if (i > 0) location.hash = '#/' + scenes[i].id; }
  }
  if (e.key === 'i') location.hash = mode === 'index' ? '#/' : '#/index';
  else if (e.key === 'm') location.hash = mode === 'map' ? '#/' : '#/map';
  else if (e.key === 'v' && world) toggleVF();
});
if (matchMedia('(pointer: fine)').matches) addEventListener('pointermove', (e) => { if (world) world.setPointer((e.clientX / innerWidth - 0.5) * 2, (e.clientY / innerHeight - 0.5) * 2); }, { passive: true });
addEventListener('scroll', onScroll, { passive: true });
let lastW = innerWidth, lastH = innerHeight;
addEventListener('resize', () => {
  // a phone's address bar sliding away is not a resize worth re-laying the film for
  if (innerWidth === lastW && Math.abs(innerHeight - lastH) < 150) return;
  lastW = innerWidth; lastH = innerHeight; const keep = p; layout(); if (mode === 'film') scrollTo(0, Math.round(keep * seg)); applyShift();
});
addEventListener('hashchange', route);
document.addEventListener('visibilitychange', () => { if (world) world.pause(document.hidden); });

// ---------------------------------------------------------------- boot
async function boot() {
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  buildFilm(); layout();
  const fonts = Promise.all(['400 40px "Libre Caslon Display"', '400 20px "Libre Caslon Text"', 'italic 400 20px "Libre Caslon Text"', '500 12px Inter', '600 40px Inter', '400 12px "IBM Plex Mono"'].map((f) => document.fonts.load(f))).catch(() => {});
  await Promise.race([fonts, new Promise((r) => setTimeout(r, 2000))]);
  try {
    const [{ createWorld }, L] = await Promise.all([import('./world/world.js'), import('./world/layout.js')]);
    PINS = L.PINS;
    const low = q.get('q') ? q.get('q') === 'low' : (matchMedia('(max-width: 860px)').matches || matchMedia('(pointer: coarse)').matches || (navigator.hardwareConcurrency || 8) <= 4);
    if (q.get('q') === 'off') throw new Error('the city was switched off with ?q=off');
    world = createWorld($('#stage'), { quality: low ? 'low' : 'high', reducedMotion: reduced });
    world.on((ev, pS) => { if (ev === 'ready') { body.classList.add('ready'); world.fadeTo(1); } else tick(pS); });
    buildPins(); world.start();
  } catch (err) {
    console.warn('The live city could not start; showing the index instead.', err);
    world = null; body.classList.add('no-gl', 'ready'); if (!location.hash || location.hash === '#/') location.hash = '#/index';
  }
  onScroll(); route();
}
boot();
