import { beforeEach, describe, expect, it } from 'vitest';
import { ptBR } from '../../src/i18n/pt-BR';
import { en } from '../../src/i18n/en';
import { es } from '../../src/i18n/es';
import { getLocale, localeNames, setLocale, supportedLocales, t } from '../../src/i18n';

const placeholders = (text: string) => [...text.matchAll(/\{([^{}]+)\}/g)].map((m) => m[1]).sort();

describe('internacionalização', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('mantém paridade exata de chaves entre os três idiomas', () => {
    const keys = Object.keys(ptBR).sort();
    expect(Object.keys(en).sort()).toEqual(keys);
    expect(Object.keys(es).sort()).toEqual(keys);
    expect(keys.length).toBeGreaterThan(140);
  });

  it('preserva placeholders em todas as traduções', () => {
    for (const key of Object.keys(ptBR) as (keyof typeof ptBR)[]) {
      expect(placeholders(en[key]), `en:${key}`).toEqual(placeholders(ptBR[key]));
      expect(placeholders(es[key]), `es:${key}`).toEqual(placeholders(ptBR[key]));
    }
  });

  it('troca de idioma sem recarregar e persiste a preferência', () => {
    setLocale('es');
    expect(document.documentElement.lang).toBe('es');
    expect(t('upload.title')).toBe(es['upload.title']);
    expect(localStorage.getItem('sonyia.locale')).toBe('es');

    const events: string[] = [];
    window.addEventListener('sonyia:localechange', (event) => {
      events.push((event as CustomEvent).detail);
    });
    setLocale('en');
    expect(t('upload.title')).toBe(en['upload.title']);
    expect(events).toEqual(['en']);
    expect(getLocale()).toBe('en');
  });

  it('substitui variáveis e mantém placeholders sem valor', () => {
    setLocale('pt-BR');
    expect(t('progress.detail.segments', { count: 3 })).toContain('3');
    expect(t('progress.detail.segments')).toContain('{count}');
    expect(Object.values(localeNames)).toEqual(['Português (Brasil)', 'English', 'Español']);
    expect(supportedLocales).toEqual(['pt-BR', 'en', 'es']);
  });
});
