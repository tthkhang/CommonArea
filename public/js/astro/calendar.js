// Calendar maths for the Astrology Room — pure functions, no DOM (checked by tests/astro.test.mjs).
//   jdFromDate / dateFromJd      Julian day number  <->  calendar date
//   solarToLunar / lunarToSolar  Vietnamese lunar calendar (Ho Ngoc Duc's algorithm, UTC+7)
//   lunarLeapMonth, lunarMonthLength, can-chi names, nạp âm
export const mod = (n, m) => ((n % m) + m) % m;
const PI = Math.PI; const DR = PI / 180;

export const isLeapYear = (y) => y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
export const daysInMonth = (m, y) => [31, isLeapYear(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Julian day number (the day that starts at noon UT) of a Gregorian date. */
export function jdFromDate(dd, mm, yy) {
  const a = Math.floor((14 - mm) / 12); const y = yy + 4800 - a; const m = mm + 12 * a - 3;
  let jd = dd + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
  if (jd < 2299161) jd = dd + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - 32083;
  return jd;
}
export function dateFromJd(jd) {
  let b; let c;
  if (jd > 2299160) { const a = jd + 32044; b = Math.floor((4 * a + 3) / 146097); c = a - Math.floor((b * 146097) / 4); } else { b = 0; c = jd + 32082; }
  const d = Math.floor((4 * c + 3) / 1461); const e = c - Math.floor((1461 * d) / 4); const m = Math.floor((5 * e + 2) / 153);
  return { d: e - Math.floor((153 * m + 2) / 5) + 1, m: m + 3 - 12 * Math.floor(m / 10), y: b * 100 + d - 4800 + Math.floor(m / 10) };
}
/** 0 = Sunday … 6 = Saturday */
export const weekday = (d, m, y) => mod(jdFromDate(d, m, y) + 1, 7);
/** Move a calendar date by a number of days. */
export const addDays = (d, m, y, n) => dateFromJd(jdFromDate(d, m, y) + n);

// ---------------------------------------------------------------- new moons and the Sun's longitude (Meeus, as used by Ho Ngoc Duc)
export function newMoon(k) {
  const T = k / 1236.85; const T2 = T * T; const T3 = T2 * T;
  let jd1 = 2415020.75933 + 29.53058868 * k + 0.0001178 * T2 - 0.000000155 * T3;
  jd1 += 0.00033 * Math.sin((166.56 + 132.87 * T - 0.009173 * T2) * DR);
  const M = 359.2242 + 29.10535608 * k - 0.0000333 * T2 - 0.00000347 * T3;
  const Mpr = 306.0253 + 385.81691806 * k + 0.0107306 * T2 + 0.00001236 * T3;
  const F = 21.2964 + 390.67050646 * k - 0.0016528 * T2 - 0.00000239 * T3;
  let C1 = (0.1734 - 0.000393 * T) * Math.sin(M * DR) + 0.0021 * Math.sin(2 * DR * M);
  C1 = C1 - 0.4068 * Math.sin(Mpr * DR) + 0.0161 * Math.sin(DR * 2 * Mpr);
  C1 -= 0.0004 * Math.sin(DR * 3 * Mpr);
  C1 = C1 + 0.0104 * Math.sin(DR * 2 * F) - 0.0051 * Math.sin(DR * (M + Mpr));
  C1 = C1 - 0.0074 * Math.sin(DR * (M - Mpr)) + 0.0004 * Math.sin(DR * (2 * F + M));
  C1 = C1 - 0.0004 * Math.sin(DR * (2 * F - M)) - 0.0006 * Math.sin(DR * (2 * F + Mpr));
  C1 = C1 + 0.0010 * Math.sin(DR * (2 * F - Mpr)) + 0.0005 * Math.sin(DR * (2 * Mpr + M));
  const deltat = T < -11 ? 0.001 + 0.000839 * T + 0.0002261 * T2 - 0.00000845 * T3 - 0.000000081 * T * T3 : -0.000278 + 0.000265 * T + 0.000262 * T2;
  return jd1 + C1 - deltat;
}
const newMoonDay = (k, tz) => Math.floor(newMoon(k) + 0.5 + tz / 24);
/** Apparent longitude of the Sun in radians (0 .. 2π) at a Julian date. Good to about 0.01°. */
export function sunLongitudeRad(jdn) {
  const T = (jdn - 2451545.0) / 36525; const T2 = T * T;
  const M = 357.52910 + 35999.05030 * T - 0.0001559 * T2 - 0.00000048 * T * T2;
  const L0 = 280.46645 + 36000.76983 * T + 0.0003032 * T2;
  let DL = (1.914600 - 0.004817 * T - 0.000014 * T2) * Math.sin(DR * M);
  DL += (0.019993 - 0.000101 * T) * Math.sin(DR * 2 * M) + 0.000290 * Math.sin(DR * 3 * M);
  let Lr = (L0 + DL) * DR; Lr -= PI * 2 * Math.floor(Lr / (PI * 2));
  return Lr;
}
const sunSegment = (dayNumber, tz) => Math.floor(sunLongitudeRad(dayNumber - 0.5 - tz / 24) / PI * 6);
function lunarMonth11(yy, tz) {
  const off = jdFromDate(31, 12, yy) - 2415021; const k = Math.floor(off / 29.530588853);
  let nm = newMoonDay(k, tz);
  if (sunSegment(nm, tz) >= 9) nm = newMoonDay(k - 1, tz);
  return nm;
}
function leapMonthOffset(a11, tz) {
  const k = Math.floor((a11 - 2415021.076998695) / 29.530588853 + 0.5);
  let last = 0; let i = 1; let arc = sunSegment(newMoonDay(k + i, tz), tz);
  do { last = arc; i++; arc = sunSegment(newMoonDay(k + i, tz), tz); } while (arc !== last && i < 14);
  return i - 1;
}

/** Solar date -> { day, month, year, leap } in the Vietnamese lunar calendar. */
export function solarToLunar(dd, mm, yy, tz = 7) {
  const dayNumber = jdFromDate(dd, mm, yy);
  const k = Math.floor((dayNumber - 2415021.076998695) / 29.530588853);
  let monthStart = newMoonDay(k + 1, tz);
  if (monthStart > dayNumber) monthStart = newMoonDay(k, tz);
  let a11 = lunarMonth11(yy, tz); let b11 = a11; let year;
  if (a11 >= monthStart) { year = yy; a11 = lunarMonth11(yy - 1, tz); } else { year = yy + 1; b11 = lunarMonth11(yy + 1, tz); }
  const day = dayNumber - monthStart + 1;
  const diff = Math.floor((monthStart - a11) / 29);
  let leap = false; let month = diff + 11;
  if (b11 - a11 > 365) {
    const lm = leapMonthOffset(a11, tz);
    if (diff >= lm) { month = diff + 10; if (diff === lm) leap = true; }
  }
  if (month > 12) month -= 12;
  if (month >= 11 && diff < 4) year -= 1;
  return { day, month, year, leap };
}

/** Lunar date -> solar { d, m, y }, or null when that lunar date does not exist (wrong leap flag, day 30 of a 29-day month…). */
export function lunarToSolar(day, month, year, leap = false, tz = 7) {
  if (!(day >= 1 && day <= 30 && month >= 1 && month <= 12)) return null;
  let a11; let b11;
  if (month < 11) { a11 = lunarMonth11(year - 1, tz); b11 = lunarMonth11(year, tz); } else { a11 = lunarMonth11(year, tz); b11 = lunarMonth11(year + 1, tz); }
  const k = Math.floor(0.5 + (a11 - 2415021.076998695) / 29.530588853);
  let off = month - 11; if (off < 0) off += 12;
  if (b11 - a11 > 365) {
    const leapOff = leapMonthOffset(a11, tz); let leapMonth = leapOff - 2; if (leapMonth <= 0) leapMonth += 12;
    if (leap && month !== leapMonth) return null;
    if (leap || off >= leapOff) off += 1;
  } else if (leap) return null;
  const out = dateFromJd(newMoonDay(k + off, tz) + day - 1);
  const back = solarToLunar(out.d, out.m, out.y, tz); // day 30 of a short month rolls into the next month: refuse it
  return back.day === day && back.month === month && back.year === year && back.leap === !!leap ? out : null;
}
/** Which month is doubled in a lunar year (0 = no leap month). */
export function lunarLeapMonth(year, tz = 7) {
  const a = lunarMonth11(year - 1, tz); const b = lunarMonth11(year, tz);
  if (b - a > 365) { const m = leapMonthOffset(a, tz) - 2; if (m >= 1 && m <= 10) return m; }
  const c = lunarMonth11(year + 1, tz);
  if (c - b > 365) { const off = leapMonthOffset(b, tz); if (off === 1) return 11; if (off === 2) return 12; }
  return 0;
}
/** 29 or 30: how many days a lunar month has (0 when that month does not exist). */
export function lunarMonthLength(month, year, leap = false, tz = 7) {
  if (lunarToSolar(30, month, year, leap, tz)) return 30;
  return lunarToSolar(29, month, year, leap, tz) ? 29 : 0;
}

// ---------------------------------------------------------------- can chi, elements, nạp âm
export const CAN = ['Giáp', 'Ất', 'Bính', 'Đinh', 'Mậu', 'Kỷ', 'Canh', 'Tân', 'Nhâm', 'Quý'];
export const CHI = ['Tý', 'Sửu', 'Dần', 'Mão', 'Thìn', 'Tỵ', 'Ngọ', 'Mùi', 'Thân', 'Dậu', 'Tuất', 'Hợi'];
export const ANIMAL = ['Rat', 'Buffalo', 'Tiger', 'Cat', 'Dragon', 'Snake', 'Horse', 'Goat', 'Monkey', 'Rooster', 'Dog', 'Pig'];
export const ELEMENT_EN = { Kim: 'Metal', Moc: 'Wood', Thuy: 'Water', Hoa: 'Fire', Tho: 'Earth' };
export const ELEMENT_VI = { Kim: 'Kim', Moc: 'Mộc', Thuy: 'Thủy', Hoa: 'Hỏa', Tho: 'Thổ' };
// nạp âm of the 30 pairs of the 60-year cycle (Giáp Tý + Ất Sửu, Bính Dần + Đinh Mão, …): element, Vietnamese name, English gloss
const NAP_AM = [
  ['Kim', 'Hải Trung Kim', 'gold in the sea'], ['Hoa', 'Lư Trung Hỏa', 'fire in the furnace'], ['Moc', 'Đại Lâm Mộc', 'wood of the great forest'],
  ['Tho', 'Lộ Bàng Thổ', 'earth by the roadside'], ['Kim', 'Kiếm Phong Kim', 'metal of the sword point'], ['Hoa', 'Sơn Đầu Hỏa', 'fire on the mountain top'],
  ['Thuy', 'Giản Hạ Thủy', 'water under the stream'], ['Tho', 'Thành Đầu Thổ', 'earth of the city wall'], ['Kim', 'Bạch Lạp Kim', 'white wax metal'],
  ['Moc', 'Dương Liễu Mộc', 'willow wood'], ['Thuy', 'Tuyền Trung Thủy', 'water in the spring'], ['Tho', 'Ốc Thượng Thổ', 'earth on the roof'],
  ['Hoa', 'Tích Lịch Hỏa', 'fire of the thunderbolt'], ['Moc', 'Tùng Bách Mộc', 'pine and cypress wood'], ['Thuy', 'Trường Lưu Thủy', 'long flowing water'],
  ['Kim', 'Sa Trung Kim', 'gold in the sand'], ['Hoa', 'Sơn Hạ Hỏa', 'fire at the foot of the mountain'], ['Moc', 'Bình Địa Mộc', 'wood of the plain'],
  ['Tho', 'Bích Thượng Thổ', 'earth on the wall'], ['Kim', 'Kim Bạch Kim', 'gold leaf metal'], ['Hoa', 'Phú Đăng Hỏa', 'fire of the lamp'],
  ['Thuy', 'Thiên Hà Thủy', 'water of the heavenly river'], ['Tho', 'Đại Trạch Thổ', 'earth of the great marsh'], ['Kim', 'Thoa Xuyến Kim', 'metal of hairpins and bracelets'],
  ['Moc', 'Tang Đố Mộc', 'mulberry wood'], ['Thuy', 'Đại Khê Thủy', 'water of the great stream'], ['Tho', 'Sa Trung Thổ', 'earth in the sand'],
  ['Hoa', 'Thiên Thượng Hỏa', 'fire in the sky'], ['Moc', 'Thạch Lựu Mộc', 'pomegranate wood'], ['Thuy', 'Đại Hải Thủy', 'water of the great sea'],
];
const cycleIndex = (can, chi) => mod(6 * can - 5 * chi, 60); // position of a can-chi pair in the 60 cycle (Giáp Tý = 0)
/** Element key ('Kim' | 'Moc' | 'Thuy' | 'Hoa' | 'Tho') of a can-chi pair. */
export const napAm = (can, chi) => NAP_AM[Math.floor(cycleIndex(can, chi) / 2)][0];
/** { element, name, gloss } of a can-chi pair, e.g. Canh Ngọ -> Lộ Bàng Thổ. */
export const napAmInfo = (can, chi) => { const [element, name, gloss] = NAP_AM[Math.floor(cycleIndex(can, chi) / 2)]; return { element, name, gloss }; };
export const yearCan = (lunarYear) => mod(lunarYear + 6, 10);
export const yearChi = (lunarYear) => mod(lunarYear + 8, 12);
/** The twelve two-hour periods: giờ Tý = 23:00–00:59, Sửu = 01:00–02:59, … */
export const hourBranch = (hour) => Math.floor((mod(hour, 24) + 1) / 2) % 12;
export const hourRange = (branch) => { const a = mod(branch * 2 - 1, 24); return `${String(a).padStart(2, '0')}:00–${String(mod(a + 1, 24)).padStart(2, '0')}:59`; };
/** can / chi of a day from its Julian day number. */
export const dayCan = (jd) => mod(jd + 9, 10);
export const dayChi = (jd) => mod(jd + 1, 12);
