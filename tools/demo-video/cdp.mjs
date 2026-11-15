// A tiny Chrome DevTools Protocol driver (no dependencies): launches a hidden Chrome with its own empty profile and controls one page.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export async function launch({ port = 9333, profile, width = 1280, height = 720 }) {
  fs.rmSync(profile, { recursive: true, force: true });
  const proc = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, `--window-size=${width},${height}`, '--hide-scrollbars', '--mute-audio',
    '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--disable-sync', '--disable-background-networking', '--disable-component-update', '--disable-features=Translate,MediaRouter,OptimizationHints',
    '--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=metal', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
    '--autoplay-policy=no-user-gesture-required', '--force-device-scale-factor=1', 'about:blank'], { stdio: 'ignore' });
  let target = null;
  for (let i = 0; i < 50 && !target; i++) { await sleep(200); try { const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); target = list.find((t) => t.type === 'page'); } catch { /* not up yet */ } }
  if (!target) { proc.kill(); throw new Error('Chrome did not start'); }
  const ws = new WebSocket(target.webSocketDebuggerUrl); await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let seq = 0; const waiting = new Map(); const handlers = {};
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && waiting.has(m.id)) { const { res, rej } = waiting.get(m.id); waiting.delete(m.id); m.error ? rej(new Error(m.error.message)) : res(m.result); } else if (m.method && handlers[m.method]) handlers[m.method](m.params); };
  const send = (method, params = {}) => new Promise((res, rej) => { const id = ++seq; waiting.set(id, { res, rej }); ws.send(JSON.stringify({ id, method, params })); });
  const on = (method, fn) => { handlers[method] = fn; };
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
  const page = {
    send, on, proc,
    async ev(expr) { const r = await send('Runtime.evaluate', { expression: `(async () => { ${expr} })()`, awaitPromise: true, returnByValue: true, userGesture: true }); if (r.exceptionDetails) throw new Error('page: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text)); return r.result.value; },
    async shot(file) { const r = await send('Page.captureScreenshot', { format: 'jpeg', quality: 85 }); fs.writeFileSync(file, Buffer.from(r.data, 'base64')); },
    async mouse(type, x, y, extra = {}) { await send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons: type === 'mouseMoved' ? 0 : 1, clickCount: 1, ...extra }); },
    async key(key, code = key, vk = 0, text) { await send('Input.dispatchKeyEvent', { type: text ? 'keyDown' : 'rawKeyDown', key, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk, text }); await sleep(60); await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk }); },
    async close() { try { await send('Browser.close'); } catch { /* gone */ } await sleep(300); try { proc.kill(); } catch { /* gone */ } },
  };
  return page;
}
