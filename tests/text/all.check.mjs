// Checks every reading-text pack of the Astrology Room (public/js/text/*.js): all keys present, each passage inside its
// length range, plain text only, and no verdicts about illness, accidents, death or losing money (the spec: turn those into advice).
//   node tests/text/all.check.mjs            every pack
//   node tests/text/all.check.mjs west-big3  one pack
// Lengths are in English words. The spec counts Vietnamese "chữ" (syllables); an English word carries about 1.4 of them,
// so a spec minimum of N chữ is checked here as 0.7 x N words.
import { makeChecker, log, N9, N12, SIGNS, PLANETS, MAIN_STARS, PALACES, MINOR_STARS } from './check.mjs';

const H12 = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
const ARROWS = ['123', '456', '789', '147', '258', '369', '159', '357'];
const PACKS = {
  'num-lifepath': (T, c) => {
    const get = c.keys('LIFE_PATH', T.LIFE_PATH, N12.map(String));
    for (const n of N12) {
      const w = `LIFE_PATH[${n}]`; const g = c.keys(w, get(String(n)), ['title', 'keywords', 'summary', 'nature', 'strengths', 'cautions', 'love', 'work', 'lesson', 'advice']);
      c.text(w + '.title', g('title'), 2, 5); c.list(w + '.keywords', g('keywords'), 3, 3, 1, 3); c.text(w + '.summary', g('summary'), 10, 26);
      c.text(w + '.nature', g('nature'), 60, 105); c.list(w + '.strengths', g('strengths'), 3, 5, 14, 32); c.list(w + '.cautions', g('cautions'), 3, 4, 14, 32);
      c.text(w + '.love', g('love'), 55, 100); c.text(w + '.work', g('work'), 55, 100); c.text(w + '.lesson', g('lesson'), 45, 85); c.list(w + '.advice', g('advice'), 3, 3, 8, 24);
    }
  },
  'num-core': (T, c) => {
    const each = (name, nums, min, max) => { const get = c.keys(name, T[name], nums.map(String)); for (const n of nums) c.pair(`${name}[${n}]`, get(String(n)), min, max); };
    each('EXPRESSION', N12, 105, 150); each('SOUL', N12, 84, 125); each('PERSONALITY', N12, 70, 110);
    each('BIRTHDAY', [...N9, 11, 22], 56, 90); each('ATTITUDE', N9, 56, 90); each('MATURITY', [...N9, 11], 70, 110);
  },
  'num-cycles': (T, c) => {
    const pairs = (name, nums, min, max) => { const get = c.keys(name, T[name], nums.map(String)); for (const n of nums) c.pair(`${name}[${n}]`, get(String(n)), min, max); };
    const texts = (name, nums, min, max) => { const get = c.keys(name, T[name], nums.map(String)); for (const n of nums) c.text(`${name}[${n}]`, get(String(n)), min, max); };
    pairs('BALANCE', N9, 56, 90); pairs('HIDDEN_PASSION', N9, 56, 90); pairs('KARMIC_LESSON', N9, 42, 75); pairs('KARMIC_DEBT', [13, 14, 16, 19], 84, 125); pairs('SUBCONSCIOUS', N9, 42, 75);
    const cell = c.keys('CELL', T.CELL, N9.map(String)); for (const n of N9) c.list(`CELL[${n}]`, cell(String(n)), 5, 5, 11, 30);
    for (const name of ['ARROW_FULL', 'ARROW_EMPTY']) {
      const get = c.keys(name, T[name], ARROWS);
      for (const a of ARROWS) { const v = get(a); if (!Array.isArray(v) || v.length !== 3) { c.fail(`${name}[${a}]`, 'must be [name, summary, body]'); continue; } c.text(`${name}[${a}] name`, v[0], 1, 5); c.text(`${name}[${a}] summary`, v[1], 8, 24); c.text(`${name}[${a}] body`, v[2], 56, 90); }
    }
    texts('PINNACLE', [...N9, 11, 22], 35, 65); texts('CHALLENGE', [0, 1, 2, 3, 4, 5, 6, 7, 8], 35, 65); texts('CYCLE', [...N9, 11, 22], 35, 65);
    pairs('PERSONAL_YEAR', N9, 105, 150); texts('PERSONAL_MONTH', N9, 14, 36); texts('PERSONAL_DAY', N9, 8, 20);
    const es = c.keys('ESSENCE', T.ESSENCE, N12.map(String)); for (const n of N12) c.text(`ESSENCE[${n}]`, es(String(n)), 5, 16);
    const gr = c.keys('GROUP_PAIR', T.GROUP_PAIR, ['mind-mind', 'work-work', 'heart-heart', 'mind-work', 'mind-heart', 'work-heart']); for (const k of ['mind-mind', 'work-work', 'heart-heart', 'mind-work', 'mind-heart', 'work-heart']) c.text(`GROUP_PAIR[${k}]`, gr(k), 28, 50);
  },
  'tuvi-stars': (T, c) => {
    const get = c.keys('MAIN_STAR', T.MAIN_STAR, MAIN_STARS);
    for (const s of MAIN_STARS) {
      const w = `MAIN_STAR[${s}]`; const g = c.keys(w, get(s), ['en', 'keywords', 'menh', 'bright', 'dim', 'palaces']);
      c.text(w + '.en', g('en'), 1, 5); c.list(w + '.keywords', g('keywords'), 3, 3, 1, 3); c.pair(w + '.menh', g('menh'), 77, 115);
      c.text(w + '.bright', g('bright'), 10, 24); c.text(w + '.dim', g('dim'), 10, 24);
      const p = c.keys(w + '.palaces', g('palaces'), PALACES.slice(1)); for (const k of PALACES.slice(1)) c.text(`${w}.palaces[${k}]`, p(k), 21, 38);
    }
  },
  'tuvi-extra': (T, c) => {
    const ms = c.keys('MINOR_STAR', T.MINOR_STAR, MINOR_STARS);
    for (const s of MINOR_STARS) { const ring = MINOR_STARS.indexOf(s) >= 23; const g = c.keys(`MINOR_STAR[${s}]`, ms(s), ['en', 'text']); c.text(`MINOR_STAR[${s}].en`, g('en'), 1, 5); c.text(`MINOR_STAR[${s}].text`, g('text'), ring ? 10 : 17, ring ? 22 : 32); }
    const pl = c.keys('PALACE', T.PALACE, PALACES);
    for (const k of PALACES) { const w = `PALACE[${k}]`; const g = c.keys(w, pl(k), ['en', 'about', 'empty', 'decade', 'year']); c.text(w + '.en', g('en'), 1, 4); c.text(w + '.about', g('about'), 10, 24); c.text(w + '.empty', g('empty'), 30, 52); c.pair(w + '.decade', g('decade'), 70, 105); c.pair(w + '.year', g('year'), 63, 98); }
    const TH = ['Mệnh', 'Phúc Đức', 'Quan Lộc', 'Thiên Di', 'Tài Bạch', 'Phu Thê']; const th = c.keys('THAN_AT', T.THAN_AT, TH); for (const k of TH) c.text(`THAN_AT[${k}]`, th(k), 35, 60);
    const MC = ['cucFeedsMenh', 'menhFeedsCuc', 'same', 'menhControlsCuc', 'cucControlsMenh']; const mc = c.keys('MENH_CUC', T.MENH_CUC, MC); for (const k of MC) c.text(`MENH_CUC.${k}`, mc(k), 28, 50);
    const EL = ['Kim', 'Moc', 'Thuy', 'Hoa', 'Tho']; const el = c.keys('ELEMENT', T.ELEMENT, EL); for (const k of EL) c.pair(`ELEMENT.${k}`, el(k), 38, 63);
    const HN = ['Hóa Lộc', 'Hóa Quyền', 'Hóa Khoa', 'Hóa Kỵ']; const hn = c.keys('HOA_NOW', T.HOA_NOW, HN); for (const k of HN) c.text(`HOA_NOW[${k}]`, hn(k), 17, 32);
  },
  'west-big3': (T, c) => { for (const name of ['SUN_IN', 'MOON_IN', 'RISING_IN']) { const get = c.keys(name, T[name], SIGNS); for (const s of SIGNS) c.pair(`${name}.${s}`, get(s), 140, 190); } },
  'west-signs': (T, c) => {
    const bodies = ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto', 'Node'];
    const get = c.keys('PLANET_IN_SIGN', T.PLANET_IN_SIGN, bodies);
    for (const b of bodies) { const slow = ['Uranus', 'Neptune', 'Pluto'].includes(b); const g = c.keys(`PLANET_IN_SIGN.${b}`, get(b), SIGNS); for (const s of SIGNS) c.text(`PLANET_IN_SIGN.${b}.${s}`, g(s), slow ? 21 : b === 'Node' ? 28 : 32, slow ? 36 : b === 'Node' ? 44 : 50); }
  },
  'west-houses': (T, c) => {
    const ph = c.keys('PLANET_IN_HOUSE', T.PLANET_IN_HOUSE, PLANETS);
    for (const p of PLANETS) { const g = c.keys(`PLANET_IN_HOUSE.${p}`, ph(p), H12); for (const h of H12) c.text(`PLANET_IN_HOUSE.${p}[${h}]`, g(h), 28, 44); }
    const pairs = []; for (let i = 0; i < PLANETS.length; i++) for (let j = i + 1; j < PLANETS.length; j++) pairs.push(`${PLANETS[i]}-${PLANETS[j]}`);
    const ap = c.keys('ASPECT_PAIR', T.ASPECT_PAIR, pairs); for (const k of pairs) c.text(`ASPECT_PAIR[${k}]`, ap(k), 14, 27);
    const AT = ['conjunction', 'sextile', 'square', 'trine', 'opposition']; const at = c.keys('ASPECT_TYPE', T.ASPECT_TYPE, AT);
    for (const k of AT) { const v = at(k); if (!Array.isArray(v) || v.length !== 2) { c.fail(`ASPECT_TYPE.${k}`, 'must be [name, text]'); continue; } c.text(`ASPECT_TYPE.${k} name`, v[0], 1, 3); c.text(`ASPECT_TYPE.${k} text`, v[1], 17, 34); }
    const el = c.keys('ELEMENT_TEXT', T.ELEMENT_TEXT, ['Fire', 'Earth', 'Air', 'Water']); for (const k of ['Fire', 'Earth', 'Air', 'Water']) { const g = c.keys(`ELEMENT_TEXT.${k}`, el(k), ['high', 'low']); c.text(`ELEMENT_TEXT.${k}.high`, g('high'), 24, 41); c.text(`ELEMENT_TEXT.${k}.low`, g('low'), 24, 41); }
    const mo = c.keys('MODALITY_TEXT', T.MODALITY_TEXT, ['Cardinal', 'Fixed', 'Mutable']); for (const k of ['Cardinal', 'Fixed', 'Mutable']) { const g = c.keys(`MODALITY_TEXT.${k}`, mo(k), ['high', 'low']); c.text(`MODALITY_TEXT.${k}.high`, g('high'), 24, 41); c.text(`MODALITY_TEXT.${k}.low`, g('low'), 24, 41); }
    const hm = c.keys('HOUSE_MEANING', T.HOUSE_MEANING, H12); for (const h of H12) c.text(`HOUSE_MEANING[${h}]`, hm(h), 1, 8);
  },
};

const only = (typeof process !== 'undefined' ? process.argv.slice(2) : typeof scriptArgs !== 'undefined' ? scriptArgs : []).filter((a) => PACKS[a]);
let allOk = true; let missing = 0;
for (const name of Object.keys(PACKS)) {
  if (only.length && !only.includes(name)) continue;
  let T;
  try { T = await import(`../../public/js/text/${name}.js`); } catch (e) { log(`${name}: NOT WRITTEN YET (${String(e.message).split('\n')[0].slice(0, 90)})`); missing++; allOk = false; continue; }
  const c = makeChecker(name); PACKS[name](T, c); if (!c.done()) allOk = false;
}
log(allOk ? '\nALL READING TEXTS OK' : `\nSOME PACKS NEED WORK${missing ? ` (${missing} not written yet)` : ''}`);
if (!allOk && typeof process !== 'undefined') process.exitCode = 1;
