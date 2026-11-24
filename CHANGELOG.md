# Changelog

Todas as mudanças relevantes deste projeto são documentadas aqui. O formato segue Keep a Changelog e o versionamento segue Semantic Versioning.

## [1.0.0] - 2026-11-24

Primeira versão do Sonyia: transcrição local de áudio e vídeo no navegador, sem backend, API key, telemetria ou upload de mídia.

### Added

- Interface em português, inglês e espanhol, com tema claro/escuro e estágios de progresso.
- Seleção e validação local de arquivos de mídia, com decodificação via `ffmpeg.wasm` em Web Worker.
- Motor de áudio em Rust/WASM (`sonyia-audio-engine`): reamostragem sinc para mono @16 kHz, normalização de pico, recorte de amostras e extração de features.
- VAD determinístico e heurístico com janelas de 20 ms, energia, ZCR, planitude espectral, fluxo espectral, histerese e segmentação.
- Transcrição local com Whisper ONNX (`tiny`, `base`, `small`) via `@huggingface/transformers`, com opção de idioma forçado.
- Detecção automática de idioma por trigramas locais (`franc`, MIT): a primeira passada é analisada e, se indicar outro idioma, a transcrição é repetida com o prompt correto. Heurística determinística, sem alegação de precisão.
- Segmentos de fala com pontuação heurística do VAD, texto contínuo e segmentado, edição e cópia do resultado.
- Exportação local em TXT, SRT, VTT, JSON e PDF (`jsPDF`).
- Modelos públicos `Xenova/whisper-tiny`, `Xenova/whisper-base` e `Xenova/whisper-small` (Apache-2.0), baixados na primeira execução e mantidos no cache do navegador.
- Documentação: READMEs em três idiomas, arquitetura, privacidade, segurança, modelos e contribuição.
- CI com matriz Node 20.x/22.x/24.x, testes do crate Rust e testes end-to-end com Playwright.
- Workflow de deploy contínuo para GitHub Pages (`deploy-pages.yml`).
- Templates de issue (bug report e feature request) e de pull request.

### Changed

- Nenhuma mudança compatível em relação a uma versão anterior: esta é a primeira versão publicada.
- Licença geral definida como GPL-3.0-or-later por causa do `@ffmpeg/core` (GPL-2.0-or-later).

### Fixed

- Nenhuma correção de regressão: esta é a primeira versão publicada.

### Security

- Nenhum backend, credencial embutida, chave de API, telemetria ou upload de mídia/transcrição.
- Política de segurança e privacidade documentada, incluindo CSP, sanitização, validação de arquivos, limites, uso de Workers e liberação de URLs.
- Riscos residuais declarados: download de modelo/runtime via CDN externa na primeira execução, dependências de terceiros e caches do navegador. Não há afirmação de risco zero.
