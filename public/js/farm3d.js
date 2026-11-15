// Farm island scenery from campus-game v5 (farm-game layout), drawn with Top1's toon kit (v4kit.js):
// tight crop fields, dirt paths with stone edging, wooden fences, hedges, notice board, entrance arch,
// 2-storey house with cut-away, 3-tier cloud flower garden (walkable, see WORLD.garden.levels),
// chicken coop / cow barn / pig sty, round fish tank + feeding tower, orchard, market stall, decorations.
// Dynamic things (soil plots, plants, pots, animals, fish, furniture) are drawn by features.js.
import * as THREE from 'three';

export function buildFarm(ctx, h) {
  const { scene, toon, mesh, box, cyl, sphere, gradient, addBoxCol, addCircleCol, clickable, WORLD } = ctx;
  const { sign, roundTree, pineTree, rock, instancedDots, rand, animated } = h;
  const G = WORLD.areas.garden.center, GB = WORLD.areas.garden.bounds, GW = WORLD.garden;
  const W = GB.maxX - GB.minX, D = GB.maxZ - GB.minZ;

  // ---------- island, sea, grass variation ----------
  const sea = mesh(new THREE.PlaneGeometry(260, 260), new THREE.MeshToonMaterial({ color: '#5ec4ef', gradientMap: gradient }), G.x, -0.35, G.z, { cast: false });
  sea.rotation.x = -Math.PI / 2; scene.add(sea);
  box(W + 7, 0.9, D + 7, '#f2dfa7', G.x, -0.52, G.z, scene, { cast: false });
  const island = mesh(new THREE.BoxGeometry(W + 3, 1, D + 3), '#7dcf63', G.x, -0.45, G.z, { cast: false });
  scene.add(island); clickable.push(island);
  {
    const n = 90, m = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 0.02, 14), new THREE.MeshToonMaterial({ color: '#ffffff', gradientMap: gradient }), n);
    const o = new THREE.Object3D(), c = new THREE.Color();
    for (let i = 0; i < n; i++) { o.position.set(GB.minX + rand() * W, 0.06, GB.minZ + rand() * D); const s = 1.2 + rand() * 2.4; o.scale.set(s, 1, s * (0.6 + rand() * 0.6)); o.updateMatrix(); m.setMatrixAt(i, o.matrix); m.setColorAt(i, c.set(i % 2 ? '#8bdc70' : '#6fc257')); }
    m.receiveShadow = true; scene.add(m);
  }
  // wooden fence around the island
  const woodFence = (x1, z1, x2, z2, color = '#a1724e', posts = '#7b5134', cols = true) => {
    const len = Math.hypot(x2 - x1, z2 - z1), ang = -Math.atan2(z2 - z1, x2 - x1);
    [0.45, 0.85].forEach((y) => { const r = box(len, 0.14, 0.1, color, (x1 + x2) / 2, y, (z1 + z2) / 2); r.rotation.y = ang; });
    for (let i = 0; i <= len + 0.01; i += 1.6) { const t = len ? i / len : 0; box(0.18, 1.15, 0.18, posts, x1 + (x2 - x1) * t, 0.57, z1 + (z2 - z1) * t); }
    if (cols) { const pad = 0.25; addBoxCol(Math.min(x1, x2) - pad, Math.max(x1, x2) + pad, Math.min(z1, z2) - pad, Math.max(z1, z2) + pad); }
  };
  const e = 0.8;
  woodFence(GB.minX - e, GB.minZ - e, GB.maxX + e, GB.minZ - e, '#a1724e', '#7b5134', false); woodFence(GB.minX - e, GB.maxZ + e, GB.maxX + e, GB.maxZ + e, '#a1724e', '#7b5134', false);
  woodFence(GB.minX - e, GB.minZ - e, GB.minX - e, GB.maxZ + e, '#a1724e', '#7b5134', false); woodFence(GB.maxX + e, GB.minZ - e, GB.maxX + e, GB.maxZ + e, '#a1724e', '#7b5134', false);

  // ---------- paths (dirt + stone edging), hedges, lamps ----------
  const path = (x1, z1, x2, z2, w = 2.6) => {
    const horiz = Math.abs(z2 - z1) < 0.01, len = horiz ? Math.abs(x2 - x1) : Math.abs(z2 - z1);
    const cx = (x1 + x2) / 2, cz = (z1 + z2) / 2;
    box(horiz ? len : w, 0.08, horiz ? w : len, '#d9b07a', cx, 0.05, cz, scene, { cast: false });
    for (let i = 0; i <= len; i += 1.1) {
      const t = i - len / 2;
      [-1, 1].forEach((s) => { const st = box(0.5, 0.12, 0.38, rand() < 0.5 ? '#c9c2b3' : '#b5ad9c', horiz ? cx + t : cx + s * (w / 2 + 0.15), 0.07, horiz ? cz + s * (w / 2 + 0.15) : cz + t, scene, { cast: false }); st.rotation.y = rand() * 0.5; });
    }
  };
  path(GW.rack.front.x, -5, GW.rack.front.x, 31.5, 3);         // main north-south path (spawn -> cloud stairs)
  path(-426, 4, -383.5, 4, 3);                                  // east-west path
  path(-425, -18, -425, 4, 2.4);                                // to the house door
  path(-394, -17.5, -394, 4, 2.4);                              // to the pens
  path(-394, -17.5, -366, -17.5, 2.4);                          // along the pens
  path(-400, 12, -371, 12, 2.4);                                // to the orchard
  box(9, 0.09, 6.5, '#e6cfa3', -400, 0.055, 28, scene, { cast: false }); // spawn plaza
  for (let i = 0; i < 18; i++) { const st = box(0.9, 0.1, 0.9, rand() < 0.5 ? '#d8d2c4' : '#c7bfae', -404 + rand() * 8, 0.1, 25.2 + rand() * 5.6, scene, { cast: false }); st.rotation.y = rand() * 3; }
  const hedge = (x1, z1, x2, z2) => {
    const horiz = Math.abs(z2 - z1) < 0.01, len = horiz ? Math.abs(x2 - x1) : Math.abs(z2 - z1);
    const cx = (x1 + x2) / 2, cz = (z1 + z2) / 2;
    box(horiz ? len : 0.9, 0.8, horiz ? 0.9 : len, '#3f9a3a', cx, 0.4, cz);
    for (let i = 0.4; i < len; i += 0.9) sphere(0.5, i % 1.8 < 0.9 ? '#4caf50' : '#43a047', horiz ? Math.min(x1, x2) + i : cx, 0.85, horiz ? cz : Math.min(z1, z2) + i);
    addBoxCol(horiz ? Math.min(x1, x2) : cx - 0.5, horiz ? Math.max(x1, x2) : cx + 0.5, horiz ? cz - 0.5 : Math.min(z1, z2), horiz ? cz + 0.5 : Math.max(z1, z2));
  };
  hedge(-415, 6.5, -415, 23.5);    // between fields and spawn side
  hedge(-436, -15, -426.8, -15);   // house garden edge
  hedge(-416, -14, -416, -2);      // house garden east edge
  const lamp = (x, z) => { cyl(0.09, 0.12, 3.2, '#37474f', x, 1.6, z); box(0.5, 0.12, 0.5, '#37474f', x, 3.25, z); const l = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 8), new THREE.MeshBasicMaterial({ color: '#fff3c4' })); l.position.set(x, 3.0, z); scene.add(l); addCircleCol(x, z, 0.25); };
  [[-402.4, 6.3], [-397.6, 1.7], [-427.4, 1.6], [-391.6, -15.4], [-397.6, 13.8], [-402.4, -3.4], [-402.6, 24.8], [-397.4, 24.8]].forEach(([x, z]) => lamp(x, z));

  // ---------- entrance arch with the owner's name ----------
  const signCanvas = document.createElement('canvas'); signCanvas.width = 1024; signCanvas.height = 256;
  const signTex = new THREE.CanvasTexture(signCanvas); signTex.colorSpace = THREE.SRGBColorSpace;
  [-402.2, -397.8].forEach((x) => { cyl(0.22, 0.28, 4.6, '#8d5a3b', x, 2.3, 31.3); for (let i = 0; i < 5; i++) sphere(0.26, i % 2 ? '#e91e63' : '#66bb6a', x + (i % 2 ? 0.25 : -0.25), 0.8 + i * 0.8, 31.6); });
  box(5.4, 0.35, 0.5, '#8d5a3b', -400, 4.65, 31.3);
  const archSign = mesh(new THREE.PlaneGeometry(4.4, 1.1), new THREE.MeshToonMaterial({ map: signTex, gradientMap: gradient }), -400, 4.0, 31.58); scene.add(archSign);
  const archBack = mesh(new THREE.PlaneGeometry(4.4, 1.1), new THREE.MeshToonMaterial({ map: signTex, gradientMap: gradient }), -400, 4.0, 31.02); archBack.rotation.y = Math.PI; scene.add(archBack);
  addCircleCol(-402.2, 31.3, 0.3); addCircleCol(-397.8, 31.3, 0.3);
  function setGardenOwner(name) {
    const g = signCanvas.getContext('2d');
    g.fillStyle = '#6d4c41'; g.fillRect(0, 0, 1024, 256); g.fillStyle = '#8d6e63'; g.fillRect(14, 14, 996, 228);
    g.fillStyle = '#fff8d6'; g.font = 'bold 92px "Baloo 2", "Nunito", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('🌻 ' + name + (/s$/i.test(name) ? "' farm" : "'s farm"), 512, 132, 960);
    signTex.needsUpdate = true;
  }
  setGardenOwner('My');

  // ---------- crop field frame (plots themselves are drawn by features.js) ----------
  {
    const x0 = GW.plotX, z0 = GW.plotZ, s = GW.cell * 8;
    woodFence(x0 - 0.5, z0 - 0.5, x0 + s + 0.5, z0 - 0.5, '#c79a6b', '#8d6e63', false);
    woodFence(x0 - 0.5, z0 + s + 0.5, x0 + s + 0.5, z0 + s + 0.5, '#c79a6b', '#8d6e63', false);
    woodFence(x0 - 0.5, z0 - 0.5, x0 - 0.5, z0 + s + 0.5, '#c79a6b', '#8d6e63', false);
    box(s, 0.03, s, '#9ccc65', x0 + s / 2, 0.06, z0 + s / 2, scene, { cast: false }); // unlocked plots cover this
    // scarecrow
    const sc = new THREE.Group(); sc.position.set(-414.2, 0, 25.4); scene.add(sc);
    box(0.14, 2.2, 0.14, '#8d6e63', 0, 1.1, 0, sc); box(1.8, 0.12, 0.12, '#8d6e63', 0, 1.7, 0, sc);
    box(0.9, 0.9, 0.4, '#3f51b5', 0, 1.55, 0, sc); sphere(0.32, '#f4d58d', 0, 2.3, 0, sc); cyl(0.55, 0.55, 0.06, '#c9a227', 0, 2.55, 0, sc); cyl(0.28, 0.32, 0.3, '#c9a227', 0, 2.72, 0, sc);
    addCircleCol(-414.2, 25.4, 0.3);
  }

  // ---------- 2-storey house (NW corner) with cut-away ----------
  const H = GW.house, hcx = (H.minX + H.maxX) / 2, hcz = (H.minZ + H.maxZ) / 2, HT = 0.3, F2 = 3.4;
  const house = { f1Low: new THREE.Group(), f1High: new THREE.Group(), f2Slab: new THREE.Group(), f2Low: new THREE.Group(), f2High: new THREE.Group(), roof: new THREE.Group(), lv1: new THREE.Group(), lv2: new THREE.Group(), furnF1: new THREE.Group(), furnF2: new THREE.Group() };
  Object.values(house).forEach((g) => scene.add(g));
  const wallMat = new THREE.MeshToonMaterial({ color: '#fff3e0', gradientMap: gradient }), roofMat = new THREE.MeshToonMaterial({ color: '#d84315', gradientMap: gradient });
  const wallBox = (x1, z1, x2, z2, y0, y1, g) => {
    const len = Math.hypot(x2 - x1, z2 - z1); if (len < 0.05) return;
    const m = new THREE.Mesh(new THREE.BoxGeometry(len + HT, y1 - y0, HT), wallMat);
    m.position.set((x1 + x2) / 2, (y0 + y1) / 2, (z1 + z2) / 2); m.rotation.y = -Math.atan2(z2 - z1, x2 - x1); m.castShadow = m.receiveShadow = true; g.add(m);
  };
  const doorL = H.door.x - 1, doorR = H.door.x + 1;
  const walls = (y0, y1, g, withDoor) => {
    if (withDoor) { wallBox(H.minX, H.maxZ, doorL, H.maxZ, y0, y1, g); wallBox(doorR, H.maxZ, H.maxX, H.maxZ, y0, y1, g); }
    else wallBox(H.minX, H.maxZ, H.maxX, H.maxZ, y0, y1, g);
    wallBox(H.minX, H.minZ, H.maxX, H.minZ, y0, y1, g); wallBox(H.minX, H.minZ, H.minX, H.maxZ, y0, y1, g); wallBox(H.maxX, H.minZ, H.maxX, H.maxZ, y0, y1, g);
  };
  walls(0, 1.1, house.f1Low, true); walls(1.1, F2, house.f1High, true);
  wallBox(doorL, H.maxZ, doorR, H.maxZ, 2.5, F2, house.f1High); // lintel over the door
  walls(F2, F2 + 1.1, house.f2Low, false); walls(F2 + 1.1, F2 * 2, house.f2High, false);
  // floors: wood planks
  box(H.maxX - H.minX - 0.2, 0.12, H.maxZ - H.minZ - 0.2, '#c8a27a', hcx, 0.06, hcz, house.f1Low, { cast: false });
  for (let x = H.minX + 1; x < H.maxX; x += 1) box(0.04, 0.125, H.maxZ - H.minZ - 0.3, '#a9845d', x, 0.065, hcz, house.f1Low, { cast: false });
  const L = GW.levels, lv = (id) => L.find((q) => q.id === id), A2 = lv('H2a'), B2 = lv('H2b'), HR = lv('HR');
  box(A2.maxX - A2.minX, 0.25, A2.maxZ - A2.minZ, '#c8a27a', (A2.minX + A2.maxX) / 2, F2 - 0.125, (A2.minZ + A2.maxZ) / 2, house.f2Slab);
  box(B2.maxX - B2.minX, 0.25, B2.maxZ - B2.minZ, '#c8a27a', (B2.minX + B2.maxX) / 2, F2 - 0.125, (B2.minZ + B2.maxZ) / 2, house.f2Slab);
  box(0.12, 1.0, HR.maxZ - HR.minZ, '#8d6e63', HR.minX - 0.05, F2 + 0.5, (HR.minZ + HR.maxZ) / 2, house.f2Slab); // railing at the stairwell
  // stairs (visual steps along the ramp)
  const steps = 12;
  for (let i = 0; i < steps; i++) { const k = (i + 0.5) / steps, z = HR.a + (HR.b - HR.a) * k, y = HR.ya + (HR.yb - HR.ya) * k; box(HR.maxX - HR.minX, y, Math.abs(HR.b - HR.a) / steps + 0.02, i % 2 ? '#a1887f' : '#8d6e63', (HR.minX + HR.maxX) / 2, y / 2, z, house.f1Low); }
  addBoxCol(HR.minX - 0.1, HR.maxX, Math.min(HR.a, HR.b), Math.max(HR.a, HR.b) - 1.2); // can't walk under/into the side of the stairs
  // windows + flower boxes + shutters (on the "high" wall groups so they hide with the cut-away)
  const win = (x, y, z, rotY, g) => {
    const w = new THREE.Group(); w.position.set(x, y, z); w.rotation.y = rotY; g.add(w);
    box(1.3, 1.1, 0.1, '#81d4fa', 0, 0, 0, w, { cast: false }); box(1.45, 0.12, 0.14, '#ffffff', 0, 0.6, 0, w); box(1.45, 0.12, 0.14, '#ffffff', 0, -0.6, 0, w); box(0.08, 1.2, 0.14, '#ffffff', 0, 0, 0, w);
    box(0.35, 1.2, 0.08, '#2e7d32', -0.9, 0, 0, w); box(0.35, 1.2, 0.08, '#2e7d32', 0.9, 0, 0, w);
  };
  [-430, -427.6, -420.6].forEach((x) => { win(x, 2.0, H.maxZ + 0.2, 0, house.f1High); box(1.4, 0.3, 0.3, '#8d6e63', x, 1.25, H.maxZ + 0.35, house.f1High); for (let i = 0; i < 4; i++) sphere(0.14, ['#ff6f91', '#ffd23f', '#ab47bc', '#ffffff'][i], x - 0.5 + i * 0.33, 1.48, H.maxZ + 0.35, house.f1High); });
  [-430, -426.5, -423, -419.8].forEach((x) => win(x, F2 + 1.9, H.maxZ + 0.2, 0, house.f2High));
  [-22, -26].forEach((z) => { win(H.minX - 0.2, 2.0, z, Math.PI / 2, house.f1High); win(H.minX - 0.2, F2 + 1.9, z, Math.PI / 2, house.f2High); win(H.maxX + 0.2, F2 + 1.9, z, Math.PI / 2, house.f2High); });
  // door + porch
  box(1.6, 2.4, 0.12, '#8d5a3b', H.door.x - 0.6, 1.2, H.maxZ + 0.6, house.f1High).rotation.y = -1.1; // open door
  box(3.6, 0.25, 1.6, '#bcaaa4', H.door.x, 0.12, H.maxZ + 0.9); box(3.2, 0.2, 1.2, '#d7ccc8', H.door.x, 0.32, H.maxZ + 0.75);
  [-1.6, 1.6].forEach((dx) => cyl(0.12, 0.12, 2.7, '#ffffff', H.door.x + dx, 1.35, H.maxZ + 1.5, house.f1High));
  box(4.0, 0.15, 2.0, '#d84315', H.door.x, 2.75, H.maxZ + 0.9, house.f1High);
  // gable roof (triangular prism along x) + chimney
  {
    const dz = (H.maxZ - H.minZ) / 2 + 0.7, rh = 2.8;
    const sh = new THREE.Shape(); sh.moveTo(-dz, 0); sh.lineTo(dz, 0); sh.lineTo(0, rh); sh.lineTo(-dz, 0);
    const geo = new THREE.ExtrudeGeometry(sh, { depth: H.maxX - H.minX + 1.2, bevelEnabled: false });
    const r = new THREE.Mesh(geo, roofMat); r.rotation.y = Math.PI / 2; r.position.set(H.minX - 0.6, F2 * 2, hcz); r.castShadow = true; house.roof.add(r);
    box(0.9, 2.4, 0.9, '#bcaaa4', H.minX + 2.5, F2 * 2 + 1.6, hcz - 2, house.roof); box(1.1, 0.2, 1.1, '#8d6e63', H.minX + 2.5, F2 * 2 + 2.8, hcz - 2, house.roof);
  }
  // level 1 extra: balcony on the 2nd floor (south side)
  box(5, 0.25, 1.6, '#d7ccc8', -428.5, F2, H.maxZ + 0.85, house.lv1);
  box(5, 0.9, 0.1, '#ffffff', -428.5, F2 + 0.55, H.maxZ + 1.6, house.lv1); for (let x = -430.8; x <= -426.2; x += 0.5) box(0.08, 0.9, 0.08, '#ffffff', x, F2 + 0.5, H.maxZ + 1.6, house.lv1);
  for (let i = 0; i < 5; i++) sphere(0.22, ['#ff6f91', '#ffd23f', '#81c784'][i % 3], -430.5 + i, F2 + 0.35, H.maxZ + 1.4, house.lv1);
  // level 2 extra: little turret
  cyl(1.5, 1.6, F2 * 2 + 1.5, '#f3e5f5', H.maxX - 0.5, (F2 * 2 + 1.5) / 2, H.minZ + 0.5, house.lv2);
  house.lv2.add(mesh(new THREE.ConeGeometry(2.0, 2.6, 10), '#6a1b9a', H.maxX - 0.5, F2 * 2 + 2.8, H.minZ + 0.5));
  [3, 6.4].forEach((y) => box(0.8, 1, 0.1, '#81d4fa', H.maxX + 1.05, y, H.minZ + 0.5, house.lv2, { cast: false }));
  // colliders: outer walls with the door gap
  const ct = 0.35;
  addBoxCol(H.minX - ct, doorL, H.maxZ - ct, H.maxZ + ct); addBoxCol(doorR, H.maxX + ct, H.maxZ - ct, H.maxZ + ct);
  addBoxCol(H.minX - ct, H.maxX + ct, H.minZ - ct, H.minZ + ct); addBoxCol(H.minX - ct, H.minX + ct, H.minZ, H.maxZ); addBoxCol(H.maxX - ct, H.maxX + ct, H.minZ, H.maxZ);
  // furniture slots (index order = unlock order: 0-5 floor 1, 6-11 floor 2, then 2 + 2 per house level)
  const S1 = [[-430, -26.6, 0], [-427, -26.6, 0], [-423.5, -26.6, 0], [-430.8, -22.4, Math.PI / 2], [-430.8, -19.6, Math.PI / 2], [-427.6, -22.6, 0]];
  const S2 = [[-430, -26.6, 0], [-427, -26.6, 0], [-424, -26.6, 0], [-430.8, -22.4, Math.PI / 2], [-430.8, -19.6, Math.PI / 2], [-427, -22.6, 0]];
  const E1 = [[-422.6, -22.6, -Math.PI / 2], [-428.4, -19.4, Math.PI], [-422.6, -19.4, -Math.PI / 2], [-425.3, -22.6, 0]];
  const E2 = [[-423.6, -22.6, -Math.PI / 2], [-427.6, -19.4, Math.PI], [-423.6, -19.4, Math.PI], [-419.8, -26.6, 0]];
  const houseSlots = [].concat(S1.map((s) => ({ x: s[0], z: s[1], ry: s[2], floor: 1 })), S2.map((s) => ({ x: s[0], z: s[1], ry: s[2], floor: 2 })),
    [E1[0], E1[1]].map((s) => ({ x: s[0], z: s[1], ry: s[2], floor: 1 })), [E2[0], E2[1]].map((s) => ({ x: s[0], z: s[1], ry: s[2], floor: 2 })),
    [E1[2], E1[3]].map((s) => ({ x: s[0], z: s[1], ry: s[2], floor: 1 })), [E2[2], E2[3]].map((s) => ({ x: s[0], z: s[1], ry: s[2], floor: 2 })));
  let hlv = 0, cutMode = 'none';
  function applyHouse() {
    const inside = cutMode !== 'none';
    house.roof.visible = !inside; house.lv1.visible = !inside && hlv >= 1; house.lv2.visible = !inside && hlv >= 2;
    house.f1High.visible = cutMode !== 'f1'; house.f2High.visible = !inside;
    house.f2Slab.visible = cutMode !== 'f1'; house.f2Low.visible = cutMode !== 'f1'; house.furnF2.visible = cutMode !== 'f1';
  }
  function setHouseLevel(l) {
    hlv = Math.max(0, Math.min(2, l | 0));
    const HS = ctx.Room.Catalog.HOUSE[hlv];
    wallMat.color.set(HS.color); roofMat.color.set(HS.roof); applyHouse();
  }
  function setCut(mode) { if (mode !== cutMode) { cutMode = mode; applyHouse(); } } // 'none' | 'f1' (inside, ground floor) | 'f2' (upstairs)
  setHouseLevel(0);
  // house flower bed & mailbox
  for (let i = 0; i < 8; i++) sphere(0.25, ['#ff6f91', '#ffd23f', '#ffffff', '#ab47bc'][i % 4], -431 + i * 0.75, 0.3, H.maxZ + 2.6);
  box(5.8, 0.25, 0.9, '#6d4c41', -428.4, 0.12, H.maxZ + 2.6);
  box(0.12, 1.1, 0.12, '#6d4c41', -421.5, 0.55, H.maxZ + 2.4); box(0.45, 0.4, 0.7, '#e53935', -421.5, 1.25, H.maxZ + 2.4); addCircleCol(-421.5, H.maxZ + 2.4, 0.3);

  // ---------- cloud flower garden: 3 walkable tiers + cloud stairs ----------
  const cloudM = new THREE.MeshToonMaterial({ color: '#ffffff', gradientMap: gradient });
  const tiers = [new THREE.Group(), new THREE.Group(), new THREE.Group()]; tiers.forEach((g) => scene.add(g));
  const puff = (x, y, z, r, g) => { const s = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), cloudM); s.position.set(x, y, z); s.scale.y = 0.55; s.castShadow = true; g.add(s); return s; };
  const islandOf = (P, g) => {
    const cx = (P.minX + P.maxX) / 2, cz = (P.minZ + P.maxZ) / 2, w = P.maxX - P.minX, d = P.maxZ - P.minZ;
    box(w, 0.35, d, '#c5f0b2', cx, P.y - 0.18, cz, g, { cast: false }); // grassy top
    box(w - 0.3, 0.36, d - 0.3, '#d8f5c8', cx, P.y - 0.17, cz, g, { cast: false });
    for (let x = P.minX; x <= P.maxX + 0.01; x += 1.5) { puff(x, P.y - 0.55, P.minZ, 0.9 + rand() * 0.4, g); puff(x, P.y - 0.55, P.maxZ, 0.9 + rand() * 0.4, g); }
    for (let z = P.minZ; z <= P.maxZ + 0.01; z += 1.5) { puff(P.minX, P.y - 0.55, z, 0.9 + rand() * 0.4, g); puff(P.maxX, P.y - 0.55, z, 0.9 + rand() * 0.4, g); }
    for (let i = 0; i < 6; i++) puff(P.minX + rand() * w, P.y - 1.1, P.minZ + rand() * d, 1.3 + rand() * 0.8, g);
    // little white fence posts on the rim + flowers
    for (let x = P.minX + 0.4; x < P.maxX; x += 1.2) { box(0.08, 0.5, 0.08, '#ffffff', x, P.y + 0.25, P.minZ + 0.2, g); }
    for (let i = 0; i < 10; i++) sphere(0.14, ['#ff80ab', '#ffd54f', '#b39ddb', '#80deea'][i % 4], P.minX + 0.5 + rand() * (w - 1), P.y + 0.12, P.maxZ - 0.4 - rand() * 0.4, g);
  };
  const stairsOf = (R, g) => {
    const n = 8, horizZ = R.axis === 'z';
    for (let i = 0; i < n; i++) {
      const k = (i + 0.5) / n, y = R.ya + (R.yb - R.ya) * k, p = R.a + (R.b - R.a) * k;
      const x = horizZ ? (R.minX + R.maxX) / 2 : p, z = horizZ ? p : (R.minZ + R.maxZ) / 2;
      const w = horizZ ? R.maxX - R.minX : Math.abs(R.b - R.a) / n + 0.1, d = horizZ ? Math.abs(R.b - R.a) / n + 0.1 : R.maxZ - R.minZ;
      box(w, 0.3, d, '#ffffff', x, y - 0.15, z, g); puff(x + (horizZ ? -w / 2 : 0), y - 0.4, z + (horizZ ? 0 : -d / 2), 0.45, g); puff(x + (horizZ ? w / 2 : 0), y - 0.4, z + (horizZ ? 0 : d / 2), 0.45, g);
    }
  };
  stairsOf(lv('R1'), tiers[0]); islandOf(lv('T1'), tiers[0]);
  stairsOf(lv('R2'), tiers[1]); islandOf(lv('T2'), tiers[1]);
  stairsOf(lv('R3'), tiers[2]); islandOf(lv('T3'), tiers[2]);
  // rainbow + sparkles
  ['#ef5350', '#ffa726', '#ffee58', '#66bb6a', '#42a5f5', '#ab47bc'].forEach((c, i) => { const arc = new THREE.Mesh(new THREE.TorusGeometry(5.2 - i * 0.22, 0.11, 6, 48, Math.PI), new THREE.MeshBasicMaterial({ color: c })); arc.position.set(-400, 7.2, -14.5); tiers[0].add(arc); });
  const sparkM = new THREE.MeshBasicMaterial({ color: '#fff59d' }), sparks = [];
  for (let i = 0; i < 16; i++) { const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.09), sparkM); scene.add(s); sparks.push({ s, ph: rand() * 6, x: -408 + rand() * 16, z: -31 + rand() * 21 }); }
  animated.push((dt, t) => { sparks.forEach((o) => o.s.position.set(o.x + Math.sin(t * 0.7 + o.ph), 5 + Math.sin(t * 0.9 + o.ph) * 3 + 3, o.z + Math.cos(t * 0.5 + o.ph))); });
  // lock signs on tiers not bought yet
  const locks = [null, sign('🔒 Cloud Island 2: buy it at the Shop', 4.4, 0.6, '#5c6bc0', '#ffffff', -394, 6.2, -21.8, 0, scene), sign('🔒 Cloud Island 3: buy it at the Shop', 4.4, 0.6, '#5c6bc0', '#ffffff', -398, 8.6, -26.6, 0, scene)];
  sign('🌸 CLOUD FLOWER GARDEN', 3.8, 0.6, '#ad1457', '#ffffff', -400, 1.6, -4.6, 0);
  box(0.12, 1.2, 0.12, '#6d4c41', -401.5, 0.6, -4.7); box(0.12, 1.2, 0.12, '#6d4c41', -398.5, 0.6, -4.7);
  // pot positions (8 per tier)
  const T1 = lv('T1'), T2 = lv('T2'), T3 = lv('T3');
  const POTS = [
    [-406, -11.8], [-403.5, -11.8], [-396.5, -11.8], [-394, -11.8], [-406, -16.5], [-403, -16.5], [-400, -16.5], [-397, -16.5],
  ].map(([x, z]) => ({ x, y: T1.y, z })).concat(
    [[-406, -23.2], [-403.6, -23.2], [-401.2, -23.2], [-398.8, -23.2], [-393.6, -24.8], [-393.6, -26.8], [-393.6, -29], [-396.4, -24.8]].map(([x, z]) => ({ x, y: T2.y, z })),
    [[-406.8, -25], [-404.6, -25], [-402.4, -25], [-406.8, -30], [-404.6, -30], [-402.4, -30], [-407.3, -27.5], [-401.2, -30.3]].map(([x, z]) => ({ x, y: T3.y, z })));
  function potPositions(lvl) { return POTS.slice(0, ctx.Room.Catalog.UPGRADES.pots[Math.max(0, Math.min(2, lvl | 0))].cap); }
  function setPotLevel(lvl) {
    tiers.forEach((g, i) => { g.traverse((o) => { if (o.material && o.material !== cloudM && o.material.opacity !== undefined && !o.material.isMeshBasicMaterial) { /* keep */ } }); });
    locks.forEach((s, i) => { if (s) s.visible = i > lvl; });
  }

  // ---------- animal pens ----------
  const P = GW.pens;
  const penFence = (pen, side) => { // side: which edge has the 2.6 m gate
    const g0 = pen.gate.x - 1.3, g1 = pen.gate.x + 1.3, zs = side === 's' ? pen.maxZ : pen.minZ, zo = side === 's' ? pen.minZ : pen.maxZ;
    woodFence(pen.minX, zs, g0, zs, '#f5f5f5', '#e0e0e0'); woodFence(g1, zs, pen.maxX, zs, '#f5f5f5', '#e0e0e0');
    woodFence(pen.minX, zo, pen.maxX, zo, '#f5f5f5', '#e0e0e0');
    woodFence(pen.minX, pen.minZ, pen.minX, pen.maxZ, '#f5f5f5', '#e0e0e0'); woodFence(pen.maxX, pen.minZ, pen.maxX, pen.maxZ, '#f5f5f5', '#e0e0e0');
  };
  const trough = (x, z, rot, c = '#8d6e63') => { const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot; scene.add(g); box(1.8, 0.4, 0.6, c, 0, 0.3, 0, g); box(1.6, 0.05, 0.45, '#f2c94c', 0, 0.5, 0, g); addCircleCol(x, z, 0.6); return g; };
  const barnBuilding = (x0, x1, z0, z1, wall, roof, label) => {
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, w = x1 - x0, d = z1 - z0, hgt = Math.min(4, d * 0.9);
    box(w, hgt, d, wall, cx, hgt / 2, cz);
    const sh = new THREE.Shape(); sh.moveTo(-w / 2 - 0.4, 0); sh.lineTo(w / 2 + 0.4, 0); sh.lineTo(0, hgt * 0.6); sh.lineTo(-w / 2 - 0.4, 0);
    const r = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: d + 0.6, bevelEnabled: false }), toon(roof)); r.position.set(cx, hgt, z0 - 0.3); r.castShadow = true; scene.add(r);
    // big door with white X on the front (+z side)
    const dw = Math.min(3, w * 0.4);
    box(dw, hgt * 0.7, 0.1, '#8d3b2e', cx, hgt * 0.35, z1 + 0.06); const x1b = box(Math.hypot(dw, hgt * 0.7), 0.14, 0.12, '#ffffff', cx, hgt * 0.35, z1 + 0.1); x1b.rotation.z = Math.atan2(hgt * 0.7, dw); const x2b = box(Math.hypot(dw, hgt * 0.7), 0.14, 0.12, '#ffffff', cx, hgt * 0.35, z1 + 0.1); x2b.rotation.z = -Math.atan2(hgt * 0.7, dw);
    box(dw + 0.2, 0.14, 0.12, '#ffffff', cx, hgt * 0.7, z1 + 0.1);
    if (label) sign(label, Math.min(w - 0.4, 3.4), 0.55, '#5d4037', '#fff8d6', cx, hgt * 0.9 + 0.25, z1 + 0.12, 0);
    addBoxCol(x0, x1, z0, z1);
  };
  // chicken coop
  penFence(P.coop, 's');
  box(P.coop.maxX - P.coop.minX - 0.4, 0.04, P.coop.maxZ - P.coop.minZ - 0.4, '#f0d58a', (P.coop.minX + P.coop.maxX) / 2, 0.07, (P.coop.minZ + P.coop.maxZ) / 2, scene, { cast: false });
  barnBuilding(-391, -386, -29.6, -26.6, '#e53935', '#8d3b2e', 'HENS');
  { const ramp = box(0.8, 0.08, 1.6, '#a1887f', -388.5, 0.4, -25.8); ramp.rotation.x = 0.45; }
  trough(-384, -27.5, 0, '#a1887f'); cyl(0.45, 0.4, 0.15, '#90caf9', -383.6, 0.1, -22.4);
  // cow barn
  penFence(P.barn, 's');
  barnBuilding(-378.6, -366.4, -29.8, -25.4, '#c62828', '#5d4037', 'COW BARN');
  trough(-368.6, -21.5, Math.PI / 2); [[-377.6, -19.2], [-376.4, -19.2], [-377, -19.2]].forEach(([x, z], i) => { const b = cyl(0.55, 0.55, 1.1, '#e6c35c', x, 0.55 + (i === 2 ? 0.9 : 0), z); b.rotation.z = Math.PI / 2; });
  // pig sty
  penFence(P.sty, 'n');
  { const mud = cyl(2.3, 2.4, 0.06, '#6d4c41', -385.4, 0.07, -9.6); mud.castShadow = false; cyl(1.6, 1.6, 0.07, '#5d4037', -385.6, 0.08, -9.4).castShadow = false; }
  barnBuilding(-391.4, -388.2, -8.2, -6.4, '#f48fb1', '#ad1457', null);
  trough(-390, -13.4, 0);
  sign('PIG STY', 2.4, 0.5, '#ad1457', '#ffffff', -385.4, 1.4, -15.3, Math.PI);
  sign('CHICKEN COOP', 2.8, 0.5, '#e53935', '#ffffff', -389, 1.4, -19.7, 0);

  // ---------- big round fish tank + feeding tower (ladder on the east side) ----------
  const T = GW.tank, TW = GW.tower;
  cyl(T.r + 0.35, T.r + 0.45, 0.55, '#b0bec5', T.x, 0.27, T.z);
  cyl(T.r - 0.05, T.r - 0.05, 0.12, '#f3e5ab', T.x, 0.6, T.z).castShadow = false;
  const tankWater = new THREE.Mesh(new THREE.CylinderGeometry(T.r - 0.08, T.r - 0.08, T.h - 0.35, 48, 1, true), new THREE.MeshBasicMaterial({ color: '#4fc3f7', transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }));
  tankWater.position.set(T.x, 0.55 + (T.h - 0.35) / 2, T.z); scene.add(tankWater);
  const waterTop = new THREE.Mesh(new THREE.CircleGeometry(T.r - 0.08, 48), new THREE.MeshBasicMaterial({ color: '#81d4fa', transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }));
  waterTop.rotation.x = -Math.PI / 2; waterTop.position.set(T.x, 0.55 + T.h - 0.35, T.z); scene.add(waterTop);
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(T.r, T.r, T.h, 48, 1, true), new THREE.MeshBasicMaterial({ color: '#e0f7fa', transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false }));
  glass.position.set(T.x, 0.55 + T.h / 2, T.z); scene.add(glass);
  const rim = mesh(new THREE.TorusGeometry(T.r, 0.12, 8, 48), '#90a4ae', T.x, 0.55 + T.h, T.z); rim.rotation.x = Math.PI / 2; scene.add(rim);
  const rimLow = mesh(new THREE.TorusGeometry(T.r, 0.1, 8, 48), '#90a4ae', T.x, 0.62, T.z); rimLow.rotation.x = Math.PI / 2; scene.add(rimLow);
  animated.push((dt, t) => { waterTop.position.y = 0.55 + T.h - 0.35 + Math.sin(t * 1.5) * 0.02; });
  addCircleCol(T.x, T.z, T.r + 0.45);
  const tw = new THREE.Group(); tw.position.set(TW.x, 0, TW.z); scene.add(tw);
  [[-1.1, -1.1], [1.1, -1.1], [-1.1, 1.1], [1.1, 1.1]].forEach(([dx, dz]) => box(0.22, TW.top, 0.22, '#8d6e63', dx, TW.top / 2, dz, tw));
  box(2.6, 0.2, 2.6, '#a1887f', 0, TW.top, 0, tw);
  box(2.6, 0.6, 0.08, '#8d6e63', 0, TW.top + 0.45, -1.25, tw); box(2.6, 0.6, 0.08, '#8d6e63', 0, TW.top + 0.45, 1.25, tw);
  box(0.08, 0.6, 2.6, '#8d6e63', -1.25, TW.top + 0.6, 0, tw);
  const roofT = mesh(new THREE.ConeGeometry(2.0, 1.1, 4), '#4caf50', 0, TW.top + 2.4, 0); roofT.rotation.y = Math.PI / 4; tw.add(roofT);
  [[-1.1, -1.1], [1.1, -1.1], [-1.1, 1.1], [1.1, 1.1]].forEach(([dx, dz]) => box(0.1, 1.9, 0.1, '#6d4c41', dx, TW.top + 0.95, dz, tw));
  [-0.45, 0.45].forEach((dz) => box(0.1, TW.top + 0.8, 0.1, '#6d4c41', 1.35, (TW.top + 0.8) / 2, dz, tw));
  for (let y = 0.4; y < TW.top + 0.3; y += 0.45) box(0.08, 0.08, 0.95, '#a1887f', 1.35, y, 0, tw);
  box(0.6, 0.5, 0.6, '#ffb74d', 0.5, TW.top + 0.35, -0.7, tw);
  addBoxCol(TW.x - 1.3, TW.x + 1.3, TW.z - 1.3, TW.z + 1.3);
  sign('FISH TANK', 1.8, 0.6, '#0277bd', '#ffffff', T.x, 0.95, T.z + T.r + 0.48, 0);

  // ---------- orchard ----------
  GW.trees.forEach(([x, z]) => { cyl(1.5, 1.6, 0.08, '#8d6e63', x, 0.04, z).castShadow = false; cyl(1.7, 1.7, 0.05, '#a5d6a7', x, 0.02, z).castShadow = false; });
  woodFence(-391.5, 13.5, -383, 13.5, '#c79a6b', '#8d6e63'); woodFence(-379, 13.5, -370.5, 13.5, '#c79a6b', '#8d6e63');
  sign('ORCHARD', 2.4, 0.55, '#2e7d32', '#ffffff', -381, 1.5, 13.3, 0);

  // ---------- market stall (counter faces the main path) + notice board ----------
  const S = GW.stall, sg = new THREE.Group(); sg.position.set(S.x, 0, S.z); sg.rotation.y = Math.PI; scene.add(sg);
  box(1.2, 1.15, 4.4, '#8d6e63', -0.9, 0.58, 0, sg); box(1.5, 0.14, 4.7, '#bcaaa4', -0.9, 1.2, 0, sg);
  [[-1.5, -2.2], [-1.5, 2.2], [1.0, -2.2], [1.0, 2.2]].forEach(([dx, dz]) => box(0.16, 3.4, 0.16, '#6d4c41', dx, 1.7, dz, sg));
  for (let i = 0; i < 6; i++) { const b = box(3.2, 0.14, 0.8, i % 2 ? '#ffffff' : '#43a047', -0.25, 3.5, -2.0 + i * 0.8, sg); b.rotation.z = -0.25; }
  [['#fb8c00', -1.4], ['#e53935', -0.4], ['#fdd835', 0.6], ['#ab47bc', 1.5]].forEach(([c, dz]) => { box(0.8, 0.35, 0.7, '#a1887f', -0.9, 1.45, dz, sg); for (let k = 0; k < 4; k++) sphere(0.13, c, -1.05 + (k % 2) * 0.3, 1.7, dz - 0.15 + Math.floor(k / 2) * 0.3, sg); });
  sign('FARM STALL', 3.6, 0.7, '#2e7d32', '#ffffff', -1.62, 2.75, 0, -Math.PI / 2, sg);
  addBoxCol(S.x - 1.2, S.x + 1.6, S.z - 2.4, S.z + 2.4);
  [[-408.4, 24.2], [-408.6, 29.8]].forEach(([x, z], i) => { if (i) cyl(0.4, 0.4, 0.9, '#8d6e63', x, 0.45, z); else box(0.9, 0.7, 0.9, '#a1887f', x, 0.35, z); addCircleCol(x, z, 0.5); });
  const NB = GW.board, nb = new THREE.Group(); nb.position.set(NB.x, 0, NB.z); scene.add(nb);
  [-1.5, 1.5].forEach((dx) => box(0.2, 2.8, 0.2, '#6d4c41', dx, 1.4, 0, nb));
  box(3.2, 1.8, 0.16, '#a1887f', 0, 1.7, 0, nb); box(3.6, 0.14, 0.5, '#d84315', 0, 2.75, 0.05, nb);
  for (let i = 0; i < 6; i++) { const n = box(0.6, 0.45, 0.03, ['#fff59d', '#ffffff', '#b2ebf2', '#ffccbc'][i % 4], -1.0 + (i % 3) * 1.0, 2.05 - Math.floor(i / 3) * 0.65, 0.1, nb, { cast: false }); n.rotation.z = (rand() - 0.5) * 0.3; }
  sign('NOTICE BOARD', 2.2, 0.45, '#d84315', '#ffffff', 0, 3.05, 0.12, 0, nb);
  addBoxCol(NB.x - 1.7, NB.x + 1.7, NB.z - 0.3, NB.z + 0.3);
  // benches at the plaza
  const bench = (x, z, ry) => { const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; scene.add(g); box(1.8, 0.14, 0.6, '#a1887f', 0, 0.55, 0, g); box(1.8, 0.5, 0.12, '#a1887f', 0, 0.85, -0.25, g); [-0.75, 0.75].forEach((dx) => box(0.12, 0.5, 0.5, '#6d4c41', dx, 0.25, 0, g)); addCircleCol(x, z, 0.8); };
  bench(-404.6, 30.4, Math.PI); bench(-395.4, 25.2, 0);

  // ---------- decorations: trees around the edge, well, windmill, flowers, rocks ----------
  [[-434.5, -12], [-434.5, -6], [-434, 0], [-415, -30.5], [-411.5, -31], [-365.5, 12], [-365.5, 20], [-434, 30.5], [-428, 31], [-420, 31], [-388, 31], [-380, 31], [-372, 31], [-434.5, -30.5]].forEach(([x, z], i) => {
    (i % 4 === 1 ? pineTree : roundTree)(x, z, 1 + (i % 3) * 0.15, i, true); addCircleCol(x, z, 0.6);
  });
  { // well
    const x = -412, z = -3; cyl(1.0, 1.05, 0.9, '#9e9e9e', x, 0.45, z); cyl(0.85, 0.85, 0.92, '#1e88e5', x, 0.46, z);
    [-0.85, 0.85].forEach((dx) => box(0.14, 2.2, 0.14, '#6d4c41', x + dx, 1.1, z)); const rf = mesh(new THREE.ConeGeometry(1.4, 0.9, 4), '#d84315', x, 2.5, z); rf.rotation.y = Math.PI / 4; scene.add(rf);
    addCircleCol(x, z, 1.1);
  }
  { // windmill
    const g = new THREE.Group(); g.position.set(-367.5, 0, 28); scene.add(g);
    cyl(0.9, 1.4, 5, '#fff3e0', 0, 2.5, 0, g); g.add(mesh(new THREE.ConeGeometry(1.2, 1.4, 8), '#d84315', 0, 5.7, 0));
    const bl = new THREE.Group(); bl.position.set(0, 4.6, 1.0); g.add(bl);
    for (let i = 0; i < 4; i++) { const piv = new THREE.Group(); piv.rotation.z = i * Math.PI / 2; bl.add(piv); box(0.5, 2.6, 0.06, '#f5f5f5', 0, 1.4, 0, piv); }
    animated.push((dt) => { bl.rotation.z += dt * 0.8; });
    addCircleCol(-367.5, 28, 1.4);
  }
  const flowerSpots = [];
  for (let i = 0; i < 70; i++) flowerSpots.push([-433 + rand() * 16, -13.5 + rand() * 1.2]);           // under the house hedge
  for (let i = 0; i < 40; i++) flowerSpots.push([-414 + rand() * 9, 29.6 + rand() * 2]);              // by the entrance
  for (let i = 0; i < 40; i++) flowerSpots.push([-388 + rand() * 14, 29.8 + rand() * 1.8]);
  instancedDots(flowerSpots, 0.17, ['#ff6f91', '#ffd23f', '#ffffff', '#ab47bc', '#4fc3f7'], 0.28);
  [[-433, 4], [-368, -2.5], [-416.5, 28], [-386, 7]].forEach(([x, z]) => rock(x, z, 0.55 + rand() * 0.3));

  const gardenGround = [island];
  return {
    setGardenOwner, gardenGround, potPositions, setPotLevel, setHouseLevel, setCut, houseSlots,
    houseFurn: { 1: house.furnF1, 2: house.furnF2 }, pens: P,
  };
}
