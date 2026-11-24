import type { TranscriptResult } from '../core/types';
import { formatHumanDuration, formatTimestamp } from './time';

export interface TxtExportOptions {
  includeTimestamps: boolean;
}

/** Sem marcas, o corpo é exatamente o texto editado pelo usuário. */
export function buildTxt(result: TranscriptResult, options: TxtExportOptions): string {
  if (!options.includeTimestamps) {
    return result.text;
  }

  // Cabeçalho com metadados opcionais, usado na versão segmentada.
  const header = [
    `Arquivo: ${result.fileName}`,
    `Idioma: ${result.detectedLanguage ?? 'Não identificado'}`,
    `Data: ${result.createdAt}`,
    `Duração: ${formatHumanDuration(result.duration)}`,
  ];

  const body = result.segments.map((segment) => {
    const clock = formatTimestamp(segment.start, 'srt').slice(0, 8);
    const text = segment.text.replace(/\s*[\r\n]+\s*/g, ' ').trim();
    return `[${clock}] ${text}`;
  });

  return `${header.join('\n')}\n\n${body.join('\n')}\n`;
}
