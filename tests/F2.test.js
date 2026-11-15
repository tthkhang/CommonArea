// F2 — Đi lại: WASD, chạm để đi, camera theo sau
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buocDi, TOC_DO, DT_TOI_DA, BAN_KINH } from '../public/js/logic.js';

const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const go = (p, phim, giay, vc = [], buoc = 1 / 60) => { for (let t = 0; t < giay - 1e-9; t += buoc) p = buocDi(p, phim, buoc, vc); return p; };

test('tốc độ 4 m/giây, W đi về -z', () => {
  assert.equal(TOC_DO, 4);
  const p = go({ x: 0, z: 0 }, { w: true }, 1);
  assert.ok(Math.abs(p.z + 4) < 0.05, `z=${p.z}`);
  assert.ok(Math.abs(p.x) < 1e-9);
});
test('A trái, S lùi, D phải', () => {
  assert.ok(go({ x: 0, z: 0 }, { a: true }, 1).x < -3.9);
  assert.ok(go({ x: 0, z: 0 }, { s: true }, 1).z > 3.9);
  assert.ok(go({ x: 0, z: 0 }, { d: true }, 1).x > 3.9);
});
test('đi chéo W+D không vượt 4 m/giây', () => {
  const p = go({ x: 0, z: 0 }, { w: true, d: true }, 1);
  assert.ok(dist(p, { x: 0, z: 0 }) <= 4.01, `${dist(p, { x: 0, z: 0 })}`);
  assert.ok(dist(p, { x: 0, z: 0 }) > 3.9);
});
test('dt bị giới hạn 0.1 giây (tab ẩn 5 giây không văng xa)', () => {
  assert.equal(DT_TOI_DA, 0.1);
  const p = buocDi({ x: 0, z: 0 }, { w: true }, 5, []);
  assert.ok(dist(p, { x: 0, z: 0 }) <= 0.41);
});
test('không nhấn phím thì đứng yên', () => {
  assert.deepEqual(buocDi({ x: 1, z: 2 }, {}, 0.1, []), { x: 1, z: 2 });
});
test('vector joystick: độ dài > 1 bị chuẩn hoá', () => {
  const p = go({ x: 0, z: 0 }, { x: 3, z: 0 }, 1);
  assert.ok(p.x <= 4.01 && p.x > 3.9);
});
const tuong = { loai: 'hop', x1: -10, x2: 10, z1: -5.25, z2: -4.75 }; // tường ngang ở z = -5
const cot = { loai: 'tron', x: 0, z: -3, r: 1 };
test('va chạm 1: không xuyên tường khi đi thẳng vào', () => {
  const p = go({ x: 0, z: 0 }, { w: true }, 3, [tuong]);
  assert.ok(p.z >= -4.75 + BAN_KINH - 0.01, `z=${p.z}`);
});
test('va chạm 2: trượt dọc tường khi đi chéo', () => {
  const p = go({ x: 0, z: -4 }, { w: true, d: true }, 1, [tuong]);
  assert.ok(p.x > 2, `trượt x=${p.x}`);
  assert.ok(p.z >= -4.75 + BAN_KINH - 0.01);
});
test('va chạm 3: không xuyên cột tròn', () => {
  const p = go({ x: 0, z: 0 }, { w: true }, 2, [cot]);
  assert.ok(dist(p, cot) >= 1 + BAN_KINH - 0.01, `${dist(p, cot)}`);
});
test('va chạm 4: lệch tâm cột thì trượt qua được', () => {
  const p = go({ x: 0.6, z: 0 }, { w: true }, 2, [cot]);
  assert.ok(p.z < -4, `z=${p.z}`);
});
test('va chạm 5: từ phía dưới tường đi lên không xuyên', () => {
  const p = go({ x: 0, z: -8 }, { s: true }, 3, [tuong]);
  assert.ok(p.z <= -5.25 - BAN_KINH + 0.01, `z=${p.z}`);
});
test('va chạm 6: góc giữa 2 tường không lọt', () => {
  const t2 = { loai: 'hop', x1: 4.75, x2: 5.25, z1: -10, z2: 10 };
  const p = go({ x: 0, z: 0 }, { w: true, d: true }, 4, [tuong, t2]);
  assert.ok(p.x <= 4.75 - BAN_KINH + 0.01 && p.z >= -4.75 + BAN_KINH - 0.01, JSON.stringify(p));
});
test('va chạm 7: dt lớn vẫn không xuyên tường mỏng', () => {
  let p = { x: 0, z: -4.3 };
  for (let i = 0; i < 20; i++) p = buocDi(p, { w: true }, 5, [tuong]);
  assert.ok(p.z > -4.75, `z=${p.z}`);
});
test('va chạm 8: đứng sẵn trong vật cản thì bị đẩy ra', () => {
  const p = buocDi({ x: 0, z: -3.2 }, {}, 0.016, [cot]);
  assert.ok(dist(p, cot) >= 1 + BAN_KINH - 0.01);
});
test('va chạm 9: hộp vuông đặc (bàn) không xuyên', () => {
  const ban = { loai: 'hop', x1: -1, x2: 1, z1: -4, z2: -2 };
  const p = go({ x: 0, z: 0 }, { w: true }, 3, [ban]);
  assert.ok(p.z >= -2 + BAN_KINH - 0.01);
});
test('va chạm 10: hành lang rộng 4 m đi xuyên qua được', () => {
  const trai = { loai: 'hop', x1: -2.25, x2: -1.75, z1: -20, z2: 0 };
  const phai = { loai: 'hop', x1: 1.75, x2: 2.25, z1: -20, z2: 0 };
  const p = go({ x: 0, z: 1 }, { w: true }, 4, [trai, phai]);
  assert.ok(p.z < -14);
});
