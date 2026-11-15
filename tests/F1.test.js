// F1 — Vào game: chọn tên và màu nhân vật
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { kiemTraTen, MAU_NHAN_VAT, docLuu } from '../public/js/logic.js';

test('tên: cắt khoảng trắng 2 đầu', () => {
  const r = kiemTraTen('   Lê Quân  ');
  assert.equal(r.ok, true);
  assert.equal(r.ten, 'Lê Quân');
});
test('tên: rỗng / dưới 2 / trên 16 ký tự bị từ chối, có lời báo tiếng Việt', () => {
  for (const bad of ['', '   ', 'A', 'Một cái tên rất dài quá', 'x'.repeat(17)]) {
    const r = kiemTraTen(bad);
    assert.equal(r.ok, false, bad);
    assert.ok(r.loi && r.loi.length > 5, 'có lời báo');
  }
  assert.equal(kiemTraTen('x'.repeat(16)).ok, true);
  assert.equal(kiemTraTen('Ab').ok, true);
});
test('tên tiếng Việt có dấu hợp lệ', () => {
  for (const ok of ['Lê Quân', 'Đặng Thị Ánh', 'Ngọc Hà 99']) assert.equal(kiemTraTen(ok).ok, true, ok);
});
test('12 màu nhân vật đúng style.md, không trùng', () => {
  const style = ['#E5484D', '#3E63DD', '#30A46C', '#F76BAF', '#F76B15', '#FFC53D', '#3A3A44', '#F2F2F2', '#8E4EC6', '#A0663B', '#12A594', '#99D52A'];
  assert.equal(MAU_NHAN_VAT.length, 12);
  assert.equal(new Set(MAU_NHAN_VAT).size, 12);
  assert.deepEqual(MAU_NHAN_VAT.map((m) => m.toUpperCase()), style);
});
test('đọc dữ liệu đã lưu: hỏng hoặc trống → mặc định, không lỗi', () => {
  for (const raw of [null, undefined, '', '{', 'null', '42', '{"mau":"#123456"}', '{"ten":5}']) {
    const d = docLuu(raw);
    assert.equal(d.mau, MAU_NHAN_VAT[0], String(raw));
    assert.equal(typeof d.ten, 'string');
  }
});
test('đọc dữ liệu đã lưu: hợp lệ thì giữ tên và màu', () => {
  const d = docLuu(JSON.stringify({ ten: 'Lê Quân', mau: MAU_NHAN_VAT[4] }));
  assert.equal(d.ten, 'Lê Quân');
  assert.equal(d.mau, MAU_NHAN_VAT[4]);
});
