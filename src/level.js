import { T, ROWS } from './levels.js';
import { Flyer, Chestnut, SpikeBall, Platform, Checkpoint, Goal } from './entities.js';

const SOLID = new Set(['#', 'B']);

// 스테이지 정의(levels.js)로부터 실제 플레이할 스테이지를 만든다.
export class Level {
  constructor(def) {
    this.name = def.name;
    this.cols = def.width;
    this.rows = ROWS;
    this.grid = def.grid.map((row) => row.slice());
    this.pixelW = this.cols * T;
    this.pixelH = ROWS * T;
    this.start = def.start;
    this.flyers = def.flyers.map((f) => new Flyer(f));
    this.chestnuts = def.chestnuts.map((c) => new Chestnut(c));
    this.spikeBalls = def.spikeBalls.map((s) => new SpikeBall(s));
    this.platforms = def.platforms.map((p) => new Platform(p));
    this.checkpoints = def.checkpoints.map((c) => new Checkpoint(c));
    this.goal = new Goal(def.goal);
    this.totalFlyers = this.flyers.length;
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
    for (const s of this.spikeBalls) s.update(dt);
    for (const c of this.chestnuts) c.update(dt, this);
    const px = player.x + player.w / 2;
    const py = player.y + player.h / 2;
    for (const f of this.flyers) f.update(dt, px, py);
    this.flyers = this.flyers.filter((f) => !f.gone);
    this.chestnuts = this.chestnuts.filter((c) => !c.gone);
  }
}
