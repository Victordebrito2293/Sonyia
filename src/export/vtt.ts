import type { TranscriptResult } from '../core/types';
import { formatTimestamp } from './time';

/** Evita quebras duplas dentro de uma cue. */
function cueText(value: string): string {
  return value
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/ *\n */g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

export function buildVtt(result: TranscriptResult): string {
  const cues = result.segments.map((segment) => {
    const start = formatTimestamp(segment.start, 'vtt');
    const end = formatTimestamp(segment.end, 'vtt');
    return `${start} --> ${end}\n${cueText(segment.text)}`;
  });

  return `WEBVTT\n\n${cues.join('\n\n')}${cues.length > 0 ? '\n' : ''}`;
}
