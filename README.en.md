# Sonyia

Local, multilingual, private transcription for audio and video.

[Português](README.md) · [English](README.en.md) · [Español](README.es.md)

1. [Name](#1-name)
2. [Description](#2-description)
3. [Goal](#3-goal)
4. [Features](#4-features)
5. [Technology stack](#5-technology-stack)
6. [Architecture](#6-architecture)
7. [Minimum requirements](#7-minimum-requirements)
8. [Run locally](#8-run-locally)
9. [Build](#9-build)
10. [Usage](#10-usage)
11. [GitHub Pages](#11-github-pages)
12. [Privacy](#12-privacy)
13. [Security](#13-security)
14. [License](#14-license)
15. [Credits](#15-credits)
16. [Known limitations](#16-known-limitations)
17. [Contributing](#17-contributing)

## 1. Name

**Sonyia** — version 1.0.0. Created and developed by Victor de Brito Brandão.

## 2. Description

Sonyia is a web application that transcribes audio and video **on the user's device**. There is no backend, API key, telemetry, tracker, or media upload: the selected file is decoded and processed in the browser, and the resulting transcript can be edited and exported locally. The interface is available in Portuguese, English, and Spanish.

## 3. Goal

Make it practical to obtain timestamped transcripts with automatic language detection without relying on external services, accounts, or exposing file contents. Privacy by design, transparent licensing, and fully local processing after the initial model download are the project's priorities.

## 4. Features

- Local media decoding with `ffmpeg.wasm`, running in a Web Worker.
- Sinc resampling to mono @16 kHz and peak normalization in Rust compiled to WebAssembly.
- Deterministic, heuristic voice activity detection (VAD): energy (dBFS), zero-crossing rate, spectral flatness, spectral flux, and local variation, with hysteresis and minimum duration.
- Transcription with Whisper ONNX (`tiny`, `base`, `small`) via `@huggingface/transformers`, with an optional language override.
- Automatic spoken-language detection with local trigrams (`franc`): the first-pass text is analyzed and, when it indicates a different language, transcription is repeated with the correct prompt. This is a deterministic heuristic, not a neural model or an accuracy guarantee.
- Speech segments carrying a heuristic VAD score (not an ASR accuracy figure).
- Continuous and segmented text, manual editing of the result, and copy to clipboard.
- Local export to TXT, SRT, VTT, JSON, and PDF.
- Light/dark theme, pt-BR/en/es languages, progress stages, and cancellation.
- No account, no server, no API keys, and no telemetry.

## 5. Technology stack

| Layer | Technology | Version / license |
| --- | --- | --- |
| UI and build | TypeScript + Vite | 5.9.3 (Apache-2.0) / 8.3.8 (MIT) |
| Local DSP | Rust + `wasm-bindgen` (`sonyia-audio-engine`) | edition 2021, GPL-3.0-or-later |
| Recognition | `@huggingface/transformers` + `onnxruntime-web` | 4.3.2 (Apache-2.0) / 1.31.1 (MIT) |
| Models | `Xenova/whisper-tiny`, `Xenova/whisper-base`, `Xenova/whisper-small` | Apache-2.0 |
| Language detection | `franc` (local trigrams) | 6.2.0 (MIT) |
| Media decoding | `@ffmpeg/ffmpeg` + `@ffmpeg/core` | 0.12.15 / 0.12.10 — GPL-2.0-or-later |
| PDF | `jspdf` | 4.2.1 (MIT) |
| Parallelism | Web Workers (decoding and transcription) | Native browser API |
| Tests | Vitest + happy-dom + Playwright | 5.1.1 / 21.0.4 / 1.65.1 |

Overall project license: **GPL-3.0-or-later**, because of `@ffmpeg/core` (GPL-2.0-or-later). Per-dependency and per-model licenses are documented in [docs/MODELS.md](docs/MODELS.md).

## 6. Architecture

```text
Media file (File)
  └─ Decoding Worker (ffmpeg.wasm) → PCM
       └─ Rust/WASM engine (src/wasm): mono 16 kHz + normalization + VAD
            └─ Transcription Worker (transformers.js + Whisper ONNX)
                 ├─ trigram language detection on text (or forced language)
                 └─ segments + text → TXT / SRT / VTT / JSON / PDF
```

The main thread only handles the interface, progress, and editing. Heavy processing runs in Workers; no media data is sent over the network. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for details.

## 7. Minimum requirements

- Node.js **>= 20.19** and npm (declared in `package.json`).
- A browser with WebAssembly, Web Workers, ES modules, and modern `File`/`Blob` support.
- Internet access on the **first run**, to download the runtime and chosen model from Hugging Face. Afterwards, processing can work offline while the browser cache is available.
- Memory and disk space appropriate for the chosen model (see [docs/MODELS.md](docs/MODELS.md)).
- Optional, only to rebuild the audio engine: Rust stable, the `wasm32-unknown-unknown` target, and `wasm-pack`.

Chrome, Edge, Firefox, and Safari are the target browsers for testing. Actual compatibility and per-browser results are recorded in the validation report; we do not claim universal support without tests.

## 8. Run locally

```bash
npm install
npm run assets          # copies static artifacts (also runs via predev/prebuild)
npm run build:wasm      # optional: rebuild Rust → WASM (requires wasm-pack)
npm run dev
```

The WASM binary already checked in under `src/wasm/` allows development without `wasm-pack`. Use `npm run build:wasm` only if you change `rust/audio-engine`.

## 9. Build

```bash
npm run build           # tsc --noEmit && vite build
npm run preview         # serves dist/ locally
```

The result is a static site in `dist/`. To regenerate the audio engine from Rust:

```bash
npm run build:wasm      # requires wasm-pack and the wasm32-unknown-unknown target
```

## 10. Usage

1. Open the app and select or drag an audio/video file.
2. Choose a model: `tiny` (lightweight), `base` (balanced), or `small` (more resources and time).
3. Adjust VAD sensitivity and, if desired, force a language; by default it is detected automatically. Text is **not translated**.
4. Click **Transcribe** and follow the stages; you can cancel at any time.
5. Review and edit the text, then export it as TXT, SRT, VTT, JSON, or PDF.

On the first transcription, the model is downloaded from Hugging Face and stored in the browser cache. **Estimated** download sizes: tiny ~40 MB, base ~145 MB, small ~500 MB. The app does not display invented accuracy percentages; always review the result.

## 11. GitHub Pages

The build is static. The workflow `.github/workflows/deploy-pages.yml` builds the WASM engine, compiles the site, and publishes `dist/` on every push to `main` (or when triggered manually). Enable **Settings → Pages → Source: GitHub Actions** in the repository. Vite uses `base: './'`, so the site works from a subpath without configuration changes. No server, database, or environment variables are required. Headers and WASM behavior depend on the hosting platform: validate in the browser and record the outcome in the validation report.

For **Vercel**, import this repository with the settings from `vercel.json`: `npm ci` to install, `npm run build` to compile, and `dist` as the output directory. The generated Rust/WASM engine is committed, so Vercel does not need to install Rust. The large ffmpeg and ONNX Runtime files are copied from `node_modules` automatically by `prebuild`.

## 12. Privacy

No media file or transcript leaves the device. The only external traffic is the initial download of the runtime and models (plus the site itself when hosted on the web). Theme and language preferences are the only local persistence of user data; media and transcripts live in memory and are discarded when the tab is closed. Cached downloaded artifacts remain in the browser until manually cleared. See [docs/PRIVACY.md](docs/PRIVACY.md).

## 13. Security

The project adopts a restrictive CSP, text sanitization in the UI, file validation by type and size, memory limits, isolation in Workers, and explicit revocation of `URL.createObjectURL`. Residual risks remain: the model comes from an external CDN on first run, third-party dependencies are involved, and browser caches exist. **We do not claim zero risk.** Report vulnerabilities as described in [SECURITY.md](SECURITY.md) and [docs/SECURITY.md](docs/SECURITY.md).

## 14. License

Sonyia is distributed under **GPL-3.0-or-later**, because of `@ffmpeg/core` (GPL-2.0-or-later). The Whisper models from Hugging Face are Apache-2.0; other components use the permissive licenses listed in the technology table. The `LICENSE` file ships with the repository.

## 15. Credits

Created and developed by **Victor de Brito Brandão**. Thanks to the communities behind Rust/WASM, Hugging Face, FFmpeg, ONNX Runtime, Vite, and jsPDF. Model and dependency terms are tracked in [docs/MODELS.md](docs/MODELS.md).

## 16. Known limitations

- VAD is **heuristic and deterministic**, not a neural classifier; higher sensitivity may include noise.
- Music with vocals, singing, and overlapping speech can cause errors or omitted passages.
- Whisper may hallucinate text during long silences; VAD mitigates but does not eliminate this risk.
- Safari/iOS may have limitations with `ffmpeg.wasm` (memory, decoding, threads).
- Supported formats are only declared after testing; unvalidated formats should be treated as experimental.
- There is no diarization (speaker identification) and no translation.
- PDFs use default fonts; typographic fidelity across platforms is not guaranteed.
- No percentage accuracy metric is provided: the displayed score is only the heuristic VAD confidence.

## 17. Contributing

Contributions are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) and [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) for code standards, `feat`/`fix`/`docs`/`test` commit style, and semantic versioning. Before opening a PR:

```bash
npx playwright install chromium
npm run test:unit
npm run test:all
```
