// Map rules of the combined game (from Top1Server): pure functions, no DOM, no Three.js.
// Identifiers stay in Vietnamese as in the original Top1 code; every player-facing text is English.
// Bản đồ nối liền (1-wiki/decisions/ban-do-noi-lien.md): quảng trường ở giữa, 6 phòng quanh, nối bằng hành lang.
// Trục: x sang phải (đông), z xuống dưới (nam). Bắc = -z.

// ---------------------------------------------------------------- F1 · tên + màu
export const MAU_NHAN_VAT = ['#E5484D', '#3E63DD', '#30A46C', '#F76BAF', '#F76B15', '#FFC53D',
  '#3A3A44', '#F2F2F2', '#8E4EC6', '#A0663B', '#12A594', '#99D52A'];

export function kiemTraTen(ten) {
  const t = String(ten ?? '').trim().replace(/\s+/g, ' ');
  const n = [...t].length;
  if (n === 0) return { ok: false, ten: t, loi: 'Please enter a character name' };
  if (n < 2) return { ok: false, ten: t, loi: 'The name needs at least 2 characters' };
  if (n > 16) return { ok: false, ten: t, loi: 'That name is too long (16 characters at most)' };
  return { ok: true, ten: t, loi: null };
}

// ---------------------------------------------------------------- F2 · đi lại
export const TOC_DO = 4;        // m/giây
export const DT_TOI_DA = 0.1;   // giây — tab ẩn lâu cũng không "nhảy cóc"
export const BAN_KINH = 0.4;    // bán kính thân nhân vật (m)

const lenOf = (x, z) => Math.hypot(x, z);

/** Hướng đi (độ dài ≤ 1) từ phím (tương đối camera quay `goc`) hoặc từ vector thế giới {x, z}. */
export function huongDi(phim, goc = 0) {
  if (phim && (typeof phim.x === 'number' || typeof phim.z === 'number')) {
    const x = phim.x || 0; const z = phim.z || 0; const l = lenOf(x, z);
    if (l < 1e-3) return null;
    return l > 1 ? { x: x / l, z: z / l } : { x, z };
  }
  const dx = (phim?.d ? 1 : 0) - (phim?.a ? 1 : 0);
  const dz = (phim?.s ? 1 : 0) - (phim?.w ? 1 : 0);
  if (!dx && !dz) return null;
  const l = lenOf(dx, dz);
  const ux = dx / l; const uz = dz / l;
  // camera quay `goc` quanh trục y: phải = (cos, -sin), sau = (sin, cos)
  const c = Math.cos(goc); const s = Math.sin(goc);
  return { x: ux * c + uz * s, z: -ux * s + uz * c };
}

/** Đẩy hình tròn (tâm p, bán kính BAN_KINH) ra khỏi mọi vật cản. */
export function dayRa(p, vatCan) {
  let { x, z } = p;
  for (let lap = 0; lap < 3; lap++) {
    let doi = false;
    for (const o of vatCan) {
      if (o.loai === 'tron') {
        const dx = x - o.x; const dz = z - o.z; const min = o.r + BAN_KINH;
        if (Math.abs(dx) >= min || Math.abs(dz) >= min) continue;
        const d = lenOf(dx, dz);
        if (d >= min) continue;
        if (d < 1e-6) { z = o.z + min; } else { x = o.x + (dx / d) * min; z = o.z + (dz / d) * min; }
        doi = true;
      } else {
        if (x <= o.x1 - BAN_KINH || x >= o.x2 + BAN_KINH || z <= o.z1 - BAN_KINH || z >= o.z2 + BAN_KINH) continue;
        const cx = Math.max(o.x1, Math.min(x, o.x2)); const cz = Math.max(o.z1, Math.min(z, o.z2));
        const dx = x - cx; const dz = z - cz; const d = lenOf(dx, dz);
        if (d >= BAN_KINH) continue;
        if (d < 1e-6) { // tâm nằm trong hộp → đẩy ra theo cạnh gần nhất
          const ra = [[x - o.x1, 'x1'], [o.x2 - x, 'x2'], [z - o.z1, 'z1'], [o.z2 - z, 'z2']].sort((a, b) => a[0] - b[0])[0][1];
          if (ra === 'x1') x = o.x1 - BAN_KINH; else if (ra === 'x2') x = o.x2 + BAN_KINH;
          else if (ra === 'z1') z = o.z1 - BAN_KINH; else z = o.z2 + BAN_KINH;
        } else { x = cx + (dx / d) * BAN_KINH; z = cz + (dz / d) * BAN_KINH; }
        doi = true;
      }
    }
    if (!doi) break;
  }
  return { x, z };
}

/** Một bước đi. `phim` = {w,a,s,d} hoặc vector {x,z}. Đi chéo không nhanh hơn. Không xuyên vật cản. */
export function buocDi(vitri, phim, dt, vatCan = [], goc = 0) {
  dt = Math.min(Math.max(Number(dt) || 0, 0), DT_TOI_DA);
  const h = huongDi(phim, goc);
  if (!h) return vatCan.length ? dayRa(vitri, vatCan) : { x: vitri.x, z: vitri.z };
  const l = lenOf(h.x, h.z); const ux = h.x / l; const uz = h.z / l;
  const quang = TOC_DO * dt * l;
  const n = Math.max(1, Math.ceil(quang / 0.1)); const buoc = quang / n;
  let p = { x: vitri.x, z: vitri.z };
  for (let i = 0; i < n; i++) p = dayRa({ x: p.x + ux * buoc, z: p.z + uz * buoc }, vatCan);
  return p;
}

// ---------------------------------------------------------------- Bản đồ
const R = (x1, z1, x2, z2) => ({ x1, z1, x2, z2 });
export const QUANG_TRUONG = R(-18, -18, 18, 18);

export const KHU = ['chung', 'chiem-tinh', 'tro-choi', 'trong-cay', 'xem-phim', 'phong-hop', 'cua-hang'];

export const PHONG = {
  chung: { ten: 'Common Plaza', icon: 'chung', mau: '#FFB347', rect: null, xuatHien: { x: 2.4, z: 1.6 }, giua: { x: 0, z: 0 },
    hanhLang: [R(-16, -26, -12, -18), R(12, -26, 16, -18), R(18, -2, 26, 2), R(-26, -2, -18, 2), R(12, 18, 16, 26), R(-16, 18, -12, 26), R(16, -24.5, 62.8, -19.5)] },
  'chiem-tinh': { ten: 'Astrology Room', icon: 'chiem-tinh', mau: '#8E5BFF', rect: R(-28, -44, -2, -26), xuatHien: { x: -14, z: -31.5 },
    giua: { x: -14, z: -32 }, cua: { mieng: { x: -14, z: -16 }, trong: { x: -14, z: -28.5 } }, canh: 's' },
  'tro-choi': { ten: 'Game Room', icon: 'tro-choi', mau: '#E4574F', rect: R(2, -50, 28, -26), xuatHien: { x: 14, z: -31.5 },
    giua: { x: 14, z: -38 }, cua: { mieng: { x: 14, z: -16 }, trong: { x: 14, z: -28.5 } }, canh: 's' },
  'trong-cay': { ten: 'Garden Room', icon: 'trong-cay', mau: '#62C46A', rect: R(26, -16, 58, 16), xuatHien: { x: 29, z: 0 },
    giua: { x: 41, z: -1 }, cua: { mieng: { x: 16, z: 0 }, trong: { x: 28.5, z: 0 } }, canh: 'w' },
  'xem-phim': { ten: 'Cinema', icon: 'xem-phim', mau: '#4A7BF0', rect: R(2, 26, 28, 52), xuatHien: { x: 14, z: 32 },
    giua: { x: 14, z: 34 }, cua: { mieng: { x: 14, z: 16 }, trong: { x: 14, z: 28.5 } }, canh: 'n', yawCam: Math.PI }, // rạp: camera ra sau hàng ghế để thấy màn hình
  'phong-hop': { ten: 'Meeting Room', icon: 'phong-hop', mau: '#F6E7C8', rect: R(-44, -10, -26, 10), xuatHien: { x: -29, z: 0 },
    giua: { x: -36, z: 5 }, cua: { mieng: { x: -16, z: 0 }, trong: { x: -28.5, z: 0 } }, canh: 'e' },
  'cua-hang': { ten: 'Shop & Wardrobe', icon: 'cua-hang', mau: '#F28AC0', rect: R(-28, 26, -2, 46), xuatHien: { x: -14, z: 29 },
    giua: { x: -14, z: 38 }, cua: { mieng: { x: -14, z: 16 }, trong: { x: -14, z: 28.5 } }, canh: 'n' },
};

// Areas added from campus-game (v4, then v5). The forest keeps that project's own coordinates shifted by LECH_RUNG so
// that its east fence (x = 46.2) lands on Top1's east fence (x = 62); the farm island is far away at x = -400.
export const LECH_RUNG = { x: 15.8, z: -27 };
export const RUNG = R(47 + LECH_RUNG.x, -40 + LECH_RUNG.z, 138 + LECH_RUNG.x, 38 + LECH_RUNG.z); // forest bounds
export const VUON = R(-436, -32, -364, 32);                                                   // farm island bounds (v5: 72 x 64 m)
export const LOI_RUNG = PHONG.chung.hanhLang[6];                                               // path plaza -> forest gate
export const KHU_PHU = {
  rung: { ten: 'Quiet Forest', icon: 'trong-cay', mau: '#2E7D32' },
  vuon: { ten: 'My Garden', icon: 'trong-cay', mau: '#62C46A' },
};

export const DAY_TUONG = 0.25; // nửa bề dày tường
const DAY = DAY_TUONG;
/** Tường quanh hình chữ nhật, chừa các lỗ cửa. lo = { n|s|e|w: [[từ, đến], …] } */
function tuongQuanh(r, lo = {}, phong) {
  const out = [];
  const canh = (huong, a, b, tao) => {
    const gaps = (lo[huong] ?? []).slice().sort((p, q) => p[0] - q[0]);
    let dau = a - DAY;
    for (const [g1, g2] of gaps) { if (g1 > dau) out.push(tao(dau, g1)); dau = g2; }
    if (b + DAY > dau) out.push(tao(dau, b + DAY));
  };
  canh('n', r.x1, r.x2, (a, b) => ({ loai: 'hop', x1: a, x2: b, z1: r.z1 - DAY, z2: r.z1 + DAY, phong }));
  canh('s', r.x1, r.x2, (a, b) => ({ loai: 'hop', x1: a, x2: b, z1: r.z2 - DAY, z2: r.z2 + DAY, phong }));
  canh('w', r.z1, r.z2, (a, b) => ({ loai: 'hop', x1: r.x1 - DAY, x2: r.x1 + DAY, z1: a, z2: b, phong }));
  canh('e', r.z1, r.z2, (a, b) => ({ loai: 'hop', x1: r.x2 - DAY, x2: r.x2 + DAY, z1: a, z2: b, phong }));
  return out;
}

function taoTuong() {
  const t = [];
  t.push(...tuongQuanh(QUANG_TRUONG, { n: [[-16, -12], [12, 16]], s: [[-16, -12], [12, 16]], e: [[-2, 2]], w: [[-2, 2]] }, 'chung'));
  const loi = PHONG.chung.hanhLang[6]; // forest path
  for (const h of PHONG.chung.hanhLang) {
    const doc = h.z2 - h.z1 > h.x2 - h.x1;
    if (doc) {
      t.push({ loai: 'hop', x1: h.x1 - DAY, x2: h.x1 + DAY, z1: h.z1, z2: h.z2, phong: 'hanh-lang' });
      if (h.x2 === loi.x1 && h.z1 < loi.z1 && h.z2 > loi.z2) { // leave the opening of the forest path
        t.push({ loai: 'hop', x1: h.x2 - DAY, x2: h.x2 + DAY, z1: h.z1, z2: loi.z1, phong: 'hanh-lang' }, { loai: 'hop', x1: h.x2 - DAY, x2: h.x2 + DAY, z1: loi.z2, z2: h.z2, phong: 'hanh-lang' });
      } else t.push({ loai: 'hop', x1: h.x2 - DAY, x2: h.x2 + DAY, z1: h.z1, z2: h.z2, phong: 'hanh-lang' });
    } else {
      const xa = h === loi ? h.x1 + DAY : h.x1; const xb = h === loi ? 62 : h.x2; // the path ends at the fence gate
      t.push({ loai: 'hop', x1: xa, x2: xb, z1: h.z1 - DAY, z2: h.z1 + DAY, phong: 'hanh-lang' }, { loai: 'hop', x1: xa, x2: xb, z1: h.z2 - DAY, z2: h.z2 + DAY, phong: 'hanh-lang' });
    }
  }
  for (const id of KHU.slice(1)) {
    const p = PHONG[id];
    const lo = p.canh === 'e' || p.canh === 'w' ? { [p.canh]: [[-2, 2]] } : { [p.canh]: [[p.cua.trong.x - 2, p.cua.trong.x + 2]] };
    t.push(...tuongQuanh(p.rect, lo, id));
  }
  return t;
}

/** Invisible limits of the v4 areas (not drawn): forest north / south / east, and all four sides of the garden island. */
function taoRanhNgoai() {
  const b = []; const d = 0.5;
  const hop = (x1, z1, x2, z2) => b.push({ loai: 'hop', x1, z1, x2, z2, phong: 'ranh' });
  hop(RUNG.x1, RUNG.z1 - d, RUNG.x2 + d, RUNG.z1); hop(RUNG.x1, RUNG.z2, RUNG.x2 + d, RUNG.z2 + d); hop(RUNG.x2, RUNG.z1, RUNG.x2 + d, RUNG.z2);
  hop(VUON.x1 - d, VUON.z1 - d, VUON.x2 + d, VUON.z1); hop(VUON.x1 - d, VUON.z2, VUON.x2 + d, VUON.z2 + d);
  hop(VUON.x1 - d, VUON.z1, VUON.x1, VUON.z2); hop(VUON.x2, VUON.z1, VUON.x2 + d, VUON.z2);
  return b;
}

/** Ghế quanh bàn tròn, quay mặt vào giữa bàn. */
function gheQuanh(ban, so, r, phong, goc0 = 0) {
  return Array.from({ length: so }, (_, i) => {
    const a = goc0 + (i / so) * Math.PI * 2;
    const x = ban.x + Math.sin(a) * r; const z = ban.z + Math.cos(a) * r;
    return { id: `ghe-${ban.id}-${i + 1}`, ban: ban.id, phong, x, z, huong: Math.atan2(ban.x - x, ban.z - z) };
  });
}

function taoBanDo() {
  const vat = []; const ban = []; const ghe = []; const vc = []; const nuoc = [];
  const them = (v) => { vat.push(v); return v; };
  const tron = (x, z, r) => vc.push({ loai: 'tron', x, z, r });
  const hop = (x1, z1, x2, z2) => vc.push({ loai: 'hop', x1, z1, x2, z2 });

  // ---- Phòng chung (quảng trường)
  them({ id: 'dong-lua', loai: 'trang-tri', phong: 'chung', x: 0, z: 0, ten: 'Campfire', moTa: 'Where everyone gathers. New arrivals appear right here.' });
  tron(0, 0, 1.6);
  const cong = { 'chiem-tinh': [-14, -18], 'tro-choi': [14, -18], 'trong-cay': [18, 0], 'xem-phim': [14, 18], 'phong-hop': [-18, 0], 'cua-hang': [-14, 18] };
  for (const [id, [x, z]] of Object.entries(cong)) {
    them({ id: `cong-${id}`, loai: 'cong', phong: 'chung', x, z, den: id, ten: PHONG[id].ten, mau: PHONG[id].mau, moTa: `Walk through this gate to reach the ${PHONG[id].ten}.` });
  }
  [[-10, 6], [10, 6], [0, 11.5], [0, -11]].forEach(([x, z], i) => {
    const b = { id: `ban-hoc-${i + 1}`, ten: 'Study table', phong: 'chung', x, z, r: 1.1, soGhe: 4,
      moTa: 'Sit down to study together: you earn Xu while seated and get a private table chat.', doVat: ['sach', 'den'] };
    ban.push(b); tron(x, z, b.r); ghe.push(...gheQuanh(b, 4, 1.9, 'chung', Math.PI / 4));
  });
  them({ id: 'loa-nhac', loai: 'vat', phong: 'chung', x: -15, z: 9, ten: 'Music Corner', moTa: 'Shared music from a YouTube queue. Press E here to open the music panel.' });
  tron(-15, 9, 0.7);
  for (const [x, z] of [[-16.6, -16.6], [16.6, -16.6], [-16.6, 16.6], [16.6, 16.6]]) tron(x, z, 0.8); // cột góc

  // ---- Chiêm tinh
  const ct = [['cua-than-so', 'Numerology', '#8E5BFF', -18.4], ['cua-tu-vi', 'Horoscope', '#E4574F', -14], ['cua-ban-do-sao', 'Star Chart', '#4A7BF0', -9.6]];
  for (const [id, ten, mau, x] of ct) {
    them({ id, loai: 'cua-chiem-tinh', phong: 'chiem-tinh', x, z: -42.4, ten, mau,
      moTa: `${ten}: one of the three parts of your reading. Touch the door, or press E in front of it.` });
    tron(x - 1.95, -42.8, 0.42); tron(x + 1.95, -42.8, 0.42);
  }
  them({ id: 'ba-dong', loai: 'npc', phong: 'chiem-tinh', x: -14, z: -36, ten: 'Madame Star', moTa: 'Tell me the day and hour you were born, and I will read your fortune for you.' });
  tron(-14, -36, 0.6);
  them({ id: 'vong-hoang-dao', loai: 'trang-tri', phong: 'chiem-tinh', x: -14, z: -36.5, ten: 'Zodiac ring' });
  [[-25, -31], [-3, -31]].forEach(([x, z], i) => { them({ id: `cau-pha-le-${i + 1}`, loai: 'trang-tri', phong: 'chiem-tinh', x, z, ten: 'Crystal ball' }); tron(x, z, 0.7); });

  // ---- Trò chơi
  const tc = [
    { id: 'ban-ma-soi', ten: 'Werewolf', x: 8, z: -43, r: 1.9, soGhe: 10, rg: 3.0, nguoi: '6–10 players', doVat: ['den-long', 'mat-na-soi'], mau: '#5B3FA8' },
    { id: 'ban-bai-mau', ten: 'Colour Cards', x: 21, z: -43, r: 1.2, soGhe: 4, rg: 2.0, nguoi: '2–4 players', doVat: ['la-bai'], mau: '#E4574F' },
    { id: 'ban-ca-ngua', ten: 'Ludo', x: 21.5, z: -32.5, r: 1.3, soGhe: 4, rg: 2.1, nguoi: '2–4 players', doVat: ['ban-co', 'quan-co'], mau: '#30A46C' },
    { id: 'ban-ghep-mau', ten: 'Colour Match', x: 6.5, z: -32.5, r: 0.9, soGhe: 2, rg: 1.7, nguoi: '1 player per chair', doVat: ['khoi-mau'], mau: '#FFC53D' },
  ];
  for (const b of tc) {
    ban.push({ ...b, phong: 'tro-choi', moTa: `${b.ten} · ${b.nguoi}. Touch the table to read the rules or to take a seat; winning pays Xu.` });
    tron(b.x, b.z, b.r);
    ghe.push(...gheQuanh(b, b.soGhe, b.rg, 'tro-choi', b.soGhe === 2 ? Math.PI / 2 : b.soGhe === 4 ? Math.PI / 4 : 0));
  }

  // ---- Trồng cây
  let n = 0;
  for (const z of [-12.5, -9, -5.5]) for (const x of [32, 37]) {
    n++; them({ id: `luong-${n}`, loai: 'luong', phong: 'trong-cay', x, z, ten: `Garden bed ${n}`, luong: n - 1, moTa: 'Plant a vegetable seed, water and fertilise it, then harvest. Press E next to the bed.' });
    hop(x - 1.7, z - 1.2, x + 1.7, z + 1.2);
  }
  const hoCa = { id: 'ho-ca', x: 50, z: -8, r: 4.5 }; const hoCau = { id: 'ho-cau', x: 50, z: 9, r: 5 };
  nuoc.push(hoCa, hoCau); tron(hoCa.x, hoCa.z, hoCa.r); tron(hoCau.x, hoCau.z, hoCau.r);
  them({ id: 'ho-ca', loai: 'nuoc', phong: 'trong-cay', x: hoCa.x, z: hoCa.z, r: hoCa.r, ten: 'Fish pond', moTa: 'Your fish live here too: release, feed or take them out. Press E at the edge.' });
  them({ id: 'ben-cau', loai: 'vat', phong: 'trong-cay', x: 44.6, z: 9, diemDung: { x: 44.2, z: 9 }, ten: 'Fishing dock', moTa: 'Stand at the end of the dock and press E to cast your line.' });
  them({ id: 'dai-phun-nuoc', loai: 'trang-tri', phong: 'trong-cay', x: 38, z: 6, ten: 'Fountain' }); tron(38, 6, 2.2);
  them({ id: 'quay-hang', loai: 'vat', phong: 'trong-cay', x: 31, z: 11.5, ten: 'Garden stall', moTa: 'Buy seeds, fish and supplies with Xu, or sell your produce. Press E at the counter.' });
  hop(29, 10.3, 33, 12.7);

  // ---- Xem phim
  const mh = { id: 'man-hinh', loai: 'man-hinh', phong: 'xem-phim', x: 15, z: 51.4, rong: 12, cao: 6.75, ten: 'Big screen', moTa: 'Paste a YouTube link in the Cinema queue panel and everyone inside watches together.' };
  them(mh);
  const tam = { x: 15, z: 51.5 };
  [[8.5, 9], [11.5, 11], [14.5, 13]].forEach(([r, so], hang) => {
    const goc = 0.9; // ±51°
    for (let i = 0; i < so; i++) {
      const a = -goc + (2 * goc * i) / (so - 1);
      const x = tam.x + Math.sin(a) * r; const z = tam.z - Math.cos(a) * r;
      ghe.push({ id: `ghe-rap-${hang + 1}-${i + 1}`, ban: `hang-${hang + 1}`, phong: 'xem-phim', x, z, huong: Math.atan2(mh.x - x, mh.z - z), hang });
    }
  });
  them({ id: 'quay-bong-ngo', loai: 'vat', phong: 'xem-phim', x: 5, z: 30, ten: 'Popcorn stand', sapCo: true, moTa: 'Popcorn and drinks. Coming soon.' });
  hop(3.6, 29.2, 6.4, 30.8);

  // ---- Phòng họp
  hop(-40, -1.2, -32, 1.2);
  ban.push({ id: 'ban-hop', ten: 'Meeting table', phong: 'phong-hop', x: -36, z: 0, soGhe: 10, moTa: 'Sit down for a meeting: seated players earn Xu and share a table chat.', doVat: ['so', 'coc'] });
  let k = 0;
  for (const x of [-39, -37, -35, -33]) for (const z of [-2, 2]) { k++; ghe.push({ id: `ghe-hop-${k}`, ban: 'ban-hop', phong: 'phong-hop', x, z, huong: Math.atan2(0, -z) }); }
  ghe.push({ id: 'ghe-hop-9', ban: 'ban-hop', phong: 'phong-hop', x: -41.2, z: 0, huong: Math.PI / 2 });
  ghe.push({ id: 'ghe-hop-10', ban: 'ban-hop', phong: 'phong-hop', x: -30.8, z: 0, huong: -Math.PI / 2 });
  them({ id: 'bang-trang', loai: 'vat', phong: 'phong-hop', x: -43.4, z: 0, ten: 'Whiteboard', sapCo: true, moTa: 'Write and draw together during a meeting. Coming soon.' });

  // ---- Cửa hàng & Thay đồ
  them({ id: 'gia-quan-ao', loai: 'vat', phong: 'cua-hang', x: -22, z: 36, ten: 'Clothes rack', sapCo: true, moTa: 'Clothes, hats and accessories for sale. Coming soon; for now use the mirror to change your look for free.' });
  hop(-24.5, 33.6, -19.5, 34.4); hop(-24.5, 37.6, -19.5, 38.4);
  them({ id: 'guong', loai: 'vat', phong: 'cua-hang', x: -6, z: 26.9, ten: 'Wardrobe mirror', moTa: 'Change how your character looks. Press E at the mirror.' });
  them({ id: 'quay-cua-hang', loai: 'vat', phong: 'cua-hang', x: -5, z: 36, ten: 'Shop counter', moTa: 'Seeds, fish, decorations, upgrades, and a place to sell. Press E at the counter.' });
  hop(-6.4, 34.6, -3.6, 37.4);

  return { vat, ban, ghe, nuoc, vatCan: vc, tuong: taoTuong(), ranh: taoRanhNgoai(),
    khongKhi: { // ban ngày như ảnh mẫu PO; riêng chiêm tinh (huyền bí) và rạp (tắt đèn) có không khí riêng
      chung: { troi: ['#7EC3EE', '#CDEFD8'], anhSang: 1.0 },
      'chiem-tinh': { troi: ['#1B1440', '#4A3590'], anhSang: 0.5, anh: '#A58BFF' },
      'tro-choi': { troi: ['#7EC3EE', '#CDEFD8'], anhSang: 1.0 },
      'trong-cay': { troi: ['#78C4F2', '#D6F3DC'], anhSang: 1.05 },
      'xem-phim': { troi: ['#1E2350', '#3B3F7A'], anhSang: 0.38, anh: '#8C95FF' },
      'phong-hop': { troi: ['#7EC3EE', '#CDEFD8'], anhSang: 1.0 },
      'cua-hang': { troi: ['#7EC3EE', '#CDEFD8'], anhSang: 1.0 },
      rung: { troi: ['#7FC9EC', '#B4E3C8'], anhSang: 0.9, anh: '#DFF5E1' },   // v4 forest: slightly greener, softer light
      vuon: { troi: ['#78C4F2', '#D6F3DC'], anhSang: 1.05 },                  // v4 garden island: bright day
    } };
}

export const BAN_DO = taoBanDo();
const TAT_CA = [...BAN_DO.tuong, ...BAN_DO.ranh, ...BAN_DO.vatCan]; // other modules may push more obstacles (v4 scenery)
export const vatCanTatCa = () => TAT_CA;

// ---------------------------------------------------------------- F4 · khu, vùng đi, tìm đường
const trongRect = (r, x, z, e = 0) => x >= r.x1 - e && x <= r.x2 + e && z >= r.z1 - e && z <= r.z2 + e;

export function phongTaiViTri(x, z) {
  for (const id of KHU) if (PHONG[id].rect && trongRect(PHONG[id].rect, x, z)) return id;
  return 'chung';
}

export function trongVungDi(x, z) {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return false;
  if (trongRect(QUANG_TRUONG, x, z, 0.01)) return true;
  if (PHONG.chung.hanhLang.some((h) => trongRect(h, x, z, 0.01))) return true;
  if (trongRect(RUNG, x, z, 0.01) || trongRect(VUON, x, z, 0.01)) return true;
  return KHU.slice(1).some((id) => trongRect(PHONG[id].rect, x, z, 0.01));
}

/** Like phongTaiViTri but also knows the v4 areas: 'rung' (forest, incl. its gate corridor), 'vuon' (garden island), 'loi-rung' (path to the gate). */
export function vungTaiViTri(x, z) {
  if (trongRect(VUON, x, z, 1)) return 'vuon';
  if (trongRect(RUNG, x, z, 0.5)) return 'rung';
  if (x > LOI_RUNG.x1 + 0.3 && trongRect(LOI_RUNG, x, z, 0.3)) return 'loi-rung';
  return phongTaiViTri(x, z);
}

/** Chèn điểm vòng tránh khi đoạn thẳng a→b cắt vật cản tròn. */
function vongTranh(a, b, sau = 0) {
  if (sau > 3) return [b];
  const dx = b.x - a.x; const dz = b.z - a.z; const L = lenOf(dx, dz);
  if (L < 0.5) return [b];
  const ux = dx / L; const uz = dz / L;
  let gan = null;
  for (const o of BAN_DO.vatCan) {
    if (o.loai !== 'tron') continue;
    const t = (o.x - a.x) * ux + (o.z - a.z) * uz;
    if (t <= 0 || t >= L) continue;
    const lech = (o.x - a.x) * uz - (o.z - a.z) * ux; // khoảng cách có dấu từ đường đi tới tâm vật
    if (Math.abs(lech) < o.r + BAN_KINH + 0.15 && (!gan || t < gan.t)) gan = { o, t, lech };
  }
  if (!gan) return [b];
  const { o, lech } = gan; const phia = lech >= 0 ? -1 : 1; const kc = o.r + BAN_KINH + 0.9;
  const w = { x: o.x + phia * uz * kc, z: o.z - phia * ux * kc };
  return [...vongTranh(a, w, sau + 1), ...vongTranh(w, b, sau + 1)];
}

/** Đường đi (danh sách điểm) từ `tu` tới `den`, qua cửa và hành lang, vòng tránh vật tròn. */
export function timDuong(tu, den) {
  const va = vungTaiViTri(tu.x, tu.z); const vb = vungTaiViTri(den.x, den.z);
  const phiaRung = (v) => v === 'rung' || v === 'loi-rung';
  if (va === 'vuon' || vb === 'vuon' || (phiaRung(va) && phiaRung(vb))) return [{ x: den.x, z: den.z }]; // v4 areas: walk straight
  const a = phiaRung(va) ? 'chung' : va; const b = phiaRung(vb) ? 'chung' : vb;
  const zL = (LOI_RUNG.z1 + LOI_RUNG.z2) / 2; // the forest path branches east off the Game Room corridor (x = 14)
  const quaLoi = [{ x: 14, z: -16.5 }, { x: 14, z: zL }, { x: 20, z: zL }];
  const diem = [];
  if (phiaRung(va)) diem.push(...quaLoi.slice().reverse());
  if (a !== b) {
    if (a !== 'chung') diem.push(PHONG[a].cua.trong, PHONG[a].cua.mieng);
    if (b !== 'chung') diem.push(PHONG[b].cua.mieng, PHONG[b].cua.trong);
  }
  if (phiaRung(vb)) diem.push(...quaLoi);
  diem.push({ x: den.x, z: den.z });
  const out = []; let truoc = tu;
  for (const d of diem) { out.push(...vongTranh(truoc, d)); truoc = d; }
  return out;
}

// ---------------------------------------------------------------- Ghế
export function dungDay(ghe, ten) {
  const out = {};
  for (const [k, v] of Object.entries(ghe ?? {})) if (v !== ten) out[k] = v;
  return out;
}

export function ngoiGhe(ghe, gheId, ten) {
  if (!BAN_DO.ghe.some((g) => g.id === gheId)) return { ok: false, loi: 'There is no such seat', ghe: { ...ghe } };
  if (ghe?.[gheId] && ghe[gheId] !== ten) return { ok: false, loi: 'That seat is taken', ghe: { ...ghe } };
  const moi = dungDay(ghe, ten); moi[gheId] = ten;
  return { ok: true, loi: null, ghe: moi };
}

/** Dịch chuyển bằng bản đồ: tới điểm xuất hiện của khu, đứng dậy. */
export function doiKhu(state, id, ten) {
  if (!PHONG[id]) throw new Error(`Unknown zone ${id}`);
  return { ...state, room: id, ghe: dungDay(state.ghe, ten), player: { ...state.player, ...PHONG[id].xuatHien, seat: null } };
}

// ---------------------------------------------------------------- Lưu / đọc (localStorage)
export function docLuu(raw) {
  let d = null;
  try { d = JSON.parse(raw); } catch { d = null; }
  if (!d || typeof d !== 'object') d = {};
  const kt = typeof d.ten === 'string' ? kiemTraTen(d.ten) : { ok: false };
  const ten = kt.ok ? kt.ten : '';
  const mau = MAU_NHAN_VAT.includes(d.mau) ? d.mau : MAU_NHAN_VAT[0];
  let { x, z } = d;
  const tot = Number.isFinite(x) && Number.isFinite(z) && trongVungDi(x, z)
    && TAT_CA.every((o) => { const p = dayRa({ x, z }, [o]); return p.x === x && p.z === z; });
  if (!tot) ({ x, z } = PHONG.chung.xuatHien);
  return { ten, mau, x, z };
}

export function createState() {
  return { screen: 'vao-game', room: 'chung', fps: 0, ghe: {},
    player: { name: '', color: MAU_NHAN_VAT[0], ...PHONG.chung.xuatHien, anim: 'dung', seat: null, huong: Math.PI } };
}
