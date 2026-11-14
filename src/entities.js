import { T, ROWS } from './levels.js';
import { moveBody } from './physics.js';

export const GRAVITY = 1900;

// 날아다니는 고추. 잠자리채로 잡아야 한다.
export class Flyer {
  constructor({ x, y, ax = 1.5, ay = 0.5, speed = 1 }) {
    this.bx = x * T + 16;
    this.by = y * T + 16;
    this.ax = ax * T;
    this.ay = ay * T;
    this.speed = speed;
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

  update(dt, px, py) {
    this.flap += dt * (this.panic ? 32 : 18);
    if (this.caught) {
      this.caughtT += dt;
      this.y -= dt * 40;
      if (this.caughtT > 0.6) this.gone = true;
      return;
    }
    this.panic = Math.hypot(px - this.x, py - this.y) < 120;
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

// 크레인에 매달려 좌우로 왕복하는 철골 발판. 위에서만 올라설 수 있다.
export class Platform {
  constructor({ x, y, range, speed, w }) {
    this.x0 = x * T;
    this.x = this.x0;
    this.y = y * T;
    this.w = w * T;
    this.h = 12;
    this.range = range * T;
    this.speed = speed;
    this.t = 0;
    this.dx = 0;
  }

  update(dt) {
    this.t += dt * this.speed;
    const nx = this.x0 + ((1 - Math.cos(this.t)) / 2) * this.range;
    this.dx = nx - this.x;
    this.x = nx;
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
