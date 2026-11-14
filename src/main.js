import { Game, TITLE } from './game.js';
import { Input } from './input.js';
import { unlockAudio } from './audio.js';

const canvas = document.getElementById('game');
const pad = document.getElementById('pad');
const input = new Input();
const game = new Game(canvas, input);
document.title = TITLE;

// 화면 크기와 고해상도(DPR)에 맞게 캔버스를 조정한다.
function resize() {
  const dpr = window.devicePixelRatio || 1;
  const { clientWidth: w, clientHeight: h } = canvas;
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  game.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  game.resize(w, h);
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
});

// 고정 간격 업데이트 + 가변 렌더링 게임 루프
const STEP = 1 / 60;
let last = performance.now();
let acc = 0;

function frame(now) {
  acc += Math.min((now - last) / 1000, 0.25);
  last = now;
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
