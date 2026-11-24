# Guia de contribuição — Sonyia

## Expectativas gerais

O Sonyia é local-first: qualquer mudança que introduza servidor, telemetria, chave de API, upload de mídia ou persistência de transcrições precisa de discussão prévia e revisão de [PRIVACY.md](PRIVACY.md) e [SECURITY.md](SECURITY.md). Respeite as licenças das dependências — em especial `@ffmpeg/core` (GPL-2.0-or-later), que define a licença geral GPL-3.0-or-later do projeto.

## Ambiente

- Node.js >= 20.19 e npm.
- Rust stable, alvo `wasm32-unknown-unknown` e `wasm-pack` apenas se você for alterar `rust/audio-engine`.
- Navegador moderno com WebAssembly e Web Workers.

```bash
npm install
npm run assets
npm run dev
```

## Padrões de código

### TypeScript / Vite

- Use TypeScript com checagem estrita (`npm run typecheck`); evite `any`, assertions injustificadas e efeitos colaterais em módulos.
- Respeite os contratos em `src/core/types.ts`: mensagens dos workers, estágios de progresso, opções e resultado da transcrição.
- Texto do usuário é sempre dado: renderize com `textContent`, nunca com `innerHTML`; higienize nomes de arquivos usados em downloads.
- Não faça `fetch` para serviços externos. Modelos e runtime são carregados apenas pela camada declarada de inferência.
- Mantenha Workers isolados do DOM, cancele jobs e revogue `URL.createObjectURL` ao terminar.
- Componentes/funções pequenas, nomes descritivos e comentários apenas quando explicam uma decisão não óbvia.

### Rust / WebAssembly

- Siga `rustfmt` e evite `unsafe` desnecessário.
- O motor deve permanecer determinístico: sem rede, filesystem, relógio ou aleatoriedade.
- Todo comportamento novo de DSP/VAD precisa de teste unitário em `rust/audio-engine/src/`.
- Regere os artefatos com `npm run build:wasm` se alterar o crate.

### Documentação

- READMEs em pt/en/es devem permanecer alinhados (17 seções).
- Documente limitações honestamente; não invente precisão percentual, compatibilidade universal nem funcionalidades (diarização e tradução estão fora do escopo 1.0.0).
- Ao alterar dependências, modelos ou licenças, atualize [MODELS.md](MODELS.md) e o [CHANGELOG.md](../CHANGELOG.md).

## Testes

```bash
npx playwright install chromium   # uma vez, para E2E
npm run typecheck
npm run test:unit
npm run test:e2e
npm run test:all                 # typecheck + unit + build + e2e
cargo test --manifest-path rust/audio-engine/Cargo.toml
```

- Testes unitários (Vitest) cobrem lógica pura e contratos; E2E (Playwright) cobrem fluxo no navegador.
- Faixas de áudio de teste ficam em `tests/fixtures/`; não adicione mídia com licença desconhecida.
- Novos bugs devem vir acompanhados de um teste que falhe antes da correção.
- Chrome, Edge, Firefox e Safari são alvos de teste; os resultados ficam no relatório de validação. Não declare suporte sem evidência.

## Commits e branches

- Use **Conventional Commits**: `feat: adiciona exportação SRT`, `fix: corrige liberação de URL`, `docs: atualiza MODELS`, `test: cobre VAD com ruído`, `refactor:`, `chore:`, `ci:`.
- Branches curtas: `feat/nome-curto`, `fix/nome-curto`, `docs/nome-curto`.
- Um commit por mudança lógica; mensagens no imperativo, sem ruído.

## Versionamento

Sonyia segue **Semantic Versioning** (`MAJOR.MINOR.PATCH`, atualmente `1.0.0`):

- `MAJOR`: mudanças incompatíveis (por exemplo, contratos dos workers).
- `MINOR`: funcionalidades compatíveis.
- `PATCH`: correções compatíveis.

Cada versão publicada deve ter entrada correspondente no [CHANGELOG.md](../CHANGELOG.md) com Added/Changed/Fixed/Security.

## Pull requests

1. Descreva o problema, a mudança e como testar.
2. Marque impactos em privacidade, segurança, licenças e documentação.
3. Inclua o comando de teste executado e o resultado.
4. Anexe evidência visual quando a mudança afetar a interface.
5. Garanta que o CI (node matrix, wasm e e2e) está verde.
6. Não inclua segredos, tokens, arquivos binários grandes sem necessidade nem alterações não relacionadas.

## Reportar problemas

Use os templates de issue: bug report para comportamentos incorretos e feature request para propostas. Vulnerabilidades de segurança devem ser reportadas **privadamente** conforme [SECURITY.md](../SECURITY.md), nunca em issue pública.
