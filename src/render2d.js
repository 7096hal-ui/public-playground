// 2D 덧그림: 판정이 있는 모든 것(주인공, 고추, 비둘기, 발판, 함정…)과 글자·HUD.
// 3D 도시 위에 겹쳐 그린다. WebGL이 없으면 예전 2D 배경과 타일도 여기서 그린다.
import { LEVELS, T, ROWS, GROUND } from './levels.js';
import { isMuted } from './audio.js';
import { theme } from './themes.js';
import * as D from './draw.js';
import * as S from './sprites.js';

const VIEW_H = ROWS * T;

export function renderWorld(g) {
  const { ctx, level, player: p, viewW: vw, viewH: vh, t, view: v } = g;
  const th = theme(level.theme);
  if (!g.world3d) D.drawBackground(ctx, v.x, v.y, vw, vh, t, th.fallback);

  ctx.save();
  ctx.scale(g.zoom, g.zoom);
  ctx.translate(-v.x, -v.y);

  if (g.world3d) D.drawHazardTiles(ctx, level, v.x, v.x + v.w);
  else D.drawTiles(ctx, level, v.x, v.x + v.w);

  // 하늘의 번개 (폭풍우)
  if (g.bolt) S.drawBolt(ctx, g.bolt.x, v.y - 40, g.bolt.x + 60, v.y + v.h * 0.3, g.bolt.seed, Math.min(1, g.bolt.life * 6));

  if (level.goal) D.drawGoal(ctx, level.goal, t);
  for (const cp of level.checkpoints) D.drawCheckpoint(ctx, cp, t);
  for (const vt of level.vents) S.drawVent(ctx, vt, t);
  for (const r of level.rods) S.drawRod(ctx, r, t);
  for (const z of level.ziplines) S.drawZipline(ctx, z, level, p.zip && p.zip.line === z);
  for (const pl of level.platforms) {
    if (pl.kind === 'gondola') S.drawGondola(ctx, pl, t);
    else if (pl.kind === 'crumble') S.drawCrumble(ctx, pl, t);
    else D.drawPlatform(ctx, pl);
  }
  for (const s of level.springs) S.drawSpring(ctx, s);
  for (const s of level.wreckingBalls) D.drawWreckingBall(ctx, s);
  for (const c of level.pigeons) D.drawPigeon(ctx, c, t);
  for (const it of level.items) S.drawItem(ctx, it, t);
  for (const f of level.flyers) {
    const k = f.caught ? 1 - f.caughtT / 0.6 : 1;
    if (f.golden && !f.caught) S.drawSparkles(ctx, f.x, f.y, t + f.bx);
    D.drawFlyer(ctx, f.x, f.y, {
      facing: f.facing,
      flap: f.flap,
      panic: f.panic || f.caught,
      t: t + f.bx,
      scale: k * (f.final ? 1.25 : 1),
      alpha: k,
      spin: f.caught ? f.caughtT * 12 : 0,
      golden: f.golden || f.final,
    });
  }
  if (g.boss) {
    S.drawBoss(ctx, g.boss, t);
    for (const sd of g.boss.seeds) S.drawSeed(ctx, sd, t);
  }

  drawPlayer(g, p, t);

  for (const q of g.particles) {
    ctx.globalAlpha = Math.min(1, q.life * 2);
    ctx.fillStyle = q.color;
    ctx.fillRect(q.x - q.size / 2, q.y - q.size / 2, q.size, q.size);
  }
  ctx.globalAlpha = 1;
  drawFireworks(ctx, g.fireworks);
  for (const s of g.texts) {
    ctx.globalAlpha = Math.min(1, s.life * 2);
    D.text(ctx, s.str, s.x, s.y, { size: s.size || 16, color: s.color });
  }
  ctx.globalAlpha = 1;
  if (g.debug) renderDebug(g);
  ctx.restore();

  if (th.rain) drawRain(ctx, vw, vh, t);
  if (g.flash > 0) {
    ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(0.55, g.flash * 0.5)})`;
    ctx.fillRect(0, 0, vw, vh);
  }
  if (g.state !== 'ending') renderHUD(g);
  renderOverlay(g);
}

function drawPlayer(g, p, t) {
  const { ctx } = g;
  const blinkOut = p.invuln > 0 && !p.dead && Math.floor(t * 15) % 2 === 0;
  if (blinkOut) return;
  const cx = p.x + p.w / 2;
  if (p.magnet > 0) S.drawMagnetAura(ctx, cx, p.y + p.h, t);
  if (p.wings > 0 && (p.wings > 2.5 || Math.floor(t * 8) % 2 === 0)) S.drawPigWings(ctx, cx, p.y + p.h, p.facing, t);
  // 그림자 (땅 위에 있을 때)
  if (p.onGround) {
    ctx.fillStyle = 'rgba(20, 10, 30, 0.22)';
    ctx.beginPath();
    ctx.ellipse(cx, p.y + p.h, 11, 3, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  if (p.zip) {
    const pt = p.zip.line.point(p.zip.s);
    S.drawTrolley(ctx, pt.x, pt.y, false);
    ctx.strokeStyle = '#343a40';
    ctx.lineWidth = 2;
    D.line(ctx, pt.x, pt.y + 3, cx, p.y + 2);
  }
  const big = p.bigNet > 0 && (p.bigNet > 2.5 || Math.floor(t * 8) % 2 === 0);
  D.drawHero(ctx, cx, p.y + p.h, {
    facing: p.facing,
    run: p.run,
    air: !p.onGround,
    moving: Math.abs(p.vx) > 10,
    swing: p.swingProgress,
    blink: t % 3.2 < 0.12,
    t,
    hurt: p.dead || p.stun > 0,
    hang: !!p.zip,
    netScale: big ? 1.7 : 1,
  });
}

function drawFireworks(ctx, fireworks) {
  for (const f of fireworks) {
    if (f.stage === 'up') {
      ctx.fillStyle = '#fff6d0';
      ctx.fillRect(f.x - 1.5, f.y - 1.5, 3, 6);
      continue;
    }
    for (const s of f.sparks) {
      ctx.globalAlpha = Math.min(1, s.life);
      ctx.fillStyle = f.color;
      ctx.fillRect(s.x - 1.5, s.y - 1.5, 3, 3);
    }
    ctx.globalAlpha = 1;
  }
}

function drawRain(ctx, vw, vh, t) {
  ctx.save();
  ctx.strokeStyle = 'rgba(200, 215, 235, 0.35)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (let i = 0; i < 90; i++) {
    const h1 = D.hash(i, 3);
    const h2 = D.hash(i, 9);
    const sp = 700 + h2 * 400;
    const x = ((h1 * (vw + 200) - t * 160) % (vw + 200) + vw + 200) % (vw + 200) - 100;
    const y = ((h2 * vh + t * sp) % (vh + 60)) - 30;
    ctx.moveTo(x, y);
    ctx.lineTo(x - 5, y + 18);
  }
  ctx.stroke();
  ctx.restore();
}

// 판정 칸 확인용: 단단한 칸은 빨강, 발판은 노랑, 주인공은 초록
function renderDebug(g) {
  const { ctx, level, view: v } = g;
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(255, 0, 0, 0.9)';
  const c0 = Math.max(0, Math.floor(v.x / T));
  const c1 = Math.min(level.cols - 1, Math.floor((v.x + v.w) / T));
  for (let ty = 0; ty < ROWS; ty++) {
    for (let tx = c0; tx <= c1; tx++) {
      if (level.isSolid(tx, ty)) ctx.strokeRect(tx * T + 0.5, ty * T + 0.5, T - 1, T - 1);
    }
  }
  ctx.strokeStyle = 'rgba(255, 220, 0, 0.9)';
  for (const pl of level.platforms) ctx.strokeRect(pl.x, pl.y, pl.w, pl.h);
  for (const s of level.springs) ctx.strokeRect(s.x, s.y, s.w, s.h);
  const p = g.player;
  ctx.strokeStyle = 'rgba(0, 255, 0, 0.9)';
  ctx.strokeRect(p.x, p.y, p.w, p.h);
}

const fmt = (n) => n.toLocaleString('ko-KR');

function renderHUD(g) {
  const { ctx, viewW: vw, player: p, t } = g;
  if (g.lives <= 6) {
    for (let i = 0; i < Math.max(g.lives, 0); i++) D.drawHeart(ctx, 22 + i * 24, 22, 1.4);
  } else {
    D.drawHeart(ctx, 22, 22, 1.4);
    D.text(ctx, `x ${g.lives}`, 38, 23, { size: 18, align: 'left' });
  }
  // 아이템 남은 시간
  let ix = 22;
  for (const [kind, left, total] of [
    ['net', p.bigNet, 12],
    ['wings', p.wings, 15],
    ['magnet', p.magnet, 12],
  ]) {
    if (left <= 0) continue;
    ctx.fillStyle = 'rgba(30, 10, 40, 0.45)';
    D.circle(ctx, ix, 54, 14);
    ctx.fill();
    ctx.strokeStyle = '#ffd43b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(ix, 54, 14, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (left / total));
    ctx.stroke();
    S.drawPowerIcon(ctx, kind, ix, 54, 0.8, t);
    ix += 34;
  }
  D.text(ctx, `${g.levelIndex + 1}. ${g.level.name}`, vw / 2, 20, { size: 18 });
  D.text(ctx, fmt(g.score), vw / 2, 44, { size: 17, color: '#ffe066' });
  if (g.boss) {
    if (g.boss.state !== 'intro' && g.boss.state !== 'gone') S.drawBossBar(ctx, g.boss, vw / 2, 78, Math.min(260, vw - 140));
  } else {
    D.drawFlyer(ctx, vw - 92, 22, { flap: t * 18, t, scale: 0.8 });
    D.text(ctx, `${g.caught} / ${g.level.totalFlyers}`, vw - 16, 23, { size: 20, align: 'right' });
  }
  if (g.combo >= 2) {
    const k = Math.max(0, g.comboT / 2.2);
    D.text(ctx, `${g.combo} 콤보!`, vw - 16, 50, { size: 16 + Math.min(g.combo, 8), color: '#ff9ec0', align: 'right' });
    ctx.fillStyle = '#ff9ec0';
    ctx.fillRect(vw - 86, 62, 70 * k, 3);
  }
  if (isMuted()) D.text(ctx, '소리 끔 (M)', vw - 16, 80, { size: 12, align: 'right' });
}

function renderOverlay(g) {
  const { ctx, viewW: vw, viewH: vh, state, stateT } = g;
  const cx = vw / 2;
  const cy = vh / 2;
  const blinkOn = Math.floor(g.t * 2.5) % 2 === 0;
  const go = g.touch ? '화면을 누르면' : 'Enter를 누르면';

  if (state === 'intro') {
    const k = Math.min(1, stateT / 0.45);
    const out = Math.max(0, (stateT - 1.9) / 0.5);
    const x = cx + (1 - k) * -vw + out * vw;
    const th = theme(g.level.theme);
    ctx.save();
    ctx.globalAlpha = 1 - out;
    ctx.fillStyle = 'rgba(30, 10, 40, 0.55)';
    ctx.fillRect(0, cy - 58, vw, 116);
    ctx.restore();
    const label = g.level.boss ? '최종 스테이지' : `스테이지 ${g.levelIndex + 1}`;
    D.text(ctx, `${label} · ${th.label}`, x, cy - 26, { size: 20, color: '#ffe066' });
    D.text(ctx, g.level.name, x, cy + 14, { size: 40, color: '#ffffff', stroke: '#b23a6b' });
    if (g.level.boss) D.text(ctx, '대왕 고추가 내리꽂힌 뒤 어질어질할 때 잡아라!', x, cy + 48, { size: 14 });
  } else if (state === 'paused') {
    ctx.fillStyle = 'rgba(30, 10, 40, 0.5)';
    ctx.fillRect(0, 0, vw, vh);
    D.text(ctx, '일시정지', cx, cy - 16, { size: 40 });
    D.text(ctx, g.touch ? '화면을 누르면 계속' : 'P 또는 Enter로 계속', cx, cy + 28, { size: 18 });
  } else if (state === 'clear') {
    renderResults(g, cx, cy, go, blinkOn);
  } else if (state === 'gameover') {
    ctx.fillStyle = `rgba(30, 10, 40, ${Math.min(0.65, stateT)})`;
    ctx.fillRect(0, 0, vw, vh);
    D.text(ctx, '게임 오버', cx, cy - 34, { size: 48, color: '#ff6fa3' });
    D.text(ctx, '꿀꿀이는 지쳐서 잠들었다…', cx, cy + 10, { size: 18 });
    D.text(ctx, `점수 ${fmt(g.score)}  ·  최고 ${fmt(g.hiScore)}`, cx, cy + 40, { size: 16, color: '#ffe066' });
    if (stateT > 1.2 && blinkOn) D.text(ctx, `${go} 이 스테이지부터 다시`, cx, cy + 74, { size: 18 });
  } else if (state === 'ending') {
    renderEnding(g, cx, cy, go, blinkOn);
  }
}

function renderResults(g, cx, cy, go, blinkOn) {
  const { ctx, viewW: vw, stateT, results: r } = g;
  const pw = Math.min(400, vw - 24);
  const rows = r.rows.length;
  const ph = 190 + rows * 24;
  const k = ease(stateT / 0.35);
  const top = cy - ph / 2 + (1 - k) * 40;
  ctx.save();
  ctx.globalAlpha = k;
  D.drawPanel(ctx, cx - pw / 2, top, pw, ph);
  D.text(ctx, g.level.boss ? '보스 격파!' : '스테이지 클리어!', cx, top + 32, { size: 30, color: '#ff6fa3' });
  for (let i = 0; i < 3; i++) {
    const on = g.starsShown > i;
    const sc = on ? 1 + Math.max(0, 0.6 - (stateT - (0.5 + i * 0.35)) * 3) : 1;
    S.drawStar(ctx, cx + (i - 1) * 46, top + 74, 17 * sc, on ? '#ffd43b' : 'rgba(150, 140, 160, 0.35)', on ? '#b8860b' : null);
  }
  r.rows.forEach(([label, pts], i) => {
    const show = stateT > 0.9 + i * 0.22;
    if (!show) return;
    const y = top + 112 + i * 24;
    D.text(ctx, label, cx - pw / 2 + 28, y, { size: 16, color: '#3a2340', stroke: null, align: 'left' });
    if (pts) D.text(ctx, `+${fmt(pts)}`, cx + pw / 2 - 28, y, { size: 16, color: '#2f9e44', stroke: null, align: 'right' });
  });
  const ty = top + 112 + rows * 24 + 8;
  if (stateT > 0.9 + rows * 0.22) {
    D.text(ctx, `점수 ${fmt(g.score)}`, cx, ty + 6, { size: 22, color: '#b23a6b', stroke: null });
    if (r.perfect) D.text(ctx, '전부 잡았다! 목숨 +1', cx, ty + 32, { size: 15, color: '#2f9e44', stroke: null });
  }
  if (stateT > 1.8 && blinkOn) {
    const next = g.levelIndex + 1 < LEVELS.length ? '다음 스테이지' : '엔딩 보기';
    D.text(ctx, `${go} ${next}`, cx, top + ph - 18, { size: 15, color: '#7a5a8a', stroke: null });
  }
  ctx.restore();
}

function renderEnding(g, cx, cy, go, blinkOn) {
  const { ctx, viewW: vw, viewH: vh, stateT, t } = g;
  ctx.fillStyle = `rgba(20, 8, 35, ${Math.min(0.45, stateT * 0.3)})`;
  ctx.fillRect(0, 0, vw, vh);
  const k = ease(stateT / 1.2);
  ctx.save();
  ctx.translate(cx, cy - 92 + (1 - k) * -40);
  ctx.scale(2.2, 2.2);
  const ph = t % 1.2;
  D.drawHero(ctx, 0, 0, { t, swing: ph < 0.4 ? ph / 0.4 : -1, blink: t % 3 < 0.12 });
  ctx.restore();
  D.drawFlyer(ctx, cx + 110 + Math.cos(t * 1.4) * 30, cy - 150 + Math.sin(t * 2.8) * 16, { flap: t * 22, t, scale: 1.6, golden: true });
  S.drawSparkles(ctx, cx + 110 + Math.cos(t * 1.4) * 30, cy - 150 + Math.sin(t * 2.8) * 16, t);
  D.text(ctx, '모든 스테이지 클리어!', cx, cy - 4, { size: 36, color: '#ffe3ef', stroke: '#b23a6b' });
  if (stateT > 0.8) {
    D.text(ctx, `총 점수 ${fmt(g.score)}${g.newHi ? '  ★ 최고 기록!' : ''}`, cx, cy + 38, { size: 22, color: '#ffe066' });
    D.text(ctx, `잡은 고추 ${g.totalCaught} / ${g.totalFlyers}`, cx, cy + 66, { size: 18 });
  }
  if (stateT > 1.6) D.text(ctx, '대왕 고추도 잡았다. 오늘도 하늘의 평화는 지켜졌다. 꿀꿀!', cx, cy + 96, { size: 15 });
  if (stateT > 2.5 && blinkOn) D.text(ctx, `${go} 처음으로`, cx, cy + 128, { size: 16, color: '#ffd43b' });
}

const ease = (k) => 1 - Math.pow(1 - Math.min(1, Math.max(0, k)), 3);

export function renderTitle(g) {
  const { ctx, viewW: vw, viewH: vh, t } = g;
  const camY = VIEW_H - vh;
  const groundY = GROUND * T - camY;
  if (!g.world3d) {
    D.drawBackground(ctx, t * 40, camY, vw, vh, t);
    D.drawRoofStrip(ctx, groundY, vw, vh - groundY);
  }
  const cx = vw / 2;
  const top = Math.max(20, groundY - 400);
  const bob = Math.sin(t * 2) * 3;
  D.text(ctx, TITLE_TEXT, cx, top + 50 + bob, { size: Math.min(60, vw / 8), color: '#ffe3ef', stroke: '#b23a6b' });
  D.text(ctx, 'ver.3 · 3D 스카이라인', cx + Math.min(150, vw / 4), top + 84, { size: 14, color: '#ffe066' });
  D.text(ctx, '도심 옥상을 뛰어다니며 하늘을 나는 고추를 잡아라!', cx, top + 112, { size: 18 });

  // 주인공과 고추가 쫓고 쫓기는 장면
  const heroX = cx - 70 + Math.sin(t * 0.8) * 30;
  const phase = t % 1.6;
  ctx.save();
  ctx.translate(heroX, groundY);
  ctx.scale(2.4, 2.4);
  D.drawHero(ctx, 0, 0, { t, swing: phase < 0.3 ? phase / 0.3 : -1, blink: t % 3 < 0.12 });
  ctx.restore();
  D.drawFlyer(ctx, cx + 90 + Math.cos(t * 1.3) * 40, groundY - 150 + Math.sin(t * 2.6) * 25, {
    facing: Math.sin(t * 1.3) > 0 ? -1 : 1,
    flap: t * 25,
    t,
    scale: 2.2,
    panic: true,
  });

  const help = g.touch
    ? '◀ ▶ 이동 · 점프 버튼 · 잠자리채 버튼'
    : '← → 이동   Space/Z 점프   X 잠자리채   P 일시정지   M 소리';
  D.text(ctx, help, cx, groundY + 24, { size: 15 });
  if (Math.floor(t * 2.5) % 2 === 0) {
    D.text(ctx, g.touch ? '화면을 눌러서 시작!' : 'Enter를 눌러서 시작!', cx, groundY + 52, { size: 20, color: '#ffd23f' });
  }
  if (g.hiScore > 0) D.text(ctx, `최고 점수 ${fmt(g.hiScore)}`, vw - 16, 22, { size: 15, color: '#ffe066', align: 'right' });
  if (g.touch && vh > vw) D.text(ctx, '휴대폰을 가로로 돌리면 더 넓게 보여요', cx, top + 140, { size: 14 });
}

const TITLE_TEXT = '꿀꿀 고추 사냥';
