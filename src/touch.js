// 휴대폰 화면 버튼 (◀ ▶ 채 점프 Ⅱ).
//
// 예전에는 버튼마다 "자기를 누른 손가락"을 따로 붙잡고 있었다. 그래서
//   - ▶를 누른 엄지를 ◀ 쪽으로 미끄러뜨려도 계속 ▶로 남고,
//   - 버튼 그림을 살짝 벗어나거나 두 버튼 사이 틈을 누르면 아무것도 안 눌리고,
//   - 두 번째 손가락이 닿을 때 브라우저가 확대/스크롤 몸짓으로 오해하면 첫 버튼이 풀릴 수 있었다.
//
// 이제는 화면 전체에서 터치를 받고, 터치가 바뀔 때마다 "지금 화면에 닿아 있는 모든 손가락"을
// 다시 보고 각 손가락이 어느 버튼 구역 위에 있는지 계산한다.
//   - 구역은 버튼 그림보다 넉넉하다. ◀ ▶는 왼쪽 아래를 통째로 둘로 나눈 구역이라 틈이 없다.
//   - 손가락을 미끄러뜨리면 그 자리 버튼으로 바로 바뀐다.
//   - 터치의 기본 동작(확대, 스크롤, 길게 눌러 메뉴)을 막아 몸짓으로 오해받지 않는다.
const SLOP = 1.55; // 점프·채: 버튼 반지름의 몇 배까지 눌린 것으로 칠지

export function setupTouchPad(pad, input, game) {
  const btns = {};
  for (const b of pad.querySelectorAll('button')) btns[b.dataset.action] = b;
  let held = new Set();
  let geo = null;

  // 버튼 위치를 잰다 (화면 크기가 바뀌면 다시)
  const measure = () => {
    geo = {};
    for (const [a, b] of Object.entries(btns)) {
      const r = b.getBoundingClientRect();
      geo[a] = { x: r.left + r.width / 2, y: r.top + r.height / 2, r: r.width / 2 };
    }
  };
  const invalidate = () => {
    geo = null;
  };
  window.addEventListener('resize', invalidate);
  window.addEventListener('orientationchange', invalidate);

  const visible = () => !pad.classList.contains('hidden');

  // 화면 좌표 (x, y)가 어느 버튼 구역인지 (없으면 null)
  const zoneAt = (x, y) => {
    if (!geo || geo.left.r === 0) measure();
    const L = geo.left;
    const R = geo.right;
    // ◀ ▶: 왼쪽 아래 넓은 구역을 두 버튼 가운데에서 나눈다
    if (x <= R.x + R.r * 1.7 && y >= Math.min(L.y, R.y) - L.r * 1.9) return x < (L.x + R.x) / 2 ? 'left' : 'right';
    let best = null;
    let bestD = Infinity;
    for (const a of ['jump', 'net', 'pause']) {
      const g = geo[a];
      const d = Math.hypot(x - g.x, y - g.y) / g.r;
      if (d < (a === 'pause' ? 1.5 : SLOP) && d < bestD) {
        bestD = d;
        best = a;
      }
    }
    return best;
  };

  // 지금 닿아 있는 손가락들로 눌린 버튼을 다시 정한다
  const sync = (touches) => {
    const now = new Set();
    if (visible()) {
      for (const t of touches) {
        const a = zoneAt(t.clientX, t.clientY);
        if (a && a !== 'pause') now.add(a);
      }
    }
    for (const a of held) {
      if (!now.has(a)) {
        input.release(a);
        btns[a].classList.remove('on');
      }
    }
    for (const a of now) {
      if (!held.has(a)) {
        input.press(a); // 새로 들어온 버튼은 "막 눌림"으로도 친다 (미끄러져 들어와도 점프 가능)
        btns[a].classList.add('on');
      }
    }
    held = now;
  };

  const onStart = (e) => {
    if (e.cancelable) e.preventDefault();
    game.touch = true;
    const show = visible();
    for (const t of e.changedTouches) {
      const a = show ? zoneAt(t.clientX, t.clientY) : null;
      if (a === 'pause') {
        input.tap(game.state === 'paused' ? 'confirm' : 'pause');
        btns.pause.classList.add('on');
        setTimeout(() => btns.pause.classList.remove('on'), 120);
      } else if (!a || game.state === 'paused') {
        // 버튼이 아닌 곳: 타이틀·결과 화면에서는 "다음", 일시정지 중이면 "계속"
        input.tap('confirm');
      }
    }
    sync(e.touches);
  };
  const onChange = (e) => {
    if (e.cancelable) e.preventDefault();
    sync(e.touches);
  };
  window.addEventListener('touchstart', onStart, { passive: false });
  window.addEventListener('touchmove', onChange, { passive: false });
  window.addEventListener('touchend', onChange, { passive: false });
  window.addEventListener('touchcancel', onChange, { passive: false });
  // iOS Safari의 두 손가락 확대 몸짓도 막는다
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  // 화면 버튼이 사라질 때(클리어 등) 눌린 채로 남지 않게
  return {
    update() {
      if (!visible() && held.size) sync([]);
    },
  };
}
