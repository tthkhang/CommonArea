// F3 — Phòng chung (quảng trường)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PHONG, KHU, BAN_DO, vatCanTatCa, ngoiGhe, dungDay, BAN_KINH, phongTaiViTri } from '../public/js/logic.js';

const vc = vatCanTatCa();
const trong = (p, o) => o.loai === 'tron' ? Math.hypot(p.x - o.x, p.z - o.z) < o.r + BAN_KINH - 0.01
  : p.x > o.x1 - BAN_KINH + 0.01 && p.x < o.x2 + BAN_KINH - 0.01 && p.z > o.z1 - BAN_KINH + 0.01 && p.z < o.z2 + BAN_KINH - 0.01;

test('7 khu đúng id, có tên tiếng Việt, điểm xuất hiện nằm trong khu và không đè vật cản', () => {
  assert.deepEqual(KHU, ['chung', 'chiem-tinh', 'tro-choi', 'trong-cay', 'xem-phim', 'phong-hop', 'cua-hang']);
  for (const id of KHU) {
    const p = PHONG[id];
    assert.ok(p.ten.length > 3, id);
    assert.equal(phongTaiViTri(p.xuatHien.x, p.xuatHien.z), id, `xuất hiện của ${id}`);
    assert.ok(!vc.some((o) => trong(p.xuatHien, o)), `xuất hiện ${id} đè vật cản`);
  }
});
test('Phòng chung: xuất hiện cách đống lửa ≤ 3 m', () => {
  const lua = BAN_DO.vat.find((v) => v.id === 'dong-lua');
  const p = PHONG.chung.xuatHien;
  assert.ok(Math.hypot(p.x - lua.x, p.z - lua.z) <= 3);
});
test('6 cổng vòm ở quảng trường, mỗi cổng dẫn tới một phòng', () => {
  const cong = BAN_DO.vat.filter((v) => v.loai === 'cong');
  assert.deepEqual(cong.map((c) => c.id).sort(), KHU.filter((k) => k !== 'chung').map((k) => `cong-${k}`).sort());
  for (const c of cong) assert.equal(phongTaiViTri(c.x, c.z), 'chung', c.id);
});
test('≥ 4 bàn học chung, mỗi bàn 4 ghế; có góc nhạc', () => {
  const ban = BAN_DO.ban.filter((b) => b.phong === 'chung');
  assert.ok(ban.length >= 4);
  for (const b of ban) assert.equal(BAN_DO.ghe.filter((g) => g.ban === b.id).length, 4, b.id);
  assert.ok(BAN_DO.vat.some((v) => v.id === 'loa-nhac' && v.phong === 'chung'));
});
test('ngồi ghế trống được; ghế có người thì báo lỗi', () => {
  const g = BAN_DO.ghe.find((x) => x.phong === 'chung');
  const r1 = ngoiGhe({}, g.id, 'Lê Quân');
  assert.equal(r1.ok, true);
  assert.equal(r1.ghe[g.id], 'Lê Quân');
  const r2 = ngoiGhe(r1.ghe, g.id, 'Người khác');
  assert.equal(r2.ok, false);
  assert.equal(r2.loi, 'That seat is taken');
  const r3 = dungDay(r1.ghe, 'Lê Quân');
  assert.equal(r3[g.id], undefined);
});
test('ngồi ghế khác thì tự rời ghế cũ', () => {
  const [a, b] = BAN_DO.ghe.filter((x) => x.phong === 'chung');
  const r = ngoiGhe(ngoiGhe({}, a.id, 'Q').ghe, b.id, 'Q');
  assert.equal(r.ghe[a.id], undefined);
  assert.equal(r.ghe[b.id], 'Q');
});
test('ghế không tồn tại thì báo lỗi', () => {
  assert.equal(ngoiGhe({}, 'ghe-khong-co', 'Q').ok, false);
});

test('Phòng chung: từ điểm xuất hiện bấm W 1 giây đi được ≥ 3 m, không đâm vào lửa', async () => {
  const { buocDi } = await import('../public/js/logic.js');
  let p = { ...PHONG.chung.xuatHien };
  for (let i = 0; i < 60; i++) p = buocDi(p, { w: true }, 1 / 60, vc);
  assert.ok(PHONG.chung.xuatHien.z - p.z >= 3, `chỉ đi ${(PHONG.chung.xuatHien.z - p.z).toFixed(2)} m`);
});
