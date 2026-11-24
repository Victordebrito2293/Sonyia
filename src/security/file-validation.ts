import type { TranslationKey } from '../i18n/pt-BR';

/** Formatos efetivamente decodificados pelo pipeline (ffmpeg.wasm / Web Audio). */
export const SUPPORTED_EXTENSIONS = [
  'mp4', 'mov', 'webm', 'mkv', 'avi', 'mp3', 'wav', 'm4a', 'aac', 'flac', 'ogg',
] as const;

export type SupportedExtension = (typeof SUPPORTED_EXTENSIONS)[number];

export const MAX_FILE_BYTES = 2 * 1024 * 1024 * 1024; // 2 GiB
export const MIN_FILE_BYTES = 1;

export interface ValidationIssue {
  code:
    | 'empty'
    | 'unsupported'
    | 'too-large'
    | 'corrupted'
    | 'invalid-name'
    | 'wrong-type';
  messageKey: TranslationKey;
}

/** Extensão normalizada, sem ponto e sem query string. */
export function normalizeExtension(name: string): string {
  const clean = name.split(/[\\/]/).pop() ?? '';
  const dot = clean.lastIndexOf('.');
  if (dot < 0) return '';
  return clean.slice(dot + 1).toLowerCase().split(/[^a-z0-9]/)[0] ?? '';
}

/** Nomes são exibidos via textContent; aqui apenas garantimos que sejam imprimíveis. */
export function sanitizeDisplayName(name: string, fallback = 'audio'): string {
  const cleaned = name
    .split(/[\\/]/)
    .pop()
    ?.replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/^\.+/, '')
    .trim()
    .slice(0, 180);
  return cleaned && cleaned !== '.' && cleaned !== '..' ? cleaned : fallback;
}

export function validateFile(file: File): ValidationIssue | null {
  if (!file || typeof file.size !== 'number') {
    return { code: 'empty', messageKey: 'file.error.empty' };
  }
  if (file.size < MIN_FILE_BYTES) {
    return { code: 'empty', messageKey: 'file.error.empty' };
  }
  if (file.size > MAX_FILE_BYTES) {
    return { code: 'too-large', messageKey: 'file.error.tooLarge' };
  }
  const name = sanitizeDisplayName(file.name, '');
  if (!name) {
    return { code: 'invalid-name', messageKey: 'file.error.invalidName' };
  }
  const extension = normalizeExtension(file.name);
  if (!SUPPORTED_EXTENSIONS.includes(extension as SupportedExtension)) {
    return { code: 'unsupported', messageKey: 'file.error.unsupported' };
  }
  return null;
}

/** Verifica assinaturas de cabeçalho para rejeitar arquivos renomeados/corrompidos. */
export function hasKnownHeader(bytes: Uint8Array, extension: string): boolean {
  if (bytes.length < 12) return false;
  const ascii = (offset: number, text: string) =>
    text.split('').every((char, i) => bytes[offset + i] === char.charCodeAt(0));
  const byte = (offset: number): number => bytes[offset] ?? 0;
  switch (extension) {
    case 'wav':
      return ascii(0, 'RIFF') && ascii(8, 'WAVE');
    case 'mp4':
    case 'm4a':
      return ascii(4, 'ftyp');
    case 'mov':
      return ascii(4, 'ftyp') || ascii(0, '\u0000\u0000');
    case 'webm':
    case 'mkv':
      return byte(0) === 0x1a && byte(1) === 0x45 && byte(2) === 0xdf && byte(3) === 0xa3;
    case 'avi':
      return ascii(0, 'RIFF') && ascii(8, 'AVI ');
    case 'mp3':
      return ascii(0, 'ID3') || (byte(0) === 0xff && (byte(1) & 0xe0) === 0xe0);
    case 'aac':
      return (byte(0) === 0xff && (byte(1) & 0xf0) === 0xf0) || ascii(0, 'ADIF');
    case 'flac':
      return ascii(0, 'fLaC');
    case 'ogg':
      return ascii(0, 'OggS');
    default:
      return false;
  }
}

export function isProbablyCorrupted(bytes: Uint8Array, extension: string): boolean {
  return !hasKnownHeader(bytes, extension);
}
