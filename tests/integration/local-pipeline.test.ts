// @vitest-environment node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { initSync, resample_mono_16k, speech_segments } from '../../src/wasm/audio_engine.js';
import { buildContinuousText, toTranscriptSegments } from '../../src/transcription/text';
import { buildExport, safeFileName } from '../../src/export';
import { isProbablyCorrupted } from '../../src/security/file-validation';
import type { TranscriptResult } from '../../src/core/types';

function readWav(name: string): Float32Array {
  const bytes = readFileSync(join(process.cwd(), 'tests/fixtures', name));
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let position = 12;
  let dataOffset = -1;
  let dataLength = 0;
  while (position + 8 < bytes.length) {
    const id = bytes.subarray(position, position + 4).toString('ascii');
    const size = view.getUint32(position + 4, true);
    if (id === 'data') {
      dataOffset = position + 8;
      dataLength = size;
      break;
    }
    position += 8 + size + (size % 2);
  }
  if (dataOffset < 0) throw new Error('fixture sem dados');
  const out = new Float32Array(dataLength / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = view.getInt16(dataOffset + i * 2, true) / 32768;
  }
  return out;
}

describe('pipeline local integrado (sem rede)', () => {
  beforeAll(() => {
    const wasm = readFileSync(join(process.cwd(), 'src/wasm/audio_engine_bg.wasm'));
    initSync({ module: wasm });
  });

  it('valida o arquivo, extrai fala com VAD e gera todas as exportações', () => {
    const bytes = new Uint8Array(readFileSync(join(process.cwd(), 'tests/fixtures/1272-128104-0000.wav')));
    expect(isProbablyCorrupted(bytes, 'wav')).toBe(false);

    const audio = readWav('1272-128104-0000.wav');
    const pcm16k = resample_mono_16k(audio, 16_000, 1);
    const flat = speech_segments(pcm16k, 16_000, 0.5);
    expect(flat.length).toBe(3);

    // Chunks abaixo representam a saída estruturada esperada do ASR para a
    // fixture de referência; o teste valida a orquestração, não o modelo.
    const vad = { start: flat[0]!, end: flat[1]!, confidence: flat[2]! };
    const segments = toTranscriptSegments(
      [
        { text: 'Mister Quilter is the apostle of the middle classes.', timestamp: [vad.start, 2.8] },
        { text: 'And we are glad to welcome his gospel.', timestamp: [2.8, vad.end] },
      ],
      vad,
      vad.start,
      1,
    );
    const result: TranscriptResult = {
      text: buildContinuousText(segments, false),
      segments,
      detectedLanguage: 'english',
      languageConfidence: null,
      duration: pcm16k.length / 16_000,
      modelId: 'tiny',
      modelLabel: 'Xenova/whisper-tiny',
      fileName: '1272-128104-0000.wav',
      createdAt: '2026-11-24T12:00:00.000Z',
      processingMs: 1234,
      vadSegments: [vad],
    };

    expect(result.text).toContain('Mister Quilter');
    for (const format of ['txt', 'srt', 'vtt', 'json', 'pdf'] as const) {
      const blob = buildExport(result, format, { includeTimestamps: true });
      expect(blob.size).toBeGreaterThan(0);
    }
    expect(safeFileName('../../ secrets /aula.mp3')).toBe('aula.mp3');
  });
});
