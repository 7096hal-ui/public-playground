import { LEVELS, TITLE_LEVEL, T, ROWS } from './levels.js';
import { Level } from './level.js';
import { Player, POWER_TIME } from './player.js';
import { GRAVITY, Flyer } from './entities.js';
import { Boss } from './boss.js';
import { NO_INPUT } from './input.js';
import { sfx, toggleMute } from './audio.js';
import { playMusic, stopMusic } from './music.js';
import { rectsOverlap, circleRect } from './physics.js';
import { theme } from './themes.js';
import * as R from './render2d.js';

const VIEW_H = ROWS * T; // 480
const MIN_VIEW_W = 512;
const START_LIVES = 3;
const COMBO_TIME = 2.2; // 이 시간 안에 또 잡으면 콤보
const INTRO_TIME = 2.4;
const EYE_FRAC = 0.36; // 3D 카메라 눈높이 (화면 위에서부터 비율)
const CATCH_LINES = ['잡았다!', '꿀꿀!', '포획 완료!', '어딜 도망가!', '하나 더!'];
const POWER_NAMES = { net: '왕잠자리채!', wings: '돼지 날개! 공중 점프 한 번 더', magnet: '자석 더듬이!', heart: '목숨 +1' };
const HISCORE_KEY = 'ggul-gochu-hiscore';

export const TITLE = '꿀꿀 고추 사냥';

function loadHi() {
  try {
    return Number(localStorage.getItem(HISCORE_KEY)) || 0;
  } catch {
    return 0;
  }
}
function saveHi(v) {
  try {
    localStorage.setItem(HISCORE_KEY, String(v));
  } catch {
    // 저장이 막혀 있어도 게임은 계속된다
  }
}
const ease = (k) => 1 - Math.pow(1 - Math.min(1, Math.max(0, k)), 3);

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
    this.score = 0;
    this.hiScore = loadHi();
    this.newHi = false;
    this.totalCaught = 0;
    this.totalFlyers = LEVELS.reduce((n, l) => n + l.flyers.length, 0);
    this.particles = [];
    this.texts = [];
    this.fireworks = [];
    this.camX = 0;
    this.shake = 0;
    this.flash = 0;
    this.touch = false;
    this.world3d = null; // 3D 도시 렌더러. 없으면 예전 2D 배경으로 그린다.
    this.debug = false; // true면 판정 칸을 빨간 선으로 보여 준다
    this.zoom = 1;
    this.zoomFX = 0.5;
    this.zoomFY = 0.5;
    this.eyeDX = 0;
    this.eyeDY = 0;
    this.distK = 1;
    this.camDist = 650;
    this.view = { x: 0, y: 0, w: MIN_VIEW_W, h: VIEW_H, eyeX: 0, eyeY: 0, dist: 650 };
    this.titleLevel = new Level(TITLE_LEVEL);
    this.music = undefined;
    this.lightningT = 4;
    this.bolt = null;
    this.zipSoundT = 0;
    this.wasInVent = false;
  }

  resize(width, height) {
    this.width = width;
    this.height = height;
    this.scale = Math.min(height / VIEW_H, width / MIN_VIEW_W);
    this.viewW = width / this.scale;
    this.viewH = height / this.scale;
    // 눈과 화면(z = 0 평면) 사이 거리. 가까울수록 원근감이 세다.
    this.camDist = Math.max(VIEW_H * 1.35, this.viewW * 0.62);
  }

  // 터치 버튼을 보여줄 상태인가
  get showPad() {
    return this.state === 'play' || this.state === 'dying' || this.state === 'paused' || this.state === 'intro';
  }

  setState(s) {
    this.state = s;
    this.stateT = 0;
  }

  pause() {
    if (this.state === 'play') this.state = 'paused';
  }

  newGame() {
    this.lives = START_LIVES;
    this.score = 0;
    this.totalCaught = 0;
    this.newHi = false;
    this.startLevel(0);
    sfx.start();
  }

  startLevel(i) {
    this.levelIndex = i;
    this.level = new Level(LEVELS[i]);
    if (this.world3d) this.world3d.buildLevel(this.level, `stage${i}`);
    const s = this.level.start;
    this.spawn = { x: s.x * T + 6, y: (s.y + 1) * T };
    this.player = new Player(this.spawn.x, this.spawn.y);
    this.boss = this.level.boss ? new Boss(this.level) : null;
    this.caught = 0;
    this.combo = 0;
    this.comboT = 0;
    this.bestCombo = 0;
    this.hits = 0;
    this.stageTime = 0;
    this.stageStartScore = this.score;
    this.particles = [];
    this.texts = [];
    this.fireworks = [];
    this.results = null;
    this.clearT = -1;
    this.zoom = 1;
    this.eyeDX = 0;
    this.eyeDY = 0;
    this.distK = 1;
    this.bolt = null;
    this.flash = 0;
    this.updateCamera(0, true);
    this.setState('intro');
  }

  // ───────────────────────── 업데이트 ─────────────────────────

  update(dt) {
    this.t += dt;
    this.stateT += dt;
    const inp = this.input;
    if (inp.pressed('mute')) toggleMute();

    switch (this.state) {
      case 'title':
        if (inp.pressed('confirm') || inp.pressed('jump')) this.newGame();
        break;
      case 'intro':
        this.updateIntro(dt);
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
        this.updateClear(dt);
        break;
      case 'gameover':
        if (this.stateT > 1.2 && inp.pressed('confirm')) {
          this.lives = START_LIVES;
          this.score = this.stageStartScore;
          this.startLevel(this.levelIndex);
        }
        break;
      case 'ending':
        this.updateEnding(dt);
        if (this.stateT > 2.5 && inp.pressed('confirm')) this.setState('title');
        break;
    }
    this.updateWeather(dt);
    this.updateEffects(dt);
    this.syncMusic();
    inp.endStep();
  }

  // 스테이지 시작: 카메라 눈이 크게 돌아 들어오며 도시가 입체로 펼쳐진다.
  // (z = 0 평면은 고정이라 주인공 그림은 어긋나지 않는다)
  updateIntro(dt) {
    const { level, player: p } = this;
    level.update(dt, p);
    p.update(dt, NO_INPUT, level);
    if (this.boss) this.updateBoss(dt);
    const k = 1 - ease(this.stateT / INTRO_TIME);
    this.eyeDX = k * this.viewW * 1.1;
    this.eyeDY = -k * 300;
    this.distK = 1 - k * 0.45;
    this.updateCamera(dt);
    const skip = this.stateT > 0.5 && (this.input.pressed('confirm') || this.input.pressed('jump'));
    if (this.stateT >= INTRO_TIME || skip) {
      this.eyeDX = 0;
      this.eyeDY = 0;
      this.distK = 1;
      this.setState('play');
    }
  }

  updatePlay(dt) {
    const { level, player: p } = this;
    this.stageTime += dt;
    if (this.comboT > 0) {
      this.comboT -= dt;
      if (this.comboT <= 0) this.combo = 0;
    }
    const before = [p.bigNet, p.wings, p.magnet];
    level.update(dt, p);
    const ev = p.update(dt, this.input, level);
    if (ev.jumped) {
      sfx.jump();
      this.dust(p.x + p.w / 2, p.y + p.h);
    }
    if (ev.airJump) {
      sfx.doubleJump();
      this.burst(p.x + p.w / 2, p.y + p.h, ['#ffffff', '#ffc9de'], 8);
    }
    if (ev.swung) sfx.swing();
    if (ev.sprung) {
      sfx.spring();
      this.burst(ev.sprung.x + ev.sprung.w / 2, ev.sprung.y, ['#ff6b6b', '#ffffff', '#ffd43b'], 10);
    }
    if (ev.zipStart) {
      sfx.zipGrab();
      this.zipSoundT = 0;
    }
    if (p.zip) {
      this.zipSoundT -= dt;
      if (this.zipSoundT <= 0) {
        sfx.zipRide();
        this.zipSoundT = 0.45;
      }
      if (Math.random() < 0.5) {
        this.particles.push({ x: p.x + p.w / 2, y: p.y - 10, vx: -p.vx * 0.2, vy: -20, life: 0.25, size: 2, color: '#ffe066' });
      }
    }
    if (p.inVent && !this.wasInVent) sfx.vent();
    this.wasInVent = p.inVent;
    const after = [p.bigNet, p.wings, p.magnet];
    for (let k = 0; k < 3; k++) if (before[k] > 0 && after[k] <= 0) sfx.powerDown();
    for (const c of level.platforms) {
      if (c.kind !== 'crumble') continue;
      if (!c.solid && !c.fellSaid) {
        c.fellSaid = true;
        sfx.crumble();
      }
      if (c.solid) c.fellSaid = false;
    }
    for (const r of level.rods) {
      if (r.struck && Math.abs(r.x - (p.x + p.w / 2)) < this.viewW) {
        sfx.zap();
        this.flash = Math.max(this.flash, 0.5);
        this.shake = Math.max(this.shake, 0.15);
        this.burst(r.x, r.base - 70, ['#ffffff', '#fff3a0', '#a5d8ff'], 10);
      }
    }

    // 아이템
    for (const it of level.items) {
      if (!it.taken && rectsOverlap(p, it.rect)) this.collect(it);
    }

    // 잠자리채로 잡기
    const net = p.netHitbox();
    if (net) {
      for (const f of level.flyers) {
        if (!f.caught && circleRect(f.x, f.y, f.r, net)) this.catchFlyer(f);
      }
      if (this.boss && circleRect(this.boss.x, this.boss.y, this.boss.r, net)) this.boss.hit();
    }
    if (this.boss) this.updateBoss(dt);

    // 체크포인트
    for (const cp of level.checkpoints) {
      if (!cp.active && rectsOverlap(p, cp.rect)) {
        cp.active = true;
        this.spawn = { x: cp.x - 4, y: cp.y };
        sfx.checkpoint();
        this.floatText('중간 저장!', cp.x, cp.y - 80, '#ffd23f');
      }
    }

    // 골인 (보스 스테이지는 마지막 고추를 잡으면 끝)
    if (level.goal && p.x + p.w > level.goal.x) {
      this.levelClear();
      return;
    }
    if (this.clearT >= 0) {
      this.clearT -= dt;
      if (this.clearT < 0) {
        this.levelClear();
        return;
      }
    }

    // 함정·장애물
    if (p.invuln <= 0 && !p.dead) {
      const hitFrom = this.findHazard(p);
      if (hitFrom !== null) this.hurt(hitFrom);
    }

    // 구덩이
    if (this.state === 'play' && p.y > VIEW_H + 40) {
      this.lives--;
      this.hits++;
      sfx.hurt();
      this.die(false);
    }
    this.updateCamera(dt);
  }

  updateBoss(dt) {
    const b = this.boss;
    b.update(dt, this.player);
    for (const e of b.events) {
      if (e === 'roar') {
        sfx.bossRoar();
        this.shake = 0.6;
        this.floatText('대왕 고추가 나타났다!', b.x, b.y + 70, '#ff8787', 20);
      } else if (e === 'dive') {
        sfx.bossDive();
      } else if (e === 'thud') {
        sfx.thud();
        this.shake = 0.35;
        this.burst(b.x, b.ground, ['#ced4da', '#ffffff', '#868e96'], 16);
        this.floatText('지금이야! 채로 잡아!', b.x, b.y - 70, '#ffd43b');
      } else if (e === 'seed') {
        sfx.seed();
      } else if (e === 'hit') {
        sfx.bossHit();
        this.addScore(500, b.x, b.y - 60, '맞았다!');
        this.burst(b.x, b.y, ['#ffd23f', '#ff9ec0', '#ffffff'], 18);
        this.shake = 0.2;
      } else if (e === 'defeat') {
        sfx.bossDown();
        this.shake = 0.8;
        this.flash = 0.8;
      } else if (e === 'pop') {
        sfx.firework();
        this.burst(b.x, b.y, ['#ffd23f', '#ff6fa3', '#ffffff', '#74c0fc'], 40);
        const f = new Flyer({ x: b.x / T - 0.5, y: b.y / T - 0.5, ax: 2, ay: 1, speed: 0.6 });
        f.final = true;
        this.level.flyers.push(f);
        this.floatText('작아졌다! 잡아라!', b.x, b.y - 50, '#ffd43b', 20);
      } else if (e === 'minion' && this.level.flyers.filter((f) => f.minion && !f.caught).length < 3) {
        const f = new Flyer({ x: b.x / T - 0.5, y: b.y / T + 1, ax: 2.5, ay: 1, speed: 1.2 });
        f.minion = true;
        this.level.flyers.push(f);
      }
    }
    b.events.length = 0;
  }

  collect(it) {
    const p = this.player;
    it.taken = true;
    sfx.powerUp();
    if (it.kind === 'heart') this.lives++;
    else if (it.kind === 'net') p.bigNet = POWER_TIME.net;
    else if (it.kind === 'wings') p.wings = POWER_TIME.wings;
    else if (it.kind === 'magnet') p.magnet = POWER_TIME.magnet;
    this.addScore(200);
    this.burst(it.x, it.y, ['#ffffff', '#ffd43b', '#74c0fc'], 14);
    this.floatText(POWER_NAMES[it.kind], it.x, it.y - 30, '#ffffff', 18);
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
    for (const r of level.rods) {
      const b = r.box;
      if (b && rectsOverlap(box, b)) return r.x;
    }
    if (this.boss) {
      for (const c of this.boss.hazards()) {
        if (circleRect(c.x, c.y, c.r, box)) return c.x;
      }
    }
    return null;
  }

  hurt(fromX) {
    const p = this.player;
    this.lives--;
    this.hits++;
    this.combo = 0;
    this.comboT = 0;
    sfx.hurt();
    this.shake = 0.3;
    this.burst(p.x + p.w / 2, p.y + p.h / 2, ['#ff5d8f', '#ffffff'], 10);
    if (this.lives <= 0) {
      this.die(true);
      return;
    }
    p.zip = null;
    p.zipCd = 0.4;
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
    p.zip = null;
    p.vx = 0;
    p.vy = hop ? -520 : 0;
    this.combo = 0;
    this.floatText('으악!', p.x + p.w / 2, Math.min(p.y, VIEW_H - 40) - 30, '#ff5d8f');
    this.setState('dying');
  }

  updateDying(dt) {
    const p = this.player;
    this.level.update(dt, p);
    if (this.boss) this.updateBoss(dt);
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
        this.saveHiScore();
        this.setState('gameover');
      }
    }
  }

  addScore(pts, x, y, label) {
    this.score += pts;
    if (x !== undefined) this.floatText(`+${pts}${label ? ' ' + label : ''}`, x, y, '#ffd23f');
  }

  catchFlyer(f) {
    f.caught = true;
    if (!f.minion && !f.final) this.caught++;
    this.combo = this.comboT > 0 ? this.combo + 1 : 1;
    this.comboT = COMBO_TIME;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    const mult = Math.min(this.combo, 8);
    const pts = (f.golden ? 500 : f.final ? 1000 : 100) * mult;
    this.score += pts;
    sfx.catch(this.combo);
    if (f.golden) sfx.golden();
    this.burst(f.x, f.y, f.golden ? ['#ffd23f', '#fff3a0', '#ffffff'] : ['#ffd23f', '#ff9ec0', '#ffffff'], f.golden ? 26 : 14);
    if (this.combo >= 2) {
      this.floatText(`${this.combo} 콤보! +${pts}`, f.x, f.y - 24, '#ff9ec0', 16 + Math.min(this.combo, 8) * 1.5);
    } else {
      const line = f.golden ? '황금 고추!' : CATCH_LINES[Math.floor(Math.random() * CATCH_LINES.length)];
      this.floatText(`+${pts} ${line}`, f.x, f.y - 24, '#ffd23f');
    }
    if (f.final) {
      this.flash = 0.6;
      this.clearT = 1.0;
    }
  }

  levelClear() {
    const { level, player: p } = this;
    const total = level.totalFlyers;
    const perfect = total > 0 && this.caught === total;
    const rows = [];
    if (level.boss) rows.push(['대왕 고추 격파', 5000]);
    else rows.push([`잡은 고추 ${this.caught} / ${total}`, 0]);
    if (perfect) rows.push(['전부 잡기 보너스', 2000]);
    if (this.hits === 0) rows.push(['무사고 보너스', 1000]);
    const tb = Math.max(0, Math.round((level.par - this.stageTime) * 20));
    if (tb > 0) rows.push(['시간 보너스', tb]);
    if (this.bestCombo >= 3) rows.push([`최고 ${this.bestCombo} 콤보`, this.bestCombo * 100]);
    let stars;
    if (level.boss) stars = this.hits === 0 ? 3 : this.hits <= 2 ? 2 : 1;
    else stars = 1 + (this.caught >= Math.ceil(total * 0.7) ? 1 : 0) + (perfect ? 1 : 0);
    const bonus = rows.reduce((n, r) => n + r[1], 0);
    this.score += bonus;
    this.results = { rows, stars, perfect, bonus };
    this.totalCaught += this.caught;
    if (perfect) {
      this.lives++;
      setTimeout(() => sfx.oneUp(), 900);
    }
    p.vx = 0;
    p.zip = null;
    sfx.clear();
    this.starsShown = 0;
    // 주인공 쪽으로 천천히 다가간다
    this.zoomFX = Math.min(0.9, Math.max(0.1, (p.x + p.w / 2 - this.camX) / this.viewW));
    this.zoomFY = Math.min(0.9, Math.max(0.1, (p.y - (VIEW_H - this.viewH)) / this.viewH));
    this.setState('clear');
  }

  updateClear(dt) {
    const { level, player: p } = this;
    level.update(dt, p);
    p.update(dt, NO_INPUT, level);
    this.zoom += (1.28 - this.zoom) * Math.min(1, dt * 2);
    this.eyeDX = Math.sin(this.stateT * 0.6) * this.viewW * 0.25;
    for (let i = 0; i < 3; i++) {
      if (this.starsShown === i && this.results.stars > i && this.stateT > 0.5 + i * 0.35) {
        this.starsShown++;
        sfx.star(i);
      }
    }
    if (this.stateT > 0.4 && Math.random() < dt * 2.5) this.launchFirework();
    if (this.stateT > 1.8 && this.input.pressed('confirm')) {
      if (this.levelIndex + 1 < LEVELS.length) this.startLevel(this.levelIndex + 1);
      else {
        this.saveHiScore();
        this.zoom = 1;
        this.eyeDX = 0;
        this.setState('ending');
      }
    }
  }

  updateEnding(dt) {
    const { level, player: p } = this;
    level.update(dt, p);
    p.update(dt, NO_INPUT, level);
    this.zoom += (1 - this.zoom) * Math.min(1, dt * 2);
    this.eyeDX = Math.sin(this.stateT * 0.25) * this.viewW * 0.5;
    this.eyeDY = -60 + Math.sin(this.stateT * 0.18) * 50;
    if (Math.random() < dt * 4) this.launchFirework();
  }

  saveHiScore() {
    if (this.score > this.hiScore) {
      this.hiScore = this.score;
      this.newHi = true;
      saveHi(this.score);
    }
  }

  updateCamera(dt, snap = false) {
    const p = this.player;
    const max = Math.max(0, this.level.pixelW - this.viewW);
    let target = Math.min(Math.max(p.x + p.w / 2 - this.viewW * 0.4, 0), max);
    if (this.level.pixelW < this.viewW) target = (this.level.pixelW - this.viewW) / 2;
    this.camX = snap ? target : this.camX + (target - this.camX) * Math.min(1, dt * 8);
  }

  // 지금 상태에 맞는 배경음악 (같은 곡이면 아무 일도 안 함)
  syncMusic() {
    let want = null;
    const s = this.state;
    if (s === 'title') want = 'title';
    else if (s === 'ending') want = 'ending';
    else if (s === 'intro' || s === 'play' || s === 'paused' || s === 'dying') {
      want = this.level.theme;
      if (this.boss && (this.boss.state === 'defeat' || this.boss.state === 'gone')) want = null;
    }
    if (want === this.music) return;
    this.music = want;
    if (want) playMusic(want);
    else stopMusic();
  }

  // 폭풍우 스테이지의 번개
  updateWeather(dt) {
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 2.2);
    if (this.bolt) {
      this.bolt.life -= dt;
      if (this.bolt.life <= 0) this.bolt = null;
    }
    if (this.state !== 'title' && this.level && theme(this.level.theme).lightning) {
      this.lightningT -= dt;
      if (this.lightningT <= 0) {
        this.lightningT = 5 + Math.random() * 6;
        this.flash = Math.max(this.flash, 0.9);
        this.bolt = { x: this.view.x + this.view.w * (0.15 + Math.random() * 0.7), seed: Math.floor(Math.random() * 1000), life: 0.25 };
        setTimeout(() => sfx.thunder(), 250 + Math.random() * 400);
      }
    }
    if (this.world3d) this.world3d.flash = this.flash * 0.6;
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
    for (const f of this.fireworks) {
      if (f.stage === 'up') {
        f.y += f.vy * dt;
        f.vy += 260 * dt;
        if (f.vy > -60) {
          f.stage = 'boom';
          sfx.firework();
          for (let i = 0; i < 46; i++) {
            const a = (i / 46) * Math.PI * 2;
            const sp = 90 + Math.random() * 110;
            f.sparks.push({ x: f.x, y: f.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1.2 + Math.random() * 0.5 });
          }
        }
      } else {
        for (const s of f.sparks) {
          s.vx *= 1 - dt * 1.4;
          s.vy = s.vy * (1 - dt * 1.4) + 70 * dt;
          s.x += s.vx * dt;
          s.y += s.vy * dt;
          s.life -= dt;
        }
        f.sparks = f.sparks.filter((s) => s.life > 0);
        if (!f.sparks.length) f.done = true;
      }
    }
    this.fireworks = this.fireworks.filter((f) => !f.done);
    if (this.shake > 0) this.shake -= dt;
  }

  launchFirework() {
    if (this.fireworks.length > 6) return;
    const v = this.view;
    const colors = ['#ff6fa3', '#ffd23f', '#74c0fc', '#8ce99a', '#b197fc', '#ff8787'];
    this.fireworks.push({
      x: v.x + v.w * (0.15 + Math.random() * 0.7),
      y: v.y + v.h * 0.85,
      vy: -330 - Math.random() * 120,
      stage: 'up',
      sparks: [],
      color: colors[Math.floor(Math.random() * colors.length)],
    });
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

  floatText(str, x, y, color = '#fff', size = 16) {
    this.texts.push({ str, x, y, color, size, life: 1.1 });
  }

  // ───────────────────────── 그리기 ─────────────────────────

  // 2D 덧그림과 3D 도시가 함께 쓰는 화면 영역(z = 0 평면 기준)과 눈 위치
  computeView() {
    const z = this.zoom;
    const w = this.viewW / z;
    const h = this.viewH / z;
    let x = this.camX + (this.viewW - w) * this.zoomFX;
    let y = VIEW_H - this.viewH + (this.viewH - h) * this.zoomFY;
    if (this.shake > 0) {
      x += (Math.random() - 0.5) * 8;
      y += (Math.random() - 0.5) * 8;
    }
    const v = this.view;
    v.x = x;
    v.y = y;
    v.w = w;
    v.h = h;
    v.eyeX = x + w * 0.5 + this.eyeDX;
    // 눈높이는 화면 아래쪽(옥상들) 기준으로 잡는다. 세로로 긴 화면에서도 원근감이 같다.
    v.eyeY = y + h - (VIEW_H / z) * (1 - EYE_FRAC) + this.eyeDY;
    v.dist = this.camDist * this.distK;
    return v;
  }

  render() {
    const { ctx } = this;
    if (this.state === 'title') this.titleCamera();
    const v = this.computeView();
    if (this.world3d) {
      if (this.state === 'title') this.world3d.buildLevel(this.titleLevel, 'title');
      this.world3d.render(v, this.t);
      ctx.clearRect(0, 0, this.width, this.height);
    }
    ctx.save();
    ctx.scale(this.scale, this.scale);
    if (this.state === 'title') R.renderTitle(this);
    else R.renderWorld(this);
    ctx.restore();
  }

  // 타이틀: 노을 진 옥상. 눈 위치만 천천히 흔들어서 도시가 입체로 돌아 보이게 한다.
  titleCamera() {
    const t = this.t;
    this.zoom = 1;
    this.distK = 1;
    this.camX = 40 * T - this.viewW / 2;
    this.eyeDX = Math.sin(t * 0.23) * this.viewW * 0.45;
    this.eyeDY = -30 + Math.sin(t * 0.17) * 40;
  }
}
