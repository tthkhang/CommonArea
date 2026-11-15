// Shared helpers for the reading-text checks (tests/text/all.check.mjs). Works under Node and under macOS jsc.
export const log = typeof print === 'function' ? print : console.log;
export const words = (s) => String(s).trim().split(/\s+/).filter(Boolean).length;
export const N9 = [1, 2, 3, 4, 5, 6, 7, 8, 9];
export const N12 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 22, 33];
export const SIGNS = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
export const PLANETS = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];
export const MAIN_STARS = ['Tử Vi', 'Thiên Cơ', 'Thái Dương', 'Vũ Khúc', 'Thiên Đồng', 'Liêm Trinh', 'Thiên Phủ', 'Thái Âm', 'Tham Lang', 'Cự Môn', 'Thiên Tướng', 'Thiên Lương', 'Thất Sát', 'Phá Quân'];
export const PALACES = ['Mệnh', 'Phụ Mẫu', 'Phúc Đức', 'Điền Trạch', 'Quan Lộc', 'Nô Bộc', 'Thiên Di', 'Tật Ách', 'Tài Bạch', 'Tử Tức', 'Phu Thê', 'Huynh Đệ'];
export const MINOR_STARS = ['Tả Phù', 'Hữu Bật', 'Văn Xương', 'Văn Khúc', 'Thiên Khôi', 'Thiên Việt', 'Kình Dương', 'Đà La', 'Địa Không', 'Địa Kiếp', 'Hỏa Tinh', 'Linh Tinh',
  'Lộc Tồn', 'Thiên Mã', 'Hóa Lộc', 'Hóa Quyền', 'Hóa Khoa', 'Hóa Kỵ', 'Đào Hoa', 'Hồng Loan', 'Thiên Hỷ', 'Tuần', 'Triệt',
  'Tràng Sinh', 'Mộc Dục', 'Quan Đới', 'Lâm Quan', 'Đế Vượng', 'Suy', 'Bệnh', 'Tử', 'Mộ', 'Tuyệt', 'Thai', 'Dưỡng'];
// Words a reading must not use as a prediction (the spec: no verdicts about illness, accidents, death or losing money).
const BANNED = /\b(you will die|will die|fatal|cancer|tumou?r|heart attack|stroke|car crash|bankrupt(cy)?|you will lose (your |all )?money|suicide|miscarriage|as an ai)\b/i;

export function makeChecker(pack) {
  const bad = []; let count = 0; let total = 0;
  const nfc = (k) => String(k).normalize('NFC');
  const c = {
    fail(where, why) { bad.push(`${where}: ${why}`); },
    /** A passage: a string with a word count inside [min, max] (a little slack is allowed). */
    text(where, s, min, max) {
      if (typeof s !== 'string' || !s.trim()) return c.fail(where, 'missing text');
      const n = words(s); count++; total += n;
      if (n < Math.floor(min * 0.92)) c.fail(where, `too short: ${n} words (need ${min}–${max})`);
      if (n > Math.ceil(max * 1.25)) c.fail(where, `too long: ${n} words (need ${min}–${max})`);
      if (/[<>]|\*\*|^#|\n/.test(s)) c.fail(where, 'plain text only: no HTML, markdown or line breaks');
      const t = s.replace(/\bCancer\b/g, 'the Crab'); // the zodiac sign, written with a capital, is not the illness
      if (BANNED.test(t)) c.fail(where, `predicts harm (“${t.match(BANNED)[0]}”): turn it into advice`);
    },
    /** [summary, body]: one bold sentence, then the passage. */
    pair(where, v, min, max, sumMin = 8, sumMax = 28) {
      if (!Array.isArray(v) || v.length !== 2) return c.fail(where, 'must be [summary, body]');
      c.text(where + ' summary', v[0], sumMin, sumMax); c.text(where + ' body', v[1], min, max);
    },
    /** An object with exactly these keys (order free). Returns a getter by key. */
    keys(where, obj, keys) {
      if (!obj || typeof obj !== 'object') { c.fail(where, 'missing'); return () => undefined; }
      const have = new Map(Object.keys(obj).map((k) => [nfc(k), k]));
      for (const k of keys) if (!have.has(nfc(k))) c.fail(where, `missing key “${k}”`);
      for (const k of have.keys()) if (!keys.map(nfc).includes(k)) c.fail(where, `unexpected key “${k}”`);
      return (k) => obj[have.get(nfc(k))];
    },
    list(where, v, nMin, nMax, min, max) {
      if (!Array.isArray(v) || v.length < nMin || v.length > nMax) return c.fail(where, `must be a list of ${nMin}–${nMax} items`);
      v.forEach((s, i) => c.text(`${where}[${i}]`, s, min, max));
    },
    get words() { return total; },
    done() {
      log(`${pack}: ${count} passages, ${total} words`);
      if (bad.length) { for (const b of bad.slice(0, 60)) log('  FAIL ' + b); if (bad.length > 60) log(`  … and ${bad.length - 60} more`); log(`${pack}: ${bad.length} PROBLEMS`); if (typeof process !== 'undefined') process.exitCode = 1; }
      else log(`${pack}: ALL OK`);
      return bad.length === 0;
    },
  };
  return c;
}
