// Shared bits of the Game Room screens: the seat chips (face, name, host crown, turn clock) and small helpers.
// A "view" is what the referee (shared/games.js) sends one player about their table; `api` is what the room
// module (rooms/games.js) hands every game screen: { send(kind, extra), colorOf(playerId), now(), toast(text) }.
import { el } from '../util.js';

export const LUDO_COLORS = [['Red', '#E5484D'], ['Blue', '#3E63DD'], ['Yellow', '#F0B400'], ['Green', '#30A46C']];

/** Who sits on a seat: { seat, name, kind, here, host, you, color } */
export function seatInfo(view, seat, api) {
  const s = view.seats[seat] || {};
  return { seat, name: s.name || 'Empty', empty: !s.name, kind: s.kind || null, here: s.here !== false, host: !!s.host, you: view.you === seat,
    color: (s.id != null && api.colorOf(s.id)) || (s.kind === 'human' ? '#8E5BFF' : '#8A90A8') };
}
/** A seat chip. opts: { color (ring / face colour), extra (node shown under the name), cls, onclick } */
export function chip(view, seat, api, opts = {}) {
  const s = seatInfo(view, seat, api);
  const face = el('span', { class: 'gt-face', text: s.empty ? '·' : s.kind && s.kind !== 'human' ? '🤖' : s.name.trim().charAt(0).toUpperCase() });
  face.style.background = s.empty ? '#E4DEF3' : opts.color || s.color;
  const ring = el('span', { class: 'gt-ring' }, face); ring.dataset.seat = seat;
  const node = el(opts.onclick ? 'button' : 'div', { class: 'gt-chip' + (s.you ? ' you' : '') + (s.here ? '' : ' away') + (s.empty ? ' empty' : '') + (opts.cls ? ' ' + opts.cls : ''), type: opts.onclick ? 'button' : null }, ring,
    el('span', { class: 'gt-name' }, s.host ? el('i', { class: 'gt-crown', text: '👑', title: 'Host of the table' }) : null, el('span', { text: s.name }), s.you ? el('i', { class: 'gt-you', text: 'you' }) : null),
    opts.extra || null);
  node.dataset.seat = seat;
  if (opts.onclick) node.addEventListener('click', opts.onclick);
  return node;
}
/**
 * Keeps the countdown rings of the chips inside `root` turning. clock() returns { seat, until, total } or null.
 * Returns a function that stops it.
 */
export function runClock(root, clock, now) {
  const tick = () => {
    const c = clock();
    for (const r of root.querySelectorAll('.gt-ring')) {
      const on = !!c && String(c.seat) === r.dataset.seat; const p = on ? Math.max(0, Math.min(1, (c.until - now()) / c.total)) : 0;
      r.style.setProperty('--p', p.toFixed(3)); r.classList.toggle('on', on); r.classList.toggle('low', on && p < 0.25);
    }
    for (const b of root.querySelectorAll('[data-until]')) { // plain "0:14" countdowns
      const left = Math.max(0, Math.ceil((Number(b.dataset.until) - now()) / 1000)); const text = Math.floor(left / 60) + ':' + String(left % 60).padStart(2, '0');
      if (b.textContent !== text) b.textContent = text;
    }
  };
  tick(); const t = setInterval(tick, 100);
  return () => clearInterval(t);
}
export const medal = (i) => ['🥇', '🥈', '🥉'][i] || (i + 1) + '.';
/** "A", "A and B", "A, B and C" */
export const listNames = (names) => (names.length <= 1 ? names.join('') : names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1]);
/** An arrow with a short text that points at an element (guided practice). Returns { at(target, text), hide() }. */
export function pointer(root) {
  const tip = el('div', { class: 'gt-tip', hidden: true }, el('b', { text: '👇' }), el('span'));
  root.append(tip); let target = null; let timer = 0;
  const place = () => { // the window may still be opening, or things may have moved: keep following the target
    if (!root.isConnected) { clearInterval(timer); timer = 0; return; }
    if (!target || !target.isConnected) { tip.hidden = true; return; }
    const a = target.getBoundingClientRect(); const b = root.getBoundingClientRect(); const k = root.offsetWidth ? b.width / root.offsetWidth || 1 : 1; // k: the window may be scaled while it pops open
    tip.hidden = false; tip.style.left = Math.round((a.left - b.left + a.width / 2) / k + root.scrollLeft) + 'px'; tip.style.top = Math.round((a.top - b.top) / k + root.scrollTop) + 'px';
  };
  return {
    at(node, text) { target = node || null; tip.querySelector('span').textContent = text; place(); if (!timer) timer = setInterval(place, 200); },
    hide() { target = null; tip.hidden = true; },
  };
}
