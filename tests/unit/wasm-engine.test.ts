// @vitest-environment node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, beforeAll } from 'vitest';
import { initSync, features, resample_mono_16k, speech_segments, version } from '../../src/wasm/audio_engine.js';

const fixture = (name: string): Float32Array => {
  const bytes = readFileSync(join(process.cwd(), 'tests/fixtures', name));
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let position = 12;
  let offset = -1;
  let length = 0;
  while (position + 8 < bytes.length) {
    const id = bytes.subarray(position, position + 4).toString('ascii');
    const size = view.getUint32(position + 4, true);
    if (id === 'data') {
      offset = position + 8;
      length = size;
      break;
    }
    position += 8 + size + (size % 2);
  }
  if (offset < 0) throw new Error('fixture inválida');
  const output = new Float32Array(length / 2);
  for (let i = 0; i < output.length; i += 1) {
    output[i] = view.getInt16(offset + i * 2, true) / 32768;
  }
  return output;
};

describe('motor DSP compilado em WebAssembly', () => {
  beforeAll(() => {
    const bytes = readFileSync(join(process.cwd(), 'src/wasm/audio_engine_bg.wasm'));
    initSync({ module: bytes });
  });

  it('expõe a versão e processa áudio real sem rede', () => {
    expect(version()).toBe('1.0.0');
  });

  it('detecta fala em LibriSpeech e ignora tom instrumental e silêncio', () => {
    const speech = speech_segments(fixture('1272-128104-0000.wav'), 16_000, 0.5);
    expect(speech.length).toBeGreaterThan(0);
    expect(speech[0]).toBeLessThan(1);
    expect(speech[1]).toBeGreaterThan(5);
    expect(Array.from(speech_segments(fixture('instrumental-tone.wav'), 16_000, 0.5))).toEqual([]);
    expect(Array.from(speech_segments(fixture('silence.wav'), 16_000, 0.5))).toEqual([]);
  });

  it('fornece features reais por janela de 20 ms', () => {
    const data = fixture('silence.wav');
    const frameCount = Math.floor(data.length / 320);
    expect(features(data, 16_000, 0.5).length).toBe(frameCount * 5);
  });

  it('reamostra estéreo 48 kHz para mono 16 kHz', () => {
    const stereo = new Float32Array(48_000 * 2);
    for (let i = 0; i < stereo.length; i += 2) {
      stereo[i] = 0.4;
      stereo[i + 1] = -0.4;
    }
    const mono = resample_mono_16k(stereo, 48_000, 2);
    expect(mono.length).toBe(16_000);
    expect(Math.abs(mono[100] ?? 1)).toBeLessThan(1e-6);
  });
});
