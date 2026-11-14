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
const ZIP_MIN = 190; // 짚라인 최저 속도
const ZIP_MAX = 520;
const VENT_LIFT = 3400; // 상승 기류가 밀어 올리는 힘
const VENT_MAX_UP = 380;

// 아이템 지속 시간(초)
export const POWER_TIME = { net: 12, wings: 15, magnet: 12 };

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
    this.zip = null; // 짚라인에 매달려 있으면 { line, s, v }
    this.zipCd = 0;
    this.inVent = false;
    this.airJumpUsed = false;
    this.bigNet = 0;
    this.wings = 0;
    this.magnet = 0;
  }

  get swingProgress() {
    return this.swingT < 0 ? -1 : this.swingT / SWING_TIME;
  }

  get netReach() {
    return this.bigNet > 0 ? 92 : 54;
  }

  // 잠자리채가 휘둘러지는 동안의 판정 영역(넉넉하게).
  netHitbox(force = false) {
    if (!force && (this.swingT < 0.03 || this.swingT > 0.25)) return null;
    const cx = this.x + this.w / 2;
    const reach = this.netReach;
    const up = this.bigNet > 0 ? 58 : 32;
    return {
      x: this.facing > 0 ? cx - 6 : cx - reach + 6,
      y: this.y - up,
      w: reach,
      h: this.h + up + 4,
    };
  }

  // 한 프레임 진행. 일어난 일을 ev에 담아 돌려준다.
  update(dt, input, level) {
    const ev = { jumped: false, airJump: false, swung: false, sprung: null, zipStart: false, zipEnd: false };
    let dir = 0;
    if (this.stun > 0) this.stun -= dt;
    else dir = (input.held('right') ? 1 : 0) - (input.held('left') ? 1 : 0);
    for (const k of ['bigNet', 'wings', 'magnet']) if (this[k] > 0) this[k] -= dt;
    if (this.zipCd > 0) this.zipCd -= dt;

    // 잠자리채
    this.swingCd -= dt;
    if (input.pressed('net') && this.swingCd <= 0) {
      this.swingT = 0;
      this.swingCd = SWING_COOLDOWN;
      ev.swung = true;
    } else if (this.swingT >= 0) {
      this.swingT += dt;
      if (this.swingT > SWING_TIME) this.swingT = -1;
    }

    // 짚라인에 매달린 동안은 줄을 따라 미끄러진다
    if (this.zip) {
      this.rideZip(dt, input, ev);
      this.finish(dt);
      return ev;
    }

    if (dir !== 0) {
      this.facing = dir;
      this.vx = approach(this.vx, dir * MAX_SPEED, (this.onGround ? ACCEL_GROUND : ACCEL_AIR) * dt);
    } else if (this.stun <= 0) {
      this.vx = approach(this.vx, 0, (this.onGround ? FRICTION : AIR_DRAG) * dt);
    }

    // 점프 (돼지 날개가 있으면 공중에서 한 번 더)
    this.buffer = input.pressed('jump') ? BUFFER : this.buffer - dt;
    this.coyote = this.onGround ? COYOTE : this.coyote - dt;
    if (this.onGround) this.airJumpUsed = false;
    if (this.buffer > 0 && this.coyote > 0) {
      this.vy = -JUMP_V;
      this.buffer = 0;
      this.coyote = 0;
      this.onGround = false;
      this.platform = null;
      this.jumping = true;
      ev.jumped = true;
    } else if (input.pressed('jump') && !this.onGround && this.wings > 0 && !this.airJumpUsed && this.stun <= 0) {
      this.vy = -JUMP_V * 0.92;
      this.buffer = 0;
      this.airJumpUsed = true;
      this.jumping = true;
      ev.airJump = true;
    }
    if (this.jumping && !input.held('jump') && this.vy < -JUMP_CUT) this.vy = -JUMP_CUT;
    this.vy = Math.min(this.vy + GRAVITY * dt, MAX_FALL);

    // 환풍구 상승 기류
    this.inVent = false;
    for (const v of level.vents) {
      if (v.contains(this)) {
        const feet = this.y + this.h;
        const k = Math.max(0, Math.min(1, (feet - v.top) / 70));
        this.vy = Math.max(this.vy - VENT_LIFT * k * dt, -VENT_MAX_UP);
        this.inVent = true;
        this.jumping = false;
      }
    }

    // 이동 + 충돌 (움직이는 발판 위에 있으면 같이 실려 간다)
    const support = this.platform;
    if (support) this.y += support.dy;
    const carry = support ? support.dx : 0;
    const prevBottom = this.y + this.h;
    moveBody(this, level, dt, carry);
    this.platform = null;
    if (this.vy >= 0) {
      for (const p of level.platforms) {
        if (!p.solid) continue;
        if (
          this.x + this.w > p.x + 2 &&
          this.x < p.x + p.w - 2 &&
          prevBottom <= p.y + 4 + Math.max(0, p.dy) &&
          this.y + this.h >= p.y
        ) {
          this.y = p.y - this.h;
          this.vy = 0;
          this.onGround = true;
          this.platform = p;
          if (p.kind === 'crumble') p.touched = true;
          break;
        }
      }
    }

    // 트램펄린: 내려오는 중에 발이 닿으면 튕겨 오른다
    if (this.vy >= 0) {
      for (const s of level.springs) {
        if (this.x + this.w > s.x && this.x < s.x + s.w && this.y + this.h >= s.y && this.y + this.h <= s.y + s.h + 18) {
          this.vy = -s.power;
          this.y = s.y - this.h;
          this.onGround = false;
          this.platform = null;
          this.jumping = false;
          this.coyote = 0;
          this.airJumpUsed = false;
          s.squash = 1;
          ev.sprung = s;
          break;
        }
      }
    }

    // 짚라인 잡기: 공중에서 손(머리 위)이 줄에 닿으면 매달린다
    if (!this.onGround && this.zipCd <= 0 && this.stun <= 0) {
      const hx = this.x + this.w / 2;
      const hy = this.y - 6;
      for (const z of level.ziplines) {
        const n = z.nearest(hx, hy);
        if (n.d < 16 && n.s < z.len - 24) {
          const along = this.vx * z.ux + this.vy * z.uy;
          this.zip = { line: z, s: n.s, v: Math.max(ZIP_MIN, along) };
          this.platform = null;
          this.jumping = false;
          ev.zipStart = true;
          this.placeOnZip();
          break;
        }
      }
    }

    if (this.x < 0) this.x = 0;
    if (this.vy >= 0) this.jumping = false;
    this.finish(dt);
    return ev;
  }

  rideZip(dt, input, ev) {
    const z = this.zip;
    const line = z.line;
    z.v = Math.min(ZIP_MAX, Math.max(ZIP_MIN, z.v + GRAVITY * line.uy * 0.55 * dt));
    z.s += z.v * dt;
    this.facing = line.ux >= 0 ? 1 : -1;
    const letGo = input.pressed('jump');
    if (z.s >= line.len || letGo) {
      z.s = Math.min(z.s, line.len);
      this.placeOnZip();
      this.vx = Math.max(-MAX_SPEED * 1.4, Math.min(MAX_SPEED * 1.4, line.ux * z.v));
      this.vy = letGo ? -JUMP_V * 0.85 : Math.max(-200, line.uy * z.v);
      this.jumping = letGo;
      this.zip = null;
      this.zipCd = 0.35;
      ev.zipEnd = true;
      if (letGo) ev.jumped = true;
      return;
    }
    this.placeOnZip();
    this.vx = line.ux * z.v;
    this.vy = 0;
  }

  // 손이 줄에 걸리도록 몸 위치를 맞춘다
  placeOnZip() {
    const p = this.zip.line.point(this.zip.s);
    this.x = p.x - this.w / 2;
    this.y = p.y + 10;
    this.onGround = false;
  }

  finish(dt) {
    if (this.invuln > 0) this.invuln -= dt;
    this.run += Math.abs(this.vx) * dt * 0.09;
  }
}
