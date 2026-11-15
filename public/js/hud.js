// Chat, shared music and the player card (interactions from campus-game-v4, panels from campus-export).
import { $, el, esc, fmtTime } from './util.js';
import { createPanel, setPanelOpen, toast } from './panels.js';
import { parseYouTubeId, createPlayer, probeVideo } from './youtube.js';

// ---------------------------------------------------------------- chat: everyone (bottom-left) + table chat (side panel while seated)
export function createChat({ net, state, players }) {
  const log = $('chat-log'); const input = $('chatInput');
  const line = (m) => {
    if (m.system) return el('div', { class: 'line sys', text: m.text });
    const who = el('span', { class: 'who', text: `${m.admin ? '★ ' : ''}${m.name}:` }); who.style.color = m.color || '#FFE9A8';
    return el('div', { class: 'line' }, m.local ? el('span', { class: 'loc', text: '[Local]' }) : null, who, el('span', { text: ' ' + m.text }));
  };
  const addTo = (box, m) => {
    const stick = box.scrollTop + box.clientHeight >= box.scrollHeight - 30;
    box.append(line(m)); while (box.children.length > 120) box.firstChild.remove();
    if (stick) box.scrollTop = box.scrollHeight;
  };
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { const text = input.value.trim(); if (text) net.send({ type: 'chat', text }); input.value = ''; input.blur(); }
    else if (e.key === 'Escape') input.blur();
    e.stopPropagation();
  });
  const panel = createPanel('tablechat', 'Table chat', { hidden: true, contextual: true, collapsed: innerWidth < 768 }); // on a phone it opens as one line; + unfolds it
  const tlog = el('div', { class: 'tlog' });
  const tinput = el('input', { type: 'text', maxlength: 200, placeholder: 'Only people at your table see this', autocomplete: 'off' });
  panel.body.append(tlog, tinput);
  tinput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { const text = tinput.value.trim(); if (text) net.send({ type: 'tableChat', text }); tinput.value = ''; }
    else if (e.key === 'Escape') tinput.blur();
    e.stopPropagation();
  });
  net.on('chat', (m) => { if (m.id && players.isBlocked(m.id)) return; addTo(log, m); if (m.id) players.say(m.id, m.text); });
  net.on('tableChat', (m) => { if (m.id && players.isBlocked(m.id)) return; addTo(tlog, m); if (m.id) players.say(m.id, m.text); });
  return {
    history(list) { for (const m of list || []) addTo(log, m); },
    system(text) { addTo(log, { system: true, text }); },
    setSeated(table) { // table = the table object you sat down at, or null
      const on = !!table && table.kind !== 'cinema' && table.room !== 'tro-choi'; // game tables have their own chat next to the game
      panel.root.hidden = !on;
      if (on) { panel.setTitle('Table chat · ' + table.name); tlog.replaceChildren(); addTo(tlog, { system: true, text: 'Only players at this table can see these messages.' }); }
    },
    focus(table) { if (table && !panel.root.hidden) tinput.focus(); else { $('chat').hidden = false; input.focus(); } },
    toggle() { $('chat').hidden = !$('chat').hidden; },
  };
}

// ---------------------------------------------------------------- shared music: one YouTube queue for everyone (silent when it is empty)
export function createMusic({ net, state, audio }) {
  const MAX = 2;
  const panel = createPanel('music', '🎵 Shared music', { collapsed: true, side: 'left', closed: innerWidth < 768 }); // on a phone it stays away until Music is chosen in the menu
  const nowEl = el('div', { class: 'now' });
  const muteBtn = el('button', { class: 'ghost', title: 'Mute or unmute all sound for yourself only', text: '🔊' });
  const link = el('input', { type: 'text', placeholder: 'Paste a YouTube link', autocomplete: 'off' });
  const addBtn = el('button', { text: 'Add' });
  const count = el('span', { class: 'meta' });
  const list = el('ul', { class: 'queue' });
  panel.body.append(el('div', { class: 'row' }, nowEl, muteBtn), el('div', { class: 'row' }, link, addBtn),
    el('div', { class: 'row between' }, el('span', { class: 'meta', text: 'Max 2 songs each, under 6 min' }), count), list);
  let player = null; let playingId = null; let snap = { queue: [], current: null }; let silenced = false; let duck = 1;
  const audible = () => !audio.muted && !silenced;

  function applySound() {
    if (player) { try { audible() ? player.unMute() : player.mute(); player.setVolume(Math.round(100 * duck)); } catch { /* player not ready */ } }
    muteBtn.textContent = audio.muted ? '🔇' : '🔊';
  }
  function syncPlayer() {
    if (player) {
      const cur = snap.current;
      if (!cur) { if (playingId !== null) player.stopVideo(); playingId = null; }
      else if (cur.song.id !== playingId) { playingId = cur.song.id; player.loadVideoById({ videoId: cur.song.videoId, startSeconds: Math.max(0, (net.serverNow() - cur.startedAt) / 1000) }); }
    }
    applySound();
  }
  function render() {
    list.replaceChildren();
    const rows = (snap.current ? [{ s: snap.current.song, playing: true }] : []).concat(snap.queue.map((s) => ({ s })));
    if (!rows.length) list.append(el('li', { class: 'empty', text: 'Nothing queued' }));
    for (const { s, playing } of rows) {
      const li = el('li', { class: playing ? 'playing' : '' }, el('div', { class: 'info' }, el('span', { class: 'title', text: (playing ? '▶ ' : '') + s.title }), el('span', { class: 'meta', text: `${s.byName} · ${fmtTime(s.duration)}` })));
      if (s.by === state.me || state.isAdmin) li.append(el('button', { class: 'rm', title: 'Remove', text: '✕', onclick: () => net.send({ type: 'removeSong', songId: s.id }) }));
      list.append(li);
    }
    count.textContent = `${rows.filter((r) => r.s.by === state.me).length}/${MAX} yours`;
    nowEl.textContent = snap.current ? `Now playing: ${snap.current.song.title}` : 'Nothing playing';
  }
  async function addFromInput() {
    const id = parseYouTubeId(link.value);
    if (!id) return toast("That doesn't look like a YouTube link.", 'error');
    addBtn.disabled = true; addBtn.textContent = 'Checking…';
    try { const v = await probeVideo(id); net.send({ type: 'addSong', videoId: v.videoId, title: v.title, duration: v.duration }); link.value = ''; }
    catch (e) { toast(e.message, 'error'); }
    finally { addBtn.disabled = false; addBtn.textContent = 'Add'; }
  }
  addBtn.addEventListener('click', addFromInput);
  link.addEventListener('keydown', (e) => { if (e.key === 'Enter') addFromInput(); e.stopPropagation(); });
  muteBtn.addEventListener('click', () => { audio.muted = !audio.muted; applySound(); });
  net.on('music', (m) => { snap = m; state.current = m.current; render(); syncPlayer(); });
  render();
  return {
    /** Call after a click (browsers only allow sound after a user gesture). */
    async start() {
      applySound();
      const host = el('div'); $('audio-host').append(host);
      try { player = await createPlayer(host, { width: 200, height: 120 }); syncPlayer(); } catch { /* offline: no YouTube, so no music */ }
    },
    open() { panel.root.classList.remove('closed', 'collapsed'); link.focus(); },
    toggle() { const c = panel.root.classList.contains('closed'); setPanelOpen('music', c); if (c) panel.root.classList.remove('collapsed'); },
    setSilenced(v) { silenced = v; applySound(); },   // inside the cinema you hear the film only
    setDuck(k) { duck = k; applySound(); },           // quieter in the forest
    refresh() { render(); applySound(); },
  };
}

// ---------------------------------------------------------------- player card (report / block), admin login
export function createSocial({ net, state, players }) {
  const card = $('playerCard'); const blocked = new Set();
  function open(id) {
    const rec = state.players.get(id); if (!rec || rec.isMe) return;
    state.selectedPlayer = id;
    card.querySelector('.ten').textContent = (rec.admin ? '★ ' : '') + rec.name;
    card.querySelector('[data-act=block]').textContent = blocked.has(id) ? 'Unblock' : 'Block';
    card.classList.remove('hidden');
  }
  const close = () => { state.selectedPlayer = null; card.classList.add('hidden'); };
  card.addEventListener('click', (e) => {
    const act = e.target.closest('button')?.dataset.act; const id = state.selectedPlayer; if (!act) return;
    if (act === 'report') { net.send({ type: 'report', target: id, reason: '' }); toast('Report sent to the admins.'); }
    if (act === 'block') { blocked.has(id) ? blocked.delete(id) : blocked.add(id); players.setBlocked(blocked); toast(blocked.has(id) ? 'Blocked: you no longer see this player or their messages.' : 'Unblocked.'); }
    close();
  });
  function adminLogin() {
    if (state.isAdmin) return toast('You are already an admin.');
    const box = $('lop-phu');
    const pw = el('input', { type: 'password', placeholder: 'Admin password', autocomplete: 'off' });
    pw.style.cssText = 'width:100%;font:700 16px Nunito;border:3px solid var(--ink);border-radius:12px;padding:8px 12px;margin:8px 0;';
    const done = () => { box.hidden = true; box.replaceChildren(); };
    const go = () => { net.send({ type: 'adminLogin', password: pw.value }); done(); };
    pw.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') go(); if (e.key === 'Escape') done(); });
    box.replaceChildren(el('div', { class: 'the' }, el('h2', { text: '🛡 Admin login' }), el('p', { text: 'Admins can remove any song or video and receive reports.' }), pw,
      el('div', { class: 'row', style: 'justify-content:center' }, el('button', { class: 'nut nho xam', text: 'Cancel', onclick: done }), el('button', { class: 'nut nho', text: 'Log in', onclick: go }))));
    box.hidden = false; pw.focus();
  }
  net.on('admin', (m) => { if (m.ok) { state.isAdmin = true; toast('You are now an admin.'); state.onAdmin?.(); } else toast('Wrong admin password.', 'error'); });
  net.on('reportIn', (m) => toast(`Report: ${m.from} reported ${m.target}${m.reason ? ' — ' + m.reason : ''}`));
  return { open, close, adminLogin, isBlocked: (id) => blocked.has(id) };
}
