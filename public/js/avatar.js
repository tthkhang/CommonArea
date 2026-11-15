// Parametric chibi adventurer (from campus-export; reference: its wiki/art/character-reference.md).
// Combined game: the character is drawn in Top1Server's style: flat 3-step toon shading, an ink outline
// around the larger parts, a round blob shadow under the feet and a white name with an ink stroke.
// A "look" is a plain object (DEFAULT_LOOK below). `makeAvatar(name, look)` returns a group;
// `group.userData.build(look, name)` rebuilds it after any change, and
// `group.userData.animate(phase, amount)` plays the walk cycle.
// A look is a small JSON object, so it is cheap to send to other players later.
import * as THREE from 'three';
import { toon, vienMat, nhanChu } from './world.js';

export const DEFAULT_LOOK = {
  // body
  skin: '#f6cfae',
  headSize: 1,
  bodySize: 1,
  // face
  eyeStyle: 'oval',
  eyeColor: '#111111',
  brow: 'serious',
  mouth: 'line',
  blush: false,
  glasses: false,
  // hair
  hairStyle: 'split',
  hairA: '#1b1b1b',
  hairB: '#f0f0f0',
  // clothes
  hood: 'up',
  hoodColor: '#d6b48c',
  top: 'tunic',
  outfit: '#e4cda6',
  crossStraps: true,
  trim: '#8a4a2a',
  legs: 'shorts',
  pants: '#6b5a46',
  boots: 'boots',
  bootColor: '#7a3b1f',
  // extras
  item: 'sword',
  itemColor: '#d9b24c',
  scarf: false,
  scarfColor: '#c0392b',
  backpack: false,
  backpackColor: '#6b4a2f',
};

export const SKIN_TONES = ['#ffe0c7', '#f6cfae', '#e0ac82', '#c68642', '#8d5524', '#5c3a21'];

const opt = (...pairs) => pairs.map(([v, label]) => ({ v, label }));
export const CHOICES = {
  eyeStyle: opt(['oval', 'Oval'], ['round', 'Round'], ['sleepy', 'Sleepy'], ['happy', 'Happy']),
  brow: opt(['serious', 'Serious'], ['soft', 'Worried'], ['flat', 'Flat'], ['none', 'None']),
  mouth: opt(['line', 'Line'], ['smile', 'Smile'], ['open', 'Open'], ['frown', 'Frown']),
  hairStyle: opt(['split', 'Two-tone'], ['short', 'Short'], ['long', 'Long'], ['spiky', 'Spiky'], ['bun', 'Bun'], ['none', 'Bald']),
  hood: opt(['up', 'Up'], ['down', 'Down'], ['none', 'None']),
  top: opt(['tunic', 'Tunic'], ['shirt', 'Shirt'], ['robe', 'Robe']),
  legs: opt(['shorts', 'Shorts'], ['pants', 'Pants']),
  boots: opt(['boots', 'Boots'], ['shoes', 'Shoes'], ['sandals', 'Sandals']),
  item: opt(['sword', 'Sword'], ['staff', 'Staff'], ['book', 'Book'], ['flower', 'Flower'], ['none', 'Nothing']),
};

// ---------------------------------------------------------------------------------------------
// Emotes (like Fortnite's): each plays on a loop until the player moves. `pose(t, parts)` sets the
// body for time t (seconds since it started). Rotation notes: left arm z>0 swings OUT and up, right arm z<0
// swings out; x<0 swings forward.
const sin = Math.sin;
const EMOTE_POSES = {
  wave: (t, p) => {
    p.shoulderL.rotation.z = 1.65 + sin(t * 9) * 0.4; // arm out to the side (below the hood), waving
    p.head.rotation.z = sin(t * 2) * 0.08;
    p.rig.rotation.z = sin(t * 2) * 0.04;
  },
  dance: (t, p) => {
    const b = sin(t * 6);
    p.rig.position.y = Math.abs(b) * 0.12;
    p.rig.rotation.y = sin(t * 3) * 0.5;
    p.rig.rotation.z = b * 0.08;
    p.legs[0].rotation.x = b * 0.6;
    p.legs[1].rotation.x = -b * 0.6;
    p.shoulderL.rotation.z = 1.7 + b * 0.6;
    p.shoulderR.rotation.z = -1.7 + b * 0.6;
    p.head.rotation.z = sin(t * 3) * 0.15;
  },
  cheer: (t, p) => {
    const h = Math.abs(sin(t * 5));
    p.rig.position.y = h * 0.35;
    p.shoulderL.rotation.z = 1.75 + sin(t * 10) * 0.25; // arms thrown out wide (higher would hide behind the hood)
    p.shoulderR.rotation.z = -1.75 - sin(t * 10) * 0.25;
    if (p.item) p.item.visible = false;
    p.legs[0].rotation.x = -h * 0.5;
    p.legs[1].rotation.x = h * 0.5;
    p.head.rotation.x = -0.2;
  },
  clap: (t, p) => {
    const c = 0.7 + sin(t * 12) * 0.25; // hands open and close in front
    p.shoulderL.rotation.set(-1.5, 0, -c);
    p.shoulderR.rotation.set(-1.5, 0, c);
    if (p.item) p.item.visible = false;
    p.rig.position.y = Math.abs(sin(t * 6)) * 0.03;
    p.head.rotation.x = 0.1;
  },
  bow: (t, p) => {
    const k = 0.5 - 0.5 * Math.cos((t % 3) * (Math.PI * 2 / 3)); // 0 -> 1 -> 0 every 3 s
    p.rig.rotation.x = k * 0.7;
    p.head.rotation.x = k * 0.3;
    p.shoulderL.rotation.x = -k * 0.3;
    p.shoulderR.rotation.x = -k * 0.3;
  },
  laugh: (t, p) => {
    p.rig.position.y = Math.abs(sin(t * 14)) * 0.05;
    p.rig.rotation.x = -0.15;
    p.head.rotation.x = -0.35 + sin(t * 16) * 0.08;
    p.shoulderL.rotation.set(-1.0, 0, -0.5);
    p.shoulderR.rotation.set(-1.0, 0, 0.5);
    if (p.item) p.item.visible = false;
  },
  shrug: (t, p) => {
    const k = Math.min(1, t * 4) * (0.8 + 0.2 * sin(t * 3));
    p.shoulderL.rotation.z = 0.9 * k;
    p.shoulderR.rotation.z = -0.9 * k;
    p.head.rotation.z = 0.2 * sin(t * 2.2);
    p.rig.position.y = 0.02 * k;
  },
  spin: (t, p) => {
    p.rig.rotation.y = t * 7;
    p.rig.position.y = Math.abs(sin(t * 3.5)) * 0.2;
    p.shoulderL.rotation.z = 1.7;
    p.shoulderR.rotation.z = -1.7;
    if (p.item) p.item.visible = false;
    p.legs[0].rotation.x = sin(t * 7) * 0.4;
    p.legs[1].rotation.x = -sin(t * 7) * 0.4;
  },
};
/** For the emote wheel (the id must exist in EMOTE_POSES and in server/game.py EMOTES). */
export const EMOTES = [
  { id: 'wave', icon: '👋', label: 'Wave' },
  { id: 'dance', icon: '💃', label: 'Dance' },
  { id: 'cheer', icon: '🙌', label: 'Cheer' },
  { id: 'clap', icon: '👏', label: 'Clap' },
  { id: 'bow', icon: '🙇', label: 'Bow' },
  { id: 'laugh', icon: '😂', label: 'Laugh' },
  { id: 'shrug', icon: '🤷', label: 'Shrug' },
  { id: 'spin', icon: '🌀', label: 'Spin' },
];

export function makeAvatar(name, look = DEFAULT_LOOK) {
  const root = new THREE.Group();
  root.userData.sitting = false;
  root.userData.build = (lk, nm, opts = {}) => {
    root.traverse((o) => {
      o.geometry?.dispose();
      if (o.material) {
        o.material.map?.dispose();
        o.material.dispose();
      }
    });
    root.clear();
    build(root, { ...DEFAULT_LOOK, ...lk }, nm, opts);
  };
  root.userData.build(look, name);
  return root;
}

function build(root, L, name, opts = {}) {
  // Top1 toon material (one private copy per part so rebuilding can dispose it); roughness / metalness are ignored
  const std = (color, extra = {}) => { const mat = toon(color, 0, { rieng: true }); if (extra.side) mat.side = extra.side; return mat; };
  const m = {
    skin: std(L.skin),
    hairA: std(L.hairA),
    hairB: std(L.hairB),
    hood: std(L.hoodColor, { side: THREE.DoubleSide }),
    outfit: std(L.outfit),
    trim: std(L.trim),
    pants: std(L.pants),
    boots: std(L.bootColor),
    eye: std(L.eyeColor, { roughness: 0.3 }),
    item: std(L.itemColor, { metalness: 0.5, roughness: 0.4 }),
    scarf: std(L.scarfColor),
    pack: std(L.backpackColor),
    dark: std(0x222222, { roughness: 0.3 }),
    white: std(0xffffff),
    steel: std(0xd7dde4, { metalness: 0.7, roughness: 0.25 }),
    wood: std(0x7a4a24),
    green: std(0x3f8f3f),
    blush: std(0xf29a9a),
  };
  const noInk = new Set([m.eye, m.dark, m.white, m.blush]); // face details stay clean
  const add = (geo, mat, x, y, z, parent) => {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    parent.add(mesh);
    // ink outline (Top1 / Among Us rule): a slightly larger copy drawn inside-out behind the part
    if (!geo.boundingSphere) geo.computeBoundingSphere();
    const r = geo.boundingSphere.radius;
    if (r >= 0.11 && !noInk.has(mat)) {
      const ink = new THREE.Mesh(geo, vienMat);
      ink.scale.setScalar(1 + 0.03 / r);
      mesh.add(ink);
    }
    return mesh;
  };

  const rig = new THREE.Group(); // everything that bobs while walking
  root.add(rig);

  // ------------------------------------------------------------------ head
  const headY = 0.62 + 0.5 * L.headSize; // keeps the chin at the same height when the head grows
  const head = new THREE.Group();
  head.position.y = headY;
  head.scale.setScalar(L.headSize);
  rig.add(head);
  add(new THREE.SphereGeometry(0.5, 28, 20), m.skin, 0, 0, 0, head);

  // eyes + brows
  for (const x of [-0.18, 0.18]) {
    if (L.eyeStyle === 'happy') {
      add(new THREE.TorusGeometry(0.07, 0.018, 6, 12, Math.PI), m.eye, x, -0.04, 0.465, head);
    } else {
      const round = L.eyeStyle === 'round';
      const eye = add(new THREE.SphereGeometry(round ? 0.075 : 0.085, 14, 12), m.eye, x, -0.02, 0.455, head);
      eye.scale.set(round ? 0.95 : 0.8, round ? 1 : L.eyeStyle === 'sleepy' ? 0.75 : 1.45, 0.45);
      if (L.eyeStyle === 'sleepy') add(new THREE.BoxGeometry(0.17, 0.05, 0.03), m.skin, x, 0.02, 0.488, head);
      const shine = add(new THREE.SphereGeometry(0.02, 8, 6), m.white, x + 0.02, 0.03, 0.5, head);
      shine.scale.set(1, 1, 0.5);
    }
    if (L.brow !== 'none') {
      const brow = add(new THREE.BoxGeometry(0.15, 0.028, 0.02), m.dark, x, 0.17, 0.455, head);
      const tilt = L.brow === 'serious' ? 0.35 : L.brow === 'soft' ? -0.3 : 0;
      brow.rotation.z = x < 0 ? -tilt : tilt;
    }
    if (L.glasses) add(new THREE.TorusGeometry(0.105, 0.013, 6, 22), m.dark, x, -0.02, 0.5, head);
    if (L.blush) {
      const b = add(new THREE.SphereGeometry(0.06, 10, 8), m.blush, x * 1.65, -0.12, 0.395, head);
      b.scale.set(1.3, 0.7, 0.3);
    }
  }
  if (L.glasses) add(new THREE.BoxGeometry(0.1, 0.014, 0.014), m.dark, 0, -0.02, 0.51, head);
  // mouth
  if (L.mouth === 'line') add(new THREE.BoxGeometry(0.09, 0.016, 0.02), m.dark, 0, -0.19, 0.48, head);
  else if (L.mouth === 'open') {
    add(new THREE.SphereGeometry(0.04, 10, 8), m.dark, 0, -0.19, 0.475, head).scale.set(1, 0.8, 0.4);
  } else {
    const arc = add(new THREE.TorusGeometry(0.055, 0.013, 6, 12, Math.PI), m.dark, 0, L.mouth === 'smile' ? -0.15 : -0.22, 0.482, head);
    if (L.mouth === 'smile') arc.rotation.z = Math.PI; // arc opens upward = smile
  }

  // hair
  const hoodUp = L.hood === 'up';
  const hair = L.hairStyle;
  const sideMat = (x) => (hair === 'split' ? (x < 0 ? m.hairA : m.hairB) : m.hairA);
  if (hair !== 'none') {
    // fringe and side tufts always show (they peek out of the hood)
    for (const [x, rz] of [[-0.14, 0.5], [0.14, -0.5]]) {
      const bang = add(new THREE.SphereGeometry(0.17, 12, 10), sideMat(x), x, 0.3, 0.36, head);
      bang.scale.set(1.1, 0.55, 0.7);
      bang.rotation.z = rz;
    }
    for (const x of [-0.46, 0.46]) {
      const tuft = add(new THREE.SphereGeometry(0.17, 12, 10), sideMat(x), x, -0.1, 0.05, head);
      tuft.scale.set(0.8, 1.3, 1);
    }
    if (!hoodUp) {
      const dome = (phiStart, phiLen, mat) =>
        add(new THREE.SphereGeometry(0.54, 24, 14, phiStart, phiLen, 0, 1.5), mat, 0, 0, -0.03, head);
      if (hair === 'split') {
        dome(Math.PI / 2, Math.PI, m.hairB);
        dome(-Math.PI / 2, Math.PI, m.hairA);
      } else {
        dome(0, Math.PI * 2, m.hairA);
      }
      if (hair === 'long') {
        add(new THREE.CapsuleGeometry(0.34, 0.45, 4, 12), m.hairA, 0, -0.32, -0.28, head).scale.set(1.25, 1, 0.55);
        for (const x of [-0.47, 0.47]) add(new THREE.CapsuleGeometry(0.08, 0.5, 4, 8), m.hairA, x, -0.35, 0.08, head);
      }
      if (hair === 'bun') add(new THREE.SphereGeometry(0.2, 14, 12), m.hairA, 0, 0.56, -0.1, head);
      if (hair === 'spiky') {
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          const c = add(new THREE.ConeGeometry(0.1, 0.34, 8), m.hairA, Math.cos(a) * 0.34, 0.42, Math.sin(a) * 0.34 - 0.05, head);
          c.rotation.z = -Math.cos(a) * 0.55;
          c.rotation.x = Math.sin(a) * 0.55;
        }
        add(new THREE.ConeGeometry(0.11, 0.38, 8), m.hairA, 0, 0.52, -0.05, head);
      }
    }
  }

  // hood up: big shell with open front, rim and tip
  if (hoodUp) {
    const gap = 0.9;
    add(new THREE.SphereGeometry(0.66, 28, 18, Math.PI / 2 + gap / 2, Math.PI * 2 - gap, 0, 2.25), m.hood, 0, 0.03, -0.07, head);
    add(new THREE.ConeGeometry(0.12, 0.28, 12), m.hood, 0, 0.7, -0.22, head).rotation.x = -0.5;
    const rim = add(new THREE.TorusGeometry(0.5, 0.065, 10, 36), m.hood, 0, 0.02, 0.17, head);
    rim.scale.set(0.95, 1.02, 1);
  }

  // ------------------------------------------------------------------ body
  const body = new THREE.Group(); // width is scaled by bodySize
  body.scale.set(L.bodySize, 1, L.bodySize);
  rig.add(body);

  if (L.top === 'robe') add(new THREE.CylinderGeometry(0.28, 0.46, 0.72, 22), m.outfit, 0, 0.42, 0, body);
  else if (L.top === 'shirt') add(new THREE.CylinderGeometry(0.26, 0.3, 0.4, 20), m.outfit, 0, 0.52, 0, body);
  else add(new THREE.CylinderGeometry(0.27, 0.33, 0.46, 20), m.outfit, 0, 0.5, 0, body);
  if (L.crossStraps) {
    for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.06, 0.55, 0.02), m.trim, 0, 0.52, 0.3, body).rotation.z = s * 0.55;
  }
  if (L.top !== 'shirt') {
    const belt = add(new THREE.TorusGeometry(L.top === 'robe' ? 0.34 : 0.31, 0.03, 8, 24), m.trim, 0, L.top === 'robe' ? 0.46 : 0.34, 0, body);
    belt.rotation.x = Math.PI / 2;
    add(new THREE.BoxGeometry(0.12, 0.14, 0.08), m.trim, 0.3, 0.32, 0.05, body);
  }
  if (hoodUp || L.hood === 'down') {
    add(new THREE.CylinderGeometry(0.4, 0.46, 0.14, 24, 1, true), m.hood, 0, 0.72, -0.02, body); // collar
  }
  if (L.hood === 'down') {
    add(new THREE.SphereGeometry(0.26, 14, 10), m.hood, 0, 0.82, -0.3, body).scale.set(1.5, 0.8, 0.9);
  }
  if (L.scarf) {
    add(new THREE.TorusGeometry(0.33, 0.09, 10, 24), m.scarf, 0, 0.74, 0, body).rotation.x = Math.PI / 2;
    add(new THREE.BoxGeometry(0.12, 0.3, 0.05), m.scarf, 0.18, 0.6, 0.3, body);
  }
  if (L.backpack) {
    add(new THREE.BoxGeometry(0.38, 0.42, 0.18), m.pack, 0, 0.55, -0.34, body);
    add(new THREE.BoxGeometry(0.38, 0.1, 0.2), m.trim, 0, 0.68, -0.34, body);
  }

  // legs + footwear, each on a hip pivot so they can swing
  const legs = [];
  for (const x of [-0.14, 0.14]) {
    const hip = new THREE.Group();
    hip.position.set(x, 0.4, 0.02);
    const pants = L.legs === 'pants';
    add(new THREE.CylinderGeometry(0.065, 0.065, pants ? 0.26 : 0.2, 10), pants ? m.pants : m.skin, 0, pants ? -0.13 : -0.1, 0, hip);
    if (L.boots === 'boots') {
      add(new THREE.SphereGeometry(0.16, 14, 10), m.boots, 0, -0.27, 0.04, hip).scale.set(1, 0.9, 1.35);
      add(new THREE.CylinderGeometry(0.115, 0.13, 0.15, 14), m.boots, 0, -0.17, 0, hip);
      add(new THREE.TorusGeometry(0.12, 0.018, 6, 14), m.trim, 0, -0.1, 0, hip).rotation.x = Math.PI / 2;
      for (const r of [-0.6, 0.6]) add(new THREE.BoxGeometry(0.025, 0.13, 0.015), m.trim, 0, -0.17, 0.12, hip).rotation.z = r;
    } else if (L.boots === 'shoes') {
      add(new THREE.SphereGeometry(0.15, 14, 10), m.boots, 0, -0.29, 0.04, hip).scale.set(1, 0.7, 1.35);
    } else {
      add(new THREE.SphereGeometry(0.14, 12, 8), m.skin, 0, -0.3, 0.04, hip).scale.set(1, 0.45, 1.35);
      add(new THREE.BoxGeometry(0.2, 0.02, 0.05), m.boots, 0, -0.26, 0.06, hip);
      add(new THREE.BoxGeometry(0.2, 0.02, 0.05), m.boots, 0, -0.22, -0.02, hip);
    }
    body.add(hip);
    legs.push(hip);
  }

  // arms: both hang from shoulder pivots so walking, jumping and emotes can move them.
  // With an item the right arm rests raised to the side, holding it.
  const shoulderL = new THREE.Group();
  shoulderL.position.set(0.32, 0.7, 0.02);
  add(new THREE.CapsuleGeometry(0.07, 0.24, 4, 8), m.outfit, 0.04, -0.19, 0, shoulderL).rotation.z = -0.2;
  add(new THREE.SphereGeometry(0.07, 10, 8), m.skin, 0.075, -0.39, 0, shoulderL);
  body.add(shoulderL);

  const shoulderR = new THREE.Group();
  shoulderR.position.set(-0.38, 0.7, 0.02);
  add(new THREE.CapsuleGeometry(0.07, 0.24, 4, 8), m.outfit, -0.04, -0.19, 0, shoulderR).rotation.z = 0.2;
  add(new THREE.SphereGeometry(0.075, 10, 8), m.skin, -0.075, -0.39, 0, shoulderR);
  body.add(shoulderR);
  const REST_R = L.item === 'none' ? 0 : -1.45; // right arm resting angle

  let item = null;
  if (L.item !== 'none') {
    item = new THREE.Group(); // in the hand; counter-rotated so it points up while the arm is raised
    item.position.set(-0.075, -0.39, 0);
    shoulderR.add(item);
    if (L.item === 'sword') {
      add(new THREE.BoxGeometry(0.07, 0.5, 0.02), m.steel, 0, 0.35, 0, item);
      add(new THREE.ConeGeometry(0.035, 0.1, 4), m.steel, 0, 0.63, 0, item);
      add(new THREE.BoxGeometry(0.22, 0.04, 0.05), m.item, 0, 0.08, 0, item);
      add(new THREE.CylinderGeometry(0.02, 0.02, 0.14, 8), m.wood, 0, 0, 0, item);
    } else if (L.item === 'staff') {
      add(new THREE.CylinderGeometry(0.04, 0.045, 1.1, 8), m.wood, 0, 0.35, 0, item);
      add(new THREE.SphereGeometry(0.13, 14, 10), m.item, 0, 0.98, 0, item);
    } else if (L.item === 'book') {
      add(new THREE.BoxGeometry(0.24, 0.32, 0.07), m.item, 0.02, 0.18, 0, item);
      add(new THREE.BoxGeometry(0.2, 0.28, 0.075), m.white, 0.04, 0.18, 0, item);
    } else if (L.item === 'flower') {
      add(new THREE.CylinderGeometry(0.014, 0.014, 0.4, 6), m.green, 0, 0.2, 0, item);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        add(new THREE.SphereGeometry(0.06, 8, 6), m.item, Math.cos(a) * 0.07, 0.42 + Math.sin(a) * 0.07, 0, item);
      }
      add(new THREE.SphereGeometry(0.045, 8, 6), std(0xffd54a), 0, 0.42, 0.01, item);
    }
  }

  // round blob shadow under the feet (Top1 / Among Us rule)
  const blob = new THREE.Mesh(new THREE.CircleGeometry(0.46, 20), new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.28, depthWrite: false }));
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = 0.03;
  root.add(blob);

  // name label (Top1 style: white, ink stroke; gold with a star for admins)
  if (name) {
    const label = nhanChu(opts.admin ? `★ ${name}` : name, { cao: 0.62, mau: opts.admin ? '#FFC43D' : '#FFFFFF' });
    label.position.y = headY + 0.98 * L.headSize + 0.42;
    root.add(label);
    root.userData.label = label;
  }

  /**
   * Plays one frame of the pose. phase advances while walking; amount eases 0 (standing) to 1 (full stride).
   * Priority: sitting, then an emote (userData.emote), then jumping (userData.air), then walking.
   */
  const parts = { legs, shoulderL, shoulderR, rig, head, item, REST_R };
  root.userData.animate = (phase, amount) => {
    const ud = root.userData;
    // start from the standing pose every frame, then apply what is happening
    legs[0].rotation.set(0, 0, 0);
    legs[1].rotation.set(0, 0, 0);
    shoulderL.rotation.set(0, 0, 0);
    shoulderR.rotation.set(0, 0, REST_R);
    rig.position.set(0, 0, 0);
    rig.rotation.set(0, 0, 0);
    head.rotation.set(0, 0, 0);
    if (item) { item.rotation.z = -REST_R + 0.1; item.visible = true; }

    if (ud.sitting) {
      // seated: legs forward, body lowered onto the seat
      legs[0].rotation.x = legs[1].rotation.x = -1.45;
      shoulderL.rotation.x = -0.6;
      shoulderR.rotation.x = -0.6;
      rig.position.y = ud.sitY ?? 0.1; // Top1 chairs are 0.5 m high (campus-export's sofas were lower)
      return;
    }
    if (ud.emote && EMOTE_POSES[ud.emote]) {
      EMOTE_POSES[ud.emote](performance.now() / 1000 - ud.emoteStart, parts);
      return;
    }
    if (ud.air) {
      // in the air: arms up, legs tucked
      legs[0].rotation.x = -0.5;
      legs[1].rotation.x = 0.35;
      shoulderL.rotation.z = 1.0;
      shoulderR.rotation.z = REST_R - 0.35;
      return;
    }
    const sw = Math.sin(phase) * 0.9 * amount;
    legs[0].rotation.x = sw;
    legs[1].rotation.x = -sw;
    shoulderL.rotation.x = -sw * 0.8;
    if (!item) shoulderR.rotation.x = sw * 0.8;
    rig.position.y = Math.abs(Math.sin(phase)) * 0.07 * amount;
    rig.rotation.z = Math.sin(phase) * 0.05 * amount;
    if (item) item.rotation.z = -REST_R + 0.1 + Math.sin(phase) * 0.08 * amount;
  };
  /** Start (id) or stop (null) an emote. It loops until stopped. */
  root.userData.setEmote = (id) => {
    root.userData.emote = id || null;
    root.userData.emoteStart = performance.now() / 1000;
  };
  root.userData.animate(0, 0);
}
