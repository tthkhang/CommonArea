// Bots for solo mode (as in campus-game-v4's offline demo): they stroll around the plaza, walk into rooms,
// sit down at tables and chat a little. They use the same rules and path finding as a real player.
import { CHOICES, SKIN_TONES } from './avatar.js';

const NAMES = ['Minh', 'Lan', 'Huy', 'Thao', 'Khoa', 'Vy', 'Bao', 'Ngoc', 'Tuan'];
const LINES = ['hi everyone!', 'anyone up for a study session?', 'the campfire is cosy', 'this music is nice', 'brb', 'lol', 'see you in the Garden Room', 'gg',
  'who wants to watch something in the Cinema?', 'I caught a koi today!', 'hello!', 'my carrots are ready', 'selling tomatoes at the Market'];
const TABLE_LINES = ['what chapter are you on?', "let's do 25 min of focus", 'can someone explain question 3?', "ok I'm back", 'nice, almost done'];
const COLORS = ['#e5484d', '#3e63dd', '#30a46c', '#f76baf', '#f76b15', '#ffc53d', '#3a3a44', '#f2f2f2', '#8e4ec6', '#a0663b', '#12a594', '#99d52a'];
const HAIR = ['#1b1b1b', '#5a3a1f', '#a0522d', '#d9a441', '#f0f0f0', '#c0392b', '#6a4fb3'];
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const rnd = (a, b) => a + Math.random() * (b - a);

function randomLook(i) {
  const look = { skin: pick(SKIN_TONES), headSize: Math.round(rnd(0.9, 1.15) * 100) / 100, bodySize: Math.round(rnd(0.85, 1.2) * 100) / 100,
    hairA: pick(HAIR), hairB: pick(HAIR), outfit: COLORS[i % COLORS.length], hoodColor: pick(COLORS), pants: pick(HAIR), bootColor: pick(['#7a3b1f', '#3a3a44', '#a0663b']),
    trim: '#8a4a2a', itemColor: pick(COLORS), scarfColor: pick(COLORS), backpackColor: pick(HAIR), eyeColor: '#111111',
    blush: Math.random() < 0.4, glasses: Math.random() < 0.2, crossStraps: Math.random() < 0.5, scarf: Math.random() < 0.3, backpack: Math.random() < 0.3 };
  for (const k in CHOICES) look[k] = pick(CHOICES[k]).v;
  if (Math.random() < 0.5) look.item = 'none';
  return look;
}

export function startBots(room, L, count = NAMES.length) {
  const W = room.constructor.WORLD; const VC = L.vatCanTatCa();
  const bots = [];
  for (let i = 0; i < count; i++) {
    const id = 'bot' + i;
    if (!room.join(id, { name: NAMES[i % NAMES.length], look: randomLook(i), bot: true })) break;
    const p = room.players.get(id);
    bots.push({ id, p, path: [], wait: rnd(0.5, 6), seat: null, sitLeft: 0, goal: null, stuck: 0, lx: p.x, lz: p.z, wasMoving: false });
  }
  const seatFree = (key) => !room.seats[key];
  function choose(b) {
    const r = Math.random(); const from = { x: b.p.x, z: b.p.z };
    b.goal = null;
    if (r < 0.28) { // sit somewhere: plaza study tables, music corner, meeting table, game tables, cinema rows
      const tables = W.tables.filter((t) => !t.area);
      for (let tries = 0; tries < 8; tries++) {
        const t = pick(tables); const i = Math.floor(Math.random() * t.seats.length); const key = t.id + ':' + i;
        if (!seatFree(key)) continue;
        b.goal = { seat: { table: t.id, i, key } }; b.path = L.timDuong(from, t.seats[i]); return;
      }
    }
    if (r < 0.5) { // visit a room
      const room2 = pick(W.rooms);
      b.path = L.timDuong(from, { x: room2.center.x + rnd(-2, 2), z: room2.center.z + rnd(-2, 2) }); return;
    }
    const here = W.roomAt(b.p.x, b.p.z);
    for (let tries = 0; tries < 12; tries++) { // stroll: a free spot on the plaza (or back out to it)
      const x = rnd(-15.5, 15.5), z = rnd(-15.5, 15.5);
      if (!W.isFree(x, z)) continue;
      if (here && Math.random() < 0.5) { const rr = W.rooms.find((q) => q.id === here).rect; b.path = L.timDuong(from, { x: rnd(rr.x1 + 2, rr.x2 - 2), z: rnd(rr.z1 + 2, rr.z2 - 2) }); return; }
      b.path = L.timDuong(from, { x, z }); return;
    }
  }
  const STEP = 0.1;
  setInterval(() => {
    for (const b of bots) {
      const p = b.p; if (!room.players.has(b.id)) continue;
      if (b.seat) {
        b.sitLeft -= STEP;
        if (b.sitLeft <= 0 || !p.seat) { if (p.seat) room.handle(b.id, { type: 'stand' }); b.seat = null; b.wait = rnd(0.5, 2); }
        continue;
      }
      if (b.path.length) {
        const d = b.path[0]; const dx = d.x - p.x, dz = d.z - p.z; const kc = Math.hypot(dx, dz);
        if (kc < (b.path.length === 1 ? 0.25 : 0.45)) {
          b.path.shift();
          if (!b.path.length) {
            room.handle(b.id, { type: 'move', x: p.x, z: p.z, ry: p.ry, moving: false }); b.wasMoving = false;
            const g = b.goal && b.goal.seat;
            if (g && seatFree(g.key)) { room.handle(b.id, { type: 'sit', table: g.table, seat: g.i }); if (p.seat) { b.seat = g.key; b.sitLeft = rnd(25, 80); } }
            b.goal = null; b.wait = rnd(2, 9);
          }
          continue;
        }
        const q = L.buocDi({ x: p.x, z: p.z }, { x: (dx / kc) * 0.62, z: (dz / kc) * 0.62 }, STEP, VC);
        room.handle(b.id, { type: 'move', x: q.x, z: q.z, ry: Math.atan2(q.x - p.x, q.z - p.z), moving: true }); b.wasMoving = true;
        b.stuck = Math.hypot(p.x - b.lx, p.z - b.lz) < 0.02 ? b.stuck + STEP : 0; b.lx = p.x; b.lz = p.z;
        if (b.stuck > 1.5) { b.path = []; b.goal = null; b.stuck = 0; b.wait = rnd(0.5, 2); room.handle(b.id, { type: 'move', x: p.x, z: p.z, ry: p.ry, moving: false }); }
      } else {
        b.wait -= STEP;
        if (b.wait <= 0) choose(b);
      }
    }
  }, STEP * 1000);
  setInterval(() => { // small talk
    const b = pick(bots); if (!b || !room.players.has(b.id)) return;
    if (b.seat && Math.random() < 0.6) room.handle(b.id, { type: 'tableChat', text: pick(TABLE_LINES) });
    else if (Math.random() < 0.5) room.handle(b.id, { type: 'chat', text: pick(LINES) });
  }, 14000);
  return { bots };
}
