// One centred window for the room activities (Game Room games, Astrology Room readings), in Top1's card style.
// While it is open the character does not react to keys (state.uiLock).
import { el } from './util.js';

export function createModal(state) {
  const box = el('div', { class: 'act-modal', hidden: true });
  document.body.append(box);
  let onClose = null;
  function close() { if (box.hidden) return; box.hidden = true; state.uiLock = false; const f = onClose; onClose = null; box.replaceChildren(); f?.(); }
  box.addEventListener('pointerdown', (e) => { if (e.target === box) close(); });
  addEventListener('keydown', (e) => { if (!box.hidden && e.key === 'Escape') close(); });
  return {
    /** Opens the window and returns its body element. opts: { wide, cls (extra classes for the card), tools (extra header buttons), onClose } */
    open(title, opts = {}) {
      close();
      const body = el('div', { class: 'act-body' });
      box.replaceChildren(el('div', { class: 'act-card' + (opts.wide ? ' wide' : '') + (opts.cls ? ' ' + opts.cls : '') }, el('header', {}, el('b', { text: title }), ...(opts.tools || []), el('button', { class: 'nut tron', text: '✕', 'aria-label': 'Close', onclick: close })), body));
      box.hidden = false; state.uiLock = true; onClose = opts.onClose || null;
      return body;
    },
    close,
    get isOpen() { return !box.hidden; },
  };
}
