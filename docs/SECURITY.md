# Segurança do Sonyia

## Modelo de ameaças

O Sonyia é uma aplicação estática, sem backend, que recebe arquivos de mídia do próprio usuário e executa código WebAssembly, decodificação e inferência no navegador. As principais superfícies são:

1. arquivos de mídia potencialmente corrompidos ou malformados;
2. texto transcrito e nomes de arquivos usados na interface e em exports;
3. dependências de terceiros (ffmpeg.wasm, transformers.js, ONNX Runtime, franc, jsPDF);
4. artefatos obtidos de CDNs na primeira execução;
5. cache do navegador e limites de memória/armazenamento.

O objetivo é manter o processamento no dispositivo e impedir que dados não confiáveis virem código executável. **Não afirmamos risco zero.**

## Controles adotados

### Política de Content Security Policy (CSP)

Recomenda-se CSP restritiva no documento HTML, sem `unsafe-inline` para scripts e sem `eval`. Um ponto de partida típico (ajustar às origens reais de deploy e às necessidades do runtime):

```http
Content-Security-Policy: default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self' blob:; style-src 'self'; img-src 'self' data: blob:; connect-src 'self' https://huggingface.co https://cdn-lfs.huggingface.co https://cdn-lfs-us-1.huggingface.co; media-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'none'; frame-ancestors 'none'
```

Notas:

- `'wasm-unsafe-eval'` é necessário para compilar WebAssembly; não substitua por `unsafe-eval` irrestrito.
- `blob:` em `worker-src`/`media-src` é necessário para Workers e URLs temporárias de mídia.
- A lista de `connect-src` deve refletir exatamente os hosts usados pelo runtime de modelos e pela hospedagem. Em GitHub Pages não é possível definir cabeçalhos customizados; use a metatag CSP quando aplicável, reconhecendo que algumas diretivas só funcionam como cabeçalho HTTP, e valide o resultado no navegador.
- Se alguma configuração futura exigir WASM multithread, serão necessários cabeçalhos de isolamento de origem (`Cross-Origin-Opener-Policy` e `Cross-Origin-Embedder-Policy`); isso deve ser avaliado por plataforma de hospedagem.

### Sanitização de texto e saída

- Transcrições, nomes de arquivos, idioma detectado e mensagens de erro são tratados como **texto**: renderizar com `textContent`, nunca com `innerHTML`.
- Gerar SRT/VTT/TXT/JSON escapando caracteres de controle e delimitadores que possam quebrar o formato; não interpretar marcações da transcrição como HTML.
- Nomes de arquivos exportados devem ser higienizados (remover separadores de caminho e caracteres especiais) para evitar confusão de destino no download.
- PDF gerado via `jsPDF` com chamadas de texto; fontes padrão, sem inclusion remota.

### Validação de arquivos

- Rejeitar arquivos vazios, com nome inválido ou cuja extensão/MIME não esteja na lista declarada de formatos testados.
- A lista de formatos só é divulgada após ensaios no navegador; formatos não testados são experimentais e devem falhar com mensagem clara, não com execução silenciosa.
- Validar a estrutura básica quando aplicável (por exemplo, cabeçalho WAV PCM) antes de alimentar o decodificador.
- Erros de leitura, decodificação, ausência de faixa de áudio e falha de memória são reportados ao usuário sem expor detalhes internos ou caminhos locais.

### Limites

- Limite de tamanho do arquivo de entrada e limite de amostras PCM/duração processável, ajustados à memória disponível.
- Limites para quantidade de segmentos e tamanho do texto exibido/exportado.
- Verificação de cota de armazenamento antes de baixar modelos, com mensagem de erro específica.
- Cancelamento encerra Workers e libera buffers; operações longas não devem acumular jobs.

### Web Workers

- Decodificação (`ffmpeg.wasm`) e transcrição (transformers.js) executam em Workers, separadas da interface.
- A comunicação usa mensagens tipadas (`DecoderRequest`/`DecoderResponse`, `TranscriptionRequest`/`TranscriptionResponse`), com `id` de correlação e canais de erro explícitos.
- Buffers `Float32Array` são transferidos quando possível para evitar cópias desnecessárias.
- Nenhum Worker carrega script remoto via `importScripts`; todo código vem do próprio build.
- O motor Rust/WASM é determinístico e sem I/O de rede, filesystem, relógio ou randomização.

### Liberação de URLs e recursos

- Toda URL temporária criada com `URL.createObjectURL` deve ser revogada com `URL.revokeObjectURL` após o carregamento, em caso de erro e ao descartar o arquivo/resultado.
- Não usar URLs `data:` para mídias grandes.
- Workers, listeners e ReferenceErrors associados a um job devem ser limpos ao concluir, cancelar ou desmontar a aplicação.

## Riscos residuais

| Risco | Natureza | Mitigação / observação |
| --- | --- | --- |
| Modelo e runtime vêm de CDN externa na primeira execução | Cadeia de suprimentos e disponibilidade | Repositórios públicos e licenças documentadas; não há verificação de assinatura no cliente. Não é possível garantir integridade absoluta da CDN. |
| Dependências de terceiros | Vulnerabilidades upstream | Fixar versões no `package.json`/lockfile, acompanhar advisories e atualizar com testes. |
| Cache do navegador | Artefatos persistem após o uso | Usuário pode limpar dados do site; ver [PRIVACY.md](PRIVACY.md). |
| Limites de memória do navegador | Falhas em arquivos grandes ou modelos `small` | Limites, validação e mensagens de erro; Safari/iOS podem ser mais restritivos. |
| Alucinações do ASR | Qualidade, não segurança | VAD reduz trechos de silêncio; revisão humana continua necessária. |
| Ambientes de hospedagem | Cabeçalhos e isolamento variam | Validar CSP/WASM por plataforma; registrar no relatório de validação. |

## Verificação e resposta

- Testes automatizados: `npm run test:unit`, `npm run test:e2e`, `npm run test:all` e `cargo test --manifest-path rust/audio-engine/Cargo.toml`.
- Antes dos testes E2E: `npx playwright install chromium`.
- Reportes de vulnerabilidade devem ser privados, conforme [SECURITY.md](../SECURITY.md). Correções são registradas no [CHANGELOG.md](../CHANGELOG.md).
