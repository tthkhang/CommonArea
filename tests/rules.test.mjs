// Rule checks for the combined game (map from Top1Server + rules from campus-game v4/v5 + room plug-ins from campus-export).
// Run from the combined-game folder with either:
//   node tests/rules.test.mjs
//   /System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc -m tests/rules.test.mjs   (macOS built-in, no install)
import * as L from '../public/js/logic.js';

let Room;
const inJsc = typeof load === 'function' && typeof process === 'undefined';
if (inJsc) {
  globalThis.self = globalThis;
  ['catalog', 'quiz', 'games', 'roomplugins', 'room'].forEach((f) => load('public/shared/' + f + '.js'));
  Room = globalThis.CampusRoom;
} else {
  const { createRequire } = await import('node:module');
  Room = createRequire(import.meta.url)('../public/shared/room.js');
}
const log = typeof print === 'function' ? print : console.log;
let failed = 0, passed = 0;
const ok = (c, msg) => { if (c) { passed++; log('ok   ' + msg); } else { failed++; log('FAIL ' + msg); } };

const W = Room.setMap(L), C = Room.Catalog;
let now = 1800000000000;
const out = []; const saved = {}; let meta = {};
const store = { load: (t) => (saved[t] ? JSON.parse(JSON.stringify(saved[t])) : null), save: (t, p) => { saved[t] = JSON.parse(JSON.stringify(p)); }, all: () => Object.entries(saved), loadMeta: (k) => meta[k] || null, saveMeta: (k, v) => { meta[k] = v; } };
const room = new Room({ cap: 100, now: () => now, send: (to, m) => out.push([to, m]), store, checkAdmin: (pw) => pw === 'secret' });
const last = (to, type) => [...out].reverse().find(([t, m]) => (to == null || t === to) && m.type === type);
const got = (to, type) => out.filter(([t, m]) => t === to && m.type === type).map(([, m]) => m);
const walk = (id, x, z) => { const p = room.players.get(id); const steps = Math.max(1, Math.ceil(Math.hypot(x - p.x, z - p.z) / 2)); const sx = p.x, sz = p.z; for (let i = 1; i <= steps; i++) room.handle(id, { type: 'move', x: sx + (x - sx) * i / steps, z: sz + (z - sz) * i / steps, ry: 0, moving: true }); };

// ---------------------------------------------------------------- map
ok(W.rooms.length === 5 && W.rooms.every((r) => L.PHONG[r.id]), 'five closed rooms come from the Top1 map');
ok(W.tables.filter((t) => !t.kind && !t.room).length === 4 && W.tables.find((t) => t.id === 'ban-hop').seats.length === 10, '4 plaza study tables + 10-seat meeting table');
ok(W.tables.filter((t) => t.kind === 'cinema').reduce((n, t) => n + t.seats.length, 0) === 33, 'cinema rows hold 33 seats');
ok(W.tables.filter((t) => t.kind === 'grove').every((t) => t.x > 62.8 && L.vungTaiViTri(t.x, t.z) === 'rung'), 'forest tables sit inside the shifted forest');
ok(L.trongVungDi(W.forestGate.x, W.forestGate.z) && L.vungTaiViTri(W.forestGate.x - 5, W.forestGate.z) === 'loi-rung', 'forest gate is on the walkable forest path');
ok(W.roomAt(-14, -36) === 'chiem-tinh' && W.roomAt(0, 0) === null, 'roomAt finds closed rooms');
ok(W.isFree(-5, 5) && !W.isFree(0, 0) && !W.isFree(W.market.x, W.market.z), 'isFree knows furniture and props');
{ // the forest path leaves the plaza through its east exit (where the Garden Room used to be) and is enclosed on both sides
  const VC = L.vatCanTatCa(); let p = { x: 24, z: 0 };
  for (let i = 0; i < 100; i++) p = L.buocDi(p, { x: 0, z: 1 }, 0.1, VC);
  const south = p.z; p = { x: 24, z: 0 };
  for (let i = 0; i < 100; i++) p = L.buocDi(p, { x: 0, z: -1 }, 0.1, VC);
  const north = p.z; p = { x: 10, z: 0 };
  for (let i = 0; i < 80; i++) p = L.buocDi(p, { x: 1, z: 0 }, 0.1, VC);
  ok(south < 2 && north > -2 && p.x > L.RAO_DONG, 'forest path has walls on both sides and is open from the plaza to the gate');
  let q = { x: 14, z: -20 };
  for (let i = 0; i < 60; i++) q = L.buocDi(q, { x: 1, z: 0 }, 0.1, VC);
  ok(q.x < 16, 'the Game Room corridor no longer opens to the east');
  const route = L.timDuong({ x: 2, z: 2 }, { x: 40, z: 0 });
  ok(route.some((d) => Math.abs(d.x - 16) < 0.1 && Math.abs(d.z) < 0.1), 'path finding routes plaza -> forest through the east exit');
  ok(L.RAO_DONG === 30 && W.fenceX === 30 && L.RUNG.x1 > 28 && W.rooms.every((r) => r.rect.x2 <= 28.01 || r.rect.x1 >= L.RUNG.x2), 'the forest starts at the east fence (x = 30) and overlaps no room');
}

// ---------------------------------------------------------------- join, looks, emotes
room.join('a', { name: 'An', token: 'aaaaaaaaaaaaaaaaaaaaaaaa', look: { hood: 'down', outfit: '#FF0000', headSize: 9, item: 'banana', blush: 'yes' } });
room.join('b', { name: 'Binh', token: 'bbbbbbbbbbbbbbbbbbbbbbbb' });
const a = room.players.get('a'), b = room.players.get('b');
ok(a.look.hood === 'down' && a.look.outfit === '#ff0000' && a.look.headSize === 1.2 && a.look.item === 'sword' && a.look.blush === false, 'look is validated by the server');
ok(last('a', 'welcome')[1].players.every((q) => q.look && 'room' in q), 'welcome carries looks and rooms');
ok(a.pr.xu === C.ECON.startXu && Math.hypot(a.x - W.spawn.x, a.z - W.spawn.z) < 2, 'new profile + spawn by the campfire');
room.handle('a', { type: 'look', look: { hairStyle: 'bun' }, name: 'Annie' });
ok(a.look.hairStyle === 'bun' && a.name === 'Annie' && last('b', 'look') === undefined && last(null, 'look')[1].name === 'Annie', 'look change is broadcast');
room.handle('a', { type: 'emote', emote: 'dance' }); ok(a.emote === 'dance', 'emote starts');
room.handle('a', { type: 'emote', emote: 'hack' }); ok(a.emote === null, 'unknown emote stops it');

// ---------------------------------------------------------------- closed rooms: membership + hidden positions
out.length = 0;
walk('a', 14, 20); walk('a', 14, 30);                // plaza -> cinema corridor -> inside the cinema
ok(a.room === 'xem-phim' && room.plugins['xem-phim'].members.has('a'), 'walking in makes you a member of the room');
ok(last('a', 'xem-phim.state') && last(null, 'room')[1].room === 'xem-phim', 'room state sent on enter; everyone learns the room change');
out.length = 0; room.tick();
ok(got('b', 'moves').length === 0, 'players outside do not receive positions from inside a room');
walk('b', 14, 20); walk('b', 14, 31); out.length = 0;
room.handle('a', { type: 'move', x: 13, z: 32, ry: 0, moving: true }); room.tick();
ok(got('b', 'moves').some((m) => m.list.some((r) => r[0] === 'a')), 'players in the same room see each other');

// cinema queue (campus-export rules): 2 per player, under 3 hours, owner/admin removal, members only
room.handle('a', { type: 'xem-phim.add', vid: 'dQw4w9WgXcQ', title: 'One', dur: 200 });
room.handle('a', { type: 'xem-phim.add', vid: 'aaaaaaaaaaa', title: 'Two', dur: 100 });
room.handle('a', { type: 'xem-phim.add', vid: 'bbbbbbbbbbb', title: 'Three', dur: 100 });
const q = room.plugins['xem-phim'].queue;
ok(q.current && q.current.title === 'One' && q.waiting.length === 1 && last('a', 'toast'), 'third video refused (max 2 each)');
room.handle('b', { type: 'xem-phim.add', vid: 'ccccccccccc', title: 'Long', dur: 3 * 3600 });
ok(q.waiting.length === 1, 'a 3-hour video is refused (must be under 3 hours)');
room.handle('b', { type: 'xem-phim.remove', id: q.current.id }); ok(q.current.title === 'One', 'others cannot remove your video');
room.join('c', { name: 'Chi' }); room.handle('c', { type: 'xem-phim.add', vid: 'ddddddddddd', title: 'Out', dur: 100 });
ok(q.waiting.length === 1, 'players outside the cinema cannot use its queue');
now += 203000; room.tick(); ok(q.current && q.current.title === 'Two', 'queue advances when the video ends');
room.handle('a', { type: 'xem-phim.ping', text: 'x' }); room.handle('a', { type: 'chiem-tinh.ping', text: 'x' });
ok(!last('a', 'chiem-tinh.pong'), 'template rooms ignore non-members');

// cinema seats + lounge Xu while a film plays
const row = W.tables.find((t) => t.kind === 'cinema'); const st = row.seats[0];
walk('a', st.x, st.z - 1.5); room.handle('a', { type: 'sit', table: row.id, seat: 0 });
ok(a.seat === row.id + ':0' && last(null, 'seat')[1].y === st.y, 'sitting on a cinema seat');
const xu0 = a.pr.xu; for (let i = 0; i < 61; i++) { now += 1000; room.tick(); }
ok(a.pr.xu === xu0 + C.ECON.loungePerMin, 'watching together earns the lounge rate');
room.handle('a', { type: 'stand' });
const tb = W.tables.find((t) => !t.kind && !t.room);
room.handle('a', { type: 'sit', table: tb.id, seat: 0 }); ok(!a.seat || a.seat.split(':')[0] !== tb.id, 'cannot sit at a plaza table from inside a room');

// ---------------------------------------------------------------- study Xu at a plaza table, quiz after the Pomodoro
walk('a', 14, 27); walk('a', 14, 17); walk('a', tb.seats[0].x + 1, tb.seats[0].z + 1);
ok(a.room === null, 'walking out leaves the room');
room.handle('a', { type: 'sit', table: tb.id, seat: 0 });
const xu1 = a.pr.xu; for (let i = 0; i < 61; i++) { now += 1000; room.handle('a', { type: 'active' }); room.tick(); }
ok(a.pr.xu === xu1 + C.ECON.studyPerMin, 'studying earns ' + C.ECON.studyPerMin + ' Xu per minute');
for (let i = 0; i < C.ECON.pomodoroMin * 60; i += 20) { now += 20000; room.handle('a', { type: 'active' }); room.tick(); }
const quiz = last('a', 'quiz'); ok(quiz && quiz[1].o.length === 4, 'Pomodoro quiz arrives after ' + C.ECON.pomodoroMin + ' minutes');
const xu2 = a.pr.xu; room.handle('a', { type: 'quizAnswer', choice: a.quiz.a }); ok(a.pr.xu === xu2 + C.ECON.pomodoroBonus, 'correct answer pays the bonus');
room.handle('a', { type: 'stand' });
const gt = W.tables.find((t) => t.kind === 'game');
ok(gt.room === 'tro-choi', 'game tables belong to the Game Room (no study Xu there)');

// ---------------------------------------------------------------- Game Room wins + Astrology readings
{
  const readings = []; room.onReading = (r) => readings.push(r);
  const xuG = a.pr.xu; room.handle('a', { type: 'gameWin', game: 'ludo' });
  ok(a.pr.xu === xuG, 'the browser can no longer claim a game win (the Game Room referee pays; see tests/games.test.mjs)');
  // ---- Astrology Room: one birth profile per player name, a line in the class file for every "See my chart"
  const birth = { name: 'Nguyễn Minh Anh', date: '1990-08-15', style: 'VN', cal: 'solar', lunar: null, time: '14:30', unknownTime: false, gender: 'F', place: 'vn-ha-noi' };
  room.handle('a', { type: 'chiem-tinh.save', birth });
  ok(readings.length === 0 && !last('a', 'chiem-tinh.saved'), 'saving needs you to be inside the Astrology Room');
  out.length = 0; room.setRoom(a, 'chiem-tinh'); const xuA = a.pr.xu;
  ok(last('a', 'chiem-tinh.profile') && last('a', 'chiem-tinh.profile')[1].birth === null, 'walking in: the room says you have no profile yet');
  room.handle('a', { type: 'chiem-tinh.save', birth: { ...birth, date: '1990-02-31x', time: '25:00' } });
  ok(last('a', 'chiem-tinh.saved')[1].ok === false && readings.length === 0, 'incomplete or impossible birth details are refused');
  room.checkBirth = (b) => b.place !== 'no-such-place'; room.handle('a', { type: 'chiem-tinh.save', birth: { ...birth, place: 'no-such-place' } });
  ok(last('a', 'chiem-tinh.saved')[1].ok === false && readings.length === 0, 'a birth place the game does not know is refused (full check supplied by the server)'); now += 2000;
  now += 2000; room.handle('a', { type: 'chiem-tinh.save', birth: { ...birth, extra: '<script>', name: '  Nguyễn   Minh Anh ' } });
  ok(last('a', 'chiem-tinh.saved')[1].ok && readings.length === 1 && readings[0].player === a.name && readings[0].birth.name === 'Nguyễn Minh Anh' && !('extra' in readings[0].birth) && a.pr.xu === xuA + C.ECON.astroXu, 'a valid form is saved, cleaned, logged once and pays Xu');
  now += 2000; room.handle('a', { type: 'chiem-tinh.save', birth: { ...birth, time: '', unknownTime: true, style: 'US' } });
  ok(readings.length === 2 && readings[1].birth.unknownTime && readings[1].birth.time === '' && a.pr.xu === xuA + C.ECON.astroXu, 'editing adds a new line to the class file; Xu only once a day');
  room.handle('a', { type: 'chiem-tinh.save', birth }); ok(readings.length === 2, 'saving twice within a moment is ignored');
  out.length = 0; room.setRoom(a, null); room.setRoom(a, 'chiem-tinh');
  ok(last('a', 'chiem-tinh.profile')[1].birth.unknownTime === true && last('a', 'chiem-tinh.profile')[1].birth.style === 'US', 'next visit: the saved profile comes back, so the reading opens without the form');
  { // the profile belongs to the NAME: the same name on another computer (another token) gets it too
    room.join('z', { name: a.name.toUpperCase(), token: 'zzzzzzzzzzzzzzzzzzzzzzzz' }); const z = room.players.get('z'); out.length = 0; room.setRoom(z, 'chiem-tinh');
    ok(last('z', 'chiem-tinh.profile')[1].birth && last('z', 'chiem-tinh.profile')[1].birth.name === 'Nguyễn Minh Anh', 'the same character name on another computer opens the same profile');
    room.leave('z');
  }
  ok(Room.Plugins.cleanBirth({ ...birth, cal: 'lunar', lunar: { d: 25, m: 6, y: 1990, leap: 0 } }).lunar.leap === false && Room.Plugins.cleanBirth({ ...birth, gender: 'X' }) === null && Room.Plugins.cleanBirth({ ...birth, place: '../etc' }) === null && Room.Plugins.cleanBirth({ ...birth, name: '=1+1' }) === null, 'cleanBirth keeps lunar input and refuses bad gender, place or name');
  room.setRoom(a, null);
}

// ---------------------------------------------------------------- trash on the plaza
const tr = room.trashList()[0]; a.x = tr.x + 1; a.z = tr.z; a.room = null;
const xu3 = a.pr.xu; room.handle('a', { type: 'pickTrash', id: tr.id });
ok(a.carry === 1 && a.pr.xu === xu3 + C.ECON.trashPick && room.trashList().every((t) => Math.abs(t.x) <= 17 && Math.abs(t.z) <= 17 && W.isFree(t.x, t.z)), 'trash is picked on the plaza; all trash lies on free plaza ground');
a.x = W.bins[0].x + 1; a.z = W.bins[0].z; room.handle('a', { type: 'dropTrash', bin: 0 }); ok(a.carry === 0, 'trash dropped in a bin');

// ---------------------------------------------------------------- shop: the Shop room counter (the Garden Room and its stall were removed)
room.handle('a', { type: 'buy', item: 'seed:carrot', qty: 1 }); ok(a.pr.inv['seed:carrot'] === 3, 'cannot buy away from a shop');
a.area = 'campus'; a.x = W.shops[0].x; a.z = W.shops[0].z; room.setRoom(a, 'cua-hang');
room.handle('a', { type: 'buy', item: 'seed:carrot', qty: 2 }); ok(a.pr.inv['seed:carrot'] === 5, 'buying at the Shop & Wardrobe counter');
ok(W.shops.length === 1 && !W.rooms.some((r) => r.id === 'trong-cay') && W.beds.length === 0 && W.fishSpots.every((s) => s.area === 'forest'), 'the Garden Room is gone: no stall, no beds, no dock');
room.handle('a', { type: 'plant', where: 'bed', id: '0', seed: 'carrot' }); ok(!a.pr.garden.beds['0'] && a.pr.inv['seed:carrot'] === 5, 'garden beds can no longer be planted');
{ // an older profile with crops in the Garden Room beds gets them back as seeds
  const tok = 'f'.repeat(24); saved[tok] = { v: 5, xu: 10, inv: { 'seed:carrot': 1 }, garden: { beds: { 0: { s: 'carrot', at: 1 }, 3: { s: 'wheat', at: 1 }, 4: { s: 'no-such-plant', at: 1 } } } };
  room.join('z', { name: 'Zed', token: tok }); const z = room.players.get('z');
  ok(z.pr.inv['seed:carrot'] === 2 && z.pr.inv['seed:wheat'] === 1 && Object.keys(z.pr.garden.beds).length === 0, 'crops left in the old garden beds come back as seeds');
  room.leave('z');
}

// ---------------------------------------------------------------- forest (v5: walk straight through the gate) + Local chat + fishing chairs
room.setRoom(a, null); a.x = W.fenceX - 8; a.z = W.forestGate.z;
room.handle('a', { type: 'area', to: 'forest' }); ok(a.area === 'campus', 'cannot switch to the forest away from the gate');
a.x = W.fenceX - 0.7; room.handle('a', { type: 'area', to: 'forest' });
ok(a.area === 'forest' && a.x >= W.fenceX + 1 && a.x < W.fenceX + 3 && L.vungTaiViTri(a.x, a.z) === 'rung', 'no prompt: walking through the gate puts you in the forest in place (x=' + a.x.toFixed(1) + ')');
out.length = 0; room.handle('a', { type: 'chat', text: 'hello' }); ok(last('a', 'chat')[1].local && !last('b', 'chat'), 'forest chat is Local');
ok(W.fishSpots.filter((s) => s.area === 'forest').length === 8 && W.fishSpots.every((s) => s.area !== 'forest' || L.vungTaiViTri(s.x, s.z) === 'rung'), '8 fishing chairs stand inside the forest');
room.handle('a', { type: 'fishCast', spot: 2 }); ok(!a.fishing, 'cannot cast away from a fishing chair');
{ const sp = W.fishSpots[2]; a.x = sp.x; a.z = sp.z; room.handle('a', { type: 'fishCast', spot: 2 }); }
ok(a.fishing && last('a', 'fishCast')[1].shadow > 0 && !('sp' in last('a', 'fishCast')[1]), 'cast from chair 2: the server sends the shadow size, not the species'); room.handle('a', { type: 'fishCancel' });
a.x = W.fenceX + 1.5; a.z = W.forestGate.z; room.handle('a', { type: 'area', to: 'campus' }); ok(a.area === 'campus' && a.x <= W.fenceX + 0.4, 'walking back out of the forest');

// ---------------------------------------------------------------- private farm island (v5) + visiting + likes + board
room.handle('a', { type: 'area', to: 'garden' }); ok(a.area === 'garden' && Room.viewKey(a) === 'g:' + a.gid, 'teleport to my garden island');
room.handle('a', { type: 'plant', where: 'plot', id: '0,0', seed: 'carrot' }); ok(a.pr.garden.plots['0,0'], 'island plot planted');
room.handle('a', { type: 'plant', where: 'bed', id: '0', seed: 'carrot' }); ok(!a.pr.garden.beds['0'], 'beds cannot be used from the island');
b.area = 'campus'; room.setRoom(b, null); room.handle('b', { type: 'area', to: 'garden', gid: Room.gidOf('aaaaaaaaaaaaaaaaaaaaaaaa') });
ok(b.visiting && last('b', 'gardenView'), 'visiting another player\'s garden'); room.handle('b', { type: 'plant', where: 'plot', id: '1,1', seed: 'carrot' });
ok(!a.pr.garden.plots['1,1'], 'visitors cannot change the garden'); const xu4 = a.pr.xu; room.handle('b', { type: 'like' }); ok(a.pr.xu === xu4 + C.SOCIAL.likeXu, 'a like pays the owner');
room.handle('a', { type: 'board' }); ok(last('a', 'board')[1].gardens.length >= 4, 'weekly board lists players and villager gardens');
room.handle('a', { type: 'area', to: 'back' }); ok(a.area === 'campus', 'back from the garden');

// ---------------------------------------------------------------- v5 farm: animals, pots, furniture, food buff, products
{
  room.join('e', { name: 'Em', token: 'eeeeeeeeeeeeeeeeeeeeeeee' });
  const e = room.players.get('e'); e.pr.xu = 100000;
  const atShop = () => { e.area = 'campus'; e.x = W.shops[0].x; e.z = W.shops[0].z; e.room = 'cua-hang'; };
  atShop();
  for (const it of ['animal:chicken', 'animal:chicken', 'animal:cow', 'feed:chicken', 'pot:gold', 'furn:sofa', 'furn:piano']) room.handle('e', { type: 'buy', item: it });
  ok(e.pr.garden.animals.length === 3 && e.pr.inv['feed:chicken'] === 3 && e.pr.inv['pot:gold'] === 1, 'bought 2 hens, 1 cow, chicken feed and a golden pot');
  for (let i = 0; i < 3; i++) room.handle('e', { type: 'buy', item: 'animal:cow' });
  ok(e.pr.garden.animals.filter((q) => q.kind === 'cow').length === 2, 'the barn holds 2 cows at level 0');
  e.room = null; e.x = W.spawn.x; e.z = W.spawn.z; room.handle('e', { type: 'area', to: 'garden' });
  ok(e.area === 'garden' && Math.abs(e.x + 400) < 1 && Math.abs(e.z - 29) < 1, 'the farm island spawn is at the entrance arch');
  room.handle('e', { type: 'feedAnimals', kind: 'chicken' });
  ok(e.pr.garden.animals.filter((q) => q.kind === 'chicken').every((q) => q.fedAt) && e.pr.inv['feed:chicken'] === 1, 'hungry hens fed (feed 3 -> 1)');
  room.handle('e', { type: 'feedAnimals', kind: 'cow' });
  ok(e.pr.garden.animals.filter((q) => q.kind === 'cow').every((q) => !q.fedAt), 'no cow food: the cows stay hungry');
  e.pr.inv['crop:hay'] = 1; room.handle('e', { type: 'feedAnimals', kind: 'cow' });
  ok(e.pr.garden.animals.filter((q) => q.kind === 'cow' && q.fedAt).length === 1, 'cows can eat home-grown alfalfa');
  const hen = e.pr.garden.animals.find((q) => q.kind === 'chicken');
  room.handle('e', { type: 'collectAnimal', uid: hen.uid }); ok(!e.pr.inv['prod:egg'], 'cannot collect before the product is ready');
  now += C.ANIMALS.chicken.produceMin * 60000 + 1000;
  room.handle('e', { type: 'collectAnimal', uid: hen.uid }); ok(!e.pr.inv['prod:egg'], 'you must walk into the coop to collect');
  const coop = W.garden.pens.coop; e.x = (coop.minX + coop.maxX) / 2; e.z = (coop.minZ + coop.maxZ) / 2;
  room.handle('e', { type: 'collectAnimal', uid: hen.uid });
  ok(e.pr.inv['prod:egg'] === 1 && !hen.fedAt, 'egg collected inside the coop; the hen is hungry again');
  // flower pots
  room.handle('e', { type: 'plant', where: 'pot', id: '8', seed: 'daisy' }); ok(!e.pr.garden.flowerPots['8'], 'pot 8 is locked until Cloud Island 2');
  room.handle('e', { type: 'setPot', i: 0, pot: 'gold' });
  ok(e.pr.garden.potTypes['0'] === 'gold' && !e.pr.inv['pot:gold'], 'golden pot placed on slot 0');
  e.pr.inv['seed:rose'] = 1; room.handle('e', { type: 'plant', where: 'pot', id: '0', seed: 'rose' });
  const rose = e.pr.garden.flowerPots['0'];
  ok(rose && rose.pt === 'gold' && C.cycleMs(rose, 'pot', 0) < C.FLOWERS.rose.growMin * 60000, 'a flower in a golden pot grows faster');
  room.handle('e', { type: 'setPot', i: 0, pot: 'clay' });
  ok(!e.pr.garden.potTypes['0'] && e.pr.inv['pot:gold'] === 1, 'replacing a pot returns the old one to the bag');
  // furniture + house upgrade
  room.handle('e', { type: 'furnPlace', slot: 3, item: 'sofa' }); room.handle('e', { type: 'furnPlace', slot: 13, item: 'piano' });
  ok(e.pr.garden.furniture['3'] === 'sofa' && !e.pr.garden.furniture['13'], 'sofa on slot 3; slot 13 is locked at house level 0');
  atShop(); room.handle('e', { type: 'buy', item: 'up:house' });
  e.room = null; e.area = 'garden'; room.handle('e', { type: 'furnPlace', slot: 13, item: 'piano' });
  ok(e.pr.garden.house === 1 && e.pr.garden.furniture['13'] === 'piano', 'a house upgrade unlocks more furniture slots');
  room.handle('e', { type: 'furnRemove', slot: 3 });
  ok(!e.pr.garden.furniture['3'] && e.pr.inv['furn:sofa'] === 1, 'furniture goes back to the bag');
  ok(C.upkeepOf(e.pr.garden) === C.UPKEEP.perLevel * 1 && C.gardenBeauty(e.pr.garden) > 0, 'upkeep and beauty count the house');
  // selling an animal product at the shop (combined game: products sell like crops)
  atShop(); const xuE = e.pr.xu; room.handle('e', { type: 'sell', kind: 'prod', id: 'egg' });
  ok(e.pr.xu === xuE + C.PRODUCTS.egg.sell && !e.pr.inv['prod:egg'], 'an egg sells at the shop for its base price');
  // food & drink buff
  e.room = null; const cart = W.foodStands.find((s) => s.id === 'cartL'); e.x = cart.front.x; e.z = cart.front.z;
  ok(L.trongVungDi(cart.front.x, cart.front.z) && W.foodStands.filter((s) => s.area === 'forest').every((s) => L.vungTaiViTri(s.front.x, s.front.z) === 'rung'), 'food stands: one on the plaza, two in the forest');
  room.handle('e', { type: 'buyFood', item: 'cake', stand: 'cafe' }); ok(!e.pr.buff, 'cannot buy from a stand you are not at');
  room.handle('e', { type: 'buyFood', item: 'cake', stand: 'cartL' });
  ok(e.pr.buff && e.pr.buff.mult === 1.25 && e.pr.buff.until > now, 'cake gives a x1.25 study buff');
  const tb2 = W.tables.filter((t) => !t.kind && !t.room)[1]; e.x = tb2.seats[0].x; e.z = tb2.seats[0].z; room.handle('e', { type: 'sit', table: tb2.id, seat: 0 });
  const xb = e.pr.earned; e.seatSince = now;
  for (let i = 0; i < 60; i++) { now += 1000; e.lastActive = now; room.econTick(now); }
  ok(e.pr.earned - xb === 2, 'buffed study: 2.5 Xu per minute -> +2 after one minute (' + (e.pr.earned - xb) + ')');
  room.handle('e', { type: 'stand' });
  // catching a fish from a chair takes a fight of a few seconds
  e.area = 'forest'; const sp = W.fishSpots[4]; e.x = sp.x; e.z = sp.z; room.handle('e', { type: 'fishCast', spot: 4 });
  now = e.fishing.biteAt + 8000; room.handle('e', { type: 'fishReel', ok: true });
  ok(e.pr.bag.length === 1 && C.FISH[e.pr.bag[0].sp], 'caught a ' + C.FISH[e.pr.bag[0].sp].name + ' after an 8 s fight');
  ok(Object.keys(C.FISH).length >= 14 && Object.values(C.FISH).every((f) => f.shape), '14 fish species, each with its own look');
  e.area = 'campus'; room.leave('e');
  // an island saved by v4: placed decorations go back to the bag because the layout changed
  const old = Room.fixProfile({ v: 3, xu: 5, inv: { fert: 1 }, garden: { land: 1, pots: 2, decor: [{ uid: 1, item: 'bench', x: -400, z: 0, r: 0 }, { uid: 2, item: 'bench', x: -390, z: 3, r: 0 }], plots: { '0,0': { s: 'carrot', at: 1, bonus: 0 } }, flowerPots: { 3: { s: 'rose', at: 1, bonus: 0 } } } });
  ok(old.v === 5 && old.garden.decor.length === 0 && old.inv['decor:bench'] === 2 && old.garden.plots['0,0'] && old.garden.flowerPots[3] && old.garden.pots === 2 && Array.isArray(old.garden.animals), 'a v4 garden is upgraded to the v5 farm without losing plants');
}

// ---------------------------------------------------------------- upgrades survive a reload (v4 capped land at level 2)
a.pr.garden.land = 4; room.saveProfile(a); ok(Room.fixProfile(store.load(a.token)).garden.land === 4, 'land level 4 survives reload');
// ---------------------------------------------------------------- friends: ask, accept, list, visit a friend's garden, remove
{
  const o = [], sv = {}; let t = 1800000000000;
  const st = { load: (k) => (sv[k] ? JSON.parse(JSON.stringify(sv[k])) : null), save: (k, p) => { sv[k] = JSON.parse(JSON.stringify(p)); }, all: () => Object.entries(sv), loadMeta: () => null, saveMeta: () => {} };
  const mk = () => new Room({ cap: 100, now: () => t, send: (to, m) => o.push([to, m]), store: st, checkAdmin: () => false });
  let r = mk();
  const lastTo = (to, type) => { const e = [...o].reverse().find(([x, m]) => x === to && m.type === type); return e && e[1]; };
  const TA = 'a1a1a1a1a1a1a1a1a1a1a1a1', TB = 'b2b2b2b2b2b2b2b2b2b2b2b2', TC = 'c3c3c3c3c3c3c3c3c3c3c3c3';
  const GA = Room.gidOf(TA), GB = Room.gidOf(TB), GC = Room.gidOf(TC);
  r.join('fa', { name: 'An', token: TA }); r.join('fb', { name: 'Binh', token: TB }); r.join('fg', { name: 'Guest' });
  const fa = r.players.get('fa'), fb = r.players.get('fb');
  ok(lastTo('fa', 'friends') && lastTo('fa', 'friends').list.length === 0, 'a player gets an (empty) friends list on joining');
  r.handle('fa', { type: 'friendAdd', id: 'fa' }); r.handle('fa', { type: 'friendAdd', id: 'fg' }); r.handle('fg', { type: 'friendAdd', id: 'fa' });
  ok(!lastTo('fa', 'friendRequest') && !lastTo('fg', 'friendRequest') && !fa.pr.friends, 'no friend requests to yourself, to a player without a saved profile, or from one');
  t += 2000; r.handle('fa', { type: 'friendAdd', id: 'fb' });
  ok(lastTo('fb', 'friendRequest').gid === GA && lastTo('fb', 'friends').requests[0].name === 'An' && !(fa.pr.friends || {})[GB], 'a friend request reaches the other player and waits for their answer');
  r.handle('fb', { type: 'friendAnswer', gid: GA, ok: false });
  ok(!(fb.pr.friends || {})[GA] && lastTo('fb', 'friends').requests.length === 0, 'declining a request makes nobody friends');
  r.handle('fb', { type: 'friendAnswer', gid: GA, ok: true });
  ok(!(fb.pr.friends || {})[GA], 'an answer without a waiting request does nothing');
  t += 2000; r.handle('fa', { type: 'friendAdd', id: 'fb' }); t += 121000; r.handle('fb', { type: 'friendAnswer', gid: GA, ok: true });
  ok(!(fb.pr.friends || {})[GA], 'a request runs out after two minutes');
  t += 2000; r.handle('fa', { type: 'friendAdd', id: 'fb' }); r.handle('fb', { type: 'friendAnswer', gid: GA, ok: true });
  ok(fa.pr.friends[GB].name === 'Binh' && fb.pr.friends[GA].name === 'An', 'accepting makes both players friends');
  const la = lastTo('fa', 'friends').list;
  ok(la.length === 1 && la[0].gid === GB && la[0].online === true && la[0].id === 'fb', 'the friends list shows the friend as online');
  t += 2000; o.length = 0; r.handle('fa', { type: 'friendAdd', id: 'fb' });
  ok(!lastTo('fb', 'friendRequest'), 'no second request to someone who is already a friend');
  // both ask each other: the second request counts as a yes
  r.join('fc', { name: 'Chi', token: TC }); const fc = r.players.get('fc');
  t += 2000; r.handle('fc', { type: 'friendAdd', id: 'fa' }); r.handle('fa', { type: 'friendAdd', id: 'fc' });
  ok(fa.pr.friends[GC] && fc.pr.friends[GA], 'asking someone who has already asked you makes you friends at once');
  // a friend goes offline: still listed, and their garden can be visited
  fb.pr.garden.plots['0,0'] = { seed: 'carrot', at: t }; o.length = 0; r.leave('fb');
  const lb = lastTo('fa', 'friends').list.find((f) => f.gid === GB);
  ok(lb && lb.online === false, 'a friend who leaves shows as offline');
  r.handle('fa', { type: 'area', to: 'garden', gid: GB });
  ok(fa.area === 'garden' && fa.visiting && lastTo('fa', 'gardenView').gid === GB && lastTo('fa', 'gardenView').garden.plots['0,0'], 'visiting an offline friend\'s garden');
  r.handle('fa', { type: 'area', to: 'back' });
  // the server restarts: friends are saved, and the garden is still found
  r.leave('fa'); r.leave('fc'); r.leave('fg'); r = mk(); o.length = 0;
  r.join('fa', { name: 'An', token: TA }); const fa2 = r.players.get('fa');
  ok(lastTo('fa', 'friends').list.length === 2 && fa2.pr.friends[GB].name === 'Binh', 'friends survive a restart');
  r.handle('fa', { type: 'area', to: 'garden', gid: GB });
  ok(fa2.visiting && lastTo('fa', 'gardenView').gid === GB, 'a friend\'s garden is found after a restart');
  r.handle('fa', { type: 'area', to: 'back' });
  o.length = 0; r.join('fb', { name: 'Binh B', token: TB });
  ok(lastTo('fa', 'friends').list.find((f) => f.gid === GB).name === 'Binh B' && o.some(([to, m]) => to === 'fa' && m.type === 'chat' && m.system && /online/.test(m.text)), 'a friend coming online is announced and their new name shown');
  // removing ends the friendship on both sides, also for a friend who is offline
  r.handle('fa', { type: 'friendRemove', gid: GB });
  ok(!fa2.pr.friends[GB] && !r.players.get('fb').pr.friends[GA] && lastTo('fb', 'friends').list.length === 0, 'removing a friend ends it on both sides');
  r.handle('fa', { type: 'friendRemove', gid: GC });
  ok(!fa2.pr.friends[GC] && !(Room.fixProfile(st.load(TC)).friends || {})[GA], 'removing an offline friend updates their saved profile');
  const many = {}; for (let i = 0; i < 80; i++) many['g' + i] = { name: 'F' + i }; many['bad id!'] = { name: 'x' };
  const fx = Room.fixProfile({ friends: many });
  ok(Object.keys(fx.friends).length <= 50 && !fx.friends['bad id!'], 'a saved friends list is capped and cleaned');
}

room.leave('a'); room.leave('b'); room.leave('c');
ok(!room.plugins['xem-phim'].queue.current, 'rooms reset when everyone has left');

log('\n' + (failed ? failed + ' FAILED, ' : 'ALL TESTS PASSED: ') + passed + ' passed');
if (failed && typeof process !== 'undefined') process.exitCode = 1;
