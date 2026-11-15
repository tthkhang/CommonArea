// Colour Match rules (spec "Ghép màu"): an 8 x 8 board of six colours. Swap two neighbours to line up 3 or more.
// Pure functions, no DOM: the screen (games/match.js) replays the steps this file returns; tests/match.test.mjs checks it.
//
//   4 in a line          -> striped gem   clears its whole row (or column)
//   L or T shape         -> bomb          clears the 3 x 3 around it
//   5 in a line          -> rainbow gem   swap it with a gem: every gem of that colour goes
//   two specials swapped -> striped + striped = a cross · bomb + striped = 3 rows + 3 columns · rainbow + rainbow = the whole board
//
// A gem is { id, c, k }: c = colour 0..5 (-1 for the rainbow gem), k = '' | 'h' | 'v' (striped) | 'b' (bomb) | 'w' (rainbow).

export const N = 8;
export const POINTS = 20; // per gem, times the combo number (x1, x2, x3 …)
export const COLORS = [
  { id: 'p', name: 'purple', hex: '#8E5BFF' }, { id: 'y', name: 'yellow', hex: '#FFC43D' }, { id: 'r', name: 'coral', hex: '#F2695C' },
  { id: 't', name: 'teal', hex: '#22B8A7' }, { id: 'b', name: 'blue', hex: '#4A7BF0' }, { id: 'g', name: 'green', hex: '#3DBB6B' },
];
const at = (r, c) => r * N + c;
const rowOf = (i) => Math.floor(i / N); const colOf = (i) => i % N;
export const adjacent = (a, b) => Math.abs(rowOf(a) - rowOf(b)) + Math.abs(colOf(a) - colOf(b)) === 1;

// ---------------------------------------------------------------- the 30 levels
const rect = (r0, c0, r1, c1) => { const out = []; for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) out.push(at(r, c)); return out; };
const uniq = (list) => [...new Set(list)].sort((a, b) => a - b);
const ICE = {
  band: uniq(rect(3, 1, 4, 6)),                                             // 12
  heart: uniq(rect(2, 2, 5, 5)),                                            // 16
  wide: uniq(rect(3, 0, 4, 7)),                                             // 16
  bars: uniq([...rect(1, 1, 1, 6), ...rect(4, 1, 4, 6), ...rect(6, 1, 6, 6)]), // 18
  ring: uniq([...rect(1, 1, 1, 6), ...rect(6, 1, 6, 6), ...rect(2, 1, 5, 1), ...rect(2, 6, 5, 6)]), // 20
  pillars: uniq([...rect(0, 2, 7, 2), ...rect(0, 5, 7, 5), ...rect(3, 3, 4, 4)]), // 20
  checks: uniq(Array.from({ length: 64 }, (_, i) => i).filter((i) => (rowOf(i) + colOf(i)) % 2 === 0 && rowOf(i) >= 2 && rowOf(i) <= 6 && colOf(i) >= 1 && colOf(i) <= 6)), // 15
  floor: uniq(rect(6, 1, 7, 6)),                                            // 12
  towers: uniq([...rect(1, 1, 6, 1), ...rect(1, 6, 6, 6)]),                 // 12
  big: uniq(rect(2, 1, 6, 6)),                                              // 30
  cross: uniq([...rect(0, 3, 7, 4), ...rect(3, 0, 4, 7)]),                  // 28
};
const score = (n, moves, target, s2, s3) => ({ n, moves, goal: { score: target }, stars: [target, s2, s3] });
const colours = (n, moves, need, s2, s3) => ({ n, moves, goal: { colors: need }, stars: [0, s2, s3] });
const ice = (n, moves, shape, s2, s3, need) => ({ n, moves, goal: need ? { ice: ICE[shape].length, colors: need } : { ice: ICE[shape].length }, ice: ICE[shape], stars: [0, s2, s3] });
/** goal.colors: { colour index: how many }. stars: the scores for 1, 2 and 3 stars (1 star = the goal is reached). */
export const LEVELS = [
  score(1, 20, 1000, 2500, 4000), score(2, 20, 1500, 2500, 4000), score(3, 22, 2000, 2800, 4500), score(4, 22, 2600, 3000, 4500), score(5, 24, 3200, 3600, 5000),
  colours(6, 22, { 0: 14, 1: 14 }, 2700, 4300), colours(7, 23, { 2: 16, 3: 16 }, 2700, 4300), colours(8, 24, { 4: 18, 5: 18 }, 3200, 5100), colours(9, 26, { 0: 20, 2: 20 }, 2900, 4600), colours(10, 26, { 1: 22, 3: 22 }, 3400, 5500),
  colours(11, 26, { 0: 16, 1: 16, 2: 16 }, 3300, 5300), colours(12, 26, { 3: 17, 4: 17, 5: 17 }, 3000, 4800), colours(13, 27, { 0: 18, 2: 18, 4: 18 }, 3100, 5000), colours(14, 28, { 1: 20, 3: 20, 5: 20 }, 3900, 6300), colours(15, 30, { 0: 30, 1: 30 }, 4000, 6300),
  ice(16, 24, 'band', 3000, 4800), ice(17, 26, 'heart', 3200, 5200), ice(18, 32, 'wide', 3900, 6200), ice(19, 28, 'bars', 3500, 5600), ice(20, 30, 'ring', 3700, 6000),
  ice(21, 30, 'pillars', 4400, 7100), ice(22, 30, 'checks', 4100, 6600), ice(23, 32, 'floor', 4200, 6700), ice(24, 32, 'towers', 4100, 6500), ice(25, 34, 'big', 4500, 7100),
  ice(26, 30, 'band', 4200, 6800, { 2: 30 }), ice(27, 30, 'heart', 3900, 6300, { 0: 32 }), ice(28, 34, 'ring', 4900, 7800, { 2: 40 }), ice(29, 34, 'bars', 4400, 7000, { 4: 34 }), ice(30, 38, 'cross', 4900, 7800, { 1: 36, 5: 36 }),
];

// ---------------------------------------------------------------- boards
const sameAt = (board, i, c) => !!board[i] && board[i].c === c && c >= 0;
/** How many equal colours in a line through cell i, along rows (dc = 1) or columns (dr = 1). */
function lineLen(board, i, dr, dc) {
  const c = board[i] && board[i].c; if (c == null || c < 0) return 0;
  let n = 1; let r = rowOf(i) + dr; let k = colOf(i) + dc;
  while (r >= 0 && r < N && k >= 0 && k < N && sameAt(board, at(r, k), c)) { n++; r += dr; k += dc; }
  r = rowOf(i) - dr; k = colOf(i) - dc;
  while (r >= 0 && r < N && k >= 0 && k < N && sameAt(board, at(r, k), c)) { n++; r -= dr; k -= dc; }
  return n;
}
const matchAt = (board, i) => lineLen(board, i, 0, 1) >= 3 || lineLen(board, i, 1, 0) >= 3;

/** Every line of 3 or more: [{ dir: 'h' | 'v', c, cells }] */
export function runs(board) {
  const out = [];
  const scan = (dir) => {
    for (let a = 0; a < N; a++) {
      let b = 0;
      while (b < N) {
        const cell = (k) => (dir === 'h' ? at(a, k) : at(k, a)); const x = board[cell(b)]; let e = b + 1;
        if (x && x.c >= 0) while (e < N && sameAt(board, cell(e), x.c)) e++;
        if (x && x.c >= 0 && e - b >= 3) { const cells = []; for (let k = b; k < e; k++) cells.push(cell(k)); out.push({ dir, c: x.c, cells }); }
        b = e;
      }
    }
  };
  scan('h'); scan('v'); return out;
}
/** Lines that touch become one shape: { cells, h, v (longest line each way), cross (cells where two lines meet), c, dir } */
function shapes(list) {
  const parent = list.map((_, i) => i); const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) if (list[i].cells.some((x) => list[j].cells.includes(x))) parent[find(i)] = find(j);
  const out = {};
  list.forEach((run, i) => {
    const g = out[find(i)] || (out[find(i)] = { cells: [], h: 0, v: 0, cross: [], c: run.c, dir: run.dir, longest: run });
    for (const x of run.cells) { if (g.cells.includes(x)) g.cross.push(x); else g.cells.push(x); }
    if (run.dir === 'h') g.h = Math.max(g.h, run.cells.length); else g.v = Math.max(g.v, run.cells.length);
    if (run.cells.length > g.longest.cells.length) { g.longest = run; g.dir = run.dir; }
  });
  return Object.values(out);
}
/** Is there any swap that does something? Returns [a, b] or null. */
export function findMove(board) {
  for (let i = 0; i < N * N; i++) for (const j of [i + 1, i + N]) {
    if (j >= N * N || (j === i + 1 && colOf(i) === N - 1)) continue;
    if (swapWorks(board, i, j)) return [i, j];
  }
  return null;
}
function swapWorks(board, a, b) {
  const x = board[a]; const y = board[b]; if (!x || !y || !adjacent(a, b)) return false;
  if (x.k === 'w' || y.k === 'w' || (x.k && y.k)) return true;         // a rainbow gem, or two specials: always a move
  board[a] = y; board[b] = x; const good = matchAt(board, a) || matchAt(board, b); board[a] = x; board[b] = y;
  return good;
}
const randomColor = (rng) => Math.floor(rng() * COLORS.length);
function fillFresh(g, rng) {
  for (let tries = 0; tries < 200; tries++) {
    for (let i = 0; i < N * N; i++) {
      let c; let guard = 0;
      do { c = randomColor(rng); g.board[i] = { id: 0, c, k: '' }; } while (guard++ < 30 && ((colOf(i) >= 2 && sameAt(g.board, i - 1, c) && sameAt(g.board, i - 2, c)) || (rowOf(i) >= 2 && sameAt(g.board, i - N, c) && sameAt(g.board, i - 2 * N, c))));
    }
    if (!runs(g.board).length && findMove(g.board)) break;
  }
  for (const cell of g.board) cell.id = g.nextId++;
}
/** A new game of a level (1..30). rng() gives numbers in [0, 1). */
export function create(level, rng) {
  const L = LEVELS[level - 1];
  const g = { level, board: new Array(N * N).fill(null), ice: new Array(N * N).fill(0), moves: L.moves, score: 0, got: [0, 0, 0, 0, 0, 0], iceBroken: 0, nextId: 1, state: 'play', bonus: 0 };
  for (const i of L.ice || []) g.ice[i] = 1;
  fillFresh(g, rng); return g;
}
const snap = (g) => g.board.map((x) => (x ? { id: x.id, c: x.c, k: x.k, born: x.born || 0 } : null));

// ---------------------------------------------------------------- clearing
/** Clear the cells in `start` and whatever the special gems among them set off. Returns { cleared: Set, fx: [] }. */
function blast(g, start) {
  const cleared = new Set(); const queue = [...start]; const fx = [];
  while (queue.length) {
    const i = queue.pop(); const x = g.board[i]; if (cleared.has(i) || !x) continue;
    cleared.add(i);
    if (x.k === 'h') { fx.push({ kind: 'row', i }); for (let c = 0; c < N; c++) queue.push(at(rowOf(i), c)); }
    else if (x.k === 'v') { fx.push({ kind: 'col', i }); for (let r = 0; r < N; r++) queue.push(at(r, colOf(i))); }
    else if (x.k === 'b') { fx.push({ kind: 'bomb', i }); for (let r = rowOf(i) - 1; r <= rowOf(i) + 1; r++) for (let c = colOf(i) - 1; c <= colOf(i) + 1; c++) if (r >= 0 && r < N && c >= 0 && c < N) queue.push(at(r, c)); }
    else if (x.k === 'w') { // a rainbow gem caught in a blast takes the commonest colour with it
      const count = [0, 0, 0, 0, 0, 0]; g.board.forEach((y, j) => { if (y && y.c >= 0 && !cleared.has(j)) count[y.c]++; });
      const c = count.indexOf(Math.max(...count)); fx.push({ kind: 'color', i, c });
      g.board.forEach((y, j) => { if (y && y.c === c) queue.push(j); });
    }
  }
  return { cleared, fx };
}
/** Remove the cleared gems (keeping the specials that were just made), count the points, the colours and the ice. */
function remove(g, cleared, made, combo) {
  let n = 0; const brokeIce = [];
  for (const i of cleared) {
    const x = g.board[i]; if (!x) continue;
    n++; if (x.c >= 0) g.got[x.c]++;
    if (g.ice[i]) { g.ice[i] = 0; g.iceBroken++; brokeIce.push(i); }
    const m = made.find((y) => y.i === i);
    g.board[i] = m ? { id: x.id, c: m.c, k: m.k } : null;
  }
  const points = n * POINTS * combo; g.score += points;
  return { points, brokeIce };
}
function fall(g, rng) {
  for (let c = 0; c < N; c++) {
    let write = N - 1;
    for (let r = N - 1; r >= 0; r--) { const x = g.board[at(r, c)]; if (x) { if (r !== write) { g.board[at(write, c)] = x; g.board[at(r, c)] = null; } write--; } }
    for (let r = write; r >= 0; r--) g.board[at(r, c)] = { id: g.nextId++, c: randomColor(rng), k: '', born: write + 1 }; // born = how many rows above its place the new gem starts
  }
}
/** The special gem a shape turns into (null for a plain 3). pivot = the cell that was just moved, if it is part of the shape. */
function specialOf(shape, pivots, swapDir) {
  const pivot = pivots.find((p) => shape.cells.includes(p));
  const mid = shape.longest.cells[Math.floor((shape.longest.cells.length - 1) / 2)];
  if (Math.max(shape.h, shape.v) >= 5) return { i: pivot != null ? pivot : mid, k: 'w', c: -1 };
  if (shape.h >= 3 && shape.v >= 3) return { i: shape.cross.length ? shape.cross[0] : mid, k: 'b', c: shape.c };
  if (Math.max(shape.h, shape.v) === 4) return { i: pivot != null ? pivot : mid, k: pivot != null && swapDir ? swapDir : shape.dir, c: shape.c };
  return null;
}
/** After a move: lines clear, gems fall, new lines clear again (combo x2, x3 …). Appends the steps. */
function settle(g, rng, steps, first, pivots, swapDir) {
  let combo = 1; let pending = first; // first = { cleared, fx, made } prepared by the move itself (two specials, a rainbow gem), or null
  for (;;) {
    let made = []; let cleared; let fx;
    if (pending) { ({ cleared, fx } = pending); made = pending.made || []; pending = null; }
    else {
      const sh = shapes(runs(g.board)); if (!sh.length) break;
      const start = new Set(); for (const s of sh) for (const i of s.cells) start.add(i);
      made = sh.map((s) => specialOf(s, combo === 1 ? pivots : [], swapDir)).filter(Boolean);
      ({ cleared, fx } = blast(g, start));
    }
    const cells = [...cleared]; const { points, brokeIce } = remove(g, cleared, made, combo);
    steps.push({ t: 'clear', cells, fx, made: made.map((m) => m.i), points, combo, ice: brokeIce, board: snap(g) });
    fall(g, rng);
    steps.push({ t: 'fall', board: snap(g) }); for (const x of g.board) delete x.born;
    combo++;
  }
  if (!findMove(g.board)) { reshuffle(g, rng); steps.push({ t: 'shuffle', board: snap(g) }); }
  return combo - 1;
}
/** No move left: mix the gems until there is one (and no ready-made line). */
export function reshuffle(g, rng) {
  for (let tries = 0; tries < 300; tries++) {
    for (let i = g.board.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); const t = g.board[i]; g.board[i] = g.board[j]; g.board[j] = t; }
    if (!runs(g.board).length && findMove(g.board)) return;
  }
  const ids = g.board.map((x) => x.id); fillFresh(g, rng); g.board.forEach((x, i) => { x.id = ids[i]; });
}

// ---------------------------------------------------------------- a move
export function goalMet(g) {
  const goal = LEVELS[g.level - 1].goal;
  if (goal.score != null && g.score < goal.score) return false;
  if (goal.ice != null && g.iceBroken < goal.ice) return false;
  if (goal.colors) for (const c in goal.colors) if (g.got[c] < goal.colors[c]) return false;
  return true;
}
export const starsOf = (g) => { const s = LEVELS[g.level - 1].stars; return !goalMet(g) ? 0 : 1 + (g.score >= s[1] ? 1 : 0) + (g.score >= s[2] ? 1 : 0); };
/**
 * Swap two neighbouring gems. Returns the steps to show ([{ t: 'swap' | 'clear' | 'fall' | 'shuffle', board, … }]),
 * or null when the swap lines nothing up (the gems slide back and no move is used).
 */
export function play(g, a, b, rng) {
  if (g.state !== 'play' || !adjacent(a, b) || !g.board[a] || !g.board[b] || !swapWorks(g.board, a, b)) return null;
  const x = g.board[a]; const y = g.board[b]; g.board[a] = y; g.board[b] = x; // x now sits on b, y on a
  const steps = [{ t: 'swap', a, b, board: snap(g) }]; const swapDir = rowOf(a) === rowOf(b) ? 'h' : 'v';
  let first = null;
  const all = () => new Set(g.board.map((_, i) => i));
  const ofColor = (c) => new Set(g.board.map((z, i) => (z && z.c === c ? i : -1)).filter((i) => i >= 0));
  if (x.k === 'w' && y.k === 'w') { x.k = ''; y.k = ''; first = { cleared: all(), fx: [{ kind: 'all', i: b }] }; }
  else if (x.k === 'w' || y.k === 'w') {
    const bow = x.k === 'w' ? x : y; const other = bow === x ? y : x; const where = bow === x ? b : a;
    bow.k = ''; const start = ofColor(other.c); start.add(where);
    const r = blast(g, start); r.fx.unshift({ kind: 'color', i: where, c: other.c }); first = r;
  } else if (x.k && y.k) {
    const kinds = [x.k, y.k]; const start = new Set([a, b]); const r0 = rowOf(b); const c0 = colOf(b); const fx = [];
    const rows = (d) => { for (let r = r0 - d; r <= r0 + d; r++) if (r >= 0 && r < N) { for (let c = 0; c < N; c++) start.add(at(r, c)); fx.push({ kind: 'row', i: at(r, c0) }); } };
    const cols = (d) => { for (let c = c0 - d; c <= c0 + d; c++) if (c >= 0 && c < N) { for (let r = 0; r < N; r++) start.add(at(r, c)); fx.push({ kind: 'col', i: at(r0, c) }); } };
    x.k = ''; y.k = '';
    if (kinds.includes('b') && kinds.some((k) => k === 'h' || k === 'v')) { rows(1); cols(1); }         // bomb + striped: 3 rows and 3 columns
    else if (kinds[0] === 'b' && kinds[1] === 'b') { for (let r = r0 - 2; r <= r0 + 2; r++) for (let c = c0 - 2; c <= c0 + 2; c++) if (r >= 0 && r < N && c >= 0 && c < N) start.add(at(r, c)); fx.push({ kind: 'bomb', i: b, big: true }); }
    else { rows(0); cols(0); }                                                                           // striped + striped: a cross
    const r = blast(g, start); r.fx = fx.concat(r.fx); first = r;
  }
  g.moves--;
  g.lastCombo = settle(g, rng, steps, first, [b, a], swapDir);
  if (goalMet(g)) g.state = 'won'; else if (g.moves <= 0) g.state = 'lost';
  return steps;
}
/** After winning: every move left over turns a gem into a striped gem that goes off (bonus points). */
export function finish(g, rng) {
  const steps = []; if (g.state !== 'won') return steps;
  while (g.moves > 0) {
    g.moves--; g.bonus++;
    const plain = g.board.map((x, i) => (x && !x.k ? i : -1)).filter((i) => i >= 0); if (!plain.length) break;
    const i = plain[Math.floor(rng() * plain.length)]; g.board[i].k = rng() < 0.5 ? 'h' : 'v';
    steps.push({ t: 'bonus', i, board: snap(g) });
    settle(g, rng, steps, blast(g, new Set([i])), [], null);
  }
  g.state = 'done';
  return steps;
}

// ---------------------------------------------------------------- hints, saving
/** The value of each possible swap, best first (used for the blinking hint, the guided practice and the tests). */
export function rankMoves(g) {
  const out = []; const goal = LEVELS[g.level - 1].goal;
  let seed = 12345; const rng = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  for (let i = 0; i < N * N; i++) for (const j of [i + 1, i + N]) {
    if (j >= N * N || (j === i + 1 && colOf(i) === N - 1) || !swapWorks(g.board, i, j)) continue;
    const t = { level: g.level, board: g.board.map((x) => ({ ...x })), ice: g.ice.slice(), moves: g.moves, score: 0, got: g.got.slice(), iceBroken: g.iceBroken, nextId: 1e6, state: 'play', bonus: 0 };
    play(t, i, j, rng);
    let value = t.score + (t.iceBroken - g.iceBroken) * 150;
    if (goal.colors) for (const c in goal.colors) value += Math.max(0, Math.min(goal.colors[c], t.got[c]) - Math.min(goal.colors[c], g.got[c])) * 45;
    out.push({ a: i, b: j, value });
  }
  return out.sort((p, q) => q.value - p.value);
}
const KINDS = '-hvbw';
/** The game in progress as a small object (kept in the player's profile so that it can be continued later). */
export function save(g) {
  return { level: g.level, moves: g.moves, score: g.score, got: g.got.slice(), iceBroken: g.iceBroken,
    board: g.board.map((x) => (x.c < 0 ? 'w' : x.c) + (x.k || '-')).join(''), ice: g.ice.join('') };
}
export function load(s) {
  try {
    if (!s || !LEVELS[s.level - 1] || typeof s.board !== 'string' || s.board.length !== 2 * N * N || typeof s.ice !== 'string' || s.ice.length !== N * N) return null;
    const g = { level: s.level, board: [], ice: s.ice.split('').map((x) => (x === '1' ? 1 : 0)), moves: Math.max(0, Math.min(LEVELS[s.level - 1].moves, s.moves | 0)), score: Math.max(0, s.score | 0),
      got: [0, 1, 2, 3, 4, 5].map((i) => Math.max(0, (s.got && s.got[i]) | 0)), iceBroken: Math.max(0, s.iceBroken | 0), nextId: 1, state: 'play', bonus: 0 };
    for (let i = 0; i < N * N; i++) {
      const c = s.board[2 * i]; const k = s.board[2 * i + 1];
      if (!KINDS.includes(k) || !(c === 'w' || (c >= '0' && c <= '5'))) return null;
      g.board.push({ id: g.nextId++, c: c === 'w' ? -1 : Number(c), k: c === 'w' ? 'w' : k === '-' ? '' : k });
    }
    if (g.moves <= 0 || goalMet(g) || runs(g.board).length) return null;
    return g;
  } catch { return null; }
}
