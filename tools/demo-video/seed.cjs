// Makes data/profiles.json for the demo server: the player and a few classmates with Xu and grown gardens.
//   node seed.cjs <combined-game folder> <data dir>
const fs = require('fs'); const path = require('path');
const [GAME, DATA] = process.argv.slice(2);
(async () => {
  const L = await import(path.join(GAME, 'public/js/logic.js'));
  const Room = require(path.join(GAME, 'public/shared/room.js')); Room.setMap(L);
  const saved = {}; const now = Date.now();
  const store = { load: (t) => (saved[t] ? JSON.parse(JSON.stringify(saved[t])) : null), save: (t, p) => { saved[t] = JSON.parse(JSON.stringify(p)); }, all: () => Object.entries(saved), loadMeta: () => null, saveMeta: () => {} };
  const room = new Room({ cap: 50, now: () => now, send: () => {}, store });
  const people = require('./people.json');
  for (const [i, q] of people.entries()) {
    room.join('p' + i, { name: q.name, token: q.token, look: q.look });
    const p = room.players.get('p' + i);
    p.pr.xu = q.xu;
    if (q.garden) { const g = JSON.parse(JSON.stringify(room.findGarden(q.garden).garden)); Object.assign(p.pr.garden, g); }
    if (q.inv) for (const k in q.inv) p.pr.inv[k] = q.inv[k];
    p.pr.upkeepDay = undefined;
    room.saveProfile(p); room.leave('p' + i);
  }
  fs.mkdirSync(DATA, { recursive: true });
  fs.writeFileSync(path.join(DATA, 'profiles.json'), JSON.stringify(saved));
  console.log('seeded', Object.keys(saved).length, 'profiles;', people.map((q) => q.name + ' ' + Room.gidOf(q.token)).join(', '));
  const k = Room.fixProfile(saved[people[0].token]); console.log('first:', k.xu, 'Xu, plots', Object.keys(k.garden.plots).length, 'trees', Object.keys(k.garden.trees).length, 'fish', k.garden.fish.length, 'inv', JSON.stringify(k.inv).slice(0, 120));
})();
