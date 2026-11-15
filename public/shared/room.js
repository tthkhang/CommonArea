/*
 * Campus Room — shared game rules.
 * Runs on the Node server (authoritative) and, in offline demo mode, inside the browser.
 * Pure JS, no dependencies. Transport is injected: send(playerIdOrNull, msg) — null = everyone.
 */
(function (root) {
  'use strict';

  // ---- World layout ----
  // Combined game: the map comes from Top1Server (public/js/logic.js) and is handed in with Room.setMap(map) before
  // the first Room is created. campus-game's own areas (forest, private farm island) keep that project's numbers (v5); the
  // forest is shifted by map.LECH_RUNG so that it starts right behind the campus's east fence (where the Garden Room used to be).
  const Catalog = (typeof module !== 'undefined' && module.exports) ? require('./catalog.js') : root.VCCatalog;
  const ECON = Catalog.ECON;
  const Quiz = (typeof module !== 'undefined' && module.exports) ? require('./quiz.js') : root.VCQuiz;
  const Plugins = (typeof module !== 'undefined' && module.exports) ? require('./roomplugins.js') : root.CampusRoomPlugins;
  // public id of a garden (never expose the browser token itself)
  function gidOf(token) { let h = 5381; for (let i = 0; i < token.length; i++) h = ((h << 5) + h + token.charCodeAt(i)) >>> 0; return 'g' + h.toString(36); }

  const WORLD = { ready: false, tables: [], zones: [], rooms: [], areas: {}, landmarks: [], bins: [], shops: [], beds: [] };

  function setMap(L) {
    const P = L.PHONG, B = L.BAN_DO, ox = L.LECH_RUNG.x, oz = L.LECH_RUNG.z;
    const F = (x, z) => ({ x: x + ox, z: z + oz }); // a v4 forest coordinate on the combined map
    WORLD.bounds = { minX: -50, maxX: 49 + ox, minZ: -55, maxZ: 57 }; // inside Top1's white fence; east: a little past the fence line, so you walk straight through the forest gate (v5)
    WORLD.spawn = { x: P.chung.xuatHien.x, z: P.chung.xuatHien.z };  // next to the campfire
    WORLD.rooms = L.KHU.slice(1).map((id) => ({ id, name: P[id].ten, rect: P[id].rect, spawn: P[id].xuatHien, center: P[id].giua }));

    // --- seats: every Top1 chair grouped by its table. Seat key = "<table id>:<index>" (v4's format) ---
    WORLD.tables.length = 0;
    const seatOf = (g) => ({ x: g.x, z: g.z, ry: g.huong, y: (g.hang || 0) * 0.3, ghe: g.id });
    for (const b of B.ban) {
      // study tables and the meeting table earn Xu; the Game Room tables do not (their games are not built yet)
      WORLD.tables.push({ id: b.id, name: b.ten, x: b.x, z: b.z, seats: B.ghe.filter((g) => g.ban === b.id).map(seatOf),
        kind: b.phong === 'tro-choi' ? 'game' : undefined, room: b.phong === 'chung' ? null : b.phong, long: b.id === 'ban-hop' });
    }
    const rows = {};
    for (const g of B.ghe) if (g.phong === 'xem-phim') (rows[g.ban] = rows[g.ban] || []).push(g);
    Object.keys(rows).sort().forEach((id, i) => {
      const gs = rows[id];
      WORLD.tables.push({ id, name: 'Cinema row ' + (i + 1), x: gs.reduce((a, g) => a + g.x, 0) / gs.length, z: gs.reduce((a, g) => a + g.z, 0) / gs.length,
        seats: gs.map(seatOf), kind: 'cinema', room: 'xem-phim' });
    });
    // v4's lounge = beanbags around Top1's Music Corner speaker
    const spk = B.vat.find((v) => v.id === 'loa-nhac');
    WORLD.tables.push({ id: 'lounge', name: 'Music Corner', x: spk.x + 1.2, z: spk.z + 2.2, kind: 'lounge', room: null,
      seats: [[2.4, 0], [2.1, 2.0], [0.7, 3.4], [-1.2, 3.6]].map(([dx, dz]) => ({ x: spk.x + dx, z: spk.z + dz, ry: Math.atan2(-dx, -dz), y: 0 })) });
    // v4's forest grove study tables (square wooden table + 4 tree-stump stools)
    [[80, -12], [80, -1], [86, 18], [101, 20], [116, 17], [84, 31], [104, 31]].forEach(([x, z], i) => {
      const c = F(x, z);
      const seats = [[2.2, 0], [-2.2, 0], [0, 2.2], [0, -2.2]].map(([dx, dz]) => ({ x: c.x + dx, z: c.z + dz, ry: Math.atan2(-dx, -dz), y: 0 }));
      WORLD.tables.push({ id: 'g' + (i + 1), name: 'Forest table ' + (i + 1), x: c.x, z: c.z, seats, kind: 'grove', area: 'forest', room: null });
    });

    // --- areas: plaza map + forest are one seamless map; gardens are private islands far away ---
    WORLD.areas = {
      campus: { name: 'Plaza', bounds: WORLD.bounds, center: { x: 6, z: 1 }, spawn: WORLD.spawn },
      forest: { name: 'Quiet Forest', bounds: { minX: L.RUNG.x1, maxX: L.RUNG.x2, minZ: L.RUNG.z1, maxZ: L.RUNG.z2 }, center: F(100, 0), spawn: F(50, 5) },
      garden: { name: 'My Garden', bounds: { minX: L.VUON.x1, maxX: L.VUON.x2, minZ: L.VUON.z1, maxZ: L.VUON.z2 }, center: { x: -400, z: 0 }, spawn: { x: -400, z: 29 } },
    };
    WORLD.forestOffset = { x: ox, z: oz };
    WORLD.forestGate = F(43, 5);   // on the forest path, just inside the east fence
    WORLD.forestExit = F(48, 5);   // forest side: walk back west through the gate corridor
    WORLD.fenceX = L.RAO_DONG;     // the east fence line (46.2 in the forest's own coordinates): west of it is the plaza map, east of it the forest
    WORLD.lake = Object.assign(F(102, -6), { r: 13 });
    WORLD.beds = [];   // the Garden Room (6 beds, fish pond, fishing dock, stall) was removed on 2026-11-15; the forest stands there now
    // v5: fishing chairs around the forest lake and along the winding stream (the forest dock is gone).
    // A spot: where you sit (x, z, ry) and where the float lands (bx, bz).
    WORLD.stream = [[114.5, -2], [120, 4], [117, 10], [123, 15], [120, 21], [127, 26], [134, 30]].map(([x, z]) => { const q = F(x, z); return [q.x, q.z]; });
    WORLD.fishSpots = [0, 0.6, 1.2, 1.9, 2.6, 3.2].map((a) => {
      const K = WORLD.lake, x = K.x + Math.cos(a) * 14.8, z = K.z + Math.sin(a) * 14.8;
      return { x, z, ry: Math.atan2(K.x - x, K.z - z), bx: K.x + Math.cos(a) * 8.5, bz: K.z + Math.sin(a) * 8.5, kind: 'lake', area: 'forest' };
    }).concat([{ x: 124.5, z: 6.5, bx: 119.6, bz: 5.4 }, { x: 125.6, z: 20, bx: 121, bz: 20.6 }].map((s) => {
      const a = F(s.x, s.z), b = F(s.bx, s.bz);
      return { x: a.x, z: a.z, bx: b.x, bz: b.z, ry: Math.atan2(b.x - a.x, b.z - a.z), kind: 'stream', area: 'forest' };
    }));
    // v5: food & drink stands (a study buff: Xu x1.1 – x1.25 for a while). The plaza cart stands by the north wall.
    WORLD.foodStands = [
      Object.assign(F(94, 31.5), { id: 'cafe', name: 'Forest Café', area: 'forest', front: F(94, 28.4) }),
      Object.assign(F(84.5, 8.5), { id: 'cartF', name: 'Ice-cream & drinks cart', area: 'forest', front: F(84.5, 6.4) }),
      { id: 'cartL', name: 'Bánh mì cart', area: 'campus', x: 6, z: -15.8, front: { x: 6, z: -13.6 } },
    ];
    // v5: forest playground (client-side rides) with a check-in on top of the climbing rock
    WORLD.playground = { swing: F(68, 20), merry: Object.assign(F(77, 25), { r: 2.2 }), riders: [F(69.5, 29), F(73, 30.5)], climb: Object.assign(F(66, -20), { top: 6, base: F(66, -17.2) }) };
    // v5 farm layout (garden island x -436..-364, z -32..32): crop fields SW, house NW, cloud flower garden N, pens NE, tank E, orchard SE
    WORLD.garden = {
      plotX: -434, plotZ: 6, cell: 2.2,                                  // crop fields (4x4 .. 8x8), packed tight
      tank: { x: -376, z: 2, r: 5, h: 3.6 },                             // big round fish tank
      tower: { x: -367.6, z: 2, top: 4.4, ladder: { x: -365.2, z: 2 }, feed: { x: -369.1, z: 2 } }, // ladder on the east side
      rack: { x: -400, z: -14, front: { x: -400, z: -4.4 } },            // cloud flower garden (bottom of the cloud stairs)
      trees: [[-388, 16], [-381, 16], [-374, 16], [-388, 24], [-381, 24], [-374, 24]],
      stall: { x: -406, z: 27, front: { x: -403.2, z: 27 } },            // garden market stall (counter faces the main path)
      board: { x: -393, z: 27.6, front: { x: -393, z: 29.8 } },          // notice board (opens the market)
      house: { minX: -432, maxX: -418, minZ: -28, maxZ: -18, door: { x: -425, z: -18 } },
      pens: {
        coop: { kind: 'chicken', name: 'Chicken coop', minX: -392, maxX: -382, minZ: -30, maxZ: -20, gate: { x: -387, z: -20 } },
        barn: { kind: 'cow', name: 'Cow barn', minX: -379, maxX: -366, minZ: -30, maxZ: -18, gate: { x: -372.5, z: -18 } },
        sty:  { kind: 'pig', name: 'Pig sty', minX: -392, maxX: -382, minZ: -15, maxZ: -6, gate: { x: -387, z: -6 } },
      },
      // walkable raised areas (client-side): platforms (y) and ramps (axis + low / high ends). 'tier' = cloud island level needed
      levels: [
        { id: 'R1', ramp: true, minX: -401.2, maxX: -398.8, minZ: -10, maxZ: -5, axis: 'z', a: -5, ya: 0, b: -10, yb: 3.5, tier: 0 },
        { id: 'T1', minX: -408, maxX: -392, minZ: -18, maxZ: -10, y: 3.5, tier: 0 },
        { id: 'R2', ramp: true, minX: -395.2, maxX: -392.8, minZ: -22, maxZ: -18, axis: 'z', a: -18, ya: 3.5, b: -22, yb: 7, tier: 1 },
        { id: 'T2', minX: -408, maxX: -392, minZ: -30, maxZ: -22, y: 7, tier: 1 },
        { id: 'R3', ramp: true, minX: -400, maxX: -396, minZ: -29.4, maxZ: -27, axis: 'x', a: -396, ya: 7, b: -400, yb: 10.5, tier: 2 },
        { id: 'T3', minX: -408, maxX: -400, minZ: -31, maxZ: -24, y: 10.5, tier: 2 },
        { id: 'HR', ramp: true, minX: -421.2, maxX: -418.8, minZ: -25.2, maxZ: -19.2, axis: 'z', a: -19.2, ya: 0, b: -25.2, yb: 3.4, house: true },
        { id: 'H2a', minX: -431.6, maxX: -421.2, minZ: -27.6, maxZ: -18.4, y: 3.4, house: true },
        { id: 'H2b', minX: -421.2, maxX: -418.4, minZ: -27.6, maxZ: -25.2, y: 3.4, house: true },
      ],
    };

    // --- v4's lobby things, placed on the Top1 map ---
    const qc = B.vat.find((v) => v.id === 'quay-cua-hang');
    WORLD.shops = [                                                      // where you stand to open the shop
      { x: qc.x - 3, z: qc.z, room: 'cua-hang', name: 'Shop counter' },  // Shop & Wardrobe room
    ];
    WORLD.shop = WORLD.shops[0];
    WORLD.bins = [{ x: -12.5, z: 14.5 }, { x: 12.5, z: -14.5 }, { x: 7, z: 15.2 }];
    WORLD.market = { x: -10, z: -7.5, front: { x: -10, z: -5.1 } };   // market board on the plaza
    WORLD.board = { x: 10, z: -7.5, front: { x: 10, z: -5.1 } };      // weekly "most beautiful garden / tank" board on the plaza
    WORLD.merchantSpots = [[-5, 5], [6, -5], [-6.5, -3.5], [5, 15], [-12, 0], [12, 0]];
    WORLD.zones = [{ id: 'lounge', name: 'Music Corner', x: spk.x + 1, z: spk.z + 1.5, w: 9, d: 9 }];
    WORLD.landmarks = [{ id: 'campfire', name: 'Campfire', x: 0, z: 0, r: 5 }]
      .concat(WORLD.rooms.map((r) => ({ id: r.id, name: r.name, x: r.center.x, z: r.center.z, r: 6 })))
      .concat([
        { id: 'music', name: 'Music Corner', x: spk.x, z: spk.z, r: 4 },
        { id: 'market', name: 'Market', x: WORLD.market.front.x, z: WORLD.market.front.z, r: 3.5 },
        { id: 'board', name: 'Leaderboard', x: WORLD.board.front.x, z: WORLD.board.front.z, r: 3.5 },
        { id: 'forestGate', name: 'Quiet Forest Gate', x: WORLD.forestGate.x - 3, z: WORLD.forestGate.z, r: 4 },
        Object.assign(F(89, -17), { id: 'waterfall', name: 'Waterfall', r: 6, area: 'forest' }),
        Object.assign(F(89.4, 1.5), { id: 'fishing', name: 'Fishing Lake', r: 3.5, area: 'forest' }),
        Object.assign(F(72, 22), { id: 'playground', name: 'Playground', r: 4, area: 'forest' }),
        Object.assign(F(66, -20), { id: 'climb', name: 'Top of the climbing rock', r: 2.5, area: 'forest' }),
      ]);
    const obstacles = L.vatCanTatCa();
    const props = WORLD.bins.concat([WORLD.market, WORLD.board], WORLD.foodStands.filter((s) => s.area === 'campus'));
    /** Is this plaza spot free of walls, furniture and props? (used to scatter trash) */
    WORLD.isFree = (x, z) => {
      const q = L.dayRa({ x, z }, obstacles);
      if (Math.abs(q.x - x) > 1e-6 || Math.abs(q.z - z) > 1e-6) return false;
      if (props.some((o) => Math.hypot(x - o.x, z - o.z) < 3.4)) return false;
      return !WORLD.tables.some((tb) => !tb.area && !tb.room && tb.seats.some((st) => Math.hypot(x - st.x, z - st.z) < 1.6));
    };
    /** Which closed room contains this spot (null = outdoors). */
    WORLD.roomAt = (x, z) => { for (const r of WORLD.rooms) if (x >= r.rect.x1 && x <= r.rect.x2 && z >= r.rect.z1 && z <= r.rect.z2) return r.id; return null; };
    WORLD.ready = true;
    return WORLD;
  }

  // ---- character look (campus-export): a small plain object, checked here so the server never trusts the browser ----
  const LOOK_DEFAULT = { skin: '#f6cfae', headSize: 1, bodySize: 1, eyeStyle: 'oval', eyeColor: '#111111', brow: 'serious', mouth: 'line', blush: false, glasses: false,
    hairStyle: 'split', hairA: '#1b1b1b', hairB: '#f0f0f0', hood: 'up', hoodColor: '#d6b48c', top: 'tunic', outfit: '#e4cda6', crossStraps: true, trim: '#8a4a2a',
    legs: 'shorts', pants: '#6b5a46', boots: 'boots', bootColor: '#7a3b1f', item: 'sword', itemColor: '#d9b24c', scarf: false, scarfColor: '#c0392b', backpack: false, backpackColor: '#6b4a2f' };
  const LOOK_CHOICES = { eyeStyle: ['oval', 'round', 'sleepy', 'happy'], brow: ['serious', 'soft', 'flat', 'none'], mouth: ['line', 'smile', 'open', 'frown'],
    hairStyle: ['split', 'short', 'long', 'spiky', 'bun', 'none'], hood: ['up', 'down', 'none'], top: ['tunic', 'shirt', 'robe'], legs: ['shorts', 'pants'],
    boots: ['boots', 'shoes', 'sandals'], item: ['sword', 'staff', 'book', 'flower', 'none'] };
  const LOOK_RANGE = { headSize: [0.85, 1.2], bodySize: [0.8, 1.3] };
  function fixLook(look) {
    const out = {};
    look = look && typeof look === 'object' ? look : {};
    for (const k in LOOK_DEFAULT) {
      const d = LOOK_DEFAULT[k], v = look[k];
      if (LOOK_CHOICES[k]) out[k] = LOOK_CHOICES[k].includes(v) ? v : d;
      else if (LOOK_RANGE[k]) out[k] = Math.round(clamp(num(v, d), LOOK_RANGE[k][0], LOOK_RANGE[k][1]) * 100) / 100;
      else if (typeof d === 'boolean') out[k] = typeof v === 'boolean' ? v : d;
      else out[k] = typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v) ? v.toLowerCase() : d;
    }
    return out;
  }
  const EMOTES = ['wave', 'dance', 'cheer', 'clap', 'bow', 'laugh', 'shrug', 'spin'];

  // ---- who can see whom (campus-export's closed rooms + v4's private gardens) ----
  // Outdoors (plaza, corridors, forest) is one group; each closed room is its own group; each garden island too.
  // The server sends positions only inside a group, so players inside a room are never sent to players outside.
  function viewKey(p) { return p.area === 'garden' ? 'g:' + (p.gid || '') : (p.area === 'campus' && p.room ? 'r:' + p.room : 'o'); }
  function moveRow(p) { return [p.id, Math.round(p.x * 100) / 100, Math.round(p.z * 100) / 100, Math.round(p.ry * 100) / 100, p.moving ? 1 : 0, Math.round((p.y || 0) * 100) / 100]; }

  const COLORS = ['#e53935', '#1e88e5', '#43a047', '#fdd835', '#fb8c00', '#8e24aa', '#ec407a', '#00acc1', '#6d4c41', '#f5f5f5', '#424242', '#7cb342'];
  const MAX_SONGS_PER_PLAYER = 2;
  const MAX_SONG_SECONDS = 6 * 60;
  const CHAT_MAX = 200;
  const CHAT_HISTORY = 60;

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function cleanText(s, max) {
    return String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
  }
  function num(v, d) { v = Number(v); return Number.isFinite(v) ? v : d; }

  function Room(opts) {
    this.cap = opts.cap || 40;
    this.send = opts.send; // (toId|null, msg)
    this.now = opts.now || (() => Date.now());
    this.checkAdmin = opts.checkAdmin || (() => false);
    this.onReport = opts.onReport || (() => {});
    this.track = opts.track || null; // (event) => void. Anonymous usage events, kept by the server only (see TRACKING.md); solo mode tracks nothing
    this.players = new Map();
    this.seats = {}; // "tableId:idx" -> playerId
    this.chat = [];
    this.queue = []; // [{id, videoId, title, duration, by, byName}]
    this.current = null; // {song, startedAt}
    this.dirtyMoves = new Set();
    this.nextSongId = 1;
    // v2: profiles (Xu, inventory, garden) are loaded/saved through an injected store
    this.store = opts.store || { load: () => null, save: () => {} };
    this.trash = new Map();
    this.nextTrash = 1;
    this.lastTrashSpawn = 0;
    this.lastEcon = 0;
    this.lastSave = 0;
    // v3: player market + travelling merchant
    const saved = this.store.loadMeta ? this.store.loadMeta('market') : null;
    this.market = Array.isArray(saved) ? saved : [];
    this.nextListing = this.market.reduce((m, l) => Math.max(m, l.id || 0), 0) + 1;
    this.lastNpcBuy = this.now(); this.lastNpcList = 0;
    this.merchant = null; this.nextMerchant = this.now() + 60000;
    this.npcLikes = {}; this.gidIndex = {}; this.boardCache = null; // social
    this.friendReqs = []; // pending friend requests: { from, fromId, fromTok, name, to, until }
    if (!WORLD.ready) throw new Error('Call Room.setMap(map) with the Top1 map (logic.js) before creating a Room');
    // room plug-ins (campus-export): one per closed room; the cinema has the shared video queue
    this.onReading = opts.onReading || (() => {}); // the server adds each astrology reading to a CSV file (data/chiem-tinh.csv)
    this.checkBirth = opts.checkBirth || (() => true); // full check of a birth record (real date, known place): js/astro/birth.js validBirth
    this.plugins = Plugins.loadRooms({ send: (to, m) => this.send(to, m), now: () => this.now(), players: this.players, system: (to, text) => this.system(to, text),
      award: (p, amount, reason, note) => this.award(p, amount, reason, note), saveReading: (row) => this.onReading(row), ECON,
      loadMeta: (k) => (this.store.loadMeta ? this.store.loadMeta(k) : null), saveMeta: (k, v) => { if (this.store.saveMeta) this.store.saveMeta(k, v); },
      checkBirth: (b) => this.checkBirth(b), track: (p, e, props) => this.ev(p, e, props),
      world: WORLD, solo: !!opts.solo, rng: opts.rng || Math.random,       // the Game Room: which tables it runs, and whether computer players may fill a Werewolf table
      allProfiles: () => (this.store.all ? [...this.store.all()] : []) }, WORLD.rooms);
    this.lastPlug = 0;
    for (let i = 0; i < 5; i++) this.spawnTrash(true);
  }

  Room.WORLD = WORLD;
  Room.setMap = setMap;
  Room.fixLook = fixLook;
  Room.viewKey = viewKey;
  Room.EMOTES = EMOTES;
  Room.LOOK_DEFAULT = LOOK_DEFAULT;
  Room.Plugins = Plugins;
  Room.gidOf = gidOf;
  Room.Catalog = Catalog;
  Room.COLORS = COLORS;
  Room.MAX_SONGS_PER_PLAYER = MAX_SONGS_PER_PLAYER;
  Room.MAX_SONG_SECONDS = MAX_SONG_SECONDS;

  Room.prototype.publicPlayer = function (p) {
    return { id: p.id, name: p.name, color: p.color, look: p.look, emote: p.emote || null, x: p.x, z: p.z, ry: p.ry, y: p.y || 0, moving: p.moving, seat: p.seat, admin: p.admin,
      area: p.area || 'campus', room: p.room || null, gid: p.gid || null, ownGid: p.token ? gidOf(p.token) : null, bot: !!p.bot };
  };

  Room.prototype.musicState = function () {
    return { type: 'music', queue: this.queue, current: this.current, serverNow: this.now() };
  };

  /** One usage event (TRACKING.md). No names, no chat text, no birth details: `u` is the player's garden id (a made-up id), `s` this visit's connection id. */
  Room.prototype.ev = function (p, e, props) {
    if (!this.track || (p && p.bot)) return;
    const o = { t: this.now(), e, s: p ? p.id : null, u: p && p.token && !p.guest ? gidOf(p.token) : null };
    if (props) for (const k in props) o[k] = props[k];
    try { this.track(o); } catch (err) { /* tracking must never break the game */ }
  };
  Room.prototype.system = function (to, text) {
    this.send(to, { type: 'chat', system: true, text });
  };

  // Returns true if joined, false if full.
  Room.prototype.join = function (id, hello) {
    if (this.players.size >= this.cap) {
      this.send(id, { type: 'full', cap: this.cap });
      return false;
    }
    let name = cleanText(hello && hello.name, 16) || 'Player' + Math.floor(Math.random() * 900 + 100);
    const look = fixLook(hello && hello.look); // the customised character (campus-export); its outfit colour doubles as the chat colour
    const color = look.outfit;
    const p = {
      id, name, color, look, emote: null, y: 0, room: null, bot: !!(hello && hello.bot),
      x: WORLD.spawn.x + (Math.random() - 0.5) * 2.4, z: WORLD.spawn.z + (Math.random() - 0.5) * 2.4,
      ry: Math.PI, moving: false, seat: null, admin: false,
      lastChat: 0, lastTableChat: 0, lastSong: 0, lastReport: 0,
      area: 'campus', lastActive: this.now(), carry: 0, walkAcc: 0, earnAcc: {}, seatSince: 0, fishing: null, ret: null,
    };
    // v2: load this browser's profile (Xu, bag, garden). Bots have no token and no profile.
    const token = String((hello && hello.token) || '');
    if (/^[a-f0-9]{16,40}$/.test(token)) {
      const busy = [...this.players.values()].some((q) => q.token === token && !q.guest);
      if (busy) { p.guest = true; p.pr = fixProfile(null); }
      else { p.token = token; const saved = this.store.load(token); p.returning = !!saved; p.pr = fixProfile(saved); }
    }
    p.joinedAt = this.now();
    this.ev(p, 'session_start', { client: CLIENTS.includes(hello && hello.client) ? hello.client : 'other', returning: !!p.returning, guest: !!p.guest });
    this.players.set(id, p);
    this.send(id, {
      type: 'welcome', you: id, cap: this.cap, serverNow: this.now(),
      players: [...this.players.values()].map((q) => this.publicPlayer(q)),
      seats: this.seats, chat: this.chat,
      profile: p.pr || null, trash: this.trashList(), carry: 0, guest: !!p.guest,
      market: this.marketFor(p), merchant: this.merchant,
    });
    if (p.guest) this.system(id, 'You have the game open in another tab — this tab uses a temporary wallet and will not be saved.');
    if (p.pr) { p.pr.name = p.name; this.dailyUpkeep(p); }
    if (p.token && !p.guest) { this.gidIndex[gidOf(p.token)] = p.token; this.sendFriends(p); this.friendsChanged(p, true); }
    this.send(id, this.musicState());
    for (const q of this.players.values()) if (q.id !== id) this.send(q.id, { type: 'join', player: this.publicPlayer(p) });
    this.broadcastCount();
    return true;
  };

  Room.prototype.broadcastCount = function () {
    this.send(null, { type: 'count', n: this.players.size, cap: this.cap });
  };

  Room.prototype.leave = function (id) {
    const p = this.players.get(id);
    if (!p) return;
    if (p.room) this.setRoom(p, null, true);
    this.freeSeat(p, true);
    this.saveProfile(p);
    this.ev(p, 'session_end', { minutes: Math.round((this.now() - (p.joinedAt || this.now())) / 6000) / 10 });
    this.players.delete(id);
    if (p.token && !p.guest) this.friendsChanged(p, false);
    if (![...this.players.values()].some((q) => !q.bot)) for (const k in this.plugins) this.plugins[k].reset(); // everyone left: rooms forget their state
    this.dirtyMoves.delete(id);
    // Their songs stay in the queue (nothing tied to accounts) — except we drop queued (not playing) songs to keep the
    // per-player limit meaningful for a returning visitor with a new id. Current song keeps playing.
    this.queue = this.queue.filter((s) => s.by !== id);
    this.send(null, { type: 'leave', id });
    this.send(null, this.musicState());
    this.broadcastCount();
  };

  Room.prototype.freeSeat = function (p, silent) {
    if (!p.seat) return;
    const tableId = p.seat.split(':')[0]; const idx = Number(p.seat.split(':')[1]);
    delete this.seats[p.seat];
    p.seat = null; p.seatSince = 0;
    this.send(null, { type: 'seat', seat: null, id: p.id, seats: this.seats });
    const tbl = WORLD.tables.find((x) => x.id === tableId); const plug = tbl && tbl.room && this.plugins[tbl.room];
    if (plug && plug.onStand) plug.onStand(p, tableId, idx);
    if (!silent) this.tableSystem(tableId, p.name + ' stood up.');
    else this.tableSystem(tableId, p.name + ' left the table.');
  };

  Room.prototype.tableMembers = function (tableId) {
    const ids = [];
    for (const key in this.seats) if (key.split(':')[0] === tableId) ids.push(this.seats[key]);
    return ids;
  };

  Room.prototype.tableSystem = function (tableId, text) {
    for (const pid of this.tableMembers(tableId)) this.send(pid, { type: 'tableChat', table: tableId, system: true, text });
  };

  Room.prototype.handle = function (id, msg) {
    const p = this.players.get(id);
    if (!p || !msg || typeof msg.type !== 'string') return;
    const t = this.now();
    p.lastActive = t; p.afkSent = false;
    if (msg.type.indexOf('.') > 0) { // "<room id>.something" goes to that room's plug-in
      const plug = this.plugins[msg.type.split('.')[0]];
      if (plug) plug.onMessage(p, msg);
      return;
    }
    switch (msg.type) {
      case 'look': { // changed character / name in the customizer
        if (t - (p.lastLook || 0) < 150) return;
        p.lastLook = t;
        p.look = fixLook(msg.look); p.color = p.look.outfit;
        const nm = cleanText(msg.name, 16);
        if (nm && [...nm].length >= 2 && nm !== p.name) { p.name = nm; if (p.pr) { p.pr.name = nm; p.dirty = true; } }
        this.send(null, { type: 'look', id, look: p.look, name: p.name, color: p.color });
        break;
      }
      case 'emote': { // play / stop an emote (cosmetic)
        const e = EMOTES.includes(msg.emote) ? msg.emote : null;
        if (e && p.seat) return;
        p.emote = e;
        this.send(null, { type: 'emote', id, emote: e });
        break;
      }
      case 'move': {
        if (p.seat) return; // seated players don't move; client sends 'stand' first
        const b = (WORLD.areas[p.area] || WORLD.areas.campus).bounds;
        const ox = p.x, oz = p.z;
        p.x = clamp(num(msg.x, p.x), b.minX, b.maxX);
        p.z = clamp(num(msg.z, p.z), b.minZ, b.maxZ);
        p.ry = num(msg.ry, p.ry);
        p.moving = !!msg.moving;
        p.y = clamp(num(msg.y, 0), 0, 12); // height (cosmetic): a jump, or standing on a cloud island / tower of the farm
        if (p.moving && p.emote) { p.emote = null; this.send(null, { type: 'emote', id, emote: null }); }
        this.dirtyMoves.add(id); // positions only go to players in the same view group (see viewKey)
        if (p.area === 'campus') { const r = WORLD.roomAt(p.x, p.z); if (r !== p.room) this.setRoom(p, r); }
        if (p.pr) this.onWalk(p, Math.hypot(p.x - ox, p.z - oz));
        break;
      }
      case 'active': break; // "still here" ping from the client (AFK check)
      case 'area': this.changeArea(p, String(msg.to || ''), String(msg.gid || '')); break;
      case 'friendAdd': this.friendAdd(p, msg.id); break;
      case 'friendAnswer': this.friendAnswer(p, String(msg.gid || ''), !!msg.ok); break;
      case 'friendRemove': this.friendRemove(p, String(msg.gid || '')); break;
      case 'friends': this.sendFriends(p); break;
      case 'like': this.like(p); break;
      case 'board': this.sendBoard(p); break;
      case 'quizAnswer': this.quizAnswer(p, msg); break;
      case 'useBoost': this.gardenAction(p, msg); break;
      case 'pickTrash': this.pickTrash(p, Number(msg.id)); break;
      case 'dropTrash': this.dropTrash(p, Number(msg.bin)); break;
      case 'fishCast': this.fishCast(p, Number(msg.spot)); break;
      case 'feedAnimals': case 'collectAnimal': case 'setPot': case 'furnPlace': case 'furnRemove': this.gardenAction(p, msg); break;
      case 'buyFood': this.buyFood(p, String(msg.item || ''), String(msg.stand || '')); break;
      case 'fishReel': this.fishReel(p, !!msg.ok); break;
      case 'fishCancel': p.fishing = null; break;
      case 'buy': this.buy(p, String(msg.item || ''), Math.floor(num(msg.qty, 1))); break;
      case 'sell': this.sell(p, msg); break;
      case 'plant': case 'water': case 'harvest':
      case 'pondRelease': case 'pondTake': case 'pondFeed':
      case 'decorPlace': case 'decorMove': case 'decorStore':
      case 'care': case 'dig': case 'tankDecor': case 'tankDecorTake':
        this.gardenAction(p, msg); break;
      case 'marketList': case 'marketCancel': case 'marketBuy': this.marketAction(p, msg); break;
      case 'merchantSell': this.merchantSell(p, Math.floor(num(msg.qty, 1))); break;
      case 'chat': {
        const text = cleanText(msg.text, CHAT_MAX);
        if (!text || t - p.lastChat < 600) return;
        p.lastChat = t;
        const m = { type: 'chat', id: p.id, name: p.name, color: p.color, text, t };
        this.ev(p, 'chat_sent', { channel: p.area === 'forest' ? 'forest' : 'all' });
        if (p.area === 'forest') { // quiet forest: Local chat only (people close by or at your table)
          m.local = true;
          const table = p.seat && p.seat.split(':')[0];
          for (const q of this.players.values()) {
            const sameTable = table && q.seat && q.seat.split(':')[0] === table;
            if (q.area === 'forest' && (sameTable || Math.hypot(q.x - p.x, q.z - p.z) <= ECON.localChatRadius)) this.send(q.id, m);
          }
          break;
        }
        this.chat.push(m);
        if (this.chat.length > CHAT_HISTORY) this.chat.shift();
        for (const q of this.players.values()) if (q.area !== 'forest') this.send(q.id, m); // "All" is muted inside the forest
        break;
      }
      case 'sit': {
        const tbl = WORLD.tables.find((x) => x.id === msg.table);
        const idx = Number(msg.seat);
        if (!tbl || !(idx >= 0 && idx < tbl.seats.length)) return;
        if ((tbl.area || 'campus') !== p.area || (tbl.room || null) !== (p.room || null)) return; // only seats of the room / area you are in
        const key = tbl.id + ':' + idx;
        if (this.seats[key] && this.seats[key] !== id) { this.system(id, 'That seat is taken.'); return; }
        const s = tbl.seats[idx];
        if (Math.hypot(p.x - s.x, p.z - s.z) > 4) return; // must be next to the chair
        const plug = tbl.room && this.plugins[tbl.room];   // a room may refuse a chair (a game is running at that table…)
        if (plug && plug.canSit && this.seats[key] !== id) { const why = plug.canSit(p, tbl.id, idx); if (why) { this.system(id, why); return; } }
        if (p.seat === key) return;
        if (p.seat) this.freeSeat(p, false);
        this.seats[key] = id;
        p.seat = key; p.x = s.x; p.z = s.z; p.ry = s.ry; p.moving = false; p.seatSince = t;
        p.y = 0; if (p.emote) { p.emote = null; this.send(null, { type: 'emote', id, emote: null }); }
        this.send(null, { type: 'seat', seat: key, id, seats: this.seats, x: s.x, z: s.z, ry: s.ry, y: s.y || 0 });
        this.tableSystem(tbl.id, p.name + ' sat down at ' + tbl.name + '.');
        if (tbl.room !== 'tro-choi') this.ev(p, tbl.kind === 'cinema' ? 'cinema_sit' : 'study_sit', { place: tbl.room || (tbl.area === 'forest' ? 'forest' : 'plaza') }); // game tables report game_start instead
        if (plug && plug.onSit) plug.onSit(p, tbl.id, idx);
        break;
      }
      case 'stand':
        this.freeSeat(p, false);
        break;
      case 'tableChat': {
        if (!p.seat) return;
        const text = cleanText(msg.text, CHAT_MAX);
        if (!text || t - p.lastTableChat < 400) return;
        p.lastTableChat = t;
        const tableId = p.seat.split(':')[0];
        const tb = WORLD.tables.find((x) => x.id === tableId); const plug = tb && tb.room && this.plugins[tb.room];
        if (plug && plug.onTableChat && plug.onTableChat(p, tableId, text)) break; // the room runs this table's chat itself (Werewolf nights are silent…)
        this.ev(p, 'chat_sent', { channel: 'table' });
        const m = { type: 'tableChat', table: tableId, id: p.id, name: p.name, color: p.color, text, t };
        for (const pid of this.tableMembers(tableId)) this.send(pid, m);
        break;
      }
      case 'addSong': {
        const videoId = String(msg.videoId || '');
        if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) { this.system(id, 'That is not a valid YouTube link.'); return; }
        const duration = num(msg.duration, 0);
        if (!(duration > 0)) { this.system(id, 'Could not read the song length.'); return; }
        if (duration >= MAX_SONG_SECONDS) { this.system(id, 'Songs must be shorter than 6 minutes.'); return; }
        const mine = this.queue.filter((s) => s.by === id).length + (this.current && this.current.song.by === id ? 1 : 0);
        if (mine >= MAX_SONGS_PER_PLAYER) { this.system(id, 'You can have at most 2 songs in the queue.'); return; }
        if (t - p.lastSong < 2000) return;
        p.lastSong = t;
        const song = { id: 's' + this.nextSongId++, videoId, title: cleanText(msg.title, 90) || 'YouTube video', duration, by: id, byName: p.name };
        this.queue.push(song);
        this.ev(p, 'media_add', { where: 'music' });
        this.send(null, { type: 'chat', system: true, text: p.name + ' added "' + song.title + '" to the music queue.' });
        if (!this.current) this.advance();
        else this.send(null, this.musicState());
        break;
      }
      case 'removeSong': {
        const sid = String(msg.songId || '');
        const inQueue = this.queue.find((s) => s.id === sid);
        const isCurrent = this.current && this.current.song.id === sid ? this.current.song : null;
        const song = inQueue || isCurrent;
        if (!song) return;
        if (song.by !== id && !p.admin) { this.system(id, 'Only admins can remove other people’s songs.'); return; }
        if (inQueue) { this.queue = this.queue.filter((s) => s.id !== sid); this.send(null, this.musicState()); }
        else this.advance();
        if (song.by !== id) this.system(null, 'An admin removed "' + song.title + '".');
        break;
      }
      case 'adminLogin': {
        if (p.admin) return;
        if (this.checkAdmin(String(msg.password || ''))) {
          p.admin = true;
          this.send(id, { type: 'admin', ok: true });
          this.send(null, { type: 'playerAdmin', id });
        } else {
          this.send(id, { type: 'admin', ok: false });
        }
        break;
      }
      case 'report': {
        const target = this.players.get(String(msg.target || ''));
        if (!target || target.id === id || t - p.lastReport < 5000) return;
        p.lastReport = t;
        const r = { from: p.name, fromId: id, target: target.name, targetId: target.id, reason: cleanText(msg.reason, 200), t };
        this.onReport(r); this.ev(p, 'report_filed');
        for (const q of this.players.values()) if (q.admin) this.send(q.id, Object.assign({ type: 'reportIn' }, r));
        this.system(id, 'Thanks — your report about ' + target.name + ' was sent to the admins.');
        break;
      }
    }
  };

  Room.prototype.advance = function () {
    const next = this.queue.shift();
    this.current = next ? { song: next, startedAt: this.now() + 1500 } : null; // small lead so everyone starts together
    this.send(null, this.musicState());
  };

  // Call ~10x per second.
  Room.prototype.tick = function () {
    if (this.dirtyMoves.size) {
      const groups = {};
      for (const id of this.dirtyMoves) {
        const p = this.players.get(id);
        if (p) { const k = viewKey(p); (groups[k] = groups[k] || []).push(moveRow(p)); }
      }
      this.dirtyMoves.clear();
      for (const q of this.players.values()) { const list = groups[viewKey(q)]; if (list) this.send(q.id, { type: 'moves', list }); }
    }
    if (this.current && this.now() > this.current.startedAt + this.current.song.duration * 1000 + 500) this.advance();
    const t = this.now();
    if (t - this.lastPlug >= 500) { this.lastPlug = t; for (const k in this.plugins) this.plugins[k].tick(); }
    if (t - this.lastEcon >= 1000) { this.lastEcon = t; this.econTick(t); }
    if (t - this.lastSave >= 3000) {
      this.lastSave = t;
      for (const p of this.players.values()) if (p.dirty) this.saveProfile(p);
    }
  };

  // =====================================================================
  // closed rooms (campus-export): membership follows your position; hooks + hidden-from-outside positions
  // =====================================================================
  Room.prototype.setRoom = function (p, room, silent) {
    room = room || null;
    if ((p.room || null) === room) return;
    const old = p.room && this.plugins[p.room];
    if (old) { old.members.delete(p.id); old.onLeave(p); }
    p.room = room;
    const cur = room && this.plugins[room];
    if (cur) { cur.members.add(p.id); cur.onEnter(p); }
    if (room) this.ev(p, 'room_enter', { room });
    if (silent) return;
    this.send(null, { type: 'room', id: p.id, room });
    this.sendSnapshot(p);
  };
  /** After changing view group: tell the player where everyone in the new group is, and show the player to them. */
  Room.prototype.sendSnapshot = function (p) {
    const key = viewKey(p), list = [];
    for (const q of this.players.values()) if (q.id !== p.id && viewKey(q) === key) list.push(moveRow(q));
    if (list.length) this.send(p.id, { type: 'moves', list, snap: true });
    this.dirtyMoves.add(p.id);
  };
  Room.prototype.roomCounts = function () {
    const c = {};
    for (const q of this.players.values()) { const k = q.area === 'garden' ? 'vuon' : q.area === 'forest' ? 'rung' : (q.room || 'chung'); c[k] = (c[k] || 0) + 1; }
    return c;
  };

  // =====================================================================
  // v2: profiles + economy
  // =====================================================================
  const CLIENTS = ['web-desktop', 'web-phone', 'android-app']; // how the player opened the game (sent by the browser in its hello)
  const FRIEND_MAX = 50, FRIEND_REQ_MS = 120000; // friends per player; how long a friend request waits for an answer
  function dayKey(t) { const d = new Date(t); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  function fixProfile(pr) {
    if (!pr || typeof pr !== 'object') pr = {};
    const out = {
      v: 5,
      xu: Number.isFinite(pr.xu) ? pr.xu : ECON.startXu,
      inv: pr.inv && typeof pr.inv === 'object' ? pr.inv : { 'seed:carrot': 3, 'seed:potato': 1, 'seed:daisy': 2, 'sapling:lemon': 1, fert: 3, food: 5, 'decor:flowers': 1, 'tank:seaweed': 1 },
      bag: Array.isArray(pr.bag) ? pr.bag : [],
      garden: pr.garden && typeof pr.garden === 'object' ? pr.garden : {},
      day: pr.day || '', earned: pr.earned || 0, walk: pr.walk || 0, checkins: Array.isArray(pr.checkins) ? pr.checkins : [],
      byReason: pr.byReason && typeof pr.byReason === 'object' ? pr.byReason : {},
      log: Array.isArray(pr.log) ? pr.log : [],
      nextUid: pr.nextUid || 1,
      stats: pr.stats && typeof pr.stats === 'object' ? pr.stats : { fishCaught: 0, harvested: 0, trash: 0 },
    };
    const g = out.garden;
    const lvl = (v, key) => Math.max(0, Math.min(Catalog.UPGRADES[key].length - 1, v | 0)); // (v4 capped land at level 2 here, undoing bigger upgrades on reload)
    g.land = lvl(g.land, 'land'); g.pond = lvl(g.pond, 'pond'); g.pots = lvl(g.pots, 'pots'); g.orchard = lvl(g.orchard, 'orchard');
    g.coop = lvl(g.coop, 'coop'); g.sty = lvl(g.sty, 'sty'); g.barn = lvl(g.barn, 'barn'); g.house = lvl(g.house, 'house'); // v5 farm
    if (!Array.isArray(g.animals)) g.animals = [];
    if (!g.potTypes || typeof g.potTypes !== 'object') g.potTypes = {};
    if (!g.furniture || typeof g.furniture !== 'object') g.furniture = {};
    if (pr.buff) out.buff = pr.buff;
    if (g.beds && typeof g.beds === 'object') for (const rec of Object.values(g.beds)) { // the Garden Room is gone: what grew in its beds comes back as seeds
      if (rec && Catalog.plantInfo(rec.s)) out.inv['seed:' + rec.s] = (out.inv['seed:' + rec.s] || 0) + 1;
    }
    g.beds = {};
    if (!g.plots || typeof g.plots !== 'object') g.plots = {};
    if (!g.flowerPots || typeof g.flowerPots !== 'object') g.flowerPots = {};
    if (!g.trees || typeof g.trees !== 'object') g.trees = {};
    if (!Array.isArray(g.fish)) g.fish = [];
    if (!Array.isArray(g.decor)) g.decor = [];
    if (!Array.isArray(g.tankDecor)) g.tankDecor = [];
    if (!Array.isArray(g.boosts)) g.boosts = [];
    if (pr.name) out.name = pr.name;
    if (pr.likes) out.likes = pr.likes;
    if (pr.likesGiven) out.likesGiven = pr.likesGiven;
    if (pr.friends && typeof pr.friends === 'object') { // friends: garden id -> { name }
      out.friends = {};
      for (const gid of Object.keys(pr.friends).slice(0, FRIEND_MAX)) if (/^g[a-z0-9]{1,12}$/.test(gid)) out.friends[gid] = { name: cleanText(pr.friends[gid] && pr.friends[gid].name, 16) || 'Classmate' };
    }
    if (pr.upkeepDay) out.upkeepDay = pr.upkeepDay;
    if (pr.astroDay) out.astroDay = pr.astroDay;
    if (pr.match && typeof pr.match === 'object') out.match = pr.match; // Colour Match: stars per level and the level in progress
    if ((pr.v | 0) < 3 && pr.inv) { // v2 -> v3: old vegetables are refunded as Xu
      // (all v2 vegetables exist again in v4, so nothing needs refunding — just drop unknown items)
      for (const key of Object.keys(out.inv)) if (/^(seed|crop):/.test(key) && !Catalog.itemInfo(key)) delete out.inv[key];
      const size = Catalog.UPGRADES.land[g.land].size;
      for (const [k, rec] of Object.entries(g.plots)) {
        const [r, c] = k.split(',').map(Number);
        if (!Catalog.plantInfo(rec.s) || r >= size || c >= size) delete g.plots[k];
        else { rec.w = !!rec.w; rec.f = !!rec.f; }
      }
      if (!out.inv.fert) out.inv.fert = 3;
    }
    if ((pr.v | 0) < 5 && Array.isArray(g.decor) && g.decor.length) { // v4 island -> v5 farm: the layout changed, so placed decorations go back to the bag
      for (const d of g.decor) if (d && Catalog.DECOR[d.item]) out.inv['decor:' + d.item] = (out.inv['decor:' + d.item] || 0) + 1;
      g.decor = [];
    }
    return out;
  }
  Room.fixProfile = fixProfile;

  Room.prototype.saveProfile = function (p) {
    if (!p.pr || !p.token || p.guest) return;
    p.dirty = false;
    try { this.store.save(p.token, p.pr); } catch (e) { /* ignore */ }
  };
  Room.prototype.sendProfile = function (p) {
    if (!p.pr) return;
    p.dirty = true;
    this.send(p.id, { type: 'profile', profile: p.pr });
  };
  Room.prototype.rollDay = function (p, t) {
    const k = dayKey(t);
    if (p.pr.day !== k) { p.capWarned = false; p.pr.day = k; p.pr.earned = 0; p.pr.walk = 0; p.pr.checkins = []; p.pr.byReason = {}; }
  };
  Room.prototype.logLine = function (p, reason, amount, note) {
    p.pr.log.push({ t: this.now(), r: reason, a: amount, n: note || '' });
    if (p.pr.log.length > 40) p.pr.log.splice(0, p.pr.log.length - 40);
  };
  // Activity earnings (count toward the daily cap)
  Room.prototype.award = function (p, amount, reason, note) {
    if (!p.pr || amount <= 0) return 0;
    const t = this.now();
    this.rollDay(p, t);
    const left = ECON.dailyCap - p.pr.earned;
    const a = Math.max(0, Math.min(amount, left));
    if (a <= 0) {
      if (!p.capWarned) { p.capWarned = true; this.send(p.id, { type: 'earn', amount: 0, reason, capped: true, xu: p.pr.xu }); }
      return 0;
    }
    p.pr.xu += a; p.pr.earned += a;
    p.pr.byReason[reason] = (p.pr.byReason[reason] || 0) + a;
    this.logLine(p, reason, a, note);
    this.send(p.id, { type: 'earn', amount: a, reason, note: note || '', xu: p.pr.xu, earned: p.pr.earned, capped: a < amount });
    this.sendProfile(p);
    return a;
  };
  Room.prototype.loungeCount = function () {
    const zn = WORLD.zones.find((z) => z.id === 'lounge');
    let n = 0;
    for (const q of this.players.values()) if ((q.area || 'campus') === 'campus' && !q.room && Math.abs(q.x - zn.x) <= zn.w / 2 && Math.abs(q.z - zn.z) <= zn.d / 2) n++;
    return n;
  };
  Room.prototype.inLounge = function (p) {
    const zn = WORLD.zones.find((z) => z.id === 'lounge');
    return p.area === 'campus' && !p.room && Math.abs(p.x - zn.x) <= zn.w / 2 && Math.abs(p.z - zn.z) <= zn.d / 2;
  };
  // Per-second: sitting/studying, lounge, pomodoro, AFK, trash respawn
  Room.prototype.econTick = function (t) {
    if (this.trash.size < ECON.trashMax && t - this.lastTrashSpawn > ECON.trashRespawnMs) this.spawnTrash();
    this.marketTick(t);
    let loungeN = -1;
    for (const p of this.players.values()) {
      if (!p.pr) continue;
      if (t - p.lastActive > ECON.afkMs) {
        if (!p.afkSent) { p.afkSent = true; this.send(p.id, { type: 'afk' }); }
        continue;
      }
      let rate = 0, reason = null;
      const tbl = p.seat ? WORLD.tables.find((x) => x.id === p.seat.split(':')[0]) : null;
      const cine = this.plugins['xem-phim'];
      if (tbl && tbl.kind !== 'lounge' && tbl.kind !== 'cinema' && tbl.kind !== 'game') {
        rate = ECON.studyPerMin; reason = 'study';
        if (this.tableMembers(tbl.id).length >= 2) rate *= ECON.groupMult;
        if (tbl.area === 'forest') rate *= ECON.forestMult;
        if (p.pr.buff && p.pr.buff.until > t) rate *= p.pr.buff.mult; // v5: food & drink buff
        if (p.seatSince && t - p.seatSince >= ECON.pomodoroMin * 60000) {
          p.seatSince = t;
          this.askQuiz(p, ECON.quizTries); // the bonus is paid only after a correct answer (anti auto-clicker)
        }
      } else if (p.room === 'xem-phim' && cine && cine.queue.current) { // watching a film together in the cinema (v4's lounge rule)
        rate = cine.members.size >= ECON.loungeCrowd ? ECON.loungeCrowdPerMin : ECON.loungePerMin; reason = 'lounge';
      } else if (this.current && this.inLounge(p)) {
        if (loungeN < 0) loungeN = this.loungeCount();
        rate = loungeN >= ECON.loungeCrowd ? ECON.loungeCrowdPerMin : ECON.loungePerMin; reason = 'lounge';
      }
      if (rate > 0) {
        p.earnAcc[reason] = (p.earnAcc[reason] || 0) + rate / 60;
        if (p.earnAcc[reason] >= 1 - 1e-9) {
          const whole = Math.floor(p.earnAcc[reason] + 1e-9);
          p.earnAcc[reason] -= whole;
          this.award(p, whole, reason);
        }
      }
    }
  };
  Room.prototype.onWalk = function (p, d) {
    const t = this.now();
    if (p.area !== 'garden' && d > 0 && d < 3) {
      p.walkAcc += d;
      if (p.walkAcc >= ECON.walkMeters) {
        p.walkAcc -= ECON.walkMeters;
        this.rollDay(p, t);
        if (p.pr.walk < ECON.walkDailyCap) { p.pr.walk += ECON.walkXu; this.award(p, ECON.walkXu, 'walk'); }
      }
    }
    // landmark check-ins (once per landmark per day)
    for (const lm of WORLD.landmarks) {
      if ((lm.area || 'campus') !== p.area) continue;
      if (Math.hypot(p.x - lm.x, p.z - lm.z) > lm.r) continue;
      this.rollDay(p, t);
      if (p.pr.checkins.includes(lm.id)) continue;
      p.pr.checkins.push(lm.id);
      this.award(p, ECON.checkinXu, 'checkin', lm.name);
    }
  };

  // ---- areas ----
  // to: 'forest' | 'campus' | 'garden' (gid = whose garden; empty = my own) | 'back'
  Room.prototype.changeArea = function (p, to, gid) {
    let dest = null, view = null;
    // v5: no prompt — walking through the east gate switches area in place (one seamless map)
    const inGate = Math.abs(p.z - WORLD.forestGate.z) < 4.2, fx = WORLD.fenceX;
    if (to === 'forest' && p.area === 'campus' && inGate && p.x >= fx - 2.2) dest = { area: 'forest', x: Math.max(p.x, fx + 1), z: p.z, ry: p.ry };
    else if (to === 'campus' && p.area === 'forest' && inGate && p.x <= fx + 3.3) dest = { area: 'campus', x: Math.min(p.x, fx + 0.4), z: p.z, ry: p.ry };
    else if (to === 'garden' && p.pr) {
      const own = p.token ? gidOf(p.token) : 'guest-' + p.id;
      const target = gid && gid !== own ? this.findGarden(gid) : null;
      if (gid && gid !== own && !target) { this.system(p.id, 'Garden not found.'); return; }
      if (p.area !== 'garden') p.ret = { area: p.area, x: p.x, z: p.z, ry: p.ry };
      dest = { area: 'garden', x: WORLD.areas.garden.spawn.x, z: WORLD.areas.garden.spawn.z, ry: Math.PI, gid: target ? gid : own };
      view = target;
    } else if (to === 'back' && p.area === 'garden') dest = p.ret || { area: 'campus', x: WORLD.spawn.x, z: WORLD.spawn.z, ry: Math.PI };
    if (!dest) return;
    if (p.seat) this.freeSeat(p, true);
    if (p.room) this.setRoom(p, null, true);
    p.fishing = null;
    p.area = dest.area; p.x = dest.x; p.z = dest.z; p.ry = dest.ry; p.moving = false; p.walkAcc = 0;
    p.gid = dest.area === 'garden' ? dest.gid : null;
    p.visiting = view ? gid : null;
    if (view) this.ev(p, 'garden_visit', { kind: view.npc ? 'villager' : p.pr && p.pr.friends && p.pr.friends[gid] ? 'friend' : 'player' });
    else if (dest.area !== 'campus' && to !== 'back') this.ev(p, 'area_enter', { area: dest.area === 'garden' ? 'my-garden' : dest.area });
    if (view) this.send(p.id, { type: 'gardenView', gid, owner: view.name, garden: view.garden, likes: view.likes, liked: this.likedToday(p, gid) });
    this.send(null, { type: 'area', id: p.id, area: p.area, x: p.x, z: p.z, ry: p.ry, gid: p.gid });
    const r = p.area === 'campus' ? WORLD.roomAt(p.x, p.z) : null; // coming back from the garden you may land inside a room
    if (r) this.setRoom(p, r); else { this.send(null, { type: 'room', id: p.id, room: null }); this.sendSnapshot(p); }
  };

  // ---- social: visiting gardens, likes, weekly boards (GDD §1) ----
  const NPC_GARDENS = [
    { gid: 'npc-lan', name: 'Cô Lan', seed: 1 }, { gid: 'npc-minh', name: 'Bác Minh', seed: 2 }, { gid: 'npc-huy', name: 'Huy', seed: 3 },
  ];
  // Showcase gardens for the villagers so the boards and visits are never empty (deterministic, built from timestamps)
  function npcGarden(seed, now) {
    let a = seed * 9301 + 49297; const r = () => { a = (a * 9301 + 49297) % 233280; return a / 233280; };
    const pick = (o) => { const k = Object.keys(o); return k[Math.floor(r() * k.length)]; };
    const g = { land: 1 + (seed % 2), pots: Math.min(2, seed), orchard: 1, pond: seed % 3, plots: {}, flowerPots: {}, trees: {}, fish: [], decor: [], tankDecor: [], boosts: [] };
    const size = Catalog.UPGRADES.land[g.land].size;
    for (let i = 0; i < size * size; i++) if (r() < 0.7) g.plots[Math.floor(i / size) + ',' + (i % size)] = { s: pick(Catalog.CROPS), at: now - r() * 600000, bonus: 0 };
    for (let i = 0; i < Catalog.UPGRADES.pots[g.pots].cap; i++) g.flowerPots[i] = { s: pick(Catalog.FLOWERS), at: now - 3600000, bonus: 0 };
    for (let i = 0; i < 4; i++) g.trees[i] = { s: pick(Catalog.FRUITS), at: now - 7200000, bonus: 0, m: true };
    for (let i = 0; i < 3 + seed; i++) { const sp = pick(Catalog.FISH); g.fish.push({ uid: i + 1, sp, size: Catalog.FISH[sp].size[1], fedAt: now }); }
    const decor = Object.keys(Catalog.DECOR);
    for (let i = 0; i < 4 + seed * 2; i++) { const left = r() < 0.5; g.decor.push({ uid: 100 + i, item: decor[Math.floor(r() * decor.length)], x: left ? -432 + r() * 14 : -394 + r() * 24, z: 28.5 + r() * 2.5, r: r() * 6 }); }
    g.coop = 1; g.sty = seed > 1 ? 1 : 0; g.barn = seed > 2 ? 1 : 0; g.house = Math.min(2, seed - 1);
    g.animals = []; let u = 500;
    for (let i = 0; i < 3 + seed; i++) g.animals.push({ uid: u++, kind: 'chicken', fedAt: now - (i % 2) * 999999 });
    for (let i = 0; i < seed; i++) g.animals.push({ uid: u++, kind: 'pig', fedAt: now });
    for (let i = 0; i < seed - 1; i++) g.animals.push({ uid: u++, kind: 'cow', fedAt: now });
    const furn = Object.keys(Catalog.FURNITURE); g.furniture = {};
    for (let i = 0; i < 6 + seed * 2; i++) g.furniture[i] = furn[Math.floor(r() * furn.length)];
    const potK = Object.keys(Catalog.POTS); g.potTypes = {};
    for (let i = 0; i < 8; i++) g.potTypes[i] = potK[Math.floor(r() * potK.length)];
    const td = Object.keys(Catalog.TANK_DECOR); for (let i = 0; i < 3 + seed; i++) g.tankDecor.push(td[i % td.length]);
    return g;
  }
  Room.prototype.findGarden = function (gid) {
    const now = this.now(), wk = Catalog.weekKey(now);
    const npc = NPC_GARDENS.find((n) => n.gid === gid);
    if (npc) return { name: npc.name + "'s garden", garden: npcGarden(npc.seed, now), likes: (this.npcLikes[gid] || 0), npc: true };
    for (const q of this.players.values()) if (q.token && !q.guest && gidOf(q.token) === gid && q.pr) return { name: q.name + "'s garden", garden: q.pr.garden, likes: q.pr.likes && q.pr.likes.week === wk ? q.pr.likes.n : 0, token: q.token, live: q };
    const tok = this.tokenOf(gid);
    const pr = tok && this.store.load(tok);
    if (pr) { const f = fixProfile(pr); return { name: (f.name || 'a classmate') + "'s garden", garden: f.garden, likes: f.likes && f.likes.week === wk ? f.likes.n : 0, token: tok }; }
    return null;
  };
  /** The saved-profile token behind a garden id (also after a server restart, when nobody has opened the leaderboard yet). */
  Room.prototype.tokenOf = function (gid) {
    if (!this.gidIndex[gid] && this.store.all) for (const [tok] of this.store.all()) if (!String(tok).startsWith('__')) this.gidIndex[gidOf(tok)] = tok;
    return this.gidIndex[gid] || null;
  };

  // ---- friends: ask a player you meet, they accept, and you can visit each other's garden from the Friends list at any time ----
  const friendGid = (p) => (p && p.token && !p.guest && p.pr ? gidOf(p.token) : null);
  Room.prototype.playerByGid = function (gid) { for (const q of this.players.values()) if (friendGid(q) === gid) return q; return null; };
  Room.prototype.sendFriends = function (p) {
    const me = friendGid(p); if (!me) return;
    const fr = p.pr.friends || {}, now = this.now();
    const list = Object.keys(fr).map((gid) => {
      const q = this.playerByGid(gid);
      if (q && fr[gid].name !== q.name) { fr[gid].name = q.name; p.dirty = true; } // keep the name fresh
      return { gid, name: fr[gid].name, online: !!q, id: q ? q.id : null };
    }).sort((a, b) => (b.online ? 1 : 0) - (a.online ? 1 : 0) || a.name.localeCompare(b.name));
    this.friendReqs = this.friendReqs.filter((r) => r.until > now);
    this.send(p.id, { type: 'friends', list, requests: this.friendReqs.filter((r) => r.to === me).map((r) => ({ gid: r.from, name: r.name })) });
  };
  /** A player came online or left: their friends' lists change. */
  Room.prototype.friendsChanged = function (p, online) {
    const me = friendGid(p) || (p.token ? gidOf(p.token) : null); if (!me) return;
    for (const q of this.players.values()) if (q.id !== p.id && q.pr && q.pr.friends && q.pr.friends[me]) {
      if (online) this.system(q.id, '🟢 Your friend ' + p.name + ' is online.');
      this.sendFriends(q);
    }
  };
  Room.prototype.makeFriends = function (a, b) { // a, b: { gid, name, live (player) | tok (saved profile) }
    const link = (x, y) => {
      if (x.live) { const pr = x.live.pr; pr.friends = pr.friends || {}; pr.friends[y.gid] = { name: y.name }; x.live.dirty = true; this.sendFriends(x.live); }
      else if (x.tok) { const pr = fixProfile(this.store.load(x.tok)); pr.friends = pr.friends || {}; pr.friends[y.gid] = { name: y.name }; this.store.save(x.tok, pr); }
    };
    link(a, b); link(b, a);
    this.track && this.track({ t: this.now(), e: 'friend_accept', s: null, u: a.gid, with: b.gid });
  };
  Room.prototype.friendAdd = function (p, targetId) {
    const me = friendGid(p), t = this.now();
    if (!me) { this.system(p.id, 'This tab uses a temporary wallet, so it cannot keep friends.'); return; }
    const q = this.players.get(targetId), other = friendGid(q);
    if (!q || q.id === p.id) return;
    if (!other) { this.system(p.id, q.bot ? q.name + ' is a villager, not a player.' : q.name + ' is playing in a temporary tab and cannot be added.'); return; }
    if (t - (p.lastFriend || 0) < 1500) return; p.lastFriend = t;
    const mine = p.pr.friends || {};
    if (mine[other]) { this.system(p.id, 'You and ' + q.name + ' are already friends.'); return; }
    if (Object.keys(mine).length >= FRIEND_MAX) { this.system(p.id, 'Your friends list is full (' + FRIEND_MAX + ').'); return; }
    if (Object.keys(q.pr.friends || {}).length >= FRIEND_MAX) { this.system(p.id, q.name + '\'s friends list is full.'); return; }
    this.friendReqs = this.friendReqs.filter((r) => r.until > t && !(r.from === me && r.to === other));
    const back = this.friendReqs.find((r) => r.from === other && r.to === me);
    if (back) { // they had already asked you: that is a yes from both sides
      this.friendReqs = this.friendReqs.filter((r) => r !== back);
      this.makeFriends({ gid: me, name: p.name, live: p }, { gid: other, name: q.name, live: q });
      for (const x of [p, q]) this.system(x.id, '🤝 ' + (x === p ? q.name : p.name) + ' and you are now friends. Visit their garden from the Friends list.');
      return;
    }
    this.friendReqs.push({ from: me, fromId: p.id, fromTok: p.token, name: p.name, to: other, until: t + FRIEND_REQ_MS });
    this.ev(p, 'friend_request');
    this.send(q.id, { type: 'friendRequest', gid: me, name: p.name });
    this.sendFriends(q);
    this.system(p.id, 'Friend request sent to ' + q.name + '.');
  };
  Room.prototype.friendAnswer = function (p, gid, ok) {
    const me = friendGid(p), t = this.now(); if (!me) return;
    const r = this.friendReqs.find((x) => x.from === gid && x.to === me && x.until > t);
    this.friendReqs = this.friendReqs.filter((x) => x !== r && x.until > t);
    if (!r) { this.sendFriends(p); return; }
    const q = this.playerByGid(gid);
    if (!ok) { this.sendFriends(p); if (q) this.system(q.id, p.name + ' did not accept the friend request.'); return; }
    if (Object.keys(p.pr.friends || {}).length >= FRIEND_MAX) { this.system(p.id, 'Your friends list is full (' + FRIEND_MAX + ').'); this.sendFriends(p); return; }
    this.makeFriends({ gid: me, name: p.name, live: p }, q ? { gid, name: q.name, live: q } : { gid, name: r.name, tok: r.fromTok });
    this.system(p.id, '🤝 ' + r.name + ' and you are now friends. Visit their garden from the Friends list.');
    if (q) this.system(q.id, '🤝 ' + p.name + ' accepted: you are now friends. Visit their garden from the Friends list.');
  };
  Room.prototype.friendRemove = function (p, gid) {
    const me = friendGid(p); if (!me || !p.pr.friends || !p.pr.friends[gid]) return;
    delete p.pr.friends[gid]; p.dirty = true; this.sendFriends(p); this.ev(p, 'friend_remove');
    const q = this.playerByGid(gid); // friendship is mutual: it ends on both sides
    if (q) { if (q.pr.friends) delete q.pr.friends[me]; q.dirty = true; this.sendFriends(q); }
    else { const tok = this.tokenOf(gid); const raw = tok && this.store.load(tok); if (raw) { const pr = fixProfile(raw); if (pr.friends) delete pr.friends[me]; this.store.save(tok, pr); } }
  };

  Room.prototype.likedToday = function (p, gid) { const d = dayKey(this.now()); return !!(p.pr && p.pr.likesGiven && p.pr.likesGiven.day === d && p.pr.likesGiven.list.includes(gid)); };
  Room.prototype.like = function (p) {
    if (!p.pr || p.guest || !p.visiting) return;
    const gid = p.visiting, d = dayKey(this.now()), wk = Catalog.weekKey(this.now());
    if (!p.pr.likesGiven || p.pr.likesGiven.day !== d) p.pr.likesGiven = { day: d, list: [] };
    if (p.pr.likesGiven.list.includes(gid)) return;
    if (p.pr.likesGiven.list.length >= Catalog.SOCIAL.maxLikesPerDay) { this.system(p.id, 'You have used all ' + Catalog.SOCIAL.maxLikesPerDay + ' likes for today.'); return; }
    p.pr.likesGiven.list.push(gid); this.sendProfile(p);
    const target = this.findGarden(gid); if (!target) return;
    const bump = (pr) => { if (!pr.likes || pr.likes.week !== wk) pr.likes = { week: wk, n: 0 }; pr.likes.n++; pr.xu += Catalog.SOCIAL.likeXu; pr.log.push({ t: this.now(), r: 'like', a: Catalog.SOCIAL.likeXu, n: p.name }); };
    if (target.npc) this.npcLikes[gid] = (this.npcLikes[gid] || 0) + 1;
    else if (target.live) { bump(target.live.pr); this.sendProfile(target.live); this.send(target.live.id, { type: 'sold', text: '❤️ ' + p.name + ' liked your garden', amount: Catalog.SOCIAL.likeXu }); }
    else { const pr = fixProfile(this.store.load(target.token)); bump(pr); this.store.save(target.token, pr); }
    this.boardCache = null; this.ev(p, 'garden_like');
    this.send(p.id, { type: 'liked', gid, likes: target.likes + 1 });
  };
  Room.prototype.sendBoard = function (p) {
    const now = this.now(), wk = Catalog.weekKey(now);
    if (!this.boardCache || now - this.boardCache.t > 20000) {
      const rows = new Map();
      const add = (gid, name, pr) => { if (rows.has(gid)) return; const likes = pr.likes && pr.likes.week === wk ? pr.likes.n : 0; rows.set(gid, { gid, name, likes, garden: Catalog.gardenBeauty(pr.garden) + likes * 5, tank: Catalog.tankBeauty(pr.garden, now) }); };
      for (const q of this.players.values()) if (q.token && !q.guest && q.pr) { this.gidIndex[gidOf(q.token)] = q.token; add(gidOf(q.token), q.name, q.pr); }
      if (this.store.all) for (const [tok, raw] of this.store.all()) { if (tok.startsWith('__')) continue; const g = gidOf(tok); this.gidIndex[g] = tok; const pr = fixProfile(raw); add(g, pr.name || 'Classmate', pr); }
      for (const n of NPC_GARDENS) { const g = npcGarden(n.seed, now); const likes = this.npcLikes[n.gid] || 0; rows.set(n.gid, { gid: n.gid, name: n.name, likes, npc: true, garden: Catalog.gardenBeauty(g) + likes * 5, tank: Catalog.tankBeauty(g, now) }); }
      const all = [...rows.values()];
      this.boardCache = { t: now, gardens: all.slice().sort((a, b) => b.garden - a.garden).slice(0, 10), tanks: all.slice().sort((a, b) => b.tank - a.tank).slice(0, 10) };
    }
    const me = p.token ? gidOf(p.token) : null;
    this.send(p.id, { type: 'board', gardens: this.boardCache.gardens, tanks: this.boardCache.tanks, me, week: wk });
  };

  // ---- Pomodoro quiz (GDD §3): 25 focused minutes -> answer one question from the wiki to get the bonus ----
  Room.prototype.askQuiz = function (p, triesLeft) {
    const bank = Quiz.bank.length ? Quiz.bank : Quiz.SAMPLE;
    const i = Math.floor(Math.random() * bank.length), q = bank[i];
    if (!p.quiz) this.ev(p, 'pomodoro_done'); // 25 focused minutes reached: the first question of this round
    p.quiz = { i, a: q.a, left: triesLeft, until: this.now() + ECON.quizTimeoutMin * 60000 };
    this.send(p.id, { type: 'quiz', q: q.q, o: q.o, src: q.src, left: triesLeft, bonus: ECON.pomodoroBonus });
  };
  Room.prototype.quizAnswer = function (p, msg) {
    const qz = p.quiz; if (!qz || !p.pr) return;
    if (this.now() > qz.until) { p.quiz = null; this.send(p.id, { type: 'quizResult', ok: false, text: 'Time is up.' }); return; }
    if (Number(msg.choice) === qz.a) {
      p.quiz = null;
      this.send(p.id, { type: 'quizResult', ok: true, text: 'Correct! 🎉' }); this.ev(p, 'quiz_answer', { ok: true });
      this.award(p, ECON.pomodoroBonus, 'pomodoro');
    } else if (qz.left > 1) {
      this.ev(p, 'quiz_answer', { ok: false });
      this.send(p.id, { type: 'quizResult', ok: false, retry: true, text: 'Not quite — try another question.' });
      this.askQuiz(p, qz.left - 1);
    } else { p.quiz = null; this.ev(p, 'quiz_answer', { ok: false }); this.send(p.id, { type: 'quizResult', ok: false, text: 'All ' + ECON.quizTries + ' answers wrong — better luck next time!' }); }
  };

  // ---- daily garden upkeep (GDD §1): charged once per day you play, grows with your upgrades ----
  Room.prototype.dailyUpkeep = function (p) {
    if (!p.pr || p.guest) return;
    const d = dayKey(this.now());
    if (p.pr.upkeepDay === d) return;
    p.pr.upkeepDay = d;
    const fee = Math.min(p.pr.xu, Catalog.upkeepOf(p.pr.garden));
    if (fee <= 0) return;
    p.pr.xu -= fee; this.logLine(p, 'upkeep', -fee, 'Garden upkeep today');
    this.send(p.id, { type: 'shopMsg', ok: true, text: '🧾 Garden upkeep today: −' + fee + ' Xu' });
    this.sendProfile(p);
  };

  // ---- Game Room: the tables are run by its room plug-in (shared/games.js), which is the referee and pays the wins ----

  // ---- trash ----
  Room.prototype.trashList = function () { return [...this.trash.values()]; };
  Room.prototype.spawnTrash = function (silent) {
    const kinds = ['can', 'paper', 'bottle', 'bag'];
    for (let tries = 0; tries < 30; tries++) {
      const x = -16.4 + Math.random() * 32.8, z = -16.4 + Math.random() * 32.8; // anywhere on the plaza...
      if (Math.hypot(x, z) < 4.6 || !WORLD.isFree(x, z)) continue;                  // ...that is not the campfire ring, furniture or a prop
      if ([...this.trash.values()].some((q) => Math.hypot(q.x - x, q.z - z) < 3)) continue;
      const tr = { id: this.nextTrash++, x: Math.round(x * 100) / 100, z: Math.round(z * 100) / 100, kind: kinds[Math.floor(Math.random() * kinds.length)], ry: Math.random() * 6.28 };
      this.trash.set(tr.id, tr);
      this.lastTrashSpawn = this.now();
      if (!silent) this.send(null, { type: 'trash', list: this.trashList() });
      return;
    }
  };
  Room.prototype.pickTrash = function (p, tid) {
    const tr = this.trash.get(tid);
    if (!tr || p.area !== 'campus' || p.room || !p.pr || Math.hypot(p.x - tr.x, p.z - tr.z) > 2.8) return;
    if (p.carry >= ECON.carryMax) { this.system(p.id, 'Your trash bag is full — drop it in the nearest green bin.'); return; }
    this.trash.delete(tid);
    p.carry++;
    p.pr.stats.trash = (p.pr.stats.trash || 0) + 1;
    this.send(null, { type: 'trash', list: this.trashList() });
    this.send(p.id, { type: 'carry', n: p.carry });
    this.award(p, ECON.trashPick, 'trash');
  };
  Room.prototype.dropTrash = function (p, bi) {
    const bin = WORLD.bins[bi];
    if (!bin || !p.carry || p.area !== 'campus' || Math.hypot(p.x - bin.x, p.z - bin.z) > 3.4) return;
    const n = p.carry; p.carry = 0;
    this.send(p.id, { type: 'carry', n: 0 });
    this.award(p, n * ECON.trashDrop, 'recycle', n + ' items');
  };

  // ---- fishing (v5: from the fishing chairs around the forest lake / along the stream, the Garden Room dock is gone) ----
  function atFishSpot(p, i) {
    const s = WORLD.fishSpots[i | 0];
    return !!s && (s.area || 'forest') === p.area && (s.room || null) === (p.room || null) && Math.hypot(p.x - s.x, p.z - s.z) <= 2.8;
  }
  Room.atFishSpot = atFishSpot;
  Room.prototype.fishCast = function (p, spot) {
    if (!p.pr || p.fishing || !atFishSpot(p, spot)) return;
    if (p.pr.bag.length >= ECON.bagMax) { this.system(p.id, 'Fish bag is full (' + ECON.bagMax + ' fish). Sell at the shop or release them into your garden pond.'); return; }
    const list = Object.keys(Catalog.FISH);
    let total = 0; list.forEach((k) => { total += Catalog.FISH[k].w; });
    let r = Math.random() * total, sp = list[0];
    for (const k of list) { r -= Catalog.FISH[k].w; if (r <= 0) { sp = k; break; } }
    const f = Catalog.FISH[sp];
    const size = Math.round(f.size[0] + Math.random() * (f.size[1] - f.size[0]));
    const biteIn = 6000 + Math.floor(Math.random() * 6000); // includes the shadow swimming up to the float
    p.fishing = { sp, size, biteAt: this.now() + biteIn };
    // the client only learns how big the shadow is and how hard the fight will be — not the species
    this.send(p.id, { type: 'fishCast', biteIn, tier: f.tier, shadow: Math.min(1.6, 0.5 + size / 50) });
  };
  Room.prototype.fishReel = function (p, ok) {
    const f = p.fishing; if (!f) return;
    p.fishing = null;
    const t = this.now();
    if (!ok) { this.send(p.id, { type: 'fishResult', ok: false, why: 'escape' }); return; }
    if (t < f.biteAt - 300) { this.send(p.id, { type: 'fishResult', ok: false, why: 'early' }); return; }
    if (t > f.biteAt + 45000) { this.send(p.id, { type: 'fishResult', ok: false, why: 'late' }); return; }
    const fish = { uid: p.pr.nextUid++, sp: f.sp, size: f.size };
    p.pr.bag.push(fish);
    p.pr.stats.fishCaught = (p.pr.stats.fishCaught || 0) + 1;
    this.ev(p, 'fish_caught', { tier: (Catalog.FISH[f.sp] || {}).tier || 0 });
    this.send(p.id, { type: 'fishResult', ok: true, fish });
    this.sendProfile(p);
    const info = Catalog.FISH[f.sp];
    if (info.tier >= 3) this.send(null, { type: 'chat', system: true, text: '🎣 ' + p.name + ' just caught a ' + info.name + ' (' + f.size + ' cm)!' });
  };

  // ---- shop (lobby kiosk) / garden stall ----
  function nearShop(p) { return p.area === 'campus' && WORLD.shops.some((s) => (s.room || null) === (p.room || null) && Math.hypot(p.x - s.x, p.z - s.z) <= 5); }
  Room.nearShop = nearShop;
  function nearStall(p) { const s = WORLD.garden.stall.front, b = WORLD.garden.board.front; return p.area === 'garden' && (Math.hypot(p.x - s.x, p.z - s.z) <= 4 || Math.hypot(p.x - b.x, p.z - b.z) <= 4); }
  // ---- v5 food & drink stands: pay Xu, get a study buff (x mult for N minutes) ----
  Room.prototype.buyFood = function (p, item, standId) {
    const F = Catalog.FOODS[item], st = WORLD.foodStands.find((s) => s.id === standId);
    if (!p.pr || !F || !st || (st.area || 'campus') !== p.area || p.room || Math.hypot(p.x - st.front.x, p.z - st.front.z) > 4) return;
    if (p.pr.xu < F.price) { this.send(p.id, { type: 'shopMsg', ok: false, text: 'Not enough Xu (need ' + F.price + ').' }); return; }
    const t = this.now(), cur = p.pr.buff && p.pr.buff.until > t ? p.pr.buff : null;
    p.pr.xu -= F.price;
    // a stronger buff replaces the current one; the same or a weaker one extends the time
    p.pr.buff = !cur || F.mult > cur.mult ? { mult: F.mult, until: t + F.min * 60000, icon: F.icon } : { mult: cur.mult, until: cur.until + F.min * 60000, icon: cur.icon };
    this.logLine(p, 'buy', -F.price, F.name); this.ev(p, 'food_buy', { item });
    this.send(p.id, { type: 'shopMsg', ok: true, text: F.icon + ' Delicious! Studying pays x' + p.pr.buff.mult + ' Xu for ' + Math.round((p.pr.buff.until - t) / 60000) + ' minutes' });
    this.send(p.id, { type: 'ate', item });
    this.sendProfile(p);
  };
  function nearMarket(p) { const m = WORLD.market.front; return (p.area === 'campus' && !p.room && Math.hypot(p.x - m.x, p.z - m.z) <= 4.5) || nearStall(p) || nearShop(p); }
  Room.nearStall = nearStall; Room.nearMarket = nearMarket;
  function addInv(pr, key, n) { pr.inv[key] = (pr.inv[key] || 0) + n; if (pr.inv[key] <= 0) delete pr.inv[key]; }
  Room.prototype.buy = function (p, item, qty) {
    if (!p.pr || !nearShop(p)) return;
    qty = clamp(qty || 1, 1, 20);
    const pr = p.pr, C = Catalog;
    let price = 0, apply = null, label = '';
    const [kind, key] = item.split(':');
    const simple = (cost, name, invKey, n) => { price = cost * qty; label = name + ' x' + (n * qty); apply = () => addInv(pr, invKey, n * qty); };
    if (kind === 'seed' && (C.CROPS[key] || C.FLOWERS[key])) { const s = C.CROPS[key] || C.FLOWERS[key]; simple(s.price, s.name + ' seeds', item, 1); }
    else if (kind === 'sapling' && C.FRUITS[key]) simple(C.FRUITS[key].price, C.FRUITS[key].name + ' sapling', item, 1);
    else if (kind === 'decor' && C.DECOR[key]) {
      if (C.DECOR[key].rare && !C.rareOfWeek(this.now()).includes(key)) { this.system(p.id, 'This rare item is not on sale this week.'); return; }
      simple(C.DECOR[key].price, C.DECOR[key].name, item, 1);
    }
    else if (item === 'boost') simple(C.BOOST.price, C.BOOST.name, 'boost', 1);
    else if (kind === 'tank' && C.TANK_DECOR[key]) simple(C.TANK_DECOR[key].price, C.TANK_DECOR[key].name, item, 1);
    else if (item === 'food') simple(C.FOOD.price, C.FOOD.name, 'food', C.FOOD.qty);
    else if (item === 'fert') simple(C.FERT.price, C.FERT.name, 'fert', C.FERT.qty);
    else if (kind === 'feed' && C.FEEDS[key]) simple(C.FEEDS[key].price, C.FEEDS[key].name, item, C.FEEDS[key].qty);
    else if (kind === 'pot' && C.POTS[key] && key !== 'clay') simple(C.POTS[key].price, C.POTS[key].name, item, 1);
    else if (kind === 'furn' && C.FURNITURE[key]) simple(C.FURNITURE[key].price, C.FURNITURE[key].name, item, 1);
    else if (kind === 'animal' && C.ANIMALS[key]) {
      qty = 1;
      const A = C.ANIMALS[key], cap = C.UPGRADES[A.pen][pr.garden[A.pen] | 0].cap;
      if (pr.garden.animals.filter((a) => a.kind === key).length >= cap) { this.system(p.id, 'That pen is full (' + cap + ' animals). Upgrade it in the Upgrades tab.'); return; }
      price = A.price; label = A.name;
      apply = () => { pr.garden.animals.push({ uid: pr.nextUid++, kind: key, fedAt: 0 }); };
    }
    else if (kind === 'fish' && C.FISH[key] && C.FISH[key].shop) {
      qty = 1;
      if (pr.bag.length >= ECON.bagMax) { this.system(p.id, 'Fish bag is full.'); return; }
      price = C.FISH[key].shop; label = C.FISH[key].name;
      apply = () => { pr.bag.push({ uid: pr.nextUid++, sp: key, size: C.FISH[key].size[0] }); };
    } else if (kind === 'up' && C.UPGRADES[key]) {
      qty = 1;
      const lvl = pr.garden[key] | 0, next = C.UPGRADES[key][lvl + 1];
      if (!next) { this.system(p.id, 'Already at max level.'); return; }
      price = next.price;
      label = { land: 'Expand land ' + next.size + 'x' + next.size, pots: 'Upgrade to ' + next.name, orchard: 'Expand orchard (' + next.cap + ' trees)', pond: 'Upgrade fish tank (' + next.cap + ' fish)',
        coop: 'Chicken coop for ' + next.cap, sty: 'Pig sty for ' + next.cap, barn: 'Cow barn for ' + next.cap, house: 'House upgrade: ' + next.name }[key];
      apply = () => { pr.garden[key] = lvl + 1; };
    } else return;
    if (pr.xu < price) { this.send(p.id, { type: 'shopMsg', ok: false, text: 'Not enough Xu (need ' + price + ').' }); return; }
    pr.xu -= price; apply();
    this.logLine(p, 'buy', -price, label); this.ev(p, 'shop_buy', { kind, cost: price });
    this.send(p.id, { type: 'shopMsg', ok: true, text: 'Bought ' + label + ' (−' + price + ' Xu)' });
    this.sendProfile(p);
  };
  // Instant sell to the shop / garden stall at the base price
  Room.prototype.sell = function (p, msg) {
    if (!p.pr || !(nearShop(p) || nearStall(p))) return;
    const pr = p.pr, C = Catalog;
    let gain = 0, label = '';
    if (msg.kind === 'crop' || msg.kind === 'prod') { // crops, and (combined game) animal products
      const inv = msg.kind + ':' + String(msg.id || ''), info = C.itemInfo(inv), have = pr.inv[inv] | 0;
      if (!info || !info.produce || !have) return;
      const n = msg.all ? have : 1;
      addInv(pr, inv, -n);
      gain = info.base * n; label = info.name + ' x' + n;
    } else if (msg.kind === 'fish') {
      const i = pr.bag.findIndex((f) => f.uid === Number(msg.uid));
      if (i < 0) return;
      const f = pr.bag.splice(i, 1)[0];
      gain = C.fishPrice(f.sp, f.size); label = C.FISH[f.sp].name + ' ' + f.size + 'cm';
    } else return;
    pr.xu += gain;
    this.logLine(p, 'sell', gain, label);
    this.send(p.id, { type: 'shopMsg', ok: true, text: 'Sold ' + label + ' (+' + gain + ' Xu)', coin: gain });
    this.sendProfile(p);
  };

  // ---- player market (lobby board + garden stall), passing customers, travelling merchant ----
  const NPC_NAMES = ['Bác Ba', 'Cô Tư', 'Chú Năm', 'Chị Hai', 'Anh Bảy', 'A passer-by'];
  Room.prototype.marketFor = function (p) {
    return this.market.map((l) => ({ id: l.id, byName: l.byName, item: l.item, qty: l.qty, price: l.price, at: l.at, npc: l.by === 'npc', mine: !!(p.token && l.by === p.token) }));
  };
  Room.prototype.broadcastMarket = function () {
    for (const q of this.players.values()) if (q.pr) this.send(q.id, { type: 'market', list: this.marketFor(q) });
    if (this.store.saveMeta) this.store.saveMeta('market', this.market);
  };
  Room.prototype.payOffline = function (token, amount, label) {
    for (const q of this.players.values()) if (q.token === token && q.pr && !q.guest) {
      q.pr.xu += amount; this.logLine(q, 'market', amount, label); this.sendProfile(q);
      this.send(q.id, { type: 'sold', text: label, amount });
      return;
    }
    const pr = this.store.load(token); if (!pr) return;
    const fixed = fixProfile(pr); fixed.xu += amount;
    fixed.log.push({ t: this.now(), r: 'market', a: amount, n: label + ' (while you were away)' });
    this.store.save(token, fixed);
  };
  Room.prototype.marketAction = function (p, msg) {
    if (!p.pr || p.guest) return;
    const pr = p.pr, C = Catalog, t = this.now();
    if (msg.type === 'marketList') {
      if (!nearMarket(p)) return;
      const item = String(msg.item || ''), info = C.itemInfo(item), qty = Math.floor(num(msg.qty, 0)), price = Math.floor(num(msg.price, 0));
      if (!info || qty < 1 || qty > 99 || price < 1 || price > 99999) return;
      if ((pr.inv[item] | 0) < qty) { this.system(p.id, 'You do not have enough of this item.'); return; }
      if (this.market.filter((l) => l.by === p.token).length >= ECON.maxListings) { this.system(p.id, 'You can only list up to ' + ECON.maxListings + ' items at once.'); return; }
      addInv(pr, item, -qty);
      const l = { id: this.nextListing++, by: p.token, byName: p.name, item, qty, price, at: t };
      this.market.push(l);
      if (this.market.length > 200) this.market.shift();
      this.send(p.id, { type: 'shopMsg', ok: true, text: 'Listed ' + info.name + ' x' + qty + ' for ' + price + ' Xu on the market.' });
      if (msg.shout && t - (p.lastShout || 0) > 30000) {
        p.lastShout = t;
        this.send(null, { type: 'chat', system: true, text: '📢 ' + p.name + ' is selling ' + info.icon + ' ' + info.name + ' x' + qty + ' for ' + price + ' Xu at the Market!' });
      }
      this.sendProfile(p); this.broadcastMarket();
    } else if (msg.type === 'marketCancel') {
      const i = this.market.findIndex((l) => l.id === Number(msg.id) && l.by === p.token);
      if (i < 0) return;
      const l = this.market.splice(i, 1)[0];
      addInv(pr, l.item, l.qty);
      this.sendProfile(p); this.broadcastMarket();
    } else if (msg.type === 'marketBuy') {
      if (!nearMarket(p)) return;
      const i = this.market.findIndex((l) => l.id === Number(msg.id));
      if (i < 0) { this.system(p.id, 'Someone else just bought this item.'); return; }
      const l = this.market[i];
      if (l.by === p.token) return;
      if (pr.xu < l.price) { this.send(p.id, { type: 'shopMsg', ok: false, text: 'Not enough Xu (need ' + l.price + ').' }); return; }
      this.market.splice(i, 1);
      pr.xu -= l.price; addInv(pr, l.item, l.qty);
      const info = C.itemInfo(l.item);
      this.logLine(p, 'buy', -l.price, info.name + ' x' + l.qty + ' (market)');
      this.send(p.id, { type: 'shopMsg', ok: true, text: 'Bought ' + info.name + ' x' + l.qty + ' from ' + l.byName });
      if (l.by !== 'npc') this.payOffline(l.by, l.price, info.name + ' x' + l.qty + ' → ' + p.name);
      this.sendProfile(p); this.broadcastMarket();
    }
  };
  Room.prototype.marketTick = function (t) {
    const C = Catalog;
    // a passing customer buys a fairly priced player listing now and then
    if (t - this.lastNpcBuy > ECON.npcBuyEverySec * 1000) {
      this.lastNpcBuy = t;
      const fair = this.market.filter((l) => l.by !== 'npc' && C.itemInfo(l.item) && l.price / l.qty <= C.itemInfo(l.item).base * ECON.npcBuyMaxMult);
      if (fair.length && Math.random() < 0.45) {
        const l = fair[Math.floor(Math.random() * fair.length)];
        this.market = this.market.filter((x) => x !== l);
        const info = C.itemInfo(l.item), buyer = NPC_NAMES[Math.floor(Math.random() * NPC_NAMES.length)];
        this.payOffline(l.by, l.price, info.name + ' x' + l.qty + ' → ' + buyer);
        this.broadcastMarket();
      }
    }
    // villagers put cheap seeds / saplings / fertiliser on the market
    if (t - this.lastNpcList > 90000) {
      this.lastNpcList = t;
      if (this.market.filter((l) => l.by === 'npc').length < 4) {
        const pool = [].concat(Object.keys(C.CROPS).map((k) => 'seed:' + k), Object.keys(C.FLOWERS).map((k) => 'seed:' + k), Object.keys(C.FRUITS).map((k) => 'sapling:' + k), ['fert', 'food'], Object.keys(C.TANK_DECOR).map((k) => 'tank:' + k));
        const item = pool[Math.floor(Math.random() * pool.length)], info = C.itemInfo(item);
        const qty = item.startsWith('sapling') || item.startsWith('tank') ? 1 : 3 + Math.floor(Math.random() * 4);
        const price = Math.max(1, Math.round(info.base * qty * (0.75 + Math.random() * 0.15)));
        this.market.push({ id: this.nextListing++, by: 'npc', byName: NPC_NAMES[Math.floor(Math.random() * 5)], item, qty, price, at: t });
        this.broadcastMarket();
      }
    }
    // travelling merchant on the lobby
    const m = this.merchant;
    if (m && t > m.until) { this.merchant = null; this.nextMerchant = t + this.merchantGap(); this.send(null, { type: 'merchant', m: null }); }
    else if (!m && t > this.nextMerchant) {
      const spots = WORLD.merchantSpots;
      const [x, z] = spots[Math.floor(Math.random() * spots.length)];
      const pool = [].concat(Object.keys(C.CROPS), Object.keys(C.FLOWERS), Object.keys(C.FRUITS));
      const id = pool[Math.floor(Math.random() * pool.length)];
      const mult = Math.round((ECON.merchantMult[0] + Math.random() * (ECON.merchantMult[1] - ECON.merchantMult[0])) * 10) / 10;
      this.merchant = { x, z, item: 'crop:' + id, mult, left: ECON.merchantWants, until: t + ECON.merchantStaySec * 1000 };
      const info = C.itemInfo('crop:' + id);
      this.send(null, { type: 'merchant', m: this.merchant });
      this.send(null, { type: 'chat', system: true, text: '🧳 The Travelling Merchant has arrived at the Plaza! Buying ' + info.icon + ' ' + info.name + ' at x' + mult + ' (' + Math.round(info.base * mult) + ' Xu each).' });
    }
  };
  Room.prototype.merchantGap = function () { const [a, b] = ECON.merchantEveryMin; return (a + Math.random() * (b - a)) * 60000; };
  Room.prototype.merchantSell = function (p, qty) {
    const m = this.merchant, pr = p.pr;
    if (!m || !pr || p.area !== 'campus' || Math.hypot(p.x - m.x, p.z - m.z) > 4) return;
    const have = pr.inv[m.item] | 0;
    const n = Math.min(Math.max(1, qty | 0), have, m.left);
    if (n <= 0) { this.system(p.id, 'You have nothing the merchant wants.'); return; }
    const info = Catalog.itemInfo(m.item), each = Math.round(info.base * m.mult), gain = each * n;
    addInv(pr, m.item, -n); m.left -= n; pr.xu += gain;
    this.logLine(p, 'merchant', gain, info.name + ' x' + n);
    this.send(p.id, { type: 'shopMsg', ok: true, text: '🧳 Travelling Merchant bought ' + info.name + ' x' + n + ' (+' + gain + ' Xu)', coin: gain });
    this.sendProfile(p);
    if (m.left <= 0) { this.merchant = null; this.nextMerchant = this.now() + this.merchantGap(); this.send(null, { type: 'chat', system: true, text: '🧳 The Travelling Merchant has bought enough and left.' }); }
    this.send(null, { type: 'merchant', m: this.merchant });
  };

  // ---- private farm island (v5): crop fields, cloud-garden flower pots, fruit trees, round fish tank, animal pens, house ----
  Room.plantProgress = function (pl, now, where, potLvl) { return Catalog.progress(pl, where || 'plot', potLvl || 0, now); };
  Room.prototype.gardenAction = function (p, msg) {
    if (!p.pr || p.area !== 'garden') return;
    if (p.visiting) { this.system(p.id, 'You are visiting another garden — you can only look around and like it.'); return; }
    const pr = p.pr, g = pr.garden, C = Catalog, t = this.now();
    const where = msg.where === 'bed' ? 'bed' : msg.where === 'pot' ? 'pot' : msg.where === 'tree' ? 'tree' : 'plot';
    if (where === 'bed') return; // garden beds existed only in the Garden Room (removed)
    const coll = where === 'bed' ? g.beds : where === 'pot' ? g.flowerPots : where === 'tree' ? g.trees : g.plots;
    const keyOk = () => {
      const k = String(msg.id == null ? msg.plot : msg.id);
      if (where === 'bed') { const b = /^\d$/.test(k) ? WORLD.beds[+k] : null; return b && Math.hypot(p.x - b.x, p.z - b.z) <= 4.5 ? k : null; }
      if (where === 'plot') { const m = /^(\d+),(\d+)$/.exec(k); const size = C.UPGRADES.land[g.land].size; return m && +m[1] < size && +m[2] < size ? k : null; }
      const cap = where === 'pot' ? C.UPGRADES.pots[g.pots].cap : C.UPGRADES.orchard[g.orchard].cap;
      return /^\d+$/.test(k) && +k < cap ? k : null;
    };
    const prog = (rec) => C.progress(rec, where, g.pots, t, g.boosts);
    switch (msg.type) {
      case 'plant': {
        const k = keyOk(); const seed = String(msg.seed || '');
        if (!k || coll[k]) return;
        const okKind = where === 'plot' || where === 'bed' ? C.CROPS[seed] : where === 'pot' ? C.FLOWERS[seed] : C.FRUITS[seed];
        const invKey = (where === 'tree' ? 'sapling:' : 'seed:') + seed;
        if (!okKind || !(pr.inv[invKey] > 0)) return;
        addInv(pr, invKey, -1);
        coll[k] = { s: seed, at: t, bonus: 0, w: false, f: false };
        if (where === 'pot') coll[k].pt = g.potTypes[k] || 'clay'; // the pot it grows in (speed / extra-flower bonus)
        this.ev(p, 'garden_plant', { where });
        break;
      }
      // ---- v5 farm animals: feed every hungry animal of a kind, collect a ready product ----
      case 'feedAnimals': {
        const A = C.ANIMALS[msg.kind]; if (!A) return;
        let fed = 0; const used = {};
        for (const a of g.animals) {
          if (a.kind !== msg.kind || a.fedAt) continue;
          const food = A.foods.find((f) => pr.inv[f] > 0); if (!food) break;
          addInv(pr, food, -1); used[food] = (used[food] || 0) + 1; a.fedAt = t; fed++;
        }
        this.send(p.id, { type: 'animalsFed', kind: msg.kind, n: fed, used });
        if (!fed) this.system(p.id, 'No hungry animals, or you are out of food (' + A.foods.map((f) => C.itemInfo(f).name).join(' / ') + ').');
        break;
      }
      case 'collectAnimal': {
        const a = g.animals.find((x) => x.uid === Number(msg.uid)); if (!a || !a.fedAt) return;
        const A = C.ANIMALS[a.kind];
        if (t - a.fedAt < A.produceMin * 60000) return;
        const pen = WORLD.garden.pens[A.pen];
        if (!(p.x >= pen.minX - 1.5 && p.x <= pen.maxX + 1.5 && p.z >= pen.minZ - 1.5 && p.z <= pen.maxZ + 1.5)) return; // must walk into the pen
        addInv(pr, 'prod:' + A.product, 1); a.fedAt = 0; // hungry again
        this.send(p.id, { type: 'collected', product: A.product, uid: a.uid });
        break;
      }
      // ---- v5 replaceable flower pots ----
      case 'setPot': {
        const i = String(msg.i), cap = C.UPGRADES.pots[g.pots].cap, type = String(msg.pot || '');
        if (!/^\d+$/.test(i) || +i >= cap || !C.POTS[type]) return;
        if (type !== 'clay' && !(pr.inv['pot:' + type] > 0)) return;
        const old = g.potTypes[i] || 'clay'; if (old === type) return;
        if (type !== 'clay') addInv(pr, 'pot:' + type, -1);
        if (old !== 'clay') addInv(pr, 'pot:' + old, 1); // the old pot goes back to the bag
        if (type === 'clay') delete g.potTypes[i]; else g.potTypes[i] = type;
        break;
      }
      // ---- v5 house furniture on fixed slots ----
      case 'furnPlace': case 'furnRemove': {
        const slot = String(msg.slot), cap = C.UPGRADES.house[g.house].cap;
        if (!/^\d+$/.test(slot) || +slot >= cap) return;
        if (msg.type === 'furnRemove') { const it = g.furniture[slot]; if (!it) return; addInv(pr, 'furn:' + it, 1); delete g.furniture[slot]; break; }
        const item = String(msg.item || ''); if (!C.FURNITURE[item] || !(pr.inv['furn:' + item] > 0)) return;
        if (g.furniture[slot]) addInv(pr, 'furn:' + g.furniture[slot], 1);
        addInv(pr, 'furn:' + item, -1); g.furniture[slot] = item;
        break;
      }
      case 'useBoost': { // whole garden grows faster for a while (timestamp window, no server ticking)
        if (!(pr.inv.boost > 0)) { this.system(p.id, 'You have no Super Fertiliser — buy it at the Shop.'); return; }
        const last = g.boosts[g.boosts.length - 1];
        const start = last && last.e > t ? last.e : t; // stacking extends the window
        addInv(pr, 'boost', -1);
        g.boosts.push({ s: start, e: start + C.BOOST.minutes * 60000 });
        g.boosts = g.boosts.filter((b) => b.e > t - 3 * 86400000).slice(-8);
        this.send(p.id, { type: 'shopMsg', ok: true, text: '⚡ The whole garden grows ' + Math.round(C.BOOST.speed * 100) + '% faster until ' + new Date(start + C.BOOST.minutes * 60000).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) });
        break;
      }
      case 'care': {
        const k = keyOk(); const rec = k && coll[k]; if (!rec || prog(rec) >= 1) return;
        const ms = C.cycleMs(rec, where, g.pots);
        if (msg.what === 'water') {
          if (rec.w) { this.system(p.id, 'This plant has already been watered this cycle.'); return; }
          rec.w = true; rec.bonus += ms * C.CARE.waterCut;
        } else if (msg.what === 'fert') {
          if (rec.f) { this.system(p.id, 'This plant has already been fertilised this cycle.'); return; }
          if (!(pr.inv.fert > 0)) { this.system(p.id, 'You are out of fertiliser — buy it at the Shop (Seeds tab).'); return; }
          addInv(pr, 'fert', -1); rec.f = true; rec.bonus += ms * C.CARE.fertCut;
        } else return;
        this.send(p.id, { type: 'cared', what: msg.what });
        break;
      }
      case 'harvest': {
        const k = keyOk(); const rec = k && coll[k]; if (!rec || prog(rec) < 1) return;
        const info = C.plantInfo(rec.s);
        let n = 1;
        if (where === 'plot') n = 1 + (Math.random() < 0.25 ? 1 : 0);
        else if (where === 'bed') n = 2 + (Math.random() < 0.25 ? 1 : 0); // a whole bed gives a little more than one plot
        else if (where === 'pot') n = (g.pots >= 2 ? C.CARE.cloudYield : 1) + (Math.random() < ((C.POTS[rec.pt] || {}).bonus || 0) ? 1 : 0);
        else n = info.yield[0] + Math.floor(Math.random() * (info.yield[1] - info.yield[0] + 1));
        addInv(pr, 'crop:' + rec.s, n);
        pr.stats.harvested = (pr.stats.harvested || 0) + n;
        if (where === 'tree') { rec.at = t; rec.bonus = 0; rec.w = false; rec.f = false; rec.m = true; } // bears fruit again
        else delete coll[k];
        this.send(p.id, { type: 'harvested', seed: rec.s, n, where, id: k }); this.ev(p, 'garden_harvest', { where });
        break;
      }
      case 'dig': { // remove a tree (no refund) to free the slot
        const k = keyOk(); if (!k || !coll[k] || where !== 'tree') return;
        delete coll[k];
        break;
      }
      case 'pondRelease': {
        const cap = C.UPGRADES.pond[g.pond].cap;
        const i = pr.bag.findIndex((f) => f.uid === Number(msg.uid));
        if (i < 0) return;
        if (g.fish.length >= cap) { this.system(p.id, 'Tank is full (' + cap + ' fish). Upgrade the tank at the shop.'); return; }
        const f = pr.bag.splice(i, 1)[0]; f.fedAt = 0; g.fish.push(f);
        break;
      }
      case 'pondTake': {
        const i = g.fish.findIndex((f) => f.uid === Number(msg.uid));
        if (i < 0) return;
        if (pr.bag.length >= ECON.bagMax) { this.system(p.id, 'Fish bag is full.'); return; }
        const f = g.fish.splice(i, 1)[0]; delete f.fedAt; pr.bag.push(f);
        break;
      }
      case 'pondFeed': {
        let fed = 0;
        for (const f of g.fish) {
          if (!(pr.inv.food > 0)) break;
          if (t - (f.fedAt || 0) < ECON.feedCooldownMin * 60000) continue;
          addInv(pr, 'food', -1); f.fedAt = t; fed++;
          f.size = Math.min(C.fishMaxSize(f.sp), Math.round(f.size + C.FISH[f.sp].size[1] * 0.08));
        }
        this.send(p.id, { type: 'fed', n: fed });
        break;
      }
      case 'tankDecor': {
        const item = String(msg.item || '');
        if (!C.TANK_DECOR[item] || !(pr.inv['tank:' + item] > 0)) return;
        if (g.tankDecor.length >= C.TANK_DECOR_MAX) { this.system(p.id, 'The tank already has ' + C.TANK_DECOR_MAX + ' decorations.'); return; }
        addInv(pr, 'tank:' + item, -1); g.tankDecor.push(item);
        break;
      }
      case 'tankDecorTake': {
        const i = Number(msg.i); if (!(i >= 0 && i < g.tankDecor.length)) return;
        addInv(pr, 'tank:' + g.tankDecor.splice(i, 1)[0], 1);
        break;
      }
      case 'decorPlace': case 'decorMove': {
        const x = num(msg.x, NaN), z = num(msg.z, NaN), r = num(msg.r, 0);
        const b = WORLD.areas.garden.bounds;
        if (!(x >= b.minX + 0.5 && x <= b.maxX - 0.5 && z >= b.minZ + 0.5 && z <= b.maxZ - 0.5)) return;
        if (msg.type === 'decorPlace') {
          const item = String(msg.item || '');
          if (!C.DECOR[item] || !(pr.inv['decor:' + item] > 0)) return;
          if (g.decor.length >= 60) { this.system(p.id, 'The garden already has too many decorations.'); return; }
          addInv(pr, 'decor:' + item, -1);
          g.decor.push({ uid: pr.nextUid++, item, x, z, r });
        } else {
          const d = g.decor.find((q) => q.uid === Number(msg.uid)); if (!d) return;
          d.x = x; d.z = z; d.r = r;
        }
        break;
      }
      case 'decorStore': {
        const i = g.decor.findIndex((q) => q.uid === Number(msg.uid)); if (i < 0) return;
        const d = g.decor.splice(i, 1)[0];
        addInv(pr, 'decor:' + d.item, 1);
        break;
      }
    }
    this.sendProfile(p);
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Room;
  else root.CampusRoom = Room;
})(typeof self !== 'undefined' ? self : this);
