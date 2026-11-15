// F5 — Phòng chiêm tinh (không gian)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BAN_DO, phongTaiViTri } from '../public/js/logic.js';

const vat = (id) => BAN_DO.vat.find((v) => v.id === id);
test('3 cửa vòm + NPC Bà Đồng Sao nằm trong phòng chiêm tinh', () => {
  for (const id of ['cua-than-so', 'cua-tu-vi', 'cua-ban-do-sao', 'ba-dong', 'vong-hoang-dao']) {
    const v = vat(id);
    assert.ok(v, id);
    assert.equal(phongTaiViTri(v.x, v.z), 'chiem-tinh', id);
  }
});
test('tên cửa đúng, có "Sắp có" trong bảng thông tin', () => {
  assert.equal(vat('cua-than-so').ten, 'Numerology'); // combined game: English names
  assert.equal(vat('cua-tu-vi').ten, 'Horoscope');
  assert.equal(vat('cua-ban-do-sao').ten, 'Star Chart');
  for (const id of ['cua-than-so', 'cua-tu-vi', 'cua-ban-do-sao']) assert.ok(!vat(id).sapCo); // the readings work now
});
test('mỗi cửa một màu khác nhau (tím, đỏ, xanh)', () => {
  const m = ['cua-than-so', 'cua-tu-vi', 'cua-ban-do-sao'].map((id) => vat(id).mau);
  assert.equal(new Set(m).size, 3);
});

test('phòng chiêm tinh là đền đêm: ánh sáng ≤ 55% Phòng chung', () => {
  assert.ok(BAN_DO.khongKhi['chiem-tinh'].anhSang <= BAN_DO.khongKhi.chung.anhSang * 0.55);
});
