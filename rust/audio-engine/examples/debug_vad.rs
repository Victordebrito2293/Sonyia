use sonyia_audio_engine::*;
use std::fs;

fn read_wav(path: &str) -> Vec<f32> {
    let bytes = fs::read(path).unwrap();
    let mut pos = 12usize;
    let mut pcm = Vec::new();
    while pos + 8 <= bytes.len() {
        let id = &bytes[pos..pos + 4];
        let size = u32::from_le_bytes(bytes[pos + 4..pos + 8].try_into().unwrap()) as usize;
        pos += 8;
        if id == b"data" {
            for chunk in bytes[pos..pos + size].chunks_exact(2) {
                pcm.push(i16::from_le_bytes([chunk[0], chunk[1]]) as f32 / 32768.0);
            }
            break;
        }
        pos += size + (size % 2);
    }
    pcm
}

fn main() {
    for name in ["1272-128104-0000", "instrumental-tone", "silence"] {
        let samples = read_wav(&format!("tests/fixtures/{name}.wav"));
        let f = features(&samples, 16_000, 0.5);
        let mut flat: Vec<f32> = f.iter().skip(2).step_by(5).copied().collect();
        flat.sort_by(|a, b| a.total_cmp(b));
        let q = |p: f32| flat[(p * (flat.len() - 1) as f32) as usize];
        let scores: Vec<f32> = f.iter().skip(4).step_by(5).copied().collect();
        println!("== {name} == dur {:.2}s segments {:?}", samples.len() as f32 / 16000.0, speech_segments(&samples, 16_000, 0.5));
        println!("flat q10 {:.4} q50 {:.4} q90 {:.4}; score max {:.3} mean {:.3}", q(0.1), q(0.5), q(0.9), scores.iter().cloned().fold(0.0f32, f32::max), scores.iter().sum::<f32>() / scores.len() as f32);
        for i in [0usize, 5, 15, 30, 50, 80] {
            if i * 5 + 4 < f.len() {
                println!("  frame {i:3}: rms {:7.2} zcr {:.3} flat {:.4} flux {:.3} score {:.3}", f[i*5], f[i*5+1], f[i*5+2], f[i*5+3], f[i*5+4]);
            }
        }
    }
}
