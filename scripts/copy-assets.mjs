import { cp, mkdir, readdir, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const publicDir = join(root, 'public');
// O worker do @ffmpeg/ffmpeg é do tipo `module`; ele carrega o core via
// `import()`, portanto a variante ESM é obrigatória (a UMD não tem export default).
const ffmpegSrc = join(root, 'node_modules', '@ffmpeg', 'core', 'dist', 'esm');
const ffmpegDst = join(publicDir, 'ffmpeg');
const ortSrc = join(
  root,
  'node_modules',
  '@huggingface',
  'transformers',
  'node_modules',
  'onnxruntime-web',
  'dist',
);
const ortDst = join(publicDir, 'ort');

async function ensure(dir) {
  await mkdir(dir, { recursive: true });
}

async function copyIfPresent(from, to) {
  try {
    await stat(from);
    await cp(from, to);
    return true;
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
}

await ensure(ffmpegDst);
await ensure(ortDst);

for (const file of ['ffmpeg-core.js', 'ffmpeg-core.wasm']) {
  if (!(await copyIfPresent(join(ffmpegSrc, file), join(ffmpegDst, file)))) {
    throw new Error(`Dependência ausente: @ffmpeg/core (${file}). Execute npm install.`);
  }
}

// Usamos apenas o backend wasm (sem WebGPU/JSEP). Duas variantes são
// necessárias: a padrão (Safari antigo) e a asyncify (Chromium/Firefox).
const needed = [
  'ort-wasm-simd-threaded.mjs',
  'ort-wasm-simd-threaded.wasm',
  'ort-wasm-simd-threaded.asyncify.mjs',
  'ort-wasm-simd-threaded.asyncify.wasm',
];
const available = await readdir(ortSrc);
const ortFiles = needed.filter((name) => available.includes(name));
if (ortFiles.length === 0) {
  throw new Error('Dependência ausente: onnxruntime-web wasm. Execute npm install.');
}
for (const file of ortFiles) {
  await cp(join(ortSrc, file), join(ortDst, file));
}

console.log(`[assets] ffmpeg: 2 arquivos, ONNX Runtime: ${ortFiles.length} arquivos`);
