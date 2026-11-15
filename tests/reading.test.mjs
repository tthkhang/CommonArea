// Checks the assembled reading (public/js/astro/report.js): every section of the spec is there for many different
// births, the long sections reach the spec's lengths, and the downloaded file is complete and self-contained.
//   node tests/reading.test.mjs
// Lengths are in English words; the spec's "N chữ" (Vietnamese syllables) is checked as 0.7 x N words.
import { buildReading, readingFile, wordCount } from '../public/js/astro/report.js';
import { PLACES } from '../public/js/astro/places.js';
const log = typeof print === 'function' ? print : console.log;
let failed = 0, passed = 0;
const ok = (c, msg) => { if (c) { passed++; log('ok   ' + msg); } else { failed++; log('FAIL ' + msg); } };
const TODAY = { d: 15, m: 11, y: 2026 };
const example = { name: 'Nguyễn Minh Anh', date: '1990-08-15', style: 'VN', cal: 'solar', lunar: null, time: '14:30', unknownTime: false, gender: 'F', place: 'vn-ha-noi' };

const R = buildReading(example, TODAY);
const tab = (id) => R.tabs.find((t) => t.id === id); const sec = (t, id) => tab(t).sections.find((s) => s.id === id);
ok(R.head.date === '15/08/1990' && R.head.time === '14:30' && R.head.place === 'Hà Nội' && JSON.stringify(R.head.badges) === JSON.stringify(['Life Path 33/6', 'Mệnh Lộ Bàng Thổ', 'Sun in Leo']), 'header: date in the Vietnam style and the three badges of the spec (33/6 · Lộ Bàng Thổ · Sun in Leo)');
ok(R.tabs.map((t) => t.title).join('|') === 'Numerology|Tử Vi|Star Chart', 'three tabs: Numerology, Tử Vi, Star Chart');
const numIds = tab('num').sections.map((s) => s.id.slice(4));
ok(['overview', 'lifepath', 'expression', 'soul', 'personality', 'birthday', 'attitude', 'maturity', 'balance', 'passion', 'lessons', 'subconscious', 'charts', 'arrows', 'pinnacles', 'cycles', 'year', 'today'].every((k) => numIds.includes(k)) && !numIds.includes('debts'), 'Numerology: all 18 sections of the example (Karmic Debt is hidden because she has none)');
ok(wordCount(sec('num', 'num-overview').html.split('<div class="rd-letters">')[0]) >= 175, `example: the big picture has ${wordCount(sec('num', 'num-overview').html.split('<div class="rd-letters">')[0])} words (spec: 250 chữ = 175 words)`);
ok(/appears 3 times among your core numbers/.test(sec('num', 'num-overview').html) && /full arrow 1-5-9, Determination/.test(sec('num', 'num-overview').html) && /missing from your name, 2 and 6/.test(sec('num', 'num-overview').html), 'example: the big picture names the repeated 9 and 6, the arrow 1-5-9 and the lessons 2 and 6');
ok(['1 · Your nature', '2 · Strengths', '3 · Things to watch', '4 · Love and relationships', '5 · Work and money', '6 · Your life lesson', '7 · Three small things'].every((h) => sec('num', 'num-lifepath').html.includes(h)) && /master number/.test(sec('num', 'num-lifepath').html), 'Life Path 33/6: the 7-part text, with a note about the master number');
ok(/you are here/.test(sec('num', 'num-pinnacles').html) && (sec('num', 'num-pinnacles').html.match(/Pinnacle \d/g) || []).length === 4 && (sec('num', 'num-year').html.match(/<tr/g) || []).length === 13, 'pinnacles: four seasons with the current one marked; the year has 12 monthly lines');
const tvIds = tab('tuvi').sections.map((s) => s.id);
ok(tvIds.length === 16 && tvIds[0] === 'tv-facts' && tvIds[1] === 'tv-board' && tvIds[2] === 'tv-menh' && tvIds[14] === 'tv-decade' && tvIds[15] === 'tv-year', 'Tử Vi: facts, board, Self + Thân, 11 palaces, current decade, this year');
ok((sec('tuvi', 'tv-board').html.match(/class="tv-cell/g) || []).length === 12 && /Lunar 25\/6\/1990/.test(sec('tuvi', 'tv-board').html) && /Canh Ngọ/.test(sec('tuvi', 'tv-board').html), 'the board has 12 palaces around a centre with the lunar date');
ok(/Can chi|Quý Mùi/.test(sec('tuvi', 'tv-facts').html) && /Lộ Bàng Thổ — earth by the roadside/.test(sec('tuvi', 'tv-facts').html) && /chủ mệnh Phá Quân/.test(sec('tuvi', 'tv-facts').html), 'facts: can chi of year / month / day / hour, Mệnh, Cục, ruling stars');
const cs = sec('chart', 'sc-wheel').html;
ok(/<svg/.test(cs) && (cs.match(/class="sc-planet"/g) || []).length === 11 && /ASC/.test(cs) && /<title>Sun 22°1\d′ Leo, house \d+<\/title>/.test(cs), 'Star Chart: a wheel with 10 planets and the node, ASC on it, and a tooltip on each planet');
{ // the wheel is drawn like a printed chart: ASC on the left, MC near the top, the signs counter-clockwise
  const at = (label) => { const m = new RegExp('<text x="([\\d.-]+)" y="([\\d.-]+)" class="sc-asc">' + label + '<').exec(cs); return m && [Number(m[1]), Number(m[2])]; };
  const asc = at('ASC'); const mc = at('MC');
  ok(asc && mc && asc[0] < 20 && Math.abs(asc[1] - 250) < 2 && mc[1] < 60, `the wheel has the ascendant on the left (${asc}) and the midheaven at the top (${mc})`); }
ok(['sc-wheel', 'sc-positions', 'sc-sun', 'sc-moon', 'sc-rising', 'sc-balance', 'sc-signs', 'sc-houses', 'sc-aspects', 'sc-meanings'].every((k) => tab('chart').sections.some((s) => s.id === k)), 'Star Chart: wheel, table, big three, balance, signs, houses, aspects, house meanings');
{ const n = (sec('chart', 'sc-aspects').html.match(/<h4>/g) || []).length; ok(n >= 5 && n <= 8, `strongest aspects: ${n} (spec: 5 to 8)`); }

// ---- an unknown birth time hides the rising sign and the houses, and says so
const U = buildReading({ ...example, time: '', unknownTime: true }, TODAY); const ut = U.tabs.find((t) => t.id === 'chart');
ok(!ut.sections.some((s) => s.id === 'sc-rising' || s.id === 'sc-houses') && /cast for 12:00 noon/.test(ut.sections[0].html) && /up to 6° off/.test(ut.sections[0].html) && /uses the Tý hour/.test(U.tabs[1].sections[0].html) && U.head.time === 'time unknown', 'unknown time: no rising sign, no houses; both charts explain what was assumed');
// ---- US style and a birth abroad
const A = buildReading({ ...example, style: 'US', place: 'los-angeles', time: '20:00' }, TODAY);
ok(A.head.date === '08/15/1990' && A.head.time === '8:00 PM' && /changed to Vietnam time/.test(A.tabs[1].sections[0].html) && /Los Angeles, United States \(UTC−7\)/.test(A.tabs[2].sections[0].html), 'US style: 08/15/1990, 8:00 PM; born abroad: Vietnam time for Tử Vi, local summer time for the star chart');
ok(/Equal houses/.test(buildReading({ ...example, place: 'tromso' }, TODAY).tabs[2].sections[0].html), 'far north: the reading says it used Equal houses');

// ---- many different births: nothing missing, long sections long enough
const names = ['Trần Văn Bình', 'Lê Thị Thu Hà', 'Phạm Quốc Khánh', 'Vy', 'Đỗ Yến Nhi', 'John Smith', 'Hoàng Gia Bảo Ngọc', 'Lý An'];
let all = true; let minOverview = 1e9; let minMenh = 1e9; let minDecade = 1e9; let minYear = 1e9; let minBig = 1e9; let minExpr = 1e9; let n = 0; const seenDebt = new Set(); let emptyMenh = 0;
for (let i = 0; i < 260; i++) {
  const y = 1950 + (i * 7) % 74; const m = 1 + (i * 5) % 12; const d = 1 + (i * 11) % 28; const hh = (i * 5) % 24;
  const b = { name: names[i % names.length], date: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`, style: i % 2 ? 'US' : 'VN', cal: 'solar', lunar: null, time: `${String(hh).padStart(2, '0')}:${String((i * 13) % 60).padStart(2, '0')}`, unknownTime: i % 9 === 8, gender: i % 2 ? 'M' : 'F', place: PLACES[(i * 17) % PLACES.length].id };
  let r; try { r = buildReading(b, TODAY); } catch (e) { all = false; log('  threw for ' + JSON.stringify(b) + ': ' + e.message); continue; }
  n++;
  for (const t of r.tabs) for (const s of t.sections) if (!s.html || /undefined|NaN|\[object/.test(s.html)) { all = false; log(`  bad section ${s.id} for ${b.name} ${b.date} ${b.time}`); }
  const g = (t, id) => r.tabs.find((x) => x.id === t).sections.find((s) => s.id === id);
  minOverview = Math.min(minOverview, wordCount(g('num', 'num-overview').html.split('<div class="rd-letters">')[0]));
  minExpr = Math.min(minExpr, wordCount(g('num', 'num-expression').html));
  minMenh = Math.min(minMenh, wordCount(g('tuvi', 'tv-menh').html)); if (/no main star/.test(g('tuvi', 'tv-menh').html.slice(0, 200))) emptyMenh++;
  if (g('tuvi', 'tv-decade') && /run through your/.test(g('tuvi', 'tv-decade').html)) minDecade = Math.min(minDecade, wordCount(g('tuvi', 'tv-decade').html.split('<div class="rd-decades">')[0]));
  minYear = Math.min(minYear, wordCount(g('tuvi', 'tv-year').html.split('<h4>')[0]));
  for (const id of ['sc-sun', 'sc-moon', 'sc-rising']) if (g('chart', id)) minBig = Math.min(minBig, wordCount(g('chart', id).html));
  if (g('num', 'num-debts')) for (const k of r.num.karmicDebts) seenDebt.add(k.n);
}
ok(all && n === 260, '260 different births (both styles, both genders, 198 places, some without a time): every section is filled in');
ok(minOverview >= 175, `the big picture is never shorter than ${minOverview} words (spec: 250 chữ = 175 words)`);
ok(minExpr >= 105, `Expression is never shorter than ${minExpr} words (spec: 150 chữ = 105 words)`);
ok(minMenh >= 210, `Self palace + Thân is never shorter than ${minMenh} words (spec: 300 chữ = 210 words; ${emptyMenh} of the charts have an empty Self palace)`);
ok(minDecade >= 105, `the current decade is never shorter than ${minDecade} words (spec: 150 chữ = 105 words)`);
ok(minYear >= 105, `this year is never shorter than ${minYear} words (spec: 150 chữ = 105 words)`);
ok(minBig >= 140, `Sun, Moon and rising sign are never shorter than ${minBig} words (spec: 200 chữ = 140 words)`);
ok(seenDebt.size >= 2, `karmic debts appear when they exist (seen: ${[...seenDebt].sort((a, b) => a - b).join(', ')})`);

// ---- the downloaded file
const file = readingFile(R, new Date(2026, 10, 15));
const bytes = typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(file).length : file.length * 2;
ok(file.startsWith('<!doctype html>') && !/<script|src=|href="http|url\(/.test(file) && bytes < 2 * 1024 * 1024, `the file is self-contained (no scripts, no outside links) and ${(bytes / 1024).toFixed(0)} KB (limit 2 MB)`);
ok(R.tabs.every((t) => t.sections.every((s) => file.includes(`id="${s.id}"`))) && /tv-board/.test(file) && /<svg/.test(file) && /@media print/.test(file) && /size:A4/.test(file) && /For reference and entertainment only/.test(file), 'the file holds all three parts, the Tử Vi board and the wheel, prints on A4 and carries the footer');
ok(/Reading for Nguyễn Minh Anh/.test(file) && !/<[^>]*Nguyễn[^>]*on[a-z]+=/.test(file) && /&lt;b&gt;/.test(readingFile(buildReading({ ...example, name: 'An <b>Bold</b> Ng' }, TODAY))), 'the name is escaped wherever it is printed');
const total = R.tabs.reduce((a, t) => a + t.sections.reduce((x, s) => x + wordCount(s.html), 0), 0);
log(`\nthe example reading is ${total} words long`);
log('\n' + (failed ? failed + ' FAILED, ' : 'ALL TESTS PASSED: ') + passed + ' passed');
if (failed && typeof process !== 'undefined') process.exitCode = 1;
