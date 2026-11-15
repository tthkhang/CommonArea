# Handoff — continuing the combined game

Read this first, then `docs/DEVELOPER.md` (how to run, controls, where things are, what was checked). `README.md` is the product overview; `TRACKING.md` is the tracking plan.

## What this is

One browser game built on 2026-11-14/15 from the team's projects and specs:

- **Top1Server** → graphics, map, camera, HUD look (`public/js/logic.js`, `world.js`, `main.js`)
- **campus-export** → character customizer, emotes, closed rooms + room plug-ins, cinema (`avatar.js`, `customize.js`, `rooms/`, `shared/roomplugins.js`)
- **campus-game-v4 → v5** → Xu, shop, farm island, fishing, market, forest with playground and café (`shared/room.js`, `catalog.js`, `features.js`, `world2.js`, `farm3d.js`)
- **noi-dung-chi-tiet-2-phong.md** → the Astrology Room (`rooms/astrology.js`, `astro/`, `text/`) and the Game Room (`shared/games.js`, `rooms/games.js`, `games/`)

## Run

```bash
python3 serve.py                          # solo mode, no install (bots, saved in the browser)
ADMIN_PASSWORD=admin node server.mjs      # multiplayer, needs Node.js 18+
```

Add `?test` to the address in solo mode (or `TEST_MODE=1` for the server) for 5000 Xu and 10x faster plants.

## How it fits together

- **One rulebook, two places.** `public/shared/*.js` runs on the Node server and, when no server answers, inside the browser (`net.js` falls back to solo mode and starts bots). Anything about Xu, items, seats, cards, dice or roles is decided there, never in the client.
- **The map is Top1's.** `logic.js` owns rooms, walls, seats, path finding. `Room.setMap(logic)` builds the rules' world from it. The forest keeps v4/v5 coordinates, shifted by `LECH_RUNG` so it starts behind the east fence; the farm island is at x ≈ -400.
- **Rooms are closed.** `world.js` builds a shell for every room and hides the inside until you walk in. The server sends positions only to players in the same view group (`viewKey` in `room.js`).
- **v4/v5 code is hosted, not rewritten.** `features.js`, `world2.js` and `farm3d.js` get a `ctx` from `main.js`; `v4kit.js` re-implements v4's drawing helpers in Top1's toon + outline style.
- **Game Room.** `shared/games.js` has three rule engines as pure functions on plain-JSON states (`Ludo`, `Cards`, `Werewolf`) and the table plug-in (`makeGameRoom`): seats → slots, lobby, host, computer players, 20-second clock, spectators, chat channels, results, saved games. `room.js` calls its `canSit / onSit / onStand / onTableChat`. It sends each player a **view** (`tro-choi.state`) with only what they may know, and everyone in the room a summary (`tro-choi.tables`). The client (`rooms/games.js`) draws the table card, lobby, chat and results and mounts one screen per game (`games/ludo.js`, `cards.js`, `werewolf.js`); a screen only renders views and sends clicks back (`tro-choi.move`). Colour Match is different: its rules (`games/match3.js`) run in the browser and the room only stores progress (`tro-choi.matchSave / matchDone`).
- **Astrology Room.** `astro/` is pure maths (calendar, numerology, Tử Vi, western chart, places, the birth form's checks). `astro/report.js` turns a birth record into the reading as HTML strings, the same for the board and the downloaded file. `text/*.js` holds the passages, keyed by number / star / sign. The server half keeps one birth record per player name and has `server.mjs` add a CSV line per reading.
- **Friends.** `room.js` (`friendAdd / friendAnswer / friendRemove / friends`) keeps `profile.friends` (garden id → name) on both sides; requests live in memory for two minutes. A garden id is `gidOf(token)`, so a friend's garden is found even when they are offline (`tokenOf`, `findGarden`). The client part is in `features.js` (player-card button, Friends panel).
- **Tracking.** The rules call `this.ev(player, 'event', {...})` when something is accepted; `server.mjs` hands the events to `tracking.mjs` (memory + `data/events.jsonl`). `/stats.html` shows the numbers after the admin password. Events carry no names or text. The plan is `TRACKING.md`; a test fails if it and the code disagree.
- **Android app.** `android/` is a one-screen WebView app that opens the live game and falls back to the packed copy of `public/` when offline. `bash android/build.sh` builds it without Gradle; the signing key in `android/keystore/` is not in Git.
- Identifiers from Top1 are Vietnamese (`dungTheGioi`, `buocDi`, `PHONG`…); all player-facing text is English.

## Where to add things

| You want to… | Go to |
|---|---|
| give a room its own function | client: copy `public/js/rooms/template.js`, register in `rooms/index.js`; server: add a class to `REGISTRY` in `public/shared/roomplugins.js` |
| track a new event | `this.ev(...)` in the rule, then `EVENTS` in `tracking.mjs` and a row in `TRACKING.md` |
| add a message or rule | `public/shared/room.js` → `Room.prototype.handle`, then handle the reply in `main.js` (`ganMang`) or `features.js` (`onMessage`), and add a check to `tests/rules.test.mjs` |
| change a game's rule or a computer player | `public/shared/games.js` (`Ludo`, `Cards`, `Werewolf`, each with a `bot`) + a check in `tests/games.test.mjs`; timings are `TURN_MS` and `WW_TIME` at the top |
| change Colour Match levels | `LEVELS` in `public/js/games/match3.js` (then `node tests/match.test.mjs` proves every level can still be won) |
| edit a rule book | `BOOKS` in `public/js/games/rules.js` |
| edit a reading passage | `public/js/text/*.js`; look at them all on `/readings.html`; `node tests/text/all.check.mjs` checks keys and lengths |
| add a birth place | `public/js/astro/places.js` |
| change the bad-word list | `BAD_WORDS` in `public/shared/games.js` |
| change prices, crops, fish, animals, furniture, food | `public/shared/catalog.js` |
| add quiz questions | `.md` files with `<!-- quiz -->` blocks in `wiki/` |
| change the map or furniture | `logic.js` (positions, collisions) + `world.js` (drawing) |
| change the character or its options | `avatar.js`, `customize.js`; also `LOOK_*` in `room.js` so the server accepts the new options |
| restyle the HUD or the game screens | `public/style.css` (new parts) and the `<style>` block in `index.html` (Top1's) |

## Before you share a change

```bash
node tests/rules.test.mjs            # 113 rule checks
node tests/games.test.mjs            # 165 Game Room checks
node tests/match.test.mjs            # 34 Colour Match checks
node tests/astro.test.mjs && node tests/reading.test.mjs && node tests/text/all.check.mjs
node --test tests/F*.test.js         # 55 map checks
node tests/tracking.test.mjs         # 25 tracking checks
node tests/multiplayer-smoke.mjs 5180   # with `PORT=5180 ADMIN_PASSWORD=admin node server.mjs` running (Node 22+)
```

## Decisions already made (do not undo without asking Khang)

Node.js server · Top1's rooms (without the Garden Room, removed at Khang's request on 2026-11-15: the Quiet Forest stands at the plaza's east gate instead) plus the forest + private island · closed rooms like campus-export · English interface · Game Room with shared tables as in the spec plus solo practice with computer players · reading texts in English at the spec's length.
Smaller choices and the reasons are in `docs/DEVELOPER.md` → "Decisions".

## Not done yet

- **Real people.** Shared tables were tested with one browser plus scripted players on the real server (a Colour Cards game, a six-player Werewolf game with shortened clocks, watching), not by several people on different computers. Werewolf especially needs a real evening with 6+ players.
- **Ludo is long with four players** (the spec says 20–30 minutes; the folk rules with kicking and exact home numbers take about 2,000 rolls between computer players). The host can end a game early; a rule change (safe cells, fewer horses) would need the PO's say.
- **Werewolf computer players** exist only for solo practice and play simply (they follow accusations and the leading vote).
- **Bad-word filter** is a short list for the game tables only; the plaza chat is unfiltered. No kick / mute tools.
- **Xu table from the PO** (spec, round 6) has not arrived: a win pays the old 15 Xu.
- **Readings** were written with the AI and proof-read by Nhật; the Tử Vi chart was not compared with a professional program.
- Not tried: a real phone (only an emulated 375 px screen), market trades between real players, many players at once.
- Garden decorations are placed in front of the character, not dragged.

## Working together

Put this folder in a shared Git repository (GitHub, private), one branch per feature. `data/` holds saved player profiles and the readings file and should not be committed.

## Prompt for an AI assistant

```
You are continuing the game in this folder. Do not rewrite it or change the engine.
1) Read HANDOFF.md and docs/DEVELOPER.md, then the files named for the area you will touch.
2) Rules about Xu, items, seats, cards, dice and roles go in public/shared/ (room.js, roomplugins.js, games.js); numbers go in catalog.js.
3) Graphics follow Top1's style: toon material + ink outline (world.js helpers, v4kit.js). Player-facing text is English.
4) Keep the decisions in HANDOFF.md. If the request conflicts with them or with the source projects, ask first.
5) Add a check to the matching test file for every new rule and run the tests listed in HANDOFF.md.
Task for this session: [write it here]
```
