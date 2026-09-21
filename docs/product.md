# Product — GARBO Movelaria

## O que é

GARBO Movelaria é o sistema interno de uma marcenaria: uma SPA (Vite + React + TypeScript) com
backend Supabase, que roda **dois produtos dentro de uma casca só**:

- **Núcleo "Movelaria"** — gestão financeira, acompanhamento de obras/instalação, ponto dos
  funcionários. Este é o negócio original: controlar caixa, contas a pagar/receber, produção e
  montagem das obras já vendidas.
- **CRM "Selletos"** (módulo embutido) — leads, pipeline de vendas, contratos, markup/precificação,
  marketing e eventos. Este é o funil que gera as obras que o núcleo depois executa.

Os dois compartilham autenticação e roteamento, mas têm sistemas de permissão, contexto de estado e
convenções de nome **independentes** (ver `docs/structure.md`, seção "core vs CRM"). Um mesmo usuário
pode ter papel nos dois ao mesmo tempo.

## Papéis reais (extraídos do código, não hipotéticos)

**Núcleo (`UserRole`, `src/types`, gate em `src/lib/role-access.ts`):**
`Administrador`, `Financeiro`, `Marceneiro`, `MontadorAdmin`, `AdministradorObras`, `Montador`,
`Visualizador`. Um usuário cujo único papel é `Marceneiro` opera em modo somente-leitura nas telas
financeiras (`readOnly`/`guardReadOnly`).

**CRM (`CrmRole`, `src/lib/crm-identity.ts`, gate em `canAccessCrmPath`):**
`admin`, `vendedor`, `marketing`, `projetista`, `projetista_admin`, `nenhum`.

## A jornada de um orçamento, ponta a ponta

```
Lead entra no pipeline (CRM)
        │
        ▼
Vendedor/projetista levanta o projeto (medidas, plantas, fotos, planilha de corte)
        │
        ▼
Calculadora de Markup — monta o CUSTO interno (materiais + serviços + despesas → preço final)
        │  ← é aqui que vive o botão "Compor com IA" e o pipeline de 7 agentes
        │
        ▼
Orçamento Slides — monta a PROPOSTA que o cliente vê (apresentação, formas de pagamento)
        │
        ▼
Contrato assinado → vira Obra (produção, montagem, ponto dos montadores)
```

Markup (custo) e Orçamento Slides (proposta) são **módulos hoje desconectados** — o valor calculado
no markup precisa ser levado à proposta manualmente. Isso é relevante para o módulo "Orçamento com
IA": uma das decisões já tomadas (ver `specs/orcamento-com-ia/REQUIREMENTS.md`) é que o resultado da
composição por IA deve alimentar os dois lados, não só o markup.

## Onde o módulo "Orçamento com IA" entra

O botão "Compor com IA" dentro da Calculadora de Markup permite anexar o material do projeto (PDF,
imagem, planilha Cortecloud do fornecedor) e um pipeline de agentes de IA extrai móveis, dimensões,
cores e ferragens, e monta uma proposta de materiais/serviços para revisão humana antes de salvar.

**Motivação do trabalho atual**: testes reais mostraram a quantidade de material saindo bem abaixo do
esperado — um problema de negócio direto, porque um orçamento subcontado significa preço vendido
abaixo do custo real. O módulo está sendo especificado (fase SPECIFY, ver
`specs/orcamento-com-ia/REQUIREMENTS.md`) para corrigir isso na raiz antes de qualquer novo código.
