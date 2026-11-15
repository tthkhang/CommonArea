// Birth places for the Astrology Room form: the 63 provinces and cities of Vietnam plus 130 cities of the world.
// A place: { id, name, country, lat, lon, tz, dst } — tz = standard hours east of UTC, dst = daylight-saving rule
// ('US', 'EU', 'AU', 'NZ' or none). Coordinates are those of the main city, rounded to about a kilometre.
// Search ignores accents and case: "ha noi" finds Hà Nội.
import { plain } from './numerology.js';
import { weekday, daysInMonth } from './calendar.js';

// name | lat | lon | other names people type
const VIETNAM = `Hà Nội|21.03|105.85|hanoi
TP. Hồ Chí Minh|10.78|106.70|sai gon saigon ho chi minh hcm tphcm
Hải Phòng|20.86|106.68|
Đà Nẵng|16.05|108.21|danang
Cần Thơ|10.03|105.78|
Hà Giang|22.82|104.98|
Cao Bằng|22.67|106.26|
Bắc Kạn|22.15|105.83|
Tuyên Quang|21.82|105.21|
Lào Cai|22.49|103.97|sa pa sapa
Điện Biên|21.39|103.02|dien bien phu
Lai Châu|22.40|103.46|
Sơn La|21.33|103.91|
Yên Bái|21.72|104.91|
Hòa Bình|20.82|105.34|
Thái Nguyên|21.59|105.85|
Lạng Sơn|21.85|106.76|
Quảng Ninh|20.95|107.08|ha long
Bắc Giang|21.27|106.19|
Phú Thọ|21.32|105.40|viet tri
Vĩnh Phúc|21.31|105.60|vinh yen
Bắc Ninh|21.19|106.07|
Hải Dương|20.94|106.33|
Hưng Yên|20.65|106.05|
Thái Bình|20.45|106.34|
Hà Nam|20.54|105.91|phu ly
Nam Định|20.43|106.16|
Ninh Bình|20.25|105.97|
Thanh Hóa|19.81|105.78|
Nghệ An|18.68|105.68|vinh
Hà Tĩnh|18.34|105.91|
Quảng Bình|17.47|106.60|dong hoi
Quảng Trị|16.82|107.10|dong ha
Thừa Thiên Huế|16.46|107.59|hue
Quảng Nam|15.57|108.47|tam ky hoi an
Quảng Ngãi|15.12|108.80|
Bình Định|13.78|109.22|quy nhon
Phú Yên|13.09|109.30|tuy hoa
Khánh Hòa|12.24|109.19|nha trang
Ninh Thuận|11.57|108.99|phan rang
Bình Thuận|10.93|108.10|phan thiet
Kon Tum|14.35|108.00|
Gia Lai|13.98|108.00|pleiku
Đắk Lắk|12.67|108.04|buon ma thuot dak lak
Đắk Nông|12.00|107.69|gia nghia dak nong
Lâm Đồng|11.94|108.44|da lat dalat
Bình Phước|11.54|106.89|dong xoai
Tây Ninh|11.31|106.10|
Bình Dương|10.98|106.65|thu dau mot
Đồng Nai|10.95|106.82|bien hoa
Bà Rịa – Vũng Tàu|10.35|107.08|vung tau ba ria
Long An|10.54|106.41|tan an
Tiền Giang|10.36|106.36|my tho
Bến Tre|10.24|106.38|
Trà Vinh|9.93|106.34|
Vĩnh Long|10.25|105.97|
Đồng Tháp|10.46|105.63|cao lanh
An Giang|10.39|105.44|long xuyen chau doc
Kiên Giang|10.01|105.08|rach gia phu quoc
Hậu Giang|9.78|105.47|vi thanh
Sóc Trăng|9.60|105.97|
Bạc Liêu|9.29|105.72|
Cà Mau|9.18|105.15|`;

// name | country | lat | lon | tz | dst rule | other names
const WORLD = `Bangkok|Thailand|13.75|100.50|7||
Vientiane|Laos|17.97|102.63|7||
Phnom Penh|Cambodia|11.56|104.92|7||
Singapore|Singapore|1.35|103.82|8||
Kuala Lumpur|Malaysia|3.14|101.69|8||
Jakarta|Indonesia|-6.21|106.85|7||
Bali|Indonesia|-8.65|115.22|8||denpasar
Manila|Philippines|14.60|120.98|8||
Cebu|Philippines|10.32|123.89|8||
Davao|Philippines|7.07|125.61|8||
Yangon|Myanmar|16.87|96.20|6.5||rangoon
Hong Kong|Hong Kong|22.32|114.17|8||
Macau|Macau|22.20|113.54|8||
Taipei|Taiwan|25.03|121.57|8||
Kaohsiung|Taiwan|22.63|120.30|8||
Beijing|China|39.90|116.41|8||
Shanghai|China|31.23|121.47|8||
Guangzhou|China|23.13|113.26|8||
Shenzhen|China|22.54|114.06|8||
Chengdu|China|30.57|104.07|8||
Kunming|China|25.04|102.71|8||
Nanning|China|22.82|108.32|8||
Tokyo|Japan|35.68|139.69|9||
Osaka|Japan|34.69|135.50|9||
Kyoto|Japan|35.01|135.77|9||
Nagoya|Japan|35.18|136.91|9||
Fukuoka|Japan|33.59|130.40|9||
Sapporo|Japan|43.06|141.35|9||
Seoul|South Korea|37.57|126.98|9||
Busan|South Korea|35.18|129.08|9||
Incheon|South Korea|37.46|126.71|9||
Ulaanbaatar|Mongolia|47.89|106.91|8||
New Delhi|India|28.61|77.21|5.5||delhi
Mumbai|India|19.08|72.88|5.5||bombay
Bengaluru|India|12.97|77.59|5.5||bangalore
Kolkata|India|22.57|88.36|5.5||calcutta
Chennai|India|13.08|80.27|5.5||madras
Dhaka|Bangladesh|23.81|90.41|6||
Kathmandu|Nepal|27.72|85.32|5.75||
Colombo|Sri Lanka|6.93|79.86|5.5||
Karachi|Pakistan|24.86|67.01|5||
Tashkent|Uzbekistan|41.30|69.24|5||
Almaty|Kazakhstan|43.24|76.89|6||
Dubai|United Arab Emirates|25.20|55.27|4||
Doha|Qatar|25.29|51.53|3||
Riyadh|Saudi Arabia|24.71|46.68|3||
Tehran|Iran|35.69|51.39|3.5||
Istanbul|Türkiye|41.01|28.98|2|EU|
Tel Aviv|Israel|32.09|34.78|2|EU|
Sydney|Australia|-33.87|151.21|10|AU|
Melbourne|Australia|-37.81|144.96|10|AU|
Canberra|Australia|-35.28|149.13|10|AU|
Adelaide|Australia|-34.93|138.60|9.5|AU|
Brisbane|Australia|-27.47|153.03|10||
Perth|Australia|-31.95|115.86|8||
Auckland|New Zealand|-36.85|174.76|12|NZ|
Wellington|New Zealand|-41.29|174.78|12|NZ|
London|United Kingdom|51.51|-0.13|0|EU|
Manchester|United Kingdom|53.48|-2.24|0|EU|
Edinburgh|United Kingdom|55.95|-3.19|0|EU|
Dublin|Ireland|53.35|-6.26|0|EU|
Lisbon|Portugal|38.72|-9.14|0|EU|
Reykjavik|Iceland|64.15|-21.94|0||
Paris|France|48.86|2.35|1|EU|
Lyon|France|45.76|4.84|1|EU|
Marseille|France|43.30|5.37|1|EU|
Berlin|Germany|52.52|13.40|1|EU|
Munich|Germany|48.14|11.58|1|EU|
Frankfurt|Germany|50.11|8.68|1|EU|
Hamburg|Germany|53.55|9.99|1|EU|
Amsterdam|Netherlands|52.37|4.90|1|EU|
Brussels|Belgium|50.85|4.35|1|EU|
Zurich|Switzerland|47.38|8.54|1|EU|
Geneva|Switzerland|46.20|6.14|1|EU|
Vienna|Austria|48.21|16.37|1|EU|
Prague|Czechia|50.08|14.44|1|EU|
Warsaw|Poland|52.23|21.01|1|EU|
Budapest|Hungary|47.50|19.04|1|EU|
Rome|Italy|41.90|12.50|1|EU|
Milan|Italy|45.46|9.19|1|EU|
Madrid|Spain|40.42|-3.70|1|EU|
Barcelona|Spain|41.39|2.17|1|EU|
Stockholm|Sweden|59.33|18.07|1|EU|
Oslo|Norway|59.91|10.75|1|EU|
Tromsø|Norway|69.65|18.96|1|EU|tromso
Copenhagen|Denmark|55.68|12.57|1|EU|
Helsinki|Finland|60.17|24.94|2|EU|
Athens|Greece|37.98|23.73|2|EU|
Kyiv|Ukraine|50.45|30.52|2|EU|kiev
Moscow|Russia|55.76|37.62|3||
Saint Petersburg|Russia|59.93|30.36|3||st petersburg
New York|United States|40.71|-74.01|-5|US|nyc
Washington, D.C.|United States|38.91|-77.04|-5|US|washington dc
Boston|United States|42.36|-71.06|-5|US|
Philadelphia|United States|39.95|-75.17|-5|US|
Atlanta|United States|33.75|-84.39|-5|US|
Miami|United States|25.76|-80.19|-5|US|
Orlando|United States|28.54|-81.38|-5|US|
Chicago|United States|41.88|-87.63|-6|US|
Houston|United States|29.76|-95.37|-6|US|
Dallas|United States|32.78|-96.80|-6|US|
New Orleans|United States|29.95|-90.07|-6|US|
Minneapolis|United States|44.98|-93.27|-6|US|
Denver|United States|39.74|-104.99|-7|US|
Phoenix|United States|33.45|-112.07|-7||
Las Vegas|United States|36.17|-115.14|-8|US|
Los Angeles|United States|34.05|-118.24|-8|US|la
Orange County|United States|33.75|-117.87|-8|US|westminster garden grove little saigon santa ana
San Diego|United States|32.72|-117.16|-8|US|
San Jose|United States|37.34|-121.89|-8|US|
San Francisco|United States|37.77|-122.42|-8|US|
Portland|United States|45.52|-122.68|-8|US|
Seattle|United States|47.61|-122.33|-8|US|
Honolulu|United States|21.31|-157.86|-10||hawaii
Toronto|Canada|43.65|-79.38|-5|US|
Ottawa|Canada|45.42|-75.70|-5|US|
Montreal|Canada|45.50|-73.57|-5|US|
Calgary|Canada|51.05|-114.07|-7|US|
Vancouver|Canada|49.28|-123.12|-8|US|
Mexico City|Mexico|19.43|-99.13|-6||
Havana|Cuba|23.11|-82.37|-5||
Bogotá|Colombia|4.71|-74.07|-5||bogota
Lima|Peru|-12.05|-77.04|-5||
Santiago|Chile|-33.45|-70.67|-4||
Buenos Aires|Argentina|-34.60|-58.38|-3||
São Paulo|Brazil|-23.55|-46.63|-3||sao paulo
Rio de Janeiro|Brazil|-22.91|-43.17|-3||
Cairo|Egypt|30.04|31.24|2||
Casablanca|Morocco|33.57|-7.59|1||
Lagos|Nigeria|6.52|3.38|1||
Accra|Ghana|5.60|-0.19|0||
Addis Ababa|Ethiopia|9.03|38.74|3||
Nairobi|Kenya|-1.29|36.82|3||
Johannesburg|South Africa|-26.20|28.05|2||
Cape Town|South Africa|-33.92|18.42|2||`;

const slug = (s) => plain(s).replace(/[^a-z0-9]+/g, ' ').trim();
export const PLACES = [
  ...VIETNAM.split('\n').map((line) => { const [name, lat, lon, alias] = line.split('|'); return { id: 'vn-' + slug(name).replace(/ /g, '-'), name, country: 'Vietnam', lat: +lat, lon: +lon, tz: 7, dst: '', key: slug(name) + ' ' + (alias || '') }; }),
  ...WORLD.split('\n').map((line) => { const [name, country, lat, lon, tz, dst, alias] = line.split('|'); return { id: slug(name).replace(/ /g, '-'), name, country, lat: +lat, lon: +lon, tz: +tz, dst: dst || '', key: slug(name) + ' ' + slug(country) + ' ' + (alias || '') }; }),
];
const BY_ID = new Map(PLACES.map((p) => [p.id, p]));
export const placeById = (id) => BY_ID.get(id) || null;
export const placeLabel = (p) => (p.country === 'Vietnam' ? p.name : `${p.name}, ${p.country}`);
/** Places whose name (or another name people use) matches what was typed; names that START with the text come first. */
export function searchPlaces(text, limit = 8) {
  const q = slug(text); if (!q) return [];
  const starts = []; const inside = [];
  for (const p of PLACES) {
    if (p.key.startsWith(q)) starts.push(p);
    else if ((' ' + p.key).includes(' ' + q)) inside.push(p);
    else if (p.key.includes(q)) inside.push(p);
  }
  return starts.concat(inside).slice(0, limit);
}
/** The place whose label or name is exactly what was typed (accents and case ignored), or null. */
export function matchPlace(text) {
  const q = slug(text); if (!q) return null;
  return PLACES.find((p) => slug(placeLabel(p)) === q || slug(p.name) === q) || null;
}
/** People born here usually write dates month/day/year (the form then offers the US style). */
export const usesMonthFirst = (p) => !!p && (p.country === 'United States' || p.country === 'Philippines');

// ---- daylight saving time, by simple rules that cover the years most players were born in ----
const nthSunday = (y, m, n) => { const first = 1 + ((7 - weekday(1, m, y)) % 7); return first + 7 * (n - 1); };
const lastSunday = (y, m) => { const last = daysInMonth(m, y); return last - weekday(last, m, y); };
const between = (m, d, m1, d1, m2, d2) => (m > m1 || (m === m1 && d >= d1)) && (m < m2 || (m === m2 && d < d2));
/** Is daylight saving time in force at this place on this local date? */
export function dstActive(rule, y, m, d) {
  if (rule === 'US') {
    if (y >= 2007) return between(m, d, 3, nthSunday(y, 3, 2), 11, nthSunday(y, 11, 1));
    if (y >= 1987) return between(m, d, 4, nthSunday(y, 4, 1), 10, lastSunday(y, 10));
    return y >= 1967 && between(m, d, 4, lastSunday(y, 4), 10, lastSunday(y, 10));
  }
  if (rule === 'EU') {
    if (y >= 1996) return between(m, d, 3, lastSunday(y, 3), 10, lastSunday(y, 10));
    return y >= 1981 && between(m, d, 3, lastSunday(y, 3), 9, lastSunday(y, 9));
  }
  if (rule === 'AU') { // southern summer: on from October to the following April
    if (y >= 2008) return !between(m, d, 4, nthSunday(y, 4, 1), 10, nthSunday(y, 10, 1));
    return y >= 1987 && !between(m, d, 3, lastSunday(y, 3), 10, lastSunday(y, 10));
  }
  if (rule === 'NZ') {
    if (y >= 2007) return !between(m, d, 4, nthSunday(y, 4, 1), 9, lastSunday(y, 9));
    return y >= 1990 && !between(m, d, 3, nthSunday(y, 3, 3), 10, nthSunday(y, 10, 1));
  }
  return false;
}
/** Hours east of UTC at a place on a local date (standard time plus daylight saving when it applies). */
export const tzAt = (place, y, m, d) => place.tz + (dstActive(place.dst, y, m, d) ? 1 : 0);
export const formatTz = (tz) => { const a = Math.abs(tz); const h = Math.floor(a); const mi = Math.round((a - h) * 60); return `UTC${tz < 0 ? '−' : '+'}${h}${mi ? ':' + String(mi).padStart(2, '0') : ''}`; };
