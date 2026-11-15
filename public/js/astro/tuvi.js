// Tử Vi Đẩu Số chart for the Astrology Room — pure functions (checked by tests/astro.test.mjs).
// Positions are earthly branches: 0 = Tý, 1 = Sửu, 2 = Dần … 11 = Hợi.
// School choices (the spec's tentative answers, Vietnamese "bắc phái" as taught by Thái Thứ Lang):
//   • a birth between 23:00 and 23:59 is the Tý hour of the NEXT day
//   • a birth abroad is first converted to Vietnam time (UTC+7)
//   • a leap month counts as the same month (not in the spec; kept from the first version of this game)
//   • about 50 stars: 14 main stars, 6 lucky, 6 harsh, Lộc Tồn, Thiên Mã, the four Hóa, the Tràng Sinh ring,
//     Tuần, Triệt, Đào Hoa, Hồng Loan, Thiên Hỷ
import { mod, jdFromDate, addDays, solarToLunar, CAN, CHI, ANIMAL, napAm, napAmInfo, yearCan, yearChi, hourBranch, hourRange, dayCan, dayChi } from './calendar.js';

export const PALACES = ['Mệnh', 'Phụ Mẫu', 'Phúc Đức', 'Điền Trạch', 'Quan Lộc', 'Nô Bộc', 'Thiên Di', 'Tật Ách', 'Tài Bạch', 'Tử Tức', 'Phu Thê', 'Huynh Đệ'];
export const PALACE_EN = { 'Mệnh': 'Self', 'Phụ Mẫu': 'Parents', 'Phúc Đức': 'Fortune', 'Điền Trạch': 'Home', 'Quan Lộc': 'Career', 'Nô Bộc': 'Friends',
  'Thiên Di': 'Travel', 'Tật Ách': 'Health', 'Tài Bạch': 'Wealth', 'Tử Tức': 'Children', 'Phu Thê': 'Partner', 'Huynh Đệ': 'Siblings' };
export const MAIN_STARS = ['Tử Vi', 'Thiên Cơ', 'Thái Dương', 'Vũ Khúc', 'Thiên Đồng', 'Liêm Trinh', 'Thiên Phủ', 'Thái Âm', 'Tham Lang', 'Cự Môn', 'Thiên Tướng', 'Thiên Lương', 'Thất Sát', 'Phá Quân'];
export const GOOD_STARS = ['Tả Phù', 'Hữu Bật', 'Văn Xương', 'Văn Khúc', 'Thiên Khôi', 'Thiên Việt', 'Lộc Tồn', 'Thiên Mã', 'Hóa Lộc', 'Hóa Quyền', 'Hóa Khoa', 'Đào Hoa', 'Hồng Loan', 'Thiên Hỷ'];
export const BAD_STARS = ['Kình Dương', 'Đà La', 'Địa Không', 'Địa Kiếp', 'Hỏa Tinh', 'Linh Tinh', 'Hóa Kỵ'];
export const RING = ['Tràng Sinh', 'Mộc Dục', 'Quan Đới', 'Lâm Quan', 'Đế Vượng', 'Suy', 'Bệnh', 'Tử', 'Mộ', 'Tuyệt', 'Thai', 'Dưỡng'];
export const HOA = ['Hóa Lộc', 'Hóa Quyền', 'Hóa Khoa', 'Hóa Kỵ'];

// How bright each main star is in each branch (Tý … Hợi): M miếu, V vượng, D đắc, B bình hòa, H hãm
const BRIGHT = {
  'Tử Vi': 'BDMBVMMDMBVB', 'Thiên Cơ': 'DDHMMVDDVMMH', 'Thái Dương': 'HDVVVMMDHHHH', 'Vũ Khúc': 'VMVDMHVMVDMH', 'Thiên Đồng': 'VHMDHDHHMHHD',
  'Liêm Trinh': 'VDVHMHVDVHMH', 'Thiên Phủ': 'MBMBVDMDMBVD', 'Thái Âm': 'VDHHHHHDVMMM', 'Tham Lang': 'HMDHVHHMDHVH', 'Cự Môn': 'VHVMHHVHDMHD',
  'Thiên Tướng': 'VDMHVDVDMHVD', 'Thiên Lương': 'VDVVMHMDVHMH', 'Thất Sát': 'MDMHHVMDMHHV', 'Phá Quân': 'MVHHDHMVHHDH',
};
export const BRIGHT_NAME = { M: 'miếu', V: 'vượng', D: 'đắc', B: 'bình', H: 'hãm' };
export const BRIGHT_EN = { M: 'at its best', V: 'strong', D: 'at ease', B: 'neutral', H: 'dimmed' };
const LOC_TON = [2, 3, 5, 6, 5, 6, 8, 9, 11, 0];                       // by the year's can: Giáp -> Dần, Ất -> Mão, …
const KHOI_VIET = [[1, 7], [0, 8], [11, 9], [11, 9], [1, 7], [0, 8], [6, 2], [6, 2], [3, 5], [3, 5]]; // [Thiên Khôi, Thiên Việt] by the year's can
// Tứ hóa by a year's can: [Hóa Lộc, Hóa Quyền, Hóa Khoa, Hóa Kỵ]
const TU_HOA = [['Liêm Trinh', 'Phá Quân', 'Vũ Khúc', 'Thái Dương'], ['Thiên Cơ', 'Thiên Lương', 'Tử Vi', 'Thái Âm'], ['Thiên Đồng', 'Thiên Cơ', 'Văn Xương', 'Liêm Trinh'],
  ['Thái Âm', 'Thiên Đồng', 'Thiên Cơ', 'Cự Môn'], ['Tham Lang', 'Thái Âm', 'Hữu Bật', 'Thiên Cơ'], ['Vũ Khúc', 'Tham Lang', 'Thiên Lương', 'Văn Khúc'],
  ['Thái Dương', 'Vũ Khúc', 'Thái Âm', 'Thiên Đồng'], ['Cự Môn', 'Thái Dương', 'Văn Khúc', 'Văn Xương'], ['Thiên Lương', 'Tử Vi', 'Thiên Phủ', 'Vũ Khúc'], ['Phá Quân', 'Cự Môn', 'Thái Âm', 'Tham Lang']];
const CUC = { Thuy: 2, Moc: 3, Kim: 4, Tho: 5, Hoa: 6 };
const CUC_NAME = { Thuy: 'Thủy nhị cục', Moc: 'Mộc tam cục', Kim: 'Kim tứ cục', Tho: 'Thổ ngũ cục', Hoa: 'Hỏa lục cục' };
const RING_START = { Thuy: 8, Tho: 8, Moc: 11, Kim: 5, Hoa: 2 };         // where Tràng Sinh sits, by the cục's element
const CHU_MENH = ['Tham Lang', 'Cự Môn', 'Lộc Tồn', 'Văn Khúc', 'Liêm Trinh', 'Vũ Khúc', 'Phá Quân', 'Vũ Khúc', 'Liêm Trinh', 'Văn Khúc', 'Lộc Tồn', 'Cự Môn'];
const CHU_THAN = ['Linh Tinh', 'Thiên Tướng', 'Thiên Lương', 'Thiên Đồng', 'Văn Xương', 'Thiên Cơ', 'Hỏa Tinh', 'Thiên Tướng', 'Thiên Lương', 'Thiên Đồng', 'Văn Xương', 'Thiên Cơ'];
const GEN = { Moc: 'Hoa', Hoa: 'Tho', Tho: 'Kim', Kim: 'Thuy', Thuy: 'Moc' };   // a -> the element it feeds
const CTRL = { Moc: 'Tho', Tho: 'Thuy', Thuy: 'Hoa', Hoa: 'Kim', Kim: 'Moc' };  // a -> the element it holds back
/** How the Mệnh element and the Cục element get on: 'cucFeedsMenh' | 'menhFeedsCuc' | 'same' | 'menhControlsCuc' | 'cucControlsMenh'. */
export function elementRelation(menh, cuc) {
  if (menh === cuc) return 'same';
  if (GEN[cuc] === menh) return 'cucFeedsMenh';
  if (GEN[menh] === cuc) return 'menhFeedsCuc';
  return CTRL[menh] === cuc ? 'menhControlsCuc' : 'cucControlsMenh';
}
/** Where Tử Vi sits for a cục number (2–6) and a lunar day (1–30). */
export function tuViPosition(cuc, day) {
  const q = Math.ceil(day / cuc); const r = q * cuc - day;
  return mod(2 + (q - 1) + (r % 2 === 0 ? r : -r), 12);
}

/**
 * The chart.
 * birth: { d, m, y, hour, minute, gender: 'M' | 'F', tz (hours east of UTC at the birth place, default 7), unknownTime }
 * today: { d, m, y } (defaults to the browser's date) — used for the current decade and this year's luck.
 */
export function tuVi(birth, today) {
  const t = today || (() => { const n = new Date(); return { d: n.getDate(), m: n.getMonth() + 1, y: n.getFullYear() }; })();
  const notes = [];
  let { d, m, y } = birth; let hour = birth.unknownTime ? 0 : (birth.hour || 0); let minute = birth.unknownTime ? 0 : (birth.minute || 0);
  const tz = birth.tz == null ? 7 : birth.tz;
  if (birth.unknownTime) notes.push('unknownTime');
  else if (tz !== 7) { // birth abroad: use Vietnam time
    let mins = hour * 60 + minute + Math.round((7 - tz) * 60); let shift = 0;
    while (mins < 0) { mins += 1440; shift--; } while (mins >= 1440) { mins -= 1440; shift++; }
    if (shift) ({ d, m, y } = addDays(d, m, y, shift));
    hour = Math.floor(mins / 60); minute = mins % 60; notes.push('vietnamTime');
  }
  if (hour >= 23) { ({ d, m, y } = addDays(d, m, y, 1)); notes.push('lateTy'); } // 23:00–23:59 = the Tý hour of the next day
  const lunar = solarToLunar(d, m, y);
  const yc = yearCan(lunar.year); const yz = yearChi(lunar.year);
  const h = hourBranch(hour); const month = lunar.month;
  const male = birth.gender !== 'F'; const yang = yc % 2 === 0;
  const forward = yang === male;                        // Dương nam / Âm nữ go forward, Âm nam / Dương nữ go backward
  const dir = forward ? 1 : -1;

  const menh = mod(2 + (month - 1) - h, 12);           // from Dần count forward to the month, back by the hour
  const than = mod(2 + (month - 1) + h, 12);
  const canDan = [2, 4, 6, 8, 0][yc % 5];               // can of the Dần month ("ngũ hổ độn")
  const canOf = (pos) => mod(canDan + mod(pos - 2, 12), 10);
  const cucElement = napAm(canOf(menh), menh); const cuc = CUC[cucElement];
  const tuvi = tuViPosition(cuc, lunar.day);
  const phu = mod(4 - tuvi, 12);                        // Thiên Phủ mirrors Tử Vi across the Dần–Thân axis

  const at = {}; // star name -> position
  const put = (name, pos) => { at[name] = mod(pos, 12); };
  put('Tử Vi', tuvi); put('Thiên Cơ', tuvi - 1); put('Thái Dương', tuvi - 3); put('Vũ Khúc', tuvi - 4); put('Thiên Đồng', tuvi - 5); put('Liêm Trinh', tuvi - 8);
  put('Thiên Phủ', phu); put('Thái Âm', phu + 1); put('Tham Lang', phu + 2); put('Cự Môn', phu + 3); put('Thiên Tướng', phu + 4); put('Thiên Lương', phu + 5); put('Thất Sát', phu + 6); put('Phá Quân', phu + 10);
  const loc = LOC_TON[yc];
  put('Lộc Tồn', loc); put('Kình Dương', loc + 1); put('Đà La', loc - 1);
  put('Văn Xương', 10 - h); put('Văn Khúc', 4 + h); put('Tả Phù', 4 + (month - 1)); put('Hữu Bật', 10 - (month - 1));
  put('Thiên Khôi', KHOI_VIET[yc][0]); put('Thiên Việt', KHOI_VIET[yc][1]);
  put('Địa Kiếp', 11 + h); put('Địa Không', 11 - h);
  const grp = yz % 4; // 0 Thân Tý Thìn · 1 Tỵ Dậu Sửu · 2 Dần Ngọ Tuất · 3 Hợi Mão Mùi
  put('Hỏa Tinh', [2, 3, 1, 9][grp] + dir * h); put('Linh Tinh', [10, 10, 3, 10][grp] - dir * h);
  put('Thiên Mã', [2, 11, 8, 5][grp]); put('Đào Hoa', [9, 6, 3, 0][grp]);
  put('Hồng Loan', 3 - yz); put('Thiên Hỷ', 9 - yz);
  const hoa = TU_HOA[yc].map((star, i) => ({ hoa: HOA[i], star, pos: at[star] }));
  const ringStart = RING_START[cucElement];
  const tuanStart = mod(yz - yc, 12); const tuan = [mod(tuanStart - 2, 12), mod(tuanStart - 1, 12)];
  const triet = [[8, 9], [6, 7], [4, 5], [2, 3], [0, 1]][yc % 5];

  const palaces = Array.from({ length: 12 }, (_, pos) => {
    const name = PALACES[mod(pos - menh, 12)]; const k = mod(dir * (pos - menh), 12); // k-th decade
    return { pos, chi: CHI[pos], can: CAN[canOf(pos)], name, en: PALACE_EN[name], isMenh: pos === menh, isThan: pos === than,
      main: MAIN_STARS.filter((s) => at[s] === pos).map((s) => ({ name: s, bright: BRIGHT[s][pos] })),
      good: GOOD_STARS.filter((s) => at[s] === pos), bad: BAD_STARS.filter((s) => at[s] === pos),
      hoa: hoa.filter((x) => x.pos === pos).map((x) => ({ hoa: x.hoa, star: x.star })),
      ring: RING[mod(dir * (pos - ringStart), 12)], tuan: tuan.includes(pos), triet: triet.includes(pos),
      decade: { from: cuc + 10 * k, to: cuc + 10 * k + 9 } };
  });
  for (const p of palaces) for (const x of p.hoa) (x.hoa === 'Hóa Kỵ' ? p.bad : p.good).push(x.hoa);

  const jd = jdFromDate(d, m, y); const dc = dayCan(jd);
  const info = napAmInfo(yc, yz);
  // ---- now: the running decade and this year's small luck (tiểu hạn)
  const nowLunar = solarToLunar(t.d, t.m, t.y);
  const ageVN = Math.max(1, nowLunar.year - lunar.year + 1);
  const decades = palaces.slice().sort((a, b) => a.decade.from - b.decade.from).map((p) => ({ pos: p.pos, name: p.name, from: p.decade.from, to: p.decade.to, current: ageVN >= p.decade.from && ageVN <= p.decade.to }));
  const nc = yearCan(nowLunar.year); const nz = yearChi(nowLunar.year);
  const smallPos = mod([10, 7, 4, 1][grp] + (male ? 1 : -1) * mod(nz - yz, 12), 12);
  const yearNow = { year: nowLunar.year, canChi: `${CAN[nc]} ${CHI[nz]}`, animal: ANIMAL[nz], pos: smallPos, palace: palaces[smallPos].name,
    hoa: TU_HOA[nc].map((star, i) => ({ hoa: HOA[i], star, pos: at[star], palace: palaces[at[star]].name })) };

  return {
    notes, used: { d, m, y, hour, minute }, lunar, hour: h, hourName: CHI[h], hourRange: hourRange(h),
    yearCan: yc, yearChi: yz, year: `${CAN[yc]} ${CHI[yz]}`, animal: ANIMAL[yz],
    monthCanChi: `${CAN[mod(canDan + month - 1, 10)]} ${CHI[mod(month + 1, 12)]}`, dayCanChi: `${CAN[dc]} ${CHI[dayChi(jd)]}`, hourCanChi: `${CAN[mod((dc % 5) * 2 + h, 10)]} ${CHI[h]}`,
    yang, male, forward, polarity: `${yang ? 'Dương' : 'Âm'} ${male ? 'nam' : 'nữ'}`, polarityEn: `${yang ? 'Yang' : 'Yin'} ${male ? 'male' : 'female'}`,
    menhElement: info.element, napAmName: info.name, napAmGloss: info.gloss,
    cuc, cucElement, cucName: CUC_NAME[cucElement], relation: elementRelation(info.element, cucElement),
    chuMenh: CHU_MENH[yz], chuThan: CHU_THAN[yz],
    menh, than, thanPalace: palaces[than].name, tuvi, at, hoa, tuan, triet, palaces,
    ageVN, decades, currentDecade: decades.find((x) => x.current) || null, yearNow,
  };
}

/** The 4 x 4 board of a paper chart: which branch sits in each cell, row by row (-1 = the centre block). */
export const BOARD = [5, 6, 7, 8, 4, -1, -1, 9, 3, -1, -1, 10, 2, 1, 0, 11];
