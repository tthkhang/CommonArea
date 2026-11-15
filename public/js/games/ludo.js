// Ludo ("Cá ngựa") screen: the cross board, the horses, the die. The rules live in shared/games.js and run on the
// server (or in this browser in solo mode); this file only shows what the referee sends and sends back clicks.
import { el } from '../util.js';
import { chip, runClock, LUDO_COLORS, medal, seatInfo } from './common.js';

// ---------------------------------------------------------------- the board, in cells of a 15 x 15 grid
/** The 56 cells of the lap, clockwise, starting on Red's start cell. */
export const TRACK = (() => {
  const t = [];
  for (let x = 0; x <= 5; x++) t.push([x, 6]);
  t.push([6, 6]);
  for (let y = 5; y >= 0; y--) t.push([6, y]);
  t.push([7, 0]);
  for (let y = 0; y <= 5; y++) t.push([8, y]);
  t.push([8, 6]);
  for (let x = 9; x <= 14; x++) t.push([x, 6]);
  t.push([14, 7]);
  for (let x = 14; x >= 9; x--) t.push([x, 8]);
  t.push([8, 8]);
  for (let y = 9; y <= 14; y++) t.push([8, y]);
  t.push([7, 14]);
  for (let y = 14; y >= 9; y--) t.push([6, y]);
  t.push([6, 8]);
  for (let x = 5; x >= 0; x--) t.push([x, 8]);
  t.push([0, 7]);
  return t;
})();
/** The six home cells of each colour, from cell 1 (next to the gate) to cell 6 (next to the centre). */
export const HOMES = [
  [1, 2, 3, 4, 5, 6].map((k) => [k, 7]), [1, 2, 3, 4, 5, 6].map((k) => [7, k]),
  [1, 2, 3, 4, 5, 6].map((k) => [14 - k, 7]), [1, 2, 3, 4, 5, 6].map((k) => [7, 14 - k]),
];
const STABLES = [[0, 0], [9, 0], [9, 9], [0, 9]].map(([x, y]) => [[x + 1.9, y + 1.9], [x + 4.1, y + 1.9], [x + 1.9, y + 4.1], [x + 4.1, y + 4.1]]);
/** Where a horse stands, as the centre of its cell: pos -1 = stable, 0..55 = steps on the lap, 56..61 = home cells. */
export function spot(seat, pos, i) {
  if (pos < 0) return STABLES[seat][i];
  const [x, y] = pos <= 55 ? TRACK[(14 * seat + pos) % 56] : HOMES[seat][pos - 56];
  return [x + 0.5, y + 0.5];
}
const INK = '#2B1F4D';
export function boardSvg() {
  const C = LUDO_COLORS.map((c) => c[1]); const p = [];
  const sq = (x, y, fill, more = '') => `<rect x="${x * 10 + 0.6}" y="${y * 10 + 0.6}" width="8.8" height="8.8" rx="2" fill="${fill}" stroke="${INK}" stroke-width=".7" ${more}/>`;
  const txt = (x, y, s, size = 5, fill = INK) => `<text x="${x * 10 + 5}" y="${y * 10 + 5 + size * 0.36}" font-size="${size}" font-weight="800" text-anchor="middle" fill="${fill}" font-family="'Baloo 2', sans-serif">${s}</text>`;
  [[0, 0], [9, 0], [9, 9], [0, 9]].forEach(([x, y], s) => {
    p.push(`<rect x="${x * 10 + 2}" y="${y * 10 + 2}" width="56" height="56" rx="11" fill="${C[s]}" stroke="${INK}" stroke-width="1.2"/>`);
    p.push(`<rect x="${x * 10 + 9}" y="${y * 10 + 9}" width="42" height="42" rx="9" fill="#FFF9EE" stroke="${INK}" stroke-width="1"/>`);
    for (const [sx, sy] of STABLES[s]) p.push(`<circle cx="${sx * 10}" cy="${sy * 10}" r="5.4" fill="${C[s]}" opacity=".25" stroke="${INK}" stroke-width=".6"/>`);
  });
  TRACK.forEach(([x, y], i) => {
    const start = i % 14 === 0 ? i / 14 : -1; const gate = i % 14 === 13 ? ((i + 1) / 14) % 4 : -1;
    p.push(sq(x, y, start >= 0 ? C[start] : '#FFFFFF'));
    if (start >= 0) p.push(txt(x, y, '▶', 4.4, '#fff').replace('<text', `<text transform="rotate(${[0, 90, 180, 270][start]} ${x * 10 + 5} ${y * 10 + 5})"`));
    if (gate >= 0) p.push(`<rect x="${x * 10 + 2}" y="${y * 10 + 2}" width="6" height="6" rx="1.4" fill="none" stroke="${C[gate]}" stroke-width="1.5"/>`);
  });
  HOMES.forEach((cells, s) => cells.forEach(([x, y], k) => { p.push(sq(x, y, C[s], 'fill-opacity=".5"')); p.push(txt(x, y, k + 1, 5)); }));
  p.push(sq(7, 7, '#FFC43D')); p.push(txt(7, 7, '★', 6));
  return `<svg viewBox="0 0 150 150" class="ld-svg" role="img" aria-label="Ludo board">${p.join('')}</svg>`;
}
/** A horse piece (also used by the rule book). */
export function horseEl(seat) { const h = el('span', { class: 'ld-horse', text: '♞' }); h.style.background = LUDO_COLORS[seat][1]; return h; }

// ---------------------------------------------------------------- the die (a small 3D cube)
const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
const TURN = { 1: [0, 0], 2: [-90, 0], 3: [0, -90], 4: [0, 90], 5: [90, 0], 6: [0, 180] };
export function makeDie() {
  const cube = el('div', { class: 'ld-cube' });
  for (let v = 1; v <= 6; v++) { const face = el('i', { class: 'f' + v }); for (let k = 0; k < 9; k++) face.append(el('b', { class: PIPS[v].includes(k) ? 'on' : '' })); cube.append(face); }
  const node = el('div', { class: 'ld-die' }, cube); let spins = 0;
  return { node, show(v, roll) { if (roll) spins++; const [x, y] = TURN[v] || TURN[1]; cube.style.transform = `rotateX(${x + spins * 720}deg) rotateY(${y + spins * 720}deg)`; } };
}

// ---------------------------------------------------------------- the screen
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export function mountLudo(root, api) {
  let view = null; const shown = {}; const pieces = {}; let lastN = -1; let chain = Promise.resolve(); let selected = null; let alive = true; let dieN = -1;
  const board = el('div', { class: 'ld-board' }); board.innerHTML = boardSvg();
  const layer = el('div', { class: 'ld-layer' }); const target = el('button', { class: 'ld-target', type: 'button', hidden: true, 'aria-label': 'Move here' }); layer.append(target); board.append(layer);
  const die = makeDie(); die.show(1);
  const rollBtn = el('button', { class: 'nut nho vang', type: 'button', text: '🎲 Roll' });
  const dieBox = el('div', { class: 'ld-diebox' }, die.node, rollBtn);
  const seats = el('div', { class: 'gt-seats col' }); const status = el('div', { class: 'gt-status' }); const endBtn = el('button', { class: 'nut nho xam', type: 'button', text: 'End the game', hidden: true });
  root.append(el('div', { class: 'ld-wrap' }, board, el('div', { class: 'ld-side' }, seats, dieBox, status, endBtn)));
  const stop = runClock(root, () => (view && view.clock ? { ...view.clock, total: 20000 } : null), api.now);

  const place = (key, seat, pos, i) => { const [x, y] = spot(seat, pos, i); const h = pieces[key]; h.style.left = (x / 15 * 100) + '%'; h.style.top = (y / 15 * 100) + '%'; shown[key] = pos; };
  const myTurn = () => view && view.you != null && view.g.turn === view.you && !view.g.over;
  const moveOf = (i) => (myTurn() && view.g.phase === 'move' ? view.g.moves.find((m) => m.horse === i) : null);
  function select(i) {
    const m = i == null ? null : moveOf(i); selected = m ? i : null;
    for (const k in pieces) pieces[k].classList.toggle('sel', !!m && k === view.you + ':' + i);
    target.hidden = !m; if (m) { const [x, y] = spot(view.you, m.to, i); target.style.left = (x / 15 * 100) + '%'; target.style.top = (y / 15 * 100) + '%'; }
  }
  const go = (i) => { select(null); api.send('move', { horse: i }); };
  target.addEventListener('click', () => { if (selected != null) go(selected); });
  rollBtn.addEventListener('click', () => { if (myTurn() && view.g.phase === 'roll') { rollBtn.disabled = true; api.send('move', { roll: true }); } });
  endBtn.addEventListener('click', () => { if (endBtn.dataset.sure) api.send('end'); else { endBtn.dataset.sure = '1'; endBtn.textContent = 'Really end it? Click again'; setTimeout(() => { delete endBtn.dataset.sure; endBtn.textContent = 'End the game'; }, 3000); } });

  async function animate(v) {
    const g = v.g; const last = g.last;
    for (const s of g.all) for (let i = 0; i < 4; i++) { // make the pieces once
      const key = s + ':' + i; if (pieces[key]) continue;
      const h = el('button', { class: 'ld-horse', type: 'button', text: '♞', 'aria-label': LUDO_COLORS[s][0] + ' horse ' + (i + 1) }); h.style.background = LUDO_COLORS[s][1];
      h.addEventListener('click', () => { if (view && view.you === s && moveOf(i)) { if (selected === i) go(i); else select(i); } });
      pieces[key] = h; layer.append(h); place(key, s, g.horses[s][i], i);
    }
    if (g.die && g.n !== dieN) { die.show(g.die, lastN >= 0); dieBox.style.setProperty('--c', LUDO_COLORS[last ? last.seat : g.turn][1]); if (lastN >= 0) await sleep(650); }
    dieN = g.n;
    if (last && last.horse != null && g.n !== lastN && lastN >= 0) { // walk the horse cell by cell
      const key = last.seat + ':' + last.horse;
      if (shown[key] === last.from) {
        const path = []; if (last.from < 0 || last.to > 55) path.push(last.to); else for (let q = last.from + 1; q <= last.to; q++) path.push(q);
        pieces[key].classList.add('hop');
        for (const q of path) { if (!alive) return; place(key, last.seat, q, last.horse); await sleep(path.length > 1 ? 130 : 260); }
        pieces[key].classList.remove('hop');
      }
    }
    for (const s of g.all) for (let i = 0; i < 4; i++) { // everything else (a kicked horse flies home)
      const key = s + ':' + i; const pos = g.horses[s][i]; if (shown[key] === pos) continue;
      const kicked = pos < 0 && shown[key] >= 0; if (kicked) { pieces[key].classList.add('kick'); setTimeout(() => pieces[key].classList.remove('kick'), 700); }
      place(key, s, pos, i);
    }
    lastN = g.n;
  }
  function describe(v) {
    const g = v.g; const name = (s) => (s === v.you ? 'You' : seatInfo(v, s, api).name); const l = g.last; let text = '';
    if (l && l.pass) text = `${name(l.seat)} rolled a ${l.die}: no horse can move, so the turn passes${l.die === 6 ? ' — but a 6 rolls again' : ''}. `;
    else if (l && l.capture) text = `${name(l.seat)} kicked ${l.capture.seat === v.you ? 'your' : seatInfo(v, l.capture.seat, api).name + '’s'} horse back to the stable! `;
    else if (l && l.horse != null && l.to >= 56) text = `${name(l.seat)} climbed to home cell ${l.to - 55}. `;
    else if (l && l.horse != null && l.from < 0) text = `${name(l.seat)} brought a horse out. `;
    if (g.over) return text + 'The game is over.';
    if (g.turn === v.you) return text + (g.phase === 'roll' ? 'Your turn — roll the die!' : `You rolled a ${g.die}. Click a glowing horse, then click again (or the marked cell) to move it.`);
    return text + `${seatInfo(v, g.turn, api).name} is ${g.phase === 'roll' ? 'rolling' : 'choosing a horse'}…`;
  }
  function paint(v) {
    const g = v.g;
    seats.replaceChildren(...g.all.map((s) => {
      const homeN = g.horses[s].filter((p) => p >= 56).length; const rank = g.ranks.indexOf(s);
      return chip(v, s, api, { color: LUDO_COLORS[s][1], cls: g.turn === s && !g.over ? 'turn' : '', extra: el('span', { class: 'gt-sub', text: (rank >= 0 ? medal(rank) + ' ' : '') + `🏠 ${homeN}/4 · ${LUDO_COLORS[s][0]}` }) });
    }));
    status.textContent = describe(v);
    rollBtn.disabled = !(myTurn() && g.phase === 'roll'); rollBtn.classList.toggle('mo', rollBtn.disabled);
    for (const s of g.all) for (let i = 0; i < 4; i++) pieces[s + ':' + i].classList.toggle('can', s === v.you && !!moveOf(i));
    if (selected != null && !moveOf(selected)) select(null);
    endBtn.hidden = !(v.you != null && v.you === v.host && !g.over);
  }
  return {
    update(v) { view = v; if (!v.g) return; chain = chain.then(() => (alive ? animate(v) : null)).then(() => { if (alive && view === v) paint(v); }).catch(() => {}); if (lastN < 0) chain.then(() => alive && paint(view)); },
    destroy() { alive = false; stop(); },
  };
}
/** The result box: the ranking. */
export function ludoResults(view, api) {
  const g = view.g; const box = el('div', { class: 'gt-result' });
  box.append(el('h3', { text: g.home.length ? `${seatInfo(view, g.ranks[0], api).name} ${g.ranks[0] === view.you ? '— you win! 🎉' : 'wins!'}` : 'The host ended the game early' }));
  if (!g.home.length) box.append(el('p', { class: 'meta', text: 'Nobody had all four horses home yet, so there is no winner. The ranking shows how far the horses were.' }));
  g.ranks.forEach((s, i) => box.append(el('div', { class: 'gt-rank' }, el('b', { text: medal(i) }), horseEl(s), el('span', { text: seatInfo(view, s, api).name + (s === view.you ? ' (you)' : '') }), el('i', { text: `${g.horses[s].filter((p) => p >= 56).length}/4 home` }))));
  return box;
}
