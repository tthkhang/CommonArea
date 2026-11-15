// F4 — Bản đồ nối liền: đi giữa các phòng
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PHONG, KHU, phongTaiViTri, timDuong, buocDi, vatCanTatCa, trongVungDi, docLuu, doiKhu } from '../public/js/logic.js';

const vc = vatCanTatCa();
test('phongTaiViTri đúng cho 7 khu (giữa phòng, quảng trường, hành lang)', () => {
  for (const id of KHU) {
    const p = PHONG[id];
    const giua = id === 'chung' ? { x: 5, z: 5 } : { x: (p.rect.x1 + p.rect.x2) / 2, z: (p.rect.z1 + p.rect.z2) / 2 };
    assert.equal(phongTaiViTri(giua.x, giua.z), id, id);
  }
  for (const h of PHONG.chung.hanhLang) assert.equal(phongTaiViTri((h.x1 + h.x2) / 2, (h.z1 + h.z2) / 2), 'chung');
});
test('bản đồ kín: đi thẳng 60 m theo 8 hướng từ mỗi điểm xuất hiện không ra ngoài', () => {
  const huong = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]];
  for (const id of KHU) {
    for (const [x, z] of huong) {
      let p = { ...PHONG[id].xuatHien };
      for (let i = 0; i < 15 * 60; i++) {
        p = buocDi(p, { x, z }, 1 / 60, vc);
        assert.ok(trongVungDi(p.x, p.z), `${id} hướng ${x},${z} ra ngoài tại ${p.x.toFixed(1)},${p.z.toFixed(1)}`);
      }
    }
  }
});
const diTheo = (tu, den) => {
  const duong = timDuong(tu, den);
  let p = { ...tu }; let i = 0; let t = 0;
  while (i < duong.length && t < 30) {
    const d = duong[i]; const dx = d.x - p.x; const dz = d.z - p.z;
    if (Math.hypot(dx, dz) < 0.3) { i++; continue; }
    p = buocDi(p, { x: dx, z: dz }, 1 / 60, vc); t += 1 / 60;
  }
  return { p, t };
};
test('tìm đường từ đống lửa tới giữa mỗi phòng không kẹt (≤ 30 giây)', () => {
  for (const id of KHU.filter((k) => k !== 'chung')) {
    const r = PHONG[id].rect;
    const den = PHONG[id].giua ?? { x: (r.x1 + r.x2) / 2, z: (r.z1 + r.z2) / 2 };
    const { p, t } = diTheo(PHONG.chung.xuatHien, den);
    assert.ok(Math.hypot(p.x - den.x, p.z - den.z) <= 0.5, `${id}: còn cách ${Math.hypot(p.x - den.x, p.z - den.z).toFixed(2)} m sau ${t.toFixed(1)} s`);
    assert.equal(phongTaiViTri(p.x, p.z), id);
  }
});
test('tìm đường giữa 2 phòng khác nhau đi qua quảng trường', () => {
  const tu = PHONG['chiem-tinh'].xuatHien; const den = PHONG['xem-phim'].xuatHien;
  const { p } = diTheo(tu, den);
  assert.ok(Math.hypot(p.x - den.x, p.z - den.z) <= 0.5);
});
test('đổi khu bằng bản đồ: đứng ở điểm xuất hiện, rời ghế', () => {
  const s = { room: 'chung', player: { x: 0, z: 0, seat: 'ghe-x' }, ghe: { 'ghe-x': 'Q' } };
  const s2 = doiKhu(s, 'tro-choi', 'Q');
  assert.equal(s2.room, 'tro-choi');
  assert.equal(s2.player.seat, null);
  assert.deepEqual({ x: s2.player.x, z: s2.player.z }, PHONG['tro-choi'].xuatHien);
  assert.equal(s2.ghe['ghe-x'], undefined);
  assert.throws(() => doiKhu(s, 'khong-co', 'Q'));
});
test('tải lại trang: vị trí đã lưu hợp lệ thì giữ, ngoài bản đồ hoặc hỏng thì về đống lửa', () => {
  const v = PHONG['tro-choi'].xuatHien;
  const ok = docLuu(JSON.stringify({ ten: 'Q', mau: '#E5484D', x: v.x, z: v.z }));
  assert.equal(phongTaiViTri(ok.x, ok.z), 'tro-choi');
  for (const raw of [JSON.stringify({ x: 999, z: 999 }), JSON.stringify({ x: 'a', z: null }), '{oops']) {
    const d = docLuu(raw);
    assert.deepEqual({ x: d.x, z: d.z }, PHONG.chung.xuatHien, raw);
  }
});

test('điểm xuất hiện mỗi khu cách cửa ≥ 5 m khi cửa nằm giữa camera và nhân vật (không bị mái che)', () => {
  for (const id of KHU.filter((k) => k !== 'chung')) {
    const ph = PHONG[id]; const yaw = ph.yawCam ?? 0;
    const cam = { x: Math.sin(yaw), z: Math.cos(yaw) }; // hướng từ nhân vật về phía camera
    const r = ph.rect; const cua = ph.canh === 's' ? { x: ph.cua.trong.x, z: r.z2 } : ph.canh === 'n' ? { x: ph.cua.trong.x, z: r.z1 } : ph.canh === 'w' ? { x: r.x1, z: 0 } : { x: r.x2, z: 0 };
    const dx = cua.x - ph.xuatHien.x; const dz = cua.z - ph.xuatHien.z;
    if (dx * cam.x + dz * cam.z > 0) assert.ok(Math.hypot(dx, dz) >= 5, `${id}: cửa cách ${Math.hypot(dx, dz).toFixed(1)} m`);
  }
});
