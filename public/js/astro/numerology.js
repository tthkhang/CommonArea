// Pythagorean numerology for the Astrology Room — pure functions (checked by tests/astro.test.mjs with the
// spec's worked example: "Nguyễn Minh Anh", born 15/08/1990).
// School choices (the spec's tentative answers): the Life Path adds every digit of the birth date; master numbers
// 11 / 22 / 33 are kept; Y is a vowel only when no other vowel stands next to it ("Vy" yes, "Uyên" no);
// the personal year changes on 1 January.

const digitSum = (n) => String(Math.abs(n)).split('').reduce((a, c) => a + Number(c), 0);
const MASTERS = [11, 22, 33];
/** Add the digits until one digit is left; `keep` lists the master numbers that stop the reduction. */
export function reduceNumber(n, keep = MASTERS) { while (n > 9 && !keep.includes(n)) n = digitSum(n); return n; }
/** Every sum on the way down, e.g. 49 -> [49, 13, 4]. */
export function reduceChain(n, keep = MASTERS) { const out = [n]; while (n > 9 && !keep.includes(n)) { n = digitSum(n); out.push(n); } return out; }
const num = (sum, keep = MASTERS) => { const value = reduceNumber(sum, keep); return { sum, value, base: reduceNumber(value, []), chain: reduceChain(sum, keep) }; };

/** Lower-case letters a–z without diacritics (đ -> d, ø -> o …). */
export const plain = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').replace(/[øØ]/g, 'o').replace(/[łŁ]/g, 'l').replace(/[æÆ]/g, 'ae').replace(/ß/g, 'ss').toLowerCase();
export const letterValue = (ch) => ((ch.charCodeAt(0) - 97) % 9) + 1; // a = 1 … i = 9, j = 1 …
const VOWELS = 'aeiou';
/** The letters of a name: [{ ch, v, vowel, word, first }] */
export function nameLetters(name) {
  const out = [];
  plain(name).split(/[^a-z]+/).filter(Boolean).forEach((w, wi) => {
    for (let i = 0; i < w.length; i++) {
      const ch = w[i];
      const vowel = VOWELS.includes(ch) || (ch === 'y' && !VOWELS.includes(w[i - 1] || '-') && !VOWELS.includes(w[i + 1] || '-'));
      out.push({ ch, v: letterValue(ch), vowel, word: wi, first: i === 0 });
    }
  });
  return out;
}

export const GRID_ROWS = [[3, 6, 9], [2, 5, 8], [1, 4, 7]]; // how the 3 x 3 chart is drawn, top row first
export const ARROWS = ['123', '456', '789', '147', '258', '369', '159', '357'];
const gridOf = (values) => { const g = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]; for (const v of values) if (v >= 1 && v <= 9) g[v]++; return g; };

/**
 * Every number of the reading.
 * birth: { name, d, m, y }   today: { d, m, y } (defaults to the browser's date)
 */
export function numerology({ name, d, m, y }, today) {
  const t = today || (() => { const n = new Date(); return { d: n.getDate(), m: n.getMonth() + 1, y: n.getFullYear() }; })();
  const letters = nameLetters(name);
  const sumOf = (list) => list.reduce((a, l) => a + l.v, 0);
  const dateDigits = `${d}${m}${y}`.split('').map(Number);

  // ---- from the birth date
  const lifePath = num(dateDigits.reduce((a, b) => a + b, 0));
  lifePath.label = lifePath.value > 9 ? `${lifePath.value}/${lifePath.base}` : String(lifePath.value);
  const birthday = num(d, [11, 22]);
  const attitude = num(digitSum(d) + digitSum(m), []);

  // ---- from the name (null when no name was given)
  const has = letters.length > 0;
  const vowels = letters.filter((l) => l.vowel); const consonants = letters.filter((l) => !l.vowel);
  const soul = has && vowels.length ? num(sumOf(vowels)) : null;
  const personality = has && consonants.length ? num(sumOf(consonants)) : null;
  const expression = has ? num(sumOf(letters)) : null;
  const maturity = has ? num(lifePath.base + expression.base, [11]) : null;
  const balance = has ? num(sumOf(letters.filter((l) => l.first)), []) : null;
  const nameGrid = gridOf(letters.map((l) => l.v));
  let hiddenPassion = null; let karmicLessons = []; let subconscious = null;
  if (has) {
    const top = Math.max(...nameGrid.slice(1));
    hiddenPassion = { values: [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((n) => nameGrid[n] === top), count: top };
    karmicLessons = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((n) => nameGrid[n] === 0);
    subconscious = 9 - karmicLessons.length;
  }
  // karmic debts: a 13, 14, 16 or 19 on the way down to the Life Path, Expression, Soul or Personality number, or as the birth day itself
  const karmicDebts = [];
  const debtIn = (n, label) => { if (!n) return; for (const s of n.chain) if ([13, 14, 16, 19].includes(s) && !karmicDebts.some((k) => k.n === s)) karmicDebts.push({ n: s, from: label }); };
  debtIn(lifePath, 'Life Path'); debtIn(expression, 'Expression'); debtIn(soul, 'Soul'); debtIn(personality, 'Personality');
  if ([13, 14, 16, 19].includes(d) && !karmicDebts.some((k) => k.n === d)) karmicDebts.push({ n: d, from: 'Birthday' });
  karmicDebts.sort((a, b) => a.n - b.n);

  // ---- charts and arrows
  const birthGrid = gridOf(dateDigits);
  const fullGrid = birthGrid.map((v, i) => v + nameGrid[i]);
  const arrows = { full: ARROWS.filter((a) => a.split('').every((c) => birthGrid[+c] > 0)), empty: ARROWS.filter((a) => a.split('').every((c) => birthGrid[+c] === 0)) };

  // ---- pinnacles, challenges, life cycles
  const mR = reduceNumber(m, []); const dR = reduceNumber(d, []); const yR = reduceNumber(digitSum(y), []);
  const age = t.y - y - (t.m < m || (t.m === m && t.d < d) ? 1 : 0);
  const end1 = 36 - lifePath.base;
  const spans = [[0, end1], [end1 + 1, end1 + 9], [end1 + 10, end1 + 18], [end1 + 19, null]];
  const p1 = num(mR + dR, [11, 22]); const p2 = num(dR + yR, [11, 22]);
  const pinn = [p1, p2, num(p1.base + p2.base, [11, 22]), num(mR + yR, [11, 22])];
  const c1 = Math.abs(mR - dR); const c2 = Math.abs(dR - yR);
  const chal = [c1, c2, Math.abs(c1 - c2), Math.abs(mR - yR)];
  const inSpan = ([a, b]) => age >= a && (b == null || age <= b);
  const pinnacles = spans.map(([from, to], i) => ({ n: pinn[i].value, challenge: chal[i], from, to, current: inSpan([from, to]) }));
  const cspans = [[0, end1], [end1 + 1, end1 + 18], [end1 + 19, null]];
  const cnums = [reduceNumber(m, [11]), reduceNumber(d, [11, 22]), reduceNumber(digitSum(y), [11, 22])];
  const cycles = cspans.map(([from, to], i) => ({ n: cnums[i], from, to, of: ['month', 'day', 'year'][i], current: inSpan([from, to]) }));

  // ---- this year, this month, today
  const personalYear = reduceNumber(digitSum(d) + digitSum(m) + digitSum(t.y), []);
  const personalMonths = Array.from({ length: 12 }, (_, i) => reduceNumber(personalYear + digitSum(i + 1), []));
  const personalMonth = personalMonths[t.m - 1];
  const personalDay = reduceNumber(personalMonth + digitSum(t.d), []);

  return { letters, lifePath, birthday, attitude, soul, personality, expression, maturity, balance, hiddenPassion, karmicLessons, subconscious, karmicDebts,
    birthGrid, nameGrid, fullGrid, arrows, age, pinnacles, challenges: chal, cycles, personalYear, personalMonths, personalMonth, personalDay, today: t };
}
