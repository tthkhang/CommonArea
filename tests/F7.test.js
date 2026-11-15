// F7 — Phòng trồng cây (không gian)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BAN_DO, phongTaiViTri, buocDi, vatCanTatCa, BAN_KINH } from '../public/js/logic.js';

const vat = (id) => BAN_DO.vat.find((v) => v.id === id);
test('có 6 luống, hồ cá, bến câu, quầy hàng, đài phun nước trong vườn', () => {
  for (const id of ['luong-1', 'luong-2', 'luong-3', 'luong-4', 'luong-5', 'luong-6', 'ho-ca', 'ben-cau', 'quay-hang', 'dai-phun-nuoc']) {
    assert.ok(vat(id), id);
    assert.equal(phongTaiViTri(vat(id).x, vat(id).z), 'trong-cay', id);
  }
});
test('nước là vật cản: đi thẳng vào hồ 3 giây vẫn ở ngoài mép', () => {
  const vc = vatCanTatCa();
  for (const ho of BAN_DO.nuoc) {
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      let p = { x: ho.x - dx * (ho.r + 1.5), z: ho.z - dz * (ho.r + 1.5) };
      if (phongTaiViTri(p.x, p.z) !== 'trong-cay') continue;
      for (let i = 0; i < 180; i++) p = buocDi(p, { x: dx, z: dz }, 1 / 60, vc);
      assert.ok(Math.hypot(p.x - ho.x, p.z - ho.z) >= ho.r + BAN_KINH - 0.02, `${ho.id} hướng ${dx},${dz}`);
    }
  }
});
test('bến câu đứng được (không nằm trong nước)', () => {
  const b = vat('ben-cau');
  for (const ho of BAN_DO.nuoc) assert.ok(Math.hypot(b.diemDung.x - ho.x, b.diemDung.z - ho.z) >= ho.r + BAN_KINH);
});
