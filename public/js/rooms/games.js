// Game Room, client half (spec "Phòng Trò chơi"). Touch a table: a small card with Rules / Join table / Watch.
// Sitting down on a chair joins the table: Ludo, Colour Cards and Werewolf open a lobby (host, computer players,
// Start), then the game in a big panel over the 3D room, with the table chat on the right and a "?" for the rules.
// Colour Match is played alone: sitting down opens it straight away.
// The referee is the server half (shared/games.js): this file only shows what it sends and sends back clicks.
import * as THREE from 'three';
import { el } from '../util.js';
import { BAN_DO } from '../logic.js';
import { chip, seatInfo } from '../games/common.js';
import { mountLudo, ludoResults } from '../games/ludo.js';
import { mountCards, cardsResults } from '../games/cards.js';
import { mountWerewolf, wwResults, wwChannel } from '../games/werewolf.js';
import { mountMatch } from '../games/match.js';
import { ruleBook, matchPractice, cardsPractice } from '../games/rules.js';

const TABLES = {
  'ban-ca-ngua': { game: 'ludo', title: '🐎 Ludo', who: '2–4 players · computer players can fill empty chairs', mount: mountLudo, results: ludoResults },
  'ban-bai-mau': { game: 'cards', title: '🃏 Colour Cards', who: '2–4 players · computer players can fill empty chairs', mount: mountCards, results: cardsResults },
  'ban-ma-soi': { game: 'werewolf', title: '🐺 Werewolf', who: '6–10 real players', mount: mountWerewolf, results: wwResults },
  'ban-ghep-mau': { game: 'match', title: '🎨 Colour Match', who: '1 player per chair · 30 levels' },
};
const CHANNEL = { day: ['', 'Message the table…'], wolf: ['🐺', 'Whisper to the Werewolves…'], ghost: ['👻', 'Whisper to the other ghosts…'] };

export default {
  id: 'tro-choi',

  setup(ctx) {
    const { net, ui, me, modal, state, world, scene, WORLD, players, sitAt, stand, walkTo } = ctx;
    const tableOf = (id) => WORLD.tables.find((t) => t.id === id);
    const mySeat = () => { const p = me(); if (!p || !p.seat) return null; const [table, i] = p.seat.split(':'); return TABLES[table] ? { table, i: Number(i) } : null; };
    let summary = {};   // table id -> its row of "tro-choi.tables" (who sits where, host, phase)
    let view = null;    // the table I sit at or watch: the last "tro-choi.state"
    let panel = null;   // what the window shows: { kind: 'card' | 'rules' | 'table' | 'match', … }
    let screen = null;  // the game screen mounted in the window
    let chat = [];      // table chat lines
    let watchWhenNear = null; let inside = false; let lastSeatKey = null;

    const api = {
      send: (kind, extra) => { if (view) net.send(Object.assign({ type: 'tro-choi.' + kind, table: view.table }, extra)); },
      colorOf: (id) => { const r = state.players.get(id); return r ? r.color || (r.look && r.look.outfit) : null; },
      now: () => net.serverNow(), toast: (t) => ui.toast(t),
    };
    const unmount = () => { if (screen) { screen.destroy(); screen = null; } };
    const backdrop = () => document.querySelector('.act-modal');
    const setNight = (on) => backdrop()?.classList.toggle('night', !!on);

    // ---------------------------------------------------------------- the rule book (in the window, or as a layer over a running game)
    function rulesInto(box, game, onBack, backText) {
      let practice = null;
      const book = () => { practice?.destroy(); practice = null; box.replaceChildren(ruleBook(game, { onBack, backText, onPractice: () => {
        box.replaceChildren(); practice = (game === 'match' ? matchPractice : cardsPractice)(box, { onBack: book, toast: api.toast });
      } })); box.scrollTop = 0; };
      book();
      return () => { practice?.destroy(); practice = null; };
    }
    function openRules(table) {
      const T = TABLES[table]; let stop = null;
      const body = modal.open(T.title + ' — rules', { wide: true, cls: 'gt', onClose: () => { stop?.(); if (panel && panel.kind === 'rules') panel = null; } });
      panel = { kind: 'rules', table };
      stop = rulesInto(body, T.game, () => openCard(table), '← Back to the table');
    }
    function layerRules() { // "?" during a game: the game goes on underneath
      const P = panel; if (!P || !P.layer) return;
      if (!P.layer.hidden) { P.stopRules?.(); P.layer.hidden = true; return; }
      P.layer.hidden = false; P.stopRules = rulesInto(P.layer, TABLES[P.table].game, () => { P.stopRules?.(); P.layer.hidden = true; }, P.kind === 'match' ? '← Back to Colour Match' : '← Back to the game');
    }

    // ---------------------------------------------------------------- the small card of a table
    function openCard(table) {
      const T = TABLES[table]; const tb = tableOf(table);
      const body = modal.open(T.title, { cls: 'gt-card', onClose: () => { if (panel && panel.kind === 'card') panel = null; } });
      panel = { kind: 'card', table, body }; paintCard();
    }
    function paintCard() {
      const P = panel; if (!P || P.kind !== 'card') return;
      const T = TABLES[P.table]; const tb = tableOf(P.table); const s = summary[P.table]; const p = me();
      const taken = tb.seats.filter((_, i) => state.seats[P.table + ':' + i]).length; const bots = s ? s.seats.filter((q) => q.kind === 'bot').length : 0;
      const names = s ? s.seats.map((q) => q.name) : []; const mine = mySeat(); const here = mine && mine.table === P.table;
      const kept = s && s.phase === 'play' && s.seats.find((q) => q.kind === 'human' && !q.here && q.name === p.name);
      let status = 'Free — be the first to sit down.';
      if (T.game === 'match') status = 'Each chair plays its own game. Your stars and the level you are in are saved.';
      else if (s && s.phase === 'play') status = kept ? 'A game is running — your place is kept. Sit down again to carry on.' : 'A game is running. Stand next to the table to watch it; you can join the next one.';
      else if (s && s.phase === 'over') status = 'The table is looking at its results.';
      else if (names.length) status = `In the lobby: ${names.join(', ')}.`;
      const near = Math.hypot(p.x - tb.x, p.z - tb.z) <= tb.seats.reduce((m, q) => Math.max(m, Math.hypot(q.x - tb.x, q.z - tb.z)), 0) + 3;
      const canJoin = here || T.game === 'match' ? taken < tb.seats.length || here : !s || s.phase === 'lobby' ? taken < tb.seats.length : !!kept;
      P.body.replaceChildren(
        el('p', { class: 'gt-lead', text: T.who }),
        el('p', { class: 'gt-count' }, el('b', { text: `${taken + bots}/${tb.seats.length}` }), ' seated', bots ? ` (${bots} computer player${bots === 1 ? '' : 's'})` : ''),
        el('p', { text: status }),
        el('div', { class: 'gt-btns' },
          el('button', { class: 'nut nho xam', type: 'button', text: '📖 Rules', onclick: () => openRules(P.table) }),
          el('button', { class: 'nut nho vang' + (canJoin ? '' : ' mo'), type: 'button', text: here ? '▶ Open the game' : kept ? '🪑 Take your place again' : '🪑 Join table', onclick: () => join(P.table) }),
          T.game !== 'match' && !here && s && (s.phase !== 'lobby' || names.length) ? el('button', { class: 'nut nho xam', type: 'button', text: '👀 Watch', onclick: () => watch(P.table, near) }) : null));
    }
    function join(table) {
      const T = TABLES[table]; const tb = tableOf(table); const s = summary[table]; const p = me(); const mine = mySeat();
      if (mine && mine.table === table) { modal.close(); return T.game === 'match' ? openMatch() : openTable(); }
      let free = tb.seats.map((_, i) => i).filter((i) => !state.seats[table + ':' + i]);
      if (T.game !== 'match' && s && s.phase !== 'lobby') { // a running game: only the place that is kept for you
        const kept = s.phase === 'play' && s.seats.find((q) => q.kind === 'human' && !q.here && q.name === p.name);
        if (!kept) return ui.toast(s.phase === 'play' ? 'A game is running at this table. You can watch it, and join the next one.' : 'This table is showing its results. It opens again in a moment.');
        free = free.filter((i) => i === kept.seat);
      } else if (s) { const robots = new Set(s.seats.filter((q) => q.kind === 'bot').map((q) => q.seat)); const empty = free.filter((i) => !robots.has(i)); if (empty.length) free = empty; }
      if (!free.length) return ui.toast('Every chair at this table is taken.');
      free.sort((a, b) => Math.hypot(p.x - tb.seats[a].x, p.z - tb.seats[a].z) - Math.hypot(p.x - tb.seats[b].x, p.z - tb.seats[b].z));
      modal.close(); sitAt(table, free[0]);
    }
    function watch(table, near) {
      modal.close(); const tb = tableOf(table);
      if (near) return net.send({ type: 'tro-choi.watch', table, on: true });
      const p = me(); const d = Math.hypot(p.x - tb.x, p.z - tb.z) || 1; const r = tb.seats.reduce((m, q) => Math.max(m, Math.hypot(q.x - tb.x, q.z - tb.z)), 0) + 1.4;
      watchWhenNear = table; walkTo({ x: tb.x + (p.x - tb.x) / d * r, z: tb.z + (p.z - tb.z) / d * r }); ui.toast('Walking over to the table…');
    }

    // ---------------------------------------------------------------- a shared table: lobby, game, results
    function openTable() {
      if (!view) return; const T = TABLES[view.table]; const table = view.table; const watching = view.watching;
      const help = el('button', { class: 'nut tron gt-help', type: 'button', text: '?', title: 'Rules (the game goes on)', 'aria-label': 'Rules', onclick: layerRules });
      const body = modal.open(T.title + (watching ? ' — watching' : ''), { wide: true, cls: 'gt', tools: [help], onClose: () => {
        unmount(); panel?.stopRules?.(); panel = null; setNight(false);
        if (watching && view && view.table === table) { net.send({ type: 'tro-choi.watch', table, on: false }); view = null; }
      } });
      const log = el('div', { class: 'gt-chatlog', 'aria-live': 'polite' }); const input = el('input', { type: 'text', maxlength: 120, autocomplete: 'off' });
      input.addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.key === 'Enter') { const text = input.value.trim(); if (text) api.send('chat', { text }); input.value = ''; } else if (e.key === 'Escape') input.blur();
      });
      panel = { kind: 'table', table, stage: el('div', { class: 'gt-stage' }), extra: el('div', { class: 'gt-extra' }), log, input, note: el('div', { class: 'gt-chan' }), layer: el('div', { class: 'gt-layer', hidden: true }), mounted: null };
      body.append(el('div', { class: 'gt-cols' }, el('div', { class: 'gt-main' }, panel.stage, panel.extra), el('aside', { class: 'gt-chat' }, el('b', { text: '💬 Table chat' }), log, panel.note, input)), panel.layer);
      for (const m of chat) addLine(m);
      paintTable();
    }
    function addLine(m) {
      const P = panel; if (!P || P.kind !== 'table') return;
      const tag = m.system ? '' : (CHANNEL[m.channel] || CHANNEL.day)[0];
      const line = m.system ? el('div', { class: 'sys', text: m.text }) : el('div', { class: m.channel === 'wolf' ? 'wolf' : m.channel === 'ghost' ? 'ghost' : '' }, el('b', { text: (tag ? tag + ' ' : '') + m.name + ': ' }), m.text);
      if (m.color && line.firstChild.style) line.firstChild.style.color = m.color;
      const stick = P.log.scrollTop + P.log.clientHeight >= P.log.scrollHeight - 30;
      P.log.append(line); while (P.log.children.length > 120) P.log.firstChild.remove();
      if (stick) P.log.scrollTop = P.log.scrollHeight;
    }
    function paintTable() {
      const P = panel; if (!P || P.kind !== 'table' || !view) return; const v = view; const T = TABLES[v.table];
      // the chat box
      const ch = v.watching ? null : v.game === 'werewolf' ? wwChannel(v) : 'day';
      P.input.disabled = !ch; P.input.placeholder = v.watching ? 'Spectators cannot write here' : ch ? CHANNEL[ch][1] : v.g && v.g.phase === 'words' ? 'Only last words now…' : 'Shh… it is night';
      P.note.textContent = v.game !== 'werewolf' || v.phase !== 'play' ? 'Max 120 characters · one message a second' : ch === 'wolf' ? 'Night: only the Werewolves read this.' : ch === 'ghost' ? 'Only ghosts read this.' : ch === 'day' ? 'Everyone at the table reads this.' : 'The village is silent now.';
      setNight(v.game === 'werewolf' && v.phase === 'play' && v.g && ['guard', 'wolf', 'witch', 'seer'].includes(v.g.phase));
      // the game screen
      if (v.phase === 'lobby') { unmount(); P.mounted = null; P.stage.replaceChildren(); P.stage.hidden = true; }
      else if (v.g) {
        if (!screen || P.mounted !== v.game) { unmount(); P.stage.replaceChildren(); screen = T.mount(P.stage, api); P.mounted = v.game; }
        P.stage.hidden = false; screen.update(v);
      }
      // lobby or results
      if (v.phase === 'lobby') P.extra.replaceChildren(lobby(v));
      else if (v.phase === 'over' && v.g) P.extra.replaceChildren(T.results(v, api), el('div', { class: 'gt-btns' },
        v.watching ? null : el('button', { class: 'nut nho vang', type: 'button', text: '▶ Play again', onclick: () => api.send('again') }),
        el('button', { class: 'nut nho xam', type: 'button', text: v.watching ? 'Close' : 'Leave table', onclick: () => { if (v.watching) modal.close(); else leave(); } })));
      else P.extra.replaceChildren();
    }
    function leave() { modal.close(); stand(); }
    function lobby(v) {
      const T = TABLES[v.table]; const n = v.seats.length; const filled = v.seats.filter((s) => s.name).length; const host = v.host != null ? seatInfo(v, v.host, api) : null;
      const ring = el('div', { class: 'gt-ringseats' + (n > 6 ? ' many' : '') });
      v.seats.forEach((s, i) => {
        const a = (i / n) * Math.PI * 2 - Math.PI / 2;
        const c = chip(v, i, api, { extra: s.kind === 'bot' ? el('button', { class: 'gt-x', type: 'button', title: 'Remove this computer player', text: '✕ remove', onclick: () => api.send('removeBot', { seat: i }) }) : s.name ? null : el('span', { class: 'gt-sub', text: 'Empty' }) });
        c.style.left = (50 + (n > 6 ? 38 : 35) * Math.cos(a)) + '%'; c.style.top = (50 + (n > 6 ? 41 : 38) * Math.sin(a)) + '%'; ring.append(c);
      });
      ring.append(el('div', { class: 'gt-mid' }, el('b', { text: T.title }), el('span', { text: `${filled}/${n} seated` })));
      const startBtn = el('button', { class: 'nut nho vang' + (v.canStart ? '' : ' mo'), type: 'button', text: '▶ Start', title: v.canStart ? '' : v.need || 'Only the host can start', onclick: () => { if (v.canStart) api.send('start'); else ui.toast(v.need || `Only the host (${host ? host.name : '?'}) can start the game.`); } });
      const notes = [];
      if (v.need) notes.push(v.need);
      else if (v.you !== v.host) notes.push(`Waiting for the host (${host ? host.name : '?'}) to press Start.`);
      else notes.push('You are the host 👑 — press Start when everyone is ready.');
      if (v.game === 'werewolf') notes.push(v.bots ? 'Solo practice: fill the chairs with computer players to try the game (they play simply, and the phases are shorter). With the server running, Werewolf is for real players only.' : 'Werewolf is for real players only: no computer players at this table.');
      if (v.game === 'ludo') notes.push('A game with two players takes about 20 minutes; with more it takes much longer. The host can end it early.');
      return el('div', { class: 'gt-lobby' }, ring,
        el('div', { class: 'gt-btns' },
          v.bots && filled < n && v.you != null ? el('button', { class: 'nut nho', type: 'button', text: '🤖 Add computer', onclick: () => api.send('addBot') }) : null,
          v.you != null ? startBtn : null,
          el('button', { class: 'nut nho xam', type: 'button', text: '📖 Rules', onclick: layerRules }),
          el('button', { class: 'nut nho xam', type: 'button', text: v.watching ? 'Close' : 'Leave table', onclick: () => { if (v.watching) modal.close(); else leave(); } })),
        ...notes.map((t) => el('p', { class: 'meta', text: t })));
    }

    // ---------------------------------------------------------------- Colour Match (one player per chair)
    let matchData = null;
    function openMatch() {
      const help = el('button', { class: 'nut tron gt-help', type: 'button', text: '?', title: 'Rules', 'aria-label': 'Rules', onclick: layerRules });
      const body = modal.open(TABLES['ban-ghep-mau'].title, { wide: true, cls: 'gt m3', tools: [help], onClose: () => { unmount(); panel?.stopRules?.(); panel = null; } });
      const stage = el('div', { class: 'gt-stage' }); const layer = el('div', { class: 'gt-layer', hidden: true });
      panel = { kind: 'match', table: 'ban-ghep-mau', layer }; body.append(stage, layer);
      screen = mountMatch(stage, { send: (kind, extra) => net.send(Object.assign({ type: 'tro-choi.' + kind }, extra)), toast: api.toast, rules: layerRules });
      if (matchData) screen.progress(matchData);
    }

    // ---------------------------------------------------------------- messages from the referee
    net.on('tro-choi.tables', (m) => { summary = {}; for (const row of m.list) summary[row.id] = row; paintCard(); });
    net.on('tro-choi.state', (m) => {
      if (!m.view) { if (view && view.table === m.table) { view = null; if (panel && panel.kind === 'table') modal.close(); } return; }
      const fresh = !view || view.table !== m.view.table; const phase = view && view.phase; const turnBefore = view && view.g && view.g.turn;
      if (fresh) chat = [];
      view = m.view;
      if (panel && panel.kind === 'table' && panel.table === view.table) paintTable();
      else if (fresh || phase !== view.phase) openTable();          // sat down, the game started, or it ended
      else if (view.g && view.you != null && view.g.turn === view.you && turnBefore !== view.you && view.game !== 'werewolf') ui.toast(`Your turn at the ${TABLES[view.table].title} table — press E.`);
    });
    net.on('tro-choi.chat', (m) => {
      if (!view || m.table !== view.table || (m.id && players.isBlocked(m.id))) return;
      chat.push(m); if (chat.length > 120) chat.shift(); addLine(m);
      if (m.id) players.say(m.id, m.text);                          // also as a speech bubble over the character
    });
    net.on('tro-choi.match', (m) => {
      matchData = m.progress; const mine = mySeat();
      if (panel && panel.kind === 'match') screen?.progress(matchData); else if (mine && mine.table === 'ban-ghep-mau') openMatch();
    });
    net.on('tro-choi.matchTop', (m) => { if (panel && panel.kind === 'match') screen?.top(m.rows, m.me); });

    // ---------------------------------------------------------------- the 3D room: glowing tables, the host's crown, ghosts
    const glow = {};
    for (const id in TABLES) {
      const b = BAN_DO.ban.find((x) => x.id === id); if (!b) continue;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(b.r * 0.92, 0.07, 8, 40), new THREE.MeshBasicMaterial({ color: '#FFE38A', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
      ring.rotation.x = Math.PI / 2; ring.position.set(b.x, 1.12, b.z);
      const halo = new THREE.Mesh(new THREE.SphereGeometry(b.r * 0.75, 20, 12), new THREE.MeshBasicMaterial({ color: '#FFD98A', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
      halo.position.set(b.x, 1.5, b.z); halo.scale.y = 0.6;
      scene.add(ring, halo); world.themVaoPhong('tro-choi', ring); world.themVaoPhong('tro-choi', halo);
      glow[id] = { ring, halo, k: 0 };
    }
    const crowns = new Map(); const ghosts = new Map();
    function makeCrown() {
      const g = new THREE.Group(); const gold = new THREE.MeshBasicMaterial({ color: '#FFC43D' });
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.09, 12, 1, true), gold); band.material.side = THREE.DoubleSide; g.add(band);
      for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; const s = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.14, 6), gold); s.position.set(Math.cos(a) * 0.17, 0.1, Math.sin(a) * 0.17); g.add(s); }
      return g;
    }
    function effects(t) {
      const hosts = new Set(); const dead = new Set();
      if (inside) for (const id in summary) { const s = summary[id]; if (s.host != null) hosts.add(s.host); for (const g of s.ghosts || []) dead.add(g); }
      for (const id of hosts) { // a small crown over the host of each table
        const rec = state.players.get(id); if (!rec) continue; let c = crowns.get(id);
        if (!c) { c = makeCrown(); crowns.set(id, c); }
        if (c.parent !== rec.obj) rec.obj.add(c);
        c.position.y = ((rec.obj.userData.label && rec.obj.userData.label.position.y) || 2.5) + 0.42; c.rotation.y = t * 1.2;
      }
      for (const [id, c] of crowns) if (!hosts.has(id)) { c.parent?.remove(c); crowns.delete(id); }
      for (const id of dead) { // Werewolf: the dead float as pale ghosts
        const rec = state.players.get(id); if (!rec) continue;
        if (!ghosts.has(id)) { const saved = []; rec.obj.traverse((o) => { if (o.isMesh && o.material && !o.material.map) { saved.push([o, o.material]); o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.38; o.material.depthWrite = false; } }); ghosts.set(id, saved); }
        rec.obj.position.y += 0.45 + Math.sin(t * 2 + rec.obj.id) * 0.1;
      }
      for (const [id, saved] of ghosts) if (!dead.has(id)) { for (const [o, mat] of saved) { o.material.dispose?.(); o.material = mat; } ghosts.delete(id); }
      for (const id in glow) { // the things on a table light up while a game is running there
        const s = summary[id]; const on = inside && s && s.phase === 'play'; const g = glow[id]; g.k += ((on ? 1 : 0) - g.k) * 0.08;
        const night = on && s.night; g.ring.material.opacity = g.k * (0.55 + 0.25 * Math.sin(t * 3)); g.halo.material.opacity = g.k * (night ? 0.5 : 0.16) * (0.85 + 0.15 * Math.sin(t * 2.2));
        g.halo.material.color.set(night ? '#FFB65C' : '#FFE9B0');
      }
    }

    return {
      setInside(v) { inside = v; if (!v) { summary = {}; view = null; watchWhenNear = null; if (panel) modal.close(); effects(0); } },
      update(dt, t) {
        effects(t || 0);
        if (!inside) return;
        const p = me(); const mine = mySeat(); const key = mine ? mine.table + ':' + mine.i : null;
        if (key !== lastSeatKey) { // stood up (or changed chair): the table's window closes
          lastSeatKey = key;
          if (!mine && view && !view.watching) { view = null; if (panel && (panel.kind === 'table' || panel.kind === 'match')) modal.close(); }
          if (!mine && panel && panel.kind === 'match') modal.close();
        }
        if (watchWhenNear) { // walked over to watch
          const tb = tableOf(watchWhenNear); const r = tb.seats.reduce((m, q) => Math.max(m, Math.hypot(q.x - tb.x, q.z - tb.z)), 0) + 2.8;
          if (Math.hypot(p.x - tb.x, p.z - tb.z) <= r) { net.send({ type: 'tro-choi.watch', table: watchWhenNear, on: true }); watchWhenNear = null; } else if (!p.moving && p.seat) watchWhenNear = null;
        }
      },
      /** A click on something in the room: tables open their card. */
      onClick(id) { if (!TABLES[id]) return false; openCard(id); return true; },
      interact(p) { // E while seated: open the table's window again
        const mine = mySeat(); if (!mine) return false;
        if (TABLES[mine.table].game === 'match') openMatch(); else if (view && view.table === mine.table) openTable(); else return false;
        return true;
      },
      hint() { const mine = mySeat(); return mine ? `<kbd>E</kbd> open ${TABLES[mine.table].title} · move to stand up` : ''; },
      camera: null,
      silencesMusic: false,
    };
  },
};
