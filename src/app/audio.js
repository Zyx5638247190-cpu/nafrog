// 极简 WebAudio 音效合成（不依赖任何音频文件）

let ctx = null;
let master = null;
let enabled = true;
let noiseBuf = null;

function ensure() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.5;
  master.connect(ctx.destination);
  noiseBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.5), ctx.sampleRate);
  const data = noiseBuf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return ctx;
}

export function unlock() {
  const c = ensure();
  if (c && c.state === 'suspended') c.resume();
}

export function setEnabled(on) {
  enabled = on;
  if (master) master.gain.value = on ? 0.5 : 0;
}

export function isEnabled() {
  return enabled;
}

function tone({ type = 'sine', from = 600, to = 600, dur = 0.12, gain = 0.06, delay = 0 }) {
  const c = ensure();
  if (!c) return;
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, t0);
  if (to !== from) osc.frequency.exponentialRampToValueAtTime(Math.max(30, to), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.03);
}

function noise({ dur = 0.12, gain = 0.08, freq = 900, q = 1, delay = 0 }) {
  const c = ensure();
  if (!c) return;
  const t0 = c.currentTime + delay;
  const src = c.createBufferSource();
  src.buffer = noiseBuf;
  const filter = c.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = freq;
  filter.Q.value = q;
  const g = c.createGain();
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filter).connect(g).connect(master);
  src.start(t0);
  src.stop(t0 + dur + 0.02);
}

export function sfx(name) {
  if (!enabled) return;
  switch (name) {
    case 'click':
      tone({ type: 'sine', from: 1100, to: 1500, dur: 0.05, gain: 0.04 });
      break;
    case 'select':
      tone({ type: 'triangle', from: 520, to: 780, dur: 0.08, gain: 0.05 });
      break;
    case 'plant':
      tone({ type: 'triangle', from: 260, to: 620, dur: 0.14, gain: 0.07 });
      noise({ dur: 0.1, gain: 0.04, freq: 500 });
      break;
    case 'merge':
      [0, 0.07, 0.14].forEach((d, i) =>
        tone({ type: 'triangle', from: [620, 830, 1100][i], to: [830, 1100, 1480][i], dur: 0.12, gain: 0.06, delay: d }),
      );
      tone({ type: 'sine', from: 1560, to: 2200, dur: 0.16, gain: 0.04, delay: 0.16 });
      break;
    case 'ultimate':
      tone({ type: 'sine', from: 180, to: 900, dur: 0.5, gain: 0.11 });
      noise({ dur: 0.6, gain: 0.1, freq: 700, q: 0.7 });
      [0.08, 0.2, 0.34].forEach((d, i) =>
        tone({ type: 'triangle', from: [700, 980, 1320][i], to: [1200, 1500, 1900][i], dur: 0.24, gain: 0.05, delay: d }),
      );
      break;
    case 'freeze':
      tone({ type: 'sine', from: 2400, to: 900, dur: 0.26, gain: 0.045 });
      noise({ dur: 0.22, gain: 0.045, freq: 3200, q: 1.4 });
      break;
    case 'grow':
      tone({ type: 'sawtooth', from: 130, to: 340, dur: 0.3, gain: 0.06 });
      noise({ dur: 0.24, gain: 0.05, freq: 260, q: 0.9 });
      break;
    case 'shoot':
      tone({ type: 'square', from: 760, to: 380, dur: 0.07, gain: 0.028 });
      break;
    case 'collect':
      tone({ type: 'sine', from: 880, to: 1560, dur: 0.14, gain: 0.07 });
      tone({ type: 'sine', from: 1320, to: 1760, dur: 0.1, gain: 0.04, delay: 0.06 });
      break;
    case 'hit':
      noise({ dur: 0.07, gain: 0.05, freq: 420, q: 0.8 });
      break;
    case 'chomp':
      noise({ dur: 0.1, gain: 0.06, freq: 220, q: 0.9 });
      break;
    case 'die':
      tone({ type: 'sawtooth', from: 420, to: 120, dur: 0.22, gain: 0.06 });
      break;
    case 'boom':
      noise({ dur: 0.42, gain: 0.16, freq: 160, q: 0.6 });
      tone({ type: 'sine', from: 180, to: 40, dur: 0.4, gain: 0.12 });
      break;
    case 'mower':
      tone({ type: 'sawtooth', from: 180, to: 720, dur: 0.34, gain: 0.06 });
      break;
    case 'error':
      tone({ type: 'square', from: 240, to: 180, dur: 0.12, gain: 0.05 });
      break;
    case 'wave':
      tone({ type: 'sawtooth', from: 220, to: 440, dur: 0.3, gain: 0.07 });
      noise({ dur: 0.3, gain: 0.05, freq: 300 });
      break;
    // 换天色 / 换天气：一声轻缓的转调，不打断操作
    case 'weather':
      tone({ type: 'sine', from: 520, to: 880, dur: 0.42, gain: 0.05 });
      tone({ type: 'sine', from: 780, to: 1180, dur: 0.36, gain: 0.035, delay: 0.12 });
      noise({ dur: 0.5, gain: 0.03, freq: 1600, q: 0.7 });
      break;
    // 精英出场：一声警报 + 低频压迫感
    case 'elite':
      [880, 660].forEach((f, i) => tone({ type: 'square', from: f, to: f * 0.9, dur: 0.16, gain: 0.05, delay: i * 0.18 }));
      tone({ type: 'sawtooth', from: 120, to: 90, dur: 0.5, gain: 0.06, delay: 0.34 });
      break;
    // 合体：低沉的轰响 + 两层撞在一起
    case 'fuse':
      tone({ type: 'sawtooth', from: 150, to: 58, dur: 0.55, gain: 0.1 });
      noise({ dur: 0.5, gain: 0.1, freq: 190, q: 0.6 });
      tone({ type: 'triangle', from: 300, to: 760, dur: 0.3, gain: 0.05, delay: 0.2 });
      break;
    // 分裂：连着两声「啵」
    case 'split':
      [0, 0.09].forEach((d, i) =>
        tone({ type: 'sine', from: [900, 1180][i], to: [420, 560][i], dur: 0.16, gain: 0.055, delay: d }),
      );
      break;
    // 复制分享链接成功
    case 'share':
      tone({ type: 'sine', from: 760, to: 1240, dur: 0.13, gain: 0.05 });
      tone({ type: 'sine', from: 1180, to: 1560, dur: 0.14, gain: 0.04, delay: 0.08 });
      break;
    case 'win':
      [0, 0.14, 0.28, 0.42].forEach((d, i) =>
        tone({ type: 'triangle', from: [523, 659, 784, 1047][i], to: [659, 784, 1047, 1319][i], dur: 0.22, gain: 0.08, delay: d }),
      );
      break;
    case 'lose':
      [0, 0.18, 0.36].forEach((d, i) =>
        tone({ type: 'sawtooth', from: [420, 330, 220][i], to: [330, 220, 110][i], dur: 0.3, gain: 0.08, delay: d }),
      );
      break;
    default:
      break;
  }
}
