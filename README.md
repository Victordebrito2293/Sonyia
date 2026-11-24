# Sonyia

Transcrição local, multilíngue e privada de áudio e vídeo.

[Português](README.md) · [English](README.en.md) · [Español](README.es.md)

1. [Nome](#1-nome)
2. [Descrição](#2-descrição)
3. [Objetivo](#3-objetivo)
4. [Funcionalidades](#4-funcionalidades)
5. [Tecnologias](#5-tecnologias)
6. [Arquitetura](#6-arquitetura)
7. [Requisitos mínimos](#7-requisitos-mínimos)
8. [Execução local](#8-execução-local)
9. [Compilação](#9-compilação)
10. [Uso](#10-uso)
11. [GitHub Pages](#11-github-pages)
12. [Privacidade](#12-privacidade)
13. [Segurança](#13-segurança)
14. [Licença](#14-licença)
15. [Créditos](#15-créditos)
16. [Limitações conhecidas](#16-limitações-conhecidas)
17. [Contribuição](#17-contribuição)

## 1. Nome

**Sonyia** — versão 1.0.0. Criado e desenvolvido por Victor de Brito Brandão.

## 2. Descrição

Sonyia é uma aplicação web que transcreve áudio e vídeo **no dispositivo do usuário**. Não há backend, API key, telemetria, rastreadores nem upload de mídia: o arquivo selecionado é decodificado e processado no navegador, e a transcrição resultante pode ser editada e exportada localmente. A interface está disponível em português, inglês e espanhol.

## 3. Objetivo

Oferecer uma forma prática de obter transcrições com marcas de tempo e detecção automática de idioma sem depender de serviços externos, sem cadastro e sem expor o conteúdo dos arquivos. O projeto prioriza privacidade por projeto, transparência de licenças e execução integralmente local após o download inicial dos modelos.

## 4. Funcionalidades

- Decodificação local de arquivos de mídia com `ffmpeg.wasm`, em Web Worker.
- Reamostragem sinc para mono @16 kHz e normalização de pico em Rust compilado para WebAssembly.
- Detecção de atividade de voz (VAD) heurística e determinística: energia (dBFS), taxa de cruzamento por zero, planitude espectral, fluxo espectral e variação local, com histerese e duração mínima.
- Transcrição com Whisper ONNX (`tiny`, `base` e `small`) via `@huggingface/transformers`, com opção de forçar um idioma.
- Detecção automática do idioma falado por trigramas locais (`franc`): o texto da primeira passada é analisado e, se indicar outro idioma, a transcrição é repetida com o prompt correto. É uma heurística determinística, não um modelo neural nem uma garantia de precisão.
- Segmentos de fala com pontuação heurística do VAD (não é precisão do modelo de reconhecimento).
- Texto contínuo e segmentado, edição manual do resultado e cópia para a área de transferência.
- Exportação local em TXT, SRT, VTT, JSON e PDF.
- Interface com tema claro/escuro, idiomas pt-BR/en/es, estágios de progresso e cancelamento.
- Sem conta, sem servidor, sem chaves de API e sem telemetria.

## 5. Tecnologias

| Camada | Tecnologia | Versão / licença |
| --- | --- | --- |
| Interface e build | TypeScript + Vite | 5.9.3 (Apache-2.0) / 8.3.8 (MIT) |
| DSP local | Rust + `wasm-bindgen` (`sonyia-audio-engine`) | edição 2021, GPL-3.0-or-later |
| Reconhecimento | `@huggingface/transformers` + `onnxruntime-web` | 4.3.2 (Apache-2.0) / 1.31.1 (MIT) |
| Modelos | `Xenova/whisper-tiny`, `Xenova/whisper-base`, `Xenova/whisper-small` | Apache-2.0 |
| Detecção de idioma | `franc` (trigramas locais) | 6.2.0 (MIT) |
| Decodificação de mídia | `@ffmpeg/ffmpeg` + `@ffmpeg/core` | 0.12.15 / 0.12.10 — GPL-2.0-or-later |
| PDF | `jspdf` | 4.2.1 (MIT) |
| Paralelismo | Web Workers (decodificação e transcrição) | API nativa do navegador |
| Testes | Vitest + happy-dom + Playwright | 5.1.1 / 21.0.4 / 1.65.1 |

Licença geral do projeto: **GPL-3.0-or-later**, em razão do `@ffmpeg/core` (GPL-2.0-or-later). As licenças de cada dependência e dos modelos estão documentadas em [docs/MODELS.md](docs/MODELS.md).

## 6. Arquitetura

```text
Arquivo de mídia (File)
  └─ Worker de decodificação (ffmpeg.wasm) → PCM
       └─ Motor Rust/WASM (src/wasm): mono 16 kHz + normalização + VAD
            └─ Worker de transcrição (transformers.js + Whisper ONNX)
                 ├─ detecção de idioma por trigramas no texto (ou idioma forçado)
                 └─ segmentos + texto → TXT / SRT / VTT / JSON / PDF
```

A thread principal cuida apenas da interface, do progresso e da edição. Todo processamento pesado acontece em Workers; nenhum dado de mídia é enviado pela rede. Detalhes em [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## 7. Requisitos mínimos

- Node.js **>= 20.19** e npm (declarado em `package.json`).
- Navegador com WebAssembly, Web Workers, ES modules e `File`/`Blob` modernos.
- Conexão com a internet na **primeira execução**, para baixar o runtime e o modelo escolhido da Hugging Face. Depois disso, desde que o cache do navegador exista, o processamento pode funcionar offline.
- Memória e espaço em disco compatíveis com o modelo escolhido (ver [docs/MODELS.md](docs/MODELS.md)).
- Opcional, apenas para recompilar o motor de áudio: Rust stable, alvo `wasm32-unknown-unknown` e `wasm-pack`.

Chrome, Edge, Firefox e Safari são os navegadores-alvo dos testes. A compatibilidade efetiva e os resultados por navegador ficam registrados no relatório de validação; não declaramos compatibilidade universal sem testes.

## 8. Execução local

```bash
npm install
npm run assets          # copia artefatos estáticos (também roda via predev/prebuild)
npm run build:wasm      # opcional: recompila Rust → WASM (requer wasm-pack)
npm run dev
```

O binário WASM já versionado em `src/wasm/` permite desenvolver sem `wasm-pack`. Use `npm run build:wasm` somente se alterar `rust/audio-engine`.

## 9. Compilação

```bash
npm run build           # tsc --noEmit && vite build
npm run preview         # serve o conteúdo de dist/ localmente
```

O resultado é um site estático em `dist/`. Para gerar novamente o motor de áudio a partir do Rust:

```bash
npm run build:wasm      # requer wasm-pack e o alvo wasm32-unknown-unknown
```

## 10. Uso

1. Abra a aplicação e selecione ou arraste um arquivo de áudio/vídeo.
2. Escolha o modelo: `tiny` (leve), `base` (equilibrado) ou `small` (mais recurso e tempo).
3. Ajuste a sensibilidade do VAD e, se desejar, force o idioma; por padrão ele é detectado automaticamente. O texto **não é traduzido**.
4. Clique em **Transcrever** e acompanhe os estágios; é possível cancelar.
5. Revise e edite o texto, depois exporte em TXT, SRT, VTT, JSON ou PDF.

Na primeira transcrição, o modelo é baixado da Hugging Face e armazenado no cache do navegador. Tamanhos **estimados** de download: tiny ~40 MB, base ~145 MB, small ~500 MB. A aplicação não mostra porcentagens de precisão inventadas; revise sempre o resultado.

## 11. GitHub Pages

O build é estático. O workflow `.github/workflows/deploy-pages.yml` gera o WASM, compila o site e publica `dist/` quando `main` recebe um push (ou quando disparado manualmente). Ative **Settings → Pages → Source: GitHub Actions** no repositório. O Vite usa `base: './'`, então o site funciona em um sub caminho sem alterar configuração. Não é necessário servidor, banco de dados ou variáveis de ambiente. Cabeçalhos e comportamento de WASM dependem da plataforma de hospedagem: valide o resultado no navegador e registre-o no relatório de validação.

## 12. Privacidade

Nenhum arquivo de mídia ou transcrição sai do dispositivo. O único tráfego externo é o download inicial do runtime e dos modelos (e do próprio site, quando hospedado na web). A preferência de tema e idioma é a única persistência local de dados do usuário; mídia e transcrição vivem em memória e são descartadas ao fechar a aba. O cache dos artefatos baixados permanece no navegador até limpeza manual. Ver [docs/PRIVACY.md](docs/PRIVACY.md).

## 13. Segurança

O projeto adota CSP restritiva, sanitização de texto na interface, validação de arquivo por tipo/tamanho, limites de memória, isolamento em Workers e liberação explícita de `URL.createObjectURL`. Ainda assim existem riscos residuais: o modelo vem de uma CDN externa na primeira execução, há dependências de terceiros e caches do navegador. **Não afirmamos risco zero.** Relate vulnerabilidades conforme [SECURITY.md](SECURITY.md) e [docs/SECURITY.md](docs/SECURITY.md).

## 14. Licença

Sonyia é distribuído sob **GPL-3.0-or-later**, em razão do `@ffmpeg/core` (GPL-2.0-or-later). Os modelos Whisper da Hugging Face são Apache-2.0; demais componentes têm licenças permissivas indicadas na tabela de tecnologias. O arquivo `LICENSE` acompanha o repositório.

## 15. Créditos

Criado e desenvolvido por **Victor de Brito Brandão**. Agradecimentos às comunidades por trás de Rust/WASM, Hugging Face, FFmpeg, ONNX Runtime, Vite e jsPDF. Os termos dos modelos e dependências são mantidos em [docs/MODELS.md](docs/MODELS.md).

## 16. Limitações conhecidas

- O VAD é **heurístico e determinístico**, não um classificador neural; sensibilidade alta pode incluir ruído.
- Música com vocais, voz cantada e falas sobrepostas podem gerar erros ou omitir trechos.
- Whisper pode alucinar texto em silêncio prolongado; o VAD mitiga, mas não elimina, esse risco.
- Safari/iOS podem apresentar limitações com `ffmpeg.wasm` (memória, decodificação, threads).
- A lista de formatos suportados só é declarada após testes; formatos não validados devem ser tratados como experimentais.
- Não há diarização (identificação de falantes) nem tradução.
- O PDF usa fontes padrão; não há garantia de fidelidade tipográfica entre plataformas.
- Não há métrica de precisão percentual: a pontuação exibida é apenas a confiança heurística do VAD.

## 17. Contribuição

Contribuições são bem-vindas. Leia [CONTRIBUTING.md](CONTRIBUTING.md) e [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) para padrões de código, mensagens `feat`/`fix`/`docs`/`test` e versionamento semântico. Antes de abrir um PR:

```bash
npx playwright install chromium
npm run test:unit
npm run test:all
```
