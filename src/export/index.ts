import type { ExportFormat, TranscriptResult } from '../core/types';
import { buildJson } from './json';
import { buildPdf } from './pdf';
import { buildSrt } from './srt';
import { safeFileName } from './safe-name';
import { buildTxt } from './txt';
import { buildVtt } from './vtt';

export { formatHumanDuration, formatTimestamp } from './time';
export { isValidFileName, safeFileName } from './safe-name';
export { buildTxt } from './txt';
export { buildSrt } from './srt';
export { buildVtt } from './vtt';
export { buildJson } from './json';
export { buildPdf } from './pdf';

export interface ExportOptions {
  includeTimestamps: boolean;
}

const MIME_TYPES: Record<ExportFormat, string> = {
  txt: 'text/plain',
  srt: 'application/x-subrip',
  vtt: 'text/vtt',
  json: 'application/json',
  pdf: 'application/pdf',
};

export function buildExport(
  result: TranscriptResult,
  format: ExportFormat,
  options: ExportOptions = { includeTimestamps: false },
): Blob {
  if (format === 'pdf') {
    const pdf = buildPdf(result, options).output('arraybuffer');
    return new Blob([pdf], { type: MIME_TYPES.pdf });
  }

  let content: string;
  switch (format) {
    case 'txt':
      content = buildTxt(result, options);
      break;
    case 'srt':
      content = buildSrt(result);
      break;
    case 'vtt':
      content = buildVtt(result);
      break;
    case 'json':
      content = buildJson(result);
      break;
  }

  return new Blob([content], { type: MIME_TYPES[format] });
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = safeFileName(fileName);
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
