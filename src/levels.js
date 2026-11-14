// 스테이지 정의.
// 좌표 단위는 타일(32px)이고, y는 위에서부터 0~14행이다.
// 아래 빌더 함수들로 스테이지를 "조립"한다:
//   building(x0, x1, top)   x0~x1 칸에 옥상 높이가 top행인 건물 (건물 사이 빈 칸은 골목 = 추락)
//   blocks(x, y, w, h)      공사장 비계 블록 (공중에 떠 있어도 올라설 수 있음)
//   stairs(x, n)            옥상 위에 높이 1~n으로 쌓은 실외기 계단
//   spikes(x0, x1)          철조망 함정
//   fly(x, y, opts)         날아다니는 고추 (잡아야 할 대상)
//   pigeon(x)               옥상을 왔다 갔다 하는 성난 비둘기 (닿으면 아픔)
//   wreckingBall(x, y, amp) 크레인에 매달려 위아래로 움직이는 쇳덩이 (닿으면 아픔)
//   platform(x, y, range)   크레인에 매달려 좌우로 움직이는 철골 발판
//   checkpoint(x)           중간 저장 깃발
//   goal(x)                 골인 깃발
// y를 생략하면 그 칸의 옥상(또는 블록) 바로 위에 놓인다.

export const T = 32;
export const ROWS = 15;
export const GROUND = 13;

function level(name, theme, width, build) {
  const grid = Array.from({ length: ROWS }, () => new Array(width).fill(' '));
  const def = {
    name,
    theme,
    width,
    grid,
    start: { x: 2, y: GROUND - 1 },
    flyers: [],
    pigeons: [],
    wreckingBalls: [],
    platforms: [],
    checkpoints: [],
    goal: { x: width - 6, y: GROUND - 1 },
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

export const LEVELS = [
  level('빌딩 숲', 'day', 120, (L) => {
    L.building(0, 14, 11);
    L.start(2);
    L.fly(6, 7, { ax: 1 });
    L.fly(10, 6, { ax: 1 });
    // 골목 15~16
    L.building(17, 26, 10);
    L.blocks(19, 7, 3);
    L.fly(20, 4, { ax: 1 });
    L.pigeon(24);
    // 골목 27~29
    L.fly(28, 7, { ax: 0.5 });
    L.building(30, 41, 12);
    L.fly(33, 8);
    L.spikes(34, 35);
    L.wreckingBall(38, 8, 2.5);
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
    L.building(104, 119, 11);
    L.fly(108, 7, { ax: 2 });
    L.goal(114);
  }),

  level('한밤의 옥상', 'night', 150, (L) => {
    L.building(0, 12, 12);
    L.start(2);
    L.fly(7, 8);
    L.pigeon(9);
    // 골목 13~14
    L.building(15, 22, 9);
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
    L.building(129, 149, 12);
    L.fly(133, 8, { ax: 2.5, speed: 1.5 });
    L.goal(142);
  }),
];
