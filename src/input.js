// 키보드 입력 상태를 추적한다.
export class Input {
  constructor(target = window) {
    this.keys = new Set();
    target.addEventListener('keydown', (e) => this.keys.add(e.code));
    target.addEventListener('keyup', (e) => this.keys.delete(e.code));
    target.addEventListener('blur', () => this.keys.clear());
  }

  isDown(code) {
    return this.keys.has(code);
  }
}
