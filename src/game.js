import { LEVELS, T, ROWS, GROUND } from './levels.js';
import { Level } from './level.js';
import { Player } from './player.js';
import { GRAVITY } from './entities.js';
import { NO_INPUT } from './input.js';
import { sfx, toggleMute, isMuted } from './audio.js';
import { rectsOverlap, circleRect } from './physics.js';
import * as D from './draw.js';

const VIEW_H = ROWS * T; // 480
const MIN_VIEW_W = 512;
const START_LIVES = 3;
const CATCH_LINES = ['잡았다!', '꿀꿀!', '포획 완료!', '어딜 도망가!', '하나 더!'];

export const TITLE = '꿀꿀 고추 사냥';

export class Game {
  constructor(canvas, input) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.input = input;
    this.width = 0;
    this.height = 0;
    this.scale = 1;
    this.viewW = MIN_VIEW_W;
    this.viewH = VIEW_H;
    this.t = 0;
    this.state = 'title';
    this.stateT = 0;
    this.lives = START_LIVES;
    this.levelIndex = 0;
    this.totalCaught = 0;
    this.totalFlyers = LEVELS.reduce((n, l) => n + l.flyers.length, 0);
    this.particles = [];
    this.texts = [];
    this.camX = 0;
    this.shake = 0;
    this.touch = false;
  }

  resize(width, height) {
    this.width = width;
    this.height = height;
    this.scale = Math.min(height / VIEW_H, width / MIN_VIEW_W);
    this.viewW = width / this.scale;
    this.viewH = height / this.scale;
  }

  // 터치 버튼을 보여줄 상태인가
  get showPad() {
    return this.state === 'play' || this.state === 'dying' || this.state === 'paused';
  }

  setState(s) {
    this.state = s;
    this.stateT = 0;
  }

  pause() {
    if (this.state === 'play') this.state = 'paused';
  }

  startLevel(i) {
    this.levelIndex = i;
    this.level = new Level(LEVELS[i]);
    const s = this.level.start;
    this.spawn = { x: s.x * T + 6, y: (s.y + 1) * T };
    this.player = new Player(this.spawn.x, this.spawn.y);
    this.caught = 0;
    this.particles = [];
    this.texts = [];
    this.updateCamera(0, true);
    this.setState('play');
  }

  // ───────────────────────── 업데이트 ─────────────────────────

  update(dt) {
    this.t += dt;
    this.stateT += dt;
    const inp = this.input;
    if (inp.pressed('mute')) toggleMute();

    switch (this.state) {
      case 'title':
        if (inp.pressed('confirm') || inp.pressed('jump')) {
          this.lives = START_LIVES;
          this.totalCaught = 0;
          this.startLevel(0);
          sfx.start();
        }
        break;
      case 'play':
        if (inp.pressed('pause')) this.state = 'paused';
        else this.updatePlay(dt);
        break;
      case 'paused':
        if (inp.pressed('pause') || inp.pressed('confirm')) this.state = 'play';
        break;
      case 'dying':
        this.updateDying(dt);
        break;
      case 'clear':
        this.level.update(dt, this.player);
        this.player.update(dt, NO_INPUT, this.level);
        this.updateCamera(dt);
        if (this.stateT > 1.2 && inp.pressed('confirm')) {
          if (this.levelIndex + 1 < LEVELS.length) this.startLevel(this.levelIndex + 1);
          else this.setState('ending');
        }
        break;
      case 'gameover':
        if (this.stateT > 1.2 && inp.pressed('confirm')) {
          this.lives = START_LIVES;
          this.startLevel(this.levelIndex);
        }
        break;
      case 'ending':
        if (this.stateT > 1.5 && inp.pressed('confirm')) this.setState('title');
        break;
    }
    this.updateEffects(dt);
    inp.endStep();
  }

  updatePlay(dt) {
    const { level, player: p } = this;
    level.update(dt, p);
    const { jumped, swung } = p.update(dt, this.input, level);
    if (jumped) {
      sfx.jump();
      this.dust(p.x + p.w / 2, p.y + p.h);
    }
    if (swung) sfx.swing();

    // 잠자리채로 잡기
    const net = p.netHitbox();
    if (net) {
      for (const f of level.flyers) {
        if (!f.caught && circleRect(f.x, f.y, f.r, net)) this.catchFlyer(f);
      }
    }

    // 체크포인트
    for (const cp of level.checkpoints) {
      if (!cp.active && rectsOverlap(p, cp.rect)) {
        cp.active = true;
        this.spawn = { x: cp.x - 4, y: cp.y };
        sfx.checkpoint();
        this.floatText('중간 저장!', cp.x, cp.y - 80, '#ffd23f');
      }
    }

    // 골인
    if (p.x + p.w > level.goal.x) {
      this.levelClear();
      return;
    }

    // 함정·장애물
    if (p.invuln <= 0) {
      const hitFrom = this.findHazard(p);
      if (hitFrom !== null) this.hurt(hitFrom);
    }

    // 구덩이
    if (this.state === 'play' && p.y > VIEW_H + 40) {
      this.lives--;
      sfx.hurt();
      this.die(false);
    }
    this.updateCamera(dt);
  }

  // 닿은 위험물의 x좌표를 돌려준다 (없으면 null). 판정은 살짝 너그럽게.
  findHazard(p) {
    const box = { x: p.x + 3, y: p.y + 4, w: p.w - 6, h: p.h - 4 };
    const { level } = this;
    const tx0 = Math.floor(box.x / T);
    const tx1 = Math.floor((box.x + box.w) / T);
    const ty0 = Math.floor(box.y / T);
    const ty1 = Math.floor((box.y + box.h) / T);
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        if (level.tile(tx, ty) === '^') {
          const r = { x: tx * T + 3, y: ty * T + 19, w: T - 6, h: 13 };
          if (rectsOverlap(box, r)) return tx * T + T / 2;
        }
      }
    }
    for (const c of level.pigeons) {
      const r = { x: c.x + 3, y: c.y + 3, w: c.w - 6, h: c.h - 6 };
      if (rectsOverlap(box, r)) return c.x + c.w / 2;
    }
    for (const s of level.wreckingBalls) {
      if (circleRect(s.x, s.y, s.r + 2, box)) return s.x;
    }
    return null;
  }

  hurt(fromX) {
    const p = this.player;
    this.lives--;
    sfx.hurt();
    this.shake = 0.3;
    this.burst(p.x + p.w / 2, p.y + p.h / 2, ['#ff5d8f', '#ffffff'], 10);
    if (this.lives <= 0) {
      this.die(true);
      return;
    }
    p.invuln = 1.6;
    p.stun = 0.25;
    p.vy = -420;
    p.vx = (p.x + p.w / 2 < fromX ? -1 : 1) * 240;
    p.platform = null;
    p.onGround = false;
    p.jumping = false;
    this.floatText('아야!', p.x + p.w / 2, p.y - 30, '#ff5d8f');
  }

  die(hop) {
    const p = this.player;
    p.dead = true;
    p.vx = 0;
    p.vy = hop ? -520 : 0;
    this.floatText('으악!', p.x + p.w / 2, Math.min(p.y, VIEW_H - 40) - 30, '#ff5d8f');
    this.setState('dying');
  }

  updateDying(dt) {
    const p = this.player;
    this.level.update(dt, p);
    if (p.vy !== 0 || p.y < VIEW_H + 100) {
      p.vy += GRAVITY * dt;
      p.y += p.vy * dt;
    }
    if (this.stateT > 1.4) {
      if (this.lives > 0) {
        p.reset(this.spawn.x, this.spawn.y);
        p.invuln = 1.6;
        this.updateCamera(0, true);
        this.setState('play');
      } else {
        sfx.gameOver();
        this.setState('gameover');
      }
    }
  }

  catchFlyer(f) {
    f.caught = true;
    this.caught++;
    sfx.catch();
    this.burst(f.x, f.y, ['#ffd23f', '#ff9ec0', '#ffffff'], 14);
    const line = CATCH_LINES[Math.floor(Math.random() * CATCH_LINES.length)];
    this.floatText(`+1 ${line}`, f.x, f.y - 24, '#ffd23f');
  }

  levelClear() {
    const { level } = this;
    this.totalCaught += this.caught;
    this.perfect = this.caught === level.totalFlyers;
    if (this.perfect) this.lives++;
    this.player.vx = 0;
    sfx.clear();
    if (this.perfect) setTimeout(() => sfx.oneUp(), 700);
    this.setState('clear');
  }

  updateCamera(dt, snap = false) {
    const p = this.player;
    const max = Math.max(0, this.level.pixelW - this.viewW);
    const target = Math.min(Math.max(p.x + p.w / 2 - this.viewW * 0.4, 0), max);
    this.camX = snap ? target : this.camX + (target - this.camX) * Math.min(1, dt * 8);
  }

  updateEffects(dt) {
    for (const q of this.particles) {
      q.vy += 600 * dt;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.life -= dt;
    }
    this.particles = this.particles.filter((q) => q.life > 0);
    for (const s of this.texts) {
      s.y -= 40 * dt;
      s.life -= dt;
    }
    this.texts = this.texts.filter((s) => s.life > 0);
    if (this.shake > 0) this.shake -= dt;
  }

  burst(x, y, colors, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 80 + Math.random() * 180;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 120,
        life: 0.5 + Math.random() * 0.4,
        size: 2 + Math.random() * 3,
        color: colors[i % colors.length],
      });
    }
  }

  dust(x, y) {
    for (let i = 0; i < 5; i++) {
      this.particles.push({
        x: x + (Math.random() - 0.5) * 14,
        y,
        vx: (Math.random() - 0.5) * 80,
        vy: -40 - Math.random() * 40,
        life: 0.3,
        size: 2.5,
        color: 'rgba(255,255,255,0.8)',
      });
    }
  }

  floatText(str, x, y, color = '#fff') {
    this.texts.push({ str, x, y, color, life: 1 });
  }

  // ───────────────────────── 그리기 ─────────────────────────

  render() {
    const { ctx } = this;
    ctx.save();
    ctx.scale(this.scale, this.scale);
    if (this.state === 'title') this.renderTitle();
    else this.renderWorld();
    ctx.restore();
  }

  renderWorld() {
    const { ctx, level, player: p, viewW: vw, viewH: vh, t } = this;
    const camY = VIEW_H - vh; // 화면이 세로로 길면 하늘이 더 보인다
    D.drawBackground(ctx, this.camX, camY, vw, vh, t, level.theme);

    let sx = 0;
    let sy = 0;
    if (this.shake > 0) {
      sx = (Math.random() - 0.5) * 8;
      sy = (Math.random() - 0.5) * 8;
    }
    ctx.save();
    ctx.translate(Math.round(-this.camX + sx), Math.round(-camY + sy));

    D.drawTiles(ctx, level, this.camX, this.camX + vw);
    D.drawGoal(ctx, level.goal, t);
    for (const cp of level.checkpoints) D.drawCheckpoint(ctx, cp, t);
    for (const pl of level.platforms) D.drawPlatform(ctx, pl);
    for (const s of level.wreckingBalls) D.drawWreckingBall(ctx, s);
    for (const c of level.pigeons) D.drawPigeon(ctx, c, t);
    for (const f of level.flyers) {
      const k = f.caught ? 1 - f.caughtT / 0.6 : 1;
      D.drawFlyer(ctx, f.x, f.y, {
        facing: f.facing,
        flap: f.flap,
        panic: f.panic || f.caught,
        t: t + f.bx,
        scale: k,
        alpha: k,
        spin: f.caught ? f.caughtT * 12 : 0,
      });
    }

    const blinkOut = p.invuln > 0 && !p.dead && Math.floor(t * 15) % 2 === 0;
    if (!blinkOut) {
      D.drawHero(ctx, p.x + p.w / 2, p.y + p.h, {
        facing: p.facing,
        run: p.run,
        air: !p.onGround,
        moving: Math.abs(p.vx) > 10,
        swing: p.swingProgress,
        blink: t % 3.2 < 0.12,
        t,
        hurt: p.dead || p.stun > 0,
      });
    }

    for (const q of this.particles) {
      ctx.globalAlpha = Math.min(1, q.life * 2);
      ctx.fillStyle = q.color;
      ctx.fillRect(q.x - q.size / 2, q.y - q.size / 2, q.size, q.size);
    }
    ctx.globalAlpha = 1;
    for (const s of this.texts) {
      ctx.globalAlpha = Math.min(1, s.life * 2);
      D.text(ctx, s.str, s.x, s.y, { size: 16, color: s.color });
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    this.renderHUD();
    this.renderOverlay();
  }

  renderHUD() {
    const { ctx, viewW: vw } = this;
    if (this.lives <= 6) {
      for (let i = 0; i < Math.max(this.lives, 0); i++) D.drawHeart(ctx, 22 + i * 24, 22, 1.4);
    } else {
      D.drawHeart(ctx, 22, 22, 1.4);
      D.text(ctx, `x ${this.lives}`, 38, 23, { size: 18, align: 'left' });
    }
    D.text(ctx, `${this.levelIndex + 1}. ${this.level.name}`, vw / 2, 22, { size: 18 });
    D.drawFlyer(ctx, vw - 92, 22, { flap: this.t * 18, t: this.t, scale: 0.8 });
    D.text(ctx, `${this.caught} / ${this.level.totalFlyers}`, vw - 16, 23, { size: 20, align: 'right' });
    if (isMuted()) D.text(ctx, '소리 끔 (M)', vw - 16, 48, { size: 12, align: 'right' });
  }

  renderOverlay() {
    const { ctx, viewW: vw, viewH: vh, state, stateT } = this;
    const cx = vw / 2;
    const cy = vh / 2;
    const blinkOn = Math.floor(this.t * 2.5) % 2 === 0;
    const go = this.touch ? '화면을 누르면' : 'Enter를 누르면';

    if (state === 'paused') {
      ctx.fillStyle = 'rgba(30, 10, 40, 0.5)';
      ctx.fillRect(0, 0, vw, vh);
      D.text(ctx, '일시정지', cx, cy - 16, { size: 40 });
      D.text(ctx, this.touch ? '화면을 누르면 계속' : 'P 또는 Enter로 계속', cx, cy + 28, { size: 18 });
    } else if (state === 'clear') {
      const pw = Math.min(360, vw - 32);
      D.drawPanel(ctx, cx - pw / 2, cy - 90, pw, 180);
      D.text(ctx, '스테이지 클리어!', cx, cy - 52, { size: 32, color: '#ff6fa3' });
      D.text(ctx, `잡은 고추 ${this.caught} / ${this.level.totalFlyers}`, cx, cy - 8, {
        size: 22,
        color: '#3a2340',
        stroke: null,
      });
      if (this.perfect) {
        D.text(ctx, '전부 잡았다! 목숨 +1', cx, cy + 24, { size: 18, color: '#2f9e44', stroke: null });
      }
      if (stateT > 1.2 && blinkOn) {
        const next = this.levelIndex + 1 < LEVELS.length ? '다음 스테이지' : '엔딩 보기';
        D.text(ctx, `${go} ${next}`, cx, cy + 58, { size: 16, color: '#7a5a8a', stroke: null });
      }
    } else if (state === 'gameover') {
      ctx.fillStyle = `rgba(30, 10, 40, ${Math.min(0.65, stateT)})`;
      ctx.fillRect(0, 0, vw, vh);
      D.text(ctx, '게임 오버', cx, cy - 24, { size: 48, color: '#ff6fa3' });
      D.text(ctx, '꿀꿀이는 지쳐서 잠들었다…', cx, cy + 20, { size: 18 });
      if (stateT > 1.2 && blinkOn) D.text(ctx, `${go} 다시 도전`, cx, cy + 60, { size: 18 });
    } else if (state === 'ending') {
      ctx.fillStyle = `rgba(255, 240, 250, ${Math.min(0.85, stateT)})`;
      ctx.fillRect(0, 0, vw, vh);
      D.drawHero(ctx, cx, cy - 40, { t: this.t, swing: (this.t % 1.2) / 0.4 < 1 ? (this.t % 1.2) / 0.4 : -1 });
      D.text(ctx, '모든 스테이지 클리어!', cx, cy + 10, { size: 34, color: '#ff6fa3' });
      D.text(ctx, `총 잡은 고추 ${this.totalCaught} / ${this.totalFlyers}`, cx, cy + 52, {
        size: 22,
        color: '#3a2340',
        stroke: null,
      });
      D.text(ctx, '오늘도 하늘의 평화는 지켜졌다. 꿀꿀!', cx, cy + 84, { size: 16, color: '#7a5a8a', stroke: null });
      if (stateT > 1.5 && blinkOn) {
        D.text(ctx, `${go} 처음으로`, cx, cy + 118, { size: 16, color: '#7a5a8a', stroke: null });
      }
    }
  }

  renderTitle() {
    const { ctx, viewW: vw, viewH: vh, t } = this;
    const camY = VIEW_H - vh;
    D.drawBackground(ctx, t * 40, camY, vw, vh, t);
    const groundY = GROUND * T - camY;
    D.drawRoofStrip(ctx, groundY, vw, vh - groundY);

    const cx = vw / 2;
    const top = Math.max(20, groundY - 400);
    D.text(ctx, TITLE, cx, top + 50, { size: Math.min(56, vw / 8), color: '#ffe3ef', stroke: '#b23a6b' });
    D.text(ctx, '도심 옥상을 뛰어다니며 하늘을 나는 고추를 잡아라!', cx, top + 100, { size: 18 });

    // 주인공과 고추가 쫓고 쫓기는 장면
    const heroX = cx - 70 + Math.sin(t * 0.8) * 30;
    const phase = t % 1.6;
    ctx.save();
    ctx.translate(heroX, groundY);
    ctx.scale(2.4, 2.4);
    D.drawHero(ctx, 0, 0, { t, swing: phase < 0.3 ? phase / 0.3 : -1, blink: t % 3 < 0.12 });
    ctx.restore();
    D.drawFlyer(ctx, cx + 90 + Math.cos(t * 1.3) * 40, groundY - 150 + Math.sin(t * 2.6) * 25, {
      facing: Math.sin(t * 1.3) > 0 ? -1 : 1,
      flap: t * 25,
      t,
      scale: 2.2,
      panic: true,
    });

    const help = this.touch
      ? '◀ ▶ 이동 · 점프 버튼 · 잠자리채 버튼'
      : '← → 이동   Space/Z 점프   X 잠자리채   P 일시정지   M 소리';
    D.text(ctx, help, cx, groundY + 24, { size: 15 });
    if (Math.floor(t * 2.5) % 2 === 0) {
      D.text(ctx, this.touch ? '화면을 눌러서 시작!' : 'Enter를 눌러서 시작!', cx, groundY + 52, {
        size: 20,
        color: '#ffd23f',
      });
    }
    if (this.touch && vh > vw) {
      D.text(ctx, '휴대폰을 가로로 돌리면 더 넓게 보여요', cx, top + 130, { size: 14 });
    }
  }
}
