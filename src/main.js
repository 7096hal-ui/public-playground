import { Game, TITLE } from './game.js';
import { Input } from './input.js';
import { unlockAudio, setAudioSuspended } from './audio.js';
import { World3D } from './world3d.js';

const canvas = document.getElementById('game');
const worldCanvas = document.getElementById('world');
const pad = document.getElementById('pad');
const input = new Input();
const game = new Game(canvas, input);
const params = new URLSearchParams(location.search);
const coarse = window.matchMedia('(pointer: coarse)').matches;
document.title = TITLE;
game.debug = params.has('debug');

// 3D 도시 (WebGL). 안 되면 예전처럼 2D로만 그린다.
let world = null;
if (!params.has('2d')) {
  try {
    world = new World3D(worldCanvas, { lowPower: coarse });
  } catch (e) {
    console.warn('3D를 켤 수 없어서 2D로 그립니다.', e);
    world = null;
  }
}
function drop3D() {
  if (world) world.dispose();
  world = null;
  game.world3d = null;
  worldCanvas.style.display = 'none';
}
if (world) {
  game.world3d = world;
  worldCanvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    drop3D();
  });
  // 간판 글씨는 글꼴이 도착한 뒤에 다시 그린다.
  if (document.fonts && document.fonts.load) {
    document.fonts.load('24px Jua').then(() => world && world.redrawAtlas(), () => {});
  }
} else {
  worldCanvas.style.display = 'none';
}

// 화면 크기와 고해상도(DPR)에 맞게 캔버스를 조정한다.
function resize() {
  const dpr = window.devicePixelRatio || 1;
  const { clientWidth: w, clientHeight: h } = canvas;
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  game.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  game.resize(w, h);
  if (world) world.setSize(w, h, dpr);
}
window.addEventListener('resize', resize);
resize();

// 브라우저는 사용자가 한 번 조작해야 소리를 낼 수 있게 해 준다.
window.addEventListener('keydown', unlockAudio);
window.addEventListener('pointerdown', unlockAudio);

// 터치 기기: 화면 버튼 사용
game.touch = window.matchMedia('(pointer: coarse)').matches;
window.addEventListener('touchstart', () => (game.touch = true), { passive: true });

canvas.addEventListener('pointerdown', () => input.tap('confirm'));
for (const btn of pad.querySelectorAll('button')) {
  const action = btn.dataset.action;
  const down = (e) => {
    e.preventDefault();
    btn.setPointerCapture?.(e.pointerId);
    btn.classList.add('on');
    if (action === 'pause') {
      if (game.state === 'paused') input.tap('confirm');
      else input.tap('pause');
      return;
    }
    input.press(action);
  };
  const up = () => {
    btn.classList.remove('on');
    input.release(action);
  };
  btn.addEventListener('pointerdown', down);
  btn.addEventListener('pointerup', up);
  btn.addEventListener('pointercancel', up);
  btn.addEventListener('lostpointercapture', up);
  btn.addEventListener('contextmenu', (e) => e.preventDefault());
}

// 다른 탭으로 가면 자동 일시정지
document.addEventListener('visibilitychange', () => {
  if (document.hidden) game.pause();
  setAudioSuspended(document.hidden);
});

// 고정 간격 업데이트 + 가변 렌더링 게임 루프
const STEP = 1 / 60;
let last = performance.now();
let acc = 0;

// 프레임이 계속 느리면 3D 해상도를 낮춘다. (?fixedq 이면 끔: 테스트용)
const autoQuality = !params.has('fixedq');
let slow = 0;

function frame(now) {
  const ms = now - last;
  acc += Math.min(ms / 1000, 0.25);
  last = now;
  if (world && autoQuality && !document.hidden) {
    slow = ms > 26 ? slow + 1 : Math.max(0, slow - 2);
    if (slow > 90) {
      world.lowerQuality();
      slow = 0;
    }
  }
  while (acc >= STEP) {
    game.update(STEP);
    acc -= STEP;
  }
  game.render();
  pad.classList.toggle('hidden', !(game.touch && game.showPad));
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// 디버깅용
window.__game = game;
