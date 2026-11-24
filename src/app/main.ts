import '../styles/main.css';
import { applyInitialLocale, t } from '../i18n';
import { SonyiaApp } from './controller';

applyInitialLocale();

const supported =
  typeof Worker !== 'undefined' &&
  typeof WebAssembly === 'object' &&
  typeof File !== 'undefined' &&
  typeof Blob !== 'undefined' &&
  typeof URL.createObjectURL === 'function';

if (!supported) {
  const error = document.getElementById('upload-error');
  if (error) {
    error.textContent = t('error.browserUnsupported');
    error.hidden = false;
  }
  const start = document.getElementById('start-button') as HTMLButtonElement | null;
  if (start) start.disabled = true;
} else {
  new SonyiaApp();
}
