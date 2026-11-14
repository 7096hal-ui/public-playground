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

const THEMES = {
  day: {
    sky: ['#5fb8f5', '#d8f0ff'],
    far: '#b3c9de',
    farWin: 'rgba(255, 255, 255, 0.45)',
    mid: '#869fbb',
    midWin: 'rgba(230, 242, 255, 0.6)',
    haze: [70, 90, 120],
  },
  night: {
    sky: ['#0b1030', '#3b2c6e'],
    far: '#1b2150',
    farWin: 'rgba(255, 214, 120, 0.45)',
    mid: '#252b5e',
    midWin: 'rgba(255, 214, 102, 0.9)',
    haze: [8, 8, 25],
  },
};

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

// 멀리 보이는 빌딩 실루엣 한 겹
function skyline(ctx, camX, bottom, vw, parallax, spacing, color, win, minH, maxH, seed, t, night) {
  const off = camX * parallax;
  const first = Math.floor(off / spacing) - 1;
  const last = first + Math.ceil(vw / spacing) + 2;
  for (let i = first; i <= last; i++) {
    const w = spacing * (0.55 + hash(i, seed) * 0.4);
    const h = minH + hash(i, seed + 1) * (maxH - minH);
    const x = Math.round(i * spacing - off);
    const y = Math.round(bottom - h);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, Math.round(w), Math.ceil(h) + 1);
    // 옥상 위 장식: 안테나 또는 물탱크
    const deco = hash(i, seed + 2);
    if (deco < 0.3) {
      ctx.fillRect(x + w / 2 - 1, y - 22, 2, 22);
      if (night && Math.floor(t * 1.5 + i) % 2 === 0) {
        ctx.fillStyle = '#ff4d4d';
        circle(ctx, x + w / 2, y - 23, 2.2);
        ctx.fill();
      }
    } else if (deco < 0.5) {
      ctx.fillRect(x + 8, y - 12, 16, 12);
      ctx.fillRect(x + 10, y - 16, 12, 4);
    }
    // 창문
    ctx.fillStyle = win;
    for (let wy = y + 10; wy < bottom - 6; wy += 14) {
      for (let wx = x + 6; wx < x + w - 8; wx += 11) {
        if (hash(wx * 13 + i, wy) < (night ? 0.45 : 0.6)) ctx.fillRect(wx, wy, 5, 6);
      }
    }
  }
}

export function drawBackground(ctx, camX, camY, vw, vh, t, theme = 'day') {
  const th = THEMES[theme] || THEMES.day;
  const night = theme === 'night';
  const g = ctx.createLinearGradient(0, 0, 0, vh);
  g.addColorStop(0, th.sky[0]);
  g.addColorStop(1, th.sky[1]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, vw, vh);

  if (night) {
    for (let i = 0; i < 70; i++) {
      const x = (hash(i, 1) * 2000 - camX * 0.03) % 2000;
      const sx = x < 0 ? x + 2000 : x;
      if (sx > vw) continue;
      const tw = 0.5 + 0.5 * Math.sin(t * 2 + i);
      ctx.fillStyle = `rgba(255, 255, 255, ${0.35 + tw * 0.5})`;
      ctx.fillRect(sx, hash(i, 2) * vh * 0.6, 2, 2);
    }
    const mx = vw * 0.78 - camX * 0.02;
    ctx.fillStyle = '#fff6cf';
    circle(ctx, mx, 70, 30);
    ctx.fill();
    ctx.fillStyle = 'rgba(220, 205, 150, 0.6)';
    circle(ctx, mx - 9, 62, 6);
    ctx.fill();
    circle(ctx, mx + 8, 80, 4);
    ctx.fill();
  } else {
    const off = camX * 0.1 + t * 8;
    const spacing = 260;
    const first = Math.floor(off / spacing) - 1;
    for (let i = first; i <= first + Math.ceil(vw / spacing) + 2; i++) {
      const y = 30 + hash(i, 7) * 100 - camY * 0.3;
      cloud(ctx, i * spacing - off, y, 0.7 + hash(i, 8) * 0.5);
    }
  }

  skyline(ctx, camX, vh, vw, 0.2, 90, th.far, th.farWin, 180, 330, 11, t, night);
  skyline(ctx, camX, vh, vw, 0.45, 120, th.mid, th.midWin, 110, 250, 21, t, night);

  // 저 아래 도로 쪽은 뿌옇게
  const [r, gg, b] = th.haze;
  const hz = ctx.createLinearGradient(0, vh - 150, 0, vh);
  hz.addColorStop(0, `rgba(${r}, ${gg}, ${b}, 0)`);
  hz.addColorStop(1, `rgba(${r}, ${gg}, ${b}, ${night ? 0.85 : 0.55})`);
  ctx.fillStyle = hz;
  ctx.fillRect(0, vh - 150, vw, 150);
}

// ───────────────────────── 타일 ─────────────────────────

// 건물 외벽 색 [벽, 어두운 테두리]
const WALL_COLORS = [
  ['#dccaa8', '#a8916d'],
  ['#a3b8cb', '#71879c'],
  ['#cc917b', '#9a6553'],
  ['#bcc0c7', '#878c95'],
  ['#97bb9f', '#678c70'],
  ['#d8ad70', '#a77e45'],
];

export function drawTiles(ctx, level, x0, x1) {
  const night = level.theme === 'night';
  const c0 = Math.max(0, Math.floor(x0 / T) - 1);
  const c1 = Math.min(level.cols - 1, Math.floor(x1 / T) + 1);
  for (let ty = 0; ty < level.rows; ty++) {
    for (let tx = c0; tx <= c1; tx++) {
      const ch = level.grid[ty][tx];
      if (ch === ' ') continue;
      const px = tx * T;
      const py = ty * T;
      if (ch === '#') drawWall(ctx, level, tx, ty, px, py, night);
      else if (ch === 'B') drawScaffold(ctx, px, py);
      else if (ch === 'A') drawAirCon(ctx, px, py, night);
      else if (ch === '^') drawBarbedWire(ctx, px, py);
    }
  }
}

function drawWall(ctx, level, tx, ty, px, py, night) {
  const kind = level.wall[tx];
  const [wall, dark] = WALL_COLORS[kind];
  ctx.fillStyle = wall;
  ctx.fillRect(px, py, T, T);
  if (night) {
    ctx.fillStyle = 'rgba(15, 18, 60, 0.55)';
    ctx.fillRect(px, py, T, T);
  }

  // 창문 (건물마다 모양이 다름)
  const lit = hash(tx, ty * 3 + kind) < 0.45;
  const glass = night ? (lit ? '#ffd66b' : '#29326a') : '#cfe7fb';
  const style = kind % 3;
  ctx.fillStyle = night ? '#141836' : dark;
  if (style === 0) {
    ctx.fillRect(px + 7, py + 9, 18, 16);
    ctx.fillStyle = glass;
    ctx.fillRect(px + 9, py + 11, 14, 12);
  } else if (style === 1) {
    ctx.fillRect(px + 4, py + 8, 10, 18);
    ctx.fillRect(px + 18, py + 8, 10, 18);
    ctx.fillStyle = glass;
    ctx.fillRect(px + 5.5, py + 9.5, 7, 15);
    ctx.fillRect(px + 19.5, py + 9.5, 7, 15);
  } else {
    ctx.fillRect(px, py + 11, T, 14);
    ctx.fillStyle = glass;
    ctx.fillRect(px, py + 12.5, T, 11);
    ctx.fillStyle = night ? '#141836' : dark;
    ctx.fillRect(px + 15, py + 12, 2, 12);
  }
  if (!night) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.lineWidth = 1.5;
    line(ctx, px + 10, py + 21, px + 16, py + 13);
  }

  // 건물 양 끝 테두리
  ctx.fillStyle = night ? '#141836' : dark;
  if (!level.isSolid(tx - 1, ty) || tx === 0) ctx.fillRect(px, py, 3, T);
  if (!level.isSolid(tx + 1, ty) || tx === level.cols - 1) ctx.fillRect(px + T - 3, py, 3, T);

  // 옥상 난간
  if (!level.isSolid(tx, ty - 1) || level.tile(tx, ty - 1) === 'A') {
    ctx.fillStyle = night ? '#7d82a8' : '#eceef1';
    ctx.fillRect(px, py, T, 7);
    ctx.fillStyle = night ? '#3c4170' : '#6b7280';
    ctx.fillRect(px, py + 7, T, 2);
    ctx.fillStyle = night ? '#a3a8cc' : '#ffffff';
    ctx.fillRect(px, py, T, 2);
  }
}

// 공사장 비계
function drawScaffold(ctx, px, py) {
  ctx.fillStyle = 'rgba(40, 30, 20, 0.25)';
  ctx.fillRect(px + 3, py + 6, T - 6, T - 6);
  ctx.strokeStyle = '#e8a33a';
  ctx.lineWidth = 3;
  ctx.strokeRect(px + 1.5, py + 1.5, T - 3, T - 3);
  ctx.lineWidth = 2;
  line(ctx, px + 3, py + 3, px + T - 3, py + T - 3);
  line(ctx, px + T - 3, py + 3, px + 3, py + T - 3);
  ctx.fillStyle = '#b07a3c';
  ctx.fillRect(px, py, T, 6);
  ctx.fillStyle = '#d9a466';
  ctx.fillRect(px, py, T, 2);
  ctx.fillStyle = '#6e4a20';
  ctx.fillRect(px + 15, py, 2, 6);
}

// 에어컨 실외기
function drawAirCon(ctx, px, py, night) {
  roundRect(ctx, px + 1, py + 1, T - 2, T - 2, 3);
  ctx.fillStyle = night ? '#9aa0bd' : '#e6e9ed';
  ctx.fill();
  ctx.strokeStyle = night ? '#4a4f78' : '#7d8590';
  ctx.lineWidth = 2;
  ctx.stroke();
  circle(ctx, px + 12, py + 17, 9);
  ctx.fillStyle = night ? '#5e6488' : '#aab2bc';
  ctx.fill();
  ctx.stroke();
  ctx.lineWidth = 1.5;
  line(ctx, px + 5, py + 17, px + 19, py + 17);
  line(ctx, px + 12, py + 10, px + 12, py + 24);
  ctx.lineWidth = 1;
  for (let y = py + 8; y < py + 28; y += 4) line(ctx, px + 23, y, px + 29, y);
}

// 철조망
function drawBarbedWire(ctx, px, py) {
  ctx.strokeStyle = '#4b5563';
  ctx.lineWidth = 2;
  line(ctx, px, py + T - 2, px + T, py + T - 2);
  ctx.strokeStyle = '#b8c0c8';
  ctx.lineWidth = 1.6;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.ellipse(px + 4 + i * 8, py + T - 9, 5.5, 7, 0.3, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.strokeStyle = '#6b7280';
  ctx.lineWidth = 1.4;
  for (let i = 0; i < 4; i++) {
    const x = px + 4 + i * 8;
    line(ctx, x - 2, py + T - 18, x + 2, py + T - 14);
    line(ctx, x + 2, py + T - 18, x - 2, py + T - 14);
  }
}

// ───────────────────────── 오브젝트 ─────────────────────────

// 크레인에 매달린 철골 발판
export function drawPlatform(ctx, p) {
  const cx = p.x + p.w / 2;
  ctx.strokeStyle = '#3f3f46';
  ctx.lineWidth = 1.5;
  line(ctx, p.x + 10, p.y, cx, p.y - 50);
  line(ctx, p.x + p.w - 10, p.y, cx, p.y - 50);
  line(ctx, cx, p.y - 50, cx, p.y - 900);
  ctx.fillStyle = '#facc15';
  circle(ctx, cx, p.y - 50, 3);
  ctx.fill();

  ctx.fillStyle = '#c2410c';
  ctx.fillRect(p.x, p.y, p.w, p.h);
  ctx.fillStyle = '#ea580c';
  ctx.fillRect(p.x, p.y, p.w, 3);
  ctx.fillRect(p.x, p.y + p.h - 3, p.w, 3);
  ctx.fillStyle = '#7c2d12';
  for (let x = p.x + 12; x < p.x + p.w - 6; x += 18) {
    circle(ctx, x, p.y + p.h / 2, 2.2);
    ctx.fill();
  }
  ctx.strokeStyle = '#7c2d12';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(p.x + 0.75, p.y + 0.75, p.w - 1.5, p.h - 1.5);
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

// 성난 비둘기
export function drawPigeon(ctx, c, t) {
  const facing = c.vx > 0 ? 1 : -1;
  const step = Math.sin(c.walk * 0.25);
  ctx.save();
  ctx.translate(c.x + c.w / 2, c.y + c.h);
  ctx.scale(facing, 1);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // 다리
  ctx.strokeStyle = '#f08c3a';
  ctx.lineWidth = 2;
  line(ctx, -2, -5, -2 + step * 3, 0);
  line(ctx, 3, -5, 3 - step * 3, 0);

  // 꼬리
  ctx.fillStyle = '#5d6577';
  ctx.beginPath();
  ctx.moveTo(-9, -12);
  ctx.lineTo(-19, -16);
  ctx.lineTo(-17, -8);
  ctx.closePath();
  ctx.fill();

  // 몸통 + 날개
  ctx.beginPath();
  ctx.ellipse(0, -11, 11, 7.5, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#9aa3b5';
  ctx.fill();
  ctx.strokeStyle = '#4b5263';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(-3, -12, 7, 4.5, -0.15, 0, Math.PI * 2);
  ctx.fillStyle = '#7f889b';
  ctx.fill();
  ctx.strokeStyle = '#2f3440';
  ctx.lineWidth = 1.4;
  line(ctx, -7, -12, -2, -11);
  line(ctx, -6, -9.5, -1, -8.5);

  // 머리 (걸을 때 앞뒤로 까딱)
  const hx = 7 + Math.sin(c.walk * 0.5) * 1.8;
  ctx.fillStyle = '#5e9c84';
  ctx.beginPath();
  ctx.ellipse(hx - 2, -16, 4, 3.5, 0.5, 0, Math.PI * 2);
  ctx.fill();
  circle(ctx, hx, -20, 5.5);
  ctx.fillStyle = '#7d8699';
  ctx.fill();
  ctx.strokeStyle = '#4b5263';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.fillStyle = '#3a3a3a';
  ctx.beginPath();
  ctx.moveTo(hx + 4.5, -21);
  ctx.lineTo(hx + 9, -19.5);
  ctx.lineTo(hx + 4.5, -18);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#f2f2f2';
  circle(ctx, hx + 4.6, -21.3, 1.2);
  ctx.fill();
  ctx.fillStyle = '#ff8a3d';
  circle(ctx, hx + 1.5, -21, 2.2);
  ctx.fill();
  ctx.fillStyle = '#111';
  circle(ctx, hx + 1.9, -21, 1.1);
  ctx.fill();
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 1.8;
  line(ctx, hx - 1.5, -25.5, hx + 4, -23);
  ctx.restore();
}

// 크레인 줄에 매달린 쇳덩이
export function drawWreckingBall(ctx, s) {
  ctx.strokeStyle = '#3f3f46';
  ctx.lineWidth = 2;
  line(ctx, s.x, s.y - 900, s.x, s.y - s.r - 6);
  ctx.strokeStyle = '#facc15';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(s.x, s.y - s.r - 3, 4, 0, Math.PI * 2);
  ctx.stroke();
  const g = ctx.createRadialGradient(s.x - 5, s.y - 5, 2, s.x, s.y, s.r);
  g.addColorStop(0, '#8b919c');
  g.addColorStop(1, '#2e3138');
  circle(ctx, s.x, s.y, s.r);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = '#1f2125';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // 노랑-검정 경고 띠
  ctx.save();
  circle(ctx, s.x, s.y, s.r);
  ctx.clip();
  for (let i = -3; i <= 3; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#facc15' : '#1f2125';
    ctx.fillRect(s.x + i * 5 - 2.5, s.y + 2, 5, 5);
  }
  ctx.restore();
}

// 타이틀 화면용 옥상 띠
export function drawRoofStrip(ctx, y, w, h) {
  ctx.fillStyle = '#bcc0c7';
  ctx.fillRect(0, y, w, h);
  for (let x = 0; x < w; x += 32) {
    ctx.fillStyle = '#878c95';
    ctx.fillRect(x + 7, y + 18, 18, 16);
    ctx.fillStyle = '#cfe7fb';
    ctx.fillRect(x + 9, y + 20, 14, 12);
  }
  ctx.fillStyle = '#eceef1';
  ctx.fillRect(0, y, w, 7);
  ctx.fillStyle = '#6b7280';
  ctx.fillRect(0, y + 7, w, 2);
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
