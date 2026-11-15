// Checks for the Astrology Room calculations (public/js/astro/*.js). Run:  node tests/astro.test.mjs
// The worked example is the spec's own: "Nguyễn Minh Anh", female, born 15/08/1990 at 14:30 in Hà Nội.
import * as A from '../public/js/astro.js';
const log = typeof print === 'function' ? print : console.log;
let failed = 0, passed = 0;
const ok = (c, msg) => { if (c) { passed++; log('ok   ' + msg); } else { failed++; log('FAIL ' + msg); } };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const L = (d, m, y) => { const r = A.solarToLunar(d, m, y); return [r.day, r.month, r.year, r.leap]; };
const TODAY = { d: 15, m: 11, y: 2026 };
const near = (a, b, tol) => Math.abs(A.mod(a - b + 180, 360) - 180) <= tol;

// ---------------------------------------------------------------- lunar calendar
ok(same(L(10, 2, 2024), [1, 1, 2024, false]), 'Tết Giáp Thìn = 10 Feb 2024');
ok(same(L(22, 1, 2023), [1, 1, 2023, false]), 'Tết Quý Mão = 22 Jan 2023');
ok(same(L(29, 1, 2025), [1, 1, 2025, false]), 'Tết Ất Tỵ = 29 Jan 2025');
ok(same(L(25, 1, 2020), [1, 1, 2020, false]), 'Tết Canh Tý = 25 Jan 2020');
ok(same(L(5, 2, 2000), [1, 1, 2000, false]), 'Tết Canh Thìn = 5 Feb 2000');
ok(same(L(22, 3, 2023), [1, 2, 2023, true]), 'leap 2nd month of 2023 starts 22 Mar 2023');
ok(same(L(23, 5, 2020), [1, 4, 2020, true]), 'leap 4th month of 2020 starts 23 May 2020');
ok(same(L(9, 2, 2024), [30, 12, 2023, false]), 'the day before Tết 2024 is 30/12 Quý Mão');
ok(same(L(15, 8, 1990), [25, 6, 1990, false]), 'spec example: 15 Aug 1990 = 25/6 Canh Ngọ');
ok(A.lunarLeapMonth(1990) === 5 && A.lunarLeapMonth(2023) === 2 && A.lunarLeapMonth(2020) === 4 && A.lunarLeapMonth(2025) === 6 && A.lunarLeapMonth(2033) === 11 && A.lunarLeapMonth(2024) === 0, 'leap months: 1990 -> 5, 2023 -> 2, 2020 -> 4, 2025 -> 6, 2033 -> 11, 2024 none');
ok(same(A.lunarToSolar(25, 6, 1990, false), { d: 15, m: 8, y: 1990 }) && same(A.lunarToSolar(1, 2, 2023, true), { d: 22, m: 3, y: 2023 }) && same(A.lunarToSolar(1, 1, 2024), { d: 10, m: 2, y: 2024 }), 'lunar -> solar (plain and leap months)');
ok(A.lunarToSolar(1, 6, 1990, true) === null && A.lunarToSolar(1, 3, 2024, true) === null, 'a leap flag on a month that is not doubled is refused');
{ let round = true; let short = 0;
  for (let jd = A.jdFromDate(1, 1, 1950); jd < A.jdFromDate(1, 1, 2050); jd += 13) { const s = A.dateFromJd(jd); const l = A.solarToLunar(s.d, s.m, s.y); const b = A.lunarToSolar(l.day, l.month, l.year, l.leap); if (!b || b.d !== s.d || b.m !== s.m || b.y !== s.y) round = false; }
  for (let m = 1; m <= 12; m++) { const len = A.lunarMonthLength(m, 2024); if (len === 29) { short++; if (A.lunarToSolar(30, m, 2024) !== null) round = false; } else if (len !== 30) round = false; }
  ok(round && short >= 5, 'solar -> lunar -> solar round trip (1950–2050); day 30 of a 29-day month is refused'); }
ok(A.weekday(15, 8, 1990) === 3 && A.weekday(1, 1, 2000) === 6 && A.daysInMonth(2, 2023) === 28 && A.daysInMonth(2, 2024) === 29 && A.daysInMonth(2, 1900) === 28, '15 Aug 1990 was a Wednesday; February lengths');

// ---------------------------------------------------------------- can chi
const t0 = A.tuVi({ d: 1, m: 1, y: 2000, hour: 12, gender: 'M' }, TODAY);
ok(t0.dayCanChi === 'Mậu Ngọ', '1 Jan 2000 is a Mậu Ngọ day (' + t0.dayCanChi + ')');
ok(t0.year === 'Kỷ Mão' && t0.animal === 'Cat', '1 Jan 2000 is still the lunar year Kỷ Mão (' + t0.year + ')');
const t1 = A.tuVi({ d: 10, m: 2, y: 2024, hour: 0, gender: 'M' }, TODAY);
ok(t1.year === 'Giáp Thìn' && t1.animal === 'Dragon' && t1.menhElement === 'Hoa' && t1.napAmName === 'Phú Đăng Hỏa' && t1.monthCanChi === 'Bính Dần', '2024 = Giáp Thìn, Dragon, Phú Đăng Hỏa, first month Bính Dần');
ok(A.napAm(0, 0) === 'Kim' && A.napAm(2, 2) === 'Hoa' && A.napAm(8, 10) === 'Thuy' && A.napAm(6, 6) === 'Tho' && A.napAmInfo(6, 6).name === 'Lộ Bàng Thổ', 'nạp âm table: Giáp Tý Kim, Bính Dần Hỏa, Nhâm Tuất Thủy, Canh Ngọ Lộ Bàng Thổ');
ok(A.hourBranch(23) === 0 && A.hourBranch(0) === 0 && A.hourBranch(1) === 1 && A.hourBranch(12) === 6 && A.hourBranch(22) === 11 && A.hourRange(7) === '13:00–14:59', 'hour branches: Tý is 23:00–00:59, Mùi is 13:00–14:59');

// ---------------------------------------------------------------- Tử Vi: palace layout and star placement rules
ok(t1.menh === 2 && t1.than === 2, 'month 1, hour Tý: Mệnh and Thân both at Dần');
const t2 = A.tuVi({ d: 10, m: 2, y: 2024, hour: 5, gender: 'F' }, TODAY); // hour Mão (3)
ok(t2.menh === 11 && t2.than === 5, 'month 1, hour Mão: Mệnh at Hợi, Thân at Tỵ');
const pal = (t, name) => t.palaces.find((p) => p.name === name).pos;
ok(pal(t2, 'Thiên Di') === (t2.menh + 6) % 12 && pal(t2, 'Quan Lộc') === (t2.menh + 4) % 12 && pal(t2, 'Tài Bạch') === (t2.menh + 8) % 12 && pal(t2, 'Phụ Mẫu') === (t2.menh + 1) % 12, 'Thiên Di opposite Mệnh; Quan Lộc and Tài Bạch in trine; Phụ Mẫu next');
let placedOnce = true, rules = true, tuviRule = true, thanOk = true, decadesOk = true, ringOk = true;
const expectTuVi = { 2: [1, 2, 2, 3, 3, 4], 3: [4, 1, 2, 5, 2, 3], 4: [11, 4, 1, 2, 0, 5], 5: [6, 11, 4, 1, 2, 7], 6: [9, 6, 11, 4, 1, 2] }; // day 1..6 for each cục (classical table)
for (let y = 1960; y <= 2030; y += 7) for (let m = 1; m <= 12; m += 2) for (const d of [3, 14, 27]) for (const hour of [1, 9, 17, 22]) for (const gender of ['M', 'F']) {
  const t = A.tuVi({ d, m, y, hour, gender }, TODAY);
  const all = t.palaces.flatMap((p) => p.main.map((s) => s.name));
  if (all.length !== 14 || new Set(all).size !== 14) placedOnce = false;
  const v = t.at['Tử Vi'], f = t.at['Thiên Phủ']; const at = (s, base, off) => t.at[s] === A.mod(base + off, 12);
  if (!(f === A.mod(4 - v, 12) && at('Thiên Cơ', v, -1) && at('Thái Dương', v, -3) && at('Vũ Khúc', v, -4) && at('Thiên Đồng', v, -5) && at('Liêm Trinh', v, -8)
    && at('Thái Âm', f, 1) && at('Tham Lang', f, 2) && at('Cự Môn', f, 3) && at('Thiên Tướng', f, 4) && at('Thiên Lương', f, 5) && at('Thất Sát', f, 6) && at('Phá Quân', f, 10))) rules = false;
  if (t.lunar.day <= 6 && expectTuVi[t.cuc][t.lunar.day - 1] !== v) tuviRule = false;
  if (!['Mệnh', 'Phúc Đức', 'Quan Lộc', 'Thiên Di', 'Tài Bạch', 'Phu Thê'].includes(t.thanPalace)) thanOk = false;
  const ds = t.decades; if (ds[0].name !== 'Mệnh' || ds[0].from !== t.cuc || ds[1].name !== (t.forward ? 'Phụ Mẫu' : 'Huynh Đệ') || ds.some((x, i) => i && x.from !== ds[i - 1].from + 10)) decadesOk = false;
  if (new Set(t.palaces.map((p) => p.ring)).size !== 12 || t.palaces.filter((p) => p.tuan).length !== 2 || t.palaces.filter((p) => p.triet).length !== 2) ringOk = false;
}
ok(placedOnce, 'each of the 14 main stars sits in exactly one palace (many dates)');
ok(rules, 'Tử Vi group runs backwards, Thiên Phủ group forwards, Phủ mirrors Tử Vi across Dần–Thân');
ok(tuviRule, 'Tử Vi position matches the classical table for days 1–6 of every cục');
ok(thanOk, 'Thân always falls in Mệnh, Phúc Đức, Quan Lộc, Thiên Di, Tài Bạch or Phu Thê');
ok(decadesOk, 'decades start in Mệnh at the cục number and move 10 years per palace, forward or backward');
ok(ringOk, 'the Tràng Sinh ring fills all 12 palaces; Tuần and Triệt each mark 2');

// ---- the spec's example chart
const tv = A.tuVi({ d: 15, m: 8, y: 1990, hour: 14, minute: 30, gender: 'F', tz: 7 }, TODAY);
ok(tv.year === 'Canh Ngọ' && tv.hourName === 'Mùi' && tv.polarity === 'Dương nữ' && tv.forward === false, 'example: Canh Ngọ, giờ Mùi, Dương nữ, decades run backward');
ok(tv.napAmName === 'Lộ Bàng Thổ' && tv.lunar.day === 25 && tv.lunar.month === 6 && !tv.lunar.leap, 'example: Mệnh Lộ Bàng Thổ, lunar 25/6');
ok(A.CHI[tv.menh] === 'Tý' && A.CHI[tv.than] === 'Dần' && tv.thanPalace === 'Phúc Đức' && tv.cuc === 6 && tv.relation === 'cucFeedsMenh', 'example: Mệnh at Tý (Mậu Tý -> Hỏa lục cục), Thân in Phúc Đức, Fire cục feeds an Earth Mệnh');
const stars = (pos) => tv.palaces[pos].main.map((s) => s.name).join('+');
ok(stars(1) === 'Tử Vi+Phá Quân' && stars(0) === 'Thiên Cơ' && stars(9) === 'Vũ Khúc+Thất Sát' && stars(8) === 'Thiên Đồng+Thiên Lương' && stars(5) === 'Liêm Trinh+Tham Lang' && stars(2) === '', 'example: Tử Vi + Phá Quân at Sửu, Vũ Khúc + Thất Sát at Dậu, Đồng + Lương at Thân, Liêm + Tham at Tỵ, Dần empty');
ok(tv.at['Lộc Tồn'] === 8 && tv.at['Kình Dương'] === 9 && tv.at['Đà La'] === 7 && tv.at['Văn Xương'] === 3 && tv.at['Văn Khúc'] === 11 && tv.at['Tả Phù'] === 9 && tv.at['Hữu Bật'] === 5, 'example: Lộc Tồn at Thân (Canh), Xương / Khúc by the hour, Tả / Hữu by the month');
ok(tv.at['Thiên Khôi'] === 6 && tv.at['Thiên Việt'] === 2 && tv.at['Địa Kiếp'] === 6 && tv.at['Địa Không'] === 4 && tv.at['Thiên Mã'] === 8 && tv.at['Đào Hoa'] === 3 && tv.at['Hồng Loan'] === 9 && tv.at['Thiên Hỷ'] === 3, 'example: Khôi / Việt, Không / Kiếp, Thiên Mã, Đào Hoa, Hồng Loan, Thiên Hỷ');
ok(same(tv.hoa.map((h) => h.star), ['Thái Dương', 'Vũ Khúc', 'Thái Âm', 'Thiên Đồng']) && same(tv.tuan, [10, 11]) && same(tv.triet, [6, 7]) && tv.palaces[2].ring === 'Tràng Sinh' && tv.palaces[0].ring === 'Quan Đới', 'example: four Hóa of a Canh year, Tuần at Tuất–Hợi, Triệt at Ngọ–Mùi, Tràng Sinh at Dần going backward');
ok(tv.palaces[0].main[0].bright === 'D' && tv.palaces[10].main[0].bright === 'H' && tv.palaces[8].main[0].bright === 'M', 'example: brightness — Thiên Cơ at Tý is đắc, Thái Dương at Tuất is hãm, Thiên Đồng at Thân is miếu');
ok(tv.currentDecade.name === 'Tử Tức' && tv.currentDecade.from === 36 && tv.ageVN === 37 && tv.yearNow.canChi === 'Bính Ngọ' && tv.yearNow.palace === 'Quan Lộc' && tv.yearNow.hoa[0].star === 'Thiên Đồng', 'example in 2026: decade 36–45 in Tử Tức, year Bính Ngọ, small luck in Quan Lộc');
const late = A.tuVi({ d: 15, m: 8, y: 1990, hour: 23, minute: 30, gender: 'F' }, TODAY);
ok(late.hourName === 'Tý' && late.lunar.day === 26 && late.notes.includes('lateTy'), 'a birth at 23:30 is the Tý hour of the next day');
const abroad = A.tuVi({ d: 15, m: 8, y: 1990, hour: 20, minute: 0, gender: 'F', tz: -7 }, TODAY); // 20:00 in Los Angeles (summer time) = 10:00 next day in Vietnam
ok(abroad.lunar.day === 26 && abroad.hourName === 'Tỵ' && abroad.notes.includes('vietnamTime'), 'a birth abroad is converted to Vietnam time first');
ok(A.tuVi({ d: 15, m: 8, y: 1990, gender: 'M', unknownTime: true }, TODAY).hourName === 'Tý', 'unknown birth time: the chart uses the Tý hour');
ok(A.elementRelation('Tho', 'Hoa') === 'cucFeedsMenh' && A.elementRelation('Hoa', 'Tho') === 'menhFeedsCuc' && A.elementRelation('Kim', 'Kim') === 'same' && A.elementRelation('Thuy', 'Hoa') === 'menhControlsCuc' && A.elementRelation('Hoa', 'Thuy') === 'cucControlsMenh', 'the five ways Mệnh and Cục get on');

// ---------------------------------------------------------------- star chart
const J = A.longitudes(2451545.0); // 1 Jan 2000, 12:00 — published values
const want = { Sun: 280.37, Moon: 223.32, Mercury: 271.89, Venus: 241.57, Mars: 327.96, Jupiter: 25.25, Saturn: 40.40, Uranus: 314.81, Neptune: 303.19, Pluto: 251.45, Node: 125.04 };
for (const k of Object.keys(want)) ok(near(J[k], want[k], 0.3), `${k} at J2000: ${J[k].toFixed(2)}° (published ${want[k]}°, within 0.3°)`);
ok(near(A.moonLongitude(2448724.5), 133.1627, 0.01), 'Moon on 12 Apr 1992 matches the textbook example (133.16°)');
{ let worst = 0; for (let k = 600; k < 1700; k += 9) { const jd = A.newMoon(k); worst = Math.max(worst, Math.abs(A.mod(A.moonLongitude(jd) - A.sunLongitudeRad(jd) * 180 / Math.PI + 180, 360) - 180)); }
  ok(worst < 0.1, `at every new moon 1948–2037 the Moon meets the Sun (worst gap ${worst.toFixed(3)}°)`); }
const g = A.houses(2451545.0, 51.48, 0);
ok(near(g.asc, 24.3, 0.3) && near(g.mc, 279.6, 0.3) && g.system === 'Placidus', `Greenwich at J2000: ascendant ${g.asc.toFixed(1)}° (24° Aries), midheaven ${g.mc.toFixed(1)}° (9½° Capricorn)`);
{ let order = true; let opp = true;
  for (const [lat, lon, jd] of [[21.03, 105.85, 2448118.8], [51.5, 0, 2451545], [-33.9, 151.2, 2455000.3], [60.2, 24.9, 2440000.9], [10.8, 106.7, 2458000.1], [-41.3, 174.8, 2449000.6]]) {
    const h = A.houses(jd, lat, lon); let sum = 0;
    for (let i = 0; i < 12; i++) { const span = A.mod(h.cusps[(i + 1) % 12] - h.cusps[i], 360); if (span <= 0 || span >= 120) order = false; sum += span; if (!near(h.cusps[(i + 6) % 12], h.cusps[i] + 180, 1e-6)) opp = false; }
    if (Math.abs(sum - 360) > 1e-6 || !near(h.cusps[0], h.asc, 1e-9) || !near(h.cusps[9], h.mc, 1e-9)) order = false;
    for (let lam = 0; lam < 360; lam += 7) { const k = A.houseOf(lam, h.cusps); if (!(k >= 1 && k <= 12) || A.mod(lam - h.cusps[k - 1], 360) >= A.mod(h.cusps[k % 12] - h.cusps[k - 1], 360)) order = false; }
  }
  ok(order && opp, 'Placidus cusps run in order around the circle, opposite cusps face each other, every degree has one house'); }
{ const e = A.houses(2451545.0, 0, 0); const ra = (lam) => A.mod(Math.atan2(Math.sin(lam * Math.PI / 180) * Math.cos(23.4393 * Math.PI / 180), Math.cos(lam * Math.PI / 180)) * 180 / Math.PI, 360);
  ok([10, 11, 0, 1, 2].every((i, n) => near(ra(e.cusps[i]) - ra(e.cusps[9]), 30 * (n + 1), 0.01)), 'on the equator the Placidus cusps are 30° of right ascension apart'); }
ok(A.houses(2451545.0, 69.65, 18.96).system === 'Equal', 'above 66° of latitude the chart uses Equal houses');
const ch = A.starChart({ d: 15, m: 8, y: 1990, hour: 14, minute: 30, tz: 7, lat: 21.03, lon: 105.85 });
ok(A.SIGNS[ch.sun.sign] === 'Leo' && ch.sun.deg === 22 && A.SIGNS[ch.moon.sign] === 'Gemini' && A.SIGNS[ch.ascSign] === 'Sagittarius', 'example: Sun at 22° Leo, Moon in Gemini, Sagittarius rising');
ok(ch.bodies.length === 10 && ch.bodies.every((b) => b.house >= 1 && b.house <= 12) && ch.bodies.find((b) => b.name === 'Saturn').retro && !ch.bodies.find((b) => b.name === 'Venus').retro, 'example: ten bodies with houses; Saturn retrograde in August 1990');
ok(ch.aspects.length >= 5 && ch.aspects.every((a, i) => !i || a.strength <= ch.aspects[i - 1].strength) && ch.aspects.some((a) => a.a === 'Sun' && a.b === 'Mars' && a.type === 'square'), 'example: aspects sorted strongest first, with Sun square Mars');
ok(Object.values(ch.elements).reduce((a, b) => a + b) === 10 && Object.values(ch.modalities).reduce((a, b) => a + b) === 10, 'elements and modalities count the ten bodies');
const noTime = A.starChart({ d: 15, m: 8, y: 1990, tz: 7, lat: 21.03, lon: 105.85, unknownTime: true });
ok(noTime.asc === null && noTime.cusps === null && noTime.bodies.every((b) => b.house === null) && A.SIGNS[noTime.sun.sign] === 'Leo', 'unknown birth time: noon chart without ascendant or houses');
const s2 = A.starChart({ d: 21, m: 6, y: 2024, hour: 12, tz: 7, lat: 21, lon: 105.8 });
ok(s2.sun.sign === 3 && s2.sun.deg <= 1, 'the Sun enters Cancer at the June solstice 2024');

// ---------------------------------------------------------------- numerology: the spec's worked example
const n = A.numerology({ name: 'Nguyễn Minh Anh', d: 15, m: 8, y: 1990 }, TODAY);
ok(n.letters.map((l) => l.v).join('') === '5737554958158' && n.letters.filter((l) => l.vowel).map((l) => l.ch).join('') === 'ueia', 'example: NGUYEN MINH ANH -> 5 7 3 7 5 5 · 4 9 5 8 · 1 5 8; Y next to U and E is a consonant');
ok(n.lifePath.label === '33/6' && n.lifePath.value === 33 && n.lifePath.base === 6, 'example: Life Path 1+5+0+8+1+9+9+0 = 33 (master) -> 33/6');
ok(n.birthday.value === 6 && n.attitude.value === 5 && n.soul.value === 9 && n.personality.value === 9 && n.expression.value === 9 && n.expression.sum === 72, 'example: Birthday 6, Attitude 5, Soul 9, Personality 9, Expression 72 -> 9');
ok(n.maturity.value === 6 && n.balance.value === 1 && same(n.hiddenPassion, { values: [5], count: 5 }) && same(n.karmicLessons, [2, 6]) && n.subconscious === 7 && n.karmicDebts.length === 0, 'example: Maturity 6, Balance 1, Hidden Passion 5 (five times), Karmic Lessons 2 and 6, Subconscious 7, no karmic debt');
ok(n.personalYear === 6 && n.personalMonth === 8 && n.personalMonths.length === 12 && n.age === 36, 'example: personal year 2026 = 6, personal month November = 8, age 36');
ok(n.birthGrid.join('') === '0200010012' && same(n.arrows, { full: ['159'], empty: [] }), 'example: birth chart 11 · 5 · 8 · 99 with the full arrow 1-5-9 and no empty arrow');
ok(same(n.pinnacles.map((p) => [p.n, p.challenge, p.from, p.to, p.current]), [[5, 2, 0, 30, false], [7, 5, 31, 39, true], [3, 3, 40, 48, false], [9, 7, 49, null, false]]), 'example: pinnacles 5 · 7 · 3 · 9 and challenges 2 · 5 · 3 · 7, the second one running now');
ok(same(n.cycles.map((c) => [c.n, c.from, c.to]), [[8, 0, 30], [6, 31, 48], [1, 49, null]]), 'example: life cycles 8 (0–30), 6 (31–48), 1 (49+)');
ok(A.nameLetters('Vy')[1].vowel && !A.nameLetters('Uyên')[1].vowel && A.nameLetters('Lý')[1].vowel && A.nameLetters('Đỗ Thị Hà').map((l) => l.ch).join('') === 'dothiha', 'Y is a vowel only when no vowel stands next to it; accents and đ are removed');
ok(A.numerology({ name: '', d: 1, m: 1, y: 2007 }, TODAY).lifePath.value === 11 && A.numerology({ name: '', d: 1, m: 1, y: 2007 }, TODAY).expression === null, 'master number 11 is kept; an empty name gives no name numbers');
ok(same(A.reduceChain(49), [49, 13, 4]) && A.numerology({ name: 'An', d: 13, m: 2, y: 2001 }, TODAY).karmicDebts.some((k) => k.n === 13 && k.from === 'Birthday') && A.numerology({ name: 'An', d: 5, m: 1, y: 2006 }, TODAY).karmicDebts.some((k) => k.n === 14 && k.from === 'Life Path'), 'karmic debts: a 13 / 14 / 16 / 19 on the way down, or as the birth day');
ok(A.numerology({ name: 'An', d: 29, m: 11, y: 1999 }, TODAY).birthday.value === 11 && A.numerology({ name: 'An', d: 29, m: 11, y: 1999 }, TODAY).cycles[0].n === 11, 'day 29 gives the master Birthday number 11; November gives an 11 first cycle');

// ---------------------------------------------------------------- places
ok(A.PLACES.filter((p) => p.country === 'Vietnam').length === 63 && A.PLACES.filter((p) => p.country !== 'Vietnam').length >= 100 && new Set(A.PLACES.map((p) => p.id)).size === A.PLACES.length, '63 provinces of Vietnam and at least 100 world cities, each with its own id');
ok(A.searchPlaces('ha noi')[0].name === 'Hà Nội' && A.searchPlaces('HA NOI')[0].name === 'Hà Nội' && A.searchPlaces('sai gon')[0].name === 'TP. Hồ Chí Minh' && A.searchPlaces('da lat')[0].name === 'Lâm Đồng' && A.searchPlaces('los')[0].name === 'Los Angeles', 'search ignores accents and case and knows other names ("sai gon", "da lat")');
ok(A.matchPlace('hà nội').id === 'vn-ha-noi' && A.matchPlace('Tokyo, Japan').name === 'Tokyo' && A.matchPlace('nowhere') === null, 'an exact name picks the place');
ok(A.PLACES.every((p) => Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180 && p.tz >= -11 && p.tz <= 13), 'every place has sane coordinates and a time zone');
ok(A.dstActive('US', 2005, 7, 4) && !A.dstActive('US', 2005, 1, 4) && A.dstActive('AU', 2005, 1, 4) && !A.dstActive('AU', 2005, 7, 4) && A.dstActive('EU', 2010, 10, 30) && !A.dstActive('EU', 2010, 10, 31), 'daylight saving time: US and EU summers, Australian summer, the last Sunday of October');
ok(A.tzAt(A.placeById('new-york'), 2005, 7, 4) === -4 && A.tzAt(A.placeById('vn-ha-noi'), 2005, 7, 4) === 7 && A.usesMonthFirst(A.placeById('manila')) && !A.usesMonthFirst(A.placeById('vn-ha-noi')), 'time zone on a date; the US and the Philippines write month first');

// ---------------------------------------------------------------- the birth form
const base = { name: 'Nguyễn Minh Anh', style: 'VN', day: '15', month: '08', year: '1990', cal: 'solar', hour: '14', minute: '30', gender: 'F', placeId: 'vn-ha-noi' };
const f0 = A.checkForm(base, TODAY);
ok(f0.birth && f0.birth.date === '1990-08-15' && f0.birth.time === '14:30' && f0.birth.style === 'VN' && /15 August 1990 \(solar calendar\), a Wednesday = day 25 of lunar month 6, year Canh Ngọ/.test(f0.confirm), 'a complete form gives the stored record and the confirmation line in words');
const err = (patch) => A.checkForm({ ...base, ...patch }, TODAY);
ok(/at least 2 letters/.test(err({ name: 'A' }).errors.name) && err({ name: '' }).missing.includes('name'), 'name shorter than 2 letters');
ok(err({ day: '29', month: '2', year: '2023' }).errors.date === 'February 2023 has only 28 days.' && err({ day: '31', month: '4' }).errors.date === 'April has only 30 days.', 'a day that does not exist');
{ const e = err({ day: '8', month: '15' }); ok(/There is no month 15/.test(e.errors.date) && /Vietnam style \(day \/ month \/ year\)/.test(e.errors.date) && e.swap, 'month 15: says which style you are typing in and offers the other one'); }
ok(/between 1900 and 2100/.test(err({ year: '1850' }).errors.date) && /cannot be after today/.test(err({ day: '16', month: '11', year: '2026' }).errors.date) && !err({ day: '15', month: '11', year: '2026' }).errors.date, 'year range; a date after today');
ok(/0 to 23/.test(err({ hour: '24' }).errors.time) && /0 to 59/.test(err({ minute: '60' }).errors.time) && err({ hour: '', minute: '', unknownTime: true }).birth.unknownTime === true, 'hour and minute limits; "I do not remember" skips the time');
ok(/from the suggestions/.test(err({ placeId: '', placeText: 'atlantis' }).errors.place) && err({ placeId: '' }).missing.includes('place'), 'a place must be picked from the list');
ok(err({ cal: 'lunar', day: '25', month: '6', year: '1990' }).birth.date === '1990-08-15' && err({ cal: 'lunar', day: '25', month: '6', year: '1990', leap: true }).errors.date === 'Lunar year 1990 has a leap month 5 only.' && /has no leap month/.test(err({ cal: 'lunar', day: '1', month: '3', year: '2024', leap: true }).errors.date), 'lunar input is converted to the solar date; a wrong leap month is explained');
{ const m29 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].find((m) => A.lunarMonthLength(m, 2024) === 29); ok(err({ cal: 'lunar', day: '30', month: String(m29), year: '2024' }).errors.date === `Lunar month ${m29} of 2024 has only 29 days.`, 'day 30 of a short lunar month'); }
const us = A.checkForm({ ...base, style: 'US', hour: '2', minute: '30', ampm: 'PM', placeId: 'los-angeles' }, TODAY);
ok(us.birth.time === '14:30' && us.birth.style === 'US' && us.birth.date === '1990-08-15' && A.formatDate(15, 8, 1990, 'US') === '08/15/1990' && A.formatDate(15, 8, 1990, 'VN') === '15/08/1990' && A.formatTime(14, 30, 'US') === '2:30 PM' && A.formatTime(14, 30, 'VN') === '14:30', 'US style: 2:30 PM is stored as 14:30; the date shows as 08/15/1990');
ok(A.checkForm({ ...base, placeId: 'los-angeles' }, TODAY).suggestUS === true && !A.checkForm(base, TODAY).suggestUS, 'a birth place in the US suggests the US date style (without switching)');
ok(same(A.parsePastedDate('15/08/1990', 'VN'), { day: 15, month: 8, year: 1990 }) && same(A.parsePastedDate('08/15/1990', 'US'), { day: 15, month: 8, year: 1990 }) && same(A.parsePastedDate('1990-08-15', 'US'), { day: 15, month: 8, year: 1990 }) && A.parsePastedDate('hello', 'VN') === null, 'pasting a whole date into the first box');
{ const back = A.formFromBirth(us.birth); ok(back.month === '8' && back.day === '15' && back.hour === '2' && back.ampm === 'PM' && back.style === 'US' && A.validBirth(us.birth) && !A.validBirth({ ...us.birth, date: '1990-02-30' }) && !A.validBirth({ ...us.birth, place: 'x' }), 'a stored record fills the form again in the style it was typed in; bad records are refused'); }
{ const s = A.readingSummary(f0.birth, TODAY); ok(s.lifePath === '33/6' && s.sunSign === 'Leo' && s.rising === 'Sagittarius' && s.menh === 'Lộ Bàng Thổ' && s.lunarDate === '25/6/1990' && s.tz === 7 && s.lat === 21.03, 'summary for the class file: 33/6 · Leo · Sagittarius rising · Lộ Bàng Thổ · 25/6/1990'); }

log('\n' + (failed ? failed + ' FAILED, ' : 'ALL TESTS PASSED: ') + passed + ' passed');
if (failed && typeof process !== 'undefined') process.exitCode = 1;
