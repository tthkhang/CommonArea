// Colour Match ("Ghép màu") screen: the level map, the 8 x 8 board, the result. One player per chair.
// The rules are in match3.js; progress (stars per level, the level in progress) is kept in the player's profile
// through the Game Room ("tro-choi.matchSave" / "matchDone"), so a level can be continued later.
import { el } from '../util.js';
import * as M from './match3.js';
import { pointer } from './common.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** A gem (also used by the rule book). c = colour 0..5 or -1, k = '' | 'h' | 'v' | 'b' | 'w'. */
export function gemEl(c, k) { return el('span', { class: 'm3-gem ' + (k === 'w' ? 'kw' : 'c' + c) + (k && k !== 'w' ? ' k' + k : '') }); }
const goalText = (L) => { const g = L.goal; const parts = []; if (g.score) parts.push(`${g.score.toLocaleString('en')} points`); if (g.ice) parts.push(`break ${g.ice} ice`); if (g.colors) for (const c in g.colors) parts.push(`${g.colors[c]} ${M.COLORS[c].name}`); return parts.join(' + '); };

/** opts: { practice: true } = the guided try-out from the rule book (level 1, nothing is saved). */
export function mountMatch(root, api, opts = {}) {
  let progress = { stars: {}, best: {}, save: null }; let game = null; let busy = false; let sel = null; let idle = 0; let alive = true; let guideLeft = 0; let hintOn = false;
  const gems = new Map();
  const screen = el('div', { class: 'm3-screen' }); root.append(screen);
  const tip = pointer(root);
  const timer = setInterval(() => { if (alive && game && game.state === 'play' && !busy && !hintOn && Date.now() - idle > 5000) showHint(false); }, 500);
  const totalStars = () => Object.values(progress.stars).reduce((a, b) => a + (b | 0), 0);
  const unlocked = (n) => n === 1 || !!progress.stars[n - 1];

  // ---------------------------------------------------------------- the level map
  function showMap() {
    game = null; tip.hide();
    const W = 6; const pts = M.LEVELS.map((L, i) => { const row = Math.floor(i / W); const k = i % W; const col = row % 2 ? W - 1 - k : k; return [8 + col * 16.8 + (row % 2 ? 0 : 0), 90 - row * 19 + Math.sin(i * 1.3) * 2.2]; });
    const path = pts.map(([x, y], i) => (i ? 'L' : 'M') + x + ' ' + (y * 0.62).toFixed(1)).join(' ');
    const map = el('div', { class: 'm3-map' });
    map.innerHTML = `<svg viewBox="0 0 100 62" preserveAspectRatio="none" aria-hidden="true"><path d="${path}" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/><path d="${path}" fill="none" stroke="#C9A24B" stroke-width="1" stroke-dasharray="1.6 1.8" stroke-linecap="round"/></svg>`;
    const next = M.LEVELS.find((L) => !progress.stars[L.n]);
    M.LEVELS.forEach((L, i) => {
      const s = progress.stars[L.n] | 0; const open = unlocked(L.n);
      const b = el('button', { class: 'm3-node' + (open ? '' : ' locked') + (next && next.n === L.n ? ' next' : '') + (L.goal.ice ? ' ice' : ''), type: 'button', title: open ? `Level ${L.n}: ${goalText(L)} in ${L.moves} moves` : 'Finish the level before this one first' },
        el('b', { text: open ? L.n : '🔒' }), el('i', { text: '★'.repeat(s) + '☆'.repeat(3 - s) }));
      b.style.left = pts[i][0] + '%'; b.style.top = pts[i][1] + '%';
      b.addEventListener('click', () => { if (open) start(L.n); else api.toast('Finish level ' + (L.n - 1) + ' first.'); });
      map.append(b);
    });
    map.append(el('span', { class: 'm3-deco a', text: '🏛️' }), el('span', { class: 'm3-deco b', text: '🌿' }), el('span', { class: 'm3-deco c', text: '🏺' }));
    const saved = M.load(progress.save);
    screen.replaceChildren(...[
      el('div', { class: 'm3-top' }, el('b', { text: `⭐ ${totalStars()} / ${M.LEVELS.length * 3}` }), el('span', { text: next ? `Next: level ${next.n} — ${goalText(next)} in ${next.moves} moves` : 'Every level is done. Go for three stars everywhere!' }),
        el('button', { class: 'nut nho xam', type: 'button', text: '🏆 Leaderboard', onclick: () => api.send('matchTop') }),
        el('button', { class: 'nut nho xam', type: 'button', text: '📖 Rules', onclick: () => api.rules() })),
      saved ? el('button', { class: 'nut nho vang m3-continue', type: 'button', text: `▶ Continue level ${saved.level} (${saved.moves} moves left, ${saved.score.toLocaleString('en')} points)`, onclick: () => start(saved.level, saved) }) : null,
      map,
      el('p', { class: 'meta', text: 'No lives, no timers: a lost level can be played again at once. Levels 1–5 ask for points, 6–15 for colours, 16–25 for ice, 26–30 for both.' })].filter(Boolean));
  }

  // ---------------------------------------------------------------- playing a level
  let boardEl; let iceEl; let fxEl; let hud;
  const posOf = (i) => [Math.floor(i / M.N), i % M.N];
  const setPos = (n, r, c) => { n.style.left = (c * 12.5) + '%'; n.style.top = (r * 12.5) + '%'; };
  function apply(board, instant) {
    const live = new Set();
    board.forEach((x, i) => {
      if (!x) return; live.add(x.id); const [r, c] = posOf(i); let n = gems.get(x.id);
      if (!n) {
        n = el('button', { class: 'm3-cell', type: 'button' }, gemEl(x.c, x.k)); n.dataset.id = x.id; gems.set(x.id, n); boardEl.append(n);
        if (x.born && !instant) { n.style.transition = 'none'; setPos(n, r - x.born, c); void n.offsetWidth; n.style.transition = ''; }
      }
      const g = n.firstChild; const cls = 'm3-gem ' + (x.k === 'w' ? 'kw' : 'c' + x.c) + (x.k && x.k !== 'w' ? ' k' + x.k : ''); if (g.className !== cls) { g.className = cls; if (x.k) n.classList.add('made'); }
      n.dataset.i = i; setPos(n, r, c);
    });
    for (const [id, n] of gems) if (!live.has(id)) { gems.delete(id); n.classList.add('pop'); setTimeout(() => n.remove(), 260); }
  }
  function paintIce() { iceEl.replaceChildren(...game.ice.map((v, i) => { if (!v) return null; const [r, c] = posOf(i); const n = el('i', {}); setPos(n, r, c); return n; }).filter(Boolean)); }
  function paintHud() {
    const L = M.LEVELS[game.level - 1]; const g = L.goal; const chips = [];
    if (g.score) chips.push(el('span', { class: 'm3-goal' + (game.score >= g.score ? ' done' : '') }, '🎯 ', el('b', { text: `${Math.min(game.score, g.score).toLocaleString('en')} / ${g.score.toLocaleString('en')}` })));
    if (g.ice) chips.push(el('span', { class: 'm3-goal' + (game.iceBroken >= g.ice ? ' done' : '') }, '🧊 ', el('b', { text: `${Math.min(game.iceBroken, g.ice)} / ${g.ice}` })));
    if (g.colors) for (const c in g.colors) chips.push(el('span', { class: 'm3-goal' + (game.got[c] >= g.colors[c] ? ' done' : '') }, gemEl(Number(c), ''), el('b', { text: `${Math.min(game.got[c], g.colors[c])} / ${g.colors[c]}` })));
    const s = L.stars; const top = s[2] * 1.15; const meter = el('div', { class: 'm3-meter' }, el('i', {}), ...[Math.max(s[0], 0), s[1], s[2]].map((v, k) => { const m = el('b', { text: '★', class: game.score >= v && (k > 0 || M.goalMet(game)) ? 'on' : '' }); m.style.left = Math.min(100, 100 * (k === 0 && !s[0] ? 0.06 : v / top)) + '%'; return m; }));
    meter.firstChild.style.width = Math.min(100, 100 * game.score / top) + '%';
    hud.replaceChildren(el('div', { class: 'm3-info' }, el('b', { text: (opts.practice ? 'Practice' : 'Level ' + game.level) }), el('span', { class: 'm3-moves' }, 'Moves ', el('b', { text: game.moves })), el('span', { class: 'm3-score' }, 'Score ', el('b', { text: game.score.toLocaleString('en') }))), el('div', { class: 'm3-goals' }, ...chips), meter);
  }
  function burst(cells, points, combo) {
    for (const i of cells.slice(0, 40)) { const [r, c] = posOf(i); for (let k = 0; k < 3; k++) { const p = el('i', { class: 'm3-bit' }); p.style.left = (c * 12.5 + 6.25) + '%'; p.style.top = (r * 12.5 + 6.25) + '%'; p.style.setProperty('--dx', (Math.random() * 60 - 30) + 'px'); p.style.setProperty('--dy', (Math.random() * 60 - 40) + 'px'); p.style.background = ['#FFC43D', '#fff', '#8E5BFF', '#22B8A7'][Math.floor(Math.random() * 4)]; fxEl.append(p); setTimeout(() => p.remove(), 520); } }
    if (points) {
      const [r, c] = posOf(cells[Math.floor(cells.length / 2)]); const f = el('b', { class: 'm3-plus', text: '+' + points + (combo > 1 ? '  ×' + combo : '') }); f.style.left = (c * 12.5 + 6.25) + '%'; f.style.top = (r * 12.5 + 3) + '%'; fxEl.append(f); setTimeout(() => f.remove(), 900);
    }
    if (combo >= 3) { boardEl.classList.remove('shake'); void boardEl.offsetWidth; boardEl.classList.add('shake'); const w = el('b', { class: 'm3-wow', text: combo >= 4 ? 'Excellent!' : 'Great!' }); fxEl.append(w); setTimeout(() => w.remove(), 1000); }
  }
  function beams(fx) {
    for (const f of fx || []) {
      const [r, c] = posOf(f.i); const b = el('i', { class: 'm3-beam ' + f.kind + (f.big ? ' big' : '') });
      if (f.kind === 'row') b.style.top = (r * 12.5) + '%'; else if (f.kind === 'col') b.style.left = (c * 12.5) + '%'; else { b.style.left = (c * 12.5 + 6.25) + '%'; b.style.top = (r * 12.5 + 6.25) + '%'; }
      fxEl.append(b); setTimeout(() => b.remove(), 420);
    }
  }
  async function replay(steps, fast) {
    for (const s of steps) {
      if (!alive || !game) return;
      if (s.t === 'swap') { apply(s.board); await sleep(170); }
      else if (s.t === 'clear') { beams(s.fx); burst(s.cells, s.points, s.combo); apply(s.board); paintIce(); paintHud(); await sleep(fast ? 150 : 250); }
      else if (s.t === 'fall') { apply(s.board); await sleep(fast ? 190 : 300); }
      else if (s.t === 'shuffle') { const w = el('b', { class: 'm3-wow', text: 'Shuffle!' }); fxEl.append(w); setTimeout(() => w.remove(), 1000); apply(s.board); await sleep(600); }
      else if (s.t === 'bonus') { apply(s.board); paintHud(); await sleep(140); }
    }
  }
  const clearHint = () => { hintOn = false; for (const n of gems.values()) n.classList.remove('hint'); tip.hide(); };
  function showHint(guided) {
    const best = M.rankMoves(game)[0]; if (!best) return; hintOn = true;
    const a = [...gems.values()].find((n) => Number(n.dataset.i) === best.a); const b = [...gems.values()].find((n) => Number(n.dataset.i) === best.b);
    a?.classList.add('hint'); b?.classList.add('hint');
    if (guided && a) tip.at(a, guideLeft === 3 ? 'Swap these two blinking gems: click one, then the other (or drag it).' : guideLeft === 2 ? 'Again! Four in a line make a striped gem, an L or T makes a bomb, five make a rainbow gem.' : 'One more together — after that you are on your own.');
  }
  async function trySwap(a, b) {
    if (busy || !game || game.state !== 'play') return;
    clearHint(); idle = Date.now(); select(null);
    const na = [...gems.values()].find((n) => Number(n.dataset.i) === a); const nb = [...gems.values()].find((n) => Number(n.dataset.i) === b);
    const steps = M.play(game, a, b, Math.random);
    busy = true;
    if (!steps) { // nothing lines up: the two gems slide over and back
      if (na && nb) { const [ra, ca] = posOf(a); const [rb, cb] = posOf(b); setPos(na, rb, cb); setPos(nb, ra, ca); await sleep(170); setPos(na, ra, ca); setPos(nb, rb, cb); await sleep(170); }
      busy = false; idle = Date.now(); if (guideLeft > 0) showHint(true); return;
    }
    if (guideLeft > 0) guideLeft--;
    await replay(steps);
    if (!alive || !game) return;
    if (game.state === 'won') {
      if (!opts.practice) api.send('matchSave', { save: null });
      if (game.moves > 0) { const w = el('b', { class: 'm3-wow', text: 'Bonus!' }); fxEl.append(w); setTimeout(() => w.remove(), 1000); await sleep(500); await replay(M.finish(game, Math.random), true); } else M.finish(game, Math.random);
      if (!alive || !game) return;
      paintHud(); await sleep(350); showResult(true);
    } else if (game.state === 'lost') { if (!opts.practice) api.send('matchSave', { save: null }); await sleep(350); showResult(false); }
    else { if (!opts.practice) api.send('matchSave', { save: M.save(game) }); if (guideLeft > 0) showHint(true); }
    busy = false; idle = Date.now();
  }
  function select(i) { sel = i; for (const n of gems.values()) n.classList.toggle('sel', i != null && Number(n.dataset.i) === i); }
  function start(level, saved) {
    game = saved || M.create(level, Math.random); gems.clear(); busy = false; sel = null; idle = Date.now();
    guideLeft = !saved && (opts.practice || (level === 1 && !progress.stars[1])) ? 3 : 0;
    boardEl = el('div', { class: 'm3-board' }); iceEl = el('div', { class: 'm3-ice' }); fxEl = el('div', { class: 'm3-fx' }); hud = el('div', { class: 'm3-hud' });
    const L = M.LEVELS[game.level - 1];
    screen.replaceChildren(hud, el('div', { class: 'm3-frame' }, iceEl, boardEl, fxEl),
      el('div', { class: 'm3-foot' }, el('span', { class: 'meta', text: `Goal: ${goalText(L)} in ${L.moves} moves.` }),
        opts.practice ? null : el('button', { class: 'nut nho xam', type: 'button', text: '↻ Restart', onclick: () => { api.send('matchSave', { save: null }); start(game.level); } }),
        el('button', { class: 'nut nho xam', type: 'button', text: opts.practice ? '← Back to the rules' : '← Levels', onclick: () => (opts.practice ? api.back() : showMap()) })));
    apply(game.board.map((x) => ({ ...x })), true); paintIce(); paintHud();
    // click one gem then a neighbour, or drag a gem towards a neighbour
    let down = null;
    boardEl.addEventListener('pointerdown', (e) => { const n = e.target.closest('.m3-cell'); if (!n || busy) return; down = { i: Number(n.dataset.i), x: e.clientX, y: e.clientY, size: n.getBoundingClientRect().width }; });
    boardEl.addEventListener('pointermove', (e) => {
      if (!down) return; const dx = e.clientX - down.x; const dy = e.clientY - down.y; if (Math.max(Math.abs(dx), Math.abs(dy)) < down.size * 0.45) return;
      const [r, c] = posOf(down.i); const horizontal = Math.abs(dx) > Math.abs(dy); const r2 = r + (horizontal ? 0 : Math.sign(dy)); const c2 = c + (horizontal ? Math.sign(dx) : 0); const from = down.i; down = null;
      if (r2 >= 0 && r2 < M.N && c2 >= 0 && c2 < M.N) trySwap(from, r2 * M.N + c2);
    });
    const up = (e) => {
      if (!down) return; const i = down.i; down = null; if (e.type !== 'pointerup') return;
      if (sel == null || sel === i) { select(sel === i ? null : i); idle = Date.now(); } else if (M.adjacent(sel, i)) trySwap(sel, i); else select(i);
    };
    boardEl.addEventListener('pointerup', up); boardEl.addEventListener('pointerleave', up);
    if (guideLeft > 0) setTimeout(() => { if (alive && game && !busy) showHint(true); }, 500);
  }
  function showResult(won) {
    tip.hide(); const stars = M.starsOf(game); const L = M.LEVELS[game.level - 1]; const level = game.level; const score = game.score;
    if (won && !opts.practice) { api.send('matchDone', { level, stars, score }); progress.stars[level] = Math.max(progress.stars[level] | 0, stars); progress.best[level] = Math.max(progress.best[level] | 0, score); progress.save = null; }
    const box = el('div', { class: 'm3-result' + (won ? ' won' : '') },
      el('h3', { text: won ? (opts.practice ? 'Well done — that is the whole game!' : `Level ${level} complete!`) : 'Out of moves' }),
      won ? el('div', { class: 'm3-stars' }, ...[1, 2, 3].map((k) => { const s = el('b', { text: '★', class: k <= stars ? 'on' : '' }); s.style.animationDelay = (k * 0.35) + 's'; return s; })) : el('p', { text: `The goal was: ${goalText(L)}. Try again — there are no lives to lose.` }),
      el('p', { class: 'm3-final', text: `Score ${score.toLocaleString('en')}` + (won && game.bonus ? ` · ${game.bonus} move${game.bonus === 1 ? '' : 's'} left over turned into bonus stripes` : '') }),
      won && stars < 3 ? el('p', { class: 'meta', text: `Two stars from ${L.stars[1].toLocaleString('en')} points, three from ${L.stars[2].toLocaleString('en')}.` }) : null,
      el('div', { class: 'm3-btns' },
        opts.practice ? el('button', { class: 'nut nho vang', type: 'button', text: '← Back to the rules', onclick: () => api.back() }) : null,
        !opts.practice && won && level < M.LEVELS.length ? el('button', { class: 'nut nho vang', type: 'button', text: `Level ${level + 1} ▶`, onclick: () => start(level + 1) }) : null,
        el('button', { class: 'nut nho' + (won ? ' xam' : ' vang'), type: 'button', text: won ? 'Play it again' : 'Try again', onclick: () => start(level) }),
        opts.practice ? null : el('button', { class: 'nut nho xam', type: 'button', text: 'Levels', onclick: showMap })));
    screen.append(el('div', { class: 'm3-over' }, box));
  }
  function showTop(rows, me) {
    const box = el('div', { class: 'm3-result' }, el('h3', { text: '🏆 Colour Match stars' }),
      rows.length ? el('ol', { class: 'm3-toplist' }, ...rows.map((r) => el('li', { class: r.name === me ? 'you' : '' }, el('span', { text: r.name }), el('b', { text: `⭐ ${r.stars}` }), el('i', { text: `${r.levels} level${r.levels === 1 ? '' : 's'}` })))) : el('p', { text: 'Nobody has finished a level yet. Be the first!' }),
      el('div', { class: 'm3-btns' }, el('button', { class: 'nut nho vang', type: 'button', text: 'Close', onclick: (e) => e.target.closest('.m3-over').remove() })));
    screen.append(el('div', { class: 'm3-over' }, box));
  }

  if (opts.practice) start(1); else { screen.append(el('p', { class: 'meta', text: 'Loading your levels…' })); api.send('matchGet'); }
  return {
    /** The saved progress arrived from the Game Room. */
    progress(p) { progress = { stars: { ...(p && p.stars) }, best: { ...(p && p.best) }, save: (p && p.save) || null }; if (!game) showMap(); },
    top(rows, me) { showTop(rows || [], me); },
    destroy() { alive = false; clearInterval(timer); },
  };
}
