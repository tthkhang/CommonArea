// F7 — the east side of the map. This used to be the Garden Room (beds, pond, dock, stall);
// since 2026-11-15 the Garden Room is gone and the Quiet Forest stands there, reached through the plaza's east exit.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BAN_DO, PHONG, KHU, RUNG, LOI_RUNG, RAO_DONG, phongTaiViTri, vungTaiViTri, trongVungDi, timDuong, buocDi, vatCanTatCa } from '../public/js/logic.js';

test('the Garden Room and everything in it are gone', () => {
  assert.ok(!KHU.includes('trong-cay') && !PHONG['trong-cay']);
  for (const id of ['luong-1', 'ho-ca', 'ben-cau', 'quay-hang', 'dai-phun-nuoc', 'cong-trong-cay']) assert.ok(!BAN_DO.vat.some((v) => v.id === id), id);
  assert.equal(BAN_DO.nuoc.length, 0);
});
test('the forest starts at the east fence, opposite the plaza east exit, and overlaps no room', () => {
  assert.equal(RAO_DONG, 30);
  assert.ok(RUNG.x1 > RAO_DONG && RUNG.z1 < 0 && RUNG.z2 > 0);
  for (const id of KHU.slice(1)) { const r = PHONG[id].rect; assert.ok(r.x2 < RUNG.x1 || r.x1 > RUNG.x2 || r.z2 < RUNG.z1 || r.z1 > RUNG.z2, id); }
  assert.equal(vungTaiViTri(40, 0), 'rung'); assert.equal(vungTaiViTri(24, 0), 'loi-rung'); assert.equal(phongTaiViTri(24, 0), 'chung');
});
test('the path from the east exit to the forest gate is walkable and walled on both sides', () => {
  const vc = vatCanTatCa();
  assert.equal(LOI_RUNG.x1, 18); assert.ok(trongVungDi(24, 0) && !trongVungDi(24, 5) && !trongVungDi(24, -5));
  let p = { x: 12, z: 0 }; for (let i = 0; i < 600; i++) p = buocDi(p, { x: 1, z: 0 }, 1 / 60, vc);
  assert.ok(p.x > RAO_DONG, 'walk east from the plaza into the forest: x=' + p.x.toFixed(1));
  for (const dz of [1, -1]) { let q = { x: 25, z: 0 }; for (let i = 0; i < 300; i++) q = buocDi(q, { x: 0, z: dz }, 1 / 60, vc); assert.ok(Math.abs(q.z) < 2, 'side wall ' + dz); }
});
test('path finding goes from a room through the plaza and the east exit to the forest', () => {
  const route = timDuong(PHONG['tro-choi'].xuatHien, { x: 45, z: 0 });
  assert.ok(route.some((d) => Math.abs(d.x - 16) < 0.1 && Math.abs(d.z) < 0.1), JSON.stringify(route));
  assert.deepEqual(route[route.length - 1], { x: 45, z: 0 });
});
