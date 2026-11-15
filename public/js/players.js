// Everyone you can see (from campus-export's players.js, on campus-game-v4's messages): avatars, smoothed movement,
// walk / sit / jump / emote poses, speech bubbles, picking a player with the mouse.
// A record: { id, name, look, color, admin, x, z, ry, y, tx, tz, try, ty, moving, seat, area, room, gid, ownGid, emote, obj }
import { makeAvatar } from './avatar.js';
import { bubbleSprite, disposeSprite } from './util.js';

const BUBBLE_MS = 6000;

export function createPlayers({ scene, state }) {
  const all = state.players; // Map id -> record (includes the local player)
  let blocked = new Set();

  function dispose(rec) {
    disposeSprite(rec.bubble);
    scene.remove(rec.obj);
    rec.obj.traverse((o) => { o.geometry?.dispose(); if (o.material && o.material.map) o.material.map.dispose(); });
  }
  const rebuild = (rec) => rec.obj.userData.build(rec.look, rec.name, { admin: rec.admin });

  const api = {
    /** pub = the server's public player object. opts.obj = an existing avatar (the local player's). */
    add(pub, opts = {}) {
      if (all.has(pub.id)) api.remove(pub.id);
      const obj = opts.obj || makeAvatar(pub.name, pub.look);
      const rec = { ...pub, obj, tx: pub.x, tz: pub.z, try: pub.ry, ty: pub.y || 0, y: pub.y || 0, phase: Math.random() * 6, amount: 0, bubble: null, bubbleUntil: 0, isMe: !!opts.me };
      obj.userData.playerId = pub.id;
      if (!opts.obj) scene.add(obj);
      if (pub.admin || opts.obj) rebuild(rec);
      obj.position.set(rec.x, rec.y, rec.z); obj.rotation.y = rec.ry;
      obj.userData.sitting = !!rec.seat;
      if (rec.emote) obj.userData.setEmote(rec.emote);
      all.set(pub.id, rec);
      return rec;
    },
    remove(id) { const rec = all.get(id); if (rec && !rec.isMe) { dispose(rec); all.delete(id); } },
    /** rows: [id, x, z, ry, moving, y]; snap = jump there at once (after changing room / area). */
    setMoves(rows, snap) {
      for (const [id, x, z, ry, moving, y] of rows) {
        const rec = all.get(id); if (!rec || rec.isMe || rec.seat) continue;
        rec.tx = x; rec.tz = z; rec.try = ry; rec.ty = y || 0; rec.moving = !!moving;
        if (snap) { rec.x = x; rec.z = z; rec.ry = ry; rec.y = rec.ty; }
      }
    },
    setSeat(id, key, at) {
      const rec = all.get(id); if (!rec) return;
      rec.seat = key || null; rec.obj.userData.sitting = !!key;
      if (key && at) { rec.x = rec.tx = at.x; rec.z = rec.tz = at.z; rec.ry = rec.try = at.ry; rec.y = rec.ty = at.y || 0; rec.moving = false; rec.obj.userData.air = false; }
      if (!key) { rec.y = rec.ty = 0; }
    },
    setLook(id, look, name, color) { const rec = all.get(id); if (!rec) return; rec.look = look; rec.name = name; rec.color = color; rebuild(rec); },
    setAdmin(id) { const rec = all.get(id); if (!rec) return; rec.admin = true; rebuild(rec); },
    setEmote(id, emote) { const rec = all.get(id); if (!rec) return; rec.emote = emote || null; rec.obj.userData.setEmote(emote); },
    setBlocked(set) { blocked = set; },
    isBlocked: (id) => blocked.has(id),
    say(id, text) {
      const rec = all.get(id); if (!rec || blocked.has(id)) return;
      disposeSprite(rec.bubble);
      const s = bubbleSprite(text); s.position.set(0, 2.75, 0);
      rec.obj.add(s); rec.bubble = s; rec.bubbleUntil = performance.now() + BUBBLE_MS;
    },
    /** Which other player is under the pointer? (null if none) */
    pick(raycaster) {
      const groups = []; for (const rec of all.values()) if (!rec.isMe && rec.obj.visible) groups.push(rec.obj);
      for (const h of raycaster.intersectObjects(groups, true)) {
        let o = h.object; while (o && o.userData.playerId === undefined) o = o.parent;
        if (o) return o.userData.playerId;
      }
      return null;
    },
    /** Smooth and animate everyone except the local player (main.js drives that one). visible(rec) decides who is drawn. */
    update(dt, now, visible) {
      const k = 1 - Math.exp(-dt * 10);
      for (const rec of all.values()) {
        if (rec.bubble && now > rec.bubbleUntil) { disposeSprite(rec.bubble); rec.bubble = null; }
        if (rec.isMe) continue;
        const show = visible(rec) && !blocked.has(rec.id);
        rec.obj.visible = show;
        if (!show) { rec.x = rec.tx; rec.z = rec.tz; rec.ry = rec.try; rec.y = rec.ty; continue; }
        if (!rec.seat) {
          const dx = rec.tx - rec.x; const dz = rec.tz - rec.z; const dist = Math.hypot(dx, dz);
          if (dist > 8) { rec.x = rec.tx; rec.z = rec.tz; } else { rec.x += dx * k; rec.z += dz * k; }
          let d = rec.try - rec.ry; d = Math.atan2(Math.sin(d), Math.cos(d)); rec.ry += d * Math.min(1, dt * 12);
          const walking = rec.moving || dist > 0.12;
          rec.amount += ((walking ? 1 : 0) - rec.amount) * Math.min(1, dt * 12);
          if (walking) rec.phase += dt * 11;
          rec.y += (rec.ty - rec.y) * Math.min(1, dt * 18);
          rec.obj.userData.air = rec.y > 0.08;
        } else rec.amount = 0;
        rec.obj.position.set(rec.x, rec.y, rec.z); rec.obj.rotation.y = rec.ry;
        rec.obj.userData.animate(rec.phase, rec.amount);
      }
    },
  };
  return api;
}
