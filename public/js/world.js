// The 3D world (from Top1Server) — DRAWING ONLY. Rules (positions, collisions, zones, seats) live in logic.js.
// Combined game: every room also gets a closed shell (walls, roof, door curtain, sign) as in campus-export;
// what is inside a room is hidden until you walk in. Identifiers stay Vietnamese as in the original Top1 code.
// Quy tắc vẽ: 1-wiki/design/style.md (Play Together: đồ chơi bo tròn, chibi · Among Us: viền đậm, tô phẳng 3 bậc).
import * as THREE from 'three';
import { BAN_DO, PHONG, KHU, QUANG_TRUONG, LOI_RUNG, RAO_DONG, phongTaiViTri } from './logic.js';

export const MUC = '#2B1F4D'; // --ink: màu viền

// ---------------------------------------------------------------- vật liệu
let gradient = null;
export function gradientMap() {
  if (gradient) return gradient;
  gradient = new THREE.DataTexture(new Uint8Array([90, 175, 255]), 3, 1, THREE.RedFormat);
  gradient.minFilter = THREE.NearestFilter; gradient.magFilter = THREE.NearestFilter; gradient.generateMipmaps = false;
  gradient.needsUpdate = true;
  return gradient;
}
const matCache = new Map();
/** Vật liệu tô phẳng 3 bậc (toon). `phat` = độ tự phát sáng 0..1. */
export function toon(mau, phat = 0, opts = {}) {
  const key = `${mau}|${phat}|${opts.trongSuot ?? ''}`;
  if (matCache.has(key) && !opts.rieng) return matCache.get(key);
  const m = new THREE.MeshToonMaterial({ color: mau, gradientMap: gradientMap() });
  if (phat) { m.emissive = new THREE.Color(mau); m.emissiveIntensity = phat; }
  if (opts.trongSuot) { m.transparent = true; m.opacity = opts.trongSuot; m.depthWrite = false; }
  if (!opts.rieng) matCache.set(key, m);
  return m;
}
export const vienMat = new THREE.MeshBasicMaterial({ color: MUC, side: THREE.BackSide });

// ---------------------------------------------------------------- hình khối
/** Hộp bo góc (đồ chơi): mỗi đỉnh chiếu lên mặt cầu bán kính r quanh hộp bên trong → pháp tuyến mượt. */
export function hopBo(w, h, d, r = 0.08, k = 1) {
  r = Math.max(0.001, Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3));
  const s = 2 * k + 1;
  const g = new THREE.BoxGeometry(w, h, d, s, s, s);
  const pos = g.attributes.position; const nor = g.attributes.normal;
  const half = [w / 2, h / 2, d / 2];
  const p = new THREE.Vector3(); const inner = new THREE.Vector3(); const dir = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    const c = [p.x, p.y, p.z].map((v, a) => {
      const H = half[a]; const idx = Math.round(((v + H) / (2 * H)) * s);
      if (idx <= k) return -H + r * (idx / k);
      return H - r * ((s - idx) / k);
    });
    p.set(c[0], c[1], c[2]);
    inner.set(...c.map((v, a) => Math.max(-(half[a] - r), Math.min(v, half[a] - r))));
    dir.subVectors(p, inner);
    if (dir.lengthSq() < 1e-12) continue;
    dir.normalize();
    p.copy(inner).addScaledVector(dir, r);
    pos.setXYZ(i, p.x, p.y, p.z); nor.setXYZ(i, dir.x, dir.y, dir.z);
  }
  return g;
}

/** Gộp nhiều hình tĩnh cùng màu thành 1 lưới (ít lệnh vẽ → nhẹ máy). Viền gộp riêng thành 1 lưới mực. */
function gopHinh(ds, vien = 0) {
  let n = 0;
  const parts = ds.map(({ geo, mat }) => {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    g.applyMatrix4(mat);
    if (vien) {
      const p = g.attributes.position; const q = g.attributes.normal;
      for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) + q.getX(i) * vien, p.getY(i) + q.getY(i) * vien, p.getZ(i) + q.getZ(i) * vien);
    }
    n += g.attributes.position.count; return g;
  });
  const pos = new Float32Array(n * 3); const nor = new Float32Array(n * 3); let o = 0;
  for (const g of parts) { pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); o += g.attributes.position.count; g.dispose(); }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.computeBoundingSphere(); out.computeBoundingBox();
  return out;
}

class Gop {
  constructor() { this.nhom = new Map(); this.vien = new Map(); }
  /** geo đặt tại (x,y,z), quay ry quanh trục y. opts: {phat, vien:bề dày viền, khu, bong, trongSuot} */
  them(geo, mau, x, y, z, opts = {}) {
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(opts.rx ?? 0, opts.ry ?? 0, opts.rz ?? 0, 'YXZ')), new THREE.Vector3(opts.sx ?? 1, opts.sy ?? 1, opts.sz ?? 1));
    if (opts.cha) m.premultiply(opts.cha);
    const khu = opts.khu ?? phongTaiViTri(x, z);
    if (geo.boundingSphere === null) geo.computeBoundingSphere();
    if (opts.bong === undefined && geo.boundingSphere.radius * Math.max(opts.sx ?? 1, opts.sy ?? 1, opts.sz ?? 1) < 0.35) opts = { ...opts, bong: false };
    const key = `${khu}|${mau}|${opts.phat ?? 0}|${opts.trongSuot ?? ''}|${opts.bong === false ? 0 : 1}|${opts.nhanBong ? 1 : 0}`;
    if (!this.nhom.has(key)) this.nhom.set(key, { khu, mau, phat: opts.phat ?? 0, trongSuot: opts.trongSuot, bong: opts.bong !== false, nhanBong: !!opts.nhanBong, ds: [] });
    this.nhom.get(key).ds.push({ geo, mat: m });
    // vật nhỏ (< 0.3 m) không cần viền: ở khoảng cách sa bàn viền không thấy, chỉ tốn tam giác
    const nho = geo.boundingSphere && geo.boundingSphere.radius * Math.max(opts.sx ?? 1, opts.sy ?? 1, opts.sz ?? 1) < 0.3;
    const v = nho ? 0 : (opts.vien ?? 0.035);
    if (v > 0) { const kv = `${khu}|${v}`; if (!this.vien.has(kv)) this.vien.set(kv, { khu, v, ds: [] }); this.vien.get(kv).ds.push({ geo, mat: m }); }
  }
  xay(scene) {
    const meshes = [];
    for (const g of this.nhom.values()) {
      const mesh = new THREE.Mesh(gopHinh(g.ds), toon(g.mau, g.phat, { trongSuot: g.trongSuot }));
      mesh.castShadow = g.bong && !g.trongSuot; mesh.receiveShadow = !!g.nhanBong; mesh.matrixAutoUpdate = false;
      mesh.userData.khu = g.khu; scene.add(mesh); meshes.push(mesh);
    }
    for (const g of this.vien.values()) {
      const mesh = new THREE.Mesh(gopHinh(g.ds, g.v), vienMat); mesh.matrixAutoUpdate = false;
      mesh.userData.khu = g.khu; scene.add(mesh); meshes.push(mesh);
    }
    return meshes;
  }
}

// hình dùng chung (không tạo lại)
const G = {
  cau: new THREE.SphereGeometry(1, 14, 10),
  cauThap: new THREE.SphereGeometry(1, 10, 8),
  tru: new THREE.CylinderGeometry(1, 1, 1, 14),
  tru8: new THREE.CylinderGeometry(1, 1, 1, 8),
  non: new THREE.ConeGeometry(1, 1, 12),
  non4: new THREE.ConeGeometry(1, 1, 4),
  hop: new THREE.BoxGeometry(1, 1, 1),
  hoa: new THREE.OctahedronGeometry(1, 0), // bông hoa nhỏ: 8 tam giác
  // lăng trụ tam giác đáy 1 × cao 1 × sâu 1 (mái tam giác kiểu đền Hy Lạp)
  tamGiac: (() => { const s = new THREE.Shape([new THREE.Vector2(-0.5, 0), new THREE.Vector2(0.5, 0), new THREE.Vector2(0, 1)]);
    const g = new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false }); g.translate(0, 0, -0.5); g.computeVertexNormals(); return g; })(),
  // bình gốm (amphora) tiện tròn
  binh: new THREE.LatheGeometry([[0, 0], [0.18, 0.02], [0.3, 0.25], [0.34, 0.5], [0.26, 0.78], [0.14, 0.9], [0.13, 1.05], [0.2, 1.12], [0, 1.12]].map(([x, y]) => new THREE.Vector2(x, y)), 12),
};

// ---------------------------------------------------------------- chữ / biển
const anh = {};
export async function taiAnh(ten) {
  if (anh[ten]) return anh[ten];
  const img = new Image(); img.src = `./assets/${ten}`;
  try { await img.decode(); } catch { /* thiếu ảnh thì biển chỉ có chữ */ }
  anh[ten] = img; return img;
}
function bo(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }

/** Biển gỗ/đá có icon + chữ (CanvasTexture). */
export function veBien(chu, { nen = '#7A4DFF', icon = null, rong = 512, cao = 160, coChu = 64, vien = '#FFC43D' } = {}) {
  const c = document.createElement('canvas'); c.width = rong; c.height = cao;
  const ctx = c.getContext('2d');
  bo(ctx, 6, 6, rong - 12, cao - 12, 36); ctx.fillStyle = MUC; ctx.fill();
  bo(ctx, 14, 14, rong - 28, cao - 28, 30); ctx.fillStyle = nen; ctx.fill();
  ctx.lineWidth = 6; ctx.strokeStyle = vien; bo(ctx, 22, 22, rong - 44, cao - 44, 24); ctx.stroke();
  let x = rong / 2;
  const iw = icon && icon.naturalWidth ? cao * 0.5 : 0;
  // chữ to nhất có thể mà vẫn vừa biển
  for (; coChu > 30; coChu -= 2) { ctx.font = `800 ${coChu}px "Baloo 2", "Nunito", sans-serif`; if (ctx.measureText(chu).width + (iw ? iw + 14 : 0) <= rong - 56) break; }
  ctx.textBaseline = 'middle';
  const tw = ctx.measureText(chu).width;
  x = rong / 2 - (tw + (iw ? iw + 14 : 0)) / 2;
  if (iw) { ctx.drawImage(icon, x, cao / 2 - iw / 2, iw, iw); x += iw + 14; }
  ctx.lineWidth = 10; ctx.strokeStyle = MUC; ctx.lineJoin = 'round'; ctx.strokeText(chu, x, cao / 2 + 4);
  ctx.fillStyle = '#FFFFFF'; ctx.fillText(chu, x, cao / 2 + 4);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  t.userData.tiLeChu = (coChu * 0.72) / cao; // chiều cao chữ (không dấu) / chiều cao biển
  return t;
}
/** Chữ nổi (sprite) — tên người chơi, tên bàn. */
export function nhanChu(chu, { coChu = 56, mau = '#FFFFFF', cao = 0.5 } = {}) {
  const c = document.createElement('canvas'); const ctx = c.getContext('2d');
  ctx.font = `800 ${coChu}px "Baloo 2", "Nunito", sans-serif`;
  c.width = Math.ceil(ctx.measureText(chu).width + 40); c.height = Math.ceil(coChu * 1.5);
  ctx.font = `800 ${coChu}px "Baloo 2", "Nunito", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = coChu * 0.22; ctx.lineJoin = 'round'; ctx.strokeStyle = MUC; ctx.strokeText(chu, c.width / 2, c.height / 2 + 3);
  ctx.fillStyle = mau; ctx.fillText(chu, c.width / 2, c.height / 2 + 3);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthWrite: false }));
  s.scale.set((cao * c.width) / c.height, cao, 1); s.renderOrder = 10;
  return s;
}

// ---------------------------------------------------------------- nhân vật chibi (thiết kế riêng)
const DA = '#FFE1CC';
function toiMau(hex, k) { return '#' + new THREE.Color(hex).lerp(new THREE.Color(MUC), k).getHexString(); }

/** Nhân vật chibi: đầu to (~55% chiều cao), áo choàng ngắn màu người chơi, viền mực, bóng tròn dưới chân. */
export function taoNhanVat(mau, opts = {}) {
  const goc = new THREE.Group(); const than = new THREE.Group(); goc.add(than);
  const aoMat = toon(mau, 0, { rieng: true }); const toiMat = toon(toiMau(mau, 0.35), 0, { rieng: true });
  const phan = {};
  const them = (ten, geo, mat, x, y, z, s = [1, 1, 1], vien = 0.05, cha = than) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(...s); m.castShadow = true; cha.add(m);
    if (vien) { const v = new THREE.Mesh(geo, vienMat); v.scale.setScalar(1 + vien / Math.min(...s)); m.add(v); }
    phan[ten] = m; return m;
  };
  // chân (nhóm để xoay khi đi)
  for (const [ten, x] of [['chanTrai', -0.13], ['chanPhai', 0.13]]) {
    const ch = new THREE.Group(); ch.position.set(x, 0.3, 0); than.add(ch); phan[ten] = ch;
    them(`${ten}M`, G.tru, toiMat, 0, -0.14, 0, [0.09, 0.26, 0.09], 0.025, ch);
    them(`${ten}G`, G.cau, toon('#5A3E2B'), 0, -0.27, 0.04, [0.11, 0.07, 0.15], 0.02, ch);
  }
  them('ao', new THREE.CylinderGeometry(0.24, 0.36, 0.52, 14), aoMat, 0, 0.53, 0, [1, 1, 1], 0.035);
  them('dai', new THREE.TorusGeometry(0.27, 0.035, 6, 16), toon('#FFC43D', 0.15), 0, 0.6, 0, [1, 1, 1], 0).rotation.x = Math.PI / 2;
  them('choang', new THREE.CylinderGeometry(0.27, 0.42, 0.5, 12, 1, true, Math.PI * 0.55, Math.PI * 0.9), toiMat, 0, 0.55, -0.02, [1, 1, 1], 0);
  phan.choang.material = toon(toiMau(mau, 0.35), 0, { rieng: true }); phan.choang.material.side = THREE.DoubleSide;
  for (const [ten, x] of [['tayTrai', -0.33], ['tayPhai', 0.33]]) {
    const t = new THREE.Group(); t.position.set(x, 0.72, 0); than.add(t); phan[ten] = t;
    them(`${ten}M`, G.cau, aoMat, 0, -0.13, 0, [0.085, 0.17, 0.085], 0.025, t);
    them(`${ten}B`, G.cau, toon(DA), 0, -0.29, 0, [0.075, 0.075, 0.075], 0.02, t);
  }
  const dau = new THREE.Group(); dau.position.set(0, 1.12, 0); than.add(dau); phan.dau = dau;
  them('mat', G.cau, toon(DA), 0, 0, 0, [0.42, 0.4, 0.4], 0.04, dau);
  them('toc', new THREE.SphereGeometry(1, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), toon(opts.toc ?? toiMau(mau, 0.15), 0, { rieng: true }), 0, 0.04, -0.02, [0.45, 0.43, 0.44], 0.04, dau);
  phan.toc.material.side = THREE.DoubleSide;
  them('mai', G.cau, phan.toc.material, 0, 0.26, 0.26, [0.3, 0.1, 0.16], 0.02, dau);
  for (const x of [-0.14, 0.14]) {
    const m = them(`mat${x}`, G.cau, toon('#1E1633'), x, -0.02, 0.36, [0.065, 0.09, 0.04], 0, dau);
    them(`sang${x}`, G.cau, new THREE.MeshBasicMaterial({ color: '#FFFFFF' }), 0.3, 0.35, 0.6, [0.35, 0.3, 0.35], 0, m);
    them(`ma${x}`, G.cau, new THREE.MeshBasicMaterial({ color: '#FF9DB0', transparent: true, opacity: 0.7 }), x * 1.45, -0.13, 0.33, [0.07, 0.04, 0.03], 0, dau);
  }
  them('mieng', new THREE.TorusGeometry(0.045, 0.012, 4, 10, Math.PI), toon('#7A2D3A'), 0, -0.14, 0.385, [1, 1, 1], 0, dau).rotation.z = Math.PI;
  if (opts.mu) { // mũ trùm (NPC)
    them('mu', G.non, toon(opts.mu), 0, 0.42, -0.05, [0.4, 0.55, 0.4], 0.04, dau).rotation.x = -0.25;
  }
  // bóng tròn dưới chân (Among Us)
  const bong = new THREE.Mesh(new THREE.CircleGeometry(0.42, 20), new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.28, depthWrite: false }));
  bong.rotation.x = -Math.PI / 2; bong.position.y = 0.03; goc.add(bong);
  goc.userData = { phan, than, aoMat, toiMat, tocMat: phan.toc.material, choangMat: phan.choang.material, pha: Math.random() * 6 };

  goc.datMau = (m) => {
    goc.userData.aoMat.color.set(m); goc.userData.toiMat.color.set(toiMau(m, 0.35));
    goc.userData.choangMat.color.set(toiMau(m, 0.35)); if (!opts.toc) goc.userData.tocMat.color.set(toiMau(m, 0.15));
  };
  /** trangThai: 'di' | 'dung' | 'ngoi' */
  goc.hoatCanh = (t, trangThai) => {
    const { phan: p, than: th } = goc.userData; const f = t * 11 + goc.userData.pha;
    if (trangThai === 'di') {
      th.position.y = Math.abs(Math.sin(f)) * 0.09; th.scale.set(1, 1, 1);
      p.chanTrai.rotation.x = Math.sin(f) * 0.6; p.chanPhai.rotation.x = -Math.sin(f) * 0.6;
      p.tayTrai.rotation.x = -Math.sin(f) * 0.7; p.tayPhai.rotation.x = Math.sin(f) * 0.7;
      p.dau.rotation.z = Math.sin(f) * 0.05;
    } else if (trangThai === 'ngoi') {
      th.position.y = 0.12; th.scale.set(1, 1, 1);
      p.chanTrai.rotation.x = p.chanPhai.rotation.x = -1.45; p.tayTrai.rotation.x = p.tayPhai.rotation.x = -0.4; p.dau.rotation.z = 0;
    } else {
      const b = Math.sin(t * 2.2 + goc.userData.pha);
      th.position.y = 0; th.scale.set(1 + b * 0.012, 1 - b * 0.015, 1 + b * 0.012);
      p.chanTrai.rotation.x = p.chanPhai.rotation.x = 0; p.tayTrai.rotation.x = p.tayPhai.rotation.x = b * 0.05; p.dau.rotation.z = 0;
    }
  };
  return goc;
}

// ---------------------------------------------------------------- dựng thế giới
const DA_TRANG = '#F3EDE4'; const DA_BONG = '#D9CFE3'; const CAM_THACH = '#F7F3EA';

export async function dungTheGioi(scene) {
  const gop = new Gop();
  const dong = []; // vật động (hoạt cảnh)
  const proxy = []; // khối vô hình để chạm (raycast)
  const vatDiem = {}; // id → Vector3 (điểm để screenOf)
  const bienCong = {}; // id cổng → mesh biển (đo cỡ chữ)
  const proxyMat = new THREE.MeshBasicMaterial({ visible: false });
  const thuChay = { nen: 0, ca: [], gon: null, giot: null, vong: null, lua: null, manHinh: null };

  const themProxy = (id, x, y, z, w, h, d, ry = 0) => {
    const m = new THREE.Mesh(G.hop, proxyMat); m.position.set(x, y, z); m.scale.set(w, h, d); m.rotation.y = ry;
    m.userData.id = id; m.userData.khu = phongTaiViTri(x, z); scene.add(m); proxy.push(m); vatDiem[id] = new THREE.Vector3(x, y, z);
  };

  const icons = {};
  for (const id of KHU) icons[id] = await taiAnh(`icon-${PHONG[id].icon}.svg`);

  // ---- sa bàn (ảnh mẫu PO): cỏ bên ngoài, khu đất cát trong hàng rào trắng, bãi cỏ có hoa, cây tròn
  const nenNgoai = new THREE.Mesh(new THREE.PlaneGeometry(500, 500), toon('#8FD16F'));
  nenNgoai.rotation.x = -Math.PI / 2; nenNgoai.position.y = -0.08; nenNgoai.receiveShadow = true; scene.add(nenNgoai);
  const LO = { x1: -50, x2: RAO_DONG, z1: -55, z2: 57 }; // east side: the fence in front of the Quiet Forest
  gop.them(G.hop, '#F2E3C6', (LO.x1 + LO.x2) / 2, -0.05, (LO.z1 + LO.z2) / 2, { sx: LO.x2 - LO.x1, sy: 0.06, sz: LO.z2 - LO.z1, khu: 'ngoai', vien: 0, bong: false, nhanBong: true });
  // hàng rào trắng
  let soRao = 0;
  const rao = (x1, z1, x2, z2) => {
    const dai = Math.hypot(x2 - x1, z2 - z1); const n = Math.round(dai / 2.2); const ry = Math.atan2(x2 - x1, z2 - z1);
    for (let i = 0; i <= n; i++) { const k = i / n; gop.them(G.hop, '#FFFFFF', x1 + (x2 - x1) * k, 0.47, z1 + (z2 - z1) * k, { sx: 0.22, sy: 0.95, sz: 0.22, khu: `rao-${Math.round(x1)}-${Math.round(z1)}-${Math.round(x2)}`, vien: 0.025 }); }
    for (const y of [0.35, 0.75]) gop.them(G.hop, '#FFFFFF', (x1 + x2) / 2, y, (z1 + z2) / 2, { sx: 0.08, sy: 0.12, sz: dai, ry, khu: `rao-${Math.round(x1)}-${Math.round(z1)}-${Math.round(x2)}`, vien: 0.02, bong: false });
    soRao++;
  };
  rao(LO.x1, LO.z1, LO.x2, LO.z1); rao(LO.x1, LO.z2, LO.x2, LO.z2); rao(LO.x1, LO.z1, LO.x1, LO.z2);
  rao(LO.x2, LO.z1, LO.x2, LOI_RUNG.z1 - 1.2); rao(LO.x2, LOI_RUNG.z2 + 1.2, LO.x2, LO.z2); // east side, open at the forest gate
  thuChay.rao = soRao;
  const coBai = [[-48, -53, -31, -14], [-48, 14, -31, 55], [-1.4, -53, 1.4, -27], [-1.4, 27, 1.4, 55]]; // (the two lawns in the east made way for the forest)
  const hoaMau = ['#FFFFFF', '#F28AC0', '#FFC43D', '#C9A7FF', '#FF6B6B'];
  let hat = 7;
  const ngauNhien = () => { hat = (hat * 9301 + 49297) % 233280; return hat / 233280; };
  for (const [x1, z1, x2, z2] of coBai) {
    gop.them(hopBo(x2 - x1, 0.1, z2 - z1, 0.05), '#A6DE7E', (x1 + x2) / 2, -0.01, (z1 + z2) / 2, { khu: 'ngoai', vien: 0, bong: false, nhanBong: true });
    const soHoa = Math.round(((x2 - x1) * (z2 - z1)) / 18);
    for (let i = 0; i < soHoa; i++) gop.them(G.hoa, hoaMau[i % hoaMau.length], x1 + 0.6 + ngauNhien() * (x2 - x1 - 1.2), 0.1, z1 + 0.6 + ngauNhien() * (z2 - z1 - 1.2), { sx: 0.13, sy: 0.08, sz: 0.13, khu: 'ngoai', vien: 0, bong: false });
  }
  thuChay.cay = 0; thuChay.dem = {};
  const dem = (khu, loai) => { thuChay.dem[khu] ??= {}; thuChay.dem[khu][loai] = (thuChay.dem[khu][loai] ?? 0) + 1; };
  const cay = (x, z, s = 1, khu) => {
    dem(khu, 'cay');
    gop.them(G.tru8, '#8A5A3B', x, 0.75 * s, z, { sx: 0.22 * s, sy: 1.5 * s, sz: 0.22 * s, khu, vien: 0.03, bong: true });
    gop.them(G.cauThap, '#5DBB63', x, 2.15 * s, z, { sx: 1.25 * s, sy: 1.15 * s, sz: 1.25 * s, khu, vien: 0.05 });
    gop.them(G.cauThap, '#73CC6E', x + 0.35 * s, 2.7 * s, z + 0.3 * s, { sx: 0.75 * s, sy: 0.7 * s, sz: 0.75 * s, khu, vien: 0.04 });
    thuChay.cay++;
  };

  const gheBang = (x, z, ry, khu) => {
    const cha = new THREE.Matrix4().compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(1, 1, 1));
    gop.them(hopBo(1.8, 0.1, 0.5, 0.04), '#B07A4F', 0, 0.45, 0, { cha, khu, vien: 0.025 });
    gop.them(hopBo(1.8, 0.4, 0.08, 0.03), '#B07A4F', 0, 0.75, -0.22, { cha, khu, vien: 0.02 });
    for (const lx of [-0.75, 0.75]) gop.them(hopBo(0.08, 0.45, 0.4, 0.02), '#3B2F4F', lx, 0.22, 0, { cha, khu, vien: 0.015, bong: false });
  };
  // ---- đồ Hy Lạp (PO: raw/answers-4.md): cột cẩm thạch, mái tam giác, tượng, bình gốm, ô liu, bách
  thuChay.mai = 0; thuChay.tuong = 0; thuChay.binh = 0;
  const cotHyLap = (x, z, cao, khu, r = 0.32) => {
    gop.them(hopBo(r * 2.8, 0.28, r * 2.8, 0.05), CAM_THACH, x, 0.14, z, { khu, vien: 0.03 });
    gop.them(G.tru, CAM_THACH, x, cao / 2 + 0.2, z, { sx: r, sy: cao - 0.5, sz: r, khu, vien: 0.035 });
    gop.them(hopBo(r * 2.9, 0.3, r * 2.9, 0.05), CAM_THACH, x, cao - 0.1, z, { khu, vien: 0.03 });
  };
  const maiTamGiac = (x, z, y, rong, ry, mau, khu) => {
    gop.them(hopBo(rong, 0.45, 0.9, 0.06), CAM_THACH, x, y, z, { ry, khu, vien: 0.035 });                 // xà ngang
    gop.them(hopBo(rong + 0.1, 0.12, 0.95, 0.03), '#FFC43D', x, y + 0.28, z, { ry, khu, vien: 0.02, bong: false }); // viền vàng
    gop.them(G.tamGiac, mau, x, y + 0.34, z, { sx: rong + 0.3, sy: 1.25, sz: 0.85, ry, khu, vien: 0.04 });   // trán tường màu phòng
    gop.them(G.cau, '#FFC43D', x, y + 1.7, z, { sx: 0.2, sy: 0.2, sz: 0.2, khu, vien: 0.02, phat: 0.4, bong: false });
    thuChay.mai++;
  };
  const tuongBanThan = (x, z, ry, khu) => {
    gop.them(hopBo(0.9, 1.2, 0.9, 0.06), CAM_THACH, x, 0.6, z, { khu, vien: 0.03 });
    gop.them(G.cau, '#EDE6DA', x, 1.55, z, { sx: 0.48, sy: 0.38, sz: 0.3, ry, khu, vien: 0.03 });
    gop.them(G.cau, '#EDE6DA', x, 2.05, z, { sx: 0.26, sy: 0.3, sz: 0.27, ry, khu, vien: 0.03 });
    gop.them(G.cau, '#9DB874', x, 2.25, z, { sx: 0.28, sy: 0.08, sz: 0.28, ry, khu, vien: 0.015, bong: false }); // vòng nguyệt quế
    thuChay.tuong++;
  };
  const binhGom = (x, z, khu, s = 1) => {
    gop.them(G.binh, '#C8673A', x, 0, z, { sx: s, sy: s, sz: s, khu, vien: 0.03 });
    gop.them(G.tru, '#2B1F4D', x, 0.52 * s, z, { sx: 0.345 * s, sy: 0.1 * s, sz: 0.345 * s, khu, vien: 0, bong: false });
    thuChay.binh++;
  };
  const oLiu = (x, z, s, khu) => {
    dem(khu, 'cay'); thuChay.cay++;
    gop.them(G.tru8, '#7A5A44', x, 0.7 * s, z, { sx: 0.2 * s, sy: 1.4 * s, sz: 0.2 * s, rz: 0.15, khu, vien: 0.03, bong: true });
    for (const [dx, dy, dz, k] of [[0, 2.0, 0, 1], [0.6, 1.7, 0.3, 0.75], [-0.55, 1.8, -0.2, 0.7]]) gop.them(G.cauThap, k === 1 ? '#9DB874' : '#8AA865', x + dx * s, dy * s, z + dz * s, { sx: 1.0 * s * k, sy: 0.75 * s * k, sz: 1.0 * s * k, khu, vien: 0.04 });
  };
  const bach = (x, z, s, khu) => {
    dem(khu, 'cay'); thuChay.cay++;
    gop.them(G.tru8, '#6B4630', x, 0.3 * s, z, { sx: 0.15 * s, sy: 0.6 * s, sz: 0.15 * s, khu, vien: 0.02, bong: true });
    gop.them(G.cauThap, '#3E7F4E', x, 2.0 * s, z, { sx: 0.6 * s, sy: 1.9 * s, sz: 0.6 * s, khu, vien: 0.04 });
  };

  // cây quanh sa bàn
  [[-45, -50, 1.2], [-38, -44, 1.0], [-44, -36, 1.3], [-36, -26, 1.1], [-45, -20, 1.0], [36, -50, 1.3], [46, -46, 1.1], [56, -50, 1.2],
    [40, -36, 1.0], [54, -30, 1.3], [36, -29, 1.1], [-44, 18, 1.2], [-36, 26, 1.0], [-45, 34, 1.3], [-37, 44, 1.1], [-44, 52, 1.0], [36, 26, 1.2],
    [46, 32, 1.0], [56, 26, 1.3], [40, 44, 1.1], [52, 50, 1.2], [36, 54, 1.0], [0, -44, 0.9], [0, 40, 0.9]].filter(([x]) => x < RAO_DONG).forEach(([x, z, s], i) => (i % 3 === 1 ? bach(x, z, s * 1.1, 'ngoai') : i % 3 === 2 ? oLiu(x, z, s, 'ngoai') : cay(x, z, s, 'ngoai')));

  // ---- sàn từng khu
  const san = (r, mau, khu, cao = 0.12) => gop.them(G.hop, mau, (r.x1 + r.x2) / 2, -cao / 2 + 0.01, (r.z1 + r.z2) / 2, { sx: r.x2 - r.x1 + 0.5, sy: cao, sz: r.z2 - r.z1 + 0.5, khu, vien: 0, bong: false, nhanBong: true });
  { // sân gạch cam nhạt kẻ ô như ảnh mẫu
    const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
    x.fillStyle = '#F6C894'; x.fillRect(0, 0, 128, 128); x.strokeStyle = '#E3AE74'; x.lineWidth = 4; x.strokeRect(2, 2, 124, 124);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(18, 18);
    tex.magFilter = THREE.NearestFilter;
    const m = new THREE.MeshToonMaterial({ map: tex, gradientMap: gradientMap() });
    const sanQT = new THREE.Mesh(new THREE.PlaneGeometry(36, 36), m); sanQT.rotation.x = -Math.PI / 2; sanQT.position.y = 0.012; sanQT.receiveShadow = true; scene.add(sanQT);
  }
  for (const h of PHONG.chung.hanhLang) san(h, '#EAD7B0', 'chung');
  const mauSan = { 'chiem-tinh': '#6A55B0', 'tro-choi': '#FFF1DE', 'trong-cay': '#9ED88A', 'xem-phim': '#3A3F86', 'phong-hop': '#E2B58A', 'cua-hang': '#F9DCEA' };
  for (const id of KHU.slice(1)) san(PHONG[id].rect, mauSan[id], id);

  // ---- quảng trường: vòng đá quanh đống lửa
  gop.them(G.tru, '#E9DCCB', 0, 0.03, 0, { sx: 4.2, sy: 0.05, sz: 4.2, khu: 'chung', vien: 0, bong: false, nhanBong: true });
  for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; gop.them(hopBo(0.9, 0.12, 0.5, 0.04), '#D8C7B0', Math.sin(a) * 3.7, 0.06, Math.cos(a) * 3.7, { ry: a, khu: 'chung', vien: 0.02, bong: false, nhanBong: true }); }
  // đống lửa
  gop.them(G.tru, CAM_THACH, 0, 0.14, 0, { sx: 1.75, sy: 0.28, sz: 1.75, khu: 'chung', vien: 0.04 });
  gop.them(G.tru, CAM_THACH, 0, 0.45, 0, { sx: 1.35, sy: 0.35, sz: 1.35, khu: 'chung', vien: 0.04 });
  gop.them(G.tru, CAM_THACH, 0, 0.95, 0, { sx: 0.45, sy: 0.7, sz: 0.45, khu: 'chung', vien: 0.035 });
  gop.them(new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), '#C98A3A', 0, 1.65, 0, { sx: 1.05, sy: 0.6, sz: 1.05, khu: 'chung', vien: 0.04 });
  gop.them(new THREE.TorusGeometry(1.05, 0.08, 6, 24), '#FFC43D', 0, 1.65, 0, { rx: Math.PI / 2, khu: 'chung', vien: 0.02 });
  const lua = new THREE.Group(); lua.position.set(0, 1.6, 0); scene.add(lua);
  const luaMat = [toon('#FF8A2B', 1), toon('#FFD447', 1)];
  const luaPhan = [[0.55, 1.5, '#FF8A2B'], [0.38, 1.1, '#FFD447']].map(([r, h], i) => {
    const m = new THREE.Mesh(G.non, luaMat[i]); m.scale.set(r, h, r); m.position.y = h / 2; lua.add(m); return m;
  });
  const den = new THREE.PointLight('#FFB04D', 14, 16, 1.8); den.position.set(0, 3, 0); scene.add(den);
  thuChay.lua = den;
  dong.push((t) => {
    const f = 0.85 + Math.sin(t * 13) * 0.08 + Math.sin(t * 7.3) * 0.07;
    luaPhan[0].scale.y = 1.5 * f; luaPhan[1].scale.y = 1.1 * (1.9 - f); lua.rotation.y = t * 0.8;
    den.intensity = 14 * f;
  });
  vatDiem['dong-lua'] = new THREE.Vector3(0, 1, 0);
  // cột góc + bụi hoa + đèn lồng
  for (const [x, z] of [[-16.6, -16.6], [16.6, -16.6], [-16.6, 16.6], [16.6, 16.6]]) {
    cotHyLap(x, z, 4.6, 'chung', 0.55);
    gop.them(G.cauThap, '#5DBB63', x, 4.55, z, { sx: 0.9, sy: 0.5, sz: 0.9, khu: 'chung', vien: 0.03 }); // dây leo
  }
  for (const [x, z, ry] of [[-22, -22, Math.PI / 4], [22, -22, -Math.PI / 4], [-22, 22, Math.PI * 0.75], [22, 22, -Math.PI * 0.75]]) tuongBanThan(x, z, ry, 'ngoai');
  for (const [x, z] of [[-20, -8], [-20, 8], [20, -8], [20, 8], [-8, -20], [8, -20], [-8, 20], [8, 20]]) binhGom(x, z, 'ngoai', 1.2);
  thuChay.den = 0;
  const denLong = (x, z, khu, cao = 3) => {
    gop.them(G.tru8, '#2B2B33', x, cao / 2, z, { sx: 0.09, sy: cao, sz: 0.09, khu, vien: 0.02, bong: true });
    gop.them(G.tru8, '#2B2B33', x, 0.12, z, { sx: 0.22, sy: 0.24, sz: 0.22, khu, vien: 0.02, bong: false });
    gop.them(G.cau, '#FFE9A0', x, cao + 0.2, z, { sx: 0.24, sy: 0.24, sz: 0.24, khu, vien: 0.025, phat: 0.9, bong: false });
    thuChay.den++; dem(khu, 'den');
  };
  for (const [x, z] of [[-8, -16.6], [8, -16.6], [-8, 16.6], [8, 16.6], [-16.6, -8], [-16.6, 8], [16.6, -8], [16.6, 8]]) denLong(x, z, 'chung');
  for (const [x, z, ry] of [[-4, -16.3, 0], [4, -16.3, 0], [-4, 16.3, Math.PI], [4, 16.3, Math.PI], [-16.3, -4.5, Math.PI / 2], [16.3, 4.5, -Math.PI / 2]]) gheBang(x, z, ry, 'chung');
  for (const [x, z] of [[-5, -54], [5, -54], [-5, 56], [5, 56], [-49, -3], [61, 3]]) denLong(x, z, 'ngoai');
  const bui = (x, z, khu, mauHoa = '#F28AC0', s = 1) => {
    dem(khu, 'bui');
    gop.them(G.cauThap, '#4FAE5A', x, 0.45 * s, z, { sx: 0.8 * s, sy: 0.6 * s, sz: 0.8 * s, khu, vien: 0.03 });
    for (let i = 0; i < 4; i++) gop.them(G.hoa, mauHoa, x + Math.sin(i * 1.7) * 0.5 * s, 0.85 * s, z + Math.cos(i * 1.7) * 0.5 * s, { sx: 0.13, sy: 0.13, sz: 0.13, khu, vien: 0, bong: false });
  };
  for (const [x, z, m] of [[-6, -16.5, '#C9A7FF'], [6, -16.5, '#F28AC0'], [-6, 16.5, '#FFC43D'], [6, 16.5, '#C9A7FF'], [-16.5, -5, '#F28AC0'], [16.5, 5, '#FFC43D'], [16.5, -5, '#C9A7FF'], [-16.5, 4.5, '#FFC43D']]) bui(x, z, 'chung', m);

  // ---- tường (thấp, kiểu Among Us) — màu theo khu
  const mauTuong = { chung: ['#5DBB63', '#73CC6E'], 'hanh-lang': ['#5DBB63', '#73CC6E'], 'chiem-tinh': [CAM_THACH, '#7A4DFF'], 'tro-choi': [CAM_THACH, '#E4574F'],
    'trong-cay': [CAM_THACH, '#62C46A'], 'xem-phim': [CAM_THACH, '#4A7BF0'], 'phong-hop': [CAM_THACH, '#C9874F'], 'cua-hang': [CAM_THACH, '#F28AC0'] };
  for (const id of KHU.slice(1)) {
    const ph = PHONG[id]; const r = ph.rect; const m = id === 'phong-hop' ? '#C9874F' : ph.mau;
    for (const [x, z] of [[r.x1, r.z1], [r.x2, r.z1], [r.x1, r.z2], [r.x2, r.z2]]) cotHyLap(x, z, 2.6, id, 0.38);
    const doc = ph.canh === 's' || ph.canh === 'n';
    const cx = doc ? ph.cua.trong.x : ph.canh === 'w' ? r.x1 : r.x2; const cz = doc ? (ph.canh === 's' ? r.z2 : r.z1) : 0;
    for (const s of [-1, 1]) cotHyLap(cx + (doc ? s * 2.2 : 0), cz + (doc ? 0 : s * 2.2), 3.3, 'ngoai', 0.32);
    maiTamGiac(cx, cz, 3.45, 5.2, doc ? 0 : Math.PI / 2, m, 'ngoai');
  }
  for (const t of BAN_DO.tuong) {
    const w = t.x2 - t.x1; const d = t.z2 - t.z1; const cx = (t.x1 + t.x2) / 2; const cz = (t.z1 + t.z2) / 2;
    const khu = t.phong === 'hanh-lang' ? 'chung' : t.phong; const [m1, m2] = mauTuong[t.phong];
    const cao = t.phong === 'trong-cay' ? 1.1 : t.phong === 'chung' || t.phong === 'hanh-lang' ? 1.0 : 1.6;
    gop.them(hopBo(w, cao, d, 0.08, 1), m1, cx, cao / 2, cz, { khu, vien: 0.04 });
    gop.them(hopBo(w + 0.12, 0.16, d + 0.12, 0.06, 1), m2, cx, cao + 0.08, cz, { khu, vien: 0.03 });
  }

  // ---- 6 cổng vòm ở quảng trường (dáng lều vải, mỗi cổng một màu)
  for (const v of BAN_DO.vat.filter((x) => x.loai === 'cong')) {
    const ngang = Math.abs(v.z) > Math.abs(v.x); // cổng ở cạnh bắc/nam → hành lang dọc
    const ry = ngang ? 0 : Math.PI / 2;
    const ox = ngang ? 2.25 : 0; const oz = ngang ? 0 : 2.25;
    for (const s of [-1, 1]) {
      cotHyLap(v.x + s * ox, v.z + s * oz, 3.9, 'chung', 0.34);
    }
    // cổng đền Hy Lạp: xà + trán tường tam giác màu của phòng
    maiTamGiac(v.x, v.z, 4.05, 5.4, ry, v.mau, 'chung');
    // biển tên 2 mặt
    const tex = veBien(v.ten, { nen: v.mau === '#F6E7C8' ? '#A86F45' : v.mau, coChu: 100 });
    for (const lat of [0, Math.PI]) {
      const bien = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 1.75), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
      bien.position.set(v.x, 2.75, v.z); bien.rotation.y = ry + lat + (v.z > 0 || v.x > 0 ? Math.PI : 0);
      scene.add(bien); bienCong[v.id] = bien;
    }
    themProxy(v.id, v.x, 2.6, v.z, ngang ? 4.6 : 1.2, 5.2, ngang ? 1.2 : 4.6);
    vatDiem[v.id] = new THREE.Vector3(v.x, 2.75, v.z);
  }

  // ---- bàn + ghế (dùng chung cho mọi khu)
  const mauGhe = { chung: '#3FB8A8', 'tro-choi': '#8E5BFF', 'phong-hop': '#5A3E2B', 'xem-phim': '#7A4DFF' };
  for (const g of BAN_DO.ghe) {
    const khu = g.phong; const m = mauGhe[khu] ?? '#B98A5E';
    const cha = new THREE.Matrix4().compose(new THREE.Vector3(g.x, (g.hang ?? 0) * 0.3, g.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, g.huong, 0)), new THREE.Vector3(1, 1, 1));
    if (khu === 'xem-phim') {
      gop.them(hopBo(0.85, 0.32, 0.8, 0.12), m, 0, 0.42, 0, { cha, khu, vien: 0.035, bong: false });
      gop.them(hopBo(0.85, 0.85, 0.2, 0.1), m, 0, 0.85, -0.38, { cha, khu, vien: 0.035, bong: false });
      for (const s of [-1, 1]) gop.them(hopBo(0.14, 0.4, 0.75, 0.06), '#4B2E99', s * 0.48, 0.55, -0.02, { cha, khu, vien: 0.03, bong: false });
    } else {
      gop.them(hopBo(0.62, 0.12, 0.62, 0.05), m, 0, 0.45, 0, { cha, khu, vien: 0.03, bong: false });
      gop.them(hopBo(0.62, 0.62, 0.1, 0.05), m, 0, 0.82, -0.27, { cha, khu, vien: 0.03, bong: false });
      for (const [lx, lz] of [[-0.24, -0.24], [0.24, -0.24], [-0.24, 0.24], [0.24, 0.24]]) gop.them(G.tru8, toiMauHex(m), lx, 0.2, lz, { cha, sx: 0.05, sy: 0.4, sz: 0.05, khu, vien: 0.015, bong: false });
    }
    // nền bậc rạp
    themProxy(g.id, g.x, 0.6 + (g.hang ?? 0) * 0.3, g.z, 0.9, 1.2, 0.9, g.huong);
  }
  // bậc rạp (3 hàng)
  [[8.5, 9], [11.5, 11], [14.5, 13]].forEach(([r], hang) => {
    if (!hang) return;
    const ring = new THREE.RingGeometry(r - 1.2, r + 1.2, 28, 1, Math.PI * 0.5 - 1.0, 2.0);
    gop.them(ring, '#3D3A86', 15, hang * 0.3 - 0.02, 51.5, { rx: -Math.PI / 2, ry: 0, khu: 'xem-phim', vien: 0, bong: false });
    gop.them(new THREE.CylinderGeometry(r + 1.2, r + 1.2, hang * 0.3, 28, 1, true, Math.PI - 1.0, 2.0), '#4B2E99', 15, hang * 0.15, 51.5, { khu: 'xem-phim', vien: 0, bong: false });
  });

  for (const b of BAN_DO.ban) {
    const khu = b.phong;
    if (b.id === 'ban-hop') {
      gop.them(hopBo(8, 0.18, 2.4, 0.08), '#6B4630', b.x, 0.8, b.z, { khu, vien: 0.04 });
      for (const [lx, lz] of [[-3.6, -0.9], [3.6, -0.9], [-3.6, 0.9], [3.6, 0.9]]) gop.them(G.tru8, '#4A2F20', b.x + lx, 0.4, b.z + lz, { sx: 0.1, sy: 0.8, sz: 0.1, khu, vien: 0.02 });
      for (let i = 0; i < 4; i++) gop.them(hopBo(0.5, 0.03, 0.35, 0.01), '#FFFFFF', b.x - 3 + i * 2, 0.91, b.z + (i % 2 ? 0.6 : -0.6), { khu, vien: 0.01, bong: false });
      themProxy(b.id, b.x, 0.6, b.z, 8, 1.2, 2.4);
      continue;
    }
    const khan = b.mau ?? '#F6E7C8';
    gop.them(G.tru, '#FFFFFF', b.x, 0.78, b.z, { sx: b.r, sy: 0.1, sz: b.r, khu, vien: 0.04 });
    if (khu !== 'chung') gop.them(new THREE.CylinderGeometry(b.r * 1.02, b.r * 1.08, 0.35, 20, 1, true), khan, b.x, 0.62, b.z, { khu, vien: 0.03 });
    gop.them(G.tru8, '#6B4630', b.x, 0.4, b.z, { sx: 0.16, sy: 0.75, sz: 0.16, khu, vien: 0.02 });
    gop.them(G.tru, '#6B4630', b.x, 0.04, b.z, { sx: 0.6, sy: 0.08, sz: 0.6, khu, vien: 0.02 });
    // đồ trên bàn
    const y = 0.85;
    if (b.id.startsWith('ban-hoc')) {
      gop.them(hopBo(0.5, 0.12, 0.38, 0.03), '#4A7BF0', b.x - 0.25, y + 0.06, b.z, { khu, vien: 0.02 });
      gop.them(hopBo(0.45, 0.1, 0.34, 0.03), '#E4574F', b.x - 0.22, y + 0.17, b.z + 0.05, { khu, vien: 0.02, ry: 0.3 });
      gop.them(G.tru8, '#3B2F4F', b.x + 0.35, y + 0.2, b.z - 0.1, { sx: 0.03, sy: 0.4, sz: 0.03, khu, vien: 0 });
      gop.them(G.cauThap, '#FFD98A', b.x + 0.35, y + 0.45, b.z - 0.1, { sx: 0.14, sy: 0.14, sz: 0.14, khu, vien: 0.02, phat: 0.8 });
    } else if (b.id === 'ban-ma-soi') {
      gop.them(hopBo(0.4, 0.55, 0.4, 0.06), '#FFC86B', b.x, y + 0.3, b.z, { khu, vien: 0.03, phat: 0.9 });
      gop.them(G.non4, '#3B2F4F', b.x, y + 0.75, b.z, { sx: 0.38, sy: 0.35, sz: 0.38, ry: Math.PI / 4, khu, vien: 0.02 });
      gop.them(G.cau, '#8E8BA8', b.x + 0.9, y + 0.15, b.z + 0.3, { sx: 0.3, sy: 0.22, sz: 0.25, khu, vien: 0.02 });
      for (const s of [-1, 1]) gop.them(G.non4, '#6E6A8C', b.x + 0.9 + s * 0.17, y + 0.38, b.z + 0.3, { sx: 0.09, sy: 0.22, sz: 0.06, khu, vien: 0.015 });
      gop.them(G.non4, '#6E6A8C', b.x + 0.9, y + 0.12, b.z + 0.55, { sx: 0.12, sy: 0.25, sz: 0.1, rx: Math.PI / 2, khu, vien: 0.015 });
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; gop.them(hopBo(0.28, 0.02, 0.4, 0.01), '#3D2C78', b.x + Math.sin(a) * 1.35, y + 0.02, b.z + Math.cos(a) * 1.35, { ry: a, khu, vien: 0.01, bong: false }); }
    } else if (b.id === 'ban-bai-mau') {
      ['#E5484D', '#3E63DD', '#30A46C', '#FFC53D'].forEach((m, i) => gop.them(hopBo(0.32, 0.03, 0.46, 0.02), m, b.x - 0.3 + i * 0.2, y + 0.03 + i * 0.012, b.z + 0.1, { ry: -0.5 + i * 0.3, khu, vien: 0.012, bong: false }));
      gop.them(hopBo(0.34, 0.16, 0.48, 0.02), '#2B1F4D', b.x + 0.45, y + 0.08, b.z - 0.35, { khu, vien: 0.012 });
    } else if (b.id === 'ban-ca-ngua') {
      gop.them(hopBo(1.5, 0.06, 1.5, 0.03), '#FFF9EE', b.x, y + 0.03, b.z, { khu, vien: 0.015 });
      ['#E5484D', '#3E63DD', '#30A46C', '#FFC53D'].forEach((m, i) => {
        const sx = i % 2 ? 1 : -1; const sz = i < 2 ? -1 : 1;
        gop.them(hopBo(0.55, 0.02, 0.55, 0.01), m, b.x + sx * 0.42, y + 0.07, b.z + sz * 0.42, { khu, vien: 0, bong: false });
        gop.them(G.non, m, b.x + sx * 0.42, y + 0.2, b.z + sz * 0.42, { sx: 0.08, sy: 0.22, sz: 0.08, khu, vien: 0.015 });
      });
      gop.them(hopBo(0.5, 0.02, 0.5, 0.01), '#FFC43D', b.x, y + 0.07, b.z, { ry: Math.PI / 4, khu, vien: 0, bong: false });
    } else if (b.id === 'ban-ghep-mau') {
      ['#E5484D', '#3E63DD', '#30A46C', '#FFC53D', '#F76BAF', '#8E4EC6'].forEach((m, i) => gop.them(hopBo(0.22, 0.22, 0.22, 0.04), m, b.x - 0.35 + (i % 3) * 0.35, y + 0.11 + (i > 2 ? 0.22 : 0), b.z + (i > 2 ? -0.05 : 0.1), { khu, vien: 0.015 }));
    }
    if (khu !== 'chung') {
      const s = nhanChu(b.ten, { coChu: 64, cao: 1.0 }); s.position.set(b.x, 2.8, b.z); scene.add(s);
    }
    themProxy(b.id, b.x, 0.6, b.z, b.r * 2, 1.2, b.r * 2);
  }

  // ---- PHÒNG CHIÊM TINH: đền đêm, 3 cửa vòm, vòng hoàng đạo, nến, cầu pha lê, Bà Đồng Sao
  const CT = 'chiem-tinh';
  gop.them(G.tru, '#FFC43D', -14, 0.02, -36, { sx: 5, sy: 0.04, sz: 5, khu: CT, vien: 0, bong: false, phat: 0.15 });
  gop.them(G.tru, '#3B2C70', -14, 0.04, -36, { sx: 4.7, sy: 0.04, sz: 4.7, khu: CT, vien: 0, bong: false });
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; gop.them(G.cauThap, '#FFC43D', -14 + Math.sin(a) * 4.2, 0.07, -36 + Math.cos(a) * 4.2, { sx: 0.18, sy: 0.03, sz: 0.18, khu: CT, vien: 0, bong: false, phat: 0.6 }); }
  for (const v of BAN_DO.vat.filter((x) => x.loai === 'cua-chiem-tinh')) {
    for (const s of [-1, 1]) {
      gop.them(G.tru, DA_TRANG, v.x + s * 1.95, 2, -42.8, { sx: 0.36, sy: 4, sz: 0.36, khu: CT, vien: 0.04 });
      gop.them(hopBo(0.9, 0.35, 0.9, 0.06), DA_BONG, v.x + s * 1.95, 0.17, -42.8, { khu: CT, vien: 0.03 });
    }
    gop.them(new THREE.TorusGeometry(1.95, 0.3, 8, 20, Math.PI), DA_TRANG, v.x, 4, -42.8, { khu: CT, vien: 0.04 });
    gop.them(G.cau, '#FFC43D', v.x, 6.2, -42.8, { sx: 0.35, sy: 0.35, sz: 0.35, khu: CT, vien: 0.03, phat: 0.8 });
    // cánh cửa phát sáng có hình
    const c = document.createElement('canvas'); c.width = 256; c.height = 384; const ctx = c.getContext('2d');
    const gr = ctx.createLinearGradient(0, 0, 0, 384); gr.addColorStop(0, v.mau); gr.addColorStop(1, '#15112F');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(0, 384); ctx.lineTo(0, 128); ctx.arc(128, 128, 128, Math.PI, 0); ctx.lineTo(256, 384); ctx.fill();
    ctx.fillStyle = '#FFE9A8'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (v.id === 'cua-than-so') { ctx.font = '800 54px "Baloo 2", sans-serif'; [['1', 70, 120], ['2', 128, 90], ['3', 186, 120], ['5', 60, 200], ['7', 128, 240], ['8', 196, 200], ['9', 128, 160]].forEach(([s, x, y]) => ctx.fillText(s, x, y)); }
    if (v.id === 'cua-tu-vi') { ctx.strokeStyle = '#FFE9A8'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(128, 180, 80, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.arc(128, 180, 34, 0, 7); ctx.stroke(); for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; ctx.beginPath(); ctx.moveTo(128 + Math.cos(a) * 34, 180 + Math.sin(a) * 34); ctx.lineTo(128 + Math.cos(a) * 80, 180 + Math.sin(a) * 80); ctx.stroke(); } }
    if (v.id === 'cua-ban-do-sao') { const pts = [[60, 120], [110, 90], [150, 150], [200, 110], [170, 230], [90, 250], [128, 190]]; ctx.strokeStyle = '#FFE9A8'; ctx.lineWidth = 3; ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke(); pts.forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x, y, 9, 0, 7); ctx.fill(); }); }
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const cua = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 5.3), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
    cua.position.set(v.x, 2.65, -43.6); scene.add(cua);
    const bien = new THREE.Mesh(new THREE.PlaneGeometry(3.3, 1.0), new THREE.MeshBasicMaterial({ map: veBien(v.ten, { nen: v.mau, rong: 512, cao: 156, coChu: 62 }), transparent: true }));
    bien.position.set(v.x, 0.95, -42.3); scene.add(bien);
    themProxy(v.id, v.x, 2.5, -42.8, 3.4, 5, 1.2);
    vatDiem[v.id] = new THREE.Vector3(v.x, 1.6, -42.6);
  }
  // vòng hoàng đạo lơ lửng
  const vong = new THREE.Group(); vong.position.set(-14, 5.2, -36.5); scene.add(vong);
  vong.add(new THREE.Mesh(new THREE.TorusGeometry(4.2, 0.17, 6, 56), toon('#FFC43D', 0.7)));
  vong.add(new THREE.Mesh(new THREE.TorusGeometry(3.3, 0.1, 6, 56), toon('#FFE9A8', 0.6)));
  const kyHieu = ['♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓'];
  kyHieu.forEach((k, i) => {
    const a = (i / 12) * Math.PI * 2; const s = nhanChu(k + '︎', { coChu: 64, mau: '#FFE9A8', cao: 0.95 });
    s.position.set(Math.sin(a) * 3.75, 0, Math.cos(a) * 3.75); vong.add(s);
  });
  vong.rotation.x = 0.35;
  thuChay.vong = vong;
  dong.push((t) => { vong.rotation.y = t * 0.25; });
  // trời sao ngay trên phòng (thấy từ camera khi đứng trong phòng); sáng dần khi trời tối
  const SAO_PHONG = 320; const sp = new Float32Array(SAO_PHONG * 3);
  for (let i = 0; i < SAO_PHONG; i++) sp.set([-27.5 + ngauNhien() * 25, 6 + ngauNhien() * 6, -43.5 + ngauNhien() * 17], i * 3);
  const spGeo = new THREE.BufferGeometry(); spGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const saoPhongMat = new THREE.PointsMaterial({ color: '#FFF3C4', size: 3, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false });
  const saoPhong = new THREE.Points(spGeo, saoPhongMat); saoPhong.userData.khu = CT; scene.add(saoPhong);
  // Bà Đồng Sao
  const npc = taoNhanVat('#4B2E83', { toc: '#3A2418', mu: '#2E1D5C' });
  npc.position.set(-14, 0, -36); scene.add(npc);
  const sao = new THREE.Mesh(G.non4, toon('#FFC43D', 0.9)); sao.scale.set(0.12, 0.12, 0.04); sao.position.set(0, 0.52, 0.32); npc.userData.phan.dau.add(sao);
  dong.push((t) => npc.hoatCanh(t, 'dung'));
  themProxy('ba-dong', -14, 0.9, -36, 1.1, 1.8, 1.1);
  vatDiem['ba-dong'] = new THREE.Vector3(-14, 2.1, -36);
  // cầu pha lê + nến + kệ sách
  for (const id of ['cau-pha-le-1', 'cau-pha-le-2']) {
    const v = BAN_DO.vat.find((x) => x.id === id);
    gop.them(G.tru8, '#B9A6D6', v.x, 0.5, v.z, { sx: 0.45, sy: 1, sz: 0.45, khu: CT, vien: 0.03 });
    gop.them(new THREE.TorusGeometry(0.42, 0.05, 6, 16), '#FFC43D', v.x, 1.05, v.z, { rx: Math.PI / 2, khu: CT, vien: 0.015 });
    gop.them(G.cau, '#9FE3FF', v.x, 1.5, v.z, { sx: 0.5, sy: 0.5, sz: 0.5, khu: CT, vien: 0.03, phat: 0.55 });
  }
  const nen = (x, z, khu, cao = 1.1) => {
    gop.them(G.tru8, '#FFC43D', x, cao / 2, z, { sx: 0.06, sy: cao, sz: 0.06, khu, vien: 0.015 });
    gop.them(G.tru8, '#FFF3D6', x, cao + 0.2, z, { sx: 0.16, sy: 0.4, sz: 0.16, khu, vien: 0.02 });
    gop.them(G.cau, '#FFE38A', x, cao + 0.55, z, { sx: 0.22, sy: 0.22, sz: 0.22, khu, vien: 0, bong: false, phat: 1, trongSuot: 0.5 });
    gop.them(G.non, '#FFB347', x, cao + 0.58, z, { sx: 0.12, sy: 0.32, sz: 0.12, khu, vien: 0, bong: false, phat: 1 });
    thuChay.nen++;
  };
  for (const [x, z] of [[-27, -27.5], [-3, -27.5], [-27, -43], [-3, -43], [-23, -43], [-5, -43], [-27, -35], [-3, -35]]) nen(x, z, CT);
  for (const [x, z] of [[-26.7, -39], [-26.7, -30.5]]) {
    gop.them(hopBo(0.8, 2.2, 2.4, 0.05), '#6B4630', x, 1.1, z, { khu: CT, vien: 0.03 });
    for (let i = 0; i < 6; i++) gop.them(hopBo(0.5, 0.42, 0.18, 0.02), ['#E4574F', '#4A7BF0', '#FFC43D', '#30A46C', '#8E5BFF', '#F28AC0'][i], x + 0.1, 0.5 + Math.floor(i / 3) * 0.75, z - 0.7 + (i % 3) * 0.5, { khu: CT, vien: 0.01 });
  }

  // ---- PHÒNG TRÒ CHƠI: cờ treo, thảm, hoa
  const TC = 'tro-choi';
  for (const [x, m] of [[6, '#8E5BFF'], [10, '#FFC43D'], [18, '#E4574F'], [22, '#4A7BF0']]) {
    gop.them(hopBo(1.3, 2.2, 0.08, 0.04), m, x, 2.4, -49.6, { khu: TC, vien: 0.03 });
    gop.them(G.non4, m, x, 1.15, -49.6, { sx: 0.65, sy: 0.4, sz: 0.04, rz: Math.PI, ry: Math.PI / 4, khu: TC, vien: 0.02 });
    gop.them(G.cau, '#FFC43D', x, 2.6, -49.5, { sx: 0.25, sy: 0.25, sz: 0.05, khu: TC, vien: 0.015, phat: 0.4 });
  }
  for (const [x, z, r, m] of [[8, -43, 4.1, '#C9B6F2'], [21, -43, 3, '#F6C3C0'], [21.5, -32.5, 3, '#BFE5C9'], [6.5, -32.5, 2.6, '#FFE6A8']]) gop.them(G.tru, m, x, 0.03, z, { sx: r, sy: 0.05, sz: r, khu: TC, vien: 0, bong: false });
  for (const [x, z] of [[3, -27], [27, -27], [3, -49], [27, -49]]) bui(x, z, TC, '#C9A7FF', 1.2);

  // ---- PHÒNG XEM PHIM: màn hình, rèm, quầy bỏng ngô, đèn lối đi
  const XP = 'xem-phim';
  const mh = BAN_DO.vat.find((x) => x.id === 'man-hinh');
  gop.them(hopBo(mh.rong + 0.8, mh.cao + 0.8, 0.3, 0.1), '#FFC43D', mh.x, 1.3 + mh.cao / 2, 51.7, { khu: XP, vien: 0.04 });
  for (const s of [-1, 1]) gop.them(hopBo(1.4, mh.cao + 1.6, 0.4, 0.15), '#7A2D8E', mh.x + s * (mh.rong / 2 + 1.1), 0.8 + mh.cao / 2 + 0.3, 51.4, { khu: XP, vien: 0.04 });
  const cm = document.createElement('canvas'); cm.width = 1024; cm.height = 576; const cx = cm.getContext('2d'); // 16:9 like the screen (logic.js: 12 x 6.75), the YouTube ratio
  const gm = cx.createLinearGradient(0, 0, 0, 576); gm.addColorStop(0, '#5B4FD8'); gm.addColorStop(1, '#C9A7FF'); cx.fillStyle = gm; cx.fillRect(0, 0, 1024, 576);
  cx.fillStyle = 'rgba(255,255,255,0.85)'; for (const [x, y, r] of [[180, 436, 70], [260, 426, 90], [760, 446, 80], [850, 436, 60], [520, 486, 120]]) { cx.beginPath(); cx.arc(x, y, r, 0, 7); cx.fill(); }
  cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.font = '800 120px "Baloo 2", sans-serif'; cx.lineWidth = 16; cx.strokeStyle = MUC; cx.lineJoin = 'round';
  cx.strokeText('Queue is empty', 512, 210); cx.fillStyle = '#FFC43D'; cx.fillText('Queue is empty', 512, 210);
  cx.font = '800 44px "Nunito", sans-serif'; cx.lineWidth = 10; cx.strokeStyle = MUC; cx.strokeText('Paste a YouTube link to start the show', 512, 330); cx.fillStyle = '#FFFFFF'; cx.fillText('Paste a YouTube link to start the show', 512, 330);
  const tm = new THREE.CanvasTexture(cm); tm.colorSpace = THREE.SRGBColorSpace;
  const manHinh = new THREE.Mesh(new THREE.PlaneGeometry(mh.rong, mh.cao), new THREE.MeshBasicMaterial({ map: tm }));
  manHinh.position.set(mh.x, 1.3 + mh.cao / 2, 51.5); manHinh.rotation.y = Math.PI; scene.add(manHinh);
  thuChay.manHinh = { phatSang: true, chu: 'Queue is empty', mesh: manHinh };
  themProxy('man-hinh', mh.x, 1.3 + mh.cao / 2, 51.3, mh.rong, mh.cao, 0.5);
  vatDiem['man-hinh'] = new THREE.Vector3(mh.x, 1.3 + mh.cao / 2, 51.3);
  const bn = BAN_DO.vat.find((x) => x.id === 'quay-bong-ngo');
  gop.them(hopBo(2.6, 1.2, 1.4, 0.08), '#E4574F', bn.x, 0.6, bn.z, { khu: XP, vien: 0.035 });
  gop.them(hopBo(1.6, 0.9, 1, 0.06), '#BDEBFF', bn.x, 1.65, bn.z, { khu: XP, vien: 0.03, trongSuot: 0.6 });
  for (let i = 0; i < 10; i++) gop.them(G.cauThap, '#FFE38A', bn.x - 0.5 + (i % 5) * 0.25, 1.35 + Math.floor(i / 5) * 0.18, bn.z - 0.15 + (i % 2) * 0.3, { sx: 0.12, sy: 0.12, sz: 0.12, khu: XP, vien: 0.01 });
  for (let i = 0; i < 5; i++) gop.them(hopBo(0.52, 0.08, 1.5, 0.03), i % 2 ? '#FFFFFF' : '#E4574F', bn.x - 1.04 + i * 0.52, 2.35, bn.z, { khu: XP, vien: 0.015 });
  themProxy('quay-bong-ngo', bn.x, 1, bn.z, 2.6, 2, 1.4);
  for (const [x, z] of [[3, 34], [3, 42], [27, 34], [27, 42], [9, 27], [19, 27]]) gop.them(G.cauThap, '#FFC86B', x, 0.15, z, { sx: 0.18, sy: 0.12, sz: 0.18, khu: XP, vien: 0.015, phat: 1, bong: false });

  // ---- PHÒNG HỌP: bảng trắng, cửa sổ, chậu cây
  const PH = 'phong-hop';
  gop.them(hopBo(0.2, 2, 4.4, 0.05), '#FFFFFF', -43.6, 1.8, 0, { khu: PH, vien: 0.04 });
  gop.them(hopBo(0.22, 2.2, 4.6, 0.05), '#A86F45', -43.7, 1.8, 0, { khu: PH, vien: 0 });
  for (const [z, y, w, m] of [[-1, 2.2, 1.6, '#E4574F'], [0.4, 1.8, 2.2, '#4A7BF0'], [-0.2, 1.4, 1.2, '#30A46C']]) gop.them(hopBo(0.03, 0.08, w, 0.01), m, -43.48, y, z, { khu: PH, vien: 0, bong: false });
  themProxy('bang-trang', -43.5, 1.8, 0, 0.6, 2.2, 4.4);
  vatDiem['bang-trang'] = new THREE.Vector3(-43.4, 1.8, 0);
  for (const x of [-40, -35, -30]) gop.them(hopBo(2.6, 1.1, 0.12, 0.04), '#BDEBFF', x, 1.15, -9.9, { khu: PH, vien: 0.03, phat: 0.35 });
  for (const [x, z] of [[-43, -9], [-43, 9], [-27, -9], [-27, 9]]) { gop.them(G.tru8, '#E4A672', x, 0.3, z, { sx: 0.35, sy: 0.6, sz: 0.35, khu: PH, vien: 0.02 }); bui(x, z, PH, '#62C46A', 0.9); }

  // ---- CỬA HÀNG & THAY ĐỒ: giá quần áo, gương, quầy, ma-nơ-canh
  const CH = 'cua-hang';
  for (const z of [34, 38]) {
    for (const s of [-1, 1]) gop.them(G.tru8, '#C9C2D6', -22 + s * 2.4, 0.9, z, { sx: 0.06, sy: 1.8, sz: 0.06, khu: CH, vien: 0.015 });
    gop.them(G.tru8, '#C9C2D6', -22, 1.8, z, { sx: 0.05, sy: 4.8, sz: 0.05, rz: Math.PI / 2, khu: CH, vien: 0.015 });
    ['#E5484D', '#3E63DD', '#FFC53D', '#30A46C', '#F76BAF', '#8E4EC6'].forEach((m, i) => {
      const x = -24 + i * 0.8;
      gop.them(G.tamGiac, '#C9C2D6', x, 1.5, z, { sx: 0.6, sy: 0.22, sz: 0.04, ry: Math.PI / 2, khu: CH, vien: 0.01, bong: false }); // móc
      gop.them(hopBo(0.16, 0.9, 0.62, 0.07), m, x, 1.05, z, { khu: CH, vien: 0.02 });                                     // thân áo
      gop.them(hopBo(0.14, 0.42, 0.22, 0.05), m, x, 1.3, z - 0.38, { rx: 0.3, khu: CH, vien: 0.015 });                     // tay áo
      gop.them(hopBo(0.14, 0.42, 0.22, 0.05), m, x, 1.3, z + 0.38, { rx: -0.3, khu: CH, vien: 0.015 });
    });
  }
  themProxy('gia-quan-ao', -22, 1.2, 36, 5.2, 2.4, 5);
  gop.them(hopBo(2.2, 3, 0.2, 0.1), '#FFC43D', -6, 1.7, 26.4, { khu: CH, vien: 0.04 });
  gop.them(hopBo(1.8, 2.6, 0.06, 0.05), '#CFF4FF', -6, 1.7, 26.55, { khu: CH, vien: 0, phat: 0.45 });
  gop.them(hopBo(0.5, 2.0, 0.04, 0.02), '#FFFFFF', -6.4, 1.9, 26.6, { khu: CH, vien: 0, phat: 0.6, rz: 0.4, bong: false }); // vệt sáng gương
  themProxy('guong', -6, 1.7, 26.8, 2.2, 3, 0.8);
  vatDiem['guong'] = new THREE.Vector3(-6, 1.8, 26.8);
  gop.them(hopBo(2.8, 1.1, 2.8, 0.08), '#F28AC0', -5, 0.55, 36, { khu: CH, vien: 0.035 });
  gop.them(hopBo(0.6, 0.4, 0.5, 0.05), '#2B1F4D', -5, 1.3, 36, { khu: CH, vien: 0.02 });
  themProxy('quay-cua-hang', -5, 0.9, 36, 2.8, 1.8, 2.8);
  for (const [x, z, m] of [[-26, 44, '#3E63DD'], [-17, 44, '#F76BAF']]) {
    const mn = taoNhanVat(m, { toc: '#FFFFFF' }); mn.position.set(x, 0, z); mn.rotation.y = Math.PI; scene.add(mn);
    mn.userData.phan.mat.material = toon('#FFFFFF'); gop.them(G.tru, '#FFC43D', x, 0.05, z, { sx: 0.6, sy: 0.1, sz: 0.6, khu: CH, vien: 0.02 });
  }
  gop.them(G.tru, '#FFFFFF', -14, 0.02, 38, { sx: 3.2, sy: 0.03, sz: 3.2, khu: CH, vien: 0, bong: false });
  gop.them(G.tru, '#F28AC0', -14, 0.03, 38, { sx: 2.8, sy: 0.03, sz: 2.8, khu: CH, vien: 0, bong: false });

  // ---- vật lẻ khác có proxy
  themProxy('loa-nhac', -15, 0.9, 9, 1.4, 1.8, 1.4);
  gop.them(hopBo(1.1, 1.5, 0.9, 0.12), '#5A3E8E', -15, 0.75, 9, { khu: 'chung', vien: 0.04 });
  for (const y of [0.45, 1.05]) gop.them(G.tru, '#2B1F4D', -15, y, 9.45, { sx: 0.32, sy: 0.08, sz: 0.32, rx: Math.PI / 2, khu: 'chung', vien: 0.02 });
  gop.them(G.tru, '#FFC43D', -15, 1.05, 9.5, { sx: 0.12, sy: 0.04, sz: 0.12, rx: Math.PI / 2, khu: 'chung', vien: 0, phat: 0.5 });
  vatDiem['ho-ca'] = new THREE.Vector3(50, 0.3, -8);

  // ---- bầu trời: vòm gradient + sao
  const troi = new THREE.Mesh(new THREE.SphereGeometry(320, 24, 12), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { tren: { value: new THREE.Color('#2A2459') }, duoi: { value: new THREE.Color('#6B58B0') } },
    vertexShader: 'varying float h; void main(){ h = normalize(position).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 tren; uniform vec3 duoi; varying float h; void main(){ gl_FragColor = vec4(mix(duoi, tren, smoothstep(-0.05, 0.6, h)), 1.0); }',
  }));
  troi.renderOrder = -1; scene.add(troi);
  const SO_SAO = 480; const saoPos = new Float32Array(SO_SAO * 3);
  for (let i = 0; i < SO_SAO; i++) {
    const u = Math.random() * Math.PI * 2; const v = 0.08 + Math.random() * 0.9;
    saoPos.set([Math.cos(u) * Math.cos(v) * 300, Math.sin(v) * 300, Math.sin(u) * Math.cos(v) * 300], i * 3);
  }
  const saoGeo = new THREE.BufferGeometry(); saoGeo.setAttribute('position', new THREE.BufferAttribute(saoPos, 3));
  const saoMat = new THREE.PointsMaterial({ color: '#FFF3C4', size: 2.2, sizeAttenuation: false, transparent: true, opacity: 1, depthWrite: false });
  const saoDiem = new THREE.Points(saoGeo, saoMat); scene.add(saoDiem);

  const meshes = gop.xay(scene);

  // ---- closed rooms (campus-export): the inside of a room shows only while you are in it; from outside it is a closed building
  const PHONGS = KHU.slice(1);
  const trongPhong = Object.fromEntries(PHONGS.map((id) => [id, []]));
  for (const o of scene.children) {
    let k = o.userData.khu;
    if (k === undefined && (o.position.x || o.position.z)) k = phongTaiViTri(o.position.x, o.position.z);
    if (trongPhong[k]) trongPhong[k].push(o);
  }
  const vo = {};
  for (const id of PHONGS) {
    const ph = PHONG[id]; const r = ph.rect; const K = `vo-${id}`; const H = 4.4;
    const mau = id === 'phong-hop' ? '#C9874F' : ph.mau;
    const nhom = new THREE.Group(); nhom.name = K; const g2 = new Gop();
    for (const t of BAN_DO.tuong.filter((x) => x.phong === id)) { // same wall segments as the low walls, full height
      const w = t.x2 - t.x1; const d = t.z2 - t.z1; const cx = (t.x1 + t.x2) / 2; const cz = (t.z1 + t.z2) / 2;
      g2.them(hopBo(w + 0.3, H, d + 0.3, 0.1), CAM_THACH, cx, H / 2, cz, { khu: K, vien: 0.04 });
      g2.them(hopBo(w + 0.46, 0.36, d + 0.46, 0.08), mau, cx, H - 0.55, cz, { khu: K, vien: 0.03 });  // frieze in the room's colour
      g2.them(hopBo(w + 0.5, 0.4, d + 0.5, 0.08), DA_BONG, cx, 0.2, cz, { khu: K, vien: 0.03 });       // plinth
    }
    for (const [x, z] of [[r.x1, r.z1], [r.x2, r.z1], [r.x1, r.z2], [r.x2, r.z2]]) {                  // tall corner columns
      g2.them(hopBo(1.25, 0.3, 1.25, 0.05), CAM_THACH, x, 0.15, z, { khu: K, vien: 0.03 });
      g2.them(G.tru, CAM_THACH, x, H / 2 + 0.1, z, { sx: 0.44, sy: H - 0.2, sz: 0.44, khu: K, vien: 0.035 });
      g2.them(hopBo(1.3, 0.32, 1.3, 0.05), CAM_THACH, x, H - 0.02, z, { khu: K, vien: 0.03 });
    }
    const doc = ph.canh === 's' || ph.canh === 'n';
    const cx = doc ? ph.cua.trong.x : ph.canh === 'w' ? r.x1 : r.x2; const cz = doc ? (ph.canh === 's' ? r.z2 : r.z1) : 0;
    const ry = doc ? 0 : Math.PI / 2;
    const ra = { s: [0, 1], n: [0, -1], e: [1, 0], w: [-1, 0] }[ph.canh];                                // which way is "outside" of the door
    g2.them(hopBo(4.4, H - 3.2, 0.8, 0.08), CAM_THACH, cx, 3.2 + (H - 3.2) / 2, cz, { ry, khu: K, vien: 0.04 }); // wall over the door
    const W = r.x2 - r.x1; const D = r.z2 - r.z1; const mx = (r.x1 + r.x2) / 2; const mz = (r.z1 + r.z2) / 2; const HR = 2.1;
    g2.them(hopBo(W + 1.5, 0.4, D + 1.5, 0.12), '#EFE7DA', mx, H + 0.2, mz, { khu: K, vien: 0.04 });            // roof slab
    const cha = new THREE.Matrix4().compose(new THREE.Vector3(mx, H + 0.4 + HR / 2, mz), new THREE.Quaternion(), new THREE.Vector3((W + 0.7) / Math.SQRT2, HR, (D + 0.7) / Math.SQRT2));
    g2.them(G.non4, mau, 0, 0, 0, { ry: Math.PI / 4, cha, khu: K, vien: 0.05 });                               // low hip roof in the room's colour
    g2.them(G.cau, '#FFC43D', mx, H + 0.4 + HR + 0.15, mz, { sx: 0.3, sy: 0.3, sz: 0.3, khu: K, vien: 0.03, phat: 0.4, bong: false });
    g2.xay(nhom);
    const rem = new THREE.Mesh(new THREE.PlaneGeometry(4, 3.2), toon(toiMauHex(mau === '#F6E7C8' ? '#C9874F' : mau), 0, { rieng: true }));
    rem.material.side = THREE.DoubleSide; rem.position.set(cx, 1.6, cz); rem.rotation.y = ry; nhom.add(rem);  // door curtain: no collider, you walk through it
    const bien = new THREE.Mesh(new THREE.PlaneGeometry(4.3, 1.3), new THREE.MeshBasicMaterial({ map: veBien(ph.ten, { nen: mau === '#F6E7C8' ? '#A86F45' : mau, coChu: 100 }), transparent: true }));
    bien.position.set(cx + ra[0] * 0.55, 2.5, cz + ra[1] * 0.55); bien.rotation.y = Math.atan2(ra[0], ra[1]); nhom.add(bien);
    scene.add(nhom); vo[id] = nhom;
  }
  /** Show the inside of room `id` (null = you are outdoors: every room is a closed building). */
  const datTrong = (id) => { for (const k of PHONGS) { const trong = k === id; for (const o of trongPhong[k]) o.visible = trong; vo[k].visible = !trong; } };
  /** Register one more object that belongs to the inside of a room (crops, the cinema's video, ...). */
  const themVaoPhong = (id, o) => { trongPhong[id].push(o); o.visible = !vo[id].visible; return o; };
  datTrong(null);

  return {
    proxy, vatDiem, bienCong, meshes, thuChay, troi, saoMat, saoPhongMat, soSao: SAO_PHONG, npc, datTrong, themVaoPhong, vo,
    capNhat: (t, dt, camera) => { for (const f of dong) f(t, dt); troi.position.copy(camera.position); saoDiem.position.copy(camera.position); },
  };
}

function toiMauHex(hex) { return '#' + new THREE.Color(hex).multiplyScalar(0.7).getHexString(); }
