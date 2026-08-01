import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, '..', 'public', 'sounds')

const SAMPLE_RATE = 44100

function writeWav(path, samples) {
  const data = Buffer.alloc(samples.length * 2)
  for (let i = 0; i < samples.length; i++) {
    data.writeInt16LE(Math.max(-1, Math.min(1, samples[i])) * 32767, i * 2)
  }
  const header = Buffer.alloc(44)
  header.write('RIFF', 0)
  header.writeUInt32LE(36 + data.length, 4)
  header.write('WAVE', 8)
  header.write('fmt ', 12)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20)
  header.writeUInt16LE(1, 22)
  header.writeUInt32LE(SAMPLE_RATE, 24)
  header.writeUInt32LE(SAMPLE_RATE * 2, 28)
  header.writeUInt16LE(2, 32)
  header.writeUInt16LE(16, 34)
  header.write('data', 36)
  header.writeUInt32LE(data.length, 40)
  writeFileSync(path, Buffer.concat([header, data]))
  console.log('wrote', path)
}

function click() {
  const n = Math.floor(SAMPLE_RATE * 0.06)
  const s = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE
    const env = Math.exp(-t * 90)
    s[i] = env * (Math.random() * 2 - 1) * 0.8
    s[i] += env * Math.sin(2 * Math.PI * 1800 * t) * 0.25
  }
  return s
}

function honk() {
  const dur = 0.38
  const n = Math.floor(SAMPLE_RATE * dur)
  const s = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE
    const p = t / dur
    const env = Math.sin(Math.PI * Math.min(p * 1.4, 1))
    const f1 = 392
    const f2 = 466
    const phase1 = (2 * Math.PI * f1 * t) % (2 * Math.PI)
    const phase2 = (2 * Math.PI * f2 * t) % (2 * Math.PI)
    s[i] = env * (Math.sin(phase1) * 0.5 + Math.sin(phase2) * 0.5)
  }
  return s
}

function whoosh() {
  const dur = 0.45
  const n = Math.floor(SAMPLE_RATE * dur)
  const s = new Float32Array(n)
  let phase = 0
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE
    const p = t / dur
    const env = Math.sin(Math.PI * p)
    const freq = 300 + 900 * p
    phase += (2 * Math.PI * freq) / SAMPLE_RATE
    s[i] = env * Math.sin(phase) * 0.55
    s[i] += env * (Math.random() * 2 - 1) * 0.12
  }
  return s
}

writeWav(join(OUT, 'click.wav'), click())
writeWav(join(OUT, 'whoosh.wav'), whoosh())
writeWav(join(OUT, 'honk.wav'), honk())
