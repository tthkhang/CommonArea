// The emote wheel (like Fortnite's): press B (or the Emotes button), then click an emote or press 1-8.
// An emote loops until you walk, jump or pick it again; everyone nearby sees it.
import { EMOTES } from './avatar.js';
import { $, el } from './util.js';

export function createEmoteWheel({ onPick }) {
  const root = $('emote-wheel');
  const label = el('div', { class: 'ew-label', text: 'Emotes' });
  const R = 118; // radius of the ring in pixels
  const buttons = EMOTES.map((e, i) => {
    const a = (i / EMOTES.length) * Math.PI * 2 - Math.PI / 2; // first emote at the top, clockwise
    const b = el('button', { class: 'ew-btn', title: `${e.label} (${i + 1})` },
      el('span', { class: 'ew-icon', text: e.icon }), el('span', { class: 'ew-num', text: String(i + 1) }));
    b.style.left = `calc(50% + ${Math.cos(a) * R}px)`;
    b.style.top = `calc(50% + ${Math.sin(a) * R}px)`;
    b.addEventListener('mouseenter', () => { label.textContent = e.label; });
    b.addEventListener('mouseleave', () => { label.textContent = 'Emotes'; });
    b.addEventListener('click', () => { api.close(); onPick(e.id); });
    return b;
  });
  root.replaceChildren(label, ...buttons);
  root.addEventListener('pointerdown', (e) => { if (e.target === root) api.close(); }); // click the backdrop

  const api = {
    get isOpen() { return !root.hidden; },
    open() { label.textContent = 'Emotes'; root.hidden = false; },
    close() { root.hidden = true; },
    toggle() { root.hidden ? api.open() : api.close(); },
    /** Digit 1-8 while the wheel is open. */
    pickIndex(i) { const e = EMOTES[i]; if (e) { api.close(); onPick(e.id); } },
  };
  return api;
}
