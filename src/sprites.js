// ver.3에서 새로 생긴 것들의 2D 그림 (트램펄린, 곤돌라, 낡은 간판, 짚라인, 환풍구, 피뢰침, 아이템, 대왕 고추…)
// 판정이 있는 것은 모두 2D 덧그림 캔버스에 그린다.
import { T } from './levels.js';
import { text, roundRect, circle, line, hash, drawFlyer } from './draw.js';

// 옥상 트램펄린
export function drawSpring(ctx, s) {
  const sq = s.squash;
  const top = s.y + sq * 6;
  const x = s.x;
  const w = s.w;
  const base = s.y + s.h;
  ctx.fillStyle = '#495057';
  roundRect(ctx, x - 2, base - 4, w + 4, 4, 2);
  ctx.fill();
  ctx.strokeStyle = '#adb5bd';
  ctx.lineWidth = 2;
  ctx.beginPath();
  const n = 5;
  for (let i = 0; i <= n; i++) {
    const yy = base - 4 - ((base - 4 - (top + 5)) * i) / n;
    ctx.lineTo(i % 2 ? x + 5 : x + w - 5, yy);
  }
  ctx.stroke();
  roundRect(ctx, x - 3, top, w + 6, 6, 3);
  ctx.fillStyle = '#ff6b6b';
  ctx.fill();
  ctx.strokeStyle = '#c92a2a';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fillRect(x + 1, top + 1, w - 2, 1.5);
}

// 창문 청소 곤돌라 (위아래로 오르내린다)
export function drawGondola(ctx, p, t) {
  const { x, y, w } = p;
  ctx.strokeStyle = '#3f3f46';
  ctx.lineWidth = 1.5;
  line(ctx, x + 6, y - 22, x + 6, y - 900);
  line(ctx, x + w - 6, y - 22, x + w - 6, y - 900);
  // 난간
  ctx.strokeStyle = '#1c7ed6';
  ctx.lineWidth = 2.5;
  line(ctx, x + 2, y - 20, x + w - 2, y - 20);
  line(ctx, x + 3, y - 20, x + 3, y);
  line(ctx, x + w - 3, y - 20, x + w - 3, y);
  line(ctx, x + w / 2, y - 20, x + w / 2, y);
  // 바닥 상자
  ctx.fillStyle = '#4dabf7';
  ctx.fillRect(x, y, w, p.h);
  ctx.fillStyle = '#1971c2';
  ctx.fillRect(x, y + p.h - 4, w, 4);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x, y, w, 2);
  // 양동이와 밀대
  ctx.fillStyle = '#ffd43b';
  ctx.fillRect(x + w - 16, y + 3, 9, 8);
  ctx.strokeStyle = '#868e96';
  ctx.lineWidth = 1.5;
  line(ctx, x + 8, y + 2, x + 14, y + 11);
  // 경고등
  if (Math.floor(t * 3) % 2 === 0) {
    ctx.fillStyle = '#ffa94d';
    circle(ctx, x + w / 2, y - 22, 2.5);
    ctx.fill();
  }
}

// 낡은 간판 (밟으면 떨어진다)
export function drawCrumble(ctx, c, t) {
  if (c.respawn > 0) return;
  const sx = c.shake > 0 ? Math.sin(t * 70) * 2 * (0.4 + c.shake) : 0;
  const x = c.x + sx;
  const y = c.y;
  if (c.solid) {
    ctx.strokeStyle = '#6b7280';
    ctx.lineWidth = 1.5;
    line(ctx, x + 8, y, x + 12, y - 30);
    line(ctx, x + c.w - 8, y, x + c.w - 12, y - 30);
  }
  ctx.fillStyle = '#c28a52';
  ctx.fillRect(x, y, c.w, c.h);
  ctx.fillStyle = '#e0b07a';
  ctx.fillRect(x, y, c.w, 3);
  ctx.strokeStyle = '#7a4e25';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x + 0.75, y + 0.75, c.w - 1.5, c.h - 1.5);
  text(ctx, '폐업 정리', x + c.w / 2, y + c.h / 2 + 1, { size: 10, color: '#7a2e12', stroke: null });
  // 금
  ctx.strokeStyle = 'rgba(60,30,10,0.7)';
  ctx.lineWidth = 1;
  line(ctx, x + c.w * 0.3, y, x + c.w * 0.36, y + c.h);
  line(ctx, x + c.w * 0.72, y + c.h, x + c.w * 0.66, y + 4);
}

// 짚라인 줄과 기둥. 바닥 높이는 level에서 찾는다.
export function drawZipline(ctx, z, level, riding) {
  const pole = (px, py) => {
    let gy = py;
    for (let k = 0; k < 15; k++) {
      if (level.isSolid(Math.floor(px / T), Math.floor((gy + 2) / T))) break;
      gy += T;
    }
    gy = Math.floor((gy + 2) / T) * T;
    ctx.strokeStyle = '#5c636e';
    ctx.lineWidth = 4;
    line(ctx, px, py - 6, px, gy);
    ctx.fillStyle = '#ffd43b';
    circle(ctx, px, py - 6, 4);
    ctx.fill();
  };
  pole(z.ax, z.ay);
  pole(z.bx, z.by);
  ctx.strokeStyle = '#2b2f36';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(z.ax, z.ay);
  ctx.quadraticCurveTo((z.ax + z.bx) / 2, (z.ay + z.by) / 2 + 6, z.bx, z.by);
  ctx.stroke();
  if (!riding) drawTrolley(ctx, z.ax + z.ux * 26, z.ay + z.uy * 26, false);
}

export function drawTrolley(ctx, x, y, withHandle = true) {
  ctx.fillStyle = '#e03131';
  roundRect(ctx, x - 7, y - 5, 14, 9, 3);
  ctx.fill();
  ctx.fillStyle = '#343a40';
  circle(ctx, x - 3, y - 4, 2.2);
  ctx.fill();
  circle(ctx, x + 3, y - 4, 2.2);
  ctx.fill();
  if (withHandle) {
    ctx.strokeStyle = '#343a40';
    ctx.lineWidth = 2;
    line(ctx, x, y + 4, x, y + 12);
    line(ctx, x - 7, y + 12, x + 7, y + 12);
  }
}

// 환풍구와 위로 솟는 바람
export function drawVent(ctx, v, t) {
  const { x, w, base, top } = v;
  // 바람 줄기
  ctx.save();
  ctx.lineCap = 'round';
  const glow = ctx.createLinearGradient(0, top, 0, base);
  glow.addColorStop(0, 'rgba(200, 240, 255, 0)');
  glow.addColorStop(1, 'rgba(200, 240, 255, 0.22)');
  ctx.fillStyle = glow;
  ctx.fillRect(x + 4, top, w - 8, base - top);
  for (let i = 0; i < 14; i++) {
    const h = hash(i, Math.floor(x));
    const lx = x + 6 + h * (w - 12);
    const span = base - top;
    const k = (t * (0.8 + h * 0.6) + h) % 1;
    const y0 = base - 18 - k * span;
    const a = Math.sin(k * Math.PI) * 0.85;
    ctx.strokeStyle = `rgba(235, 250, 255, ${a})`;
    ctx.lineWidth = 2.5;
    line(ctx, lx + Math.sin(t * 6 + i) * 2, y0, lx + Math.sin(t * 6 + i + 1) * 2, y0 - 22);
  }
  ctx.restore();
  // 환풍기 상자
  ctx.fillStyle = '#adb5bd';
  roundRect(ctx, x + 2, base - 20, w - 4, 20, 4);
  ctx.fill();
  ctx.strokeStyle = '#495057';
  ctx.lineWidth = 2;
  ctx.stroke();
  const cx = x + w / 2;
  const cy = base - 10;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1, 0.45);
  ctx.rotate(v.spin);
  ctx.fillStyle = '#495057';
  for (let i = 0; i < 4; i++) {
    ctx.rotate(Math.PI / 2);
    ctx.beginPath();
    ctx.ellipse(10, 0, 10, 4, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// 피뢰침과 번개
export function drawRod(ctx, r, t) {
  const top = r.base - 70;
  ctx.strokeStyle = '#868e96';
  ctx.lineWidth = 3;
  line(ctx, r.x, r.base, r.x, top);
  ctx.fillStyle = '#ced4da';
  circle(ctx, r.x, top, 4);
  ctx.fill();
  ctx.fillStyle = '#495057';
  ctx.fillRect(r.x - 8, r.base - 5, 16, 5);
  if (r.state === 'warn') {
    const k = (r.time % r.period) - (r.period - 1.35);
    ctx.strokeStyle = `rgba(255, 240, 120, ${0.4 + 0.6 * Math.abs(Math.sin(t * 30))})`;
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 4 + k * 4; i++) {
      const a = hash(i, Math.floor(t * 20)) * Math.PI * 2;
      const l = 6 + hash(i + 7, Math.floor(t * 20)) * 10;
      line(ctx, r.x, top, r.x + Math.cos(a) * l, top + Math.sin(a) * l);
    }
    // 위험 표시: 바닥의 깜빡이는 원
    ctx.fillStyle = `rgba(255, 220, 60, ${0.25 + 0.2 * Math.sin(t * 25)})`;
    ctx.beginPath();
    ctx.ellipse(r.x, r.base - 2, 24, 5, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (r.state === 'strike') {
    drawBolt(ctx, r.x, -220, r.x, top, Math.floor(t * 30), 1);
  }
}

// 지그재그 번개 줄기
export function drawBolt(ctx, x0, y0, x1, y1, seed, alpha = 1) {
  const pts = [[x0, y0]];
  const n = 12;
  for (let i = 1; i < n; i++) {
    const k = i / n;
    pts.push([x0 + (x1 - x0) * k + (hash(i, seed) - 0.5) * 38, y0 + (y1 - y0) * k]);
  }
  pts.push([x1, y1]);
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.globalAlpha = alpha;
  for (const [wd, colr] of [
    [14, 'rgba(160, 200, 255, 0.35)'],
    [7, 'rgba(220, 235, 255, 0.8)'],
    [3, '#ffffff'],
  ]) {
    ctx.strokeStyle = colr;
    ctx.lineWidth = wd;
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
  }
  ctx.restore();
}

// 아이템 방울
const ITEM_COLORS = { net: '#4dabf7', wings: '#ff8cc6', magnet: '#ff6b6b', heart: '#ff5d8f' };
export function drawItem(ctx, it, t) {
  if (it.taken) return;
  const r = it.rect;
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  circle(ctx, cx, cy, 17 + Math.sin(t * 5) * 1.5);
  ctx.fill();
  ctx.strokeStyle = ITEM_COLORS[it.kind] || '#fff';
  ctx.lineWidth = 2.5;
  ctx.stroke();
  drawPowerIcon(ctx, it.kind, cx, cy, 1, t);
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  circle(ctx, cx - 7, cy - 8, 3);
  ctx.fill();
  ctx.restore();
}

export function drawPowerIcon(ctx, kind, cx, cy, s = 1, t = 0) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(s, s);
  ctx.lineCap = 'round';
  if (kind === 'net') {
    ctx.strokeStyle = '#8a5a2b';
    ctx.lineWidth = 3;
    line(ctx, -8, 9, 2, -1);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.strokeStyle = '#1c7ed6';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(5, -5, 7, 8, 0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (kind === 'wings') {
    const f = Math.sin(t * 12) * 0.25;
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#ff8cc6';
    ctx.lineWidth = 1.5;
    for (const d of [-1, 1]) {
      ctx.save();
      ctx.scale(d, 1);
      ctx.rotate(-0.4 + f);
      ctx.beginPath();
      ctx.ellipse(6, -2, 7, 4, -0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    ctx.fillStyle = '#f9a8bd';
    circle(ctx, 0, 2, 4);
    ctx.fill();
  } else if (kind === 'magnet') {
    ctx.strokeStyle = '#e03131';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(0, -1, 6, Math.PI, 0);
    ctx.stroke();
    line(ctx, -6, -1, -6, 7);
    line(ctx, 6, -1, 6, 7);
    ctx.strokeStyle = '#dee2e6';
    line(ctx, -6, 5, -6, 8);
    line(ctx, 6, 5, 6, 8);
  } else if (kind === 'heart') {
    ctx.fillStyle = '#ff5d8f';
    ctx.beginPath();
    ctx.moveTo(0, 7);
    ctx.bezierCurveTo(-11, -1, -7, -11, 0, -5);
    ctx.bezierCurveTo(7, -11, 11, -1, 0, 7);
    ctx.fill();
  }
  ctx.restore();
}

// 돼지 날개 (주인공 등에 붙음)
export function drawPigWings(ctx, x, y, facing, t) {
  const f = Math.sin(t * 18) * 0.5;
  ctx.save();
  ctx.translate(x - facing * 6, y - 16);
  ctx.scale(facing, 1);
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.strokeStyle = '#ff8cc6';
  ctx.lineWidth = 1.5;
  for (const k of [0, 1]) {
    ctx.save();
    ctx.rotate(-0.9 - f - k * 0.3);
    ctx.beginPath();
    ctx.ellipse(-2, -9, 5, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

// 자석 더듬이: 반짝이는 고리
export function drawMagnetAura(ctx, x, y, t) {
  ctx.save();
  ctx.strokeStyle = `rgba(255, 107, 107, ${0.35 + 0.25 * Math.sin(t * 8)})`;
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 6]);
  ctx.lineDashOffset = -t * 40;
  circle(ctx, x, y - 30, 26 + Math.sin(t * 4) * 3);
  ctx.stroke();
  ctx.restore();
}

// 황금 고추 주변 반짝이
export function drawSparkles(ctx, x, y, t, color = '#fff6b0') {
  ctx.save();
  ctx.fillStyle = color;
  for (let i = 0; i < 4; i++) {
    const a = t * 2 + i * 1.57;
    const r = 20 + Math.sin(t * 5 + i) * 4;
    const s = 2 + Math.sin(t * 9 + i * 2) * 1.2;
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r * 0.7;
    ctx.beginPath();
    ctx.moveTo(px, py - s * 2);
    ctx.lineTo(px + s * 0.6, py);
    ctx.lineTo(px, py + s * 2);
    ctx.lineTo(px - s * 0.6, py);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

// ───────── 대왕 고추 ─────────

export function drawBoss(ctx, b, t) {
  if (b.state === 'gone') return;
  const s = b.scale;
  const angry = b.state === 'aim' || b.state === 'dive' || b.state === 'charge';
  const dizzy = b.state === 'dizzy';
  let ox = 0;
  if (b.state === 'aim') ox = Math.sin(t * 60) * 3;
  ctx.save();
  ctx.translate(b.x + ox, b.y);
  if (b.flash > 0 && Math.floor(t * 30) % 2 === 0) ctx.globalAlpha = 0.55;
  // 그림자 망토
  ctx.save();
  ctx.scale(b.facing * s, s);
  ctx.rotate(b.state === 'defeat' ? b.spin : -0.1 + Math.sin(t * 2.4) * 0.06);
  ctx.fillStyle = '#c92a2a';
  ctx.beginPath();
  ctx.moveTo(-6, -6);
  ctx.quadraticCurveTo(-24, 6 + Math.sin(t * 5) * 2, -30, 20);
  ctx.lineTo(-4, 10);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  // 몸통은 보통 고추 그림을 크게
  drawFlyer(ctx, 0, 0, {
    facing: b.facing,
    flap: t * (angry ? 34 : 20),
    panic: dizzy || b.state === 'defeat',
    t,
    scale: s,
    spin: b.state === 'defeat' ? b.spin : 0,
    tint: angry ? 'angry' : b.state === 'defeat' ? null : 'king',
  });
  // 왕관 + 콧수염 + 눈썹
  ctx.save();
  ctx.scale(b.facing * s, s);
  ctx.rotate(b.state === 'defeat' ? b.spin : -0.18 + Math.sin(t * 3) * 0.1);
  ctx.translate(11, -8);
  ctx.fillStyle = '#ffd43b';
  ctx.strokeStyle = '#b8860b';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(-7, 0);
  ctx.lineTo(-7, -6);
  ctx.lineTo(-4, -3);
  ctx.lineTo(-1, -8);
  ctx.lineTo(2, -3);
  ctx.lineTo(5, -6);
  ctx.lineTo(5, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ff6b6b';
  circle(ctx, -1, -3.2, 1.1);
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.scale(b.facing * s, s);
  ctx.rotate(b.state === 'defeat' ? b.spin : -0.18 + Math.sin(t * 3) * 0.1);
  ctx.strokeStyle = '#4a2a1a';
  ctx.lineWidth = 1.6;
  ctx.lineCap = 'round';
  // 콧수염
  ctx.beginPath();
  ctx.moveTo(12, 1.5);
  ctx.quadraticCurveTo(9, 4.5, 6.5, 2.2);
  ctx.moveTo(12, 1.5);
  ctx.quadraticCurveTo(15, 4.5, 17.5, 2.2);
  ctx.stroke();
  if (angry) {
    ctx.lineWidth = 1.4;
    line(ctx, 6.5, -5.5, 10.5, -3.6);
    line(ctx, 17, -5.5, 13, -3.6);
  }
  ctx.restore();
  // 어지러움 별
  if (dizzy) {
    for (let i = 0; i < 3; i++) {
      const a = t * 4 + (i * Math.PI * 2) / 3;
      const px = Math.cos(a) * 34;
      const py = -s * 16 + Math.sin(a) * 8;
      drawStar(ctx, px, py, 6, '#ffe066');
    }
  }
  ctx.restore();
}

export function drawStar(ctx, x, y, r, color, stroke = '#b8860b') {
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }
  ctx.restore();
}

// 고추씨 (대왕 고추가 뿌리는 탄)
export function drawSeed(ctx, sd, t) {
  ctx.save();
  ctx.translate(sd.x, sd.y);
  ctx.rotate(t * 8 + sd.x);
  ctx.fillStyle = '#fff3bf';
  ctx.strokeStyle = '#e8590c';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(0, 0, 6, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

// 보스 체력 막대
export function drawBossBar(ctx, b, x, y, w) {
  const k = Math.max(0, b.hp / b.maxHp);
  roundRect(ctx, x - w / 2, y, w, 14, 7);
  ctx.fillStyle = 'rgba(30, 10, 40, 0.6)';
  ctx.fill();
  roundRect(ctx, x - w / 2 + 2, y + 2, (w - 4) * k, 10, 5);
  ctx.fillStyle = '#ff6b6b';
  ctx.fill();
  roundRect(ctx, x - w / 2, y, w, 14, 7);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.stroke();
  text(ctx, '대왕 고추', x, y - 10, { size: 15, color: '#ffd43b' });
}
