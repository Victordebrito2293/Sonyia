//! Detecção de atividade de voz baseada em energia, taxa de cruzamento por zero,
//! planitude espectral e variação temporal. É um classificador determinístico e
//! local: não é um modelo neural e não produz "precisão" de transcrição.

use crate::dsp::fft_magnitudes;

pub const FRAME_MS: f32 = 20.0;
const FFT_SIZE: usize = 512;
const EPS: f32 = 1e-8;

#[derive(Clone, Copy, Debug)]
pub struct FrameFeatures {
    pub rms_db: f32,
    pub zcr: f32,
    pub flatness: f32,
    pub flux: f32,
    pub score: f32,
}

#[derive(Clone, Copy, Debug)]
pub struct SpeechSegment {
    pub start: f32,
    pub end: f32,
    pub confidence: f32,
}

fn sigmoid(x: f32) -> f32 {
    1.0 / (1.0 + (-x).exp())
}

/// Extrai medidas por janela de 20 ms: dBFS, ZCR, planitude, fluxo espectral
/// e uma pontuação heurística de presença de fala.
pub fn frame_features(samples: &[f32], sample_rate: u32, sensitivity: f32) -> Vec<FrameFeatures> {
    if sample_rate == 0 {
        return Vec::new();
    }
    let frame_len = ((sample_rate as f32 * FRAME_MS / 1000.0).round() as usize).max(1);
    let count = samples.len().div_ceil(frame_len);
    let mut raw = Vec::with_capacity(count);
    let mut previous_mags: Option<Vec<f32>> = None;

    for chunk in samples.chunks(frame_len) {
        if chunk.len() < frame_len / 2 {
            break;
        }
        let rms = (chunk.iter().map(|x| x * x).sum::<f32>() / chunk.len() as f32).sqrt();
        let rms_db = 20.0 * (rms + EPS).log10();
        let zcr = chunk.windows(2).filter(|w| w[0] * w[1] < 0.0).count() as f32 / chunk.len() as f32;

        let mags = fft_magnitudes(chunk);
        let bins = mags.iter().take(FFT_SIZE / 2).map(|m| m * m + EPS);
        let mut log_sum = 0.0f32;
        let mut sum = 0.0f32;
        let mut n = 0usize;
        for power in bins {
            log_sum += power.ln();
            sum += power;
            n += 1;
        }
        let flatness = if n > 0 && sum > EPS {
            (log_sum / n as f32).exp() / (sum / n as f32)
        } else {
            1.0
        };

        // Fluxo espectral: um tom instrumental constante tem fluxo ~0, enquanto
        // a fala muda de espectro a cada quadro (formantes, sílabas, pausas).
        let current_sum: f32 = mags.iter().take(FFT_SIZE / 2).sum();
        let flux = match &previous_mags {
            Some(prev) => {
                let diff: f32 = mags
                    .iter()
                    .zip(prev.iter())
                    .take(FFT_SIZE / 2)
                    .map(|(a, b)| (a - b).abs())
                    .sum();
                let prev_sum: f32 = prev.iter().take(FFT_SIZE / 2).sum();
                diff / (current_sum + prev_sum + EPS)
            }
            None => 0.0,
        };
        previous_mags = Some(mags);

        let level = sigmoid((rms_db + 38.0) / 6.0);
        let speech_band = (-((flatness - 0.18f32) / 0.22).powi(2)).exp();
        let zcr_term = (-((zcr - 0.11f32) / 0.13).powi(2)).exp();
        let flux_term = (flux / 0.35).clamp(0.0, 1.0);
        let mut score =
            0.22 * level + 0.12 * speech_band + 0.08 * zcr_term + 0.28 * flux_term;
        if rms_db < -50.0 {
            score = 0.0;
        }
        raw.push(FrameFeatures { rms_db, zcr, flatness, flux, score });
    }

    // Variação local de energia e de ZCR: fala tem modulação em ~2-8 Hz;
    // um tom puro é estacionário nos dois aspectos.
    let half_window = ((0.25 / (FRAME_MS / 1000.0)).round() as usize).max(1);
    let mut features = Vec::with_capacity(raw.len());
    for (i, frame) in raw.iter().enumerate() {
        let from = i.saturating_sub(half_window);
        let to = (i + half_window + 1).min(raw.len());
        let window = &raw[from..to];
        let mean_rms = window.iter().map(|f| f.rms_db).sum::<f32>() / window.len() as f32;
        let mean_zcr = window.iter().map(|f| f.zcr).sum::<f32>() / window.len() as f32;
        let rms_dev = (window.iter().map(|f| (f.rms_db - mean_rms).powi(2)).sum::<f32>()
            / window.len() as f32)
            .sqrt();
        let zcr_dev = (window.iter().map(|f| (f.zcr - mean_zcr).powi(2)).sum::<f32>()
            / window.len() as f32)
            .sqrt();
        let variation = (rms_dev / 12.0).clamp(0.0, 1.0);
        let zcr_variation = (zcr_dev / 0.045).clamp(0.0, 1.0);
        let mut score = frame.score + 0.16 * variation + 0.16 * zcr_variation;
        if frame.rms_db < -50.0 {
            score = 0.0;
        }
        features.push(FrameFeatures { score: score.clamp(0.0, 1.0), ..*frame });
    }

    let _ = sensitivity; // o limiar é aplicado em detect_speech, não nas features
    features
}

/// Converte pontuações em segmentos com histerese, duração mínima e padding.
/// `sensitivity` vai de 0 (conservador) a 1 (inclusivo).
pub fn detect_speech(samples: &[f32], sample_rate: u32, sensitivity: f32) -> Vec<SpeechSegment> {
    let features = frame_features(samples, sample_rate, sensitivity);
    if features.is_empty() || sample_rate == 0 {
        return Vec::new();
    }
    let frame_seconds = FRAME_MS / 1000.0;
    let sensitivity = sensitivity.clamp(0.0, 1.0);
    let enter = 0.60 - 0.20 * sensitivity;
    let exit = enter - 0.18;

    let mut smoothed = Vec::with_capacity(features.len());
    for i in 0..features.len() {
        let from = i.saturating_sub(1);
        let to = (i + 2).min(features.len());
        let mut values: Vec<f32> = features[from..to].iter().map(|f| f.score).collect();
        values.sort_by(|a, b| a.total_cmp(b));
        smoothed.push(values[values.len() / 2]);
    }

    let min_speech = (0.12 / frame_seconds).ceil() as usize;
    let min_silence = (0.32 / frame_seconds).ceil() as usize;
    let mut candidates: Vec<(usize, usize)> = Vec::new();
    let mut start: Option<usize> = None;
    let mut silence = 0usize;
    for (i, &score) in smoothed.iter().enumerate() {
        match start {
            None if score >= enter => start = Some(i),
            Some(_) if score < exit => {
                silence += 1;
                if silence >= min_silence {
                    let s = start.unwrap();
                    candidates.push((s, i - silence + 1));
                    start = None;
                    silence = 0;
                }
            }
            Some(_) => silence = 0,
            None => {}
        }
    }
    if let Some(s) = start {
        candidates.push((s, smoothed.len()));
    }

    let valid: Vec<(usize, usize)> = candidates
        .into_iter()
        .filter(|(s, e)| e.saturating_sub(*s) >= min_speech)
        .collect();
    if valid.is_empty() {
        return Vec::new();
    }

    let pad = (0.16 / frame_seconds).round() as usize;
    let mut merged: Vec<(usize, usize)> = Vec::new();
    for (s, e) in valid {
        let s2 = s.saturating_sub(pad);
        let e2 = (e + pad).min(smoothed.len());
        if let Some(last) = merged.last_mut() {
            if s2 <= last.1 {
                last.1 = e2.max(last.1);
                continue;
            }
        }
        merged.push((s2, e2));
    }

    let duration = samples.len() as f32 / sample_rate as f32;
    merged
        .into_iter()
        .map(|(s, e)| {
            // A confiança considera apenas quadros que ultrapassaram o limiar:
            // o padding de 160 ms adicionado para não cortar sílabas não deve
            // reduzir a pontuação do segmento.
            let active: Vec<f32> = smoothed[s..e]
                .iter()
                .copied()
                .filter(|score| *score >= enter)
                .collect();
            let confidence = if active.is_empty() {
                smoothed[s..e].iter().copied().fold(0.0f32, f32::max)
            } else {
                active.iter().sum::<f32>() / active.len() as f32
            };
            SpeechSegment {
                start: (s as f32 * frame_seconds).min(duration),
                end: (e as f32 * frame_seconds).min(duration),
                confidence: confidence.clamp(0.0, 1.0),
            }
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn signal(len: usize, f: impl Fn(usize) -> f32) -> Vec<f32> {
        (0..len).map(f).collect()
    }

    #[test]
    fn silence_produces_no_segments() {
        let samples = vec![0.0f32; 16_000 * 3];
        assert!(detect_speech(&samples, 16_000, 0.5).is_empty());
    }

    #[test]
    fn steady_sine_is_not_treated_as_speech() {
        let samples: Vec<f32> = (0..16_000 * 3)
            .map(|i| 0.6 * (2.0 * std::f64::consts::PI * 440.0 * i as f64 / 16_000.0).sin() as f32)
            .collect();
        assert!(
            detect_speech(&samples, 16_000, 0.5).is_empty(),
            "tom puro constante não deve ser considerado fala"
        );
    }

    #[test]
    fn modulated_broadband_bursts_are_detected() {
        let rate = 16_000usize;
        let mut samples = vec![0.0f32; rate * 3];
        for burst in 0..4 {
            let start = rate / 10 + burst * (rate * 7 / 10);
            for i in start..(start + rate / 5).min(samples.len()) {
                let envelope = (std::f64::consts::PI * (i - start) as f64 / (rate / 5) as f64).sin();
                let phase = (i as f64 * 12.9898).sin() * 43758.5453;
                let noise = phase.fract() * 2.0 - 1.0;
                samples[i] = (envelope * noise * 0.4) as f32;
            }
        }
        let segments = detect_speech(&samples, rate as u32, 0.5);
        assert_eq!(segments.len(), 4, "segmentos: {segments:?}");
        for segment in &segments {
            assert!(segment.confidence > 0.5);
            assert!(segment.end > segment.start);
        }
    }

    /// Áudio de fala real (LibriSpeech dev-clean, domínio público via CC BY 4.0),
    /// Convertido para PCM16 mono @16 kHz.
    fn read_pcm16_wav(bytes: &[u8]) -> Vec<f32> {
        let mut pos = 12usize;
        while pos + 8 <= bytes.len() {
            let id = &bytes[pos..pos + 4];
            let size = u32::from_le_bytes(bytes[pos + 4..pos + 8].try_into().unwrap()) as usize;
            pos += 8;
            if id == b"data" {
                return bytes[pos..pos + size]
                    .chunks_exact(2)
                    .map(|c| i16::from_le_bytes([c[0], c[1]]) as f32 / 32768.0)
                    .collect();
            }
            pos += size + size % 2;
        }
        Vec::new()
    }

    #[test]
    fn real_speech_fixture_is_detected_and_tone_is_not() {
        let speech = read_pcm16_wav(include_bytes!(
            "../../../tests/fixtures/1272-128104-0000.wav"
        ));
        let tone = read_pcm16_wav(include_bytes!(
            "../../../tests/fixtures/instrumental-tone.wav"
        ));
        let speech_segments = detect_speech(&speech, 16_000, 0.5);
        assert_eq!(speech_segments.len(), 1, "{speech_segments:?}");
        assert!(speech_segments[0].start < 1.0);
        assert!(speech_segments[0].end > 5.0);
        assert!(detect_speech(&tone, 16_000, 0.5).is_empty());
    }

    #[test]
    fn segments_stay_inside_audio_bounds() {
        let samples = signal(16_000, |i| {
            let seed = (i as f64 * 78.233).sin() * 12345.6789;
            ((seed.fract() * 2.0 - 1.0) * 0.5) as f32
        });
        for segment in detect_speech(&samples, 16_000, 1.0) {
            assert!(segment.start >= 0.0 && segment.end <= 1.0 + 1e-6);
        }
    }
}
