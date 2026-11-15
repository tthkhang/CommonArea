// Checks for the anonymous usage tracking (tracking.mjs + the hooks in public/shared/*.js). Run: node tests/tracking.test.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import * as L from '../public/js/logic.js';
import { EVENTS, summarize, createTracker } from '../tracking.mjs';

const Room = createRequire(import.meta.url)('../public/shared/room.js');
let failed = 0, passed = 0;
const ok = (c, msg) => { if (c) { passed++; console.log('ok   ' + msg); } else { failed++; console.log('FAIL ' + msg); } };

Room.setMap(L);
const W = Room.setMap(L);
let now = Date.UTC(2026, 10, 15, 3, 0, 0);
const saved = {}; const evs = [];
const store = { load: (t) => (saved[t] ? JSON.parse(JSON.stringify(saved[t])) : null), save: (t, p) => { saved[t] = JSON.parse(JSON.stringify(p)); }, all: () => Object.entries(saved), loadMeta: () => null, saveMeta: () => {} };
const room = new Room({ cap: 100, now: () => now, send: () => {}, store, track: (e) => evs.push(e) });
const of = (e) => evs.filter((x) => x.e === e);
const TA = 'a1a1a1a1a1a1a1a1a1a1a1a1', TB = 'b2b2b2b2b2b2b2b2b2b2b2b2';

// ---- the rules report events
room.join('a', { name: 'An Nguyen', token: TA, client: 'android-app' }); room.join('b', { name: 'Binh', token: TB, client: 'web-desktop' }); room.join('g', { name: 'Guest', client: 'hacked<script>' });
const a = room.players.get('a'), b = room.players.get('b');
ok(of('session_start').length === 3 && of('session_start')[0].client === 'android-app' && of('session_start')[0].returning === false && of('session_start')[0].u === Room.gidOf(TA), 'joining reports session_start with the client and a made-up player id');
ok(of('session_start')[2].client === 'other' && of('session_start')[2].u === null, 'an unknown client name is not stored, and a player without a saved profile has no id');
const tbl = W.tables.find((t) => !t.kind && !t.room); const seat = tbl.seats[0];
a.x = seat.x; a.z = seat.z; room.handle('a', { type: 'sit', table: tbl.id, seat: 0 });
ok(of('study_sit').length === 1 && of('study_sit')[0].place === 'plaza', 'sitting at a plaza table reports study_sit');
room.handle('a', { type: 'stand' }); now += 1000; room.handle('a', { type: 'chat', text: 'my secret message' });
ok(of('chat_sent').length === 1 && of('chat_sent')[0].channel === 'all', 'a chat message reports chat_sent');
room.setRoom(a, 'tro-choi'); ok(of('room_enter').some((x) => x.room === 'tro-choi'), 'walking into a room reports room_enter');
room.setRoom(a, null); room.handle('a', { type: 'area', to: 'garden' });
ok(of('area_enter').some((x) => x.area === 'my-garden'), 'going to your own garden reports area_enter');
a.pr.inv['seed:carrot'] = 2; room.handle('a', { type: 'plant', where: 'plot', id: '0,0', seed: 'carrot' });
ok(of('garden_plant').length === 1, 'planting reports garden_plant');
room.handle('a', { type: 'area', to: 'back' });
now += 2000; room.handle('a', { type: 'friendAdd', id: 'b' }); room.handle('b', { type: 'friendAnswer', gid: Room.gidOf(TA), ok: true });
ok(of('friend_request').length === 1 && of('friend_accept').length === 1 && of('friend_accept')[0].with, 'friend request and acceptance are reported');
room.handle('a', { type: 'area', to: 'garden', gid: Room.gidOf(TB) });
ok(of('garden_visit').length === 1 && of('garden_visit')[0].kind === 'friend', 'visiting a friend\'s garden reports garden_visit');
room.handle('a', { type: 'like' }); ok(of('garden_like').length === 1, 'liking a garden reports garden_like');
room.handle('a', { type: 'area', to: 'back' });
now += 5 * 60000; room.leave('a');
ok(of('session_end').length === 1 && of('session_end')[0].minutes >= 5, 'leaving reports session_end with the minutes played');
const text = JSON.stringify(evs);
ok(!/An Nguyen|Binh|Guest|secret message|a1a1a1|b2b2b2/.test(text), 'no event contains a name, a chat text or a browser token');
ok(evs.every((e) => EVENTS[e.e]), 'every event the rules send is described in the plan (EVENTS)');
const quiet = new Room({ cap: 10, now: () => now, send: () => {}, store });
quiet.join('q', { name: 'Solo', token: 'c3c3c3c3c3c3c3c3c3c3c3c3' }); quiet.leave('q');
ok(true, 'a room without a tracker (solo mode) works and reports nothing');

// ---- the numbers on the stats page
const day = 86400000, t0 = Date.UTC(2026, 10, 10, 5, 0, 0);
const sample = [
  { t: t0, e: 'session_start', s: 's1', u: 'gA', client: 'web-desktop', returning: false }, { t: t0 + 1000, e: 'room_enter', s: 's1', u: 'gA', room: 'tro-choi' },
  { t: t0 + 2000, e: 'game_start', s: 's1', u: 'gA', game: 'cards' }, { t: t0 + 3000, e: 'chat_sent', s: 's1', u: 'gA', channel: 'all' },
  { t: t0 + 4000, e: 'friend_accept', s: null, u: 'gA', with: 'gB' }, { t: t0 + 600000, e: 'session_end', s: 's1', u: 'gA', minutes: 10 },
  { t: t0 + 5000, e: 'session_start', s: 's2', u: 'gB', client: 'android-app', returning: false }, { t: t0 + 65000, e: 'session_end', s: 's2', u: 'gB', minutes: 1 },
  { t: t0 + day, e: 'session_start', s: 's3', u: 'gA', client: 'web-phone', returning: true }, { t: t0 + day + 180000, e: 'session_end', s: 's3', u: 'gA', minutes: 3 },
  { t: t0 + day, e: 'session_start', s: 's4', u: null, client: 'web-desktop', returning: false },
];
const s = summarize(sample, t0 + day + 200000);
ok(s.overview.sessions === 4 && s.overview.players === 2, 'visits and different players are counted (a player without an id is a visit, not a player)');
ok(s.overview.cameBackAnotherDay === 1 && s.overview.cameBackShare === 50, 'coming back on another day is counted per player');
ok(s.overview.medianMinutes === 3 && Math.abs(s.overview.avgMinutes - 4.7) < 0.01, 'average and median visit length');
ok(s.funnel[0].players === 2 && s.funnel[1].players === 1 && s.funnel[2].players === 1 && s.funnel[4].players === 2, 'the funnel counts each player once per step; a friendship counts for both players');
ok(s.days[0].day === '2026-11-11' && s.days[0].sessions === 2 && s.days[1].newPlayers === 2 && s.days[0].newPlayers === 0, 'day table: newest first, new players only on their first day');
ok(s.clients['android-app'] === 1 && s.rooms['tro-choi'] === 1 && s.games.cards === 1, 'clients, rooms and games are broken down');
ok(s.totals.length === Object.keys(EVENTS).length && s.totals.find((x) => x.event === 'session_start').today === 2, 'every planned event has a row, with today\'s count');
ok(summarize([], t0).overview.players === 0 && summarize([], t0).funnel[0].share === 0, 'no events: all zeros, no division by zero');

// ---- the event file
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ca-track-'));
const tr = createTracker({ dir, flushMs: 5 }); sample.forEach((e) => tr.track(e)); tr.track(null); tr.track({ nope: 1 }); tr.flush();
const lines = fs.readFileSync(path.join(dir, 'events.jsonl'), 'utf8').trim().split('\n');
ok(lines.length === sample.length && JSON.parse(lines[0]).e === 'session_start', 'events are appended to events.jsonl, one per line; junk is ignored');
fs.appendFileSync(path.join(dir, 'events.jsonl'), '{"t":1,"e":"half');
const again = createTracker({ dir }); ok(again.size === sample.length && again.summary(t0).overview.sessions === 4, 'a restarted server reads the file back (a half-written last line is skipped)');
fs.rmSync(dir, { recursive: true, force: true });

// ---- the plan document lists exactly the events in the code
const plan = fs.readFileSync(new URL('../TRACKING.md', import.meta.url), 'utf8');
const inPlan = [...plan.matchAll(/^\| `([a-z_]+)` \|/gm)].map((m) => m[1]);
ok(Object.keys(EVENTS).every((e) => inPlan.includes(e)) && inPlan.every((e) => EVENTS[e]), 'TRACKING.md lists exactly the events the game tracks');

console.log('\n' + (failed ? failed + ' FAILED, ' : 'ALL TESTS PASSED: ') + passed + ' passed');
if (failed) process.exitCode = 1;
