# How the demo video was made

`docs/demo.mp4` was recorded by Claude Code, not by hand. These are the scripts it wrote, kept so the video can be made again after the game changes.

1. `seed.cjs` writes `profiles.json` for a throwaway server: the player and seven classmates (`people.json`) with Xu and grown gardens.
2. A local server runs on that data: `PORT=5184 ADMIN_PASSWORD=admin DATA_DIR=<folder> node server.mjs`.
3. `record.mjs` connects the classmates as scripted players (they sit at tables, chat, play Colour Cards, accept a friend request), opens the game in a hidden Chrome window through the DevTools protocol (`cdp.mjs`), plays the core flow with real mouse clicks and key presses, shows captions and a pointer, and saves every frame Chrome draws (about 60 a second).
4. `encode.swift` (compile with `swiftc -O`) turns the frames into an H.264 MP4 at 30 frames a second.
5. Sound. The lines in `narration.json` are spoken by the Mac's built-in voice (`say -v Samantha`) into `voice/<key>.wav`, with their lengths in `voice/durations.json`; `record.mjs` starts each line with its caption and never lets two overlap. While recording, a small hook copies everything the game plays through Web Audio, and notes every click and every stretch of walking. `mix.mjs` lays these on one track with a quiet generated music bed, `afconvert` makes it AAC, and `mux.swift` puts it on the video.

```bash
node seed.cjs /path/to/repo /tmp/demo/data
node voice.mjs                    # speaks narration.json into voice/
REC=1 node record.mjs /tmp        # frames go to /tmp/demo/frames
./encode /tmp/demo/frames/list.tsv silent.mp4 1280 720 30 1300000
node mix.mjs /tmp/demo/frames voice mix.wav && afconvert -f m4af -d aac -b 160000 mix.wav mix.m4a
./mux silent.mp4 mix.m4a demo.mp4
```

Needs macOS with Google Chrome, Node.js 22 or newer and the Xcode command line tools. Without `REC=1` the script plays the flow and only saves a screenshot per scene, which is a quick end-to-end check of the whole game.
