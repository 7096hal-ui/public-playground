// 3D 도시에 붙이는 그림(실외기 앞면, 비계, 옥탑방 문, 광고판, 간판…)을 캔버스 한 장에 모아 그린다.
// 이미지 파일 없이 전부 도형과 글자로 그린다. 글꼴(Jua)이 늦게 오면 redraw()로 다시 그린다.
import { roundRect, text, circle, line, drawAirCon, drawScaffold } from './draw.js';

export const ATLAS = 1024;

// 이름 → [x, y, w, h] (캔버스 픽셀)
export const R = {
  ac: [0, 0, 64, 64],
  scaffold: [64, 0, 64, 64],
  door: [128, 0, 64, 96],
  hutWin: [192, 0, 64, 64],
  laundry: [256, 0, 192, 64],
  planter: [448, 0, 192, 64],
  vent: [640, 0, 64, 64],
  spring: [704, 0, 64, 64],
  helipad: [768, 0, 256, 256],
};
export const BILLBOARDS = [];
export const NEONS = [];
export const SIGNS = [];
export const VSIGNS = [];
for (let i = 0; i < 8; i++) BILLBOARDS.push([(i % 4) * 192, 256 + Math.floor(i / 4) * 96, 192, 96]);
for (let i = 0; i < 4; i++) NEONS.push([768, 256 + i * 64, 256, 64]);
for (let i = 0; i < 8; i++) SIGNS.push([(i % 4) * 192, 448 + Math.floor(i / 4) * 48, 192, 48]);
for (let i = 0; i < 8; i++) VSIGNS.push([i * 48, 544, 48, 192]);
R.arch = [384, 544, 384, 96];
R.balloon = [384, 640, 64, 96];
R.searchlight = [448, 640, 64, 64];

const BB = [
  { bg: '#ffd1e0', fg: '#c2185b', title: '꿀꿀 우유', sub: '키가 쑥쑥!', icon: 'milk' },
  { bg: '#ffe066', fg: '#d6336c', title: '잠자리채 반값!', sub: '오늘만 세일', icon: 'net' },
  { bg: '#212529', fg: '#ffd43b', title: '고추 출몰 주의', sub: '하늘을 보세요!', icon: 'warn' },
  { bg: '#4dabf7', fg: '#ffffff', title: '옥상 헬스', sub: '근육 꿀꿀', icon: 'dumbbell' },
  { bg: '#8ce99a', fg: '#2b8a3e', title: '더듬이 안경', sub: '잘 보여요', icon: 'glasses' },
  { bg: '#ff922b', fg: '#ffffff', title: '돼지 분식', sub: '떡볶이 3천원', icon: 'tteok' },
  { bg: '#364fc7', fg: '#ffe066', title: '꿀꿀 은행', sub: '저금 꿀꿀', icon: 'coin' },
  { bg: '#e7f5ff', fg: '#1971c2', title: '하늘 택배', sub: '날아서 배달', icon: 'box' },
];
const NEON_TEXT = [
  { str: '꿀꿀', color: '#ff6fb5' },
  { str: 'OPEN', color: '#4dd9ff' },
  { str: '고추 사냥', color: '#ffe14d' },
  { str: '♥ 노래방', color: '#ff5a5a' },
];
const SHOP = [
  ['꿀꿀 분식', '#e8590c'],
  ['24시 편의점', '#1c7ed6'],
  ['곤충 학원', '#2f9e44'],
  ['꿀꿀 PC방', '#7048e8'],
  ['노래방', '#d6336c'],
  ['치킨 호프', '#f08c00'],
  ['약국', '#0ca678'],
  ['꽃집', '#e64980'],
];
const VSHOP = [
  ['당구장', '#c92a2a'],
  ['만화방', '#5f3dc4'],
  ['태권도', '#1864ab'],
  ['피아노', '#495057'],
  ['세탁소', '#0b7285'],
  ['사진관', '#d9480f'],
  ['수학학원', '#2b8a3e'],
  ['한의원', '#862e9c'],
];

export class Atlas {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = ATLAS;
    this.canvas.height = ATLAS;
    this.redraw();
  }

  // 아틀라스 좌표 → 텍스처 UV [u0, v0, u1, v1] (v는 아래가 0)
  uv(r) {
    const [x, y, w, h] = r;
    return [x / ATLAS, 1 - (y + h) / ATLAS, (x + w) / ATLAS, 1 - y / ATLAS];
  }

  redraw() {
    const ctx = this.canvas.getContext('2d');
    ctx.clearRect(0, 0, ATLAS, ATLAS);
    const at = (r, fn) => {
      ctx.save();
      ctx.translate(r[0], r[1]);
      ctx.beginPath();
      ctx.rect(0, 0, r[2], r[3]);
      ctx.clip();
      fn(ctx, r[2], r[3]);
      ctx.restore();
    };
    at(R.ac, (c) => {
      c.scale(2, 2);
      drawAirCon(c, 0, 0, false);
    });
    at(R.scaffold, (c) => {
      c.scale(2, 2);
      drawScaffold(c, 0, 0); // 반투명 바탕은 3D에서 알파 테스트로 빠지고 뼈대만 남는다
    });
    at(R.door, drawDoor);
    at(R.hutWin, drawHutWindow);
    at(R.laundry, drawLaundry);
    at(R.planter, drawPlanter);
    at(R.vent, drawVentTop);
    at(R.spring, drawSpringPad);
    at(R.helipad, drawHelipad);
    BB.forEach((b, i) => at(BILLBOARDS[i], (c, w, h) => drawBillboard(c, w, h, b)));
    NEON_TEXT.forEach((n, i) => at(NEONS[i], (c, w, h) => drawNeon(c, w, h, n)));
    SHOP.forEach((s, i) => at(SIGNS[i], (c, w, h) => drawShopSign(c, w, h, s)));
    VSHOP.forEach((s, i) => at(VSIGNS[i], (c, w, h) => drawVSign(c, w, h, s)));
    at(R.arch, drawArch);
    at(R.balloon, drawBalloon);
    at(R.searchlight, drawSearchlight);
  }
}

function drawDoor(c, w, h) {
  c.fillStyle = '#4c6ef5';
  roundRect(c, 6, 4, w - 12, h - 4, 4);
  c.fill();
  c.strokeStyle = '#2b3a8f';
  c.lineWidth = 3;
  c.stroke();
  c.fillStyle = '#bac8ff';
  c.fillRect(16, 14, w - 32, 22);
  c.fillStyle = '#ffd43b';
  circle(c, w - 18, h / 2 + 8, 4);
  c.fill();
  c.fillStyle = '#2b3a8f';
  c.fillRect(6, h - 6, w - 12, 6);
}

function drawHutWindow(c, w, h) {
  c.fillStyle = '#495057';
  c.fillRect(4, 6, w - 8, h - 12);
  c.fillStyle = '#ffe8a3';
  c.fillRect(8, 10, w - 16, h - 20);
  c.fillStyle = '#f783ac';
  c.beginPath();
  c.moveTo(8, 10);
  c.quadraticCurveTo(22, 26, 14, h - 10);
  c.lineTo(8, h - 10);
  c.fill();
  c.beginPath();
  c.moveTo(w - 8, 10);
  c.quadraticCurveTo(w - 22, 26, w - 14, h - 10);
  c.lineTo(w - 8, h - 10);
  c.fill();
  c.fillStyle = '#495057';
  c.fillRect(w / 2 - 1.5, 10, 3, h - 20);
}

function drawLaundry(c, w, h) {
  c.strokeStyle = '#868e96';
  c.lineWidth = 2;
  line(c, 0, 8, w, 8);
  const cloth = (x, wd, ht, col, pig) => {
    c.fillStyle = col;
    roundRect(c, x, 8, wd, ht, 4);
    c.fill();
    c.strokeStyle = 'rgba(0,0,0,0.25)';
    c.lineWidth = 1.5;
    c.stroke();
    c.fillStyle = '#868e96';
    c.fillRect(x + 3, 5, 4, 6);
    c.fillRect(x + wd - 7, 5, 4, 6);
    if (pig) {
      c.fillStyle = '#f9a8bd';
      circle(c, x + wd / 2, 8 + ht / 2, 8);
      c.fill();
      c.fillStyle = '#c9607e';
      circle(c, x + wd / 2 - 2.5, 8 + ht / 2 + 1, 1.6);
      c.fill();
      circle(c, x + wd / 2 + 2.5, 8 + ht / 2 + 1, 1.6);
      c.fill();
    }
  };
  cloth(8, 40, 46, '#74c0fc', false);
  cloth(56, 34, 40, '#ffffff', true);
  cloth(98, 18, 24, '#ffd43b', false);
  cloth(120, 18, 24, '#ffd43b', false);
  cloth(146, 38, 50, '#ff8787', false);
}

// 옥상 고추 텃밭 (빨간 고추가 주렁주렁)
function drawPlanter(c, w, h) {
  for (let i = 0; i < 6; i++) {
    const x = 8 + i * 30;
    c.strokeStyle = '#2b8a3e';
    c.lineWidth = 3;
    line(c, x + 12, h - 16, x + 12, 14);
    c.fillStyle = '#40c057';
    for (let k = 0; k < 4; k++) {
      c.beginPath();
      c.ellipse(x + 12 + (k % 2 ? 7 : -7), 16 + k * 8, 7, 4, k % 2 ? 0.5 : -0.5, 0, Math.PI * 2);
      c.fill();
    }
    c.fillStyle = '#fa5252';
    for (let k = 0; k < 3; k++) {
      c.beginPath();
      c.ellipse(x + 8 + k * 5, 30 + (k % 2) * 6, 2.2, 6, 0.2, 0, Math.PI * 2);
      c.fill();
    }
  }
  c.fillStyle = '#a0522d';
  c.fillRect(0, h - 16, w, 16);
  c.fillStyle = '#7a3e1d';
  c.fillRect(0, h - 16, w, 3);
}

function drawVentTop(c, w, h) {
  c.fillStyle = '#adb5bd';
  roundRect(c, 2, 2, w - 4, h - 4, 6);
  c.fill();
  c.strokeStyle = '#495057';
  c.lineWidth = 3;
  c.stroke();
  c.strokeStyle = '#343a40';
  c.lineWidth = 2.5;
  for (let y = 12; y < h - 6; y += 8) line(c, 10, y, w - 10, y);
}

function drawSpringPad(c, w, h) {
  c.fillStyle = '#ff6b6b';
  roundRect(c, 2, 4, w - 4, 16, 6);
  c.fill();
  c.strokeStyle = '#c92a2a';
  c.lineWidth = 2;
  c.stroke();
  c.strokeStyle = '#868e96';
  c.lineWidth = 3;
  c.beginPath();
  for (let i = 0; i <= 8; i++) c.lineTo(i % 2 ? 14 : w - 14, 22 + i * 4.5);
  c.stroke();
  c.fillStyle = '#495057';
  c.fillRect(6, h - 8, w - 12, 8);
}

function drawHelipad(c, w, h) {
  c.fillStyle = '#3d4450';
  c.fillRect(0, 0, w, h);
  c.strokeStyle = '#ffd43b';
  c.lineWidth = 10;
  c.beginPath();
  c.arc(w / 2, h / 2, w / 2 - 18, 0, Math.PI * 2);
  c.stroke();
  c.fillStyle = '#ffffff';
  const s = w / 256;
  c.fillRect(78 * s, 70 * s, 26 * s, 116 * s);
  c.fillRect(152 * s, 70 * s, 26 * s, 116 * s);
  c.fillRect(104 * s, 116 * s, 48 * s, 24 * s);
}

function drawBillboard(c, w, h, b) {
  c.fillStyle = b.bg;
  c.fillRect(0, 0, w, h);
  if (b.icon === 'warn') {
    for (let i = -2; i < 14; i++) {
      c.fillStyle = i % 2 ? '#ffd43b' : '#212529';
      c.beginPath();
      c.moveTo(i * 16, 0);
      c.lineTo(i * 16 + 8, 0);
      c.lineTo(i * 16 - 2, 10);
      c.lineTo(i * 16 - 10, 10);
      c.fill();
      c.beginPath();
      c.moveTo(i * 16, h - 10);
      c.lineTo(i * 16 + 8, h - 10);
      c.lineTo(i * 16 - 2, h);
      c.lineTo(i * 16 - 10, h);
      c.fill();
    }
  }
  drawIcon(c, b.icon, 36, h / 2, b.fg);
  text(c, b.title, 118, h / 2 - 12, { size: 22, color: b.fg, stroke: b.bg === '#212529' ? '#000' : 'rgba(255,255,255,0.9)' });
  text(c, b.sub, 118, h / 2 + 18, { size: 15, color: b.fg, stroke: null });
  c.strokeStyle = 'rgba(0,0,0,0.35)';
  c.lineWidth = 6;
  c.strokeRect(0, 0, w, h);
}

function drawIcon(c, icon, x, y, fg) {
  c.save();
  c.translate(x, y);
  c.lineCap = 'round';
  c.lineJoin = 'round';
  if (icon === 'milk') {
    c.fillStyle = '#ffffff';
    c.fillRect(-14, -14, 28, 34);
    c.beginPath();
    c.moveTo(-14, -14);
    c.lineTo(0, -28);
    c.lineTo(14, -14);
    c.fill();
    c.fillStyle = '#f9a8bd';
    circle(c, 0, 4, 10);
    c.fill();
    c.fillStyle = '#c9607e';
    circle(c, -3, 6, 2);
    c.fill();
    circle(c, 3, 6, 2);
    c.fill();
  } else if (icon === 'net') {
    c.strokeStyle = '#8a5a2b';
    c.lineWidth = 4;
    line(c, -16, 24, 6, -4);
    c.strokeStyle = fg;
    c.lineWidth = 3;
    c.beginPath();
    c.ellipse(12, -14, 12, 14, 0.6, 0, Math.PI * 2);
    c.stroke();
  } else if (icon === 'warn') {
    c.fillStyle = '#ffd43b';
    c.beginPath();
    c.moveTo(0, -26);
    c.lineTo(26, 20);
    c.lineTo(-26, 20);
    c.closePath();
    c.fill();
    text(c, '!', 0, 4, { size: 30, color: '#212529', stroke: null });
  } else if (icon === 'dumbbell') {
    c.fillStyle = fg;
    c.fillRect(-20, -3, 40, 6);
    c.fillRect(-24, -14, 8, 28);
    c.fillRect(16, -14, 8, 28);
  } else if (icon === 'glasses') {
    c.strokeStyle = '#212529';
    c.lineWidth = 4;
    circle(c, -11, 0, 10);
    c.stroke();
    circle(c, 11, 0, 10);
    c.stroke();
    line(c, -1, -2, 1, -2);
  } else if (icon === 'tteok') {
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.ellipse(0, 10, 24, 10, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#e03131';
    for (let i = 0; i < 4; i++) {
      roundRect(c, -18 + i * 9, -8 + (i % 2) * 4, 7, 18, 3);
      c.fill();
    }
  } else if (icon === 'coin') {
    c.fillStyle = '#ffd43b';
    circle(c, 0, 0, 22);
    c.fill();
    c.fillStyle = '#f9a8bd';
    circle(c, 0, 0, 13);
    c.fill();
    c.fillStyle = '#c9607e';
    circle(c, -4, 1, 2.5);
    c.fill();
    circle(c, 4, 1, 2.5);
    c.fill();
  } else if (icon === 'box') {
    c.fillStyle = '#d9a466';
    c.fillRect(-14, -10, 28, 24);
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.ellipse(-20, -10, 10, 5, -0.5, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    c.ellipse(20, -10, 10, 5, 0.5, 0, Math.PI * 2);
    c.fill();
  }
  c.restore();
}

function drawNeon(c, w, h, n) {
  c.fillStyle = 'rgba(20, 10, 30, 0.88)';
  roundRect(c, 4, 4, w - 8, h - 8, 12);
  c.fill();
  c.save();
  c.shadowColor = n.color;
  c.shadowBlur = 14;
  c.strokeStyle = n.color;
  c.lineWidth = 3;
  roundRect(c, 10, 10, w - 20, h - 20, 9);
  c.stroke();
  text(c, n.str, w / 2, h / 2 + 1, { size: 30, color: '#ffffff', stroke: n.color });
  c.restore();
}

function drawShopSign(c, w, h, [name, col]) {
  c.fillStyle = col;
  c.fillRect(0, 0, w, h);
  c.fillStyle = 'rgba(255,255,255,0.18)';
  c.fillRect(0, 0, w, h / 2);
  text(c, name, w / 2, h / 2 + 1, { size: 26, color: '#ffffff', stroke: 'rgba(0,0,0,0.35)' });
  c.strokeStyle = 'rgba(0,0,0,0.35)';
  c.lineWidth = 4;
  c.strokeRect(0, 0, w, h);
}

function drawVSign(c, w, h, [name, col]) {
  c.fillStyle = col;
  c.fillRect(0, 0, w, h);
  c.fillStyle = 'rgba(255,255,255,0.15)';
  c.fillRect(0, 0, w / 2, h);
  const chars = [...name];
  const step = Math.min(40, (h - 16) / chars.length);
  chars.forEach((ch, i) => {
    text(c, ch, w / 2, 8 + step * (i + 0.5), { size: 26, color: '#ffffff', stroke: 'rgba(0,0,0,0.35)' });
  });
  c.strokeStyle = 'rgba(0,0,0,0.35)';
  c.lineWidth = 4;
  c.strokeRect(0, 0, w, h);
}

function drawArch(c, w, h) {
  const g = c.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0, '#ff6fa3');
  g.addColorStop(0.5, '#ffd23f');
  g.addColorStop(1, '#ff6fa3');
  c.fillStyle = g;
  roundRect(c, 4, 8, w - 8, h - 16, 18);
  c.fill();
  c.strokeStyle = '#b23a6b';
  c.lineWidth = 6;
  c.stroke();
  text(c, '★ 골인 ★', w / 2, h / 2 + 2, { size: 46, color: '#ffffff', stroke: '#b23a6b' });
}

function drawBalloon(c, w, h) {
  c.strokeStyle = '#ffffff';
  c.lineWidth = 2;
  line(c, w / 2, h * 0.62, w / 2 + 4, h);
  c.fillStyle = '#ff6fa3';
  c.beginPath();
  c.ellipse(w / 2, h * 0.34, w * 0.36, h * 0.3, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = 'rgba(255,255,255,0.6)';
  c.beginPath();
  c.ellipse(w / 2 - 8, h * 0.24, 5, 9, 0.4, 0, Math.PI * 2);
  c.fill();
}

function drawSearchlight(c, w, h) {
  const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g;
  c.fillRect(0, 0, w, h);
}

// 구름 한 장짜리 텍스처 (3D 구름에 씀)
export function makeCloudCanvas(cloudFn) {
  const cv = document.createElement('canvas');
  cv.width = 256;
  cv.height = 128;
  const c = cv.getContext('2d');
  c.translate(60, 70);
  c.scale(2.2, 2.2);
  cloudFn(c, 0, 0, 1);
  return cv;
}
