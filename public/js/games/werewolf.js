// Werewolf ("Ma sói") screen. The referee (shared/games.js) deals the secret roles and runs the night and the day
// on a timer; this screen shows only what you are allowed to know and sends your choices.
import { el } from '../util.js';
import { runClock, listNames } from './common.js';

export const ROLE = {
  wolf: { icon: '🐺', name: 'Werewolf', side: 'Werewolves', text: 'Each night you and the other Werewolves choose one player to bite. You know each other and whisper in your own chat at night. By day, pretend to be a Villager.' },
  seer: { icon: '🔮', name: 'Seer', side: 'Village', text: 'Each night you look at one player and learn whether they are a Werewolf.' },
  guard: { icon: '🛡️', name: 'Guard', side: 'Village', text: 'Each night you protect one player (yourself is allowed) from the Werewolves — never the same player two nights in a row.' },
  witch: { icon: '🧪', name: 'Witch', side: 'Village', text: 'You learn who was bitten each night. You have one healing potion and one poison for the whole game. You cannot heal yourself.' },
  villager: { icon: '👤', name: 'Villager', side: 'Village', text: 'No special power: find the Werewolves by talking, and vote them out.' },
};
const NIGHT = ['guard', 'wolf', 'witch', 'seer'];
const STEP = { guard: 'The Guard wakes…', wolf: 'The Werewolves wake…', witch: 'The Witch wakes…', seer: 'The Seer wakes…', announce: 'Morning', talk: 'Discussion', vote: 'Vote', result: 'The village has decided', words: 'Last words', over: 'The end' };
/** The chat channel you write to right now: 'day' | 'wolf' | 'ghost' | null (silence). Mirrors the referee. */
export function wwChannel(view) {
  const g = view.g; if (!g || view.phase !== 'play') return 'day';
  if (!g.you) return null; if (g.over) return 'day'; if (!g.you.alive) return 'ghost';
  if (NIGHT.includes(g.phase)) return g.you.role === 'wolf' ? 'wolf' : null;
  if (g.phase === 'words') return g.hanged === g.you.seat ? 'day' : null;
  return 'day';
}
export function roleCard(role, big) {
  const r = ROLE[role];
  return el('div', { class: 'ww-role ' + role + (big ? ' big' : '') }, el('span', { class: 'ww-ico', text: r.icon }), el('div', {}, el('b', { text: r.name }), el('i', { text: r.side === 'Village' ? 'Village side' : 'Werewolf side' }), el('p', { text: r.text })));
}

export function mountWerewolf(root, api) {
  let view = null; let revealed = false; let poisoning = false; let lastPhase = '';
  const banner = el('div', { class: 'ww-banner' }); const circle = el('div', { class: 'ww-circle' });
  const mine = el('div', { class: 'ww-me' }); const act = el('div', { class: 'ww-act' }); const log = el('div', { class: 'ww-log' });
  const cover = el('div', { class: 'ww-cover', hidden: true });
  const wrap = el('div', { class: 'ww-wrap' }, banner, circle, el('div', { class: 'ww-row' }, mine, act), log, cover); root.append(wrap);
  const stop = runClock(root, () => { // the bar under the banner
    const g = view && view.g; const bar = banner.querySelector('.ww-bar i');
    if (g && bar && g.until) bar.style.width = (100 * Math.max(0, Math.min(1, (g.until - api.now()) / Math.max(1, g.until - g.begun)))).toFixed(1) + '%';
    return null;
  }, api.now);
  const P = (seat) => view.g.players.find((p) => p.seat === seat);
  const nameOf = (seat) => { const p = P(seat); return p ? (view.g.you && seat === view.g.you.seat ? 'you' : p.name) : '?'; };
  const was = (p) => (p.role ? ` (${ROLE[p.role].name})` : '');
  const send = (extra) => api.send('move', extra);

  function click(p) {
    const g = view.g; const me = g.you; if (!me || !me.alive || g.over || !p.alive) return;
    if (g.phase === 'guard' && me.role === 'guard') { if (p.seat === g.guardLast) return api.toast('You protected that player last night — choose someone else.'); send({ target: p.seat }); }
    else if (g.phase === 'wolf' && me.role === 'wolf') { if (p.role === 'wolf') return; send({ target: p.seat }); }
    else if (g.phase === 'witch' && me.role === 'witch' && poisoning) { if (p.seat === me.seat) return; poisoning = false; send({ potion: 'poison', target: p.seat }); }
    else if (g.phase === 'seer' && me.role === 'seer' && !g.done) { if (p.seat === me.seat) return; send({ target: p.seat }); }
    else if (g.phase === 'vote') { if (p.seat === me.seat) return; send({ target: g.vote === p.seat ? null : p.seat }); }
  }
  function clickable(p) {
    const g = view.g; const me = g.you; if (!me || !me.alive || g.over || !p.alive) return false;
    if (g.phase === 'guard') return me.role === 'guard' && p.seat !== g.guardLast;
    if (g.phase === 'wolf') return me.role === 'wolf' && p.role !== 'wolf';
    if (g.phase === 'witch') return me.role === 'witch' && poisoning && p.seat !== me.seat;
    if (g.phase === 'seer') return me.role === 'seer' && !g.done && p.seat !== me.seat;
    if (g.phase === 'vote') return p.seat !== me.seat;
    return false;
  }
  function prompt(g) { // what the middle box says and offers
    const me = g.you; const out = []; const say = (t, cls) => out.push(el('p', { class: cls || '', text: t }));
    const night = NIGHT.includes(g.phase);
    if (!me) { say(night ? '🌙 It is night. You are watching: the roles stay secret.' : 'You are watching this game.'); return out; }
    if (!me.alive && !g.over) say('👻 You are a ghost now: you see every role, and you can whisper with the other ghosts in the chat.', 'ghost');
    if (g.over) { say(g.winner === 'village' ? '🏆 The village wins — every Werewolf is gone.' : '🐺 The Werewolves win — they are as many as the others.'); return out; }
    const acting = me.alive && night && me.role === g.phase;
    if (night && !acting) { say(me.alive ? '🌙 Night has fallen. Close your eyes…' : '🌙 It is night.'); if (me.alive && me.role !== 'villager') say('Your turn comes when the banner calls the ' + ROLE[me.role].name + '.', 'meta'); return out; }
    if (g.phase === 'guard') say(g.guard != null ? `🛡️ You protect ${nameOf(g.guard)} tonight. (Click someone else to change.)` : '🛡️ Click the player you want to protect tonight.' + (g.guardLast != null ? ` Not ${nameOf(g.guardLast)} again.` : ''));
    else if (g.phase === 'wolf') { const mineV = g.wolfVotes && g.wolfVotes[me.seat]; say(mineV != null ? `🐺 You want to bite ${nameOf(mineV)}. The majority of the Werewolves decides; a tie is settled by chance.` : '🐺 Click the player to bite. Agree with the other Werewolves in the chat — only you can read it.'); }
    else if (g.phase === 'witch') {
      if (g.done) say('🧪 Done. Wait for the night to pass…');
      else {
        say(g.bitten == null ? '🧪 Nobody was bitten tonight.' : `🧪 The Werewolves bit ${nameOf(g.bitten)}.`);
        const row = el('div', { class: 'ww-btns' });
        if (g.potions.heal && g.bitten != null && g.bitten !== me.seat) row.append(el('button', { class: 'nut nho', type: 'button', text: '💚 Heal ' + nameOf(g.bitten), onclick: () => send({ potion: 'heal' }) }));
        if (g.potions.poison) row.append(el('button', { class: 'nut nho' + (poisoning ? ' vang' : ''), type: 'button', text: poisoning ? '☠ Now click a player…' : '☠ Use the poison', onclick: () => { poisoning = !poisoning; paint(view); } }));
        row.append(el('button', { class: 'nut nho xam', type: 'button', text: 'Do nothing', onclick: () => send({ potion: 'skip' }) }));
        out.push(row);
        say(`Potions left: ${g.potions.heal ? 'healing ✓' : 'healing ✗'} · ${g.potions.poison ? 'poison ✓' : 'poison ✗'}` + (g.bitten === me.seat ? ' — you cannot heal yourself.' : ''), 'meta');
      }
    } else if (g.phase === 'seer') {
      const now = g.seen && g.seen.find((s) => s.night === g.night);
      say(now ? `🔮 ${nameOf(now.seat)} is ${now.wolf ? 'a WEREWOLF 🐺' : 'not a Werewolf ✓'}.` : '🔮 Click a player to learn whether they are a Werewolf.');
    } else if (g.phase === 'announce') say(g.morning.length ? `☀️ Last night ${listNames(g.morning.map((s) => P(s).name + was(P(s))))} died.` : '☀️ A quiet night — nobody died.');
    else if (g.phase === 'talk') say(me.alive ? '💬 Talk it over in the chat: who is a Werewolf? The vote comes next.' : '💬 The living are talking.');
    else if (g.phase === 'vote') say(me.alive ? (g.vote != null ? `🗳 You vote for ${nameOf(g.vote)}. Click another player to change, or the same one to take it back.` : '🗳 Click the player you want to vote out. You can change your vote until the time is up.') : '🗳 The living are voting.');
    else if (g.phase === 'result') say(g.hanged != null ? `⚖️ ${P(g.hanged).name} got the most votes and is voted out.` : '⚖️ A tie — nobody is voted out today.');
    else if (g.phase === 'words') say(g.hanged === me.seat ? '🎤 Your last words — write them in the chat (15 seconds).' : `🎤 ${P(g.hanged).name} speaks their last words…`);
    if (g.fast && ['announce', 'talk', 'result', 'words'].includes(g.phase)) out.push(el('div', { class: 'ww-btns' }, el('button', { class: 'nut nho xam', type: 'button', text: '⏩ Skip (practice only)', onclick: () => send({ skip: true }) })));
    return out;
  }
  function lines(g) {
    const out = [];
    for (const e of g.log) {
      if (e.t === 'night') out.push(['night', `🌙 Night ${e.n}`]);
      else if (e.t === 'dawn') out.push(['', e.dead.length ? `☀️ Morning ${e.n}: ${listNames(e.dead.map((s) => P(s).name + was(P(s))))} died in the night.` : `☀️ Morning ${e.n}: a quiet night, nobody died.`]);
      else if (e.t === 'vote') out.push(['', e.out != null ? `🗳 ${P(e.out).name}${was(P(e.out))} was voted out with ${e.counts[e.out]} vote${e.counts[e.out] === 1 ? '' : 's'}.` : '🗳 A tie — nobody was voted out.']);
      else if (e.t === 'left') out.push(['', `🚪 ${P(e.seat).name}${was(P(e.seat))} left and is out of the game.`]);
      else if (e.t === 'win') out.push(['win', e.side === 'village' ? '🏆 The village wins!' : '🐺 The Werewolves win!']);
    }
    return out;
  }
  function paint(v) {
    const g = v.g; const me = g.you; const night = NIGHT.includes(g.phase);
    if (g.phase !== lastPhase) { lastPhase = g.phase; poisoning = false; }
    wrap.classList.toggle('night', night && !g.over);
    banner.replaceChildren(el('b', { text: g.over ? '🏁 Game over' : night ? `🌙 Night ${g.night}` : `☀️ Day ${g.night}` }), el('span', { text: STEP[g.phase] || '' }),
      g.over ? '' : el('i', { 'data-until': g.until, text: '' }), el('div', { class: 'ww-bar' }, el('i')));
    const votes = g.counts || {}; const wolfTally = {}; if (g.wolfVotes) for (const k in g.wolfVotes) wolfTally[g.wolfVotes[k]] = (wolfTally[g.wolfVotes[k]] || 0) + 1;
    circle.replaceChildren(...g.players.map((p) => {
      const can = clickable(p); const seen = g.seen && g.seen.find((s) => s.seat === p.seat);
      const tags = [];
      if (p.role) tags.push(el('i', { class: 'ww-tag role', title: ROLE[p.role].name, text: ROLE[p.role].icon + ' ' + ROLE[p.role].name }));
      else if (seen) tags.push(el('i', { class: 'ww-tag', text: seen.wolf ? '🐺 Werewolf' : '✓ not a wolf' }));
      if (!p.alive) tags.push(el('i', { class: 'ww-tag dead', text: p.how === 'vote' ? 'voted out' : p.how === 'left' ? 'left' : 'died at night' }));
      else if (p.away) tags.push(el('i', { class: 'ww-tag', text: '⏳ away' }));
      if (votes[p.seat]) tags.push(el('i', { class: 'ww-tag vote', text: `🗳 ${votes[p.seat]}` }));
      if (wolfTally[p.seat] && g.phase === 'wolf') tags.push(el('i', { class: 'ww-tag bite', text: `🐺 × ${wolfTally[p.seat]}` }));
      if (g.phase === 'guard' && g.guard === p.seat) tags.push(el('i', { class: 'ww-tag', text: '🛡️' }));
      const b = el(can ? 'button' : 'div', { class: 'ww-p' + (p.alive ? '' : ' dead') + (me && p.seat === me.seat ? ' you' : '') + (can ? ' can' : '') + (g.vote === p.seat && g.phase === 'vote' ? ' mine' : '') + (g.hanged === p.seat && ['result', 'words'].includes(g.phase) ? ' out' : ''), type: can ? 'button' : null },
        el('span', { class: 'gt-face', text: p.alive ? p.name.trim().charAt(0).toUpperCase() : '👻' }), el('b', { text: p.name + (me && p.seat === me.seat ? ' (you)' : '') }), el('span', { class: 'ww-tags' }, ...tags));
      if (can) b.addEventListener('click', () => click(p));
      return b;
    }));
    mine.replaceChildren(me ? roleCard(me.role) : el('div', { class: 'ww-role' }, el('span', { class: 'ww-ico', text: '👀' }), el('div', {}, el('b', { text: 'Spectator' }), el('p', { text: 'Roles in this game: ' + g.roles.map((r) => ROLE[r].icon).join(' ') }))));
    act.replaceChildren(...prompt(g));
    const ls = lines(g); log.replaceChildren(...ls.map(([cls, text]) => el('div', { class: cls, text }))); log.scrollTop = log.scrollHeight;
    if (me && !revealed) { // the secret role, shown once when the game starts
      revealed = true;
      if (g.night === 1 && g.phase === 'guard') {
        cover.replaceChildren(el('p', { text: 'Your secret role' }), roleCard(me.role, true), el('p', { class: 'meta', text: 'Roles in this game: ' + g.roles.map((r) => ROLE[r].icon).join(' ') }), el('button', { class: 'nut nho vang', type: 'button', text: 'Got it', onclick: () => { cover.hidden = true; } }));
        cover.hidden = false; setTimeout(() => { cover.hidden = true; }, 6000); // short: the Guard's 20 seconds are already running
      }
    }
  }
  return { update(v) { view = v; if (v.g) paint(v); }, destroy() { stop(); } };
}
export function wwResults(view) {
  const g = view.g; const P = (seat) => g.players.find((p) => p.seat === seat); const n = (seat) => (seat == null ? 'nobody' : P(seat).name);
  const mineWon = g.you && (g.you.role === 'wolf') === (g.winner === 'wolves');
  const box = el('div', { class: 'gt-result ww-end' });
  box.append(el('h3', { text: (g.winner === 'village' ? '🏆 The village wins!' : '🐺 The Werewolves win!') + (g.you ? (mineWon ? ' You are on the winning side 🎉' : ' Your side lost.') : '') }));
  box.append(el('div', { class: 'ww-roles' }, ...g.players.map((p) => el('span', { class: 'ww-tag role' + (p.alive ? '' : ' dead'), text: `${ROLE[p.role].icon} ${p.name} — ${ROLE[p.role].name}` }))));
  if (g.timeline && g.timeline.length) {
    box.append(el('h4', { text: 'What happened each night' }));
    for (const t of g.timeline) {
      const parts = [];
      if (t.guard != null) parts.push(`the Guard protected ${n(t.guard)}`);
      parts.push(t.bitten == null ? 'the Werewolves bit nobody' : `the Werewolves bit ${n(t.bitten)}` + (t.saved ? ` — saved by the ${t.by === 'guard' ? 'Guard' : 'Witch'}` : ''));
      if (t.poisoned != null) parts.push(`the Witch poisoned ${n(t.poisoned)}`);
      if (t.seen != null) parts.push(`the Seer looked at ${n(t.seen)} (${P(t.seen).role === 'wolf' ? 'a Werewolf' : 'not a Werewolf'})`);
      box.append(el('p', { class: 'ww-night', text: `🌙 Night ${t.night}: ${parts.join(' · ')}.` }));
    }
  }
  return box;
}
