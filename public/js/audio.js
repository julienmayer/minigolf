// Petits sons synthétisés en WebAudio (aucun fichier audio nécessaire).

let ctx = null;
let lastBounce = 0;

export function unlock() {
  if (!ctx) {
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return; }
  }
  if (ctx.state === 'suspended') ctx.resume();
}

function tone({ f0, f1 = f0, dur = 0.1, type = 'sine', vol = 0.2, at = 0 }) {
  if (!ctx || ctx.state !== 'running') return;
  const t = ctx.currentTime + at;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ctx.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise({ dur = 0.08, vol = 0.2, freq = 800, at = 0 }) {
  if (!ctx || ctx.state !== 'running') return;
  const t = ctx.currentTime + at;
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.value = vol;
  src.connect(f).connect(g).connect(ctx.destination);
  src.start(t);
}

export function click() { tone({ f0: 600, f1: 800, dur: 0.05, type: 'triangle', vol: 0.12 }); }

export function shoot(power) {
  noise({ dur: 0.07, vol: 0.1 + power * 0.25, freq: 500 });
  tone({ f0: 160, f1: 70, dur: 0.12, type: 'sine', vol: 0.15 + power * 0.2 });
}

export function bounce(impact) {
  const now = performance.now();
  if (now - lastBounce < 60) return;
  lastBounce = now;
  const v = Math.min(1, impact / 8);
  tone({ f0: 240 + v * 120, f1: 140, dur: 0.05, type: 'square', vol: 0.04 + v * 0.12 });
}

export function bumper() {
  tone({ f0: 380, f1: 620, dur: 0.12, type: 'square', vol: 0.16 });
}

export function holed() {
  tone({ f0: 500, f1: 180, dur: 0.18, type: 'sine', vol: 0.22 });
  tone({ f0: 660, dur: 0.1, type: 'triangle', vol: 0.18, at: 0.18 });
  tone({ f0: 880, dur: 0.14, type: 'triangle', vol: 0.18, at: 0.28 });
}

export function holedOther() {
  tone({ f0: 660, dur: 0.08, type: 'triangle', vol: 0.08 });
  tone({ f0: 880, dur: 0.1, type: 'triangle', vol: 0.08, at: 0.09 });
}

export function splash() {
  noise({ dur: 0.35, vol: 0.25, freq: 420 });
}

export function tickMax() {
  tone({ f0: 1000, dur: 0.05, type: 'square', vol: 0.1 });
}

export function fanfare() {
  const notes = [523, 659, 784, 1047];
  notes.forEach((f, i) => tone({ f0: f, dur: 0.22, type: 'triangle', vol: 0.18, at: i * 0.16 }));
  tone({ f0: 1319, dur: 0.5, type: 'triangle', vol: 0.16, at: 0.66 });
}
