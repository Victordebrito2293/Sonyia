import { defineConfig } from 'vite';

export default defineConfig({
  // Caminhos relativos permitem publicar em qualquer subpasta do GitHub Pages.
  base: './',
  build: {
    target: 'es2022',
    sourcemap: true,
    chunkSizeWarningLimit: 1500,
  },
  worker: {
    format: 'es',
  },
  // Não exigimos COOP/COEP: usamos ffmpeg.wasm single-thread e
  // ONNX Runtime com uma única thread, que não precisam de SharedArrayBuffer.
  // Isso preserva compatibilidade com GitHub Pages (onde esses headers
  // não podem ser configurados pelo projeto).
});
