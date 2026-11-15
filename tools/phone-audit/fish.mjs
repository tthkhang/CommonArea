// Phone fishing test: sit at the lake, cast, strike and reel with real touch taps; also checks Stand up and the stick.
import { launch, sleep } from '../demo-video/cdp.mjs';
const [OUT, W, H] = [process.argv[2], +process.argv[3], +process.argv[4]];
const page = await launch({ profile: OUT + '/chrome-profile', width: W, height: H });
await page.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 2, mobile: true });
await page.send('Emulation.setTouchEmulationEnabled', { enabled: true });
await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `try { localStorage.setItem('top1server', JSON.stringify({ ten: 'Angler', token: 'cdcdcdcdcdcdcdcdcdcdcdcd' })); localStorage.setItem('top1server-huong-dan', '1'); } catch (e) {}` });
await page.send('Page.navigate', { url: 'http://localhost:5183/' }); await sleep(3500);
const tag = W + 'x' + H; const log = (...a) => console.log(`[${tag}]`, ...a);
const G = (s) => page.ev(`const G = window.__game; const wait = (ms) => new Promise(r => setTimeout(r, ms)); ${s}`);
const tap = async (x, y) => { await page.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] }); await sleep(50); await page.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); };
const center = (sel) => page.ev(`const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const b = e.getBoundingClientRect(); if (!b.width || getComputedStyle(e).display === 'none') return null; return { x: Math.round(b.left + b.width / 2), y: Math.round(b.top + b.height / 2), w: Math.round(b.width), h: Math.round(b.height) };`);
const tapSel = async (sel) => { const c = await center(sel); if (!c) return false; await tap(c.x, c.y); return true; };
const state = () => G(`const q = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return b.width && getComputedStyle(e).display !== 'none' ? e.innerText.trim() || 'shown' : null; }; return JSON.stringify({ reel: q('#vcReel'), meter: q('#vcFish') ? 'shown' : null, standUp: q('#nut-dung'), hint: document.querySelector('#hint').hidden ? null : document.querySelector('#hint').innerText.trim(), bag: G.raw.profile ? G.raw.profile.bag.length : null, stats: G.raw.profile && G.raw.profile.stats.fishCaught });`).then(JSON.parse);
const overlaps = () => page.ev(`const sel = ['#chip-ten', '#chip-nguoi', '#ten-phong', '#nut-menu', '#chat', '#vcBar', '#hint', '#nut-dung', '#vcReel', '#vcFish', '#joystick', '#vcStatus']; const items = sel.map((s) => { const e = document.querySelector(s); if (!e) return null; const cs = getComputedStyle(e); const b = e.getBoundingClientRect(); return b.width > 2 && cs.display !== 'none' && cs.visibility !== 'hidden' ? { s, r: [b.left, b.top, b.right, b.bottom] } : null; }).filter(Boolean); const hit = []; for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) { const a = items[i].r, b = items[j].r; const ox = Math.min(a[2], b[2]) - Math.max(a[0], b[0]), oy = Math.min(a[3], b[3]) - Math.max(a[1], b[1]); if (ox > 3 && oy > 3) hit.push(items[i].s + ' x ' + items[j].s); } return JSON.stringify({ shown: items.map((x) => x.s).join(' '), overlaps: hit });`);
await G(`document.querySelector('#nut-vao').click(); await wait(6500); G.toiKhu('rung'); await wait(2800); return 1;`);
// walk to the nearest lake chair
const spot = await G(`const s = G.WORLD.fishSpots.filter((s) => s.kind === 'lake').sort((a, b) => Math.hypot(a.x - G.me.x, a.z - G.me.z) - Math.hypot(b.x - G.me.x, b.z - G.me.z))[0]; G.diToi(s.x, s.z); return { x: s.x, z: s.z };`);
for (let i = 0; i < 80; i++) { await sleep(300); const d = await G(`return Math.hypot(G.me.x - ${spot.x}, G.me.z - ${spot.z});`); if (d < 0.8) break; }
await sleep(800);
log('at the chair:', JSON.stringify(await state()));
await page.shot(`${OUT}/${tag}-fish-1-near.jpg`);
log('tap hint ->', await tapSel('#hint.bam')); await sleep(1200);
let s = await state(); log('seated:', JSON.stringify(s)); await page.shot(`${OUT}/${tag}-fish-2-seated.jpg`); log('layout:', await overlaps());
// leave with the Stand up button, then sit again
log('tap Stand up ->', await tapSel('#nut-dung')); await sleep(1200); s = await state(); log('after Stand up:', JSON.stringify(s));
log('tap hint again ->', await tapSel('#hint.bam')); await sleep(1200);
// the stick should also get you up from the chair
const stick = await center('#joystick'); await page.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: stick.x, y: stick.y }] }); await sleep(100); await page.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: stick.x + 30, y: stick.y }] }); await sleep(600); await page.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await sleep(800);
s = await state(); log('after pushing the stick:', JSON.stringify(s));
log('sit again ->', await tapSel('#hint.bam')); await sleep(1200);
// cast
log('tap Cast ->', await tapSel('#vcReel')); await sleep(2500); s = await state(); log('waiting:', JSON.stringify(s)); await page.shot(`${OUT}/${tag}-fish-3-waiting.jpg`);
// wait for the bite
let bite = false; const t0 = Date.now();
while (Date.now() - t0 < 70000) { s = await state(); if (s.reel && /STRIKE/.test(s.reel)) { bite = true; break; } await sleep(150); }
log('bite after', ((Date.now() - t0) / 1000).toFixed(1), 's:', bite, JSON.stringify(s));
if (bite) {
  await page.shot(`${OUT}/${tag}-fish-4-bite.jpg`);
  const reaction = 700; await sleep(reaction); // a human takes a moment to react
  log('tap STRIKE ->', await tapSel('#vcReel')); await sleep(600); s = await state(); log('game:', JSON.stringify(s)); log('layout:', await overlaps()); await page.shot(`${OUT}/${tag}-fish-5-game.jpg`);
  let taps = 0, last = null; const t1 = Date.now();
  while (Date.now() - t1 < 45000) { s = await state(); if (!s.meter) break; const g = await G(`const e = document.querySelector('#vcFish .vfish'), z = document.querySelector('#vcFish .vzone'); return e && z ? [parseFloat(e.style.bottom), parseFloat(z.style.bottom), parseFloat(z.style.height)] : null;`); if (g) { const [y, zb, zh] = g; const mid = zb + zh / 2; if (y < mid - 4) { await tapSel('#vcReel'); taps++; } if (taps % 8 === 1) log('  y', y.toFixed(0), 'zone', zb.toFixed(0), '-', (zb + zh).toFixed(0), 'progress', await page.ev(`return document.querySelector('#vcFish .vprog > div').style.height;`)); } await sleep(80); }
  await sleep(1500); s = await state(); log('after reeling:', taps, 'taps in', ((Date.now() - t1) / 1000).toFixed(1), 's ->', JSON.stringify(s)); await page.shot(`${OUT}/${tag}-fish-6-done.jpg`);
}
await page.close();
