# 0001 — Refundar o "Compor com IA" em vez de criar um módulo paralelo

**Status:** Aceita
**Data:** 2026-09-18

## Contexto

Ao iniciar a fase SPECIFY do módulo "Orçamento com IA", a exploração do repositório mostrou que já
existe um sistema maduro cobrindo exatamente esse escopo: pipeline de 7 agentes de IA
(`supabase/functions/compose-markup-ia/index.ts`, 1.813 linhas), catálogo e matching de produtos
(`markup-match.ts`), motor de cálculo (`markup-motor-calculo.ts`), tabelas persistidas
(`markup_orcamentos`, `markup_orcamento_linhas`), e cerca de 12 componentes de UI (`MarkupIA*.tsx`).
Havia três leituras possíveis para "novo módulo": reescrever esse pipeline no lugar, construir algo
isolado ao lado, ou unir markup + proposta ao cliente num fluxo só.

## Decisão

O módulo "Orçamento com IA" é a **evolução especificada do "Compor com IA" já existente** — mantém as
tabelas (`markup_orcamentos` etc.), as rotas e a UI de entrada (Calculadora de Markup), mas o
comportamento interno do pipeline passa a seguir a especificação escrita em
`specs/orcamento-com-ia/REQUIREMENTS.md`, corrigindo na raiz os problemas encontrados nos testes
reais (quantidade de material subcontada).

## Consequências

- Zero duplicação de catálogo, matching ou lógica de precificação — um único caminho de dados.
- A especificação precisa ser escrita **contra** o código existente (inventário obrigatório na spec),
  não como se o campo estivesse vazio.
- Os 148+ orçamentos reais já persistidos continuam válidos; nenhuma migração de dados históricos é
  necessária para esta decisão (mas fica fora de escopo qualquer reprocessamento retroativo deles).
- Mudanças no pipeline afetam um arquivo grande, sem suíte de testes automatizada
  (`compose-markup-ia/index.ts`) — reforça a necessidade de uma spec clara antes de tocar no código,
  em vez de remendar caso a caso como vinha sendo feito.
