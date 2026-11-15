// Astrology Room, client half (spec: "Phòng Chiêm tinh"). Touch Madame Star or one of the three doors:
//   no profile yet  ->  the birth form (one form for Numerology, Tử Vi and the Star Chart; Vietnam or US date style)
//   profile saved   ->  the reading board opens straight away, on the tab of the door you touched
// The calculations are in ../astro/, the texts in ../text/, the assembled reading in ../astro/report.js.
// The server half (shared/roomplugins.js AstrologyRoom) keeps one profile per player name and adds a line to
// data/chiem-tinh.csv each time "See my chart" is pressed.
import * as THREE from 'three';
import { BAN_DO } from '../logic.js';
import { el, esc } from '../util.js';
import { STYLES, checkForm, formFromBirth, parsePastedDate, validBirth } from '../astro/birth.js';
import { searchPlaces, placeById, placeLabel, matchPlace } from '../astro/places.js';
import { buildReading, readingFile, READING_CSS } from '../astro/report.js';

const DOORS = { 'cua-than-so': ['num', '🔢 Numerology'], 'cua-tu-vi': ['tuvi', '🏮 Tử Vi'], 'cua-ban-do-sao': ['chart', '✨ Star Chart'] };
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem('top1server-astro-' + k)); } catch { return null; } },
  set(k, v) { try { if (v == null) localStorage.removeItem('top1server-astro-' + k); else localStorage.setItem('top1server-astro-' + k, JSON.stringify(v)); } catch { /* storage blocked: nothing is remembered */ } },
};
const keyOf = (name) => String(name || '').normalize('NFC').trim().toLowerCase();

export default {
  id: 'chiem-tinh',

  setup(ctx) {
    const { room, net, ui, me, world, modal, scene, music, state } = ctx;
    document.head.append(el('style', { text: READING_CSS }));
    const doors = BAN_DO.vat.filter((v) => DOORS[v.id]);
    const npc = BAN_DO.vat.find((v) => v.id === 'ba-dong');
    const nearDoor = (p) => doors.find((v) => Math.hypot(p.x - v.x, p.z - v.z) < 4.2);
    const nearNpc = (p) => Math.hypot(p.x - npc.x, p.z - npc.z) < 3.4;
    const myKey = () => keyOf(me()?.name);

    let profile = null;   // the saved birth record of this player name (from the server, or from this browser in solo mode)
    let unsaved = null;   // why the last reading is not saved yet: 'offline' | 'solo' | null
    let waiting = null;   // { birth, timer } while a save is on its way

    // ---------------------------------------------------------------- the 3D moment: crystal balls light up, the zodiac ring spins once
    const glows = BAN_DO.vat.filter((v) => v.id.startsWith('cau-pha-le')).map((v) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.75, 20, 14), new THREE.MeshBasicMaterial({ color: '#CFF3FF', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
      m.position.set(v.x, 1.5, v.z); scene.add(m); world.themVaoPhong(room.id, m); return m;
    });
    let fx = 0; // seconds left of the effect
    const FX = 1.4;
    function playEffect(then) { fx = FX; setTimeout(then, FX * 1000); }

    // ---------------------------------------------------------------- talking to the server half
    net.on(`${room.id}.profile`, (m) => {
      profile = validBirth(m.birth) ? m.birth : null;
      const pend = store.get('pending:' + myKey());
      if (pend && validBirth(pend) && net.mode === 'server') { waiting = { birth: pend, timer: 0 }; net.send({ type: `${room.id}.save`, birth: pend }); } // saved exactly once when the connection is back
    });
    net.on(`${room.id}.saved`, (m) => {
      if (!m.ok) { ui.toast(m.msg || 'The server could not save your details.', 'error'); return; }
      if (waiting) clearTimeout(waiting.timer); waiting = null;
      profile = m.birth; store.set('pending:' + myKey(), null);
      unsaved = net.mode === 'solo' ? 'solo' : null; showStrip();
    });
    net.on('_closed', () => { if (waiting) markOffline(); });
    function markOffline() { if (!waiting) return; clearTimeout(waiting.timer); store.set('pending:' + myKey(), waiting.birth); waiting = null; unsaved = 'offline'; showStrip(); }
    function save(birth) {
      profile = birth;
      waiting = { birth, timer: setTimeout(markOffline, 4000) };
      net.send({ type: `${room.id}.save`, birth });
    }
    let strip = null;
    function showStrip() {
      if (!strip) return;
      strip.hidden = !unsaved;
      strip.textContent = unsaved === 'offline' ? 'Not saved yet. Your reading was worked out on this computer; it will be saved by itself when the connection is back.'
        : 'Solo mode: your details are remembered in this browser only. The game server is needed to save your profile to the class file.';
    }

    // ---------------------------------------------------------------- the birth form
    function openForm(tab, old) {
      const body = modal.open('🔮 Tell Madame Star when you were born', { wide: true });
      const saved = old ? formFromBirth(old) : null;
      const f = saved || { name: '', style: store.get('style:' + myKey()) === 'US' ? 'US' : 'VN', day: '', month: '', year: '', cal: 'solar', leap: false, hour: '', minute: '', ampm: '', unknownTime: false, gender: '', placeId: '', placeText: '' };
      if (!saved && f.style === 'US') f.ampm = 'AM';
      let tried = false; const touched = new Set(saved ? ['name', 'date', 'time', 'place'] : []);

      const input = (props) => { const n = el('input', { type: 'text', autocomplete: 'off', spellcheck: 'false', ...props }); n.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); go.click(); } if (e.key === 'Escape') modal.close(); }); return n; };
      const seg = (options, get, set) => { // a row of toggle buttons
        const box = el('div', { class: 'bf-seg' });
        const draw = () => box.replaceChildren(...options.map(([v, label]) => el('button', { type: 'button', class: get() === v ? 'on' : '', 'aria-pressed': String(get() === v), text: label, onclick: () => { set(v); draw(); refresh(); } })));
        draw(); return Object.assign(box, { draw });
      };
      const err = (k) => el('div', { class: 'bf-err', 'data-k': k, hidden: true });

      // -- name
      const name = input({ maxlength: 60, placeholder: 'For example: Nguyễn Minh Anh', value: f.name, class: 'bf-wide' });
      name.addEventListener('input', () => { f.name = name.value; touched.add('name'); refresh(); });
      // -- date style + the three date boxes (their order follows the style)
      const boxes = { day: input({ inputmode: 'numeric', maxlength: 10, class: 'bf-num' }), month: input({ inputmode: 'numeric', maxlength: 10, class: 'bf-num' }), year: input({ inputmode: 'numeric', maxlength: 10, class: 'bf-num bf-year' }) };
      for (const k of Object.keys(boxes)) {
        boxes[k].value = f[k];
        boxes[k].addEventListener('input', () => { f[k] = boxes[k].value.trim(); touched.add('date'); refresh(); });
        boxes[k].addEventListener('paste', (e) => { // a whole date pasted into a box fills all three
          const d = parsePastedDate((e.clipboardData || window.clipboardData).getData('text'), f.style); if (!d) return;
          e.preventDefault(); f.day = String(d.day); f.month = String(d.month); f.year = String(d.year); for (const q of Object.keys(boxes)) boxes[q].value = f[q]; touched.add('date'); refresh();
        });
      }
      const dateRow = el('div', { class: 'bf-date' });
      const layDate = () => { // same date, boxes in the order of the chosen style
        const S = STYLES[f.style]; dateRow.replaceChildren();
        S.order.forEach((k, i) => { boxes[k].placeholder = S.hint[i]; boxes[k].setAttribute('aria-label', k); if (i) dateRow.append(el('span', { text: '/' })); dateRow.append(boxes[k]); });
      };
      const styleSeg = seg(Object.entries(STYLES).map(([k, S]) => [k, `${S.flag} ${S.label}: ${S.words}`]), () => f.style, (v) => {
        if (v === f.style) return;
        // A valid date stays the same date and only the boxes change places. A date that cannot exist because the
        // "month" is over 12 was typed in the other style, so what was typed stays where it is and is read the other way round.
        const dn = Number(f.day); const mn = Number(f.month);
        if (mn > 12 && dn >= 1 && dn <= 12) { [f.day, f.month] = [f.month, f.day]; boxes.day.value = f.day; boxes.month.value = f.month; }
        f.style = v; store.set('style:' + myKey(), v); layDate();
        const h = Number(f.hour); // the US style starts on the 12-hour clock, the Vietnam style on the 24-hour clock; the time itself stays the same
        if (v === 'US' && !f.ampm) { f.ampm = h >= 12 ? 'PM' : 'AM'; if (f.hour !== '' && !Number.isNaN(h) && h <= 23) f.hour = String(h % 12 === 0 ? 12 : h % 12); }
        if (v === 'VN' && f.ampm) { if (f.hour !== '' && !Number.isNaN(h) && h >= 1 && h <= 12) f.hour = String((h % 12) + (f.ampm === 'PM' ? 12 : 0)); f.ampm = ''; }
        hour.value = f.hour; clock.checked = !!f.ampm; ampm.draw();
      });
      const calSeg = seg([['solar', 'Solar calendar'], ['lunar', 'Lunar calendar']], () => f.cal, (v) => { f.cal = v; if (v === 'solar') { f.leap = false; leap.checked = false; } });
      const leap = el('input', { type: 'checkbox' }); leap.checked = f.leap; leap.addEventListener('change', () => { f.leap = leap.checked; refresh(); });
      const leapLabel = el('label', { class: 'bf-check' }, leap, 'Leap month');
      const confirm = el('div', { class: 'bf-confirm', hidden: true });
      const swap = el('button', { type: 'button', class: 'bf-link', hidden: true, onclick: () => { styleSeg.querySelector('button:not(.on)').click(); } });
      // -- time
      const hour = input({ inputmode: 'numeric', maxlength: 2, class: 'bf-num', placeholder: 'hh', 'aria-label': 'hour', value: f.hour });
      const minute = input({ inputmode: 'numeric', maxlength: 2, class: 'bf-num', placeholder: 'mm', 'aria-label': 'minute', value: f.minute });
      hour.addEventListener('input', () => { f.hour = hour.value.trim(); touched.add('time'); refresh(); }); minute.addEventListener('input', () => { f.minute = minute.value.trim(); touched.add('time'); refresh(); });
      const ampm = seg([['AM', 'AM'], ['PM', 'PM']], () => f.ampm, (v) => { f.ampm = v; });
      const clock = el('input', { type: 'checkbox' }); clock.checked = !!f.ampm;
      clock.addEventListener('change', () => { const h = Number(f.hour);
        if (clock.checked) { f.ampm = h >= 12 ? 'PM' : 'AM'; if (f.hour !== '' && !Number.isNaN(h) && h <= 23) f.hour = String(h % 12 === 0 ? 12 : h % 12); }
        else { if (f.hour !== '' && !Number.isNaN(h) && h >= 1 && h <= 12) f.hour = String((h % 12) + (f.ampm === 'PM' ? 12 : 0)); f.ampm = ''; }
        hour.value = f.hour; ampm.draw(); refresh(); });
      const unknown = el('input', { type: 'checkbox' }); unknown.checked = f.unknownTime; unknown.addEventListener('change', () => { f.unknownTime = unknown.checked; refresh(); });
      const unknownNote = el('div', { class: 'bf-note', hidden: true, text: 'Tử Vi will use the Tý hour for now, and the Star Chart will hide the rising sign and the 12 houses.' });
      const timeRow = el('div', { class: 'bf-time' }, hour, el('span', { text: ':' }), minute, ampm, el('label', { class: 'bf-check' }, clock, '12-hour clock (AM / PM)'));
      // -- gender, place
      const genderSeg = seg([['F', 'Female'], ['M', 'Male']], () => f.gender, (v) => { f.gender = v; });
      const place = input({ maxlength: 60, placeholder: 'Type to search: ha noi, da nang, tokyo…', value: f.placeText || '', class: 'bf-wide', role: 'combobox', 'aria-autocomplete': 'list' });
      const sugg = el('div', { class: 'bf-sugg', hidden: true });
      const pick = (p) => { f.placeId = p.id; f.placeText = placeLabel(p); place.value = f.placeText; sugg.hidden = true; touched.add('place'); refresh(); };
      place.addEventListener('input', () => {
        f.placeText = place.value; const exact = matchPlace(place.value); f.placeId = exact ? exact.id : '';
        const found = searchPlaces(place.value, 7);
        sugg.replaceChildren(...found.map((p) => el('button', { type: 'button', text: placeLabel(p), onmousedown: (e) => { e.preventDefault(); pick(p); } })));
        sugg.hidden = !found.length || !!exact; refresh();
      });
      place.addEventListener('blur', () => { setTimeout(() => { sugg.hidden = true; touched.add('place'); refresh(); }, 120); });
      place.addEventListener('keydown', (e) => { if (e.key === 'ArrowDown' && sugg.firstChild) { e.preventDefault(); pick(searchPlaces(place.value, 1)[0]); } });
      const suggestUS = el('button', { type: 'button', class: 'bf-link', hidden: true, text: 'Would you like to type the date in the US style (month / day / year)?', onclick: () => { if (f.style !== 'US') styleSeg.querySelector('button:not(.on)').click(); } });
      // -- submit
      const go = el('button', { class: 'nut vang bf-go', text: 'See my chart ✨' });
      const errs = { name: err('name'), date: err('date'), time: err('time'), place: err('place'), gender: err('gender') };
      const field = (label, hint, ...kids) => el('div', { class: 'bf-field' }, el('div', { class: 'bf-label' }, el('b', { text: label }), hint ? el('span', { text: hint }) : null), ...kids);
      body.append(el('div', { class: 'bf' },
        el('p', { class: 'bf-intro', text: 'One form for all three readings. Your details are used only to work out your reading and to save it under your character name.' }),
        field('Full birth name', 'with accents, exactly as on your birth certificate · used for Numerology', name, errs.name),
        field('Date style', 'how you like to write dates', styleSeg),
        field('Birth date', '', el('div', { class: 'bf-row' }, dateRow, calSeg, leapLabel), confirm, errs.date, swap),
        field('Birth time', 'used for Tử Vi and the Star Chart', timeRow, el('label', { class: 'bf-check' }, unknown, 'I do not remember my birth time'), unknownNote, errs.time),
        field('Gender', 'Tử Vi needs it for the direction of the ten-year periods', genderSeg, errs.gender),
        field('Birth place', '63 provinces of Vietnam and 130 world cities', el('div', { class: 'bf-place' }, place, sugg), errs.place, suggestUS),
        el('div', { class: 'bf-foot' }, go, el('span', { class: 'meta', text: 'For reference and entertainment only.' }))));
      layDate();

      function refresh() {
        const r = checkForm(f);
        const show = (k) => tried || touched.has(k);
        for (const k of Object.keys(errs)) {
          let msg = r.errors[k] || '';
          if (!msg && tried && r.missing.includes(k)) msg = { name: 'Please enter your full birth name.', date: 'Please enter your birth date.', time: 'Please enter your birth time, or tick "I do not remember".', gender: 'Please choose one.', place: 'Please choose your birth place.' }[k];
          errs[k].textContent = msg; errs[k].hidden = !msg || !show(k);
        }
        confirm.textContent = r.confirm; confirm.hidden = !r.confirm || !!r.errors.date;
        swap.hidden = !r.swap; swap.textContent = `Switch to the ${STYLES[f.style === 'US' ? 'VN' : 'US'].label} style (${STYLES[f.style === 'US' ? 'VN' : 'US'].words})`;
        leapLabel.hidden = f.cal !== 'lunar'; ampm.hidden = !f.ampm;
        hour.disabled = minute.disabled = f.unknownTime; timeRow.classList.toggle('off', f.unknownTime); unknownNote.hidden = !f.unknownTime;
        suggestUS.hidden = !r.suggestUS;
        go.classList.toggle('mo', !r.birth); go.setAttribute('aria-disabled', String(!r.birth)); // dimmed while incomplete; a click then shows what is missing
        return r;
      }
      go.addEventListener('click', () => {
        tried = true; const r = refresh();
        if (!r.birth) { body.querySelector('.bf-err:not([hidden])')?.scrollIntoView({ block: 'center', behavior: 'smooth' }); return; }
        store.set('style:' + myKey(), f.style);
        save(r.birth); modal.close();
        playEffect(() => openBoard(tab || 'num', true));
      });
      refresh(); setTimeout(() => (saved ? go : name).focus(), 60);
    }

    // ---------------------------------------------------------------- the reading board (an old scroll)
    function openBoard(tabId, fresh) {
      if (!profile) return openForm(tabId);
      let reading; try { reading = buildReading(profile); } catch (e) { console.error(e); ui.toast('Could not read this profile. Please enter your details again.', 'error'); return openForm(tabId, null); }
      const pos = store.get('pos:' + myKey()) || {};
      let tab = reading.tabs.find((t) => t.id === tabId) ? tabId : reading.tabs.find((t) => t.id === pos.tab) ? pos.tab : 'num';
      const body = modal.open('', { wide: true, cls: 'scroll' + (fresh ? ' unroll' : '') });
      const card = body.parentElement; const head = card.querySelector('header'); const h = reading.head;
      head.querySelector('b').replaceChildren(el('span', { class: 'rb-name', text: h.name }), el('span', { class: 'rb-who', text: `${h.date} · ${h.time} · ${h.place}` }));
      head.querySelector('button').before(
        el('button', { class: 'nut nho', text: '✏️ Edit my details', onclick: () => openForm(tab, profile) }),
        el('button', { class: 'nut nho', text: '⬇️ Download', title: 'Save the whole reading as one HTML file (prints on A4)', onclick: () => download(reading) }));
      strip = el('div', { class: 'rb-strip', hidden: true }); showStrip();
      const badges = el('div', { class: 'rb-badges' }, ...h.badges.map((b) => el('span', { class: 'rd-chip gold', text: b })));
      const tabs = el('div', { class: 'rb-tabs', role: 'tablist' });
      const toc = el('nav', { class: 'rb-toc', 'aria-label': 'Contents' }); const text = el('div', { class: 'rb-text' });
      body.append(strip, badges, tabs, el('div', { class: 'rb-main' }, toc, text), el('div', { class: 'rb-footer', text: 'For reference and entertainment only.' }));
      let spy = 0;
      function show(id, toSection) {
        tab = id; const T = reading.tabs.find((t) => t.id === id);
        tabs.replaceChildren(...reading.tabs.map((t) => el('button', { role: 'tab', class: t.id === id ? 'on' : '', 'aria-selected': String(t.id === id), text: `${t.icon} ${t.title}`, onclick: () => show(t.id) })));
        text.innerHTML = T.sections.map((s) => `<section class="rd-sec" id="${s.id}"><h3>${esc(s.title)}</h3>${s.html}</section>`).join('');
        toc.replaceChildren(...T.sections.map((s) => el('button', { 'data-id': s.id, text: s.title, onclick: () => text.querySelector('#' + CSS.escape(s.id))?.scrollIntoView({ behavior: 'smooth', block: 'start' }) })));
        const target = toSection && text.querySelector('#' + CSS.escape(toSection));
        text.scrollTop = 0; if (target) target.scrollIntoView({ block: 'start' });
        mark();
      }
      function mark() { // which section is being read: light it up in the contents and remember it
        const top = text.getBoundingClientRect().top + 40; let cur = null;
        for (const s of text.children) { if (s.getBoundingClientRect().top <= top) cur = s.id; else break; }
        cur = cur || text.firstElementChild?.id;
        for (const b of toc.children) b.classList.toggle('on', b.dataset.id === cur);
        store.set('pos:' + myKey(), { tab, sec: cur });
      }
      text.addEventListener('scroll', () => { clearTimeout(spy); spy = setTimeout(mark, 120); });
      show(tab, !tabId || tabId === pos.tab ? pos.sec : null);
    }
    function download(reading) {
      const blob = new Blob([readingFile(reading)], { type: 'text/html;charset=utf-8' });
      const a = el('a', { href: URL.createObjectURL(blob), download: `reading-${keyOf(reading.head.name).replace(/[^\p{L}\p{N}]+/gu, '-') || 'top1server'}.html` });
      document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      ui.toast('Your reading was saved as an HTML file.');
    }
    const open = (tabId) => (profile ? openBoard(tabId) : openForm(tabId));

    return {
      setInside(inside) { music.setDuck(inside ? 0.45 : state.area === 'forest' ? 0.25 : 1); if (!inside) fx = 0; }, // the shared music goes quieter in the temple
      update(dt) {
        if (fx > 0) {
          fx = Math.max(0, fx - dt); const k = 1 - fx / FX;                                  // 0 -> 1
          const ease = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
          if (world.thuChay.vong) world.thuChay.vong.rotation.y += ease * Math.PI * 2;      // one quick extra turn on top of its slow spin
          for (const g of glows) { g.material.opacity = Math.sin(k * Math.PI) * 0.85; g.scale.setScalar(1 + Math.sin(k * Math.PI) * 0.9); }
        } else for (const g of glows) g.material.opacity = 0;
      },
      interact(p) { const v = nearDoor(p); if (v) { open(DOORS[v.id][0]); return true; } if (nearNpc(p)) { open(null); return true; } return false; },
      hint(p) {
        const v = nearDoor(p);
        if (v) return `<kbd>E</kbd> ${DOORS[v.id][1]}: ${profile ? 'read your chart' : 'enter your birth details'}`;
        return nearNpc(p) ? `<kbd>E</kbd> talk to ${esc(npc.ten)}: ${profile ? 'read your chart' : 'enter your birth details'}` : '';
      },
      /** A click on Madame Star or a door (main.js asks the room before showing its own info card). */
      onClick(id) { if (id === 'ba-dong') { open(null); return true; } if (DOORS[id]) { open(DOORS[id][0]); return true; } return false; },
      /** What Madame Star says when you come close. */
      greeting(name) { return profile ? `Welcome back, ${name}! Touch me or one of the doors and we will read your chart again.` : `Hello ${name}! Tell me the day and hour you were born, and I will read your fortune for you.`; },
      camera: null,
      silencesMusic: false,
    };
  },
};
