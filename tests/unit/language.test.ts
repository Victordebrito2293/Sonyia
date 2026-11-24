import { describe, expect, it } from 'vitest';
import { detectLanguage, whisperLanguageCode } from '../../src/transcription/language';

describe('detecção local de idioma', () => {
  it('identifica idiomas suportados a partir de texto transcrito', () => {
    expect(
      detectLanguage(
        'The quilt maker sewed pieces of fabric together and shared the finished work with her family.',
      ),
    ).toBe('english');
    expect(
      detectLanguage(
        'Este é um texto em português brasileiro com várias palavras comuns e acentos corretos.',
      ),
    ).toBe('portuguese');
    expect(
      detectLanguage(
        'Este es un texto en español con varias palabras comunes y acentos correctos.',
      ),
    ).toBe('spanish');
  });

  it('não inventa idioma para amostras curtas ou inconclusivas', () => {
    expect(detectLanguage('ok')).toBeNull();
    expect(detectLanguage('')).toBeNull();
  });

  it('ignora marcas de tempo na detecção', () => {
    expect(
      detectLanguage(
        '[00:00:00] The quilt maker sewed pieces of fabric together and shared the finished work.',
      ),
    ).toBe('english');
  });

  it('converte nomes canônicos para códigos Whisper', () => {
    expect(whisperLanguageCode('portuguese')).toBe('pt');
    expect(whisperLanguageCode('English')).toBe('en');
    expect(whisperLanguageCode('japanese')).toBe('ja');
    expect(whisperLanguageCode(null)).toBeNull();
    expect(whisperLanguageCode('inexistente')).toBeNull();
  });
});
