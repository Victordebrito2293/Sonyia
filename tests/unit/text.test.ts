import { describe, expect, it } from 'vitest';
import type { TranscriptResult } from '../../src/core/types';
import {
  buildContinuousText,
  buildSegmentedText,
  cleanChunkText,
  dedupeRepeatedSentences,
  toTranscriptSegments,
  type RawChunk,
} from '../../src/transcription/text';

const chunks: RawChunk[] = [
  { text: ' Primeira frase. Segunda frase. ', timestamp: [0, 2.5], language: 'portuguese' },
  { text: 'Terceira frase.', timestamp: [2.5, 4], language: 'portuguese' },
];

describe('organização da transcrição', () => {
  it('limpa espaços e repetição de palavras sem alterar acentos', () => {
    expect(cleanChunkText('  olá   olá   olá  mundo ')).toBe('olá mundo');
    expect(cleanChunkText('não  não  não  senhor')).toBe('não senhor');
    expect(cleanChunkText(' sensors   ')).toBe('sensors');
  });

  it('remove apenas frases idênticas consecutivas', () => {
    expect(dedupeRepeatedSentences('Eu fui. Eu fui. Voltei.')).toBe('Eu fui. Voltei.');
    expect(dedupeRepeatedSentences('Fui. Voltei. Fui.')).toBe('Fui. Voltei. Fui.');
  });

  it('converte chunks com offset absoluto e confiança do VAD', () => {
    const segments = toTranscriptSegments(chunks, { start: 10, end: 14, confidence: 0.8 }, 10, 1);
    expect(segments).toHaveLength(2);
    expect(segments[0]?.start).toBe(10);
    expect(segments[0]?.end).toBe(12.5);
    expect(segments[1]?.start).toBe(12.5);
    expect(segments[1]?.confidence).toBe(0.8);
    expect(segments[0]?.id).toBe(1);
  });

  it('agrupa frases em parágrafos e opcionalmente insere marcas de tempo', () => {
    const segments = toTranscriptSegments(chunks, null, 0, 1);
    const continuous = buildContinuousText(segments, false);
    expect(continuous).toContain('Primeira frase. Segunda frase. Terceira frase.');
    const timed = buildContinuousText(segments, true);
    expect(timed).toContain('[00:00:00] Primeira frase.');
    expect(buildSegmentedText(segments)).toContain('[00:00:00] Primeira frase. Segunda frase.');
  });

  it('preserva o texto editado pelo usuário como fonte da exportação TXT', async () => {
    const { buildTxt } = await import('../../src/export/txt');
    const result: TranscriptResult = {
      text: 'Texto editado pelo usuário.',
      segments: [],
      detectedLanguage: 'portuguese',
      languageConfidence: null,
      duration: 1,
      modelId: 'tiny',
      modelLabel: 'Xenova/whisper-tiny',
      fileName: 'aula.mp3',
      createdAt: '2026-11-24T00:00:00.000Z',
      processingMs: 10,
      vadSegments: [],
    };
    expect(buildTxt(result, { includeTimestamps: false })).toContain('Texto editado pelo usuário.');
  });
});
