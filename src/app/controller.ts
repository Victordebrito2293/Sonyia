import type {
  DecoderResponse,
  ExportFormat,
  JobOptions,
  Locale,
  MediaInfo,
  ModelId,
  PipelineStage,
  ProgressUpdate,
  TranscriptResult,
  TranscriptionResponse,
} from '../core/types';
import { buildExport, downloadBlob, safeFileName } from '../export';
import { getLocale, getTranslation, localeNames, setLocale, supportedLocales, t, type TranslationKey } from '../i18n';
import { getModel } from '../transcription/models';
import { formatBytes, formatDuration, formatElapsed, languageLabel } from '../utils/format';
import { isProbablyCorrupted, validateFile, sanitizeDisplayName } from '../security/file-validation';
import { applyTheme, getTheme, toggleTheme, watchSystemTheme } from './theme';

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Elemento ausente: #${id}`);
  return node as T;
}

const EXPORT_FORMATS: readonly ExportFormat[] = ['txt', 'srt', 'vtt', 'json', 'pdf'];

const ERROR_KEYS: Record<string, TranslationKey> = {
  NO_SPEECH: 'error.noSpeech',
  NO_AUDIO: 'error.noAudio',
  DECODE_FAILED: 'file.error.decodeFailed',
  CORRUPTED: 'file.error.corrupted',
  MEMORY: 'file.error.memory',
  MODEL_LOAD_FAILED: 'error.modelLoadFailed',
  TRANSCRIPTION_FAILED: 'error.transcriptionFailed',
  QUOTA: 'error.quota',
};

export class SonyiaApp {
  private readonly fileInput = el<HTMLInputElement>('file-input');
  private readonly dropZone = el<HTMLDivElement>('drop-zone');
  private readonly pickButton = el<HTMLButtonElement>('pick-file');
  private readonly heroPick = el<HTMLAnchorElement>('hero-pick');
  private readonly fileCard = el<HTMLDivElement>('file-card');
  private readonly fileName = el<HTMLElement>('file-name');
  private readonly fileMeta = el<HTMLElement>('file-meta');
  private readonly removeButton = el<HTMLButtonElement>('remove-file');
  private readonly startButton = el<HTMLButtonElement>('start-button');
  private readonly uploadError = el<HTMLParagraphElement>('upload-error');
  private readonly modelSelect = el<HTMLSelectElement>('model-select');
  private readonly vadSelect = el<HTMLSelectElement>('vad-select');
  private readonly languageSelect = el<HTMLSelectElement>('language-select');
  private readonly timestampsToggle = el<HTMLInputElement>('timestamps-toggle');
  private readonly modelHint = el<HTMLParagraphElement>('model-hint');
  private readonly modelSize = el<HTMLSpanElement>('model-size');
  private readonly modelRam = el<HTMLSpanElement>('model-ram');
  private readonly progressPanel = el<HTMLElement>('progress-panel');
  private readonly progressFile = el<HTMLElement>('progress-file');
  private readonly progressFill = el<HTMLSpanElement>('progress-fill');
  private readonly progressBar = el<HTMLDivElement>('progress-bar');
  private readonly progressPercent = el<HTMLSpanElement>('progress-percent');
  private readonly progressStage = el<HTMLSpanElement>('progress-stage');
  private readonly progressDetail = el<HTMLParagraphElement>('progress-detail');
  private readonly progressElapsed = el<HTMLElement>('progress-elapsed');
  private readonly cancelButton = el<HTMLButtonElement>('cancel-button');
  private readonly resultEmpty = el<HTMLDivElement>('result-empty');
  private readonly resultContent = el<HTMLDivElement>('result-content');
  private readonly metaLanguage = el<HTMLElement>('meta-language');
  private readonly metaDuration = el<HTMLElement>('meta-duration');
  private readonly metaModel = el<HTMLElement>('meta-model');
  private readonly metaSegments = el<HTMLElement>('meta-segments');
  private readonly editor = el<HTMLTextAreaElement>('transcript-editor');
  private readonly segmentView = el<HTMLDivElement>('segment-view');
  private readonly viewContinuous = el<HTMLButtonElement>('view-continuous');
  private readonly viewSegments = el<HTMLButtonElement>('view-segments');
  private readonly copyButton = el<HTMLButtonElement>('copy-button');
  private readonly redoButton = el<HTMLButtonElement>('redo-button');
  private readonly clearButton = el<HTMLButtonElement>('clear-button');
  private readonly exportButtons = el<HTMLDivElement>('export-buttons');
  private readonly exportTimestamps = el<HTMLInputElement>('export-timestamps');
  private readonly themeToggle = el<HTMLButtonElement>('theme-toggle');
  private readonly localeSelect = el<HTMLSelectElement>('locale-select');
  private readonly toast = el<HTMLDivElement>('toast');

  private selectedFile: File | null = null;
  private mediaInfo: MediaInfo | null = null;
  private result: TranscriptResult | null = null;
  private decoderWorker: Worker | null = null;
  private transcriptionWorker: Worker | null = null;
  private jobId = '';
  private running = false;
  private startedAt = 0;
  private timer: number | null = null;
  private toastTimer: number | null = null;
  private currentLocale: Locale = 'pt-BR';
  private lastTranscriptText = '';

  constructor() {
    this.bindEvents();
    this.buildExportButtons();
    this.applyTranslations();
    applyTheme(getTheme());
    watchSystemTheme(applyTheme);
    window.addEventListener('sonyia:localechange', () => {
      this.currentLocale = this.localeSelect.value as Locale;
      this.applyTranslations();
    });
  }

  private bindEvents(): void {
    this.pickButton.addEventListener('click', () => this.fileInput.click());
    this.heroPick.addEventListener('click', (event) => {
      event.preventDefault();
      this.fileInput.click();
    });
    this.dropZone.addEventListener('click', (event) => {
      if (!(event.target as HTMLElement).closest('button')) this.fileInput.click();
    });
    this.dropZone.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        this.fileInput.click();
      }
    });
    this.fileInput.addEventListener('change', () => {
      const file = this.fileInput.files?.[0];
      if (file) void this.setFile(file);
    });

    for (const eventName of ['dragenter', 'dragover']) {
      this.dropZone.addEventListener(eventName, (event) => {
        event.preventDefault();
        this.dropZone.classList.add('drag-over');
      });
    }
    for (const eventName of ['dragleave', 'drop']) {
      this.dropZone.addEventListener(eventName, (event) => {
        event.preventDefault();
        this.dropZone.classList.remove('drag-over');
      });
    }
    this.dropZone.addEventListener('drop', (event) => {
      const dragEvent = event as DragEvent;
      const file = dragEvent.dataTransfer?.files?.[0];
      if (file) void this.setFile(file);
    });
    // Impede que um drop fora da área navegue para o arquivo.
    window.addEventListener('dragover', (event) => event.preventDefault());
    window.addEventListener('drop', (event) => event.preventDefault());

    this.removeButton.addEventListener('click', () => this.clearFile());
    this.startButton.addEventListener('click', () => void this.start());
    this.cancelButton.addEventListener('click', () => this.cancel());
    this.themeToggle.addEventListener('click', () => {
      toggleTheme();
      this.applyTranslations();
    });

    this.localeSelect.innerHTML = supportedLocales
      .map((locale) => `<option value="${locale}"></option>`)
      .join('');
    for (const option of this.localeSelect.options) {
      option.textContent = localeNames[option.value as Locale] ?? option.value;
    }
    this.localeSelect.value = getLocale();
    this.currentLocale = this.localeSelect.value as Locale;
    this.localeSelect.addEventListener('change', () => {
      setLocale(this.localeSelect.value as Locale);
      this.currentLocale = this.localeSelect.value as Locale;
    });

    this.modelSelect.addEventListener('change', () => this.updateModelHint());
    this.viewContinuous.addEventListener('click', () => this.setView('continuous'));
    this.viewSegments.addEventListener('click', () => this.setView('segments'));
    this.editor.addEventListener('input', () => {
      this.lastTranscriptText = this.editor.value;
    });
    this.copyButton.addEventListener('click', () => void this.copy());
    this.redoButton.addEventListener('click', () => void this.start());
    this.clearButton.addEventListener('click', () => this.clearResult());
  }

  private applyTranslations(): void {
    const stored = getLocale();
    if (this.localeSelect.value !== stored) this.localeSelect.value = stored;
    this.currentLocale = stored;
    const dictionary = getTranslation();
    for (const node of document.querySelectorAll<HTMLElement>('[data-i18n]')) {
      const key = node.dataset.i18n as TranslationKey;
      const template = dictionary[key] ?? t(key);
      const rawVars = node.dataset.vars;
      let vars: Record<string, string | number> | undefined;
      if (rawVars) {
        try {
          vars = JSON.parse(rawVars) as Record<string, string | number>;
        } catch {
          vars = undefined;
        }
      }
      node.textContent = template.replace(/\{([^{}]+)\}/g, (match, name: string) =>
        vars && Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name] ?? '') : match,
      );
    }
    for (const node of document.querySelectorAll<HTMLElement>('[data-i18n-title]')) {
      node.title = t(node.dataset.i18nTitle as TranslationKey);
    }
    for (const node of document.querySelectorAll<HTMLElement>('[data-i18n-aria]')) {
      node.setAttribute('aria-label', t(node.dataset.i18nAria as TranslationKey));
    }

    this.updateModelHint();
    this.updateFileCard();
    this.updateResultMeta();
    for (const button of this.exportButtons.querySelectorAll<HTMLButtonElement>('button')) {
      const format = button.dataset.format as ExportFormat;
      button.setAttribute('aria-label', t('export.download', { format: format.toUpperCase() }));
    }
    this.progressStage.textContent = t(`progress.stage.${this.currentStage}` as TranslationKey);
    this.progressDetail.textContent = this.localizedDetail(this.lastDetail);
    this.updateProgressUi(this.progressValue);
  }

  private currentStage: PipelineStage = 'idle';
  private lastDetail = '';
  private progressValue = 0;

  private updateModelHint(): void {
    const model = getModel(this.modelSelect.value as ModelId);
    this.modelHint.textContent = t(model.hintKey);
    this.modelSize.textContent = model.downloadApprox;
    this.modelRam.textContent = model.ramApprox;
  }

  private updateFileCard(): void {
    if (!this.selectedFile) return;
    this.fileName.textContent = sanitizeDisplayName(this.selectedFile.name);
    const parts = [formatBytes(this.selectedFile.size, this.currentLocale)];
    if (this.mediaInfo?.duration != null) {
      parts.push(formatDuration(this.mediaInfo.duration));
    } else {
      parts.push(t('upload.noDuration'));
    }
    parts.push(this.mediaInfo?.extension?.toUpperCase() ?? this.mediaInfo?.type ?? '—');
    this.fileMeta.textContent = parts.join(' · ');
  }

  private buildExportButtons(): void {
    this.exportButtons.replaceChildren();
    for (const format of EXPORT_FORMATS) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'export-button';
      button.dataset.format = format;
      button.innerHTML = `<span class="export-ext"></span><span class="export-label"></span>`;
      const ext = button.querySelector<HTMLElement>('.export-ext');
      const label = button.querySelector<HTMLElement>('.export-label');
      if (ext) ext.textContent = format.toUpperCase();
      if (label) label.textContent = t(`export.${format}` as TranslationKey);
      button.addEventListener('click', () => this.export(format));
      this.exportButtons.appendChild(button);
    }
  }

  private async setFile(file: File): Promise<void> {
    this.clearResult();
    this.uploadError.hidden = true;
    const issue = validateFile(file);
    if (issue) {
      this.showUploadError(t(issue.messageKey));
      return;
    }
    const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
    const header = new Uint8Array(await file.slice(0, 64).arrayBuffer());
    if (isProbablyCorrupted(header, extension)) {
      this.showUploadError(t('file.error.corrupted'));
      return;
    }

    this.selectedFile = file;
    this.mediaInfo = {
      name: sanitizeDisplayName(file.name),
      size: file.size,
      type: file.type || 'application/octet-stream',
      extension,
      duration: null,
      sampleRate: null,
      channels: null,
    };
    this.fileCard.hidden = false;
    this.dropZone.hidden = true;
    this.startButton.disabled = false;
    this.updateFileCard();
  }

  private showUploadError(message: string): void {
    this.uploadError.textContent = message;
    this.uploadError.hidden = false;
    this.selectedFile = null;
    this.startButton.disabled = true;
    this.fileCard.hidden = true;
    this.dropZone.hidden = false;
  }

  private clearFile(): void {
    if (this.running) this.cancel();
    this.selectedFile = null;
    this.mediaInfo = null;
    this.fileInput.value = '';
    this.fileCard.hidden = true;
    this.dropZone.hidden = false;
    this.startButton.disabled = true;
    this.uploadError.hidden = true;
  }

  private clearResult(): void {
    this.result = null;
    this.lastTranscriptText = '';
    this.editor.value = '';
    this.resultContent.hidden = true;
    this.resultEmpty.hidden = false;
    this.segmentView.replaceChildren();
    this.setView('continuous');
  }

  private setView(view: 'continuous' | 'segments'): void {
    this.viewContinuous.classList.toggle('active', view === 'continuous');
    this.viewSegments.classList.toggle('active', view === 'segments');
    this.viewContinuous.setAttribute('aria-selected', String(view === 'continuous'));
    this.viewSegments.setAttribute('aria-selected', String(view === 'segments'));
    this.editor.hidden = view !== 'continuous';
    this.segmentView.hidden = view !== 'segments';
  }

  private baseUrl(): URL {
    return new URL(import.meta.env.BASE_URL || './', document.baseURI);
  }

  private start(): void {
    if (!this.selectedFile || this.running) return;
    this.terminateWorkers();
    this.jobId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    this.running = true;
    this.startedAt = performance.now();
    this.progressValue = 0;
    this.currentStage = 'loading-file';
    this.lastDetail = '';
    this.progressFile.textContent = sanitizeDisplayName(this.selectedFile.name);
    this.progressPanel.hidden = false;
    this.progressFill.style.background = '';
    this.startButton.disabled = true;
    this.cancelButton.disabled = false;
    this.uploadError.hidden = true;
    this.updateProgressUi(0);
    this.timer = window.setInterval(() => {
      this.progressElapsed.textContent = formatElapsed(performance.now() - this.startedAt);
    }, 250);

    const base = this.baseUrl();
    const decoder = new Worker(new URL('../workers/decoder.worker.ts', import.meta.url), {
      type: 'module',
      name: `sonyia-decoder-${this.jobId}`,
    });
    this.decoderWorker = decoder;
    decoder.onmessage = (event: MessageEvent<DecoderResponse & { ortBase?: string }>) => {
      this.onDecoderMessage(event.data);
    };
    decoder.onerror = (event) => this.onError('DECODE_FAILED', event.message);
    decoder.postMessage({
      kind: 'decode',
      id: this.jobId,
      file: this.selectedFile,
      targetSampleRate: 16_000,
      coreURL: new URL('ffmpeg/ffmpeg-core.js', base).href,
      wasmURL: new URL('ffmpeg/ffmpeg-core.wasm', base).href,
    });
  }

  private onDecoderMessage(message: DecoderResponse): void {
    if (message.id !== this.jobId || !this.running) return;
    if (message.kind === 'progress') {
      this.updateProgress({
        stage: 'decoding',
        value: Math.min(0.18, message.value * 0.18),
        detail: message.detail,
      });
      return;
    }
    if (message.kind === 'error') {
      this.onError(message.code, message.message);
      return;
    }

    if (this.mediaInfo) {
      this.mediaInfo.duration = message.duration;
      this.mediaInfo.sampleRate = message.sampleRate;
      this.mediaInfo.channels = message.channels;
      this.updateFileCard();
    }
    this.updateProgress({ stage: 'detecting-speech', value: 0.19 });

    const worker = new Worker(new URL('../workers/transcription.worker.ts', import.meta.url), {
      type: 'module',
      name: `sonyia-transcriber-${this.jobId}`,
    });
    this.transcriptionWorker = worker;
    worker.onmessage = (event: MessageEvent<TranscriptionResponse>) => {
      this.onTranscriptionMessage(event.data);
    };
    worker.onerror = (event) => this.onError('TRANSCRIPTION_FAILED', event.message);

    const options: JobOptions = {
      fileName: sanitizeDisplayName(this.selectedFile?.name ?? 'audio'),
      modelId: this.modelSelect.value as ModelId,
      vadSensitivity: Number(this.vadSelect.value),
      languageOverride: this.languageSelect.value,
      includeTimestamps: this.timestampsToggle.checked,
    };
    worker.postMessage({
      kind: 'transcribe',
      id: this.jobId,
      samples: message.samples,
      options,
      ortBase: new URL('ort/', this.baseUrl()).href,
    });
  }

  private onTranscriptionMessage(message: TranscriptionResponse): void {
    if (message.id !== this.jobId || !this.running) return;
    if (message.kind === 'progress') {
      this.updateProgress(message.update);
      return;
    }
    if (message.kind === 'error') {
      this.onError(message.code, message.message);
      return;
    }
    this.result = message.result;
    this.lastTranscriptText = message.result.text;
    this.editor.value = message.result.text;
    this.renderResult();
    this.finish();
    this.showToast(t('toast.ready'));
  }

  private onError(code: string, message: string): void {
    const key = ERROR_KEYS[code] ?? 'error.unknown';
    this.progressStage.textContent = t('progress.stage.error');
    this.progressDetail.textContent = `${t(key)}${message ? ` (${message.slice(0, 160)})` : ''}`;
    this.progressFill.style.background = 'var(--danger)';
    this.finish();
    this.showToast(t('toast.error', { message: t(key) }), true);
  }

  private cancel(): void {
    if (!this.running) return;
    this.running = false;
    this.decoderWorker?.postMessage({ kind: 'cancel', id: this.jobId });
    this.transcriptionWorker?.postMessage({ kind: 'cancel', id: this.jobId });
    this.terminateWorkers();
    this.finish();
    this.progressStage.textContent = t('progress.stage.cancelled');
    this.showToast(t('toast.cancelled'));
  }

  private terminateWorkers(): void {
    this.decoderWorker?.terminate();
    this.transcriptionWorker?.terminate();
    this.decoderWorker = null;
    this.transcriptionWorker = null;
  }

  private finish(): void {
    this.running = false;
    this.terminateWorkers();
    if (this.timer != null) window.clearInterval(this.timer);
    this.timer = null;
    this.cancelButton.disabled = true;
    this.startButton.disabled = !this.selectedFile;
    window.setTimeout(() => {
      if (!this.running) this.progressPanel.hidden = true;
    }, 900);
  }

  private localizedDetail(detail: string): string {
    if (!detail) return '';
    const vad = detail.match(/^VAD:\s*(\d+)$/);
    if (vad?.[1]) return t('progress.detail.segments', { count: vad[1] });
    const parts = detail.match(/^(\d+)\/(\d+)$/);
    if (parts?.[1] && parts[2]) {
      return t('progress.detail.transcribing', { current: parts[1], total: parts[2] });
    }
    const percentMatch = detail.match(/^([^ ]+) (\d+)%$/);
    if (percentMatch) return `${percentMatch[1]} · ${percentMatch[2]}%`;
    return detail;
  }

  private updateProgress(update: ProgressUpdate): void {
    this.currentStage = update.stage;
    this.lastDetail = update.detail ?? '';
    this.progressValue = Math.max(this.progressValue, Math.min(1, 0.18 + update.value * 0.82));
    this.progressStage.textContent = t(`progress.stage.${update.stage}` as TranslationKey);
    this.progressDetail.textContent = this.localizedDetail(this.lastDetail);
    this.updateProgressUi(this.progressValue);
  }

  private updateProgressUi(value: number): void {
    const rounded = Math.round(value * 100);
    this.progressFill.style.width = `${rounded}%`;
    this.progressPercent.textContent = `${rounded}%`;
    this.progressBar.setAttribute('aria-valuenow', String(rounded));
  }

  private renderResult(): void {
    if (!this.result) return;
    this.updateResultMeta();
    this.editor.value = this.result.text;
    this.segmentView.replaceChildren();
    for (const segment of this.result.segments) {
      const row = document.createElement('div');
      row.className = 'segment-item';
      const time = document.createElement('span');
      time.className = 'segment-time';
      time.textContent = `${formatDuration(segment.start)} – ${formatDuration(segment.end)}`;
      const text = document.createElement('span');
      text.className = 'segment-text';
      text.textContent = segment.text;
      row.append(time, text);
      this.segmentView.appendChild(row);
    }
    this.resultEmpty.hidden = true;
    this.resultContent.hidden = false;
    this.setView('continuous');
  }

  private updateResultMeta(): void {
    if (!this.result) return;
    this.metaLanguage.textContent =
      languageLabel(this.result.detectedLanguage) === '—'
        ? t('result.unknownLanguage')
        : languageLabel(this.result.detectedLanguage);
    this.metaDuration.textContent = formatDuration(this.result.duration);
    this.metaModel.textContent = this.result.modelLabel;
    this.metaSegments.textContent = String(this.result.segments.length);
  }

  private async copy(): Promise<void> {
    const text = this.editor.value;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      this.copyButton.textContent = t('result.copied');
      this.showToast(t('toast.copied'));
      window.setTimeout(() => {
        this.copyButton.textContent = t('result.copy');
      }, 1600);
    } catch {
      this.copyButton.textContent = t('result.copyFailed');
    }
  }

  private export(format: ExportFormat): void {
    if (!this.result) return;
    const edited: TranscriptResult = { ...this.result, text: this.lastTranscriptText };
    const blob = buildExport(edited, format, {
      includeTimestamps: this.exportTimestamps.checked,
    });
    const base = safeFileName(this.result.fileName.replace(/\.[^.]+$/, '')) || 'transcricao';
    downloadBlob(blob, `${base}.${format}`);
    this.showToast(t('export.generated', { format: format.toUpperCase() }));
  }

  private showToast(message: string, error = false): void {
    this.toast.textContent = message;
    this.toast.classList.toggle('error', error);
    this.toast.hidden = false;
    if (this.toastTimer != null) window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => {
      this.toast.hidden = true;
    }, 4200);
  }
}
