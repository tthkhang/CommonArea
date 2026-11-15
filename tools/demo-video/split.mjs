// Cuts one narration recording (all lines read in order) into one clip per line of narration.json, by finding the pauses
// between lines.   node split.mjs <full.wav> <out dir>
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { readWav, writeWav } from './wav.mjs';
const [FULL, OUT] = process.argv.slice(2); const here = fileURLToPath(new URL('.', import.meta.url));
const lines = JSON.parse(fs.readFileSync(here + 'narration.json', 'utf8')); const keys = Object.keys(lines);
const w = readWav(FULL); const x = w.ch[0]; const R = w.rate; const WIN = Math.floor(R * 0.01);
const env = []; for (let i = 0; i + WIN <= x.length; i += WIN) { let e = 0; for (let j = 0; j < WIN; j++) e += x[i + j] * x[i + j]; env.push(Math.sqrt(e / WIN)); }
const top = [...env].sort((a, b) => b - a)[Math.floor(env.length * 0.05)]; const TH = top * 0.045;
const gaps = []; let s = -1; for (let i = 0; i <= env.length; i++) { const quiet = i < env.length && env[i] < TH; if (quiet && s < 0) s = i; if (!quiet && s >= 0) { if ((i - s) * 0.01 >= 0.14 && s > 0 && i < env.length) gaps.push({ a: s * 0.01, b: i * 0.01, len: (i - s) * 0.01 }); s = -1; } }
let first = 0; while (first < env.length && env[first] < TH) first++; let last = env.length - 1; while (last > 0 && env[last] < TH) last--;
const T0 = first * 0.01, T1 = (last + 1) * 0.01; const chars = keys.map((k) => lines[k].length); const sum = chars.reduce((a, b) => a + b, 0);
const voiced = T1 - T0 - gaps.reduce((a, g) => a + g.len, 0) * 0.6; const expect = chars.map((c) => voiced * c / sum);
// choose the 13 pauses that best fit the lines' expected lengths (a longer pause is more likely to be a line break)
const N = keys.length, G = gaps.length; const INF = 1e18;
const cost = (from, to, i, gapLen) => { const d = to - from; const r = (d - expect[i]) / expect[i]; return r * r - 0.35 * gapLen; };
const best = Array.from({ length: N }, () => new Array(G + 1).fill(INF)); const prev = Array.from({ length: N }, () => new Array(G + 1).fill(-1));
for (let g = 0; g < G; g++) best[0][g] = cost(T0, gaps[g].a, 0, gaps[g].len);
for (let i = 1; i < N - 1; i++) for (let g = i; g < G; g++) for (let p = i - 1; p < g; p++) { if (best[i - 1][p] >= INF) continue; const c = best[i - 1][p] + cost(gaps[p].b, gaps[g].a, i, gaps[g].len); if (c < best[i][g]) { best[i][g] = c; prev[i][g] = p; } }
let end = -1, bc = INF; for (let p = N - 2; p < G; p++) { if (best[N - 2][p] >= INF) continue; const c = best[N - 2][p] + cost(gaps[p].b, T1, N - 1, 0); if (c < bc) { bc = c; end = p; } }
const cut = []; for (let i = N - 2, g = end; i >= 0; i--) { cut.unshift(g); g = prev[i][g]; }
fs.mkdirSync(OUT, { recursive: true }); const durations = {}; const report = [];
for (let i = 0; i < N; i++) {
  const a = i === 0 ? T0 : gaps[cut[i - 1]].b, b = i === N - 1 ? T1 : gaps[cut[i]].a; const A = Math.max(0, Math.floor((a - 0.04) * R)), B = Math.min(x.length, Math.ceil((b + 0.16) * R));
  const seg = Float32Array.from(x.subarray(A, B)); const f = Math.floor(0.012 * R); for (let j = 0; j < f; j++) { seg[j] *= j / f; seg[seg.length - 1 - j] *= j / f; }
  writeWav(`${OUT}/${keys[i]}.wav`, seg, seg, R); durations[keys[i]] = +(seg.length / R).toFixed(2);
  report.push(`${keys[i].padEnd(9)} ${a.toFixed(2).padStart(6)}–${b.toFixed(2).padStart(6)}  ${(b - a).toFixed(2)} s (expected ${expect[i].toFixed(2)})  ${i < N - 1 ? 'pause after: ' + gaps[cut[i]].len.toFixed(2) + ' s' : ''}`);
}
fs.writeFileSync(`${OUT}/durations.json`, JSON.stringify(durations));
const unused = gaps.filter((_, i) => !cut.includes(i)).sort((a, b) => b.len - a.len).slice(0, 4).map((g) => g.len.toFixed(2) + ' s at ' + g.a.toFixed(1));
console.log(report.join('\n')); console.log(`pauses found: ${G}; longest pauses NOT used as line breaks: ${unused.join(', ') || 'none'}`);
