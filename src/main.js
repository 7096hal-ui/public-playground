import { Game } from './game.js';
import { Input } from './input.js';

const canvas = document.getElementById('game');
const input = new Input();
const game = new Game(canvas, input);

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
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
