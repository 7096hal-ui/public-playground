import { defineConfig } from 'vite';

// GitHub Pages는 https://<user>.github.io/<repo>/ 경로로 서비스되므로
// 상대 경로(base: './')로 빌드해 어떤 경로에서도 동작하게 한다.
export default defineConfig({
  base: './',
  // three.js가 들어가서 묶음 파일이 500kB를 조금 넘는다(압축하면 약 170kB). 경고 기준만 올린다.
  build: { chunkSizeWarningLimit: 1200 },
});
