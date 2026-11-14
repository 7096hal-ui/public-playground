// 스테이지 정의.
// 좌표 단위는 타일(32px)이고, y는 위에서부터 0~14행이다.
// 아래 빌더 함수들로 스테이지를 "조립"한다:
//   building(x0, x1, top)   x0~x1 칸에 옥상 높이가 top행인 건물 (건물 사이 빈 칸은 골목 = 추락)
//   blocks(x, y, w, h)      공사장 비계 블록 (공중에 떠 있어도 올라설 수 있음)
//   stairs(x, n)            옥상 위에 높이 1~n으로 쌓은 실외기 계단
//   spikes(x0, x1)          철조망 함정
//   fly(x, y, opts)         날아다니는 고추 (잡아야 할 대상). opts.golden이면 황금 고추
//   pigeon(x)               옥상을 왔다 갔다 하는 성난 비둘기 (닿으면 아픔)
//   wreckingBall(x, y, amp) 크레인에 매달려 위아래로 움직이는 쇳덩이 (닿으면 아픔)
//   platform(x, y, range)   크레인에 매달려 좌우로 움직이는 철골 발판
//   gondola(x, y, range)    위아래로 오르내리는 창문 청소 곤돌라 (range만큼 아래로 내려감)
//   crumble(x, y, w)        밟으면 잠시 뒤 떨어지는 낡은 간판
//   spring(x)               옥상 트램펄린 (밟으면 높이 튐)
//   zipline(x0, y0, x1, y1) 짚라인 (점프해서 줄에 닿으면 매달려 내려감)
//   vent(x, w, height)      환풍구 상승 기류 (바람 기둥 안에서 둥실 떠오름)
//   rod(x, period, phase)   피뢰침 (주기적으로 번개, 닿으면 아픔)
//   item(x, y, kind)        아이템: 'net' 왕잠자리채, 'wings' 돼지 날개, 'magnet' 자석 더듬이, 'heart' 목숨
//   checkpoint(x)           중간 저장 깃발
//   goal(x)                 골인 깃발
// y를 생략하면 그 칸의 옥상(또는 실외기) 바로 위에 놓인다.

export const T = 32;
export const ROWS = 15;
export const GROUND = 13;

function level(name, theme, width, build, opts = {}) {
  const grid = Array.from({ length: ROWS }, () => new Array(width).fill(' '));
  const def = {
    name,
    theme,
    width,
    grid,
    par: opts.par || 100,
    boss: !!opts.boss,
    start: { x: 2, y: GROUND - 1 },
    flyers: [],
    pigeons: [],
    wreckingBalls: [],
    platforms: [],
    crumbles: [],
    springs: [],
    ziplines: [],
    vents: [],
    rods: [],
    items: [],
    checkpoints: [],
    goal: opts.boss ? null : { x: width - 6, y: GROUND - 1 },
  };
  const set = (x, y, ch) => {
    if (x >= 0 && x < width && y >= 0 && y < ROWS) grid[y][x] = ch;
  };
  // x 칸에서 가장 위에 있는 단단한 칸의 바로 윗줄
  const surface = (x) => {
    for (let y = 0; y < ROWS; y++) if (grid[y][x] === '#' || grid[y][x] === 'A') return y - 1;
    return GROUND - 1;
  };
  const api = {
    surface,
    building(x0, x1, top = GROUND) {
      for (let x = x0; x <= x1; x++) for (let y = top; y < ROWS; y++) set(x, y, '#');
    },
    blocks(x, y, w = 1, h = 1, ch = 'B') {
      for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) set(x + i, y + j, ch);
    },
    stairs(x, n) {
      const base = surface(x);
      for (let i = 0; i < n; i++) api.blocks(x + i, base - i, 1, i + 1, 'A');
    },
    spikes(x0, x1, y = surface(x0)) {
      for (let x = x0; x <= x1; x++) set(x, y, '^');
    },
    start(x, y = surface(x)) {
      def.start = { x, y };
    },
    fly(x, y, o = {}) {
      def.flyers.push({ x, y, ...o });
    },
    pigeon(x, y = surface(x)) {
      def.pigeons.push({ x, y });
    },
    wreckingBall(x, y, amp = 2, speed = 1.6) {
      def.wreckingBalls.push({ x, y, amp, speed });
    },
    platform(x, y, range = 3, speed = 1, w = 3) {
      def.platforms.push({ x, y, range, speed, w });
    },
    gondola(x, y, range = 4, speed = 0.8, w = 2, phase = 0) {
      def.platforms.push({ x, y, range, speed, w, axis: 'y', phase });
    },
    crumble(x, y, w = 2) {
      def.crumbles.push({ x, y, w });
    },
    spring(x, y = surface(x), power) {
      def.springs.push({ x, y, power });
    },
    zipline(x0, y0, x1, y1) {
      def.ziplines.push({ x0, y0, x1, y1 });
    },
    vent(x, w = 2, height = 6, y = surface(x)) {
      def.vents.push({ x, y, w, height });
    },
    rod(x, period = 3.4, phase = 0, y = surface(x)) {
      def.rods.push({ x, y, period, phase });
    },
    item(x, y, kind) {
      def.items.push({ x, y, kind });
    },
    checkpoint(x, y = surface(x)) {
      def.checkpoints.push({ x, y });
    },
    goal(x, y = surface(x)) {
      def.goal = { x, y };
    },
  };
  build(api);
  return def;
}

// 타이틀 화면에서 주인공이 서 있는 옥상
export const TITLE_LEVEL = level('타이틀', 'sunset', 80, (L) => {
  L.building(0, 79, GROUND);
});

export const LEVELS = [
  // 1. 아침: 기본기 + 트램펄린 + 왕잠자리채
  level(
    '아침 빌딩 숲',
    'morning',
    132,
    (L) => {
      L.building(0, 14, 11);
      L.start(2);
      L.fly(6, 7, { ax: 1 });
      L.fly(10, 6, { ax: 1 });
      L.item(12, 9, 'net');
      // 골목 15~16
      L.building(17, 26, 10);
      L.blocks(19, 7, 3);
      L.fly(20, 4, { ax: 1 });
      L.pigeon(24);
      // 골목 27~29
      L.fly(28, 7, { ax: 0.5 });
      L.building(30, 41, 12);
      L.spikes(32, 33);
      L.wreckingBall(35, 8, 2.5);
      L.spring(39);
      L.fly(39, 3, { ax: 1, golden: true });
      // 골목 42~43
      L.building(44, 52, 9);
      L.checkpoint(46);
      L.blocks(49, 8, 1, 1, 'A');
      L.fly(50, 5);
      // 골목 53~58, 철골 발판
      L.platform(53, 9, 3, 1.1);
      L.fly(56, 6);
      L.building(59, 72, 11);
      L.pigeon(61);
      L.stairs(64, 3);
      L.fly(66, 4);
      L.pigeon(70);
      // 골목 73~75
      L.building(76, 90, 12);
      L.spikes(80, 81);
      L.wreckingBall(85, 9, 2.5, 2);
      L.checkpoint(88);
      // 골목 91~92
      L.building(93, 100, 10);
      L.fly(96, 6);
      L.pigeon(98);
      // 골목 101~103
      L.building(104, 131, 11);
      L.fly(108, 7, { ax: 2 });
      L.spring(113);
      L.fly(114, 3, { ax: 1 });
      L.goal(124);
    },
    { par: 110 },
  ),

  // 2. 한낮의 공사장: 곤돌라, 철골 발판, 비계, 돼지 날개
  level(
    '한낮의 공사장',
    'day',
    150,
    (L) => {
      L.building(0, 12, 11);
      L.start(2);
      L.fly(5, 7, { ax: 1 });
      L.blocks(8, 8, 2);
      L.fly(9, 4, { ax: 0.5 });
      // 골목 13~15
      L.building(16, 25, 11);
      L.pigeon(19);
      L.wreckingBall(23, 8, 2.5, 1.6);
      // 골목 26~28: 곤돌라를 타고 높은 빌딩으로
      L.gondola(26, 5, 5, 0.8, 2);
      L.fly(27, 2, { ax: 0.5 });
      L.building(29, 40, 6);
      L.checkpoint(31);
      L.item(34, 4, 'wings');
      L.fly(37, 3, { ax: 1 });
      L.pigeon(39);
      // 골목 41~46: 철골 발판
      L.platform(41, 8, 3, 1.0, 2);
      L.fly(44, 5);
      L.building(47, 58, 10);
      L.blocks(50, 7);
      L.blocks(51, 6);
      L.blocks(52, 5, 2);
      L.fly(53, 2, { ax: 1, golden: true });
      L.spikes(55, 56);
      // 골목 59~61
      L.building(62, 70, 12);
      L.spring(64);
      L.fly(65, 4);
      L.wreckingBall(68, 9, 2.5, 2);
      // 골목 71~74: 올라가는 곤돌라
      L.gondola(72, 7, 4, 0.9, 2);
      L.fly(73, 4);
      L.building(75, 88, 8);
      L.checkpoint(77);
      L.stairs(81, 3);
      L.fly(83, 2);
      L.pigeon(86);
      // 골목 89~96: 철골 발판 두 개
      L.platform(89, 9, 2, 1.1, 2);
      L.fly(91, 6);
      L.platform(93, 10, 2, 1.3, 2);
      L.building(97, 110, 11);
      L.wreckingBall(101, 8, 2.5, 1.8);
      L.fly(103, 6);
      L.wreckingBall(105, 8, 2.5, 2.2);
      // 골목 111~113
      L.building(114, 149, 10);
      L.spring(118);
      L.fly(119, 2, { ax: 1 });
      L.pigeon(125);
      L.goal(140);
    },
    { par: 130 },
  ),

  // 3. 노을 상가 거리: 짚라인, 낡은 간판, 환풍구, 자석 더듬이
  level(
    '노을 상가 거리',
    'sunset',
    156,
    (L) => {
      L.building(0, 13, 10);
      L.start(2);
      L.fly(5, 6, { ax: 1 });
      L.fly(9, 5);
      // 짚라인 1: 골목 14~19를 건넌다
      L.zipline(12, 7, 24, 9);
      L.fly(18, 7, { ax: 1, ay: 0.3 });
      L.building(20, 32, 11);
      // 골목 33~40: 낡은 간판 다리
      L.crumble(34, 10, 2);
      L.crumble(37, 9, 2);
      L.fly(38, 6);
      L.building(41, 52, 10);
      L.checkpoint(43);
      L.item(44, 7, 'magnet');
      L.vent(46, 2, 7);
      L.blocks(48, 5, 3);
      L.fly(49, 2, { ax: 1, golden: true });
      L.fly(51, 7);
      // 짚라인 2: 비계 위에서 골목 53~57 건너편으로
      L.zipline(50, 3, 63, 8);
      L.building(58, 70, 10);
      L.blocks(65, 9, 1, 1, 'A'); // 실외기가 비둘기를 짚라인 착지 지점에서 떼어 놓는다
      L.fly(66, 6);
      L.pigeon(68);
      // 골목 71~74
      L.building(75, 88, 9);
      L.checkpoint(77);
      L.spikes(80, 81);
      L.fly(81, 5);
      L.vent(84, 2, 7);
      L.blocks(86, 4, 2);
      L.fly(87, 2);
      // 짚라인 3 또는 낡은 간판으로 골목 89~95 건너기
      L.zipline(87, 2, 101, 8);
      L.crumble(90, 10, 2);
      L.crumble(93, 10, 2);
      L.building(96, 110, 10);
      L.fly(100, 6, { ax: 2 });
      L.blocks(103, 9, 1, 1, 'A');
      L.pigeon(106);
      // 골목 111~113
      L.building(114, 155, 11);
      L.spring(118);
      L.fly(119, 3, { ax: 1 });
      L.pigeon(124);
      L.spikes(128, 129);
      L.fly(132, 6);
      L.goal(146);
    },
    { par: 130 },
  ),

  // 4. 한밤의 네온 옥상: ver.2 밤 스테이지 + 환풍구, 곤돌라
  level(
    '한밤의 네온 옥상',
    'night',
    162,
    (L) => {
      L.building(0, 12, 12);
      L.start(2);
      L.fly(7, 8);
      L.pigeon(9);
      // 골목 13~14
      L.building(15, 22, 9);
      L.vent(18, 2, 6);
      L.fly(19, 2, { golden: true });
      // 골목 23~25
      L.building(26, 38, 11);
      L.spikes(29, 30);
      L.fly(30, 6);
      L.wreckingBall(34, 8, 2.5, 1.8);
      L.pigeon(37);
      // 골목 39~41
      L.building(42, 47, 10);
      L.fly(45, 5);
      // 골목 48~55, 철골 발판 두 개
      L.platform(48, 10, 2, 1.0);
      L.platform(51, 8, 2, 1.3);
      L.fly(52, 5);
      L.building(56, 70, 9);
      L.checkpoint(58);
      L.blocks(61, 6, 3);
      L.fly(62, 2);
      L.pigeon(64);
      L.spikes(66, 67);
      L.pigeon(69);
      // 골목 71~73
      L.building(74, 79, 12);
      L.fly(76, 8);
      L.wreckingBall(78, 8, 2.5, 2.2);
      // 골목 80~81, 좁은 빌딩 82~83, 골목 84~85
      L.building(82, 83, 10);
      L.fly(84, 7);
      L.building(86, 100, 11);
      L.checkpoint(87);
      L.item(88, 8, 'wings');
      L.pigeon(89);
      L.stairs(92, 3);
      L.fly(94, 4);
      L.pigeon(98);
      // 골목 101~110, 철골 발판 두 개
      L.platform(101, 10, 3, 1.0);
      L.platform(106, 9, 2, 1.4);
      L.fly(106, 5);
      L.building(111, 125, 10);
      L.spikes(115, 116);
      L.wreckingBall(120, 6, 2.5, 2.4);
      L.pigeon(123);
      // 골목 126~128
      L.building(129, 140, 12);
      L.fly(133, 8, { ax: 2.5, speed: 1.5 });
      // 골목 141~143: 곤돌라를 타고 탑 꼭대기로
      L.gondola(141, 4, 7, 0.75, 2);
      L.fly(142, 2);
      L.building(144, 161, 5);
      L.goal(155);
    },
    { par: 140 },
  ),

  // 5. 폭풍우 마천루: 피뢰침 번개, 낡은 간판, 곤돌라, 짚라인
  level(
    '폭풍우 마천루',
    'storm',
    160,
    (L) => {
      L.building(0, 11, 10);
      L.start(2);
      L.fly(6, 6, { ax: 1 });
      L.rod(9, 3.0, 0);
      // 골목 12~14
      L.building(15, 26, 11);
      L.rod(19, 3.4, 1.2);
      L.fly(21, 7);
      L.spring(24);
      L.fly(25, 3);
      // 골목 27~34: 낡은 간판
      L.crumble(28, 10, 2);
      L.crumble(31, 9, 2);
      L.fly(32, 6);
      L.building(35, 46, 9);
      L.checkpoint(36);
      L.rod(40, 2.8, 0.5);
      L.pigeon(43);
      L.fly(44, 5);
      // 골목 47~49
      L.building(50, 60, 12);
      L.wreckingBall(53, 9, 2.5, 2);
      L.vent(56, 2, 9);
      L.blocks(58, 5, 3);
      L.fly(59, 2);
      L.zipline(60, 3, 71, 7);
      // 골목 61~66: 짚라인으로
      L.building(67, 80, 10);
      L.item(70, 7, 'net');
      L.fly(75, 6, { ax: 1 });
      L.rod(77, 3.2, 0.8); // 짚라인 경로 밖에 둔다
      L.rod(79, 3.2, 2.4);
      // 곤돌라를 타고 탑으로
      L.gondola(81, 3, 7, 0.8, 2);
      L.fly(82, 2);
      L.building(84, 98, 4);
      L.checkpoint(86);
      L.rod(90, 2.6, 0);
      L.fly(92, 2);
      L.rod(94, 2.6, 1.3);
      L.zipline(97, 2, 112, 9);
      L.fly(104, 5);
      // 골목 99~104
      L.building(105, 118, 11);
      L.blocks(109, 10, 1, 1, 'A');
      L.pigeon(106);
      L.fly(116, 7);
      // 골목 119~121
      L.building(122, 132, 10);
      L.rod(126, 2.4, 0.6);
      L.spring(130);
      L.fly(131, 3, { golden: true });
      // 골목 133~137: 철골 발판
      L.platform(133, 9, 2, 1.2, 2);
      L.building(138, 159, 11);
      L.rod(144, 2.2, 0);
      L.rod(147, 2.2, 1.1);
      L.fly(149, 6);
      L.goal(153);
    },
    { par: 150 },
  ),

  // 6. 결전: 헬기장 옥상에서 대왕 고추와 한판
  level(
    '대왕 고추',
    'boss',
    40,
    (L) => {
      L.building(0, 39, 11);
      L.start(6);
      L.blocks(9, 8, 3);
      L.blocks(28, 8, 3);
    },
    { boss: true, par: 120 },
  ),
];
