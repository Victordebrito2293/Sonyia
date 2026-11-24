/* tslint:disable */
/* eslint-disable */

/**
 * Features por janela de 20 ms, achatadas como
 * `[rms_db, zcr, flatness, flux, score, ...]`.
 */
export function features(samples: Float32Array | number[], sample_rate: number, sensitivity: number): Float32Array;

/**
 * Normaliza o pico antes da inferência, sem alterar a forma de onda relativa.
 */
export function normalize(samples: Float32Array, target_peak: number): void;

/**
 * Converte áudio intercalado em mono @16 kHz (taxa nativa do Whisper).
 */
export function resample_mono_16k(input: Float32Array | number[], source_rate: number, channels: number): Float32Array;

/**
 * Recorta um trecho sem realocar o buffer original desnecessariamente.
 */
export function slice(samples: Float32Array | number[], start: number, end: number): Float32Array;

/**
 * Segmentos de fala achatados como `[start, end, confidence, ...]` (segundos).
 */
export function speech_segments(samples: Float32Array | number[], sample_rate: number, sensitivity: number): Float32Array;

export function version(): string;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly features: (a: number, b: number, c: number, d: number) => [number, number];
    readonly normalize: (a: number, b: number, c: any, d: number) => void;
    readonly resample_mono_16k: (a: number, b: number, c: number, d: number) => [number, number];
    readonly slice: (a: number, b: number, c: number, d: number) => [number, number];
    readonly speech_segments: (a: number, b: number, c: number, d: number) => [number, number];
    readonly version: () => [number, number];
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
