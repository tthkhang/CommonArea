// Quick multiplayer smoke test: two WebSocket clients against a running server.mjs (needs Node 22+ for the built-in WebSocket).
//   terminal 1:  PORT=5180 ADMIN_PASSWORD=admin node server.mjs
//   terminal 2:  node tests/multiplayer-smoke.mjs 5180
import { BAN_DO } from '../public/js/logic.js';
const PORT = process.argv[2] || 5180;
const base = `http://localhost:${PORT}`;
let failed = 0;
const ok = (c, msg) => { console.log((c ? 'ok   ' : 'FAIL ') + msg); if (!c) failed++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function client(name, token) {
  const ws = new WebSocket(`ws://localhost:${PORT}/ws`);
  const c = { ws, name, msgs: [], id: null };
  c.ready = new Promise((res, rej) => { ws.onopen = () => { ws.send(JSON.stringify({ type: 'hello', name, token, look: { hood: 'down', outfit: '#3e63dd' } })); res(); }; ws.onerror = (e) => rej(new Error('ws error ' + (e.message || ''))); });
  ws.onmessage = (e) => { const m = JSON.parse(e.data); c.msgs.push(m); if (m.type === 'welcome') c.id = m.you; };
  c.send = (m) => ws.send(JSON.stringify(m));
  c.of = (type) => c.msgs.filter((m) => m.type === type);
  c.clear = () => { c.msgs.length = 0; };
  c.walk = async (x, z, from) => { const steps = Math.ceil(Math.hypot(x - from.x, z - from.z) / 1.5); for (let i = 1; i <= steps; i++) { c.send({ type: 'move', x: from.x + (x - from.x) * i / steps, z: from.z + (z - from.z) * i / steps, ry: 0, moving: true }); await sleep(25); } return { x, z }; };
  return c;
}

// ---- static files
const index = await fetch(base + '/');
ok(index.status === 200 && (await index.text()).includes('Top 1 Server'), 'GET / serves the game page');
for (const f of ['/shared/room.js', '/js/main.js', '/vendor/three.module.min.js', '/assets/icon-chung.svg', '/style.css']) { const r = await fetch(base + f); ok(r.status === 200, 'GET ' + f + ' -> 200 (' + r.headers.get('content-type') + ')'); }
ok((await fetch(base + '/..%2F..%2Fserver.mjs')).status !== 200, 'cannot read files outside public/');

// ---- two players
const a = client('An', 'a'.repeat(24)); await a.ready; await sleep(300);
const b = client('Binh', 'b'.repeat(24)); await b.ready; await sleep(400);
const wa = a.of('welcome')[0], wb = b.of('welcome')[0];
ok(wa && wb && wa.you !== wb.you, 'both players are welcomed with their own id');
ok(wb.players.length === 2 && wb.players.every((p) => p.look && p.look.hood), 'the second player sees the first, with looks');
ok(a.of('join').length === 1 && a.of('join')[0].player.name === 'Binh', 'the first player is told about the second');
ok(wa.profile && wa.profile.xu >= 1000 && a.of('music').length === 1 && a.of('count').some((m) => m.n === 2), 'profile, music state and player count arrive');

let pa = { x: wa.players.find((p) => p.id === wa.you).x, z: wa.players.find((p) => p.id === wa.you).z };
let pb = { x: wb.players.find((p) => p.id === wb.you).x, z: wb.players.find((p) => p.id === wb.you).z };
b.clear(); pa = await a.walk(6, 6, pa); await sleep(250);
ok(b.of('moves').some((m) => m.list.some((r) => r[0] === a.id)), 'movement on the plaza reaches the other player');

a.send({ type: 'chat', text: 'hello from An' }); await sleep(200);
ok(b.of('chat').some((m) => m.text === 'hello from An' && m.name === 'An'), 'chat reaches the other player');

// ---- closed room: An walks into the cinema, Binh stays outside
pa = await a.walk(14, 17, pa); pa = await a.walk(14, 31, pa); await sleep(300);
ok(b.of('room').some((m) => m.id === a.id && m.room === 'xem-phim'), 'everyone learns that An entered the Cinema');
ok(a.of('xem-phim.state').length >= 1, 'An receives the cinema queue on entering');
b.clear(); pa = await a.walk(13, 34, pa); await sleep(300);
ok(!b.of('moves').some((m) => m.list.some((r) => r[0] === a.id)), 'positions inside the room are NOT sent to a player outside');
a.send({ type: 'xem-phim.add', vid: 'dQw4w9WgXcQ', title: 'Test film', dur: 212 }); await sleep(250);
ok(a.of('xem-phim.state').some((m) => m.now && m.now.title === 'Test film') && b.of('xem-phim.state').length === 0, 'the cinema queue is shared inside the room only');

pb = await b.walk(14, 17, pb); a.clear(); pb = await b.walk(14, 31, pb); await sleep(300);
ok(b.of('xem-phim.state').some((m) => m.now && m.now.title === 'Test film'), 'Binh walks in and gets the running film');
ok(b.of('moves').some((m) => m.snap && m.list.some((r) => r[0] === a.id)), 'Binh gets a snapshot of who is inside');
ok(a.of('moves').some((m) => m.list.some((r) => r[0] === b.id)), 'An now sees Binh move inside the room');

// ---- seats + admin
a.send({ type: 'sit', table: 'hang-1', seat: 0 }); await sleep(100);
const seatMsg = a.of('seat').find((m) => m.id === a.id);
if (!seatMsg) { pa = await a.walk(wa ? 15 - Math.sin(0.9) * 8.5 : 0, 51.5 - Math.cos(0.9) * 8.5 + 1.2, pa); a.send({ type: 'sit', table: 'hang-1', seat: 0 }); await sleep(250); }
ok(a.of('seat').some((m) => m.id === a.id && m.seat === 'hang-1:0') && b.of('seat').some((m) => m.id === a.id), 'sitting down is broadcast');
a.send({ type: 'adminLogin', password: 'wrong' }); a.send({ type: 'adminLogin', password: 'admin' }); await sleep(250);
ok(a.of('admin').some((m) => m.ok === false) && a.of('admin').some((m) => m.ok === true) && b.of('playerAdmin').some((m) => m.id === a.id), 'admin password is checked on the server');

// ---- Game Room: a shared table with the server as referee (lobby, host, computer player, secret hands, filtered chat)
{
  const chairs = (id) => BAN_DO.ghe.filter((g) => g.ban === id); const T = 'ban-bai-mau'; const view = (c) => c.of('tro-choi.state').filter((m) => m.view).pop()?.view;
  a.send({ type: 'stand' }); await sleep(100);
  pa = await a.walk(14, 17, pa); pa = await a.walk(chairs(T)[0].x + 0.5, chairs(T)[0].z + 0.5, pa);
  pb = await b.walk(14, 17, pb); pb = await b.walk(chairs(T)[1].x + 0.5, chairs(T)[1].z + 0.5, pb); await sleep(300);
  ok(a.of('tro-choi.tables').length >= 1, 'walking into the Game Room sends the state of its tables');
  a.send({ type: 'sit', table: T, seat: 0 }); await sleep(150); b.send({ type: 'sit', table: T, seat: 1 }); await sleep(250);
  ok(view(a) && view(a).phase === 'lobby' && view(a).host === 0 && view(a).canStart && view(b) && !view(b).canStart && view(b).seats[0].name === 'An', 'both sit down at Colour Cards: a lobby, and the first player is the host');
  b.send({ type: 'tro-choi.start', table: T }); await sleep(150);
  ok(view(b).phase === 'lobby' && b.of('toast').some((m) => /host/.test(m.msg)), 'only the host can start');
  a.send({ type: 'tro-choi.addBot', table: T }); await sleep(100); a.send({ type: 'tro-choi.start', table: T }); await sleep(300);
  const va = view(a), vb = view(b);
  ok(va.phase === 'play' && va.g.hand.length === 7 && vb.g.hand.length === 7 && va.g.all.length === 3 && va.g.counts[1] === 7, 'the game starts: seven cards each, a computer player in the third chair');
  ok(!JSON.stringify(va).includes(JSON.stringify(vb.g.hand[0])) && !('hands' in va.g) && va.clock && va.clock.until > Date.now(), 'each browser only gets its own hand; the turn clock is running');
  const n0 = va.g.n; if (va.g.playable.length) { const card = va.g.hand.find((c) => c.id === va.g.playable[0]); a.send({ type: 'tro-choi.move', table: T, play: card.id, color: 'p' }); } else a.send({ type: 'tro-choi.move', table: T, draw: true });
  await sleep(300);
  ok(view(b).g.n > n0 && view(a).g.n > n0, 'a move by one player reaches everyone at the table');
  const nBad = view(b).g.n; b.send({ type: 'tro-choi.move', table: T, play: 9999 }); await sleep(150); const nb = view(b).g.n;
  for (let k = 0; k < 3 && view(b).g.turn === view(b).you; k++) { // Binh takes a proper turn (play, or draw and keep), so that the computer player is next
    const g = view(b).g; if (g.playable.length) b.send({ type: 'tro-choi.move', table: T, play: g.playable[0], color: 'p' }); else if (g.drawn == null) b.send({ type: 'tro-choi.move', table: T, draw: true }); else b.send({ type: 'tro-choi.move', table: T, pass: true });
    await sleep(250);
  }
  a.send({ type: 'tro-choi.chat', table: T, text: 'good luck, you shit' }); await sleep(250);
  ok(b.of('tro-choi.chat').some((m) => m.text === 'good luck, you ***' && m.name === 'An') && nb === nBad, 'table chat is filtered on the server; an impossible card changes nothing');
  await sleep(3500);
  ok(view(a).g.n > n0 + 1, 'the computer player and the clock keep the game moving (' + (view(a).g.n - n0) + ' moves so far)');
  a.send({ type: 'stand' }); await sleep(300);
  ok(view(b).seats[0].here === false && view(b).phase === 'play', 'a player who leaves keeps the place; the game goes on');
  pa = await a.walk(chairs('ban-ma-soi')[0].x + 0.4, chairs('ban-ma-soi')[0].z + 0.4, pa); await sleep(100);
  a.send({ type: 'sit', table: 'ban-ma-soi', seat: 0 }); await sleep(200); a.send({ type: 'tro-choi.addBot', table: 'ban-ma-soi' }); await sleep(200);
  ok(a.of('toast').some((m) => /real players/.test(m.msg)) && view(a).table === 'ban-ma-soi' && /5 more players/.test(view(a).need) && chairs('ban-ma-soi').length === 10, 'Werewolf: ten chairs, real players only, the lobby says how many are missing');
  a.send({ type: 'stand' }); b.send({ type: 'stand' }); await sleep(200);
}

// ---- leaving
b.clear(); a.ws.close(); await sleep(400);
ok(b.of('leave').some((m) => m.id === a.id) && b.of('count').some((m) => m.n === 1), 'leaving is broadcast and the count drops');
b.ws.close(); await sleep(1900);
console.log('\n' + (failed ? failed + ' FAILED' : 'MULTIPLAYER SMOKE TEST PASSED'));
process.exit(failed ? 1 : 0);
