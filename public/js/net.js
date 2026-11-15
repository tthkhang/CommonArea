// Connection to the game rules. Two transports with the same messages (as in campus-game-v4):
//   'server'  a WebSocket to the Node server (server.mjs): real multiplayer, rules checked on the server
//   'solo'    no server reachable: the same rules (shared/room.js) run inside this browser, with bots for company
import { startBots } from './bots.js';
import { validBirth } from './astro/birth.js';

export function createNet({ Room, L }) {
  const handlers = new Map();
  let ws = null; let solo = null; let offset = 0;

  const emit = (msg) => {
    if (typeof msg.serverNow === 'number' && (msg.type === 'welcome' || msg.type === 'music')) offset = msg.serverNow - Date.now();
    handlers.get(msg.type)?.forEach((f) => f(msg));
    const dot = msg.type.indexOf('.');
    if (dot > 0) handlers.get(msg.type.slice(0, dot) + '.*')?.forEach((f) => f(msg));
    handlers.get('*')?.forEach((f) => f(msg));
  };

  function startSolo(hello) {
    const ME = 'me'; const out = [];
    const get = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
    const set = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage blocked: play on without saving */ } };
    const testMode = new URLSearchParams(location.search).has('test');
    const store = { // solo mode keeps your Xu / garden in this browser
      load: (tok) => { const pr = get('top1_profile_' + tok); if (pr && testMode && pr.xu < 5000) pr.xu = 5000; return pr; }, // ?test tops up like TEST_MODE=1 on the server
      save: (tok, pr) => set('top1_profile_' + tok, pr),
      loadMeta: (k) => get('top1_meta_' + k),
      saveMeta: (k, v) => set('top1_meta_' + k, v),
    };
    if (new URLSearchParams(location.search).has('test')) Room.Catalog.enableTestMode(); // ?test: 5000 Xu, plants grow 10x faster
    const room = new Room({ cap: 100, store, solo: true, checkBirth: validBirth, checkAdmin: (pw) => pw === 'admin', send: (to, msg) => { if (to == null || to === ME) out.push(msg); } });
    setInterval(() => room.tick(), 100);
    setInterval(() => { for (const m of out.splice(0)) emit(JSON.parse(JSON.stringify(m))); }, 16);
    room.join(ME, hello);
    const bots = new URLSearchParams(location.search).has('nobots') ? null : startBots(room, L);
    solo = { room, bots, send: (m) => room.handle(ME, JSON.parse(JSON.stringify(m))) };
  }

  const net = {
    mode: null,
    /** Register a handler for a message type ('chat'), a room prefix ('xem-phim.*') or everything ('*'). */
    on(type, fn) { if (!handlers.has(type)) handlers.set(type, []); handlers.get(type).push(fn); },
    send(obj) { if (solo) solo.send(obj); else if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj)); },
    serverNow: () => Date.now() + offset,
    get solo() { return solo; },
    /** Join with a hello message. Resolves with 'server' or 'solo'. */
    connect(hello) {
      return new Promise((resolve) => {
        const params = new URLSearchParams(location.search);
        const goSolo = () => { if (net.mode) return; net.mode = 'solo'; startSolo(hello); resolve('solo'); };
        if (!location.protocol.startsWith('http') || params.has('solo')) return goSolo();
        let opened = false;
        try { ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`); } catch { return goSolo(); }
        const timer = setTimeout(() => { if (!opened) { try { ws.close(); } catch { /* ignore */ } ws = null; goSolo(); } }, 2500);
        ws.onopen = () => { opened = true; clearTimeout(timer); net.mode = 'server'; ws.send(JSON.stringify(hello)); resolve('server'); };
        ws.onerror = () => { if (!opened) { clearTimeout(timer); ws = null; goSolo(); } };
        ws.onclose = () => { if (opened) emit({ type: '_closed' }); else { clearTimeout(timer); ws = null; goSolo(); } };
        ws.onmessage = (e) => { let msg; try { msg = JSON.parse(e.data); } catch { return; } if (msg && typeof msg.type === 'string') emit(msg); };
      });
    },
  };
  return net;
}
