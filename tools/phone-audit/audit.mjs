// Phone layout audit: lists the visible HUD pieces and which of them overlap, in several game states.
import { launch, sleep } from '../demo-video/cdp.mjs';
const [OUT, W, H] = [process.argv[2], +process.argv[3], +process.argv[4]];
const page = await launch({ profile: OUT + '/chrome-profile', width: W, height: H });
await page.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 2, mobile: true });
await page.send('Emulation.setTouchEmulationEnabled', { enabled: true });
await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `try { localStorage.setItem('top1server', JSON.stringify({ ten: 'Tester', token: 'abababababababababababab' })); localStorage.setItem('top1server-huong-dan', '1'); } catch (e) {}` });
await page.send('Page.navigate', { url: 'http://localhost:5183/' }); await sleep(3500);
await page.ev(`document.querySelector('#nut-vao').click(); await new Promise(r => setTimeout(r, 6500)); return 1;`);
const tag = W + 'x' + H;
const AUDIT = `(() => { const sel = ['#chip-ten', '#chip-nguoi', '#ten-phong', '#nut-menu', '#side-left > *', '#side > *', '#chat', '#vcStatus', '#vcBar', '#hint', '#nut-dung', '#joystick', '#bang-thong-tin', '#playerCard', '#vcForestVol', '.cot-phai.mo > .nut:not(#nut-menu)'];
  const items = []; for (const s of sel) document.querySelectorAll(s).forEach((e, i) => { const b = e.getBoundingClientRect(); const cs = getComputedStyle(e); if (b.width < 2 || b.height < 2 || cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) return; items.push({ n: s.replace(' > *', '') + (e.id && !s.includes(e.id) ? ':' + e.id : '') + (s.includes('.nut') ? ':' + e.id : ''), r: [Math.round(b.left), Math.round(b.top), Math.round(b.right), Math.round(b.bottom)] }); });
  const hit = []; for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) { const a = items[i].r, b = items[j].r; const ox = Math.min(a[2], b[2]) - Math.max(a[0], b[0]), oy = Math.min(a[3], b[3]) - Math.max(a[1], b[1]); if (ox > 3 && oy > 3 && !(items[i].n.includes('.nut') && items[j].n.includes('.nut'))) hit.push(items[i].n + ' x ' + items[j].n + ' (' + ox + 'x' + oy + ')'); }
  const off = items.filter((x) => x.r[0] < -1 || x.r[1] < -1 || x.r[2] > innerWidth + 1 || x.r[3] > innerHeight + 1).map((x) => x.n);
  return JSON.stringify({ items: items.map((x) => x.n + ' ' + x.r.join(',')), overlaps: hit, offscreen: off }); })()`;
const audit = async (label) => { const d = JSON.parse(await page.ev(`return ${AUDIT};`)); console.log(`\n[${tag}] ${label}\n  ` + d.items.join('\n  ') + `\n  OVERLAPS: ${d.overlaps.join(' | ') || 'none'}\n  OFF SCREEN: ${d.offscreen.join(', ') || 'none'}`); await page.shot(`${OUT}/${tag}-${label.replace(/\W+/g, '-')}.jpg`); };
const G = (s) => page.ev(`const G = window.__game; const wait = (ms) => new Promise(r => setTimeout(r, ms)); ${s}`);
await audit('plaza idle');
await G(`document.querySelector('#nut-menu').click(); await wait(500); return 1;`); await audit('menu open');
await G(`document.querySelector('#nut-nhac').click(); await wait(600); return 1;`); await audit('music opened from menu'); await G(`document.querySelector('#nut-menu').click(); await wait(300); document.querySelector('#nut-nhac').click(); await wait(400); return 1;`);
await G(`document.querySelector('#vcMore').click(); await wait(500); return 1;`); await audit('bar open');
await G(`const t = G.WORLD.tables.find((x) => x.id === 'ban-hoc-2'); G.dat(t.seats[0].x + 0.5, t.seats[0].z + 0.5); await wait(500); G.net.send({ type: 'sit', table: 'ban-hoc-2', seat: 0 }); await wait(2500); return 1;`); await audit('seated bar open');
await G(`document.querySelector('#vcMore').click(); await wait(500); return 1;`); await audit('seated bar closed');
await G(`G.net.send({ type: 'stand' }); await wait(600); const t = G.WORLD.tables.find((x) => x.id === 'ban-hoc-2'); G.dat(t.seats[1].x + 1.2, t.seats[1].z + 1.2); await wait(1200); return 1;`); await audit('next to a chair');
const tapHint = async (label) => { const h = JSON.parse(await page.ev(`const e = document.querySelector('#hint'); const b = e.getBoundingClientRect(); return JSON.stringify({ text: e.innerText.trim(), button: e.classList.contains('bam'), hidden: e.hidden, x: Math.round(b.left + b.width / 2), y: Math.round(b.top + b.height / 2), h: Math.round(b.height) });`));
  if (!h.hidden && h.button) { await page.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: h.x, y: h.y }] }); await sleep(60); await page.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await sleep(1500); }
  console.log(`  ACTION BUTTON (${label}): "${h.text}" button=${h.button} height=${h.h} -> ` + await G(`return JSON.stringify({ seat: G.me.seat || null, hint: document.querySelector('#hint').hidden ? '(hidden)' : document.querySelector('#hint').innerText.trim(), standUp: !document.querySelector('#nut-dung').hidden, panel: [...document.querySelectorAll('.vc-panel:not(.hidden)')].map((x) => x.id).join(',') });`)); };
await tapHint('chair'); await audit('after tapping sit');
await G(`G.net.send({ type: 'stand' }); await wait(700); return 1;`);
await G(`document.querySelector('#vcGarden').click(); await wait(6500); return 1;`); await audit('my garden');
await G(`G.dat(-422, 8); await wait(1200); return 1;`); await audit('garden at a plot');
await tapHint('plot'); await sleep(2500); await audit('after tapping harvest'); await G(`G.dat(-426, 8.4); await wait(1200); return 1;`); await tapHint('empty plot'); await audit('seed picker');
await page.close();
