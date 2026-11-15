# How the demo video was made

`docs/demo.mp4` was recorded by Claude Code, not by hand. These are the scripts it wrote, kept so the video can be made again after the game changes.

1. `seed.cjs` writes `profiles.json` for a throwaway server: the player and seven classmates (`people.json`) with Xu and grown gardens.
2. A local server runs on that data: `PORT=5184 ADMIN_PASSWORD=admin DATA_DIR=<folder> node server.mjs`.
3. `record.mjs` connects the classmates as scripted players (they sit at tables, chat, play Colour Cards, accept a friend request), opens the game in a hidden Chrome window through the DevTools protocol (`cdp.mjs`), plays the core flow with real mouse clicks and key presses, shows captions and a pointer, and saves every frame Chrome draws (about 60 a second).
4. `encode.swift` (compile with `swiftc -O`) turns the frames into an H.264 MP4 at 30 frames a second.

```bash
node seed.cjs /path/to/repo /tmp/demo/data
REC=1 node record.mjs /tmp        # frames go to /tmp/demo/frames
./encode /tmp/demo/frames/list.tsv demo.mp4 1280 720 30 1300000
```

Needs macOS with Google Chrome, Node.js 22 or newer and the Xcode command line tools. Without `REC=1` the script plays the flow and only saves a screenshot per scene, which is a quick end-to-end check of the whole game.
