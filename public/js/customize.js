// Character customizer (from campus-export): tabs of picture options + a live, draggable 3D preview.
// Controls are generated from SECTIONS, so adding an option is one entry plus a line in avatar.js.
import * as THREE from 'three';
import { makeAvatar, DEFAULT_LOOK, CHOICES, SKIN_TONES } from './avatar.js';
import { createThumbRenderer } from './thumbs.js';

const C = (key, label, extra = {}) => ({ key, label, type: 'choice', options: CHOICES[key], ...extra });
const COL = (key, label, extra = {}) => ({ key, label, type: 'color', ...extra });
const TOG = (key, label, extra = {}) => ({ key, label, type: 'toggle', ...extra });
const RNG = (key, label, min, max, step = 0.01, extra = {}) => ({ key, label, type: 'range', min, max, step, ...extra });

// How each option is pictured: which part of the character to zoom on (see thumbs.js).
// `force` overrides other settings so the option is actually visible (hairstyles are hidden under a hood).
const FRAME = {
  eyeStyle: { f: 'eyes' }, brow: { f: 'eyes' }, mouth: { f: 'mouth' }, blush: { f: 'cheeks' }, glasses: { f: 'eyes' },
  hairStyle: { f: 'head', yaw: 0.8, force: { hood: 'none' } },
  hood: { f: 'head', yaw: 0.9 },
  top: { f: 'torso' }, crossStraps: { f: 'torso' }, scarf: { f: 'neck', yaw: 0.3 }, backpack: { f: 'torso', yaw: 2.8 },
  legs: { f: 'legs' }, boots: { f: 'legs', yaw: 0.5 },
  item: { f: 'item' }, headSize: { f: 'full' }, bodySize: { f: 'full' },
};
const PALETTE = ['#1b1b1b', '#5a3a1f', '#a0522d', '#d9a441', '#f0f0f0', '#d6b48c', '#c0392b', '#e67e22', '#2e8b57', '#2c7fb8', '#6a4fb3', '#e07aa8'];

const SECTIONS = [
  { id: 'body', title: 'Body', fields: [
    { key: 'skin', label: 'Skin tone', type: 'color', presets: SKIN_TONES },
    RNG('headSize', 'Head size', 0.85, 1.2),
    RNG('bodySize', 'Body width', 0.8, 1.3),
  ] },
  { id: 'face', title: 'Face', fields: [
    C('eyeStyle', 'Eyes'),
    COL('eyeColor', 'Eye color'),
    C('brow', 'Eyebrows'),
    C('mouth', 'Mouth'),
    TOG('blush', 'Blush'),
    TOG('glasses', 'Glasses'),
  ] },
  { id: 'hair', title: 'Hair', fields: [
    C('hairStyle', 'Style'),
    COL('hairA', (l) => (l.hairStyle === 'split' ? 'Hair color (left)' : 'Hair color')),
    COL('hairB', 'Hair color (right)', { showIf: (l) => l.hairStyle === 'split' }),
    { note: 'With the hood up, only the fringe and side locks show. Put the hood down to see the full hairstyle.' },
  ] },
  { id: 'outfit', title: 'Outfit', fields: [
    C('hood', 'Hood'),
    COL('hoodColor', 'Hood color', { showIf: (l) => l.hood !== 'none' }),
    C('top', 'Top'),
    COL('outfit', 'Top color'),
    TOG('crossStraps', 'Cross straps'),
    COL('trim', 'Straps, belt and laces'),
    C('legs', 'Legs'),
    COL('pants', 'Pants color', { showIf: (l) => l.legs === 'pants' }),
    C('boots', 'Footwear'),
    COL('bootColor', 'Footwear color', { showIf: (l) => l.boots !== 'sandals' }),
  ] },
  { id: 'extras', title: 'Extras', fields: [
    C('item', 'Held item'),
    COL('itemColor', 'Item accent color', { showIf: (l) => l.item !== 'none' }),
    TOG('scarf', 'Scarf'),
    COL('scarfColor', 'Scarf color', { showIf: (l) => l.scarf }),
    TOG('backpack', 'Backpack'),
    COL('backpackColor', 'Backpack color', { showIf: (l) => l.backpack }),
  ] },
];

const hex = (c) => `#${new THREE.Color(c).getHexString()}`;
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randomColor = () => hex(new THREE.Color().setHSL(Math.random(), rnd(0.3, 0.8), rnd(0.3, 0.75)));

/**
 * onChange(look, name) is called after every change. `root` is the element to fill.
 */
export function createCustomizer(root, { look: initialLook = DEFAULT_LOOK, name: initialName = 'You', onChange }) {
  let look = { ...DEFAULT_LOOK, ...initialLook };
  let name = initialName;
  let open = false;
  const syncers = []; // functions that refresh the controls from `look`

  // ---------------------------------------------------------------- DOM
  root.innerHTML = `
    <div class="cz-card" role="dialog" aria-label="Customize your character">
      <div class="cz-preview">
        <canvas id="cz-canvas" width="300" height="380"></canvas>
        <label class="cz-walk"><input type="checkbox" id="cz-walk" /> Preview walking</label>
        <div class="cz-hint">Drag to turn</div>
      </div>
      <div class="cz-main">
        <div class="cz-head">
          <h2>Customize character</h2>
          <button id="cz-close" class="ghost" aria-label="Close">✕</button>
        </div>
        <label class="cz-name">Name <input id="cz-name" type="text" maxlength="16" autocomplete="off" /></label>
        <div class="cz-tabs" id="cz-tabs"></div>
        <div class="cz-body" id="cz-body"></div>
        <div class="cz-foot">
          <button id="cz-random" class="ghost">🎲 Randomize</button>
          <button id="cz-reset" class="ghost">Reset</button>
          <button id="cz-done">Done</button>
        </div>
      </div>
    </div>`;
  const $ = (id) => root.querySelector(`#${id}`);
  const tabsEl = $('cz-tabs');
  const bodyEl = $('cz-body');
  const panes = {};

  const emit = () => {
    refreshAll();
    previewAvatar.userData.build(look, name || 'You');
    onChange(look, name || 'You');
    scheduleThumbs();
  };
  const set = (key, value) => {
    look = { ...look, [key]: value };
    emit();
  };

  // ---------------------------------------------------------------- pictures
  const thumbRenderer = createThumbRenderer(128);
  const thumbs = []; // { img, key, value }
  function pictureButton(key, value, title, small = false) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'opt' + (small ? ' small' : '');
    b.title = title;
    b.setAttribute('aria-label', title);
    const img = new Image();
    img.alt = title;
    img.draggable = false;
    b.append(img);
    thumbs.push({ img, key, value });
    return b;
  }
  function updateThumbs() {
    if (!open) return;
    for (const t of thumbs) {
      if (!t.img.offsetParent) continue; // hidden tab or hidden row: skip the work
      const fr = FRAME[t.key] || { f: 'full' };
      t.img.src = thumbRenderer.render({ ...look, ...(fr.force || {}), [t.key]: t.value }, fr);
    }
  }
  let thumbTimer = 0;
  const scheduleThumbs = () => {
    clearTimeout(thumbTimer);
    thumbTimer = setTimeout(updateThumbs, 40);
  };

  function makeField(f) {
    const row = document.createElement('div');
    row.className = 'cz-row';
    if (f.note) {
      row.className = 'cz-note';
      row.textContent = f.note;
      return row;
    }
    const labelEl = document.createElement('div');
    labelEl.className = 'cz-label';
    row.append(labelEl);
    const ctl = document.createElement('div');
    ctl.className = 'cz-ctl';
    row.append(ctl);

    if (f.type === 'choice') {
      const btns = f.options.map((o) => {
        const b = pictureButton(f.key, o.v, o.label);
        b.addEventListener('click', () => set(f.key, o.v));
        ctl.append(b);
        return [o.v, b];
      });
      syncers.push(() => btns.forEach(([v, b]) => b.classList.toggle('on', look[f.key] === v)));
    } else if (f.type === 'color') {
      const palette = f.presets || PALETTE;
      const sw = palette.map((c) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'swatch';
        b.style.background = c;
        b.title = c;
        b.addEventListener('click', () => set(f.key, c));
        ctl.append(b);
        return [c, b];
      });
      syncers.push(() => sw.forEach(([c, b]) => b.classList.toggle('on', look[f.key].toLowerCase() === c)));
      const input = document.createElement('input');
      input.type = 'color';
      input.title = 'Pick any color';
      input.addEventListener('input', () => set(f.key, input.value));
      ctl.append(input);
      syncers.push(() => { input.value = hex(look[f.key]); });
    } else if (f.type === 'toggle') {
      // a picture of the option switched on; click to switch it on or off
      const b = pictureButton(f.key, true, typeof f.label === 'function' ? f.label(look) : f.label);
      b.addEventListener('click', () => set(f.key, !look[f.key]));
      ctl.append(b);
      syncers.push(() => b.classList.toggle('on', !!look[f.key]));
    } else if (f.type === 'range') {
      // small pictures of the smallest and largest setting on each side of the slider
      const lo = pictureButton(f.key, f.min, 'Smallest', true);
      const hi = pictureButton(f.key, f.max, 'Largest', true);
      const input = document.createElement('input');
      input.type = 'range';
      input.min = f.min; input.max = f.max; input.step = f.step;
      input.addEventListener('input', () => set(f.key, parseFloat(input.value)));
      lo.addEventListener('click', () => set(f.key, f.min));
      hi.addEventListener('click', () => set(f.key, f.max));
      ctl.append(lo, input, hi);
      syncers.push(() => { input.value = look[f.key]; });
    }
    syncers.push(() => {
      labelEl.textContent = typeof f.label === 'function' ? f.label(look) : f.label;
      row.hidden = f.showIf ? !f.showIf(look) : false;
    });
    return row;
  }

  SECTIONS.forEach((s, i) => {
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = 'cz-tab';
    tab.textContent = s.title;
    tab.addEventListener('click', () => showTab(s.id));
    tabsEl.append(tab);
    const pane = document.createElement('div');
    pane.className = 'cz-pane';
    s.fields.forEach((f) => pane.append(makeField(f)));
    bodyEl.append(pane);
    panes[s.id] = { tab, pane };
    if (i === 0) tab.classList.add('on');
  });
  function showTab(id) {
    for (const [k, p] of Object.entries(panes)) {
      p.tab.classList.toggle('on', k === id);
      p.pane.hidden = k !== id;
    }
    scheduleThumbs();
  }
  showTab('body');

  const refreshAll = () => syncers.forEach((fn) => fn());

  $('cz-name').value = name;
  $('cz-name').addEventListener('input', (e) => {
    name = e.target.value.trim();
    emit();
  });
  $('cz-close').addEventListener('click', () => api.close());
  $('cz-done').addEventListener('click', () => api.close());
  $('cz-reset').addEventListener('click', () => {
    look = { ...DEFAULT_LOOK };
    emit();
  });
  $('cz-random').addEventListener('click', () => {
    const next = { ...look };
    for (const s of SECTIONS) {
      for (const f of s.fields) {
        if (!f.key) continue;
        if (f.type === 'choice') next[f.key] = pick(f.options).v;
        else if (f.type === 'toggle') next[f.key] = Math.random() < 0.35;
        else if (f.type === 'range') next[f.key] = Math.round(rnd(f.min, f.max) * 100) / 100;
        else if (f.presets) next[f.key] = pick(f.presets);
        else next[f.key] = randomColor();
      }
    }
    look = next;
    emit();
  });
  addEventListener('keydown', (e) => {
    if (open && e.key === 'Escape') api.close();
  });
  root.addEventListener('mousedown', (e) => {
    if (e.target === root) api.close(); // click on the dark backdrop
  });

  // ---------------------------------------------------------------- 3D preview
  const canvas = $('cz-canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(300, 380, false);
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#FFFFFF', '#B9A6D6', 2.2));
  const key = new THREE.DirectionalLight('#FFF1DA', 2.2);
  key.position.set(3, 5, 6);
  scene.add(key);
  const stage = new THREE.Mesh(
    new THREE.CylinderGeometry(0.9, 0.95, 0.06, 40),
    new THREE.MeshToonMaterial({ color: '#F3EDE4' })
  );
  stage.position.y = -0.03;
  scene.add(stage);
  const camera = new THREE.PerspectiveCamera(34, 300 / 380, 0.1, 50);
  camera.position.set(0, 1.3, 6.9);
  camera.lookAt(0, 1.0, 0);
  const previewAvatar = makeAvatar(name || 'You', look);
  scene.add(previewAvatar);

  let yaw = 0.3;
  let dragging = false;
  let lastX = 0;
  let autoSpin = true;
  canvas.addEventListener('pointerdown', (e) => {
    dragging = true;
    autoSpin = false;
    lastX = e.clientX;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    yaw += (e.clientX - lastX) * 0.012;
    lastX = e.clientX;
  });
  canvas.addEventListener('pointerup', () => { dragging = false; });

  let phase = 0;
  let amount = 0;
  let last = performance.now();
  function frame(now) {
    if (!open) return;
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    if (autoSpin) yaw += dt * 0.5;
    const walking = $('cz-walk').checked;
    amount += ((walking ? 1 : 0) - amount) * Math.min(1, dt * 10);
    if (walking) phase += dt * 11;
    previewAvatar.userData.animate(phase, amount);
    previewAvatar.rotation.y = yaw;
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }

  const api = {
    isOpen: () => open,
    open() {
      open = true;
      root.classList.add('open');
      last = performance.now();
      refreshAll();
      scheduleThumbs();
      requestAnimationFrame(frame);
    },
    close() {
      open = false;
      root.classList.remove('open');
    },
    getLook: () => look,
    /** Replace the look from outside (the 12 quick outfit colours on the entry screen). */
    setLook(l) { look = { ...DEFAULT_LOOK, ...l }; refreshAll(); previewAvatar.userData.build(look, name || 'You'); scheduleThumbs(); },
    setName(n) {
      name = n;
      $('cz-name').value = n;
      previewAvatar.userData.build(look, name || 'You');
    },
  };

  refreshAll();
  return api;
}
