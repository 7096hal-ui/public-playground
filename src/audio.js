// 효과음은 파일 없이 Web Audio로 직접 만든다.
let ctx = null;
let muted = false;

export function unlockAudio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume();
}

export function toggleMute() {
  muted = !muted;
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
  osc.connect(gain).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

const notes = (list, type, vol, gap) =>
  list.forEach((f, i) => tone(f, f, gap * 1.4, type, vol, i * gap));

export const sfx = {
  start: () => notes([523, 659, 784, 1047], 'square', 0.07, 0.08),
  jump: () => tone(380, 760, 0.12, 'square', 0.06),
  swing: () => tone(900, 250, 0.1, 'sawtooth', 0.04),
  catch: () => notes([784, 988, 1319], 'triangle', 0.14, 0.06),
  hurt: () => tone(330, 80, 0.35, 'sawtooth', 0.1),
  checkpoint: () => notes([660, 880], 'triangle', 0.12, 0.09),
  oneUp: () => notes([659, 784, 1319, 1047, 1175, 1568], 'square', 0.06, 0.07),
  clear: () => notes([523, 659, 784, 1047, 784, 1047], 'square', 0.07, 0.1),
  die: () => notes([494, 466, 440, 415], 'square', 0.08, 0.15),
  gameOver: () => notes([392, 330, 262, 196], 'triangle', 0.14, 0.22),
};
