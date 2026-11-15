// campus-game-v4's drawing helpers (toon / mesh / box / cyl / sphere / textTexture / makeCharacter), re-implemented
// on Top1Server's look: the same 3-step toon material, plus an ink outline around the chunkier pieces.
// world2.js and features.js keep calling them exactly as they did in v4.
import * as THREE from 'three';
import { toon as toonTop1, vienMat, gradientMap, taoNhanVat } from './world.js';

export function makeKit(scene) {
  let root = scene; // default parent of box / cyl / sphere; world2.js switches it to build the forest in its own frame
  const toon = (color) => toonTop1(color);
  const size = new THREE.Vector3();
  function mesh(geo, color, x = 0, y = 0, z = 0, opts = {}) {
    const m = new THREE.Mesh(geo, typeof color === 'string' ? toon(color) : color);
    m.position.set(x, y, z);
    m.castShadow = opts.cast !== false;
    m.receiveShadow = opts.cast === false && opts.receive !== false; // like Top1: only ground pieces receive shadows
    if (typeof color === 'string' && opts.cast !== false) {
      if (!geo.boundingBox) geo.computeBoundingBox();
      geo.boundingBox.getSize(size);
      const least = Math.min(size.x, size.y, size.z); const most = Math.max(size.x, size.y, size.z);
      if (least >= 0.3 && most <= 26) { // ink outline: grow the shape by the same thickness on every side
        const ink = new THREE.Mesh(geo, vienMat); const t = most > 6 ? 0.07 : 0.04;
        ink.scale.set(1 + 2 * t / size.x, 1 + 2 * t / size.y, 1 + 2 * t / size.z);
        m.add(ink);
      }
    }
    return m;
  }
  function box(w, h, d, color, x, y, z, parent = root, opts) { const m = mesh(new THREE.BoxGeometry(w, h, d), color, x, y, z, opts); parent.add(m); return m; }
  function cyl(rt, rb, h, color, x, y, z, parent = root, seg = 20) { const m = mesh(new THREE.CylinderGeometry(rt, rb, h, seg), color, x, y, z); parent.add(m); return m; }
  function sphere(r, color, x, y, z, parent = root) { const m = mesh(new THREE.SphereGeometry(r, 18, 14), color, x, y, z); parent.add(m); return m; }
  function textTexture(lines, { w = 512, h = 128, bg = '#2B1F4D', fg = '#ffffff', font = '800 64px "Baloo 2", "Nunito", sans-serif' } = {}) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d');
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.fillStyle = fg; g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(lines, w / 2, h / 2 + 4);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  /** A non-player character in Top1's chibi style; `userData.body` is the part that bobs. */
  function makeCharacter(color) { const g = taoNhanVat(color); g.userData.body = g.userData.than; return g; }
  return { toon, mesh, box, cyl, sphere, textTexture, gradient: gradientMap(), makeCharacter, setRoot: (g) => { root = g; } };
}
