// Minimal WAV reading / writing (16-bit PCM), for mixing the demo video's sound.
import fs from 'node:fs';
export function readWav(file) {
  const b = fs.readFileSync(file); let p = 12; let fmt = null; let data = null;
  while (p + 8 <= b.length) { const id = b.toString('latin1', p, p + 4); const size = b.readUInt32LE(p + 4);
    if (id === 'fmt ') fmt = { ch: b.readUInt16LE(p + 10), rate: b.readUInt32LE(p + 12), bits: b.readUInt16LE(p + 22) };
    if (id === 'data') { data = b.subarray(p + 8, Math.min(b.length, p + 8 + size)); break; }
    p += 8 + size + (size & 1); }
  if (!fmt || !data || fmt.bits !== 16) throw new Error('unsupported WAV: ' + file);
  const n = Math.floor(data.length / 2 / fmt.ch); const out = Array.from({ length: fmt.ch }, () => new Float32Array(n));
  for (let i = 0; i < n; i++) for (let c = 0; c < fmt.ch; c++) out[c][i] = data.readInt16LE((i * fmt.ch + c) * 2) / 32768;
  return { rate: fmt.rate, ch: out, seconds: n / fmt.rate };
}
export function writeWav(file, left, right, rate) {
  const n = left.length; const b = Buffer.alloc(44 + n * 4);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 4, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(2, 22); b.writeUInt32LE(rate, 24);
  b.writeUInt32LE(rate * 4, 28); b.writeUInt16LE(4, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 4, 40);
  const cl = (v) => Math.max(-32768, Math.min(32767, Math.round(v * 32767)));
  for (let i = 0; i < n; i++) { b.writeInt16LE(cl(left[i]), 44 + i * 4); b.writeInt16LE(cl(right[i]), 46 + i * 4); }
  fs.writeFileSync(file, b);
}
