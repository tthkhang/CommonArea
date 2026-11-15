// UI building blocks (from campus-export's ui.js): toasts and closable side panels.
import { $, el } from './util.js';

/** A short message at the top of the screen. kind: 'info' | 'error'. */
export function toast(msg, kind = 'info') {
  const box = $('toasts'); if (!box) return;
  const t = el('div', { class: 'toast' + (kind === 'error' ? ' error' : ''), text: msg });
  box.append(t);
  while (box.children.length > 4) box.firstChild.remove();
  setTimeout(() => t.remove(), 4200);
}

const registry = new Map(); // id -> { id, root, getTitle, contextual, hint }

/**
 * A card that can be collapsed (–) or closed (✕). side: 'right' (default) = the right-hand column;
 * 'left' = under the player's name and the player count (shared music, cinema queue).
 * contextual: true = the game shows / hides it by itself (cinema queue only inside the cinema, table chat only
 * while seated). A closed contextual panel reopens by itself the next time its situation starts.
 */
export function createPanel(id, title, { hidden = false, collapsed = false, closed = false, contextual = false, hint = '', side = 'right' } = {}) {
  const titleEl = el('span', { class: 'p-title', text: title });
  const toggle = el('button', { title: 'Collapse / expand', text: collapsed ? '+' : '–' });
  const close = el('button', { title: 'Close this panel', text: '✕' });
  const body = el('div', { class: 'p-body' });
  const root = el('section', { class: 'side-panel', id: `panel-${id}` }, el('header', {}, titleEl, el('span', { class: 'p-btns' }, toggle, close)), body);
  root.hidden = hidden;
  root.classList.toggle('collapsed', collapsed);
  root.classList.toggle('closed', closed);
  toggle.addEventListener('click', () => { toggle.textContent = root.classList.toggle('collapsed') ? '+' : '–'; });
  close.addEventListener('click', () => root.classList.add('closed'));
  // when the game shows a contextual panel again, an earlier "close" no longer applies
  new MutationObserver(() => { if (!root.hidden) root.classList.remove('closed'); }).observe(root, { attributes: true, attributeFilter: ['hidden'] });
  $(side === 'left' ? 'side-left' : 'side').append(root);
  registry.set(id, { id, root, getTitle: () => titleEl.textContent, contextual, hint });
  return { root, body, show: () => { root.hidden = false; }, hide: () => { root.hidden = true; }, setTitle: (t) => { titleEl.textContent = t; } };
}
export function setPanelOpen(id, open) { const p = registry.get(id); if (p) p.root.classList.toggle('closed', !open); }
export const isPanelOpen = (id) => { const p = registry.get(id); return !!p && !p.root.classList.contains('closed') && !p.root.hidden; };
