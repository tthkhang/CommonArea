// Builds one player's reading from the calculations (./numerology.js, ./tuvi.js, ./western.js) and the text packs
// (../text/*.js). No DOM: everything is returned as strings, so the same reading is shown in the game's scroll
// board and saved as a stand-alone, printable HTML file. Checked by tests/reading.test.mjs.
//   buildReading(birth, today)  ->  { head, tabs: [{ id, title, sections: [{ id, title, html }] }] }
//   readingFile(reading)        ->  the complete HTML document for "Download my reading"
import { MONTHS, CAN, CHI, ELEMENT_EN, ELEMENT_VI, mod } from './calendar.js';
import { GRID_ROWS } from './numerology.js';
import { PALACES, PALACE_EN, BOARD, BRIGHT_NAME, BRIGHT_EN } from './tuvi.js';
import { SIGNS, SIGN_GLYPH, BODY_GLYPH, BODY_NAME, ASPECT_GLYPH, formatLon } from './western.js';
import { computeReading, formatDate, formatTime, longDate, lunarText } from './birth.js';
import { formatTz } from './places.js';
import { LIFE_PATH } from '../text/num-lifepath.js';
import * as CORE from '../text/num-core.js';
import * as CYC from '../text/num-cycles.js';
import { MAIN_STAR } from '../text/tuvi-stars.js';
import * as TVX from '../text/tuvi-extra.js';
import * as BIG3 from '../text/west-big3.js';
import { PLANET_IN_SIGN } from '../text/west-signs.js';
import * as WH from '../text/west-houses.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const p = (text) => `<p>${esc(text)}</p>`;
const lead = (text) => `<p class="rd-lead">${esc(text)}</p>`; // the one bold sentence that opens a section
const pair = (v) => lead(v[0]) + p(v[1]);
const ul = (items) => `<ul>${items.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>`;
const chip = (text, cls = '') => `<span class="rd-chip ${cls}">${esc(text)}</span>`;
const ages = (from, to) => (to == null ? `${from}+` : `${from}–${to}`);
const list = (arr) => (arr.length <= 1 ? arr.join('') : arr.slice(0, -1).join(', ') + ' and ' + arr[arr.length - 1]);
export const wordCount = (html) => String(html).replace(/<[^>]*>/g, ' ').trim().split(/\s+/).filter(Boolean).length;

// ================================================================ NUMEROLOGY
const groupOf = (n) => ([1, 5, 7].includes(n) ? 'mind' : [2, 4, 8].includes(n) ? 'work' : 'heart');
const pairKey = (a, b) => { const o = ['mind', 'work', 'heart']; const [x, y] = [groupOf(a), groupOf(b)].sort((m, n) => o.indexOf(m) - o.indexOf(n)); return `${x}-${y}`; };
const numLabel = (n) => (n.value > 9 ? `${n.value}/${n.base}` : String(n.value));

function overview(num, first) {
  const lp = num.lifePath; const out = [];
  const core = [['Life Path', lp], ['Birthday', num.birthday], ['Attitude', num.attitude], ['Soul', num.soul], ['Personality', num.personality], ['Expression', num.expression], ['Maturity', num.maturity]].filter((x) => x[1]);
  out.push(`${first}, your chart is led by Life Path ${lp.label}, the number of ${CYC.ESSENCE[lp.value]}. Your name adds up to Expression ${numLabel(num.expression)}, the number of ${CYC.ESSENCE[num.expression.value]}: the first says what your road through life is like, the second what you bring along to walk it.`);
  // numbers that repeat among the seven core numbers
  const count = {}; for (const [label, n] of core) (count[n.base] = count[n.base] || []).push(label);
  const repeats = Object.entries(count).filter(([, labels]) => labels.length >= 2).sort((a, b) => b[1].length - a[1].length);
  if (repeats.length) {
    out.push(repeats.map(([n, labels]) => `The number ${n} appears ${labels.length} times among your core numbers (${list(labels)}), so ${CYC.ESSENCE[n]} ${labels.length >= 3 ? 'run through almost everything you do' : 'carry extra weight in your character'}.`).join(' '));
  } else out.push('No single number repeats among your core numbers, so your character is many-sided: each area of life brings out a different part of you, and you are hard to sum up in one word.');
  out.push(`Your Life Path and your Expression ${lp.base === num.expression.base ? 'are the same number, which doubles its force: what you are here to learn and what you are naturally good at point in one direction.' : CYC.GROUP_PAIR[pairKey(lp.base, num.expression.base)]}`);
  if (num.soul && num.personality) out.push(`Inside, your Soul number ${numLabel(num.soul)} longs for ${CYC.ESSENCE[num.soul.value]}; on the outside, your Personality number ${numLabel(num.personality)} shows people ${CYC.ESSENCE[num.personality.value]}. ${num.soul.base === num.personality.base ? 'They match, so what people see is what you really are.' : 'Those who only know your surface have not met all of you yet.'}`);
  const low = (t) => t.charAt(0).toLowerCase() + t.slice(1).replace(/\.$/, '');
  if (num.arrows.full.length) out.push(num.arrows.full.map((a) => `Your birth chart holds the full arrow ${a.split('').join('-')}, ${CYC.ARROW_FULL[a][0]}: ${low(CYC.ARROW_FULL[a][1])}.`).join(' '));
  if (num.arrows.empty.length) out.push(num.arrows.empty.map((a) => `The line ${a.split('').join('-')} is empty in your birth chart: ${low(CYC.ARROW_EMPTY[a][1])}.`).join(' '));
  if (num.karmicLessons.length) out.push(`Things to learn (the numbers missing from your name, ${list(num.karmicLessons.map(String))}): ${num.karmicLessons.slice(0, 3).map((n) => CYC.KARMIC_LESSON[n][0].replace(/^No \d in your name: the lesson is /, '').replace(/\.$/, '')).join('; ')}.`);
  else out.push('Every number from 1 to 9 appears in your name, a sign of a well-rounded set of abilities to draw on.');
  const words = []; for (const n of [lp.value, num.expression.value, num.soul ? num.soul.value : lp.value, num.birthday.value, num.maturity ? num.maturity.value : lp.value]) for (const k of LIFE_PATH[n > 33 ? lp.value : n in LIFE_PATH ? n : lp.value].keywords) if (!words.includes(k) && words.length < 3) { words.push(k); break; }
  for (const k of LIFE_PATH[lp.value].keywords) if (!words.includes(k) && words.length < 3) words.push(k);
  return out.map(p).join('') + `<p class="rd-keys">Three words for you: ${words.map((w) => chip(w, 'gold')).join(' ')}</p>`;
}

const gridHtml = (g, title) => `<div class="rd-grid"><b>${esc(title)}</b><table>${GRID_ROWS.map((row) => `<tr>${row.map((n) => `<td class="${g[n] ? '' : 'none'}">${g[n] ? String(n).repeat(Math.min(g[n], 6)) : '·'}</td>`).join('')}</tr>`).join('')}</table></div>`;

function numerologyTab(R) {
  const { num, birth: b } = R; const lp = num.lifePath; const T = LIFE_PATH[lp.value]; const S = [];
  const first = b.name.trim().split(/\s+/).pop();
  const sec = (id, title, html) => S.push({ id: 'num-' + id, title, html });
  // how the numbers were found
  const words = []; for (const l of num.letters) (words[l.word] = words[l.word] || []).push(l);
  const letterTable = `<div class="rd-letters">${words.map((w) => `<span class="rd-word">${w.map((l) => `<span class="${l.vowel ? 'v' : ''}"><i>${esc(l.ch.toUpperCase())}</i><b>${l.v}</b></span>`).join('')}</span>`).join('')}</div><p class="rd-note">Each letter of your name becomes a number (A = 1 … I = 9, J = 1 …). Vowels are shaded; Y counts as a vowel only when no other vowel stands next to it.</p>`;
  const rows = [['Life Path', lp.label, `every digit of ${longDate(b.d, b.m, b.y)} added: ${lp.chain.join(' → ')}`], ['Expression', numLabel(num.expression), `all letters: ${num.expression.chain.join(' → ')}`],
    ['Soul', num.soul ? numLabel(num.soul) : '—', num.soul ? `vowels: ${num.soul.chain.join(' → ')}` : 'no vowels'], ['Personality', num.personality ? numLabel(num.personality) : '—', num.personality ? `consonants: ${num.personality.chain.join(' → ')}` : 'no consonants'],
    ['Birthday', numLabel(num.birthday), `day ${b.d}`], ['Attitude', String(num.attitude.value), `day + month: ${num.attitude.chain.join(' → ')}`], ['Maturity', numLabel(num.maturity), `Life Path ${lp.base} + Expression ${num.expression.base}`],
    ['Balance', String(num.balance.value), 'first letter of each word'], ['Hidden Passion', num.hiddenPassion.values.join(', '), `appears ${num.hiddenPassion.count} times in the name`], ['Subconscious', String(num.subconscious), `9 − ${num.karmicLessons.length} missing number${num.karmicLessons.length === 1 ? '' : 's'}`]];
  sec('overview', 'The big picture', overview(num, first) + letterTable + `<table class="rd-table"><tr><th>Number</th><th>Yours</th><th>How it is found</th></tr>${rows.map((r) => `<tr><td>${r[0]}</td><td><b>${esc(r[1])}</b></td><td>${esc(r[2])}</td></tr>`).join('')}</table>`);
  sec('lifepath', `Life Path ${lp.label}: ${T.title}`, lead(T.summary) + `<p class="rd-keys">${T.keywords.map((k) => chip(k)).join(' ')}</p>`
    + `<h4>1 · Your nature</h4>${p(T.nature)}<h4>2 · Strengths</h4>${ul(T.strengths)}<h4>3 · Things to watch</h4>${ul(T.cautions)}<h4>4 · Love and relationships</h4>${p(T.love)}<h4>5 · Work and money</h4>${p(T.work)}<h4>6 · Your life lesson</h4>${p(T.lesson)}<h4>7 · Three small things to do this week</h4>${ul(T.advice)}`
    + (lp.value > 9 ? `<p class="rd-note">${lp.value} is a master number. On ordinary days it works like its base number ${lp.base}; read Life Path ${lp.base} as well if you are curious.</p>` : ''));
  sec('expression', `Expression ${numLabel(num.expression)}: what you are here to do`, pair(CORE.EXPRESSION[num.expression.value]));
  if (num.soul) sec('soul', `Soul ${numLabel(num.soul)}: what you long for`, pair(CORE.SOUL[num.soul.value]));
  if (num.personality) sec('personality', `Personality ${numLabel(num.personality)}: how others see you`, pair(CORE.PERSONALITY[num.personality.value]));
  sec('birthday', `Birthday ${numLabel(num.birthday)}: a special gift`, pair(CORE.BIRTHDAY[num.birthday.value]));
  sec('attitude', `Attitude ${num.attitude.value}: how you meet something new`, pair(CORE.ATTITUDE[num.attitude.value]));
  sec('maturity', `Maturity ${numLabel(num.maturity)}: who you grow into`, pair(CORE.MATURITY[num.maturity.value]));
  sec('balance', `Balance ${num.balance.value}: finding your calm again`, pair(CYC.BALANCE[num.balance.value]));
  sec('passion', `Hidden Passion ${num.hiddenPassion.values.join(' and ')}`, num.hiddenPassion.values.slice(0, 2).map((n) => pair(CYC.HIDDEN_PASSION[n])).join(''));
  sec('lessons', 'Karmic Lessons', num.karmicLessons.length ? num.karmicLessons.map((n) => pair(CYC.KARMIC_LESSON[n])).join('') : lead('Your name contains every number from 1 to 9, so no karmic lesson stands out.') + p('This is fairly rare. It suggests that you arrive with a broad set of abilities and can meet most situations with something already in hand. Your task is simply to use them all, without relying on one or two favourites.'));
  if (num.karmicDebts.length) sec('debts', 'Karmic Debt ' + num.karmicDebts.map((k) => k.n).join(', '), num.karmicDebts.map((k) => `<p class="rd-note">Found behind your ${esc(k.from)} number.</p>` + pair(CYC.KARMIC_DEBT[k.n])).join(''));
  sec('subconscious', `Subconscious ${num.subconscious}: when you are taken by surprise`, pair(CYC.SUBCONSCIOUS[num.subconscious]));
  const cellLines = (g) => [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<li>${esc(CYC.CELL[n][Math.min(g[n], 4)])}</li>`).join('');
  sec('charts', 'Your three charts', lead('The digits of your birth date and the numbers of your name are placed on a 3 by 3 grid: the top row is the mind, the middle row is feeling, the bottom row is practical life.')
    + `<div class="rd-grids">${gridHtml(num.birthGrid, 'Birth date')}${gridHtml(num.nameGrid, 'Name')}${gridHtml(num.fullGrid, 'Both together')}</div><h4>What your birth-date chart says, number by number</h4><ul class="rd-cells">${cellLines(num.birthGrid)}</ul>`);
  const arrowHtml = (a, full) => { const v = (full ? CYC.ARROW_FULL : CYC.ARROW_EMPTY)[a]; return `<h4>${full ? '➶ Full arrow' : '◌ Empty arrow'} ${a.split('').join('-')} · ${esc(v[0])}</h4>${lead(v[1])}${p(v[2])}`; };
  sec('arrows', 'The arrows of your birth chart', num.arrows.full.length + num.arrows.empty.length
    ? num.arrows.full.map((a) => arrowHtml(a, true)).join('') + num.arrows.empty.map((a) => arrowHtml(a, false)).join('')
    : lead('Your birth chart has no complete arrow and no empty one.') + p('Three numbers in a line make a full arrow, a marked strength; three empty cells in a line make an empty arrow, something to make up for. Your chart has neither, which describes a balanced nature without one overpowering trait. Your character is shaped more by your core numbers above than by any single line.'));
  sec('pinnacles', 'Four pinnacles and four challenges', lead('Life has four long seasons. Each brings an opportunity (the pinnacle) and a lesson (the challenge).')
    + num.pinnacles.map((x, i) => `<div class="rd-period${x.current ? ' now' : ''}"><h4>Season ${i + 1} · ages ${ages(x.from, x.to)}${x.current ? ' · you are here' : ''}</h4><p><b>Pinnacle ${x.n}.</b> ${esc(CYC.PINNACLE[x.n])}</p><p><b>Challenge ${x.challenge}.</b> ${esc(CYC.CHALLENGE[x.challenge])}</p></div>`).join(''));
  sec('cycles', 'Three life cycles', lead('Three long chapters, taken from the month, the day and the year of your birth.')
    + num.cycles.map((x, i) => `<div class="rd-period${x.current ? ' now' : ''}"><h4>Chapter ${i + 1} · ages ${ages(x.from, x.to)} · cycle ${x.n} (from your birth ${x.of})${x.current ? ' · you are here' : ''}</h4>${p(CYC.CYCLE[x.n])}</div>`).join(''));
  const t = num.today;
  sec('year', `Your year ${t.y}: personal year ${num.personalYear}`, pair(CYC.PERSONAL_YEAR[num.personalYear])
    + `<div class="rd-nine">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<span class="${n === num.personalYear ? 'now' : ''}">${n}</span>`).join('')}</div><p class="rd-note">Your place in the nine-year cycle. The personal year changes on 1 January.</p>`
    + `<table class="rd-table rd-months"><tr><th>Month</th><th>No.</th><th>Theme</th></tr>${num.personalMonths.map((n, i) => `<tr class="${i === t.m - 1 ? 'now' : ''}"><td>${MONTHS[i]}</td><td><b>${n}</b></td><td>${esc(CYC.PERSONAL_MONTH[n])}</td></tr>`).join('')}</table>`);
  sec('today', `Today, ${longDate(t.d, t.m, t.y)}: personal day ${num.personalDay}`, lead(CYC.PERSONAL_DAY[num.personalDay]) + '<p class="rd-note">This line changes every day.</p>');
  return { id: 'num', title: 'Numerology', icon: '🔢', sections: S };
}

// ================================================================ TỬ VI
const starTag = (s) => `<span class="tv-m">${esc(s.name)} <i>${BRIGHT_NAME[s.bright]}</i></span>`;
const starNames = (pal) => pal.main.map((s) => `${s.name} (${MAIN_STAR[s.name].en}, ${BRIGHT_NAME[s.bright]})`);
const isBright = (s) => 'MVD'.includes(s.bright);
function minorLines(pal) {
  const items = [...pal.good, ...pal.bad].map((n) => `<li><b>${esc(n)}</b> (${esc(TVX.MINOR_STAR[n].en)}): ${esc(TVX.MINOR_STAR[n].text)}</li>`);
  items.push(`<li><b>${esc(pal.ring)}</b> (${esc(TVX.MINOR_STAR[pal.ring].en)}): ${esc(TVX.MINOR_STAR[pal.ring].text)}</li>`);
  if (pal.tuan) items.push(`<li><b>Tuần</b> (${esc(TVX.MINOR_STAR['Tuần'].en)}): ${esc(TVX.MINOR_STAR['Tuần'].text)}</li>`);
  if (pal.triet) items.push(`<li><b>Triệt</b> (${esc(TVX.MINOR_STAR['Triệt'].en)}): ${esc(TVX.MINOR_STAR['Triệt'].text)}</li>`);
  return `<ul class="rd-stars">${items.join('')}</ul>`;
}
function palaceHtml(tv, pal) {
  const X = TVX.PALACE[pal.name]; let h = lead(`${pal.en} palace at ${pal.chi}: ${pal.main.length ? starNames(pal).join(' and ') : 'no main star'}. ${X.about}`);
  if (pal.main.length) for (const s of pal.main) h += p(`${s.name}. ${MAIN_STAR[s.name].palaces[pal.name]} ${isBright(s) ? MAIN_STAR[s.name].bright : MAIN_STAR[s.name].dim}`);
  else { const opp = tv.palaces[mod(pal.pos + 6, 12)]; h += p(X.empty) + (opp.main.length ? opp.main.map((s) => p(`Borrowed from ${opp.name}: ${s.name}. ${MAIN_STAR[s.name].palaces[pal.name]}`)).join('') : ''); }
  return h + minorLines(pal);
}
function boardHtml(tv, b) {
  const cell = (pos) => {
    const q = tv.palaces[pos];
    return `<div class="tv-cell${q.isMenh ? ' menh' : ''}"><div class="tv-top"><b>${esc(q.name)}${q.isThan ? ' <u>Thân</u>' : ''}</b><span>${q.can} ${q.chi}</span></div><div class="tv-en">${esc(q.en)} · ${q.decade.from}–${q.decade.to}</div>`
      + `<div class="tv-main">${q.main.map(starTag).join('<br>') || '<i class="tv-none">(no main star)</i>'}</div><div class="tv-good">${q.good.map(esc).join(' · ')}</div><div class="tv-bad">${q.bad.map(esc).join(' · ')}</div>`
      + `<div class="tv-foot">${esc(q.ring)}${q.tuan ? ' · <b>Tuần</b>' : ''}${q.triet ? ' · <b>Triệt</b>' : ''}</div></div>`;
  };
  const L = tv.lunar;
  const centre = `<div class="tv-centre"><b>${esc(b.name)}</b><span>${formatDate(b.d, b.m, b.y, b.style)}${b.unknownTime ? '' : ' · ' + formatTime(b.hour, b.minute, b.style)}</span><span>Lunar ${L.day}/${L.month}${L.leap ? ' (leap)' : ''}/${L.year}</span>`
    + `<span>${tv.year} · ${tv.animal} · ${tv.polarity}</span><span>Giờ ${tv.hourName}</span><span><b>${esc(tv.napAmName)}</b></span><span>${esc(tv.cucName)}</span></div>`;
  let out = ''; let done = false;
  for (const pos of BOARD) { if (pos >= 0) out += cell(pos); else if (!done) { out += centre; done = true; } }
  return `<div class="tv-board">${out}</div><p class="rd-note"><span class="tv-m">Main stars</span> with their brightness (miếu = at its best, vượng = strong, đắc = at ease, bình = neutral, hãm = dimmed) · <span class="tv-good">lucky stars</span> · <span class="tv-bad">harsh stars</span> · the numbers are the ages of each ten-year period.</p>`;
}
function tuviTab(R) {
  const { tv, birth: b } = R; const S = []; const sec = (id, title, html) => S.push({ id: 'tv-' + id, title, html });
  const L = tv.lunar; const notes = [];
  if (tv.notes.includes('unknownTime')) notes.push('You did not give a birth time, so the chart uses the Tý hour. The Self palace and the stars placed by the hour may be off.');
  if (tv.notes.includes('vietnamTime')) notes.push(`You were born outside Vietnam, so the birth time was first changed to Vietnam time: ${formatDate(tv.used.d, tv.used.m, tv.used.y, b.style)}, ${String(tv.used.hour).padStart(2, '0')}:${String(tv.used.minute).padStart(2, '0')}.`);
  if (tv.notes.includes('lateTy')) notes.push('A birth between 23:00 and 23:59 counts as the Tý hour of the next day, so the chart uses the following date.');
  const facts = [['Solar date', `${longDate(b.d, b.m, b.y)}${b.unknownTime ? '' : ', ' + formatTime(b.hour, b.minute, b.style)}`], ['Lunar date', lunarText(L)],
    ['Year', `${tv.year} (${tv.animal})`], ['Month', tv.monthCanChi], ['Day', tv.dayCanChi], ['Hour', `${tv.hourCanChi} (giờ ${tv.hourName}, ${tv.hourRange})`],
    ['Yin and Yang', `${tv.polarity} (${tv.polarityEn}): the ten-year periods run ${tv.forward ? 'forward' : 'backward'}`],
    ['Mệnh (birth element)', `${tv.napAmName} — ${tv.napAmGloss} · ${ELEMENT_EN[tv.menhElement]}`], ['Cục', `${tv.cucName} · ${ELEMENT_EN[tv.cucElement]} ${tv.cuc}`],
    ['Self palace', `at ${CHI[tv.menh]}${tv.palaces[tv.menh].main.length ? ', with ' + tv.palaces[tv.menh].main.map((s) => s.name).join(' and ') : ', no main star'}`], ['Thân', `in the ${PALACE_EN[tv.thanPalace]} palace (${tv.thanPalace}) at ${CHI[tv.than]}`],
    ['Ruling stars', `chủ mệnh ${tv.chuMenh} · chủ thân ${tv.chuThan}`]];
  sec('facts', 'Your chart at a glance', lead(`Born in the year ${tv.year}, ${tv.polarityEn}, Mệnh ${tv.napAmName}, ${tv.cucName}.`) + `<table class="rd-table">${facts.map((r) => `<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td></tr>`).join('')}</table>`
    + p(TVX.MENH_CUC[tv.relation]) + notes.map((n) => `<p class="rd-warn">${esc(n)}</p>`).join(''));
  sec('board', 'The twelve-palace chart', boardHtml(tv, b));
  // ---- Mệnh and Thân
  const M = tv.palaces[tv.menh]; let h = '';
  if (M.main.length) for (const s of M.main) { const X = MAIN_STAR[s.name]; h += lead(`${s.name}, ${X.en}, in your Self palace (${BRIGHT_NAME[s.bright]}, ${BRIGHT_EN[s.bright]}). ${X.menh[0]}`) + `<p class="rd-keys">${X.keywords.map((k) => chip(k)).join(' ')}</p>` + p(X.menh[1]) + p(isBright(s) ? X.bright : X.dim); }
  else { const opp = tv.palaces[mod(tv.menh + 6, 12)]; h += lead('Your Self palace has no main star: you are adaptable and shaped by the company you keep.') + p(TVX.PALACE['Mệnh'].empty) + opp.main.map((s) => p(`Borrowed from the opposite palace, Thiên Di: ${s.name}, ${MAIN_STAR[s.name].en}. ${MAIN_STAR[s.name].menh[1]}`)).join(''); }
  h += `<h4>Other stars in your Self palace</h4>${minorLines(M)}<h4>Where your Thân sits: ${esc(tv.thanPalace)} (${PALACE_EN[tv.thanPalace]})</h4>${p(TVX.THAN_AT[tv.thanPalace])}`;
  const T = tv.palaces[tv.than]; if (tv.than !== tv.menh && T.main.length) h += p(`The Thân palace holds ${starNames(T).join(' and ')}, whose qualities grow stronger in you from the middle of life.`);
  h += `<h4>Your element: ${ELEMENT_VI[tv.menhElement]} (${ELEMENT_EN[tv.menhElement]})</h4>${pair(TVX.ELEMENT[tv.menhElement])}`;
  sec('menh', 'Self palace and Thân', h);
  for (const name of PALACES.slice(1)) { const pal = tv.palaces.find((q) => q.name === name); sec('p' + PALACES.indexOf(name), `${name} · ${pal.en}`, palaceHtml(tv, pal)); }
  // ---- the running decade
  const D = tv.currentDecade;
  const line = `<div class="rd-decades">${tv.decades.slice(0, 9).map((d) => `<span class="${d.current ? 'now' : ''}"><b>${d.from}–${d.to}</b>${esc(PALACE_EN[d.name])}</span>`).join('')}</div>`;
  if (D) { const pal = tv.palaces[D.pos]; const X = TVX.PALACE[D.name];
    sec('decade', `Your current ten years: ages ${D.from}–${D.to}`, lead(`Ages ${D.from} to ${D.to} (you are ${tv.ageVN} by the Vietnamese count) run through your ${pal.en} palace, ${D.name}, at ${pal.chi}. ${X.decade[0]}`) + p(X.decade[1])
      + p(pal.main.length ? `The stars of these years are ${starNames(pal).join(' and ')}. ${pal.main.map((s) => MAIN_STAR[s.name].palaces[D.name] || MAIN_STAR[s.name].menh[0]).join(' ')}` : `This palace has no main star, so these years take their colour from the palace opposite and from your own choices. ${X.empty}`) + line + '<p class="rd-note">Ages are counted the Vietnamese way (one year old at birth).</p>');
  } else sec('decade', 'Your ten-year periods', lead(`Your first ten-year period begins at age ${tv.cuc}, in your Self palace.`) + p('Until then, a child lives within the fortune of the family. Each period afterwards moves one palace along and lasts ten years.') + line);
  // ---- this year
  const Y = tv.yearNow; const yp = tv.palaces[Y.pos]; const XY = TVX.PALACE[Y.palace];
  sec('year', `This year: ${Y.year}, ${Y.canChi}`, lead(`In ${Y.year}, the year ${Y.canChi} (${Y.animal}), your small luck falls in your ${yp.en} palace, ${Y.palace}. ${XY.year[0]}`) + p(XY.year[1])
    + (yp.main.length ? p(`This palace holds ${starNames(yp).join(' and ')}: ${yp.main.map((s) => (MAIN_STAR[s.name].palaces[Y.palace] || MAIN_STAR[s.name].menh[0])).join(' ')}`) : '')
    + `<h4>The four Hóa of ${Y.canChi}</h4><ul class="rd-stars">${Y.hoa.map((x) => `<li><b>${x.hoa}</b> rides on ${esc(x.star)} and lands in your ${PALACE_EN[x.palace]} palace (${esc(x.palace)}): ${esc(TVX.HOA_NOW[x.hoa])}</li>`).join('')}</ul>`);
  return { id: 'tuvi', title: 'Tử Vi', icon: '🏮', sections: S };
}

// ================================================================ STAR CHART
const COLORS = { conjunction: '#C8930F', sextile: '#3E63DD', trine: '#3E63DD', square: '#E5484D', opposition: '#E5484D' };
function wheelSvg(c, name) {
  const cx = 250; const cy = 250; const R = 232; const R2 = 200; const R3 = 118; const asc = c.asc == null ? 0 : c.asc;
  // the ascendant sits on the left and the signs run counter-clockwise, as on a printed chart: the midheaven comes out at the top
  const pt = (lon, r) => { const a = (180 + (lon - asc)) * Math.PI / 180; return [(cx + Math.cos(a) * r).toFixed(1), (cy - Math.sin(a) * r).toFixed(1)]; };
  let s = `<svg viewBox="-16 -16 532 532" class="sc-wheel" role="img" aria-label="Star chart wheel"><circle cx="${cx}" cy="${cy}" r="${R}" class="sc-ring"/><circle cx="${cx}" cy="${cy}" r="${R2}" class="sc-ring"/><circle cx="${cx}" cy="${cy}" r="${R3}" class="sc-ring in"/>`;
  for (let i = 0; i < 12; i++) {
    const [x1, y1] = pt(i * 30, R2); const [x2, y2] = pt(i * 30, R); const [gx, gy] = pt(i * 30 + 15, (R + R2) / 2);
    s += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="sc-line"/><text x="${gx}" y="${gy}" class="sc-sign"><title>${SIGNS[i]}</title>${SIGN_GLYPH[i]}︎</text>`;
  }
  if (c.cusps) c.cusps.forEach((lon, i) => {
    const [x1, y1] = pt(lon, R3); const [x2, y2] = pt(lon, R2); const mid = lon + mod(c.cusps[(i + 1) % 12] - lon, 360) / 2; const [nx, ny] = pt(mid, R3 + 13);
    s += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="sc-house${i % 3 === 0 ? ' ax' : ''}"/><text x="${nx}" y="${ny}" class="sc-hnum">${i + 1}</text>`;
  });
  for (const a of c.aspects.slice(0, 14)) { // aspect lines
    const A = c.bodies.find((b) => b.name === a.a); const B = c.bodies.find((b) => b.name === a.b); const [x1, y1] = pt(A.lon, R3); const [x2, y2] = pt(B.lon, R3);
    s += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${COLORS[a.type]}" stroke-width="${(0.8 + a.strength * 1.6).toFixed(1)}" opacity="${(0.35 + a.strength * 0.5).toFixed(2)}"><title>${a.a} ${a.type} ${a.b} (${a.orb.toFixed(1)}° from exact)</title></line>`;
  }
  // glyphs, spread apart when bodies are close together
  const pts = [...c.bodies, c.node].map((b) => ({ b, at: b.lon })).sort((p1, p2) => p1.at - p2.at);
  for (let k = 0; k < 6; k++) for (let i = 0; i < pts.length; i++) { const a = pts[i]; const n = pts[(i + 1) % pts.length]; const gap = mod(n.at - a.at, 360); if (gap < 9) { const d = (9 - gap) / 2; a.at = mod(a.at - d, 360); n.at = mod(n.at + d, 360); } }
  for (const q of pts) {
    const [dx, dy] = pt(q.b.lon, R2); const [tx, ty] = pt(q.b.lon, R2 - 8); const [x, y] = pt(q.at, R2 - 26); const [lx, ly] = pt(q.at, R2 - 50);
    s += `<g class="sc-planet"><title>${BODY_NAME[q.b.name]} ${formatLon(q.b.lon)}${q.b.house ? ', house ' + q.b.house : ''}${q.b.retro ? ', retrograde' : ''}</title><line x1="${dx}" y1="${dy}" x2="${tx}" y2="${ty}" class="sc-tick"/><circle cx="${x}" cy="${y}" r="13" class="sc-hit"/><text x="${x}" y="${y}" class="sc-body${q.b.name === 'Node' ? ' node' : ''}">${BODY_GLYPH[q.b.name]}︎</text><text x="${lx}" y="${ly}" class="sc-deg">${q.b.deg}°${q.b.retro ? '℞' : ''}</text></g>`;
  }
  if (c.asc != null) { const [ax, ay] = pt(c.asc, R + 12); const [mx, my] = pt(c.mc, R + 12); s += `<text x="${ax}" y="${ay}" class="sc-asc">ASC</text><text x="${mx}" y="${my}" class="sc-asc">MC</text>`; }
  return s + `<text x="${cx}" y="${cy}" class="sc-mid">${esc(name)}</text></svg>`;
}
const bars = (obj, total) => `<div class="rd-bars">${Object.entries(obj).map(([k, v]) => `<div><span>${k}</span><i><b style="width:${Math.round((v / total) * 100)}%"></b></i><em>${v}</em></div>`).join('')}</div>`;
function chartTab(R) {
  const { chart: c, birth: b } = R; const S = []; const sec = (id, title, html) => S.push({ id: 'sc-' + id, title, html });
  const first = b.name.trim().split(/\s+/).pop(); const notes = [];
  if (c.unknownTime) notes.push('You did not give a birth time, so the chart is cast for 12:00 noon and shows no rising sign, no houses and no planets in houses. The Moon moves about 13° a day, so its position may be up to 6° off.');
  if (c.houseSystem === 'Equal') notes.push('You were born above 66° of latitude, where Placidus houses cannot be drawn, so this chart uses Equal houses.');
  sec('wheel', 'Your chart wheel', lead(`Sun in ${SIGNS[c.sun.sign]}, Moon in ${SIGNS[c.moon.sign]}${c.ascSign == null ? '' : `, ${SIGNS[c.ascSign]} rising`}.`) + `<div class="sc-wrap">${wheelSvg(c, first)}</div>`
    + `<p class="rd-note">${c.asc == null ? 'Aries begins on the left.' : 'The rising sign (ASC) is on the left; the numbers are the houses.'} Lines join planets in aspect: <span style="color:#E5484D">red</span> square or opposition, <span style="color:#3E63DD">blue</span> trine or sextile, <span style="color:#C8930F">gold</span> conjunction. Point at a planet to see its name and position.</p>`
    + notes.map((n) => `<p class="rd-warn">${esc(n)}</p>`).join('') + `<p class="rd-note">Born in ${esc(b.placeName)} (${formatTz(b.tz)}). Tropical zodiac${c.houseSystem ? `, ${c.houseSystem} houses` : ''}.</p>`);
  const row = (x, label) => `<tr><td>${BODY_GLYPH[x.name] || ''}︎ ${esc(label || BODY_NAME[x.name])}</td><td>${x.deg}°${String(x.min).padStart(2, '0')}′</td><td>${SIGN_GLYPH[x.sign]}︎ ${SIGNS[x.sign]}</td><td>${x.house || '—'}</td><td>${x.retro ? '℞' : ''}</td></tr>`;
  const angle = (lon, label) => { const sg = Math.floor(lon / 30); const d = lon - sg * 30; return `<tr><td>${label}</td><td>${Math.floor(d)}°${String(Math.floor((d % 1) * 60)).padStart(2, '0')}′</td><td>${SIGN_GLYPH[sg]}︎ ${SIGNS[sg]}</td><td></td><td></td></tr>`; };
  sec('positions', 'Table of positions', `<table class="rd-table sc-table"><tr><th>Body</th><th>Position</th><th>Sign</th><th>House</th><th></th></tr>${c.bodies.map((x) => row(x)).join('')}${row(c.node)}${c.asc == null ? '' : angle(c.asc, 'Rising sign (ASC)') + angle(c.mc, 'Midheaven (MC)')}</table><p class="rd-note">℞ = retrograde: seen from Earth the planet appears to move backward, so its themes turn inward.</p>`);
  sec('sun', `Sun in ${SIGNS[c.sun.sign]}: your core self`, pair(BIG3.SUN_IN[SIGNS[c.sun.sign]]));
  sec('moon', `Moon in ${SIGNS[c.moon.sign]}: your feelings`, pair(BIG3.MOON_IN[SIGNS[c.moon.sign]]));
  if (c.ascSign != null) sec('rising', `${SIGNS[c.ascSign]} rising: the first impression`, pair(BIG3.RISING_IN[SIGNS[c.ascSign]]));
  // ---- elements and modalities
  const eh = Object.entries(c.elements).filter(([, v]) => v >= 4).map(([k]) => WH.ELEMENT_TEXT[k].high); const elow = Object.entries(c.elements).filter(([, v]) => v <= 1).map(([k]) => WH.ELEMENT_TEXT[k].low);
  const mh = Object.entries(c.modalities).filter(([, v]) => v >= 5).map(([k]) => WH.MODALITY_TEXT[k].high); const mlow = Object.entries(c.modalities).filter(([, v]) => v <= 1).map(([k]) => WH.MODALITY_TEXT[k].low);
  const top = Object.entries(c.elements).sort((x, y) => y[1] - x[1]); const topM = Object.entries(c.modalities).sort((x, y) => y[1] - x[1]);
  sec('balance', 'Balance of elements and modalities', lead(`Your ten planets lean toward ${top[0][0]} (${top[0][1]}) and ${topM[0][0].toLowerCase()} signs (${topM[0][1]}).`)
    + `<div class="rd-two">${bars(c.elements, 10)}${bars(c.modalities, 10)}</div>` + [...eh, ...elow, ...mh, ...mlow].map(p).join('')
    + (eh.length + elow.length + mh.length + mlow.length ? '' : p('No element or modality is very strong or nearly missing in your chart. You have a balanced temperament, able to feel, think, act and build in fair measure, and you can meet most situations with the quality they call for.')));
  sec('signs', 'Planets in the signs', lead('Each planet is a part of you; the sign it stands in shows the style in which that part works.')
    + ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'].map((n) => { const x = c.bodies.find((q) => q.name === n); return `<h4>${BODY_GLYPH[n]}︎ ${n} in ${SIGNS[x.sign]}${x.retro ? ' ℞' : ''}</h4>${p(PLANET_IN_SIGN[n][SIGNS[x.sign]])}`; }).join('')
    + `<h4>${BODY_GLYPH.Node}︎ North Node in ${SIGNS[c.node.sign]}</h4>${p(PLANET_IN_SIGN.Node[SIGNS[c.node.sign]])}`);
  if (c.cusps) sec('houses', 'Planets in the houses', lead('The house a planet stands in shows the area of life where it is most active.')
    + c.bodies.map((x) => `<h4>${BODY_GLYPH[x.name]}︎ ${x.name} in house ${x.house} · ${esc(WH.HOUSE_MEANING[x.house])}</h4>${p(WH.PLANET_IN_HOUSE[x.name][x.house])}`).join(''));
  const strong = c.aspects.slice(0, Math.max(5, Math.min(8, c.aspects.filter((a) => a.strength >= 0.45).length)));
  sec('aspects', 'Your strongest aspects', lead('An aspect is an angle between two planets: it tells how two parts of you work together.')
    + strong.map((a) => `<h4><span style="color:${COLORS[a.type]}">${ASPECT_GLYPH[a.type]}</span> ${a.a} ${WH.ASPECT_TYPE[a.type][0].toLowerCase()} ${a.b} <small>(${a.orb.toFixed(1)}° from exact)</small></h4>${p(`${WH.ASPECT_PAIR[`${a.a}-${a.b}`]} ${WH.ASPECT_TYPE[a.type][1]}`)}`).join(''));
  sec('meanings', 'What the twelve houses mean', `<table class="rd-table">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((h) => `<tr><td>House ${h}</td><td>${esc(WH.HOUSE_MEANING[h])}</td><td>${c.cusps ? 'begins at ' + formatLon(c.cusps[h - 1]) : ''}</td></tr>`).join('')}</table>`);
  return { id: 'chart', title: 'Star Chart', icon: '✨', sections: S };
}

// ================================================================ the whole reading
export function buildReading(birthRecord, today) {
  const R = computeReading(birthRecord, today); const b = R.birth;
  const head = { name: b.name, date: formatDate(b.d, b.m, b.y, b.style), time: b.unknownTime ? 'time unknown' : formatTime(b.hour, b.minute, b.style), place: b.placeName,
    badges: [`Life Path ${R.num.lifePath.label}`, `Mệnh ${R.tv.napAmName}`, `Sun in ${SIGNS[R.chart.sun.sign]}`] };
  return { birth: b, num: R.num, tv: R.tv, chart: R.chart, head, tabs: [numerologyTab(R), tuviTab(R), chartTab(R)] };
}

// Styles of the reading itself (shared by the game's board and the downloaded file)
export const READING_CSS = `
.rd-lead{font-weight:800;font-size:1.06em;margin:.2em 0 .5em}
.rd-note{color:#7A6A4F;font-size:.88em;margin:.4em 0}
.rd-warn{background:#FFF1C9;border:2px solid #D99A12;border-radius:10px;padding:6px 10px;font-size:.92em}
.rd-keys{margin:.3em 0 .7em}
.rd-chip{display:inline-block;border:2px solid #2B1F4D;border-radius:999px;padding:1px 10px;font-weight:800;font-size:.85em;background:#fff;margin:0 4px 4px 0}
.rd-chip.gold{background:#FFE9A8}
.rd-sec h4{margin:1em 0 .25em;font-size:1em;font-weight:800}
.rd-sec p{margin:.35em 0;line-height:1.55}
.rd-sec ul{margin:.3em 0 .6em;padding-left:1.3em;line-height:1.5}
.rd-sec li{margin:.2em 0}
.rd-table{border-collapse:collapse;width:100%;font-size:.93em;margin:.5em 0}
.rd-table th{text-align:left;font-weight:800;border-bottom:2px solid #2B1F4D;padding:3px 8px}
.rd-table td{padding:4px 8px;border-bottom:1px dashed #C9B58A;vertical-align:top}
.rd-table tr.now td{background:#FFE9A8}
.rd-letters{display:flex;flex-wrap:wrap;gap:12px;margin:.8em 0 .2em}
.rd-word{display:flex;gap:2px}
.rd-word span{display:grid;justify-items:center;border:2px solid #2B1F4D;border-radius:8px;background:#fff;min-width:26px;padding:1px 3px}
.rd-word span.v{background:#FFE9A8}
.rd-word i{font-style:normal;font-weight:800}
.rd-word b{font-size:.8em;color:#5A2FE0}
.rd-grids{display:flex;flex-wrap:wrap;gap:16px;margin:.6em 0}
.rd-grid b{display:block;text-align:center;margin-bottom:4px}
.rd-grid table{border-collapse:collapse}
.rd-grid td{width:54px;height:44px;border:2px solid #2B1F4D;text-align:center;font-weight:800;background:#fff;font-size:.95em}
.rd-grid td.none{color:#C9B58A;background:#FBF3DC}
.rd-cells{font-size:.93em}
.rd-period{border:2px solid #C9B58A;border-radius:12px;padding:4px 12px;margin:.5em 0;background:rgba(255,255,255,.5)}
.rd-period.now{border-color:#2B1F4D;background:#FFE9A8}
.rd-nine{display:flex;gap:4px;margin:.6em 0 .2em}
.rd-nine span{flex:1;text-align:center;border:2px solid #2B1F4D;border-radius:8px;font-weight:800;padding:3px 0;background:#fff}
.rd-nine span.now{background:#7A4DFF;color:#fff}
.rd-decades{display:flex;flex-wrap:wrap;gap:4px;margin:.6em 0 .2em}
.rd-decades span{display:grid;justify-items:center;border:2px solid #2B1F4D;border-radius:8px;padding:2px 8px;font-size:.8em;background:#fff}
.rd-decades span.now{background:#FFE9A8}
.rd-stars{font-size:.93em}
.rd-two{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin:.6em 0}
.rd-bars div{display:grid;grid-template-columns:74px 1fr 18px;align-items:center;gap:6px;margin:3px 0;font-size:.9em}
.rd-bars i{display:block;height:12px;border:2px solid #2B1F4D;border-radius:999px;background:#fff;overflow:hidden}
.rd-bars b{display:block;height:100%;background:#7A4DFF}
.rd-bars em{font-style:normal;font-weight:800}
.tv-board{display:grid;grid-template-columns:repeat(4,1fr);gap:4px;margin:.5em 0}
.tv-cell{background:#fff;border:2px solid #2B1F4D;border-radius:10px;padding:5px 6px;min-height:118px;font-size:11.5px;line-height:1.25;display:flex;flex-direction:column}
.tv-cell.menh{background:#FFF1C9;box-shadow:inset 0 0 0 2px #D99A12}
.tv-top{display:flex;justify-content:space-between;gap:4px}
.tv-top b{font-weight:800;font-size:12.5px}.tv-top u{color:#5A2FE0}
.tv-top span,.tv-en{color:#7A6A4F;font-size:10.5px}
.tv-main{margin-top:3px}.tv-m{color:#C0262B;font-weight:800}.tv-m i{font-weight:600;font-style:normal;font-size:.85em}.tv-none{color:#9A8F7A}
.tv-good{color:#2456C9;font-size:10.5px;margin-top:2px}.tv-bad{color:#6B6B76;font-size:10.5px}
.tv-foot{margin-top:auto;color:#7A6A4F;font-size:10px}
.tv-centre{grid-column:2/4;grid-row:2/4;background:#FBF3DC;border:2px solid #2B1F4D;border-radius:10px;display:grid;place-content:center;justify-items:center;gap:2px;padding:8px;text-align:center;font-size:12.5px}
.tv-centre b{font-weight:800;font-size:17px}
.sc-wrap{display:flex;justify-content:center;margin:.4em 0}
.sc-wheel{width:min(500px,100%);height:auto}
.sc-ring{fill:#FFFDF6;stroke:#2B1F4D;stroke-width:2.5}.sc-ring.in{fill:#FBF3DC;stroke-width:1.5}
.sc-line{stroke:#2B1F4D;stroke-width:1.5}.sc-house{stroke:#B9A77D;stroke-width:1}.sc-house.ax{stroke:#2B1F4D;stroke-width:2}
.sc-sign{font:20px sans-serif;fill:#7A4DFF;text-anchor:middle;dominant-baseline:central}
.sc-hnum{font:700 10px sans-serif;fill:#9A8F7A;text-anchor:middle;dominant-baseline:central}
.sc-body{font:21px sans-serif;fill:#2B1F4D;text-anchor:middle;dominant-baseline:central}.sc-body.node{fill:#7A6A4F}
.sc-deg{font:700 9px sans-serif;fill:#7A6A4F;text-anchor:middle;dominant-baseline:central}
.sc-tick{stroke:#2B1F4D;stroke-width:1.5}.sc-hit{fill:transparent}
.sc-planet:hover .sc-body{fill:#E5484D}
.sc-asc{font:800 11px sans-serif;fill:#E5484D;text-anchor:middle;dominant-baseline:central}
.sc-mid{font:800 17px sans-serif;fill:#2B1F4D;text-anchor:middle;dominant-baseline:central}
`;

/** The reading as one self-contained HTML file: all three parts, the Tử Vi board and the chart wheel; prints on A4. */
export function readingFile(reading, made = new Date()) {
  const h = reading.head;
  const body = reading.tabs.map((t) => `<h2 id="${t.id}">${t.icon} ${esc(t.title)}</h2>` + t.sections.map((s) => `<section class="rd-sec" id="${s.id}"><h3>${esc(s.title)}</h3>${s.html}</section>`).join('')).join('');
  const toc = reading.tabs.map((t) => `<li><a href="#${t.id}">${esc(t.title)}</a><ol>${t.sections.map((s) => `<li><a href="#${s.id}">${esc(s.title)}</a></li>`).join('')}</ol></li>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Reading for ${esc(h.name)} — Common Area</title><style>
body{margin:0;background:#EFE3C2;color:#2B1F4D;font:16px/1.5 Georgia,"Times New Roman",serif}
main{max-width:820px;margin:24px auto;background:#FFF9EA;border:3px double #B8892B;border-radius:6px;padding:28px 34px;box-shadow:0 8px 30px rgba(60,40,10,.25)}
h1{font-size:30px;margin:0 0 4px;text-align:center}h2{margin:1.6em 0 .2em;padding-top:.6em;border-top:3px double #B8892B;font-size:26px}h3{margin:1.3em 0 .3em;font-size:19px;color:#5A2FE0}
.who{text-align:center;color:#7A6A4F}.badges{text-align:center;margin:.6em 0 1em}
nav{font-size:.9em;columns:2;border:1px solid #C9B58A;border-radius:8px;padding:8px 14px;background:#FBF3DC}nav ol{margin:.2em 0 .6em;padding-left:1.2em}nav>ul{list-style:none;padding:0;margin:0}nav a{color:#2B1F4D}
footer{text-align:center;color:#7A6A4F;font-size:.85em;margin-top:2em;border-top:1px solid #C9B58A;padding-top:.8em}
${READING_CSS}
@media print{body{background:#fff}main{box-shadow:none;border:0;margin:0;max-width:none;padding:0}section,.rd-period,.tv-board,.sc-wrap,tr{break-inside:avoid}h2{break-before:page}h2:first-of-type{break-before:auto}@page{size:A4;margin:16mm}}
</style></head><body><main><h1>Reading for ${esc(h.name)}</h1><p class="who">Born ${esc(h.date)} · ${esc(h.time)} · ${esc(h.place)}</p><p class="badges">${h.badges.map((x) => chip(x, 'gold')).join(' ')}</p><nav><ul>${toc}</ul></nav>${body}
<footer>For reference and entertainment only. Made in the Astrology Room of Common Area on ${longDate(made.getDate(), made.getMonth() + 1, made.getFullYear())}.</footer></main></body></html>`;
}
