// 모든 그림은 이미지 파일 없이 캔버스 도형으로 그린다.
import { T, GROUND } from './levels.js';

const FONT = '"Jua", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';

export function text(ctx, str, x, y, o = {}) {
  const { size = 20, color = '#fff', stroke = '#3a2340', align = 'center', baseline = 'middle' } = o;
  ctx.font = `${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  ctx.lineJoin = 'round';
  if (stroke) {
    ctx.lineWidth = Math.max(2, size * 0.22);
    ctx.strokeStyle = stroke;
    ctx.strokeText(str, x, y);
  }
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
}

export function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function circle(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
}

function line(ctx, x0, y0, x1, y1) {
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
}

function hash(x, y) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// ───────────────────────── 배경 ─────────────────────────

function cloud(ctx, x, y, s) {
  ctx.fillStyle = '#ffffff';
  circle(ctx, x, y, 16 * s);
  ctx.fill();
  circle(ctx, x + 20 * s, y - 9 * s, 21 * s);
  ctx.fill();
  circle(ctx, x + 42 * s, y, 16 * s);
  ctx.fill();
  roundRect(ctx, x - 6 * s, y - 4 * s, 60 * s, 20 * s, 10 * s);
  ctx.fill();
  ctx.fillStyle = 'rgba(160, 205, 235, 0.35)';
  roundRect(ctx, x, y + 9 * s, 48 * s, 6 * s, 3 * s);
  ctx.fill();
}

function hills(ctx, camX, baseY, vw, parallax, spacing, color, light, minR, maxR, seed) {
  const off = camX * parallax;
  const first = Math.floor(off / spacing) - 2;
  const last = first + Math.ceil(vw / spacing) + 4;
  for (let i = first; i <= last; i++) {
    const r = minR + hash(i, seed) * (maxR - minR);
    const x = i * spacing - off + hash(i, seed + 1) * spacing * 0.5;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(x, baseY, r, r * 0.8, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = light;
    ctx.beginPath();
    ctx.ellipse(x - r * 0.3, baseY - r * 0.55, r * 0.18, r * 0.1, -0.4, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawBackground(ctx, camX, camY, vw, vh, t) {
  const g = ctx.createLinearGradient(0, 0, 0, vh);
  g.addColorStop(0, '#49b4ff');
  g.addColorStop(1, '#cdf2ff');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, vw, vh);

  const off = camX * 0.15 + t * 8;
  const spacing = 230;
  const first = Math.floor(off / spacing) - 1;
  for (let i = first; i <= first + Math.ceil(vw / spacing) + 2; i++) {
    const y = 40 + hash(i, 7) * 130 - camY;
    cloud(ctx, i * spacing - off, y, 0.8 + hash(i, 8) * 0.6);
  }

  const baseY = GROUND * T - camY;
  hills(ctx, camX, baseY, vw, 0.3, 360, '#93dd7a', '#b7ec9f', 110, 190, 3);
  hills(ctx, camX, baseY, vw, 0.55, 260, '#5fc54d', '#86dc6f', 60, 110, 5);
}

// ───────────────────────── 타일 ─────────────────────────

export function drawTiles(ctx, level, x0, x1) {
  const c0 = Math.max(0, Math.floor(x0 / T) - 1);
  const c1 = Math.min(level.cols - 1, Math.floor(x1 / T) + 1);
  for (let ty = 0; ty < level.rows; ty++) {
    for (let tx = c0; tx <= c1; tx++) {
      const ch = level.grid[ty][tx];
      if (ch === ' ') continue;
      const px = tx * T;
      const py = ty * T;
      if (ch === '#') drawGround(ctx, level, tx, ty, px, py);
      else if (ch === 'B') drawBrick(ctx, px, py);
      else if (ch === '^') drawSpikes(ctx, px, py);
    }
  }
}

function drawGround(ctx, level, tx, ty, px, py) {
  ctx.fillStyle = '#cd7d3f';
  ctx.fillRect(px, py, T, T);
  ctx.fillStyle = '#a95f28';
  for (let k = 0; k < 3; k++) {
    const sx = px + 3 + hash(tx * 3 + k, ty) * (T - 9);
    const sy = py + 10 + hash(tx, ty * 5 + k) * (T - 14);
    ctx.fillRect(Math.round(sx), Math.round(sy), 5, 3);
  }
  if (!level.isSolid(tx - 1, ty) || tx === 0) {
    ctx.fillStyle = '#8f4d1e';
    ctx.fillRect(px, py, 2, T);
  }
  if (!level.isSolid(tx + 1, ty) || tx === level.cols - 1) {
    ctx.fillStyle = '#8f4d1e';
    ctx.fillRect(px + T - 2, py, 2, T);
  }
  if (!level.isSolid(tx, ty - 1)) {
    ctx.fillStyle = '#5fcf3f';
    ctx.fillRect(px, py, T, 8);
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.arc(px + 4 + i * 8, py + 8, 4, 0, Math.PI);
      ctx.fill();
    }
    ctx.fillStyle = '#9af07a';
    ctx.fillRect(px, py, T, 3);
  }
}

function drawBrick(ctx, px, py) {
  ctx.fillStyle = '#dc7b3c';
  ctx.fillRect(px, py, T, T);
  ctx.fillStyle = '#f5a46c';
  ctx.fillRect(px + 1, py + 1, T - 2, 3);
  ctx.fillStyle = '#7d3713';
  ctx.fillRect(px, py + 15, T, 2);
  ctx.fillRect(px + 15, py, 2, 15);
  ctx.fillRect(px + 7, py + 17, 2, 15);
  ctx.fillRect(px + 23, py + 17, 2, 15);
  ctx.strokeStyle = '#7d3713';
  ctx.lineWidth = 2;
  ctx.strokeRect(px + 1, py + 1, T - 2, T - 2);
}

function drawSpikes(ctx, px, py) {
  const n = 3;
  const w = T / n;
  for (let i = 0; i < n; i++) {
    ctx.beginPath();
    ctx.moveTo(px + i * w, py + T);
    ctx.lineTo(px + i * w + w / 2, py + T - 16);
    ctx.lineTo(px + (i + 1) * w, py + T);
    ctx.closePath();
    ctx.fillStyle = '#e8edf2';
    ctx.fill();
    ctx.strokeStyle = '#6d7680';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

// ───────────────────────── 오브젝트 ─────────────────────────

export function drawPlatform(ctx, p) {
  roundRect(ctx, p.x, p.y, p.w, p.h, 4);
  ctx.fillStyle = '#c98d4c';
  ctx.fill();
  ctx.strokeStyle = '#6e4119';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#e3b077';
  ctx.fillRect(p.x + 3, p.y + 2, p.w - 6, 2);
  ctx.strokeStyle = '#8a5526';
  ctx.lineWidth = 1;
  for (let x = p.x + 24; x < p.x + p.w - 4; x += 24) line(ctx, x, p.y + 3, x, p.y + p.h - 2);
  ctx.fillStyle = '#5b3a1c';
  circle(ctx, p.x + 6, p.y + 7, 1.5);
  ctx.fill();
  circle(ctx, p.x + p.w - 6, p.y + 7, 1.5);
  ctx.fill();
}

export function drawCheckpoint(ctx, cp, t) {
  ctx.strokeStyle = '#8b939c';
  ctx.lineWidth = 3;
  line(ctx, cp.x, cp.y, cp.x, cp.y - 62);
  ctx.fillStyle = cp.active ? '#ffd23f' : '#c7ccd1';
  circle(ctx, cp.x, cp.y - 64, 4);
  ctx.fill();
  const wave = Math.sin(t * 6) * 2;
  ctx.beginPath();
  ctx.moveTo(cp.x + 1, cp.y - 60);
  ctx.quadraticCurveTo(cp.x + 14, cp.y - 58 + wave, cp.x + 26, cp.y - 52 + wave);
  ctx.lineTo(cp.x + 1, cp.y - 42);
  ctx.closePath();
  ctx.fillStyle = cp.active ? '#ff6fa3' : '#f2f2f2';
  ctx.fill();
  ctx.strokeStyle = cp.active ? '#b23a6b' : '#9aa1a8';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

export function drawGoal(ctx, g, t) {
  const top = g.y - 6 * T;
  ctx.fillStyle = '#7d3713';
  ctx.fillRect(g.x - 12, g.y - 12, 24, 12);
  ctx.strokeStyle = '#2f9e44';
  ctx.lineWidth = 5;
  line(ctx, g.x, g.y - 12, g.x, top);
  ctx.fillStyle = '#ffd23f';
  circle(ctx, g.x, top - 6, 7);
  ctx.fill();
  ctx.strokeStyle = '#b8860b';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  const wave = Math.sin(t * 5) * 3;
  ctx.beginPath();
  ctx.moveTo(g.x + 2, top + 4);
  ctx.quadraticCurveTo(g.x + 26, top + 2 + wave, g.x + 50, top + 8 + wave);
  ctx.lineTo(g.x + 50, top + 38 + wave);
  ctx.quadraticCurveTo(g.x + 26, top + 32 + wave, g.x + 2, top + 34);
  ctx.closePath();
  ctx.fillStyle = '#ff6fa3';
  ctx.fill();
  ctx.strokeStyle = '#b23a6b';
  ctx.lineWidth = 2;
  ctx.stroke();
  text(ctx, '골!', g.x + 26, top + 20 + wave * 0.6, { size: 16, stroke: '#b23a6b' });
}

export function drawChestnut(ctx, c, t) {
  const cx = c.x + c.w / 2;
  const cy = c.y + c.h / 2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.save();
  ctx.rotate(c.rot);
  ctx.fillStyle = '#5f7f1f';
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a - 0.18) * 10, Math.sin(a - 0.18) * 10);
    ctx.lineTo(Math.cos(a) * 16, Math.sin(a) * 16);
    ctx.lineTo(Math.cos(a + 0.18) * 10, Math.sin(a + 0.18) * 10);
    ctx.fill();
  }
  ctx.restore();
  circle(ctx, 0, 0, 11.5);
  ctx.fillStyle = '#9cc43f';
  ctx.fill();
  ctx.strokeStyle = '#4d6b1a';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  const look = c.vx > 0 ? 1.5 : -1.5;
  ctx.fillStyle = '#fff';
  circle(ctx, -4, -1, 3.4);
  ctx.fill();
  circle(ctx, 4, -1, 3.4);
  ctx.fill();
  ctx.fillStyle = '#222';
  circle(ctx, -4 + look, 0, 1.7);
  ctx.fill();
  circle(ctx, 4 + look, 0, 1.7);
  ctx.fill();
  ctx.strokeStyle = '#222';
  ctx.lineWidth = 2;
  line(ctx, -7.5, -6, -1.5, -3.5);
  line(ctx, 7.5, -6, 1.5, -3.5);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 7 + Math.sin(t * 10) * 0.5, 3, Math.PI * 1.15, Math.PI * 1.85);
  ctx.stroke();
  ctx.restore();
}

export function drawSpikeBall(ctx, s) {
  ctx.strokeStyle = '#7a828c';
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 3]);
  line(ctx, s.x, s.anchorY, s.x, s.y - s.r);
  ctx.setLineDash([]);
  ctx.fillStyle = '#5b616b';
  ctx.fillRect(s.x - 8, s.anchorY - 6, 16, 6);
  ctx.fillStyle = '#8a9099';
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(s.x + Math.cos(a - 0.25) * 11, s.y + Math.sin(a - 0.25) * 11);
    ctx.lineTo(s.x + Math.cos(a) * 19, s.y + Math.sin(a) * 19);
    ctx.lineTo(s.x + Math.cos(a + 0.25) * 11, s.y + Math.sin(a + 0.25) * 11);
    ctx.fill();
  }
  const g = ctx.createRadialGradient(s.x - 4, s.y - 4, 2, s.x, s.y, s.r);
  g.addColorStop(0, '#9aa2ad');
  g.addColorStop(1, '#4a4f57');
  circle(ctx, s.x, s.y, s.r);
  ctx.fillStyle = g;
  ctx.fill();
}

// 날아다니는 고추: 기다란 몸통 + 동글동글 두 알 + 날개 + 웃는 얼굴.
export function drawFlyer(ctx, x, y, o = {}) {
  const { facing = 1, flap = 0, panic = false, t = 0, scale = 1, alpha = 1, spin = 0 } = o;
  const SKIN = '#f8c3a8';
  const SKIN_D = '#eea385';
  const LINE = '#b4664f';
  const w = Math.abs(Math.sin(flap));
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.scale(facing * scale, scale);
  ctx.rotate(-0.18 + Math.sin(t * 3) * 0.1 + spin);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  wing(ctx, -2, -6, w, '#e3f1ff');

  ctx.fillStyle = SKIN_D;
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 1.4;
  circle(ctx, -12, 5, 6.5);
  ctx.fill();
  ctx.stroke();
  circle(ctx, -5, 7, 6.5);
  ctx.fill();
  ctx.stroke();

  roundRect(ctx, -13, -6.5, 31, 13, 6.5);
  ctx.fillStyle = SKIN;
  ctx.fill();
  ctx.stroke();

  const er = panic ? 3.4 : 2.8;
  ctx.fillStyle = '#fff';
  circle(ctx, 8.5, -1.5, er);
  ctx.fill();
  circle(ctx, 14.3, -1.5, er);
  ctx.fill();
  ctx.fillStyle = '#222';
  const pr = panic ? 1 : 1.5;
  circle(ctx, 9.2, -1.3, pr);
  ctx.fill();
  circle(ctx, 15, -1.3, pr);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 110, 130, 0.5)';
  circle(ctx, 5.5, 2.8, 1.8);
  ctx.fill();
  if (panic) {
    ctx.fillStyle = '#7a3030';
    circle(ctx, 12.2, 3.6, 1.6);
    ctx.fill();
    ctx.fillStyle = '#7fc8ff';
    ctx.beginPath();
    ctx.moveTo(1, -14);
    ctx.quadraticCurveTo(4, -9, 1, -8);
    ctx.quadraticCurveTo(-2, -9, 1, -14);
    ctx.fill();
  } else {
    ctx.strokeStyle = '#7a3030';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(12, 1.8, 2.2, Math.PI * 0.15, Math.PI * 0.85);
    ctx.stroke();
  }

  wing(ctx, 2, -7, w, '#ffffff');
  ctx.restore();
}

function wing(ctx, x, y, w, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.5);
  ctx.scale(1, 0.25 + 0.75 * w);
  ctx.beginPath();
  ctx.ellipse(0, -8, 5, 9, 0, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = '#8fb7d0';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.restore();
}

// 주인공 꿀꿀이: 돼지 인형옷 + 굵은 눈썹의 개구쟁이 얼굴 + 곤충 더듬이 + 잠자리채.
// (x, y)는 발밑 중앙.
export function drawHero(ctx, x, y, o = {}) {
  const { facing = 1, run = 0, air = false, moving = false, swing = -1, blink = false, t = 0, hurt = false } = o;
  const PINK = '#f9a8bd';
  const PINK_D = '#c9607e';
  const PINK_L = '#fdd3de';
  const SKIN = '#ffdcb8';
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(facing, 1);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  const walking = moving && !air;
  const step = walking ? Math.sin(run * 6) : 0;
  const bob = walking ? -Math.abs(Math.cos(run * 6)) * 1.5 : 0;

  // 꼬리
  ctx.strokeStyle = PINK_D;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(-13, -13 + bob, 3, 0.2, Math.PI * 1.8);
  ctx.stroke();

  // 다리 (발굽)
  const leg = (lx, lift) => {
    roundRect(ctx, lx - 3, -8 - lift, 6, 8, 2);
    ctx.fillStyle = PINK;
    ctx.fill();
    ctx.strokeStyle = PINK_D;
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.fillStyle = '#8a4a5a';
    roundRect(ctx, lx - 3, -3 - lift, 6, 3, 1);
    ctx.fill();
  };
  leg(-4 + (air ? -1 : step * 3), air ? 3 : 0);
  leg(4 - (air ? -1 : step * 3), air ? 2 : 0);

  // 몸통
  ctx.beginPath();
  ctx.ellipse(0, -13 + bob, 10, 8.5, 0, 0, Math.PI * 2);
  ctx.fillStyle = PINK;
  ctx.fill();
  ctx.strokeStyle = PINK_D;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(2, -12 + bob, 5.5, 4.5, 0, 0, Math.PI * 2);
  ctx.fillStyle = PINK_L;
  ctx.fill();

  ctx.save();
  ctx.translate(0, bob);

  // 더듬이
  const wob = Math.sin(t * 7) * 1.5;
  ctx.strokeStyle = '#3b2a2a';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(-2, -41);
  ctx.quadraticCurveTo(-6, -49, -8 + wob, -54);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(5, -42);
  ctx.quadraticCurveTo(8, -50, 11 - wob, -55);
  ctx.stroke();
  ctx.fillStyle = '#ffd23f';
  ctx.lineWidth = 1;
  circle(ctx, -8 + wob, -54, 2.7);
  ctx.fill();
  ctx.stroke();
  circle(ctx, 11 - wob, -55, 2.7);
  ctx.fill();
  ctx.stroke();

  // 후드 + 돼지 귀
  circle(ctx, 1, -30, 13.5);
  ctx.fillStyle = PINK;
  ctx.fill();
  ctx.strokeStyle = PINK_D;
  ctx.lineWidth = 1.6;
  ctx.stroke();
  const ear = (pts, inner) => {
    ctx.beginPath();
    ctx.moveTo(...pts[0]);
    ctx.lineTo(...pts[1]);
    ctx.lineTo(...pts[2]);
    ctx.closePath();
    ctx.fillStyle = PINK;
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(...inner[0]);
    ctx.lineTo(...inner[1]);
    ctx.lineTo(...inner[2]);
    ctx.closePath();
    ctx.fillStyle = PINK_L;
    ctx.fill();
  };
  ear([[-11, -35], [-15, -46], [-4, -41]], [[-10, -37], [-13, -43], [-6, -40]]);
  ear([[7, -41], [14, -47], [13, -36]], [[8, -40], [12.5, -44], [12, -38]]);

  // 얼굴
  ctx.beginPath();
  ctx.ellipse(3.5, -29, 9.5, 9, 0, 0, Math.PI * 2);
  ctx.fillStyle = SKIN;
  ctx.fill();
  ctx.strokeStyle = '#d29c74';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // 굵은 눈썹
  ctx.strokeStyle = '#1f1a1a';
  ctx.lineWidth = 3.4;
  line(ctx, -1, -33.5, 3, -34.8);
  line(ctx, 6, -34.8, 10.5, -33.5);

  // 눈
  ctx.fillStyle = '#1f1a1a';
  if (hurt) {
    ctx.lineWidth = 1.3;
    line(ctx, 0.5, -31.5, 3, -29);
    line(ctx, 0.5, -29, 3, -31.5);
    line(ctx, 7, -31.5, 9.5, -29);
    line(ctx, 7, -29, 9.5, -31.5);
  } else if (blink) {
    ctx.lineWidth = 1.4;
    line(ctx, 0.5, -30, 3, -30);
    line(ctx, 7, -30, 9.5, -30);
  } else {
    circle(ctx, 1.8, -30, 1.7);
    ctx.fill();
    circle(ctx, 8.3, -30, 1.7);
    ctx.fill();
  }

  // 볼터치 + 장난스러운 입
  ctx.fillStyle = 'rgba(255, 110, 130, 0.55)';
  circle(ctx, -1.5, -26, 2.2);
  ctx.fill();
  circle(ctx, 11.3, -26, 2.2);
  ctx.fill();
  ctx.strokeStyle = '#7a3030';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  if (hurt) ctx.arc(5.5, -23.5, 2.2, Math.PI * 1.1, Math.PI * 1.9);
  else ctx.arc(5.5, -27.5, 3.3, Math.PI * 0.15, Math.PI * 0.85);
  ctx.stroke();
  ctx.restore();

  // 팔 + 잠자리채
  const sx = 3;
  const sy = -15 + bob;
  let a;
  if (swing >= 0) {
    const e = 1 - Math.pow(1 - Math.min(swing, 1), 3);
    a = -2.3 + e * 2.9;
  } else {
    a = -1.15 + Math.sin(t * 3) * 0.05;
  }
  const dx = Math.cos(a);
  const dy = Math.sin(a);
  const hx = sx + dx * 7;
  const hy = sy + dy * 7;

  if (swing >= 0 && swing < 0.8) {
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.7 * (1 - swing)})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(sx, sy, 37, -2.3, a);
    ctx.stroke();
  }

  ctx.strokeStyle = '#8a5a2b';
  ctx.lineWidth = 2.6;
  line(ctx, hx - dx * 5, hy - dy * 5, hx + dx * 22, hy + dy * 22);

  ctx.save();
  ctx.translate(hx + dx * 30, hy + dy * 30);
  ctx.rotate(a);
  ctx.beginPath();
  ctx.ellipse(0, 0, 8, 9.5, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(120, 140, 160, 0.6)';
  ctx.lineWidth = 0.8;
  for (let i = -1; i <= 1; i++) {
    line(ctx, i * 4, -8.5, i * 4, 8.5);
    line(ctx, -7, i * 4, 7, i * 4);
  }
  ctx.beginPath();
  ctx.ellipse(0, 0, 8, 9.5, 0, 0, Math.PI * 2);
  ctx.strokeStyle = '#4a7fb5';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  ctx.strokeStyle = PINK_D;
  ctx.lineWidth = 5.5;
  line(ctx, sx, sy, hx, hy);
  ctx.strokeStyle = PINK;
  ctx.lineWidth = 4;
  line(ctx, sx, sy, hx, hy);
  ctx.fillStyle = SKIN;
  circle(ctx, hx, hy, 2.6);
  ctx.fill();

  ctx.restore();
}

export function drawHeart(ctx, x, y, s, filled = true) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.beginPath();
  ctx.moveTo(0, 5);
  ctx.bezierCurveTo(-9, -1, -6, -9, 0, -4);
  ctx.bezierCurveTo(6, -9, 9, -1, 0, 5);
  ctx.closePath();
  ctx.fillStyle = filled ? '#ff5d8f' : 'rgba(255,255,255,0.3)';
  ctx.fill();
  ctx.strokeStyle = '#3a2340';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
}

export function drawPanel(ctx, x, y, w, h) {
  roundRect(ctx, x, y, w, h, 16);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.93)';
  ctx.fill();
  ctx.strokeStyle = '#ff6fa3';
  ctx.lineWidth = 4;
  ctx.stroke();
}
