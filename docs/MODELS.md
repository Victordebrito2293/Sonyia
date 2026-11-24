# Modelos do Sonyia

## Origem

O Sonyia usa conversões ONNX públicas dos modelos Whisper mantidas por **Xenova** na Hugging Face, executadas localmente no navegador por `@huggingface/transformers` 4.3.2 sobre `onnxruntime-web` 1.31.1. A detecção do idioma falado é automática por padrão; também é possível forçar um idioma. **O texto não é traduzido** e a interface independe do idioma reconhecido.

**Limitação real:** `@huggingface/transformers` 4.3.2 ainda não implementa a detecção de idioma do Whisper (sem prompt ele assume inglês). O Sonyia faz uma primeira transcrição, analisa o texto com `franc` (trigramas locais, MIT) e, se a heurística indicar outro idioma, repete a transcrição com o prompt correspondente. Trata-se de uma heurística determinística — sem modelo neural de identificação de idioma e sem percentual de precisão garantido.

**Não há API key, token da Hugging Face, conta ou assinatura.** Os repositórios são públicos. Na primeira transcrição, o arquivo do modelo é baixado da Hugging Face (e de seus hosts de CDN de assets) e armazenado no cache do navegador; nas execuções seguintes, enquanto o cache existir, o processamento pode funcionar sem conexão.

## Modelos disponíveis

| Modelo | Repositório HF | Licença | Download estimado | RAM estimada | Quando usar |
| --- | --- | --- | --- | --- | --- |
| `tiny` | [Xenova/whisper-tiny](https://huggingface.co/Xenova/whisper-tiny) | Apache-2.0 | ~40 MB | ~0,5–1 GB | Testes rápidos, dispositivos com pouca memória, arquivos curtos. |
| `base` | [Xenova/whisper-base](https://huggingface.co/Xenova/whisper-base) | Apache-2.0 | ~145 MB | ~1–2 GB | Uso geral; recomendado para a maioria dos arquivos. |
| `small` | [Xenova/whisper-small](https://huggingface.co/Xenova/whisper-small) | Apache-2.0 | ~500 MB | ~2–4 GB | Quando se deseja maior qualidade e há CPU, memória e tempo disponíveis. |

Os valores de download e RAM são **estimativas** (quantização, runtime, navegador e tamanho do áudio influenciam o consumo real). Para conferir os arquivos publicados e seus tamanhos atuais, consulte a página do repositório no Hugging Face ou a API pública do Hugging Face.

## Licenças e atribuição

- Modelos: Apache-2.0, conforme os repositórios `Xenova/whisper-*` indicados acima.
- `@huggingface/transformers`: Apache-2.0; `onnxruntime-web`: MIT; `franc` 6.2.0: MIT.
- `@ffmpeg/ffmpeg` 0.12.15 e `@ffmpeg/core` 0.12.10: GPL-2.0-or-later. Por isso, a licença geral do Sonyia é **GPL-3.0-or-later**.
- `jspdf` 4.2.1 e Vite: MIT; TypeScript: Apache-2.0.
- O texto do projeto e dos créditos deve permanecer preciso; forks podem alterar créditos desde que respeitem as licenças aplicáveis.

## Cache e atualização

Os artefatos baixados ficam no cache do navegador (mecanismo usado pela biblioteca de inferência), não em um servidor controlado pelo projeto. Limpar os dados do site no navegador remove esse cache e fará com que o modelo seja baixado novamente na próxima execução. Não existe canal de atualização automática de modelos no Sonyia: mudanças de versão ou repositório são feitas no código e documentadas no [CHANGELOG.md](../CHANGELOG.md).

## Seleção no uso

No painel de configurações, `tiny` aparece como *leve*, `base` como *equilibrado* e `small` como opção com maior consumo de recursos. A escolha afeta apenas o reconhecimento: a sensibilidade do VAD e o idioma são independentes do modelo selecionado. Nenhuma opção fornece percentual de precisão garantido — revise sempre o texto resultante.
