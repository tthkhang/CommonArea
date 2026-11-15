/*
 * Game Room, server half (spec "Phòng Trò chơi"): the referee for the shared tables.
 * Runs on the Node server and, in solo mode, inside the browser. The rules of each game are pure functions on a
 * plain-JSON state (checked by tests/games.test.mjs); the table plug-in below seats players, runs lobbies, turn
 * clocks and computer players, and sends every browser only what that player is allowed to know.
 *
 *   Ludo      cờ cá ngựa: 4 horses each, enter on 1 or 6, exact numbers up the home column
 *   Cards     "Bài Màu": a 108-card shedding game (own names and faces)
 *   Werewolf  Ma sói for 6–10 players with Seer, Guard and Witch; night and day run on a timer
 */
(function (root) {
  'use strict';

  const shuffle = (a, rng) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; };
  const pick = (a, rng) => a[Math.floor(rng() * a.length)];

  // =====================================================================================================
  // LUDO. A horse's position: -1 in the stable · 0..55 steps along the track (0 = own start cell, 55 = the gate
  // cell in front of its home column) · 56..61 the six cells of the home column.
  // Track cell of a horse = (14 x seat + steps) mod 56, so seat 0..3 start a quarter of the lap apart.
  // =====================================================================================================
  const TRACK = 56; const GATE = 55; const HOME = 56;
  const Ludo = {
    TRACK, GATE, HOME,
    cell: (seat, steps) => (14 * seat + steps) % TRACK,
    create(seats) {
      const horses = {}; for (const s of seats) horses[s] = [-1, -1, -1, -1];
      return { game: 'ludo', all: seats.slice(), order: seats.slice(), horses, turn: seats[0], phase: 'roll', die: 0, moves: [], ranks: [], home: [], over: false, last: null, n: 0 };
    },
    occupied(st) { const occ = {}; for (const s of st.all) st.horses[s].forEach((p, i) => { if (p >= 0 && p <= GATE) occ[Ludo.cell(s, p)] = { seat: s, horse: i }; }); return occ; },
    /** Every horse of this seat that may move with this number. */
    legal(st, seat, d) {
      const hs = st.horses[seat]; const occ = Ludo.occupied(st); const out = [];
      hs.forEach((p, i) => {
        if (p === -1) { // leave the stable only with a 1 or a 6; an opponent standing on the start cell is kicked
          if (d !== 1 && d !== 6) return;
          const o = occ[Ludo.cell(seat, 0)]; if (o && o.seat === seat) return;
          out.push({ horse: i, from: -1, to: 0, capture: o || null }); return;
        }
        if (p === GATE) { if (d === 1 && !hs.includes(HOME)) out.push({ horse: i, from: p, to: HOME, capture: null }); return; } // home cell 1 needs a 1
        if (p > GATE) { const n = p - GATE; if (n < 6 && d === n + 1 && !hs.includes(p + 1)) out.push({ horse: i, from: p, to: p + 1, capture: null }); return; } // cell n+1 needs exactly n+1
        const t = p + d; if (t > GATE) return;                               // must stop exactly on the gate cell
        for (let q = p + 1; q < t; q++) if (occ[Ludo.cell(seat, q)]) return; // no jumping over any horse
        const o = occ[Ludo.cell(seat, t)]; if (o && o.seat === seat) return; // no stacking on your own horse
        out.push({ horse: i, from: p, to: t, capture: o || null });
      });
      return out;
    },
    next(st) { const i = st.all.indexOf(st.turn); for (let k = 1; k <= st.all.length; k++) { const s = st.all[(i + k) % st.all.length]; if (st.order.includes(s)) { st.turn = s; break; } } st.phase = 'roll'; st.moves = []; },
    /** Roll the die (rng() in [0, 1)). With no legal move the turn passes, unless it was a 6. */
    roll(st, seat, rng) {
      if (st.over || st.phase !== 'roll' || st.turn !== seat) return null;
      const d = 1 + Math.floor(rng() * 6); st.die = d; st.n++;
      st.moves = Ludo.legal(st, seat, d); st.last = { seat, die: d };
      if (st.moves.length) st.phase = 'move';
      else { st.last.pass = true; if (d !== 6) Ludo.next(st); }
      return d;
    },
    move(st, seat, horse) {
      if (st.over || st.phase !== 'move' || st.turn !== seat) return false;
      const m = st.moves.find((x) => x.horse === horse); if (!m) return false;
      st.horses[seat][horse] = m.to; st.n++;
      if (m.capture) st.horses[m.capture.seat][m.capture.horse] = -1;
      st.last = { seat, die: st.die, horse, from: m.from, to: m.to, capture: m.capture };
      if (st.horses[seat].every((p) => p >= HOME)) { // all four inside the home column
        st.ranks.push(seat); st.home.push(seat); st.order = st.order.filter((s) => s !== seat);
        if (st.order.length <= 1) { st.ranks.push(...st.order); st.order = []; st.over = true; st.moves = []; return true; }
        Ludo.next(st); return true;
      }
      if (st.die === 6) { st.phase = 'roll'; st.moves = []; } else Ludo.next(st);
      return true;
    },
    progress: (st, seat) => st.horses[seat].reduce((a, p) => a + (p < 0 ? 0 : p + 1), 0),
    /** The host stops the game early: whoever is still playing is ranked by how far their horses are. */
    end(st) { st.ranks.push(...st.order.slice().sort((a, b) => Ludo.progress(st, b) - Ludo.progress(st, a))); st.order = []; st.over = true; st.moves = []; },
    /** Computer player: kick > climb home > leave the stable > the horse nearest home that does not stop just in front of an opponent. */
    bot(st, seat) {
      const occ = Ludo.occupied(st);
      const danger = (to) => { if (to > GATE) return false; const c = Ludo.cell(seat, to); for (let b = 1; b <= 6; b++) { const o = occ[(c - b + TRACK) % TRACK]; if (o && o.seat !== seat) return true; } return false; };
      let best = null; let bs = -1e9;
      for (const m of st.moves) { const s = (m.capture ? 1000 : 0) + (m.to >= HOME ? 500 + m.to : 0) + (m.from === -1 ? 300 : 0) + m.to - (danger(m.to) ? 40 : 0); if (s > bs) { bs = s; best = m; } }
      return best ? best.horse : null;
    },
  };

  // =====================================================================================================
  // CARDS ("Bài Màu"). A card: { id, c: 'p' | 'y' | 'r' | 't' (purple, yellow, coral red, teal) | 'w' (wild), v: '0'..'9' | 'skip' | 'rev' | '+2' | 'wild' | '+4' }
  // =====================================================================================================
  const CARD_COLORS = ['p', 'y', 'r', 't'];
  const Cards = {
    COLORS: CARD_COLORS, ONE_MS: 3000,
    deck() {
      const d = []; let id = 0;
      for (const c of CARD_COLORS) { d.push({ id: id++, c, v: '0' }); for (let n = 1; n <= 9; n++) for (let k = 0; k < 2; k++) d.push({ id: id++, c, v: String(n) }); for (const v of ['skip', 'rev', '+2']) for (let k = 0; k < 2; k++) d.push({ id: id++, c, v }); }
      for (let k = 0; k < 4; k++) d.push({ id: id++, c: 'w', v: 'wild' });
      for (let k = 0; k < 4; k++) d.push({ id: id++, c: 'w', v: '+4' });
      return d; // 108
    },
    /** Deal 7 each. `deck` (optional) is a prepared deck whose LAST card is drawn first — used by the guided practice and the tests. */
    create(seats, rng, deck) {
      const draw = deck ? deck.slice() : shuffle(Cards.deck(), rng); const hands = {};
      for (const s of seats) hands[s] = [];
      for (let k = 0; k < 7; k++) for (const s of seats) hands[s].push(draw.pop());
      let i = draw.length - 1; while (i >= 0 && !/^\d$/.test(draw[i].v)) i--; // the first face-up card is a number card (a +4 or any action card goes back into the deck)
      const top = draw.splice(i, 1)[0];
      return { game: 'cards', all: seats.slice(), hands, draw, pile: [top], top, color: top.c, dir: 1, turn: seats[0], drawn: null, one: null, over: false, winner: null, ranks: [], last: null, n: 0 };
    },
    canPlay(st, seat, card) {
      if (st.drawn != null && card.id !== st.drawn) return false; // after drawing, only the drawn card may be played
      if (card.v === 'wild') return true;
      if (card.v === '+4') return !st.hands[seat].some((h) => h.c === st.color); // only when you hold no card of the colour in play
      return card.c === st.color || card.v === st.top.v;
    },
    playable: (st, seat) => st.hands[seat].filter((c) => Cards.canPlay(st, seat, c)).map((c) => c.id),
    after(st, seat, steps) { const i = st.all.indexOf(seat); const n = st.all.length; return st.all[(((i + st.dir * steps) % n) + n) % n]; },
    give(st, seat, n, rng) {
      for (let k = 0; k < n; k++) {
        if (!st.draw.length) { const rest = st.pile.splice(0, st.pile.length - 1); st.draw = shuffle(rest, rng); } // the played cards, except the top one, become the new deck
        if (!st.draw.length) return k;
        st.hands[seat].push(st.draw.pop());
      }
      return n;
    },
    /** Play a card (color = the colour chosen for a wild). Returns '' or the reason it was refused. */
    play(st, seat, id, color, now, rng) {
      if (st.over || st.turn !== seat) return 'Not your turn.';
      const hand = st.hands[seat]; const card = hand.find((c) => c.id === id);
      if (!card) return 'You do not hold that card.';
      if (!Cards.canPlay(st, seat, card)) return card.v === '+4' ? 'A +4 may only be played when you have no card of the colour in play.' : 'That card does not match.';
      if (card.c === 'w' && !CARD_COLORS.includes(color)) return 'Choose a colour.';
      hand.splice(hand.indexOf(card), 1); st.pile.push(card); st.top = card; st.color = card.c === 'w' ? color : card.c; st.drawn = null; st.n++;
      st.last = { seat, card, color: st.color };
      if (st.one && st.one.seat === seat) st.one = null;
      if (hand.length === 1) st.one = { seat, until: now + Cards.ONE_MS, called: false };
      if (!hand.length) { st.over = true; st.winner = seat; st.ranks = [seat].concat(st.all.filter((s) => s !== seat).sort((a, b) => st.hands[a].length - st.hands[b].length)); return ''; }
      let steps = 1; const nextSeat = Cards.after(st, seat, 1);
      if (card.v === 'skip') steps = 2;
      else if (card.v === 'rev') { if (st.all.length === 2) steps = 2; else { st.dir = -st.dir; } }
      else if (card.v === '+2') { Cards.give(st, nextSeat, 2, rng); steps = 2; st.last.hit = { seat: nextSeat, n: 2 }; }
      else if (card.v === '+4') { Cards.give(st, nextSeat, 4, rng); steps = 2; st.last.hit = { seat: nextSeat, n: 4 }; }
      st.turn = Cards.after(st, seat, steps);
      return '';
    },
    /** Draw one card. If it can be played you may play it (or pass); otherwise the turn passes at once. */
    draw(st, seat, rng) {
      if (st.over || st.turn !== seat || st.drawn != null) return false;
      if (st.one && st.one.seat === seat) st.one = null;
      const before = st.hands[seat].length; Cards.give(st, seat, 1, rng); st.n++;
      const card = st.hands[seat].length > before ? st.hands[seat][st.hands[seat].length - 1] : null;
      st.last = { seat, drew: 1 };
      if (card && Cards.canPlay(st, seat, card)) st.drawn = card.id; else { st.drawn = null; st.turn = Cards.after(st, seat, 1); }
      return true;
    },
    pass(st, seat) { if (st.over || st.turn !== seat || st.drawn == null) return false; st.drawn = null; st.turn = Cards.after(st, seat, 1); st.n++; st.last = { seat, passed: true }; return true; },
    /** "One card!" — to be pressed within 3 seconds of playing your second-to-last card. */
    callOne(st, seat) { if (st.one && st.one.seat === seat && !st.one.called) { st.one.called = true; return true; } return false; },
    /** "Caught you!" — someone who forgot to say "One card!" in time draws two. */
    catchOne(st, seat, now, rng) {
      const o = st.one; if (st.over || !o || o.called || o.seat === seat || now < o.until || st.hands[o.seat].length !== 1) return null;
      Cards.give(st, o.seat, 2, rng); st.one = null; st.n++; st.last = { seat, caught: o.seat };
      return o.seat;
    },
    /** Computer player: an action card when the next player is nearly out > the colour it holds most of > keep wilds for later. */
    bot(st, seat) {
      const hand = st.hands[seat]; const ok = hand.filter((c) => Cards.canPlay(st, seat, c));
      if (!ok.length) return st.drawn != null ? { pass: true } : { draw: true };
      const count = { p: 0, y: 0, r: 0, t: 0 }; for (const c of hand) if (c.c !== 'w') count[c.c]++;
      const best = CARD_COLORS.slice().sort((a, b) => count[b] - count[a])[0];
      const nextFew = st.hands[Cards.after(st, seat, 1)].length <= 2; const action = (c) => ['skip', 'rev', '+2', '+4'].includes(c.v);
      const plain = ok.filter((c) => c.c !== 'w');
      let card = (nextFew && ok.find(action)) || plain.slice().sort((a, b) => count[b.c] - count[a.c] || (action(b) ? 1 : 0) - (action(a) ? 1 : 0))[0] || ok.find((c) => c.v === 'wild') || ok[0];
      return { play: card.id, color: card.c === 'w' ? best : undefined };
    },
  };

  // =====================================================================================================
  // WEREWOLF. Phases: guard -> wolf -> witch -> seer (night) -> announce -> talk -> vote -> result -> words (day) -> …
  // =====================================================================================================
  const WW_ROLES = {
    6: ['wolf', 'wolf', 'seer', 'guard', 'villager', 'villager'],
    7: ['wolf', 'wolf', 'seer', 'guard', 'witch', 'villager', 'villager'],
    8: ['wolf', 'wolf', 'seer', 'guard', 'witch', 'villager', 'villager', 'villager'],
    9: ['wolf', 'wolf', 'wolf', 'seer', 'guard', 'witch', 'villager', 'villager', 'villager'],
    10: ['wolf', 'wolf', 'wolf', 'seer', 'guard', 'witch', 'villager', 'villager', 'villager', 'villager'],
  };
  const WW_TIME = { guard: 20000, wolf: 40000, witch: 20000, seer: 20000, announce: 5000, talk: 120000, vote: 30000, result: 10000, words: 15000 };
  const WW_NIGHT = ['guard', 'wolf', 'witch', 'seer'];
  const Werewolf = {
    ROLES: WW_ROLES, TIME: WW_TIME, AWAY_MS: 60000,
    /** players: [{ seat, name }]. fast = solo practice (short phases that end as soon as everyone has acted). */
    create(players, now, rng, fast) {
      const roles = shuffle(WW_ROLES[players.length].slice(), rng);
      const st = { game: 'werewolf', players: players.map((p, i) => ({ seat: p.seat, name: p.name, role: roles[i], alive: true })), night: 0, phase: '', begun: 0, until: 0, fast: !!fast,
        guardLast: null, potions: { heal: true, poison: true }, act: {}, bitten: null, votes: {}, morning: [], hanged: null, seen: [], timeline: [], log: [], away: {}, winner: null, over: false, n: 0 };
      Werewolf.begin(st, 'guard', now); return st;
    },
    get: (st, seat) => st.players.find((p) => p.seat === seat),
    alive: (st, f) => st.players.filter((p) => p.alive && (!f || f(p))),
    has: (st, role) => st.players.some((p) => p.role === role),
    /** Solo practice: the talking and reading phases are shorter; the phases with a choice keep their time but end as soon as everyone has chosen. */
    time: (st, phase) => (st.fast && ['announce', 'talk', 'result', 'words'].includes(phase) ? Math.max(5000, WW_TIME[phase] * 0.3) : WW_TIME[phase]),
    begin(st, phase, now) {
      st.phase = phase; st.begun = now; st.until = now + Werewolf.time(st, phase); st.n++;
      if (phase === 'guard') { st.night++; st.act = { guard: null, wolf: {}, witch: null, seer: null }; st.bitten = null; st.morning = []; st.hanged = null; st.votes = {}; st.log.push({ t: 'night', n: st.night }); }
      if (phase === 'vote') st.votes = {};
    },
    win(st) { const w = Werewolf.alive(st, (p) => p.role === 'wolf').length; const o = Werewolf.alive(st).length - w; return w === 0 ? 'village' : w >= o ? 'wolves' : null; },
    finish(st, winner) { st.winner = winner; st.over = true; st.phase = 'over'; st.until = 0; st.n++; st.log.push({ t: 'win', side: winner }); },
    kill(st, seat, how) { const p = Werewolf.get(st, seat); if (!p || !p.alive) return false; p.alive = false; p.how = how; return true; },
    /** A night or day action. msg: { target } or, for the Witch, { potion: 'heal' | 'poison' | 'skip', target }. Returns '' or why it was refused. */
    act(st, seat, msg) {
      const me = Werewolf.get(st, seat); if (!me || !me.alive || st.over) return 'You cannot act now.';
      const target = msg.target == null ? null : Werewolf.get(st, Number(msg.target));
      const need = () => (target && target.alive ? '' : 'Choose a living player.');
      if (st.phase === 'guard' && me.role === 'guard') {
        if (need()) return need(); if (target.seat === st.guardLast) return 'You cannot protect the same player two nights in a row.';
        st.act.guard = target.seat; st.n++; return '';
      }
      if (st.phase === 'wolf' && me.role === 'wolf') { if (need()) return need(); if (target.role === 'wolf') return 'Choose someone who is not a Werewolf.'; st.act.wolf[seat] = target.seat; st.n++; return ''; }
      if (st.phase === 'witch' && me.role === 'witch') {
        if (st.act.witch) return 'You have already chosen tonight.';
        if (msg.potion === 'heal') { if (!st.potions.heal) return 'The healing potion is used up.'; if (st.bitten == null) return 'Nobody was bitten.'; if (st.bitten === seat) return 'You cannot heal yourself.'; st.potions.heal = false; st.act.witch = { heal: true }; }
        else if (msg.potion === 'poison') { if (!st.potions.poison) return 'The poison is used up.'; if (need()) return need(); if (target.seat === seat) return 'Choose someone else.'; st.potions.poison = false; st.act.witch = { poison: target.seat }; }
        else st.act.witch = { skip: true };
        st.n++; return '';
      }
      if (st.phase === 'seer' && me.role === 'seer') {
        if (st.act.seer != null) return 'You have already looked tonight.'; if (need()) return need(); if (target.seat === seat) return 'Choose someone else.';
        st.act.seer = target.seat; st.seen.push({ night: st.night, seat: target.seat, wolf: target.role === 'wolf' }); st.n++; return '';
      }
      if (st.phase === 'vote') { if (target && (!target.alive || target.seat === seat)) return 'Vote for another living player.'; if (target) st.votes[seat] = target.seat; else delete st.votes[seat]; st.n++; return ''; }
      return 'Nothing to do right now.';
    },
    /** Everyone who has a job in this phase has done it (used to end a phase early in solo practice). */
    ready(st) {
      const a = st.act; const live = (role) => Werewolf.alive(st, (p) => p.role === role);
      if (st.phase === 'guard') return !live('guard').length || a.guard != null;
      if (st.phase === 'wolf') return live('wolf').every((p) => a.wolf[p.seat] != null);
      if (st.phase === 'witch') return !live('witch').length || !!a.witch;
      if (st.phase === 'seer') return !live('seer').length || a.seer != null;
      if (st.phase === 'vote') return Werewolf.alive(st).every((p) => st.votes[p.seat] != null);
      return false;
    },
    tally(votes) { const c = {}; for (const k in votes) c[votes[k]] = (c[votes[k]] || 0) + 1; return c; },
    top(counts) { let max = 0; let who = []; for (const k in counts) { if (counts[k] > max) { max = counts[k]; who = [Number(k)]; } else if (counts[k] === max) who.push(Number(k)); } return who; },
    /** Move to the next phase (called when the time is up, or early in solo practice). */
    advance(st, now, rng) {
      if (st.over) return;
      const ph = st.phase;
      if (ph === 'guard') return Werewolf.begin(st, 'wolf', now);
      if (ph === 'wolf') { // the Werewolves' choice: most votes, a tie is broken at random
        const who = Werewolf.top(Werewolf.tally(st.act.wolf)); st.bitten = who.length ? pick(who, rng) : null;
        return Werewolf.begin(st, Werewolf.has(st, 'witch') ? 'witch' : 'seer', now);
      }
      if (ph === 'witch') return Werewolf.begin(st, 'seer', now);
      if (ph === 'seer') { // dawn
        const a = st.act; const w = a.witch || {}; const saved = st.bitten != null && (st.bitten === a.guard || !!w.heal);
        const dead = []; if (st.bitten != null && !saved) dead.push(st.bitten); if (w.poison != null && !dead.includes(w.poison)) dead.push(w.poison);
        st.guardLast = a.guard;
        st.timeline.push({ night: st.night, guard: a.guard, bitten: st.bitten, saved, by: saved ? (st.bitten === a.guard ? 'guard' : 'witch') : null, poisoned: w.poison == null ? null : w.poison, seen: a.seer });
        st.morning = dead.filter((s) => Werewolf.kill(st, s, 'night'));
        st.log.push({ t: 'dawn', n: st.night, dead: st.morning.slice() });
        return Werewolf.begin(st, 'announce', now);
      }
      if (ph === 'announce') { const w = Werewolf.win(st); if (w) return Werewolf.finish(st, w); return Werewolf.begin(st, 'talk', now); }
      if (ph === 'talk') return Werewolf.begin(st, 'vote', now);
      if (ph === 'vote') { // most votes is voted out; a tie means nobody
        const counts = Werewolf.tally(st.votes); const who = Werewolf.top(counts);
        st.hanged = who.length === 1 ? who[0] : null; st.log.push({ t: 'vote', n: st.night, counts, out: st.hanged });
        return Werewolf.begin(st, 'result', now);
      }
      if (ph === 'result') { if (st.hanged != null) return Werewolf.begin(st, 'words', now); const w = Werewolf.win(st); if (w) return Werewolf.finish(st, w); return Werewolf.begin(st, 'guard', now); }
      if (ph === 'words') { Werewolf.kill(st, st.hanged, 'vote'); const w = Werewolf.win(st); if (w) return Werewolf.finish(st, w); return Werewolf.begin(st, 'guard', now); }
    },
    /** A player left: they have 60 seconds to come back, then they are out of the game (no computer player takes over). */
    leave(st, seat, now) { const p = Werewolf.get(st, seat); if (p && p.alive && !st.over) st.away[seat] = now; },
    back(st, seat) { delete st.away[seat]; },
    /** Call regularly: players who stayed away too long are out; with fewer than 3 left the game ends by the usual rule. */
    sweep(st, now) {
      if (st.over) return false; let changed = false;
      for (const k of Object.keys(st.away)) if (now - st.away[k] > Werewolf.AWAY_MS) { delete st.away[k]; if (Werewolf.kill(st, Number(k), 'left')) { st.log.push({ t: 'left', seat: Number(k) }); changed = true; } }
      if (changed) { st.n++; const w = Werewolf.win(st); if (w) Werewolf.finish(st, w); else if (Werewolf.alive(st).length < 3) Werewolf.finish(st, 'wolves'); }
      return changed;
    },
    /** Which channel a player's chat message goes to right now: 'day' (everyone), 'wolf' (Werewolves at night), 'ghost' (the dead), or null (silence). */
    channel(st, seat) {
      const p = Werewolf.get(st, seat); if (!p) return null;
      if (st.over) return 'day';
      if (!p.alive) return 'ghost';
      if (WW_NIGHT.includes(st.phase)) return p.role === 'wolf' ? 'wolf' : null; // at night only the Werewolves whisper
      if (st.phase === 'words') return seat === st.hanged ? 'day' : null; // last words
      return 'day';
    },
    /** Who may read a channel. */
    hears(st, seat, channel) { const p = seat == null ? null : Werewolf.get(st, seat); if (channel === 'day') return true; if (!p) return false; if (!p.alive || st.over) return true; return channel === 'wolf' && p.role === 'wolf'; },
    /** What one player (or a spectator, seat = null) is allowed to see. */
    view(st, seat) {
      const me = seat == null ? null : Werewolf.get(st, seat); const ghost = !!me && !me.alive; const all = st.over || ghost;
      const wolf = !!me && me.role === 'wolf';
      const v = { game: 'werewolf', phase: st.phase, begun: st.begun, until: st.until, night: st.night, fast: st.fast, over: st.over, winner: st.winner, you: me ? { seat, role: me.role, alive: me.alive } : null,
        players: st.players.map((p) => ({ seat: p.seat, name: p.name, alive: p.alive, how: p.how || null, away: st.away[p.seat] != null, role: all || !p.alive || (me && p.seat === seat) || (wolf && p.role === 'wolf') ? p.role : null })),
        roles: WW_ROLES[st.players.length].slice().sort(), morning: st.morning, hanged: st.hanged, log: st.log, counts: st.phase === 'vote' || st.phase === 'result' || st.phase === 'words' ? Werewolf.tally(st.votes) : null,
        vote: me ? (st.votes[seat] == null ? null : st.votes[seat]) : null, potions: null, bitten: null, seen: null, wolfVotes: null, done: false, timeline: st.over ? st.timeline : null };
      if (me && me.alive && !st.over) {
        if (me.role === 'guard') { v.guardLast = st.guardLast; if (st.phase === 'guard') v.done = st.act.guard != null; v.guard = st.act.guard; }
        if (me.role === 'witch') { v.potions = st.potions; if (st.phase === 'witch') { v.bitten = st.bitten; v.done = !!st.act.witch; } }
        if (me.role === 'seer' && st.phase === 'seer') v.done = st.act.seer != null;
      }
      if (me && me.role === 'seer') v.seen = st.seen;
      if (wolf || ghost) v.wolfVotes = st.phase === 'wolf' || ghost ? st.act.wolf : null;
      if (ghost) { v.seen = st.seen; v.bitten = st.bitten; }
      return v;
    },
    /** Computer player (solo practice only). `mind` = what this table's computer players have worked out: { suspect, found: {seat: isWolf} }. */
    bot(st, seat, rng, mind) {
      const me = Werewolf.get(st, seat); if (!me || !me.alive) return null;
      const others = Werewolf.alive(st, (p) => p.seat !== seat);
      if (st.phase === 'guard' && me.role === 'guard') { const c = Werewolf.alive(st, (p) => p.seat !== st.guardLast); return c.length ? { target: pick(c, rng).seat } : null; }
      if (st.phase === 'wolf' && me.role === 'wolf') { const set = Object.values(st.act.wolf); const prey = Werewolf.alive(st, (p) => p.role !== 'wolf'); return prey.length ? { target: set.length ? set[0] : pick(prey, rng).seat } : null; }
      if (st.phase === 'witch' && me.role === 'witch') {
        if (st.potions.heal && st.bitten != null && st.bitten !== seat && rng() < 0.65) return { potion: 'heal' };
        if (st.potions.poison && st.night >= 2 && mind.suspect != null && Werewolf.get(st, mind.suspect).alive && mind.suspect !== seat && rng() < 0.3) return { potion: 'poison', target: mind.suspect };
        return { potion: 'skip' };
      }
      if (st.phase === 'seer' && me.role === 'seer') { const c = others.filter((p) => !st.seen.some((s) => s.seat === p.seat)); const t = c.length ? pick(c, rng) : null; if (t) mind.found[t.seat] = t.role === 'wolf'; return t ? { target: t.seat } : null; }
      if (st.phase === 'vote') {
        const known = Object.keys(mind.found).map(Number).find((s) => mind.found[s] && Werewolf.get(st, s).alive);
        const lead = Werewolf.top(Werewolf.tally(st.votes)).filter((s) => s !== seat && Werewolf.get(st, s).alive)[0]; // who is ahead so far (computer players like to follow)
        let t = null;
        if (me.role === 'wolf') {
          const prey = others.filter((p) => p.role !== 'wolf'); const ok = (s) => s != null && prey.some((p) => p.seat === s);
          t = ok(lead) && rng() < 0.6 ? lead : ok(mind.suspect) && rng() < 0.7 ? mind.suspect : prey.length ? pick(prey, rng).seat : null;
        } else if (me.role === 'seer' && known != null) t = known;
        else {
          const cleared = (s) => mind.found[s] === false;            // the Seer's "not a Werewolf" results are trusted
          const pool = others.filter((p) => !cleared(p.seat));
          if (mind.suspect != null && mind.suspect !== seat && Werewolf.get(st, mind.suspect).alive && !cleared(mind.suspect) && rng() < 0.75) t = mind.suspect;
          else if (lead != null && !cleared(lead) && rng() < 0.5) t = lead;
          else t = pool.length ? pick(pool, rng).seat : others.length ? pick(others, rng).seat : null;
        }
        return t == null ? null : { target: t };
      }
      return null;
    },
  };

  // =====================================================================================================
  // The Game Room plug-in: tables, lobbies, turn clocks, computer players, table chat, spectators, results.
  // =====================================================================================================
  const TABLES = { 'ban-ca-ngua': { game: 'ludo', title: 'Ludo', min: 2 }, 'ban-bai-mau': { game: 'cards', title: 'Colour Cards', min: 2 }, 'ban-ma-soi': { game: 'werewolf', title: 'Werewolf', min: 6 }, 'ban-ghep-mau': { game: 'match', title: 'Colour Match', min: 1 } };
  const TURN_MS = 20000;       // a player's turn in Ludo and Colour Cards; then a computer player moves for them
  const RETURN_MS = 180000;    // after a restart, a saved game waits this long for its players
  const HOLD_MS = 90000;       // when the last real player leaves a running Ludo / Cards game, it is kept this long
  const BOT_MS = 900;          // how long a computer player "thinks"
  const MATCH_LEVELS = 30;
  const BAD_WORDS = ['fuck', 'shit', 'bitch', 'asshole', 'bastard', 'dick', 'địt', 'đụ', 'lồn', 'cặc', 'đéo', 'đm', 'dm', 'vcl', 'vkl', 'clgt', 'dcm', 'đcm', 'ditme', 'dit me'];
  const BAD_RE = new RegExp('(^|[^\\p{L}\\p{N}])(' + BAD_WORDS.map((w) => w.replace(/ /g, '\\s+')).join('|') + ')(?=$|[^\\p{L}\\p{N}])', 'giu');
  /** Table chat: at most 120 characters, rude words become ***. */
  const cleanChat = (s) => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120).replace(BAD_RE, (m, a) => a + '***');
  const BOT_TALK = { wolfAccuse: ['{n} has been very quiet. Suspicious.', 'I do not trust {n}.', 'My vote goes to {n} today.'], seerAccuse: ['I have a strong feeling {n} is a Werewolf.', 'Trust me: vote for {n}.'],
    hunch: ['Something about {n} feels off.', '{n} keeps changing the subject…', 'I was watching {n}. I do not like it.'],
    idle: ['No idea yet. Who is acting odd?', 'Let us think carefully.', 'I am just a simple Villager.', 'Someone is lying here…', 'Who was restless last night?'] };

  function makeGameRoom(RoomPlugin) {
    function GameRoom(game, id, name) {
      RoomPlugin.call(this, game, id, name);
      this.rng = game.rng || Math.random; this.tables = {}; this.savedJson = '{}';
      for (const t of game.world.tables.filter((x) => x.room === id && TABLES[x.id])) this.tables[t.id] = this.fresh(t.id, t.seats.length);
      this.restore();
    }
    GameRoom.prototype = Object.create(RoomPlugin.prototype);
    GameRoom.prototype.fresh = function (id, size) { return { id, game: TABLES[id].game, title: TABLES[id].title, size, phase: 'lobby', slots: {}, host: null, st: null, watchers: new Set(), clock: 0, botAt: 0, mind: null, talkAt: 0, paid: false, overAt: 0, frozen: 0 }; };
    const keyOf = (p) => (p.token ? 't:' + p.token : 'n:' + p.name);
    GameRoom.prototype.player = function (id) { return id == null ? null : this.game.players.get(id) || null; };
    /** Is the person of this slot at the table right now? (computer players never are) */
    GameRoom.prototype.present = function (s) { return !!s && s.kind === 'human' && s.id != null && !!this.player(s.id); };
    /** Does a computer play for this slot? Computer players, strolling villagers of solo mode, and anyone who has left a running game. */
    GameRoom.prototype.auto = function (t, seat) { const s = t.slots[seat]; return !s || s.kind !== 'human' || !this.present(s); };
    GameRoom.prototype.humans = function (t) { return Object.keys(t.slots).filter((k) => this.present(t.slots[k])).map(Number); };
    GameRoom.prototype.pickHost = function (t) { const hs = this.humans(t).sort((a, b) => t.slots[a].since - t.slots[b].since); t.host = hs.length ? hs[0] : null; };
    GameRoom.prototype.seatOf = function (t, playerId) { for (const k in t.slots) if (t.slots[k].id === playerId) return Number(k); return null; };
    GameRoom.prototype.tableOf = function (player) { const key = player.seat; if (!key) return null; const [tid, idx] = key.split(':'); const t = this.tables[tid]; return t ? { t, seat: Number(idx) } : null; };

    // ---- seats (called by the rules in room.js)
    /** May this player take this chair? Returns '' or the reason why not. */
    GameRoom.prototype.canSit = function (player, tableId, seat) {
      const t = this.tables[tableId]; if (!t || t.game === 'match') return '';
      const s = t.slots[seat];
      if (t.phase === 'lobby') return s && s.kind === 'human' && this.present(s) ? 'That seat is taken.' : '';
      if (s && s.kind === 'human' && s.key === keyOf(player)) return ''; // coming back to your own place
      for (const k in t.slots) if (t.phase === 'play' && t.slots[k].kind === 'human' && t.slots[k].key === keyOf(player)) return 'Your place in this game is another chair (the one you left). Sit down there to carry on.';
      return t.phase === 'over' ? 'This table is showing its results. It opens again in a moment.' : 'A game is running at this table. You can watch it, and join the next one.';
    };
    GameRoom.prototype.onSit = function (player, tableId, seat) {
      const t = this.tables[tableId]; if (!t) return; const now = this.game.now();
      if (t.game === 'match') { this.sendMatch(player); return; }
      t.watchers.delete(player.id);
      const s = t.slots[seat];
      if (t.phase !== 'lobby' && s && s.key === keyOf(player)) { s.id = player.id; s.name = player.name; if (t.game === 'werewolf' && t.st) Werewolf.back(t.st, seat); if (t.host == null) this.pickHost(t); return this.push(t); }
      t.slots[seat] = { kind: player.bot ? 'npc' : 'human', id: player.id, key: keyOf(player), name: player.name, since: now };
      if (t.host == null || !this.present(t.slots[t.host])) this.pickHost(t);
      this.push(t);
    };
    GameRoom.prototype.onStand = function (player, tableId, seat) {
      const t = this.tables[tableId]; if (!t || t.game === 'match') return; const s = t.slots[seat]; if (!s || s.id !== player.id) return;
      if (t.phase === 'lobby' || s.kind === 'npc' && t.phase !== 'play') delete t.slots[seat];
      else if (t.phase === 'play') { // the place is kept: a computer plays on (Ludo, Colour Cards), or the 60-second clock starts (Werewolf)
        s.id = null; if (t.game === 'werewolf') { if (s.kind === 'human') Werewolf.leave(t.st, seat, this.game.now()); } else if (t.st.turn === seat) t.botAt = this.game.now() + BOT_MS;
        if (!this.humans(t).length && t.game !== 'werewolf') { t.frozen = this.game.now() + HOLD_MS; t.host = null; return this.push(t); } // nobody is left to play for: the game waits a little for someone to come back
      } else delete t.slots[seat];
      if (t.phase !== 'play' && !this.humans(t).length) return this.reset(t);
      this.pickHost(t); this.push(t);
    };
    GameRoom.prototype.onEnter = function (player) { this.game.send(player.id, this.summaryMsg()); };
    GameRoom.prototype.onLeave = function (player) { for (const k in this.tables) this.tables[k].watchers.delete(player.id); };
    GameRoom.prototype.resetAll = function () { for (const k in this.tables) this.tables[k] = this.fresh(k, this.tables[k].size); this.persist(); };
    /** How close a spectator has to stand: within 3 m of the chairs. */
    GameRoom.prototype.near = function (t, player) { const tb = this.game.world.tables.find((x) => x.id === t.id); return Math.hypot(player.x - tb.x, player.z - tb.z) <= tb.seats.reduce((m, s) => Math.max(m, Math.hypot(s.x - tb.x, s.z - tb.z)), 0) + 3; };

    // ---- what everyone in the room knows about the tables (for the table cards, the crowns and the glowing table tops)
    GameRoom.prototype.summaryMsg = function () {
      const wolf = (t) => (t.game === 'werewolf' && t.phase === 'play' && t.st ? t.st : null);
      return { type: this.id + '.tables', list: Object.values(this.tables).filter((t) => t.game !== 'match').map((t) => ({ id: t.id, game: t.game, phase: t.phase, size: t.size, host: t.host != null && t.slots[t.host] ? t.slots[t.host].id : null,
        night: !!wolf(t) && WW_NIGHT.includes(t.st.phase), ghosts: wolf(t) ? t.st.players.filter((p) => !p.alive && t.slots[p.seat] && t.slots[p.seat].id != null).map((p) => t.slots[p.seat].id) : [],
        seats: Object.keys(t.slots).map((k) => ({ seat: Number(k), name: t.slots[k].name, kind: t.slots[k].kind, here: t.slots[k].kind !== 'human' || this.present(t.slots[k]) })) })) };
    };
    GameRoom.prototype.summary = function () { this.sendMembers(this.summaryMsg()); this.persist(); };

    // ---- a restarted server carries on from the last turn: running games are saved after every move
    GameRoom.prototype.persist = function () {
      const out = {}; for (const t of Object.values(this.tables)) if (t.phase === 'play' && t.st) out[t.id] = { slots: t.slots, host: t.host, st: t.st, mind: t.mind };
      const json = JSON.stringify(out); if (json === this.savedJson) return; this.savedJson = json; this.game.saveMeta('gametables', JSON.parse(json));
    };
    /** Saved games come back paused: they wait up to 3 minutes for one of their players to sit down again. */
    GameRoom.prototype.restore = function () {
      const saved = this.game.loadMeta('gametables'); if (!saved || typeof saved !== 'object') return; const now = this.game.now();
      for (const id in saved) {
        const t = this.tables[id]; const r = saved[id]; if (!t || !r || !r.st || r.st.game !== t.game || !r.slots) continue;
        t.phase = 'play'; t.st = r.st; t.host = null; t.mind = r.mind || { suspect: null, found: {} }; t.frozen = now + RETURN_MS;
        for (const k in r.slots) { const s = r.slots[k]; t.slots[k] = { kind: s.kind === 'human' ? 'human' : 'bot', id: null, key: s.key, name: s.name, since: s.since || 0 }; }
      }
      this.savedJson = JSON.stringify(saved);
    };
    GameRoom.prototype.thaw = function (t, now) {
      t.frozen = 0; const st = t.st;
      if (t.game !== 'werewolf') return this.arm(t);
      st.begun = now; st.until = now + Werewolf.time(st, st.phase);  // the phase starts again; the others have 60 seconds to come back
      for (const k in t.slots) if (t.slots[k].kind === 'human' && !this.present(t.slots[k])) Werewolf.leave(st, Number(k), now);
    };

    // ---- one player's (or spectator's) view of a table
    GameRoom.prototype.view = function (t, seat, playerId) {
      const now = this.game.now(); const st = t.st;
      const seats = []; for (let i = 0; i < t.size; i++) { const s = t.slots[i]; seats.push(s ? { seat: i, name: s.name, kind: s.kind, id: s.id, here: s.kind !== 'human' || this.present(s), host: i === t.host } : { seat: i, name: null }); }
      const n = Object.keys(t.slots).length; const min = TABLES[t.id].min; const people = this.humans(t).length;
      const v = { table: t.id, game: t.game, title: t.title, phase: t.phase, seats, host: t.host, you: seat, watching: seat == null, solo: !!this.game.solo, serverNow: now,
        canStart: t.phase === 'lobby' && seat === t.host && n >= min && people >= 1, need: n >= min ? '' : `Needs ${min - n} more player${min - n === 1 ? '' : 's'} (at least ${min}).`,
        bots: t.game !== 'werewolf' || !!this.game.solo, clock: t.phase === 'play' && t.game !== 'werewolf' && st && !st.over ? { seat: st.turn, until: t.clock } : null, g: null };
      if (!st) return v;
      if (t.game === 'ludo') v.g = { game: 'ludo', all: st.all, order: st.order, horses: st.horses, turn: st.turn, phase: st.phase, die: st.die, moves: st.turn === seat ? st.moves : [], ranks: st.ranks, home: st.home, over: st.over, last: st.last, n: st.n };
      else if (t.game === 'cards') {
        const counts = {}; for (const s of st.all) counts[s] = st.hands[s].length;
        v.g = { game: 'cards', all: st.all, counts, hand: seat != null && st.hands[seat] ? st.hands[seat] : [], playable: seat != null && st.turn === seat && !st.over ? Cards.playable(st, seat) : [], top: st.top, color: st.color, dir: st.dir, turn: st.turn,
          drawn: st.turn === seat ? st.drawn : null, deck: st.draw.length, one: st.one ? { seat: st.one.seat, until: st.one.until, called: st.one.called } : null, over: st.over, winner: st.winner, ranks: st.ranks, last: st.last, n: st.n };
      } else v.g = Werewolf.view(st, seat);
      return v;
    };
    /** Send the table to everyone who sits at it or watches it, and refresh the room's summary. */
    GameRoom.prototype.push = function (t) {
      for (const k in t.slots) { const s = t.slots[k]; if (this.present(s)) this.game.send(s.id, { type: this.id + '.state', table: t.id, view: this.view(t, Number(k), s.id) }); }
      for (const id of t.watchers) { if (this.members.has(id)) this.game.send(id, { type: this.id + '.state', table: t.id, view: this.view(t, null, id) }); else t.watchers.delete(id); }
      this.summary();
    };

    // ---- starting, ending
    GameRoom.prototype.start = function (t) {
      const now = this.game.now(); const seats = Object.keys(t.slots).map(Number).sort((a, b) => a - b);
      for (const k of seats) if (t.slots[k].kind === 'npc' && !this.player(t.slots[k].id)) t.slots[k].id = null;
      t.phase = 'play'; t.paid = false; t.mind = { suspect: null, found: {} }; t.talkAt = 0; t.startedAt = now;
      if (this.game.track) { const hs = this.humans(t); for (const k of hs) this.game.track(this.player(t.slots[k].id), 'game_start', { game: t.game, humans: hs.length, bots: seats.length - hs.length }); }
      if (t.game === 'ludo') t.st = Ludo.create(seats);
      else if (t.game === 'cards') t.st = Cards.create(seats, this.rng);
      else t.st = Werewolf.create(seats.map((k) => ({ seat: k, name: t.slots[k].name })), now, this.rng, this.humans(t).length <= 1); // one person among computer players = solo practice
      this.arm(t); this.push(t);
    };
    /** Start the clock for whoever is to move (Ludo, Colour Cards). */
    GameRoom.prototype.arm = function (t) { const now = this.game.now(); if (t.game === 'werewolf' || !t.st || t.st.over) return; t.clock = now + TURN_MS; t.botAt = now + BOT_MS; };
    GameRoom.prototype.finish = function (t) {
      if (t.paid) return; t.paid = true; t.phase = 'over'; t.overAt = this.game.now(); const st = t.st; const E = this.game.ECON;
      const winners = t.game === 'werewolf' ? st.players.filter((p) => (p.role === 'wolf') === (st.winner === 'wolves')).map((p) => p.seat) : t.game === 'ludo' ? st.home.slice(0, 1) : st.ranks.slice(0, 1); // a Ludo game stopped before anyone is home has no winner
      for (const k of Object.keys(t.slots).map(Number)) { // results go into the profile; a win pays Xu
        const s = t.slots[k]; const p = this.present(s) ? this.player(s.id) : null; if (!p || !p.pr) continue;
        const g = (p.pr.stats.games = p.pr.stats.games || {}); const rec = (g[t.game] = g[t.game] || { played: 0, won: 0 }); rec.played++;
        p.dirty = true;
        if (this.game.track) this.game.track(p, 'game_end', { game: t.game, won: winners.includes(k), minutes: t.startedAt ? Math.round((t.overAt - t.startedAt) / 6000) / 10 : null });
        if (!winners.includes(k)) continue;
        rec.won++; p.pr.stats.gamesWon = (p.pr.stats.gamesWon || 0) + 1;
        if (t.overAt - (p.lastGameWin || 0) >= E.gameCooldownSec * 1000) { p.lastGameWin = t.overAt; this.game.award(p, E.gameWin, 'game', t.title); } // Xu at most once per cooldown
      }
    };

    // ---- computer players and clocks (called about twice a second)
    GameRoom.prototype.tick = function () {
      const now = this.game.now();
      for (const t of Object.values(this.tables)) {
        for (const id of t.watchers) { const q = this.player(id); if (!q || !this.near(t, q)) { t.watchers.delete(id); if (q) this.game.send(id, { type: this.id + '.state', table: t.id, view: null }); } }
        if (t.phase === 'over') { if (!this.humans(t).length) this.reset(t); else if (now - t.overAt > 120000) this.again(t); continue; } // results stay up for two minutes at most
        if (t.frozen) { if (this.humans(t).length) { this.thaw(t, now); this.push(t); } else { if (now > t.frozen) this.reset(t); continue; } } // restored after a restart
        if (t.phase !== 'play' || !t.st) continue; const st = t.st;
        if (t.game === 'werewolf') { this.tickWolf(t, now); continue; }
        if (st.over) { this.finish(t); this.push(t); continue; }
        const seat = st.turn; const auto = this.auto(t, seat);
        if (t.game === 'cards') { // computer players say "One card!" at once, and catch people who forgot
          const o = st.one;
          if (o && !o.called && this.auto(t, o.seat)) { Cards.callOne(st, o.seat); this.push(t); }
          else if (o && !o.called && now > o.until + 1500 && st.all.some((s) => s !== o.seat && this.auto(t, s))) { const by = st.all.find((s) => s !== o.seat && this.auto(t, s)); if (Cards.catchOne(st, by, now, this.rng) != null) { this.note(t, `${t.slots[by].name} caught ${t.slots[o.seat].name} without "One card!": draw 2.`); this.push(t); } }
        }
        if (auto ? now < t.botAt : now < t.clock) continue;       // a person has 20 seconds; then the computer moves for them
        const before = st.n;
        if (t.game === 'ludo') { if (st.phase === 'roll') Ludo.roll(st, seat, this.rng); else Ludo.move(st, seat, Ludo.bot(st, seat)); }
        else { const m = Cards.bot(st, seat); if (m.play != null) Cards.play(st, seat, m.play, m.color, now, this.rng); else if (m.draw) Cards.draw(st, seat, this.rng); else Cards.pass(st, seat); }
        if (st.n === before) { t.botAt = now + BOT_MS; continue; }
        this.afterMove(t, seat);
      }
    };
    GameRoom.prototype.afterMove = function (t, seat) {
      const st = t.st; const now = this.game.now();
      if (t.game === 'ludo' && st.phase === 'move' && st.moves.length === 1 && st.turn === seat) Ludo.move(st, seat, st.moves[0].horse); // only one horse can move: no need to ask
      const fresh = t.game === 'ludo' ? st.phase === 'roll' : st.turn !== seat || st.drawn == null;
      if (st.over) this.finish(t);
      else if (fresh) this.arm(t);                                 // a new turn (or another roll after a 6): 20 seconds again
      else { t.botAt = now + BOT_MS; if (!this.auto(t, seat)) t.clock = Math.max(t.clock, now + 6000); } // choosing a horse, or what to do with the card just drawn
      this.push(t);
    };
    GameRoom.prototype.note = function (t, text) { this.say(t, { system: true, text, channel: 'day' }); };
    /** Deliver a chat line of this table to the people allowed to read it. */
    GameRoom.prototype.say = function (t, m) {
      const msg = Object.assign({ type: this.id + '.chat', table: t.id }, m);
      const ok = (seat) => t.game !== 'werewolf' || !t.st || Werewolf.hears(t.st, seat, m.channel);
      for (const k in t.slots) { const s = t.slots[k]; if (this.present(s) && ok(Number(k))) this.game.send(s.id, msg); }
      for (const id of t.watchers) if (ok(null)) this.game.send(id, msg);
    };
    GameRoom.prototype.tickWolf = function (t, now) {
      const st = t.st; const before = st.n;
      Werewolf.sweep(st, now);
      if (!st.over) {
        for (const p of Werewolf.alive(st)) { // computer players act as soon as their phase begins
          if (!this.auto(t, p.seat) || (t.slots[p.seat] && t.slots[p.seat].kind === 'human')) continue;
          const a = st.act; const done = st.phase === 'guard' ? a.guard != null : st.phase === 'wolf' ? a.wolf[p.seat] != null : st.phase === 'witch' ? !!a.witch : st.phase === 'seer' ? a.seer != null : st.phase === 'vote' ? st.votes[p.seat] != null : true;
          if (done) continue;
          if (now < st.begun + (st.phase === 'vote' ? (st.fast ? 6000 : 12000) : 1500)) continue; // they take a moment (and may follow a vote that is already there)
          const m = Werewolf.bot(st, p.seat, this.rng, t.mind); if (m) Werewolf.act(st, p.seat, m);
        }
        if (st.phase === 'talk' && now >= t.talkAt) { // a little table talk from the computer players
          t.talkAt = now + (st.fast ? 2500 : 9000) + this.rng() * 4000;
          const bots = Werewolf.alive(st, (p) => this.auto(t, p.seat) && t.slots[p.seat] && t.slots[p.seat].kind !== 'human');
          if (bots.length) {
            const b = pick(bots, this.rng); const found = Object.keys(t.mind.found).map(Number).find((s) => t.mind.found[s] && Werewolf.get(st, s).alive);
            let line; let about = null;
            if (b.role === 'seer' && found != null) { about = found; line = pick(BOT_TALK.seerAccuse, this.rng); }
            else if (b.role === 'wolf' && this.rng() < 0.6) { const prey = Werewolf.alive(st, (p) => p.role !== 'wolf'); if (prey.length) { about = pick(prey, this.rng).seat; line = pick(BOT_TALK.wolfAccuse, this.rng); } }
            else if (b.role !== 'wolf' && this.rng() < 0.45) { const w = Werewolf.alive(st, (p) => p.role === 'wolf'); if (w.length) { about = pick(w, this.rng).seat; line = pick(BOT_TALK.hunch, this.rng); } } // a lucky hunch now and then keeps practice games fair
            if (!line) line = pick(BOT_TALK.idle, this.rng);
            if (about != null) { t.mind.suspect = about; line = line.replace('{n}', Werewolf.get(st, about).name); }
            this.say(t, { from: b.seat, name: b.name, text: line, channel: 'day' });
          }
        }
        if (now >= st.until || (st.fast && Werewolf.ready(st) && now >= st.begun + 2500)) Werewolf.advance(st, now, this.rng);
      }
      if (st.over) this.finish(t);
      if (st.n !== before) this.push(t);
    };

    // ---- Colour Match (one player per chair): progress is kept in the profile; the browser plays, the room checks what it can
    const matchOf = (pr) => { if (!pr.match || typeof pr.match !== 'object') pr.match = { stars: {}, best: {}, save: null }; if (!pr.match.stars) pr.match.stars = {}; if (!pr.match.best) pr.match.best = {}; return pr.match; };
    GameRoom.prototype.sendMatch = function (player) { if (player.pr) this.game.send(player.id, { type: this.id + '.match', progress: matchOf(player.pr) }); };
    GameRoom.prototype.matchTop = function (player) {
      const rows = new Map(); const add = (key, name, pr) => { const s = pr && pr.match && pr.match.stars; if (!s || rows.has(key)) return; const total = Object.values(s).reduce((a, b) => a + (b | 0), 0); if (total > 0) rows.set(key, { name, stars: total, levels: Object.keys(s).length }); };
      for (const q of this.game.players.values()) if (q.pr && !q.guest) add(q.token || q.id, q.name, q.pr);
      for (const [tok, pr] of this.game.allProfiles()) if (!String(tok).startsWith('__')) add(tok, (pr && pr.name) || 'Classmate', pr);
      this.game.send(player.id, { type: this.id + '.matchTop', rows: [...rows.values()].sort((a, b) => b.stars - a.stars || b.levels - a.levels).slice(0, 10), me: player.name });
    };

    /** The ordinary table chat of a seated player is handled here too, so that nobody can talk around the rules. */
    GameRoom.prototype.onTableChat = function (player, tableId, text) {
      const t = this.tables[tableId]; if (!t || t.game === 'match') return false;
      this.onMessage(player, { type: this.id + '.chat', table: tableId, text }); return true;
    };

    // ---- messages from the browsers
    GameRoom.prototype.onMessage = function (player, msg) {
      if (!this.members.has(player.id)) return;
      const kind = msg.type.slice(this.id.length + 1); const now = this.game.now();
      if (kind.startsWith('match')) {
        if (!player.pr) return; const M = matchOf(player.pr);
        if (kind === 'matchGet') return this.sendMatch(player);
        if (kind === 'matchTop') return this.matchTop(player);
        if (kind === 'matchSave') { // the level being played, so that it can be continued later
          const s = msg.save; if (s == null) M.save = null; else if (typeof s === 'object' && JSON.stringify(s).length <= 2000 && s.level >= 1 && s.level <= MATCH_LEVELS) M.save = s; else return;
          player.dirty = true; return;
        }
        if (kind === 'matchDone') {
          const level = Math.floor(Number(msg.level)); const stars = Math.floor(Number(msg.stars)); const score = Math.floor(Number(msg.score));
          if (!(level >= 1 && level <= MATCH_LEVELS && stars >= 1 && stars <= 3 && score >= 0 && score < 1e7)) return;
          if (level > 1 && !M.stars[level - 1]) return;             // levels open one after another
          if (now - (player.lastMatch || 0) < 4000) return; player.lastMatch = now;
          const first = !M.stars[level];
          M.stars[level] = Math.max(M.stars[level] | 0, stars); M.best[level] = Math.max(M.best[level] | 0, score); M.save = null; player.dirty = true;
          const g = (player.pr.stats.games = player.pr.stats.games || {}); const rec = (g.match = g.match || { played: 0, won: 0 }); rec.played++; rec.won++;
          if (first) this.game.award(player, this.game.ECON.gameWin, 'game', 'Colour Match level ' + level);
          if (this.game.track) this.game.track(player, 'match_level_done', { level, stars, first });
          return this.sendMatch(player);
        }
        return;
      }
      const t = this.tables[String(msg.table)]; if (!t || t.game === 'match') return;
      const seat = this.seatOf(t, player.id); const st = t.st;
      if (kind === 'watch') { // stand next to the table (3 m) to watch
        if (msg.on && seat == null && this.near(t, player)) { t.watchers.add(player.id); this.game.send(player.id, { type: this.id + '.state', table: t.id, view: this.view(t, null, player.id) }); }
        else { t.watchers.delete(player.id); this.game.send(player.id, { type: this.id + '.state', table: t.id, view: null }); }
        return;
      }
      if (kind === 'chat') {
        if (seat == null) return; if (now - (player.lastGameChat || 0) < 1000) return; // one message a second
        const text = cleanChat(msg.text); if (!text) return; player.lastGameChat = now;
        const channel = t.game === 'werewolf' && st && t.phase === 'play' ? Werewolf.channel(st, seat) : 'day';
        if (!channel) return this.toast(player, st.phase === 'words' ? 'Only the player who was voted out may speak now.' : 'Shh… it is night. Only the Werewolves whisper.', 'info');
        return this.say(t, { from: seat, id: player.id, name: player.name, color: player.color, text, channel });
      }
      if (seat == null) return;
      if (t.phase === 'lobby') {
        if (kind === 'addBot') {
          if (t.game === 'werewolf' && !this.game.solo) return this.toast(player, 'Werewolf is for real players only.');
          const free = []; for (let i = 0; i < t.size; i++) if (!t.slots[i]) free.push(i);
          if (!free.length) return this.toast(player, 'Every seat is taken.');
          const n = Object.values(t.slots).filter((s) => s.kind === 'bot').length + 1;
          t.slots[free[0]] = { kind: 'bot', id: null, key: 'bot', name: 'Computer ' + n, since: now }; return this.push(t);
        }
        if (kind === 'removeBot') { const k = Number(msg.seat); if (t.slots[k] && t.slots[k].kind === 'bot') { delete t.slots[k]; this.push(t); } return; }
        if (kind === 'start') {
          if (seat !== t.host) return this.toast(player, 'Only the host of the table can start.');
          const n = Object.keys(t.slots).length; const min = TABLES[t.id].min;
          if (n < min) return this.toast(player, `Needs ${min - n} more player${min - n === 1 ? '' : 's'} (at least ${min}).`);
          return this.start(t);
        }
        return;
      }
      if (t.phase === 'over') {
        if (kind === 'again') this.again(t);
        return;
      }
      if (!st) return;
      if (kind === 'end' && t.game === 'ludo') { if (seat !== t.host || st.over) return; Ludo.end(st); this.finish(t); return this.push(t); } // the host may stop the game: the rest is ranked by how far the horses are
      if (kind !== 'move') return;
      const before = st.n; let why = '';
      if (t.game === 'ludo') {
        if (st.turn !== seat) return;
        if (msg.roll) Ludo.roll(st, seat, this.rng); else if (msg.horse != null) Ludo.move(st, seat, Number(msg.horse));
      } else if (t.game === 'cards') {
        if (msg.one) { if (Cards.callOne(st, seat)) this.push(t); return; }
        if (msg.catch) { const who = Cards.catchOne(st, seat, now, this.rng); if (who != null) { this.note(t, `${player.name} caught ${t.slots[who].name} without "One card!": draw 2.`); this.push(t); } return; }
        if (st.turn !== seat) return;                               // a card played out of turn (or twice in a hurry) is simply ignored
        if (msg.play != null) why = Cards.play(st, seat, Number(msg.play), String(msg.color || ''), now, this.rng);
        else if (msg.draw) Cards.draw(st, seat, this.rng); else if (msg.pass) Cards.pass(st, seat);
      } else {
        if (msg.skip) { if (st.fast && ['announce', 'talk', 'result', 'words'].includes(st.phase)) { Werewolf.advance(st, now, this.rng); if (st.over) this.finish(t); this.push(t); } return; } // solo practice only
        why = Werewolf.act(st, seat, msg); if (why) return this.toast(player, why); if (st.n !== before) this.push(t); return;
      }
      if (why) return this.toast(player, why);
      if (st.n !== before) this.afterMove(t, seat);                 // an illegal move changes nothing
    };
    /** Empty a table (nobody is left to play for). Strolling villagers who still sit there keep their chairs. */
    GameRoom.prototype.reset = function (t) {
      if (!t) return this.resetAll();                              // the game emptied out
      const w = t.watchers; const f = this.tables[t.id] = this.fresh(t.id, t.size);
      for (const k in t.slots) { const s = t.slots[k]; if (s.kind === 'npc' && s.id != null && this.player(s.id)) f.slots[k] = s; }
      for (const id of w) this.game.send(id, { type: this.id + '.state', table: t.id, view: null });
      this.summary();
    };
    /** After the results: back to the lobby with the people who are still here (and the computer players). */
    GameRoom.prototype.again = function (t) {
      for (const k of Object.keys(t.slots)) { const s = t.slots[k]; if (s.kind !== 'bot' && !(s.id != null && this.player(s.id))) delete t.slots[k]; }
      t.phase = 'lobby'; t.st = null; this.pickHost(t); this.push(t);
    };
    return GameRoom;
  }

  const api = { Ludo, Cards, Werewolf, TABLES, TURN_MS, MATCH_LEVELS, cleanChat, makeGameRoom };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CampusGames = api;
})(typeof self !== 'undefined' ? self : this);
