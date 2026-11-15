// Gameplay from campus-game (v4, updated to v5: farm island, fishing chairs, playground, food stands), hosted by Top1's main.js. Combined game: Top1's Garden Room
// (6 beds, fish pond, fishing dock, stall) and Shop room use these same mechanics; styling lives in style.css.
// Original summary — gameplay glue: Xu HUD, earning feedback, areas + gate transitions, shop, bag,
// trash, fishing mini-game, private garden (plots / pond / decor) and forest ambience audio.
import * as THREE from 'three';

export function initFeatures(ctx, extras) {
  const { scene, camera, sun, WORLD, state, $, esc, toast, toon, mesh, box, cyl, sphere, gradient } = ctx;
  const C = ctx.Room.Catalog, ECON = C.ECON;
  const send = (m) => ctx.send(m);
  const me = () => ctx.me();
  scene.add(sun.target);
  state.area = 'campus'; state.profile = null; state.trash = []; state.carry = 0;
  const ui = buildUi(); // (styles: public/style.css, Top1 look)

  // ===================================================================== audio (coins + forest ambience)
  const amb = makeAmbience();
  ctx.wind = () => amb.wind;
  function blip(freqs, dur = 0.08, vol = 0.12) {
    const ac = ctx.audio.ctx; if (!ac || ctx.audio.muted) return;
    freqs.forEach((f, i) => {
      const o = ac.createOscillator(), g = ac.createGain(), t0 = ac.currentTime + i * dur;
      o.type = 'triangle'; o.frequency.value = f; g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur * 1.6);
      o.connect(g).connect(ac.destination); o.start(t0); o.stop(t0 + dur * 2);
    });
  }
  const coinSound = () => blip([988, 1319], 0.07, 0.1);

  // ===================================================================== areas + transitions
  let fadeTimer = null, gateArmed = true, exitArmed = true, modalOpen = false, savedCam = null;
  function fade(text) {
    ui.fade.querySelector('.t').textContent = text; ui.fade.classList.add('on');
    clearTimeout(fadeTimer); fadeTimer = setTimeout(unfade, 3000); // safety
    return new Promise((r) => setTimeout(r, 550));
  }
  function unfade() { clearTimeout(fadeTimer); ui.fade.classList.remove('on'); }
  async function goArea(to, text, gid) { await fade(text); send(gid ? { type: 'area', to, gid } : { type: 'area', to }); }
  // Lighting/fog blend between the lobby and the forest (GDD §4): 0 = lobby, 1 = forest; eased every frame
  let envK = 0;
  const SKY_A = new THREE.Color('#8fd3ff'), SKY_B = new THREE.Color('#a7dcc6');
  function updateEnv(dt) {
    const target = state.area === 'forest' ? 1 : 0;
    envK += (target - envK) * Math.min(1, dt * 1.1); // ~1.5 s cross-fade, same as the audio
    // combined game: sky, fog, light and the shadow box follow Top1's zone atmosphere (main.js + logic.js khongKhi)
  }
  function applyArea(area, prev) {
    state.area = area;
    state.selectedZone = null; $('#zoneCard').classList.add('hidden'); closePanels();
    amb.setOn(area === 'forest');
    ctx.setDuck(area === 'forest' ? 0.25 : 1);
    const seamless = (prev === 'campus' && area === 'forest') || (prev === 'forest' && area === 'campus');
    if (!seamless) envK = area === 'forest' ? 1 : 0;
    if (ctx.onArea) ctx.onArea(area, prev); // main.js clears walking / seats and snaps Top1's camera
    gateArmed = exitArmed = false;
    if (act) endAct();
    garden.reset();
    if (area === 'garden') { extras.setGardenOwner(state.visit ? String(state.visit.owner).replace(/[’']s garden$/i, '') : ((me() || {}).name || 'My')); garden.rebuild(); } else state.visit = null; // the gate sign names whose farm this is
    stopFishing(true);
    const ci = $('#chatInput'); // forest = Local chat only (GDD §4)
    if (ci) ci.placeholder = area === 'forest' ? '🌲 Local chat — only people nearby / at your table can see it' : innerWidth < 768 ? 'Tap to chat with everyone' : 'Press Enter to chat with everyone';
    renderHud();
  }
  function snapCamera(x, z) {
    const cam = ctx.cam; cam.target.set(x, 1.2, z);
    const cp = Math.cos(cam.pitch);
    camera.position.set(x + Math.sin(cam.yaw) * cp * cam.dist, 1.2 + Math.sin(cam.pitch) * cam.dist, z + Math.cos(cam.yaw) * cp * cam.dist);
  }
  function openGateModal() {
    modalOpen = true; savedCam = { dist: ctx.cam.dist };
    ui.gate.classList.remove('hidden');
  }
  function closeGateModal(enter) {
    ui.gate.classList.add('hidden'); modalOpen = false;
    if (savedCam) { ctx.cam.dist = savedCam.dist; savedCam = null; }
    if (enter) goArea('forest', '🌲 Entering the Quiet Forest…');
    else { const p = me(); if (p) { p.x = p.tx = WORLD.forestGate.x - 5; p.ry = p.try = -Math.PI / 2; send({ type: 'move', x: p.x, z: p.z, ry: p.ry, moving: false }); } }
    ctx.canvas.focus();
  }
  ui.gate.querySelector('.yes').onclick = () => closeGateModal(true);
  ui.gate.querySelector('.no').onclick = () => closeGateModal(false);
  ui.gardenBtn.onclick = () => {
    if (!state.profile) return toast('No wallet (bot/guest).');
    if (state.area === 'garden' && !state.visit) goArea('back', '🏫 Heading back…');
    else goArea('garden', '🌱 Heading to your garden…');
  };
  ui.backBtn.onclick = () => goArea('back', '🏫 Heading back…');
  ui.likeBtn.onclick = () => send({ type: 'like' });
  ui.boostBtn.onclick = () => { if (!(state.profile.inv.boost > 0)) { toast('Buy ⚡ Super Fertiliser in the Shop (Vegetables tab).'); return; } send({ type: 'useBoost' }); };
  function visitGarden(gid, name) {
    if (!state.profile) return;
    if (gid === (me() || {}).ownGid) { goArea('garden', '🌱 Heading to your garden…'); return; }
    goArea('garden', '🚶 Visiting ' + (name || 'the garden') + '…', gid);
  }
  // "Visit garden" on the player card (other real players only)
  const visitBtn = document.createElement('button'); visitBtn.textContent = '🌱 Visit garden'; visitBtn.className = 'primary';
  $('#playerCard .btns').prepend(visitBtn);
  visitBtn.onclick = () => { const q = state.players.get(state.selectedPlayer); if (!q || !q.ownGid) return; $('#playerCard').classList.add('hidden'); visitGarden(q.ownGid, q.name); };
  // ---- phones: Bag, Earnings and Friends fold away behind the ⋯ button (style.css shows it only on phone widths); the choice is remembered
  let barOpen = false; try { barOpen = localStorage.getItem('top1server-bar') === 'open'; } catch (e) { /* storage blocked */ }
  const setBar = (open) => { barOpen = open; ui.bar.classList.toggle('gon', !open); ui.moreBtn.setAttribute('aria-expanded', String(open)); ui.moreBtn.textContent = open ? '▾' : '⋯'; };
  setBar(barOpen);
  // the chat and the status line stack on top of the bar on phones: tell the style sheet how tall the bar and the status line are right now
  if (typeof ResizeObserver === 'function') {
    const measure = () => { document.body.style.setProperty('--bar-h', ui.bar.offsetHeight + 'px'); document.body.style.setProperty('--status-h', (ui.status.offsetHeight ? ui.status.offsetHeight + 8 : 0) + 'px'); };
    const ro = new ResizeObserver(measure); ro.observe(ui.bar); ro.observe(ui.status); measure();
  }
  ui.moreBtn.onclick = () => { setBar(!barOpen); try { localStorage.setItem('top1server-bar', barOpen ? 'open' : 'shut'); } catch (e) { /* storage blocked */ } };

  // ---- friends: ask on a player's card, answer in the Friends panel, visit their garden from the list (also when they are offline) ----
  state.friends = { list: [], requests: [] };
  const asked = new Map(); // player id -> when I sent them a request
  const isFriend = (gid) => state.friends.list.some((f) => f.gid === gid);
  const askedMe = (gid) => state.friends.requests.some((r) => r.gid === gid);
  const friendBtn = document.createElement('button'); friendBtn.className = 'nut nho';
  visitBtn.after(friendBtn);
  friendBtn.onclick = () => {
    const q = state.players.get(state.selectedPlayer); if (!q || !q.ownGid || isFriend(q.ownGid)) return;
    if (askedMe(q.ownGid)) send({ type: 'friendAnswer', gid: q.ownGid, ok: true });
    else { send({ type: 'friendAdd', id: q.id }); asked.set(q.id, performance.now()); }
    paintCard();
  };
  function paintCard() {
    const q = state.players.get(state.selectedPlayer), real = !!(q && q.ownGid);
    visitBtn.classList.toggle('hidden', !real);
    friendBtn.classList.toggle('hidden', !real || !state.profile || !(me() || {}).ownGid);
    if (!real) return;
    const friend = isFriend(q.ownGid), waiting = !friend && performance.now() - (asked.get(q.id) || -1e9) < 120000;
    const label = friend ? '✓ Friends' : askedMe(q.ownGid) ? '🤝 Accept friend' : waiting ? '⏳ Request sent' : '➕ Add friend';
    if (friendBtn.textContent !== label) friendBtn.textContent = label;
    friendBtn.disabled = friend || (waiting && !askedMe(q.ownGid));
  }
  setInterval(paintCard, 300);
  function renderFriends() {
    const f = state.friends;
    const reqs = f.requests.map((r) => `<div class="brow req"><span class="nm">💌 <b>${esc(r.name)}</b> wants to be friends</span><button class="primary" data-yes="${r.gid}">Accept</button><button data-no="${r.gid}">Decline</button></div>`).join('');
    const rows = f.list.map((r) => `<div class="brow"><i class="dot ${r.online ? 'on' : ''}"></i><span class="nm">${esc(r.name)}</span><span class="sc">${r.online ? 'online' : 'offline'}</span><button class="primary" data-visit="${r.gid}" data-name="${esc(r.name)}">🌱 Visit garden</button><button data-del="${r.gid}" data-name="${esc(r.name)}" title="Remove this friend">✕</button></div>`).join('');
    ui.friends.querySelector('.body').innerHTML = `<div class="small muted note">To add a friend, click a player in the game and choose <b>➕ Add friend</b>. Once they accept, you can visit each other's garden from this list at any time, even when your friend is offline.</div>
      ${reqs ? '<h4>Friend requests</h4>' + reqs : ''}
      <h4>My friends${f.list.length ? ' (' + f.list.length + ')' : ''}</h4>${rows || '<div class="muted empty">No friends yet. Meet other players in the plaza and add them!</div>'}`;
  }
  function paintFriendCount() {
    const n = state.friends.requests.length, b = ui.friendsBtn.querySelector('.n');
    b.textContent = n; b.classList.toggle('hidden', !n);
  }
  let friendPoll = null;
  function onFriends(m) {
    state.friends = { list: m.list || [], requests: m.requests || [] };
    paintFriendCount(); paintCard();
    if (!ui.friends.classList.contains('hidden')) renderFriends();
    clearTimeout(friendPoll); // an unanswered request runs out after two minutes: ask again then, so it leaves the list
    if (state.friends.requests.length) friendPoll = setTimeout(() => send({ type: 'friends' }), 125000);
  }
  ui.friendsBtn.onclick = () => { send({ type: 'friends' }); openPanel(ui.friends); renderFriends(); };
  ui.friends.querySelector('.body').onclick = (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.visit) { closePanels(); visitGarden(b.dataset.visit, b.dataset.name); }
    else if (b.dataset.yes) send({ type: 'friendAnswer', gid: b.dataset.yes, ok: true });
    else if (b.dataset.no) send({ type: 'friendAnswer', gid: b.dataset.no, ok: false });
    else if (b.dataset.del) {
      if (b.dataset.sure) send({ type: 'friendRemove', gid: b.dataset.del });
      else { b.dataset.sure = '1'; b.textContent = 'Remove ' + b.dataset.name + '?'; b.classList.add('danger'); }
    }
  };

  // ===================================================================== HUD
  function renderHud() {
    const pr = state.profile;
    ui.xu.textContent = pr ? pr.xu.toLocaleString('en-US') : '—';
    const own = state.area === 'garden' && !state.visit;
    ui.gardenBtn.innerHTML = own ? '🏫 Back to Plaza' : '🌱 My Garden';
    ui.backBtn.classList.toggle('hidden', !state.visit);
    ui.likeBtn.classList.toggle('hidden', !state.visit);
    if (state.visit) { ui.likeBtn.innerHTML = (state.visit.liked ? '❤️ Liked' : '🤍 Like') + ' · ' + state.visit.likes; ui.likeBtn.disabled = !!state.visit.liked; }
    ui.boostBtn.classList.toggle('hidden', !own);
    if (own && pr) {
      const b = (pr.garden.boosts || []).find((x) => x.e > ctx.serverNow());
      ui.boostBtn.innerHTML = b ? `⚡ ${Math.ceil((b.e - ctx.serverNow()) / 60000)}′` : `⚡ Boost (${pr.inv.boost || 0})`;
    }
    ui.forestVol.classList.toggle('hidden', state.area !== 'forest');
    ui.carry.classList.toggle('hidden', !state.carry);
    ui.carry.textContent = '🗑️ ' + state.carry + '/' + ECON.carryMax;
    if (pr) { const left = Math.max(0, ECON.dailyCap - (pr.earned || 0)); ui.cap.textContent = `today ${pr.earned || 0}/${ECON.dailyCap}` + (C.testMode ? ' · TEST MODE' : ''); ui.cap.title = left + ' Xu left to earn today'; }
    if (!ui.shop.classList.contains('hidden')) renderShop();
    if (!ui.bag.classList.contains('hidden')) renderBag();
    if (!ui.pond.classList.contains('hidden')) renderPond();
    if (!ui.earn.classList.contains('hidden')) renderEarn();
  }
  const floaters = [];
  function floatText(text, color = '#ffd23f') {
    const el = document.createElement('div'); el.className = 'vc-float'; el.style.color = color; el.textContent = text;
    ctx.labelsEl.appendChild(el); floaters.push({ el, t: 0 });
  }
  function studyStatus() {
    const p = me(); if (!p || !state.profile) return '';
    if (p.seat) {
      const tid = p.seat.split(':')[0], tbl = WORLD.tables.find((t) => t.id === tid);
      if (tbl.kind === 'game') return `🎲 ${tbl.name} · winning pays ${ECON.gameWin} Xu`;
      if (tbl.kind === 'cinema') return state.cinemaPlaying ? `🎬 Watching together · +${loungeRate(true)} Xu/min` : '🎬 Nothing is playing — add a YouTube link to the Cinema queue to earn Xu';
      if (tbl.kind === 'lounge') return state.current ? `🎬 Watching together · +${loungeRate()} Xu/min` : '🎬 No music/video yet — add a YouTube link to earn Xu';
      let rate = ECON.studyPerMin;
      const mates = Object.keys(state.seats).filter((k) => k.split(':')[0] === tid).length;
      if (mates >= 2) rate *= ECON.groupMult;
      if (tbl.area === 'forest') rate *= ECON.forestMult;
      const el = Math.floor((performance.now() - (seatT || performance.now())) / 1000);
      const mm = String(Math.floor(el / 60) % ECON.pomodoroMin).padStart(2, '0'), ss = String(el % 60).padStart(2, '0');
      return `📚 Studying · ⏱️ ${mm}:${ss} / ${ECON.pomodoroMin}:00 · +${+rate.toFixed(2)} Xu/min${mates >= 2 ? ' (group x1.5)' : ''}${tbl.area === 'forest' ? ' (forest x1.25)' : ''}`;
    }
    if (p.room === 'xem-phim' && state.cinemaPlaying) return `🎬 Watching together · +${loungeRate(true)} Xu/min`;
    if (inLounge(p) && state.current) return `🎬 Listening together · +${loungeRate()} Xu/min`;
    const bf = state.profile.buff; if (bf && bf.until > ctx.serverNow()) return `${bf.icon || '⚡'} Wide awake: studying pays x${bf.mult} Xu · ${Math.ceil((bf.until - ctx.serverNow()) / 60000)} min left`;
    return '';
  }
  let seatT = 0, lastSeat = null;
  function loungeRate(cine) { let n = 0; for (const q of state.players.values()) if (cine ? q.room === 'xem-phim' : inLounge(q)) n++; return n >= ECON.loungeCrowd ? ECON.loungeCrowdPerMin : ECON.loungePerMin; }
  function inLounge(p) { const zn = WORLD.zones.find((z) => z.id === 'lounge'); return (p.area || 'campus') === 'campus' && !p.room && Math.abs(p.x - zn.x) <= zn.w / 2 && Math.abs(p.z - zn.z) <= zn.d / 2; }

  // AFK: tell the server we're here when there is input
  let lastInput = performance.now(), lastActiveSent = 0;
  ['keydown', 'pointerdown', 'pointermove', 'wheel'].forEach((ev) => addEventListener(ev, () => { lastInput = performance.now(); }, { passive: true }));
  setInterval(() => { if (state.me && performance.now() - lastInput < 20000 && performance.now() - lastActiveSent > 19000) { lastActiveSent = performance.now(); send({ type: 'active' }); } }, 5000);
  ui.afk.querySelector('button').onclick = () => { ui.afk.classList.add('hidden'); send({ type: 'active' }); ctx.canvas.focus(); };

  // ===================================================================== panels: shop / bag / tank / earnings / market / merchant / garden pickers
  let shopTab = 'crop', marketTab = 'browse';
  const PANELS = () => [ui.shop, ui.bag, ui.pond, ui.earn, ui.seeds, ui.market, ui.merchantP, ui.pots, ui.care, ui.board, ui.food, ui.house, ui.pen, ui.friends];
  ui.food.querySelector('.body').onclick = (e) => { const b = e.target.closest('button'); if (b && b.dataset.food) send({ type: 'buyFood', item: b.dataset.food, stand: ui.food.dataset.stand }); };
  // ---- weekly boards (GDD §1) ----
  function renderBoard(m) {
    const row = (r, i, key) => `<div class="brow ${r.gid === m.me ? 'me' : ''}"><b>${['🥇', '🥈', '🥉'][i] || (i + 1) + '.'}</b><span class="nm">${esc(r.name)}${r.npc ? ' 🏡' : ''}${r.gid === m.me ? ' (you)' : ''}</span><span class="sc">${r[key]} pts${key === 'garden' ? ' · ❤️' + r.likes : ''}</span>${r.gid === m.me ? '' : `<button data-visit="${r.gid}" data-name="${esc(r.name)}">Visit</button>`}</div>`;
    ui.board.querySelector('.body').innerHTML = `<div class="small muted note">Garden score = decorations, pots, plants, upgrades + 5 points per ❤️ this week. Tank score = fish (rarity, size — starving fish lose points) + tank decorations. Visit and Like to help friends climb the ranks!</div>
      <div class="boards"><div><h4>🌱 Best Garden of the Week</h4>${m.gardens.map((r, i) => row(r, i, 'garden')).join('')}</div><div><h4>🐠 Best Fish Tank of the Week</h4>${m.tanks.map((r, i) => row(r, i, 'tank')).join('')}</div></div>`;
    openPanel(ui.board);
  }
  ui.board.querySelector('.body').onclick = (e) => { const b = e.target.closest('button'); if (b && b.dataset.visit) { closePanels(); visitGarden(b.dataset.visit, b.dataset.name); } };
  // ---- Pomodoro quiz popup (GDD §3) ----
  function showQuiz(m) {
    ui.quiz.querySelector('.sub').innerHTML = `Answer the question correctly to earn <b>+${m.bonus} Xu</b> (${m.left} left).`;
    ui.quiz.querySelector('.q').textContent = m.q;
    ui.quiz.querySelector('.opts').innerHTML = m.o.map((o, i) => `<button data-choice="${i}">${'ABCD'[i]}. ${esc(o)}</button>`).join('');
    ui.quiz.querySelector('.src').textContent = m.src ? 'Source: ' + m.src : '';
    ui.quiz.classList.remove('hidden'); blip([523, 784], 0.1, 0.1);
  }
  ui.quiz.querySelector('.opts').onclick = (e) => { const b = e.target.closest('button'); if (b) { ui.quiz.querySelectorAll('.opts button').forEach((x) => { x.disabled = true; }); send({ type: 'quizAnswer', choice: +b.dataset.choice }); } };
  function openPanel(el) { PANELS().forEach((x) => x.classList.toggle('hidden', x !== el)); }
  function closePanels() { PANELS().forEach((x) => x.classList.add('hidden')); ctx.canvas.focus(); }
  document.querySelectorAll('.vc-panel .x').forEach((b) => b.onclick = closePanels);
  ui.bagBtn.onclick = () => { openPanel(ui.bag); renderBag(); };
  ui.earnBtn.onclick = () => { openPanel(ui.earn); renderEarn(); };
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closePanels(); if (modalOpen) closeGateModal(false); if (fish.phase !== 'idle') stopFishing(); if (act) endAct(); }
    if (ctx.typing()) return;
    if ((e.key === 'b' || e.key === 'B') && state.me) { if (ui.bag.classList.contains('hidden')) { openPanel(ui.bag); renderBag(); } else closePanels(); }
    if (e.key === ' ' && fish.phase === 'game') { e.preventDefault(); fishHit(); }
  });
  const anyOpen = () => PANELS().some((x) => !x.classList.contains('hidden'));

  function card(icon, name, info, btns, cls = '') {
    return `<div class="vc-card ${cls}"><div class="ic">${icon}</div><div class="nm">${esc(name)}</div><div class="in">${info}</div><div class="bt">${btns}</div></div>`;
  }
  const price = (n) => `${n} Xu`;
  function renderShop() {
    const pr = state.profile; if (!pr) return;
    ui.shop.querySelector('.wallet').textContent = pr.xu + ' Xu';
    ui.shop.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === shopTab));
    const inv = pr.inv, have = (k) => inv[k] || 0;
    let h = '';
    if (shopTab === 'crop') {
      h += '<div class="small muted note">Vegetables grow in plots. Each growth cycle you can water 💧 once (−15% time) and fertilise 🧪 once (−30%).</div><div class="grid">';
      for (const [k, s] of Object.entries(C.CROPS)) h += card(s.icon, s.name, `Grows ${fmtMin(s.growMin)} · sells ${s.sell} Xu<br>Owned: ${have('seed:' + k)}`, `<button class="primary" data-buy="seed:${k}" data-q="1">${price(s.price)}</button><button data-buy="seed:${k}" data-q="5">x5</button>`);
      h += card(C.FERT.icon, C.FERT.name, `${C.FERT.qty} bags / purchase · −30% for 1 plant<br>Owned: ${have('fert')}`, `<button class="primary" data-buy="fert">${price(C.FERT.price)}</button>`);
      h += card(C.BOOST.icon, C.BOOST.name, `Whole garden grows ${C.BOOST.speed * 100}% faster for ${C.BOOST.minutes} min<br>Owned: ${have('boost')}`, `<button class="primary" data-buy="boost">${price(C.BOOST.price)}</button>`) + '</div>';
    }
    if (shopTab === 'flower') {
      h += `<div class="small muted note">Flowers grow in the Cloud Flower Garden on your farm and sell for more. ${C.UPGRADES.pots[2].name}: flowers grow 20% faster and each harvest gives ${C.CARE.cloudYield} blooms.</div><div class="grid">`;
      for (const [k, s] of Object.entries(C.FLOWERS)) h += card(s.icon, s.name, `Grows ${fmtMin(s.growMin)} · sells ${s.sell} Xu<br>Owned: ${have('seed:' + k)}`, `<button class="primary" data-buy="seed:${k}" data-q="1">${price(s.price)}</button><button data-buy="seed:${k}" data-q="5">x5</button>`);
      for (const [k, PT] of Object.entries(C.POTS)) if (k !== 'clay') h += card(PT.icon, PT.name, `+${Math.round(PT.bonus * 100)}% chance of an extra bloom` + (PT.speed < 1 ? ` · ${Math.round((1 - PT.speed) * 100)}% faster` : '') + `<br>Owned: ${have('pot:' + k)}`, `<button class="primary" data-buy="pot:${k}">${price(PT.price)}</button>`);
      h += '</div>';
    }
    if (shopTab === 'tree') {
      h += '<div class="small muted note">Fruit trees grow in the Orchard. They grow once, then bear fruit repeatedly. Poke the fruit down with a pole to harvest!</div><div class="grid">';
      for (const [k, f] of Object.entries(C.FRUITS)) h += card(f.icon, f.name, `Grows ${fmtMin(f.growMin)} · fruits every ${fmtMin(f.regrowMin)}<br>${f.yield[0]}-${f.yield[1]} fruit × ${f.sell} Xu · Owned: ${have('sapling:' + k)}`, `<button class="primary" data-buy="sapling:${k}">${price(f.price)}</button>`);
      h += '</div>';
    }
    if (shopTab === 'fish') {
      h += '<div class="grid">';
      for (const [k, f] of Object.entries(C.FISH)) if (f.shop) h += card('🐟', f.name, `${f.rarity} · ${f.size[0]}cm<br>Grows in the tank`, `<button class="primary" data-buy="fish:${k}">${price(f.shop)}</button>`);
      h += card(C.FOOD.icon, C.FOOD.name, `${C.FOOD.qty} portions / pack · Owned: ${have('food')}`, `<button class="primary" data-buy="food">${price(C.FOOD.price)}</button>`);
      for (const [k, d] of Object.entries(C.TANK_DECOR)) h += card(d.icon, d.name, `Tank decoration · Owned: ${have('tank:' + k)}`, `<button class="primary" data-buy="tank:${k}">${price(d.price)}</button>`);
      h += '</div>';
    }
    if (shopTab === 'animal') {
      h += '<div class="small muted note">Animals live in the pens on your farm. Feed them → a product appears → walk into the pen to collect it. They also eat crops you grow yourself (wheat, alfalfa, corn, potato…).</div><div class="grid">';
      for (const [k, A] of Object.entries(C.ANIMALS)) { const n = (pr.garden.animals || []).filter((a) => a.kind === k).length, cap = C.UPGRADES[A.pen][pr.garden[A.pen] | 0].cap; h += card(A.icon, A.name, `Gives ${C.PRODUCTS[A.product].icon} ${C.PRODUCTS[A.product].name} (${C.PRODUCTS[A.product].sell} Xu) every ${A.produceMin} min<br>You have ${n}/${cap}`, `<button class="primary" data-buy="animal:${k}" ${n >= cap ? 'disabled' : ''}>${price(A.price)}</button>`); }
      for (const [k, F2] of Object.entries(C.FEEDS)) h += card(F2.icon, F2.name, `For your ${C.ANIMALS[k].name.toLowerCase()}s · ${F2.qty} portions<br>Owned: ${have('feed:' + k)}`, `<button class="primary" data-buy="feed:${k}">${price(F2.price)}</button>`);
      h += '</div>';
    }
    if (shopTab === 'home') {
      const H = C.UPGRADES.house, hl = pr.garden.house | 0, nx = H[hl + 1];
      h += '<div class="grid">' + card('🏡', 'House upgrade', `Now: ${H[hl].name} (${H[hl].cap} furniture spots)` + (nx ? `<br>→ ${nx.name} (${nx.cap} spots)` : ' (highest level)'), nx ? `<button class="primary" data-buy="up:house">${price(nx.price)}</button>` : '');
      for (const [k, F2] of Object.entries(C.FURNITURE)) h += card(F2.icon, F2.name, `Owned: ${have('furn:' + k)}`, `<button class="primary" data-buy="furn:${k}">${price(F2.price)}</button>`);
      h += '</div><div class="small muted">Walk into your farm house (the door is on the south side) and press E to place furniture.</div>';
    }
    if (shopTab === 'decor') {
      const rare = C.rareOfWeek(ctx.serverNow());
      h += '<h4>⭐ Rare items this week (changes every Monday)</h4><div class="grid">' + rare.map((k) => card(C.DECOR[k].icon, C.DECOR[k].name, `Unique — boosts Garden score<br>Owned: ${have('decor:' + k)}`, `<button class="primary" data-buy="decor:${k}">${price(C.DECOR[k].price)}</button>`, 'rare')).join('') + '</div>';
      h += '<h4>Regular decorations</h4><div class="grid">'; for (const [k, d] of Object.entries(C.DECOR)) if (!d.rare) h += card(d.icon, d.name, `Owned: ${have('decor:' + k)}`, `<button class="primary" data-buy="decor:${k}">${price(d.price)}</button>`); h += '</div>';
    }
    if (shopTab === 'up') {
      const g = pr.garden, U = C.UPGRADES; h += '<div class="grid">';
      const up = (key, icon, name, cur, next) => card(icon, name, cur + (next ? ' → ' + next.label : ' (max)'), next ? `<button class="primary" data-buy="up:${key}">${price(next.price)}</button>` : '');
      const nl = U.land[g.land + 1], np = U.pots[g.pots + 1], no = U.orchard[g.orchard + 1], nt = U.pond[g.pond + 1];
      h += up('land', '🟫', 'Expand fields', `${U.land[g.land].size}x${U.land[g.land].size}`, nl && { label: nl.size + 'x' + nl.size, price: nl.price });
      h += up('pots', '🌷', 'Cloud Flower Garden', `${U.pots[g.pots].name} (${U.pots[g.pots].cap} pots)`, np && { label: np.name + ' (' + np.cap + ' pots)', price: np.price });
      h += up('orchard', '🌳', 'Orchard', `${U.orchard[g.orchard].cap} trees`, no && { label: no.cap + ' trees', price: no.price });
      [['coop', '🐔', 'Chicken coop'], ['sty', '🐖', 'Pig sty'], ['barn', '🐄', 'Cow barn']].forEach(([key, ic, nm]) => { const L2 = C.UPGRADES[key], lv2 = g[key] | 0, n2 = L2[lv2 + 1]; h += up(key, ic, nm, L2[lv2].cap + ' animals', n2 && { label: n2.cap + ' animals', price: n2.price }); });
      h += up('pond', '🐠', 'Fish Tank', `${U.pond[g.pond].cap} fish`, nt && { label: nt.cap + ' fish', price: nt.price });
      h += '</div>';
    }
    if (shopTab === 'sell') h += sellList();
    ui.shop.querySelector('.content').innerHTML = h;
  }
  function sellList() {
    const pr = state.profile; let any = false, h = '<div class="grid">';
    for (const [key, n] of Object.entries(pr.inv)) {
      const kind = key.split(':')[0]; if ((kind !== 'crop' && kind !== 'prod') || !n) continue; const info = C.itemInfo(key); if (!info) continue; any = true; // crops and animal products
      h += card(info.icon, info.name, `Owned ${n} · ${info.base} Xu each`, `<button class="primary" data-sell="${kind}" data-id="${key.slice(5)}">Sell 1</button><button data-sell="${kind}" data-id="${key.slice(5)}" data-all="1">Sell all</button>`);
    }
    for (const f of pr.bag) { any = true; const F = C.FISH[f.sp]; h += card('🐟', F.name, `${f.size} cm · ${F.rarity}`, `<button class="primary" data-sell="fish" data-uid="${f.uid}">+${C.fishPrice(f.sp, f.size)} Xu</button>`); }
    h += '</div>';
    return any ? h : '<div class="muted" style="padding:20px">Nothing to sell yet. Harvest on your farm, collect from your animals or go fishing!</div>';
  }
  function fmtMin(m) { return m >= 1 ? (Math.round(m * 10) / 10) + ' min' : Math.round(m * 60) + ' s'; }
  ui.shop.querySelector('.tabs').onclick = (e) => { const t = e.target.dataset.tab; if (t) { shopTab = t; renderShop(); } };
  const sellClick = (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.buy) send({ type: 'buy', item: b.dataset.buy, qty: +(b.dataset.q || 1) });
    if (b.dataset.sell === 'crop' || b.dataset.sell === 'prod') send({ type: 'sell', kind: b.dataset.sell, id: b.dataset.id, all: !!b.dataset.all });
    if (b.dataset.sell === 'fish') send({ type: 'sell', kind: 'fish', uid: +b.dataset.uid });
  };
  ui.shop.querySelector('.content').onclick = sellClick;

  function renderBag() {
    const pr = state.profile; if (!pr) { ui.bag.querySelector('.body').innerHTML = '—'; return; }
    const groups = { seed: [], sapling: [], crop: [], decor: [], tank: [], misc: [], prod: [], feed: [], pot: [], furn: [] };
    for (const [key, n] of Object.entries(pr.inv)) {
      if (!n) continue; const info = C.itemInfo(key); if (!info) continue;
      const g = key.includes(':') ? key.split(':')[0] : 'misc';
      const btn = g === 'decor' && state.area === 'garden' ? `<button class="primary" data-place="${key.slice(6)}">Place here</button>` : '';
      (groups[g] || groups.misc).push(card(info.icon, info.name, 'x' + n + (info.produce ? ' · ' + info.base + ' Xu' : ''), btn));
    }
    const sec = (title, items) => `<h4>${title}</h4>` + (items.length ? `<div class="grid">${items.join('')}</div>` : '<div class="muted small">Empty</div>');
    let h = `<div class="muted small">${pr.xu} Xu</div>`;
    h += sec('🌱 Seeds & saplings', groups.seed.concat(groups.sapling)) + sec('🧺 Produce & animal products', groups.crop.concat(groups.prod)) + sec('🧪 Supplies & animal feed', groups.misc.concat(groups.feed)) + sec('🏺 Flower pots & furniture', groups.pot.concat(groups.furn));
    h += sec(`🐟 Fish in bag (${pr.bag.length}/${ECON.bagMax})`, pr.bag.map((f) => card('🐟', C.FISH[f.sp].name, `${f.size} cm · ${C.FISH[f.sp].rarity}`, '')));
    h += sec('🏮 Garden decorations', groups.decor) + sec('🐚 Tank decorations', groups.tank);
    if (state.area === 'garden' && pr.garden.decor.length) h += sec('📍 Placed on the farm', pr.garden.decor.map((d) => card(C.DECOR[d.item].icon, C.DECOR[d.item].name, '', `<button data-store="${d.uid}">Store</button>`)));
    ui.bag.querySelector('.body').innerHTML = h;
  }
  ui.bag.querySelector('.body').onclick = (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const p = me();
    if (b.dataset.place && p) { const x = p.x + Math.sin(p.ry) * 1.6, z = p.z + Math.cos(p.ry) * 1.6; send({ type: 'decorPlace', item: b.dataset.place, x, z, r: p.ry + Math.PI }); }
    if (b.dataset.store) send({ type: 'decorStore', uid: +b.dataset.store });
  };

  // ---- round fish tank ----
  function renderPond() {
    const pr = state.profile; if (!pr) return;
    const g = pr.garden, cap = C.UPGRADES.pond[g.pond].cap, now = ctx.serverNow();
    const hungry = g.fish.filter((f) => now - (f.fedAt || 0) >= ECON.feedCooldownMin * 60000).length;
    let h = `<div class="muted small">Capacity ${g.fish.length}/${cap} fish · ${C.FOOD.icon} Fish food: ${pr.inv.food || 0} · Each fish eats once per ${fmtMin(ECON.feedCooldownMin)} and grows after eating</div>`;
    h += `<div style="margin:8px 0"><button class="primary" data-feed="1" ${g.fish.length ? '' : 'disabled'}>${state.area === 'garden' ? '🍤 Climb the tower & sprinkle food' : '🍤 Feed the fish'} (${hungry} hungry)</button></div><h4>🐠 Fish in tank</h4>`;
    h += g.fish.length ? '<div class="grid">' + g.fish.map((f) => { const ready = now - (f.fedAt || 0) >= ECON.feedCooldownMin * 60000, starving = now - (f.fedAt || 0) > ECON.hungryHours * 3600000; return card('🐠', C.FISH[f.sp].name, `${f.size}/${C.fishMaxSize(f.sp)} cm · ${starving ? '😟 starving — losing score' : ready ? '😋 hungry' : '😊 full'}`, `<button data-take="${f.uid}">Take out</button>`); }).join('') + '</div>' : '<div class="muted small">The tank has no fish. Fish in the Quiet Forest or buy some in the Shop.</div>';
    h += `<h4>🎒 Fish in bag</h4>` + (pr.bag.length ? '<div class="grid">' + pr.bag.map((f) => card('🐟', C.FISH[f.sp].name, f.size + ' cm', `<button class="primary" data-rel="${f.uid}">Release</button>`)).join('') + '</div>' : '<div class="muted small">No fish in your bag.</div>');
    h += `<h4>🌿 Tank decorations (${g.tankDecor.length}/${C.TANK_DECOR_MAX})</h4><div class="grid">`;
    h += g.tankDecor.map((k, i) => card(C.TANK_DECOR[k].icon, C.TANK_DECOR[k].name, 'In the tank', `<button data-tdtake="${i}">Remove</button>`)).join('');
    for (const k of Object.keys(C.TANK_DECOR)) if (pr.inv['tank:' + k]) h += card(C.TANK_DECOR[k].icon, C.TANK_DECOR[k].name, 'In bag: ' + pr.inv['tank:' + k], `<button class="primary" data-td="${k}">Release</button>`);
    h += '</div><div class="small muted">Buy seaweed, moss, coral, castles… in the Shop → Fish & Tank tab.</div>';
    ui.pond.querySelector('.body').innerHTML = h;
  }
  ui.pond.querySelector('.body').onclick = (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.feed) { closePanels(); if (state.area === 'garden') garden.startFeeding(); else send({ type: 'pondFeed' }); } // (the campus pond went with the Garden Room)
    if (b.dataset.take) send({ type: 'pondTake', uid: +b.dataset.take });
    if (b.dataset.rel) send({ type: 'pondRelease', uid: +b.dataset.rel });
    if (b.dataset.td) send({ type: 'tankDecor', item: b.dataset.td });
    if (b.dataset.tdtake) send({ type: 'tankDecorTake', i: +b.dataset.tdtake });
  };

  function renderEarn() {
    const pr = state.profile; if (!pr) return;
    const pct = Math.min(100, (pr.earned || 0) / ECON.dailyCap * 100);
    let h = `<div>Today: <b>${pr.earned || 0}</b> / ${ECON.dailyCap} Xu</div><div class="vc-bar"><div style="width:${pct}%"></div></div>`;
    h += '<h4>By activity</h4>' + (Object.keys(pr.byReason || {}).length ? Object.entries(pr.byReason).map(([r, a]) => `<div>${(C.REASONS[r] || {}).icon || ''} ${(C.REASONS[r] || {}).name || r}: <b>+${a}</b></div>`).join('') : '<div class="muted small">Nothing earned yet today.</div>');
    h += `<div class="small muted" style="margin-top:6px">👟 Walking: ${pr.walk || 0}/${ECON.walkDailyCap} · 📍 Check-in: ${(pr.checkins || []).length}/${WORLD.landmarks.length}</div>`;
    h += `<h4>How to earn Xu</h4><table class="vc-tbl">
      <tr><td>📚 Studying at a desk</td><td>${ECON.studyPerMin} Xu/min · group of 2+ x${ECON.groupMult} · in the forest x${ECON.forestMult}</td></tr>
      <tr><td>⏱️ Study ${ECON.pomodoroMin} min straight</td><td>+${ECON.pomodoroBonus} Xu</td></tr>
      <tr><td>👟 Walking</td><td>${ECON.walkXu} Xu / ${ECON.walkMeters} m (max ${ECON.walkDailyCap}/day)</td></tr>
      <tr><td>📍 Visit a landmark</td><td>+${ECON.checkinXu} Xu each / day</td></tr>
      <tr><td>🧹 Pick up litter · ♻️ recycling bin</td><td>+${ECON.trashPick} / item · +${ECON.trashDrop} / item</td></tr>
      <tr><td>🎬 Lounge while playing</td><td>${ECON.loungePerMin} Xu/min · ≥${ECON.loungeCrowd} people: ${ECON.loungeCrowdPerMin}</td></tr>
      <tr><td>🌱 Garden · 🎣 fishing</td><td>Sell at the Shop, Garden Stall, Market or to the Merchant (not counted in the daily cap)</td></tr></table>
      <div class="small muted">No activity for ${ECON.afkMs / 60000} min pauses Xu earning.</div>`;
    h += '<h4>Recent</h4>' + pr.log.slice(-12).reverse().map((l) => `<div class="small">${(C.REASONS[l.r] || {}).icon || ''} ${(C.REASONS[l.r] || {}).name || l.r}${l.n ? ' · ' + esc(l.n) : ''}: <b style="color:${l.a >= 0 ? '#9be37a' : '#ff8a80'}">${l.a >= 0 ? '+' : ''}${l.a}</b></div>`).join('');
    ui.earn.querySelector('.body').innerHTML = h;
  }

  // ---- market (lobby board + garden stall) ----
  function openMarket(tab, atStall) { marketTab = tab; ui.market.dataset.stall = atStall ? '1' : ''; openPanel(ui.market); renderMarket(); }
  function renderMarket() {
    const pr = state.profile; if (!pr) return;
    const atStall = !!ui.market.dataset.stall;
    ui.market.querySelector('header b').textContent = atStall ? '🏷️ Garden Stall' : '🏪 Market';
    ui.market.querySelector('.wallet').textContent = pr.xu + ' Xu';
    const tabs = [['browse', '🛒 Market'], ['list', '📢 List for sale'], ['mine', '📦 My items']]; if (atStall) tabs.unshift(['now', '💰 Sell now']);
    let h = '<div class="tabs">' + tabs.map(([k, n]) => `<button data-mtab="${k}" class="${marketTab === k ? 'on' : ''}">${n}</button>`).join('') + '</div>';
    const L = state.market || [];
    if (marketTab === 'now') h += '<div class="small muted note">Sell instantly to the trader at base price. For a higher price: list on the Market or wait for the Travelling Merchant to visit the Plaza.</div>' + sellList();
    if (marketTab === 'browse') {
      const others = L.filter((l) => !l.mine);
      h += others.length ? '<div class="grid">' + others.map((l) => { const i = C.itemInfo(l.item) || { icon: '❔', name: l.item }; return card(i.icon, i.name + ' x' + l.qty, `${esc(l.byName)}${l.npc ? ' 🏡' : ''} · ${Math.round(l.price / l.qty)} Xu each`, `<button class="primary" data-mbuy="${l.id}" ${pr.xu < l.price ? 'disabled' : ''}>Buy ${l.price} Xu</button>`); }).join('') + '</div>' : '<div class="muted" style="padding:16px">The Market is empty. List one of your items!</div>';
    }
    if (marketTab === 'list') {
      const opts = Object.entries(pr.inv).filter(([k, n]) => n > 0 && C.itemInfo(k)).map(([k, n]) => { const i = C.itemInfo(k); return `<option value="${k}" data-base="${i.base}" data-max="${n}">${i.icon} ${esc(i.name)} (have ${n})</option>`; }).join('');
      h += opts ? `<div class="vc-form"><label>Item <select id="mkItem">${opts}</select></label>
        <label>Quantity <input id="mkQty" type="number" min="1" value="1"></label>
        <label>Total price (Xu) <input id="mkPrice" type="number" min="1"></label>
        <div class="small muted" id="mkHint"></div>
        <label class="chk"><input id="mkShout" type="checkbox" checked> 📢 Advertise in chat for everyone</label>
        <button class="primary" id="mkPost">List on Market</button></div>
        <div class="small muted">Passing customers will buy at reasonable prices (≤ ${ECON.npcBuyMaxMult}× base price) even while you are offline; other players buy from the Market board on the Plaza or at a Garden Stall.</div>` : '<div class="muted">Your Bag is empty — nothing to list for sale.</div>';
    }
    if (marketTab === 'mine') {
      const mine = L.filter((l) => l.mine);
      h += mine.length ? '<div class="grid">' + mine.map((l) => { const i = C.itemInfo(l.item) || { icon: '❔', name: l.item }; return card(i.icon, i.name + ' x' + l.qty, `Price ${l.price} Xu`, `<button data-mcancel="${l.id}">Cancel (take back)</button>`); }).join('') + `</div><div class="small muted">${mine.length}/${ECON.maxListings} items listed</div>` : '<div class="muted" style="padding:16px">You have not listed anything yet.</div>';
    }
    ui.market.querySelector('.body').innerHTML = h;
    if (marketTab === 'list') {
      const sel = $('#mkItem'); if (!sel) return;
      const q = $('#mkQty'), pz = $('#mkPrice'), hint = $('#mkHint');
      const sync = (resetPrice) => { const o = sel.selectedOptions[0]; const base = +o.dataset.base, max = +o.dataset.max; q.max = max; if (+q.value > max) q.value = max; if (resetPrice) pz.value = Math.max(1, Math.round(base * (+q.value || 1) * 1.3)); hint.textContent = `Base price ~${Math.round(base * (+q.value || 1))} Xu · asking ${Math.round((+pz.value || 0) / Math.max(1, +q.value)) } Xu each`; };
      sel.onchange = () => sync(true); q.oninput = () => sync(true); pz.oninput = () => sync(false); sync(true);
      $('#mkPost').onclick = () => send({ type: 'marketList', item: sel.value, qty: +q.value, price: +pz.value, shout: $('#mkShout').checked });
    }
  }
  ui.market.querySelector('.body').onclick = (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.mtab) { marketTab = b.dataset.mtab; renderMarket(); }
    if (b.dataset.mbuy) send({ type: 'marketBuy', id: +b.dataset.mbuy });
    if (b.dataset.mcancel) send({ type: 'marketCancel', id: +b.dataset.mcancel });
    if (b.dataset.sell) sellClick(e);
  };
  // ---- travelling merchant ----
  function renderMerchant() {
    const m = state.merchant, pr = state.profile; if (!pr) return;
    if (!m) { ui.merchantP.querySelector('.body').innerHTML = '<div class="muted">The Merchant has left.</div>'; return; }
    const i = C.itemInfo(m.item), each = Math.round(i.base * m.mult), have = pr.inv[m.item] || 0;
    ui.merchantP.querySelector('.body').innerHTML = `<div class="merchant"><div class="big">🧳</div><div>“Hello there! I'm buying <b>${i.icon} ${esc(i.name)}</b> at <b>${each} Xu each</b> (${m.mult}x the base price of ${i.base}). I still need <b>${m.left}</b> more.”</div>
      <div class="small muted">You have: ${have}</div><div class="row" style="justify-content:center;margin-top:8px"><button class="primary" data-ms="1" ${have ? '' : 'disabled'}>Sell 1</button><button data-ms="99" ${have ? '' : 'disabled'}>Sell max</button></div></div>`;
  }
  ui.merchantP.querySelector('.body').onclick = (e) => { const b = e.target.closest('button'); if (b && b.dataset.ms) send({ type: 'merchantSell', qty: +b.dataset.ms }); };

  // ---- garden pickers: seeds for a plot / saplings for a tree slot / care (water + fertiliser) / pot rack ----
  function openPlantPicker(where, id) {
    const pr = state.profile;
    const T = where === 'plot' || where === 'bed' ? C.CROPS : where === 'pot' ? C.FLOWERS : C.FRUITS, pre = where === 'tree' ? 'sapling:' : 'seed:';
    const list = Object.entries(T).filter(([k]) => pr.inv[pre + k] > 0);
    const what = where === 'plot' || where === 'bed' ? 'vegetable seeds' : where === 'pot' ? 'flower seeds' : 'saplings';
    ui.seeds.querySelector('header b').textContent = '🌱 Choose ' + what;
    ui.seeds.querySelector('.body').innerHTML = list.length
      ? '<div class="grid">' + list.map(([k, s]) => card(s.icon, s.name, `x${pr.inv[pre + k]} · ${fmtMin(s.growMin)}`, `<button class="primary" data-seed="${k}">Plant</button>`)).join('') + '</div>'
      : `<div class="muted">You don't have any ${what}. Buy some at the Shop on the Plaza or at the Market!</div>`;
    ui.seeds.dataset.where = where; ui.seeds.dataset.id = id; openPanel(ui.seeds);
  }
  ui.seeds.querySelector('.body').onclick = (e) => { const b = e.target.closest('button'); if (b && b.dataset.seed) { send({ type: 'plant', where: ui.seeds.dataset.where, id: ui.seeds.dataset.id, seed: b.dataset.seed }); if (ui.seeds.dataset.where === 'pot') { openPanel(ui.pots); renderPots(); } else closePanels(); } };
  function careButtons(where, id, rec) {
    const fert = state.profile.inv.fert || 0;
    return `<button data-care="water" data-w="${where}" data-id="${id}" ${rec.w ? 'disabled' : ''}>💧 ${rec.w ? 'Watered' : 'Water −' + C.CARE.waterCut * 100 + '%'}</button>` +
      `<button data-care="fert" data-w="${where}" data-id="${id}" ${rec.f || !fert ? 'disabled' : ''}>🧪 ${rec.f ? 'Fertilised' : 'Fertilise −' + C.CARE.fertCut * 100 + '% (' + fert + ')'}</button>`;
  }
  function openCare(where, id) { ui.care.dataset.where = where; ui.care.dataset.id = id; openPanel(ui.care); renderCare(); }
  function renderCare() {
    const pr = state.profile, where = ui.care.dataset.where, id = ui.care.dataset.id;
    const coll = where === 'bed' ? pr.garden.beds : where === 'plot' ? pr.garden.plots : where === 'pot' ? pr.garden.flowerPots : pr.garden.trees;
    const rec = coll[id]; if (!rec) { closePanels(); return; }
    const info = C.plantInfo(rec.s), pg = C.progress(rec, where, pr.garden.pots, ctx.serverNow());
    const left = (1 - pg) * C.cycleMs(rec, where, pr.garden.pots) / 60000;
    ui.care.querySelector('header b').textContent = info.icon + ' ' + info.name + (where === 'tree' && rec.m ? ' — fruiting' : '');
    ui.care.querySelector('.body').innerHTML = `<div class="vc-bar"><div style="width:${pg * 100}%"></div></div><div class="small muted">${Math.floor(pg * 100)}% · about ${fmtMin(Math.max(0, left))}</div>
      <div class="row" style="margin-top:10px;justify-content:center">${pg >= 1 ? '<span>Ready to harvest!</span>' : careButtons(where, id, rec)}</div>
      <div class="small muted" style="margin-top:8px">Each growth cycle you can water once and fertilise once.</div>`;
  }
  const careClick = (e) => { const b = e.target.closest('button'); if (b && b.dataset.care) { send({ type: 'care', where: b.dataset.w, id: b.dataset.id, what: b.dataset.care }); floatText(b.dataset.care === 'water' ? '💧' : '🧪', '#4fc3f7'); blip([520, 620], 0.05, 0.06); } };
  ui.care.querySelector('.body').onclick = careClick;
  function renderPots() {
    const pr = state.profile, g = pr.garden, U = C.UPGRADES.pots, cap = U[g.pots].cap, now = ctx.serverNow();
    const owned = Object.keys(C.POTS).filter((k) => k !== 'clay' && pr.inv['pot:' + k] > 0);
    let h = `<div class="small muted note">${U[g.pots].name} · ${cap}/24 pots${g.pots < 2 ? ` · Buy ${U[g.pots + 1].name} in the Shop → Upgrades` : ` · Flowers grow 20% faster, ${C.CARE.cloudYield} blooms per harvest`} · Better pots: faster growth and a chance of an extra bloom</div><div class="grid pots">`;
    for (let i = 0; i < 24; i++) {
      const tier = i < 8 ? '☁️ Island 1' : i < 16 ? '☁️ Island 2' : '☁️ Island 3';
      if (i >= cap) { h += card('🔒', 'Pot ' + (i + 1), tier, '', 'locked'); continue; }
      const PT = C.POTS[g.potTypes[i]] || C.POTS.clay, rec = g.flowerPots[i];
      const swap = owned.length || g.potTypes[i] ? `<select data-potsel="${i}"><option value="">🔄 Change pot…</option><option value="clay">${C.POTS.clay.icon} ${C.POTS.clay.name}</option>${owned.map((k) => `<option value="${k}">${C.POTS[k].icon} ${C.POTS[k].name} (${pr.inv['pot:' + k]})</option>`).join('')}</select>` : '';
      if (!rec) { h += card(PT.icon, 'Pot ' + (i + 1), tier + ' · ' + PT.name, `<button class="primary" data-pplant="${i}">Plant flower</button>${swap}`); continue; }
      const info = C.plantInfo(rec.s), pg = C.progress(rec, 'pot', g.pots, now, g.boosts);
      h += card(info.icon, info.name, `${tier} · ${PT.icon} · ${pg >= 1 ? '🌟 in bloom!' : Math.floor(pg * 100) + '%'}<div class="vc-bar"><div style="width:${pg * 100}%"></div></div>`, pg >= 1 ? `<button class="primary" data-pharv="${i}">Pick</button>` : careButtons('pot', i, rec));
    }
    ui.pots.querySelector('.body').innerHTML = h + '</div>';
  }
  ui.pots.querySelector('.body').onclick = (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.pplant) openPlantPicker('pot', b.dataset.pplant);
    if (b.dataset.pharv) send({ type: 'harvest', where: 'pot', id: b.dataset.pharv });
    careClick(e);
  };
  ui.pots.querySelector('.body').onchange = (e) => { const s = e.target.closest('select'); if (s && s.dataset.potsel && s.value) send({ type: 'setPot', i: +s.dataset.potsel, pot: s.value }); };
  // ---- v5 house decoration (fixed furniture slots on 2 floors) ----
  function renderHouse() {
    const pr = state.profile, g = pr.garden, H = C.UPGRADES.house, cap = H[g.house | 0].cap;
    const owned = Object.keys(C.FURNITURE).filter((k) => pr.inv['furn:' + k] > 0);
    const slots = (extras.farm && extras.farm.houseSlots) || [];
    let h = `<div class="small muted note">${H[g.house | 0].name} · ${cap} furniture spots${(g.house | 0) < 2 ? ` · Upgrade to "${H[(g.house | 0) + 1].name}" in the Shop (House tab)` : ''} · Buy furniture in the Shop → 🛋️ House tab</div>`;
    [1, 2].forEach((fl) => {
      h += `<h4>${fl === 1 ? '🏠 Ground floor' : '🛏️ Upstairs'}</h4><div class="grid">`;
      slots.forEach((S, i) => {
        if (S.floor !== fl) return;
        if (i >= cap) { h += card('🔒', 'Spot ' + (i + 1), 'Upgrade the house to unlock', '', 'locked'); return; }
        const it = (g.furniture || {})[i], F = it && C.FURNITURE[it];
        const sel = owned.length ? `<select data-fslot="${i}"><option value="">${it ? '🔄 Replace with…' : '➕ Place…'}</option>${owned.map((k) => `<option value="${k}">${C.FURNITURE[k].icon} ${C.FURNITURE[k].name} (${pr.inv['furn:' + k]})</option>`).join('')}</select>` : '';
        h += card(F ? F.icon : '⬜', F ? F.name : 'Spot ' + (i + 1), F ? 'Placed' : 'Empty', (it ? `<button data-fremove="${i}">Store</button>` : '') + sel);
      });
      h += '</div>';
    });
    ui.house.querySelector('.body').innerHTML = h;
  }
  ui.house.querySelector('.body').onclick = (e) => { const b = e.target.closest('button'); if (b && b.dataset.fremove) send({ type: 'furnRemove', slot: +b.dataset.fremove }); };
  ui.house.querySelector('.body').onchange = (e) => { const s = e.target.closest('select'); if (s && s.dataset.fslot && s.value) send({ type: 'furnPlace', slot: +s.dataset.fslot, item: s.value }); };
  // ---- v5 animal pens ----
  function openPen(penKey) { ui.pen.dataset.pen = penKey; openPanel(ui.pen); renderPen(); }
  function renderPen() {
    const pr = state.profile, g = pr.garden, penKey = ui.pen.dataset.pen, pen = WORLD.garden.pens[penKey]; if (!pen) return;
    const A = C.ANIMALS[pen.kind], list = (g.animals || []).filter((a) => a.kind === pen.kind), cap = C.UPGRADES[penKey][g[penKey] | 0].cap, now = ctx.serverNow();
    const foods = A.foods.map((f) => `${C.itemInfo(f).icon} ${C.itemInfo(f).name}: <b>${pr.inv[f] || 0}</b>`).join(' · ');
    const hungry = list.filter((a) => !a.fedAt).length;
    ui.pen.querySelector('header b').textContent = A.icon + ' ' + pen.name;
    let h = `<div class="small muted note">${list.length}/${cap} animals · Food: ${foods}<br>Feed them → after ${A.produceMin} min there is ${C.PRODUCTS[A.product].icon} ${C.PRODUCTS[A.product].name.toLowerCase()} → walk up to the animal to collect it → it is hungry again.</div>`;
    h += `<div style="margin:6px 0"><button class="primary" data-feed="${pen.kind}" ${hungry ? '' : 'disabled'}>🍽️ Feed ${hungry} hungry</button></div><div class="grid">`;
    h += list.map((a, i) => { const st = !a.fedAt ? '😋 Hungry' : now - a.fedAt >= A.produceMin * 60000 ? `${C.PRODUCTS[A.product].icon} Product ready!` : `⏳ ${Math.ceil((A.produceMin * 60000 - (now - a.fedAt)) / 1000)} s`; return card(A.icon, A.name + ' ' + (i + 1), st, ''); }).join('');
    h += list.length ? '</div>' : '</div><div class="muted">This pen is empty. Buy a ' + A.name.toLowerCase() + ' in the Shop → 🐔 Animals tab.</div>';
    ui.pen.querySelector('.body').innerHTML = h;
  }
  ui.pen.querySelector('.body').onclick = (e) => { const b = e.target.closest('button'); if (b && b.dataset.feed) send({ type: 'feedAnimals', kind: b.dataset.feed }); };
  setInterval(() => { if (!ui.pen.classList.contains('hidden')) renderPen(); if (!ui.house.classList.contains('hidden') && document.activeElement.tagName !== 'SELECT') renderHouse(); }, 1000);
  setInterval(() => { if (!ui.pots.classList.contains('hidden')) renderPots(); if (!ui.care.classList.contains('hidden')) renderCare(); if (state.area === 'garden') renderHud(); }, 1000);

  // ===================================================================== fish models (one look per species: shape, colours, pattern, fins)
  function buildFishModel(sp, size, scaleOverride) {
    const F = C.FISH[sp] || C.FISH.ro, g = new THREE.Group(), R = 0.3;
    const dims = { oval: [0.5, 0.62, 1.25], slim: [0.36, 0.44, 1.5], round: [0.56, 0.78, 1.0], tall: [0.3, 1.05, 0.95], long: [0.4, 0.46, 1.95] }[F.shape || 'oval'];
    const a = R * dims[0], b = R * dims[1], c = R * dims[2];
    const body = sphere(R, F.color, 0, 0, 0, g); body.scale.set(dims[0], dims[1], dims[2]); body.castShadow = false;
    const belly = new THREE.Mesh(new THREE.SphereGeometry(R * 1.01, 16, 10, 0, Math.PI * 2, Math.PI * 0.58, Math.PI * 0.42), toon(F.belly || F.color)); belly.scale.set(dims[0], dims[1], dims[2]); g.add(belly);
    const ringAt = (z, tube, col) => { const f = Math.sqrt(Math.max(0, 1 - (z / c) ** 2)); if (f < 0.2) return; const r = new THREE.Mesh(new THREE.TorusGeometry(1, tube, 6, 24), toon(col)); r.scale.set(a * f * 1.02, b * f * 1.02, 1); r.position.z = z; g.add(r); };
    const P = F.pat;
    if (P && P.t === 'stripes') [-0.35, -0.05, 0.25].forEach((k) => ringAt(c * k, 0.05, P.c));
    if (P && P.t === 'bands') { [-0.45, 0.05, 0.5].forEach((k) => ringAt(c * k, 0.14, P.c)); if (sp === 'he') [-0.45, 0.05, 0.5].forEach((k) => ringAt(c * k + 0.03, 0.03, '#212121')); }
    if (P && P.t === 'spots') for (let i = 0; i < 9; i++) { const u = (i * 2.39) % 6.28, v = -0.6 + (i % 5) * 0.3; const s = sphere(0.045 + (i % 3) * 0.02, P.c, Math.cos(u) * a * Math.sqrt(1 - v * v) * 0.98, b * 0.35 + Math.abs(Math.sin(u)) * b * 0.4, v * c, g); s.scale.y = 0.5; }
    if (P && P.t === 'line') { const l = sphere(R, P.c, 0, b * 0.15, 0, g); l.scale.set(dims[0] * 1.03, dims[1] * 0.18, dims[2] * 0.85); }
    // eyes
    [-1, 1].forEach((s) => { sphere(0.05, '#ffffff', s * a * 0.62, b * 0.25, c * 0.68, g); sphere(0.028, '#111111', s * a * 0.7, b * 0.25, c * 0.72, g); });
    // tail fin
    const finC = F.finC || F.color;
    const tail = new THREE.Group(); tail.position.z = -c * 0.92; g.add(tail);
    const big = F.fin === 'fan' ? 1.9 : F.fin === 'long' ? 2.3 : 1;
    const tf = mesh(new THREE.ConeGeometry(0.2 * big, 0.36 * big, 4), finC, 0, 0, -0.16 * big); tf.rotation.x = -Math.PI / 2; tf.scale.x = 0.25; tail.add(tf);
    if (F.fin === 'long' || F.fin === 'fan') { const t2 = mesh(new THREE.ConeGeometry(0.14 * big, 0.3 * big, 4), F.color, 0, 0.04, -0.12 * big); t2.rotation.x = -Math.PI / 2 - 0.3; t2.scale.x = 0.2; tail.add(t2); }
    // dorsal / ventral fins
    const dor = mesh(new THREE.ConeGeometry(0.12, (F.shape === 'tall' ? 0.5 : 0.22) * (F.fin === 'long' ? 1.6 : 1), 3), finC, 0, b * 0.95, -c * 0.1); dor.scale.z = 2.2; dor.rotation.x = -0.35; g.add(dor);
    if (F.shape === 'tall' || F.fin === 'long') { const ven = mesh(new THREE.ConeGeometry(0.1, 0.45, 3), finC, 0, -b * 0.95, -c * 0.05); ven.rotation.x = Math.PI + 0.35; ven.scale.z = 2; g.add(ven); }
    [-1, 1].forEach((s) => { const pf = mesh(new THREE.ConeGeometry(0.06, 0.16, 3), finC, s * a * 0.95, -b * 0.2, c * 0.25); pf.rotation.z = s * 1.2; g.add(pf); });
    if (F.whisk) [-1, 1].forEach((s) => { const w = cyl(0.008, 0.012, F.whisk, '#3e2723', s * a * 0.4, -b * 0.15, c * 0.95 + F.whisk * 0.3, g); w.rotation.x = Math.PI / 2 - 0.4; w.rotation.z = s * 0.5; });
    if (F.glow) { const halo = new THREE.Mesh(new THREE.SphereGeometry(R * 1.35, 16, 12), new THREE.MeshBasicMaterial({ color: F.color, transparent: true, opacity: 0.22, depthWrite: false })); halo.scale.set(dims[0], dims[1], dims[2]); g.add(halo); }
    g.scale.setScalar(scaleOverride || (0.45 + Math.min(90, size || 20) / 55));
    g.userData.tail = tail;
    return g;
  }

  // ===================================================================== fishing (v5: sit on a chair, cast, shadow swims up, strike, tap to hold the fish in the green, show the catch)
  const fish = { phase: 'idle', spot: -1, t: 0, biteAt: 0, tier: 1, shadowK: 1, game: null, hold: null, cast: null };
  const MOVE = ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'];
  const moveKeyDown = () => !ctx.typing() && (MOVE.some((k) => ctx.keys.has(k)) || !!(ctx.joyOn && ctx.joyOn()));
  const touchUI = () => innerWidth < 768; // phone layout: no keyboard, so fishing gets its own big button (#vcReel) and a Stand up button
  const REEL = { seated: 'Cast 🎣', bite: 'STRIKE! ❗', game: 'TAP! TAP! 🐟' }; // what the big button says in each fishing phase
  const bobber = new THREE.Group(); sphere(0.14, '#ffffff', 0, 0.04, 0, bobber); sphere(0.15, '#e53935', 0, 0.17, 0, bobber); cyl(0.02, 0.02, 0.25, '#212121', 0, 0.35, 0, bobber); bobber.visible = false; scene.add(bobber);
  const lineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
  const line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: '#f5f5f5' })); line.visible = false; line.frustumCulled = false; scene.add(line);
  const rodPiv = new THREE.Group(); rodPiv.position.set(0.4, 1.0, 0.3); // in the avatar's hand (campus-export character)
  cyl(0.022, 0.045, 2.9, '#6d4c41', 0, 1.45, 0, rodPiv); const reel = cyl(0.09, 0.09, 0.08, '#90a4ae', 0.07, 0.4, 0, rodPiv); reel.rotation.z = Math.PI / 2; rodPiv.visible = false;
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.5, 20), new THREE.MeshBasicMaterial({ color: '#0b2530', transparent: true, opacity: 0, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.2; scene.add(shadow);
  const splashes = [];
  function splash(x, z, big) { for (let i = 0; i < (big ? 2 : 1); i++) { const r = new THREE.Mesh(new THREE.RingGeometry(0.15, 0.24, 20), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false })); r.rotation.x = -Math.PI / 2; r.position.set(x, 0.22, z); scene.add(r); splashes.push({ m: r, t: -i * 0.2 }); } blip([big ? 220 : 340, 160], 0.05, 0.07); }
  ui.fishGame.addEventListener('pointerdown', (e) => { if (fish.phase === 'game') { e.preventDefault(); fishHit(); } }); // tap anywhere on the meter
  ui.fishGame.innerHTML = '<div class="ttl">🎣 Keep the fish in the green: tap <kbd>E</kbd> / <kbd>Space</kbd> again and again!</div><div class="vbox"><div class="vtrack"><div class="vzone"></div><div class="vfish">🐟</div></div><div class="vprog"><div></div></div></div><div class="st"></div>';
  const tipWorld = () => { const p = me(); p.obj.updateMatrixWorld(true); return rodPiv.localToWorld(new THREE.Vector3(0, 2.9, 0)); };
  // a fishing spot (WORLD.fishSpots): a chair by the forest lake / stream (you sit), or a dock (you stand; none since the Garden Room was removed)
  function nearSpot(p) {
    let best = -1, bd = 1.9;
    WORLD.fishSpots.forEach((s, i) => { if ((s.area || 'forest') !== state.area || (s.room || null) !== (p.room || null)) return; const d = Math.hypot(p.x - s.x, p.z - s.z); if (d < bd) { bd = d; best = i; } });
    return best;
  }
  function sitAt(i) {
    const p = me(), s = WORLD.fishSpots[i]; if (!p || !s) return;
    p.x = p.tx = s.x; p.z = p.tz = s.z; p.ry = p.try = s.ry; p.pose = s.stand ? null : 'sit';
    fish.phase = 'seated'; fish.spot = i; if (touchUI()) $('#nut-dung').hidden = false;
    send({ type: 'move', x: p.x, z: p.z, ry: p.ry, moving: false });
    if (rodPiv.parent !== p.obj) p.obj.add(rodPiv); rodPiv.visible = true; rodPiv.rotation.set(0.55, 0, 0);
  }
  function clearRig() { bobber.visible = false; line.visible = false; shadow.material.opacity = 0; ui.fishGame.classList.add('hidden'); fish.game = null; fish.cast = null; }
  function standUp() {
    const p = me();
    if (['waiting', 'bite', 'game'].includes(fish.phase)) send({ type: 'fishCancel' });
    clearRig(); if (fish.hold) { fish.hold.obj.parent && fish.hold.obj.parent.remove(fish.hold.obj); fish.hold = null; }
    rodPiv.visible = false;
    const s = WORLD.fishSpots[fish.spot];
    if (p) { p.pose = null; if (s) { p.x = p.tx = s.x - Math.sin(s.ry) * 1.3; p.z = p.tz = s.z - Math.cos(s.ry) * 1.3; send({ type: 'move', x: p.x, z: p.z, ry: p.ry, moving: false }); } }
    fish.phase = 'idle'; fish.spot = -1; if (!(p && p.seat)) $('#nut-dung').hidden = true;
  }
  function stopFishing() { if (fish.phase !== 'idle') standUp(); }
  function startCast() {
    if (fish.phase !== 'seated') return;
    if (state.profile.bag.length >= ECON.bagMax) { toast('Your fish bag is full (' + ECON.bagMax + ' fish): sell some or release them into your tank.'); return; }
    fish.phase = 'casting'; fish.t = 0; fish.biteAt = 0; fish.cast = null; fish.sent = false; blip([392, 523], 0.05, 0.06);
  }
  function onCast(m) { fish.biteAt = performance.now() + m.biteIn; fish.tier = m.tier || 1; fish.shadowK = m.shadow || 1; fish.shStart = null; }
  function startGame() {
    const tier = fish.tier || 1;
    fish.phase = 'game';
    fish.game = { y: 0.45, v: 0, zc: 0.5, zs: [0, 0.34, 0.28, 0.22, 0.17][tier], zv: [0, 0.22, 0.34, 0.48, 0.62][tier], target: 0.5, retarget: 0, prog: 0.3,
      rin: [0, 0.34, 0.28, 0.23, 0.19][tier], rout: [0, 0.16, 0.2, 0.24, 0.28][tier] };
    ui.fishGame.classList.remove('hidden'); blip([700, 500, 900], 0.06, 0.15);
  }
  function fishHit() { const g = fish.game; if (!g) return; g.v = Math.min(1.6, g.v + 0.95); blip([520 + g.y * 300], 0.03, 0.04); }
  function finishFishing(ok) { send({ type: 'fishReel', ok }); fish.phase = 'result'; ui.fishGame.classList.add('hidden'); fish.game = null; }
  function drawGame() {
    const g = fish.game; if (!g) return;
    const z = ui.fishGame.querySelector('.vzone'); z.style.bottom = ((g.zc - g.zs / 2) * 100) + '%'; z.style.height = (g.zs * 100) + '%';
    ui.fishGame.querySelector('.vfish').style.bottom = (g.y * 100) + '%';
    ui.fishGame.querySelector('.vprog > div').style.height = (g.prog * 100) + '%';
    ui.fishGame.querySelector('.st').textContent = ['', 'A small fish, easy', 'A fairly strong fish', 'A very strong fish!', 'LEGENDARY!!'][fish.tier] || '';
  }
  function showCatch(f) {
    const p = me(); if (!p) return;
    const F = C.FISH[f.sp], obj = buildFishModel(f.sp, f.size, 0.6 + f.size / 70);
    obj.position.set(0, 2.5, 0.35); obj.rotation.y = Math.PI / 2; p.obj.add(obj);
    fish.hold = { obj, t: 0 }; fish.phase = 'hold';
    floatText(`${F.name} ${f.size} cm`, '#4dd0e1'); blip([660, 880, 1100], 0.08, 0.12);
    toast(`🎣 ${F.name}, ${f.size} cm (${F.rarity})! Added to your Bag.`);
  }
  function paintReel() {
    const label = touchUI() ? REEL[fish.phase] : null;
    ui.reelBtn.classList.toggle('hidden', !label);
    if (label && ui.reelBtn.textContent !== label) { ui.reelBtn.textContent = label; ui.reelBtn.classList.toggle('hot', fish.phase !== 'seated'); }
  }
  ui.reelBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); if (REEL[fish.phase]) fishingE(); }); // cast / strike / reel: the same as pressing E
  function updateFishing(dt, t) {
    paintReel();
    for (let i = splashes.length - 1; i >= 0; i--) { const s = splashes[i]; s.t += dt; const k = Math.max(0, s.t) / 0.9; s.m.scale.setScalar(1 + k * 4); s.m.material.opacity = 0.8 * (1 - k); if (k >= 1) { scene.remove(s.m); splashes.splice(i, 1); } }
    if (fish.phase === 'idle') return;
    const p = me(); if (!p) return;
    const s = WORLD.fishSpots[fish.spot];
    if (s) { p.x = p.tx = s.x; p.z = p.tz = s.z; p.ry = p.try = s.ry; p.pose = s.stand ? null : 'sit'; p.moving = false; }
    if ((fish.phase === 'seated' || fish.phase === 'waiting') && moveKeyDown()) { standUp(); return; }
    fish.t += dt;
    const now = performance.now();
    if (fish.phase === 'casting') {
      const T = fish.t, lerp = (x, y, k) => x + (y - x) * Math.max(0, Math.min(1, k));
      rodPiv.rotation.x = T < 0.35 ? lerp(0.55, -1.3, T / 0.35) : lerp(-1.3, 0.85, (T - 0.35) / 0.2);
      if (T >= 0.45 && !fish.cast) { const tip = tipWorld(); fish.cast = { sx: tip.x, sy: tip.y, sz: tip.z, t: 0 }; bobber.visible = true; line.visible = true; if (!fish.sent) { fish.sent = true; send({ type: 'fishCast', spot: fish.spot }); } }
      if (fish.cast) {
        const c = fish.cast; c.t += dt; const k = Math.min(1, c.t / 0.7);
        bobber.position.set(c.sx + (s.bx - c.sx) * k, c.sy + (0.2 - c.sy) * k + Math.sin(k * Math.PI) * 2.6, c.sz + (s.bz - c.sz) * k);
        if (k >= 1) { splash(s.bx, s.bz, false); fish.phase = 'waiting'; fish.t = 0; }
      }
    } else if (fish.phase === 'waiting' || fish.phase === 'bite' || fish.phase === 'game' || fish.phase === 'result') {
      const left = fish.biteAt ? fish.biteAt - now : 1e9;
      let by = 0.2 + Math.sin(t * 2.5) * 0.03;
      // the fish's shadow appears and swims up to the float, then nibbles
      if (fish.phase === 'waiting' && left < 4200) {
        if (!fish.shStart) { let dx = s.bx - s.x, dz = s.bz - s.z; const d = Math.hypot(dx, dz) || 1; const side = Math.random() < 0.5 ? 1 : -1; const far = s.kind === 'dock' ? 1.6 : 3.2, wide = s.kind === 'dock' ? 1.6 : 2.4; fish.shStart = { x: s.bx + (dx / d) * far + (-dz / d) * wide * side, z: s.bz + (dz / d) * far + (dx / d) * wide * side }; }
        const k = Math.max(0, Math.min(1, (4200 - left) / 3000));
        shadow.position.set(fish.shStart.x + (s.bx - fish.shStart.x) * k + Math.sin(t * 3) * 0.15 * (1 - k), 0.2, fish.shStart.z + (s.bz - fish.shStart.z) * k);
        shadow.rotation.z = Math.atan2(s.bx - fish.shStart.x, s.bz - fish.shStart.z);
        shadow.scale.set(0.55 * fish.shadowK, 1.5 * fish.shadowK, 1); shadow.material.opacity = Math.min(0.42, 0.42 * k * 3);
        if (left < 1100) by = 0.2 - Math.abs(Math.sin(t * 18)) * 0.07; // nibbling
      }
      if (fish.phase === 'waiting' && fish.biteAt && left <= 0) { fish.phase = 'bite'; fish.biteT = now; splash(s.bx, s.bz, true); floatText(touchUI() ? '❗ A bite! Tap STRIKE' : '❗ A bite! Press E', '#ff7043'); blip([700, 500, 900], 0.06, 0.15); }
      if (fish.phase === 'bite') { by = 0.02; if (now - fish.biteT > (touchUI() ? 2400 : 1300)) { send({ type: 'fishReel', ok: false }); fish.phase = 'result'; } }
      if (fish.phase === 'game') {
        by = 0.12 + Math.sin(t * 20) * 0.06; rodPiv.rotation.x = 0.5 + Math.sin(t * 14) * 0.12;
        const g = fish.game;
        g.v -= 1.9 * dt; g.y += g.v * dt; if (g.y < 0) { g.y = 0; g.v = 0; } if (g.y > 1) { g.y = 1; g.v = 0; }
        g.retarget -= dt; if (g.retarget <= 0) { g.retarget = 0.5 + Math.random() * 1.2; g.target = g.zs / 2 + Math.random() * (1 - g.zs); }
        g.zc += Math.sign(g.target - g.zc) * Math.min(Math.abs(g.target - g.zc), g.zv * dt);
        g.prog += (Math.abs(g.y - g.zc) < g.zs / 2 ? g.rin : -g.rout) * dt;
        shadow.position.set(s.bx + Math.sin(t * 7) * 0.4, 0.2, s.bz + Math.cos(t * 5) * 0.4); shadow.material.opacity = 0.45;
        drawGame();
        if (g.prog >= 1) finishFishing(true); else if (g.prog <= 0) finishFishing(false);
      }
      bobber.position.set(s.bx, by, s.bz);
      if (fish.phase === 'result' && fish.t > 8) { clearRig(); fish.phase = 'seated'; } // the server never answered
    } else if (fish.phase === 'hold') {
      const h = fish.hold; h.t += dt;
      h.obj.rotation.z = Math.sin(t * 18) * 0.5; h.obj.position.y = 2.5 + Math.abs(Math.sin(t * 9)) * 0.15;
      if (h.obj.userData.tail) h.obj.userData.tail.rotation.y = Math.sin(t * 25) * 0.6;
      if (h.t > 2.6) { h.obj.parent && h.obj.parent.remove(h.obj); fish.hold = null; fish.phase = 'seated'; rodPiv.rotation.x = 0.55; }
    }
    if (line.visible) { const tip = tipWorld(), a = lineGeo.attributes.position; a.setXYZ(0, tip.x, tip.y, tip.z); a.setXYZ(1, bobber.position.x, bobber.position.y + 0.3, bobber.position.z); a.needsUpdate = true; }
  }
  function fishingE() { // returns true if E was used by fishing
    const p = me(); if (!p) return false;
    if (fish.phase === 'idle') { const i = nearSpot(p); if (i >= 0) { sitAt(i); return true; } return false; }
    if (fish.phase === 'seated') { startCast(); return true; }
    if (fish.phase === 'waiting') { send({ type: 'fishReel', ok: true }); fish.phase = 'result'; return true; } // too early -> server says so
    if (fish.phase === 'bite') { startGame(); return true; }
    if (fish.phase === 'game') { fishHit(); return true; }
    return true;
  }
  function fishingHint() {
    switch (fish.phase) {
      case 'seated': return '<kbd>E</kbd> cast your line 🎣 · <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> ' + ((WORLD.fishSpots[fish.spot] || {}).stand ? 'put the rod away' : 'stand up');
      case 'casting': return '🎣 Casting…';
      case 'waiting': return touchUI() ? '🎣 Wait for the bite… do not strike early!' : 'Waiting… watch the shadow swim up to the float · do not strike too early!';
      case 'bite': return '❗ <kbd>E</kbd> STRIKE NOW!';
      case 'game': return 'Tap <kbd>E</kbd> / <kbd>Space</kbd> again and again to keep the fish in the green';
      case 'hold': return '🐟 Caught it!';
      case 'result': return '…';
    }
    const p = me(), i = p ? nearSpot(p) : -1; return i < 0 ? '' : WORLD.fishSpots[i].stand ? '<kbd>E</kbd> pick up a rod at the dock 🎣' : '<kbd>E</kbd> sit on the fishing chair 🎣';
  }

  // ===================================================================== forest playground (client-side rides: swing, merry-go-round, spring riders, climbing rock)
  const PLAY = extras.play || {}, PG = WORLD.playground;
  let act = null; // { type, i, t, y, ... }
  function nearPlay(p) {
    if (state.area !== 'forest' || !PG) return null;
    for (let i = 0; i < (PLAY.swings || []).length; i++) { const s = PLAY.swings[i]; if (Math.hypot(p.x - s.x, p.z - s.z) < 1.3) return { type: 'swing', i }; }
    if (PLAY.merry && Math.hypot(p.x - PLAY.merry.x, p.z - PLAY.merry.z) < PLAY.merry.r + 0.9) return { type: 'merry' };
    for (let i = 0; i < (PLAY.riders || []).length; i++) { const r = PLAY.riders[i]; if (Math.hypot(p.x - r.x, p.z - r.z) < 1.4) return { type: 'rider', i }; }
    if (Math.hypot(p.x - PG.climb.base.x, p.z - PG.climb.base.z) < 1.8) return { type: 'climb' };
    return null;
  }
  const PLAY_NAMES = { swing: ['get on the swing', 'Swinging'], merry: ['ride the merry-go-round', 'On the merry-go-round'], rider: ['ride the spring rider', 'On the spring rider'], climb: ['climb the rock', 'Climbing'] }; // [what E does, what you are doing]
  function startAct(n) {
    const p = me(); if (!p) return;
    act = Object.assign({ t: 0, y: 0, amp: 0.1, sendT: 0, phase: 'up' }, n);
    if (n.type === 'merry') { const M = PLAY.merry; act.off = Math.atan2(-(p.z - M.z), p.x - M.x) - M.g.rotation.y; }
    if (n.type === 'climb') { act.sx = p.x; act.sz = p.z; }
    blip([523, 659], 0.05, 0.06);
  }
  function endAct() {
    const p = me(); if (!p || !act) { act = null; return; }
    p.pose = null; p.obj.rotation.x = 0; p.obj.rotation.z = 0;
    if (act.type === 'swing') { const s = PLAY.swings[act.i]; s.piv.rotation.x = 0; p.x = p.tx = s.x; p.z = p.tz = s.z + 1.4; }
    if (act.type === 'merry') { PLAY.merry.spin = 0.6; const M = PLAY.merry, d = Math.hypot(p.x - M.x, p.z - M.z) || 1; p.x = p.tx = M.x + (p.x - M.x) / d * (M.r + 0.9); p.z = p.tz = M.z + (p.z - M.z) / d * (M.r + 0.9); }
    if (act.type === 'rider') { const r = PLAY.riders[act.i]; p.x = p.tx = r.x + 1.3; p.z = p.tz = r.z; }
    if (act.type === 'climb') { p.x = p.tx = PG.climb.base.x; p.z = p.tz = PG.climb.base.z; }
    act = null; send({ type: 'move', x: p.x, z: p.z, ry: p.ry, moving: false });
  }
  function updateAct(dt, t) {
    if (!act) return; const p = me(); if (!p) return;
    act.t += dt; act.sendT -= dt;
    const wantOut = act.t > 0.5 && moveKeyDown();
    if (act.type === 'swing') {
      const s = PLAY.swings[act.i]; act.amp = Math.min(0.8, act.amp + dt * 0.22);
      const th = act.amp * Math.sin(act.t * 2.1); s.piv.rotation.x = th;
      p.pose = 'sit'; p.ry = p.try = 0; p.x = p.tx = s.x; p.z = p.tz = s.z - s.len * Math.sin(th);
      act.y = s.top - s.len * Math.cos(th) - 0.5; p.obj.rotation.x = th * 0.6;
      if (wantOut) endAct();
    } else if (act.type === 'merry') {
      const M = PLAY.merry; M.spin = Math.min(1.8, M.spin + dt * 0.8);
      const r = M.g.rotation.y + act.off; p.x = p.tx = M.x + Math.cos(r) * 1.5; p.z = p.tz = M.z - Math.sin(r) * 1.5;
      p.ry = p.try = Math.atan2(-Math.sin(r), -Math.cos(r)); act.y = 0.42; p.moving = false;
      if (wantOut) endAct();
    } else if (act.type === 'rider') {
      const R = PLAY.riders[act.i]; R.wob = 1; p.pose = 'sit'; p.x = p.tx = R.x; p.z = p.tz = R.z - 0.1; p.ry = p.try = 0;
      act.y = 0.42 + Math.abs(Math.sin(t * 6)) * 0.08; p.obj.rotation.x = Math.sin(t * 6) * 0.12;
      if (wantOut) endAct();
    } else if (act.type === 'climb') {
      const Cl = PG.climb, top = Cl.top + 0.15;
      if (act.phase === 'up') {
        const k = Math.min(1, act.t / 3.6); p.ry = p.try = Math.atan2(Cl.x - Cl.base.x, Cl.z - Cl.base.z);
        const r = 2.2 - k * 2.2 * (k > 0.85 ? 1 : 0.15); p.x = p.tx = Cl.x + (Cl.base.x - Cl.x) / 2.8 * Math.max(0, r + 0.6); p.z = p.tz = Cl.z + (Cl.base.z - Cl.z) / 2.8 * Math.max(0, r + 0.6);
        act.y = top * k; p.moving = true;
        if (k >= 1) { act.phase = 'top'; act.t = 0; p.x = p.tx = Cl.x; p.z = p.tz = Cl.z; p.moving = false; send({ type: 'move', x: p.x, z: p.z, ry: p.ry, moving: false }); floatText('🚩 You made it to the top!', '#ffd23f'); }
      } else if (act.phase === 'top') { act.y = top; if (wantOut) { act.phase = 'down'; act.t = 0; } }
      else { const k = Math.min(1, act.t / 2.6); act.y = top * (1 - k); p.x = p.tx = Cl.x + (Cl.base.x - Cl.x) * k; p.z = p.tz = Cl.z + (Cl.base.z - Cl.z) * k; p.moving = true; if (k >= 1) endAct(); }
    }
    if (act && act.sendT <= 0) { act.sendT = 0.3; send({ type: 'move', x: p.x, z: p.z, ry: p.ry, moving: !!p.moving }); }
  }
  // ===================================================================== food & drink stands (buff: more Xu while studying)
  function nearFood(p) { return WORLD.foodStands.find((s) => (s.area || 'campus') === state.area && Math.hypot(p.x - s.front.x, p.z - s.front.z) < 2.8) || null; }
  function openFood(st) {
    ui.food.dataset.stand = st.id; ui.food.querySelector('header b').textContent = '🍽️ ' + st.name;
    const b = state.profile.buff, nowS = ctx.serverNow();
    ui.food.querySelector('.body').innerHTML = (b && b.until > nowS ? `<div class="small note">Wide awake ${b.icon || '⚡'} x${b.mult} · ${Math.ceil((b.until - nowS) / 60000)} min left</div>` : '<div class="small muted note">Food and drinks keep you wide awake: studying at a table pays more Xu for a while.</div>') +
      '<div class="grid">' + Object.entries(C.FOODS).map(([k, f]) => card(f.icon, f.name, `Study x${f.mult} Xu · ${f.min} min`, `<button class="primary" data-food="${k}">${f.price} Xu</button>`)).join('') + '</div>';
    openPanel(ui.food);
  }

  // ===================================================================== garden (plots, pond fish, decor)
  const garden = makeGarden();

  // ===================================================================== interaction (E) + hints
  function nearestTrash(p, d = 2.3) { if (p.room) return null; let best = null; for (const t of state.trash) { const k = Math.hypot(p.x - t.x, p.z - t.z); if (k < d && (!best || k < best.k)) best = { t, k }; } return best && best.t; }
  function nearestBin(p) { return p.room ? -1 : WORLD.bins.findIndex((b) => Math.hypot(p.x - b.x, p.z - b.z) < 3.2); }
  const nearShop = (p) => state.area === 'campus' && WORLD.shops.some((s) => (s.room || null) === (p.room || null) && Math.hypot(p.x - s.x, p.z - s.z) < 3.4); // Shop room counter, Garden Room stall
  const nearMarketBoard = (p) => state.area === 'campus' && !p.room && Math.hypot(p.x - WORLD.market.front.x, p.z - WORLD.market.front.z) < 3.4;
  const nearMerchant = (p) => state.area === 'campus' && !p.room && state.merchant && Math.hypot(p.x - state.merchant.x, p.z - state.merchant.z) < 3.4;
  // travelling merchant NPC (visible on the lobby while the server says he's here)
  const merchantObj = ctx.makeCharacter('#8d6e63'); merchantObj.visible = false; scene.add(merchantObj);
  { const b = merchantObj.userData.body; box(0.6, 0.7, 0.34, '#a1887f', 0, 0.72, -0.4, b); box(0.64, 0.1, 0.38, '#6d4c41', 0, 1.1, -0.4, b); cyl(0.62, 0.62, 0.05, '#d7b98e', 0, 1.52, 0, b); cyl(0.28, 0.36, 0.3, '#d7b98e', 0, 1.68, 0, b); } // pack + straw hat, sized for Top1's chibi
  const merchantTag = document.createElement('div'); merchantTag.className = 'tag'; merchantTag.style.background = 'rgba(141,110,99,.9)'; merchantTag.textContent = '🧳 Merchant'; ctx.labelsEl.appendChild(merchantTag);
  function interact() {
    const p = me(); if (!p || p.seat || !state.profile) return false;
    if (act) { if (act.type === 'climb' && act.phase === 'top') { act.phase = 'down'; act.t = 0; } else if (act.type !== 'climb') endAct(); return true; }
    if (fish.phase !== 'idle' || nearSpot(p) >= 0) return fishingE();
    if (state.area !== 'garden' && !p.room) { const st = nearFood(p); if (st) { openFood(st); return true; } const pl = nearPlay(p); if (pl) { startAct(pl); return true; } }
    if (state.area === 'campus') {
      const tr = nearestTrash(p); if (tr) { send({ type: 'pickTrash', id: tr.id }); return true; }
      const bi = nearestBin(p); if (bi >= 0 && state.carry) { send({ type: 'dropTrash', bin: bi }); return true; }
      if (nearShop(p)) { openPanel(ui.shop); renderShop(); return true; }
      if (nearMerchant(p)) { openPanel(ui.merchantP); renderMerchant(); return true; }
      if (nearMarketBoard(p)) { openMarket('browse', false); return true; }
      if (!p.room && Math.hypot(p.x - WORLD.board.front.x, p.z - WORLD.board.front.z) < 3.4) { send({ type: 'board' }); return true; }
    }
    if (state.area === 'garden') return garden.interact(p);
    return false;
  }
  function hint(p) {
    if (!state.profile) return '';
    if (act) return act.type === 'climb' ? (act.phase === 'top' ? '🚩 On top! <kbd>E</kbd> or <kbd>WASD</kbd> to climb down' : '🧗 Climbing…') : '🎠 ' + PLAY_NAMES[act.type][1] + ' · <kbd>WASD</kbd> to get off';
    if (touchUI() && REEL[fish.phase]) return ''; // the big button names the action
    const fh = fishingHint(); if (fh) return fh;
    if (state.area !== 'garden' && !p.room) { const st = nearFood(p); if (st) return '<kbd>E</kbd> buy food and drinks at the ' + esc(st.name) + ' 🍽️'; const pl = nearPlay(p); if (pl) return '<kbd>E</kbd> ' + PLAY_NAMES[pl.type][0] + ' 🎠'; }
    if (state.area === 'campus') {
      if (nearestTrash(p)) return `<kbd>E</kbd> pick up litter (+${ECON.trashPick} Xu)`;
      if (state.carry && nearestBin(p) >= 0) return `<kbd>E</kbd> drop ${state.carry} item${state.carry === 1 ? '' : 's'} in the recycling bin (+${state.carry * ECON.trashDrop} Xu)`;
      if (nearShop(p)) return '<kbd>E</kbd> open Shop';
      if (nearMerchant(p)) return '<kbd>E</kbd> talk to the Merchant 🧳';
      if (nearMarketBoard(p)) return '<kbd>E</kbd> view Market 🏪';
      if (!p.room && Math.hypot(p.x - WORLD.board.front.x, p.z - WORLD.board.front.z) < 3.4) return '<kbd>E</kbd> view Weekly Leaderboard 🏆';
    }
    if (state.area === 'garden') return garden.hint(p);
    return '';
  }

  // ===================================================================== messages
  function onMessage(m) {
    switch (m.type) {
      case 'welcome': {
        state.profile = m.profile; state.trash = m.trash || []; state.carry = m.carry || 0;
        state.market = m.market || []; state.merchant = m.merchant || null;
        extras.setTrash(state.trash);
        for (const p of state.players.values()) p.area = p.area || 'campus';
        const p = me(); if (p) extras.setGardenOwner(p.name);
        ui.hud.classList.toggle('hidden', !m.profile);
        applyArea('campus'); renderHud();
        break;
      }
      case 'profile':
        state.profile = m.profile; renderHud(); if (state.area === 'garden') garden.sync();
        if (!ui.pots.classList.contains('hidden')) renderPots();
        if (!ui.care.classList.contains('hidden')) renderCare();
        if (!ui.market.classList.contains('hidden') && marketTab !== 'list') renderMarket();
        if (!ui.merchantP.classList.contains('hidden')) renderMerchant();
        if (!ui.seeds.classList.contains('hidden') && ui.seeds.dataset.where !== 'pot') closePanels();
        break;
      case 'market': state.market = m.list; if (!ui.market.classList.contains('hidden') && marketTab !== 'list') renderMarket(); break;
      case 'merchant': state.merchant = m.m; if (!ui.merchantP.classList.contains('hidden')) renderMerchant(); break;
      case 'sold': toast('🏷️ Sold ' + m.text + ' (+' + m.amount + ' Xu)'); floatText('+' + m.amount + ' Xu 🏷️'); coinSound(); break;
      case 'cared': if (!ui.care.classList.contains('hidden')) setTimeout(closePanels, 350); break;
      case 'gardenView': state.visit = { gid: m.gid, owner: m.owner, garden: Object.assign({ plots: {}, flowerPots: {}, trees: {}, fish: [], decor: [], tankDecor: [], boosts: [] }, m.garden), likes: m.likes, liked: m.liked }; break;
      case 'liked': if (state.visit && state.visit.gid === m.gid) { state.visit.liked = true; state.visit.likes = m.likes; } floatText('❤️', '#ff6b81'); blip([660, 990], 0.08, 0.1); renderHud(); break;
      case 'board': renderBoard(m); break;
      case 'friends': onFriends(m); break;
      case 'friendRequest': toast('💌 ' + m.name + ' wants to be friends. Open 👥 Friends to answer.'); blip([660, 880], 0.08, 0.1); break;
      case 'quiz': showQuiz(m); break;
      case 'quizResult':
        if (m.ok) { ui.quiz.classList.add('hidden'); toast('✅ ' + m.text + ' +' + ECON.pomodoroBonus + ' Xu'); }
        else { toast((m.retry ? '❌ ' : '😅 ') + m.text); if (!m.retry) ui.quiz.classList.add('hidden'); }
        break;
      case 'earn':
        if (m.capped && !m.amount) { toast(`You've hit today's ${ECON.dailyCap} Xu cap — come back tomorrow!`); break; }
        if (state.profile) state.profile.xu = m.xu;
        floatText(`+${m.amount} Xu ${(C.REASONS[m.reason] || {}).icon || ''}`); coinSound();
        if (m.reason === 'checkin') toast('📍 Check-in ' + m.note + ' +' + m.amount + ' Xu');
        if (m.reason === 'pomodoro') toast('⏱️ 25 focused minutes complete! +' + m.amount + ' Xu');
        renderHud(); ui.xu.parentElement.classList.remove('bump'); void ui.xu.offsetWidth; ui.xu.parentElement.classList.add('bump');
        break;
      case 'trash': state.trash = m.list; extras.setTrash(m.list); break;
      case 'carry': state.carry = m.n; renderHud(); break;
      case 'area': {
        const p = state.players.get(m.id); if (!p) break;
        const prevArea = p.area;
        p.area = m.area; p.gid = m.gid || null; p.x = p.tx = m.x; p.z = p.tz = m.z; p.ry = p.try = m.ry; p.moving = false; p.obj.position.set(m.x, 0, m.z);
        if (m.id === state.me) {
          if (m.area !== 'garden' || m.gid === p.ownGid || !state.visit || state.visit.gid !== m.gid) { if (!(m.area === 'garden' && state.visit && state.visit.gid === m.gid)) state.visit = null; }
          applyArea(m.area, prevArea); setTimeout(unfade, m.area === 'garden' || prevArea === 'garden' ? 350 : 120);
        }
        break;
      }
      case 'afk': ui.afk.classList.remove('hidden'); break;
      case 'fishCast': onCast(m); break;
      case 'fishResult':
        clearRig();
        if (m.ok) showCatch(m.fish);
        else { toast(m.why === 'early' ? '😅 Too early: the fish got scared and swam off!' : '💨 The fish escaped…'); if (fish.phase !== 'idle') fish.phase = 'seated'; }
        break;
      case 'ate': { const F = C.FOODS[m.item]; if (F) floatText(F.icon + ' Yum!', '#ffd23f'); break; }
      case 'animalsFed': if (m.n) { toast('🍽️ Fed ' + m.n + (m.n === 1 ? ' animal' : ' animals')); blip([523, 659], 0.06, 0.08); } break;
      case 'collected': { const P2 = C.PRODUCTS[m.product]; if (P2) { floatText(P2.icon + ' +1 ' + P2.name, '#fff59d'); blip([784, 988], 0.05, 0.08); } break; }
      case 'shopMsg': toast(m.text); if (m.ok) coinSound(); break;
      case 'harvested': { const s = C.plantInfo(m.seed); floatText(`${s.icon} +${m.n} ${s.name}`, '#9be37a'); blip([523, 659, 784], 0.07, 0.1); break; }
      case 'fed': toast(m.n ? `🍤 Fed ${m.n} fish — they grew!` : 'No fish are hungry, or you are out of fish food.'); break;
    }
  }

  // ===================================================================== per-frame
  function update(dt, t) {
    const p = me();
    extras.update(dt, t);
    if (p) {
      if (p.seat !== lastSeat) { lastSeat = p.seat; seatT = p.seat ? performance.now() : 0; }
      const st = studyStatus(); ui.status.textContent = st; ui.status.classList.toggle('hidden', !st);
      // forest gate (campus) + exit gate (forest)
      // v5: no prompt — just walk through the east gate (the area switches in place; lighting and sound blend)
      const inGate = Math.abs(p.z - WORLD.forestGate.z) < 3.6, fx = WORLD.fenceX;
      if (state.area === 'campus') { if (p.x < fx - 3.2) gateArmed = true; if (gateArmed && inGate && !p.room && p.x > fx + 0.6) { gateArmed = false; send({ type: 'area', to: 'forest' }); } }
      else if (state.area === 'forest') { if (p.x > fx + 2.8) exitArmed = true; if (exitArmed && inGate && p.x < fx + 0.7) { exitArmed = false; send({ type: 'area', to: 'campus' }); } }
    }
    updateFishing(dt, t);
    updateAct(dt, t);
    if (state.area === 'garden') garden.update(dt, t);
    // travelling merchant on the lobby
    const mm = state.merchant, showM = !!mm && state.area === 'campus';
    merchantObj.visible = showM;
    if (showM) {
      merchantObj.position.set(mm.x, 0, mm.z);
      if (p) merchantObj.rotation.y = Math.atan2(p.x - mm.x, p.z - mm.z);
      merchantObj.userData.body.position.y = Math.abs(Math.sin(t * 2)) * 0.05;
      ctx.project(mm.x, 3.0, mm.z, merchantTag);
    } else merchantTag.style.display = 'none';
    amb.update();
    updateEnv(dt);
    // floaters
    for (let i = floaters.length - 1; i >= 0; i--) {
      const f = floaters[i]; f.t += dt;
      if (!p || f.t > 1.6) { f.el.remove(); floaters.splice(i, 1); continue; }
      ctx.project(p.x, 3.2 + f.t * 0.9, p.z, f.el); f.el.style.opacity = String(1 - Math.max(0, f.t - 1) / 0.6);
    }
  }

  // ===================================================================== garden implementation
  function makeGarden() {
    const GD = WORLD.garden, T = GD.tank, TW = GD.tower;
    const WATER_TOP = 0.55 + T.h - 0.35;
    const root = new THREE.Group(); scene.add(root);
    const soilG = new THREE.Group(); root.add(soilG);
    const potG = new THREE.Group(); root.add(potG);
    const lockG = new THREE.Group(); root.add(lockG);
    const tankDecorG = new THREE.Group(); root.add(tankDecorG);
    const plantObjs = new Map(); // 'plot:k' | 'pot:i' | 'tree:i' -> { g, key }
    const fishObjs = new Map(), decorObjs = new Map();
    const highlight = new THREE.Mesh(new THREE.RingGeometry(0.95, 1.12, 4, 1), new THREE.MeshBasicMaterial({ color: '#ffd23f', side: THREE.DoubleSide }));
    highlight.rotation.x = -Math.PI / 2; highlight.rotation.z = Math.PI / 4; highlight.visible = false; root.add(highlight);
    const soils = new Map();
    let builtSize = 0, potLvlBuilt = -1, orchardBuilt = -1, tankDecorKey = '';
    const g = () => (state.visit ? state.visit.garden : state.profile.garden); // visiting someone = draw their garden
    const center = (r, c) => ({ x: GD.plotX + c * GD.cell + GD.cell / 2, z: GD.plotZ + r * GD.cell + GD.cell / 2 });
    const size = () => C.UPGRADES.land[g().land].size;
    const orchardCap = () => C.UPGRADES.orchard[g().orchard].cap;
    const prog = (rec, where) => C.progress(rec, where, g().pots, ctx.serverNow(), g().boosts);
    function plotAt(p) {
      const c = Math.floor((p.x - GD.plotX) / GD.cell), r = Math.floor((p.z - GD.plotZ) / GD.cell);
      return r >= 0 && c >= 0 && r < size() && c < size() ? r + ',' + c : null;
    }
    function nearestTree(p) { let best = null; GD.trees.forEach(([x, z], i) => { if (i >= orchardCap()) return; const d = Math.hypot(p.x - x, p.z - z); if (d < 2.9 && (!best || d < best.d)) best = { i, d }; }); return best; }
    const nearRack = (p) => Math.hypot(p.x - GD.rack.front.x, p.z - GD.rack.front.z) < 3.6;
    const nearTank = (p) => Math.hypot(p.x - T.x, p.z - T.z) < T.r + 2.6;
    const nearStall = (p) => Math.hypot(p.x - GD.stall.front.x, p.z - GD.stall.front.z) < 3.2;
    const nearNotice = (p) => Math.hypot(p.x - GD.board.front.x, p.z - GD.board.front.z) < 3.2; // the notice board next to the orchard: the Market's offers
    const spark = () => { const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.12), new THREE.MeshBasicMaterial({ color: '#fff59d' })); return s; };

    // ---------- visuals: vegetables / root crops (shape from catalog "look", colours from "color" + "leaf") ----------
    function buildCrop(s, st) {
      const gr = new THREE.Group(), P = C.CROPS[s] || { color: '#8d6e63', leaf: '#4caf50', look: 'root' };
      const col = P.color, leafC = P.leaf || '#4caf50';
      if (st === 0) { const m = sphere(0.28, '#6d4c41', 0, 0.1, 0, gr); m.scale.y = 0.4; sphere(0.06, '#a5d6a7', 0, 0.2, 0, gr); return gr; }
      if (st === 1) { cyl(0.03, 0.03, 0.35, leafC, 0, 0.25, 0, gr); [-1, 1].forEach((k) => { const l = sphere(0.13, leafC, k * 0.12, 0.42, 0, gr); l.scale.set(1.3, 0.4, 0.8); }); return gr; }
      const blades = (n, h, c = leafC) => { for (let i = 0; i < n; i++) { const a = (i / n) * 6.28; const l = cyl(0.025, 0.05, h, c, Math.cos(a) * 0.12, h / 2 + 0.05, Math.sin(a) * 0.12, gr); l.rotation.z = Math.cos(a) * 0.35; l.rotation.x = -Math.sin(a) * 0.35; } };
      const bush = (r, c = leafC) => { sphere(r, c, 0, r * 0.8, 0, gr).scale.y = 0.8; sphere(r * 0.7, c, r * 0.6, r * 0.6, 0.1, gr); sphere(r * 0.7, c, -r * 0.5, r * 0.6, -0.1, gr); };
      const vineLeaves = (n, spread) => { for (let i = 0; i < n; i++) { const a = i * (6.28 / n) + 0.3; const l = sphere(0.24, leafC, Math.cos(a) * spread, 0.16, Math.sin(a) * spread, gr); l.scale.set(1, 0.3, 1); } };
      const look = P.look;
      if (st === 2) { // young plant: shape hint of the final look
        if (look === 'root' || look === 'bulb' || look === 'grain') blades(5, 0.55); else if (look === 'stalk') cyl(0.06, 0.08, 1.0, leafC, 0, 0.5, 0, gr), blades(4, 0.7); else if (look === 'vine') vineLeaves(5, 0.4); else bush(0.35);
        return gr;
      }
      if (look === 'grain') { for (let i = 0; i < 9; i++) { const x = ((i % 3) - 1) * 0.24, z = (Math.floor(i / 3) - 1) * 0.24; cyl(0.02, 0.03, 0.9, leafC, x, 0.45, z, gr); gr.add(mesh(new THREE.CapsuleGeometry(0.055, 0.2, 3, 6), col, x, 0.98, z)); } }
      else if (look === 'root') { blades(7, 0.8); const c = mesh(new THREE.ConeGeometry(0.22, 0.55, 8), col, 0, 0.1, 0); c.rotation.x = Math.PI; gr.add(c); if (s === 'radish') { sphere(0.24, col, 0, 0.12, 0, gr); } }
      else if (look === 'tuber') { bush(0.52); for (let i = 0; i < 4; i++) sphere(0.07, i % 2 ? '#ffffff' : '#ce93d8', Math.cos(i * 1.6) * 0.48, 0.82, Math.sin(i * 1.6) * 0.48, gr); [[0.6, 0.4], [-0.55, 0.5], [0.2, 0.7]].forEach(([x, z]) => { const p = sphere(0.16, col, x, 0.1, z, gr); p.scale.set(1.25, 0.8, 1); }); }
      else if (look === 'bulb') { blades(6, 0.95); const b = sphere(0.3, col, 0, 0.15, 0, gr); b.scale.y = 0.85; gr.add(mesh(new THREE.ConeGeometry(0.1, 0.25, 6), col, 0, 0.42, 0)); }
      else if (look === 'leafy') { // lettuce / cabbage head: layered leaves
        for (let i = 0; i < 6; i++) { const a = i * 1.05; const l = sphere(0.32, leafC, Math.cos(a) * 0.25, 0.25, Math.sin(a) * 0.25, gr); l.scale.set(1, 0.55, 1); }
        sphere(0.34, col, 0, 0.42, 0, gr).scale.y = 0.85;
      }
      else if (look === 'bush') { // tomato / chili / eggplant / strawberry: fruits hanging on a bush
        const low = s === 'strawberry';
        bush(low ? 0.4 : 0.55);
        const n = low ? 6 : 5;
        for (let i = 0; i < n; i++) {
          const a = i * (6.28 / n), r = low ? 0.5 : 0.48, y = low ? 0.18 : 0.4 + (i % 3) * 0.17;
          let f;
          if (s === 'chili') { f = mesh(new THREE.ConeGeometry(0.07, 0.32, 6), col, Math.cos(a) * r, y, Math.sin(a) * r); f.rotation.x = Math.PI; gr.add(f); }
          else if (s === 'eggplant') { f = sphere(0.13, col, Math.cos(a) * r, y, Math.sin(a) * r, gr); f.scale.set(0.8, 1.6, 0.8); }
          else if (s === 'strawberry') { f = mesh(new THREE.ConeGeometry(0.1, 0.18, 7), col, Math.cos(a) * r, y, Math.sin(a) * r); f.rotation.x = Math.PI; gr.add(f); }
          else sphere(0.15, col, Math.cos(a) * r, y, Math.sin(a) * r, gr);
        }
        if (!low) { cyl(0.02, 0.02, 1.1, '#a1887f', 0.25, 0.55, 0.25, gr); }
      }
      else if (look === 'stalk') { // corn
        cyl(0.06, 0.09, 1.7, leafC, 0, 0.85, 0, gr);
        for (let i = 0; i < 4; i++) { const l = cyl(0.02, 0.06, 0.9, leafC, Math.cos(i * 1.6) * 0.15, 0.5 + i * 0.25, Math.sin(i * 1.6) * 0.15, gr); l.rotation.z = Math.cos(i * 1.6) * 0.9; l.rotation.x = -Math.sin(i * 1.6) * 0.9; }
        [[0.15, 1.0], [-0.14, 1.25]].forEach(([dx, y]) => { const c = cyl(0.09, 0.07, 0.36, col, dx, y, 0.06, gr); c.rotation.z = dx > 0 ? -0.4 : 0.4; sphere(0.05, '#d7ccc8', dx * 1.4, y + 0.22, 0.06, gr); });
        sphere(0.06, '#c5a35a', 0, 1.75, 0, gr);
      }
      else if (look === 'vine') { // cucumber / sweet potato / pumpkin / watermelon: leaves on the ground + a big fruit
        vineLeaves(7, 0.6);
        if (s === 'cucumber') { [[0.25, 0.1], [-0.3, -0.2]].forEach(([x, z]) => { const c = sphere(0.1, col, x, 0.12, z, gr); c.scale.set(1, 1, 2.6); }); }
        else if (s === 'sweetpotato') { const t2 = sphere(0.24, col, 0.1, 0.12, 0, gr); t2.scale.set(1.6, 0.8, 0.9); }
        else if (s === 'pumpkin') { const pm = sphere(0.42, col, 0, 0.32, 0, gr); pm.scale.set(1.1, 0.75, 1.1); cyl(0.05, 0.07, 0.18, '#6d4c41', 0, 0.68, 0, gr); }
        else if (s === 'watermelon') { const w = sphere(0.45, col, 0, 0.36, 0, gr); w.scale.set(1.25, 0.85, 0.95); for (let i = 0; i < 4; i++) { const st2 = sphere(0.452, P.stripe || '#a5d6a7', 0, 0.36, 0, gr); st2.scale.set(1.26 * (0.2 + (i % 2) * 0.01), 0.86, 0.96); st2.position.x = -0.38 + i * 0.25; } }
      }
      const sp = spark(); sp.position.y = look === 'stalk' ? 2.1 : 1.3; gr.add(sp); gr.userData.spark = sp;
      return gr;
    }
    // ---------- visuals: flowers in pots (bloom "shape" + petal colour + centre colour from the catalog) ----------
    function buildFlower(s, st) {
      const gr = new THREE.Group(), F = C.FLOWERS[s] || { color: '#ec407a', center: '#fff176', shape: 'petals' };
      if (st === 0) { sphere(0.07, '#a5d6a7', 0, 0.05, 0, gr); return gr; }
      if (st === 1) { cyl(0.025, 0.025, 0.25, '#66bb6a', 0, 0.12, 0, gr); sphere(0.08, '#81c784', 0.06, 0.25, 0, gr).scale.y = 0.4; return gr; }
      const tall = F.shape === 'disc' ? 1.0 : F.shape === 'spike' ? 0.55 : 0.7;
      cyl(0.03, 0.035, tall, '#43a047', 0, tall / 2, 0, gr);
      [-1, 1].forEach((k) => { const l = sphere(0.12, '#66bb6a', k * 0.1, 0.3, 0, gr); l.scale.set(1.4, 0.35, 0.7); });
      if (st === 2) { const b = sphere(0.12, F.color === '#ffffff' ? '#c5e1a5' : F.color, 0, tall + 0.05, 0, gr); b.scale.y = 1.4; return gr; }
      const head = new THREE.Group(); head.position.y = tall + 0.06; gr.add(head);
      switch (F.shape) {
        case 'cup': head.add(mesh(new THREE.CylinderGeometry(0.17, 0.09, 0.3, 6), F.color, 0, 0.05, 0)); break;
        case 'ball': sphere(0.18, F.color, 0, 0.06, 0, head); sphere(0.12, F.center, 0, 0.14, 0, head); for (let i = 0; i < 5; i++) { const a = i * 1.26; sphere(0.09, F.color, Math.cos(a) * 0.14, 0.02, Math.sin(a) * 0.14, head); } break;
        case 'disc': { const d = cyl(0.3, 0.3, 0.05, F.color, 0, 0.05, 0.04, head); d.rotation.x = 1.2; const c = cyl(0.15, 0.15, 0.07, F.center, 0, 0.06, 0.07, head); c.rotation.x = 1.2; break; }
        case 'spike': for (let j = 0; j < 3; j++) { const ox = (j - 1) * 0.12; cyl(0.02, 0.02, 0.4, '#558b2f', ox, -0.1, 0, head); for (let i = 0; i < 6; i++) sphere(0.05, i % 2 ? F.color : F.center, ox, 0.05 + i * 0.07, 0, head); } break;
        case 'cluster': for (let i = 0; i < 14; i++) { const a = i * 2.4, r = 0.1 + (i % 3) * 0.06; sphere(0.08, i % 4 ? F.color : F.center, Math.cos(a) * r, 0.06 + Math.sin(i) * 0.08, Math.sin(a) * r, head); } break;
        case 'star': for (let i = 0; i < 5; i++) { const a = (i / 5) * 6.28; const pt = sphere(0.13, F.color, Math.cos(a) * 0.15, 0.05, Math.sin(a) * 0.15, head); pt.scale.set(1.2, 0.35, 0.8); pt.rotation.y = -a; } sphere(0.06, F.center, 0, 0.12, 0, head); cyl(0.015, 0.015, 0.2, F.center, 0, 0.18, 0, head); break;
        default: for (let i = 0; i < 9; i++) { const a = (i / 9) * 6.28; const pt = sphere(0.08, F.color, Math.cos(a) * 0.14, 0.05, Math.sin(a) * 0.14, head); pt.scale.y = 0.4; } sphere(0.07, F.center, 0, 0.08, 0, head);
      }
      const sp = spark(); sp.position.y = tall + 0.6; gr.add(sp); gr.userData.spark = sp;
      return gr;
    }
    // ---------- visuals: fruit trees (canopy colour + fruit colour from the catalog) ----------
    function buildTree(s, sk) {
      const gr = new THREE.Group(), F = C.FRUITS[s] || { color: '#fb8c00', canopy: '#43a047' };
      const palm = s === 'coconut', canopy = F.canopy || '#43a047';
      const shade = (hex, k) => { const c = new THREE.Color(hex); c.multiplyScalar(k); return '#' + c.getHexString(); };
      if (sk === 'sap') { cyl(0.06, 0.08, 0.9, '#8d6e63', 0, 0.45, 0, gr); sphere(0.4, canopy, 0, 1.0, 0, gr); return gr; }
      if (sk === 'young') { cyl(0.12, 0.16, 1.6, '#8d6e63', 0, 0.8, 0, gr); sphere(0.95, canopy, 0, 2.0, 0, gr); return gr; }
      const fruitSpots = [];
      if (palm) {
        for (let i = 0; i < 6; i++) { const c = cyl(0.2 - i * 0.015, 0.22 - i * 0.015, 0.8, '#a1887f', Math.sin(i * 0.25) * 0.25, 0.4 + i * 0.75, 0, gr); c.rotation.z = -0.06; }
        for (let i = 0; i < 7; i++) { const a = (i / 7) * 6.28; const l = mesh(new THREE.ConeGeometry(0.35, 2.4, 4), canopy, 0.3 + Math.cos(a) * 1.0, 4.6, Math.sin(a) * 1.0); l.rotation.z = Math.cos(a) * 1.25; l.rotation.x = -Math.sin(a) * 1.25; l.scale.z = 0.25; gr.add(l); }
        for (let i = 0; i < 5; i++) fruitSpots.push([0.3 + Math.cos(i * 1.3) * 0.35, 4.15, Math.sin(i * 1.3) * 0.35]);
      } else {
        cyl(0.24, 0.34, 2.4, '#8d6e63', 0, 1.2, 0, gr);
        sphere(1.6, canopy, 0, 3.3, 0, gr); sphere(1.1, shade(canopy, 1.1), 0.9, 3.9, 0.3, gr); sphere(1.05, shade(canopy, 0.85), -0.8, 3.8, -0.4, gr);
        for (let i = 0; i < 7; i++) { const a = i * 0.9 + 0.3; fruitSpots.push([Math.cos(a) * 1.45, 2.7 + (i % 3) * 0.35, Math.sin(a) * 1.45]); }
      }
      const fruits = [];
      if (sk === 'green' || sk === 'ripe') fruitSpots.forEach(([x, y, z]) => { const f = sphere(sk === 'ripe' ? 0.22 : 0.13, sk === 'ripe' ? F.color : '#9ccc65', x, y, z, gr); if (s === 'pear' && sk === 'ripe') f.scale.y = 1.3; fruits.push(f); });
      gr.userData.fruits = fruits;
      if (sk === 'ripe') { const sp = spark(); sp.position.y = palm ? 6 : 5.3; gr.add(sp); gr.userData.spark = sp; }
      return gr;
    }
    // ---------- visuals: tank fish + tank decor ----------
    function buildFish(f) { // v5: real species look (see buildFishModel)
      const gr = buildFishModel(f.sp, f.size, 0.55 + f.size / 60), tail = gr.userData.tail;
      gr.userData = { a: Math.random() * 6.28, r: 0.8 + Math.random() * (T.r - 1.6), y0: 1.0 + Math.random() * (T.h - 1.6), sp: (0.3 + Math.random() * 0.4) * (Math.random() < 0.5 ? 1 : -1), ph: Math.random() * 6, tail, cr: 0, cy: 1.5 };
      gr.userData.cr = gr.userData.r; gr.userData.cy = gr.userData.y0;
      return gr;
    }
    function buildTankDecor(item) {
      const gr = new THREE.Group();
      if (item === 'pebbles') { ['#ef9a9a', '#90caf9', '#fff59d', '#a5d6a7', '#ce93d8', '#ffffff'].forEach((c, i) => { const s = sphere(0.14, c, Math.cos(i) * 0.35, 0.07, Math.sin(i * 1.7) * 0.35, gr); s.scale.y = 0.6; }); }
      else if (item === 'moss') { for (let i = 0; i < 3; i++) { const m = sphere(0.35, '#2e7d32', (i - 1) * 0.35, 0.08, (i % 2) * 0.2, gr); m.scale.y = 0.3; } }
      else if (item === 'seaweed') { gr.userData.sway = []; for (let i = 0; i < 4; i++) { const pv = new THREE.Group(); pv.position.set((i - 1.5) * 0.18, 0, (i % 2) * 0.15); gr.add(pv); const h = 1.2 + (i % 3) * 0.5; const s = mesh(new THREE.CapsuleGeometry(0.06, h, 4, 6), i % 2 ? '#43a047' : '#66bb6a', 0, h / 2, 0); pv.add(s); gr.userData.sway.push(pv); } }
      else if (item === 'shell') { const s = mesh(new THREE.ConeGeometry(0.3, 0.25, 9), '#f8bbd0', 0, 0.1, 0); s.scale.z = 0.6; gr.add(s); sphere(0.06, '#ffffff', 0.05, 0.15, 0.05, gr); }
      else if (item === 'coral') { const cc = ['#ff7043', '#f06292']; for (let i = 0; i < 5; i++) { const b = cyl(0.05, 0.08, 0.6 + (i % 2) * 0.3, cc[i % 2], Math.cos(i * 1.3) * 0.15, 0.35, Math.sin(i * 1.3) * 0.15, gr); b.rotation.z = Math.cos(i * 1.3) * 0.5; b.rotation.x = Math.sin(i * 1.3) * 0.5; sphere(0.08, cc[(i + 1) % 2], Math.cos(i * 1.3) * 0.35, 0.72, Math.sin(i * 1.3) * 0.35, gr); } }
      else if (item === 'bubbler') { box(0.35, 0.3, 0.35, '#78909c', 0, 0.15, 0, gr); cyl(0.05, 0.05, 0.2, '#b0bec5', 0, 0.38, 0, gr); gr.userData.bubbler = true; }
      else if (item === 'castle') { box(0.7, 0.5, 0.6, '#bdbdbd', 0, 0.25, 0, gr); [-0.32, 0.32].forEach((x) => { cyl(0.14, 0.14, 0.85, '#9e9e9e', x, 0.42, 0, gr); gr.add(mesh(new THREE.ConeGeometry(0.18, 0.3, 8), '#e53935', x, 1.0, 0)); }); box(0.2, 0.28, 0.05, '#5d4037', 0, 0.14, 0.31, gr); }
      return gr;
    }
    // ---------- visuals: garden decorations ----------
    function buildDecor(item) {
      const gr = new THREE.Group();
      switch (item) {
        case 'flowers': for (let i = 0; i < 7; i++) sphere(0.22, ['#ff6f91', '#ffd23f', '#ffffff', '#ab47bc'][i % 4], Math.cos(i) * 0.45, 0.35, Math.sin(i * 1.7) * 0.45, gr); sphere(0.5, '#43a047', 0, 0.2, 0, gr).scale.y = 0.5; break;
        case 'fence': box(2.4, 0.18, 0.12, '#ffffff', 0, 0.75, 0, gr); box(2.4, 0.18, 0.12, '#ffffff', 0, 0.35, 0, gr); [-1.1, 0, 1.1].forEach((x) => box(0.2, 1.1, 0.2, '#fafafa', x, 0.55, 0, gr)); break;
        case 'bench': box(1.8, 0.14, 0.6, '#a1887f', 0, 0.55, 0, gr); box(1.8, 0.5, 0.12, '#a1887f', 0, 0.85, -0.25, gr); [-0.75, 0.75].forEach((x) => box(0.12, 0.5, 0.5, '#6d4c41', x, 0.25, 0, gr)); break;
        case 'mailbox': box(0.12, 1.1, 0.12, '#6d4c41', 0, 0.55, 0, gr); box(0.45, 0.4, 0.7, '#e53935', 0, 1.25, 0, gr); box(0.05, 0.3, 0.08, '#ffd23f', 0.25, 1.45, 0.2, gr); break;
        case 'lantern': { cyl(0.06, 0.08, 1.8, '#37474f', 0, 0.9, 0, gr); const l = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 0.4), new THREE.MeshBasicMaterial({ color: '#ffcc80' })); l.position.y = 1.95; gr.add(l); box(0.5, 0.08, 0.5, '#37474f', 0, 2.24, 0, gr); break; }
        case 'mushroom': cyl(0.3, 0.4, 1.0, '#fff3e0', 0, 0.5, 0, gr); { const c = sphere(0.9, '#e53935', 0, 1.1, 0, gr); c.scale.y = 0.55; } [[0.4, 0.3], [-0.3, 0.5], [0.1, -0.5]].forEach(([x, z]) => sphere(0.14, '#ffffff', x, 1.5, z, gr)); break;
        case 'picnic': box(2, 0.12, 1, '#a1887f', 0, 0.85, 0, gr); box(2, 0.1, 0.35, '#8d6e63', 0, 0.5, 0.8, gr); box(2, 0.1, 0.35, '#8d6e63', 0, 0.5, -0.8, gr); box(1.2, 0.02, 0.8, '#ef5350', 0, 0.92, 0, gr); [-0.8, 0.8].forEach((x) => box(0.1, 0.85, 0.1, '#6d4c41', x, 0.42, 0, gr)); break;
        case 'birdbath': cyl(0.15, 0.25, 0.9, '#cfd8dc', 0, 0.45, 0, gr); cyl(0.6, 0.4, 0.2, '#cfd8dc', 0, 0.95, 0, gr); cyl(0.5, 0.5, 0.05, '#4fc3f7', 0, 1.04, 0, gr); { const b = sphere(0.14, '#42a5f5', 0.35, 1.18, 0, gr); b.scale.z = 1.4; } break;
        case 'windmill': { cyl(0.35, 0.55, 2.6, '#fff3e0', 0, 1.3, 0, gr); gr.add(mesh(new THREE.ConeGeometry(0.55, 0.6, 8), '#e65a4f', 0, 2.9, 0)); const bl = new THREE.Group(); bl.position.set(0, 2.4, 0.45); gr.add(bl); for (let i = 0; i < 4; i++) { const piv = new THREE.Group(); piv.rotation.z = i * Math.PI / 2; bl.add(piv); box(0.2, 1.3, 0.05, '#bcaaa4', 0, 0.65, 0, piv); } gr.userData.spin = bl; break; }
        case 'cat': { const b = sphere(0.4, '#ffb74d', 0, 0.4, 0, gr); b.scale.set(0.9, 1, 1.2); sphere(0.3, '#ffb74d', 0, 0.85, 0.3, gr); [-0.15, 0.15].forEach((x) => gr.add(mesh(new THREE.ConeGeometry(0.09, 0.2, 4), '#ffb74d', x, 1.12, 0.3))); const t2 = cyl(0.05, 0.05, 0.6, '#ffb74d', 0, 0.55, -0.5, gr); t2.rotation.x = 0.6; break; }
        case 'sakura': cyl(0.2, 0.3, 2, '#6d4c41', 0, 1, 0, gr); [[0, 2.6, 0, 1.2], [0.8, 2.3, 0.3, 0.8], [-0.7, 2.4, -0.3, 0.8]].forEach(([x, y, z, r]) => sphere(r, '#f8bbd0', x, y, z, gr)); break;
      }
      return gr;
    }

    // ---------- build / sync ----------
    // ---------- v5: animals, furniture, icons ----------
    const farm = extras.farm, animalObjs = new Map(), furnKeyRef = { k: '' };
    let houseLvlBuilt = -1, potKey = '';
    const PEN_AREA = { coop: { minX: -391, maxX: -383, minZ: -25.8, maxZ: -21 }, barn: { minX: -378, maxX: -367, minZ: -24.4, maxZ: -19 }, sty: { minX: -391, maxX: -383, minZ: -14, maxZ: -9.4 } };
    const icon = (txt) => { const el = document.createElement('div'); el.className = 'vc-ico'; el.textContent = txt; el.style.display = 'none'; ctx.labelsEl.appendChild(el); return el; };
    function buildAnimal(kind) {
      const g = new THREE.Group(), body = new THREE.Group(); g.add(body); const parts = {};
      if (kind === 'chicken') {
        const b = sphere(0.3, '#fafafa', 0, 0.42, 0, body); b.scale.set(0.9, 0.85, 1.15);
        const head = new THREE.Group(); head.position.set(0, 0.7, 0.26); body.add(head); parts.head = head;
        sphere(0.17, '#fafafa', 0, 0, 0, head); box(0.05, 0.1, 0.16, '#e53935', 0, 0.16, 0, head);
        const beak = mesh(new THREE.ConeGeometry(0.05, 0.12, 6), '#ffb300', 0, -0.02, 0.18); beak.rotation.x = Math.PI / 2; head.add(beak);
        sphere(0.03, '#212121', 0.1, 0.04, 0.1, head); sphere(0.03, '#212121', -0.1, 0.04, 0.1, head);
        const tail = sphere(0.14, '#eeeeee', 0, 0.6, -0.32, body); tail.scale.set(0.5, 1, 0.8);
        [-0.1, 0.1].forEach((x) => cyl(0.02, 0.02, 0.22, '#ffb300', x, 0.11, 0, g));
      } else if (kind === 'cow') {
        const b = sphere(0.5, '#fafafa', 0, 0.95, 0, body); b.scale.set(0.95, 0.8, 1.55);
        [[0.3, 1.15, 0.2], [-0.35, 0.95, -0.3], [0.2, 0.85, -0.55], [-0.2, 1.1, 0.45]].forEach(([x, y, z]) => { const s = sphere(0.18, '#212121', x * 1.05, y, z, body); s.scale.set(0.6, 0.7, 1); });
        const head = new THREE.Group(); head.position.set(0, 1.15, 0.85); body.add(head); parts.head = head;
        box(0.42, 0.42, 0.45, '#fafafa', 0, 0, 0, head); box(0.36, 0.22, 0.12, '#f8bbd0', 0, -0.1, 0.27, head);
        [-1, 1].forEach((s) => { box(0.18, 0.08, 0.08, '#fafafa', s * 0.28, 0.12, -0.05, head); const hn = mesh(new THREE.ConeGeometry(0.04, 0.16, 6), '#fff3e0', s * 0.15, 0.27, -0.05); head.add(hn); sphere(0.035, '#212121', s * 0.13, 0.08, 0.22, head); });
        [[-0.25, 0.45], [0.25, 0.45], [-0.25, -0.45], [0.25, -0.45]].forEach(([x, z]) => cyl(0.08, 0.07, 0.6, '#fafafa', x, 0.3, z, g));
        const t2 = cyl(0.02, 0.02, 0.6, '#9e9e9e', 0, 0.85, -0.78, body); t2.rotation.x = 0.4;
      } else {
        const b = sphere(0.42, '#f8a5c2', 0, 0.55, 0, body); b.scale.set(1, 0.85, 1.3);
        const head = new THREE.Group(); head.position.set(0, 0.62, 0.5); body.add(head); parts.head = head;
        sphere(0.26, '#f8a5c2', 0, 0, 0, head); const sn = cyl(0.11, 0.11, 0.08, '#f48fb1', 0, -0.03, 0.25, head); sn.rotation.x = Math.PI / 2;
        sphere(0.025, '#ad1457', 0.04, -0.03, 0.29, head); sphere(0.025, '#ad1457', -0.04, -0.03, 0.29, head);
        [-1, 1].forEach((s) => { const ear = mesh(new THREE.ConeGeometry(0.08, 0.14, 4), '#f48fb1', s * 0.15, 0.22, 0); ear.rotation.z = -s * 0.4; head.add(ear); sphere(0.03, '#212121', s * 0.1, 0.06, 0.2, head); });
        [[-0.2, 0.3], [0.2, 0.3], [-0.2, -0.3], [0.2, -0.3]].forEach(([x, z]) => cyl(0.07, 0.07, 0.3, '#f48fb1', x, 0.15, z, g));
        const tl = mesh(new THREE.TorusGeometry(0.07, 0.02, 6, 12, Math.PI * 1.5), '#f48fb1', 0, 0.62, -0.56); g.add(tl);
      }
      g.userData = { body, parts };
      return g;
    }
    function buildProduct(p) {
      const g = new THREE.Group();
      if (p === 'egg') { const e = sphere(0.1, '#fff8e1', 0, 0.1, 0, g); e.scale.y = 1.3; }
      else if (p === 'milk') { cyl(0.14, 0.12, 0.3, '#b0bec5', 0, 0.15, 0, g); cyl(0.13, 0.13, 0.02, '#ffffff', 0, 0.3, 0, g); }
      else { const t = sphere(0.12, '#5d4037', 0, 0.1, 0, g); t.scale.set(1, 0.8, 1.1); }
      const sp = spark(); sp.position.y = 0.6; g.add(sp); g.userData.spark = sp;
      return g;
    }
    function buildFurniture(item) {
      const g = new THREE.Group();
      switch (item) {
        case 'rug': cyl(1.0, 1.0, 0.03, '#e57373', 0, 0.13, 0, g); cyl(0.7, 0.7, 0.035, '#fff59d', 0, 0.14, 0, g); break;
        case 'plant': cyl(0.22, 0.17, 0.4, '#d8774a', 0, 0.2, 0, g); sphere(0.38, '#43a047', 0, 0.75, 0, g); sphere(0.25, '#66bb6a', 0.15, 1.0, 0.05, g); break;
        case 'lamp': cyl(0.2, 0.25, 0.06, '#37474f', 0, 0.13, 0, g); cyl(0.03, 0.03, 1.5, '#37474f', 0, 0.85, 0, g); { const s = cyl(0.18, 0.3, 0.35, '#fff59d', 0, 1.65, 0, g); s.material = new THREE.MeshBasicMaterial({ color: '#fff59d' }); } break;
        case 'painting': box(1.2, 0.85, 0.06, '#8d6e63', 0, 1.8, -0.35, g); box(1.05, 0.7, 0.07, '#81d4fa', 0, 1.8, -0.34, g); sphere(0.15, '#ffd23f', 0.3, 1.95, -0.3, g); box(0.7, 0.25, 0.08, '#66bb6a', -0.15, 1.6, -0.3, g); break;
        case 'shelf': box(1.3, 1.9, 0.4, '#8d6e63', 0, 1.05, -0.2, g); [0.6, 1.1, 1.6].forEach((y, i) => { for (let k = 0; k < 5; k++) box(0.14, 0.32, 0.25, ['#e57373', '#64b5f6', '#ffd54f', '#81c784', '#ba68c8'][(k + i) % 5], -0.45 + k * 0.22, y, -0.15, g); }); break;
        case 'table': box(1.6, 0.1, 1.0, '#a1887f', 0, 0.85, 0, g); [[-0.7, -0.4], [0.7, -0.4], [-0.7, 0.4], [0.7, 0.4]].forEach(([x, z]) => box(0.08, 0.75, 0.08, '#6d4c41', x, 0.45, z, g)); [-0.9, 0.9].forEach((x) => box(0.45, 0.5, 0.45, '#bcaaa4', x, 0.35, 0, g)); cyl(0.12, 0.1, 0.12, '#ffffff', 0, 0.96, 0, g); break;
        case 'desk': box(1.4, 0.08, 0.7, '#a1887f', 0, 0.85, -0.1, g); box(1.3, 0.75, 0.6, '#8d6e63', 0.3, 0.45, -0.1, g); box(0.6, 0.4, 0.05, '#263238', -0.2, 1.15, -0.3, g); box(0.5, 0.45, 0.5, '#ef5350', -0.2, 0.35, 0.45, g); break;
        case 'sofa': box(1.9, 0.45, 0.8, '#5c6bc0', 0, 0.35, 0, g); box(1.9, 0.6, 0.25, '#5c6bc0', 0, 0.75, -0.3, g); [-0.95, 0.95].forEach((x) => box(0.2, 0.55, 0.8, '#3f51b5', x, 0.45, 0, g)); [-0.45, 0.45].forEach((x) => box(0.5, 0.3, 0.15, '#ffd54f', x, 0.75, -0.12, g)); break;
        case 'bed': box(1.4, 0.4, 2.0, '#8d6e63', 0, 0.3, 0, g); box(1.3, 0.2, 1.9, '#ffffff', 0, 0.55, 0, g); box(1.32, 0.12, 1.2, '#64b5f6', 0, 0.62, 0.3, g); box(0.9, 0.18, 0.4, '#fff8e1', 0, 0.72, -0.7, g); box(1.4, 0.8, 0.12, '#6d4c41', 0, 0.6, -1.0, g); break;
        case 'wardrobe': box(1.2, 2.2, 0.6, '#a1887f', 0, 1.2, -0.15, g); box(0.02, 2.0, 0.62, '#6d4c41', 0, 1.2, -0.14, g); [-0.08, 0.08].forEach((x) => sphere(0.04, '#ffd23f', x, 1.2, 0.17, g)); break;
        case 'tv': box(1.4, 0.5, 0.45, '#8d6e63', 0, 0.35, -0.15, g); box(1.5, 0.85, 0.08, '#212121', 0, 1.1, -0.2, g); { const sc = box(1.38, 0.74, 0.02, '#4fc3f7', 0, 1.1, -0.15, g); sc.material = new THREE.MeshBasicMaterial({ color: '#4fc3f7' }); } break;
        case 'fridge': box(0.85, 1.9, 0.7, '#eceff1', 0, 1.05, -0.1, g); box(0.86, 0.03, 0.72, '#b0bec5', 0, 1.35, -0.1, g); box(0.05, 0.4, 0.05, '#90a4ae', 0.3, 1.65, 0.27, g); box(0.05, 0.4, 0.05, '#90a4ae', 0.3, 0.95, 0.27, g); break;
        case 'aquarium': box(1.2, 0.6, 0.5, '#5d4037', 0, 0.4, 0, g); { const t = box(1.1, 0.6, 0.45, '#81d4fa', 0, 1.0, 0, g); t.material = new THREE.MeshToonMaterial({ color: '#81d4fa', gradientMap: gradient, transparent: true, opacity: 0.6 }); } sphere(0.07, '#ff9800', -0.2, 1.0, 0, g); sphere(0.06, '#e53935', 0.25, 1.1, 0.05, g); break;
        case 'piano': box(1.6, 1.2, 0.6, '#212121', 0, 0.75, -0.1, g); box(1.5, 0.06, 0.3, '#fafafa', 0, 1.0, 0.3, g); for (let i = 0; i < 7; i++) box(0.06, 0.04, 0.18, '#212121', -0.6 + i * 0.2, 1.04, 0.28, g); box(0.6, 0.45, 0.35, '#212121', 0, 0.35, 0.75, g); break;
      }
      g.traverse((o) => { if (o.isMesh) o.castShadow = false; });
      return g;
    }
    function hideIcons() { for (const a of animalObjs.values()) a.ico.style.display = 'none'; for (const o of fishObjs.values()) if (o.userData.ico) o.userData.ico.style.display = 'none'; }

    function rebuildStatic() {
      const n = size(), gg = g();
      if (n !== builtSize) {
        builtSize = n; soilG.clear(); soils.clear();
        for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
          const { x, z } = center(r, c);
          soils.set(r + ',' + c, box(2.12, 0.16, 2.12, '#8d6e63', x, 0.08, z, soilG, { cast: false }));
          [-0.6, 0, 0.6].forEach((dz) => box(1.9, 0.07, 0.22, '#795548', x, 0.19, z + dz, soilG, { cast: false })); // furrows
        }
      }
      const pk = gg.pots + '|' + JSON.stringify(gg.potTypes || {});
      if (pk !== potKey) {
        potKey = pk; potG.clear(); extras.setPotLevel(gg.pots);
        extras.potPositions(gg.pots).forEach((pp, i) => {
          const PT = C.POTS[(gg.potTypes || {})[i]] || C.POTS.clay;
          cyl(0.34, 0.25, 0.5, PT.color, pp.x, pp.y + 0.25, pp.z, potG); cyl(0.36, 0.36, 0.08, PT.rim, pp.x, pp.y + 0.5, pp.z, potG); cyl(0.3, 0.3, 0.04, '#6d4c41', pp.x, pp.y + 0.47, pp.z, potG);
        });
      }
      if (gg.orchard !== orchardBuilt) {
        orchardBuilt = gg.orchard; lockG.clear();
        GD.trees.forEach(([x, z], i) => { if (i < orchardCap()) return; box(0.12, 1.0, 0.12, '#6d4c41', x, 0.5, z, lockG); box(1.0, 0.6, 0.08, '#bdbdbd', x, 1.05, z, lockG); box(0.3, 0.25, 0.1, '#ffd23f', x, 1.05, z + 0.06, lockG); });
      }
      if ((gg.house | 0) !== houseLvlBuilt) { houseLvlBuilt = gg.house | 0; farm.setHouseLevel(houseLvlBuilt); }
      const fk = JSON.stringify(gg.furniture || {});
      if (fk !== furnKeyRef.k) {
        furnKeyRef.k = fk; farm.houseFurn[1].clear(); farm.houseFurn[2].clear();
        for (const [slot, item] of Object.entries(gg.furniture || {})) {
          const S = farm.houseSlots[+slot]; if (!S) continue;
          const o = buildFurniture(item); o.position.set(S.x, S.floor === 2 ? 3.4 : 0, S.z); o.rotation.y = S.ry; farm.houseFurn[S.floor].add(o);
        }
      }
    }
    function sync() {
      if (!state.profile) return;
      rebuildStatic();
      const gg = g();
      const keepF = new Set(gg.fish.map((f) => f.uid));
      for (const [u, o] of fishObjs) if (!keepF.has(u)) { root.remove(o); if (o.userData.ico) o.userData.ico.remove(); fishObjs.delete(u); }
      const hungryMs = ECON.hungryHours * 3600000, nowT = ctx.serverNow();
      for (const f of gg.fish) {
        let o = fishObjs.get(f.uid);
        if (!o || o.userData.size !== f.size || o.userData.sp0 !== f.sp) { const n = buildFish(f); if (o) { Object.assign(n.userData, { a: o.userData.a, cr: o.userData.cr, cy: o.userData.cy }); n.userData.ico = o.userData.ico; root.remove(o); } else n.userData.ico = icon('🍽️'); o = n; o.userData.size = f.size; o.userData.sp0 = f.sp; root.add(o); fishObjs.set(f.uid, o); }
        o.userData.hungry = nowT - (f.fedAt || 0) > hungryMs;
      }
      const key = gg.tankDecor.join(',');
      if (key !== tankDecorKey) {
        tankDecorKey = key; tankDecorG.clear();
        gg.tankDecor.forEach((item, i) => { const a = (i / C.TANK_DECOR_MAX) * Math.PI * 2 + 0.3, o = buildTankDecor(item); o.position.set(T.x + Math.cos(a) * (T.r - 1.0), 0.66, T.z + Math.sin(a) * (T.r - 1.0)); o.rotation.y = -a; tankDecorG.add(o); });
      }
      const keepD = new Set(gg.decor.map((d) => d.uid));
      for (const [u, o] of decorObjs) if (!keepD.has(u)) { root.remove(o); decorObjs.delete(u); }
      for (const d of gg.decor) { let o = decorObjs.get(d.uid); if (!o) { o = buildDecor(d.item); root.add(o); decorObjs.set(d.uid, o); } o.position.set(d.x, 0, d.z); o.rotation.y = d.r || 0; }
      // animals
      const keepA = new Set((gg.animals || []).map((a) => a.uid));
      for (const [u, a] of animalObjs) if (!keepA.has(u)) { root.remove(a.obj); if (a.prod) root.remove(a.prod); a.ico.remove(); animalObjs.delete(u); }
      for (const an of gg.animals || []) {
        let a = animalObjs.get(an.uid);
        if (!a || a.kind !== an.kind) {
          const A = C.ANIMALS[an.kind]; if (!A) continue;
          const area = PEN_AREA[A.pen], x = area.minX + Math.random() * (area.maxX - area.minX), z = area.minZ + Math.random() * (area.maxZ - area.minZ);
          a = { obj: buildAnimal(an.kind), kind: an.kind, pen: A.pen, x, z, tx: x, tz: z, wait: Math.random() * 2, ico: icon(''), prod: null, lastSend: 0, ph: Math.random() * 6 };
          a.obj.position.set(x, 0, z); root.add(a.obj); animalObjs.set(an.uid, a);
        }
        a.rec = an;
      }
      refreshPlants();
    }
    function refreshPlants() {
      const gg = g(), seen = new Set(), pots = extras.potPositions(gg.pots);
      const each = (where, coll) => {
        for (const [k, rec] of Object.entries(coll)) {
          const id = where + ':' + k; seen.add(id);
          const pg = prog(rec, where);
          const sk = where === 'tree' ? (pg >= 1 ? 'ripe' : rec.m ? (pg > 0.5 ? 'green' : 'tree') : (pg > 0.5 ? 'young' : 'sap')) : (pg >= 1 ? 3 : Math.min(2, Math.floor(pg * 3)));
          const key = rec.s + '|' + sk;
          let o = plantObjs.get(id);
          if (o && o.key === key) continue;
          if (anim && anim.type === 'pole' && id === 'tree:' + anim.slot) continue; // keep the tree while poking it
          if (o) root.remove(o.g);
          let grp;
          if (where === 'plot') { // a field square holds 4 plants, packed tight
            const [r, c] = k.split(',').map(Number), pos = center(r, c); grp = new THREE.Group(); grp.position.set(pos.x, 0.18, pos.z);
            [[-0.48, -0.48], [0.48, -0.48], [-0.48, 0.48], [0.48, 0.48]].forEach(([dx, dz], i) => { const cp = buildCrop(rec.s, sk); cp.scale.setScalar(0.62); cp.position.set(dx, 0, dz); cp.rotation.y = i * 1.3; if (cp.userData.spark) { if (i) cp.remove(cp.userData.spark); else grp.userData.spark = cp.userData.spark; } grp.add(cp); });
          }
          else if (where === 'pot') { const pp = pots[+k]; if (!pp) continue; grp = buildFlower(rec.s, sk); grp.position.set(pp.x, pp.y + 0.5, pp.z); }
          else { const [x, z] = GD.trees[+k]; grp = buildTree(rec.s, sk); grp.position.set(x, 0, z); grp.rotation.y = +k * 1.1; }
          root.add(grp); plantObjs.set(id, { g: grp, key });
        }
      };
      each('plot', gg.plots); each('pot', gg.flowerPots); each('tree', gg.trees);
      for (const [id, o] of plantObjs) if (!seen.has(id)) { root.remove(o.g); plantObjs.delete(id); }
      for (const [k, m] of soils) { const rec = gg.plots[k]; m.material = toon(rec && rec.w && prog(rec, 'plot') < 1 ? '#5d4037' : '#8d6e63'); }
    }

    // ---------- animations: poking fruit down with a pole, climbing the tower to feed fish ----------
    let anim = null;
    const pole = new THREE.Group(); pole.position.set(0.45, 1.2, 0.2);
    const stick = cyl(0.04, 0.05, 4.2, '#a1887f', 0, 2.1, 0, pole); cyl(0.07, 0.04, 0.3, '#6d4c41', 0, 4.2, 0, pole);
    pole.visible = false;
    const flying = []; // falling fruit / food particles
    const foodMat = new THREE.MeshBasicMaterial({ color: '#ffb74d', transparent: true });
    function startPole(slot) {
      const p = me(); const [x, z] = GD.trees[slot];
      p.ry = p.try = Math.atan2(x - p.x, z - p.z);
      const o = plantObjs.get('tree:' + slot);
      if (pole.parent !== p.obj) p.obj.add(pole);
      pole.visible = true;
      anim = { type: 'pole', t: 0, dur: 2.1, slot, fruits: o ? (o.g.userData.fruits || []).slice() : [], dropped: 0 };
      blip([392, 330], 0.06, 0.06);
    }
    function dropFruit(f) {
      const wp = new THREE.Vector3(); f.getWorldPosition(wp);
      f.parent.remove(f); f.position.copy(wp); scene.add(f);
      flying.push({ m: f, vx: (Math.random() - 0.5) * 1.2, vy: 0.5, vz: (Math.random() - 0.5) * 1.2, life: 0, kind: 'fruit' });
      blip([620 + Math.random() * 200], 0.04, 0.05);
    }
    // ---- feeding tower: walk to the ladder & press E to climb; on top: E = sprinkle food, any move key = climb down ----
    let tower = null; // { state: 'up' | 'top' | 'sprinkle' | 'down', t, sx, sz, y, sent, spawn, thenSprinkle }
    const nearLadder = (p) => Math.hypot(p.x - TW.ladder.x, p.z - TW.ladder.z) < 2.8 || Math.hypot(p.x - TW.x, p.z - TW.z) < 3.2;
    function canFeed() {
      const gg = g();
      if (!gg.fish.length) { toast('The tank has no fish to feed.'); return false; }
      if (!(state.profile.inv.food > 0)) { toast('You are out of fish food — buy some in the Shop → Fish & Tank.'); return false; }
      return true;
    }
    function startClimb(thenSprinkle) { const p = me(); if (!p || anim || tower) return; tower = { state: 'up', t: 0, sx: p.x, sz: p.z, y: 0, thenSprinkle: !!thenSprinkle }; }
    function startSprinkle() { if (tower && tower.state === 'top' && canFeed()) { tower.state = 'sprinkle'; tower.t = 0; tower.sent = false; tower.spawn = 0; } }
    function startDown() { if (tower && tower.state === 'top') { tower.state = 'down'; tower.t = 0; } }
    function startFeeding() { if (tower && tower.state === 'top') startSprinkle(); else if (canFeed()) startClimb(true); }
    const MOVE_KEYS = ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'];
    function updateTower(dt) {
      const p = me(); if (!tower || !p) return;
      const L = TW.ladder, FD = TW.feed, top = TW.top + 0.1, rungX = L.x - 0.6;
      const lerp = (a, b, u) => a + (b - a) * Math.min(1, Math.max(0, u));
      tower.t += dt;
      const T0 = tower.t;
      p.moving = false;
      if (tower.state === 'up') {
        if (T0 < 0.9) { const k = T0 / 0.9; p.x = lerp(tower.sx, L.x, k); p.z = lerp(tower.sz, L.z, k); p.ry = Math.atan2(L.x - tower.sx, L.z - tower.sz); tower.y = 0; p.moving = true; }
        else if (T0 < 2.3) { const k = (T0 - 0.9) / 1.4; p.x = lerp(L.x, rungX, Math.min(1, k * 3)); p.z = L.z; p.ry = -Math.PI / 2; tower.y = lerp(0, top, k); p.moving = true; }
        else if (T0 < 2.9) { const k = (T0 - 2.3) / 0.6; p.x = lerp(rungX, FD.x, k); p.z = FD.z; tower.y = top; p.ry = -Math.PI / 2; p.moving = true; }
        else { tower.y = top; p.x = FD.x; p.z = FD.z; tower.state = 'top'; tower.t = 0; if (tower.thenSprinkle) startSprinkle(); }
      } else if (tower.state === 'top') {
        tower.y = top; p.ry = -Math.PI / 2;
        if (!ctx.typing() && MOVE_KEYS.some((k) => ctx.keys.has(k))) startDown();
      } else if (tower.state === 'sprinkle') {
        tower.y = top; p.ry = -Math.PI / 2;
        if (!tower.sent) { tower.sent = true; send({ type: 'pondFeed' }); blip([300, 260], 0.08, 0.06); }
        tower.spawn -= dt;
        if (tower.spawn <= 0 && T0 < 1.9) {
          tower.spawn = 0.07;
          for (let i = 0; i < 3; i++) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 4), foodMat.clone()); m.position.set(p.x - 0.6, top + 1.5, p.z + (Math.random() - 0.5) * 0.4); scene.add(m); flying.push({ m, vx: -(2 + Math.random() * 3), vy: 1.4 + Math.random() * 1.0, vz: (Math.random() - 0.5) * 1.8, life: 0, kind: 'food' }); }
        }
        if (T0 > 2.6) { tower.state = 'top'; tower.t = 0; }
      } else if (tower.state === 'down') {
        if (T0 < 0.6) { const k = T0 / 0.6; p.x = lerp(FD.x, rungX, k); tower.y = top; p.ry = Math.PI / 2; p.moving = true; }
        else if (T0 < 1.8) { const k = (T0 - 0.6) / 1.2; p.x = lerp(rungX, L.x, Math.max(0, k * 3 - 2)); p.ry = -Math.PI / 2; tower.y = lerp(top, 0, k); p.moving = true; }
        else { tower.y = 0; p.x = L.x; p.z = L.z; p.ry = Math.PI / 2; tower = null; p.tx = p.x; p.tz = p.z; send({ type: 'move', x: p.x, z: p.z, ry: p.ry, moving: false }); return; }
      }
      p.tx = p.x; p.tz = p.z; p.try = p.ry;
    }
    function updateAnim(dt, t) {
      updateTower(dt);
      const p = me(); if (!anim || !p) return;
      anim.t += dt;
      if (anim.type === 'pole') {
        const k = anim.t / anim.dur;
        pole.rotation.x = 0.25 + Math.max(0, Math.sin(anim.t * 11)) * 0.22;
        pole.position.y = 1.2 + Math.max(0, Math.sin(anim.t * 11)) * 0.25;
        const want = Math.min(anim.fruits.length, Math.floor(anim.fruits.length * Math.min(1, k * 1.4)));
        while (anim.dropped < want) dropFruit(anim.fruits[anim.dropped++]);
        if (anim.t >= anim.dur) {
          send({ type: 'harvest', where: 'tree', id: String(anim.slot) });
          for (const f of flying) if (f.kind === 'fruit') f.collect = 0;
          pole.visible = false; anim = null;
        }
      }
    }
    function updateFlying(dt) {
      const p = me();
      for (let i = flying.length - 1; i >= 0; i--) {
        const f = flying[i]; f.life += dt;
        if (f.kind === 'fruit') {
          if (f.collect != null && p) { // fly into the player's arms
            f.collect += dt * 2.2;
            f.m.position.lerp(new THREE.Vector3(p.x, 1.6, p.z), Math.min(1, f.collect));
            f.m.scale.setScalar(Math.max(0.05, 1 - f.collect));
            if (f.collect >= 1) { scene.remove(f.m); flying.splice(i, 1); }
            continue;
          }
          f.vy -= 9.8 * dt; f.m.position.x += f.vx * dt; f.m.position.z += f.vz * dt; f.m.position.y += f.vy * dt;
          if (f.m.position.y < 0.22) { f.m.position.y = 0.22; f.vy = Math.abs(f.vy) * 0.35; f.vx *= 0.6; f.vz *= 0.6; }
          if (f.life > 8) { scene.remove(f.m); flying.splice(i, 1); }
        } else {
          if (f.m.position.y > WATER_TOP) { f.vy -= 6 * dt; f.m.position.x += f.vx * dt; f.m.position.z += f.vz * dt; f.m.position.y += f.vy * dt; }
          else { f.m.position.y -= 0.25 * dt; f.m.material.opacity = Math.max(0, 1 - (WATER_TOP - f.m.position.y) / 1.4); }
          if (f.life > 6 || f.m.position.y < 0.8) { scene.remove(f.m); flying.splice(i, 1); }
        }
      }
    }
    // bubbles from the bubbler
    const bubbles = [];
    const bubbleMat = new THREE.MeshBasicMaterial({ color: '#e1f5fe', transparent: true, opacity: 0.7 });
    function updateBubbles(dt) {
      tankDecorG.children.forEach((o) => {
        if (!o.userData.bubbler || Math.random() > dt * 8) return;
        const b = new THREE.Mesh(new THREE.SphereGeometry(0.05 + Math.random() * 0.05, 6, 4), bubbleMat); b.position.set(o.position.x + (Math.random() - 0.5) * 0.1, 1.1, o.position.z); scene.add(b); bubbles.push(b);
      });
      for (let i = bubbles.length - 1; i >= 0; i--) { const b = bubbles[i]; b.position.y += dt * 0.9; b.position.x += Math.sin(b.position.y * 6) * 0.004; if (b.position.y > WATER_TOP) { scene.remove(b); bubbles.splice(i, 1); } }
    }

    // ---------- v5: walkable clouds & upstairs (platforms + ramps from WORLD.garden.levels) ----------
    const LV = GD.levels;
    let elev = null, lockWarn = 0, camSaved = null;
    const inR = (q, x, z) => x >= q.minX && x <= q.maxX && z >= q.minZ && z <= q.maxZ;
    const hAt = (q, x, z) => { if (!q.ramp) return q.y; const v = q.axis === 'z' ? z : x; return q.ya + (q.yb - q.ya) * Math.max(0, Math.min(1, (v - q.a) / (q.b - q.a))); };
    const tierOk = (q) => q.house || (q.tier || 0) <= (g().pots | 0);
    const lockToast = (q) => { if (performance.now() - lockWarn > 2500) { lockWarn = performance.now(); toast('🔒 Buy "' + C.UPGRADES.pots[q.tier].name + '" in the Shop (Upgrades tab) to walk up to this cloud island.'); } };
    function constrain(ox, oz, nx, nz) {
      if (!elev) {
        for (const q of LV) if (q.ramp && inR(q, nx, nz) && !inR(q, ox, oz) && hAt(q, nx, nz) < 0.6) { if (!tierOk(q)) { lockToast(q); return { x: ox, z: oz }; } elev = q; return { x: nx, z: nz }; }
        return null;
      }
      const h0 = hAt(elev, ox, oz);
      if (inR(elev, nx, nz)) return { x: nx, z: nz };
      for (const q of LV) { if (q === elev || !inR(q, nx, nz) || Math.abs(hAt(q, nx, nz) - h0) >= 0.6) continue; if (!tierOk(q)) { lockToast(q); return { x: ox, z: oz }; } elev = q; return { x: nx, z: nz }; }
      if (elev.ramp && h0 < 0.6) { elev = null; return { x: nx, z: nz }; }
      if (inR(elev, nx, oz)) return { x: nx, z: oz };
      if (inR(elev, ox, nz)) return { x: ox, z: nz };
      return { x: ox, z: oz };
    }
    const elevH = () => { const p = me(); return elev && p ? hAt(elev, p.x, p.z) : 0; };
    const HH = GD.house, inHouse = (p) => p.x > HH.minX && p.x < HH.maxX && p.z > HH.minZ && p.z < HH.maxZ;
    const penOf = (p) => { for (const [k, pen] of Object.entries(GD.pens)) if (p.x > pen.minX - 0.4 && p.x < pen.maxX + 0.4 && p.z > pen.minZ - 0.4 && p.z < pen.maxZ + 0.4) return k; return null; };
    function nearCloudPot(p) {
      if (!elev || elev.house) return -1;
      const y = elevH(); let best = -1, bd = 1.5;
      extras.potPositions(g().pots).forEach((pp, i) => { if (Math.abs(pp.y - y) > 0.8) return; const d = Math.hypot(p.x - pp.x, p.z - pp.z); if (d < bd) { bd = d; best = i; } });
      return best;
    }
    const nearCloudSign = (p) => !elev && Math.hypot(p.x - GD.rack.front.x, p.z - GD.rack.front.z) < 2.6;

    let refreshT = 0;
    function update(dt, t) {
      if (!state.profile) return;
      refreshT += dt; if (refreshT > 0.5) { refreshT = 0; refreshPlants(); }
      for (const o of plantObjs.values()) if (o.g.userData.spark) { o.g.userData.spark.rotation.y += dt * 3; o.g.userData.spark.position.y += Math.sin(t * 3) * 0.004; }
      const feeding = tower && tower.state === 'sprinkle' && tower.sent;
      for (const o of fishObjs.values()) {
        const u = o.userData;
        u.a += dt * u.sp * (feeding ? 1.6 : u.hungry ? 0.45 : 1); // hungry fish swim slowly
        u.cr += ((feeding ? 0.9 : u.r) - u.cr) * Math.min(1, dt * 1.2);
        u.cy += ((feeding ? WATER_TOP - 0.45 : u.y0 + Math.sin(t * 0.6 + u.ph) * 0.35) - u.cy) * Math.min(1, dt * 1.2);
        o.position.set(T.x + Math.cos(u.a) * u.cr, u.cy, T.z + Math.sin(u.a) * u.cr);
        o.rotation.y = u.sp > 0 ? -u.a : Math.PI - u.a;
        u.tail.rotation.y = Math.sin(t * 10 + u.ph) * 0.45;
        if (u.ico) { if (u.hungry && !feeding) ctx.project(o.position.x, o.position.y + 0.7, o.position.z, u.ico); else u.ico.style.display = 'none'; }
      }
      tankDecorG.children.forEach((o) => { if (o.userData.sway) o.userData.sway.forEach((s, i) => { s.rotation.z = Math.sin(t * 1.4 + i) * 0.18; }); });
      for (const o of decorObjs.values()) if (o.userData.spin) o.userData.spin.rotation.z += dt * 1.5;
      // animals: wander inside the pen, hungry / product icons, auto-collect when you walk up to them
      const p = me(), nowS = ctx.serverNow(), pen = p && penOf(p);
      for (const [uid, a] of animalObjs) {
        const A = C.ANIMALS[a.kind], area = PEN_AREA[a.pen], rec = a.rec || {};
        const hungry = !rec.fedAt, ready = !!rec.fedAt && nowS - rec.fedAt >= A.produceMin * 60000;
        const sp = a.kind === 'chicken' ? 1.1 : a.kind === 'pig' ? 0.8 : 0.55;
        if (a.wait > 0) { a.wait -= dt; } else {
          const dx = a.tx - a.x, dz = a.tz - a.z, d = Math.hypot(dx, dz);
          if (d < 0.1) { a.wait = 1 + Math.random() * 3; a.tx = area.minX + Math.random() * (area.maxX - area.minX); a.tz = area.minZ + Math.random() * (area.maxZ - area.minZ); }
          else { a.x += dx / d * sp * dt; a.z += dz / d * sp * dt; a.obj.rotation.y = Math.atan2(dx, dz); }
        }
        a.obj.position.set(a.x, 0, a.z);
        const walking = a.wait <= 0, hd = a.obj.userData.parts.head;
        a.obj.userData.body.position.y = walking ? Math.abs(Math.sin(t * 9 + a.ph)) * 0.05 : 0;
        if (hd) hd.rotation.x = !walking ? Math.max(0, Math.sin(t * (a.kind === 'chicken' ? 6 : 2) + a.ph)) * (a.kind === 'chicken' ? 0.9 : 0.25) : 0; // pecking / grazing
        if (ready && !a.prod) { a.prod = buildProduct(A.product); root.add(a.prod); }
        if (!ready && a.prod) { root.remove(a.prod); a.prod = null; }
        if (a.prod) { a.prod.position.set(a.x + 0.5, 0, a.z + 0.3); a.prod.userData.spark.rotation.y += dt * 3; }
        const iconTxt = hungry ? '🍽️' : ready ? C.PRODUCTS[A.product].icon : '';
        a.ico.textContent = iconTxt;
        if (iconTxt) ctx.project(a.x, a.kind === 'cow' ? 2.2 : a.kind === 'pig' ? 1.5 : 1.2, a.z, a.ico); else a.ico.style.display = 'none';
        if (ready && !state.visit && p && pen === a.pen && Math.hypot(p.x - a.x, p.z - a.z) < 1.6 && t - a.lastSend > 1.5) { a.lastSend = t; send({ type: 'collectAnimal', uid }); }
      }
      updateAnim(dt, t); updateFlying(dt); updateBubbles(dt);
      // house cut-away + closer camera when you're inside
      const ins = p && inHouse(p);
      farm.setCut(ins ? (elev && elev.house ? 'f2' : 'f1') : 'none');
      if (ins && !camSaved) { camSaved = { d: ctx.cam.dist, pitch: ctx.cam.pitch }; ctx.cam.dist = 12; ctx.cam.pitch = 1.0; }
      else if (!ins && camSaved) { ctx.cam.dist = camSaved.d; ctx.cam.pitch = camSaved.pitch; camSaved = null; }
      const k = p && !anim && !tower && !elev && !state.visit && plotAt(p);
      highlight.visible = !!k;
      if (k) { const [r, c] = k.split(',').map(Number), pos = center(r, c); highlight.position.set(pos.x, 0.22, pos.z); }
    }
    function interact(p) {
      if (anim) return true;
      if (tower) { if (tower.state === 'top') startSprinkle(); return true; }
      if (state.visit) { if (!state.visit.liked) send({ type: 'like' }); return true; }
      const gg = g();
      const pi = nearCloudPot(p);
      if (pi >= 0) { const rec = gg.flowerPots[pi]; if (!rec) openPlantPicker('pot', String(pi)); else if (prog(rec, 'pot') >= 1) send({ type: 'harvest', where: 'pot', id: String(pi) }); else openCare('pot', String(pi)); return true; }
      if (elev && !elev.house) { openPanel(ui.pots); renderPots(); return true; }
      if (inHouse(p)) { openPanel(ui.house); renderHouse(); return true; }
      if (nearCloudSign(p)) { openPanel(ui.pots); renderPots(); return true; }
      if (nearLadder(p)) { startClimb(false); return true; }
      const pen = penOf(p); if (pen) { openPen(pen); return true; }
      const k = plotAt(p);
      if (k) { const rec = gg.plots[k]; if (!rec) openPlantPicker('plot', k); else if (prog(rec, 'plot') >= 1) send({ type: 'harvest', where: 'plot', id: k }); else openCare('plot', k); return true; }
      const tr = nearestTree(p);
      if (tr) { const rec = gg.trees[tr.i]; if (!rec) openPlantPicker('tree', String(tr.i)); else if (prog(rec, 'tree') >= 1) startPole(tr.i); else openCare('tree', String(tr.i)); return true; }
      if (nearStall(p)) { openMarket('now', true); return true; }
      if (nearNotice(p)) { openMarket('browse', true); return true; }
      if (nearTank(p)) { openPanel(ui.pond); renderPond(); return true; }
      return false;
    }
    function hint(p) {
      if (anim) return '🥢 Poking the fruit down…';
      if (tower) return tower.state === 'top' ? '<kbd>E</kbd> sprinkle food 🍤 · press <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> to climb down' : tower.state === 'sprinkle' ? '🍤 Sprinkling food…' : tower.state === 'up' ? '⬆️ Climbing up…' : '⬇️ Climbing down…';
      if (state.visit) return `👀 Visiting ${esc(state.visit.owner)} · ` + (state.visit.liked ? '❤️ Liked today' : '<kbd>E</kbd> Like ❤️');
      const gg = g();
      const status = (rec, where) => { const info = C.plantInfo(rec.s), pg = prog(rec, where); if (pg >= 1) return null; const left = (1 - pg) * C.cycleMs(rec, where, gg.pots) / 1000; return `${info.icon} ${info.name} ${Math.floor(pg * 100)}% · ${left >= 60 ? Math.ceil(left / 60) + ' min' : Math.ceil(left) + ' s'} left · <kbd>E</kbd> tend${rec.w ? ' 💧' : ''}${rec.f ? ' 🧪' : ''}`; };
      const pi = nearCloudPot(p);
      if (pi >= 0) { const rec = gg.flowerPots[pi]; if (!rec) return '<kbd>E</kbd> plant a flower in pot ' + (pi + 1); return status(rec, 'pot') || `<kbd>E</kbd> pick ${C.plantInfo(rec.s).icon} ${C.plantInfo(rec.s).name}`; }
      if (elev && !elev.house) return '☁️ Cloud Flower Garden · <kbd>E</kbd> open the flower pots';
      if (inHouse(p)) return (elev ? '🏠 Upstairs' : '🏠 Ground floor (the stairs are in the right-hand corner)') + ' · <kbd>E</kbd> decorate the house';
      if (nearCloudSign(p)) return '☁️ Walk up the cloud steps to tend the flowers · <kbd>E</kbd> open the flower pots';
      if (nearLadder(p)) return '<kbd>E</kbd> climb the tower to feed the fish ⬆️';
      const pen = penOf(p); if (pen) { const kind = GD.pens[pen].kind, list = (gg.animals || []).filter((a) => a.kind === kind), hungry = list.filter((a) => !a.fedAt).length; return `${GD.pens[pen].name}: ${list.length} animals · ${hungry} hungry · <kbd>E</kbd> feed / look · walk up to an animal to collect its product`; }
      const k = plotAt(p);
      if (k) { const rec = gg.plots[k]; if (!rec) return '<kbd>E</kbd> plant vegetables'; return status(rec, 'plot') || `<kbd>E</kbd> harvest ${C.plantInfo(rec.s).icon} ${C.plantInfo(rec.s).name}`; }
      const tr = nearestTree(p);
      if (tr) { const rec = gg.trees[tr.i]; if (!rec) return '<kbd>E</kbd> plant a sapling'; return status(rec, 'tree') || `<kbd>E</kbd> grab the pole to poke down ${C.plantInfo(rec.s).icon} ${C.plantInfo(rec.s).name}`; }
      if (nearStall(p)) return '<kbd>E</kbd> open the Farm Stall 🏷️';
      if (nearNotice(p)) return '<kbd>E</kbd> read the notice board: Market offers 📌';
      if (nearTank(p)) return '<kbd>E</kbd> tend the Fish Tank 🐠';
      return '';
    }
    function reset() { if (tower) { tower = null; } anim = null; pole.visible = false; elev = null; farm.setCut('none'); if (camSaved) { ctx.cam.dist = camSaved.d; ctx.cam.pitch = camSaved.pitch; camSaved = null; } hideIcons(); }

    return { rebuild: sync, sync, update, interact, hint, startFeeding, reset, constrain, elevated: () => !!elev, busy: () => !!anim || !!tower, yOff: () => (tower ? tower.y : elevH()), data: g };
  }

  // ===================================================================== forest ambience (procedural Web Audio)
  function makeAmbience() {
    const A = { on: false, wind: 1, vol: 0.8, nodes: null, birdT: 0 };
    function build() {
      const ac = ctx.audio.ctx; if (!ac || A.nodes) return !!A.nodes;
      const len = ac.sampleRate * 2, buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
      let b = 0; for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; b = (b + 0.02 * w) / 1.02; d[i] = w * 0.6 + b * 2; }
      const noise = () => { const s = ac.createBufferSource(); s.buffer = buf; s.loop = true; s.start(0, Math.random() * 2); return s; };
      const master = ac.createGain(); master.gain.value = 0; master.connect(ac.destination);
      const water = (x, z, vol, f) => {
        const pan = ac.createPanner(); Object.assign(pan, { panningModel: 'equalpower', distanceModel: 'inverse', refDistance: 7, maxDistance: 90, rolloffFactor: 1.1 });
        pan.positionX.value = x; pan.positionY.value = 1; pan.positionZ.value = z;
        const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = 0.6;
        const bab = ac.createBiquadFilter(); bab.type = 'bandpass'; bab.frequency.value = f * 2.2; bab.Q.value = 4;
        const g = ac.createGain(); g.gain.value = vol; const g2 = ac.createGain(); g2.gain.value = vol * 0.7;
        noise().connect(bp).connect(g).connect(pan); noise().connect(bab).connect(g2).connect(pan); pan.connect(master);
        return bab;
      };
      const L0 = WORLD.lake; // audio zones follow the (seamless) forest lake: waterfall, stream, lake
      const babs = [water(L0.x, L0.z - 13.5, 0.9, 700), water(L0.x + 19, L0.z - 14, 0.6, 1100), water(L0.x - 2, L0.z + 2, 0.25, 500)];
      const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1600;
      const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 6500;
      const leafG = ac.createGain(); leafG.gain.value = 0.05;
      noise().connect(hp).connect(lp).connect(leafG).connect(master);
      A.nodes = { master, babs, leafG };
      return true;
    }
    function bird() {
      const ac = ctx.audio.ctx, p = me(); if (!ac || !A.nodes || !p) return;
      const pan = ac.createPanner(); Object.assign(pan, { panningModel: 'equalpower', distanceModel: 'inverse', refDistance: 6, rolloffFactor: 1 });
      const a = Math.random() * 6.28, r = 6 + Math.random() * 16;
      pan.positionX.value = p.x + Math.cos(a) * r; pan.positionY.value = 5; pan.positionZ.value = p.z + Math.sin(a) * r;
      pan.connect(A.nodes.master);
      const t0 = ac.currentTime + 0.05, kind = Math.floor(Math.random() * 3);
      const note = (t, f1, f2, dur, v = 0.12) => {
        const o = ac.createOscillator(), g = ac.createGain(); o.type = 'sine';
        o.frequency.setValueAtTime(f1, t); o.frequency.exponentialRampToValueAtTime(f2, t + dur);
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + dur * 0.2); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        o.connect(g).connect(pan); o.start(t); o.stop(t + dur + 0.02);
      };
      if (kind === 0) { const n = 4 + Math.floor(Math.random() * 5), base = 3000 + Math.random() * 1500; for (let i = 0; i < n; i++) note(t0 + i * 0.075, base, base + 900, 0.06); }
      else if (kind === 1) { const b = 1700 + Math.random() * 600; note(t0, b, b * 1.35, 0.22, 0.1); note(t0 + 0.3, b * 1.2, b * 1.05, 0.28, 0.1); }
      else { const b = 2400 + Math.random() * 1200; for (let i = 0; i < 3; i++) note(t0 + i * 0.16, b * (1 + (i % 2) * 0.25), b * (1.3 - (i % 2) * 0.2), 0.12, 0.09); }
    }
    A.setOn = (on) => {
      A.on = on;
      if (on) build();
      if (A.nodes) A.nodes.master.gain.setTargetAtTime(on && !ctx.audio.muted ? A.vol : 0, ctx.audio.ctx.currentTime, 0.5);
    };
    let windTarget = 1, windT = 0, last = performance.now();
    A.update = () => {
      const now = performance.now(), dt = (now - last) / 1000; last = now;
      windT -= dt; if (windT <= 0) { windT = 2 + Math.random() * 4; windTarget = 0.4 + Math.random() * 1.4; }
      A.wind += (windTarget - A.wind) * Math.min(1, dt * 0.8);
      if (!A.on || !A.nodes) return;
      const ac = ctx.audio.ctx, p = me();
      A.nodes.leafG.gain.setTargetAtTime(0.03 + A.wind * 0.06, ac.currentTime, 0.3);
      A.nodes.babs.forEach((b) => b.frequency.setTargetAtTime(1200 + Math.random() * 900, ac.currentTime, 0.08));
      const target = ctx.audio.muted ? 0 : A.vol;
      if (Math.abs(A.nodes.master.gain.value - target) > 0.01 && !A.fading) A.nodes.master.gain.setTargetAtTime(target, ac.currentTime, 0.4);
      if (p) {
        const L = ac.listener; const yaw = ctx.cam.yaw;
        if (L.positionX) { L.positionX.value = p.x; L.positionY.value = 1.5; L.positionZ.value = p.z; L.forwardX.value = -Math.sin(yaw); L.forwardY.value = 0; L.forwardZ.value = -Math.cos(yaw); L.upX.value = 0; L.upY.value = 1; L.upZ.value = 0; }
        else { L.setPosition(p.x, 1.5, p.z); L.setOrientation(-Math.sin(yaw), 0, -Math.cos(yaw), 0, 1, 0); }
      }
      A.birdT -= dt; if (A.birdT <= 0) { A.birdT = 1.2 + Math.random() * 4; bird(); }
    };
    return A;
  }
  ui.forestVol.querySelector('input').oninput = (e) => { amb.vol = +e.target.value; amb.setOn(amb.on); };

  // ===================================================================== UI scaffolding
  function buildUi() {
    const hud = document.createElement('div'); hud.id = 'vcHud'; hud.className = 'hidden';
    hud.innerHTML = `
      <div id="vcStatus" class="panel hidden"></div>
      <div id="vcBar" class="panel">
        <div class="xu" title="Your Xu"><span class="coin"></span><b id="vcXu">0</b><small id="vcCap"></small></div>
        <button id="vcGarden" class="primary">🌱 My Garden</button>
        <button id="vcMore" aria-label="More buttons" aria-expanded="false" title="Show or hide Bag, Earnings and Friends">⋯</button>
        <button id="vcBag" title="Bag (B)">🎒 Bag</button>
        <button id="vcEarn" title="Today's earnings">📒 Earnings</button>
        <button id="vcFriends" title="Friends: visit their gardens">👥 Friends<span class="n hidden"></span></button>
        <button id="vcBoost" class="hidden" title="Whole garden grows 50% faster for 1 hour">⚡ Boost</button>
        <button id="vcLike" class="hidden primary">🤍 Like</button>
        <button id="vcBack" class="hidden">🏫 Back to Plaza</button>
        <span id="vcCarry" class="badge hidden"></span>
      </div>
      <div id="vcForestVol" class="panel hidden">🌿 Forest sound <input type="range" min="0" max="1.5" step="0.05" value="0.8"></div>`;
    document.getElementById('hud').appendChild(hud);
    const mk = (id, title, extra = '') => { const d = document.createElement('div'); d.id = id; d.className = 'vc-panel panel hidden'; d.innerHTML = `<header><b>${title}</b>${extra}<button class="x">✕</button></header><div class="body"></div>`; document.getElementById('hud').appendChild(d); return d; };
    const shop = mk('vcShop', '🏪 Shop', '<span class="wallet"></span>');
    shop.querySelector('.body').innerHTML = `<div class="tabs"><button data-tab="crop">🥕 Vegetables & fertiliser</button><button data-tab="flower">🌸 Flowers & pots</button><button data-tab="tree">🌳 Saplings</button><button data-tab="fish">🐟 Fish & tank</button><button data-tab="animal">🐔 Animals</button><button data-tab="home">🛋️ House</button><button data-tab="decor">🏮 Decor</button><button data-tab="up">⬆️ Upgrades</button><button data-tab="sell">💰 Sell</button></div><div class="content"></div>`;
    const bag = mk('vcBag2', '🎒 Bag'), pond = mk('vcPond', '🐠 Fish Tank'), earn = mk('vcEarn2', '📒 Today\'s earnings'), seeds = mk('vcSeeds', '🌱 Choose seeds');
    const market = mk('vcMarket', '🏪 Market', '<span class="wallet"></span>'), merchantP = mk('vcMerchant', '🧳 Merchant'), pots = mk('vcPots', '🌷 Cloud Flower Garden'), care = mk('vcCare', '🌱 Care');
    const board = mk('vcBoard', '🏆 Best of the Week'), food = mk('vcFood', '🍽️ Food & drinks'), house = mk('vcHouse', '🏠 Decorate the house'), pen = mk('vcPen', '🐔 Animal pen');
    const friends = mk('vcFriends2', '👥 Friends'); friends.classList.add('small-panel');
    food.classList.add('small-panel');
    const quiz = document.createElement('div'); quiz.className = 'modal hidden'; quiz.innerHTML = `<div class="panel vc-quiz"><div class="big">⏱️📚</div><h3>25 focused minutes complete!</h3><p class="sub"></p><div class="q"></div><div class="opts"></div><div class="small muted src"></div></div>`;
    document.body.appendChild(quiz);
    care.classList.add('small-panel'); merchantP.classList.add('small-panel');
    const gate = document.createElement('div'); gate.className = 'modal hidden'; gate.innerHTML = `<div class="panel vc-gate"><div class="big">🌲🏞️🐦</div><h3>Enter the Quiet Forest?</h3><p>A peaceful study spot by the lake: birdsong, a flowing stream, rustling leaves. Studying here earns <b>+25% Xu</b>, and there is a <b>Fishing Dock</b> for catching fish to keep.</p><div class="row" style="justify-content:flex-end"><button class="no">Stay</button><button class="primary yes">Enter</button></div></div>`;
    document.body.appendChild(gate);
    const afk = document.createElement('div'); afk.className = 'modal hidden'; afk.innerHTML = `<div class="panel"><h3>Are you still there? 👀</h3><p>We haven't seen any activity from you for a while, so Xu earning is paused.</p><div class="row" style="justify-content:flex-end"><button class="primary">Still studying!</button></div></div>`;
    document.body.appendChild(afk);
    const fade = document.createElement('div'); fade.id = 'vcFade'; fade.innerHTML = '<div class="leaves">🍃 🍂 🍃 🌿 🍃 🍂</div><div class="t"></div>'; document.body.appendChild(fade);
    const reelBtn = document.createElement('button'); reelBtn.id = 'vcReel'; reelBtn.type = 'button'; reelBtn.className = 'hidden'; reelBtn.setAttribute('aria-label', 'Fishing action'); document.getElementById('hud').appendChild(reelBtn);
    const fishGame = document.createElement('div'); fishGame.id = 'vcFish'; fishGame.className = 'panel hidden';
    fishGame.innerHTML = '<div class="ttl">🎣 Reel it in! Press <kbd>E</kbd> / <kbd>Space</kbd> when the needle is in the green</div><div class="track"><div class="zone"></div><div class="needle"></div></div><div class="st"></div>';
    document.getElementById('hud').appendChild(fishGame);
    return { hud, shop, bag, pond, earn, seeds, market, merchantP, pots, care, board, quiz, food, house, pen, gate, afk, fade, fishGame, reelBtn, friends, friendsBtn: hud.querySelector('#vcFriends'), moreBtn: hud.querySelector('#vcMore'), bar: hud.querySelector('#vcBar'),
      boostBtn: hud.querySelector('#vcBoost'), likeBtn: hud.querySelector('#vcLike'), backBtn: hud.querySelector('#vcBack'), status: hud.querySelector('#vcStatus'), xu: hud.querySelector('#vcXu'), cap: hud.querySelector('#vcCap'), gardenBtn: hud.querySelector('#vcGarden'), bagBtn: hud.querySelector('#vcBag'), earnBtn: hud.querySelector('#vcEarn'), carry: hud.querySelector('#vcCarry'), forestVol: hud.querySelector('#vcForestVol') };
  }

  return {
    onMessage, update, interact, hint, stopFishing: () => stopFishing(),
    blockMove: () => modalOpen || fish.phase !== 'idle' || !!act || ui.fade.classList.contains('on') || garden.busy(),
    yOff: () => (state.area === 'garden' ? garden.yOff() : act ? act.y : 0),
    elevated: () => state.area === 'garden' && garden.elevated(),
    bounds: () => WORLD.areas[state.area].bounds,
    areaCenter: () => WORLD.areas[state.area].center,
    // lobby + forest are one seamless map (everyone sees everyone); a garden shows only people in that same garden
    // who is drawn: the same view group as you (outdoors incl. forest / the same closed room / the same garden island)
    visible: (p) => { const m = me(); return !m || ctx.Room.viewKey(p) === ctx.Room.viewKey(m); },
    constrain(ox, oz, nx, nz) {
      if (state.area === 'garden') { const c2 = garden.constrain(ox, oz, nx, nz); if (c2) return c2; }
      if (!extras.isWater(nx, nz)) return { x: nx, z: nz };
      if (!extras.isWater(nx, oz)) return { x: nx, z: oz };
      if (!extras.isWater(ox, nz)) return { x: ox, z: nz };
      return { x: ox, z: oz };
    },
    screenInfo: () => {
      const cur = state.current; if (!cur) return null;
      const el = (ctx.serverNow() - cur.startedAt) / 1000;
      return { title: cur.song.title, by: cur.song.byName, progress: Math.max(0, Math.min(1, el / cur.song.duration)) };
    },
  };
}

function injectCss() {
  const s = document.createElement('style');
  s.textContent = `
  #vcHud { position:absolute; inset:0; pointer-events:none; }
  #vcHud > * { pointer-events:auto; }
  #vcBar { position:absolute; left:50%; bottom:14px; transform:translateX(-50%); display:flex; gap:8px; align-items:center; padding:8px 10px; }
  #vcBar .xu { display:flex; align-items:baseline; gap:6px; padding:4px 12px; border-radius:10px; background:rgba(255,210,63,0.15); }
  #vcBar .xu b { font-size:20px; color:var(--accent); }
  #vcBar .coin { width:18px; height:18px; border-radius:50%; background:radial-gradient(circle at 35% 35%, #fff3a0, #ffd23f 45%, #e0a800); box-shadow: inset 0 0 0 2px #c99400; align-self:center; }
  #vcBar button { white-space:nowrap; }
  #vcBar .xu small { font-size:11px; color:var(--muted); }
  #vcBar .xu.bump { animation: vcBump .35s ease-out; }
  @keyframes vcBump { 40% { transform: scale(1.15); } }
  #vcStatus { position:absolute; left:50%; bottom:76px; transform:translateX(-50%); padding:6px 14px; font-size:14px; white-space:nowrap; }
  #hint { bottom: 118px !important; }
  #vcForestVol { position:absolute; right:14px; bottom:96px; padding:8px 12px; font-size:13px; display:flex; gap:8px; align-items:center; }
  #vcForestVol input { width:110px; padding:0; }
  .vc-float { position:absolute; transform:translate(-50%,-100%); font-weight:700; font-size:18px; text-shadow:0 2px 4px rgba(0,0,0,.6); pointer-events:none; white-space:nowrap; }
  .vc-panel { position:absolute; left:50%; top:50%; transform:translate(-50%,-50%); width:min(720px,94vw); max-height:80vh; display:flex; flex-direction:column; z-index:5; animation: pop .15s ease-out; }
  .vc-panel header { display:flex; align-items:center; gap:10px; padding:12px 14px; border-bottom:1px solid var(--line); }
  .vc-panel header b { font-size:18px; flex:1; }
  .vc-panel header .wallet { color:var(--accent); font-weight:600; }
  .vc-panel .body { padding:12px 14px; overflow:auto; }
  .vc-panel h4 { margin:12px 0 6px; font-size:13px; text-transform:uppercase; letter-spacing:1px; color:var(--muted); }
  .vc-panel .tabs { display:flex; gap:6px; flex-wrap:wrap; margin-bottom:10px; }
  .vc-panel .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(150px,1fr)); gap:8px; }
  .vc-card { background:rgba(255,255,255,0.06); border:1px solid var(--line); border-radius:12px; padding:10px; text-align:center; display:flex; flex-direction:column; gap:4px; }
  .vc-card .ic { font-size:30px; line-height:1.1; }
  .vc-card .nm { font-weight:600; }
  .vc-card .in { font-size:12px; color:var(--muted); min-height:30px; }
  .vc-card .bt { display:flex; gap:4px; justify-content:center; flex-wrap:wrap; }
  .vc-card .bt button { padding:5px 10px; font-size:13px; }
  .small { font-size:12.5px; }
  .vc-bar { height:10px; background:rgba(255,255,255,.12); border-radius:6px; overflow:hidden; margin:6px 0; }
  .vc-bar > div { height:100%; background:linear-gradient(90deg,#ffd23f,#4dd0e1); }
  .vc-tbl { width:100%; font-size:13px; border-collapse:collapse; } .vc-tbl td { padding:4px 6px; border-bottom:1px solid var(--line); } .vc-tbl td:first-child { white-space:nowrap; }
  .vc-gate { width:min(420px,92vw) !important; text-align:center; } .vc-gate .big { font-size:42px; } .vc-gate p { color:#d6dcf5 !important; }
  #vcFade { position:fixed; inset:0; z-index:80; pointer-events:none; opacity:0; transition:opacity .5s; background:radial-gradient(circle at 50% 50%, #2e7d32, #0d2b14); display:grid; place-items:center; }
  #vcFade.on { opacity:1; pointer-events:auto; }
  #vcFade .t { font-size:26px; font-weight:600; color:#fff; text-shadow:0 2px 8px rgba(0,0,0,.5); }
  #vcFade .leaves { position:absolute; inset:0; font-size:34px; letter-spacing:60px; overflow:hidden; white-space:nowrap; animation: vcLeaves 2.2s linear infinite; opacity:.8; }
  @keyframes vcLeaves { from { transform: translate(-20%, -30%) rotate(8deg); } to { transform: translate(10%, 110%) rotate(-8deg); } }
  .vc-panel.small-panel { width:min(440px,94vw); }
  .vc-card.rare { border-color:#ffd23f; box-shadow:0 0 12px rgba(255,210,63,.25) inset; }
  #vcBoard .boards { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
  #vcBoard .brow { display:flex; align-items:center; gap:8px; padding:6px 8px; border-radius:8px; font-size:13.5px; }
  #vcBoard .brow:nth-child(even) { background:rgba(255,255,255,.04); }
  #vcBoard .brow.me { background:rgba(255,210,63,.15); }
  #vcBoard .brow .nm { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  #vcBoard .brow .sc { color:var(--muted); font-size:12px; white-space:nowrap; }
  #vcBoard .brow button { padding:3px 8px; font-size:12px; }
  .vc-quiz { width:min(480px,94vw) !important; text-align:center; }
  .vc-quiz .big { font-size:38px; } .vc-quiz .q { font-size:17px; font-weight:600; margin:10px 0; }
  .vc-quiz .opts { display:grid; gap:8px; margin:8px 0; } .vc-quiz .opts button { text-align:left; padding:10px 12px; }
  .vc-panel .note { margin-bottom:8px; }
  .vc-card.locked { opacity:.45; }
  .vc-card .vc-bar { height:6px; margin:4px 0 0; }
  .vc-panel .grid.pots { grid-template-columns:repeat(4,1fr); }
  .vc-form { display:grid; gap:8px; margin:6px 0 10px; }
  .vc-form label { display:flex; flex-direction:column; gap:4px; font-size:13px; color:var(--muted); }
  .vc-form label.chk { flex-direction:row; align-items:center; color:var(--text); }
  .vc-form label.chk input { width:auto; }
  .vc-form select { font:inherit; color:var(--text); background:rgba(0,0,0,0.35); border:1px solid var(--line); border-radius:10px; padding:8px 10px; }
  .vc-form select option { background:#161b2e; }
  .merchant { text-align:center; } .merchant .big { font-size:46px; } .merchant > div { margin:6px 0; }
  #vcFish { position:absolute; left:50%; top:22%; transform:translateX(-50%); width:min(460px,90vw); padding:14px; text-align:center; }
  #vcFish { width:min(300px,80vw) !important; left:auto !important; right:24px; top:22% !important; transform:none !important; }
  #vcFish .vbox { display:flex; gap:10px; justify-content:center; margin:10px 0; }
  #vcFish .vtrack { position:relative; width:46px; height:240px; border-radius:12px; background:linear-gradient(#1b4f72,#0b2530); overflow:hidden; border:2px solid rgba(255,255,255,.2); }
  #vcFish .vzone { position:absolute; left:3px; right:3px; background:rgba(102,187,106,.85); border-radius:8px; box-shadow:0 0 10px #66bb6a; }
  #vcFish .vfish { position:absolute; left:0; right:0; text-align:center; font-size:24px; transform:translateY(50%); }
  #vcFish .vprog { position:relative; width:14px; height:240px; border-radius:7px; background:rgba(255,255,255,.12); overflow:hidden; }
  #vcFish .vprog > div { position:absolute; bottom:0; left:0; right:0; background:linear-gradient(#ffd23f,#66bb6a); }
  .vc-ico { position:absolute; transform:translate(-50%,-100%); font-size:20px; pointer-events:none; filter:drop-shadow(0 2px 2px rgba(0,0,0,.5)); animation: vcBob 1s ease-in-out infinite; }
  @keyframes vcBob { 50% { margin-top:-6px; } }
  #vcFish .track { position:relative; height:26px; margin:12px 0 8px; border-radius:13px; background:rgba(255,255,255,.12); overflow:hidden; }
  #vcFish .zone { position:absolute; top:0; bottom:0; background:#66bb6a; }
  #vcFish .needle { position:absolute; top:-2px; bottom:-2px; width:6px; margin-left:-3px; background:#ffd23f; border-radius:3px; box-shadow:0 0 8px #ffd23f; }
  #vcFish .st { font-size:13px; color:var(--muted); }
  @media (max-width: 900px) { #vcBar { bottom: 220px; } }
  `;
  document.head.appendChild(s);
}
