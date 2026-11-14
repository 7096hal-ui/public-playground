import { T } from './levels.js';

// 타일맵과 충돌하며 몸체(b: x, y, w, h, vx, vy)를 움직인다.
// x축, y축을 따로 처리한다. 벽에 부딪혔으면 true를 돌려준다.
export function moveBody(b, level, dt, extraDx = 0) {
  let hitX = false;
  const dx = b.vx * dt + extraDx;
  b.x += dx;
  const y0 = Math.floor(b.y / T);
  const y1 = Math.floor((b.y + b.h - 0.01) / T);
  if (dx > 0) {
    const tx = Math.floor((b.x + b.w - 0.01) / T);
    for (let ty = y0; ty <= y1; ty++) {
      if (level.isSolid(tx, ty)) {
        b.x = tx * T - b.w;
        hitX = true;
        break;
      }
    }
  } else if (dx < 0) {
    const tx = Math.floor(b.x / T);
    for (let ty = y0; ty <= y1; ty++) {
      if (level.isSolid(tx, ty)) {
        b.x = (tx + 1) * T;
        hitX = true;
        break;
      }
    }
  }
  if (hitX) b.vx = 0;

  b.y += b.vy * dt;
  b.onGround = false;
  const x0 = Math.floor(b.x / T);
  const x1 = Math.floor((b.x + b.w - 0.01) / T);
  if (b.vy > 0) {
    const ty = Math.floor((b.y + b.h - 0.01) / T);
    for (let tx = x0; tx <= x1; tx++) {
      if (level.isSolid(tx, ty)) {
        b.y = ty * T - b.h;
        b.vy = 0;
        b.onGround = true;
        break;
      }
    }
  } else if (b.vy < 0) {
    const ty = Math.floor(b.y / T);
    for (let tx = x0; tx <= x1; tx++) {
      if (level.isSolid(tx, ty)) {
        b.y = (ty + 1) * T;
        b.vy = 0;
        break;
      }
    }
  }
  return hitX;
}

export function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function circleRect(cx, cy, r, rc) {
  const nx = Math.max(rc.x, Math.min(cx, rc.x + rc.w));
  const ny = Math.max(rc.y, Math.min(cy, rc.y + rc.h));
  const dx = cx - nx;
  const dy = cy - ny;
  return dx * dx + dy * dy < r * r;
}
