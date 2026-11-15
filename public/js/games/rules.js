// Rule books of the four Game Room games (spec "Sách luật"): the same seven parts for every game, with pictures,
// readable in about two minutes — plus the guided practice for Colour Match and Colour Cards.
// Opened from the table card, the lobby, and the "?" button during a game (which does not stop the game).
import { el } from '../util.js';
import { cardEl, mountCards, CARD_COLOR } from './cards.js';
import { gemEl, mountMatch } from './match.js';
import { horseEl, makeDie } from './ludo.js';
import { ROLE } from './werewolf.js';

const pic = (node, text) => el('div', { class: 'rk-pic' }, el('span', { class: 'rk-art' }, ...[].concat(node)), el('span', { text }));
const gem = (c, k) => gemEl(c, k);
const card = (c, v) => cardEl({ id: 0, c, v }, { small: true });
const die = (v) => { const d = makeDie(); d.show(v); d.node.classList.add('small'); return d.node; };
const row = (...kids) => el('div', { class: 'rk-strip' }, ...kids);
const mark = (node, good) => el('span', { class: 'rk-mark ' + (good ? 'yes' : 'no') }, node, el('i', { text: good ? '✓' : '✗' }));
const cell = (...kids) => el('span', { class: 'rk-cell' }, ...kids);

export const BOOKS = {
  match: {
    title: '🎨 Colour Match', practice: true,
    goal: 'Line up three or more gems of the same colour to clear them, and reach the goal of the level before your moves run out.',
    setup: 'One player. A board of 8 × 8 gems in six colours. Each chair at the table plays its own game.',
    turn: ['Swap two gems that touch — click one and then its neighbour, or drag it.', 'If the swap makes a line of three or more, those gems pop, the gems above fall, and new gems drop in from the top.', 'New lines made by falling gems pop too: a combo, worth ×2, ×3 and more.', 'A swap that lines nothing up slides back and costs no move.'],
    specials: () => [
      pic(gem(0, 'h'), 'Striped gem — line up 4. When it pops it clears its whole row or column.'),
      pic(gem(2, 'b'), 'Bomb — make an L or a T of 5. It clears the 3 × 3 around it.'),
      pic(gem(-1, 'w'), 'Rainbow gem — line up 5. Swap it with any gem and every gem of that colour pops.'),
      pic([gem(1, 'h'), gem(3, 'v')], 'Swap two special gems with each other: striped + striped clears a cross, bomb + striped clears 3 rows and 3 columns, rainbow + rainbow clears the board.'),
    ],
    win: 'You finish a level when its goal is reached: a score (levels 1–5), a number of gems of certain colours (6–15), every ice cell broken (16–25) or both (26–30). Moves left over turn into striped gems for bonus points; the final score gives 1 to 3 stars. Out of moves? Play again at once — there are no lives and no timers.',
    example: () => [row(cell(gem(0, '')), cell(gem(0, '')), cell(gem(3, '')), cell(gem(0, ''))), row(cell(gem(4, '')), cell(gem(1, '')), el('span', { class: 'rk-cell hot' }, gem(0, '')), cell(gem(5, ''))),
      el('p', { text: 'Swap the purple gem in the bottom row with the teal gem above it: the top row becomes purple – purple – purple – purple. Four in a line pop, and a striped gem is left where you moved.' })],
    tips: ['Look for moves low on the board: falling gems often make combos for free.', 'Save special gems for the goal — a striped gem through a row of ice is worth more than a quick three.', 'Stuck? Wait five seconds and two gems start blinking as a hint.'],
  },
  cards: {
    title: '🃏 Colour Cards', practice: true,
    goal: 'Be the first player to get rid of all your cards.',
    setup: '2 to 4 players (computer players can fill empty seats). 108 cards in four colours: purple, yellow, coral and teal. Everyone gets 7 cards; one card is turned face up to start the pile.',
    turn: ['Play one card that matches the top card of the pile: the same colour, or the same number or symbol. A Wild always fits.', 'Nothing fits? Draw one card from the deck. If that card fits you may play it straight away; otherwise your turn ends.', 'When you play your second-to-last card, press “One card!” within 3 seconds.', 'You have 20 seconds; after that the computer plays a card for you.'],
    specials: () => [
      pic(card('p', 'skip'), 'Skip — the next player misses their turn.'),
      pic(card('y', 'rev'), 'Reverse — play goes round the other way (with two players it works like Skip).'),
      pic(card('r', '+2'), '+2 — the next player draws 2 cards and misses their turn. It cannot be answered with another +2.'),
      pic(card('w', 'wild'), 'Wild — fits on anything; you choose the colour that is played next.'),
      pic(card('w', '+4'), 'Wild +4 — choose the colour; the next player draws 4 and misses their turn. Only allowed when you hold no card of the colour in play.'),
    ],
    win: 'The first player with no cards left wins the game. Every game counts on its own. Forgot “One card!”? If another player presses “Catch!” after the 3 seconds, you draw 2 cards.',
    example: () => [row(el('span', { class: 'rk-label', text: 'Pile' }), card('t', '7'), el('span', { class: 'rk-label', text: 'Your hand' }), mark(card('t', '2'), true), mark(card('r', '7'), true), mark(card('y', '4'), false), mark(card('w', 'wild'), true)),
      el('p', { text: 'The top card is a teal 7. Your teal 2 fits (same colour), your coral 7 fits (same number) and the Wild always fits. The yellow 4 does not.' })],
    tips: ['Play the colour you hold most of, so that you can keep playing it.', 'Keep a Wild for the moment nothing else fits.', 'When the next player is down to one or two cards, hit them with a Skip or a +2.'],
  },
  ludo: {
    title: '🐎 Ludo',
    goal: 'Bring all four of your horses around the board and into your home column before the others do.',
    setup: '2 to 4 players (computer players can fill empty seats), each with a colour — red, blue, yellow or green — and 4 horses waiting in the stable of that colour. One die.',
    turn: ['Press “Roll”.', 'A 1 or a 6 lets you bring a horse out of the stable onto your start cell.', 'Otherwise choose one of your horses on the track and move it exactly that many cells, clockwise.', 'A 6 gives you another roll.', 'No horse can move? Your turn passes by itself.'],
    specials: () => [
      pic([die(6), die(1)], 'Only a 6 or a 1 opens the stable. A 6 also rolls again.'),
      pic([horseEl(0), el('b', { text: '→' }), horseEl(1)], 'Kick — land exactly on an opponent’s horse and it goes back to its stable.'),
      pic([horseEl(2), horseEl(3), el('b', { text: '✗' })], 'Block — no horse may jump over another horse (yours or anyone’s), and two of your horses cannot share a cell.'),
      pic([cell(el('b', { text: '1' })), cell(el('b', { text: '2' })), cell(el('b', { text: '3' }))], 'Home column — first stop exactly on the cell in front of it. Then each home cell needs its own number: a 1 for cell 1, a 2 to climb to cell 2, and so on up to 6.'),
    ],
    win: 'The first player with all four horses inside the home column wins. The others play on for second and third place, or the host ends the game. A game with two players takes about 20 minutes; with four it takes much longer.',
    example: () => [row(cell(horseEl(0)), cell(), cell(), cell(), cell(horseEl(1)), cell()), el('p', { text: 'Red rolls a 4. The red horse walks four cells and lands exactly on the blue horse: blue is kicked back to its stable. With a 5 red could not have moved this horse at all — it may not jump over blue.' })],
    tips: ['Bring a second horse out early: with only one horse you often cannot move.', 'Do not stop just in front of an opponent’s horse — any exact roll kicks you.', 'A horse in the home column is safe: climb when the die lets you.'],
  },
  werewolf: {
    title: '🐺 Werewolf',
    goal: 'The village wants to find and vote out every Werewolf; the Werewolves want to be as many as everyone else.',
    setup: '6 to 10 real players (8 is best). The computer is the storyteller: it deals every player a secret role and runs the clock. With 6 players there are 2 Werewolves, a Seer, a Guard and 2 Villagers; from 7 a Witch joins; from 9 there are 3 Werewolves.',
    turn: ['Night: the Guard chooses someone to protect (20 s), the Werewolves choose someone to bite (40 s), the Witch may heal or poison (20 s), the Seer looks at one player (20 s). Every step always runs its full time.', 'Morning: everyone learns who died in the night, and that player’s role.', 'Day: 2 minutes of discussion in the table chat.', 'Vote (30 s): click the player you want out. You can change your vote; everyone sees the count.', 'The player with the most votes speaks their last words (15 s) and is out. A tie means nobody goes. Then night falls again.'],
    specials: () => ['wolf', 'seer', 'guard', 'witch', 'villager'].map((r) => pic(el('span', { class: 'rk-role', text: ROLE[r].icon }), ROLE[r].name + ' — ' + ROLE[r].text)),
    win: 'The village wins when no Werewolf is left. The Werewolves win as soon as they are at least as many as the other living players. At the end every role is shown, with a timeline of each night.',
    example: () => [row(el('span', { class: 'rk-role', text: '🐺' }), el('b', { text: '→' }), el('span', { class: 'rk-role', text: '👤' }), el('span', { class: 'rk-role', text: '🛡️' }), el('b', { text: '=' }), el('span', { class: 'rk-role', text: '☀️' })),
      el('p', { text: 'Night 2: the Werewolves bite Lan, but the Guard protected Lan — in the morning nobody has died. During the day the Seer writes “I looked at Minh last night: Werewolf!”. The village votes Minh out, and Minh’s role card shows a Werewolf.' })],
    tips: ['Villager: say whom you suspect and why — silence helps the Werewolves.', 'Seer: share what you saw at the right moment; once you speak, the Werewolves will come for you.', 'Dead players become ghosts: they watch, see every role and have their own chat, but cannot talk to the living.'],
  },
};
const HEAD = ['Goal', 'Getting ready', 'One turn', 'Special pieces', 'You win when', 'Example', 'Tips for beginners'];

/**
 * The rule book of one game. opts: { onBack, backText, onPractice (shown for games with a guided practice) }
 */
export function ruleBook(game, opts = {}) {
  const b = BOOKS[game]; const sec = (i, ...kids) => el('section', {}, el('h4', {}, el('i', { text: i + 1 }), HEAD[i]), ...kids);
  if (game === 'cards') HEAD[3] = 'Special cards'; else if (game === 'werewolf') HEAD[3] = 'The roles'; else if (game === 'match') HEAD[3] = 'Special gems'; else HEAD[3] = 'Special moves';
  return el('div', { class: 'rk-book' },
    el('div', { class: 'rk-head' }, el('b', { text: b.title + ' — rules' }), el('span', { class: 'meta', text: 'About two minutes to read.' }),
      b.practice && opts.onPractice ? el('button', { class: 'nut nho vang', type: 'button', text: '▶ Try it with a guide', onclick: opts.onPractice }) : null,
      opts.onBack ? el('button', { class: 'nut nho xam', type: 'button', text: opts.backText || '← Back', onclick: opts.onBack }) : null),
    sec(0, el('p', { text: b.goal })), sec(1, el('p', { text: b.setup })), sec(2, el('ol', {}, ...b.turn.map((t) => el('li', { text: t })))),
    sec(3, el('div', { class: 'rk-pics' }, ...b.specials())), sec(4, el('p', { text: b.win })), sec(5, el('div', { class: 'rk-example' }, ...b.example())), sec(6, el('ul', {}, ...b.tips.map((t) => el('li', { text: t })))));
}

// ---------------------------------------------------------------- guided practice
/** Colour Match: level 1 with an arrow on the gems to swap for the first three moves. Nothing is saved. */
export function matchPractice(root, { onBack, toast }) {
  return mountMatch(root, { send() {}, toast, rules: onBack, back: onBack }, { practice: true });
}
/** Colour Cards: a short game against the computer, with an arrow on the card (or the deck, or the button) to click. */
export function cardsPractice(root, { onBack, toast }) {
  const { Cards } = window.CampusGames; const rng = Math.random; let st; let timer = 0; let alive = true;
  const box = el('div', { class: 'rk-practice' }); const foot = el('div', { class: 'gt-foot' }); root.append(box, foot);
  const seats = [{ seat: 0, name: 'You', kind: 'human', id: null, here: true, host: true }, { seat: 1, name: 'Computer', kind: 'bot', id: null, here: true, host: false }];
  const take = (pool, [c, v]) => pool.splice(pool.findIndex((x) => x.c === c && x.v === v), 1)[0];
  function deal() { // a prepared deal that shows a matching colour, a Skip, a Wild and "One card!" in four moves
    const pool = Cards.deck(); const mine = [['p', '3'], ['y', '7'], ['p', 'skip'], ['w', 'wild']]; const theirs = [['p', '5'], ['r', '7'], ['t', '2'], ['y', '9']];
    const A = mine.map((x) => take(pool, x)); const B = theirs.map((x) => take(pool, x)); const top = take(pool, ['p', '7']);
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); const t = pool[i]; pool[i] = pool[j]; pool[j] = t; }
    const fill = pool.splice(0, 6); const seq = []; for (let k = 0; k < 7; k++) { seq.push(k < 4 ? A[k] : fill[k - 4]); seq.push(k < 4 ? B[k] : fill[k - 1]); }
    st = Cards.create([0, 1], rng, [...pool, top, ...seq.reverse()]);
    for (const s of [0, 1]) st.draw.unshift(...st.hands[s].splice(4));           // a short game: four cards each
  }
  function hint() {
    if (st.over || (st.turn !== 0 && !(st.one && st.one.seat === 0 && !st.one.called))) return null;
    if (st.one && st.one.seat === 0 && !st.one.called) return { one: true, text: 'One card left: say “One card!” within 3 seconds.' };
    const m = Cards.bot(st, 0);
    if (m.draw) return { draw: true, text: 'Nothing fits: click the deck to draw a card.' };
    if (m.pass) return { pass: true, text: 'Keep the card and pass.' };
    const c = st.hands[0].find((x) => x.id === m.play);
    const text = c.c === 'w' ? 'A Wild fits on anything: click it twice, then choose a colour.' : c.v === 'skip' ? 'Skip: the computer misses its turn. Click the card twice.' : c.v === 'rev' ? 'Reverse: with two players it works like Skip.' : c.v === '+2' ? '+2: the computer draws two cards and misses its turn.'
      : c.c === st.color ? `Same colour as the pile (${CARD_COLOR[c.c]}): click the card twice, or drag it up.` : 'Same number as the top card: that fits too.';
    return { play: c.id, color: m.color, text };
  }
  const view = () => {
    const counts = {}; for (const s of st.all) counts[s] = st.hands[s].length;
    return { table: 'practice', game: 'cards', phase: st.over ? 'over' : 'play', seats, host: 0, you: 0, clock: null, hint: hint(),
      g: { game: 'cards', all: st.all, counts, hand: st.hands[0], playable: st.turn === 0 && !st.over ? Cards.playable(st, 0) : [], top: st.top, color: st.color, dir: st.dir, turn: st.turn, drawn: st.turn === 0 ? st.drawn : null, deck: st.draw.length,
        one: st.one ? { ...st.one } : null, over: st.over, winner: st.winner, ranks: st.ranks, last: st.last, n: st.n } };
  };
  const api = {
    colorOf: () => null, now: () => Date.now(), toast,
    send(kind, m) {
      if (kind !== 'move' || st.over) return; const now = Date.now();
      if (m.one) Cards.callOne(st, 0);
      else if (st.turn !== 0) return;
      else if (m.play != null) { const why = Cards.play(st, 0, m.play, m.color || '', now, rng); if (why) return toast(why); }
      else if (m.draw) Cards.draw(st, 0, rng); else if (m.pass) Cards.pass(st, 0);
      refresh();
    },
  };
  const screen = mountCards(box, api);
  function computer() {
    if (!alive || st.over || st.turn !== 1) return;
    const m = Cards.bot(st, 1); const now = Date.now();
    if (m.play != null) { Cards.play(st, 1, m.play, m.color, now, rng); Cards.callOne(st, 1); } else if (m.draw) Cards.draw(st, 1, rng); else Cards.pass(st, 1);
    refresh();
  }
  function refresh() {
    screen.update(view()); clearTimeout(timer);
    if (st.over) foot.replaceChildren(el('b', { text: st.winner === 0 ? 'You are out of cards — that is how you win! 🎉' : 'The computer got rid of its cards first. Try again!' }),
      el('button', { class: 'nut nho vang', type: 'button', text: 'Play it again', onclick: begin }), el('button', { class: 'nut nho xam', type: 'button', text: '← Back to the rules', onclick: onBack }));
    else if (st.turn === 1) timer = setTimeout(computer, 1200);
  }
  function begin() { deal(); foot.replaceChildren(el('span', { class: 'meta', text: 'Guided practice against the computer — follow the arrow. Nothing here counts.' }), el('button', { class: 'nut nho xam', type: 'button', text: '← Back to the rules', onclick: onBack })); refresh(); }
  begin();
  return { destroy() { alive = false; clearTimeout(timer); screen.destroy(); } };
}
