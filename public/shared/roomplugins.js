/*
 * Room plug-ins, server half (ported from campus-export's Python: server/rooms/__init__.py, cinema.py,
 * template.py and server/media.py). Runs on the Node server and, in solo mode, inside the browser.
 *
 * A room plug-in is an object with the same id as a closed room of the map. The game calls its hooks and the
 * plug-in answers through `this.game`. Every message a room receives or sends starts with "<room id>."
 * (for example "xem-phim.add") so rooms never clash. Only players inside a room may use it, and only they
 * receive its messages. How to add a room: see README.md ("Adding a room").
 */
(function (root) {
  'use strict';

  const MAX_PER_PLAYER = 2;
  const VIDEO_ID = /^[\w-]{11}$/;

  // ---- a shared YouTube queue: at most 2 per player, each under `maxSeconds`, owners remove their own, admins anyone's ----
  function MediaQueue(maxSeconds, limitText, now) {
    this.maxSeconds = maxSeconds;
    this.limitText = limitText;
    this.now = now || (() => Date.now());
    this.waiting = [];
    this.current = null;
    this.startedAt = null;
    this.nextId = 1;
    this.errorReported = new Set();
  }
  MediaQueue.prototype.snapshot = function () {
    return { now: this.current, startedAt: this.startedAt, waiting: this.waiting, serverNow: this.now() };
  };
  MediaQueue.prototype.countFor = function (playerId) {
    return (this.current ? [this.current] : []).concat(this.waiting).filter((i) => i.owner === playerId).length;
  };
  /** Returns '' when added, otherwise the reason it was refused. */
  MediaQueue.prototype.add = function (video, player) {
    const vid = String((video && video.vid) || '');
    if (!VIDEO_ID.test(vid)) return "That doesn't look like a YouTube video.";
    const dur = Number(video.dur);
    if (!(dur > 0 && dur < this.maxSeconds)) return 'Videos must be under ' + this.limitText + '.';
    if (this.countFor(player.id) >= MAX_PER_PLAYER) return 'You already have ' + MAX_PER_PLAYER + ' in the queue.';
    const title = String(video.title || vid).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 100) || vid;
    this.waiting.push({ id: this.nextId++, vid, title, dur, owner: player.id, ownerName: player.name });
    if (!this.current) this.advance();
    return '';
  };
  MediaQueue.prototype.remove = function (itemId, player) {
    const item = this.current && this.current.id === itemId ? this.current : this.waiting.find((i) => i.id === itemId);
    if (!item) return 'That one is already gone.';
    if (item.owner !== player.id && !player.admin) return 'Only the owner or an admin can remove it.';
    if (item === this.current) this.advance(); else this.waiting = this.waiting.filter((i) => i !== item);
    return '';
  };
  MediaQueue.prototype.advance = function () {
    this.current = this.waiting.length ? this.waiting.shift() : null;
    this.startedAt = this.current ? this.now() + 1200 : null; // small lead so everyone starts together
  };
  /** Call regularly; true when the current item finished and the queue moved on. */
  MediaQueue.prototype.tick = function () {
    if (this.current && this.now() - this.startedAt > this.current.dur * 1000 + 1500) { this.advance(); return true; }
    return false;
  };
  /** A client could not play the current item (embedding blocked...): skip it once. */
  MediaQueue.prototype.reportError = function (itemId) {
    if (this.current && this.current.id === itemId && !this.errorReported.has(itemId)) { this.errorReported.add(itemId); this.advance(); return true; }
    return false;
  };
  MediaQueue.prototype.clear = function () { this.waiting = []; this.current = null; this.startedAt = null; };

  // ---- base class: hooks do nothing ----
  function RoomPlugin(game, id, name) {
    this.game = game;          // { send(toId, msg), now(), players (Map), system(toId, text), award(), loadMeta(key), saveMeta(key, value), … }
    this.id = id;
    this.name = name || id;
    this.members = new Set();  // ids of the players currently inside
  }
  RoomPlugin.prototype.onEnter = function (player) {};          // a player walked in: send them the room's current state
  RoomPlugin.prototype.onLeave = function (player) {};          // a player walked out or disconnected
  RoomPlugin.prototype.onMessage = function (player, msg) {};   // a message addressed to this room ("<id>.something")
  RoomPlugin.prototype.tick = function () {};                   // about twice a second
  RoomPlugin.prototype.reset = function () {};                  // the game emptied out: forget everything
  RoomPlugin.prototype.sendMembers = function (msg) { for (const id of this.members) this.game.send(id, msg); };
  RoomPlugin.prototype.toast = function (player, text, kind) { this.game.send(player.id, { type: 'toast', kind: kind || 'error', msg: text }); };

  // ---- cinema: one video queue shared by everyone inside (2 per player, each under 3 hours) ----
  function CinemaRoom(game, id, name) {
    RoomPlugin.call(this, game, id, name);
    this.queue = new MediaQueue(3 * 3600, '3 hours', game.now);
  }
  CinemaRoom.prototype = Object.create(RoomPlugin.prototype);
  CinemaRoom.prototype.stateMsg = function () { return Object.assign({ type: this.id + '.state' }, this.queue.snapshot()); };
  CinemaRoom.prototype.onEnter = function (player) { this.game.send(player.id, this.stateMsg()); };
  CinemaRoom.prototype.onMessage = function (player, msg) {
    if (!this.members.has(player.id)) return; // only people inside the room can use its queue
    const kind = msg.type.split('.')[1];
    if (kind === 'add') {
      const why = this.queue.add(msg, player);
      if (why) return this.toast(player, why);
      this.sendMembers(this.stateMsg());
    } else if (kind === 'remove') {
      const why = this.queue.remove(Number(msg.id), player);
      if (why) return this.toast(player, why);
      this.sendMembers(this.stateMsg());
    } else if (kind === 'error') {
      if (this.queue.reportError(Number(msg.id))) this.sendMembers(this.stateMsg());
    }
  };
  CinemaRoom.prototype.tick = function () { if (this.queue.tick()) this.sendMembers(this.stateMsg()); };
  CinemaRoom.prototype.reset = function () { this.queue.clear(); };

  // ---- template: the smallest working room. Copy it to start a new room (answers "<id>.ping" with "<id>.pong") ----
  function TemplateRoom(game, id, name) { RoomPlugin.call(this, game, id, name); }
  TemplateRoom.prototype = Object.create(RoomPlugin.prototype);
  TemplateRoom.prototype.onMessage = function (player, msg) {
    if (!this.members.has(player.id)) return; // only people inside may use the room
    if (msg.type === this.id + '.ping') {
      const text = String(msg.text || '').replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, 60);
      this.sendMembers({ type: this.id + '.pong', text, from: player.name, members: this.members.size });
    }
  };

  // ---- astrology (spec "Hồ sơ của tôi"): one birth profile per player NAME, so the same name on another computer
  //      opens the reading straight away. Readings are worked out in the browser; the room keeps the birth details,
  //      has the server add a line to its class file for every "See my chart", and gives a little Xu once a day.
  const BIRTH_DATE = /^(19\d\d|20\d\d|2100)-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
  const clean = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
  /** A stored birth record from whatever the browser sent, or null when it is not one. */
  function cleanBirth(b) {
    if (!b || typeof b !== 'object') return null;
    const name = clean(b.name, 60); if ([...name].filter((c) => /\p{L}/u.test(c)).length < 2) return null;
    if (!BIRTH_DATE.test(String(b.date))) return null;
    const unknownTime = !!b.unknownTime; const time = unknownTime ? '' : String(b.time || '');
    if (!unknownTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return null;
    if (b.gender !== 'M' && b.gender !== 'F') return null;
    if (!/^[a-z0-9-]{2,48}$/.test(String(b.place))) return null;
    let lunar = null;
    if (b.cal === 'lunar' && b.lunar && typeof b.lunar === 'object') {
      const d = Math.floor(Number(b.lunar.d)), m = Math.floor(Number(b.lunar.m)), y = Math.floor(Number(b.lunar.y));
      if (!(d >= 1 && d <= 30 && m >= 1 && m <= 12 && y >= 1899 && y <= 2100)) return null;
      lunar = { d, m, y, leap: !!b.lunar.leap };
    }
    return { name, date: String(b.date), style: b.style === 'US' ? 'US' : 'VN', cal: lunar ? 'lunar' : 'solar', lunar, time, unknownTime, gender: b.gender, place: String(b.place) };
  }
  const profileKey = (name) => 'astro:' + String(name || '').normalize('NFC').trim().toLowerCase().slice(0, 40);
  function AstrologyRoom(game, id, name) { RoomPlugin.call(this, game, id, name); }
  AstrologyRoom.prototype = Object.create(RoomPlugin.prototype);
  AstrologyRoom.prototype.onEnter = function (player) { // walking in: here is the profile saved under your name, if any
    const saved = cleanBirth(this.game.loadMeta(profileKey(player.name)));
    this.game.send(player.id, { type: this.id + '.profile', birth: saved && this.game.checkBirth(saved) ? saved : null });
  };
  AstrologyRoom.prototype.onMessage = function (player, msg) {
    if (!this.members.has(player.id) || msg.type !== this.id + '.save') return;
    const now = this.game.now();
    if (now - (player.lastReading || 0) < 1500) return;
    player.lastReading = now;
    const birth = cleanBirth(msg.birth);
    if (!birth || !this.game.checkBirth(birth)) { this.game.send(player.id, { type: this.id + '.saved', ok: false, msg: 'Those birth details are not complete.' }); return; }
    this.game.saveMeta(profileKey(player.name), birth);                      // editing overwrites the profile…
    this.game.saveReading({ t: now, player: player.name, birth });           // …and always ADDS a line to the class file
    const day = new Date(now).toDateString();
    if (player.pr && player.pr.astroDay !== day) { player.pr.astroDay = day; this.game.award(player, this.game.ECON.astroXu, 'astro', 'Astrology reading'); }
    this.game.send(player.id, { type: this.id + '.saved', ok: true, birth });
  };

  // ---- Game Room: shared tables with a lobby, turn clocks and computer players (shared/games.js) ----
  const Games = (typeof module !== 'undefined' && module.exports) ? require('./games.js') : root.CampusGames;
  const GameRoom = Games.makeGameRoom(RoomPlugin);

  /** Register every room here: room id -> class. Rooms without an entry get the template. */
  const REGISTRY = { 'xem-phim': CinemaRoom, 'chiem-tinh': AstrologyRoom, 'tro-choi': GameRoom };
  function loadRooms(game, rooms) {
    const out = {};
    for (const r of rooms) out[r.id] = new (REGISTRY[r.id] || TemplateRoom)(game, r.id, r.name);
    return out;
  }

  const api = { MediaQueue, RoomPlugin, CinemaRoom, AstrologyRoom, GameRoom, Games, TemplateRoom, REGISTRY, loadRooms, MAX_PER_PLAYER, cleanBirth };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CampusRoomPlugins = api;
})(typeof self !== 'undefined' ? self : this);
