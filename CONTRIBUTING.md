# Contribuindo para o Sonyia

Obrigado por contribuir! As regras completas estão em [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md). Resumo:

## Comece aqui

```bash
npm install
npm run assets
npm run dev
```

Para testar:

```bash
npx playwright install chromium
npm run typecheck
npm run test:unit
npm run test:all
cargo test --manifest-path rust/audio-engine/Cargo.toml
```

## Regras essenciais

- ESLint/estilo do projeto: TypeScript rigoroso, sem `any` implícito, nomes claros; Rust formatado com `rustfmt`.
- Commits no estilo **Conventional Commits**: `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`, `ci:`.
- Versionamento semântico (SemVer): `1.0.0`; mudanças incompatíveis só em nova major, funcionalidades compatíveis em minor, correções em patch.
- Não adicione backend, telemetria, chaves de API nem upload de mídia. Preserve a execução local.
- Atualize a documentação e o [CHANGELOG.md](CHANGELOG.md) junto com mudanças visíveis.
- Abra issues com o template correto; PRs devem passar nos testes e descrever o impacto em privacidade, segurança e licenças.

Leia [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) para detalhes de arquitetura, testes e checklist de PR.
