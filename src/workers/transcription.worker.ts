/// <reference lib="webworker" />
import { env, pipeline } from '@huggingface/transformers';
import type {
  TranscriptResult,
  TranscriptionRequest,
  TranscriptionResponse,
  SpeechSegment,
} from '../core/types';
import { detectLanguage, whisperLanguageCode } from '../transcription/language';
import { getModel } from '../transcription/models';
import { buildContinuousText, toTranscriptSegments, type RawChunk } from '../transcription/text';
import initAudioEngine, * as audioEngine from '../wasm/audio_engine.js';

const ctx = self as unknown as DedicatedWorkerGlobalScope;
let activeId = '';

type Transcriber = Awaited<ReturnType<typeof pipeline<'automatic-speech-recognition'>>>;
const transcribers = new Map<string, Transcriber>();

function post(message: TranscriptionResponse): void {
  ctx.postMessage(message);
}

function fail(id: string, code: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  post({ kind: 'error', id, code, message });
}

function flatToSegments(flat: Float32Array): SpeechSegment[] {
  const result: SpeechSegment[] = [];
  for (let i = 0; i + 2 < flat.length; i += 3) {
    result.push({ start: flat[i]!, end: flat[i + 1]!, confidence: flat[i + 2]! });
  }
  return result;
}

function configureRuntime(ortBase: string): void {
  env.allowLocalModels = false;
  env.useBrowserCache = true;
  env.useWasmCache = true;
  const onnxWasm = env.backends.onnx.wasm!;
  onnxWasm.numThreads = 1;
  onnxWasm.proxy = false;

  // Transformers.js escolhe `asyncify` fora do Safari antigo. Mantemos os
  // arquivos locais para que não seja necessário CDN de terceiros no runtime.
  const userAgent = typeof navigator === 'undefined' ? '' : navigator.userAgent;
  const safariBelow26 = /Safari/i.test(userAgent) && !/Chrome|Chromium|Android/i.test(userAgent);
  const suffix = safariBelow26 ? '' : '.asyncify';
  onnxWasm.wasmPaths = {
    mjs: `${ortBase}ort-wasm-simd-threaded${suffix}.mjs`,
    wasm: `${ortBase}ort-wasm-simd-threaded${suffix}.wasm`,
  };
}

async function getTranscriber(
  modelId: string,
  onProgress: (fraction: number, detail: string) => void,
): Promise<Transcriber> {
  const cached = transcribers.get(modelId);
  if (cached) return cached;

  const files = new Map<string, { loaded: number; total: number }>();
  const transcriber = await pipeline('automatic-speech-recognition', modelId, {
    device: 'wasm',
    dtype: 'q8',
    progress_callback: (rawEvent) => {
      const event = rawEvent as {
        status: string;
        file?: string;
        loaded?: number;
        total?: number;
      };
      const file = event.file ?? 'model';
      if (event.status === 'progress' && event.loaded != null) {
        const previous = files.get(file) ?? { loaded: 0, total: 0 };
        files.set(file, {
          loaded: event.loaded,
          total: event.total ?? previous.total,
        });
      }
      const totals = [...files.values()];
      const total = totals.reduce((sum, item) => sum + item.total, 0);
      const loaded = totals.reduce((sum, item) => sum + item.loaded, 0);
      if (total > 0) onProgress(Math.min(1, loaded / total), file);
    },
  }) as Transcriber;
  transcribers.set(modelId, transcriber);
  return transcriber;
}

async function transcribe(request: Extract<TranscriptionRequest, { kind: 'transcribe' }>): Promise<void> {
  const { id, samples, options, ortBase } = request;
  const startedAt = performance.now();
  try {
    await initAudioEngine();
    if (activeId !== id) return;

    post({
      kind: 'progress',
      id,
      update: { stage: 'detecting-speech', value: 0.08 },
    });

    const pcm16k = audioEngine.resample_mono_16k(samples, 16_000, 1);
    if (pcm16k.length === 0) throw new Error('PCM vazio');
    audioEngine.normalize(pcm16k, 0.95);

    const speech = flatToSegments(audioEngine.speech_segments(pcm16k, 16_000, options.vadSensitivity));
    if (speech.length === 0) {
      fail(id, 'NO_SPEECH', new Error('Nenhum trecho de fala detectado'));
      return;
    }
    post({
      kind: 'progress',
      id,
      update: {
        stage: 'detecting-speech',
        value: 0.16,
        detail: `VAD: ${speech.length}`,
      },
    });

    const model = getModel(options.modelId);
    configureRuntime(ortBase);
    const transcriber = await getTranscriber(model.repository, (fraction, file) => {
      post({
        kind: 'progress',
        id,
        update: {
          stage: 'transcribing',
          value: 0.2 + fraction * 0.2,
          detail: `${file} ${Math.round(fraction * 100)}%`,
        },
      });
    });
    if (activeId !== id) return;

    const collectChunks = async (
      languageCode: string | null,
    ): Promise<TranscriptSegmentAccumulator[]> => {
      const collected: TranscriptSegmentAccumulator[] = [];
      for (let i = 0; i < speech.length; i += 1) {
        if (activeId !== id) return collected;
        const segment = speech[i]!;
        const startSample = Math.max(0, Math.floor(segment.start * 16_000));
        const endSample = Math.min(pcm16k.length, Math.ceil(segment.end * 16_000));
        const audio = audioEngine.slice(pcm16k, startSample, endSample);
        if (audio.length < 1_600) continue;

        post({
          kind: 'progress',
          id,
          update: {
            stage: 'transcribing',
            value: 0.4 + (i / speech.length) * 0.55,
            detail: `${i + 1}/${speech.length}`,
          },
        });

        const output = (await transcriber(audio, {
          return_timestamps: true,
          chunk_length_s: 30,
          stride_length_s: 5,
          task: 'transcribe',
          ...(languageCode ? { language: languageCode } : {}),
          force_full_sequences: false,
        })) as { text: string; chunks?: RawChunk[] };

        const rawChunks = output.chunks?.length
          ? output.chunks
          : [{ text: output.text, timestamp: [segment.start, segment.end] as [number, number] }];
        collected.push(
          ...toTranscriptSegments(rawChunks, segment, segment.start, collected.length + 1),
        );
      }
      return collected;
    };

    // Transformers.js 4.3.2 não detecta idioma sozinho: sem prompt ele usa
    // inglês. Fazemos uma primeira passada, detectamos o idioma no texto e,
    // quando necessário, repetimos com o prompt correto.
    const overrideCode = whisperLanguageCode(options.languageOverride || null);
    let chunks = await collectChunks(overrideCode);
    if (activeId !== id) return;

    let detectedLanguage: string | null = options.languageOverride || null;
    if (!detectedLanguage) {
      const guessed = detectLanguage(chunks.map((chunk) => chunk.text).join(' '));
      if (guessed) {
        detectedLanguage = guessed;
        const guessedCode = whisperLanguageCode(guessed);
        if (guessedCode && guessedCode !== 'en') chunks = await collectChunks(guessedCode);
      }
    }

    post({ kind: 'progress', id, update: { stage: 'formatting', value: 0.98 } });
    const segments = [...chunks]
      .sort((a, b) => a.start - b.start)
      .map((segment, index) => ({ ...segment, id: index + 1 }));
    const result: TranscriptResult = {
      text: buildContinuousText(segments, options.includeTimestamps),
      segments,
      detectedLanguage,
      languageConfidence: null,
      duration: pcm16k.length / 16_000,
      modelId: options.modelId,
      modelLabel: model.repository,
      fileName: options.fileName,
      createdAt: new Date().toISOString(),
      processingMs: Math.round(performance.now() - startedAt),
      vadSegments: speech,
    };
    // fileName é preenchido pela thread principal com o nome real do arquivo.
    post({ kind: 'result', id, result });
  } catch (error) {
    if (activeId === id) fail(id, 'TRANSCRIPTION_FAILED', error);
  }
}

type TranscriptSegmentAccumulator = import('../core/types').TranscriptSegment;

ctx.onmessage = (event: MessageEvent<TranscriptionRequest>) => {
  const request = event.data;
  if (request.kind === 'cancel') {
    if (request.id === activeId) activeId = '';
    return;
  }
  activeId = request.id;
  void transcribe(request);
};

export {};
