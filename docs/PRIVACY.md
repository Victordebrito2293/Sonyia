# Privacidade do Sonyia

## Resumo

O Sonyia processa mídia e transcrições **no dispositivo do usuário**. Não há backend próprio, conta, API key, telemetria, rastreadores, analytics nem upload de arquivos. O conteúdo selecionado nunca é enviado para um servidor do projeto ou de terceiros.

## Fluxo de dados

```text
Arquivo local (File)
  → leitura no navegador
  → Worker de decodificação (ffmpeg.wasm)
  → motor Rust/WASM (mono 16 kHz, normalização, VAD)
  → Worker de transcrição (Whisper ONNX local)
  → texto em memória → edição → exportação (download local)
```

Nenhuma seta desse fluxo aponta para a rede. A única exceção é o carregamento de artefatos públicos necessários para executar a aplicação.

## O que sai do dispositivo

- **Na primeira execução:** download do site (quando hospedado na web), do runtime de inferência e do modelo Whisper escolhido a partir de CDNs públicas (Hugging Face e hosts de assets usados pelas dependências). Esses downloads são de arquivos públicos e **não contêm** o arquivo do usuário nem a transcrição.
- **Durante o processamento:** nada. Não há requisição com áudio, vídeo, texto, nome de arquivo, configurações ou identificadores do dispositivo.
- **Após o processamento:** nada. Exportações geram downloads locais.

## O que nunca sai do dispositivo

- Arquivos de áudio ou vídeo selecionados e seus bytes decodificados.
- Transcrições, segmentos, marcas de tempo e texto editado.
- Nome do arquivo, metadados de mídia e configurações de processamento.
- Tema e idioma da interface.

## Persistência local

| Dado | Onde fica | Duração |
| --- | --- | --- |
| Mídia e PCM em memória | Memória da aba do navegador | Descartados ao fechar a aba, ao limpar o resultado ou ao cancelar/finalizar o job. |
| Transcrição e texto editado | Memória da aba | Descartados ao fechar a aba. |
| Tema e idioma da interface | Armazenamento local do navegador (`localStorage`) | Permanecem até o usuário alterar a preferência ou limpar os dados do site. É a única persistência de dados do usuário. |
| Runtime e modelos baixados | Cache do navegador | Permanecem até limpeza manual dos dados do site; são artefatos públicos, não dados do usuário. |

Fechar a aba encerra o processamento e libera os dados em memória. Os Workers são terminados/cancelados quando o job é cancelado ou a aplicação é descarregada. URLs temporárias criadas para download são revogadas após o uso.

## Terceiros e transparência

- Modelos: repositórios públicos `Xenova/whisper-tiny`, `Xenova/whisper-base` e `Xenova/whisper-small` (Apache-2.0). Veja [MODELS.md](MODELS.md).
- Decodificação: `@ffmpeg/ffmpeg` / `@ffmpeg/core` (GPL-2.0-or-later), executados localmente.
- Inferência: `@huggingface/transformers` (Apache-2.0) e `onnxruntime-web` (MIT).
- Detecção de idioma: `franc` (MIT), executada localmente sobre o texto já transcrito.

A dependência de CDNs externas para o download inicial é um risco de disponibilidade e de cadeia de suprimentos, discutido em [SECURITY.md](SECURITY.md). Isso não implica envio de dados do usuário: o navegador busca arquivos públicos, não envia mídia.

## Controle do usuário

- Usar o aplicativo em modo offline após o primeiro download, enquanto o cache existir.
- Limpar os dados do site nas configurações do navegador para remover temas, idioma e cache de modelos.
- Verificar a origem dos arquivos baixados e as licenças em [MODELS.md](MODELS.md).
- Evitar o uso em dispositivos compartilhados se não desejar que preferências de tema/idioma permaneçam no navegador.

## Escopo

Esta política cobre o Sonyia em sua configuração padrão, sem backend. Forks que adicionarem serviços próprios, telemetria ou hospedagem de modelos precisam revisar e atualizar este documento.
