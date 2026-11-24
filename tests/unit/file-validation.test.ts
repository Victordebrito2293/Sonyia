import { describe, expect, it } from 'vitest';
import {
  MAX_FILE_BYTES,
  hasKnownHeader,
  isProbablyCorrupted,
  normalizeExtension,
  sanitizeDisplayName,
  validateFile,
} from '../../src/security/file-validation';

function file(name: string, bytes: number[], size = bytes.length): File {
  const result = new File([new Uint8Array(bytes)], name);
  Object.defineProperty(result, 'size', { value: size });
  return result;
}

describe('validação de arquivos', () => {
  it('aceita formatos declarados com cabeçalho válido', () => {
    expect(validateFile(file('aula.mp4', [0, 0, 0, 24, 102, 116, 121, 112]))).toBeNull();
    expect(validateFile(file('voz.wav', [82, 73, 70, 70, 0, 0, 0, 0, 87, 65, 86, 69]))).toBeNull();
    expect(validateFile(file('musica.flac', [102, 76, 97, 67, 1, 2, 3, 4]))).toBeNull();
  });

  it('rejeita vazio, formato não suportado e arquivo grande demais', () => {
    expect(validateFile(file('vazio.wav', [], 0))?.code).toBe('empty');
    expect(validateFile(file('doc.pdf', [37, 80, 68, 70]))?.code).toBe('unsupported');
    expect(validateFile(file('grande.mp4', [0, 0, 0, 24, 102, 116, 121, 112], MAX_FILE_BYTES + 1))?.code).toBe(
      'too-large',
    );
  });

  it('normaliza extensões e nomes com tentativa de path traversal', () => {
    expect(normalizeExtension('C:\\Users\\teste\\AULA.MP4?x=1')).toBe('mp4');
    expect(sanitizeDisplayName('../../etc/passwd')).toBe('passwd');
    expect(sanitizeDisplayName('..\u0000nome.mp3')).toBe('nome.mp3');
    expect(sanitizeDisplayName('///')).toBe('audio');
  });

  it('detecta arquivos renomeados ou corrompidos pela assinatura', () => {
    expect(hasKnownHeader(new Uint8Array([73, 68, 51, 4, 0, 0, 0, 0, 0, 0, 0, 0]), 'mp3')).toBe(true);
    expect(isProbablyCorrupted(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]), 'wav')).toBe(
      true,
    );
    expect(isProbablyCorrupted(new Uint8Array([82, 73, 70, 70, 0, 0, 0, 0, 87, 65, 86, 69]), 'wav')).toBe(
      false,
    );
  });
});
