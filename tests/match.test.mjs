// Rule checks for Colour Match (public/js/games/match3.js). Run from the combined-game folder:
//   node tests/match.test.mjs
//   /System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc -m tests/match.test.mjs
import * as M from '../public/js/games/match3.js';

const log = typeof print === 'function' ? print : console.log;
let failed = 0; let passed = 0;
const ok = (c, msg) => { if (c) { passed++; log('ok   ' + msg); } else { failed++; log('FAIL ' + msg); } };
const seeded = (a) => () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const at = (r, c) => r * 8 + c;
/** A board with no line of three anywhere: colour (c + 2r) mod 6. Then `put` places the gems of a test. */
function board(level = 1, puts = []) {
  const g = M.create(level, seeded(1));
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) g.board[at(r, c)] = { id: g.nextId++, c: (c + 2 * r) % 6, k: '' };
  for (const [r, c, colour, k] of puts) g.board[at(r, c)] = { id: g.nextId++, c: k === 'w' ? -1 : colour, k: k || '' };
  return g;
}
const clearOf = (steps, n = 0) => steps.filter((s) => s.t === 'clear')[n];

// ---------------------------------------------------------------- the board
{
  let fine = true; let moves = true;
  for (let s = 0; s < 40; s++) { const g = M.create(1 + (s % 30), seeded(s)); if (M.runs(g.board).length || g.board.some((x) => !x || x.c < 0 || x.c > 5 || x.k)) fine = false; if (!M.findMove(g.board)) moves = false; }
  ok(fine && moves, 'a new board has 64 plain gems in six colours, no ready-made line, and at least one move');
  ok(M.COLORS.length === 6 && M.N === 8, 'the board is 8 x 8 with six colours');
  ok(M.runs(board().board).length === 0, 'the test board starts without lines');
}
{ // swapping
  const g = board(1, [[7, 0, 1], [7, 1, 1], [6, 2, 1]]); const before = JSON.stringify(g.board);
  ok(M.play(g, at(0, 0), at(0, 1), seeded(2)) === null && JSON.stringify(g.board) === before && g.moves === 20, 'a swap that lines nothing up slides back and costs no move');
  ok(M.play(g, at(0, 0), at(2, 0), seeded(2)) === null, 'only neighbours can be swapped');
  const steps = M.play(g, at(6, 2), at(7, 2), seeded(2)); const c = clearOf(steps);
  ok(steps[0].t === 'swap' && c.cells.slice().sort((a, b) => a - b).join() === [at(7, 0), at(7, 1), at(7, 2)].join() && c.points === 60 && c.combo === 1, 'three in a line clear for 3 x 20 points');
  ok(g.moves === 19 && g.got[1] >= 3 && steps.some((s) => s.t === 'fall') && g.board.every(Boolean) && M.runs(g.board).length === 0, 'the move is used, the colours are counted, gems fall and the board is full and settled again');
}
{ // special gems are made
  let g = board(1, [[7, 0, 1], [7, 1, 1], [7, 3, 1], [6, 2, 1]]); let s = M.play(g, at(6, 2), at(7, 2), seeded(3));
  ok(clearOf(s).made.join() === String(at(7, 2)) && clearOf(s).board[at(7, 2)].k === 'v' && clearOf(s).cells.length === 4, '4 in a line leaves a striped gem where you moved (stripes follow the direction of the swap)');
  g = board(1, [[7, 0, 1], [7, 1, 1], [7, 3, 1], [7, 4, 1], [6, 2, 1]]); s = M.play(g, at(6, 2), at(7, 2), seeded(3));
  ok(clearOf(s).board[at(7, 2)].k === 'w' && clearOf(s).board[at(7, 2)].c === -1, '5 in a line leaves a rainbow gem');
  g = board(1, [[7, 0, 1], [7, 1, 1], [5, 2, 1], [6, 2, 1], [7, 3, 1]]); s = M.play(g, at(7, 3), at(7, 2), seeded(3));
  ok(clearOf(s).board[at(7, 2)].k === 'b' && clearOf(s).cells.length === 5, 'an L of 5 leaves a bomb in the corner');
  g = board(1, [[7, 0, 1], [7, 1, 1], [7, 2, 5], [7, 3, 1], [5, 2, 1], [6, 2, 1], [4, 2, 1]]);
  s = M.play(g, at(4, 2), at(4, 3), seeded(3));
  ok(s === null, 'a swap that only breaks things up is refused');
}
{ // special gems go off
  let g = board(1, [[7, 0, 1, 'h'], [7, 1, 1], [6, 2, 1]]); let s = M.play(g, at(6, 2), at(7, 2), seeded(4));
  ok(clearOf(s).cells.length === 8 && clearOf(s).points === 160 && clearOf(s).fx[0].kind === 'row', 'a striped gem clears its whole row');
  g = board(1, [[7, 0, 1], [7, 1, 1, 'v'], [6, 2, 1]]); s = M.play(g, at(6, 2), at(7, 2), seeded(4));
  ok(clearOf(s).cells.length === 10 && clearOf(s).fx[0].kind === 'col', '…or its whole column');
  g = board(1, [[7, 0, 1], [7, 1, 1, 'b'], [6, 2, 1]]); s = M.play(g, at(6, 2), at(7, 2), seeded(4));
  ok(clearOf(s).cells.length === 6 && clearOf(s).fx[0].kind === 'bomb', 'a bomb clears the 3 x 3 around it');
  g = board(1, [[3, 3, 0, 'w']]); const fours = g.board.filter((x) => x.c === 4).length; s = M.play(g, at(3, 3), at(3, 4), seeded(4));
  ok(clearOf(s).cells.length === fours + 1 && clearOf(s).fx[0].kind === 'color', 'a rainbow gem swapped with a gem clears every gem of that colour');
  g = board(1, [[7, 0, 1, 'h'], [7, 1, 1], [6, 2, 1], [7, 7, 3, 'v']]); s = M.play(g, at(6, 2), at(7, 2), seeded(4));
  ok(clearOf(s).cells.length === 15, 'a special gem caught in a blast goes off too');
}
{ // two specials together
  let g = board(1, [[3, 3, 0, 'h'], [3, 4, 2, 'h']]); let s = M.play(g, at(3, 3), at(3, 4), seeded(5));
  ok(clearOf(s).cells.length === 15, 'striped + striped clears a cross');
  g = board(1, [[3, 3, 0, 'b'], [3, 4, 2, 'v']]); s = M.play(g, at(3, 3), at(3, 4), seeded(5));
  ok(clearOf(s).cells.length === 39, 'bomb + striped clears 3 rows and 3 columns');
  g = board(1, [[3, 3, 0, 'w'], [3, 4, 0, 'w']]); s = M.play(g, at(3, 3), at(3, 4), seeded(5));
  ok(clearOf(s).cells.length === 64 && clearOf(s).points === 64 * 20, 'rainbow + rainbow clears the whole board');
}
{ // combos, goals, ice
  let g = board(1, [[7, 0, 5], [7, 1, 5], [4, 2, 5], [5, 2, 1], [6, 2, 1], [7, 3, 1]]); let s = M.play(g, at(7, 3), at(7, 2), seeded(6));
  const second = clearOf(s, 1);
  ok(second && second.combo === 2 && [at(7, 0), at(7, 1), at(7, 2)].every((i) => second.cells.includes(i)) && second.points === second.cells.length * 40, 'gems that fall into a new line clear as a combo: points x2');
  g = board(16, [[4, 1, 3], [4, 2, 3], [3, 3, 3]]); const total = g.ice.filter(Boolean).length; s = M.play(g, at(3, 3), at(4, 3), seeded(6));
  ok(total === 12 && clearOf(s).ice.length === 3 && g.iceBroken >= 3 && g.ice[at(4, 1)] === 0, 'clearing a gem breaks the ice under it');
  g = board(1, [[7, 0, 1], [7, 1, 1], [6, 2, 1]]); g.score = 990; M.play(g, at(6, 2), at(7, 2), seeded(6));
  ok(g.state === 'won' && M.goalMet(g) && M.starsOf(g) === 1, 'reaching the goal wins the level');
  const left = g.moves; const bonus = M.finish(g, seeded(7));
  ok(left === 19 && g.moves === 0 && g.bonus === 19 && bonus.filter((x) => x.t === 'bonus').length === 19 && g.score > 1050 + 19 * 160 && g.state === 'done', 'every move left over turns into a striped gem that goes off for bonus points');
  ok(M.starsOf(g) === 3, 'stars come from the final score');
  g = board(6, [[7, 0, 3], [7, 1, 3], [6, 2, 3]]); g.moves = 1; M.play(g, at(6, 2), at(7, 2), seeded(6));
  ok(g.state === 'lost' && !M.goalMet(g) && M.starsOf(g) === 0, 'out of moves before the goal: the level is lost (no stars)');
  ok(M.play(g, at(0, 0), at(0, 1), seeded(6)) === null, 'no more moves after the end');
}
{ // no move left -> shuffle
  const g = board(1); const kinds = g.board.map((x) => x.c).sort().join();
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) g.board[at(r, c)].c = ((c % 3) + 3 * (r % 2) + (Math.floor(c / 3) % 2 ? 3 : 0)) % 6;
  const stuck = !M.findMove(g.board); M.reshuffle(g, seeded(8));
  ok(M.findMove(g.board) && M.runs(g.board).length === 0 && g.board.length === 64 && kinds.length > 0, 'shuffling always leaves a move and no ready-made line' + (stuck ? ' (the board was stuck)' : ''));
}
{ // hints and saving
  const g = M.create(7, seeded(9)); const best = M.rankMoves(g);
  ok(best.length > 0 && best[0].value >= best[best.length - 1].value && M.play(M.load(M.save(g)), best[0].a, best[0].b, seeded(1)) !== null, 'the hint is a real move');
  M.play(g, best[0].a, best[0].b, seeded(10)); const s = M.save(g); const back = M.load(JSON.parse(JSON.stringify(s)));
  ok(JSON.stringify(s).length < 600 && back && back.moves === g.moves && back.score === g.score && back.board.map((x) => x.c + x.k).join() === g.board.map((x) => x.c + x.k).join() && back.got.join() === g.got.join(), 'a game in progress is saved small and comes back exactly (same board, same moves left)');
  ok(M.load(null) === null && M.load({ level: 99 }) === null && M.load({ ...s, board: s.board.slice(2) }) === null && M.load({ ...s, board: 'zz' + s.board.slice(2) }) === null && M.load({ ...s, moves: 0 }) === null, 'damaged saves are refused');
}
{ // the 30 levels
  const kind = (L) => (L.goal.ice && L.goal.colors ? 'mixed' : L.goal.ice ? 'ice' : L.goal.colors ? 'colours' : 'score');
  ok(M.LEVELS.length === 30 && M.LEVELS.every((L, i) => L.n === i + 1 && L.moves >= 20 && L.stars[1] < L.stars[2]), '30 levels, each with a number of moves and rising star scores');
  ok(M.LEVELS.slice(0, 5).every((L) => kind(L) === 'score') && M.LEVELS.slice(5, 15).every((L) => kind(L) === 'colours') && M.LEVELS.slice(15, 25).every((L) => kind(L) === 'ice') && M.LEVELS.slice(25).every((L) => kind(L) === 'mixed'),
    'levels 1–5 ask for a score, 6–15 for colours, 16–25 for ice, 26–30 for both');
  ok(M.LEVELS[0].goal.score === 1000 && M.LEVELS[0].moves === 20, 'level 1 is the spec\'s example: 1,000 points in 20 moves');
  const stuck = [];
  for (const L of M.LEVELS) {
    let won = false;
    for (let k = 0; k < 10 && !won; k++) { const rng = seeded(L.n * 100 + k); const g = M.create(L.n, rng); while (g.state === 'play') { const mv = M.rankMoves(g)[0]; M.play(g, mv.a, mv.b, rng); } won = g.state === 'won'; }
    if (!won) stuck.push(L.n);
  }
  ok(stuck.length === 0, 'every level can be won (a simple computer player wins each within 10 tries)' + (stuck.length ? ' — not: ' + stuck.join() : ''));
}

log(`\n${passed} passed, ${failed} failed`);
if (failed) { if (typeof process !== 'undefined') process.exit(1); else throw new Error('tests failed'); }
