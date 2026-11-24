## Resumo

<!-- Descreva o problema e a mudança em poucos parágrafos. -->

## Tipo de mudança

- [ ] `feat` — nova funcionalidade compatível
- [ ] `fix` — correção de bug
- [ ] `docs` — documentação
- [ ] `test` — testes
- [ ] `refactor` / `chore` / `ci` — manutenção

## Como testar

<!-- Passos objetivos para validar a mudança. Inclua navegador, modelo e arquivo de teste genérico, sem mídia confidencial. -->

1.
2.
3.

## Comandos executados

```bash
npm run typecheck
npm run test:unit
npm run test:all
cargo test --manifest-path rust/audio-engine/Cargo.toml
```

<!-- Marque apenas o que você executou e cole o resultado relevante. -->

## Impacto

- [ ] Sem impacto em privacidade (nenhum dado sai do dispositivo)
- [ ] Sem impacto em segurança (CSP, sanitização, validação, limites e URLs inalterados)
- [ ] Sem novas dependências ou mudanças de licença
- [ ] Documentação/READMEs atualizados
- [ ] CHANGELOG.md atualizado (quando aplicável)

## Checklist

- [ ] O código segue os padrões de `docs/CONTRIBUTING.md`
- [ ] Commits seguem Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`...)
- [ ] Testes novos ou ajustados cobrem a mudança
- [ ] Não incluí segredos, tokens, telemetria, backend ou upload de mídia
- [ ] Não afirmei precisão percentual fictícia nem compatibilidade universal sem testes

## Issues relacionadas

<!-- Ex.: Closes #123 -->
