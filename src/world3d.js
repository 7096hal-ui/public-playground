// 3D 도시 렌더러 (three.js / WebGL).
// 판정은 전부 2D 평면(z = 0)에서 한다. 이 모듈은 그 평면과 그 뒤의 입체 도시만 그린다.
//  - 판정용 건물·실외기·비계의 앞면은 정확히 z = 0에 놓는다.
//  - 카메라는 기울이지 않고 언제나 -z 방향을 정면으로 본다. 눈높이는 렌즈 시프트로 올린다.
//    그래서 z = 0 평면은 화면에 "확대 + 이동"만으로 대응되고, 위에 겹친 2D 캔버스
//    (주인공·고추·비둘기·HUD)와 픽셀 단위로 맞는다.
// 좌표: 3D x = 2D x, 3D y = -(2D y), 3D z는 화면 안쪽이 음수.
import * as THREE from 'three';
import { T, ROWS } from './levels.js';
import { theme as getTheme } from './themes.js';
import { Atlas, R, BILLBOARDS, NEONS, SIGNS, VSIGNS, makeCloudCanvas } from './atlas.js';
import { cloud, hash } from './draw.js';

const STREET = 2600; // 저 아래 도로 높이 (2D y)
const NEAR = 20;
const FAR = 40000;

THREE.ColorManagement.enabled = false; // 2D 캔버스 색을 그대로 쓰기 위해 색 변환을 끈다

const WALL_COLORS = ['#dccaa8', '#a3b8cb', '#cc917b', '#bcc0c7', '#97bb9f', '#d8ad70'];
const ROOF_COLORS = ['#5e9c6c', '#9ea3aa', '#6e8f73', '#a39a8c', '#4f8a8b', '#8f949b'];

const col = (hex) => {
  const c = new THREE.Color(hex);
  return [c.r, c.g, c.b];
};
const v3 = (hex) => new THREE.Vector3(...col(hex));

// ───────────────────────── 셰이더 ─────────────────────────

const COMMON = /* glsl */ `
uniform float uTime;
uniform float uNight;
uniform float uLit;
uniform float uFlash;
uniform vec3 uSunDir;
uniform vec3 uSunCol;
uniform vec3 uAmb;
uniform float uSkyLight;
uniform vec3 uFogCol;
uniform vec2 uFog;
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
vec3 shade(vec3 c, vec3 n) {
  float d = max(dot(n, uSunDir), 0.0);
  return c * (uAmb + uSunCol * d + uSkyLight * max(n.y, 0.0) + vec3(uFlash));
}
vec3 fogged(vec3 c, float dist) {
  return mix(c, uFogCol, smoothstep(uFog.x, uFog.y, dist));
}
float inRect(vec2 f, vec4 r) {
  return step(r.x, f.x) * step(f.x, r.z) * step(r.y, f.y) * step(f.y, r.w);
}
`;

// 판정용 건물: 2D 버전과 같은 창문 무늬를 셰이더로 그린다.
const BUILDING_VS = /* glsl */ `
attribute vec3 aCol;
attribute vec4 aA; // x0, x1, 옥상 y(2D), 깊이
attribute vec4 aB; // 창문 모양, 옥상 색 번호, 씨앗, 종류(0 건물, 1 난간)
varying vec3 vWorld;
varying vec3 vN;
varying vec3 vCol;
varying vec4 vA;
varying vec4 vB;
varying float vDist;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  vN = normal;
  vCol = aCol;
  vA = aA;
  vB = aB;
  vec4 mv = viewMatrix * wp;
  vDist = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;

const BUILDING_FS = /* glsl */ `
${COMMON}
uniform vec3 uGlassDay;
uniform vec3 uGlassLit;
uniform vec3 uGlassDark;
uniform vec3 uFrameNight;
uniform vec3 uPar0;
uniform vec3 uPar1;
uniform vec3 uPar2;
uniform vec3 uRoofCols[6];
varying vec3 vWorld;
varying vec3 vN;
varying vec3 vCol;
varying vec4 vA;
varying vec4 vB;
varying float vDist;

vec4 facade(vec2 p, float style, float seed, vec3 wall) {
  vec3 dark = wall * vec3(0.76, 0.72, 0.66);
  vec2 cell = floor(p / 32.0);
  vec2 f = p - cell * 32.0;
  float lit = step(hash12(cell + seed * 7.13), uLit);
  vec3 frame = mix(dark, uFrameNight, uNight);
  vec3 glass = mix(uGlassDay, mix(uGlassDark, uGlassLit, lit), uNight);
  vec3 c = wall;
  float g = 0.0;
  if (style < 0.5) {
    if (inRect(f, vec4(7.0, 9.0, 25.0, 25.0)) > 0.5) c = frame;
    g = inRect(f, vec4(9.0, 11.0, 23.0, 23.0));
  } else if (style < 1.5) {
    if (inRect(f, vec4(4.0, 8.0, 14.0, 26.0)) + inRect(f, vec4(18.0, 8.0, 28.0, 26.0)) > 0.5) c = frame;
    g = max(inRect(f, vec4(5.5, 9.5, 12.5, 24.5)), inRect(f, vec4(19.5, 9.5, 26.5, 24.5)));
  } else {
    if (inRect(f, vec4(0.0, 11.0, 32.0, 25.0)) > 0.5) c = frame;
    g = inRect(f, vec4(0.0, 12.5, 32.0, 23.5)) * (1.0 - inRect(f, vec4(15.0, 12.0, 17.0, 24.0)));
  }
  if (g > 0.5) {
    // 낮에는 하늘이 비치는 유리
    vec3 sky = glass + (1.0 - uNight) * 0.12 * (1.0 - f.y / 32.0);
    return vec4(sky, lit * uNight);
  }
  return vec4(c, 0.0);
}

vec3 parapet(float dv) {
  return dv < 2.0 ? uPar2 : (dv < 7.0 ? uPar0 : uPar1);
}

void main() {
  vec3 n = normalize(vN);
  float u = vWorld.x;
  float v = -vWorld.y;
  float w = -vWorld.z;
  vec3 c;
  float emit = 0.0;
  if (vB.w > 0.5) {
    // 옥상 난간
    c = n.y > 0.5 ? uPar2 : uPar0;
  } else if (n.y > 0.5) {
    // 옥상 바닥 (한국 옥상 방수 페인트 느낌)
    c = uRoofCols[int(vB.y)];
    vec2 rp = vec2(u, w);
    vec2 gl = abs(fract(rp / 32.0 + 0.5) - 0.5) * 32.0;
    c *= 1.0 - 0.1 * (1.0 - step(0.8, min(gl.x, gl.y)));
    c *= 0.95 + 0.05 * hash12(floor(rp / 6.0));
    // 앞쪽 가장자리는 2D와 같은 밝은 난간 띠
    if (w < 3.0) c = uPar2;
  } else if (n.z > 0.5) {
    vec4 fc = facade(vec2(u, v), vB.x, vB.z, vCol);
    c = fc.rgb;
    emit = fc.a;
    if (u - vA.x < 3.0 || vA.y - u < 3.0) {
      c = mix(vCol * vec3(0.76, 0.72, 0.66), uFrameNight, uNight);
      emit = 0.0;
    }
    float dv = v - vA.z;
    if (dv < 9.0) {
      c = parapet(dv);
      emit = 0.0;
    }
  } else {
    vec4 fc = facade(vec2(w + 7.0, v), vB.x, vB.z + 3.0, vCol);
    c = fc.rgb;
    emit = fc.a;
    if (w < 3.0) {
      c = mix(vCol * vec3(0.76, 0.72, 0.66), uFrameNight, uNight);
      emit = 0.0;
    }
    float dv = v - vA.z;
    if (dv < 9.0) {
      c = parapet(dv);
      emit = 0.0;
    }
  }
  vec3 outc = mix(shade(c, n), c * 1.1, emit);
  gl_FragColor = vec4(fogged(outc, vDist), 1.0);
}
`;

// 배경 빌딩(인스턴스): 창문은 월드 좌표로 셰이더에서 그린다.
const BG_VS = /* glsl */ `
attribute vec3 iCol;
attribute vec4 iInfo; // 창문 가로, 세로, 씨앗, 옥상 표시
varying vec3 vWorld;
varying vec3 vN;
varying vec3 vCol;
varying vec4 vInfo;
varying float vDist;
void main() {
  vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  vN = normal;
  vCol = iCol;
  vInfo = iInfo;
  vec4 mv = viewMatrix * wp;
  vDist = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;

const BG_FS = /* glsl */ `
${COMMON}
uniform vec3 uWinDay;
uniform vec3 uWinLit;
uniform vec3 uWinDark;
varying vec3 vWorld;
varying vec3 vN;
varying vec3 vCol;
varying vec4 vInfo;
varying float vDist;
void main() {
  vec3 n = normalize(vN);
  vec3 c = vCol;
  float emit = 0.0;
  if (n.y < 0.5) {
    vec2 p = abs(n.z) > 0.5 ? vec2(vWorld.x, vWorld.y) : vec2(vWorld.z, vWorld.y);
    vec2 cs = vInfo.xy;
    vec2 cell = floor(p / cs);
    vec2 f = (p - cell * cs) / cs;
    float win = inRect(f, vec4(0.22, 0.25, 0.78, 0.72));
    if (win > 0.5) {
      float h = hash12(cell + vInfo.z);
      float lit = step(h, uLit * 1.1);
      vec3 tint = mix(uWinLit, vec3(0.75, 0.95, 1.0), step(0.85, hash12(cell * 1.7 + vInfo.z)));
      c = mix(mix(uWinDay, vCol * 1.15, 0.35), mix(uWinDark, tint, lit), uNight);
      emit = lit * uNight;
    }
  } else {
    c *= 0.8;
  }
  vec3 outc = mix(shade(c, n), c, emit);
  gl_FragColor = vec4(fogged(outc, vDist), 1.0);
}
`;

// 꼭짓점 색을 가진 소품 (물탱크, 안테나, 옥탑방, 비계 기둥…)
const PROP_VS = /* glsl */ `
attribute vec3 aCol;
attribute vec4 aA; // 밤 발광, 낮 발광
varying vec3 vN;
varying vec3 vCol;
varying vec4 vA;
varying float vDist;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vN = normal;
  vCol = aCol;
  vA = aA;
  vec4 mv = viewMatrix * wp;
  vDist = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;

const PROP_FS = /* glsl */ `
${COMMON}
varying vec3 vN;
varying vec3 vCol;
varying vec4 vA;
varying float vDist;
void main() {
  vec3 n = normalize(vN);
  float emit = clamp(vA.x * uNight + vA.y, 0.0, 1.0);
  vec3 outc = mix(shade(vCol, n), vCol * 1.15, emit);
  gl_FragColor = vec4(fogged(outc, vDist), 1.0);
}
`;

// 아틀라스 그림을 붙인 판 (실외기 앞면, 간판, 광고판…)
const DECAL_VS = /* glsl */ `
attribute vec4 aA; // 밤 발광, 낮 발광
varying vec2 vUv;
varying vec3 vN;
varying vec4 vA;
varying float vDist;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vUv = uv;
  vN = normal;
  vA = aA;
  vec4 mv = viewMatrix * wp;
  vDist = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;

const DECAL_FS = /* glsl */ `
${COMMON}
uniform sampler2D uMap;
varying vec2 vUv;
varying vec3 vN;
varying vec4 vA;
varying float vDist;
void main() {
  vec4 t = texture2D(uMap, vUv);
  if (t.a < 0.5) discard;
  float emit = clamp(vA.x * uNight + vA.y, 0.0, 1.0);
  vec3 outc = mix(shade(t.rgb, normalize(vN)), t.rgb * 1.2, emit);
  gl_FragColor = vec4(fogged(outc, vDist), 1.0);
}
`;

// 빛 번짐(가산 혼합 빌보드): 안테나 불빛, 네온 후광, 창문 반짝임
const GLOW_VS = /* glsl */ `
attribute vec3 aCol;
attribute vec4 aA; // 크기, 깜빡임 속도, 위상, 밤에만(1)
varying vec2 vC;
varying vec3 vCol;
varying float vDist;
uniform float uTime;
uniform float uNight;
void main() {
  float blink = aA.y > 0.0 ? step(0.45, fract(uTime * aA.y + aA.z)) : 1.0;
  float vis = mix(1.0, uNight, aA.w) * blink;
  vec4 mv = viewMatrix * modelMatrix * vec4(position, 1.0);
  mv.xy += uv * aA.x;
  vC = uv;
  vCol = aCol * vis;
  vDist = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;

const GLOW_FS = /* glsl */ `
uniform vec2 uFog;
varying vec2 vC;
varying vec3 vCol;
varying float vDist;
void main() {
  float d = length(vC);
  float a = max(0.0, 1.0 - d);
  a = a * a;
  float f = 1.0 - 0.7 * smoothstep(uFog.x, uFog.y * 1.5, vDist);
  gl_FragColor = vec4(vCol * a * f, 1.0);
}
`;

// 하늘: 화면 전체를 덮는 사각형. 해·달·별은 무한히 멀어서 화면에 고정해 그린다.
const SKY_VS = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.9999, 1.0);
}
`;

const SKY_FS = /* glsl */ `
uniform vec3 uTop;
uniform vec3 uMid;
uniform vec3 uHor;
uniform vec3 uBelow;
uniform float uHorizon;
uniform vec2 uSun;
uniform vec3 uSunC;
uniform float uSunSize;
uniform float uSunGlow;
uniform float uMoon;
uniform float uStars;
uniform float uTime;
uniform float uFlash;
uniform vec2 uRes;
varying vec2 vUv;
float h12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
void main() {
  float h = vUv.y - uHorizon;
  vec3 c;
  if (h > 0.0) {
    float k = clamp(h / max(1.0 - uHorizon, 0.2), 0.0, 1.0);
    c = mix(uHor, uMid, smoothstep(0.0, 0.45, k));
    c = mix(c, uTop, smoothstep(0.35, 1.0, k));
  } else {
    c = mix(uHor, uBelow, smoothstep(0.0, 0.3, -h));
  }
  vec2 px = vUv * uRes;
  if (uStars > 0.0) {
    vec2 cell = floor(px / 4.0);
    float s = h12(cell);
    float tw = 0.6 + 0.4 * sin(uTime * 2.0 + s * 40.0);
    float star = step(0.9965, s) * tw * smoothstep(0.0, 0.25, h);
    c += vec3(star) * uStars;
  }
  if (uSunSize > 0.0) {
    float d = length(px - uSun * uRes) / uRes.y;
    c += uSunC * uSunGlow * exp(-d * 5.0) * 0.6;
    c += uSunC * uSunGlow * exp(-d * 18.0) * 0.5;
    float disc = smoothstep(uSunSize, uSunSize * 0.94, d);
    vec3 face = uSunC;
    if (uMoon > 0.5) {
      vec2 q = (px - uSun * uRes) / uRes.y / uSunSize;
      float cr = smoothstep(0.24, 0.2, length(q - vec2(-0.3, 0.25))) + smoothstep(0.16, 0.12, length(q - vec2(0.28, -0.3)));
      face = mix(face, face * 0.82, clamp(cr, 0.0, 1.0));
    }
    c = mix(c, face, disc);
  }
  c += vec3(uFlash);
  gl_FragColor = vec4(c, 1.0);
}
`;

// 구름: 아틀라스와 따로, 구름 그림 한 장을 여러 번 찍는다. 시간에 따라 천천히 흐른다.
const CLOUD_VS = /* glsl */ `
attribute vec4 aA; // 크기 x, 크기 y, 흐름 속도, 범위
varying vec2 vUv;
varying float vDist;
uniform float uTime;
uniform float uCamX;
void main() {
  vec3 p = position;
  float range = aA.w;
  p.x = uCamX - range * 0.5 + mod(p.x + uTime * aA.z - uCamX + range * 0.5, range);
  vec4 mv = viewMatrix * modelMatrix * vec4(p, 1.0);
  mv.xy += (uv - 0.5) * aA.xy;
  vUv = uv;
  vDist = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;

const CLOUD_FS = /* glsl */ `
uniform sampler2D uMap;
uniform vec3 uCloud;
uniform vec3 uCloudShade;
uniform float uAlpha;
uniform vec3 uFogCol;
uniform vec2 uFog;
uniform float uFlash;
varying vec2 vUv;
varying float vDist;
void main() {
  vec4 t = texture2D(uMap, vUv);
  vec3 c = mix(uCloudShade, uCloud, smoothstep(0.15, 0.75, vUv.y)) * (0.75 + 0.25 * t.r) + vec3(uFlash * 0.6);
  c = mix(c, uFogCol, smoothstep(uFog.x, uFog.y * 1.6, vDist) * 0.6);
  gl_FragColor = vec4(c, t.a * uAlpha);
}
`;

// 비: 카메라를 따라다니는 빗줄기 상자
const RAIN_VS = /* glsl */ `
attribute vec4 aA; // 씨앗 x, y, z, 꼬리(0/1)
uniform float uTime;
uniform vec3 uCam;
varying float vA;
void main() {
  vec3 box = vec3(2600.0, 1400.0, 1800.0);
  vec3 p = aA.xyz * box;
  float sp = 1100.0 + aA.x * 300.0;
  p.y = mod(p.y - uTime * sp, box.y);
  p.x = mod(p.x + uTime * 140.0 - uCam.x, box.x);
  vec3 wp = vec3(uCam.x - box.x * 0.5 + p.x, uCam.y - box.y * 0.6 + p.y, 200.0 - p.z);
  wp += aA.w * vec3(-5.0, 34.0, 0.0);
  vec4 mv = viewMatrix * vec4(wp, 1.0);
  vA = 0.35 * (1.0 - aA.z * 0.6);
  gl_Position = projectionMatrix * mv;
}
`;

const RAIN_FS = /* glsl */ `
varying float vA;
void main() {
  gl_FragColor = vec4(0.75, 0.82, 0.9, vA);
}
`;

// ───────────────────────── 형상 만들기 ─────────────────────────

const Z4 = [0, 0, 0, 0];

function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function normz(a) {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
}

// 사각형·상자·원기둥을 모아 BufferGeometry 하나로 만든다(그리기 호출을 줄이려고).
class Geo {
  constructor() {
    this.p = [];
    this.n = [];
    this.c = [];
    this.uv = [];
    this.a = [];
    this.b = [];
    this.i = [];
    this.count = 0;
  }

  vert(p, n, c, uv, a, b) {
    this.p.push(p[0], p[1], p[2]);
    this.n.push(n[0], n[1], n[2]);
    this.c.push(c[0], c[1], c[2]);
    this.uv.push(uv[0], uv[1]);
    this.a.push(a[0], a[1], a[2], a[3]);
    this.b.push(b[0], b[1], b[2], b[3]);
    return this.count++;
  }

  // o에서 u, v 방향으로 펼친 사각형. 법선은 u × v 방향.
  quad(o, u, v, c, uvr = [0, 0, 1, 1], a = Z4, b = Z4) {
    const n = normz(cross(u, v));
    const p1 = [o[0] + u[0], o[1] + u[1], o[2] + u[2]];
    const p2 = [p1[0] + v[0], p1[1] + v[1], p1[2] + v[2]];
    const p3 = [o[0] + v[0], o[1] + v[1], o[2] + v[2]];
    const [u0, v0, u1, v1] = uvr;
    const k = this.vert(o, n, c, [u0, v0], a, b);
    this.vert(p1, n, c, [u1, v0], a, b);
    this.vert(p2, n, c, [u1, v1], a, b);
    this.vert(p3, n, c, [u0, v1], a, b);
    this.i.push(k, k + 1, k + 2, k, k + 2, k + 3);
  }

  // 축에 나란한 상자. y는 위쪽이 +, z1이 앞면. faces: F(앞) K(뒤) L R T(위) D(아래)
  box(x0, y0, z0, x1, y1, z1, c, faces = 'FKLRT', a = Z4, b = Z4) {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const dz = z1 - z0;
    if (faces.includes('F')) this.quad([x0, y0, z1], [dx, 0, 0], [0, dy, 0], c, undefined, a, b);
    if (faces.includes('K')) this.quad([x1, y0, z0], [-dx, 0, 0], [0, dy, 0], c, undefined, a, b);
    if (faces.includes('R')) this.quad([x1, y0, z1], [0, 0, -dz], [0, dy, 0], c, undefined, a, b);
    if (faces.includes('L')) this.quad([x0, y0, z0], [0, 0, dz], [0, dy, 0], c, undefined, a, b);
    if (faces.includes('T')) this.quad([x0, y1, z1], [dx, 0, 0], [0, 0, -dz], c, undefined, a, b);
    if (faces.includes('D')) this.quad([x0, y0, z0], [dx, 0, 0], [0, 0, dz], c, undefined, a, b);
  }

  // 세운 원기둥(뚜껑 포함)
  cyl(cx, cz, y0, y1, r, seg, c, a = Z4, b = Z4, cap = c) {
    const ring = [];
    for (let k = 0; k <= seg; k++) {
      const t = (k / seg) * Math.PI * 2;
      ring.push([cx + Math.cos(t) * r, cz + Math.sin(t) * r]);
    }
    for (let k = 0; k < seg; k++) {
      const [ax, az] = ring[k];
      const [bx, bz] = ring[k + 1];
      // 바깥을 향하도록 u는 b→a 방향
      this.quad([bx, y0, bz], [ax - bx, 0, az - bz], [0, y1 - y0, 0], c, undefined, a, b);
    }
    const n = [0, 1, 0];
    const k0 = this.vert([cx, y1, cz], n, cap, [0.5, 0.5], a, b);
    for (let k = 0; k <= seg; k++) this.vert([ring[k][0], y1, ring[k][1]], n, cap, [0, 0], a, b);
    for (let k = 0; k < seg; k++) this.i.push(k0, k0 + 2 + k, k0 + 1 + k);
  }

  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('aCol', new THREE.Float32BufferAttribute(this.c, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('aA', new THREE.Float32BufferAttribute(this.a, 4));
    g.setAttribute('aB', new THREE.Float32BufferAttribute(this.b, 4));
    g.setIndex(this.i);
    return g;
  }
}

// 결정적인 난수 (같은 스테이지는 언제나 같은 도시)
function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ───────────────────────── 렌더러 ─────────────────────────

export class World3D {
  constructor(canvas, { lowPower = false } = {}) {
    this.canvas = canvas;
    this.lowPower = lowPower;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: !lowPower,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.renderer.setClearColor(0x000000, 1);
    this.renderer.sortObjects = true;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera();
    this.camera.matrixAutoUpdate = true;
    this.maxDpr = lowPower ? 1.5 : 2;
    this.quality = 1; // 느리면 자동으로 낮춘다
    this.levelObjs = [];
    this.levelKey = null;
    this.themeName = null;
    this.flash = 0;

    this.atlas = new Atlas();
    this.atlasTex = new THREE.CanvasTexture(this.atlas.canvas);
    this.atlasTex.colorSpace = THREE.NoColorSpace;
    this.atlasTex.anisotropy = 4;
    this.cloudTex = new THREE.CanvasTexture(makeCloudCanvas(cloud));
    this.cloudTex.colorSpace = THREE.NoColorSpace;

    const U = {
      uTime: { value: 0 },
      uNight: { value: 0 },
      uLit: { value: 0 },
      uFlash: { value: 0 },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uSunCol: { value: new THREE.Vector3(0.5, 0.5, 0.5) },
      uAmb: { value: new THREE.Vector3(0.7, 0.7, 0.7) },
      uSkyLight: { value: 0.1 },
      uFogCol: { value: new THREE.Vector3(0.8, 0.85, 0.9) },
      uFog: { value: new THREE.Vector2(500, 6000) },
    };
    this.U = U;
    this.mats = {
      building: new THREE.ShaderMaterial({
        vertexShader: BUILDING_VS,
        fragmentShader: BUILDING_FS,
        uniforms: {
          ...U,
          uGlassDay: { value: v3('#cfe7fb') },
          uGlassLit: { value: v3('#ffd66b') },
          uGlassDark: { value: v3('#29326a') },
          uFrameNight: { value: v3('#141836') },
          uPar0: { value: v3('#eceef1') },
          uPar1: { value: v3('#6b7280') },
          uPar2: { value: v3('#ffffff') },
          uRoofCols: { value: ROOF_COLORS.map(v3) },
        },
      }),
      bg: new THREE.ShaderMaterial({
        vertexShader: BG_VS,
        fragmentShader: BG_FS,
        uniforms: {
          ...U,
          uWinDay: { value: v3('#8fa9c4') },
          uWinLit: { value: v3('#ffd66b') },
          uWinDark: { value: v3('#1d2350') },
        },
      }),
      prop: new THREE.ShaderMaterial({ vertexShader: PROP_VS, fragmentShader: PROP_FS, uniforms: { ...U } }),
      decal: new THREE.ShaderMaterial({
        vertexShader: DECAL_VS,
        fragmentShader: DECAL_FS,
        uniforms: { ...U, uMap: { value: this.atlasTex } },
        side: THREE.DoubleSide,
      }),
      glow: new THREE.ShaderMaterial({
        vertexShader: GLOW_VS,
        fragmentShader: GLOW_FS,
        uniforms: { uTime: U.uTime, uNight: U.uNight, uFog: U.uFog },
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
      }),
      cloud: new THREE.ShaderMaterial({
        vertexShader: CLOUD_VS,
        fragmentShader: CLOUD_FS,
        uniforms: {
          uTime: U.uTime,
          uFlash: U.uFlash,
          uFogCol: U.uFogCol,
          uFog: U.uFog,
          uCamX: { value: 0 },
          uMap: { value: this.cloudTex },
          uCloud: { value: v3('#ffffff') },
          uCloudShade: { value: v3('#dddddd') },
          uAlpha: { value: 1 },
        },
        transparent: true,
        depthWrite: false,
      }),
      rain: new THREE.ShaderMaterial({
        vertexShader: RAIN_VS,
        fragmentShader: RAIN_FS,
        uniforms: { uTime: U.uTime, uCam: { value: new THREE.Vector3() } },
        transparent: true,
        depthWrite: false,
      }),
      sky: new THREE.ShaderMaterial({
        vertexShader: SKY_VS,
        fragmentShader: SKY_FS,
        uniforms: {
          uTop: { value: new THREE.Vector3() },
          uMid: { value: new THREE.Vector3() },
          uHor: { value: new THREE.Vector3() },
          uBelow: { value: new THREE.Vector3() },
          uHorizon: { value: 0.6 },
          uSun: { value: new THREE.Vector2(0.5, 0.8) },
          uSunC: { value: new THREE.Vector3(1, 1, 1) },
          uSunSize: { value: 0.05 },
          uSunGlow: { value: 0.3 },
          uMoon: { value: 0 },
          uStars: { value: 0 },
          uTime: U.uTime,
          uFlash: U.uFlash,
          uRes: { value: new THREE.Vector2(1, 1) },
        },
        depthWrite: false,
        depthTest: false,
      }),
    };

    // 하늘은 언제나 맨 먼저 그린다.
    const sky = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mats.sky);
    sky.frustumCulled = false;
    sky.renderOrder = -10;
    this.scene.add(sky);

    // 비 (폭풍 스테이지에서만 보인다)
    const drops = 1600;
    const ra = new Float32Array(drops * 2 * 4);
    const rp = new Float32Array(drops * 2 * 3);
    const r = rng(77);
    for (let k = 0; k < drops; k++) {
      const x = r();
      const y = r();
      const z = r();
      ra.set([x, y, z, 0, x, y, z, 1], k * 8);
    }
    const rg = new THREE.BufferGeometry();
    rg.setAttribute('position', new THREE.BufferAttribute(rp, 3));
    rg.setAttribute('aA', new THREE.BufferAttribute(ra, 4));
    this.rain = new THREE.LineSegments(rg, this.mats.rain);
    this.rain.frustumCulled = false;
    this.rain.renderOrder = 5;
    this.rain.visible = false;
    this.scene.add(this.rain);

    // 아래쪽 도로 바닥 (멀리서 보이는 도시 바닥)
    const ground = new Geo();
    ground.quad([-20000, -STREET, 2000], [60000, 0, 0], [0, 0, -40000], col('#3b3f4a'));
    this.ground = new THREE.Mesh(ground.build(), this.mats.prop);
    this.ground.frustumCulled = false;
    this.scene.add(this.ground);
  }

  // 글꼴이 늦게 도착했으면 간판 글자를 다시 그린다.
  redrawAtlas() {
    this.atlas.redraw();
    this.atlasTex.needsUpdate = true;
  }

  setSize(w, h, dpr) {
    this.cssW = w;
    this.cssH = h;
    this.dpr = dpr;
    this.applySize();
  }

  applySize() {
    const pr = Math.min(this.dpr, this.maxDpr) * this.quality;
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(this.cssW, this.cssH, false);
    this.mats.sky.uniforms.uRes.value.set(this.cssW * pr, this.cssH * pr);
  }

  // 프레임이 계속 느리면 해상도를 낮춘다.
  lowerQuality() {
    if (this.quality <= 0.55) return false;
    this.quality = Math.max(0.55, this.quality - 0.2);
    this.applySize();
    return true;
  }

  setTheme(name) {
    if (this.themeName === name) return;
    this.themeName = name;
    const th = getTheme(name);
    const U = this.U;
    U.uNight.value = th.night;
    U.uLit.value = th.lit;
    U.uSunDir.value.set(...th.light.dir).normalize();
    U.uSunCol.value.set(...col(th.light.sun));
    U.uAmb.value.set(...col(th.light.amb));
    U.uSkyLight.value = th.light.sky;
    U.uFogCol.value.set(...col(th.fog[0]));
    U.uFog.value.set(th.fog[1], th.fog[2]);
    const s = this.mats.sky.uniforms;
    s.uTop.value.set(...col(th.sky.top));
    s.uMid.value.set(...col(th.sky.mid));
    s.uHor.value.set(...col(th.sky.horizon));
    s.uBelow.value.set(...col(th.sky.below));
    s.uSunC.value.set(...col(th.sun.color));
    s.uSunSize.value = th.sun.size;
    s.uSunGlow.value = th.sun.glow;
    s.uMoon.value = th.sun.moon;
    s.uStars.value = th.stars;
    this.sunCfg = th.sun;
    const b = this.mats.building.uniforms;
    b.uPar0.value.set(...col(th.parapet[0]));
    b.uPar1.value.set(...col(th.parapet[1]));
    b.uPar2.value.set(...col(th.parapet[2]));
    const c = this.mats.cloud.uniforms;
    c.uCloud.value.set(...col(th.clouds.color));
    c.uCloudShade.value.set(...col(th.clouds.shade));
    c.uAlpha.value = th.clouds.alpha;
    this.rain.visible = th.rain > 0;
    this.ground.material = this.mats.prop;
  }

  disposeLevel() {
    for (const o of this.levelObjs) {
      this.scene.remove(o);
      o.geometry.dispose();
      if (o.isInstancedMesh) o.dispose(); // 인스턴스 버퍼도 비운다
    }
    this.levelObjs = [];
  }

  add(obj) {
    obj.frustumCulled = false;
    this.scene.add(obj);
    this.levelObjs.push(obj);
    return obj;
  }

  // 스테이지의 2D 타일맵으로 3D 도시를 만든다. 같은 스테이지면 다시 만들지 않는다.
  buildLevel(level, key) {
    this.setTheme(level.theme);
    if (this.levelKey === key) return;
    this.levelKey = key;
    this.disposeLevel();
    const th = getTheme(level.theme);
    const seed = hash(level.cols, key.length * 31 + level.name.length) * 1e9;
    const rand = rng(seed);
    const B = new Geo(); // 판정용 건물
    const P = new Geo(); // 소품
    const Dc = new Geo(); // 그림 판
    const G = new Geo(); // 빛 번짐
    const boxes = this.findBuildings(level);
    boxes.forEach((bx, i) => {
      bx.depth = level.boss ? 448 : 160 + Math.floor(rand() * 5) * 32;
      bx.color = WALL_COLORS[(i * 7 + 3) % WALL_COLORS.length];
      bx.style = (i * 7 + 3) % 3;
      bx.roof = Math.floor(rand() * ROOF_COLORS.length);
      this.addBuilding(B, P, bx, i);
    });
    // 옥상 소품과 간판
    boxes.forEach((bx, i) => {
      if (bx.toBottom) this.decorateRoof(P, Dc, G, bx, rng(seed + i * 101), level, th);
    });
    this.addTiles(level, P, Dc);
    this.addLandmarks(level, boxes, P, Dc, G, th);
    this.add(new THREE.Mesh(B.build(), this.mats.building));
    if (P.count) this.add(new THREE.Mesh(P.build(), this.mats.prop));
    if (Dc.count) this.add(new THREE.Mesh(Dc.build(), this.mats.decal));
    this.addBackground(level, rng(seed + 7), G, th);
    this.addClouds(level, rng(seed + 9), th);
    if (G.count) {
      const gm = this.add(new THREE.Mesh(G.build(), this.mats.glow));
      gm.renderOrder = 4;
    }
  }

  // 같은 높이로 이어진 '#' 칸들을 상자 하나로 묶는다.
  findBuildings(level) {
    const runs = [];
    for (let x = 0; x < level.cols; x++) {
      let y = 0;
      while (y < ROWS) {
        if (level.grid[y][x] === '#') {
          const r0 = y;
          while (y < ROWS && level.grid[y][x] === '#') y++;
          runs.push({ x, r0, r1: y - 1 });
        } else y++;
      }
    }
    runs.sort((a, b) => a.r0 - b.r0 || a.r1 - b.r1 || a.x - b.x);
    const boxes = [];
    for (const r of runs) {
      const last = boxes[boxes.length - 1];
      if (last && last.r0 === r.r0 && last.r1 === r.r1 && last.x1 === r.x - 1) last.x1 = r.x;
      else boxes.push({ x0: r.x, x1: r.x, r0: r.r0, r1: r.r1 });
    }
    for (const b of boxes) b.toBottom = b.r1 === ROWS - 1;
    boxes.sort((a, b) => a.x0 - b.x0);
    return boxes;
  }

  addBuilding(B, P, bx, i) {
    const x0 = bx.x0 * T;
    const x1 = (bx.x1 + 1) * T;
    const top = bx.r0 * T;
    const bottom = bx.toBottom ? STREET : (bx.r1 + 1) * T;
    const a = [x0, x1, top, bx.depth];
    const b = [bx.style, bx.roof, i * 3.7 + 1, 0];
    B.box(x0, -bottom, -bx.depth, x1, -top, 0, col(bx.color), 'FLRT', a, b);
    if (!bx.toBottom) return;
    // 옆과 뒤의 낮은 난간
    const rim = [bx.style, bx.roof, 0, 1];
    const h = 7;
    B.box(x0, -top, -bx.depth, x0 + 4, -top + h, -6, col('#ffffff'), 'FLRT', a, rim);
    B.box(x1 - 4, -top, -bx.depth, x1, -top + h, -6, col('#ffffff'), 'FLRT', a, rim);
    B.box(x0, -top, -bx.depth, x1, -top + h, -bx.depth + 4, col('#ffffff'), 'FLRT', a, rim);
  }

  // 실외기('A')와 비계('B')를 입체로. 앞면은 z = 0.
  addTiles(level, P, Dc) {
    const uvAc = this.atlas.uv(R.ac);
    const uvSc = this.atlas.uv(R.scaffold);
    for (let ty = 0; ty < ROWS; ty++) {
      for (let tx = 0; tx < level.cols; tx++) {
        const ch = level.grid[ty][tx];
        const x = tx * T;
        const y = -ty * T;
        if (ch === 'A') {
          P.box(x + 1, y - T + 1, -30, x + T - 1, y - 1, 0, col('#d5d9de'), 'LRTK');
          Dc.quad([x, y - T, 0.5], [T, 0, 0], [0, T, 0], [1, 1, 1], uvAc);
        } else if (ch === 'B') {
          const d = 64;
          P.box(x, y - 6, -d, x + T, y, 0, col('#b07a3c'), 'FLRTK');
          P.box(x + 1, y - T, -4, x + 4, y - 6, 0, col('#e8a33a'), 'FLR');
          P.box(x + T - 4, y - T, -4, x + T - 1, y - 6, 0, col('#e8a33a'), 'FLR');
          P.box(x + 1, y - T, -d, x + 4, y - 6, -d + 4, col('#c98b2e'), 'FLR');
          P.box(x + T - 4, y - T, -d, x + T - 1, y - 6, -d + 4, col('#c98b2e'), 'FLR');
          Dc.quad([x, y - T, 0.5], [T, 0, 0], [0, T, 0], [1, 1, 1], uvSc);
          Dc.quad([x, y - T, -d + 2], [T, 0, 0], [0, T, 0], [1, 1, 1], uvSc);
        }
      }
    }
  }

  // 옥상 꾸미기: 물탱크, 안테나, 옥탑방, 빨래, 고추 텃밭, 광고판, 간판
  decorateRoof(P, Dc, G, bx, r, level, th) {
    const x0 = bx.x0 * T;
    const x1 = (bx.x1 + 1) * T;
    const w = x1 - x0;
    const y = -bx.r0 * T;
    const back = -bx.depth + 10;
    const at = this.atlas;
    const night = th.night;
    const used = [];
    const free = (a, b) => used.every(([c, d]) => b < c || a > d);
    const take = (a, b) => used.push([a, b]);

    // 앞면 간판 (옥상 아래 2~4칸, 창문 위에 붙인다)
    if (w >= 96 && r() < 0.8) {
      const s = SIGNS[Math.floor(r() * SIGNS.length)];
      const sw = Math.min(w - 24, 160);
      const sx = x0 + 12 + Math.floor(r() * Math.max(1, (w - 24 - sw) / 32)) * 32;
      const sy = y - T * (2 + Math.floor(r() * 2)) + 4;
      Dc.quad([sx, sy - 40, 1], [sw, 0, 0], [0, 40, 0], [1, 1, 1], at.uv(s), [0.9, 0.15, 0, 0]);
      if (night > 0.3) G.quad([sx + sw / 2, sy - 20, 6], [0, 0, 0], [0, 0, 0], col('#ff9ec0').map((v) => v * 0.35), [-1, -1, 1, 1], [sw * 0.6, 0, 0, 1]);
    }
    if (w >= 64 && r() < 0.55) {
      const s = VSIGNS[Math.floor(r() * VSIGNS.length)];
      const sx = r() < 0.5 ? x0 + 6 : x1 - 6 - 30;
      const sy = y - T * 3;
      Dc.quad([sx, sy - 120, 1.2], [30, 0, 0], [0, 120, 0], [1, 1, 1], at.uv(s), [0.9, 0.15, 0, 0]);
    }

    if (w < 96) return;
    const placeX = (pw) => {
      for (let k = 0; k < 6; k++) {
        const px = x0 + 16 + r() * Math.max(1, w - 32 - pw);
        if (free(px - 8, px + pw + 8)) {
          take(px - 8, px + pw + 8);
          return px;
        }
      }
      return null;
    };

    // 광고판 / 네온 (옥상 뒤쪽)
    if (w >= 160 && r() < 0.7) {
      const neon = night > 0.4 && r() < 0.5;
      const reg = neon ? NEONS[Math.floor(r() * NEONS.length)] : BILLBOARDS[Math.floor(r() * BILLBOARDS.length)];
      const bw = neon ? 150 : 170;
      const bh = neon ? 38 : 85;
      const px = placeX(bw);
      if (px !== null) {
        const lift = neon ? 22 : 30;
        const z = back + 6;
        P.box(px + 14, y, z - 4, px + 20, y + lift + 4, z, col('#5c636e'), 'FLRT');
        P.box(px + bw - 20, y, z - 4, px + bw - 14, y + lift + 4, z, col('#5c636e'), 'FLRT');
        P.box(px - 3, y + lift - 3, z - 6, px + bw + 3, y + lift + bh + 3, z - 2, col('#3d434c'), 'FLRTK');
        Dc.quad([px, y + lift, z], [bw, 0, 0], [0, bh, 0], [1, 1, 1], at.uv(reg), neon ? [1, 0.6, 0, 0] : [0.75, 0.1, 0, 0]);
        if (night > 0.3) {
          const gc = col(neon ? '#ff7ad1' : '#fff1b0').map((v) => v * 0.45);
          G.quad([px + bw / 2, y + lift + bh / 2, z + 8], [0, 0, 0], [0, 0, 0], gc, [-1, -1, 1, 1], [bw * 0.7, 0, 0, 1]);
        }
      }
    }
    // 물탱크
    if (r() < 0.75) {
      const rr = 18 + r() * 10;
      const px = placeX(rr * 2);
      if (px !== null) {
        const cx = px + rr;
        const cz = back + rr + 14 + r() * 40;
        const tank = [col('#4a90c8'), col('#5fae7c'), col('#c7ccd3'), col('#e3c35b')][Math.floor(r() * 4)];
        const leg = col('#6b7280');
        for (const [dx, dz] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]]) {
          P.box(cx + dx * rr - 2, y, cz + dz * rr - 2, cx + dx * rr + 2, y + 16, cz + dz * rr + 2, leg, 'FLRK');
        }
        const ht = 34 + r() * 22;
        P.cyl(cx, cz, y + 16, y + 16 + ht, rr, 12, tank, Z4, Z4, tank.map((v) => v * 1.1));
        P.cyl(cx, cz, y + 16 + ht, y + 20 + ht, rr * 0.45, 10, tank.map((v) => v * 0.85));
      }
    }
    // 옥탑방
    if (w >= 200 && r() < 0.55) {
      const hw = 90 + Math.floor(r() * 3) * 16;
      const px = placeX(hw);
      if (px !== null) {
        const hd = 70;
        const z1 = back + hd + 30;
        const hh = 58;
        const wall = [col('#f1e3c8'), col('#d7e3ea'), col('#f5d0c5')][Math.floor(r() * 3)];
        P.box(px, y, z1 - hd, px + hw, y + hh, z1, wall, 'FLRT');
        P.box(px - 6, y + hh, z1 - hd - 6, px + hw + 6, y + hh + 6, z1 + 6, col('#4c6ef5'), 'FLRTD');
        Dc.quad([px + 10, y, z1 + 0.6], [30, 0, 0], [0, 46, 0], [1, 1, 1], at.uv(R.door));
        Dc.quad([px + 52, y + 18, z1 + 0.6], [30, 0, 0], [0, 28, 0], [1, 1, 1], at.uv(R.hutWin), [0.9, 0, 0, 0]);
        if (night > 0.3) G.quad([px + 67, y + 32, z1 + 4], [0, 0, 0], [0, 0, 0], col('#ffcf7a').map((v) => v * 0.6), [-1, -1, 1, 1], [36, 0, 0, 1]);
      }
    }
    // 빨래 / 고추 텃밭
    if (r() < 0.6) {
      const laundry = r() < 0.5;
      const pw = 96;
      const px = placeX(pw);
      if (px !== null) {
        const z = -40 - r() * 60;
        if (laundry) {
          P.box(px - 2, y, z - 2, px + 2, y + 46, z + 2, col('#868e96'), 'FLRK');
          P.box(px + pw - 2, y, z - 2, px + pw + 2, y + 46, z + 2, col('#868e96'), 'FLRK');
          Dc.quad([px, y + 14, z], [pw, 0, 0], [0, 32, 0], [1, 1, 1], at.uv(R.laundry));
        } else {
          P.box(px, y, z - 22, px + pw, y + 9, z, col('#a0522d'), 'FLRTK');
          Dc.quad([px, y, z + 0.6], [pw, 0, 0], [0, 32, 0], [1, 1, 1], at.uv(R.planter));
        }
      }
    }
    // 안테나 (밤엔 빨간 불이 깜빡)
    if (r() < 0.65) {
      const px = placeX(10);
      if (px !== null) {
        const hgt = 60 + r() * 70;
        const z = back + 20;
        P.box(px, y, z - 3, px + 4, y + hgt, z + 1, col('#5c636e'), 'FLRK');
        P.box(px - 12, y + hgt * 0.7, z - 2, px + 16, y + hgt * 0.7 + 3, z, col('#5c636e'), 'FLRTK');
        G.quad([px + 2, y + hgt + 3, z + 4], [0, 0, 0], [0, 0, 0], col('#ff3b3b'), [-1, -1, 1, 1], [20, 1.1, r(), 1]);
      }
    }
  }

  // 골인 아치, 보스 헬기장 같은 특별한 장식
  addLandmarks(level, boxes, P, Dc, G, th) {
    const at = this.atlas;
    const roofAt = (px) => {
      const b = boxes.find((q) => q.toBottom && px >= q.x0 * T && px < (q.x1 + 1) * T);
      return b ? { y: -b.r0 * T, depth: b.depth, b } : null;
    };
    if (level.goal) {
      const gx = level.goal.x;
      const r = roofAt(gx);
      if (r) {
        const z = -34;
        const half = 92;
        const hgt = 118;
        for (const px of [gx - half, gx + half]) {
          P.box(px - 7, r.y, z - 14, px + 7, r.y + hgt, z, col('#ff6fa3'), 'FLRTK', [0.4, 0.1, 0, 0]);
          Dc.quad([px - 16, r.y + hgt - 6, z + 2], [32, 0, 0], [0, 48, 0], [1, 1, 1], at.uv(R.balloon), [0.5, 0.2, 0, 0]);
        }
        Dc.quad([gx - half - 10, r.y + hgt - 52, z + 1], [half * 2 + 20, 0, 0], [0, 50, 0], [1, 1, 1], at.uv(R.arch), [0.9, 0.3, 0, 0]);
        G.quad([gx, r.y + hgt - 27, z + 10], [0, 0, 0], [0, 0, 0], col('#ffcf7a').map((v) => v * 0.5), [-1, -1, 1, 1], [130, 0, 0, 1]);
        for (let k = 0; k < 6; k++) {
          G.quad([gx - half + (k * half * 2) / 5, r.y + hgt + 4, z + 6], [0, 0, 0], [0, 0, 0], col(['#ff6fa3', '#ffd43b', '#74c0fc'][k % 3]), [-1, -1, 1, 1], [12, 2.2, k / 6, 0]);
        }
      }
    }
    if (level.boss) {
      const cx = (level.cols * T) / 2;
      const r = roofAt(cx);
      if (r) {
        const size = 300;
        Dc.quad([cx - size / 2, r.y + 0.6, -60], [size, 0, 0], [0, 0, -size * 0.9], [1, 1, 1], at.uv(R.helipad), [0.35, 0.1, 0, 0]);
        // 헬기장 테두리 조명
        for (let k = 0; k < 14; k++) {
          const a = (k / 14) * Math.PI * 2;
          G.quad([cx + Math.cos(a) * 160, r.y + 4, -60 - size * 0.45 + Math.sin(a) * 140], [0, 0, 0], [0, 0, 0], col('#ffd43b'), [-1, -1, 1, 1], [14, 1.4, k / 14, 0]);
        }
      }
    }
  }

  // 멀리 보이는 도시: 깊이별로 네 줄
  addBackground(level, r, G, th) {
    const W = level.cols * T;
    const rows = [
      { z: [-420, -700], top: [190, 620], wd: [110, 210], gap: [30, 110], win: [16, 22] },
      { z: [-950, -1450], top: [20, 460], wd: [150, 280], gap: [50, 160], win: [22, 28] },
      { z: [-2000, -2900], top: [-220, 300], wd: [220, 420], gap: [80, 260], win: [30, 38] },
      { z: [-3800, -5200], top: [-320, 200], wd: [320, 620], gap: [120, 420], win: [44, 54] },
    ];
    const list = [];
    rows.forEach((row, ri) => {
      const span = 900 + ri * 1600;
      let x = -span;
      while (x < W + span) {
        const wd = row.wd[0] + r() * (row.wd[1] - row.wd[0]);
        const z = row.z[0] + r() * (row.z[1] - row.z[0]);
        let top = row.top[0] + r() * (row.top[1] - row.top[0]);
        if (r() < 0.07) top -= 260 + ri * 220; // 가끔 우뚝 솟은 빌딩
        const dep = wd * (0.7 + r() * 0.6);
        list.push({ x, wd, z, top, dep, ri, win: row.win });
        x += wd + row.gap[0] + r() * (row.gap[1] - row.gap[0]);
      }
    });
    const geo = new THREE.BoxGeometry(1, 1, 1);
    geo.translate(0.5, 0.5, -0.5); // 원점 = 앞면 왼쪽 아래
    const mesh = new THREE.InstancedMesh(geo, this.mats.bg, list.length);
    const iCol = new Float32Array(list.length * 3);
    const iInfo = new Float32Array(list.length * 4);
    const m = new THREE.Matrix4();
    const palette = th.bg;
    list.forEach((b, k) => {
      const h = STREET - b.top;
      m.makeScale(b.wd, h, b.dep);
      m.setPosition(b.x, -STREET, b.z);
      mesh.setMatrixAt(k, m);
      const c = col(palette[Math.floor(r() * palette.length)]);
      const shadeK = 1 - b.ri * 0.04;
      iCol.set([c[0] * shadeK, c[1] * shadeK, c[2] * shadeK], k * 3);
      const ww = b.win[0] + Math.floor(r() * 2) * 4;
      iInfo.set([ww, b.win[1], r() * 100, 0], k * 4);
      // 꼭대기 빨간 항공등 / 높은 빌딩
      if (b.top < 100 && r() < 0.5) {
        G.quad([b.x + b.wd / 2, -b.top + 8, b.z], [0, 0, 0], [0, 0, 0], col('#ff4040'), [-1, -1, 1, 1], [26 + b.ri * 14, 0.7, r(), 1]);
      }
    });
    geo.setAttribute('iCol', new THREE.InstancedBufferAttribute(iCol, 3));
    geo.setAttribute('iInfo', new THREE.InstancedBufferAttribute(iInfo, 4));
    mesh.instanceMatrix.needsUpdate = true;
    this.add(mesh);
  }

  addClouds(level, r, th) {
    const n = th.clouds.count;
    const pos = [];
    const uv = [];
    const aa = [];
    const idx = [];
    for (let k = 0; k < n; k++) {
      const z = -2600 - r() * 5200;
      const low = th.clouds.low && k % 3 === 0;
      const y2 = low ? 500 + r() * 500 : -1400 + r() * 1300;
      const s = 380 + r() * 520 + (-z / 5200) * 400;
      const range = 9000 + (-z) * 2;
      const x = r() * range;
      const base = pos.length / 3;
      for (const [u, v] of [[0, 0], [1, 0], [1, 1], [0, 1]]) {
        pos.push(x, -y2, z);
        uv.push(u, v);
        aa.push(s, s * 0.5, 8 + r() * 14, range);
      }
      idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute('aA', new THREE.Float32BufferAttribute(aa, 4));
    g.setIndex(idx);
    const mesh = this.add(new THREE.Mesh(g, this.mats.cloud));
    mesh.renderOrder = 1;
  }

  // view: { x, y, w, h } = z = 0 평면에서 화면에 보이는 영역(2D 좌표),
  //       eyeX, eyeY = 눈 위치(2D), dist = 눈과 평면 사이 거리.
  // 선택: yaw/pitch/orbit 등으로 카메라를 돌릴 수 있지만, 그때는 2D 덧그림이 어긋나므로
  //       화면 위에 게임 오브젝트를 그리지 않는 연출(타이틀·스테이지 소개)에서만 쓴다.
  render(view, t) {
    const U = this.U;
    U.uTime.value = t;
    U.uFlash.value = this.flash;
    const cam = this.camera;
    const D = view.dist;
    cam.position.set(view.eyeX, -view.eyeY, D);
    if (view.rot) cam.quaternion.setFromEuler(view.rot);
    else cam.quaternion.identity();
    cam.updateMatrixWorld(true);
    const k = NEAR / D;
    const left = (view.x - view.eyeX) * k;
    const right = (view.x + view.w - view.eyeX) * k;
    const top = (view.eyeY - view.y) * k;
    const bottom = (view.eyeY - (view.y + view.h)) * k;
    cam.projectionMatrix.makePerspective(left, right, top, bottom, NEAR, FAR);
    cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();

    // 해·달·지평선 (화면 고정)
    const s = this.mats.sky.uniforms;
    const hor = (view.eyeY - view.y) / view.h; // 위에서부터 비율
    s.uHorizon.value = view.rot ? 0.5 : 1 - hor;
    const sc = this.sunCfg || { x: 0.5, h: 0.3 };
    s.uSun.value.set(sc.x, Math.min(0.97, 1 - hor + sc.h));
    this.mats.cloud.uniforms.uCamX.value = view.eyeX;
    this.mats.rain.uniforms.uCam.value.set(view.eyeX, -view.eyeY, 0);
    this.renderer.render(this.scene, cam);
  }

  dispose() {
    this.disposeLevel();
    this.renderer.dispose();
  }
}
