// 게임 상태와 로직. update()와 render()에 게임 내용을 채워 나가면 된다.
export class Game {
  constructor(canvas, input) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.input = input;
    this.width = 0;
    this.height = 0;
    this.elapsed = 0;
  }

  resize(width, height) {
    this.width = width;
    this.height = height;
  }

  // dt: 고정 시간 간격(초)
  update(dt) {
    this.elapsed += dt;
  }

  render() {
    const { ctx, width, height } = this;
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = '#eee';
    ctx.font = '24px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Public Playground', width / 2, height / 2);

    ctx.fillStyle = '#666';
    ctx.font = '14px monospace';
    ctx.fillText(`${this.elapsed.toFixed(1)}s`, width / 2, height / 2 + 32);
  }
}
