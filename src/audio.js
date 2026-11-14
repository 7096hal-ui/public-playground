// 효과음과 배경음악은 파일 없이 Web Audio로 직접 만든다.
// 소리 흐름: 효과음 → sfxBus ─┐
//            배경음악 → musicBus ┴→ master(음소거) → 스피커
let ctx = null;
let master = null;
let sfxBus = null;
let musicBus = null;
let noiseBuf = null;
let muted = false;
const readyFns = [];

export function unlockAudio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 1;
    master.connect(ctx.destination);
    sfxBus = ctx.createGain();
    sfxBus.connect(master);
    musicBus = ctx.createGain();
    musicBus.gain.value = 0.5;
    musicBus.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    readyFns.splice(0).forEach((fn) => fn());
  }
  if (ctx.state === 'suspended' && !document.hidden) ctx.resume();
}

// 오디오가 준비되면(사용자의 첫 조작 뒤) fn을 부른다. 이미 준비됐으면 바로 부른다.
export function onAudioReady(fn) {
  if (ctx) fn();
  else readyFns.push(fn);
}

// 배경음악 모듈이 쓰는 연결점. 아직 준비 전이면 null.
export function audioGraph() {
  return ctx ? { ctx, musicBus, noiseBuf } : null;
}

// 탭을 떠나면 소리를 통째로 멈춘다.
export function setAudioSuspended(s) {
  if (!ctx) return;
  if (s) ctx.suspend();
  else ctx.resume();
}

export function toggleMute() {
  muted = !muted;
  if (master) {
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setValueAtTime(muted ? 0 : 1, ctx.currentTime);
  }
  return muted;
}

export function isMuted() {
  return muted;
}

function tone(f0, f1, dur, type = 'square', vol = 0.1, delay = 0) {
  if (!ctx || muted) return;
  const t0 = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(f0, t0);
  osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(sfxBus);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

// 쏴아-, 콰르릉 같은 잡음 소리
function noise(dur, vol = 0.2, freq = 1200, delay = 0, type = 'lowpass') {
  if (!ctx || muted) return;
  const t0 = ctx.currentTime + delay;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = freq;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filter).connect(gain).connect(sfxBus);
  src.start(t0, Math.random() * 0.5);
  src.stop(t0 + dur + 0.02);
}

const notes = (list, type, vol, gap) =>
  list.forEach((f, i) => tone(f, f, gap * 1.4, type, vol, i * gap));

export const sfx = {
  start: () => notes([523, 659, 784, 1047], 'square', 0.07, 0.08),
  jump: () => tone(380, 760, 0.12, 'square', 0.06),
  doubleJump: () => tone(600, 1300, 0.14, 'triangle', 0.09),
  swing: () => tone(900, 250, 0.1, 'sawtooth', 0.04),
  catch: (combo = 1) => {
    const k = Math.pow(2, Math.min(combo - 1, 8) / 12);
    notes([784 * k, 988 * k, 1319 * k], 'triangle', 0.14, 0.06);
  },
  golden: () => notes([1047, 1319, 1568, 2093, 1568, 2093], 'triangle', 0.12, 0.05),
  hurt: () => tone(330, 80, 0.35, 'sawtooth', 0.1),
  checkpoint: () => notes([660, 880], 'triangle', 0.12, 0.09),
  oneUp: () => notes([659, 784, 1319, 1047, 1175, 1568], 'square', 0.06, 0.07),
  clear: () => notes([523, 659, 784, 1047, 784, 1047], 'square', 0.07, 0.1),
  die: () => notes([494, 466, 440, 415], 'square', 0.08, 0.15),
  gameOver: () => notes([392, 330, 262, 196], 'triangle', 0.14, 0.22),
  spring: () => {
    tone(180, 900, 0.25, 'triangle', 0.14);
    tone(240, 1200, 0.2, 'square', 0.03, 0.02);
  },
  zipGrab: () => tone(500, 900, 0.08, 'square', 0.06),
  zipRide: () => noise(0.5, 0.05, 2500, 0, 'bandpass'),
  vent: () => noise(0.4, 0.06, 500),
  powerUp: () => notes([523, 784, 659, 1047, 784, 1319], 'square', 0.06, 0.055),
  powerDown: () => notes([880, 660, 523], 'triangle', 0.08, 0.08),
  star: (i = 0) => notes([880 * Math.pow(1.26, i), 1320 * Math.pow(1.26, i)], 'triangle', 0.12, 0.07),
  thunder: () => {
    noise(1.6, 0.35, 300);
    noise(0.25, 0.25, 3000, 0, 'highpass');
  },
  zap: () => {
    tone(1600, 120, 0.3, 'sawtooth', 0.08);
    noise(0.3, 0.15, 4000, 0, 'highpass');
  },
  crumble: () => noise(0.35, 0.12, 900),
  bossRoar: () => {
    tone(220, 90, 0.7, 'sawtooth', 0.1);
    tone(230, 95, 0.7, 'square', 0.05, 0.03);
  },
  bossHit: () => {
    notes([1200, 900, 1500], 'square', 0.08, 0.04);
    noise(0.2, 0.15, 2000);
  },
  bossDive: () => tone(1400, 200, 0.6, 'triangle', 0.08),
  thud: () => {
    tone(140, 40, 0.35, 'sine', 0.3);
    noise(0.3, 0.2, 400);
  },
  seed: () => tone(1200, 1600, 0.06, 'square', 0.03),
  firework: () => {
    tone(300, 1800, 0.35, 'triangle', 0.03);
    noise(0.5, 0.12, 2500, 0.35, 'highpass');
  },
  bossDown: () => notes([784, 740, 698, 659, 622, 587, 554, 523], 'square', 0.07, 0.09),
};
