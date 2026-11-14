// 키보드 + 터치 버튼 입력을 "행동(action)" 단위로 묶는다.
const BINDINGS = {
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  jump: ['Space', 'ArrowUp', 'KeyW', 'KeyZ'],
  net: ['KeyX', 'KeyJ', 'KeyK'],
  confirm: ['Enter', 'Space'],
  pause: ['KeyP', 'Escape'],
  mute: ['KeyM'],
};

export class Input {
  constructor(target = window) {
    this.keys = new Set();
    this.virtual = new Set();
    this.justPressed = new Set();
    this.codeToActions = new Map();
    for (const [action, codes] of Object.entries(BINDINGS)) {
      for (const code of codes) {
        if (!this.codeToActions.has(code)) this.codeToActions.set(code, []);
        this.codeToActions.get(code).push(action);
      }
    }
    target.addEventListener('keydown', (e) => {
      const actions = this.codeToActions.get(e.code);
      if (!actions) return;
      e.preventDefault();
      if (!e.repeat) actions.forEach((a) => this.justPressed.add(a));
      this.keys.add(e.code);
    });
    target.addEventListener('keyup', (e) => this.keys.delete(e.code));
    target.addEventListener('blur', () => {
      this.keys.clear();
      this.virtual.clear();
    });
  }

  // 누르고 있는 중인가
  held(action) {
    return this.virtual.has(action) || BINDINGS[action].some((c) => this.keys.has(c));
  }

  // 이번 업데이트에 새로 눌렀는가
  pressed(action) {
    return this.justPressed.has(action);
  }

  // 터치 버튼용
  press(action) {
    this.virtual.add(action);
    this.justPressed.add(action);
  }

  release(action) {
    this.virtual.delete(action);
  }

  tap(action) {
    this.justPressed.add(action);
  }

  // 게임 업데이트 한 번이 끝날 때 호출
  endStep() {
    this.justPressed.clear();
  }
}

// 아무것도 누르지 않은 입력 (골인 연출 등에서 사용)
export const NO_INPUT = { held: () => false, pressed: () => false };
