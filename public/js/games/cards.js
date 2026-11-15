// Colour Cards ("Bài Màu") screen: the players around the table, the deck and the pile, your hand as a fan.
// The referee (shared/games.js) keeps the deck and every hand; this screen only gets your own cards.
import { el } from '../util.js';
import { chip, runClock, medal, seatInfo, pointer } from './common.js';

export const CARD_HEX = { p: '#8E5BFF', y: '#F0B400', r: '#F2695C', t: '#22B8A7' };
export const CARD_COLOR = { p: 'purple', y: 'yellow', r: 'coral', t: 'teal' };
const SYMBOL = { skip: '⊘', rev: '⇄', '+2': '+2', wild: '', '+4': '+4' };
export const CARD_NAME = { skip: 'Skip', rev: 'Reverse', '+2': '+2', wild: 'Wild', '+4': 'Wild +4' };
export const cardName = (c) => (c.c === 'w' ? CARD_NAME[c.v] : CARD_COLOR[c.c] + ' ' + (CARD_NAME[c.v] || c.v));
/** A card face ({ c, v }), or the back of a card (null). opts: { small, chosen (the colour picked for a wild) } */
export function cardEl(card, opts = {}) {
  const n = el('div', { class: 'cc-card ' + (card ? 'c-' + card.c : 'back') + (opts.small ? ' small' : '') });
  if (!card) { n.append(el('span', { class: 'cc-key' }), el('b', { class: 'cc-brand', text: 'Top 1 Server' })); return n; }
  const label = card.v in SYMBOL ? SYMBOL[card.v] : card.v;
  n.title = cardName(card);
  n.append(el('i', { class: 'cc-corner', text: label || '★' }), el('span', { class: 'cc-oval' }, el('b', { text: label })), el('i', { class: 'cc-corner br', text: label || '★' }));
  if (card.c === 'w' && opts.chosen) n.style.setProperty('--chosen', CARD_HEX[opts.chosen]);
  return n;
}
const ORDER = { p: 0, y: 1, r: 2, t: 3, w: 4 }; const VAL = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'skip', 'rev', '+2', 'wild', '+4'];
const sortHand = (hand) => hand.slice().sort((a, b) => ORDER[a.c] - ORDER[b.c] || VAL.indexOf(a.v) - VAL.indexOf(b.v) || a.id - b.id);

export function mountCards(root, api) {
  let view = null; let selected = null; let topId = null; let handRects = {}; let picking = null;
  const seats = el('div', { class: 'gt-seats' });
  const dir = el('div', { class: 'cc-dir', title: 'Direction of play' });
  const deck = el('button', { class: 'cc-deck', type: 'button', title: 'Draw a card' }, cardEl(null), el('span', { class: 'cc-count' }));
  const pile = el('div', { class: 'cc-pile' }); const colour = el('div', { class: 'cc-colour' });
  const chooser = el('div', { class: 'cc-chooser', hidden: true }, el('b', { text: 'Choose the colour' }),
    el('div', {}, ...Object.keys(CARD_HEX).map((c) => { const b = el('button', { type: 'button', title: CARD_COLOR[c], 'aria-label': CARD_COLOR[c], onclick: () => { const id = picking; picking = null; chooser.hidden = true; if (id != null) api.send('move', { play: id, color: c }); } }); b.style.background = CARD_HEX[c]; b.dataset.color = c; return b; })),
    el('button', { class: 'nut nho xam', type: 'button', text: 'Cancel', onclick: () => { picking = null; chooser.hidden = true; } }));
  const table = el('div', { class: 'cc-table' }, dir, deck, pile, colour, chooser);
  const status = el('div', { class: 'gt-status' });
  const oneBtn = el('button', { class: 'nut nho vang cc-one', type: 'button', text: '☝ One card!', hidden: true, onclick: () => api.send('move', { one: true }) });
  const passBtn = el('button', { class: 'nut nho xam', type: 'button', text: 'Keep it and pass', hidden: true, onclick: () => api.send('move', { pass: true }) });
  const catchBtn = el('button', { class: 'nut nho cc-catch', type: 'button', hidden: true, onclick: () => api.send('move', { catch: true }) });
  const actions = el('div', { class: 'cc-actions' }, oneBtn, passBtn, catchBtn);
  const hand = el('div', { class: 'cc-hand' });
  const wrap = el('div', { class: 'cc-wrap' }, seats, table, status, actions, hand); root.append(wrap);
  const tip = pointer(wrap);
  const myTurn = () => view && view.you != null && view.g.turn === view.you && !view.g.over;
  const stop = runClock(root, () => { // the turn clock, plus the buttons that depend on the time
    if (!view || !view.g) return null; const o = view.g.one; const now = api.now();
    const canCatch = !!o && view.you != null && o.seat !== view.you && !o.called && now >= o.until && !view.g.over;
    if (catchBtn.hidden === canCatch) { catchBtn.hidden = !canCatch; if (canCatch) catchBtn.textContent = `🫵 Catch ${seatInfo(view, o.seat, api).name}!`; }
    if (!oneBtn.hidden && o) oneBtn.style.setProperty('--p', Math.max(0, Math.min(1, (o.until - now) / 3000)).toFixed(2));
    return view.clock ? { ...view.clock, total: 20000 } : null;
  }, api.now);

  function play(card) {
    if (!myTurn() || !view.g.playable.includes(card.id)) return;
    selected = null;
    if (card.c === 'w') { // a Wild: first choose the colour
      picking = card.id; chooser.hidden = false;
      if (view.hint && view.hint.color) setTimeout(() => tip.at(chooser.querySelector(`[data-color="${view.hint.color}"]`), 'Choose this colour — you still hold a card of it.'), 30);
      return;
    }
    api.send('move', { play: card.id });
  }
  deck.addEventListener('click', () => { if (myTurn() && view.g.drawn == null) api.send('move', { draw: true }); });
  function fly(card, from, to, turn) {
    if (!from || !to || !from.width || !to.width || typeof document.body.animate !== 'function') return;
    const c = cardEl(card); c.classList.add('cc-fly'); c.style.left = from.left + 'px'; c.style.top = from.top + 'px'; document.body.append(c);
    const a = c.animate([{ transform: 'translate(0,0) rotate(0deg)' }, { transform: `translate(${to.left - from.left}px, ${to.top - from.top}px) rotate(${turn}deg)` }], { duration: 380, easing: 'cubic-bezier(.2,.8,.3,1)' });
    a.onfinish = a.oncancel = () => c.remove(); setTimeout(() => c.remove(), 700);
  }
  function describe(v) {
    const g = v.g; const name = (s) => (s === v.you ? 'You' : seatInfo(v, s, api).name); const l = g.last; let text = '';
    if (l && l.card) {
      text = `${name(l.seat)} played ${cardName(l.card)}. `;
      if (l.hit) text += `${name(l.hit.seat)} ${l.hit.seat === v.you ? 'draw' : 'draws'} ${l.hit.n} and ${l.hit.seat === v.you ? 'miss' : 'misses'} the turn. `;
      else if (l.card.v === 'skip') text += 'The next player misses the turn. ';
      else if (l.card.v === 'rev') text += g.all.length === 2 ? 'With two players that is a Skip. ' : 'The direction turns round. ';
      if (l.card.c === 'w') text += `The colour is now ${CARD_COLOR[g.color]}. `;
    } else if (l && l.drew) text = `${name(l.seat)} drew a card. `;
    else if (l && l.passed) text = `${name(l.seat)} kept the card. `;
    else if (l && l.caught != null) text = `${name(l.seat)} caught ${l.caught === v.you ? 'you' : seatInfo(v, l.caught, api).name} without “One card!” — two extra cards. `;
    if (g.over) return text + 'The game is over.';
    if (g.turn !== v.you) return text + `${seatInfo(v, g.turn, api).name}’s turn…`;
    if (g.drawn != null) return text + 'The card you drew fits: click it twice to play it, or keep it and pass.';
    return text + (g.playable.length ? `Your turn: click a raised card twice (or drag it up) — a ${CARD_COLOR[g.color]} card, the same number or symbol, or a Wild.` : 'Your turn, but nothing fits: draw a card from the deck.');
  }
  function paint(v) {
    const g = v.g; const me = v.you;
    const order = me == null ? g.all : g.all.slice(g.all.indexOf(me)).concat(g.all.slice(0, g.all.indexOf(me)));
    seats.replaceChildren(...order.map((s) => chip(v, s, api, { cls: g.turn === s && !g.over ? 'turn' : '',
      extra: el('span', { class: 'gt-sub' + (g.counts[s] === 1 ? ' hot' : ''), text: (g.ranks.indexOf(s) >= 0 ? medal(g.ranks.indexOf(s)) + ' ' : '') + `🂠 ${g.counts[s]} card${g.counts[s] === 1 ? '' : 's'}` + (g.one && g.one.seat === s && g.one.called ? ' · “One card!”' : '') }) })));
    dir.textContent = g.dir === 1 ? '↻' : '↺'; dir.classList.toggle('back', g.dir !== 1);
    deck.querySelector('.cc-count').textContent = g.deck; deck.classList.toggle('can', myTurn() && g.drawn == null);
    const fresh = topId !== null && g.top.id !== topId; const from = fresh && g.last && g.last.card ? (g.last.seat === me ? handRects[g.top.id] : seats.querySelector(`[data-seat="${g.last.seat}"]`)?.getBoundingClientRect()) : null;
    const top = cardEl(g.top, { chosen: g.color }); pile.replaceChildren(top); topId = g.top.id;
    if (from) { top.style.visibility = 'hidden'; setTimeout(() => { top.style.visibility = ''; }, 360); fly(g.top, from, top.getBoundingClientRect(), g.top.id % 2 ? 14 : -11); }
    colour.replaceChildren(el('i', {}), el('span', { text: 'Colour in play: ' + CARD_COLOR[g.color] })); colour.firstChild.style.background = CARD_HEX[g.color];
    status.textContent = me == null ? describe(v).replace(/Your turn.*/, '') + ' (You are watching.)' : describe(v);
    oneBtn.hidden = !(g.one && g.one.seat === me && !g.one.called && !g.over); passBtn.hidden = !(myTurn() && g.drawn != null);
    if (!myTurn()) { picking = null; chooser.hidden = true; }
    // the hand
    const cards = sortHand(g.hand); const n = cards.length; const step = Math.min(7, 54 / Math.max(1, n - 1)); const overlap = n > 9 ? Math.min(44, 30 + (n - 9) * 2.4) : n > 6 ? 22 : 8;
    if (!cards.some((c) => c.id === selected)) selected = null;
    hand.replaceChildren(...cards.map((card, i) => {
      const ok = myTurn() && g.playable.includes(card.id); const off = i - (n - 1) / 2;
      const b = el('button', { class: 'cc-slot' + (ok ? ' ok' : '') + (selected === card.id ? ' sel' : ''), type: 'button', 'aria-label': cardName(card) + (ok ? ' (can be played)' : '') }, cardEl(card));
      b.style.setProperty('--a', (off * step).toFixed(1) + 'deg'); b.style.setProperty('--y', (Math.abs(off) * Math.abs(off) * 1.1).toFixed(1) + 'px'); if (i) b.style.marginLeft = -overlap + 'px';
      b.dataset.id = card.id;
      b.addEventListener('click', () => { if (!ok) return; if (selected === card.id) play(card); else { selected = card.id; for (const x of hand.children) x.classList.toggle('sel', x === b); } });
      let y0 = null; // drag the card up to the table
      b.addEventListener('pointerdown', (e) => { if (ok) { y0 = e.clientY; b.setPointerCapture?.(e.pointerId); } });
      b.addEventListener('pointermove', (e) => { if (y0 != null) b.style.setProperty('--drag', Math.min(0, e.clientY - y0) + 'px'); });
      const end = (e) => { if (y0 == null) return; const dy = e.clientY - y0; y0 = null; b.style.removeProperty('--drag'); if (dy < -60) play(card); };
      b.addEventListener('pointerup', end); b.addEventListener('pointercancel', end);
      return b;
    }));
    handRects = {}; for (const b of hand.children) handRects[b.dataset.id] = b.firstChild.getBoundingClientRect();
    hand.classList.toggle('watch', me == null);
    // guided practice: an arrow on the thing to click
    const h = v.hint; tip.hide();
    if (h && !g.over) {
      const where = h.one ? oneBtn : h.color && !chooser.hidden ? chooser.querySelector(`[data-color="${h.color}"]`) : h.play != null ? hand.querySelector(`[data-id="${h.play}"]`) : h.draw ? deck : h.pass ? passBtn : null;
      if (where) setTimeout(() => tip.at(where, h.text || ''), 30);
    }
  }
  return {
    update(v) { view = v; if (v.g) paint(v); },
    destroy() { stop(); },
  };
}
export function cardsResults(view, api) {
  const g = view.g; const box = el('div', { class: 'gt-result' });
  box.append(el('h3', { text: g.winner === view.you ? 'You are out of cards — you win! 🎉' : `${seatInfo(view, g.winner, api).name} is out of cards and wins!` }));
  g.ranks.forEach((s, i) => box.append(el('div', { class: 'gt-rank' }, el('b', { text: medal(i) }), el('span', { text: seatInfo(view, s, api).name + (s === view.you ? ' (you)' : '') }), el('i', { text: g.counts[s] ? `${g.counts[s]} card${g.counts[s] === 1 ? '' : 's'} left` : 'no cards left' }))));
  return box;
}
