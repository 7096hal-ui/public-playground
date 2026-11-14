// 대왕 고추: 마지막 스테이지의 우두머리. (판정은 2D, 화면과 상관없는 순수 계산)
// 흐름: 등장 → [떠다니며 고추씨 뿌리기 → 노려보기 → 내리꽂기 → 바닥에 박혀 어질어질(이때만 잡을 수 있음) → 다시 날아오르기]
//       체력이 줄면 옆으로 돌진도 하고, 점점 빨라진다. 체력이 0이 되면 작아져서 보통 고추가 된다.
import { T } from './levels.js';

const HOVER_Y = 120;

export class Boss {
  constructor(level) {
    this.level = level;
    this.left = 2 * T;
    this.right = level.pixelW - 2 * T;
    this.ground = 11 * T; // 헬기장 바닥
    this.maxHp = 10;
    this.hp = this.maxHp;
    this.x = level.pixelW * 0.62;
    this.y = -160;
    this.r = 38;
    this.scale = 3.1;
    this.facing = -1;
    this.state = 'intro';
    this.t = 0;
    this.time = 0;
    this.flash = 0;
    this.inv = 0;
    this.spin = 0;
    this.seeds = [];
    this.seedT = 0;
    this.minionT = 4;
    this.dives = 0;
    this.targetX = this.x;
    this.events = [];
    this.vx = 0;
  }

  get phase() {
    return this.hp > 6 ? 1 : this.hp > 3 ? 2 : 3;
  }

  set(state) {
    this.state = state;
    this.t = 0;
  }

  emit(e) {
    this.events.push(e);
  }

  update(dt, player) {
    this.time += dt;
    this.t += dt;
    if (this.flash > 0) this.flash -= dt;
    if (this.inv > 0) this.inv -= dt;
    const ph = this.phase;
    const px = player.x + player.w / 2;
    const speedK = [1, 1, 1.2, 1.4][ph];

    switch (this.state) {
      case 'intro': {
        this.y += (HOVER_Y - this.y) * Math.min(1, dt * 1.6);
        if (this.t > 2.2) {
          this.emit('roar');
          this.set('float');
        }
        break;
      }
      case 'float': {
        // 주인공 머리 위를 맴돌며 고추씨를 뿌린다
        const cx = Math.max(this.left + 80, Math.min(this.right - 80, px + Math.sin(this.time * 0.8) * 160));
        this.vx = (cx - this.x) * 1.4 * speedK;
        this.x += this.vx * dt;
        this.y += (HOVER_Y + Math.sin(this.time * 2.1) * 18 - this.y) * Math.min(1, dt * 3);
        this.facing = px < this.x ? -1 : 1;
        this.seedT -= dt;
        if (this.seedT <= 0) {
          this.seedT = [0, 1.8, 1.5, 1.25][ph];
          this.throwSeeds(ph);
        }
        this.minionT -= dt;
        if (ph >= 2 && this.minionT <= 0) {
          this.minionT = 7;
          this.emit('minion');
        }
        if (this.t > [0, 4.2, 3.6, 3.0][ph]) {
          const charge = ph >= 2 && this.dives % 2 === 1;
          this.set(charge ? 'chargeAim' : 'aim');
          this.targetX = px;
        }
        break;
      }
      case 'aim': {
        // 부르르 떨며 노려본다 (피할 시간)
        this.targetX += (px - this.targetX) * Math.min(1, dt * 2);
        this.facing = this.targetX < this.x ? -1 : 1;
        if (this.t > [0, 0.9, 0.75, 0.6][ph]) {
          this.emit('dive');
          this.set('dive');
          const dx = this.targetX - this.x;
          const dy = this.ground - this.r * 0.55 - this.y;
          const len = Math.hypot(dx, dy);
          const sp = 620 * speedK;
          this.dvx = (dx / len) * sp;
          this.dvy = (dy / len) * sp;
        }
        break;
      }
      case 'dive': {
        this.x += this.dvx * dt;
        this.y += this.dvy * dt;
        this.x = Math.max(this.left, Math.min(this.right, this.x));
        if (this.y >= this.ground - this.r * 0.55) {
          this.y = this.ground - this.r * 0.55;
          this.emit('thud');
          this.dives++;
          this.set('dizzy');
        }
        break;
      }
      case 'dizzy': {
        if (this.t > [0, 2.6, 2.2, 1.8][ph]) {
          this.emit('rise');
          this.set('rise');
        }
        break;
      }
      case 'rise': {
        this.y += (HOVER_Y - this.y) * Math.min(1, dt * 3.5);
        if (this.t > 0.8) this.set('float');
        break;
      }
      case 'chargeAim': {
        // 한쪽 끝으로 가서 머리 높이로 내려온다
        const side = px < (this.left + this.right) / 2 ? this.right - 40 : this.left + 40;
        this.x += (side - this.x) * Math.min(1, dt * 3);
        this.y += (this.ground - 34 - this.y) * Math.min(1, dt * 3);
        this.facing = side > (this.left + this.right) / 2 ? -1 : 1;
        if (this.t > 1.3) {
          this.emit('dive');
          this.set('charge');
          this.dvx = this.facing * 560 * speedK;
        }
        break;
      }
      case 'charge': {
        this.x += this.dvx * dt;
        if (this.x <= this.left || this.x >= this.right) {
          this.x = Math.max(this.left, Math.min(this.right, this.x));
          this.emit('thud');
          this.dives++;
          this.set('dizzy');
          this.y = this.ground - this.r * 0.55;
        }
        break;
      }
      case 'defeat': {
        this.spin += dt * (6 + this.t * 10);
        this.scale = Math.max(1, 3.1 - this.t * 1.1);
        this.y += (this.ground - 140 - this.y) * Math.min(1, dt * 2);
        if (this.t > 1.9) {
          this.emit('pop');
          this.set('gone');
        }
        break;
      }
      default:
        break;
    }

    // 고추씨
    for (const sd of this.seeds) {
      sd.vy += 420 * dt;
      sd.x += sd.vx * dt;
      sd.y += sd.vy * dt;
      if (sd.y > this.ground - 4) {
        sd.dead = true;
        this.emit('seedHit');
      }
    }
    this.seeds = this.seeds.filter((s) => !s.dead && s.x > -50 && s.x < this.level.pixelW + 50);
  }

  throwSeeds(ph) {
    const n = ph + 1;
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (i - (n - 1) / 2) * 0.5;
      this.seeds.push({ x: this.x, y: this.y + 20, vx: Math.cos(a) * 150 + this.vx * 0.3, vy: -80 - Math.random() * 60, dead: false });
    }
    this.emit('seed');
  }

  get vulnerable() {
    return this.state === 'dizzy' && this.inv <= 0;
  }

  // 잠자리채에 맞음
  hit() {
    if (!this.vulnerable) return false;
    this.hp--;
    this.flash = 0.4;
    this.inv = 0.6;
    this.emit('hit');
    if (this.hp <= 0) {
      this.seeds = [];
      this.emit('defeat');
      this.set('defeat');
    }
    return true;
  }

  // 닿으면 아픈 원들 (몸통 + 고추씨). 어지러울 때와 쓰러질 때 몸통은 안전.
  hazards() {
    const out = this.seeds.map((s) => ({ x: s.x, y: s.y, r: 6 }));
    const safe = this.state === 'dizzy' || this.state === 'defeat' || this.state === 'gone' || this.state === 'intro';
    if (!safe) out.push({ x: this.x, y: this.y, r: this.r * 0.8 });
    return out;
  }
}
