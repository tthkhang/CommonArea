// Renders small pictures of the avatar for the customizer: one picture per option, using the
// real avatar builder, so the pictures can never drift from what the game shows.
import * as THREE from 'three';
import { makeAvatar } from './avatar.js';

// camera framing presets: where to look (y), how far (d), which way the avatar faces (yaw)
const FRAMES = {
  eyes: { y: (h) => h + 0.0, d: 1.5 },
  mouth: { y: (h) => h - 0.15, d: 1.35 },
  cheeks: { y: (h) => h - 0.06, d: 1.6 },
  head: { y: (h) => h + 0.0, d: 2.7 },
  torso: { y: () => 0.52, d: 2.9 },
  legs: { y: () => 0.25, d: 2.3 },
  neck: { y: () => 0.72, d: 2.1 },
  item: { x: -0.5, y: () => 1.0, d: 2.7 },
  full: { y: () => 0.95, d: 5.3 },
};

export function createThumbRenderer(size = 128) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(size, size);
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#FFFFFF', '#B9A6D6', 2.2));
  const key = new THREE.DirectionalLight('#FFF1DA', 2.2);
  key.position.set(2, 4, 6);
  scene.add(key);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  const avatar = makeAvatar('', {}); // empty name = no name label
  scene.add(avatar);
  const cache = new Map();

  /** look: full look object; frame: { f: 'item'|'neck'|'eyes'|'mouth'|'cheeks'|'head'|'torso'|'legs'|'full', yaw? } -> PNG data URL */
  function render(look, frame) {
    const id = JSON.stringify([look, frame]);
    const hit = cache.get(id);
    if (hit) return hit;
    avatar.userData.build(look, '');
    avatar.rotation.y = frame.yaw || 0;
    const headY = 0.62 + 0.5 * (look.headSize ?? 1);
    const fr = FRAMES[frame.f] || FRAMES.full;
    const y = fr.y(headY);
    const x = fr.x || 0;
    camera.position.set(x, y + 0.1, fr.d);
    camera.lookAt(x, y, 0);
    renderer.render(scene, camera);
    const url = renderer.domElement.toDataURL('image/png');
    if (cache.size > 400) cache.clear();
    cache.set(id, url);
    return url;
  }
  return { render };
}
