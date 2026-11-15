// F6 — Phòng trò chơi (không gian)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BAN_DO, phongTaiViTri } from '../public/js/logic.js';

const ban = BAN_DO.ban.filter((b) => b.phong === 'tro-choi');
test('4 bàn đúng tên và đúng số ghế: Ma sói 10, Bài Màu 4, Cá ngựa 4, Ghép màu 2', () => {
  const muon = { Werewolf: 10, 'Colour Cards': 4, Ludo: 4, 'Colour Match': 2 }; // combined game: English names; the spec's second round adds 2 Werewolf chairs
  assert.deepEqual(ban.map((b) => b.ten).sort(), Object.keys(muon).sort());
  for (const b of ban) {
    assert.equal(BAN_DO.ghe.filter((g) => g.ban === b.id).length, muon[b.ten], b.ten);
    assert.equal(b.soGhe, muon[b.ten]);
  }
});
test('mọi ghế nằm trong phòng trò chơi và quay mặt vào giữa bàn (lệch ≤ 15°)', () => {
  for (const b of ban) for (const g of BAN_DO.ghe.filter((x) => x.ban === b.id)) {
    assert.equal(phongTaiViTri(g.x, g.z), 'tro-choi', g.id);
    const muon = Math.atan2(b.x - g.x, b.z - g.z);
    let lech = Math.abs(muon - g.huong) % (2 * Math.PI);
    if (lech > Math.PI) lech = 2 * Math.PI - lech;
    assert.ok(lech <= (15 * Math.PI) / 180, `${g.id} lệch ${(lech * 180 / Math.PI).toFixed(1)}°`);
  }
});
test('bàn có bảng thông tin "Sắp có" và đồ vật gợi ý', () => {
  for (const b of ban) { assert.ok(!b.sapCo, b.ten); assert.ok(b.doVat.length > 0, b.ten); } // combined game: the four games are playable now
});
