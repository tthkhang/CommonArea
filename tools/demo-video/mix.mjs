// Mixes the demo video's sound: the spoken walkthrough, the game's own sounds (captured while recording), soft clicks and
// footsteps at the moments they happened, and a quiet music bed.   node mix.mjs <frames dir> <voice dir> <out.wav>
import fs from 'node:fs';
import { readWav, writeWav } from './wav.mjs';
const [FR, VOICE, OUT] = process.argv.slice(2);
const T = JSON.parse(fs.readFileSync(FR + '/timeline.json', 'utf8'));
const RATE = 44100; const DUR = (T.videoEnd - T.videoT0) / 1000 + 0.6; const N = Math.ceil(DUR * RATE);
const L = new Float32Array(N), R = new Float32Array(N);
const at = (ms) => (ms - T.videoT0) / 1000;                       // clock time -> seconds into the video
const add = (buf, t, gainL, gainR = gainL, src = null) => { const o = Math.round(t * RATE); for (let i = 0; i < buf.length; i++) { const k = o + i; if (k < 0 || k >= N) continue; L[k] += buf[i] * gainL; R[k] += (src ? src[i] : buf[i]) * gainR; } };
const peak = (a) => { let p = 0; for (let i = 0; i < a.length; i++) { const v = Math.abs(a[i]); if (v > p) p = v; } return p; };
const report = [];

// ---- quiet music bed first (so that everything else sits on top): slow warm chords + a soft bell every beat
const note = (n) => 440 * Math.pow(2, (n - 69) / 12);
const CHORDS = [[48, 55, 64, 71], [45, 52, 60, 67], [41, 48, 57, 64], [43, 50, 59, 62]]; // Cmaj7, Am7, Fmaj7, G (MIDI notes)
const BAR = 6.4; const music = new Float32Array(N);
for (let i = 0; i < N; i++) {
  const t = i / RATE; const bar = Math.floor(t / BAR); const x = (t % BAR) / BAR;
  const env = Math.min(1, x / 0.22, (1 - x) / 0.22) ; // each chord swells in and out, overlapping the next
  let v = 0; for (const n of CHORDS[bar % 4]) { const f = note(n); v += Math.sin(2 * Math.PI * f * t) * 0.5 + Math.sin(2 * Math.PI * f * 2 * t + 0.3) * 0.12 + Math.sin(2 * Math.PI * (f * 1.003) * t) * 0.3; }
  music[i] = v * 0.25 * (0.35 + 0.65 * env);
}
const BEAT = BAR / 4;
for (let b = 0; b * BEAT < DUR; b++) { // bell: one chord note, two octaves up, with a long soft tail
  const t0 = b * BEAT; const ch = CHORDS[Math.floor(t0 / BAR) % 4]; const f = note(ch[[0, 2, 1, 3][b % 4]] + 24); const len = Math.floor(1.6 * RATE); const o = Math.round(t0 * RATE);
  for (let i = 0; i < len && o + i < N; i++) { const t = i / RATE; music[o + i] += (Math.sin(2 * Math.PI * f * t) + 0.25 * Math.sin(2 * Math.PI * f * 2 * t)) * Math.exp(-t * 3.2) * 0.55 * Math.min(1, t / 0.004); }
}

// ---- the spoken walkthrough
const voiceMask = new Float32Array(N); // 1 while someone speaks: the music steps back there
for (const v of T.voice) { const w = readWav(`${VOICE}/${v.key}.wav`); const t = at(v.t); const g = 0.85 / Math.max(0.2, peak(w.ch[0]));
  const src = w.rate === RATE ? w.ch[0] : (() => { const n = Math.floor(w.ch[0].length * RATE / w.rate); const o = new Float32Array(n); for (let i = 0; i < n; i++) { const p = i * w.rate / RATE; const a = Math.floor(p); o[i] = w.ch[0][a] + ((w.ch[0][a + 1] ?? w.ch[0][a]) - w.ch[0][a]) * (p - a); } return o; })();
  add(src, t, g); const a = Math.max(0, Math.round((t - 0.25) * RATE)), b = Math.min(N, Math.round((t + src.length / RATE + 0.35) * RATE)); for (let i = a; i < b; i++) voiceMask[i] = 1;
  report.push(`voice ${v.key.padEnd(9)} ${t.toFixed(1).padStart(6)} s  for ${(src.length / RATE).toFixed(1)} s`); }
// smooth the mask (0.4 s) and lay the music under everything: full level 0.11, under speech 0.045, fading in and out at the ends
{ let m = 0; const k = 1 / (0.4 * RATE); for (let i = 0; i < N; i++) { m += (voiceMask[i] - m) * k * 2.5; const t = i / RATE; const edge = Math.min(1, t / 1.5, (DUR - t) / 2.5); const g = (0.11 - 0.065 * Math.min(1, m)) * Math.max(0, edge); L[i] += music[i] * g; R[i] += music[i] * g; } }

// ---- the game's own sounds
for (const g of T.game || []) { const b = fs.readFileSync(g.file); const n = Math.floor(b.length / 4); const gl = new Float32Array(n), gr = new Float32Array(n);
  for (let i = 0; i < n; i++) { gl[i] = b.readInt16LE(i * 4) / 32768; gr[i] = b.readInt16LE(i * 4 + 2) / 32768; }
  const pk = Math.max(peak(gl), peak(gr)); let active = 0; for (let i = 0; i < n; i += 100) if (Math.abs(gl[i]) > 0.002) active++;
  const m = Math.floor(n * RATE / g.rate); const rl = new Float32Array(m), rr = new Float32Array(m);
  for (let i = 0; i < m; i++) { const p = i * g.rate / RATE; const a = Math.floor(p), f = p - a; rl[i] = gl[a] + ((gl[a + 1] ?? gl[a]) - gl[a]) * f; rr[i] = gr[a] + ((gr[a + 1] ?? gr[a]) - gr[a]) * f; }
  const gain = pk > 0.001 ? Math.min(6, 0.4 / pk) : 0; add(rl, at(g.t0), gain, gain, rr);
  report.push(`game sound: ${(n / g.rate).toFixed(1)} s from ${at(g.t0).toFixed(1)} s, peak ${pk.toFixed(3)}, audible in ${(active * 100 / (n / 100)).toFixed(0)}% of it, gain x${gain.toFixed(1)}`); }

// ---- clicks (a short soft tick) and footsteps (a low tap, two alternating pitches, while the player walks)
const tick = new Float32Array(Math.floor(0.03 * RATE)); for (let i = 0; i < tick.length; i++) { const t = i / RATE; tick[i] = (Math.sin(2 * Math.PI * 1700 * t) * 0.7 + Math.sin(2 * Math.PI * 2600 * t) * 0.3) * Math.exp(-t * 170); }
for (const c of T.clicks) add(tick, at(c), 0.17);
let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
const step = (f) => { const b = new Float32Array(Math.floor(0.09 * RATE)); let lp = 0; for (let i = 0; i < b.length; i++) { const t = i / RATE; lp += (rnd() - lp) * 0.12; b[i] = (Math.sin(2 * Math.PI * f * t * (1 - t * 2.5)) * 0.8 + lp * 0.9) * Math.exp(-t * 55); } return b; };
const steps = [step(150), step(125)]; let walking = null; let count = 0; const W = [...(T.walk || [])]; W.push([T.videoEnd, false]);
for (const [ms, mv] of W) { if (mv && walking == null) walking = ms; else if (!mv && walking != null) { for (let t = walking + 120; t < ms; t += 310) { add(steps[count % 2], at(t), count % 2 ? 0.085 : 0.105, count % 2 ? 0.105 : 0.085); count++; } walking = null; } }
report.push(`clicks ${T.clicks.length}, footsteps ${count}`);

// ---- gentle limiter, then write
let pk = Math.max(peak(L), peak(R)); const g = pk > 0.92 ? 0.92 / pk : 1; for (let i = 0; i < N; i++) { L[i] = Math.tanh(L[i] * g * 1.05) / 1.05 * 1.02; R[i] = Math.tanh(R[i] * g * 1.05) / 1.05 * 1.02; }
writeWav(OUT, L, R, RATE);
const rms = []; for (let s = 0; s < DUR; s += 10) { let e = 0, c = 0; for (let i = Math.floor(s * RATE); i < Math.min(N, Math.floor((s + 10) * RATE)); i++) { e += L[i] * L[i]; c++; } rms.push((Math.sqrt(e / c) * 100).toFixed(1)); }
console.log(report.join('\n')); console.log(`mix: ${DUR.toFixed(1)} s, peak before limiting ${pk.toFixed(2)}, loudness per 10 s (RMS x100): ${rms.join(' ')}`);
