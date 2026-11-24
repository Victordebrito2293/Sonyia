/** Nomes de arquivo seguros para download local. */

const MAX_LENGTH = 120;
const DEFAULT_FALLBACK = 'transcript';

function sanitize(value: string): string {
  // Mantém só o último segmento: barras jamais chegam ao nome final.
  const base = value.split(/[\\/]/).pop() ?? '';
  return base
    .replace(/[\u0000-\u001F\u007F-\u009F\u2028\u2029"*<>|:?]/g, '')
    .replace(/\.{2,}/g, '.')
    .replace(/^\.+/, '')
    .trim()
    .slice(0, MAX_LENGTH)
    .trim();
}

export function safeFileName(name: string, fallback: string = DEFAULT_FALLBACK): string {
  return sanitize(name) || sanitize(fallback) || DEFAULT_FALLBACK;
}

export function isValidFileName(name: string): boolean {
  return name.length > 0 && name.length <= MAX_LENGTH && sanitize(name) === name;
}
