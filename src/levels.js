// 스테이지 정의.
// 좌표 단위는 타일(32px)이고, y는 위에서부터 0~14행이다. 땅의 윗면은 13행.
// 아래 빌더 함수들로 스테이지를 "조립"한다:
//   ground(x0, x1)          x0~x1 칸에 땅 깔기 (빈 칸은 구덩이)
//   blocks(x, y, w, h)      벽돌 블록 (올라설 수 있음)
//   stairs(x, n)            높이 1~n 계단
//   spikes(x0, x1)          가시 함정
//   fly(x, y, opts)         날아다니는 고추 (잡아야 할 대상)
//   chestnut(x)             굴러다니는 밤송이 (닿으면 아픔)
//   spikeBall(x, y, amp)    위아래로 움직이는 철퇴공 (닿으면 아픔)
//   platform(x, y, range)   좌우로 움직이는 발판
//   checkpoint(x)           중간 저장 깃발
//   goal(x)                 골인 깃발

export const T = 32;
export const ROWS = 15;
export const GROUND = 13;

function level(name, width, build) {
  const grid = Array.from({ length: ROWS }, () => new Array(width).fill(' '));
  const def = {
    name,
    width,
    grid,
    start: { x: 2, y: GROUND - 1 },
    flyers: [],
    chestnuts: [],
    spikeBalls: [],
    platforms: [],
    checkpoints: [],
    goal: { x: width - 6, y: GROUND - 1 },
  };
  const set = (x, y, ch) => {
    if (x >= 0 && x < width && y >= 0 && y < ROWS) grid[y][x] = ch;
  };
  const api = {
    ground(x0, x1, top = GROUND) {
      for (let x = x0; x <= x1; x++) for (let y = top; y < ROWS; y++) set(x, y, '#');
    },
    blocks(x, y, w = 1, h = 1, ch = 'B') {
      for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) set(x + i, y + j, ch);
    },
    stairs(x, n) {
      for (let i = 0; i < n; i++) api.blocks(x + i, GROUND - 1 - i, 1, i + 1);
    },
    spikes(x0, x1, y = GROUND - 1) {
      for (let x = x0; x <= x1; x++) set(x, y, '^');
    },
    start(x, y = GROUND - 1) {
      def.start = { x, y };
    },
    fly(x, y, o = {}) {
      def.flyers.push({ x, y, ...o });
    },
    chestnut(x, y = GROUND - 1) {
      def.chestnuts.push({ x, y });
    },
    spikeBall(x, y, amp = 2, speed = 1.6) {
      def.spikeBalls.push({ x, y, amp, speed });
    },
    platform(x, y, range = 3, speed = 1, w = 3) {
      def.platforms.push({ x, y, range, speed, w });
    },
    checkpoint(x, y = GROUND - 1) {
      def.checkpoints.push({ x, y });
    },
    goal(x, y = GROUND - 1) {
      def.goal = { x, y };
    },
  };
  build(api);
  return def;
}

export const LEVELS = [
  level('꽃밭 들판', 115, (L) => {
    L.ground(0, 20);
    L.start(2);
    L.fly(8, 9, { ax: 1 });
    L.blocks(11, 10, 3);
    L.fly(12, 7, { ax: 1 });
    L.fly(16, 9, { ax: 1.2 });
    L.chestnut(17);
    // 구덩이 21~23
    L.ground(24, 44);
    L.spikes(28, 29);
    L.fly(28, 8, { ax: 0.5 });
    L.blocks(32, 10, 3);
    L.fly(36, 8);
    L.spikeBall(38, 9, 2.5);
    L.checkpoint(42);
    // 구덩이 45~50, 움직이는 발판
    L.platform(45, 11, 3, 1.1);
    L.fly(48, 8);
    L.ground(51, 76);
    L.chestnut(57);
    L.stairs(60, 3);
    L.fly(62, 7);
    L.chestnut(68);
    L.spikes(71, 72);
    // 구덩이 77~79
    L.ground(80, 114);
    L.spikeBall(85, 9, 2.5, 2);
    L.blocks(89, 10, 4);
    L.fly(90, 7);
    L.fly(96, 9, { ax: 2 });
    L.chestnut(100);
    L.stairs(103, 4);
    L.fly(105, 6);
    L.goal(110);
  }),

  level('구름 언덕', 150, (L) => {
    L.ground(0, 14);
    L.start(2);
    L.fly(6, 9);
    L.chestnut(10);
    L.stairs(12, 3);
    // 구덩이 15~19
    L.platform(15, 10, 2, 1.0);
    L.ground(20, 36);
    L.spikes(24, 26);
    L.fly(25, 8, { ax: 0.6 });
    L.spikeBall(30, 9, 2.5, 1.8);
    L.chestnut(33);
    L.checkpoint(35);
    // 구덩이 37~39
    L.ground(40, 60);
    L.blocks(44, 10, 4);
    L.blocks(49, 7, 4);
    L.fly(46, 8, { ax: 1 });
    L.fly(50, 4, { ax: 1 });
    L.chestnut(48);
    L.chestnut(55);
    L.spikes(57, 58);
    // 구덩이 61~63, 기둥 64~65, 구덩이 66~68
    L.blocks(64, 11, 2, 4, '#');
    L.fly(66, 8, { ax: 1 });
    L.ground(69, 95);
    L.chestnut(74);
    L.blocks(77, 10, 3);
    L.fly(78, 7);
    L.chestnut(82);
    L.spikeBall(85, 9, 2.5, 2.2);
    L.fly(88, 9, { ax: 2, speed: 1.4 });
    L.checkpoint(92);
    // 구덩이 96~105, 발판 두 개
    L.platform(96, 11, 3, 1.0);
    L.platform(101, 10, 2, 1.4);
    L.fly(101, 7);
    L.ground(106, 149);
    L.spikes(110, 111);
    L.chestnut(115);
    L.spikeBall(118, 9, 2.5, 2.4);
    L.stairs(122, 4);
    L.fly(124, 6);
    L.fly(131, 8, { ax: 2.5, speed: 1.5 });
    L.goal(140);
  }),
];
