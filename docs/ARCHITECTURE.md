# Arquitetura do Sonyia

Este documento descreve o desenho do sistema. O motor de áudio em Rust/WASM (`rust/audio-engine`, artefatos em `src/wasm/`) e os tipos compartilhados (`src/core/types.ts`) já estão presentes no repositório; as camadas de interface, decodificação e transcrição seguem os contratos definidos aqui.

## Visão geral

```mermaid
flowchart TD
    A[Arquivo selecionado · File] --> B[Main thread · UI, progresso, edição]
    B -->|DecoderRequest: decode / cancel| C[Worker de decodificação · ffmpeg.wasm]
    C -->|DecoderResponse: progress / result / error| B
    C --> D[PCM intercalado]
    D --> E[Motor Rust → WASM · src/wasm]
    E --> E1[Reamostragem sinc → mono 16 kHz]
    E --> E2[Normalização de pico]
    E --> E3[VAD determinístico · janelas de 20 ms]
    E1 --> F[Worker de transcrição]
    E2 --> F
    E3 --> F
    B -->|TranscriptionRequest: transcribe / cancel| F
    F --> G[@huggingface/transformers · Whisper ONNX]
    G -->|detecção de idioma + segmentos| H[TranscriptResult]
    F -->|TranscriptionResponse: progress / result / error| B
    H --> I[Exportação local · TXT / SRT / VTT / JSON / PDF]
```

Não existe backend, endpoint próprio, chave de API nem telemetria. A única comunicação externa é o download de artefatos públicos (runtime e modelos) na primeira execução.

## Componentes

### 1. Main thread (interface)

Responsável por: seleção/validação do arquivo, tema e idioma da interface, exibição de estágios, edição do texto, cancelamento e exportação. O texto da transcrição é tratado sempre como dado textual (nunca como HTML). A preferência de tema/idioma é a única persistência local de dados do usuário.

### 2. Worker de decodificação

Recebe `DecoderRequest` (`decode` ou `cancel`) e responde com `DecoderResponse` (`progress`, `result`, `error`). Converte formatos de mídia suportados em PCM usando `ffmpeg.wasm` e reporta amostragem, canais e duração quando o decodificador consegue medi-los. O processamento de formatos fica isolado do DOM e da thread principal.

### 3. Motor de áudio (Rust → WebAssembly)

Crate `sonyia-audio-engine` (GPL-3.0-or-later), compilada com `wasm-bindgen` para `src/wasm/`. A biblioteca é determinística: não faz I/O de rede, filesystem, randomização ou leitura de relógio.

Funções exportadas:

| Função | Finalidade |
| --- | --- |
| `resample_mono_16k(input, source_rate, channels)` | Converte áudio intercalado em mono @16 kHz (taxa nativa do Whisper), com kernel sinc janelado por Blackman e 24 taps por lado. |
| `normalize(samples, target_peak)` | Ajusta o pico sem alterar a forma de onda relativa. |
| `features(samples, sample_rate, sensitivity)` | Features achatadas por janela: `[rms_db, zcr, flatness, flux, score, ...]`. |
| `speech_segments(samples, sample_rate, sensitivity)` | Segmentos achatados: `[start, end, confidence, ...]` em segundos. |
| `slice(samples, start, end)` | Recorte limitado aos limites do buffer. |
| `version()` | Versão do crate (1.0.0). |

### 4. VAD heurístico

As janelas têm 20 ms. Para cada uma são calculadas energia em dBFS, taxa de cruzamento por zero (ZCR), planitude espectral (via FFT radix-2 de 512 pontos), fluxo espectral e variação local de energia/ZCR. A pontuação resultante passa por:

- suavização por mediana de 3 quadros;
- limiares com histerese: `enter = 0.60 - 0.20 * sensitivity`, `exit = enter - 0.18`;
- fala mínima de 0,12 s, silêncio mínimo de 0,32 s e padding de 0,16 s;
- mesclagem de segmentos próximos e limitação das fronteiras à duração do áudio.

`confidence` é a média das pontuações dos quadros ativos e **não** é probabilidade de acerto da transcrição. O VAD não é um modelo neural.

### 5. Worker de transcrição e modelos

Recebe `TranscriptionRequest` (`transcribe`/`cancel`) com PCM e `JobOptions` (modelo, sensibilidade do VAD, idioma forçado opcional, marcas de tempo). Usa `@huggingface/transformers` 4.3.2 com modelos Whisper ONNX públicos. Como essa versão da biblioteca não detecta idioma sozinha, a primeira passada é analisada localmente com `franc` e, quando outro idioma é indicado, a transcrição é repetida com o prompt correto; o texto não é traduzido. Os modelos são baixados do Hugging Face no primeiro uso e ficam no cache do navegador. Detalhes em [MODELS.md](MODELS.md).

### 6. Contratos de dados

`src/core/types.ts` define a fonte de verdade dos contratos: `JobOptions`, `ProgressUpdate`, `PipelineStage`, `SpeechSegment`, `TranscriptSegment`, `TranscriptResult`, `MediaInfo`, mensagens dos workers e `ExportFormat` (`txt | srt | vtt | json | pdf`). `PipelineStage` cobre `idle`, `loading-file`, `analyzing`, `decoding`, `detecting-speech`, `detecting-language`, `transcribing`, `formatting`, `done`, `error` e `cancelled`.

### 7. Exportação

TXT, SRT, VTT, JSON e PDF são gerados no cliente a partir do `TranscriptResult` e do texto editado. O PDF é produzido com `jsPDF` 4.2.1 e fontes padrão. Nomes de arquivo derivados da mídia devem ser higienizados antes do download.

## Limites de confiança

- Arquivos do usuário e texto transcrito são **dados não confiáveis**: validar tipo/tamanho, usar `textContent`, escapar caracteres de controle em legendas e nunca interpretar conteúdo como código.
- O código WASM é local e determinístico; o navegador define os limites de memória e de capacidades.
- CDN de modelos e dependências de terceiros são externas ao limite de confiança: ver [SECURITY.md](SECURITY.md).
- Nenhuma etapa do pipeline envia mídia ou transcrição para fora do dispositivo: ver [PRIVACY.md](PRIVACY.md).

## Build e artefatos

| Comando | Resultado |
| --- | --- |
| `npm run assets` | Copia arquivos estáticos para o build (`predev`/`prebuild` já o executam). |
| `npm run build:wasm` | Gera `src/wasm/` a partir de `rust/audio-engine` (requer `wasm-pack`). |
| `npm run build` | `tsc --noEmit` + `vite build` → `dist/`. |
| `npm run test:unit` / `npm run test:e2e` | Testes Vitest e Playwright. |
| `cargo test --manifest-path rust/audio-engine/Cargo.toml` | Testes do motor DSP/VAD. |

## Extensões futuras (fora do escopo 1.0.0)

Diarização, tradução e precisão percentual não fazem parte deste release. Mudanças nessa direção exigem novo desenho de contratos, documentação e testes.
