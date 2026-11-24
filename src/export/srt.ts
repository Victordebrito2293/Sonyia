import type { TranscriptResult } from '../core/types';
import { formatTimestamp } from './time';

/** Uma legenda por linha, sem quebras duplas ou caracteres de controle. */
function cueText(value: string): string {
  return value
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/ *\n */g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

export function buildSrt(result: TranscriptResult): string {
  const blocks = result.segments.map((segment, index) => {
    const start = formatTimestamp(segment.start, 'srt');
    const end = formatTimestamp(segment.end, 'srt');
    return `${index + 1}\n${start} --> ${end}\n${cueText(segment.text)}`;
  });

  return blocks.length > 0 ? `${blocks.join('\n\n')}\n` : '';
}
