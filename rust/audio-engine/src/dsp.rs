//! Processamento digital de sinal usado pelo motor local da Sonyia.
//! Nenhuma função desta plataforma depende de rede, serviços externos ou alocação persistente.

use std::f64::consts::PI;

/// Reduz ruído de imagem espelhada e alisa o kernel sinc (janela de Blackman).
fn blackman(x: f64, half_taps: f64) -> f64 {
    let t = (x.abs() / half_taps).min(1.0);
    0.42 + 0.5 * (PI * t).cos() + 0.08 * (2.0 * PI * t).cos()
}

/// Reamostra canais intercalados para mono na taxa desejada.
///
/// Implementa sinc janela­do com 32 taps por lado e normalização de ganho.
/// Isso evita o aliasing que ocorreria com interpolação linear ingênua na
/// conversão de 44.1/48 kHz para os 16 kHz exigidos pelo Whisper.
pub fn resample_to_mono(input: &[f32], source_rate: u32, channels: u32, target_rate: u32) -> Vec<f32> {
    if input.is_empty() || source_rate == 0 || target_rate == 0 || channels == 0 {
        return Vec::new();
    }
    let channels = channels as usize;
    let mono: Vec<f32> = if channels == 1 {
        input.to_vec()
    } else {
        input
            .chunks_exact(channels)
            .map(|frame| frame.iter().sum::<f32>() / channels as f32)
            .collect()
    };
    if source_rate == target_rate {
        return mono;
    }

    let ratio = target_rate as f64 / source_rate as f64;
    let out_len = (mono.len() as f64 * ratio).floor() as usize;
    let cutoff = 0.45 * ratio.min(1.0);
    const TAPS: i64 = 24;
    let mut out = Vec::with_capacity(out_len);

    for i in 0..out_len {
        let center = (i as f64 + 0.5) / ratio - 0.5;
        let base = center.floor() as i64;
        let mut sum = 0.0f64;
        let mut weight_sum = 0.0f64;
        for j in (base - TAPS + 1)..=(base + TAPS) {
            if j < 0 || j as usize >= mono.len() {
                continue;
            }
            let x = center - j as f64;
            let sinc = if x.abs() < 1e-9 {
                2.0 * cutoff
            } else {
                (2.0 * PI * cutoff * x).sin() / (PI * x)
            };
            let weight = sinc * blackman(x, TAPS as f64);
            sum += mono[j as usize] as f64 * weight;
            weight_sum += weight;
        }
        out.push(if weight_sum.abs() > 1e-12 {
            (sum / weight_sum) as f32
        } else {
            0.0
        });
    }
    out
}

/// FFT de radix-2 em floats, usada para estimar planitude espectral.
/// O tamanho é completado com zeros até a próxima potência de dois.
pub fn fft_magnitudes(input: &[f32]) -> Vec<f32> {
    let n = input.len().next_power_of_two().max(2);
    let mut re = vec![0.0f32; n];
    let mut im = vec![0.0f32; n];
    re[..input.len()].copy_from_slice(input);

    let mut j = 0usize;
    for i in 0..n {
        if i < j {
            re.swap(i, j);
            im.swap(i, j);
        }
        let mut m = n >> 1;
        while m > 0 && j >= m {
            j -= m;
            m >>= 1;
        }
        j += m;
    }

    let mut len = 2usize;
    while len <= n {
        let angle = -2.0 * PI / len as f64;
        let wlen = (angle.cos(), angle.sin());
        for start in (0..n).step_by(len) {
            let mut wr = 1.0f64;
            let mut wi = 0.0f64;
            for k in 0..len / 2 {
                let right = start + k + len / 2;
                let vr = re[right] as f64 * wr - im[right] as f64 * wi;
                let vi = re[right] as f64 * wi + im[right] as f64 * wr;
                let left = start + k;
                let ur = re[left] as f64;
                let ui = im[left] as f64;
                re[left] = (ur + vr) as f32;
                im[left] = (ui + vi) as f32;
                re[right] = (ur - vr) as f32;
                im[right] = (ui - vi) as f32;
                let next_wr = wr * wlen.0 - wi * wlen.1;
                wi = wr * wlen.1 + wi * wlen.0;
                wr = next_wr;
            }
        }
        len <<= 1;
    }

    re.iter()
        .zip(im.iter())
        .map(|(r, i)| ((*r as f64).powi(2) + (*i as f64).powi(2)).sqrt() as f32)
        .collect()
}

/// Normaliza o pico para evitar distorção em arquivos com ganho muito baixo.
pub fn peak_normalize(samples: &mut [f32], target_peak: f32) {
    let peak = samples.iter().fold(0.0f32, |a, &b| a.max(b.abs()));
    if peak > 1e-6 && target_peak > 0.0 {
        let gain = target_peak / peak;
        for sample in samples.iter_mut() {
            *sample *= gain;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resample_preserves_length_ratio_and_amplitude() {
        let rate_in = 48_000u32;
        let rate_out = 16_000u32;
        let input: Vec<f32> = (0..48_000)
            .map(|i| 0.5 * (2.0 * PI * 1000.0 * i as f64 / rate_in as f64).sin() as f32)
            .collect();
        let out = resample_to_mono(&input, rate_in, 1, rate_out);
        assert_eq!(out.len(), 16_000);
        let peak = out.iter().fold(0.0f32, |a, &b| a.max(b.abs()));
        assert!(peak > 0.45 && peak < 0.55, "pico inesperado: {peak}");
    }

    #[test]
    fn resample_downmixes_stereo_to_mono() {
        let input = vec![1.0f32, -1.0, 1.0, -1.0];
        let out = resample_to_mono(&input, 16_000, 2, 16_000);
        assert_eq!(out, vec![0.0, 0.0]);
    }

    #[test]
    fn fft_detects_dominant_frequency() {
        let rate = 512.0;
        let input: Vec<f32> = (0..512)
            .map(|i| (2.0 * PI * 64.0 * i as f64 / rate).sin() as f32)
            .collect();
        let mags = fft_magnitudes(&input);
        let peak = mags
            .iter()
            .enumerate()
            .max_by(|a, b| a.1.total_cmp(b.1))
            .unwrap()
            .0;
        // Para sinais reais o pico aparece em k e em N-k (espelho).
        assert!(
            (63..=65).contains(&peak) || (447..=449).contains(&peak),
            "pico espectral em {peak}"
        );
    }

    #[test]
    fn peak_normalize_respects_target() {
        let mut data = vec![0.1f32, -0.2, 0.05];
        peak_normalize(&mut data, 0.9);
        assert!((data[1].abs() - 0.9).abs() < 1e-6);
    }
}
