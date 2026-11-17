// The interactive pieces inside the rooms. Each mount returns a cleanup function (or nothing).
import { SITE } from '../../site.config.js';

const h = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ------------------------------------------------------------------ chess: the Opera Game, 1858
const OPERA = [['e2e4', 'e4'], ['e7e5', 'e5'], ['g1f3', 'Nf3'], ['d7d6', 'd6'], ['d2d4', 'd4'], ['c8g4', 'Bg4'], ['d4e5', 'dxe5'], ['g4f3', 'Bxf3'],
  ['d1f3', 'Qxf3'], ['d6e5', 'dxe5'], ['f1c4', 'Bc4'], ['g8f6', 'Nf6'], ['f3b3', 'Qb3'], ['d8e7', 'Qe7'], ['b1c3', 'Nc3'], ['c7c6', 'c6'],
  ['c1g5', 'Bg5'], ['b7b5', 'b5'], ['c3b5', 'Nxb5'], ['c6b5', 'cxb5'], ['c4b5', 'Bxb5+'], ['b8d7', 'Nbd7'], ['e1c1', 'O-O-O'], ['a8d8', 'Rd8'],
  ['d1d7', 'Rxd7'], ['d8d7', 'Rxd7'], ['h1d1', 'Rd1'], ['e7e6', 'Qe6'], ['b5d7', 'Bxd7+'], ['f6d7', 'Nxd7'], ['b3b8', 'Qb8+'], ['d7b8', 'Nxb8'], ['d1d8', 'Rd8#']];
const GLYPH = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };

function chess(el) {
  const start = () => { const P = []; const back = 'rnbqkbnr';
    for (let f = 0; f < 8; f++) { const file = 'abcdefgh'[f];
      P.push({ t: back[f], c: 'w', sq: file + 1 }, { t: 'p', c: 'w', sq: file + 2 }, { t: 'p', c: 'b', sq: file + 7 }, { t: back[f], c: 'b', sq: file + 8 }); }
    return P; };
  const stateAt = (ply) => { const P = start(); let last = null;
    for (let i = 0; i < ply; i++) { const [m] = OPERA[i], from = m.slice(0, 2), to = m.slice(2);
      const victim = P.find((p) => p.sq === to); if (victim) victim.sq = null;
      const mover = P.find((p) => p.sq === from); mover.sq = to;
      if (mover.t === 'k' && from === 'e1' && to === 'c1') P.find((p) => p.sq === 'a1').sq = 'd1';
      last = [from, to]; }
    return { P, last }; };

  const root = h(`<div class="chess"><div class="board" role="img" aria-label="Chess board"></div>
    <div class="ch-side"><p class="ch-state"></p>
    <div class="ch-ctl"><button type="button" data-a="start">Start</button><button type="button" data-a="back">Back</button><button type="button" data-a="play">Play</button><button type="button" data-a="next">Next</button><button type="button" data-a="end">End</button></div>
    <ol class="moves"></ol></div></div>`);
  const board = root.querySelector('.board'), list = root.querySelector('.moves'), state = root.querySelector('.ch-state'), playBtn = root.querySelector('[data-a="play"]');
  const sqEl = {};
  for (let r = 8; r >= 1; r--) for (let f = 0; f < 8; f++) { const d = document.createElement('div'); d.className = 'sq' + ((f + r) % 2 ? '' : ' d'); board.append(d); sqEl['abcdefgh'[f] + r] = d; }
  const pieces = start().map((p) => { const d = document.createElement('div'); d.className = 'piece p' + p.c; d.textContent = GLYPH[p.t] + '︎'; board.append(d); return d; });
  for (let i = 0; i < OPERA.length; i += 2) { list.append(h(`<span>${i / 2 + 1}.</span>`), h(`<button type="button" data-ply="${i + 1}">${OPERA[i][1]}</button>`),
    OPERA[i + 1] ? h(`<button type="button" data-ply="${i + 2}">${OPERA[i + 1][1]}</button>`) : h('<span></span>')); }

  let ply = 0, timer = 0;
  const draw = () => { const { P, last } = stateAt(ply);
    P.forEach((p, i) => { const d = pieces[i]; if (!p.sq) { d.classList.add('x'); return; } d.classList.remove('x');
      const f = 'abcdefgh'.indexOf(p.sq[0]), r = 8 - +p.sq[1]; d.style.transform = `translate(${f * 100}%, ${r * 100}%)`; });
    Object.values(sqEl).forEach((s) => s.classList.remove('hl')); if (last) last.forEach((s) => sqEl[s].classList.add('hl'));
    list.querySelectorAll('button').forEach((b) => b.classList.toggle('on', +b.dataset.ply === ply));
    const on = list.querySelector('button.on'); if (on) { const top = on.offsetTop - list.offsetTop; if (top < list.scrollTop || top > list.scrollTop + list.clientHeight - 30) list.scrollTop = top - 60; }
    state.textContent = ply === 0 ? 'Morphy v. the Duke and the Count' : ply === OPERA.length ? 'Checkmate. 1–0' : `Move ${Math.ceil(ply / 2)} · ${ply % 2 ? 'White' : 'Black'} played ${OPERA[ply - 1][1]}`; };
  const stop = () => { clearInterval(timer); timer = 0; playBtn.textContent = 'Play'; };
  const play = () => { if (ply >= OPERA.length) ply = 0; playBtn.textContent = 'Pause'; draw();
    timer = setInterval(() => { if (ply >= OPERA.length) return stop(); ply++; draw(); }, 1250); };
  root.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.ply) { stop(); ply = +b.dataset.ply; return draw(); }
    const a = b.dataset.a; if (a === 'play') return timer ? stop() : play();
    stop(); ply = a === 'start' ? 0 : a === 'end' ? OPERA.length : Math.max(0, Math.min(OPERA.length, ply + (a === 'next' ? 1 : -1))); draw(); });
  el.append(root); draw();
  const auto = setTimeout(play, 1400);
  return () => { clearTimeout(auto); clearInterval(timer); };
}

// ------------------------------------------------------------------ cards: think of one
const SUIT = { s: '♠', h: '♥', c: '♣', d: '♦' };
const SET_A = ['Ks', 'Qh', 'Jc', 'Kd', 'Qc', 'Jh'], SET_B = ['Kc', 'Qd', 'Js', 'Kh', 'Qs'];
function cards(el) {
  const root = h(`<div class="trick"><p class="say" aria-live="polite"></p><div class="hand"></div><div class="act"></div></div>`);
  const say = root.querySelector('.say'), hand = root.querySelector('.hand'), act = root.querySelector('.act');
  const card = (c) => { const red = c[1] === 'h' || c[1] === 'd'; const s = SUIT[c[1]] + '︎';
    return h(`<div class="card down${red ? ' red' : ''}"><div class="f"><small>${c[0]}\n${s}</small><b>${c[0]}</b><em>${s}</em><small>${c[0]}\n${s}</small></div><div class="k"></div></div>`); };
  const timers = []; const later = (fn, ms) => timers.push(setTimeout(fn, ms));
  const deal = (set) => { hand.innerHTML = ''; const els = set.map(card); hand.append(...els); els.forEach((e, i) => later(() => e.classList.remove('down'), 250 + i * 140)); return els; };
  const btn = (label, fn, solid) => { const b = h(`<button type="button" class="btn${solid ? ' solid' : ''}">${label}</button>`); b.addEventListener('click', fn); return b; };
  function begin() {
    act.innerHTML = ''; say.textContent = 'Six cards. Choose one, in your head only. Don’t click it. Say its name to yourself.';
    deal(SET_A); later(() => act.append(btn('I have it', think, true)), 1300);
  }
  function think() {
    act.innerHTML = ''; say.textContent = 'Good. Hold it there. Keep saying its name.';
    const els = [...hand.children]; els.forEach((e, i) => later(() => e.classList.add('down'), i * 90));
    later(() => { els.forEach((e, i) => { e.style.transform = `rotateY(180deg) translateX(${(2.5 - i) * 108}%) rotate(${(i - 2.5) * 3}deg)`; }); }, 1000);
    later(() => { say.textContent = 'I am going to take one card out of the six. Yours.'; }, 2300);
    later(() => { const five = deal(SET_B); say.textContent = 'Look. It is gone.';
      later(() => { act.append(btn('Again', begin), btn('How?', () => { say.textContent = 'Look at the five that came back. Not for your card. For any of the others.'; })); }, 1400 + five.length * 140); }, 4200);
  }
  el.append(root); begin();
  return () => timers.forEach(clearTimeout);
}

// ------------------------------------------------------------------ Veripres card: a code that turns over every thirty seconds
function vcard(el) {
  const C = 2 * Math.PI * 38;
  const root = h(`<div class="vcard"><svg viewBox="0 0 86 86" aria-hidden="true"><circle class="tr" cx="43" cy="43" r="38"/><circle class="pr" cx="43" cy="43" r="38" stroke-dasharray="${C}"/></svg>
    <div><p class="lbl">Your Veripres card</p><p class="code"></p><p class="sub"></p></div></div>`);
  const code = root.querySelector('.code'), sub = root.querySelector('.sub'), ring = root.querySelector('.pr');
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let slot = -1;
  const tick = () => { const now = Date.now(), s = Math.floor(now / 30000), left = 30 - Math.floor((now % 30000) / 1000);
    if (s !== slot) { slot = s; let x = (s * 2654435761) >>> 0, out = ''; for (let i = 0; i < 8; i++) { x = (Math.imul(x ^ (x >>> 15), 2246822519) + 0x9e3779b9) >>> 0; out += A[x % A.length]; } code.textContent = `VP-${out.slice(0, 4)}-${out.slice(4)}`; }
    ring.style.strokeDashoffset = String(C * (1 - left / 30)); sub.textContent = `Changes in ${left} s. Works once.`; };
  tick(); const t = setInterval(tick, 1000); el.append(root);
  return () => clearInterval(t);
}

// ------------------------------------------------------------------ barbell, loaded to exactly 200 kg
function barbell(el) {
  const plates = [[25, 150, 15], [25, 150, 15], [25, 150, 15], [10, 108, 10], [5, 78, 8]];
  let side = '', x = 0; plates.forEach(([kg, ht, w]) => { side += `<rect x="${x}" y="${-ht / 2}" width="${w}" height="${ht}" fill="${kg === 25 ? '#e9eaec' : kg === 10 ? '#9a9fa7' : '#585c63'}"/><text x="${x + w / 2}" y="${ht / 2 + 18}" text-anchor="middle">${kg}</text>`; x += w + 3; });
  side += `<rect x="${x}" y="-11" width="12" height="22" fill="#3a3d42"/><rect x="${x + 12}" y="-6" width="34" height="12" fill="#b9bdc4"/>`;
  el.append(h(`<div class="barbell"><p class="big">200<small>kg deadlift</small></p>
    <svg viewBox="0 0 640 210" role="img" aria-label="A barbell loaded to 200 kilograms"><g font-family="IBM Plex Mono, monospace" font-size="11" fill="#7b8088">
    <rect x="150" y="101" width="340" height="8" fill="#b9bdc4"/><rect x="138" y="94" width="12" height="22" fill="#3a3d42"/><rect x="490" y="94" width="12" height="22" fill="#3a3d42"/>
    <g transform="translate(502 105)">${side}</g><g transform="translate(138 105) scale(-1 1)">${side.replace(/<text[^>]*>[^<]*<\/text>/g, '')}</g>
    <text x="320" y="92" text-anchor="middle">20</text></g></svg></div>`));
}

// ------------------------------------------------------------------ a glimpse of connection, unlabelled
function graph(el) {
  const root = h('<div class="graph"><canvas></canvas></div>'), cv = root.firstElementChild, cx = cv.getContext('2d'); el.append(root);
  let W = 0, H = 0, raf = 0, t0 = performance.now(); const N = 46; let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const nodes = Array.from({ length: N }, () => ({ x: rnd(), y: rnd(), vx: (rnd() - .5) * .00004, vy: (rnd() - .5) * .00004, r: 1.2 + rnd() * 2.2 }));
  const size = () => { const d = Math.min(devicePixelRatio || 1, 2); W = cv.clientWidth; H = cv.clientHeight; cv.width = W * d; cv.height = H * d; cx.setTransform(d, 0, 0, d, 0, 0); };
  let path = [], pathT = 0;
  const pick = () => { let a = Math.floor(rnd() * N); path = [a]; for (let k = 0; k < 4; k++) { let best = -1, bd = 1e9; nodes.forEach((n, i) => { if (path.includes(i)) return; const d = Math.hypot(n.x - nodes[a].x, n.y - nodes[a].y) + rnd() * .08; if (d < bd) { bd = d; best = i; } }); a = best; path.push(a); } pathT = performance.now(); };
  const frame = (now) => { raf = requestAnimationFrame(frame); const dt = Math.min(now - t0, 50); t0 = now; if (!W) size(); cx.clearRect(0, 0, W, H);
    nodes.forEach((n) => { n.x += n.vx * dt; n.y += n.vy * dt; if (n.x < .03 || n.x > .97) n.vx *= -1; if (n.y < .06 || n.y > .94) n.vy *= -1; });
    cx.lineWidth = 1;
    for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) { const a = nodes[i], b = nodes[j], d = Math.hypot((a.x - b.x) * W, (a.y - b.y) * H); if (d < 120) { cx.strokeStyle = `rgba(200,204,210,${0.2 * (1 - d / 120)})`; cx.beginPath(); cx.moveTo(a.x * W, a.y * H); cx.lineTo(b.x * W, b.y * H); cx.stroke(); } }
    if (now - pathT > 4200) pick();
    const k = Math.min(1, (now - pathT) / 1400) * (path.length - 1), fade = Math.min(1, (4200 - (now - pathT)) / 600);
    cx.strokeStyle = `rgba(140,174,255,${0.95 * fade})`; cx.lineWidth = 1.5; cx.beginPath();
    for (let s = 0; s < path.length - 1 && s < k; s++) { const a = nodes[path[s]], b = nodes[path[s + 1]], f = Math.min(1, k - s); if (!s) cx.moveTo(a.x * W, a.y * H); cx.lineTo((a.x + (b.x - a.x) * f) * W, (a.y + (b.y - a.y) * f) * H); }
    cx.stroke();
    nodes.forEach((n, i) => { const on = path.indexOf(i) > -1 && path.indexOf(i) <= k; cx.fillStyle = on ? `rgba(140,174,255,${fade})` : 'rgba(244,245,246,.8)'; cx.fillRect(n.x * W - n.r, n.y * H - n.r, n.r * 2, n.r * 2); }); };
  const ro = new ResizeObserver(size); ro.observe(cv); pick(); raf = requestAnimationFrame(frame);
  return () => { cancelAnimationFrame(raf); ro.disconnect(); };
}

// ------------------------------------------------------------------ viewfinder: lens, hour, grade
export function viewfinder(el, ctx, compact) {
  const w = ctx.world; if (!w) { el.append(h('<p class="fine">The viewfinder needs the live city, which this device could not start.</p>')); return; }
  const rows = [
    ['Lens', 'lens', [[null, 'Auto'], [24, '24'], [35, '35'], [50, '50'], [85, '85']]],
    ['Hour', 'tod', [[null, 'Film'], [0, 'Blue hour'], [1, 'Night'], [2, 'First light']]],
    ['Grade', 'grade', [[0, 'Natural'], [1, 'Teal'], [2, 'Noir'], [3, 'Tungsten']]],
    ['Grain', 'grain', [[true, 'On'], [false, 'Off']]],
  ];
  const root = h(`<div class="${compact ? '' : 'vfp'}">${rows.map(([label, key, opts]) => `<div class="vf-row"><span>${label}</span><div class="seg" data-k="${key}">${opts.map(([, name], i) => `<button type="button" data-i="${i}">${name}</button>`).join('')}</div></div>`).join('')}
    <div class="vf-act"><button type="button" class="btn" data-a="still">Save a still</button><button type="button" class="btn" data-a="reset">Reset</button></div></div>`);
  const sync = () => { const look = w.getLook(); rows.forEach(([, key, opts]) => root.querySelectorAll(`[data-k="${key}"] button`).forEach((b, i) => b.setAttribute('aria-pressed', String(opts[i][0] === look[key])))); };
  root.addEventListener('click', async (e) => { const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.a === 'reset') { w.setLook({ lens: null, tod: null, grade: 0, grain: true }); }
    else if (b.dataset.a === 'still') { const blob = await w.capture(); if (!blob) return; const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'krishil-ghelani-still.jpg'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); return; }
    else { const key = b.parentElement.dataset.k, row = rows.find((r) => r[1] === key); w.setLook({ [key]: row[2][+b.dataset.i][0] }); }
    document.dispatchEvent(new CustomEvent('look')); });
  document.addEventListener('look', sync); sync(); el.append(root);
  return () => document.removeEventListener('look', sync);
}

function reel(el) {
  if (!SITE.reel || !SITE.reel.length) { el.remove(); return; }
  el.append(h(`<ul class="reel">${SITE.reel.map((r) => `<li><a href="${esc(r.url)}" target="_blank" rel="noopener"><b>${esc(r.title)}</b><span>${esc(r.note || '')}</span></a></li>`).join('')}</ul>`));
}

// ------------------------------------------------------------------ booking: a request, sent by email or to your endpoint
const IST = 5.5 * 3600e3;
async function deliver(kind, subject, body, data) {
  const ep = SITE.contact.formEndpoint;
  if (ep) { try { const r = await fetch(ep, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ kind, subject, ...data }) }); if (r.ok) return 'sent'; } catch (e) { /* fall through to email */ } }
  location.href = `mailto:${SITE.contact.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  return 'mail';
}
function booking(el) {
  const B = SITE.booking, days = []; const nowI = new Date(Date.now() + IST);
  for (let i = 1; days.length < 9 && i <= B.daysAhead + 7; i++) { const d = new Date(Date.UTC(nowI.getUTCFullYear(), nowI.getUTCMonth(), nowI.getUTCDate() + i)); if (B.weekdays.includes(d.getUTCDay())) days.push(d); }
  const fmtD = (d) => d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
  const at = (d, s) => { const [hh, mm] = s.split(':').map(Number); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), hh, mm) - IST); };
  const local = (dt) => dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const tzOf = (dt) => { try { return new Intl.DateTimeFormat([], { timeZoneName: 'short' }).formatToParts(dt).find((x) => x.type === 'timeZoneName').value; } catch (e) { return 'local'; } };
  const sameAsIST = new Date().getTimezoneOffset() === -330, tzName = tzOf(new Date());
  const root = h(`<form class="book" novalidate>
    <fieldset><legend><b>01</b>What is it about</legend><div class="opts">${B.types.map((t, i) => `<label><input type="radio" name="type" value="${t.id}"${i ? '' : ' checked'}><span>${esc(t.label)}<small>${t.mins} min</small></span></label>`).join('')}</div></fieldset>
    <fieldset><legend><b>02</b>Choose a day</legend><div class="opts">${days.map((d, i) => `<label><input type="radio" name="day" value="${i}"${i ? '' : ' checked'}><span>${fmtD(d)}</span></label>`).join('')}</div></fieldset>
    <fieldset><legend><b>03</b>Choose a time</legend><div class="opts" data-slots></div></fieldset>
    <fieldset><legend><b>04</b>Who is asking</legend><div class="fields">
      <label>Name<input name="who" autocomplete="name" required></label><label>Email<input name="email" type="email" autocomplete="email" required></label>
      <label class="full">What would you like to talk about<textarea name="note"></textarea></label></div></fieldset>
    <div class="send"><button class="btn solid" type="submit">Send the request</button><p class="fine">Times are requests, not confirmations. ${SITE.short} replies by email with a calendar invite.</p></div>
    <div class="done" hidden></div></form>`);
  const slots = root.querySelector('[data-slots]'), done = root.querySelector('.done'), F = root.elements;
  const paint = () => { const d = days[+F.day.value]; const keep = F.slot ? F.slot.value : B.slots[0];
    slots.innerHTML = B.slots.map((s) => `<label><input type="radio" name="slot" value="${s}"${s === keep ? ' checked' : ''}><span>${s} IST${sameAsIST ? '' : `<small>${local(at(d, s))} ${esc(tzOf(at(d, s)))}</small>`}</span></label>`).join(''); };
  root.addEventListener('change', (e) => { if (e.target.name === 'day') paint(); }); paint();
  root.addEventListener('submit', async (e) => { e.preventDefault();
    const name = F.who.value.trim(), email = F.email.value.trim();
    if (!name || !/^\S+@\S+\.\S+$/.test(email)) { done.hidden = false; done.innerHTML = '<p>Add your name and a working email address, and send again.</p>'; (name ? F.email : F.who).focus(); return; }
    const type = B.types.find((t) => t.id === F.type.value), d = days[+F.day.value], s = F.slot.value, when = at(d, s);
    const subject = `Conversation request: ${type.label}, ${fmtD(d)} at ${s} IST`;
    const body = `Hello ${SITE.short},\n\nI would like to book a conversation.\n\nAbout: ${type.label} (${type.mins} min)\nWhen: ${fmtD(d)}, ${s} IST (${local(when)} ${tzName})\nName: ${name}\nEmail: ${email}\n\n${F.note.value.trim()}\n`;
    const how = await deliver('booking', subject, body, { type: type.id, startsAt: when.toISOString(), minutes: type.mins, name, email, note: F.note.value.trim() });
    const z = (n) => String(n).padStart(2, '0'), ics = (t) => `${t.getUTCFullYear()}${z(t.getUTCMonth() + 1)}${z(t.getUTCDate())}T${z(t.getUTCHours())}${z(t.getUTCMinutes())}00Z`;
    const file = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//krishilghelani.com//booking//EN', 'BEGIN:VEVENT', `UID:${Date.now()}@${SITE.domain}`, `DTSTAMP:${ics(new Date())}`, `DTSTART:${ics(when)}`,
      `DTEND:${ics(new Date(+when + type.mins * 60000))}`, `SUMMARY:Hold: ${type.label} with ${SITE.name} (unconfirmed)`, 'STATUS:TENTATIVE', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    done.hidden = false;
    done.innerHTML = `<p>${how === 'sent' ? 'Sent. You will hear back by email.' : `Your email app should have opened with the request written out. If it did not, write to <a href="mailto:${SITE.contact.email}">${SITE.contact.email}</a>.`}</p>
      <a class="btn" download="hold-${ics(when)}.ics" href="data:text/calendar;charset=utf-8,${encodeURIComponent(file)}">Add a hold to my calendar</a>`; });
  el.append(root);
}
function write(el) {
  const c = SITE.contact;
  const root = h(`<div class="write"><a class="addr" href="mailto:${c.email}">${c.email}</a><button type="button" class="btn" data-a="copy">Copy address</button>${c.linkedin ? `<a class="btn" href="${esc(c.linkedin)}" target="_blank" rel="noopener">LinkedIn</a>` : ''}</div>`);
  root.querySelector('[data-a="copy"]').addEventListener('click', async (e) => { try { await navigator.clipboard.writeText(c.email); e.target.textContent = 'Copied'; } catch (_) { e.target.textContent = c.email; } setTimeout(() => { e.target.textContent = 'Copy address'; }, 1800); });
  el.append(root);
}

export const WIDGETS = { chess, cards, vcard, barbell, graph, viewfinder, reel, booking, write };
