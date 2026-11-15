// Plays the Common Area core flow in a hidden Chrome window, with scripted classmates on a local server, and (REC=1) captures it.
//   node record.mjs <scratch dir>      env: REC=1 record frames, STOP=<stage name> stop after that stage, PORT=5184
import fs from 'node:fs';
import { launch, sleep } from './cdp.mjs';
const SP = process.argv[2]; const PORT = process.env.PORT || 5184; const REC = process.env.REC === '1'; const STOP = process.env.STOP || '';
const people = JSON.parse(fs.readFileSync(new URL('./people.json', import.meta.url), 'utf8'));
const shots = SP + '/demo/shots'; fs.mkdirSync(shots, { recursive: true });
const frames = SP + '/demo/frames'; if (REC) { fs.rmSync(frames, { recursive: true, force: true }); fs.mkdirSync(frames, { recursive: true }); }
const log = (...a) => console.log(new Date().toISOString().slice(14, 19), ...a);

// ------------------------------------------------------------ scripted classmates
function puppet(name) {
  const q = people.find((x) => x.name === name);
  const ws = new WebSocket(`ws://localhost:${PORT}/ws`);
  const c = { name, id: null, pos: null, view: null, others: new Map(), busy: false, onRequest: null };
  c.ready = new Promise((res) => { ws.onopen = () => ws.send(JSON.stringify({ type: 'hello', name, token: q.token, look: q.look, client: 'web-desktop' }));
    ws.onmessage = (e) => { const m = JSON.parse(e.data);
      if (m.type === 'welcome') { c.id = m.you; const p = m.players.find((x) => x.id === m.you); c.pos = { x: p.x, z: p.z }; m.players.forEach((x) => c.others.set(x.id, x)); res(); }
      if (m.type === 'join') c.others.set(m.player.id, m.player);
      if (m.type === 'tro-choi.state') c.view = m.view;
      if (m.type === 'friendRequest') setTimeout(() => c.send({ type: 'friendAnswer', gid: m.gid, ok: true }), 2200);
    }; });
  c.send = (m) => { if (ws.readyState === 1) ws.send(JSON.stringify(m)); };
  c.walk = async (x, z, speed = 4) => { // natural walking: small steps, facing the way it goes
    const d = Math.hypot(x - c.pos.x, z - c.pos.z); const steps = Math.max(1, Math.ceil(d / (speed * 0.1))); const s = { ...c.pos }; const ry = Math.atan2(x - s.x, z - s.z);
    for (let i = 1; i <= steps; i++) { c.pos = { x: s.x + (x - s.x) * i / steps, z: s.z + (z - s.z) * i / steps }; c.send({ type: 'move', x: c.pos.x, z: c.pos.z, ry, moving: i < steps }); await sleep(100); }
  };
  c.jump = (x, z) => { c.pos = { x, z }; c.send({ type: 'move', x, z, ry: 0, moving: false }); };
  c.sit = async (table, seat, pos) => { c.jump(pos.x + 0.3, pos.z + 0.3); await sleep(150); c.send({ type: 'sit', table, seat }); };
  c.say = (text) => c.send({ type: 'chat', text });
  c.close = () => ws.close();
  return c;
}
const pick = (a) => a[Math.floor(Math.random() * a.length)];
async function cardsPlayer(c, T, state) { // plays Colour Cards for a classmate until told to stop
  let lastN = -1;
  while (!state.stop) {
    await sleep(500); const v = c.view; if (!v || v.phase !== 'play' || !v.g) continue; const g = v.g;
    if (g.one && g.one.seat === v.you && !g.one.called) c.send({ type: 'tro-choi.move', table: T, one: true });
    if (g.turn === v.you && g.n !== lastN) { lastN = g.n; await sleep(1500);
      if (g.playable.length) c.send({ type: 'tro-choi.move', table: T, play: g.playable[0], color: pick(['p', 'y', 'r', 't']) });
      else if (g.drawn == null) c.send({ type: 'tro-choi.move', table: T, draw: true }); else c.send({ type: 'tro-choi.move', table: T, pass: true }); }
  }
}

// ------------------------------------------------------------ the browser
const page = await launch({ profile: SP + '/demo/chrome-profile' });
await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `try { if (!localStorage.getItem('top1server')) localStorage.setItem('top1server', JSON.stringify({ token: 'd0d0d0d0d0d0d0d0d0d0d0d0', look: ${JSON.stringify(people[0].look)} })); localStorage.setItem('top1server-huong-dan', '1'); } catch (e) {}` });
// sound: everything the game plays through Web Audio is also copied into memory (a hidden Chrome has no sound output to record),
// and the player's walking is sampled so that footsteps can be added in the mix
await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `(() => {
  const orig = AudioNode.prototype.connect; const taps = new Map(); window.__rec = { on: false, list: [] }; window.__walk = [];
  AudioNode.prototype.connect = function (target, ...rest) {
    if (!(target instanceof AudioDestinationNode)) return orig.call(this, target, ...rest);
    const ctx = target.context; let tap = taps.get(ctx);
    if (!tap) {
      const rec = { rate: ctx.sampleRate, t0: null, chunks: [] }; window.__rec.list.push(rec);
      tap = ctx.createGain(); const sp = ctx.createScriptProcessor(4096, 2, 2);
      sp.onaudioprocess = (e) => { if (!window.__rec.on) return; if (rec.t0 == null) rec.t0 = Date.now() - 4096 / ctx.sampleRate * 1000; rec.chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)), new Float32Array(e.inputBuffer.getChannelData(1))); };
      orig.call(tap, sp); orig.call(sp, target); orig.call(tap, target); taps.set(ctx, tap);
    }
    return orig.call(this, tap, ...rest);
  };
  window.__recDump = (k, i, size) => { const rec = window.__rec.list[k]; const start = i * size, end = Math.min(rec.chunks.length / 2, start + size); if (start >= end) return '';
    const out = new Int16Array((end - start) * 4096 * 2);
    for (let b = start; b < end; b++) { const L = rec.chunks[2 * b], R = rec.chunks[2 * b + 1]; for (let j = 0; j < 4096; j++) { const o = ((b - start) * 4096 + j) * 2; out[o] = Math.max(-1, Math.min(1, L[j])) * 32767; out[o + 1] = Math.max(-1, Math.min(1, R[j])) * 32767; } }
    const u8 = new Uint8Array(out.buffer); let str = ''; for (let p = 0; p < u8.length; p += 0x8000) str += String.fromCharCode.apply(null, u8.subarray(p, p + 0x8000)); return btoa(str); };
  let was = false; setInterval(() => { const G = window.__game; const mv = !!(G && G.me && G.me.moving); if (mv !== was) { was = mv; window.__walk.push([Date.now(), mv]); } }, 80);
})();` });
const voiceLen = JSON.parse(fs.readFileSync(new URL('./voice/durations.json', import.meta.url), 'utf8'));
const timeline = { voice: [], clicks: [] }; let voiceFreeAt = 0;
const voiceDone = async (extra = 0) => { const w = voiceFreeAt + extra - Date.now(); if (w > 0) await sleep(w); };
const narrate = async (key) => { await voiceDone(); timeline.voice.push({ key, t: Date.now() }); voiceFreeAt = Date.now() + voiceLen[key] * 1000 + 450; }; // one spoken line at a time
const ev = (s) => page.ev(s);
let n = 0; const list = [];
if (REC) page.on('Page.screencastFrame', (p) => { n++; const f = frames + '/' + String(n).padStart(6, '0') + '.jpg'; fs.writeFileSync(f, Buffer.from(p.data, 'base64')); list.push(p.metadata.timestamp + '\t' + f); page.send('Page.screencastFrameAck', { sessionId: p.sessionId }).catch(() => {}); });
const OVERLAY = `(() => { if (document.getElementById('demo-cap')) return;
  const st = document.createElement('style'); st.textContent = '#demo-cap{position:fixed;left:50%;top:84px;transform:translateX(-50%);z-index:99998;max-width:900px;padding:10px 24px;border-radius:16px;background:rgba(43,31,77,.93);color:#fff;font:700 23px/1.3 Nunito,system-ui,sans-serif;text-align:center;box-shadow:0 6px 0 rgba(0,0,0,.25);opacity:0;transition:opacity .35s;pointer-events:none}#demo-cap.on{opacity:1}#demo-cap small{display:block;font:600 16px/1.3 Nunito,system-ui,sans-serif;opacity:.85;margin-top:2px}#demo-cur{position:fixed;left:640px;top:420px;z-index:99999;width:26px;height:26px;pointer-events:none;transition:left .5s cubic-bezier(.3,.1,.2,1),top .5s cubic-bezier(.3,.1,.2,1)}#demo-cur i{position:absolute;left:-14px;top:-14px;width:28px;height:28px;border-radius:50%;border:3px solid #FFC43D;opacity:0}#demo-cur.hit i{animation:demohit .45s ease-out}@keyframes demohit{from{opacity:1;transform:scale(.4)}to{opacity:0;transform:scale(1.9)}}#demo-end{position:fixed;inset:0;z-index:99997;background:#F4EEFF;display:grid;place-content:center;justify-items:center;gap:14px;opacity:0;transition:opacity .6s;pointer-events:none;font-family:"Baloo 2",Nunito,system-ui,sans-serif;color:#2B1F4D;text-align:center}#demo-end.on{opacity:1}#demo-end h1{margin:0;font-size:76px;line-height:1;color:#7A4DFF}#demo-end p{margin:0;font:700 26px Nunito,system-ui,sans-serif}#demo-end b{font:800 30px Nunito,system-ui,sans-serif;background:#FFC43D;border:3px solid #2B1F4D;border-radius:16px;padding:8px 22px;box-shadow:0 5px 0 #2B1F4D}';
  document.head.appendChild(st);
  const cap = document.createElement('div'); cap.id = 'demo-cap'; document.body.appendChild(cap);
  const cur = document.createElement('div'); cur.id = 'demo-cur'; cur.innerHTML = '<i></i><svg width="26" height="26" viewBox="0 0 24 24"><path d="M4 2l15 9-7 1.6L9.4 20z" fill="#fff" stroke="#2B1F4D" stroke-width="1.8" stroke-linejoin="round"/></svg>'; document.body.appendChild(cur);
  const end = document.createElement('div'); end.id = 'demo-end'; document.body.appendChild(end);
})()`;
const cap = async (text, small, where) => { await ev(`${OVERLAY}; const c = document.getElementById('demo-cap'); c.style.top = '${where === 'head' ? 18 : where === 'low' ? 600 : 84}px'; c.style.fontSize = '${where === 'head' ? 20 : 23}px'; ${text ? `c.innerHTML = ${JSON.stringify(text + (small ? '<small>' + small + '</small>' : ''))}; c.classList.add('on');` : `c.classList.remove('on');`} return 1;`); };
const moveCur = async (x, y) => { await ev(`${OVERLAY}; const c = document.getElementById('demo-cur'); c.style.left = '${x}px'; c.style.top = '${y}px'; return 1;`); await page.mouse('mouseMoved', x, y); await sleep(560); };
const clickAt = async (x, y) => { await moveCur(x, y); await ev(`const c = document.getElementById('demo-cur'); c.classList.remove('hit'); void c.offsetWidth; c.classList.add('hit'); return 1;`); timeline.clicks.push(Date.now()); await page.mouse('mousePressed', x, y); await sleep(70); await page.mouse('mouseReleased', x, y); await sleep(250); };
const rectOf = (sel, text) => ev(`const all = [...document.querySelectorAll(${JSON.stringify(sel)})].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && !e.disabled; }); const e = ${text ? `all.find((x) => x.textContent.includes(${JSON.stringify(text)}))` : 'all[0]'}; if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 };`);
const clickSel = async (sel, text, tries = 20) => { for (let i = 0; i < tries; i++) { const r = await rectOf(sel, text); if (r) { await clickAt(Math.round(r.x), Math.round(r.y)); return true; } await sleep(300); } log('!! not found:', sel, text || ''); return false; };
const type = async (text, delay = 70) => { for (const ch of text) { await page.send('Input.insertText', { text: ch }); await sleep(delay); } };
const enter = () => page.key('Enter', 'Enter', 13, '\r');
const G = (s) => ev(`const G = window.__game; ${s}`);
const walkTo = async (x, z, max = 20000) => { await G(`G.diToi(${x}, ${z}); return 1;`); const t0 = Date.now(); while (Date.now() - t0 < max) { await sleep(250); const d = await G(`return Math.hypot(G.me.x - (${x}), G.me.z - (${z}));`); if (d < 0.7) break; const mv = await G(`return G.me.moving;`); if (!mv && Date.now() - t0 > 1500) break; } };
const waitFor = async (expr, max = 15000) => { const t0 = Date.now(); while (Date.now() - t0 < max) { if (await ev(`return !!(${expr});`)) return true; await sleep(250); } log('!! timeout:', expr); return false; };
let stageNo = 0;
const stage = async (name) => { stageNo++; await page.shot(`${shots}/${String(stageNo).padStart(2, '0')}-${name}.jpg`); log('stage done:', name, JSON.stringify(await ev(`const G = window.__game; return G && G.me ? { area: G.raw.area, room: G.raw.room, x: +G.me.x.toFixed(1), z: +G.me.z.toFixed(1), seat: G.me.seat || null, xu: G.raw.profile && G.raw.profile.xu } : null;`))); if (STOP === name) throw new Error('STOP'); };

const P = {}; const cards = { stop: false };
try {
  // classmates take their places before the recording starts
  for (const nm of ['Linh', 'Minh', 'Thao', 'Binh', 'Chi', 'Huy', 'An']) { P[nm] = puppet(nm); await P[nm].ready; await sleep(120); }
  await page.send('Page.navigate', { url: `http://localhost:${PORT}/` }); await sleep(3500);
  const W = await ev(`const W = window.__game.WORLD; const t = (id) => W.tables.find((x) => x.id === id).seats.map((s) => ({ x: s.x, z: s.z })); return { hoc1: t('ban-hoc-1'), hoc3: t('ban-hoc-3'), bai: t('ban-bai-mau'), gate: W.forestGate };`);
  await P.Minh.sit('ban-hoc-1', 0, W.hoc1[0]); await P.Thao.sit('ban-hoc-1', 2, W.hoc1[2]);
  P.Binh.jump(14, -31); await sleep(200); await P.Binh.sit('ban-bai-mau', 0, W.bai[0]); P.Chi.jump(14, -31); await sleep(200); await P.Chi.sit('ban-bai-mau', 1, W.bai[1]);
  P.Linh.jump(-3, 9); P.Huy.jump(8, -6); P.An.jump(-7, -4);
  const wander = async (c, pts) => { let i = 0; while (!cards.end) { const p = pts[i++ % pts.length]; await c.walk(p[0], p[1], 3.2); await sleep(1500 + Math.random() * 2500); } };
  wander(P.Huy, [[6, -7], [9, 2], [3, 9], [-4, 3], [5, -3]]); wander(P.An, [[-7, -5], [-3, -8], [4, -9], [-8, 2]]);

  // ---------------------------------------------------------- 1. start screen
  if (REC) await page.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: 1280, maxHeight: 720, everyNthFrame: 1 });
  await ev(`window.__rec.on = true; return 1;`);
  await narrate('intro');
  await cap('A shared online plaza to study, play and hang out together', null, 'low');
  await sleep(3200);
  await cap('No account, no install: pick a name and a look', null, 'low');
  await clickSel('#ten'); await type('Khang', 130); await sleep(500);
  await clickSel('#bang-mau button:nth-child(9)'); await sleep(900);
  await voiceDone(-1500);
  await clickSel('#nut-vao'); await waitFor(`window.__game && window.__game.state().screen === 'choi'`, 20000); await sleep(1500);
  await stage('enter');

  // ---------------------------------------------------------- 2. the plaza
  await narrate('plaza');
  await cap('The plaza: everyone you see is a real player');
  P.An.say('hi Khang! 👋'); await sleep(1800); P.Huy.say('welcome to the plaza'); await sleep(1500);
  await clickSel('#chat input'); await type('hi everyone! ready to study?', 55); await enter(); await sleep(1800);
  await stage('plaza');

  // ---------------------------------------------------------- 3. study together
  await narrate('study');
  await cap('Study with classmates: focused minutes earn Xu', 'After 25 minutes a quiz appears; a right answer pays a bonus');
  await walkTo(W.hoc1[1].x + 0.9, W.hoc1[1].z + 0.9); await sleep(400);
  for (let i = 0; i < 3 && !(await G(`return !!G.me.seat;`)); i++) { await G(`G.nhanE(); return 1;`); await sleep(1300); } // E may first pick up a piece of litter lying next to the chair
  if (!(await G(`return !!G.me.seat;`))) { log('!! sit fallback'); await G(`G.net.send({ type: 'sit', table: 'ban-hoc-1', seat: 1 }); return 1;`); await sleep(800); }
  await sleep(900);
  P.Minh.send({ type: 'tableChat', text: 'chapter 4 today?' }); await sleep(1500); P.Thao.send({ type: 'tableChat', text: 'yes, 25 minutes then a break 💪' }); await sleep(2500);
  await voiceDone();
  await stage('study');

  // ---------------------------------------------------------- 4. the Game Room
  await narrate('gameroom');
  await cap('Break time: the Game Room has shared tables', 'Ludo, Colour Cards, Werewolf and Colour Match');
  await G(`G.toiKhu('tro-choi'); return 1;`); await sleep(2600);
  await walkTo(W.bai[2].x + 0.8, W.bai[2].z + 0.8); await sleep(400);
  await stage('gameroom');
  for (let i = 0; i < 3 && !(await ev(`return !!document.querySelector('.gt-lobby');`)); i++) { await G(`G.nhanE(); return 1;`); await sleep(1500); }
  await waitFor(`document.querySelector('.gt-lobby')`, 6000); await sleep(600);
  await cap('Colour Cards with Binh and Chi: the host presses Start', null, 'head'); await sleep(1500);
  P.Chi.send({ type: 'tro-choi.chat', table: 'ban-bai-mau', text: 'hi Khang! one quick game?' }); await sleep(2200);
  P.Binh.send({ type: 'tro-choi.start', table: 'ban-bai-mau' }); cardsPlayer(P.Binh, 'ban-bai-mau', cards); cardsPlayer(P.Chi, 'ban-bai-mau', cards);
  await waitFor(`document.querySelector('.cc-hand')`, 8000); await sleep(1200);
  await stage('table');
  await narrate('cards');
  await cap('The server is the referee: turns, a 20-second clock, table chat', null, 'head');
  const t0 = Date.now(); let said = false;
  while (Date.now() - t0 < 30000) {
    if (!said && Date.now() - t0 > 14000) { said = true; P.Binh.send({ type: 'tro-choi.chat', table: 'ban-bai-mau', text: 'nice one 😄' }); }
    if (await rectOf('.cc-chooser:not([hidden]) div button')) { await clickSel('.cc-chooser:not([hidden]) div button', null, 2); await sleep(700); continue; }
    if (await rectOf('.cc-one')) { await clickSel('.cc-one', null, 1); await sleep(400); continue; }
    const id = await ev(`const b = document.querySelector('.cc-slot.ok'); return b ? b.dataset.id : null;`);
    if (id != null) { await clickSel(`.cc-slot[data-id="${id}"]`, null, 2); await sleep(380); await clickSel(`.cc-slot[data-id="${id}"]`, null, 2); await sleep(1000); continue; }
    if (await rectOf('.cc-deck.can')) { await clickSel('.cc-deck.can', null, 1); await sleep(1000); const keep = await rectOf('.cc-actions button', 'Keep it and pass'); if (keep && !(await rectOf('.cc-slot.ok'))) await clickSel('.cc-actions button', 'Keep it and pass', 1); continue; }
    await sleep(350);
  }
  await stage('cards');
  cards.stop = true;

  // ---------------------------------------------------------- 5. friends
  await cap('');
  await ev(`const x = [...document.querySelectorAll('#lop-phu button, .modal button, button')].find((b) => b.getBoundingClientRect().width > 0 && /^(✕|×)$/.test(b.textContent.trim())); if (x) x.click(); return !!x;`); await sleep(500);
  await G(`G.toiKhu('chung'); return 1;`); await sleep(2400);
  await narrate('friends');
  await cap('Friends: click a player to send a friend request');
  await P.Linh.walk(5.2, 4.2); P.Linh.say('Khang! add me and come see my garden 🌱'); await sleep(2200);
  const linh = await G(`const q = [...G.raw.players.values()].find((p) => p.name === 'Linh'); const cam = G.R.camera; cam.updateMatrixWorld(); const v = cam.position.clone().set(q.x, 0.9, q.z).project(cam); return { id: q.id, x: Math.round((v.x + 1) / 2 * innerWidth), y: Math.round((1 - v.y) / 2 * innerHeight), keys: Object.keys(q).join(',') };`); log('linh', JSON.stringify(linh));
  await clickAt(linh.x, linh.y); await waitFor(`!document.querySelector('#playerCard').classList.contains('hidden')`, 5000); await sleep(700);
  await stage('card');
  await clickSel('#playerCard .btns button', 'Add friend'); await sleep(900);
  await waitFor(`window.__game.raw.friends.list.length > 0`, 9000); await sleep(1300);
  await ev(`document.querySelector('#playerCard [data-act=close]').click(); return 1;`);
  await narrate('friends2');
  await cap('Friends can visit each other\'s garden at any time', 'also when the friend is offline');
  await clickSel('#vcFriends'); await sleep(1600);
  await stage('friends');
  await clickSel('#vcFriends2 [data-visit]'); await waitFor(`window.__game.raw.area === 'garden' && window.__game.raw.visit`, 12000); await sleep(3500);
  await stage('visit');
  await narrate('visit');
  await cap('Linh\'s garden: leave a like, it pays her Xu');
  await G(`G.diToi(G.me.x + 5, G.me.z - 6); return 1;`); await sleep(3000);
  await clickSel('#vcLike'); await sleep(2200);
  await stage('like');

  // ---------------------------------------------------------- 6. my own garden
  await clickSel('#vcBack'); await waitFor(`window.__game.raw.area === 'campus'`, 12000); await sleep(1200);
  await narrate('garden');
  await cap('Xu from studying pays for your own island', 'crops, fruit trees, a fish tank, animals and a house to furnish');
  await clickSel('#vcGarden'); await waitFor(`window.__game.raw.area === 'garden'`, 12000); await sleep(3500);
  await stage('mygarden');
  await walkTo(-412, 1); await walkTo(-422, 1);
  await narrate('garden2');
  await cap('Plants grow in real time: harvest, then plant again');
  await walkTo(-422, 8); await sleep(500);
  log('hint', await G(`return G.state().hint;`));
  await G(`G.nhanE(); return 1;`); await sleep(3400);
  await stage('harvest');
  await walkTo(-426, 8.4); await sleep(500); log('hint', await G(`return G.state().hint;`)); await G(`G.nhanE(); return 1;`); await waitFor(`!document.querySelector('#vcSeeds').classList.contains('hidden')`, 5000); await sleep(900);
  await clickSel('#vcSeeds [data-seed]'); await sleep(2600);
  await stage('plant');

  // ---------------------------------------------------------- 7. the Quiet Forest
  await clickSel('#vcGarden'); await waitFor(`window.__game.raw.area === 'campus'`, 12000); await sleep(900);
  await narrate('forest');
  await cap('The Quiet Forest: fishing, a café and +25% study Xu', 'through the east gate of the plaza');
  await G(`G.toiKhu('rung'); return 1;`); await sleep(2400);
  await walkTo(W.gate.x + 14, W.gate.z + 1, 9000); await sleep(600);
  await stage('forest-gate');
  log('forest', JSON.stringify(await G(`return { area: G.raw.area, me: [G.me.x, G.me.z], spots: G.WORLD.fishSpots.map((s) => [Math.round(s.x), Math.round(s.z), s.kind]) };`)));
  const spot = await G(`const s = G.WORLD.fishSpots.filter((s) => s.kind === 'lake').sort((a, b) => Math.hypot(a.x - G.me.x, a.z - G.me.z) - Math.hypot(b.x - G.me.x, b.z - G.me.z))[0]; return { x: s.x, z: s.z };`);
  await walkTo(spot.x, spot.z, 16000); await sleep(600);
  await stage('forest-lake');
  log('lake hint', await G(`return G.state().hint;`));

  // ---------------------------------------------------------- 8. the end card
  await voiceDone();
  await cap('');
  await narrate('end');
  await ev(`const e = document.getElementById('demo-end'); e.innerHTML = '<h1>Common Area</h1><p>Study, play and hang out together.</p><b>common-area.onrender.com</b><p style="font-size:20px;opacity:.8">In any browser, and as an Android app</p>'; e.classList.add('on'); document.getElementById('demo-cur').style.display = 'none'; return 1;`);
  await voiceDone(1200);
  await stage('end');
} catch (e) { if (e.message !== 'STOP') { console.error(e); try { await page.shot(shots + '/zz-error.jpg'); } catch {} } }
cards.stop = true; cards.end = true;
if (REC) { try { await page.send('Page.stopScreencast'); } catch {} await sleep(300); fs.writeFileSync(frames + '/list.tsv', list.join('\n') + '\n'); log('frames', n);
  try { // the game's own sound, as 16-bit stereo PCM per audio context, + when everything happened
    const recs = await ev(`window.__rec.on = false; return window.__rec.list.map((r) => ({ rate: r.rate, t0: r.t0, blocks: r.chunks.length / 2 }));`);
    timeline.game = [];
    for (let k = 0; k < recs.length; k++) { if (!recs[k].blocks) continue; const parts = [];
      for (let i = 0; ; i++) { const b64 = await ev(`return window.__recDump(${k}, ${i}, 150);`); if (!b64) break; parts.push(Buffer.from(b64, 'base64')); }
      const file = `${frames}/game-${k}.pcm`; fs.writeFileSync(file, Buffer.concat(parts)); timeline.game.push({ file, rate: recs[k].rate, t0: recs[k].t0 }); }
    timeline.walk = await ev(`return window.__walk;`);
    timeline.videoT0 = Math.round(parseFloat(list[0]) * 1000); timeline.videoEnd = Math.round(parseFloat(list[list.length - 1]) * 1000);
    fs.writeFileSync(frames + '/timeline.json', JSON.stringify(timeline));
    log('sound: game recordings', timeline.game.map((g) => (fs.statSync(g.file).size / 4 / g.rate).toFixed(1) + ' s').join(', ') || 'none', '| spoken lines', timeline.voice.length, '| clicks', timeline.clicks.length, '| walk changes', timeline.walk.length);
  } catch (e) { console.error('sound capture failed', e); }
}
for (const k in P) P[k].close();
await page.close(); process.exit(0);
