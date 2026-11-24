/** Tipos compartilhados entre interface, workers e exportação. */

export type Locale = 'pt-BR' | 'en' | 'es';
export type Theme = 'light' | 'dark';
export type ModelId = 'tiny' | 'base' | 'small';
export type PipelineStage =
  | 'idle'
  | 'loading-file'
  | 'analyzing'
  | 'decoding'
  | 'detecting-speech'
  | 'detecting-language'
  | 'transcribing'
  | 'formatting'
  | 'done'
  | 'error'
  | 'cancelled';

export interface MediaInfo {
  name: string;
  size: number;
  type: string;
  extension: string;
  /** Segundos. Preenchido quando o decodificador consegue medir. */
  duration: number | null;
  sampleRate: number | null;
  channels: number | null;
}

export interface SpeechSegment {
  start: number;
  end: number;
  /** Confiança heurística do VAD (0..1), não precisão do ASR. */
  confidence: number;
}

export interface TranscriptSegment {
  id: number;
  start: number;
  end: number;
  text: string;
  /** Confiança média do VAD para o trecho, quando disponível. */
  confidence: number | null;
}

export interface TranscriptResult {
  text: string;
  segments: TranscriptSegment[];
  detectedLanguage: string | null;
  languageConfidence: number | null;
  duration: number;
  modelId: ModelId;
  modelLabel: string;
  fileName: string;
  createdAt: string;
  processingMs: number;
  vadSegments: SpeechSegment[];
}

export interface JobOptions {
  /** Nome original do arquivo (usado nos metadados de exportação). */
  fileName: string;
  modelId: ModelId;
  /** 0 (conservador) .. 1 (inclusivo). */
  vadSensitivity: number;
  /** Força um idioma (código Whisper). Vazio = detecção automática. */
  languageOverride: string;
  /** Inclui marcações de tempo no texto contínuo. */
  includeTimestamps: boolean;
}

export interface ProgressUpdate {
  stage: PipelineStage;
  /** 0..1 */
  value: number;
  detail?: string;
}

/** Canal main-thread -> decoder worker. */
export type DecoderRequest =
  | {
      kind: 'decode';
      id: string;
      file: File;
      targetSampleRate: number;
    }
  | { kind: 'cancel'; id: string };

/** Canal decoder worker -> main thread. */
export type DecoderResponse =
  | { kind: 'progress'; id: string; value: number; detail?: string }
  | {
      kind: 'result';
      id: string;
      samples: Float32Array;
      sampleRate: number;
      channels: number;
      duration: number;
    }
  | { kind: 'error'; id: string; message: string; code: string };

/** Canal main-thread -> transcription worker. */
export type TranscriptionRequest =
  | {
      kind: 'transcribe';
      id: string;
      samples: Float32Array;
      options: JobOptions;
      /** URL absoluta da pasta com os arquivos wasm do ONNX Runtime. */
      ortBase: string;
    }
  | { kind: 'cancel'; id: string };

/** Canal transcription worker -> main thread. */
export type TranscriptionResponse =
  | { kind: 'progress'; id: string; update: ProgressUpdate }
  | { kind: 'result'; id: string; result: TranscriptResult }
  | { kind: 'error'; id: string; message: string; code: string };

export type ExportFormat = 'txt' | 'srt' | 'vtt' | 'json' | 'pdf';
