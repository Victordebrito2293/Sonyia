import type { Theme } from '../core/types';

const STORAGE_KEY = 'sonyia.theme';

function systemTheme(): Theme {
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

export function getTheme(): Theme {
  try {
    const stored = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // Preferência do sistema é usada quando o armazenamento falha.
  }
  return systemTheme();
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  document.querySelector<HTMLMetaElement>('meta[name="color-scheme"]')?.setAttribute('content', theme);
}

export function toggleTheme(): Theme {
  const next: Theme = getTheme() === 'dark' ? 'light' : 'dark';
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, next);
  } catch {
    // Tema ainda é aplicado nesta sessão.
  }
  applyTheme(next);
  return next;
}

/** Segue o sistema enquanto o usuário não escolher manualmente. */
export function watchSystemTheme(onChange: (theme: Theme) => void): void {
  const media = window.matchMedia?.('(prefers-color-scheme: dark)');
  if (!media) return;
  media.addEventListener('change', (event) => {
    let manual = false;
    try {
      manual = globalThis.localStorage?.getItem(STORAGE_KEY) != null;
    } catch {
      manual = false;
    }
    if (!manual) onChange(event.matches ? 'dark' : 'light');
  });
}
