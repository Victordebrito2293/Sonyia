import type { TranscriptResult } from '../core/types';

/**
 * Documento versionado: metadados da fonte, reconhecimento, VAD determinístico
 * e a transcrição final (incluindo o texto editado pelo usuário).
 */
export function buildJson(result: TranscriptResult): string {
  const document = {
    schema: 'sonyia.transcript.v1',
    generatedAt: result.createdAt || new Date().toISOString(),
    source: {
      fileName: result.fileName,
      durationSeconds: result.duration,
    },
    recognition: {
      model: result.modelLabel,
      detectedLanguage: result.detectedLanguage,
      languageConfidence: result.languageConfidence,
    },
    speechDetection: {
      algorithm: 'deterministic-dsp-vad',
      segments: result.vadSegments.map((segment) => ({
        start: segment.start,
        end: segment.end,
        confidence: segment.confidence,
      })),
    },
    transcript: {
      text: result.text,
      segments: result.segments.map((segment) => ({
        id: segment.id,
        start: segment.start,
        end: segment.end,
        text: segment.text,
        confidence: segment.confidence,
      })),
    },
  };

  return JSON.stringify(document, null, 2);
}
