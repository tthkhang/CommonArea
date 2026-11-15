// Rule checks for the Game Room referee (public/shared/games.js): Ludo, Colour Cards, Werewolf, and the shared
// tables (lobby, host, computer players, turn clock, spectators, table chat, results, saved games).
// Run from the combined-game folder with either:
//   node tests/games.test.mjs
//   /System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc -m tests/games.test.mjs
import * as L from '../public/js/logic.js';

let Room; let G;
const inJsc = typeof load === 'function' && typeof process === 'undefined';
if (inJsc) {
  globalThis.self = globalThis;
  ['catalog', 'quiz', 'games', 'roomplugins', 'room'].forEach((f) => load('public/shared/' + f + '.js'));
  Room = globalThis.CampusRoom; G = globalThis.CampusGames;
} else {
  const { createRequire } = await import('node:module'); const req = createRequire(import.meta.url);
  Room = req('../public/shared/room.js'); G = req('../public/shared/games.js');
}
const log = typeof print === 'function' ? print : console.log;
let failed = 0; let passed = 0;
const ok = (c, msg) => { if (c) { passed++; log('ok   ' + msg); } else { failed++; log('FAIL ' + msg); } };
const { Ludo, Cards, Werewolf } = G;
const seeded = (a) => () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const die = (d) => () => (d - 0.5) / 6;

// ================================================================ Ludo
{
  const st = Ludo.create([0, 1, 2, 3]);
  ok(Ludo.cell(0, 0) === 0 && Ludo.cell(1, 0) === 14 && Ludo.cell(3, 55) === 41 && Ludo.cell(2, 30) === 2, 'Ludo: the four colours start a quarter of the lap apart');
  ok(Ludo.roll(st, 1, die(6)) === null, 'Ludo: rolling out of turn does nothing');
  ok(Ludo.roll(st, 0, die(3)) === 3 && st.last.pass && st.turn === 1, 'Ludo: a 3 cannot leave the stable, the turn passes');
  Ludo.roll(st, 1, die(6));
  ok(st.phase === 'move' && st.moves.length === 4 && st.moves.every((m) => m.to === 0), 'Ludo: a 6 lets a horse out');
  ok(!Ludo.move(st, 0, 0) && Ludo.move(st, 1, 2) && st.horses[1][2] === 0, 'Ludo: only the player to move may move; the horse stands on the start cell');
  ok(st.turn === 1 && st.phase === 'roll', 'Ludo: a 6 rolls again');
  Ludo.roll(st, 1, die(1));
  ok(st.moves.length === 1 && st.moves[0].horse === 2, 'Ludo: no second horse may enter while your own horse stands on the start cell');
  Ludo.move(st, 1, 2);
  ok(st.horses[1][2] === 1 && st.turn === 2, 'Ludo: a 1 moves one step and the turn passes');
  Ludo.roll(st, 2, die(1)); Ludo.move(st, 2, 0);
  ok(st.horses[2][0] === 0 && st.turn === 3, 'Ludo: a 1 also lets a horse out');
}
{ // kicking, blocking, stacking
  const mk = (h0, h1) => { const st = Ludo.create([0, 1]); st.horses[0] = h0; st.horses[1] = h1; return st; };
  let st = mk([5, -1, -1, -1], [50, -1, -1, -1]);              // seat 1's horse stands on cell (14 + 50) % 56 = 8
  Ludo.roll(st, 0, die(3)); Ludo.move(st, 0, 0);
  ok(st.horses[0][0] === 8 && st.horses[1][0] === -1 && st.last.capture.seat === 1, 'Ludo: landing exactly on an opponent sends that horse home');
  st = mk([5, -1, -1, -1], [49, -1, -1, -1]);                  // blocker on cell 7
  Ludo.roll(st, 0, die(3));
  ok(st.last.pass && st.turn === 1 && st.horses[0][0] === 5, 'Ludo: no jumping over a horse in the way (no legal move: the turn passes)');
  st = mk([5, 8, -1, -1], [-1, -1, -1, -1]);
  ok(Ludo.legal(st, 0, 3).map((m) => m.horse).join() === '1', 'Ludo: no stacking on your own horse');
  ok(Ludo.legal(st, 0, 6).map((m) => m.horse).join() === '1,2,3', 'Ludo: your own horse blocks the way too; with a 6 the others may enter');
  st = mk([-1, -1, -1, -1], [-1, -1, -1, -1]); st.horses[0][0] = 14; st.turn = 1; // seat 0 stands on seat 1's start cell
  Ludo.roll(st, 1, die(6)); Ludo.move(st, 1, 0);
  ok(st.horses[0][0] === -1 && st.horses[1][0] === 0, 'Ludo: entering onto an opponent on your start cell kicks it');
}
{ // the gate and the home column
  const st = Ludo.create([0, 1]);
  st.horses[0] = [52, -1, -1, -1];
  ok(Ludo.legal(st, 0, 4).length === 0 && Ludo.legal(st, 0, 3)[0].to === Ludo.GATE, 'Ludo: a horse must stop exactly on the cell in front of its home column');
  st.horses[0] = [55, -1, -1, -1];
  ok(Ludo.legal(st, 0, 2).length === 0 && Ludo.legal(st, 0, 1)[0].to === 56, 'Ludo: home cell 1 needs a 1');
  st.horses[0] = [56, -1, -1, -1];
  ok(Ludo.legal(st, 0, 1).every((m) => m.from === -1) && Ludo.legal(st, 0, 3).length === 0 && Ludo.legal(st, 0, 2)[0].to === 57, 'Ludo: from cell 1 to cell 2 needs a 2');
  st.horses[0] = [60, 61, -1, -1];
  ok(Ludo.legal(st, 0, 6).filter((m) => m.from >= 56).length === 0, 'Ludo: a home cell holds one horse; cell 6 is the end');
  st.horses[0] = [61, 60, 59, 55];
  Ludo.roll(st, 0, die(1)); Ludo.move(st, 0, 3);
  ok(st.over && st.ranks.join() === '0,1', 'Ludo: all four horses in the home column wins; with two players the game ends');
}
{ // three players: the others play on for second place, or the host ends the game
  const st = Ludo.create([0, 1, 3]);
  st.horses[0] = [61, 60, 59, 55]; st.horses[1] = [10, -1, -1, -1]; st.horses[3] = [30, 20, -1, -1];
  Ludo.roll(st, 0, die(1)); Ludo.move(st, 0, 3);
  ok(!st.over && st.ranks.join() === '0' && st.order.join() === '1,3' && st.turn === 1, 'Ludo: after the winner, the others play on');
  Ludo.roll(st, 1, die(2)); Ludo.move(st, 1, 0);
  ok(st.turn === 3, 'Ludo: the finished player is skipped');
  Ludo.end(st);
  ok(st.over && st.ranks.join() === '0,3,1', 'Ludo: ending early ranks the rest by how far their horses are');
}
{ // computer player
  let st = Ludo.create([0, 1]); st.horses[0] = [5, 30, -1, -1]; st.horses[1] = [50, -1, -1, -1];
  Ludo.roll(st, 0, die(3));
  ok(Ludo.bot(st, 0) === 0, 'Ludo computer: kicks when it can');
  st = Ludo.create([0, 1]); st.horses[0] = [55, 30, -1, -1]; Ludo.roll(st, 0, die(1));
  ok(Ludo.bot(st, 0) === 0, 'Ludo computer: climbs home before anything else');
  st = Ludo.create([0, 1]); st.horses[0] = [20, -1, -1, -1]; Ludo.roll(st, 0, die(6));
  ok(st.horses[0][Ludo.bot(st, 0)] === -1, 'Ludo computer: brings a new horse out before walking');
  const rng = seeded(7); st = Ludo.create([0, 1, 2, 3]); let steps = 0; let clash = false;
  while (!st.over && steps++ < 400000) {
    if (st.phase === 'roll') Ludo.roll(st, st.turn, rng); else Ludo.move(st, st.turn, Ludo.bot(st, st.turn));
    const seen = new Set(); for (const s of st.all) for (const p of st.horses[s]) if (p >= 0 && p <= 55) { const c = Ludo.cell(s, p); if (seen.has(c)) clash = true; seen.add(c); }
  }
  ok(st.over && st.ranks.length === 4 && !clash, 'Ludo: four computer players finish a whole game (' + steps + ' steps), never two horses on one cell');
}

// ================================================================ Colour Cards
const rig = (hands, top, next = []) => { // hands: 7 cards each as [colour, value]; next: the cards drawn first, in order
  const pool = Cards.deck(); const take = ([c, v]) => pool.splice(pool.findIndex((x) => x.c === c && x.v === v), 1)[0];
  const H = hands.map((h) => h.map(take)); const T = take(top); const D = next.map(take); const seq = [];
  for (let k = 0; k < 7; k++) for (const h of H) seq.push(h[k]);
  return [...pool, ...D.reverse(), T, ...seq.reverse()];
};
const has = (st, seat, c, v) => st.hands[seat].find((x) => x.c === c && x.v === v);
{
  const d = Cards.deck(); const n = (f) => d.filter(f).length;
  ok(d.length === 108 && new Set(d.map((c) => c.id)).size === 108, 'Cards: 108 cards');
  ok(n((c) => c.v === '0') === 4 && n((c) => /^[1-9]$/.test(c.v)) === 72 && n((c) => c.v === 'skip') === 8 && n((c) => c.v === 'rev') === 8 && n((c) => c.v === '+2') === 8 && n((c) => c.v === 'wild') === 4 && n((c) => c.v === '+4') === 4,
    'Cards: 4 zeros, two of each 1–9, 8 Skip, 8 Reverse, 8 +2, 4 Wild, 4 Wild +4');
  const st = Cards.create([0, 1, 2, 3], seeded(3));
  ok(st.all.every((s) => st.hands[s].length === 7) && /^\d$/.test(st.top.v) && st.draw.length === 108 - 28 - 1, 'Cards: seven each, and the first face-up card is a number card');
}
{
  const rng = seeded(11); let now = 1000;
  const st = Cards.create([0, 1, 2], rng, rig([
    [['p', '1'], ['p', 'skip'], ['y', '5'], ['r', 'rev'], ['t', '+2'], ['w', 'wild'], ['w', '+4']],
    [['p', '2'], ['y', '2'], ['r', '2'], ['t', '2'], ['p', '3'], ['y', '3'], ['r', '3']],
    [['p', '4'], ['y', '4'], ['r', '4'], ['t', '4'], ['p', '6'], ['y', '6'], ['r', '6']],
  ], ['p', '5'], [['t', '9'], ['t', '8'], ['t', '7'], ['t', '6'], ['t', '5']]));
  const play = (seat, c, v, color) => Cards.play(st, seat, has(st, seat, c, v).id, color, now, rng);
  ok(st.top.c === 'p' && st.top.v === '5' && st.turn === 0, 'Cards: the prepared deal is on the table');
  ok(play(1, 'p', '2') !== '' && st.hands[1].length === 7, 'Cards: playing out of turn is refused');
  ok(play(0, 't', '+2') !== '' && st.hands[0].length === 7, 'Cards: a card of another colour and symbol is refused');
  ok(/\+4/.test(play(0, 'w', '+4', 'r')), 'Cards: a +4 is refused while you hold a card of the colour in play');
  ok(play(0, 'y', '5') === '' && st.color === 'y' && st.turn === 1, 'Cards: the same number on another colour is fine');
  play(1, 'y', '2'); play(2, 'y', '4');
  ok(play(0, 'w', 'wild') !== '' && play(0, 'w', 'wild', 'p') === '' && st.color === 'p' && st.turn === 1, 'Cards: a Wild needs a colour, then sets it');
  play(1, 'p', '2'); play(2, 'p', '4');
  ok(play(0, 'p', 'skip') === '' && st.turn === 2, 'Cards: Skip — the next player misses the turn');
  play(2, 'p', '6'); play(0, 'p', '1'); play(1, 'p', '3');
  ok(Cards.playable(st, 2).length === 0 && Cards.draw(st, 2, rng) && st.hands[2].length === 5 && st.turn === 0, 'Cards: nothing to play — draw one; it does not fit, so the turn passes');
  ok(play(0, 'w', '+4', 'r') === '' && st.hands[1].length === 8 && st.turn === 2 && st.color === 'r', 'Cards: +4 (no card of the colour in hand) — the next player draws 4 and misses the turn');
  play(2, 'r', '4');
  ok(play(0, 'r', 'rev') === '' && st.dir === -1 && st.turn === 2, 'Cards: Reverse turns the direction of play');
  play(2, 'r', '6');
  ok(st.turn === 1, 'Cards: play now runs the other way round');
  ok(st.all.reduce((a, s) => a + st.hands[s].length, 0) + st.draw.length + st.pile.length === 108, 'Cards: no card is lost or doubled');
}
{ // two players, "One card!", drawing, winning
  const rng = seeded(5); let now = 50000;
  const st = Cards.create([0, 1], rng, rig([
    [['p', '1'], ['p', 'rev'], ['p', 'skip'], ['p', '+2'], ['y', '1'], ['r', '1'], ['t', '1']],
    [['y', '3'], ['y', '4'], ['r', '3'], ['r', '4'], ['t', '3'], ['t', '4'], ['t', '6']],
  ], ['p', '5'], [['p', '7'], ['p', '8'], ['r', '9'], ['p', '9']]));
  const play = (seat, c, v, color) => Cards.play(st, seat, has(st, seat, c, v).id, color, now, rng);
  ok(play(0, 'p', 'rev') === '' && st.turn === 0, 'Cards: with two players Reverse works like Skip');
  ok(play(0, 'p', 'skip') === '' && st.turn === 0, 'Cards: Skip with two players — you play again');
  ok(play(0, 'p', '+2') === '' && st.hands[1].length === 9 && st.turn === 0, 'Cards: +2 — the next player draws 2 and misses the turn (no stacking)');
  play(0, 'p', '1');
  ok(st.turn === 1, 'Cards: a number card passes the turn');
  const before = st.hands[1].length; play(1, 'p', '7');             // seat 1 drew p7 and p8 with the +2
  ok(st.hands[1].length === before - 1 && st.turn === 0, 'Cards: the cards drawn earlier can be played on a later turn');
  Cards.draw(st, 0, rng);                                            // seat 0 holds y1 r1 t1: nothing fits p7; draws r9: no
  ok(st.turn === 1 && st.drawn == null, 'Cards: an unplayable drawn card ends the turn');
  play(1, 'p', '8');
  Cards.draw(st, 0, rng);                                            // draws p9: fits
  ok(st.turn === 0 && st.drawn != null && Cards.playable(st, 0).length === 1 && !Cards.draw(st, 0, rng), 'Cards: a playable drawn card may be played at once (and only that card); no second draw');
  ok(Cards.pass(st, 0) && st.turn === 1 && st.drawn == null, 'Cards: …or kept, passing the turn');
  // "One card!"
  st.turn = 0; st.hands[0] = [has(st, 0, 'p', '9'), has(st, 0, 'y', '1')]; st.color = 'p';
  play(0, 'p', '9');
  ok(st.one && st.one.seat === 0 && st.one.until === now + 3000, 'Cards: playing down to one card starts the 3-second "One card!" clock');
  ok(Cards.catchOne(st, 1, now + 1000, rng) === null, 'Cards: no catching during those 3 seconds');
  ok(Cards.catchOne(st, 1, now + 3100, rng) === 0 && st.hands[0].length === 3, 'Cards: forgot "One card!" and got caught — draw 2');
  st.turn = 0; st.hands[0] = [has(st, 0, 'y', '1'), st.hands[0][1]]; st.hands[0][1].c = 'p'; st.hands[0][1].v = '2'; st.color = 'p';
  play(0, 'p', '2');
  ok(Cards.callOne(st, 0) && Cards.catchOne(st, 1, now + 9000, rng) === null, 'Cards: after "One card!" nobody can catch you');
  st.turn = 0; st.color = 'y';
  ok(play(0, 'y', '1') === '' && st.over && st.winner === 0 && st.ranks.join() === '0,1', 'Cards: the first player out of cards wins');
  ok(Cards.play(st, 1, st.hands[1][0].id, 'p', now, rng) !== '', 'Cards: nothing can be played after the end');
}
{ // the deck runs out; computer players
  const rng = seeded(9); const st = Cards.create([0, 1], rng);
  st.pile = st.pile.concat(st.draw.splice(0, st.draw.length)); st.top = st.pile[st.pile.length - 1];
  const n = st.pile.length; Cards.give(st, 0, 3, rng);
  ok(st.hands[0].length === 10 && st.pile.length === 1 && st.draw.length === n - 1 - 3 && st.pile[0] === st.top, 'Cards: when the deck is empty the played cards (except the top one) become the new deck');
  const b = Cards.create([0, 1, 2], rng, rig([
    [['p', '1'], ['p', '2'], ['y', '9'], ['y', '8'], ['y', '7'], ['y', 'skip'], ['w', 'wild']],
    [['r', '1'], ['r', '2'], ['r', '3'], ['r', '4'], ['r', '5'], ['r', '6'], ['r', '7']],
    [['t', '1'], ['t', '2'], ['t', '3'], ['t', '4'], ['t', '5'], ['t', '6'], ['t', '7']],
  ], ['y', '5']));
  let m = Cards.bot(b, 0);
  ok(b.hands[0].find((c) => c.id === m.play).c === 'y' && b.hands[0].find((c) => c.id === m.play).v !== 'wild', 'Cards computer: plays the colour it holds most of and keeps the Wild');
  b.hands[1] = b.hands[1].slice(0, 2); m = Cards.bot(b, 0);
  ok(b.hands[0].find((c) => c.id === m.play).v === 'skip', 'Cards computer: an action card when the next player is nearly out');
  b.color = 't'; b.top = { id: -1, c: 't', v: '0' }; b.hands[0] = b.hands[0].filter((c) => c.c !== 'w');
  ok(Cards.bot(b, 0).draw === true, 'Cards computer: draws when nothing fits');
  let games = 0; let lost = false;
  for (let g = 0; g < 20; g++) {
    const r = seeded(100 + g); const s = Cards.create([0, 1, 2, 3].slice(0, 2 + (g % 3)), r); let now = 0; let steps = 0;
    while (!s.over && steps++ < 5000) {
      now += 1000; const seat = s.turn; const mv = Cards.bot(s, seat);
      if (mv.play != null) { if (Cards.play(s, seat, mv.play, mv.color, now, r)) { lost = true; break; } Cards.callOne(s, seat); } else if (mv.draw) Cards.draw(s, seat, r); else Cards.pass(s, seat);
      if (s.all.reduce((a, x) => a + s.hands[x].length, 0) + s.draw.length + s.pile.length !== 108) lost = true;
    }
    if (s.over) games++;
  }
  ok(games === 20 && !lost, 'Cards: 20 whole games between computer players end with a winner; every move legal, 108 cards throughout');
}

// ================================================================ Werewolf
{
  const count = (n, role) => Werewolf.ROLES[n].filter((r) => r === role).length;
  ok([6, 7, 8, 9, 10].map((n) => count(n, 'wolf')).join() === '2,2,2,3,3' && [6, 7, 8, 9, 10].map((n) => count(n, 'villager')).join() === '2,2,3,3,4'
    && [6, 7, 8, 9, 10].map((n) => count(n, 'witch')).join() === '0,1,1,1,1' && [6, 7, 8, 9, 10].every((n) => Werewolf.ROLES[n].length === n && count(n, 'seer') === 1 && count(n, 'guard') === 1),
  'Werewolf: the role table for 6 to 10 players');
  let now = 1000000; const rng = seeded(21);
  const st = Werewolf.create([0, 1, 2, 3, 4, 5, 6, 7].map((s) => ({ seat: s, name: 'P' + s })), now, rng);
  ['wolf', 'wolf', 'seer', 'guard', 'witch', 'villager', 'villager', 'villager'].forEach((r, i) => { st.players[i].role = r; });
  const go = () => { now = st.until; Werewolf.advance(st, now, rng); };
  ok(st.phase === 'guard' && st.until - now === 20000 && st.night === 1, 'Werewolf: the first night starts with the Guard (20 s)');
  ok(Werewolf.act(st, 2, { target: 0 }) !== '' && Werewolf.act(st, 3, { target: 7 }) === '', 'Werewolf: only the Guard acts in the Guard step');
  go(); ok(st.phase === 'wolf' && st.until - now === 40000, 'Werewolf: then the Werewolves (40 s)');
  ok(Werewolf.act(st, 0, { target: 1 }) !== '' && Werewolf.act(st, 5, { target: 0 }) !== '', 'Werewolf: wolves cannot bite a wolf; villagers cannot bite');
  Werewolf.act(st, 0, { target: 5 }); Werewolf.act(st, 1, { target: 6 }); Werewolf.act(st, 1, { target: 5 });
  ok(Werewolf.channel(st, 0) === 'wolf' && Werewolf.channel(st, 5) === null && Werewolf.hears(st, 1, 'wolf') && !Werewolf.hears(st, 5, 'wolf') && !Werewolf.hears(st, null, 'wolf'), 'Werewolf: at night only the wolves talk, in their own channel');
  ok(Werewolf.view(st, 1).wolfVotes[0] === 5 && Werewolf.view(st, 5).wolfVotes === null, 'Werewolf: wolves see each other\'s choice; nobody else does');
  go(); ok(st.phase === 'witch' && st.bitten === 5 && Werewolf.view(st, 4).bitten === 5 && Werewolf.view(st, 5).bitten === null, 'Werewolf: the Witch (and only she) learns who was bitten');
  ok(Werewolf.act(st, 4, { potion: 'heal' }) === '' && Werewolf.act(st, 4, { potion: 'poison', target: 0 }) !== '', 'Werewolf: the Witch heals — one choice a night');
  go(); ok(st.phase === 'seer', 'Werewolf: then the Seer');
  ok(Werewolf.act(st, 2, { target: 2 }) !== '' && Werewolf.act(st, 2, { target: 0 }) === '' && Werewolf.act(st, 2, { target: 1 }) !== '', 'Werewolf: the Seer looks at one other player a night');
  ok(Werewolf.view(st, 2).seen[0].wolf === true && Werewolf.view(st, 5).seen === null, 'Werewolf: the Seer learns "Werewolf or not"; nobody else sees it');
  go(); ok(st.phase === 'announce' && st.morning.length === 0 && st.until - now === 5000 && Werewolf.alive(st).length === 8, 'Werewolf: healed — a quiet night is announced (5 s)');
  go(); ok(st.phase === 'talk' && st.until - now === 120000 && Werewolf.channel(st, 5) === 'day', 'Werewolf: two minutes of discussion in the table chat');
  go(); ok(st.phase === 'vote' && st.until - now === 30000, 'Werewolf: then 30 s of voting');
  ok(Werewolf.act(st, 5, { target: 5 }) !== '', 'Werewolf: no voting for yourself');
  Werewolf.act(st, 5, { target: 1 }); Werewolf.act(st, 5, { target: 0 }); Werewolf.act(st, 6, { target: 0 }); Werewolf.act(st, 0, { target: 5 }); Werewolf.act(st, 1, { target: 5 });
  ok(Werewolf.view(st, 7).counts[0] === 2 && Werewolf.view(st, 7).counts[5] === 2 && Werewolf.view(st, 5).vote === 0, 'Werewolf: votes can be changed and everyone sees the running count');
  go(); ok(st.phase === 'result' && st.hanged === null, 'Werewolf: a tie — nobody is voted out');
  go(); ok(st.phase === 'guard' && st.night === 2 && Werewolf.alive(st).length === 8, 'Werewolf: night falls again');
  ok(Werewolf.act(st, 3, { target: 7 }) !== '' && Werewolf.act(st, 3, { target: 3 }) === '', 'Werewolf: the Guard may not protect the same player two nights running, but may protect themself');
  go(); Werewolf.act(st, 0, { target: 3 }); Werewolf.act(st, 1, { target: 3 });
  go(); ok(Werewolf.act(st, 4, { potion: 'heal' }) !== '' && Werewolf.act(st, 4, { potion: 'poison', target: 4 }) !== '' && Werewolf.act(st, 4, { potion: 'poison', target: 0 }) === '', 'Werewolf: each potion works once; the poison is for someone else');
  go(); Werewolf.act(st, 2, { target: 1 });
  go(); ok(st.morning.join() === '0' && !Werewolf.get(st, 0).alive && Werewolf.get(st, 3).alive, 'Werewolf: the Guard blocks the bite; the poison kills');
  ok(Werewolf.view(st, 5).players[0].role === 'wolf' && Werewolf.view(st, 5).players[1].role === null && Werewolf.view(st, null).players[1].role === null, 'Werewolf: the dead show their role; the living stay secret, also for spectators');
  ok(Werewolf.view(st, 0).players.every((p) => p.role) && Werewolf.channel(st, 0) === 'ghost' && Werewolf.hears(st, 0, 'ghost') && !Werewolf.hears(st, 5, 'ghost'), 'Werewolf: ghosts see every role and have a chat of their own');
  ok(Werewolf.view(st, 5).players[5].role === 'villager' && Werewolf.view(st, 1).players[0].role === 'wolf' && Werewolf.view(st, 5).timeline === null, 'Werewolf: you know your own role; wolves know each other; no timeline before the end');
  go(); go();
  for (const s of [2, 3, 4, 5, 6, 7]) Werewolf.act(st, s, { target: 1 });
  ok(Werewolf.ready(st) === false, 'Werewolf: the vote waits for everybody alive (the wolf has not voted)');
  go(); ok(st.phase === 'result' && st.hanged === 1 && st.until - now === 10000, 'Werewolf: most votes — voted out (result shown 10 s)');
  go(); ok(st.phase === 'words' && st.until - now === 15000 && Werewolf.channel(st, 1) === 'day' && Werewolf.channel(st, 5) === null && Werewolf.get(st, 1).alive, 'Werewolf: 15 s for the last words (only that player speaks)');
  go(); ok(st.over && st.winner === 'village' && st.phase === 'over', 'Werewolf: no Werewolf left — the village wins');
  const end = Werewolf.view(st, 5);
  ok(end.players.every((p) => p.role) && end.timeline.length === 2 && end.timeline[0].by === 'witch' && end.timeline[1].by === 'guard' && end.timeline[1].poisoned === 0 && end.timeline[1].seen === 1, 'Werewolf: the end shows every role and the timeline of each night');
}
{
  let now = 5000; const rng = seeded(4);
  const st = Werewolf.create([0, 1, 2, 3, 4, 5].map((s) => ({ seat: s, name: 'P' + s })), now, rng);
  ['wolf', 'wolf', 'seer', 'guard', 'villager', 'villager'].forEach((r, i) => { st.players[i].role = r; });
  const go = () => { now = st.until; Werewolf.advance(st, now, rng); };
  go(); Werewolf.act(st, 0, { target: 4 }); Werewolf.act(st, 1, { target: 5 });
  go(); ok(st.phase === 'seer' && (st.bitten === 4 || st.bitten === 5), 'Werewolf: with 6 players there is no Witch step; a wolf tie is settled at random');
  go(); go(); go(); for (const s of [0, 1]) Werewolf.act(st, s, { target: 2 }); Werewolf.act(st, 2, { target: 0 });
  go(); go(); go();
  ok(st.over && st.winner === 'wolves', 'Werewolf: as many wolves as others — the wolves win');
  const s2 = Werewolf.create([0, 1, 2, 3, 4, 5].map((s) => ({ seat: s, name: 'P' + s })), now, rng);
  ['wolf', 'wolf', 'seer', 'guard', 'villager', 'villager'].forEach((r, i) => { s2.players[i].role = r; });
  Werewolf.leave(s2, 5, now); Werewolf.leave(s2, 4, now);
  ok(!Werewolf.sweep(s2, now + 59000) && Werewolf.view(s2, 0).players[5].away, 'Werewolf: a player who leaves has 60 seconds to come back');
  Werewolf.back(s2, 4);
  ok(Werewolf.sweep(s2, now + 61000) && !Werewolf.get(s2, 5).alive && Werewolf.get(s2, 5).how === 'left' && Werewolf.get(s2, 4).alive && !s2.over, 'Werewolf: after 60 seconds they are out (and their role shows); the one who came back plays on');
  Werewolf.leave(s2, 4, now); Werewolf.leave(s2, 3, now); Werewolf.leave(s2, 2, now); Werewolf.sweep(s2, now + 70000);
  ok(s2.over && s2.winner === 'wolves', 'Werewolf: leaving can end the game — it is settled by the usual rule');
}
{ // a whole game between computer players (solo practice)
  let done = 0; let sides = {};
  for (let g = 0; g < 12; g++) {
    const rng = seeded(300 + g); let now = 0; const n = 6 + (g % 5);
    const st = Werewolf.create(Array.from({ length: n }, (_, s) => ({ seat: s, name: 'C' + s })), now, rng, true); const mind = { suspect: null, found: {} }; let steps = 0;
    while (!st.over && steps++ < 4000) {
      for (const p of Werewolf.alive(st)) { const m = Werewolf.bot(st, p.seat, rng, mind); if (m) Werewolf.act(st, p.seat, m); }
      if (st.phase === 'talk') mind.suspect = Werewolf.alive(st)[0].seat;
      now = st.until; Werewolf.advance(st, now, rng);
    }
    if (st.over) { done++; sides[st.winner] = (sides[st.winner] || 0) + 1; }
  }
  ok(done === 12 && sides.village > 0 && sides.wolves > 0, 'Werewolf: 12 practice games between computer players all end (village ' + sides.village + ', wolves ' + sides.wolves + ')');
}

// ================================================================ the shared tables (through the room rules)
const W = Room.setMap(L); const C = Room.Catalog;
ok(W.tables.find((t) => t.id === 'ban-ma-soi').seats.length === 10, 'the Werewolf table has 10 chairs');
ok(G.cleanChat('  you   stupid shit\n') === 'you stupid ***' && G.cleanChat('x'.repeat(300)).length === 120 && G.cleanChat('đm nó') === '*** nó' && G.cleanChat('admit it') === 'admit it', 'table chat: 120 characters, rude words become ***, innocent words stay');
function world(opts = {}) {
  const w = { now: 1800000000000, out: [], meta: opts.meta || {}, saved: opts.saved || {}, force: null };
  const r0 = seeded(opts.seed || 1);
  w.store = { load: (t) => (w.saved[t] ? JSON.parse(JSON.stringify(w.saved[t])) : null), save: (t, p) => { w.saved[t] = JSON.parse(JSON.stringify(p)); }, all: () => Object.entries(w.saved),
    loadMeta: (k) => (w.meta[k] ? JSON.parse(JSON.stringify(w.meta[k])) : null), saveMeta: (k, v) => { w.meta[k] = JSON.parse(JSON.stringify(v)); } };
  w.room = new Room({ cap: 100, now: () => w.now, send: (to, m) => w.out.push([to, JSON.parse(JSON.stringify(m))]), store: w.store, solo: !!opts.solo, rng: () => (w.force != null ? w.force : r0()) });
  w.plug = w.room.plugins['tro-choi'];
  w.join = (id, name) => { w.room.join(id, { name, token: (id.charCodeAt(0).toString(16) + 'abcdef0123456789').slice(0, 16) }); const p = w.room.players.get(id); p.area = 'campus'; return p; };
  w.sit = (id, table, seat) => { const p = w.room.players.get(id); const t = W.tables.find((x) => x.id === table); if (p.seat) w.room.handle(id, { type: 'stand' }); p.x = t.seats[seat].x; p.z = t.seats[seat].z; w.room.setRoom(p, 'tro-choi'); w.room.handle(id, { type: 'sit', table, seat }); return p.seat === table + ':' + seat; };
  w.last = (to, type) => { for (let i = w.out.length - 1; i >= 0; i--) if (w.out[i][0] === to && w.out[i][1].type === type) return w.out[i][1]; return null; };
  w.view = (id) => { const m = w.last(id, 'tro-choi.state'); return m && m.view; };
  w.send = (id, kind, extra) => w.room.handle(id, Object.assign({ type: 'tro-choi.' + kind }, extra));
  w.run = (ms, step = 500) => { for (let t = 0; t < ms; t += step) { w.now += step; w.room.tick(); } };
  return w;
}
{
  const w = world(); const T = 'ban-ca-ngua'; const a = w.join('a', 'An'); const b = w.join('b', 'Binh'); const c = w.join('c', 'Chi');
  ok(w.sit('a', T, 0), 'tables: sitting down works');
  let v = w.view('a');
  ok(v && v.phase === 'lobby' && v.host === 0 && v.you === 0 && !v.canStart && /1 more player/.test(v.need) && v.seats[1].name === null, 'tables: the first player seated is the host; the lobby says who is missing');
  w.send('a', 'addBot', { table: T }); v = w.view('a');
  ok(v.seats[1].kind === 'bot' && v.seats[1].name === 'Computer 1' && v.canStart, 'tables: "Add computer" seats Computer 1; the host can now start');
  ok(w.sit('b', T, 2) && w.view('b').host === 0 && !w.view('b').canStart, 'tables: a second player joins; only the host starts');
  w.send('b', 'start', { table: T });
  ok(w.plug.tables[T].phase === 'lobby' && /host/.test(w.last('b', 'toast').msg), 'tables: Start from someone else is refused');
  const sum = w.last('c', 'tro-choi.tables') || w.last('a', 'tro-choi.tables');
  ok(sum.list.find((t) => t.id === T).host === 'a' && sum.list.find((t) => t.id === T).seats.length === 3, 'tables: everyone in the room knows who sits where and who the host is (for the crown)');
  w.send('a', 'start', { table: T }); v = w.view('a');
  ok(v.phase === 'play' && v.g.game === 'ludo' && v.g.turn === 0 && v.clock.seat === 0 && v.clock.until === w.now + G.TURN_MS, 'tables: the game starts with a 20-second turn clock');
  c.x = W.tables.find((t) => t.id === T).seats[3].x; c.z = W.tables.find((t) => t.id === T).seats[3].z; w.room.setRoom(c, 'tro-choi');
  w.room.handle('c', { type: 'sit', table: T, seat: 3 });
  ok(!c.seat && /running/.test(w.out.filter(([to, m]) => to === 'c' && m.type === 'chat' && m.system).pop()[1].text), 'tables: no joining a game that is running');
  w.send('c', 'watch', { table: T, on: true });
  ok(w.view('c') && w.view('c').watching && w.view('c').you === null, 'tables: standing next to the table you can watch');
  w.send('b', 'move', { table: T, roll: true });
  ok(w.plug.tables[T].st.n === 0, 'tables: a move out of turn changes nothing');
  w.force = (6 - 0.5) / 6; w.send('a', 'move', { table: T, roll: true }); w.force = null; v = w.view('a');
  ok(v.g.die === 6 && v.g.phase === 'move' && v.g.moves.length === 4 && w.view('b').g.moves.length === 0, 'tables: the server rolls the die; only the player to move gets the list of moves');
  w.send('a', 'move', { table: T, horse: 9 }); ok(w.view('a').g.phase === 'move', 'tables: an impossible move is ignored');
  w.send('a', 'move', { table: T, horse: 1 }); v = w.view('a');
  ok(v.g.horses[0][1] === 0 && v.g.turn === 0 && v.g.phase === 'roll' && v.clock.until === w.now + G.TURN_MS, 'tables: the move is played; a 6 gives another roll and a fresh clock');
  w.run(G.TURN_MS + 600); v = w.view('a');
  ok(v.g.turn !== 0 || v.g.n > 2, 'tables: when the 20 seconds run out the computer moves for the player');
  // leaving in the middle: the computer plays on; coming back gives the place back
  w.room.handle('a', { type: 'stand' }); let t = w.plug.tables[T];
  ok(t.phase === 'play' && t.slots[0] && t.slots[0].id === null && t.host === 2, 'tables: leaving a running game keeps your place (a computer plays on) and the longest-seated player becomes host');
  const n0 = t.st.n; w.run(30000);
  ok(t.st.n > n0, 'tables: the computer players keep the game going');
  ok(w.sit('a', T, 0) && w.view('a').you === 0 && w.view('a').phase === 'play', 'tables: sitting down on your chair again gives the place back');
  ok(!w.sit('c', T, 3), 'tables: still no new players in the middle of a game');
  // the end
  t.st.horses[0] = [61, 60, 59, 55]; t.st.turn = 0; t.st.phase = 'roll'; t.st.moves = [];
  const xu = a.pr.xu; w.force = (1 - 0.5) / 6; w.send('a', 'move', { table: T, roll: true }); w.force = null;
  ok(t.st.ranks.join() === '0' && t.phase === 'play', 'tables: one legal move is played without asking; the first player home wins, the others play on');
  w.send('a', 'end', { table: T }); ok(t.phase === 'play', 'tables: only the host can end the game early');
  w.send('b', 'end', { table: T }); v = w.view('a');
  ok(t.phase === 'over' && v.phase === 'over' && v.g.ranks.length === 3 && v.g.ranks[0] === 0, 'tables: the host ends the game; everybody gets the ranking');
  ok(a.pr.xu === xu + C.ECON.gameWin && a.pr.stats.games.ludo.played === 1 && a.pr.stats.games.ludo.won === 1 && b.pr.stats.games.ludo.played === 1 && b.pr.stats.games.ludo.won === 0, 'tables: games played and won go into the profile; the winner gets Xu');
  w.send('a', 'again', { table: T }); v = w.view('a');
  ok(v.phase === 'lobby' && v.seats.filter((s) => s.name).length === 3 && v.g === null, 'tables: "Play again" goes back to the lobby with the same people');
  w.room.handle('a', { type: 'stand' }); w.room.handle('b', { type: 'stand' });
  ok(Object.keys(w.plug.tables[T].slots).length === 0 && w.view('c') === null, 'tables: when the last player leaves the table is cleared (spectators are told)');
}
{ // Colour Cards through the table: hands stay secret, chat is filtered
  const w = world({ seed: 5 }); const T = 'ban-bai-mau'; const a = w.join('a', 'An'); const b = w.join('b', 'Binh'); const c = w.join('c', 'Chi');
  w.sit('a', T, 0); w.sit('b', T, 1); w.send('a', 'start', { table: T });
  c.x = a.x + 1; c.z = a.z; w.room.setRoom(c, 'tro-choi'); w.send('c', 'watch', { table: T, on: true });
  const va = w.view('a'); const vb = w.view('b'); const vc = w.view('c');
  ok(va.g.hand.length === 7 && vb.g.hand.length === 7 && vc.g.hand.length === 0 && va.g.counts[1] === 7 && !('hands' in va.g) && JSON.stringify(va).indexOf(JSON.stringify(vb.g.hand[0])) < 0, 'tables: each player gets only their own hand; spectators get none');
  const bad = va.g.hand.find((x) => !va.g.playable.includes(x.id));
  if (bad) { const n = w.plug.tables[T].st.n; w.send('a', 'move', { table: T, play: bad.id, color: 'p' }); ok(w.plug.tables[T].st.n === n && w.last('a', 'toast'), 'tables: a card that does not fit is refused and nothing changes'); }
  w.send('a', 'chat', { table: T, text: 'good luck, you shit' });
  ok(w.last('b', 'tro-choi.chat').text === 'good luck, you ***' && w.last('c', 'tro-choi.chat').text === 'good luck, you ***', 'tables: table chat reaches players and spectators, filtered');
  w.send('a', 'chat', { table: T, text: 'second' });
  ok(w.last('b', 'tro-choi.chat').text !== 'second', 'tables: one chat message a second');
  w.send('c', 'chat', { table: T, text: 'hi' }); ok(w.last('a', 'tro-choi.chat').name === 'An', 'tables: spectators cannot write in the table chat');
  c.x += 30; w.run(1000); ok(w.view('c') === null, 'tables: walking away stops the watching');
  w.room.leave('a'); const t = w.plug.tables[T];
  ok(t.phase === 'play' && t.slots[0].id === null, 'tables: a lost connection keeps the place too');
  w.run(240000);
  ok(t.phase === 'over' || t.st.n > 20, 'tables: the computer plays the missing player\'s cards');
}
{ // the only real player leaves a game against computer players: the game waits 90 seconds, then the table is cleared
  const w = world({ seed: 6 }); const T = 'ban-ca-ngua'; w.join('a', 'An'); w.sit('a', T, 0); w.send('a', 'addBot', { table: T }); w.send('a', 'start', { table: T });
  w.room.handle('a', { type: 'stand' }); const t = () => w.plug.tables[T];
  ok(t().phase === 'play' && t().frozen > 0 && t().slots[0].id === null, 'tables: the last real player stands up — the game is kept, paused');
  const n = t().st.n; w.run(30000); ok(t().st.n === n, 'tables: a paused game does not play on by itself');
  ok(w.sit('a', T, 0) && w.view('a').you === 0 && w.view('a').phase === 'play', 'tables: back within 90 seconds — the place and the game are still there');
  w.run(1500); ok(!t().frozen && w.view('a').host === 0 && w.view('a').clock.until > w.now, 'tables: …and the game goes on, with the clock restarted');
  w.room.handle('a', { type: 'stand' }); w.run(91000);
  ok(t().phase === 'lobby' && Object.keys(t().slots).length === 0, 'tables: nobody back after 90 seconds — the table is cleared');
}
{ // Werewolf: real players only on the server; computer players for solo practice
  const w = world({ seed: 8 }); const T = 'ban-ma-soi'; const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
  ids.forEach((id, i) => { w.join(id, 'P' + i); if (i < 5) w.sit(id, T, i); });
  w.send('a', 'addBot', { table: T });
  ok(/real players/.test(w.last('a', 'toast').msg) && !w.view('a').bots && /1 more player/.test(w.view('a').need), 'Werewolf table: no computer players on the server; the lobby says how many are missing');
  w.send('a', 'start', { table: T }); ok(w.plug.tables[T].phase === 'lobby', 'Werewolf table: no start below 6 players');
  w.sit('f', T, 5); w.send('a', 'start', { table: T });
  const views = ids.slice(0, 6).map((id) => w.view(id)); const st = w.plug.tables[T].st;
  ok(st && !st.fast && views.every((v) => v.g.you.role) && views.filter((v) => v.g.you.role === 'wolf').length === 2, 'Werewolf table: six players, two secret Werewolves, full-length phases');
  const vill = views.find((v) => v.g.you.role === 'villager'); const wolf = views.find((v) => v.g.you.role === 'wolf');
  ok(vill.g.players.filter((p) => p.role).length === 1 && wolf.g.players.filter((p) => p.role === 'wolf').length === 2, 'Werewolf table: a Villager knows only their own role; the Werewolves know each other');
  const g = w.room.players.get('g'); g.x = w.room.players.get('a').x + 1; g.z = w.room.players.get('a').z; w.room.setRoom(g, 'tro-choi'); w.send('g', 'watch', { table: T, on: true });
  ok(w.view('g').g.players.every((p) => p.role === null) && w.view('g').g.you === null, 'Werewolf table: spectators see no roles');
  const villId = ids[vill.you]; const wolfId = ids[wolf.you];
  w.send(villId, 'chat', { table: T, text: 'hello?' });
  ok(/night/.test(w.last(villId, 'toast').msg), 'Werewolf table: the village is silent at night');
  w.now += 1100; w.send(wolfId, 'chat', { table: T, text: 'bite P0?' });
  const heard = ids.slice(0, 7).filter((id) => { const m = w.last(id, 'tro-choi.chat'); return m && m.text === 'bite P0?'; });
  ok(heard.length === 2 && heard.every((id) => w.view(id).g.you && w.view(id).g.you.role === 'wolf'), 'Werewolf table: the wolves\' night chat reaches only the wolves');
  const t0 = w.now; w.run(19000 - 1100); ok(st.phase === 'guard', 'Werewolf table: every night step runs its full time');
  w.run(2000); ok(st.phase === 'wolf', 'Werewolf table: …then moves on by itself');
  w.room.handle(villId, { type: 'stand' });
  ok(st.away[vill.you] != null && w.plug.tables[T].slots[vill.you].id === null, 'Werewolf table: leaving starts the 60-second clock');
  w.run(62000);
  ok(!Werewolf.get(st, vill.you).alive && Werewolf.get(st, vill.you).how === 'left', 'Werewolf table: not back in time — out of the game, no computer takes over');
  ok(w.last('g', 'tro-choi.tables').list.find((x) => x.id === T).ghosts.length === 0 && t0 > 0, 'Werewolf table: a player who left is not shown as a ghost');
}
{
  const w = world({ seed: 12, solo: true }); const T = 'ban-ma-soi'; const a = w.join('a', 'An'); w.sit('a', T, 0);
  for (let i = 0; i < 7; i++) w.send('a', 'addBot', { table: T });
  ok(w.view('a').bots && w.view('a').seats.filter((s) => s.kind === 'bot').length === 7 && w.view('a').canStart, 'solo practice: computer players may fill the Werewolf table');
  w.send('a', 'start', { table: T }); const t = w.plug.tables[T];
  ok(t.st.fast && t.st.players.length === 8, 'solo practice: the game runs in practice mode');
  let guard = 0; while (t.phase === 'play' && guard++ < 4000) { w.run(500); const v = w.view('a'); if (v && v.g && ['talk', 'announce', 'result', 'words'].includes(v.g.phase)) w.send('a', 'move', { table: T, skip: true }); }
  const v = w.view('a');
  ok(t.phase === 'over' && v.g.over && (v.g.winner === 'village' || v.g.winner === 'wolves') && v.g.timeline.length >= 1 && a.pr.stats.games.werewolf.played === 1, 'solo practice: a whole Werewolf game against computer players reaches its end (' + (v.g.winner || '?') + ' win, ' + v.g.night + ' nights)');
  ok(w.out.some(([to, m]) => to === 'a' && m.type === 'tro-choi.chat' && !m.system && m.from !== 0), 'solo practice: the computer players talk during the day');
}
{ // Colour Match: progress in the profile, checked by the room
  const w = world(); const T = 'ban-ghep-mau'; const a = w.join('a', 'An'); const b = w.join('b', 'Binh'); w.sit('a', T, 0);
  ok(w.last('a', 'tro-choi.match') && Object.keys(w.last('a', 'tro-choi.match').progress.stars).length === 0, 'Colour Match: sitting down sends your progress');
  const xu = a.pr.xu; w.send('a', 'matchDone', { level: 3, stars: 3, score: 5000 });
  ok(!a.pr.match.stars[3], 'Colour Match: levels open one after another');
  w.send('a', 'matchDone', { level: 1, stars: 2, score: 1500 });
  ok(a.pr.match.stars[1] === 2 && a.pr.match.best[1] === 1500 && a.pr.xu === xu + C.ECON.gameWin, 'Colour Match: a finished level is saved with its stars; the first time pays Xu');
  w.now += 5000; w.send('a', 'matchDone', { level: 1, stars: 1, score: 900 });
  ok(a.pr.match.stars[1] === 2 && a.pr.xu === xu + C.ECON.gameWin, 'Colour Match: replaying keeps the best stars and pays nothing more');
  w.send('a', 'matchSave', { save: { level: 2, moves: 11, score: 300, board: 'x'.repeat(64) } });
  ok(a.pr.match.save.level === 2 && a.pr.match.save.moves === 11, 'Colour Match: the level in progress is kept for later');
  w.send('a', 'matchSave', { save: { level: 2, junk: 'x'.repeat(5000) } }); ok(a.pr.match.save.moves === 11, 'Colour Match: oversized saves are ignored');
  w.sit('b', T, 1); w.now += 5000; w.send('b', 'matchDone', { level: 1, stars: 3, score: 2500 }); w.send('b', 'matchTop');
  const top = w.last('b', 'tro-choi.matchTop');
  ok(top.rows.length === 2 && top.rows[0].name === 'Binh' && top.rows[0].stars === 3 && top.rows[1].stars === 2, 'Colour Match: the leaderboard adds up everyone\'s stars');
  ok(w.plug.tables[T] && Object.keys(w.plug.tables[T].slots).length === 0, 'Colour Match: each chair plays alone (no lobby)');
}
{ // a restarted server carries on from the last turn
  const w = world({ seed: 3 }); const T = 'ban-ca-ngua'; w.join('a', 'An'); w.sit('a', T, 0); w.send('a', 'addBot', { table: T }); w.send('a', 'start', { table: T });
  w.force = (6 - 0.5) / 6; w.send('a', 'move', { table: T, roll: true }); w.force = null; w.send('a', 'move', { table: T, horse: 0 });
  ok(w.meta.gametables && w.meta.gametables[T] && w.meta.gametables[T].st.horses[0][0] === 0, 'restart: the running game is saved after every move');
  const w2 = world({ meta: w.meta, saved: w.saved, seed: 4 }); const t = w2.plug.tables[T];
  ok(t.phase === 'play' && t.frozen > 0 && t.st.horses[0][0] === 0 && t.slots[0].id === null, 'restart: the game is back, waiting for its players');
  const n = t.st.n; w2.run(20000); ok(t.st.n === n, 'restart: nothing moves until a player is back');
  w2.join('a', 'An'); ok(w2.sit('a', T, 0) && w2.view('a').you === 0, 'restart: the player gets the place back');
  w2.run(1000); ok(!t.frozen && w2.view('a').g.horses[0][0] === 0 && w2.view('a').clock.until > w2.now, 'restart: the game goes on from the last turn');
  const w3 = world({ meta: w.meta, saved: w.saved }); w3.join('z', 'Zed'); w3.run(181000);
  ok(w3.plug.tables[T].phase === 'lobby' && !w3.meta.gametables[T], 'restart: if nobody comes back within 3 minutes the table is cleared');
}

log(`\n${passed} passed, ${failed} failed`);
if (failed) { if (typeof process !== 'undefined') process.exit(1); else throw new Error('tests failed'); }
