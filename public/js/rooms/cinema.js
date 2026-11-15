// Cinema room, client half (from campus-export): the shared video on the big screen, the queue panel and a pop-up.
// Rules and queue live on the server (shared/roomplugins.js CinemaRoom): 2 videos per player, each under 3 hours.
// Combined game: the hall, seats and screen are Top1Server's (world.js); this module only adds the function.
//
// Room plug-in contract: export default { id, setup(ctx) -> instance }
//   instance: { setInside(bool), update(dt), interact(p)?, camera: {pos, look} | null, silencesMusic }
import * as THREE from 'three';
import { parseYouTubeId, createPlayer, probeVideo } from '../youtube.js';
import { el, fmtTime } from '../util.js';
import { BAN_DO } from '../logic.js';

const MAX_PER_PLAYER = 2;
const MAX_SECONDS = 3 * 3600; // the server decides; this is only for a quick message

export default {
  id: 'xem-phim',

  setup(ctx) {
    const { scene, room, net, state, ui, world, css3d } = ctx;
    const T = (k) => `${room.id}.${k}`;
    const mh = BAN_DO.vat.find((v) => v.id === 'man-hinh');   // the screen: centre x, width `rong`, height `cao` (16:9), on the south wall
    const W = mh.rong; const H = (W * 9) / 16; const Y = 1.3 + mh.cao / 2; const Z = 51.44; // the video fills the whole screen

    // ---- the screen: a YouTube player placed in the 3D scene, behind the canvas, seen through a "hole" ----
    const hole = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshBasicMaterial({ color: 0, opacity: 0, transparent: true, blending: THREE.NoBlending, side: THREE.DoubleSide }));
    hole.position.set(mh.x, Y, Z); hole.rotation.y = Math.PI; hole.visible = false;
    scene.add(hole);
    const anchor = new THREE.Object3D(); anchor.position.set(mh.x, Y, Z); anchor.rotation.y = Math.PI; anchor.scale.setScalar(W / 960); anchor.visible = false;
    scene.add(anchor);
    const screenEl = el('div', { class: 'screen3d' }); const ytHost = el('div'); screenEl.append(ytHost);
    css3d.add(screenEl, anchor);

    // ---- panel + pop-up ----
    const panel = ui.createPanel('cinema', '🎬 Cinema queue', { hidden: true, contextual: true, side: 'left' });
    const link = el('input', { type: 'text', placeholder: 'Paste a YouTube link', autocomplete: 'off' });
    const addBtn = el('button', { text: 'Add' });
    const count = el('span', { class: 'meta' });
    const list = el('ul', { class: 'queue' });
    const popBtn = el('button', { class: 'wide ghost', text: 'Open larger (pop-up)' });
    panel.body.append(el('div', { class: 'meta', text: 'Everyone in the room watches together. Max 2 videos each, under 3 hours. Inside you hear the video only.' }),
      el('div', { class: 'row' }, link, addBtn), el('div', { class: 'row between' }, el('span', { class: 'meta', text: 'Sit down while a film plays to earn Xu' }), count), list, popBtn);
    const popup = el('div', { id: 'cinema-popup' }, el('div', { class: 'popup-box' }, el('button', { id: 'cinema-popup-close', text: '✕', 'aria-label': 'Close' }), el('div', { id: 'cinema-popup-player' })));
    document.body.append(popup);

    let snap = { now: null, waiting: [], startedAt: null };
    let mainPlayer = null; let popupPlayer = null; let starting = false; let popupOpen = false; let inside = false; let loadedId = null;
    const position = () => Math.max(0, (net.serverNow() - snap.startedAt) / 1000);

    function applySound() {
      try {
        if (mainPlayer) (inside && !popupOpen ? mainPlayer.unMute() : mainPlayer.mute());
        if (popupPlayer) (inside && popupOpen ? popupPlayer.unMute() : popupPlayer.mute());
      } catch { /* player not ready yet */ }
    }
    function syncVideo() {
      const cur = snap.now; const show = inside && !!cur;
      hole.visible = show; anchor.visible = show;                       // otherwise Top1's "Queue is empty" picture shows
      state.cinemaPlaying = !!cur;
      if (!mainPlayer) return;
      if (!show) { if (loadedId !== null) mainPlayer.stopVideo(); loadedId = null; if (popupOpen && !cur) closePopup(); }
      else if (loadedId !== cur.id) {
        loadedId = cur.id;
        mainPlayer.loadVideoById({ videoId: cur.vid, startSeconds: position() });
        if (popupOpen) popupPlayer.loadVideoById({ videoId: cur.vid, startSeconds: position() });
      }
      applySound();
    }
    async function startPlayers() {
      if (mainPlayer || starting) return;
      starting = true;
      try {
        mainPlayer = await createPlayer(ytHost, { width: 960, height: 540, onError: () => { ui.toast('That video could not be played, skipping it.', 'error'); if (snap.now) net.send({ type: T('error'), id: snap.now.id }); } });
        popupPlayer = await createPlayer(document.getElementById('cinema-popup-player'), { width: 960, height: 540 });
        syncVideo();
      } catch (e) { ui.toast(e.message, 'error'); starting = false; }
    }
    function openPopup() {
      if (!snap.now || !inside || !popupPlayer) return;
      popupOpen = true; popup.classList.add('open');
      popupPlayer.loadVideoById({ videoId: snap.now.vid, startSeconds: position() }); applySound();
    }
    function closePopup() { if (!popupOpen) return; popupOpen = false; popup.classList.remove('open'); popupPlayer?.stopVideo(); applySound(); }
    popBtn.addEventListener('click', () => (popupOpen ? closePopup() : openPopup()));
    popup.querySelector('#cinema-popup-close').addEventListener('click', closePopup);

    function render() {
      list.replaceChildren();
      const rows = snap.now ? [{ item: snap.now, playing: true }, ...snap.waiting.map((item) => ({ item }))] : [];
      if (!rows.length) list.append(el('li', { class: 'empty', text: 'Nothing queued' }));
      for (const { item, playing } of rows) {
        const li = el('li', { class: playing ? 'playing' : '' }, el('div', { class: 'info' }, el('span', { class: 'title', text: (playing ? '▶ ' : '') + item.title }), el('span', { class: 'meta', text: `${item.ownerName} · ${fmtTime(item.dur)}` })));
        if (item.owner === state.me || state.isAdmin) li.append(el('button', { class: 'rm', title: 'Remove', text: '✕', onclick: () => net.send({ type: T('remove'), id: item.id }) }));
        list.append(li);
      }
      count.textContent = `${rows.filter((r) => r.item.owner === state.me).length}/${MAX_PER_PLAYER} yours`;
      popBtn.disabled = !snap.now;
    }
    async function addFromInput() {
      const id = parseYouTubeId(link.value);
      if (!id) return ui.toast("That doesn't look like a YouTube link.", 'error');
      addBtn.disabled = true; addBtn.textContent = 'Checking…';
      try {
        const v = await probeVideo(id);
        if (v.duration >= MAX_SECONDS) ui.toast('Videos must be under 3 hours.', 'error');
        else { net.send({ type: T('add'), vid: v.videoId, title: v.title, dur: v.duration }); link.value = ''; }
      } catch (e) { ui.toast(e.message, 'error'); } finally { addBtn.disabled = false; addBtn.textContent = 'Add'; }
    }
    addBtn.addEventListener('click', addFromInput);
    link.addEventListener('keydown', (e) => { if (e.key === 'Enter') addFromInput(); e.stopPropagation(); });

    net.on(T('state'), (m) => { snap = m; if (!(snap.now && loadedId === snap.now.id)) loadedId = snap.now ? null : loadedId; render(); syncVideo(); });
    render();

    return {
      setInside(v) {
        inside = v; panel.root.hidden = !v;
        if (v) { startPlayers(); loadedId = null; } else { closePopup(); state.cinemaPlaying = false; }
        syncVideo();
      },
      update() {},
      // campus-export's fixed diagonal corner camera: from above a door-side corner, looking across the seats to the screen.
      // It stands on the west corner so that the screen is on the right of the view, clear of the queue panel on the left.
      camera: { pos: new THREE.Vector3(room.rect.x1 - 3, 17, room.rect.z1 - 6), look: new THREE.Vector3(mh.x + 1, 1.5, 40) },
      silencesMusic: true, // inside the cinema you hear the video, not the shared music
    };
  },
};
