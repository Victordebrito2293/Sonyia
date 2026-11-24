/// <reference lib="webworker" />
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import type { DecoderRequest, DecoderResponse } from '../core/types';
import { normalizeExtension } from '../security/file-validation';

const ctx = self as unknown as DedicatedWorkerGlobalScope;
const ffmpeg = new FFmpeg();

interface DecoderInit {
  coreURL: string;
  wasmURL: string;
}

type DecoderMessage = DecoderRequest & Partial<DecoderInit>;
type LogHandler = (event: { message: string }) => void;

let initPromise: Promise<void> | null = null;
let activeId = '';
let currentLogHandler: LogHandler | null = null;

function post(message: DecoderResponse): void {
  ctx.postMessage(message);
}

function load(config: DecoderInit): Promise<void> {
  if (ffmpeg.loaded) return Promise.resolve();
  if (!initPromise) {
    initPromise = (async () => {
      // Arquivos servidos pelo próprio site (public/ffmpeg), nunca por CDN.
      const coreURL = await toBlobURL(config.coreURL, 'text/javascript');
      const wasmURL = await toBlobURL(config.wasmURL, 'application/wasm');
      await ffmpeg.load({ coreURL, wasmURL });
    })().catch((error: unknown) => {
      initPromise = null;
      throw error;
    });
  }
  return initPromise;
}

/** Extrai duração e tempo decorrido do log real do ffmpeg. */
function parseProgress(line: string): number | null {
  const duration = line.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
  if (duration) {
    const total = Number(duration[1]) * 3600 + Number(duration[2]) * 60 + Number(duration[3]);
    return total > 0 ? -total : null;
  }
  const time = line.match(/time=\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
  if (!time) return null;
  return Number(time[1]) * 3600 + Number(time[2]) * 60 + Number(time[3]);
}

function wavToFloat32(bytes: Uint8Array): {
  samples: Float32Array;
  sampleRate: number;
  channels: number;
} {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let position = 12;
  let sampleRate = 16_000;
  let channels = 1;
  let dataOffset = -1;
  let dataLength = 0;

  while (position + 8 <= bytes.length) {
    const id = String.fromCharCode(...bytes.subarray(position, position + 4));
    const size = view.getUint32(position + 4, true);
    const body = position + 8;
    if (id === 'fmt ') {
      channels = view.getUint16(body + 2, true);
      sampleRate = view.getUint32(body + 4, true);
    } else if (id === 'data') {
      dataOffset = body;
      dataLength = size;
      break;
    }
    position = body + size + (size % 2);
  }
  if (dataOffset < 0) throw new Error('WAV sem bloco de dados');

  const frames = Math.floor(dataLength / (2 * channels));
  const samples = new Float32Array(frames * channels);
  for (let i = 0; i < samples.length; i += 1) {
    samples[i] = view.getInt16(dataOffset + i * 2, true) / 32768;
  }
  return { samples, sampleRate, channels };
}

async function decode(
  request: Extract<DecoderRequest, { kind: 'decode' }>,
  config: DecoderInit,
): Promise<void> {
  const { id, file } = request;
  let totalDuration = 0;
  try {
    await load(config);
    if (activeId !== id) return;

    const extension = normalizeExtension(file.name);
    const inputName = `input.${extension}`;
    const outputName = 'audio.wav';
    const logHandler: LogHandler = ({ message }) => {
      const value = parseProgress(message);
      if (value == null) return;
      if (value < 0) {
        totalDuration = -value;
      } else if (totalDuration > 0) {
        post({
          kind: 'progress',
          id,
          value: Math.max(0, Math.min(0.95, value / totalDuration)),
          detail: message.slice(0, 120),
        });
      }
    };
    currentLogHandler = logHandler;
    ffmpeg.on('log', logHandler);

    await ffmpeg.writeFile(inputName, await fetchFile(file));
    post({ kind: 'progress', id, value: 0.02, detail: inputName });

    const code = await ffmpeg.exec([
      '-hide_banner',
      '-nostdin',
      '-i',
      inputName,
      '-vn',
      '-map',
      '0:a:0',
      '-ac',
      '1',
      '-ar',
      String(request.targetSampleRate),
      '-c:a',
      'pcm_s16le',
      '-y',
      outputName,
    ]);
    if (code !== 0) throw new Error(`ffmpeg retornou ${code}`);

    const data = await ffmpeg.readFile(outputName);
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data as unknown as ArrayBuffer);
    const decoded = wavToFloat32(bytes);
    if (decoded.samples.length === 0) throw new Error('Nenhuma amostra de áudio');

    await ffmpeg.deleteFile(inputName).catch(() => undefined);
    await ffmpeg.deleteFile(outputName).catch(() => undefined);

    post({
      kind: 'result',
      id,
      samples: decoded.samples,
      sampleRate: decoded.sampleRate,
      channels: decoded.channels,
      duration: decoded.samples.length / decoded.sampleRate / decoded.channels,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    post({ kind: 'error', id, code: 'DECODE_FAILED', message });
  } finally {
    if (currentLogHandler) ffmpeg.off('log', currentLogHandler);
    currentLogHandler = null;
  }
}

ctx.onmessage = (event: MessageEvent<DecoderMessage>) => {
  const request = event.data;
  if (request.kind === 'cancel') {
    if (request.id === activeId) activeId = '';
    return;
  }
  activeId = request.id;
  void decode(request, {
    coreURL: request.coreURL ?? '',
    wasmURL: request.wasmURL ?? '',
  });
};

export {};
