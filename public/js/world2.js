// Scenery from campus-game (v4, updated to v5), drawn with Top1Server's toon kit (v4kit.js).
// Combined game: the shop kiosk and the outdoor lounge screen are gone (Top1's Shop room, Garden Room stall and
// Cinema take over); the forest is built in campus-game's own coordinates inside a group shifted behind Top1's east fence.
// Plaza: forest gate, market board, leaderboard, beanbags, bins, trash, a food cart (v5).
// Forest: lake, mountains, waterfall, winding stream, 8 fishing chairs, study tables with parasols, playground, café (v5).
// Farm island (x≈-400, v5): built in farm3d.js; plots / plants / animals / fish / furniture are drawn by features.js.
import * as THREE from 'three';
import { buildFarm } from './farm3d.js';

export function buildExtras(ctx) {
  const { toon, mesh, box, cyl, sphere, textTexture, gradient, clickable, makeCharacter, WORLD } = ctx;
  // Two frames: the combined map (plaza props, garden island) and v4's forest frame (shifted by WORLD.forestOffset).
  const OFF = WORLD.forestOffset;
  const FG = new THREE.Group(); FG.position.set(OFF.x, 0, OFF.z); ctx.scene.add(FG);
  let scene = ctx.scene; let fx = 0; let fz = 0;
  const frame = (forest) => { scene = forest ? FG : ctx.scene; ctx.setRoot(scene); fx = forest ? OFF.x : 0; fz = forest ? OFF.z : 0; };
  const addBoxCol = (minX, maxX, minZ, maxZ) => ctx.addBoxCol(minX + fx, maxX + fx, minZ + fz, maxZ + fz);
  const addCircleCol = (x, z, r) => ctx.addCircleCol(x + fx, z + fz, r);
  const un = (p) => Object.assign({}, p, { x: p.x - OFF.x, z: p.z - OFF.z }); // combined map -> v4 forest frame
  const PGW = WORLD.playground;
  const WF = { center: un(WORLD.areas.forest.center), lake: un(WORLD.lake),
    tables: WORLD.tables.filter((t) => t.kind === 'grove').map((t) => Object.assign({}, t, { x: t.x - OFF.x, z: t.z - OFF.z, seats: t.seats.map(un) })),
    stream: WORLD.stream.map(([x, z]) => [x - OFF.x, z - OFF.z]),
    fishSpots: WORLD.fishSpots.filter((s) => s.area === 'forest').map((s) => Object.assign(un(s), { bx: s.bx - OFF.x, bz: s.bz - OFF.z })),
    playground: { swing: un(PGW.swing), merry: un(PGW.merry), riders: PGW.riders.map(un), climb: Object.assign(un(PGW.climb), { base: un(PGW.climb.base) }) },
    foodStands: WORLD.foodStands.filter((s) => s.area === 'forest').map((s) => Object.assign(un(s), { front: un(s.front) })) };
  const animated = []; // fn(dt, t)
  const rand = mulberry(7);

  // ---------- small shared builders ----------
  function sign(text, w, h, bg, fg, x, y, z, ry, parent = scene) {
    const tex = textTexture(text, { w: 1024, h: Math.round(1024 * h / w), bg, fg, font: `bold ${Math.round(1024 * h / w * 0.55)}px "Baloo 2", "Nunito", sans-serif` });
    const m = mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshToonMaterial({ map: tex, gradientMap: gradient }), x, y, z);
    m.rotation.y = ry; parent.add(m); return m;
  }
  function roundTree(x, z, s = 1, i = 0, sway = false) {
    const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g);
    cyl(0.3 * s, 0.42 * s, 2.4 * s, '#8d6e63', 0, 1.2 * s, 0, g);
    const top = new THREE.Group(); g.add(top);
    const c = ['#4caf50', '#66bb6a', '#43a047', '#5cb85c'][i % 4];
    sphere(1.8 * s, c, 0, 3.4 * s, 0, top); sphere(1.25 * s, c, 0.9 * s, 4.1 * s, 0.3 * s, top); sphere(1.15 * s, c, -0.8 * s, 4.0 * s, -0.4 * s, top);
    if (sway) animated.push((dt, t) => { const w = ctx.wind ? ctx.wind() : 1; top.rotation.z = Math.sin(t * 0.9 + i) * 0.025 * w; top.rotation.x = Math.cos(t * 0.7 + i * 2) * 0.02 * w; });
    return g;
  }
  function pineTree(x, z, s = 1, i = 0, sway = false) {
    const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g);
    cyl(0.25 * s, 0.35 * s, 1.6 * s, '#6d4c41', 0, 0.8 * s, 0, g);
    const top = new THREE.Group(); g.add(top);
    const c1 = ['#2e7d32', '#388e3c', '#1b5e20'][i % 3];
    [[2.0, 2.6, 2.2], [1.6, 2.2, 3.6], [1.1, 1.8, 4.9]].forEach(([r, h, y]) => { const m = mesh(new THREE.ConeGeometry(r * s, h * s, 8), c1, 0, y * s, 0); top.add(m); });
    if (sway) animated.push((dt, t) => { const w = ctx.wind ? ctx.wind() : 1; top.rotation.z = Math.sin(t * 0.8 + i * 1.3) * 0.02 * w; });
    return g;
  }
  function rock(x, z, s, color = '#9aa5ad', parent = scene) {
    const m = mesh(new THREE.DodecahedronGeometry(s, 0), color, x, s * 0.45, z);
    m.rotation.set(rand() * 3, rand() * 3, rand() * 3); m.scale.y = 0.65; parent.add(m); return m;
  }
  function mountain(x, z, r, h, parent = scene) {
    const g = new THREE.Group(); g.position.set(x, 0, z); parent.add(g);
    const base = mesh(new THREE.ConeGeometry(r, h, 7), '#6aa84f', 0, h / 2, 0); g.add(base);
    const mid = mesh(new THREE.ConeGeometry(r * 0.62, h * 0.62, 7), '#9aa5ad', 0, h * 0.69, 0); mid.rotation.y = 0.4; g.add(mid);
    const cap = mesh(new THREE.ConeGeometry(r * 0.3, h * 0.3, 7), '#ffffff', 0, h * 0.86, 0); cap.rotation.y = 0.8; g.add(cap);
    return g;
  }
  // a wooden arch gate with a sign; facing = direction the sign faces (+x / -z ...)
  function archGate(x, z, alongX, label, bg) {
    const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g);
    if (!alongX) g.rotation.y = Math.PI / 2; // posts spread along z
    const post = (px) => { cyl(0.42, 0.5, 6.6, '#7b5134', px, 3.3, 0, g); for (let i = 0; i < 6; i++) sphere(0.32, i % 2 ? '#43a047' : '#66bb6a', px + (i % 2 ? 0.35 : -0.35), 0.8 + i * 0.95, 0.3, g); };
    post(-3); post(3);
    box(8, 0.7, 0.9, '#8d5a3b', 0, 6.7, 0, g); box(7.2, 0.4, 0.7, '#a0693f', 0, 6.05, 0, g);
    for (let i = -3; i <= 3; i += 1.5) sphere(0.38, '#4caf50', i, 7.1, 0.2, g);
    const s = sign(label, 6.2, 1.1, bg, '#fff8d6', 0, 5.2, 0.48, 0, g);
    const s2 = sign(label, 6.2, 1.1, bg, '#fff8d6', 0, 5.2, -0.48, Math.PI, g);
    // hanging lanterns
    [-2.2, 2.2].forEach((lx) => { box(0.05, 0.6, 0.05, '#4e342e', lx, 5.9 - 0.3, 0.5, g); const l = sphere(0.22, '#ffcc80', lx, 5.3 - 0.4, 0.5, g); l.material = new THREE.MeshBasicMaterial({ color: '#ffe0a3' }); });
    return { g, s, s2 };
  }

  // =====================================================================
  // CAMPUS ADDITIONS
  // =====================================================================
  // --- path from the plaza to the forest gate (v4 frame: its east fence x = 46 is Top1's east fence) ---
  frame(true);
  box(12, 0.24, 3.2, '#d7b98e', 40.2, 0.09, 5, scene, { cast: false }); // only as long as the path from the plaza's east exit (x 34.2 .. 46.2 here)
  for (let x = 35; x < 46; x += 2.2) box(0.9, 0.26, 0.7, '#c4a27a', x + rand() * 0.6, 0.1, 4 + rand() * 2, scene, { cast: false });
  const campusGate = archGate(46.2, 5, false, 'QUIET FOREST', '#2e7d32');
  addCircleCol(46.2, 2, 0.65); addCircleCol(46.2, 8, 0.65);
  // soft green "portal" glow inside the gate
  const portal = mesh(new THREE.PlaneGeometry(5.4, 5.6), new THREE.MeshBasicMaterial({ color: '#b9f6ca', transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide }), 46.9, 2.9, 5, { cast: false, receive: false });
  portal.rotation.y = Math.PI / 2; scene.add(portal);
  animated.push((dt, t) => { portal.material.opacity = 0.2 + Math.sin(t * 1.6) * 0.08; });
  // hedge tunnel behind the gate (outside the campus)
  for (let x = 48; x < 58; x += 2) { box(2.1, 3.2, 1.2, '#2f8f3a', x, 1.6, 1.4); box(2.1, 3.2, 1.2, '#2f8f3a', x, 1.6, 8.6); box(2.1, 0.8, 8.4, '#3c9d45', x, 3.6, 5); }

  // (v4) the real forest now starts right here behind the gate (see FOREST GROVE AREA) — no fake backdrop
  const wfTex = waterTexture();

  frame(false);
  // --- the shopkeeper behind Top1's Shop counter (v4's kiosk keeper) ---
  [[-2.95, 36, -Math.PI / 2, 'cua-hang', '#ff8a65']].forEach(([x, z, ry, room, color], i) => {
    const keeper = makeCharacter(color);
    keeper.position.set(x, 0, z); keeper.rotation.y = ry; ctx.scene.add(keeper); ctx.addToRoom(room, keeper);
    animated.push((dt, t) => { keeper.hoatCanh(t, 'dung'); keeper.rotation.y = ry + Math.sin(t * 0.5 + i) * 0.25; });
  });

  // --- market board (MARKET) next to the shop ---
  const MK = WORLD.market, mk = new THREE.Group(); mk.position.set(MK.x, 0, MK.z); scene.add(mk);
  [-2.6, 2.6].forEach((dx) => box(0.25, 3.6, 0.25, '#6d4c41', dx, 1.8, 0, mk));
  box(5.4, 2.4, 0.22, '#a1887f', 0, 2.1, 0, mk); box(5.7, 0.18, 0.4, '#8d6e63', 0, 3.35, 0, mk);
  const roofM = box(6.2, 0.15, 1.6, '#e65a4f', 0, 3.75, 0.15, mk); roofM.rotation.x = -0.2;
  const notes = ['#fff59d', '#ffffff', '#b2ebf2', '#ffccbc', '#c8e6c9', '#f8bbd0'];
  for (let i = 0; i < 10; i++) { const n = box(0.75, 0.55, 0.03, notes[i % notes.length], -2.0 + (i % 5) * 1.0 + (rand() - 0.5) * 0.2, 2.65 - Math.floor(i / 5) * 0.85, 0.13, mk, { cast: false }); n.rotation.z = (rand() - 0.5) * 0.3; sphere(0.05, '#e53935', n.position.x, n.position.y + 0.22, 0.17, mk); }
  sign('MARKET', 2.2, 0.75, '#e65a4f', '#ffffff', 0, 4.25, 0.2, 0, mk);
  [[-3.6, 1.2], [3.5, 1.4]].forEach(([dx, dz]) => { box(0.9, 0.6, 0.9, '#a1887f', dx, 0.3, dz, mk); sphere(0.18, '#ff8a26', dx - 0.2, 0.7, dz, mk); sphere(0.18, '#7cc84a', dx + 0.2, 0.7, dz, mk); });
  addBoxCol(MK.x - 2.9, MK.x + 2.9, MK.z - 0.4, MK.z + 0.4); addCircleCol(MK.x - 3.6, MK.z + 1.2, 0.6); addCircleCol(MK.x + 3.5, MK.z + 1.4, 0.6);

  // --- weekly leaderboard: "most beautiful garden / fish tank" ---
  const BD = WORLD.board, bd = new THREE.Group(); bd.position.set(BD.x, 0, BD.z); scene.add(bd);
  [-2.2, 2.2].forEach((dx) => box(0.3, 3.4, 0.3, '#5d4037', dx, 1.7, 0, bd));
  box(4.6, 2.6, 0.2, '#283593', 0, 2.2, 0, bd); box(4.9, 0.2, 0.4, '#ffd23f', 0, 3.55, 0, bd);
  sign('🏆 BEST OF THE WEEK', 4.2, 0.8, '#283593', '#ffd23f', 0, 2.95, 0.12, 0, bd);
  sign('🌱 Garden  ·  🐠 Fish Tank', 4.2, 0.6, '#3949ab', '#ffffff', 0, 2.1, 0.12, 0, bd);
  sign('Press E to browse & visit', 4.2, 0.5, '#3949ab', '#c5cae9', 0, 1.45, 0.12, 0, bd);
  const cup = new THREE.Group(); cup.position.set(0, 3.7, 0); bd.add(cup);
  cyl(0.18, 0.28, 0.12, '#ffb300', 0, 0.06, 0, cup); cyl(0.05, 0.05, 0.25, '#ffb300', 0, 0.25, 0, cup); cyl(0.35, 0.15, 0.4, '#ffd23f', 0, 0.55, 0, cup);
  animated.push((dt) => { cup.rotation.y += dt * 0.8; });
  addBoxCol(BD.x - 2.5, BD.x + 2.5, BD.z - 0.4, BD.z + 0.4);

  // --- lounge: beanbags around Top1's Music Corner speaker (v4's big outdoor screen is Top1's Cinema now) ---
  const bagColors = ['#ff7043', '#4dd0e1', '#ffd23f', '#ab47bc', '#66bb6a', '#ec407a', '#42a5f5', '#ffa726'];
  WORLD.tables.find((t) => t.id === 'lounge').seats.forEach((s, i) => {
    const b = sphere(0.78, bagColors[i % 8], s.x, 0.42, s.z); b.scale.set(1, 0.55, 1);
    const back = sphere(0.6, bagColors[i % 8], s.x - Math.sin(s.ry) * 0.55, 0.75, s.z - Math.cos(s.ry) * 0.55); back.scale.set(1.1, 0.8, 0.55); back.rotation.y = s.ry;
  });

  // --- recycle bins ---
  WORLD.bins.forEach((b) => {
    cyl(0.55, 0.48, 1.1, '#2e7d32', b.x, 0.6, b.z); cyl(0.6, 0.6, 0.14, '#1b5e20', b.x, 1.2, b.z);
    const lbl = sign('♻', 0.6, 0.6, '#2e7d32', '#ffffff', b.x, 0.7, b.z + 0.56, 0);
    const lbl2 = sign('♻', 0.6, 0.6, '#2e7d32', '#ffffff', b.x, 0.7, b.z - 0.56, Math.PI);
    addCircleCol(b.x, b.z, 0.6);
  });

  // --- trash pieces (server-controlled list) ---
  const trashObjs = new Map();
  function makeTrash(kind) {
    const g = new THREE.Group();
    if (kind === 'can') { const c = cyl(0.14, 0.14, 0.36, '#e53935', 0, 0.14, 0, g); c.rotation.z = Math.PI / 2; cyl(0.142, 0.142, 0.06, '#cfd8dc', 0.15, 0.14, 0, g).rotation.z = Math.PI / 2; }
    else if (kind === 'paper') { const p = mesh(new THREE.IcosahedronGeometry(0.22, 0), '#fafafa', 0, 0.18, 0); g.add(p); }
    else if (kind === 'bottle') { const c = cyl(0.12, 0.12, 0.42, '#66bb6a', 0, 0.12, 0, g); c.rotation.z = Math.PI / 2; const n = cyl(0.05, 0.08, 0.16, '#66bb6a', 0.28, 0.12, 0, g); n.rotation.z = Math.PI / 2; }
    else { const p = box(0.4, 0.28, 0.3, '#a1887f', 0, 0.16, 0, g); p.rotation.y = 0.4; }
    const glow = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.55, 20), new THREE.MeshBasicMaterial({ color: '#fff59d', transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false }));
    glow.rotation.x = -Math.PI / 2; glow.position.y = 0.2; g.add(glow); g.userData.glow = glow;
    return g;
  }
  function setTrash(list) {
    const keep = new Set(list.map((t) => t.id));
    for (const [id, o] of trashObjs) if (!keep.has(id)) { scene.remove(o); trashObjs.delete(id); }
    for (const t of list) {
      if (trashObjs.has(t.id)) continue;
      const o = makeTrash(t.kind); o.position.set(t.x, 0.12, t.z); o.rotation.y = t.ry || 0; scene.add(o); trashObjs.set(t.id, o);
    }
  }
  animated.push((dt, t) => { for (const o of trashObjs.values()) { const s = 1 + Math.sin(t * 3 + o.position.x) * 0.12; o.userData.glow.scale.set(s, s, s); o.userData.glow.material.opacity = 0.35 + Math.sin(t * 3) * 0.2; } });

  // =====================================================================
  // FOREST GROVE AREA  (center 100, 0)
  // =====================================================================
  frame(true);
  const F = WF.center, L = WF.lake;
  // forest floor starts right behind the east gate (x 47) — same map as the lobby, slightly darker grass
  const fGround = mesh(new THREE.BoxGeometry(140, 0.08, 170), '#74bf62', 117, 0, F.z, { cast: false });
  scene.add(fGround); clickable.push(fGround);
  // paths (the first one leads from the gate corridor into the grove)
  const pathC = '#d7b98e';
  box(31, 0.06, 2.8, pathC, 62, 0.07, 5, scene, { cast: false });
  box(3.2, 0.06, 26, pathC, 100, 0.03, 26, scene, { cast: false });
  box(26, 0.06, 2.6, pathC, 88, 0.03, 13, scene, { cast: false });
  box(2.6, 0.06, 30, pathC, 76.5, 0.03, -1, scene, { cast: false });
  box(20, 0.06, 2.6, pathC, 110, 0.03, 13, scene, { cast: false });
  // lake
  cyl(L.r + 1.4, L.r + 1.6, 0.12, '#ecd9a0', L.x, 0.05, L.z).castShadow = false;
  const water = mesh(new THREE.CylinderGeometry(L.r, L.r, 0.1, 56), new THREE.MeshToonMaterial({ color: '#4fb8e8', gradientMap: gradient, transparent: true, opacity: 0.93 }), L.x, 0.13, L.z, { cast: false });
  scene.add(water);
  const deep = mesh(new THREE.CylinderGeometry(L.r * 0.6, L.r * 0.6, 0.1, 40), new THREE.MeshToonMaterial({ color: '#3797d1', gradientMap: gradient, transparent: true, opacity: 0.9 }), L.x - 1, 0.14, L.z + 1, { cast: false });
  scene.add(deep);
  // ripples
  const ripples = [];
  for (let i = 0; i < 9; i++) {
    const r = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.62, 28), new THREE.MeshBasicMaterial({ color: '#e1f5fe', transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
    r.rotation.x = -Math.PI / 2; r.position.y = 0.2; scene.add(r); ripples.push({ m: r, life: rand() * 3, max: 3 });
  }
  function placeRipple(rp) {
    if (rand() < 0.4) rp.m.position.set(102 + (rand() - 0.5) * 3, 0.2, -17.6 + rand() * 1.5); // waterfall base
    else { const a = rand() * 6.28, d = rand() * (L.r - 2); rp.m.position.set(L.x + Math.cos(a) * d, 0.2, L.z + Math.sin(a) * d); }
  }
  ripples.forEach(placeRipple);
  animated.push((dt) => { for (const rp of ripples) { rp.life += dt; if (rp.life > rp.max) { rp.life = 0; placeRipple(rp); } const k = rp.life / rp.max; const s = 1 + k * 3.5; rp.m.scale.set(s, s, s); rp.m.material.opacity = (1 - k) * 0.55; } });
  // lily pads, reeds, shore rocks
  for (let i = 0; i < 12; i++) {
    const a = rand() * 6.28, d = 5 + rand() * (L.r - 6.5);
    const x = L.x + Math.cos(a) * d, z = L.z + Math.sin(a) * d;
    if (z > -6 && z < -2 && x > 104) continue; // keep the fishing spot clear
    const pad = cyl(0.75, 0.75, 0.04, '#43a047', x, 0.2, z); pad.castShadow = false;
    if (i % 3 === 0) { const f = sphere(0.2, '#f48fb1', x + 0.2, 0.3, z); f.scale.y = 0.7; }
  }
  for (let i = 0; i < 26; i++) {
    const a = rand() * 6.28; if (Math.abs(a - 0) < 0.35) continue;
    const x = L.x + Math.cos(a) * (L.r + 0.3), z = L.z + Math.sin(a) * (L.r + 0.3);
    if (i % 2) rock(x, z, 0.5 + rand() * 0.6);
    else { for (let k = 0; k < 3; k++) { cyl(0.04, 0.05, 1.6, '#558b2f', x + k * 0.2, 0.8, z + k * 0.15); cyl(0.09, 0.09, 0.35, '#6d4c41', x + k * 0.2, 1.55, z + k * 0.15); } }
  }
  // mountains + cliff + waterfall
  [[102, -33, 12, 20], [87, -31, 9, 14], [117, -32, 9, 15], [132, -25, 7, 10], [70, -27, 7, 11]].forEach(([x, z, r, h]) => { mountain(x, z, r, h); addCircleCol(x, z, r * 0.8); });
  box(7, 8.5, 3.4, '#8d9aa3', 102, 4.25, -21.6); addBoxCol(98.5, 105.5, -23.3, -19.9);
  for (let i = 0; i < 6; i++) rock(98.5 + i * 1.4, -19.6, 0.7 + rand() * 0.5, '#8d9aa3');
  const fallTex = waterTexture();
  const fall = mesh(new THREE.PlaneGeometry(3.4, 8.4), new THREE.MeshBasicMaterial({ map: fallTex, transparent: true, opacity: 0.95 }), 102, 4.3, -19.85, { cast: false, receive: false });
  scene.add(fall);
  const foam = [];
  for (let i = 0; i < 7; i++) { const f = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 8), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.85 })); f.position.set(100.4 + i * 0.55, 0.3, -18.9); scene.add(f); foam.push(f); }
  // stream from the north-east mountain into the lake
  const streamTex = waterTexture();
  const streamPts = [[128, -27], [124, -22], [119, -18], [114, -15]];
  for (let i = 0; i < streamPts.length - 1; i++) {
    const [x1, z1] = streamPts[i], [x2, z2] = streamPts[i + 1];
    const len = Math.hypot(x2 - x1, z2 - z1);
    const seg = mesh(new THREE.PlaneGeometry(2.4, len + 0.6), new THREE.MeshBasicMaterial({ map: streamTex, transparent: true, opacity: 0.9 }), (x1 + x2) / 2, 0.16, (z1 + z2) / 2, { cast: false });
    seg.rotation.x = -Math.PI / 2; seg.rotation.z = Math.atan2(x2 - x1, z2 - z1) + Math.PI; scene.add(seg);
    rock(x1 + 1.5, z1 + 0.5, 0.45); rock(x1 - 1.4, z1 - 0.3, 0.5);
  }
  // little wooden bridge over the stream
  const bridge = new THREE.Group(); bridge.position.set(121.5, 0, -20); bridge.rotation.y = -0.85; scene.add(bridge);
  box(1.8, 0.2, 4, '#a1887f', 0, 0.45, 0, bridge); box(0.12, 0.7, 4, '#8d6e63', 0.85, 0.8, 0, bridge); box(0.12, 0.7, 4, '#8d6e63', -0.85, 0.8, 0, bridge);
  animated.push((dt) => { fallTex.offset.y += dt * 1.4; streamTex.offset.y += dt * 0.7; wfTex.offset.y += dt * 1.2; foam.forEach((f, i) => { const s = 0.8 + Math.abs(Math.sin(performance.now() / 300 + i)) * 0.5; f.scale.set(s, s * 0.6, s); }); });
  // v5: winding stream from the lake to the east edge (shallow, walkable) + a bridge where the path crosses
  const wind = WF.stream;
  for (let i = 0; i < wind.length - 1; i++) {
    const [x1, z1] = wind[i], [x2, z2] = wind[i + 1], len = Math.hypot(x2 - x1, z2 - z1);
    cyl(1.35, 1.35, 0.05, '#ecd9a0', x1, 0.06, z1).castShadow = false;
    const bank = mesh(new THREE.PlaneGeometry(3.4, len + 0.2), '#ecd9a0', (x1 + x2) / 2, 0.07, (z1 + z2) / 2, { cast: false }); bank.rotation.x = -Math.PI / 2; bank.rotation.z = Math.atan2(x2 - x1, z2 - z1) + Math.PI; scene.add(bank);
    const seg = mesh(new THREE.PlaneGeometry(2.2, len + 0.6), new THREE.MeshBasicMaterial({ map: streamTex, transparent: true, opacity: 0.92 }), (x1 + x2) / 2, 0.12, (z1 + z2) / 2, { cast: false });
    seg.rotation.x = -Math.PI / 2; seg.rotation.z = Math.atan2(x2 - x1, z2 - z1) + Math.PI; scene.add(seg);
    const nx = -(z2 - z1) / len, nz = (x2 - x1) / len;
    for (let k = 0; k < 3; k++) { const u = (k + 0.5) / 3, s = rand() < 0.5 ? 1 : -1; rock(x1 + (x2 - x1) * u + nx * 1.6 * s, z1 + (z2 - z1) * u + nz * 1.6 * s, 0.3 + rand() * 0.3); }
  }
  { const br = new THREE.Group(); br.position.set(119.4, 0, 12.8); br.rotation.y = 0.9; scene.add(br);
    box(2.0, 0.2, 4.2, '#a1887f', 0, 0.35, 0, br); [-0.95, 0.95].forEach((dx) => { box(0.1, 0.7, 4.2, '#8d6e63', dx, 0.75, 0, br); [-1.8, 0, 1.8].forEach((dz) => box(0.14, 0.9, 0.14, '#6d4c41', dx, 0.5, dz, br)); }); }
  // v5: fishing chairs around the lake and along the stream (sit with E, then cast)
  WF.fishSpots.forEach((s, i) => {
    const g = new THREE.Group(); g.position.set(s.x, 0, s.z); g.rotation.y = s.ry; scene.add(g);
    box(0.9, 0.1, 0.8, '#3f51b5', 0, 0.55, 0, g); box(0.9, 0.7, 0.1, '#3f51b5', 0, 0.95, -0.38, g); // folding chair (canvas)
    [[-0.4, -0.35], [0.4, -0.35], [-0.4, 0.35], [0.4, 0.35]].forEach(([dx, dz]) => box(0.06, 0.55, 0.06, '#90a4ae', dx, 0.27, dz, g));
    cyl(0.25, 0.2, 0.4, '#90a4ae', 0.75, 0.2, 0.1, g); cyl(0.2, 0.2, 0.02, '#4fc3f7', 0.75, 0.39, 0.1, g); // bait bucket
    box(0.5, 0.25, 0.32, '#2e7d32', -0.75, 0.12, 0.1, g); // tackle box
    if (i % 2 === 0) { cyl(0.04, 0.04, 2.6, '#eceff1', -0.5, 1.3, -0.5, g); const um = mesh(new THREE.ConeGeometry(1.3, 0.6, 8), i % 4 ? '#ffb300' : '#e53935', -0.5, 2.6, -0.5); g.add(um); }
  });
  sign('🎣 FISHING LAKE · sit down, press E', 4.2, 0.6, '#0277bd', '#ffffff', 88.6, 1.9, 5.2, Math.PI * 0.85);
  box(0.12, 1.7, 0.12, '#6d4c41', 88.6, 0.85, 5.2);
  // study tables (square table + tree-stump stools + lantern + v5 parasol, lamp, books, plant)
  WF.tables.forEach((t, i) => {
    cyl(3.7, 3.7, 0.05, '#8fd77a', t.x, 0.03, t.z).castShadow = false;
    box(2.6, 0.2, 2.6, '#a1887f', t.x, 1.05, t.z); box(2.8, 0.06, 2.8, '#8d6e63', t.x, 0.94, t.z);
    cyl(0.32, 0.45, 0.95, '#6d4c41', t.x, 0.47, t.z);
    t.seats.forEach((s) => { cyl(0.45, 0.5, 0.55, '#8d6e63', s.x, 0.27, s.z); cyl(0.43, 0.43, 0.03, '#e0c097', s.x, 0.56, s.z); });
    // books + mug
    box(0.6, 0.12, 0.45, ['#e57373', '#64b5f6', '#ffd54f'][i % 3], t.x - 0.5, 1.21, t.z + 0.3).rotation.y = 0.3;
    box(0.55, 0.1, 0.4, '#81c784', t.x - 0.45, 1.32, t.z + 0.3).rotation.y = 0.1;
    cyl(0.12, 0.1, 0.22, '#ffffff', t.x + 0.6, 1.26, t.z - 0.4);
    // v5: parasol, desk lamp, open notebook, small plant, seat cushions
    cyl(0.05, 0.05, 2.4, '#eceff1', t.x, 2.1, t.z);
    const pc = ['#e53935', '#43a047', '#1e88e5', '#fb8c00', '#8e24aa', '#00897b', '#f06292'][i % 7];
    for (let k = 0; k < 8; k++) { const seg = new THREE.Mesh(new THREE.ConeGeometry(2.0, 0.7, 3, 1, true, k * Math.PI / 4, Math.PI / 4), new THREE.MeshToonMaterial({ color: k % 2 ? '#ffffff' : pc, gradientMap: gradient, side: THREE.DoubleSide })); seg.position.set(t.x, 3.55, t.z); seg.castShadow = true; scene.add(seg); }
    cyl(0.12, 0.16, 0.06, '#37474f', t.x + 0.8, 1.18, t.z + 0.7); cyl(0.025, 0.025, 0.45, '#37474f', t.x + 0.8, 1.4, t.z + 0.7);
    const shade = cyl(0.12, 0.2, 0.18, '#fff59d', t.x + 0.8, 1.66, t.z + 0.7); shade.material = new THREE.MeshBasicMaterial({ color: '#fff59d' });
    box(0.7, 0.03, 0.45, '#ffffff', t.x + 0.1, 1.17, t.z - 0.6).rotation.y = -0.2; box(0.02, 0.031, 0.45, '#9e9e9e', t.x + 0.1, 1.175, t.z - 0.6).rotation.y = -0.2;
    cyl(0.12, 0.1, 0.2, '#d8774a', t.x - 0.85, 1.25, t.z - 0.75); sphere(0.18, '#66bb6a', t.x - 0.85, 1.45, t.z - 0.75);
    t.seats.forEach((s) => cyl(0.36, 0.36, 0.08, pc, s.x, 0.6, s.z));
    // lantern post
    const lx = t.x + 2.9, lz = t.z - 2.9;
    cyl(0.08, 0.1, 2.6, '#4e342e', lx, 1.3, lz); box(0.4, 0.5, 0.4, '#4e342e', lx, 2.75, lz);
    const glow = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.38, 0.3), new THREE.MeshBasicMaterial({ color: '#ffe082' })); glow.position.set(lx, 2.75, lz); scene.add(glow);
    addCircleCol(lx, lz, 0.25);
    addCircleCol(t.x, t.z, 1.55);
  });
  // exit gate back to the main lobby
  // (v4) no separate exit gate any more: the forest is reached / left through the east gate corridor of the lobby
  sign('← BACK TO PLAZA', 3.4, 0.7, '#3f51b5', '#ffffff', 62, 2.6, 1.0, 0);
  box(0.15, 2.4, 0.15, '#6d4c41', 60.4, 1.2, 0.9); box(0.15, 2.4, 0.15, '#6d4c41', 63.6, 1.2, 0.9);
  // trees inside the grove (sway in the wind) + a wall of trees around it
  const groveTrees = [[70, -34], [68, -4], [66, 12], [111, 30], [132, 22], [136, 8], [130, -6], [134, -14],
    [92, 7], [88, -21], [65, 34], [109, 26], [127, 15], [83, -26], [136, -32], [66, -30]]; // v5: trees moved away from the playground / café / fishing chairs
  groveTrees.forEach(([x, z], i) => { (i % 3 === 1 ? pineTree : roundTree)(x, z, 1.25 + (i % 4) * 0.12, i, true); addCircleCol(x, z, 0.7); });
  const ring = [];
  for (let x = 56; x <= 144; x += 4.5) { ring.push([x, -44 + rand() * 3]); ring.push([x, 42 + rand() * 3]); }
  for (let z = -40; z <= 40; z += 4.5) { if (z < -1 || z > 11) ring.push([57 + rand() * 2, z]); ring.push([143 + rand() * 2, z]); }
  // gate corridor (x 47..62, z 2..8) — everything else west of the forest is a wall of trees
  addBoxCol(46.5, 61, -41, 1.2); addBoxCol(46.5, 61, 8.8, 39);
  for (let z = -38; z <= 37; z += 4) { if (z > -2 && z < 12) continue; ring.push([50 + rand() * 2, z]); }
  instancedTrees(ring, 1.6);
  // bushes, flowers, mushrooms, grass
  for (let i = 0; i < 40; i++) {
    const x = 64 + rand() * 72, z = -36 + rand() * 72;
    if (Math.hypot(x - L.x, z - L.z) < L.r + 2.5 || nearAny(x, z, 4.2) || (x > 97 && x < 103 && z > 12) || (x < 80 && Math.abs(z - 5) < 4)) continue;
    const c = ['#388e3c', '#43a047', '#2e7d32'][i % 3];
    sphere(0.8, c, x, 0.5, z); sphere(0.6, c, x + 0.7, 0.4, z + 0.2);
    if (i % 4 === 0) { cyl(0.1, 0.12, 0.45, '#fff3e0', x + 1.3, 0.22, z - 0.4); const cap = sphere(0.32, '#e53935', x + 1.3, 0.5, z - 0.4); cap.scale.y = 0.6; }
  }
  const flowerSpots = [];
  for (let i = 0; i < 160; i++) {
    const x = 64 + rand() * 72, z = -36 + rand() * 72;
    if (Math.hypot(x - L.x, z - L.z) < L.r + 1.8) continue;
    flowerSpots.push([x, z]);
  }
  instancedDots(flowerSpots, 0.16, ['#ff6f91', '#ffd23f', '#ffffff', '#ab47bc', '#4fc3f7'], 0.25);
  const tufts = [];
  for (let i = 0; i < 260; i++) { const x = 62 + rand() * 76, z = -38 + rand() * 76; if (Math.hypot(x - L.x, z - L.z) < L.r + 1.5) continue; tufts.push([x, z]); }
  instancedCones(tufts);
  // butterflies
  for (let i = 0; i < 7; i++) {
    const b = new THREE.Group(); scene.add(b);
    const c = ['#ffeb3b', '#ff80ab', '#80d8ff', '#ffffff'][i % 4];
    const wingM = new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide });
    const w1 = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.22), wingM); w1.position.x = 0.14; const p1 = new THREE.Group(); p1.add(w1); b.add(p1);
    const w2 = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.22), wingM); w2.position.x = -0.14; const p2 = new THREE.Group(); p2.add(w2); b.add(p2);
    const cx = 70 + rand() * 60, cz = -10 + rand() * 40, ph = rand() * 6;
    animated.push((dt, t) => {
      const a = t * 0.35 + ph;
      b.position.set(cx + Math.sin(a) * 4, 1.2 + Math.sin(t * 2 + ph) * 0.4, cz + Math.sin(a * 2) * 2.5);
      b.rotation.y = Math.atan2(Math.cos(a) * 4, Math.cos(a * 2) * 5);
      const f = Math.sin(t * 18 + ph) * 1.1; p1.rotation.z = f; p2.rotation.z = -f;
    });
  }
  // drifting leaves + floating pollen around the player while in the forest
  const leafCount = 70;
  const leaves = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.22, 0.14), new THREE.MeshBasicMaterial({ color: '#9ccc65', side: THREE.DoubleSide }), leafCount);
  leaves.frustumCulled = false; scene.add(leaves);
  const leafData = [];
  for (let i = 0; i < leafCount; i++) leafData.push({ x: F.x + (rand() - 0.5) * 60, y: rand() * 10, z: F.z + (rand() - 0.5) * 60, s: 0.4 + rand() * 0.6, ph: rand() * 6 });
  ['#9ccc65', '#ffca28', '#8bc34a', '#ff9800'].forEach(() => {});
  const lc = new THREE.Color();
  for (let i = 0; i < leafCount; i++) leaves.setColorAt(i, lc.set(['#9ccc65', '#ffca28', '#8bc34a', '#ffa726'][i % 4]));
  const dummy = new THREE.Object3D();
  const pollenGeo = new THREE.BufferGeometry();
  const pollenPos = new Float32Array(150 * 3);
  for (let i = 0; i < 150; i++) { pollenPos[i * 3] = 64 + rand() * 72; pollenPos[i * 3 + 1] = 0.5 + rand() * 3; pollenPos[i * 3 + 2] = -36 + rand() * 72; }
  pollenGeo.setAttribute('position', new THREE.BufferAttribute(pollenPos, 3));
  const pollen = new THREE.Points(pollenGeo, new THREE.PointsMaterial({ color: '#fff9c4', size: 0.12, transparent: true, opacity: 0.85 }));
  scene.add(pollen);
  animated.push((dt, t) => {
    const p0 = ctx.me && ctx.me(); const p = p0 && { area: p0.area, x: p0.x - OFF.x, z: p0.z - OFF.z };
    if (!p || p.area !== 'forest') { leaves.visible = false; return; }
    leaves.visible = true;
    const w = ctx.wind ? ctx.wind() : 1;
    for (let i = 0; i < leafCount; i++) {
      const d = leafData[i];
      d.y -= dt * (0.5 + d.s * 0.4); d.x += dt * (0.6 * w + Math.sin(t + d.ph) * 0.4); d.z += dt * Math.cos(t * 0.7 + d.ph) * 0.3;
      if (d.y < 0.05 || Math.abs(d.x - p.x) > 32 || Math.abs(d.z - p.z) > 32) { d.x = p.x + (rand() - 0.5) * 50; d.z = p.z + (rand() - 0.5) * 50; d.y = 7 + rand() * 5; }
      dummy.position.set(d.x, d.y, d.z); dummy.rotation.set(t * 2 + d.ph, t * 1.3 + d.ph, Math.sin(t * 3 + d.ph)); dummy.scale.setScalar(d.s + 0.5);
      dummy.updateMatrix(); leaves.setMatrixAt(i, dummy.matrix);
    }
    leaves.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < 150; i++) pollenPos[i * 3 + 1] += Math.sin(t * 0.8 + i) * dt * 0.15;
    pollenGeo.attributes.position.needsUpdate = true;
  });
  // god rays in the clearing
  for (let i = 0; i < 4; i++) {
    const ray = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 18), new THREE.MeshBasicMaterial({ color: '#fffde7', transparent: true, opacity: 0.07, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
    ray.position.set(88 + i * 7, 7, 4 - i * 3); ray.rotation.set(0, 0.6, 0.45); scene.add(ray);
  }

  // =====================================================================
  // FOREST v5: playground, Forest Café, food carts (+ one on the plaza)
  // =====================================================================
  const PG = WF.playground, play = {};
  [[70, 22, 7.5, '#ffcc80'], [77, 25, 3.2, '#80cbc4'], [71, 30, 3.4, '#f48fb1']].forEach(([x, z, r, c]) => { cyl(r, r, 0.05, c, x, 0.06, z).castShadow = false; });
  { // swing set: A-frame with 2 swings (each swing: pivot group at the top bar; the seat hangs 2.4 m below)
    const S = PG.swing, top = 3.4; play.swings = [];
    [[-2.2, 1], [2.2, 1]].forEach(([dx]) => { [-0.9, 0.9].forEach((dz) => { const leg = box(0.14, 3.6, 0.14, '#e53935', S.x + dx, top / 2, S.z + dz * 0.9); leg.rotation.x = dz > 0 ? -0.25 : 0.25; }); addCircleCol(S.x + dx, S.z, 0.35); });
    box(4.8, 0.16, 0.16, '#1e88e5', S.x, top, S.z);
    [-0.8, 0.8].forEach((dx) => {
      const piv = new THREE.Group(); piv.position.set(S.x + dx, top, S.z); scene.add(piv);
      [-0.35, 0.35].forEach((o) => box(0.03, 2.4, 0.03, '#9e9e9e', o, -1.2, 0, piv));
      box(0.85, 0.08, 0.45, '#ffd23f', 0, -2.42, 0, piv);
      play.swings.push({ piv, x: S.x + dx + fx, z: S.z + fz, top, len: 2.4 }); // x, z on the combined map (features.js compares them with the player)
    });
  }
  { // merry-go-round
    const M = PG.merry, g = new THREE.Group(); g.position.set(M.x, 0, M.z); scene.add(g);
    cyl(M.r, M.r, 0.2, '#ffd23f', 0, 0.3, 0, g); cyl(0.2, 0.2, 1.6, '#e53935', 0, 1.0, 0, g); cyl(0.6, 0.6, 0.1, '#e53935', 0, 1.8, 0, g);
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; box(0.08, 1.1, 0.08, '#1e88e5', Math.cos(a) * 1.4, 0.95, Math.sin(a) * 1.4, g); const bar = box(1.5, 0.08, 0.08, '#1e88e5', Math.cos(a) * 0.7, 1.5, Math.sin(a) * 0.7, g); bar.rotation.y = -a; }
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; const w = box(0.9, 0.205, 0.3, i % 2 ? '#e53935' : '#43a047', Math.cos(a) * 1.6, 0.31, Math.sin(a) * 1.6, g); w.rotation.y = -a; }
    play.merry = { g, x: M.x + fx, z: M.z + fz, r: M.r, spin: 0.6 };
    animated.push((dt) => { g.rotation.y += dt * play.merry.spin; });
  }
  { // spring riders: a horse and a duck
    play.riders = PG.riders.map((R, i) => {
      const g = new THREE.Group(); g.position.set(R.x, 0, R.z); scene.add(g);
      for (let k = 0; k < 5; k++) cyl(0.18, 0.18, 0.06, '#9e9e9e', 0, 0.12 + k * 0.1, 0, g);
      const body = new THREE.Group(); body.position.y = 0.65; g.add(body);
      const c = i ? '#ffd23f' : '#ef5350';
      const b = sphere(0.45, c, 0, 0.15, 0, body); b.scale.set(0.7, 0.6, 1.2);
      sphere(0.3, c, 0, 0.6, 0.45, body); if (i) { const beak = mesh(new THREE.ConeGeometry(0.12, 0.3, 6), '#ff9800', 0, 0.55, 0.8); beak.rotation.x = Math.PI / 2; body.add(beak); } else { box(0.08, 0.35, 0.3, '#5d4037', 0, 0.85, 0.35, body); }
      [-0.3, 0.3].forEach((dx) => box(0.5, 0.06, 0.12, '#9e9e9e', dx, 0.5, 0.5, body));
      addCircleCol(R.x, R.z, 0.5);
      return { g, body, x: R.x + fx, z: R.z + fz, wob: 0 };
    });
    animated.push((dt, t) => play.riders.forEach((r, i) => { r.body.rotation.x = Math.sin(t * 6 + i) * 0.12 * r.wob; r.body.rotation.z = Math.cos(t * 5 + i) * 0.08 * r.wob; r.wob = Math.max(0.15, r.wob * 0.995); }));
  }
  { // slide (decoration) + sandbox
    const g = new THREE.Group(); g.position.set(79, 0, 19); g.rotation.y = -0.6; scene.add(g);
    [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]].forEach(([dx, dz]) => box(0.12, 2.2, 0.12, '#1e88e5', dx, 1.1, dz, g));
    box(1.4, 0.12, 1.4, '#ffd23f', 0, 2.2, 0, g); const sl = box(0.9, 0.08, 3.2, '#e53935', 0, 1.15, 2.1, g); sl.rotation.x = 0.6;
    for (let y = 0.3; y < 2.2; y += 0.4) box(0.9, 0.06, 0.06, '#9e9e9e', 0, y, -0.75, g);
    addCircleCol(79, 19, 1.0);
    box(3, 0.25, 3, '#ffe0b2', 65.5, 0.12, 27.5); box(3.2, 0.3, 0.15, '#8d6e63', 65.5, 0.15, 26); box(3.2, 0.3, 0.15, '#8d6e63', 65.5, 0.15, 29);
  }
  { // climbing rock pillar with colourful holds; flag on top
    const C2 = PG.climb, g = new THREE.Group(); g.position.set(C2.x, 0, C2.z); scene.add(g);
    const r1 = mesh(new THREE.CylinderGeometry(1.6, 2.2, C2.top, 7), '#8d9aa3', 0, C2.top / 2, 0); g.add(r1);
    box(2.6, 0.25, 2.6, '#a1887f', 0, C2.top + 0.1, 0, g);
    for (let i = 0; i < 18; i++) { const y = 0.5 + (i / 18) * (C2.top - 0.8), a = Math.PI / 2 + (rand() - 0.5) * 1.1; sphere(0.13, ['#e53935', '#43a047', '#1e88e5', '#ffd23f', '#ab47bc'][i % 5], Math.cos(a) * (2.15 - y * 0.09), y, Math.sin(a) * (2.15 - y * 0.09), g); }
    cyl(0.04, 0.04, 2.4, '#eceff1', 0.9, C2.top + 1.3, -0.9, g); const flag = box(0.9, 0.55, 0.03, '#e53935', 1.35, C2.top + 2.2, -0.9, g);
    animated.push((dt, t) => { flag.rotation.y = Math.sin(t * 3) * 0.3; });
    addCircleCol(C2.x, C2.z, 2.3);
    sign('🧗 CLIMBING ROCK · press E', 3.0, 0.5, '#5d4037', '#ffffff', C2.base.x + 1.8, 1.4, C2.base.z + 0.6, 0);
    box(0.1, 1.3, 0.1, '#6d4c41', C2.base.x + 1.8, 0.65, C2.base.z + 0.55);
  }
  sign('🎠 PLAYGROUND', 3, 0.6, '#e53935', '#ffffff', 72, 2.4, 14.6, Math.PI);
  box(0.12, 2.1, 0.12, '#6d4c41', 70.6, 1.05, 14.6); box(0.12, 2.1, 0.12, '#6d4c41', 73.4, 1.05, 14.6);
  // food & drink: café hut + carts (st = a stand in the coordinates of the current frame)
  const stand = (st, kind) => {
    const g = new THREE.Group(); g.position.set(st.x, 0, st.z); g.rotation.y = Math.atan2(st.front.x - st.x, st.front.z - st.z); scene.add(g); // local +z faces the customer
    if (kind === 'cafe') {
      box(8, 3.4, 0.3, '#a1887f', 0, 1.7, -2.4, g); box(0.3, 3.4, 4.8, '#a1887f', -3.9, 1.7, 0, g); box(0.3, 3.4, 4.8, '#a1887f', 3.9, 1.7, 0, g);
      box(7.4, 1.1, 0.8, '#6d4c41', 0, 0.55, 1.3, g); box(7.8, 0.12, 1.1, '#d7ccc8', 0, 1.15, 1.3, g);
      for (let i = 0; i < 9; i++) { const b = box(0.9, 0.12, 2.8, i % 2 ? '#ffffff' : '#00897b', -3.6 + i * 0.9, 3.7, 0.6, g); b.rotation.x = 0.3; }
      for (let i = 0; i < 5; i++) { cyl(0.1, 0.12, 0.25, ['#ffffff', '#8d6e63', '#ffcc80', '#e57373', '#fff59d'][i], -2.4 + i * 1.2, 1.33, 1.3, g); }
      box(2.4, 1.4, 0.08, '#263238', 0, 2.4, -2.2, g);
      [-2.5, 0, 2.5].forEach((dx) => { cyl(0.3, 0.25, 0.08, '#ff7043', dx, 0.75, 2.4, g); cyl(0.05, 0.05, 0.7, '#37474f', dx, 0.37, 2.4, g); });
      // string lights
      for (let i = 0; i < 12; i++) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), new THREE.MeshBasicMaterial({ color: ['#fff59d', '#ffab91', '#80deea'][i % 3] })); l.position.set(-3.8 + i * 0.7, 3.2 - Math.sin(i / 11 * Math.PI) * 0.4, 1.95); g.add(l); }
    } else {
      box(2.4, 1.0, 1.2, kind === 'cartL' ? '#ffb74d' : '#4dd0e1', 0, 0.9, 0, g); box(2.6, 0.1, 1.4, '#ffffff', 0, 1.45, 0, g);
      [-0.9, 0.9].forEach((dx) => { const wh = cyl(0.35, 0.35, 0.12, '#37474f', dx, 0.35, 0.62, g); wh.rotation.x = Math.PI / 2; });
      [-1.1, 1.1].forEach((dx) => box(0.06, 1.4, 0.06, '#eceff1', dx, 2.1, -0.4, g));
      for (let i = 0; i < 5; i++) { const b = box(0.55, 0.08, 1.6, i % 2 ? '#ffffff' : (kind === 'cartL' ? '#e53935' : '#ab47bc'), -1.1 + i * 0.55, 2.85, 0, g); b.rotation.x = 0.15; }
      for (let i = 0; i < 4; i++) sphere(0.13, ['#ffcc80', '#fff59d', '#f48fb1', '#a5d6a7'][i], -0.75 + i * 0.5, 1.6, 0.2, g);
    }
    sign(st.name, kind === 'cafe' ? 3.6 : 3.2, 0.6, kind === 'cafe' ? '#00695c' : '#d84315', '#ffffff', 0, kind === 'cafe' ? 4.4 : 3.3, kind === 'cafe' ? 2.0 : 0.8, 0, g);
    const hw = kind === 'cafe' ? 4.1 : 1.4, hd = kind === 'cafe' ? 2.6 : 0.8;
    const c = Math.abs(Math.cos(g.rotation.y)) > 0.5; addBoxCol(st.x - (c ? hw : hd), st.x + (c ? hw : hd), st.z - (c ? hd : hw), st.z + (c ? hd : hw));
  };
  WF.foodStands.forEach((st) => stand(st, st.id === 'cafe' ? 'cafe' : st.id));

  // =====================================================================
  frame(false);
  stand(WORLD.foodStands.find((s) => s.id === 'cartL'), 'cartL'); // the plaza's food cart
  // FARM ISLAND (v5, center -400, 0) — built in farm3d.js
  // =====================================================================
  const farm = buildFarm(Object.assign({}, ctx, { addBoxCol, addCircleCol }), { sign, roundTree, pineTree, rock, instancedDots, rand, animated });
  const { setGardenOwner, gardenGround, potPositions, setPotLevel } = farm;

  // =====================================================================
  // helpers needing closure
  // =====================================================================
  function nearAny(x, z, d) { // forest frame: keep bushes off the tables, fishing chairs, playground, café and stream
    return WF.tables.some((t) => Math.hypot(x - t.x, z - t.z) < d) || WF.fishSpots.some((s) => Math.hypot(x - s.x, z - s.z) < 3) ||
      (x > 62 && x < 82 && z > 14 && z < 33) || (x > 88 && x < 100 && z > 27) || WF.stream.some(([sx, sz]) => Math.hypot(x - sx, z - sz) < 3);
  }
  function instancedTrees(list, s) {
    const n = list.length;
    const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.35 * s, 0.45 * s, 2.4 * s, 8), toon('#6d4c41'), n);
    const crown = new THREE.InstancedMesh(new THREE.SphereGeometry(2.0 * s, 12, 10), toon('#3d9a45'), n);
    const crown2 = new THREE.InstancedMesh(new THREE.ConeGeometry(2.2 * s, 4.5 * s, 8), toon('#2e7d32'), n);
    const o = new THREE.Object3D();
    list.forEach(([x, z], i) => {
      const k = 0.8 + rand() * 0.5;
      o.position.set(x, 1.2 * s * k, z); o.scale.setScalar(k); o.updateMatrix(); trunk.setMatrixAt(i, o.matrix);
      o.position.set(x, (i % 2 ? 3.6 : 4.2) * s * k, z); o.scale.setScalar(i % 2 ? k : 0.0001); o.updateMatrix(); crown.setMatrixAt(i, o.matrix);
      o.scale.setScalar(i % 2 ? 0.0001 : k); o.updateMatrix(); crown2.setMatrixAt(i, o.matrix);
    });
    [trunk, crown, crown2].forEach((m) => { m.castShadow = true; m.receiveShadow = true; scene.add(m); });
  }
  function instancedDots(list, r, colors, y) {
    const m = new THREE.InstancedMesh(new THREE.SphereGeometry(r, 8, 6), new THREE.MeshToonMaterial({ color: '#ffffff', gradientMap: gradient }), list.length);
    const o = new THREE.Object3D(), c = new THREE.Color();
    list.forEach(([x, z], i) => { o.position.set(x, y, z); o.updateMatrix(); m.setMatrixAt(i, o.matrix); m.setColorAt(i, c.set(colors[i % colors.length])); });
    scene.add(m);
  }
  function instancedCones(list) {
    const m = new THREE.InstancedMesh(new THREE.ConeGeometry(0.16, 0.5, 5), toon('#5fae4f'), list.length);
    const o = new THREE.Object3D();
    list.forEach(([x, z], i) => { o.position.set(x, 0.22, z); o.rotation.set(0, rand() * 3, (rand() - 0.5) * 0.4); o.updateMatrix(); m.setMatrixAt(i, o.matrix); });
    scene.add(m);
  }

  return {
    update(dt, t) {
      for (const f of animated) f(dt, t);
    },
    setTrash, trashObjs, setGardenOwner, gardenGround, potPositions, setPotLevel, farm, play,
    isWater(x, z) { // the forest lake (takes combined-map coordinates). v5: no dock, you fish from the chairs on the shore
      x -= OFF.x; z -= OFF.z;
      return Math.hypot(x - L.x, z - L.z) < L.r - 0.4;
    },
  };
}

// ---------- utils ----------
function mulberry(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function waterTexture() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#7fd3f7'; g.fillRect(0, 0, 64, 256);
  for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(255,255,255,${0.25 + Math.random() * 0.5})`; g.fillRect(Math.random() * 64, Math.random() * 256, 2 + Math.random() * 4, 20 + Math.random() * 50); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
}
function wrap(g, text, x, y, maxW, lh, maxLines) {
  const words = String(text).split(' '); let line = '', n = 0;
  for (let i = 0; i < words.length; i++) {
    const test = line ? line + ' ' + words[i] : words[i];
    if (g.measureText(test).width > maxW && line) { g.fillText(n === maxLines - 1 ? line + '…' : line, x, y + n * lh); n++; line = words[i]; if (n >= maxLines) return; }
    else line = test;
  }
  if (line && n < maxLines) g.fillText(line, x, y + n * lh);
}
