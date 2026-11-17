// Turns the words in site.config.js into rooms and into the index.
import { SITE } from '../../site.config.js';
import { WIDGETS } from './widgets.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pad = (n) => String(n).padStart(2, '0');
const host = (u) => u.replace(/^https?:\/\//, '').replace(/\/$/, '');

function blockHTML(b, fill) {
  const t = (s) => esc(fill(s));
  switch (b.type) {
    case 'p': return `<p>${t(b.text)}</p>`;
    case 'h': return `<h3>${t(b.text)}</h3>`;
    case 'note': return `<blockquote class="note">${t(b.text)}</blockquote>`;
    case 'list': return `<ul class="list">${b.items.map((i) => `<li>${t(i)}</li>`).join('')}</ul>`;
    case 'steps': return `<ol class="steps">${b.items.map((i) => `<li>${t(i)}</li>`).join('')}</ol>`;
    case 'tags': return `<ul class="tags">${b.items.map((i) => `<li>${t(i)}</li>`).join('')}</ul>`;
    case 'facts': return `<dl class="facts">${b.rows.map(([k, v]) => `<dt>${t(k)}</dt><dd>${t(v)}</dd>`).join('')}</dl>`;
    case 'links': return `<div class="links">${b.items.map((l) => `<a href="${esc(l.url)}" target="_blank" rel="noopener">${t(l.label)}<span aria-hidden="true">↗</span></a>`).join('')}</div>`;
    case 'timeline': return `<ol class="timeline">${b.items.map((i) => `<li><span class="when">${t(i.when)}</span><div><h4>${t(i.title)}</h4><p class="sub">${t(i.sub)}</p>${i.text ? `<p class="txt">${t(i.text)}</p>` : ''}</div></li>`).join('')}</ol>`;
    case 'widget': return `<div class="w" data-widget="${esc(b.name)}">${b.caption ? `<p class="cap">${t(b.caption)}</p>` : ''}</div>`;
    default: return '';
  }
}

export function renderRoom(el, id, ctx) {
  const i = SITE.scenes.findIndex((s) => s.id === id), sc = SITE.scenes[i], room = SITE.rooms[id], n = SITE.scenes.length - 1;
  const prev = SITE.scenes[i - 1 < 1 ? n : i - 1], next = SITE.scenes[i + 1 > n ? 1 : i + 1];
  const st = ctx.world ? ctx.world.stats : { boxes: 30000, lights: 36000 };
  const fill = (s) => String(s).replace('{boxes}', Math.round(st.boxes / 100) * 100 >= 1000 ? (Math.round(st.boxes / 100) * 100).toLocaleString('en-GB') : st.boxes).replace('{lights}', (Math.round(st.lights / 100) * 100).toLocaleString('en-GB'));
  el.innerHTML = `<div class="r-in">
    <div class="r-top"><a class="back" href="#/">← The film</a><span class="r-nav"><a href="#/${prev.id}">Previous</a><a href="#/${next.id}">Next</a></span></div>
    <p class="kicker"><b>SC ${pad(i)}</b><span>${esc(sc.place)}</span><span>${esc(room.kicker)}</span></p>
    <h1>${esc(room.title)}</h1><p class="lede">${esc(room.lede)}</p>
    <div class="blocks">${room.blocks.map((b) => blockHTML(b, fill)).join('')}</div>
    <div class="r-foot"><a href="#/${prev.id}"><small>Previous location</small><span>${esc(prev.title)}</span></a><a href="#/${next.id}"><small>Next location</small><span>${esc(next.title)}</span></a></div>
  </div>`;
  const cleanups = [];
  el.querySelectorAll('[data-widget]').forEach((w) => { const fn = WIDGETS[w.dataset.widget]; if (!fn) return;
    const mount = document.createElement('div'); w.prepend(mount); const c = fn(mount, ctx); if (typeof c === 'function') cleanups.push(c); if (!mount.isConnected || !mount.childNodes.length) w.remove(); });
  return () => cleanups.forEach((c) => c());
}

export function renderIndex(el) {
  const c = SITE.contact, [first, ...rest] = SITE.name.split(' ');
  const fill = (s) => String(s).replace('{boxes}', 'about 30,000').replace('{lights}', '36,000');
  el.innerHTML = `<div class="ix">
    <div class="ix-side"><a class="back" href="#/">← The film</a>
      <h1>${esc(first)}<br>${esc(rest.join(' '))}</h1><p class="thesis">${esc(SITE.thesis)}</p><p class="bio">${esc(SITE.bio)}</p>
      <dl class="facts"><dt>Known as</dt><dd>${esc(SITE.short)}${SITE.alias ? `, and in print as ${esc(SITE.alias)}` : ''}</dd><dt>Based</dt><dd>${esc(SITE.location)}</dd>
        <dt>Email</dt><dd><a href="mailto:${c.email}">${c.email}</a></dd>${c.linkedin ? `<dt>Elsewhere</dt><dd><a href="${esc(c.linkedin)}" target="_blank" rel="noopener">LinkedIn</a> · <a href="${SITE.links.obelisk}" target="_blank" rel="noopener">${host(SITE.links.obelisk)}</a> · <a href="${SITE.links.veripres}" target="_blank" rel="noopener">${host(SITE.links.veripres)}</a></dd>` : ''}</dl>
      <div class="links"><a href="#/contact">Book a conversation</a></div></div>
    <div class="ix-main">${SITE.scenes.slice(1).map((sc, k) => { const r = SITE.rooms[sc.id];
      return `<section><p class="kicker"><b>${pad(k + 1)}</b><span>${esc(sc.place)}</span><span>${esc(r.kicker)}</span></p><h2><a href="#/${sc.id}">${esc(r.title)}</a></h2><p class="lede">${esc(r.lede)}</p>
        <div class="blocks">${r.blocks.filter((b) => b.type !== 'widget').map((b) => blockHTML(b, fill)).join('')}</div><p><a class="go" href="#/${sc.id}">${esc(sc.cta)} →</a></p></section>`; }).join('')}</div></div>`;
}
