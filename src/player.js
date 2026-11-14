import { moveBody } from './physics.js';
import { GRAVITY } from './entities.js';

// 조작감 관련 수치. 숫자를 바꾸면 손맛이 바뀐다.
const MAX_SPEED = 215;
const ACCEL_GROUND = 1900;
const ACCEL_AIR = 1300;
const FRICTION = 2200;
const AIR_DRAG = 500;
const JUMP_V = 690; // 점프 높이 약 3.9칸
const JUMP_CUT = 280; // 점프 버튼을 일찍 떼면 낮게 뛴다
const MAX_FALL = 900;
const COYOTE = 0.1; // 발판에서 막 떨어진 직후에도 점프 허용
const BUFFER = 0.13; // 착지 직전에 누른 점프도 인정
const SWING_TIME = 0.3;
const SWING_COOLDOWN = 0.36;

function approach(v, target, step) {
  return v < target ? Math.min(v + step, target) : Math.max(v - step, target);
}

export class Player {
  constructor(x, feetY) {
    this.w = 20;
    this.h = 28;
    this.reset(x, feetY);
  }

  reset(x, feetY) {
    this.x = x;
    this.y = feetY - this.h;
    this.vx = 0;
    this.vy = 0;
    this.facing = 1;
    this.onGround = false;
    this.coyote = 0;
    this.buffer = 0;
    this.jumping = false;
    this.swingT = -1;
    this.swingCd = 0;
    this.invuln = 0;
    this.stun = 0;
    this.platform = null;
    this.run = 0;
    this.dead = false;
  }

  get swingProgress() {
    return this.swingT < 0 ? -1 : this.swingT / SWING_TIME;
  }

  // 잠자리채가 휘둘러지는 동안의 판정 영역(넉넉하게).
  netHitbox() {
    if (this.swingT < 0.03 || this.swingT > 0.25) return null;
    const cx = this.x + this.w / 2;
    const reach = 54;
    return {
      x: this.facing > 0 ? cx - 6 : cx - reach + 6,
      y: this.y - 32,
      w: reach,
      h: this.h + 36,
    };
  }

  update(dt, input, level) {
    let dir = 0;
    if (this.stun > 0) this.stun -= dt;
    else dir = (input.held('right') ? 1 : 0) - (input.held('left') ? 1 : 0);

    if (dir !== 0) {
      this.facing = dir;
      this.vx = approach(this.vx, dir * MAX_SPEED, (this.onGround ? ACCEL_GROUND : ACCEL_AIR) * dt);
    } else if (this.stun <= 0) {
      this.vx = approach(this.vx, 0, (this.onGround ? FRICTION : AIR_DRAG) * dt);
    }

    // 점프
    this.buffer = input.pressed('jump') ? BUFFER : this.buffer - dt;
    this.coyote = this.onGround ? COYOTE : this.coyote - dt;
    let jumped = false;
    if (this.buffer > 0 && this.coyote > 0) {
      this.vy = -JUMP_V;
      this.buffer = 0;
      this.coyote = 0;
      this.onGround = false;
      this.platform = null;
      this.jumping = true;
      jumped = true;
    }
    if (this.jumping && !input.held('jump') && this.vy < -JUMP_CUT) this.vy = -JUMP_CUT;
    this.vy = Math.min(this.vy + GRAVITY * dt, MAX_FALL);

    // 잠자리채
    let swung = false;
    this.swingCd -= dt;
    if (input.pressed('net') && this.swingCd <= 0) {
      this.swingT = 0;
      this.swingCd = SWING_COOLDOWN;
      swung = true;
    } else if (this.swingT >= 0) {
      this.swingT += dt;
      if (this.swingT > SWING_TIME) this.swingT = -1;
    }

    // 이동 + 충돌 (움직이는 발판 위에 있으면 같이 실려 간다)
    const carry = this.platform ? this.platform.dx : 0;
    const prevBottom = this.y + this.h;
    moveBody(this, level, dt, carry);
    this.platform = null;
    if (this.vy >= 0) {
      for (const p of level.platforms) {
        if (
          this.x + this.w > p.x + 2 &&
          this.x < p.x + p.w - 2 &&
          prevBottom <= p.y + 4 &&
          this.y + this.h >= p.y
        ) {
          this.y = p.y - this.h;
          this.vy = 0;
          this.onGround = true;
          this.platform = p;
          break;
        }
      }
    }
    if (this.x < 0) this.x = 0;

    if (this.vy >= 0) this.jumping = false;
    if (this.invuln > 0) this.invuln -= dt;
    this.run += Math.abs(this.vx) * dt * 0.09;
    return { jumped, swung };
  }
}
