// Top 1 Server (combined game) — multiplayer server.
// Zero dependencies: plain Node.js (18+) http server + a minimal WebSocket implementation (from campus-game-v4).
// The rules are the same files the browser uses in solo mode: public/shared/*.js on the Top1 map (public/js/logic.js).
//
//   ADMIN_PASSWORD=yourSecret node server.mjs          ->  http://localhost:5173
//   optional: PORT=5173  MAX_PLAYERS=100  TEST_MODE=1  WIKI_DIR=./wiki  DATA_DIR=./data (where profiles and readings are saved)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import * as MAP from './public/js/logic.js';
import { readingSummary, validBirth } from './public/js/astro/birth.js';

const require = createRequire(import.meta.url);
const Room = require('./public/shared/room.js');
const Quiz = require('./public/shared/quiz.js');
Room.setMap(MAP);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 5173;
const CAP = Number(process.env.MAX_PLAYERS) || 100;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const TEST_MODE = process.env.TEST_MODE === '1';
const PUBLIC = path.join(__dirname, 'public');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.ico': 'image/x-icon' };

if (!ADMIN_PASSWORD) console.warn('[warn] ADMIN_PASSWORD is not set — admin login is disabled.');

// ---------------- static files ----------------
const server = http.createServer((req, res) => {
  let p = decodeURIComponent((req.url || '/').split('?')[0]);
  if (p === '/') p = '/index.html';
  const file = path.normalize(path.join(PUBLIC, p));
  if (!file.startsWith(PUBLIC)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    if (TEST_MODE && p === '/shared/catalog.js') data = Buffer.concat([data, Buffer.from('\n;self.VCCatalog.enableTestMode();\n')]); // the browser uses the same test numbers
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
});

// ---------------- player profiles (Xu, bag, garden) saved to data/profiles.json ----------------
// Keyed by a random token each browser keeps in localStorage. No accounts, no personal data.
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(__dirname, 'data'); // on a host: the mounted disk
const PROFILE_FILE = path.join(DATA_DIR, 'profiles.json');
let profiles = {};
try { profiles = JSON.parse(fs.readFileSync(PROFILE_FILE, 'utf8')) || {}; } catch { profiles = {}; }
let writeTimer = null;
function flushProfiles() {
  writeTimer = null;
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(PROFILE_FILE + '.tmp', JSON.stringify(profiles));
    fs.renameSync(PROFILE_FILE + '.tmp', PROFILE_FILE);
  } catch (e) { console.error('[save] could not write profiles:', e.message); }
}
const clone = (v) => JSON.parse(JSON.stringify(v));
const later = () => { if (!writeTimer) writeTimer = setTimeout(flushProfiles, 1500); };
const store = {
  load: (token) => (profiles[token] ? clone(profiles[token]) : null),
  save: (token, pr) => { profiles[token] = clone(pr); later(); },
  all: () => Object.entries(profiles), // for the weekly boards
  // shared data (market listings) lives under keys that can never be a browser token
  loadMeta: (key) => (profiles['__' + key] ? clone(profiles['__' + key]) : null),
  saveMeta: (key, val) => { profiles['__' + key] = clone(val); later(); },
};
process.on('SIGINT', () => { if (writeTimer) { clearTimeout(writeTimer); flushProfiles(); } process.exit(0); });

// ---------------- Pomodoro quiz bank: sample questions + every "<!-- quiz -->" block in the wiki folder ----------------
const WIKI_DIR = process.env.WIKI_DIR || path.join(__dirname, 'wiki');
(function loadWiki(dir) {
  let found = 0;
  const walk = (d) => {
    let list = []; try { list = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of list) {
      const f = path.join(d, e.name);
      if (e.isDirectory()) walk(f);
      else if (/\.md$/i.test(e.name)) { const qs = Quiz.parseMarkdown(fs.readFileSync(f, 'utf8'), path.basename(f, '.md')); Quiz.bank.push(...qs); found += qs.length; }
    }
  };
  walk(dir);
  console.log(`[quiz] ${Quiz.bank.length} questions (${found} from ${dir})`);
})(WIKI_DIR);

// ---------------- TEST_MODE=1: lots of Xu + 10x faster plants/fish, for play-testing ----------------
if (TEST_MODE) {
  Room.Catalog.enableTestMode();
  const load = store.load;
  store.load = (token) => { const pr = load(token); if (pr && pr.xu < 5000) pr.xu = 5000; return pr; }; // top up on every join
  console.log('[TEST MODE] 5000 Xu on join, plants grow 10x faster, fish can eat every minute.');
}

// ---------------- Astrology Room: one line per "See my chart" in data/chiem-tinh.csv (opens in Excel) ----------------
// Editing your details adds a NEW line; nothing is ever removed. The server works the result columns out itself
// (same code as the browser), so the file never depends on what a browser claims.
const CSV_FILE = path.join(DATA_DIR, 'chiem-tinh.csv');
const CSV_HEAD = ['time', 'player', 'birth name', 'birth date (yyyy-mm-dd)', 'date style typed', 'calendar typed', 'birth time', 'time unknown', 'gender', 'birth place',
  'latitude', 'longitude', 'time zone', 'life path number', 'Sun sign', 'rising sign', 'Tử Vi mệnh', 'lunar date'];
const csvCell = (v) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
const noFormula = (v) => (/^[=+\-@]/.test(String(v)) ? "'" + v : v); // a name starting with = + - @ must not run as an Excel formula
function writeReading(r) {
  try {
    const b = r.birth; const s = readingSummary(b);
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const head = '﻿' + CSV_HEAD.join(',') + '\n';
    if (fs.existsSync(CSV_FILE) && !fs.readFileSync(CSV_FILE, 'utf8').startsWith(head)) fs.renameSync(CSV_FILE, path.join(DATA_DIR, `chiem-tinh-old-${Date.now()}.csv`)); // a file from an older version keeps its own columns
    if (!fs.existsSync(CSV_FILE)) fs.writeFileSync(CSV_FILE, head);
    const row = [new Date(r.t).toISOString(), noFormula(r.player), noFormula(b.name), b.date, b.style === 'US' ? 'US' : 'VN', b.cal === 'lunar' ? 'lunar' : 'solar', b.unknownTime ? '' : b.time, b.unknownTime ? 'yes' : 'no',
      b.gender === 'F' ? 'female' : 'male', s.place, s.lat, s.lon, s.tz, s.lifePath, s.sunSign, s.rising, s.menh, s.lunarDate];
    fs.appendFileSync(CSV_FILE, row.map(csvCell).join(',') + '\n');
  } catch (e) { console.error('[astrology] could not write the reading:', e.message); }
}

// ---------------- the room (rules) ----------------
const sockets = new Map(); // id -> socket
function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(a).digest();
  const hb = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}
const room = new Room({
  cap: CAP,
  store,
  checkBirth: validBirth,
  send(to, msg) {
    const data = JSON.stringify(msg);
    if (to == null) { for (const s of sockets.values()) wsSend(s, data); } else { const s = sockets.get(to); if (s) wsSend(s, data); }
  },
  checkAdmin: (pw) => !!ADMIN_PASSWORD && safeEqual(pw, ADMIN_PASSWORD),
  onReading: (r) => writeReading(r),
  onReport: (r) => console.log(`[report] ${new Date(r.t).toISOString()} ${r.from} -> ${r.target}: ${r.reason || '(no reason)'}`),
});
setInterval(() => { try { room.tick(); } catch (e) { console.error('[rules] tick', e); } }, 100); // one bad tick must not stop the server for everyone

// ---------------- minimal WebSocket ----------------
function wsSend(sock, str) {
  if (sock.destroyed || !sock.writable) return;
  const payload = Buffer.from(str);
  const len = payload.length;
  let header;
  if (len < 126) header = Buffer.from([0x81, len]);
  else if (len < 65536) { header = Buffer.alloc(4); header[0] = 0x81; header[1] = 126; header.writeUInt16BE(len, 2); }
  else { header = Buffer.alloc(10); header[0] = 0x81; header[1] = 127; header.writeBigUInt64BE(BigInt(len), 2); }
  sock.write(Buffer.concat([header, payload]));
}

server.on('upgrade', (req, sock) => {
  if ((req.url || '').split('?')[0] !== '/ws' || (req.headers.upgrade || '').toLowerCase() !== 'websocket') return sock.destroy();
  const key = req.headers['sec-websocket-key'];
  if (!key) return sock.destroy();
  const accept = crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  sock.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + accept + '\r\n\r\n');
  sock.setNoDelay(true);

  const id = crypto.randomBytes(6).toString('hex');
  let joined = false;
  let buf = Buffer.alloc(0);
  let msgCount = 0, windowStart = Date.now();

  const close = () => {
    if (sockets.get(id) === sock) sockets.delete(id);
    if (joined) { joined = false; room.leave(id); }
    sock.destroy();
  };

  sock.on('data', (chunk) => {
    buf = Buffer.concat([buf, chunk]);
    if (buf.length > 1 << 20) return close();
    while (buf.length >= 2) {
      const op = buf[0] & 0x0f;
      const masked = (buf[1] & 0x80) !== 0;
      let len = buf[1] & 0x7f, off = 2;
      if (len === 126) { if (buf.length < 4) return; len = buf.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (buf.length < 10) return; len = Number(buf.readBigUInt64BE(2)); off = 10; }
      if (len > 64 * 1024) return close();
      if (!masked) return close();
      if (buf.length < off + 4 + len) return;
      const mask = buf.subarray(off, off + 4);
      const data = Buffer.from(buf.subarray(off + 4, off + 4 + len));
      for (let i = 0; i < data.length; i++) data[i] ^= mask[i & 3];
      buf = buf.subarray(off + 4 + len);

      if (op === 0x8) return close();
      if (op === 0x9) { sock.write(Buffer.concat([Buffer.from([0x8a, data.length]), data])); continue; } // ping -> pong
      if (op !== 0x1) continue;
      const now = Date.now(); // simple flood guard: 60 messages / second
      if (now - windowStart > 1000) { windowStart = now; msgCount = 0; }
      if (++msgCount > 60) continue;
      let msg;
      try { msg = JSON.parse(data.toString('utf8')); } catch { continue; }
      if (!msg || typeof msg.type !== 'string') continue;
      if (!joined) {
        if (msg.type !== 'hello') continue;
        sockets.set(id, sock);
        joined = room.join(id, msg);
        if (!joined) { sockets.delete(id); setTimeout(() => sock.end(), 200); }
      } else {
        try { room.handle(id, msg); } catch (e) { console.error('[rules]', msg.type, e); }
      }
    }
  });
  sock.on('close', close);
  sock.on('error', close);
});

// Listen on PORT; if it is taken (for example by another game server), try the next few ports.
let port = PORT;
server.on('error', (e) => {
  if (e.code === 'EADDRINUSE' && port < PORT + 10) { console.warn(`[warn] port ${port} is in use, trying ${port + 1}`); port += 1; server.listen(port); }
  else { console.error(e.message); process.exit(1); }
});
server.on('listening', () => {
  const url = `http://localhost:${port}`;
  console.log(`Top 1 Server running on ${url}  (max ${CAP} players${TEST_MODE ? ', TEST MODE' : ''})`);
  console.log('Other computers on the same network: http://<this-computer-ip>:' + port);
  if (process.env.OPEN_BROWSER === '1') { // used by start.command / start.bat
    const cmd = process.platform === 'darwin' ? ['open', [url]] : process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]] : ['xdg-open', [url]];
    try { spawn(cmd[0], cmd[1], { stdio: 'ignore', detached: true }).unref(); } catch { /* open it by hand */ }
  }
});
server.listen(port);
