// Common Area — anonymous usage tracking (server only). The plan behind it is in TRACKING.md.
//
// The rules (public/shared/room.js, `Room.prototype.ev`) hand over one small object per event:
//   { t: time, e: event name, s: connection id of this visit, u: the player's garden id or null, ...a few properties }
// There are no names, no chat text and no birth details in an event. `u` is a made-up id worked out from the random
// token the browser keeps; it lets us count "the same player came back" without knowing who the player is.
//
// Events are kept in memory (for the stats page) and appended to <data>/events.jsonl, one JSON object per line.
import fs from 'node:fs';
import path from 'node:path';

/** What each event means: shown on the stats page and repeated in TRACKING.md (tests check that the two agree). */
export const EVENTS = {
  session_start: 'A player entered the plaza (properties: client = web-desktop / web-phone / android-app, returning, guest)',
  session_end: 'A player left (property: minutes played in this visit)',
  room_enter: 'Walked into a closed room (property: room)',
  area_enter: 'Went to the Quiet Forest or to their own garden island (property: area)',
  study_sit: 'Sat down at a study table (property: place = plaza / forest / meeting room)',
  pomodoro_done: 'Stayed seated for a full 25-minute focus round (the quiz appeared)',
  quiz_answer: 'Answered a Pomodoro quiz question (property: ok)',
  cinema_sit: 'Took a seat in the Cinema',
  media_add: 'Added a video to the shared music or cinema queue (property: where)',
  game_start: 'A table game started for this player (properties: game, humans, bots)',
  game_end: 'A table game ended for this player (properties: game, won, minutes)',
  match_level_done: 'Finished a Colour Match level (properties: level, stars, first)',
  reading_made: 'Made an astrology reading (no birth details are stored in the event)',
  shop_buy: 'Bought something at the Shop (properties: kind, cost in Xu)',
  food_buy: 'Bought food or a drink for a study boost (property: item)',
  garden_plant: 'Planted something on their island (property: where)',
  garden_harvest: 'Harvested something on their island (property: where)',
  fish_caught: 'Caught a fish (property: tier = rarity)',
  chat_sent: 'Sent a chat message (property: channel; the text is not stored)',
  friend_request: 'Sent a friend request',
  friend_accept: 'Two players became friends',
  friend_remove: 'Removed a friend',
  garden_visit: 'Visited someone else\'s garden (property: kind = friend / player / villager)',
  garden_like: 'Liked a garden they were visiting',
  report_filed: 'Reported another player to the admins',
};

const EXPLORE = ['room_enter', 'area_enter'];
const CORE = ['study_sit', 'game_start', 'match_level_done', 'garden_plant', 'reading_made'];
const SOCIAL = ['chat_sent', 'friend_request', 'garden_visit', 'garden_like'];
const round1 = (n) => Math.round(n * 10) / 10;

/** Turn a list of events into the numbers on the stats page. Pure: no files, no clock except `now`. */
export function summarize(events, now = Date.now(), tzMinutes = 420) {
  const dayOf = (t) => new Date(t + tzMinutes * 60000).toISOString().slice(0, 10);
  const totals = {}; const days = {}; const clients = {}; const rooms = {}; const games = {};
  const firstDay = {}; const seenDays = {}; const did = { joined: new Set(), explored: new Set(), core: new Set(), social: new Set(), friend: new Set() };
  const minutes = [];
  for (const ev of events) {
    if (!ev || typeof ev.e !== 'string') continue;
    const tt = (totals[ev.e] = totals[ev.e] || { count: 0, players: new Set(), today: 0 });
    tt.count++; if (ev.u) tt.players.add(ev.u); if (dayOf(ev.t) === dayOf(now)) tt.today++;
    const who = ev.u ? [ev.u] : [];
    if (ev.e === 'friend_accept' && ev.with) who.push(ev.with);
    for (const u of who) {
      if (ev.e === 'session_start') did.joined.add(u);
      if (EXPLORE.includes(ev.e)) did.explored.add(u);
      if (CORE.includes(ev.e)) did.core.add(u);
      if (SOCIAL.includes(ev.e)) did.social.add(u);
      if (ev.e === 'friend_accept') did.friend.add(u);
    }
    if (ev.e === 'session_start') {
      const d = dayOf(ev.t); const day = (days[d] = days[d] || { day: d, sessions: 0, players: new Set(), newPlayers: 0 });
      day.sessions++;
      clients[ev.client || 'other'] = (clients[ev.client || 'other'] || 0) + 1;
      if (ev.u) {
        day.players.add(ev.u);
        (seenDays[ev.u] = seenDays[ev.u] || new Set()).add(d);
        if (!firstDay[ev.u]) { firstDay[ev.u] = d; if (!ev.returning) day.newPlayers++; }
      }
    }
    if (ev.e === 'session_end' && typeof ev.minutes === 'number') minutes.push(ev.minutes);
    if (ev.e === 'room_enter' && ev.room) rooms[ev.room] = (rooms[ev.room] || 0) + 1;
    if (ev.e === 'game_start' && ev.game) games[ev.game] = (games[ev.game] || 0) + 1;
  }
  minutes.sort((a, b) => a - b);
  const players = did.joined.size;
  const cameBack = Object.values(seenDays).filter((s) => s.size >= 2).length;
  const step = (name, set) => ({ step: name, players: set.size, share: players ? Math.round((set.size / players) * 100) : 0 });
  return {
    generatedAt: now, since: events.length ? events[0].t : null, events: events.length,
    overview: {
      sessions: (totals.session_start || { count: 0 }).count, players,
      avgMinutes: minutes.length ? round1(minutes.reduce((a, b) => a + b, 0) / minutes.length) : 0,
      medianMinutes: minutes.length ? minutes[Math.floor(minutes.length / 2)] : 0,
      cameBackAnotherDay: cameBack, cameBackShare: players ? Math.round((cameBack / players) * 100) : 0,
    },
    funnel: [step('Entered the plaza', did.joined), step('Explored a room, the forest or their garden', new Set([...did.explored].filter((u) => did.joined.has(u)))),
      step('Did a core activity (study, game, garden, reading)', new Set([...did.core].filter((u) => did.joined.has(u)))),
      step('Was social (chat, visit, like, friend request)', new Set([...did.social].filter((u) => did.joined.has(u)))),
      step('Made a friend', new Set([...did.friend].filter((u) => did.joined.has(u))))],
    days: Object.values(days).sort((a, b) => (a.day < b.day ? 1 : -1)).slice(0, 30).map((d) => ({ day: d.day, sessions: d.sessions, players: d.players.size, newPlayers: d.newPlayers })),
    clients, rooms, games,
    totals: Object.keys(EVENTS).map((e) => ({ event: e, meaning: EVENTS[e], count: totals[e] ? totals[e].count : 0, players: totals[e] ? totals[e].players.size : 0, today: totals[e] ? totals[e].today : 0 }))
      .concat(Object.keys(totals).filter((e) => !EVENTS[e]).map((e) => ({ event: e, meaning: '(not in the plan)', count: totals[e].count, players: totals[e].players.size, today: totals[e].today }))),
    recent: events.slice(-60).reverse(),
  };
}

/** The event store: memory + <dir>/events.jsonl. `dir` null = memory only (tests). */
export function createTracker({ dir = null, max = 100000, maxFileBytes = 8 * 1024 * 1024, flushMs = 2000 } = {}) {
  const file = dir ? path.join(dir, 'events.jsonl') : null;
  let events = []; let pending = []; let timer = null;
  if (file) {
    try {
      const lines = fs.readFileSync(file, 'utf8').split('\n');
      for (const line of lines.slice(-max)) { if (!line) continue; try { const ev = JSON.parse(line); if (ev && typeof ev.e === 'string') events.push(ev); } catch { /* a half-written last line */ } }
    } catch { /* no file yet */ }
  }
  function flush() {
    timer = null; if (!file || !pending.length) return;
    const out = pending.join('\n') + '\n'; pending = [];
    try {
      fs.mkdirSync(dir, { recursive: true });
      try { if (fs.statSync(file).size > maxFileBytes) fs.renameSync(file, path.join(dir, 'events-old.jsonl')); } catch { /* no file yet */ }
      fs.appendFileSync(file, out);
    } catch (e) { console.error('[tracking] could not write events:', e.message); }
  }
  return {
    track(ev) {
      if (!ev || typeof ev.e !== 'string') return;
      events.push(ev); if (events.length > max) events = events.slice(-Math.floor(max * 0.9));
      if (file) { pending.push(JSON.stringify(ev)); if (!timer) timer = setTimeout(flush, flushMs); }
    },
    flush() { if (timer) { clearTimeout(timer); } flush(); },
    summary(now) { return summarize(events, now); },
    get size() { return events.length; },
  };
}
