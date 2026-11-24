import type { Locale } from '../core/types';

export function formatBytes(bytes: number, locale: Locale = 'pt-BR'): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** index;
  return `${new Intl.NumberFormat(locale, {
    maximumFractionDigits: index === 0 ? 0 : 1,
  }).format(value)} ${units[index]}`;
}

export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${minutes}:${String(secs).padStart(2, '0')}`;
}

export function formatElapsed(ms: number): string {
  return formatDuration(ms / 1000);
}

/** Código Whisper -> rótulo legível, mantido neutro entre idiomas da interface. */
const LANGUAGE_NAMES: Record<string, string> = {
  portuguese: 'Português / Portuguese / Portugués',
  english: 'English / Inglés / Inglês',
  spanish: 'Español / Espanhol',
  french: 'Français / Francês',
  german: 'Deutsch / Alemão',
  italian: 'Italiano / Italiano',
  japanese: '日本語',
  chinese: '中文',
  korean: '한국어',
  hindi: 'हिन्दी',
  arabic: 'العربية',
  russian: 'Русский',
  dutch: 'Nederlands',
  polish: 'Polski',
  swedish: 'Svenska',
  danish: 'Dansk',
  finnish: 'Suomi',
  norwegian: 'Norsk',
  turkish: 'Türkçe',
  ukrainian: 'Українська',
  czech: 'Čeština',
  hungarian: 'Magyar',
  romanian: 'Română',
  greek: 'Ελληνικά',
  hebrew: 'עברית',
  thai: 'ไทย',
  vietnamese: 'Tiếng Việt',
  indonesian: 'Bahasa Indonesia',
};

export function languageLabel(code: string | null): string {
  if (!code) return '—';
  return LANGUAGE_NAMES[code.toLowerCase()] ?? code;
}

export function percent(value: number): string {
  return `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;
}
