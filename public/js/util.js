// Small shared helpers: DOM, text escaping, speech bubbles.
import * as THREE from 'three';
import { MUC } from './world.js';

export const $ = (id) => document.getElementById(id);
export const qs = (sel) => document.querySelector(sel);
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function el(tag, props = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') n.className = v;
    else if (k === 'text') n.textContent = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else if (v !== undefined && v !== null && v !== false) n.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) if (kid != null) n.append(kid.nodeType ? kid : document.createTextNode(kid));
  return n;
}

export const fmtTime = (s) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(Math.round(s % 60)).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
};

/** A speech bubble above a character: wrapped text on a white rounded box with an ink border (Top1 style). */
export function bubbleSprite(text) {
  const size = 40; const maxW = 380;
  const c = document.createElement('canvas'); const ctx = c.getContext('2d');
  const font = `700 ${size}px "Nunito", system-ui, sans-serif`;
  ctx.font = font;
  const lines = []; let line = '';
  for (const w of String(text).split(/\s+/)) {
    const t = line ? `${line} ${w}` : w;
    if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t;
  }
  lines.push(line);
  const shown = lines.slice(0, 4); if (lines.length > 4) shown[3] += '…';
  const w = Math.min(maxW, Math.max(...shown.map((l) => ctx.measureText(l).width))) + 52;
  const h = shown.length * (size + 6) + 36;
  c.width = Math.ceil(w); c.height = h + 26;
  ctx.font = font; ctx.lineJoin = 'round';
  const shape = () => { ctx.beginPath(); ctx.roundRect(5, 5, c.width - 10, h - 6, 26); ctx.moveTo(c.width / 2 - 14, h - 2); ctx.lineTo(c.width / 2, h + 20); ctx.lineTo(c.width / 2 + 14, h - 2); };
  shape(); ctx.lineWidth = 10; ctx.strokeStyle = MUC; ctx.stroke();
  shape(); ctx.fillStyle = '#FFFFFF'; ctx.fill();
  ctx.fillStyle = MUC; ctx.textBaseline = 'top';
  shown.forEach((l, i) => ctx.fillText(l, 26, 20 + i * (size + 6)));
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  s.scale.set(c.width * 0.0105, c.height * 0.0105, 1); s.center.set(0.5, 0); s.renderOrder = 12;
  return s;
}

export function disposeSprite(s) {
  if (!s) return;
  s.material.map?.dispose(); s.material.dispose(); s.parent?.remove(s);
}
