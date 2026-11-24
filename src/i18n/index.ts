import type { Locale } from '../core/types';
import { ptBR } from './pt-BR';
import type { TranslationDict, TranslationKey } from './pt-BR';
import { en } from './en';
import { es } from './es';

export type { TranslationKey } from './pt-BR';

const STORAGE_KEY = 'sonyia.locale';
const LOCALE_CHANGE_EVENT = 'sonyia:localechange';

const locales = { 'pt-BR': ptBR, en, es } satisfies Record<Locale, TranslationDict>;

export const supportedLocales: readonly Locale[] = ['pt-BR', 'en', 'es'];

export const localeNames: Record<Locale, string> = {
  'pt-BR': 'Português (Brasil)',
  en: 'English',
  es: 'Español',
};

function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (supportedLocales as readonly string[]).includes(value);
}

/** Resolve o idioma salvo, com fallback para o idioma do navegador. */
export function getLocale(): Locale {
  try {
    const stored = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (isLocale(stored)) return stored;
  } catch {
    // Armazenamento indisponível (modo privado, bloqueio de cookies etc.).
  }

  const language = typeof navigator === 'undefined' ? '' : navigator.language.toLowerCase();
  if (language.startsWith('pt')) return 'pt-BR';
  if (language.startsWith('es')) return 'es';
  return 'en';
}

let currentLocale: Locale = getLocale();

/** Persiste e aplica o idioma, notificando a interface. */
export function setLocale(locale: Locale): void {
  currentLocale = locale;

  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, locale);
  } catch {
    // Persistência é opcional; o idioma ainda é aplicado nesta sessão.
  }

  if (typeof document !== 'undefined') {
    document.documentElement.lang = locale;
  }

  if (typeof window !== 'undefined' && typeof CustomEvent !== 'undefined') {
    window.dispatchEvent(new CustomEvent(LOCALE_CHANGE_EVENT, { detail: locale }));
  }
}

const PLACEHOLDER = /\{([^{}]+)\}/g;

/** Traduz uma chave, substituindo os placeholders informados. Nunca lança. */
export function t(key: TranslationKey, vars?: Record<string, string | number>): string {
  try {
    const template: string = locales[currentLocale][key] ?? ptBR[key] ?? String(key);
    if (!vars) return template;

    return template.replace(PLACEHOLDER, (match: string, name: string) => {
      if (!Object.prototype.hasOwnProperty.call(vars, name)) return match;
      const value: unknown = vars[name];
      return typeof value === 'string' || typeof value === 'number' ? String(value) : match;
    });
  } catch {
    return typeof key === 'string' ? key : '';
  }
}

/** Dicionário completo do idioma ativo. */
export function getTranslation(): TranslationDict {
  return locales[currentLocale];
}

let initialLocaleApplied = false;

/** Aplica o idioma inicial uma única vez. */
export function applyInitialLocale(): void {
  if (initialLocaleApplied) return;
  initialLocaleApplied = true;
  setLocale(getLocale());
}
