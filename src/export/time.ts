/** Formatação de tempo compartilhada pelos formatos de exportação. */

function safeSeconds(seconds: number): number {
  return Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
}

/** SRT usa vírgula; VTT usa ponto antes dos milissegundos. */
export function formatTimestamp(seconds: number, format: 'srt' | 'vtt'): string {
  const totalMs = Math.round(safeSeconds(seconds) * 1000);
  const hours = Math.floor(totalMs / 3_600_000);
  const minutes = Math.floor((totalMs % 3_600_000) / 60_000);
  const secs = Math.floor((totalMs % 60_000) / 1000);
  const ms = totalMs % 1000;
  const separator = format === 'srt' ? ',' : '.';

  return (
    `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:` +
    `${String(secs).padStart(2, '0')}${separator}${String(ms).padStart(3, '0')}`
  );
}

/** Duração legível: M:SS ou H:MM:SS. */
export function formatHumanDuration(seconds: number): string {
  const total = Math.floor(safeSeconds(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${minutes}:${String(secs).padStart(2, '0')}`;
}
