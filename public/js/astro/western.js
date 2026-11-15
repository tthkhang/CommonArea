// Western star chart for the Astrology Room — pure functions (checked by tests/astro.test.mjs).
// Tropical zodiac, Placidus houses (Equal houses above 66° of latitude), ten bodies plus the Moon's north node.
// Accuracy: Sun about 0.01°, Moon about 0.05° (main terms of Meeus's lunar theory), planets a few arc-minutes to
// about 0.2° (JPL "Approximate Positions of the Planets", valid 1800–2050). Good enough for signs, houses and aspects.
import { mod, jdFromDate, sunLongitudeRad } from './calendar.js';

const DR = Math.PI / 180; const sin = (d) => Math.sin(d * DR); const cos = (d) => Math.cos(d * DR);
export const SIGNS = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
export const SIGN_GLYPH = ['♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓'];
export const SIGN_ELEMENT = ['Fire', 'Earth', 'Air', 'Water', 'Fire', 'Earth', 'Air', 'Water', 'Fire', 'Earth', 'Air', 'Water'];
export const SIGN_MODALITY = ['Cardinal', 'Fixed', 'Mutable', 'Cardinal', 'Fixed', 'Mutable', 'Cardinal', 'Fixed', 'Mutable', 'Cardinal', 'Fixed', 'Mutable'];
export const BODIES = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];
export const BODY_GLYPH = { Sun: '☉', Moon: '☽', Mercury: '☿', Venus: '♀', Mars: '♂', Jupiter: '♃', Saturn: '♄', Uranus: '♅', Neptune: '♆', Pluto: '♇', Node: '☊' };
export const BODY_NAME = { Sun: 'Sun', Moon: 'Moon', Mercury: 'Mercury', Venus: 'Venus', Mars: 'Mars', Jupiter: 'Jupiter', Saturn: 'Saturn', Uranus: 'Uranus', Neptune: 'Neptune', Pluto: 'Pluto', Node: 'North Node' };
// The five aspects of the spec with their orbs; an aspect that involves the Sun or the Moon gets 2° more.
export const ASPECTS = [['conjunction', 0, 8], ['sextile', 60, 5], ['square', 90, 7], ['trine', 120, 7], ['opposition', 180, 8]];
export const ASPECT_GLYPH = { conjunction: '☌', sextile: '⚹', square: '□', trine: '△', opposition: '☍' };

// Keplerian elements at J2000 and their change per century (JPL, 1800–2050):
// a (au), e, inclination, mean longitude, longitude of perihelion, longitude of ascending node (degrees)
const EL = {
  Mercury: [[0.38709927, 0.20563593, 7.00497902, 252.25032350, 77.45779628, 48.33076593], [0.00000037, 0.00001906, -0.00594749, 149472.67411175, 0.16047689, -0.12534081]],
  Venus: [[0.72333566, 0.00677672, 3.39467605, 181.97909950, 131.60246718, 76.67984255], [0.00000390, -0.00004107, -0.00078890, 58517.81538729, 0.00268329, -0.27769418]],
  Earth: [[1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0.0], [0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0.0]],
  Mars: [[1.52371034, 0.09339410, 1.84969142, -4.55343205, -23.94362959, 49.55953891], [0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088, -0.29257343]],
  Jupiter: [[5.20288700, 0.04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909], [-0.00011607, -0.00013253, -0.00183714, 3034.74612775, 0.21252668, 0.20469106]],
  Saturn: [[9.53667594, 0.05386179, 2.48599187, 49.95424423, 92.59887831, 113.66242448], [-0.00125060, -0.00050991, 0.00193609, 1222.49362201, -0.41897216, -0.28867794]],
  Uranus: [[19.18916464, 0.04725744, 0.77263783, 313.23810451, 170.95427630, 74.01692503], [-0.00196176, -0.00004397, -0.00242939, 428.48202785, 0.40805281, 0.04240589]],
  Neptune: [[30.06992276, 0.00859048, 1.77004347, -55.12002969, 44.96476227, 131.78422574], [0.00026291, 0.00005105, 0.00035372, 218.45945325, -0.32241464, -0.00508664]],
  Pluto: [[39.48211675, 0.24882730, 17.14001206, 238.92903833, 224.06891629, 110.30393684], [-0.00031596, 0.00005170, 0.00004818, 145.20780515, -0.04062942, -0.01183482]],
};
function helio(name, T) { // heliocentric ecliptic x, y, z (J2000)
  const [e0, e1] = EL[name]; const [a, e, I, Lm, wbar, Om] = e0.map((v, i) => v + e1[i] * T);
  const w = (wbar - Om) * DR; let M = mod(Lm - wbar + 180, 360) - 180; M *= DR;
  let E = M + e * Math.sin(M); for (let i = 0; i < 10; i++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  const xp = a * (Math.cos(E) - e); const yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const cw = Math.cos(w), sw = Math.sin(w), cO = Math.cos(Om * DR), sO = Math.sin(Om * DR), cI = Math.cos(I * DR), sI = Math.sin(I * DR);
  return [(cw * cO - sw * sO * cI) * xp + (-sw * cO - cw * sO * cI) * yp, (cw * sO + sw * cO * cI) * xp + (-sw * sO + cw * cO * cI) * yp, sw * sI * xp + cw * sI * yp];
}

// Moon: the largest periodic terms of the longitude (Meeus, Astronomical Algorithms ch. 47): [D, M, M', F, coefficient in 1e-6 degree]
const MOON = [[0, 0, 1, 0, 6288774], [2, 0, -1, 0, 1274027], [2, 0, 0, 0, 658314], [0, 0, 2, 0, 213618], [0, 1, 0, 0, -185116], [0, 0, 0, 2, -114332],
  [2, 0, -2, 0, 58793], [2, -1, -1, 0, 57066], [2, 0, 1, 0, 53322], [2, -1, 0, 0, 45758], [0, 1, -1, 0, -40923], [1, 0, 0, 0, -34720], [0, 1, 1, 0, -30383],
  [2, 0, 0, -2, 15327], [0, 0, 1, 2, -12528], [0, 0, 1, -2, 10980], [4, 0, -1, 0, 10675], [0, 0, 3, 0, 10034], [4, 0, -2, 0, 8548], [2, 1, -1, 0, -7888],
  [2, 1, 0, 0, -6766], [1, 0, -1, 0, -5163], [1, 1, 0, 0, 4987], [2, -1, 1, 0, 4036], [2, 0, 2, 0, 3994], [4, 0, 0, 0, 3861], [2, 0, -3, 0, 3665],
  [0, 1, -2, 0, -2689], [2, 0, -1, 2, -2602], [2, -1, -2, 0, 2390], [1, 0, 1, 0, -2348], [2, -2, 0, 0, 2236], [0, 1, 2, 0, -2120], [0, 2, 0, 0, -2069],
  [2, -2, -1, 0, 2048], [2, 0, 1, -2, -1773], [2, 0, 0, 2, -1595], [4, -1, -1, 0, 1215], [0, 0, 2, 2, -1110], [3, 0, -1, 0, -892], [2, 1, 1, 0, -810],
  [4, -1, -2, 0, 759], [0, 2, -1, 0, -713], [2, 2, -1, 0, -700], [2, 1, -2, 0, 691], [2, -1, 0, -2, 596], [4, 0, 1, 0, 549], [0, 0, 4, 0, 537], [4, -1, 0, 0, 520], [1, 0, -2, 0, -487]];
/** Geocentric longitude of the Moon (degrees) at a Julian date. */
export function moonLongitude(jd) {
  const T = (jd - 2451545) / 36525; const T2 = T * T; const T3 = T2 * T; const T4 = T3 * T;
  const Lp = 218.3164477 + 481267.88123421 * T - 0.0015786 * T2 + T3 / 538841 - T4 / 65194000;
  const D = 297.8501921 + 445267.1114034 * T - 0.0018819 * T2 + T3 / 545868 - T4 / 113065000;
  const M = 357.5291092 + 35999.0502909 * T - 0.0001536 * T2 + T3 / 24490000;
  const Mp = 134.9633964 + 477198.8675055 * T + 0.0087414 * T2 + T3 / 69699 - T4 / 14712000;
  const F = 93.2720950 + 483202.0175233 * T - 0.0036539 * T2 - T3 / 3526000 + T4 / 863310000;
  const E = 1 - 0.002516 * T - 0.0000074 * T2;
  let sum = 0;
  for (const [d, m, mp, f, c] of MOON) sum += c * (m === 0 ? 1 : Math.abs(m) === 1 ? E : E * E) * sin(d * D + m * M + mp * Mp + f * F);
  sum += 3958 * sin(119.75 + 131.849 * T) + 1962 * sin(Lp - F) + 318 * sin(53.09 + 479264.290 * T);
  return mod(Lp + sum / 1e6, 360);
}
/** Mean longitude of the Moon's ascending (north) node. */
export const nodeLongitude = (jd) => { const T = (jd - 2451545) / 36525; return mod(125.0445479 - 1934.1362891 * T + 0.0020754 * T * T + T * T * T / 467441, 360); };

/** Ecliptic longitudes of the date (degrees, 0 = 0° Aries) of the ten bodies and the node at a Julian date (UT). */
export function longitudes(jd) {
  const T = (jd - 2451545) / 36525; const prec = 1.396971 * T + 0.0003086 * T * T; // J2000 ecliptic -> equinox of the date
  const earth = helio('Earth', T);
  const out = { Sun: sunLongitudeRad(jd) / DR, Moon: moonLongitude(jd) };
  for (const name of ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto']) {
    const p = helio(name, T); out[name] = mod(Math.atan2(p[1] - earth[1], p[0] - earth[0]) / DR + prec, 360);
  }
  out.Node = nodeLongitude(jd);
  return out;
}

const obliquity = (T) => 23.439291 - 0.0130042 * T;
/** Local sidereal time in degrees at a Julian date (UT) and an east longitude. */
export function siderealTime(jd, lon) { const d = jd - 2451545; const T = d / 36525; return mod(280.46061837 + 360.98564736629 * d + 0.000387933 * T * T + lon, 360); }
const eclOfRa = (ra, eps) => mod(Math.atan2(sin(ra), cos(ra) * cos(eps)) / DR, 360); // the ecliptic point that has this right ascension
/**
 * Ascendant, midheaven and the 12 house cusps.
 * Placidus: each quadrant's cusps cut the diurnal / nocturnal semi-arc of their own degree into thirds (solved by iteration).
 */
export function houses(jd, lat, lon) {
  const T = (jd - 2451545) / 36525; const eps = obliquity(T); const ramc = siderealTime(jd, lon);
  const mc = eclOfRa(ramc, eps);
  let asc = mod(Math.atan2(cos(ramc), -(sin(ramc) * cos(eps) + Math.tan(lat * DR) * sin(eps))) / DR, 360);
  if (mod(asc - mc, 360) > 180) asc = mod(asc + 180, 360); // the ascendant is the eastern point: always less than 180° after the midheaven
  const cusps = new Array(12);
  let system = 'Placidus';
  if (Math.abs(lat) > 66) { system = 'Equal'; for (let i = 0; i < 12; i++) cusps[i] = mod(asc + 30 * i, 360); }
  else {
    const solve = (f, below) => { // f = 1/3 or 2/3 of a semi-arc, measured from the MC (above the horizon) or from the IC (below)
      let ra = below ? ramc + 180 - f * 90 : ramc + f * 90; let lam = 0;
      for (let i = 0; i < 40; i++) {
        lam = eclOfRa(ra, eps);
        const dec = Math.asin(sin(eps) * sin(lam)) / DR;
        const ad = Math.asin(Math.max(-1, Math.min(1, Math.tan(lat * DR) * Math.tan(dec * DR)))) / DR; // ascensional difference
        const next = below ? ramc + 180 - f * (90 - ad) : ramc + f * (90 + ad);
        if (Math.abs(next - ra) < 1e-7) { ra = next; break; }
        ra = next;
      }
      return eclOfRa(ra, eps);
    };
    cusps[0] = asc; cusps[9] = mc; cusps[10] = solve(1 / 3, false); cusps[11] = solve(2 / 3, false); cusps[1] = solve(2 / 3, true); cusps[2] = solve(1 / 3, true);
    cusps[3] = mod(mc + 180, 360); cusps[6] = mod(asc + 180, 360); cusps[4] = mod(cusps[10] + 180, 360); cusps[5] = mod(cusps[11] + 180, 360); cusps[7] = mod(cusps[1] + 180, 360); cusps[8] = mod(cusps[2] + 180, 360);
  }
  return { asc, mc, cusps, system };
}
/** Which house (1–12) a longitude falls in. */
export function houseOf(lon, cusps) {
  for (let i = 0; i < 12; i++) { const a = cusps[i]; const span = mod(cusps[(i + 1) % 12] - a, 360); if (mod(lon - a, 360) < span) return i + 1; }
  return 1;
}

/** Julian date (UT) of a local date and time. tz = hours east of UTC. */
export const julianDate = ({ d, m, y, hour = 12, minute = 0, tz = 7 }) => jdFromDate(d, m, y) - 0.5 + (hour + minute / 60 - tz) / 24;

/**
 * The chart.
 * birth: { d, m, y, hour, minute, tz, lat, lon, unknownTime }
 * With an unknown birth time the chart is cast for 12:00 and has no ascendant, houses or planets in houses.
 */
export function starChart(birth) {
  const unknown = !!birth.unknownTime;
  const jd = julianDate(unknown ? { ...birth, hour: 12, minute: 0 } : birth);
  const now = longitudes(jd); const before = longitudes(jd - 0.5); const after = longitudes(jd + 0.5);
  const H = unknown ? null : houses(jd, birth.lat, birth.lon);
  const point = (name) => {
    const lon = now[name]; const sign = Math.floor(lon / 30); const inSign = lon - sign * 30;
    const speed = mod(after[name] - before[name] + 180, 360) - 180;
    return { name, lon, sign, deg: Math.floor(inSign), min: Math.floor((inSign % 1) * 60), retro: !['Sun', 'Moon', 'Node'].includes(name) && speed < 0, house: H ? houseOf(lon, H.cusps) : null };
  };
  const bodies = BODIES.map(point); const node = point('Node');
  // aspects between the ten bodies, strongest (smallest share of the allowed orb) first
  const aspects = [];
  for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) {
    const sep = Math.abs(mod(bodies[i].lon - bodies[j].lon + 180, 360) - 180);
    for (const [type, angle, orb0] of ASPECTS) {
      const orb = orb0 + (i <= 1 ? 2 : 0); const off = Math.abs(sep - angle);
      if (off <= orb) { aspects.push({ a: bodies[i].name, b: bodies[j].name, type, angle, orb: off, strength: 1 - off / orb }); break; }
    }
  }
  aspects.sort((p, q) => q.strength - p.strength);
  // balance of elements and modalities over the ten bodies
  const elements = { Fire: 0, Earth: 0, Air: 0, Water: 0 }; const modalities = { Cardinal: 0, Fixed: 0, Mutable: 0 };
  for (const b of bodies) { elements[SIGN_ELEMENT[b.sign]]++; modalities[SIGN_MODALITY[b.sign]]++; }
  const sgn = (lon) => Math.floor(mod(lon, 360) / 30);
  return { jd, unknownTime: unknown, bodies, node, sun: bodies[0], moon: bodies[1], aspects, elements, modalities,
    asc: H ? H.asc : null, mc: H ? H.mc : null, ascSign: H ? sgn(H.asc) : null, mcSign: H ? sgn(H.mc) : null, cusps: H ? H.cusps : null, houseSystem: H ? H.system : null };
}
/** "22°14′ Leo" */
export const formatLon = (lon) => { const s = Math.floor(mod(lon, 360) / 30); const x = mod(lon, 30); return `${Math.floor(x)}°${String(Math.floor((x % 1) * 60)).padStart(2, '0')}′ ${SIGNS[s]}`; };
