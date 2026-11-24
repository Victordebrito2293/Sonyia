import { describe, expect, it } from 'vitest';
import type { ExportFormat, TranscriptResult } from '../../src/core/types';
import {
  buildExport,
  buildJson,
  buildPdf,
  buildSrt,
  buildTxt,
  buildVtt,
  formatHumanDuration,
  formatTimestamp,
  isValidFileName,
  safeFileName,
} from '../../src/export/index';

const result: TranscriptResult = {
  text: 'Primeiro segmento. Segundo segmento.',
  segments: [
    { id: 12, start: 0, end: 1.234, text: 'Primeiro segmento.', confidence: 0.81 },
    { id: 34, start: 65.5, end: 67.02, text: 'Segundo segmento.', confidence: 0.92 },
  ],
  detectedLanguage: 'pt',
  languageConfidence: 0.97,
  duration: 67.02,
  modelId: 'small',
  modelLabel: 'Whisper small',
  fileName: 'entrevista.wav',
  createdAt: '2026-01-02T03:04:05.000Z',
  processingMs: 4321,
  vadSegments: [
    { start: 0, end: 1.234, confidence: 0.81 },
    { start: 65.5, end: 67.02, confidence: 0.92 },
  ],
};

describe('formatação de tempo', () => {
  it('SRT e VTT usam separadores e milissegundos exatos', () => {
    expect(formatTimestamp(0, 'srt')).toBe('00:00:00,000');
    expect(formatTimestamp(1.234, 'srt')).toBe('00:00:01,234');
    expect(formatTimestamp(65.5, 'srt')).toBe('00:01:05,500');
    expect(formatTimestamp(67.02, 'srt')).toBe('00:01:07,020');
    expect(formatTimestamp(1.234, 'vtt')).toBe('00:00:01.234');
    expect(formatTimestamp(67.02, 'vtt')).toBe('00:01:07.020');
    expect(formatTimestamp(1.2349, 'srt')).toBe('00:00:01,235');
  });

  it('duração humana usa M:SS ou H:MM:SS', () => {
    expect(formatHumanDuration(65.5)).toBe('1:05');
    expect(formatHumanDuration(3661)).toBe('1:01:01');
  });
});

describe('SRT e VTT', () => {
  it('buildSrt numera blocos e mantém timestamps exatos', () => {
    const expected =
      '1\n00:00:00,000 --> 00:00:01,234\nPrimeiro segmento.\n\n' +
      '2\n00:01:05,500 --> 00:01:07,020\nSegundo segmento.\n';
    expect(buildSrt(result)).toBe(expected);
  });

  it('buildVtt começa com WEBVTT e usa ponto nos milissegundos', () => {
    const expected =
      'WEBVTT\n\n' +
      '00:00:00.000 --> 00:00:01.234\nPrimeiro segmento.\n\n' +
      '00:01:05.500 --> 00:01:07.020\nSegundo segmento.\n';
    expect(buildVtt(result)).toBe(expected);
  });
});

describe('JSON', () => {
  it('gera documento parseável com schema e seções documentadas', () => {
    const parsed = JSON.parse(buildJson(result)) as {
      schema: string;
      generatedAt: string;
      source: { fileName: string; durationSeconds: number };
      recognition: { model: string; detectedLanguage: string | null };
      speechDetection: { algorithm: string; segments: unknown[] };
      transcript: { text: string; segments: unknown[] };
    };

    expect(parsed.schema).toBe('sonyia.transcript.v1');
    expect(parsed.generatedAt).toBe(result.createdAt);
    expect(parsed.source).toEqual({ fileName: result.fileName, durationSeconds: result.duration });
    expect(parsed.recognition.model).toBe(result.modelLabel);
    expect(parsed.speechDetection.algorithm).toBe('deterministic-dsp-vad');
    expect(parsed.speechDetection.segments).toHaveLength(2);
    expect(parsed.transcript.text).toBe(result.text);
    expect(parsed.transcript.segments).toHaveLength(2);
  });
});

describe('TXT', () => {
  it('inclui cabeçalho e marcas [HH:MM:SS] quando solicitado', () => {
    const txt = buildTxt(result, { includeTimestamps: true });
    expect(txt).toContain('Arquivo: entrevista.wav');
    expect(txt).toContain(`Data: ${result.createdAt}`);
    expect(txt).toContain('Duração: 1:07');
    expect(txt).toContain('[00:00:00] Primeiro segmento.');
    expect(txt).toContain('[00:01:05] Segundo segmento.');
  });

  it('preserva o texto editado quando não há marcas', () => {
    expect(buildTxt(result, { includeTimestamps: false })).toBe(result.text);
  });
});

describe('safeFileName', () => {
  it('remove traversal de caminho, caracteres proibidos e caracteres de controle', () => {
    expect(safeFileName('../../etc/passwd')).toBe('passwd');
    expect(safeFileName('C:\\Users\\tmp\\audio.wav')).toBe('audio.wav');
    expect(safeFileName('a\u0000b*c?d<e>f|g:h.wav')).toBe('abcdefgh.wav');
  });

  it('limita o tamanho e nunca retorna vazio', () => {
    expect(safeFileName('a'.repeat(200))).toHaveLength(120);
    expect(safeFileName('////')).toBe('transcript');
    expect(safeFileName('', 'arquivo.txt')).toBe('arquivo.txt');
  });

  it('valida nomes já seguros', () => {
    expect(isValidFileName('audio.wav')).toBe(true);
    expect(isValidFileName('../audio.wav')).toBe(false);
    expect(isValidFileName('a:b')).toBe(false);
  });
});

describe('buildExport e PDF', () => {
  it('usa os MIME types corretos', async () => {
    const cases: Array<{ format: ExportFormat; type: string }> = [
      { format: 'txt', type: 'text/plain' },
      { format: 'srt', type: 'application/x-subrip' },
      { format: 'vtt', type: 'text/vtt' },
      { format: 'json', type: 'application/json' },
      { format: 'pdf', type: 'application/pdf' },
    ];

    for (const item of cases) {
      const blob = buildExport(result, item.format, { includeTimestamps: false });
      expect(blob.type).toBe(item.type);
    }

    const srt = buildExport(result, 'srt', { includeTimestamps: false });
    expect(await srt.text()).toBe(buildSrt(result));
  });

  it('gera PDF com assinatura %PDF sem recursos externos', () => {
    const buffer = buildPdf(result, { includeTimestamps: false }).output('arraybuffer');
    const signature = new TextDecoder().decode(new Uint8Array(buffer, 0, 4));
    expect(signature).toBe('%PDF');
    expect(buffer.byteLength).toBeGreaterThan(100);
  });
});
