// TEMPLATE for a room's client half (from campus-export). Copy this file, then:
//   1. set `id` to the room's id on the map (logic.js PHONG: 'chiem-tinh', 'tro-choi', 'trong-cay', 'phong-hop', 'cua-hang', ...)
//   2. register the module in rooms/index.js
//   3. (optional) give the room its own server class in public/shared/roomplugins.js -> REGISTRY
//
// The ctx you receive:
//   THREE, scene, room { id, name, rect, bounds, center }, net, state, ui { toast, createPanel }, world, css3d, WORLD, me(), music
//   world.themVaoPhong(room.id, object3D) registers anything you add to the scene as "inside only" (hidden from outside).
// Messages to / from your server room all start with "<id>." so rooms never clash; only players inside receive them.
import * as THREE from 'three';
import { toon } from '../world.js';

export default {
  id: 'template',

  setup(ctx) {
    const { scene, room, net, ui, world } = ctx;
    // ---- furnish the inside (only visible while you are in the room) ----
    const demo = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.5, 1.5), toon('#FFC43D'));
    demo.position.set(room.center.x, 0.75, room.center.z);
    scene.add(demo); world.themVaoPhong(room.id, demo);

    // ---- optional side panel, shown only while inside ----
    const panel = ui.createPanel(room.id, `✨ ${room.name}`, { hidden: true, contextual: true });
    const out = document.createElement('div'); out.className = 'meta'; out.textContent = 'No messages yet';
    const btn = document.createElement('button'); btn.textContent = 'Ping the room server';
    btn.addEventListener('click', () => net.send({ type: `${room.id}.ping`, text: 'hello' }));
    panel.body.append(out, btn);
    net.on(`${room.id}.pong`, (m) => { out.textContent = `Server says: ${m.text} from ${m.from} (${m.members} in the room)`; });

    return {
      /** Called when the local player walks in (true) or out (false). */
      setInside(inside) { panel.root.hidden = !inside; },
      /** Called every frame. */
      update(dt, now) { demo.rotation.y += dt; },
      /** E was pressed inside the room; return true if you used it. */
      interact(player) { return false; },
      /** A fixed camera while inside, e.g. { pos: Vector3, look: Vector3 }. null = Top1's normal camera. */
      camera: null,
      /** true = the shared music is muted while inside (like the cinema). */
      silencesMusic: false,
    };
  },
};
