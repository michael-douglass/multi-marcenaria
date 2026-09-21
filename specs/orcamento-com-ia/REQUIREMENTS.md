# REQUIREMENTS — Orçamento com IA

**Status:** Fase 1 (SPECIFY) — contém decisões em aberto (seção 6), não pronto para DESIGN.
**Data:** 2026-09-18
**Contexto de produto/técnico:** `docs/product.md`, `docs/tech.md`, `docs/structure.md`,
`docs/glossary.md`.

## 1. Contexto e inventário do que já existe

Este módulo **não nasce do zero**. Refunda o botão "Compor com IA" já existente na Calculadora de
Markup (decisão `docs/decisions/0001-refundar-compor-com-ia.md`). Antes de qualquer requisito abaixo,
registra-se o que já está construído e será reaproveitado:

| Peça | Caminho | Papel |
|---|---|---|
| Pipeline de 7 fases | `supabase/functions/compose-markup-ia/index.ts` | Orquestra Fidelidade → Projetista → Inventariante → Auditor Inventário → Auditor Projetista → Precificador → Auditoria final |
| Motor de cálculo determinístico | `src/lib/markup-motor-calculo.ts` + `_shared/` | Fórmulas de chapa/fita/corrediça/dobradiça — existe e é testado, mas hoje não é a fonte de verdade do pipeline |
| Matching item↔catálogo | `src/lib/markup-match.ts` + `_shared/` | `casarProdutoNoCatalogo`, `confiancaEhSugerivel`, `deveAutoAceitarMatch` |
| Regras construtivas editáveis | tabela `markup_regras_construtivas`, UI `MarkupRegrasConstrutivasEditor.tsx` | Espessuras, folgas, tabela de dobradiça por altura, % de perda |
| UI da calculadora | `MarkupCalculatorSheet.tsx` (2.634 linhas) | Ponto de entrada do botão "Compor com IA" |
| Painéis de composição por IA | `MarkupIAAnexosPicker`, `MarkupIAComposeOverlay`, `MarkupIAConferenciaDialog`, `MarkupIAResumoPanel`, `MarkupIAVerificacaoChecklist`, `MarkupIAMoveisMarkers`, `MarkupIAProjetistaPanel`, `MarkupIAFidelidadePanel` | Upload, progresso, revisão, resultado editável |
| Composição do orçamento final (client-side) | `src/lib/markup-compose.ts` (`agregarLinhasPorProduto`) | Gera `materiais.linhas` persistido |
| Validação pré-save | `src/lib/markup-compose-validate.ts` | Hoje só popula `avisos`, nunca `erros` — ver seção 6, P1 |
| Persistência | `markup_orcamentos`, `markup_orcamento_linhas`, `markup_produtos`, `markup_config` (schema-per-empresa) | |
| Módulo de proposta ao cliente (separado, ~40 arquivos) | `src/pages/orcamento-slides/*`, `src/lib/orcamento-slide-*.ts` | Hoje desconectado do markup — é um dos destinos definidos (seção 4, RF-08) |
| PRD anterior do mesmo tema | `docs/prd-markup-ia-composicao-visual.md` | Diagnóstico anterior, mapa de reaproveitamento, decisão de risco que este documento resolve (seção 6 de lá → decisão 0002) |
| Guia de referência do usuário | `docs/sistemadeprecificacaocomia.md` | Fórmulas e schema que inspiraram o motor de cálculo |
| Pesquisa técnica com fontes | `docs/referencia-caixaria-mdf.md` | Calibração de chapa/corrediça/dobradiça/pedras |

**Histórico do problema que motiva este módulo**: testes reais ao vivo (lead 10482) mostraram
material bem abaixo do esperado. Correções pontuais já aplicadas: snapping de corrediça para tamanho
comercial, glossário de caixaria injetado no prompt, categoria `pedras_bancadas` no checklist,
fallback de `totais_consolidados` no `agregarLinhasPorProduto`. Este documento existe para parar de
remendar caso a caso e fixar o comportamento correto por escrito.

## 2. Objetivos

1. **Quantidade de material exata e auditável** — todo número final tem uma origem rastreável (regra
   de fórmula aplicada, linha de planilha real, ou estimativa manual), nunca um número sem explicação.
2. **Motor de cálculo como fonte de verdade da conta de material** (decisão `0002`) — a IA extrai
   dados (dimensão, tipologia, acabamento); o código calcula quantidade.
3. **Um único resultado de composição serve aos quatro destinos** definidos (seção 4, RF-08): abas da
   calculadora, PDF, proposta ao cliente, lista de compras/plano de corte — sem reprocessar o mesmo
   projeto quatro vezes.
4. **Revisão humana continua soberana** — nenhum número calculado é definitivo antes de passar pela
   tela de revisão; tudo permanece editável.
5. Resolver, na raiz, a subcontagem de material observada nos testes reais — não com mais um remendo
   pontual, mas com o contrato de comportamento fixado neste documento.

## 3. User Stories

- **Como vendedor/orçamentista**, quero anexar o projeto (PDF/imagem/planilha Cortecloud) do lead e
  receber uma proposta de materiais e serviços já calculada, para não montar o orçamento peça por
  peça manualmente.
- **Como vendedor/orçamentista**, quero ver, para cada linha de material, a regra ou fórmula que
  gerou aquela quantidade, para poder confiar no número ou corrigi-lo com segurança.
- **Como projetista**, quero que as dimensões que eu já forneço no projeto sejam a base do cálculo de
  chapa/fita/dobradiça, sem depender de a IA "adivinhar" a conta em texto livre.
- **Como administrador**, quero que um orçamento com lacuna crítica identificada pelo próprio auditor
  não vire preço fechado por acidente (comportamento exato ainda em aberto — seção 6, P1).
- **Como administrador**, quero editar as regras construtivas (espessuras, % de perda, tabela de
  dobradiça) sem precisar de deploy de código, e ver o próximo orçamento refletir a mudança.
- **Como equipe de produção**, quero uma lista de compras/plano de corte derivada do mesmo orçamento
  aprovado, sem digitar os materiais de novo.
- **Como cliente**, quero receber uma proposta de apresentação (Orçamento Slides) coerente com o
  custo calculado internamente, sem depender de alguém copiar valores manualmente entre os dois
  módulos.

## 4. Requisitos Funcionais

- **RF-01 — Entrada de arquivos**: o módulo aceita PDF multi-página (até o limite atual de 50
  páginas, `pdfAllPagesToJpegBlobs`), imagem única, e planilha Cortecloud (`xlsx`) com coluna `QUANT`.
- **RF-02 — Extração pela IA**: as fases Fidelidade e Projetista continuam responsáveis por ler o
  material anexado e extrair: móveis identificados, dimensões físicas (altura/largura/profundidade),
  tipologia, cor/acabamento, e — quando existir planilha Cortecloud — a quantidade real por linha.
- **RF-03 — Cálculo determinístico de quantidade**: para todo material coberto por uma regra
  construtiva (chapa, fita de borda, corrediça, dobradiça), a quantidade final vem do motor de
  cálculo (`markup-motor-calculo.ts`) aplicado sobre os dados extraídos em RF-02 e sobre a regra
  construtiva ativa (`markup_regras_construtivas`) — não da leitura em texto livre da IA (decisão
  `0002`). A relação exata entre "planilha Cortecloud real" e "motor de fórmula" quando os dois
  existem para o mesmo item é uma decisão em aberto (seção 6, ver também `0002`/consequências).
- **RF-04 — Categorias fora de fórmula**: material sem regra construtiva definida (ferragem
  decorativa específica, pedra/bancada, puxador de modelo raro) continua sendo extraído por leitura
  de IA em texto livre, seguindo o padrão já existente (categoria `pedras_bancadas`, dica Cortecloud
  por categoria).
- **RF-05 — Matching com catálogo**: todo material calculado ou extraído passa pelo matching difuso
  já existente (`casarProdutoNoCatalogo`) antes de virar linha de orçamento; item sem correspondência
  fica visível para cadastro/seleção manual.
- **RF-06 — Rastreabilidade por item**: cada linha do resultado exibe sua origem — "regra: dobradiça
  até 1600mm → 3 unidades", "planilha Cortecloud, linha X", "estimativa do projetista (dimensão)",
  "informado manualmente". Não pode existir número final sem explicação de origem.
- **RF-07 — Revisão humana editável**: nenhuma linha do resultado é somente-leitura antes de salvar;
  todo campo (quantidade, preço, origem) pode ser corrigido manualmente na tela de conferência
  (`MarkupIAConferenciaDialog`/`MarkupIAResumoPanel`), preservando o comportamento atual.
- **RF-08 — Quatro destinos do resultado**:
  - (a) Abas Materiais/Serviços/Despesas da Calculadora de Markup (destino atual, mantido).
  - (b) PDF / folha de orçamento (reaproveitar base existente em `markup-pdf-export.ts` /
    `markup-orcamento-simples-export.ts`).
  - (c) Proposta do cliente — alimentar o módulo Orçamento Slides (`src/pages/orcamento-slides/`),
    hoje preenchido manualmente e desconectado do markup.
  - (d) Lista de compras / plano de corte para a produção — saída nova, ainda sem componente
    existente no repositório.
- **RF-09 — Regras construtivas editáveis sem deploy**: alterações em `markup_regras_construtivas`
  (via `MarkupRegrasConstrutivasEditor.tsx`) devem refletir na próxima composição, sem precisar de
  alteração de código.
- **RF-10 — Auditoria de lacuna**: a flag `bloqueado`/auditoria de lacuna crítica continua sendo
  calculada; o comportamento exato do que ela impede é decisão em aberto (seção 6, P1).
- **RF-11 — Tratamento de material sem preço no catálogo**: comportamento exato é decisão em aberto
  (seção 6, P2) — inclui o caso já confirmado como intencional das chapas genéricas MADEIRA/MDF
  BRANCO/NEUTRO em R$ 0,00 (flag proposital para forçar escolha manual de marca/cor).

## 5. Requisitos Não-Funcionais

- **RNF-01 — Custo de IA por composição**: o número de chamadas OpenAI por composição não deve
  aumentar em relação ao pipeline atual; RF-03 (cálculo determinístico) deve, se possível, **reduzir**
  esse número ao tirar da IA a tarefa de "decidir" quantidade em texto livre.
- **RNF-02 — Tempo dentro do timeout**: a composição completa (todas as fases) precisa terminar
  dentro do timeout de 180s do cliente para chamadas de edge function (`src/lib/supabase.ts`).
- **RNF-03 — Multi-tenant**: toda nova tabela, RPC ou query considera o modelo schema-per-empresa
  (ex. `emp_garbo`) — nunca uma tabela `public` compartilhada com coluna de tenant.
- **RNF-04 — Guardrail de correção**: não há lint nem test runner automatizado neste projeto;
  `pnpm build` (que roda `tsc`) é o único guardrail automático. Toda verificação de comportamento é
  manual, ponta a ponta, na aplicação real.
- **RNF-05 — Sincronia client/`_shared`**: qualquer mudança em `markup-motor-calculo.ts`,
  `markup-match.ts`, `markup-cortecloud.ts` ou nos arquivos de IA precisa ser replicada manualmente
  no par correspondente (client `src/lib/` ↔ Deno `supabase/functions/_shared/`) — não existe
  mecanismo de sync automático hoje.
- **RNF-06 — Bundle do CRM**: qualquer UI nova deste módulo dentro do CRM deve continuar `lazy()`-
  loaded; o bundle do CRM já excede 5MB.
- **RNF-07 — Compatibilidade com orçamentos existentes**: mudanças no formato de `materiais.linhas`
  não podem quebrar a leitura de orçamentos já persistidos (148+ registros reais em produção).

## 6. Decisões em aberto (bloqueantes para a fase DESIGN)

O usuário optou explicitamente por não fechar estas agora — ficam registradas com os trade-offs para
decisão futura, antes de `specs/orcamento-com-ia/DESIGN.md`:

### P1 — Comportamento diante de lacuna crítica

Hoje `bloqueado` é calculado corretamente no servidor (`compose-markup-ia/index.ts`) e aparece como
aviso visível (`MarkupIAResumoPanel.tsx`), mas `markup-compose-validate.ts` só popula `avisos`, nunca
`erros` — o botão Salvar permanece liberado mesmo com lacuna crítica identificada pelo próprio
auditor.

| Opção | Efeito |
|---|---|
| Travar o Salvar | Impede fechar preço com orçamento subcontado sem intervenção; mais rígido |
| Avisar forte, deixar salvar | Mantém o comportamento atual, só mais visível/difícil de ignorar |
| Travar só a saída ao cliente | Permite rascunho interno com pendência, mas bloqueia PDF/proposta enquanto houver item crítico |

### P2 — Material sem preço no catálogo

Inclui tanto item extraído sem correspondência no catálogo quanto os casos já confirmados como
intencionais (chapas genéricas MADEIRA/MDF BRANCO/NEUTRO em R$ 0,00, propositalmente, para forçar
escolha manual de marca/cor).

| Opção | Efeito |
|---|---|
| Marcar como pendência para o usuário resolver | Entra no orçamento com quantidade certa, preço em aberto, destacado |
| Usar preço médio da categoria | Orçamento sai com valor aproximado, menos exato |
| Ignorar o item e avisar | Total fica "limpo", mas o item some da conta até revisão |

## 7. Out of Scope

- Trocar o provedor de IA (permanece OpenAI, allowlist atual).
- Entrada de arquivo 3D/DWG — só PDF, imagem e planilha (RF-01).
- Reescrever o módulo de contratos ou o pipeline de leads em si.
- Migração/reprocessamento retroativo dos orçamentos já salvos em produção.
- Definir o valor numérico do motor de cálculo em si (fórmulas, % de perda) — já existe e está fora
  de discussão nesta spec; a discussão aqui é **quem manda** na decisão (IA vs. motor), não a fórmula.
- Unificar de fato o schema de dados entre Markup e Orçamento Slides — RF-08(c) pede que o resultado
  alimente a proposta, não que os dois módulos se fundam em um só.
