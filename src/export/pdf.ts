import { jsPDF } from 'jspdf';
import type { TranscriptResult } from '../core/types';
import { safeFileName } from './safe-name';
import { formatHumanDuration, formatTimestamp } from './time';

const MARGIN = 18;
const LINE_HEIGHT = 6;

export interface PdfExportOptions {
  includeTimestamps: boolean;
}

/** PDF gerado localmente, com fonte embutida padrão e texto como parâmetro. */
export function buildPdf(result: TranscriptResult, options: PdfExportOptions): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const maxWidth = pageWidth - MARGIN * 2;
  let y = MARGIN;

  const writeLines = (text: string, fontSize: number, bold = false): void => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(fontSize);
    const lines = doc.splitTextToSize(text, maxWidth);
    for (const line of lines) {
      if (y > pageHeight - MARGIN) {
        doc.addPage();
        y = MARGIN;
      }
      doc.text(line, MARGIN, y);
      y += LINE_HEIGHT * (fontSize / 11);
    }
  };

  writeLines('Sonyia', 22, true);
  y += 2;

  const details = [
    `Arquivo: ${safeFileName(result.fileName)}`,
    `Idioma: ${result.detectedLanguage ?? 'Não identificado'}`,
    `Data: ${result.createdAt}`,
    `Duração: ${formatHumanDuration(result.duration)}`,
    `Modelo: ${result.modelLabel}`,
  ];
  for (const detail of details) {
    writeLines(detail, 11);
  }

  y += 4;
  doc.setDrawColor(200);
  doc.line(MARGIN, y, pageWidth - MARGIN, y);
  y += 8;

  if (options.includeTimestamps) {
    for (const segment of result.segments) {
      const clock = formatTimestamp(segment.start, 'srt').slice(0, 8);
      writeLines(`[${clock}] ${segment.text}`, 11);
      y += 2;
    }
  } else {
    writeLines(result.text, 11);
  }

  return doc;
}
