// The birth form of the Astrology Room, without the DOM: checking what was typed, the two date styles
// (Vietnam day/month/year, US month/day/year), the stored record and the summary written to the class file.
// A stored birth record is small and style-free, so the way a date was typed can never change the data:
//   { name, date: '1990-08-15' (always solar, ISO), style: 'VN' | 'US', cal: 'solar' | 'lunar', lunar: { d, m, y, leap } | null,
//     time: '14:30' | '', unknownTime, gender: 'M' | 'F', place: '<place id>' }
import { daysInMonth, MONTHS, WEEKDAYS, weekday, solarToLunar, lunarToSolar, lunarLeapMonth, lunarMonthLength, CAN, CHI, yearCan, yearChi } from './calendar.js';
import { nameLetters, numerology } from './numerology.js';
import { placeById, placeLabel, tzAt, usesMonthFirst } from './places.js';
import { tuVi } from './tuvi.js';
import { starChart, SIGNS } from './western.js';

export const STYLES = {
  VN: { flag: '🇻🇳', label: 'Vietnam', order: ['day', 'month', 'year'], hint: ['dd', 'mm', 'yyyy'], words: 'day / month / year' },
  US: { flag: '🇺🇸', label: 'US', order: ['month', 'day', 'year'], hint: ['mm', 'dd', 'yyyy'], words: 'month / day / year' },
};
const two = (n) => String(n).padStart(2, '0');
const int = (s) => (/^\d+$/.test(String(s ?? '').trim()) ? Number(String(s).trim()) : NaN);

/** A whole date pasted into the first box: "15/08/1990" (read in the given style) or "1990-08-15". Returns { day, month, year } or null. */
export function parsePastedDate(text, style) {
  const s = String(text || '').trim();
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(s);
  if (m) return { day: +m[3], month: +m[2], year: +m[1] };
  m = /^(\d{1,2})\s*[-/. ]\s*(\d{1,2})\s*[-/. ]\s*(\d{4})$/.exec(s);
  if (!m) return null;
  return style === 'US' ? { day: +m[2], month: +m[1], year: +m[3] } : { day: +m[1], month: +m[2], year: +m[3] };
}

/** "15/08/1990" in the Vietnam style, "08/15/1990" in the US style. */
export const formatDate = (d, m, y, style) => (style === 'US' ? `${two(m)}/${two(d)}/${y}` : `${two(d)}/${two(m)}/${y}`);
/** "14:30" in the Vietnam style, "2:30 PM" in the US style. */
export function formatTime(hour, minute, style) {
  if (style !== 'US') return `${two(hour)}:${two(minute)}`;
  return `${hour % 12 === 0 ? 12 : hour % 12}:${two(minute)} ${hour < 12 ? 'AM' : 'PM'}`;
}
export const longDate = (d, m, y) => `${d} ${MONTHS[m - 1]} ${y}`;
export const lunarText = (L) => `day ${L.day} of lunar month ${L.month}${L.leap ? ' (leap)' : ''}, year ${CAN[yearCan(L.year)]} ${CHI[yearChi(L.year)]}`;

/**
 * Check the form as it is typed.
 * form: { name, style, day, month, year, cal, leap, hour, minute, ampm ('AM' | 'PM' | ''), unknownTime, gender, placeId }  (text boxes as strings)
 * Returns { errors: { field: message }, missing: [field], swap (offer the other date style), confirm (the line under the date), birth (when all is well) }.
 */
export function checkForm(form, today) {
  const t = today || (() => { const n = new Date(); return { d: n.getDate(), m: n.getMonth() + 1, y: n.getFullYear() }; })();
  const errors = {}; const missing = []; const out = { errors, missing, swap: false, confirm: '', birth: null };
  const style = form.style === 'US' ? 'US' : 'VN'; const other = style === 'US' ? 'VN' : 'US';

  // ---- name
  const name = String(form.name || '').replace(/\s+/g, ' ').trim();
  if (!name) missing.push('name');
  else if (nameLetters(name).length < 2) errors.name = 'Please enter your full birth name (at least 2 letters).';

  // ---- date
  const ds = [form.day, form.month, form.year].map((v) => String(v ?? '').trim());
  let solar = null; let lunar = null;
  if (ds.some((v) => !v)) { if (ds.every((v) => !v) || ds.every((v) => !v || /^\d+$/.test(v))) missing.push('date'); else errors.date = 'Use numbers only for the day, month and year.'; }
  else {
    const day = int(ds[0]); const month = int(ds[1]); const year = int(ds[2]);
    if ([day, month, year].some(Number.isNaN)) errors.date = 'Use numbers only for the day, month and year.';
    else if (ds[2].length < 4) missing.push('date'); // still typing the year
    else if (month > 12 || month < 1) {
      errors.date = `There is no month ${month}. You are typing in the ${STYLES[style].label} style (${STYLES[style].words}).`;
      if (month > 12 && day >= 1 && day <= 12) { errors.date += ` Did you mean the ${STYLES[other].label} style?`; out.swap = true; }
    } else if (year < 1900 || year > 2100) errors.date = 'The birth year must be between 1900 and 2100.';
    else if (day < 1) errors.date = 'The day starts at 1.';
    else if (form.cal === 'lunar') {
      const leapOf = lunarLeapMonth(year);
      if (form.leap && leapOf !== month) errors.date = leapOf ? `Lunar year ${year} has a leap month ${leapOf} only.` : `Lunar year ${year} has no leap month.`;
      else if (day > 30) errors.date = 'A lunar month has 29 or 30 days.';
      else {
        solar = lunarToSolar(day, month, year, !!form.leap);
        if (!solar) { const len = lunarMonthLength(month, year, !!form.leap); errors.date = len ? `Lunar month ${month}${form.leap ? ' (leap)' : ''} of ${year} has only ${len} days.` : 'That lunar date does not exist.'; }
        else lunar = { d: day, m: month, y: year, leap: !!form.leap };
      }
    } else if (day > daysInMonth(month, year)) {
      errors.date = month === 2 ? `February ${year} has only ${daysInMonth(2, year)} days.` : `${MONTHS[month - 1]} has only ${daysInMonth(month, year)} days.`;
    } else solar = { d: day, m: month, y: year };
    if (solar && (solar.y > t.y || (solar.y === t.y && (solar.m > t.m || (solar.m === t.m && solar.d > t.d))))) { errors.date = 'The birth date cannot be after today.'; solar = null; }
    if (solar && (solar.y < 1900 || solar.y > 2100)) { errors.date = 'The birth year must be between 1900 and 2100.'; solar = null; }
  }
  if (solar) {
    const L = lunar ? { day: lunar.d, month: lunar.m, year: lunar.y, leap: lunar.leap } : solarToLunar(solar.d, solar.m, solar.y);
    out.confirm = `➜ ${longDate(solar.d, solar.m, solar.y)} (solar calendar), a ${WEEKDAYS[weekday(solar.d, solar.m, solar.y)]} = ${lunarText(L)}`;
  }

  // ---- time
  let hour = 0; let minute = 0;
  if (!form.unknownTime) {
    const hs = String(form.hour ?? '').trim(); const ms = String(form.minute ?? '').trim();
    if (!hs || !ms) missing.push('time');
    else {
      hour = int(hs); minute = int(ms);
      const twelve = form.ampm === 'AM' || form.ampm === 'PM';
      if (Number.isNaN(hour) || Number.isNaN(minute) || minute > 59 || (twelve ? hour < 1 || hour > 12 : hour > 23)) {
        errors.time = twelve ? 'With AM / PM, hours go from 1 to 12 and minutes from 0 to 59.' : 'Hours go from 0 to 23, minutes from 0 to 59.';
      } else if (twelve) hour = (hour % 12) + (form.ampm === 'PM' ? 12 : 0);
    }
  }

  // ---- gender, place
  if (form.gender !== 'M' && form.gender !== 'F') missing.push('gender');
  const place = placeById(form.placeId);
  if (!place) { if (String(form.placeText || '').trim()) errors.place = 'Pick the birth place from the suggestions (if yours is missing, choose the nearest city).'; else missing.push('place'); }
  out.suggestUS = style === 'VN' && usesMonthFirst(place);

  if (!Object.keys(errors).length && !missing.length) {
    out.birth = { name, date: `${solar.y}-${two(solar.m)}-${two(solar.d)}`, style, cal: lunar ? 'lunar' : 'solar', lunar,
      time: form.unknownTime ? '' : `${two(hour)}:${two(minute)}`, unknownTime: !!form.unknownTime, gender: form.gender, place: place.id };
  }
  return out;
}

/** Is this a well-formed stored record? (used when a saved profile comes back from the server or the browser) */
export function validBirth(b) {
  if (!b || typeof b !== 'object' || typeof b.name !== 'string' || nameLetters(b.name).length < 2) return false;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(b.date || ''); if (!m) return false;
  const y = +m[1], mo = +m[2], d = +m[3];
  if (y < 1900 || y > 2100 || mo < 1 || mo > 12 || d < 1 || d > daysInMonth(mo, y)) return false;
  if (!b.unknownTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(b.time || '')) return false;
  return (b.gender === 'M' || b.gender === 'F') && !!placeById(b.place);
}

/** A stored record with everything the calculators need: numbers, the place, and the time zone on that day. */
export function expandBirth(b) {
  const [y, m, d] = b.date.split('-').map(Number);
  const [hour, minute] = b.unknownTime ? [12, 0] : b.time.split(':').map(Number);
  const place = placeById(b.place);
  return { ...b, d, m, y, hour, minute, placeInfo: place, placeName: placeLabel(place), lat: place.lat, lon: place.lon, tz: tzAt(place, y, m, d), style: b.style === 'US' ? 'US' : 'VN' };
}

/** The form values that show a stored record again (for "Edit my details"). */
export function formFromBirth(b) {
  const x = expandBirth(b); const us = x.style === 'US';
  const src = b.cal === 'lunar' && b.lunar ? { day: b.lunar.d, month: b.lunar.m, year: b.lunar.y } : { day: x.d, month: x.m, year: x.y };
  return { name: b.name, style: x.style, day: String(src.day), month: String(src.month), year: String(src.year), cal: b.cal === 'lunar' ? 'lunar' : 'solar', leap: !!(b.lunar && b.lunar.leap),
    hour: b.unknownTime ? '' : String(us ? (x.hour % 12 === 0 ? 12 : x.hour % 12) : x.hour), minute: b.unknownTime ? '' : two(x.minute), ampm: us && !b.unknownTime ? (x.hour < 12 ? 'AM' : 'PM') : '',
    unknownTime: !!b.unknownTime, gender: b.gender, placeId: b.place, placeText: x.placeName };
}

/** The three calculations of one reading. */
export function computeReading(birth, today) {
  const x = expandBirth(birth);
  return { birth: x, num: numerology(x, today), tv: tuVi(x, today), chart: starChart(x) };
}

/** The values the server writes next to each saved reading (one line of data/chiem-tinh.csv). */
export function readingSummary(birth, today) {
  const { birth: x, num, tv, chart } = computeReading(birth, today);
  const L = tv.lunar;
  return { lat: x.lat, lon: x.lon, tz: x.tz, place: x.placeName, lifePath: num.lifePath.label, sunSign: SIGNS[chart.sun.sign], rising: chart.ascSign == null ? '' : SIGNS[chart.ascSign],
    menh: tv.napAmName, lunarDate: `${L.day}/${L.month}${L.leap ? ' (leap)' : ''}/${L.year}` };
}
