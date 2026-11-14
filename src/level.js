import { T, ROWS } from './levels.js';
import { Flyer, Pigeon, WreckingBall, Platform, Checkpoint, Goal } from './entities.js';

const SOLID = new Set(['#', 'B', 'A']);
const WALLS = 6; // 건물 외벽 색 종류 수

// 스테이지 정의(levels.js)로부터 실제 플레이할 스테이지를 만든다.
export class Level {
  constructor(def) {
    this.name = def.name;
    this.theme = def.theme;
    this.cols = def.width;
    this.rows = ROWS;
    this.grid = def.grid.map((row) => row.slice());
    this.pixelW = this.cols * T;
    this.pixelH = ROWS * T;
    this.start = def.start;
    this.flyers = def.flyers.map((f) => new Flyer(f));
    this.pigeons = def.pigeons.map((c) => new Pigeon(c));
    this.wreckingBalls = def.wreckingBalls.map((s) => new WreckingBall(s));
    this.platforms = def.platforms.map((p) => new Platform(p));
    this.checkpoints = def.checkpoints.map((c) => new Checkpoint(c));
    this.goal = new Goal(def.goal);
    this.totalFlyers = this.flyers.length;

    // 맨 아래 줄까지 이어진 칸들을 한 채의 건물로 보고, 건물마다 외벽 색을 정한다.
    this.wall = new Array(this.cols).fill(0);
    let id = 0;
    for (let x = 0; x < this.cols; x++) {
      const solid = this.grid[ROWS - 1][x] === '#';
      if (solid && (x === 0 || this.grid[ROWS - 1][x - 1] !== '#')) id++;
      this.wall[x] = (id * 7 + 3) % WALLS;
    }
  }

  tile(tx, ty) {
    if (ty < 0 || ty >= ROWS || tx < 0 || tx >= this.cols) return ' ';
    return this.grid[ty][tx];
  }

  // 스테이지 좌우 끝은 벽, 위아래는 뚫려 있다(아래로 떨어지면 구덩이).
  isSolid(tx, ty) {
    if (tx < 0 || tx >= this.cols) return true;
    if (ty < 0 || ty >= ROWS) return false;
    return SOLID.has(this.grid[ty][tx]);
  }

  update(dt, player) {
    for (const p of this.platforms) p.update(dt);
    for (const s of this.wreckingBalls) s.update(dt);
    for (const c of this.pigeons) c.update(dt, this);
    const px = player.x + player.w / 2;
    const py = player.y + player.h / 2;
    for (const f of this.flyers) f.update(dt, px, py);
    this.flyers = this.flyers.filter((f) => !f.gone);
    this.pigeons = this.pigeons.filter((c) => !c.gone);
  }
}
