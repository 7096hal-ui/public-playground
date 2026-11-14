import { T, ROWS } from './levels.js';
import { moveBody } from './physics.js';

export const GRAVITY = 1900;

// 날아다니는 고추. 잠자리채로 잡아야 한다. golden이면 황금 고추(점수 5배, 조금 빠름).
export class Flyer {
  constructor({ x, y, ax = 1.5, ay = 0.5, speed = 1, golden = false }) {
    this.bx = x * T + 16;
    this.by = y * T + 16;
    this.ax = ax * T;
    this.ay = ay * T;
    this.golden = golden;
    this.speed = golden ? speed * 1.5 : speed;
    this.t = Math.random() * Math.PI * 2;
    this.flap = Math.random() * 6;
    this.x = this.bx;
    this.y = this.by;
    this.facing = 1;
    this.r = 15;
    this.panic = false;
    this.caught = false;
    this.caughtT = 0;
    this.gone = false;
  }

  // 날아다니는 범위(판정 확인용): 중심이 움직이는 상자
  get envelope() {
    return { x: this.bx - this.ax, y: this.by - this.ay, w: this.ax * 2, h: this.ay * 2 };
  }

  update(dt, px, py, magnet = false) {
    this.flap += dt * (this.panic ? 32 : 18);
    if (this.caught) {
      this.caughtT += dt;
      this.y -= dt * 40;
      if (this.caughtT > 0.6) this.gone = true;
      return;
    }
    const d = Math.hypot(px - this.x, py - this.y);
    this.panic = d < 120;
    if (magnet && d < 180) {
      // 자석 더듬이: 주인공 쪽으로 끌려온다
      this.bx += (px - this.bx) * Math.min(1, dt * 2.2);
      this.by += (py - 26 - this.by) * Math.min(1, dt * 2.2);
    }
    this.t += dt * this.speed * (this.panic ? 2.2 : 1);
    const nx = this.bx + Math.sin(this.t * 1.2) * this.ax;
    const ny = this.by + Math.sin(this.t * 2.3) * this.ay;
    if (Math.abs(nx - this.x) > 0.01) this.facing = nx > this.x ? 1 : -1;
    this.x = nx;
    this.y = ny;
  }
}

// 옥상을 왔다 갔다 하는 성난 비둘기. 벽이나 옥상 끝에서 방향을 바꾼다.
export class Pigeon {
  constructor({ x, y }) {
    this.w = 24;
    this.h = 24;
    this.x = x * T + 4;
    this.y = (y + 1) * T - this.h;
    this.vx = -55;
    this.vy = 0;
    this.walk = Math.random() * 10;
    this.onGround = false;
    this.gone = false;
  }

  update(dt, level) {
    this.vy = Math.min(this.vy + GRAVITY * dt, 900);
    const speed = this.vx;
    if (moveBody(this, level, dt)) {
      this.vx = -speed;
    } else if (this.onGround) {
      const fx = this.vx > 0 ? this.x + this.w + 1 : this.x - 1;
      if (!level.isSolid(Math.floor(fx / T), Math.floor((this.y + this.h + 2) / T))) this.vx = -this.vx;
    }
    this.walk += Math.abs(this.vx) * dt;
    if (this.y > ROWS * T + 100) this.gone = true;
  }
}

// 크레인 줄에 매달려 위아래로 움직이는 쇳덩이.
export class WreckingBall {
  constructor({ x, y, amp, speed }) {
    this.x = x * T + 16;
    this.by = y * T + 16;
    this.amp = amp * T;
    this.speed = speed;
    this.t = Math.random() * Math.PI * 2;
    this.r = 14;
    this.y = this.by;
  }

  update(dt) {
    this.t += dt * this.speed;
    this.y = this.by + Math.sin(this.t) * this.amp;
  }
}

// 위에서만 올라설 수 있는 발판들의 공통 성질:
//   x, y, w, h, dx, dy(이번 프레임 이동량), solid(밟을 수 있는가)
// 크레인 철골 발판(axis 'x')과 창문 청소 곤돌라(axis 'y').
export class Platform {
  constructor({ x, y, range, speed, w, axis = 'x', phase = 0 }) {
    this.kind = axis === 'y' ? 'gondola' : 'girder';
    this.axis = axis;
    this.x0 = x * T;
    this.y0 = y * T;
    this.x = this.x0;
    this.y = this.y0;
    this.w = w * T;
    this.h = axis === 'y' ? 14 : 12;
    this.range = range * T;
    this.speed = speed;
    this.phase = phase;
    this.time = 0;
    this.dx = 0;
    this.dy = 0;
    this.solid = true;
    this.place(0);
    this.dx = 0;
    this.dy = 0;
  }

  // time초 뒤의 위치 (봇이 시간으로 바로 맞출 수 있게)
  place(time) {
    this.time = time;
    const k = (1 - Math.cos(time * this.speed + this.phase)) / 2;
    const nx = this.axis === 'x' ? this.x0 + k * this.range : this.x0;
    const ny = this.axis === 'y' ? this.y0 + k * this.range : this.y0;
    this.dx = nx - this.x;
    this.dy = ny - this.y;
    this.x = nx;
    this.y = ny;
  }

  update(dt) {
    this.place(this.time + dt);
  }
}

// 낡은 간판: 밟고 0.5초가 지나면 흔들리다 떨어진다. 3초 뒤 제자리에 다시 생긴다.
export class Crumble {
  constructor({ x, y, w = 2 }) {
    this.kind = 'crumble';
    this.x0 = x * T;
    this.y0 = (y + 1) * T - 14;
    this.x = this.x0;
    this.y = this.y0;
    this.w = w * T;
    this.h = 14;
    this.dx = 0;
    this.dy = 0;
    this.solid = true;
    this.touched = false;
    this.timer = 0;
    this.vy = 0;
    this.respawn = 0;
    this.shake = 0;
  }

  update(dt) {
    this.dx = 0;
    this.dy = 0;
    if (this.respawn > 0) {
      this.respawn -= dt;
      if (this.respawn <= 0) {
        this.y = this.y0;
        this.solid = true;
        this.touched = false;
        this.timer = 0;
        this.vy = 0;
      }
      return;
    }
    if (!this.touched) return;
    this.timer += dt;
    this.shake = this.timer < 0.5 ? this.timer * 2 : 0;
    if (this.timer > 0.5) {
      this.solid = false;
      this.vy = Math.min(this.vy + GRAVITY * dt, 900);
      this.y += this.vy * dt;
      if (this.y > ROWS * T + 60) this.respawn = 3;
    }
  }
}

// 옥상 트램펄린: 밟으면 높이 튀어 오른다.
export class Spring {
  constructor({ x, y, power = 960 }) {
    this.x = x * T + 3;
    this.w = T - 6;
    this.y = (y + 1) * T - 14;
    this.h = 14;
    this.power = power;
    this.squash = 0;
  }

  update(dt) {
    this.squash = Math.max(0, this.squash - dt * 4);
  }
}

// 짚라인: 줄에 닿으면 매달려서 끝까지 미끄러져 간다. 점프로 중간에 놓을 수 있다.
// (x0, y0) → (x1, y1) 은 타일 단위, 줄은 그 칸의 가운데를 지난다.
export class Zipline {
  constructor({ x0, y0, x1, y1 }) {
    this.ax = x0 * T + T / 2;
    this.ay = y0 * T + T / 2;
    this.bx = x1 * T + T / 2;
    this.by = y1 * T + T / 2;
    const dx = this.bx - this.ax;
    const dy = this.by - this.ay;
    this.len = Math.hypot(dx, dy);
    this.ux = dx / this.len;
    this.uy = dy / this.len;
  }

  // 점 (px, py)에서 줄까지의 거리와 줄 위 위치(s)
  nearest(px, py) {
    const s = Math.max(0, Math.min(this.len, (px - this.ax) * this.ux + (py - this.ay) * this.uy));
    const qx = this.ax + this.ux * s;
    const qy = this.ay + this.uy * s;
    return { s, d: Math.hypot(px - qx, py - qy) };
  }

  point(s) {
    return { x: this.ax + this.ux * s, y: this.ay + this.uy * s };
  }
}

// 환풍구 상승 기류: 위로 솟는 바람 기둥 안에 들어가면 둥실 떠오른다.
export class Vent {
  constructor({ x, y, w = 2, height = 6 }) {
    this.x = x * T;
    this.w = w * T;
    this.base = (y + 1) * T; // 환풍구가 놓인 바닥
    this.top = this.base - height * T; // 바람이 닿는 높이
    this.spin = 0;
  }

  contains(b) {
    return b.x + b.w > this.x + 4 && b.x < this.x + this.w - 4 && b.y + b.h > this.top && b.y < this.base;
  }

  update(dt) {
    this.spin += dt * 14;
  }
}

// 피뢰침: 주기적으로 번개가 내리친다. 내리치기 1초 전부터 불꽃이 튄다.
export class Rod {
  constructor({ x, y, period = 3.4, phase = 0 }) {
    this.x = x * T + T / 2;
    this.base = (y + 1) * T;
    this.period = period;
    this.time = phase;
    this.state = 'idle'; // idle → warn → strike
    this.struck = false; // 이번 프레임에 막 내리쳤는가
  }

  update(dt) {
    this.time += dt;
    const k = this.time % this.period;
    const prev = this.state;
    this.state = k > this.period - 0.35 ? 'strike' : k > this.period - 1.35 ? 'warn' : 'idle';
    this.struck = this.state === 'strike' && prev !== 'strike';
  }

  // 번개가 내리치는 동안의 위험 영역 (피뢰침 위 하늘 전체)
  get box() {
    return this.state === 'strike' ? { x: this.x - 20, y: -200, w: 40, h: this.base + 200 } : null;
  }
}

// 아이템 상자: 닿으면 효과. kind = 'net'(왕잠자리채) | 'wings'(돼지 날개) | 'magnet'(자석 더듬이) | 'heart'(목숨)
export class Item {
  constructor({ x, y, kind }) {
    this.x = x * T + T / 2;
    this.y = y * T + T / 2;
    this.kind = kind;
    this.taken = false;
    this.t = Math.random() * 6;
  }

  update(dt) {
    this.t += dt;
  }

  get rect() {
    return { x: this.x - 13, y: this.y - 13 + Math.sin(this.t * 3) * 4, w: 26, h: 26 };
  }
}

export class Checkpoint {
  constructor({ x, y }) {
    this.x = x * T + 12;
    this.y = (y + 1) * T; // 땅 높이
    this.active = false;
  }

  get rect() {
    return { x: this.x - 10, y: this.y - 80, w: 30, h: 80 };
  }
}

export class Goal {
  constructor({ x, y }) {
    this.x = x * T + 14;
    this.y = (y + 1) * T;
  }
}
