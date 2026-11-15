// Combined game — main loop, camera, input and HUD (from Top1Server's ui.js), wired to:
//   • campus-export: customizable character, emotes + jump, closed rooms with room plug-ins (cinema)
//   • campus-game v4 + v5: rules (shared/room.js), Xu, shop, farm island, fishing, market… (features.js / world2.js / farm3d.js)
// The map rules stay in logic.js; the shared game rules run on the Node server or, in solo mode, in this browser.
import * as THREE from 'three';
import * as L from './logic.js';
import { dungTheGioi } from './world.js';
import { makeAvatar, DEFAULT_LOOK } from './avatar.js';
import { createCustomizer } from './customize.js';
import { createNet } from './net.js';
import { createPlayers } from './players.js';
import { createChat, createMusic, createSocial } from './hud.js';
import { createEmoteWheel } from './emotes.js';
import { toast, createPanel } from './panels.js';
import { $, qs, el, esc } from './util.js';
import { makeKit } from './v4kit.js';
import { buildExtras } from './world2.js';
import { initFeatures } from './features.js';
import { createCss3dLayer } from './css3d.js';
import { createModal } from './modal.js';
import { ROOM_MODULES } from './rooms/index.js';

const { PHONG, KHU, KHU_PHU, BAN_DO, MAU_NHAN_VAT } = L;
const Room = window.CampusRoom;
const WORLD = Room.setMap(L);
const VC = L.vatCanTatCa(); // every obstacle; v4 scenery adds its own to this same list

// ---------------------------------------------------------------- saved name / look / token (this browser only)
const KHOA = 'top1server';
const kho = {
  doc() { try { return JSON.parse(localStorage.getItem(KHOA)) || {}; } catch { return {}; } },
  ghi(d) { try { localStorage.setItem(KHOA, JSON.stringify(d)); } catch { /* storage blocked: play on, just not remembered */ } },
};
const luu0 = kho.doc();
const hex = (n) => [...crypto.getRandomValues(new Uint8Array(n))].map((b) => b.toString(16).padStart(2, '0')).join('');
const profile = {
  name: typeof luu0.ten === 'string' && L.kiemTraTen(luu0.ten).ok ? L.kiemTraTen(luu0.ten).ten : '',
  look: Room.fixLook({ ...DEFAULT_LOOK, ...(luu0.look || {}) }),
  token: /^[a-f0-9]{16,40}$/.test(luu0.token) ? luu0.token : hex(12), // random id of this browser's wallet + garden (no account)
};
const luuNgay = () => kho.ghi({ ten: profile.name, look: profile.look, token: profile.token });

// v4's client state (features.js reads it) + Top1's screen / zone fields
const state = {
  screen: 'vao-game', room: 'chung', fps: 0,
  players: new Map(), me: null, area: 'campus', profile: null, trash: [], carry: 0, market: [], merchant: null, current: null, seats: {},
  selectedPlayer: null, selectedZone: null, visit: null, isAdmin: false, cinemaPlaying: false, emote: null, online: 0, cap: 100,
  uiLock: false, // a room activity window (game, astrology reading) is open: keys do not move the character
};
let ME = null;          // my own record in state.players
let R = null;           // renderer, scene, camera, world, my avatar…
let F = null;           // campus-game-v4 features
let net = null; let players = null; let chat = null; let music = null; let social = null; let css3d = null;
const rooms = {};       // room plug-in instances by room id
const audio = { ctx: null, muted: false, unlock() { if (!this.ctx) { try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { /* no sound */ } } this.ctx?.resume?.(); } };

function coWebGL() {
  if (new URLSearchParams(location.search).has('thu-loi-webgl')) return false;
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
}

// ================================================================ ENTRY SCREEN
const oTen = $('ten'); oTen.value = profile.name;
const bangMau = $('bang-mau');
MAU_NHAN_VAT.forEach((m, i) => {
  const b = el('button', { class: 'o-mau', type: 'button', 'aria-label': `Colour ${i + 1}`, onclick: () => { datLook({ ...profile.look, outfit: m.toLowerCase() }); customizer.setLook(profile.look); } });
  b.style.setProperty('--c', m); b.dataset.mau = m.toLowerCase(); bangMau.append(b);
});
const capNhatMau = () => { for (const b of bangMau.children) b.setAttribute('aria-pressed', String(b.dataset.mau === profile.look.outfit.toLowerCase())); };

let xemTruoc = null; // { renderer, scene, camera, nv, nhay }
function moXemTruoc() {
  const canvas = $('xem-truoc');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50); camera.position.set(0, 1.9, 6.6); camera.lookAt(0, 0.85, 0);
  scene.add(new THREE.HemisphereLight('#FFFFFF', '#B9A6D6', 2.2));
  const sun = new THREE.DirectionalLight('#FFF1DA', 2.2); sun.position.set(2, 4, 3); scene.add(sun);
  const be = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.1, 0.3, 32), new THREE.MeshToonMaterial({ color: '#F3EDE4' })); be.position.y = -0.15; scene.add(be);
  const vien = new THREE.Mesh(new THREE.CylinderGeometry(1.04, 1.14, 0.32, 32), new THREE.MeshBasicMaterial({ color: '#2B1F4D', side: THREE.BackSide })); vien.position.y = -0.15; scene.add(vien);
  const nv = makeAvatar('', profile.look); scene.add(nv);
  xemTruoc = { renderer, scene, camera, nv, nhay: 0 };
  const ve = (t) => {
    if (!xemTruoc) return;
    const w = canvas.clientWidth; const h = canvas.clientHeight;
    if (canvas.width !== Math.floor(w * renderer.getPixelRatio())) { renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
    const s = t / 1000;
    nv.rotation.y = Math.sin(s * 0.8) * 0.6;
    const k = Math.max(0, 1 - (s - xemTruoc.nhay) / 0.45);
    nv.position.y = Math.sin(k * Math.PI) * 0.35 * (k > 0 ? 1 : 0);
    nv.userData.animate(0, 0);
    renderer.render(scene, camera);
    requestAnimationFrame(ve);
  };
  requestAnimationFrame(ve);
}

/** Apply a new look everywhere: entry preview, my avatar in the world, the server. */
let henLook = 0;
function datLook(look, name) {
  profile.look = Room.fixLook(look);
  if (name !== undefined && L.kiemTraTen(name).ok) { profile.name = L.kiemTraTen(name).ten; if (!ME) oTen.value = profile.name; }
  capNhatMau(); luuNgay();
  if (xemTruoc) { xemTruoc.nv.userData.build(profile.look, ''); xemTruoc.nhay = performance.now() / 1000; }
  if (ME) {
    ME.look = profile.look; ME.name = profile.name;
    R.nv.userData.build(profile.look, profile.name, { admin: state.isAdmin });
    capNhatChip();
    clearTimeout(henLook); henLook = setTimeout(() => net.send({ type: 'look', look: profile.look, name: profile.name }), 250);
  }
}
const customizer = createCustomizer($('customize'), { look: profile.look, name: profile.name, onChange: (look, name) => datLook(look, name === 'You' ? undefined : name) });
$('nut-tuy-chinh').addEventListener('click', () => { customizer.setName(oTen.value.trim()); customizer.open(); });
oTen.addEventListener('input', () => { const kt = L.kiemTraTen(oTen.value); if (kt.ok) { profile.name = kt.ten; customizer.setName(kt.ten); } });
oTen.addEventListener('keydown', (e) => { if (e.key === 'Enter') $('nut-vao').click(); });
$('nut-vao').addEventListener('click', async () => {
  const kt = L.kiemTraTen(oTen.value); const loi = $('loi-ten');
  if (!kt.ok) { loi.textContent = kt.loi; loi.hidden = false; loi.classList.remove('lac'); void loi.offsetWidth; loi.classList.add('lac'); oTen.focus(); return; }
  loi.hidden = true; oTen.value = kt.ten; profile.name = kt.ten; luuNgay();
  $('nut-vao').disabled = true; $('nut-vao').textContent = 'Entering…';
  try { await batDauChoi(); } catch (e) { console.error(e); $('nut-vao').disabled = false; $('nut-vao').textContent = 'Enter the plaza ▶'; loi.textContent = 'Could not start the game: ' + e.message; loi.hidden = false; }
});

// ================================================================ GAME SCREEN
const phim = { w: false, a: false, s: false, d: false };
const keys = new Set(); // lower-case key names currently held (features.js reads it)
const joy = { on: false, x: 0, z: 0 };
// Top1's diorama camera: tilted, wide. features.js nudges yaw / dist at the forest gate through the same object.
const cam = { yaw: 0, pitch: (42 * Math.PI) / 180, dist: 24, toanCanh: false, nhin: new THREE.Vector3() };
cam.target = cam.nhin;
// Points of view (campus-export): C or the camera button cycles through them. 0 is Top1's diorama camera.
const POV = [{ ten: 'Diorama' }, { ten: 'Third person', dist: 7, pitch: (20 * Math.PI) / 180 }, { ten: 'Top-down', dist: 34, pitch: (88 * Math.PI) / 180 }, { ten: 'First person' }];
cam.mode = 0; cam.fpPitch = -0.1; // first person: looking up / down
// First person works like an FPS: the mouse is captured and moving it turns the view, no click needed (Esc frees it).
const chuotKhoa = () => document.pointerLockElement === $('canh');
function xinKhoaChuot() { if (cam.mode === 3 && !chuotKhoa()) { try { $('canh').requestPointerLock()?.catch?.(() => {}); } catch { /* the view still follows the mouse over the game */ } } }
/** Is a window, panel or text box using the mouse / keyboard right now? */
const dangDungUi = () => state.uiLock || customizer.isOpen() || typing() || wheel?.isOpen || !$('ban-do').hidden || !$('lop-phu').hidden || !!document.querySelector('.vc-panel:not(.hidden), .modal:not(.hidden)');
function doiPov() {
  cam.mode = (cam.mode + 1) % POV.length; cam.toanCanh = false; $('nut-toan-canh').style.background = '';
  cam.dist = POV[cam.mode].dist ?? khoangCam(); cam.fpPitch = -0.1;
  $('tam-ngam').hidden = cam.mode !== 3;
  if (cam.mode === 3) xinKhoaChuot(); else if (document.pointerLockElement) document.exitPointerLock();
  thongBao(cam.mode === 3 ? 'Camera: First person · move the mouse to look, Esc frees it' : 'Camera: ' + POV[cam.mode].ten);
}
const camPhong = () => roomCam && cam.mode === 0; // a room's fixed camera only replaces the default view
const laMayTinh = () => innerWidth >= 1024;
const khoangCam = () => (laMayTinh() ? 38 : innerWidth / innerHeight < 0.75 ? 27 : 24);
const gocCam = () => ((laMayTinh() ? 38 : 42) * Math.PI) / 180;
let yawMuon = 0; let keoCam = false; let roomCam = null; // roomCam = fixed camera of the room you are in (cinema)
let duong = []; let dichNgoi = null; let lanDiCuoi = 0; let tocDoKiemKet = { t: 0, x: 0, z: 0 };
let khongKhi = null; const fpsDem = { n: 0, t0: 0, ds: [] }; let doPhanGiai = Math.min(devicePixelRatio, 2);
let thoiGian = 0; let chatLuong = 1; let lanCham = 0; let batDauLuc = 0; let demKhung = 0;
let vy = 0; let nhayCho = false; let buocPha = 0; let buocLuong = 0; // jump + walk cycle of my avatar
let wheel = null;

// seats: v4 keys "<table>:<index>"; Top1 chair ids map onto them
const SEATS = {}; const GHE_KEY = {};
for (const t of WORLD.tables) t.seats.forEach((s, i) => { const key = `${t.id}:${i}`; SEATS[key] = { ...s, key, table: t, i }; if (s.ghe) GHE_KEY[s.ghe] = key; });

const typing = () => ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
const tenKhu = (id) => (PHONG[id] || KHU_PHU[id]).ten;
const iconKhu = (id) => (PHONG[id] || KHU_PHU[id]).icon;
const tam = new THREE.Vector3();
function project(x, y, z, node, offsetY = 0) {
  tam.set(x, y, z).project(R.camera);
  if (tam.z > 1 || tam.x < -1.2 || tam.x > 1.2 || tam.y < -1.2 || tam.y > 1.2) { node.style.display = 'none'; return false; }
  node.style.display = ''; node.style.left = `${(tam.x + 1) / 2 * innerWidth}px`; node.style.top = `${(1 - tam.y) / 2 * innerHeight + offsetY}px`;
  return true;
}

async function taiFont() {
  const ch = Promise.all([document.fonts.load('800 48px "Baloo 2"'), document.fonts.load('700 20px "Nunito"')]).catch(() => {});
  await Promise.race([ch, new Promise((r) => setTimeout(r, 2500))]);
}

async function batDauChoi() {
  await taiFont();
  audio.unlock();
  const canvas = $('canh');
  // alpha: the cinema's YouTube player sits BEHIND the canvas and shows through a hole (see rooms/cinema.js)
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', alpha: true }); // smooth edges on every screen (it used to be off on Retina screens)
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(doPhanGiai); renderer.setSize(innerWidth, innerHeight, false);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap; // filtered shadow edges; weak machines fall back to the blocky, cheaper kind (doFps)
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.25, 900); // near 0.25 (was 0.1): 2.5x finer depth, so thin ground layers do not flicker when seen from far away
  const hemi = new THREE.HemisphereLight('#EAF4FF', '#9CB98A', 1.25); scene.add(hemi);
  const sun = new THREE.DirectionalLight('#FFF1D6', 1.7);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -36, right: 36, top: 36, bottom: -36, near: 1, far: 120 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);
  const world = await dungTheGioi(scene);

  const nv = makeAvatar(profile.name, profile.look); scene.add(nv);
  const dich = new THREE.Mesh(new THREE.RingGeometry(0.35, 0.5, 28), new THREE.MeshBasicMaterial({ color: '#FFC43D', transparent: true, opacity: 0, depthWrite: false }));
  dich.rotation.x = -Math.PI / 2; dich.position.y = 0.06; scene.add(dich);
  const nen = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), new THREE.MeshBasicMaterial({ visible: false }));
  nen.rotation.x = -Math.PI / 2; scene.add(nen);
  R = { renderer, scene, camera, hemi, sun, world, nv, dich, nen, ray: new THREE.Raycaster() };
  scene.fog = new THREE.Fog('#CDEFD8', 80, 260);
  css3d = createCss3dLayer($('lop-video')); css3d.setSize(innerWidth, innerHeight);

  // ---- network + shared modules
  net = createNet({ Room, L });
  players = createPlayers({ scene, state });
  chat = createChat({ net, state, players });
  music = createMusic({ net, state, audio });
  social = createSocial({ net, state, players });
  state.onAdmin = () => { R.nv.userData.build(profile.look, profile.name, { admin: true }); music.refresh(); };
  wheel = createEmoteWheel({ onPick: choiEmote });

  // ---- campus-game-v4: scenery (world2.js) + gameplay (features.js), drawn with Top1's toon kit
  const kit = makeKit(scene);
  const fctx = {
    scene, camera, sun, WORLD, state, Room, audio, cam, canvas, keys, typing, project, esc, toast,
    $: qs, ...kit, clickable: [], labelsEl: $('labels'),
    send: (m) => net.send(m), me: () => ME, serverNow: () => net.serverNow(),
    addBoxCol: (minX, maxX, minZ, maxZ) => VC.push({ loai: 'hop', x1: minX, x2: maxX, z1: minZ, z2: maxZ }),
    addCircleCol: (x, z, r) => VC.push({ loai: 'tron', x, z, r }),
    addToRoom: (id, o) => world.themVaoPhong(id, o),   // objects that belong inside a closed room
    setView: () => { cam.toanCanh = false; }, setDuck: (k) => music.setDuck(k),
    onArea: (area, prev) => {
      if ((area === 'forest' && prev === 'campus') || (area === 'campus' && prev === 'forest')) { capNhatKhu(); return; } // v5: walking through the forest gate is seamless
      duong = []; dichNgoi = null; R.dich.material.opacity = 0; if (ME) { ME.seat = null; ME.y = 0; R.nv.userData.sitting = false; } $('nut-dung').hidden = true; chat.setSeated(null); capNhatKhu(true); datCamera(1); },
    openCustomizer: () => customizer.open(), openMusic: () => music.open(),
  };
  const extras = buildExtras(fctx);
  F = initFeatures(fctx, extras);

  // ---- room plug-ins (campus-export): one client module per closed room that has something special
  const modal = createModal(state);
  for (const mod of ROOM_MODULES) {
    const room = WORLD.rooms.find((r) => r.id === mod.id);
    if (!room) { console.warn(`Room "${mod.id}" is not on the map`); continue; }
    const b = { minX: room.rect.x1, maxX: room.rect.x2, minZ: room.rect.z1, maxZ: room.rect.z2 };
    rooms[mod.id] = mod.setup({ THREE, scene, room: { ...room, bounds: b }, net, state, ui: { toast, createPanel }, world, css3d, WORLD, me: () => ME, music, modal, players,
      // for rooms with tables (Game Room): walk to a chair and sit down, stand up, walk somewhere
      sitAt: (table, i) => { const key = table + ':' + i; if (!SEATS[key] || !ME) return false; dongBang(); if (ME.seat === key) return true; diToi({ x: SEATS[key].x, z: SEATS[key].z }, key); return true; },
      stand: () => dungLen(), walkTo: (d) => { dongBang(); diToi(d); } });
  }

  ganMang();
  dungBanDo(); dungNhanKhu(); ganDieuKhien(); apDungKichThuoc();
  const client = /; wv\)/.test(navigator.userAgent) ? 'android-app' : matchMedia('(pointer: coarse)').matches && Math.min(innerWidth, innerHeight) < 600 ? 'web-phone' : 'web-desktop'; // for the usage statistics (TRACKING.md)
  state.mode = await net.connect({ type: 'hello', name: profile.name, look: profile.look, token: profile.token, client });
}

// ---------------------------------------------------------------- messages from the rules (server or solo)
function ganMang() {
  net.on('*', (m) => {
    switch (m.type) {
      case 'welcome': {
        state.me = m.you; state.cap = m.cap; state.seats = m.seats || {};
        for (const pub of m.players) { if (pub.id === m.you) ME = players.add(pub, { me: true, obj: R.nv }); else players.add(pub); }
        chat.history(m.chat);
        vaoGame();
        break;
      }
      case 'full': baoLon('The server is full', `All ${m.cap} places are taken. Please try again in a little while.`); break;
      case '_closed': baoLon('Disconnected', 'The connection to the server was lost.', true); break;
      case 'join': players.add(m.player); break;
      case 'leave': players.remove(m.id); if (state.selectedPlayer === m.id) social.close(); break;
      case 'count': state.online = m.n; state.cap = m.cap; capNhatChip(); break;
      case 'moves': players.setMoves(m.list, m.snap); break;
      case 'seat': {
        state.seats = m.seats || {};
        if (m.id === state.me) { if (m.seat) daNgoi(m); else if (ME.seat) roiGhe(); }
        else players.setSeat(m.id, m.seat, m);
        break;
      }
      case 'look': if (m.id === state.me) { if (ME) { ME.name = m.name; capNhatChip(); } } else players.setLook(m.id, m.look, m.name, m.color); break;
      case 'emote': if (m.id !== state.me) players.setEmote(m.id, m.emote); break;
      case 'room': { const rec = state.players.get(m.id); if (rec && !rec.isMe) rec.room = m.room; break; }
      case 'playerAdmin': if (m.id !== state.me) players.setAdmin(m.id); break;
      case 'toast': toast(m.msg, m.kind); break;
    }
    F.onMessage(m); // v4 features: profile, earnings, areas, garden, market…
  });
}

function vaoGame() {
  const p = ME;
  cam.dist = khoangCam(); cam.pitch = gocCam(); yawMuon = cam.yaw = 0;
  R.nv.position.set(p.x, 0, p.z);
  const kk = BAN_DO.khongKhi.chung;
  khongKhi = { tren: new THREE.Color(kk.troi[0]), duoi: new THREE.Color(kk.troi[1]), a: kk.anhSang };
  datCamera(1);
  if (xemTruoc) { xemTruoc.renderer.dispose(); xemTruoc.renderer.forceContextLoss(); xemTruoc = null; }
  $('man-vao-game').hidden = true; $('man-choi').hidden = false; $('chat').hidden = false;
  capNhatChip(); capNhatTenPhong(true);
  state.screen = 'choi';
  chat.system(state.mode === 'solo'
    ? 'Solo mode: no game server was found, so the rules run in this browser and bots keep you company. Start server.mjs with Node.js for real multiplayer.'
    : 'Connected to the game server. Welcome!');
  music.start();
  let daXem = false; try { daXem = localStorage.getItem('top1server-huong-dan') === '1'; } catch { /* show it */ }
  const hd = $('huong-dan');
  hd.querySelector('.cach-di').textContent = laMayTinh() || !('ontouchstart' in window)
    ? 'Walk with W A S D or click the ground. Scroll to zoom, drag to turn the camera.'
    : 'Drag the stick or tap the ground to walk. Drag the screen to turn.';
  hd.hidden = daXem;
  $('da-hieu').addEventListener('click', () => { hd.hidden = true; try { localStorage.setItem('top1server-huong-dan', '1'); } catch { /* ignore */ } });
  let truoc = performance.now();
  const vong = (now) => { const dt = Math.min((now - truoc) / 1000, 0.25); truoc = now; buoc(dt, now / 1000); requestAnimationFrame(vong); };
  requestAnimationFrame(vong);
}

function baoLon(tieuDe, chu, taiLai) {
  const box = $('lop-phu');
  box.replaceChildren(el('div', { class: 'the' }, el('h2', { text: tieuDe }), el('p', { text: chu }), taiLai ? el('button', { class: 'nut', text: 'Reload', onclick: () => location.reload() }) : null));
  box.hidden = false; $('man-vao-game').hidden = true; $('man-choi').hidden = false;
}
function capNhatChip() {
  const chip = $('chip-ten'); chip.querySelector('i').style.setProperty('--c', profile.look.outfit); chip.querySelector('span').textContent = (state.isAdmin ? '★ ' : '') + profile.name;
  $('chip-nguoi').querySelector('span').textContent = `👥 ${state.online}/${state.cap}${state.mode === 'solo' ? ' · solo' : ''}`;
}

// ---------------------------------------------------------------- seats (Top1 chairs + v4 stools / beanbags), rules on the server
function gheGanNhat(maxD = 2.4) {
  let best = null; let bd = maxD;
  for (const key in SEATS) {
    const s = SEATS[key]; const t = s.table;
    if ((t.area || 'campus') !== state.area || (t.room || null) !== (ME.room || null) || state.seats[key]) continue;
    const d = Math.hypot(s.x - ME.x, s.z - ME.z);
    if (d < bd) { bd = d; best = key; }
  }
  return best;
}
function ngoi(key) {
  dichNgoi = null;
  if (state.seats[key] && state.seats[key] !== state.me) { thongBao('That seat is taken'); return; }
  const s = SEATS[key]; net.send({ type: 'sit', table: s.table.id, seat: s.i });
}
function daNgoi(m) { // the server accepted: snap onto the seat
  const p = ME; duong = []; dichNgoi = null; R.dich.material.opacity = 0; dungEmote();
  Object.assign(p, { seat: m.seat, x: m.x, z: m.z, ry: m.ry, y: m.y || 0, moving: false }); vy = 0;
  R.nv.userData.sitting = true; $('nut-dung').hidden = false; bayLen('Seated');
  chat.setSeated(SEATS[m.seat]?.table);
}
function roiGhe() {
  const p = ME; const s = SEATS[p.seat];
  p.seat = null; p.y = 0; R.nv.userData.sitting = false; $('nut-dung').hidden = true; chat.setSeated(null);
  if (s) { const ra = L.buocDi({ x: s.x - Math.sin(s.ry) * 0.7, z: s.z - Math.cos(s.ry) * 0.7 }, null, 0, VC); p.x = ra.x; p.z = ra.z; } // step back off the chair
}
function dungLen() { if (!ME.seat) return; net.send({ type: 'stand' }); roiGhe(); }

// ---------------------------------------------------------------- emotes + jump (campus-export)
function choiEmote(id) {
  if (ME.seat) return toast('Stand up first, then emote.');
  if (state.emote === id) return dungEmote();
  state.emote = id; R.nv.userData.setEmote(id); net.send({ type: 'emote', emote: id });
}
function dungEmote() { if (!state.emote) return; state.emote = null; R.nv.userData.setEmote(null); net.send({ type: 'emote', emote: null }); }

// ---------------------------------------------------------------- zones and closed rooms
function capNhatKhu(ngay) {
  const p = ME; let phong = null; let khu;
  if (state.area === 'garden') khu = 'vuon';
  else if (state.area === 'forest') khu = 'rung';
  else { phong = WORLD.roomAt(p.x, p.z); khu = phong || 'chung'; }
  if (phong !== (p.room || null)) { // walked through a door: show / hide the inside, run the room plug-in
    rooms[p.room]?.setInside(false);
    p.room = phong; R.world.datTrong(phong);
    rooms[phong]?.setInside(true);
    roomCam = rooms[phong]?.camera || null;
    music.setSilenced(!!rooms[phong]?.silencesMusic);
  }
  if (khu !== state.room) { state.room = khu; capNhatTenPhong(ngay); yawMuon = PHONG[khu]?.yawCam ?? 0; if (ngay) cam.yaw = yawMuon; }
}

// ---------------------------------------------------------------- one frame
let guiCuoi = { x: NaN, z: NaN, ry: NaN, y: NaN, mv: -1 }; let guiLuc = 0;
function guiViTri(ep) {
  const p = ME; if (!p || p.seat) return;
  const r2 = (v) => Math.round(v * 100) / 100;
  const x = r2(p.x), z = r2(p.z), ry = r2(p.ry), y = r2((F && F.yOff()) || p.y || 0), mv = p.moving ? 1 : 0; const now = performance.now(); // y: jump, or the height of a cloud island / tower / ride
  if (!ep && (now - guiLuc < 80 || (x === guiCuoi.x && z === guiCuoi.z && ry === guiCuoi.ry && y === guiCuoi.y && mv === guiCuoi.mv))) return;
  guiCuoi = { x, z, ry, y, mv }; guiLuc = now;
  net.send({ type: 'move', x, z, ry, moving: !!mv, y });
}

function buoc(dt, t) {
  thoiGian = t;
  const p = ME;
  const khoa = F.blockMove() || customizer.isOpen() || !$('lop-phu').hidden || wheel.isOpen || state.uiLock; // something has the player's attention
  // 1) input -> direction
  const coPhim = !khoa && !typing() && (phim.w || phim.a || phim.s || phim.d);
  let vao = null; let goc = 0;
  if (coPhim || (joy.on && !khoa)) {
    duong = []; dichNgoi = null;
    if (p.seat) dungLen();
    dungEmote();
    if (coPhim) { vao = phim; goc = cam.yaw; } else {
      const c = Math.cos(cam.yaw); const s = Math.sin(cam.yaw);
      vao = { x: joy.x * c + joy.z * s, z: -joy.x * s + joy.z * c };
    }
  } else if (duong.length && !p.seat && !khoa) {
    const d = duong[0]; const dx = d.x - p.x; const dz = d.z - p.z; const kc = Math.hypot(dx, dz);
    const cuoi = duong.length === 1;
    if (kc < (cuoi ? 0.08 : 0.35)) {
      duong.shift();
      if (!duong.length) { R.dich.material.opacity = 0; if (dichNgoi) ngoi(dichNgoi); }
    } else vao = { x: dx / kc * Math.min(1, kc * 3), z: dz / kc * Math.min(1, kc * 3) };
  }
  // 2) walk + collide (logic.js); v4 keeps you out of the lake; v4 animations (tower, fishing) move you themselves
  if (!p.seat && !F.blockMove()) {
    const moi = L.buocDi(p, vao, dt, F.elevated() ? [] : VC, goc); // v5: on the cloud islands and upstairs only the platforms limit you
    const c = F.constrain(p.x, p.z, moi.x, moi.z);
    const dx = c.x - p.x; const dz = c.z - p.z; const quang = Math.hypot(dx, dz);
    if (quang > 1e-4) {
      p.x = c.x; p.z = c.z; lanDiCuoi = t;
      if (quang > 0.002) p.ry = gocTien(p.ry, Math.atan2(dx, dz), Math.min(1, dt * 14));
    }
    p.moving = t - lanDiCuoi < 0.2 && !!vao;
    if (duong.length) { // stuck on the way (no progress for 1 s) -> give up
      if (t - tocDoKiemKet.t > 1) {
        if (Math.hypot(p.x - tocDoKiemKet.x, p.z - tocDoKiemKet.z) < 0.25) { duong = []; dichNgoi = null; R.dich.material.opacity = 0; }
        tocDoKiemKet = { t, x: p.x, z: p.z };
      }
    } else tocDoKiemKet = { t, x: p.x, z: p.z };
    // jump (Space)
    if (nhayCho && (p.y || 0) <= 0.001) { vy = 7.5; dungEmote(); }
    nhayCho = false;
    if (vy !== 0 || p.y > 0) { vy -= 22 * dt; p.y = (p.y || 0) + vy * dt; if (p.y <= 0) { p.y = 0; vy = 0; } }
  } else if (p.seat) p.moving = false;
  // 3) zone / room
  capNhatKhu();
  if (!keoCam && !camPhong() && cam.mode === 0 && !F.blockMove()) cam.yaw = gocTien(cam.yaw, yawMuon, 1 - Math.exp(-dt * 2.5));
  // 4) my avatar
  const nv = R.nv; const yOff = F.yOff();
  nv.position.set(p.x, yOff || p.y || 0, p.z); nv.rotation.y = p.ry;
  nv.userData.air = !p.seat && !yOff && p.y > 0.08;
  nv.visible = cam.mode !== 3 || cam.toanCanh; // first person: you do not see yourself
  if (document.pointerLockElement && (cam.mode !== 3 || dangDungUi())) document.exitPointerLock(); // windows and panels need the mouse back
  nv.userData.sitting = !!p.seat || p.pose === 'sit'; // v5: p.pose = sitting on a fishing chair, swing or spring rider
  buocLuong += ((p.moving && !p.seat && !p.pose ? 1 : 0) - buocLuong) * Math.min(1, dt * 12);
  if (p.moving) buocPha += dt * 11;
  nv.userData.animate(buocPha, buocLuong);
  if (R.dich.material.opacity > 0 && !duong.length) R.dich.material.opacity = Math.max(0, R.dich.material.opacity - dt * 2.5);
  R.dich.scale.setScalar(1 + Math.sin(t * 6) * 0.08);
  // 5) sky + light follow the zone (Top1), including the v4 forest and garden island
  const kk = BAN_DO.khongKhi[state.room]; const k = 1 - Math.exp(-dt * 3);
  khongKhi.tren.lerp(tam2.set(kk.troi[0]), k); khongKhi.duoi.lerp(tam2.set(kk.troi[1]), k);
  khongKhi.a += (kk.anhSang - khongKhi.a) * k;
  R.world.troi.material.uniforms.tren.value.copy(khongKhi.tren); R.world.troi.material.uniforms.duoi.value.copy(khongKhi.duoi);
  R.hemi.intensity = 1.25 * khongKhi.a; R.sun.intensity = 1.7 * khongKhi.a;
  R.hemi.color.lerp(tam2.set(kk.anh ?? '#EAF4FF'), k);
  R.world.saoPhongMat.opacity = Math.max(0, Math.min(1, (0.85 - khongKhi.a) * 3));
  const xa = R.camera.position.distanceTo(cam.nhin);
  R.scene.fog.color.copy(khongKhi.duoi); R.scene.fog.near = xa * 1.7; R.scene.fog.far = xa * 5;
  const hsl = {}; khongKhi.tren.getHSL(hsl);
  R.world.saoMat.opacity = Math.max(0, Math.min(1, (0.42 - hsl.l) * 4));
  // 6) camera + sun shadow box follow the player
  datCamera(1 - Math.exp(-dt * 9));
  const tb = cam.toanCanh ? tamToanCanh() : p; R.sun.position.set(tb.x - 18, 40, tb.z + 22); R.sun.target.position.set(tb.x, 0, tb.z);
  R.world.capNhat(t, dt, R.camera);
  // 7) Madame Star greets you when you come close (inside her room)
  const npc = BAN_DO.vat.find((v) => v.id === 'ba-dong'); const bc = $('bong-chu');
  if (p.room === 'chiem-tinh' && Math.hypot(p.x - npc.x, p.z - npc.z) <= 3) {
    const s = screenOf('ba-dong');
    if (bc.hidden) { bc.innerHTML = `<b>${esc(npc.ten)}</b><br>${esc(rooms['chiem-tinh']?.greeting?.(profile.name) ?? npc.moTa)}`; bc.hidden = false; }
    bc.style.left = `${Math.round(s.x)}px`; bc.style.top = `${Math.round(s.y - 6)}px`;
  } else if (!bc.hidden) bc.hidden = true;
  // 8) everyone else, rooms, v4 features, HUD
  players.update(dt, performance.now(), F.visible);
  for (const r of Object.values(rooms)) r.update?.(dt, t);
  F.update(dt, t);
  veNhanKhu(); veGoiY();
  guiViTri();
  if (!R.renderer.shadowMap.autoUpdate && (++demKhung % 3 === 0)) R.renderer.shadowMap.needsUpdate = true;
  R.renderer.render(R.scene, R.camera);
  css3d.render(R.camera);
  doFps(t);
}
const tam2 = new THREE.Color();
function gocTien(a, b, k) { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return a + d * k; }

// The resolution never drops below these (in screen points): sharp screens keep at least 1, so the picture is never coarser than the screen's own grid.
const SAN_PG = devicePixelRatio >= 1.5 ? 1 : 0.75; const SAN_PG_CUOI = devicePixelRatio >= 1.5 ? 0.75 : 0.6;
function doFps(t) { // Top1's automatic quality: weak machines get a lower resolution / cheaper shadows to stay above 30 fps
  if (!batDauLuc) batDauLuc = t;
  const nghi = t - (fpsDem.truoc ?? t); fpsDem.truoc = t;
  if (document.hidden || nghi > 0.4) { fpsDem.n = 0; fpsDem.t0 = 0; return; } // the tab was in the background or the page stalled: that says nothing about this computer's speed
  if (t - batDauLuc < 4) return;                                              // the first seconds (building the world, compiling shaders) are always slow
  fpsDem.n++; if (!fpsDem.t0) fpsDem.t0 = t;
  if (t - fpsDem.t0 >= (t - batDauLuc < 6 ? 0.5 : 1)) {
    const f = fpsDem.n / (t - fpsDem.t0); fpsDem.n = 0; fpsDem.t0 = t;
    fpsDem.ds.push(f); if (fpsDem.ds.length > 5) fpsDem.ds.shift();
    state.fps = Math.round(fpsDem.ds.reduce((a, b) => a + b, 0) / fpsDem.ds.length);
    const datPG = () => { R.renderer.setPixelRatio(doPhanGiai); R.renderer.setSize(innerWidth, innerHeight, false); };
    if (f < 29 && doPhanGiai <= SAN_PG && R.sun.shadow.mapSize.x > 1024) {
      R.sun.shadow.mapSize.set(1024, 1024); R.sun.shadow.map?.dispose(); R.sun.shadow.map = null; chatLuong = 2;
      R.renderer.shadowMap.type = THREE.BasicShadowMap; R.scene.traverse((o) => { if (o.material) for (const m of [].concat(o.material)) m.needsUpdate = true; });
    }
    else if (f < 29 && chatLuong === 2 && ++lanCham >= 3 && t - batDauLuc > 8) { R.renderer.shadowMap.autoUpdate = false; Object.assign(R.sun.shadow.camera, { left: -24, right: 24, top: 24, bottom: -24 }); R.sun.shadow.camera.updateProjectionMatrix(); chatLuong = 3; }
    else if (f < 29 && chatLuong === 3 && doPhanGiai > SAN_PG_CUOI && ++lanCham >= 3) { doPhanGiai = SAN_PG_CUOI; datPG(); chatLuong = 4; }
    else if (f < 29 && doPhanGiai > SAN_PG) { doPhanGiai = Math.max(SAN_PG, Math.floor(doPhanGiai * Math.sqrt(f / 34) * 4) / 4); datPG(); }
    else if (f >= 29) { lanCham = 0; if (f > 50 && doPhanGiai < Math.min(devicePixelRatio, 2)) { doPhanGiai = Math.min(Math.min(devicePixelRatio, 2), doPhanGiai + 0.25); datPG(); } } // back up to full sharpness when there is speed to spare
  }
}

function tamToanCanh() { // what the overview looks at: the whole Top1 map, or the v4 area you are in
  if (state.area === 'campus') return { x: 6, z: R.camera.aspect < 1 ? 1 : 8, half: 60 };
  const c = F.areaCenter(); return { x: c.x, z: c.z, half: state.area === 'forest' ? 50 : 26 };
}
function datCamera(k) {
  const p = ME; const c = R.camera; let dich; let nhin;
  if (cam.toanCanh) {
    const o = tamToanCanh(); const tanV = Math.tan(THREE.MathUtils.degToRad(c.fov / 2));
    const dist = Math.max(o.half / tanV, o.half / (tanV * c.aspect)) * (c.aspect < 1 ? 1.0 : 0.92);
    const goc = THREE.MathUtils.degToRad(c.aspect < 1 ? 62 : 38);
    dich = new THREE.Vector3(o.x, Math.sin(goc) * dist, o.z + Math.cos(goc) * dist); nhin = new THREE.Vector3(o.x, 0, o.z);
  } else if (camPhong()) { // campus-export: fixed camera inside a room (the cinema); WASD follows its direction
    dich = roomCam.pos; nhin = roomCam.look; cam.yaw = yawMuon = Math.atan2(roomCam.pos.x - roomCam.look.x, roomCam.pos.z - roomCam.look.z);
  } else if (cam.mode === 3) { // first person: from the character's eyes, looking where the camera is turned
    const y0 = (p.seat ? 1.25 : 1.5) + (p.y || 0) + (F ? F.yOff() : 0);
    dich = new THREE.Vector3(p.x, y0, p.z);
    const cf = Math.cos(cam.fpPitch) * 10;
    nhin = new THREE.Vector3(p.x - Math.sin(cam.yaw) * cf, y0 + Math.sin(cam.fpPitch) * 10, p.z - Math.cos(cam.yaw) * cf);
    k = 1; // no lag when looking around
  } else {
    const pitch = POV[cam.mode].pitch ?? cam.pitch;
    const cp = Math.cos(pitch) * cam.dist; const y0 = 1.0 + (F ? F.yOff() : 0);
    nhin = new THREE.Vector3(p.x, y0, p.z);
    dich = new THREE.Vector3(p.x + Math.sin(cam.yaw) * cp, y0 + Math.sin(pitch) * cam.dist, p.z + Math.cos(cam.yaw) * cp);
  }
  c.position.lerp(dich, k); cam.nhin.lerp(nhin, k); c.lookAt(cam.nhin);
}

// ---------------------------------------------------------------- floating zone labels: name + how many players are there
const NEO_NHAN = { chung: [0, 5.5, -9], 'chiem-tinh': [-19, 7.6, -36], 'tro-choi': [20, 7.6, -40], rung: [66, 8, -22] };
let nhanKhu = [];
function dungNhanKhu() {
  const goc = $('man-choi');
  nhanKhu = [...KHU, 'rung'].map((id) => {
    const node = el('div', { class: 'nhan-khu hud' }); node.dataset.id = id;
    node.innerHTML = `<b>${esc(tenKhu(id))}</b> <span>0 here</span>`; goc.append(node);
    const r = PHONG[id]?.rect; const v = NEO_NHAN[id] ?? [(r.x1 + r.x2) / 2, 7.6, (r.z1 + r.z2) / 2];
    return { id, el: node, so: node.querySelector('span'), diem: new THREE.Vector3(...v), soCu: -1 };
  });
}
function demNguoi() {
  const d = Object.fromEntries([...KHU, 'rung', 'vuon'].map((k) => [k, 0]));
  for (const q of state.players.values()) d[q.area === 'garden' ? 'vuon' : q.area === 'forest' ? 'rung' : (q.room || 'chung')] += 1;
  return d;
}
function veNhanKhu() {
  const d = demNguoi();
  for (const n of nhanKhu) {
    const q = n.diem.clone().project(R.camera);
    const x = (q.x + 1) / 2 * innerWidth; const y = (1 - q.y) / 2 * innerHeight;
    const thay = q.z < 1 && x > -60 && x < innerWidth + 60 && y > -20 && y < innerHeight + 20;
    n.el.hidden = !thay;
    if (thay) n.el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px) translate(-50%, -50%)`;
    if (n.soCu !== d[n.id]) { n.soCu = d[n.id]; n.so.textContent = `${d[n.id]} here`; }
  }
}

// ---------------------------------------------------------------- HUD
function capNhatTenPhong(dau = false) {
  const node = $('ten-phong');
  node.querySelector('img').src = `./assets/icon-${iconKhu(state.room)}.svg`;
  node.querySelector('span').textContent = tenKhu(state.room);
  if (!dau) { node.classList.remove('moi'); void node.offsetWidth; node.classList.add('moi'); }
  const d = demNguoi();
  for (const b of document.querySelectorAll('#ban-do .khu')) {
    const o = b.dataset.id === state.room; b.classList.toggle('dang-o', o);
    b.querySelector('small').textContent = o ? `You are here · ${d[b.dataset.id]} here` : `${d[b.dataset.id]} here · Go`;
  }
}
function dungBanDo() {
  const luoi = qs('#ban-do .luoi'); luoi.innerHTML = '';
  for (const id of [...KHU, 'rung', 'vuon']) {
    const b = el('button', { class: 'nut khu', onclick: () => toiKhu(id) }); b.dataset.id = id;
    b.innerHTML = `<img alt="" src="./assets/icon-${iconKhu(id)}.svg"><span>${esc(tenKhu(id))}<small></small></span>`;
    luoi.append(b);
  }
}
function toiKhu(id) { // jump there with the map (Top1): fade, move, done
  $('ban-do').hidden = true;
  if (id === 'vuon') { qs('#vcGarden')?.click(); return; }
  if (state.area !== 'campus') { toast(state.area === 'garden' ? 'Use "Back to Plaza" first.' : 'Walk back out through the forest gate first.'); return; }
  const mo = $('man-mo'); mo.classList.add('hien');
  setTimeout(() => {
    if (ME.seat) dungLen();
    const den = id === 'rung' ? { x: WORLD.forestGate.x - 9, z: WORLD.forestGate.z } : PHONG[id].xuatHien;
    Object.assign(ME, { x: den.x, z: den.z, y: 0, moving: false }); vy = 0;
    duong = []; dichNgoi = null; dongBang(); guiViTri(true);
    capNhatKhu(true); if (id === 'rung') cam.yaw = yawMuon = -Math.PI / 2;
    datCamera(1);
    setTimeout(() => mo.classList.remove('hien'), 120);
  }, 260);
}
let tbHen = 0;
function thongBao(chu) {
  const node = $('thong-bao'); node.textContent = chu; node.hidden = false; node.style.animation = 'none'; void node.offsetWidth; node.style.animation = '';
  clearTimeout(tbHen); tbHen = setTimeout(() => { node.hidden = true; }, 1800);
}
function bayLen(chu) {
  const s = screenOf('nguoi-choi'); const node = el('div', { class: 'bay-len', text: chu });
  node.style.left = `${s.x}px`; node.style.top = `${s.y - 40}px`; document.body.append(node); setTimeout(() => node.remove(), 950);
}
let bangDangMo = null;
function moBang({ ten, moTa, sapCo, hanhDong }) {
  const b = $('bang-thong-tin');
  $('bang-tieu-de').textContent = ten; $('bang-mo-ta').textContent = moTa ?? '';
  const sc = b.querySelector('.the-sap-co'); sc.hidden = !sapCo; sc.classList.remove('lac'); void sc.offsetWidth; sc.classList.add('lac');
  const nut = $('nut-hanh-dong'); nut.hidden = !hanhDong; if (hanhDong) nut.textContent = hanhDong;
  b.hidden = false; b.style.animation = 'none'; void b.offsetWidth; b.style.animation = '';
  bangDangMo = ten;
}
function dongBang() { $('bang-thong-tin').hidden = true; bangDangMo = null; }

// ---------------------------------------------------------------- E: use what is next to you
const ganVat = (id, r) => { const v = BAN_DO.vat.find((x) => x.id === id); return v && Math.hypot(ME.x - v.x, ME.z - v.z) <= r; };
function nhanE() {
  const p = ME; if (!p) return;
  if (F.interact()) return;                                   // v4 / v5: trash, shops, market, board, fishing, farm, playground, food stands…
  if (F.blockMove()) return;
  if (rooms[p.room]?.interact?.(p)) return;                   // the room you are in: game tables, astrology doors…
  if (p.seat) { dungLen(); return; }
  if (p.room === 'cua-hang' && ganVat('guong', 3.4)) { customizer.open(); return; }                 // wardrobe mirror -> customizer
  if (state.area === 'campus' && !p.room && ganVat('loa-nhac', 3.2)) { music.open(); return; }      // music corner -> shared music
  const key = gheGanNhat(); if (key) { ngoi(key); return; }
}
let goiYCu = '';
function veGoiY() {
  const p = ME; let h = F.hint(p) || rooms[p.room]?.hint?.(p) || '';
  if (!h && !F.blockMove()) {
    if (p.seat) h = '<kbd>E</kbd> or move to stand up';
    else if (p.room === 'cua-hang' && ganVat('guong', 3.4)) h = '<kbd>E</kbd> change your look at the mirror 🎨';
    else if (state.area === 'campus' && !p.room && ganVat('loa-nhac', 3.2)) h = '<kbd>E</kbd> open the shared music 🎵';
    else if (gheGanNhat()) h = '<kbd>E</kbd> sit down';
  }
  if (h !== goiYCu) { goiYCu = h; const node = $('hint'); node.innerHTML = h; node.hidden = !h; }
}

// ---------------------------------------------------------------- clicking the world (Top1): walk there, use gates / chairs / objects
function diToi(diem, ngoiKey = null) {
  if (ME.seat) dungLen();
  duong = L.timDuong(ME, diem); dichNgoi = ngoiKey;
  tocDoKiemKet = { t: thoiGian, x: ME.x, z: ME.z };
  R.dich.position.set(diem.x, 0.06, diem.z); R.dich.material.opacity = 0.95;
}
function cham(x, y) {
  if (F.blockMove()) return;
  R.ray.setFromCamera(new THREE.Vector2((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1), R.camera);
  const pid = players.pick(R.ray);
  if (pid !== null) { social.open(pid); return; }
  social.close();
  const khu = state.area === 'campus' ? (ME.room || 'chung') : null; // only things of the zone you are in can be clicked
  const px = khu ? R.world.proxy.filter((m) => m.userData.khu === khu) : [];
  const hit = R.ray.intersectObjects([...px, R.nen], false)[0];
  if (!hit) return;
  const id = hit.object.userData.id;
  if (!id) { const d = { x: hit.point.x, z: hit.point.z }; if (!L.trongVungDi(d.x, d.z)) return; dongBang(); diToi(d); return; }
  chamVat(id);
}
function chamVat(id) {
  if (rooms[ME.room]?.onClick?.(id)) { dongBang(); return; } // the room you are in may handle a click itself (Madame Star, game tables)
  if (id === 'cong-rung') { dongBang(); diToi({ x: WORLD.forestGate.x, z: WORLD.forestGate.z }); return; } // the east gate: walk up to the forest gate
  if (id.startsWith('cong-')) { dongBang(); diToi(PHONG[id.slice(5)].giua); return; }
  const key = GHE_KEY[id];
  if (key) {
    if (state.seats[key] && state.seats[key] !== state.me) { thongBao('That seat is taken'); return; }
    if (ME.seat === key) return;
    dongBang(); diToi({ x: SEATS[key].x, z: SEATS[key].z }, key); return;
  }
  const ban = BAN_DO.ban.find((b) => b.id === id);
  if (ban) {
    const ghes = BAN_DO.ghe.filter((g) => g.ban === ban.id); const trong = ghes.filter((g) => !state.seats[GHE_KEY[g.id]]).length;
    moBang({ ten: ban.ten, sapCo: ban.sapCo, moTa: `${ban.moTa} Free seats: ${trong}/${ghes.length}.`, hanhDong: null });
    return;
  }
  const v = BAN_DO.vat.find((q) => q.id === id);
  if (v) moBang({ ten: v.ten, moTa: v.moTa, sapCo: v.sapCo });
}

// ---------------------------------------------------------------- controls
function ganDieuKhien() {
  const MAP = { KeyW: 'w', ArrowUp: 'w', KeyA: 'a', ArrowLeft: 'a', KeyS: 's', ArrowDown: 's', KeyD: 'd', ArrowRight: 'd' };
  addEventListener('keydown', (e) => {
    if (!ME || typing() || customizer.isOpen() || state.uiLock) return;
    keys.add(e.key.toLowerCase());
    if (wheel.isOpen) {
      if (e.code === 'Escape' || e.code === 'KeyG') wheel.close();
      else if (/^Digit[1-8]$/.test(e.code)) wheel.pickIndex(Number(e.code.slice(5)) - 1);
      return;
    }
    if (MAP[e.code]) { phim[MAP[e.code]] = true; e.preventDefault(); }
    if (e.repeat) return;
    if (e.code === 'KeyE') nhanE();
    else if (e.code === 'KeyG') wheel.toggle();
    else if (e.code === 'KeyC') doiPov();
    else if (e.code === 'Space') { if (!F.blockMove()) { e.preventDefault(); if (ME.seat) dungLen(); else nhayCho = true; } }
    else if (e.code === 'Enter') { e.preventDefault(); chat.focus(!!ME.seat); }
    else if (e.code === 'KeyM') { $('ban-do').hidden = !$('ban-do').hidden; capNhatTenPhong(true); }
    else if (e.code === 'Escape') { dongBang(); $('ban-do').hidden = true; social.close(); }
  });
  addEventListener('keyup', (e) => { keys.delete(e.key.toLowerCase()); if (MAP[e.code]) phim[MAP[e.code]] = false; });
  addEventListener('blur', () => { phim.w = phim.a = phim.s = phim.d = false; keys.clear(); });
  addEventListener('click', (e) => e.target.closest?.('button')?.blur()); // a focused button would swallow Space / Enter

  const canvas = $('canh'); let keo = null;
  canvas.addEventListener('pointerdown', (e) => { keo = { x: e.clientX, y: e.clientY, yaw: cam.yaw, dang: false, id: e.pointerId }; xinKhoaChuot(); });
  document.addEventListener('mousemove', (e) => { // first person: the view follows the mouse without clicking
    if (!ME || cam.mode !== 3 || cam.toanCanh || dangDungUi()) return;
    if (!chuotKhoa() && e.target !== canvas) return;
    cam.yaw -= e.movementX * 0.0028; yawMuon = cam.yaw;
    cam.fpPitch = Math.max(-1.2, Math.min(1.2, cam.fpPitch - e.movementY * 0.0028));
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!keo || e.pointerId !== keo.id) return;
    const dx = e.clientX - keo.x;
    if (!keo.dang && Math.hypot(dx, e.clientY - keo.y) > 8) { keo.dang = true; try { canvas.setPointerCapture(e.pointerId); } catch { /* synthetic event */ } }
    if (keo.dang && !cam.toanCanh && !camPhong() && cam.mode !== 3) { cam.yaw = keo.yaw - dx * 0.008; yawMuon = cam.yaw; keoCam = true; }
  });
  canvas.addEventListener('pointerup', (e) => { if (keo && (!keo.dang || cam.mode === 3)) { if (chuotKhoa()) cham(innerWidth / 2, innerHeight / 2); else cham(e.clientX, e.clientY); } keo = null; keoCam = false; }); // captured mouse: you click what the dot in the middle points at
  canvas.addEventListener('wheel', (e) => { cam.dist = Math.max(cam.mode === 1 ? 3 : 12, Math.min(70, cam.dist * (e.deltaY > 0 ? 1.1 : 1 / 1.1))); e.preventDefault(); }, { passive: false });

  const js = $('joystick'); const gat = js.querySelector('.nut-gat'); let jsId = null;
  const dat = (e) => {
    const r = js.getBoundingClientRect(); let ox = e.clientX - (r.left + r.width / 2); let oy = e.clientY - (r.top + r.height / 2);
    const l = Math.hypot(ox, oy); const max = 42; if (l > max) { ox = (ox / l) * max; oy = (oy / l) * max; }
    joy.x = ox / max; joy.z = oy / max; joy.on = Math.hypot(joy.x, joy.z) > 0.15; gat.style.transform = `translate(${ox}px, ${oy}px)`;
  };
  js.addEventListener('pointerdown', (e) => { jsId = e.pointerId; try { js.setPointerCapture(e.pointerId); } catch { /* synthetic event */ } dat(e); });
  js.addEventListener('pointermove', (e) => { if (e.pointerId === jsId) dat(e); });
  const tha = () => { jsId = null; joy.on = false; joy.x = joy.z = 0; gat.style.transform = ''; };
  js.addEventListener('pointerup', tha); js.addEventListener('pointercancel', tha);

  $('nut-ban-do').addEventListener('click', () => { $('ban-do').hidden = !$('ban-do').hidden; capNhatTenPhong(true); });
  $('dong-ban-do').addEventListener('click', () => { $('ban-do').hidden = true; });
  $('ban-do').addEventListener('click', (e) => { if (e.target.id === 'ban-do') $('ban-do').hidden = true; });
  $('nut-toan-canh').addEventListener('click', () => { cam.toanCanh = !cam.toanCanh; $('nut-toan-canh').style.background = cam.toanCanh ? 'var(--accent)' : ''; });
  $('nut-pov').addEventListener('click', doiPov);
  $('nut-dung').addEventListener('click', () => { if (ME.seat) dungLen(); });
  $('dong-bang').addEventListener('click', dongBang);
  $('nut-tuy-chinh-2').addEventListener('click', () => { phim.w = phim.a = phim.s = phim.d = false; customizer.setName(profile.name); customizer.open(); });
  $('nut-emote').addEventListener('click', () => wheel.toggle());
  $('nut-nhac').addEventListener('click', () => music.toggle());
  $('nut-chat').addEventListener('click', () => chat.toggle());
  $('nut-admin').addEventListener('click', () => social.adminLogin());
  addEventListener('resize', apDungKichThuoc);
}
function apDungKichThuoc() {
  if (!R) return;
  R.renderer.setSize(innerWidth, innerHeight, false); css3d.setSize(innerWidth, innerHeight);
  R.camera.aspect = innerWidth / innerHeight; R.camera.updateProjectionMatrix(); if (cam.mode === 0) cam.dist = khoangCam(); cam.pitch = gocCam();
  $('joystick').hidden = innerWidth >= 768;
}

// ---------------------------------------------------------------- screen positions (for labels and for testing)
function diemThe(id) {
  if (id === 'nguoi-choi') return tam.set(ME.x, 1.0, ME.z);
  if (id.startsWith('khu-')) { const ph = PHONG[id.slice(4)]; if (!ph) return null; return ph.rect ? tam.set((ph.rect.x1 + ph.rect.x2) / 2, 0, (ph.rect.z1 + ph.rect.z2) / 2) : tam.set(0, 0, 0); }
  if (R.world.vatDiem[id]) return tam.copy(R.world.vatDiem[id]);
  const px = R.world.proxy.find((m) => m.userData.id === id);
  return px ? tam.copy(px.position) : null;
}
function screenOf(id) {
  if (!R) return null; const v = diemThe(id); if (!v) return null;
  R.camera.updateMatrixWorld(); const q = v.clone().project(R.camera);
  const x = (q.x + 1) / 2 * innerWidth; const y = (1 - q.y) / 2 * innerHeight;
  return { x, y, trong: q.z < 1 && x >= 0 && x <= innerWidth && y >= 0 && y <= innerHeight };
}

// ---------------------------------------------------------------- start
if (!coWebGL()) { $('loi-webgl').hidden = false; $('man-vao-game').hidden = true; state.screen = 'loi-webgl'; } else { capNhatMau(); moXemTruoc(); }

// handy in the browser console, and used for quick checks
window.__game = {
  state: () => ({ screen: state.screen, room: state.room, area: state.area, mode: state.mode, fps: state.fps, online: state.online, xu: state.profile?.xu ?? null, seat: ME?.seat ?? null,
    me: ME ? { x: ME.x, z: ME.z, room: ME.room || null, moving: ME.moving } : null, players: state.players.size, bangMo: bangDangMo, hint: goiYCu }),
  screenOf, toiKhu, diToi: (x, z) => diToi({ x, z }), dat: (x, z) => { Object.assign(ME, { x, z }); guiViTri(true); },
  get R() { return R; }, get F() { return F; }, get net() { return net; }, get me() { return ME; }, raw: state, WORLD, rooms, nhanE,
};
