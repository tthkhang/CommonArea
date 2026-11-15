// Speaks every line of narration.json with the Mac's built-in voice into voice/<key>.wav and notes each clip's length
// in voice/durations.json (record.mjs needs those lengths to time the scenes).   node voice.mjs [voice name] [words per minute]
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readWav } from './wav.mjs';
const here = fileURLToPath(new URL('.', import.meta.url)); const [VOICE = 'Samantha', RATE = '172'] = process.argv.slice(2);
const lines = JSON.parse(fs.readFileSync(here + 'narration.json', 'utf8')); fs.mkdirSync(here + 'voice', { recursive: true });
const out = {}; let total = 0;
for (const k in lines) { const f = `${here}voice/${k}.wav`; execFileSync('say', ['-v', VOICE, '-r', RATE, '-o', f, '--data-format=LEI16@44100', lines[k]]); out[k] = +readWav(f).seconds.toFixed(2); total += out[k]; }
fs.writeFileSync(here + 'voice/durations.json', JSON.stringify(out));
console.log(`${Object.keys(out).length} lines, ${total.toFixed(1)} s of speech (voice ${VOICE})`);
