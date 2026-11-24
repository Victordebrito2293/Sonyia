import type { SpeechSegment, TranscriptSegment } from '../core/types';
import { formatTimestamp } from '../export/time';

export interface RawChunk {
  text: string;
  timestamp?: [number | null, number | null] | null;
  language?: string | null;
}

/** Remove apenas repetições exatas e espaçamento inconsistente; nunca traduz. */
export function cleanChunkText(input: string): string {
  const collapsed = input.replace(/\s+/g, ' ').trim();
  const tokens = collapsed.split(' ');
  const output: string[] = [];
  for (const token of tokens) {
    if (!token) continue;
    // Remove repetições adjacentes exatas, típicas de alucinações do Whisper.
    // Palavras com pontuação ("não, não") permanecem distintas.
    if (token === output[output.length - 1]) continue;
    output.push(token);
  }
  return output.join(' ');
}

/** Remove frases idênticas repetidas em sequência (falha comum do Whisper). */
export function dedupeRepeatedSentences(text: string): string {
  const sentences = text.match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g);
  if (!sentences) return text;
  const result: string[] = [];
  for (const sentence of sentences) {
    const normalized = sentence.trim().toLowerCase();
    const previous = result[result.length - 1]?.trim().toLowerCase();
    if (normalized && normalized !== previous) result.push(sentence.trim());
  }
  return result.join(' ');
}

export function segmentText(chunk: RawChunk, fallbackStart: number, fallbackEnd: number): {
  start: number;
  end: number;
  text: string;
} {
  const start = chunk.timestamp?.[0] ?? fallbackStart;
  const end = chunk.timestamp?.[1] ?? fallbackEnd;
  return {
    start: Math.max(0, start),
    end: Math.max(start, end),
    text: cleanChunkText(chunk.text),
  };
}

/** Converte chunks do Whisper em segmentos absolutos com confiança do VAD. */
export function toTranscriptSegments(
  chunks: readonly RawChunk[],
  vadSegment: SpeechSegment | null,
  offset: number,
  firstId: number,
): TranscriptSegment[] {
  if (chunks.length === 0) return [];
  const fallbackStart = vadSegment?.start ?? offset;
  const fallbackEnd = vadSegment?.end ?? offset;
  return chunks.map((chunk, index) => {
    const segment = segmentText(chunk, fallbackStart, fallbackEnd);
    const relativeStart = chunk.timestamp?.[0];
    return {
      id: firstId + index,
      // Quando o modelo fornece timestamps, eles são relativos ao trecho enviado.
      start: relativeStart == null ? fallbackStart : offset + segment.start,
      end: relativeStart == null ? fallbackEnd : offset + segment.end,
      text: segment.text,
      confidence: vadSegment?.confidence ?? null,
    };
  }).filter((segment) => segment.text.length > 0);
}

/** Texto contínuo com parágrafos de até três frases. */
export function buildContinuousText(
  segments: readonly TranscriptSegment[],
  includeTimestamps: boolean,
): string {
  const sentences: string[] = [];
  for (const segment of segments) {
    const parts = segment.text.match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g) ?? [segment.text];
    for (const part of parts) {
      const clean = cleanChunkText(part);
      if (!clean) continue;
      sentences.push(
        includeTimestamps
          ? `[${formatTimestamp(segment.start, 'srt').slice(0, 8)}] ${clean}`
          : clean,
      );
    }
  }
  const paragraphs: string[] = [];
  for (let i = 0; i < sentences.length; i += 3) {
    paragraphs.push(sentences.slice(i, i + 3).join(' '));
  }
  return dedupeRepeatedSentences(paragraphs.join('\n\n'));
}

export function buildSegmentedText(segments: readonly TranscriptSegment[]): string {
  return segments
    .map((segment) => `[${formatTimestamp(segment.start, 'srt').slice(0, 8)}] ${segment.text}`)
    .join('\n');
}
