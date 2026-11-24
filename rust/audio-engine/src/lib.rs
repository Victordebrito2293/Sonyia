//! Sonyia Audio Engine — DSP local compilado para WebAssembly.
//! Toda a manipulação de áudio acontece no dispositivo do usuário; este módulo
//! não possui I/O de rede, filesystem, randomidade ou relógio.

mod dsp;
mod vad;

use dsp::{peak_normalize, resample_to_mono};
use vad::{detect_speech, frame_features};
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

/// Converte áudio intercalado em mono @16 kHz (taxa nativa do Whisper).
#[wasm_bindgen]
pub fn resample_mono_16k(input: &[f32], source_rate: u32, channels: u32) -> Vec<f32> {
    resample_to_mono(input, source_rate, channels, 16_000)
}

/// Normaliza o pico antes da inferência, sem alterar a forma de onda relativa.
#[wasm_bindgen]
pub fn normalize(samples: &mut [f32], target_peak: f32) {
    peak_normalize(samples, target_peak);
}

/// Features por janela de 20 ms, achatadas como
/// `[rms_db, zcr, flatness, flux, score, ...]`.
#[wasm_bindgen]
pub fn features(samples: &[f32], sample_rate: u32, sensitivity: f32) -> Vec<f32> {
    frame_features(samples, sample_rate, sensitivity)
        .iter()
        .flat_map(|f| [f.rms_db, f.zcr, f.flatness, f.flux, f.score])
        .collect()
}

/// Segmentos de fala achatados como `[start, end, confidence, ...]` (segundos).
#[wasm_bindgen]
pub fn speech_segments(samples: &[f32], sample_rate: u32, sensitivity: f32) -> Vec<f32> {
    detect_speech(samples, sample_rate, sensitivity)
        .iter()
        .flat_map(|s| [s.start, s.end, s.confidence])
        .collect()
}

/// Recorta um trecho sem realocar o buffer original desnecessariamente.
#[wasm_bindgen]
pub fn slice(samples: &[f32], start: usize, end: usize) -> Vec<f32> {
    let start = start.min(samples.len());
    let end = end.min(samples.len()).max(start);
    samples[start..end].to_vec()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn wasm_wrappers_match_engine() {
        let samples = vec![0.0f32; 16_000];
        assert!(speech_segments(&samples, 16_000, 0.5).is_empty());
        assert_eq!(features(&samples, 16_000, 0.5).len(), 50 * 5);
        assert_eq!(version(), "1.0.0");
        let mut audio = vec![0.25f32; 16];
        normalize(&mut audio, 1.0);
        assert!((audio[0] - 1.0).abs() < 1e-6);
        assert_eq!(slice(&audio, 2, 5).len(), 3);
    }

    #[test]
    fn resample_wrapper_targets_16k() {
        let input = vec![0.1f32; 48_000];
        assert_eq!(resample_mono_16k(&input, 48_000, 1).len(), 16_000);
    }
}
