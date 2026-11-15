# Phone layout audit

Opens the game at a phone size in a hidden Chrome window, goes through 12 states (plaza, menu open, bar open, seated, next to a chair, garden, seed picker…), lists every piece of the interface on screen and reports any two that overlap or leave the screen. It also taps the yellow action button with a real touch and checks that the action happened. A screenshot of each state is saved.

```bash
PORT=5183 ADMIN_PASSWORD=admin DATA_DIR=/tmp/audit-data node server.mjs &
node tools/phone-audit/audit.mjs /tmp/audit-out 390 800      # output folder, width, height
```

Needs macOS with Google Chrome and Node.js 22 or newer.

## Fishing on a phone

`fish.mjs` plays the fishing mini-game with real touches at a phone size: walks to a lake chair, taps the sit hint, the Stand up button and the stick, casts, waits for the bite, strikes, and reels with taps until the fish is caught or lost, printing what is on screen at each step and any overlapping pieces.

```bash
node tools/phone-audit/fish.mjs /tmp/audit-out 390 800
```
