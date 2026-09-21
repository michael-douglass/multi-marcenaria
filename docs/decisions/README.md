# Decisions — ADRs do projeto

Registro de decisões arquiteturais/de produto que não são óbvias a partir do código isolado — o
"porquê" ficaria perdido se só vivesse numa conversa.

## Convenção

- Arquivo por decisão: `NNNN-titulo-curto-em-kebab-case.md`, numeração sequencial, nunca reaproveitada.
- Formato mínimo:

```markdown
# NNNN — Título da decisão

**Status:** Proposta | Aceita | Substituída por NNNN
**Data:** AAAA-MM-DD

## Contexto
O problema ou necessidade que levou à decisão.

## Decisão
O que foi decidido, em uma ou duas frases diretas.

## Consequências
O que isso implica — o que fica mais fácil, o que fica mais difícil, o que ficou de fora.
```

- Uma decisão nunca é editada para mudar de ideia — se algo muda, cria-se um novo ADR com
  **Status: Substituída por NNNN** apontando para ele, e o antigo ganha esse rótulo.
- ADRs registram decisões **já tomadas**, não propostas em aberto — decisões ainda pendentes vivem na
  spec do módulo correspondente (ex. seção "Decisões em aberto" de
  `specs/orcamento-com-ia/REQUIREMENTS.md`) até serem fechadas.
