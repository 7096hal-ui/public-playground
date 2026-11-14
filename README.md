# public-playground

Vite + Canvas 2D 기반의 빈 웹 게임 템플릿.

## 개발

```bash
npm install
npm run dev      # 로컬 개발 서버
npm run build    # dist/ 로 빌드
npm run preview  # 빌드 결과 미리보기
```

## 구조

```
index.html          캔버스와 엔트리 스크립트
src/main.js         캔버스 리사이즈(DPR 대응) + 고정 간격(60Hz) 게임 루프
src/game.js         게임 상태 — update(dt) / render() 를 채워 나가면 됨
src/input.js        키보드 입력 상태 (input.isDown('ArrowLeft') 등)
src/style.css       전체 화면 캔버스 스타일
.github/workflows/deploy.yml   GitHub Pages 자동 배포
```

## 자동 배포

`main` 브랜치에 push 하면 GitHub Actions가 빌드 후 GitHub Pages에 배포한다.

최초 1회 설정: 저장소 **Settings → Pages → Build and deployment → Source** 를
**GitHub Actions** 로 지정. 배포 주소는 `https://7096hal-ui.github.io/public-playground/`.
