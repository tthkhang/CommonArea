// F8 — Phòng xem phim, Phòng họp, Cửa hàng & Thay đồ (không gian)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BAN_DO, phongTaiViTri, ngoiGhe, doiKhu } from '../public/js/logic.js';

const vat = (id) => BAN_DO.vat.find((v) => v.id === id);
const ghe = (phong) => BAN_DO.ghe.filter((g) => g.phong === phong);
test('rạp: màn hình rộng ≥ 8 m, ≥ 24 ghế, quầy bỏng ngô', () => {
  assert.ok(vat('man-hinh').rong >= 8);
  assert.ok(ghe('xem-phim').length >= 24, `${ghe('xem-phim').length} ghế`);
  assert.equal(phongTaiViTri(vat('quay-bong-ngo').x, vat('quay-bong-ngo').z), 'xem-phim');
});
test('ghế rạp quay mặt về màn hình', () => {
  const m = vat('man-hinh');
  for (const g of ghe('xem-phim')) {
    const muon = Math.atan2(m.x - g.x, m.z - g.z);
    let lech = Math.abs(muon - g.huong) % (2 * Math.PI); if (lech > Math.PI) lech = 2 * Math.PI - lech;
    assert.ok(lech <= Math.PI / 6, g.id);
  }
});
test('rạp tối hơn: ánh sáng khu xem phim ≤ 50% Phòng chung', () => {
  assert.ok(BAN_DO.khongKhi['xem-phim'].anhSang <= BAN_DO.khongKhi.chung.anhSang * 0.5);
});
test('phòng họp: 10 ghế + bảng trắng', () => {
  assert.equal(ghe('phong-hop').length, 10);
  assert.equal(phongTaiViTri(vat('bang-trang').x, vat('bang-trang').z), 'phong-hop');
});
test('cửa hàng: gương và quầy, "Sắp có"', () => {
  for (const id of ['guong', 'quay-cua-hang', 'gia-quan-ao']) {
    assert.equal(phongTaiViTri(vat(id).x, vat(id).z), 'cua-hang', id);
  }
  // combined game: the mirror opens the character customizer and the counter is the shop, so only the clothes rack is still "coming soon"
  assert.ok(!vat('guong').sapCo);
  assert.ok(!vat('quay-cua-hang').sapCo);
  assert.equal(vat('gia-quan-ao').sapCo, true);
});
test('ngồi ghế rạp rồi dịch chuyển sang khu khác → đứng dậy', () => {
  const g = ghe('xem-phim')[0];
  const s = { room: 'xem-phim', player: { x: g.x, z: g.z, seat: g.id }, ghe: ngoiGhe({}, g.id, 'Q').ghe };
  const s2 = doiKhu(s, 'phong-hop', 'Q');
  assert.equal(s2.player.seat, null);
  assert.equal(Object.keys(s2.ghe).length, 0);
});
